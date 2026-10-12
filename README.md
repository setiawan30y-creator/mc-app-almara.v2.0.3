# MC Almara

Project ini adalah aplikasi Money Changer berbasis Laravel 12 dengan frontend dashboard yang masih banyak memakai `localStorage`, lalu disinkronkan ke backend Laravel melalui endpoint API.

## Stack

- PHP 8.2+
- Laravel 12
- MySQL / MariaDB
- Laragon untuk local development Windows

## Struktur penting

- Halaman utama: `/`
- View utama: `resources/views/dashboard.blade.php`
- API utama: `routes/api.php`
- Sinkronisasi frontend ke backend: `public/js/sync.js`
- Modul frontend aktif: `public/js/modules/*.js`
- Arsip monolith lama: `public/js/legacy/app.monolith.js`

## Setup di Laragon

1. Simpan project di dalam folder `C:\laragon\www` agar virtual host Laragon otomatis aktif.
2. Start `Apache` dan `MySQL` dari Laragon.
3. Pastikan database `almara_mc` ada.
4. Salin file environment jika belum ada:

```powershell
copy .env.example .env
```

5. Install dependency PHP:

```powershell
composer install
```

6. Generate app key, migrasi database, dan buat storage link:

```powershell
php artisan key:generate
php artisan migrate
php artisan storage:link
```

7. Buka project dari browser:

```text
http://almara-mc-laravel.test
```

## Konfigurasi environment default

`.env` project ini sudah diarahkan ke:

```env
APP_NAME="MC Almara"
APP_URL=http://almara-mc-laravel.test
APP_TIMEZONE=Asia/Jakarta
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=almara_mc
DB_USERNAME=root
DB_PASSWORD=
```

## Catatan arsitektur

- Data transaksi, nasabah, dan banyak modul lain masih disimpan di browser `localStorage`.
- Backend Laravel dipakai sebagai pusat sinkronisasi MySQL, belum sepenuhnya menjadi single source of truth.
- Jika ingin project lebih stabil untuk jangka panjang, langkah berikutnya yang disarankan adalah memindahkan proses CRUD utama dari `localStorage` ke request API Laravel langsung.
