<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMcCurrenciesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('mc_currencies', function (Blueprint $table) {
            $table->string('code', 10)->primary();
            $table->string('label', 100);
            $table->double('buy')->default(0);
            $table->double('sell')->default(0);
            $table->double('stock')->default(0);
            $table->longText('raw_json')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('mc_currencies');
    }
}
