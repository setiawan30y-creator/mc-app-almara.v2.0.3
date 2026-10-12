<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMcTransactionsAuditTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('mc_transactions_audit', function (Blueprint $table) {
            $table->string('itemId', 100)->primary();
            $table->string('id', 50)->index();
            $table->dateTime('timestamp');
            $table->string('kasir', 100)->nullable();
            $table->string('tipe', 20);
            $table->string('valuta', 10);
            $table->double('nominal');
            $table->double('rate');
            $table->double('total');
            $table->string('paymentMethod', 50)->nullable();
            $table->string('customerName', 255)->nullable();
            $table->string('id_cif', 50)->nullable();
            $table->boolean('isOldMoney')->default(false);
            $table->text('keterangan')->nullable();
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
        Schema::dropIfExists('mc_transactions_audit');
    }
}
