<?php

namespace App\Services\Erp;

use App\Models\ErpSettlement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class SettlementService
{
    public function settle(string $transactionRef, ?int $userId = null, ?string $notes = null): ErpSettlement
    {
        return DB::transaction(function () use ($transactionRef, $userId, $notes) {
            $existing = ErpSettlement::where('transaction_ref', $transactionRef)
                ->where('status', 'settled')
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return $existing;
            }

            $pending = ErpSettlement::where('transaction_ref', $transactionRef)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->first();

            if (!$pending) {
                $pending = ErpSettlement::create([
                    'settlement_ref' => 'SET-' . Str::upper(Str::random(16)),
                    'transaction_ref' => $transactionRef,
                    'status' => 'pending',
                ]);
                $pending = ErpSettlement::whereKey($pending->id)->lockForUpdate()->firstOrFail();
            }

            $pending->update([
                'status' => 'settled',
                'settled_at' => now(),
                'settled_by' => $userId,
                'notes' => $notes,
            ]);

            return $pending->fresh();
        }, 3);
    }
}
