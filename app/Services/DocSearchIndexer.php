<?php
// @2026-Alifiandra

namespace App\Services;

use App\Models\Datastore;
use App\Models\LetterDocument;
use App\Models\RegulatoryChunk;
use App\Models\RegulatoryDocument;
use App\Models\SearchChunk;
use App\Models\SearchFile;
use App\Support\PrivateUploads;
use App\Support\RegulatoryExtractor;
use App\Support\RegulatoryIndex;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

/**
 * Pengindeks Pencarian Dokumen (tanpa AI).
 *
 * - Sumber: Penyimpanan Berkas (datastore mc_documents) dan arsip Nomor Surat (mc_letter_documents).
 *   Sumber Regulasi sudah punya indeks sendiri; di sini hanya dibantu OCR untuk dokumen hasil pindai.
 * - Teks dibaca di server: txt/csv/html, docx, xlsx, pptx, PDF (pdftotext).
 * - OCR (Tesseract) HANYA dipakai bila terpasang di server, berjalan di latar belakang dengan prioritas
 *   rendah, maksimal OCR_MAX_PAGES halaman per berkas dan dibatasi waktu per putaran, agar tidak membebani.
 */
class DocSearchIndexer
{
    public const OCR_MAX_PAGES = 15;
    public const OCR_TIMEOUT = 180;
    public const TEXT_EXT = ['txt', 'csv', 'json', 'xml', 'html', 'docx', 'xlsx', 'pptx', 'pdf', 'jpg', 'jpeg', 'png'];
    private const STAT_KEY = 'doc_search_last_run';

    private static ?array $tools = null;

    /** Program pembantu yang tersedia di server. */
    public static function tools(): array
    {
        if (self::$tools !== null) {
            return self::$tools;
        }
        return self::$tools = Cache::remember('doc_search_tools', 600, function () {
            $has = function (string $bin): bool {
                try {
                    $p = stripos(PHP_OS_FAMILY, 'Windows') === 0 ? new Process(['where', $bin]) : new Process(['sh', '-c', 'command -v ' . escapeshellarg($bin)]);
                    $p->setTimeout(5);
                    $p->run();
                    return $p->isSuccessful() && trim($p->getOutput()) !== '';
                } catch (\Throwable $e) {
                    return false;
                }
            };
            $tess = $has('tesseract');
            $langs = 'eng';
            if ($tess) {
                try {
                    $p = new Process(['tesseract', '--list-langs']);
                    $p->setTimeout(10);
                    $p->run();
                    $out = $p->getOutput() . $p->getErrorOutput();
                    $langs = preg_match('/^ind$/m', $out) ? 'ind+eng' : 'eng';
                } catch (\Throwable $e) {
                }
            }
            return ['pdftotext' => $has('pdftotext'), 'pdftoppm' => $has('pdftoppm'), 'tesseract' => $tess, 'ocr_langs' => $langs];
        });
    }

    /** Lupakan hasil deteksi program (mis. setelah menginstal Tesseract). */
    public static function refreshTools(): void
    {
        self::$tools = null;
        Cache::forget('doc_search_tools');
    }

    public static function ocrReady(): bool
    {
        $t = self::tools();
        return $t['tesseract'];
    }

