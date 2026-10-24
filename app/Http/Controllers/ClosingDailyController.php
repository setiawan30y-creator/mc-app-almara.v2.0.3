<?php

namespace App\Http\Controllers;

use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\ErpCashClosing;
use App\Models\ErpCashClosingDenomination;
use App\Models\ErpCurrencyStock;
use App\Models\ErpCurrencyStockMovement;
use App\Models\ErpGantungan;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * API Closing Harian (JSON) untuk halaman Closing Harian di dashboard.
 * Semua angka berasal dari ledger ERP (kas, bank, stok valas) dan mc_transactions.
 * Sisi server menghitung ulang kas fisik dari pecahan, jadi angka dari browser tidak dipercaya begitu saja.
 */
class ClosingDailyController extends Controller
{
    /** Pecahan rupiah yang dihitung saat closing (kertas + koin). */
    private const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];

    /** Role yang boleh menutup closing walau masih ada selisih. */
    private const VARIANCE_ROLES = ['owner', 'superadmin', 'admin', 'supervisor'];

    private const REF_LABELS = [
        'expense' => 'Pengeluaran',
        'manual_mutation' => 'Mutasi manual',
        'opening_balance' => 'Saldo awal',
        'payment' => 'Pembayaran transaksi',
        'transaction' => 'Transaksi valas',
    ];

    // ------------------------------------------------------------------
    // Endpoint
    // ------------------------------------------------------------------

    public function day(Request $request): JsonResponse
    {
        $date = $this->parseDate($request->query('date'));

        return response()->json(['status' => 'success', 'data' => $this->buildDay($date)]);
    }

    public function history(Request $request): JsonResponse
    {
        $query = ErpCashClosing::query()->orderByDesc('closing_date');

        $month = (string) $request->query('month', '');
        if (preg_match('/^\d{4}-\d{2}$/', $month)) {
            $query->where('closing_date', '>=', $month . '-01')
                ->where('closing_date', '<=', Carbon::parse($month . '-01')->endOfMonth()->toDateString());
        }
        $status = strtoupper((string) $request->query('status', ''));
        if ($status !== '' && preg_match('/^[A-Z_]{3,20}$/', $status)) {
            $query->where('status', $status);
        }

        $rows = $query->limit(200)->get();
        $closers = $this->closerNames($rows->pluck('id')->all());

        $items = $rows->map(fn (ErpCashClosing $c) => $this->closingRow($c, $closers[$c->id] ?? null))->values();

        $variance = $items->filter(fn ($i) => abs($i['difference']) >= 0.005);
        $stats = [
            'total' => $items->count(),
            'closed' => $items->where('status', 'CLOSED')->count(),
            'open' => $items->where('status', '!=', 'CLOSED')->count(),
            'variance_days' => $variance->count(),
            'variance_net' => round($variance->sum('difference'), 2),
            'variance_abs' => round($variance->sum(fn ($i) => abs($i['difference'])), 2),
        ];

        return response()->json(['status' => 'success', 'data' => ['items' => $items, 'stats' => $stats]]);
    }

    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'mode' => ['required', 'in:temporary,final'],
            'denominations' => ['nullable', 'array', 'max:40'],
            'denominations.*.denomination' => ['required', 'integer'],
            'denominations.*.quantity' => ['required', 'integer', 'min:0', 'max:10000000'],
            'stock_counts' => ['nullable', 'array', 'max:80'],
            'stock_counts.*.currency_code' => ['required', 'string', 'max:10'],
            'stock_counts.*.physical_qty' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'accept_variance' => ['nullable', 'boolean'],
        ]);

        $date = $data['date'];
        if ($date > now()->toDateString()) {
            return $this->fail('Tanggal closing tidak boleh di masa depan.');
        }

        $mode = $data['mode'];
        $notes = trim((string) ($data['notes'] ?? ''));
        $acceptVariance = (bool) ($data['accept_variance'] ?? false);
        $user = $request->user();
        $role = strtolower((string) ($user->role ?? ''));

        try {
            DB::transaction(function () use ($data, $date, $mode, $notes, $acceptVariance, $user, $role) {
                $account = $this->cashAccount(true);
                $summary = $this->cashSummary($date, $account);

                $closing = ErpCashClosing::whereDate('closing_date', $date)->lockForUpdate()->first()
                    ?? new ErpCashClosing(['closing_date' => $date]);

                if ($closing->exists && $closing->status === 'CLOSED') {
                    throw new \DomainException('Closing tanggal ini sudah dikunci (CLOSED). Minta Owner atau Superadmin untuk membukanya kembali.');
                }

                $rows = $this->cleanDenominations($data['denominations'] ?? []);
                $physical = (float) array_sum(array_map(fn ($r) => $r['denomination'] * $r['quantity'], $rows));
                $hanging = (float) $summary['hanging_amount'];
                $accounted = $physical + $hanging;
                $difference = round($accounted - (float) $summary['expected_cash'], 2);
                $balanced = abs($difference) < 0.005;

                $action = 'SAVE_TEMPORARY';
                if ($mode === 'temporary') {
                    $status = 'TEMPORARY';
                } elseif ($balanced) {
                    $status = 'CLOSED';
                    $action = 'FINALIZE';
                } elseif ($acceptVariance) {
                    if (!in_array($role, self::VARIANCE_ROLES, true)) {
                        throw new \DomainException('Role Anda tidak boleh menutup closing dengan selisih. Hubungi Supervisor atau Admin.');
                    }
                    if (mb_strlen($notes) < 10) {
                        throw new \DomainException('Closing dengan selisih wajib disertai alasan minimal 10 karakter.');
                    }
                    $status = 'CLOSED';
                    $action = 'FINALIZE_VARIANCE';
                } else {
                    throw new \DomainException('Closing belum bisa dikunci karena masih ada selisih ' . number_format(abs($difference), 0, ',', '.') . '. Perbaiki hitungan atau pilih tutup dengan selisih beserta alasannya.');
                }

                $actorId = $this->actorId($user);
                $closing->fill([
                    'closing_no' => $closing->closing_no ?: 'CLS-' . date('Ymd', strtotime($date)) . '-' . Str::upper(Str::random(4)),
                    'opening_cash' => $summary['opening_cash'],
                    'cash_in' => $summary['cash_in'],
                    'cash_out' => $summary['cash_out'],
                    'expense' => $summary['expense'],
                    'expected_cash' => $summary['expected_cash'],
                    'physical_cash' => $physical,
                    'hanging_amount' => $hanging,
                    'accounted_cash' => $accounted,
                    'difference' => $difference,
                    'status' => $status,
                    'notes' => $notes !== '' ? $notes : null,
                    'closed_by' => $status === 'CLOSED' ? $actorId : null,
                    'closed_at' => $status === 'CLOSED' ? now() : null,
                ]);
                $closing->created_by = $closing->created_by ?: $actorId;
                $closing->updated_by = $actorId;
                $closing->save();

                $closing->denominations()->delete();
                foreach ($rows as $row) {
                    ErpCashClosingDenomination::create([
                        'closing_id' => $closing->id,
                        'currency_code' => 'IDR',
                        'denomination' => $row['denomination'],
                        'quantity' => $row['quantity'],
                        'amount' => $row['denomination'] * $row['quantity'],
                    ]);
                }

                $this->saveStockCounts($closing, $date, $data['stock_counts'] ?? []);

                $this->log($closing->id, $date, $action, $user, [
                    'physical' => $physical,
                    'expected' => (float) $summary['expected_cash'],
                    'hanging' => $hanging,
                    'difference' => $difference,
                    'notes' => $notes,
                ]);
            }, 3);
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage());
        }

        $message = [
            'temporary' => 'Hitungan tersimpan sementara. Belum dikunci.',
            'final' => 'Closing berhasil dikunci.',
        ][$mode];

        return response()->json(['status' => 'success', 'message' => $message, 'data' => $this->buildDay($date)]);
    }

    public function reopen(Request $request, string $date): JsonResponse
    {
        $date = $this->parseDate($date);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);

        try {
            DB::transaction(function () use ($date, $data, $request) {
                $closing = ErpCashClosing::whereDate('closing_date', $date)->lockForUpdate()->first();
                if (!$closing) {
                    throw new \DomainException('Closing tanggal ini belum ada.');
                }
                if ($closing->status !== 'CLOSED') {
                    throw new \DomainException('Closing tanggal ini belum dikunci, jadi tidak perlu dibuka kembali.');
                }

                $closing->update([
                    'status' => 'TEMPORARY',
                    'closed_by' => null,
                    'closed_at' => null,
                    'updated_by' => $this->actorId($request->user()),
                ]);
                $this->log($closing->id, $date, 'REOPEN', $request->user(), ['reason' => $data['reason']]);
            }, 3);
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage());
        }

        return response()->json(['status' => 'success', 'message' => 'Closing dibuka kembali. Hitung ulang lalu kunci lagi.', 'data' => $this->buildDay($date)]);
    }

    // ------------------------------------------------------------------
    // Pembangun data hari closing
    // ------------------------------------------------------------------

    private function buildDay(string $date): array
    {
        $today = now()->toDateString();
        $account = $this->cashAccount(false);
        $cash = $this->cashSummary($date, $account);
        $closing = ErpCashClosing::with('denominations')->whereDate('closing_date', $date)->first();

        $banks = $this->bankSummary($date);
        $stocks = $this->stockSummary($date, $closing, $date === $today);
        $gantungan = $this->gantunganList($date);

        return [
            'date' => $date,
            'is_today' => $date === $today,
            'is_future' => $date > $today,
            'cash' => [
                'opening' => $cash['opening_cash'],
                'in' => $cash['cash_in'],
                'out' => $cash['cash_out'],
                'expense' => $cash['expense'],
                'expected' => $cash['expected_cash'],
                'hanging' => $cash['hanging_amount'],
                'movement_count' => $cash['movement_count'],
                'has_account' => $account !== null,
            ],
            'flows' => $cash['flows'],
            'banks' => $banks,
            'stocks' => $stocks,
            'trades' => $this->tradeSummary($date),
            'expenses' => $this->expenseList($date, $account),
            'gantungan' => $gantungan,
            'closing' => $closing ? $this->closingDetail($closing) : null,
            'unclosed_days' => $this->unclosedDays($date, $account),
            'checks' => $this->checks($date, $account, $closing, $stocks, $gantungan, $banks),
        ];
    }

    private function cashSummary(string $date, ?ErpCashAccount $account): array
    {
        $start = $date . ' 00:00:00';
        $end = $date . ' 23:59:59';

        $empty = [
            'opening_cash' => 0.0, 'cash_in' => 0.0, 'cash_out' => 0.0, 'expense' => 0.0,
            'expected_cash' => 0.0, 'hanging_amount' => $this->hangingAt($end),
            'movement_count' => 0, 'flows' => [],
        ];
        if (!$account) {
            return $empty;
        }

        $opening = (float) $account->opening_balance
            + (float) $account->movements()
                ->where('posted_at', '<', $start)
                ->sum(DB::raw("CASE WHEN direction = 'IN' THEN amount ELSE -amount END"));

        $day = $account->movements()->whereBetween('posted_at', [$start, $end]);
        $in = (float) (clone $day)->where('direction', 'IN')->sum('amount');
        $out = (float) (clone $day)->where('direction', 'OUT')->sum('amount');
        $expense = (float) (clone $day)->where('direction', 'OUT')->where('reference_type', 'expense')->sum('amount');
        $count = (int) (clone $day)->count();

        $flows = (clone $day)
            ->select('direction', 'reference_type', DB::raw('COUNT(*) as n'), DB::raw('SUM(amount) as total'))
            ->groupBy('direction', 'reference_type')
            ->orderBy('direction')
            ->get()
            ->map(fn ($r) => [
                'direction' => $r->direction,
                'label' => self::REF_LABELS[$r->reference_type] ?? ($r->reference_type ? Str::headline($r->reference_type) : 'Lainnya'),
                'count' => (int) $r->n,
                'total' => (float) $r->total,
            ])->values()->all();

        return [
            'opening_cash' => $opening,
            'cash_in' => $in,
            'cash_out' => $out,
            'expense' => $expense,
            'expected_cash' => $opening + $in - $out,
            'hanging_amount' => $this->hangingAt($end),
            'movement_count' => $count,
            'flows' => $flows,
        ];
    }

    /** Nilai bersih gantungan (Rp di luar laci dikurangi kembalian menggantung) pada akhir hari closing. */
    private function hangingAt(string $cutoff): float
    {
        return ErpGantungan::netAt($cutoff);
    }

    /** Sisa gantungan per catatan pada akhir hari closing (sisa setelah cicilan). */
    private function gantunganList(string $date): array
    {
        $end = $date . ' 23:59:59';

        return ErpGantungan::openAt($end)
            ->take(200)
            ->map(fn ($g) => [
                'reference_no' => $g->reference_no,
                'recipient' => $g->recipient,
                'type' => $g->type,
                'category' => $g->category,
                'original' => (float) $g->amount_rp,
                'amount' => (float) $g->signed_calc,
                'remaining' => (float) $g->remaining_calc,
                'occurred_at' => optional($g->occurred_at)->toIso8601String(),
                'description' => $g->description,
            ])->values()->all();
    }

    private function bankSummary(string $date): array
    {
        $start = $date . ' 00:00:00';
        $end = $date . ' 23:59:59';

        return ErpBankAccount::where('is_active', true)->orderBy('code')->get()->map(function (ErpBankAccount $b) use ($start, $end) {
            $opening = (float) $b->opening_balance
                + (float) $b->movements()->where('posted_at', '<', $start)
                    ->sum(DB::raw("CASE WHEN direction = 'IN' THEN amount ELSE -amount END"));
            $day = $b->movements()->whereBetween('posted_at', [$start, $end]);
            $in = (float) (clone $day)->where('direction', 'IN')->sum('amount');
            $out = (float) (clone $day)->where('direction', 'OUT')->sum('amount');

            return [
                'id' => $b->id,
                'code' => $b->code,
                'bank_name' => $b->bank_name,
                'account_number' => $b->account_number,
                'currency_code' => $b->currency_code,
                'opening' => $opening,
                'in' => $in,
                'out' => $out,
                'closing' => $opening + $in - $out,
                'count' => (int) (clone $day)->count(),
            ];
        })->values()->all();
    }

    private function stockSummary(string $date, ?ErpCashClosing $closing, bool $isToday): array
    {
        $end = $date . ' 23:59:59';
        $counts = [];
        if ($closing && Schema::hasTable('erp_cash_closing_stock_counts')) {
            $counts = DB::table('erp_cash_closing_stock_counts')->where('closing_id', $closing->id)->get()->keyBy('currency_code');
        }
        $rates = $this->currencyRates();

        return ErpCurrencyStock::orderBy('currency_code')->get()->map(function (ErpCurrencyStock $s) use ($end, $isToday, $counts, $rates) {
            $qty = (float) $s->quantity;
            if (!$isToday) {
                $last = ErpCurrencyStockMovement::where('currency_stock_id', $s->id)
                    ->where('posted_at', '<=', $end)
                    ->orderByDesc('posted_at')->orderByDesc('id')->first();
                $qty = $last ? (float) $last->balance_after : 0.0;
            }
            $saved = $counts[$s->currency_code] ?? null;
            $rate = $rates[$s->currency_code] ?? 0.0;

            return [
                'currency_code' => $s->currency_code,
                'system_qty' => $qty,
                'rate' => $rate,
                'value' => round($qty * $rate, 2),
                'physical_qty' => $saved ? (float) $saved->physical_qty : null,
                'saved_system_qty' => $saved ? (float) $saved->system_qty : null,
            ];
        })->filter(fn ($row) => abs($row['system_qty']) > 0 || $row['physical_qty'] !== null)->values()->all();
    }

    /** Kurs valuasi per valuta: rata-rata beli bila ada, jika tidak kurs beli saat ini. */
    private function currencyRates(): array
    {
        if (!Schema::hasTable('mc_currencies')) {
            return [];
        }
        $rates = [];
        foreach (DB::table('mc_currencies')->get(['code', 'buy', 'raw_json']) as $row) {
            $raw = is_string($row->raw_json) ? json_decode($row->raw_json, true) : null;
            $avg = is_array($raw) ? (float) ($raw['avg_buy_rate'] ?? 0) : 0.0;
            $rates[strtoupper((string) $row->code)] = $avg > 0 ? $avg : (float) $row->buy;
        }

        return $rates;
    }

    private function tradeSummary(string $date): array
    {
        if (!Schema::hasTable('mc_transactions')) {
            return ['count' => 0, 'buy_total' => 0, 'sell_total' => 0, 'by_currency' => [], 'by_payment' => []];
        }
        $base = DB::table('mc_transactions')->whereBetween('timestamp', [$date . ' 00:00:00', $date . ' 23:59:59']);

        $byCurrency = (clone $base)
            ->select('valuta', 'tipe', DB::raw('COUNT(*) as n'), DB::raw('SUM(nominal) as qty'), DB::raw('SUM(total) as total'))
            ->groupBy('valuta', 'tipe')->orderBy('valuta')->get();

        $buyTotal = (float) $byCurrency->where('tipe', 'BELI')->sum('total');
        $sellTotal = (float) $byCurrency->where('tipe', 'JUAL')->sum('total');

        $byPayment = (clone $base)
            ->select(DB::raw("COALESCE(NULLIF(paymentMethod, ''), 'Tidak dicatat') as method"), 'tipe', DB::raw('COUNT(*) as n'), DB::raw('SUM(total) as total'))
            ->groupBy('method', 'tipe')->get();

        return [
            'count' => (int) $byCurrency->sum('n'),
            'buy_total' => $buyTotal,
            'sell_total' => $sellTotal,
            'by_currency' => $byCurrency->map(fn ($r) => [
                'currency' => $r->valuta, 'type' => $r->tipe, 'count' => (int) $r->n,
                'qty' => (float) $r->qty, 'total' => (float) $r->total,
            ])->values()->all(),
            'by_payment' => $byPayment->map(fn ($r) => [
                'method' => $r->method, 'type' => $r->tipe, 'count' => (int) $r->n, 'total' => (float) $r->total,
            ])->values()->all(),
        ];
    }

    private function expenseList(string $date, ?ErpCashAccount $account): array
    {
        if (!$account) {
            return [];
        }

        return $account->movements()
            ->whereBetween('posted_at', [$date . ' 00:00:00', $date . ' 23:59:59'])
            ->where('direction', 'OUT')->where('reference_type', 'expense')
            ->orderBy('posted_at')->limit(100)->get()
            ->map(fn ($m) => [
                'description' => $m->description,
                'amount' => (float) $m->amount,
                'posted_at' => optional($m->posted_at)->toIso8601String(),
            ])->values()->all();
    }

    /** Tanggal sebelum $date yang punya mutasi kas tetapi belum dikunci closing-nya. */
    private function unclosedDays(string $date, ?ErpCashAccount $account): array
    {
        if (!$account) {
            return [];
        }
        $lastClosed = ErpCashClosing::where('status', 'CLOSED')->where('closing_date', '<', $date)->max('closing_date');
        $from = $lastClosed ? Carbon::parse($lastClosed)->addDay()->toDateString() : Carbon::parse($date)->subDays(30)->toDateString();
        if ($from >= $date) {
            return [];
        }

        $days = $account->movements()
            ->where('posted_at', '>=', $from . ' 00:00:00')
            ->where('posted_at', '<', $date . ' 00:00:00')
            ->select(DB::raw('DATE(posted_at) as d'))
            ->groupBy('d')->orderBy('d')->pluck('d')->all();

        $closedDays = ErpCashClosing::where('status', 'CLOSED')->whereIn('closing_date', $days)->pluck('closing_date')
            ->map(fn ($d) => Carbon::parse($d)->toDateString())->all();

        return array_values(array_diff($days, $closedDays));
    }

    private function checks(string $date, ?ErpCashAccount $account, ?ErpCashClosing $closing, array $stocks, array $gantungan, array $banks): array
    {
        $checks = [];
        $unclosed = $this->unclosedDays($date, $account);
        $checks[] = $unclosed
            ? ['key' => 'previous', 'level' => 'warn', 'label' => 'Ada hari sebelumnya yang belum dikunci', 'detail' => implode(', ', array_slice($unclosed, 0, 6)) . (count($unclosed) > 6 ? ' dan lainnya' : '')]
            : ['key' => 'previous', 'level' => 'ok', 'label' => 'Hari-hari sebelumnya sudah dikunci', 'detail' => null];

        $checks[] = $account
            ? ['key' => 'cash', 'level' => 'ok', 'label' => 'Akun kas IDR tersedia di ledger', 'detail' => null]
            : ['key' => 'cash', 'level' => 'bad', 'label' => 'Akun kas IDR belum ada di ledger', 'detail' => 'Isi saldo awal kas di Pengaturan terlebih dahulu.'];

        $hangNames = collect($gantungan)->pluck('recipient')->map(fn ($n) => mb_strtolower(trim((string) $n)))->unique()->count();
        $hangNet = (float) collect($gantungan)->sum('amount');
        $checks[] = $gantungan
            ? ['key' => 'hanging', 'level' => 'warn', 'label' => $hangNames . ' nama masih punya gantungan (Rp ' . number_format(abs($hangNet), 0, ',', '.') . ')', 'detail' => 'Rp yang masih di luar laci dihitung sebagai kas yang dipertanggungjawabkan.']
            : ['key' => 'hanging', 'level' => 'ok', 'label' => 'Tidak ada gantungan tersisa', 'detail' => null];

        $hasStock = collect($stocks)->contains(fn ($s) => abs($s['system_qty']) > 0);
        if ($hasStock) {
            $counted = collect($stocks)->filter(fn ($s) => $s['physical_qty'] !== null)->count();
            $checks[] = $counted === 0
                ? ['key' => 'stock', 'level' => 'warn', 'label' => 'Stok valas belum dihitung fisik', 'detail' => 'Isi hitungan fisik valas agar selisih stok tercatat.']
                : ['key' => 'stock', 'level' => 'ok', 'label' => 'Stok valas sudah dihitung fisik', 'detail' => $counted . ' valuta dicatat.'];
        }

        $checks[] = $banks
            ? ['key' => 'bank', 'level' => 'ok', 'label' => count($banks) . ' rekening bank tercatat di ledger', 'detail' => 'Cocokkan saldo akhir dengan rekening koran.']
            : ['key' => 'bank', 'level' => 'info', 'label' => 'Belum ada rekening bank di ledger', 'detail' => null];

        if ($closing && $closing->status === 'CLOSED') {
            $checks[] = ['key' => 'locked', 'level' => 'ok', 'label' => 'Closing sudah dikunci', 'detail' => null];
        }

        return $checks;
    }

    // ------------------------------------------------------------------
    // Closing: bentuk data & penyimpanan
    // ------------------------------------------------------------------

    private function closingRow(ErpCashClosing $c, ?string $closer): array
    {
        return [
            'id' => $c->id,
            'closing_no' => $c->closing_no,
            'date' => $c->closing_date->toDateString(),
            'status' => $c->status,
            'opening_cash' => (float) $c->opening_cash,
            'cash_in' => (float) $c->cash_in,
            'cash_out' => (float) $c->cash_out,
            'expense' => (float) $c->expense,
            'expected_cash' => (float) $c->expected_cash,
            'physical_cash' => (float) $c->physical_cash,
            'hanging_amount' => (float) $c->hanging_amount,
            'accounted_cash' => (float) $c->accounted_cash,
            'difference' => (float) $c->difference,
            'notes' => $c->notes,
            'closed_at' => optional($c->closed_at)->toIso8601String(),
            'closed_by_name' => $closer,
        ];
    }

    private function closingDetail(ErpCashClosing $c): array
    {
        $closers = $this->closerNames([$c->id]);
        $row = $this->closingRow($c, $closers[$c->id] ?? null);
        $row['denominations'] = $c->denominations->map(fn ($d) => [
            'denomination' => (int) $d->denomination, 'quantity' => (int) $d->quantity,
        ])->values()->all();

        $row['stock_counts'] = Schema::hasTable('erp_cash_closing_stock_counts')
            ? DB::table('erp_cash_closing_stock_counts')->where('closing_id', $c->id)->orderBy('currency_code')->get()
                ->map(fn ($s) => [
                    'currency_code' => $s->currency_code,
                    'system_qty' => (float) $s->system_qty,
                    'physical_qty' => (float) $s->physical_qty,
                    'difference' => (float) $s->difference,
                    'rate' => (float) $s->rate,
                    'difference_value' => (float) $s->difference_value,
                ])->values()->all()
            : [];

        $row['logs'] = Schema::hasTable('erp_cash_closing_logs')
            ? DB::table('erp_cash_closing_logs')->where('closing_date', $c->closing_date->toDateString())
                ->orderByDesc('id')->limit(30)->get()
                ->map(fn ($l) => [
                    'action' => $l->action,
                    'user_name' => $l->user_name,
                    'detail' => json_decode((string) $l->detail, true),
                    'created_at' => Carbon::parse($l->created_at)->toIso8601String(),
                ])->values()->all()
            : [];

        return $row;
    }

    /** @return array<int,string> closing_id => nama pengunci terakhir */
    private function closerNames(array $ids): array
    {
        if (!$ids || !Schema::hasTable('erp_cash_closing_logs')) {
            return [];
        }
        $out = [];
        $rows = DB::table('erp_cash_closing_logs')
            ->whereIn('closing_id', $ids)->whereIn('action', ['FINALIZE', 'FINALIZE_VARIANCE'])
            ->orderBy('id')->get(['closing_id', 'user_name']);
        foreach ($rows as $r) {
            $out[$r->closing_id] = $r->user_name;
        }

        return $out;
    }

    private function cleanDenominations(array $rows): array
    {
        $merged = [];
        foreach ($rows as $row) {
            $denom = (int) ($row['denomination'] ?? 0);
            $qty = max(0, (int) ($row['quantity'] ?? 0));
            if (!in_array($denom, self::DENOMS, true) || $qty < 1) {
                continue;
            }
            $merged[$denom] = ($merged[$denom] ?? 0) + $qty;
        }
        krsort($merged);

        return array_map(fn ($d, $q) => ['denomination' => $d, 'quantity' => $q], array_keys($merged), array_values($merged));
    }

    private function saveStockCounts(ErpCashClosing $closing, string $date, array $counts): void
    {
        if (!Schema::hasTable('erp_cash_closing_stock_counts')) {
            return;
        }
        DB::table('erp_cash_closing_stock_counts')->where('closing_id', $closing->id)->delete();
        if (!$counts) {
            return;
        }

        $system = collect($this->stockSummary($date, null, $date === now()->toDateString()))->keyBy('currency_code');
        $now = now();
        foreach ($counts as $row) {
            $code = strtoupper(trim((string) ($row['currency_code'] ?? '')));
            if ($code === '' || !isset($system[$code])) {
                continue;
            }
            $sys = (float) $system[$code]['system_qty'];
            $phys = (float) $row['physical_qty'];
            $rate = (float) $system[$code]['rate'];
            DB::table('erp_cash_closing_stock_counts')->insert([
                'closing_id' => $closing->id,
                'currency_code' => $code,
                'system_qty' => $sys,
                'physical_qty' => $phys,
                'difference' => $phys - $sys,
                'rate' => $rate,
                'difference_value' => round(($phys - $sys) * $rate, 2),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    // ------------------------------------------------------------------
    // Util
    // ------------------------------------------------------------------

    private function log(?int $closingId, string $date, string $action, $user, array $detail): void
    {
        if (!Schema::hasTable('erp_cash_closing_logs')) {
            return;
        }
        DB::table('erp_cash_closing_logs')->insert([
            'closing_id' => $closingId,
            'closing_date' => $date,
            'action' => $action,
            'user_id' => $user ? (string) $user->getAuthIdentifier() : null,
            'user_name' => $this->actorName($user),
            'detail' => json_encode($detail, JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
        ]);
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

    private function parseDate(?string $value): string
    {
        if ($value && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            [$y, $m, $d] = array_map('intval', explode('-', $value));
            if (checkdate($m, $d, $y)) {
                return $value;
            }
        }

        return now()->toDateString();
    }

    private function cashAccount(bool $createAndLock): ?ErpCashAccount
    {
        $query = ErpCashAccount::where('currency_code', 'IDR')->where('is_active', true)->orderBy('id');
        $account = $createAndLock ? $query->lockForUpdate()->first() : $query->first();

        if ($account || !$createAndLock) {
            return $account;
        }

        return ErpCashAccount::firstOrCreate(
            ['code' => 'CASH-IDR-01'],
            ['name' => 'Kas Utama IDR', 'currency_code' => 'IDR', 'opening_balance' => 0, 'is_active' => true]
        );
    }

    private function fail(string $message, int $status = 422): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => $message], $status);
    }
}
