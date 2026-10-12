/* 
    sync.js - Jembatan antara Frontend (localStorage) dengan Backend MySQL
    Fungsi ini akan otomatis dipanggil saat aplikasi dibuka untuk menyedot data dari MySQL
    dan menyimpannya jika ada perubahan.
*/

function refreshActiveRealtimeViews() {
    try {
        const isActive = (id) => {
            const el = document.getElementById(id);
            return el && el.classList.contains('active');
        };

        if (isActive('dashboard-view') && typeof loadDashboard === 'function') loadDashboard();
        if (isActive('reports-view') && typeof loadReportsTable === 'function') loadReportsTable();
        if (isActive('harian-view') && typeof loadLaporanHarian === 'function') loadLaporanHarian();
        if (isActive('currency-view') && typeof loadCurrencyTable === 'function') loadCurrencyTable();
        if (isActive('customers-view') && typeof loadCustomersTable === 'function') loadCustomersTable();
        if (isActive('mutation-view') && typeof loadMutationsTable === 'function') loadMutationsTable();
        if (isActive('expense-view') && typeof loadExpensesTable === 'function') loadExpensesTable();
        if (isActive('closing-view') && typeof loadClosingsTable === 'function') loadClosingsTable();
        if (isActive('laporan-lku-view') && typeof loadLaporanLku === 'function') loadLaporanLku();
        if (isActive('laporan-posisi-valuta-view') && typeof loadLaporanPosisiValuta === 'function') loadLaporanPosisiValuta();
        if (isActive('old-money-view') && typeof loadOldMoneyDashboard === 'function') loadOldMoneyDashboard();
        if (isActive('gantungan-view') && typeof window.initGantunganView === 'function') window.initGantunganView();
        if (typeof window.updateHeaderNotificationBadge === 'function') window.updateHeaderNotificationBadge();
    } catch (error) {
        console.warn('Realtime refresh view gagal:', error);
    }
}
window.refreshActiveRealtimeViews = refreshActiveRealtimeViews;

function parseRealtimeStorageValue(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
}

if (!window.__almaraRealtimeStoragePatch) {
    window.__almaraRealtimeStoragePatch = true;
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const localOnlyKeys = new Set([
        'mc_currentUser',
        'mc_users',
        'mc_light_theme',
        'mc_sidebar_collapsed',
        'mc_invoice_seq',
        'mc_booking_seq',
        'mc_customers_reset_at',
        'mc_bi_rates_reset_at',
        'mc_rekap_valuta_permission_migrated_v2',
        'mc_master_jobs_seed_version',
        'mc_master_citizens_seed_version'
    ]);
    const mysqlTableKeys = new Set(['mc_currencies', 'mc_transactions', 'mc_customers']);

    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (window.__almaraApplyingRemoteSync) return;
        if (!String(key || '').startsWith('mc_')) return;
        if (key === 'mc_transaction_notification_broadcast') return;
        // Riwayat notifikasi adalah status per pengguna/per browser. Status ini
        // tidak boleh disinkronkan agar notifikasi yang sudah ditutup tidak
        // tertimpa kembali oleh snapshot server yang lebih lama.
        if (String(key).startsWith('mc_seen_transaction_keys_v1_')) return;
        if (localOnlyKeys.has(key) || mysqlTableKeys.has(key)) return;
        if (typeof pushToUniversalDatastore !== 'function') return;

        clearTimeout(window.__almaraRealtimePushTimers?.[key]);
        window.__almaraRealtimePushTimers = window.__almaraRealtimePushTimers || {};
        window.__almaraRealtimePushTimers[key] = setTimeout(() => {
            pushToUniversalDatastore(key, parseRealtimeStorageValue(value));
        }, 250);
    };
}

