<?php

namespace App\Services\Erp;

use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransactionPostingService
{
    public function __construct(
        private readonly PaymentPostingService $payments,
        private readonly CurrencyStockService $stock,
        private readonly SettlementService $settlement,
    ) {
    }

    /**
     * Complete the ERP financial side of one Money Changer transaction.
     *
     * The transaction is locked first. Payment, stock movement and settlement
     * are then posted as one logical operation. Existing idempotency keys make
     * safe retries possible.
     */
    public function post(string $transactionRef, array $payments, ?int $userId = null): array
    {
        return DB::transaction(function () use ($transactionRef, $payments, $userId) {
            $transaction = Transaction::query()
                ->where('itemId', $transactionRef)
                ->lockForUpdate()
                ->first();

            if (!$transaction) {
                throw ValidationException::withMessages([
                    'transaction' => 'Transaction was not found.',
                ]);
            }

            $currency = strtoupper(trim((string) $transaction->valuta));
            $quantity = (float) $transaction->nominal;
            $expectedPayment = (float) $transaction->total;

            if ($currency === '' || $quantity <= 0 || $expectedPayment <= 0) {
                throw ValidationException::withMessages([
                    'transaction' => 'Transaction currency, nominal and total must be valid before posting.',
                ]);
            }

            $paymentTotal = collect($payments)->sum(fn ($payment) => (float) ($payment['amount'] ?? 0));
            if (abs($paymentTotal - $expectedPayment) > 0.005) {
                throw ValidationException::withMessages([
                    'payments' => 'Payment total must exactly match the transaction total.',
                ]);
            }

            $paymentCurrencies = collect($payments)
                ->map(fn ($payment) => strtoupper(trim((string) ($payment['currency_code'] ?? 'IDR'))))
                ->unique()
                ->values();

            if ($paymentCurrencies->count() !== 1) {
                throw ValidationException::withMessages([
                    'payments' => 'All payments for one transaction must use the same settlement currency.',
                ]);
            }

            $postedPayments = $this->payments->post($transactionRef, $payments, $userId);

            $stockType = match (strtolower(trim((string) $transaction->tipe))) {
                'beli', 'buy', 'purchase' => 'IN',
                'jual', 'sell', 'sale' => 'OUT',
                default => throw ValidationException::withMessages([
                    'transaction' => 'Transaction type is not supported for stock posting.',
                ]),
            };

            $stockMovement = $this->stock->post(
                $currency,
                $stockType,
                $quantity,
                $transactionRef,
                'transaction-stock-'.$transactionRef,
                [
                    'transaction_type' => $transaction->tipe,
                    'nominal' => $quantity,
                    'rate' => $transaction->rate,
                ]
            );

            $settlement = $this->settlement->settle($transactionRef, $userId);

            return [
                'transaction' => $transaction->fresh(),
                'payments' => $postedPayments,
                'stock_movement' => $stockMovement->fresh(),
                'settlement' => $settlement,
            ];
        }, 3);
    }
}
