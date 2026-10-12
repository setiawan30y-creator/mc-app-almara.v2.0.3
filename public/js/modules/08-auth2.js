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
        if(document.getElementById('userTableBody')) loadUsersTable();
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
        try { sessionStorage.setItem('mc_currentUser_password', pw); } catch(e) {}
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

function applyRoleAccess(role) {
    const allNavs = document.querySelectorAll('.nav-item');
    const menuKeuangan = document.querySelector('[onclick*="menuKeuangan"]');
    const menuBi = document.querySelector('[onclick*="menuBi"]');
    const userPanel = document.getElementById('userManagementPanel');
    const roleAccessPanel = document.getElementById('roleAccessSettingsPanel');
    const permissionMap = typeof getRolePermissions === 'function' ? getRolePermissions() : {};
    const accessRole = getAccessRoleForUserRole(role);
    const activeConfig = permissionMap[accessRole] || permissionMap.kasir || { menus: [], special: {} };
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
    
    let dangerZone = null;
    try { dangerZone = document.querySelector('button[onclick="resetDatabase()"]').closest('.panel'); } catch(e){}

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
            { key: 'currency-view', label: 'Manajemen Kurs' },
            { key: 'closing-view', label: 'Closing Harian' },
            { key: 'harian-view', label: 'Laporan Harian' },
            { key: 'laporan-posisi-valuta-view', label: 'Rekap Valuta' },
            { key: 'reports-view', label: 'Riwayat Transaksi' },
            { key: 'audit-view', label: 'RWT' },
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
            { key: 'laporan-ekuitas-view', label: 'Ekuitas' },
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

window.loadRoleAccessEditor = function() {
    populateRoleAccessEditorSelect();
    const roleSelect = document.getElementById('roleAccessEditor');
    const menuBox = document.getElementById('roleAccessMenuList');
    const specialBox = document.getElementById('roleAccessSpecialList');
    const actionBox = document.getElementById('roleAccessActionList');
    if (!roleSelect || !menuBox || !specialBox || !actionBox || typeof getRolePermissions !== 'function') return;

    const role = roleSelect.value;
    const permissions = getRolePermissions();
    const config = permissions[role] || { menus: [], special: {}, actions: {} };

    // Get current logged-in user role to filter options
    const currUser = getCurrentUser() || {role: 'kasir'};
    const currRole = String(currUser.role || '').toLowerCase();
    const currAccessRole = getAccessRoleForUserRole(currRole);
    const currConfig = permissions[currAccessRole] || { menus: [], special: {}, actions: {} };

    // Filter menus based on logged in user's permissions
    const filteredMenuGroups = ROLE_ACCESS_MENU_GROUPS.map(group => {
        const items = group.items.filter(item => {
            if (currAccessRole === 'owner') return true;
            return (currConfig.menus || []).includes(item.key);
        });
        return { ...group, items };
    }).filter(group => group.items.length > 0);

    // Filter special options
    const filteredSpecialOptions = ROLE_ACCESS_SPECIAL_OPTIONS.filter(item => {
        if (currAccessRole === 'owner') return true;
        return !!currConfig.special?.[item.key];
    });

    // Filter action options
    const filteredActionOptions = ROLE_ACCESS_ACTION_OPTIONS.filter(item => {
        if (currAccessRole === 'owner') return true;
        return !!currConfig.actions?.[item.key];
    });

    menuBox.innerHTML = filteredMenuGroups.map(group => `
        <div style="border:1px solid rgba(148,163,184,0.18); border-radius:12px; padding:14px; background:rgba(15,23,42,0.35);">
            <div style="font-weight:700; margin-bottom:10px; color:#f8fafc;">${group.title}</div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
                ${group.items.map(item => `
                    <label style="display:flex; align-items:center; gap:8px; padding:10px 12px; border:1px solid rgba(148,163,184,0.25); border-radius:8px; background:rgba(15,23,42,0.45);">
                        <input type="checkbox" class="role-access-menu" value="${item.key}" ${config.menus.includes(item.key) ? 'checked' : ''}>
                        <span>${item.label}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    specialBox.innerHTML = filteredSpecialOptions.map(item => `
        <label style="display:flex; align-items:center; gap:8px; padding:10px 12px; border:1px solid rgba(148,163,184,0.25); border-radius:8px; background:rgba(15,23,42,0.45);">
            <input type="checkbox" class="role-access-special" value="${item.key}" ${config.special?.[item.key] ? 'checked' : ''}>
            <span>${item.label}</span>
        </label>
    `).join('');

    actionBox.innerHTML = filteredActionOptions.map(item => `
        <label style="display:flex; align-items:center; gap:8px; padding:10px 12px; border:1px solid rgba(148,163,184,0.25); border-radius:8px; background:rgba(15,23,42,0.45);">
            <input type="checkbox" class="role-access-action" value="${item.key}" ${config.actions?.[item.key] ? 'checked' : ''}>
            <span>${item.label}</span>
        </label>
    `).join('');
};

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
    alert(`Hak akses role ${role.toUpperCase()} berhasil disimpan.`);
};

window.resetRoleAccessToDefault = function() {
    if (typeof getRolePermissions !== 'function' || typeof saveRolePermissions !== 'function') return;
    const role = document.getElementById('roleAccessEditor')?.value || 'kasir';
    const fresh = JSON.parse(localStorage.getItem('mc_role_permissions')) || {};
    const baseline = {
        owner: { menus: ['dashboard-view','pos-view','customers-view','mutation-view','currency-view','closing-view','harian-view','laporan-posisi-valuta-view','reports-view','audit-view','booking-view','waiting-list-view','translator-view','user-chat-view','valas-gallery-view','documents-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-ekuitas-view','laporan-coretax-view','masterdata-view','settings-view'], special: { menuKeuangan: true, menuBi: true, userManagement: true, accessSettings: true, dangerZone: true, customerImportTools: true, transactionLedgerCard: true }, actions: { edit: true, delete: true, oldMoneyEdit: true, oldMoneyDelete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: true } },
        superadmin: { menus: ['dashboard-view','pos-view','customers-view','mutation-view','currency-view','closing-view','harian-view','laporan-posisi-valuta-view','reports-view','audit-view','booking-view','waiting-list-view','translator-view','user-chat-view','valas-gallery-view','documents-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-ekuitas-view','laporan-coretax-view','masterdata-view','settings-view'], special: { menuKeuangan: true, menuBi: true, userManagement: true, accessSettings: true, dangerZone: true, customerImportTools: true, transactionLedgerCard: true }, actions: { edit: true, delete: true, oldMoneyEdit: true, oldMoneyDelete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: true } },
        admin: { menus: ['dashboard-view','pos-view','customers-view','mutation-view','currency-view','closing-view','harian-view','laporan-posisi-valuta-view','reports-view','audit-view','booking-view','waiting-list-view','translator-view','user-chat-view','valas-gallery-view','documents-view','gantungan-view','old-money-view','expense-view','adjustment-view','investor-view','dtott-view','hris-view','laporan-lku-view','laporan-granular-view','laporan-sipesat-view','laporan-goaml-view','laporan-sipendar-view','laporan-aset-view','laporan-bukubesar-view','laporan-labarugi-view','laporan-neraca-view','laporan-ekuitas-view','laporan-coretax-view','masterdata-view','settings-view'], special: { menuKeuangan: true, menuBi: true, userManagement: false, accessSettings: false, dangerZone: false, customerImportTools: true, transactionLedgerCard: true }, actions: { edit: true, delete: true, oldMoneyEdit: true, oldMoneyDelete: true, export: true, print: true, profit: true, valasProfit: true, trxDate: true, manualInvoice: false } },
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
    alert(`Hak akses default untuk role ${role.toUpperCase()} berhasil dipulihkan.`);
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

async function loadUsersTable() {
    const users = await window.refreshServerUsers();
    const currUser = getCurrentUser() || {role: 'kasir', id: ''};
    let html = '';
    
    users.forEach(u => {
        const uRole = String(u.role || '').toLowerCase();
        // Sembunyikan user owner dari superadmin
        if(currUser.role === 'superadmin' && uRole === 'owner') return;

        let actionBtns = '';
        if(currUser.role === 'owner' || currUser.role === 'superadmin') {
             actionBtns = `
                 <button class="btn btn-sm btn-primary" onclick="editUser('${u.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                 ${u.id !== currUser.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>` : ''}
             `;
        }
        
        const roleMeta = getUserRoleMeta(u.role);
        let roleBadge = `<span class="badge" style="position:static; background:${roleMeta.color};">${roleMeta.label}</span>`;

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
    populateUserRoleSelect();
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
    
    populateUserRoleSelect();
    document.getElementById('editUserId').value = u.id;
    document.getElementById('mUserUsername').value = u.username;
    document.getElementById('mUserFullName').value = u.fullName;
    document.getElementById('mUserPassword').value = ''; 
    const roleSelect = document.getElementById('mUserRole');
    const roleValue = String(u.role || 'kasir').toLowerCase();
    roleSelect.value = roleSelect.querySelector(`option[value="${roleValue}"]`) ? roleValue : getAccessRoleForUserRole(roleValue);
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

async function saveUser() {
    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('mUserUsername').value.trim();
    const fullName = document.getElementById('mUserFullName').value.trim();
    const password = document.getElementById('mUserPassword').value;
    const role = document.getElementById('mUserRole').value;
    
    if(!username || !fullName) {
        alert("Username dan Nama Lengkap wajib diisi!");
        return;
    }
    
    let uploadedPhoto = window._tempUserPhoto || '';
    try {
        if (uploadedPhoto && uploadedPhoto.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
            uploadedPhoto = await window.uploadBase64FileToFolder(uploadedPhoto, 'users/photos', `${username}-foto-user`);
        }
    } catch (uploadError) {
        alert("Gagal upload foto pengguna: " + (uploadError.message || uploadError));
        return;
    }
    
    if(!id && !password) {
        alert("Password wajib diisi untuk pengguna baru!");
        return;
    }

    const response = await window.authFetch('api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, username, fullName, password: password || undefined, role, photo: uploadedPhoto })
    });
    const result = await response.json().catch(() => ({}));
    if(!response.ok) {
        alert(result.message || 'Data pengguna gagal disimpan.');
        return;
    }

    await loadUsersTable();
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
        window.authFetch(`api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
            .then(async response => {
                const result = await response.json().catch(() => ({}));
                if(!response.ok) throw new Error(result.message || 'Pengguna gagal dihapus.');
                await loadUsersTable();
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
            })
            .catch(error => {
                alert(error.message || 'Pengguna gagal dihapus.');
            });
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
    const totalCountEl = document.getElementById('sipesatTotalCount');
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
            if (totalCountEl) totalCountEl.textContent = '0';
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
            if (totalCountEl) totalCountEl.textContent = new Intl.NumberFormat('id-ID').format(customers.length);
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
const SMARTDEAL_AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const SMARTDEAL_SYNC_STATUS_KEY = 'mc_smartdeal_sync_status';

function formatSmartdealSyncTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getSmartdealSyncStatus() {
    try {
        return JSON.parse(localStorage.getItem(SMARTDEAL_SYNC_STATUS_KEY)) || null;
    } catch (e) {
        return null;
    }
}

function setSmartdealSyncStatus(status) {
    const payload = {
        status: status.status || 'info',
        message: status.message || '',
        updatedCount: status.updatedCount || 0,
        source: status.source || 'manual',
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(SMARTDEAL_SYNC_STATUS_KEY, JSON.stringify(payload));
    renderSmartdealSyncStatus();
}

function renderSmartdealSyncStatus() {
    const el = document.getElementById('smartdealSyncStatus');
    if (!el) return;

    const status = getSmartdealSyncStatus();
    if (!status) {
        el.style.borderLeftColor = '#64748b';
        el.style.background = 'rgba(15, 23, 42, 0.45)';
        el.innerHTML = '<strong>Status Sync Smartdeal:</strong> Belum ada riwayat sync.';
        return;
    }

    const palette = {
        success: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.10)', label: 'Berhasil' },
        warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)', label: 'Peringatan' },
        error: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.10)', label: 'Gagal' },
        info: { color: '#64748b', bg: 'rgba(15, 23, 42, 0.45)', label: 'Info' }
    };
    const style = palette[status.status] || palette.info;
    const sourceText = status.source === 'auto' ? 'Auto 10 menit' : 'Manual';
    const countText = status.updatedCount ? ` (${status.updatedCount} valuta diperbarui)` : '';

    el.style.borderLeftColor = style.color;
    el.style.background = style.bg;
    el.innerHTML = `
        <strong>Status Sync Smartdeal:</strong>
        <span style="color:${style.color}; font-weight:700;">${style.label}</span>${countText}
        <span style="color:#94a3b8;"> | Terakhir: ${formatSmartdealSyncTime(status.timestamp)} | ${sourceText}</span><br>
        <span>${status.message}</span>
    `;
}

window.renderSmartdealSyncStatus = renderSmartdealSyncStatus;

async function syncSmartdealRates(evt) {
    const isSilentSync = !!(evt && evt.silent);
    const syncSource = isSilentSync ? 'auto' : 'manual';
    if (window.__smartdealSyncInProgress) {
        if (!isSilentSync && typeof Swal !== 'undefined') {
            Swal.fire('Info', 'Sinkronisasi Smartdeal sedang berjalan.', 'info');
        }
        return;
    }

    window.__smartdealSyncInProgress = true;
    const btn = isSilentSync ? null : ((evt && evt.currentTarget) || document.querySelector('button[onclick="syncSmartdealRates(event)"]') || document.querySelector('button[onclick="syncSmartdealRates()"]'));
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mensinkronisasi...';
        btn.disabled = true;
    }

    try {
        // Tambahkan cache buster (parameter unik hari ini/detik ini) agar proxy tidak menggunakan halaman tersimpan (cached)
        const cacheBuster = new Date().getTime();
        const targetUrl = 'https://smartdeal.co.id/rates/dki_banten?cb=' + cacheBuster;
        
        const proxies = [
            { url: 'api/smartdeal-rates?cb=' + cacheBuster, type: 'local-json' },
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
                
                if (p.type === 'local-json') {
                    const data = await response.json();
                    if (data && data.status === 'success' && data.html) {
                        html = data.html;
                    } else {
                        throw new Error(data?.message || 'Respons backend Smartdeal tidak valid');
                    }
                } else if (p.type === 'json') {
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

        if (!html) throw new Error('Gagal mengambil data Smartdeal lewat backend lokal maupun proxy cadangan. Coba lagi beberapa saat atau gunakan Update via Excel.');
        
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
            const code = String(c.code || '').trim().toUpperCase();
            const baseCode = code.substring(0, 3);
            const sd = smartdealRates[code] || smartdealRates[baseCode];
            if (sd) {
                let marginB = c.margin_buy || 0;
                let marginS = c.margin_sell || 0;
                
                c.base_buy = sd.buy;
                c.base_sell = sd.sell;
                c.buy = sd.buy + marginB;
                c.sell = sd.sell + marginS;
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            saveCurrencies(currencies);
            setSmartdealSyncStatus({
                status: 'success',
                updatedCount,
                source: syncSource,
                message: 'Kurs berhasil diperbarui dari Smartdeal. Margin tetap dipertahankan.'
            });
            if (typeof loadCurrencyTable === 'function') loadCurrencyTable();
            if (typeof loadDashboard === 'function' && document.getElementById('dashboard-view')?.classList.contains('active')) {
                loadDashboard();
            }
            if (isSilentSync) {
                console.log(`[Smartdeal Auto Sync] ${updatedCount} valuta diperbarui.`);
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success', 
                    title: 'Sinkronisasi Selesai!', 
                    text: `${updatedCount} valuta diperbarui dari Smartdeal. Nilai margin/selisih point tetap, lalu kurs beli dan jual dihitung ulang otomatis.`,
                    background: '#1e293b', 
                    color: '#f8fafc'
                });
            } else {
                alert(`Berhasil! ${updatedCount} valuta diperbarui dari Smartdeal. Margin tetap, kurs beli/jual dihitung ulang otomatis.`);
            }
        } else {
            setSmartdealSyncStatus({
                status: 'warning',
                source: syncSource,
                message: 'Sync berhasil mengambil data, tetapi tidak ada kode valuta yang cocok. Kurs terakhir tetap dipakai.'
            });
            if (isSilentSync) {
                console.log('[Smartdeal Auto Sync] Tidak ada valuta yang cocok.');
            } else if (typeof Swal !== 'undefined') {
                Swal.fire('Info', 'Tidak ada Master Valuta di aplikasi Anda yang cocok dengan tabel Smartdeal.', 'info');
            } else {
                alert('Tidak ada kode valuta yang cocok.');
            }
        }

    } catch (e) {
        console.error(e);
        setSmartdealSyncStatus({
            status: 'error',
            source: syncSource,
            message: `Gagal mengambil data Smartdeal. Sistem tetap memakai kurs terakhir yang tersimpan. Detail: ${e.message}`
        });
        if (isSilentSync) {
            console.warn('[Smartdeal Auto Sync] Gagal:', e.message);
        } else if (typeof Swal !== 'undefined') {
            Swal.fire('Error Sync', e.message, 'error');
        } else {
            alert('Error: ' + e.message);
        }
    } finally {
        window.__smartdealSyncInProgress = false;
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

function startSmartdealAutoSync() {
    if (window.__smartdealAutoSyncTimer) return;

    window.__smartdealAutoSyncTimer = setInterval(() => {
        syncSmartdealRates({ silent: true, source: 'auto' });
    }, SMARTDEAL_AUTO_SYNC_INTERVAL_MS);

    console.log('[Smartdeal Auto Sync] Aktif setiap 10 menit.');
}

window.startSmartdealAutoSync = startSmartdealAutoSync;
renderSmartdealSyncStatus();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        renderSmartdealSyncStatus();
        startSmartdealAutoSync();
    });
} else {
    startSmartdealAutoSync();
}

