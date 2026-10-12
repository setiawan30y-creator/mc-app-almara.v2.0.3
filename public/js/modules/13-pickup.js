// Modul Manajemen Serah Terima & Pickup Valas (Ojol-Style)

function getPickups() {
    return window.safeArrayGet ? window.safeArrayGet('mc_valas_pickups') : (JSON.parse(localStorage.getItem('mc_valas_pickups')) || []);
}

function savePickups(data) {
    localStorage.setItem('mc_valas_pickups', JSON.stringify(data));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_valas_pickups', data);
    }
}

// Format number helper
function formatIdrNoPrefix(val) {
    return Number(val || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Inisialisasi awal halaman pickup
window.initPickupView = function() {
    loadPickupsTable();
    renderPickupSummary();
    populateCurrenciesInCreateForm();
};

// Merender ringkasan stats di bagian atas
function renderPickupSummary() {
    const data = getPickups();
    let totalAktif = 0;
    let totalTransitIdr = 0;
    let totalSelesaiHariIni = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    data.forEach(item => {
        if (['REQUESTED', 'PICKED_UP', 'DELIVERED'].includes(item.status)) {
            totalAktif++;
            if (item.status === 'PICKED_UP' || item.status === 'REQUESTED') {
                totalTransitIdr += parseFloat(item.estimated_total_idr || 0);
            }
        }
        if (item.status === 'COMPLETED') {
            const completedDate = item.completed_time ? item.completed_time.split('T')[0] : '';
            if (completedDate === todayStr) {
                totalSelesaiHariIni++;
            }
        }
    });

    const aktifEl = document.getElementById('pickupStatActive');
    const transitEl = document.getElementById('pickupStatTransit');
    const selesaiEl = document.getElementById('pickupStatCompletedToday');

    if (aktifEl) aktifEl.textContent = totalAktif;
    if (transitEl) transitEl.textContent = 'Rp ' + formatIdrNoPrefix(totalTransitIdr);
    if (selesaiEl) selesaiEl.textContent = totalSelesaiHariIni;
}

// Mengambil list mata uang aktif dari master
function getActiveCurrencies() {
    try {
        return JSON.parse(localStorage.getItem('mc_currencies')) || [];
    } catch(e) {
        return [];
    }
}

// Populasi dropdown valuta di form tambah
function populateCurrenciesInCreateForm() {
    const currencies = getActiveCurrencies();
    const container = document.getElementById('createPickupCurrenciesContainer');
    if (!container) return;

    // Reset container
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 2fr 1.5fr 2fr 0.5fr; gap: 10px; align-items: center; margin-bottom: 8px;" id="pickupCurrencesHeader">
            <div style="font-size: 0.8rem; color: #94a3b8; font-weight: bold;">Valuta</div>
            <div style="font-size: 0.8rem; color: #94a3b8; font-weight: bold;">Jumlah (Nominal)</div>
            <div style="font-size: 0.8rem; color: #94a3b8; font-weight: bold;">Estimasi Kurs Jual</div>
            <div></div>
        </div>
        <div id="pickupCurrencyRows">
            <!-- Dynamic Rows -->
        </div>
        <button type="button" class="btn btn-sm btn-outline mt-2" onclick="addPickupCurrencyRow()"><i class="fa-solid fa-plus"></i> Tambah Baris Valas</button>
    `;

    // Add first row
    addPickupCurrencyRow();
}

// Tambah baris valuta baru di modal
window.addPickupCurrencyRow = function(valuta = '', nominal = '', rate = '') {
    const rowsContainer = document.getElementById('pickupCurrencyRows');
    if (!rowsContainer) return;

    const rowId = 'pRow_' + Date.now() + '_' + Math.random().toString().slice(-4);
    const currencies = getActiveCurrencies();
    let optionsHtml = '<option value="">-- Pilih --</option>';

    currencies.forEach(curr => {
        const selected = curr.code === valuta ? 'selected' : '';
        optionsHtml += `<option value="${curr.code}" data-sell="${curr.sell}" ${selected}>${curr.code} - ${curr.label || ''}</option>`;
    });

    const rowHtml = document.createElement('div');
    rowHtml.id = rowId;
    rowHtml.className = 'pickup-currency-row';
    rowHtml.style = 'display: grid; grid-template-columns: 2fr 1.5fr 2fr 0.5fr; gap: 10px; align-items: center; margin-bottom: 8px;';
    
    rowHtml.innerHTML = `
        <div>
            <select class="form-control pickup-sel-valuta" style="background:#0f172a; color:#fff;" onchange="handlePickupValutaChange(this)">
                ${optionsHtml}
            </select>
        </div>
        <div>
            <input type="number" class="form-control pickup-input-qty" placeholder="0" min="0" step="any" value="${nominal}" oninput="calculatePickupRowTotal()">
        </div>
        <div>
            <input type="number" class="form-control pickup-input-rate" placeholder="0" min="0" step="any" value="${rate}" oninput="calculatePickupRowTotal()">
        </div>
        <div>
            <button type="button" class="btn btn-sm btn-danger" style="padding: 6px 10px;" onclick="removePickupCurrencyRow('${rowId}')"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;

    rowsContainer.appendChild(rowHtml);
};

window.removePickupCurrencyRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        calculatePickupRowTotal();
    }
};

