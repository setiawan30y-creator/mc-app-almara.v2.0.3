<?php

namespace App\Support;

/**
 * Kode akun Laba/Rugi LKBU B0003 (Bank Indonesia). Sumber tunggal di server;
 * daftar yang sama dipakai browser di public/js/modules/36-lkbu.js.
 *
 * kind: INCOME = pendapatan, EXPENSE = beban, AUTO = dihitung sistem (bukan input jurnal).
 */
class BiAccounts
{
    public const ACCOUNTS = [
        '01' => ['Penjualan UKA', 'AUTO'],
        '02' => ['Pencairan TC', 'AUTO'],
        '03' => ['Saldo Awal UKA dan TC', 'AUTO'],
        '04' => ['Pembelian UKA dan TC', 'AUTO'],
        '05' => ['Saldo Akhir UKA dan TC', 'AUTO'],
        '06' => ['Pendapatan Pengiriman Uang', 'INCOME'],
        '07' => ['Beban Gaji, Upah dan Tunjangan', 'EXPENSE'],
        '08' => ['Beban Sewa', 'EXPENSE'],
        '09' => ['Beban Iklan dan promosi', 'EXPENSE'],
        '10' => ['Beban Air, Listrik dan Telepon', 'EXPENSE'],
        '11' => ['Beban Transportasi dan perjalanan', 'EXPENSE'],
        '12' => ['Beban Pemeliharaan kendaraan', 'EXPENSE'],
        '13' => ['Penyusutan Aset Tetap', 'AUTO'],
        '14' => ['Beban Asuransi', 'EXPENSE'],
        '15' => ['Beban Lain-Lain (Operasional)', 'EXPENSE'],
        '16' => ['Pendapatan Bunga bank', 'INCOME'],
        '17' => ['Beban Administrasi Bank', 'EXPENSE'],
        '18' => ['Beban Bunga Pinjaman', 'EXPENSE'],
        '19' => ['Laba Penjualan Aset Tetap', 'INCOME'],
        '20' => ['Rugi Penjualan Aset Tetap', 'EXPENSE'],
        '21' => ['Laba Selisih Kurs', 'AUTO'],
        '22' => ['Rugi Selisih Kurs', 'EXPENSE'],
        '23' => ['Pendapatan Lain-Lain', 'INCOME'],
        '24' => ['Beban Lain-Lain (Non Operasional)', 'EXPENSE'],
        '25' => ['Pajak Penghasilan', 'EXPENSE'],
    ];

    public static function name(string $code): ?string
    {
        return self::ACCOUNTS[$code][0] ?? null;
    }

    public static function kind(string $code): ?string
    {
        return self::ACCOUNTS[$code][1] ?? null;
    }

    public static function label(string $code): string
    {
        return $code.'-'.(self::name($code) ?? '');
    }

    /** Kode dari teks kategori: awalan "NN-" atau nama lama; fallback per tipe (23 / 15). */
    public static function resolve(?string $category, string $type): string
    {
        $category = trim((string) $category);
        if (preg_match('/^(\d{2})\s*-/', $category, $m) && isset(self::ACCOUNTS[$m[1]])) {
            return $m[1];
        }
        $plain = mb_strtolower(trim(preg_replace('/^\d{2}\s*-\s*/', '', $category)));
        foreach (self::ACCOUNTS as $code => [$name]) {
            if (mb_strtolower($name) === $plain) {
                return (string) $code;
            }
        }

        return $type === 'PENDAPATAN' ? '23' : '15';
    }

    /** Daftar kategori untuk dropdown: type PENGELUARAN | PENDAPATAN. */
    public static function optionsFor(string $type): array
    {
        $want = $type === 'PENDAPATAN' ? 'INCOME' : 'EXPENSE';
        $out = [];
        foreach (self::ACCOUNTS as $code => [$name, $kind]) {
            if ($kind === $want) {
                $out[] = ['code' => (string) $code, 'name' => $name, 'label' => $code.'-'.$name];
            }
        }

        return $out;
    }
}
