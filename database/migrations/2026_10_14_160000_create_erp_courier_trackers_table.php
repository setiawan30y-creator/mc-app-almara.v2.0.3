<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Token pelacak GPS per kurir (untuk aplikasi OwnTracks / Traccar Client di HP kurir). Hanya hash yang disimpan. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('erp_courier_trackers')) {
            return;
        }
        Schema::create('erp_courier_trackers', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 50)->unique();
            $table->string('token_hash', 64)->unique();
            $table->dateTime('last_ping_at')->nullable();
            $table->decimal('last_lat', 10, 7)->nullable();
            $table->decimal('last_lng', 10, 7)->nullable();
            $table->unsignedTinyInteger('battery')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_courier_trackers');
    }
};
