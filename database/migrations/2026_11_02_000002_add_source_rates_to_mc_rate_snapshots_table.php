<?php
// @2026-Alifiandra
// Riwayat Kurs: simpan juga kurs sumber dan selisih (margin), selain kurs hasil.
// Kurs hasil = kurs sumber + selisih.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $cols = ['base_buy', 'margin_buy', 'base_sell', 'margin_sell'];

    public function up(): void
    {
        if (!Schema::hasTable('mc_rate_snapshots')) {
            return;
        }

        Schema::table('mc_rate_snapshots', function (Blueprint $table) {
            $after = 'currency_label';
            foreach ($this->cols as $col) {
                if (!Schema::hasColumn('mc_rate_snapshots', $col)) {
                    $table->decimal($col, 20, 4)->nullable()->after($after);
                }
                $after = $col;
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('mc_rate_snapshots')) {
            return;
        }
        Schema::table('mc_rate_snapshots', function (Blueprint $table) {
            foreach ($this->cols as $col) {
                if (Schema::hasColumn('mc_rate_snapshots', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
