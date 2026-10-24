<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\HrisPin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * PIN absensi karyawan. Disimpan sebagai hash di tabel terpisah dan dicek di server
 * (dengan penguncian) sehingga tidak pernah dikirim ke browser.
 */
class HrisPinController extends Controller
{
    private const MAX_FAILS = 5;
    private const LOCK_SECONDS = 60;
    private const WEAK = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
        '1234', '4321', '2345', '3456', '4567', '5678', '6789', '0123', '1212', '2580', '1122', '0852'];

    /** Daftar NIK yang sudah punya PIN. */
    public function status()
    {
        return response()->json(['status' => 'success', 'niks' => HrisPin::query()->pluck('nik')->values()]);
    }

    /** Atur / ganti PIN (pengelola HRIS). */
    public function set(Request $request)
    {
        $data = $request->validate([
            'nik' => ['required', 'string', 'max:100'],
            'pin' => ['required', 'string', 'regex:/^\d{4}$/'],
        ], ['pin.regex' => 'PIN harus 4 angka.']);

        if (in_array($data['pin'], self::WEAK, true)) {
            return response()->json(['status' => 'error', 'message' => 'PIN terlalu mudah ditebak. Pilih PIN lain.'], 422);
        }
        HrisPin::updateOrCreate(
            ['nik' => trim($data['nik'])],
            ['pin_hash' => Hash::make($data['pin']), 'failed_attempts' => 0, 'locked_until' => null]
        );
        return response()->json(['status' => 'success']);
    }

    /** Periksa PIN saat Clock IN/OUT. */
    public function verify(Request $request)
    {
        $data = $request->validate([
            'nik' => ['required', 'string', 'max:100'],
            'pin' => ['required', 'string', 'max:20'],
        ]);
        $row = HrisPin::where('nik', trim($data['nik']))->first();
        if (!$row) {
            return response()->json(['status' => 'error', 'ok' => false, 'message' => 'PIN belum diatur untuk karyawan ini. Hubungi pengelola HRIS.'], 422);
        }
        if ($row->locked_until && $row->locked_until->isFuture()) {
            return response()->json(['status' => 'error', 'ok' => false, 'locked' => true,
                'retry_after' => max(1, now()->diffInSeconds($row->locked_until, false)),
                'message' => 'Terlalu banyak PIN salah. Coba lagi nanti.'], 429);
        }
        if (Hash::check($data['pin'], $row->pin_hash)) {
            $row->update(['failed_attempts' => 0, 'locked_until' => null]);
            return response()->json(['status' => 'success', 'ok' => true]);
        }
        $fails = (int) $row->failed_attempts + 1;
        if ($fails >= self::MAX_FAILS) {
            $row->update(['failed_attempts' => 0, 'locked_until' => now()->addSeconds(self::LOCK_SECONDS)]);
            return response()->json(['status' => 'error', 'ok' => false, 'locked' => true, 'retry_after' => self::LOCK_SECONDS,
                'message' => 'PIN salah '.self::MAX_FAILS.' kali. Absensi dikunci sementara.'], 429);
        }
        $row->update(['failed_attempts' => $fails]);
        return response()->json(['status' => 'error', 'ok' => false, 'remaining' => self::MAX_FAILS - $fails,
            'message' => 'PIN salah.'], 422);
    }

    /** Hapus PIN saat karyawan dihapus (pengelola HRIS). */
    public function destroy(Request $request)
    {
        $nik = trim((string) $request->input('nik'));
        if ($nik !== '') {
            HrisPin::where('nik', $nik)->delete();
        }
        return response()->json(['status' => 'success']);
    }
}
