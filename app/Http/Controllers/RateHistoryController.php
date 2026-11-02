<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\RateSnapshot;
use App\Services\RateHistoryService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Riwayat Kurs (audit BI). Akses dibatasi per jabatan di routes/api.php. */
class RateHistoryController extends Controller
{
    private const MAX_DAYS = 62;

    public function __construct(private RateHistoryService $history)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'code' => ['nullable', 'string', 'max:20'],
            'source' => ['nullable', Rule::in(['jadwal', 'manual', 'perubahan'])],
        ], ['to.after_or_equal' => 'Tanggal akhir tidak boleh sebelum tanggal awal.']);

        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();
        if ($from->diffInDays($to) >= self::MAX_DAYS) {
            return response()->json(['status' => 'error', 'message' => 'Rentang maksimal '.self::MAX_DAYS.' hari. Ekspor per bulan untuk periode lebih panjang.'], 422);
        }

        $q = RateSnapshot::query()
            ->whereBetween('taken_at', [$from->format('Y-m-d H:i:s'), $to->format('Y-m-d H:i:s')])
            ->orderBy('taken_at')->orderBy('currency_code');
        if (!empty($data['code'])) {
            $q->where('currency_code', $data['code']);
        }
        if (!empty($data['source'])) {
            $q->where('source', $data['source']);
        }

        $rows = $q->get()->map(fn (RateSnapshot $r) => [
            'id' => $r->id,
            'taken_at' => $r->taken_at?->format('Y-m-d H:i:s'),
            'slot' => $r->slot?->format('Y-m-d H:i:s'),
            'source' => $r->source,
            'code' => $r->currency_code,
            'label' => $r->currency_label,
            'buy' => $r->buy,
            'sell' => $r->sell,
            'prev_buy' => $r->prev_buy,
            'prev_sell' => $r->prev_sell,
            'recorded_by' => $r->recorded_by,
        ])->values();

        return response()->json(['status' => 'success', 'data' => $rows]);
    }

    public function status(): JsonResponse
    {
        $s = $this->history->settings();
        $last = RateSnapshot::query()->where('source', 'jadwal')->orderByDesc('slot')->value('slot');
        $lastCount = $last ? RateSnapshot::query()->where('source', 'jadwal')->where('slot', $last)->count() : 0;
        $beat = $this->history->heartbeat();
        $alive = $beat ? Carbon::parse($beat)->greaterThan(now()->subMinutes(3)) : false;
        $next = $this->history->nextSlot(null, $s);
        $today = $this->history->slotsFor(now(), $s);

        return response()->json(['status' => 'success', 'data' => [
            'settings' => $s,
            'intervals' => RateHistoryService::INTERVALS,
            'server_time' => now()->format('Y-m-d H:i:s'),
            'last_scheduled' => $last ? Carbon::parse($last)->format('Y-m-d H:i:s') : null,
            'last_scheduled_count' => $lastCount,
            'next_slot' => $next?->format('Y-m-d H:i:s'),
            'today_slots' => array_map(fn ($c) => $c->format('H:i'), $today),
            'scheduler_alive' => $alive,
            'scheduler_beat' => $beat,
            'total_records' => RateSnapshot::query()->count(),
            'first_record' => RateSnapshot::query()->min('taken_at'),
        ]]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i', 'after_or_equal:start'],
            'interval' => ['required', 'integer', Rule::in(RateHistoryService::INTERVALS)],
            'days' => ['required', 'array', 'min:1'],
            'days.*' => ['integer', 'between:1,7'],
            'log_changes' => ['required', 'boolean'],
        ], [
            'end.after_or_equal' => 'Jam selesai tidak boleh lebih awal dari jam mulai.',
            'days.min' => 'Pilih minimal satu hari pencatatan.',
        ]);

        $saved = $this->history->saveSettings($data);

        return response()->json(['status' => 'success', 'message' => 'Jadwal pencatatan kurs disimpan.', 'data' => $saved]);
    }

    public function snapshot(Request $request): JsonResponse
    {
        $u = $request->user();
        $n = $this->history->snapshot('manual', null, (string) ($u?->username ?? $u?->name ?? ''));
        if ($n === 0) {
            return response()->json(['status' => 'error', 'message' => 'Tidak ada valuta dengan kurs untuk dicatat.'], 422);
        }

        return response()->json(['status' => 'success', 'message' => "Kurs {$n} valuta berhasil dicatat.", 'count' => $n]);
    }
}
