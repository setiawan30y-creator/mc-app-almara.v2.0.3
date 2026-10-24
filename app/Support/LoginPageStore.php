<?php
// @2026-Alifiandra

namespace App\Support;

use App\Models\Datastore;

/**
 * Pengaturan halaman login (teks, logo, latar) yang bisa dibaca tanpa login.
 *
 * - Disimpan di datastore dengan kunci "security_login_page": tidak ikut sinkronisasi
 *   browser dan tidak dikembalikan GET /api/datastore; ditulis lewat endpoint khusus
 *   yang dibatasi peran admin.
 * - Warna TIDAK disimpan di sini: halaman login mengikuti Tema global
 *   (Pengaturan > Tema: warna utama, warna utama hover, warna sekunder).
 * - Nama perusahaan: isian khusus, atau nama dari Profil Perusahaan bila dikosongkan.
 */
class LoginPageStore
{
    public const KEY = 'security_login_page';
    private const THEME_KEY = 'mc_global_theme_v2';
    private const ASSET_RE = '#^branding/login-(logo|bg)-\d{6,}\.(png|jpg|webp)$#';

    public const DEFAULTS = [
        'company_name' => '',
        'headline' => 'Kurs akurat, transaksi tertib, laporan siap diaudit.',
        'description' => 'Kasir, stok valas, kas dan bank, sampai pelaporan kepatuhan dalam satu aplikasi.',
        'features' => [
            'Transaksi kasir cepat dengan kurs terkini',
            'Stok valas, kas, dan bank selalu seimbang',
            'Closing harian dan laporan siap diaudit',
            'Hak akses berlapis dengan jejak aktivitas lengkap',
        ],
        'welcome_title' => 'Selamat datang kembali',
        'welcome_desc' => 'Masuk dengan akun Anda untuk melanjutkan ke {nama}.',
        'button_label' => 'Masuk',
        'security_note' => 'Aktivitas login tercatat untuk menjaga keamanan akun Anda.',
        'show_art' => true,
        'logo_file' => '',
        'bg_file' => '',
    ];

    public static function settings(): array
    {
        $row = self::row(self::KEY) ?? [];
        $s = array_merge(self::DEFAULTS, array_intersect_key($row, self::DEFAULTS));
        $features = is_array($s['features']) ? array_values($s['features']) : self::DEFAULTS['features'];
        $s['features'] = array_slice(array_pad(array_map(fn ($f) => is_string($f) ? $f : '', $features), 4, ''), 0, 4);
        $s['show_art'] = (bool) $s['show_art'];
        foreach (['logo_file', 'bg_file'] as $f) {
            $s[$f] = is_string($s[$f]) && preg_match(self::ASSET_RE, $s[$f]) ? $s[$f] : '';
        }

        return $s;
    }

    /** @param array $in nilai tervalidasi (teks); berkas logo/latar dikelola terpisah. */
    public static function save(array $in, string $by): array
    {
        $cur = self::settings();
        $next = $cur;
        foreach (['company_name', 'headline', 'description', 'welcome_title', 'welcome_desc', 'button_label', 'security_note'] as $k) {
            if (array_key_exists($k, $in)) {
                $next[$k] = trim(strip_tags((string) $in[$k]));
            }
        }
        if (isset($in['features']) && is_array($in['features'])) {
            $next['features'] = array_slice(array_pad(array_map(fn ($f) => trim(strip_tags((string) $f)), array_values($in['features'])), 4, ''), 0, 4);
        }
        if (array_key_exists('show_art', $in)) {
            $next['show_art'] = (bool) $in['show_art'];
        }
        $next['updated_by'] = $by;
        $next['updated_at'] = now()->toIso8601String();
        Datastore::updateOrCreate(['store_key' => self::KEY], ['json_data' => $next]);

        return self::settings();
    }

    public static function setAsset(string $type, string $file, string $by): void
    {
        $s = self::settings();
        $s[$type === 'logo' ? 'logo_file' : 'bg_file'] = $file;
        $s['updated_by'] = $by;
        $s['updated_at'] = now()->toIso8601String();
        Datastore::updateOrCreate(['store_key' => self::KEY], ['json_data' => $s]);
    }

    public static function assetRegex(): string
    {
        return self::ASSET_RE;
    }

