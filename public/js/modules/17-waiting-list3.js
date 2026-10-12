// ==========================================
// MODULE 17: VALAS WAITING LIST (Daftar Antrean Permintaan Valas)
// ==========================================

(function() {
    let waitingList = [];
    let currentFilterStatus = 'ALL'; // 'ALL', 'PENDING', 'READY', 'CANCELLED'
    let currentSearchQuery = '';

    // Initialize state
    function initWaitingList() {
        const stored = localStorage.getItem('mc_valas_waiting_list');
        if (stored) {
            try {
                waitingList = JSON.parse(stored);
            } catch(e) {
                waitingList = [];
            }
        } else {
            // Seed default data for demonstration
            waitingList = [
                {
                    id: 'wl_1',
                    date: '2026-06-22',
                    name: 'Budi Santoso',
                    phone: '081234567890',
                    currency: 'USD',
                    amount: 5000,
                    status: 'PENDING',
                    notes: 'Mencari pecahan $100 seri baru.'
                },
                {
                    id: 'wl_2',
                    date: '2026-06-21',
                    name: 'Siti Aminah',
                    phone: '085712345678',
                    currency: 'JPY',
                    amount: 150000,
                    status: 'READY',
                    notes: 'Koin pecahan 500 yen juga tidak apa-apa.'
                }
            ];
            localStorage.setItem('mc_valas_waiting_list', JSON.stringify(waitingList));
        }

        // Render initially
        loadWaitingListTable();
    }

    function saveWaitingList() {
        localStorage.setItem('mc_valas_waiting_list', JSON.stringify(waitingList));
    }

    // Filter status tabs
    window.setWaitingListFilter = function(status) {
        currentFilterStatus = status;
        
        // Style tabs
        const tabs = document.querySelectorAll('.waiting-list-tab');
        tabs.forEach(tab => {
            const tabStatus = tab.getAttribute('data-status');
            if (tabStatus === status) {
                tab.classList.add('active');
                tab.style.background = '#EC4899';
                tab.style.color = '#fff';
            } else {
                tab.classList.remove('active');
                tab.style.background = 'rgba(255,255,255,0.03)';
                tab.style.color = '#94a3b8';
            }
        });

        loadWaitingListTable();
    };

    // Live search
    window.filterWaitingList = function() {
        const input = document.getElementById('searchWaitingList');
        if (input) {
            currentSearchQuery = input.value.trim().toLowerCase();
            loadWaitingListTable();
        }
    };

    // Load table data
    window.loadWaitingListTable = function() {
        const tableBody = document.getElementById('waitingListTableBody');
        if (!tableBody) return;

        // Apply filters
        let filtered = waitingList;
        
        if (currentFilterStatus !== 'ALL') {
            filtered = filtered.filter(item => item.status === currentFilterStatus);
        }

        if (currentSearchQuery) {
            filtered = filtered.filter(item => 
                (item.name || '').toLowerCase().includes(currentSearchQuery) || 
                (item.phone || '').toLowerCase().includes(currentSearchQuery) || 
                (item.currency || '').toLowerCase().includes(currentSearchQuery) ||
                (item.notes || '').toLowerCase().includes(currentSearchQuery)
            );
        }

        // Render rows
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted" style="padding: 30px 10px;">
                        <i class="fa-solid fa-hourglass-empty" style="font-size: 2rem; display: block; margin-bottom: 10px; color: #475569;"></i>
                        Tidak ada antrean permintaan valas yang sesuai filter.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map(item => {
            let statusBadge = '';
            if (item.status === 'PENDING') {
                statusBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 8px; border-radius: 6px;">Menunggu</span>`;
            } else if (item.status === 'READY') {
                statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 6px;">Ready</span>`;
            } else {
                statusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 6px;">Batal</span>`;
            }

            const cleanPhone = String(item.phone || '').replace(/[^0-9]/g, '');
            const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 12px; font-size: 0.85rem; color: #94a3b8;">${formatDateString(item.date)}</td>
                    <td style="padding: 12px; font-weight: 600; color: #f8fafc;">${item.name}</td>
                    <td style="padding: 12px;">
                        <button type="button" onclick="sendWaitingListContactWhatsApp('${item.id}')" style="color: #25D366; background:transparent; border:0; padding:0; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.85rem; cursor:pointer;" title="Kirim WhatsApp melalui Gateway">
                            <i class="fa-brands fa-whatsapp"></i> ${item.phone}
                        </button>
                    </td>
                    <td style="padding: 12px; font-weight: 700; color: #38bdf8; text-align: center; font-size: 0.9rem;">${item.currency}</td>
                    <td style="padding: 12px; font-weight: 800; color: #f8fafc; text-align: right;">${Math.round(item.amount || 0).toLocaleString('id-ID')}</td>
                    <td style="padding: 12px; font-size: 0.85rem; color: #cbd5e1; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.notes || ''}">${item.notes || '—'}</td>
                    <td style="padding: 12px; text-align: center;">${statusBadge}</td>
                    <td style="padding: 12px; text-align: center;">
                        <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                            ${item.status === 'PENDING' ? `
                                <button class="btn btn-sm btn-success" onclick="toggleWaitingListReady('${item.id}')" style="background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Tandai Ready & Kabari WA"><i class="fa-solid fa-check"></i> Ready</button>
                            ` : `
                                <button class="btn btn-sm btn-outline" onclick="sendWaitingListWhatsApp('${item.id}')" style="border-color: #25D366; color: #25D366; background: transparent; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Kirim Ulang WA"><i class="fa-brands fa-whatsapp"></i> Kabari</button>
                            `}
                            
                            <button class="btn btn-sm btn-outline" onclick="editWaitingListEntry('${item.id}')" style="border-color: #38bdf8; color: #38bdf8; background: transparent; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;" title="Edit"><i class="fa-solid fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline" onclick="deleteWaitingListEntry('${item.id}')" style="border-color: #ef4444; color: #ef4444; background: transparent; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    function formatDateString(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch(e) {
            return dateStr;
        }
    }

    // Opens WA with predefined message
    window.sendWaitingListWhatsApp = async function(id) {
        const item = waitingList.find(w => w.id === id);
        if (!item) return;

        const cleanPhone = String(item.phone || '').replace(/[^0-9]/g, '');
        const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;

        const message = `Halo ${item.name},\n\nKami dari KUPVA *Almara Putra Valasindo* ingin mengabarkan bahwa pemesanan valas *${item.currency}* sebesar *${Math.round(item.amount).toLocaleString('id-ID')}* yang Anda cari sebelumnya saat ini *sudah ready/tersedia*.\n\nSilakan datang ke gerai kami atau hubungi kami kembali untuk deal rate transaksi. Terima kasih!`;
        try {
            await window.sendWhatsAppGateway(waPhone, message, { reference: item.id });
            alert('Pemberitahuan stok berhasil dikirim melalui WA Gateway.');
        } catch (error) {
            alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
        }
    };

    window.sendWaitingListContactWhatsApp = async function(id) {
        const item = waitingList.find(w => w.id === id);
        if (!item) return;
        const waPhone = String(item.phone || '').replace(/[^0-9]/g, '');
        try {
            await window.sendWhatsAppGateway(waPhone, `Halo ${item.name || 'Nasabah'},\n\nSalam dari KUPVA *Almara Putra Valasindo*. Ada yang dapat kami bantu?`, { reference: item.id });
            alert('Pesan WhatsApp berhasil dikirim melalui Gateway.');
        } catch (error) {
            alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
        }
    };

    // Toggle status to READY and open WA window
    window.toggleWaitingListReady = function(id) {
        const item = waitingList.find(w => w.id === id);
        if (item) {
            item.status = 'READY';
            saveWaitingList();
            loadWaitingListTable();
            
            if (confirm(`Antrean atas nama ${item.name} berhasil ditandai READY.\n\nKirim pemberitahuan melalui WA Gateway?`)) {
                sendWaitingListWhatsApp(id);
            }
        }
    };

    // Add entry
    window.addWaitingListEntry = function() {
        // Clear forms
        document.getElementById('wlEntryId').value = '';
        document.getElementById('wlName').value = '';
        document.getElementById('wlPhone').value = '';
        document.getElementById('wlAmount').value = '1000';
        document.getElementById('wlNotes').value = '';
        
        // Currency Selector
        const select = document.getElementById('wlCurrency');
        if (select) {
            select.innerHTML = '';
            const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
            currencies.forEach(c => {
                select.innerHTML += `<option value="${c.code}">${c.code} - ${c.name || ''}</option>`;
            });
        }

        document.getElementById('wlStatusGroup').style.display = 'none';
        document.getElementById('wlModalTitle').textContent = 'Tambah Antrean Permintaan Valas';
        document.getElementById('valasWaitingListModal').style.display = 'block';
    };

    // Edit entry
    window.editWaitingListEntry = function(id) {
        const item = waitingList.find(w => w.id === id);
        if (!item) return;

        document.getElementById('wlEntryId').value = item.id;
        document.getElementById('wlName').value = item.name || '';
        document.getElementById('wlPhone').value = item.phone || '';
        document.getElementById('wlAmount').value = item.amount || 1000;
        document.getElementById('wlNotes').value = item.notes || '';
        
        // Currency selector
        const select = document.getElementById('wlCurrency');
        if (select) {
            select.innerHTML = '';
            const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
            currencies.forEach(c => {
                select.innerHTML += `<option value="${c.code}" ${item.currency === c.code ? 'selected' : ''}>${c.code} - ${c.name || ''}</option>`;
            });
        }

        // Status field
        const statusSelect = document.getElementById('wlStatus');
        if (statusSelect) {
            statusSelect.value = item.status || 'PENDING';
        }
        
        document.getElementById('wlStatusGroup').style.display = 'block';
        document.getElementById('wlModalTitle').textContent = 'Ubah Antrean Permintaan Valas';
        document.getElementById('valasWaitingListModal').style.display = 'block';
    };

    // Close modal
    window.closeWaitingListModal = function() {
        document.getElementById('valasWaitingListModal').style.display = 'none';
    };

    // Save entry
    window.saveWaitingListEntry = function() {
        const id = document.getElementById('wlEntryId').value;
        const name = document.getElementById('wlName').value.trim();
        const phone = document.getElementById('wlPhone').value.trim();
        const currency = document.getElementById('wlCurrency').value;
        const amount = parseFloat(document.getElementById('wlAmount').value) || 0;
        const notes = document.getElementById('wlNotes').value.trim();
        
        if (!name || !phone || !currency || amount <= 0) {
            alert('Semua bidang wajib diisi dengan benar!');
            return;
        }

        if (id) {
            // Update mode
            const item = waitingList.find(w => w.id === id);
            if (item) {
                item.name = name;
                item.phone = phone;
                item.currency = currency;
                item.amount = amount;
                item.notes = notes;
                item.status = document.getElementById('wlStatus').value;
            }
        } else {
            // Create mode
            const newEntry = {
                id: 'wl_' + Date.now(),
                date: new Date().toISOString().split('T')[0],
                name: name,
                phone: phone,
                currency: currency,
                amount: amount,
                status: 'PENDING',
                notes: notes
            };
            waitingList.unshift(newEntry);
        }

        saveWaitingList();
        closeWaitingListModal();
        loadWaitingListTable();
    };

    // Delete entry
    window.deleteWaitingListEntry = function(id) {
        const item = waitingList.find(w => w.id === id);
        if (!item) return;

        if (confirm(`Hapus antrean permintaan valas atas nama ${item.name}?`)) {
            waitingList = waitingList.filter(w => w.id !== id);
            saveWaitingList();
            loadWaitingListTable();
        }
    };

    // Auto-init
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(initWaitingList, 500);
        });
    } else {
        setTimeout(initWaitingList, 500);
    }

})();
