<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('goaml_ltkm_reports', function (Blueprint $table) {
            $table->id();

            // Sumber draft LTKM
            $table->foreignId('alert_id')
                ->constrained('goaml_alerts')
                ->cascadeOnDelete();

            // Nomor draft internal
            $table->string('report_no', 100)->unique();

            // Status draft
            // DRAFT -> REVIEWED -> READY
            $table->string('status', 30)->default('DRAFT');

            // Data customer pada saat draft dibuat
            $table->string('customer_id', 100)->nullable();
            $table->string('customer_name')->nullable();

            // Ringkasan transaksi
            $table->decimal('total_amount_idr', 20, 2)->default(0);
            $table->unsignedInteger('transaction_count')->default(0);

            // Periode transaksi yang menjadi dasar alert
            $table->dateTime('period_start')->nullable();
            $table->dateTime('period_end')->nullable();

            // Snapshot data alert/rule/transaksi.
            // Tujuannya agar draft LTKM tidak berubah
            // ketika data operasional berubah di kemudian hari.
            $table->json('snapshot')->nullable();

            // Catatan compliance
            $table->text('review_note')->nullable();

            // User yang membuat / melakukan review draft
            $table->string('created_by')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->dateTime('reviewed_at')->nullable();

            $table->timestamps();

            $table->index('alert_id');
            $table->index('status');
            $table->index('customer_id');
            $table->index(['status', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('goaml_ltkm_reports');
    }
};