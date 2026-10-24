<?php

namespace App\Http\Controllers;

use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Reset data terpilih di MySQL. Hanya owner/superadmin, wajib password +
 * kata konfirmasi, dan selalu membuat backup otomatis sebelum menghapus.
 * Master valuta, profil perusahaan, pengguna, dan aturan goAML tidak disentuh.
 */
class DataResetController extends Controller
{
    /** Kunci mc_datastore yang dikosongkan per cakupan. */
    private const DATASTORE_KEYS = [
        'expenses' => ['mc_expenses'],
        'operations' => ['mc_mutations', 'mc_closings', 'mc_adjustments', 'mc_assets', 'mc_investors',
            'mc_hris_employees', 'mc_hris_attendance', 'mc_hris_kasbon', 'mc_hris_bpjs', 'mc_hris_leave'],
        'bookingDemo' => ['mc_bookings', 'mc_demo_transactions', 'mc_demo_stock', 'mc_demo_customers'],
        'gantungan' => ['mc_gantungans'],
        'oldMoney' => ['mc_old_money_stock', 'mc_old_money_suppliers', 'mc_old_money_trxs', 'mc_old_money_cash'],
        'biRates' => ['mc_bi_rates'],
    ];

    /** Cakupan beserta tabel/kunci yang dihitung untuk pratinjau. */
    private function definitions(): array
    {
        return [
            'transactions' => ['label' => 'Transaksi Utama & Riwayat',
                'desc' => 'Transaksi, pembayaran, settlement, dan mutasi kas/bank/stok hasil transaksi (POS).',
                'danger' => 'high', 'counts' => ['mc_transactions', 'erp_payments', 'erp_settlements']],
            'audit' => ['label' => 'Jejak Audit Transaksi',
                'desc' => 'Salinan RWT lama dari fitur yang sudah dihapus. Tidak dipakai lagi dan aman dikosongkan.',
                'danger' => 'high', 'counts' => ['mc_transactions_audit']],
            'customers' => ['label' => 'Data Nasabah',
                'desc' => 'Seluruh data nasabah (CIF) beserta data pendukung.',
                'danger' => 'high', 'counts' => ['mc_customers']],
            'cashBank' => ['label' => 'Kas & Saldo Bank',
                'desc' => 'Semua mutasi kas dan bank serta saldo awalnya (kembali ke 0).',
                'danger' => 'high', 'counts' => ['erp_cash_movements', 'erp_bank_movements']],
            'currencyStock' => ['label' => 'Stok Valas',
                'desc' => 'Mutasi, pecahan, dan jumlah stok valas (kembali ke 0). Master valuta tetap.',
                'danger' => 'high', 'counts' => ['erp_currency_stock_movements', 'erp_currency_stock_denominations']],
            'expenses' => ['label' => 'Pengeluaran',
                'desc' => 'Daftar pengeluaran/pendapatan lain dan mutasi kas/bank-nya.',
                'danger' => 'mid', 'counts' => [], 'keys' => 'expenses'],
            'operations' => ['label' => 'Mutasi, Closing, Aset, Investor & HRIS',
                'desc' => 'Mutasi bank manual, closing harian, penyesuaian, aset, investor, dan data HRIS.',
                'danger' => 'mid', 'counts' => ['erp_cash_closings', 'erp_investors'], 'keys' => 'operations'],
            'gantungan' => ['label' => 'Gantungan',
                'desc' => 'Seluruh catatan gantungan.',
                'danger' => 'mid', 'counts' => ['erp_gantungan'], 'keys' => 'gantungan'],
            'compliance' => ['label' => 'Alert & LTKM goAML',
                'desc' => 'Alert kepatuhan dan draft LTKM. Aturan (rules) tidak dihapus.',
                'danger' => 'mid', 'counts' => ['goaml_alerts', 'goaml_ltkm_reports']],
            'bookingDemo' => ['label' => 'Booking & Demo',
                'desc' => 'Data booking dan transaksi demo.',
                'danger' => 'low', 'counts' => [], 'keys' => 'bookingDemo'],
            'oldMoney' => ['label' => 'Koin & Uang Lama',
                'desc' => 'Stok, pemasok, dan transaksi uang lama.',
                'danger' => 'low', 'counts' => [], 'keys' => 'oldMoney'],
            'biRates' => ['label' => 'Kurs BI / LKU',
                'desc' => 'Data kurs BI yang tersimpan.',
                'danger' => 'low', 'counts' => [], 'keys' => 'biRates'],
        ];
    }

