<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\Datastore;
use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\ErpCurrencyStock;
use App\Models\ErpPayment;
use App\Models\ErpSettlement;
use Illuminate\Http\Request;

class DatastoreController extends Controller
{
    /** Pengaturan AI per perangkat: tidak pernah disimpan / dibagikan lewat datastore. */
    public const DEVICE_ONLY_KEYS = ['mc_gemini_api_key', 'mc_openai_api_key', 'mc_openai_model', 'mc_ai_provider'];

    /** Saldo yang hanya boleh berasal dari buku besar ERP (aturan terkunci). @2026-Alifiandra */
    public const LEDGER_OWNED_KEYS = [
        'mc_cash', 'mc_bank_bca', 'mc_bank_mandiri',
        'mc_initial_cash', 'mc_initial_bank_bca', 'mc_initial_bank_mandiri',
        'mc_erp_payment_totals', 'mc_erp_settlement_totals',
    ];

    public function index()
    {
        $stores = Datastore::all();
        $data = [];
        foreach ($stores as $item) {
            // Rahasia integrasi tidak boleh sampai ke browser.
            if (str_starts_with((string) $item->store_key, 'security_') || in_array($item->store_key, ['mc_vision_api_key', 'mc_wa_gateway'], true)) {
                continue;
            }
            // Pengaturan AI per perangkat (API key) tidak boleh dibagikan lewat datastore. @2026-Alifiandra
            if (in_array($item->store_key, self::DEVICE_ONLY_KEYS, true)) {
                continue;
            }
            $raw = $item->json_data;
            if (is_string($raw)) {
                $decoded = json_decode($raw, true);
                $data[$item->store_key] = json_last_error() === JSON_ERROR_NONE
                    ? $decoded
                    : $raw;
            } else {
                $data[$item->store_key] = $raw;
            }
            if ($item->store_key === 'mc_hris_employees') {
                $data['mc_hris_employees'] = self::stripPins($data['mc_hris_employees']);
            }
            if ($item->store_key === 'mc_profile' && is_array($data['mc_profile'] ?? null)) {
                unset($data['mc_profile']['visionKey']);
            }
        }

        // ERP is the source of truth for financial balances. These compatibility
        // keys are exposed through the existing datastore bridge so the current
        // dashboard can consume ERP balances without a second cash/bank ledger.
        $cash = $this->erpAccountBalance(
            ErpCashAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->get()
        );
        $bca = $this->erpBankBalanceLike('BCA');
        $mandiri = $this->erpBankBalanceLike('MANDIRI');

        // Saldo awal juga dari buku besar (satu sumber untuk semua akun & perangkat). @2026-Alifiandra
        $openCash = ErpCashAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->orderBy('id')->first();
        $openBank = function (string $name) {
            $acc = ErpBankAccount::query()->where('currency_code', 'IDR')->where('is_active', true)
                ->where(fn ($q) => $q->where('bank_name', 'like', '%'.$name.'%')->orWhere('code', 'like', '%'.$name.'%'))
                ->orderBy('id')->first();
            return (float) ($acc->opening_balance ?? 0);
        };
        if ($openCash || ErpBankAccount::query()->exists()) {
            $data['mc_initial_cash'] = (float) ($openCash->opening_balance ?? 0);
            $data['mc_initial_bank_bca'] = $openBank('BCA');
            $data['mc_initial_bank_mandiri'] = $openBank('MANDIRI');
        }

        $data['mc_cash'] = $cash;
        $data['mc_bank_bca'] = $bca;
        $data['mc_bank_mandiri'] = $mandiri;

        // Keep the existing currency shape but replace quantity with the ERP
        // stock ledger. Rates and labels remain master-data concerns.
        $stocks = ErpCurrencyStock::query()
            ->where('status', 'active')
            ->get()
            ->keyBy(fn ($stock) => strtoupper((string) $stock->currency_code));
        $data['mc_currencies'] = Currency::all()->map(function (Currency $currency) use ($stocks) {
            $code = strtoupper((string) $currency->code);
            $row = $currency->toArray();
            if ($stocks->has($code)) {
                $row['stock'] = (float) $stocks->get($code)->quantity;
            }
            return $row;
        })->values()->all();

        $postedPayments = ErpPayment::query()->where('status', 'posted');
        $data['mc_erp_payment_totals'] = [
            'in' => (float) (clone $postedPayments)->where('direction', 'in')->sum('amount'),
            'out' => (float) (clone $postedPayments)->where('direction', 'out')->sum('amount'),
            'count' => (int) (clone $postedPayments)->count(),
        ];

        $data['mc_erp_settlement_totals'] = [
            'pending' => (int) ErpSettlement::query()->where('status', 'pending')->count(),
            'settled' => (int) ErpSettlement::query()->where('status', 'settled')->count(),
        ];

        // Versi setiap kunci (kunci optimistis): browser mengirim balik versi ini saat menyimpan,
        // supaya perubahan dari akun lain tidak tertimpa diam-diam. @2026-Alifiandra
        $versions = [];
        foreach ($stores as $item) {
            $versions[$item->store_key] = self::versionOf($item);
        }

        return response()->json(['status' => 'success', 'data' => $data, 'versions' => $versions]);
    }

    /** Versi isi satu kunci datastore (berubah setiap kali isinya berubah). */
    private static function versionOf(?Datastore $row): string
    {
        if (!$row) {
            return '';
        }
        $raw = $row->getRawOriginal('json_data');
        return substr(md5(is_string($raw) ? $raw : json_encode($raw)), 0, 16);
    }

