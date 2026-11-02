<?php
// @2026-Alifiandra

namespace App\Services;

use App\Models\Currency;
use App\Models\Datastore;
use App\Models\RateSnapshot;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pencatatan riwayat kurs (audit BI).
 *  - Terjadwal: setiap {interval} menit antara jam mulai s.d. jam selesai pada hari yang dipilih.
 *    Dijalankan oleh perintah mc:rate-snapshot (dipanggil schedule:run tiap menit).
 *  - Manual: tombol "Catat Sekarang".
 *  - Perubahan: setiap kali kurs beli/jual sebuah valuta diubah (opsional).
 * Setiap catatan menyimpan kurs sumber, selisih (margin), dan kurs hasil (= sumber + selisih).
 */
class RateHistoryService
{
    public const SETTINGS_KEY = 'mc_rate_history_settings';
    public const HEARTBEAT_KEY = 'mc_rate_history_beat';
    public const INTERVALS = [15, 30, 60, 120];

    public const DEFAULTS = [
        'enabled' => true,
        'start' => '08:00',
        'end' => '17:00',
        'interval' => 60,
        'days' => [1, 2, 3, 4, 5, 6],   // ISO: 1 = Senin ... 7 = Minggu
        'log_changes' => true,
    ];

    public function settings(): array
    {
        $raw = null;
        try {
            $row = Datastore::query()->find(self::SETTINGS_KEY);
            $raw = $row ? $row->json_data : null;
            if (is_string($raw)) {
                $raw = json_decode($raw, true);
            }
        } catch (\Throwable $e) {
            $raw = null;
        }

        return $this->normalize(is_array($raw) ? $raw : []);
    }

    public function saveSettings(array $input): array
    {
        $clean = $this->normalize($input);
        Datastore::updateOrCreate(['store_key' => self::SETTINGS_KEY], ['json_data' => $clean]);

        return $clean;
    }

    public function normalize(array $s): array
    {
        $out = array_merge(self::DEFAULTS, array_intersect_key($s, self::DEFAULTS));
        $out['enabled'] = filter_var($out['enabled'], FILTER_VALIDATE_BOOLEAN);
        $out['log_changes'] = filter_var($out['log_changes'], FILTER_VALIDATE_BOOLEAN);
        $out['start'] = $this->hhmm($out['start'], self::DEFAULTS['start']);
        $out['end'] = $this->hhmm($out['end'], self::DEFAULTS['end']);
        if ($this->minutes($out['end']) < $this->minutes($out['start'])) {
            $out['end'] = $out['start'];
        }
        $out['interval'] = in_array((int) $out['interval'], self::INTERVALS, true) ? (int) $out['interval'] : 60;
        $days = array_values(array_unique(array_filter(array_map('intval', (array) $out['days']), fn ($d) => $d >= 1 && $d <= 7)));
        sort($days);
        $out['days'] = $days ?: self::DEFAULTS['days'];

        return $out;
    }

