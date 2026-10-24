<?php

namespace App\Http\Controllers;

use App\Support\SecretStore;
use App\Support\VisionClient;
use Illuminate\Http\Request;

class OcrController extends Controller
{
    /**
     * OCR identitas lewat Google Cloud Vision.
     * Key diambil dari server (pengaturan terenkripsi, lalu .env); browser tidak mengirim key.
     */
    public function vision(Request $request)
    {
        $validated = $request->validate([
            'image_base64' => ['required', 'string'],
        ]);

        $keys = SecretStore::visionKeys();
        if (empty($keys)) {
            return response()->json([
                'status' => 'error',
                'error_type' => 'key_missing',
                'message' => 'API key Google Vision belum diatur. Minta owner/admin mengisinya di Pengaturan > Profil.',
            ], 422);
        }

        $imageBase64 = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $validated['image_base64']);
        $decoded = base64_decode($imageBase64, true);

        if ($decoded === false) {
            return response()->json([
                'status' => 'error',
                'message' => 'Format gambar OCR tidak valid.',
            ], 422);
        }

        if (strlen($decoded) > 8 * 1024 * 1024) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ukuran gambar OCR maksimal 8 MB.',
            ], 422);
        }

        $last = null;
        foreach ($keys as $source => $apiKey) {
            $result = VisionClient::annotate($apiKey, $imageBase64);

            if ($result['ok']) {
                return response()->json([
                    'status' => 'success',
                    'data' => $result['data'],
                    'key_source' => $source,
                ]);
            }

            $result['source'] = $source;
            $last = $result;

            if ($result['network']) {
                break;
            }
        }

        $http = ($last['status'] ?? 422) >= 400 ? $last['status'] : 422;

        return response()->json([
            'status' => 'error',
            'message' => $last['message'] ?? 'Google Cloud Vision menolak permintaan OCR.',
            'google_code' => $last['google_code'] ?? 422,
            'error_type' => $last['error_type'] ?? 'vision_rejected',
            'key_source' => $last['source'] ?? null,
        ], $http);
    }
}
