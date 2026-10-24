<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penomoran dokumen POS (INV, BKG) dialokasikan server secara atomik saat transaksi disubmit,
 * sehingga beberapa kasir / perangkat tidak pernah mendapat nomor yang sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('erp_document_counters')) {
            return;
        }
        Schema::create('erp_document_counters', function (Blueprint $table) {
            $table->string('prefix', 10)->primary();
            $table->unsignedBigInteger('last_seq')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_document_counters');
    }
};