// Fungsi untuk menarik data dari MySQL saat aplikasi baru dimuat
async function syncFromMySQL_Currencies(options = {}) {
    const { refreshUi = false, silent = false } = options;
    const activePushes = window.__almaraActiveCurrencyPushes || 0;
    const lastWriteAt = window.__almaraLastLocalCurrencyWriteAt || 0;
    if (activePushes > 0 || (Date.now() - lastWriteAt) < 5000) {
        if (!silent) console.log("[Sync-Skip] Mengabaikan penarikan mata uang karena ada transaksi penyimpanan aktif.");
        return;
    }
    try {
        const localCurrencies = JSON.parse(localStorage.getItem('mc_currencies')) || [];
        const response = await fetch(`api/currencies?sync_ts=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();

            if (localCurrencies.length > 0 && (!data || data.length === 0)) {
                console.log(`Ditemukan ${localCurrencies.length} mata uang di lokal. Sinkronisasi ke MySQL...`);
                for (const curr of localCurrencies) {
                    await saveToMySQL_Currency(curr);
                }
                // Hapus rekursi untuk stabilitas
            }

            if (data && data.length > 0) {
                const formattedCurrencies = data.map(dbCurrency => {
                    let parsedRaw = {};
                    if (dbCurrency.raw_json) {
                        try {
                            parsedRaw = JSON.parse(dbCurrency.raw_json) || {};
                        } catch (e) {
                            parsedRaw = {};
                        }
                    }

                    return {
                        ...dbCurrency,
                        ...parsedRaw,
                        code: dbCurrency.code || parsedRaw.code,
                        label: dbCurrency.label ?? parsedRaw.label ?? '',
                        buy: parseFloat(dbCurrency.buy ?? parsedRaw.buy) || 0,
                        sell: parseFloat(dbCurrency.sell ?? parsedRaw.sell) || 0,
                        stock: parseFloat(dbCurrency.stock ?? parsedRaw.stock) || 0
                    };
                });

                // Tulis paksa data dari MySQL ke LocalStorage agar aplikasi membaca data terbaru
                const before = localStorage.getItem('mc_currencies') || '[]';
                const after = JSON.stringify(formattedCurrencies);
                if (before !== after) {
                    localStorage.setItem('mc_currencies', after);
                    if (refreshUi) refreshActiveRealtimeViews();
                }
                if (!silent) console.log("SUKSES: Data Mata Uang berhasil ditarik dari MySQL!");
            }
        }
    } catch (error) {
        if (!silent) console.error("Gagal menarik data dari MySQL (Mungkin server mati):", error);
    }
}

// Fungsi untuk mengirim 1 mata uang ke MySQL
async function saveToMySQL_Currency(currencyObject) {
    window.__almaraActiveCurrencyPushes = (window.__almaraActiveCurrencyPushes || 0) + 1;
    try {
        const response = await fetch('api/currencies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currencyObject)
        });
        const result = await response.json();
        console.log("Sinkronisasi MySQL:", result.message);
    } catch (error) {
        console.error("Gagal menyimpan ke MySQL:", error);
    } finally {
        window.__almaraActiveCurrencyPushes = Math.max(0, (window.__almaraActiveCurrencyPushes || 0) - 1);
    }
}

// Mengambil data saat komputer baru pertama membuka web
document.addEventListener('DOMContentLoaded', () => {
    // Tarik data sebelum app.js merender tabel
    syncFromMySQL_Currencies().then(() => {
        if(typeof renderCurrencies === 'function') {
            renderCurrencies(); // Refresh tabel master valas (kalau lagi buka halaman terkait)
        }
    });

    // Menarik riwayat transaksi dari MySQL
    syncFromMySQL_Transactions().then(() => {
        if(typeof renderTrxHistory === 'function') {
            renderTrxHistory();
        }
    });

    // Menarik data nasabah dari MySQL
    syncFromMySQL_Customers().then(() => {
        if(typeof loadCustomersTable === 'function') {
            loadCustomersTable();
        }
    });
    
    // Menarik Universal Datastore (sisa semua modul)
    syncUniversalDatastore();
});
// ==========================================
// UNIVERSAL DATASTORE SYNC
// ==========================================

function normalizeDatastoreValue(value) {
    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
}

window.deleteFromMySQL_Currency = async function(code) {
    try {
        const request = window.authFetch || window.fetch;
        const url = `api/currencies?code=${encodeURIComponent(String(code || ''))}`;
        let response = await request(url, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });
        let result = await response.json().catch(() => ({}));

        if (response.status === 419) {
            const refreshed = await refreshCsrfTokenFromServer();
            if (refreshed) {
                response = await request(url, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                result = await response.json().catch(() => ({}));
            }
        }

        console.log("Hapus Currency MySQL:", result.message);

        if (response.status === 401) {
            try { localStorage.setItem('mc_currentUser', JSON.stringify(null)); } catch (e) {}
            return {
                ok: false,
                status: response.status,
                message: 'Sesi login sudah habis. Silakan login ulang, lalu coba hapus lagi.'
            };
        }

        if (response.status === 419) {
            return {
                ok: false,
                status: response.status,
                message: 'Token keamanan sudah kedaluwarsa. Silakan refresh halaman atau login ulang.'
            };
        }

        return {
            ok: response.ok && result.status !== 'error',
            status: response.status,
            message: result.message || result.error || ''
        };
    } catch (error) {
        console.error("Gagal menghapus currency dari MySQL:", error);
        return {
            ok: false,
            status: 0,
            message: error.message || String(error)
        };
    }
};

async function refreshCsrfTokenFromServer() {
    try {
        const request = window.authFetch || window.fetch;
        const response = await request('/auth/me', { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if (response.ok && result.csrfToken && typeof window.setCsrfToken === 'function') {
            window.setCsrfToken(result.csrfToken);
            return true;
        }
    } catch (error) {
        console.warn('Refresh CSRF token gagal:', error);
    }
    return false;
}

async function deleteToMySQL_Currency(code) {
    return window.deleteFromMySQL_Currency(code);
}

async function syncUniversalDatastore(options = {}) {
    const { preferRemote = false, refreshUi = false, silent = false } = options;
    try {
        const response = await fetch(`api/datastore?sync_ts=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success' && result.data) {
                let hasChanges = false;
                // Preserve a local supplier save if the server still contains
                // an older snapshot during an immediate page refresh.
                const preferLocalKeys = ['mc_old_money_suppliers', 'mc_gantungans'];

                // Jangan override seluruhnya mentah-mentah jika lokal lebih baru,
                // tapi karena ini single source of truth MySQL, kita timpa cache lokal dengan MySQL
                for (const [key, rawValue] of Object.entries(result.data)) {
                    // Abaikan cache "sudah dibaca" lama yang mungkin pernah
                    // tersimpan di Universal Datastore. Ini adalah preferensi
                    // lokal pengguna, bukan data aplikasi bersama.
                    if (String(key).startsWith('mc_seen_transaction_keys_v1_')) continue;
                    if (key === 'mc_customers') {
                        console.log('[Sync-Skip] mc_customers dikelola oleh tabel mc_customers, bukan Universal Datastore.');
                        continue;
                    }
                    if (key === 'mc_bi_rates' && localStorage.getItem('mc_bi_rates_reset_at')) {
                        console.log('[Sync-Skip] mc_bi_rates pernah di-reset, mengabaikan data lama dari Universal Datastore.');
                        continue;
                    }
                    const value = normalizeDatastoreValue(rawValue);
                    // Cek selisih panjang (kalau array) untuk menghindari Wipe Offline Data saat internet putus.
                    // Jika data lokal lebih banyak (offline record), kita berpotensi Auto-Push daripada REPLACE.
                    // Cek selisih panjang (kalau array) untuk menghindari Wipe Offline Data saat internet putus.
                    // Jika data lokal lebih banyak (offline record), kita berpotensi Auto-Push daripada REPLACE.
                    const localRaw = localStorage.getItem(key);
                    if (localRaw) {
                        try {
                            const localParsed = JSON.parse(localRaw);
                            
                            // PROTEKSI KHUSUS PROFIL: Jangan timpa data lokal jika data server kosong/invalid
                            if (key === 'mc_profile') {
                                if (!value || !value.name || value.name === 'MC-ALMARA' || value.name === '') {
                                    console.log("[Sync-Skip] Mengabaikan profil kosong dari MySQL untuk melindungi data lokal.");
                                    continue;
                                }
                            }
                            
                            // PROTEKSI LOGIN: Jangan biarkan datastore MySQL memaksa logout user yang sedang aktif
                            // atau menghancurkan daftar mc_users (biarkan app.js menanganinya atau timpa dengan data lokal)
                            if (key === 'mc_currentUser' || key === 'mc_users') {
                                console.log(`[Sync-Skip] Mengabaikan ${key} dari MySQL untuk melindungi sesi aktif.`);
                                continue;
                            }

                            if (preferLocalKeys.includes(key)) {
                                if (JSON.stringify(localParsed) !== JSON.stringify(value)) {
                                    const isLocalEmpty = 
                                        (Array.isArray(localParsed) && localParsed.length === 0) ||
                                        (key === 'mc_old_money_cash' && parseFloat(localParsed) === 0) ||
                                        (key === 'mc_initial_cash' && parseFloat(localParsed) === 0) ||
                                        (key === 'mc_initial_bank_bca' && parseFloat(localParsed) === 0) ||
                                        (key === 'mc_initial_bank_mandiri' && parseFloat(localParsed) === 0);
                                    
                                    const isServerNotEmpty = 
                                        (Array.isArray(value) && value.length > 0) ||
                                        (key === 'mc_old_money_cash' && parseFloat(value) > 0) ||
                                        (key === 'mc_initial_cash' && parseFloat(value) > 0) ||
                                        (key === 'mc_initial_bank_bca' && parseFloat(value) > 0) ||
                                        (key === 'mc_initial_bank_mandiri' && parseFloat(value) > 0);

                                    if (isLocalEmpty && isServerNotEmpty) {
                                        console.log(`[Auto-Pull] Server memiliki data ${key} tetapi lokal kosong. Menarik dari server...`);
                                    } else {
                                        console.log(`[Auto-Push] ${key} lokal berbeda dari MySQL. Mempertahankan data lokal...`);
                                        await pushToUniversalDatastore(key, localParsed);
                                        continue;
                                    }
                                }
                            }

                            if (!preferRemote && Array.isArray(localParsed) && Array.isArray(value)) {
                                if (localParsed.length > value.length) {
                                    // Lokal memiliki entri offline lebih banyak! Auto-Push seluruh array lokal.
                                    console.log(`[Auto-Push] ${key} lokal > MySQL. Pushing ke Datastore...`);
                                    await pushToUniversalDatastore(key, localParsed);
                                    continue; // Skip overwriting from MySQL this time
                                }
                            }
                        } catch(e) {}
                    }
                    // Timpa dengan data dari MySQL
                    const nextRaw = JSON.stringify(value);
                    if (localStorage.getItem(key) !== nextRaw) {
                        try {
                            window.__almaraApplyingRemoteSync = true;
                            localStorage.setItem(key, nextRaw);
                        } finally {
                            window.__almaraApplyingRemoteSync = false;
                        }
                        hasChanges = true;
                    }
                }

                // PUSH DATA LOKAL KE DATABASE UNTUK KUNCI-KUNCI YANG BELUM ADA DI DATABASE (SEPERTI SAAT SWAP KE DATABASE BARU)
                const localOnlyKeys = new Set([
                    'mc_currentUser',
                    'mc_users',
                    'mc_light_theme',
                    'mc_sidebar_collapsed',
                    'mc_invoice_seq',
                    'mc_booking_seq',
                    'mc_customers_reset_at',
                    'mc_bi_rates_reset_at',
                    'mc_rekap_valuta_permission_migrated_v2',
                    'mc_master_jobs_seed_version',
                    'mc_master_citizens_seed_version'
                ]);
                const mysqlTableKeys = new Set(['mc_currencies', 'mc_transactions', 'mc_customers']);

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!String(key || '').startsWith('mc_')) continue;
                    if (String(key).startsWith('mc_seen_transaction_keys_v1_')) continue;
                    if (localOnlyKeys.has(key) || mysqlTableKeys.has(key)) continue;

                    if (!(key in result.data)) {
                        const localRaw = localStorage.getItem(key);
                        if (localRaw) {
                            try {
                                const localParsed = JSON.parse(localRaw);
                                const isLocalEmpty = 
                                    localParsed === null ||
                                    (Array.isArray(localParsed) && localParsed.length === 0) ||
                                    (typeof localParsed === 'object' && Object.keys(localParsed).length === 0) ||
                                    ((key === 'mc_old_money_cash' || key === 'mc_initial_cash' || key === 'mc_initial_bank_bca' || key === 'mc_initial_bank_mandiri') && parseFloat(localParsed) === 0);

                                if (!isLocalEmpty) {
                                    console.log(`[Auto-Push] Kunci ${key} belum ada di server. Sinkronisasi data lokal ke MySQL...`);
                                    await pushToUniversalDatastore(key, localParsed);
                                }
                            } catch(e) {}
                        }
                    }
                }

                if (!silent) console.log("SUKSES: Universal Datastore tersinkronisasi!");
                
                // Panggil render/refresh fungsi yang mungkin membutuhkan data baru (Refresh UI)
                if (hasChanges && refreshUi) refreshActiveRealtimeViews();
                else if(typeof window.updateHeaderNotificationBadge === 'function') window.updateHeaderNotificationBadge();
            }
        }
    } catch (error) {
        if (!silent) console.error("Gagal menarik sisa data dari Universal Datastore:", error);
    }
}

