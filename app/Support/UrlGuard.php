<?php
// @2026-Alifiandra

namespace App\Support;

/**
 * Pengaman URL keluar (SSRF) untuk integrasi yang alamatnya diatur pengguna.
 *
 * Selalu ditolak : skema selain http/https, URL berisi user:password, port di luar 1-65535,
 *                  alamat IPv6 literal, rentang 0.0.0.0/8 dan 169.254.0.0/16 (termasuk metadata cloud).
 * Ditolak kecuali $allowPrivate : localhost dan jaringan privat (10.x, 172.16.x, 192.168.x, 127.x).
 *   $allowPrivate dipakai untuk gateway self-hosted (mis. WAHA di server/LAN sendiri).
 *
 * Hasil `ip` dipakai untuk mengunci koneksi (CURLOPT_RESOLVE) sehingga DNS tidak bisa
 * berubah di antara pemeriksaan dan pengiriman.
 */
class UrlGuard
{
    /** @return array{ok:bool,error:string,scheme:string,host:string,port:int,ip:string} */
    public static function inspect(string $url, bool $allowPrivate = false, bool $resolve = true): array
    {
        $fail = fn (string $m) => ['ok' => false, 'error' => $m, 'scheme' => '', 'host' => '', 'port' => 0, 'ip' => ''];

        $url = trim($url);
        if ($url === '' || strlen($url) > 2048) {
            return $fail('URL endpoint kosong atau terlalu panjang.');
        }
        $parts = parse_url($url);
        if ($parts === false) {
            return $fail('URL endpoint tidak valid.');
        }
        $scheme = strtolower($parts['scheme'] ?? '');
        $host = strtolower($parts['host'] ?? '');
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            return $fail('URL endpoint harus diawali http:// atau https://.');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            return $fail('URL endpoint tidak boleh berisi user:password. Pakai kolom Token atau Header.');
        }
        $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        if ($port < 1 || $port > 65535) {
            return $fail('Port URL endpoint tidak valid.');
        }
        if (str_starts_with($host, '[')) {
            return $fail('Alamat IPv6 belum didukung. Gunakan nama domain atau alamat IPv4.');
        }

        if (!$resolve && !filter_var($host, FILTER_VALIDATE_IP)) {
            // Pemeriksaan ringan saat simpan: nama "localhost" tetap dikenali.
            if (!$allowPrivate && ($host === 'localhost' || str_ends_with($host, '.localhost'))) {
                return $fail(self::privateMessage());
            }
            return ['ok' => true, 'error' => '', 'scheme' => $scheme, 'host' => $host, 'port' => $port, 'ip' => ''];
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if (!$ips) {
            return $fail('Alamat endpoint tidak ditemukan (DNS). Periksa penulisan domain.');
        }

        foreach ($ips as $ip) {
            if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                return $fail('Alamat IPv6 belum didukung. Gunakan nama domain atau alamat IPv4.');
            }
            if (self::inRange($ip, '169.254.0.0', 16) || self::inRange($ip, '0.0.0.0', 8)) {
                return $fail('Alamat endpoint tidak diizinkan (rentang alamat khusus/metadata).');
            }
            $public = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
            if (!$public && !$allowPrivate) {
                return $fail(self::privateMessage());
            }
        }

        return ['ok' => true, 'error' => '', 'scheme' => $scheme, 'host' => $host, 'port' => $port, 'ip' => $ips[0]];
    }

    private static function privateMessage(): string
    {
        return 'Endpoint mengarah ke localhost / jaringan internal. Jika gateway Anda self-hosted, centang "Izinkan alamat jaringan lokal" (khusus owner/superadmin).';
    }

    private static function inRange(string $ip, string $base, int $bits): bool
    {
        $ipLong = ip2long($ip);
        $baseLong = ip2long($base);
        if ($ipLong === false || $baseLong === false) {
            return false;
        }
        $mask = -1 << (32 - $bits);

        return ($ipLong & $mask) === ($baseLong & $mask);
    }
}
