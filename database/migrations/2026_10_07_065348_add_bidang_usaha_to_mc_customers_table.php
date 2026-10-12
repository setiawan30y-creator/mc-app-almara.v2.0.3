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
        Schema::table('mc_customers', function (Blueprint $table) {
            $table->string('bidang_usaha')->nullable()->after('jenis_badan_usaha');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mc_customers', function (Blueprint $table) {
            $table->dropColumn('bidang_usaha');
        });
    }
};
