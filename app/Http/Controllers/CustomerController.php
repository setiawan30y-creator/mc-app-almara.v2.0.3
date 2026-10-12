<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Datastore;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
    public function index()
    {
        $customers = Customer::orderBy('registration_date', 'desc')->get();
        return response()->json($customers);
    }

    public function store(Request $request)
    {
        $input = $request->all();

        if (!isset($input['id_nasabah'])) {
            return response()->json(['status' => 'error', 'message' => 'ID Nasabah (internal_id) tidak boleh kosong'], 400);
        }

        $internal_id = $input['id_nasabah'];
        try {
            $input['foto_id'] = $this->storeCustomerPhoto($input['foto_id'] ?? null, $internal_id);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
        
        $registrationDate = now()->toDateString();

        if (!empty($input['tgl_daftar'])) {
            try {
                $registrationDate = Carbon::parse($input['tgl_daftar'])->toDateString();
            } catch (\Throwable $e) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Format tgl_daftar tidak valid'
                ], 422);
            }
        }

        $identity = $this->normalizeIdentityNumbers(
            $input['jenis_id'] ?? 'KTP',
            $input['no_ktp'] ?? null,
            $input['selain_ktp'] ?? null
        );

        $input['kn'] = $this->normalizeCustomerType($input['kn'] ?? null);
        $data = [
            'idpjk' => $input['idpjk'] ?? '-',
            'id_cif' => $input['no_cif'] ?? '-',
            'name' => $input['nama'] ?? '',
            'phone' => $input['no_hp'] ?? '-',
            'identity_type' => $input['jenis_id'] ?? 'KTP',
            'identity_number' => $identity['no_ktp'],
            'selain_ktp' => $identity['selain_ktp'],
            'address' => $input['alamat'] ?? '-',
            'tempat_lahir' => $input['tempat_lahir'] ?? '-',
            'tanggal_lahir' => $input['tanggal_lahir'] ?? '-',
            'npwp' => $input['npwp'] ?? '-',
            'local_id' => $input['local_id'] ?? '-',
            'jenis_kelamin' => $input['jenis_kelamin'] ?? '-',
            'warga_negara' => $input['warga_negara'] ?? '-',
            'pekerjaan' => $input['pekerjaan'] ?? '-',
            'no_rekening' => $input['no_rekening'] ?? '-',
            'registration_date' => $registrationDate,
            'customer_type' => $input['kn'],
            'jenis_badan_usaha' => $input['jenis_badan_usaha'] ?? null,
            'bidang_usaha' => $input['bidang_usaha'] ?? null,
            'nib' => $input['nib'] ?? null,
            'raw_json' => json_encode($input)
        ];

        try {
            Customer::updateOrCreate(
                ['internal_id' => $internal_id],
                $data
            );
            Datastore::where('store_key', 'mc_customers_reset_at')->delete();
            return response()->json([
                'status' => 'success', 
                'message' => 'Data Nasabah Berhasil Disimpan (Laravel)',
                'data' => $input
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error', 
                'message' => 'Gagal: ' . $e->getMessage()
            ], 500);
        }
    }

    public function bulkStore(Request $request)
    {
        $customers = $request->input('customers', []);
        if (!is_array($customers)) {
            return response()->json(['status' => 'error', 'message' => 'Format data tidak valid'], 400);
        }

        $successCount = 0;
        $failedCount = 0;
        $errors = [];

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            foreach ($customers as $index => $input) {
                $rawId = $input['id_nasabah'] ?? $input['internal_id'] ?? null;
                if ($rawId === null || trim($rawId) === '') {
                    $failedCount++;
                    $errors[] = "Baris " . ($index + 1) . ": ID Nasabah kosong";
                    continue;
                }

                $internal_id = substr(trim($rawId), 0, 50);

                $registrationDate = now()->toDateString();
                $rawTglDaftar = $input['tgl_daftar'] ?? $input['registration_date'] ?? null;
                if (!empty($rawTglDaftar) && $rawTglDaftar !== '-') {
                    try {
                        $registrationDate = Carbon::parse($rawTglDaftar)->toDateString();
                    } catch (\Throwable $e) {
                        $registrationDate = now()->toDateString();
                    }
                }

                $identity = $this->normalizeIdentityNumbers(
                    $input['jenis_id'] ?? $input['identity_type'] ?? 'KTP',
                    $input['no_ktp'] ?? $input['identity_number'] ?? null,
                    $input['selain_ktp'] ?? null
                );

                $input['kn'] = $this->normalizeCustomerType($input['kn'] ?? $input['customer_type'] ?? null);
                $data = [
                    'idpjk' => substr(trim($input['idpjk'] ?? '-'), 0, 50),
                    'id_cif' => substr(trim($input['no_cif'] ?? $input['id_cif'] ?? '-'), 0, 50),
                    'name' => substr(trim($input['nama'] ?? $input['name'] ?? ''), 0, 255),
                    'phone' => substr(trim($input['no_hp'] ?? $input['phone'] ?? '-'), 0, 50),
                    'identity_type' => substr(trim($input['jenis_id'] ?? $input['identity_type'] ?? 'KTP'), 0, 50),
                    'identity_number' => $identity['no_ktp'],
                    'selain_ktp' => $identity['selain_ktp'],
                    'address' => $input['alamat'] ?? $input['address'] ?? '-',
                    'tempat_lahir' => substr(trim($input['tempat_lahir'] ?? '-'), 0, 100),
                    'tanggal_lahir' => substr(trim($input['tanggal_lahir'] ?? '-'), 0, 50),
                    'npwp' => substr(trim($input['npwp'] ?? '-'), 0, 50),
                    'local_id' => substr(trim($input['local_id'] ?? '-'), 0, 50),
                    'jenis_kelamin' => substr(trim($input['jenis_kelamin'] ?? '-'), 0, 20),
                    'warga_negara' => substr(trim($input['warga_negara'] ?? '-'), 0, 100),
                    'pekerjaan' => substr(trim($input['pekerjaan'] ?? '-'), 0, 100),
                    'no_rekening' => substr(trim($input['no_rekening'] ?? '-'), 0, 100),
                    'registration_date' => $registrationDate,
                    'customer_type' => $input['kn'],
                    'jenis_badan_usaha' => $input['jenis_badan_usaha'] ?? null,
            'bidang_usaha' => $input['bidang_usaha'] ?? null,
            'nib' => $input['nib'] ?? null,
                    'raw_json' => json_encode($input)
                ];

                try {
                    Customer::updateOrCreate(
                        ['internal_id' => $internal_id],
                        $data
                    );
                    $successCount++;
                } catch (\Exception $e) {
                    $failedCount++;
                    $errors[] = "Baris " . ($index + 1) . " (ID: $internal_id): " . $e->getMessage();
                }
            }
            \Illuminate\Support\Facades\DB::commit();
            Datastore::where('store_key', 'mc_customers_reset_at')->delete();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal memproses transaksi database: ' . $e->getMessage()
            ], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => "Proses import selesai. Sukses: {$successCount}, Gagal: {$failedCount}",
            'success_count' => $successCount,
            'failed_count' => $failedCount,
            'errors' => $errors
        ]);
    }

    public function destroy(Request $request)
    {
        $id = $request->input('id_nasabah');
        if (!$id) {
            return response()->json(['status' => 'error', 'message' => 'Missing ID'], 400);
        }

        try {
            if ($id === '__ALL__') {
                Customer::query()->delete();
                Datastore::where('store_key', 'mc_customers')->delete();
                Datastore::updateOrCreate(
                    ['store_key' => 'mc_customers_reset_at'],
                    ['json_data' => now()->toIso8601String()]
                );
                $this->clearCustomerPhotos();
                return response()->json([
                    'status' => 'success',
                    'message' => 'SEMUA Data Nasabah Telah Dibersihkan'
                ]);
            }

            $deletedCount = Customer::where('internal_id', $id)->delete();
            $remainingCustomers = Customer::query()->exists();

            if (!$remainingCustomers) {
                Datastore::where('store_key', 'mc_customers')->delete();
                Datastore::updateOrCreate(
                    ['store_key' => 'mc_customers_reset_at'],
                    ['json_data' => now()->toIso8601String()]
                );
            }

            return response()->json([
                'status' => 'success', 
                'message' => $deletedCount > 0 ? 'Data Nasabah Dihapus (Laravel)' : 'Data Nasabah sudah tidak ditemukan di server',
                'deleted_count' => $deletedCount,
                'remaining_count' => $remainingCustomers ? Customer::count() : 0,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error', 
                'message' => 'Gagal: ' . $e->getMessage()
            ], 500);
        }
    }

    public function clearAll()
    {
        try {
            Customer::query()->delete();
            Datastore::where('store_key', 'mc_customers')->delete();
            Datastore::updateOrCreate(
                ['store_key' => 'mc_customers_reset_at'],
                ['json_data' => now()->toIso8601String()]
            );
            $this->clearCustomerPhotos();
            return response()->json([
                'status' => 'success', 
                'message' => 'SEMUA Data Nasabah Telah Dibersihkan'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error', 
                'message' => 'Gagal Membersihkan: ' . $e->getMessage()
            ], 500);
        }
    }

    /** Normalisasi KN agar database hanya menyimpan 1 (perorangan) atau 2 (perusahaan). */
    private function normalizeCustomerType($value): string
    {
        $normalized = strtolower(trim((string) $value));
        return $normalized === '2' || str_contains($normalized, 'perusahaan') || str_contains($normalized, 'corporate')
            ? '2'
            : '1';
    }

    /** KTP disimpan di no_ktp; jenis identitas selain KTP disimpan di selain_ktp. */
    private function normalizeIdentityNumbers($identityType, $nik, $otherId): array
    {
        $type = strtoupper(trim((string) $identityType));
        $primary = trim((string) $nik);
        $secondary = trim((string) $otherId);
        if ($type === 'KTP') {
            return [
                'no_ktp' => substr($primary !== '' ? $primary : '-', 0, 100),
                'selain_ktp' => substr($secondary !== '' ? $secondary : '-', 0, 100),
            ];
        }
        return [
            'no_ktp' => '-',
            'selain_ktp' => substr($secondary !== '' ? $secondary : ($primary !== '' ? $primary : '-'), 0, 100),
        ];
    }

    private function storeCustomerPhoto($photo, string $internalId): ?string
    {
        if (!$photo || !is_string($photo)) {
            return $photo ?: null;
        }

        if (!str_starts_with($photo, 'data:image/')) {
            return $photo;
        }

        if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/', $photo, $matches)) {
            return null;
        }

        $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $binary = base64_decode($matches[2], true);
        if ($binary === false) {
            return null;
        }

        try {
            $directory = public_path('uploads/customers/photos');
            if (!File::exists($directory)) {
                if (!File::makeDirectory($directory, 0755, true)) {
                    throw new \Exception("Gagal membuat direktori: " . $directory);
                }
            }

            $safeId = Str::slug($internalId) ?: 'customer';
            $filename = $safeId . '-' . now()->format('YmdHis') . '-' . Str::random(6) . '.' . $extension;
            
            if (File::put($directory . DIRECTORY_SEPARATOR . $filename, $binary) === false) {
                throw new \Exception("Gagal menulis file foto nasabah");
            }

            return '/uploads/customers/photos/' . $filename;
        } catch (\Exception $e) {
            throw new \Exception("Gagal menyimpan foto nasabah ke server. Silakan periksa hak akses tulis (write permission) pada folder public/uploads di server Anda. Detail: " . $e->getMessage());
        }
    }

    private function clearCustomerPhotos(): void
    {
        $directory = public_path('uploads/customers/photos');
        if (!File::isDirectory($directory)) {
            return;
        }

        collect(File::files($directory))
            ->reject(fn ($file) => $file->getFilename() === '.gitignore')
            ->each(fn ($file) => File::delete($file->getPathname()));
    }
}
