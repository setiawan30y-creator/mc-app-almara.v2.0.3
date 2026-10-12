// Core bootstrap, storage helpers, formatting, and UI shell

const AlmaraApp = window.AlmaraApp = window.AlmaraApp || {};
AlmaraApp.utils = AlmaraApp.utils || {};
AlmaraApp.store = AlmaraApp.store || {};
AlmaraApp.ui = AlmaraApp.ui || {};
AlmaraApp.auth = AlmaraApp.auth || {};

AlmaraApp.utils.safeArrayGet = function(key) { try { let d = JSON.parse(localStorage.getItem(key)); return Array.isArray(d) ? d : []; } catch(e) { return []; } };
window.safeArrayGet = AlmaraApp.utils.safeArrayGet;
if(document.getElementById('jsStatus')) document.getElementById('jsStatus').style.display = 'none';

AlmaraApp.utils.formatDateToDMY = function(dateInput) {
    if(!dateInput || dateInput === '-') return '-';
    let d = new Date(dateInput);
    if(isNaN(d.getTime())) return dateInput;
    let days = String(d.getDate()).padStart(2, '0');
    let months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    let month = months[d.getMonth()];
    let year = d.getFullYear();
    return `${days} ${month} ${year}`;
};
window.formatDateToDMY = AlmaraApp.utils.formatDateToDMY;

// Default Data untuk di-load pertama kali
const DEFAULT_CURRENCIES = [
    { code: 'USD', buy: 15400, sell: 15600, stock: 5000, alert: 1000 },
    { code: 'EUR', buy: 16800, sell: 17100, stock: 3000, alert: 500 },
    { code: 'SGD', buy: 11500, sell: 11700, stock: 8000, alert: 2000 },
    { code: 'AUD', buy: 10100, sell: 10300, stock: 2000, alert: 500 }
];

// Modern Notification Configuration
window.originalAlert = window.alert;
const STANDARD_POPUP_DURATION = 1800;

function shouldAutoDismissSwal(config = {}) {
    if (!config || typeof config !== 'object') return false;
    if (config.toast === false) return false;
    if (config.showCancelButton || config.input) return false;
    if (config.timer || config.timer === 0) return false;
    if (config.showConfirmButton === true) return false;
    return ['success', 'info', 'error'].includes(config.icon);
}

if (typeof Swal !== 'undefined' && !window.__almaraSwalPatched) {
    const originalSwalFire = Swal.fire.bind(Swal);
    Swal.fire = function(...args) {
        if (args.length === 1 && args[0] && typeof args[0] === 'object') {
            const config = { ...args[0] };
            if (shouldAutoDismissSwal(config)) {
                config.timer = STANDARD_POPUP_DURATION;
                config.timerProgressBar = true;
                config.showConfirmButton = false;
            }
            return originalSwalFire(config);
        }

        if (args.length >= 1 && typeof args[0] === 'string') {
            const [title = '', text = '', icon = 'info'] = args;
            if (['success', 'info', 'error'].includes(icon)) {
                return originalSwalFire({
                    title,
                    text,
                    icon,
                    timer: STANDARD_POPUP_DURATION,
                    timerProgressBar: true,
                    showConfirmButton: false
                });
            }
        }

        return originalSwalFire(...args);
    };

    window.__almaraSwalPatched = true;
}

window.alert = function(message) {
    // Fallback if SweetAlert fails to load
    if (typeof Swal === 'undefined') {
        window.originalAlert(message);
        return;
    }

    const popupClass = Swal.mixin({
        position: 'center',
        showConfirmButton: false,
        timer: STANDARD_POPUP_DURATION,
        timerProgressBar: true,
        background: '#1e293b',
        color: '#f8fafc',
    });

    let iconType = 'info';
    let msgLower = (message || '').toString().toLowerCase();
    
    if(msgLower.includes('berhasil') || msgLower.includes('sukses') || msgLower.includes('disimpan')) {
        iconType = 'success';
    } else if(msgLower.includes('gagal') || msgLower.includes('tidak') || msgLower.includes('harap') || msgLower.includes('melampaui') || msgLower.includes('kosong')) {
        iconType = 'error';
    } else if(msgLower.includes('yakin') || msgLower.includes('hapus')) {
        iconType = 'warning';
    }

    popupClass.fire({
        icon: iconType,
        title: message
    });
};

// Inisialisasi Database LocalStorage
const DEFAULT_WA_TEMPLATE = `Halo [NAMA_NASABAH],\n\nTerima kasih telah melakukan penukaran valuta asing di *[NAMA_MC]*.\n\nKami berharap Anda puas dengan layanan kami. Jika ada pertanyaan lebih lanjut atau rencana transaksi berikutnya, jangan ragu untuk menghubungi kami kembali.\n\nSemoga hari Anda menyenangkan!\n\nSalam hangat,\n*[NAMA_MC]*\n[NO_HP_MC]`;
const DEFAULT_WA_TEMPLATES = [
    {
        id: 'wa-default-receipt',
        name: 'Bukti Transaksi',
        category: 'Transaksi',
        isDefault: true,
        content: DEFAULT_WA_TEMPLATE
    },
    {
        id: 'wa-simple-invoice',
        name: 'Ringkas Invoice',
        category: 'Transaksi',
        isDefault: false,
        content: `Halo [NAMA_NASABAH], berikut detail transaksi Anda di [NAMA_MC].\n\nInvoice: [NO_INVOICE]\nTanggal: [TANGGAL]\nRincian:\n[VALUTA_LIST]\nTotal: [GRAND_TOTAL]\nMetode: [METODE_BAYAR]\n\nTerima kasih.`
    }
];
const DEFAULT_PROFILE = { name: 'MC-ALMARA', address: 'Pusat Valuta Asing Terpercaya', phone: '-', phoneWA: '', biLicense: '', footer: 'Terima Kasih Atas Kunjungan Anda', waTemplate: DEFAULT_WA_TEMPLATE };

function getWaGatewayConfig() {
    try {
        const config = JSON.parse(localStorage.getItem('mc_wa_gateway') || '{}');
        return config && typeof config === 'object' ? config : {};
    } catch (error) {
        return {};
    }
}

function normalizeGatewayWhatsAppNumber(phone) {
    let value = String(phone || '').replace(/\D/g, '');
    // Hilangkan awalan panggilan internasional yang kerap disalin dari kontak.
    if (value.startsWith('00')) value = value.slice(2);
    if (value.startsWith('0')) value = '62' + value.slice(1);
    if (value && value.startsWith('8')) value = '62' + value;
    return value;
}

// Satu pintu untuk semua pengiriman WA dari aplikasi.
window.sendWhatsAppGateway = async function(phone, message, options = {}) {
    const config = getWaGatewayConfig();
    const target = normalizeGatewayWhatsAppNumber(phone);
    if (!config.enabled || !config.endpoint || !config.token) {
        throw new Error('WA Gateway belum aktif atau belum lengkap. Buka Pengaturan → WA Gateway.');
    }
    if (!target || target.length < 10 || target.length > 16) {
        throw new Error('Nomor WhatsApp tujuan tidak valid. Gunakan contoh 081234567890 atau 6281234567890.');
    }
    if (!String(message || '').trim()) throw new Error('Pesan WhatsApp tidak boleh kosong.');

    const response = await fetch('api/wa-gateway/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        },
        body: JSON.stringify({
            endpoint: config.endpoint,
            token: config.token,
            provider: config.provider || '',
            method: config.method || 'POST',
            body_format: config.bodyFormat || 'form',
            headers: config.headers || '',
            payload: config.payload || '',
            target,
            message: String(message),
            sender: config.sender || undefined,
            reference: options.reference || undefined
        })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status === 'error') {
        throw new Error(result.message || `Gateway merespons HTTP ${response.status}.`);
    }
    return result;
};

