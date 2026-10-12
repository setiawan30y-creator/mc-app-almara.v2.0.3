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

        foreach (GoamlRule::query()
            ->where('is_active', true)
            ->orderBy('priority')
            ->get() as $rule) {

            if ($rule->target !== 'CUSTOMER') {
                continue;
            }

            $end = Carbon::parse($transaction->timestamp);

            if ($rule->effective_from && $end->toDateString() < $rule->effective_from->toDateString()) {
                continue;
            }

            if ($rule->effective_until && $end->toDateString() > $rule->effective_until->toDateString()) {
                continue;
            }

            $customerId = trim((string) $transaction->id_cif);

            if ($customerId === '') {
                continue;
            }

            $days = max(1, (int) ($rule->period_days ?: 1));
            $start = $end->copy()->subDays($days);

            $query = Transaction::query()
                ->where('id_cif', $customerId)
                ->whereBetween('timestamp', [$start, $end]);

            if ($rule->payment_method) {
                $query->where('paymentMethod', $rule->payment_method);
            }

            $conditions = is_array($rule->conditions) ? $rule->conditions : [];
            $transactionType = strtoupper(trim((string) ($conditions['transaction_type'] ?? '')));
            if ($transactionType !== '') {
                $query->whereRaw('UPPER(tipe) = ?', [$transactionType]);
            }

            $matched = $query
                ->orderBy('timestamp')
                ->orderBy('itemId')
                ->get();

            $count = $matched->count();
            $totalIdr = (float) $matched->sum(fn ($trx) => (float) $trx->total);

            if (!$this->passesCount($count, $rule->min_transactions)) {
                continue;
            }

            if (!$this->passesAmount($totalIdr, (float) $rule->total_amount_idr, $rule->amount_operator)) {
                continue;
            }

            $periodEnd = $end->copy()->endOfDay();

            $existing = GoamlAlert::query()
                ->where('rule_id', $rule->id)
                ->where('customer_id', $customerId)
                ->where('period_end', $periodEnd)
                ->whereIn('status', ['OPEN', 'IN_REVIEW'])
                ->first();

            if ($existing) {
                $this->syncAlertTransactions($existing, $matched);
                $existing->update([
                    'result_type' => $rule->result_type,
                    'total_amount_idr' => $totalIdr,
                    'transaction_count' => $count,
                    'invoice_summary' => $matched->pluck('id')->filter()->implode(', '),
                    'snapshot' => $this->snapshot($rule, $matched, $start, $end),
                ]);
                $alerts->push($existing->fresh());
                continue;
            }

            $alert = DB::transaction(function () use ($rule, $customerId, $transaction, $matched, $count, $totalIdr, $start, $end, $periodEnd) {
                $alert = GoamlAlert::create([
                    'rule_id' => $rule->id,
                    'alert_no' => $this->nextAlertNo(),
                    'rule_type' => $rule->rule_type,
                    'result_type' => $rule->result_type,
                    'classification' => $rule->classification,
                    'severity' => $rule->severity,
                    'status' => 'OPEN',
                    'customer_id' => $customerId,
                    'customer_name' => $transaction->customerName ?: $matched->first()?->customerName,
                    'total_amount_idr' => $totalIdr,
                    'transaction_count' => $count,
                    'invoice_summary' => $matched->pluck('id')->filter()->implode(', '),
                    'period_start' => $start,
                    'period_end' => $periodEnd,
                    'reason' => $this->reason($rule, $count, $totalIdr, $start, $end),
                    'snapshot' => $this->snapshot($rule, $matched, $start, $end),
                ]);

                $this->syncAlertTransactions($alert, $matched);

                return $alert;
            });

            $alerts->push($alert);
        }

        return $alerts;
    }

    protected function passesCount(int $actual, ?int $minimum): bool
    {
        return $minimum === null || $actual >= $minimum;
    }

    protected function passesAmount(float $actual, ?float $threshold, ?string $operator): bool
    {
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

    protected function syncAlertTransactions(GoamlAlert $alert, Collection $transactions): void
    {
        foreach ($transactions as $transaction) {
            GoamlAlertTransaction::firstOrCreate(
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

    protected function reason(GoamlRule $rule, int $count, float $totalIdr, Carbon $start, Carbon $end): string
    {
        $amount = number_format($totalIdr, 0, ',', '.');
        $regulation = $rule->regulation_no
            ? ' Dasar: ' . $rule->regulation_no
            : '';

        return $rule->name . '. Terdeteksi ' . $count
            . ' transaksi dengan total Rp' . $amount
            . ' pada periode ' . $start->format('d/m/Y H:i')
            . ' s.d. ' . $end->format('d/m/Y H:i') . '.'
            . $regulation;
    }

    protected function snapshot(GoamlRule $rule, Collection $transactions, Carbon $start, Carbon $end): array
    {
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
            'invoice_ids' => $transactions->pluck('id')->filter()->values()->all(),
            'transaction_item_ids' => $transactions->pluck('itemId')->values()->all(),
        ];
    }

    protected function nextAlertNo(): string
    {
        $prefix = 'GOAML-' . now()->format('Ymd') . '-';
        $last = GoamlAlert::query()
            ->where('alert_no', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('alert_no');

        $sequence = $last ? ((int) substr($last, -5)) + 1 : 1;

        return $prefix . str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
    }
}
