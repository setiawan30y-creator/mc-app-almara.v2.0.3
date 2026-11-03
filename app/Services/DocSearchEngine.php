<?php
// @2026-Alifiandra

namespace App\Services;

use App\Models\RegulatoryChunk;
use App\Models\SearchChunk;
use App\Support\IndoStemmer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Mesin Pencarian Dokumen tanpa AI.
 * Mencari di Sumber Regulasi, Penyimpanan Berkas, dan arsip Nomor Surat; memberi peringkat per bagian
 * (pasal / paragraf), lalu menyusun "ringkasan jawaban" dari kalimat asli yang paling relevan.
 * Tidak ada teks karangan: semua yang tampil adalah kutipan dari dokumen.
 */
class DocSearchEngine
{
    public const SOURCES = ['regulasi', 'berkas', 'surat'];
    public const LABELS = ['regulasi' => 'Sumber Regulasi', 'berkas' => 'Penyimpanan Berkas', 'surat' => 'Arsip Nomor Surat'];

    /**
     * @param array{sources?:string[],year?:?int,only_valid?:bool,limit?:int} $opt
     */
    public function search(string $q, array $opt = []): array
    {
        $t0 = microtime(true);
        $sources = array_values(array_intersect($opt['sources'] ?? self::SOURCES, self::SOURCES)) ?: self::SOURCES;
        $year = !empty($opt['year']) ? (int) $opt['year'] : null;
        $onlyValid = !empty($opt['only_valid']);
        $limit = max(3, min(30, (int) ($opt['limit'] ?? 12)));

        $parsed = IndoStemmer::query($q);
        $terms = $parsed['terms'];
        $corrections = $this->correctTypos($terms);
        if (!$terms) {
            return $this->empty($q, 'Ketik kata kunci yang lebih spesifik.', $t0);
        }

        // Kandidat: bagian yang memuat salah satu istilah (pakai istilah terpanjang dulu).
        $like = array_map(fn ($t) => $t['stem'], $terms);
        usort($like, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        $like = array_slice(array_values(array_filter($like, fn ($s) => mb_strlen($s) >= 3)), 0, 10);
        if (!$like) {
            $like = [$terms[0]['stem']];
        }

        $rows = [];
        if (in_array('regulasi', $sources, true) && Schema::hasTable('mc_regulatory_chunks')) {
            $rows = array_merge($rows, $this->regulatoryCandidates($like, $year, $onlyValid));
        }
        $fileSources = array_values(array_intersect($sources, ['berkas', 'surat']));
        if ($fileSources && Schema::hasTable('mc_search_chunks')) {
            $rows = array_merge($rows, $this->fileCandidates($like, $fileSources, $year));
        }
        if (!$rows) {
            return $this->empty($q, 'Tidak ada dokumen yang memuat kata kunci ini.', $t0, $corrections, $terms);
        }

        $scored = $this->score($rows, $terms, $parsed);
        if (!$scored) {
            return $this->empty($q, 'Tidak ada dokumen yang cocok.', $t0, $corrections, $terms);
        }

        // Maks. 3 bagian per dokumen agar hasil beragam.
        $perDoc = [];
        $results = [];
        foreach ($scored as $r) {
            $k = $r['source'] . ':' . $r['doc_id'];
            if (($perDoc[$k] = ($perDoc[$k] ?? 0) + 1) > 3) {
                continue;
            }
            $results[] = $r;
            if (count($results) >= $limit) {
                break;
            }
        }
        $max = $results[0]['score'] ?: 1;
        foreach ($results as $i => &$r) {
            $r['label'] = 'S' . ($i + 1);
            $r['relevance'] = (int) round(100 * $r['score'] / $max);
            $r['snippet'] = $this->snippet($r['content'], $r['_terms']);
            $r['text'] = mb_substr($r['content'], 0, 2500);
            unset($r['content'], $r['_terms'], $r['score']);
        }
        unset($r);

        return [
            'status' => 'ok',
            'query' => $q,
            'answer' => $this->answer($results, $scored, $terms, $parsed['numeric']),
            'results' => $results,
            'total_candidates' => count($scored),
            'highlight' => $this->highlightTerms($terms),
            'corrections' => $corrections,
            'took_ms' => (int) round((microtime(true) - $t0) * 1000),
        ];
    }

    /* ------------------------------------------------------------------ kandidat */

    private function regulatoryCandidates(array $like, ?int $year, bool $onlyValid): array
    {
        $q = RegulatoryChunk::query()
            ->join('mc_regulatory_documents as d', 'd.id', '=', 'mc_regulatory_chunks.document_id')
            ->where('d.status', 'ready')
            ->when($onlyValid, fn ($qq) => $qq->where(fn ($w) => $w->whereNull('d.validity')->orWhere('d.validity', '!=', 'dicabut')))
            ->when($year, fn ($qq) => $qq->whereYear('d.effective_date', $year))
            ->where(function ($w) use ($like) {
                foreach ($like as $t) {
                    $w->orWhere('mc_regulatory_chunks.content', 'like', '%' . $this->esc($t) . '%');
                }
            })
            ->select(['mc_regulatory_chunks.id', 'mc_regulatory_chunks.document_id', 'mc_regulatory_chunks.ref', 'mc_regulatory_chunks.content',
                'd.title', 'd.regulation_number', 'd.issuer', 'd.validity', 'd.effective_date', 'd.storage_path'])
            ->limit(800)->get();

        return $q->map(fn ($r) => [
            'source' => 'regulasi',
            'doc_id' => (int) $r->document_id,
            'title' => (string) $r->title,
            'subtitle' => trim(implode(' · ', array_filter([$r->issuer, $r->regulation_number, $r->effective_date ? 'berlaku ' . substr((string) $r->effective_date, 0, 10) : null]))),
            'ref' => $r->ref,
            'validity' => $r->validity,
            'date' => $r->effective_date ? substr((string) $r->effective_date, 0, 10) : null,
            'open_url' => $r->storage_path ? 'api/regulatory-documents/' . $r->document_id . '/download' : null,
            'content' => (string) $r->content,
        ])->all();
    }

    private function fileCandidates(array $like, array $sources, ?int $year): array
    {
        $q = SearchChunk::query()
            ->join('mc_search_files as f', 'f.id', '=', 'mc_search_chunks.file_id')
            ->where('f.status', 'ready')
            ->whereIn('f.source', $sources)
            ->when($year, fn ($qq) => $qq->whereYear('f.doc_date', $year))
            ->where(function ($w) use ($like) {
                foreach ($like as $t) {
                    $w->orWhere('mc_search_chunks.content', 'like', '%' . $this->esc($t) . '%');
                }
            })
            ->select(['mc_search_chunks.id', 'mc_search_chunks.file_id', 'mc_search_chunks.position', 'mc_search_chunks.ref', 'mc_search_chunks.content',
                'f.source', 'f.source_key', 'f.title', 'f.subtitle', 'f.file_url', 'f.doc_date', 'f.meta'])
            ->limit(800)->get();

        return $q->map(function ($r) {
            $meta = is_string($r->meta) ? (json_decode($r->meta, true) ?: []) : (array) $r->meta;
            return [
                'source' => (string) $r->source,
                'doc_id' => (int) $r->file_id,
                'title' => (string) $r->title,
                'subtitle' => (string) $r->subtitle,
                'ref' => $r->ref ?: 'Bagian ' . ((int) $r->position + 1),
                'validity' => null,
                'date' => $r->doc_date ? substr((string) $r->doc_date, 0, 10) : null,
                'expires' => $meta['expires'] ?? null,
                'open_url' => $r->source === 'surat' ? 'api/letter-numbers/documents/' . $r->source_key . '/download' : $r->file_url,
                'content' => (string) $r->content,
            ];
        })->all();
    }

    /* ------------------------------------------------------------------ peringkat */

    private function score(array $rows, array $terms, array $parsed): array
    {
        $n = count($rows);
        $df = [];
        foreach ($rows as $i => $r) {
            $rows[$i]['_lower'] = mb_strtolower($r['content']);
            foreach ($terms as $t) {
                if (str_contains($rows[$i]['_lower'], $t['stem'])) {
                    $df[$t['stem']] = ($df[$t['stem']] ?? 0) + 1;
                }
            }
        }
        $main = array_values(array_filter($terms, fn ($t) => !$t['syn']));
        $phrase = count($parsed['words']) >= 2 ? implode(' ', $parsed['words']) : null;

        $out = [];
        foreach ($rows as $r) {
            $c = $r['_lower'];
            $s = 0.0;
            $hitMain = 0;
            $hit = [];
            foreach ($terms as $t) {
                $cnt = substr_count($c, $t['stem']);
                if ($cnt === 0) {
                    continue;
                }
                $hit[] = $t['stem'];
                if (!$t['syn']) {
                    $hitMain++;
                }
                $idf = log(1 + $n / (1 + ($df[$t['stem']] ?? 0)));
                $len = 1 + min(mb_strlen($t['stem']), 12) / 12;
                $term = $t['weight'] * $idf * (1 + log(1 + $cnt)) * $len;
                if ($t['word'] !== $t['stem'] && preg_match('/(?<![\p{L}])' . preg_quote($t['word'], '/') . '(?![\p{L}])/u', $c)) {
                    $term *= 1.15; // bentuk kata persis
                }
                $s += $term;
            }
            if ($s <= 0) {
                continue;
            }
            $s *= 0.45 + 0.55 * ($hitMain / max(1, count($main)));
            if ($phrase && str_contains($c, $phrase)) {
                $s *= 1.6;
            } else {
                $w = $parsed['words'];
                for ($i = 0; $i + 1 < count($w); $i++) {
                    if (str_contains($c, $w[$i] . ' ' . $w[$i + 1])) {
                        $s *= 1.15;
                    }
                }
            }
            $title = mb_strtolower($r['title'] . ' ' . $r['subtitle'] . ' ' . ($r['ref'] ?? ''));
            foreach ($main as $t) {
                if (str_contains($title, $t['stem'])) {
                    $s *= 1.12;
                }
            }
            if (($r['validity'] ?? null) === 'dicabut') {
                $s *= 0.55;
            }
            if ($parsed['numeric'] && preg_match('/\d/', $c)) {
                $s *= 1.08;
            }
            unset($r['_lower']);
            $r['score'] = $s;
            $r['_terms'] = $hit;
            $out[] = $r;
        }
        usort($out, fn ($a, $b) => $b['score'] <=> $a['score']);
        return $out;
    }

    /* ------------------------------------------------------------------ ringkasan jawaban (ekstraktif) */

    private function answer(array $results, array $scored, array $terms, bool $numeric): array
    {
        $n = max(1, count($scored));
        $df = [];
        foreach ($scored as $r) {
            foreach ($r['_terms'] as $s) {
                $df[$s] = ($df[$s] ?? 0) + 1;
            }
        }
        $cands = [];
        foreach (array_slice($results, 0, 6) as $r) {
            $parts = preg_split('/(?<=[.;:?!])\s+|\n+/u', $r['text']) ?: [];
            foreach ($parts as $sent) {
                $sent = trim(preg_replace('/\s+/u', ' ', $sent));
                $len = mb_strlen($sent);
                if ($len < 35 || $len > 480) {
                    continue;
                }
                $low = mb_strtolower($sent);
                $score = 0.0;
                $hits = 0;
                foreach ($terms as $t) {
                    if (str_contains($low, $t['stem'])) {
                        $score += $t['weight'] * log(1 + $n / (1 + ($df[$t['stem']] ?? 0)));
                        $hits++;
                    }
                }
                if ($hits === 0) {
                    continue;
                }
                $score *= 0.4 + 0.6 * ($hits / max(1, count($terms)));
                if ($numeric && preg_match('/\d/', $sent)) {
                    $score *= 1.35;
                }
                $score *= 1 + (int) $r['relevance'] / 200; // bagian yang lebih relevan diutamakan
                $cands[] = ['text' => $sent, 'label' => $r['label'], 'title' => $r['title'], 'ref' => $r['ref'], 'score' => $score];
            }
        }
        usort($cands, fn ($a, $b) => $b['score'] <=> $a['score']);
        $out = [];
        $seen = [];
        $top = $cands ? $cands[0]['score'] : 0;
        foreach ($cands as $c) {
            if ($c['score'] < $top * 0.25) {
                break; // kalimat yang jauh kurang relevan tidak ikut ringkasan
            }
            $key = mb_substr(mb_strtolower($c['text']), 0, 80);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            unset($c['score']);
            $out[] = $c;
            if (count($out) >= 3) {
                break;
            }
        }
        return $out;
    }

    /* ------------------------------------------------------------------ salah ketik */

    /** Ganti istilah yang tidak ada di kosakata dengan kata terdekat. @return array<int,array{from:string,to:string}> */
    private function correctTypos(array &$terms): array
    {
        if (!Schema::hasTable('mc_search_terms') || !DB::table('mc_search_terms')->exists()) {
            return [];
        }
        $fixes = [];
        foreach ($terms as $i => $t) {
            $w = $t['word'];
            if ($t['syn'] || mb_strlen($w) < 4 || !preg_match('/^\p{L}+$/u', $w)) {
                continue;
            }
            $known = DB::table('mc_search_terms')->where('term', 'like', '%' . $this->esc($t['stem']) . '%')->exists();
            if ($known) {
                continue;
            }
            $len = mb_strlen($w);
            $maxDist = $len <= 5 ? 1 : 2;
            $cands = DB::table('mc_search_terms')
                ->where('term', 'like', $this->esc(mb_substr($w, 0, 1)) . '%')
                ->whereRaw('CHAR_LENGTH(term) BETWEEN ? AND ?', [$len - $maxDist, $len + $maxDist])
                ->orderByDesc('df')->limit(4000)->pluck('df', 'term');
            $best = null;
            $bestD = 99;
            $bestDf = -1;
            foreach ($cands as $cand => $cdf) {
                $d = levenshtein($w, (string) $cand);
                if ($d <= $maxDist && ($d < $bestD || ($d === $bestD && $cdf > $bestDf))) {
                    [$best, $bestD, $bestDf] = [(string) $cand, $d, (int) $cdf];
                }
            }
            if ($best !== null) {
                $terms[$i]['word'] = $best;
                $terms[$i]['stem'] = IndoStemmer::stem($best);
                $fixes[] = ['from' => $w, 'to' => $best];
            }
        }
        return $fixes;
    }

    /* ------------------------------------------------------------------ util */

    private function snippet(string $text, array $hits): string
    {
        $flat = trim(preg_replace('/\s+/u', ' ', $text));
        $low = mb_strtolower($flat);
        $pos = null;
        usort($hits, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        foreach ($hits as $h) {
            $p = mb_strpos($low, $h);
            if ($p !== false) {
                $pos = $p;
                break;
            }
        }
        if ($pos === null || mb_strlen($flat) <= 360) {
            return mb_substr($flat, 0, 360) . (mb_strlen($flat) > 360 ? '…' : '');
        }
        $start = max(0, $pos - 120);
        return ($start > 0 ? '…' : '') . mb_substr($flat, $start, 360) . ($start + 360 < mb_strlen($flat) ? '…' : '');
    }

    private function highlightTerms(array $terms): array
    {
        $out = [];
        foreach ($terms as $t) {
            if (mb_strlen($t['stem']) >= 3) {
                $out[] = $t['stem'];
            }
        }
        return array_values(array_unique($out));
    }

    private function esc(string $s): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $s);
    }

    private function empty(string $q, string $msg, float $t0, array $corrections = [], array $terms = []): array
    {
        return ['status' => 'no_match', 'query' => $q, 'message' => $msg, 'answer' => [], 'results' => [], 'total_candidates' => 0,
            'highlight' => $this->highlightTerms($terms), 'corrections' => $corrections, 'took_ms' => (int) round((microtime(true) - $t0) * 1000)];
    }
}