window.handlePickupValutaChange = function(selectEl) {
    const option = selectEl.options[selectEl.selectedIndex];
    const sellRate = option.getAttribute('data-sell') || 0;
    const row = selectEl.closest('.pickup-currency-row');
    if (row) {
        const rateInput = row.querySelector('.pickup-input-rate');
        if (rateInput) {
            rateInput.value = sellRate;
        }
        calculatePickupRowTotal();
    }
};

window.calculatePickupRowTotal = function() {
    let totalEstIdr = 0;
    const rows = document.querySelectorAll('.pickup-currency-row');
    
    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.pickup-input-qty')?.value) || 0;
        const rate = parseFloat(row.querySelector('.pickup-input-rate')?.value) || 0;
        totalEstIdr += qty * rate;
    });

    const totalEl = document.getElementById('createPickupTotalEstIdr');
    if (totalEl) {
        totalEl.textContent = 'Rp ' + formatIdrNoPrefix(totalEstIdr);
    }
};

// Mengambil list kurir (user role kurir)
async function fetchCouriersList() {
    let users = [];
    try {
        const local = localStorage.getItem('mc_users');
        if (local) users = JSON.parse(local);
    } catch(e){}

    if (!users || users.length === 0) {
        try {
            const resp = await fetch('api/users');
            if (resp.ok) {
                const res = await resp.json();
                users = res.data || [];
            }
        } catch(e){}
    }

    let couriers = users.filter(u => String(u.role).toLowerCase() === 'kurir');
    if (couriers.length === 0) {
        couriers = users; // Fallback jika tidak ada kurir spesifik
    }
    return couriers;
}

// Membuka modal buat pickup
window.openCreatePickupModal = async function() {
    const selectCourier = document.getElementById('createPickupCourier');
    if (selectCourier) {
        selectCourier.innerHTML = '<option value="">-- Memuat Kurir... --</option>';
        const couriers = await fetchCouriersList();
        
        let html = '<option value="">-- Pilih Kurir / Driver --</option>';
        couriers.forEach(c => {
            html += `<option value="${c.id}" data-name="${c.fullName || c.username}">${c.fullName || c.username} (${String(c.role).toUpperCase()})</option>`;
        });
        selectCourier.innerHTML = html;
    }

    populateCurrenciesInCreateForm();
    const totalEl = document.getElementById('createPickupTotalEstIdr');
    if (totalEl) totalEl.textContent = 'Rp 0';
    
    document.getElementById('createPickupForm').reset();
    document.getElementById('createPickupModal').style.display = 'flex';
};

window.closeCreatePickupModal = function() {
    document.getElementById('createPickupModal').style.display = 'none';
};

// Menyimpan pickup baru
window.saveNewPickup = function() {
    const courierSelect = document.getElementById('createPickupCourier');
    const courierId = courierSelect.value;
    const option = courierSelect.options[courierSelect.selectedIndex];
    const courierName = option ? option.getAttribute('data-name') : '';

    const vehicleType = document.getElementById('createPickupVehicleType').value;
    const vehiclePlate = document.getElementById('createPickupVehiclePlate').value.trim();
    const destination = document.getElementById('createPickupDestination').value.trim();
    const notes = document.getElementById('createPickupNotes').value.trim();

    if (!courierId) {
        alert("Pilih kurir / driver terlebih dahulu!");
        return;
    }
    if (!destination) {
        alert("Masukkan lokasi tujuan pengantaran!");
        return;
    }

    // Collect currencies
    const currencies = [];
    let estimatedTotalIdr = 0;
    const rows = document.querySelectorAll('.pickup-currency-row');
    
    let hasInvalidRow = false;
    rows.forEach(row => {
        const valuta = row.querySelector('.pickup-sel-valuta').value;
        const qty = parseFloat(row.querySelector('.pickup-input-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.pickup-input-rate').value) || 0;

        if (!valuta || qty <= 0 || rate <= 0) {
            hasInvalidRow = true;
            return;
        }

        const estTotal = qty * rate;
        estimatedTotalIdr += estTotal;
        currencies.push({
            code: valuta,
            amount: qty,
            estimated_rate: rate,
            estimated_total: estTotal,
            realized_rate: null,
            realized_total: null
        });
    });

    if (hasInvalidRow || currencies.length === 0) {
        alert("Harap lengkapi semua baris valuta (pilih kode, isi qty > 0, dan rate > 0)!");
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('mc_currentUser')) || { username: 'System', fullName: 'System' };

    // Generate random 4-digit PIN OTP
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    const data = getPickups();
    const seq = data.length + 1;
    const pickupNo = 'ALM-PKP-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + String(seq).padStart(3, '0');

    const timestamp = new Date().toISOString();

    const newPickup = {
        id: 'PKP-' + Date.now().toString(),
        pickup_no: pickupNo,
        status: 'REQUESTED', // status awal
        courier_id: courierId,
        courier_name: courierName,
        vehicle_type: vehicleType,
        vehicle_plate: vehiclePlate,
        destination: destination,
        sender_id: currentUser.id || 'u1',
        sender_name: currentUser.fullName || currentUser.username,
        currencies: currencies,
        estimated_total_idr: estimatedTotalIdr,
        realized_total_idr: null,
        verification_pin: pin,
        photo_pickup: '',
        photo_proof: '',
        recipient_name: '',
        notes: notes,
        pickup_time: null,
        delivered_time: null,
        completed_time: null,
        created_at: timestamp,
        updated_at: timestamp,
        history: [
            {
                status: 'REQUESTED',
                timestamp: timestamp,
                user: currentUser.fullName || currentUser.username,
                notes: 'Permintaan pickup dibuat'
            }
        ]
    };

    data.push(newPickup);
    savePickups(data);

    closeCreatePickupModal();
    initPickupView();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Permintaan Pickup Berhasil Dibuat',
            html: `Nomor: <strong>${pickupNo}</strong><br>OTP Verifikasi: <strong style="font-size: 1.4rem; color: #f59e0b; letter-spacing: 2px;">${pin}</strong>`,
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#38bdf8'
        });
    } else {
        alert(`Pickup berhasil dibuat!\nNo: ${pickupNo}\nPIN OTP: ${pin}`);
    }
};