    /**
     * Satu putaran pengindeksan, dibatasi waktu.
     * @return array{synced:int,indexed:int,ocr:int,removed:int,pending:int,seconds:float}
     */
    public function run(int $budgetSeconds = 50, bool $full = false): array
    {
        $start = microtime(true);
        $stats = ['synced' => 0, 'indexed' => 0, 'ocr' => 0, 'removed' => 0, 'pending' => 0, 'seconds' => 0.0];
        if (!Schema::hasTable('mc_search_files')) {
            return $stats;
        }
        [$stats['synced'], $stats['removed']] = $this->syncSources($full);

        $changed = $stats['removed'] > 0;
        $left = fn () => $budgetSeconds - (microtime(true) - $start);

        // 1) Berkas baru / berubah: baca teks (cepat dulu, OCR belakangan).
        foreach (SearchFile::where('status', 'pending')->orderBy('id')->cursor() as $file) {
            if ($left() < 5) {
                break;
            }
            $this->indexFile($file, false);
            $stats['indexed']++;
            $changed = true;
        }
        // 2) OCR untuk hasil pindai (hanya bila Tesseract terpasang), satu per satu sampai waktu habis.
        if (self::ocrReady()) {
            foreach (SearchFile::where('status', 'needs_ocr')->orderBy('id')->cursor() as $file) {
                if ($left() < 20) {
                    break;
                }
                $this->indexFile($file, true);
                $stats['ocr']++;
                $changed = true;
            }
            if ($left() >= 20) {
                $stats['ocr'] += $this->ocrRegulatory($left);
            }
        }
        if ($changed || $full) {
            $this->rebuildVocabulary();
        }
        $stats['pending'] = SearchFile::whereIn('status', self::ocrReady() ? ['pending', 'needs_ocr'] : ['pending'])->count();
        $stats['seconds'] = round(microtime(true) - $start, 1);
        Cache::put(self::STAT_KEY, ['at' => now()->toIso8601String()] + $stats, now()->addDays(30));
        return $stats;
    }

    public static function lastRun(): ?array
    {
        return Cache::get(self::STAT_KEY);
    }

    /* ------------------------------------------------------------------ sumber */

    /** Selaraskan daftar berkas dari Penyimpanan Berkas & arsip Nomor Surat. @return array{0:int,1:int} */
    private function syncSources(bool $full): array
    {
        $seen = ['berkas' => [], 'surat' => []];
        $count = 0;

        // Penyimpanan Berkas (metadata di datastore mc_documents)
        $docs = $this->datastoreArray('mc_documents');
        $folders = $this->folderNames();
        foreach ($docs as $d) {
            if (!is_array($d) || empty($d['id']) || empty($d['url'])) {
                continue;
            }
            $key = mb_substr((string) $d['id'], 0, 120);
            $seen['berkas'][$key] = true;
            $date = $this->ymd($d['uploaded_at'] ?? null);
            $this->upsert('berkas', $key, [
                'title' => mb_substr((string) ($d['name'] ?? 'Berkas'), 0, 255),
                'subtitle' => mb_substr('Penyimpanan Berkas › ' . ($folders[$d['folderId'] ?? ''] ?? 'Folder'), 0, 255),
                'file_url' => mb_substr((string) $d['url'], 0, 500),
                'doc_date' => $date,
                'meta' => array_filter([
                    'notes' => $d['notes'] ?? null, 'expires' => $d['expires'] ?? null,
                    'uploaded_by' => $d['uploaded_by'] ?? null, 'folder_id' => $d['folderId'] ?? null,
                ], fn ($v) => $v !== null && $v !== ''),
            ], $full);
            $count++;
        }

        // Arsip Nomor Surat
        if (Schema::hasTable('mc_letter_documents')) {
            foreach (LetterDocument::with('letter')->orderBy('id')->cursor() as $doc) {
                $key = (string) $doc->id;
                $seen['surat'][$key] = true;
                $letter = $doc->letter;
                $this->upsert('surat', $key, [
                    'title' => mb_substr((string) ($doc->file_name ?: 'Dokumen surat'), 0, 255),
                    'subtitle' => mb_substr(trim('Nomor Surat › ' . ($letter?->letter_number ?? '-') . ($letter?->subject ? ' · ' . $letter->subject : '')), 0, 255),
                    'file_url' => mb_substr((string) $doc->file_url, 0, 500),
                    'doc_date' => $letter?->letter_date?->format('Y-m-d') ?? $doc->created_at?->format('Y-m-d'),
                    'meta' => array_filter([
                        'letter_number' => $letter?->letter_number, 'subject' => $letter?->subject,
                        'letter_type' => $letter?->letter_type, 'description' => $doc->description,
                    ], fn ($v) => $v !== null && $v !== ''),
                ], $full);
                $count++;
            }
        }

        // Hapus indeks berkas yang sudah tidak ada di sumbernya
        $removed = 0;
        foreach (SearchFile::select('id', 'source', 'source_key')->cursor() as $f) {
            if (!isset($seen[$f->source][$f->source_key])) {
                SearchChunk::where('file_id', $f->id)->delete();
                SearchFile::whereKey($f->id)->delete();
                $removed++;
            }
        }
        return [$count, $removed];
    }

