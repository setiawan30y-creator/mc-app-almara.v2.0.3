<?php

namespace App\Services;

use App\Support\PrivateUploads;
use App\Models\BackupLog;
use App\Models\BackupSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

class BackupService
{
    public const HEARTBEAT_KEY = 'mc_backup_scheduler_heartbeat';

    private const FREQUENCY_HOURS = ['hourly' => 1, '2hours' => 2, '4hours' => 4, '6hours' => 6, '12hours' => 12];

    // ------------------------------------------------------------------
    // Pengaturan & lokasi
    // ------------------------------------------------------------------

    public function settings(): BackupSetting
    {
        return BackupSetting::query()->firstOrCreate([], [
            'enabled' => true,
            'frequency' => 'daily',
            'run_at' => '02:00',
            'retention_days' => 30,
            'scope' => 'database',
            'timezone' => 'Asia/Jakarta',
            'include_uploads' => true,
            'keep_min_backups' => 7,
            'alert_after_hours' => 26,
        ]);
    }

    public function defaultDir(): string
    {
        return storage_path('app'.DIRECTORY_SEPARATOR.'mc-backups');
    }

    public function primaryDir(BackupSetting $settings): string
    {
        $path = trim((string) $settings->storage_path);

        return $path !== '' ? rtrim($path, "\\/ ") : $this->defaultDir();
    }

    public function secondaryDir(BackupSetting $settings): ?string
    {
        $path = trim((string) $settings->secondary_path);

        return $path !== '' ? rtrim($path, "\\/ ") : null;
    }

    /**
     * Memastikan folder bisa dipakai: dibuat bila belum ada, bisa ditulis, dan tidak berada
     * di folder web (public) atau di dalam kode aplikasi.
     *
     * @return array{path:string,free_bytes:?int}
     */
    public function validateDir(string $path): array
    {
        $path = rtrim(trim($path), "\\/ ");
        if ($path === '') {
            throw new \RuntimeException('Lokasi penyimpanan kosong.');
        }

        try {
            File::ensureDirectoryExists($path, 0755, true);
        } catch (\Throwable $e) {
            throw new \RuntimeException("Folder '{$path}' tidak bisa dibuat: ".$e->getMessage());
        }

        $real = realpath($path);
        if ($real === false || !is_dir($real)) {
            throw new \RuntimeException("Folder '{$path}' tidak ditemukan.");
        }

        $norm = fn (string $p) => strtolower(rtrim(str_replace('\\', '/', $p), '/')).'/';
        $target = $norm($real);
        $public = $norm((string) realpath(public_path()));
        $base = $norm((string) realpath(base_path()));
        $storage = $norm((string) realpath(storage_path()));

        if (str_starts_with($target, $public)) {
            throw new \RuntimeException('Lokasi tidak boleh berada di folder web (public) karena bisa diunduh publik.');
        }
        if (str_starts_with($target, $base) && !str_starts_with($target, $storage)) {
            throw new \RuntimeException('Pilih lokasi di luar folder aplikasi (misalnya D:\\Backup\\MC-Almara).');
        }

        $probe = $real.DIRECTORY_SEPARATOR.'.write-test-'.bin2hex(random_bytes(4));
        if (@file_put_contents($probe, 'ok') === false) {
            throw new \RuntimeException("Folder '{$path}' tidak bisa ditulis. Periksa hak akses atau pastikan drive terpasang.");
        }
        @unlink($probe);

        $free = @disk_free_space($real);

        return ['path' => $real, 'free_bytes' => $free === false ? null : (int) $free];
    }

    // ------------------------------------------------------------------
    // Menjalankan backup
    // ------------------------------------------------------------------

