// Authentication, user management, and external sync modules

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
        if(document.getElementById('userTableBody') && typeof window.loadUsersTable === 'function') window.loadUsersTable();
        if(typeof window.loadRoleAccessEditor === 'function') window.loadRoleAccessEditor();
        
        // Apply RBAC
        applyRoleAccess(user.role);
        if (typeof window.updateHeaderNotificationBadge === 'function') window.updateHeaderNotificationBadge();
    }
}

window.handleAuthLogin = async function handleAuthLogin() {
    const un = document.getElementById('loginUsername').value.trim();
    const pw = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    if(!un || !pw) {
        errorEl.textContent = 'Username dan Password wajib diisi!';
        errorEl.style.display = 'block';
        return;
    }
    
    try {
        const response = await window.authFetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: un, password: pw })
        });
        const result = await response.json().catch(() => ({}));
        if(!response.ok || !result.user) {
            throw new Error(result.message || 'Username atau password salah!');
        }
        const user = result.user;
        if (result.csrfToken && typeof window.setCsrfToken === 'function') {
            window.setCsrfToken(result.csrfToken);
        }
        try { setCurrentUser(user); } catch(e) { localStorage.setItem('mc_currentUser', JSON.stringify(user)); }
        try { localStorage.setItem('mc_last_login_at', String(Date.now())); } catch(e) {}
        errorEl.style.display = 'none';
        if (String(user.role || '').toLowerCase() === 'papan') {
            window.location.href = '/papan-kurs';
            return;
        }
        
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
        
        if (typeof checkAuth === 'function') checkAuth();
        if (typeof window.refreshServerUsers === 'function') window.refreshServerUsers();
    } catch(error) {
        errorEl.textContent = error.message || 'Username atau password salah!';
        errorEl.style.display = 'block';
    }
}

window.mcEnsureSwalDarkStyle = function mcEnsureSwalDarkStyle() {
    if (document.getElementById('mc-swal-dark-style')) return;
    var st = document.createElement('style');
    st.id = 'mc-swal-dark-style';
    st.textContent =
        '.swal2-popup.mc-swal-dark{background:#1e293b!important;color:#f8fafc!important}' +
        '.swal2-popup.mc-swal-dark .swal2-title{color:#f8fafc!important}' +
        '.swal2-popup.mc-swal-dark .swal2-html-container,.swal2-popup.mc-swal-dark .swal2-content{color:#e2e8f0!important}' +
        '.swal2-popup.mc-swal-dark .swal2-confirm,.swal2-popup.mc-swal-dark .swal2-cancel,.swal2-popup.mc-swal-dark .swal2-deny{color:#ffffff!important}';
    document.head.appendChild(st);
};

window.handleLogout = function handleLogout() {
    if (typeof Swal !== 'undefined') {
        window.mcEnsureSwalDarkStyle();
        Swal.fire({
            title: 'Yakin ingin keluar?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#B91C1C',
            cancelButtonColor: '#1D4ED8',
            confirmButtonText: 'Ya, Keluar!',
            cancelButtonText: 'Batal',
            background: '#1e293b',
            color: '#f8fafc',
            customClass: { popup: 'mc-swal-dark' }
        }).then((result) => {
            if (result.isConfirmed) {
                window.authFetch('/logout', { method: 'POST' }).finally(() => {
                    setCurrentUser(null);
                    window.location.reload();
                });
            }
        });
    } else {
        if(confirm("Yakin ingin keluar?")) {
            window.authFetch('/logout', { method: 'POST' }).finally(() => {
                setCurrentUser(null);
                window.location.reload();
            });
        }
    }
}

window.openMyAccountModal = function() {
    const user = getCurrentUser();
    if(!user) return;

    window._tempMyAccountPhoto = user.photo || '';
    document.getElementById('myAccountFullName').value = user.fullName || '';
    document.getElementById('myAccountRole').value = user.role || '';
    document.getElementById('myAccountPhoto').value = '';
    document.getElementById('myAccountPhotoPreview').innerHTML = user.photo
        ? `<img src="${user.photo}" style="max-height:100px; object-fit:cover; border-radius:5px;">`
        : '';
    document.getElementById('myAccountUsername').value = user.username || '';
    document.getElementById('myAccountPassword').value = '';
    document.getElementById('myAccountPasswordConfirm').value = '';
    document.getElementById('myAccountModal').classList.add('show');
};

