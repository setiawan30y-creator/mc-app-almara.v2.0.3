<?php

namespace App\Services\Erp;

use App\Models\ErpBankAccount;
use App\Models\ErpBankMovement;
use App\Models\ErpCashAccount;
use App\Models\ErpCashMovement;
use App\Models\ErpPayment;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentPostingService
{
    /**
     * Post one or more payments for a Money Changer transaction.
     *
     * The operation is atomic and idempotent. A payment retry using the same
     * idempotency_key will return the existing posted payment instead of
     * creating another financial movement.
     */
    public function post(string $transactionRef, array $payments, ?int $userId = null): array
    {
        if ($payments === []) {
            throw ValidationException::withMessages([
                'payments' => 'At least one payment is required.',
            ]);
        }

        return DB::transaction(function () use ($transactionRef, $payments, $userId) {
            /** @var Transaction|null $transaction */
            $transaction = Transaction::query()
                ->where('itemId', $transactionRef)
                ->lockForUpdate()
                ->first();

            if (!$transaction) {
                throw ValidationException::withMessages([
                    'transaction' => 'Transaction was not found.',
                ]);
            }

            $posted = [];

            foreach (array_values($payments) as $index => $data) {
                $method = strtolower(trim((string) ($data['method'] ?? '')));
                $currency = strtoupper(trim((string) ($data['currency_code'] ?? 'IDR')));
                $amount = $data['amount'] ?? null;

                if (!in_array($method, ['cash', 'bank'], true)) {
                    throw ValidationException::withMessages([
                        "payments.$index.method" => 'Payment method must be cash or bank.',
                    ]);
                }

                if (!is_numeric($amount) || (float) $amount <= 0) {
                    throw ValidationException::withMessages([
                        "payments.$index.amount" => 'Payment amount must be greater than zero.',
                    ]);
                }

                if ($currency === '') {
                    throw ValidationException::withMessages([
                        "payments.$index.currency_code" => 'Payment currency is required.',
                    ]);
                }

                $cashId = $method === 'cash' ? ($data['cash_account_id'] ?? null) : null;
                $bankId = $method === 'bank' ? ($data['bank_account_id'] ?? null) : null;

                if ($method === 'cash' && !$cashId) {
                    throw ValidationException::withMessages([
                        "payments.$index.cash_account_id" => 'Cash account is required.',
                    ]);
                }

                if ($method === 'bank' && !$bankId) {
                    throw ValidationException::withMessages([
                        "payments.$index.bank_account_id" => 'Bank account is required.',
                    ]);
                }

                $account = $method === 'cash'
                    ? ErpCashAccount::query()->whereKey($cashId)->lockForUpdate()->first()
                    : ErpBankAccount::query()->whereKey($bankId)->lockForUpdate()->first();

                if (!$account) {
                    throw ValidationException::withMessages([
                        "payments.$index.account" => ucfirst($method).' account was not found.',
                    ]);
                }

                if (!$account->is_active) {
                    throw ValidationException::withMessages([
                        "payments.$index.account" => ucfirst($method).' account is inactive.',
                    ]);
                }

                if (strtoupper((string) $account->currency_code) !== $currency) {
                    throw ValidationException::withMessages([
                        "payments.$index.currency_code" => "Payment currency must match the {$method} account currency.",
                    ]);
                }

                // Direction is derived from the transaction, never trusted from the browser.
                // BELI = MC pays IDR to customer (OUT); JUAL = customer pays IDR to MC (IN).
                $direction = $this->directionForTransaction((string) $transaction->tipe);

                $idempotencyKey = trim((string) ($data['idempotency_key'] ?? ''));
                if ($idempotencyKey === '') {
                    $idempotencyKey = hash('sha256', implode('|', [
                        $transactionRef,
                        $index,
                        $method,
                        $cashId ?? '',
                        $bankId ?? '',
                        $currency,
                        (string) $amount,
                        (string) ($data['reference'] ?? ''),
                    ]));
                }

                if (strlen($idempotencyKey) > 100) {
                    throw ValidationException::withMessages([
                        "payments.$index.idempotency_key" => 'Idempotency key may not exceed 100 characters.',
                    ]);
                }

                $existing = ErpPayment::query()
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    if ($existing->transaction_ref !== $transactionRef) {
                        throw ValidationException::withMessages([
                            "payments.$index.idempotency_key" => 'Idempotency key is already used by another transaction.',
                        ]);
                    }

                    $posted[] = $existing->fresh();
                    continue;
                }

                $payment = ErpPayment::create([
                    'payment_no' => $this->number('PAY'),
                    'transaction_ref' => $transactionRef,
                    'method' => $method,
                    'direction' => $direction,
                    'currency_code' => $currency,
                    'amount' => $amount,
                    'cash_account_id' => $cashId,
                    'bank_account_id' => $bankId,
                    'reference' => $data['reference'] ?? null,
                    'idempotency_key' => $idempotencyKey,
                    'status' => 'posted',
                    'paid_at' => now(),
                    'created_by' => $userId,
                ]);

                $movementData = [
                    'movement_no' => $this->number($method === 'cash' ? 'CSH' : 'BNK'),
                    'direction' => $direction,
                    'amount' => $amount,
                    'currency_code' => $currency,
                    'reference_type' => 'payment',
                    'reference_id' => $payment->id,
                    'idempotency_key' => $idempotencyKey,
                    'description' => $data['description'] ?? 'Transaction payment',
                    'posted_at' => now(),
                    'created_by' => $userId,
                ];

                if ($method === 'cash') {
                    ErpCashMovement::create([
                        'cash_account_id' => $cashId,
                        ...$movementData,
                    ]);
                } else {
                    ErpBankMovement::create([
                        'bank_account_id' => $bankId,
                        'bank_reference' => $data['bank_reference'] ?? null,
                        ...$movementData,
                    ]);
                }

                $posted[] = $payment->fresh();
            }

            return $posted;
        }, 3);
    }

    private function directionForTransaction(string $type): string
    {
        return match (strtolower(trim($type))) {
            'beli', 'buy', 'purchase' => 'OUT',
            'jual', 'sell', 'sale' => 'IN',
            default => throw ValidationException::withMessages([
                'transaction' => 'Transaction type is not supported for automatic payment posting.',
            ]),
        };
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('YmdHisv').'-'.strtoupper(bin2hex(random_bytes(3)));
    }
}
