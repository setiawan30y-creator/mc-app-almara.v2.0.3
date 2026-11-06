<?php
// @2026-Alifiandra

namespace App\Services\Erp;

use App\Models\ErpCashClosing;
use App\Models\ErpCurrencyStock;
use App\Models\ErpCurrencyStockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * SATU-SATUNYA perhitungan nilai stok valas dalam Rupiah (aturan terkunci: satu sumber angka).
 * Dipakai Dashboard (Total Valuta & Live Stok Valuta), Closing Harian, dan Laporan Rekonsiliasi.
 *
 * Nilai = stok × modal rata-rata tertimbang. Modal rata-rata dihitung dari saldo awal valas
 * (kurs modal awal di Pengaturan) lalu setiap BELI menambah modal, setiap JUAL mengurangi
 * stok pada modal rata-rata (sama seperti perhitungan Dashboard sebelumnya).
 *
 * - Tanpa tanggal / hari ini  : stok & modal saat ini.
 * - Tanggal yang sudah closing: angka yang DIBEKUKAN saat closing disimpan (tabel valuasi closing).
 * - Tanggal lain              : stok & modal pada akhir tanggal itu.
 */
class ValasValuation
{
    private ?array $currencies = null;
    private ?array $trades = null;

    /** @return array{date:?string,source:string,closing_no:?string,status:?string,items:array,total:float} */
    public function at(?string $date = null, bool $useFrozen = true): array
    {
        $today = now()->toDateString();
        $date = $date ?: null;
        if ($date !== null && $date >= $today) {
            $date = null;
        }

        if ($date !== null && $useFrozen) {
            $frozen = $this->frozen($date);
            if ($frozen) {
                return $frozen;
            }
        }

        $items = $this->compute($date);
        return [
            'date' => $date ?? $today,
            'source' => $date === null ? 'live' : 'end_of_day',
            'closing_no' => null,
            'status' => null,
            'items' => $items,
            'total' => round(array_sum(array_column($items, 'value')), 2),
        ];
    }

    /** Peta kode => ['qty','rate','value'] (untuk Closing Harian). */
    public function map(?string $date = null, bool $useFrozen = true): array
    {
        $out = [];
        foreach ($this->at($date, $useFrozen)['items'] as $it) {
            $out[$it['code']] = $it;
        }
        return $out;
    }

