<?php
// @2026-Alifiandra
// Perizinan nasabah perusahaan (PT, CV, Yayasan, dll.): beberapa izin per nasabah,
// masing-masing dengan tanggal berakhir untuk pengingat jatuh tempo.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('mc_customer_licenses')) {
            return;
        }

        Schema::create('mc_customer_licenses', function (Blueprint $table) {
            $table->id();
            $table->string('customer_id', 100)->index();      // id_nasabah perusahaan
            $table->string('license_type', 30)->index();      // NIB, AKTA_PENDIRIAN, SK_KEMENKUMHAM, ...
            $table->string('license_name', 150)->nullable();  // nama izin (wajib untuk jenis LAINNYA)
            $table->string('number', 100)->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable()->index();  // kosong = berlaku tanpa batas
            $table->string('document_url', 500)->nullable();
            $table->string('notes', 1000)->nullable();
            $table->string('created_by', 100)->nullable();
            $table->string('updated_by', 100)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_customer_licenses');
    }
};
