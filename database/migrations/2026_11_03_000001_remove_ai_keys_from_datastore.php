<?php
// @2026-Alifiandra
// API key AI (Gemini / OpenAI) seharusnya hanya tersimpan di peramban tiap perangkat.
// Versi lama ikut menyinkronkannya ke mc_datastore; hapus salinan yang terlanjur tersimpan di server.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('mc_datastore')) {
            return;
        }
        DB::table('mc_datastore')
            ->whereIn('store_key', ['mc_gemini_api_key', 'mc_openai_api_key', 'mc_openai_model', 'mc_ai_provider'])
            ->delete();
    }

    public function down(): void
    {
        // Tidak dipulihkan: key tidak boleh disimpan di server.
    }
};
