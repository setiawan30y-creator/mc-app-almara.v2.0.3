<?php
// @2026-Alifiandra — nilai stok valas (Rp) yang dibekukan saat closing disimpan/dikunci.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('erp_cash_closing_valuations')) {
            return;
        }
        Schema::create('erp_cash_closing_valuations', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('closing_id')->index();
            $t->string('currency_code', 20);
            $t->decimal('system_qty', 20, 6)->default(0);
            $t->decimal('rate', 20, 6)->default(0);
            $t->decimal('value', 20, 2)->default(0);
            $t->timestamps();
            $t->unique(['closing_id', 'currency_code']);
        });

        // Closing yang sudah dikunci sebelumnya: bekukan nilai valas akhir harinya sekarang.
        if (Schema::hasTable('erp_cash_closings')) {
            $svc = new \App\Services\Erp\ValasValuation();
            foreach (\App\Models\ErpCashClosing::query()->where('status', 'CLOSED')->get() as $c) {
                $svc->freeze($c, $c->closing_date->toDateString());
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_cash_closing_valuations');
    }
};
