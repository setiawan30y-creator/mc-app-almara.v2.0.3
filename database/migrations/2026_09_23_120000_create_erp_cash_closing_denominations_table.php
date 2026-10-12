<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('erp_cash_closing_denominations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('closing_id')->constrained('erp_cash_closings')->cascadeOnDelete();
            $table->string('currency_code', 3)->default('IDR');
            $table->unsignedBigInteger('denomination');
            $table->unsignedInteger('quantity')->default(0);
            $table->decimal('amount', 24, 2)->default(0);
            $table->timestamps();

            $table->unique(['closing_id', 'currency_code', 'denomination'], 'erp_closing_denom_unique');
            $table->index(['closing_id', 'currency_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_cash_closing_denominations');
    }
};
