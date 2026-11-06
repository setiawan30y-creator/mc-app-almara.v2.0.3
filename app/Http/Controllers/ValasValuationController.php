<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Services\Erp\ValasValuation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /valas/valuation[?date=YYYY-MM-DD]
 * Nilai stok valas dalam Rupiah dari satu sumber (ValasValuation).
 * Tanpa tanggal = stok saat ini; tanggal yang sudah dikunci = nilai saat closing.
 */
class ValasValuationController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $date = (string) $request->query('date', '');
        if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return response()->json(['status' => 'error', 'message' => 'Format tanggal tidak valid.'], 422);
        }

        return response()->json(['status' => 'success', 'data' => (new ValasValuation())->at($date ?: null)])
            ->header('Cache-Control', 'no-store');
    }
}
