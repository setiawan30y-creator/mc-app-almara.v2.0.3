<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('erp_cash_accounts')) {
            Schema::create('erp_cash_accounts', function (Blueprint $table) {
                $table->id();
                $table->string('code', 50)->unique();
                $table->string('name');
                $table->string('currency_code', 10)->default('IDR');
                $table->decimal('opening_balance', 24, 8)->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('erp_bank_accounts')) {
            Schema::create('erp_bank_accounts', function (Blueprint $table) {
                $table->id();
                $table->string('code', 50)->unique();
                $table->string('bank_name');
                $table->string('account_name')->nullable();
                $table->string('account_number')->nullable();
                $table->string('currency_code', 10)->default('IDR');
                $table->decimal('opening_balance', 24, 8)->default(0);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('erp_payments')) {
            Schema::create('erp_payments', function (Blueprint $table) {
                $table->id();
                $table->string('payment_no', 50)->unique();
                $table->unsignedBigInteger('transaction_id')->nullable()->index();
                $table->string('method', 30);
                $table->string('currency_code', 10)->default('IDR');
                $table->decimal('amount', 24, 8);
                $table->unsignedBigInteger('cash_account_id')->nullable()->index();
                $table->unsignedBigInteger('bank_account_id')->nullable()->index();
                $table->string('reference')->nullable();
                $table->string('status', 30)->default('posted');
                $table->timestamp('paid_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('cash_account_id')->references('id')->on('erp_cash_accounts')->nullOnDelete();
                $table->foreign('bank_account_id')->references('id')->on('erp_bank_accounts')->nullOnDelete();
            });
        }

        if (!Schema::hasTable('erp_cash_movements')) {
            Schema::create('erp_cash_movements', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cash_account_id')->index();
                $table->string('movement_no', 50)->unique();
                $table->string('direction', 10);
                $table->decimal('amount', 24, 8);
                $table->string('currency_code', 10)->default('IDR');
                $table->string('reference_type')->nullable();
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->text('description')->nullable();
                $table->timestamp('posted_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable()->index();
                $table->timestamps();
                $table->foreign('cash_account_id')->references('id')->on('erp_cash_accounts')->cascadeOnDelete();
                $table->index(['reference_type', 'reference_id']);
            });
        }

        if (!Schema::hasTable('erp_bank_movements')) {
            Schema::create('erp_bank_movements', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('bank_account_id')->index();
                $table->string('movement_no', 50)->unique();
                $table->string('direction', 10);
                $table->decimal('amount', 24, 8);
                $table->string('currency_code', 10)->default('IDR');
                $table->string('reference_type')->nullable();
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->string('bank_reference')->nullable();
                $table->text('description')->nullable();
                $table->timestamp('posted_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable()->index();
                $table->timestamps();
                $table->foreign('bank_account_id')->references('id')->on('erp_bank_accounts')->cascadeOnDelete();
                $table->index(['reference_type', 'reference_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_bank_movements');
        Schema::dropIfExists('erp_cash_movements');
        Schema::dropIfExists('erp_payments');
        Schema::dropIfExists('erp_bank_accounts');
        Schema::dropIfExists('erp_cash_accounts');
    }
};
