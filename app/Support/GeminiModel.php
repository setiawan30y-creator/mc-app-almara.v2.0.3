<?php
// @2026-Alifiandra

namespace App\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Memilih model Gemini yang masih tersedia untuk key pengguna.
 * Google rutin mempensiunkan model lama, jadi nama model tidak ditulis mati:
 * daftar model dibaca dari API, lalu dipilih seri "flash" stabil terbaru.
 * Bisa dipaksa lewat GEMINI_MODEL di .env.
 * Key dikirim sebagai parameter ?key= (format key baru "AQ." tidak diterima lewat header).
 */
class GeminiModel
{
    public const BASE = 'https://generativelanguage.googleapis.com/v1beta/';
    public const FALLBACK = 'gemini-flash-latest';

    /** Daftar model yang bisa dipakai, urut dari yang paling disarankan. @return string[] */
    public static function candidates(string $key, bool $fresh = false): array
    {
        $forced = trim((string) (config('services.gemini.model') ?: env('GEMINI_MODEL', '')));
        if ($forced !== '') {
            return [$forced];
        }
        $ck = 'gemini_models_' . substr(hash('sha256', $key), 0, 16);
        if (!$fresh && is_array($c = Cache::get($ck)) && $c) {
            return $c;
        }

        $flash = [];
        $lite = [];
        try {
            $res = Http::timeout(15)->get(self::BASE . 'models', ['pageSize' => 200, 'key' => $key]);
            if ($res->successful()) {
                foreach ((array) $res->json('models') as $m) {
                    $name = (string) ($m['name'] ?? '');
                    if (!in_array('generateContent', (array) ($m['supportedGenerationMethods'] ?? []), true)) {
                        continue;
                    }
                    if (preg_match('#^models/(gemini-(\d+(?:\.\d+)?)-flash)$#', $name, $mm)) {
                        $flash[$mm[1]] = $mm[2];
                    } elseif (preg_match('#^models/(gemini-(\d+(?:\.\d+)?)-flash-lite)$#', $name, $mm)) {
                        $lite[$mm[1]] = $mm[2];
                    }
                }
            }
        } catch (\Throwable $e) {
            // jatuh ke alias
        }
        uasort($flash, fn ($a, $b) => version_compare($b, $a));
        uasort($lite, fn ($a, $b) => version_compare($b, $a));
        $list = array_merge(array_keys($flash), array_keys($lite));
        if (!$list) {
            return [self::FALLBACK];
        }
        $list[] = self::FALLBACK;
        $list = array_values(array_unique($list));
        Cache::put($ck, $list, now()->addHours(6));
        return $list;
    }

    public static function resolve(string $key, bool $fresh = false): string
    {
        return self::candidates($key, $fresh)[0];
    }

    /**
     * POST generateContent.
     * - Model tidak tersedia (404): daftar model diperbarui lalu dicoba lagi.
     * - Layanan padat (503/429/"high demand"): coba ulang dengan jeda, lalu pindah ke model lain.
     */
    public static function post(string $key, array $body, int $timeout = 45): Response
    {
        $send = fn (string $model) => Http::timeout($timeout)
            ->post(self::BASE . 'models/' . $model . ':generateContent?key=' . rawurlencode($key), $body);
        $busy = function (Response $r): bool {
            $m = (string) $r->json('error.message');
            return in_array($r->status(), [429, 500, 502, 503, 504], true) || (bool) preg_match('/high demand|overloaded|try again later/i', $m);
        };

        $models = self::candidates($key);
        $res = null;
        $lastError = null;
        $attempt = 0;
        foreach (array_slice($models, 0, 3) as $idx => $model) {
            $tries = $idx === 0 ? 3 : 1;
            for ($t = 0; $t < $tries; $t++) {
                if ($attempt++ > 0) {
                    usleep(($t > 0 ? 1500000 : 400000));
                }
                try {
                    $res = $send($model);
                } catch (\Throwable $e) {
                    // Timeout / jaringan: coba model berikutnya. Pesan asli memuat URL berisi key, jadi tidak diteruskan.
                    $lastError = $e instanceof \Illuminate\Http\Client\ConnectionException ? 'timeout' : 'network';
                    break;
                }
                if ($res->successful()) {
                    return $res;
                }
                $msg = (string) $res->json('error.message');
                if ($res->status() === 404 || preg_match('/no longer available|not found|not supported/i', $msg)) {
                    $fresh = self::candidates($key, true);
                    if ($fresh && $fresh[0] !== $model) {
                        $res = $send($fresh[0]);
                        if ($res->successful() || !$busy($res)) {
                            return $res;
                        }
                    }
                    break;
                }
                if (!$busy($res)) {
                    return $res;
                }
            }
        }
        if (!$res) {
            throw new \RuntimeException($lastError === 'timeout'
                ? 'Gemini tidak menjawab dalam batas waktu (layanan lambat atau padat). Coba lagi beberapa saat.'
                : 'Server tidak dapat menghubungi Gemini. Periksa koneksi internet server.');
        }
        return $res;
    }
}
