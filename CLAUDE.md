# MC Almara — aturan kerja kode

Developer signature di kode/halaman: `@2026-Alifiandra`.

## ATURAN TERKUNCI: alur data uang (disetujui pemilik, 2026-11-05)

1. **Database dulu.** Setiap input/edit/hapus yang menyangkut uang atau stok dikirim ke server
   dan baru dianggap tersimpan setelah server menjawab sukses. Bila server menolak / tidak
   bisa dihubungi: tampilkan "BELUM tersimpan", **jangan ubah apa pun di browser**.
2. **Satu sumber angka = buku besar ERP** (`erp_cash_*`, `erp_bank_*`, `erp_currency_stock_*`,
   `opening_balance`). Kas, bank, saldo awal, stok valas, mutasi bank, Closing Harian,
   Dashboard (termasuk "Selisih Rekons") semuanya membaca dari server.
3. **Browser hanya salinan tampilan.** `saveCash/saveBankBCA/saveBankMandiri` tidak mengirim ke
   server; `DatastoreController::LEDGER_OWNED_KEYS` menolak kiriman saldo dari browser.
4. **Kirim satu baris, bukan seluruh daftar.** Simpan/hapus hanya mengirim baris yang berubah
   (daftar di browser bisa usang dan menimpa data akun lain).
5. **Edit/hapus = baris koreksi** di buku besar (idempotent per nomor), baris lama tidak diubah.
6. **Antar akun otomatis** lewat `GET /api/live/version` (cek tiap 3 detik di `sync.js`);
   tabel baru yang berisi uang wajib ditambahkan ke `LiveSyncController::WATCH`.

Endpoint yang dipakai: transaksi `api/transactions/bulk` (+ `TransactionLedgerSync`),
mutasi `api/erp/bank-mutations/sync`, biaya `api/erp/expenses/sync`, saldo awal
`api/erp/opening-balances`, jurnal ekuitas `api/erp/adjustments/*`, DP booking & kasbon
`api/erp/booking-dp` / `api/erp/money-move` (`App\Services\Erp\MoneyLedger`), closing `api/closing/*`.

Nilai stok valas (Rp) HANYA dari `App\Services\Erp\ValasValuation` (`GET /api/valas/valuation`):
stok × modal rata-rata (saldo awal + BELI); tanggal yang sudah dikunci memakai nilai beku
(`erp_cash_closing_valuations`). Dipakai Dashboard, Live Stok Valuta, Closing Harian, Rekonsiliasi.

Jangan menambah kode yang menghitung saldo sendiri di browser atau menyimpan uang hanya di
localStorage. Cek saldo: `php artisan mc:balance-check`.
