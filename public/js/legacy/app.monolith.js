window.safeArrayGet = function(key) { try { let d = JSON.parse(localStorage.getItem(key)); return Array.isArray(d) ? d : []; } catch(e) { return []; } };
if(document.getElementById('jsStatus')) document.getElementById('jsStatus').style.display = 'none';

window.formatDateToDMY = function(dateInput) {
    if(!dateInput || dateInput === '-') return '-';
    let d = new Date(dateInput);
    if(isNaN(d.getTime())) return dateInput;
    let days = String(d.getDate()).padStart(2, '0');
    let months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    let month = months[d.getMonth()];
    let year = d.getFullYear();
    return `${days} ${month} ${year}`;
};

// Default Data untuk di-load pertama kali
const DEFAULT_CURRENCIES = [
    { code: 'USD', buy: 15400, sell: 15600, stock: 5000, alert: 1000 },
    { code: 'EUR', buy: 16800, sell: 17100, stock: 3000, alert: 500 },
    { code: 'SGD', buy: 11500, sell: 11700, stock: 8000, alert: 2000 },
    { code: 'AUD', buy: 10100, sell: 10300, stock: 2000, alert: 500 }
];

// Modern Notification Configuration
window.originalAlert = window.alert;
window.alert = function(message) {
    // Fallback if SweetAlert fails to load
    if (typeof Swal === 'undefined') {
        window.originalAlert(message);
        return;
    }

    const popupClass = Swal.mixin({
        position: 'center',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#1e293b',
        color: '#f8fafc',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
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
const DEFAULT_PROFILE = { name: 'MC-ALMARA', address: 'Pusat Valuta Asing Terpercaya', phone: '-', phoneWA: '', biLicense: '', footer: 'Terima Kasih Atas Kunjungan Anda', waTemplate: DEFAULT_WA_TEMPLATE };
const DEFAULT_JOBS = ['Pegawai Swasta', 'PNS / TNI / POLRI', 'Wiraswasta', 'Pelajar / Mahasiswa', 'Mengurus Rumah Tangga', 'Lainnya'];
const DEFAULT_CITIZENS = ['WNI', 'WNA'];

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
    if(!localStorage.getItem('mc_master_jobs')) localStorage.setItem('mc_master_jobs', JSON.stringify(DEFAULT_JOBS));
    if(!localStorage.getItem('mc_master_citizenships')) localStorage.setItem('mc_master_citizenships', JSON.stringify(DEFAULT_CITIZENS));
    if(!localStorage.getItem('mc_master_currencies')) localStorage.setItem('mc_master_currencies', JSON.stringify(DEFAULT_MASTER_CURRENCIES));
    
    // Koin & Uang Kertas Lama (Isolated Storage)
    if(!localStorage.getItem('mc_old_money_cash')) localStorage.setItem('mc_old_money_cash', '0');
    if(!localStorage.getItem('mc_old_money_stock')) localStorage.setItem('mc_old_money_stock', JSON.stringify([]));
    if(!localStorage.getItem('mc_old_money_suppliers')) localStorage.setItem('mc_old_money_suppliers', JSON.stringify([]));
    if(!localStorage.getItem('mc_old_money_trxs')) localStorage.setItem('mc_old_money_trxs', JSON.stringify([]));
    
    let mcUsersRaw = localStorage.getItem('mc_users');
    let mcUsersArr = [];
    try { if (mcUsersRaw) mcUsersArr = JSON.parse(mcUsersRaw); } catch(e) {}
    
    if(!mcUsersRaw || mcUsersArr.length === 0) {
        let defaultUser = [{
            id: 'u1',
            username: 'owner',
            password: 'owner123',
            fullName: 'Master Owner',
            role: 'owner'
        }];
        localStorage.setItem('mc_users', JSON.stringify(defaultUser));
        // Push back to server if possible to prevent it from remaining empty
        if(typeof pushToUniversalDatastore === 'function') {
            setTimeout(() => { pushToUniversalDatastore('mc_users', defaultUser); }, 2000);
        }
    }

    if(!localStorage.getItem('mc_currentUser')) localStorage.setItem('mc_currentUser', JSON.stringify(null));
}

// Get Data
function getCurrencies() { return window.safeArrayGet('mc_currencies'); }
function getTransactions() { return window.safeArrayGet('mc_transactions'); }
function getCash() { return parseInt(localStorage.getItem('mc_cash')) || 0; }
function getBankBCA() { return parseInt(localStorage.getItem('mc_bank_bca')) || 0; }
function getBankMandiri() { return parseInt(localStorage.getItem('mc_bank_mandiri')) || 0; }
function getCustomers() { return window.safeArrayGet('mc_customers'); }
function getAssets() { return window.safeArrayGet('mc_assets'); }
function getMutations() { return window.safeArrayGet('mc_mutations'); }
function getExpenses() { return window.safeArrayGet('mc_expenses'); }
function getClosings() { return window.safeArrayGet('mc_closings'); }
function getAdjustments() { return window.safeArrayGet('mc_adjustments'); }
function getProfile() { return JSON.parse(localStorage.getItem('mc_profile')) || DEFAULT_PROFILE; }
function getMasterJobs() { 
    let jobs = JSON.parse(localStorage.getItem('mc_master_jobs')) || DEFAULT_JOBS; 
    if(jobs.length > 0 && typeof jobs[0] === 'string') {
        jobs = jobs.map(j => ({ name: j, risk: 'Rendah' }));
        saveMasterJobs(jobs);
    }
    return jobs;
}
function getMasterCitizens() { 
    let citizens = JSON.parse(localStorage.getItem('mc_master_citizenships')) || DEFAULT_CITIZENS; 
    if(citizens.length > 0 && typeof citizens[0] === 'string') {
        citizens = citizens.map(c => ({ name: c, risk: 'Rendah' }));
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

window.getFlagHtml = function(code) {
    const arr = getMasterCurrencies();
    const f = arr.find(m => m.code === code);
    return f && f.flag ? `<span class="currency-flag">${f.flag} </span> ` + code : code;
}

// Save Data
function saveCurrencies(data) { 
    localStorage.setItem('mc_currencies', JSON.stringify(data)); 
    
    // Sinkronsiasi otomatis ke MySQL setiap ada perubahan di master data
    if(typeof saveToMySQL_Currency === 'function') {
        data.forEach(c => saveToMySQL_Currency(c)); 
    }
}
function saveTransactions(data) { 
    // Ambil data lama sebelum ditimpa, untuk mencari mana yang transaksi baru saja ditambahkan
    let oldData = window.safeArrayGet('mc_transactions');
    localStorage.setItem('mc_transactions', JSON.stringify(data)); 
    
    // Sinkronsiasi otomatis transaksi BARU ke MySQL
    if(typeof saveToMySQL_Transaction === 'function' && data.length > oldData.length) {
        const oldIds = oldData.map(t => t.id);
        const newTrxs = data.filter(t => !oldIds.includes(t.id));
        newTrxs.forEach(t => saveToMySQL_Transaction(t));
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
    localStorage.setItem('mc_customers', JSON.stringify(data)); 
    
    // Sinkronsiasi otomatis ke MySQL setiap ada perubahan di master data nasabah
    if(typeof saveToMySQL_Customer === 'function') {
        data.forEach(c => saveToMySQL_Customer(c)); 
    }
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
    localStorage.setItem('mc_users', JSON.stringify(data)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_users', data);
}
function getCurrentUser() { return JSON.parse(localStorage.getItem('mc_currentUser')); }
function setCurrentUser(user) { 
    localStorage.setItem('mc_currentUser', JSON.stringify(user)); 
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_currentUser', user);
}
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

// State Management
let currentCart = [];
let currentCustPhotoBase64 = '';

// Format Rupiah (Tanpa Desimal - Konsolidasi Global)
window.formatIdr = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }).format(angka);
};

// Alias formatRupiah dan formatRp untuk kompatibilitas ke belakang
window.formatRupiah = window.formatIdr;
window.formatRp = function(angka) {
    if (angka === undefined || angka === null || isNaN(angka)) return '0';
    return new Intl.NumberFormat('id-ID').format(angka);
};

// Fungsi binding event yang aman (mencegah crash jika elemen tidak ada)
window.safeAddListener = function(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, callback);
        return true;
    }
    return false;
};

// Format Kurs
const formatRate = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(angka);
};

// Update Jam Real-time
setInterval(() => {
    const now = new Date();
    document.getElementById('liveClock').textContent = now.toLocaleTimeString('id-ID');
    const liveDateEl = document.getElementById('liveDate');
    if(liveDateEl) {
        liveDateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
}, 1000);

window.showStockAlertModal = function() {
    const currencies = getCurrencies();
    let issues = currencies.filter(c => (c.stock || 0) <= (c.alert || 0));
    
    if(issues.length === 0) {
        if(typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Stok Terkendali',
                text: 'Semua persediaan valuta asing berada di atas batas peringatan minimum.',
                background: '#1e293b',
                color: '#f8fafc',
                confirmButtonColor: '#3B82F6'
            });
        }
        return;
    }
    
    let html = '<ul style="text-align:left; font-size: 0.95rem; line-height: 1.6;">';
    issues.forEach(c => {
        html += `<li style="margin-bottom:8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
            <strong style="color: #ef4444;">${c.code}</strong>: Sisa ${(c.stock || 0).toLocaleString()} <span style="font-size: 0.8rem; color:#94A3B8;">(Limit: ${(c.alert || 0).toLocaleString()})</span>
        </li>`;
    });
    html += '</ul>';
    
    if(typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Peringatan Limit Stok',
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

window.formatDateOnly = function(dateStr) {
    if(!dateStr || dateStr === '-') return '-';
    try {
        const d = new Date(dateStr);
        if(isNaN(d.getTime())) return dateStr;
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch(e) { return dateStr; }
};

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
    
    // Check Auth Before Anything Else
    // Check Auth Before Anything Else - Wrapped in try-catch to prevent blocking UI listeners
    try {
        checkAuth();
    } catch (e) {
        console.error("Auth / RBAC init failed but continuing to bind UI:", e);
    }

    // Setup Sidebar Menu Toggle
    // Setup Sidebar Menu Toggle
    console.log("Initializing Sidebar Navigation Listeners...");
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
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
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
            
            // Update Title text
            pageTitle.textContent = item.textContent.trim();
            
            // Close sidebar automatically on mobile
            if(window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }

            // Load specific view data
            if(targetId === 'dashboard-view') loadDashboard();
            if(targetId === 'pos-view') loadPosForm();
            if(targetId === 'booking-view') loadBookingsTable();
            if(targetId === 'currency-view') loadCurrencyTable();
            if(targetId === 'expense-view') loadExpensesTable();
            if(targetId === 'adjustment-view') loadAdjustmentsTable();
            if(targetId === 'harian-view') loadLaporanHarian();
            if(targetId === 'reports-view') loadReportsTable();
            if(targetId === 'laporan-lku-view') {
                const today = new Date().toISOString().split('T')[0];
                if(!document.getElementById('lkuStartDate').value) document.getElementById('lkuStartDate').value = today;
                if(!document.getElementById('lkuEndDate').value) document.getElementById('lkuEndDate').value = today;
                loadLaporanLku();
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
            if(targetId === 'laporan-aset-view') loadAssetReport();
            if(targetId === 'closing-view') initClosingView();
            if(targetId === 'masterdata-view') loadMasterDataView();
            if(targetId === 'settings-view') loadSettingsProfile();
        });
    });

    // Mobile Sidebar Toggle
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
    const denoms = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
    denoms.forEach(d => {
        safeAddListener(`denom_${d}`, 'input', calculateClosingPhysical);
    });

    safeAddListener('btnProcessPayment', 'click', processPayment);
    safeAddListener('btnFilterReport', 'click', loadReportsTable);
    safeAddListener('btnFilterLku', 'click', loadLaporanLku);
    
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
        loadReportsTable();
    };

    // Initial Load
    try {
        loadDashboard();
    } catch(e) { console.error("Initial dashboard load failed:", e); }
});

// ==============================
// DASHBOARD LOGIC
// ==============================
let mainChart;
function loadDashboard() {
    const trxs = getTransactions();
    const currencies = getCurrencies();
    let totalKas = getCash();
    let totalBank = getBankBCA() + getBankMandiri();
    
    // Hitung Estimasi Valuta dalam IDR (menggunakan rate tengah untuk estimasi kekayaan)
    let estimasiValutaIdr = 0;
    let alertsCount = 0;
    
    const stockListHtml = currencies.map(c => {
        const estValue = c.stock * ((c.buy + c.sell) / 2);
        estimasiValutaIdr += estValue;
        
        let statusClass = 'status-aman';
        if((c.stock || 0) <= (c.alert || 0)) {
            statusClass = 'status-bahaya';
            alertsCount++;
        }
        
        return `
            <div class="stock-item">
                <div style="display: flex; align-items: center;">
                    <span class="${statusClass} status-indicator"></span>
                    <span class="stock-code">${window.getFlagHtml(c.code)}</span>
                </div>
                <div class="stock-metrics">
                    <span class="stock-amount">${(c.stock || 0).toLocaleString()}</span>
                    <div class="stock-rate-pair">
                        <div class="stock-rate-chip stock-rate-buy">
                            <span>Beli</span>
                            <strong>${formatRate(c.buy || 0).replace(/,0000$/, '')}</strong>
                        </div>
                        <div class="stock-rate-chip stock-rate-sell">
                            <span>Jual</span>
                            <strong>${formatRate(c.sell || 0).replace(/,0000$/, '')}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('dashboardStockList').innerHTML = stockListHtml;
    document.getElementById('stockAlertBadge').textContent = alertsCount > 0 ? alertsCount : '';
    document.getElementById('stockAlertBadge').style.display = alertsCount > 0 ? 'block' : 'none';

    // Hitung Profit & Total Trx Berdasarkan Tanggal Filter
    let targetDate = new Date().toISOString().split('T')[0];
    const dashDateFilterEl = document.getElementById('dashDateFilter');
    let isFiltered = false;
    
    if (dashDateFilterEl && dashDateFilterEl.value) {
        targetDate = dashDateFilterEl.value;
        isFiltered = true;
    }
    
    // Update texts labels based on date selection
    const profitLabel = document.querySelector('#dashProfit')?.closest('.stat-details')?.querySelector('h3');
    if(profitLabel) {
        profitLabel.textContent = isFiltered ? 'Profit (' + targetDate + ')' : 'Profit Hari Ini';
    }

    const todayTrx = trxs.filter(t => t.timestamp.startsWith(targetDate));
    
    let sumProfit = 0;
    let sumBeli = 0;
    let sumJual = 0;

    todayTrx.forEach(t => {
        if(t.tipe === 'BELI') {
            sumBeli += t.total;
        } else if (t.tipe === 'JUAL') {
            sumJual += t.total;
        }

        const curData = currencies.find(c => c.code === t.valuta);
        if(curData) {
             const midRate = (curData.buy + curData.sell) / 2;
             if(t.tipe === 'JUAL') {
                 sumProfit += (t.rate - midRate) * t.nominal;
             } else {
                 sumProfit += (midRate - t.rate) * t.nominal;
             }
        }
    });

    const expenses = getExpenses();
    const todayExpenses = expenses.filter(e => e.timestamp.startsWith(targetDate));
    let sumExp = 0;
    todayExpenses.forEach(e => sumExp += e.nominal);

    document.getElementById('dashTotalKas').textContent = formatIdr(totalKas);
    document.getElementById('dashTotalBank').textContent = formatIdr(totalBank);
    if(document.getElementById('dashBCA')) document.getElementById('dashBCA').textContent = formatIdr(getBankBCA());
    if(document.getElementById('dashMandiri')) document.getElementById('dashMandiri').textContent = formatIdr(getBankMandiri());
    document.getElementById('dashTotalValuta').textContent = formatIdr(estimasiValutaIdr);
    document.getElementById('dashProfit').textContent = formatIdr(sumProfit);
    if(document.getElementById('dashTotalPurchases')) document.getElementById('dashTotalPurchases').textContent = formatIdr(sumBeli);
    if(document.getElementById('dashTotalSales')) document.getElementById('dashTotalSales').textContent = formatIdr(sumJual);
    if(document.getElementById('dashTotalExpenses')) document.getElementById('dashTotalExpenses').textContent = formatIdr(sumExp);

    // Hitung Akumulasi Selisih Rekonsiliasi
    const closings = getClosings();
    let totalSelisih = 0;
    closings.forEach(c => totalSelisih += (c.selisih || 0));

    const selisihEl = document.getElementById('dashTotalSelisih');
    if(selisihEl) {
        selisihEl.textContent = formatIdr(Math.abs(totalSelisih));
        if(totalSelisih < 0) {
            selisihEl.textContent = '-' + selisihEl.textContent;
            selisihEl.style.color = '#ef4444'; // Red (Kekurangan)
        } else if(totalSelisih > 0) {
            selisihEl.textContent = '+' + selisihEl.textContent;
            selisihEl.style.color = '#10b981'; // Green (Kelebihan)
        } else {
            selisihEl.style.color = '#8b5cf6'; // Neutral
        }
    }

    // Update text labels for dynamic date
    const labelsToUpdate = [
        { id: '#dashTotalPurchases', text: 'Total Pembelian' },
        { id: '#dashTotalSales', text: 'Total Penjualan' },
        { id: '#dashTotalExpenses', text: 'Pengeluaran' }
    ];
    
    labelsToUpdate.forEach(l => {
        const el = document.querySelector(l.id)?.closest('.stat-details')?.querySelector('h3');
        if(el) {
            el.textContent = isFiltered ? l.text + ' (' + targetDate + ')' : l.text;
        }
    });

    // Load Recent Activity (last 5) for target date if filtered, or all if not
    let acts = isFiltered ? [...todayTrx].reverse().slice(0, 5) : [...trxs].reverse().slice(0, 5);
    document.getElementById('recentActivities').innerHTML = acts.map(t => `
        <tr>
            <td>${window.formatDateToDMY(t.timestamp)}</td>
            <td><span class="${t.tipe === 'BELI' ? 'text-green' : 'text-red'} font-weight-bold">${t.tipe}</span></td>
            <td>${window.getFlagHtml(t.valuta)}</td>
            <td>${t.nominal.toLocaleString()}</td>
            <td>${formatIdr(t.total)}</td>
            <td>${t.kasir}</td>
        </tr>
    `).join('') || `<tr><td colspan="6" class="text-center">Belum ada transaksi</td></tr>`;

    // Render Chart
    renderChart(trxs, isFiltered ? targetDate : null);
}

function loadStockMonitor() {
    // Just re-renders part of the dashboard
    loadDashboard();
}

function renderChart(trxs, baseDateStr) {
    const ctx = document.getElementById('transactionChart').getContext('2d');
    
    // Update chart title if specific date is pushed
    const chartTitleEl = document.getElementById('dashChartTitle');
    if(chartTitleEl) {
        chartTitleEl.textContent = baseDateStr ? 'Grafik Transaksi (7 Hari Sebelum ' + baseDateStr + ')' : 'Grafik Transaksi (7 Hari Terakhir)';
    }

    // Kumpulkan data 7 hari terakhir dari titik tanggal
    const days = [];
    const values = []; // Volume in IDR
    
    let baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
    
    for(let i = 6; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        days.push(d.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'}));
        
        const dayVolume = trxs.filter(t => t.timestamp.startsWith(dateStr))
                              .reduce((sum, current) => sum + current.total, 0);
        values.push(dayVolume);
    }

    if(mainChart) mainChart.destroy();
    
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Volume Transaksi (IDR)',
                data: values,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { dash: [5, 5] }, ticks: { color: '#94A3B8' } },
                x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
            }
        }
    });
}

// ==============================
// LAPORAN HARIAN LOGIC
// ==============================
function loadLaporanHarian() {
    const currencies = getCurrencies();
    const masterCurrencies = getMasterCurrencies();
    const mutasi = getMutations();
    const trxs = getTransactions();
    const expenses = getExpenses();
    const adjustments = getAdjustments();
    
    // 1. Stok Valas & Valuasi (Tabel Bawah)
    let htmlValas = '';
    let totalValuasi = 0;
    
    if(currencies.length === 0) {
        htmlValas = '<tr><td colspan="5" class="text-center text-muted">Belum ada data mata uang.</td></tr>';
    } else {
        currencies.forEach(c => {
            const mc = masterCurrencies.find(m => m.code === c.code) || { flag: '', country: '-' };
            const avgRate = (c.buy + c.sell) / 2;
            const rowValuasi = c.stock * avgRate;
            totalValuasi += rowValuasi;
            
            // Re-use logic getFlagHtml if available, otherwise manual fallback
            let flagHtml = window.getFlagHtml ? window.getFlagHtml(c.code) : `<span class="currency-flag">${mc.flag} </span> ${c.code}`;
            
            htmlValas += `
                <tr>
                    <td>${flagHtml}</td>
                    <td>${mc.country}</td>
                    <td style="text-align:right;">${c.stock.toLocaleString()}</td>
                    <td style="text-align:right;">${formatRate(c.buy)}</td>
                    <td style="text-align:right;">${formatIdr(rowValuasi)}</td>
                </tr>
            `;
        });
    }
    const valBody = document.getElementById('harianValasTableBody');
    if(valBody) valBody.innerHTML = htmlValas;
    
    const totVal = document.getElementById('harianTotalValuasiAsing');
    if(totVal) totVal.textContent = formatIdr(totalValuasi);
    
    // 2. Real-time Kas dan Bank (Kotak Atas)
    const kasAkhir = getCash();
    const bankBCA = getBankBCA();
    const bankMandiri = getBankMandiri();
    const totalBank = bankBCA + bankMandiri;
    
    if(document.getElementById('harianKasAkhir')) document.getElementById('harianKasAkhir').textContent = formatIdr(kasAkhir);
    if(document.getElementById('harianTotalBank')) document.getElementById('harianTotalBank').textContent = formatIdr(totalBank);
    if(document.getElementById('harianBankBCA')) document.getElementById('harianBankBCA').textContent = bankBCA.toLocaleString();
    if(document.getElementById('harianBankMandiri')) document.getElementById('harianBankMandiri').textContent = bankMandiri.toLocaleString();
    
    // 3. Profit Hari Ini & Reverse Kas Awal
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Filter List Transaksi Hari Ini
    const todayTrxs = trxs.filter(t => t.timestamp && t.timestamp.startsWith(todayStr));
    const todayMutasi = mutasi.filter(m => m.timestamp && m.timestamp.startsWith(todayStr));
    const todayExpenses = expenses.filter(e => e.timestamp && e.timestamp.startsWith(todayStr));
    const todayAdjustments = adjustments.filter(a => a.timestamp && a.timestamp.startsWith(todayStr));
    
    // Hitung Profit dan Pergerakan Kas Fisik IDR murni
    let todayProfit = 0;
    
    // Kita akan menghitung "Berapa banyak uang KAS FISIK yang MENGALIR hari ini?"
    // Nilai netKasChange (+) berarti Kas Fisik Bertambah hari ini (Nasabah bayar kas, mutasi masuk kas).
    // Nilai netKasChange (-) berarti Kas Fisik Berkurang hari ini.
    let netKasChange = 0; 
    
    // Kelompokkan mutasi berdasarkan Keterangan (Ref ID) untuk mengisolasi nilai Bank saat SPLIT
    const mutBankMap = {}; // key: Ref ID, value: nominal mutasi bank
    todayMutasi.forEach(m => {
        if(m.keterangan && m.keterangan.includes('Ref:')) {
            const match = m.keterangan.match(/Ref:\s*(INV-\d+)/);
            if(match && match[1]) {
                const ref = match[1];
                if(!mutBankMap[ref]) mutBankMap[ref] = 0;
                // 'MASUK' ke bank berarti mutasi positif ke bank, tapi kita simpan nilai absolutnya saja
                mutBankMap[ref] += (m.nominal || 0);
            }
        }
    });

    // Proses Transaksi
    // Karena satu invoice bisa punya beberapa item, kita hitung grand total IDR per invoice dulu
    const invMap = {};
    todayTrxs.forEach(t => {
        if(!invMap[t.id]) invMap[t.id] = { items: [], paymentMethod: t.paymentMethod, bank: t.bank };
        invMap[t.id].items.push(t);
    });

    Object.keys(invMap).forEach(invoiceId => {
        const inv = invMap[invoiceId];
        let invGrandTotal = 0; // Negative = MC Bayar (Customer Jual valas), Positive = MC Terima (Customer Beli valas)
        let invProfit = 0;
        
        inv.items.forEach(t => {
            const c = currencies.find(x => x.code === t.valuta);
            if(c) {
                const midRate = (c.buy + c.sell) / 2;
                if(t.tipe === 'JUAL') { // MC Jual valas, dapat IDR (Positif)
                    const gp = (t.rate - midRate) * t.nominal;
                    invProfit += gp;
                    invGrandTotal += t.total; // bertambah IDR
                } else { // MC Beli valas, keluar IDR (Negatif)
                    const gp = (midRate - t.rate) * t.nominal;
                    invProfit += gp;
                    invGrandTotal -= t.total; // berkurang IDR
                }
            }
        });

        todayProfit += invProfit;

        // Tentukan porsi KAS yang berubah dari invoice ini
        let cashPortion = 0;
        if(inv.paymentMethod === 'CASH') {
            cashPortion = invGrandTotal; // 100% dari grand total masuk/keluar ke kas
        } else if(inv.paymentMethod === 'TRANSFER') {
            cashPortion = 0; // 0% ke kas, semua ke bank
        } else if(inv.paymentMethod === 'SPLIT') {
            // Karena split, porsi kas = (Total Besaran Invoice) dikurangi (Besaran Mutasi Bank untuk Invoice ini)
            const absGrandTotal = Math.abs(invGrandTotal);
            const mutBankVal = mutBankMap[invoiceId] || 0;
            const absCash = absGrandTotal - mutBankVal;
            
            // Pertahankan arah aliran (positif = uang masuk MC, negatif = uang keluar MC)
            cashPortion = invGrandTotal >= 0 ? absCash : -absCash;
        } else {
            // Jika undefined / lama
            cashPortion = invGrandTotal;
        }

        netKasChange += cashPortion;
    });
    
    // Pergerakan Mutasi Manual: 
    // Jika mutasi bukan karena transaksi (keterangan tidak mengandung Transaksi Valas)
    todayMutasi.forEach(m => {
        if(m.keterangan && m.keterangan.includes('Ref:')) return; // Sudah dihitung
        // Mutasi manual ini biasanya mempengaruhi Bank. Apakah bank ke kas? 
        // MC App biasanya mencatat Expense / Adjustment untuk kas. Mutasi di sini mungkin memotong Kas jika kas -> bank.
        // Berdasarkan logika app, jika mutasi dari Kas ke Bank dicatat sebagai MASUK (ke Bank), berarti Kas Berkurang.
        if (m.sumberBank === 'KAS' && m.tipe === 'MASUK') { // Bank bertambah, Kas berkurang
            netKasChange -= (m.nominal || 0); 
        } else if (m.bank === 'KAS' || m.keterangan.toLowerCase().includes('kas')) { // Fallback heuristik 
            // Jika ada pencatatan tarik tunai dari bank (KELUAR dari bank) berarti masuk ke Kas
            if(m.tipe === 'KELUAR' && m.keterangan.toLowerCase().includes('tarik')) netKasChange += (m.nominal || 0);
        }
    });
    
    // Pengeluaran / Expenses (Beban Kas)
    todayExpenses.forEach(e => {
        if(e.kasBank === 'CASH') netKasChange -= e.nominal;
    });
    
    // Penyesuaian Ekuitas / Modal Dasar
    todayAdjustments.forEach(a => {
        if(a.kasBank === 'CASH') {
            if(a.tipePergerakan === 'IN') netKasChange += a.nominal;
            else if(a.tipePergerakan === 'OUT') netKasChange -= a.nominal;
        }
    });

    // Reverse: Kas Saat Ini (Akhir) dikurangi dengan total pergerakan Kas Hari Ini
    const kasAwal = kasAkhir - netKasChange;

    if(document.getElementById('harianProfit')) document.getElementById('harianProfit').textContent = formatIdr(todayProfit);
    if(document.getElementById('harianKasAwal')) document.getElementById('harianKasAwal').textContent = formatIdr(kasAwal);
}

// ==============================
// POS / TRANSACTION LOGIC
// ==============================
function loadPosForm() {
    const currencies = getCurrencies();
    const masterCurrencies = getMasterCurrencies();
    const select = document.getElementById('trxCurrency');
    
    if(select) {
        if(window.jQuery && !$(select).hasClass("select2-hidden-accessible")) {
            $(select).select2({ placeholder: "Ketik pencarian..." });
            $(select).on('change', updatePosSummary);
        }
        
        let html = '<option value="">-- Ketik Pencarian --</option>';
        currencies.forEach(c => {
            const mc = masterCurrencies.find(m => m.code === c.code) || { flag: '', country: '' };
            html += `<option value="${c.code}">${mc.flag || ''} ${c.code} ${mc.country ? '- ' + mc.country : ''} (Stok: ${c.stock})</option>`;
        });
    document.getElementById('trxCurrency').innerHTML = html;
        if(window.jQuery) {
            $(select).trigger('change.select2');
        }
    }
    
    // Default Checkout Date
    const trxCheckoutDateEl = document.getElementById('trxCheckoutDate');
    if(trxCheckoutDateEl) trxCheckoutDateEl.value = new Date().toISOString().split('T')[0];

    // Load Nasabah
    const customers = getCustomers();
    const custSelect = document.getElementById('trxCustomer');
    const recSelect = document.getElementById('trxReceiver');
    if (window.jQuery && !$(custSelect).hasClass("select2-hidden-accessible")) {
        $(custSelect).select2({ placeholder: "Cari nasabah..." });
        $(custSelect).on('change', showCustomerHistory);
    } else if (window.jQuery) {
        $(custSelect).off('change', showCustomerHistory).on('change', showCustomerHistory);
    } else {
        custSelect.onchange = showCustomerHistory;
    }
    if (window.jQuery && recSelect && !$(recSelect).hasClass("select2-hidden-accessible")) {
        $(recSelect).select2({ placeholder: "Cari pengambil valas..." });
    }
    
    const customerOptions = customers.map(c => {
        let idn = c.no_ktp && c.no_ktp !== '-' ? `KTP: ${c.no_ktp}` : (c.selain_ktp && c.selain_ktp !== '-' ? c.selain_ktp : '');
        return `<option value="${c.id_nasabah}">${c.id_nasabah} - ${c.nama}${idn ? ` - ${idn}` : ''} - HP: ${c.no_hp || '-'} - ${c.warga_negara || 'Lokal'}</option>`;
    }).join('');
    
    custSelect.innerHTML = '<option value="-">-- Pengunjung Biasa --</option>' + customerOptions;
    if (recSelect) {
        recSelect.innerHTML = '<option value="SAME">-- Sama dengan Nasabah --</option><option value="-">-- Pengunjung Biasa --</option>' + customerOptions;
    }
    
    if (window.jQuery) {
        $(custSelect).trigger('change.select2');
        if (recSelect) $(recSelect).trigger('change.select2');
    }

    resetPosForm();
    
    if(!window.preserveCart) {
        currentCart = [];
        window.editingTrxId = null;
    }
    window.preserveCart = false;
    
    renderCart();

    // Reset Receipt Print context
    document.getElementById('btnPrintReceipt').classList.add('hidden');
    document.getElementById('btnPrintReceipt').onclick = null;
    
    // Initialize customer history view
    showCustomerHistory();
}

function showCustomerHistory() {
    const custId = document.getElementById('trxCustomer').value;
    const container = document.getElementById('customerPosHistoryContainer');
    const listEl = document.getElementById('customerPosHistoryList');
    
    if (!container || !listEl) return;
    
    if (custId === '-' || !custId) {
        container.style.display = 'none';
        return;
    }
    
    const allTrxs = getTransactions();
    const custTrxs = allTrxs.filter(t => t.customerId === custId);
    
    if (custTrxs.length === 0) {
        container.style.display = 'block';
        listEl.innerHTML = '<div style="text-align: center; color: #64748B; font-style: italic; padding: 5px;">Belum ada histori transaksi.</div>';
        return;
    }
    
    const invMap = {};
    custTrxs.forEach(t => {
        if (!invMap[t.id]) invMap[t.id] = { id: t.id, timestamp: t.timestamp, items: [] };
        invMap[t.id].items.push(t);
    });
    
    let invoices = Object.values(invMap);
    invoices.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    invoices = invoices.slice(0, 5); // Ambil 5 invoice terakhir
    
    let html = '';
    invoices.forEach(inv => {
        let total = 0;
        let itemsHtml = inv.items.map(i => {
            total += (i.tipe === 'JUAL' ? i.total : -i.total);
            return `<div style="font-size: 0.75rem;"><span class="${i.tipe === 'BELI' ? 'text-green' : 'text-red'} font-weight-bold">${i.tipe}</span> ${i.nominal.toLocaleString()} ${window.getFlagHtml(i.valuta)} (@ ${formatRate(i.rate)})</div>`;
        }).join('');
        
        let invDate = window.formatDateToDMY(inv.timestamp);
        let invIdText = inv.id ? `<span style="color: #94A3B8; font-size: 0.7rem; display: block;">${inv.id}</span>` : '';
        
        html += `
            <div style="background: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="color: #cbd5e1; font-weight: bold; font-size: 0.8rem;">${invDate}</div>
                    ${invIdText}
                    <div style="margin-top: 4px;">${itemsHtml}</div>
                </div>
                <div style="text-align: right; align-self: center;">
                    <div style="color: ${total >= 0 ? '#10B981' : '#F87171'}; font-weight: bold; font-size: 0.85rem;">Grand Total:<br>${formatIdr(Math.abs(total))}</div>
                </div>
            </div>
        `;
    });
    
    container.style.display = 'block';
    listEl.innerHTML = html;
}

function updatePosSummary() {
    const type = document.getElementById('trxType').value;
    const curCode = document.getElementById('trxCurrency').value;
    const amountVal = document.getElementById('trxAmount').value;
    const amount = parseFloat(amountVal) || 0;
    const currencies = getCurrencies();
    const cur = currencies.find(c => c.code === curCode);

    let rateStr = document.getElementById('trxRate').value;
    
    // Auto fill rate if currency is selected and rate input is pristine/empty
    if(cur && document.activeElement !== document.getElementById('trxRate')) {
        document.getElementById('trxRate').value = type === 'BELI' ? cur.buy : cur.sell;
    }
    
    const rate = parseFloat(document.getElementById('trxRate').value) || 0;
    const totalIdr = amount * rate;

    // Update UI Summary
    const mc = getMasterCurrencies().find(m => m.code === curCode) || { flag: '' };
    document.getElementById('summaryType').textContent = type;
    document.getElementById('summaryType').className = type === 'BELI' ? 'text-green' : 'text-red';
    document.getElementById('summaryCurrency').textContent = curCode ? `${mc.flag} ${curCode}` : '-';
    document.getElementById('summaryRate').textContent = formatRate(rate);
    document.getElementById('summaryAmount').textContent = amountVal ? new Intl.NumberFormat().format(amount) : '0';
    document.getElementById('summaryTotalIdr').textContent = formatIdr(totalIdr);
}

function resetPosForm() {
    document.getElementById('trxCurrency').value = '';
    if(window.jQuery) {
        $('#trxCurrency').val(null).trigger('change.select2');
        $('#trxCurrency').select2('close');
    }
    document.getElementById('trxAmount').value = '';
    document.getElementById('trxRate').value = '';
    updatePosSummary();
}

function addToCart() {
    const type = document.getElementById('trxType').value;
    const curCode = document.getElementById('trxCurrency').value;

    const amount = parseFloat(document.getElementById('trxAmount').value);
    const rate = parseFloat(document.getElementById('trxRate').value);
    
    if(!curCode || !amount || !rate) {
        alert("Mohon lengkapi form transaksi untuk dimasukkan ke keranjang.");
        return;
    }

    const currencies = getCurrencies();
    const cur = currencies.find(c => c.code === curCode);
    
    if(!cur) {
        alert("Kode Valuta tidak valid. Silakan ketik kode yang benar (misal: USD).");
        return;
    }

    const totalIdr = amount * rate;

    // Limit Check for Cart (JUAL means we give out foreign currency)
    // We must calculate if total amount in cart + this amount > stock
    if(type === 'JUAL') {
        const cartAmount = currentCart.filter(item => item.curCode === curCode && item.type === 'JUAL').reduce((sum, item) => sum + item.amount, 0);
        if((cartAmount + amount) > cur.stock) {
            alert(`Stok ${curCode} tidak mencukupi untuk jumlah ini! Tersedia: ${cur.stock}`);
            return;
        }

        let totalJualIdrNow = totalIdr;
        currentCart.forEach(item => {
            if(item.type === 'JUAL') totalJualIdrNow += item.totalIdr;
        });

        const usdObj = currencies.find(c => c.code === 'USD');
        let usdRate = 16000;
        if (usdObj && usdObj.sell) {
            usdRate = parseFloat(usdObj.sell) || 16000;
        }
        
        const thresholdLimit = 25000 * usdRate;
        if (totalJualIdrNow >= thresholdLimit) {
            const custId = document.getElementById('trxCustomer').value;
            const customerObj = getCustomers().find(c => c.id_nasabah === custId);
            const namaNasabah = customerObj ? customerObj.nama : 'Umum (Tanpa ID)';
            alert(`Sodara ${namaNasabah} sudah melampaui batas treshold $25.000, silahkan isi underlyn terima kasih`);
        }
    }

    currentCart.push({
        id: Date.now().toString(),
        type, 
        curCode, 
        amount, 
        rate, 
        totalIdr
    });

    renderCart();
    resetPosForm();

    // Hide print receipt button whenever cart is modified
    document.getElementById('btnPrintReceipt').classList.add('hidden');
}

function removeFromCart(id) {
    currentCart = currentCart.filter(item => item.id !== id);
    renderCart();
}

function renderCart() {
    const cartContainer = document.getElementById('cartContainer');
    const grandTotalNode = document.getElementById('grandTotalIdr');
    const processBtn = document.getElementById('btnProcessPayment');
    
    let grandTotal = 0;
    let html = '';

    if(currentCart.length === 0) {
        html = '<div style="text-align: center; color: #94A3B8; padding: 10px;">Keranjang Kosong</div>';
        grandTotalNode.textContent = 'Rp 0';
        processBtn.classList.add('disabled');
    } else {
        currentCart.forEach(item => {
            let sign = item.type === 'JUAL' ? 1 : -1;
            grandTotal += (item.totalIdr * sign);

            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="flex: 2; display: flex; align-items: center; gap: 5px;">
                        <span class="badge ${item.type === 'BELI' ? 'bg-green' : 'bg-red'}" style="font-size: 0.65rem; padding: 2px 4px;">${item.type[0]}</span>
                        <strong>${item.curCode}</strong>
                    </div>
                    <div style="flex: 1; text-align: center;">${item.amount.toLocaleString()}</div>
                    <div style="flex: 1.5; text-align: center; font-size: 0.8rem; color: #94A3B8;">@${item.rate.toLocaleString()}</div>
                    <div style="flex: 2; text-align: right; font-weight: bold; color: ${item.type === 'JUAL' ? '#10B981' : '#F87171'};">
                        ${item.type === 'JUAL' ? '+' : '-'}${formatIdr(item.totalIdr).replace(/[^\d.,]/g, '')}
                    </div>
                    <div style="width: 25px; text-align: right;">
                        <button class="btn btn-sm" style="color: #F87171; padding: 0;" onclick="removeFromCart('${item.id}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
            `;
        });
        
        grandTotalNode.textContent = formatIdr(Math.abs(grandTotal));
        grandTotalNode.style.color = grandTotal < 0 ? '#F87171' : '#10B981'; 
        
        processBtn.classList.remove('disabled');
    }
    cartContainer.innerHTML = html;
}

function processPayment() {
    if(currentCart.length === 0) return;

    // Calculate Grand Total from Cart
    let grandTotal = 0; // Negative means MC pays out IDR, Positive means MC receives IDR
    currentCart.forEach(item => {
        let sign = item.type === 'JUAL' ? 1 : -1;
        grandTotal += (item.totalIdr * sign);
    });

    const checkoutType = document.getElementById('checkoutType') ? document.getElementById('checkoutType').value : 'CASH';
    let dpAmountVal = 0;
    let remainingAmountVal = 0;
    let requiredPayment = grandTotal;
    
    if (checkoutType === 'BOOKING') {
        dpAmountVal = parseFloat(document.getElementById('dpAmount').value) || 0;
        const absGt = Math.abs(grandTotal);
        if (dpAmountVal > absGt) dpAmountVal = absGt;
        
        let sign = grandTotal < 0 ? -1 : 1;
        requiredPayment = dpAmountVal * sign;
        remainingAmountVal = absGt - dpAmountVal;
    }

    const paymentMethod = document.getElementById('paymentMethod').value;
    let payCash = 0;
    let payTransfer = 0;

    if (paymentMethod === 'CASH') {
        payCash = requiredPayment;
    } else if (paymentMethod === 'TRANSFER') {
        const transferProof = document.getElementById('transferProof').files[0];
        payTransfer = requiredPayment;
    } else if (paymentMethod === 'SPLIT') {
        const splitCashVal = parseFloat(document.getElementById('splitCashAmount').value) || 0;
        const splitTransferVal = parseFloat(document.getElementById('splitTransferAmount').value) || 0;
        const proofFile = document.getElementById('splitTransferProof').files[0];
        
        // Let's enforce that if we are paying out to customer (negative grandTotal),
        // the split should represent amounts out.
        // For simplicity, let's work in absolutes for the split.
        const absReq = Math.abs(requiredPayment);
        
        if(Math.abs((splitCashVal + splitTransferVal) - absReq) > 1) { // allow small precision difference
            alert("Total Tunai dan Transfer harus sama dengan Jumlah Bayar (Grand Total / DP)!");
            return;
        }
        
        let absCash = splitCashVal;
        let absTransfer = splitTransferVal;
        
        // Apply signing for the balances
        let sign = grandTotal < 0 ? -1 : 1;
        payCash = absCash * sign;
        payTransfer = absTransfer * sign;
    }

    let cash = getCash();
    let bankBCA = getBankBCA();
    let bankMandiri = getBankMandiri();
    const bankTgt = document.getElementById('transferBankTarget').value || 'BCA';
    
    const currencies = getCurrencies();
    let trxs = getTransactions();
    let mutations = getMutations();

    // =============== REVERSE OLD TRANSACTION (EDIT MODE) =================
    if (window.editingTrxId) {
        const oldTrxGroup = trxs.filter(t => t.id === window.editingTrxId);
        if (oldTrxGroup.length > 0) {
            let oldGrandTotal = 0;
            oldTrxGroup.forEach(t => {
                const curIdx = currencies.findIndex(c => c.code === t.valuta);
                if(curIdx > -1) {
                    if(t.tipe === 'JUAL') currencies[curIdx].stock += t.nominal;
                    else currencies[curIdx].stock -= t.nominal;
                }
                let sign = t.tipe === 'JUAL' ? 1 : -1;
                oldGrandTotal += (t.total * sign);
            });
            const oldPayMethod = oldTrxGroup[0].paymentMethod;
            const oldBankTgt = oldTrxGroup[0].bank || 'BCA';
            if (oldPayMethod === 'TRANSFER') {
                if (oldBankTgt === 'BCA') bankBCA -= oldGrandTotal;
                else bankMandiri -= oldGrandTotal;
            } else {
                cash -= oldGrandTotal;
            }
            
            // Remove old from memory arrays temporarily
            trxs = trxs.filter(t => t.id !== window.editingTrxId);
            mutations = mutations.filter(m => !m.keterangan || (m.keterangan && !m.keterangan.includes(window.editingTrxId)));
        }
    }
    // =====================================================================

    let currentBankBalance = bankTgt === 'BCA' ? bankBCA : bankMandiri;
    
    // Check if we have enough IDR reserves for BELI (paying out IDR)
    if(grandTotal < 0) {
        if((cash + payCash) < 0) { // payCash is negative here
            alert(`Kas Tunai tidak mencukupi! Sisa Kas: ${formatIdr(cash)}`);
            return;
        }
        if((currentBankBalance + payTransfer) < 0) {
            alert(`Saldo Bank ${bankTgt} tidak mencukupi! Saldo Bank: ${formatIdr(currentBankBalance)}`);
            return;
        }
    }

    // Currencies sudah di-load di atas

    // Deduct stock for all items
    for(let item of currentCart) {
        const curIndex = currencies.findIndex(c => c.code === item.curCode);
        if(item.type === 'JUAL') {
            currencies[curIndex].stock -= item.amount;
        } else {
            currencies[curIndex].stock += item.amount;
        }
    }

    // Save Transactions (group by a single receipt id)
    let receiptId = window.editingTrxId;
    if (!receiptId) {
        let seq = parseInt(localStorage.getItem('mc_invoice_seq')) || 0;
        seq += 1;
        receiptId = 'INV-' + seq.toString().padStart(4, '0');
        localStorage.setItem('mc_invoice_seq', seq);
    }

    // Apply Balances
    cash += payCash;
    if(bankTgt === 'BCA') bankBCA += payTransfer;
    else bankMandiri += payTransfer;

    let finalTimestamp = window.editingTrxTimestamp || new Date().toISOString();
    const checkoutDateEl = document.getElementById('trxCheckoutDate');
    if(checkoutDateEl && checkoutDateEl.value && !window.editingTrxTimestamp) {
        const currTime = new Date().toISOString().substring(11);
        finalTimestamp = checkoutDateEl.value + 'T' + currTime;
    }

    // Log Bank Mutation if involved
    if(Math.abs(payTransfer) > 0) {
        // mutations sudah di-load dan disesuaikan di atas
        mutations.push({
            id_mutasi: 'MUT-' + Date.now().toString().slice(-6),
            timestamp: finalTimestamp,
            tipe: payTransfer > 0 ? 'MASUK' : 'KELUAR',
            nominal: Math.abs(payTransfer),
            keterangan: `Transaksi Valas (Ref: ${receiptId})`,
            bank: bankTgt
        });
        saveMutations(mutations);
    }

    saveCurrencies(currencies);
    saveCash(cash);
    saveBankBCA(bankBCA);
    saveBankMandiri(bankMandiri);

    const inputByUser = window.editingTrxInputBy || ((getCurrentUser() && getCurrentUser().fullName) ? getCurrentUser().fullName : 'Admin Kasir');
    const editByUser = window.editingTrxId ? ((getCurrentUser() && getCurrentUser().fullName) ? getCurrentUser().fullName : 'Admin Kasir') : '';

    window.editingTrxId = null; // Clear edit state after success
    window.editingTrxTimestamp = null;
    window.editingTrxInputBy = null;
    
    // trxs sudah di-load dan disesuaikan di atas
    const customerId = document.getElementById('trxCustomer').value;
    let rawReceiverId = document.getElementById('trxReceiver') ? document.getElementById('trxReceiver').value : 'SAME';
    const receiverId = (rawReceiverId === 'SAME') ? customerId : rawReceiverId;
    
    currentCart.forEach(item => {
        trxs.push({
            id: receiptId,    // Use same receipt ID to group
            itemId: item.id,
            timestamp: finalTimestamp,
            tipe: item.type,
            valuta: item.curCode,
            nominal: item.amount,
            rate: item.rate,
            total: item.totalIdr,
            kasir: (getCurrentUser() && getCurrentUser().fullName) ? getCurrentUser().fullName : 'Admin Kasir',
            inputBy: inputByUser,
            editBy: editByUser,
            customerId: customerId !== '-' ? customerId : null,
            receiverId: receiverId !== '-' ? receiverId : null,
            paymentMethod: paymentMethod,
            bank: (paymentMethod === 'TRANSFER' || paymentMethod === 'SPLIT') ? bankTgt : null,
            // Mode Booking Data
            tipe_transaksi: checkoutType, // 'CASH' or 'BOOKING'
            status: checkoutType === 'BOOKING' ? 'PENDING' : 'LUNAS',
            dpAmount: checkoutType === 'BOOKING' ? dpAmountVal : 0,
            remainingAmount: checkoutType === 'BOOKING' ? remainingAmountVal : 0
        });
    });

    saveTransactions(trxs);

    alert(`Pembayaran Berhasil! (Disimpan dengan ref: ${receiptId})`);

    
    // Setup Print Button
    const printBtn = document.getElementById('btnPrintReceipt');
    printBtn.classList.remove('hidden');
    
    const waBtn = document.getElementById('btnSendWA');
    if (waBtn) waBtn.classList.remove('hidden');
    
    // Create a copy of the cart for printing
    const printCart = [...currentCart];
    const printSummary = {
        receiptId,
        paymentMethod,
        grandTotal,
        payCash,
        payTransfer,
        customerId: customerId !== '-' ? customerId : null,
        receiverId: receiverId !== '-' ? receiverId : null,
        timestamp: finalTimestamp,
        kasir: (getCurrentUser() && getCurrentUser().fullName) ? getCurrentUser().fullName : 'Admin Kasir'
    };
    
    printBtn.onclick = () => printReceipt(printCart, printSummary);
    if(waBtn) waBtn.onclick = () => sendWhatsAppReceipt(printCart, printSummary);

    // Reset Form
    currentCart = [];
    renderCart();
    resetPosForm();
    loadDashboard(); // Refresh Dashboard figures
}

function sendWhatsAppReceipt(cart, summary) {
    const profile = getProfile();
    let waTemplate = profile.waTemplate || DEFAULT_WA_TEMPLATE;
    
    // Process [VALUTA_LIST]
    let valutaListText = '';
    cart.forEach(item => {
        valutaListText += `- ${item.type} ${item.amount.toLocaleString()} ${item.curCode} \n  (@ ${formatRate(item.rate)}) = ${formatIdr(item.totalIdr)}\n`;
    });
    
    // Process [METODE_RINCIAN]
    let metodeRincianText = '';
    if(summary.paymentMethod === 'SPLIT') {
        metodeRincianText += `  - Tunai: ${formatIdr(Math.abs(summary.payCash))}\n`;
        metodeRincianText += `  - Transfer: ${formatIdr(Math.abs(summary.payTransfer))}\n`;
    }
    
    const customers = getCustomers();
    const customer = summary.customerId ? customers.find(c => c.id_nasabah === summary.customerId) : null;
    const custName = customer ? (customer.nama || 'Pelanggan') : 'Pelanggan';
    
    let text = waTemplate
        .replace(/\[NAMA_NASABAH\]/gi, custName)
        .replace(/\[PELANGGAN\]/gi, custName)
        .replace(/\[NASABAH\]/gi, custName)
        .replace(/\[NAMA\]/gi, custName)
        .replace(/\[NAMA_MC\]/gi, profile.name)
        .replace(/\[NO_HP_MC\]/gi, profile.phone !== '-' ? profile.phone : '')
        .replace(/\[NO_INVOICE\]/gi, summary.receiptId)
        .replace(/\[TANGGAL\]/gi, window.formatDateToDMY(summary.timestamp))
        .replace(/\[GRAND_TOTAL\]/gi, formatIdr(Math.abs(summary.grandTotal)))
        .replace(/\[METODE_BAYAR\]/gi, summary.paymentMethod)
        .replace(/\[VALUTA_LIST\]/gi, valutaListText.trim())
        .replace(/\[METODE_RINCIAN\]/gi, metodeRincianText.trim());

    // Clean up excessive empty lines
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');

    let phone = '';
    if (customer && customer.no_hp) {
        phone = customer.no_hp.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    }
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function printReceipt(cart, summary) {
    const formatRateNota = (angka) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(angka);
    const profile = getProfile();
    const customers = getCustomers();
    const cust = customers.find(c => c.id_nasabah === summary.customerId) || {};
    const custName = cust.nama || 'Pengunjung Biasa';
    let custPhone = cust.no_hp || '-';
    if(custPhone !== '-') custPhone = custPhone.length > 3 ? custPhone.slice(0, -3) + '***' : '***';
    const custCitizenship = cust.kewarganegaraan || '-';
    
    const recIdToUse = summary.receiverId || summary.customerId;
    const rec = recIdToUse === summary.customerId ? cust : (customers.find(c => c.id_nasabah === recIdToUse) || {});
    const recName = recIdToUse === summary.customerId ? custName : (rec.nama || 'Pengunjung Biasa');

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    // Generate Items HTML: Kelompokkan BELI dan JUAL
    let itemsHtml = '';
    const beliCart = cart.filter(i => i.type === 'BELI');
    const jualCart = cart.filter(i => i.type === 'JUAL');
    const isMixed = beliCart.length > 0 && jualCart.length > 0;
    
    if (beliCart.length > 0) {
        if (isMixed) itemsHtml += '<div>BELI</div>';
        
        // Tambahkan Header Kolom
        itemsHtml += `
            <div class="row" style="font-weight:bold; border-bottom:1px solid #000; margin-bottom:2px; font-size:11px;">
                <span style="width:15%;">Valas</span>
                <span style="width:25%;">Qty</span>
                <span style="width:25%;">Kurs</span>
                <span style="width:35%; text-align:right;">Jumlah Rp.</span>
            </div>
        `;

        let totalBeli = 0;
        itemsHtml += beliCart.map(item => {
            totalBeli += item.totalIdr;
            return `
            <div class="row" style="font-size:12px;">
                <span style="width:15%;">${item.curCode}</span>
                <span style="width:25%;">${item.amount.toLocaleString()}</span>
                <span style="width:25%;">${formatRateNota(item.rate)}</span>
                <span style="width:35%; text-align:right;">${formatIdr(item.totalIdr)}</span>
            </div>
            `;
        }).join('');

        if (isMixed) {
            itemsHtml += `
                <div class="row">
                <span>total</span>
                <span>${formatIdr(totalBeli)}</span>
                </div>
            `;
        }
    }
    
    if (isMixed) {
        itemsHtml += '<div class="divider" style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>';
    }
    
    if (jualCart.length > 0) {
        if (isMixed) itemsHtml += '<div>JUAL</div>';
        
        // Tambahkan Header Kolom jika belum ada (atau jika mixed)
        itemsHtml += `
            <div class="row" style="font-weight:bold; border-bottom:1px solid #000; margin-bottom:2px; font-size:11px;">
                <span style="width:15%;">Valas</span>
                <span style="width:25%;">Qty</span>
                <span style="width:25%;">Kurs</span>
                <span style="width:35%; text-align:right;">Jumlah Rp.</span>
            </div>
        `;

        let totalJual = 0;
        itemsHtml += jualCart.map(item => {
            totalJual += item.totalIdr;
            return `
            <div class="row" style="font-size:12px;">
                <span style="width:15%;">${item.curCode}</span>
                <span style="width:25%;">${item.amount.toLocaleString()}</span>
                <span style="width:25%;">${formatRateNota(item.rate)}</span>
                <span style="width:35%; text-align:right;">${formatIdr(item.totalIdr)}</span>
            </div>
            `;
        }).join('');

        if (isMixed) {
            itemsHtml += `
                <div class="row">
                <span>total</span>
                <span>${formatIdr(totalJual)}</span>
                </div>
            `;
        }
    }

    let labelInvoice = 'No. Invoice';
    if (beliCart.length > 0 && jualCart.length === 0) labelInvoice = 'Invoice Pembelian';
    else if (jualCart.length > 0 && beliCart.length === 0) labelInvoice = 'Invoice Penjualan';
    else if (isMixed) labelInvoice = 'Nota Transaksi';

    const dateStr = window.formatDateToDMY(summary.timestamp || Date.now());
    let contactLine = '';
    const phone = profile.phone || '';
    const wa = profile.phoneWA || '';
    if (phone === wa && phone !== '') {
        contactLine = `<span>Telp/WA: ${phone}</span> | <span>Tgl: ${dateStr}</span>`;
    } else {
        contactLine = `<span>Telp: ${phone || '-'}</span> | <span>WA: ${wa || '-'}</span> | <span>Tgl: ${dateStr}</span>`;
    }

    printWindow.document.write(`<!DOCTYPE html>
        <html><head>
            <style>
                @page { size: 9cm 14cm; margin: 0; }
                html, body { margin: 0; padding: 0; min-height: 100%; }
                body { font-family: 'Courier New', Courier, monospace; width: 8.6cm; margin: 0 auto; padding: 0.4cm 0.2cm 0.5cm; box-sizing: border-box; font-size: 13px; font-weight: normal; color: #000; }
                * { font-weight: normal !important; }
                .center { text-align: center; }
                .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
                .divider-double { border-top: 1px dashed #000; border-bottom: 1px dashed #000; height: 2px; margin: 8px 0; }
                .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                small { font-size: 0.8em; color: #000; }
                .uppercase { text-align: center; font-weight: bold !important; font-size: 15px; }
            </style>
        </head><body>
            <h2 class="center" style="margin-top: 5px; margin-bottom: 0px; font-size: 18px;">${profile.name || 'MC-ALMARA'}</h2>
            ${profile.biLicense ? `<div class="center" style="font-size: 0.9em; margin-bottom: 2px;">No. Izin: ${profile.biLicense}</div>` : ''}
            <div class="center">
                ${profile.address ? `<div>${profile.address}</div>` : ''}
                <div style="font-size: 0.9em; margin-top: 2px;">
                    ${contactLine}
                </div>
            </div>
            <div class="divider"></div>
            <div class="row"><span>${labelInvoice}:</span><span>${summary.receiptId || '-'}</span></div>
            <div class="row"><span>No. CIF:</span><span>${cust.no_cif || '-'}</span></div>
            <div class="row"><span>Nama:</span><span>${custName}</span></div>
            <div class="row"><span>Telp:</span><span>${custPhone}</span></div>
            <div class="row"><span>Warga Negara:</span><span>${custCitizenship}</span></div>
            <div class="divider-double"></div>
            ${itemsHtml}
            <div class="divider"></div>
            <div class="row">
                <span>GRAND TOTAL</span>
                <span>${formatIdr(Math.abs(summary.grandTotal))}</span>
            </div>
            <div class="row"><span>Metode:</span><span>${summary.paymentMethod}</span></div>
            ${summary.paymentMethod === 'SPLIT' ? `
                <div class="row"><span>Via Tunai:</span><span>${formatIdr(Math.abs(summary.payCash))}</span></div>
                <div class="row"><span>Via Transfer:</span><span>${formatIdr(Math.abs(summary.payTransfer))}</span></div>
            ` : ''}
            <div class="divider"></div>
            <div class="row" style="margin-top:20px; font-size: 0.9em;">
                <div style="text-align:center; width:45%;">
                    Petugas / Kasir<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${summary.kasir || (typeof getCurrentUser === 'function' && getCurrentUser() ? getCurrentUser().fullName : 'Kasir')}</div>
                </div>
                <div style="text-align:center; width:45%;">
                    Nasabah (Penerima)<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${recName || '-'}</div>
                </div>
            </div>
            <div class="center" style="margin-top:20px; font-size: 11px; font-style: italic;">
                Kami tidak menanggung kekurangan penerimaan uang atau tuntutan uang palsu setelah meninggalkan counter/ We Don't Accept Claims After Leaving Our Office
            </div>
            <div class="center" style="margin-top:10px; font-weight: bold !important;">${profile.footer || ''}</div>
        </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function printInvoice(cart, summary) {
    const customers = getCustomers();
    const cust = customers.find(c => c.id_nasabah === summary.customerId) || {};
    const custName = cust.nama || 'Pengunjung Biasa';
    let custPhone = cust.no_hp || '-';
    if(custPhone !== '-') custPhone = custPhone.length > 3 ? custPhone.slice(0, -3) + '***' : '***';
    const custCitizenship = cust.kewarganegaraan || '-';
    
    const recIdToUse = summary.receiverId || summary.customerId;
    const rec = recIdToUse === summary.customerId ? cust : (customers.find(c => c.id_nasabah === recIdToUse) || {});
    const recName = recIdToUse === summary.customerId ? custName : (rec.nama || 'Pengunjung Biasa');

    const profile = getProfile();
    const printWindow = window.open('', '_blank');
    
    // Generate Items HTML: Kelompokkan BELI dan JUAL
    let beliHtml = '';
    const beliCart = cart.filter(i => i.type === 'BELI');
    if (beliCart.length > 0) {
        if (cart.some(i => i.type === 'JUAL')) beliHtml = '<tr><td colspan="5" style="font-weight:bold; border-bottom:1px solid #000;">BELI</td></tr>';
        beliHtml += beliCart.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.curCode} ( BELI )</td>
                <td style="text-align: right;">${item.amount.toLocaleString()}</td>
                <td style="text-align: right;">${formatRate(item.rate)}</td>
                <td style="text-align: right;">${formatIdr(item.totalIdr)}</td>
            </tr>
        `).join('');
    }

    let jualHtml = '';
    const jualCart = cart.filter(i => i.type === 'JUAL');
    if (jualCart.length > 0) {
        if (cart.some(i => i.type === 'BELI')) jualHtml = '<tr><td colspan="5" style="font-weight:bold; border-bottom:1px solid #000;">JUAL</td></tr>';
        jualHtml += jualCart.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.curCode} ( JUAL )</td>
                <td style="text-align: right;">${item.amount.toLocaleString()}</td>
                <td style="text-align: right;">${formatRate(item.rate)}</td>
                <td style="text-align: right;">${formatIdr(item.totalIdr)}</td>
            </tr>
        `).join('');
    }

    const itemsHtml = beliHtml + jualHtml;

    const isMixed = beliCart.length > 0 && jualCart.length > 0;


    let labelInvoice = 'No. Invoice';
    if (beliCart.length > 0 && jualCart.length === 0) labelInvoice = 'Invoice Pembelian';
    else if (jualCart.length > 0 && beliCart.length === 0) labelInvoice = 'Invoice Penjualan';
    else if (isMixed) labelInvoice = 'Nota Transaksi';

    const dateStr = window.formatDateToDMY(summary.timestamp || Date.now());
    let contactLine = '';
    const phone = profile.phone || '';
    const wa = profile.phoneWA || '';
    if (phone === wa && phone !== '') {
        contactLine = `<span>Telp/WA: ${phone}</span> | <span>Tgl: ${dateStr}</span>`;
    } else {
        contactLine = `<span>Telp: ${phone || '-'}</span> | <span>WA: ${wa || '-'}</span> | <span>Tgl: ${dateStr}</span>`;
    }

    printWindow.document.write(`
        <html><head>
            <title>Invoice Transaksi</title>
            <style>
                @page { size: 9.5in 5.5in; margin: 0.2in 0.5in; }
                body { font-family: 'Courier New', Courier, monospace; padding: 0; color: #000; margin: 0; font-size: 14px; line-height: 1.3;}
                .header-flex { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 10px;}
                .company-info h1 { margin: 0; color: #000; font-size: 20px; text-transform: uppercase;}
                .company-info p { margin: 3px 0; color: #000; font-size: 13px; }
                .invoice-title { text-align: right; }
                .invoice-title h2 { margin: 0; font-size: 20px; letter-spacing: 1px; color: #000; text-decoration: underline;}
                .invoice-title p { margin: 3px 0; font-size: 13px; color: #000; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; border-top: 1px solid #000; }
                th { padding: 6px; text-align: left; border-bottom: 1px solid #000; font-weight: bold; color: #000; text-transform: uppercase;}
                td { padding: 6px; border-bottom: 1px dashed #ccc; color: #000;}
                
                .totals { margin-top: 10px; text-align: right; float: right; width: 300px; border-top: 1px solid #000; padding-top: 5px;}
                .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
                .totals-row.grand { font-weight: bold; font-size: 16px; border-top: 1px double #000; border-bottom: 1px double #000; color: #000; padding: 8px 0; margin-top: 5px;}
                
                .footer-flex { display: flex; justify-content: space-between; margin-top: 30px; clear: both;}
                .signature-box { text-align: center; width: 220px; }
                .signature-line { height: 60px; margin-bottom: 5px; position: relative; }
                .disclaimer { font-size: 11px; font-style: italic; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; text-align: center; }
            </style>
        </head><body>
            <div class="header-flex">
                <div class="company-info">
                    <h1>${profile.name || 'MC-ALMARA'}</h1>
                    ${profile.biLicense ? `<p style="font-weight: bold; margin-bottom: 5px;">No. Izin: ${profile.biLicense}</p>` : ''}
                    <p style="max-width: 400px; line-height: 1.4;">${profile.address || ''}</p>
                    <div style="margin-top: 5px; font-size: 13px;">
                        ${contactLine}
                    </div>
                </div>
                <div class="invoice-title">
                    <h2>INVOICE</h2>
                    <p><strong>${labelInvoice}:</strong> ${summary.receiptId || '-'}</p>
                    <p><strong>No. CIF:</strong> ${cust.no_cif || '-'}</p>
                    <p><strong>Nama Nasabah:</strong> ${custName || '-'}</p>
                    <p><strong>Telp:</strong> ${custPhone || '-'}</p>
                    <p><strong>Warga Negara:</strong> ${custCitizenship || '-'}</p>
                </div>
            </div>
            
            <p><strong>Metode Pembayaran:</strong> ${summary.paymentMethod}</p>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">NO</th>
                        <th style="width: 25%;">Valas</th>
                        <th style="text-align: right; width: 20%;">Qty</th>
                        <th style="text-align: right; width: 20%;">Kurs</th>
                        <th style="text-align: right; width: 30%;">Jumlah Rp.</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="totals">
                ${summary.paymentMethod === 'SPLIT' ? `
                <div class="totals-row">
                    <span>Tunai:</span>
                    <span>${formatIdr(Math.abs(summary.payCash))}</span>
                </div>
                <div class="totals-row">
                    <span>Transfer:</span>
                    <span>${formatIdr(Math.abs(summary.payTransfer))}</span>
                </div>
                ` : ''}
                <div class="totals-row grand">
                    <span>GRAND TOTAL:</span>
                    <span>${formatIdr(Math.abs(summary.grandTotal))}</span>
                </div>
            </div>
            
            <div class="footer-flex">
                <div class="signature-box">
                    <p>Nasabah</p>
                    <div class="signature-line"></div>
                    <p>( ${recName || '-'} )</p>
                </div>
                <div class="signature-box">
                    <p>Counter / Kasir</p>
                    <div class="signature-line"></div>
                    <p>( ${summary.kasir || (typeof getCurrentUser === 'function' && getCurrentUser() ? getCurrentUser().fullName : 'Kasir')} )</p>
                </div>
            </div>
            
            <div class="disclaimer">
                Kami tidak menanggung kekurangan penerimaan uang atau tuntutan uang palsu setelah meninggalkan counter / We Don't Accept Claims After Leaving Our Office
            </div>
            <div style="text-align: center; margin-top: 15px; font-weight: bold;">${profile.footer || ''}</div>
        </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
}
// ==============================
// CURRENCY MANAGEMENT
// ==============================
function loadCurrencyTable() {
    const currencies = getCurrencies();
    const masterCurrencies = getMasterCurrencies();
    const tbody = document.getElementById('currenciesTableBody');
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';
    tbody.innerHTML = '';

    currencies.forEach(c => {
        const mc = masterCurrencies.find(m => m.code === c.code) || { flag: '', country: '' };
        const tr = document.createElement('tr');
        const isAlert = (c.stock || 0) <= (c.alert || 0);
        
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5rem;" class="currency-flag">${mc.flag || ''}</span>
                    <div>
                        <strong>${c.code}</strong><br>
                        <small style="color: #94A3B8;">${mc.country || 'Unknown'}</small>
                    </div>
                </div>
            </td>
            <td>${formatRate(c.buy)}</td>
            <td>${formatRate(c.sell)}</td>
            <td class="${isAlert ? 'text-red' : ''}"><strong>${(c.stock || 0).toLocaleString()}</strong></td>
            <td>${(c.alert || 0).toLocaleString()}</td>
            <td>
                <span style="font-size: 0.8rem; color: #94A3B8;">B: <strong style="color: #10B981;">${c.margin_buy || 0}</strong></span><br>
                <span style="font-size: 0.8rem; color: #94A3B8;">J: <strong style="color: #ef4444;">${c.margin_sell || 0}</strong></span>
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') && (c.inputBy || c.editBy) ? `
                    <div style="margin-top:5px; font-size:0.7rem; color:#64748b; line-height:1.1;">
                        ${c.inputBy ? `Input: ${c.inputBy}<br>` : ''}
                        ${c.editBy ? `Edit: ${c.editBy}` : ''}
                    </div>
                ` : ''}
            </td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-sm btn-outline" onclick="openCurrencyModal('${c.code}')"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn btn-sm btn-danger" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);" onclick="window.deleteCurrency('${c.code}')"><i class="fa-solid fa-trash"></i> Hapus</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Populate Datalist for new currency if exists
    const dl = document.getElementById('masterCurList');
    if(dl) {
        dl.innerHTML = masterCurrencies.map(m => `<option value="${m.code}">${m.country} ${m.flag}</option>`).join('');
    }
}

function openCurrencyModal(code = null) {
    document.getElementById('currencyModal').classList.add('show');
    const inputCode = document.getElementById('modalCurCode');
    
    if(code) {
        const c = getCurrencies().find(x => x.code === code);
        inputCode.value = c.code;
        inputCode.disabled = true;
        document.getElementById('modalCurBuy').value = c.base_buy !== undefined ? c.base_buy : c.buy;
        document.getElementById('modalCurSell').value = c.base_sell !== undefined ? c.base_sell : c.sell;
        document.getElementById('modalCurStock').value = c.stock;
        document.getElementById('modalCurAlert').value = c.alert || 0;
        document.getElementById('modalMarginBuy').value = c.margin_buy || 0;
        document.getElementById('modalMarginSell').value = c.margin_sell || 0;
        if(window.calculateCurrencyHasil) window.calculateCurrencyHasil();
    } else {
        inputCode.value = '';
        inputCode.disabled = false;
        document.getElementById('modalCurBuy').value = '';
        document.getElementById('modalCurSell').value = '';
        document.getElementById('modalCurStock').value = '';
        document.getElementById('modalCurAlert').value = '';
        document.getElementById('modalMarginSell').value = '';
        if(window.calculateCurrencyHasil) window.calculateCurrencyHasil();
    }
}

function closeCurrencyModal() {
    document.getElementById('currencyModal').classList.remove('show');
}

window.calculateCurrencyHasil = function() {
    const baseBuy = parseFloat(document.getElementById('modalCurBuy').value) || 0;
    const mb = parseFloat(document.getElementById('modalMarginBuy').value) || 0;
    const elBuy = document.getElementById('modalHasilBuy');
    if (elBuy) elBuy.innerText = (baseBuy + mb).toLocaleString('id-ID');
    
    const baseSell = parseFloat(document.getElementById('modalCurSell').value) || 0;
    const ms = parseFloat(document.getElementById('modalMarginSell').value) || 0;
    const elSell = document.getElementById('modalHasilSell');
    if (elSell) elSell.innerText = (baseSell + ms).toLocaleString('id-ID');
};

function saveCurrency() {
    const code = document.getElementById('modalCurCode').value.toUpperCase();
    const baseBuy = parseFloat(document.getElementById('modalCurBuy').value);
    const baseSell = parseFloat(document.getElementById('modalCurSell').value);
    const stock = parseFloat(document.getElementById('modalCurStock').value);
    const alertValue = parseFloat(document.getElementById('modalCurAlert').value);
    const mb = parseFloat(document.getElementById('modalMarginBuy').value) || 0;
    const ms = parseFloat(document.getElementById('modalMarginSell').value) || 0;

    if(!code || isNaN(baseBuy) || isNaN(baseSell)) {
        alert("Kode, Base Rate Beli, dan Jual harus diisi!");
        return;
    }
    
    const buy = baseBuy + mb;
    const sell = baseSell + ms;

    const currencies = getCurrencies();
    const index = currencies.findIndex(c => c.code === code);
    const currUser = getCurrentUser() ? getCurrentUser().fullName : 'Admin Kasir';

    const data = { code, buy, sell, base_buy: baseBuy, base_sell: baseSell, stock: stock || 0, alert: alertValue || 500, margin_buy: mb, margin_sell: ms };

    if(index !== -1) {
        data.inputBy = currencies[index].inputBy || currUser;
        data.editBy = currUser;
        currencies[index] = data; // Update
    } else {
        data.inputBy = currUser;
        data.editBy = '';
        currencies.push(data); // Insert
    }

    saveCurrencies(currencies);
    closeCurrencyModal();
    loadCurrencyTable();
}

window.deleteCurrency = function(code) {
    const currencies = getCurrencies();
    const curInfo = currencies.find(c => c.code === code);
    
    let confirmMsg = `Apakah Anda yakin ingin menghapus valuta ${code} dari daftar kurs aktif?`;
    let isWarning = false;
    
    if(curInfo && curInfo.stock > 0) {
        confirmMsg = `PERHATIAN: Valuta ${code} masih memiliki STOK TERSISA (${curInfo.stock.toLocaleString()}).\nSangat disarankan untuk tidak menghapusnya agar neraca tidak selisih.\n\nTetap paksa hapus?`;
        isWarning = true;
    }
    
    // Gunakan SweetAlert (Swal) asinkron untuk menghindari masalah webview memblokir confirm()
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: isWarning ? 'Peringatan Stok!' : 'Hapus Valuta?',
            text: confirmMsg,
            icon: isWarning ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                executeDeleteCurrency(code, currencies);
            }
        });
    } else {
        if(!confirm(confirmMsg)) return;
        executeDeleteCurrency(code, currencies);
    }
};

function executeDeleteCurrency(code, currencies) {
    const newCurrencies = currencies.filter(c => c.code !== code);
    saveCurrencies(newCurrencies);
    loadCurrencyTable();
    alert(`Valuta ${code} berhasil dihapus.`);
}



// ==============================
// REPORTS
// ==============================
function loadReportsTable() {
    const trxs = getTransactions();
    const startEl = document.getElementById('reportStartDate');
    const endEl = document.getElementById('reportEndDate');
    const startStr = startEl ? startEl.value : '';
    const endStr = endEl ? endEl.value : '';
    
    // Setup Valuta Dropdown dynamically
    const valutaS = document.getElementById('filterValuta');
    if (valutaS && valutaS.options.length <= 1) {
        try {
            const currs = getCurrencies();
            let html = '<option value="">-- Semua Valuta --</option>';
            currs.forEach(c => html += `<option value="${c.code}">${c.code}</option>`);
            valutaS.innerHTML = html;
        } catch(e) { console.error("Filter valuta setup failed:", e); }
    }
    
    const filterInvoice = document.getElementById('filterInvoice') ? document.getElementById('filterInvoice').value.toLowerCase().trim() : '';
    const filterNama    = document.getElementById('filterNama') ? document.getElementById('filterNama').value.toLowerCase().trim() : '';
    const filterHp      = document.getElementById('filterHp') ? document.getElementById('filterHp').value.toLowerCase().trim() : '';
    const filterValuta  = document.getElementById('filterValuta') ? document.getElementById('filterValuta').value : '';
    const filterTipe    = document.getElementById('filterTipe') ? document.getElementById('filterTipe').value : '';
    
    let filteredTrxs = trxs;
    const allCustomers = getCustomers();

    // Optimasi: Buat Map (Indeks) nasabah agar pencarian menjadi O(1) bukannya O(M) berkali-kali
    const custMap = new Map();
    allCustomers.forEach(c => {
        if (c.id_nasabah) custMap.set(String(c.id_nasabah).toLowerCase(), c);
    });
    
    if(startStr && endStr) {
        filteredTrxs = filteredTrxs.filter(t => {
            const date = t.timestamp.split('T')[0];
            return date >= startStr && date <= endStr;
        });
    }
    
    if(filterInvoice) {
        filteredTrxs = filteredTrxs.filter(t => t.id.toLowerCase().includes(filterInvoice));
    }
    if(filterNama || filterHp) {
        filteredTrxs = filteredTrxs.filter(t => {
            if(!t.customerId || t.customerId === '-') return false;
            const cObj = custMap.get(String(t.customerId).toLowerCase());
            if(!cObj) return false;
            
            let matchNama = true;
            let matchHp = true;
            
            if(filterNama) {
                matchNama = cObj.nama && cObj.nama.toLowerCase().includes(filterNama);
            }
            if(filterHp) {
                matchHp = cObj.no_hp && cObj.no_hp.toLowerCase().includes(filterHp);
            }
            
            return matchNama && matchHp;
        });
    }
    if(filterValuta) {
        filteredTrxs = filteredTrxs.filter(t => t.valuta === filterValuta);
    }
    if(filterTipe) {
        filteredTrxs = filteredTrxs.filter(t => t.tipe === filterTipe);
    }

    const tbody = document.getElementById('reportTableBody');
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';
    
    tbody.innerHTML = filteredTrxs.reverse().map(t => {
        let waBtn = '';
        if(t.customerId && t.customerId !== '-') {
            const customer = custMap.get(String(t.customerId).toLowerCase());
            if(customer && customer.no_hp && customer.no_hp !== '-') {
                const waNum = customer.no_hp.replace(/^0+/, '');
                const formattedAmt = formatIdr(t.total || 0);
                const textWa = encodeURIComponent(`Halo, berikut adalah detail transaksi Bapak/Ibu dengan Invoice ${t.id} tgl ${window.formatDateToDMY(t.timestamp)}. Total nominal: ${formattedAmt}.`);
                waBtn = `<a href="https://wa.me/62${waNum}?text=${textWa}" target="_blank" class="btn btn-sm mx-1" style="background:#25d366; color:white;" title="Kirim WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`;
            }
        }

        return `
            <tr>
                <td>
                    ${window.formatDateToDMY(t.timestamp)}
                    ${(currentUserRole === 'admin' || currentUserRole === 'owner') && (t.inputBy || t.editBy) ? `
                        <div style="margin-top:5px; font-size:0.7rem; color:#64748b; line-height:1.1;">
                            ${t.inputBy ? `Input: ${t.inputBy}<br>` : ''}
                            ${t.editBy ? `Edit: ${t.editBy}` : ''}
                        </div>
                    ` : ''}
                </td>
                <td>${t.id}</td>
                <td class="font-weight-bold ${t.tipe === 'BELI' ? 'text-green' : 'text-red'}">${t.tipe}</td>
                <td>${t.customerId || '-'}</td>
                <td>${window.getFlagHtml(t.valuta)}</td>
                <td>${t.nominal.toLocaleString()}</td>
                <td>${formatRate(t.rate)}</td>
                <td>${formatIdr(t.total)}</td>
                <td>
                    ${waBtn}
                    <button type="button" class="btn btn-secondary btn-sm mx-1" onclick="window.reprintReceipt('${t.id}')" title="Cetak Ulang Struk"><i class="fa-solid fa-print"></i></button>
                    <button type="button" class="btn btn-primary btn-sm mx-1" onclick="window.editTransaction('${t.id}')" title="Edit Transaksi"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="btn btn-danger btn-sm mx-1" onclick="window.voidTransaction('${t.id}')" title="Batalkan Transaksi"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="10" class="text-center">Tidak ada transaksi pada periode ini</td></tr>`;
}

window.printBulkReceipts = function() {
    const tbody = document.getElementById('reportTableBody');
    const btnElements = tbody.querySelectorAll('button[onclick^="window.reprintReceipt"]');
    if(btnElements.length === 0) return alert("Tidak ada transaksi untuk dicetak pada tampilan tabel saat ini!");
    
    let receiptIds = new Set();
    btnElements.forEach(btn => {
        const match = btn.getAttribute('onclick').match(/'([^']+)'/);
        if(match) receiptIds.add(match[1]);
    });
    
    const uniqueIds = Array.from(receiptIds);
    if(!confirm(`Apakah Anda yakin ingin mencetak masal ${uniqueIds.length} struk invoice?`)) return;
    
    let fullHtml = `<html><head><title>Cetak Masal</title><style>
        @page { size: 9cm 14cm; margin: 0; }
        html, body { margin: 0; padding: 0; min-height: 100%; }
        body { font-family: monospace; width: 8.6cm; margin: 0 auto; padding: 0.8cm 0.2cm 0.5cm; box-sizing: border-box; font-size: 15px; }
        .center { text-align: center; }
        .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
        .divider-double { border-top: 1px dashed #000; border-bottom: 1px dashed #000; height: 2px; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        small { font-size: 0.8em; color: #555; }
        @media print { .page-break { page-break-after: always; } }
    </style></head><body>`;
    
    const trxs = getTransactions();
    const profile = getProfile();
    const customers = getCustomers();
    
    uniqueIds.forEach((receiptId, idx) => {
        const invoiceTrxs = trxs.filter(t => t.id === receiptId);
        if(invoiceTrxs.length === 0) return;
        
        const firstTrx = invoiceTrxs[0];
        const cust = customers.find(c => c.id_nasabah === firstTrx.customerId) || {};
        const custName = cust.nama || 'Pengunjung Biasa';
        const custPhone = cust.no_hp || '-';
        const custCitizenship = cust.kewarganegaraan || '-';
        
        let recIdToUse = firstTrx.receiverId || firstTrx.customerId;
        const rec = recIdToUse === firstTrx.customerId ? cust : (customers.find(c => c.id_nasabah === recIdToUse) || {});
        const recName = recIdToUse === firstTrx.customerId ? custName : (rec.nama || 'Pengunjung Biasa');
        
        let grandTotal = 0;
        let itemsHtml = '';
        
        const beliTrxs = invoiceTrxs.filter(i => i.tipe === 'BELI');
        const jualTrxs = invoiceTrxs.filter(i => i.tipe === 'JUAL');
        
        const processItems = (items) => {
            items.forEach(item => {
                let sign = item.tipe === 'JUAL' ? 1 : -1;
                grandTotal += (parseFloat(item.total) * sign);
                itemsHtml += `
                    <div class="row">
                    <span>${item.tipe} ${item.nominal} ${item.valuta}<br><small>@ ${formatRate(item.rate)}</small></span>
                    <span>${formatIdr(item.total)}</span>
                    </div>
                `;
            });
        };

        if (beliTrxs.length > 0) processItems(beliTrxs);
        if (beliTrxs.length > 0 && jualTrxs.length > 0) itemsHtml += '<div class="divider" style="border-bottom: 1px dotted #555; margin: 4px 0;"></div>';
        if (jualTrxs.length > 0) processItems(jualTrxs);
        
        let payCash = grandTotal;
        let payTransfer = 0;
        if(firstTrx.paymentMethod === 'TRANSFER') {
            payCash = 0;
            payTransfer = grandTotal;
        } else if(firstTrx.paymentMethod === 'SPLIT') {
            const mutations = window.safeArrayGet('mc_mutations');
            const trxMutation = mutations.find(m => m.keterangan && m.keterangan.includes(receiptId));
            if(trxMutation) {
                let sign = grandTotal < 0 ? -1 : 1;
                payTransfer = trxMutation.nominal * sign;
                payCash = grandTotal - payTransfer;
            }
        }
        
        fullHtml += `
            <div style="margin-bottom: 2rem;">
            <h2 class="center" style="margin-top: 5px;">${profile.name}</h2>
            <div class="center">${profile.address}<br>${profile.phone !== '-' ? 'Telp: ' + profile.phone : ''}</div>
            <div class="divider"></div>
            <div class="row"><span>No. Invoice:</span><span>${receiptId}</span></div>
            <div class="row"><span>Tgl:</span><span>${window.formatDateToDMY(firstTrx.timestamp)}</span></div>
            <div class="row"><span>Nama:</span><span>${custName}</span></div>
            <div class="row"><span>Telp:</span><span>${custPhone}</span></div>
            <div class="row"><span>Warga Negara:</span><span>${custCitizenship}</span></div>
            <div class="divider-double"></div>
            ${itemsHtml}
            <div class="divider"></div>
            <div class="row">
                <strong>GRAND TOTAL ${grandTotal < 0 ? '(KEMBALI)' : '(BAYAR)'}</strong>
                <strong>${formatIdr(Math.abs(grandTotal))}</strong>
            </div>
            <div class="row"><span>Metode:</span><span>${firstTrx.paymentMethod || 'CASH'}</span></div>
            ${firstTrx.paymentMethod === 'SPLIT' ? `
                <div class="row"><span>Via Tunai:</span><span>${formatIdr(Math.abs(payCash))}</span></div>
                <div class="row"><span>Via Transfer:</span><span>${formatIdr(Math.abs(payTransfer))}</span></div>
            ` : ''}
            <div class="divider"></div>
            <div class="row" style="margin-top:20px; font-weight:bold; font-size: 0.8em;">
                <div style="text-align:center; width:45%;">
                    Petugas / Kasir<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${profile.name}</div>
                </div>
                <div style="text-align:center; width:45%;">
                    Nasabah (Penerima)<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${recName}</div>
                </div>
            </div>
            <div class="center" style="margin-top:20px;">${profile.footer}</div>
            </div>
        `;
        
        if (idx < uniqueIds.length - 1) {
            fullHtml += `<div class="page-break"></div>`;
        }
    });
    
    fullHtml += `</body></html>`;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.setTimeout(() => printWindow.print(), 500);
}

window.reprintReceipt = function(receiptId) {
    const trxs = getTransactions();
    const invoiceTrxs = trxs.filter(t => t.id === receiptId);
    if(invoiceTrxs.length === 0) return alert("Transaksi tidak ditemukan!");
    
    const cart = invoiceTrxs.map(t => ({
        id: t.itemId,
        type: t.tipe,
        curCode: t.valuta,
        amount: parseFloat(t.nominal),
        rate: parseFloat(t.rate),
        totalIdr: parseFloat(t.total)
    }));
    
    let grandTotal = 0;
    cart.forEach(item => {
        let sign = item.type === 'JUAL' ? 1 : -1;
        grandTotal += (item.totalIdr * sign);
    });
    
    const firstTrx = invoiceTrxs[0];
    const summary = {
        receiptId: receiptId,
        paymentMethod: firstTrx.paymentMethod || 'CASH',
        grandTotal: grandTotal,
        payCash: grandTotal,
        payTransfer: 0,
        customerId: firstTrx.customerId,
        receiverId: firstTrx.receiverId || firstTrx.customerId,
        timestamp: firstTrx.timestamp,
        kasir: firstTrx.kasir
    };
    
    if(firstTrx.paymentMethod === 'TRANSFER') {
        summary.payCash = 0;
        summary.payTransfer = grandTotal;
    } else if(firstTrx.paymentMethod === 'SPLIT') {
        const mutations = window.safeArrayGet('mc_mutations');
        const trxMutation = mutations.find(m => m.keterangan && m.keterangan.includes(receiptId));
        if(trxMutation) {
            let sign = grandTotal < 0 ? -1 : 1;
            summary.payTransfer = trxMutation.nominal * sign;
            summary.payCash = grandTotal - summary.payTransfer;
        }
    }
    
    printReceipt(cart, summary);
}

window.voidTransaction = function(id) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Batalkan Transaksi?',
            text: 'Anda yakin ingin MEMBATALKAN transaksi ' + id + '? Stok valuta dan Kas IDR akan ditarik/direstorasi ke posisi semula.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Batalkan!'
        }).then((result) => {
            if (result.isConfirmed) {
                processVoid(id);
            }
        });
    } else {
        if(!confirm('Anda yakin ingin MEMBATALKAN transaksi ' + id + '? Stok valuta dan Kas IDR akan ditarik/direstorasi ke posisi semula.')) return false;
        processVoid(id);
    }

    function processVoid(id) {
        let trxs = getTransactions();
        const trxGroup = trxs.filter(t => t.id === id);
        if(trxGroup.length === 0) {
            alert("Data transaksi tidak ditemukan!");
            return false;
        }
        
        let currencies = getCurrencies();
        let kasTunai = getCash();
        let bankBCA = getBankBCA();
        let bankMandiri = getBankMandiri();
        
        // Reverse logic mapping
        // If it was 'JUAL', we previously DEDUCTED stock, so we ADD it back.
        // IF it was 'BELI', we previously ADDED stock, so we DEDUCT it back.
        let grandTotal = 0;
        
        trxGroup.forEach(t => {
            const curIdx = currencies.findIndex(c => c.code === t.valuta);
            if(curIdx > -1) {
                if(t.tipe === 'JUAL') {
                    currencies[curIdx].stock += t.nominal;
                } else {
                    currencies[curIdx].stock -= t.nominal;
                }
            }
            
            // Sum IDR flow reversed
            let sign = t.tipe === 'JUAL' ? 1 : -1;
            grandTotal += (t.total * sign); // Original grand total logic (+ receive, - pay)
        });
        
        const paymentMethod = trxGroup[0].paymentMethod;
        const bankTgt = trxGroup[0].bank || 'BCA';
        if (paymentMethod === 'TRANSFER') {
            if (bankTgt === 'BCA') bankBCA -= grandTotal;
            else bankMandiri -= grandTotal;
        } else {
            kasTunai -= grandTotal; // For SPLIT or CASH, default to cash deduction restitution
        }
        
        // Apply restitution
        saveCurrencies(currencies);
        saveCash(kasTunai);
        saveBankBCA(bankBCA);
        saveBankMandiri(bankMandiri);
        
        // Filter out the voided ID
        const newTrxs = trxs.filter(t => t.id !== id);
        saveTransactions(newTrxs);
        
        // Filter out associated bank mutation
        let mutations = getMutations();
        const filteredMut = mutations.filter(m => !m.keterangan.includes(id));
        saveMutations(filteredMut);
        
        alert(`Transaksi ${id} sukses dihapus dan dibatalkan!`);
        loadReportsTable(); // refresh (typo fixed)
        loadDashboard();
    }
}

window.editTransaction = function(id) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Lanjut Mengedit?',
            text: 'Transaksi ' + id + ' akan disalin ke keranjang Kasir untuk Anda sesuaikan. Lanjutkan?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Ya, Lanjutkan'
        }).then((result) => {
            if (result.isConfirmed) {
                processEdit(id);
            }
        });
    } else {
        if(!confirm('Lanjut Mengedit: Transaksi ' + id + ' akan disalin ke keranjang Kasir untuk Anda sesuaikan. Lanjutkan?')) return false;
        processEdit(id);
    }

    function processEdit(id) {
        let trxs = getTransactions();
        const trxGroup = trxs.filter(t => t.id === id);
        if(trxGroup.length === 0) {
            alert("Aksi Edit Gagal: Data riwayat transaksi tidak ditemukan di sistem!");
            return false;
        }
        
        // 1. VOID silently logic dipindahkan ke processPayment() 
        // agar transaksi asli tidak hilang sebelum checkout sukses.
        
        // 2. Load into Cart
        window.preserveCart = true;
        window.editingTrxId = id;
        window.editingTrxTimestamp = trxGroup[0].timestamp;
        window.editingTrxInputBy = trxGroup[0].inputBy;
        
        currentCart = trxGroup.map(t => ({
            id: t.itemId || Date.now().toString(),
            type: t.tipe,
            curCode: t.valuta,
            amount: t.nominal,
            rate: t.rate,
            totalIdr: t.total
        }));
        
        renderCart();

        // Load Customer
        if(trxGroup[0].customerId) {
            document.getElementById('trxCustomer').value = trxGroup[0].customerId;
        }
        
        alert('Sukses dimuat ke Kasir! Silakan sesuaikan dan klik Checkout untuk menyimpan transaksi baru (transaksi lama di riwayat akan ditimpa).');
        
        // Force UI to switch to pos-view manually
        const posTab = document.querySelector('.nav-item[data-target="pos-view"]');
        if(posTab) posTab.click();
    }
}

// Export to Excel using SheetJS
const btnExportExcel = document.getElementById('btnExportExcel');
if (btnExportExcel) {
    btnExportExcel.addEventListener('click', async () => {
        const tb = document.getElementById('reportTable');
        if(tb && tb.rows.length <= 1) {
            alert("Tidak ada data untuk diexport!");
            return;
        }
        if (tb) {
            const ws = XLSX.utils.table_to_sheet(tb);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Laporan_KUPVA");
            await window.safeExportXLSX(wb, `Laporan_MC_${new Date().toISOString().split('T')[0]}.xlsx`);
        }
    });
}

// ==============================
// CUSTOMER MANAGEMENT (KYC)
// ==============================
function filterCustomersTable() {
    const search = document.getElementById('searchCustomerInput') ? document.getElementById('searchCustomerInput').value.toLowerCase() : '';
    const typeFilter = document.getElementById('filterCustomerType') ? document.getElementById('filterCustomerType').value : 'ALL';
    
    // New Date Filters
    const startDate = document.getElementById('filterCustomerDateStart') ? document.getElementById('filterCustomerDateStart').value : '';
    const endDate = document.getElementById('filterCustomerDateEnd') ? document.getElementById('filterCustomerDateEnd').value : '';
    
    let customers = getCustomers();
    
    if(typeFilter !== 'ALL') {
        customers = customers.filter(c => c.kn === typeFilter);
    }
    
    if(startDate || endDate) {
        customers = customers.filter(c => {
            if(!c.tgl_daftar) return false;
            let dObj = null;
            let rawStr = String(c.tgl_daftar).trim();
            if(rawStr === '-' || rawStr === '') return false;
            
            let parts = rawStr.split(/[-/ T]/);
            
            if(rawStr.includes('-') && parts.length >= 3 && parts[0].length === 4) {
               dObj = new Date(rawStr); // ISO/YYYY-MM-DD
            } else if(parts.length >= 3 && parts[0].length <= 2) {
                // assume DD/MM/YYYY. Set to 12PM noon to avoid timezone shift into previous day
                dObj = new Date(parts[2].slice(0,4), parseInt(parts[1])-1, parseInt(parts[0]), 12, 0, 0); 
            } else {
                dObj = new Date(rawStr);
            }
            
            // Failsafe: IF date is completely corrupt/unreadable, DO NOT hide the customer permanently!
            if(isNaN(dObj.getTime())) return true; 
            
            // Format flawlessly to YYYY-MM-DD using native get methods to ignore timezone complexities
            let yyyy = dObj.getFullYear();
            let mm = String(dObj.getMonth() + 1).padStart(2, '0');
            let dd = String(dObj.getDate()).padStart(2, '0');
            let customerDateStr = `${yyyy}-${mm}-${dd}`;
            
            let passStart = true;
            let passEnd = true;
            
            if(startDate) passStart = customerDateStr >= startDate;
            if(endDate) passEnd = customerDateStr <= endDate;
            
            return passStart && passEnd;
        });
    }
    if(search) {
        customers = customers.filter(c => 
            (c.nama && c.nama.toLowerCase().includes(search)) ||
            (c.id_nasabah && c.id_nasabah.toLowerCase().includes(search)) ||
            (c.no_hp && c.no_hp.toLowerCase().includes(search)) ||
            (c.no_ktp !== '-' && c.no_ktp.toLowerCase().includes(search)) ||
            (c.selain_ktp !== '-' && c.selain_ktp.toLowerCase().includes(search))
        );
    }

    const tbody = document.getElementById('customersTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';

    customers.forEach(c => {
        const tr = document.createElement('tr');
        const fallbackId = c.id_nasabah || c.local_id || c.no_cif || c.nama || '';
        tr.setAttribute('data-id', fallbackId);
        const knLabel = c.kn === '1' ? 'Perorangan' : (c.kn === '2' ? 'Corporate' : '-');
        const jenisId = c.jenis_id || (c.no_ktp !== '-' ? 'KTP' : (c.selain_ktp !== '-' ? 'Lainnya' : '-'));
        const noKtp = c.no_ktp !== '-' ? c.no_ktp : '-';
        const idLain = c.selain_ktp !== '-' && c.selain_ktp !== c.no_ktp ? c.selain_ktp : '-';

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="chk-cust" value="${c.id_nasabah}" onchange="updateBlastWaCount()"></td>
            <td><strong>${c.id_nasabah}</strong></td>
            <td>${c.idpjk || '-'}</td>
            <td>${knLabel}</td>
            <td>${c.no_hp || '-'}</td>
            <td>
                ${c.nama || '-'}
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') && (c.inputBy || c.editBy) ? `
                    <div style="margin-top:5px; font-size:0.7rem; color:#64748b; line-height:1.1;">
                        ${c.inputBy ? `Input: ${c.inputBy}<br>` : ''}
                        ${c.editBy ? `Edit: ${c.editBy}` : ''}
                    </div>
                ` : ''}
            </td>
            <td>${c.tempat_lahir || '-'}</td>
            <td>${formatDateOnly(c.tanggal_lahir)}</td>
            <td>${c.alamat || '-'}</td>
            <td>${jenisId}</td>
            <td>${noKtp}</td>
            <td>${idLain}</td>
            <td>${c.no_cif || '-'}</td>
            <td>${c.npwp || '-'}</td>
            <td>${c.local_id || '-'}</td>
            <td>${c.jenis_kelamin || '-'}</td>
            <td>${c.warga_negara || '-'}</td>
            <td>${c.pekerjaan || '-'}</td>
            <td>${c.no_rekening || '-'}</td>
            <td style="position: sticky; right: 0; background: #1e293b; z-index: 1; box-shadow: -4px 0 10px rgba(0,0,0,0.2);">
                <div style="display: flex; gap: 6px; padding: 6px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; justify-content: center; align-items: center; white-space: nowrap; width: max-content;">
                    <button class="btn btn-sm" style="background:#0ea5e9; color:white; border:none; margin:0;" onclick="handleCustAction(this, 'preview')" title="Preview Detail Nasabah"><i class="fa-solid fa-eye"></i></button>
                    ${c.no_hp && c.no_hp !== '-' ? `<a href="https://wa.me/62${c.no_hp.replace(/^0+/, '')}" target="_blank" class="btn btn-sm" style="background:#25d366; color:white; margin:0;" title="Kirim Pesan WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
                    <button class="btn btn-sm btn-primary" style="margin:0;" onclick="handleCustAction(this, 'edit')"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn btn-sm btn-danger" style="margin:0;" onclick="handleCustAction(this, 'delete')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Reset "Select All" checkbox if exists
    const chkAll = document.getElementById('chkAllCust');
    if(chkAll) chkAll.checked = false;
    if(typeof updateBlastWaCount === 'function') updateBlastWaCount();
}

function loadCustomersTable() {
    // Initialize or restore view without filters
    const searchInput = document.getElementById('searchCustomerInput');
    const filterInput = document.getElementById('filterCustomerType');
    if(searchInput) searchInput.value = '';
    if(filterInput) filterInput.value = 'ALL';
    
    filterCustomersTable();
}

function deleteCustomer(id) {
    if(confirm('Hapus data nasabah ini? Tindakan ini tidak dapat dibatalkan.')) {
        let customers = getCustomers();
        customers = customers.filter(c => String(c.id_nasabah) !== String(id));
        saveCustomers(customers);
        loadCustomersTable();
        
        // SINKRONISASI HAPUS KE LARAVEL
        fetch(`/api/customers?id_nasabah=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        }).then(res => res.json())
          .then(data => console.log("Hapus Laravel Status:", data))
          .catch(err => console.error("Hapus Laravel Gagal:", err));
    }
}

window.resetAllCustomersData = async function() {
    console.log("Tombol Reset Diklik - Memulai Proses Pembersihan...");
    
    if (typeof Swal === 'undefined') {
        alert("Sistem Peringatan (SweetAlert) belum dimuat. Coba refresh halaman.");
        return;
    }

    const firstConfirm = await Swal.fire({
        title: 'PERHATIAN!',
        text: 'Anda akan menghapus SELURUH data nasabah secara permanen dari browser dan database. Tindakan ini TIDAK DAPAT DIBATALKAN. Lanjutkan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus Semua!',
        cancelButtonText: 'Batal'
    });

    if (!firstConfirm.isConfirmed) return;

    const secondConfirm = await Swal.fire({
        title: 'KONFIRMASI TERAKHIR',
        text: 'Anda BENAR-BENAR ingin menghapus SEMUA data nasabah?',
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'SAYA YAKIN, HAPUS AKTUNG!',
        cancelButtonText: 'Batal'
    });

    if (!secondConfirm.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Menghapus Data...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // 1. Clear Database (Laravel)
        const request = window.authFetch || fetch;
        const res = await request('/api/customers/clear-all', {
            method: 'DELETE'
        });
        const result = await res.json();

        if(result.status === 'success') {
            // 2. Clear LocalStorage setelah server sukses
            localStorage.removeItem('mc_customers');
            if(typeof loadCustomersTable === 'function') loadCustomersTable();
            Swal.fire({
                icon: 'success',
                title: 'Data Bersih',
                text: 'Seluruh data nasabah telah dihapus dari sistem.',
                background: '#1e293b',
                color: '#fff'
            });
        } else {
            Swal.fire("Selesai Sebagian", "Berhasil hapus lokal, tapi database gagal: " + result.message, "warning");
        }
    } catch(e) {
        console.error("Reset Gagal:", e);
        Swal.fire("Error", "Terjadi kesalahan sistem saat mencoba menghapus data.", "error");
    }
}

// Unified Handler for Customer Actions
window.handleCustAction = function(btn, mode) {
    const tr = btn.closest('tr');
    if(!tr) {
        console.error("Action handler error: Table row (TR) not found.");
        return;
    }
    const id = tr.getAttribute('data-id');
    console.log(`[CustomerAction] Mode: ${mode}, ID: ${id}`);
    
    if (!id || id === "") {
        console.warn("Action handler warning: data-id is empty for this row.");
    }

    if (mode === 'preview') {
        window.previewCustomer(id);
    } else if (mode === 'edit') {
        window.triggerCustomerEditDirect(id);
    } else if (mode === 'delete') {
        window.deleteCustomer(id);
    }
};

window.editFromPreview = function() {
    // Ambil ID yang sedang ditampilkan di preview
    const idEl = document.getElementById('previewCustId');
    const id = idEl ? idEl.textContent.trim() : null;
    
    console.log("[EditFromPreview] ID captured:", id);
    
    if (id && id !== '-' && id !== '') {
        // Tutup preview dulu
        if (typeof window.closeCustomerPreviewModal === 'function') {
            window.closeCustomerPreviewModal();
        } else {
            const previewModal = document.getElementById('customerPreviewModal');
            if (previewModal) previewModal.classList.remove('show');
        }
        
        // Beri jeda sedikit agar transisi modal mulus
        setTimeout(() => {
            window.openCustomerUpdateModal(id);
        }, 200);
    } else {
        if (typeof Swal !== 'undefined') {
            Swal.fire("Gagal", "ID Nasabah tidak valid atau kosong di preview.", "error");
        } else {
            alert("ID Nasabah tidak valid untuk diedit.");
        }
    }
};

// ==============================
// STANDARDIZED ID GENERATION
// ==============================
window.generateStandardId = function() {
    const customers = getCustomers();
    let max = 10000; // Mulai dari 10001
    customers.forEach(c => {
        if(c.id_nasabah && c.id_nasabah.startsWith('ALM-')) {
            const num = parseInt(c.id_nasabah.split('-')[1]);
            if(!isNaN(num) && num > max) max = num;
        }
    });
    return `ALM-${max + 1}`;
};

window.generateStandardCif = function() {
    const today = new Date();
    const dateStr = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    const customers = getCustomers();
    
    let dailyMax = 0;
    const prefix = `CIF-${dateStr}-`;
    customers.forEach(c => {
        if(c.no_cif && c.no_cif.startsWith(prefix)) {
            const num = parseInt(c.no_cif.replace(prefix, ''));
            if(!isNaN(num) && num > dailyMax) dailyMax = num;
        }
    });
    
    return `${prefix}${String(dailyMax + 1).padStart(4, '0')}`;
};

window.previewCustomer = function(id) {
    const searchId = String(id || '').trim().toLowerCase();
    const c = getCustomers().find(x => 
        (x.id_nasabah && String(x.id_nasabah).trim().toLowerCase() === searchId) ||
        (x.local_id && String(x.local_id).trim().toLowerCase() === searchId) ||
        (x.no_cif && String(x.no_cif).trim().toLowerCase() === searchId) ||
        (x.nama && String(x.nama).trim().toLowerCase() === searchId)
    );
    if(!c) return;
    
    document.getElementById('previewCustId').textContent = c.id_nasabah || '-';
    document.getElementById('previewCustName').textContent = c.nama || '-';
    document.getElementById('previewCustType').textContent = c.kn === '1' ? 'Perorangan' : (c.kn === '2' ? 'Corporate' : '-');
    document.getElementById('previewCustPhone').textContent = c.no_hp || '-';
    document.getElementById('previewCustBirth').textContent = (c.tempat_lahir || '-') + ' / ' + (typeof formatDateOnly === 'function' ? formatDateOnly(c.tanggal_lahir) : (c.tanggal_lahir || '-'));
    document.getElementById('previewCustAddress').textContent = c.alamat || '-';
    document.getElementById('previewCustGender').textContent = c.jenis_kelamin || '-';
    document.getElementById('previewCustCitizen').textContent = c.warga_negara || '-';
    document.getElementById('previewCustJob').textContent = c.pekerjaan || '-';
    document.getElementById('previewCustIdType').textContent = c.jenis_id || '-';
    document.getElementById('previewCustKtp').textContent = c.no_ktp || '-';
    document.getElementById('previewCustOtherId').textContent = c.selain_ktp || '-';
    document.getElementById('previewCustCif').textContent = c.no_cif || '-';
    document.getElementById('previewCustNpwp').textContent = c.npwp || '-';
    document.getElementById('previewCustBank').textContent = c.no_rekening || '-';
    document.getElementById('previewCustLocalId').textContent = c.local_id || '-';
    document.getElementById('previewCustRegDate').textContent = typeof formatDateToDMY === 'function' ? formatDateToDMY(c.tgl_daftar) : (c.tgl_daftar || '-');
    document.getElementById('previewCustAddress').textContent = c.alamat || '-';
    document.getElementById('previewCustGender').textContent = c.jenis_kelamin || '-';
    document.getElementById('previewCustCitizen').textContent = c.warga_negara || '-';
    document.getElementById('previewCustJob').textContent = c.pekerjaan || '-';
    document.getElementById('previewCustIdType').textContent = c.jenis_id || '-';
    document.getElementById('previewCustKtp').textContent = c.no_ktp !== '-' ? c.no_ktp : '-';
    document.getElementById('previewCustOtherId').textContent = c.selain_ktp !== '-' ? c.selain_ktp : '-';
    document.getElementById('previewCustCif').textContent = c.no_cif || '-';
    document.getElementById('previewCustNpwp').textContent = c.npwp || '-';
    document.getElementById('previewCustBank').textContent = c.no_rekening || '-';
    document.getElementById('previewCustLocalId').textContent = c.local_id || '-';
    document.getElementById('previewCustRegDate').textContent = c.tgl_daftar ? formatDateOnly(c.tgl_daftar) : '-';

    const photoPreview = document.getElementById('previewCustPhotoImg');
    if (photoPreview) {
        if (c.foto_id) {
            photoPreview.src = c.foto_id;
            photoPreview.style.display = 'block';
        } else {
            photoPreview.style.display = 'none';
            photoPreview.src = '';
        }
    }

    document.getElementById('customerPreviewModal').classList.add('show');
};

window.closeCustomerPreviewModal = function() {
    document.getElementById('customerPreviewModal').classList.remove('show');
};

// ==============================
// BROADCAST WA LOGIC
// ==============================
window.toggleAllCustomers = function(el) {
    const tbody = document.getElementById('customersTableBody');
    if(!tbody) return;
    const checkboxes = tbody.querySelectorAll('.chk-cust');
    checkboxes.forEach(chk => {
        // Only check those that are currently visible/filtered
        if (chk.closest('tr').style.display !== 'none') {
            chk.checked = el.checked;
        }
    });
    updateBlastWaCount();
};

window.updateBlastWaCount = function() {
    const checkboxes = document.querySelectorAll('.chk-cust:checked');
    let validCount = 0;
    const allCustomers = getCustomers();
    checkboxes.forEach(chk => {
        const c = allCustomers.find(xc => String(xc.id_nasabah) === String(chk.value));
        if(c && c.no_hp && c.no_hp !== '-') validCount++;
    });
    const countEl = document.getElementById('blastWaCount');
    if(countEl) countEl.innerText = validCount;
};

window.openBlastWaModal = function() {
    const checkboxes = document.querySelectorAll('.chk-cust:checked');
    if(checkboxes.length === 0) {
        alert("Pilih minimal satu nasabah dengan mencontreng kotaknya di tabel terlebih dahulu.");
        return;
    }
    document.getElementById('blastWaModal').classList.add('show');
    document.getElementById('blastWaSetupView').classList.remove('hidden');
    document.getElementById('blastWaQueueView').classList.add('hidden');
    updateBlastWaCount();
};

window.closeBlastWaModal = function() {
    document.getElementById('blastWaModal').classList.remove('show');
};

window.startBlastWa = function() {
    const template = document.getElementById('blastWaTemplate').value;
    if(!template.trim()) {
        alert("Silakan ketik pesan template terlebih dahulu!");
        return;
    }

    const checkboxes = document.querySelectorAll('.chk-cust:checked');
    const allCustomers = getCustomers();
    const queueBody = document.getElementById('blastWaQueueBody');
    queueBody.innerHTML = '';
    
    let queuedCount = 0;
    checkboxes.forEach(chk => {
        const c = allCustomers.find(xc => String(xc.id_nasabah) === String(chk.value));
        if(c && c.no_hp && c.no_hp !== '-') {
            queuedCount++;
            const tr = document.createElement('tr');
            let finalMsg = template.replace(/\[NAMA\]/g, c.nama || 'Bapak/Ibu');
            const waNum = c.no_hp.replace(/^0+/, ''); // Clean leading zeros
            
            tr.innerHTML = `
                <td>${c.nama}</td>
                <td>0${waNum}</td>
                <td>
                    <button class="btn btn-sm btn-success btn-wa-send" onclick="sendWaTo('62${waNum}', encodeURIComponent(\`${finalMsg}\`), this)">
                        <i class="fa-solid fa-paper-plane"></i> Kirim WA
                    </button>
                </td>
            `;
            queueBody.appendChild(tr);
        }
    });

    if(queuedCount === 0) {
        alert("Nasabah yang Anda pilih tidak memiliki nomor HP yang valid.");
        return;
    }

    document.getElementById('blastWaSetupView').classList.add('hidden');
    document.getElementById('blastWaQueueView').classList.remove('hidden');
};

window.sendWaTo = function(phone, msg, btnElement) {
    const url = `https://wa.me/${phone}?text=${msg}`;
    window.open(url, '_blank');
    
    btnElement.classList.remove('btn-success');
    btnElement.classList.add('btn-secondary');
    btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Terkirim';
};

// ==============================
// CUSTOMER EDIT/UPDATE MODAL LOGIC (DEDICATED)
// ==============================

// Global var for photo base64 during update
let currentUpdateCustPhotoBase64 = null;

window.previewUpdateCustPhoto = function(input) {
    const preview = document.getElementById('update_previewImg');
    const placeholder = document.getElementById('update_photoPlaceholder');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUpdateCustPhotoBase64 = e.target.result;
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        }
        reader.readAsDataURL(input.files[0]);
    }
};

window.openCustomerUpdateModal = function(id) {
    console.log("[OpenUpdateModal] Memanggil data untuk ID:", id);
    const customers = typeof getCustomers === 'function' ? getCustomers() : [];
    
    // Pencarian Lapis Tiga: Prioritas id_nasabah, lalu local_id, lalu no_cif, terakhir nama
    const searchId = String(id || '').trim().toLowerCase();
    const cust = customers.find(x => 
        (x.id_nasabah && String(x.id_nasabah).trim().toLowerCase() === searchId) ||
        (x.local_id && String(x.local_id).trim().toLowerCase() === searchId) ||
        (x.no_cif && String(x.no_cif).trim().toLowerCase() === searchId) ||
        (x.nama && String(x.nama).trim().toLowerCase() === searchId)
    );

    if (!cust) {
        console.error("[OpenUpdateModal] Nasabah tidak ditemukan:", id);
        Swal.fire({
            icon: "error",
            title: "Data Tidak Ditemukan",
            text: `Data Nasabah dengan ID ${id} tidak ditemukan.`,
            background: '#1e293b',
            color: '#f8fafc'
        });
        return;
    }

    // Tampilkan Modal dulu agar elemen tersedia di DOM
    const $modal = $('#customerUpdateModal');
    if (!$modal.length) {
        console.error("Elemen #customerUpdateModal tidak ditemukan di DOM!");
        return;
    }
    $modal.addClass('show');
    $modal.css('display', 'block');

    // Jeda sangat singkat (30ms) untuk optimasi kecepatan
    setTimeout(() => {
        console.log("[OpenUpdateModal] Memulai pengisian form (Fast 30ms)...");

        // Update Judul (Instant)
        const titleEl = document.querySelector('#customerUpdateModal h2');
        if(titleEl) titleEl.textContent = "Update Data: " + (cust.nama || 'Nasabah');

        // Helper Set (Vanilla ONLY)
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if(el) {
                el.value = (val !== null && val !== undefined) ? val : '';
            }
        };

        // Populate!
        setVal('update_modalCustId', id);
        setVal('update_modalCustName', cust.nama);
        setVal('update_modalCustPhone', cust.no_hp);
        setVal('update_modalCustBirthPlace', cust.tempat_lahir);
        setVal('update_modalCustBirthDate', cust.tanggal_lahir);
        setVal('update_modalCustAddress', cust.alamat);
        setVal('update_modalCustNik', cust.no_ktp);
        setVal('update_modalCustIdNo', cust.selain_ktp);
        setVal('update_modalCustNpwp', cust.npwp);
        setVal('update_modalCustLocalId', cust.local_id);
        setVal('update_modalCustBankAcc', cust.no_rekening);
        setVal('update_modalCustIdpjk', cust.idpjk);
        setVal('update_modalCustInternalId', cust.id_nasabah);
        setVal('update_modalCustCif', cust.no_cif);
        setVal('update_modalCustUpdateDate', new Date().toLocaleString('id-ID'));

        // Tipe Entitas (Radio)
        const knVal = String(cust.kn || '1');
        const rad1 = document.getElementById('update_typePerorangan');
        const rad2 = document.getElementById('update_typePerusahaan');
        if(knVal === '2' && rad2) rad2.checked = true;
        else if(rad1) rad1.checked = true;

        // Dropdowns (Hanya isi jika kosong untuk hemat CPU/RAM)
        const elIdType = document.getElementById('update_modalCustIdType');
        if(elIdType) {
            elIdType.value = cust.jenis_id || 'KTP';
            $(elIdType).trigger('change');
        }
        
        const elGender = document.getElementById('update_modalCustGender');
        if(elGender) {
            elGender.value = cust.jenis_kelamin || 'Pria';
            $(elGender).trigger('change');
        }

        const elCitizen = document.getElementById('update_modalCustCitizen');
        if(elCitizen) {
            if (elCitizen.options.length <= 1 && typeof getMasterCitizens === 'function') {
                const citizens = getMasterCitizens();
                $(elCitizen).empty().append('<option value="">Pilih Kewarganegaraan</option>');
                citizens.forEach(c => $(elCitizen).append(`<option value="${c.name || c}">${c.name || c}</option>`));
            }
            $(elCitizen).val(cust.warga_negara || '').trigger('change');
        }

        const elJob = document.getElementById('update_modalCustJob');
        if(elJob) {
            if (elJob.options.length <= 1 && typeof getMasterJobs === 'function') {
                const jobs = getMasterJobs();
                $(elJob).empty().append('<option value="">Pilih Pekerjaan</option>');
                jobs.forEach(j => $(elJob).append(`<option value="${j.name || j}">${j.name || j}</option>`));
            }
            $(elJob).val(cust.pekerjaan || '').trigger('change');
        }

        // Photo Preview (Pure Vanilla)
        const img = document.getElementById('update_previewImg');
        const placeholder = document.getElementById('update_photoPlaceholder');
        if (cust.foto_id && img && placeholder) {
            img.src = cust.foto_id;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        } else if(img && placeholder) {
            img.style.display = 'none';
            placeholder.style.display = 'block';
        }

        // Flatpickr Re-init
        if (typeof flatpickr !== 'undefined') {
            flatpickr("#update_modalCustBirthDate", { 
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "d M Y",
                locale: "id"
            });
        }
    }, 30);

    
    console.log("[OpenUpdateModal] Form populated successfully.");
};

window.updateCustomer = function() {
    const id = $('#update_modalCustId').val();
    if (!id) {
        Swal.fire("Error", "ID Nasabah tidak ditemukan di input hidden.", "error");
        return;
    }

    let customers = getCustomers(); // Ini mengambil dari 'mc_customers'
    const searchId = String(id || '').trim().toLowerCase();
    const index = customers.findIndex(x => 
        (x.id_nasabah && String(x.id_nasabah).trim().toLowerCase() === searchId) ||
        (x.local_id && String(x.local_id).trim().toLowerCase() === searchId) ||
        (x.no_cif && String(x.no_cif).trim().toLowerCase() === searchId) ||
        (x.nama && String(x.nama).trim().toLowerCase() === searchId)
    );

    if (index === -1) {
        Swal.fire("Error", "Data nasabah tidak ditemukan di penyimpanan lokal.", "error");
        return;
    }

    // Ambil data dari form
    const updatedData = {
        ...customers[index],
        nama: $('#update_modalCustName').val(),
        no_hp: $('#update_modalCustPhone').val(),
        tempat_lahir: $('#update_modalCustBirthPlace').val(),
        tanggal_lahir: $('#update_modalCustBirthDate').val(),
        alamat: $('#update_modalCustAddress').val(),
        jenis_id: $('#update_modalCustIdType').val(),
        no_ktp: $('#update_modalCustNik').val(),
        selain_ktp: $('#update_modalCustIdNo').val(),
        jenis_kelamin: $('#update_modalCustGender').val(),
        warga_negara: $('#update_modalCustCitizen').val(),
        pekerjaan: $('#update_modalCustJob').val(),
        npwp: $('#update_modalCustNpwp').val(),
        local_id: $('#update_modalCustLocalId').val(),
        no_rekening: $('#update_modalCustBankAcc').val(),
        no_cif: $('#update_modalCustCif').val(),
        idpjk: $('#update_modalCustIdpjk').val(),
        foto_id: currentUpdateCustPhotoBase64,
        editBy: getCurrentUser() ? getCurrentUser().username : 'system',
        tgl_update: new Date().toISOString(),
        kn: $('input[name="update_custType"]:checked').val() || customers[index].kn
    };

    // Update Array & Local Storage (Perbaiki Key ke mc_customers)
    customers[index] = updatedData;
    localStorage.setItem('mc_customers', JSON.stringify(customers));

    // Sinkronisasi ke MySQL
    if (typeof window.saveToMySQL_Customer === 'function') {
        window.saveToMySQL_Customer(updatedData);
    }

    Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Data nasabah telah diperbarui.',
        timer: 1500,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f8fafc'
    });

    // Tutup Modal
    const modal = document.getElementById('customerUpdateModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    
    // Refresh Table
    if (typeof window.renderCustomersTable === 'function') {
        window.renderCustomersTable();
    } else if (typeof window.loadCustomersTable === 'function') {
        window.loadCustomersTable();
    }
};

window.isEditingCustomer = false;

window.triggerCustomerEditDirect = function(targetId = null) {
    const id = (targetId && typeof targetId === 'string') ? targetId.trim() : targetId;
    
    if (id && id !== "") {
        // Now redirects to the dedicated Update Modal
        window.openCustomerUpdateModal(id);
        return;
    }

    // Fallback if no ID (Add new customer flow)
    console.log("[TriggerAdd] Opening New Customer Modal");
    const modal = document.getElementById('customerModal');
    if (modal) modal.classList.add('show');
    
    const titleEl = document.getElementById('modalCustTitle');
    
    // 1. Populate dropdowns from Master Data
    const elJob = document.getElementById('modalCustJob');
    const elCitizen = document.getElementById('modalCustCitizen');
    if (elJob) elJob.innerHTML = getMasterJobs().map(j => `<option value="${j.name || j}">${j.name || j}</option>`).join('');
    if (elCitizen) elCitizen.innerHTML = getMasterCitizens().map(c => `<option value="${c.name || c}">${c.name || c}</option>`).join('');

    // 2. Clear & Reset ALL fields first to avoid data contamination
    const fields = [
        'modalCustId', 'modalCustType', 'modalCustName', 'modalCustIdPjk', 'modalCustOtherId',
        'modalCustBirthPlace', 'modalCustBirthDate', 'modalCustAddress', 'modalCustIdType',
        'modalCustGender', 'modalCustCitizen', 'modalCustJob',
        'modalCustPassport', 'modalCustPhone', 'modalCustBankAcc',
        'modalCustCif', 'modalCustNpwp', 'modalCustLocalId', 'modalCustVisibleId', 'modalCustRegDate'
    ];
    
    fields.forEach(f => {
        const el = document.getElementById(f);
        if(el) {
            if(el.tagName === 'SELECT') el.selectedIndex = 0;
            else el.value = '';
            
            // Default: Lock fields until entity type is selected (except for special ones)
            const permanentEnabled = ['modalCustId', 'modalCustType', 'modalCustVisibleId', 'modalCustCif', 'modalCustRegDate', 'modalCustLocalId', 'btnOcrKtp'];
            if(!permanentEnabled.includes(f)) {
                el.disabled = true;
            } else {
                el.disabled = false;
            }
        }
    });
    
    const photoInput = document.getElementById('modalCustPhoto');
    const passportInput = document.getElementById('modalCustPassport');
    if (photoInput) photoInput.disabled = true;
    if (passportInput) {
        passportInput.disabled = true;
        passportInput.placeholder = "Pilih Tipe Entitas Dulu";
    }
    
    const typeSelect = document.getElementById('modalCustType');
    if (typeSelect) typeSelect.value = '';
    
    const radiosKn = document.getElementsByName('modalCustTypeGroup');
    for(let r of radiosKn) r.checked = false;
    
    const idTypeSelect = document.getElementById('modalCustIdType');
    if (idTypeSelect) {
        idTypeSelect.disabled = true;
        idTypeSelect.innerHTML = '<option value="">Pilih Tipe Entitas Dulu!</option>';
    }
    
    // Reset Photos
    if (photoInput) photoInput.value = '';
    currentCustPhotoBase64 = '';
    const imgPreview = document.getElementById('modalCustPhotoPreview');
    const imgPlaceholder = document.getElementById('modalCustPhotoPlaceholder');
    if (imgPreview) imgPreview.style.display = 'none';
    if (imgPlaceholder) imgPlaceholder.style.display = 'block';

    // 3. Main Data Population Logic
    if(window.isEditingCustomer) {
        console.log("[TriggerEdit] MODE: EDIT. Loading Data for ID:", id);
        if (titleEl) titleEl.textContent = "Edit Data Nasabah";
        
        // Immediate fill of ID fields to prevent saveCustomer from failing if lookup takes time
        const idHidden = document.getElementById('modalCustId');
        const idVisible = document.getElementById('modalCustVisibleId');
        if (idHidden) idHidden.value = id;
        if (idVisible) idVisible.value = id;

        const allCust = getCustomers();
        const cleanId = String(id).toLowerCase().trim();
        
        // Enhanced Find: Try multiple match strategies
        let c = allCust.find(x => 
            String(x.id_nasabah || '').toLowerCase().trim() === cleanId || 
            String(x.local_id || '').toLowerCase().trim() === cleanId
        );
        
        if(c) {
            console.log("[TriggerEdit] Customer Found!", c);
            
            // Set Entity Type & Unlock
            const rawKn = String(c.kn || '1');
            const knVal = rawKn.includes('2') ? '2' : '1'; 
            if(typeSelect) typeSelect.value = knVal;
            
            for(let r of radiosKn) {
                if(r.value === knVal) r.checked = true;
            }
            
            if(typeof window.toggleEntitas === 'function') window.toggleEntitas(); 

            // Helper to fill and enable
            const fill = (targetId, val) => {
                const el = document.getElementById(targetId);
                if(el) {
                    el.value = val || '';
                    el.disabled = false;
                }
            };

            fill('modalCustIdPjk', c.idpjk);
            fill('modalCustName', c.nama);
            fill('modalCustBirthPlace', c.tempat_lahir);
            fill('modalCustBirthDate', c.tanggal_lahir);
            fill('modalCustAddress', c.alamat);
            fill('modalCustPhone', c.no_hp);
            fill('modalCustGender', c.jenis_kelamin);
            
            if(elCitizen && [...elCitizen.options].some(o => o.value === c.warga_negara)) elCitizen.value = c.warga_negara;
            if(elJob && [...elJob.options].some(o => o.value === c.pekerjaan)) elJob.value = c.pekerjaan;
            
            const savedIdType = c.jenis_id || (c.no_ktp && c.no_ktp !== '-' ? 'KTP' : 'KTP');
            if(idTypeSelect) {
                idTypeSelect.value = savedIdType;
                idTypeSelect.disabled = false;
                if(typeof window.toggleCustPassportPlaceholder === 'function') window.toggleCustPassportPlaceholder();
            }
            
            fill('modalCustPassport', (c.no_ktp !== '-' ? c.no_ktp : (c.selain_ktp !== '-' ? c.selain_ktp : '')));
            fill('modalCustOtherId', c.selain_ktp !== '-' ? c.selain_ktp : '');
            fill('modalCustBankAcc', c.no_rekening);
            fill('modalCustCif', c.no_cif);
            fill('modalCustNpwp', c.npwp);
            fill('modalCustLocalId', c.local_id);
            
            if (c.tgl_daftar && c.tgl_daftar !== '-') {
                const regDateEl = document.getElementById('modalCustRegDate');
                if (regDateEl) regDateEl.value = c.tgl_daftar.split('T')[0];
            }
            
            if(c.foto_id) {
                currentCustPhotoBase64 = c.foto_id;
                if(imgPreview) { imgPreview.src = c.foto_id; imgPreview.style.display = 'block'; }
                if(imgPlaceholder) imgPlaceholder.style.display = 'none';
            }
        } else {
            console.error("[TriggerEdit] Data mismatch or not found in LocalStorage for ID:", id);
            if (typeof Swal !== 'undefined') {
                Swal.fire('Perhatian', 'Detail data nasabah tidak ditemukan secara lokal, pastikan data sinkron.', 'warning');
            }
        }
    } else {
        console.log("[TriggerEdit] MODE: ADD NEW.");
        if (titleEl) titleEl.textContent = "Tambah Nasabah Baru";
        
        const regDateEl = document.getElementById('modalCustRegDate');
        if (regDateEl) regDateEl.value = new Date().toISOString().split('T')[0];
        
        const idPjkEl = document.getElementById('modalCustIdPjk');
        if(idPjkEl) idPjkEl.value = (typeof getProfile === 'function' && getProfile().idpjk) || '';
        
        if (typeof generateCif === 'function') setTimeout(generateCif, 100);
    }
};

window.openCustomerModal = function(id = null) {
    window.triggerCustomerEditDirect(id);
};

function generateCif() {
    const idVisibleInput = document.getElementById('modalCustVisibleId');
    const idHiddenInput = document.getElementById('modalCustId');
    const cifInput = document.getElementById('modalCustCif');

    // Generate NEW Standard ID Nasabah if not editing
    if(!idHiddenInput.value) {
        const newId = window.generateStandardId();
        if(idVisibleInput) idVisibleInput.value = newId;
        if(idHiddenInput) idHiddenInput.value = newId;
    }

    // Generate NEW Standard CIF
    if(cifInput && (!cifInput.value || cifInput.value === '-')) {
        cifInput.value = window.generateStandardCif();
    }
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.remove('show');
}

function saveCustomer() {
    const idElem = document.getElementById('modalCustId');
    let id = idElem ? idElem.value : '';
    const typeKn = document.getElementById('modalCustType').value;
    const name = document.getElementById('modalCustName').value;
    const idPjk = document.getElementById('modalCustIdPjk').value;
    const birthPlace = document.getElementById('modalCustBirthPlace').value;
    const birthDate = document.getElementById('modalCustBirthDate').value;
    const address = document.getElementById('modalCustAddress').value;
    const gender = document.getElementById('modalCustGender').value;
    const citizen = document.getElementById('modalCustCitizen').value;
    const job = document.getElementById('modalCustJob').value;
    const identityType = document.getElementById('modalCustIdType').value;
    const identityNumber = document.getElementById('modalCustNik').value; // Sesuai HTML
    const otherId = document.getElementById('modalCustIdNo').value;    // Sesuai HTML
    const phone = document.getElementById('modalCustPhone').value;
    const bankAcc = document.getElementById('modalCustBankAcc').value;
    const cif = document.getElementById('modalCustCif').value;
    const npwp = document.getElementById('modalCustNpwp').value;
    const localId = document.getElementById('modalCustLocalId').value;

    if(!name) {
        alert("Nama wajib diisi untuk standar KYC!");
        return;
    }

    // Blokir jika nama masuk dalam daftar larangan bertransaksi (DTOTT)
    // Baca seluruh isi file Excel yang pernah diunggah
    const dtottData = window.getDtottList ? window.getDtottList() : [];
    let blockedNamesList = [];
    if(dtottData.length > 1) { // row 0 is header
        const headers = dtottData[0].map(h => (h||'').toString().toLowerCase());
        const namaIndices = [];
        headers.forEach((h, idx) => {
            if(h.includes('nama')) namaIndices.push(idx);
        });

        for(let i = 1; i < dtottData.length; i++) {
            if(namaIndices.length > 0) {
                namaIndices.forEach(idx => {
                    if(dtottData[i][idx]) blockedNamesList.push(dtottData[i][idx].toString().trim().toLowerCase());
                });
            } else {
                dtottData[i].forEach(cell => {
                    if(cell && typeof cell === 'string') blockedNamesList.push(cell.trim().toLowerCase());
                });
            }
        }
    }
    
    if(blockedNamesList.includes(name.trim().toLowerCase())) {
        alert("PENOLAKAN TRANSAKSI: Nama ini terindikasi dalam daftar blokir terlarang (DTOTT).");
        return;
    }

    const customers = getCustomers();

    let generatedId = id;
    if (!generatedId) {
        generatedId = window.generateStandardId();
    }
    
    // Auto generate CIF if empty
    let autoCif = cif;
    if(!autoCif || autoCif.trim() === '' || autoCif === '-') {
        autoCif = window.generateStandardCif();
    }

    const regDateInput = document.getElementById('modalCustRegDate');
    const finalRegDate = (regDateInput && regDateInput.value) ? new Date(regDateInput.value).toISOString() : new Date().toISOString();

    const customerData = {
        id_nasabah: generatedId,
        idpjk: idPjk || (getProfile().idpjk || '-'),
        kn: typeKn,
        no_hp: phone || '-',
        nama: name,
        tempat_lahir: birthPlace || '-',
        tanggal_lahir: birthDate || '-',
        alamat: address || '-',
        jenis_id: identityType,
        no_ktp: identityNumber || '-',
        selain_ktp: otherId || '-',
        no_cif: autoCif,
        npwp: npwp || '-',
        local_id: localId || '-',
        jenis_kelamin: gender,
        warga_negara: citizen,
        pekerjaan: job || '-',
        no_rekening: bankAcc || '-',
        tgl_daftar: finalRegDate,
        foto_id: currentCustPhotoBase64 || null
    };
    
    const currUser = getCurrentUser() ? getCurrentUser().fullName : 'Admin Kasir';
    if(!id) {
        customerData.inputBy = currUser;
        customerData.editBy = '';
        customers.push(customerData);
    } else {
        const index = customers.findIndex(c => String(c.id_nasabah) === String(id));
        if(index > -1) {
            customerData.tgl_daftar = finalRegDate; // Override with user input from form
            customerData.inputBy = customers[index].inputBy || currUser;
            customerData.editBy = currUser;
            customers[index] = customerData;
        }
    }

    try {
        saveCustomers(customers);
        
        // Clear photo identity after clicking save
        document.getElementById('modalCustPhoto').value = '';
        if(typeof currentCustPhotoBase64 !== 'undefined') {
            currentCustPhotoBase64 = '';
        }
        document.getElementById('modalCustPhotoPreview').style.display = 'none';
        document.getElementById('modalCustPhotoPreview').src = '';
        document.getElementById('modalCustPhotoPlaceholder').style.display = 'block';

        closeCustomerModal();
        loadCustomersTable();
        // Also refresh the Select dropdowns in other views
        if(typeof loadPosForm === 'function') loadPosForm();
        if(typeof loadOldMoneyCustomerSelect === 'function') loadOldMoneyCustomerSelect();
        
        alert("Data Nasabah Berhasil Disimpan!");
    } catch (e) {
        alert("Gagal menyimpan data nasabah! Error: " + e.message);
    }
}

// Settings Utility
// Old resetDatabase removed to prevent conflicts

// ==============================
// BANK MUTATIONS
// ==============================
function loadMutationsTable() {
    const mutations = getMutations();
    const tbody = document.getElementById('mutationsTableBody');
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';
    tbody.innerHTML = '';

    mutations.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${window.formatDateToDMY(m.timestamp)}</td>
            <td><strong>${m.id_mutasi}</strong></td>
            <td class="font-weight-bold ${m.tipe === 'MASUK' ? 'text-green' : 'text-red'}">${m.tipe}</td>
            <td>${m.bank || 'BCA'}</td>
            <td>
                ${m.keterangan}
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') && (m.inputBy || m.editBy) ? `
                    <div style="margin-top:5px; font-size:0.7rem; color:#64748b; line-height:1.1;">
                        ${m.inputBy ? `Input: ${m.inputBy}<br>` : ''}
                        ${m.editBy ? `Edit: ${m.editBy}` : ''}
                    </div>
                ` : ''}
            </td>
            <td>${formatIdr(m.nominal)}</td>
            <td class="text-center" style="white-space: nowrap;">
                <button class="btn btn-sm" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 5px;" onclick="openMutationModal('${m.id_mutasi}')">
                    <i class="fa-solid fa-edit"></i>
                </button>
                <button class="btn btn-sm" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 4px 8px; border-radius: 4px;" onclick="deleteMutation('${m.id_mutasi}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openMutationModal(id = null) {
    if(id) {
        const mutations = getMutations();
        const m = mutations.find(x => x.id_mutasi === id);
        if(m) {
            document.getElementById('modalMutTitle').textContent = 'Edit Mutasi Bank';
            document.getElementById('modalMutId').value = m.id_mutasi;
            document.getElementById('modalMutType').value = m.tipe;
            document.getElementById('modalMutAmount').value = m.nominal;
            document.getElementById('modalMutDesc').value = m.keterangan;
            document.getElementById('modalMutBank').value = m.bank || 'BCA';
            document.getElementById('modalMutDate').value = m.timestamp ? m.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
        }
    } else {
        document.getElementById('modalMutTitle').textContent = 'Tambah Mutasi Bank';
        document.getElementById('modalMutId').value = '';
        document.getElementById('modalMutType').value = 'MASUK';
        document.getElementById('modalMutAmount').value = '';
        document.getElementById('modalMutDesc').value = '';
        document.getElementById('modalMutBank').value = 'BCA';
        document.getElementById('modalMutDate').value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('mutationModal').classList.add('show');
}

function closeMutationModal() {
    document.getElementById('mutationModal').classList.remove('show');
}

function saveMutation() {
    const idElem = document.getElementById('modalMutId');
    const id = idElem ? idElem.value : '';
    const type = document.getElementById('modalMutType').value;
    const bankTgt = document.getElementById('modalMutBank').value || 'BCA';
    const amount = parseFloat(document.getElementById('modalMutAmount').value);
    const desc = document.getElementById('modalMutDesc').value;

    if(!amount || !desc) {
        alert("Nominal dan Keterangan wajib diisi!");
        return;
    }

    let mutations = getMutations();
    let bankBCA = getBankBCA();
    let bankMandiri = getBankMandiri();
    
    let currentBank = bankTgt === 'BCA' ? bankBCA : bankMandiri;

    if(id) {
        const index = mutations.findIndex(x => x.id_mutasi === id);
        if(index > -1) {
            const oldM = mutations[index];
            const oldBankTgt = oldM.bank || 'BCA';
            
            // Revert old impact
            if(oldBankTgt === 'BCA') {
                if(oldM.tipe === 'MASUK') bankBCA -= oldM.nominal;
                else bankBCA += oldM.nominal;
            } else {
                if(oldM.tipe === 'MASUK') bankMandiri -= oldM.nominal;
                else bankMandiri += oldM.nominal;
            }
            
            currentBank = bankTgt === 'BCA' ? bankBCA : bankMandiri;

            if(type === 'KELUAR' && currentBank < amount) {
                alert(`Saldo Bank ${bankTgt} tidak mencukupi untuk mutasi keluar ini. Edit dibatalkan.`);
                return;
            }

            if(type === 'MASUK') currentBank += amount;
            else currentBank -= amount;
            
            if(bankTgt === 'BCA') bankBCA = currentBank;
            else bankMandiri = currentBank;

            const currUser = getCurrentUser() ? getCurrentUser().fullName : 'Admin Kasir';
            mutations[index].tipe = type;
            mutations[index].nominal = amount;
            mutations[index].keterangan = desc;
            mutations[index].bank = bankTgt;
            mutations[index].inputBy = mutations[index].inputBy || currUser;
            mutations[index].editBy = currUser;
        }
    } else {
        if(type === 'KELUAR' && currentBank < amount) {
            alert(`Saldo Bank ${bankTgt} tidak mencukupi untuk mutasi keluar ini.`);
            return;
        }

        if(type === 'MASUK') currentBank += amount;
        else currentBank -= amount;
        
        if(bankTgt === 'BCA') bankBCA = currentBank;
        else bankMandiri = currentBank;

        let mtTime = new Date().toISOString();
        const mutDateEl = document.getElementById('modalMutDate');
        if(mutDateEl && mutDateEl.value) {
            const currTime = new Date().toISOString().substring(11);
            mtTime = mutDateEl.value + 'T' + currTime;
        }

        const currUser = getCurrentUser() ? getCurrentUser().fullName : 'Admin Kasir';
        mutations.push({
            id_mutasi: 'MUT-' + Date.now().toString().slice(-6),
            timestamp: mtTime,
            tipe: type,
            nominal: amount,
            keterangan: desc,
            bank: bankTgt,
            inputBy: currUser,
            editBy: ''
        });
    }

    saveMutations(mutations);
    saveBankBCA(bankBCA);
    saveBankMandiri(bankMandiri);
    closeMutationModal();
    loadMutationsTable();
    if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
    alert("Mutasi bank berhasil disimpan!");
}

window.deleteMutation = function(id) {
    if(confirm('Yakin ingin menghapus mutasi ini? Saldo Bank akan disesuaikan kembali secara otomatis.')) {
        let mutations = getMutations();
        let bankBCA = getBankBCA();
        let bankMandiri = getBankMandiri();
        
        const index = mutations.findIndex(x => x.id_mutasi === id);
        if(index > -1) {
            const m = mutations[index];
            const bankTgt = m.bank || 'BCA';
            
            if(bankTgt === 'BCA') {
                if(m.tipe === 'MASUK') bankBCA -= m.nominal;
                else bankBCA += m.nominal;
            } else {
                if(m.tipe === 'MASUK') bankMandiri -= m.nominal;
                else bankMandiri += m.nominal;
            }
            
            mutations.splice(index, 1);
            saveMutations(mutations);
            saveBankBCA(bankBCA);
            saveBankMandiri(bankMandiri);
            loadMutationsTable();
            if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
        }
    }
};

// ==============================
// EXPENSES (PENGELUARAN)
// ==============================
function loadExpensesTable() {
    const expenses = getExpenses();
    const tbody = document.getElementById('expensesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';

    expenses.forEach(e => {
        const tipe = e.tipe || 'PENGELUARAN';
        const color = tipe === 'PENDAPATAN' ? 'text-green' : 'text-red';
        const sign = tipe === 'PENDAPATAN' ? '+' : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${window.formatDateToDMY(e.timestamp)}</td>
            <td><strong>${e.id_pengeluaran}</strong></td>
            <td><span class="${color} font-weight-bold">${tipe}</span></td>
            <td>${e.kategori || '-'}</td>
            <td>
                ${e.deskripsi}
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') && (e.inputBy || e.editBy) ? `
                    <div style="margin-top:5px; font-size:0.7rem; color:#64748b; line-height:1.1;">
                        ${e.inputBy ? `Input: ${e.inputBy}<br>` : ''}
                        ${e.editBy ? `Edit: ${e.editBy}` : ''}
                    </div>
                ` : ''}
            </td>
            <td>${e.sumber === 'CASH' ? 'Kas Tunai' : 'Saldo Bank'}</td>
            <td class="text-end font-weight-bold ${color}">${sign}${formatIdr(e.nominal)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-danger" onclick="deleteExpense('${e.id_pengeluaran}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateExpCategoryOptions() {
    const type = document.getElementById('modalExpType').value;
    const catSelect = document.getElementById('modalExpCategory');
    if(!catSelect) return;
    let opts = [];
    if(type === 'PENGELUARAN') {
        opts = [
            '07-Beban Gaji, Upah dan Tunjangan',
            '08-Beban Sewa',
            '09-Beban Iklan dan promosi',
            '10-Beban Air, Listrik dan Telepon',
            '11-Beban Transportasi dan perjalanan',
            '12-Beban Pemeliharaan kendaraan',
            '14-Beban Asuransi',
            '15-Beban Lain-Lain (Operasional)',
            '17-Beban Administrasi Bank',
            '18-Beban Bunga Pinjaman',
            '20-Rugi Penjualan Aset Tetap',
            '22-Rugi Selisih Kurs',
            '24-Beban Lain-Lain (Non Operasional)',
            '25-Pajak Penghasilan'
        ];
    } else {
        opts = [
            '06-Pendapatan Pengiriman Uang',
            '16-Pendapatan Bunga bank',
            '19-Laba Penjualan Aset Tetap',
            '23-Pendapatan Lain-Lain'
        ];
    }
    catSelect.innerHTML = opts.map(o => `<option value="${o}">${o}</option>`).join('');
}

// Auto-migrate old expenses without prefixes
(function migrateOldExpenses() {
    let exps = JSON.parse(localStorage.getItem('mc_expenses') || '[]');
    let changed = false;
    const map = {
        'Beban Gaji, Upah dan Tunjangan': '07-Beban Gaji, Upah dan Tunjangan',
        'Beban Sewa': '08-Beban Sewa',
        'Beban Iklan dan promosi': '09-Beban Iklan dan promosi',
        'Beban Air, Listrik dan Telepon': '10-Beban Air, Listrik dan Telepon',
        'Beban Transportasi dan perjalanan': '11-Beban Transportasi dan perjalanan',
        'Beban Pemeliharaan kendaraan': '12-Beban Pemeliharaan kendaraan',
        'Beban Asuransi': '14-Beban Asuransi',
        'Beban Administrasi Bank': '17-Beban Administrasi Bank',
        'Beban Bunga Pinjaman': '18-Beban Bunga Pinjaman',
        'Beban Lain-Lain (Operasional)': '15-Beban Lain-Lain (Operasional)',
        'Beban Lain-Lain (Non Operasional)': '24-Beban Lain-Lain (Non Operasional)',
        'Pajak Penghasilan': '25-Pajak Penghasilan',
        'Pendapatan Bunga bank': '16-Pendapatan Bunga bank',
        'Pendapatan Pengiriman Uang': '06-Pendapatan Pengiriman Uang',
        'Pendapatan Lain-Lain': '23-Pendapatan Lain-Lain'
    };
    exps.forEach(e => {
        if(e.kategori && map[e.kategori]) {
            e.kategori = map[e.kategori];
            changed = true;
        }
    });
    if(changed) {
        localStorage.setItem('mc_expenses', JSON.stringify(exps));
    }
})();


function openExpenseModal() {
    document.getElementById('expenseModal').classList.add('show');
    document.getElementById('modalExpDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalExpType').value = 'PENGELUARAN';
    updateExpCategoryOptions();
    document.getElementById('modalExpDesc').value = '';
    document.getElementById('modalExpSource').value = 'CASH';
    document.getElementById('modalExpAmount').value = '';
}

function closeExpenseModal() {
    document.getElementById('expenseModal').classList.remove('show');
}

function saveExpense() {
    const type = document.getElementById('modalExpType').value;
    const category = document.getElementById('modalExpCategory').value;
    const desc = document.getElementById('modalExpDesc').value;
    const source = document.getElementById('modalExpSource').value;
    const amount = parseFloat(document.getElementById('modalExpAmount').value);

    if(!amount || !desc) {
        alert("Nominal dan Deskripsi wajib diisi!");
        return;
    }

    let cash = getCash();
    let bankBCA = getBankBCA();
    let bankMandiri = getBankMandiri();

    if (type === 'PENGELUARAN') {
        if(source === 'CASH' && cash < amount) {
            alert("Kas Tunai tidak mencukupi!");
            return;
        }
        if(source === 'BCA' && bankBCA < amount) {
            alert("Saldo Bank BCA tidak mencukupi!");
            return;
        }
        if(source === 'MANDIRI' && bankMandiri < amount) {
            alert("Saldo Bank Mandiri tidak mencukupi!");
            return;
        }
        
        if(source === 'CASH') { cash -= amount; } 
        else if(source === 'BCA') { bankBCA -= amount; }
        else if(source === 'MANDIRI') { bankMandiri -= amount; }
    } else {
        if(source === 'CASH') { cash += amount; } 
        else if(source === 'BCA') { bankBCA += amount; }
        else if(source === 'MANDIRI') { bankMandiri += amount; }
    }

    let exTime = new Date().toISOString();
    const expDateEl = document.getElementById('modalExpDate');
    if(expDateEl && expDateEl.value) {
        const currTime = new Date().toISOString().substring(11);
        exTime = expDateEl.value + 'T' + currTime;
    }

    const expenses = getExpenses();
    const prefix = type === 'PENDAPATAN' ? 'INC-' : 'EXP-';
    const currUser = getCurrentUser() ? getCurrentUser().fullName : 'Admin Kasir';
    expenses.push({
        id_pengeluaran: prefix + Date.now().toString().slice(-6),
        timestamp: exTime,
        tipe: type,
        kategori: category,
        deskripsi: desc,
        sumber: source,
        nominal: amount,
        inputBy: currUser,
        editBy: ''
    });

    saveExpenses(expenses);
    if(source === 'CASH') saveCash(cash);
    if(source === 'BCA') saveBankBCA(bankBCA);
    if(source === 'MANDIRI') saveBankMandiri(bankMandiri);
    
    closeExpenseModal();
    loadExpensesTable();
    if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
    alert("Jurnal Keuangan berhasil disimpan!");
}

function deleteExpense(id) {
    if(confirm('Hapus jurnal ini? Tindakan ini akan mengembalikan saldo Kas/Bank secara otomatis.')) {
        let expenses = getExpenses();
        const index = expenses.findIndex(x => x.id_pengeluaran === id);
        if(index > -1) {
            const e = expenses[index];
            let cash = getCash();
            let bankBCA = getBankBCA();
            let bankMandiri = getBankMandiri();
            
            let eSource = e.sumber === 'BANK' ? 'BCA' : e.sumber; // Fallback for old 'BANK' entries
            
            if(e.tipe === 'PENDAPATAN') {
                if(eSource === 'CASH') cash -= e.nominal;
                else if(eSource === 'BCA') bankBCA -= e.nominal;
                else if(eSource === 'MANDIRI') bankMandiri -= e.nominal;
            } else { // PENGELUARAN
                if(eSource === 'CASH') cash += e.nominal;
                else if(eSource === 'BCA') bankBCA += e.nominal;
                else if(eSource === 'MANDIRI') bankMandiri += e.nominal;
            }
            
            expenses.splice(index, 1);
            saveExpenses(expenses);
            saveCash(cash);
            saveBankBCA(bankBCA);
            saveBankMandiri(bankMandiri);
            loadExpensesTable();
            if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
        }
    }
}

// ==============================
// MODAL & JURNAL EKUITAS / KEWAJIBAN
// ==============================

function loadAdjustmentsTable() {
    const adjs = getAdjustments();
    const tbody = document.getElementById('adjustmentsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';

    adjs.forEach(a => {
        const color = a.tipe === 'PENAMBAHAN' ? 'text-green' : 'text-red';
        const sign = a.tipe === 'PENAMBAHAN' ? '+' : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${window.formatDateToDMY(a.timestamp)}</td>
            <td><strong>${a.id_adj}</strong></td>
            <td>${a.kategori || '-'}</td>
            <td><span class="${color} font-weight-bold">${a.tipe}</span></td>
            <td>
                ${a.deskripsi}
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') && (a.inputBy || a.editBy) ? `
                    <div style="margin-top:5px; font-size:0.7rem; color:#64748b; line-height:1.1;">
                        ${a.inputBy ? `Input: ${a.inputBy}<br>` : ''}
                        ${a.editBy ? `Edit: ${a.editBy}` : ''}
                    </div>
                ` : ''}
            </td>
            <td>${a.impact === 'MASUK_CASH' || a.impact === 'KELUAR_CASH' ? 'Kas Tunai' : (a.impact === 'MASUK_BANK' || a.impact === 'KELUAR_BANK' || a.impact === 'MASUK_BCA' || a.impact === 'KELUAR_BCA' || a.impact === 'MASUK_MANDIRI' || a.impact === 'KELUAR_MANDIRI' ? 'Saldo Bank' : '-')}</td>
            <td class="text-end font-weight-bold ${color}">${sign}${formatIdr(a.nominal)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-danger" onclick="deleteAdjustment('${a.id_adj}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAdjustmentModal() {
    document.getElementById('adjustmentModal').classList.add('show');
    document.getElementById('modalAdjDesc').value = '';
    document.getElementById('modalAdjAmount').value = '';
}

function closeAdjustmentModal() {
    document.getElementById('adjustmentModal').classList.remove('show');
}

function saveAdjustment() {
    const category = document.getElementById('modalAdjCategory').value;
    const type = document.getElementById('modalAdjType').value;
    const impact = document.getElementById('modalAdjImpact').value;
    const desc = document.getElementById('modalAdjDesc').value;
    const amount = parseFloat(document.getElementById('modalAdjAmount').value);

    if(!amount || !desc) {
        alert("Nominal dan Deskripsi wajib diisi!");
        return;
    }

    let cash = getCash();
    let bankBCA = getBankBCA();
    let bankMandiri = getBankMandiri();

    // Check availability if cash/bank goes out
    if(impact === 'KELUAR_CASH' && cash < amount) {
        alert("Kas Tunai tidak mencukupi!"); return;
    }
    if(impact === 'KELUAR_BCA' && bankBCA < amount) {
        alert("Saldo Bank BCA tidak mencukupi!"); return;
    }
    if(impact === 'KELUAR_MANDIRI' && bankMandiri < amount) {
        alert("Saldo Bank Mandiri tidak mencukupi!"); return;
    }

    if(impact === 'MASUK_CASH') cash += amount;
    else if(impact === 'KELUAR_CASH') cash -= amount;
    else if(impact === 'MASUK_BCA') bankBCA += amount;
    else if(impact === 'KELUAR_BCA') bankBCA -= amount;
    else if(impact === 'MASUK_MANDIRI') bankMandiri += amount;
    else if(impact === 'KELUAR_MANDIRI') bankMandiri -= amount;

    const adjs = getAdjustments();
    const currUser = getCurrentUser() ? getCurrentUser().fullName : 'Admin Kasir';
    adjs.push({
        id_adj: 'ADJ-' + Date.now().toString().slice(-6),
        timestamp: new Date().toISOString(),
        kategori: category,
        tipe: type,
        impact: impact,
        deskripsi: desc,
        nominal: amount,
        inputBy: currUser,
        editBy: ''
    });

    saveAdjustments(adjs);
    saveCash(cash);
    saveBankBCA(bankBCA);
    saveBankMandiri(bankMandiri);
    
    closeAdjustmentModal();
    loadAdjustmentsTable();
    if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
    alert("Jurnal Ekuitas/Kewajiban berhasil dicatat!");
}

function deleteAdjustment(id) {
    if(confirm('Hapus jurnal penyesuaian ini? Kas/Bank akan disesuaikan kembali ke saldo awal sebelum pencatatan ini.')) {
        let adjs = getAdjustments();
        const index = adjs.findIndex(x => x.id_adj === id);
        if(index > -1) {
            const a = adjs[index];
            let cash = getCash();
            let bankBCA = getBankBCA();
            let bankMandiri = getBankMandiri();
            
            // Fallback for old 'MASUK_BANK' / 'KELUAR_BANK' entries
            let eImpact = a.impact;
            if(eImpact === 'MASUK_BANK') eImpact = 'MASUK_BCA';
            if(eImpact === 'KELUAR_BANK') eImpact = 'KELUAR_BCA';
            
            // Revert impact
            if(eImpact === 'MASUK_CASH') cash -= a.nominal;
            else if(eImpact === 'KELUAR_CASH') cash += a.nominal;
            else if(eImpact === 'MASUK_BCA') bankBCA -= a.nominal;
            else if(eImpact === 'KELUAR_BCA') bankBCA += a.nominal;
            else if(eImpact === 'MASUK_MANDIRI') bankMandiri -= a.nominal;
            else if(eImpact === 'KELUAR_MANDIRI') bankMandiri += a.nominal;
            
            adjs.splice(index, 1);
            saveAdjustments(adjs);
            loadAdjustmentsTable();
            if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
        }
    }
}

// ==============================
// CLOSING KASIR HARIAN
// ==============================
function initClosingView() {
    const cash = getCash();
    document.getElementById('closingKasSistem').textContent = formatIdr(cash);
    
    // Reset inputs
    document.querySelectorAll('.denom-input').forEach(i => i.value = '');
    document.getElementById('closingNote').value = '';
    
    calculateClosingPhysical();
}

function calculateClosingPhysical() {
    const d100 = parseInt(document.getElementById('denom100k').value) || 0;
    const d50  = parseInt(document.getElementById('denom50k').value) || 0;
    const d20  = parseInt(document.getElementById('denom20k').value) || 0;
    const d10  = parseInt(document.getElementById('denom10k').value) || 0;
    const d5   = parseInt(document.getElementById('denom5k').value) || 0;
    const d2   = parseInt(document.getElementById('denom2k').value) || 0;
    const d1   = parseInt(document.getElementById('denom1k').value) || 0;
    const dKoin= parseInt(document.getElementById('denomKoin').value) || 0;

    const totalFisik = (d100 * 100000) + (d50 * 50000) + (d20 * 20000) + 
                       (d10 * 10000) + (d5 * 5000) + (d2 * 2000) + 
                       (d1 * 1000) + dKoin;
    
    const kasSistem = getCash();
    const selisih = totalFisik - kasSistem;

    document.getElementById('closingFisik').textContent = formatIdr(totalFisik);
    const selNode = document.getElementById('closingSelisih');
    selNode.textContent = formatIdr(Math.abs(selisih));
    
    if(selisih === 0) {
        selNode.style.color = '#10B981'; // Green
    } else if (selisih < 0) {
        selNode.style.color = '#F87171'; // Red
        selNode.textContent = '-' + selNode.textContent;
    } else {
        selNode.style.color = '#3B82F6'; // Blue
        selNode.textContent = '+' + selNode.textContent;
    }
}

function saveClosing() {
    const totalFisikStr = document.getElementById('closingFisik').textContent.replace(/[^\d]/g, '');
    const totalFisik = parseInt(totalFisikStr) || 0;
    const kasSistem = getCash();
    const selisih = totalFisik - kasSistem;
    const note = document.getElementById('closingNote').value;
    const dateInput = document.getElementById('closingDateInput');
    let ts = new Date().toISOString();
    if(dateInput && dateInput.value) {
        ts = new Date(dateInput.value).toISOString();
    }

    const closingData = {
        id: 'CLS-' + Date.now().toString().slice(-6),
        timestamp: ts,
        kasSistem: kasSistem,
        kasFisik: totalFisik,
        selisih: selisih,
        catatan: note
    };

    const closings = getClosings();
    closings.push(closingData);
    saveClosings(closings);

    saveCash(totalFisik);

    alert("Closing Kasir berhasil disimpan! Saldo Kas Sistem telah disesuaikan menjadi Rp " + totalFisik.toLocaleString());
    initClosingView(); 
    if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
}

window.openClosingHistoryModal = function() {
    document.getElementById('closingHistoryModal').classList.add('show');
    
    const closings = getClosings();
    const tbody = document.getElementById('closingHistoryTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // Sort from newest to oldest
    const sorted = closings.slice().reverse();
    
    sorted.forEach(c => {
        const tr = document.createElement('tr');
        
        let selisihHtml = `<span style="color: ${c.selisih < 0 ? '#ef4444' : (c.selisih > 0 ? '#10b981' : 'inherit')}">${formatIdr(c.selisih)}</span>`;
        
        tr.innerHTML = `
            <td>${window.formatDateToDMY(c.timestamp)}</td>
            <td>${c.id}</td>
            <td>${formatIdr(c.kasSistem)}</td>
            <td>${formatIdr(c.kasFisik)}</td>
            <td><strong>${selisihHtml}</strong></td>
            <td>${c.catatan || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openEditClosingModal('${c.id}')"><i class="fa-solid fa-pen"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if(sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada riwayat closing.</td></tr>';
    }
};

window.closeClosingHistoryModal = function() {
    document.getElementById('closingHistoryModal').classList.remove('show');
};

window.openEditClosingModal = function(id) {
    const closings = getClosings();
    const c = closings.find(x => x.id === id);
    if(!c) return;

    document.getElementById('editClosingId').value = c.id;
    document.getElementById('editClosingKasSistem').value = c.kasSistem;
    
    const dt = new Date(c.timestamp);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    document.getElementById('editClosingDate').value = dt.toISOString().slice(0,16);

    document.getElementById('editClosingFisik').value = formatIdr(c.kasFisik);
    document.getElementById('editClosingNote').value = c.catatan || '';

    document.getElementById('editClosingModal').classList.add('show');
};

window.closeEditClosingModal = function() {
    document.getElementById('editClosingModal').classList.remove('show');
};

window.saveEditClosing = function() {
    const id = document.getElementById('editClosingId').value;
    const kasSistem = parseInt(document.getElementById('editClosingKasSistem').value) || 0;
    const dateVal = document.getElementById('editClosingDate').value;
    const fisikStr = document.getElementById('editClosingFisik').value.replace(/[^\d]/g, '');
    const kasFisik = parseInt(fisikStr) || 0;
    const note = document.getElementById('editClosingNote').value;

    const closings = getClosings();
    const idx = closings.findIndex(x => x.id === id);
    if(idx === -1) return;

    closings[idx].timestamp = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
    closings[idx].kasFisik = kasFisik;
    closings[idx].selisih = kasFisik - kasSistem;
    closings[idx].catatan = note;

    saveClosings(closings);
    
    closeEditClosingModal();
    openClosingHistoryModal();
    
    alert("Data riwayat berhasil diubah! PENTING: Saldo kas aktual pada sistem hari ini tidak berubah dan tetap aman.");
    if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
};

window.printClosingHistory = function() {
    const tableHtml = document.getElementById('closingHistoryTable').outerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Cetak Riwayat Closing</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                h2 { text-align: center; }
            </style>
        </head>
        <body>
            <h2>Laporan Riwayat Closing Rupiah</h2>
            <p>Dicetak pada: ${window.formatDateToDMY(new Date())}</p>
            ${tableHtml}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.setTimeout(() => {
        printWindow.print();
    }, 500);
};

// ==============================
// SETTINGS / PROFILE
// ==============================
function loadSettingsProfile() {
    const p = getProfile();
    document.getElementById('profName').value = p.name || '';
    document.getElementById('profAddress').value = p.address || '';
    if(document.getElementById('profBiLicense')) document.getElementById('profBiLicense').value = p.biLicense || '';
    if(document.getElementById('profIdpjk')) document.getElementById('profIdpjk').value = p.idpjk || '';
    if(document.getElementById('profVisionKey')) document.getElementById('profVisionKey').value = localStorage.getItem('mc_vision_api_key') || '';
    document.getElementById('profPhone').value = p.phone || '';
    if(document.getElementById('profWaNumber')) document.getElementById('profWaNumber').value = p.phoneWA || '';
    document.getElementById('profFooter').value = p.footer || '';
    document.getElementById('profWaTemplate').value = p.waTemplate || DEFAULT_WA_TEMPLATE;

    // Load Start Balances
    document.getElementById('initCash').value = getCash() || 0;
    document.getElementById('initBankBCA').value = getBankBCA() || 0;
    document.getElementById('initBankMandiri').value = getBankMandiri() || 0;
    
    // Load existing valas to table
    const currencies = getCurrencies();
    document.getElementById('initValasBody').innerHTML = ''; // reset
    currencies.forEach(c => addInitValasRow(c.code, c.stock, c.buy)); // fallback c.buy as modal

    recalcInitTotal();
    
    document.getElementById('initCash').addEventListener('input', recalcInitTotal);
    document.getElementById('initBankBCA').addEventListener('input', recalcInitTotal);
    document.getElementById('initBankMandiri').addEventListener('input', recalcInitTotal);
}

window.addInitValasRow = function(code = '', stock = '', rate = '') {
    const tbody = document.getElementById('initValasBody');
    const tr = document.createElement('tr');
    tr.className = 'init-valas-row';
    
    tr.innerHTML = `
        <td><input type="text" list="masterCurList" class="form-control text-center init-v-code" value="${code}" placeholder="USD" style="text-transform:uppercase; font-weight:bold;"></td>
        <td><input type="number" class="form-control init-v-stock" value="${stock}" placeholder="0"></td>
        <td>
            <div class="input-group">
                <span class="input-group-text border-0 bg-transparent text-muted">Rp</span>
                <input type="number" class="form-control init-v-rate" value="${rate}" placeholder="0">
            </div>
        </td>
        <td class="text-end align-middle fw-bold init-v-total">Rp 0</td>
        <td class="text-center align-middle">
            <button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); recalcInitTotal();"><i class="fa-solid fa-trash"></i></button>
        </td>
    `;
    
    tbody.appendChild(tr);
    
    // Attach event listeners to new inputs
    tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', recalcInitTotal);
    });
    
    recalcInitTotal();
}

function recalcInitTotal() {
    let totalValasRp = 0;
    const rows = document.querySelectorAll('.init-valas-row');
    const fmt = (num) => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(num);
    
    rows.forEach(tr => {
        const stock = parseFloat(tr.querySelector('.init-v-stock').value) || 0;
        const rate = parseFloat(tr.querySelector('.init-v-rate').value) || 0;
        const rowTotal = stock * rate;
        totalValasRp += rowTotal;
        tr.querySelector('.init-v-total').textContent = fmt(rowTotal);
    });
    
    document.getElementById('initTotalValasRp').textContent = fmt(totalValasRp);
    
    const cash = parseFloat(document.getElementById('initCash').value) || 0;
    const bankBCA = parseFloat(document.getElementById('initBankBCA').value) || 0;
    const bankMandiri = parseFloat(document.getElementById('initBankMandiri').value) || 0;
    const grandTotal = cash + bankBCA + bankMandiri + totalValasRp;
    
    document.getElementById('initTotalModalDisplay').textContent = fmt(grandTotal);
}

window.submitProfile = function() {
    const profileData = {
        name: document.getElementById('profName').value || 'MC-ALMARA',
        address: document.getElementById('profAddress').value || '',
        biLicense: document.getElementById('profBiLicense') ? document.getElementById('profBiLicense').value : '',
        idpjk: document.getElementById('profIdpjk') ? document.getElementById('profIdpjk').value : '',
        phone: document.getElementById('profPhone').value || '',
        phoneWA: document.getElementById('profWaNumber') ? document.getElementById('profWaNumber').value : '',
        footer: document.getElementById('profFooter').value || '',
        waTemplate: document.getElementById('profWaTemplate').value || DEFAULT_WA_TEMPLATE,
        visionKey: document.getElementById('profVisionKey') ? document.getElementById('profVisionKey').value : ''
    };
    if(profileData.visionKey) localStorage.setItem('mc_vision_api_key', profileData.visionKey.trim());
    saveProfile(profileData);
    
    // Paksa sinkronisasi ke MySQL detik ini juga agar tidak ditimpa data lama oleh auto-sync
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_profile', profileData);
    }
    
    alert('Pengaturan Profil Perusahaan berhasil disimpan. Data ini akan tercetak pada Struk.');
}

window.saveInitialBalances = function() {
    const cashVal = parseFloat(document.getElementById('initCash').value) || 0;
    const bankBcaVal = parseFloat(document.getElementById('initBankBCA').value) || 0;
    const bankMandiriVal = parseFloat(document.getElementById('initBankMandiri').value) || 0;
    
    const oldBankBca = getBankBCA();
    const oldBankMandiri = getBankMandiri();
    
    const diffBankBca = bankBcaVal - oldBankBca;
    const diffBankMandiri = bankMandiriVal - oldBankMandiri;
    
    saveCash(cashVal);
    saveBankBCA(bankBcaVal);
    saveBankMandiri(bankMandiriVal);
    
    const mutations = getMutations();
    let hasBankDiff = false;

    if (diffBankBca !== 0) {
        mutations.push({
            id_mutasi: 'MUT-' + Date.now().toString().slice(-6) + '-BCA',
            timestamp: new Date().toISOString(),
            tipe: diffBankBca > 0 ? 'MASUK' : 'KELUAR',
            nominal: Math.abs(diffBankBca),
            keterangan: 'Penyesuaian Sistem (Sinkronisasi Modal Bank BCA)',
            bank: 'BCA'
        });
        hasBankDiff = true;
    }

    if (diffBankMandiri !== 0) {
        mutations.push({
            id_mutasi: 'MUT-' + Date.now().toString().slice(-6) + '-MDR',
            timestamp: new Date().toISOString(),
            tipe: diffBankMandiri > 0 ? 'MASUK' : 'KELUAR',
            nominal: Math.abs(diffBankMandiri),
            keterangan: 'Penyesuaian Sistem (Sinkronisasi Modal Bank Mandiri)',
            bank: 'MANDIRI'
        });
        hasBankDiff = true;
    }
    
    if (hasBankDiff) saveMutations(mutations);
    
    // Save Custom Initial Valas
    let masterCurrencies = getCurrencies();
    const rows = document.querySelectorAll('.init-valas-row');
    
    // We will track which currencies are updated to not lose others, but wait, usually Saldo Awal defines ALL. 
    // We update matching ones and insert missing ones.
    rows.forEach(tr => {
        const code = tr.querySelector('.init-v-code').value.trim().toUpperCase();
        const stock = parseFloat(tr.querySelector('.init-v-stock').value) || 0;
        const rate = parseFloat(tr.querySelector('.init-v-rate').value) || 0;
        
        if(!code) return;
        
        let c = masterCurrencies.find(x => x.code === code);
        if(c) {
            c.stock = stock;
            // Overwriting the buy rate conceptually overrides their base "Harga Modal" Valuasi!
            c.buy = rate;
            c.sell = rate > c.sell ? rate : c.sell;
        } else {
            // Unregistered currency, implicitly create it into Master
            masterCurrencies.push({
                code: code,
                buy: rate,
                sell: rate + 150,
                stock: stock,
                alert: 1000
            });
        }
    });
    
    saveCurrencies(masterCurrencies);
    
    alert('Keseluruhan aset (Rupiah dan valuta asing) berhasil disinkronkan ke titik nol sistem.\n\nSelisih otomatis tercatat sebagai penyesuaian sistem di mutasi bank. Mata uang asing yang baru atau diedit juga otomatis diperbarui di data valuta.');
    
    if(document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
}

// ==============================
// MASTER DATA MANAGEMENT
// ==============================
function loadMasterDataView() {
    const jobs = getMasterJobs();
    const citizens = getMasterCitizens();
    
    document.getElementById('masterJobListTable').innerHTML = jobs.map((j, i) => `
        <tr>
            <td class="align-middle">${j.name || j}</td>
            <td class="align-middle text-center">
                <span style="font-size:0.8rem; padding: 4px 8px; border-radius: 4px; background: ${j.risk === 'Rendah' ? '#10B981' : (j.risk === 'Sedang' ? '#F59E0B' : '#EF4444')}; color: white; font-weight: bold;">
                    ${j.risk || 'Rendah'}
                </span>
            </td>
            <td class="align-middle text-center">
                <button class="btn btn-sm btn-danger" onclick="removeMasterJob(${i})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" class="text-center text-muted">Belum ada data</td></tr>';
    
    document.getElementById('masterCitizenList').innerHTML = citizens.map((c, i) => `
        <tr>
            <td class="align-middle">${c.name || c}</td>
            <td class="align-middle text-center">
                <span style="font-size:0.8rem; padding: 4px 8px; border-radius: 4px; background: ${c.risk === 'Rendah' ? '#10B981' : (c.risk === 'Sedang' ? '#F59E0B' : '#EF4444')}; color: white; font-weight: bold;">
                    ${c.risk || 'Rendah'}
                </span>
            </td>
            <td class="align-middle text-center">
                <button class="btn btn-sm btn-danger" onclick="removeMasterCitizen(${i})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" class="text-center text-muted">Belum ada data</td></tr>';

    loadMasterCurrencyList();
}

function addMasterJob() {
    const input = document.getElementById('newJobInput');
    const risk = document.getElementById('newJobRisk');
    const val = input.value?.trim();
    if(val) {
        const jobs = getMasterJobs();
        jobs.push({ name: val, risk: risk ? risk.value : 'Rendah' });
        saveMasterJobs(jobs);
        input.value = '';
        if(risk) risk.value = 'Rendah';
        loadMasterDataView();
    }
}

function removeMasterJob(index) {
    const jobs = getMasterJobs();
    jobs.splice(index, 1);
    saveMasterJobs(jobs);
    loadMasterDataView();
}

function addMasterCitizen() {
    const input = document.getElementById('newCitizenInput');
    const risk = document.getElementById('newCitizenRisk');
    const val = input.value?.trim();
    if(val) {
        const citizens = getMasterCitizens();
        citizens.push({ name: val, risk: risk ? risk.value : 'Rendah' });
        saveMasterCitizens(citizens);
        input.value = '';
        if(risk) risk.value = 'Rendah';
        loadMasterDataView();
    }
}

function removeMasterCitizen(index) {
    const citizens = getMasterCitizens();
    citizens.splice(index, 1);
    saveMasterCitizens(citizens);
    loadMasterDataView();
}

function loadMasterCurrencyList() {
    const data = getMasterCurrencies();
    const tbody = document.getElementById('masterCurrencyBody');
    if(!tbody) return;
    tbody.innerHTML = data.map(c => `
        <tr>
            <td class="text-center" style="font-size: 1.5rem; vertical-align: middle;">${c.flag || '-'}</td>
            <td class="align-middle"><strong>${c.code}</strong></td>
            <td class="align-middle">${c.country || '-'}</td>
            <td class="align-middle text-center">${c.symbol || '-'}</td>
            <td class="text-center align-middle">
                <button class="btn btn-sm btn-danger" onclick="deleteMasterCurrency('${c.code}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function addMasterCurrency() {
    const code = document.getElementById('newMcCode').value.trim().toUpperCase();
    const country = document.getElementById('newMcCountry').value.trim();
    const symbol = document.getElementById('newMcSymbol').value.trim();
    const flag = document.getElementById('newMcFlag').value.trim();
    
    if(!code) {
        alert("Kode Mata Uang tidak boleh kosong!");
        return;
    }
    
    let db = getMasterCurrencies();
    if(db.find(c => c.code === code)) {
        alert("Kode mata uang ini sudah ada di master data!");
        return;
    }
    
    db.push({ code, country, symbol, flag });
    saveMasterCurrencies(db);
    
    document.getElementById('newMcCode').value = '';
    document.getElementById('newMcCountry').value = '';
    document.getElementById('newMcSymbol').value = '';
    document.getElementById('newMcFlag').value = '';
    
    loadMasterCurrencyList();
}

function deleteMasterCurrency(code) {
    if(confirm('Hapus mata uang ' + code + ' dari referensi Master Data?')) {
        let db = getMasterCurrencies();
        db = db.filter(c => c.code !== code);
        saveMasterCurrencies(db);
        loadMasterCurrencyList();
    }
}

// ==============================
// GLOBAL RATES INTEGRATION
// ==============================
async function fetchGlobalRates() {
    const tbody = document.getElementById('globalRatesTableBody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Sedang mengambil data kurs global...</td></tr>';
    
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/IDR');
        if(!response.ok) throw new Error("Gagal mengambil data");
        const data = await response.json();
        
        if(data.result !== 'success') throw new Error("Format API salah");
        
        const targetCurrencies = ['USD', 'EUR', 'SGD', 'MYR', 'AUD', 'HKD', 'GBP', 'JPY', 'CNY', 'SAR', 'AED', 'KRW'];
        
        let outHtml = '';
        targetCurrencies.forEach(code => {
            if(data.rates[code]) {
                const reverseRate = 1 / data.rates[code];
                const fmtRate = formatIdr(reverseRate);
                outHtml += `
                    <tr>
                        <td><strong>${code}</strong></td>
                        <td class="text-end" style="font-weight: 600; color: #10B981;">${fmtRate}</td>
                        <td class="text-end text-muted"><i class="fa-solid fa-bolt"></i> Live</td>
                    </tr>
                `;
            }
        });
        
        if(!outHtml) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Data kosong dari server.</td></tr>';
        } else {
            tbody.innerHTML = outHtml;
        }
    } catch(err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Gagal koneksi ke ExchangeRate-API. Periksa internet Anda.</td></tr>';
    }
}

// ==============================
// PHOTO UPLOAD COMPRESSOR
// ==============================
window.handleCustomerPhoto = function(e) {
    try {
        const file = e.files ? e.files[0] : null;
        if(!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const img = new Image();
                img.onload = function() {
                    try {
                        const canvas = document.getElementById('photoCanvas');
                        if(!canvas) {
                            alert("Elemen canvas tidak ditemukan di HTML!");
                            return;
                        }
                        const ctx = canvas.getContext('2d');
                        
                        // Resize config (Max size 600px)
                        const MAX_SIZE = 600;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Compress to JPG Base64
                        currentCustPhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        if(!currentCustPhotoBase64) {
                            alert("Gagal mengkonversi foto menjadi Base64.");
                        }
                        
                        const preview = document.getElementById('modalCustPhotoPreview');
                        preview.src = currentCustPhotoBase64;
                        preview.style.display = 'block';
                        document.getElementById('modalCustPhotoPlaceholder').style.display = 'none';
                    } catch(err3) {
                        alert("Error saat mengatur ukuran foto: " + err3.message);
                    }
                };
                img.onerror = function() {
                    alert("Tipe file yang dipilih tidak didukung atau rusak.");
                };
                img.src = event.target.result;
            } catch(err2) {
                alert("Error saat membaca memori foto: " + err2.message);
            }
        };
        reader.onerror = function() {
            alert("Sistem gagal membaca file foto dari memori lokal (browser).");
        };
        reader.readAsDataURL(file);
    } catch(err1) {
        alert("Error tak terduga pada pratinjau foto: " + err1.message);
    }
};

window.triggerKtpOcr = async function() {
    console.log("AI Auto-Fill Triggered");

    let apiKey = localStorage.getItem('mc_vision_api_key');
    if(!apiKey) {
        const { value: inputKey } = await Swal.fire({
            title: 'Kunci Akses (API Token)',
            input: 'text',
            inputLabel: 'Masukkan API Key Google Cloud Vision Anda:',
            inputPlaceholder: 'Tempel / Paste AI Vision Key di sini',
            showCancelButton: true,
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal'
        });
        
        if(!inputKey) return;
        apiKey = inputKey.trim();
        localStorage.setItem('mc_vision_api_key', apiKey);
    }

    if(!currentCustPhotoBase64) {
        return Swal.fire({
            icon: 'warning',
            title: 'Belum Ada Foto!',
            text: 'Harap unggah (Pilih File) foto identitas terlebih dahulu di kotak sebelah atas sebelum menggunakan fitur AI Auto-Fill.'
        });
    }

    const btn = document.getElementById('btnOcrKtp');
    const originalText = btn.innerHTML;
    
    // Tampilkan Loading Swal
    Swal.fire({
        title: 'Menghubungi Cloud Vision AI...',
        text: 'Mohon tunggu sebentar, sistem sedang membaca data identitas Anda.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // Ambil data Base64 murni tanpa prefix "data:image/jpeg;base64,"
        const base64Data = currentCustPhotoBase64.split(",")[1];
        
        const payload = {
            requests: [
                {
                    image: { content: base64Data },
                    features: [{ type: 'TEXT_DETECTION' }]
                }
            ]
        };

        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if(data.error) {
            if(data.error.code === 403) {
                alert("API Key Anda tidak valid, tidak memiliki izin Vision API, atau kuota habis. Silakan periksa Console Google Cloud Anda.");
                localStorage.removeItem('mc_vision_api_key');
            } else {
                alert("Error dari server AI: " + data.error.message);
            }
            return;
        }

        const annotations = data.responses[0].textAnnotations;
        if(!annotations || annotations.length === 0) {
            alert("Sistem tidak dapat mendeteksi tulisan apapun pada foto. Pastikan foto tegak, jelas, dan terang.");
            return;
        }

        let extractedNama = "";
        let extractedTptLahir = "";
        let extractedTglLahir = "";
        let extractedGender = "";
        let extractedPekerjaan = "";
        let alamatArr = [];

        // 1. Otomatis aktifkan UI Entitas (Penting agar form tidak terkunci/disabled!)
        const radioPerorangan = document.querySelector('input[name="modalCustTypeGroup"][value="1"]');
        if (radioPerorangan && !radioPerorangan.checked) {
            radioPerorangan.checked = true;
            if(typeof toggleEntitas === 'function') toggleEntitas();
        }

        // --- TEXT RECONSTRUCTION (BY Y-COORDINATE) TO HANDLE COLUMNAR OCR ---
        const words = annotations.slice(1);
        let linesFromWords = [];
        const Y_TOLERANCE = 14; 
        
        words.forEach(w => {
            if(!w.boundingPoly || !w.boundingPoly.vertices) return;
            let ySum = 0, xSum = 0, vCount = 0;
            w.boundingPoly.vertices.forEach(v => {
                if (v.y !== undefined) { ySum += v.y; vCount++; }
                if (v.x !== undefined) xSum += v.x;
            });
            if (vCount === 0) return;
            const yCenter = ySum / vCount;
            const xCenter = xSum / vCount;

            let placed = false;
            for(let l of linesFromWords) {
                if(Math.abs(l.y - yCenter) <= Y_TOLERANCE) {
                    l.words.push({ text: w.description, x: xCenter });
                    l.y = ((l.y * (l.words.length - 1)) + yCenter) / l.words.length;
                    placed = true;
                    break;
                }
            }
            if(!placed) {
                linesFromWords.push({ y: yCenter, words: [{ text: w.description, x: xCenter }] });
            }
        });

        linesFromWords.sort((a,b) => a.y - b.y);
        let reconstructedLines = linesFromWords.map(l => {
            l.words.sort((a,b) => a.x - b.x);
            return l.words.map(w => w.text).join(' ');
        });

        const fullTextUpper = reconstructedLines.join('\n').toUpperCase();
        const cleanText = fullTextUpper.replace(/\r/g, '');

        let identitasValue = "";
        let tipeIdentitasTerdeteksi = 'KTP';

        // IDENTIFIKASI TIPE DOKUMEN
        const fullRawText = annotations[0].description.toUpperCase();
        const isSIM = fullRawText.includes('SURAT IZIN MENGEMUDI') || /\b1\.\s*NAMA\b/.test(fullRawText) || /NO\.SIM/i.test(fullRawText);
        const isPassport = fullRawText.includes('PASPOR') || fullRawText.includes('PASSPORT') || fullRawText.includes('P<IDN');

        if (isPassport) {
            tipeIdentitasTerdeteksi = 'PASSPORT';
        } else if (isSIM) {
            tipeIdentitasTerdeteksi = 'SIM';
        } else {
            const nikClean = cleanText.replace(/[\s\-\:\.]/g, '');
            const digitMatch = nikClean.match(/\d{12,16}/);
            if (digitMatch) {
                if (digitMatch[0].length === 12 || digitMatch[0].length === 14) tipeIdentitasTerdeteksi = 'SIM';
                else if (digitMatch[0].length === 16) tipeIdentitasTerdeteksi = 'KTP';
            }
        }

        // ===================================
        // 1. PARSER KHUSUS PASSPORT (MRZ & Teks)
        // ===================================
        if (tipeIdentitasTerdeteksi === 'PASSPORT') {
            let passNumMatch = fullTextUpper.match(/\b([A-Z]{1,2}\d{6,7})\b/);
            if (passNumMatch) identitasValue = passNumMatch[1];
            
            let mrzArea = fullTextUpper.replace(/\s+/g, '');
            let mrz1 = mrzArea.match(/P<IDN([A-Z<]+)/);
            if(mrz1) extractedNama = mrz1[1].replace(/<+$/, '').replace(/<+/g, ' ').trim();
            
            let mrz2 = mrzArea.match(/([A-Z0-9]{8,9})<\dIDN(\d{6})\d([MF<])/);
            if(mrz2) {
                if(!identitasValue) identitasValue = mrz2[1].replace(/</g, '');
                let dob = mrz2[2];
                let year = parseInt(dob.substring(0,2));
                year = year > 30 ? "19" + year : "20" + year;
                extractedTglLahir = `${dob.substring(4,6)}-${dob.substring(2,4)}-${year}`;
                if (mrz2[3] === 'M') extractedGender = 'Laki-Laki';
                else if (mrz2[3] === 'F') extractedGender = 'Wanita';
            }

            if(!extractedNama) {
                let nameMatch = fullTextUpper.match(/FULL NAME[\s\n:;=\|]*([A-Z\s]+)/);
                if(nameMatch) extractedNama = nameMatch[1].split('\n')[0].trim();
            }
            if(!extractedTptLahir) {
                let placeMatch = fullTextUpper.match(/PLACE OF BIRTH[\s\n:;=\|]*([A-Z\s]+)/);
                if(placeMatch) extractedTptLahir = placeMatch[1].split('\n')[0].replace(/[^A-Z\s]/g, '').trim();
            }
        }

        // ===================================
        // 2. PARSER KHUSUS SIM
        // ===================================
        else if (tipeIdentitasTerdeteksi === 'SIM') {
            let simNomorMatch = cleanText.match(/\b\d{4}[-\s]*\d{4}[-\s]*\d{4,6}\b/);
            if (simNomorMatch) identitasValue = simNomorMatch[0].replace(/[\s-]/g, '');
            if (!identitasValue) {
                let any12Digits = cleanText.replace(/[\s-]/g, '').match(/\b\d{12,14}\b/);
                if(any12Digits) identitasValue = any12Digits[0];
            }

            let simNamaM = cleanText.match(/1\.[\s]*NAMA[\s:;=\|]*([^\n]+)/);
            if (simNamaM) extractedNama = simNamaM[1].trim();

            let simLahirM = cleanText.match(/2\.[\s|A-Z]*LAHIR[\s:;=\|]*([^\n]+)/);
            if (simLahirM) {
                let textB = simLahirM[1].trim();
                let dateM = textB.match(/\d{2}[\-\.\/]\d{2}[\-\.\/]\d{4}/);
                if (dateM) {
                    extractedTglLahir = dateM[0].replace(/[\.\/]/g, '-');
                    let pStr = textB.replace(dateM[0], '').replace(/[,;\:\/\-]/g, '').trim();
                    if(pStr) extractedTptLahir = pStr;
                }
            }

            let simGenderM = cleanText.match(/PRIA[\s]*\/[\s]*WANITA[\s:;=\|]*([^\n]+)/);
            if (!simGenderM) simGenderM = cleanText.match(/3\.[\s\S]*?([^\n]+)/);
            if (simGenderM) {
                if (simGenderM[1].includes('PRIA') || simGenderM[1].includes('LAKI')) extractedGender = 'Laki-Laki';
                else if (simGenderM[1].includes('WANITA') || simGenderM[1].includes('PEREMPUAN')) extractedGender = 'Wanita';
            }

            let simJobM = cleanText.match(/5\.[\s]*PEKERJAAN[\s:;=\|]*([^\n]+)/);
            if (simJobM) extractedPekerjaan = simJobM[1].replace(/[:;=\|]/g, '').trim();

            let simAlamatM = cleanText.match(/4\.[\s]*ALAMAT[\s:;=\|]*([\s\S]*?)(?:5\.|PEKERJAAN)/);
            if (simAlamatM) {
                let almt = simAlamatM[1].replace(/\n/g, ' ').replace(/[:;=\|]/g, '').trim();
                alamatArr.push(almt);
            }
        } 
        
        // ===================================
        // 3. PARSER KHUSUS KTP
        // ===================================
        else {
            let ktpNomorMatch = cleanText.replace(/[\s\-\:\.]/g, '').match(/\d{16}/);
            if (ktpNomorMatch) {
                identitasValue = ktpNomorMatch[0];
                
                // DEKODE NIK CERDAS (Otomatis Ekstrak Tanggal Lahir & Gender Langsung dari NIK)
                // Format NIK: ppppkkhhbbttnnnn (hh = hari, bb = bulan, tt = tahun)
                let nikStr = identitasValue;
                let h = parseInt(nikStr.substring(6, 8), 10);
                let b = parseInt(nikStr.substring(8, 10), 10);
                let t = parseInt(nikStr.substring(10, 12), 10);
                
                if (h > 40) {
                    extractedGender = 'Wanita';
                    h -= 40;
                } else if (h > 0) {
                    extractedGender = 'Laki-Laki';
                }
                
                if (h > 0 && h <= 31 && b > 0 && b <= 12) {
                    let yearNow = new Date().getFullYear();
                    let currentTT = yearNow % 100;
                    let fullYear = (t > currentTT) ? (1900 + t) : (2000 + t);
                    
                    let strH = h.toString().padStart(2, '0');
                    let strB = b.toString().padStart(2, '0');
                    extractedTglLahir = `${strH}-${strB}-${fullYear}`; // Format baku standar 17-08-1945
                }
            }

            let lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let foundAlamat = false;
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                
                if (line.includes('NAMA') && !line.includes('KECAMATAN') && !line.includes('PROVINSI') && !line.includes('AGAMA')) {
                    let n = line.replace(/NAMA/g, '').replace(/[:;=\|]/g, '').trim();
                    if (n.length < 2 && i + 1 < lines.length) n = lines[i+1].replace(/[:;=\|]/g, '').trim();
                    if (n.length > 2) extractedNama = n;
                }

                if ((line.includes('LAHIR') || line.includes('TEMPAT')) && !line.includes('ALAMAT')) {
                    let t = line.replace(/TEMPAT(?:\s*\/\s*)?TGL\.?\s*LAHIR/g, '').replace(/[:;=\|]/g, '').trim();
                    if (t.length < 4 && i + 1 < lines.length) t = lines[i+1].replace(/[:;=\|]/g, '').trim();
                    
                    let dMatch = t.match(/\d{2}[\s\-./]+\d{2}[\s\-./]+(19|20)\d{2}/);
                    if (dMatch) {
                        if (!extractedTglLahir) extractedTglLahir = dMatch[0].replace(/[\s./]/g, '-').replace(/-+/g, '-');
                        extractedTptLahir = t.replace(dMatch[0], '').replace(/[,;\:\/\-]/g, '').trim();
                    } else {
                        // fallback find anywhere
                        let fallbackDate = line.match(/\d{2}[\s\-./]+\d{2}[\s\-./]+(19|20)\d{2}/);
                        if(fallbackDate && !extractedTglLahir) extractedTglLahir = fallbackDate[0].replace(/[\s./]/g, '-').replace(/-+/g, '-');
                    }
                }

                if (line.includes('KELAMIN') || line.includes('LAKI') || line.includes('PEREMPUAN') || line.includes('WANITA')) {
                    if (line.includes('LAKI') || line.includes('PRIA')) extractedGender = 'Laki-Laki';
                    else if (line.includes('PEREMPUAN') || line.includes('WANITA')) extractedGender = 'Wanita';
                }

                if (line.includes('PEKERJAAN')) {
                    let p = line.replace(/PEKERJAAN/g, '').replace(/[:;=\|]/g, '').trim();
                    if(p.length > 2) extractedPekerjaan = p;
                }

                if (line.includes('ALAMAT')) {
                    foundAlamat = true;
                    let a = line.replace(/ALAMAT/g, '').replace(/[:;=\|]/g, '').trim();
                    if (a.length > 1) alamatArr.push(a);
                    continue;
                }
                if (foundAlamat) {
                    if (line.includes('AGAMA') || line.includes('STATUS') || line.includes('KAWIN') || line.includes('GOL. DARAH') || line.includes('PEKERJAAN')) {
                        foundAlamat = false;
                    } else {
                        alamatArr.push(line.replace(/[:;=\|]/g, '').trim());
                    }
                }
            }
            
            // Fallback tingkat dewa: Jika Tgl Lahir masih kosong, cari teks berbentuk tanggal di seluruh KTP
            if (!extractedTglLahir) {
                let emergencyDate = cleanText.match(/\b\d{2}[\s\-./]+\d{2}[\s\-./]+(19|20)\d{2}\b/);
                if (emergencyDate) extractedTglLahir = emergencyDate[0].replace(/[\s./]/g, '-').replace(/-+/g, '-');
            }
        }

        // --- ISIKAN KE FORMULA UI ---
        
        // 1. Isikan Nomor Identitas
        if(identitasValue) {
            const passportInput = document.getElementById('modalCustPassport');
            if(passportInput) {
                passportInput.disabled = false;
                passportInput.value = identitasValue;
            }
        }
        
        // 2. Set Combobox Tipe Identitas (KTP / SIM / PASSPORT)
        const idTypeSelect = document.getElementById('modalCustIdType');
        if(idTypeSelect) {
            for (let i = 0; i < idTypeSelect.options.length; i++) {
                if (idTypeSelect.options[i].value === tipeIdentitasTerdeteksi) {
                    idTypeSelect.selectedIndex = i;
                    if(typeof toggleCustPassportPlaceholder === 'function') toggleCustPassportPlaceholder();
                    break;
                }
            }
        }

        // 3. Isikan Nama
        if (extractedNama) document.getElementById('modalCustName').value = extractedNama;
        
        // 4. Isikan Tempat & Tgl
        if (extractedTptLahir) document.getElementById('modalCustBirthPlace').value = extractedTptLahir;
        if (extractedTglLahir) {
            let parts = extractedTglLahir.split('-');
            let finalFormat = extractedTglLahir;
            if(parts.length === 3) {
                // If it's DD-MM-YYYY, convert to YYYY-MM-DD for standard Javascript parsing
                if(parts[2].length === 4) {
                    finalFormat = `${parts[2]}-${parts[1]}-${parts[0]}`; 
                }
            }
            
            const dateInput = document.getElementById('modalCustBirthDate');
            if (dateInput._flatpickr) {
                let parsedObj = new Date(finalFormat);
                if (!isNaN(parsedObj)) {
                    dateInput._flatpickr.setDate(parsedObj);
                } else {
                    dateInput.value = finalFormat; // ultimate fallback
                }
            } else {
                dateInput.value = finalFormat;
            }
        }
        
        // 5. Isikan Gender
        if (extractedGender) document.getElementById('modalCustGender').value = extractedGender;

        // 6. Pekerjaan (Dropdown Auto-Inject jika opsi tidak ada)
        if (extractedPekerjaan) {
            const jobSelect = document.getElementById('modalCustJob');
            if(jobSelect) {
                let found = false;
                for(let i=0; i<jobSelect.options.length; i++) {
                    if(jobSelect.options[i].text.toUpperCase().includes(extractedPekerjaan) || extractedPekerjaan.includes(jobSelect.options[i].text.toUpperCase())) {
                        jobSelect.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
                // Jika pekerjaan di SIM tidak ada di daftar profil risiko
                if(!found) {
                    const opt = document.createElement('option');
                    opt.value = extractedPekerjaan;
                    opt.text = extractedPekerjaan + " (Disalin dari SIM)";
                    jobSelect.add(opt);
                    jobSelect.value = extractedPekerjaan;
                }
            }
        }

        // 7. Isikan Alamat
        if (alamatArr.length > 0) {
            // Karena diminta Kapital Semua di nama, alamat sebaiknya juga dikapital
            let finalAlamat = alamatArr.join(' ').toUpperCase();
            document.getElementById('modalCustAddress').value = finalAlamat;
        }

        Swal.close();
        alert("Wah, Berhasil! Fitur AI Auto-Fill menarik data dengan algoritma rekonstruksi baris terbaru. \n\nSilakan periksa kembali dan sesuaikan secara manual bila ada ketidaktepatan baca (typo).");

    } catch(err) {
        Swal.close();
        console.error("OCR Error:", err);
        alert("Gagal menghubungi server AI Google Cloud Vision: " + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ==============================
// CUSTOMER EXPORT / PRINT
// ==============================
window.exportCustomersXlsx = async function() {
    const customers = getCustomers();
    if(customers.length === 0) return alert('Tidak ada data nasabah untuk diekspor.');
    
    let cleanedData = customers.map(c => ({
        "ID_Nasabah": c.id_nasabah,
        "Tipe": c.kn == '1' ? 'Perorangan' : 'Perusahaan',
        "Nama": c.nama,
        "Warga_Negara": c.warga_negara,
        "Jenis_Kelamin": c.jenis_kelamin,
        "Tempat_Lahir": c.tempat_lahir,
        "Tanggal_Lahir": c.tanggal_lahir,
        "Alamat": c.alamat,
        "Pekerjaan": c.pekerjaan,
        "No_HP": c.no_hp,
        "No_Rekening": c.no_rekening,
        "No_KTP": c.no_ktp,
        "Selain_KTP": c.selain_ktp,
        "No_CIF": c.no_cif,
        "NPWP": c.npwp,
        "Local_ID": c.local_id,
        "Tgl_Daftar": window.formatDateToDMY(c.tgl_daftar)
    }));

    const ws = XLSX.utils.json_to_sheet(cleanedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nasabah");
    
    if(typeof safeExportXLSX === 'function') {
        safeExportXLSX(wb, `Data_Nasabah_${new Date().toISOString().slice(0,10)}.xlsx`);
    } else {
        XLSX.writeFile(wb, `Data_Nasabah_${new Date().toISOString().slice(0,10)}.xlsx`);
    }
};

function printCustomersPdf() {
    const printArea = document.getElementById('customers-view').innerHTML;
    const originalBody = document.body.innerHTML;
    
    document.body.innerHTML = `
        <div style="padding: 20px; font-family: sans-serif; color: black !important; background: white !important;">
            <h2 style="text-align:center;">Laporan Data Nasabah (KYC) Lengkap</h2>
            <hr>
            ${printArea}
        </div>
    `;
    window.print();
    // Restore SPA
    window.location.reload();
}

// ==============================
// LAPORAN LKU (REKAM JEJAK STOK MUNDUR / TIME-TRAVEL ALGORITHM)
// ==============================
function loadLaporanLku() {
    try {
        let startStr = document.getElementById('lkuStartDate').value;
        let endStr = document.getElementById('lkuEndDate').value;
        
        // Auto-fill dates if empty so the user always sees something instead of blank blocks
        if(!startStr || !endStr) {
            const todayStr = new Date().toISOString().split('T')[0];
            if(!startStr) startStr = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
            if(!endStr) endStr = todayStr;
            
            document.getElementById('lkuStartDate').value = startStr;
            document.getElementById('lkuEndDate').value = endStr;
        }
        
        const trxs = getTransactions();
        const currencies = getCurrencies();
        
        let lkuData = {};
        currencies.forEach(c => {
            if (!c || !c.code) return;
            let baseCode = String(c.code).substring(0, 3).toUpperCase();
            if(!lkuData[baseCode]) {
                lkuData[baseCode] = {
                    valuta: baseCode,
                    currentStock: 0,
                    kursValuasi: parseFloat(c.buy) || 0,
                    sumJualAfter: 0,
                    sumBeliAfter: 0,
                    sumJualPeriod: 0,
                    sumBeliPeriod: 0,
                    sumJualRpPeriod: 0,
                    sumBeliRpPeriod: 0
                };
            }
            lkuData[baseCode].currentStock += (parseFloat(c.stock) || 0);
        });
        
        trxs.forEach(t => {
            if (!t || !t.valuta || !t.timestamp) return;
            
            // Standardize code: find the 3-letter currency code (e.g. "USD" from "US USD")
            let codeMatches = String(t.valuta).toUpperCase().match(/[A-Z]{3}/g);
            let code = codeMatches ? codeMatches[codeMatches.length - 1] : String(t.valuta).substring(0,3).toUpperCase().trim();
            if(!lkuData[code]) return;
            
            // Robust Strict DD/MM/YYYY Parsing
            let dObj = null;
            let parts = String(t.timestamp).split(/[-/ T]/); // includes 'T' for ISO strings
            if(String(t.timestamp).includes('-') && parts.length >= 3 && parts[0].length === 4) {
               // likely ISO format (YYYY-MM-DD...)
               dObj = new Date(t.timestamp);
            } else if(parts.length >= 3 && parts[0].length <= 2) {
                // assume DD/MM/YYYY or DD-MM-YYYY
                dObj = new Date(`${parts[2].slice(0,4)}-${parts[1]}-${parts[0]}`);
            } else {
                dObj = new Date(t.timestamp);
            }
            if(isNaN(dObj.getTime())) return;
            
            let tDateStr = dObj.getFullYear() + "-" + String(dObj.getMonth() + 1).padStart(2, '0') + "-" + String(dObj.getDate()).padStart(2, '0');
            
            // Utility cleanNum for currency calculation
            let cleanValArr = (val) => {
                if(typeof val === 'number') return val;
                if(!val) return 0;
                let s = String(val).replace(/Rp|\s+/gi, '').trim();
                if(s.includes('.') && s.includes(',')) {
                    const lastDot = s.lastIndexOf('.');
                    const lastComma = s.lastIndexOf(',');
                    if(lastComma > lastDot) s = s.replace(/\./g, '').replace(/,/g, '.'); 
                    else s = s.replace(/,/g, ''); 
                } else if(s.includes(',')) {
                    const pts = s.split(',');
                    if(pts.length === 2 && pts[1].length === 3) s = s.replace(/,/g, ''); 
                    else s = s.replace(/,/g, '.'); 
                } else if (s.includes('.')) {
                    const pts = s.split('.');
                    if(pts.length > 2 || (pts.length === 2 && pts[1].length === 3)) s = s.replace(/\./g, '');
                }
                return parseFloat(s) || 0;
            };
            
            let nominal = cleanValArr(t.nominal);
            let totalRp = cleanValArr(t.total);
            let rawTipe = String(t.tipe || '').trim().toUpperCase();
            
            let isJual = rawTipe === 'JUAL' || rawTipe.includes('JUAL');
            let isBeli = rawTipe === 'BELI' || rawTipe.includes('BELI');
            
            if(tDateStr > endStr) {
                if(isJual) lkuData[code].sumJualAfter += nominal;
                if(isBeli) lkuData[code].sumBeliAfter += nominal;
            }
            else if(tDateStr >= startStr && tDateStr <= endStr) {
                if(isJual) {
                    lkuData[code].sumJualPeriod += nominal;
                    lkuData[code].sumJualRpPeriod += totalRp;
                }
                if(isBeli) {
                    lkuData[code].sumBeliPeriod += nominal;
                    lkuData[code].sumBeliRpPeriod += totalRp;
                }
            }
        });
        
        const tbody = document.getElementById('lkuTableBody');
        if(!tbody) return;
        let html = '';
        
        const fmt = (num) => new Intl.NumberFormat('id-ID').format(num || 0);
        const fmtRp = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num || 0);
        
        Object.keys(lkuData).sort().forEach(code => {
            let d = lkuData[code];
            
            let stokAkhir = d.currentStock + d.sumJualAfter - d.sumBeliAfter;
            let saldoAwal = stokAkhir + d.sumJualPeriod - d.sumBeliPeriod;
            
            let rpAwal = saldoAwal * d.kursValuasi;
            let rpAkhir = stokAkhir * d.kursValuasi;
            
            let avgBeli = d.sumBeliPeriod > 0 ? (d.sumBeliRpPeriod / d.sumBeliPeriod) : 0;
            let avgJual = d.sumJualPeriod > 0 ? (d.sumJualRpPeriod / d.sumJualPeriod) : 0;
            
            html += `
                <tr>
                    <td class="text-center font-weight-bold align-middle">${code}</td>
                    
                    <td class="text-end">${fmt(saldoAwal)}</td>
                    <td class="text-end text-muted">${fmtRp(d.kursValuasi)}</td>
                    <td class="text-end">${fmtRp(rpAwal)}</td>
                    
                    <td class="text-end text-success">+ ${fmt(d.sumBeliPeriod)}</td>
                    <td class="text-end text-muted">${fmtRp(avgBeli)}</td>
                    <td class="text-end text-success">${fmtRp(d.sumBeliRpPeriod)}</td>
                    
                    <td class="text-end text-danger">- ${fmt(d.sumJualPeriod)}</td>
                    <td class="text-end text-muted">${fmtRp(avgJual)}</td>
                    <td class="text-end text-danger">${fmtRp(d.sumJualRpPeriod)}</td>
                    
                    <td class="text-end font-weight-bold text-info">${fmt(stokAkhir)}</td>
                    <td class="text-end text-muted">${fmtRp(d.kursValuasi)}</td>
                    <td class="text-end font-weight-bold text-info">${fmtRp(rpAkhir)}</td>
                </tr>
            `;
        });
        
        if(html === '') {
            html = '<tr><td colspan="13" class="text-center">Tidak ada Master Valuta yang terdaftar atau data belum disinkronkan.</td></tr>';
        }
        tbody.innerHTML = html;
        
    } catch(err) {
        console.error("Error loading LKU:", err);
        const tbody = document.getElementById('lkuTableBody');
        if(tbody) tbody.innerHTML = `<tr><td colspan="13" class="text-center text-danger">Terjadi kesalahan sistem saat memproses rekam jejak.</td></tr>`;
    }
}

// ==============================
// ASSET REPORT LOGIC
// ==============================
function loadAssetReport() {
    let assets = getAssets();
    const tbody = document.getElementById('assetTableBody');
    if(!tbody) return;
    
    // Safety check for old assets without IDs
    let needsSave = false;
    assets = assets.map(a => {
        if(!a.id) {
            a.id = 'AST-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            needsSave = true;
        }
        return a;
    });
    if(needsSave) saveAssets(assets);

    let html = '';
    let sumPrice = 0;
    let sumDepreciation = 0;
    let sumBookValue = 0;
    const today = new Date();

    assets.forEach(asset => {
        const purchaseDate = new Date(asset.purchaseDate);
        
        let monthsElapsed = (today.getFullYear() - purchaseDate.getFullYear()) * 12;
        monthsElapsed -= purchaseDate.getMonth();
        monthsElapsed += today.getMonth();
        if (today.getDate() < purchaseDate.getDate()) {
            monthsElapsed--;
        }
        
        if (monthsElapsed < 0) monthsElapsed = 0;

        const usefulLifeMonths = asset.usefulLifeYears * 12;
        const monthlyDepreciation = asset.purchasePrice / usefulLifeMonths;
        
        let accumulatedDepreciation = monthlyDepreciation * monthsElapsed;
        if (accumulatedDepreciation > asset.purchasePrice) {
            accumulatedDepreciation = asset.purchasePrice;
        }

        const bookValue = asset.purchasePrice - accumulatedDepreciation;

        sumPrice += asset.purchasePrice;
        sumDepreciation += accumulatedDepreciation;
        sumBookValue += bookValue;

        html += `
            <tr>
                <td>${asset.name}</td>
                <td>${purchaseDate.toLocaleDateString('id-ID')}</td>
                <td class="text-end">${formatIdr(asset.purchasePrice)}</td>
                <td class="text-center">${asset.usefulLifeYears}</td>
                <td class="text-end text-danger">${formatIdr(accumulatedDepreciation)}</td>
                <td class="text-end text-info">${formatIdr(bookValue)}</td>
                <td class="text-center" style="white-space: nowrap;">
                    <button class="btn btn-sm" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 5px;" onclick="openAssetModal('${asset.id}')">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn btn-sm" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 4px 8px; border-radius: 4px;" onclick="deleteAsset('${asset.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    if(assets.length === 0) {
        html = '<tr><td colspan="7" class="text-center text-muted">Belum ada data aset terdaftar</td></tr>';
    }

    tbody.innerHTML = html;
    
    document.getElementById('totalAssetPrice').textContent = formatIdr(sumPrice);
    document.getElementById('totalAssetDepreciation').textContent = formatIdr(sumDepreciation);
    document.getElementById('totalAssetBookValue').textContent = formatIdr(sumBookValue);
}

window.openAssetModal = function(id = null) {
    if(id) {
        const assets = getAssets();
        const asset = assets.find(a => a.id === id);
        if(asset) {
            document.getElementById('modalAssetTitle').textContent = 'Edit Aset';
            document.getElementById('modalAssetId').value = asset.id;
            document.getElementById('modalAssetName').value = asset.name;
            document.getElementById('modalAssetDate').value = asset.purchaseDate;
            document.getElementById('modalAssetPrice').value = asset.purchasePrice;
            document.getElementById('modalAssetLife').value = asset.usefulLifeYears;
        }
    } else {
        document.getElementById('modalAssetTitle').textContent = 'Tambah Aset Baru';
        document.getElementById('modalAssetId').value = '';
        document.getElementById('modalAssetName').value = '';
        document.getElementById('modalAssetDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('modalAssetPrice').value = '';
        document.getElementById('modalAssetLife').value = '';
    }
    
    document.getElementById('assetModal').style.display = 'block';
};

window.closeAssetModal = function() {
    document.getElementById('assetModal').style.display = 'none';
};

window.saveAsset = function saveAsset() {
    const name = document.getElementById('modalAssetName').value.trim();
    const idElem = document.getElementById('modalAssetId');
    const id = idElem ? idElem.value : '';
    const date = document.getElementById('modalAssetDate').value;
    const price = parseFloat(document.getElementById('modalAssetPrice').value);
    const life = parseInt(document.getElementById('modalAssetLife').value);

    if(!name || !date || !price || !life) {
        alert("Harap lengkapi semua form!");
        return;
    }

    let assets = getAssets();
    
    if(id) {
        // Edit mode
        const index = assets.findIndex(a => a.id === id);
        if(index > -1) {
            assets[index].name = name;
            assets[index].purchaseDate = date;
            assets[index].purchasePrice = price;
            assets[index].usefulLifeYears = life;
        }
    } else {
        // Create mode
        assets.push({
            id: 'AST-' + Date.now().toString().slice(-6),
            name: name,
            purchaseDate: date,
            purchasePrice: price,
            usefulLifeYears: life
        });
    }

    saveAssets(assets);
    closeAssetModal();
    loadAssetReport();
};

window.deleteAsset = function(id) {
    if(confirm('Yakin ingin menghapus aset ini?')) {
        let assets = getAssets();
        assets = assets.filter(a => a.id === id ? false : true);
        saveAssets(assets);
        loadAssetReport();
    }
};

// ==============================
// GRANULAR BI REPORT LOGIC
// ==============================
window.loadLaporanGranular = function() {
    const startStr = document.getElementById('granularStartDate').value || '';
    const endStr = document.getElementById('granularEndDate').value || '';
    
    if(!startStr || !endStr) return;
    
    const trxs = getTransactions();
    const customers = getCustomers();
    const tbody = document.getElementById('granularTableBody');
    if(!tbody) return;
    
    const startDate = new Date(startStr);
    startDate.setHours(0,0,0,0);
    const endDate = new Date(endStr);
    endDate.setHours(23,59,59,999);
    
    // Filter transactions
    const filteredTrx = trxs.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate >= startDate && tDate <= endDate;
    });
    
    let html = '';
    
    if(filteredTrx.length === 0) {
        html = '<tr><td colspan="14" class="text-center text-muted">Tidak ada data transaksi pada rentang tanggal ini.</td></tr>';
    } else {
        filteredTrx.forEach((t, i) => {
            let tDateStr = window.formatDateToDMY(t.timestamp);
            
            // Get customer info
            let cName = 'Nasabah Umum / Walk-in';
            let cType = '-';
            let cIdType = '-';
            let cIdNum = '-';
            let cJob = '-';
            
            if(t.customerId && t.customerId !== '-') {
                const c = customers.find(cust => cust.id_nasabah === t.customerId);
                if(c) {
                    cName = c.nama || '-';
                    cType = c.kn === '2' ? 'Corporate' : (c.tipe === '2' ? 'Corporate' : 'Perorangan');
                    cIdType = c.jenis_id || (c.no_ktp && c.no_ktp !== '-' ? 'NIK/KTP' : 'Lainnya');
                    cIdNum = c.identitas || (c.no_ktp && c.no_ktp !== '-' ? c.no_ktp : c.selain_ktp) || '-';
                    cJob = c.pekerjaan || '-';
                }
            }
            
            let trxType = t.tipe === 'BELI' ? 'Pembelian' : 'Penjualan';
            let purpose = t.purpose || 'Lainnya';
            let method = t.paymentMethod || 'CASH';
            let channel = 'WALK_IN / LOKET';
            
            html += `
                <tr>
                    <td>${t.customerId || '-'}</td>
                    <td>${tDateStr}</td>
                    <td>${cIdType}</td>
                    <td>${cIdNum}</td>
                    <td>${cName}</td>
                    <td>${cJob}</td>
                    <td>${cType}</td>
                    <td class="text-center font-weight-bold">${t.valuta.substring(0, 3).toUpperCase()}</td>
                    <td class="text-end">${t.nominal ? t.nominal.toLocaleString() : '0'}</td>
                    <td class="text-end">${formatRate(t.rate)}</td>
                    <td>${trxType}</td>
                    <td>${purpose}</td>
                    <td>${method}</td>
                    <td>${channel}</td>
                </tr>
            `;
        });
    }
    
    tbody.innerHTML = html;
};

window.exportGranularExcel = async function() {
    const startStr = document.getElementById('granularStartDate').value || '';
    const endStr = document.getElementById('granularEndDate').value || '';
    
    if(!startStr || !endStr) {
        alert("Pilih rentang tanggal terlebih dahulu.");
        return;
    }
    
    const trxs = getTransactions();
    const customers = getCustomers();
    
    const startDate = new Date(startStr);
    startDate.setHours(0,0,0,0);
    const endDate = new Date(endStr);
    endDate.setHours(23,59,59,999);
    
    const filteredTrx = trxs.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate >= startDate && tDate <= endDate;
    });
    
    if(filteredTrx.length === 0) {
        alert("Tidak ada data untuk diexport pada rentang tanggal ini.");
        return;
    }
    
    // Build Excel Array
    const excelData = [
        [
            "ID KC*)",
            "Tanggal Transaksi",
            "Jenis Identitas Nasabah \n(NIK / NPWP / IZIN KUPVA BB)",
            "Nomor Identitas Nasabah \n[NOMOR NIK / NPWP / IZIN KUPVA BB]",
            "Nama Lengkap",
            "Pekerjaan",
            "Jenis Kustomer",
            "Mata Uang",
            "Nominal Transaksi Valas",
            "Nilai Kurs Transaksi",
            "Jenis Transaksi",
            "Tujuan Transaksi",
            "Metode Penyelesaian Transaksi",
            "Delivery Channel"
        ]
    ];

    filteredTrx.forEach((t, i) => {
        let tDateStr = window.formatDateToDMY(t.timestamp);
        
        let cName = 'Nasabah Umum / Walk-in';
        let cType = '-';
        let cIdType = '-';
        let cIdNum = '-';
        let cJob = '-';
        
        if(t.customerId && t.customerId !== '-') {
            const c = customers.find(cust => cust.id_nasabah === t.customerId);
            if(c) {
                cName = c.nama || '-';
                cType = c.kn === '2' ? 'Corporate' : (c.tipe === '2' ? 'Corporate' : 'Perorangan');
                cIdType = c.jenis_id || (c.no_ktp && c.no_ktp !== '-' ? 'NIK' : 'Lainnya');
                cIdNum = c.identitas || (c.no_ktp && c.no_ktp !== '-' ? c.no_ktp : c.selain_ktp) || '-';
                cJob = c.pekerjaan || '-';
            }
        }
        
        let trxType = t.tipe === 'BELI' ? 'Pembelian' : 'Penjualan';
        let purpose = t.purpose || 'Lainnya';
        let method = t.paymentMethod || 'CASH';
        let channel = 'WALK_IN / LOKET';
        
        excelData.push([
            t.customerId || '-',
            tDateStr,
            cIdType,
            cIdNum,
            cName,
            cJob,
            cType,
            t.valuta.substring(0, 3).toUpperCase(),
            (t.nominal || 0),
            (t.rate || 0),
            trxType,
            purpose,
            method,
            channel
        ]);
    });
    
    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Granular BI");
    
    const fileName = `Laporan_Granular_${startStr}_sd_${endStr}.xlsx`;
    const ok = await window.safeExportXLSX(wb, fileName);
    if(ok) alert("Data berhasil diekspor dengan format standar BI.");
};

// ==============================
// ACCOUNTING REPORTS LOGIC
// ==============================

window.populateMonthYearSelects = function(mId, yId) {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let mHtml = '';
    months.forEach((m, i) => {
        let val = (i+1).toString().padStart(2, '0');
        mHtml += `<option value="${val}">${m}</option>`;
    });
    document.getElementById(mId).innerHTML = mHtml;
    
    const currYear = new Date().getFullYear();
    let yHtml = '';
    for(let y = currYear - 5; y <= currYear + 1; y++) {
        yHtml += `<option value="${y}">${y}</option>`;
    }
    document.getElementById(yId).innerHTML = yHtml;
    
    // Set current
    document.getElementById(mId).value = (new Date().getMonth() + 1).toString().padStart(2, '0');
    document.getElementById(yId).value = currYear;
};

// --- BUKU BESAR ---
window.loadBukuBesar = function() {
    const acc = document.getElementById('ledgerAccount').value;
    const m = document.getElementById('ledgerMonth').value;
    const y = document.getElementById('ledgerYear').value;
    const prefix = `${y}-${m}`;
    
    const tbody = document.getElementById('ledgerTableBody');
    if(!tbody) return;
    
    const trxs = getTransactions();
    const mutations = getMutations();
    const expenses = getExpenses();
    const adjs = getAdjustments();
    
    let entries = []; 
    
    if(acc === 'KAS' || acc === 'ALL') {
        trxs.forEach(t => {
            if(t.paymentMethod === 'CASH' || t.paymentMethod === 'SPLIT') {
                let amt = t.total;
                if(amt > 0) {
                    if(t.tipe === 'JUAL') entries.push({ date: t.timestamp, desc: `Trx Penjualan Valas ${t.valuta} (Ref: ${t.id})`, debit: amt, credit: 0 });
                    else entries.push({ date: t.timestamp, desc: `Trx Pembelian Valas ${t.valuta} (Ref: ${t.id})`, debit: 0, credit: amt });
                }
            }
        });
        expenses.forEach(e => {
            entries.push({ date: e.timestamp, desc: `Biaya: ${e.keterangan}`, debit: 0, credit: e.nominal });
        });
        adjs.forEach(a => {
            if(a.impact === 'MASUK_CASH') entries.push({ date: a.timestamp, desc: `Penyesuaian: ${a.kategori} (${a.deskripsi})`, debit: a.nominal, credit: 0 });
            else if(a.impact === 'KELUAR_CASH') entries.push({ date: a.timestamp, desc: `Penyesuaian: ${a.kategori} (${a.deskripsi})`, debit: 0, credit: a.nominal });
        });
    } 
    if(acc === 'BANK' || acc === 'ALL') {
        mutations.forEach(m => {
            if(m.tipe === 'MASUK') entries.push({ date: m.timestamp, desc: `Mutasi Masuk (${m.keterangan})`, debit: m.nominal, credit: 0 });
            else entries.push({ date: m.timestamp, desc: `Mutasi Keluar (${m.keterangan})`, debit: 0, credit: m.nominal });
        });
        trxs.forEach(t => {
            if(t.paymentMethod === 'TRANSFER') {
                if(t.tipe === 'JUAL') entries.push({ date: t.timestamp, desc: `Trx Jual via Transfer ${t.valuta} (Ref: ${t.id})`, debit: t.total, credit: 0 });
                else entries.push({ date: t.timestamp, desc: `Trx Beli via Transfer ${t.valuta} (Ref: ${t.id})`, debit: 0, credit: t.total });
            }
        });
        adjs.forEach(a => {
            if(a.impact === 'MASUK_BANK') entries.push({ date: a.timestamp, desc: `Penyesuaian: ${a.kategori} (${a.deskripsi})`, debit: a.nominal, credit: 0 });
            else if(a.impact === 'KELUAR_BANK') entries.push({ date: a.timestamp, desc: `Penyesuaian: ${a.kategori} (${a.deskripsi})`, debit: 0, credit: a.nominal });
        });
    }
    if(acc === 'BIAYA' || acc === 'ALL') {
        expenses.forEach(e => {
            if(e.tipe === 'PENDAPATAN') {
                entries.push({ date: e.timestamp, desc: `Pendapatan: ${e.keterangan}`, debit: 0, credit: e.nominal });
            } else {
                entries.push({ date: e.timestamp, desc: `Biaya Operasional: ${e.keterangan}`, debit: e.nominal, credit: 0 });
            }
        });
    }
    if(acc === 'VALAS' || acc === 'ALL') {
        trxs.forEach(t => {
            if(t.tipe === 'BELI') entries.push({ date: t.timestamp, desc: `Beli ${t.nominal} ${t.valuta} (Ref: ${t.id})`, debit: t.total, credit: 0 });
            else entries.push({ date: t.timestamp, desc: `Jual ${t.nominal} ${t.valuta} (Ref: ${t.id})`, debit: 0, credit: t.total });
        });
    }

    // Filter by Month & Sort
    entries = entries.filter(e => e.date.startsWith(prefix)).sort((a,b) => a.date.localeCompare(b.date));
    
    let html = '';
    let saldo = 0; 
    
    if(entries.length === 0) {
        html = '<tr><td colspan="5" class="text-center text-muted">Tidak ada mutasi di bulan ini.</td></tr>';
    } else {
        entries.forEach(e => {
            saldo += (e.debit - e.credit);
            let dStr = new Date(e.date).toLocaleDateString('id-ID', {day:'2-digit', month:'2-digit', year:'numeric'});
            html += `
                <tr>
                    <td>${dStr}</td>
                    <td>${e.desc}</td>
                    <td class="text-end text-success">${e.debit > 0 ? formatIdr(e.debit) : '-'}</td>
                    <td class="text-end text-danger">${e.credit > 0 ? formatIdr(e.credit) : '-'}</td>
                    <td class="text-end font-weight-bold">${formatIdr(Math.abs(saldo))}</td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = html;
};

// --- LABA RUGI ---
window.loadLabaRugi = function() {
    const m = document.getElementById('plMonth').value;
    const y = document.getElementById('plYear').value;
    const prefix = `${y}-${m}`;
    
    const trxs = getTransactions().filter(t => t.timestamp.startsWith(prefix));
    const expenses = getExpenses().filter(e => e.timestamp.startsWith(prefix));
    const currencies = getCurrencies();
    
    let d = {};
    for(let i=1; i<=25; i++) d[i.toString().padStart(2, '0')] = 0;

    // --- Retrospective Calculation for Saldo Awal (03) & Saldo Akhir (05) ---
    const allTrxs = getTransactions();
    const startStr = `${prefix}-01`;
    const endStr = `${prefix}-31`; // Approx end of month for string comparison

    let totalRpAwal = 0;
    let totalRpAkhir = 0;

    currencies.forEach(c => {
        let currentStock = c.stock || 0;
        let kursValuasi = c.buy || 0; // Using current buy rate as asset valuation
        
        let sumJualAfter = 0, sumBeliAfter = 0;
        let sumJualPeriod = 0, sumBeliPeriod = 0;

        allTrxs.forEach(t => {
            if(t.valuta !== c.code) return;
            let tDate = t.timestamp.split('T')[0];
            let nominal = parseFloat(t.nominal) || 0;
            
            if(tDate > endStr) {
                if(t.tipe === 'JUAL') sumJualAfter += nominal;
                if(t.tipe === 'BELI') sumBeliAfter += nominal;
            } else if(tDate >= startStr && tDate <= endStr) {
                if(t.tipe === 'JUAL') sumJualPeriod += nominal;
                if(t.tipe === 'BELI') sumBeliPeriod += nominal;
            }
        });

        let stokAkhir = currentStock + sumJualAfter - sumBeliAfter;
        let stokAwal = stokAkhir + sumJualPeriod - sumBeliPeriod;

        totalRpAkhir += (stokAkhir * kursValuasi);
        totalRpAwal += (stokAwal * kursValuasi);
    });

    d['03'] = totalRpAwal;
    d['05'] = totalRpAkhir;
    // ----------------------------------------------------------------------

    let margin = 0;
    trxs.forEach(t => {
        if(t.tipe === 'JUAL') d['01'] += t.total;
        else if(t.tipe === 'BELI') d['04'] += t.total;

        const curData = currencies.find(c => c.code === t.valuta);
        if(curData) {
            const midRate = (curData.buy + curData.sell) / 2;
            if(t.tipe === 'JUAL') margin += (t.rate - midRate) * t.nominal;
            else margin += (midRate - t.rate) * t.nominal;
        }
    });

    expenses.forEach(e => {
        let prefixCat = e.kategori ? e.kategori.substring(0,2) : '';
        if(d[prefixCat] !== undefined) d[prefixCat] += e.nominal;
        else {
            if(e.tipe === 'PENDAPATAN') d['23'] += e.nominal;
            else d['15'] += e.nominal;
        }
    });

    const assets = getAssets();
    let dep = 0;
    assets.forEach(a => {
        const pd = new Date(a.purchaseDate);
        const reportTarget = new Date(y, parseInt(m)-1, 1);
        if(pd <= reportTarget) {
            const lifeMonths = a.usefulLifeYears * 12;
            const monthlyDep = a.purchasePrice / lifeMonths;
            let msElapsed = (reportTarget.getFullYear() - pd.getFullYear()) * 12 + (reportTarget.getMonth() - pd.getMonth());
            if(msElapsed <= lifeMonths && msElapsed >= 0) dep += monthlyDep;
        }
    });
    d['13'] += dep;

    d['21'] += margin > 0 ? margin : 0;
    d['22'] += margin < 0 ? Math.abs(margin) : 0;

    let opKotorUkaTc = d['01'] + d['02'] + d['05'] - d['03'] - d['04'];
    let opKotor = opKotorUkaTc + d['06'];
    let totalBebanOp = d['07']+d['08']+d['09']+d['10']+d['11']+d['12']+d['13']+d['14']+d['15'];
    let opBersih = opKotor - totalBebanOp;
    let totalPendapatanNonOp = d['16']+d['19']+d['21']+d['23'];
    let totalBebanNonOp = d['17']+d['18']+d['20']+d['22']+d['24'];
    let labaSebelumPajak = opBersih + totalPendapatanNonOp - totalBebanNonOp;
    let labaBersih = labaSebelumPajak - d['25'];

    let html = `
        <tr><td style="padding-left: 15px;">01-Penjualan UKA</td><td class="text-end">${formatIdr(d['01'])}</td></tr>
        <tr><td style="padding-left: 15px;">02-Pencairan TC</td><td class="text-end">${formatIdr(d['02'])}</td></tr>
        <tr><td style="padding-left: 15px;">03-Saldo Awal UKA dan TC</td><td class="text-end">${formatIdr(d['03'])}</td></tr>
        <tr><td style="padding-left: 15px;">04-Pembelian UKA dan TC</td><td class="text-end">${formatIdr(d['04'])}</td></tr>
        <tr><td style="padding-left: 15px;">05-Saldo Akhir UKA dan TC</td><td class="text-end">${formatIdr(d['05'])}</td></tr>
        <tr style="background: rgba(16, 185, 129, 0.05);"><td><strong class="text-green">Pendapatan/(Rugi) Operasional Kotor UKA-TC</strong></td><td class="text-end font-weight-bold text-green">${formatIdr(opKotorUkaTc)}</td></tr>
        
        <tr><td style="padding-left: 15px;">06-Pendapatan Pengiriman Uang</td><td class="text-end">${formatIdr(d['06'])}</td></tr>
        <tr style="background: rgba(16, 185, 129, 0.05);"><td><strong class="text-green">Pendapatan/(Rugi) Operasional Kotor</strong></td><td class="text-end font-weight-bold text-green">${formatIdr(opKotor)}</td></tr>

        <tr><td style="padding-left: 15px;">07-Beban Gaji, Upah dan Tunjangan</td><td class="text-end text-red">${formatIdr(d['07'])}</td></tr>
        <tr><td style="padding-left: 15px;">08-Beban Sewa</td><td class="text-end text-red">${formatIdr(d['08'])}</td></tr>
        <tr><td style="padding-left: 15px;">09-Beban Iklan dan promosi</td><td class="text-end text-red">${formatIdr(d['09'])}</td></tr>
        <tr><td style="padding-left: 15px;">10-Beban Air, Listrik dan Telepon</td><td class="text-end text-red">${formatIdr(d['10'])}</td></tr>
        <tr><td style="padding-left: 15px;">11-Beban Transportasi dan perjalanan</td><td class="text-end text-red">${formatIdr(d['11'])}</td></tr>
        <tr><td style="padding-left: 15px;">12-Beban Pemeliharaan kendaraan</td><td class="text-end text-red">${formatIdr(d['12'])}</td></tr>
        <tr><td style="padding-left: 15px;">13-Penyusutan Aset Tetap</td><td class="text-end text-red">${formatIdr(d['13'])}</td></tr>
        <tr><td style="padding-left: 15px;">14-Beban Asuransi</td><td class="text-end text-red">${formatIdr(d['14'])}</td></tr>
        <tr><td style="padding-left: 15px;">15-Beban Lain-Lain (Operasional)</td><td class="text-end text-red">${formatIdr(d['15'])}</td></tr>
        <tr style="background: rgba(239, 68, 68, 0.05);"><td><strong class="text-red">Total Beban Operasional</strong></td><td class="text-end font-weight-bold text-red">${formatIdr(totalBebanOp)}</td></tr>
        <tr style="border-top: 1px solid #e2e8f0;"><td><strong>Pendapatan/(Rugi) Operasional Bersih</strong></td><td class="text-end font-weight-bold">${formatIdr(opBersih)}</td></tr>

        <tr><td style="padding-left: 15px;">16-Pendapatan Bunga bank</td><td class="text-end">${formatIdr(d['16'])}</td></tr>
        <tr><td style="padding-left: 15px;">17-Beban Administrasi Bank</td><td class="text-end text-red">${formatIdr(d['17'])}</td></tr>
        <tr><td style="padding-left: 15px;">18-Beban Bunga Pinjaman</td><td class="text-end text-red">${formatIdr(d['18'])}</td></tr>
        <tr><td style="padding-left: 15px;">19-Laba Penjualan Aset Tetap</td><td class="text-end">${formatIdr(d['19'])}</td></tr>
        <tr><td style="padding-left: 15px;">20-Rugi Penjualan Aset Tetap</td><td class="text-end text-red">${formatIdr(d['20'])}</td></tr>
        <tr><td style="padding-left: 15px;">21-Laba Selisih Kurs</td><td class="text-end">${formatIdr(d['21'])}</td></tr>
        <tr><td style="padding-left: 15px;">22-Rugi Selisih Kurs</td><td class="text-end text-red">${formatIdr(d['22'])}</td></tr>
        <tr><td style="padding-left: 15px;">23-Pendapatan Lain-Lain</td><td class="text-end">${formatIdr(d['23'])}</td></tr>
        <tr><td style="padding-left: 15px;">24-Beban Lain-Lain (Non Operasional)</td><td class="text-end text-red">${formatIdr(d['24'])}</td></tr>
        <tr style="border-top: 1px solid #e2e8f0;"><td><strong>Laba/(Rugi) Sebelum Pajak Penghasilan</strong></td><td class="text-end font-weight-bold">${formatIdr(labaSebelumPajak)}</td></tr>

        <tr><td style="padding-left: 15px;">25-Pajak Penghasilan</td><td class="text-end text-red">${formatIdr(d['25'])}</td></tr>
        
        <tr style="background: #1e293b; color: #fff; font-size: 1.1rem;">
            <td><strong>LABA (RUGI) BERSIH</strong></td>
            <td class="text-end font-weight-bold ${labaBersih < 0 ? 'text-red' : 'text-green'}">${formatIdr(labaBersih)}</td>
        </tr>
    `;
    
    document.querySelector('#plTable tbody').innerHTML = html;
};

// --- NERACA & EKUITAS ---
window.loadNeraca = function() {
    const dateStr = document.getElementById('bsDate').value;
    if(!dateStr) return;
    
    const targetDate = new Date(dateStr);
    targetDate.setHours(23,59,59,999);
    
    let kas = getCash();
    let bank = getBankBCA() + getBankMandiri();
    let valasInventoryValue = 0;
    
    const currencies = getCurrencies();
    currencies.forEach(c => { valasInventoryValue += (c.stock * c.buy); });
    
    const assets = getAssets();
    let fixedAssets = 0;
    let accDep = 0;
    
    assets.forEach(a => {
        const pd = new Date(a.purchaseDate);
        if(pd <= targetDate) {
            fixedAssets += a.purchasePrice;
            let msElapsed = (targetDate.getFullYear() - pd.getFullYear()) * 12 + (targetDate.getMonth() - pd.getMonth());
            if(targetDate.getDate() < pd.getDate()) msElapsed--;
            if(msElapsed < 0) msElapsed = 0;
            const lifeMonths = a.usefulLifeYears * 12;
            let dep = (a.purchasePrice / lifeMonths) * msElapsed;
            if(dep > a.purchasePrice) dep = a.purchasePrice;
            accDep += dep; // Accumulation is positive here, will display negative
        }
    });

    let bookValue = fixedAssets - accDep;    
    let adjsMap = {};
    const adjKeys = ['105','106','107','108','111','201','202','203','204','205','206'];
    adjKeys.forEach(k => adjsMap[k] = 0);

    let prive = 0;
    const adjs = getAdjustments().filter(a => new Date(a.timestamp) <= targetDate);

    adjs.forEach(a => {
        const val = a.tipe === 'PENAMBAHAN' ? a.nominal : -a.nominal;
        let prefix = a.kategori ? a.kategori.substring(0,3) : '';
        if(a.kategori === '05-Pembagian Dividen(-/-)') { prive += val; }
        else if(adjsMap[prefix] !== undefined) { adjsMap[prefix] += val; }
        else { adjsMap['205'] += val; } // default fallback Kewajiban Lain-lain
    });
    
    let modalAwal = adjsMap['206'];
    let hutangLain = adjsMap['201'] + adjsMap['202'] + adjsMap['203'] + adjsMap['204'] + adjsMap['205'];

    let aktivaLancarAdjustments = adjsMap['105'] + adjsMap['106'] + adjsMap['107'] + adjsMap['108'];
    let totalLancar = kas + bank + valasInventoryValue + aktivaLancarAdjustments;
    let totalAktiva = totalLancar + bookValue + adjsMap['111'];
    
    // Compute YTD earnings
    const yStr = targetDate.getFullYear().toString();
    const trxs = getTransactions().filter(t => t.timestamp.startsWith(yStr));
    const exps = getExpenses().filter(e => e.timestamp.startsWith(yStr));
    
    let ytdMargin = 0;
    trxs.forEach(t => {
        const c = currencies.find(x => x.code === t.valuta);
        if(c) {
            const m = (c.buy + c.sell)/2;
            if(t.tipe === 'JUAL') ytdMargin += (t.rate - m) * t.nominal;
            else ytdMargin += (m - t.rate) * t.nominal;
        }
    });
    let ytdExp = 0; 
    let ytdIncLain = 0;
    exps.forEach(e => {
        if(e.tipe === 'PENGELUARAN') ytdExp += e.nominal;
        else ytdIncLain += e.nominal;
    });

    let currentYearEarnings = ytdMargin + ytdIncLain - ytdExp; 
    let retainedEarnings = totalAktiva - hutangLain - modalAwal - prive - currentYearEarnings; 
    let totalEkuitas = modalAwal + prive + retainedEarnings + currentYearEarnings;
    
    let bsRetainedVal = retainedEarnings + modalAwal;

    // Save to DOM for Ekuitas & Export
    if(document.getElementById('bsTotalLiabilities')) document.getElementById('bsTotalLiabilities').textContent = hutangLain;
    if(document.getElementById('bsRetainedEarnings')) document.getElementById('bsRetainedEarnings').textContent = bsRetainedVal;
    if(document.getElementById('bsCurrentYearEarnings')) document.getElementById('bsCurrentYearEarnings').textContent = currentYearEarnings;
    if(document.getElementById('bsPrive')) document.getElementById('bsPrive').textContent = prive;
    if(document.getElementById('bsTotalEquity')) document.getElementById('bsTotalEquity').textContent = totalEkuitas;
    
    const subTotalKasBankRupiah = kas + bank;
    const subTotalKasBankUka = valasInventoryValue; 
    const totalAsetTetapBersih = fixedAssets - accDep;

    const htmlL = `
        <tr><td colspan="2" class="text-muted font-weight-bold">ASET LANCAR</td></tr>
        <tr><td>101-Kas dalam Rupiah</td><td class="text-end" id="bsKas">${formatIdr(kas)}</td></tr>
        <tr><td>102-Bank dalam Rupiah</td><td class="text-end" id="bsBank">${formatIdr(bank)}</td></tr>
        <tr style="border-top:1px dashed #cbd5e1; background: rgba(255, 255, 255, 0.05);"><td style="padding-left: 20px;">Subtotal Kas & Bank Rp</td><td class="text-end font-weight-bold" id="bs_sub_rupiah">${formatIdr(subTotalKasBankRupiah)}</td></tr>
        <tr><td>103-Kas dalam UKA</td><td class="text-end" id="bsValas">${formatIdr(valasInventoryValue)}</td></tr>
        <tr><td>104-Bank dalam UKA</td><td class="text-end" id="bs104">0</td></tr>
        <tr style="border-top:1px dashed #cbd5e1; background: rgba(255, 255, 255, 0.05);"><td style="padding-left: 20px;">Subtotal Kas & Bank UKA</td><td class="text-end font-weight-bold">${formatIdr(subTotalKasBankUka)}</td></tr>
        <tr><td>105-Piutang TC</td><td class="text-end" id="bs105">${formatIdr(adjsMap['105'])}</td></tr>
        <tr><td>106-Piutang Lain-Lain</td><td class="text-end" id="bs106">${formatIdr(adjsMap['106'])}</td></tr>
        <tr><td>107-Sewa dibayar Di Muka</td><td class="text-end" id="bs107">${formatIdr(adjsMap['107'])}</td></tr>
        <tr><td>108-Asuransi dibayar Di Muka</td><td class="text-end" id="bs108">${formatIdr(adjsMap['108'])}</td></tr>
        
        <tr><td colspan="2" class="text-muted font-weight-bold mt-2">ASET TETAP</td></tr>
        <tr><td>109-Aset Tetap-harga perolehan</td><td class="text-end" id="bsFixedAssets">${formatIdr(fixedAssets)}</td></tr>
        <tr><td>110-Akumulasi Penyusutan Aset Tetap (-/-)</td><td class="text-end text-danger" id="bsAccumulatedDepreciation">${accDep ? `(${formatIdr(accDep)})` : '0'}</td></tr>
        <tr style="border-top:1px dashed #cbd5e1; background: rgba(255, 255, 255, 0.05);"><td style="padding-left: 20px;">Total Aset Tetap Bersih</td><td class="text-end font-weight-bold">${formatIdr(totalAsetTetapBersih)}</td></tr>
        
        <tr><td>111-Aset Lain-lain</td><td class="text-end" id="bs111">${formatIdr(adjsMap['111'])}</td></tr>
        
        <tr style="background: rgba(0, 0, 0, 0.2); border-top:2px solid #94a3b8; font-size:1.1rem; margin-top:10px;">
            <td><strong>JUMLAH ASET</strong></td><td class="text-end font-weight-bold" id="bsTotalAssets">${formatIdr(totalAktiva)}</td>
        </tr>
    `;

    const htmlR = `
        <tr><td colspan="2" class="text-muted font-weight-bold">KEWAJIBAN</td></tr>
        <tr><td>201-Pinjaman dalam Rupiah</td><td class="text-end" id="bs201">${formatIdr(adjsMap['201'])}</td></tr>
        <tr><td>202-Pinjaman dalam UKA</td><td class="text-end" id="bs202">${formatIdr(adjsMap['202'])}</td></tr>
        <tr><td>203-Hutang Sewa</td><td class="text-end" id="bs203">${formatIdr(adjsMap['203'])}</td></tr>
        <tr><td>204-Kewajiban Pengiriman Uang</td><td class="text-end" id="bs204">${formatIdr(adjsMap['204'])}</td></tr>
        <tr><td>205-Kewajiban Lain-lain</td><td class="text-end" id="bs205">${formatIdr(adjsMap['205'])}</td></tr>
        <tr style="border-top:1px dashed #cbd5e1; background: rgba(255, 255, 255, 0.05);"><td style="padding-left: 20px;">Total Kewajiban</td><td class="text-end font-weight-bold" id="bsTotalLiabilitiesUI">${formatIdr(hutangLain)}</td></tr>
        
        <tr><td colspan="2" class="text-muted font-weight-bold mt-2">EKUITAS</td></tr>
        <tr><td>206-Modal Disetor</td><td class="text-end">${formatIdr(bsRetainedVal)}</td></tr>
        <tr><td>207-Laba Ditahan</td><td class="text-end">${formatIdr(currentYearEarnings)}</td></tr>
        <tr><td>290-Akumulasi Rugi (-/-)</td><td class="text-end ${prive ? 'text-danger' : ''}">${prive ? `(${formatIdr(Math.abs(prive))})` : '0'}</td></tr>
        <tr style="border-top:1px dashed #cbd5e1; background: rgba(255, 255, 255, 0.05);"><td style="padding-left: 20px;">Total Ekuitas</td><td class="text-end font-weight-bold">${formatIdr(totalEkuitas)}</td></tr>
        
        <tr style="background: rgba(0, 0, 0, 0.2); border-top:2px solid #94a3b8; font-size:1.1rem; margin-top:10px;">
            <td><strong>JUMLAH KEWAJIBAN & EKUITAS</strong></td><td class="text-end font-weight-bold" id="bsTotalPasiva">${formatIdr(hutangLain + totalEkuitas)}</td>
        </tr>
    `;

    if(document.getElementById('neracaTableL')) document.getElementById('neracaTableL').innerHTML = htmlL;
    if(document.getElementById('neracaTableR')) document.getElementById('neracaTableR').innerHTML = htmlR;
};

// ==============================
// DATABASE BACKUP & RESTORE
// ==============================
window.backupDatabase = function() {
    let backupData = {};
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if (key && key.startsWith('mc_')) {
            backupData[key] = localStorage.getItem(key);
        }
    }
    
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    let downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    let dateStr = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `MC_ALMARA_Backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    if(typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Backup Berhasil',
            text: 'Database telah diunduh sebagai file JSON.',
            background: '#1e293b', color: '#f8fafc',
            confirmButtonColor: '#3B82F6'
        });
    } else {
        alert('Backup Berhasil! File JSON telah diunduh.');
    }
};

window.triggerRestore = function() {
    document.getElementById('restoreFileInput').click();
};

window.restoreDatabase = function(event) {
    let file = event.target.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let backupData = JSON.parse(e.target.result);
            let confirmMsg = 'Apakah Anda yakin ingin mengganti (restore) database dengan file ini?<br><br><small style="color:#ef4444;">PERINGATAN: Proses ini tidak dapat dibatalkan dan akan MENIMPA SEMUA DATA SAAT INI.</small>';
            
            if(typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Konfirmasi Restore',
                    html: confirmMsg,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#3b82f6',
                    confirmButtonText: '<i class="fa-solid fa-triangle-exclamation"></i> Ya, Timpa & Restore Sekarang!',
                    cancelButtonText: 'Batal',
                    background: '#1e293b', color: '#f8fafc'
                }).then((result) => {
                    if (result.isConfirmed) {
                        processRestoreData(backupData);
                    } else {
                        event.target.value = ''; // Reset file input
                    }
                });
            } else {
                if(confirm('Apakah Anda yakin ingin mengganti / restore database secara permanen?')) {
                    processRestoreData(backupData);
                } else {
                    event.target.value = '';
                }
            }
        } catch (err) {
            alert('File backup JSON tidak valid atau rusak!');
            event.target.value = '';
        }
    };
    reader.readAsText(file);
};

function processRestoreData(backupData) {
    let restoredCount = 0;
    for (let key in backupData) {
        if (backupData.hasOwnProperty(key) && key.startsWith('mc_')) {
            localStorage.setItem(key, backupData[key]);
            restoredCount++;
        }
    }
    
    if (restoredCount > 0) {
        if(typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Restore Berhasil',
                text: 'Database telah dikembalikan dari file backup. Sistem akan dimuat ulang.',
                timer: 3000,
                showConfirmButton: false,
                background: '#1e293b', color: '#f8fafc'
            }).then(() => {
                location.reload();
            });
        } else {
            alert('Restore Berhasil! Sistem akan dimuat ulang.');
            location.reload(); // Reload untuk menerapkan changes
        }
    } else {
        alert('Gagal restore: Tidak ada data valid yang dipulihkan.');
    }
}

// ==============================
// DATABASE RESET
// ==============================
window.resetDatabase = function() {
    console.log("Proses reset dimulai...");
    let warn1 = confirm('PERINGATAN 1 DARI 3!\n\nApakah Anda yakin ingin me-reset seluruh SALDO NOMINAL (Kas, Bank, Stok Valas) dan menghapus DATA NASABAH beserta TRANSAKSI?\n\nTindakan ini SANGAT BERBAHAYA dan TIDAK BISA DIBATALKAN.');
    if (!warn1) { console.log("Reset dibatalkan di peringatan 1."); return; }

    let warn2 = confirm('PERINGATAN 2 DARI 3!\n\nSeluruh histori transaksi, mutasi, pengeluaran, dan data pelanggan akan HILANG SELAMANYA.\nData Master Valuta (Kode & Kurs) akan tetap dipertahankan.\n\nAnda benar-benar yakin melanjutkan?');
    if (!warn2) { console.log("Reset dibatalkan di peringatan 2."); return; }

    let warn3 = prompt('PERINGATAN TERAKHIR (3 DARI 3)!\n\nKetik "RESET" (huruf besar semua) untuk mengkonfirmasi penghapusan data secara permanen:');
    if (warn3 !== 'RESET') {
        console.log("Kata kunci salah atau batal.");
        alert('Ketik "RESET" tidak valid atau dibatalkan. Proses reset dihentikan.');
        return;
    }

    console.log("Mengeksekusi reset database...");

    // Reset balances
    localStorage.setItem('mc_cash', '0');
    localStorage.setItem('mc_bank_bca', '0');
    localStorage.setItem('mc_bank_mandiri', '0');
    
    // Reset currencies stock but keep settings
    let currencies = getCurrencies();
    currencies = currencies.map(c => {
        c.stock = 0;
        return c;
    });
    saveCurrencies(currencies);
    
    // Clear transactional data
    localStorage.setItem('mc_transactions', JSON.stringify([]));
    localStorage.setItem('mc_mutations', JSON.stringify([]));
    localStorage.setItem('mc_closings', JSON.stringify([]));
    localStorage.setItem('mc_customers', JSON.stringify([]));
    localStorage.setItem('mc_expenses', JSON.stringify([]));
    localStorage.setItem('mc_adjustments', JSON.stringify([]));
    localStorage.removeItem('mc_invoice_seq');
    
    alert('Database berhasil di-reset. Aplikasi akan dimuat ulang.');
    setTimeout(() => {
        window.location.reload();
    }, 2000);
};

// ==============================
// EXCEL EXPORT HELPERS (GLOBAL)
// ==============================
window.safeExportXLSX = async function(wb, filename) {
    if (window.showSaveFilePicker) {
        try {
            const ext = filename.split('.').pop() || 'xls';
            const mimeType = (ext === 'xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel';
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'Excel Document',
                    accept: {[mimeType]: ['.' + ext]}
                }]
            });
            const writable = await handle.createWritable();
            const wbout = XLSX.write(wb, { bookType: ext, type: 'array' });
            const blob = new Blob([wbout], { type: mimeType });
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (e) {
            console.log("Save picker cancelled or failed:", e);
            if (e.name === 'AbortError') return false; 
        }
    }
    const ext2 = filename.split('.').pop() || 'xls';
    XLSX.writeFile(wb, filename, { bookType: ext2 });
    return true;
};

window.exportTableToExcel = async function(tableId, filename = 'Laporan') {
    let table = document.getElementById(tableId);
    if(!table) {
        alert("Tabel tidak ditemukan!");
        return;
    }
    
    const clone = table.cloneNode(true);
    clone.querySelectorAll('.currency-flag').forEach(el => el.remove());

    // Validate if data empty
    if(clone.rows.length <= 1 || (clone.rows.length === 2 && clone.rows[1].innerText.toLowerCase().includes('tidak ada'))) {
        alert("Data tabel kosong, ekspor tidak dilanjutkan.");
        return;
    }

    try {
        const aoa = [];
        for(let i = 0; i < clone.rows.length; i++) {
            const row = clone.rows[i];
            const rowData = [];
            for(let j = 0; j < row.cells.length; j++) {
                let val = row.cells[j].innerText.trim();
                
                // Parse Currency
                if(/^[-]?Rp\s*[-.\d]+$/.test(val)) {
                    val = parseFloat(val.replace(/Rp/g, '').replace(/\./g, '').replace(/\s/g, ''));
                } 
                // Parse Dates (Indonesian to English to Date Obj)
                else if (/^\d{1,2}\s+[a-zA-Z]{3,4}\s+\d{4}/.test(val)) {
                    const idMonths = {'Jan':'Jan', 'Feb':'Feb', 'Mar':'Mar', 'Apr':'Apr', 'Mei':'May', 'Jun':'Jun', 'Jul':'Jul', 'Agt':'Aug', 'Sep':'Sep', 'Okt':'Oct', 'Nov':'Nov', 'Des':'Des'};
                    let dtStr = val;
                    Object.keys(idMonths).forEach(k => { dtStr = dtStr.replace(k, idMonths[k]); });
                    const d = new Date(dtStr);
                    if(!isNaN(d.getTime())) val = d;
                } 
                // Parse Standard Number (skip phone numbers or very long IDs)
                else if (/^-?\d+$/.test(val) && !val.startsWith('0') && val.length < 12) {
                    val = parseFloat(val);
                }
                
                rowData.push(val);
            }
            aoa.push(rowData);
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa, {cellDates: true});
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan");
        const ok = await window.safeExportXLSX(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
        if(ok) alert(`Data ${filename} berhasil diekspor ke Excel!`);
    } catch (error) {
        console.error("Export Error:", error);
        alert("Gagal mengekspor data ke Excel.");
    }
};

window.exportNeracaExcel = async function() {
    const dateStr = document.getElementById('bsDate').value;
    if(!dateStr) {
        alert("Mohon kalkulasi Neraca per tanggal terlebih dahulu.");
        return;
    }

    const parseVal = (id) => {
        const el = document.getElementById(id);
        if(!el) return 0;
        let txt = el.textContent.replace(/\./g, '').replace(/,/g, '').replace(/Rp\s?/g, '').trim();
        if(txt.startsWith('(') && txt.endsWith(')')) {
            txt = '-' + txt.slice(1, -1);
        }
        return parseFloat(txt) || 0;
    };

    const bsKas = parseVal('bsKas');
    const bsBank = parseVal('bsBank');
    const bsValas = parseVal('bsValas');
    const bs104 = parseVal('bs104');
    const bs105 = parseVal('bs105');
    const bs106 = parseVal('bs106');
    const bs107 = parseVal('bs107');
    const bs108 = parseVal('bs108');
    const bs111 = parseVal('bs111');
    
    const bsFixed = parseVal('bsFixedAssets');
    const bsDep = parseVal('bsAccumulatedDepreciation');
    const bsTotalAssets = parseVal('bsTotalAssets');

    const bs201 = parseVal('bs201');
    const bs202 = parseVal('bs202');
    const bs203 = parseVal('bs203');
    const bs204 = parseVal('bs204');
    const bs205 = parseVal('bs205');
    
    const bsTotalLiab = parseVal('bsTotalLiabilities');
    const bsRetained = parseVal('bsRetainedEarnings');
    const bsCurrentYear = parseVal('bsCurrentYearEarnings');
    const bsPrive = parseVal('bsPrive');
    const bsTotalPasiva = parseVal('bsTotalPasiva');

    const subTotalKasBankRupiah = bsKas + bsBank;
    const subTotalKasBankUka = bsValas + bs104; 
    const totalAsetTetapBersih = bsFixed + bsDep; // Dep is negative

    // Build array matching NERACA.xlsx BI template
    const aoaNeraca = [
        ["PT ALMARA PUTRA VALASINDO", "", "", "", "", ""],
        ["LAPORAN NERACA", "", "", "", "", ""],
        [`Periode Posisi: ${dateStr}`, "", "", "", "", ""],
        ["Aktiva", "", "", "Pasiva", "", ""],
        ["101-Kas dalam Rupiah", bsKas, "", "201-Pinjaman dalam Rupiah", bs201, ""],
        ["102-Bank dalam Rupiah", bsBank, "", "202-Pinjaman dalam UKA", bs202, ""],
        ["", "", subTotalKasBankRupiah, "", "", 0],
        ["", "", "", "", "", ""],
        ["103-Kas dalam UKA", bsValas, "", "203-Hutang Sewa", bs203, 0],
        ["104-Bank dalam UKA", bs104, "", "204-Kewajiban Pengiriman Uang", bs204, 0],
        ["", "", subTotalKasBankUka, "205-Kewajiban Lain-lain", bs205, bsTotalLiab],
        ["", "", "", "", "", bsTotalLiab],
        ["105-Piutang TC", "", bs105, "", "", ""],
        ["106-Piutang Lain-Lain", "", bs106, "206-Modal Disetor", "", bsRetained],
        ["107-Sewa dibayar Di Muka", "", bs107, "207-Laba Ditahan", "", bsCurrentYear],
        ["108-Asuransi dibayar Di Muka", "", bs108, "290-Akumulasi Rugi (-/-)", "", bsPrive],
        ["", "", "", "", "", bsRetained + bsCurrentYear + bsPrive],
        ["109-Aset Tetap-harga perolehan", bsFixed, "", "", "", ""],
        ["110-Akumulasi Penyusutan Aset Tetap (-/-)", bsDep, "", "", "", ""],
        ["", "", totalAsetTetapBersih, "", "", ""],
        ["", "", "", "", "", ""],
        ["111-Aset Lain-lain", "", bs111, "", "", ""],
        ["", "", "", "", "", ""],
        ["Jumlah Aset", "", bsTotalAssets, "Jumlah Kewajiban dan Ekuitas", "", bsTotalPasiva],
        ["", "", "", "", "", ""],
        ["Neraca Seimbang", "", "", "", "", ""]
    ];

    try {
        const wsNeraca = XLSX.utils.aoa_to_sheet(aoaNeraca);
        wsNeraca['!cols'] = [{wch: 40}, {wch: 15}, {wch: 15}, {wch: 35}, {wch: 15}, {wch: 15}];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsNeraca, "Neraca");
        const ok = await window.safeExportXLSX(wb, `Laporan_BI_Neraca_${dateStr}.xlsx`);
        if(ok) alert("Export Neraca BI berhasil!");
    } catch(err) {
        console.error(err);
        alert("Gagal melakukan export Neraca BI.");
    }
};

window.exportLabaRugiExcel = async function() {
    const m = document.getElementById('plMonth').value;
    const y = document.getElementById('plYear').value;
    if(!m || !y) {
        alert("Pilih bulan dan tahun Laba Rugi terlebih dahulu.");
        return;
    }
    const prefix = `${y}-${m}`;
    const trxs = getTransactions().filter(t => t.timestamp.startsWith(prefix));
    const expenses = getExpenses().filter(e => e.timestamp.startsWith(prefix));
    const currencies = getCurrencies();
    
    let d = {};
    for(let i=1; i<=25; i++) {
        let key = i.toString().padStart(2, '0');
        d[key] = 0;
    }

    // --- Retrospective Calculation for Saldo Awal (03) & Saldo Akhir (05) ---
    const allTrxs = getTransactions();
    const startStr = `${prefix}-01`;
    const endStr = `${prefix}-31`; // Approx end of month for string comparison

    let totalRpAwal = 0;
    let totalRpAkhir = 0;

    currencies.forEach(c => {
        let currentStock = c.stock || 0;
        let kursValuasi = c.buy || 0;
        
        let sumJualAfter = 0, sumBeliAfter = 0;
        let sumJualPeriod = 0, sumBeliPeriod = 0;

        allTrxs.forEach(t => {
            if(t.valuta !== c.code) return;
            let tDate = t.timestamp.split('T')[0];
            let nominal = parseFloat(t.nominal) || 0;
            
            if(tDate > endStr) {
                if(t.tipe === 'JUAL') sumJualAfter += nominal;
                if(t.tipe === 'BELI') sumBeliAfter += nominal;
            } else if(tDate >= startStr && tDate <= endStr) {
                if(t.tipe === 'JUAL') sumJualPeriod += nominal;
                if(t.tipe === 'BELI') sumBeliPeriod += nominal;
            }
        });

        let stokAkhir = currentStock + sumJualAfter - sumBeliAfter;
        let stokAwal = stokAkhir + sumJualPeriod - sumBeliPeriod;

        totalRpAkhir += (stokAkhir * kursValuasi);
        totalRpAwal += (stokAwal * kursValuasi);
    });

    d['03'] = totalRpAwal;
    d['05'] = totalRpAkhir;
    // ----------------------------------------------------------------------

    let penjualanUka = 0;
    let pembelianUka = 0;
    let margin = 0; // Selisih Kurs
    trxs.forEach(t => {
        if(t.tipe === 'JUAL') penjualanUka += t.total;
        else if(t.tipe === 'BELI') pembelianUka += t.total;

        const curData = currencies.find(c => c.code === t.valuta);
        if(curData) {
            const midRate = (curData.buy + curData.sell) / 2;
            if(t.tipe === 'JUAL') margin += (t.rate - midRate) * t.nominal;
            else margin += (midRate - t.rate) * t.nominal;
        }
    });

    // Populate standard BI categories from expenses.kategori
    expenses.forEach(e => {
        let prefixCat = e.kategori ? e.kategori.substring(0,2) : '';
        if(d[prefixCat] !== undefined) {
            d[prefixCat] += e.nominal;
        } else {
            if(e.tipe === 'PENDAPATAN') d['23'] += e.nominal; // 23-Pendapatan Lain-Lain
            else d['15'] += e.nominal; // 15-Beban Lain-Lain (Operasional)
        }
    });

    // Depreciation
    const assets = getAssets();
    let dep = 0;
    assets.forEach(a => {
        const pd = new Date(a.purchaseDate);
        const reportTarget = new Date(y, parseInt(m)-1, 1);
        if(pd <= reportTarget) {
            const lifeMonths = a.usefulLifeYears * 12;
            const monthlyDep = a.purchasePrice / lifeMonths;
            let msElapsed = (reportTarget.getFullYear() - pd.getFullYear()) * 12 + (reportTarget.getMonth() - pd.getMonth());
            if(msElapsed <= lifeMonths && msElapsed >= 0) {
                dep += monthlyDep;
            }
        }
    });
    d['13'] += dep;

    d['01'] = penjualanUka;
    d['04'] = pembelianUka;
    // Assume margin is reflected under Laba Selisih Kurs if we don't have accurate Saldo Awal/Akhir
    d['21'] += margin > 0 ? margin : 0;
    d['22'] += margin < 0 ? Math.abs(margin) : 0;

    let opKotorUkaTc = d['01'] + d['02'] + d['05'] - d['03'] - d['04'];
    let opKotor = opKotorUkaTc + d['06'];
    
    let totalBebanOp = d['07']+d['08']+d['09']+d['10']+d['11']+d['12']+d['13']+d['14']+d['15'];
    let opBersih = opKotor - totalBebanOp;

    let totalPendapatanNonOp = d['16']+d['19']+d['21']+d['23'];
    let totalBebanNonOp = d['17']+d['18']+d['20']+d['22']+d['24'];
    let labaSebelumPajak = opBersih + totalPendapatanNonOp - totalBebanNonOp;

    let labaBersih = labaSebelumPajak - d['25'];

    const aoaPL = [
        ["PT ALMARA PUTRA VALASINDO", "", "", ""],
        ["LAPORAN RUGI-LABA", "", "", ""],
        [`Periode: ${m}-${y}`, "", "", ""],
        ["Akun", "", "", ""],
        ["01-Penjualan UKA", "", d['01'], ""],
        ["02-Pencairan TC", "", d['02'], ""],
        ["", "", d['01']+d['02'], ""],
        ["", "", "", ""],
        ["03-Saldo Awal UKA dan TC", d['03'], "", ""],
        ["04-Pembelian UKA dan TC", d['04'], "", ""],
        ["05-Saldo Akhir UKA dan TC", d['05'], "", ""],
        ["", "", opKotorUkaTc, ""],
        ["Pendapatan/(Rugi) Operasional Kotor UKA-TC", "", opKotorUkaTc, ""],
        ["06-Pendapatan Pengiriman Uang", "", d['06'], ""],
        ["Pendapatan/(Rugi) Operasional Kotor", "", opKotor, ""],
        ["", "", "", ""],
        ["07-Beban Gaji, Upah dan Tunjangan", d['07'], "", ""],
        ["08-Beban Sewa", d['08'], "", ""],
        ["09-Beban Iklan dan promosi", d['09'], "", ""],
        ["10-Beban Air, Listrik dan Telepon", d['10'], "", ""],
        ["11-Beban Transportasi dan perjalanan", d['11'], "", ""],
        ["12-Beban Pemeliharaan kendaraan", d['12'], "", ""],
        ["13-Penyusutan Aset Tetap", d['13'], "", ""],
        ["14-Beban Asuransi", d['14'], "", ""],
        ["15-Beban Lain-Lain (Operasional)", d['15'], "", ""],
        ["", "", totalBebanOp, ""],
        ["Pendapatan/(Rugi) Operasional Bersih", "", opBersih, ""],
        ["", "", "", ""],
        ["16-Pendapatan Bunga bank", d['16'], "", ""],
        ["17-Beban Administrasi Bank", d['17'], "", ""],
        ["18-Beban Bunga Pinjaman", d['18'], "", ""],
        ["19-Laba Penjualan Aset Tetap", d['19'], "", ""],
        ["20-Rugi Penjualan Aset Tetap", d['20'], "", ""],
        ["21-Laba Selisih Kurs", d['21'], "", ""],
        ["22-Rugi Selisih Kurs", d['22'], "", ""],
        ["23-Pendapatan Lain-Lain", d['23'], "", ""],
        ["24-Beban Lain-Lain (Non Operasional)", d['24'], "", ""],
        ["", "", totalPendapatanNonOp - totalBebanNonOp, ""],
        ["Laba/(Rugi) Sebelum Pajak Penghasilan", "", labaSebelumPajak, ""],
        ["", "", "", ""],
        ["25-Pajak Penghasilan", "", d['25'], ""],
        ["", "", "", ""],
        ["Laba/(Rugi) Bersih", "", labaBersih, ""]
    ];

    try {
        const ws = XLSX.utils.aoa_to_sheet(aoaPL);
        ws['!cols'] = [{wch: 45}, {wch: 15}, {wch: 15}, {wch: 15}];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rugi Laba");
        const ok = await window.safeExportXLSX(wb, `Laporan_BI_RugiLaba_${prefix}.xlsx`);
        if(ok) alert("Laporan Rugi-Laba BI berhasil diekspor ke Excel!");
    } catch(err) {
        console.error(err);
        alert("Gagal melakukan export Rugi-Laba BI.");
    }
};

window.loadEkuitasUi = function() {
    const today = new Date().toISOString().split('T')[0];
    if(!document.getElementById('eqDate')) return;
    if(!document.getElementById('eqDate').value) document.getElementById('eqDate').value = today;
    
    document.getElementById('bsDate').value = document.getElementById('eqDate').value;
    loadNeraca();

    setTimeout(() => {
        const safeParse = (id) => {
            const el = document.getElementById(id);
            if(!el) return 0;
            let txt = el.textContent.replace(/\./g, '').replace(/,/g, '').replace(/Rp\s?/g, '').trim();
            if(txt.startsWith('(') && txt.endsWith(')')) txt = '-' + txt.slice(1, -1);
            return parseFloat(txt) || 0;
        };

        const bsRetained = safeParse('bsRetainedEarnings');
        const bsCurrentYear = safeParse('bsCurrentYearEarnings');
        const bsPrive = safeParse('bsPrive');

        // To map exactly to Ekuitas (06/07): find Modal entries for THIS YEAR
        const yStr = document.getElementById('eqDate').value.substring(0,4);
        const adjs = getAdjustments().filter(a => a.timestamp.substring(0,4) === yStr && new Date(a.timestamp) <= new Date(document.getElementById('eqDate').value + 'T23:59:59'));
        let modalTambahYTD = 0;
        let modalKurangYTD = 0;
        adjs.forEach(a => {
            if(a.kategori === '206-Modal Disetor') {
                if(a.tipe === 'PENAMBAHAN') modalTambahYTD += a.nominal;
                else modalKurangYTD += a.nominal;
            }
        });

        // The Saldo Awal formula = bsRetained - modalTambahYTD + modalKurangYTD (since bsRetained includes ALL modal)
        const saldoAwal = bsRetained - modalTambahYTD + modalKurangYTD;

        const eq01 = saldoAwal > 0 ? saldoAwal : 0;
        const eq02 = saldoAwal < 0 ? Math.abs(saldoAwal) : 0;
        const eq03 = bsCurrentYear > 0 ? bsCurrentYear : 0;
        const eq04 = bsCurrentYear < 0 ? Math.abs(bsCurrentYear) : 0;
        const eq05 = Math.abs(bsPrive);

        if(document.getElementById('ui_e_01')) document.getElementById('ui_e_01').textContent = formatIdr(eq01);
        if(document.getElementById('ui_e_02')) document.getElementById('ui_e_02').textContent = eq02 ? `(${formatIdr(eq02)})` : '0';
        if(document.getElementById('ui_e_03')) document.getElementById('ui_e_03').textContent = formatIdr(eq03);
        if(document.getElementById('ui_e_04')) document.getElementById('ui_e_04').textContent = eq04 ? `(${formatIdr(eq04)})` : '0';
        if(document.getElementById('ui_e_05')) document.getElementById('ui_e_05').textContent = eq05 ? `(${formatIdr(eq05)})` : '0';
        if(document.getElementById('ui_e_06')) document.getElementById('ui_e_06').textContent = formatIdr(modalTambahYTD);
        if(document.getElementById('ui_e_07')) document.getElementById('ui_e_07').textContent = modalKurangYTD ? `(${formatIdr(modalKurangYTD)})` : '0';
        
        let totalEkuitas = eq01 - eq02 + eq03 - eq04 - eq05 + modalTambahYTD - modalKurangYTD;
        if(document.getElementById('ui_e_total')) document.getElementById('ui_e_total').textContent = formatIdr(totalEkuitas);
    }, 100);
};

window.exportEkuitasExcel = async function() {
    const dateStr = document.getElementById('bsDate').value;
    if(!dateStr) {
        alert("Mohon kalkulasi Neraca/Ekuitas per tanggal terlebih dahulu.");
        return;
    }
    
    const safeParse = (id) => {
        const el = document.getElementById(id);
        if(!el) return 0;
        let txt = el.textContent.replace(/\./g, '').replace(/,/g, '').replace(/Rp\s?/g, '').trim();
        if(txt.startsWith('(') && txt.endsWith(')')) txt = '-' + txt.slice(1, -1);
        return parseFloat(txt) || 0;
    };
    
    const bsRetained = safeParse('bsRetainedEarnings');
    const bsCurrentYear = safeParse('bsCurrentYearEarnings');
    const bsPrive = safeParse('bsPrive');

    const yStr = document.getElementById('eqDate').value.substring(0,4);
    const adjs = getAdjustments().filter(a => a.timestamp.substring(0,4) === yStr && new Date(a.timestamp) <= new Date(document.getElementById('eqDate').value + 'T23:59:59'));
    let modalTambahYTD = 0;
    let modalKurangYTD = 0;
    adjs.forEach(a => {
        if(a.kategori === '206-Modal Disetor') {
            if(a.tipe === 'PENAMBAHAN') modalTambahYTD += a.nominal;
            else modalKurangYTD += a.nominal;
        }
    });

    const saldoAwal = bsRetained - modalTambahYTD + modalKurangYTD;

    const eq01 = saldoAwal > 0 ? saldoAwal : 0;
    const eq02 = saldoAwal < 0 ? Math.abs(saldoAwal) : 0;
    const eq03 = bsCurrentYear > 0 ? bsCurrentYear : 0;
    const eq04 = bsCurrentYear < 0 ? Math.abs(bsCurrentYear) : 0;
    const eq05 = Math.abs(bsPrive);

    const aoaEq = [
        ["PT ALMARA PUTRA VALASINDO", "", "", ""],
        ["LAPORAN EKUITAS", "", "", ""],
        [`Periode Posisi: ${dateStr}`, "", "", ""],
        ["Keterangan", "Modal Disetor", "Laba Ditahan/Akumulasi Rugi", "Jumlah"],
        ["01-Saldo Positif", eq01, 0, eq01],
        ["02-Saldo Negatif", "", eq02, ""],
        ["03-Laba periode berjalan (net)", "", eq03, eq03],
        ["04-Rugi periode berjalan (-/-)", "", eq04, ""],
        ["05-Pembagian Dividen(-/-)", "", eq05, -eq05],
        ["06-Menambah ekuitas (net)", modalTambahYTD, 0, modalTambahYTD],
        ["07-Mengurangi ekuitas (-/-)", modalKurangYTD, 0, -modalKurangYTD],
        ["", eq01 + modalTambahYTD - modalKurangYTD, eq03 - eq05, eq01 - eq02 + eq03 - eq04 - eq05 + modalTambahYTD - modalKurangYTD]
    ];

    try {
        const ws = XLSX.utils.aoa_to_sheet(aoaEq);
        ws['!cols'] = [{wch: 35}, {wch: 20}, {wch: 30}, {wch: 20}];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ekuitas");
        const ok = await window.safeExportXLSX(wb, `Laporan_BI_Ekuitas_${dateStr}.xlsx`);
        if(ok) alert("Laporan Ekuitas BI berhasil diekspor ke Excel!");
    } catch(err) {
        console.error(err);
        alert("Gagal melakukan export Ekuitas BI.");
    }
};

window.exportCustomersCsv = async function() {
    const customers = getCustomers();
    if (customers.length === 0) {
        alert("Data Nasabah kosong, tidak ada yang diekspor.");
        return;
    }
    const aoa = [
        ["ID Nasabah", "Tipe", "Nama Lengkap", "Tempat Lahir", "Tanggal Lahir", "Alamat", "Jenis Kelamin", "Warga Negara", "Pekerjaan", "Jenis ID", "No Identitas", "ID Lain", "No HP", "No Rekening", "No CIF", "NPWP", "Local ID"]
    ];
    customers.forEach(c => {
        const knLabel = c.kn === '1' ? 'Perorangan' : (c.kn === '2' ? 'Corporate' : '-');
        const isKtp = c.no_ktp && c.no_ktp !== '-';
        const jenisId = isKtp ? 'KTP' : 'Lainnya';
        const idUtama = isKtp ? c.no_ktp : (c.selain_ktp || '-');
        aoa.push([
            c.id_nasabah, knLabel, c.nama || '-', c.tempat_lahir || '-',
            c.tanggal_lahir || '-', c.alamat || '-', c.jenis_kelamin || '-', c.warga_negara || '-', c.pekerjaan || '-',
            jenisId, idUtama, c.selain_ktp || '-', c.no_hp || '-', c.no_rekening || '-',
            c.no_cif || '-', c.npwp || '-', c.local_id || '-'
        ]);
    });
    try {
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Nasabah");
        const ok = await window.safeExportXLSX(wb, `Data_Nasabah_${new Date().toISOString().slice(0,10)}.xlsx`);
        if(ok) alert("Data Nasabah berhasil diekspor ke Excel!");
    } catch(err) {
        console.error(err);
        alert("Gagal melakukan export Data Nasabah.");
    }
};

window.printCustomersPdf = function() {
    alert("Fitur Cetak PDF Data Nasabah sedang dalam pengembangan.");
};

// ==============================
// BACKWARDS COMPATIBILITY FIX
// Attached listener for old cached index.html
// ==============================
setTimeout(() => {
    const pInput = document.getElementById('modalCustPhoto');
    if(pInput) {
        pInput.addEventListener('change', function() {
            if(window.handleCustomerPhoto) {
                window.handleCustomerPhoto(this);
            }
        });
    }
    
    // Load DTOTT list locally if available
    if(document.getElementById('dtottTableBody')) {
        window.loadDtottTable();
    }
}, 500);

// ==============================
// DTOTT MANAGEMENT
// ==============================
window.getDtottList = function() {
    return window.safeArrayGet('mc_investors');
};

window.saveDtottList = function(list) {
    localStorage.setItem('mc_dtott', JSON.stringify(list));
};

window.loadDtottTable = function() {
    const list = window.getDtottList();
    const thead = document.getElementById('dtottTableHead');
    const tbody = document.getElementById('dtottTableBody');
    if(!tbody || !thead) return;
    
    if(!list || list.length <= 1) {
        thead.innerHTML = `<tr><th style="width: 50px;">No</th><th>Nama Lengkap (Terblokir)</th></tr>`;
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Belum ada data DTOTT yang diunggah.</td></tr>';
        return;
    }

    const headers = list[0];
    let theadHtml = '<tr><th style="width: 50px;">No</th>';
    headers.forEach(h => {
        theadHtml += `<th>${h || '-'}</th>`;
    });
    theadHtml += '</tr>';
    thead.innerHTML = theadHtml;

    let tbodyHtml = '';
    for(let i = 1; i < list.length; i++) {
        const row = list[i];
        tbodyHtml += `<tr><td class="text-center">${i}</td>`;
        for(let j = 0; j < headers.length; j++) {
            tbodyHtml += `<td>${row[j] || '-'}</td>`;
        }
        tbodyHtml += '</tr>';
    }
    tbody.innerHTML = tbodyHtml;
};

window.uploadDtottFile = function() {
    const fileInput = document.getElementById('dtottFileInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            // Baca seluruh row / kolom yang ada
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
            
            // Filter row kosong
            const validData = jsonData.filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== ''));
            
            if(validData.length > 1) {
                window.saveDtottList(validData);
                window.loadDtottTable();
                alert(`Berhasil mengunggah daftar tabel DTOTT.`);
                fileInput.value = ''; // reset form
            } else {
                alert("File yang diunggah kosong atau tidak sesuai standar.");
            }
        } catch(error) {
            console.error("Error parsing DTOTT file:", error);
            alert("Terjadi kesalahan saat membaca file. Pastikan formatnya benar (Excel/CSV).");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.clearDtottList = function() {
    if(confirm("Apakah Anda yakin ingin mengosongkan daftar DTOTT?")) {
        window.saveDtottList([]);
        window.loadDtottTable();
    }
};

window.filterDtottTable = function() {
    const input = document.getElementById('dtottSearchInput');
    const filter = input ? input.value.toLowerCase() : '';
    const tbody = document.getElementById('dtottTableBody');
    if (!tbody) return;

    const trs = tbody.getElementsByTagName('tr');
    for (let i = 0; i < trs.length; i++) {
        const tds = trs[i].getElementsByTagName('td');
        if (tds.length <= 1) continue; // Skip the 'No Data' placeholder row

        let match = false;
        for (let j = 0; j < tds.length; j++) {
            if (tds[j].textContent.toLowerCase().indexOf(filter) > -1) {
                match = true;
                break;
            }
        }
        
        if (match) {
            trs[i].style.display = '';
        } else {
            trs[i].style.display = 'none';
        }
    }
};

window.uploadBatchRates = function() {
    const fileInput = document.getElementById('batchRateInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Expected format (or similar):
            // Row 0: [Kode, Beli, Jual] <- Header
            // Row 1: ['USD', 15000, 15500]
            let jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            jsonData = jsonData.map(row => {
                if(row && row.length === 1 && typeof row[0] === 'string') {
                    if(row[0].includes(';')) return row[0].split(';');
                    if(row[0].includes(',')) return row[0].split(',');
                }
                return row;
            });
            
            const currencies = getCurrencies();
            let updatedCount = 0;

            let cleanNum = (val) => {
                if(typeof val === 'number') return val;
                if(!val) return 0;
                let s = String(val).replace(/Rp|\s+/gi, '').trim();
                
                if(s.includes('.') && s.includes(',')) {
                    const lastDot = s.lastIndexOf('.');
                    const lastComma = s.lastIndexOf(',');
                    if(lastComma > lastDot) {
                        s = s.replace(/\./g, '').replace(/,/g, '.'); 
                    } else {
                        s = s.replace(/,/g, ''); 
                    }
                } else if(s.includes(',')) {
                    const parts = s.split(',');
                    if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/,/g, ''); 
                    } else if(parts.length > 2) {
                        s = s.replace(/,/g, '');
                    } else {
                        s = s.replace(/,/g, '.'); 
                    }
                } else if (s.includes('.')) {
                    const parts = s.split('.');
                    if(parts.length > 2) {
                        s = s.replace(/\./g, ''); 
                    } else if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/\./g, ''); 
                    }
                }
                
                return parseFloat(s) || 0;
            };

            jsonData.forEach((row, index) => {
                if(!row || row.length < 2) return;
                
                // Smart auto-detect code column
                let codeIdx = -1;
                let actualCode = '';
                for(let i=0; i<row.length; i++) {
                    const rawVal = String(row[i] || '').trim().toUpperCase();
                    if (!rawVal) continue;
                    let matches = rawVal.match(/[A-Z]{3}/g);
                    let parsedVal = matches ? matches[matches.length - 1] : rawVal;
                    
                    if(parsedVal && currencies.find(c => c.code.toUpperCase() === parsedVal)) {
                        codeIdx = i; 
                        actualCode = parsedVal;
                        break;
                    }
                }
                
                if(codeIdx === -1) return; // No recognized currency code in this row
                
                const code = actualCode;
                
                // Get all valid numbers to the right of the currency code
                let numbers = [];
                for(let i = codeIdx + 1; i < row.length; i++) {
                    let num = cleanNum(row[i]);
                    // Ignore very small numbers which might be margin artifacts if they copied the HTML table natively
                    if(num > 100) {
                        numbers.push(num);
                    } else if (num > 0 && num <= 100 && numbers.length === 0) {
                        // Exception for certain currencies that might genuinely be less than 100? None practically, but just in case.
                        numbers.push(num); 
                    }
                }

                if(code && numbers.length >= 2) {
                    let baseBuy = numbers[0];
                    // Find the next number that represents the sell rate.
                    // If they copied from HTML, array is [15000, 15000, 15500, 15500] (Buy, SistemBuy, Sell, SistemSell)
                    let baseSell = numbers.find(n => n !== baseBuy) || numbers[1];

                    // Safely ensure Buy is <= Sell to avoid inverted mistakes
                    const finalBuy = Math.min(baseBuy, baseSell);
                    const finalSell = Math.max(baseBuy, baseSell);
                    
                    const idx = currencies.findIndex(c => c.code.toUpperCase() === code);
                    if(idx !== -1) {
                        const mb = currencies[idx].margin_buy || 0;
                        const ms = currencies[idx].margin_sell || 0;
                        currencies[idx].base_buy = finalBuy;
                        currencies[idx].base_sell = finalSell;
                        currencies[idx].buy = finalBuy + mb;
                        currencies[idx].sell = finalSell + ms;
                        updatedCount++;
                    }
                }
            });

            if(updatedCount > 0) {
                saveCurrencies(currencies);
                loadCurrencyTable();
                alert(`Berhasil memperbarui kurs untuk ${updatedCount} mata uang.`);
                fileInput.value = ''; // Reset form
            } else {
                alert("Tidak ada kurs yang diperbarui. Pastikan format kolom: Kode | Beli | Jual dan kode mata uang sudah terdaftar.");
            }
        } catch(error) {
            console.error("Error parsing Rate file:", error);
            alert("Terjadi kesalahan membaca file. Pastikan formatnya benar (Excel/CSV).");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.uploadHistoricalTransactions = function() {
    const fileInput = document.getElementById('historicalTrxInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // read as formatted strings because Excel export includes Rp and dot formatting
            let jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            jsonData = jsonData.map(row => {
                if(row && row.length === 1 && typeof row[0] === 'string') {
                    if(row[0].includes(';')) return row[0].split(';');
                    if(row[0].includes(',')) return row[0].split(',');
                }
                return row;
            });
            
            let txs = getTransactions();
            let currencies = getCurrencies();
            let addCount = 0;
            let totalCashAccumulated = 0;
            let totalBankAccumulated = 0;
            
            // Detect column mapping based on headers (assuming Row 0)
            let header = jsonData[0] || [];
            let cMap = { tgl: 0, inv: 1, tipe: 2, nasabah: 3, valuta: 4, nominal: 5, rate: 6, total: 7 };
            
            header.forEach((c, idx) => {
                let l = String(c).toLowerCase().trim();
                if(l.includes('waktu') || l.includes('tanggal')) cMap.tgl = idx;
                if(l.includes('invoice')) cMap.inv = idx;
                if(l === 'tipe') cMap.tipe = idx;
                if(l.includes('nasabah')) cMap.nasabah = idx;
                if(l.includes('valuta') && !l.includes('nominal')) cMap.valuta = idx;
                if(l.includes('nominal')) cMap.nominal = idx;
                if(l.includes('kurs') || l.includes('rate')) cMap.rate = idx;
                if(l.includes('total') || l.includes('idr')) cMap.total = idx;
            });
            
            let cleanNum = (val) => {
                if(typeof val === 'number') return val;
                if(!val) return 0;
                let s = String(val).replace(/Rp|\s+/gi, '').trim();
                
                if(s.includes('.') && s.includes(',')) {
                    const lastDot = s.lastIndexOf('.');
                    const lastComma = s.lastIndexOf(',');
                    if(lastComma > lastDot) {
                        s = s.replace(/\./g, '').replace(/,/g, '.'); 
                    } else {
                        s = s.replace(/,/g, ''); 
                    }
                } else if(s.includes(',')) {
                    const parts = s.split(',');
                    if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/,/g, ''); 
                    } else if(parts.length > 2) {
                        s = s.replace(/,/g, '');
                    } else {
                        s = s.replace(/,/g, '.'); 
                    }
                } else if (s.includes('.')) {
                    const parts = s.split('.');
                    if(parts.length > 2) {
                        s = s.replace(/\./g, ''); 
                    } else if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/\./g, ''); 
                    }
                }
                
                return parseFloat(s) || 0;
            };
            
            // Predict the next available INV- number from existing database
            let maxInvNumber = 0;
            txs.forEach(t => {
                if(t.id && t.id.startsWith("INV-")) {
                    let num = parseInt(t.id.replace("INV-", ""), 10);
                    if(!isNaN(num) && num > maxInvNumber) maxInvNumber = num;
                }
            });
            let autoInvCounter = maxInvNumber + 1;
            
            // Track state for automatic invoice bundling
            let lastAutoInv = null;
            let lastAutoTipe = null;
            let lastAutoNasabah = null;
            let lastAutoDate = null;
            
            jsonData.forEach((row, i) => {
                // Skip header or empty
                if(i === 0 || !row || row.length < 5) return; 
                if(String(row[cMap.tgl]).includes('Tanggal/Waktu') || String(row[cMap.inv]).includes('Invoice')) return; 
                
                const rawTanggal = row[cMap.tgl];
                let inv = String(row[cMap.inv] || '').trim();
                const tipe = String(row[cMap.tipe]).trim().toUpperCase();
                let customerId = String(row[cMap.nasabah]).trim();
                
                // AUTO INVOICE INJECTION: If invoice is blank or '-', bind them!
                if(!inv || inv === '-' || inv.toLowerCase() === 'undefined') {
                    if(tipe === lastAutoTipe && customerId === lastAutoNasabah && rawTanggal === lastAutoDate) {
                        inv = lastAutoInv; // Bundle with previous
                    } else {
                        inv = 'INV-' + autoInvCounter.toString().padStart(4, '0');
                        lastAutoInv = inv;
                        lastAutoTipe = tipe;
                        lastAutoNasabah = customerId;
                        lastAutoDate = rawTanggal;
                        autoInvCounter++;
                    }
                }
                
                // Valuta could be "PH PHP" if exported natively due to flag image inner text
                let rawValuta = String(row[cMap.valuta]).trim().toUpperCase();
                let valutaMatches = rawValuta.match(/[A-Z]{3}/g);
                const valuta = valutaMatches ? valutaMatches[valutaMatches.length - 1] : rawValuta; 
                
                // Prevent invalid parsing (Invoice check removed since it auto-generates now)
                if(!tipe || !valuta || valuta.length !== 3) return;
                
                const nominal = cleanNum(row[cMap.nominal]);
                const rate = cleanNum(row[cMap.rate]);
                let total = cleanNum(row[cMap.total]);
                if (!total || total < 1) total = nominal * rate;
                
                if(customerId.toLowerCase().includes('umum') || customerId === '-') {
                    customerId = '-';
                }
                
                // Strict DD/MM/YYYY check first to prevent US format hijacking
                let dt = null;
                let pts = String(rawTanggal).split(/[-/ ]/);
                if(pts.length >= 3 && pts[0].length <= 2 && !isNaN(pts[0]) && !isNaN(pts[1])) {
                    // strictly enforce DD/MM/YYYY
                    dt = new Date(`${pts[2]}-${pts[1]}-${pts[0]}`);
                } else {
                    dt = new Date(rawTanggal);
                }
                
                if(isNaN(dt?.getTime())) dt = new Date(); // fallback if unrecognized format
                
                let paymentMethod = 'CASH';
                if(row[8] && String(row[8]).toUpperCase().includes('TRANSFER')) {
                    paymentMethod = 'TRANSFER';
                }
                
                let opValuta = valuta;
                let opTipe = tipe;
                
                // USER REQUEST: Completely bypass duplicate checks so they can upload massive 
                // pre-sorted files without false positives skipping their data.
                let existingTx = null; 
                
                if(existingTx) {
                    existingTx.timestamp = dt.toISOString();
                    existingTx.customerId = customerId;
                    existingTx.tipe = opTipe;
                    existingTx.valuta = opValuta;
                    existingTx.nominal = nominal;
                    existingTx.total = total;
                    existingTx.rate = rate;
                    existingTx.paymentMethod = paymentMethod;
                    updatedCount++; // Track as update
                } else {
                    const newTx = {
                        id: inv,
                        timestamp: dt.toISOString(),
                        customerId: customerId,
                        tipe: opTipe,
                        valuta: opValuta,
                        nominal: nominal,
                        total: total,
                        rate: rate,
                        paymentMethod: paymentMethod
                    };
                    txs.push(newTx);
                    addCount++;
                }
                
                // 1. Adjust Physical Multi-Currency stocks
                const cIdx = currencies.findIndex(c => c.code === opValuta);
                if(cIdx !== -1) {
                    if(opTipe === 'BELI') {
                        currencies[cIdx].stock = (currencies[cIdx].stock || 0) + nominal;
                    } else if (opTipe === 'JUAL') {
                        currencies[cIdx].stock = (currencies[cIdx].stock || 0) - nominal;
                    }
                }
                
                // 2. Adjust Cash Flow. BELI removes IDR cash. JUAL adds IDR cash.
                if(opTipe === 'BELI') {
                    if(paymentMethod === 'TRANSFER') totalBankAccumulated -= total;
                    else totalCashAccumulated -= total;
                } else if(opTipe === 'JUAL') {
                    if(paymentMethod === 'TRANSFER') totalBankAccumulated += total;
                    else totalCashAccumulated += total;
                }
            });
            
            if(addCount > 0) {
                // Sort transactions by date descending so newer is first
                txs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                saveTransactions(txs);
                saveCurrencies(currencies);
                
                let currentCash = parseFloat(localStorage.getItem('mc_cash')) || 0;
                currentCash += totalCashAccumulated;
                localStorage.setItem('mc_cash', currentCash.toString());
                
                let currentBank = parseFloat(localStorage.getItem('mc_bank')) || 0;
                currentBank += totalBankAccumulated;
                localStorage.setItem('mc_bank', currentBank.toString());
                
                if(typeof loadReportsTable === 'function') loadReportsTable();
                if(typeof loadDashboard === 'function') loadDashboard();
                
                alert(`Berhasil mengimpor ${addCount} transaksi. Saldo Kas Brankas & Stok Valuta telah disesuaikan otomatis.`);
                fileInput.value = '';
            } else {
                alert("Tidak ada transaksi baru yang diunggah. Pastikan format tabel cocok dengan hasil Export Excel dan No. Invoice belum ter-record sebelumnya.");
            }
            
        } catch(error) {
            console.error("Error parsing Historical Trans file:", error);
            alert("Terjadi kesalahan membaca file. Pastikan Anda mengunggah format hasil Export Excel (.xlsx).");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.uploadHistoricalMutations = function() {
    const fileInput = document.getElementById('historicalMutationInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            let mutations = window.safeArrayGet('mc_mutations');
            let addCount = 0;
            
            jsonData.forEach((row, i) => {
                if(i === 0 || row.includes('ID Mutasi') || row.includes('Waktu')) return; 
                if(!row || row.length < 6) return;
                
                const rawWaktu = row[0];
                const idMutasi = String(row[1]).trim();
                const tipe = String(row[2]).trim().toUpperCase();
                const bank = String(row[3]).trim();
                const ket = String(row[4]).trim();
                
                if(!idMutasi || idMutasi === 'undefined') return;
                if(mutations.find(m => m.id === idMutasi)) return; // prevent duplicate
                
                const cleanNum = (str) => {
                    if(typeof str === 'number') return str;
                    if(!str) return 0;
                    let val = String(str).replace(/Rp/gi, '').trim(); 
                    val = val.replace(/\./g, ''); 
                    val = val.replace(/,/g, '.'); 
                    return parseFloat(val) || 0;
                };
                
                const nominal = cleanNum(row[5]);
                let dt = new Date(rawWaktu);
                if(isNaN(dt.getTime())) dt = new Date();
                
                mutations.push({
                    id: idMutasi,
                    timestamp: dt.toISOString(),
                    type: tipe,
                    bank: bank,
                    amount: nominal,
                    description: ket
                });
                addCount++;
            });
            
            if(addCount > 0) {
                mutations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                localStorage.setItem('mc_mutations', JSON.stringify(mutations));
                if(typeof loadMutationTable === 'function') loadMutationTable();
                alert(`Berhasil mengimpor ${addCount} daftar mutasi bank.`);
                fileInput.value = '';
            } else {
                alert("Tidak ada mutasi baru yang diunggah. Pastikan format tabel cocok dan ID belum terdaftar.");
            }
        } catch(error) {
            console.error(error);
            alert("Gagal membaca file mutasi. Pastikan format export benar.");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.uploadHistoricalClosings = function() {
    const fileInput = document.getElementById('historicalClosingInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            let closings = window.safeArrayGet('mc_closing_history');
            let addCount = 0;
            
            jsonData.forEach((row, i) => {
                if(i === 0 || row.includes('ID Referensi') || row.includes('Waktu Closing')) return; 
                if(!row || row.length < 5) return;
                
                const rawWaktu = row[0];
                const idRef = String(row[1]).trim();
                
                if(!idRef || idRef === 'undefined') return;
                if(closings.find(c => c.id === idRef)) return;
                
                const cleanNum = (str) => {
                    if(typeof str === 'number') return str;
                    if(!str) return 0;
                    let val = String(str).replace(/Rp/gi, '').trim(); 
                    val = val.replace(/\./g, ''); 
                    val = val.replace(/,/g, '.'); 
                    return parseFloat(val) || 0;
                };
                
                const kasSistem = cleanNum(row[2]);
                const kasFisik = cleanNum(row[3]);
                const selisih = cleanNum(row[4]);
                const ket = row[5] ? String(row[5]) : '-';
                const kasir = row[6] ? String(row[6]) : '-';
                
                let dt = new Date(rawWaktu);
                if(isNaN(dt.getTime())) dt = new Date();
                
                closings.push({
                    id: idRef,
                    timestamp: dt.toISOString(),
                    sistem: kasSistem,
                    fisik: kasFisik,
                    selisih: selisih,
                    note: ket,
                    user: kasir
                });
                addCount++;
            });
            
            if(addCount > 0) {
                closings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                localStorage.setItem('mc_closing_history', JSON.stringify(closings));
                if(typeof loadClosingHistoryTable === 'function') loadClosingHistoryTable();
                alert(`Berhasil mengimpor ${addCount} riwayat closing.`);
                fileInput.value = '';
            } else {
                alert("Tidak ada riwayat closing baru yang diunggah.");
            }
        } catch(error) {
            console.error(error);
            alert("Gagal membaca file closing. Pastikan format export benar.");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.uploadCustomersExcel = function() {
    const fileInput = document.getElementById('customerExcelInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            let customers = getCustomers();
            let addCount = 0;
            
            jsonData.forEach((row, i) => {
                // Asumsi baris 0 adalah header ("ID Nasabah", "Tipe", "Nama Lengkap" dll.)
                if(i === 0 || row.includes('ID Nasabah') || row.includes('Tipe')) return; 
                if(!row || row.length < 3) return; 
                
                const idNasabah = row[0] !== undefined ? String(row[0]).trim() : null;
                const tipeLabel = row[1] !== undefined ? String(row[1]).trim() : '';
                const nama = row[2] !== undefined ? String(row[2]).trim() : null;
                const warga_negara = row[3] !== undefined ? String(row[3]).trim() : '-';
                const jenis_kelamin = row[4] !== undefined ? String(row[4]).trim() : '-';
                const tempat_lahir = row[5] !== undefined ? String(row[5]).trim() : '-';
                const tanggal_lahir = row[6] !== undefined ? String(row[6]).trim() : '-';
                const alamat = row[7] !== undefined ? String(row[7]).trim() : '-';
                const pekerjaan = row[8] !== undefined ? String(row[8]).trim() : '-';
                const no_hp = row[9] !== undefined ? String(row[9]).trim() : '-';
                const no_rekening = row[10] !== undefined ? String(row[10]).trim() : '';
                const no_ktp = row[11] !== undefined ? String(row[11]).trim() : '-';
                const selain_ktp = row[12] !== undefined ? String(row[12]).trim() : '-';
                const no_cif = row[13] !== undefined ? String(row[13]).trim() : '';
                const npwp = row[14] !== undefined ? String(row[14]).trim() : '';
                const local_id = row[15] !== undefined ? String(row[15]).trim() : '';

                if(!idNasabah || !nama || idNasabah === '-' || idNasabah === '') return;
                
                let typeKn = '1';
                if(tipeLabel.toLowerCase().includes('perusahaan') || tipeLabel.toLowerCase().includes('corporate') || tipeLabel === '2') {
                    typeKn = '2';
                }

                // Normalisasi ID Nasabah: Gunakan standar ALM-xxxxx
                let finalId = idNasabah;
                if(!idNasabah || idNasabah === '-' || isNaN(parseInt(idNasabah)) || idNasabah.includes('Perorangan') || idNasabah.includes('Corporate') || idNasabah.includes('tipe')) {
                    finalId = window.generateStandardId();
                    // Incremental dummy count to prevent same ID in same session upload
                    addCount++; 
                }

                const existingIdx = customers.findIndex(c => String(c.id_nasabah).trim() === String(finalId).trim());
                
                // Cek Tanggal Daftar dari Excel (Asumsi kolom 16 jika ada)
                let tglDaftarExcel = row[16] !== undefined ? String(row[16]).trim() : null;
                let finalTglDaftar = new Date().toISOString(); 
                
                if(tglDaftarExcel && tglDaftarExcel !== '-') {
                    const parsed = new Date(tglDaftarExcel);
                    if(!isNaN(parsed.getTime())) finalTglDaftar = parsed.toISOString();
                } else if(existingIdx !== -1 && customers[existingIdx].tgl_daftar) {
                    // Jika data sudah ada dan Excel tidak punya tanggal baru, gunakan tanggal lama
                    finalTglDaftar = customers[existingIdx].tgl_daftar;
                }

                const newC = {
                    id_nasabah: finalId,
                    kn: typeKn,
                    nama: nama,
                    tempat_lahir: tempat_lahir,
                    tanggal_lahir: tanggal_lahir,
                    alamat: alamat,
                    jenis_kelamin: jenis_kelamin,
                    warga_negara: warga_negara,
                    pekerjaan: pekerjaan,
                    no_ktp: no_ktp,
                    selain_ktp: selain_ktp,
                    no_hp: no_hp,
                    no_rekening: no_rekening,
                    no_cif: no_cif,
                    npwp: npwp,
                    local_id: local_id,
                    tgl_daftar: finalTglDaftar
                };
                
                if(existingIdx !== -1) {
                    customers[existingIdx] = {...customers[existingIdx], ...newC};
                    addCount++;
                } else {
                    customers.push(newC);
                    addCount++;
                }
            });
            
            if(addCount > 0) {
                saveCustomers(customers);
                if(typeof loadCustomersTable === 'function') loadCustomersTable();
                alert(`Berhasil mengimpor / memperbarui ${addCount} data nasabah.`);
                fileInput.value = '';
            } else {
                alert("Tidak ada data nasabah valid yang diunggah. Pastikan format tabel cocok.");
            }
            
        } catch(error) {
            console.error("Error parsing Customer Excel file:", error);
            alert("Terjadi kesalahan membaca file. Pastikan Anda mengunggah format hasil Export Excel (.xlsx).");
        }
    };
    reader.readAsArrayBuffer(file);
};

// ==============================
// AUTH & USER MANAGEMENT (RBAC)
// ==============================

function checkAuth() {
    const user = getCurrentUser();
    if (!user) {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        
        const sb = document.getElementById('sidebar');
        if(sb) sb.classList.remove('open');
    } else {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        
        // Update Sidebar User Info
        const userRoleDisplay = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        const userInfoSpan = document.querySelector('.user-info span');
        if(userInfoSpan) userInfoSpan.innerHTML = `${user.fullName}<br><small>${userRoleDisplay}</small>`;
        
        const userInfoIcon = document.querySelector('.user-info i.fa-user-circle');
        if(userInfoIcon && user.photo) {
            const imgEl = document.createElement('img');
            imgEl.src = user.photo;
            imgEl.style.width = '35px';
            imgEl.style.height = '35px';
            imgEl.style.objectFit = 'cover';
            imgEl.style.borderRadius = '50%';
            userInfoIcon.parentNode.replaceChild(imgEl, userInfoIcon);
        } else if (document.querySelector('.user-info img') && !user.photo) {
            const iEl = document.createElement('i');
            iEl.className = 'fa-solid fa-user-circle';
            const imgEl = document.querySelector('.user-info img');
            imgEl.parentNode.replaceChild(iEl, imgEl);
        }
        
        // Render users list if owner/admin
        if(document.getElementById('userTableBody')) loadUsersTable();
        
        // Apply RBAC
        applyRoleAccess(user.role);
    }
}

window.handleAuthLogin = function handleAuthLogin() {
    const un = document.getElementById('loginUsername').value.trim();
    const pw = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    if(!un || !pw) {
        errorEl.textContent = 'Username dan Password wajib diisi!';
        errorEl.style.display = 'block';
        return;
    }
    
    let users = [];
    try {
        users = getUsers();
        if(!Array.isArray(users)) users = [];
    } catch(e) {}
    
    // Perbaikan: Cegah error "Cannot read properties of null" jika elemen array u korup
    let user = users.find(u => u && u.username === un && u.password === pw);
    
    // Master Door Anti-Gagal & Auto Repair
    if (!user && un === 'owner' && pw === 'owner123') {
        user = { id: 'u1', username: 'owner', password: 'owner123', fullName: 'Master Owner', role: 'owner' };
        localStorage.setItem('mc_users', JSON.stringify([user]));
    }
    
    if(user) {
        try { setCurrentUser(user); } catch(e) { localStorage.setItem('mc_currentUser', JSON.stringify(user)); }
        errorEl.style.display = 'none';
        
        // Ubah text tombol 
        const btn = document.querySelector('button[onclick="handleAuthLogin()"]');
        if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
        
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            Swal.fire({
                icon: 'success',
                title: `Selamat Datang, ${user.fullName}`,
                timer: 1500,
                showConfirmButton: false,
                background: '#1e293b',
                color: '#f8fafc'
            });
        }
        
        setTimeout(() => {
            window.location.reload();
        }, 1200);
    } else {
        errorEl.textContent = 'Username atau password salah!';
        errorEl.style.display = 'block';
    }
}

window.handleLogout = function handleLogout() {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Yakin ingin keluar?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#3B82F6',
            confirmButtonText: 'Ya, Keluar!',
            cancelButtonText: 'Batal',
            background: '#1e293b',
            color: '#f8fafc'
        }).then((result) => {
            if (result.isConfirmed) {
                setCurrentUser(null);
                window.location.reload();
            }
        });
    } else {
        if(confirm("Yakin ingin keluar?")) {
            setCurrentUser(null);
            window.location.reload();
        }
    }
}

// Attach logout to User Info
setTimeout(() => {
    const userInfoWrapper = document.querySelector('.user-info');
    if(userInfoWrapper) {
        userInfoWrapper.style.cursor = 'pointer';
        userInfoWrapper.title = 'Klik untuk Logout';
        userInfoWrapper.addEventListener('click', handleLogout);
    }
}, 500);

function applyRoleAccess(role) {
    const allNavs = document.querySelectorAll('.nav-item');
    const menuKeuangan = document.querySelector('[onclick*="menuKeuangan"]');
    const menuBi = document.querySelector('[onclick*="menuBi"]');
    const userPanel = document.getElementById('userManagementPanel');
    
    let dangerZone = null;
    try { dangerZone = document.querySelector('button[onclick="resetDatabase()"]').parentElement; } catch(e){}

    // Reset visibility first
    allNavs.forEach(nav => {
        nav.style.display = 'flex';
    });
    if(menuKeuangan) menuKeuangan.style.display = 'flex';
    if(menuBi) menuBi.style.display = 'flex';
    if(userPanel) userPanel.style.display = 'block';
    if(dangerZone) dangerZone.style.display = 'block';

    if (role === 'kasir' || role === 'teller') {
        // Akses Menu: Dashboard, POS, Closing, Data Nasabah, Koin & Uang Lama, Mutasi, Riwayat, Laporan Harian, Pengaturan, Master Data
        const allowedTargets = [
            'dashboard-view', 'pos-view', 'closing-view', 'customers-view', 
            'old-money-view', 'mutation-view', 'reports-view', 'harian-view', 
            'settings-view', 'masterdata-view'
        ];
        allNavs.forEach(nav => {
            const target = nav.getAttribute('data-target');
            if (target && !allowedTargets.includes(target)) {
                nav.style.display = 'none';
            }
        });
        if(menuKeuangan) menuKeuangan.style.display = 'none';
        if(menuBi) menuBi.style.display = 'none';
        if(userPanel) userPanel.style.display = 'none';
        if(dangerZone) dangerZone.style.display = 'none';
        
        // Inject CSS to hide all Edit, Delete, Export, PDF buttons and Profit Card globally
        const style = document.createElement('style');
        style.innerHTML = `
            /* Sembunyikan Tombol Edit & Hapus di seluruh tabel */
            button[onclick*="editCustomer"], button[onclick*="deleteCustomer"],
            button[onclick*="openCustomerModal('"], 
            button[onclick*="editTransaction"], button[onclick*="voidTransaction"],
            button[onclick*="deleteHistoricalTrx"], button[onclick*="editHistoricalTrx"],
            button[onclick*="deleteMutation"], button[onclick*="openMutationModal"],
            button[onclick*="openAdjustmentModal"], button[onclick*="deleteAdjustment"],
            button[onclick*="deleteExpense"], button[onclick*="deleteMasterCurrency"],
            button[onclick*="openOldMoneySupplierModal('"], button[onclick*="deleteOldMoneySupplier"],
            button[onclick*="openOldMoneyItemModal('"], button[onclick*="deleteOldMoneyItem"],
            button[onclick*="deleteOldMoneyTrx"], button[onclick*="editOldMoneyTrx"],
            button[onclick*="removeMasterJob"], button[onclick*="removeMasterCitizen"] {
                display: none !important;
            }
            
            /* Sembunyikan tombol Export dan Cetak PDF (Kecuali Struk POS) */
            button[onclick*="export"], button[onclick*="exportTableToExcel"], 
            button[onclick*="window.print()"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        
        // Hide Profit Dashboard Card dan Profit Uang Lama
        setTimeout(() => {
            const dp = document.getElementById('dashProfit');
            if(dp && dp.closest('.stat-card')) {
                dp.closest('.stat-card').style.display = 'none';
            }
            const oldp = document.getElementById('oldMoneyTotalProfit');
            if(oldp && oldp.closest('.stat-card')) {
                oldp.closest('.stat-card').style.display = 'none';
            }
        }, 100);
        
    } else if (role === 'admin') {
        // Semua kecuali Ekuitas, Neraca, Laba Rugi, User Management, Danger Zone
        allNavs.forEach(nav => {
            const target = nav.getAttribute('data-target');
            if (target && ['laporan-ekuitas-view', 'laporan-neraca-view', 'laporan-labarugi-view'].includes(target)) {
                nav.style.display = 'none';
            }
        });
        if(userPanel) userPanel.style.display = 'none';
        if(dangerZone) dangerZone.style.display = 'none';
        
    } else if (role === 'owner') {
        // Owner akses semuanya
    }
}

// ==============================
// USER MANAGEMENT LOGIC
// ==============================

function loadUsersTable() {
    const users = getUsers();
    const currUser = getCurrentUser() || {role: 'kasir', id: ''};
    let html = '';
    
    users.forEach(u => {
        let actionBtns = '';
        if(currUser.role === 'owner') {
             actionBtns = `
                 <button class="btn btn-sm btn-primary" onclick="editUser('${u.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                 ${u.id !== currUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>` : ''}
             `;
        }
        
        let roleBadge = '';
        if(u.role === 'owner') roleBadge = '<span class="badge" style="position:static; background:#8B5CF6;">Owner</span>';
        else if(u.role === 'admin') roleBadge = '<span class="badge" style="position:static; background:#3B82F6;">Admin</span>';
        else if(u.role === 'kasir') roleBadge = '<span class="badge" style="position:static; background:#10B981;">Kasir</span>';
        else roleBadge = '<span class="badge" style="position:static; background:#F59E0B;">Teller</span>';

        let imgHtml = u.photo ? `<img src="${u.photo}" style="width:35px; height:35px; object-fit:cover; border-radius:50%; border:2px solid #334155;">` : `<i class="fa-solid fa-circle-user fa-2x text-muted"></i>`;

        html += `
            <tr>
                <td class="text-center">${imgHtml}</td>
                <td>${u.username}</td>
                <td>${u.fullName}</td>
                <td>${roleBadge}</td>
                <td class="text-center">${actionBtns}</td>
            </tr>
        `;
    });
    
    const target = document.getElementById('userTableBody');
    if(target) target.innerHTML = html;
}

function openUserModal() {
    document.getElementById('editUserId').value = '';
    document.getElementById('mUserUsername').value = '';
    document.getElementById('mUserFullName').value = '';
    document.getElementById('mUserPassword').value = '';
    document.getElementById('mUserRole').value = 'kasir';
    
    document.getElementById('mUserPhoto').value = '';
    document.getElementById('previewUserPhoto').innerHTML = '';
    window._tempUserPhoto = '';

    document.getElementById('userModalTitle').textContent = 'Tambah Pengguna Baru';
    document.getElementById('userModal').style.display = 'flex';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

function editUser(id) {
    const users = getUsers();
    const u = users.find(x => x.id === id);
    if(!u) return;
    
    document.getElementById('editUserId').value = u.id;
    document.getElementById('mUserUsername').value = u.username;
    document.getElementById('mUserFullName').value = u.fullName;
    document.getElementById('mUserPassword').value = ''; 
    document.getElementById('mUserRole').value = u.role;
    
    document.getElementById('mUserPhoto').value = '';
    window._tempUserPhoto = u.photo || '';
    if(u.photo) {
        document.getElementById('previewUserPhoto').innerHTML = `<img src="${u.photo}" style="max-height:100px; object-fit:cover; border-radius:5px;">`;
    } else {
        document.getElementById('previewUserPhoto').innerHTML = '';
    }

    document.getElementById('userModalTitle').textContent = 'Edit Pengguna';
    document.getElementById('userModal').style.display = 'flex';
}

window._tempUserPhoto = '';
window.handleUserPhoto = function(input) {
    if(input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e){
            window._tempUserPhoto = e.target.result;
            const preview = document.getElementById('previewUserPhoto');
            if(preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-height:100px; object-fit:cover; border-radius:5px;">`;
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

function saveUser() {
    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('mUserUsername').value.trim();
    const fullName = document.getElementById('mUserFullName').value.trim();
    const password = document.getElementById('mUserPassword').value;
    const role = document.getElementById('mUserRole').value;
    
    if(!username || !fullName) {
        alert("Username dan Nama Lengkap wajib diisi!");
        return;
    }
    
    let users = getUsers();
    
    if(id) {
        const index = users.findIndex(u => u.id === id);
        if(index > -1) {
            if(users.find(x => x.username === username && x.id !== id)) {
                alert("Username sudah digunakan, silakan pilih yang lain.");
                return;
            }
            users[index].username = username;
            users[index].fullName = fullName;
            users[index].role = role;
            if(window._tempUserPhoto) users[index].photo = window._tempUserPhoto;
            if(password) users[index].password = password; 
        }
    } else {
        if(!password) {
            alert("Password wajib diisi untuk pengguna baru!");
            return;
        }
        if(users.find(u => u.username === username)) {
            alert("Username sudah digunakan, silakan pilih yang lain.");
            return;
        }
        
        users.push({
            id: 'u_' + Date.now(),
            username,
            password,
            fullName,
            role,
            photo: window._tempUserPhoto
        });
    }
    
    saveUsers(users);
    loadUsersTable();
    closeUserModal();
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Data pengguna berhasil disimpan.',
            background: '#1e293b',
            color: '#f8fafc'
        });
    } else {
        alert("Data pengguna berhasil disimpan.");
    }
}

function deleteUser(id) {
    if(confirm("Apakah Anda yakin ingin menghapus pengguna ini?")) {
        let users = getUsers();
        users = users.filter(u => u.id !== id);
        saveUsers(users);
        loadUsersTable();
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Pengguna berhasil dihapus.',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            alert("Pengguna berhasil dihapus.");
        }
    }
}

// ==============================
// CORETAX REPORT LOGIC
// ==============================
function loadCoretaxReport() {
    const filterType = document.getElementById('coretaxFilterType').value;
    const filterStart = document.getElementById('coretaxStartDate').value;
    const filterEnd = document.getElementById('coretaxEndDate').value;

    let trxs = getTransactions();
    const customers = getCustomers();

    if (filterType) {
        trxs = trxs.filter(t => t.tipe === filterType);
    }
    
    if (filterStart) {
        trxs = trxs.filter(t => t.timestamp.split('T')[0] >= filterStart);
    }
    if (filterEnd) {
        trxs = trxs.filter(t => t.timestamp.split('T')[0] <= filterEnd);
    }
    
    // Sort descending by date
    trxs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const tbody = document.getElementById('coretaxTableBody');
    if (trxs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Tidak ada data untuk rentang waktu ini.</td></tr>';
        return;
    }

    let html = '';
    trxs.forEach(t => {
        let cust = customers.find(c => c.id_nasabah === t.id_nasabah);
        let nikNpwp = cust && cust.identitas && cust.identitas.trim() !== '' ? cust.identitas : '0000000000000000'; // Default CoreTax mock
        let namaLawan = cust ? cust.nama : 'Pelanggan Umum';
        let uraian = `${t.tipe} ${t.valuta} sejumlah ${t.nominal}`;
        let pajak = 0; // PPN Valas biasanya dibebaskan atau 0, setting default 0

        html += `
            <tr data-trx='${JSON.stringify({ 
                tanggal: window.formatDateToDMY(t.timestamp), 
                no_dokumen: t.id_transaksi, 
                nik_npwp: nikNpwp, 
                nama: namaLawan, 
                uraian: uraian, 
                dpp: t.total, 
                pajak: pajak 
            }).replace(/'/g, "&#39;")}'>
                <td>${window.formatDateToDMY(t.timestamp)}</td>
                <td>${t.id_transaksi}</td>
                <td>${nikNpwp}</td>
                <td>${namaLawan}</td>
                <td>${uraian}</td>
                <td style="text-align: right;">${formatIdr(t.total)}</td>
                <td style="text-align: right;">${formatIdr(pajak)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

async function exportCoretaxExcel() {
    const tbody = document.getElementById('coretaxTableBody');
    const rows = tbody.querySelectorAll('tr[data-trx]');
    
    if (rows.length === 0) {
        alert("Tidak ada data untuk diekspor ke CoreTax.");
        return;
    }

    let dataToExport = [];
    // Header standard CoreTax
    dataToExport.push([
        "Tanggal Dokumen", 
        "Nomor Dokumen", 
        "NPWP/NIK Lawan Transaksi", 
        "Nama Lawan Transaksi", 
        "Uraian Transaksi", 
        "DPP (IDR)", 
        "PPN / Pajak Keluar (IDR)"
    ]);

    rows.forEach(row => {
        const trxInfo = JSON.parse(row.getAttribute('data-trx').replace(/&#39;/g, "'"));
        dataToExport.push([
            trxInfo.tanggal,
            trxInfo.no_dokumen,
            String(trxInfo.nik_npwp),
            trxInfo.nama,
            trxInfo.uraian,
            trxInfo.dpp,
            trxInfo.pajak
        ]);
    });

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dataToExport);
        
        // Auto-sizing columns gently
        const colWidths = [
            { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }
        ];
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, "Laporan_CoreTax");
        
        let filename = "Template_CoreTax_Export_" + new Date().toISOString().split('T')[0] + ".xlsx";
        const ok = await window.safeExportXLSX(wb, filename);
        
        if (ok && typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success', 
                title: 'Export Berhasil', 
                text: 'Data siap diatur untuk upload ke sistem CoreTax.',
                background: '#1e293b',
                color: '#f8fafc'
            });
        }
    } catch (error) {
        console.error("Export Error:", error);
        alert("Terjadi kesalahan saat mengekspor file Excel. Pastikan library SheetJS termuat.");
    }
}

// ==============================
// SIPESAT REPORT LOGIC
// ==============================
window.loadLaporanSipesat = function() {
    const btn = document.getElementById('btnFilterSipesat');
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
        btn.disabled = true;
    }

    setTimeout(() => {
        const startStr = document.getElementById('sipesatStartDate').value;
        const endStr = document.getElementById('sipesatEndDate').value;

        let customers = getCustomers();

        if (startStr || endStr) {
            let filterStart = null;
            let filterEnd = null;
            
            if(startStr) {
                let fs = new Date(startStr);
                if(!isNaN(fs.getTime())) {
                    fs.setHours(0,0,0,0);
                    filterStart = fs.getTime();
                }
            }
            if(endStr) {
                let fe = new Date(endStr);
                if(!isNaN(fe.getTime())) {
                    fe.setHours(23,59,59,999);
                    filterEnd = fe.getTime();
                }
            }

            customers = customers.filter(c => {
                let dObj = null;
                let rawStr = c.tgl_daftar ? String(c.tgl_daftar).trim() : '';
                
                if(!rawStr || rawStr === '-') {
                    dObj = new Date('1970-01-01T00:00:00Z'); // Jauh di masa lalu agar tidak terambil filter
                } else {
                    // 1. Coba Native Parser (Bisa membaca "04 Nov 2026", "2026-11-04", dll)
                    dObj = new Date(rawStr);
                    
                    // 2. Beri Fallback untuk format DD-MM-YYYY jika Native Parser gagal (Invalid Date)
                    if (isNaN(dObj.getTime())) {
                        let parts = rawStr.split(/[-/]/);
                        if (parts.length >= 3 && parts[0].length <= 2) {
                            let m = parseInt(parts[1]);
                            if (!isNaN(m)) {
                                dObj = new Date(parts[2].substring(0,4), m - 1, parseInt(parts[0]), 12, 0, 0);
                            }
                        }
                    }
                }
                
                // JIKA TANGGAL MASIH TIDAK VALID: Tolak dari filter (jangan kembalikan true)
                if(isNaN(dObj.getTime())) return false; 

                let customerEpoch = dObj.getTime();
                let passStart = true;
                let passEnd = true;
                
                if(filterStart !== null) passStart = customerEpoch >= filterStart;
                if(filterEnd !== null) passEnd = customerEpoch <= filterEnd;
                
                return passStart && passEnd;
            });
        }

        const tbody = document.getElementById('sipesatTableBody');
        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted">Tidak ada data nasabah untuk filter rentang ini. Coba mundurkan "Dari Tanggal Input".</td></tr>';
        } else {
            let html = '';
            customers.forEach((c, index) => {
                const rawDate = c.tgl_daftar ? c.tgl_daftar : '-';
                let formattedInputDate = rawDate;
                if(rawDate !== '-') {
                    try {
                        let d = new Date(rawDate);
                        if(isNaN(d.getTime())) {
                            let parts = String(rawDate).trim().split(/[-/]/);
                            if (parts.length >= 3 && parts[0].length <= 2) {
                                let m = parseInt(parts[1]);
                                if (!isNaN(m)) d = new Date(parts[2].substring(0,4), m - 1, parseInt(parts[0]), 12, 0, 0);
                            }
                        }
                        if(!isNaN(d.getTime())) {
                            const mths = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
                            formattedInputDate = String(d.getDate()).padStart(2, '0') + ' ' + mths[d.getMonth()] + ' ' + d.getFullYear();
                        }
                    } catch(e){}
                }

                html += `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td class="text-center" style="white-space: nowrap;">${formattedInputDate}</td>
                        <td class="text-center"><strong>${c.id_nasabah || '-'}</strong></td>
                        <td class="text-center">${c.idpjk || '-'}</td>
                        <td class="text-center">${c.kn == '1' ? '1-Perorangan' : (c.kn == '2' ? '2-Corporate' : (c.kn || '-'))}</td>
                        <td>${c.nama || '-'}</td>
                        <td>${c.tempat_lahir || '-'}</td>
                        <td class="text-center">${typeof formatDateOnly === 'function' ? formatDateOnly(c.tanggal_lahir) : (c.tanggal_lahir || '-')}</td>
                        <td>${c.alamat || '-'}</td>
                        <td class="text-center">${c.no_ktp || '-'}</td>
                        <td class="text-center">${c.selain_ktp || '-'}</td>
                        <td class="text-center">${c.no_cif || '-'}</td>
                        <td class="text-center">${c.npwp || '-'}</td>
                        <td class="text-center">${c.local_id || '-'}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        if(btn) {
            btn.innerHTML = '<i class="fa-solid fa-search"></i> Filter';
            btn.disabled = false;
        }
    }, 300);
};

window.exportSipesatExcel = async function() {
    const tbody = document.getElementById('sipesatTableBody');
    if (!tbody || tbody.innerText.includes("Tidak ada data") || tbody.innerText.includes("Pilih tanggal")) {
        alert("Muat data terlebih dahulu dengan menentukan rentang rentang tanggal dan klik Filter.");
        return;
    }

    const dataToExport = [
        ["No", "Tanggal Input", "ID Nasabah", "IDPJK", "Kode Nasabah", "Nama", "Tempat Lahir", "Tanggal Lahir", "Alamat", "No KTP", "No ID (Lainnya)", "No CIF", "NPWP", "Local ID"]
    ];

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(r => {
        const cells = r.querySelectorAll('td');
        if (cells.length === 14) {
            let rowData = [];
            cells.forEach(c => rowData.push(c.innerText.trim()));
            dataToExport.push(rowData);
        }
    });

    const ws = XLSX.utils.aoa_to_sheet(dataToExport);
    
    // Set auto width cols easily
    const colWidths = [ {wch:5}, {wch:15}, {wch:15}, {wch:25}, {wch:15}, {wch:15}, {wch:30}, {wch:18}, {wch:18}, {wch:15}, {wch:20}, {wch:15}];
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SIPESAT");

    const startStr = document.getElementById('sipesatStartDate').value || 'Mulai';
    const endStr = document.getElementById('sipesatEndDate').value || 'Selesai';
    const filename = `SIPESAT_Export_${startStr}_sd_${endStr}.xlsx`;

    try {
        const ok = await window.safeExportXLSX(wb, filename);
        if (ok) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({icon: 'success', title: 'Export Berhasil', popup: 'Data SIPESAT berhasil diekspor.', background: '#1e293b', color: '#fff'});
            } else {
                alert("Data SIPESAT berhasil diekspor ke Excel!");
            }
        }
    } catch (e) {
        console.error(e);
        alert("Gagal melakukan export SIPESAT.");
    }
};

// ==============================
// SMARTDEAL SYNC LOGIC
// ==============================
async function syncSmartdealRates() {
    const btn = event.currentTarget || document.querySelector('button[onclick="syncSmartdealRates()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mensinkronisasi...';
    btn.disabled = true;

    try {
        // Tambahkan cache buster (parameter unik hari ini/detik ini) agar proxy tidak menggunakan halaman tersimpan (cached)
        const cacheBuster = new Date().getTime();
        const targetUrl = 'https://smartdeal.co.id/rates/dki_banten?cb=' + cacheBuster;
        
        const proxies = [
            { url: 'https://cors.eu.org/' + targetUrl, type: 'text' },
            { url: 'https://api.allorigins.win/get?url=' + encodeURIComponent(targetUrl), type: 'json' },
            { url: 'https://api.codetabs.com/v1/proxy?quest=' + targetUrl, type: 'text' },
            { url: 'https://corsproxy.io/?' + encodeURIComponent(targetUrl), type: 'text' }
        ];

        let html = null;
        for (let p of proxies) {
            try {
                const response = await fetch(p.url);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                
                if (p.type === 'json') {
                    const data = await response.json();
                    if (data && data.contents) {
                        html = data.contents;
                    } else {
                        throw new Error('Invalid JSON format from proxy');
                    }
                } else {
                    html = await response.text();
                }
                
                // Pastikan HTML valid dan mengandung konten yang diharapkan
                if (html && html.includes('<table')) break; 
            } catch (err) {
                console.warn(`Gagal fetch proxy ${p.url}:`, err.message);
                html = null; // Reset jika gagal parsing
            }
        }

        if (!html) throw new Error('Semua CORS Proxy (AllOrigins/CodeTabs dsb) sedang down. Mohon coba lagi beberapa saat.');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const trs = doc.querySelectorAll('tr');
        let smartdealRates = {};
        
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 2) {
                let codeMatch = '';
                let parsedNums = [];
                let fullInfo = '';
                
                Array.from(tds).forEach(td => {
                    let tStr = td.innerText.trim();
                    fullInfo += tStr + ' ';
                    
                    if (!codeMatch) {
                        let m = tStr.match(/([A-Z]{3})/);
                        if (m) codeMatch = m[1];
                    }
                    
                    // Parse nominal valas flexibel (support format 16.990,00 atau 16,990.00)
                    let cleanStr = tStr.replace(/[^\d.,]/g, '');
                    if (cleanStr.includes(',') && cleanStr.includes('.')) {
                        if (cleanStr.lastIndexOf(',') > cleanStr.lastIndexOf('.')) {
                            cleanStr = cleanStr.replace(/\./g, '').replace(/,/g, '.');
                        } else {
                            cleanStr = cleanStr.replace(/,/g, '');
                        }
                    } else if (cleanStr.includes(',')) {
                        // Jika hanya ada koma (tidak ada titik), diasumsikan sebagai pemisah desimal karena format Smartdeal
                        // adalah format Indonesia, di mana angka ribuan selalu menyertakan titik ribuan (misal 17.785,00).
                        // Hal ini memungkinkan parsing desimal 3 digit secara aman (misal 0,700 untuk VND).
                        cleanStr = cleanStr.replace(/,/g, '.');
                    } else if (cleanStr.includes('.')) {
                        if (!/\.(\d{1,2})$/.test(cleanStr)) cleanStr = cleanStr.replace(/\./g, '');
                    }
                    
                    let numMatch = cleanStr.match(/\d+(\.\d+)?/);
                    if (numMatch) {
                        let val = parseFloat(numMatch[0]);
                        if (val > 0) parsedNums.push(val);
                    }
                });
                
                if (codeMatch && parsedNums.length >= 2) {
                    // Ambil 2 angka terakhir dari kolom (biasanya Buy dan Sell rates)
                    // Mengabaikan angka multiplier di depan seperti "1" atau "100"
                    let rates = parsedNums.slice(-2);
                    let buyRate = Math.min(rates[0], rates[1]);
                    let sellRate = Math.max(rates[0], rates[1]);
                    let is100 = fullInfo.includes('100') && !fullInfo.includes('1000'); 
                    let is1000 = fullInfo.includes('1000');
                    
                    // Normalisasi Harga Paket vs Harga Satuan
                    // Beberapa web money changer menggunakan format Harga Paket untuk 100 lembar (misal: 1,600,000).
                    // Secara universal, tidak ada 1 mata uang apa pun yang bernilai > Rp 100.000.
                    // KWD yang termahal hanya Rp ~50.000. Jadi rate > 100.000 pasti adalah harga paket!
                    if (buyRate >= 100000) {
                        if (is1000) {
                            buyRate = buyRate / 1000;
                            sellRate = sellRate / 1000;
                        } else if (is100) {
                            buyRate = buyRate / 100;
                            sellRate = sellRate / 100;
                        } else {
                            // Asumsi aman fallback base 100
                            buyRate = buyRate / 100;
                            sellRate = sellRate / 100;
                        }
                    }
                    
                    // Update ke memori jika kode baru atau merupakan pecahan besar (rating terbagus)
                    if (!smartdealRates[codeMatch] || is100) {
                        smartdealRates[codeMatch] = { buy: buyRate, sell: sellRate };
                    }
                }
            }
        });
        
        if (Object.keys(smartdealRates).length === 0) {
            throw new Error('Gagal menemukan tabel kurs. Struktur HTML web Smartdeal mungkin berubah.');
        }

        // Terapkan Margin/Selisih dan update DB
        let currencies = getCurrencies();
        let updatedCount = 0;
        
        currencies.forEach(c => {
            if (smartdealRates[c.code]) {
                let sd = smartdealRates[c.code];
                let marginB = c.margin_buy || 0;
                let marginS = c.margin_sell || 0;
                
                c.buy = sd.buy + marginB;
                c.sell = sd.sell + marginS;
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            saveCurrencies(currencies);
            loadCurrencyTable();
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success', 
                    title: 'Sinkronisasi Selesai!', 
                    text: `${updatedCount} Valuta telah ter-update dari Smartdeal (ditambah/kurang selisih margin pengaturan).`,
                    background: '#1e293b', 
                    color: '#f8fafc'
                });
            } else {
                alert(`Berhasil! ${updatedCount} valuta terupdate via Smartdeal.`);
            }
        } else {
            if (typeof Swal !== 'undefined') {
                Swal.fire('Info', 'Tidak ada Master Valuta di aplikasi Anda yang cocok dengan tabel Smartdeal.', 'info');
            } else {
                alert('Tidak ada kode valuta yang cocok.');
            }
        }

    } catch (e) {
        console.error(e);
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error Sync', e.message, 'error');
        } else {
            alert('Error: ' + e.message);
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ==============================
// OLD MONEY MODULE LOGIC (ISOLATED)
// ==============================

// --- Storage Helpers ---
const getOldMoneyStock = () => { let d = JSON.parse(localStorage.getItem('mc_old_money_stock')); return Array.isArray(d) ? d : []; };
const saveOldMoneyStock = (data) => {
    localStorage.setItem('mc_old_money_stock', JSON.stringify(data));
    if(typeof window.pushToUniversalDatastore === 'function') window.pushToUniversalDatastore('mc_old_money_stock', data);
};
const getOldMoneyTrxs = () => { let d = JSON.parse(localStorage.getItem('mc_old_money_trxs')); return Array.isArray(d) ? d : []; };
const saveOldMoneyTrxs = (data) => {
    localStorage.setItem('mc_old_money_trxs', JSON.stringify(data));
    if(typeof window.pushToUniversalDatastore === 'function') window.pushToUniversalDatastore('mc_old_money_trxs', data);
};
const getOldMoneySuppliers = () => { let d = JSON.parse(localStorage.getItem('mc_old_money_suppliers')); return Array.isArray(d) ? d : []; };
const saveOldMoneySuppliers = (data) => {
    localStorage.setItem('mc_old_money_suppliers', JSON.stringify(data));
    if(typeof window.pushToUniversalDatastore === 'function') window.pushToUniversalDatastore('mc_old_money_suppliers', data);
};
const getOldMoneyCash = () => parseFloat(localStorage.getItem('mc_old_money_cash')) || 0;
const saveOldMoneyCash = (val) => {
    localStorage.setItem('mc_old_money_cash', val);
    if(typeof window.pushToUniversalDatastore === 'function') window.pushToUniversalDatastore('mc_old_money_cash', val);
};

// Expose Helpers to window for global access
window.getOldMoneyStock = getOldMoneyStock;
window.saveOldMoneyStock = saveOldMoneyStock;
window.getOldMoneyTrxs = getOldMoneyTrxs;
window.saveOldMoneyTrxs = saveOldMoneyTrxs;
window.getOldMoneySuppliers = getOldMoneySuppliers;
window.saveOldMoneySuppliers = saveOldMoneySuppliers;
window.getOldMoneyCash = getOldMoneyCash;
window.saveOldMoneyCash = saveOldMoneyCash;

// 1. Navigation Init Hook
window.initOldMoneyView = function() {
    window.loadOldMoneyDashboard();
    window.loadOldMoneyItems();
    window.loadOldMoneyCustomerSelect();
    window.loadOldMoneyStockTable();
    window.loadOldMoneyTrxTable();
}

window.loadOldMoneyCustomerSelect = function() {
    const customers = getCustomers();
    const select = document.getElementById('oldMoneyCustomer');
    if (!select) return;
    
    if (window.jQuery && !$(select).hasClass("select2-hidden-accessible")) {
        $(select).select2({ placeholder: "Cari nasabah...", width: '100%' });
    }
    
    const customerOptions = customers.map(c => {
        let idn = c.no_ktp && c.no_ktp !== '-' ? `KTP: ${c.no_ktp}` : (c.selain_ktp && c.selain_ktp !== '-' ? c.selain_ktp : '');
        return `<option value="${c.id_nasabah}">${c.id_nasabah} - ${c.nama}${idn ? ` - ${idn}` : ''}</option>`;
    }).join('');
    select.innerHTML = '<option value="-">-- Pengunjung Biasa / Walk-In --</option>' + customerOptions;
    
    if (window.jQuery) {
        $(select).trigger('change.select2');
    }
}

// Global click proxy for navigation to load initial data
document.addEventListener('click', (e) => {
    let target = e.target.closest('.nav-item');
    if (target) {
        let viewId = target.getAttribute('data-target');
        if (viewId === 'old-money-view') {
            window.initOldMoneyView();
        } else if (viewId === 'investor-view') {
            if (typeof window.loadInvestorTable === 'function') window.loadInvestorTable();
        }
    }
});

// Local formatRp removed, favor global window.formatRp

// 2. Dashboard
window.loadOldMoneyDashboard = function() {
    const cash = window.getOldMoneyCash();
    const stock = window.getOldMoneyStock();
    const trxs = window.getOldMoneyTrxs();
    
    const elCash = document.getElementById('oldMoneyCashBalance');
    if (elCash) elCash.textContent = 'Rp ' + window.formatRp(cash);

    let totalValuation = 0;
    stock.forEach(item => {
        totalValuation += item.qty * item.buyPrice;
    });
    const elStock = document.getElementById('oldMoneyStockValuation');
    if(elStock) elStock.textContent = 'Rp ' + window.formatRp(totalValuation);

    // Hitung Laba Koin
    let totalProfit = 0;

    trxs.forEach(trx => {
        if (trx.type === 'JUAL' && Array.isArray(trx.items)) {
            trx.items.forEach(item => {
                let modalHpp = item.buyPrice;
                if (modalHpp === undefined) {
                    const fallbackStock = stock.find(s => s.id === item.itemId);
                    modalHpp = fallbackStock ? fallbackStock.buyPrice : item.kurs;
                }
                const untungPerItem = item.kurs - modalHpp;
                totalProfit += (untungPerItem * item.qty);
            });
        }
    });
    
    const elProfit = document.getElementById('oldMoneyTotalProfit');
    if(elProfit) elProfit.textContent = 'Rp ' + window.formatRp(totalProfit);
}

// 3. Suppliers
window.openOldMoneySupplierModal = function(id = '') {
    const suppliers = window.getOldMoneySuppliers();
    document.getElementById('modalOldSupplierId').value = id;
    if (id) {
        const sup = suppliers.find(s => s.id === id);
        if (sup) {
            document.getElementById('modalOldSupplierName').value = sup.name;
            document.getElementById('modalOldSupplierPhone').value = sup.phone || '';
            document.getElementById('modalOldSupplierCurrency').value = sup.currency || '';
            document.getElementById('modalOldSupplierBuy').value = sup.buyPrice || '';
            document.getElementById('modalOldSupplierSell').value = sup.sellPrice || '';
        }
    } else {
        document.getElementById('modalOldSupplierName').value = '';
        document.getElementById('modalOldSupplierPhone').value = '';
        document.getElementById('modalOldSupplierCurrency').value = '';
        document.getElementById('modalOldSupplierBuy').value = '';
        document.getElementById('modalOldSupplierSell').value = '';
    }
    window.loadOldMoneySupplierTable();
    document.getElementById('oldMoneySupplierModal').style.display = 'block';
}

window.closeOldMoneySupplierModal = function() { 
    const md = document.getElementById('oldMoneySupplierModal');
    if(md) md.style.display = 'none'; 
}

window.saveOldMoneySupplier = function() {
    const id = document.getElementById('modalOldSupplierId').value;
    const name = document.getElementById('modalOldSupplierName').value.trim();
    const phone = document.getElementById('modalOldSupplierPhone').value.trim();
    const currency = document.getElementById('modalOldSupplierCurrency').value.trim();
    const buyPrice = parseInt(document.getElementById('modalOldSupplierBuy').value) || 0;
    const sellPrice = parseInt(document.getElementById('modalOldSupplierSell').value) || 0;

    if (!name) return alert('Nama suplayer wajib diisi!');

    const suppliers = window.getOldMoneySuppliers();
    if (id) {
        const idx = suppliers.findIndex(s => s.id === id);
        if (idx !== -1) {
            suppliers[idx] = { ...suppliers[idx], name, phone, currency, buyPrice, sellPrice };
        }
    } else {
        suppliers.push({
            id: 'SUP' + Date.now(),
            name,
            phone,
            currency,
            buyPrice,
            sellPrice
        });
    }

    window.saveOldMoneySuppliers(suppliers);
    
    document.getElementById('modalOldSupplierId').value = '';
    document.getElementById('modalOldSupplierName').value = '';
    document.getElementById('modalOldSupplierPhone').value = '';
    document.getElementById('modalOldSupplierCurrency').value = '';
    document.getElementById('modalOldSupplierBuy').value = '';
    document.getElementById('modalOldSupplierSell').value = '';
    
    window.loadOldMoneySupplierTable();
    alert('Suplayer / Acuan Harga berhasil disimpan!');
}

// 4. Items Master
window.openOldMoneyItemModal = function(id = '') {
    const stock = window.getOldMoneyStock();
    document.getElementById('modalOldItemId').value = id;
    if (id) {
        const item = stock.find(s => s.id === id);
        if (item) {
            document.getElementById('modalOldItemCategory').value = item.category || 'KOIN';
            document.getElementById('modalOldItemCode').value = item.code || '';
            document.getElementById('modalOldItemDesc').value = item.desc || '';
            document.getElementById('modalOldItemBuyPrice').value = item.buyPrice || 0;
        }
    } else {
        document.getElementById('modalOldItemCategory').value = 'KOIN';
        document.getElementById('modalOldItemCode').value = '';
        document.getElementById('modalOldItemDesc').value = '';
        document.getElementById('modalOldItemBuyPrice').value = '';
    }
    document.getElementById('oldMoneyItemModal').style.display = 'block';
}

window.closeOldMoneyItemModal = function() { 
    const md = document.getElementById('oldMoneyItemModal');
    if(md) md.style.display = 'none'; 
}

window.saveOldMoneyItem = function() {
    const id = document.getElementById('modalOldItemId').value;
    const category = document.getElementById('modalOldItemCategory').value;
    const code = document.getElementById('modalOldItemCode').value.trim().toUpperCase();
    const desc = document.getElementById('modalOldItemDesc').value.trim();
    const buyPrice = parseInt(document.getElementById('modalOldItemBuyPrice').value) || 0;

    if (!desc) return alert('Nama spesifik/deskripsi wajib diisi!');

    let stock = window.getOldMoneyStock();
    if (id) {
        const idx = stock.findIndex(s => s.id === id);
        if (idx !== -1) {
            stock[idx] = { ...stock[idx], category, code, desc, buyPrice };
        }
    } else {
        stock.push({
            id: 'ITM' + Date.now(),
            category,
            code,
            desc,
            buyPrice,
            qty: 0
        });
    }

    window.saveOldMoneyStock(stock);
    alert('Item master berhasil disimpan!');
    window.closeOldMoneyItemModal();
    
    try {
        window.loadOldMoneyItems();
        window.loadOldMoneyStockTable();
        window.loadOldMoneyDashboard();
    } catch(e) { console.error("UI update after saveOldMoneyItem failed:", e); }
}

// 5. Cash Mutasi
window.openOldMoneyTopupModal = function() {
    document.getElementById('modalOldTopupType').value = 'IN';
    document.getElementById('modalOldTopupAmount').value = '';
    document.getElementById('modalOldTopupDesc').value = '';
    document.getElementById('oldMoneyTopupModal').style.display = 'block';
}

window.closeOldMoneyTopupModal = function() { 
    const md = document.getElementById('oldMoneyTopupModal');
    if(md) md.style.display = 'none'; 
}

window.saveOldMoneyTopup = function() {
    const type = document.getElementById('modalOldTopupType').value;
    const amount = parseInt(document.getElementById('modalOldTopupAmount').value) || 0;
    const desc = document.getElementById('modalOldTopupDesc').value.trim();

    if (amount <= 0) return alert('Masukkan nominal valid!');
    if (!desc) return alert('Keterangan wajib diisi!');

    let cash = window.getOldMoneyCash();
    if (type === 'OUT') {
        if (amount > cash) return alert(`Kas Koin tidak cukup! Sisa: ${window.formatIdr(cash)}`);
        cash -= amount;
    } else {
        cash += amount;
    }

    window.saveOldMoneyCash(cash);

    const newTrx = {
        id: 'T' + Date.now().toString().slice(-6),
        date: new Date().toISOString(),
        type: 'TOPUP',
        itemDesc: (type === 'IN' ? '[MASUK] ' : '[KELUAR] ') + desc,
        qty: 0,
        totalRp: (type === 'OUT' ? -amount : amount)
    };
    
    try {
        let trxs = window.getOldMoneyTrxs();
        trxs.push(newTrx);
        window.saveOldMoneyTrxs(trxs);
    } catch(e) { console.error('ERROR simpan transaksi topup:', e); alert('Gagal simpan: ' + e.message); return; }

    try {
        window.closeOldMoneyTopupModal();
        window.loadOldMoneyDashboard();
        window.loadOldMoneyTrxTable();
    } catch(e) { console.error("UI update after saveOldMoneyTopup failed:", e); }
    
    alert('Mutasi kas koin berhasil dicatat!');
}

// 6. Renders
window.loadOldMoneyItems = function() {
    const stock = getOldMoneyStock();
    const select = document.getElementById('oldMoneyItem');
    if (!select) return;
    
    if (window.jQuery && !$(select).hasClass("select2-hidden-accessible")) {
        $(select).select2({ placeholder: "Cari / pilih item...", width: '100%', dropdownAutoWidth: true });
    }
    
    let options = '<option value="">-- Kosong --</option>';
    stock.forEach(item => {
        options += `<option value="${item.id}" data-price="${item.buyPrice}">${item.code ? item.code+' - ' : ''}${item.desc} (Sisa: ${item.qty})</option>`;
    });
    
    select.innerHTML = options;
    
    if (window.jQuery) {
        $(select).trigger('change.select2');
    }
}

window.filterOldMoneySupplierTable = function() {
    window.loadOldMoneySupplierTable();
}

window.loadOldMoneySupplierTable = function() {
    let suppliers = getOldMoneySuppliers();
    const tbody = document.getElementById('oldMoneySupplierTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('modalOldSupplierFilter');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (search) {
        suppliers = suppliers.filter(s => 
            (s.name && s.name.toLowerCase().includes(search)) ||
            (s.currency && s.currency.toLowerCase().includes(search))
        );
        // Sort by buyPrice (Harga Terima) descending to show best prices at the top
        suppliers.sort((a, b) => (b.buyPrice || 0) - (a.buyPrice || 0));
    } else {
        // Default sort by currency string, then by buyPrice
        suppliers.sort((a, b) => {
            const cA = (a.currency || '').toLowerCase();
            const cB = (b.currency || '').toLowerCase();
            if (cA < cB) return -1;
            if (cA > cB) return 1;
            return (b.buyPrice || 0) - (a.buyPrice || 0);
        });
    }

    tbody.innerHTML = '';
    if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada daftar suplayer/pengepul.</td></tr>';
        return;
    }

    suppliers.forEach(s => {
        let cur = s.currency || '-';
        let buy = s.buyPrice ? window.formatIdr(s.buyPrice).replace('Rp ','') : '0';
        let sell = s.sellPrice ? window.formatIdr(s.sellPrice).replace('Rp ','') : '0';
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${s.name}</strong><br><small class="text-muted">${s.phone || '-'}</small></td>
                <td>${cur}</td>
                <td style="text-align: right; color: #10b981;">Rp ${buy}</td>
                <td style="text-align: right; color: #ef4444;">Rp ${sell}</td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px;" onclick="window.openOldMoneySupplierModal('${s.id}')"><i class="fa-solid fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px; color: #ef4444; border-color: #ef4444;" onclick="window.deleteOldMoneySupplier('${s.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

window.deleteOldMoneySupplier = function(id) {
    if (!confirm('Hapus acuan harga suplayer ini?')) return;
    let suppliers = getOldMoneySuppliers();
    suppliers = suppliers.filter(s => s.id !== id);
    saveOldMoneySuppliers(suppliers);
    window.loadOldMoneySupplierTable();
}

window.loadOldMoneyStockTable = function() {
    const stock = getOldMoneyStock();
    const tbody = document.getElementById('oldMoneyStockTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (stock.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada item master.</td></tr>';
        return;
    }

    stock.forEach(item => {
        // Ekstrak mata uang (kata pertama dari code atau desc)
        let nameStr = (item.code ? item.code : item.desc) || '';
        let currencyCode = nameStr.split(' ')[0] || 'item';
        
        // Membatasi panjangnya agar tidak terlalu panjang, misalnya jika yang terisi "Pecahan"
        if(currencyCode.length > 5 || currencyCode.trim() === '') {
            currencyCode = 'item';
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.category}</strong><br>${item.code ? item.code+' - ' : ''}${item.desc}</td>
                <td style="text-align: right; font-weight: bold; color: ${item.qty > 0 ? '#10b981' : '#ef4444'};">${item.qty}</td>
                <td style="text-align: right;">+ Rp ${window.formatRp(item.buyPrice)}/${currencyCode}</td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px;" onclick="window.openOldMoneyItemModal('${item.id}')"><i class="fa-solid fa-edit"></i></button>
                    ${item.qty === 0 ? `<button class="btn btn-sm btn-outline" style="padding:4px 8px; color: #ef4444; border-color: #ef4444;" onclick="window.deleteOldMoneyItem('${item.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    });
}

window.loadOldMoneyTrxTable = function() {
    const rawTrxs = getOldMoneyTrxs();
    const tbody = document.getElementById('oldMoneyTrxTableBody');
    if (!tbody) return;

    // Ambil nilai filter (jika ada)
    const startDate = document.getElementById('oldMoneyFilterStart')?.value;
    const endDate = document.getElementById('oldMoneyFilterEnd')?.value;
    const searchText = document.getElementById('oldMoneyFilterText')?.value.toLowerCase().trim();

    let trxs = rawTrxs;

    if (startDate || endDate || searchText) {
        trxs = rawTrxs.filter(trx => {
            const trxDate = trx.date.split('T')[0]; // Ambil YYYY-MM-DD
            
            // Cek Date
            let dateMatch = true;
            if (startDate && endDate) dateMatch = (trxDate >= startDate && trxDate <= endDate);
            else if (startDate) dateMatch = (trxDate >= startDate);
            else if (endDate) dateMatch = (trxDate <= endDate);

            // Cek Text
            let textMatch = true;
            if (searchText) {
                const combinedString = `${trx.id} ${trx.type} ${trx.itemDesc} ${trx.supplier} ${trx.supplierPhone || ''}`.toLowerCase();
                textMatch = combinedString.includes(searchText);
            }

            return dateMatch && textMatch;
        });
    }

    tbody.innerHTML = '';
    if (trxs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada transaksi.</td></tr>';
        return;
    }

    trxs.forEach(trx => {
        let typeColor = trx.type === 'JUAL' ? '#10b981' : (trx.type === 'BELI' ? '#ef4444' : '#3b82f6');
        let dt = new Date(trx.date);
        let timeStr = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;

        tbody.innerHTML += `
            <tr>
                <td>${timeStr}</td>
                <td><small>${trx.id}</small></td>
                <td style="color: ${typeColor}; font-weight: bold;">${trx.type}</td>
                <td>${trx.itemDesc}</td>
                <td style="text-align: right;">${trx.qty}</td>
                <td style="text-align: right; color: ${trx.type === 'JUAL' || trx.type === 'TOPUP' ? '#10b981' : '#ef4444'};">Rp ${window.formatRp(trx.totalRp)}</td>
                <td>${trx.supplier}</td>
                <td style="text-align: center;">
                    ${['JUAL','BELI'].includes(trx.type) ? `<button class="btn btn-sm btn-outline" style="padding:2px 8px;" onclick="window.printOldMoneyReceiptRaw('${trx.id}')"><i class="fa-solid fa-print"></i></button>` : '-'}
                </td>
            </tr>
        `;
    });
}

window.deleteOldMoneyItem = function(id) {
    if (!confirm('Hapus item ini selamanya?')) return;
    let stock = getOldMoneyStock();
    stock = stock.filter(s => s.id !== id);
    saveOldMoneyStock(stock);
    window.loadOldMoneyItems();
    window.loadOldMoneyStockTable();
}

// 7. Transaction Logics

window.autoFillOldMoneyKurs = function() {
    const select = document.getElementById('oldMoneyItem');
    const opt = select ? select.options[select.selectedIndex] : null;
    const type = document.getElementById('oldMoneyTrxType') ? document.getElementById('oldMoneyTrxType').value : 'BELI';
    const kursHint = document.getElementById('oldMoneyKursHint');
    const kursInput = document.getElementById('oldMoneyKurs');
    const priceHint = document.getElementById('oldMoneyPriceHint');
    const denomInput = document.getElementById('oldMoneyDenom');
    
    if (opt && opt.value) {
        const itemId = opt.value;
        const stock = getOldMoneyStock();
        const item = stock.find(s => s.id === itemId);
        
        const basePrice = parseInt(opt.getAttribute('data-price')) || 0;
        if(priceHint) priceHint.textContent = `Saran Base Modal / pcs: ${formatIdr(basePrice)}`;

        let parsedDenom = 1;
        if (item && item.desc) {
            const numMatch = item.desc.match(/[\d.,]+/);
            if (numMatch) {
                let numStr = numMatch[0].replace(',', '.');
                let parsed = parseFloat(numStr);
                if (!isNaN(parsed) && parsed > 0) {
                    parsedDenom = parsed;
                }
            }
        }
        if (denomInput) denomInput.value = parsedDenom;

        let koinKurs = 0;
        if (basePrice > 0) {
            koinKurs = basePrice;
        }

        if (koinKurs > 0) {
            if(kursInput) kursInput.value = koinKurs;
            if(kursHint) kursHint.textContent = `Saran Kurs Koin: ${formatIdr(koinKurs)}`;
        } else {
            if(kursInput) kursInput.value = '';
            if(kursHint) kursHint.textContent = `Saran Kurs Koin: -`;
        }
    } else {
        if(kursInput) kursInput.value = '';
        if(kursHint) kursHint.textContent = 'Kurs Master: -';
        if(priceHint) priceHint.textContent = 'Saran Base Modal / pcs: -';
    }
    
    calculateOldMoneyForm();
}

window.calculateOldMoneyForm = function() {
    const denomEl = document.getElementById('oldMoneyDenom');
    const qtyEl = document.getElementById('oldMoneyQty');
    const kursEl = document.getElementById('oldMoneyKurs');
    
    const denom = denomEl ? parseFloat(denomEl.value) || 0 : 1;
    const qty = qtyEl ? parseFloat(qtyEl.value) || 0 : 0;
    const kurs = kursEl ? parseFloat(kursEl.value) || 0 : 0;
    
    const valasAmt = denom * qty;
    const elValas = document.getElementById('oldMoneyValas');
    if(elValas) elValas.value = valasAmt > 0 ? valasAmt : '';
    
    const totalRp = valasAmt * kurs;
    const elRp = document.getElementById('oldMoneyTotalRp');
    if(elRp) elRp.value = totalRp > 0 ? Math.round(totalRp) : '';
}

window.oldMoneyCart = [];

function addToOldMoneyCart() {
    const type = document.getElementById('oldMoneyTrxType').value;
    const itemId = document.getElementById('oldMoneyItem').value;
    const denom = parseFloat(document.getElementById('oldMoneyDenom').value) || 0;
    const qty = parseInt(document.getElementById('oldMoneyQty').value) || 0;
    const valasAmt = parseFloat(document.getElementById('oldMoneyValas').value) || 0;
    const kurs = parseFloat(document.getElementById('oldMoneyKurs').value) || 0;
    const totalRp = parseInt(document.getElementById('oldMoneyTotalRp').value) || 0;

    if (!itemId) return alert('Pilih master item/koin terlebih dahulu!');
    if (qty <= 0) return alert('Jumlah unit > 0!');
    if (totalRp <= 0) return alert('Total kesepakatan bernilai > 0!');

    const stock = getOldMoneyStock();
    const item = stock.find(s => s.id === itemId);
    if (!item) return alert('Item invalid!');
    
    // Check stock if JUAL
    if (type === 'JUAL') {
        const currentQtyInCart = window.oldMoneyCart.filter(i => i.itemId === itemId).reduce((sum, item) => sum + item.qty, 0);
        if (item.qty < (qty + currentQtyInCart)) return alert(`Stok koin tidak cukup! Sisa: ${item.qty - currentQtyInCart}`);
    }

    window.oldMoneyCart.push({
        itemId: item.id,
        itemCode: item.code || '',
        itemDesc: item.desc,
        denom: denom,
        valasAmt: valasAmt,
        kurs: kurs,
        qty: qty,
        totalRp: totalRp,
        type: type
    });

    renderOldMoneyCart();

    // Reset Form Partial
    document.getElementById('oldMoneyQty').value = '';
    document.getElementById('oldMoneyTotalRp').value = '';
    if (document.getElementById('oldMoneyDenom')) document.getElementById('oldMoneyDenom').value = '';
    if (document.getElementById('oldMoneyValas')) document.getElementById('oldMoneyValas').value = '';
    if (document.getElementById('oldMoneyKurs')) document.getElementById('oldMoneyKurs').value = '';
    if (document.getElementById('oldMoneyPriceHint')) document.getElementById('oldMoneyPriceHint').textContent = `Saran Base Modal: -`;
    if (document.getElementById('oldMoneyKursHint')) document.getElementById('oldMoneyKursHint').textContent = `Kurs Master: -`;
}

function removeOldMoneyCartItem(index) {
    window.oldMoneyCart.splice(index, 1);
    renderOldMoneyCart();
}

function renderOldMoneyCart() {
    const container = document.getElementById('oldMoneyCartContainer');
    const grandTotalEl = document.getElementById('oldMoneyGrandTotalIdr');
    const btnCheckout = document.getElementById('btnOldMoneyCheckout');
    
    if (!container || !grandTotalEl || !btnCheckout) return;

    if (window.oldMoneyCart.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #94A3B8; padding: 10px;">Keranjang Kosong</div>';
        grandTotalEl.textContent = 'Rp 0';
        btnCheckout.disabled = true;
        return;
    }

    let html = '';
    let grandTotal = 0;

    window.oldMoneyCart.forEach((item, index) => {
        grandTotal += item.totalRp;
        html += `
            <div style="background: rgba(30, 41, 59, 0.8); padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(148, 163, 184, 0.2); position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="color: ${item.type === 'JUAL' ? '#10b981' : '#ef4444'}">[${item.type}] ${item.itemCode ? item.itemCode + ' ' : ''}${item.itemDesc}</strong>
                    <button class="btn btn-sm btn-outline" style="padding: 2px 8px; color: #ef4444; border-color: #ef4444;" onclick="removeOldMoneyCartItem(${index})"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="font-size: 0.85rem; color: #cbd5e1; display: flex; justify-content: space-between;">
                    <span>${item.qty} pcs @ ${formatIdr(item.kurs)}</span>
                    <strong style="font-size: 0.9rem;">${formatIdr(item.totalRp)}</strong>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    grandTotalEl.textContent = `${formatIdr(grandTotal)}`;
    btnCheckout.disabled = false;
}

function processOldMoneyCheckout() {
    if (window.oldMoneyCart.length === 0) return alert('Keranjang kosong!');
    
    // Validasi satu tipe (BELI atau JUAL)
    const formsType = window.oldMoneyCart[0].type;
    const mixedType = window.oldMoneyCart.some(i => i.type !== formsType);
    if(mixedType) return alert('Keranjang tidak boleh mencampur item JUAL dan BELI dalam satu checkout!');

    const customerId = document.getElementById('oldMoneyCustomer') ? document.getElementById('oldMoneyCustomer').value : '-';
    let grandTotal = window.oldMoneyCart.reduce((sum, item) => sum + item.totalRp, 0);

    let cash = getOldMoneyCash();
    if (formsType === 'BELI') {
        if (cash < grandTotal) return alert(`Kas Koin tidak cukup! Butuh ${formatIdr(grandTotal)}, Sisa Kas: ${formatIdr(cash)}`);
    }

    const stock = getOldMoneyStock();
    
    // Process Cart Items
    window.oldMoneyCart.forEach(cartItem => {
        const itemIdx = stock.findIndex(s => s.id === cartItem.itemId);
        if(itemIdx !== -1) {
            // Snapshot HPP (Harga Modal / buyPrice) saat ini juga untuk akurasi laba selamanya
            cartItem.buyPrice = stock[itemIdx].buyPrice;

            if (formsType === 'BELI') {
                stock[itemIdx].qty += cartItem.qty;
            } else if (formsType === 'JUAL') {
                stock[itemIdx].qty -= cartItem.qty;
            }
        } else {
            // Fallback apabila stok terhapus/hilang secara anonim
            cartItem.buyPrice = cartItem.kurs; 
        }
    });

    if (formsType === 'BELI') {
        cash -= grandTotal;
    } else {
        cash += grandTotal;
    }

    let counterpartName = 'Nasabah Walk-In';
    let counterpartPhone = '-';
    let counterpartCitizenship = 'WNI';
    
    if (customerId !== '-') {
        const custs = getCustomers();
        const found = custs.find(c => c.id_nasabah === customerId);
        if (found) {
            counterpartName = found.nama;
            counterpartPhone = found.hp || '-';
            counterpartCitizenship = found.kewarganegaraan || found.citizenship || found.kwn || found.warga_negara || 'WNI';
        }
    }

    saveOldMoneyCash(cash);
    saveOldMoneyStock(stock);

    const firstItemStr = `${window.oldMoneyCart[0].itemCode ? window.oldMoneyCart[0].itemCode+' ' : ''}${window.oldMoneyCart[0].itemDesc}`;
    const descStr = window.oldMoneyCart.length > 1 ? `${firstItemStr} (+${window.oldMoneyCart.length - 1} lainnya)` : firstItemStr;
    const totalQty = window.oldMoneyCart.reduce((sum, item) => sum + item.qty, 0);

    const newTrx = {
        id: 'OM' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100),
        date: new Date().toISOString(),
        type: formsType,
        itemDesc: descStr,
        qty: totalQty,
        totalRp: grandTotal,
        supplier: counterpartName,
        supplierPhone: counterpartPhone,
        supplierCitizenship: counterpartCitizenship,
        cashBalanceAfter: cash,
        items: [...window.oldMoneyCart]
    };

    const trxs = getOldMoneyTrxs();
    trxs.unshift(newTrx);
    saveOldMoneyTrxs(trxs);

    // Reset UI
    window.oldMoneyCart = [];
    renderOldMoneyCart();

    if (document.getElementById('oldMoneyCustomer')) {
        document.getElementById('oldMoneyCustomer').value = '-';
        if (window.jQuery) $('#oldMoneyCustomer').trigger('change.select2');
    }

    loadOldMoneyDashboard();
    loadOldMoneyItems(); 
    loadOldMoneyStockTable();
    loadOldMoneyTrxTable();

    window.lastOldMoneyTrx = newTrx;
    alert(`Transaksi ${formsType} berhasil! Otomatis ${formsType==='BELI'?'memotong':'menambah'} kas koin khusus.`);
    printOldMoneyReceiptRaw(newTrx.id);
}

// 8. Printing
function printOldMoneyReceipt() {
    if (!window.lastOldMoneyTrx) return alert('Belum ada transaksi di sesi ini!');
    printOldMoneyReceiptRaw(window.lastOldMoneyTrx.id);
}

function printOldMoneyReceiptRaw(trxId) {
    const trxs = getOldMoneyTrxs();
    const trx = trxs.find(t => t.id === trxId);
    if (!trx) return alert('Transaksi tidak ditemukan!');

    const profile = getProfile();
    const dt = new Date(trx.date);
    const dateStr = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;

    // Get Admin Name
    let adminName = 'Admin';
    try {
        const u = JSON.parse(localStorage.getItem('mc_currentUser'));
        if(u && u.fullName) adminName = u.fullName;
        else if (u && u.username) adminName = u.username;
    } catch(e){}

    // Format Phone
    let maskedPhone = '-';
    if(trx.supplierPhone && trx.supplierPhone !== '-') {
        const p = trx.supplierPhone;
        if(p.length > 3) {
            maskedPhone = p.substring(0, p.length - 3) + '***';
        } else {
            maskedPhone = '***';
        }
    }

    let itemsHtml = '';
    const itemsArray = trx.items || [{
        itemDesc: trx.itemDesc,
        qty: trx.qty,
        denom: trx.denom,
        valasAmt: trx.valasAmt,
        kurs: trx.kurs,
        totalRp: trx.totalRp
    }];

    itemsArray.forEach(it => {
        let kursText = '';
        if (it.kurs > 0) {
            kursText = ` @Rp ${formatRp(it.kurs)}`;
        }
        let valasText = '';
        if (it.valasAmt > 0) {
            valasText = `, Valas: ${it.valasAmt}`;
        }
        itemsHtml += `
        <div class="row" style="font-size: 11px;">
            <span style="max-width:180px; word-wrap: break-word;">${it.itemCode ? it.itemCode+' ' : ''}${it.itemDesc} (x${it.qty}${valasText}${kursText})</span>
            <span style="font-weight: bold;">Rp ${formatRp(it.totalRp)}</span>
        </div>`;
    });

    const printWindow = window.open('', '_blank', 'width=350,height=600');
    
    // Gunakan trx.supplierCitizenship jika ada, jika tidak default 'WNI'
    const wargaNegara = trx.supplierCitizenship || 'WNI';

    const htmlCetak = `
    <html>
    <head>
        <title>Struk Transaksi - ${trx.id}</title>
        <style>
            body { font-family: 'Courier New', Courier, monospace; width: 300px; margin: 0 auto; color: #000; padding: 10px; font-size: 12px; line-height: 1.4; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .header-mc { font-size: 16px; margin-bottom: 5px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        </style>
    </head>
    <body onload="window.print(); window.close();">
        <div class="text-center font-bold header-mc">${profile.name}</div>
        ${profile.biLicense ? `<div class="text-center" style="font-size: 0.9em; font-weight: bold; margin-bottom: 5px;">Izin BI: ${profile.biLicense}</div>` : ''}
        <div class="text-center">${profile.address}</div>
        <div class="text-center">Telp: ${profile.phone}</div>
        <div class="divider"></div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
            <tr><td style="width: 60px;">No Inv</td><td>: ${trx.id}</td></tr>
            <tr><td>Tanggal</td><td>: ${dateStr}</td></tr>
            <tr><td>Nasabah</td><td>: ${trx.supplier}</td></tr>
            <tr><td>No Tlp</td><td>: ${maskedPhone}</td></tr>
            <tr><td>Warga Ngr</td><td>: ${wargaNegara}</td></tr>
        </table>
        
        <div class="divider"></div>
        <div style="margin-bottom: 6px; font-weight: bold;">Rincian Transaksi (${trx.qty} pcs):</div>
        ${itemsHtml}
        
        <div class="divider"></div>
        <div class="row font-bold" style="font-size: 14px;">
            <span>TOTAL:</span>
            <span>Rp ${new Intl.NumberFormat('id-ID').format(trx.totalRp)}</span>
        </div>
        
        <div class="divider"></div>
        <div class="text-center" style="font-size: 11px; margin-bottom: 15px;">
            <p>Terima kasih atas kunjungan Anda.</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 11px; text-align: center;">
            <div style="width: 45%;">
                <p style="margin-bottom: 30px;">Petugas,</p>
                <p style="font-weight: bold; text-decoration: underline;">${adminName}</p>
            </div>
            <div style="width: 45%;">
                <p style="margin-bottom: 30px;">Nasabah,</p>
                <p style="font-weight: bold; text-decoration: underline;">${trx.supplier}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    printWindow.document.write(htmlCetak);
    printWindow.document.close();
}

// ==============================
// HRIS MODULE LOGIC
// ==============================

// Tab Switching
window.switchHrisTab = function(tabName) {
    document.querySelectorAll('.hris-tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.add('hidden');
    });
    document.querySelectorAll('.hris-tab-btn').forEach(btn => {
        btn.classList.remove('active', 'btn-primary');
        btn.classList.add('btn-outline');
    });

    const activeTab = document.getElementById('hris-tab-' + tabName);
    const activeBtn = document.getElementById('btn-tab-hris-' + tabName);
    
    if(activeTab) {
        activeTab.style.display = 'block';
        activeTab.classList.remove('hidden');
    }
    if(activeBtn) {
        activeBtn.classList.remove('btn-outline');
        activeBtn.classList.add('btn-primary', 'active');
    }

    if(tabName === 'emp') renderHrisEmployees();
    if(tabName === 'att') {
        const sel = document.getElementById('hrisAttEmpSelect');
        sel.innerHTML = '<option value="">-- Pilih Nama Anda --</option>' + getHrisEmployees().filter(e => e.status === 'Aktif').map(e => `<option value="${e.nik}">${e.name} (${e.role})</option>`).join('');
        renderHrisAttendanceTable();
    }
    if(tabName === 'leave') renderHrisLeaveTable();
    if(tabName === 'kasbon') renderHrisKasbonTable();
    if(tabName === 'bpjs') renderHrisBpjsTable();
    if(tabName === 'payroll') {
        const sel = document.getElementById('hrisPayrollEmp');
        if(sel) sel.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + getHrisEmployees().map(e => `<option value="${e.nik}">${e.name} (${e.nik})</option>`).join('');
        document.getElementById('hrisPayrollResult').style.display = 'none';
    }
};

// --- DATA KARYAWAN ---
window.renderHrisEmployees = function() {
    const emps = getHrisEmployees();
    const tbody = document.getElementById('hrisEmpTableBody');
    if(!tbody) return;
    tbody.innerHTML = emps.map(e => `
        <tr>
            <td><strong>${e.nik}</strong></td>
            <td>${e.name}</td>
            <td>${e.role}</td>
            <td style="text-align:right;">
                <span class="text-green">${formatIdr(e.salary)}</span>/bln<br>
                <small class="text-muted">+ ${formatIdr(e.food)}/hr</small>
            </td>
            <td style="text-align:center;">
                <span class="badge ${e.status === 'Aktif' ? 'bg-success' : 'bg-danger'}">${e.status}</span>
            </td>
            <td style="text-align:center;">
                <button class="btn btn-sm btn-outline" onclick="openHrisEmployeeModal('${e.nik}')"><i class="fa-solid fa-pen"></i></button>
            </td>
        </tr>
    `).join('');
};

window.openHrisEmployeeModal = function(nik = null) {
    document.getElementById('hrisEmployeeModal').classList.add('show');
    const inputNik = document.getElementById('modalHrisEmpNik');
    
    // Reset previews and inputs
    ['modalHrisEmpPhoto', 'modalHrisEmpPhotoFull', 'modalHrisEmpKtp', 'modalHrisEmpSim', 'modalHrisEmpIjazah'].forEach(id => {
        document.getElementById(id).value = '';
    });
    ['previewEmpPhoto', 'previewEmpPhotoFull', 'previewEmpKtp', 'previewEmpSim', 'previewEmpIjazah'].forEach(id => {
        document.getElementById(id).innerHTML = '';
    });

    if(nik) {
        const e = getHrisEmployees().find(x => x.nik === nik);
        if(e) {
            inputNik.value = e.nik; inputNik.disabled = true;
            document.getElementById('modalHrisEmpName').value = e.name;
            document.getElementById('modalHrisEmpPhone').value = e.phone || '';
            document.getElementById('modalHrisEmpMaps').value = e.maps || '';
            document.getElementById('modalHrisEmpAddress').value = e.address || '';
            document.getElementById('modalHrisEmpRole').value = e.role;
            document.getElementById('modalHrisEmpStatus').value = e.status;
            document.getElementById('modalHrisEmpSalary').value = e.salary;
            document.getElementById('modalHrisEmpFood').value = e.food;
            document.getElementById('modalHrisEmpPin').value = e.pin;
            
            // Show previews if they exist
            if(e.photo) document.getElementById('previewEmpPhoto').innerHTML = `<img src="${e.photo}" style="height:80px; border-radius:4px; border:1px solid #4ade80;">`;
            if(e.photoFull) document.getElementById('previewEmpPhotoFull').innerHTML = `<img src="${e.photoFull}" style="height:80px; border-radius:4px; border:1px solid #4ade80;">`;
            if(e.ktp) document.getElementById('previewEmpKtp').innerHTML = e.ktp.startsWith('data:application/pdf') ? '<span class="badge bg-info"><i class="fa-solid fa-file-pdf"></i> KTP PDF Tersimpan</span>' : `<img src="${e.ktp}" style="height:80px; border-radius:4px; border:1px solid #4ade80;">`;
            if(e.sim) document.getElementById('previewEmpSim').innerHTML = e.sim.startsWith('data:application/pdf') ? '<span class="badge bg-info"><i class="fa-solid fa-file-pdf"></i> SIM PDF Tersimpan</span>' : `<img src="${e.sim}" style="height:80px; border-radius:4px; border:1px solid #4ade80;">`;
            if(e.ijazah) document.getElementById('previewEmpIjazah').innerHTML = e.ijazah.startsWith('data:application/pdf') ? '<span class="badge bg-info"><i class="fa-solid fa-file-pdf"></i> Ijazah PDF Tersimpan</span>' : `<img src="${e.ijazah}" style="height:80px; border-radius:4px; border:1px solid #4ade80;">`;
            
            // Store existing files in dataset temporary so we don't lose them if user doesn't re-upload
            document.getElementById('modalHrisEmpPhoto').dataset.old = e.photo || '';
            document.getElementById('modalHrisEmpPhotoFull').dataset.old = e.photoFull || '';
            document.getElementById('modalHrisEmpKtp').dataset.old = e.ktp || '';
            document.getElementById('modalHrisEmpSim').dataset.old = e.sim || '';
            document.getElementById('modalHrisEmpIjazah').dataset.old = e.ijazah || '';
        }
    } else {
        inputNik.value = ''; inputNik.disabled = false;
        document.getElementById('modalHrisEmpName').value = '';
        document.getElementById('modalHrisEmpPhone').value = '';
        document.getElementById('modalHrisEmpMaps').value = '';
        document.getElementById('modalHrisEmpAddress').value = '';
        document.getElementById('modalHrisEmpRole').value = 'Kasir';
        document.getElementById('modalHrisEmpStatus').value = 'Aktif';
        document.getElementById('modalHrisEmpSalary').value = '2000000';
        document.getElementById('modalHrisEmpFood').value = '25000';
        document.getElementById('modalHrisEmpPin').value = '';
        
        ['modalHrisEmpPhoto', 'modalHrisEmpPhotoFull', 'modalHrisEmpKtp', 'modalHrisEmpSim', 'modalHrisEmpIjazah'].forEach(id => {
            document.getElementById(id).dataset.old = '';
        });
    }
};

window.closeHrisEmployeeModal = function() { document.getElementById('hrisEmployeeModal').classList.remove('show'); };

// Helper to compress image and read as base64
function processFileHris(file) {
    return new Promise((resolve) => {
        if(!file) { resolve(''); return; }
        
        // If it's a PDF, we can't compress it in frontend simply, so just read as base64
        // Be careful: large PDFs will crash localstorage
        if(file.type === 'application/pdf') {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.readAsDataURL(file);
            return;
        }

        // If Image, compress with Canvas
        const r = new FileReader();
        r.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                let w = img.width; let h = img.height;
                const MAX = 800;
                if(w > h && w > MAX) { h *= MAX / w; w = MAX; }
                else if(h > MAX) { w *= MAX / h; h = MAX; }
                cvs.width = w; cvs.height = h;
                const ctx = cvs.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(cvs.toDataURL('image/jpeg', 0.6)); // Compress strongly
            };
            img.src = e.target.result;
        };
        r.readAsDataURL(file);
    });
}

window.saveHrisEmployee = async function() {
    const nik = document.getElementById('modalHrisEmpNik').value.trim();
    const name = document.getElementById('modalHrisEmpName').value.trim();
    const phone = document.getElementById('modalHrisEmpPhone').value.trim();
    const maps = document.getElementById('modalHrisEmpMaps').value.trim();
    const address = document.getElementById('modalHrisEmpAddress').value.trim();
    const role = document.getElementById('modalHrisEmpRole').value;
    const status = document.getElementById('modalHrisEmpStatus').value;
    const salary = parseFloat(document.getElementById('modalHrisEmpSalary').value) || 0;
    const food = parseFloat(document.getElementById('modalHrisEmpFood').value) || 0;
    const pin = document.getElementById('modalHrisEmpPin').value.trim();

    if(!nik || !name || pin.length !== 4) return alert("NIK, Nama wajib diisi, dan PIN wajib 4 angka!");

    const btn = document.querySelector('#hrisEmployeeModal .btn-primary');
    const oldBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    try {
        // Read file inputs
        const fPhoto = document.getElementById('modalHrisEmpPhoto').files[0];
        const fFull = document.getElementById('modalHrisEmpPhotoFull').files[0];
        const fKtp = document.getElementById('modalHrisEmpKtp').files[0];
        const fSim = document.getElementById('modalHrisEmpSim').files[0];
        const fIjazah = document.getElementById('modalHrisEmpIjazah').files[0];
        
        let bPhoto = fPhoto ? await processFileHris(fPhoto) : document.getElementById('modalHrisEmpPhoto').dataset.old;
        let bFull = fFull ? await processFileHris(fFull) : document.getElementById('modalHrisEmpPhotoFull').dataset.old;
        let bKtp = fKtp ? await processFileHris(fKtp) : document.getElementById('modalHrisEmpKtp').dataset.old;
        let bSim = fSim ? await processFileHris(fSim) : document.getElementById('modalHrisEmpSim').dataset.old;
        let bIjazah = fIjazah ? await processFileHris(fIjazah) : document.getElementById('modalHrisEmpIjazah').dataset.old;

        let emps = getHrisEmployees();
        const idx = emps.findIndex(e => e.nik === nik);
        
        const newEmpData = { 
            nik, name, phone, maps, address, role, status, salary, food, pin,
            photo: bPhoto, photoFull: bFull, ktp: bKtp, sim: bSim, ijazah: bIjazah 
        };
        
        if(idx !== -1) {
            emps[idx] = newEmpData;
        } else {
            emps.push(newEmpData);
        }

        saveHrisEmployees(emps);
        closeHrisEmployeeModal();
        renderHrisEmployees();
        alert("Data Karyawan berhasil disimpan.");
    } catch (err) {
        console.error(err);
        alert("Gagal memproses file. Pastikan sistem dapat membaca file yang di-upload.");
    } finally {
        btn.innerHTML = oldBtnText;
        btn.disabled = false;
    }
};

// --- ABSENSI ---
if(document.getElementById('hrisLiveClock')) {
    setInterval(() => {
        document.getElementById('hrisLiveClock').innerText = new Date().toLocaleTimeString('id-ID');
    }, 1000);
}

window.renderHrisAttendanceTable = function() {
    let tbody = document.getElementById('hrisAttTableBody');
    if(!tbody) return;
    
    let filterDate = document.getElementById('hrisAttDateFilter').value;
    if(!filterDate) {
        filterDate = new Date().toISOString().split('T')[0];
        document.getElementById('hrisAttDateFilter').value = filterDate;
    }
    
    let logs = getHrisAttendance().filter(a => a.date === filterDate);
    
    tbody.innerHTML = logs.map(l => `
        <tr>
            <td style="text-align:left;"><strong>${l.name}</strong><br><small class="text-muted">${l.role}</small></td>
            <td><strong class="text-green">${l.in_time || '-'}</strong></td>
            <td><strong class="text-red">${l.out_time || '-'}</strong></td>
            <td>${l.out_time ? '<span class="badge bg-success">Selesai</span>' : '<span class="badge bg-warning text-dark">Bekerja</span>'}</td>
            <td><button class="btn btn-sm btn-outline text-red" onclick="deleteHrisAtt('${l.id}')"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
};

window.processHrisAttendance = function(type) {
    const nik = document.getElementById('hrisAttEmpSelect').value;
    const pin = document.getElementById('hrisAttPin').value;
    
    if(!nik || !pin) return alert("Pilih Nama dan Ketik PIN Anda!");
    
    const emp = getHrisEmployees().find(e => e.nik === nik);
    if(!emp || String(emp.pin) !== String(pin)) return alert("PIN SALAH / Akses Ditolak!");
    
    let atts = getHrisAttendance();
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    let logIdx = atts.findIndex(a => a.nik === nik && a.date === today);
    
    if(type === 'IN') {
        if(logIdx !== -1) return alert(`Anda sudah Clock IN hari ini jam ${atts[logIdx].in_time}`);
        atts.push({ id: Date.now().toString(), nik: emp.nik, name: emp.name, role: emp.role, date: today, in_time: timeNow, out_time: null });
        alert(`Sukses Clock IN jam ${timeNow}`);
    } else {
        if(logIdx === -1) return alert("Anda belum Clock IN hari ini!");
        if(atts[logIdx].out_time) return alert(`Anda sudah Clock OUT jam ${atts[logIdx].out_time}`);
        atts[logIdx].out_time = timeNow;
        alert(`Sukses Clock OUT jam ${timeNow}`);
    }
    
    document.getElementById('hrisAttPin').value = '';
    saveHrisAttendance(atts);
    renderHrisAttendanceTable();
};

window.deleteHrisAtt = function(id) {
    if(!confirm("Hapus catatan absen ini?")) return;
    saveHrisAttendance(getHrisAttendance().filter(a => a.id !== id));
    renderHrisAttendanceTable();
};

// --- CUTI & JADWAL SHIFT ---
window.renderHrisLeaveTable = function() {
    const tbody = document.getElementById('hrisLeaveTableBody');
    if(!tbody) return;
    
    const leaves = getHrisLeave();
    const emps = getHrisEmployees();
    
    tbody.innerHTML = leaves.sort((a,b) => new Date(b.startDate) - new Date(a.startDate)).map(l => {
        let emp = emps.find(e => e.nik === l.nik);
        let empName = emp ? emp.name : 'Unknown';
        let badgeColor = 'bg-primary';
        if(l.type === 'CUTI') badgeColor = 'bg-success';
        if(l.type === 'SAKIT') badgeColor = 'bg-danger';
        if(l.type === 'IZIN') badgeColor = 'bg-warning text-dark';
        if(l.type === 'LIBUR_SHIFT') badgeColor = 'bg-info bg-darken';

        return `
            <tr>
                <td><strong>${empName}</strong><br><small class="text-muted">${l.nik}</small></td>
                <td>${l.startDate}</td>
                <td>${l.endDate}</td>
                <td style="text-align:center;"><span class="badge ${badgeColor}">${l.type}</span></td>
                <td>${l.remarks}</td>
                <td style="text-align:center;">
                    <button class="btn btn-sm btn-outline text-red" onclick="deleteHrisLeave('${l.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
};

window.openHrisLeaveModal = function() {
    document.getElementById('hrisLeaveModal').classList.add('show');
    
    // Populate Employee Select
    const sel = document.getElementById('modalHrisLeaveEmp');
    sel.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + getHrisEmployees().map(e => `<option value="${e.nik}">${e.name} (${e.nik})</option>`).join('');
    
    document.getElementById('modalHrisLeaveId').value = '';
    document.getElementById('modalHrisLeaveType').value = 'CUTI';
    document.getElementById('modalHrisLeaveStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalHrisLeaveEndDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalHrisLeaveRemarks').value = '';
};

window.closeHrisLeaveModal = function() {
    document.getElementById('hrisLeaveModal').classList.remove('show');
};

window.saveHrisLeave = function() {
    const nik = document.getElementById('modalHrisLeaveEmp').value;
    const type = document.getElementById('modalHrisLeaveType').value;
    const startDate = document.getElementById('modalHrisLeaveStartDate').value;
    const endDate = document.getElementById('modalHrisLeaveEndDate').value;
    const remarks = document.getElementById('modalHrisLeaveRemarks').value;

    if(!nik || !type || !startDate || !endDate) return alert("Pilih Nama, Tipe, dan rentang tanggal dengan lengkap!");

    let leaves = getHrisLeave();
    leaves.push({
        id: 'LV' + Date.now(),
        nik, type, startDate, endDate, remarks, 
        created_at: new Date().toISOString()
    });

    saveHrisLeaveStorage(leaves);
    closeHrisLeaveModal();
    renderHrisLeaveTable();
    alert("Data Pengajuan / Jadwal berhasil disimpan!");
};

window.deleteHrisLeave = function(id) {
    if(!confirm("Yakin ingin menghapus jadwal ini?")) return;
    saveHrisLeaveStorage(getHrisLeave().filter(l => l.id !== id));
    renderHrisLeaveTable();
};

// --- KASBON ---
window.renderHrisKasbonTable = function() {
    const tbody = document.getElementById('hrisKasbonTableBody');
    if(!tbody) return;
    
    const kbs = getHrisKasbon();
    const emps = getHrisEmployees();
    
    tbody.innerHTML = kbs.sort((a,b) => new Date(b.date) - new Date(a.date)).map(k => {
        let emp = emps.find(e => e.nik === k.nik);
        let empName = emp ? emp.name : 'Unknown';
        
        // Count accumulated debt up to this date
        let curDebt = 0;
        kbs.forEach(hist => {
            if(hist.nik === k.nik && new Date(hist.date) <= new Date(k.date)) {
                if(hist.type === 'PINJAM') curDebt += hist.amount;
                if(hist.type === 'CICIL') curDebt -= hist.amount;
            }
        });
        
        let mutCol = k.type === 'PINJAM' ? `<span class="text-red">-${formatIdr(k.amount)}</span>` : `<span class="text-green">+${formatIdr(k.amount)}</span>`;
        return `
            <tr>
                <td>${k.date}</td>
                <td><strong>${empName}</strong></td>
                <td style="text-align:center;"><span class="badge ${k.type === 'PINJAM' ? 'bg-danger' : 'bg-success'}">${k.type}</span></td>
                <td>${k.desc}</td>
                <td style="text-align:right;">${mutCol}</td>
                <td style="text-align:right;">${formatIdr(Math.max(0, curDebt))}</td>
            </tr>
        `;
    }).join('');
};

window.openHrisKasbonModal = function() {
    document.getElementById('hrisKasbonModal').classList.add('show');
    const sel = document.getElementById('modalHrisKasbonEmp');
    sel.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + getHrisEmployees().map(e => `<option value="${e.nik}">${e.name} (${e.nik})</option>`).join('');
    document.getElementById('modalHrisKasbonDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalHrisKasbonType').value = 'PINJAM';
    document.getElementById('modalHrisKasbonAmount').value = '';
    document.getElementById('modalHrisKasbonDesc').value = '';
    window.updateHrisKasbonSisa();
};

window.closeHrisKasbonModal = function() { document.getElementById('hrisKasbonModal').classList.remove('show'); };

window.updateHrisKasbonSisa = function() {
    const nik = document.getElementById('modalHrisKasbonEmp').value;
    const lbl = document.getElementById('lblHrisKasbonSisa');
    if(!nik) { lbl.innerText = "Sisa Hutang: Rp 0"; return; }
    
    let sisa = 0;
    getHrisKasbon().filter(k => k.nik === nik).forEach(k => {
        if(k.type === 'PINJAM') sisa += k.amount;
        else if(k.type === 'CICIL') sisa -= k.amount;
    });
    lbl.innerText = `Sisa Hutang: ${formatIdr(sisa)}`;
    lbl.style.color = sisa > 0 ? '#ef4444' : '#10B981';
};

window.toggleHrisKasbonSource = function() {
    const type = document.getElementById('modalHrisKasbonType').value;
    const optPotong = document.getElementById('optKasbonPotongGaji');
    const sourceEl = document.getElementById('modalHrisKasbonSource');
    if(optPotong && sourceEl) {
        if(type === 'CICIL') {
            optPotong.style.display = 'block';
        } else {
            optPotong.style.display = 'none';
            if(sourceEl.value === 'POTONG_GAJI') sourceEl.value = 'TUNAI';
        }
    }
};

window.submitHrisKasbon = function() {
    const nik = document.getElementById('modalHrisKasbonEmp').value;
    const type = document.getElementById('modalHrisKasbonType').value;
    const date = document.getElementById('modalHrisKasbonDate').value;
    const nominal = parseInt(document.getElementById('modalHrisKasbonAmount').value);
    const desc = document.getElementById('modalHrisKasbonDesc').value.trim();
    
    const sourceEl = document.getElementById('modalHrisKasbonSource');
    const source = sourceEl ? sourceEl.value : 'TUNAI';

    if(!nik || !date || isNaN(nominal) || nominal <= 0) return alert("Form tidak valid!");
    
    if(type === 'PINJAM' && source === 'POTONG_GAJI') {
        return alert("Pinjaman Kasbon tidak bisa menggunakan metode Potong Gaji. Pilihan sumber dana tidak logis.");
    }

    const empName = getHrisEmployees().find(e => e.nik === nik)?.name || nik;
    const mutDesc = `${type === 'PINJAM' ? 'Pemberian' : 'Cicilan'} Kasbon - ${empName} (${desc})`;
    const currUser = typeof getCurrentUser === 'function' && getCurrentUser() ? getCurrentUser().fullName : 'Admin HRIS';

    // Proses Sinkronisasi Kas Laci / Bank
    if (source !== 'POTONG_GAJI') {
        const isBca = (source === 'BCA');
        const isMandiri = (source === 'MANDIRI');
        const isTunai = (source === 'TUNAI');
        const mutType = (type === 'PINJAM') ? 'KELUAR' : 'MASUK';
        
        if(isTunai) {
            const currentCash = getCash();
            if(type === 'PINJAM' && currentCash < nominal) {
                 if(!confirm(`Peringatan: Saldo Kas Tunai Anda (Rp ${formatIdr(currentCash)}) tidak cukup untuk Kasbon ini. Lanjutkan?`)) return;
            }
            const newCash = type === 'PINJAM' ? currentCash - nominal : currentCash + nominal;
            saveCash(newCash);
        } else {
            // Processing Bank
            const currentBank = isBca ? getBankBCA() : getBankMandiri();
            if(type === 'PINJAM' && currentBank < nominal) {
                 if(!confirm(`Peringatan: Saldo Rekening ${source} (Rp ${formatIdr(currentBank)}) terbatas. Lanjutkan?`)) return;
            }
            const newBank = type === 'PINJAM' ? currentBank - nominal : currentBank + nominal;
            if(isBca) saveBankBCA(newBank);
            if(isMandiri) saveBankMandiri(newBank);
            
            // Generate Bank Mutation Log
            let muts = typeof getMutations === 'function' ? getMutations() : [];
            muts.push({
                id_mutasi: 'MUT-' + Date.now().toString().slice(-6),
                waktu: new Date().toISOString(),
                tipe: mutType,
                bank: source,
                keterangan: mutDesc,
                nominal: nominal,
                inputBy: currUser
            });
            if(typeof saveMutations === 'function') saveMutations(muts);
        }
    }

    let kbs = getHrisKasbon();
    kbs.push({ id: Date.now().toString(), nik, type, source, date, amount: nominal, desc, inputBy: currUser });
    saveHrisKasbon(kbs);
    
    closeHrisKasbonModal();
    renderHrisKasbonTable();
    
    alert("Mutasi Kasbon berhasil dicatat dan disinkronkan dengan saldo Kas/Bank Utama!");
    if(document.getElementById('dashboard-view') && document.getElementById('dashboard-view').classList.contains('active')) loadDashboard();
    if(window.loadMutationTable) loadMutationTable();
};

// --- BPJS ---
window.renderHrisBpjsTable = function() {
    const tbody = document.getElementById('hrisBpjsTableBody');
    if(!tbody) return;
    
    const bps = getHrisBpjs();
    const emps = getHrisEmployees();
    
    tbody.innerHTML = emps.map(e => {
        let b = bps.find(x => x.nik === e.nik) || { kes: 0, tk: 0 };
        let tot = b.kes + b.tk;
        return `
            <tr>
                <td>${e.nik}</td>
                <td><strong>${e.name}</strong></td>
                <td style="text-align: right;">${formatIdr(b.kes)}</td>
                <td style="text-align: right;">${formatIdr(b.tk)}</td>
                <td style="text-align: right;"><strong class="text-red">${formatIdr(tot)}</strong></td>
            </tr>
        `;
    }).join('');
};

window.openHrisBpjsModal = function() {
    document.getElementById('hrisBpjsModal').classList.add('show');
    const sel = document.getElementById('modalHrisBpjsEmp');
    sel.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + getHrisEmployees().map(e => `<option value="${e.nik}">${e.name} (${e.nik})</option>`).join('');
    document.getElementById('modalHrisBpjsKes').value = '';
    document.getElementById('modalHrisBpjsTk').value = '';
};

window.closeHrisBpjsModal = function() { document.getElementById('hrisBpjsModal').classList.remove('show'); };

window.autoFillHrisBpjs = function() {
    const nik = document.getElementById('modalHrisBpjsEmp').value;
    if(!nik) {
        document.getElementById('modalHrisBpjsKes').value = '';
        document.getElementById('modalHrisBpjsTk').value = '';
        return;
    }
    const b = getHrisBpjs().find(x => x.nik === nik);
    if(b) {
        document.getElementById('modalHrisBpjsKes').value = b.kes || 0;
        document.getElementById('modalHrisBpjsTk').value = b.tk || 0;
    } else {
        const emp = getHrisEmployees().find(x => x.nik === nik);
        if(emp) {
            // Est. otomatis 1% Kes, 2% TK dari gaji pokok
            document.getElementById('modalHrisBpjsKes').value = Math.floor(emp.salary * 0.01);
            document.getElementById('modalHrisBpjsTk').value = Math.floor(emp.salary * 0.02);
        }
    }
};

window.processHrisBpjs = function() {
    const nik = document.getElementById('modalHrisBpjsEmp').value;
    const kes = parseInt(document.getElementById('modalHrisBpjsKes').value) || 0;
    const tk = parseInt(document.getElementById('modalHrisBpjsTk').value) || 0;
    
    if(!nik) return alert("Pilih Karyawan!");
    
    let bps = getHrisBpjs();
    let idx = bps.findIndex(x => x.nik === nik);
    if(idx !== -1) {
        bps[idx].kes = kes;
        bps[idx].tk = tk;
    } else {
        bps.push({ nik, kes, tk });
    }
    
    saveHrisBpjs(bps);
    closeHrisBpjsModal();
    renderHrisBpjsTable();
    alert("Data Potongan BPJS Tersimpan!");
};


// --- PENGGAJIAN (PAYROLL) ---
window.generateHrisPayroll = function() {
    const nik = document.getElementById('hrisPayrollEmp').value;
    const mm = document.getElementById('hrisPayrollMonth').value; // format "YYYY-MM"
    if(!nik || !mm) return alert("Pilih Karyawan dan Bulan!");
    
    const emp = getHrisEmployees().find(e => e.nik === nik);
    if(!emp) return;

    // Hitung Absensi bulan tsb (yang Clock In)
    const atts = getHrisAttendance().filter(a => a.nik === nik && a.date.startsWith(mm) && a.in_time);
    const dayCount = atts.length;
    
    // Gaji Pokok & Uang Makan (Total Hari Masuk * Uang Makan Harian)
    const basicPay = emp.salary || 0;
    const foodTotal = dayCount * (emp.food || 0);
    
    // Potongan Kasbon yg terecord 'CICIL' di bulan tsb untuk bayar hutang lewat potong gaji
    let kasbonDeduction = 0;
    getHrisKasbon().filter(k => k.nik === nik && k.type === 'CICIL' && k.date.startsWith(mm) && k.desc.toLowerCase().includes('potong gaji')).forEach(k => {
        kasbonDeduction += k.amount;
    });

    // BPJS Deduction
    const bpjs = getHrisBpjs().find(b => b.nik === nik) || { kes: 0, tk: 0 };
    const bpjsDeduction = bpjs.kes + bpjs.tk;

    const thp = basicPay + foodTotal - kasbonDeduction - bpjsDeduction;

    document.getElementById('lblPayTitle').innerText = "(Periode " + mm + ")";
    document.getElementById('lblPayName').innerText = emp.name;
    document.getElementById('lblPayRole').innerText = emp.role;
    document.getElementById('lblPayDays').innerText = dayCount + " Hari Absen";

    document.getElementById('valPayBasic').innerText = formatIdr(basicPay);
    document.getElementById('valPayFood').innerText = formatIdr(foodTotal);
    document.getElementById('valPayKasbon').innerText = formatIdr(kasbonDeduction);
    
    // Add BPJS element dynamically or statically in HTML if we replace HTML too
    let bpjsTr = document.getElementById('trPayBpjs');
    if(bpjsTr) {
        document.getElementById('valPayBpjs').innerText = formatIdr(bpjsDeduction);
    } else {
        // create element if not exist since we modify dynamically
        const tbody = document.querySelector('#valPayTotal').closest('tbody');
        const newTr = document.createElement('tr');
        newTr.id = 'trPayBpjs';
        newTr.innerHTML = `<td>(-) Potongan BPJS (Kes & TK)</td><td style="text-align: right; color: #ef4444;" id="valPayBpjs">${formatIdr(bpjsDeduction)}</td>`;
        tbody.insertBefore(newTr, tbody.lastElementChild);
    }
    
    document.getElementById('valPayTotal').innerText = formatIdr(thp);

    const resBox = document.getElementById('hrisPayrollResult');
    resBox.style.display = 'block';
    resBox.classList.remove('hidden');
};

window.openGlobalImagePreview = function(src) {
    if(!src) return;
    document.getElementById('globalLightboxImg').src = src;
    document.getElementById('globalImageLightbox').classList.add('show');
};

window.toggleEntitas = function() {
    const radios = document.getElementsByName('modalCustTypeGroup');
    let selected = '';
    for(let r of radios) {
        if(r.checked) {
            selected = r.value;
            break;
        }
    }
    document.getElementById('modalCustType').value = selected;
    if(typeof generateCif === 'function' && !window.isEditingCustomer) generateCif();
    
    // Fields to enable
    const formFields = ['modalCustName', 'modalCustBirthPlace', 'modalCustBirthDate', 
                        'modalCustAddress', 'modalCustGender', 'modalCustCitizen', 
                        'modalCustJob', 'modalCustPhone', 'modalCustBankAcc', 
                        'modalCustNpwp', 'modalCustPhoto'];
    
    const selIdType = document.getElementById('modalCustIdType');
    if(selected === '1' || selected === '2') {
        formFields.forEach(f => {
            const el = document.getElementById(f);
            if(el) el.disabled = false;
        });
        
        if(selected === '1') {
            selIdType.disabled = false;
            selIdType.innerHTML = `
                <option value="">Pilih Jenis Identitas</option>
                <option value="KTP">KTP</option>
                <option value="SIM">SIM</option>
                <option value="PASSPORT">PASSPORT</option>
                <option value="KITAS">KITAS</option>
            `;
        } else if(selected === '2') {
            selIdType.disabled = false;
            selIdType.innerHTML = `
                <option value="SERTIFIKAT">SERTIFIKAT</option>
            `;
        }
    } else {
        formFields.forEach(f => {
            const el = document.getElementById(f);
            if(el) el.disabled = true;
        });
        
        selIdType.disabled = true;
        selIdType.innerHTML = '<option value="">Sentuh Tipe Entitas Terlebih Dahulu!</option>';
    }
    
    window.toggleCustPassportPlaceholder();
};

window.toggleCustPassportPlaceholder = function() {
    const type = document.getElementById('modalCustIdType').value;
    const input = document.getElementById('modalCustPassport');
    if(type) {
        input.disabled = false;
        input.placeholder = "Ketik Nomor " + type;
    } else {
        input.disabled = true;
        input.placeholder = "Pilih Jenis Identitas Dahulu";
        input.value = '';
    }
};

// ==============================
// BOOKING LOGIC
// ==============================
window.loadBookingsTable = function() {
    const trxs = getTransactions();
    const customers = getCustomers();
    const tbody = document.getElementById('bookingsTableBody');
    if(!tbody) return;

    // Filter by PENDING status
    const pendingBookings = trxs.filter(t => t.status === 'PENDING');
    
    const searchInput = document.getElementById('searchBookingInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // Group by ID
    const grouped = pendingBookings.reduce((acc, current) => {
        if (!acc[current.id]) {
            acc[current.id] = [];
        }
        acc[current.id].push(current);
        return acc;
    }, {});

    const matchedKeys = Object.keys(grouped).filter(k => {
        const baseTrx = grouped[k][0];
        const customer = customers.find(c => c.internal_id === baseTrx.customerId);
        const custName = customer ? customer.name : (baseTrx.customerId ? baseTrx.customerId : 'Pengunjung Biasa');
        const custPhone = customer ? (customer.phone || '') : '';
        
        return k.toLowerCase().includes(searchTerm) || 
               custName.toLowerCase().includes(searchTerm) || 
               custPhone.toLowerCase().includes(searchTerm);
    });

    let html = '';
    
    if (Object.keys(grouped).length === 0) {
        html = '<tr><td colspan="8" class="text-center">Tidak ada booking aktif / semua sudah lunas.</td></tr>';
    } else if (matchedKeys.length === 0) {
        html = '<tr><td colspan="8" class="text-center">Pencarian tidak menemukan data.</td></tr>';
    } else {
        matchedKeys.forEach(k => {
            const grp = grouped[k];
            const baseTrx = grp[0];
            
            let valasSummary = '';
            let totalIdr = 0;
            grp.forEach(t => {
                let sign = t.tipe === 'JUAL' ? 1 : -1;
                totalIdr += (t.total * sign);
                valasSummary += `<div>${t.tipe === 'JUAL' ? 'Keluarkan' : 'Terima'} <span class="text-green">${t.nominal.toLocaleString()}</span> ${t.valuta}</div>`;
            });
            
            const dp = baseTrx.dpAmount || 0;
            const remaining = baseTrx.remainingAmount || 0;
            
            const customer = customers.find(c => c.internal_id === baseTrx.customerId);
            let custName = customer ? customer.name : (baseTrx.customerId ? baseTrx.customerId : 'Pengunjung Biasa');
            let custPhoneHtml = customer && customer.phone ? `<br><small class="text-muted"><i class="fa-solid fa-phone"></i> ${customer.phone}</small>` : '';
            
            html += `<tr>
                <td>${window.formatDateToDMY(baseTrx.timestamp)}</td>
                <td><strong>${baseTrx.id}</strong></td>
                <td>${custName} ${custPhoneHtml}</td>
                <td>${valasSummary}</td>
                <td style="text-align: right;">${formatIdr(Math.abs(totalIdr))}</td>
                <td style="text-align: right; color:#10B981;">${formatIdr(dp)}</td>
                <td style="text-align: right; color:#F87171; font-weight: bold;">${formatIdr(remaining)}</td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-primary" onclick="settleBooking('${baseTrx.id}', ${remaining}, ${dp})"><i class="fa-solid fa-check-double"></i> Lunasi</button>
                    <button class="btn btn-sm btn-danger mt-1" onclick="cancelBooking('${baseTrx.id}')"><i class="fa-solid fa-xmark"></i> Batal</button>
                </td>
            </tr>`;
        });
    }
    
    tbody.innerHTML = html;
};

window.settleBooking = function(trxId, remainingIdr, dpAwal) {
    Swal.fire({
        title: 'Pelunasan Booking',
        html: `Menyelesaikan booking <b>${trxId}</b>.<br><br>
               Nominal sisa yang harus dibayar Nasabah: <h3 class="text-red mt-2">${formatIdr(remainingIdr)}</h3>
               <br>
               Pilih metode masuknya sisa pelunasan:
               <select id="settleMethod" class="swal2-input" style="width: 80%; font-size:16px;">
                   <option value="CASH">Masuk Kas / Tunai</option>
                   <option value="BCA">Transfer (BCA)</option>
                   <option value="MANDIRI">Transfer (Mandiri)</option>
                   <option value="SPLIT">Split (Tunai + Transfer)</option>
               </select>
               <div id="settleSplitContainer" style="display:none; margin-top:20px; text-align:left; background: rgba(30, 41, 59, 0.5); padding: 10px; border-radius: 8px;">
                   <label style="font-size: 14px; color: #94A3B8;">Nominal Tunai Masuk:</label>
                   <input type="number" id="settleSplitCash" class="swal2-input" style="width:90%; height:40px; font-size:14px; margin-top: 5px; margin-bottom:10px;" placeholder="0">
                   <label style="font-size: 14px; color: #94A3B8;">Nominal Transfer Masuk:</label>
                   <input type="number" id="settleSplitTransfer" class="swal2-input" style="width:90%; height:40px; font-size:14px; margin-top: 5px; margin-bottom:10px;" placeholder="0">
                   <label style="font-size: 14px; color: #94A3B8;">Bank Tujuan Transfer:</label>
                   <select id="settleSplitBank" class="swal2-input" style="width:90%; height:40px; font-size:14px; margin-top: 5px;">
                       <option value="BCA">BCA</option>
                       <option value="MANDIRI">Mandiri</option>
                   </select>
               </div>`,
        showCancelButton: true,
        confirmButtonText: 'Terima & Lunasi',
        cancelButtonText: 'Tutup',
        background: '#1e293b',
        color: '#f8fafc',
        didOpen: () => {
            const sel = document.getElementById('settleMethod');
            const cInput = document.getElementById('settleSplitCash');
            const tInput = document.getElementById('settleSplitTransfer');
            sel.addEventListener('change', (e) => {
                if(e.target.value === 'SPLIT') {
                    document.getElementById('settleSplitContainer').style.display = 'block';
                } else {
                    document.getElementById('settleSplitContainer').style.display = 'none';
                }
            });
            cInput.addEventListener('input', function() {
                let c = parseFloat(this.value) || 0;
                if(c > remainingIdr) { this.value = remainingIdr; c = remainingIdr; }
                tInput.value = remainingIdr - c;
            });
            tInput.addEventListener('input', function() {
                let t = parseFloat(this.value) || 0;
                if(t > remainingIdr) { this.value = remainingIdr; t = remainingIdr; }
                cInput.value = remainingIdr - t;
            });
        },
        preConfirm: () => {
            const method = document.getElementById('settleMethod').value;
            if (method === 'SPLIT') {
                const c = parseFloat(document.getElementById('settleSplitCash').value) || 0;
                const t = parseFloat(document.getElementById('settleSplitTransfer').value) || 0;
                const b = document.getElementById('settleSplitBank').value;
                if (Math.abs((c + t) - remainingIdr) > 1) {
                    Swal.showValidationMessage('Total Tunai + Transfer harus sama dengan Sisa Tagihan!');
                    return false;
                }
                return { method: 'SPLIT', cashVal: c, transferVal: t, bankTgt: b };
            }
            return { method: method };
        }
    }).then((result) => {
        if(result.isConfirmed) {
            const data = result.value;
            const method = data.method;
            let cash = getCash();
            let bca = getBankBCA();
            let mandiri = getBankMandiri();
            
            if (remainingIdr > 0) {
                if (method === 'CASH') {
                    cash += remainingIdr;
                } else if (method === 'BCA') {
                    bca += remainingIdr;
                } else if (method === 'MANDIRI') {
                    mandiri += remainingIdr;
                } else if (method === 'SPLIT') {
                    cash += data.cashVal;
                    if(data.bankTgt === 'BCA') bca += data.transferVal;
                    else mandiri += data.transferVal;
                }
                
                saveCash(cash);
                saveBankBCA(bca);
                saveBankMandiri(mandiri);
                
                let mutations = getMutations();
                const ts = new Date().toISOString();
                
                if(method === 'BCA' || method === 'MANDIRI') {
                    mutations.push({
                        id_mutasi: 'MUT-' + Date.now().toString().slice(-6),
                        timestamp: ts,
                        tipe: 'MASUK',
                        nominal: remainingIdr,
                        keterangan: `Sisa Pelunasan Booking (Ref: ${trxId})`,
                        bank: method
                    });
                } else if (method === 'SPLIT' && data.transferVal > 0) {
                    mutations.push({
                        id_mutasi: 'MUT-' + Date.now().toString().slice(-6),
                        timestamp: ts,
                        tipe: 'MASUK',
                        nominal: data.transferVal,
                        keterangan: `Sisa Pelunasan Booking Split (Ref: ${trxId})`,
                        bank: data.bankTgt
                    });
                }
                saveMutations(mutations);
            }
            
            // Re-update the transactions
            let trxs = getTransactions();
            let affected = false;
            
            trxs.forEach(t => {
                if(t.id === trxId) {
                    t.status = 'LUNAS';
                    t.dpAmount = (t.dpAmount || 0) + remainingIdr; // total finally
                    t.remainingAmount = 0;
                    t.paymentMethod = method === 'CASH' ? 'TUNAI (PELUNASAN DP)' : (method === 'SPLIT' ? 'SPLIT (PELUNASAN)' : 'TRANSFER');
                    if (method === 'BCA' || method === 'MANDIRI') t.bank = method;
                    if (method === 'SPLIT') t.bank = data.bankTgt;
                    affected = true;
                }
            });
            
            if(affected) {
                saveTransactions(trxs);
                Swal.fire({icon:'success', title:'Lunas!', text:'Transaksi telah dilunaskan.'});
                loadBookingsTable();
            }
        }
    });
};

window.cancelBooking = function(trxId) {
    Swal.fire({
        title: 'Batalkan Booking?',
        text: 'Ini akan mengembalikan stok valas ke brankas/ sistem. Data uang masuk DP tidak otomatis dihapus namun transaksi ini dinonaktifkan.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Batalkan',
        cancelButtonText: 'Tidak'
    }).then(result => {
        if(result.isConfirmed) {
            let trxs = getTransactions();
            let currencies = getCurrencies();
            
            trxs.forEach(t => {
                 if(t.id === trxId) {
                     t.status = 'CANCELLED';
                     // Return stock
                     const cIdx = currencies.findIndex(c => c.code === t.valuta);
                     if(cIdx > -1) {
                         if(t.tipe === 'JUAL') {
                             currencies[cIdx].stock += t.nominal; // kembalikan valas ke kas MC
                         } else {
                             currencies[cIdx].stock -= t.nominal;
                         }
                     }
                 }
            });
            
            saveTransactions(trxs);
            saveCurrencies(currencies);
            Swal.fire({icon:'success', title:'Dibatalkan!', text:'Reservasi dihapus dan stok telah dilepas.'});
            loadBookingsTable();
            if(typeof loadStockMonitor === 'function') loadStockMonitor();
        }
    });
};

// ==============================
// INVESTOR & DIVIDEND MANAGEMENT
// ==============================

function getInvestors() {
    return window.safeArrayGet('mc_investors');
}

function saveInvestors(data) {
    localStorage.setItem('mc_investors', JSON.stringify(data));
    if(typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_investors', data);
}

function switchInvestorTab(tab) {
    document.querySelectorAll('.tabInvMode').forEach(el => {
        el.style.fontWeight = 'normal';
        el.style.color = '#94A3B8';
        el.style.borderBottom = '2px solid transparent';
    });
    const cList = document.getElementById('investorListContainer');
    const cDiv = document.getElementById('investorDividendContainer');
    if(tab === 'list') {
        document.getElementById('tabInvList').style.fontWeight = 'bold';
        document.getElementById('tabInvList').style.color = '#f8fafc';
        document.getElementById('tabInvList').style.borderBottom = '2px solid #3b82f6';
        cList.style.display = 'block';
        cList.classList.remove('hidden');
        if(cDiv) {
            cDiv.style.display = 'none';
            cDiv.classList.add('hidden');
        }
        loadInvestorTable();
    } else {
        document.getElementById('tabInvDiv').style.fontWeight = 'bold';
        document.getElementById('tabInvDiv').style.color = '#f8fafc';
        document.getElementById('tabInvDiv').style.borderBottom = '2px solid #3b82f6';
        cList.style.display = 'none';
        cList.classList.add('hidden');
        if(cDiv) {
            cDiv.style.display = 'block';
            cDiv.classList.remove('hidden');
        }
        document.getElementById('dividendMonthInput').value = new Date().toISOString().substring(0,7);
        simulateDividend();
    }
}

function loadInvestorTable() {
    const invs = getInvestors();
    const tbody = document.getElementById('investorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let totalCap = 0;
    let totalPerc = 0;
    
    invs.forEach(c => {
        const capital = parseFloat(c.modal) || 0;
        const perc = parseFloat(c.persentase) || 0;
        totalCap += capital;
        totalPerc += perc;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.id_investor}</strong></td>
            <td>${c.nama}</td>
            <td>${c.kontak || '-'}</td>
            <td class="text-end">${formatIdr(capital)}</td>
            <td class="text-center">${perc}%</td>
            <td>${c.tgl_gabung || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn btn-sm btn-primary mx-1" onclick="openInvestorModal('${c.id_investor}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-danger mx-1" onclick="deleteInvestor('${c.id_investor}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if(invs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada data investor.</td></tr>';
    }
    
    document.getElementById('invTotalModal').innerText = formatIdr(totalCap);
    document.getElementById('invTotalPercent').innerText = totalPerc.toFixed(2) + '%';
    
    // Add warning if over 100%
    if(totalPerc > 100) {
        document.getElementById('invTotalPercent').style.color = '#ef4444';
        document.getElementById('invTotalPercent').title = "Peringatan: Total lebih dari 100%!";
    } else {
        document.getElementById('invTotalPercent').style.color = '#38bdf8';
    }
}

window.openInvestorModal = function(id = null) {
    document.getElementById('investorModal').classList.add('show');
    if(id) {
        document.getElementById('investorModalTitle').textContent = "Edit Data Investor";
        const c = getInvestors().find(x => x.id_investor === id);
        if(c) {
            document.getElementById('modalInvId').value = c.id_investor;
            document.getElementById('modalInvName').value = c.nama || '';
            document.getElementById('modalInvContact').value = c.kontak || '';
            document.getElementById('modalInvCapital').value = c.modal ? formatIdr(c.modal).replace('Rp ', '') : '';
            document.getElementById('modalInvPercent').value = c.persentase || '';
            document.getElementById('modalInvJoinDate').value = c.tgl_gabung || '';
        }
    } else {
        document.getElementById('investorModalTitle').textContent = "Tambah Investor Baru";
        document.getElementById('modalInvId').value = '';
        document.getElementById('modalInvName').value = '';
        document.getElementById('modalInvContact').value = '';
        document.getElementById('modalInvCapital').value = '';
        document.getElementById('modalInvPercent').value = '';
        document.getElementById('modalInvJoinDate').value = new Date().toISOString().split('T')[0];
    }
};

window.closeInvestorModal = function() {
    document.getElementById('investorModal').classList.remove('show');
};

window.saveInvestor = function() {
    let id = document.getElementById('modalInvId').value;
    const name = document.getElementById('modalInvName').value;
    const contact = document.getElementById('modalInvContact').value;
    const rawCapital = document.getElementById('modalInvCapital').value.replace(/[^0-9]/g, '');
    const capital = parseFloat(rawCapital) || 0;
    const percent = parseFloat(document.getElementById('modalInvPercent').value) || 0;
    const joinDate = document.getElementById('modalInvJoinDate').value;

    if(!name) return alert("Nama investor wajib diisi!");

    const invs = getInvestors();
    
    if(!id) {
        let count = 0;
        invs.forEach(c => {
            if (c.id_investor && c.id_investor.startsWith('INV-')) {
                let parts = c.id_investor.split('-');
                if (parts.length > 1) {
                    let num = parseInt(parts[1], 10);
                    if (!isNaN(num) && num > count) count = num;
                }
            }
        });
        id = 'INV-' + (count + 1).toString().padStart(3, '0');
        
        invs.push({
            id_investor: id,
            nama: name,
            kontak: contact,
            modal: capital,
            persentase: percent,
            tgl_gabung: joinDate
        });
    } else {
        const index = invs.findIndex(c => c.id_investor === id);
        if(index > -1) {
            invs[index].nama = name;
            invs[index].kontak = contact;
            invs[index].modal = capital;
            invs[index].persentase = percent;
            invs[index].tgl_gabung = joinDate;
        }
    }
    
    saveInvestors(invs);
    closeInvestorModal();
    loadInvestorTable();
};

window.deleteInvestor = function(id) {
    if(!confirm("Yakin ingin menghapus investor ini?")) return;
    let invs = getInvestors();
    invs = invs.filter(c => c.id_investor !== id);
    saveInvestors(invs);
    loadInvestorTable();
};

// Function to estimate Net Profit for a specific month (format: YYYY-MM) directly without triggering LabaRugi Table
function estimateNetProfit(monthStr) {
    if(!monthStr) return 0;
    
    const trxs = getTransactions();
    const exps = getExpenses();
    const currencies = getCurrencies();
    
    let margin = 0;
    let totalBebanOp = 0;
    let totalPendapatanNonOp = 0;
    let d25 = 0;
    
    trxs.forEach(t => {
        let tDate = t.timestamp ? t.timestamp.substring(0,7) : '';
        if(tDate === monthStr) {
            const curData = currencies.find(c => c.code === t.valuta);
            if(curData) {
                const midRate = (parseFloat(curData.buy) + parseFloat(curData.sell)) / 2;
                if(t.tipe === 'JUAL') margin += (parseFloat(t.rate) - midRate) * parseFloat(t.nominal);
                else margin += (midRate - parseFloat(t.rate)) * parseFloat(t.nominal);
            }
        }
    });
    
    exps.forEach(e => {
        let eDate = e.timestamp ? e.timestamp.substring(0,7) : '';
        if(eDate === monthStr) {
            let catStr = e.kategori ? e.kategori.substring(0,2) : '';
            if(e.tipe === 'KELUAR') {
                if(catStr === '25') d25 += parseFloat(e.nominal);
                else if(catStr >= '07' && catStr <= '15') totalBebanOp += parseFloat(e.nominal);
                else if(!catStr) totalBebanOp += parseFloat(e.nominal); // fallback if no category
            } else if(e.tipe === 'PENDAPATAN' || e.tipe === 'MASUK') {
                if(catStr >= '16' && catStr <= '24') {
                    totalPendapatanNonOp += parseFloat(e.nominal);
                } else if(!catStr) totalPendapatanNonOp += parseFloat(e.nominal);
            }
        }
    });

    let labaSelisihKurs = margin > 0 ? margin : 0;
    let rugiSelisihKurs = margin < 0 ? Math.abs(margin) : 0;
    
    let labaKotor = labaSelisihKurs + totalPendapatanNonOp;
    let totalBeban = totalBebanOp + rugiSelisihKurs;

    let labaSebelumPajak = labaKotor - totalBeban;
    let labaBersih = labaSebelumPajak - d25;
    
    return labaBersih;
}

window.simulateDividend = function() {
    const monthStr = document.getElementById('dividendMonthInput').value;
    const methodStr = document.getElementById('dividendMethodInput')?.value || 'net_profit';
    const tbody = document.getElementById('dividendSimulationBody');
    if(!monthStr) {
        document.getElementById('dividendNetProfit').innerText = 'Rp 0';
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Silahkan pilih bulan untuk simulasi pembagian laba.</td></tr>';
        document.getElementById('divTotalDistributed').innerText = 'Rp 0';
        document.getElementById('divTotalRetained').innerText = 'Rp 0';
        return;
    }
    
    const netProfit = estimateNetProfit(monthStr);
    const posProfit = netProfit > 0 ? netProfit : 0;
    
    document.getElementById('dividendNetProfit').innerText = formatIdr(netProfit);
    if(netProfit < 0) {
        document.getElementById('dividendNetProfit').style.color = '#ef4444';
        document.getElementById('dividendNetProfit').innerText += " (Rugi)";
    } else {
        document.getElementById('dividendNetProfit').style.color = '#10b981';
    }
    
    const invs = getInvestors();
    tbody.innerHTML = '';
    let totalDistributed = 0;
    
    if(invs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada investor untuk dibagikan.</td></tr>';
    } else {
        invs.forEach(inv => {
            const perc = parseFloat(inv.persentase) || 0;
            const cap = parseFloat(inv.modal) || 0;
            
            let amount = 0;
            let ket = '';
            if(methodStr === 'net_profit') {
                amount = (perc / 100) * posProfit;
                ket = `<small class="text-xs text-muted" style="display:block;">${perc}% - Laba Bersih</small>`;
            } else {
                amount = (perc / 100) * cap;
                ket = `<small class="text-xs text-muted" style="display:block;">${perc}% - ${formatIdr(cap)}</small>`;
            }
            
            totalDistributed += amount;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${inv.nama}</strong><br><small class="text-muted">ID: ${inv.id_investor}</small></td>
                <td class="text-center">${perc}%</td>
                <td class="text-end text-green font-weight-bold">
                    ${formatIdr(amount)}
                    ${ket}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    document.getElementById('divTotalDistributed').innerText = formatIdr(totalDistributed);
    
    if(methodStr === 'net_profit') {
        document.getElementById('divTotalRetained').innerText = formatIdr(posProfit - totalDistributed);
    } else {
        let selisih = posProfit - totalDistributed;
        if(selisih < 0) {
            document.getElementById('divTotalRetained').innerHTML = `<span class="text-red">Minus / Perusahaan Nomboh: ${formatIdr(Math.abs(selisih))}</span>`;
        } else {
            document.getElementById('divTotalRetained').innerText = formatIdr(selisih);
        }
    }
};



// ====== AUDIT INTERNAL MODULE ======
let globalAuditData = [];

async function loadAuditTable() {
    try {
        const response = await fetch('api/audit');
        if (!response.ok) throw new Error("Gagal mengambil data dari Server");
        
        const data = await response.json();
        
        // Setup Valuta Dropdown dynamically
        const valutaS = document.getElementById('filterAuditValuta');
        if (valutaS) {
            const currs = getCurrencies();
            if (currs.length > 0) {
                let html = '<option value="">-- Semua --</option>';
                currs.forEach(c => html += `<option value="${c.code}">${c.code}</option>`);
                valutaS.innerHTML = html;
            }
        }

        globalAuditData = data;
        filterAuditTable(); // Render with current filters
    } catch (error) {
        console.error('Error fetching audit data:', error);
        // Fallback to local for safety if server fails
        let dataStr = localStorage.getItem('mc_transactions');
        if (dataStr) {
            let data = JSON.parse(dataStr);
            data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            globalAuditData = data;
            filterAuditTable();
        }
    }
}

function renderAuditTable(data) {
    const tbody = document.getElementById('auditTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Belum ada riwayat audit.</td></tr>';
        return;
    }
    
    data.forEach(trx => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${trx.timestamp || '-'}</td>
            <td>${trx.id || '-'} / <br><small class="text-muted">${trx.itemId || '-'}</small></td>
            <td><span class="badge ${trx.tipe === 'BELI' ? 'bg-success' : 'bg-primary'}">${trx.tipe || '-'}</span></td>
            <td>${trx.customerName || '-'}</td>
            <td>${trx.valuta || '-'}</td>
            <td><small>${trx.keterangan || '-'}</small></td>
            <td class="text-end">${formatRp(trx.nominal || 0)}</td>
            <td class="text-end">${formatRp(trx.rate || 0)}</td>
            <td class="text-end font-bold">Rp ${formatRp(trx.total || 0)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterAuditTable() {
    // Setup Valuta Dropdown dynamically for Audit
    const valutaS = document.getElementById('filterAuditValuta');
    if (valutaS && valutaS.options.length <= 1) {
        const currs = getCurrencies();
        let html = '<option value="">-- Semua --</option>';
        currs.forEach(c => html += `<option value="${c.code}">${c.code}</option>`);
        valutaS.innerHTML = html;
    }

    const filterInvoice = document.getElementById('filterAuditInvoice') ? document.getElementById('filterAuditInvoice').value.toLowerCase().trim() : '';
    const filterNama    = document.getElementById('filterAuditNama') ? document.getElementById('filterAuditNama').value.toLowerCase().trim() : '';
    const filterHp      = document.getElementById('filterAuditHp') ? document.getElementById('filterAuditHp').value.toLowerCase().trim() : '';
    const filterValuta  = document.getElementById('filterAuditValuta') ? document.getElementById('filterAuditValuta').value : '';
    const filterTipe    = document.getElementById('filterAuditTipe') ? document.getElementById('filterAuditTipe').value : '';
    const startStr      = document.getElementById('auditStartDate') ? document.getElementById('auditStartDate').value : '';
    const endStr        = document.getElementById('auditEndDate') ? document.getElementById('auditEndDate').value : '';

    let filtered = globalAuditData;
    const allCustomers = getCustomers();

    if(startStr && endStr) {
        filtered = filtered.filter(t => {
            const date = t.timestamp.split(' ')[0]; // Laravel format Y-m-d H:i:s
            return date >= startStr && date <= endStr;
        });
    }

    if(filterInvoice) {
        filtered = filtered.filter(t => (t.id || '').toLowerCase().includes(filterInvoice));
    }

    if(filterNama || filterHp) {
        filtered = filtered.filter(t => {
            const customerId = t.id_cif || t.customerId;
            if(!customerId || customerId === '-') return false;
            const cObj = allCustomers.find(c => c.id_nasabah === customerId);
            if(!cObj) return false;
            
            let matchNama = true;
            let matchHp = true;
            
            if(filterNama) {
                matchNama = cObj.nama && cObj.nama.toLowerCase().includes(filterNama);
            }
            if(filterHp) {
                matchHp = cObj.no_hp && cObj.no_hp.toLowerCase().includes(filterHp);
            }
            
            return matchNama && matchHp;
        });
    }

    if(filterValuta) {
        filtered = filtered.filter(t => t.valuta === filterValuta);
    }

    if(filterTipe) {
        filtered = filtered.filter(t => t.tipe === filterTipe);
    }

    renderAuditTable(filtered);
}

// Add hook to view change
document.addEventListener('click', (e) => {
    let target = e.target.closest('.nav-item');
    if(target && target.getAttribute('data-target') === 'audit-view') {
        loadAuditTable();
    }
    if(target && target.getAttribute('data-target') === 'laporan-lku-view') {
        if(typeof loadLaporanLku === 'function') loadLaporanLku();
    }
});

// RESET FILTER FUNCTIONS
window.resetReportFilter = function() {
    ['filterInvoice', 'filterNama', 'filterHp', 'reportStartDate', 'reportEndDate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const valutaS = document.getElementById('filterValuta');
    if(valutaS) valutaS.selectedIndex = 0;
    const tipeS = document.getElementById('filterTipe');
    if(tipeS) tipeS.selectedIndex = 0;
    
    loadReportsTable();
};

window.resetAuditFilter = function() {
    ['filterAuditInvoice', 'filterAuditNama', 'filterAuditHp', 'auditStartDate', 'auditEndDate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const valutaS = document.getElementById('filterAuditValuta');
    if(valutaS) valutaS.selectedIndex = 0;
    const tipeS = document.getElementById('filterAuditTipe');
    if(tipeS) tipeS.selectedIndex = 0;
    
    filterAuditTable();
};

window.deleteAllTransactions = function() {
    if(typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'PERINGATAN KERAS!',
            text: "Anda akan menghapus SEMUA data transaksi riwayat (Buku Besar). Hanya Audit Log yang akan menyimpan data aslinya. Aksi ini tidak bisa dibatalkan!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#3b82f6',
            confirmButtonText: 'Ya, Hapus Semua',
            cancelButtonText: 'Batal',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'Konfirmasi Terakhir',
                    input: 'text',
                    inputLabel: 'Ketik "HAPUS" untuk melanjutkan',
                    inputPlaceholder: 'HAPUS',
                    showCancelButton: true,
                    inputValidator: (value) => {
                        if (value !== 'HAPUS') {
                            return 'Ketik "HAPUS" dengan huruf besar!';
                        }
                    }
                }).then((final) => {
                     if (final.isConfirmed) {
                         localStorage.removeItem('mc_transactions');
                         if(typeof saveTransactions === 'function') saveTransactions([]);
                         Swal.fire('Terhapus!', 'Semua riwayat transaksi telah dihapus.', 'success');
                         if(typeof loadReportsTable === 'function') loadReportsTable();
                     }
                });
            }
        });
    } else {
        if(confirm("Anda akan menghapus SEMUA data transaksi (Buku Besar). Aksi ini permanen. Lanjutkan?")) {
            let chk = prompt("Ketik HAPUS untuk melanjutkan:");
            if(chk === 'HAPUS') {
                localStorage.removeItem('mc_transactions');
                if(typeof saveTransactions === 'function') saveTransactions([]);
                alert("Semua riwayat transaksi dihapus.");
                if(typeof loadReportsTable === 'function') loadReportsTable();
            }
        }
    }
};

// ==========================================
// LAPORAN KEUANGAN & AKUNTANSI ENGINE
// ==========================================


function getFinancialEpoch(dateStr, isEnd) {
    if(!dateStr) return null;
    let parts = dateStr.split('-');
    if(parts.length === 3) {
        let d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        if(isEnd) d.setHours(23,59,59,999);
        else d.setHours(0,0,0,0);
        return d.getTime();
    }
    return null;
}

function getStockSnapshot(epochLimit) {
    try {
        let rawTrxs = getTransactions() || [];
        let trxs = rawTrxs.filter(x => x && x.date).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let inventory = {};
    
    for(let t of trxs) {
        let tEpoch = new Date(t.date).getTime();
        if(epochLimit !== null && tEpoch > epochLimit) break;
        
        let c = t.valuta;
        if(!c) continue;
        if(!inventory[c]) inventory[c] = { qty: 0, totalCost: 0 };
        
        let qty = parseFloat(t.amount) || 0;
        let rp = parseFloat(t.totalIDR) || (qty * parseFloat(t.rate || 0));
        
        if(t.type === 'BELI') {
            inventory[c].qty += qty;
            inventory[c].totalCost += rp;
        } else if(t.type === 'JUAL') {
            let avgPrice = inventory[c].qty > 0 ? (inventory[c].totalCost / inventory[c].qty) : 0;
            inventory[c].qty -= qty;
            inventory[c].totalCost -= (qty * avgPrice);
            if(inventory[c].qty < 0) inventory[c].qty = 0;
            if(inventory[c].totalCost < 0) inventory[c].totalCost = 0;
        }
    }
    
    let totalRpValue = 0;
    for(let k in inventory) {
        if(inventory[k].qty > 0) totalRpValue += inventory[k].totalCost;
    }
    return totalRpValue;
    } catch(err) {
        console.error("Snapshot Error:", err);
        return 0;
    }
}

function calculateFinancialPillars(epochLimit) {
    try {
        let rawTrxs = getTransactions() || [];
        let trxs = rawTrxs.filter(x => x && x.date);
        let rawExps = typeof getExpenses === 'function' ? getExpenses() : [];
        let exps = rawExps.filter(x => x && x.date);
        let rawInvs = typeof getInvestors === 'function' ? getInvestors() : [];
        let invs = rawInvs.filter(x => x);
        
        let modalDisetor = 0;
        for(let i of invs) modalDisetor += parseFloat(i.modal) || 0;
        
        let penjualan = 0, pembelian = 0;
        let currentInvs = {};
        let kasRupiahFisik = modalDisetor;
        
        let trxsSorted = trxs.sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime());
        for(let t of trxsSorted) {
        let tEpoch = new Date(t.date).getTime();
        if(epochLimit !== null && tEpoch > epochLimit) break;
        
        let c = t.valuta;
        if(c && !currentInvs[c]) currentInvs[c] = {qty: 0, totalCost: 0};
        
        let qty = parseFloat(t.amount) || 0;
        let rp = parseFloat(t.totalIDR) || (qty * parseFloat(t.rate || 0));
        
        if(!t.payment_method || t.payment_method === 'CASH' || t.payment_method === 'TUNAI') {
            if(t.type === 'JUAL') kasRupiahFisik += rp;
            if(t.type === 'BELI') kasRupiahFisik -= rp;
        }
        
        if(c) {
            if(t.type === 'JUAL') {
                penjualan += rp;
                let avgPrice = currentInvs[c].qty > 0 ? (currentInvs[c].totalCost / currentInvs[c].qty) : 0;
                currentInvs[c].qty -= qty;
                currentInvs[c].totalCost -= (qty * avgPrice);
                if(currentInvs[c].qty < 0) currentInvs[c].qty = 0;
                if(currentInvs[c].totalCost < 0) currentInvs[c].totalCost = 0;
            } else if(t.type === 'BELI') {
                pembelian += rp;
                currentInvs[c].qty += qty;
                currentInvs[c].totalCost += rp;
            }
        }
    }
    
    let totalBeban = 0;
    for(let x of exps) {
        let xTime = new Date(x.date).getTime();
        if(epochLimit !== null && xTime > epochLimit) continue;
        let amt = parseFloat(x.amount || 0);
        kasRupiahFisik -= amt;
        totalBeban += amt;
    }
    
    let sisaPersediaan = 0;
    for(let k in currentInvs) {
        if(currentInvs[k].qty > 0) sisaPersediaan += currentInvs[k].totalCost;
    }
    
    let hpp = pembelian - sisaPersediaan;
    if(hpp < 0) hpp = 0;
    let labaBersih = penjualan - hpp - totalBeban;
    
    return { modalDisetor, kasRupiahFisik, sisaPersediaan, labaBersih, penjualan, pembelian, totalBeban };
    } catch(err) {
        console.error("Accounting Engine Error:", err);
        return { modalDisetor:0, kasRupiahFisik:0, sisaPersediaan:0, labaBersih:0, penjualan:0, pembelian:0, totalBeban:0 };
    }
}

window.loadLaporanLabaRugi = function() {
    try {
        let sStr = document.getElementById('plStartDate') ? document.getElementById('plStartDate').value : null;
        let eStr = document.getElementById('plEndDate') ? document.getElementById('plEndDate').value : null;
    
    let startEpoch = getFinancialEpoch(sStr, false);
    let endEpoch = getFinancialEpoch(eStr, true);
    
    if(endEpoch === null) endEpoch = new Date().getTime();
    
    // Period T-1
    let tZeroLimit = startEpoch ? (startEpoch - 1000) : 0;
    
    // Pillar logic for the duration = Value(End) - Value(Start-1)
    let stateEnd = calculateFinancialPillars(endEpoch);
    let stateStart = calculateFinancialPillars(tZeroLimit);
    
    let penjualanPeriode = stateEnd.penjualan - stateStart.penjualan;
    let pembelianPeriode = stateEnd.pembelian - stateStart.pembelian;
    let bebanPeriode = stateEnd.totalBeban - stateStart.totalBeban;
    
    let saldoAwalUka = stateStart.sisaPersediaan;
    let saldoAkhirUka = stateEnd.sisaPersediaan;
    
    let grossProfit = penjualanPeriode + saldoAkhirUka - saldoAwalUka - pembelianPeriode;
    let labaBersih = grossProfit - bebanPeriode;
    
    // Update UI (Laba Rugi)
    if(document.getElementById('pl_01')) document.getElementById('pl_01').innerText = formatRupiah(penjualanPeriode);
    if(document.getElementById('pl_03')) document.getElementById('pl_03').innerText = formatRupiah(saldoAwalUka);
    if(document.getElementById('pl_04')) document.getElementById('pl_04').innerText = formatRupiah(pembelianPeriode);
    if(document.getElementById('pl_05')) document.getElementById('pl_05').innerText = formatRupiah(saldoAkhirUka);
    
    if(document.getElementById('pl_kotor_ukatc')) document.getElementById('pl_kotor_ukatc').innerText = formatRupiah(grossProfit);
    if(document.getElementById('pl_kotor_op')) document.getElementById('pl_kotor_op').innerText = formatRupiah(grossProfit);
    
    if(document.getElementById('pl_15')) document.getElementById('pl_15').innerText = formatRupiah(bebanPeriode);
    
    if(document.getElementById('pl_bersih_op')) document.getElementById('pl_bersih_op').innerText = formatRupiah(labaBersih);
    if(document.getElementById('pl_sblm_pajak')) document.getElementById('pl_sblm_pajak').innerText = formatRupiah(labaBersih);
    if(document.getElementById('plLabaBersih')) document.getElementById('plLabaBersih').innerText = formatRupiah(labaBersih);
    } catch(err) {
        alert("Gagal menghitung Laba Rugi: " + err.message);
    }
};

window.loadLaporanNeraca = function() {
    try {
        let dateStr = document.getElementById('neracaDate') ? document.getElementById('neracaDate').value : null;
    let epochLimit = getFinancialEpoch(dateStr, true);
    if(!epochLimit) {
        epochLimit = new Date().getTime();
        if(document.getElementById('neracaDate')) document.getElementById('neracaDate').value = new Date().toISOString().split('T')[0];
    }
    
    let state = calculateFinancialPillars(epochLimit);
    
    let kas = state.kasRupiahFisik;
    let persediaan = state.sisaPersediaan;
    let totalAktiva = kas + persediaan;
    
    let modal = state.modalDisetor;
    let labaDitahan = state.labaBersih;
    let totalPasiva = modal + labaDitahan;
    
    if(document.getElementById('val_101')) document.getElementById('val_101').innerText = formatRupiah(kas);
    if(document.getElementById('val_103')) document.getElementById('val_103').innerText = formatRupiah(persediaan);
    if(document.getElementById('neracaTotalAktiva')) document.getElementById('neracaTotalAktiva').innerText = formatRupiah(totalAktiva);
    
    if(document.getElementById('val_206')) document.getElementById('val_206').innerText = formatRupiah(modal);
    if(document.getElementById('val_207')) {
        if(labaDitahan >= 0) {
            document.getElementById('val_207').innerText = formatRupiah(labaDitahan);
            if(document.getElementById('val_290')) document.getElementById('val_290').innerText = '0';
        } else {
            document.getElementById('val_207').innerText = '0';
            if(document.getElementById('val_290')) document.getElementById('val_290').innerText = formatRupiah(Math.abs(labaDitahan));
        }
    }
    if(document.getElementById('neracaTotalPasiva')) document.getElementById('neracaTotalPasiva').innerText = formatRupiah(totalPasiva);
    
    let ind = document.getElementById('neracaStatusIndicator');
    if(ind) {
        ind.style.display = 'block';
        if(Math.round(totalAktiva) === Math.round(totalPasiva)) {
            ind.innerHTML = '<span class="text-success"><i class="fa-solid fa-check-circle"></i> NERACA SEIMBANG (BALANCE)</span>';
        } else {
            ind.innerHTML = '<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> TIDAK SEIMBANG! Selisih: ' + formatRupiah(Math.abs(totalAktiva - totalPasiva)) + '</span>';
        }
    }
    } catch(err) {
        alert("Gagal menghitung Neraca: " + err.message);
    }
};

window.loadLaporanEkuitas = function() {
    try {
        let sStr = document.getElementById('eqStartDate') ? document.getElementById('eqStartDate').value : null;
    let eStr = document.getElementById('eqEndDate') ? document.getElementById('eqEndDate').value : null;
    
    let startEpoch = getFinancialEpoch(sStr, false);
    let endEpoch = getFinancialEpoch(eStr, true);
    if(endEpoch === null) endEpoch = new Date().getTime();
    
    let tZeroLimit = startEpoch ? (startEpoch - 1000) : 0;
    
    let stateEnd = calculateFinancialPillars(endEpoch);
    let stateStart = calculateFinancialPillars(tZeroLimit);
    
    let modal = stateStart.modalDisetor; // static
    let labaSebelumnya = stateStart.labaBersih;
    let labaPeriodeIni = stateEnd.labaBersih - stateStart.labaBersih;
    
    let j01 = modal + (labaSebelumnya > 0 ? labaSebelumnya : 0);
    
    if(document.getElementById('eq_01_m')) document.getElementById('eq_01_m').innerText = formatRupiah(modal);
    if(labaSebelumnya >= 0) {
        if(document.getElementById('eq_01_l')) document.getElementById('eq_01_l').innerText = formatRupiah(labaSebelumnya);
        if(document.getElementById('eq_01_j')) document.getElementById('eq_01_j').innerText = formatRupiah(j01);
        if(document.getElementById('eq_02_l')) document.getElementById('eq_02_l').innerText = '0';
    } else {
        if(document.getElementById('eq_01_l')) document.getElementById('eq_01_l').innerText = '0';
        if(document.getElementById('eq_01_j')) document.getElementById('eq_01_j').innerText = formatRupiah(modal);
        if(document.getElementById('eq_02_l')) document.getElementById('eq_02_l').innerText = formatRupiah(Math.abs(labaSebelumnya));
    }
    
    if(labaPeriodeIni >= 0) {
        if(document.getElementById('eq_03_l')) document.getElementById('eq_03_l').innerText = formatRupiah(labaPeriodeIni);
        if(document.getElementById('eq_03_j')) document.getElementById('eq_03_j').innerText = formatRupiah(labaPeriodeIni);
        if(document.getElementById('eq_04_l')) document.getElementById('eq_04_l').innerText = '0';
    } else {
        if(document.getElementById('eq_03_l')) document.getElementById('eq_03_l').innerText = '0';
        if(document.getElementById('eq_03_j')) document.getElementById('eq_03_j').innerText = '0';
        if(document.getElementById('eq_04_l')) document.getElementById('eq_04_l').innerText = formatRupiah(Math.abs(labaPeriodeIni));
    }
    
    let totalLabaAkhir = labaSebelumnya + labaPeriodeIni;
    if(document.getElementById('eq_tot_m')) document.getElementById('eq_tot_m').innerText = formatRupiah(modal);
    if(document.getElementById('eq_tot_l')) document.getElementById('eq_tot_l').innerText = formatRupiah(totalLabaAkhir);
    if(document.getElementById('eq_tot_j')) document.getElementById('eq_tot_j').innerText = formatRupiah(modal + totalLabaAkhir);
    } catch(err) {
        alert("Gagal menghitung Ekuitas: " + err.message);
    }
};

// Bind Buttons
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('btnFilterPL')) {
        document.getElementById('btnFilterPL').addEventListener('click', loadLaporanLabaRugi);
    }
    if(document.getElementById('btnFilterNeraca')) {
        document.getElementById('btnFilterNeraca').addEventListener('click', loadLaporanNeraca);
    }
    if(document.getElementById('btnFilterEq')) {
        document.getElementById('btnFilterEq').addEventListener('click', loadLaporanEkuitas);
    }
});

// Hijack Navigation clicks to initial render
document.addEventListener('click', (e) => {
    let target = e.target.closest('.nav-item');
    if(target) {
        let tgtId = target.getAttribute('data-target');
        if(tgtId === 'laporan-labarugi-view' && typeof loadLaporanLabaRugi === 'function') setTimeout(loadLaporanLabaRugi, 150);
        if(tgtId === 'laporan-neraca-view' && typeof loadLaporanNeraca === 'function') setTimeout(loadLaporanNeraca, 150);
        if(tgtId === 'laporan-ekuitas-view' && typeof loadLaporanEkuitas === 'function') setTimeout(loadLaporanEkuitas, 150);
    }
});



