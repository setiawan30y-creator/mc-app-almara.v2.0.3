<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Mengambil halaman sumber acuan kurs (URL yang diisi admin di Manajemen Kurs)
 * lewat server, agar browser tidak terkena batasan CORS dan URL tidak bocor
 * ke layanan proxy pihak ketiga. Parsing tabel kurs dilakukan di browser.
 *
 * Pengamanan SSRF: hanya http/https port 80/443, host harus ter-resolve ke
 * IP publik (bukan localhost / jaringan privat), redirect tidak diikuti, dan
 * koneksi dikunci ke IP hasil validasi.
 */
class KursSourceController extends Controller
{
    private const MAX_BYTES = 3 * 1024 * 1024;
    private const CACHE_SECONDS = 20;

    public function fetch(Request $request)
    {
        $url = trim((string) $request->query('url', ''));
        $check = $this->validateUrl($url);
        if (isset($check['error'])) {
            return $this->fail($check['error'], 422);
        }

        $cacheKey = 'kurs_source:' . sha1($url);
        if ($cached = Cache::get($cacheKey)) {
            return response()->json($cached);
        }

        try {
            $response = Http::timeout(15)
                ->withoutRedirecting()
                ->withOptions([
                    'curl' => [CURLOPT_RESOLVE => [$check['host'] . ':' . $check['port'] . ':' . $check['ip']]],
                ])
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
                    'Accept' => 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
                ])
                ->get($url);
        } catch (\Throwable $e) {
            return $this->fail('Server tidak dapat terhubung ke sumber: ' . $e->getMessage());
        }

        if (!$response->successful()) {
            return $this->fail('Sumber mengembalikan status HTTP ' . $response->status());
        }

        $body = $response->body();
        if ($body === '' || strlen($body) > self::MAX_BYTES) {
            return $this->fail($body === '' ? 'Sumber mengembalikan halaman kosong.' : 'Halaman sumber terlalu besar.');
        }
        if (stripos($body, '<table') === false) {
            return $this->fail('Halaman sumber terbuka, tetapi tabel kurs tidak ditemukan.');
        }

        $payload = [
            'status' => 'success',
            'html' => $body,
            'fetched_at' => now()->toIso8601String(),
        ];
        Cache::put($cacheKey, $payload, self::CACHE_SECONDS);

        return response()->json($payload);
    }

    private function validateUrl(string $url): array
    {
        if ($url === '' || strlen($url) > 500) {
            return ['error' => 'URL sumber belum diisi atau terlalu panjang.'];
        }
        $parts = parse_url($url);
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = strtolower($parts['host'] ?? '');
        if (!in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
            return ['error' => 'URL harus diawali http:// atau https://.'];
        }
        $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        if (!in_array($port, [80, 443], true)) {
            return ['error' => 'Port URL tidak diizinkan.'];
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if (!$ips) {
            return ['error' => 'Alamat sumber tidak ditemukan (DNS).'];
        }
        foreach ($ips as $ip) {
            $public = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
            if ($public === false) {
                return ['error' => 'Alamat sumber mengarah ke jaringan internal dan tidak diizinkan.'];
            }
        }

        return ['host' => $host, 'port' => $port, 'ip' => $ips[0]];
    }

    private function fail(string $message, int $code = 502)
    {
        return response()->json(['status' => 'error', 'message' => $message], $code);
    }
}
