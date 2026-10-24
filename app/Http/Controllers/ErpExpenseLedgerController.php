<?php

namespace App\Http\Controllers;

use App\Models\ErpBankAccount;
use App\Models\ErpBankMovement;
use App\Models\ErpCashAccount;
use App\Models\ErpCashMovement;
use App\Models\ErpExpense;
use App\Support\BiAccounts;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/**
 * Jurnal pengeluaran/pendapatan (menu Pengeluaran) dicatat ke ledger kas/bank ERP.
 *
 * Append-only dan idempotent: edit/hapus menambah baris koreksi, tidak mengubah baris lama.
 * Pengeluaran kas memakai reference_type 'expense' sehingga terbaca oleh Closing Harian.
 */
class ErpExpenseLedgerController extends Controller
{
    private const REF_TYPE = 'expense';

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'expenses' => ['nullable', 'array', 'max:2000'],
            'expenses.*.id_pengeluaran' => ['required', 'string', 'max:30'],
            'expenses.*.tipe' => ['required', 'in:PENGELUARAN,PENDAPATAN'],
            'expenses.*.sumber' => ['required', 'string', 'max:50'],
            'expenses.*.nominal' => ['required', 'numeric', 'gt:0'],
            'expenses.*.kategori' => ['nullable', 'string', 'max:150'],
            'expenses.*.deskripsi' => ['nullable', 'string', 'max:500'],
            'expenses.*.timestamp' => ['nullable', 'string', 'max:40'],
            'expenses.*.inputBy' => ['nullable', 'string', 'max:150'],
            'expenses.*.editBy' => ['nullable', 'string', 'max:150'],
            'deleted' => ['nullable', 'array', 'max:2000'],
            'deleted.*' => ['string', 'max:30'],
        ]);

        $actorId = optional($request->user())->id;
        $actorId = is_numeric($actorId) ? (int) $actorId : null;
        $created = 0;

        try {
            DB::transaction(function () use ($data, $actorId, &$created) {
                foreach ($data['expenses'] ?? [] as $row) {
                    $source = strtoupper(trim($row['sumber']));
                    $source = $source === 'BANK' ? 'BCA' : $source; // data lama: BANK = BCA
                    [$kind, $accountId] = $source === 'CASH'
                        ? ['cash', $this->cashAccount()->id]
                        : ['bank', $this->bankAccount($source)->id];
                    $signed = ($row['tipe'] === 'PENDAPATAN' ? 1 : -1) * (float) $row['nominal'];
                    $created += $this->applyTarget($row['id_pengeluaran'], [$kind.':'.$accountId => $signed], $row, $actorId);
                    $this->upsertExpense($row, $source);
                }
                foreach ($data['deleted'] ?? [] as $id) {
                    $created += $this->applyTarget($id, [], [], $actorId);
                    if ($this->hasExpenseTable()) {
                        ErpExpense::query()->where('expense_no', $id)->delete(); // soft delete (jejak audit)
                    }
                }
            });
        } catch (ValidationException $e) {
            return response()->json([
                'status' => 'error',
                'message' => collect($e->errors())->flatten()->first() ?: 'Jurnal ditolak.',
            ], 422);
        }

        return response()->json(['status' => 'success', 'created' => $created]);
    }

    /** GET /erp/expenses?month=YYYY-MM[&type=][&bi_code=] : daftar jurnal dari MySQL. */
    public function index(Request $request): JsonResponse
    {
        if (!$this->hasExpenseTable()) {
            return response()->json(['status' => 'success', 'data' => []]);
        }
        $q = ErpExpense::query()->orderByDesc('occurred_at')->orderByDesc('id');
        if (preg_match('/^\d{4}-\d{2}$/', (string) $request->query('month'))) {
            $start = Carbon::createFromFormat('Y-m-d', $request->query('month').'-01')->startOfMonth();
            $q->whereBetween('occurred_at', [$start, $start->copy()->endOfMonth()]);
        }
        if (in_array($request->query('type'), ['PENGELUARAN', 'PENDAPATAN'], true)) {
            $q->where('type', $request->query('type'));
        }
        if (preg_match('/^\d{2}$/', (string) $request->query('bi_code'))) {
            $q->where('bi_code', $request->query('bi_code'));
        }

        return response()->json(['status' => 'success', 'data' => $q->limit(5000)->get()->map(fn (ErpExpense $e) => [
            'id_pengeluaran' => $e->expense_no,
            'tipe' => $e->type,
            'bi_code' => $e->bi_code,
            'kategori' => $e->category,
            'deskripsi' => $e->description,
            'sumber' => $e->source,
            'nominal' => (float) $e->amount,
            'timestamp' => $e->occurred_at?->format('Y-m-d\TH:i:s'),
            'inputBy' => $e->created_by_name,
            'editBy' => $e->updated_by_name,
        ])->values()]);
    }

    /** GET /erp/expenses/bi-summary?year=YYYY[&month=MM] : total per kode BI (dasar B0003). */
    public function biSummary(Request $request): JsonResponse
    {
        $year = (int) ($request->query('year') ?: now()->year);
        $q = $this->hasExpenseTable() ? ErpExpense::query()->whereYear('occurred_at', $year) : null;
        $month = (string) $request->query('month');
        if ($q && preg_match('/^(0[1-9]|1[0-2])$/', $month)) {
            $q->whereMonth('occurred_at', (int) $month);
        }

        $totals = $q ? $q->selectRaw('bi_code, SUM(amount) AS total, COUNT(*) AS n')->groupBy('bi_code')->get()->keyBy('bi_code') : collect();
        $rows = [];
        foreach (BiAccounts::ACCOUNTS as $code => [$name, $kind]) {
            if ($kind === 'AUTO') {
                continue;
            }
            $rows[] = [
                'bi_code' => (string) $code, 'name' => $name, 'kind' => $kind,
                'total' => (float) ($totals[(string) $code]->total ?? 0),
                'count' => (int) ($totals[(string) $code]->n ?? 0),
            ];
        }

        return response()->json(['status' => 'success', 'data' => ['year' => $year, 'month' => $month ?: null, 'rows' => $rows]]);
    }

    private function hasExpenseTable(): bool
    {
        return Schema::hasTable('erp_expenses');
    }

    private function upsertExpense(array $row, string $source): void
    {
        if (!$this->hasExpenseTable()) {
            return;
        }
        $code = BiAccounts::resolve($row['kategori'] ?? '', $row['tipe']);
        $existing = ErpExpense::withTrashed()->where('expense_no', $row['id_pengeluaran'])->first();
        $payload = [
            'type' => $row['tipe'],
            'bi_code' => $code,
            'category' => BiAccounts::label($code),
            'description' => $row['deskripsi'] ?? null,
            'source' => $source,
            'amount' => round((float) $row['nominal'], 2),
            'occurred_at' => $this->localDateTime($row['timestamp'] ?? null),
        ];
        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }
            $existing->fill($payload + ['updated_by_name' => $row['editBy'] ?? null])->save();
        } else {
            ErpExpense::create($payload + [
                'expense_no' => $row['id_pengeluaran'],
                'created_by_name' => $row['inputBy'] ?? null,
                'updated_by_name' => $row['editBy'] ?? null,
            ]);
        }
    }

    /** Tanggal/jam apa adanya dari browser (tanpa konversi zona) agar sama dengan filter bulan di LKBU. */
    private function localDateTime(?string $value): string
    {
        if ($value && preg_match('/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/', $value, $m)) {
            return $m[1].' '.$m[2];
        }
        if ($value && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value.' 00:00:00';
        }

        return now()->format('Y-m-d H:i:s');
    }

    /**
     * @param array<string,float> $target Efek bersih per rekening ("cash:ID" / "bank:ID"), + masuk / - keluar.
     */
    private function applyTarget(string $expenseId, array $target, array $row, ?int $actorId): int
    {
        $like = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $expenseId).'-%';

        $cashRows = ErpCashMovement::query()->where('reference_type', self::REF_TYPE)
            ->where('movement_no', 'like', $like)->lockForUpdate()->get();
        $bankRows = ErpBankMovement::query()->where('reference_type', self::REF_TYPE)
            ->where('movement_no', 'like', $like)->lockForUpdate()->get();

        $current = [];
        foreach ($cashRows as $m) {
            $current['cash:'.$m->cash_account_id] = ($current['cash:'.$m->cash_account_id] ?? 0)
                + (strtolower((string) $m->direction) === 'in' ? 1 : -1) * (float) $m->amount;
        }
        foreach ($bankRows as $m) {
            $current['bank:'.$m->bank_account_id] = ($current['bank:'.$m->bank_account_id] ?? 0)
                + (strtolower((string) $m->direction) === 'in' ? 1 : -1) * (float) $m->amount;
        }

        $seq = $cashRows->count() + $bankRows->count();
        $isFirst = $seq === 0;
        $created = 0;

        foreach (array_unique(array_merge(array_keys($current), array_keys($target))) as $key) {
            $diff = round(($target[$key] ?? 0) - ($current[$key] ?? 0), 2);
            if (abs($diff) < 0.005) {
                continue;
            }

            [$kind, $accountId] = explode(':', $key);
            $account = $kind === 'cash'
                ? ErpCashAccount::query()->whereKey($accountId)->lockForUpdate()->first()
                : ErpBankAccount::query()->whereKey($accountId)->lockForUpdate()->first();
            $label = $kind === 'cash' ? 'Kas Tunai' : 'Bank '.$account->bank_name;

            if ($diff < 0 && $this->balanceOf($account) + $diff < -0.005) {
                throw ValidationException::withMessages(['nominal' => "Saldo {$label} tidak mencukupi."]);
            }

            $seq++;
            $payload = [
                'movement_no' => substr($expenseId.'-'.str_pad((string) $seq, 2, '0', STR_PAD_LEFT), 0, 50),
                'direction' => $diff > 0 ? 'IN' : 'OUT',
                'amount' => abs($diff),
                'currency_code' => 'IDR',
                'reference_type' => self::REF_TYPE,
                'description' => ($isFirst ? '' : 'Koreksi '.$expenseId.': ')
                    .trim(($row['kategori'] ?? '').' - '.($row['deskripsi'] ?? ''), ' -'),
                'posted_at' => $this->postedAt($row['timestamp'] ?? null),
                'created_by' => $actorId,
            ];

            if ($kind === 'cash') {
                ErpCashMovement::create($payload + ['cash_account_id' => $accountId]);
            } else {
                ErpBankMovement::create($payload + ['bank_account_id' => $accountId, 'bank_reference' => $expenseId]);
            }
            $created++;
        }

        return $created;
    }

    private function balanceOf($account): float
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
            ?? ErpCashAccount::firstOrCreate(
                ['code' => 'CASH-IDR-01'],
                ['name' => 'Kas Utama IDR', 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]
            );
    }

    private function bankAccount(string $bankName): ErpBankAccount
    {
        $name = strtolower(trim($bankName));
        $account = ErpBankAccount::query()
            ->where('currency_code', 'IDR')->where('is_active', true)
            ->where(fn ($q) => $q->whereRaw('LOWER(bank_name) = ?', [$name])
                ->orWhereRaw('LOWER(bank_name) LIKE ?', ['%'.$name.'%']))
            ->orderBy('id')->first();

        if ($account) {
            return $account;
        }

        $safe = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', $bankName));

        return ErpBankAccount::query()->firstOrCreate(
            ['code' => 'BANK-'.$safe.'-IDR'],
            ['bank_name' => strtoupper(trim($bankName)), 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]
        );
    }
}