async function pushToUniversalDatastore(storeKey, jsonData) {
    if (storeKey === 'mc_customers') {
        console.log('[Datastore-Skip] mc_customers tidak disimpan ke Universal Datastore.');
        return { status: 'skipped' };
    }

    try {
        const response = await fetch('api/datastore', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            },
            body: JSON.stringify({
                store_key: storeKey,
                json_data: JSON.stringify(jsonData)
            })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status === 'error') {
            throw new Error(result.message || `Server merespons HTTP ${response.status}.`);
        }
        console.log(`Update ${storeKey} ke MySQL:`, result.message);
    } catch (error) {
        console.error(`Gagal menyimpan ${storeKey} ke MySQL:`, error);
    }
}

window.uploadBase64FileToFolder = async function(dataUrl, category, filename = 'upload', options = {}) {
    if (!dataUrl || typeof dataUrl !== 'string') return dataUrl || '';
    if (!dataUrl.startsWith('data:')) return dataUrl;

    const request = window.authFetch || window.fetch;
    const response = await request('api/uploads', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        },
        body: JSON.stringify({
            category,
            data_url: dataUrl,
            filename,
            overwrite: !!options.overwrite,
            replace_url: options.replaceUrl || options.replace_url || ''
        })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status === 'error' || !result.url) {
        throw new Error(result.message || `Gagal upload file (${response.status})`);
    }

    return result.url;
};

// ==========================================
// AREA NASABAH (CUSTOMERS)
// ==========================================

async function hasCustomerResetLock() {
    try {
        const response = await fetch(`api/datastore?sync_ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return Boolean(localStorage.getItem('mc_customers_reset_at'));

        const payload = await response.json();
        const remoteResetAt = payload && payload.data ? payload.data.mc_customers_reset_at : null;
        if (remoteResetAt) {
            localStorage.setItem('mc_customers_reset_at', String(remoteResetAt));
            return true;
        } else {
            localStorage.removeItem('mc_customers_reset_at');
            return false;
        }
    } catch (error) {
        console.warn('Gagal memeriksa penanda reset nasabah:', error);
    }

    return Boolean(localStorage.getItem('mc_customers_reset_at'));
}

async function syncFromMySQL_Customers(options = {}) {
    const { refreshUi = false, silent = false } = options;
    try {
        const response = await fetch(`api/customers?sync_ts=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();

            if (data && data.length > 0) {
                localStorage.removeItem('mc_customers_reset_at');
                const compactCustomerForStorage = (customer) => {
                    if (!customer || typeof customer !== 'object') return customer;
                    const next = { ...customer };
                    if (typeof next.foto_id === 'string' && next.foto_id.length > 5000) delete next.foto_id;
                    delete next.raw_json;
                    return next;
                };
                // Parse raw_json untuk mengembalikan seluruh field rahasia/kompleks dari localStorage app.js asli
                const formattedCustomers = data.map(dbCust => {
                    if(dbCust.raw_json) {
                        try {
                            return compactCustomerForStorage(JSON.parse(dbCust.raw_json));
                        } catch(e) {}
                    }
                    // Fallback jika tidak ada raw_json (untuk data yang diimpor dari sumber lain ke MySQL)
                    return compactCustomerForStorage({
                        id_nasabah: dbCust.internal_id,
                        idpjk: dbCust.idpjk || '',
                        kn: dbCust.customer_type || '1',
                        nama: dbCust.name,
                        tempat_lahir: dbCust.tempat_lahir || '',
                        tanggal_lahir: dbCust.tanggal_lahir || '',
                        alamat: dbCust.address || '',
                        jenis_kelamin: dbCust.jenis_kelamin || '-',
                        warga_negara: dbCust.warga_negara || '-',
                        pekerjaan: dbCust.pekerjaan || '-',
                        jenis_id: dbCust.identity_type || (dbCust.identity_number && dbCust.identity_number !== '-' ? 'KTP' : 'PASSPORT'),
                        no_ktp: dbCust.identity_number || '-',
                        selain_ktp: dbCust.selain_ktp || '-',
                        no_hp: dbCust.phone || '-',
                        no_rekening: dbCust.no_rekening || '-',
                        no_cif: dbCust.id_cif || '',
                        npwp: dbCust.npwp || '-',
                        local_id: dbCust.local_id || '-',
                        tgl_daftar: dbCust.registration_date || '',
                        foto_id: dbCust.foto_id || null
                    });
                });
                window.__mcCustomersMemory = formattedCustomers;
                const before = localStorage.getItem('mc_customers') || '[]';
                try {
                    localStorage.setItem('mc_customers', JSON.stringify(formattedCustomers));
                } catch(error) {
                    if(error && (error.name === 'QuotaExceededError' || String(error.message || '').toLowerCase().includes('quota'))) {
                        localStorage.removeItem('mc_customers');
                        try {
                            localStorage.setItem('mc_customers', JSON.stringify(formattedCustomers.map(compactCustomerForStorage)));
                        } catch(retryError) {
                            console.warn('Cache nasabah lokal penuh, memakai fallback memori.', retryError);
                            window.__mcCustomersMemory = formattedCustomers.map(compactCustomerForStorage);
                        }
                    } else {
                        throw error;
                    }
                }
                if (before !== (localStorage.getItem('mc_customers') || '[]') && refreshUi) refreshActiveRealtimeViews();
                if (!silent) console.log("SUKSES: Data Nasabah berhasil ditarik dari MySQL!");
            } else {
                const localCustomers = JSON.parse(localStorage.getItem('mc_customers')) || [];
                if (localCustomers.length > 0) {
                    const resetLocked = await hasCustomerResetLock();
                    if (resetLocked) {
                        console.log('Reset nasabah masih aktif. Cache lokal tidak akan dipush kembali ke MySQL.');
                        const before = localStorage.getItem('mc_customers') || '[]';
                        localStorage.removeItem('mc_customers');
                        window.__mcCustomersMemory = [];
                        if (before !== '[]' && refreshUi) refreshActiveRealtimeViews();
                        if (!silent) console.log('Data Nasabah kosong setelah reset. Cache lokal dibersihkan tanpa sinkron ulang.');
                        return;
                    }
                    console.log(`Ditemukan ${localCustomers.length} nasabah di lokal. Sinkronisasi ke MySQL secara massal...`);
                    await saveBulkToMySQL_Customers(localCustomers);
                    // Tarik kembali data nasabah untuk menyinkronkan status
                    await syncFromMySQL_Customers({ refreshUi, silent });
                    return;
                }

                const before = localStorage.getItem('mc_customers') || '[]';
                localStorage.removeItem('mc_customers');
                window.__mcCustomersMemory = [];
                if (before !== '[]' && refreshUi) refreshActiveRealtimeViews();
                if (!silent) console.log("Data Nasabah MySQL kosong. Cache lokal nasabah ikut dikosongkan.");
            }
        }
    } catch (error) {
        if (!silent) console.error("Gagal menarik Nasabah dari MySQL:", error);
    }
}

