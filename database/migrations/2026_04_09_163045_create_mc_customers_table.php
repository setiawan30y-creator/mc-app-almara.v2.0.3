<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMcCustomersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('mc_customers', function (Blueprint $table) {
            $table->string('internal_id', 50)->primary();
            $table->string('idpjk', 50)->default('-');
            $table->string('id_cif', 50)->nullable();
            $table->string('name', 255);
            $table->string('phone', 50)->nullable();
            $table->string('identity_type', 50)->nullable();
            $table->string('identity_number', 100)->nullable();
            $table->string('selain_ktp', 100)->default('-');
            $table->text('address')->nullable();
            $table->string('tempat_lahir', 100)->default('-');
            $table->string('tanggal_lahir', 50)->default('-');
            $table->string('npwp', 50)->default('-');
            $table->string('local_id', 50)->default('-');
            $table->string('jenis_kelamin', 20)->default('-');
            $table->string('warga_negara', 100)->default('-');
            $table->string('pekerjaan', 100)->default('-');
            $table->string('no_rekening', 100)->default('-');
            $table->date('registration_date')->nullable();
            $table->string('customer_type', 50)->default('1');
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
        Schema::dropIfExists('mc_customers');
    }
}
