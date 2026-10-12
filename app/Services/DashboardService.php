<?php

namespace App\Services;

use App\Models\Currency;
use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\ErpCurrencyStock;
use App\Models\ErpPayment;
use App\Models\ErpSettlement;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function summary(?string $date = null): array
    {
        $targetDate = $date ?: now()->toDateString();

        $cash = $this->accountBalance(
            ErpCashAccount::query()
                ->where('currency_code', 'IDR')
                ->where('is_active', true)
                ->get()
        );

        $bank = $this->accountBalance(
            ErpBankAccount::query()
                ->where('currency_code', 'IDR')
                ->where('is_active', true)
                ->get()
        );

        $bca = $this->accountBalance(
            ErpBankAccount::query()
                ->where('currency_code', 'IDR')
                ->where('is_active', true)
                ->where(function ($q) {
                    $q->where('bank_name', 'like', '%BCA%')
                        ->orWhere('code', 'like', '%BCA%');
                })
                ->get()
        );

        $mandiri = $this->accountBalance(
            ErpBankAccount::query()
                ->where('currency_code', 'IDR')
                ->where('is_active', true)
                ->where(function ($q) {
                    $q->where('bank_name', 'like', '%MANDIRI%')
                        ->orWhere('code', 'like', '%MANDIRI%');
                })
                ->get()
        );

        $paymentsToday = ErpPayment::query()
            ->where('status', 'posted')
            ->where('currency_code', 'IDR')
            ->whereDate('paid_at', $targetDate);

        $paymentIn = (float) (clone $paymentsToday)->where('direction', 'in')->sum('amount');
        $paymentOut = (float) (clone $paymentsToday)->where('direction', 'out')->sum('amount');

        // Operational turnover is derived from POSTED ERP payments, not the legacy
        // dashboard datastore. A split payment therefore contributes its actual
        // posted cash/bank components and cannot silently lose an amount.
        $purchaseTotal = (float) (clone $paymentsToday)
            ->where('direction', 'out')
            ->whereHas('transaction', function ($q) {
                $q->whereIn(DB::raw('UPPER(tipe)'), ['BELI', 'BUY', 'PURCHASE']);
            })
            ->sum('amount');

        $salesTotal = (float) (clone $paymentsToday)
            ->where('direction', 'in')
            ->whereHas('transaction', function ($q) {
                $q->whereIn(DB::raw('UPPER(tipe)'), ['JUAL', 'SELL', 'SALE']);
            })
            ->sum('amount');

        $stockRows = ErpCurrencyStock::query()
            ->where('status', 'active')
            ->get();

        $currencies = Currency::query()
            ->get()
            ->keyBy(fn ($currency) => strtoupper((string) $currency->code));

        $stockValuation = 0.0;
        foreach ($stockRows as $stock) {
            $master = $currencies->get(strtoupper((string) $stock->currency_code));
            $stockValuation += (float) $stock->quantity * (float) ($master?->buy ?? 0);
        }

        $settlementsPending = (int) ErpSettlement::query()->where('status', 'pending')->count();
        $settlementsSettled = (int) ErpSettlement::query()->where('status', 'settled')->count();

        return [
            'date' => $targetDate,
            'cash' => $cash,
            'bank' => $bank,
            'bank_bca' => $bca,
            'bank_mandiri' => $mandiri,
            'total_liquid_idr' => $cash + $bank,
            'payment_in_today' => $paymentIn,
            'payment_out_today' => $paymentOut,
            'purchase_total_today' => $purchaseTotal,
            'sales_total_today' => $salesTotal,

            // Profit cannot be calculated safely from turnover alone. We deliberately
            // expose it as unavailable until the accounting/COGS ledger is connected.
            'today_profit' => null,
            'profit_status' => 'accounting_pending',

            'stock_valuation_idr' => $stockValuation,
            'stock' => $stockRows->map(fn ($stock) => [
                'currency_code' => strtoupper((string) $stock->currency_code),
                'quantity' => (float) $stock->quantity,
            ])->values()->all(),
            'settlements' => [
                'pending' => $settlementsPending,
                'settled' => $settlementsSettled,
            ],
            'total_customer' => (int) DB::table('mc_customers')->count(),
            'total_transaction_today' => (int) DB::table('mc_transactions')
                ->whereDate('timestamp', $targetDate)
                ->count(),
        ];
    }

    private function accountBalance($accounts): float
    {
        return (float) $accounts->sum(function ($account) {
            $in = (float) $account->movements()
                ->where('direction', 'in')
                ->sum('amount');
            $out = (float) $account->movements()
                ->where('direction', 'out')
                ->sum('amount');

            return (float) $account->opening_balance + $in - $out;
        });
    }
}
