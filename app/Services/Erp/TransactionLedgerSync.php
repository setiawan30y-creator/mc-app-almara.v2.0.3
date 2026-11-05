<?php
// @2026-Alifiandra

namespace App\Services\Erp;

use App\Models\ErpBankAccount;
use App\Models\ErpBankMovement;
use App\Models\ErpCashAccount;
use App\Models\ErpCashMovement;
use App\Models\ErpCurrencyStockMovement;
use App\Models\ErpPayment;
use App\Models\Transaction;
use Illuminate\Validation\ValidationException;

/**
 * Menyamakan ledger (kas/bank & stok valas) dengan isi transaksi setelah DIEDIT atau DIHAPUS.
 *
 * Ledger bersifat append-only: baris lama tidak diubah. Yang ditambahkan adalah baris koreksi
 * sebesar selisih antara posisi yang sudah tercatat dan posisi yang seharusnya. Contoh: transaksi
 * BELI SGD 800 (Rp 9,64 jt via BCA) diedit menjadi JUAL -> bank +Rp 19,28 jt dan stok SGD -1.600.
 *
 * Hanya berlaku untuk transaksi yang SUDAH pernah tercatat di ledger, sehingga data histori lama
 * (impor tanpa pembayaran) tidak tiba-tiba ikut mengubah saldo.
 */
class TransactionLedgerSync
{
    public function __construct(private readonly CurrencyStockService $stock)
    {
    }

    public static function hasPostings(string $itemId): bool
    {
        return ErpPayment::where('transaction_ref', $itemId)->exists()
            || ErpCurrencyStockMovement::where('transaction_ref', $itemId)->exists();
    }

    /**
     * @param array<int,array<string,mixed>>|null $payments erpPayments dari browser (method cash|bank, amount, bank_name)
     * @return int jumlah baris koreksi yang dibuat
     */
    public function sync(Transaction $t, ?array $payments, mixed $actorId = null): int
    {
        $itemId = (string) $t->itemId;
        $invoice = (string) ($t->id ?: $itemId);
        $type = strtoupper(trim((string) $t->tipe));
        if (!in_array($type, ['BELI', 'JUAL'], true)) {
            return 0;
        }
        $sign = $type === 'JUAL' ? 1 : -1; // Rupiah: JUAL masuk, BELI keluar
        $total = (float) $t->total;
        $desired = $this->desiredPayments($t, $payments, $total);
        $target = [];
        foreach ($desired as $p) {
            $k = $p['method'] . ':' . $p['account_id'];
            $target[$k] = ($target[$k] ?? 0) + $sign * $p['amount'];
        }
        $actor = is_numeric($actorId) ? (int) $actorId : null;
        return $this->applyPayments($itemId, $invoice, $target, $actor, 'Koreksi edit transaksi')
            + $this->applyStock($itemId, strtoupper(trim((string) $t->valuta)), $type === 'BELI' ? (float) $t->nominal : -(float) $t->nominal, $t->rate);
    }

    /** Batalkan seluruh efek ledger transaksi (dipakai saat transaksi dihapus). */
    public function reverse(Transaction $t, mixed $actorId = null): int
    {
        $itemId = (string) $t->itemId;
        $actor = is_numeric($actorId) ? (int) $actorId : null;
        return $this->applyPayments($itemId, (string) ($t->id ?: $itemId), [], $actor, 'Pembatalan transaksi')
            + $this->applyStock($itemId, strtoupper(trim((string) $t->valuta)), 0.0, $t->rate);
    }

    /* ------------------------------------------------------------------ pembayaran (kas/bank) */

