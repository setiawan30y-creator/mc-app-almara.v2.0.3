<?php
// @2026-Alifiandra

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pengirim pesan WhatsApp lewat gateway apa pun yang berbasis HTTP.
 *
 * Satu mesin untuk semua provider: URL, header, dan isi (payload) ditulis admin
 * dengan placeholder, lalu diisi server saat kirim.
 *
 *   {TOKEN}  {TOKEN_BASE64}  {TARGET}  {TARGET_0}  {TARGET_PLUS}  {CHAT_ID}  {MESSAGE}  {SENDER}  {REFERENCE}
 *
 *   {TARGET}      6281234567890      {TARGET_0}   081234567890
 *   {TARGET_PLUS} +6281234567890     {CHAT_ID}    6281234567890@c.us
 */
class WaGatewayClient
{
    public const PLACEHOLDERS = ['{TOKEN}', '{TOKEN_BASE64}', '{TARGET}', '{TARGET_0}', '{TARGET_PLUS}', '{CHAT_ID}', '{MESSAGE}', '{SENDER}', '{REFERENCE}'];

    /** Nomor ke format internasional tanpa plus: 0812... / 812... / +62812... -> 62812... */
    public static function normalizePhone(string $phone): string
    {
        $v = preg_replace('/\D/', '', $phone) ?? '';
        if (str_starts_with($v, '00')) {
            $v = substr($v, 2);
        }
        if (str_starts_with($v, '0')) {
            $v = '62' . substr($v, 1);
        } elseif (str_starts_with($v, '8')) {
            $v = '62' . $v;
        }

        return $v;
    }

    public static function replacements(string $token, string $digits, string $message, string $sender, string $reference): array
    {
        return [
            '{TOKEN}' => $token,
            '{TOKEN_BASE64}' => $token === '' ? '' : base64_encode($token),
            '{TARGET}' => $digits,
            '{TARGET_0}' => str_starts_with($digits, '62') ? '0' . substr($digits, 2) : $digits,
            '{TARGET_PLUS}' => '+' . $digits,
            '{CHAT_ID}' => $digits . '@c.us',
            '{MESSAGE}' => $message,
            '{SENDER}' => $sender,
            '{REFERENCE}' => $reference,
        ];
    }

    /** Ganti placeholder pada string atau pada seluruh nilai array (rekursif). */
    public static function render($value, array $repl)
    {
        if (is_array($value)) {
            foreach ($value as $k => $item) {
                $value[$k] = self::render($item, $repl);
            }

            return $value;
        }

        return is_string($value) ? strtr($value, $repl) : $value;
    }

    /** @throws \InvalidArgumentException bila bukan objek JSON */
    public static function parseObject(string $json, array $fallback, string $label = 'Konfigurasi'): array
    {
        $json = trim($json);
        if ($json === '') {
            return $fallback;
        }
        $decoded = json_decode($json, true);
        if (!is_array($decoded) || (array_is_list($decoded) && $decoded !== [])) {
            throw new \InvalidArgumentException($label . ' harus berupa objek JSON, contoh {"kunci":"nilai"}.');
        }

        return $decoded;
    }

    /** Ambil nilai dengan path bertitik: "data.0.id", "messages[0].id". */
    public static function dig($data, string $path)
    {
        $path = trim(str_replace(['[', ']'], ['.', ''], $path), '.');
        if ($path === '') {
            return null;
        }
        foreach (explode('.', $path) as $seg) {
            if (is_array($data) && array_key_exists($seg, $data)) {
                $data = $data[$seg];
            } else {
                return null;
            }
        }

        return $data;
    }

    private static function falsy($v): bool
    {
        return $v === false || $v === null || $v === ''
            || in_array(strtolower((string) (is_scalar($v) ? $v : '1')), ['false', 'failed', 'error', '0', 'rejected', 'fail'], true);
    }

