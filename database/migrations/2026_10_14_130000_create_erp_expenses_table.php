<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jurnal Keuangan (menu Pengeluaran) sebagai tabel MySQL.
 * bi_code = kode akun Laba/Rugi LKBU B0003 (01-25). Kas/bank tetap lewat ledger ERP.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('erp_expenses')) {
            return;
        }
        Schema::create('erp_expenses', function (Blueprint $table) {
            $table->id();
            $table->string('expense_no', 30)->unique();
            $table->string('type', 12)->index();          // PENGELUARAN | PENDAPATAN
            $table->string('bi_code', 2)->index();         // 01-25
            $table->string('category', 150)->nullable();   // label "07-Beban Gaji, ..."
            $table->string('description', 500)->nullable();
            $table->string('source', 50)->default('CASH'); // CASH | BCA | MANDIRI | ...
            $table->decimal('amount', 18, 2);
            $table->dateTime('occurred_at')->index();
            $table->string('created_by_name', 150)->nullable();
            $table->string('updated_by_name', 150)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['bi_code', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_expenses');
    }
};
