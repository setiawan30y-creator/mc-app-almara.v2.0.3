<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('erp_gantungan', function (Blueprint $table) {
            if (!Schema::hasColumn('erp_gantungan', 'created_by')) {
                $table->unsignedBigInteger('created_by')->nullable()->after('returned_by');
            }
            if (!Schema::hasColumn('erp_gantungan', 'updated_by')) {
                $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');
            }
        });

        Schema::table('erp_cash_closings', function (Blueprint $table) {
            if (!Schema::hasColumn('erp_cash_closings', 'created_by')) {
                $table->unsignedBigInteger('created_by')->nullable()->after('closed_at');
            }
            if (!Schema::hasColumn('erp_cash_closings', 'updated_by')) {
                $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('erp_cash_closings', function (Blueprint $table) {
            if (Schema::hasColumn('erp_cash_closings', 'updated_by')) {
                $table->dropColumn('updated_by');
            }
            if (Schema::hasColumn('erp_cash_closings', 'created_by')) {
                $table->dropColumn('created_by');
            }
        });

        Schema::table('erp_gantungan', function (Blueprint $table) {
            if (Schema::hasColumn('erp_gantungan', 'updated_by')) {
                $table->dropColumn('updated_by');
            }
            if (Schema::hasColumn('erp_gantungan', 'created_by')) {
                $table->dropColumn('created_by');
            }
        });
    }
};