    public function summary(): JsonResponse
    {
        $out = [];
        foreach ($this->definitions() as $code => $def) {
            $rows = 0;
            foreach ($def['counts'] as $table) {
                if (Schema::hasTable($table)) {
                    $rows += (int) DB::table($table)->count();
                }
            }
            if (isset($def['keys']) && Schema::hasTable('mc_datastore')) {
                $rows += (int) DB::table('mc_datastore')
                    ->whereIn('store_key', self::DATASTORE_KEYS[$def['keys']])
                    ->where('json_data', '!=', '[]')->where('json_data', '!=', '')->where('json_data', '!=', '0')
                    ->count();
            }
            if ($code === 'expenses') {
                $rows += $this->countRef('erp_cash_movements', 'expense') + $this->countRef('erp_bank_movements', 'expense')
                    + (Schema::hasTable('erp_expenses') ? (int) DB::table('erp_expenses')->count() : 0);
            }
            if ($code === 'operations') {
                $rows += $this->countRef('erp_bank_movements', 'manual_mutation');
            }
            $out[] = ['code' => $code, 'label' => $def['label'], 'desc' => $def['desc'], 'danger' => $def['danger'], 'rows' => $rows];
        }

        return response()->json(['status' => 'success', 'data' => $out]);
    }

    public function reset(Request $request, BackupService $backup): JsonResponse
    {
        $defs = $this->definitions();
        $data = $request->validate([
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*' => ['string', 'in:'.implode(',', array_keys($defs))],
            'password' => ['required', 'string'],
            'confirm' => ['required', 'in:RESET'],
        ]);

        $user = $request->user();
        if (!$user || !Hash::check($data['password'], (string) $user->password)) {
            return response()->json(['status' => 'error', 'message' => 'Password salah. Reset dibatalkan.'], 422);
        }

        $scopes = array_values(array_unique($data['scopes']));

        // Backup otomatis sebelum menghapus. Bila gagal, reset dibatalkan.
        @set_time_limit(0);
        $backupInfo = null;
        try {
            $log = $backup->run('manual', $user->id);
            $backupInfo = $log->filename ?? null;
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Backup otomatis sebelum reset gagal, reset dibatalkan: '.$e->getMessage(),
            ], 500);
        }

        $deleted = [];
        try {
            DB::transaction(function () use ($scopes, &$deleted) {
                foreach ($scopes as $scope) {
                    $deleted[$scope] = $this->apply($scope);
                }
            });
        } catch (\Throwable $e) {
            Log::error('Reset data gagal', ['scopes' => $scopes, 'error' => $e->getMessage()]);

            return response()->json(['status' => 'error', 'message' => 'Reset gagal dan dibatalkan: '.$e->getMessage()], 500);
        }

        Log::warning('Reset data dijalankan', ['user' => $user->id, 'scopes' => $scopes, 'deleted' => $deleted, 'backup' => $backupInfo]);

        return response()->json([
            'status' => 'success',
            'message' => 'Reset selesai.',
            'backup' => $backupInfo,
            'deleted' => $deleted,
        ]);
    }

    private function apply(string $scope): int
    {
        $n = 0;

        switch ($scope) {
            case 'transactions':
                $n += $this->del('mc_transactions');
                $n += $this->del('erp_payments');
                $n += $this->del('erp_settlements');
                $n += $this->delWhereKey('erp_cash_movements', 'POS:%');
                $n += $this->delWhereKey('erp_bank_movements', 'POS:%');
                if (Schema::hasTable('erp_currency_stock_movements')) {
                    $n += DB::table('erp_currency_stock_movements')->whereNotNull('transaction_ref')->delete();
                    $this->recomputeStock();
                }
                if (Schema::hasTable('mc_datastore')) {
                    DB::table('mc_datastore')->whereIn('store_key', ['mc_invoice_seq'])->delete();
                }
                break;
            case 'audit':
                $n += $this->del('mc_transactions_audit');
                break;
            case 'customers':
                $n += $this->del('mc_customers');
                break;
            case 'cashBank':
                $n += $this->del('erp_cash_movements');
                $n += $this->del('erp_bank_movements');
                foreach (['erp_cash_accounts', 'erp_bank_accounts'] as $t) {
                    if (Schema::hasTable($t)) {
                        DB::table($t)->update(['opening_balance' => 0]);
                    }
                }
                break;
            case 'currencyStock':
                $n += $this->del('erp_currency_stock_denominations');
                $n += $this->del('erp_currency_stock_movements');
                if (Schema::hasTable('erp_currency_stocks')) {
                    DB::table('erp_currency_stocks')->update(['quantity' => 0]);
                }
                break;
            case 'expenses':
                $n += $this->delRef('erp_cash_movements', 'expense');
                $n += $this->delRef('erp_bank_movements', 'expense');
                if (Schema::hasTable('erp_expenses')) {
                    $n += (int) DB::table('erp_expenses')->delete();
                }
                $n += $this->clearKeys('expenses');
                break;
            case 'operations':
                $n += $this->delRef('erp_bank_movements', 'manual_mutation');
                $n += $this->del('erp_cash_closing_stock_counts');
                $n += $this->del('erp_cash_closing_logs');
                $n += $this->del('erp_cash_closing_denominations');
                $n += $this->del('erp_cash_closings');
                $n += $this->del('erp_investor_capital_movements');
                $n += $this->del('erp_investors');
                $n += $this->clearKeys('operations');
                break;
            case 'gantungan':
                $n += $this->del('erp_gantungan_payments');
                $n += $this->del('erp_gantungan');
                $n += $this->clearKeys('gantungan');
                break;
            case 'compliance':
                $n += $this->del('goaml_ltkm_reports');
                $n += $this->del('goaml_alert_transactions');
                $n += $this->del('goaml_alerts');
                break;
            case 'bookingDemo':
                $n += $this->clearKeys('bookingDemo');
                break;
            case 'oldMoney':
                $n += $this->clearKeys('oldMoney');
                break;
            case 'biRates':
                $n += $this->clearKeys('biRates');
                break;
        }

        return $n;
    }

    /** Stok = saldo mutasi terakhir yang tersisa; 0 bila tidak ada mutasi. */
    private function recomputeStock(): void
    {
        foreach (DB::table('erp_currency_stocks')->get() as $stock) {
            $last = DB::table('erp_currency_stock_movements')
                ->where('currency_stock_id', $stock->id)
                ->orderByDesc('id')
                ->value('balance_after');
            DB::table('erp_currency_stocks')->where('id', $stock->id)->update(['quantity' => $last ?? 0]);
        }
    }

    private function del(string $table): int
    {
        return Schema::hasTable($table) ? (int) DB::table($table)->delete() : 0;
    }

    private function delRef(string $table, string $ref): int
    {
        return Schema::hasTable($table) ? (int) DB::table($table)->where('reference_type', $ref)->delete() : 0;
    }

    private function delWhereKey(string $table, string $like): int
    {
        return (Schema::hasTable($table) && Schema::hasColumn($table, 'idempotency_key'))
            ? (int) DB::table($table)->where('idempotency_key', 'like', $like)->delete()
            : 0;
    }

    private function countRef(string $table, string $ref): int
    {
        return Schema::hasTable($table) ? (int) DB::table($table)->where('reference_type', $ref)->count() : 0;
    }

    private function clearKeys(string $group): int
    {
        if (!Schema::hasTable('mc_datastore')) {
            return 0;
        }

        return (int) DB::table('mc_datastore')->whereIn('store_key', self::DATASTORE_KEYS[$group])->delete();
    }
}
