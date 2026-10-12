<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardAnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $selectedDate = $request->filled('date')
            ? Carbon::parse($request->input('date'))->startOfDay()
            : now()->startOfDay();

        $range = strtoupper((string) $request->input('range', '7H'));
        $days = match ($range) {
            '1H' => 1,
            '3H' => 3,
            '1M' => 30,
            '3M' => 90,
            '1Y' => 365,
            default => 7,
        };

        $currency = strtoupper(trim((string) $request->input('currency', 'ALL')));
        $from = $selectedDate->copy()->subDays($days - 1)->startOfDay();
        $to = $selectedDate->copy()->endOfDay();

        $trxQuery = Transaction::query()
            ->whereBetween('timestamp', [$from, $to]);

        if ($currency !== '' && $currency !== 'ALL') {
            $trxQuery->whereRaw('UPPER(valuta) = ?', [$currency]);
        }

        $transactions = (clone $trxQuery)
            ->select(['timestamp', 'tipe', 'valuta', 'nominal', 'total', 'id', 'id_cif', 'customerName'])
            ->orderBy('timestamp')
            ->get();

        $currencyStats = $transactions
            ->groupBy(fn ($t) => strtoupper(trim((string) $t->valuta)) ?: 'LAINNYA')
            ->map(fn ($rows) => [
                'count' => $rows->count(),
                'value' => (float) $rows->sum(fn ($r) => (float) $r->total),
                'nominal' => (float) $rows->sum(fn ($r) => (float) $r->nominal),
            ])
            ->sortByDesc('value')
            ->take(10);

        $buySell = collect(['BELI', 'JUAL'])->mapWithKeys(function ($type) use ($transactions) {
            $rows = $transactions->filter(fn ($t) => strtoupper((string) $t->tipe) === $type);
            return [$type => [
                'count' => $rows->count(),
                'value' => (float) $rows->sum(fn ($r) => (float) $r->total),
            ]];
        });

        $trend = [];
        for ($i = 0; $i < $days; $i++) {
            $day = $from->copy()->addDays($i);
            $rows = $transactions->filter(fn ($t) => Carbon::parse($t->timestamp)->isSameDay($day));
            $trend[] = [
                'date' => $day->format('Y-m-d'),
                'label' => $day->format('d/m'),
                'count' => $rows->count(),
                'value' => (float) $rows->sum(fn ($r) => (float) $r->total),
                'beli' => (float) $rows->filter(fn ($r) => strtoupper((string) $r->tipe) === 'BELI')->sum(fn ($r) => (float) $r->total),
                'jual' => (float) $rows->filter(fn ($r) => strtoupper((string) $r->tipe) === 'JUAL')->sum(fn ($r) => (float) $r->total),
            ];
        }

        $customers = Customer::query()
            ->select(['internal_id', 'address', 'registration_date'])
            ->get();

        $regions = $customers
            ->map(fn ($customer) => $this->extractRegion($customer->address))
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(10)
            ->map(fn ($count, $region) => ['region' => $region, 'count' => $count])
            ->values();

        $activeCustomerIds = $transactions
            ->pluck('id_cif')
            ->filter(fn ($id) => trim((string) $id) !== '' && trim((string) $id) !== '-')
            ->unique()
            ->values();

        $newCustomers = $customers->filter(function ($customer) use ($from, $to) {
            if (!$customer->registration_date) return false;
            try {
                $date = Carbon::parse($customer->registration_date);
                return $date->betweenIncluded($from, $to);
            } catch (\Throwable $e) {
                return false;
            }
        })->count();

        $currencyOptions = Transaction::query()
            ->whereNotNull('valuta')
            ->where('valuta', '!=', '')
            ->distinct()
            ->orderBy('valuta')
            ->pluck('valuta')
            ->map(fn ($v) => strtoupper(trim((string) $v)))
            ->filter()
            ->unique()
            ->values();

        return response()->json([
            'status' => 'success',
            'date' => $selectedDate->format('Y-m-d'),
            'range' => $range,
            'days' => $days,
            'currency' => $currency,
            'currency_stats' => $currencyStats->mapWithKeys(fn ($v, $k) => [$k => $v]),
            'buy_sell' => $buySell,
            'trend' => $trend,
            'regions' => $regions,
            'customers' => [
                'total' => $customers->count(),
                'active' => $activeCustomerIds->count(),
                'new' => $newCustomers,
            ],
            'summary' => [
                'transaction_count' => $transactions->count(),
                'transaction_value' => (float) $transactions->sum(fn ($r) => (float) $r->total),
            ],
            'currency_options' => $currencyOptions,
        ]);
    }

    private function extractRegion($address): ?string
    {
        $text = trim(preg_replace('/\s+/', ' ', (string) $address));
        if ($text === '' || $text === '-') return null;

        $parts = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $text))));
        foreach ($parts as $part) {
            $clean = trim($part);
            if (preg_match('/^(kabupaten|kab\.?|kota)\s+(.+)$/i', $clean, $m)) {
                return ucwords(strtolower(trim($m[2])));
            }
        }

        foreach ($parts as $part) {
            if (preg_match('/\b(kabupaten|kab\.?|kota)\b\s+(.+)/i', $part, $m)) {
                return ucwords(strtolower(trim($m[2])));
            }
        }

        // Jika alamat memakai format koma tetapi tanpa label Kota/Kabupaten,
        // gunakan bagian terakhir yang cukup informatif. Data tetap diberi
        // label "Wilayah" di UI agar tidak dianggap sebagai data administrasi resmi.
        $last = trim(end($parts));
        if ($last !== '' && !preg_match('/^(indonesia|indonesia\.)$/i', $last)) {
            return ucwords(strtolower($last));
        }

        return 'Tidak teridentifikasi';
    }
}
