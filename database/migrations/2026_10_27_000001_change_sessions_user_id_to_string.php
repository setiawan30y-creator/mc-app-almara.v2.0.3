<?php

// @2026-Alifiandra
// ID pengguna di aplikasi ini berupa teks (mis. "u1"), sedangkan migrasi sessions bawaan
// membuat user_id sebagai BIGINT. Di MySQL mode strict, menyimpan sesi login gagal
// ("Incorrect integer value") sehingga pengguna selalu kembali ke halaman login.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('sessions') || !Schema::hasColumn('sessions', 'user_id')) {
            return;
        }

        Schema::table('sessions', function (Blueprint $table) {
            $table->string('user_id', 50)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Sengaja tidak dikembalikan ke BIGINT: ID pengguna berupa teks akan gagal tersimpan lagi.
    }
};
