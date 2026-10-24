<?php

namespace App\Http\Controllers;

use App\Models\ErpBankAccount;
use Illuminate\Http\JsonResponse;

/**
 * Ringkasan saldo dan rincian mutasi per rekening bank, dibaca langsung dari ledger ERP.
 */
class ErpBankMutationController extends Controller
{
    public function index(): JsonResponse
    {
        $accounts = ErpBankAccount::query()
            ->where('currency_code', 'IDR')
            ->where('is_active', true)
            ->orderBy('bank_name')
            ->get()
            ->map(function (ErpBankAccount $account) {
                $balance = (float) $account->opening_balance;
                $totalIn = 0.0;
                $totalOut = 0.0;
                $rows = [];

                $account->movements()
                    ->orderByRaw('COALESCE(posted_at, created_at) asc')
                    ->orderBy('id')
                    ->get()
                    ->each(function ($movement) use (&$balance, &$totalIn, &$totalOut, &$rows) {
                        $amount = (float) $movement->amount;
                        $isIn = strtolower((string) $movement->direction) === 'in';
                        $isIn ? $totalIn += $amount : $totalOut += $amount;
                        $balance += $isIn ? $amount : -$amount;

                        $rows[] = [
                            'movement_no' => $movement->movement_no,
                            'posted_at' => optional($movement->posted_at ?? $movement->created_at)->toIso8601String(),
                            'direction' => $isIn ? 'IN' : 'OUT',
                            'amount' => $amount,
                            'description' => $movement->description,
                            'bank_reference' => $movement->bank_reference,
                            'balance_after' => $balance,
                        ];
                    });

                return [
                    'id' => $account->id,
                    'code' => $account->code,
                    'bank_name' => $account->bank_name,
                    'account_number' => $account->account_number,
                    'opening_balance' => (float) $account->opening_balance,
                    'total_in' => $totalIn,
                    'total_out' => $totalOut,
                    'balance' => $balance,
                    'movements' => array_reverse($rows),
                ];
            })
            ->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'accounts' => $accounts,
                'total_balance' => (float) $accounts->sum('balance'),
            ],
        ]);
    }
}