    /**
     * Tentukan berhasil/gagalnya pengiriman dari respons provider.
     *
     * @return array{ok:bool,reason:string}
     */
    public static function evaluate(array $cfg, int $httpStatus, $data, string $rawBody): array
    {
        $providerMessage = self::providerMessage($data, $rawBody);

        if ($httpStatus < 200 || $httpStatus >= 300) {
            return ['ok' => false, 'reason' => 'HTTP ' . $httpStatus . ($providerMessage !== '' ? ': ' . $providerMessage : '')];
        }

        $rule = (string) ($cfg['success_rule'] ?? 'auto');

        if ($rule === 'http') {
            return ['ok' => true, 'reason' => ''];
        }

        if ($rule === 'json') {
            $path = (string) ($cfg['success_path'] ?? '');
            if ($path === '' || !is_array($data)) {
                return ['ok' => false, 'reason' => 'Aturan sukses memeriksa kolom "' . $path . '", tetapi respons provider bukan JSON atau kolom belum diisi.'];
            }
            $found = self::dig($data, $path);
            $expected = trim((string) ($cfg['success_value'] ?? ''));
            if ($expected === '') {
                $ok = !self::falsy($found) && !(is_array($found) && $found === []);
            } else {
                $actual = is_bool($found) ? ($found ? 'true' : 'false') : (is_scalar($found) ? (string) $found : '');
                $ok = strtolower($actual) === strtolower($expected);
            }

            return $ok ? ['ok' => true, 'reason' => ''] : ['ok' => false, 'reason' => 'Respons tidak memenuhi aturan sukses (' . $path . ($expected !== '' ? ' = ' . $expected : ' ada') . ').' . ($providerMessage !== '' ? ' ' . $providerMessage : '')];
        }

        // auto: sebagian provider membalas HTTP 200 tetapi status/detail menyatakan gagal.
        if (is_array($data)) {
            foreach (['status', 'success', 'ok', 'sent'] as $key) {
                if (array_key_exists($key, $data) && is_scalar($data[$key]) && self::falsy($data[$key])) {
                    return ['ok' => false, 'reason' => $providerMessage !== '' ? $providerMessage : 'Provider menandai pengiriman gagal.'];
                }
            }
            if (isset($data['error']) && $data['error'] && !isset($data['status'])) {
                return ['ok' => false, 'reason' => $providerMessage];
            }
            $details = $data['detail'] ?? $data['data'] ?? null;
            if (is_array($details)) {
                foreach ($details as $d) {
                    if (is_array($d)) {
                        $st = $d['status'] ?? $d['success'] ?? null;
                        if ($st !== null && is_scalar($st) && self::falsy($st)) {
                            return ['ok' => false, 'reason' => 'Nomor tujuan ditolak: ' . ($d['reason'] ?? $d['message'] ?? 'periksa nomor dan perangkat WhatsApp.')];
                        }
                    }
                }
            }
        }

        return ['ok' => true, 'reason' => ''];
    }

    public static function providerMessage($data, string $rawBody): string
    {
        if (is_array($data)) {
            foreach (['message', 'error', 'reason', 'detail', 'msg', 'error_message'] as $k) {
                if (isset($data[$k])) {
                    $v = $data[$k];
                    if (is_array($v)) {
                        $v = $v['message'] ?? json_encode($v, JSON_UNESCAPED_UNICODE);
                    }
                    if (is_scalar($v) && trim((string) $v) !== '') {
                        return mb_substr(trim((string) $v), 0, 300);
                    }
                }
            }

            return '';
        }

        return mb_substr(trim(strip_tags($rawBody)), 0, 200);
    }

    /** Samarkan nilai rahasia sebelum ditampilkan atau dicatat. */
    public static function mask($value, array $secrets)
    {
        $secrets = array_values(array_filter($secrets, fn ($s) => is_string($s) && strlen($s) >= 4));
        if (!$secrets) {
            return $value;
        }
        if (is_array($value)) {
            foreach ($value as $k => $v) {
                $value[$k] = self::mask($v, $secrets);
            }

            return $value;
        }

        return is_string($value) ? str_replace($secrets, '***', $value) : $value;
    }

