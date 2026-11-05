<?php
// @2026-Alifiandra

namespace App\Services\Erp;

use App\Models\ErpBankAccount;
use App\Models\ErpBankMovement;
use App\Models\ErpCashAccount;
use App\Models\ErpCashMovement;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Pencatatan uang masuk/keluar kas & bank untuk data selain transaksi valas
 * (jurnal ekuitas/kewajiban, DP booking). Idempotent per (jenis, nomor):
 * memanggil ulang dengan nilai sama tidak menambah baris; nilai berubah / dihapus
 * menambah baris koreksi (baris lama tidak diubah, jejak tetap ada).
 */
class MoneyLedger
{
    /**
     * @param array<string,float> $target "cash" | "bank:NAMA" => efek bersih (+ masuk / - keluar)
     */
    public function apply(string $refType, string $ref, array $target, string $description, ?string $timestamp, ?int $actorId, bool $checkBalance = true): int
    {
        $resolved = [];
        foreach ($target as $key => $amount) {
            if (abs((float) $amount) < 0.005) {
                continue;
            }
            $acc = $key === 'cash' ? $this->cashAccount() : $this->bankAccount(substr($key, 5) ?: 'BCA');
            $k = ($key === 'cash' ? 'cash:' : 'bank:') . $acc->id;
            $resolved[$k] = ($resolved[$k] ?? 0) + (float) $amount;
        }

        $like = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $ref) . '-%';
        $cashRows = ErpCashMovement::query()->where('reference_type', $refType)->where('movement_no', 'like', $like)->lockForUpdate()->get();
        $bankRows = ErpBankMovement::query()->where('reference_type', $refType)->where('movement_no', 'like', $like)->lockForUpdate()->get();

        $current = [];
        foreach ($cashRows as $m) {
            $current['cash:' . $m->cash_account_id] = ($current['cash:' . $m->cash_account_id] ?? 0) + (strtolower((string) $m->direction) === 'in' ? 1 : -1) * (float) $m->amount;
        }
        foreach ($bankRows as $m) {
            $current['bank:' . $m->bank_account_id] = ($current['bank:' . $m->bank_account_id] ?? 0) + (strtolower((string) $m->direction) === 'in' ? 1 : -1) * (float) $m->amount;
        }

        $seq = $cashRows->count() + $bankRows->count();
        $isFirst = $seq === 0;
        $created = 0;
        foreach (array_unique(array_merge(array_keys($current), array_keys($resolved))) as $key) {
            $diff = round(($resolved[$key] ?? 0) - ($current[$key] ?? 0), 2);
            if (abs($diff) < 0.005) {
                continue;
            }
            [$kind, $accountId] = explode(':', $key);
            $account = $kind === 'cash'
                ? ErpCashAccount::query()->whereKey($accountId)->lockForUpdate()->first()
                : ErpBankAccount::query()->whereKey($accountId)->lockForUpdate()->first();
            $label = $kind === 'cash' ? 'Kas Tunai' : 'Bank ' . $account->bank_name;
            if ($checkBalance && $diff < 0 && $this->balanceOf($account) + $diff < -0.005) {
                throw ValidationException::withMessages(['nominal' => "Saldo {$label} tidak mencukupi (sisa Rp " . number_format($this->balanceOf($account), 0, ',', '.') . ').']);
            }
            $seq++;
            $payload = [
                'movement_no' => substr($ref . '-' . str_pad((string) $seq, 2, '0', STR_PAD_LEFT), 0, 50),
                'direction' => $diff > 0 ? 'IN' : 'OUT',
                'amount' => abs($diff),
                'currency_code' => 'IDR',
                'reference_type' => $refType,
                'description' => mb_substr(($isFirst ? '' : 'Koreksi ' . $ref . ': ') . $description, 0, 250),
                'posted_at' => $this->postedAt($timestamp),
                'created_by' => $actorId,
            ];
            if ($kind === 'cash') {
                ErpCashMovement::create($payload + ['cash_account_id' => $accountId]);
            } else {
                ErpBankMovement::create($payload + ['bank_account_id' => $accountId, 'bank_reference' => $ref]);
            }
            $created++;
        }
        return $created;
    }

    public function balanceOf($account): float
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

    private function cashAccount(): ErpCashAccount
    {
        return ErpCashAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->orderBy('id')->first()
            ?? ErpCashAccount::firstOrCreate(['code' => 'CASH-IDR-01'], ['name' => 'Kas Utama IDR', 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]);
    }

    private function bankAccount(string $bankName): ErpBankAccount
    {
        $name = strtolower(trim($bankName));
        $account = ErpBankAccount::query()->where('currency_code', 'IDR')->where('is_active', true)
            ->where(fn ($q) => $q->whereRaw('LOWER(bank_name) = ?', [$name])->orWhereRaw('LOWER(bank_name) LIKE ?', ['%' . $name . '%'])->orWhereRaw('LOWER(code) LIKE ?', ['%' . $name . '%']))
            ->orderBy('id')->first();
        if ($account) {
            return $account;
        }
        $safe = trim(strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', $bankName)), '-') ?: 'BANK';
        return ErpBankAccount::firstOrCreate(['code' => 'BANK-' . $safe . '-IDR'], ['bank_name' => strtoupper(trim($bankName)), 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]);
    }

    /** Dampak jurnal ekuitas (MASUK_CASH, KELUAR_BCA, ...) => target ledger. */
    public static function adjustmentTarget(?string $impact, float $amount): array
    {
        $impact = strtoupper((string) $impact);
        $impact = ['MASUK_BANK' => 'MASUK_BCA', 'KELUAR_BANK' => 'KELUAR_BCA'][$impact] ?? $impact;
        if (!preg_match('/^(MASUK|KELUAR)_(CASH|[A-Z0-9]+)$/', $impact, $m)) {
            return [];
        }
        $signed = ($m[1] === 'MASUK' ? 1 : -1) * abs($amount);
        return [$m[2] === 'CASH' ? 'cash' : 'bank:' . $m[2] => $signed];
    }
}