async function saveToMySQL_Customer(customerObject) {
    try {
        const response = await fetch('api/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerObject)
        });
        const rawResponse = await response.text();
        let result = {};
        try {
            result = rawResponse ? JSON.parse(rawResponse) : {};
        } catch (parseError) {
            result = { status: 'error', message: rawResponse || `Respons server tidak valid (${response.status})` };
        }
        console.log("Sinkronisasi Nasabah MySQL:", result.message);
        return {
            ok: response.ok && result.status !== 'error',
            status: response.status,
            message: result.message || '',
            data: result.data || null
        };
    } catch (error) {
        console.error("Gagal menyimpan nasabah ke MySQL:", error);
        return {
            ok: false,
            status: 0,
            message: error.message || String(error)
        };
    }
}

async function saveBulkToMySQL_Customers(customersArray) {
    try {
        const response = await fetch('api/customers/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customers: customersArray })
        });
        const rawResponse = await response.text();
        let result = {};
        try {
            result = rawResponse ? JSON.parse(rawResponse) : {};
        } catch (parseError) {
            result = { status: 'error', message: rawResponse || `Respons server tidak valid (${response.status})` };
        }
        if (response.ok && result.status !== 'error') {
            localStorage.removeItem('mc_customers_reset_at');
        }
        console.log("Sinkronisasi Bulk Nasabah MySQL:", result.message);
        return {
            ok: response.ok && result.status !== 'error',
            status: response.status,
            message: result.message || '',
            successCount: result.success_count || 0,
            failedCount: result.failed_count || 0,
            errors: result.errors || []
        };
    } catch (error) {
        console.error("Gagal menyimpan bulk nasabah ke MySQL:", error);
        return {
            ok: false,
            status: 0,
            message: error.message || String(error),
            successCount: 0,
            failedCount: customersArray.length,
            errors: [String(error)]
        };
    }
}

window.saveToMySQL_Customer = saveToMySQL_Customer;
window.saveBulkToMySQL_Customers = saveBulkToMySQL_Customers;


// ==========================================
// AREA TRANSAKSI
// ==========================================

function getRealtimeTransactionKey(trx) {
    if (!trx || typeof trx !== 'object') return '';
    return String(trx.itemId || trx.id || '').trim();
}

function sortRealtimeTransactions(transactions) {
    return [...transactions].sort((a, b) => {
        const dateA = new Date(a && a.timestamp ? a.timestamp : 0).getTime() || 0;
        const dateB = new Date(b && b.timestamp ? b.timestamp : 0).getTime() || 0;
        const timeDiff = dateB - dateA;
        if (timeDiff !== 0) return timeDiff;
        return String(b && (b.itemId || b.id) || '').localeCompare(String(a && (a.itemId || a.id) || ''));
    });
}

function mergeRealtimeTransactions(localTrx, remoteTrx) {
    const merged = new Map();
    (Array.isArray(localTrx) ? localTrx : []).forEach(trx => {
        const key = getRealtimeTransactionKey(trx);
        if (key) merged.set(key, trx);
    });
    (Array.isArray(remoteTrx) ? remoteTrx : []).forEach(trx => {
        const key = getRealtimeTransactionKey(trx);
        if (key) merged.set(key, trx);
    });
    return sortRealtimeTransactions(Array.from(merged.values()));
}

function normalizeStoredTransactions(transactions) {
    return sortRealtimeTransactions(Array.isArray(transactions) ? transactions : []);
}

function getRealtimeTransactionSignature(trx) {
    if (!trx || typeof trx !== 'object') return '';
    const parts = [
        getRealtimeTransactionKey(trx),
        String(trx.id || '').trim(),
        String(trx.timestamp || trx.date || trx.createdAt || trx.created_at || '').trim(),
        String(trx.tipe || trx.type || '').trim().toUpperCase(),
        String(trx.valuta || trx.curCode || trx.currency || '').trim().toUpperCase(),
        String(trx.nominal ?? trx.amount ?? trx.qty ?? trx.quantity ?? '').trim(),
        String(trx.rate ?? '').trim(),
        String(trx.total ?? trx.totalIdr ?? trx.totalIDR ?? trx.total_rupiah ?? '').trim(),
        String(trx.customerId ?? trx.id_cif ?? '').trim(),
        String(trx.kasir || '').trim(),
        String(trx.keterangan || '').trim(),
        String(trx.paymentMethod || '').trim(),
        String(trx.transactionPurpose || '').trim(),
        String(trx.sourceOfFunds || '').trim()
    ];
    return parts.join('|');
}

function getRealtimeTransactionsSignature(transactions) {
    return sortRealtimeTransactions(Array.isArray(transactions) ? transactions : [])
        .map(getRealtimeTransactionSignature)
        .join('||');
}

function getRecentlyWrittenTransactionKeys(windowMs = 90000) {
    const snapshot = window.__almaraLocalTransactionSnapshot;
    if (!snapshot) return new Set();
    const lastWriteAt = window.__almaraLastLocalTransactionWriteAt || 0;
    if (!lastWriteAt || (Date.now() - lastWriteAt) > windowMs) return new Set();

    try {
        const rows = JSON.parse(snapshot);
        if (!Array.isArray(rows)) return new Set();
        return new Set(rows.map(trx => getRealtimeTransactionKey(trx)).filter(Boolean));
    } catch (error) {
        return new Set();
    }
}

