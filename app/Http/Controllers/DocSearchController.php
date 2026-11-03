<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\SearchFile;
use App\Services\DocSearchEngine;
use App\Services\DocSearchIndexer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/** Pencarian Dokumen tanpa AI. Akses per jabatan diatur di routes/api.php. */
class DocSearchController extends Controller
{
    public function search(Request $request, DocSearchEngine $engine): JsonResponse
    {
        $v = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:300'],
            'sources' => ['nullable', 'array'],
            'sources.*' => ['string', 'in:regulasi,berkas,surat'],
            'year' => ['nullable', 'integer', 'min:1990', 'max:2100'],
            'only_valid' => ['nullable', 'boolean'],
        ]);
        @set_time_limit(60);
        return response()->json($engine->search(trim($v['q']), [
            'sources' => $v['sources'] ?? DocSearchEngine::SOURCES,
            'year' => $v['year'] ?? null,
            'only_valid' => (bool) ($v['only_valid'] ?? false),
        ]));
    }

    public function status(): JsonResponse
    {
        $files = [];
        $problems = [];
        if (Schema::hasTable('mc_search_files')) {
            foreach (SearchFile::selectRaw('source, status, COUNT(*) as n')->groupBy('source', 'status')->get() as $r) {
                $files[$r->source][$r->status] = (int) $r->n;
            }
            $problems = SearchFile::whereNotIn('status', ['ready', 'pending'])->orderByDesc('updated_at')->limit(50)
                ->get(['id', 'source', 'title', 'subtitle', 'status', 'error'])->toArray();
        }
        $reg = [];
        if (Schema::hasTable('mc_regulatory_documents')) {
            foreach (\App\Models\RegulatoryDocument::selectRaw('status, COUNT(*) as n')->groupBy('status')->get() as $r) {
                $reg[$r->status] = (int) $r->n;
            }
        }
        return response()->json([
            'status' => 'success',
            'ready' => Schema::hasTable('mc_search_files'),
            'files' => $files,
            'regulasi' => $reg,
            'problems' => $problems,
            'tools' => DocSearchIndexer::tools(),
            'last_run' => DocSearchIndexer::lastRun(),
        ]);
    }

    public function reindex(Request $request, DocSearchIndexer $indexer): JsonResponse
    {
        @set_time_limit(90);
        DocSearchIndexer::refreshTools();
        $stats = $indexer->run(35, $request->boolean('full'));
        return response()->json(['status' => 'success', 'stats' => $stats,
            'message' => $stats['pending'] > 0
                ? 'Sebagian berkas sudah diindeks; sisanya (' . $stats['pending'] . ') diproses otomatis di latar belakang.'
                : 'Indeks sudah terbaru.']);
    }
}
