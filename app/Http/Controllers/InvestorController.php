<?php

namespace App\Http\Controllers;

use App\Models\Datastore;
use App\Models\ErpInvestor;
use App\Models\ErpInvestorCapitalMovement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * API Penanam Saham (JSON).
 * Profil investor + riwayat setor/tarik modal disimpan di MySQL. Hanya catatan: tidak membuat mutasi kas/bank.
 * Total hak persentase investor AKTIF dijaga maksimal 100% di sisi server.
 */
class InvestorController extends Controller
{
    private const SHARE_LIMIT = 100.0;

    // ------------------------------------------------------------------
    // Baca
    // ------------------------------------------------------------------

    public function index(): JsonResponse
    {
        $this->bootstrapFromDatastore();

        return response()->json(['status' => 'success', 'data' => $this->snapshot()]);
    }

    // ------------------------------------------------------------------
    // Investor
    // ------------------------------------------------------------------

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateInvestor($request, true);
        $user = $request->user();

        $result = DB::transaction(function () use ($data, $user) {
            $status = $data['status'] ?? ErpInvestor::STATUS_ACTIVE;
            $share = round((float) $data['share_percent'], 4);
            if ($error = $this->shareError($share, $status, null, 0.0)) {
                return ['error' => $error];
            }

            $investor = ErpInvestor::create([
                'code' => $this->nextCode(),
                'name' => $this->cleanName($data['name']),
                'type' => $data['type'],
                'id_number' => $this->nullable($data['id_number'] ?? null),
                'phone' => $this->nullable($data['phone'] ?? null),
                'email' => $this->nullable($data['email'] ?? null),
                'address' => $this->nullable($data['address'] ?? null),
                'join_date' => $data['join_date'] ?? now()->toDateString(),
                'status' => $status,
                'share_percent' => $share,
                'notes' => $this->nullable($data['notes'] ?? null),
                'created_by_name' => $this->actorName($user),
                'updated_by_name' => $this->actorName($user),
            ]);

            $initial = round((float) ($data['initial_capital'] ?? 0), 2);
            if ($initial > 0) {
                $this->addMovement($investor, ErpInvestorCapitalMovement::TYPE_IN, $initial, $investor->join_date->toDateString(), 'Modal awal', $user);
            }

            return ['ok' => true, 'name' => $investor->name];
        });

