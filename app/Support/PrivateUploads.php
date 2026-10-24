<?php

// @2026-Alifiandra

namespace App\Support;

/**
 * Penyimpanan berkas unggahan (foto nasabah, dokumen perusahaan, bukti transaksi, dst.).
 *
 * Berkas disimpan di storage/app/private/uploads (di luar folder public), sehingga
 * tidak bisa dibuka langsung lewat alamat web. Alamat tampilannya tetap
 * "/uploads/<kategori>/<nama>" dan dilayani oleh UploadFileController hanya untuk
 * pengguna yang sudah login.
 */
final class PrivateUploads
{
    /** Folder dasar di server (tanpa garis miring di akhir). */
    public static function root(): string
    {
        return storage_path('app' . DIRECTORY_SEPARATOR . 'private' . DIRECTORY_SEPARATOR . 'uploads');
    }

    /** Folder lama (publik) sebelum perintah mc:secure-uploads dijalankan. */
    public static function legacyRoot(): string
    {
        return public_path('uploads');
    }

    /** Path absolut untuk path relatif di dalam uploads, mis. "customers/photos". */
    public static function path(string $relative = ''): string
    {
        $relative = trim(str_replace('\\', '/', $relative), '/');

        return $relative === ''
            ? self::root()
            : self::root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);
    }

    /**
     * Ubah alamat "/uploads/a/b.jpg?v=1" menjadi path relatif "a/b.jpg".
     * Mengembalikan null bila alamat bukan berkas unggahan atau mencoba keluar folder.
     */
    public static function relativeFromUrl(?string $url): ?string
    {
        $path = (string) (parse_url((string) $url, PHP_URL_PATH) ?: '');
        $path = rawurldecode(str_replace('\\', '/', $path));
        if (!str_starts_with($path, '/uploads/') || str_contains($path, "\0")) {
            return null;
        }
        $relative = substr($path, strlen('/uploads/'));
        foreach (explode('/', $relative) as $part) {
            if ($part === '' || $part === '.' || $part === '..') {
                return null;
            }
        }

        return $relative;
    }

    /**
     * Path absolut berkas dari alamatnya. Mencari di penyimpanan privat dulu,
     * lalu (selama belum dipindah) di folder publik lama. Null bila tidak ada/tidak valid.
     */
    public static function resolve(?string $url): ?string
    {
        $relative = self::relativeFromUrl($url);
        if ($relative === null) {
            return null;
        }
        foreach ([self::root(), self::legacyRoot()] as $base) {
            $file = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);
            $realBase = realpath($base);
            $realFile = realpath($file);
            if ($realBase && $realFile && is_file($realFile) && str_starts_with($realFile, $realBase . DIRECTORY_SEPARATOR)) {
                return $realFile;
            }
        }

        return null;
    }

    /** Pastikan folder ada, lalu kembalikan path absolutnya. */
    public static function ensureDirectory(string $relative): string
    {
        $dir = self::path($relative);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException('Gagal membuat folder penyimpanan: ' . $dir);
        }

        return $dir;
    }

    /** Hapus berkas berdasarkan alamatnya (privat maupun lama). */
    public static function deleteByUrl(?string $url): bool
    {
        $file = self::resolve($url);

        return $file !== null && @unlink($file);
    }
}
