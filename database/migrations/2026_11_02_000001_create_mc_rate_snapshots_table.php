<?php
// @2026-Alifiandra
// Riwayat kurs untuk kebutuhan audit Bank Indonesia.
// Satu baris = kurs beli/jual satu valuta pada satu waktu pencatatan.
// Data bersifat arsip: tidak ada fitur ubah/hapus dari aplikasi.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('mc_rate_snapshots')) {
            return;
        }

        Schema::create('mc_rate_snapshots', function (Blueprint $table) {
            $table->id();
            $table->dateTime('taken_at')->index();            // waktu sebenarnya dicatat
            $table->dateTime('slot')->nullable();              // jam jadwal (untuk pencatatan terjadwal)
            $table->string('source', 12)->index();             // jadwal | manual | perubahan
            $table->string('currency_code', 20)->index();
            $table->string('currency_label', 100)->nullable();
            $table->decimal('buy', 20, 4)->default(0);
            $table->decimal('sell', 20, 4)->default(0);
            $table->decimal('prev_buy', 20, 4)->nullable();    // khusus "perubahan": kurs sebelum diubah
            $table->decimal('prev_sell', 20, 4)->nullable();
            $table->string('recorded_by', 100)->nullable();    // username; kosong = sistem (terjadwal)
            $table->timestamp('created_at')->nullable();

            // Mencegah pencatatan terjadwal ganda untuk jam & valuta yang sama.
            $table->unique(['source', 'slot', 'currency_code'], 'mc_rate_snapshots_slot_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_rate_snapshots');
    }
};
