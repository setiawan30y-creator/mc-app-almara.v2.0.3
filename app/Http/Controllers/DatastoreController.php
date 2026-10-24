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
    public function index()
    {
        $stores = Datastore::all();
        $data = [];
        foreach ($stores as $item) {
            // Rahasia integrasi tidak boleh sampai ke browser.
            if (str_starts_with((string) $item->store_key, 'security_') || in_array($item->store_key, ['mc_vision_api_key', 'mc_wa_gateway'], true)) {
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

        return response()->json(['status' => 'success', 'data' => $data]);
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

            Datastore::updateOrCreate(
                ['store_key' => $validated['store_key']],
                ['json_data' => $jsonData]
            );
            return response()->json([
                'status' => 'success',
                'message' => "Datastore {$validated['store_key']} tersimpan (Laravel)!"
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
