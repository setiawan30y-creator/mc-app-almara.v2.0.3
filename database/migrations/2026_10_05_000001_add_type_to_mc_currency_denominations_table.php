<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mc_currency_denominations', function (Blueprint $table) {
            $table->string('type', 20)->default('banknote')->after('denomination');
        });

        // Keep the existing unique index because an existing foreign key depends on it.
        Schema::table('mc_currency_denominations', function (Blueprint $table) {
            $table->unique(
                ['currency_code', 'type', 'denomination'],
                'mc_currency_denoms_code_type_denom_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('mc_currency_denominations', function (Blueprint $table) {
            $table->dropUnique('mc_currency_denoms_code_type_denom_unique');
            $table->dropColumn('type');
        });
    }
};