window.closeMyAccountModal = function() {
    document.getElementById('myAccountModal').classList.remove('show');
};

window.scrollUserProfileForm = function(modalId, direction = 1) {
    const modal = document.getElementById(modalId);
    const content = modal ? modal.querySelector('.modal-content') : null;
    if(!content) return;

    const targetTop = direction < 0 ? 0 : content.scrollHeight;
    content.scrollTo({ top: targetTop, behavior: 'smooth' });
};

window._tempMyAccountPhoto = '';
window.handleMyAccountPhoto = function(input) {
    if(input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            window._tempMyAccountPhoto = e.target.result;
            const preview = document.getElementById('myAccountPhotoPreview');
            if(preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-height:100px; object-fit:cover; border-radius:5px;">`;
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.saveMyAccount = async function() {
    const currentUser = getCurrentUser();
    if(!currentUser) return alert("Sesi login tidak ditemukan.");

    const username = document.getElementById('myAccountUsername').value.trim();
    const password = document.getElementById('myAccountPassword').value;
    const confirmPassword = document.getElementById('myAccountPasswordConfirm').value;

    if(!username) return alert("Username login wajib diisi.");
    if(password || confirmPassword) {
        if(password.length < 6) return alert("Password baru minimal 6 karakter.");
        if(password !== confirmPassword) return alert("Konfirmasi password baru tidak sama.");
    }

    let uploadedPhoto = window._tempMyAccountPhoto || '';
    try {
        if(uploadedPhoto && uploadedPhoto.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
            uploadedPhoto = await window.uploadBase64FileToFolder(uploadedPhoto, 'users/photos', `${username}-foto-profile`);
        }
    } catch(uploadError) {
        alert("Gagal upload foto profil: " + (uploadError.message || uploadError));
        return;
    }

    const response = await window.authFetch('api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            fullName: document.getElementById('myAccountFullName').value.trim() || currentUser.fullName || username,
            photo: uploadedPhoto,
            password: password || undefined
        })
    });
    const result = await response.json().catch(() => ({}));
    if(!response.ok || !result.user) {
        alert(result.message || "Akun login gagal diperbarui.");
        return;
    }
    setCurrentUser(result.user);
    if(typeof window.refreshServerUsers === 'function') await window.refreshServerUsers();

    closeMyAccountModal();
    checkAuth();
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Akun login berhasil diperbarui.',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b',
            color: '#f8fafc'
        });
    } else {
        alert("Akun login berhasil diperbarui.");
    }
};

// Attach account menu to User Info
setTimeout(() => {
    const userInfoWrapper = document.querySelector('.user-info');
    if(userInfoWrapper) {
        userInfoWrapper.style.cursor = 'pointer';
        userInfoWrapper.title = 'Klik untuk edit akun / logout';
        userInfoWrapper.addEventListener('click', openMyAccountModal);
    }
}, 500);

function getAccessRoleForUserRole(role) {
    const cleanRole = String(role || '').toLowerCase();
    if(cleanRole === 'superadmin') return 'superadmin';
    if(cleanRole === 'owner') return 'owner';
    if(cleanRole === 'admin' || cleanRole === 'supervisor') return 'admin';
    if(cleanRole === 'kasir') return 'kasir';
    if(cleanRole === 'papan') return 'papan';
    return 'teller';
}

function getUserRoleMeta(role) {
    const meta = {
        superadmin: { label: 'Superadmin', color: '#EC4899' },
        owner: { label: 'Owner', color: '#8B5CF6' },
        admin: { label: 'Admin', color: '#3B82F6' },
        supervisor: { label: 'Supervisor', color: '#2563EB' },
        kasir: { label: 'Kasir', color: '#10B981' },
        teller: { label: 'Teller', color: '#F59E0B' },
        kurir: { label: 'Kurir', color: '#0EA5E9' },
        keamanan: { label: 'Keamanan', color: '#64748B' },
        papan: { label: 'Papan Kurs', color: '#14B8A6' },
        lainnya: { label: 'Lainnya', color: '#94A3B8' }
    };
    return meta[String(role || '').toLowerCase()] || meta.teller;
}

