<?php
// @2026-Alifiandra
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('mc_hris_pins')) {
            Schema::create('mc_hris_pins', function (Blueprint $table) {
                $table->id();
                $table->string('nik', 100)->unique();
                $table->string('pin_hash', 255);
                $table->unsignedSmallInteger('failed_attempts')->default(0);
                $table->timestamp('locked_until')->nullable();
                $table->timestamps();
            });
        }

        // Pindahkan PIN lama (teks biasa) di data karyawan menjadi hash, lalu hapus dari data.
        $row = DB::table('mc_datastore')->where('store_key', 'mc_hris_employees')->first();
        if (!$row) {
            return;
        }
        $list = json_decode((string) $row->json_data, true);
        if (is_string($list)) {
            $list = json_decode($list, true);
        }
        if (!is_array($list)) {
            return;
        }
        foreach ($list as $i => $emp) {
            if (!is_array($emp)) {
                continue;
            }
            $nik = trim((string) ($emp['nik'] ?? ''));
            $pin = (string) ($emp['pin'] ?? '');
            if ($nik !== '' && preg_match('/^\d{4}$/', $pin)
                && !DB::table('mc_hris_pins')->where('nik', $nik)->exists()) {
                DB::table('mc_hris_pins')->insert([
                    'nik' => $nik,
                    'pin_hash' => Hash::make($pin),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            unset($list[$i]['pin']);
        }
        DB::table('mc_datastore')->where('store_key', 'mc_hris_employees')
            ->update(['json_data' => json_encode(array_values($list), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    }

    public function down(): void
    {
        Schema::dropIfExists('mc_hris_pins');
    }
};
