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
            $raw = $item->json_data;
            if (is_string($raw)) {
                $decoded = json_decode($raw, true);
                $data[$item->store_key] = json_last_error() === JSON_ERROR_NONE
                    ? $decoded
                    : $raw;
            } else {
                $data[$item->store_key] = $raw;
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