// Render tabel utama
window.loadPickupsTable = function() {
    const data = getPickups();
    const activeContainer = document.getElementById('pickupActiveList');
    const historyTbody = document.getElementById('pickupHistoryTableBody');

    if (!activeContainer || !historyTbody) return;

    const currentUser = JSON.parse(localStorage.getItem('mc_currentUser')) || { id: '', role: 'kasir' };
    const isCourier = String(currentUser.role).toLowerCase() === 'kurir';

    // Bersihkan kontainer
    activeContainer.innerHTML = '';
    historyTbody.innerHTML = '';

    // Sort Descending
    const sorted = data.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let activeCount = 0;
    let historyCount = 0;

    sorted.forEach(item => {
        const isCompletedOrCancelled = ['COMPLETED', 'CANCELLED'].includes(item.status);

        if (!isCompletedOrCancelled) {
            activeCount++;
            // Render ojol-style card for active ones
            const card = renderOjolCard(item, currentUser);
            activeContainer.appendChild(card);
        } else {
            historyCount++;
            // Render row in history table
            const row = renderHistoryRow(item);
            historyTbody.appendChild(row);
        }
    });

    if (activeCount === 0) {
        activeContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 40px; background: rgba(30, 41, 59, 0.3); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.06);">
                <i class="fa-solid fa-truck-fast" style="font-size: 3rem; margin-bottom: 15px; color: #64748b; opacity: 0.5;"></i>
                <p style="margin: 0; font-size: 1rem; font-weight: 500;">Tidak Ada Penugasan / Pickup Aktif</p>
                <span style="font-size: 0.82rem; color: #64748b;">Gunakan tombol "Buat Permintaan Pickup Baru" untuk mengirim valas keluar</span>
            </div>
        `;
    }

    if (historyCount === 0) {
        historyTbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 20px;">Belum ada riwayat serah terima selesai.</td></tr>`;
    }
};

