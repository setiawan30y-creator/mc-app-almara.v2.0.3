<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mc_backup_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(true);
            $table->string('frequency', 30)->default('daily');
            $table->string('run_at', 5)->default('02:00');
            $table->unsignedInteger('retention_days')->default(30);
            $table->string('scope', 30)->default('database');
            $table->string('timezone', 64)->default('Asia/Jakarta');
            $table->timestamps();
        });

        Schema::create('mc_backup_logs', function (Blueprint $table) {
            $table->id();
            $table->string('filename', 255);
            $table->string('type', 20)->default('manual');
            $table->string('scope', 30)->default('database');
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('checksum', 64)->nullable();
            $table->string('status', 20)->default('queued');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['type', 'created_at']);
        });

        DB::table('mc_backup_settings')->insert([
            'enabled' => true,
            'frequency' => 'daily',
            'run_at' => '02:00',
            'retention_days' => 30,
            'scope' => 'database',
            'timezone' => 'Asia/Jakarta',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_backup_logs');
        Schema::dropIfExists('mc_backup_settings');
    }
};
