<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Penanam Saham (investor):
 *  - erp_investors                  : profil investor, hak persentase, status.
 *  - erp_investor_capital_movements : riwayat setor / tarik modal. Modal disetor = total setor - total tarik.
 *
 * Tabel ini berupa catatan. Tidak ada mutasi ledger kas/bank dari sini.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('erp_investors')) {
            Schema::create('erp_investors', function (Blueprint $table) {
                $table->id();
                $table->string('code', 20)->unique();
                $table->string('name', 150);
                $table->string('type', 20)->default('PERORANGAN');
                $table->string('id_number', 40)->nullable();
                $table->string('phone', 40)->nullable();
                $table->string('email', 150)->nullable();
                $table->string('address', 255)->nullable();
                $table->date('join_date')->nullable();
                $table->string('status', 15)->default('AKTIF')->index();
                $table->decimal('share_percent', 7, 4)->default(0);
                $table->text('notes')->nullable();
                $table->string('created_by_name', 150)->nullable();
                $table->string('updated_by_name', 150)->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('erp_investor_capital_movements')) {
            Schema::create('erp_investor_capital_movements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('investor_id')->constrained('erp_investors')->cascadeOnDelete();
                $table->string('type', 10); // SETOR | TARIK
                $table->decimal('amount', 18, 2);
                $table->date('occurred_on');
                $table->string('note', 255)->nullable();
                $table->string('created_by_name', 150)->nullable();
                $table->timestamps();
                $table->index(['investor_id', 'occurred_on']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_investor_capital_movements');
        Schema::dropIfExists('erp_investors');
    }
};