    /** Bekukan valuasi pada closing (dipanggil saat Simpan Sementara / Kunci). */
    public function freeze(ErpCashClosing $closing, string $date): void
    {
        if (!Schema::hasTable('erp_cash_closing_valuations')) {
            return;
        }
        $items = $this->compute($date >= now()->toDateString() ? null : $date);
        DB::table('erp_cash_closing_valuations')->where('closing_id', $closing->id)->delete();
        $now = now();
        foreach ($items as $it) {
            DB::table('erp_cash_closing_valuations')->insert([
                'closing_id' => $closing->id,
                'currency_code' => $it['code'],
                'system_qty' => $it['qty'],
                'rate' => $it['rate'],
                'value' => $it['value'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function frozen(string $date): ?array
    {
        if (!Schema::hasTable('erp_cash_closing_valuations')) {
            return null;
        }
        $c = ErpCashClosing::query()->whereDate('closing_date', $date)->first();
        if (!$c || $c->status !== 'CLOSED') {
            return null;
        }
        $rows = DB::table('erp_cash_closing_valuations')->where('closing_id', $c->id)->orderBy('currency_code')->get();
        if ($rows->isEmpty()) {
            return null;
        }
        $items = $rows->map(fn ($r) => [
            'code' => $r->currency_code, 'qty' => (float) $r->system_qty, 'rate' => (float) $r->rate, 'value' => (float) $r->value,
        ])->values()->all();

        return [
            'date' => $date, 'source' => 'closing', 'closing_no' => $c->closing_no, 'status' => $c->status,
            'items' => $items, 'total' => round(array_sum(array_column($items, 'value')), 2),
        ];
    }

    private function compute(?string $date): array
    {
        $end = $date ? $date . ' 23:59:59' : null;
        $erp = ErpCurrencyStock::query()->get()->keyBy(fn ($s) => strtoupper((string) $s->currency_code));
        $trades = $this->trades();
        $items = [];

        foreach ($this->currencies() as $code => $cur) {
            // Stok: buku besar ERP (bila ada), mundur ke akhir tanggal yang dipilih.
            if ($erp->has($code)) {
                $s = $erp->get($code);
                $qty = (float) $s->quantity;
                if ($end) {
                    $after = (float) ErpCurrencyStockMovement::where('currency_stock_id', $s->id)->where('posted_at', '>', $end)
                        ->sum(DB::raw("CASE WHEN movement_type = 'IN' THEN quantity ELSE -quantity END"));
                    $qty = round($qty - $after, 6);
                }
            } else {
                $qty = (float) $cur['stock'];
            }

            $rate = $this->averageCost($cur, $trades[$code] ?? [], $end, $qty);
            $items[] = ['code' => $code, 'qty' => $qty, 'rate' => round($rate, 6), 'value' => round($qty * $rate, 2)];
        }

        return $items;
    }

    /** Modal rata-rata tertimbang (logika yang sama dengan perhitungan Dashboard sebelumnya). */
    private function averageCost(array $cur, array $trades, ?string $end, float $stockNow): float
    {
        if ($stockNow <= 0) {
            return $cur['initial_rate'] > 0 ? $cur['initial_rate'] : $cur['avg_rate'];
        }
        $list = $end ? array_values(array_filter($trades, fn ($t) => $t['at'] <= $end)) : $trades;
        $net = 0.0;
        $hasBuy = false;
        foreach ($list as $t) {
            $net += $t['type'] === 'BELI' ? $t['qty'] : ($t['type'] === 'JUAL' ? -$t['qty'] : 0);
            $hasBuy = $hasBuy || $t['type'] === 'BELI';
        }
        $initialQty = $cur['initial_qty'] !== null ? $cur['initial_qty'] : max($stockNow - $net, 0);
        $initialRate = $cur['initial_rate'];
        if (!$hasBuy) {
            return $initialRate;
        }
        $qty = $initialQty;
        $cost = $qty * $initialRate;
        foreach ($list as $t) {
            if ($t['type'] === 'BELI') {
                $qty += $t['qty'];
                $cost += $t['total'];
            } elseif ($t['type'] === 'JUAL') {
                $avg = $qty > 0.0001 ? $cost / $qty : 0;
                $qty -= $t['qty'];
                $cost -= $t['qty'] * $avg;
                if ($qty < 0) $qty = 0;
                if ($cost < 0) $cost = 0;
            }
        }
        if ($qty > 0.0001 && $cost > 0) {
            return $cost / $qty;
        }
        return $cur['avg_rate'] > 0 ? $cur['avg_rate'] : $initialRate;
    }

    private function currencies(): array
    {
        if ($this->currencies !== null) {
            return $this->currencies;
        }
        $out = [];
        if (Schema::hasTable('mc_currencies')) {
            foreach (DB::table('mc_currencies')->get(['code', 'stock', 'raw_json']) as $row) {
                $raw = is_string($row->raw_json) ? json_decode($row->raw_json, true) : null;
                $raw = is_array($raw) ? $raw : [];
                $code = strtoupper(trim((string) $row->code));
                if ($code === '') continue;
                $iq = $raw['initialStock'] ?? $raw['startingStock'] ?? null;
                $out[$code] = [
                    'stock' => (float) ($raw['stock'] ?? $row->stock ?? 0),
                    'initial_qty' => ($iq === null || $iq === '') ? null : (float) $iq,
                    'initial_rate' => (float) ($raw['initial_rate_locked'] ?? 0),
                    'avg_rate' => (float) ($raw['avg_buy_rate'] ?? $raw['initial_rate_locked'] ?? 0),
                ];
            }
        }
        ksort($out);
        return $this->currencies = $out;
    }

    private function trades(): array
    {
        if ($this->trades !== null) {
            return $this->trades;
        }
        $out = [];
        if (Schema::hasTable('mc_transactions')) {
            $q = DB::table('mc_transactions')->whereIn(DB::raw('UPPER(tipe)'), ['BELI', 'JUAL'])->orderBy('timestamp')->orderBy('itemId');
            if (Schema::hasColumn('mc_transactions', 'isOldMoney')) {
                $q->where(fn ($w) => $w->whereNull('isOldMoney')->orWhere('isOldMoney', false));
            }
            foreach ($q->get(['valuta', 'tipe', 'nominal', 'rate', 'total', 'timestamp']) as $t) {
                $qty = (float) $t->nominal;
                $out[strtoupper((string) $t->valuta)][] = [
                    'type' => strtoupper((string) $t->tipe),
                    'qty' => $qty,
                    'total' => (float) $t->total ?: $qty * (float) $t->rate,
                    'at' => (string) $t->timestamp,
                ];
            }
        }
        return $this->trades = $out;
    }
}
