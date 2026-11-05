<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\Datastore;
use App\Services\Erp\MoneyLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Jurnal Ekuitas/Kewajiban dan DP Booking disimpan LANGSUNG ke database:
 * buku besar kas/bank + daftar datanya. Browser hanya menampilkan hasil dari server,
 * sehingga semua akun & perangkat melihat data yang sama.
 */
class ErpMoneyLedgerController extends Controller
{
    public function __construct(private MoneyLedger $ledger)
    {
    }

    /** POST /erp/adjustments/save */
    public function saveAdjustment(Request $request): JsonResponse
    {
        $row = $request->validate([
            'id_adj' => ['required', 'string', 'max:40'],
            'kategori' => ['nullable', 'string', 'max:150'],
            'tipe' => ['required', 'string', 'max:30'],
            'impact' => ['required', 'string', 'max:40'],
            'deskripsi' => ['required', 'string', 'max:500'],
            'nominal' => ['required', 'numeric', 'gt:0'],
            'timestamp' => ['nullable', 'string', 'max:40'],
            'inputBy' => ['nullable', 'string', 'max:150'],
            'editBy' => ['nullable', 'string', 'max:150'],
        ]);
        $actor = $this->actor($request);

        return $this->run(function () use ($row, $actor) {
            $target = MoneyLedger::adjustmentTarget($row['impact'], (float) $row['nominal']);
            $desc = trim(($row['kategori'] ?? '') . ' - ' . $row['deskripsi'], ' -');
            $this->ledger->apply('adjustment', $row['id_adj'], $target, $desc, $row['timestamp'] ?? null, $actor);
            return $this->mutateList('mc_adjustments', 'id_adj', $row['id_adj'], $row + ['timestamp' => $row['timestamp'] ?? now()->toIso8601String()]);
        });
    }

    /** POST /erp/adjustments/delete */
    public function deleteAdjustment(Request $request): JsonResponse
    {
        $data = $request->validate(['id_adj' => ['required', 'string', 'max:40']]);
        $actor = $this->actor($request);

        return $this->run(function () use ($data, $actor) {
            $this->ledger->apply('adjustment', $data['id_adj'], [], 'Jurnal dihapus', null, $actor);
            return $this->mutateList('mc_adjustments', 'id_adj', $data['id_adj'], null);
        });
    }

    /**
     * POST /erp/booking-dp  {ref, method: CASH|BCA|MANDIRI, amount (+masuk/-keluar), description}
     * amount 0 = batalkan pencatatan DP (dikembalikan / sudah ikut transaksi pelunasan).
     */
    public function bookingDp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ref' => ['required', 'string', 'max:40'],
            'method' => ['nullable', 'string', 'max:30'],
            'amount' => ['required', 'numeric'],
            'description' => ['nullable', 'string', 'max:250'],
            'timestamp' => ['nullable', 'string', 'max:40'],
            'kind' => ['nullable', 'in:booking_dp,kasbon'],
        ]);
        $actor = $this->actor($request);
        $kind = $data['kind'] ?? 'booking_dp';

        return $this->run(function () use ($data, $actor, $kind) {
            $method = strtoupper(trim((string) ($data['method'] ?? 'CASH')));
            $method = ['TRANSFER' => 'BCA', 'SPLIT' => 'CASH', 'TUNAI' => 'CASH', '' => 'CASH'][$method] ?? $method;
            $target = abs((float) $data['amount']) < 0.005 ? [] : [($method === 'CASH' ? 'cash' : 'bank:' . $method) => (float) $data['amount']];
            $n = $this->ledger->apply($kind, $data['ref'], $target, $data['description'] ?: ($kind === 'kasbon' ? 'Kasbon' : 'DP Booking'), $data['timestamp'] ?? null, $actor);
            return ['created' => $n];
        });
    }

    private function run(callable $fn): JsonResponse
    {
        try {
            $result = DB::transaction($fn);
        } catch (ValidationException $e) {
            return response()->json(['status' => 'error', 'message' => collect($e->errors())->flatten()->first() ?: 'Ditolak.'], 422);
        }
        return response()->json(['status' => 'success', 'data' => $result]);
    }

    /** Ubah/hapus satu baris di daftar datastore (di database), lalu kembalikan daftar terbaru. */
    private function mutateList(string $key, string $idField, string $id, ?array $row): array
    {
        $store = Datastore::query()->whereKey($key)->lockForUpdate()->first();
        $list = $store && is_array($store->json_data) ? array_values($store->json_data) : [];
        $found = false;
        foreach ($list as $i => $item) {
            if (is_array($item) && (string) ($item[$idField] ?? '') === $id) {
                $found = true;
                if ($row === null) {
                    unset($list[$i]);
                } else {
                    $list[$i] = array_merge($item, $row, ['inputBy' => $item['inputBy'] ?? ($row['inputBy'] ?? null)]);
                }
            }
        }
        if (!$found && $row !== null) {
            $list[] = $row;
        }
        $list = array_values($list);
        Datastore::updateOrCreate(['store_key' => $key], ['json_data' => $list]);
        return ['list' => $list];
    }

    private function actor(Request $request): ?int
    {
        $id = optional($request->user())->id;
        return is_numeric($id) ? (int) $id : null;
    }
}
