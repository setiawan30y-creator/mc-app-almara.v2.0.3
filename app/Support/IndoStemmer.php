<?php
// @2026-Alifiandra

namespace App\Support;

/**
 * Pemroses kata bahasa Indonesia untuk Pencarian Dokumen (tanpa AI).
 *
 * Stemmer ringan: membuang imbuhan umum (me-, di-, ber-, pe-, ter-, ke-, se-, -kan, -an, -i, -nya, ...)
 * TANPA mengembalikan huruf awal yang luluh. Sisa kata dipakai sebagai pencocokan potongan kata,
 * sehingga "menukarkan" -> "ukar" tetap menemukan "tukar", "penukaran", "ditukar".
 */
final class IndoStemmer
{
    public const STOP = [
        'yang', 'dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'ini', 'itu', 'adalah', 'apa', 'apakah',
        'bagaimana', 'berapa', 'kapan', 'siapa', 'mana', 'dimana', 'kenapa', 'mengapa', 'saya', 'kami', 'kita', 'anda',
        'boleh', 'dapat', 'akan', 'oleh', 'tentang', 'terkait', 'mengenai', 'ada', 'tidak', 'bisa', 'saja', 'para',
        'sebuah', 'suatu', 'secara', 'antara', 'atas', 'bagi', 'jika', 'maka', 'sudah', 'telah', 'lebih', 'paling', 'seperti',
        'sesuai', 'menurut', 'tolong', 'mohon', 'cari', 'carikan', 'tampilkan', 'dokumen', 'berkas', 'file', 'nya', 'kah',
        'the', 'what', 'how', 'which', 'is', 'are', 'of', 'to', 'in', 'a', 'an',
    ];

    /** Sinonim & singkatan yang sering dipakai di money changer. */
    public const EXPAND = [
        'kupva' => ['penukaran valuta asing'],
        'valas' => ['valuta asing'],
        'ltkm' => ['transaksi keuangan mencurigakan'],
        'ltkt' => ['transaksi keuangan tunai'],
        'ltkl' => ['transfer dana'],
        'apu' => ['anti pencucian uang'],
        'ppt' => ['pendanaan terorisme'],
        'kyc' => ['mengenali pengguna jasa'],
        'cdd' => ['customer due diligence', 'uji tuntas'],
        'edd' => ['enhanced due diligence', 'uji tuntas lanjut'],
        'pjk' => ['pihak pelapor'],
        'pep' => ['politically exposed person'],
        'bo' => ['pemilik manfaat'],
        'lkbu' => ['laporan kegiatan usaha'],
        'lku' => ['laporan kegiatan usaha'],
        'bi' => ['bank indonesia'],
        'ojk' => ['otoritas jasa keuangan'],
        'ppatk' => ['pusat pelaporan dan analisis transaksi keuangan'],
        'ktp' => ['kartu tanda penduduk'],
        'npwp' => ['nomor pokok wajib pajak'],
        'nib' => ['nomor induk berusaha'],
        'pt' => ['perseroan terbatas'],
        'pks' => ['perjanjian kerja sama'],
        'sk' => ['surat keputusan'],
        'izin' => ['perizinan', 'lisensi'],
        'sewa' => ['kontrak'],
        'gaji' => ['upah'],
        'denda' => ['sanksi'],
        'sanksi' => ['denda'],
    ];

    private const PREFIX = ['meng', 'meny', 'mem', 'men', 'me', 'peng', 'peny', 'pem', 'pen', 'per', 'pe', 'ber', 'be', 'ter', 'di', 'ke', 'se'];
    private const SUFFIX = ['kan', 'an', 'i'];
    private const MIN = 4;

    /** Kata dasar (perkiraan) untuk satu kata. */
    public static function stem(string $word): string
    {
        $w = mb_strtolower(trim($word));
        if (mb_strlen($w) <= self::MIN || !preg_match('/^\p{L}+$/u', $w)) {
            return $w;
        }
        foreach (['lah', 'kah', 'tah', 'pun'] as $p) {
            if (self::endsStrip($w, $p)) { $w = mb_substr($w, 0, -mb_strlen($p)); break; }
        }
        foreach (['nya'] as $p) {
            if (self::endsStrip($w, $p)) { $w = mb_substr($w, 0, -mb_strlen($p)); break; }
        }
        for ($round = 0; $round < 2; $round++) {
            $done = false;
            foreach (self::PREFIX as $p) {
                if (str_starts_with($w, $p) && mb_strlen($w) - mb_strlen($p) >= self::MIN) {
                    $w = mb_substr($w, mb_strlen($p));
                    $done = true;
                    break;
                }
            }
            if (!$done) {
                break;
            }
        }
        foreach (self::SUFFIX as $s) {
            if (self::endsStrip($w, $s)) { $w = mb_substr($w, 0, -mb_strlen($s)); break; }
        }
        return $w;
    }

    private static function endsStrip(string $w, string $suffix): bool
    {
        return str_ends_with($w, $suffix) && mb_strlen($w) - mb_strlen($suffix) >= self::MIN;
    }

    /** @return string[] kata-kata (huruf/angka) dari teks, huruf kecil. */
    public static function words(string $text): array
    {
        preg_match_all('/[\p{L}\p{N}]+(?:[.\/-][\p{L}\p{N}]+)*/u', mb_strtolower($text), $m);
        return $m[0];
    }

    /**
     * Uraikan pertanyaan menjadi istilah pencarian.
     * @return array{terms: array<int,array{word:string,stem:string,weight:float,syn:bool}>, words: string[], numeric: bool}
     */
    public static function query(string $q): array
    {
        $words = array_values(array_filter(self::words($q), fn ($w) => !in_array($w, self::STOP, true) && (mb_strlen($w) >= 2)));
        $terms = [];
        $seen = [];
        $add = function (string $word, float $weight, bool $syn) use (&$terms, &$seen) {
            $stem = preg_match('/^\p{L}+$/u', $word) ? self::stem($word) : $word;
            if (mb_strlen($stem) < 2 || isset($seen[$stem])) {
                return;
            }
            $seen[$stem] = true;
            $terms[] = ['word' => $word, 'stem' => $stem, 'weight' => $weight, 'syn' => $syn];
        };
        foreach ($words as $w) {
            $add($w, 1.0, false);
        }
        // Sinonim / kepanjangan singkatan sebagai frasa (bobot lebih kecil).
        foreach ($words as $w) {
            foreach (self::EXPAND[$w] ?? [] as $phrase) {
                $key = 'phrase:' . $phrase;
                if (!isset($seen[$key])) {
                    $seen[$key] = true;
                    $terms[] = ['word' => $phrase, 'stem' => $phrase, 'weight' => 0.8, 'syn' => true];
                }
            }
        }
        $numeric = (bool) preg_match('/\b(berapa|kapan|tanggal|batas|maksimal|minimal|paling|nominal|jumlah|nilai|tahun|hari)\b/iu', $q);
        return ['terms' => $terms, 'words' => $words, 'numeric' => $numeric];
    }
}
