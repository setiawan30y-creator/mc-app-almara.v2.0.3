<?php
// @2026-Alifiandra
// Closing Harian: saldo rekening koran per bank (untuk rekonsiliasi terpadu kas + valas + bank).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('erp_cash_closing_bank_counts')) {
            return;
        }
        Schema::create('erp_cash_closing_bank_counts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('closing_id')->index();
            $table->unsignedBigInteger('bank_account_id');
            $table->decimal('system_balance', 20, 2)->default(0);
            $table->decimal('statement_balance', 20, 2)->default(0);
            $table->decimal('difference', 20, 2)->default(0);
            $table->timestamps();
            $table->unique(['closing_id', 'bank_account_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_cash_closing_bank_counts');
    }
};
