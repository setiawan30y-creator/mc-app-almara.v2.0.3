<?php
// @2026-Alifiandra

namespace App\Http\Controllers;

use App\Models\RegulatoryDocument;
use App\Support\RegulatoryAi;
use App\Support\RegulatoryIndex;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Tanya-jawab regulasi: jawaban hanya dari sumber yang tersimpan, disertai kutipan. */
class RegulatoryChatController extends Controller
{
    private const SYSTEM = <<<'TXT'
Anda adalah asisten kepatuhan untuk penyelenggara usaha penukaran valuta asing (KUPVA / money changer) di Indonesia, dengan fokus regulasi Bank Indonesia dan PPATK.

ATURAN WAJIB:
1. Jawab HANYA berdasarkan kutipan sumber [S1], [S2], dst. yang diberikan. Jangan memakai pengetahuan di luar kutipan untuk menyebut pasal, angka, ambang, atau sanksi.
2. Setiap pernyataan penting diakhiri rujukan sumber, contoh: "... wajib dilaporkan [S2]". Sebut nomor pasal hanya jika tertulis di kutipan.
3. Jika kutipan tidak memuat jawaban, katakan terus terang bahwa informasinya tidak ditemukan pada sumber yang tersimpan dan sarankan sumber apa yang perlu ditambahkan. Jangan menebak.
4. Perhatikan status sumber: jika ada yang berstatus "dicabut" atau "diubah", sebutkan. Jika dua sumber bertentangan, utamakan yang tanggal berlakunya lebih baru dan jelaskan perbedaannya.
5. Bahasa Indonesia, jelas dan ringkas. Gunakan poin bila ada beberapa kewajiban. Gunakan **tebal** untuk istilah atau angka kunci.
6. Setelah jawaban, tambahkan satu baris "SARAN:" lalu tepat 3 pertanyaan lanjutan pendek (satu per baris, diawali "- ").
TXT;

    public function ask(Request $request): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string', 'min:3', 'max:2000'],
            'history' => ['nullable', 'array', 'max:12'],
            'history.*.role' => ['required_with:history', 'in:user,assistant'],
            'history.*.text' => ['required_with:history', 'string', 'max:6000'],
            'document_ids' => ['nullable', 'array', 'max:50'],
            'document_ids.*' => ['integer'],
            'issuer' => ['nullable', 'in:' . implode(',', RegulatoryDocumentController::ISSUERS)],
        ]);
        @set_time_limit(120);

        $ready = RegulatoryDocument::where('status', 'ready')->count();
        if ($ready === 0) {
            return response()->json([
                'status' => 'no_sources', 'reply' => '', 'sources' => [], 'suggestions' => [],
                'message' => 'Belum ada sumber regulasi yang siap. Tambahkan dokumen di menu Sumber Regulasi terlebih dahulu.',
            ]);
        }

        $history = array_slice($data['history'] ?? [], -6);
        $question = trim($data['question']);
        // Pertanyaan lanjutan pendek ("bagaimana sanksinya?") dicari bersama konteks pertanyaan sebelumnya.
        $searchText = $question;
        if (mb_strlen($question) < 60) {
            foreach (array_reverse($history) as $h) {
                if ($h['role'] === 'user') {
                    $searchText = $h['text'] . ' ' . $question;
                    break;
                }
            }
        }

        $passages = RegulatoryIndex::search($searchText, $data['document_ids'] ?? [], $data['issuer'] ?? null, 8);
        if (!$passages) {
            return response()->json([
                'status' => 'no_match', 'reply' => '', 'sources' => [], 'suggestions' => [],
                'message' => 'Tidak ada bagian sumber yang cocok dengan pertanyaan ini. Coba kata kunci lain, ubah cakupan sumber, atau tambahkan regulasi yang relevan.',
            ]);
        }

        $sources = [];
        $context = '';
        foreach ($passages as $i => $p) {
            $label = 'S' . ($i + 1);
            $head = "[{$label}] {$p['title']}" . ($p['regulation_number'] ? " ({$p['regulation_number']})" : '')
                . ($p['issuer'] ? " | {$p['issuer']}" : '') . " | status: {$p['validity']}"
                . ($p['effective_date'] ? " | berlaku: {$p['effective_date']}" : '') . ($p['ref'] ? " | {$p['ref']}" : '');
            $context .= $head . "\n" . $p['content'] . "\n\n";
            $sources[] = [
                'label' => $label, 'document_id' => $p['document_id'], 'title' => $p['title'],
                'regulation_number' => $p['regulation_number'], 'issuer' => $p['issuer'], 'validity' => $p['validity'],
                'effective_date' => $p['effective_date'], 'ref' => $p['ref'],
                'snippet' => Str::limit(preg_replace('/\s+/u', ' ', $p['content']), 420),
                'text' => Str::limit($p['content'], 1500, ''),
            ];
        }

        $ai = RegulatoryAi::fromRequest($request);
        if (!RegulatoryAi::available($ai)) {
            return response()->json([
                'status' => 'search_only', 'reply' => '', 'sources' => $sources, 'suggestions' => [],
                'message' => 'API Key AI belum diatur, jadi ini hasil pencarian saja. Atur key di Pengaturan > Asisten AI agar AI menyusun jawaban.',
            ]);
        }

        $prompt = "KUTIPAN SUMBER:\n\n" . $context . "PERTANYAAN: " . $question;
        $r = RegulatoryAi::generate($ai, self::SYSTEM, $history, $prompt, 0.2);
        if (!$r['ok']) {
            return response()->json([
                'status' => 'ai_error', 'reply' => '', 'sources' => $sources, 'suggestions' => [], 'message' => $r['message'],
            ], 200);
        }

        $reply = $r['text'];
        $suggestions = [];
        if (preg_match('/\n\s*\**SARAN:?\**\s*\n?(.*)$/isu', $reply, $m, PREG_OFFSET_CAPTURE)) {
            foreach (preg_split('/\n/u', $m[1][0]) as $line) {
                $line = trim(preg_replace('/^[\-\*\d\.\)\s]+/u', '', $line));
                if ($line !== '' && count($suggestions) < 3) {
                    $suggestions[] = rtrim($line, " *");
                }
            }
            $reply = trim(substr($reply, 0, $m[0][1]));
        }

        // Hanya kirim sumber yang benar-benar dirujuk jawaban (bila ada rujukan); jika tidak ada, kirim semua.
        preg_match_all('/\[S(\d+)\]/', $reply, $refs);
        $used = array_unique(array_map('intval', $refs[1] ?? []));
        $shown = $used ? array_values(array_filter($sources, fn ($s) => in_array((int) substr($s['label'], 1), $used, true))) : $sources;

        return response()->json([
            'status' => 'ok', 'reply' => $reply, 'sources' => $shown, 'suggestions' => $suggestions,
            'model' => RegulatoryAi::label($ai), 'candidates' => count($sources),
        ]);
    }

    /** Status kesiapan untuk header halaman chat. */
    public function status(Request $request): JsonResponse
    {
        $ai = RegulatoryAi::fromRequest($request);
        return response()->json([
            'ai_ready' => RegulatoryAi::available($ai),
            'model' => RegulatoryAi::available($ai) ? RegulatoryAi::label($ai) : null,
            'sources_ready' => RegulatoryDocument::where('status', 'ready')->count(),
            'sources_total' => RegulatoryDocument::count(),
        ]);
    }
}
