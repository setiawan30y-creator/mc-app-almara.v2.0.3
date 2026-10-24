<?php
// @2026-Alifiandra
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('mc_pt_representatives', function (Blueprint $table) {
            $table->id();
            $table->string('customer_id', 100)->index();      // id_nasabah PT (nasabah corporate)
            $table->string('role_type', 20)->index();         // signatory | executor | courier | other
            $table->string('name', 150);
            $table->string('position', 120)->nullable();      // jabatan
            $table->string('id_type', 20)->default('KTP');
            $table->text('id_number');                        // terenkripsi (cast 'encrypted')
            $table->text('phone')->nullable();                // terenkripsi
            $table->string('address', 500)->nullable();
            $table->string('authority_ref', 150)->nullable(); // no. PKS / surat kuasa
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->string('status', 10)->default('active')->index();
            $table->string('photo_url', 500)->nullable();
            $table->string('id_photo_url', 500)->nullable();
            $table->string('authority_doc_url', 500)->nullable();
            $table->string('notes', 1000)->nullable();
            $table->string('created_by', 100)->nullable();
            $table->string('updated_by', 100)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_pt_representatives');
    }
};
