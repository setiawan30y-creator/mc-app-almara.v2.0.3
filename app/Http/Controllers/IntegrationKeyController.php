<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Support\SecretStore;
use App\Support\VisionClient;
use Illuminate\Http\Request;

/**
 * Pengaturan API key Google Cloud Vision (Auto-Fill KTP).
 *
 * Key disimpan terenkripsi di server dan tidak pernah dikirim balik ke browser.
 * Hanya owner / superadmin / admin yang boleh mengelola (dibatasi di routes).
 */
class IntegrationKeyController extends Controller
{
    public function visionStatus()
    {
        return response()->json(['status' => 'success', 'data' => SecretStore::visionMeta()]);
    }

    public function visionSave(Request $request)
    {
        $validated = $request->validate([
            'api_key' => ['required', 'string', 'min:20', 'max:128', 'regex:/^[A-Za-z0-9_\-]+$/'],
        ], [
            'api_key.regex' => 'Format API key tidak valid. Salin ulang key dari Google Cloud Console.',
            'api_key.min' => 'API key terlalu pendek. Salin ulang key dari Google Cloud Console.',
        ]);

        SecretStore::setVision($validated['api_key'], (string) ($request->user()?->username ?? ''));

        return response()->json([
            'status' => 'success',
            'message' => 'API key Vision tersimpan (terenkripsi di server).',
            'data' => SecretStore::visionMeta(),
        ]);
    }

    public function visionClear()
    {
        SecretStore::clearVision();

        return response()->json([
            'status' => 'success',
            'message' => 'API key Vision dihapus dari database.',
            'data' => SecretStore::visionMeta(),
        ]);
    }

    /** Uji key yang sedang dipakai dengan gambar 1x1 piksel (tanpa data nasabah). */
    public function visionTest()
    {
        $keys = SecretStore::visionKeys();
        if (!$keys) {
            return response()->json([
                'status' => 'error', 'error_type' => 'key_missing',
                'message' => 'API key Vision belum diatur.',
            ], 422);
        }

        $last = null;
        foreach ($keys as $source => $key) {
            $r = VisionClient::annotate($key, VisionClient::TEST_IMAGE);
            if ($r['ok']) {
                return response()->json(['status' => 'success', 'message' => 'Koneksi ke Google Cloud Vision berhasil.', 'key_source' => $source]);
            }
            $r['source'] = $source;
            $last = $r;
            if ($r['network']) {
                break;
            }
        }

        return response()->json([
            'status' => 'error',
            'error_type' => $last['error_type'],
            'message' => $last['message'],
            'google_code' => $last['google_code'],
            'key_source' => $last['source'],
        ], $last['network'] ? 502 : 422);
    }
}
