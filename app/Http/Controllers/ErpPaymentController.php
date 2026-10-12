<?php

namespace App\Http\Controllers;

use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Services\Erp\TransactionPostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ErpPaymentController extends Controller
{
    public function store(Request $request, string $transactionId, TransactionPostingService $service): JsonResponse
    {
        $validated = $request->validate([
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.method' => ['required', 'in:cash,bank'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.currency_code' => ['nullable', 'string', 'max:10'],
            'payments.*.cash_account_id' => ['nullable', 'integer'],
            'payments.*.bank_account_id' => ['nullable', 'integer'],
            'payments.*.bank_name' => ['nullable', 'string', 'max:100'],
            'payments.*.reference' => ['nullable', 'string', 'max:255'],
            'payments.*.bank_reference' => ['nullable', 'string', 'max:255'],
            'payments.*.idempotency_key' => ['nullable', 'string', 'max:100'],
            'payments.*.description' => ['nullable', 'string'],
        ]);

        foreach ($validated['payments'] as $index => &$payment) {
            $method = strtolower((string) ($payment['method'] ?? ''));
            $currency = strtoupper(trim((string) ($payment['currency_code'] ?? 'IDR')));

            if ($method === 'cash' && empty($payment['cash_account_id'])) {
                $account = ErpCashAccount::query()
                    ->where('currency_code', $currency)
                    ->where('is_active', true)
                    ->orderBy('id')
                    ->first();

                if (!$account && $currency === 'IDR') {
                    $account = ErpCashAccount::firstOrCreate(
                        ['code' => 'CASH-IDR-01'],
                        [
                            'name' => 'Kas Utama IDR',
                            'currency_code' => 'IDR',
                            'opening_balance' => 0,
                            'is_active' => true,
                        ]
                    );
                }

                if (!$account) {
                    throw ValidationException::withMessages([
                        "payments.$index.cash_account_id" => "Active {$currency} cash account was not found.",
                    ]);
                }

                $payment['cash_account_id'] = $account->id;
            }

            if ($method === 'bank' && empty($payment['bank_account_id'])) {
                $bankName = trim((string) ($payment['bank_name'] ?? ''));
                if ($bankName === '') {
                    throw ValidationException::withMessages([
                        "payments.$index.bank_name" => 'Bank name is required for bank payment.',
                    ]);
                }

                $query = ErpBankAccount::query()
                    ->where('currency_code', $currency)
                    ->where('is_active', true)
                    ->where(function ($q) use ($bankName) {
                        $q->whereRaw('LOWER(bank_name) = ?', [strtolower($bankName)])
                            ->orWhereRaw('LOWER(bank_name) LIKE ?', ['%'.strtolower($bankName).'%']);
                    });

                $account = $query->orderBy('id')->first();

                if (!$account && $currency === 'IDR') {
                    $safeCode = strtoupper(preg_replace('/[^A-Z0-9]+/i', '-', $bankName));
                    $safeCode = trim($safeCode, '-');
                    $safeCode = $safeCode !== '' ? $safeCode : 'BANK';
                    $code = 'BANK-'.$safeCode.'-IDR';

                    $account = ErpBankAccount::firstOrCreate(
                        ['code' => $code],
                        [
                            'bank_name' => $bankName,
                            'account_name' => null,
                            'account_number' => null,
                            'currency_code' => 'IDR',
                            'opening_balance' => 0,
                            'is_active' => true,
                        ]
                    );
                }

                if (!$account) {
                    throw ValidationException::withMessages([
                        "payments.$index.bank_account_id" => "Active {$currency} bank account for {$bankName} was not found.",
                    ]);
                }

                $payment['bank_account_id'] = $account->id;
            }
        }
        unset($payment);

        $result = $service->post(
            $transactionId,
            $validated['payments'],
            optional($request->user())->id
        );

        return response()->json([
            'success' => true,
            'message' => 'Transaction payment, stock and settlement posted successfully.',
            'data' => $result,
        ], 201);
    }
}
