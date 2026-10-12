<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

class RunMcBackup extends Command
{
    protected $signature = 'mc:backup {--automatic : Jalankan sebagai backup otomatis jika jadwal cocok}';
    protected $description = 'Membuat backup database MC-App-Almara';

    public function handle(BackupService $backup): int
    {
        try {
            if ($this->option('automatic')) {
                if (!$backup->shouldRunAutomatically()) {
                    return self::SUCCESS;
                }
                $type = 'automatic';
            } else {
                $type = 'manual';
            }

            $log = $backup->run($type);
            $this->info("Backup berhasil: {$log->filename}");
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Backup gagal: '.$e->getMessage());
            return self::FAILURE;
        }
    }
}