        if (isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 422);
        }

        return response()->json(['status' => 'success', 'message' => 'Investor ' . $result['name'] . ' ditambahkan.', 'data' => $this->snapshot()]);
    }

    public function update(Request $request, ErpInvestor $investor): JsonResponse
    {
        $data = $this->validateInvestor($request, false);
        $user = $request->user();

        $result = DB::transaction(function () use ($data, $investor, $user) {
            $row = ErpInvestor::query()->lockForUpdate()->findOrFail($investor->id);
            $status = $data['status'] ?? $row->status;
            $share = round((float) $data['share_percent'], 4);
            if ($error = $this->shareError($share, $status, $row->id, $row->status === ErpInvestor::STATUS_ACTIVE ? (float) $row->share_percent : 0.0)) {
                return ['error' => $error];
            }

            $row->update([
                'name' => $this->cleanName($data['name']),
                'type' => $data['type'],
                'id_number' => $this->nullable($data['id_number'] ?? null),
                'phone' => $this->nullable($data['phone'] ?? null),
                'email' => $this->nullable($data['email'] ?? null),
                'address' => $this->nullable($data['address'] ?? null),
                'join_date' => $data['join_date'] ?? $row->join_date,
                'status' => $status,
                'share_percent' => $share,
                'notes' => $this->nullable($data['notes'] ?? null),
                'updated_by_name' => $this->actorName($user),
            ]);

            return ['ok' => true, 'name' => $row->name];
        });

        if (isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 422);
        }

        return response()->json(['status' => 'success', 'message' => 'Data ' . $result['name'] . ' diperbarui.', 'data' => $this->snapshot()]);
    }

    public function destroy(ErpInvestor $investor): JsonResponse
    {
        $label = $investor->code . ' ' . $investor->name;
        $investor->delete(); // riwayat modal ikut terhapus (cascade)

        return response()->json(['status' => 'success', 'message' => "Investor {$label} dihapus.", 'data' => $this->snapshot()]);
    }

    // ------------------------------------------------------------------
    // Modal
    // ------------------------------------------------------------------

    public function capitalStore(Request $request, ErpInvestor $investor): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in([ErpInvestorCapitalMovement::TYPE_IN, ErpInvestorCapitalMovement::TYPE_OUT])],
            'amount' => ['required', 'numeric', 'min:1', 'max:999999999999'],
            'occurred_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [
            'amount.min' => 'Nominal harus lebih besar dari Rp 0.',
            'occurred_on.before_or_equal' => 'Tanggal tidak boleh di masa depan.',
        ]);
        $user = $request->user();

        $result = DB::transaction(function () use ($data, $investor, $user) {
            $row = ErpInvestor::query()->lockForUpdate()->with('movements')->findOrFail($investor->id);
            $amount = round((float) $data['amount'], 2);
            if ($data['type'] === ErpInvestorCapitalMovement::TYPE_OUT && $amount > $row->capital() + 0.004) {
                return ['error' => 'Penarikan melebihi modal disetor (Rp ' . number_format($row->capital(), 0, ',', '.') . ').'];
            }
            $this->addMovement($row, $data['type'], $amount, $data['occurred_on'], $data['note'] ?? null, $user);

            return ['ok' => true, 'name' => $row->name];
        });

        if (isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 422);
        }

        $label = $data['type'] === ErpInvestorCapitalMovement::TYPE_IN ? 'Setoran modal' : 'Penarikan modal';

        return response()->json(['status' => 'success', 'message' => $label . ' ' . $result['name'] . ' dicatat.', 'data' => $this->snapshot()]);
    }

    public function capitalDestroy(ErpInvestor $investor, ErpInvestorCapitalMovement $movement): JsonResponse
    {
        if ((int) $movement->investor_id !== (int) $investor->id) {
            return response()->json(['status' => 'error', 'message' => 'Riwayat modal tidak ditemukan.'], 404);
        }

        $result = DB::transaction(function () use ($investor, $movement) {
            $row = ErpInvestor::query()->lockForUpdate()->with('movements')->findOrFail($investor->id);
            $after = $row->capital() - ($movement->type === ErpInvestorCapitalMovement::TYPE_IN ? (float) $movement->amount : -(float) $movement->amount);
            if ($after < -0.004) {
                return ['error' => 'Riwayat ini tidak bisa dihapus karena modal akan menjadi minus. Hapus penarikan yang terkait lebih dulu.'];
            }
            $movement->delete();

            return ['ok' => true];
        });

        if (isset($result['error'])) {
            return response()->json(['status' => 'error', 'message' => $result['error']], 422);
        }

        return response()->json(['status' => 'success', 'message' => 'Riwayat modal dihapus.', 'data' => $this->snapshot()]);
    }

    // ------------------------------------------------------------------
    // Impor data lama (mc_investors)
    // ------------------------------------------------------------------

    public function importLegacy(Request $request): JsonResponse
    {
        $request->validate(['items' => ['required', 'array', 'max:2000']]);
        $stats = $this->importItems($request->input('items', []), $this->actorName($request->user()));

        return response()->json([
            'status' => 'success',
            'message' => "{$stats['imported']} investor lama dipindahkan ke database.",
            'imported' => $stats['imported'],
            'skipped' => $stats['skipped'],
            'data' => $this->snapshot(),
        ]);
    }

    /** Satu kali: bila tabel masih kosong dan Universal Datastore menyimpan mc_investors, pindahkan lalu kosongkan kuncinya. */
    private function bootstrapFromDatastore(): void
    {
        if (ErpInvestor::query()->exists()) {
            return;
        }
        $row = Datastore::query()->where('store_key', 'mc_investors')->first();
        if (!$row) {
            return;
        }
        $items = $row->json_data;
        if (is_string($items)) {
            $items = json_decode($items, true);
        }
        if (!is_array($items) || !count($items)) {
            return;
        }

        $this->importItems($items, 'Impor catatan lama');
        $row->json_data = [];
        $row->save();
    }

    private function importItems(array $items, ?string $by): array
    {
        $imported = 0;
        $skipped = 0;

        DB::transaction(function () use ($items, $by, &$imported, &$skipped) {
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $name = $this->cleanName((string) ($item['nama'] ?? ''));
                if ($name === '') {
                    $skipped++;
                    continue;
                }
                $code = Str::upper(Str::limit(trim((string) ($item['id_investor'] ?? '')), 20, ''));
                if ($code !== '' && ErpInvestor::where('code', $code)->exists()) {
                    $skipped++;
                    continue;
                }
                if ($code === '') {
                    $code = $this->nextCode();
                }

                $contact = trim((string) ($item['kontak'] ?? ''));
                $isEmail = $contact !== '' && str_contains($contact, '@');
                $join = null;
                try {
                    $join = !empty($item['tgl_gabung']) ? Carbon::parse($item['tgl_gabung'])->toDateString() : null;
                } catch (\Throwable $e) {
                    $join = null;
                }

                $investor = ErpInvestor::create([
                    'code' => $code,
                    'name' => $name,
                    'type' => 'PERORANGAN',
                    'phone' => $isEmail ? null : $this->nullable(Str::limit($contact, 40, '')),
                    'email' => $isEmail ? Str::limit($contact, 150, '') : null,
                    'join_date' => $join ?? now()->toDateString(),
                    'status' => ErpInvestor::STATUS_ACTIVE,
                    'share_percent' => max(0, min(100, round((float) ($item['persentase'] ?? 0), 4))),
                    'created_by_name' => $by,
                    'updated_by_name' => $by,
                ]);

                $capital = round((float) ($item['modal'] ?? 0), 2);
                if ($capital > 0) {
                    $this->addMovement($investor, ErpInvestorCapitalMovement::TYPE_IN, $capital, $investor->join_date->toDateString(), 'Modal awal (impor catatan lama)', null, $by);
                }
                $imported++;
            }
        });

        return ['imported' => $imported, 'skipped' => $skipped];
    }

    // ------------------------------------------------------------------
    // Susun data
    // ------------------------------------------------------------------

    private function snapshot(): array
    {
        $rows = ErpInvestor::query()->with('movements')->orderBy('code')->get();

        $investors = $rows->map(function (ErpInvestor $i) {
            $capital = $i->capital();
            $share = (float) $i->share_percent;

            return [
                'id' => $i->id,
                'code' => $i->code,
                'name' => $i->name,
                'type' => $i->type,
                'id_number' => $i->id_number,
                'phone' => $i->phone,
                'email' => $i->email,
                'address' => $i->address,
                'join_date' => optional($i->join_date)->toDateString(),
                'status' => $i->status,
                'share_percent' => $share,
                'notes' => $i->notes,
                'deposited' => $i->capitalIn(),
                'withdrawn' => $i->capitalOut(),
                'capital' => $capital,
                'fixed_value' => round($capital * $share / 100, 2),
                'created_by_name' => $i->created_by_name,
                'updated_by_name' => $i->updated_by_name,
                'updated_at' => optional($i->updated_at)->toIso8601String(),
                'movements' => $i->movements->map(fn ($m) => [
                    'id' => $m->id,
                    'type' => $m->type,
                    'amount' => (float) $m->amount,
                    'occurred_on' => optional($m->occurred_on)->toDateString(),
                    'note' => $m->note,
                    'by' => $m->created_by_name,
                ])->values()->all(),
            ];
        })->values();

        $active = $investors->where('status', ErpInvestor::STATUS_ACTIVE);
        $totalShare = round((float) $active->sum('share_percent'), 4);

        return [
            'summary' => [
                'total_capital' => (float) $investors->sum('capital'),
                'active_count' => $active->count(),
                'inactive_count' => $investors->count() - $active->count(),
                'total_share' => $totalShare,
                'remaining_share' => round(self::SHARE_LIMIT - $totalShare, 4),
                'fixed_value' => (float) $active->sum('fixed_value'),
            ],
            'investors' => $investors->all(),
        ];
    }

    // ------------------------------------------------------------------
    // Pembantu
    // ------------------------------------------------------------------

    private function validateInvestor(Request $request, bool $creating): array
    {
        $rules = [
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'type' => ['required', Rule::in(ErpInvestor::TYPES)],
            'id_number' => ['nullable', 'string', 'max:40'],
            'phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+()\-\s.]*$/'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:255'],
            'join_date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'],
            'status' => ['nullable', Rule::in(ErpInvestor::STATUSES)],
            'share_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
        if ($creating) {
            $rules['initial_capital'] = ['nullable', 'numeric', 'min:0', 'max:999999999999'];
        }

        return $request->validate($rules, [
            'name.required' => 'Nama investor wajib diisi.',
            'name.min' => 'Nama minimal 2 karakter.',
            'phone.regex' => 'Nomor HP hanya boleh berisi angka, spasi, +, -, titik, dan tanda kurung.',
            'email.email' => 'Format email tidak valid.',
            'share_percent.required' => 'Hak persentase wajib diisi.',
            'share_percent.max' => 'Hak persentase maksimal 100%.',
            'join_date.before_or_equal' => 'Tanggal gabung tidak boleh di masa depan.',
        ]);
    }

    /**
     * Pesan kesalahan bila total hak investor AKTIF akan melebihi 100%.
     * $currentCounted = hak investor ini yang saat ini sudah dihitung (0 bila baru atau tidak aktif);
     * mengubah tanpa menambah hak tetap diizinkan walau data lama sudah melebihi 100%.
     */
    private function shareError(float $share, string $status, ?int $ignoreId, float $currentCounted): ?string
    {
        if ($status !== ErpInvestor::STATUS_ACTIVE) {
            return null;
        }
        $others = (float) ErpInvestor::query()
            ->where('status', ErpInvestor::STATUS_ACTIVE)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->sum('share_percent');
        $room = round(self::SHARE_LIMIT - $others, 4);
        if ($share > $room + 0.00005 && $share > $currentCounted + 0.00005) {
            return 'Total hak persentase melebihi 100%. Sisa yang bisa dialokasikan: ' . rtrim(rtrim(number_format(max(0, $room), 4, ',', '.'), '0'), ',') . '%.';
        }

        return null;
    }

    private function addMovement(ErpInvestor $investor, string $type, float $amount, string $date, ?string $note, $user, ?string $byName = null): void
    {
        ErpInvestorCapitalMovement::create([
            'investor_id' => $investor->id,
            'type' => $type,
            'amount' => round($amount, 2),
            'occurred_on' => $date,
            'note' => $this->nullable($note),
            'created_by_name' => $byName ?? $this->actorName($user),
        ]);
    }

    private function nextCode(): string
    {
        $max = 0;
        foreach (ErpInvestor::query()->pluck('code') as $code) {
            if (preg_match('/^INV-(\d+)$/', (string) $code, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'INV-' . str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }

    private function cleanName(string $name): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $name));
    }

    private function nullable($value): ?string
    {
        $v = trim((string) ($value ?? ''));

        return $v === '' ? null : $v;
    }

    private function actorName($user): ?string
    {
        if (!$user) {
            return null;
        }

        return (string) ($user->fullName ?? $user->full_name ?? $user->name ?? $user->username ?? $user->getAuthIdentifier());
    }
}
