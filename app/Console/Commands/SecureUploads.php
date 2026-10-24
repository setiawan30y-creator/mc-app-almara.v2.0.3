<?php

// @2026-Alifiandra

namespace App\Console\Commands;

use App\Support\PrivateUploads;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class SecureUploads extends Command
{
    protected $signature = 'mc:secure-uploads
        {--dry-run : Hanya tampilkan yang akan dipindah, tanpa mengubah apa pun}
        {--keep : Salin saja, jangan hapus berkas asli di public/uploads}';

    protected $description = 'Memindahkan berkas unggahan lama dari public/uploads ke penyimpanan privat (storage/app/private/uploads)';

    public function handle(): int
    {
        $from = PrivateUploads::legacyRoot();
        $to = PrivateUploads::root();

        if (!is_dir($from)) {
            $this->info('Tidak ada folder public/uploads. Tidak ada yang perlu dipindah.');
            return self::SUCCESS;
        }

        $dry = (bool) $this->option('dry-run');
        $keep = (bool) $this->option('keep');
        $fromReal = realpath($from);
        $moved = 0;
        $skipped = 0;
        $failed = 0;

        foreach (File::allFiles($from, true) as $file) {
            $name = $file->getFilename();
            if ($name === '.gitignore' || $name === '.htaccess') {
                continue;
            }
            $relative = str_replace('\\', '/', $file->getRelativePathname());
            $source = $file->getPathname();
            $target = $to . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);

            if ($dry) {
                $this->line("[uji] {$relative}");
                $moved++;
                continue;
            }

            try {
                if (is_file($target) && filesize($target) === filesize($source)) {
                    $skipped++;
                } else {
                    File::ensureDirectoryExists(dirname($target), 0775);
                    if (!@copy($source, $target) || filesize($target) !== filesize($source)) {
                        throw new \RuntimeException('salinan tidak sama dengan aslinya');
                    }
                    $moved++;
                }
                if (!$keep) {
                    @unlink($source);
                }
            } catch (\Throwable $e) {
                $failed++;
                $this->error("Gagal: {$relative} ({$e->getMessage()})");
            }
        }

        if (!$dry && !$keep && $failed === 0 && $fromReal) {
            $this->removeEmptyDirs($fromReal);
            @unlink($from . DIRECTORY_SEPARATOR . '.htaccess');
            @unlink($from . DIRECTORY_SEPARATOR . '.gitignore');
            @rmdir($from);
        }

        $this->info(($dry ? 'Simulasi: ' : '') . "dipindah/disalin {$moved}, sudah ada {$skipped}, gagal {$failed}.");
        if (!$dry && is_dir($from) && !$keep) {
            $this->warn('Folder public/uploads masih ada (berisi berkas yang gagal atau belum kosong). Periksa lalu jalankan ulang.');
        }

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function removeEmptyDirs(string $dir): void
    {
        foreach (glob($dir . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) ?: [] as $sub) {
            $this->removeEmptyDirs($sub);
            @rmdir($sub);
        }
    }
}
