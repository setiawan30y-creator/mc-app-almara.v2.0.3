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
    /** Batas total waktu satu permintaan (detik): harus selesai sebelum proxy (nginx/Cloudflare) memutus dengan 504. */
    public const BUDGET = 40;

    /**
     * Klien HTTP ke Google: batas waktu sambung pendek dan paksa IPv4.
     * Di banyak server, rute IPv6 tidak tersambung sehingga permintaan menggantung sampai timeout.
     * Matikan dengan GEMINI_FORCE_IPV4=false di .env bila tidak diperlukan.
     */
    public static function http(int $timeout)
    {
        $c = Http::connectTimeout(8)->timeout(max(5, $timeout));
        if (filter_var(env('GEMINI_FORCE_IPV4', true), FILTER_VALIDATE_BOOLEAN)) {
            $c = $c->withOptions(['force_ip_resolve' => 'v4']);
        }
        return $c;
    }

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
            $res = self::http(12)->get(self::BASE . 'models', ['pageSize' => 200, 'key' => $key]);
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

    /** Pesan galat jaringan tanpa URL/key, mis. "cURL error 28: Connection timed out after 8001 milliseconds". */
    public static function safeDetail(string $msg): string
    {
        $msg = preg_replace('#https?://\S+#i', '[url]', $msg);
        $msg = preg_replace('/key=[^\s&"\']+/i', 'key=***', (string) $msg);
        if (preg_match('/cURL error \d+:[^(]*/i', (string) $msg, $m)) {
            $msg = $m[0];
        }
        return trim(mb_substr((string) $msg, 0, 180));
    }

    /** Penjelasan yang bisa ditindaklanjuti berdasarkan kode galat cURL. */
    public static function explain(string $detail, ?string $kind): string
    {
        $code = preg_match('/cURL error (\d+)/i', $detail, $m) ? (int) $m[1] : 0;
        $why = match (true) {
            in_array($code, [60, 77, 35], true) => 'Sertifikat SSL server tidak dikenali (CA bundle PHP belum diatur, sering terjadi di Laragon/Windows).',
            $code === 6 => 'Nama domain Google tidak bisa di-resolve (DNS server bermasalah).',
            $code === 7 => 'Koneksi ke Google ditolak / diblokir (firewall atau jaringan).',
            $code === 28 => 'Koneksi ke Google habis waktu (internet server lambat, firewall, atau rute IPv6/IPv4 bermasalah).',
            $code === 5 => 'Proxy server tidak bisa di-resolve.',
            default => $kind === 'timeout'
                ? 'Server aplikasi tidak bisa tersambung ke Gemini dalam batas waktu.'
                : 'Server tidak dapat menghubungi Gemini.',
        };
        return $why . ($detail !== '' ? ' [' . $detail . ']' : '');
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
        $start = microtime(true);
        $left = fn () => (int) floor(self::BUDGET - (microtime(true) - $start));
        $send = fn (string $model) => self::http(min($timeout, max(5, $left())))
            ->post(self::BASE . 'models/' . $model . ':generateContent?key=' . rawurlencode($key), $body);
        $busy = function (Response $r): bool {
            $m = (string) $r->json('error.message');
            return in_array($r->status(), [429, 500, 502, 503, 504], true) || (bool) preg_match('/high demand|overloaded|try again later/i', $m);
        };

        $models = self::candidates($key);
        $res = null;
        $lastError = null;
        $detail = '';
        $attempt = 0;
        foreach (array_slice($models, 0, 3) as $idx => $model) {
            $tries = $idx === 0 ? 3 : 1;
            for ($t = 0; $t < $tries; $t++) {
                if ($left() < 8) {
                    $lastError = $lastError ?? 'timeout';
                    break 2; // waktu habis: berhenti sebelum proxy memutus koneksi
                }
                if ($attempt++ > 0) {
                    usleep(($t > 0 ? 1500000 : 400000));
                }
                try {
                    $res = $send($model);
                } catch (\Throwable $e) {
                    // Timeout / jaringan: coba model berikutnya. Pesan asli memuat URL berisi key, jadi tidak diteruskan.
                    $lastError = $e instanceof \Illuminate\Http\Client\ConnectionException ? 'timeout' : 'network';
                    $detail = self::safeDetail($e->getMessage());
                    if ($lastError === 'timeout' && $res === null && $idx === 0) {
                        break 2; // tidak tersambung sama sekali: model lain juga tidak akan tersambung
                    }
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
            throw new \RuntimeException(self::explain($detail, $lastError));
        }
        return $res;
    }
}
