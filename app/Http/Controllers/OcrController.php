<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class OcrController extends Controller
{
    private function classifyVisionError(string $message, int $googleCode): string
    {
        if (preg_match('/billing|bill/i', $message)) {
            return 'billing_not_enabled';
        }

        if (preg_match('/quota|limit|rate/i', $message)) {
            return 'quota_exceeded';
        }

        if ($googleCode === 401 || preg_match('/API key not valid|invalid api key|bad request/i', $message)) {
            return 'invalid_key';
        }

        if ($googleCode === 403 || preg_match('/permission|PERMISSION_DENIED|forbidden|not enabled|disabled/i', $message)) {
            return 'permission_denied';
        }

        return 'vision_rejected';
    }

    public function vision(Request $request)
    {
        $validated = $request->validate([
            'image_base64' => ['required', 'string'],
            'api_key' => ['nullable', 'string'],
        ]);

        $keyCandidates = [
            'browser' => trim((string) ($validated['api_key'] ?? '')),
            'GOOGLE_VISION_API_KEY' => trim((string) env('GOOGLE_VISION_API_KEY')),
            'GOOGLE_CLOUD_VISION_API_KEY' => trim((string) env('GOOGLE_CLOUD_VISION_API_KEY')),
            'GOOGLE_API_KEY' => trim((string) env('GOOGLE_API_KEY')),
        ];

        $keyCandidates = array_filter($keyCandidates, fn ($key) => $key !== '');
        $keyCandidates = array_unique($keyCandidates);

        if (empty($keyCandidates)) {
            return response()->json([
                'status' => 'error',
                'message' => 'API Key Google Vision belum diatur. Isi GOOGLE_VISION_API_KEY di .env server atau masukkan key dari menu Auto-Fill.'
            ], 422);
        }

        $imageBase64 = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $validated['image_base64']);
        $decoded = base64_decode($imageBase64, true);

        if ($decoded === false) {
            return response()->json([
                'status' => 'error',
                'message' => 'Format gambar OCR tidak valid.'
            ], 422);
        }

        if (strlen($decoded) > 8 * 1024 * 1024) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ukuran gambar OCR maksimal 8 MB.'
            ], 422);
        }

        $payload = [
            'requests' => [
                [
                    'image' => ['content' => $imageBase64],
                    'features' => [
                        ['type' => 'TEXT_DETECTION']
                    ]
                ]
            ]
        ];

        $lastError = null;

        foreach ($keyCandidates as $source => $apiKey) {
            try {
                $response = Http::timeout(45)->post(
                    'https://vision.googleapis.com/v1/images:annotate?key=' . urlencode($apiKey),
                    $payload
                );
            } catch (\Throwable $e) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Server gagal menghubungi Google Cloud Vision: ' . $e->getMessage()
                ], 502);
            }

            $data = $response->json();

            if ($response->successful() && !isset($data['error'])) {
                return response()->json([
                    'status' => 'success',
                    'data' => $data,
                    'key_source' => $source,
                ]);
            }

            $lastError = [
                'message' => $data['error']['message'] ?? 'Google Cloud Vision menolak permintaan OCR.',
                'google_code' => $data['error']['code'] ?? $response->status(),
                'http_status' => $response->status(),
                'key_source' => $source,
            ];
            $lastError['error_type'] = $this->classifyVisionError(
                $lastError['message'],
                (int) $lastError['google_code']
            );
        }

        return response()->json([
            'status' => 'error',
            'message' => $lastError['message'] ?? 'Google Cloud Vision menolak permintaan OCR.',
            'google_code' => $lastError['google_code'] ?? 422,
            'error_type' => $lastError['error_type'] ?? 'vision_rejected',
            'key_source' => $lastError['key_source'] ?? null,
        ], ($lastError['http_status'] ?? 422) >= 400 ? $lastError['http_status'] : 422);
    }
}
