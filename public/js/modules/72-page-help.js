// @2026-Alifiandra
/* =====================================================================
 * MODULE 72: TOMBOL INFO PER HALAMAN
 *
 * Tombol kecil (i) di samping judul halaman (header atas). Isinya berbeda
 * untuk setiap halaman: fungsi halaman, cara pakai, dan tips. Halaman
 * Pengaturan memakai isi sesuai tab yang sedang terbuka.
 * Untuk menambah / mengubah isi: sunting objek HELP di bawah (kunci = id section).
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcPageHelp) return;
    window.__mcPageHelp = true;

    var HELP = {
        /* ---------------------------------------------------------- Ringkasan & operasional */
        'dashboard-view': {
            t: 'Dashboard', f: 'Ringkasan kondisi usaha hari ini dalam satu layar: posisi kas, saldo bank, estimasi nilai stok valas, profit, aktivitas transaksi, grafik, dan analitik nasabah.',
            s: ['Lihat kartu posisi di bagian atas untuk kas tunai, bank, dan stok valas.', 'Ganti rentang grafik (1H, 3H, 7H, 1M, 3M, 1Y) dan pilih valuta untuk melihat tren qty dan kurs.', 'Gulir ke bawah untuk aktivitas terbaru, analitik wilayah nasabah, dan ringkasan kepatuhan.'],
            p: ['Angka dihitung dari transaksi, pengeluaran, dan closing yang sudah tersimpan.']
        },
        'pos-view': {
            t: 'Transaksi / POS', f: 'Kasir utama untuk transaksi beli dan jual valas: memilih valas dan kurs, mencatat nasabah, menerima pembayaran, lalu mencetak nota.',
            s: ['Pilih valas, tentukan "Kita Beli" atau "Kita Jual", isi jumlah, lalu klik Tambah ke Keranjang (F2).',
                'Pilih nasabah (atau buat Nasabah Baru). Untuk nasabah perusahaan, pilih juga orang yang hadir di "Diwakili oleh".',
                'Isi pengambil valas, tujuan transaksi, sumber dana, dan unggah underlying bila diperlukan.',
                'Pilih metode bayar (tunai, transfer, atau campuran), lalu klik Proses Transaksi (F5).',
                'Cetak struk / invoice atau kirim nota lewat WhatsApp.'],
            p: ['Peringatan muncul bila izin perusahaan atau identitas nasabah sudah kedaluwarsa; pilih "Perbarui Data Nasabah" untuk pengkinian data.', 'Penjualan yang melewati limit bulanan memerlukan underlying / persetujuan.', 'Mode kurs Manual dipakai untuk kurs deal (nego).']
        },
        'demo-pos-view': {
            t: 'Demo Transaksi', f: 'Area latihan untuk kasir baru. Stok dan transaksi di sini terpisah dan tidak mengubah data POS utama.',
            s: ['Tambah stok demo di panel Stok Demo.', 'Buat transaksi seperti di kasir sungguhan, lalu simpan atau cetak rinciannya.'],
            p: ['Cocok untuk pelatihan tanpa risiko salah input di data asli.']
        },
        'kurs-hari-ini-view': {
            t: 'Kurs Hari Ini', f: 'Papan kurs internal berisi kurs beli/jual, selisih, tren, dan stok tiap valas, dilengkapi kalkulator cepat.',
            s: ['Klik kartu valas untuk memakainya di kalkulator (Valas ke Rp atau Rp ke Valas).', 'Centang beberapa kartu lalu kirim daftar kurs ke nasabah lewat WhatsApp.'],
            p: ['Halaman diperbarui otomatis saat kurs atau stok berubah.']
        },
        'booking-view': {
            t: 'Daftar Booking', f: 'Pemesanan valas dengan uang muka (DP) sebelum nasabah datang.',
            s: ['Buat booking: pilih nasabah, valas, kurs deal, dan DP.', 'Saat nasabah datang, klik "Ambil → Transaksi"; sisa pembayaran otomatis dihitung (total dikurangi DP).', 'Selesaikan di halaman Transaksi; booking otomatis ditandai Selesai.'],
            p: ['Nomor invoice baru terbit saat transaksi diproses, bukan saat booking.', 'Booking yang dibatalkan melepas stok; DP bisa dikembalikan atau hangus.']
        },
        'pickup-view': {
            t: 'Serah Terima / Pickup', f: 'Pengantaran valas oleh kurir ke nasabah, dipantau dari peta.',
            s: ['Staf membuat penugasan kurir untuk transaksi pengantaran.', 'Kurir memulai perjalanan; lokasi GPS terkirim otomatis.', 'Saat tiba, kurir menyerahkan valas dengan PIN penerima dan foto bukti.', 'Staf menyelesaikan penugasan; penjualan, kas, dan bank tercatat otomatis.'],
            p: ['Tombol Google Maps membuka navigasi atau posisi kurir.']
        },
        'closing-view': {
            t: 'Closing Harian', f: 'Tutup buku harian: mencocokkan hitungan fisik kas dan valas dengan catatan sistem.',
            s: ['Hitung uang fisik per pecahan dan isi ke form.', 'Bandingkan dengan saldo sistem; selisih akan terlihat.', 'Simpan closing setelah semua cocok atau selisih sudah dijelaskan.'],
            p: ['Angka sistem dihitung server dari ledger, bukan dari browser.', 'Uang yang sedang di luar laci dicatat di menu Gantungan.']
        },
        'mutation-view': {
            t: 'Mutasi Bank', f: 'Catatan pergerakan rekening bank perusahaan.',
            s: ['Klik kartu bank untuk melihat rincian mutasinya.', 'Klik Tambah Mutasi untuk mencatat mutasi manual (setoran, penarikan, transfer).', 'Gunakan Export Excel atau Cetak PDF untuk arsip.'],
            p: ['Tabel di bawah hanya berisi mutasi manual yang diinput kasir.']
        },
        'old-money-view': {
            t: 'Koin & Uang Lama', f: 'Kasir khusus koin asing dan uang kertas lama, dengan kas, stok, dan laba yang terpisah dari transaksi utama.',
            s: ['Tab Kasir: catat pembelian atau penjualan koin / uang lama.', 'Tab Stok & Item: kelola item dan lihat stok.', 'Tab Riwayat, Kas Koin, dan Acuan Harga untuk pemantauan dan referensi harga.'],
            p: ['Transaksi yang membuat stok atau kas minus akan ditolak.']
        },
        'valas-gallery-view': {
            t: 'Galeri Valas', f: 'Acuan uang yang masih diterima (hijau) dan yang ditolak (merah), lengkap dengan alasan dan ciri-cirinya.',
            s: ['Cari dengan filter status, mata uang, atau kata kunci.', 'Gunakan pencarian dengan foto untuk membandingkan uang nasabah dengan galeri.', 'Admin / supervisor dapat menambah atau mengubah acuan.'],
            p: ['Hasil pencarian foto hanya perkiraan kemiripan, bukan pengganti pengecekan fisik.']
        },
        'waiting-list-view': {
            t: 'Permintaan Valas', f: 'Antrean permintaan nasabah untuk valas yang stoknya sedang kosong.',
            s: ['Klik Tambah Antrean, isi nama, nomor WhatsApp, mata uang, dan jumlah.', 'Saat valas tersedia, ubah status menjadi Ready dan kabari nasabah lewat WhatsApp.'],
            p: ['Gunakan filter status (Menunggu, Ready, Batal) untuk memantau antrean.']
        },

        /* ---------------------------------------------------------- Nasabah */
        'customers-view': {
            t: 'Data Nasabah (KYC)', f: 'Database nasabah perorangan dan perusahaan untuk transaksi dan pelaporan.',
            s: ['Klik Tambah Nasabah, pilih Perorangan atau Perusahaan, lalu isi data sesuai identitas.', 'Perorangan: isi Masa Berlaku Identitas untuk SIM, Paspor, atau KITAS.', 'Perusahaan: isi Jenis Badan Usaha, Bidang Usaha, Tanggal Terbit, dan Berlaku Sampai.', 'Gunakan Impor Data Nasabah (Excel/CSV) untuk input massal; unduh template terlebih dulu.'],
            p: ['Nama dicek otomatis ke daftar DTTOT saat disimpan.', 'Tanggal berlaku dipakai untuk pengingat jatuh tempo dan notifikasi pengkinian data di Kasir.']
        },
        'pt-rep-view': {
            t: 'Perwakilan PT', f: 'Daftar orang yang berwenang mewakili nasabah perusahaan: penanda tangan, pelaksana transaksi, dan kurir pengambil.',
            s: ['Pilih PT di daftar kiri.', 'Klik Tambah orang; isi peran, identitas, dasar kewenangan (PKS / surat kuasa), dan masa berlakunya.', 'Di Kasir, orang ini dipilih lewat "Diwakili oleh" saat transaksi atas nama PT.'],
            p: ['Perwakilan tidak dibuatkan No. CIF dan tidak ikut SIPESAT (data internal).', 'Bila orang yang sama bertransaksi untuk dirinya sendiri, daftarkan sebagai nasabah perorangan.']
        },
        'customer-license-view': {
            t: 'Perizinan Nasabah', f: 'Pemantauan masa berlaku izin nasabah perusahaan, dengan pengingat sebelum dan sesudah jatuh tempo.',
            s: ['Masa berlaku dokumen utama diisi di form nasabah (Berlaku Sampai) dan otomatis tampil di sini.', 'Klik Tambah izin untuk izin lain (NIB, SK, Domisili, dll.).', 'Atur "Ingatkan N hari" sebelum berakhir dan "Popup berhenti H+" setelah lewat.'],
            p: ['Pengingat muncul di ikon header, popup harian, dan di Kasir sampai data diperbarui.']
        },
        'dtott-view': {
            t: 'DTTOT', f: 'Daftar Terduga Teroris dan Organisasi Teroris. Nama nasabah dicocokkan dengan daftar ini.',
            s: ['Unggah daftar DTTOT terbaru (Excel/CSV) dari sumber resmi.', 'Saat nasabah disimpan, nama yang mirip dengan daftar akan memunculkan peringatan.'],
            p: ['Perbarui daftar setiap ada rilis baru dari otoritas.']
        },

        /* ---------------------------------------------------------- Kurs & master */
        'currency-view': {
            t: 'Manajemen Kurs', f: 'Pengelolaan valuta dan kurs: kurs sumber, selisih (margin), dan kurs akhir yang dipakai di Kasir.',
            s: ['Atur URL sumber acuan kurs dan pantau status sinkronisasinya.', 'Tambah atau ubah valuta beserta kurs beli/jual dan selisihnya.', 'Cari valuta di tabel untuk memeriksa kurs yang berlaku.'],
            p: ['Kurs akhir = kurs sumber + selisih.', 'Setiap perubahan kurs ikut tercatat di Riwayat Kurs.']
        },
        'kurs-history-view': {
            t: 'Riwayat Kurs', f: 'Dokumentasi kurs per jam (dan setiap perubahan) untuk kebutuhan audit Bank Indonesia.',
            s: ['Atur Jadwal Pencatatan: jam mulai, jam selesai, interval, dan hari aktif.', 'Lihat tampilan Per Jam atau Daftar; kolom berisi kurs sumber, selisih, dan kurs hasil.', 'Ekspor ke Excel / CSV atau cetak untuk arsip audit.'],
            p: ['Pencatatan otomatis berjalan di server (scheduler) selama jadwal aktif.']
        },
        'masterdata-view': {
            t: 'Master Data', f: 'Referensi yang dipakai di seluruh aplikasi: daftar pekerjaan, warga negara, dan kode mata uang ISO 4217.',
            s: ['Atur bobot risiko (Rendah, Sedang, Tinggi) untuk pekerjaan dan warga negara.', 'Buka referensi ISO 4217 saat menambah kode mata uang baru.'],
            p: ['Bobot risiko dipakai dalam penilaian profil nasabah.']
        },

        /* ---------------------------------------------------------- Keuangan */
        'expense-view': {
            t: 'Pengeluaran & Pendapatan', f: 'Jurnal keuangan non-valas (biaya operasional, pendapatan lain) dengan kode akun BI.',
            s: ['Klik tambah, pilih kode akun BI, sumber kas/bank, nominal, dan keterangan.', 'Simpan; saldo kas/bank otomatis berubah.'],
            p: ['Kode akun di form sama dengan kode di LKBU B0003, jadi laporan BI langsung terisi.']
        },
        'gantungan-view': {
            t: 'Gantungan', f: 'Catatan uang rupiah yang sedang di luar laci saat closing (misalnya dipinjam atau belum disetor).',
            s: ['Tambah catatan per nama beserta nominalnya.', 'Catat cicilan pengembalian; sisa dihitung otomatis.'],
            p: ['Hanya catatan: tidak mengubah saldo ledger, tetapi dibaca oleh Closing Harian.']
        },
        'investor-view': {
            t: 'Penanam Saham', f: 'Profil investor dan riwayat setor / tarik modal.',
            s: ['Tambah investor, lalu catat setoran atau penarikan modalnya.'],
            p: ['Modal disetor = total setor dikurangi total tarik.', 'Hanya catatan: tidak membuat mutasi kas/bank.']
        },
        'adjustment-view': {
            t: 'Jurnal Ekuitas & Kewajiban', f: 'Catatan modal dan hutang (pasiva) beserta kategori akun BI.',
            s: ['Klik Tambah Catatan Modal/Hutang, pilih kategori akun dan tipe pergerakan, lalu simpan.', 'Gunakan Export Excel untuk arsip.'],
            p: []
        },

        /* ---------------------------------------------------------- Laporan */
        'harian-view': {
            t: 'Laporan Harian', f: 'Posisi keuangan hari ini: kas awal, kas riil, saldo bank, profit, dan stok valas beserta valuasinya.',
            s: ['Klik Perbarui untuk menghitung ulang.', 'Gunakan Cetak Tampilan atau Export Stok untuk arsip harian.'],
            p: []
        },
        'laporan-posisi-valuta-view': {
            t: 'Rekap Valuta', f: 'Rekap saldo awal, pembelian, penjualan, dan sisa saldo per kode mata uang dalam satu periode.',
            s: ['Pilih periode (dari - sampai) dan valuta.', 'Ekspor ke Excel atau cetak PDF.'],
            p: ['Kode seperti USD, USDK, dan USDST tampil terpisah.']
        },
        'reports-view': {
            t: 'Riwayat Transaksi', f: 'Daftar semua transaksi beli/jual dengan filter dan ringkasan total.',
            s: ['Saring berdasarkan invoice, nama, nomor HP, mata uang, tipe, dan tanggal, lalu klik Tampilkan Riwayat.', 'Gunakan tombol aksi per baris untuk cetak ulang atau ubah transaksi.', 'Export Excel atau Cetak Masal untuk arsip.'],
            p: ['Hapus Semua bersifat permanen; gunakan dengan hati-hati.']
        },
        'laporan-aset-view': {
            t: 'Aset & Penyusutan', f: 'Register aset tetap dan perhitungan penyusutannya.',
            s: ['Tambah aset: harga perolehan, nilai residu, masa manfaat, dan metode penyusutan.', 'Catat pelepasan aset bila dijual; laba/rugi dihitung otomatis.', 'Lihat laporan tahunan dan ekspor ke Excel.'],
            p: ['Angka penyusutan dipakai juga oleh Neraca dan Laba Rugi.']
        },
        'laporan-bukubesar-view': {
            t: 'Buku Besar', f: 'Mutasi debit / kredit dan saldo per akun (kas, bank, persediaan valas, beban).',
            s: ['Pilih akun, bulan, dan tahun, lalu tampilkan.', 'Ekspor ke Excel atau cetak PDF.'],
            p: []
        },
        'laporan-labarugi-view': {
            t: 'Laba / Rugi', f: 'Kinerja keuangan: pendapatan margin valas dikurangi beban operasional dan penyusutan.',
            s: ['Pilih bulan dan tahun.', 'Ekspor format BI atau cetak PDF.'], p: []
        },
        'laporan-neraca-view': {
            t: 'Neraca', f: 'Posisi aktiva dan pasiva perusahaan pada tanggal tertentu.',
            s: ['Pilih tanggal posisi.', 'Ekspor format BI atau cetak PDF.'], p: []
        },
        'laporan-coretax-view': {
            t: 'CoreTax', f: 'Data dasar laporan pajak per transaksi, disusun mengikuti isian portal CoreTax DJP.',
            s: ['Pilih periode, periksa hasil validasi per baris (ID 16 digit, nilai, tanggal).', 'Ekspor Excel (sheet Data, Rekap, dan Validasi).'],
            p: ['Ini data siap rekonsiliasi, bukan berkas XML resmi DJP.']
        },
        'laporan-lku-view': {
            t: 'LKBU', f: 'Pusat Laporan Keuangan dan Bisnis Umum untuk Bank Indonesia.',
            s: ['Pilih tab B0001 sampai B0006 sesuai kelompok laporan.', 'Tentukan periode laporan dan isi kurs tengah BI akhir bulan.', 'Ekspor TXT, Excel, atau cetak PDF.'],
            p: ['Kurs awal otomatis memakai kurs BI bulan sebelumnya.']
        },
        'laporan-granular-view': {
            t: 'Laporan Granular', f: 'Data transaksi terperinci harian sesuai format Bank Indonesia.',
            s: ['Pilih rentang tanggal, lalu ekspor Excel (format BI) atau cetak PDF.'],
            p: ['Pastikan data identitas nasabah lengkap agar kolom wajib terisi.']
        },
        'laporan-sipesat-view': {
            t: 'SIPESAT', f: 'Daftar nasabah yang dilaporkan per triwulan berdasarkan tanggal daftar.',
            s: ['Pilih mode Triwulan (tahun + TW1 sampai TW4) atau Rentang tanggal.', 'Periksa daftar, lalu ekspor untuk pelaporan.'],
            p: ['Perwakilan PT tidak ikut dilaporkan; yang dilaporkan PT-nya.']
        },
        'laporan-goaml-view': {
            t: 'GoAML', f: 'Temuan transaksi yang memenuhi aturan pelaporan (LTKT, LTKM, dan lainnya) untuk ditinjau petugas kepatuhan.',
            s: ['Tab Pengaturan: atur aturan threshold (nominal, periode, jumlah, jenis transaksi).', 'Tab Laporan: tinjau temuan yang muncul otomatis, lalu buat draft laporan.'],
            p: ['Aplikasi tidak mengirim apa pun ke portal GoAML; keputusan akhir ada pada petugas kepatuhan.']
        },
        'laporan-sipendar-view': {
            t: 'SIPENDAR', f: 'Halaman ini masih berupa kerangka dan belum memiliki fungsi pelaporan.',
            s: [], p: []
        },

        /* ---------------------------------------------------------- Regulasi & tools */
        'almara-regulatory-chat-view': {
            t: 'Chat Regulatory AI', f: 'Tanya-jawab regulasi BI, PPATK, dan otoritas lain. Jawaban disusun hanya dari sumber di menu Sumber Regulasi.',
            s: ['Pilih cakupan: semua sumber, per penerbit, atau satu sumber.', 'Ketik pertanyaan; klik kutipan [S1], [S2] untuk melihat bunyi aslinya.'],
            p: ['Butuh API key AI di Pengaturan > Asisten AI.', 'Tetap periksa ulang pasal aslinya untuk keputusan penting.']
        },
        'almara-regulatory-ai-view': {
            t: 'Sumber Regulasi', f: 'Tempat menyimpan dokumen regulasi yang menjadi dasar jawaban Chat Regulatory AI.',
            s: ['Unggah file (PDF, Word, Excel, teks, gambar) atau tempel teks.', 'Isi penerbit, jenis, nomor, tanggal berlaku, dan status (berlaku / diubah / dicabut).'],
            p: ['Tandai regulasi yang dicabut agar AI memakai yang terbaru.']
        },
        'ai-chat-view': {
            t: 'Tanya AI / Deteksi Valas', f: 'Asisten AI untuk tanya-jawab seputar valas dan deteksi foto uang kertas / koin.',
            s: ['Ketik pertanyaan, atau ambil / unggah foto uang untuk dianalisis.'],
            p: ['Butuh API key AI di Pengaturan > Asisten AI.', 'Riwayat obrolan tersimpan di perangkat ini saja.']
        },
        'translator-view': {
            t: 'Penerjemah Bahasa', f: 'Membantu kasir melayani nasabah mancanegara.',
            s: ['Mode Teks: ketik atau bicara, terjemahan muncul otomatis dan bisa diputar suaranya.', 'Mode Percakapan: kasir dan nasabah bergantian bicara atau mengetik.'],
            p: ['Memakai AI yang diatur di Pengaturan > Asisten AI.']
        },
        'user-chat-view': {
            t: 'Chat Internal', f: 'Obrolan antar kasir, admin, dan owner untuk koordinasi operasional.',
            s: ['Pilih kontak, ketik pesan, atau lampirkan berkas.'], p: []
        },
        'hris-view': {
            t: 'HRIS / Karyawan', f: 'Administrasi karyawan: data & akun, absensi, shift & cuti, kasbon, BPJS, dan penggajian.',
            s: ['Karyawan: tambah data (otomatis menjadi akun login).', 'Absensi: clock in/out dengan PIN.', 'Shift & Cuti, Kasbon, BPJS, dan Penggajian di tab masing-masing; slip gaji bisa dicetak.'],
            p: []
        },
        'documents-view': {
            t: 'Penyimpanan Berkas', f: 'Arsip digital perusahaan dalam folder.',
            s: ['Buat folder, lalu unggah berkas (klik atau seret-lepas, bisa banyak sekaligus).', 'Isi tanggal berlaku untuk dokumen perizinan.', 'Gunakan pencarian dan pengurutan untuk menemukan berkas.'],
            p: []
        },
        'letter-number-view': {
            t: 'Nomor Surat', f: 'Pembuatan nomor surat tanpa nomor ganda, beserta riwayat dan arsip dokumennya.',
            s: ['Pilih jenis surat, lalu buat nomor baru.', 'Lampirkan dokumen ke nomor surat untuk arsip.', 'Atur format dan jenis surat di tab pengaturan.'],
            p: []
        },

        /* ---------------------------------------------------------- Pengaturan (per tab) */
        'settings-view': {
            t: 'Pengaturan', f: 'Pengaturan sistem: profil perusahaan, template WA, WA Gateway, halaman login, saldo awal, pengguna & akses, reset data, dan asisten AI.',
            s: ['Pilih tab di bagian atas sesuai yang ingin diatur.'], p: []
        },
        'settings:profile': {
            t: 'Pengaturan · Profil', f: 'Identitas resmi perusahaan yang tercetak di struk, invoice, laporan, dan dokumen pelaporan.',
            s: ['Isi identitas, kontak, serta data perizinan & pelaporan.', 'Atur Cetak Struk: tambah atau ubah baris teks di atas, di dekat total, atau di bawah struk.', 'Klik Simpan Profil.'],
            p: ['Pastikan data sesuai dokumen perizinan karena dipakai di laporan regulator.']
        },
        'settings:wa': {
            t: 'Pengaturan · Template WA', f: 'Template pesan WhatsApp untuk nota, ucapan terima kasih, kurs, dan pesan lain.',
            s: ['Pilih template untuk diubah, atau buat Template Baru.', 'Gunakan tag seperti [NAMA] dan [NO_HP_MC] agar terisi otomatis.'], p: []
        },
        'settings:wa-gateway': {
            t: 'Pengaturan · WA Gateway', f: 'Sambungan ke penyedia WhatsApp Gateway agar pesan terkirim otomatis dari aplikasi.',
            s: ['Pilih template penyedia atau "Kustom", isi URL, header, dan payload.', 'Klik Tes kirim untuk memastikan berhasil, lalu aktifkan.'],
            p: ['Token disimpan terenkripsi di server.']
        },
        'settings:login': {
            t: 'Pengaturan · Halaman Login', f: 'Tampilan halaman login: nama, logo, teks, motif, dan gambar latar.',
            s: ['Ubah isi, lihat pratinjau, lalu simpan.'], p: ['Warna mengikuti Tema & Tampilan.']
        },
        'settings:balance': {
            t: 'Pengaturan · Saldo Awal', f: 'Saldo awal kas, bank, dan stok valas saat mulai memakai aplikasi.',
            s: ['Isi saldo kas, saldo tiap bank, dan stok awal per valas, lalu simpan.'],
            p: ['Saldo awal menjadi dasar perhitungan laporan dan closing.']
        },
        'settings:users': {
            t: 'Pengaturan · Pengguna & Akses', f: 'Akun pengguna dan hak akses menu per jabatan.',
            s: ['Tambah atau ubah pengguna beserta jabatannya.', 'Atur menu yang boleh dibuka tiap jabatan di editor hak akses.'], p: []
        },
        'settings:danger': {
            t: 'Pengaturan · Danger Zone', f: 'Reset data (transaksi, nasabah, saldo awal, dan lainnya).',
            s: ['Pilih jenis data yang akan direset, lalu ikuti konfirmasinya.'],
            p: ['Reset tidak bisa dibatalkan. Buat cadangan terlebih dahulu.']
        },
        'settings:ai': {
            t: 'Pengaturan · Asisten AI', f: 'API key penyedia AI (Google Gemini / OpenAI) untuk Chat Regulatory AI, OCR identitas, Tanya AI, dan Penerjemah.',
            s: ['Pilih penyedia, tempel API key, lalu klik Tes.'],
            p: ['Key disimpan di peramban perangkat ini, bukan di server.']
        }
    };

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

    function activeView() {
        var list = document.querySelectorAll('section.view-section');
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (!s.classList.contains('hidden') && s.offsetParent !== null) return s.id;
        }
        return '';
    }
    function activeKey() {
        var v = activeView();
        if (v === 'settings-view') {
            var tabs = document.querySelectorAll('.settings-tab-content');
            for (var i = 0; i < tabs.length; i++) {
                var t = tabs[i];
                if (!t.classList.contains('hidden') && t.style.display !== 'none' && t.offsetParent !== null) {
                    var k = 'settings:' + t.id.replace('settings-tab-', '');
                    if (HELP[k]) return k;
                }
            }
        }
        return v;
    }

    function injectStyle() {
        if ($('ph-style')) return;
        var P = 'html body .swal2-popup.ph-pop';
        var st = document.createElement('style'); st.id = 'ph-style';
        st.textContent = [
            'html body #pageHelpBtn{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:26px!important;height:26px!important;margin-left:10px!important;padding:0!important;border-radius:50%!important;border:0!important;background:#2563eb!important;color:#fff!important;opacity:1!important;font-size:.8rem!important;cursor:pointer;vertical-align:middle;flex:0 0 auto;box-shadow:0 2px 8px rgba(37,99,235,.45),0 0 0 3px rgba(37,99,235,.15)!important;transition:transform .15s,box-shadow .15s,background .15s}',
            'html body #pageHelpBtn .ph-i{color:#fff!important;font:800 15px/1 Georgia,"Times New Roman",serif!important;margin-top:1px}',
            'html body #pageHelpBtn:hover,html body #pageHelpBtn:focus-visible{background:#1d4ed8!important;transform:scale(1.08);box-shadow:0 4px 12px rgba(37,99,235,.55),0 0 0 4px rgba(37,99,235,.22)!important;outline:none}',
            '#pageHelpBtn[hidden]{display:none}',
            P + '{padding:0!important;border-radius:20px!important;overflow:hidden;background:#111827!important;border:1px solid #1f2a3c!important;box-shadow:0 30px 80px -20px rgba(0,0,0,.65)!important}',
            P + ' .swal2-html-container{margin:0!important;padding:0!important;color:#e2e8f0!important;font-size:.9rem!important;text-align:left!important}',
            P + ' .swal2-actions{margin:0!important;padding:12px 22px 18px!important;justify-content:flex-end!important;background:#0d1320;border-top:1px solid #1f2a3c}',
            P + ' .ph-head{display:flex!important;gap:14px!important;align-items:flex-start!important;padding:22px 22px 6px!important}',
            P + ' .ph-ico{flex:0 0 42px!important;height:42px!important;border-radius:13px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:rgba(59,130,246,.16)!important;color:#60a5fa!important;box-shadow:inset 0 0 0 1px rgba(59,130,246,.35)!important;font-size:1.1rem!important}',
            P + ' .ph-head>div:last-child{flex:1 1 auto!important;min-width:0!important}',
            P + ' h3.ph-ttl{margin:0!important;color:#f8fafc!important;-webkit-text-fill-color:#f8fafc!important;font-size:1.1rem!important;font-weight:700!important;line-height:1.3!important;background:none!important}',
            P + ' p.ph-sub{margin:4px 0 0!important;color:#cbd5e1!important;-webkit-text-fill-color:#cbd5e1!important;font-size:.86rem!important;line-height:1.55!important;background:none!important}',
            P + ' .ph-body{padding:10px 22px 18px!important;max-height:58vh!important;overflow:auto!important}',
            P + ' .ph-sec{margin-top:12px!important;color:#94a3b8!important;-webkit-text-fill-color:#94a3b8!important;font-size:.72rem!important;font-weight:700!important;letter-spacing:.06em!important;text-transform:uppercase!important}',
            P + ' ol.ph-steps,' + P + ' ul.ph-tips{margin:6px 0 0!important;padding:0!important;list-style:none!important}',
            P + ' ol.ph-steps li{counter-increment:phs;position:relative!important;padding:7px 0 7px 32px!important;color:#e2e8f0!important;-webkit-text-fill-color:#e2e8f0!important;line-height:1.5!important;font-size:.86rem!important;border-bottom:1px solid #1c2638!important}',
            P + ' ol.ph-steps{counter-reset:phs}',
            P + ' ol.ph-steps li::before{content:counter(phs);position:absolute;left:0;top:7px;width:21px;height:21px;border-radius:50%;background:#1e3a8a;color:#bfdbfe;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center}',
            P + ' ul.ph-tips li{position:relative!important;margin-top:6px!important;padding:8px 12px 8px 34px!important;border-radius:10px!important;background:#1a2332!important;color:#e2e8f0!important;-webkit-text-fill-color:#e2e8f0!important;font-size:.84rem!important;line-height:1.5!important}',
            P + ' ul.ph-tips li::before{content:"\\f0eb";font-family:"Font Awesome 6 Free";font-weight:900;position:absolute;left:12px;top:8px;color:#fbbf24}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function show() {
        ensureButton();
        var key = activeKey();
        var h = HELP[key];
        if (!h) {
            var title = ($('pageTitle') && $('pageTitle').textContent) || 'Halaman ini';
            h = { t: title, f: 'Belum ada panduan khusus untuk halaman ini.', s: [], p: [] };
        }
        var html = '<div class="ph-head"><div class="ph-ico"><i class="fa-solid fa-circle-info"></i></div><div><h3 class="ph-ttl">' + esc(h.t) + '</h3><p class="ph-sub">' + esc(h.f) + '</p></div></div><div class="ph-body">' +
            (h.s && h.s.length ? '<div class="ph-sec">Cara pakai</div><ol class="ph-steps">' + h.s.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '') +
            (h.p && h.p.length ? '<div class="ph-sec">Perlu diketahui</div><ul class="ph-tips">' + h.p.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
            '</div>';
        injectStyle();
        if (window.Swal) window.Swal.fire({ html: html, width: 560, customClass: { popup: 'ph-pop' }, confirmButtonText: 'Mengerti', focusConfirm: true });
        else alert(h.t + '\n\n' + h.f + (h.s.length ? '\n\n' + h.s.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n') : ''));
    }

    function ensureButton() {
        var title = $('pageTitle');
        if (!title) return;
        injectStyle();
        var btn = $('pageHelpBtn');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button'; btn.id = 'pageHelpBtn';
            btn.innerHTML = '<span class="ph-i">i</span>';
            btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); show(); });
            title.insertAdjacentElement('afterend', btn);
        } else if (btn.previousElementSibling !== title) {
            title.insertAdjacentElement('afterend', btn);
        }
        var key = activeKey();
        var name = (HELP[key] && HELP[key].t) || title.textContent || 'halaman ini';
        btn.title = 'Info: fungsi & cara pakai ' + name;
        btn.setAttribute('aria-label', btn.title);
    }

    window.mcShowPageHelp = show;
    window.MC_PAGE_HELP = HELP;
    ensureButton();
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.nav-item, .settings-tab-btn')) setTimeout(ensureButton, 150); });
    setInterval(ensureButton, 3000);
})();