function shouldSkipRealtimeTransactionPull() {
    const activePushes = window.__almaraActiveTransactionPushes || 0;
    const lastWriteAt = window.__almaraLastLocalTransactionWriteAt || 0;
    const pendingCount = Array.isArray(window.__almaraPendingTransactionIds) ? window.__almaraPendingTransactionIds.length : 0;
    return activePushes > 0 || pendingCount > 0 || (Date.now() - lastWriteAt) < 2500;
}

function getPendingTransactionKeySet() {
    const pending = Array.isArray(window.__almaraPendingTransactionIds) ? window.__almaraPendingTransactionIds : [];
    return new Set(pending.map(id => String(id || '').trim()).filter(Boolean));
}

function getTransactionNotifyUserKey() {
    let userKey = 'guest';
    try {
        const currentUser = JSON.parse(localStorage.getItem('mc_currentUser') || 'null');
        userKey = currentUser && (currentUser.username || currentUser.fullName || currentUser.role || currentUser.id)
            ? String(currentUser.username || currentUser.fullName || currentUser.role || currentUser.id)
            : 'guest';
    } catch (error) {
        userKey = 'guest';
    }
    return 'mc_seen_transaction_keys_v1_' + userKey.replace(/[^a-z0-9_-]/gi, '_');
}

function getSeenTransactionKeysForNotification() {
    try {
        const parsed = JSON.parse(localStorage.getItem(getTransactionNotifyUserKey()) || '[]');
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (error) {
        return new Set();
    }
}

function saveSeenTransactionKeysForNotification(keys) {
    const list = Array.from(keys).filter(Boolean).slice(-2500);
    localStorage.setItem(getTransactionNotifyUserKey(), JSON.stringify(list));
}

function markTransactionKeysSeenForNotification(transactions) {
    const seen = getSeenTransactionKeysForNotification();
    (Array.isArray(transactions) ? transactions : []).forEach(trx => {
        const key = getRealtimeTransactionKey(trx);
        if (key) seen.add(key);
    });
    saveSeenTransactionKeysForNotification(seen);
}

function getTransactionNotificationTabId() {
    if (!window.__almaraTransactionNotificationTabId) {
        window.__almaraTransactionNotificationTabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }
    return window.__almaraTransactionNotificationTabId;
}

function escapeTransactionNotificationHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTransactionPopupNumber(value, maximumFractionDigits = 2) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '-';
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits
    }).format(number);
}

function getTransactionNotificationCurrencySummary(rows) {
    const grouped = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
        const code = String(row && (row.valuta || row.currency || row.curCode || row.code || '')).trim().toUpperCase();
        if (!code) return;
        const amount = parseFloat(row && (row.nominal ?? row.amount ?? row.qty ?? row.quantity ?? 0)) || 0;
        const totalIdr = parseFloat(row && (row.total ?? row.totalIdr ?? row.totalIDR ?? 0)) || 0;
        if (!grouped.has(code)) {
            grouped.set(code, { code, amount: 0, totalIdr: 0, count: 0 });
        }
        const item = grouped.get(code);
        item.amount += amount;
        item.totalIdr += totalIdr;
        item.count += 1;
    });
    return Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function getTransactionNotificationActiveSet() {
    if (!window.__almaraActiveTransactionNotificationIds) {
        window.__almaraActiveTransactionNotificationIds = new Set();
    }
    return window.__almaraActiveTransactionNotificationIds;
}

function getTransactionNotificationDismissedSet() {
    return getSeenTransactionKeysForNotification();
}

function markTransactionNotificationSeen(key) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    const dismissed = getTransactionNotificationDismissedSet();
    dismissed.add(normalizedKey);
    saveSeenTransactionKeysForNotification(dismissed);
    getTransactionNotificationActiveSet().delete(normalizedKey);
}

function markTransactionNotificationSeenMany(keys) {
    (Array.isArray(keys) ? keys : []).forEach(markTransactionNotificationSeen);
}

function closeAllTransactionNotifications(markSeen = true) {
    const container = document.getElementById('global-transaction-notification-container');
    const cards = container ? Array.from(container.querySelectorAll('.global-transaction-notification')) : [];
    const ids = cards.map(card => String(card.dataset.notificationId || '').trim()).filter(Boolean);
    if (markSeen) markTransactionNotificationSeenMany(ids);

    // Toolbar bukan bagian dari card, sehingga harus ditutup juga.
    // Sebelumnya hanya card yang dihapus dan tombol "Close all" tertinggal melayang.
    const toolbar = container?.querySelector('.global-transaction-notification__toolbar');
    if (toolbar) toolbar.remove();
    cards.forEach(card => removeGlobalTransactionNotification(card));

    // Bersihkan host kosong setelah animasi kartu selesai. Jika notifikasi baru
    // datang sebelum timeout, host dipertahankan dan toolbar akan dibuat kembali.
    if (container) {
        setTimeout(() => {
            if (!container.querySelector('.global-transaction-notification') && container.parentNode) {
                container.remove();
            }
        }, 240);
    }
    return cards.length;
}

function buildTransactionNotificationPayload(row, options = {}) {
    if (!row || typeof row !== 'object') return null;
    const key = String(row.itemId || row.id || row.invoiceId || '').trim();
    if (!key) return null;

    const currency = String(row.valuta || row.currency || row.curCode || row.code || '').trim().toUpperCase();
    const nominal = parseFloat(row.nominal ?? row.amount ?? row.qty ?? row.quantity ?? 0) || 0;
    const rate = parseFloat(row.rate ?? 0) || 0;
    const totalIdr = parseFloat(row.total ?? row.totalIdr ?? row.totalIDR ?? 0) || 0;
    const customerName = String(row.customerName || row.nama || row.customer || '-').trim() || '-';
    const kasir = String(row.kasir || row.inputBy || '-').trim() || '-';
    const transactionType = String(row.tipe || row.type || '').trim().toUpperCase() || 'TRANSAKSI';
    const paymentMethod = String(row.paymentMethod || row.metodeBayar || '-').trim() || '-';
    const timestamp = row.timestamp || row.date || row.createdAt || row.created_at || '';
    const detailLines = [];

    if (currency) detailLines.push(`Siapkan ${currency} ${formatTransactionPopupNumber(nominal, 2)}`);
    if (rate > 0) detailLines.push(`Kurs ${formatTransactionPopupNumber(rate, 2)}`);
    if (totalIdr > 0) detailLines.push(`Total Rp ${formatTransactionPopupNumber(totalIdr, 0)}`);

    return {
        id: key,
        tabId: getTransactionNotificationTabId(),
        title: `Notifikasi ${options.sequenceLabel || ''}`.trim() || 'Notifikasi Transaksi',
        subtitle: `${transactionType}${customerName ? ' - ' + customerName : ''}`,
        rawText: key,
        currencySummary: currency ? [{ code: currency, amount: nominal, totalIdr, count: 1 }] : [],
        invoiceGroups: [{
            invoiceId: key,
            customerName,
            kasir,
            count: 1
        }],
        details: [{
            invoiceId: key,
            customerName,
            kasir,
            currency: currency || '-',
            nominal,
            rate,
            totalIdr,
            type: transactionType,
            paymentMethod,
            timestamp,
            detailLines
        }],
        createdAt: Date.now()
    };
}

function ensureGlobalTransactionNotificationHost() {
    let container = document.getElementById('global-transaction-notification-container');
    if (container) return container;
    if (!document.body) return null;

    container = document.createElement('div');
    container.id = 'global-transaction-notification-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
    return container;
}

