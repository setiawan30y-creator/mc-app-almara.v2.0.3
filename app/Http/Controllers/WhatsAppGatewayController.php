<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppGatewayController extends Controller
{
    public function send(Request $request)
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:2048'],
            'token' => ['required', 'string', 'max:2048'],
            'target' => ['required', 'string', 'max:32'],
            'message' => ['required', 'string', 'max:10000'],
            'sender' => ['nullable', 'string', 'max:100'],
            'reference' => ['nullable', 'string', 'max:100'],
            'method' => ['nullable', 'in:POST,GET'],
            'body_format' => ['nullable', 'in:form,json'],
            'headers' => ['nullable', 'string', 'max:10000'],
            'payload' => ['nullable', 'string', 'max:20000'],
        ]);

        try {
            $replacements = [
                '{TOKEN}' => $data['token'], '{TARGET}' => $data['target'], '{MESSAGE}' => $data['message'],
                '{SENDER}' => $data['sender'] ?? '', '{REFERENCE}' => $data['reference'] ?? '',
            ];
            $replacePlaceholders = function ($value) use (&$replacePlaceholders, $replacements) {
                if (is_array($value)) {
                    foreach ($value as $key => $item) $value[$key] = $replacePlaceholders($item);
                    return $value;
                }
                return is_string($value) ? strtr($value, $replacements) : $value;
            };
            $parseConfig = function (?string $value, array $fallback) use ($replacePlaceholders) {
                $value = trim((string) $value);
                $decoded = $value === '' ? $fallback : json_decode($value, true);
                if (!is_array($decoded)) throw new \InvalidArgumentException('Konfigurasi Header/Payload harus berupa JSON objek.');
                // Ganti placeholder pada nilai array, lalu biarkan Laravel/PHP yang
                // mengenkode newline dan karakter khusus untuk request provider.
                return $replacePlaceholders($decoded);
            };
            $headers = $parseConfig($data['headers'] ?? '', ['Authorization' => '{TOKEN}']);
            $payload = $parseConfig($data['payload'] ?? '', ['target' => '{TARGET}', 'message' => '{MESSAGE}']);
            $method = $data['method'] ?? 'POST';
            $requestClient = Http::acceptJson()->withHeaders($headers)->timeout(30);
            if (($data['body_format'] ?? 'form') === 'form') $requestClient = $requestClient->asForm();
            $response = $method === 'GET'
                ? $requestClient->get($data['endpoint'], $payload)
                : $requestClient->post($data['endpoint'], $payload);

            $providerData = $response->json();
            $providerStatus = is_array($providerData)
                ? ($providerData['status'] ?? $providerData['success'] ?? $providerData['ok'] ?? null)
                : null;
            $statusIsRejected = $providerStatus === false
                || in_array(strtolower((string) $providerStatus), ['false', 'failed', 'error', '0', 'rejected'], true);

            if (!$response->successful() || $statusIsRejected) {
                $providerMessage = data_get($providerData, 'message')
                    ?: data_get($providerData, 'error')
                    ?: data_get($providerData, 'reason')
                    ?: trim(strip_tags($response->body()));

                Log::warning('WA Gateway rejected request', [
                    'provider_status' => $response->status(),
                    'reference' => $data['reference'] ?? null,
                    'provider_message' => $providerMessage,
                ]);
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gateway menolak pengiriman' . ($providerMessage ? ': ' . $providerMessage : '.'),
                    'provider_status' => $response->status(),
                ], 422);
            }

            // Provider kadang membalas HTTP 200 tetapi menyertakan detail kegagalan
            // per nomor di dalam array detail. Jangan tampilkan sukses palsu.
            $details = is_array($providerData) ? ($providerData['detail'] ?? $providerData['data'] ?? null) : null;
            if (is_array($details)) {
                foreach ($details as $detail) {
                    if (!is_array($detail)) continue;
                    $detailStatus = $detail['status'] ?? $detail['success'] ?? null;
                    if ($detailStatus === false || in_array(strtolower((string) $detailStatus), ['false', 'failed', 'error', '0'], true)) {
                        Log::warning('WA Gateway rejected recipient', [
                            'reference' => $data['reference'] ?? null,
                            'reason' => $detail['reason'] ?? $detail['message'] ?? null,
                        ]);
                        return response()->json([
                            'status' => 'error',
                            'message' => 'Gateway menolak nomor tujuan: ' . ($detail['reason'] ?? $detail['message'] ?? 'periksa nomor dan perangkat WhatsApp.'),
                            'provider_status' => $response->status(),
                        ], 422);
                    }
                }
            }

            Log::info('WA Gateway accepted request', [
                'provider' => $data['endpoint'],
                'provider_status' => $response->status(),
                'response_status' => $providerStatus,
                'reference' => $data['reference'] ?? null,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Permintaan diterima oleh WA Gateway. Status terkirim ke WhatsApp mengikuti status perangkat/provider.',
                'provider_status' => $response->status(),
            ]);
        } catch (\Throwable $error) {
            Log::warning('WA Gateway request failed', ['message' => $error->getMessage()]);
            return response()->json([
                'status' => 'error',
                'message' => 'Tidak dapat menghubungi WA Gateway: ' . $error->getMessage(),
            ], 422);
        }
    }
}
