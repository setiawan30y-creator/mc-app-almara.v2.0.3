<?php
// @2026-Alifiandra
// Jurnal Ekuitas/Kewajiban dan DP booking yang masih aktif dulu hanya mengubah saldo di browser.
// Sekarang keduanya tercatat di buku besar server; data lama dicatat sekali di sini (idempotent).

use App\Services\Erp\MoneyLedger;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('mc_datastore') || !Schema::hasTable('erp_cash_movements') || !Schema::hasTable('erp_bank_movements')) {
            return;
        }
        $ledger = app(MoneyLedger::class);
        $read = function (string $key) {
            $raw = DB::table('mc_datastore')->where('store_key', $key)->value('json_data');
            $val = is_string($raw) ? json_decode($raw, true) : $raw;
            if (is_string($val)) {
                $val = json_decode($val, true);
            }
            return is_array($val) ? $val : [];
        };

        DB::transaction(function () use ($ledger, $read) {
            foreach ($read('mc_adjustments') as $a) {
                if (!is_array($a) || empty($a['id_adj']) || (float) ($a['nominal'] ?? 0) <= 0) {
                    continue;
                }
                $target = MoneyLedger::adjustmentTarget($a['impact'] ?? '', (float) $a['nominal']);
                $desc = trim(($a['kategori'] ?? '') . ' - ' . ($a['deskripsi'] ?? ''), ' -');
                $ledger->apply('adjustment', (string) $a['id_adj'], $target, $desc, $a['timestamp'] ?? null, null, false);
            }

            $seen = [];
            foreach ($read('mc_bookings') as $b) {
                $id = is_array($b) ? (string) ($b['bookingId'] ?? $b['id'] ?? '') : '';
                if ($id === '' || isset($seen[$id]) || strtoupper((string) ($b['status'] ?? '')) !== 'PENDING') {
                    continue;
                }
                $seen[$id] = true;
                $dp = (float) ($b['dpAmount'] ?? 0);
                if ($dp <= 0) {
                    continue;
                }
                $m = strtoupper((string) ($b['paymentMethod'] ?? 'CASH'));
                // Sama dengan aturan kasir saat pelunasan booking (normMethod): hanya TRANSFER yang ke bank.
                if ($m === 'TRANSFER') {
                    $m = strtoupper((string) ($b['bank'] ?? 'BCA')) === 'MANDIRI' ? 'MANDIRI' : 'BCA';
                }
                $m = in_array($m, ['CASH', 'BCA', 'MANDIRI'], true) ? $m : 'CASH';
                $sign = strtoupper((string) ($b['tipe'] ?? 'JUAL')) === 'BELI' ? -1 : 1;
                $ledger->apply('booking_dp', $id, [($m === 'CASH' ? 'cash' : 'bank:' . $m) => $sign * $dp], 'DP Booking ' . $id, $b['timestamp'] ?? null, null, false);
            }
        });
    }

    public function down(): void
    {
    }
};