    /** @return array<int,array{method:string,account_id:int,amount:float}> */
    private function desiredPayments(Transaction $t, ?array $payments, float $total): array
    {
        $rows = [];
        if (is_array($payments) && $payments) {
            foreach ($payments as $p) {
                $method = strtolower(trim((string) ($p['method'] ?? '')));
                $amount = (float) ($p['amount'] ?? 0);
                if ($amount <= 0 || !in_array($method, ['cash', 'bank'], true)) {
                    continue;
                }
                $rows[] = ['method' => $method, 'account_id' => $method === 'cash' ? $this->cashAccount()->id : $this->bankAccount((string) ($p['bank_name'] ?? 'BCA'))->id, 'amount' => $amount];
            }
            $sum = array_sum(array_column($rows, 'amount'));
            if ($rows && abs($sum - $total) > 0.5) {
                throw ValidationException::withMessages(['erpPayments' => 'Total pembayaran harus sama dengan total transaksi.']);
            }
            if ($rows) {
                return $rows;
            }
        }
        $raw = is_string($t->raw_json) ? (json_decode($t->raw_json, true) ?: []) : (array) $t->raw_json;
        $method = strtoupper(trim((string) ($t->paymentMethod ?: ($raw['paymentMethod'] ?? 'CASH'))));
        $bank = trim((string) ($raw['bank'] ?? '')) ?: 'BCA';
        $cur = $this->currentPayments((string) $t->itemId);
        $cur = array_filter($cur, fn ($v) => abs($v) > 0.005);
        $hasCash = (bool) array_filter(array_keys($cur), fn ($k) => str_starts_with($k, 'cash:'));
        $hasBank = (bool) array_filter(array_keys($cur), fn ($k) => str_starts_with($k, 'bank:'));
        $wantBankId = in_array($method, ['TRANSFER', 'BANK'], true) ? $this->bankAccount($bank)->id : null;
        // Metode bayar tidak berubah -> pakai rekening & porsi yang sudah tercatat (aman untuk split/DP booking),
        // hanya nominal disesuaikan ke total baru.
        $same = $cur && (
            ($method === 'SPLIT' && $hasCash && $hasBank)
            || (in_array($method, ['CASH', 'TUNAI'], true) && $hasCash && !$hasBank)
            || ($wantBankId && !$hasCash && $hasBank && count($cur) === 1 && isset($cur['bank:' . $wantBankId]))
        );
        if ($same || ($method === 'SPLIT' && $cur)) {
            $abs = array_sum(array_map('abs', $cur));
            $out = [];
            foreach ($cur as $k => $v) {
                [$m, $id] = explode(':', $k);
                $out[] = ['method' => $m, 'account_id' => (int) $id, 'amount' => round($total * abs($v) / $abs, 2)];
            }
            $out[count($out) - 1]['amount'] = round($total - array_sum(array_column(array_slice($out, 0, -1), 'amount')), 2);
            return $out;
        }
        if ($wantBankId) {
            return [['method' => 'bank', 'account_id' => $wantBankId, 'amount' => $total]];
        }
        return [['method' => 'cash', 'account_id' => $this->cashAccount()->id, 'amount' => $total]];
    }

    /** Posisi bersih yang sudah tercatat: "method:account_id" => +masuk / -keluar. */
    private function currentPayments(string $itemId): array
    {
        $cur = [];
        foreach (ErpPayment::where('transaction_ref', $itemId)->where('status', 'posted')->get() as $p) {
            $k = $p->method . ':' . ($p->method === 'cash' ? $p->cash_account_id : $p->bank_account_id);
            $cur[$k] = ($cur[$k] ?? 0) + (strtoupper((string) $p->direction) === 'IN' ? 1 : -1) * (float) $p->amount;
        }
        return $cur;
    }

