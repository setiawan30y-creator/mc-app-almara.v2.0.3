<?php
// @2026-Alifiandra

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('mc_regulatory_documents', function (Blueprint $table) {
            if (!Schema::hasColumn('mc_regulatory_documents', 'issuer')) {
                $table->string('issuer', 30)->nullable()->index();
            }
            if (!Schema::hasColumn('mc_regulatory_documents', 'doc_type')) {
                $table->string('doc_type', 40)->nullable();
            }
            if (!Schema::hasColumn('mc_regulatory_documents', 'validity')) {
                $table->string('validity', 20)->default('berlaku')->index();
            }
            if (!Schema::hasColumn('mc_regulatory_documents', 'source_url')) {
                $table->string('source_url', 500)->nullable();
            }
            if (!Schema::hasColumn('mc_regulatory_documents', 'notes')) {
                $table->text('notes')->nullable();
            }
            if (!Schema::hasColumn('mc_regulatory_documents', 'chunk_count')) {
                $table->unsignedInteger('chunk_count')->default(0);
            }
            if (!Schema::hasColumn('mc_regulatory_documents', 'extracted_at')) {
                $table->timestamp('extracted_at')->nullable();
            }
        });

        if (!Schema::hasTable('mc_regulatory_chunks')) {
            Schema::create('mc_regulatory_chunks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('document_id')->index();
                $table->unsignedInteger('position')->default(0);
                $table->string('ref', 120)->nullable();
                $table->text('content');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_regulatory_chunks');
        Schema::table('mc_regulatory_documents', function (Blueprint $table) {
            foreach (['issuer', 'doc_type', 'validity', 'source_url', 'notes', 'chunk_count', 'extracted_at'] as $col) {
                if (Schema::hasColumn('mc_regulatory_documents', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
