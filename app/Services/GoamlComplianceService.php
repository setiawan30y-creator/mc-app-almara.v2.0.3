<?php

namespace App\Services;

use App\Models\GoamlAlert;
use App\Models\GoamlAlertTransaction;
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
            $days = max(1, (int) ($rule->period_days ?: 1));
            $start = $end->copy()->subDays($days);

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

            if (!$this->passesCount(
                $count,
                $rule->min_transactions
            )) {
                continue;
            }

            if (!$this->passesAmount(
                $totalIdr,
                $rule->total_amount_idr !== null
                    ? (float) $rule->total_amount_idr
                    : null,
                $rule->amount_operator
            )) {
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
            $existing = GoamlAlert::query()
                ->where('rule_id', $rule->id)
                ->where('customer_id', $customerId)
                ->where('period_start', $start)
                ->where('period_end', $periodEnd)
                ->whereIn('status', ['OPEN', 'IN_REVIEW'])
                ->first();

            if ($existing) {
                $this->syncAlertTransactions($existing, $matched);

                $existing->update([
                    'rule_type' => $rule->rule_type,
                    'result_type' => $rule->result_type,
                    'classification' => $rule->classification,
                    'severity' => $rule->severity,
                    'total_amount_idr' => $totalIdr,
                    'transaction_count' => $count,
                    'invoice_summary' => $this->invoiceSummary($matched),
                    'reason' => $this->reason(
                        $rule,
                        $count,
                        $totalIdr,
                        $start,
                        $periodEnd
                    ),
                    'snapshot' => $this->snapshot(
                        $rule,
                        $matched,
                        $start,
                        $periodEnd
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
                    'transaction_count' => $count,
                    'invoice_summary' => $this->invoiceSummary($matched),
                    'period_start' => $start,
                    'period_end' => $periodEnd,
                    'reason' => $this->reason(
                        $rule,
                        $count,
                        $totalIdr,
                        $start,
                        $periodEnd
                    ),
                    'snapshot' => $this->snapshot(
                        $rule,
                        $matched,
                        $start,
                        $periodEnd
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
        Carbon $end
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
        Carbon $end
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