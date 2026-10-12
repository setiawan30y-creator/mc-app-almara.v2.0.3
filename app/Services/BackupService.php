<?php

namespace App\Services;

use App\Models\BackupLog;
use App\Models\BackupSetting;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

class BackupService
{
    public function run(string $type = 'manual', ?int $createdBy = null): BackupLog
    {
        $settings = BackupSetting::query()->firstOrCreate([], [
            'enabled' => true,
            'frequency' => 'daily',
            'run_at' => '02:00',
            'retention_days' => 30,
            'scope' => 'database',
            'timezone' => 'Asia/Jakarta',
        ]);

        $dir = storage_path('app/mc-backups');
        File::ensureDirectoryExists($dir);

        $stamp = now($settings->timezone)->format('Ymd_His');
        $filename = 'MC_ALMARA_DB_'.$stamp.'.sql.gz';
        $path = $dir.DIRECTORY_SEPARATOR.$filename;

        $log = BackupLog::create([
            'filename' => $filename,
            'type' => $type,
            'scope' => 'database',
            'status' => 'running',
            'started_at' => now(),
            'created_by' => $createdBy,
        ]);

        $tempSql = $dir.DIRECTORY_SEPARATOR.'.'.$filename.'.sql';

        try {
            $binary = $this->findMysqldump();
            $config = config('database.connections.'.config('database.default'));

            if (($config['driver'] ?? null) !== 'mysql') {
                throw new \RuntimeException('Backup database saat ini hanya mendukung koneksi MySQL.');
            }

            $command = [
                $binary,
                '--host='.($config['host'] ?? '127.0.0.1'),
                '--port='.(string)($config['port'] ?? 3306),
                '--user='.($config['username'] ?? ''),
                '--single-transaction',
                '--quick',
                '--routines',
                '--triggers',
                '--events',
                (string)($config['database'] ?? ''),
            ];

            $env = $_ENV;
            $env['MYSQL_PWD'] = (string)($config['password'] ?? '');

            $process = new Process($command, base_path(), $env, null, 1800);
            $output = fopen($tempSql, 'wb');
            if (!$output) {
                throw new \RuntimeException('Tidak dapat membuat file sementara backup.');
            }

            $process->run(function ($type, $buffer) use ($output) {
                if ($type === Process::OUT) {
                    fwrite($output, $buffer);
                }
            });
            fclose($output);

            if (!$process->isSuccessful()) {
                throw new \RuntimeException(trim($process->getErrorOutput()) ?: 'mysqldump gagal.');
            }

            $this->gzipFile($tempSql, $path);
            @unlink($tempSql);

            if (!is_file($path) || filesize($path) === 0) {
                throw new \RuntimeException('File backup kosong atau tidak berhasil dibuat.');
            }

            $log->update([
                'size_bytes' => filesize($path),
                'checksum' => hash_file('sha256', $path),
                'status' => 'success',
                'completed_at' => now(),
                'metadata' => [
                    'database' => $config['database'] ?? null,
                    'driver' => $config['driver'] ?? null,
                ],
            ]);

            $this->prune((int) $settings->retention_days);
            return $log->fresh();
        } catch (\Throwable $e) {
            @fclose($output ?? null);
            @unlink($tempSql);
            $log->update([
                'status' => 'failed',
                'completed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    public function shouldRunAutomatically(): bool
    {
        $settings = BackupSetting::query()->first();
        if (!$settings || !$settings->enabled || $settings->scope !== 'database') {
            return false;
        }

        $tz = $settings->timezone ?: 'Asia/Jakarta';
        $now = now($tz);
        [$targetHour, $targetMinute] = array_map('intval', explode(':', $settings->run_at));
        if ((int) $now->minute !== $targetMinute) {
            return false;
        }

        $frequency = $settings->frequency ?: 'daily';
        $due = match ($frequency) {
            'hourly' => true,
            '2hours' => $now->hour % 2 === $targetHour % 2,
            '4hours' => $now->hour % 4 === $targetHour % 4,
            '6hours' => $now->hour % 6 === $targetHour % 6,
            '12hours' => $now->hour % 12 === $targetHour % 12,
            'weekly' => $now->isMonday() && $now->hour === $targetHour,
            default => $now->hour === $targetHour,
        };

        if (!$due) {
            return false;
        }

        $windowStart = match ($frequency) {
            'hourly' => $now->copy()->startOfHour(),
            '2hours' => $now->copy()->subHours(1)->startOfHour(),
            '4hours' => $now->copy()->subHours(3)->startOfHour(),
            '6hours' => $now->copy()->subHours(5)->startOfHour(),
            '12hours' => $now->copy()->subHours(11)->startOfHour(),
            'weekly' => $now->copy()->startOfDay(),
            default => $now->copy()->startOfDay(),
        };

        return !BackupLog::where('type', 'automatic')
            ->where('status', 'success')
            ->whereBetween('created_at', [$windowStart->copy()->setTimezone('UTC'), $now->copy()->setTimezone('UTC')])
            ->exists();
    }

    public function prune(int $retentionDays): void
    {
        if ($retentionDays < 1) {
            return;
        }

        BackupLog::where('created_at', '<', now()->subDays($retentionDays))
            ->whereIn('status', ['success', 'failed'])
            ->chunkById(100, function ($logs) {
                foreach ($logs as $log) {
                    $path = storage_path('app/mc-backups/'.$log->filename);
                    if (is_file($path)) {
                        @unlink($path);
                    }
                    $log->delete();
                }
            });
    }

    public function filePath(BackupLog $log): string
    {
        return storage_path('app/mc-backups/'.$log->filename);
    }

    protected function gzipFile(string $source, string $destination): void
    {
        $in = fopen($source, 'rb');
        $out = gzopen($destination, 'wb9');

        if (!$in || !$out) {
            if ($in) fclose($in);
            if ($out) gzclose($out);
            throw new \RuntimeException('Gagal membuat arsip gzip backup.');
        }

        while (!feof($in)) {
            $chunk = fread($in, 1024 * 1024);
            if ($chunk !== false && $chunk !== '') {
                gzwrite($out, $chunk);
            }
        }

        fclose($in);
        gzclose($out);
    }

    protected function findMysqldump(): string
    {
        $configured = env('MYSQLDUMP_PATH');
        $candidates = array_filter([
            $configured,
            'mysqldump',
            PHP_OS_FAMILY === 'Windows' ? 'C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysqldump.exe' : null,
            PHP_OS_FAMILY === 'Windows' ? 'C:\\xampp\\mysql\\bin\\mysqldump.exe' : null,
            '/usr/bin/mysqldump',
            '/usr/local/bin/mysqldump',
        ]);

        foreach ($candidates as $candidate) {
            if ($candidate === 'mysqldump' || is_file($candidate)) {
                return $candidate;
            }
        }

        throw new \RuntimeException('mysqldump tidak ditemukan. Set MYSQLDUMP_PATH pada .env atau pastikan mysqldump ada di PATH.');
    }
}