// Pembantu render kartu ojol aktif
function renderOjolCard(item, currentUser) {
    const card = document.createElement('div');
    card.className = 'panel';
    card.style = 'background: #1e293b; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);';

    // Status styling
    let statusLabel = '';
    let statusBg = '';
    let borderLeft = '';

    switch (item.status) {
        case 'REQUESTED':
            statusLabel = 'Menunggu Pickup';
            statusBg = '#f59e0b'; // Orange
            borderLeft = '6px solid #f59e0b';
            break;
        case 'PICKED_UP':
            statusLabel = 'Dalam Perjalanan';
            statusBg = '#3b82f6'; // Blue
            borderLeft = '6px solid #3b82f6';
            break;
        case 'DELIVERED':
            statusLabel = 'Terjual / Tiba di Tujuan';
            statusBg = '#10b981'; // Green
            borderLeft = '6px solid #10b981';
            break;
    }

    card.style.borderLeft = borderLeft;

    // Build timeline HTML
    const timelineHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 20px; position: relative; padding: 0 10px;">
            <div style="position: absolute; left: 20px; right: 20px; height: 3px; background: #334155; top: 11px; z-index: 1;"></div>
            <div style="position: absolute; left: 20px; width: ${item.status === 'REQUESTED' ? '0%' : item.status === 'PICKED_UP' ? '50%' : '100%'}; height: 3px; background: #38bdf8; top: 11px; z-index: 2; transition: width 0.3s ease;"></div>
            
            <div style="z-index: 3; text-align: center; display: flex; flex-direction: column; align-items: center; font-size: 0.75rem;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: #38bdf8; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold;"><i class="fa-solid fa-file-invoice" style="font-size: 0.65rem;"></i></div>
                <span style="color: #f8fafc; font-weight: 600; margin-top: 5px;">Dibuat</span>
            </div>
            <div style="z-index: 3; text-align: center; display: flex; flex-direction: column; align-items: center; font-size: 0.75rem;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${['PICKED_UP', 'DELIVERED'].includes(item.status) ? '#38bdf8' : '#334155'}; color: ${['PICKED_UP', 'DELIVERED'].includes(item.status) ? '#fff' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-weight: bold;"><i class="fa-solid fa-motorcycle" style="font-size: 0.65rem;"></i></div>
                <span style="color: ${['PICKED_UP', 'DELIVERED'].includes(item.status) ? '#f8fafc' : '#64748b'}; font-weight: ${['PICKED_UP', 'DELIVERED'].includes(item.status) ? '600' : 'normal'}; margin-top: 5px;">Bawa Valas</span>
            </div>
            <div style="z-index: 3; text-align: center; display: flex; flex-direction: column; align-items: center; font-size: 0.75rem;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${item.status === 'DELIVERED' ? '#38bdf8' : '#334155'}; color: ${item.status === 'DELIVERED' ? '#fff' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-weight: bold;"><i class="fa-solid fa-check-double" style="font-size: 0.65rem;"></i></div>
                <span style="color: ${item.status === 'DELIVERED' ? '#f8fafc' : '#64748b'}; font-weight: ${item.status === 'DELIVERED' ? '600' : 'normal'}; margin-top: 5px;">Terjual / Tiba</span>
            </div>
        </div>
    `;

    // Valas List rendering
    let valasListHtml = '';
    item.currencies.forEach(c => {
        valasListHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="color: #38bdf8;">${c.code}</strong>
                    <span style="color: #94a3b8; font-size: 0.85rem;">x ${formatIdrNoPrefix(c.amount)}</span>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: #f8fafc; font-weight: 500;">Est: @${formatIdrNoPrefix(c.estimated_rate)}</div>
                    ${c.realized_rate ? `<div style="font-size: 0.75rem; color: #10b981; font-weight: 600;">Real: @${formatIdrNoPrefix(c.realized_rate)}</div>` : ''}
                </div>
            </div>
        `;
    });

    // Verification Code display for non-courier or when picked up
    // Show PIN/OTP in a clean badge
    const isUserCourierObj = String(currentUser.role).toLowerCase() === 'kurir';
    let pinBadgeHtml = '';
    if (!isUserCourierObj) {
        pinBadgeHtml = `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <span style="color: #f59e0b; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">PIN OTP SERAH TERIMA</span>
                <strong style="font-size: 1.1rem; color: #f59e0b; letter-spacing: 1px;" id="pinLabelFor_${item.id}">${item.verification_pin}</strong>
            </div>
        `;
    }

    // Action buttons based on role and status
    let actionButtonsHtml = '';
    if (item.status === 'REQUESTED') {
        if (isUserCourierObj && currentUser.id === item.courier_id) {
            actionButtonsHtml = `
                <button class="btn btn-warning w-100" style="margin-top: 15px; font-weight: bold; background: #f59e0b; color:#fff;" onclick="window.openPickupStartModal('${item.id}')">
                    <i class="fa-solid fa-motorcycle"></i> Konfirmasi Terima & Bawa Valas
                </button>
            `;
        } else if (!isUserCourierObj) {
            actionButtonsHtml = `
                <div style="display: flex; gap: 8px; margin-top: 15px;">
                    <button class="btn btn-outline btn-sm text-danger" style="flex: 1; border-color: rgba(239, 68, 68, 0.3);" onclick="window.cancelPickup('${item.id}')">
                        <i class="fa-solid fa-ban"></i> Batalkan
                    </button>
                    <button class="btn btn-warning btn-sm" style="flex: 1.5;" onclick="window.openPickupStartModal('${item.id}')">
                        <i class="fa-solid fa-circle-check"></i> Pickup Kasir
                    </button>
                </div>
            `;
        } else {
            actionButtonsHtml = `<div style="text-align: center; margin-top: 15px; font-size: 0.8rem; color: #64748b; font-style: italic;">Menunggu pickup kurir ${item.courier_name}</div>`;
        }
    } else if (item.status === 'PICKED_UP') {
        if (isUserCourierObj && currentUser.id === item.courier_id) {
            actionButtonsHtml = `
                <button class="btn btn-success w-100" style="margin-top: 15px; font-weight: bold; background: #10b981; color:#fff;" onclick="window.openPickupDeliverModal('${item.id}')">
                    <i class="fa-solid fa-location-dot"></i> Konfirmasi Tiba & Jual Valas
                </button>
            `;
        } else if (!isUserCourierObj) {
            actionButtonsHtml = `
                <div style="display: flex; gap: 8px; margin-top: 15px;">
                    <button class="btn btn-outline btn-sm text-danger" style="flex: 1; border-color: rgba(239, 68, 68, 0.3);" onclick="window.cancelPickup('${item.id}')">
                        <i class="fa-solid fa-ban"></i> Batalkan
                    </button>
                    <button class="btn btn-success btn-sm" style="flex: 2;" onclick="window.openPickupDeliverModal('${item.id}')">
                        <i class="fa-solid fa-location-dot"></i> Konfirmasi Tiba & Jual
                    </button>
                </div>
            `;
        } else {
            actionButtonsHtml = `<div style="text-align: center; margin-top: 15px; font-size: 0.8rem; color: #3b82f6; font-style: italic;"><i class="fa-solid fa-spinner fa-spin"></i> Kurir ${item.courier_name} sedang membawa valas</div>`;
        }
    } else if (item.status === 'DELIVERED') {
        if (!isUserCourierObj) {
            // Cashier / Teller completes deposit
            actionButtonsHtml = `
                <button class="btn btn-primary w-100" style="margin-top: 15px; font-weight: bold; background: #38bdf8; border-color: #38bdf8; color: #0f172a;" onclick="window.openPickupCompleteModal('${item.id}')">
                    <i class="fa-solid fa-box-open"></i> Konfirmasi Terima Setoran Rp
                </button>
            `;
        } else {
            actionButtonsHtml = `<div style="text-align: center; margin-top: 15px; font-size: 0.8rem; color: #10b981; font-weight: 500;"><i class="fa-solid fa-clock"></i> Sudah diserahterimakan, menunggu kasir verifikasi uang setor</div>`;
        }
    }

    const age = window.formatDateToDMY ? window.formatDateToDMY(item.created_at) : item.created_at.split('T')[0];
    const timeOnly = item.created_at.split('T')[1]?.slice(0, 5) || '';

    // Driver avatar card (ojol-like layout)
    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
                <span style="font-size: 0.65rem; color: #94a3b8; font-weight: bold; text-transform: uppercase;">ID PICKUP</span>
                <h4 style="margin: 0; font-size: 0.95rem; color: #f8fafc;">${item.pickup_no}</h4>
                <small style="color: #64748b;">Dibuat: ${age} ${timeOnly}</small>
            </div>
            <span class="badge" style="background: ${statusBg}; color: #fff; font-size: 0.72rem; padding: 4px 8px; border-radius: 6px; position:static;">${statusLabel}</span>
        </div>

        ${timelineHtml}

        <div style="background: rgba(15, 23, 42, 0.4); border-radius: 8px; padding: 12px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.03);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.1rem; overflow: hidden;" id="driverAvatarFor_${item.id}">
                    <i class="fa-solid fa-user"></i>
                </div>
                <div>
                    <span style="font-size: 0.65rem; color: #64748b; display: block; font-weight: bold; text-transform: uppercase;">KURIR / DRIVER</span>
                    <strong style="font-size: 0.88rem; color: #f8fafc;">${item.courier_name}</strong>
                    ${item.vehicle_plate ? `<span style="font-size: 0.75rem; color: #f59e0b; font-weight: bold; margin-left: 6px;">[${item.vehicle_type} - ${item.vehicle_plate}]</span>` : ''}
                </div>
            </div>
            <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; font-size: 0.8rem; color: #94a3b8; display: flex; gap: 15px;">
                <div><i class="fa-solid fa-location-arrow" style="color: #64748b; margin-right: 4px;"></i> Tujuan: <strong>${item.destination}</strong></div>
            </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.2); border-radius: 8px; padding: 12px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.03);">
            <span style="font-size: 0.65rem; color: #64748b; display: block; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">DETAIL VALAS BAWAAN</span>
            ${valasListHtml}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
                <strong style="color: #94a3b8; font-size: 0.85rem;">Est. Total Rupiah:</strong>
                <strong style="color: #f8fafc; font-size: 1rem;">Rp ${formatIdrNoPrefix(item.estimated_total_idr)}</strong>
            </div>
            ${item.realized_total_idr ? `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <strong style="color: #10b981; font-size: 0.85rem;">Real. Total Jual:</strong>
                    <strong style="color: #10b981; font-size: 1rem;">Rp ${formatIdrNoPrefix(item.realized_total_idr)}</strong>
                </div>
            ` : ''}
        </div>

        ${item.notes ? `<div style="font-size: 0.8rem; color: #94a3b8; font-style: italic; background: rgba(255,255,255,0.02); border-left: 2px solid #38bdf8; padding: 6px 10px; border-radius: 4px; margin-bottom: 15px;"><span style="color:#64748b;">Memo:</span> ${item.notes}</div>` : ''}

        ${pinBadgeHtml}

        ${actionButtonsHtml}
    `;

    // Inject Courier Photo if exists in users database
    setTimeout(() => {
        try {
            const users = JSON.parse(localStorage.getItem('mc_users')) || [];
            const driverUser = users.find(u => u.id === item.courier_id);
            if (driverUser && driverUser.photo) {
                const avatarDiv = document.getElementById(`driverAvatarFor_${item.id}`);
                if (avatarDiv) {
                    avatarDiv.innerHTML = `<img src="${driverUser.photo}" style="width:100%; height:100%; object-fit:cover;">`;
                }
            }
        } catch(e){}
    }, 100);

    return card;
}

// Render baris tabel riwayat selesai
function renderHistoryRow(item) {
    const tr = document.createElement('tr');

    const dateStr = window.formatDateToDMY ? window.formatDateToDMY(item.created_at) : item.created_at.split('T')[0];
    
    let statusBadge = '';
    if (item.status === 'COMPLETED') {
        statusBadge = '<span class="badge" style="background:#10b981; position:static;">Selesai</span>';
    } else {
        statusBadge = '<span class="badge" style="background:#ef4444; position:static;">Dibatalkan</span>';
    }

    // List valas string summary
    let valasStr = '';
    item.currencies.forEach(c => {
        valasStr += `${formatIdrNoPrefix(c.amount)} ${c.code}, `;
    });
    valasStr = valasStr.slice(0, -2);

    let proofLinkHtml = '-';
    if (item.photo_proof) {
        proofLinkHtml = `<a href="${item.photo_proof}" target="_blank" class="btn btn-sm btn-outline" style="padding: 2px 6px; font-size:0.75rem;"><i class="fa-solid fa-image"></i> Struk</a>`;
    }

    const realizationStr = item.realized_total_idr ? ('Rp ' + formatIdrNoPrefix(item.realized_total_idr)) : '-';

    tr.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${item.pickup_no}</strong></td>
        <td>${item.courier_name}</td>
        <td>${item.destination}</td>
        <td><small>${valasStr}</small></td>
        <td style="text-align: right; color:#94a3b8;">Rp ${formatIdrNoPrefix(item.estimated_total_idr)}</td>
        <td style="text-align: right; font-weight: bold; color: ${item.status === 'COMPLETED' ? '#10b981' : 'inherit'};">${realizationStr}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center">${proofLinkHtml}</td>
    `;

    return tr;
}