    private function hhmm(mixed $v, string $fallback): string
    {
        return is_string($v) && preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $v) ? $v : $fallback;
    }

    private function minutes(string $hhmm): int
    {
        [$h, $m] = array_map('intval', explode(':', $hhmm));

        return $h * 60 + $m;
    }

    /** Daftar jam pencatatan pada tanggal tertentu (kosong bila hari tersebut tidak dijadwalkan). */
    public function slotsFor(Carbon $day, ?array $s = null): array
    {
        $s ??= $this->settings();
        if (!in_array((int) $day->dayOfWeekIso, $s['days'], true)) {
            return [];
        }
        $slots = [];
        $start = $this->minutes($s['start']);
        $end = $this->minutes($s['end']);
        for ($m = $start; $m <= $end; $m += $s['interval']) {
            $slots[] = $day->copy()->startOfDay()->addMinutes($m);
        }

        return $slots;
    }

    /**
     * Jam jadwal yang sudah tiba dan belum dicatat. Diberi toleransi sampai jadwal berikutnya,
     * sehingga cron yang terlambat beberapa menit tetap mencatat jam yang benar.
     */
    public function dueSlot(?Carbon $now = null, ?array $s = null): ?Carbon
    {
        $s ??= $this->settings();
        if (!$s['enabled']) {
            return null;
        }
        $now ??= now();
        $candidate = null;
        foreach ($this->slotsFor($now, $s) as $slot) {
            if ($slot->lessThanOrEqualTo($now)) {
                $candidate = $slot;
            }
        }
        if (!$candidate || $now->greaterThanOrEqualTo($candidate->copy()->addMinutes($s['interval']))) {
            return null;
        }
        $exists = RateSnapshot::query()->where('source', 'jadwal')->where('slot', $candidate->format('Y-m-d H:i:s'))->exists();

        return $exists ? null : $candidate;
    }

    /** Jadwal berikutnya (maks. 8 hari ke depan). */
    public function nextSlot(?Carbon $now = null, ?array $s = null): ?Carbon
    {
        $s ??= $this->settings();
        if (!$s['enabled']) {
            return null;
        }
        $now ??= now();
        for ($i = 0; $i <= 8; $i++) {
            foreach ($this->slotsFor($now->copy()->addDays($i), $s) as $slot) {
                if ($slot->greaterThan($now)) {
                    return $slot;
                }
            }
        }

        return null;
    }

    /** Ambil kurs semua valuta saat ini lalu simpan. Mengembalikan jumlah valuta yang dicatat. */
    public function snapshot(string $source, ?Carbon $slot = null, ?string $actor = null): int
    {
        $now = now();
        $rows = [];
        $hasSourceCols = Schema::hasColumn('mc_rate_snapshots', 'base_buy');
        foreach (Currency::query()->orderBy('code')->get() as $c) {
            $buy = (float) $c->buy;
            $sell = (float) $c->sell;
            if ($buy <= 0 && $sell <= 0) {
                continue;
            }
            $row = [
                'taken_at' => $now->format('Y-m-d H:i:s'),
                'slot' => $slot ? $slot->format('Y-m-d H:i:s') : null,
                'source' => $source,
                'currency_code' => (string) $c->code,
                'currency_label' => $this->labelOf($c),
                'buy' => $buy,
                'sell' => $sell,
                'prev_buy' => null,
                'prev_sell' => null,
                'recorded_by' => $actor ?: null,
                'created_at' => $now->format('Y-m-d H:i:s'),
            ];
            $rows[] = $hasSourceCols ? array_merge($row, $this->sourceRatesOf($c)) : $row;
        }
        if (!$rows) {
            return 0;
        }

        return DB::transaction(function () use ($rows) {
            $n = 0;
            foreach (array_chunk($rows, 200) as $chunk) {
                $n += (int) DB::table('mc_rate_snapshots')->insertOrIgnore($chunk);
            }

            return $n;
        });
    }

    /** Catat perubahan kurs satu valuta (dipanggil saat kurs disimpan). Tidak pernah melempar error. */
    public function recordChange(Currency $c, float $oldBuy, float $oldSell, ?string $actor = null): void
    {
        try {
            if (!Schema::hasTable('mc_rate_snapshots') || !$this->settings()['log_changes']) {
                return;
            }
            $newBuy = (float) $c->buy;
            $newSell = (float) $c->sell;
            if (abs($newBuy - $oldBuy) < 0.00005 && abs($newSell - $oldSell) < 0.00005) {
                return;
            }
            $sourceRates = Schema::hasColumn('mc_rate_snapshots', 'base_buy') ? $this->sourceRatesOf($c) : [];
            RateSnapshot::create(array_merge([
                'taken_at' => now(),
                'slot' => null,
                'source' => 'perubahan',
                'currency_code' => (string) $c->code,
                'currency_label' => $this->labelOf($c),
                'buy' => $newBuy,
                'sell' => $newSell,
                'prev_buy' => $oldBuy,
                'prev_sell' => $oldSell,
                'recorded_by' => $actor ?: null,
            ], $sourceRates));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * Kurs sumber & selisih dari data valuta (raw_json: base_buy/base_sell, margin_buy/margin_sell).
     * Bila salah satu tidak tersimpan, dihitung dari kurs hasil: sumber = hasil - selisih.
     * Bila keduanya tidak ada, dibiarkan kosong (tidak ditebak).
     */
    public function sourceRatesOf(Currency $c): array
    {
        $raw = is_string($c->raw_json) && $c->raw_json !== '' ? json_decode($c->raw_json, true) : null;
        $raw = is_array($raw) ? $raw : [];
        $out = [];
        foreach (['buy', 'sell'] as $side) {
            $final = (float) $c->{$side};
            $base = isset($raw['base_'.$side]) && is_numeric($raw['base_'.$side]) && (float) $raw['base_'.$side] > 0 ? (float) $raw['base_'.$side] : null;
            $margin = isset($raw['margin_'.$side]) && is_numeric($raw['margin_'.$side]) ? (float) $raw['margin_'.$side] : null;
            if ($base === null && $margin !== null && $final > 0) {
                $base = $final - $margin;
            }
            if ($margin === null && $base !== null && $final > 0) {
                $margin = $final - $base;
            }
            $out['base_'.$side] = $base;
            $out['margin_'.$side] = $margin;
        }

        return $out;
    }

    private function labelOf(Currency $c): ?string
    {
        $label = trim((string) $c->label);
        if ($label === '' && is_string($c->raw_json) && $c->raw_json !== '') {
            $raw = json_decode($c->raw_json, true);
            if (is_array($raw)) {
                $label = trim((string) ($raw['label'] ?? $raw['name'] ?? ''));
            }
        }

        return $label !== '' ? mb_substr($label, 0, 100) : null;
    }

    public function beat(): void
    {
        try {
            Cache::put(self::HEARTBEAT_KEY, now()->toIso8601String(), 7 * 24 * 3600);
        } catch (\Throwable $e) {
            // abaikan
        }
    }

    public function heartbeat(): ?string
    {
        try {
            return Cache::get(self::HEARTBEAT_KEY);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
