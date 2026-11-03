<?php
// @2026-Alifiandra

namespace App\Console\Commands;

use App\Services\DocSearchIndexer;
use Illuminate\Console\Command;

/** Memperbarui indeks Pencarian Dokumen (dijadwalkan tiap 5 menit, dibatasi waktu agar ringan). */
class DocSearchIndex extends Command
{
    protected $signature = 'mc:search-index {--full : Baca ulang semua berkas} {--budget=50 : Batas waktu (detik) per putaran}';
    protected $description = 'Indeks teks berkas untuk menu Pencarian Dokumen (tanpa AI).';

    public function handle(DocSearchIndexer $indexer): int
    {
        if ($this->option('full')) {
            DocSearchIndexer::refreshTools();
        }
        $s = $indexer->run(max(10, (int) $this->option('budget')), (bool) $this->option('full'));
        $this->info("Berkas tersinkron: {$s['synced']}, diindeks: {$s['indexed']}, OCR: {$s['ocr']}, dihapus: {$s['removed']}, menunggu: {$s['pending']} ({$s['seconds']} dtk)");
        return self::SUCCESS;
    }
}
