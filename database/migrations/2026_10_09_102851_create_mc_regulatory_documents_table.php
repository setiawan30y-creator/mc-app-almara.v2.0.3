<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('mc_regulatory_documents', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->string('original_name', 255);
            $table->string('storage_path', 500);
            $table->string('mime_type', 150)->nullable();
            $table->string('extension', 20)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->char('sha256', 64)->nullable()->index();
            $table->string('regulation_number', 150)->nullable();
            $table->date('effective_date')->nullable();
            $table->string('status', 30)->default('pending')->index();
            $table->longText('extracted_text')->nullable();
            $table->json('source_metadata')->nullable();
            $table->text('processing_error')->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();
            $table->index('title');
            $table->index('regulation_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_regulatory_documents');
    }
};
