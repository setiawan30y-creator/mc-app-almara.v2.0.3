<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // This migration must be safe on installations where the ERP stock
        // tables were created by an earlier deployment but the migration
        // record was not persisted.
        if (!Schema::hasTable('erp_currency_stocks')) {
            Schema::create('erp_currency_stocks', function (Blueprint $table) {
                $table->id();
                $table->string('currency_code', 3);
                $table->decimal('quantity', 24, 8)->default(0);
                $table->string('status', 20)->default('active');
                $table->timestamps();
                $table->unique('currency_code');
                $table->index(['currency_code', 'status']);
            });
        }

        if (!Schema::hasTable('erp_currency_stock_movements')) {
            Schema::create('erp_currency_stock_movements', function (Blueprint $table) {
                $table->id();
                $table->string('movement_ref', 80)->unique();
                $table->foreignId('currency_stock_id')->constrained('erp_currency_stocks')->cascadeOnDelete();
                $table->string('transaction_ref', 80)->nullable()->index();
                $table->string('movement_type', 20);
                $table->decimal('quantity', 24, 8);
                $table->decimal('balance_after', 24, 8);
                $table->string('currency_code', 3);
                $table->string('idempotency_key', 100)->unique();
                $table->json('metadata')->nullable();
                $table->timestamp('posted_at')->useCurrent();
                $table->timestamps();
                $table->index(['transaction_ref', 'movement_type']);
            });
        }

        if (!Schema::hasTable('erp_settlements')) {
            Schema::create('erp_settlements', function (Blueprint $table) {
                $table->id();
                $table->string('settlement_ref', 80)->unique();
                $table->string('transaction_ref', 80)->index();
                $table->string('status', 20)->default('pending');
                $table->timestamp('settled_at')->nullable();
                $table->foreignId('settled_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->unique(['transaction_ref', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_settlements');
        Schema::dropIfExists('erp_currency_stock_movements');
        Schema::dropIfExists('erp_currency_stocks');
    }
};
