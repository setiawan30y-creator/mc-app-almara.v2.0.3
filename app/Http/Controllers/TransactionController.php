<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\GoamlComplianceService;
use App\Services\Erp\TransactionLedgerPoster;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function index()
    {
        $transactions = Transaction::orderBy('timestamp', 'desc')
            ->orderBy('itemId', 'desc')
            ->get();

        return response()->json($transactions);
    }

    public function store(Request $request, GoamlComplianceService $goaml, TransactionLedgerPoster $ledger)
    {
        $validated = $request->validate([
            'id' => ['nullable', 'string', 'max:50', 'required_without:itemId'],
            'itemId' => ['nullable', 'string', 'max:100'],
            'timestamp' => ['required', 'date'],
            'tipe' => ['required', 'string', 'max:20'],
            'valuta' => ['required', 'string', 'max:10'],
            'nominal' => ['nullable', 'numeric'],
            'rate' => ['nullable', 'numeric'],
            'total' => ['nullable', 'numeric'],
            'customerId' => ['nullable', 'string', 'max:50'],
            'id_cif' => ['nullable', 'string', 'max:50'],
            'customerName' => ['nullable', 'string', 'max:255'],
            'kasir' => ['nullable', 'string', 'max:100'],
            'paymentMethod' => ['nullable', 'string', 'max:50'],
            'isOldMoney' => ['nullable', 'boolean'],
            'keterangan' => ['nullable', 'string'],
        ]);

        $input = $request->all();
        $invoiceId = $validated['id'] ?? $validated['itemId'];
        $itemId = $validated['itemId'] ?? ($invoiceId . '-' . Str::lower(Str::random(6)));

        $data = [
            'id' => $invoiceId,
            'timestamp' => Carbon::parse($validated['timestamp'])->format('Y-m-d H:i:s'),
            'tipe' => $validated['tipe'],
            'valuta' => $validated['valuta'],
            'nominal' => (float) ($validated['nominal'] ?? 0),
            'rate' => (float) ($validated['rate'] ?? 0),
            'total' => (float) ($validated['total'] ?? 0),
            'id_cif' => $validated['customerId'] ?? $validated['id_cif'] ?? '',
            'customerName' => $validated['customerName'] ?? '',
            'kasir' => $validated['kasir'] ?? '',
            'paymentMethod' => $validated['paymentMethod'] ?? 'TUNAI',
            'isOldMoney' => (bool) ($validated['isOldMoney'] ?? false),
            'keterangan' => $validated['keterangan'] ?? '',
            'raw_json' => json_encode($input),
        ];

        try {
            // Transaksi dan pencatatan ledger (kas/bank/stok) disimpan dalam
            // satu transaksi database: jika salah satu gagal, semuanya dibatalkan.
            DB::transaction(function () use ($itemId, $data, $goaml, $ledger, $request) {
                $transaction = Transaction::updateOrCreate(
                    ['itemId' => $itemId],
                    $data
                );

                // Jalankan compliance engine setelah transaksi tersimpan.
                $goaml->evaluateTransaction($transaction);

                $this->postToLedger($ledger, $transaction, $request->input('erpPayments'));
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Transaksi Disimpan ke Database (Laravel)',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Transaksi dibatalkan: ' . $this->firstValidationMessage($e),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function bulkStore(Request $request, GoamlComplianceService $goaml, TransactionLedgerPoster $ledger)
    {
        // WAJIB didefinisikan sebelum dipakai.
        $transactions = $request->input('transactions', []);

        if (!is_array($transactions)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Format data transaksi tidak valid',
            ], 400);
        }

        if (count($transactions) === 0) {
            return response()->json([
                'status' => 'success',
                'message' => 'Tidak ada transaksi untuk diproses',
                'success_count' => 0,
                'failed_count' => 0,
                'errors' => [],
            ]);
        }

        $successCount = 0;
        $failedCount = 0;
        $errors = [];

        DB::beginTransaction();

        try {


            foreach ($transactions as $index => $input) {
                if (!is_array($input)) {
                    $failedCount++;
                    $errors[] = 'Baris ' . ($index + 1) . ': format transaksi tidak valid';
                    continue;
                }

                $invoiceId = $input['id'] ?? $input['itemId'] ?? null;

                if (!$invoiceId) {
                    $failedCount++;
                    $errors[] = 'Baris ' . ($index + 1) . ': Invoice ID/itemId kosong';
                    continue;
                }

                $itemId = $input['itemId']
                    ?? ($invoiceId . '-' . Str::lower(Str::random(6)));

                try {
                    $data = [
                        'id' => $invoiceId,
                        'timestamp' => Carbon::parse($input['timestamp'] ?? now())->format('Y-m-d H:i:s'),
                        'tipe' => $input['tipe'] ?? 'JUAL',
                        'valuta' => $input['valuta'] ?? '',
                        'nominal' => (float) ($input['nominal'] ?? 0),
                        'rate' => (float) ($input['rate'] ?? 0),
                        'total' => (float) ($input['total'] ?? 0),
                        'id_cif' => $input['customerId'] ?? $input['id_cif'] ?? '',
                        'customerName' => $input['customerName'] ?? '',
                        'kasir' => $input['kasir'] ?? '',
                        'paymentMethod' => $input['paymentMethod'] ?? 'TUNAI',
                        'isOldMoney' => (bool) ($input['isOldMoney'] ?? false),
                        'keterangan' => $input['keterangan'] ?? '',
                        'raw_json' => json_encode($input),
                    ];

                    // Satu baris = satu savepoint: kegagalan pencatatan ledger hanya
                    // membatalkan baris tersebut, bukan seluruh kiriman.
                    DB::transaction(function () use ($itemId, $data, $goaml, $ledger, $input) {
                        $transaction = Transaction::updateOrCreate(
                            ['itemId' => $itemId],
                            $data
                        );

                        // Jalankan compliance engine untuk setiap transaksi yang berhasil disimpan.
                        $goaml->evaluateTransaction($transaction);

                        $this->postToLedger($ledger, $transaction, $input['erpPayments'] ?? null);
                    });

                    $successCount++;
                } catch (\Exception $e) {
                    $failedCount++;
                    $message = $e instanceof ValidationException
                        ? $this->firstValidationMessage($e)
                        : $e->getMessage();
                    $errors[] = 'Baris ' . ($index + 1) . ' (Item ID: ' . $itemId . '): ' . $message;
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'status' => 'error',
                'message' => 'Gagal memproses transaksi database: ' . $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'status' => ($failedCount === 0 ? 'success' : 'error'),
            'message' => "Proses import transaksi selesai. Sukses: {$successCount}, Gagal: {$failedCount}",
            'success_count' => $successCount,
            'failed_count' => $failedCount,
            'errors' => $errors,
        ]);
    }

    /**
     * Catat sisi keuangan transaksi baru ke ledger ERP.
     *
     * Hanya dijalankan untuk transaksi yang BARU dibuat dan membawa daftar
     * pembayaran (erpPayments) dari POS. Kiriman ulang atau pengeditan baris
     * lama tidak mencatat mutasi lagi.
     */
    private function postToLedger(TransactionLedgerPoster $ledger, Transaction $transaction, mixed $payments): void
    {
        if (!$transaction->wasRecentlyCreated) {
            return;
        }

        if (!is_array($payments) || $payments === []) {
            return;
        }

        $tipe = strtoupper(trim((string) $transaction->tipe));
        if (!in_array($tipe, ['BELI', 'JUAL'], true)) {
            return;
        }

        $ledger->post($transaction, $payments, optional(request()->user())->id);
    }

    private function firstValidationMessage(ValidationException $e): string
    {
        $messages = collect($e->errors())->flatten();

        return (string) ($messages->first() ?? $e->getMessage());
    }

    public function destroy(Request $request)
    {
        $itemId = $request->input('itemId');
        $id = $request->input('id');

        if (!$itemId && !$id) {
            return response()->json(['status' => 'error', 'message' => 'Missing ID'], 400);
        }

        try {
            $query = Transaction::query();

            if ($itemId) {
                $query->where('itemId', $itemId);
            } else {
                $query->where('id', $id);
            }

            $deleted = $query->delete();

            return response()->json([
                'status' => 'success',
                'message' => $deleted > 0
                    ? 'Transaksi Dibatalkan/Dihapus (Laravel)'
                    : 'Tidak ada transaksi yang cocok untuk dihapus',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function clearAll()
    {
        try {
            // Penghapusan permanen: pastikan backup database sudah dibuat sebelum memakai fitur ini.
            Transaction::query()->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Semua riwayat transaksi telah dihapus.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal membersihkan transaksi: ' . $e->getMessage(),
            ], 500);
        }
    }
}
