<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\CurrencyDenomination;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CurrencyDenominationController extends Controller
{
    public function index(Request $request)
    {
        $query = CurrencyDenomination::query()->with('currency');

        if ($request->filled('currency_code')) {
            $query->where('currency_code', strtoupper(trim((string) $request->input('currency_code'))));
        }

        if ($request->has('active')) {
            $query->where('is_active', filter_var($request->input('active'), FILTER_VALIDATE_BOOLEAN));
        }

        return response()->json([
            'status' => 'success',
            'data' => $query
                ->orderBy('currency_code')
                ->orderBy('type')
                ->orderBy('denomination')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'currency_code' => ['required', 'string', 'max:10'],
            'denomination' => ['required', 'numeric', 'gt:0'],
            'type' => ['nullable', 'string', 'in:banknote,coin'],
            'buy' => ['nullable', 'numeric', 'min:0'],
            'sell' => ['nullable', 'numeric', 'min:0'],
            'margin_buy' => ['nullable', 'numeric'],
            'margin_sell' => ['nullable', 'numeric'],
            'stock' => ['nullable', 'numeric', 'min:0'],
            'alert_stock' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $currencyCode = strtoupper(trim($validated['currency_code']));
        $currency = Currency::where('code', $currencyCode)->first();

        if (!$currency) {
            return response()->json([
                'status' => 'error',
                'message' => "Valuta {$currencyCode} belum terdaftar di master valuta.",
            ], 422);
        }

        try {
            $denomination = CurrencyDenomination::updateOrCreate(
                [
                    'currency_code' => $currencyCode,
                    'denomination' => $validated['denomination'],
                    'type' => $validated['type'] ?? 'banknote',
                ],
                [
                    'buy' => $validated['buy'] ?? 0,
                    'sell' => $validated['sell'] ?? 0,
                    'margin_buy' => $validated['margin_buy'] ?? 0,
                    'margin_sell' => $validated['margin_sell'] ?? 0,
                    'stock' => $validated['stock'] ?? 0,
                    'alert_stock' => $validated['alert_stock'] ?? 0,
                    'is_active' => $validated['is_active'] ?? true,
                ]
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Pecahan valuta berhasil disimpan.',
                'data' => $denomination->load('currency'),
            ]);
        } catch (QueryException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal menyimpan pecahan valuta.',
            ], 500);
        }
    }

    /**
     * Replace the complete denomination set for one currency atomically.
     * This is used by the Master Kurs form so adding/removing several
     * denominations is saved as one operation.
     */
    public function sync(Request $request)
    {
        $validated = $request->validate([
            'currency_code' => ['required', 'string', 'max:10'],
            'denominations' => ['array'],
            'denominations.*.denomination' => ['required', 'numeric', 'gt:0'],
            'denominations.*.type' => ['nullable', 'string', 'in:banknote,coin'],
            'denominations.*.buy' => ['nullable', 'numeric', 'min:0'],
            'denominations.*.sell' => ['nullable', 'numeric', 'min:0'],
            'denominations.*.margin_buy' => ['nullable', 'numeric'],
            'denominations.*.margin_sell' => ['nullable', 'numeric'],
            'denominations.*.stock' => ['nullable', 'numeric', 'min:0'],
            'denominations.*.alert_stock' => ['nullable', 'numeric', 'min:0'],
            'denominations.*.is_active' => ['nullable', 'boolean'],
        ]);

        $currencyCode = strtoupper(trim((string) $validated['currency_code']));
        if (!Currency::where('code', $currencyCode)->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => "Valuta {$currencyCode} belum terdaftar di master valuta.",
            ], 422);
        }

        $rows = $validated['denominations'] ?? [];
        $seen = [];
        $normalized = [];
        foreach ($rows as $row) {
            $denom = (float) $row['denomination'];
            $type = ($row['type'] ?? 'banknote') === 'coin' ? 'coin' : 'banknote';
            $key = $type . ':' . number_format($denom, 4, '.', '');
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
            $normalized[] = [
                'currency_code' => $currencyCode,
                'denomination' => $denom,
                'type' => $type,
                'buy' => $row['buy'] ?? 0,
                'sell' => $row['sell'] ?? 0,
                'margin_buy' => $row['margin_buy'] ?? 0,
                'margin_sell' => $row['margin_sell'] ?? 0,
                'stock' => $row['stock'] ?? 0,
                'alert_stock' => $row['alert_stock'] ?? 0,
                'is_active' => $row['is_active'] ?? true,
            ];
        }

        try {
            DB::transaction(function () use ($currencyCode, $normalized) {
                CurrencyDenomination::where('currency_code', $currencyCode)->delete();
                if ($normalized) {
                    CurrencyDenomination::insert($normalized);
                }
            });

            return response()->json([
                'status' => 'success',
                'message' => count($normalized) . ' pecahan berhasil disimpan.',
                'data' => CurrencyDenomination::where('currency_code', $currencyCode)
                    ->orderByDesc('denomination')->get(),
            ]);
        } catch (QueryException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal menyimpan daftar pecahan valuta.',
            ], 500);
        }
    }

    public function show(CurrencyDenomination $currencyDenomination)
    {
        return response()->json([
            'status' => 'success',
            'data' => $currencyDenomination->load('currency'),
        ]);
    }

    public function update(Request $request, CurrencyDenomination $currencyDenomination)
    {
        $validated = $request->validate([
            'currency_code' => ['sometimes', 'required', 'string', 'max:10'],
            'denomination' => ['sometimes', 'required', 'numeric', 'gt:0'],
            'type' => ['sometimes', 'nullable', 'string', 'in:banknote,coin'],
            'buy' => ['nullable', 'numeric', 'min:0'],
            'sell' => ['nullable', 'numeric', 'min:0'],
            'margin_buy' => ['nullable', 'numeric'],
            'margin_sell' => ['nullable', 'numeric'],
            'stock' => ['nullable', 'numeric', 'min:0'],
            'alert_stock' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $currencyCode = strtoupper(trim((string) ($validated['currency_code'] ?? $currencyDenomination->currency_code)));

        if (!Currency::where('code', $currencyCode)->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => "Valuta {$currencyCode} belum terdaftar di master valuta.",
            ], 422);
        }

        $currencyDenomination->fill([
            'currency_code' => $currencyCode,
            'denomination' => $validated['denomination'] ?? $currencyDenomination->denomination,
            'type' => $validated['type'] ?? $currencyDenomination->type,
            'buy' => $validated['buy'] ?? $currencyDenomination->buy,
            'sell' => $validated['sell'] ?? $currencyDenomination->sell,
            'margin_buy' => $validated['margin_buy'] ?? $currencyDenomination->margin_buy,
            'margin_sell' => $validated['margin_sell'] ?? $currencyDenomination->margin_sell,
            'stock' => $validated['stock'] ?? $currencyDenomination->stock,
            'alert_stock' => $validated['alert_stock'] ?? $currencyDenomination->alert_stock,
            'is_active' => $validated['is_active'] ?? $currencyDenomination->is_active,
        ]);

        $currencyDenomination->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Pecahan valuta berhasil diperbarui.',
            'data' => $currencyDenomination->load('currency'),
        ]);
    }

    public function destroy(CurrencyDenomination $currencyDenomination)
    {
        $currencyDenomination->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pecahan valuta berhasil dihapus.',
        ]);
    }
}
