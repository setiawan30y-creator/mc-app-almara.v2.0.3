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
        Schema::table('mc_currencies', function (Blueprint $table) {

            $table->decimal('opening_stock', 18, 2)->default(0)->after('stock');

            $table->decimal('average_buy', 18, 2)->default(0)->after('opening_stock');

            $table->decimal('inventory_value', 18, 2)->default(0)->after('average_buy');

            $table->timestamp('last_buy_at')->nullable()->after('inventory_value');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mc_currencies', function (Blueprint $table) {

            $table->dropColumn([
                'opening_stock',
                'average_buy',
                'inventory_value',
                'last_buy_at',
            ]);

        });
    }
};