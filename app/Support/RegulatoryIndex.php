<?php
// @2026-Alifiandra

namespace App\Support;

use App\Models\RegulatoryChunk;
use App\Models\RegulatoryDocument;
use Illuminate\Support\Facades\DB;

/** Memecah teks regulasi per pasal dan mencari kutipan yang paling relevan. */
class RegulatoryIndex
{
    private const MAX_CHUNK = 1300;

    private const STOP = [
        'yang','dan','atau','dengan','untuk','dari','dalam','pada','adalah','apa','apakah','bagaimana','berapa','kapan','siapa',
        'mengapa','kenapa','dapat','boleh','harus','wajib','sebagai','oleh','kepada','itu','ini','akan','saya','kami','kita',
        'tentang','terkait','mengenai','ada','tidak','bisa','saja','para','sebuah','suatu','secara','antara','atas','bagi',
        'jika','maka','sudah','telah','lebih','paling','seperti','sesuai','menurut','the','what','how','which',
    ];

    /** Istilah domain money changer yang sering disingkat. */
    private const EXPAND = [
        'kupva' => ['penyelenggara kegiatan usaha penukaran valuta asing', 'penukaran valuta asing'],
        'kupva bb' => ['bukan bank'],
        'ltkm' => ['transaksi keuangan mencurigakan'],
        'ltkt' => ['transaksi keuangan tunai'],
        'ltkl' => ['transaksi keuangan transfer dana'],
        'apu' => ['anti pencucian uang'],
        'ppt' => ['pencegahan pendanaan terorisme'],
        'ppsppm' => ['pendanaan proliferasi senjata pemusnah massal'],
        'kyc' => ['prinsip mengenali pengguna jasa', 'pengguna jasa'],
        'cdd' => ['customer due diligence', 'uji tuntas'],
        'edd' => ['enhanced due diligence', 'uji tuntas lanjut'],
        'pjk' => ['pihak pelapor'],
        'pep' => ['politically exposed person', 'orang yang populer secara politis'],
        'bo' => ['pemilik manfaat'],
        'goaml' => ['goaml', 'pelaporan'],
        'lkbu' => ['laporan kegiatan usaha'],
        'lku' => ['laporan kegiatan usaha'],
        'tbu' => ['transaksi', 'batas'],
    ];

    /** @return array<int,array{0:?string,1:string}> */
    public static function chunk(string $text): array
    {
        $lines = preg_split('/\n/u', $text);
        $blocks = [];
        $ref = null;
        $buf = [];
        $flush = function () use (&$blocks, &$ref, &$buf) {
            $body = trim(implode("\n", $buf));
            if ($body !== '') {
                $blocks[] = [$ref, $body];
            }
            $buf = [];
        };
        foreach ($lines as $line) {
            if (preg_match('/^\s*(BAB\s+[IVXLC\d]+\b|Pasal\s+\d+[A-Z]?\b|Bagian\s+(?:Kesatu|Kedua|Ketiga|Keempat|Kelima|\w+)\b|Angka\s+\d+\b)/iu', $line, $m)) {
                $flush();
                $ref = preg_replace('/\s+/u', ' ', trim($m[1]));
            }
            $buf[] = $line;
        }
        $flush();

        $out = [];
        foreach ($blocks as [$r, $body]) {
            if (mb_strlen($body) <= self::MAX_CHUNK) {
                $out[] = [$r, $body];
                continue;
            }
            $part = '';
            $n = 0;
            foreach (preg_split('/\n+/u', $body) as $para) {
                while (mb_strlen($para) > self::MAX_CHUNK) {
                    if ($part !== '') { $out[] = [self::label($r, $n++), $part]; $part = ''; }
                    $out[] = [self::label($r, $n++), mb_substr($para, 0, self::MAX_CHUNK)];
                    $para = mb_substr($para, self::MAX_CHUNK);
                }
                if ($part !== '' && mb_strlen($part) + mb_strlen($para) > self::MAX_CHUNK) {
                    $out[] = [self::label($r, $n++), $part];
                    $part = '';
                }
                $part .= ($part === '' ? '' : "\n") . $para;
            }
            if (trim($part) !== '') {
                $out[] = [self::label($r, $n++), $part];
            }
        }
        return $out;
    }

    private static function label(?string $ref, int $n): ?string
    {
        if ($ref === null) {
            return null;
        }
        return $n === 0 ? $ref : $ref . ' (lanj. ' . $n . ')';
    }

    public static function reindex(RegulatoryDocument $doc, string $text): int
    {
        $chunks = self::chunk($text);
        DB::transaction(function () use ($doc, $chunks) {
            RegulatoryChunk::where('document_id', $doc->id)->delete();
            foreach (array_chunk($chunks, 200, true) as $batch) {
                $rows = [];
                foreach ($batch as $i => [$ref, $content]) {
                    $rows[] = ['document_id' => $doc->id, 'position' => $i, 'ref' => $ref, 'content' => $content];
                }
                RegulatoryChunk::insert($rows);
            }
        });
        return count($chunks);
    }