function removeGlobalTransactionNotification(card) {
    if (!card) return;
    const notificationId = String(card.dataset.notificationId || '').trim();
    if (notificationId) {
        markTransactionNotificationSeen(notificationId);
    }
    card.classList.remove('is-open');
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
    setTimeout(() => {
        if (card && card.parentNode) card.parentNode.removeChild(card);
    }, 220);
}

function renderGlobalTransactionNotification(payload, options = {}) {
    const { broadcast = true } = options;
    if (!payload) return;
    const container = ensureGlobalTransactionNotificationHost();
    if (!container) return;

    const dismissed = getTransactionNotificationDismissedSet();
    if (payload.id && dismissed.has(payload.id)) return;
    const activeSet = getTransactionNotificationActiveSet();
    if (payload.id && activeSet.has(payload.id)) return;

    if (payload.id) activeSet.add(payload.id);

    const card = document.createElement('div');
    card.className = 'global-transaction-notification';
    card.dataset.notificationId = payload.id || '';
    card.dataset.tabId = payload.tabId || '';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const currencyChips = (payload.currencySummary || []).slice(0, 5).map(item => `
        <span class="global-transaction-notification__chip">
            ${escapeTransactionNotificationHtml(item.code)} ${escapeTransactionNotificationHtml(formatTransactionPopupNumber(item.amount, 2))}
        </span>
    `).join('');

    const invoiceLines = (payload.invoiceGroups || []).slice(0, 4).map(item => `
        <div class="global-transaction-notification__invoice-line">
            <strong>${escapeTransactionNotificationHtml(item.invoiceId || '-')}</strong>
            <span>${escapeTransactionNotificationHtml(item.customerName || '-')}${item.kasir ? ' | ' + escapeTransactionNotificationHtml(item.kasir) : ''}</span>
        </div>
    `).join('');

    const detailRows = (payload.details || []).map(item => `
        <div class="global-transaction-notification__detail-row">
            <div class="global-transaction-notification__detail-main">
                <strong>${escapeTransactionNotificationHtml(item.currency || '-')}</strong>
                <span>${escapeTransactionNotificationHtml(formatTransactionPopupNumber(item.nominal, 2))}</span>
            </div>
            <div class="global-transaction-notification__detail-meta">
                <span>${escapeTransactionNotificationHtml(item.invoiceId || '-')}</span>
                <span>${escapeTransactionNotificationHtml(item.customerName || '-')}</span>
                <span>${escapeTransactionNotificationHtml(item.kasir || '-')}</span>
                <span>${escapeTransactionNotificationHtml(item.paymentMethod || '-')}</span>
            </div>
            ${Array.isArray(item.detailLines) && item.detailLines.length ? `<div class="global-transaction-notification__detail-lines">${item.detailLines.map(line => `<span>${escapeTransactionNotificationHtml(line)}</span>`).join('')}</div>` : ''}
        </div>
    `).join('');

    card.innerHTML = `
        <div class="global-transaction-notification__head">
            <div class="global-transaction-notification__icon">
                <i class="fa-solid fa-wallet"></i>
            </div>
            <div class="global-transaction-notification__body">
                <div class="global-transaction-notification__title">${escapeTransactionNotificationHtml(payload.title || 'Transaksi Baru')}</div>
                <div class="global-transaction-notification__subtitle">${escapeTransactionNotificationHtml(payload.subtitle || 'Ada transaksi baru')}</div>
                <div class="global-transaction-notification__chips">${currencyChips || '<span class="global-transaction-notification__chip">Detail belum tersedia</span>'}</div>
            </div>
            <button type="button" class="global-transaction-notification__close" aria-label="Tutup notifikasi">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="global-transaction-notification__details">
            <div class="global-transaction-notification__section-title">Rincian transaksi</div>
            <div class="global-transaction-notification__invoice-list">${invoiceLines || '<div class="global-transaction-notification__empty">Tidak ada rincian invoice.</div>'}</div>
            <div class="global-transaction-notification__section-title">Valas yang perlu disiapkan</div>
            <div class="global-transaction-notification__detail-list">${detailRows || '<div class="global-transaction-notification__empty">Tidak ada rincian valas.</div>'}</div>
        </div>
    `;

    card.addEventListener('click', function(event) {
        if (event.target.closest('.global-transaction-notification__close')) {
            event.stopPropagation();
            removeGlobalTransactionNotification(card);
            return;
        }
        if (payload.id) markTransactionNotificationSeen(payload.id);
        card.classList.toggle('is-open');
    });

    card.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            card.classList.toggle('is-open');
        }
        if (event.key === 'Escape') {
            removeGlobalTransactionNotification(card);
        }
    });

    if (container && !container.querySelector('.global-transaction-notification__toolbar')) {
        const toolbar = document.createElement('div');
        toolbar.className = 'global-transaction-notification__toolbar';
        toolbar.innerHTML = `
            <div class="global-transaction-notification__toolbar-label">
                <i class="fa-solid fa-bell"></i>
                <span>Notifikasi transaksi</span>
            </div>
            <button type="button" class="global-transaction-notification__close-all">
                <i class="fa-solid fa-xmark"></i>
                <span>Close all</span>
            </button>
        `;
        const closeAllBtn = toolbar.querySelector('.global-transaction-notification__close-all');
        if (closeAllBtn) {
            closeAllBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                closeAllTransactionNotifications(true);
            });
        }
        container.insertBefore(toolbar, container.firstChild);
    }

    container.appendChild(card);
    requestAnimationFrame(() => {
        card.classList.add('is-visible');
    });

    if (broadcast && payload.id) {
        try {
            localStorage.setItem('mc_transaction_notification_broadcast', JSON.stringify({
                ...payload,
                broadcastAt: Date.now(),
                sourceTabId: getTransactionNotificationTabId()
            }));
        } catch (error) {
            console.warn('Gagal broadcast notifikasi transaksi:', error);
        }
    }

}

window.addEventListener('storage', function(event) {
    if (event.key !== 'mc_transaction_notification_broadcast' || !event.newValue) return;
    try {
        const payload = JSON.parse(event.newValue);
        if (!payload || !payload.id) return;
        if (payload.sourceTabId && payload.sourceTabId === getTransactionNotificationTabId()) return;
        renderGlobalTransactionNotification(payload, { broadcast: false });
    } catch (error) {
        console.warn('Gagal membaca broadcast notifikasi transaksi:', error);
    }
});

function getTransactionNotificationSummary(rows) {
    const grouped = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
        const invoiceId = String(row.id || row.invoiceId || row.itemId || '').trim();
        if (!invoiceId) return;
        if (!grouped.has(invoiceId)) {
            grouped.set(invoiceId, {
                invoiceId,
                count: 0,
                kasir: row.kasir || row.inputBy || '',
                customerName: row.customerName || '',
                total: 0
            });
        }
        const item = grouped.get(invoiceId);
        item.count += 1;
        item.total += parseFloat(row.total ?? row.totalIdr ?? row.totalIDR ?? 0) || 0;
    });
    const groups = Array.from(grouped.values());
    if (groups.length === 0) return null;
    if (groups.length === 1) {
        const item = groups[0];
        const totalText = item.total > 0
            ? ` • ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.total)}`
            : '';
        return {
            title: 'Transaksi Baru Masuk',
            text: `${item.invoiceId}${item.kasir ? ' • ' + item.kasir : ''}${totalText}`
        };
    }
    return {
        title: `${groups.length} Transaksi Baru Masuk`,
        text: groups.slice(0, 3).map(item => item.invoiceId).join(', ') + (groups.length > 3 ? ', ...' : '')
    };
}

