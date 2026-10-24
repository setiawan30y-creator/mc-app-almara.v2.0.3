<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gantungan = catatan Rp yang sedang di luar laci kas saat closing.
 *  - erp_gantungan: tambah kategori dan nama pencatat.
 *  - erp_gantungan_payments: cicilan / pengembalian sebagian, sehingga sisa tiap nama bisa dihitung.
 *
 * Gantungan hanya catatan. Tidak ada mutasi ledger kas/bank dari tabel ini.
 * Closing Harian menambahkan sisa gantungan ke uang fisik saat rekonsiliasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('erp_gantungan')) {
            Schema::table('erp_gantungan', function (Blueprint $table) {
                if (!Schema::hasColumn('erp_gantungan', 'category')) {
                    $table->string('category', 40)->nullable()->after('type');
                }
                if (!Schema::hasColumn('erp_gantungan', 'created_by_name')) {
                    $table->string('created_by_name', 150)->nullable()->after('created_by');
                }
                if (!Schema::hasColumn('erp_gantungan', 'recipient_key')) {
                    $table->string('recipient_key', 150)->nullable()->after('recipient')->index();
                }
            });
        }

        if (!Schema::hasTable('erp_gantungan_payments')) {
            Schema::create('erp_gantungan_payments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('gantungan_id')->constrained('erp_gantungan')->cascadeOnDelete();
                $table->dateTime('paid_at');
                $table->decimal('amount_rp', 18, 2);
                $table->string('note', 255)->nullable();
                $table->string('created_by_name', 150)->nullable();
                $table->timestamps();
                $table->index(['gantungan_id', 'paid_at']);
            });
        }

        // Isi recipient_key untuk baris lama (huruf kecil, spasi dirapikan) agar pengelompokan per nama konsisten.
        if (Schema::hasTable('erp_gantungan') && Schema::hasColumn('erp_gantungan', 'recipient_key')) {
            foreach (\Illuminate\Support\Facades\DB::table('erp_gantungan')->whereNull('recipient_key')->get(['id', 'recipient']) as $row) {
                $key = mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', (string) $row->recipient)));
                \Illuminate\Support\Facades\DB::table('erp_gantungan')->where('id', $row->id)->update(['recipient_key' => mb_substr($key, 0, 150)]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_gantungan_payments');

        if (Schema::hasTable('erp_gantungan')) {
            Schema::table('erp_gantungan', function (Blueprint $table) {
                foreach (['recipient_key', 'created_by_name', 'category'] as $column) {
                    if (Schema::hasColumn('erp_gantungan', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
