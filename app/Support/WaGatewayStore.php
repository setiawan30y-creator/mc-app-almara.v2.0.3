<?php
// @2026-Alifiandra

namespace App\Support;

use App\Models\Datastore;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * Konfigurasi WA Gateway di sisi server.
 *
 * Token disimpan terenkripsi (APP_KEY) dan tidak pernah dikirim ke browser.
 * Kunci datastore berawalan "security_" sehingga tidak ikut sinkronisasi browser
 * dan tidak dikembalikan oleh GET /api/datastore.
 */
class WaGatewayStore
{
    public const KEY = 'security_wa_gateway';
    public const LEGACY_KEY = 'mc_wa_gateway';

    public const DEFAULTS = [
        'enabled' => false,
        'provider' => '',
        'endpoint' => '',
        'method' => 'POST',
        'body_format' => 'form',
        'headers' => '',
        'payload' => '',
        'sender' => '',
        'success_rule' => 'auto',
        'success_path' => '',
        'success_value' => '',
        'allow_private' => false,
    ];

    private static bool $migrated = false;

    /** Konfigurasi lengkap termasuk token (hanya untuk dipakai server). */
    public static function full(): array
    {
        self::migrateLegacy();
        $row = self::row(self::KEY) ?? [];
        $cfg = array_merge(self::DEFAULTS, array_intersect_key($row, self::DEFAULTS));
        $cfg['enabled'] = (bool) $cfg['enabled'];
        $cfg['allow_private'] = (bool) $cfg['allow_private'];
        $cfg['token'] = self::decryptToken($row);
        $cfg['updated_by'] = (string) ($row['updated_by'] ?? '');
        $cfg['updated_at'] = (string) ($row['updated_at'] ?? '');
        $cfg['token_unreadable'] = !empty($row['token_enc']) && $cfg['token'] === '';

        return $cfg;
    }

    /** Konfigurasi aman untuk layar pengaturan (tanpa token). */
    public static function publicConfig(): array
    {
        $c = self::full();
        $token = $c['token'];
        unset($c['token']);
        $c['token_set'] = $token !== '';
        $c['token_last4'] = $token !== '' ? substr($token, -4) : '';
        $c['configured'] = $c['endpoint'] !== '';

        return $c;
    }

    /** Status minimal untuk semua pengguna (mis. opsi kirim WA di kasir). */
    public static function status(): array
    {
        $c = self::full();

        return [
            'enabled' => $c['enabled'],
            'configured' => $c['endpoint'] !== '',
            'provider' => $c['provider'],
            'ready' => $c['enabled'] && $c['endpoint'] !== '',
        ];
    }

    /** @param array $in nilai tervalidasi; token null/'' = pertahankan token lama. */
    public static function save(array $in, string $by, bool $clearToken = false): void
    {
        $row = self::row(self::KEY) ?? [];
        $next = array_merge(self::DEFAULTS, array_intersect_key($in, self::DEFAULTS));
        $next['enabled'] = (bool) $next['enabled'];
        $next['allow_private'] = (bool) $next['allow_private'];

        $newToken = isset($in['token']) ? trim((string) $in['token']) : '';
        if ($clearToken) {
            $next['token_enc'] = '';
        } elseif ($newToken !== '') {
            $next['token_enc'] = Crypt::encryptString($newToken);
        } else {
            $next['token_enc'] = (string) ($row['token_enc'] ?? '');
        }
        $next['updated_by'] = $by;
        $next['updated_at'] = now()->toIso8601String();

        Datastore::updateOrCreate(['store_key' => self::KEY], ['json_data' => $next]);
    }

    /**
     * Pindahkan konfigurasi lama (mc_wa_gateway, token tersimpan polos dan tersinkron
     * ke semua pengguna) ke penyimpanan terenkripsi, lalu hapus yang lama.
     */
    public static function migrateLegacy(): void
    {
        if (self::$migrated) {
            return;
        }
        self::$migrated = true;

        try {
            $legacy = Datastore::find(self::LEGACY_KEY);
            if (!$legacy) {
                return;
            }
            $old = $legacy->json_data;
            if (is_string($old)) {
                $old = json_decode($old, true);
            }
            if (is_array($old) && self::row(self::KEY) === null) {
                $method = strtoupper((string) ($old['method'] ?? 'POST'));
                $format = (string) ($old['bodyFormat'] ?? 'form');
                self::save([
                    'enabled' => !empty($old['enabled']),
                    'provider' => mb_substr((string) ($old['provider'] ?? ''), 0, 60),
                    'endpoint' => (string) ($old['endpoint'] ?? ''),
                    'method' => in_array($method, ['POST', 'GET'], true) ? $method : 'POST',
                    'body_format' => in_array($format, ['form', 'json', 'query'], true) ? $format : 'form',
                    'headers' => (string) ($old['headers'] ?? ''),
                    'payload' => (string) ($old['payload'] ?? ''),
                    'sender' => (string) ($old['sender'] ?? ''),
                    'token' => (string) ($old['token'] ?? ''),
                ], 'migrasi');
            }
            $legacy->delete();
        } catch (\Throwable $e) {
            // Upaya terbaik; jangan menghalangi pengiriman.
        }
    }

    private static function row(string $storeKey): ?array
    {
        $row = Datastore::find($storeKey);
        $data = $row?->json_data;
        if (is_string($data)) {
            $data = json_decode($data, true);
        }

        return is_array($data) ? $data : null;
    }

    private static function decryptToken(array $row): string
    {
        if (empty($row['token_enc'])) {
            return '';
        }
        try {
            return trim(Crypt::decryptString((string) $row['token_enc']));
        } catch (DecryptException $e) {
            return '';
        }
    }
}