// MODAL CONTROLLERS

// 1. Start Pickup (Courier confirms bringing valas)
window.openPickupStartModal = function(id) {
    const data = getPickups();
    const item = data.find(x => x.id === id);
    if (!item) return;

    document.getElementById('startPickupId').value = item.id;
    document.getElementById('startPickupNo').textContent = item.pickup_no;
    document.getElementById('startPickupValasText').innerHTML = item.currencies.map(c => `<strong>${formatIdrNoPrefix(c.amount)} ${c.code}</strong>`).join(', ');
    
    // Default vehicle fields if previously typed
    document.getElementById('startPickupPlate').value = item.vehicle_plate || '';
    document.getElementById('startPickupType').value = item.vehicle_type || 'Motor';
    
    document.getElementById('startPickupPhotoPreview').style.display = 'none';
    document.getElementById('startPickupPhotoData').value = '';

    document.getElementById('pickupStartModal').style.display = 'flex';
};

window.closePickupStartModal = function() {
    document.getElementById('pickupStartModal').style.display = 'none';
};

// Handle capture/upload foto pickup awal
window.triggerStartPickupPhotoUpload = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const dataUrl = evt.target.result;
            const preview = document.getElementById('startPickupPhotoPreview');
            preview.src = dataUrl;
            preview.style.display = 'block';
            document.getElementById('startPickupPhotoData').value = dataUrl;
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

