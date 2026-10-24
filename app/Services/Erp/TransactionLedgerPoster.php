<?php

namespace App\Services\Erp;

use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\Transaction;
use Illuminate\Validation\ValidationException;

/**
 * Mencatat sisi keuangan satu transaksi (kas/bank, stok valuta, settlement)
 * ke ledger ERP. Dipanggil dari dalam transaksi database yang sama dengan
 * penyimpanan transaksi, sehingga keduanya berhasil bersama atau batal bersama.
 *
 * Arah mutasi (masuk/keluar) selalu ditentukan server dari jenis transaksi,
 * bukan dari browser. Kunci idempotensi bersifat deterministik, jadi
 * pengiriman ulang tidak menggandakan mutasi.
 */
class TransactionLedgerPoster
{
    public function __construct(private readonly TransactionPostingService $posting)
    {
    }

    /**
     * @param array<int, array<string, mixed>> $payments Baris: method (cash|bank), amount, bank_name (untuk bank)
     */
    public function post(Transaction $transaction, array $payments, mixed $actorId = null): array
    {
        $itemId = (string) $transaction->itemId;
        $invoiceId = (string) ($transaction->id ?: $itemId);
        $rows = [];

        foreach (array_values($payments) as $index => $payment) {
            if (!is_array($payment)) {
                continue;
            }

            $method = strtolower(trim((string) ($payment['method'] ?? '')));
            $amount = $payment['amount'] ?? null;

            if (!in_array($method, ['cash', 'bank'], true)) {
                throw ValidationException::withMessages([
                    "erpPayments.$index.method" => 'Metode pembayaran ERP harus cash atau bank.',
                ]);
            }

            if (!is_numeric($amount) || (float) $amount <= 0) {
                continue;
            }

            if ($method === 'cash') {
                $account = $this->cashAccount();
                $key = "POS:{$invoiceId}:{$itemId}:CASH";
                $rows[] = [
                    'method' => 'cash',
                    'amount' => (float) $amount,
                    'currency_code' => 'IDR',
                    'cash_account_id' => $account->id,
                    'reference' => $invoiceId,
                    'idempotency_key' => $this->safeKey($key),
                    'description' => "POS Cash {$invoiceId}",
                ];
                continue;
            }

            $bankName = trim((string) ($payment['bank_name'] ?? ''));
            if ($bankName === '') {
                throw ValidationException::withMessages([
                    "erpPayments.$index.bank_name" => 'Nama bank wajib diisi untuk pembayaran transfer.',
                ]);
            }

            $account = $this->bankAccount($bankName);
            $key = "POS:{$invoiceId}:{$itemId}:BANK:".strtoupper($bankName);
            $rows[] = [
                'method' => 'bank',
                'amount' => (float) $amount,
                'currency_code' => 'IDR',
                'bank_account_id' => $account->id,
                'reference' => $invoiceId,
                'bank_reference' => $invoiceId,
                'idempotency_key' => $this->safeKey($key),
                'description' => "POS Transfer {$bankName} {$invoiceId}",
            ];
        }

        if ($rows === []) {
            throw ValidationException::withMessages([
                'erpPayments' => 'Transaksi tidak memiliki pembayaran kas/bank yang valid untuk dicatat.',
            ]);
        }

        // Kolom created_by di ledger bertipe angka; id pengguna aplikasi berupa teks.
        $actor = is_numeric($actorId) ? (int) $actorId : null;

        return $this->posting->post($itemId, $rows, $actor);
    }

    private function safeKey(string $key): string
    {
        return strlen($key) <= 100 ? $key : hash('sha256', $key);
    }

    private function cashAccount(): ErpCashAccount
    {
        $account = ErpCashAccount::query()
            ->where('currency_code', 'IDR')
            ->where('is_active', true)
            ->orderBy('id')
            ->first();

        return $account ?: ErpCashAccount::firstOrCreate(
            ['code' => 'CASH-IDR-01'],
            [
                'name' => 'Kas Utama IDR',
                'currency_code' => 'IDR',
                'opening_balance' => 0,
                'is_active' => true,
            ]
        );
    }

    private function bankAccount(string $bankName): ErpBankAccount
    {
        $account = ErpBankAccount::query()
            ->where('currency_code', 'IDR')
            ->where('is_active', true)
            ->where(function ($query) use ($bankName) {
                $query->whereRaw('LOWER(bank_name) = ?', [strtolower($bankName)])
                    ->orWhereRaw('LOWER(bank_name) LIKE ?', ['%'.strtolower($bankName).'%']);
            })
            ->orderBy('id')
            ->first();

        if ($account) {
            return $account;
        }

        $safe = trim(strtoupper(preg_replace('/[^A-Z0-9]+/i', '-', $bankName)), '-');
        $safe = $safe !== '' ? $safe : 'BANK';

        return ErpBankAccount::firstOrCreate(
            ['code' => 'BANK-'.$safe.'-IDR'],
            [
                'bank_name' => $bankName,
                'account_name' => null,
                'account_number' => null,
                'currency_code' => 'IDR',
                'opening_balance' => 0,
                'is_active' => true,
            ]
        );
    }
}