function showNewTransactionNotification(rows) {
    const list = sortRealtimeTransactions(Array.isArray(rows) ? rows : []);
    list.forEach((row, index) => {
        const payload = buildTransactionNotificationPayload(row, {
            sequenceLabel: String(index + 1)
        });
        if (!payload) return;
        if (payload.id && getTransactionNotificationDismissedSet().has(payload.id)) return;
        renderGlobalTransactionNotification(payload);
    });
}

function notifyNewRemoteTransactionsIfNeeded(beforeTransactions, nextTransactions, options = {}) {
    const { force = false } = options;
    const initializedKey = getTransactionNotifyUserKey() + '_initialized';
    if (localStorage.getItem(initializedKey) !== 'true') {
        localStorage.setItem(initializedKey, 'true');
        return;
    }

    const beforeKeys = new Set((Array.isArray(beforeTransactions) ? beforeTransactions : []).map(getRealtimeTransactionKey).filter(Boolean));
    const pendingKeys = getPendingTransactionKeySet();
    const recentKeys = getRecentlyWrittenTransactionKeys();
    const seenKeys = getSeenTransactionKeysForNotification();
    const activeKeys = getTransactionNotificationActiveSet();
    const newRows = (Array.isArray(nextTransactions) ? nextTransactions : []).filter(row => {
        const key = getRealtimeTransactionKey(row);
        return key
            && !beforeKeys.has(key)
            && !pendingKeys.has(key)
            && !recentKeys.has(key)
            && !seenKeys.has(key)
            && !activeKeys.has(key);
    });

    if (newRows.length > 0 && !force) {
        showNewTransactionNotification(newRows);
    }
}

