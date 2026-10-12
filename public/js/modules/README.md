# Frontend Modules

File-file di folder ini dimuat berurutan dari `resources/views/dashboard.blade.php`.

Urutan aktif:

1. `01-core.js`
   Bootstrap frontend, helper localStorage, formatter, dan shell UI.
2. `02-dashboard.js`
   Dashboard dan laporan harian.
3. `03-pos.js`
   POS, cart, checkout, dan transaksi.
4. `04-customer-currency.js`
   Kurs, laporan, nasabah, ID generator, WA, dan edit nasabah.
5. `05-finance-ops.js`
   Mutasi bank, pengeluaran, ekuitas, closing, settings, master data, upload, dan export.
6. `06-regulatory-reports.js`
   Laporan regulasi, backup/reset, dan helper export tambahan.
7. `07-dtott.js`
   Compatibility layer dan modul DTOTT.
8. `08-auth.js`
   Auth, user management, dan sinkronisasi terkait akses.
9. `09-operations.js`
   Old money, HRIS, dan booking.
10. `10-accounting.js`
   Investor, audit internal, dan engine akuntansi.

Catatan:

- `public/js/legacy/app.monolith.js` adalah snapshot file lama sebelum dipecah.
- Namespace awal frontend sekarang tersedia di `window.AlmaraApp` dengan grup `utils`, `store`, `ui`, dan `auth`.
- Alias global lama masih dipertahankan untuk kompatibilitas sambil migrasi bertahap.
- Jika ingin refactor lanjutan, pindahkan dependency global `window.*` sedikit demi sedikit mulai dari `01-core.js`.
