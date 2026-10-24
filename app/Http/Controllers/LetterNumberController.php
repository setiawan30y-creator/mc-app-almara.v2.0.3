<?php

// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\Datastore;
use App\Models\LetterDocument;
use App\Models\LetterNumberCounter;
use App\Models\LetterRecord;
use App\Support\PrivateUploads;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\Process\Process;

/**
 * Nomor Surat: penomoran otomatis per jenis surat, riwayat, dan arsip dokumen.
 *
 * Nomor dibuat di dalam transaksi dengan kunci baris (lockForUpdate) pada
 * tabel counter, sehingga tidak ada nomor ganda walau dibuat bersamaan.
 * Nomor yang sudah terbit tidak pernah dihapus; yang salah ditandai BATAL.
 */
class LetterNumberController extends Controller
{
    private const STORE_KEY = 'mc_letter_number_settings';
    private const STATUS_WAITING = 'MENUNGGU DOKUMEN';
    private const STATUS_UPLOADED = 'DOKUMEN TERUPLOAD';
    private const STATUS_VOID = 'BATAL';
    private const MAX_FILE_BYTES = 10 * 1024 * 1024;
    private const MIME_EXT = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
    ];
    private const OFFICE_MIMES = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    /* ------------------------------------------------------------------ */
    /* Pengaturan                                                         */
    /* ------------------------------------------------------------------ */

    public function settings(): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $this->settingsArray()]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $v = $request->validate([
            'company_code' => ['required', 'string', 'max:20'],
            'format' => ['required', 'string', 'max:200'],
            'digits' => ['required', 'integer', 'min:1', 'max:10'],
            'month_format' => ['required', Rule::in(['short', 'numeric', 'long'])],
            'reset_mode' => ['required', Rule::in(['yearly', 'never'])],
            'letter_types' => ['required', 'array', 'min:1'],
            'letter_types.*.code' => ['required', 'string', 'max:20'],
            'letter_types.*.name' => ['required', 'string', 'max:100'],
        ]);

        if (!str_contains($v['format'], '{NO}')) {
            return response()->json(['status' => 'error', 'message' => 'Format nomor wajib memuat token {NO}.'], 422);
        }

        $v['company_code'] = strtoupper(trim($v['company_code']));
        $v['letter_types'] = collect($v['letter_types'])
            ->map(fn ($r) => ['code' => strtoupper(trim($r['code'])), 'name' => trim($r['name'])])
            ->filter(fn ($r) => $r['code'] !== '' && $r['name'] !== '')
            ->unique('code')
            ->values()
            ->all();

        if (!$v['letter_types']) {
            return response()->json(['status' => 'error', 'message' => 'Minimal satu jenis surat harus terisi.'], 422);
        }

        Datastore::updateOrCreate(['store_key' => self::STORE_KEY], ['json_data' => $v]);

        return response()->json(['status' => 'success', 'data' => $v]);
    }

    /* ------------------------------------------------------------------ */
    /* Penomoran                                                          */
    /* ------------------------------------------------------------------ */

    /** Pratinjau nomor berikutnya tanpa menaikkan counter. */
    public function preview(Request $request): JsonResponse
    {
        $v = $request->validate(['letter_type' => ['required', 'string', 'max:20'], 'date' => ['nullable', 'date']]);
        $s = $this->settingsArray();
        $type = strtoupper(trim($v['letter_type']));
        $date = isset($v['date']) ? Carbon::parse($v['date']) : now();

        if (!$this->typeAllowed($s, $type)) {
            return response()->json(['status' => 'error', 'message' => 'Jenis surat belum terdaftar.'], 422);
        }

        $company = strtoupper(trim($s['company_code']));
        $counter = LetterNumberCounter::where('company_code', $company)
            ->where('letter_type', $type)
            ->where('year', $this->counterYear($s, (int) $date->year))
            ->first();
        $next = ((int) ($counter->last_number ?? 0)) + 1;

        return response()->json(['status' => 'success', 'data' => [
            'number' => $this->formatNumber($next, $company, $type, $date, $s),
            'sequence' => $next,
        ]]);
    }

    public function next(Request $request): JsonResponse
    {
        $v = $request->validate([
            'letter_type' => ['required', 'string', 'max:20'],
            'date' => ['nullable', 'date'],
            'subject' => ['nullable', 'string', 'max:255'],
        ]);

        $s = $this->settingsArray();
        $company = strtoupper(trim($s['company_code']));
        $type = strtoupper(trim($v['letter_type']));
        $date = isset($v['date']) ? Carbon::parse($v['date']) : now();
        $year = (int) $date->year;

        if (!$this->typeAllowed($s, $type)) {
            return response()->json(['status' => 'error', 'message' => 'Jenis surat belum terdaftar.'], 422);
        }

        $counterYear = $this->counterYear($s, $year);

        [$number, $sequence, $recordId] = DB::transaction(function () use ($company, $type, $counterYear, $date, $v, $s) {
            $counter = LetterNumberCounter::query()
                ->where('company_code', $company)
                ->where('letter_type', $type)
                ->where('year', $counterYear)
                ->lockForUpdate()
                ->first();

            if (!$counter) {
                $counter = LetterNumberCounter::create([
                    'company_code' => $company, 'letter_type' => $type, 'year' => $counterYear, 'last_number' => 0,
                ]);
            }

            $counter->last_number = (int) $counter->last_number + 1;
            $counter->save();

            $number = $this->formatNumber($counter->last_number, $company, $type, $date, $s);
            $record = LetterRecord::create([
                'letter_number' => $number,
                'sequence' => $counter->last_number,
                'company_code' => $company,
                'letter_type' => $type,
                'letter_date' => $date->toDateString(),
                'subject' => $v['subject'] ?? null,
                'status' => self::STATUS_WAITING,
            ]);

            return [$number, $counter->last_number, $record->id];
        });

        return response()->json(['status' => 'success', 'data' => [
            'number' => $number,
            'sequence' => $sequence,
            'record_id' => $recordId,
            'company_code' => $company,
            'letter_type' => $type,
            'year' => $year,
        ]]);
    }

    /* ------------------------------------------------------------------ */
    /* Riwayat                                                            */
    /* ------------------------------------------------------------------ */

    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => LetterRecord::with('documents')->latest('id')->limit(1000)->get(),
        ]);
    }

    public function documents($id): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => LetterRecord::with('documents')->findOrFail($id)]);
    }

    /** Ubah perihal / status (termasuk pembatalan). Nomor tidak pernah berubah. */
    public function updateRecord(Request $request, $id): JsonResponse
    {
        $record = LetterRecord::with('documents')->findOrFail($id);
        $v = $request->validate([
            'subject' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in([self::STATUS_WAITING, self::STATUS_UPLOADED, self::STATUS_VOID])],
        ]);

        if (array_key_exists('subject', $v)) {
            $record->subject = $v['subject'];
        }
        if (!empty($v['status'])) {
            $record->status = $v['status'];
        }
        $record->save();

        return response()->json(['status' => 'success', 'data' => $record->fresh('documents')]);
    }

    /* ------------------------------------------------------------------ */
    /* Dokumen                                                            */
    /* ------------------------------------------------------------------ */

    public function uploadDocument(Request $request, $id): JsonResponse
    {
        $record = LetterRecord::findOrFail($id);
        $v = $request->validate([
            'data_url' => ['required', 'string'],
            'filename' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        if ($record->status === self::STATUS_VOID) {
            return response()->json(['status' => 'error', 'message' => 'Nomor ini berstatus BATAL. Aktifkan kembali sebelum mengunggah dokumen.'], 422);
        }
        if (!preg_match('/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/is', $v['data_url'], $m)) {
            return response()->json(['status' => 'error', 'message' => 'Format file tidak valid.'], 422);
        }

        $binary = base64_decode($m[2], true);
        if ($binary === false || strlen($binary) > self::MAX_FILE_BYTES) {
            return response()->json(['status' => 'error', 'message' => 'File tidak valid atau melebihi 10 MB.'], 422);
        }

        $mime = strtolower($m[1]);
        if (!isset(self::MIME_EXT[$mime])) {
            return response()->json(['status' => 'error', 'message' => 'Tipe file tidak didukung.'], 422);
        }

        $safe = Str::slug(pathinfo($v['filename'], PATHINFO_FILENAME)) ?: 'surat';
        $name = $safe . '-' . now()->format('YmdHis') . '-' . Str::random(8) . '.' . self::MIME_EXT[$mime];
        $dir = PrivateUploads::ensureDirectory('company/documents');
        file_put_contents($dir . DIRECTORY_SEPARATOR . $name, $binary);

        $doc = LetterDocument::create([
            'letter_record_id' => $record->id,
            'file_name' => $v['filename'],
            'file_url' => '/uploads/company/documents/' . $name,
            'mime_type' => $mime,
            'file_size' => strlen($binary),
            'description' => $v['description'] ?? null,
        ]);
        $record->update(['status' => self::STATUS_UPLOADED]);

        return response()->json(['status' => 'success', 'message' => 'Dokumen berhasil diupload.', 'data' => $doc]);
    }

    public function deleteDocument($documentId): JsonResponse
    {
        $doc = LetterDocument::with('letter')->findOrFail($documentId);
        $record = $doc->letter;
        $path = $this->documentPath($doc);

        $doc->delete();
        if ($path && is_file($path)) {
            @unlink($path);
        }
        if ($record && $record->status === self::STATUS_UPLOADED && !$record->documents()->exists()) {
            $record->update(['status' => self::STATUS_WAITING]);
        }

        return response()->json(['status' => 'success', 'message' => 'Dokumen dihapus.']);
    }

    public function downloadDocument($documentId)
    {
        $doc = LetterDocument::findOrFail($documentId);
        $path = $this->documentPath($doc);
        if (!$path || !is_file($path)) {
            abort(404, 'File surat tidak ditemukan.');
        }

        return response()->download($path, $doc->file_name, ['Content-Type' => $doc->mime_type ?: 'application/octet-stream']);
    }

    public function previewDocument($documentId)
    {
        $doc = LetterDocument::findOrFail($documentId);
        $path = $this->documentPath($doc);
        if (!$path || !is_file($path)) {
            abort(404, 'File surat tidak ditemukan.');
        }

        $mime = strtolower((string) ($doc->mime_type ?: 'application/octet-stream'));

        // PDF dan gambar ditampilkan langsung oleh browser.
        if (!in_array($mime, self::OFFICE_MIMES, true)) {
            return response()->file($path, [
                'Content-Type' => $mime,
                'Content-Disposition' => 'inline; filename="' . addslashes(basename($doc->file_name)) . '"',
            ]);
        }

        // Word/Excel: konversi sekali ke PDF memakai LibreOffice lalu tampilkan inline.
        $previewDir = storage_path('app/letter-previews');
        if (!is_dir($previewDir)) {
            mkdir($previewDir, 0755, true);
        }
        $previewPath = $previewDir . '/letter-' . $doc->id . '.pdf';

        if (!is_file($previewPath) || filemtime($previewPath) < filemtime($path)) {
            $soffice = $this->findOfficeBinary();
            if (!$soffice) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Preview Word/Excel membutuhkan LibreOffice (soffice). File asli tetap dapat di-download.',
                ], 503);
            }

            $process = new Process([$soffice, '--headless', '--convert-to', 'pdf', '--outdir', $previewDir, $path]);
            $process->setTimeout(120);
            $process->run();

            $generated = $previewDir . '/' . pathinfo($path, PATHINFO_FILENAME) . '.pdf';
            if (!$process->isSuccessful() || !is_file($generated)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'File tidak dapat dikonversi menjadi PDF untuk preview.',
                    'detail' => trim($process->getErrorOutput() ?: $process->getOutput()),
                ], 422);
            }
            if ($generated !== $previewPath) {
                @rename($generated, $previewPath);
            }
        }

        return response()->file($previewPath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . addslashes(pathinfo($doc->file_name, PATHINFO_FILENAME) . '.pdf') . '"',
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* Pembantu                                                           */
    /* ------------------------------------------------------------------ */

    private function documentPath(LetterDocument $doc): ?string
    {
        // Hanya berkas di folder unggahan resmi (privat; folder lama bila belum dipindah);
        // path traversal ditolak oleh PrivateUploads.
        return PrivateUploads::resolve($doc->file_url);
    }

    private function findOfficeBinary(): ?string
    {
        $candidates = [
            env('LIBREOFFICE_PATH'),
            'soffice',
            'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
            'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
            '/usr/bin/soffice',
            '/usr/local/bin/soffice',
        ];
        foreach ($candidates as $candidate) {
            if (!$candidate) {
                continue;
            }
            if ($candidate === 'soffice') {
                return $candidate;
            }
            if (is_file($candidate) && is_executable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function typeAllowed(array $settings, string $type): bool
    {
        return collect($settings['letter_types'])->pluck('code')->map(fn ($x) => strtoupper($x))->contains($type);
    }

    /** Tahun kunci counter: 0 bila nomor tidak di-reset tiap tahun. */
    private function counterYear(array $settings, int $year): int
    {
        return ($settings['reset_mode'] ?? 'yearly') === 'never' ? 0 : $year;
    }

    private function settingsArray(): array
    {
        $store = Datastore::where('store_key', self::STORE_KEY)->first();
        $saved = $store?->json_data;
        if (is_string($saved)) {
            $saved = json_decode($saved, true);
        }

        return (is_array($saved) ? $saved : []) + [
            'company_code' => 'APV',
            'format' => '{NO}/{COMPANY}/{TYPE}/{MONTH}/{YEAR}',
            'digits' => 4,
            'month_format' => 'short',
            'reset_mode' => 'yearly',
            'letter_types' => [
                ['code' => 'SK', 'name' => 'Surat Keputusan'],
                ['code' => 'SPK', 'name' => 'Surat Perjanjian Kerja'],
                ['code' => 'PKS', 'name' => 'Perjanjian Kerja Sama'],
                ['code' => 'SP', 'name' => 'Surat Pernyataan'],
                ['code' => 'SKK', 'name' => 'Surat Keterangan'],
                ['code' => 'ST', 'name' => 'Surat Tugas'],
                ['code' => 'SPT', 'name' => 'Surat Perintah Tugas'],
                ['code' => 'BA', 'name' => 'Berita Acara'],
                ['code' => 'MEMO', 'name' => 'Memorandum Internal'],
                ['code' => 'UND', 'name' => 'Surat Undangan'],
                ['code' => 'INV', 'name' => 'Invoice'],
                ['code' => 'KW', 'name' => 'Kwitansi'],
                ['code' => 'SR', 'name' => 'Surat Referensi'],
                ['code' => 'LAIN', 'name' => 'Dokumen Lainnya'],
            ],
        ];
    }

    private function formatNumber(int $seq, string $company, string $type, $date, array $s): string
    {
        $no = str_pad((string) $seq, max(1, (int) $s['digits']), '0', STR_PAD_LEFT);
        $short = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
        $long = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
        $month = match ($s['month_format'] ?? 'short') {
            'numeric' => str_pad((string) $date->month, 2, '0', STR_PAD_LEFT),
            'long' => $long[$date->month - 1],
            default => $short[$date->month - 1],
        };

        return strtr((string) $s['format'], [
            '{NO}' => $no, '{COMPANY}' => $company, '{TYPE}' => $type, '{MONTH}' => $month, '{YEAR}' => $date->year,
        ]);
    }
}