async function syncFromMySQL_Transactions(options = {}) {
    const { pushLocal = true, refreshUi = false, silent = false, force = false } = options;
    if (!force && !pushLocal && shouldSkipRealtimeTransactionPull()) {
        return;
    }

    try {
        const response = await fetch(`api/transactions?sync_ts=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            
            // PUSH DATA LAMA LOKAL KE MYSQL
            const localTrx = JSON.parse(localStorage.getItem('mc_transactions')) || [];
            const mysqlTrxKeys = data ? data.map(dbTrx => dbTrx.itemId || dbTrx.id) : [];
            const pendingKeys = getPendingTransactionKeySet();

            const unsyncedTrx = [];
            const deletedTrxKeys = [];

            localTrx.forEach(t => {
                const key = t.itemId || t.id;
                if (key && !mysqlTrxKeys.includes(key)) {
                    if (t.synced === true) {
                        // Pernah disinkronkan tapi sekarang tidak ada di MySQL, berarti telah dihapus dari DB
                        deletedTrxKeys.push(key);
                    } else {
                        // Benar-benar transaksi baru offline
                        if (pushLocal) {
                            unsyncedTrx.push(t);
                        }
                    }
                }
            });

            // Hapus data transaksi yang sudah dihapus di server dari local cache
            let adjustedLocalTrx = localTrx;
            if (deletedTrxKeys.length > 0) {
                console.log(`[Sync] Ditemukan ${deletedTrxKeys.length} data transaksi yang telah dihapus di MySQL. Menghapus dari local cache...`, deletedTrxKeys);
                adjustedLocalTrx = localTrx.filter(t => {
                    const key = t.itemId || t.id;
                    return !deletedTrxKeys.includes(key);
                });
                try {
                    window.__almaraApplyingRemoteSync = true;
                    localStorage.setItem('mc_transactions', JSON.stringify(adjustedLocalTrx));
                } finally {
                    window.__almaraApplyingRemoteSync = false;
                }
            }

            if (unsyncedTrx.length > 0) {
                console.log(`Ditemukan ${unsyncedTrx.length} data transaksi lama di lokal. Sinkronisasi ke MySQL secara massal...`);
                await window.pushTransactionsToMySQL(unsyncedTrx);
            }

            if (data && data.length > 0) {
                const formattedTrx = data.map(dbTrx => {
                    let itemObj = {};
                    if(dbTrx.raw_json) {
                        try {
                            itemObj = JSON.parse(dbTrx.raw_json) || {};
                        } catch(e) {}
                    }
                    if (!itemObj.id && !itemObj.itemId) {
                        itemObj = {
                            itemId: dbTrx.itemId,
                            id: dbTrx.id,
                            timestamp: dbTrx.timestamp,
                            tipe: dbTrx.tipe,
                            valuta: dbTrx.valuta,
                            nominal: parseFloat(dbTrx.nominal),
                            rate: parseFloat(dbTrx.rate),
                            total: parseFloat(dbTrx.total),
                            customerId: dbTrx.id_cif, 
                            customerName: dbTrx.customerName,
                            kasir: dbTrx.kasir,
                            paymentMethod: dbTrx.paymentMethod || 'TUNAI',
                            isOldMoney: dbTrx.isOldMoney == 1,
                            keterangan: dbTrx.keterangan || ''
                        };
                    }
                    itemObj.synced = true; // Tandai sudah tersinkronisasi
                    return itemObj;
                });
                const recentKeys = getRecentlyWrittenTransactionKeys();
                const localPending = adjustedLocalTrx.filter(t => pendingKeys.has(getRealtimeTransactionKey(t)) || recentKeys.has(getRealtimeTransactionKey(t)));
                const nextTransactions = force
                    ? sortRealtimeTransactions(formattedTrx)
                    : mergeRealtimeTransactions([...localPending, ...adjustedLocalTrx], formattedTrx);
                const normalizedTransactions = normalizeStoredTransactions(nextTransactions);
                const beforeTransactions = JSON.parse(localStorage.getItem('mc_transactions') || '[]');
                const beforeSignature = getRealtimeTransactionsSignature(beforeTransactions);
                const afterSignature = getRealtimeTransactionsSignature(normalizedTransactions);
                if (beforeSignature !== afterSignature) {
                    notifyNewRemoteTransactionsIfNeeded(beforeTransactions, normalizedTransactions, { force });
                    try {
                        window.__almaraApplyingRemoteSync = true;
                        localStorage.setItem('mc_transactions', JSON.stringify(normalizedTransactions));
                    } finally {
                        window.__almaraApplyingRemoteSync = false;
                    }
                    if (!silent) console.log("SUKSES: Riwayat Transaksi berhasil ditarik dari MySQL!");
                    if (refreshUi) {
                        const reportsView = document.getElementById('reports-view');
                        const dashboardView = document.getElementById('dashboard-view');
                        const harianView = document.getElementById('harian-view');
                        if (reportsView && reportsView.classList.contains('active') && typeof loadReportsTable === 'function') loadReportsTable();
                        if (dashboardView && dashboardView.classList.contains('active') && typeof loadDashboard === 'function') loadDashboard();
                        if (harianView && harianView.classList.contains('active') && typeof loadLaporanHarian === 'function') loadLaporanHarian();
                    }
                }
            } else {
                const localTrx = JSON.parse(localStorage.getItem('mc_transactions')) || [];
                const trulyUnsynced = localTrx.filter(t => t.synced !== true);
                if (pushLocal && trulyUnsynced.length > 0) {
                    console.log(`Database transaksi kosong. Mengirim ${trulyUnsynced.length} transaksi lokal ke MySQL...`);
                    for (const t of trulyUnsynced) {
                        await saveToMySQL_Transaction(t);
                    }
                    return;
                } else if (localTrx.length > 0) {
                    console.log("[Sync] Database transaksi kosong dan seluruh cache lokal sudah pernah disinkronkan. Mengosongkan data lokal...");
                    try {
                        window.__almaraApplyingRemoteSync = true;
                        localStorage.setItem('mc_transactions', JSON.stringify([]));
                    } finally {
                        window.__almaraApplyingRemoteSync = false;
                    }
                    if (refreshUi) {
                        const reportsView = document.getElementById('reports-view');
                        const dashboardView = document.getElementById('dashboard-view');
                        const harianView = document.getElementById('harian-view');
                        if (reportsView && reportsView.classList.contains('active') && typeof loadReportsTable === 'function') loadReportsTable();
                        if (dashboardView && dashboardView.classList.contains('active') && typeof loadDashboard === 'function') loadDashboard();
                        if (harianView && harianView.classList.contains('active') && typeof loadLaporanHarian === 'function') loadLaporanHarian();
                    }
                }
            }

            if (refreshUi && localTrx.length === 0) refreshActiveRealtimeViews();
        }
    } catch (error) {
        if (!silent) console.error("Gagal menarik Transaksi dari MySQL:", error);
    }
}

function startAlmaraRealtimeSync() {
    if (window.__almaraRealtimeSyncTimer) return;
    window.__transactionRealtimeSyncStarted = true;
    window.__globalRealtimeSyncStarted = true;

    window.__almaraRealtimeSyncTimer = setInterval(async () => {
        if (window.__almaraRealtimeSyncBusy) return;
        window.__almaraRealtimeSyncBusy = true;
        try {
            await syncFromMySQL_Transactions({ pushLocal: false, refreshUi: true, silent: true });
            await syncFromMySQL_Currencies({ refreshUi: true, silent: true });
            await syncFromMySQL_Customers({ refreshUi: true, silent: true });
            await syncUniversalDatastore({ preferRemote: true, refreshUi: true, silent: true });
        } finally {
            window.__almaraRealtimeSyncBusy = false;
        }
    }, 4000);
}

function stopAlmaraRealtimeSync() {
    if (window.__almaraRealtimeSyncTimer) {
        clearInterval(window.__almaraRealtimeSyncTimer);
        window.__almaraRealtimeSyncTimer = null;
    }
    window.__transactionRealtimeSyncStarted = false;
    window.__globalRealtimeSyncStarted = false;
}

window.startAlmaraRealtimeSync = startAlmaraRealtimeSync;
window.stopAlmaraRealtimeSync = stopAlmaraRealtimeSync;
startAlmaraRealtimeSync();

async function saveToMySQL_Transaction(trxObject) {
    const syncKey = trxObject && (trxObject.itemId || trxObject.id);
    window.__almaraTransactionSyncQueue = window.__almaraTransactionSyncQueue || {};
    if (syncKey && window.__almaraTransactionSyncQueue[syncKey]) {
        return window.__almaraTransactionSyncQueue[syncKey];
    }

    window.__almaraActiveTransactionPushes = (window.__almaraActiveTransactionPushes || 0) + 1;
    const syncPromise = (async () => {
        try {
            const response = await fetch('api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(trxObject)
            });
            const rawResponse = await response.text();
            let result = {};
            try {
                result = rawResponse ? JSON.parse(rawResponse) : {};
            } catch (parseError) {
                result = {
                    status: 'error',
                    message: rawResponse || `Respons server tidak valid (${response.status})`
                };
            }

            console.log("Sinkronisasi Transaksi MySQL:", result.message);
            return {
                ok: response.ok && result.status !== 'error',
                status: response.status,
                message: result.message || '',
                data: result.data || null
            };
        } catch (error) {
            console.error("Gagal menyimpan transaksi ke MySQL:", error);
            return {
                ok: false,
                status: 0,
                message: error.message || String(error)
            };
        }
    })();

    if (!syncKey) {
        try {
            return await syncPromise;
        } finally {
            window.__almaraActiveTransactionPushes = Math.max((window.__almaraActiveTransactionPushes || 1) - 1, 0);
        }
    }

    window.__almaraTransactionSyncQueue[syncKey] = syncPromise;
    try {
        return await syncPromise;
    } finally {
        window.__almaraActiveTransactionPushes = Math.max((window.__almaraActiveTransactionPushes || 1) - 1, 0);
        delete window.__almaraTransactionSyncQueue[syncKey];
    }
}

async function deleteFromMySQL_Transaction(id) {
    try {
        const response = await fetch('api/transactions', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: id })
        });
        const result = await response.json();
        console.log("Delete transaction from MySQL:", result);
        return { ok: response.ok, message: result.message || '' };
    } catch (error) {
        console.error("Gagal menghapus transaksi dari MySQL:", error);
        return { ok: false, message: error.message || String(error) };
    }
}
window.deleteFromMySQL_Transaction = deleteFromMySQL_Transaction;

window.pushTransactionsToMySQL = async function(transactions) {
    const rows = (Array.isArray(transactions) ? transactions : [transactions]).filter(Boolean);
    if (rows.length === 0) return [];
    
    try {
        const response = await fetch('api/transactions/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transactions: rows })
        });
        const rawResponse = await response.text();
        let result = {};
        try {
            result = rawResponse ? JSON.parse(rawResponse) : {};
        } catch (parseError) {
            result = { status: 'error', message: rawResponse || `Respons server tidak valid (${response.status})` };
        }
        console.log("Sinkronisasi Bulk Transaksi MySQL:", result.message);
        
        const okStatus = response.ok && result.status !== 'error';
        return rows.map(() => ({
            ok: okStatus,
            status: response.status,
            message: result.message || ''
        }));
    } catch (error) {
        console.error("Gagal menyimpan bulk transaksi ke MySQL:", error);
        return rows.map(() => ({
            ok: false,
            status: 0,
            message: error.message || String(error)
        }));
    }
};

// Fungsi untuk sinkronisasi manual dipicu tombol
window.manualSyncAll = async function() {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Sinkronisasi Database',
            text: 'Sedang mengirim data data dari browser ke MySQL...',
            icon: 'info',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }

    try {
        // Jalankan semua fungsi sinkronisasi utama
        await syncFromMySQL_Currencies();
        await syncFromMySQL_Customers();
        await syncFromMySQL_Transactions();
        await syncUniversalDatastore();
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Sinkronisasi Berhasil!',
                text: 'Semua data telah diperbarui ke MySQL.',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            alert("Sinkronisasi Berhasil!");
        }
        
        // Refresh tabel nasabah jika sedang dibuka
        if (typeof loadCustomersTable === 'function') loadCustomersTable();
        // Refresh tabel transaksi jika sedang dibuka
        if (typeof renderTrxHistory === 'function') renderTrxHistory();
        
    } catch (error) {
        console.error("Sinkronisasi Manual Gagal:", error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Sinkronisasi Gagal',
                text: 'Terjadi kesalahan saat menghubungi server: ' + error.message
            });
        } else {
            alert("Sinkronisasi Gagal: " + error.message);
        }
    }
}

// Background auto-sync 30 detik dimatikan.
// Data tetap ditarik saat aplikasi dibuka dan tetap dikirim ke MySQL saat proses simpan.
