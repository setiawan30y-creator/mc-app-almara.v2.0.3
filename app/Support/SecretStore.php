<?php
// @2026-Alifiandra

namespace App\Support;

use App\Models\Datastore;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

/**
 * Penyimpanan rahasia integrasi (API key) di sisi server.
 *
 * - Disimpan terenkripsi (APP_KEY) di tabel datastore dengan kunci berawalan
 *   "security_": tidak ikut sinkronisasi browser dan tidak dikirim oleh
 *   GET /api/datastore.
 * - Browser tidak pernah menerima nilai key, hanya status dan 4 karakter terakhir.
 * - Bila belum ada key di database, dipakai key dari .env (lewat config/services.php,
 *   aman walau `php artisan config:cache` dijalankan).
 */
class SecretStore
{
    public const VISION = 'security_secret_vision';
    public const GEMINI = 'security_secret_gemini';

    private static bool $migrated = false;

    /** Metadata aman untuk ditampilkan di layar pengaturan. */
    public static function visionMeta(): array
    {
        self::migrateLegacy();

        $row = self::row(self::VISION);
        $db = self::decryptRow($row);
        $env = trim((string) config('services.google_vision.key', ''));

        if ($db !== '') {
            return [
                'configured' => true, 'source' => 'database', 'last4' => substr($db, -4),
                'updated_by' => (string) ($row['updated_by'] ?? ''), 'updated_at' => (string) ($row['updated_at'] ?? ''),
                'unreadable' => false,
            ];
        }

        $unreadable = $row !== null && !empty($row['enc']);

        if ($env !== '') {
            return [
                'configured' => true, 'source' => 'env', 'last4' => substr($env, -4),
                'updated_by' => '', 'updated_at' => '', 'unreadable' => $unreadable,
            ];
        }

        return [
            'configured' => false, 'source' => 'none', 'last4' => '',
            'updated_by' => '', 'updated_at' => '', 'unreadable' => $unreadable,
        ];
    }

    /** Metadata kunci Gemini (penerjemah & AI) untuk layar pengaturan. */
    public static function geminiMeta(): array
    {
        $row = self::row(self::GEMINI);
        $db = self::decryptRow($row);
        $env = trim((string) config('services.gemini.key', ''));
        if ($db !== '') {
            return ['configured' => true, 'source' => 'database', 'last4' => substr($db, -4),
                'updated_by' => (string) ($row['updated_by'] ?? ''), 'updated_at' => (string) ($row['updated_at'] ?? '')];
        }
        if ($env !== '') {
            return ['configured' => true, 'source' => 'env', 'last4' => substr($env, -4), 'updated_by' => '', 'updated_at' => ''];
        }
        return ['configured' => false, 'source' => 'none', 'last4' => '', 'updated_by' => '', 'updated_at' => ''];
    }

    /** Kunci Gemini yang dicoba berurutan: [sumber => key]. */
    public static function geminiKeys(): array
    {
        $keys = [];
        $db = self::decryptRow(self::row(self::GEMINI));
        if ($db !== '') {
            $keys['database'] = $db;
        }
        $env = trim((string) config('services.gemini.key', ''));
        if ($env !== '' && $env !== $db) {
            $keys['env'] = $env;
        }
        return $keys;
    }

    public static function setGemini(string $key, string $by): void
    {
        $key = trim($key);
        Datastore::updateOrCreate(
            ['store_key' => self::GEMINI],
            ['json_data' => ['enc' => Crypt::encryptString($key), 'last4' => substr($key, -4), 'updated_by' => $by, 'updated_at' => now()->toIso8601String()]]
        );
    }

    public static function clearGemini(): void
    {
        Datastore::where('store_key', self::GEMINI)->delete();
    }

    /** Daftar key yang dicoba berurutan: [sumber => key]. */
    public static function visionKeys(): array
    {
        self::migrateLegacy();

        $keys = [];
        $db = self::decryptRow(self::row(self::VISION));
        if ($db !== '') {
            $keys['database'] = $db;
        }
        $env = trim((string) config('services.google_vision.key', ''));
        if ($env !== '' && $env !== $db) {
            $keys['env'] = $env;
        }

        return $keys;
    }

    public static function setVision(string $key, string $by): void
    {
        $key = trim($key);
        Datastore::updateOrCreate(
            ['store_key' => self::VISION],
            ['json_data' => [
                'enc' => Crypt::encryptString($key),
                'last4' => substr($key, -4),
                'updated_by' => $by,
                'updated_at' => now()->toIso8601String(),
            ]]
        );
    }

    public static function clearVision(): void
    {
        Datastore::where('store_key', self::VISION)->delete();
    }

    /**
     * Pindahkan key lama (tersimpan polos di profil perusahaan / kunci localStorage
     * yang tersinkron) ke penyimpanan terenkripsi, lalu hapus dari tempat asalnya.
     */
    public static function migrateLegacy(): void
    {
        if (self::$migrated) {
            return;
        }
        self::$migrated = true;

        try {
            $legacy = '';

            $profile = Datastore::find('mc_profile');
            $data = $profile?->json_data;
            if (is_string($data)) {
                $data = json_decode($data, true);
            }
            if (is_array($data) && array_key_exists('visionKey', $data)) {
                $candidate = trim((string) $data['visionKey']);
                if (self::plausible($candidate)) {
                    $legacy = $candidate;
                }
                unset($data['visionKey']);
                $profile->json_data = $data;
                $profile->save();
            }

            $local = Datastore::find('mc_vision_api_key');
            if ($local) {
                $raw = $local->json_data;
                $candidate = is_array($raw) ? '' : trim((string) $raw, " \t\n\r\0\x0B\"");
                if ($legacy === '' && self::plausible($candidate)) {
                    $legacy = $candidate;
                }
                $local->delete();
            }

            if ($legacy !== '' && self::decryptRow(self::row(self::VISION)) === '') {
                self::setVision($legacy, 'migrasi');
            }
        } catch (\Throwable $e) {
            // Migrasi bersifat upaya terbaik; jangan sampai menghalangi OCR.
        }
    }

    public static function plausible(string $key): bool
    {
        return (bool) preg_match('/^[A-Za-z0-9_\-]{20,128}$/', $key);
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

    private static function decryptRow(?array $row): string
    {
        if (!$row || empty($row['enc'])) {
            return '';
        }
        try {
            return trim(Crypt::decryptString((string) $row['enc']));
        } catch (DecryptException $e) {
            return '';
        }
    }
}