window.confirmPickupStart = async function() {
    const id = document.getElementById('startPickupId').value;
    const plate = document.getElementById('startPickupPlate').value.trim();
    const type = document.getElementById('startPickupType').value;
    const photoData = document.getElementById('startPickupPhotoData').value;

    const data = getPickups();
    const item = data.find(x => x.id === id);
    if (!item) return;

    let photoUrl = '';
    if (photoData) {
        // Upload photo via API
        try {
            const response = await fetch('api/uploads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({
                    category: 'pickups/proofs',
                    data_url: photoData,
                    filename: `pickup-start-${item.pickup_no}`
                })
            });
            if (response.ok) {
                const res = await response.json();
                photoUrl = res.url;
            }
        } catch(e) {
            console.error("Gagal upload foto pickup:", e);
        }
    }

    const timestamp = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem('mc_currentUser')) || { fullName: 'Kurir' };

    item.status = 'PICKED_UP';
    item.vehicle_plate = plate;
    item.vehicle_type = type;
    item.photo_pickup = photoUrl;
    item.pickup_time = timestamp;
    item.updated_at = timestamp;

    item.history.push({
        status: 'PICKED_UP',
        timestamp: timestamp,
        user: currentUser.fullName || currentUser.username,
        notes: `Fisik valas diterima oleh kurir. Kendaraan: ${type} [${plate}]`
    });

    savePickups(data);
    closePickupStartModal();
    initPickupView();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'info',
            title: 'Valas Dibawa Kurir',
            text: 'Status di-update menjadi DALAM PERJALANAN. Berkendara dengan aman!',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 2000,
            showConfirmButton: false
        });
    }
};

// 2. Deliver Pickup (Courier confirms sold/delivered + inputs OTP)
window.openPickupDeliverModal = function(id) {
    const data = getPickups();
    const item = data.find(x => x.id === id);
    if (!item) return;

    document.getElementById('deliverPickupId').value = item.id;
    document.getElementById('deliverPickupNo').textContent = item.pickup_no;
    document.getElementById('deliverRecipient').value = item.recipient_name || 'Kasir Smartdeal';

    // Populate currencies rows inside the realization modal
    const currencyRealizationContainer = document.getElementById('deliverPickupCurrenciesRealization');
    currencyRealizationContainer.innerHTML = '';

    item.currencies.forEach((c, idx) => {
        const row = document.createElement('div');
        row.style = 'display: grid; grid-template-columns: 2fr 1.5fr 2fr; gap: 10px; align-items: center; margin-bottom: 8px;';
        row.innerHTML = `
            <div><strong style="color: #38bdf8;">${c.code}</strong> <span style="color:#64748b;">(Bawa: ${formatIdrNoPrefix(c.amount)})</span></div>
            <div><input type="hidden" class="p-real-qty" value="${c.amount}"></div>
            <div>
                <input type="number" class="form-control p-real-rate" style="background:#0f172a; color:#fff;" placeholder="Kurs Realisasi Jual" value="${c.estimated_rate || ''}" oninput="calculateRealizedPickupTotal()">
            </div>
        `;
        currencyRealizationContainer.appendChild(row);
    });

    document.getElementById('deliverPickupTotalRealIdr').textContent = 'Rp 0';
    document.getElementById('deliverPin').value = '';
    document.getElementById('deliverPickupPhotoPreview').style.display = 'none';
    document.getElementById('deliverPickupPhotoData').value = '';

    document.getElementById('pickupDeliverModal').style.display = 'flex';
    calculateRealizedPickupTotal();
};

