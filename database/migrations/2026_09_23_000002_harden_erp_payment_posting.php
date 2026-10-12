<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('erp_payments')) {
            return;
        }

        Schema::table('erp_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('erp_payments', 'transaction_ref')) {
                $table->string('transaction_ref', 100)->nullable()->index();
            }

            if (!Schema::hasColumn('erp_payments', 'idempotency_key')) {
                $table->string('idempotency_key', 100)->nullable()->unique();
            }

            if (!Schema::hasColumn('erp_payments', 'direction')) {
                $table->string('direction', 10)->default('in')->index();
            }
        });

        if (Schema::hasTable('erp_cash_movements') && !Schema::hasColumn('erp_cash_movements', 'idempotency_key')) {
            Schema::table('erp_cash_movements', function (Blueprint $table) {
                $table->string('idempotency_key', 100)->nullable()->unique();
            });
        }

        if (Schema::hasTable('erp_bank_movements') && !Schema::hasColumn('erp_bank_movements', 'idempotency_key')) {
            Schema::table('erp_bank_movements', function (Blueprint $table) {
                $table->string('idempotency_key', 100)->nullable()->unique();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('erp_bank_movements') && Schema::hasColumn('erp_bank_movements', 'idempotency_key')) {
            Schema::table('erp_bank_movements', function (Blueprint $table) {
                $table->dropUnique(['idempotency_key']);
                $table->dropColumn('idempotency_key');
            });
        }

        if (Schema::hasTable('erp_cash_movements') && Schema::hasColumn('erp_cash_movements', 'idempotency_key')) {
            Schema::table('erp_cash_movements', function (Blueprint $table) {
                $table->dropUnique(['idempotency_key']);
                $table->dropColumn('idempotency_key');
            });
        }

        if (Schema::hasTable('erp_payments')) {
            Schema::table('erp_payments', function (Blueprint $table) {
                if (Schema::hasColumn('erp_payments', 'direction')) {
                    $table->dropIndex(['direction']);
                    $table->dropColumn('direction');
                }
                if (Schema::hasColumn('erp_payments', 'idempotency_key')) {
                    $table->dropUnique(['idempotency_key']);
                    $table->dropColumn('idempotency_key');
                }
                if (Schema::hasColumn('erp_payments', 'transaction_ref')) {
                    $table->dropIndex(['transaction_ref']);
                    $table->dropColumn('transaction_ref');
                }
            });
        }
    }
};
