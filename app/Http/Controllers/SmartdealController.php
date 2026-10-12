<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SmartdealController extends Controller
{
    public function rates(Request $request)
    {
        $url = 'https://smartdeal.co.id/rates/dki_banten';

        try {
            $response = Http::timeout(20)
                ->retry(2, 500)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ])
                ->get($url, ['cb' => now()->timestamp]);

            if (!$response->successful()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Smartdeal mengembalikan status HTTP ' . $response->status(),
                ], 502);
            }

            $html = $response->body();
            if (!$html || stripos($html, '<table') === false) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Halaman Smartdeal berhasil dibuka, tetapi tabel kurs tidak ditemukan.',
                ], 502);
            }

            return response()->json([
                'status' => 'success',
                'html' => $html,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal mengambil data Smartdeal dari server lokal: ' . $e->getMessage(),
            ], 502);
        }
    }
}
