<?php

namespace App\Services\Erp;

use App\Models\ErpCashClosing;
use App\Models\ErpGantungan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CashClosingService
{
    public function reconcile(
        string $closingDate,
        float $openingCash,
        float $cashIn,
        float $cashOut,
        float $expense,
        float $physicalCash,
        ?string $notes = null
    ): ErpCashClosing {
        return DB::transaction(function () use ($closingDate, $openingCash, $cashIn, $cashOut, $expense, $physicalCash, $notes) {
            $closing = ErpCashClosing::whereDate('closing_date', $closingDate)
                ->lockForUpdate()->first();

            if ($closing && $closing->status === 'CLOSED') {
                throw new RuntimeException('Cash closing is already finalized. Use a reversal/correction process.');
            }

            $hangingAmount = (float) ErpGantungan::where('status', 'OUTSTANDING')->sum('amount_rp');
            $expectedCash = round($openingCash + $cashIn - $cashOut - $expense, 2);
            $accountedCash = round($physicalCash + $hangingAmount, 2);
            $difference = round($accountedCash - $expectedCash, 2);

            $status = abs($difference) < 0.005
                ? 'BALANCED'
                : ($difference < 0 ? 'SHORT' : 'OVER');

            $closing ??= new ErpCashClosing([
                'closing_no' => 'CLS-' . Str::upper(Str::random(16)),
                'closing_date' => $closingDate,
            ]);

            $closing->fill([
                'opening_cash' => $openingCash,
                'cash_in' => $cashIn,
                'cash_out' => $cashOut,
                'expense' => $expense,
                'expected_cash' => $expectedCash,
                'physical_cash' => $physicalCash,
                'hanging_amount' => $hangingAmount,
                'accounted_cash' => $accountedCash,
                'difference' => $difference,
                'status' => $status,
                'notes' => $notes,
            ])->save();

            return $closing->fresh();
        }, 3);
    }

    public function finalize(int $closingId, ?int $userId = null): ErpCashClosing
    {
        return DB::transaction(function () use ($closingId, $userId) {
            $closing = ErpCashClosing::whereKey($closingId)->lockForUpdate()->firstOrFail();

            if ($closing->status === 'CLOSED') {
                return $closing;
            }

            if ($closing->status !== 'BALANCED') {
                throw new RuntimeException('Closing can only be finalized when BALANCED.');
            }

            $closing->update([
                'status' => 'CLOSED',
                'closed_by' => $userId,
                'closed_at' => now(),
            ]);

            return $closing->fresh();
        }, 3);
    }
}
