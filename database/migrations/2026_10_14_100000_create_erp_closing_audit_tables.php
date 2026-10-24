<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pelengkap Closing Harian:
 *  - erp_cash_closing_stock_counts : hasil hitung fisik stok valas saat closing.
 *  - erp_cash_closing_logs         : jejak audit (siapa menyimpan, mengunci, atau membuka kembali).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('erp_cash_closing_stock_counts')) {
            Schema::create('erp_cash_closing_stock_counts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('closing_id')->constrained('erp_cash_closings')->cascadeOnDelete();
                $table->string('currency_code', 10);
                $table->decimal('system_qty', 24, 8)->default(0);
                $table->decimal('physical_qty', 24, 8)->default(0);
                $table->decimal('difference', 24, 8)->default(0);
                $table->decimal('rate', 24, 8)->default(0);
                $table->decimal('difference_value', 24, 2)->default(0);
                $table->timestamps();
                $table->unique(['closing_id', 'currency_code'], 'erp_closing_stock_unique');
            });
        }

        if (!Schema::hasTable('erp_cash_closing_logs')) {
            Schema::create('erp_cash_closing_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('closing_id')->nullable()->index();
                $table->date('closing_date')->index();
                $table->string('action', 30);
                $table->string('user_id', 50)->nullable();
                $table->string('user_name', 150)->nullable();
                $table->json('detail')->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_cash_closing_logs');
        Schema::dropIfExists('erp_cash_closing_stock_counts');
    }
};