    /** PIN karyawan tidak pernah disimpan/dikirim lewat datastore (ada di tabel hash terpisah). */
    private static function stripPins($list)
    {
        if (!is_array($list)) {
            return $list;
        }
        foreach ($list as $i => $emp) {
            if (is_array($emp)) {
                unset($list[$i]['pin']);
            }
        }
        return $list;
    }

    private function erpAccountBalance($accounts): float
    {
        return (float) $accounts->sum(function ($account) {
            $in = (float) $account->movements()->where('direction', 'in')->sum('amount');
            $out = (float) $account->movements()->where('direction', 'out')->sum('amount');
            return (float) $account->opening_balance + $in - $out;
        });
    }

    private function erpBankBalanceLike(string $bankName): float
    {
        return $this->erpAccountBalance(
            ErpBankAccount::query()
                ->where('currency_code', 'IDR')
                ->where('is_active', true)
                ->where(function ($query) use ($bankName) {
                    $query->where('bank_name', 'like', '%'.$bankName.'%')
                        ->orWhere('code', 'like', '%'.$bankName.'%');
                })
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'store_key' => ['required', 'string', 'max:100'],
            'json_data' => ['required'],
        ]);

        // Key Vision tidak lagi disimpan di browser/datastore umum. Browser lama yang masih
        // mengirimnya: simpan terenkripsi (hanya bila pengirim admin) dan buang dari data.
        if (in_array($validated['store_key'], ['mc_vision_api_key', 'mc_wa_gateway'], true)) {
            return response()->json(['status' => 'success', 'message' => 'Diabaikan (key dikelola server).']);
        }
        // API key AI disimpan di peramban masing-masing perangkat, tidak di server.
        if (in_array($validated['store_key'], self::DEVICE_ONLY_KEYS, true)) {
            Datastore::where('store_key', $validated['store_key'])->delete();
            return response()->json(['status' => 'success', 'message' => 'Diabaikan (pengaturan per perangkat).']);
        }
        if ($validated['store_key'] === 'mc_profile') {
            $incoming = $validated['json_data'];
            if (is_string($incoming)) {
                $dec = json_decode($incoming, true);
                $incoming = json_last_error() === JSON_ERROR_NONE ? $dec : $incoming;
            }
            if (is_array($incoming) && array_key_exists('visionKey', $incoming)) {
                $legacyKey = trim((string) $incoming['visionKey']);
                $actorRole = strtolower((string) ($request->user()?->role ?? ''));
                if (in_array($actorRole, ['owner', 'superadmin', 'admin'], true) && \App\Support\SecretStore::plausible($legacyKey)
                    && !\App\Support\SecretStore::visionMeta()['configured']) {
                    \App\Support\SecretStore::setVision($legacyKey, (string) ($request->user()?->username ?? ''));
                }
                unset($incoming['visionKey']);
                $validated['json_data'] = $incoming;
            }
        }

        if ($validated['store_key'] === 'mc_hris_employees') {
            $incoming = $validated['json_data'];
            if (is_string($incoming)) {
                $dec = json_decode($incoming, true);
                $incoming = json_last_error() === JSON_ERROR_NONE ? $dec : $incoming;
            }
            $validated['json_data'] = self::stripPins($incoming);
        }

        // ATURAN TERKUNCI: saldo kas/bank & saldo awal hanya diubah lewat buku besar (endpoint ERP),
        // tidak pernah dari salinan di browser. @2026-Alifiandra
        if (in_array($validated['store_key'], self::LEDGER_OWNED_KEYS, true)) {
            return response()->json(['status' => 'success', 'message' => 'Diabaikan (saldo dikelola buku besar server).']);
        }

        if (str_starts_with($validated['store_key'], 'security_')) {
            return response()->json(['status' => 'error', 'message' => 'Kunci ini dikelola lewat pengaturan khusus.'], 403);
        }

        try {
            $jsonData = $validated['json_data'];
            if (is_string($jsonData)) {
                $decoded = json_decode($jsonData, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $jsonData = $decoded;
                }
            }

            $key = $validated['store_key'];
            $base = $request->input('base_version');
            $result = \Illuminate\Support\Facades\DB::transaction(function () use ($key, $base, $jsonData) {
                $current = Datastore::query()->whereKey($key)->lockForUpdate()->first();
                // Kunci sudah ada tetapi browser mengirim versi lama / tanpa versi => tolak (409).
                if ($current && (!is_string($base) || $base === '' || !hash_equals(self::versionOf($current), $base))) {
                    return ['conflict' => true, 'current' => $current->json_data, 'version' => self::versionOf($current)];
                }
                $row = Datastore::updateOrCreate(['store_key' => $key], ['json_data' => $jsonData]);
                return ['conflict' => false, 'version' => self::versionOf($row->fresh())];
            });
            if ($result['conflict']) {
                return response()->json([
                    'status' => 'conflict',
                    'message' => "Data {$key} sudah diubah dari akun/perangkat lain. Muat ulang lalu ulangi.",
                    'current' => $result['current'],
                    'version' => $result['version'],
                ], 409);
            }
            return response()->json([
                'status' => 'success',
                'message' => "Datastore {$key} tersimpan (Laravel)!",
                'version' => $result['version'],
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request)
    {
        $storeKey = $request->input('store_key');
        if (!$storeKey) {
            return response()->json(['status' => 'error', 'message' => 'store_key wajib diisi'], 400);
        }

        if (str_starts_with((string) $storeKey, 'security_')) {
            return response()->json(['status' => 'error', 'message' => 'Kunci ini dikelola lewat pengaturan khusus.'], 403);
        }

        try {
            Datastore::where('store_key', $storeKey)->delete();
            return response()->json([
                'status' => 'success',
                'message' => "Datastore {$storeKey} dihapus"
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}