// Membuat pesan WA dari template yang diperuntukkan bagi fitur tertentu.
window.buildWaMessageForPurpose = function(purpose, fallback, values = {}) {
    const profile = typeof getProfile === 'function' ? getProfile() : (DEFAULT_PROFILE || {});
    const template = typeof window.getWaTemplateForPurpose === 'function'
        ? window.getWaTemplateForPurpose(purpose)
        : null;
    const replacements = {
        NAMA_MC: profile.name || 'MC-ALMARA',
        NO_HP_MC: profile.phoneWA || profile.phone || '',
        NAMA_NASABAH: values.customerName || values.name || 'Nasabah',
        PELANGGAN: values.customerName || values.name || 'Nasabah',
        NASABAH: values.customerName || values.name || 'Nasabah',
        NAMA: values.customerName || values.name || 'Nasabah',
        NO_INVOICE: values.invoice || values.reference || '-',
        TANGGAL: values.date || new Date().toLocaleDateString('id-ID'),
        VALUTA_LIST: values.currencyList || values.details || '-',
        GRAND_TOTAL: values.total || '-',
        METODE_BAYAR: values.paymentMethod || '-',
        METODE_RINCIAN: values.paymentDetail || '-'
    };
    let message = String(template?.content || fallback || '');
    Object.entries(replacements).forEach(([tag, value]) => {
        message = message.replace(new RegExp(`\\[${tag}\\]`, 'gi'), String(value ?? ''));
    });
    return message;
};
const MASTER_JOBS_SEED_VERSION = '2026-05-05-rba-jobs';
const MASTER_CITIZENS_SEED_VERSION = '2026-05-05-rba-citizens';
const DEFAULT_JOBS = [
    { name: 'Pegawai Swasta', risk: 'Rendah' },
    { name: 'Pegawai BUMN / BUMD', risk: 'Rendah' },
    { name: 'PNS / ASN Non Strategis', risk: 'Rendah' },
    { name: 'Guru / Dosen', risk: 'Rendah' },
    { name: 'Tenaga Kesehatan', risk: 'Rendah' },
    { name: 'Pelajar / Mahasiswa', risk: 'Rendah' },
    { name: 'Ibu Rumah Tangga / Mengurus Rumah Tangga', risk: 'Rendah' },
    { name: 'Pensiunan', risk: 'Rendah' },
    { name: 'Petani / Peternak / Nelayan', risk: 'Rendah' },
    { name: 'Buruh / Karyawan Harian', risk: 'Rendah' },
    { name: 'Sopir / Pengemudi / Kurir', risk: 'Rendah' },
    { name: 'Freelancer / Pekerja Lepas', risk: 'Sedang' },
    { name: 'Wiraswasta / UMKM', risk: 'Sedang' },
    { name: 'Pedagang Eceran', risk: 'Sedang' },
    { name: 'Pedagang Grosir', risk: 'Sedang' },
    { name: 'Kontraktor / Developer Properti', risk: 'Sedang' },
    { name: 'Agen Properti', risk: 'Sedang' },
    { name: 'Agen Perjalanan / Travel / Haji Umrah', risk: 'Sedang' },
    { name: 'Hotel / Restoran / Hiburan', risk: 'Sedang' },
    { name: 'Eksportir / Importir', risk: 'Sedang' },
    { name: 'Pedagang Online / Marketplace', risk: 'Sedang' },
    { name: 'Konsultan Bisnis', risk: 'Sedang' },
    { name: 'Akuntan / Auditor / Konsultan Pajak', risk: 'Sedang' },
    { name: 'Pengacara / Notaris / PPAT', risk: 'Sedang' },
    { name: 'Perantara / Broker / Komisioner', risk: 'Sedang' },
    { name: 'Investor / Trader Saham / Kripto', risk: 'Sedang' },
    { name: 'Pegawai Bank / Lembaga Keuangan', risk: 'Sedang' },
    { name: 'Asuransi / Pembiayaan / Leasing', risk: 'Sedang' },
    { name: 'Pegawai Money Changer / KUPVA', risk: 'Sedang' },
    { name: 'Pedagang Valuta Asing / Remitansi Informal', risk: 'Tinggi' },
    { name: 'Pedagang Emas / Logam Mulia / Permata', risk: 'Tinggi' },
    { name: 'Pedagang Barang Mewah / Jam / Mobil Mewah', risk: 'Tinggi' },
    { name: 'Pertambangan / Mineral / Batubara', risk: 'Tinggi' },
    { name: 'Perkebunan / Komoditas Bernilai Tinggi', risk: 'Sedang' },
    { name: 'Jasa Keamanan / Militer Swasta', risk: 'Sedang' },
    { name: 'TNI / POLRI Non PEP', risk: 'Sedang' },
    { name: 'Pejabat Negara / Penyelenggara Negara / PEP', risk: 'Tinggi' },
    { name: 'Kepala Daerah / Anggota DPR / DPRD / Partai Politik', risk: 'Tinggi' },
    { name: 'Pengurus Partai Politik / Tim Sukses Politik', risk: 'Tinggi' },
    { name: 'Hakim / Jaksa / Pejabat Penegak Hukum Strategis', risk: 'Tinggi' },
    { name: 'Direksi / Komisaris BUMN Strategis', risk: 'Tinggi' },
    { name: 'Pengurus Yayasan / LSM / Organisasi Donasi', risk: 'Sedang' },
    { name: 'Rohaniawan / Pengurus Organisasi Keagamaan', risk: 'Sedang' },
    { name: 'Artis / Influencer / Public Figure', risk: 'Sedang' },
    { name: 'Pekerja Migran Indonesia', risk: 'Sedang' },
    { name: 'Warga Negara Asing Bekerja di Indonesia', risk: 'Sedang' },
    { name: 'Tidak Bekerja', risk: 'Sedang' },
    { name: 'Pekerjaan Tidak Jelas / Tidak Dapat Dijelaskan', risk: 'Tinggi' },
    { name: 'Lainnya', risk: 'Sedang' }
];
const DEFAULT_CITIZENS = [
    { name: 'WNI / Indonesia', risk: 'Rendah' },
    { name: 'Singapura', risk: 'Rendah' },
    { name: 'Malaysia', risk: 'Rendah' },
    { name: 'Brunei Darussalam', risk: 'Rendah' },
    { name: 'Thailand', risk: 'Rendah' },
    { name: 'Jepang', risk: 'Rendah' },
    { name: 'Korea Selatan', risk: 'Rendah' },
    { name: 'Australia', risk: 'Rendah' },
    { name: 'Selandia Baru', risk: 'Rendah' },
    { name: 'Amerika Serikat', risk: 'Rendah' },
    { name: 'Kanada', risk: 'Rendah' },
    { name: 'Inggris / Britania Raya', risk: 'Rendah' },
    { name: 'Uni Eropa / EEA', risk: 'Rendah' },
    { name: 'Swiss', risk: 'Rendah' },
    { name: 'Hong Kong', risk: 'Rendah' },
    { name: 'Taiwan', risk: 'Rendah' },
    { name: 'Filipina', risk: 'Sedang' },
    { name: 'Kamboja', risk: 'Sedang' },
    { name: 'India', risk: 'Sedang' },
    { name: 'Pakistan', risk: 'Sedang' },
    { name: 'Bangladesh', risk: 'Sedang' },
    { name: 'Sri Lanka', risk: 'Sedang' },
    { name: 'China', risk: 'Sedang' },
    { name: 'Makau', risk: 'Sedang' },
    { name: 'Timor Leste', risk: 'Sedang' },
    { name: 'Arab Saudi', risk: 'Sedang' },
    { name: 'Uni Emirat Arab', risk: 'Sedang' },
    { name: 'Qatar', risk: 'Sedang' },
    { name: 'Turki', risk: 'Sedang' },
    { name: 'Rusia', risk: 'Sedang' },
    { name: 'Ukraina', risk: 'Sedang' },
    { name: 'Brazil', risk: 'Sedang' },
    { name: 'Meksiko', risk: 'Sedang' },
    { name: 'Afrika Selatan', risk: 'Sedang' },
    { name: 'Algeria', risk: 'Sedang' },
    { name: 'Angola', risk: 'Sedang' },
    { name: 'Bolivia', risk: 'Sedang' },
    { name: 'Bulgaria', risk: 'Sedang' },
    { name: 'Cameroon', risk: 'Sedang' },
    { name: 'Cote d’Ivoire / Pantai Gading', risk: 'Sedang' },
    { name: 'Democratic Republic of the Congo', risk: 'Sedang' },
    { name: 'Haiti', risk: 'Sedang' },
    { name: 'Kenya', risk: 'Sedang' },
    { name: 'Kuwait', risk: 'Sedang' },
    { name: 'Laos / Lao PDR', risk: 'Sedang' },
    { name: 'Lebanon', risk: 'Sedang' },
    { name: 'Monaco', risk: 'Sedang' },
    { name: 'Namibia', risk: 'Sedang' },
    { name: 'Nepal', risk: 'Sedang' },
    { name: 'Papua New Guinea', risk: 'Sedang' },
    { name: 'South Sudan', risk: 'Sedang' },
    { name: 'Syria', risk: 'Sedang' },
    { name: 'Venezuela', risk: 'Sedang' },
    { name: 'Vietnam', risk: 'Sedang' },
    { name: 'British Virgin Islands', risk: 'Sedang' },
    { name: 'Yemen', risk: 'Sedang' },
    { name: 'Iran', risk: 'Tinggi' },
    { name: 'Korea Utara / DPRK', risk: 'Tinggi' },
    { name: 'Myanmar', risk: 'Tinggi' },
    { name: 'WNA - Negara Tidak Disebutkan', risk: 'Sedang' },
    { name: 'Tidak Diketahui / Tidak Dapat Diverifikasi', risk: 'Tinggi' }
];

const DEFAULT_MASTER_CURRENCIES = [
    { code: 'USD', country: 'Amerika Serikat', countryCode: 'US', symbol: '$' },
    { code: 'EUR', country: 'Uni Eropa', countryCode: 'EU', symbol: 'EUR' },
    { code: 'SGD', country: 'Singapura', countryCode: 'SG', symbol: 'S$' },
    { code: 'AUD', country: 'Australia', countryCode: 'AU', symbol: 'A$' },
    { code: 'MYR', country: 'Malaysia', countryCode: 'MY', symbol: 'RM' },
    { code: 'JPY', country: 'Jepang', countryCode: 'JP', symbol: 'JPY' },
    { code: 'GBP', country: 'Inggris', countryCode: 'GB', symbol: 'GBP' },
    { code: 'SAR', country: 'Arab Saudi', countryCode: 'SA', symbol: 'SAR' },
    { code: 'HKD', country: 'Hong Kong', countryCode: 'HK', symbol: 'HK$' },
    { code: 'CNY', country: 'China', countryCode: 'CN', symbol: 'CNY' },
    { code: 'THB', country: 'Thailand', countryCode: 'TH', symbol: 'THB' },
    { code: 'CAD', country: 'Kanada', countryCode: 'CA', symbol: 'C$' },
    { code: 'NZD', country: 'Selandia Baru', countryCode: 'NZ', symbol: 'NZ$' },
    { code: 'KRW', country: 'Korea Selatan', countryCode: 'KR', symbol: 'KRW' },
    { code: 'CHF', country: 'Swiss', countryCode: 'CH', symbol: 'Fr' },
    { code: 'INR', country: 'India', countryCode: 'IN', symbol: 'INR' },
    { code: 'PHP', country: 'Filipina', countryCode: 'PH', symbol: 'PHP' },
    { code: 'VND', country: 'Vietnam', countryCode: 'VN', symbol: 'VND' },
    { code: 'TWD', country: 'Taiwan', countryCode: 'TW', symbol: 'NT$' },
    { code: 'EGP', country: 'Mesir', countryCode: 'EG', symbol: 'EGP' },
    { code: 'TRY', country: 'Turki', countryCode: 'TR', symbol: 'TRY' },
    { code: 'KHR', country: 'Kamboja', countryCode: 'KH', symbol: 'KHR' },
    { code: 'DKK', country: 'Denmark', countryCode: 'DK', symbol: 'kr' },
    { code: 'AED', country: 'Uni Emirat Arab', countryCode: 'AE', symbol: 'AED' },
    { code: 'MOP', country: 'Makau', countryCode: 'MO', symbol: 'MOP$' },
    { code: 'BHD', country: 'Bahrain', countryCode: 'BH', symbol: 'BHD' },
    { code: 'BND', country: 'Brunei', countryCode: 'BN', symbol: 'B$' },
    { code: 'RUB', country: 'Rusia', countryCode: 'RU', symbol: 'RUB' },
    { code: 'KWD', country: 'Kuwait', countryCode: 'KW', symbol: 'KWD' },
    { code: 'OMR', country: 'Oman', countryCode: 'OM', symbol: 'OMR' },
    { code: 'JOD', country: 'Yordania', countryCode: 'JO', symbol: 'JOD' }
];

const DEFAULT_ROLE_PERMISSIONS = {
    owner: {
        menus: ['dashboard-view','pos-view','demo-pos-view','customers-view','mutation-view','currency-view','closing-view','letter-number-view','harian-view','laporan-posisi-valuta-view','reports-view','audit-view','booking-view','valas-gallery-view','documents-view','ai-chat-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-ekuitas-view','laporan-coretax-view','masterdata-view','settings-view'],
        special: { menuKeuangan: true, menuBi: true, userManagement: true, accessSettings: true, dangerZone: true, customerImportTools: true, transactionLedgerCard: true, oldMoneySupplierManagement: true, closingHistoryReset: true },
        actions: { edit: true, delete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: true, oldMoneyEdit: true, oldMoneyDelete: true }
    },
    superadmin: {
        menus: ['dashboard-view','pos-view','demo-pos-view','customers-view','mutation-view','currency-view','closing-view','letter-number-view','harian-view','laporan-posisi-valuta-view','reports-view','audit-view','booking-view','valas-gallery-view','documents-view','ai-chat-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-ekuitas-view','laporan-coretax-view','masterdata-view','settings-view'],
        special: { menuKeuangan: true, menuBi: true, userManagement: true, accessSettings: true, dangerZone: true, customerImportTools: true, transactionLedgerCard: true, oldMoneySupplierManagement: true, closingHistoryReset: true },
        actions: { edit: true, delete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: true, oldMoneyEdit: true, oldMoneyDelete: true }
    },
    admin: {
        menus: ['dashboard-view','pos-view','demo-pos-view','customers-view','mutation-view','currency-view','closing-view','letter-number-view','harian-view','laporan-posisi-valuta-view','reports-view','audit-view','booking-view','valas-gallery-view','documents-view','ai-chat-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-ekuitas-view','laporan-coretax-view','masterdata-view','settings-view'],
        special: { menuKeuangan: true, menuBi: true, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: true, transactionLedgerCard: true, oldMoneySupplierManagement: true, closingHistoryReset: false },
        actions: { edit: true, delete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: false, oldMoneyEdit: true, oldMoneyDelete: true }
    },
    kasir: {
        menus: ['dashboard-view','pos-view','customers-view','mutation-view','closing-view','harian-view','reports-view','valas-gallery-view','documents-view','ai-chat-view','gantungan-view','old-money-view','masterdata-view','settings-view'],
        special: { menuKeuangan: false, menuBi: false, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: false, transactionLedgerCard: false, oldMoneySupplierManagement: false, closingHistoryReset: false },
        actions: { edit: false, delete: false, export: false, print: false, profit: false, valasProfit: false, trxDate: false, manualInvoice: false, oldMoneyEdit: false, oldMoneyDelete: false }
    },
    teller: {
        menus: ['dashboard-view','pos-view','customers-view','mutation-view','closing-view','harian-view','reports-view','valas-gallery-view','documents-view','ai-chat-view','gantungan-view','old-money-view','masterdata-view','settings-view'],
        special: { menuKeuangan: false, menuBi: false, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: false, transactionLedgerCard: false, oldMoneySupplierManagement: false, closingHistoryReset: false },
        actions: { edit: false, delete: false, export: false, print: false, profit: false, valasProfit: false, trxDate: false, manualInvoice: false, oldMoneyEdit: false, oldMoneyDelete: false }
    },
    papan: {
        menus: [],
        special: { menuKeuangan: false, menuBi: false, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: false, transactionLedgerCard: false, oldMoneySupplierManagement: false, closingHistoryReset: false },
        actions: { edit: false, delete: false, export: false, print: false, profit: false, valasProfit: false, trxDate: false, manualInvoice: false, oldMoneyEdit: false, oldMoneyDelete: false }
    }
};

