<?php

namespace App\Http\Controllers;

use App\Models\Datastore;
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
    /** Saldo awal kas/bank versi aplikasi (form Saldo Awal). Di-reset ke 0, bukan dihapus,
     *  supaya browser/komputer lain ikut menarik nilai 0 dan tidak mengirim ulang nilai lama. */
    private const OPENING_KEYS = ['mc_initial_cash', 'mc_initial_bank_bca', 'mc_initial_bank_mandiri', 'mc_cash', 'mc_bank_bca', 'mc_bank_mandiri'];

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
            'openingBalance' => ['label' => 'Saldo Awal (Kas, Bank & Valas)',
                'desc' => 'Hanya saldo awal: kas tunai, bank, serta jumlah & kurs modal awal valas pada form Saldo Awal dan tabel Inventaris Modal (kembali ke 0). Transaksi, mutasi, dan stok berjalan tidak dihapus.',
                'danger' => 'mid', 'counts' => []],
            'currencyStock' => ['label' => 'Stok Valas',
                'desc' => 'Mutasi, pecahan, jumlah stok, serta saldo awal & kurs modal valas (kembali ke 0). Daftar valuta dan kurs jual/beli tetap.',
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
            if ($code === 'cashBank') {
                $rows += $this->countOpening();
            }
            if ($code === 'currencyStock') {
                $rows += $this->countCurrencyOpening();
            }
            if ($code === 'openingBalance') {
                $rows += $this->countOpeningOnly();
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
                $n += $this->zeroOpeningKeys();
                break;
            case 'openingBalance':
                $n += $this->resetOpeningOnly();
                break;
            case 'currencyStock':
                $n += $this->del('erp_currency_stock_denominations');
                $n += $this->del('erp_currency_stock_movements');
                if (Schema::hasTable('erp_currency_stocks')) {
                    DB::table('erp_currency_stocks')->update(['quantity' => 0]);
                }
                $n += $this->zeroCurrencyOpening();
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

    /** Field saldo awal / modal valas di master valuta (raw_json mc_currencies & datastore). */
    private const CURRENCY_OPENING_FIELDS = ['stock', 'initialStock', 'initial_rate_locked', 'avg_buy_rate', 'modalRate', 'avgCost', 'costRate', 'modalValue'];

    private function currencyHasOpening(array $row): bool
    {
        foreach (self::CURRENCY_OPENING_FIELDS as $f) {
            if (isset($row[$f]) && is_numeric($row[$f]) && (float) $row[$f] != 0.0) {
                return true;
            }
        }

        return false;
    }

    private function zeroCurrencyRow(array $row): array
    {
        foreach (self::CURRENCY_OPENING_FIELDS as $f) {
            if (array_key_exists($f, $row) || in_array($f, ['stock', 'initialStock', 'initial_rate_locked'], true)) {
                $row[$f] = 0;
            }
        }
        $row['initial_rate_source'] = '';

        return $row;
    }

    /** Jumlah valuta yang masih punya stok / saldo awal / kurs modal di master valuta. */
    private function countCurrencyOpening(): int
    {
        if (!Schema::hasTable('mc_currencies')) {
            return 0;
        }
        $n = 0;
        foreach (DB::table('mc_currencies')->get(['stock', 'raw_json']) as $c) {
            $raw = is_string($c->raw_json) ? json_decode($c->raw_json, true) : null;
            if ((float) $c->stock != 0.0 || (is_array($raw) && $this->currencyHasOpening($raw))) {
                $n++;
            }
        }

        return $n;
    }

    /** Nol-kan stok, saldo awal, dan kurs modal di master valuta; kode, nama, kurs jual/beli tetap. */
    private function zeroCurrencyOpening(): int
    {
        $n = 0;
        if (Schema::hasTable('mc_currencies')) {
            foreach (DB::table('mc_currencies')->get(['code', 'stock', 'raw_json']) as $c) {
                $raw = is_string($c->raw_json) ? json_decode($c->raw_json, true) : null;
                $raw = is_array($raw) ? $raw : [];
                if ((float) $c->stock != 0.0 || $this->currencyHasOpening($raw)) {
                    $n++;
                }
                DB::table('mc_currencies')->where('code', $c->code)->update([
                    'stock' => 0,
                    'raw_json' => json_encode($this->zeroCurrencyRow($raw), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]);
            }
        }
        if (Schema::hasTable('mc_datastore')) {
            $row = Datastore::query()->find('mc_currencies');
            if ($row && is_array($row->json_data)) {
                $row->json_data = array_map(fn ($c) => is_array($c) ? $this->zeroCurrencyRow($c) : $c, $row->json_data);
                $row->save();
            }
        }

        return $n;
    }

    /** Kunci form Saldo Awal (tanpa saldo berjalan mc_cash/mc_bank_*). */
    private const INITIAL_KEYS = ['mc_initial_cash', 'mc_initial_bank_bca', 'mc_initial_bank_mandiri'];
    /** Field saldo awal valas di master valuta. */
    private const CURRENCY_INITIAL_FIELDS = ['initialStock', 'initial_rate_locked'];

    private function currencyInitialNonZero(array $row): bool
    {
        foreach (self::CURRENCY_INITIAL_FIELDS as $f) {
            if (isset($row[$f]) && is_numeric($row[$f]) && (float) $row[$f] != 0.0) {
                return true;
            }
        }

        return false;
    }

    /** Hitung saldo awal kas/bank/valas yang belum 0 (untuk pratinjau). */
    private function countOpeningOnly(): int
    {
        $n = 0;
        foreach (['erp_cash_accounts', 'erp_bank_accounts'] as $t) {
            if (Schema::hasTable($t) && Schema::hasColumn($t, 'opening_balance')) {
                $n += (int) DB::table($t)->where('opening_balance', '!=', 0)->count();
            }
        }
        if (Schema::hasTable('mc_datastore')) {
            foreach (Datastore::query()->whereIn('store_key', self::INITIAL_KEYS)->get() as $row) {
                if ((float) (is_scalar($row->json_data) ? $row->json_data : 0) != 0.0) {
                    $n++;
                }
            }
        }
        if (Schema::hasTable('mc_currencies')) {
            foreach (DB::table('mc_currencies')->pluck('raw_json') as $rawJson) {
                $raw = is_string($rawJson) ? json_decode($rawJson, true) : null;
                if (is_array($raw) && $this->currencyInitialNonZero($raw)) {
                    $n++;
                }
            }
        }

        return $n;
    }

    /**
     * Nol-kan saldo awal saja. Mutasi/transaksi tetap. Stok valas di ledger ERP ikut 0 hanya
     * untuk valuta yang belum punya mutasi (artinya jumlahnya murni berasal dari saldo awal).
     */
    private function resetOpeningOnly(): int
    {
        $n = $this->countOpeningOnly();
        foreach (['erp_cash_accounts', 'erp_bank_accounts'] as $t) {
            if (Schema::hasTable($t) && Schema::hasColumn($t, 'opening_balance')) {
                DB::table($t)->update(['opening_balance' => 0]);
            }
        }
        if (Schema::hasTable('mc_datastore')) {
            foreach (self::INITIAL_KEYS as $key) {
                Datastore::updateOrCreate(['store_key' => $key], ['json_data' => 0]);
            }
        }
        if (Schema::hasTable('mc_currencies')) {
            foreach (DB::table('mc_currencies')->get(['code', 'raw_json']) as $c) {
                $raw = is_string($c->raw_json) ? json_decode($c->raw_json, true) : null;
                if (!is_array($raw) || !$this->currencyInitialNonZero($raw)) {
                    continue;
                }
                $raw['initialStock'] = 0;
                $raw['initial_rate_locked'] = 0;
                $raw['initial_rate_source'] = '';
                DB::table('mc_currencies')->where('code', $c->code)->update([
                    'raw_json' => json_encode($raw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]);
            }
        }
        if (Schema::hasTable('mc_datastore')) {
            $row = Datastore::query()->find('mc_currencies');
            if ($row && is_array($row->json_data)) {
                $row->json_data = array_map(function ($c) {
                    if (!is_array($c)) return $c;
                    $c['initialStock'] = 0;
                    $c['initial_rate_locked'] = 0;
                    $c['initial_rate_source'] = '';
                    return $c;
                }, $row->json_data);
                $row->save();
            }
        }
        if (Schema::hasTable('erp_currency_stocks') && Schema::hasTable('erp_currency_stock_movements')) {
            $withMovements = DB::table('erp_currency_stock_movements')->distinct()->pluck('currency_stock_id')->all();
            DB::table('erp_currency_stocks')->whereNotIn('id', $withMovements ?: [0])->update(['quantity' => 0]);
        }

        return $n;
    }

    /** Jumlah saldo awal (ERP + form Saldo Awal) yang masih bernilai selain 0. */
    private function countOpening(): int
    {
        $n = 0;
        foreach (['erp_cash_accounts', 'erp_bank_accounts'] as $t) {
            if (Schema::hasTable($t) && Schema::hasColumn($t, 'opening_balance')) {
                $n += (int) DB::table($t)->where('opening_balance', '!=', 0)->count();
            }
        }
        if (Schema::hasTable('mc_datastore')) {
            foreach (Datastore::query()->whereIn('store_key', self::OPENING_KEYS)->get() as $row) {
                if ((float) (is_scalar($row->json_data) ? $row->json_data : 0) != 0.0) {
                    $n++;
                }
            }
        }

        return $n;
    }

    /** Set saldo awal versi aplikasi ke 0 (dibuat bila belum ada). */
    private function zeroOpeningKeys(): int
    {
        if (!Schema::hasTable('mc_datastore')) {
            return 0;
        }
        $n = 0;
        foreach (self::OPENING_KEYS as $key) {
            $row = Datastore::query()->find($key);
            if ($row && (float) (is_scalar($row->json_data) ? $row->json_data : 0) != 0.0) {
                $n++;
            }
            Datastore::updateOrCreate(['store_key' => $key], ['json_data' => 0]);
        }

        return $n;
    }

    private function clearKeys(string $group): int
    {
        if (!Schema::hasTable('mc_datastore')) {
            return 0;
        }

        return (int) DB::table('mc_datastore')->whereIn('store_key', self::DATASTORE_KEYS[$group])->delete();
    }
}
