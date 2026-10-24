<?php
// @2026-Alifiandra

namespace App\Services;

use App\Models\GoamlAlert;
use App\Models\GoamlAlertTransaction;
use App\Models\Currency;
use App\Models\GoamlRule;
use App\Models\Transaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class GoamlComplianceService
{
    public function evaluateTransaction(Transaction $transaction): Collection
    {
        $alerts = collect();

        foreach (
            GoamlRule::query()
                ->where('is_active', true)
                ->orderBy('priority')
                ->orderBy('id')
                ->get() as $rule
        ) {
            if (strtoupper((string) $rule->target) !== 'CUSTOMER') {
                continue;
            }

            $end = Carbon::parse($transaction->timestamp);

            if (
                $rule->effective_from
                && $end->toDateString() < $rule->effective_from->toDateString()
            ) {
                continue;
            }

            if (
                $rule->effective_until
                && $end->toDateString() > $rule->effective_until->toDateString()
            ) {
                continue;
            }

            $customerId = trim((string) $transaction->id_cif);

            if ($customerId === '') {
                continue;
            }

            /*
             * period_days = rolling window.
             *
             * Contoh:
             * transaksi pemicu  : 08/10/2026 09:00
             * period_days       : 3
             *
             * window:
             * 05/10/2026 09:00
             * sampai
             * 08/10/2026 09:00
             */
            $periodUnit = strtoupper((string) ($rule->period_unit ?: 'DAY'));
            $span = max(1, (int) ($rule->period_days ?: 1));

            /*
             * DAY   : jendela berjalan N hari sebelum transaksi pemicu.
             * MONTH : N bulan kalender, dihitung dari tanggal 1 (00:00) bulan
             *         pertama sampai transaksi pemicu. N = 1 berarti bulan berjalan.
             */
            $start = $periodUnit === 'MONTH'
                ? $end->copy()->startOfMonth()->subMonths($span - 1)
                : $end->copy()->subDays($span);

            $query = Transaction::query()
                ->where('id_cif', $customerId)
                ->whereBetween('timestamp', [$start, $end]);

            if ($rule->payment_method) {
                $query->where('paymentMethod', $rule->payment_method);
            }

            $conditions = is_array($rule->conditions)
                ? $rule->conditions
                : [];

            $transactionType = strtoupper(
                trim((string) ($conditions['transaction_type'] ?? ''))
            );

            if ($transactionType !== '') {
                $query->whereRaw('UPPER(tipe) = ?', [$transactionType]);
            }

            $matched = $query
                ->orderBy('timestamp')
                ->orderBy('itemId')
                ->get();

            $count = $matched->count();

            $totalIdr = (float) $matched->sum(
                fn ($trx) => (float) $trx->total
            );

            $useUsd = strtoupper((string) $rule->amount_unit) === 'USD';
            $usdRate = $useUsd ? $this->usdRate() : null;
            $totalUsd = $useUsd ? $this->usdEquivalentTotal($matched, $usdRate) : null;

            if (!$this->passesCount(
                $count,
                $rule->min_transactions
            )) {
                continue;
            }

            if ($useUsd) {
                $thresholdOk = $this->passesAmount(
                    (float) $totalUsd,
                    $rule->amount_usd !== null ? (float) $rule->amount_usd : null,
                    $rule->amount_operator
                );
            } else {
                $thresholdOk = $this->passesAmount(
                    $totalIdr,
                    $rule->total_amount_idr !== null
                        ? (float) $rule->total_amount_idr
                        : null,
                    $rule->amount_operator
                );
            }

            if (!$thresholdOk) {
                continue;
            }

            /*
             * IMPORTANT:
             *
             * period_end menggunakan timestamp transaksi pemicu,
             * bukan endOfDay().
             *
             * Dengan demikian:
             * - query
             * - alert
             * - reason
             * - snapshot
             *
             * menggunakan definisi window yang sama.
             */
            $periodEnd = $end->copy();

            /*
             * Alert aktif untuk rule + customer + window yang sama.
             *
             * Kita tidak mencari berdasarkan tanggal kalender.
             * Kita tetap menggunakan rolling-window timestamp.
             */
            $existingQuery = GoamlAlert::query()
                ->where('rule_id', $rule->id)
                ->where('customer_id', $customerId)
                ->where('period_start', $start)
                ->whereIn('status', ['OPEN', 'IN_REVIEW']);

            /*
             * Periode bulanan: satu temuan per nasabah per aturan per periode.
             * Transaksi berikutnya pada bulan yang sama memperbarui temuan
             * yang sama (total dan jendela diperbarui), bukan membuat baru.
             */
            if ($periodUnit !== 'MONTH') {
                $existingQuery->where('period_end', $periodEnd);
            }

            $existing = $existingQuery->first();

            if ($existing) {
                $this->syncAlertTransactions($existing, $matched);

                $existing->update([
                    'rule_type' => $rule->rule_type,
                    'result_type' => $rule->result_type,
                    'classification' => $rule->classification,
                    'severity' => $rule->severity,
                    'total_amount_idr' => $totalIdr,
                    'total_amount_usd' => $totalUsd,
                    'transaction_count' => $count,
                    'invoice_summary' => $this->invoiceSummary($matched),
                    'period_end' => $periodEnd,
                    'reason' => $this->reason(
                        $rule,
                        $count,
                        $totalIdr,
                        $start,
                        $periodEnd,
                        $totalUsd
                    ),
                    'snapshot' => $this->snapshot(
                        $rule,
                        $matched,
                        $start,
                        $periodEnd,
                        $totalUsd,
                        $usdRate
                    ),
                ]);

                $alerts->push($existing->fresh());

                continue;
            }

            $alert = DB::transaction(function () use (
                $rule,
                $customerId,
                $transaction,
                $matched,
                $count,
                $totalIdr,
                $totalUsd,
                $usdRate,
                $start,
                $periodEnd
            ) {
                $customerName = trim(
                    (string) ($transaction->customerName ?? '')
                );

                if ($customerName === '') {
                    $customerName = trim(
                        (string) ($matched->first()?->customerName ?? '')
                    );
                }

                $alert = GoamlAlert::create([
                    'rule_id' => $rule->id,
                    'alert_no' => $this->nextAlertNo(),
                    'rule_type' => $rule->rule_type,
                    'result_type' => $rule->result_type,
                    'classification' => $rule->classification,
                    'severity' => $rule->severity,
                    'status' => 'OPEN',
                    'customer_id' => $customerId,
                    'customer_name' => $customerName,
                    'total_amount_idr' => $totalIdr,
                    'total_amount_usd' => $totalUsd,
                    'transaction_count' => $count,
                    'invoice_summary' => $this->invoiceSummary($matched),
                    'period_start' => $start,
                    'period_end' => $periodEnd,
                    'reason' => $this->reason(
                        $rule,
                        $count,
                        $totalIdr,
                        $start,
                        $periodEnd,
                        $totalUsd
                    ),
                    'snapshot' => $this->snapshot(
                        $rule,
                        $matched,
                        $start,
                        $periodEnd,
                        $totalUsd,
                        $usdRate
                    ),
                ]);

                $this->syncAlertTransactions(
                    $alert,
                    $matched
                );

                return $alert;
            });

            $alerts->push($alert);
        }

        return $alerts;
    }

    /**
     * Kurs acuan USD (tengah antara beli dan jual) dari master valuta.
     * Dipakai mengonversi transaksi non-USD menjadi ekuivalen USD.
     */
    protected ?float $usdRateCache = null;

    protected function usdRate(): ?float
    {
        if ($this->usdRateCache !== null) {
            return $this->usdRateCache ?: null;
        }

        $currency = Currency::query()->where('code', 'USD')->first();
        $buy = (float) ($currency->buy ?? 0);
        $sell = (float) ($currency->sell ?? 0);
        $rate = ($buy > 0 && $sell > 0) ? ($buy + $sell) / 2 : max($buy, $sell);

        $this->usdRateCache = $rate > 0 ? $rate : 0.0;

        return $this->usdRateCache ?: null;
    }

    /**
     * Ekuivalen USD: transaksi USD memakai nominalnya langsung; valuta lain
     * dikonversi dari nilai Rupiah dengan kurs acuan USD. Tanpa kurs acuan,
     * transaksi non-USD tidak dapat dikonversi dan dihitung 0.
     */
    protected function usdEquivalentTotal(Collection $transactions, ?float $usdRate): float
    {
        return round((float) $transactions->sum(function ($trx) use ($usdRate) {
            if (strtoupper((string) $trx->valuta) === 'USD') {
                return (float) $trx->nominal;
            }

            return $usdRate ? ((float) $trx->total) / $usdRate : 0.0;
        }), 2);
    }

    protected function passesCount(
        int $actual,
        ?int $minimum
    ): bool {
        return $minimum === null || $actual >= $minimum;
    }

    protected function passesAmount(
        float $actual,
        ?float $threshold,
        ?string $operator
    ): bool {
        if ($threshold === null) {
            return true;
        }

        return match ($operator ?: '>') {
            '>=' => $actual >= $threshold,
            '=' => abs($actual - $threshold) < 0.01,
            '<' => $actual < $threshold,
            '<=' => $actual <= $threshold,
            default => $actual > $threshold,
        };
    }

    /**
     * Sinkronisasi relasi alert -> transaksi.
     *
     * Historical relation tidak dihapus secara otomatis.
     * Transaksi yang sudah tercatat tetap menjadi bagian dari
     * historical evidence alert.
     */
    protected function syncAlertTransactions(
        GoamlAlert $alert,
        Collection $transactions
    ): void {
        foreach ($transactions as $transaction) {
            GoamlAlertTransaction::updateOrCreate(
                [
                    'alert_id' => $alert->id,
                    'transaction_item_id' => $transaction->itemId,
                ],
                [
                    'transaction_invoice_id' => $transaction->id,
                    'amount_idr' => (float) $transaction->total,
                ]
            );
        }
    }

    protected function invoiceSummary(
        Collection $transactions
    ): ?string {
        $invoices = $transactions
            ->pluck('id')
            ->filter(fn ($id) => trim((string) $id) !== '')
            ->unique()
            ->values();

        return $invoices->isEmpty()
            ? null
            : $invoices->implode(', ');
    }

    protected function reason(
        GoamlRule $rule,
        int $count,
        float $totalIdr,
        Carbon $start,
        Carbon $end,
        ?float $totalUsd = null
    ): string {
        $amount = number_format(
            $totalIdr,
            0,
            ',',
            '.'
        );

        $regulation = $rule->regulation_no
            ? ' Dasar: ' . $rule->regulation_no
            : '';

        return $rule->name
            . '. Terdeteksi '
            . $count
            . ' transaksi dengan total Rp'
            . $amount
            . ($totalUsd !== null && strtoupper((string) $rule->amount_unit) === 'USD'
                ? ' (ekuivalen USD ' . number_format($totalUsd, 2, ',', '.') . ')'
                : '')
            . ' pada periode '
            . $start->format('d/m/Y H:i')
            . ' s.d. '
            . $end->format('d/m/Y H:i')
            . '.'
            . $regulation;
    }

    protected function snapshot(
        GoamlRule $rule,
        Collection $transactions,
        Carbon $start,
        Carbon $end,
        ?float $totalUsd = null,
        ?float $usdRate = null
    ): array {
        return [
            'rule_id' => $rule->id,
            'rule_code' => $rule->code,
            'rule_version' => $rule->version,
            'rule_type' => $rule->rule_type,
            'regulation_source' => $rule->regulation_source,
            'regulation_no' => $rule->regulation_no,
            'regulation_article' => $rule->regulation_article,
            'result_type' => $rule->result_type,
            'classification' => $rule->classification,
            'period_unit' => strtoupper((string) ($rule->period_unit ?: 'DAY')),
            'period_span' => (int) ($rule->period_days ?: 1),
            'amount_unit' => strtoupper((string) ($rule->amount_unit ?: 'IDR')),
            'amount_usd_threshold' => $rule->amount_usd !== null ? (float) $rule->amount_usd : null,
            'amount_idr_threshold' => $rule->total_amount_idr !== null ? (float) $rule->total_amount_idr : null,
            'amount_operator' => $rule->amount_operator,
            'total_usd' => $totalUsd,
            'usd_rate' => $usdRate,
            'period_start' => $start->toDateTimeString(),
            'period_end' => $end->toDateTimeString(),
            'transaction_count' => $transactions->count(),
            'invoice_ids' => $transactions
                ->pluck('id')
                ->filter()
                ->unique()
                ->values()
                ->all(),
            'transaction_item_ids' => $transactions
                ->pluck('itemId')
                ->filter()
                ->unique()
                ->values()
                ->all(),
        ];
    }

    /**
     * Membuat nomor alert harian.
     *
     * Unique index pada alert_no tetap menjadi pengaman terakhir
     * terhadap nomor duplikat.
     */
    protected function nextAlertNo(): string
    {
        $prefix = 'GOAML-' . now()->format('Ymd') . '-';

        $last = GoamlAlert::query()
            ->where('alert_no', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('alert_no');

        $sequence = $last
            ? ((int) substr($last, -5)) + 1
            : 1;

        return $prefix . str_pad(
            (string) $sequence,
            5,
            '0',
            STR_PAD_LEFT
        );
    }
}