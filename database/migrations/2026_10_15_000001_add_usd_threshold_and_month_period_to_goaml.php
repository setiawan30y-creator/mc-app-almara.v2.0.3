<?php
// @2026-Alifiandra

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goaml_rules', function (Blueprint $table) {
            // Periode: DAY = jendela berjalan N hari; MONTH = N bulan kalender (awal bulan s.d. transaksi pemicu).
            $table->string('period_unit', 10)->default('DAY')->after('period_days');
            // Satuan ambang nominal: IDR memakai total_amount_idr, USD memakai amount_usd (ekuivalen USD).
            $table->string('amount_unit', 10)->default('IDR')->after('total_amount_idr');
            $table->decimal('amount_usd', 20, 2)->nullable()->after('amount_unit');
        });

        Schema::table('goaml_alerts', function (Blueprint $table) {
            $table->decimal('total_amount_usd', 20, 2)->nullable()->after('total_amount_idr');
        });
    }

    public function down(): void
    {
        Schema::table('goaml_alerts', function (Blueprint $table) {
            $table->dropColumn('total_amount_usd');
        });

        Schema::table('goaml_rules', function (Blueprint $table) {
            $table->dropColumn(['period_unit', 'amount_unit', 'amount_usd']);
        });
    }
};
