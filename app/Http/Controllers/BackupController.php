<?php

namespace App\Http\Controllers;

use App\Models\BackupLog;
use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BackupController extends Controller
{
    public function settings(BackupService $backup): JsonResponse
    {
        $settings = $backup->settings();

        return response()->json([
            'status' => 'success',
            'data' => $settings,
            'default_dir' => $backup->defaultDir(),
        ]);
    }

    public function saveSettings(Request $request, BackupService $backup): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'frequency' => ['required', 'in:hourly,2hours,4hours,6hours,12hours,daily,weekly'],
            'run_at' => ['required', 'date_format:H:i'],
            'retention_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'keep_min_backups' => ['required', 'integer', 'min:1', 'max:365'],
            'alert_after_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'include_uploads' => ['required', 'boolean'],
            'timezone' => ['required', 'timezone'],
            'storage_path' => ['nullable', 'string', 'max:500'],
            'secondary_path' => ['nullable', 'string', 'max:500'],
        ]);

        $data['storage_path'] = trim((string) ($data['storage_path'] ?? '')) ?: null;
        $data['secondary_path'] = trim((string) ($data['secondary_path'] ?? '')) ?: null;
        $data['scope'] = 'database';

        try {
            if ($data['storage_path']) {
                $backup->validateDir($data['storage_path']);
            }
            if ($data['secondary_path']) {
                $backup->validateDir($data['secondary_path']);
            }
        } catch (\Throwable $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }

        $settings = $backup->settings();
        $settings->update($data);

        return response()->json([
            'status' => 'success',
            'message' => 'Pengaturan backup disimpan.',
            'data' => $settings->fresh(),
        ]);
    }

    public function testPath(Request $request, BackupService $backup): JsonResponse
    {
        $data = $request->validate(['path' => ['required', 'string', 'max:500']]);

        try {
            $result = $backup->validateDir($data['path']);
        } catch (\Throwable $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Lokasi bisa dipakai.',
            'path' => $result['path'],
            'free_bytes' => $result['free_bytes'],
        ]);
    }

    public function index(BackupService $backup): JsonResponse
    {
        $backup->failStale();
        $logs = BackupLog::query()->latest('id')->limit(100)->get();

        return response()->json([
            'status' => 'success',
            'data' => $logs,
            'last_success' => $logs->firstWhere('status', 'success'),
            'health' => $backup->health(),
        ]);
    }

    public function run(BackupService $backup): JsonResponse
    {
        @set_time_limit(0);

        try {
            $log = $backup->run('manual', auth()->id());
        } catch (\Throwable $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Backup berhasil dibuat dan diverifikasi.',
            'data' => $log,
        ]);
    }

    public function verify(BackupLog $backupLog, BackupService $backup): JsonResponse
    {
        abort_unless($backupLog->status === 'success', 404);

        return response()->json(['status' => 'success'] + $backup->verify($backupLog));
    }

    public function download(Request $request, BackupLog $backupLog, BackupService $backup)
    {
        abort_unless($backupLog->status === 'success', 404);

        $kind = $request->query('kind') === 'files' ? 'files' : 'db';
        $path = $backup->filePath($backupLog, $kind);
        abort_unless(is_file($path), 404);

        return response()->download($path, basename($path), [
            'Content-Type' => $kind === 'files' ? 'application/zip' : 'application/gzip',
        ]);
    }

    /** Pulihkan database dari backup yang tercatat di riwayat. */
    public function restore(Request $request, BackupLog $backupLog, BackupService $backup): JsonResponse
    {
        abort_unless($backupLog->status === 'success', 404);
        $data = $request->validate([
            'password' => ['required', 'string'],
            'confirm' => ['required', 'in:RESTORE'],
            'with_files' => ['nullable', 'boolean'],
        ]);

        if (!$this->passwordOk($request, $data['password'])) {
            return response()->json(['status' => 'error', 'message' => 'Password salah. Restore dibatalkan.'], 422);
        }

        $check = $backup->verify($backupLog);
        if (!$check['valid']) {
            return response()->json(['status' => 'error', 'message' => 'Verifikasi checksum backup gagal (file hilang atau berubah). Restore dibatalkan.'], 422);
        }

        $dbPath = $backup->filePath($backupLog, 'db');
        $filesPath = null;
        if (!empty($data['with_files'])) {
            $candidate = $backup->filePath($backupLog, 'files');
            $filesPath = is_file($candidate) && $candidate !== $dbPath ? $candidate : null;
        }

        return $this->doRestore($backup, $dbPath, $filesPath, $request->user()?->id);
    }

    /** Pulihkan database dari file .sql.gz yang diunggah (mis. dari komputer lain). */
    public function restoreUpload(Request $request, BackupService $backup): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:2097152'],
            'password' => ['required', 'string'],
            'confirm' => ['required', 'in:RESTORE'],
        ]);

        if (!$this->passwordOk($request, (string) $request->input('password'))) {
            return response()->json(['status' => 'error', 'message' => 'Password salah. Restore dibatalkan.'], 422);
        }

        $file = $request->file('file');
        if (!str_ends_with(strtolower($file->getClientOriginalName()), '.sql.gz')) {
            return response()->json(['status' => 'error', 'message' => 'File harus berekstensi .sql.gz (hasil backup aplikasi ini).'], 422);
        }

        $tmp = $backup->primaryDir($backup->settings()).DIRECTORY_SEPARATOR.'.upload_'.uniqid().'.sql.gz';
        $file->move(dirname($tmp), basename($tmp));

        try {
            return $this->doRestore($backup, $tmp, null, $request->user()?->id);
        } finally {
            @unlink($tmp);
        }
    }

    private function passwordOk(Request $request, string $password): bool
    {
        $user = $request->user();

        return $user && \Illuminate\Support\Facades\Hash::check($password, (string) $user->password);
    }

    private function doRestore(BackupService $backup, string $dbPath, ?string $filesPath, mixed $actorId): JsonResponse
    {
        try {
            $result = $backup->restore($dbPath, $filesPath, $actorId);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Restore gagal', ['error' => $e->getMessage()]);

            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }

        \Illuminate\Support\Facades\Log::warning('Restore database dijalankan', ['by' => $actorId, 'source' => basename($dbPath)] + $result);

        return response()->json([
            'status' => 'success',
            'message' => 'Restore selesai.',
        ] + $result);
    }
}
