<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use Illuminate\Http\Request;

class CurrencyController extends Controller
{
    public function index()
    {
        $currencies = Currency::all();
        return response()->json($currencies);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10'],
            'label' => ['nullable', 'string', 'max:100'],
            'buy' => ['nullable', 'numeric'],
            'sell' => ['nullable', 'numeric'],
            'stock' => ['nullable', 'numeric'],
        ]);

        $code = strtoupper(trim((string) $validated['code']));
        $input = $request->except(['raw_json']);

        try {
            $existing = Currency::where('code', $code)->first();
            $existingRaw = [];
            if ($existing && is_string($existing->raw_json) && $existing->raw_json !== '') {
                $decoded = json_decode($existing->raw_json, true);
                if (is_array($decoded)) $existingRaw = $decoded;
            }
            $mergedRaw = array_merge($existingRaw, $input, ['code' => $code]);

            $currency = Currency::updateOrCreate(
                ['code' => $code],
                [
                    'label' => $validated['label'] ?? ($existing->label ?? ''),
                    'buy' => (float) ($validated['buy'] ?? ($existing->buy ?? 0)),
                    'sell' => (float) ($validated['sell'] ?? ($existing->sell ?? 0)),
                    'stock' => (float) ($validated['stock'] ?? ($existing->stock ?? 0)),
                    'raw_json' => json_encode($mergedRaw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Currency saved successfully (Laravel).',
                'data' => $currency,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10'],
        ]);

        $code = strtoupper(trim((string) $validated['code']));

        try {
            $deleted = Currency::where('code', $code)->delete();

            return response()->json([
                'status' => 'success',
                'message' => $deleted > 0
                    ? 'Currency deleted (Laravel)'
                    : 'Currency tidak ditemukan atau sudah terhapus',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
