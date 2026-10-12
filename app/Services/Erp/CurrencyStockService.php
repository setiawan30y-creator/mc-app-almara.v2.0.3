<?php

namespace App\Services\Erp;

use App\Models\ErpCurrencyStock;
use App\Models\ErpCurrencyStockDenomination;
use App\Models\ErpCurrencyStockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CurrencyStockService
{
    public function post(
        string $currencyCode,
        string $type,
        float $quantity,
        ?string $transactionRef = null,
        ?string $idempotencyKey = null,
        array $metadata = []
    ): ErpCurrencyStockMovement {
        if ($quantity <= 0) throw new RuntimeException('Stock quantity must be greater than zero.');
        $type = strtoupper($type);
        if (!in_array($type, ['IN', 'OUT'], true)) throw new RuntimeException('Stock movement type must be IN or OUT.');
        $idempotencyKey ??= Str::uuid()->toString();

        return DB::transaction(function () use ($currencyCode, $type, $quantity, $transactionRef, $idempotencyKey, $metadata) {
            $existing = ErpCurrencyStockMovement::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) return $existing;

            $currencyCode = strtoupper(trim($currencyCode));
            $stock = ErpCurrencyStock::firstOrCreate(
                ['currency_code' => $currencyCode],
                ['quantity' => 0, 'status' => 'active']
            );
            $stock = ErpCurrencyStock::whereKey($stock->id)->lockForUpdate()->firstOrFail();

            $denominations = $this->normalizeDenominations($metadata['denominations'] ?? []);
            $denomTotal = collect($denominations)->sum(fn ($row) => $row['denomination'] * $row['quantity']);
            if ($denominations && abs($denomTotal - $quantity) > 0.005) {
                throw new RuntimeException('Denomination total must exactly match stock movement quantity.');
            }

            $current = (float) $stock->quantity;
            $newBalance = $type === 'IN' ? $current + $quantity : $current - $quantity;
            if ($newBalance < 0) throw new RuntimeException("Insufficient {$currencyCode} stock.");

            if ($denominations) {
                foreach ($denominations as $row) {
                    $denom = ErpCurrencyStockDenomination::firstOrCreate(
                        ['currency_stock_id' => $stock->id, 'denomination' => $row['denomination']],
                        ['currency_code' => $currencyCode, 'quantity' => 0, 'balance_value' => 0, 'status' => 'active']
                    );
                    $denom = ErpCurrencyStockDenomination::whereKey($denom->id)->lockForUpdate()->firstOrFail();
                    $newQty = (float) $denom->quantity + ($type === 'IN' ? $row['quantity'] : -$row['quantity']);
                    if ($newQty < 0) throw new RuntimeException("Insufficient {$currencyCode} denomination {$row['denomination']} stock.");
                    $denom->update(['quantity' => $newQty, 'balance_value' => $newQty * (float) $denom->denomination]);
                }
            }

            $stock->update(['quantity' => $newBalance]);

            return ErpCurrencyStockMovement::create([
                'movement_ref' => 'STK-' . Str::upper(Str::random(16)),
                'currency_stock_id' => $stock->id,
                'transaction_ref' => $transactionRef,
                'movement_type' => $type,
                'quantity' => $quantity,
                'balance_after' => $newBalance,
                'currency_code' => $currencyCode,
                'idempotency_key' => $idempotencyKey,
                'metadata' => $metadata,
                'posted_at' => now(),
            ]);
        }, 3);
    }

    private function normalizeDenominations(array $rows): array
    {
        return collect($rows)->map(function ($row) {
            $denom = (float) ($row['denomination'] ?? $row['denom'] ?? 0);
            $qty = (float) ($row['quantity'] ?? $row['qty'] ?? 0);
            return ['denomination' => $denom, 'quantity' => $qty];
        })->filter(fn ($row) => $row['denomination'] > 0 && $row['quantity'] > 0)
          ->groupBy('denomination')->map(fn ($items, $denom) => [
              'denomination' => (float) $denom,
              'quantity' => $items->sum('quantity'),
          ])->values()->all();
    }
}
