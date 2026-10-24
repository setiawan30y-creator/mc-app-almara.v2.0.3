<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Support\UrlGuard;
use App\Support\WaGatewayClient;
use App\Support\WaGatewayStore;
use Illuminate\Http\Request;

/**
 * WA Gateway generik: admin mengatur endpoint/header/payload sekali (disimpan di server,
 * token terenkripsi); semua tombol WhatsApp aplikasi hanya mengirim nomor + pesan.
 *
 *  GET  /wa-gateway/status  semua pengguna  status siap/tidak (tanpa rahasia)
 *  POST /wa-gateway/send    semua pengguna  kirim pesan memakai konfigurasi server
 *  GET  /wa-gateway         owner/superadmin/admin  konfigurasi (tanpa token)
 *  POST /wa-gateway         owner/superadmin/admin  simpan konfigurasi
 *  POST /wa-gateway/test    owner/superadmin/admin  kirim pesan tes + tampilkan respons provider
 */
class WhatsAppGatewayController extends Controller
{
    public function status()
    {
        return response()->json(['status' => 'success', 'data' => WaGatewayStore::status()]);
    }

    public function show()
    {
        return response()->json([
            'status' => 'success',
            'data' => WaGatewayStore::publicConfig(),
            'placeholders' => WaGatewayClient::PLACEHOLDERS,
        ]);
    }

    public function save(Request $request)
    {
        $v = $request->validate([
            'enabled' => ['required', 'boolean'],
            'provider' => ['nullable', 'string', 'max:60'],
            'endpoint' => ['nullable', 'string', 'max:2048'],
            'method' => ['required', 'in:POST,GET'],
            'body_format' => ['required', 'in:form,json,query'],
            'headers' => ['nullable', 'string', 'max:10000'],
            'payload' => ['nullable', 'string', 'max:20000'],
            'sender' => ['nullable', 'string', 'max:200'],
            'token' => ['nullable', 'string', 'max:2048'],
            'clear_token' => ['nullable', 'boolean'],
            'success_rule' => ['required', 'in:auto,http,json'],
            'success_path' => ['nullable', 'string', 'max:100', 'regex:/^[A-Za-z0-9_.\[\]\-]*$/'],
            'success_value' => ['nullable', 'string', 'max:100'],
            'allow_private' => ['nullable', 'boolean'],
        ], [
            'success_path.regex' => 'Nama kolom aturan sukses hanya boleh huruf, angka, titik, dan kurung siku.',
        ]);

        $current = WaGatewayStore::full();
        $role = strtolower((string) ($request->user()?->role ?? ''));
        $allowPrivate = (bool) ($v['allow_private'] ?? false);
        if ($allowPrivate && !$current['allow_private'] && !in_array($role, ['owner', 'superadmin'], true)) {
            return $this->invalid('allow_private', 'Hanya owner atau superadmin yang boleh mengizinkan alamat jaringan lokal.');
        }
        // Admin biasa tidak boleh mengubah izin ini; pertahankan nilai yang ada.
        if (!in_array($role, ['owner', 'superadmin'], true)) {
            $allowPrivate = $current['allow_private'];
        }

        foreach (['headers' => 'Header API', 'payload' => 'Payload API'] as $field => $label) {
            try {
                WaGatewayClient::parseObject((string) ($v[$field] ?? ''), [], $label);
            } catch (\InvalidArgumentException $e) {
                return $this->invalid($field, $e->getMessage());
            }
        }

        $endpoint = trim((string) ($v['endpoint'] ?? ''));
        if ($endpoint !== '') {
            // Periksa bentuk URL dengan nilai contoh pada placeholder (tanpa DNS saat simpan).
            $sample = array_map('rawurlencode', WaGatewayClient::replacements('token', '6281234567890', 'tes', 'sender', 'ref'));
            $check = UrlGuard::inspect(strtr($endpoint, $sample), $allowPrivate, false);
            if (!$check['ok']) {
                return $this->invalid('endpoint', $check['error']);
            }
        }
        if ($v['enabled'] && $endpoint === '') {
            return $this->invalid('endpoint', 'URL endpoint wajib diisi untuk mengaktifkan WA Gateway.');
        }

        $v['endpoint'] = $endpoint;
        $v['allow_private'] = $allowPrivate;
        WaGatewayStore::save($v, (string) ($request->user()?->username ?? ''), (bool) ($v['clear_token'] ?? false));

        return response()->json([
            'status' => 'success',
            'message' => 'Pengaturan WA Gateway tersimpan.',
            'data' => WaGatewayStore::publicConfig(),
        ]);
    }

    public function test(Request $request)
    {
        $v = $request->validate(['target' => ['required', 'string', 'max:32']]);
        $cfg = WaGatewayStore::full();
        if ($cfg['endpoint'] === '') {
            return response()->json(['status' => 'error', 'message' => 'Simpan URL endpoint terlebih dahulu.'], 422);
        }
        $digits = WaGatewayClient::normalizePhone($v['target']);
        if (strlen($digits) < 10 || strlen($digits) > 16) {
            return response()->json(['status' => 'error', 'message' => 'Nomor WhatsApp tujuan tidak valid. Gunakan contoh 081234567890.'], 422);
        }

        $r = WaGatewayClient::send($cfg, $digits, 'Tes koneksi WA Gateway. Jika pesan ini diterima, pengaturan sudah benar.', 'WA-GATEWAY-TEST');

        return response()->json([
            'status' => $r['ok'] ? 'success' : 'error',
            'message' => $r['message'],
            'request' => $r['request'],
            'response' => $r['response'],
        ], $r['ok'] ? 200 : 422);
    }

    public function send(Request $request)
    {
        $v = $request->validate([
            'target' => ['required', 'string', 'max:32'],
            'message' => ['required', 'string', 'max:10000'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $cfg = WaGatewayStore::full();
        if (!$cfg['enabled'] || $cfg['endpoint'] === '') {
            return response()->json([
                'status' => 'error',
                'message' => 'WA Gateway belum aktif atau belum lengkap. Minta owner/admin mengaturnya di Pengaturan > WA Gateway.',
            ], 422);
        }
        $digits = WaGatewayClient::normalizePhone($v['target']);
        if (strlen($digits) < 10 || strlen($digits) > 16) {
            return response()->json(['status' => 'error', 'message' => 'Nomor WhatsApp tujuan tidak valid.'], 422);
        }

        $r = WaGatewayClient::send($cfg, $digits, $v['message'], $v['reference'] ?? null);

        return response()->json([
            'status' => $r['ok'] ? 'success' : 'error',
            'message' => $r['message'],
            'provider_status' => $r['http'],
        ], $r['ok'] ? 200 : 422);
    }

    private function invalid(string $field, string $message)
    {
        return response()->json(['status' => 'error', 'message' => $message, 'errors' => [$field => [$message]]], 422);
    }
}