    private function applyPayments(string $itemId, string $invoice, array $target, ?int $actor, string $label): int
    {
        $current = $this->currentPayments($itemId);
        $n = ErpPayment::where('transaction_ref', $itemId)->count();
        $made = 0;
        foreach (array_unique(array_merge(array_keys($current), array_keys($target))) as $k) {
            $diff = round(($target[$k] ?? 0) - ($current[$k] ?? 0), 2);
            if (abs($diff) < 0.005) {
                continue;
            }
            [$method, $accountId] = explode(':', $k);
            $accountId = (int) $accountId;
            $direction = $diff > 0 ? 'IN' : 'OUT';
            $amount = abs($diff);
            $n++;
            $key = substr('EDIT:' . $itemId . ':' . $n . ':' . strtoupper($method), 0, 100);
            if ($method === 'bank' && $direction === 'OUT') {
                $acc = ErpBankAccount::whereKey($accountId)->lockForUpdate()->first();
                $bal = (float) $acc->opening_balance + (float) $acc->movements()->sum(\Illuminate\Support\Facades\DB::raw("CASE WHEN direction = 'IN' THEN amount ELSE -amount END"));
                if ($bal - $amount < -0.005) {
                    throw ValidationException::withMessages(['erpPayments' => "Saldo {$acc->bank_name} tidak cukup untuk koreksi transaksi {$invoice}."]);
                }
            }
            $payment = ErpPayment::create([
                'payment_no' => 'PAY-' . now()->format('YmdHisv') . '-' . strtoupper(bin2hex(random_bytes(3))),
                'transaction_ref' => $itemId,
                'method' => $method,
                'direction' => $direction,
                'currency_code' => 'IDR',
                'amount' => $amount,
                'cash_account_id' => $method === 'cash' ? $accountId : null,
                'bank_account_id' => $method === 'bank' ? $accountId : null,
                'reference' => $invoice,
                'idempotency_key' => $key,
                'status' => 'posted',
                'paid_at' => now(),
                'created_by' => $actor,
            ]);
            $mv = [
                'movement_no' => ($method === 'cash' ? 'CSH-' : 'BNK-') . now()->format('YmdHisv') . '-' . strtoupper(bin2hex(random_bytes(3))),
                'direction' => $direction,
                'amount' => $amount,
                'currency_code' => 'IDR',
                'reference_type' => 'payment',
                'reference_id' => $payment->id,
                'idempotency_key' => $key,
                'description' => "{$label} {$invoice}",
                'posted_at' => now(),
                'created_by' => $actor,
            ];
            if ($method === 'cash') {
                ErpCashMovement::create(['cash_account_id' => $accountId] + $mv);
            } else {
                ErpBankMovement::create(['bank_account_id' => $accountId, 'bank_reference' => $invoice] + $mv);
            }
            $made++;
        }
        return $made;
    }

    /* ------------------------------------------------------------------ stok valas */

    private function applyStock(string $itemId, string $currency, float $targetQty, $rate): int
    {
        $current = [];
        foreach (ErpCurrencyStockMovement::where('transaction_ref', $itemId)->get() as $m) {
            $c = strtoupper((string) $m->currency_code);
            $current[$c] = ($current[$c] ?? 0) + (strtoupper((string) $m->movement_type) === 'IN' ? 1 : -1) * (float) $m->quantity;
        }
        $target = $currency !== '' && abs($targetQty) > 0 ? [$currency => $targetQty] : [];
        $n = ErpCurrencyStockMovement::where('transaction_ref', $itemId)->count();
        $made = 0;
        // Tambah stok dulu baru kurangi, agar koreksi antar-valas tidak gagal karena stok sementara minus.
        $keys = array_unique(array_merge(array_keys($current), array_keys($target)));
        usort($keys, fn ($a, $b) => (($target[$a] ?? 0) - ($current[$a] ?? 0)) < (($target[$b] ?? 0) - ($current[$b] ?? 0)) ? 1 : -1);
        foreach ($keys as $c) {
            $diff = round(($target[$c] ?? 0) - ($current[$c] ?? 0), 6);
            if (abs($diff) < 0.000001) {
                continue;
            }
            $n++;
            $this->stock->post($c, $diff > 0 ? 'IN' : 'OUT', abs($diff), $itemId, substr('transaction-stock-' . $itemId . '-adj-' . $n, 0, 100), [
                'correction' => true, 'rate' => $rate,
            ]);
            $made++;
        }
        return $made;
    }

    /* ------------------------------------------------------------------ akun */

    private function cashAccount(): ErpCashAccount
    {
        return ErpCashAccount::where('currency_code', 'IDR')->where('is_active', true)->orderBy('id')->first()
            ?: ErpCashAccount::firstOrCreate(['code' => 'CASH-IDR-01'], ['name' => 'Kas Utama IDR', 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]);
    }

    private function bankAccount(string $bankName): ErpBankAccount
    {
        $bankName = trim($bankName) ?: 'BCA';
        $acc = ErpBankAccount::where('currency_code', 'IDR')->where('is_active', true)
            ->where(fn ($q) => $q->whereRaw('LOWER(bank_name) = ?', [strtolower($bankName)])->orWhereRaw('LOWER(bank_name) LIKE ?', ['%' . strtolower($bankName) . '%']))
            ->orderBy('id')->first();
        if ($acc) {
            return $acc;
        }
        $safe = trim(strtoupper(preg_replace('/[^A-Z0-9]+/i', '-', $bankName)), '-') ?: 'BANK';
        return ErpBankAccount::firstOrCreate(['code' => 'BANK-' . $safe . '-IDR'], ['bank_name' => $bankName, 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]);
    }
}