const DEFAULT_ISO_4217_REFERENCE = [
    { code: 'AED', country: 'Uni Emirat Arab', countryCode: 'AE', symbol: 'AED', currencyName: 'UAE dirham' },
    { code: 'AFN', country: 'Afghanistan', countryCode: 'AF', symbol: 'AFN', currencyName: 'Afghani' },
    { code: 'ALL', country: 'Albania', countryCode: 'AL', symbol: 'ALL', currencyName: 'Lek' },
    { code: 'AMD', country: 'Armenia', countryCode: 'AM', symbol: 'AMD', currencyName: 'Armenian dram' },
    { code: 'ANG', country: 'Curacao & Sint Maarten', countryCode: 'CW', symbol: 'ANG', currencyName: 'Netherlands Antillean guilder' },
    { code: 'AOA', country: 'Angola', countryCode: 'AO', symbol: 'AOA', currencyName: 'Kwanza' },
    { code: 'ARS', country: 'Argentina', countryCode: 'AR', symbol: 'ARS', currencyName: 'Argentine peso' },
    { code: 'AUD', country: 'Australia', countryCode: 'AU', symbol: 'A$', currencyName: 'Australian dollar' },
    { code: 'AWG', country: 'Aruba', countryCode: 'AW', symbol: 'AWG', currencyName: 'Aruban florin' },
    { code: 'AZN', country: 'Azerbaijan', countryCode: 'AZ', symbol: 'AZN', currencyName: 'Azerbaijan manat' },
    { code: 'BAM', country: 'Bosnia dan Herzegovina', countryCode: 'BA', symbol: 'BAM', currencyName: 'Convertible mark' },
    { code: 'BBD', country: 'Barbados', countryCode: 'BB', symbol: 'BBD', currencyName: 'Barbados dollar' },
    { code: 'BDT', country: 'Bangladesh', countryCode: 'BD', symbol: 'BDT', currencyName: 'Taka' },
    { code: 'BGN', country: 'Bulgaria', countryCode: 'BG', symbol: 'BGN', currencyName: 'Bulgarian lev' },
    { code: 'BHD', country: 'Bahrain', countryCode: 'BH', symbol: 'BHD', currencyName: 'Bahraini dinar' },
    { code: 'BIF', country: 'Burundi', countryCode: 'BI', symbol: 'BIF', currencyName: 'Burundian franc' },
    { code: 'BMD', country: 'Bermuda', countryCode: 'BM', symbol: 'BMD', currencyName: 'Bermudian dollar' },
    { code: 'BND', country: 'Brunei', countryCode: 'BN', symbol: 'B$', currencyName: 'Brunei dollar' },
    { code: 'BOB', country: 'Bolivia', countryCode: 'BO', symbol: 'BOB', currencyName: 'Boliviano' },
    { code: 'BRL', country: 'Brasil', countryCode: 'BR', symbol: 'R$', currencyName: 'Brazilian real' },
    { code: 'BSD', country: 'Bahama', countryCode: 'BS', symbol: 'BSD', currencyName: 'Bahamian dollar' },
    { code: 'BTN', country: 'Bhutan', countryCode: 'BT', symbol: 'BTN', currencyName: 'Ngultrum' },
    { code: 'BWP', country: 'Botswana', countryCode: 'BW', symbol: 'BWP', currencyName: 'Pula' },
    { code: 'BYN', country: 'Belarus', countryCode: 'BY', symbol: 'BYN', currencyName: 'Belarusian ruble' },
    { code: 'CAD', country: 'Kanada', countryCode: 'CA', symbol: 'C$', currencyName: 'Canadian dollar' },
    { code: 'CHF', country: 'Swiss', countryCode: 'CH', symbol: 'Fr', currencyName: 'Swiss franc' },
    { code: 'CLP', country: 'Chile', countryCode: 'CL', symbol: 'CLP', currencyName: 'Chilean peso' },
    { code: 'CNY', country: 'China', countryCode: 'CN', symbol: 'CNY', currencyName: 'Yuan renminbi' },
    { code: 'COP', country: 'Kolombia', countryCode: 'CO', symbol: 'COP', currencyName: 'Colombian peso' },
    { code: 'CRC', country: 'Kosta Rika', countryCode: 'CR', symbol: 'CRC', currencyName: 'Costa Rican colon' },
    { code: 'CZK', country: 'Republik Ceko', countryCode: 'CZ', symbol: 'CZK', currencyName: 'Czech koruna' },
    { code: 'DKK', country: 'Denmark', countryCode: 'DK', symbol: 'kr', currencyName: 'Danish krone' },
    { code: 'DOP', country: 'Republik Dominika', countryCode: 'DO', symbol: 'DOP', currencyName: 'Dominican peso' },
    { code: 'DZD', country: 'Aljazair', countryCode: 'DZ', symbol: 'DZD', currencyName: 'Algerian dinar' },
    { code: 'EGP', country: 'Mesir', countryCode: 'EG', symbol: 'EGP', currencyName: 'Egyptian pound' },
    { code: 'ETB', country: 'Ethiopia', countryCode: 'ET', symbol: 'ETB', currencyName: 'Ethiopian birr' },
    { code: 'EUR', country: 'Uni Eropa', countryCode: 'EU', symbol: 'EUR', currencyName: 'Euro' },
    { code: 'FJD', country: 'Fiji', countryCode: 'FJ', symbol: 'FJD', currencyName: 'Fiji dollar' },
    { code: 'GBP', country: 'Inggris', countryCode: 'GB', symbol: 'GBP', currencyName: 'Pound sterling' },
    { code: 'GEL', country: 'Georgia', countryCode: 'GE', symbol: 'GEL', currencyName: 'Lari' },
    { code: 'GHS', country: 'Ghana', countryCode: 'GH', symbol: 'GHS', currencyName: 'Ghana cedi' },
    { code: 'HKD', country: 'Hong Kong', countryCode: 'HK', symbol: 'HK$', currencyName: 'Hong Kong dollar' },
    { code: 'HUF', country: 'Hungaria', countryCode: 'HU', symbol: 'HUF', currencyName: 'Forint' },
    { code: 'IDR', country: 'Indonesia', countryCode: 'ID', symbol: 'Rp', currencyName: 'Rupiah' },
    { code: 'ILS', country: 'Israel', countryCode: 'IL', symbol: 'ILS', currencyName: 'New Israeli shekel' },
    { code: 'INR', country: 'India', countryCode: 'IN', symbol: 'INR', currencyName: 'Indian rupee' },
    { code: 'IQD', country: 'Irak', countryCode: 'IQ', symbol: 'IQD', currencyName: 'Iraqi dinar' },
    { code: 'ISK', country: 'Islandia', countryCode: 'IS', symbol: 'ISK', currencyName: 'Iceland krona' },
    { code: 'JMD', country: 'Jamaika', countryCode: 'JM', symbol: 'JMD', currencyName: 'Jamaican dollar' },
    { code: 'JOD', country: 'Yordania', countryCode: 'JO', symbol: 'JOD', currencyName: 'Jordanian dinar' },
    { code: 'JPY', country: 'Jepang', countryCode: 'JP', symbol: 'JPY', currencyName: 'Yen' },
    { code: 'KES', country: 'Kenya', countryCode: 'KE', symbol: 'KES', currencyName: 'Kenyan shilling' },
    { code: 'KHR', country: 'Kamboja', countryCode: 'KH', symbol: 'KHR', currencyName: 'Riel' },
    { code: 'KRW', country: 'Korea Selatan', countryCode: 'KR', symbol: 'KRW', currencyName: 'Won' },
    { code: 'KWD', country: 'Kuwait', countryCode: 'KW', symbol: 'KWD', currencyName: 'Kuwaiti dinar' },
    { code: 'KZT', country: 'Kazakhstan', countryCode: 'KZ', symbol: 'KZT', currencyName: 'Tenge' },
    { code: 'LAK', country: 'Laos', countryCode: 'LA', symbol: 'LAK', currencyName: 'Lao kip' },
    { code: 'LKR', country: 'Sri Lanka', countryCode: 'LK', symbol: 'LKR', currencyName: 'Sri Lanka rupee' },
    { code: 'MAD', country: 'Maroko', countryCode: 'MA', symbol: 'MAD', currencyName: 'Moroccan dirham' },
    { code: 'MMK', country: 'Myanmar', countryCode: 'MM', symbol: 'MMK', currencyName: 'Kyat' },
    { code: 'MNT', country: 'Mongolia', countryCode: 'MN', symbol: 'MNT', currencyName: 'Tugrik' },
    { code: 'MOP', country: 'Makau', countryCode: 'MO', symbol: 'MOP$', currencyName: 'Pataca' },
    { code: 'MXN', country: 'Meksiko', countryCode: 'MX', symbol: 'MXN', currencyName: 'Mexican peso' },
    { code: 'MYR', country: 'Malaysia', countryCode: 'MY', symbol: 'RM', currencyName: 'Malaysian ringgit' },
    { code: 'NGN', country: 'Nigeria', countryCode: 'NG', symbol: 'NGN', currencyName: 'Naira' },
    { code: 'NOK', country: 'Norwegia', countryCode: 'NO', symbol: 'NOK', currencyName: 'Norwegian krone' },
    { code: 'NPR', country: 'Nepal', countryCode: 'NP', symbol: 'NPR', currencyName: 'Nepalese rupee' },
    { code: 'NZD', country: 'Selandia Baru', countryCode: 'NZ', symbol: 'NZ$', currencyName: 'New Zealand dollar' },
    { code: 'OMR', country: 'Oman', countryCode: 'OM', symbol: 'OMR', currencyName: 'Rial Omani' },
    { code: 'PEN', country: 'Peru', countryCode: 'PE', symbol: 'PEN', currencyName: 'Sol' },
    { code: 'PHP', country: 'Filipina', countryCode: 'PH', symbol: 'PHP', currencyName: 'Philippine peso' },
    { code: 'PKR', country: 'Pakistan', countryCode: 'PK', symbol: 'PKR', currencyName: 'Pakistan rupee' },
    { code: 'PLN', country: 'Polandia', countryCode: 'PL', symbol: 'PLN', currencyName: 'Zloty' },
    { code: 'QAR', country: 'Qatar', countryCode: 'QA', symbol: 'QAR', currencyName: 'Qatari riyal' },
    { code: 'RON', country: 'Rumania', countryCode: 'RO', symbol: 'RON', currencyName: 'Romanian leu' },
    { code: 'RSD', country: 'Serbia', countryCode: 'RS', symbol: 'RSD', currencyName: 'Serbian dinar' },
    { code: 'RUB', country: 'Rusia', countryCode: 'RU', symbol: 'RUB', currencyName: 'Russian ruble' },
    { code: 'SAR', country: 'Arab Saudi', countryCode: 'SA', symbol: 'SAR', currencyName: 'Saudi riyal' },
    { code: 'SEK', country: 'Swedia', countryCode: 'SE', symbol: 'SEK', currencyName: 'Swedish krona' },
    { code: 'SGD', country: 'Singapura', countryCode: 'SG', symbol: 'S$', currencyName: 'Singapore dollar' },
    { code: 'THB', country: 'Thailand', countryCode: 'TH', symbol: 'THB', currencyName: 'Baht' },
    { code: 'TND', country: 'Tunisia', countryCode: 'TN', symbol: 'TND', currencyName: 'Tunisian dinar' },
    { code: 'TRY', country: 'Turki', countryCode: 'TR', symbol: 'TRY', currencyName: 'Turkish lira' },
    { code: 'TWD', country: 'Taiwan', countryCode: 'TW', symbol: 'NT$', currencyName: 'New Taiwan dollar' },
    { code: 'UAH', country: 'Ukraina', countryCode: 'UA', symbol: 'UAH', currencyName: 'Hryvnia' },
    { code: 'USD', country: 'Amerika Serikat', countryCode: 'US', symbol: '$', currencyName: 'US dollar' },
    { code: 'UYU', country: 'Uruguay', countryCode: 'UY', symbol: 'UYU', currencyName: 'Peso uruguayo' },
    { code: 'VND', country: 'Vietnam', countryCode: 'VN', symbol: 'VND', currencyName: 'Dong' },
    { code: 'XAF', country: 'CEMAC', countryCode: 'CM', symbol: 'XAF', currencyName: 'CFA franc BEAC' },
    { code: 'XCD', country: 'Karibia Timur', countryCode: 'AG', symbol: 'XCD', currencyName: 'East Caribbean dollar' },
    { code: 'XOF', country: 'Afrika Barat', countryCode: 'SN', symbol: 'XOF', currencyName: 'CFA franc BCEAO' },
    { code: 'XPF', country: 'Pasifik Prancis', countryCode: 'PF', symbol: 'XPF', currencyName: 'CFP franc' },
    { code: 'ZAR', country: 'Afrika Selatan', countryCode: 'ZA', symbol: 'ZAR', currencyName: 'Rand' }
];

function buildFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '';

    return countryCode
        .toUpperCase()
        .split('')
        .map(char => String.fromCodePoint(127397 + char.charCodeAt(0)))
        .join('');
}

function normalizeMasterCurrency(item) {
    if (!item || !item.code) return null;

    const fallback = DEFAULT_MASTER_CURRENCIES.find(entry => entry.code === item.code) || {};
    const countryCode = (item.countryCode || fallback.countryCode || '').toUpperCase();

    return {
        ...fallback,
        ...item,
        countryCode,
        symbol: item.symbol || fallback.symbol || item.code,
        flag: buildFlagEmoji(countryCode),
    };
}

function ensureRekapValutaMenuPermission(permissions) {
    ['owner', 'superadmin', 'admin', 'kasir', 'teller'].forEach(role => {
        if(!permissions[role]) permissions[role] = {};
        if(!Array.isArray(permissions[role].menus)) {
            permissions[role].menus = [...(DEFAULT_ROLE_PERMISSIONS[role]?.menus || [])];
        }
        
        // Pastikan laporan-posisi-valuta-view ada di owner, superadmin, dan admin
        if((role === 'owner' || role === 'superadmin' || role === 'admin') && !permissions[role].menus.includes('laporan-posisi-valuta-view')) {
            const harianIndex = permissions[role].menus.indexOf('harian-view');
            if(harianIndex >= 0) permissions[role].menus.splice(harianIndex + 1, 0, 'laporan-posisi-valuta-view');
            else permissions[role].menus.push('laporan-posisi-valuta-view');
        }

        // Pastikan valas-gallery-view ada di semua role
        if(!permissions[role].menus.includes('valas-gallery-view')) {
            const bookingIndex = permissions[role].menus.indexOf('booking-view');
            if(bookingIndex >= 0) permissions[role].menus.splice(bookingIndex + 1, 0, 'valas-gallery-view');
            else permissions[role].menus.push('valas-gallery-view');
        }

        // Pastikan documents-view ada di semua role
        if(!permissions[role].menus.includes('documents-view')) {
            const bookingIndex = permissions[role].menus.indexOf('booking-view');
            if(bookingIndex >= 0) permissions[role].menus.splice(bookingIndex + 1, 0, 'documents-view');
            else permissions[role].menus.push('documents-view');
        }

        // Pastikan ai-chat-view ada di semua role
        if(!permissions[role].menus.includes('ai-chat-view')) {
            const docIndex = permissions[role].menus.indexOf('documents-view');
            if(docIndex >= 0) permissions[role].menus.splice(docIndex + 1, 0, 'ai-chat-view');
            else permissions[role].menus.push('ai-chat-view');
        }

        // Pastikan gantungan-view ada di semua role
        if(!permissions[role].menus.includes('gantungan-view')) {
            const valasIndex = permissions[role].menus.indexOf('valas-gallery-view');
            if(valasIndex >= 0) permissions[role].menus.splice(valasIndex + 1, 0, 'gantungan-view');
            else permissions[role].menus.push('gantungan-view');
        }

        // Pastikan pickup-view ada di semua role
        if(!permissions[role].menus.includes('pickup-view')) {
            const gantunganIndex = permissions[role].menus.indexOf('gantungan-view');
            if(gantunganIndex >= 0) permissions[role].menus.splice(gantunganIndex + 1, 0, 'pickup-view');
            else permissions[role].menus.push('pickup-view');
        }
    });
    return permissions;
}

// One-time rollout: existing installations receive Nomor Surat in
// management roles without overwriting any other custom permissions.
function ensureLetterNumberMenuPermission(permissions) {
    const migrationKey = 'mc_letter_number_menu_permission_migrated_v1';
    if (localStorage.getItem(migrationKey) === 'true') return permissions;

    ['owner', 'superadmin', 'admin'].forEach(role => {
        if (!permissions[role]) permissions[role] = {};
        if (!Array.isArray(permissions[role].menus)) {
            permissions[role].menus = [...(DEFAULT_ROLE_PERMISSIONS[role]?.menus || [])];
        }
        if (!permissions[role].menus.includes('letter-number-view')) {
            const currencyIndex = permissions[role].menus.indexOf('currency-view');
            permissions[role].menus.splice(
                currencyIndex >= 0 ? currencyIndex + 1 : permissions[role].menus.length,
                0,
                'letter-number-view'
            );
        }
    });

    localStorage.setItem('mc_role_permissions', JSON.stringify(permissions));
    localStorage.setItem(migrationKey, 'true');
    return permissions;
}

// One-time default rollout: existing installations receive the demo menu for
// management roles, then it remains fully editable in Setting Hak Akses.
function ensureDemoPosMenuPermission(permissions) {
    const migrationKey = 'mc_demo_pos_menu_permission_migrated_v1';
    if (localStorage.getItem(migrationKey) === 'true') return permissions;
    ['owner', 'superadmin', 'admin'].forEach(role => {
        if (!Array.isArray(permissions[role]?.menus) || permissions[role].menus.includes('demo-pos-view')) return;
        const posIndex = permissions[role].menus.indexOf('pos-view');
        permissions[role].menus.splice(posIndex >= 0 ? posIndex + 1 : permissions[role].menus.length, 0, 'demo-pos-view');
    });
    localStorage.setItem('mc_role_permissions', JSON.stringify(permissions));
    localStorage.setItem(migrationKey, 'true');
    return permissions;
}

// Restores Closing Harian after earlier role-setting snapshots accidentally
// omitted it. It remains configurable per role after this one-time recovery.
function ensureClosingMenuPermission(permissions) {
    const migrationKey = 'mc_closing_menu_permission_restored_v1';
    if (localStorage.getItem(migrationKey) === 'true') return permissions;
    ['owner', 'superadmin', 'admin', 'kasir', 'teller'].forEach(role => {
        if (!permissions[role]) permissions[role] = {};
        if (!Array.isArray(permissions[role].menus)) {
            permissions[role].menus = [...(DEFAULT_ROLE_PERMISSIONS[role]?.menus || [])];
            return;
        }
        if (!permissions[role].menus.includes('closing-view')) {
            const mutationIndex = permissions[role].menus.indexOf('mutation-view');
            permissions[role].menus.splice(mutationIndex >= 0 ? mutationIndex + 1 : permissions[role].menus.length, 0, 'closing-view');
        }
    });
    localStorage.setItem('mc_role_permissions', JSON.stringify(permissions));
    localStorage.setItem(migrationKey, 'true');
    return permissions;
}

