<?php
// @2026-Alifiandra
// Perbaikan saldo bank dobel: Kasir dulu membuat "mutasi manual" otomatis (keterangan
// "Transaksi Valas (Ref: INV-...)") untuk setiap transaksi transfer, padahal transaksinya sendiri
// sudah mencatat kas/bank di ledger. Mutasi otomatis itu dinetralkan dengan baris koreksi.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('erp_bank_movements')) {
            return;
        }
        $ids = DB::table('erp_bank_movements')->where('reference_type', 'manual_mutation')
            ->where('description', 'like', '%Transaksi Valas (Ref:%')->distinct()->pluck('bank_reference');
        foreach ($ids as $ref) {
            $rows = DB::table('erp_bank_movements')->where('reference_type', 'manual_mutation')->where('bank_reference', $ref)->get();
            $net = [];
            foreach ($rows as $r) {
                $net[$r->bank_account_id] = ($net[$r->bank_account_id] ?? 0) + (strtoupper($r->direction) === 'IN' ? 1 : -1) * (float) $r->amount;
            }
            $seq = $rows->count();
            foreach ($net as $acc => $v) {
                if (abs($v) < 0.005) {
                    continue;
                }
                $seq++;
                DB::table('erp_bank_movements')->insert([
                    'bank_account_id' => $acc,
                    'movement_no' => substr('MUT-' . $ref . '-' . str_pad((string) $seq, 2, '0', STR_PAD_LEFT), 0, 50),
                    'direction' => $v > 0 ? 'OUT' : 'IN',
                    'amount' => abs($v),
                    'currency_code' => 'IDR',
                    'reference_type' => 'manual_mutation',
                    'bank_reference' => $ref,
                    'description' => 'Koreksi: mutasi otomatis dari transaksi dinetralkan (sudah tercatat oleh transaksinya)',
                    'posted_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
    }
};
