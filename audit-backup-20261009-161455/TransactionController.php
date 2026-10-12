<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\TransactionAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\GoamlComplianceService;

class TransactionController extends Controller
{
    public function index()
    {
        $transactions = Transaction::orderBy('timestamp', 'desc')
            ->orderBy('itemId', 'desc')
            ->get();

        return response()->json($transactions);
    }

    public function store(Request $request, GoamlComplianceService $goaml)
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
            $transaction = Transaction::updateOrCreate(
                ['itemId' => $itemId],
                $data
            );

            // Jalankan compliance engine setelah transaksi tersimpan.
            $goaml->evaluateTransaction($transaction);

            // RWT independen: hanya dibuat saat invoice belum memiliki audit.
            if (!TransactionAudit::where('id', $invoiceId)->exists()) {
                TransactionAudit::updateOrCreate(
                    ['itemId' => $itemId],
                    $data
                );
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Transaksi Disimpan ke Database (Laravel)',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function bulkStore(Request $request, GoamlComplianceService $goaml)
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

        $invoiceIdsToClear = [];

        foreach ($transactions as $trx) {
            if (!is_array($trx)) {
                continue;
            }

            $invoiceId = $trx['id'] ?? $trx['itemId'] ?? null;

            if ($invoiceId) {
                $invoiceIdsToClear[$invoiceId] = true;
            }
        }

        $existingAudits = [];

        foreach (array_keys($invoiceIdsToClear) as $invoiceId) {
            if (TransactionAudit::where('id', $invoiceId)->exists()) {
                $existingAudits[$invoiceId] = true;
            }
        }

        DB::beginTransaction();

        try {
            foreach (array_keys($invoiceIdsToClear) as $invoiceId) {
                // Hapus transaksi operasional lama untuk invoice yang sama.
                // RWT/audit tidak disentuh.
                Transaction::where('id', $invoiceId)->delete();
            }

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

                    $transaction = Transaction::updateOrCreate(
                        ['itemId' => $itemId],
                        $data
                    );

                    // Jalankan compliance engine untuk setiap transaksi yang berhasil disimpan.
                    $goaml->evaluateTransaction($transaction);

                    // RWT tetap independen dan tidak diubah jika invoice sudah pernah diaudit.
                    if (!isset($existingAudits[$invoiceId])) {
                        TransactionAudit::updateOrCreate(
                            ['itemId' => $itemId],
                            $data
                        );
                    }

                    $successCount++;
                } catch (\Exception $e) {
                    $failedCount++;
                    $errors[] = 'Baris ' . ($index + 1) . ' (Item ID: ' . $itemId . '): ' . $e->getMessage();
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
            'status' => 'success',
            'message' => "Proses import transaksi selesai. Sukses: {$successCount}, Gagal: {$failedCount}",
            'success_count' => $successCount,
            'failed_count' => $failedCount,
            'errors' => $errors,
        ]);
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

    public function audit()
    {
        $audit = TransactionAudit::orderBy('timestamp', 'desc')
            ->orderBy('itemId', 'desc')
            ->get();

        return response()->json($audit);
    }

    public function destroyAudit(Request $request)
    {
        $itemId = trim((string) $request->input('itemId', ''));

        if ($itemId === '') {
            return response()->json([
                'status' => 'error',
                'message' => 'ID RWT tidak ditemukan',
            ], 422);
        }

        try {
            $deleted = TransactionAudit::where('itemId', $itemId)->delete();

            return response()->json([
                'status' => 'success',
                'message' => $deleted ? 'Baris RWT berhasil dihapus' : 'Data RWT sudah tidak ditemukan',
                'deleted_count' => $deleted,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal menghapus RWT: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function clearAll()
    {
        try {
            // Riwayat transaksi boleh dikosongkan dari tampilan operasional,
            // tetapi audit harus tetap tersimpan sebagai jejak administrasi.
            Transaction::query()->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Semua riwayat transaksi telah dikosongkan. Audit transaksi tetap tersimpan.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal membersihkan transaksi: ' . $e->getMessage(),
            ], 500);
        }
    }
}