// ==============================
// AKSES KHUSUS PER PENGGUNA (pengecualian dari hak akses role)
// Disimpan di mc_user_permissions = { [userId]: { menus, special, actions } }
// dan ikut tersinkron lewat Universal Datastore. Akun Owner tidak pernah dibatasi.
// ==============================
function getUserPermissionOverrides() {
    try {
        const parsed = JSON.parse(localStorage.getItem('mc_user_permissions'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
        return {};
    }
}

function saveUserPermissionOverrides(data) {
    localStorage.setItem('mc_user_permissions', JSON.stringify(data || {}));
    if (typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore('mc_user_permissions', data || {});
}

function getEffectiveAccessConfig(user) {
    const permissions = typeof getRolePermissions === 'function' ? getRolePermissions() : {};
    const role = String(user && user.role || '').toLowerCase();
    const base = permissions[getAccessRoleForUserRole(role)] || permissions.kasir || { menus: [], special: {}, actions: {} };
    if (!user || role === 'owner') return base;
    const custom = getUserPermissionOverrides()[String(user.id)];
    if (!custom || !Array.isArray(custom.menus)) return base;
    return {
        menus: custom.menus,
        special: Object.assign({}, base.special, custom.special || {}),
        actions: Object.assign({}, base.actions, custom.actions || {}),
        custom: true
    };
}
window.getEffectiveAccessConfig = getEffectiveAccessConfig;

function applyRoleAccess(role) {
    const allNavs = document.querySelectorAll('.nav-item');
    const menuKeuangan = document.querySelector('[onclick*="menuKeuangan"]');
    const menuBi = document.querySelector('[onclick*="menuBi"]');
    const userPanel = document.getElementById('userManagementPanel');
    const roleAccessPanel = document.getElementById('roleAccessSettingsPanel');
    const permissionMap = typeof getRolePermissions === 'function' ? getRolePermissions() : {};
    const accessRole = getAccessRoleForUserRole(role);
    const sessionUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const activeConfig = (sessionUser && String(sessionUser.role || '').toLowerCase() === String(role || '').toLowerCase())
        ? getEffectiveAccessConfig(sessionUser)
        : (permissionMap[accessRole] || permissionMap.kasir || { menus: [], special: {} });
    const configuredMenus = Array.isArray(activeConfig.menus) ? activeConfig.menus : [];
    const canManageHris = configuredMenus.includes('hris-view');
    const visibleMenus = new Set(configuredMenus);
    visibleMenus.add('hris-view');
    visibleMenus.add('kurs-hari-ini-view');
    visibleMenus.add('pickup-view');
    visibleMenus.add('documents-view');
    visibleMenus.add('ai-chat-view');
    visibleMenus.add('waiting-list-view');
    visibleMenus.add('translator-view');
    visibleMenus.add('user-chat-view');

    // Perwakilan PT (data internal PKS): role pengelola.
    if (['owner', 'superadmin', 'admin', 'supervisor'].includes(accessRole)) visibleMenus.add('pt-rep-view');

    // Almara Regulatory AI: batasi ke role pengelola.
    if (['owner', 'superadmin', 'admin'].includes(accessRole)) {
        visibleMenus.add('almara-regulatory-ai-view');
        visibleMenus.add('almara-regulatory-chat-view');
    }
    
    let dangerZone = null;
    try { dangerZone = document.querySelector('button[onclick="resetSelectedData()"], button[onclick="resetDatabase()"]').closest('.panel'); } catch(e){}

    // Reset visibility first
    allNavs.forEach(nav => {
        nav.style.display = 'flex';
    });
    if(menuKeuangan) menuKeuangan.style.display = 'flex';
    if(menuBi) menuBi.style.display = 'flex';
    if(userPanel) userPanel.style.display = 'block';
    if(roleAccessPanel) roleAccessPanel.style.display = ((accessRole === 'owner' || accessRole === 'superadmin') && activeConfig.special?.accessSettings) ? 'block' : 'none';
    if(dangerZone) dangerZone.style.display = 'block';

    allNavs.forEach(nav => {
        const target = nav.getAttribute('data-target');
        if (target && !visibleMenus.has(target)) {
            nav.style.display = 'none';
        }
    });
    if(menuKeuangan) menuKeuangan.style.display = activeConfig.special?.menuKeuangan ? 'flex' : 'none';
    if(menuBi) menuBi.style.display = activeConfig.special?.menuBi ? 'flex' : 'none';
    if(userPanel) userPanel.style.display = activeConfig.special?.userManagement ? 'block' : 'none';
    if(dangerZone) dangerZone.style.display = activeConfig.special?.dangerZone ? 'block' : 'none';
    document.querySelectorAll('[data-role-special]').forEach(el => {
        const key = el.getAttribute('data-role-special');
        el.style.display = activeConfig.special?.[key] ? '' : 'none';
    });

    let style = document.getElementById('roleAccessRestrictionStyle');
    if (!style) {
        style = document.createElement('style');
        style.id = 'roleAccessRestrictionStyle';
        document.head.appendChild(style);
    }

    const actionConfig = activeConfig.actions || {};

    const restrictions = [];
    if (!actionConfig.edit) {
        restrictions.push(`
            button[onclick*="editCustomer"], button[onclick*="openCustomerModal('"],
            button[onclick*="editTransaction"], button[onclick*="editHistoricalTrx"],
            button[onclick*="openMutationModal"], button[onclick*="openAdjustmentModal"],
            button[onclick*="openOldMoneySupplierModal('"], button[onclick*="openOldMoneyItemModal('"],
            button[onclick*="editOldMoneyTrx"], button[onclick*="removeMasterJob"], button[onclick*="removeMasterCitizen"],
            button[onclick*="demoPosEdit"],
            button[onclick*="'edit'"] {
                display: none !important;
            }
        `);
    }
    if (!actionConfig.delete) {
        restrictions.push(`
            button[onclick*="deleteCustomer"], button[onclick*="voidTransaction"],
            button[onclick*="deleteHistoricalTrx"], button[onclick*="deleteMutation"],
            button[onclick*="deleteAdjustment"], button[onclick*="deleteExpense"],
            button[onclick*="deleteMasterCurrency"], button[onclick*="deleteOldMoneySupplier"],
            button[onclick*="deleteOldMoneyItem"],
            button[onclick*="'delete'"] {
                display: none !important;
            }
        `);
    }
    if (!actionConfig.oldMoneyEdit || !actionConfig.edit) {
        restrictions.push(`
            button[onclick*="editOldMoneyTransaction"] {
                display: none !important;
            }
        `);
    }
    if (!actionConfig.oldMoneyDelete || !actionConfig.delete) {
        restrictions.push(`
            button[onclick*="deleteOldMoneyTransaction"] {
                display: none !important;
            }
        `);
    }
    if (!actionConfig.export) {
        restrictions.push(`
            button[onclick*="export"], button[onclick*="exportTableToExcel"] {
                display: none !important;
            }
        `);
    }
    if (!actionConfig.print) {
        restrictions.push(`
            button[onclick*="window.print()"], button[onclick*="printReceipt"], button[onclick*="printInvoice"], button[onclick*="reprintReceipt"], button[onclick*="demoPosPrint"] {
                display: none !important;
            }
        `);
    }

    if (restrictions.length > 0) {
        style.innerHTML = `
            ${restrictions.join('\n')}
        `;
    } else {
        style.innerHTML = '';
    }

    document.querySelectorAll('.hris-manage-only').forEach(el => {
        el.style.display = canManageHris ? '' : 'none';
    });
    if (!canManageHris) {
        const hrisView = document.getElementById('hris-view');
        const hrisVisible = hrisView && !hrisView.classList.contains('hidden') && hrisView.style.display !== 'none';
        if (hrisVisible && typeof window.switchHrisTab === 'function') {
            window.switchHrisTab('leave');
        } else {
            const empTab = document.getElementById('hris-tab-emp');
            const leaveTab = document.getElementById('hris-tab-leave');
            const leaveBtn = document.getElementById('btn-tab-hris-leave');
            if (empTab) {
                empTab.style.display = 'none';
                empTab.classList.add('hidden');
            }
            if (leaveTab) {
                leaveTab.style.display = 'block';
                leaveTab.classList.remove('hidden');
            }
            if (leaveBtn) {
                leaveBtn.classList.remove('btn-outline');
                leaveBtn.classList.add('btn-primary', 'active');
            }
            if (typeof window.renderHrisScheduleCalendar === 'function') window.renderHrisScheduleCalendar();
        }
    }

    setTimeout(() => {
        const dp = document.getElementById('dashProfit');
        if(dp && dp.closest('.stat-card')) {
            dp.closest('.stat-card').style.display = actionConfig.profit === false ? 'none' : '';
        }
        const oldp = document.getElementById('oldMoneyTotalProfit');
        if(oldp && oldp.closest('.stat-card')) {
            oldp.closest('.stat-card').style.display = actionConfig.profit === false ? 'none' : '';
        }
        const harianProfit = document.getElementById('harianProfit');
        if(harianProfit && harianProfit.closest('.stat-card')) {
            harianProfit.closest('.stat-card').style.display = actionConfig.valasProfit === false ? 'none' : '';
        }
        const trxDateContainer = document.getElementById('posTrxDateContainer');
        if(trxDateContainer) {
            trxDateContainer.style.display = actionConfig.trxDate ? '' : 'none';
        }
        if (typeof applyPosInvoiceManualAccess === 'function') {
            applyPosInvoiceManualAccess();
        }
    }, 100);
}

const ROLE_ACCESS_MENU_GROUPS = [
    {
        title: 'Operasional Utama',
        items: [
            { key: 'dashboard-view', label: 'Dashboard' },
            { key: 'pos-view', label: 'Transaksi / POS' },
            { key: 'demo-pos-view', label: 'Demo Transaksi' },
            { key: 'customers-view', label: 'Data Nasabah' },
            { key: 'pt-rep-view', label: 'Perwakilan PT' },
            { key: 'currency-view', label: 'Manajemen Kurs' },
            { key: 'letter-number-view', label: 'Nomor Surat' },
            { key: 'closing-view', label: 'Closing Harian' },
            { key: 'harian-view', label: 'Laporan Harian' },
            { key: 'laporan-posisi-valuta-view', label: 'Rekap Valuta' },
            { key: 'reports-view', label: 'Riwayat Transaksi' },
            { key: 'booking-view', label: 'Daftar Booking' },
            { key: 'valas-gallery-view', label: 'Galeri Valas' },
            { key: 'documents-view', label: 'Penyimpanan Berkas' },
            { key: 'ai-chat-view', label: 'Tanya AI / Deteksi Valas' },
            { key: 'gantungan-view', label: 'Catatan Gantungan' },
            { key: 'old-money-view', label: 'Koin & Uang Lama' }
        ]
    },
    {
        title: 'Keuangan & Pendukung',
        items: [
            { key: 'mutation-view', label: 'Mutasi Kas / Bank' },
            { key: 'expense-view', label: 'Biaya Operasional' },
            { key: 'adjustment-view', label: 'Penyesuaian Stok' },
            { key: 'investor-view', label: 'Penanam Saham' },
            { key: 'dtott-view', label: 'DTOTT' },
            { key: 'hris-view', label: 'HRIS / Karyawan' },
            { key: 'masterdata-view', label: 'Master Data' },
            { key: 'settings-view', label: 'Pengaturan' }
        ]
    },
    {
        title: 'Laporan BI & Akuntansi',
        items: [
            { key: 'laporan-lku-view', label: 'LKU BI' },
            { key: 'laporan-granular-view', label: 'Granular BI' },
            { key: 'laporan-sipesat-view', label: 'Sipesat BI' },
            { key: 'laporan-goaml-view', label: 'GoAML BI' },
            { key: 'laporan-sipendar-view', label: 'Sipendar BI' },
            { key: 'laporan-aset-view', label: 'Aset & Penyusutan' },
            { key: 'laporan-bukubesar-view', label: 'Buku Besar' },
            { key: 'laporan-labarugi-view', label: 'Laba Rugi' },
            { key: 'laporan-neraca-view', label: 'Neraca' },
            { key: 'laporan-coretax-view', label: 'CoreTax' }
        ]
    }
];

const ROLE_ACCESS_SPECIAL_OPTIONS = [
    { key: 'menuKeuangan', label: 'Accordion Menu Keuangan' },
    { key: 'menuBi', label: 'Accordion Laporan BI' },
    { key: 'userManagement', label: 'Manajemen Pengguna' },
    { key: 'accessSettings', label: 'Setting Hak Akses' },
    { key: 'dangerZone', label: 'Danger Zone / Reset Data' },
    { key: 'customerImportTools', label: 'Kartu Import/Reset Nasabah' },
    { key: 'transactionLedgerCard', label: 'Kartu Transaksi (Buku Besar)' },
    { key: 'oldMoneySupplierManagement', label: 'Master Suplayer / Pengepul & Acuan Harga' },
    { key: 'closingHistoryReset', label: 'Reset Riwayat Closing Harian' }
];

const ROLE_ACCESS_ACTION_OPTIONS = [
    { key: 'edit', label: 'Tombol Edit / Ubah' },
    { key: 'delete', label: 'Tombol Hapus / Void' },
    { key: 'oldMoneyEdit', label: 'Edit Koin & Uang Lama' },
    { key: 'oldMoneyDelete', label: 'Hapus Koin & Uang Lama' },
    { key: 'export', label: 'Tombol Export / Excel' },
    { key: 'print', label: 'Tombol Print / Cetak' },
    { key: 'profit', label: 'Kartu Profit / Laba' },
    { key: 'valasProfit', label: 'Profit Transaksi Valas' },
    { key: 'trxDate', label: 'Kolom Tanggal Transaksi' },
    { key: 'manualInvoice', label: 'Manual No. Invoice Transaksi' }
];

function populateUserRoleSelect() {
    const roleSelect = document.getElementById('mUserRole');
    if (!roleSelect) return;
    
    const currUser = getCurrentUser() || {role: 'kasir'};
    const currRole = String(currUser.role || '').toLowerCase();
    
    let html = '';
    if (currRole === 'owner') {
        html += `
            <option value="owner">Owner (Admin Super)</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="kasir">Kasir</option>
            <option value="teller">Teller</option>
            <option value="kurir">Kurir</option>
            <option value="keamanan">Keamanan / Satpam</option>
            <option value="papan">Papan Kurs</option>
            <option value="lainnya">Lainnya</option>
        `;
    } else if (currRole === 'superadmin') {
        html += `
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="kasir">Kasir</option>
            <option value="teller">Teller</option>
            <option value="kurir">Kurir</option>
            <option value="keamanan">Keamanan / Satpam</option>
            <option value="papan">Papan Kurs</option>
            <option value="lainnya">Lainnya</option>
        `;
    } else {
        html += `
            <option value="admin">Admin</option>
            <option value="supervisor">Supervisor</option>
            <option value="kasir">Kasir</option>
            <option value="teller">Teller</option>
        `;
    }
    roleSelect.innerHTML = html;
}

function populateRoleAccessEditorSelect() {
    const accessSelect = document.getElementById('roleAccessEditor');
    if (!accessSelect) return;
    
    const currUser = getCurrentUser() || {role: 'kasir'};
    const currRole = String(currUser.role || '').toLowerCase();
    
    const prevVal = accessSelect.value;
    
    let html = '';
    if (currRole === 'owner') {
        html += `
            <option value="owner">Owner</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="kasir">Kasir</option>
            <option value="teller">Teller</option>
        `;
    } else if (currRole === 'superadmin') {
        html += `
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="kasir">Kasir</option>
            <option value="teller">Teller</option>
        `;
    } else {
        html += `
            <option value="admin">Admin</option>
            <option value="kasir">Kasir</option>
            <option value="teller">Teller</option>
        `;
    }
    accessSelect.innerHTML = html;
    
    if (prevVal && accessSelect.querySelector(`option[value="${prevVal}"]`)) {
        accessSelect.value = prevVal;
    } else {
        accessSelect.value = currRole === 'owner' ? 'owner' : 'superadmin';
    }
}

window.saveRoleAccessSettings = function() {
    if (typeof getRolePermissions !== 'function' || typeof saveRolePermissions !== 'function') return;
    const role = document.getElementById('roleAccessEditor')?.value || 'kasir';
    const permissions = getRolePermissions();
    const currentRolePermissions = permissions[role] || { menus: [], special: {}, actions: {} };

    const currUser = getCurrentUser() || {role: 'kasir'};
    const currRole = String(currUser.role || '').toLowerCase();
    const currAccessRole = getAccessRoleForUserRole(currRole);
    const currConfig = permissions[currAccessRole] || { menus: [], special: {}, actions: {} };

    const checkedMenus = Array.from(document.querySelectorAll('.role-access-menu:checked')).map(el => el.value);
    const checkedSpecials = {};
    document.querySelectorAll('.role-access-special').forEach(el => {
        checkedSpecials[el.value] = el.checked;
    });
    const checkedActions = {};
    document.querySelectorAll('.role-access-action').forEach(el => {
        checkedActions[el.value] = el.checked;
    });

    let finalMenus = [];
    let finalSpecial = { ...(currentRolePermissions.special || {}) };
    let finalActions = { ...(currentRolePermissions.actions || {}) };

    if (currAccessRole === 'owner') {
        finalMenus = checkedMenus;
        document.querySelectorAll('.role-access-special').forEach(el => {
            finalSpecial[el.value] = el.checked;
        });
        document.querySelectorAll('.role-access-action').forEach(el => {
            finalActions[el.value] = el.checked;
        });
    } else {
        // Non-owner (like superadmin): merge user edits with existing permissions for keys the user CANNOT access
        // 1. Menus
        const preservedMenus = (currentRolePermissions.menus || []).filter(m => !(currConfig.menus || []).includes(m));
        finalMenus = [...checkedMenus, ...preservedMenus];

        // 2. Special
        ROLE_ACCESS_SPECIAL_OPTIONS.forEach(item => {
            const hasControl = !!currConfig.special?.[item.key];
            if (hasControl) {
                finalSpecial[item.key] = checkedSpecials[item.key] || false;
            }
        });

        // 3. Actions
        ROLE_ACCESS_ACTION_OPTIONS.forEach(item => {
            const hasControl = !!currConfig.actions?.[item.key];
            if (hasControl) {
                finalActions[item.key] = checkedActions[item.key] || false;
            }
        });
    }

    permissions[role] = {
        menus: finalMenus,
        special: finalSpecial,
        actions: finalActions
    };

    saveRolePermissions(permissions);
    const currentUser = getCurrentUser();
    if (currentUser) applyRoleAccess(currentUser.role);
    (window.uaToast ? window.uaToast('success', `Hak akses role ${role.toUpperCase()} berhasil disimpan.`) : alert(`Hak akses role ${role.toUpperCase()} berhasil disimpan.`));
};

window.resetRoleAccessToDefault = function() {
    if (typeof getRolePermissions !== 'function' || typeof saveRolePermissions !== 'function') return;
    const role = document.getElementById('roleAccessEditor')?.value || 'kasir';
    const fresh = JSON.parse(localStorage.getItem('mc_role_permissions')) || {};
    const baseline = {
        owner: { menus: ['dashboard-view','pos-view','customers-view','pt-rep-view','mutation-view','currency-view','closing-view','harian-view','laporan-posisi-valuta-view','reports-view','booking-view','waiting-list-view','translator-view','user-chat-view','valas-gallery-view','documents-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-coretax-view','masterdata-view','settings-view','almara-regulatory-ai-view'], special: { menuKeuangan: true, menuBi: true, userManagement: true, accessSettings: true, dangerZone: true, customerImportTools: true, transactionLedgerCard: true }, actions: { edit: true, delete: true, oldMoneyEdit: true, oldMoneyDelete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: true } },
        superadmin: { menus: ['dashboard-view','pos-view','customers-view','pt-rep-view','mutation-view','currency-view','closing-view','harian-view','laporan-posisi-valuta-view','reports-view','booking-view','waiting-list-view','translator-view','user-chat-view','valas-gallery-view','documents-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-coretax-view','masterdata-view','settings-view','almara-regulatory-ai-view'], special: { menuKeuangan: true, menuBi: true, userManagement: true, accessSettings: true, dangerZone: true, customerImportTools: true, transactionLedgerCard: true }, actions: { edit: true, delete: true, oldMoneyEdit: true, oldMoneyDelete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: true } },
        admin: { menus: ['dashboard-view','pos-view','customers-view','pt-rep-view','mutation-view','currency-view','closing-view','harian-view','laporan-posisi-valuta-view','reports-view','booking-view','waiting-list-view','translator-view','user-chat-view','valas-gallery-view','documents-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-coretax-view','masterdata-view','settings-view'], special: { menuKeuangan: true, menuBi: true, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: true, transactionLedgerCard: true }, actions: { edit: true, delete: true, oldMoneyEdit: true, oldMoneyDelete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: false } },
        kasir: { menus: ['dashboard-view','pos-view','customers-view','mutation-view','closing-view','harian-view','reports-view','valas-gallery-view','documents-view','gantungan-view','waiting-list-view','translator-view','user-chat-view','old-money-view','masterdata-view','settings-view'], special: { menuKeuangan: false, menuBi: false, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: false, transactionLedgerCard: false }, actions: { edit: false, delete: false, oldMoneyEdit: false, oldMoneyDelete: false, export: false, print: false, profit: false, valasProfit: false, trxDate: false, manualInvoice: false } },
        teller: { menus: ['dashboard-view','pos-view','customers-view','mutation-view','closing-view','harian-view','reports-view','valas-gallery-view','documents-view','gantungan-view','waiting-list-view','translator-view','user-chat-view','old-money-view','masterdata-view','settings-view'], special: { menuKeuangan: false, menuBi: false, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: false, transactionLedgerCard: false }, actions: { edit: false, delete: false, oldMoneyEdit: false, oldMoneyDelete: false, export: false, print: false, profit: false, valasProfit: false, trxDate: false, manualInvoice: false } }
    };
    // Keep reset-to-default aligned with the master permission definition.
    Object.keys(baseline).forEach((roleKey) => {
        baseline[roleKey].special.oldMoneySupplierManagement = ['owner', 'superadmin', 'admin'].includes(roleKey);
        baseline[roleKey].special.closingHistoryReset = ['owner', 'superadmin'].includes(roleKey);
        if (['owner', 'superadmin', 'admin'].includes(roleKey) && !baseline[roleKey].menus.includes('demo-pos-view')) {
            baseline[roleKey].menus.splice(baseline[roleKey].menus.indexOf('pos-view') + 1, 0, 'demo-pos-view');
        }
    });
    fresh[role] = baseline[role];
    saveRolePermissions(fresh);
    window.loadRoleAccessEditor();
    const currentUser = getCurrentUser();
    if (currentUser) applyRoleAccess(currentUser.role);
    (window.uaToast ? window.uaToast('success', `Hak akses default role ${role.toUpperCase()} berhasil dipulihkan.`) : alert(`Hak akses default role ${role.toUpperCase()} berhasil dipulihkan.`));
};

// ==============================
// USER MANAGEMENT LOGIC
// ==============================

window.refreshServerUsers = async function refreshServerUsers() {
    try {
        const response = await window.authFetch('api/users', { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if(response.ok && Array.isArray(result.data)) {
            saveUsers(result.data);
            return result.data;
        }
    } catch(error) {
        console.warn('Gagal mengambil daftar user dari server:', error);
    }
    return getUsers();
};

// Laporan CoreTax: lihat 56-coretax.js

// Laporan SIPESAT: lihat 67-sipesat.js
