<?php

namespace App\Services;

use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Nomor dokumen (INV / BKG) dialokasikan atomik: max(counter, nomor terbesar di DB, petunjuk klien) + 1
 * dalam satu transaksi dengan lock baris, sehingga tidak ada nomor ganda antar kasir / perangkat / modul.
 */
class DocumentNumberService
{
    /** @return array{id:string, seq:int} */
    public function next(string $prefix, int $hint = 0): array
    {
        $seq = DB::transaction(function () use ($prefix, $hint) {
            DB::table('erp_document_counters')->insertOrIgnore([
                'prefix' => $prefix, 'last_seq' => 0, 'created_at' => now(), 'updated_at' => now(),
            ]);
            $last = (int) DB::table('erp_document_counters')->where('prefix', $prefix)->lockForUpdate()->value('last_seq');
            $next = max($last, $hint, $this->maxInDatabase($prefix)) + 1;
            DB::table('erp_document_counters')->where('prefix', $prefix)->update(['last_seq' => $next, 'updated_at' => now()]);

            return $next;
        });

        return ['id' => sprintf('%s-%04d', $prefix, $seq), 'seq' => $seq];
    }

    private function maxInDatabase(string $prefix): int
    {
        if ($prefix !== 'INV') {
            return 0;
        }
        $table = (new Transaction())->getTable();
        if (!Schema::hasTable($table)) {
            return 0;
        }

        return (int) DB::table($table)
            ->whereRaw("id REGEXP '^INV-[0-9]+$'")
            ->selectRaw('MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)) AS m')
            ->value('m');
    }
}