function initDB() {
    if(!localStorage.getItem('mc_currencies')) localStorage.setItem('mc_currencies', JSON.stringify(DEFAULT_CURRENCIES));
    if(!localStorage.getItem('mc_transactions')) localStorage.setItem('mc_transactions', JSON.stringify([]));
    if(!localStorage.getItem('mc_cash')) localStorage.setItem('mc_cash', '500000000'); // Laci Kasir
    if(localStorage.getItem('mc_bank')) {
        let oldBank = localStorage.getItem('mc_bank');
        localStorage.setItem('mc_bank_bca', oldBank);
        localStorage.removeItem('mc_bank');
    }
    if(!localStorage.getItem('mc_bank_bca')) localStorage.setItem('mc_bank_bca', '0'); // Saldo Bank BCA
    if(!localStorage.getItem('mc_bank_mandiri')) localStorage.setItem('mc_bank_mandiri', '0'); // Saldo Bank Mandiri
    if(!localStorage.getItem('mc_customers')) localStorage.setItem('mc_customers', JSON.stringify([]));
    if(!localStorage.getItem('mc_assets')) localStorage.setItem('mc_assets', JSON.stringify([]));
    if(!localStorage.getItem('mc_mutations')) localStorage.setItem('mc_mutations', JSON.stringify([]));
    if(!localStorage.getItem('mc_expenses')) localStorage.setItem('mc_expenses', JSON.stringify([]));
    if(!localStorage.getItem('mc_closings')) localStorage.setItem('mc_closings', JSON.stringify([]));
    if(!localStorage.getItem('mc_adjustments')) localStorage.setItem('mc_adjustments', JSON.stringify([]));
    if(!localStorage.getItem('mc_profile')) localStorage.setItem('mc_profile', JSON.stringify(DEFAULT_PROFILE));
    if(!localStorage.getItem('mc_wa_templates')) localStorage.setItem('mc_wa_templates', JSON.stringify(DEFAULT_WA_TEMPLATES));
    if(!localStorage.getItem('mc_bi_rates')) localStorage.setItem('mc_bi_rates', JSON.stringify([]));
    if(!localStorage.getItem('mc_master_jobs')) localStorage.setItem('mc_master_jobs', JSON.stringify(DEFAULT_JOBS));
    if(!localStorage.getItem('mc_master_citizenships')) localStorage.setItem('mc_master_citizenships', JSON.stringify(DEFAULT_CITIZENS));
    if(!localStorage.getItem('mc_master_currencies')) localStorage.setItem('mc_master_currencies', JSON.stringify(DEFAULT_MASTER_CURRENCIES));
    if(!localStorage.getItem('mc_role_permissions')) localStorage.setItem('mc_role_permissions', JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    if(localStorage.getItem('mc_letter_number_menu_permission_migrated_v1') !== 'true') {
        try {
            const permissions = ensureLetterNumberMenuPermission(JSON.parse(localStorage.getItem('mc_role_permissions')) || DEFAULT_ROLE_PERMISSIONS);
            localStorage.setItem('mc_role_permissions', JSON.stringify(permissions));
        } catch(e) {
            console.warn('Gagal migrasi akses Nomor Surat:', e);
        }
    }
    if(localStorage.getItem('mc_rekap_valuta_permission_migrated_v2') !== 'true') {
        try {
            const permissions = ensureRekapValutaMenuPermission(JSON.parse(localStorage.getItem('mc_role_permissions')) || DEFAULT_ROLE_PERMISSIONS);
            localStorage.setItem('mc_role_permissions', JSON.stringify(permissions));
            localStorage.setItem('mc_rekap_valuta_permission_migrated_v2', 'true');
        } catch(e) {
            console.warn('Gagal migrasi akses Rekap Valuta:', e);
        }
    }
    if(localStorage.getItem('mc_valas_gallery_permission_migrated') !== 'true') {
        try {
            const permissions = ensureRekapValutaMenuPermission(JSON.parse(localStorage.getItem('mc_role_permissions')) || DEFAULT_ROLE_PERMISSIONS);
            localStorage.setItem('mc_role_permissions', JSON.stringify(permissions));
            localStorage.setItem('mc_valas_gallery_permission_migrated', 'true');
        } catch(e) {
            console.warn('Gagal migrasi akses Galeri Valas:', e);
        }
    }
    if(localStorage.getItem('mc_gantungan_permission_migrated') !== 'true') {
        try {
            const permissions = ensureRekapValutaMenuPermission(JSON.parse(localStorage.getItem('mc_role_permissions')) || DEFAULT_ROLE_PERMISSIONS);
            localStorage.setItem('mc_role_permissions', JSON.stringify(permissions));
            localStorage.setItem('mc_gantungan_permission_migrated', 'true');
        } catch(e) {
            console.warn('Gagal migrasi akses Catatan Gantungan:', e);
        }
    }
    
    // Koin & Uang Kertas Lama (Isolated Storage)
    if(!localStorage.getItem('mc_old_money_cash')) localStorage.setItem('mc_old_money_cash', '0');
    if(!localStorage.getItem('mc_old_money_stock')) localStorage.setItem('mc_old_money_stock', JSON.stringify([]));
    if(!localStorage.getItem('mc_old_money_suppliers')) localStorage.setItem('mc_old_money_suppliers', JSON.stringify([]));
    if(!localStorage.getItem('mc_old_money_trxs')) localStorage.setItem('mc_old_money_trxs', JSON.stringify([]));
    
    // Catatan Gantungan Rp
    if(!localStorage.getItem('mc_gantungans')) localStorage.setItem('mc_gantungans', JSON.stringify([]));
    
    if(!localStorage.getItem('mc_users')) localStorage.setItem('mc_users', JSON.stringify([]));

    if(!localStorage.getItem('mc_currentUser')) localStorage.setItem('mc_currentUser', JSON.stringify(null));
}

// Get Data
function getCurrencies() { return window.safeArrayGet('mc_currencies'); }
function isBookingRow(row) {
    return row && (row.status === 'PENDING' || row.tipe_transaksi === 'BOOKING' || String(row.id || '').startsWith('BKG-'));
}
function getTransactions() { return window.safeArrayGet('mc_transactions').filter(row => !isBookingRow(row)); }
function getBookings() {
    const bookings = window.safeArrayGet('mc_bookings');
    const legacyBookings = window.safeArrayGet('mc_transactions').filter(isBookingRow);
    const merged = new Map();
    [...legacyBookings, ...bookings].forEach(row => {
        if(!row) return;
        merged.set(row.itemId || `${row.id}-${row.valuta}-${row.nominal}`, row);
    });
    return Array.from(merged.values());
}
function getCash() { return parseInt(localStorage.getItem('mc_cash')) || 0; }
function getBankBCA() { return parseInt(localStorage.getItem('mc_bank_bca')) || 0; }
function getBankMandiri() { return parseInt(localStorage.getItem('mc_bank_mandiri')) || 0; }
function getCustomers() {
    const cachedCustomers = window.safeArrayGet('mc_customers');
    if(cachedCustomers.length > 0) {
        if(Array.isArray(window.__mcCustomersMemory) && window.__mcCustomersMemory.length > 0) {
            const memoryById = new Map(window.__mcCustomersMemory.map(c => [String(c.id_nasabah || ''), c]));
            return cachedCustomers.map(c => {
                const memoryCustomer = memoryById.get(String(c.id_nasabah || ''));
                if(memoryCustomer && !c.foto_id && memoryCustomer.foto_id) {
                    return { ...c, foto_id: memoryCustomer.foto_id };
                }
                return c;
            });
        }
        return cachedCustomers;
    }
    if(localStorage.getItem('mc_customers_reset_at')) return [];
    return Array.isArray(window.__mcCustomersMemory) ? window.__mcCustomersMemory : [];
}
function getAssets() { return window.safeArrayGet('mc_assets'); }
function getMutations() { return window.safeArrayGet('mc_mutations'); }
function getExpenses() { return window.safeArrayGet('mc_expenses'); }
function getClosings() { return window.safeArrayGet('mc_closings'); }
function getAdjustments() { return window.safeArrayGet('mc_adjustments'); }
function getProfile() { return JSON.parse(localStorage.getItem('mc_profile')) || DEFAULT_PROFILE; }
function getWaTemplates() { return window.safeArrayGet('mc_wa_templates'); }
function getBiRates() { return window.safeArrayGet('mc_bi_rates'); }
function getMasterJobs() { 
    let jobs = JSON.parse(localStorage.getItem('mc_master_jobs')) || DEFAULT_JOBS;
    jobs = jobs.map(j => typeof j === 'string' ? { name: j, risk: 'Rendah' } : { name: j.name || '', risk: j.risk || 'Rendah' }).filter(j => j.name);

    if(localStorage.getItem('mc_master_jobs_seed_version') !== MASTER_JOBS_SEED_VERSION) {
        const existing = new Set(jobs.map(j => String(j.name).trim().toLowerCase()));
        DEFAULT_JOBS.forEach(defaultJob => {
            if(!existing.has(defaultJob.name.toLowerCase())) {
                jobs.push({ ...defaultJob });
            }
        });
        localStorage.setItem('mc_master_jobs_seed_version', MASTER_JOBS_SEED_VERSION);
        saveMasterJobs(jobs);
    }

    return jobs;
}
function getMasterCitizens() { 
    let citizens = JSON.parse(localStorage.getItem('mc_master_citizenships')) || DEFAULT_CITIZENS;
    citizens = citizens.map(c => typeof c === 'string' ? { name: c, risk: c === 'WNA' ? 'Sedang' : 'Rendah' } : { name: c.name || '', risk: c.risk || 'Rendah' }).filter(c => c.name);

    if(localStorage.getItem('mc_master_citizens_seed_version') !== MASTER_CITIZENS_SEED_VERSION) {
        const existing = new Set(citizens.map(c => String(c.name).trim().toLowerCase()));
        DEFAULT_CITIZENS.forEach(defaultCitizen => {
            if(!existing.has(defaultCitizen.name.toLowerCase())) {
                citizens.push({ ...defaultCitizen });
            }
        });
        localStorage.setItem('mc_master_citizens_seed_version', MASTER_CITIZENS_SEED_VERSION);
        saveMasterCitizens(citizens);
    }

    return citizens;
}
function getMasterCurrencies() { 
    let stored = JSON.parse(localStorage.getItem('mc_master_currencies'));
    if (!stored || stored.length === 0) {
        return DEFAULT_MASTER_CURRENCIES.map(normalizeMasterCurrency).filter(Boolean);
    }
    
    let updated = false;
    DEFAULT_MASTER_CURRENCIES.forEach(dc => {
        if (!stored.find(sc => sc.code === dc.code)) {
            stored.push(dc);
            updated = true;
        }
    });

    const normalized = stored.map(normalizeMasterCurrency).filter(Boolean);
    if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
        updated = true;
    }

    if (updated) {
        saveMasterCurrencies(normalized);
    }
    return normalized;
}

function getIso4217Reference() {
    const mergedMap = new Map();

    DEFAULT_ISO_4217_REFERENCE.forEach(item => {
        const normalized = normalizeMasterCurrency(item);
        if (normalized) {
            mergedMap.set(normalized.code, normalized);
        }
    });

    getMasterCurrencies().forEach(item => {
        const existing = mergedMap.get(item.code) || {};
        mergedMap.set(item.code, {
            ...existing,
            ...item,
            currencyName: existing.currencyName || item.country || item.code,
            flag: item.flag || existing.flag || '',
        });
    });

    return Array.from(mergedMap.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function getRolePermissions() {
    const stored = ensureClosingMenuPermission(ensureDemoPosMenuPermission(ensureRekapValutaMenuPermission(JSON.parse(localStorage.getItem('mc_role_permissions')) || {})));
    const merged = {};
    Object.keys(DEFAULT_ROLE_PERMISSIONS).forEach(role => {
        merged[role] = {
            menus: Array.isArray(stored[role]?.menus) ? stored[role].menus : DEFAULT_ROLE_PERMISSIONS[role].menus,
            special: {
                ...DEFAULT_ROLE_PERMISSIONS[role].special,
                ...(stored[role]?.special || {})
            },
            actions: {
                ...DEFAULT_ROLE_PERMISSIONS[role].actions,
                ...(stored[role]?.actions || {})
            },
        };
    });
    return merged;
}

window.getFlagHtml = function(code) {
    const arr = getMasterCurrencies();
    const displayCode = String(code || '');
    const upperCode = displayCode.toUpperCase();
    const baseCode = upperCode.substring(0, 3);
    const f = arr.find(m => String(m.code || '').toUpperCase() === upperCode)
        || arr.find(m => String(m.code || '').toUpperCase() === baseCode);
    return f && f.flag ? `<span class="currency-flag">${f.flag} </span> ` + displayCode : displayCode;
}

// Save Data
function saveCurrencies(data) {
    window.__almaraLastLocalCurrencyWriteAt = Date.now();

    // Deteksi tren naik/turun dengan membandingkan nilai lama di localStorage.
    let oldCurrencies = [];
    try {
        oldCurrencies = JSON.parse(localStorage.getItem('mc_currencies')) || [];
    } catch(e) {
        oldCurrencies = [];
    }

    const oldMap = {};
    oldCurrencies.forEach(o => {
        if (o && o.code) {
            oldMap[o.code.toUpperCase()] = {
                buy: parseFloat(o.buy) || 0,
                trend: o.trend || 'flat'
            };
        }
    });

    if (Array.isArray(data)) {
        data.forEach(c => {
            if (!c || !c.code) return;
            const cCode = String(c.code).toUpperCase();
            const old = oldMap[cCode];
            if (old) {
                const newBuy = parseFloat(c.buy) || 0;
                if (newBuy > old.buy) {
                    c.trend = 'up';
                } else if (newBuy < old.buy) {
                    c.trend = 'down';
                } else {
                    c.trend = old.trend || 'flat';
                }
            } else {
                c.trend = 'flat';
            }
        });
    }

    localStorage.setItem('mc_currencies', JSON.stringify(data));

    // Sinkronisasi ke MySQL. Return Promise agar form master dapat menunggu
    // hasil server dan menampilkan pesan gagal yang benar kepada pengguna.
    if (typeof saveToMySQL_Currency === 'function' && Array.isArray(data)) {
        const promises = data
            .filter(c => c && c.code)
            .map(c => Promise.resolve().then(() => saveToMySQL_Currency(c)));
        return Promise.allSettled(promises);
    }

    return Promise.resolve([]);
}

function saveTransactions(data) { 
    // Ambil data lama sebelum ditimpa, untuk mencari mana yang transaksi baru saja ditambahkan
    let oldData = window.safeArrayGet('mc_transactions');
    window.__almaraLastLocalTransactionWriteAt = Date.now();
    const normalizeTrxTime = (trx) => {
        const raw = trx && (trx.timestamp || trx.date || trx.createdAt || trx.created_at);
        if (!raw) return 0;
        const normalized = String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T');
        const time = new Date(normalized).getTime();
        return Number.isNaN(time) ? 0 : time;
    };
    const normalizedData = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
        const diff = normalizeTrxTime(b) - normalizeTrxTime(a);
        if (diff !== 0) return diff;
        return String(a?.itemId || a?.id || '').localeCompare(String(b?.itemId || b?.id || ''));
    });
    localStorage.setItem('mc_transactions', JSON.stringify(normalizedData)); 
    window.__almaraLocalTransactionSnapshot = JSON.stringify(normalizedData);
    
    // Sinkronsiasi otomatis transaksi BARU ke MySQL
    if(typeof saveToMySQL_Transaction === 'function' && !window.__almaraSuppressAutoTransactionPush && normalizedData.length > oldData.length) {
        const oldKeys = oldData.map(t => t.itemId || t.id);
        const newTrxs = normalizedData.filter(t => !oldKeys.includes(t.itemId || t.id));
        newTrxs.forEach(t => saveToMySQL_Transaction(t));
    }
}
function saveBookings(data) {
    localStorage.setItem('mc_bookings', JSON.stringify(Array.isArray(data) ? data : []));
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_bookings', data);
}