window.closePickupDeliverModal = function() {
    document.getElementById('pickupDeliverModal').style.display = 'none';
};

window.calculateRealizedPickupTotal = function() {
    let totalRealIdr = 0;
    const rates = document.querySelectorAll('.p-real-rate');
    const qtys = document.querySelectorAll('.p-real-qty');
    
    for (let i = 0; i < rates.length; i++) {
        const qty = parseFloat(qtys[i]?.value) || 0;
        const rate = parseFloat(rates[i]?.value) || 0;
        totalRealIdr += qty * rate;
    }

    const totalEl = document.getElementById('deliverPickupTotalRealIdr');
    if (totalEl) {
        totalEl.textContent = 'Rp ' + formatIdrNoPrefix(totalRealIdr);
    }
};

window.triggerDeliverPickupPhotoUpload = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const dataUrl = evt.target.result;
            const preview = document.getElementById('deliverPickupPhotoPreview');
            preview.src = dataUrl;
            preview.style.display = 'block';
            document.getElementById('deliverPickupPhotoData').value = dataUrl;
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

window.confirmPickupDelivered = async function() {
    const id = document.getElementById('deliverPickupId').value;
    const recipient = document.getElementById('deliverRecipient').value.trim();
    const pinEntered = document.getElementById('deliverPin').value.trim();
    const photoData = document.getElementById('deliverPickupPhotoData').value;

    const data = getPickups();
    const item = data.find(x => x.id === id);
    if (!item) return;

    if (!recipient) {
        alert("Masukkan nama penerima valas / kasir tujuan!");
        return;
    }

    if (pinEntered !== item.verification_pin) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Kode PIN OTP Salah!',
                text: 'Harap mintalah 4-digit PIN OTP dari Kasir/Teller kantor untuk melakukan serah terima.',
                background: '#1e293b',
                color: '#f8fafc',
                confirmButtonColor: '#ef4444'
            });
        } else {
            alert("Kode PIN OTP Salah! Harap minta kode PIN dari Teller.");
        }
        return;
    }

    // Collect realized rates
    const ratesInputs = document.querySelectorAll('.p-real-rate');
    let realizedTotalIdr = 0;
    
    for (let i = 0; i < item.currencies.length; i++) {
        const rate = parseFloat(ratesInputs[i]?.value) || 0;
        if (rate <= 0) {
            alert("Kurs realisasi jual harus diisi dan lebih besar dari 0!");
            return;
        }
        item.currencies[i].realized_rate = rate;
        item.currencies[i].realized_total = item.currencies[i].amount * rate;
        realizedTotalIdr += item.currencies[i].realized_total;
    }

    let photoUrl = '';
    if (photoData) {
        try {
            const response = await fetch('api/uploads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                },
                body: JSON.stringify({
                    category: 'pickups/proofs',
                    data_url: photoData,
                    filename: `pickup-delivered-${item.pickup_no}`
                })
            });
            if (response.ok) {
                const res = await response.json();
                photoUrl = res.url;
            }
        } catch(e) {
            console.error("Gagal upload bukti serah terima:", e);
        }
    }

    const timestamp = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem('mc_currentUser')) || { fullName: 'Kurir' };

    item.status = 'DELIVERED';
    item.recipient_name = recipient;
    item.realized_total_idr = realizedTotalIdr;
    item.photo_proof = photoUrl;
    item.delivered_time = timestamp;
    item.updated_at = timestamp;

    item.history.push({
        status: 'DELIVERED',
        timestamp: timestamp,
        user: currentUser.fullName || currentUser.username,
        notes: `Valas diserahkan ke ${recipient}. Realisasi Jual: Rp ${formatIdrNoPrefix(realizedTotalIdr)}. OTP terverifikasi.`
    });

    savePickups(data);
    closePickupDeliverModal();
    initPickupView();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Handover Berhasil!',
            text: 'Verifikasi PIN sukses. Valas terkonfirmasi telah terjual. Segera setor hasil Rupiah ke kantor.',
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#10b981'
        });
    }
};

// 3. Complete Pickup (Cashier confirms receiving the Rupiah)
window.openPickupCompleteModal = function(id) {
    const data = getPickups();
    const item = data.find(x => x.id === id);
    if (!item) return;

    document.getElementById('completePickupId').value = item.id;
    document.getElementById('completePickupNo').textContent = item.pickup_no;
    document.getElementById('completePickupCourier').textContent = item.courier_name;
    document.getElementById('completePickupAmountText').textContent = 'Rp ' + formatIdrNoPrefix(item.realized_total_idr);
    
    // Auto-select payment method based on standard bank
    document.getElementById('completePickupTargetBox').value = 'CASH';

    document.getElementById('pickupCompleteModal').style.display = 'flex';
};

window.closePickupCompleteModal = function() {
    document.getElementById('pickupCompleteModal').style.display = 'none';
};

