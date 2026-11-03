<?php

use App\Services\BackupService;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('mc:backup --automatic')
    ->everyMinute()
    ->withoutOverlapping();

// Riwayat Kurs (audit BI): dicek tiap menit, mencatat sesuai jadwal di menu Riwayat Kurs.
Schedule::command('mc:rate-snapshot')
    ->everyMinute()
    ->withoutOverlapping();

// Pencarian Dokumen: indeks teks berkas baru/berubah (OCR hanya bila Tesseract terpasang), dibatasi 50 detik per putaran.
Schedule::command('mc:search-index')
    ->everyFiveMinutes()
    ->withoutOverlapping();
