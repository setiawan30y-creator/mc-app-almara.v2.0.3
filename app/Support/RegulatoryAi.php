<?php
// @2026-Alifiandra

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Klien AI untuk modul Regulatory AI (Gemini / OpenAI).
 * Key dibaca dari header (pengaturan Asisten AI) atau konfigurasi server.
 * Key dikirim lewat header HTTP, tidak pernah di URL atau log.
 */
class RegulatoryAi
{
    /** @return array{provider:string,gemini:string,openai:string,openai_model:string} */
    public static function fromRequest(Request $request): array
    {
        $provider = strtolower((string) $request->header('X-AI-Provider', 'gemini'));
        return [
            'provider' => $provider === 'openai' ? 'openai' : 'gemini',
            'gemini' => trim((string) ($request->header('X-Gemini-Key') ?: config('services.gemini.key') ?: '')),
            'openai' => trim((string) ($request->header('X-OpenAI-Key') ?: env('OPENAI_API_KEY') ?: '')),
            'openai_model' => trim((string) ($request->header('X-OpenAI-Model') ?: env('OPENAI_MODEL', 'gpt-4o-mini'))),
        ];
    }

    public static function available(array $ai): bool
    {
        return $ai['provider'] === 'openai' ? $ai['openai'] !== '' : $ai['gemini'] !== '';
    }

    public static function label(array $ai): string
    {
        return $ai['provider'] === 'openai' ? 'OpenAI ' . $ai['openai_model'] : 'Gemini ' . GeminiModel::resolve($ai['gemini']);
    }

    /**
     * @param array<int,array{role:string,text:string}> $history
     * @return array{ok:bool,text:string,message:string}
     */
    public static function generate(array $ai, string $system, array $history, string $user, float $temperature = 0.2): array
    {
        if (!self::available($ai)) {
            return ['ok' => false, 'text' => '', 'message' => 'API Key AI belum diatur. Isi di menu Pengaturan > Asisten AI.'];
        }

        try {
            if ($ai['provider'] === 'openai') {
                $messages = [['role' => 'system', 'content' => $system]];
                foreach ($history as $h) {
                    $messages[] = ['role' => $h['role'] === 'user' ? 'user' : 'assistant', 'content' => $h['text']];
                }
                $messages[] = ['role' => 'user', 'content' => $user];
                $res = Http::withToken($ai['openai'])->timeout(60)->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $ai['openai_model'],
                    'messages' => $messages,
                    'temperature' => $temperature,
                ]);
                if (!$res->successful()) {
                    return self::fail('OpenAI', $res->status(), $res->json());
                }
                $text = (string) ($res->json('choices.0.message.content') ?? '');
            } else {
                $contents = [];
                foreach ($history as $h) {
                    $contents[] = ['role' => $h['role'] === 'user' ? 'user' : 'model', 'parts' => [['text' => $h['text']]]];
                }
                $contents[] = ['role' => 'user', 'parts' => [['text' => $user]]];
                $res = GeminiModel::post($ai['gemini'], [
                    'systemInstruction' => ['parts' => [['text' => $system]]],
                    'contents' => $contents,
                    'generationConfig' => ['temperature' => $temperature, 'maxOutputTokens' => 3072],
                ]);
                if (!$res->successful()) {
                    return self::fail('Gemini', $res->status(), $res->json());
                }
                $text = '';
                foreach ((array) ($res->json('candidates.0.content.parts') ?? []) as $part) {
                    $text .= (string) ($part['text'] ?? '');
                }
            }
        } catch (\Throwable $e) {
            Log::warning('RegulatoryAi network error: ' . $e->getMessage());
            return ['ok' => false, 'text' => '', 'message' => $e instanceof \RuntimeException ? $e->getMessage() : 'Server tidak dapat menghubungi layanan AI. Periksa koneksi internet server.'];
        }

        $text = trim($text);
        if ($text === '') {
            return ['ok' => false, 'text' => '', 'message' => 'AI tidak mengembalikan jawaban. Coba ulangi atau ubah pertanyaan.'];
        }
        return ['ok' => true, 'text' => $text, 'message' => ''];
    }

    /**
     * Ekstraksi teks dari PDF / gambar memakai Gemini (hanya jika key Gemini tersedia).
     *
     * @return array{ok:bool,text:string,message:string}
     */
    public static function extractFile(array $ai, string $path, string $mime): array
    {
        if ($ai['gemini'] === '') {
            return ['ok' => false, 'text' => '', 'message' => 'Key Gemini belum diatur, sehingga PDF/gambar tidak dapat dibaca otomatis.'];
        }
        $bytes = @file_get_contents($path);
        if ($bytes === false) {
            return ['ok' => false, 'text' => '', 'message' => 'File tidak dapat dibaca dari penyimpanan.'];
        }
        try {
            $res = GeminiModel::post($ai['gemini'], [
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['text' => 'Salin seluruh teks dokumen ini apa adanya, urut dari awal sampai akhir. Pertahankan penomoran BAB, Pasal, ayat, dan tabel (tabel sebagai baris teks). Jangan meringkas, jangan menambah komentar, jangan pakai markdown.'],
                        ['inlineData' => ['mimeType' => $mime, 'data' => base64_encode($bytes)]],
                    ],
                ]],
                'generationConfig' => ['temperature' => 0, 'maxOutputTokens' => 65536],
            ], 120);
            if (!$res->successful()) {
                return self::fail('Gemini', $res->status(), $res->json());
            }
            $text = '';
            foreach ((array) ($res->json('candidates.0.content.parts') ?? []) as $part) {
                $text .= (string) ($part['text'] ?? '');
            }
            return ['ok' => trim($text) !== '', 'text' => trim($text), 'message' => trim($text) === '' ? 'AI tidak menemukan teks pada file.' : ''];
        } catch (\Throwable $e) {
            Log::warning('RegulatoryAi extract error: ' . $e->getMessage());
            return ['ok' => false, 'text' => '', 'message' => $e instanceof \RuntimeException ? $e->getMessage() : 'Server tidak dapat menghubungi Gemini untuk membaca file.'];
        }
    }

    private static function fail(string $name, int $status, $json): array
    {
        $raw = is_array($json) ? (string) ($json['error']['message'] ?? '') : '';
        if ($status === 400 && preg_match('/API key not valid/i', $raw)) {
            $msg = "API Key {$name} tidak valid. Periksa di Pengaturan > Asisten AI.";
        } elseif ($status === 401 || $status === 403) {
            $msg = "Akses ke {$name} ditolak. Periksa API Key dan izin proyeknya.";
        } elseif ($status === 503 || preg_match('/high demand|overloaded/i', $raw)) {
            $msg = "Layanan {$name} sedang padat. Sudah dicoba ulang otomatis; coba lagi beberapa saat.";
        } elseif ($status === 429) {
            $msg = "Kuota {$name} habis atau terlalu banyak permintaan. Coba lagi beberapa saat.";
        } else {
            $msg = "{$name} menolak permintaan (HTTP {$status}).";
        }
        Log::warning("RegulatoryAi {$name} HTTP {$status}: " . substr($raw, 0, 200));
        return ['ok' => false, 'text' => '', 'message' => $msg];
    }
}
