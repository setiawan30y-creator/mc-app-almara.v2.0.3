<?php
// @2026-Alifiandra

namespace App\Support;

/**
 * Membaca isi mc_datastore yang bisa tersimpan sebagai JSON biasa atau JSON ganda
 * (string berisi JSON). Dipindah dari routes/web.php supaya tetap tersedia saat
 * rute di-cache (php artisan route:cache tidak memuat file route saat runtime).
 */
class DatastorePayload
{
    public static function decode(mixed $payload): ?array
    {
        $decoded = $payload;
        for ($i = 0; $i < 2; $i++) {
            if (!is_string($decoded)) {
                break;
            }
            $next = json_decode($decoded, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                break;
            }
            $decoded = $next;
        }

        return is_array($decoded) ? $decoded : null;
    }
}