    private function upsert(string $source, string $key, array $data, bool $full): void
    {
        $path = PrivateUploads::resolve($data['file_url']);
        $ext = strtolower(pathinfo((string) parse_url($data['file_url'], PHP_URL_PATH), PATHINFO_EXTENSION));
        $sig = $path ? sha1(filesize($path) . '|' . filemtime($path)) : 'missing';
        $data['extension'] = mb_substr($ext, 0, 12);
        $data['size_bytes'] = $path ? (int) filesize($path) : 0;

        $file = SearchFile::where('source', $source)->where('source_key', $key)->first();
        if (!$file) {
            SearchFile::create($data + ['source' => $source, 'source_key' => $key, 'file_sig' => $sig, 'status' => 'pending']);
            return;
        }
        $file->fill($data);
        if ($full || $file->file_sig !== $sig) {
            $file->file_sig = $sig;
            $file->status = 'pending';
        }
        if ($file->isDirty()) {
            $file->save();
        }
    }

    /* ------------------------------------------------------------------ baca teks */

    private function indexFile(SearchFile $file, bool $allowOcr): void
    {
        $path = PrivateUploads::resolve($file->file_url);
        if (!$path) {
            $this->finish($file, 'missing', null, 'Berkas fisik tidak ditemukan di server.');
            return;
        }
        $ext = strtolower((string) $file->extension);
        if (!in_array($ext, self::TEXT_EXT, true)) {
            $this->finish($file, 'unsupported', null, 'Format .' . $ext . ' belum bisa dibaca. Simpan sebagai PDF, Word (.docx) atau Excel (.xlsx).');
            return;
        }
        [$text, $method, $error] = $this->extract($path, $ext, $allowOcr);
        if ($text === null) {
            $this->finish($file, $error === 'needs_ocr' ? 'needs_ocr' : 'empty', null,
                $error === 'needs_ocr' ? 'Berkas hasil pindai/foto: perlu OCR untuk dibaca.' : ($error ?: 'Tidak ada teks yang bisa dibaca.'));
            return;
        }
        $chunks = RegulatoryIndex::chunk($text);
        DB::transaction(function () use ($file, $chunks) {
            SearchChunk::where('file_id', $file->id)->delete();
            foreach (array_chunk($chunks, 200, true) as $batch) {
                $rows = [];
                foreach ($batch as $i => [$ref, $content]) {
                    $rows[] = ['file_id' => $file->id, 'position' => $i, 'ref' => $ref ? mb_substr($ref, 0, 120) : null, 'content' => $content];
                }
                SearchChunk::insert($rows);
            }
        });
        $file->forceFill(['status' => 'ready', 'method' => $method, 'error' => null, 'chunk_count' => count($chunks), 'indexed_at' => now()])->save();
    }

    private function finish(SearchFile $file, string $status, ?string $method, ?string $error): void
    {
        SearchChunk::where('file_id', $file->id)->delete();
        $file->forceFill(['status' => $status, 'method' => $method, 'error' => $error ? mb_substr($error, 0, 500) : null, 'chunk_count' => 0, 'indexed_at' => now()])->save();
    }

