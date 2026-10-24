<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\RegulatoryChunk;
use App\Models\RegulatoryDocument;
use App\Support\RegulatoryAi;
use App\Support\RegulatoryExtractor;
use App\Support\RegulatoryIndex;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RegulatoryDocumentController extends Controller
{
    public const ISSUERS = ['BI', 'PPATK', 'OJK', 'KEMENKEU', 'LAINNYA'];
    public const TYPES = ['UU', 'PP', 'PERPRES', 'PBI', 'PADG', 'SEBI', 'POJK', 'PERKA_PPATK', 'SE', 'PMK', 'KUMPULAN', 'LAINNYA'];
    public const VALIDITY = ['berlaku', 'diubah', 'dicabut'];

    private const LIST_COLUMNS = [
        'id', 'title', 'issuer', 'doc_type', 'original_name', 'extension', 'size_bytes', 'regulation_number',
        'effective_date', 'validity', 'source_url', 'notes', 'status', 'chunk_count', 'extracted_at',
        'processing_error', 'created_at', 'updated_at',
    ];

    public function index(Request $request): JsonResponse
    {
        $q = RegulatoryDocument::query()
            ->select(self::LIST_COLUMNS)
            ->addSelect(DB::raw('CHAR_LENGTH(extracted_text) as text_length'))
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = trim((string) $request->input('q'));
                $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $term) . '%';
                $query->where(function ($sub) use ($like) {
                    $sub->where('title', 'like', $like)
                        ->orWhere('original_name', 'like', $like)
                        ->orWhere('regulation_number', 'like', $like)
                        ->orWhere('notes', 'like', $like);
                });
            })
            ->when($request->filled('issuer'), fn ($qq) => $qq->where('issuer', $request->input('issuer')))
            ->when($request->filled('status'), fn ($qq) => $qq->where('status', $request->input('status')))
            ->when($request->filled('validity'), fn ($qq) => $qq->where('validity', $request->input('validity')))
            ->orderByDesc('effective_date')
            ->orderByDesc('id');

        $page = $q->paginate(30);

        $stats = [
            'total' => RegulatoryDocument::count(),
            'ready' => RegulatoryDocument::where('status', 'ready')->count(),
            'attention' => RegulatoryDocument::whereIn('status', ['needs_text', 'error', 'pending'])->count(),
            'chunks' => (int) RegulatoryDocument::sum('chunk_count'),
            'by_issuer' => RegulatoryDocument::select('issuer', DB::raw('count(*) as n'))->groupBy('issuer')->pluck('n', 'issuer'),
            'latest' => RegulatoryDocument::max('updated_at'),
        ];

        return response()->json(array_merge($page->toArray(), ['stats' => $stats]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules(true));
        $hasFile = $request->hasFile('file');
        $content = isset($data['content']) ? RegulatoryExtractor::clean((string) $data['content']) : '';
        if (!$hasFile && $content === '' && empty($data['source_url'])) {
            return response()->json(['message' => 'Isi salah satu: unggah file, tempel teks, atau cantumkan tautan sumber.'], 422);
        }
        @set_time_limit(180);

        $path = '';
        $originalName = 'teks-tempel.txt';
        $extension = 'txt';
        $mime = 'text/plain';
        $size = strlen($content);
        $sha = $content !== '' ? hash('sha256', $content) : null;

        if ($hasFile) {
            $file = $request->file('file');
            $originalName = basename($file->getClientOriginalName());
            $extension = strtolower($file->getClientOriginalExtension());
            $path = (string) $file->storeAs('regulatory-documents', Str::uuid()->toString() . '.' . $extension, 'local');
            if ($path === '') {
                return response()->json(['message' => 'File gagal disimpan.'], 500);
            }
            $mime = (string) $file->getMimeType();
            $size = (int) $file->getSize();
            $sha = hash_file('sha256', $file->getRealPath());
        } elseif ($content === '') {
            $originalName = 'tautan-sumber';
            $extension = 'url';
            $mime = 'text/uri-list';
        }

        if ($sha && RegulatoryDocument::where('sha256', $sha)->exists() && $request->boolean('allow_duplicate') === false) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
            return response()->json(['message' => 'Dokumen yang sama persis sudah ada di perpustakaan.', 'duplicate' => true], 409);
        }

        try {
            $doc = RegulatoryDocument::create([
                'title' => $data['title'] ?? pathinfo($originalName, PATHINFO_FILENAME),
                'issuer' => $data['issuer'] ?? null,
                'doc_type' => $data['doc_type'] ?? null,
                'original_name' => $originalName,
                'storage_path' => $path,
                'mime_type' => $mime,
                'extension' => $extension,
                'size_bytes' => $size,
                'sha256' => $sha,
                'regulation_number' => $data['regulation_number'] ?? null,
                'effective_date' => $data['effective_date'] ?? null,
                'validity' => $data['validity'] ?? 'berlaku',
                'source_url' => $data['source_url'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => 'pending',
                'uploaded_by' => is_numeric($uid = $request->user()?->getAuthIdentifier()) ? (int) $uid : null,
                'source_metadata' => is_numeric($uid) ? null : ['uploaded_by' => (string) $uid],
            ]);
        } catch (\Throwable $e) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
            throw $e;
        }

        $this->ingest($doc, $content !== '' ? $content : null, $path ? Storage::disk('local')->path($path) : null, RegulatoryAi::fromRequest($request));

        return response()->json([
            'message' => $doc->status === 'ready'
                ? 'Sumber tersimpan dan siap ditanyakan (' . $doc->chunk_count . ' bagian terindeks).'
                : 'Sumber tersimpan, tetapi teks belum terbaca: ' . $doc->processing_error,
            'document' => $this->brief($doc),
        ], 201);
    }

    public function show(RegulatoryDocument $regulatoryDocument): JsonResponse
    {
        $d = $regulatoryDocument;
        $arr = $this->brief($d);
        $arr['text_preview'] = Str::limit((string) $d->extracted_text, 6000, '');
        $arr['text_length'] = mb_strlen((string) $d->extracted_text);
        $arr['sha256'] = $d->sha256;
        $arr['mime_type'] = $d->mime_type;
        $arr['summary'] = $d->source_metadata['summary'] ?? null;
        $arr['summary_at'] = $d->source_metadata['summary_at'] ?? null;
        $arr['has_file'] = (bool) $d->storage_path;
        return response()->json(['document' => $arr]);
    }

    public function update(Request $request, RegulatoryDocument $regulatoryDocument): JsonResponse
    {
        $data = $request->validate($this->rules(false));
        $doc = $regulatoryDocument;
        $doc->fill(collect($data)->except(['content', 'file'])->all());
        $doc->save();

        if (isset($data['content']) && trim((string) $data['content']) !== '') {
            $this->ingest($doc, RegulatoryExtractor::clean((string) $data['content']), null, RegulatoryAi::fromRequest($request));
        }

        return response()->json(['message' => 'Data sumber diperbarui.', 'document' => $this->brief($doc->fresh())]);
    }

    public function reindex(Request $request, RegulatoryDocument $regulatoryDocument): JsonResponse
    {
        @set_time_limit(180);
        $doc = $regulatoryDocument;
        $path = $doc->storage_path && Storage::disk('local')->exists($doc->storage_path) ? Storage::disk('local')->path($doc->storage_path) : null;
        $text = null;
        if (!$path && $doc->extracted_text) {
            $text = $doc->extracted_text;
        }
        if (!$path && !$text) {
            return response()->json(['message' => 'Tidak ada berkas atau teks untuk diproses ulang.'], 422);
        }
        $this->ingest($doc, $text, $path, RegulatoryAi::fromRequest($request));
        return response()->json([
            'message' => $doc->status === 'ready' ? 'Teks berhasil dibaca ulang (' . $doc->chunk_count . ' bagian).' : 'Belum berhasil: ' . $doc->processing_error,
            'document' => $this->brief($doc),
        ]);
    }

    public function summarize(Request $request, RegulatoryDocument $regulatoryDocument): JsonResponse
    {
        @set_time_limit(120);
        $doc = $regulatoryDocument;
        if ($doc->status !== 'ready' || !$doc->extracted_text) {
            return response()->json(['message' => 'Dokumen belum memiliki teks yang dapat diringkas.'], 422);
        }
        $ai = RegulatoryAi::fromRequest($request);
        $system = 'Anda analis kepatuhan untuk penyelenggara usaha penukaran valuta asing (KUPVA) di Indonesia. Ringkas dokumen regulasi HANYA dari teks yang diberikan. Jangan menambah pasal atau angka yang tidak ada di teks. Bahasa Indonesia, ringkas, memakai poin.';
        $user = "Buat ringkasan terstruktur dengan judul tebal: **Tujuan**, **Pihak yang diatur**, **Kewajiban utama** (poin, sebut pasal bila ada), **Angka/ambang/tenggat penting**, **Sanksi** (jika disebut), **Catatan untuk money changer**.\n\nDokumen: {$doc->title} {$doc->regulation_number}\n\n" . Str::limit($doc->extracted_text, 32000, "\n[...dipotong]");
        $r = RegulatoryAi::generate($ai, $system, [], $user, 0.2);
        if (!$r['ok']) {
            return response()->json(['message' => $r['message']], 422);
        }
        $meta = $doc->source_metadata ?? [];
        $meta['summary'] = $r['text'];
        $meta['summary_at'] = now()->toIso8601String();
        $meta['summary_by'] = RegulatoryAi::label($ai);
        $doc->source_metadata = $meta;
        $doc->save();
        return response()->json(['summary' => $r['text'], 'summary_at' => $meta['summary_at']]);
    }

    public function download(RegulatoryDocument $regulatoryDocument): StreamedResponse|JsonResponse
    {
        $doc = $regulatoryDocument;
        if (!$doc->storage_path || !Storage::disk('local')->exists($doc->storage_path)) {
            return response()->json(['message' => 'Berkas asli tidak tersedia (sumber berupa teks tempel atau tautan).'], 404);
        }
        return Storage::disk('local')->download($doc->storage_path, $doc->original_name);
    }

    public function destroy(RegulatoryDocument $regulatoryDocument): JsonResponse
    {
        if ($regulatoryDocument->storage_path) {
            Storage::disk('local')->delete($regulatoryDocument->storage_path);
        }
        RegulatoryChunk::where('document_id', $regulatoryDocument->id)->delete();
        $regulatoryDocument->delete();

        return response()->json(['message' => 'Sumber berhasil dihapus.']);
    }

    private function rules(bool $creating): array
    {
        return [
            'file' => ['nullable', 'file', 'max:20480', 'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,zip,xml,json,html'],
            'content' => ['nullable', 'string', 'max:1500000'],
            'title' => [$creating ? 'nullable' : 'sometimes', 'string', 'max:255'],
            'issuer' => ['nullable', Rule::in(self::ISSUERS)],
            'doc_type' => ['nullable', Rule::in(self::TYPES)],
            'regulation_number' => ['nullable', 'string', 'max:150'],
            'effective_date' => ['nullable', 'date'],
            'validity' => ['nullable', Rule::in(self::VALIDITY)],
            'source_url' => ['nullable', 'url', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function ingest(RegulatoryDocument $doc, ?string $text, ?string $absPath, array $ai): void
    {
        $error = null;
        if ($text === null && $absPath) {
            $r = RegulatoryExtractor::extract($absPath, (string) $doc->extension, (string) $doc->mime_type, $ai);
            $text = $r['text'];
            $error = $r['error'];
        } elseif ($text !== null && mb_strlen(trim($text)) < 40) {
            $error = 'Teks terlalu pendek untuk diindeks.';
        } elseif ($text === null) {
            $error = 'Sumber hanya berupa tautan. Tempel isi teksnya agar bisa ditanyakan ke AI.';
        }

        if ($error || $text === null || $text === '') {
            RegulatoryChunk::where('document_id', $doc->id)->delete();
            $doc->forceFill([
                'status' => 'needs_text', 'processing_error' => $error, 'chunk_count' => 0, 'extracted_text' => null, 'extracted_at' => null,
            ])->save();
            return;
        }

        $count = RegulatoryIndex::reindex($doc, $text);
        $doc->forceFill([
            'status' => 'ready', 'processing_error' => null, 'extracted_text' => $text, 'chunk_count' => $count, 'extracted_at' => now(),
        ])->save();
    }

    private function brief(RegulatoryDocument $d): array
    {
        return [
            'id' => $d->id, 'title' => $d->title, 'issuer' => $d->issuer, 'doc_type' => $d->doc_type,
            'original_name' => $d->original_name, 'extension' => $d->extension, 'size_bytes' => $d->size_bytes,
            'regulation_number' => $d->regulation_number,
            'effective_date' => $d->effective_date ? $d->effective_date->format('Y-m-d') : null,
            'validity' => $d->validity ?: 'berlaku', 'source_url' => $d->source_url, 'notes' => $d->notes,
            'status' => $d->status, 'chunk_count' => $d->chunk_count, 'processing_error' => $d->processing_error,
            'extracted_at' => optional($d->extracted_at)->toIso8601String(),
            'created_at' => optional($d->created_at)->toIso8601String(),
        ];
    }
}