    /**
     * Kirim satu pesan.
     *
     * @return array{ok:bool,message:string,http:int,request:array,response:array}
     */
    public static function send(array $cfg, string $target, string $message, ?string $reference = null): array
    {
        $token = (string) ($cfg['token'] ?? '');
        $digits = self::normalizePhone($target);
        $repl = self::replacements($token, $digits, $message, (string) ($cfg['sender'] ?? ''), (string) ($reference ?? ''));
        $secrets = [$token, $token === '' ? '' : base64_encode($token)];

        try {
            $headers = self::parseObject((string) ($cfg['headers'] ?? ''), $token !== '' ? ['Authorization' => '{TOKEN}'] : [], 'Header API');
            $payload = self::parseObject((string) ($cfg['payload'] ?? ''), ['target' => '{TARGET}', 'message' => '{MESSAGE}'], 'Payload API');
        } catch (\InvalidArgumentException $e) {
            return self::fail($e->getMessage(), 0);
        }

        $headers = self::render($headers, $repl);
        foreach ($headers as $name => $val) {
            $headers[$name] = is_scalar($val) ? (string) $val : json_encode($val);
        }
        $payload = self::render($payload, $repl);
        $url = strtr((string) ($cfg['endpoint'] ?? ''), array_map('rawurlencode', $repl));

        $guard = UrlGuard::inspect($url, (bool) ($cfg['allow_private'] ?? false));
        if (!$guard['ok']) {
            return self::fail($guard['error'], 0);
        }

        $method = strtoupper((string) ($cfg['method'] ?? 'POST')) === 'GET' ? 'GET' : 'POST';
        $format = (string) ($cfg['body_format'] ?? 'form');
        $summary = [
            'method' => $method,
            'url' => self::mask($url, $secrets),
            'body_format' => $method === 'GET' ? 'query' : $format,
            'headers' => self::mask($headers, $secrets),
            'payload' => self::mask($payload, $secrets),
        ];

        try {
            $client = Http::acceptJson()
                ->withHeaders($headers)
                ->timeout(30)
                ->withoutRedirecting()
                ->withOptions(['curl' => [CURLOPT_RESOLVE => [$guard['host'] . ':' . $guard['port'] . ':' . $guard['ip']]]]);

            if ($method === 'GET') {
                $response = $client->get($url, $payload);
            } elseif ($format === 'query') {
                $response = $client->post($url . (str_contains($url, '?') ? '&' : '?') . http_build_query($payload));
            } elseif ($format === 'json') {
                $response = $client->asJson()->post($url, $payload);
            } else {
                $response = $client->asForm()->post($url, $payload);
            }
        } catch (\Throwable $e) {
            Log::warning('WA Gateway: gagal menghubungi provider', ['host' => $guard['host'], 'reference' => $reference]);

            return self::fail('Tidak dapat menghubungi gateway (' . $guard['host'] . '). Periksa URL endpoint dan koneksi server.', 0, $summary);
        }

        $raw = (string) $response->body();
        $data = $response->json();
        $eval = self::evaluate($cfg, $response->status(), $data, $raw);
        $excerpt = (string) self::mask(mb_substr($raw, 0, 600), $secrets);

        Log::log($eval['ok'] ? 'info' : 'warning', 'WA Gateway ' . ($eval['ok'] ? 'diterima' : 'ditolak'), [
            'host' => $guard['host'], 'http' => $response->status(), 'reference' => $reference,
            'reason' => $eval['ok'] ? null : self::mask($eval['reason'], $secrets),
        ]);

        return [
            'ok' => $eval['ok'],
            'message' => $eval['ok']
                ? 'Permintaan diterima oleh gateway. Status terkirim ke WhatsApp mengikuti perangkat/provider.'
                : 'Gateway menolak pengiriman: ' . self::mask($eval['reason'], $secrets),
            'http' => $response->status(),
            'request' => $summary,
            'response' => ['status' => $response->status(), 'body' => $excerpt],
        ];
    }

    private static function fail(string $message, int $http, array $request = []): array
    {
        return ['ok' => false, 'message' => $message, 'http' => $http, 'request' => $request, 'response' => ['status' => $http, 'body' => '']];
    }
}