    /** @return array{0:?string,1:?string,2:?string} [teks, metode, galat] */
    private function extract(string $path, string $ext, bool $allowOcr): array
    {
        if ($ext === 'pdf') {
            $t = self::tools();
            if ($t['pdftotext']) {
                $txt = $this->runText(['pdftotext', '-layout', '-enc', 'UTF-8', '-l', '400', $path, '-'], 90);
                if ($txt !== null && mb_strlen(trim($txt)) > 80) {
                    return [$this->clean($txt), 'pdftotext', null];
                }
            } elseif (!$allowOcr && !self::ocrReady()) {
                return [null, null, 'Program pdftotext belum terpasang di server (paket poppler-utils).'];
            }
            if (!$allowOcr) {
                return [null, null, 'needs_ocr'];
            }
            $txt = $this->ocrPdf($path);
            return $txt ? [$txt, 'ocr', null] : [null, null, 'OCR tidak menemukan teks pada PDF ini.'];
        }
        if (in_array($ext, ['jpg', 'jpeg', 'png'], true)) {
            if (!$allowOcr) {
                return [null, null, 'needs_ocr'];
            }
            $txt = $this->ocrImage($path);
            return $txt ? [$txt, 'ocr', null] : [null, null, 'OCR tidak menemukan teks pada gambar ini.'];
        }
        $r = RegulatoryExtractor::extract($path, $ext, '', []);
        return $r['text'] !== '' ? [$r['text'], 'teks', null] : [null, null, $r['error'] ?: 'Tidak ada teks.'];
    }

    private function clean(string $txt): ?string
    {
        if (!mb_check_encoding($txt, 'UTF-8')) {
            $txt = mb_convert_encoding($txt, 'UTF-8', 'Windows-1252');
        }
        $txt = RegulatoryExtractor::clean($txt);
        return mb_strlen($txt) >= 40 ? mb_substr($txt, 0, RegulatoryExtractor::MAX_CHARS) : null;
    }