    public function run(string $type = 'manual', mixed $createdBy = null): BackupLog
    {
        $this->failStale();

        $settings = $this->settings();
        $primary = $this->validateDir($this->primaryDir($settings))['path'];
        $secondary = $this->secondaryDir($settings);
        $warnings = [];

        $stamp = now($settings->timezone ?: 'Asia/Jakarta')->format('Ymd_His');
        $dbName = 'MC_ALMARA_DB_'.$stamp.'.sql.gz';
        $filesName = 'MC_ALMARA_FILES_'.$stamp.'.zip';
        $dbPath = $primary.DIRECTORY_SEPARATOR.$dbName;
        $filesPath = $primary.DIRECTORY_SEPARATOR.$filesName;
        $tempSql = $primary.DIRECTORY_SEPARATOR.'.'.$dbName.'.sql';

        $log = BackupLog::create([
            'filename' => $dbName,
            'type' => $type,
            'scope' => $settings->include_uploads ? 'database+files' : 'database',
            'status' => 'running',
            'started_at' => now(),
            // users.id berupa teks (mis. 'u1'); kolom ini numerik, jadi hanya simpan bila angka.
            'created_by' => is_numeric($createdBy) ? (int) $createdBy : null,
        ]);

        $output = null;

        try {
            // 1. Dump database
            $binary = $this->findMysqldump();
            $config = config('database.connections.'.config('database.default'));
            if (($config['driver'] ?? null) !== 'mysql') {
                throw new \RuntimeException('Backup database saat ini hanya mendukung koneksi MySQL.');
            }

            $command = [
                $binary,
                '--host='.($config['host'] ?? '127.0.0.1'),
                '--port='.(string) ($config['port'] ?? 3306),
                '--user='.($config['username'] ?? ''),
                '--default-character-set=utf8mb4',
                '--single-transaction',
                '--quick',
                '--no-tablespaces',
                '--routines',
                '--triggers',
                '--events',
                (string) ($config['database'] ?? ''),
            ];

            $env = $_ENV;
            $env['MYSQL_PWD'] = (string) ($config['password'] ?? '');

            $process = new Process($command, base_path(), $env, null, 1800);
            $output = fopen($tempSql, 'wb');
            if (!$output) {
                throw new \RuntimeException('Tidak dapat membuat file sementara backup.');
            }
            $process->run(function ($pType, $buffer) use ($output) {
                if ($pType === Process::OUT) {
                    fwrite($output, $buffer);
                }
            });
            fclose($output);
            $output = null;

            if (!$process->isSuccessful()) {
                throw new \RuntimeException(trim($process->getErrorOutput()) ?: 'mysqldump gagal.');
            }

            $this->gzipFile($tempSql, $dbPath);
            @unlink($tempSql);
            $this->verifyGzipDump($dbPath);

            $files = [$this->describe($dbPath, 'db')];

            // 2. Arsip foto/dokumen unggahan
            if ($settings->include_uploads) {
                // Berkas ada di penyimpanan privat; folder publik lama dipakai hanya bila belum dipindah.
                $uploads = is_dir(PrivateUploads::root()) ? PrivateUploads::root() : public_path('uploads');
                if (is_dir($uploads)) {
                    if (!class_exists(\ZipArchive::class)) {
                        $warnings[] = 'Ekstensi PHP zip tidak aktif, foto/dokumen tidak ikut di-backup.';
                    } elseif ($this->zipDirectory($uploads, $filesPath, 'uploads')) {
                        $files[] = $this->describe($filesPath, 'files');
                    }
                }
            }

            // 3. Salinan kedua (disk lain / flashdisk / folder jaringan)
            $copies = [];
            if ($secondary) {
                try {
                    $second = $this->validateDir($secondary)['path'];
                    if (strtolower($second) === strtolower($primary)) {
                        $warnings[] = 'Lokasi kedua sama dengan lokasi utama, tidak ada salinan terpisah.';
                    } else {
                        foreach ($files as $file) {
                            $target = $second.DIRECTORY_SEPARATOR.$file['name'];
                            if (!@copy($primary.DIRECTORY_SEPARATOR.$file['name'], $target)
                                || hash_file('sha256', $target) !== $file['sha256']) {
                                throw new \RuntimeException("Salinan {$file['name']} ke lokasi kedua gagal diverifikasi.");
                            }
                        }
                        $copies[] = $second;
                    }
                } catch (\Throwable $e) {
                    $warnings[] = 'Salinan kedua gagal: '.$e->getMessage();
                }
            }

            $log->update([
                'size_bytes' => array_sum(array_column($files, 'size')),
                'checksum' => $files[0]['sha256'],
                'status' => 'success',
                'completed_at' => now(),
                'metadata' => [
                    'database' => $config['database'] ?? null,
                    'driver' => $config['driver'] ?? null,
                    'primary_dir' => $primary,
                    'secondary_dirs' => $copies,
                    'files' => $files,
                    'verified' => true,
                    'verified_at' => now()->toIso8601String(),
                    'warnings' => $warnings,
                ],
            ]);

            $this->prune($settings);

            return $log->fresh();
        } catch (\Throwable $e) {
            if (is_resource($output)) {
                @fclose($output);
            }
            @unlink($tempSql);
            @unlink($dbPath);
            @unlink($filesPath);
            $log->update([
                'status' => 'failed',
                'completed_at' => now(),
                'error_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
            throw $e;
        }
    }

    /** Backup yang berstatus running lebih dari 2 jam dianggap macet. */
    public function failStale(): void
    {
        BackupLog::query()
            ->where('status', 'running')
            ->where('started_at', '<', now()->subHours(2))
            ->update([
                'status' => 'failed',
                'completed_at' => now(),
                'error_message' => 'Proses backup terhenti (tidak selesai dalam 2 jam).',
            ]);
    }

    // ------------------------------------------------------------------
    // Penjadwalan (dengan backup susulan)
    // ------------------------------------------------------------------

    /** Jadwal terakhir yang seharusnya sudah berjalan (<= sekarang). */
    public function lastSlot(BackupSetting $settings, ?Carbon $now = null): Carbon
    {
        $tz = $settings->timezone ?: 'Asia/Jakarta';
        $now = ($now ?? now())->copy()->setTimezone($tz);
        [$hour, $minute] = array_map('intval', explode(':', $settings->run_at ?: '02:00'));
        $anchor = $now->copy()->setTime($hour, $minute, 0);
        $frequency = $settings->frequency ?: 'daily';

        if (isset(self::FREQUENCY_HOURS[$frequency])) {
            $stepMinutes = self::FREQUENCY_HOURS[$frequency] * 60;
            $k = (int) floor(($now->timestamp - $anchor->timestamp) / 60 / $stepMinutes);

            return $anchor->copy()->addMinutes($k * $stepMinutes);
        }

        if ($frequency === 'weekly') {
            $slot = $now->copy()->startOfWeek(Carbon::MONDAY)->setTime($hour, $minute, 0);

            return $slot->greaterThan($now) ? $slot->subWeek() : $slot;
        }

        return $anchor->greaterThan($now) ? $anchor->subDay() : $anchor;
    }

    public function nextSlot(BackupSetting $settings): Carbon
    {
        $last = $this->lastSlot($settings);
        $frequency = $settings->frequency ?: 'daily';

        return isset(self::FREQUENCY_HOURS[$frequency])
            ? $last->copy()->addHours(self::FREQUENCY_HOURS[$frequency])
            : ($frequency === 'weekly' ? $last->copy()->addWeek() : $last->copy()->addDay());
    }

    public function shouldRunAutomatically(): bool
    {
        $this->failStale();

        $settings = BackupSetting::query()->first();
        if (!$settings || !$settings->enabled) {
            return false;
        }

        if (BackupLog::where('status', 'running')->exists()) {
            return false;
        }

        // Setelah gagal, coba lagi paling cepat 15 menit kemudian.
        $recentFail = BackupLog::where('type', 'automatic')
            ->where('status', 'failed')
            ->where('created_at', '>', now()->subMinutes(15))
            ->exists();
        if ($recentFail) {
            return false;
        }

        // Belum ada backup sukses sejak jadwal terakhir -> waktunya backup (termasuk susulan).
        $slot = $this->lastSlot($settings)->copy()->setTimezone('UTC');

        return !BackupLog::where('status', 'success')->where('created_at', '>=', $slot)->exists();
    }

    public function beat(): void
    {
        try {
            Cache::put(self::HEARTBEAT_KEY, now()->toIso8601String(), 7 * 24 * 3600);
        } catch (\Throwable $e) {
            // cache tidak tersedia: abaikan, hanya indikator
        }
    }

    // ------------------------------------------------------------------
    // Status kesehatan backup
    // ------------------------------------------------------------------

    public function health(): array
    {
        $settings = $this->settings();
        $last = BackupLog::where('status', 'success')->latest('id')->first();
        $latest = BackupLog::latest('id')->first();
        $heartbeat = null;
        try {
            $heartbeat = Cache::get(self::HEARTBEAT_KEY);
        } catch (\Throwable $e) {
        }
        $schedulerAlive = $heartbeat ? Carbon::parse($heartbeat)->greaterThan(now()->subMinutes(5)) : false;

        $messages = [];
        $level = 'ok';
        $raise = function (string $to, string $text) use (&$level, &$messages) {
            $order = ['ok' => 0, 'warn' => 1, 'danger' => 2];
            if ($order[$to] > $order[$level]) {
                $level = $to;
            }
            $messages[] = $text;
        };

        if (!$last) {
            $raise('danger', 'Belum pernah ada backup yang berhasil.');
        } elseif ($last->created_at->lessThan(now()->subHours(max(1, (int) $settings->alert_after_hours)))) {
            $raise('danger', 'Backup berhasil terakhir sudah lebih dari '.$settings->alert_after_hours.' jam yang lalu.');
        }
        if ($latest && $latest->status === 'failed') {
            $raise('warn', 'Backup terakhir gagal: '.mb_substr((string) $latest->error_message, 0, 160));
        }
        if ($settings->enabled && !$schedulerAlive) {
            $raise('warn', 'Penjadwal Windows belum aktif, backup otomatis tidak akan berjalan sendiri.');
        }
        if (!$settings->enabled) {
            $raise('warn', 'Backup otomatis dinonaktifkan.');
        }
        if (!$this->secondaryDir($settings)) {
            $raise('warn', 'Belum ada lokasi salinan kedua. Semua backup hanya ada di satu tempat.');
        }
        $lastWarnings = $last?->metadata['warnings'] ?? [];
        foreach ((array) $lastWarnings as $warning) {
            $raise('warn', (string) $warning);
        }

        return [
            'level' => $level,
            'messages' => $messages,
            'scheduler_alive' => $schedulerAlive,
            'scheduler_heartbeat' => $heartbeat,
            'next_run' => $settings->enabled ? $this->nextSlot($settings)->toIso8601String() : null,
            'timezone' => $settings->timezone,
            'last_success' => $last,
        ];
    }

    // ------------------------------------------------------------------
    // Retensi, file, verifikasi
    // ------------------------------------------------------------------

    public function prune(?BackupSetting $settings = null): void
    {
        $settings ??= $this->settings();
        $retention = (int) $settings->retention_days;
        if ($retention < 1) {
            return;
        }

        // Selalu sisakan N backup sukses terbaru, berapa pun umurnya.
        $keepIds = BackupLog::where('status', 'success')
            ->orderByDesc('id')
            ->limit(max(1, (int) $settings->keep_min_backups))
            ->pluck('id');

        BackupLog::where('created_at', '<', now()->subDays($retention))
            ->whereIn('status', ['success', 'failed'])
            ->whereNotIn('id', $keepIds)
            ->chunkById(100, function ($logs) {
                foreach ($logs as $log) {
                    foreach ($this->allPaths($log) as $path) {
                        if (is_file($path)) {
                            @unlink($path);
                        }
                    }
                    $log->delete();
                }
            });
    }

    /** @return array<int,array{name:string,size:int,sha256:string,kind:string}> */
    public function logFiles(BackupLog $log): array
    {
        $files = $log->metadata['files'] ?? null;
        if (is_array($files) && $files) {
            return $files;
        }

        return [['name' => $log->filename, 'size' => (int) $log->size_bytes, 'sha256' => (string) $log->checksum, 'kind' => 'db']];
    }

    /** Lokasi file utama (kind: db | files). */
    public function filePath(BackupLog $log, string $kind = 'db'): string
    {
        $dir = $log->metadata['primary_dir'] ?? $this->defaultDir();
        foreach ($this->logFiles($log) as $file) {
            if (($file['kind'] ?? 'db') === $kind) {
                return rtrim($dir, "\\/").DIRECTORY_SEPARATOR.$file['name'];
            }
        }

        return rtrim($dir, "\\/").DIRECTORY_SEPARATOR.$log->filename;
    }

    /** @return string[] semua lokasi file (utama + salinan) untuk penghapusan. */
    private function allPaths(BackupLog $log): array
    {
        $dirs = array_merge([$log->metadata['primary_dir'] ?? $this->defaultDir()], (array) ($log->metadata['secondary_dirs'] ?? []));
        $paths = [];
        foreach ($this->logFiles($log) as $file) {
            foreach ($dirs as $dir) {
                $paths[] = rtrim((string) $dir, "\\/").DIRECTORY_SEPARATOR.$file['name'];
            }
        }

        return $paths;
    }

    /** Hitung ulang checksum file di lokasi utama dan salinan. */
    public function verify(BackupLog $log): array
    {
        $results = [];
        $ok = true;
        $dirs = array_merge([$log->metadata['primary_dir'] ?? $this->defaultDir()], (array) ($log->metadata['secondary_dirs'] ?? []));

        foreach ($this->logFiles($log) as $file) {
            foreach ($dirs as $i => $dir) {
                $path = rtrim((string) $dir, "\\/").DIRECTORY_SEPARATOR.$file['name'];
                $exists = is_file($path);
                $match = $exists && hash_file('sha256', $path) === ($file['sha256'] ?? null);
                $ok = $ok && $match;
                $results[] = ['file' => $file['name'], 'location' => $i === 0 ? 'utama' : 'salinan', 'dir' => $dir, 'exists' => $exists, 'valid' => $match];
            }
        }

        $meta = (array) $log->metadata;
        $meta['verified'] = $ok;
        $meta['verified_at'] = now()->toIso8601String();
        $log->update(['metadata' => $meta]);

        return ['valid' => $ok, 'results' => $results];
    }

    // ------------------------------------------------------------------
    // Utilitas
    // ------------------------------------------------------------------

    private function describe(string $path, string $kind): array
    {
        return [
            'name' => basename($path),
            'size' => (int) filesize($path),
            'sha256' => hash_file('sha256', $path),
            'kind' => $kind,
        ];
    }

    /** Dump yang sah berakhir dengan baris "Dump completed". */
    private function verifyGzipDump(string $path): void
    {
        if (!is_file($path) || filesize($path) === 0) {
            throw new \RuntimeException('File backup kosong atau tidak berhasil dibuat.');
        }

        $gz = gzopen($path, 'rb');
        if (!$gz) {
            throw new \RuntimeException('File backup tidak bisa dibuka kembali untuk verifikasi.');
        }
        $tail = '';
        while (!gzeof($gz)) {
            $chunk = gzread($gz, 1024 * 1024);
            if ($chunk === false) {
                gzclose($gz);
                throw new \RuntimeException('Arsip backup rusak saat verifikasi.');
            }
            $tail = substr($tail.$chunk, -2048);
        }
        gzclose($gz);

        if (!str_contains($tail, 'Dump completed')) {
            throw new \RuntimeException('Hasil dump tidak lengkap (penutup "Dump completed" tidak ditemukan).');
        }
    }

    private function zipDirectory(string $dir, string $zipPath, string $rootName): bool
    {
        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Gagal membuat arsip foto/dokumen.');
        }

        $count = 0;
        $base = rtrim(realpath($dir), "\\/");
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $relative = ltrim(str_replace('\\', '/', substr($file->getRealPath(), strlen($base))), '/');
                $zip->addFile($file->getRealPath(), $rootName.'/'.$relative);
                $count++;
            }
        }
        $zip->close();

