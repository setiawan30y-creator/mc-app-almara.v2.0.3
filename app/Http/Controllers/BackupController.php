<?php

namespace App\Http\Controllers;

use App\Models\BackupLog;
use App\Models\BackupSetting;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BackupController extends Controller
{
    public function settings()
    {
        $settings = BackupSetting::query()->firstOrCreate([], [
            'enabled' => true,
            'frequency' => 'daily',
            'run_at' => '02:00',
            'retention_days' => 30,
            'scope' => 'database',
            'timezone' => 'Asia/Jakarta',
        ]);

        return response()->json(['status' => 'success', 'data' => $settings]);
    }

    public function saveSettings(Request $request)
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'frequency' => ['required', 'in:hourly,2hours,4hours,6hours,12hours,daily,weekly'],
            'run_at' => ['required', 'date_format:H:i'],
            'retention_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'scope' => ['required', 'in:database'],
            'timezone' => ['required', 'timezone'],
        ]);

        $settings = BackupSetting::query()->firstOrCreate([]);
        $settings->update($data);

        return response()->json(['status' => 'success', 'message' => 'Pengaturan backup disimpan.', 'data' => $settings->fresh()]);
    }

    public function index()
    {
        $logs = BackupLog::query()->latest('created_at')->limit(100)->get();
        $last = $logs->firstWhere('status', 'success');

        return response()->json([
            'status' => 'success',
            'data' => $logs,
            'last_success' => $last,
        ]);
    }

    public function run(BackupService $backup)
    {
        $log = $backup->run('manual', auth()->id());

        return response()->json([
            'status' => 'success',
            'message' => 'Backup database berhasil dibuat.',
            'data' => $log,
        ]);
    }

    public function download(BackupLog $backupLog, BackupService $backup)
    {
        abort_unless($backupLog->status === 'success', 404);

        $path = $backup->filePath($backupLog);
        abort_unless(is_file($path), 404);

        return response()->download($path, $backupLog->filename, [
            'Content-Type' => 'application/gzip',
        ]);
    }
}
