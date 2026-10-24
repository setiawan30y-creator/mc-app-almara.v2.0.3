<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Serah Terima / Pickup valas oleh kurir.
 *  - erp_pickups          : penugasan kurir, status, tujuan (+koordinat), posisi terakhir kurir.
 *  - erp_pickup_items     : valas yang dibawa (estimasi dan realisasi kurs).
 *  - erp_pickup_events    : riwayat status (siapa, kapan, di mana).
 *  - erp_pickup_locations : jejak GPS kurir (untuk peta realtime).
 *
 * Stok valas keluar dari brankas saat kurir memulai perjalanan (ON_THE_WAY) dan baru menjadi
 * penjualan resmi saat staf menyelesaikan pickup (COMPLETED). Jika batal, stok dikembalikan.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('erp_pickups')) {
            Schema::create('erp_pickups', function (Blueprint $table) {
                $table->id();
                $table->string('pickup_no', 30)->unique();
                $table->string('status', 20)->index(); // REQUESTED, ON_THE_WAY, DELIVERED, COMPLETED, CANCELLED, RETURNED
                $table->string('courier_user_id', 50)->nullable()->index();
                $table->string('courier_name', 150);
                $table->string('vehicle_type', 20)->nullable();
                $table->string('vehicle_plate', 20)->nullable();
                $table->string('destination', 255);
                $table->decimal('dest_lat', 10, 7)->nullable();
                $table->decimal('dest_lng', 10, 7)->nullable();
                $table->string('customer_name', 150)->nullable();
                $table->string('customer_phone', 40)->nullable();
                $table->text('notes')->nullable();
                $table->string('sender_name', 150)->nullable();
                $table->decimal('estimated_total_idr', 18, 2)->default(0);
                $table->decimal('realized_total_idr', 18, 2)->nullable();
                $table->string('pin_hash', 100);
                $table->unsignedTinyInteger('pin_attempts')->default(0);
                $table->string('photo_pickup', 255)->nullable();
                $table->string('photo_proof', 255)->nullable();
                $table->string('recipient_name', 150)->nullable();
                $table->string('settle_to', 10)->nullable(); // CASH | BCA | MANDIRI
                $table->string('invoice_no', 30)->nullable()->index();
                $table->dateTime('picked_up_at')->nullable();
                $table->dateTime('delivered_at')->nullable();
                $table->dateTime('completed_at')->nullable();
                $table->dateTime('cancelled_at')->nullable();
                $table->string('cancel_reason', 255)->nullable();
                $table->decimal('last_lat', 10, 7)->nullable();
                $table->decimal('last_lng', 10, 7)->nullable();
                $table->decimal('last_accuracy', 9, 2)->nullable();
                $table->decimal('last_speed', 9, 2)->nullable();
                $table->decimal('last_heading', 6, 2)->nullable();
                $table->dateTime('last_seen_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('erp_pickup_items')) {
            Schema::create('erp_pickup_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pickup_id')->constrained('erp_pickups')->cascadeOnDelete();
                $table->string('currency_code', 10);
                $table->decimal('amount', 18, 4);
                $table->decimal('estimated_rate', 18, 4);
                $table->decimal('estimated_total', 18, 2);
                $table->decimal('realized_rate', 18, 4)->nullable();
                $table->decimal('realized_total', 18, 2)->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('erp_pickup_events')) {
            Schema::create('erp_pickup_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pickup_id')->constrained('erp_pickups')->cascadeOnDelete();
                $table->string('status', 20);
                $table->string('actor_name', 150)->nullable();
                $table->string('note', 255)->nullable();
                $table->decimal('lat', 10, 7)->nullable();
                $table->decimal('lng', 10, 7)->nullable();
                $table->timestamp('created_at')->useCurrent();
            });
        }

        if (!Schema::hasTable('erp_pickup_locations')) {
            Schema::create('erp_pickup_locations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('pickup_id')->constrained('erp_pickups')->cascadeOnDelete();
                $table->decimal('lat', 10, 7);
                $table->decimal('lng', 10, 7);
                $table->decimal('accuracy', 9, 2)->nullable();
                $table->decimal('speed', 9, 2)->nullable();
                $table->dateTime('recorded_at');
                $table->index(['pickup_id', 'recorded_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_pickup_locations');
        Schema::dropIfExists('erp_pickup_events');
        Schema::dropIfExists('erp_pickup_items');
        Schema::dropIfExists('erp_pickups');
    }
};
