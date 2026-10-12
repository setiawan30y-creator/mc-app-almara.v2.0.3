<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('erp_currency_stock_denominations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('currency_stock_id')->constrained('erp_currency_stocks')->cascadeOnDelete();
            $table->string('currency_code', 10);
            $table->decimal('denomination', 20, 8);
            $table->decimal('quantity', 20, 8)->default(0);
            $table->decimal('balance_value', 24, 8)->default(0);
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->unique(['currency_stock_id', 'denomination']);
            $table->index(['currency_code', 'denomination']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_currency_stock_denominations');
    }
};
