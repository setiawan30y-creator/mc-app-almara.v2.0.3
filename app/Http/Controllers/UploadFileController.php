<?php

// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Support\PrivateUploads;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Melayani berkas unggahan ("/uploads/...") dari penyimpanan privat.
 * Hanya pengguna yang sudah login (rute memakai middleware auth) yang bisa membukanya.
 */
class UploadFileController extends Controller
{
    private const INLINE_TYPES = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
    ];

    public function show(Request $request, string $path): BinaryFileResponse
    {
        $user = $request->user();
        // Akun layar papan kurs hanya menampilkan kurs; tidak perlu membuka dokumen.
        abort_if($user && strtolower((string) $user->role) === 'papan', 403, 'Akses tidak diizinkan untuk role ini.');

        $file = PrivateUploads::resolve('/uploads/' . $path);
        abort_if($file === null, 404);

        $mime = (string) (mime_content_type($file) ?: 'application/octet-stream');
        $inline = in_array($mime, self::INLINE_TYPES, true);

        return response()->file($file, [
            'Content-Type' => $mime,
            'Content-Disposition' => ($inline ? 'inline' : 'attachment') . '; filename="' . basename($file) . '"',
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
