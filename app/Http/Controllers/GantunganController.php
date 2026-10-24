<?php

namespace App\Http\Controllers;

use App\Models\ErpGantungan;
use App\Models\ErpGantunganPayment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * API Gantungan (JSON).
 * Gantungan = catatan Rp yang sedang di luar laci saat closing. Hanya catatan: tidak membuat mutasi kas/bank.
 * Sisa tiap nama dihitung dari nominal dikurangi cicilan; Closing Harian membaca sisa yang sama.
 */
class GantunganController extends Controller
{
    private const CATEGORIES = ['Operasional', 'Pinjaman staf', 'Belanja / kurir', 'Pickup valas', 'Lainnya'];
    private const OVERDUE_DAYS = 7;

    // ------------------------------------------------------------------
    // Baca
    // ------------------------------------------------------------------

    public function index(): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $this->snapshot()]);
    }

    // ------------------------------------------------------------------
    // Tulis
    // ------------------------------------------------------------------

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'recipient' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in([ErpGantungan::TYPE_OUTSIDE, ErpGantungan::TYPE_OWED])],
            'amount' => ['required', 'numeric', 'min:1', 'max:999999999999'],
            'category' => ['nullable', 'string', 'max:40'],
            'description' => ['required', 'string', 'min:3', 'max:500'],
        ], [
            'recipient.required' => 'Nama wajib diisi.',
            'amount.min' => 'Nominal harus lebih besar dari Rp 0.',
            'description.required' => 'Keterangan wajib diisi.',
            'description.min' => 'Keterangan minimal 3 karakter.',
        ]);

        $user = $request->user();
        $name = $this->cleanName($data['recipient']);
        $name = $this->canonicalName($name);

        $row = ErpGantungan::create([
            'reference_no' => $this->newReference(),
            'occurred_at' => now(),
            'recipient' => $name,
            'type' => $data['type'],
            'category' => $data['category'] ?? null,
            'amount_rp' => round((float) $data['amount'], 2),
            'status' => 'OUTSTANDING',
            'description' => trim($data['description']),
            'created_by' => $this->actorId($user),
            'created_by_name' => $this->actorName($user),
            'updated_by' => $this->actorId($user),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Gantungan ' . $row->recipient . ' dicatat.',
            'data' => $this->snapshot(),
        ]);
    }

    public function pay(Request $request, ErpGantungan $gantungan): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $amount = round((float) $data['amount'], 2);
        $result = DB::transaction(function () use ($gantungan, $amount, $data, $request) {
            $row = ErpGantungan::query()->lockForUpdate()->with('payments')->findOrFail($gantungan->id);
            $remaining = $row->remainingAt();
            if ($row->status !== 'OUTSTANDING' || $remaining <= 0.004) {
                return ['error' => 'Gantungan ini sudah lunas.'];
            }
            if ($amount > $remaining + 0.004) {
                return ['error' => 'Nominal melebihi sisa gantungan (Rp ' . number_format($remaining, 0, ',', '.') . ').'];
            }
            $this->recordPayment($row, min($amount, $remaining), $data['note'] ?? null, $request->user());

            return ['ok' => true];
        });

        if (isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 422);
        }

        return response()->json(['status' => 'success', 'message' => 'Pembayaran dicatat.', 'data' => $this->snapshot()]);
    }

    public function settle(Request $request, ErpGantungan $gantungan): JsonResponse
    {
        $result = DB::transaction(function () use ($gantungan, $request) {
            $row = ErpGantungan::query()->lockForUpdate()->with('payments')->findOrFail($gantungan->id);
            $remaining = $row->remainingAt();
            if ($row->status !== 'OUTSTANDING' || $remaining <= 0.004) {
                return ['error' => 'Gantungan ini sudah lunas.'];
            }
            $this->recordPayment($row, $remaining, 'Pelunasan', $request->user());

            return ['ok' => true];
        });

        if (isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 422);
        }

        return response()->json(['status' => 'success', 'message' => 'Gantungan dilunasi.', 'data' => $this->snapshot()]);
    }

    /** Bayar atas nama satu orang: dialokasikan ke catatan tertua lebih dulu. */
    public function payPerson(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in([ErpGantungan::TYPE_OUTSIDE, ErpGantungan::TYPE_OWED])],
            'amount' => ['nullable', 'numeric', 'min:1'],
            'all' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $key = ErpGantungan::keyFor($data['name']);
        $result = DB::transaction(function () use ($data, $key, $request) {
            $rows = ErpGantungan::query()->lockForUpdate()->with('payments')
                ->where('recipient_key', $key)->where('type', $data['type'])->where('status', 'OUTSTANDING')
                ->orderBy('occurred_at')->orderBy('id')->get()
                ->filter(fn ($r) => $r->remainingAt() > 0.004)->values();

            $total = round((float) $rows->sum(fn ($r) => $r->remainingAt()), 2);
            if ($total <= 0.004) {
                return ['error' => 'Tidak ada sisa gantungan untuk nama ini.'];
            }

            $pay = !empty($data['all']) ? $total : round((float) ($data['amount'] ?? 0), 2);
            if ($pay <= 0) {
                return ['error' => 'Nominal pembayaran wajib diisi.'];
            }
            if ($pay > $total + 0.004) {
                return ['error' => 'Nominal melebihi total sisa (Rp ' . number_format($total, 0, ',', '.') . ').'];
            }

            $left = min($pay, $total);
            $touched = 0;
            foreach ($rows as $row) {
                if ($left <= 0.004) {
                    break;
                }
                $part = min($left, $row->remainingAt());
                $this->recordPayment($row, $part, $data['note'] ?? null, $request->user());
                $left = round($left - $part, 2);
                $touched++;
            }

            return ['ok' => true, 'paid' => $pay, 'touched' => $touched];
        });

        if (isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Pembayaran Rp ' . number_format($result['paid'], 0, ',', '.') . ' dicatat pada ' . $result['touched'] . ' catatan.',
            'data' => $this->snapshot(),
        ]);
    }

    public function destroy(ErpGantungan $gantungan): JsonResponse
    {
        $ref = $gantungan->reference_no;
        $gantungan->delete(); // cicilan ikut terhapus (cascade)

        return response()->json(['status' => 'success', 'message' => "Catatan {$ref} dihapus.", 'data' => $this->snapshot()]);
    }

    /**
     * Pindahkan catatan lama (localStorage mc_gantungans) ke database. Aman dipanggil berulang:
     * catatan yang nomornya sudah ada dilewati.
     */
    public function importLegacy(Request $request): JsonResponse
    {
        $request->validate(['items' => ['required', 'array', 'max:3000']]);

        $tz = config('app.timezone');
        $imported = 0;
        $skipped = 0;

        DB::transaction(function () use ($request, $tz, &$imported, &$skipped) {
            foreach ($request->input('items', []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $ref = Str::limit(trim((string) ($item['id'] ?? '')), 40, '');
                $name = $this->cleanName((string) ($item['nama_nasabah'] ?? ''));
                $nominal = round((float) ($item['nominal'] ?? 0), 2);
                if ($ref === '' || $name === '' || $nominal <= 0) {
                    $skipped++;
                    continue;
                }
                if (ErpGantungan::where('reference_no', $ref)->exists()) {
                    $skipped++;
                    continue;
                }

                $at = $this->parseLegacyDate($item['timestamp'] ?? null, $tz) ?? now();
                $lunas = ($item['status'] ?? '') === 'LUNAS';
                $returnedAt = $lunas ? ($this->parseLegacyDate($item['tanggal_lunas'] ?? null, $tz) ?? $at) : null;

                $row = ErpGantungan::create([
                    'reference_no' => $ref,
                    'occurred_at' => $at,
                    'recipient' => $this->canonicalName($name),
                    'type' => ($item['tipe'] ?? 'PIUTANG') === 'UTANG' ? ErpGantungan::TYPE_OWED : ErpGantungan::TYPE_OUTSIDE,
                    'amount_rp' => $nominal,
                    'status' => $lunas ? 'RETURNED' : 'OUTSTANDING',
                    'description' => Str::limit(trim((string) ($item['keterangan'] ?? '')), 500, '') ?: 'Impor dari catatan lama',
                    'returned_at' => $returnedAt,
                    'created_by_name' => 'Impor catatan lama',
                ]);

                $paid = 0.0;
                foreach ((array) ($item['riwayat_cicilan'] ?? []) as $cicil) {
                    $amt = round((float) ($cicil['nominal'] ?? 0), 2);
                    if ($amt <= 0 || $paid + $amt > $nominal + 0.004) {
                        continue;
                    }
                    $this->insertPayment($row, $amt, $this->parseLegacyDate($cicil['tanggal'] ?? null, $tz) ?? $at, (string) ($cicil['catatan'] ?? ''), 'Impor catatan lama');
                    $paid += $amt;
                }
                // Lunas tetapi cicilannya tidak lengkap: tutup selisihnya pada tanggal lunas.
                if ($lunas && $paid < $nominal - 0.004) {
                    $this->insertPayment($row, round($nominal - $paid, 2), $returnedAt ?? $at, 'Pelunasan', 'Impor catatan lama');
                } elseif (!$lunas && $paid <= 0 && (float) ($item['terbayar'] ?? 0) > 0) {
                    // Ada total terbayar tetapi riwayat cicilannya tidak tercatat.
                    $legacyPaid = min($nominal - 0.01, round((float) $item['terbayar'], 2));
                    if ($legacyPaid > 0) {
                        $this->insertPayment($row, $legacyPaid, $at, 'Cicilan (impor)', 'Impor catatan lama');
                    }
                }
                $imported++;
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => "{$imported} catatan lama dipindahkan ke database.",
            'imported' => $imported,
            'skipped' => $skipped,
            'data' => $this->snapshot(),
        ]);
    }

    // ------------------------------------------------------------------
    // Susun data
    // ------------------------------------------------------------------

    private function snapshot(): array
    {
        $now = now();
        $open = ErpGantungan::query()->with('payments')->where('status', 'OUTSTANDING')
            ->orderBy('occurred_at')->orderBy('id')->get()
            ->filter(fn ($g) => $g->remainingAt() > 0.004)->values();
        $settled = ErpGantungan::query()->with('payments')->where('status', '!=', 'OUTSTANDING')
            ->orderByDesc('returned_at')->orderByDesc('id')->limit(200)->get();

        $items = $open->concat($settled)->map(fn ($g) => $this->itemArray($g, $now))->values();

        // Kartu per nama: hanya nama yang masih punya sisa.
        $people = $items->where('status', 'OUTSTANDING')->groupBy('person_key')->map(function (Collection $rows, $key) {
            $outside = (float) $rows->where('type', ErpGantungan::TYPE_OUTSIDE)->sum('remaining');
            $owed = (float) $rows->where('type', ErpGantungan::TYPE_OWED)->sum('remaining');
            $original = (float) $rows->sum('amount');
            $paid = (float) $rows->sum('paid');
            $latest = $rows->sortByDesc('occurred_at')->first();
            $activity = $rows->flatMap(fn ($r) => array_merge([$r['occurred_at']], array_column($r['payments'], 'paid_at')))->max();

            return [
                'key' => $key,
                'name' => $latest['recipient'],
                'outside' => $outside,
                'owed' => $owed,
                'balance' => round($outside - $owed, 2),
                'original' => $original,
                'paid' => $paid,
                'progress' => $original > 0 ? round($paid / $original * 100, 1) : 0,
                'open_count' => $rows->count(),
                'oldest_days' => (int) $rows->max('age_days'),
                'last_activity' => $activity,
                'items' => $rows->sortBy('occurred_at')->values()->all(),
            ];
        })->sortByDesc(fn ($p) => abs($p['balance']))->values()->all();

        $openItems = $items->where('status', 'OUTSTANDING');
        $outsideTotal = (float) $openItems->where('type', ErpGantungan::TYPE_OUTSIDE)->sum('remaining');
        $owedTotal = (float) $openItems->where('type', ErpGantungan::TYPE_OWED)->sum('remaining');
        $overdue = $openItems->where('type', ErpGantungan::TYPE_OUTSIDE)->filter(fn ($i) => $i['age_days'] > self::OVERDUE_DAYS);
        $today = $now->toDateString();

        $newToday = (float) ErpGantungan::whereDate('occurred_at', $today)->where('type', ErpGantungan::TYPE_OUTSIDE)->sum('amount_rp');
        $paidToday = (float) ErpGantunganPayment::whereDate('paid_at', $today)
            ->whereHas('gantungan', fn ($q) => $q->where('type', ErpGantungan::TYPE_OUTSIDE))->sum('amount_rp');

        $names = ErpGantungan::query()->select('recipient')->distinct()->orderBy('recipient')->limit(300)->pluck('recipient')->values()->all();

        return [
            'summary' => [
                'outside' => $outsideTotal,
                'owed' => $owedTotal,
                'net' => round($outsideTotal - $owedTotal, 2),
                'people' => count($people),
                'open_count' => $openItems->count(),
                'overdue_count' => $overdue->count(),
                'overdue_amount' => (float) $overdue->sum('remaining'),
                'new_today' => $newToday,
                'paid_today' => $paidToday,
                'overdue_days' => self::OVERDUE_DAYS,
            ],
            'people' => $people,
            'items' => $items->all(),
            'names' => $names,
            'categories' => self::CATEGORIES,
            'server_time' => $now->toIso8601String(),
        ];
    }

    private function itemArray(ErpGantungan $g, Carbon $now): array
    {
        $open = $g->status === 'OUTSTANDING';
        $paid = $g->paidAt();
        $remaining = $open ? max(0.0, round((float) $g->amount_rp - $paid, 2)) : 0.0;
        $age = $g->occurred_at ? max(0, (int) $g->occurred_at->copy()->startOfDay()->diffInDays($now->copy()->startOfDay())) : 0;

        return [
            'id' => $g->id,
            'reference_no' => $g->reference_no,
            'recipient' => $g->recipient,
            'person_key' => $g->recipient_key ?: ErpGantungan::keyFor((string) $g->recipient),
            'type' => $g->type === ErpGantungan::TYPE_OWED ? ErpGantungan::TYPE_OWED : ErpGantungan::TYPE_OUTSIDE,
            'category' => $g->category,
            'description' => $g->description,
            'amount' => (float) $g->amount_rp,
            'paid' => $paid,
            'remaining' => $remaining,
            'status' => $open ? 'OUTSTANDING' : 'RETURNED',
            'occurred_at' => optional($g->occurred_at)->toIso8601String(),
            'returned_at' => optional($g->returned_at)->toIso8601String(),
            'age_days' => $open ? $age : 0,
            'created_by_name' => $g->created_by_name,
            'payments' => $g->payments->map(fn ($p) => [
                'id' => $p->id,
                'paid_at' => optional($p->paid_at)->toIso8601String(),
                'amount' => (float) $p->amount_rp,
                'note' => $p->note,
                'by' => $p->created_by_name,
            ])->values()->all(),
        ];
    }

    // ------------------------------------------------------------------
    // Pembantu
    // ------------------------------------------------------------------

    private function recordPayment(ErpGantungan $row, float $amount, ?string $note, $user): void
    {
        $this->insertPayment($row, $amount, now(), $note ?? '', $this->actorName($user));

        $row->unsetRelation('payments');
        $row->load('payments');
        if ($row->remainingAt() <= 0.004) {
            $row->update([
                'status' => 'RETURNED',
                'returned_at' => now(),
                'returned_by' => $this->actorId($user),
                'updated_by' => $this->actorId($user),
            ]);
        } else {
            $row->update(['updated_by' => $this->actorId($user)]);
        }
    }

    private function insertPayment(ErpGantungan $row, float $amount, $paidAt, string $note, ?string $by): void
    {
        ErpGantunganPayment::create([
            'gantungan_id' => $row->id,
            'paid_at' => $paidAt,
            'amount_rp' => round($amount, 2),
            'note' => Str::limit(trim($note), 255, '') ?: null,
            'created_by_name' => $by,
        ]);
    }

    private function cleanName(string $name): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $name));
    }

    /** Pakai penulisan nama yang sudah ada (mis. "yayan" menjadi "Yayan") agar satu orang tidak terpecah. */
    private function canonicalName(string $name): string
    {
        $existing = ErpGantungan::where('recipient_key', ErpGantungan::keyFor($name))->orderByDesc('id')->value('recipient');

        return $existing ?: $name;
    }

    private function newReference(): string
    {
        do {
            $ref = 'GNT-' . now()->format('ymd') . '-' . Str::upper(Str::random(4));
        } while (ErpGantungan::where('reference_no', $ref)->exists());

        return $ref;
    }

    private function parseLegacyDate($value, string $tz): ?Carbon
    {
        if (!$value) {
            return null;
        }
        try {
            return Carbon::parse($value)->setTimezone($tz);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function actorId($user): ?int
    {
        $id = $user ? $user->getAuthIdentifier() : null;

        return is_numeric($id) ? (int) $id : null;
    }

    private function actorName($user): ?string
    {
        if (!$user) {
            return null;
        }

        return (string) ($user->fullName ?? $user->full_name ?? $user->name ?? $user->username ?? $user->getAuthIdentifier());
    }
}