    /** @return string[] */
    public static function terms(string $q): array
    {
        $q = mb_strtolower($q);
        $terms = [];
        foreach (self::EXPAND as $abbr => $full) {
            if (preg_match('/\b' . preg_quote($abbr, '/') . '\b/u', $q)) {
                foreach ($full as $f) {
                    $q .= ' ' . $f;
                }
            }
        }
        if (preg_match_all('/\d{1,3}(?:[.,]\d{3})+/u', $q, $nums)) {
            foreach ($nums[0] as $num) {
                $terms[$num] = true;
            }
            $q = preg_replace('/\d{1,3}(?:[.,]\d{3})+/u', ' ', $q);
        }
        foreach (preg_split('/[^\p{L}\p{N}]+/u', $q) as $w) {
            if ($w === '' || in_array($w, self::STOP, true)) {
                continue;
            }
            if (ctype_digit($w) && (strlen($w) < 2 || $w[0] === '0')) {
                continue;
            }
            if (mb_strlen($w) >= 3 || ctype_digit($w)) {
                $terms[$w] = true;
            }
        }
        return array_keys($terms);
    }

    /**
     * @param int[] $docIds
     * @return array<int,array<string,mixed>>
     */
    public static function search(string $question, array $docIds = [], ?string $issuer = null, int $limit = 8): array
    {
        $terms = self::terms($question);
        if (!$terms) {
            return [];
        }
        $pasal = null;
        if (preg_match('/pasal\s+(\d+[a-z]?)/iu', $question, $m)) {
            $pasal = mb_strtolower('Pasal ' . $m[1]);
        }
        usort($terms, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        $like = array_slice($terms, 0, 10);

        $q = RegulatoryChunk::query()
            ->join('mc_regulatory_documents as d', 'd.id', '=', 'mc_regulatory_chunks.document_id')
            ->where('d.status', 'ready')
            ->when($docIds, fn ($qq) => $qq->whereIn('d.id', $docIds))
            ->when($issuer, fn ($qq) => $qq->where('d.issuer', $issuer))
            ->where(function ($w) use ($like) {
                foreach ($like as $t) {
                    $w->orWhere('mc_regulatory_chunks.content', 'like', '%' . str_replace(['%', '_'], ['\%', '\_'], $t) . '%');
                }
            })
            ->select([
                'mc_regulatory_chunks.id', 'mc_regulatory_chunks.document_id', 'mc_regulatory_chunks.ref', 'mc_regulatory_chunks.content',
                'd.title', 'd.regulation_number', 'd.issuer', 'd.doc_type', 'd.validity', 'd.effective_date',
            ])
            ->limit(700)
            ->get();

        if ($q->isEmpty()) {
            return [];
        }

        $n = $q->count();
        $lower = [];
        $df = array_fill_keys($terms, 0);
        foreach ($q as $row) {
            $c = mb_strtolower($row->content);
            $lower[$row->id] = $c;
            foreach ($terms as $t) {
                if (str_contains($c, $t)) {
                    $df[$t]++;
                }
            }
        }

        $scored = [];
        foreach ($q as $row) {
            $c = $lower[$row->id];
            $s = 0.0;
            $hit = 0;
            foreach ($terms as $t) {
                $cnt = substr_count($c, $t);
                if ($cnt > 0) {
                    $hit++;
                    $s += log(1 + $n / (1 + $df[$t])) * (1 + log(1 + $cnt)) * (1 + min(mb_strlen($t), 12) / 12);
                }
            }
            if ($s <= 0) {
                continue;
            }
            $s *= 0.6 + 0.4 * ($hit / max(1, count($terms)));
            if ($pasal && $row->ref && str_starts_with(mb_strtolower($row->ref), $pasal)) {
                $s *= 2.2;
            }
            if ($row->validity === 'dicabut') {
                $s *= 0.55;
            }
            $ts = mb_strtolower($row->title . ' ' . $row->regulation_number);
            foreach ($terms as $t) {
                if (str_contains($ts, $t)) {
                    $s *= 1.12;
                }
            }
            $scored[] = [$s, $row];
        }
        usort($scored, fn ($a, $b) => $b[0] <=> $a[0]);

        $perDoc = [];
        $out = [];
        foreach ($scored as [$s, $row]) {
            $perDoc[$row->document_id] = ($perDoc[$row->document_id] ?? 0) + 1;
            if ($perDoc[$row->document_id] > 4) {
                continue;
            }
            $out[] = [
                'chunk_id' => $row->id,
                'document_id' => (int) $row->document_id,
                'title' => $row->title,
                'regulation_number' => $row->regulation_number,
                'issuer' => $row->issuer,
                'doc_type' => $row->doc_type,
                'validity' => $row->validity ?: 'berlaku',
                'effective_date' => $row->effective_date ? substr((string) $row->effective_date, 0, 10) : null,
                'ref' => $row->ref,
                'content' => $row->content,
                'score' => round($s, 3),
            ];
            if (count($out) >= $limit) {
                break;
            }
        }
        return $out;
    }
}
