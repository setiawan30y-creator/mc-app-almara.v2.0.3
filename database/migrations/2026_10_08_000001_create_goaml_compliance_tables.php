<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goaml_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 180);
            $table->string('code', 80)->unique();
            $table->string('rule_type', 40)->default('INTERNAL_MONITORING');
            $table->string('target', 40)->default('CUSTOMER');
            $table->string('classification', 20)->nullable();
            $table->string('severity', 20)->default('WARNING');
            $table->string('action', 30)->default('REVIEW');
            $table->unsignedInteger('min_transactions')->nullable();
            $table->unsignedInteger('period_days')->nullable();
            $table->decimal('total_amount_idr', 20, 2)->nullable();
            $table->string('amount_operator', 5)->default('>');
            $table->string('payment_method', 50)->nullable();
            $table->json('conditions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('priority')->default(100);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });

        Schema::create('goaml_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rule_id')->nullable()->constrained('goaml_rules')->nullOnDelete();
            $table->string('alert_no', 60)->unique();
            $table->string('rule_type', 40);
            $table->string('classification', 20)->nullable();
            $table->string('severity', 20)->default('WARNING');
            $table->string('status', 30)->default('OPEN');
            $table->string('customer_id', 80)->nullable()->index();
            $table->string('customer_name', 255)->nullable();
            $table->decimal('total_amount_idr', 20, 2)->default(0);
            $table->unsignedInteger('transaction_count')->default(0);
            $table->dateTime('period_start')->nullable();
            $table->dateTime('period_end')->nullable();
            $table->text('reason')->nullable();
            $table->json('snapshot')->nullable();
            $table->string('reviewed_by', 120)->nullable();
            $table->dateTime('reviewed_at')->nullable();
            $table->text('review_note')->nullable();
            $table->timestamps();
        });

        Schema::create('goaml_alert_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained('goaml_alerts')->cascadeOnDelete();
            $table->string('transaction_item_id', 100);
            $table->string('transaction_invoice_id', 50)->nullable();
            $table->decimal('amount_idr', 20, 2)->default(0);
            $table->timestamps();
            $table->unique(['alert_id', 'transaction_item_id']);
        });

        DB::table('goaml_rules')->insert([
            'name' => 'Monitoring 3 Transaksi / 7 Hari > Rp500 Juta',
            'code' => 'IM-CUSTOMER-3TX-7D-500M',
            'rule_type' => 'INTERNAL_MONITORING',
            'target' => 'CUSTOMER',
            'classification' => 'INTERNAL_WARNING',
            'severity' => 'WARNING',
            'action' => 'REVIEW',
            'min_transactions' => 3,
            'period_days' => 7,
            'total_amount_idr' => 500000000,
            'amount_operator' => '>',
            'payment_method' => null,
            'conditions' => json_encode([
                'aggregation' => 'CUSTOMER',
                'amount_basis' => 'IDR_TOTAL',
                'logic' => 'AND',
            ]),
            'is_active' => true,
            'priority' => 100,
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('goaml_alert_transactions');
        Schema::dropIfExists('goaml_alerts');
        Schema::dropIfExists('goaml_rules');
    }
};