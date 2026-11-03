<?php
// @2026-Alifiandra
// Pencarian Dokumen (tanpa AI): indeks teks berkas dari Penyimpanan Berkas & arsip Nomor Surat.
// Sumber Regulasi memakai indeks miliknya sendiri (mc_regulatory_chunks).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('mc_search_files')) {
            Schema::create('mc_search_files', function (Blueprint $table) {
                $table->id();
                $table->string('source', 20);                 // berkas | surat
                $table->string('source_key', 120);            // id berkas / id dokumen surat
                $table->string('title', 255);
                $table->string('subtitle', 255)->nullable();  // folder / nomor surat + perihal
                $table->string('file_url', 500)->nullable();
                $table->string('extension', 12)->nullable();
                $table->unsignedBigInteger('size_bytes')->default(0);
                $table->string('file_sig', 64)->nullable();   // ukuran + waktu ubah berkas
                $table->date('doc_date')->nullable();
                $table->json('meta')->nullable();
                $table->string('status', 20)->default('pending')->index(); // pending|ready|needs_ocr|empty|unsupported|missing|error
                $table->string('method', 20)->nullable();     // teks|pdftotext|ocr
                $table->string('error', 500)->nullable();
                $table->unsignedInteger('chunk_count')->default(0);
                $table->timestamp('indexed_at')->nullable();
                $table->timestamps();
                $table->unique(['source', 'source_key']);
            });
        }
        if (!Schema::hasTable('mc_search_chunks')) {
            Schema::create('mc_search_chunks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('file_id')->index();
                $table->unsignedInteger('position')->default(0);
                $table->string('ref', 120)->nullable();
                $table->mediumText('content');
            });
        }
        if (!Schema::hasTable('mc_search_terms')) {
            Schema::create('mc_search_terms', function (Blueprint $table) {
                $table->string('term', 40)->primary();     // kosakata untuk koreksi salah ketik
                $table->unsignedInteger('df')->default(0);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_search_terms');
        Schema::dropIfExists('mc_search_chunks');
        Schema::dropIfExists('mc_search_files');
    }
};