window.confirmPickupComplete = function() {
    const id = document.getElementById('completePickupId').value;
    const targetBox = document.getElementById('completePickupTargetBox').value;

    const data = getPickups();
    const item = data.find(x => x.id === id);
    if (!item) return;

    const timestamp = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem('mc_currentUser')) || { fullName: 'Kasir Kantor' };

    // Selesaikan pickup
    item.status = 'COMPLETED';
    item.completed_time = timestamp;
    item.updated_at = timestamp;

    item.history.push({
        status: 'COMPLETED',
        timestamp: timestamp,
        user: currentUser.fullName || currentUser.username,
        notes: `Hasil Rupiah sebesar Rp ${formatIdrNoPrefix(item.realized_total_idr)} telah diterima oleh kasir kantor via ${targetBox === 'CASH' ? 'Tunai (Brankas)' : targetBox}.`
    });

    // Sesuaikan saldo kas/bank brankas kasir di frontend
    // Tambahkan Rupiah ke kas/bank
    const amount = parseFloat(item.realized_total_idr || 0);
    
    if (targetBox === 'CASH') {
        const currentCash = parseFloat(localStorage.getItem('mc_cash') || 0);
        const nextCash = currentCash + amount;
        localStorage.setItem('mc_cash', String(nextCash));
        if (typeof pushToUniversalDatastore === 'function') {
            pushToUniversalDatastore('mc_cash', nextCash);
        }
    } else if (targetBox === 'BCA') {
        const currentBca = parseFloat(localStorage.getItem('mc_bank_bca') || 0);
        const nextBca = currentBca + amount;
        localStorage.setItem('mc_bank_bca', String(nextBca));
        if (typeof pushToUniversalDatastore === 'function') {
            pushToUniversalDatastore('mc_bank_bca', nextBca);
        }
    } else if (targetBox === 'MANDIRI') {
        const currentMandiri = parseFloat(localStorage.getItem('mc_bank_mandiri') || 0);
        const nextMandiri = currentMandiri + amount;
        localStorage.setItem('mc_bank_mandiri', String(nextMandiri));
        if (typeof pushToUniversalDatastore === 'function') {
            pushToUniversalDatastore('mc_bank_mandiri', nextMandiri);
        }
    }

    // Buat Mutasi Otomatis (penerimaan kas) agar closing harian klop
    let mutasiList = [];
    try {
        mutasiList = JSON.parse(localStorage.getItem('mc_mutations')) || [];
    } catch(e){}

    const newMutation = {
        id: 'MUT-' + Date.now().toString().slice(-6),
        timestamp: timestamp,
        tipe: 'MASUK',
        sumber: targetBox === 'CASH' ? 'TUNAI' : 'TRANSFER',
        bank: targetBox !== 'CASH' ? targetBox : '',
        nominal: amount,
        keterangan: `Penyetoran Rupiah hasil pickup valas No: ${item.pickup_no} oleh kurir ${item.courier_name}.`,
        dibuat_oleh: currentUser.fullName || currentUser.username
    };

    mutasiList.push(newMutation);
    localStorage.setItem('mc_mutations', JSON.stringify(mutasiList));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_mutations', mutasiList);
    }

    // Juga kurangi stok mata uang secara otomatis dari brankas!
    // Ini sangat penting karena valas telah terjual dan keluar secara resmi.
    let currencies = getActiveCurrencies();
    item.currencies.forEach(c => {
        const match = currencies.find(x => x.code === c.code);
        if (match) {
            match.stock = Math.max(0, (match.stock || 0) - parseFloat(c.amount));
        }
    });
    localStorage.setItem('mc_currencies', JSON.stringify(currencies));
    // Kirim stok valas terbaru ke MySQL
    if (typeof saveToMySQL_Currency === 'function') {
        item.currencies.forEach(c => {
            const match = currencies.find(x => x.code === c.code);
            if (match) saveToMySQL_Currency(match);
        });
    }

    savePickups(data);
    closePickupCompleteModal();
    initPickupView();

    // Reload dashboard to see updated cash/bank numbers
    if (typeof loadDashboard === 'function') loadDashboard();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Serah Terima Pickup Selesai',
            text: 'Hasil Rupiah telah dimasukkan ke dalam saldo kas/bank brankas kasir secara otomatis.',
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#38bdf8'
        });
    }
};

// 4. Batalkan Pickup
window.cancelPickup = function(id) {
    const action = () => {
        const data = getPickups();
        const item = data.find(x => x.id === id);
        if (!item) return;

        const timestamp = new Date().toISOString();
        const currentUser = JSON.parse(localStorage.getItem('mc_currentUser')) || { fullName: 'User' };

        item.status = 'CANCELLED';
        item.updated_at = timestamp;
        item.history.push({
            status: 'CANCELLED',
            timestamp: timestamp,
            user: currentUser.fullName || currentUser.username,
            notes: 'Pickup dibatalkan oleh kasir/owner.'
        });

        savePickups(data);
        initPickupView();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Pickup Dibatalkan',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Batalkan Pickup?',
            text: "Permintaan pickup valas ini akan dibatalkan secara permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Ya, Batalkan!',
            cancelButtonText: 'Tutup',
            background: '#1e293b',
            color: '#f8fafc'
        }).then((result) => {
            if (result.isConfirmed) {
                action();
            }
        });
    } else {
        if (confirm("Apakah Anda yakin ingin membatalkan pickup valas ini?")) {
            action();
        }
    }
};
