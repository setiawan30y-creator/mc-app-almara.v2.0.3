<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiChatController extends Controller
{
    public function chat(Request $request)
    {
        $message = $request->input('message', '');
        $image = $request->input('image'); // Base64 string with optional data URI prefix (e.g. data:image/png;base64,...)
        $provider = strtolower($request->header('X-AI-Provider', 'gemini'));
        
        if ($provider === 'openai') {
            return $this->chatOpenAi($request, $message, $image);
        }

        // Get Gemini API Key
        $apiKey = $request->header('X-Gemini-Key') ?: env('GEMINI_API_KEY');
        if (!$apiKey) {
            return response()->json([
                'status' => 'error',
                'message' => 'API Key Gemini tidak ditemukan. Silakan atur API Key di menu Pengaturan > Asisten AI.'
            ], 400);
        }

        try {
            $parts = [];

            // Add text prompt
            if (!empty($message)) {
                $parts[] = ['text' => $message];
            } else if (!empty($image)) {
                $parts[] = ['text' => 'Tolong analisis gambar uang/koin ini. Tentukan asal negara, kode mata uang, nominal, dan perkiraan keaslian atau ciri khasnya jika terlihat.'];
            }

            // Handle image payload if present
            if (!empty($image)) {
                // If it has data URI prefix, strip it
                if (preg_match('/^data:([^;]+);base64,(.*)$/', $image, $matches)) {
                    $mimeType = $matches[1];
                    $base64Data = $matches[2];
                } else {
                    $mimeType = 'image/jpeg'; // Default fallback
                    $base64Data = $image;
                }

                $parts[] = [
                    'inlineData' => [
                        'mimeType' => $mimeType,
                        'data' => $base64Data
                    ]
                ];
            }

            if (empty($parts)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Pesan atau gambar tidak boleh kosong.'
                ], 422);
            }

            // Construct payload according to Google Gemini API format
            $payload = [
                'contents' => [
                    [
                        'parts' => $parts
                    ]
                ],
                'safetySettings' => [
                    [
                        'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        'threshold' => 'BLOCK_NONE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_HARASSMENT',
                        'threshold' => 'BLOCK_NONE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_HATE_SPEECH',
                        'threshold' => 'BLOCK_NONE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                        'threshold' => 'BLOCK_NONE'
                    ]
                ]
            ];

            // Send request to Gemini API (using gemini-2.5-flash which is fastest and supports vision)
            $apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $apiKey;
            
            $response = Http::withHeaders([
                'Content-Type' => 'application/json'
            ])->timeout(30)->post($apiUrl, $payload);

            if (!$response->successful()) {
                $errData = $response->json();
                $errMessage = $errData['error']['message'] ?? 'Gagal menghubungi server Gemini.';
                Log::warning('Gemini API Error: ' . json_encode($errData));
                return response()->json([
                    'status' => 'error',
                    'message' => 'Gemini API Error: ' . $errMessage
                ], $response->status());
            }

            $result = $response->json();
            $replyText = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';

            if (empty($replyText)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tidak mendapat respons teks dari AI.'
                ], 500);
            }

            return response()->json([
                'status' => 'success',
                'reply' => $replyText
            ]);

        } catch (\Exception $e) {
            Log::error('Exception in AiChatController: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => 'Terjadi kesalahan sistem: ' . $e->getMessage()
            ], 500);
        }
    }

    private function chatOpenAi(Request $request, string $message, ?string $image)
    {
        $apiKey = $request->header('X-OpenAI-Key') ?: env('OPENAI_API_KEY');
        $model = $request->header('X-OpenAI-Model') ?: env('OPENAI_MODEL', 'gpt-4o-mini');

        if (!$apiKey) {
            return response()->json([
                'status' => 'error',
                'message' => 'API Key ChatGPT/OpenAI tidak ditemukan. Silakan atur API Key di menu Pengaturan > Asisten AI.'
            ], 400);
        }

        if (empty($message) && empty($image)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pesan atau gambar tidak boleh kosong.'
            ], 422);
        }

        try {
            $content = [];
            $content[] = [
                'type' => 'text',
                'text' => $message ?: 'Tolong analisis gambar uang/koin ini. Tentukan asal negara, kode mata uang, nominal, dan perkiraan keaslian atau ciri khasnya jika terlihat.'
            ];

            if (!empty($image)) {
                $content[] = [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => $image
                    ]
                ];
            }

            $payload = [
                'model' => $model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Anda adalah Asisten AI untuk operasional money changer. Jawab dalam Bahasa Indonesia, ringkas, praktis, dan berhati-hati saat menilai keaslian uang dari gambar.'
                    ],
                    [
                        'role' => 'user',
                        'content' => $content
                    ]
                ],
                'temperature' => 0.4
            ];

            $response = Http::withToken($apiKey)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->timeout(45)
                ->post('https://api.openai.com/v1/chat/completions', $payload);

            if (!$response->successful()) {
                $errData = $response->json();
                $errMessage = $errData['error']['message'] ?? 'Gagal menghubungi server OpenAI.';
                Log::warning('OpenAI API Error: ' . json_encode($errData));
                return response()->json([
                    'status' => 'error',
                    'message' => 'OpenAI API Error: ' . $errMessage
                ], $response->status());
            }

            $result = $response->json();
            $replyText = $result['choices'][0]['message']['content'] ?? '';

            if (empty($replyText)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tidak mendapat respons teks dari ChatGPT/OpenAI.'
                ], 500);
            }

            return response()->json([
                'status' => 'success',
                'reply' => $replyText
            ]);
        } catch (\Exception $e) {
            Log::error('Exception in OpenAI chat: ' . $e->getMessage());
            return response()->json([
                'status' => 'error',
                'message' => 'Terjadi kesalahan sistem OpenAI: ' . $e->getMessage()
            ], 500);
        }
    }
}
