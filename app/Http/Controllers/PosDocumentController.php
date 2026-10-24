<?php

namespace App\Http\Controllers;

use App\Services\DocumentNumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/**
 * Nomor invoice / booking dibuat di server TEPAT saat transaksi disubmit (lihat DocumentNumberService).
 */
class PosDocumentController extends Controller
{
    private const PREFIXES = ['INV', 'BKG', 'OM'];

    public function next(Request $request, DocumentNumberService $numbers): JsonResponse
    {
        $data = $request->validate([
            'prefix' => ['required', 'in:'.implode(',', self::PREFIXES)],
            'min_seq' => ['nullable', 'integer', 'min:0', 'max:999999999'],
        ]);

        if (!Schema::hasTable('erp_document_counters')) {
            return response()->json(['status' => 'error', 'message' => 'Tabel penomoran belum dimigrasi.'], 503);
        }

        return response()->json(['status' => 'success', 'data' => $numbers->next($data['prefix'], (int) ($data['min_seq'] ?? 0))]);
    }
}
