<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mc_currency_denominations', function (Blueprint $table) {
            $table->id();
            $table->string('currency_code', 10);
            $table->decimal('denomination', 20, 4);
            $table->decimal('buy', 20, 4)->default(0);
            $table->decimal('sell', 20, 4)->default(0);
            $table->decimal('margin_buy', 20, 4)->default(0);
            $table->decimal('margin_sell', 20, 4)->default(0);
            $table->decimal('stock', 20, 4)->default(0);
            $table->decimal('alert_stock', 20, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['currency_code', 'denomination'], 'mc_currency_denoms_code_denom_unique');
            $table->foreign('currency_code')
                ->references('code')
                ->on('mc_currencies')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_currency_denominations');
    }
};