async function getServerTransactionsLikeRwt() {
    try {
        const response = await fetch('api/transactions', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch transactions');
        const data = await response.json();
        const parsed = (Array.isArray(data) ? data : []).map(row => {
            let itemObj = {};
            if(row && row.raw_json) {
                try { 
                    itemObj = JSON.parse(row.raw_json) || {}; 
                } catch(e) {}
            }
            const merged = { ...row, ...itemObj };
            merged.synced = true;
            return merged;
        });
        return parsed.filter(row => !isBookingRow(row));
    } catch (error) {
        console.warn('Server transaction fetch failed, fallback to local cache:', error);
        return getTransactions();
    }
}

window.getServerTransactionsLikeRwt = getServerTransactionsLikeRwt;

async function refreshTransactionsThen(renderFn) {
    try {
        if (typeof syncFromMySQL_Transactions === 'function') {
            await syncFromMySQL_Transactions({ pushLocal: false, refreshUi: false, silent: true, force: true });
        }
    } catch (error) {
        console.warn('Forced transaction refresh skipped:', error);
    }
    if (typeof renderFn === 'function') {
        const result = renderFn();
        if (result && typeof result.then === 'function') await result;
    }
}
function saveCash(amount) { 
    localStorage.setItem('mc_cash', amount.toString()); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_cash', amount);
}
function saveBankBCA(amount) { 
    localStorage.setItem('mc_bank_bca', amount.toString()); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_bank_bca', amount);
}
function saveBankMandiri(amount) { 
    localStorage.setItem('mc_bank_mandiri', amount.toString()); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_bank_mandiri', amount);
}
function saveCustomers(data) { 
    window.__mcCustomersMemory = Array.isArray(data) ? data : [];
    window.__almaraLastLocalCustomerWriteAt = Date.now();
    const compactData = window.__mcCustomersMemory.map(customer => {
        if(!customer || typeof customer !== 'object') return customer;
        const next = { ...customer };
        if(typeof next.foto_id === 'string' && next.foto_id.length > 5000) delete next.foto_id;
        return next;
    });
    localStorage.setItem('mc_customers', JSON.stringify(compactData)); 
}
function saveAssets(data) { 
    localStorage.setItem('mc_assets', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_assets', data);
}
function saveMutations(data) { 
    localStorage.setItem('mc_mutations', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_mutations', data);
}
function saveExpenses(data) { 
    localStorage.setItem('mc_expenses', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_expenses', data);
}
function saveClosings(data) { 
    localStorage.setItem('mc_closings', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_closings', data);
}
function saveAdjustments(data) { 
    localStorage.setItem('mc_adjustments', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_adjustments', data);
}
function saveProfile(data) { 
    localStorage.setItem('mc_profile', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_profile', data);
}
function saveWaTemplates(data) {
    localStorage.setItem('mc_wa_templates', JSON.stringify(data));
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_wa_templates', data);
}
function saveBiRates(data) {
    localStorage.removeItem('mc_bi_rates_reset_at');
    localStorage.setItem('mc_bi_rates', JSON.stringify(data));
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_bi_rates', data);
}
function saveMasterJobs(data) { 
    localStorage.setItem('mc_master_jobs', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_master_jobs', data);
}
function saveMasterCitizens(data) { 
    localStorage.setItem('mc_master_citizenships', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_master_citizenships', data);
}
function saveMasterCurrencies(data) { 
    localStorage.setItem('mc_master_currencies', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_master_currencies', data);
}
function saveRolePermissions(data) {
    localStorage.setItem('mc_role_permissions', JSON.stringify(data));
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_role_permissions', data);
}

window.getIso4217Reference = getIso4217Reference;




// Get & Save for HRIS Module
function getHrisEmployees() { return window.safeArrayGet('mc_hris_employees'); }
function saveHrisEmployees(data) { 
    localStorage.setItem('mc_hris_employees', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_hris_employees', data);
}
function getHrisAttendance() { return window.safeArrayGet('mc_hris_attendance'); }
function saveHrisAttendance(data) { 
    localStorage.setItem('mc_hris_attendance', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_hris_attendance', data);
}
function getHrisKasbon() { return window.safeArrayGet('mc_hris_kasbon'); }
function saveHrisKasbon(data) { 
    localStorage.setItem('mc_hris_kasbon', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_hris_kasbon', data);
}
function getHrisBpjs() { return window.safeArrayGet('mc_hris_bpjs'); }
function saveHrisBpjs(data) { 
    localStorage.setItem('mc_hris_bpjs', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_hris_bpjs', data);
}
function getHrisLeave() { return window.safeArrayGet('mc_hris_leave'); }
function saveHrisLeaveStorage(data) { 
    localStorage.setItem('mc_hris_leave', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_hris_leave', data);
}

function getUsers() { return window.safeArrayGet('mc_users'); }
function saveUsers(data) { 
    const publicUsers = (Array.isArray(data) ? data : []).map(user => {
        if(!user || typeof user !== 'object') return user;
        const next = { ...user };
        delete next.password;
        return next;
    });
    localStorage.setItem('mc_users', JSON.stringify(publicUsers)); 
}
function getCurrentUser() { return JSON.parse(localStorage.getItem('mc_currentUser')); }
function setCurrentUser(user) { 
    localStorage.setItem('mc_currentUser', JSON.stringify(user)); 
}

Object.assign(AlmaraApp.store, {
    initDB,
    getCurrencies,
    getTransactions,
    getBookings,
    getCash,
    getBankBCA,
    getBankMandiri,
    getCustomers,
    getAssets,
    getMutations,
    getExpenses,
    getClosings,
    getAdjustments,
    getProfile,
    getWaTemplates,
    getBiRates,
    getMasterJobs,
    getMasterCitizens,
    getMasterCurrencies,
    getIso4217Reference,
    getRolePermissions,
    saveCurrencies,
    saveTransactions,
    saveBookings,
    saveCash,
    saveBankBCA,
    saveBankMandiri,
    saveCustomers,
    saveAssets,
    saveMutations,
    saveExpenses,
    saveClosings,
    saveAdjustments,
    saveProfile,
    saveWaTemplates,
    saveBiRates,
    saveMasterJobs,
    saveMasterCitizens,
    saveMasterCurrencies,
    saveRolePermissions,
    getHrisEmployees,
    saveHrisEmployees,
    getHrisAttendance,
    saveHrisAttendance,
    getHrisKasbon,
    saveHrisKasbon,
    getHrisBpjs,
    saveHrisBpjs,
    getHrisLeave,
    saveHrisLeaveStorage,
});

Object.assign(AlmaraApp.auth, {
    getUsers,
    saveUsers,
    getCurrentUser,
    setCurrentUser,
});

Object.assign(AlmaraApp.utils, {
    buildFlagEmoji,
    normalizeMasterCurrency,
    getFlagHtml: window.getFlagHtml,
});
// UI Accordion Toggle
window.toggleNavMenu = function(menuId) {
    const menu = document.getElementById(menuId);
    const icon = document.getElementById('icon-' + menuId);
    if(menu.style.display === 'none') {
        menu.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        menu.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

AlmaraApp.ui.toggleNavMenu = window.toggleNavMenu;

// State Management
let currentCart = [];
let currentCustPhotoBase64 = '';

// Format Rupiah (Tanpa Desimal - Konsolidasi Global)
AlmaraApp.utils.formatIdr = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }).format(angka);
};
window.formatIdr = AlmaraApp.utils.formatIdr;

// Alias formatRupiah dan formatRp untuk kompatibilitas ke belakang
AlmaraApp.utils.formatRupiah = AlmaraApp.utils.formatIdr;
window.formatRupiah = AlmaraApp.utils.formatRupiah;
AlmaraApp.utils.formatRp = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return '0';
    return new Intl.NumberFormat('id-ID').format(angka);
};
window.formatRp = AlmaraApp.utils.formatRp;

// Fungsi binding event yang aman (mencegah crash jika elemen tidak ada)
AlmaraApp.utils.safeAddListener = function(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, callback);
        return true;
    }
    return false;
};
window.safeAddListener = AlmaraApp.utils.safeAddListener;

// Format Kurs
AlmaraApp.utils.formatRate = function(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(angka);
};
const formatRate = AlmaraApp.utils.formatRate;

// Update Jam Real-time
setInterval(() => {
    const now = new Date();
    document.getElementById('liveClock').textContent = now.toLocaleTimeString('id-ID');
    const liveDateEl = document.getElementById('liveDate');
    if(liveDateEl) {
        liveDateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
}, 1000);

const HEADER_WEATHER_CODE_MAP = {
    0: { label: 'Cerah', icon: 'fa-sun' },
    1: { label: 'Cerah', icon: 'fa-sun' },
    2: { label: 'Cerah berawan', icon: 'fa-cloud-sun' },
    3: { label: 'Mendung', icon: 'fa-cloud' },
    45: { label: 'Berkabut', icon: 'fa-smog' },
    48: { label: 'Berkabut', icon: 'fa-smog' },
    51: { label: 'Gerimis', icon: 'fa-cloud-rain' },
    53: { label: 'Gerimis', icon: 'fa-cloud-rain' },
    55: { label: 'Gerimis', icon: 'fa-cloud-rain' },
    61: { label: 'Hujan ringan', icon: 'fa-cloud-showers-heavy' },
    63: { label: 'Hujan', icon: 'fa-cloud-showers-heavy' },
    65: { label: 'Hujan lebat', icon: 'fa-cloud-showers-heavy' },
    66: { label: 'Hujan beku', icon: 'fa-snowflake' },
    67: { label: 'Hujan beku', icon: 'fa-snowflake' },
    71: { label: 'Salju ringan', icon: 'fa-snowflake' },
    73: { label: 'Salju', icon: 'fa-snowflake' },
    75: { label: 'Salju lebat', icon: 'fa-snowflake' },
    77: { label: 'Butiran es', icon: 'fa-snowflake' },
    80: { label: 'Hujan lokal', icon: 'fa-cloud-rain' },
    81: { label: 'Hujan lokal', icon: 'fa-cloud-rain' },
    82: { label: 'Hujan lebat', icon: 'fa-cloud-showers-heavy' },
    85: { label: 'Salju ringan', icon: 'fa-snowflake' },
    86: { label: 'Salju lebat', icon: 'fa-snowflake' },
    95: { label: 'Badai petir', icon: 'fa-bolt' },
    96: { label: 'Badai petir', icon: 'fa-bolt' },
    99: { label: 'Badai petir', icon: 'fa-bolt' },
};

function updateHeaderChip(id, iconClass, text) {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = el.querySelector('i');
    const label = el.querySelector('span');
    if (icon) icon.className = `fa-solid ${iconClass}`;
    if (label) label.textContent = text;
}

async function refreshHeaderWeatherAndLocation() {
    const locationFallback = '-';
    const weatherFallback = '-';

    updateHeaderChip('headerLocationWidget', 'fa-location-dot', locationFallback);
    updateHeaderChip('headerWeatherWidget', 'fa-cloud-sun', weatherFallback);

    if (!window.isSecureContext) {
        updateHeaderChip('headerLocationWidget', 'fa-lock', 'Perlu HTTPS');
        updateHeaderChip('headerWeatherWidget', 'fa-cloud-sun', '-');
        return;
    }

    if (!navigator.geolocation) {
        updateHeaderChip('headerLocationWidget', 'fa-circle-xmark', 'Lokasi tidak didukung');
        updateHeaderChip('headerWeatherWidget', 'fa-cloud-sun', '-');
        return;
    }

    const timeoutId = setTimeout(() => {
        updateHeaderChip('headerLocationWidget', 'fa-triangle-exclamation', 'Lokasi timeout');
    }, 9000);

    navigator.geolocation.getCurrentPosition(async function(position) {
        clearTimeout(timeoutId);

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
            /* Do not let a failed geocoding request hide a valid GPS position
               or a successful weather response. */
            const [weatherResult, locationResult, detailedLocationResult] = await Promise.allSettled([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,is_day&timezone=auto`, { cache: 'no-store' }),
                fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&language=id&count=1`, { cache: 'no-store' }),
                fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1&accept-language=id`, { cache: 'no-store' })
            ]);

            const weatherResponse = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
            const locationResponse = locationResult.status === 'fulfilled' ? locationResult.value : null;
            const detailedLocationResponse = detailedLocationResult.status === 'fulfilled' ? detailedLocationResult.value : null;
            const weatherData = weatherResponse && weatherResponse.ok ? await weatherResponse.json() : null;
            const locationData = locationResponse && locationResponse.ok ? await locationResponse.json() : null;
            const detailedLocationData = detailedLocationResponse && detailedLocationResponse.ok ? await detailedLocationResponse.json() : null;

            const place = locationData && Array.isArray(locationData.results) && locationData.results.length > 0 ? locationData.results[0] : null;
            const address = detailedLocationData && detailedLocationData.address ? detailedLocationData.address : null;
            const areaName = address && (
                address.village || address.suburb || address.neighbourhood || address.quarter || address.city_district
            );
            const cityName = address && (
                address.city || address.town || address.municipality || address.county || address.regency
            );
            const detailedPlaceLabel = areaName
                ? (cityName && areaName.toLowerCase() !== cityName.toLowerCase() ? `${areaName}, ${cityName}` : areaName)
                : cityName;
            const placeLabel = detailedPlaceLabel || (place
                ? [place.name, place.admin1, place.country].filter(Boolean).join(', ')
                : `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`);

            const current = weatherData && weatherData.current ? weatherData.current : null;
            const weatherCode = current && typeof current.weather_code !== 'undefined' ? Number(current.weather_code) : null;
            const weatherMeta = weatherCode !== null && HEADER_WEATHER_CODE_MAP[weatherCode]
                ? HEADER_WEATHER_CODE_MAP[weatherCode]
                : { label: 'Cuaca', icon: 'fa-cloud-sun' };
            const temperature = current && typeof current.temperature_2m !== 'undefined'
                ? `${Math.round(Number(current.temperature_2m))}°C`
                : '';
            const weatherText = temperature
                ? `${weatherMeta.label} ${temperature}`
                : (weatherData ? weatherMeta.label : 'Tidak tersedia');

            updateHeaderChip('headerLocationWidget', 'fa-location-dot', placeLabel);
            updateHeaderChip('headerWeatherWidget', weatherMeta.icon, weatherText);
        } catch (error) {
            console.warn('Gagal memuat widget lokasi/cuaca:', error);
            updateHeaderChip('headerLocationWidget', 'fa-location-dot', `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`);
            updateHeaderChip('headerWeatherWidget', 'fa-cloud-sun', 'Tidak tersedia');
        }
    }, function(error) {
        clearTimeout(timeoutId);
        console.warn('Geolocation ditolak / gagal:', error);
        updateHeaderChip('headerLocationWidget', 'fa-location-dot', 'Izin lokasi ditolak');
        updateHeaderChip('headerWeatherWidget', 'fa-cloud-sun', 'Tidak tersedia');
    }, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000
    });
}

/* Tap/click widgets to retry without reloading the whole application. */
window.refreshHeaderWeatherAndLocation = refreshHeaderWeatherAndLocation;
['headerLocationWidget', 'headerWeatherWidget'].forEach(function(id) {
    const widget = document.getElementById(id);
    if (!widget) return;
    widget.style.cursor = 'pointer';
    widget.title = 'Ketuk untuk memperbarui lokasi dan cuaca';
    widget.addEventListener('click', refreshHeaderWeatherAndLocation);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshHeaderWeatherAndLocation);
} else {
    refreshHeaderWeatherAndLocation();
}

setInterval(() => {
    if (document.visibilityState === 'visible') {
        refreshHeaderWeatherAndLocation();
    }
}, 30 * 60 * 1000);

window.updateHeaderNotificationBadge = function() {
    const badge = document.getElementById('stockAlertBadge');
    if (!badge) return;

    const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
    const stockAlertsCount = currencies.filter(c => (c.stock || 0) <= (c.alert || 0)).length;
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const role = String(currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
    const allLimitRequests = window.safeArrayGet ? window.safeArrayGet('mc_pos_limit_approvals') : [];
    const pendingLimitCount = (role === 'owner' || role === 'admin')
        ? allLimitRequests.filter(req => req && req.status === 'pending').length
        : 0;
    const total = stockAlertsCount + pendingLimitCount;

    badge.textContent = total > 0 ? total : '';
    badge.style.display = total > 0 ? 'block' : 'none';
};
setInterval(() => {
    if (typeof window.updateHeaderNotificationBadge === 'function') window.updateHeaderNotificationBadge();
}, 5000);

window.showStockAlertModal = function() {
    const currencies = getCurrencies();
    let issues = currencies.filter(c => (c.stock || 0) <= (c.alert || 0));
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const role = String(currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
    const pendingLimitRequests = (role === 'owner' || role === 'admin')
        ? (window.safeArrayGet ? window.safeArrayGet('mc_pos_limit_approvals') : []).filter(req => req && req.status === 'pending')
        : [];
    
    if(issues.length === 0 && pendingLimitRequests.length === 0) {
        if(typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Notifikasi Kosong',
                text: 'Tidak ada stok minimum dan tidak ada permintaan approval limit.',
                background: '#1e293b',
                color: '#f8fafc',
                confirmButtonColor: '#3B82F6'
            });
        }
        return;
    }
    
    let html = '';
    if (pendingLimitRequests.length > 0) {
        html += '<div style="text-align:left; margin-bottom:14px;"><strong style="color:#fbbf24;">Approval Limit Transaksi</strong></div>';
        pendingLimitRequests.forEach(req => {
            html += `<div style="text-align:left; padding:10px; margin-bottom:10px; border:1px solid rgba(251,191,36,0.35); border-radius:8px; background:rgba(251,191,36,0.08);">
                <div><strong>${req.customerName || req.customerId}</strong> <span style="color:#94a3b8;">(${req.customerId || '-'})</span></div>
                <div style="font-size:0.86rem; color:#cbd5e1; margin-top:4px;">
                    Bulan: ${req.monthKey || '-'}<br>
                    Limit: ${formatIdr(req.limit || 0)} | Terpakai: ${formatIdr(req.used || 0)} | Tambahan: ${formatIdr(req.pending || 0)}<br>
                    Diminta oleh: ${req.requestedBy || '-'}<br>
                    Underlying: ${req.underlying || '-'}
                </div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.approvePosLimitRequest('${req.id}'); Swal.close();">
                        <i class="fa-solid fa-check"></i> Setujui
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="window.rejectPosLimitRequest('${req.id}'); Swal.close();">
                        <i class="fa-solid fa-xmark"></i> Tolak
                    </button>
                </div>
            </div>`;
        });
    }

    if (issues.length > 0) {
        html += '<div style="text-align:left; margin:12px 0 6px;"><strong style="color:#ef4444;">Peringatan Limit Stok</strong></div>';
        html += '<ul style="text-align:left; font-size: 0.95rem; line-height: 1.6;">';
        issues.forEach(c => {
            html += `<li style="margin-bottom:8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
                <strong style="color: #ef4444;">${c.code}</strong>: Sisa ${(c.stock || 0).toLocaleString()} <span style="font-size: 0.8rem; color:#94A3B8;">(Limit: ${(c.alert || 0).toLocaleString()})</span>
            </li>`;
        });
        html += '</ul>';
    }
    
    if(typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Notifikasi',
            html: html,
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#3B82F6',
            confirmButtonText: 'Tutup'
        });
    } else {
        alert("Peringatan Stok Minimum:\n" + issues.map(c => `${c.code}: Sisa ${c.stock} (Limit ${c.alert})`).join('\n'));
    }
};
AlmaraApp.ui.showStockAlertModal = window.showStockAlertModal;

// Routing & UI Interaction
window.toggleTheme = function() {
    const isLightMode = document.body.classList.toggle('light-theme');
    localStorage.setItem('mc_light_theme', isLightMode);
    const btnIcon = document.getElementById('themeToggleIcon');
    if(btnIcon) {
        if(isLightMode) btnIcon.className = 'fa-solid fa-moon';
        else btnIcon.className = 'fa-solid fa-sun';
    }
}
AlmaraApp.ui.toggleTheme = window.toggleTheme;

window.formatDateOnly = function(dateStr) {
    if(!dateStr || dateStr === '-') return '-';
    try {
        const d = new Date(dateStr);
        if(isNaN(d.getTime())) return dateStr;
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch(e) { return dateStr; }
};
AlmaraApp.utils.formatDateOnly = window.formatDateOnly;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof flatpickr !== 'undefined') {
        flatpickr("input[type=date]", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d M Y",
            allowInput: true,
            locale: "id"
        });
    }

    if(localStorage.getItem('mc_light_theme') === 'true') {
        document.body.classList.add('light-theme');
        const btnIcon = document.getElementById('themeToggleIcon');
        if(btnIcon) btnIcon.className = 'fa-solid fa-moon';
    }
    
    initDB();
    
    // Check Auth Before Anything Else - Wrapped in try-catch to prevent blocking UI listeners
    try {
        checkAuth();
    } catch (e) {
        console.error("Auth / RBAC init failed but continuing to bind UI:", e);
    }

    // Setup Sidebar Menu Toggle
    console.log("Initializing Sidebar Navigation Listeners...");
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if (!targetId) {
                // Biarkan navigasi link eksternal/normal berjalan (tidak mencegah default)
                return;
            }
            e.preventDefault();
            
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active to clicked nav
            item.classList.add('active');

            // Hide all views
            views.forEach(v => {
                v.classList.add('hidden');
                v.classList.remove('active');
            });

            // Show target view
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
            
            // Update Title text
            pageTitle.textContent = item.textContent.trim();
            
            // Close sidebar automatically on mobile
            if(window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }

            // Load specific view data
            if(targetId === 'dashboard-view') refreshTransactionsThen(() => loadDashboard());
            if(targetId === 'pos-view' && typeof loadPosForm === 'function') loadPosForm();
            if(targetId === 'demo-pos-view' && typeof window.loadDemoPos === 'function') window.loadDemoPos();
            if(targetId === 'booking-view' && typeof loadBookingsTable === 'function') loadBookingsTable();
            if(targetId === 'currency-view' && typeof loadCurrencyTable === 'function') loadCurrencyTable();
            if(targetId === 'kurs-hari-ini-view' && typeof loadKursHariIniTable === 'function') loadKursHariIniTable();
            if(targetId === 'adjustment-view' && typeof loadAdjustmentsTable === 'function') loadAdjustmentsTable();
            if(targetId === 'harian-view') loadLaporanHarian();
            if(targetId === 'reports-view') refreshTransactionsThen(() => loadReportsTable());
            if(targetId === 'laporan-lku-view') {
                const periodEl = document.getElementById('lkuReportPeriod');
                const todayPeriod = new Date().toISOString().split('T')[0].substring(0, 7);
                if(periodEl && !periodEl.value) periodEl.value = todayPeriod;
                if(typeof applyLkuPeriodToDates === 'function') applyLkuPeriodToDates(periodEl?.value || todayPeriod);
                if(typeof initBiRatesPanel === 'function') initBiRatesPanel();
                loadLaporanLku();
            }
            if(targetId === 'laporan-posisi-valuta-view' && typeof initLaporanPosisiValuta === 'function') {
                initLaporanPosisiValuta();
            }
            if(targetId === 'laporan-granular-view') {
                const today = new Date().toISOString().split('T')[0];
                if(!document.getElementById('granularStartDate').value) document.getElementById('granularStartDate').value = today;
                if(!document.getElementById('granularEndDate').value) document.getElementById('granularEndDate').value = today;
                loadLaporanGranular();
            }
            if(targetId === 'laporan-sipesat-view') {
                const today = new Date().toISOString().split('T')[0];
                if(!document.getElementById('sipesatStartDate').value) document.getElementById('sipesatStartDate').value = today;
                if(!document.getElementById('sipesatEndDate').value) document.getElementById('sipesatEndDate').value = today;
                loadLaporanSipesat();
            }
            if(targetId === 'laporan-bukubesar-view') {
                const d = new Date();
                if(document.getElementById('ledgerYear').options.length === 0) populateMonthYearSelects('ledgerMonth', 'ledgerYear');
                loadBukuBesar();
            }
            if(targetId === 'laporan-labarugi-view') {
                if(document.getElementById('plYear').options.length === 0) populateMonthYearSelects('plMonth', 'plYear');
                loadLabaRugi();
            }
            if(targetId === 'laporan-neraca-view') {
                const today = new Date().toISOString().split('T')[0];
                if(!document.getElementById('bsDate').value) document.getElementById('bsDate').value = today;
                loadNeraca();
            }
            if(targetId === 'laporan-ekuitas-view') {
                if(typeof loadEkuitasUi === 'function') loadEkuitasUi();
            }
            if(targetId === 'laporan-coretax-view') loadCoretaxReport();
            if(targetId === 'customers-view') loadCustomersTable();
            if(targetId === 'mutation-view') loadMutationsTable();
            if(targetId === 'expense-view') loadExpensesTable();
            if(targetId === 'gantungan-view' && typeof window.initGantunganView === 'function') window.initGantunganView();
            if(targetId === 'laporan-aset-view') loadAssetReport();
            if(targetId === 'closing-view') initClosingView();
            if(targetId === 'pickup-view' && typeof initPickupView === 'function') initPickupView();
            if(targetId === 'masterdata-view') loadMasterDataView();
            if(targetId === 'settings-view') loadSettingsProfile();
            if(targetId === 'hris-view' && typeof switchHrisTab === 'function') {
                const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                const accessRole = typeof getAccessRoleForUserRole === 'function' ? getAccessRoleForUserRole(currentUser?.role) : 'kasir';
                const permissions = typeof getRolePermissions === 'function' ? getRolePermissions() : {};
                const canManageHris = Array.isArray(permissions[accessRole]?.menus) && permissions[accessRole].menus.includes('hris-view');
                switchHrisTab(canManageHris ? 'emp' : 'leave');
            }
        });
    });

    // Mobile Sidebar Toggle
    const applySidebarCollapsed = (collapsed) => {
        if(window.innerWidth <= 768) return;
        document.body.classList.toggle('sidebar-collapsed', collapsed);
        const btn = document.getElementById('collapseSidebar');
        if(btn) {
            btn.title = collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar';
            btn.setAttribute('aria-label', btn.title);
        }
    };

    applySidebarCollapsed(localStorage.getItem('mc_sidebar_collapsed') === 'true');

    safeAddListener('collapseSidebar', 'click', () => {
        const nextCollapsed = !document.body.classList.contains('sidebar-collapsed');
        localStorage.setItem('mc_sidebar_collapsed', nextCollapsed ? 'true' : 'false');
        applySidebarCollapsed(nextCollapsed);
    });

    safeAddListener('menuToggle', 'click', () => {
        const sidebar = document.getElementById('sidebar');
        if(sidebar) sidebar.classList.add('open');
    });
    safeAddListener('closeSidebar', 'click', () => {
        const sidebar = document.getElementById('sidebar');
        if(sidebar) sidebar.classList.remove('open');
    });

    // POS Trx form events
    safeAddListener('trxType', 'change', updatePosSummary);
    safeAddListener('trxCurrency', 'change', updatePosSummary);
    safeAddListener('trxAmount', 'input', updatePosSummary);
    safeAddListener('trxRate', 'input', updatePosSummary);
    
    // Booking Form
    safeAddListener('checkoutType', 'change', function() {
        const isBooking = this.value === 'BOOKING';
        const container = document.getElementById('bookingPaymentContainer');
        if(container) {
            if(isBooking) container.classList.remove('hidden');
            else container.classList.add('hidden');
        }
        updatePosSummary(); 
    });

    safeAddListener('dpAmount', 'input', function() {
        let gt = 0;
        currentCart.forEach(item => gt += (item.totalIdr * (item.type === 'JUAL' ? 1 : -1)));
        const absTotal = Math.abs(gt);
        let dp = parseFloat(this.value) || 0;
        if(dp > absTotal) { this.value = absTotal; dp = absTotal; }
        const remaining = absTotal - dp;
        const textEl = document.getElementById('remainingDpText');
        if(textEl) textEl.textContent = 'Sisa tagihan: ' + formatIdr(remaining);
    });

    safeAddListener('btnAddToCart', 'click', addToCart);
    
    safeAddListener('paymentMethod', 'change', function() {
        const splitCont = document.getElementById('splitPaymentContainer');
        const transferCont = document.getElementById('transferPaymentContainer');
        const bankCont = document.getElementById('transferBankContainer');
        
        if(this.value === 'SPLIT') {
            if(splitCont) splitCont.classList.remove('hidden');
            if(transferCont) transferCont.classList.add('hidden');
            if(bankCont) { bankCont.style.display = 'block'; bankCont.classList.remove('hidden'); }
        } else if(this.value === 'TRANSFER') {
            if(splitCont) splitCont.classList.add('hidden');
            if(transferCont) transferCont.classList.remove('hidden');
            if(bankCont) { bankCont.style.display = 'block'; bankCont.classList.remove('hidden'); }
        } else {
            if(splitCont) splitCont.classList.add('hidden');
            if(transferCont) transferCont.classList.add('hidden');
            if(bankCont) { bankCont.style.display = 'none'; }
        }
    });

    safeAddListener('splitCashAmount', 'input', function() {
        let gt = 0;
        currentCart.forEach(item => gt += (item.totalIdr * (item.type === 'JUAL' ? 1 : -1)));
        const total = Math.abs(gt);
        let cash = parseFloat(this.value) || 0;
        if (cash > total) { this.value = total; cash = total; }
        const transferEl = document.getElementById('splitTransferAmount');
        if(transferEl) transferEl.value = total - cash;
    });

    // Denominations for Closing Kasir
    document.querySelectorAll('.denom-input').forEach(input => {
        input.addEventListener('input', calculateClosingPhysical);
        input.addEventListener('change', calculateClosingPhysical);
    });

    safeAddListener('btnProcessPayment', 'click', processPayment);
    safeAddListener('btnFilterReport', 'click', loadReportsTable);
    safeAddListener('btnFilterLku', 'click', loadLaporanLku);
    safeAddListener('lkuReportPeriod', 'change', function() {
        if(typeof applyLkuPeriodToDates === 'function') applyLkuPeriodToDates(this.value);
        if(typeof initBiRatesPanel === 'function') initBiRatesPanel();
        loadLaporanLku();
    });
    safeAddListener('lkuStartDate', 'change', function() {
        if(typeof syncLkuPeriodFromDates === 'function') syncLkuPeriodFromDates();
    });
    safeAddListener('lkuEndDate', 'change', function() {
        if(typeof syncLkuPeriodFromDates === 'function') syncLkuPeriodFromDates();
        if(typeof initBiRatesPanel === 'function') initBiRatesPanel();
    });
    
    ['filterInvoice', 'filterNama', 'filterHp'].forEach(id => {
        safeAddListener(id, 'input', loadReportsTable);
    });
    ['filterValuta', 'filterTipe'].forEach(id => {
        safeAddListener(id, 'change', loadReportsTable);
    });

    // Global Reset Functions
    window.resetHistoryFilters = function() {
        ['filterInvoice', 'filterNama', 'filterHp'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        ['filterValuta', 'filterTipe'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        refreshTransactionsThen(() => loadReportsTable());
    };

    // Initial Load
    try {
        refreshTransactionsThen(() => loadDashboard());
    } catch(e) { console.error("Initial dashboard load failed:", e); }
});

// Load Module 20: Mobile Mode dynamically
(function() {
    const script = document.createElement('script');
    script.src = '/js/modules/20-mobilemode.js?v=' + Date.now();
    document.body.appendChild(script);
})();
