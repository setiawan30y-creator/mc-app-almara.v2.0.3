<?php
// @2026-Alifiandra

namespace App\Console\Commands;

use App\Models\Datastore;
use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use Illuminate\Console\Command;

/**
 * Cek saldo awal & saldo berjalan kas/bank di ledger server (tanpa mengubah data).
 *   php artisan mc:balance-check
 */
class BalanceCheck extends Command
{
    protected $signature = 'mc:balance-check';
    protected $description = 'Tampilkan saldo awal, total masuk/keluar dan saldo kas/bank dari ledger (hanya baca)';

    public function handle(): int
    {
        $rows = [];
        foreach ([['Kas', ErpCashAccount::class], ['Bank', ErpBankAccount::class]] as [$type, $cls]) {
            foreach ($cls::query()->orderBy('id')->get() as $acc) {
                $in = (float) $acc->movements()->where('direction', 'in')->sum('amount');
                $out = (float) $acc->movements()->where('direction', 'out')->sum('amount');
                $rows[] = [
                    $type,
                    $acc->code,
                    $acc->bank_name ?? $acc->name ?? '-',
                    $acc->is_active ? 'aktif' : 'nonaktif',
                    number_format((float) $acc->opening_balance, 0, ',', '.'),
                    number_format($in, 0, ',', '.'),
                    number_format($out, 0, ',', '.'),
                    number_format((float) $acc->opening_balance + $in - $out, 0, ',', '.'),
                    optional($acc->updated_at)->format('d/m/Y H:i:s'),
                ];
            }
        }
        $this->info('Ledger kas & bank:');
        $this->table(['Jenis', 'Kode', 'Nama', 'Status', 'Saldo awal', 'Masuk', 'Keluar', 'Saldo', 'Diubah'], $rows);

        $keys = ['mc_initial_cash', 'mc_initial_bank_bca', 'mc_initial_bank_mandiri'];
        $ds = Datastore::query()->whereIn('store_key', $keys)->get();
        $this->info('Saldo awal yang tersimpan dari halaman Pengaturan:');
        $this->table(['Kunci', 'Nilai', 'Diubah'], $ds->map(fn ($d) => [
            $d->store_key,
            is_scalar($d->json_data) ? (string) $d->json_data : json_encode($d->json_data),
            optional($d->updated_at)->format('d/m/Y H:i:s'),
        ])->all());

        $this->info('Riwayat Reset Data terakhir:');
        $found = false;
        foreach (glob(storage_path('logs/laravel*.log')) ?: [] as $file) {
            foreach (@file($file) ?: [] as $line) {
                if (str_contains($line, 'Reset data dijalankan')) {
                    $this->line('  ' . mb_substr(trim($line), 0, 300));
                    $found = true;
                }
            }
        }
        if (!$found) {
            $this->line('  (tidak ada)');
        }

        return self::SUCCESS;
    }
}
