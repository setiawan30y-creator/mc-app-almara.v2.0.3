<?php

namespace App\Http\Controllers;

use App\Models\ErpBankAccount;
use App\Models\ErpBankMovement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Mutasi bank manual (tombol "Tambah Mutasi") dicatat ke ledger ERP.
 *
 * Catatan bersifat append-only: edit dan hapus tidak mengubah/menghapus baris lama,
 * melainkan menambah baris koreksi sehingga jejak audit tetap utuh. Endpoint idempotent:
 * mengirim ulang kondisi yang sama tidak menambah baris.
 */
class ErpManualBankMutationController extends Controller
{
    private const REF_TYPE = 'manual_mutation';

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mutations' => ['nullable', 'array', 'max:500'],
            'mutations.*.id_mutasi' => ['required', 'string', 'max:40'],
            'mutations.*.bank' => ['required', 'string', 'max:50'],
            'mutations.*.tipe' => ['required', 'in:MASUK,KELUAR'],
            'mutations.*.nominal' => ['required', 'numeric', 'gt:0'],
            'mutations.*.keterangan' => ['nullable', 'string', 'max:500'],
            'mutations.*.timestamp' => ['nullable', 'string', 'max:40'],
            'deleted' => ['nullable', 'array', 'max:500'],
            'deleted.*' => ['string', 'max:40'],
        ]);

        $actorId = optional($request->user())->id;
        $actorId = is_numeric($actorId) ? (int) $actorId : null;
        $created = 0;

        try {
            DB::transaction(function () use ($data, $actorId, &$created) {
                foreach ($data['mutations'] ?? [] as $row) {
                    $account = $this->resolveAccount($row['bank']);
                    $signed = ($row['tipe'] === 'MASUK' ? 1 : -1) * (float) $row['nominal'];
                    $created += $this->applyTarget($row['id_mutasi'], [$account->id => $signed], $row, $actorId);
                }
                foreach ($data['deleted'] ?? [] as $id) {
                    $created += $this->applyTarget($id, [], ['keterangan' => null, 'timestamp' => null], $actorId);
                }
            });
        } catch (ValidationException $e) {
            return response()->json([
                'status' => 'error',
                'message' => collect($e->errors())->flatten()->first() ?: 'Mutasi ditolak.',
            ], 422);
        }

        return response()->json(['status' => 'success', 'created' => $created]);
    }

    /**
     * @param array<int,float> $target Efek bersih yang diinginkan per rekening (+masuk / -keluar).
     */
    private function applyTarget(string $mutationId, array $target, array $row, ?int $actorId): int
    {
        $existing = ErpBankMovement::query()
            ->where('reference_type', self::REF_TYPE)
            ->where('bank_reference', $mutationId)
            ->lockForUpdate()
            ->get();

        $current = [];
        foreach ($existing as $movement) {
            $sign = strtolower((string) $movement->direction) === 'in' ? 1 : -1;
            $current[$movement->bank_account_id] = ($current[$movement->bank_account_id] ?? 0) + $sign * (float) $movement->amount;
        }

        $accountIds = array_unique(array_merge(array_keys($current), array_keys($target)));
        $seq = $existing->count();
        $created = 0;

        foreach ($accountIds as $accountId) {
            $diff = round(($target[$accountId] ?? 0) - ($current[$accountId] ?? 0), 2);
            if (abs($diff) < 0.005) {
                continue;
            }

            $account = ErpBankAccount::query()->whereKey($accountId)->lockForUpdate()->first();
            $balance = $this->balanceOf($account) + $diff;
            if ($diff < 0 && $balance < -0.005) {
                throw ValidationException::withMessages([
                    'nominal' => "Saldo bank {$account->bank_name} tidak mencukupi untuk mutasi ini.",
                ]);
            }

            $seq++;
            $isFirst = $existing->isEmpty();
            ErpBankMovement::create([
                'bank_account_id' => $accountId,
                'movement_no' => substr('MUT-'.$mutationId.'-'.str_pad((string) $seq, 2, '0', STR_PAD_LEFT), 0, 50),
                'direction' => $diff > 0 ? 'IN' : 'OUT',
                'amount' => abs($diff),
                'currency_code' => 'IDR',
                'reference_type' => self::REF_TYPE,
                'bank_reference' => $mutationId,
                'description' => ($isFirst ? 'Mutasi manual: ' : 'Koreksi mutasi manual '.$mutationId.': ').trim((string) ($row['keterangan'] ?? '')),
                'posted_at' => $this->postedAt($row['timestamp'] ?? null),
                'created_by' => $actorId,
            ]);
            $created++;
        }

        return $created;
    }

    private function balanceOf(ErpBankAccount $account): float
    {
        $in = (float) $account->movements()->where('direction', 'in')->sum('amount');
        $out = (float) $account->movements()->where('direction', 'out')->sum('amount');

        return (float) $account->opening_balance + $in - $out;
    }

    private function postedAt(?string $value): Carbon
    {
        try {
            return $value ? Carbon::parse($value) : now();
        } catch (\Throwable $e) {
            return now();
        }
    }

    private function resolveAccount(string $bankName): ErpBankAccount
    {
        $name = trim($bankName);
        $account = ErpBankAccount::query()
            ->where('currency_code', 'IDR')
            ->where('is_active', true)
            ->where(function ($q) use ($name) {
                $q->whereRaw('LOWER(bank_name) = ?', [strtolower($name)])
                    ->orWhereRaw('LOWER(bank_name) LIKE ?', ['%'.strtolower($name).'%']);
            })
            ->orderBy('id')
            ->first();

        if ($account) {
            return $account;
        }

        $safe = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', $name));

        return ErpBankAccount::query()->firstOrCreate(
            ['code' => 'BANK-'.$safe.'-IDR'],
            ['bank_name' => $name, 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]
        );
    }
}