        if ($count === 0) {
            @unlink($zipPath);

            return false;
        }

        return true;
    }

    protected function gzipFile(string $source, string $destination): void
    {
        $in = fopen($source, 'rb');
        $out = gzopen($destination, 'wb9');

        if (!$in || !$out) {
            if ($in) {
                fclose($in);
            }
            if ($out) {
                gzclose($out);
            }
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
        $candidates = [env('MYSQLDUMP_PATH'), 'mysqldump'];

        if (PHP_OS_FAMILY === 'Windows') {
            $found = glob('C:\\laragon\\bin\\mysql\\*\\bin\\mysqldump.exe') ?: [];
            rsort($found);
            $candidates = array_merge($candidates, $found, ['C:\\xampp\\mysql\\bin\\mysqldump.exe']);
        } else {
            $candidates = array_merge($candidates, ['/usr/bin/mysqldump', '/usr/local/bin/mysqldump']);
        }

        foreach (array_filter($candidates) as $candidate) {
            if ($candidate === 'mysqldump' || is_file($candidate)) {
                if ($candidate === 'mysqldump') {
                    $probe = new Process(['mysqldump', '--version']);
                    $probe->run();
                    if (!$probe->isSuccessful()) {
                        continue;
                    }
                }

                return $candidate;
            }
        }

        throw new \RuntimeException('mysqldump tidak ditemukan. Set MYSQLDUMP_PATH di .env atau pastikan mysqldump ada di PATH.');
    }

    // ------------------------------------------------------------------
    // Restore
    // ------------------------------------------------------------------

    /**
     * Pulihkan database dari file .sql.gz (dan opsional foto/dokumen dari zip).
     * Backup pengaman dibuat lebih dulu; bila gagal, restore tidak dijalankan.
     *
     * @return array{safety_backup: ?string, tables_restored: bool, files_restored: int}
     */
    public function restore(string $dbGzPath, ?string $filesZipPath, mixed $actorId = null): array
    {
        @set_time_limit(0);

        if (!is_file($dbGzPath)) {
            throw new \RuntimeException('File backup tidak ditemukan: '.basename($dbGzPath));
        }
        $this->verifyGzipDump($dbGzPath);

        $config = config('database.connections.'.config('database.default'));
        if (($config['driver'] ?? null) !== 'mysql') {
            throw new \RuntimeException('Restore saat ini hanya mendukung koneksi MySQL.');
        }
        $binary = $this->findMysqlClient();

        // 1. Backup pengaman kondisi sekarang.
        $safety = $this->run('manual', $actorId);

        // Riwayat backup ikut tertimpa saat restore; simpan lalu pulihkan agar tetap lengkap.
        $history = BackupLog::query()->get()->map(fn ($l) => $l->getAttributes())->all();

        // 2. Uraikan gzip ke file SQL sementara.
        $tempSql = rtrim($this->primaryDir($this->settings()), "\\/").DIRECTORY_SEPARATOR.'.restore_'.uniqid().'.sql';
        try {
            $in = gzopen($dbGzPath, 'rb');
            $out = fopen($tempSql, 'wb');
            if (!$in || !$out) {
                throw new \RuntimeException('Tidak dapat menyiapkan file sementara restore.');
            }
            while (!gzeof($in)) {
                $chunk = gzread($in, 1024 * 1024);
                if ($chunk === false) {
                    throw new \RuntimeException('Arsip backup rusak saat dibaca.');
                }
                fwrite($out, $chunk);
            }
            gzclose($in);
            fclose($out);

            // 3. Jalankan mysql client.
            $command = [
                $binary,
                '--host='.($config['host'] ?? '127.0.0.1'),
                '--port='.(string) ($config['port'] ?? 3306),
                '--user='.($config['username'] ?? ''),
                '--default-character-set=utf8mb4',
                (string) ($config['database'] ?? ''),
            ];
            $env = $_ENV;
            $env['MYSQL_PWD'] = (string) ($config['password'] ?? '');

            $input = fopen($tempSql, 'rb');
            $process = new Process($command, base_path(), $env, $input, 3600);
            $process->run();
            fclose($input);

            if (!$process->isSuccessful()) {
                throw new \RuntimeException('Restore database gagal: '.(trim($process->getErrorOutput()) ?: 'mysql client error').' Data sebelum restore tersimpan di backup: '.$safety->filename);
            }
        } finally {
            @unlink($tempSql);
        }

        // 4. Pulihkan riwayat backup yang tertimpa.
        try {
            $existing = \Illuminate\Support\Facades\DB::table('mc_backup_logs')->pluck('filename')->all();
            foreach ($history as $row) {
                if (in_array($row['filename'] ?? null, $existing, true)) {
                    continue;
                }
                unset($row['id']);
                \Illuminate\Support\Facades\DB::table('mc_backup_logs')->insert($row);
            }
        } catch (\Throwable $e) {
            // Riwayat hanyalah catatan; file backup tetap ada di disk.
        }

        // 5. Foto/dokumen (opsional).
        $filesRestored = 0;
        if ($filesZipPath && is_file($filesZipPath)) {
            $filesRestored = $this->restoreUploads($filesZipPath);
        }

        return [
            'safety_backup' => $safety->filename,
            'tables_restored' => true,
            'files_restored' => $filesRestored,
        ];
    }

    /** Ekstrak folder uploads dari zip backup ke storage/app/private/uploads (aman dari path traversal). */
    private function restoreUploads(string $zipPath): int
    {
        if (!class_exists(\ZipArchive::class)) {
            throw new \RuntimeException('Ekstensi PHP zip tidak aktif, foto/dokumen tidak bisa dipulihkan.');
        }
        $zip = new \ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new \RuntimeException('File zip foto/dokumen tidak bisa dibuka.');
        }

        $base = PrivateUploads::root();
        if (!is_dir($base)) {
            @mkdir($base, 0775, true);
        }
        $baseReal = realpath($base);
        $count = 0;

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = str_replace('\\', '/', (string) $zip->getNameIndex($i));
            if ($name === '' || str_ends_with($name, '/')) {
                continue;
            }
            if (str_starts_with($name, 'uploads/')) {
                $name = substr($name, 8);
            }
            if ($name === '' || str_contains($name, '..') || str_starts_with($name, '/') || preg_match('/^[A-Za-z]:/', $name)) {
                continue;
            }
            $target = $baseReal.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $name);
            $dir = dirname($target);
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            $real = realpath($dir);
            if ($real === false || strpos($real, $baseReal) !== 0) {
                continue;
            }
            $stream = $zip->getStream($zip->getNameIndex($i));
            if (!$stream) {
                continue;
            }
            $out = fopen($target, 'wb');
            if ($out) {
                stream_copy_to_stream($stream, $out);
                fclose($out);
                $count++;
            }
            fclose($stream);
        }
        $zip->close();

        return $count;
    }

    protected function findMysqlClient(): string
    {
        $candidates = [env('MYSQL_CLIENT_PATH'), 'mysql'];
        $dump = env('MYSQLDUMP_PATH');
        if ($dump) {
            $candidates[] = dirname($dump).DIRECTORY_SEPARATOR.(PHP_OS_FAMILY === 'Windows' ? 'mysql.exe' : 'mysql');
        }

        if (PHP_OS_FAMILY === 'Windows') {
            $found = glob('C:\\laragon\\bin\\mysql\\*\\bin\\mysql.exe') ?: [];
            rsort($found);
            $candidates = array_merge($candidates, $found, ['C:\\xampp\\mysql\\bin\\mysql.exe']);
        } else {
            $candidates = array_merge($candidates, ['/usr/bin/mysql', '/usr/local/bin/mysql']);
        }

        foreach (array_filter($candidates) as $candidate) {
            if ($candidate === 'mysql') {
                $probe = new Process(['mysql', '--version']);
                $probe->run();
                if ($probe->isSuccessful()) {
                    return $candidate;
                }
                continue;
            }
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        throw new \RuntimeException('mysql client tidak ditemukan. Set MYSQL_CLIENT_PATH di .env atau pastikan mysql ada di PATH.');
    }
}
