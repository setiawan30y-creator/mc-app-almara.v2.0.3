<?php
// @2026-Alifiandra

namespace App\Console\Commands;

use App\Models\Transaction;
use App\Services\Erp\TransactionLedgerSync;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Menyamakan ledger dengan transaksi yang pernah diedit sebelum perbaikan (versi lama tidak
 * mencatat perubahan BELI/JUAL, jumlah, atau metode bayar ke kas/bank & stok).
 * Jalankan dulu dengan --dry untuk melihat transaksi yang akan dikoreksi.
 */
class LedgerRepair extends Command
{
    protected $signature = 'mc:ledger-repair {--dry : Hanya tampilkan, tidak menyimpan} {--from= : Mulai tanggal (Y-m-d)}';
    protected $description = 'Koreksi ledger kas/bank & stok untuk transaksi yang isinya berbeda dengan catatan ledger.';

    public function handle(TransactionLedgerSync $sync): int
    {
        $q = Transaction::query()->orderBy('timestamp');
        if ($from = $this->option('from')) {
            $q->where('timestamp', '>=', $from . ' 00:00:00');
        }
        $fixed = 0;
        foreach ($q->cursor() as $t) {
            if (!TransactionLedgerSync::hasPostings((string) $t->itemId)) {
                continue;
            }
            DB::beginTransaction();
            try {
                $n = $sync->sync($t, null, null);
                if ($n > 0) {
                    $fixed++;
                    $this->line(sprintf('%s %s %s %s %s: %d baris koreksi', $t->id, $t->timestamp, $t->tipe, $t->valuta, number_format((float) $t->total, 0, ',', '.'), $n));
                }
                $this->option('dry') ? DB::rollBack() : DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                $this->error($t->id . ' (' . $t->itemId . '): ' . $e->getMessage());
            }
        }
        $this->info(($this->option('dry') ? '[DRY RUN] ' : '') . "Transaksi yang dikoreksi: {$fixed}");
        return self::SUCCESS;
    }
}
