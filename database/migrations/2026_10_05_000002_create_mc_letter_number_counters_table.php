<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mc_letter_number_counters', function (Blueprint $table) {
            $table->id();
            $table->string('company_code', 20);
            $table->string('letter_type', 20);
            $table->unsignedInteger('year');
            $table->unsignedBigInteger('last_number')->default(0);
            $table->timestamps();
            $table->unique(['company_code', 'letter_type', 'year'], 'mc_letter_counter_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_letter_number_counters');
    }
};
