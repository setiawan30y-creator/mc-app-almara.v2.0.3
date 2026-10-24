<?php

namespace App\Http\Controllers;

use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\ErpCurrencyStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Menyimpan saldo awal (kas, bank, stok valuta) ke ledger ERP.
 *
 * Dashboard membaca saldo kas/bank/stok dari ERP (lihat DatastoreController),
 * jadi saldo awal yang hanya tersimpan di browser akan ditimpa angka 0.
 * Endpoint ini bersifat idempotent: memanggilnya berulang dengan nilai yang
 * sama menghasilkan keadaan yang sama.
 */
class ErpOpeningBalanceController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'cash' => ['required', 'numeric', 'min:0'],
            'bank_bca' => ['required', 'numeric', 'min:0'],
            'bank_mandiri' => ['required', 'numeric', 'min:0'],
            'currencies' => ['nullable', 'array'],
            'currencies.*.code' => ['required', 'string', 'max:10'],
            'currencies.*.quantity' => ['required', 'numeric', 'min:0'],
        ]);

        $skipped = [];

        try {
            DB::transaction(function () use ($data, &$skipped) {
                $cash = ErpCashAccount::query()
                    ->where('currency_code', 'IDR')
                    ->where('is_active', true)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();

                if (!$cash) {
                    $cash = ErpCashAccount::firstOrCreate(
                        ['code' => 'CASH-IDR-01'],
                        [
                            'name' => 'Kas Utama IDR',
                            'currency_code' => 'IDR',
                            'opening_balance' => 0,
                            'is_active' => true,
                        ]
                    );
                }
                $cash->update(['opening_balance' => (float) $data['cash']]);

                $this->bankAccount('BCA')->update(['opening_balance' => (float) $data['bank_bca']]);
                $this->bankAccount('MANDIRI')->update(['opening_balance' => (float) $data['bank_mandiri']]);

                foreach (($data['currencies'] ?? []) as $row) {
                    $code = strtoupper(trim((string) $row['code']));

                    // Ledger stok ERP memakai kode 3 huruf. Kode turunan
                    // (lebih dari 3 karakter) tetap disimpan di master valuta.
                    if (strlen($code) !== 3) {
                        $skipped[] = ['code' => $code, 'reason' => 'Kode turunan dikelola di master valuta.'];
                        continue;
                    }

                    $stock = ErpCurrencyStock::firstOrCreate(
                        ['currency_code' => $code],
                        ['quantity' => 0, 'status' => 'active']
                    );
                    $stock = ErpCurrencyStock::whereKey($stock->id)->lockForUpdate()->firstOrFail();

                    // Jika sudah ada mutasi stok, jangan timpa saldo berjalan.
                    $hasMovements = DB::table('erp_currency_stock_movements')
                        ->where('currency_stock_id', $stock->id)
                        ->exists();
                    if ($hasMovements) {
                        $skipped[] = ['code' => $code, 'reason' => 'Sudah ada mutasi stok; saldo berjalan tidak ditimpa.'];
                        continue;
                    }

                    $stock->update(['quantity' => (float) $row['quantity'], 'status' => 'active']);
                }
            });
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Saldo awal tersimpan di ledger ERP.',
            'skipped' => $skipped,
        ]);
    }

    private function bankAccount(string $bankName): ErpBankAccount
    {
        $account = ErpBankAccount::query()
            ->where('currency_code', 'IDR')
            ->where('is_active', true)
            ->where(function ($query) use ($bankName) {
                $query->where('bank_name', 'like', '%'.$bankName.'%')
                    ->orWhere('code', 'like', '%'.$bankName.'%');
            })
            ->orderBy('id')
            ->lockForUpdate()
            ->first();

        if ($account) {
            return $account;
        }

        return ErpBankAccount::firstOrCreate(
            ['code' => 'BANK-'.strtoupper($bankName).'-IDR'],
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
}
