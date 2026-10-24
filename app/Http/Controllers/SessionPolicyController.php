<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\Datastore;
use App\Support\SessionPolicy;
use Illuminate\Http\Request;

/**
 * Pengaturan logout otomatis (tidak aktif) + denyut aktivitas dari browser.
 *
 * Hanya POST /session/ping yang memperbarui "aktivitas terakhir" di server.
 * Polling sinkronisasi otomatis sengaja tidak dihitung sebagai aktivitas
 * pengguna, kalau tidak sesi tidak akan pernah berakhir.
 */
class SessionPolicyController extends Controller
{
    public function show(Request $request)
    {
        $role = strtolower((string) ($request->user()?->role ?? ''));
        $policy = SessionPolicy::get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'policy' => $policy,
                'effective_idle_seconds' => SessionPolicy::idleSecondsFor($role),
                'warn_seconds' => SessionPolicy::WARN_SECONDS,
                'can_edit' => in_array($role, SessionPolicy::EDITOR_ROLES, true),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'idle_minutes' => ['required', 'integer', 'min:5', 'max:720'],
            'courier_idle_minutes' => ['required', 'integer', 'min:5', 'max:1440'],
        ]);

        $actor = $request->user();
        $data = [
            'enabled' => (bool) $validated['enabled'],
            'idle_minutes' => (int) $validated['idle_minutes'],
            'courier_idle_minutes' => (int) $validated['courier_idle_minutes'],
            'updated_by' => (string) ($actor?->username ?? ''),
            'updated_at' => now()->toIso8601String(),
        ];

        Datastore::updateOrCreate(
            ['store_key' => SessionPolicy::KEY],
            ['json_data' => $data]
        );
        SessionPolicy::forget();

        return response()->json([
            'status' => 'success',
            'message' => 'Pengaturan keamanan sesi tersimpan.',
            'data' => [
                'policy' => SessionPolicy::get(),
                'effective_idle_seconds' => SessionPolicy::idleSecondsFor((string) ($actor?->role ?? '')),
                'warn_seconds' => SessionPolicy::WARN_SECONDS,
                'can_edit' => true,
            ],
        ]);
    }

    public function ping(Request $request)
    {
        // Pemeriksaan idle sudah dilakukan middleware sebelum sampai sini;
        // sesi yang kedaluwarsa tidak bisa "dihidupkan lagi" lewat ping.
        $request->session()->put('mc_last_activity', time());

        return response()->json(['status' => 'success']);
    }
}
