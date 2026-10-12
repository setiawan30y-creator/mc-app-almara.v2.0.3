// Investor, audit internal, and accounting engine

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
    let totalFee = 0;
    
    invs.forEach(c => {
        const capital = parseFloat(c.modal) || 0;
        const perc = parseFloat(c.persentase) || 0;
        const fee = capital * (perc / 100);
        totalCap += capital;
        totalPerc += perc;
        totalFee += fee;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.id_investor}</strong></td>
            <td>${c.nama}</td>
            <td>${c.kontak || '-'}</td>
            <td class="text-end">${formatIdr(capital)}</td>
            <td class="text-center">${perc}%</td>
            <td class="text-end text-blue">${formatIdr(fee)}</td>
            <td>${c.tgl_gabung || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn btn-sm btn-primary mx-1" onclick="openInvestorModal('${c.id_investor}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-danger mx-1" onclick="deleteInvestor('${c.id_investor}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if(invs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada data investor.</td></tr>';
    }
    
    document.getElementById('invTotalModal').innerText = formatIdr(totalCap);
    document.getElementById('invTotalPercent').innerText = totalPerc.toFixed(2) + '%';
    const invTotalFeeEl = document.getElementById('invTotalFee');
    if (invTotalFeeEl) invTotalFeeEl.innerText = formatIdr(totalFee);
    
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

window.sendAuditWhatsApp = async function(phone, message, reference) {
    try {
        const customerName = String(message || '').match(/^Halo\s+([^,]+)/i)?.[1] || 'Nasabah';
        const finalMessage = window.buildWaMessageForPurpose('audit', message, {
            customerName, invoice: reference || '-', date: new Date().toLocaleDateString('id-ID')
        });
        await window.sendWhatsAppGateway(phone, finalMessage, { reference });
        alert('Pesan transaksi berhasil dikirim melalui WA Gateway.');
    } catch (error) {
        alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
    }
};

function renderAuditTable(data) {
    const tbody = document.getElementById('auditTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Belum ada data RWT.</td></tr>';
        return;
    }

    const allCustomers = getCustomers();
    const customerMap = new Map();
    allCustomers.forEach(c => {
        if (c && c.id_nasabah) customerMap.set(String(c.id_nasabah).trim().toLowerCase(), c);
    });
    
    data.forEach(trx => {
        const customerId = trx.customerId || trx.id_cif || trx.id_nasabah || '';
        const customer = customerMap.get(String(customerId || '').trim().toLowerCase()) || {};
        const customerName = trx.customerName || customer.nama || '-';
        const customerPhone = customer.no_hp || '';
        const formattedTimestamp = trx.timestamp ? window.formatDateToDMY(trx.timestamp) : '-';
        const valutaDisplay = trx.valuta ? window.getFlagHtml(trx.valuta) : '-';
        let waBtn = '';
        if (customerPhone && customerPhone !== '-') {
            const textWa = `Halo, berikut detail transaksi Anda. Invoice ${trx.id || '-'} tanggal ${window.formatDateToDMY(trx.timestamp)} dengan total ${formatRp(trx.total || 0)}.`;
            waBtn = `<button type="button" onclick='window.sendAuditWhatsApp(${JSON.stringify(customerPhone)}, ${JSON.stringify(textWa)}, ${JSON.stringify(trx.id || "")})' class="btn btn-sm" style="background:#25d366; color:white;" title="Kirim WhatsApp melalui Gateway"><i class="fa-brands fa-whatsapp"></i></button>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formattedTimestamp}</td>
            <td>${trx.id || '-'} / <br><small class="text-muted">${trx.itemId || '-'}</small></td>
            <td class="font-weight-bold ${trx.tipe === 'BELI' ? 'text-green' : 'text-red'}">${trx.tipe || '-'}</td>
            <td>${customerName}</td>
            <td>${valutaDisplay}</td>
            <td><small>${trx.keterangan || '-'}</small></td>
            <td class="text-end">${(parseFloat(trx.nominal) || 0).toLocaleString()}</td>
            <td class="text-end">${formatRate(trx.rate || 0)}</td>
            <td class="text-end font-bold">${formatIdr(trx.total || 0)}</td>
            <td style="text-align:center;">
                <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.reprintReceipt('${trx.id}')" title="Cetak Ulang Struk"><i class="fa-solid fa-print"></i></button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="window.editTransaction('${trx.id}')" title="Edit Transaksi"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="window.voidTransaction('${trx.id}')" title="Hapus / Batalkan Transaksi"><i class="fa-solid fa-trash"></i></button>
                    <button type="button" class="btn btn-outline btn-sm" onclick='window.deleteAuditRow(${JSON.stringify(trx.itemId || '')})' style="border-color:#dc2626;color:#dc2626;" title="Hapus baris RWT saja"><i class="fa-solid fa-eraser"></i></button>
                    ${waBtn}
                </div>
            </td>
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
    const customerMap = new Map();
    allCustomers.forEach(c => {
        if (c && c.id_nasabah) customerMap.set(String(c.id_nasabah).trim().toLowerCase(), c);
    });

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
            const cObj = customerId ? customerMap.get(String(customerId).trim().toLowerCase()) : null;
            
            let matchNama = true;
            let matchHp = true;
            
            if(filterNama) {
                const joinedName = (t.customerName || (cObj && cObj.nama) || '').toLowerCase();
                matchNama = joinedName.includes(filterNama);
            }
            if(filterHp) {
                const joinedHp = ((cObj && cObj.no_hp) || '').toLowerCase();
                matchHp = joinedHp.includes(filterHp);
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

window.loadAuditTable = loadAuditTable;
window.filterAuditTable = filterAuditTable;
window.deleteAuditRow = async function(itemId) {
    if (!itemId) return alert('ID RWT tidak valid.');
    if (!confirm('Hapus baris RWT ini? Riwayat transaksi utama tidak ikut dihapus.')) return;
    try {
        const request = window.authFetch || window.fetch;
        const response = await request(`api/audit?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status === 'error') throw new Error(result.message || 'Gagal menghapus RWT.');
        globalAuditData = globalAuditData.filter(row => String(row.itemId) !== String(itemId));
        filterAuditTable();
    } catch (error) {
        alert(error.message || 'Gagal menghapus RWT.');
    }
};

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

window.deleteAllTransactions = async function() {
    const confirmDelete = async () => {
        if (typeof Swal === 'undefined') {
            return confirm('Anda akan menghapus semua riwayat transaksi. Audit tetap tersimpan.')
                && prompt('Ketik HAPUS untuk melanjutkan:') === 'HAPUS';
        }
        const first = await Swal.fire({
            title: 'PERINGATAN KERAS!',
            text: 'Semua riwayat transaksi akan dihapus. Audit Log tetap tersimpan.',
            icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#ef4444', cancelButtonColor: '#3b82f6',
            confirmButtonText: 'Ya, Hapus Semua', cancelButtonText: 'Batal', reverseButtons: true
        });
        if (!first.isConfirmed) return false;
        const final = await Swal.fire({
            title: 'Konfirmasi Terakhir', input: 'text', inputLabel: 'Ketik "HAPUS" untuk melanjutkan',
            inputPlaceholder: 'HAPUS', showCancelButton: true,
            inputValidator: value => value === 'HAPUS' ? undefined : 'Ketik "HAPUS" dengan huruf besar!'
        });
        return final.isConfirmed;
    };

    if (!await confirmDelete()) return;
    try {
        if (typeof Swal !== 'undefined') Swal.fire({ title: 'Menghapus riwayat...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const request = window.authFetch || fetch;
        const response = await request('api/transactions/clear-all', { method: 'DELETE', headers: { Accept: 'application/json' } });
        const raw = await response.text();
        let result = {};
        try { result = raw ? JSON.parse(raw) : {}; } catch (_) { result = { message: raw }; }
        if (!response.ok || result.status !== 'success') throw new Error(result.message || `Gagal menghapus riwayat (${response.status}).`);

        // Hapus cache hanya setelah server berhasil, agar data tidak muncul lagi saat refresh/realtime sync.
        if (typeof saveTransactions === 'function') saveTransactions([]);
        else localStorage.removeItem('mc_transactions');
        window.__almaraLocalTransactionSnapshot = '[]';
        if (typeof loadReportsTable === 'function') loadReportsTable();
        if (typeof refreshActiveRealtimeViews === 'function') refreshActiveRealtimeViews();
        if (typeof Swal !== 'undefined') Swal.fire('Terhapus!', result.message || 'Semua riwayat transaksi telah dihapus.', 'success');
        else alert(result.message || 'Semua riwayat transaksi telah dihapus.');
    } catch (error) {
        console.error('Gagal menghapus semua riwayat transaksi:', error);
        if (typeof Swal !== 'undefined') Swal.fire('Gagal menghapus', error.message || 'Terjadi kesalahan sistem.', 'error');
        else alert(error.message || 'Gagal menghapus riwayat transaksi.');
    }
};

function normalizeRwtTransactionRow(row) {
    let raw = {};
    if (row && row.raw_json) {
        try {
            raw = JSON.parse(row.raw_json) || {};
        } catch(e) {
            raw = {};
        }
    }

    const merged = { ...row, ...raw };
    const invoiceId = merged.id || row.id || merged.invoiceId || '';
    const itemId = merged.itemId || row.itemId || invoiceId;
    return {
        ...merged,
        id: invoiceId,
        itemId,
        timestamp: merged.timestamp || row.timestamp || new Date().toISOString(),
        tipe: merged.tipe || merged.type || row.tipe || 'JUAL',
        valuta: merged.valuta || row.valuta || '',
        nominal: parseFloat(merged.nominal ?? row.nominal ?? 0) || 0,
        rate: parseFloat(merged.rate ?? row.rate ?? 0) || 0,
        total: parseFloat(merged.total ?? row.total ?? 0) || 0,
        customerId: merged.customerId || merged.id_cif || row.id_cif || '',
        id_cif: merged.id_cif || merged.customerId || row.id_cif || '',
        customerName: merged.customerName || row.customerName || '',
        kasir: merged.kasir || row.kasir || '',
        paymentMethod: merged.paymentMethod || row.paymentMethod || 'TUNAI',
        transactionPurpose: merged.transactionPurpose || row.transactionPurpose || '',
        sourceOfFunds: merged.sourceOfFunds || row.sourceOfFunds || '',
        isOldMoney: Boolean(merged.isOldMoney || row.isOldMoney),
        keterangan: merged.keterangan || row.keterangan || '',
    };
}

window.restoreTransactionsFromRwt = async function() {
    try {
        const [auditResponse, trxResponse] = await Promise.all([
            fetch('api/audit', { cache: 'no-store' }),
            fetch('api/transactions', { cache: 'no-store' })
        ]);

        if (!auditResponse.ok) throw new Error('Gagal mengambil data RWT.');
        if (!trxResponse.ok) throw new Error('Gagal mengambil data Riwayat Transaksi.');

        const auditRows = (await auditResponse.json()).map(normalizeRwtTransactionRow).filter(row => row.id && row.itemId);
        const serverRows = (await trxResponse.json()).map(normalizeRwtTransactionRow).filter(row => row.id && row.itemId);
        const serverItemKeys = new Set(serverRows.map(row => String(row.itemId || row.id)));
        const missingRows = auditRows.filter(row => !serverItemKeys.has(String(row.itemId || row.id)));

        if (missingRows.length === 0) {
            if (typeof Swal !== 'undefined') Swal.fire('Sudah Lengkap', 'Tidak ada transaksi RWT yang hilang dari Riwayat.', 'info');
            else alert('Tidak ada transaksi RWT yang hilang dari Riwayat.');
            return;
        }

        let restoreRows = [];
        if (typeof Swal !== 'undefined') {
            const escapeOption = value => String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const currencyOptions = [...new Set(missingRows.map(row => row.valuta).filter(Boolean))]
                .sort()
                .map(code => `<option value="${escapeOption(code)}">${escapeOption(code)}</option>`)
                .join('');
            const itemOptions = missingRows.map((row, index) => {
                const label = `${row.id} / ${row.itemId} - ${row.valuta || '-'} - ${row.tipe || '-'} - ${Number(row.nominal || 0).toLocaleString('id-ID')}`;
                return `<option value="${index}">${escapeOption(label)}</option>`;
            }).join('');

            const ask = await Swal.fire({
                icon: 'question',
                title: 'Pulihkan dari RWT',
                html: `
                    <div style="text-align:left; color:#cbd5e1; font-size:.86rem; line-height:1.45;">
                        <div style="margin-bottom:10px;">Pilih salah satu. Kosongkan item jika ingin pulihkan berdasarkan mata uang.</div>
                        <label style="display:block; margin-bottom:5px; font-weight:700;">No Invoice / Item RWT</label>
                        <select id="restoreRwtItemSelect" class="swal2-input" style="width:100%; margin:0 0 12px 0;">
                            <option value="">-- Pilih per item --</option>
                            ${itemOptions}
                        </select>
                        <label style="display:block; margin-bottom:5px; font-weight:700;">Mata Uang</label>
                        <select id="restoreRwtCurrencySelect" class="swal2-input" style="width:100%; margin:0;">
                            <option value="">-- Pilih mata uang --</option>
                            ${currencyOptions}
                        </select>
                        <div style="margin-top:10px; color:#94a3b8;">Data tersedia untuk dipulihkan: ${missingRows.length} baris.</div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Pulihkan',
                cancelButtonText: 'Batal',
                background: '#1e293b',
                color: '#f8fafc',
                confirmButtonColor: '#f59e0b',
                preConfirm: () => {
                    const itemIndex = document.getElementById('restoreRwtItemSelect')?.value || '';
                    const currency = document.getElementById('restoreRwtCurrencySelect')?.value || '';
                    if (!itemIndex && !currency) {
                        Swal.showValidationMessage('Pilih No Invoice/Item atau Mata Uang terlebih dahulu.');
                        return false;
                    }
                    return { itemIndex, currency };
                }
            });
            if (!ask.isConfirmed) return;

            const selection = ask.value || {};
            if (selection.itemIndex !== '') {
                restoreRows = [missingRows[parseInt(selection.itemIndex, 10)]].filter(Boolean);
            } else {
                restoreRows = missingRows.filter(row => row.valuta === selection.currency);
            }
        } else {
            const keyword = prompt('Masukkan No Invoice / Item ID / Mata Uang yang ingin dipulihkan dari RWT:');
            if (!keyword) return;
            const key = keyword.trim().toUpperCase();
            restoreRows = missingRows.filter(row => {
                return String(row.id || '').toUpperCase() === key
                    || String(row.itemId || '').toUpperCase() === key
                    || String(row.valuta || '').toUpperCase() === key;
            });
        }

        if (restoreRows.length === 0) {
            if (typeof Swal !== 'undefined') Swal.fire('Tidak Ada Data', 'Pilihan tersebut tidak punya baris RWT yang hilang.', 'info');
            else alert('Pilihan tersebut tidak punya baris RWT yang hilang.');
            return;
        }

        let successCount = 0;
        for (const row of restoreRows) {
            const response = await fetch('api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(row)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.status === 'error') {
                throw new Error(result.message || `Gagal memulihkan ${row.itemId || row.id}.`);
            }
            successCount++;
        }

        const restoredResponse = await fetch('api/transactions', { cache: 'no-store' });
        if (restoredResponse.ok) {
            const restoredRows = (await restoredResponse.json()).map(normalizeRwtTransactionRow);
            window.__almaraSuppressAutoTransactionPush = true;
            saveTransactions(restoredRows);
            window.__almaraSuppressAutoTransactionPush = false;
        }

        if (typeof loadReportsTable === 'function') await loadReportsTable();
        if (typeof loadDashboard === 'function') loadDashboard();

        const message = `Berhasil memulihkan ${successCount} baris transaksi dari RWT.`;
        if (typeof Swal !== 'undefined') Swal.fire('Selesai', message, 'success');
        else alert(message);
    } catch (error) {
        window.__almaraSuppressAutoTransactionPush = false;
        console.error('Restore RWT failed:', error);
        if (typeof Swal !== 'undefined') Swal.fire('Gagal', error.message || String(error), 'error');
        else alert('Gagal memulihkan dari RWT: ' + (error.message || error));
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