    public static function companyName(?array $s = null): string
    {
        $s = $s ?? self::settings();
        $name = trim((string) $s['company_name']);
        if ($name !== '') {
            return $name;
        }
        $profile = self::row('mc_profile');
        $name = trim((string) ($profile['name'] ?? ''));

        return $name !== '' ? $name : 'Money Changer';
    }

    /** Warna tema global yang valid (#RRGGBB) atau bawaan. */
    public static function theme(): array
    {
        $t = self::row(self::THEME_KEY) ?? [];
        $pick = function (string $k, string $def) use ($t) {
            $v = $t[$k] ?? '';

            return is_string($v) && preg_match('/^#[0-9A-Fa-f]{6}$/', $v) ? strtoupper($v) : $def;
        };
        $primary = $pick('primary', '#047857');

        return [
            'primary' => $primary,
            'primaryHover' => $pick('primaryHover', self::mix($primary, '#000000', .12)),
            'secondary' => $pick('secondary', '#D4A72C'),
        ];
    }

    /** Data siap pakai untuk tampilan halaman login. */
    public static function view(): array
    {
        $s = self::settings();
        $th = self::theme();
        $name = self::companyName($s);
        $p = $th['primary'];
        $vars = [
            '--p' => $p,
            '--p-hover' => $th['primaryHover'],
            '--p-deep' => self::mix($p, '#000000', .62),
            '--p-dark' => self::mix($p, '#000000', .36),
            '--p-soft' => self::mix($p, '#FFFFFF', .90),
            '--p-line' => self::mix($p, '#FFFFFF', .72),
            '--a' => $th['secondary'],
            '--on-p' => self::luminance($p) > .55 ? '#0F172A' : '#FFFFFF',
        ];
        $css = '';
        foreach ($vars as $k => $v) {
            $css .= $k . ':' . $v . ';';
        }

        $words = preg_split('/\s+/u', preg_replace('/[^\p{L}\p{N}\s]/u', '', $name) ?? '', -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $initials = '';
        foreach (array_slice($words, 0, 2) as $w) {
            $initials .= mb_strtoupper(mb_substr($w, 0, 1));
        }
        $url = fn (string $f) => $f !== '' && is_file(public_path($f)) ? asset($f) . '?v=' . filemtime(public_path($f)) : '';

        return [
            'name' => $name,
            'initials' => $initials !== '' ? $initials : 'MC',
            'logo_url' => $url($s['logo_file']),
            'bg_url' => $url($s['bg_file']),
            'headline' => $s['headline'],
            'description' => $s['description'],
            'features' => array_values(array_filter($s['features'], fn ($f) => trim($f) !== '')),
            'welcome_title' => $s['welcome_title'],
            'welcome_desc' => str_ireplace('{nama}', $name, $s['welcome_desc']),
            'button_label' => $s['button_label'] !== '' ? $s['button_label'] : 'Masuk',
            'security_note' => $s['security_note'],
            'show_art' => $s['show_art'],
            'css' => $css,
            'theme_color' => $p,
            'year' => date('Y'),
        ];
    }

    /** Campur dua warna hex: $ratio = porsi warna kedua (0..1). */
    public static function mix(string $a, string $b, float $ratio): string
    {
        $ca = sscanf($a, '#%02x%02x%02x');
        $cb = sscanf($b, '#%02x%02x%02x');
        $out = '#';
        for ($i = 0; $i < 3; $i++) {
            $out .= str_pad(dechex((int) round($ca[$i] * (1 - $ratio) + $cb[$i] * $ratio)), 2, '0', STR_PAD_LEFT);
        }

        return strtoupper($out);
    }

    public static function luminance(string $hex): float
    {
        [$r, $g, $b] = sscanf($hex, '#%02x%02x%02x');
        $f = fn ($c) => ($c /= 255) <= .03928 ? $c / 12.92 : (($c + .055) / 1.055) ** 2.4;

        return .2126 * $f($r) + .7152 * $f($g) + .0722 * $f($b);
    }

    private static function row(string $key): ?array
    {
        try {
            $row = Datastore::find($key);
        } catch (\Throwable $e) {
            return null;
        }
        $data = $row?->json_data;
        if (is_string($data)) {
            $data = json_decode($data, true);
        }

        return is_array($data) ? $data : null;
    }
}
