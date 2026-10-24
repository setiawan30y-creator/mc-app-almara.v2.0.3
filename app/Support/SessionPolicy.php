<?php
// @2026-Alifiandra

namespace App\Support;

use App\Models\Datastore;

/**
 * Kebijakan keamanan sesi: batas waktu tidak aktif sebelum logout otomatis.
 *
 * Disimpan di tabel datastore dengan kunci tanpa awalan "mc_" supaya tidak ikut
 * disinkronkan ke localStorage (sync.js hanya menyinkronkan kunci "mc_*") dan
 * tidak bisa ditimpa lewat POST /api/datastore (diblokir di DatastoreController).
 */
class SessionPolicy
{
    public const KEY = 'security_session_policy';

    /** Peringatan sebelum logout (detik). */
    public const WARN_SECONDS = 60;

    /** Toleransi server (detik) agar timer di browser yang lebih dulu bertindak. */
    public const GRACE_SECONDS = 120;

    /** Peran yang tidak pernah di-logout otomatis (layar papan kurs yang menyala terus). */
    public const EXEMPT_ROLES = ['papan'];

    /** Peran yang boleh mengubah kebijakan. */
    public const EDITOR_ROLES = ['owner', 'superadmin', 'admin'];

    public const DEFAULTS = [
        'enabled' => true,
        'idle_minutes' => 30,
        'courier_idle_minutes' => 480,
    ];

    private static ?array $cache = null;

    public static function get(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $stored = [];
        try {
            $row = Datastore::query()->where('store_key', self::KEY)->first();
            $raw = $row?->json_data;
            if (is_string($raw)) {
                $raw = json_decode($raw, true);
            }
            if (is_array($raw)) {
                $stored = $raw;
            }
        } catch (\Throwable $e) {
            $stored = [];
        }

        $policy = array_merge(self::DEFAULTS, $stored);
        $policy['enabled'] = filter_var($policy['enabled'], FILTER_VALIDATE_BOOLEAN);
        $policy['idle_minutes'] = max(5, min(720, (int) $policy['idle_minutes']));
        $policy['courier_idle_minutes'] = max(5, min(1440, (int) $policy['courier_idle_minutes']));

        return self::$cache = $policy;
    }

    public static function forget(): void
    {
        self::$cache = null;
    }

    /** Batas tidak aktif dalam detik untuk satu peran; 0 berarti tidak dibatasi. */
    public static function idleSecondsFor(?string $role): int
    {
        $role = strtolower(trim((string) $role));
        if (in_array($role, self::EXEMPT_ROLES, true)) {
            return 0;
        }

        $policy = self::get();
        if (!$policy['enabled']) {
            return 0;
        }

        $minutes = $role === 'kurir' ? $policy['courier_idle_minutes'] : $policy['idle_minutes'];

        return $minutes * 60;
    }
}
