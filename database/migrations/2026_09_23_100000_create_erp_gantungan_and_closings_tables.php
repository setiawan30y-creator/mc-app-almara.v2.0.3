<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('erp_gantungan', function (Blueprint $table) {
            $table->id();
            $table->string('reference_no', 40)->unique();
            $table->dateTime('occurred_at');
            $table->string('recipient', 150);
            $table->string('type', 40)->default('OUTSIDE_CASH');
            $table->decimal('amount_rp', 18, 2);
            $table->string('status', 20)->default('OUTSTANDING');
            $table->text('description')->nullable();
            $table->dateTime('returned_at')->nullable();
            $table->unsignedBigInteger('returned_by')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->index(['status', 'occurred_at']);
        });

        Schema::create('erp_cash_closings', function (Blueprint $table) {
            $table->id();
            $table->string('closing_no', 40)->unique();
            $table->date('closing_date')->unique();
            $table->decimal('opening_cash', 18, 2)->default(0);
            $table->decimal('cash_in', 18, 2)->default(0);
            $table->decimal('cash_out', 18, 2)->default(0);
            $table->decimal('expense', 18, 2)->default(0);
            $table->decimal('expected_cash', 18, 2)->default(0);
            $table->decimal('physical_cash', 18, 2)->default(0);
            $table->decimal('hanging_amount', 18, 2)->default(0);
            $table->decimal('accounted_cash', 18, 2)->default(0);
            $table->decimal('difference', 18, 2)->default(0);
            $table->string('status', 20)->default('DRAFT');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->dateTime('closed_at')->nullable();
            $table->timestamps();
            $table->index(['closing_date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_cash_closings');
        Schema::dropIfExists('erp_gantungan');
    }
};
