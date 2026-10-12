# Deployment Proxmox + Domain

Dokumen ini untuk menjalankan MC Almara sebagai aplikasi production yang bisa diakses dari banyak PC melalui domain sendiri.

## Target Arsitektur

- Proxmox menjalankan VM/LXC Linux.
- Nginx atau Apache menjadi web server.
- PHP 8.2+ dengan ekstensi umum Laravel.
- MySQL/MariaDB sebagai database pusat.
- HTTPS aktif dari Let's Encrypt.
- Semua user login melalui database Laravel, bukan password di browser.

## Langkah Server

1. Buat database dan user MySQL.

```sql
CREATE DATABASE almara_mc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'almara_user'@'localhost' IDENTIFIED BY 'ganti_password_database_yang_kuat';
GRANT ALL PRIVILEGES ON almara_mc.* TO 'almara_user'@'localhost';
FLUSH PRIVILEGES;
```

2. Copy `.env.production.example` menjadi `.env`, lalu isi `APP_URL`, `APP_KEY`, `DB_*`, dan `SESSION_DOMAIN`.

3. Install dependency dan siapkan aplikasi.

```bash
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

4. Arahkan document root web server ke folder `public`.

5. Aktifkan HTTPS.

```bash
sudo certbot --nginx -d domain-anda.com
```

## Contoh Nginx

```nginx
server {
    listen 80;
    server_name domain-anda.com;
    root /var/www/almara-mc-laravel/public;

    index index.php;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

## Backup Harian

Di Linux, gunakan `mysqldump` lewat cron.

```bash
mkdir -p /var/backups/almara
mysqldump --single-transaction --routines --triggers -u almara_user -p almara_mc > /var/backups/almara/almara_mc-$(date +%F-%H%M).sql
```

Jalankan backup otomatis harian dan salin hasilnya ke storage lain di luar VM.

## Uji Multi-PC

1. Login dari PC A memakai `owner / owner123`, lalu segera ganti password owner.
2. Buat user baru dari menu Pengaturan.
3. Login dari PC B memakai user baru.
4. Buat nasabah/transaksi dari PC A.
5. Refresh PC B dan pastikan data yang sama muncul.
6. Uji role: user kasir tidak boleh membuka/hapus data yang dibatasi.
