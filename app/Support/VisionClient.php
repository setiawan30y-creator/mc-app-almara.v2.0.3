<?php
// @2026-Alifiandra

namespace App\Support;

use Illuminate\Support\Facades\Http;

/**
 * Pemanggil Google Cloud Vision (TEXT_DETECTION).
 *
 * Key dikirim lewat header X-Goog-Api-Key, bukan di URL, supaya tidak ikut
 * tercatat di log atau pesan error.
 */
class VisionClient
{
    public const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

    /** PNG 1x1 untuk tes koneksi key. */
    public const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    public static function classify(string $message, int $googleCode): string
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
        if ($googleCode === 403 || preg_match('/permission|PERMISSION_DENIED|forbidden|not enabled|disabled|blocked/i', $message)) {
            return 'permission_denied';
        }

        return 'vision_rejected';
    }

    /**
     * @return array{ok:bool,network:bool,status:int,data:?array,message:string,google_code:int,error_type:string}
     */
    public static function annotate(string $apiKey, string $imageBase64): array
    {
        $payload = [
            'requests' => [[
                'image' => ['content' => $imageBase64],
                'features' => [['type' => 'TEXT_DETECTION']],
            ]],
        ];

        try {
            $response = Http::timeout(45)
                ->withHeaders(['X-Goog-Api-Key' => $apiKey])
                ->post(self::ENDPOINT, $payload);
        } catch (\Throwable $e) {
            return [
                'ok' => false, 'network' => true, 'status' => 502, 'data' => null,
                'message' => 'Server gagal menghubungi Google Cloud Vision. Periksa koneksi internet server.',
                'google_code' => 0, 'error_type' => 'network_error',
            ];
        }

        $data = $response->json();
        $perItemError = is_array($data) ? ($data['responses'][0]['error'] ?? null) : null;

        if ($response->successful() && !isset($data['error']) && !$perItemError) {
            return [
                'ok' => true, 'network' => false, 'status' => $response->status(), 'data' => $data,
                'message' => '', 'google_code' => 0, 'error_type' => '',
            ];
        }

        $err = $data['error'] ?? $perItemError ?? [];
        $message = (string) ($err['message'] ?? 'Google Cloud Vision menolak permintaan.');
        $code = (int) ($err['code'] ?? $response->status());

        return [
            'ok' => false, 'network' => false, 'status' => $response->status(), 'data' => null,
            'message' => $message, 'google_code' => $code, 'error_type' => self::classify($message, $code),
        ];
    }
}