    private function runText(array $cmd, int $timeout): ?string
    {
        try {
            if (stripos(PHP_OS_FAMILY, 'Windows') !== 0) {
                $cmd = array_merge(['nice', '-n', '15'], $cmd); // prioritas rendah: aplikasi tetap lancar
            }
            $p = new Process($cmd);
            $p->setTimeout($timeout);
            $p->run();
            return $p->isSuccessful() ? $p->getOutput() : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function ocrImage(string $path): ?string
    {
        $out = $this->runText(['tesseract', $path, 'stdout', '-l', self::tools()['ocr_langs'], '--psm', '3'], self::OCR_TIMEOUT);
        return $out === null ? null : $this->clean($out);
    }

    private function ocrPdf(string $path): ?string
    {
        if (!self::tools()['pdftoppm']) {
            return null;
        }
        $dir = storage_path('app/ocr-tmp/' . uniqid('o', true));
        @mkdir($dir, 0775, true);
        try {
            $this->runText(['pdftoppm', '-r', '150', '-gray', '-png', '-l', (string) self::OCR_MAX_PAGES, $path, $dir . '/p'], self::OCR_TIMEOUT);
            $pages = glob($dir . '/p*.png') ?: [];
            natsort($pages);
            $text = '';
            $start = microtime(true);
            foreach ($pages as $i => $png) {
                if (microtime(true) - $start > self::OCR_TIMEOUT) {
                    break;
                }
                $t = $this->runText(['tesseract', $png, 'stdout', '-l', self::tools()['ocr_langs'], '--psm', '3'], 60);
                if ($t !== null && trim($t) !== '') {
                    $text .= "\nHalaman " . ($i + 1) . "\n" . $t;
                }
            }
            return $this->clean($text);
        } finally {
            foreach (glob($dir . '/*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($dir);
        }
    }

    /** OCR untuk Sumber Regulasi yang berstatus "perlu teks" (hasil pindai), satu per satu. */
    private function ocrRegulatory(callable $left): int
    {
        if (!Schema::hasTable('mc_regulatory_documents')) {
            return 0;
        }
        $n = 0;
        $docs = RegulatoryDocument::where('status', 'needs_text')->whereIn('extension', ['pdf', 'jpg', 'jpeg', 'png'])->orderBy('id')->get();
        foreach ($docs as $doc) {
            $meta = (array) ($doc->source_metadata ?? []);
            if (!empty($meta['ocr_tried']) || $left() < 20) {
                continue;
            }
            $meta['ocr_tried'] = now()->toIso8601String();
            $path = $doc->storage_path && Storage::disk('local')->exists($doc->storage_path) ? Storage::disk('local')->path($doc->storage_path) : null;
            $text = $path ? ($doc->extension === 'pdf' ? $this->ocrPdf($path) : $this->ocrImage($path)) : null;
            if ($text) {
                $count = RegulatoryIndex::reindex($doc, $text);
                $doc->forceFill(['status' => 'ready', 'processing_error' => null, 'extracted_text' => $text, 'chunk_count' => $count,
                    'extracted_at' => now(), 'source_metadata' => $meta + ['ocr' => 'tesseract']])->save();
            } else {
                $doc->forceFill(['source_metadata' => $meta])->save();
            }
            $n++;
        }
        return $n;
    }

    /* ------------------------------------------------------------------ kosakata (koreksi salah ketik) */

    public function rebuildVocabulary(): void
    {
        $df = [];
        $collect = function ($rows) use (&$df) {
            foreach ($rows as $row) {
                preg_match_all('/\p{L}{4,30}/u', mb_strtolower((string) $row->content), $m);
                foreach (array_unique($m[0]) as $w) {
                    $df[$w] = ($df[$w] ?? 0) + 1;
                }
            }
        };
        SearchChunk::select('id', 'content')->chunkById(400, $collect);
        if (Schema::hasTable('mc_regulatory_chunks')) {
            RegulatoryChunk::select('id', 'content')->chunkById(400, $collect);
        }
        arsort($df);
        $df = array_slice($df, 0, 60000, true);
        DB::transaction(function () use ($df) {
            DB::table('mc_search_terms')->delete();
            foreach (array_chunk($df, 1000, true) as $batch) {
                $rows = [];
                foreach ($batch as $term => $n) {
                    $rows[] = ['term' => mb_substr($term, 0, 40), 'df' => $n];
                }
                DB::table('mc_search_terms')->insertOrIgnore($rows);
            }
        });
    }

    /* ------------------------------------------------------------------ util */

    private function datastoreArray(string $key): array
    {
        try {
            $row = Datastore::query()->find($key);
            $v = $row ? $row->json_data : null;
            if (is_string($v)) {
                $v = json_decode($v, true);
            }
            return is_array($v) ? array_values($v) : [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    /** id folder -> nama (folder bawaan + folder buatan pengguna). */
    private function folderNames(): array
    {
        $row = Datastore::query()->find('mc_profile');
        $p = $row ? $row->json_data : null;
        if (is_string($p)) {
            $p = json_decode($p, true);
        }
        $company = is_array($p) && !empty($p['name']) ? (string) $p['name'] : 'Perusahaan';
        $map = ['default-perizinan' => 'Perizinan', 'default-sewa-gedung' => 'Sewa Gedung', 'default-pt' => $company,
            'default-pks' => 'PKS', 'default-banner' => 'Banner', 'default-kartu-nama' => 'Kartu Nama'];
        foreach ($this->datastoreArray('mc_document_folders') as $f) {
            if (is_array($f) && !empty($f['id'])) {
                $map[(string) $f['id']] = (string) ($f['name'] ?? 'Folder');
            }
        }
        return $map;
    }

    private function ymd($v): ?string
    {
        if (!$v) {
            return null;
        }
        try {
            return \Carbon\Carbon::parse((string) $v)->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }
}
