<?php
// @2026-Alifiandra

namespace App\Console\Commands;

use App\Services\RateHistoryService;
use Illuminate\Console\Command;

class RecordRateSnapshot extends Command
{
    protected $signature = 'mc:rate-snapshot {--now : Catat sekarang tanpa melihat jadwal}';
    protected $description = 'Mencatat kurs beli/jual semua valuta sesuai jadwal Riwayat Kurs (audit BI)';

    public function handle(RateHistoryService $history): int
    {
        try {
            $history->beat();

            if ($this->option('now')) {
                $n = $history->snapshot('manual', null, 'sistem (CLI)');
                $this->info("Kurs dicatat: {$n} valuta.");

                return self::SUCCESS;
            }

            $slot = $history->dueSlot();
            if (!$slot) {
                return self::SUCCESS;
            }
            $n = $history->snapshot('jadwal', $slot);
            $this->info('Kurs jam '.$slot->format('d/m/Y H:i')." dicatat: {$n} valuta.");

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Pencatatan kurs gagal: '.$e->getMessage());

            return self::FAILURE;
        }
    }
}
