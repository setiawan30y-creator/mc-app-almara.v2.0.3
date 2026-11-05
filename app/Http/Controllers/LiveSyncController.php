<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

/**
 * Tanda perubahan data (sangat ringan). Browser menanyakan ini setiap beberapa detik;
 * bila tandanya berubah (ada input/edit/hapus dari akun lain), barulah data lengkap ditarik
 * dan halaman yang sedang dibuka diperbarui otomatis tanpa refresh.
 */
class LiveSyncController extends Controller
{
    /** Kelompok data => model yang dipantau. */
    private const WATCH = [
        'datastore' => [\App\Models\Datastore::class],
        'transactions' => [\App\Models\Transaction::class],
        'customers' => [\App\Models\Customer::class, \App\Models\CustomerLicense::class, \App\Models\PtRepresentative::class],
        'currencies' => [\App\Models\Currency::class, \App\Models\CurrencyDenomination::class, \App\Models\RateSnapshot::class],
        'ledger' => [
            \App\Models\ErpCashAccount::class, \App\Models\ErpCashMovement::class,
            \App\Models\ErpBankAccount::class, \App\Models\ErpBankMovement::class,
            \App\Models\ErpCurrencyStock::class, \App\Models\ErpCurrencyStockMovement::class,
            \App\Models\ErpPayment::class, \App\Models\ErpExpense::class, \App\Models\ErpCashClosing::class,
            \App\Models\ErpGantungan::class, \App\Models\ErpInvestor::class, \App\Models\ErpInvestorCapitalMovement::class,
            \App\Models\ErpPickup::class,
        ],
    ];

    public function version(): JsonResponse
    {
        $parts = [];
        foreach (self::WATCH as $group => $models) {
            $sig = [];
            foreach ($models as $cls) {
                $sig[] = $this->signature($cls);
            }
            $parts[$group] = substr(md5(implode('|', $sig)), 0, 12);
        }

        return response()->json([
            'status' => 'success',
            'version' => substr(md5(implode('|', $parts)), 0, 16),
            'parts' => $parts,
        ])->header('Cache-Control', 'no-store');
    }

    private function signature(string $cls): string
    {
        if (!class_exists($cls)) {
            return '-';
        }
        try {
            $model = new $cls();
            $table = $model->getTable();
            static $cols = [];
            if (!array_key_exists($table, $cols)) {
                $cols[$table] = Schema::hasTable($table)
                    ? ['updated_at' => Schema::hasColumn($table, 'updated_at'), 'id' => Schema::hasColumn($table, $model->getKeyName())]
                    : null;
            }
            if ($cols[$table] === null) {
                return '-';
            }
            $q = $cls::query();
            $select = ['COUNT(*) AS c'];
            if ($cols[$table]['id']) {
                $select[] = 'MAX(' . $model->getKeyName() . ') AS m';
            }
            if ($cols[$table]['updated_at']) {
                $select[] = 'MAX(updated_at) AS u';
            }
            $row = $q->selectRaw(implode(', ', $select))->toBase()->first();
            return $table . ':' . ($row->c ?? 0) . ':' . ($row->m ?? '') . ':' . ($row->u ?? '');
        } catch (\Throwable $e) {
            return '-';
        }
    }
}
