// Bank mutations, expenses, equity, closing, settings, master data, rates, uploads, and exports

// ==============================
// BANK MUTATIONS
// ==============================
function isSystemBankAdjustmentMutation(mutation) {
    return String(mutation?.keterangan || '').toLowerCase().includes('penyesuaian sistem (sinkronisasi modal bank');
}

function getRealBankMutations() {
    const mutations = getMutations();
    const realMutations = mutations.filter(m => !isSystemBankAdjustmentMutation(m));

    if(realMutations.length !== mutations.length && typeof saveMutations === 'function') {
        saveMutations(realMutations);
    }

    return realMutations;
}

function loadMutationsTable() {
    const mutations = getRealBankMutations();
    const tbody = document.getElementById('mutationsTableBody');
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';
    tbody.innerHTML = '';

    if(mutations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada mutasi bank real.</td></tr>';
        return;
    }

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
    const bankSummary = getClosingBankSummary();
    if(document.getElementById('closingBankSistem')) document.getElementById('closingBankSistem').textContent = formatIdr(bankSummary.total);
    setupClosingKoinFormatter();
    
    // Reset inputs
    document.querySelectorAll('.denom-input').forEach(i => i.value = '');
    document.getElementById('closingNote').value = '';
    const typeEl = document.getElementById('closingType');
    if(typeEl) typeEl.value = 'temporary';
    
    window.updateClosingModeUi();
    calculateClosingPhysical();
}

function getClosingTypeLabel(type) {
    return type === 'final' ? 'Closing Final' : 'Cek Sementara';
}

function parseClosingRupiahInput(value) {
    return parseInt(String(value || '').replace(/[^\d]/g, ''), 10) || 0;
}

function getClosingBankSummary() {
    const bca = typeof getBankBCA === 'function' ? (parseInt(getBankBCA()) || 0) : 0;
    const mandiri = typeof getBankMandiri === 'function' ? (parseInt(getBankMandiri()) || 0) : 0;
    return {
        bca,
        mandiri,
        total: bca + mandiri
    };
}

function getClosingExpenseSummary() {
    const selectedDate = document.getElementById('closingDateInput')?.value?.slice(0, 10)
        || new Date().toISOString().slice(0, 10);
    return (typeof getExpenses === 'function' ? getExpenses() : []).reduce((total, expense) => {
        const expenseDate = String(expense?.timestamp || expense?.date || '').slice(0, 10);
        return expense?.tipe === 'PENGELUARAN' && expenseDate === selectedDate
            ? total + (parseFloat(expense.nominal) || 0)
            : total;
    }, 0);
}

function getClosingValasValue() {
    const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
    const transactions = typeof getTransactions === 'function' ? getTransactions() : [];
    return currencies.reduce((total, currency) => {
        const stock = parseFloat(currency?.stock) || 0;
        let rate = parseFloat(currency?.avg_buy_rate ?? currency?.initial_rate_locked) || 0;
        if (typeof calculateCurrencyAverageCost === 'function') {
            rate = calculateCurrencyAverageCost(currency, transactions).rate || rate;
        }
        return total + (stock * (rate || parseFloat(currency?.buy) || 0));
    }, 0);
}

function setupClosingKoinFormatter() {
    const input = document.getElementById('denomKoin');
    if(!input || input.dataset.rupiahFormatterReady === '1') return;

    input.dataset.rupiahFormatterReady = '1';
    input.addEventListener('input', function() {
        const amount = parseClosingRupiahInput(this.value);
        this.value = amount > 0 ? formatIdr(amount) : '';
        calculateClosingPhysical();
    });
    input.addEventListener('blur', function() {
        const amount = parseClosingRupiahInput(this.value);
        this.value = amount > 0 ? formatIdr(amount) : '';
    });
}

window.updateClosingModeUi = function() {
    const type = document.getElementById('closingType')?.value || 'temporary';
    const btn = document.getElementById('btnSaveClosing');
    const help = document.getElementById('closingModeHelp');
    if(btn) {
        btn.innerHTML = type === 'final'
            ? '<i class="fa-solid fa-lock"></i> Simpan & Kunci Closing Final'
            : '<i class="fa-solid fa-clipboard-check"></i> Simpan Cek Sementara';
    }
    if(help) {
        help.textContent = type === 'final'
            ? 'Closing final menyesuaikan saldo kas sistem menjadi kas fisik. Saldo bank ikut tampil dalam total rekonsiliasi, tetapi tidak diubah.'
            : 'Cek sementara mencatat posisi kas dan bank untuk rekonsiliasi tanpa mengubah saldo sistem.';
    }
};

function getClosingDenomValue(id) {
    const input = document.getElementById(id);
    return input ? parseClosingRupiahInput(input.value) : 0;
}

function calculateClosingPhysical() {
    const d100 = getClosingDenomValue('denom100k');
    const d50  = getClosingDenomValue('denom50k');
    const d20  = getClosingDenomValue('denom20k');
    const d10  = getClosingDenomValue('denom10k');
    const d5   = getClosingDenomValue('denom5k');
    const d2   = getClosingDenomValue('denom2k');
    const d1   = getClosingDenomValue('denom1k');
    const dKoin= getClosingDenomValue('denomKoin');

    const totalFisik = (d100 * 100000) + (d50 * 50000) + (d20 * 20000) + 
                       (d10 * 10000) + (d5 * 5000) + (d2 * 2000) + 
                       (d1 * 1000) + dKoin;
    
    // Ambil data gantungan aktif (menghitung sisa saldo setelah cicilan)
    const gantungans = window.safeArrayGet('mc_gantungans');
    let gantunganPiutang = 0;
    let gantunganUtang = 0;
    gantungans.forEach(item => {
        if (item.status === 'BELUM_LUNAS') {
            const sisa = item.nominal - (item.terbayar || 0);
            if (item.tipe === 'PIUTANG') gantunganPiutang += sisa;
            else if (item.tipe === 'UTANG') gantunganUtang += sisa;
        }
    });

    const kasSistem = getCash();
    const bankSummary = getClosingBankSummary();
    const totalExpenses = getClosingExpenseSummary();
    const totalValasValue = getClosingValasValue();
    const totalSistemRupiah = kasSistem + bankSummary.total;
    const totalFisikPlusBank = totalFisik + bankSummary.total;
    // Rumus total: (Kas Fisik + Bank Sistem) - (Kas Sistem + Bank Sistem) + Gantungan Piutang - Gantungan Utang
    const selisih = totalFisikPlusBank - totalSistemRupiah + gantunganPiutang - gantunganUtang;

    const fisikNode = document.getElementById('closingFisik');
    const kasNode = document.getElementById('closingKasSistem');
    const bankNode = document.getElementById('closingBankSistem');
    const bankBcaNode = document.getElementById('closingBankBca');
    const bankMandiriNode = document.getElementById('closingBankMandiri');
    const valasNode = document.getElementById('closingValasValue');
    const totalSistemNode = document.getElementById('closingTotalSistemRupiah');
    const totalFisikBankNode = document.getElementById('closingTotalFisikBank');
    const piutangNode = document.getElementById('closingGantunganPiutang');
    const utangNode = document.getElementById('closingGantunganUtang');
    const expensesNode = document.getElementById('closingTotalExpenses');
    const selNode = document.getElementById('closingSelisih');

    if(fisikNode) fisikNode.textContent = formatIdr(totalFisik);
    if(kasNode) kasNode.textContent = formatIdr(kasSistem);
    if(bankNode) bankNode.textContent = formatIdr(bankSummary.total);
    if(bankBcaNode) bankBcaNode.textContent = formatIdr(bankSummary.bca);
    if(bankMandiriNode) bankMandiriNode.textContent = formatIdr(bankSummary.mandiri);
    if(valasNode) valasNode.textContent = formatIdr(totalValasValue);
    if(totalSistemNode) totalSistemNode.textContent = formatIdr(totalSistemRupiah);
    if(totalFisikBankNode) totalFisikBankNode.textContent = formatIdr(totalFisikPlusBank);
    if(piutangNode) piutangNode.textContent = formatIdr(gantunganPiutang);
    if(utangNode) utangNode.textContent = formatIdr(gantunganUtang);
    if(expensesNode) expensesNode.textContent = formatIdr(totalExpenses);
    if(!selNode) return;

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
    
    // Hitung ulang gantungan aktif saat save (menghitung sisa saldo setelah cicilan)
    const gantungans = window.safeArrayGet('mc_gantungans');
    let gantunganPiutang = 0;
    let gantunganUtang = 0;
    gantungans.forEach(item => {
        if (item.status === 'BELUM_LUNAS') {
            const sisa = item.nominal - (item.terbayar || 0);
            if (item.tipe === 'PIUTANG') gantunganPiutang += sisa;
            else if (item.tipe === 'UTANG') gantunganUtang += sisa;
        }
    });

    const kasSistem = getCash();
    const bankSummary = getClosingBankSummary();
    const totalExpenses = getClosingExpenseSummary();
    const totalValasValue = getClosingValasValue();
    const totalSistemRupiah = kasSistem + bankSummary.total;
    const totalFisikPlusBank = totalFisik + bankSummary.total;
    const selisih = totalFisikPlusBank - totalSistemRupiah + gantunganPiutang - gantunganUtang;
    const note = document.getElementById('closingNote').value;
    const closingType = document.getElementById('closingType')?.value || 'temporary';
    const dateInput = document.getElementById('closingDateInput');
    let ts = new Date().toISOString();
    if(dateInput && dateInput.value) {
        ts = new Date(dateInput.value).toISOString();
    }

    if(closingType === 'final' && !confirm('Closing Final akan mengunci catatan dan menyesuaikan saldo kas sistem menjadi kas fisik. Lanjutkan?')) {
        return;
    }

    const closingData = {
        id: 'CLS-' + Date.now().toString().slice(-6),
        timestamp: ts,
        type: closingType,
        kasSistem: kasSistem,
        bankBCA: bankSummary.bca,
        bankMandiri: bankSummary.mandiri,
        bankSistem: bankSummary.total,
        totalValasRp: totalValasValue,
        totalSistemRupiah: totalSistemRupiah,
        totalFisikPlusBank: totalFisikPlusBank,
        kasFisik: totalFisik,
        gantunganPiutang: gantunganPiutang,
        gantunganUtang: gantunganUtang,
        pengeluaranHari: totalExpenses,
        selisih: selisih,
        catatan: note
    };

    const closings = getClosings();
    closings.push(closingData);
    saveClosings(closings);

    if(closingType === 'final') {
        saveCash(totalFisik);
    }

    alert(closingType === 'final'
        ? "Closing Final berhasil disimpan! Saldo Kas Sistem telah disesuaikan menjadi Rp " + totalFisik.toLocaleString()
        : "Cek Sementara berhasil disimpan. Saldo Kas Sistem tidak berubah.");
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
        const type = c.type || c.closingType || 'final';
        const typeHtml = type === 'final'
            ? '<span style="color:#f59e0b; font-weight:700;">Final</span>'
            : '<span style="color:#93c5fd; font-weight:700;">Sementara</span>';
        
        const gPiutang = c.gantunganPiutang || 0;
        const gUtang = c.gantunganUtang || 0;
        const gNet = gPiutang - gUtang;
        const bankTotal = parseInt(c.bankSistem ?? ((c.bankBCA || 0) + (c.bankMandiri || 0))) || 0;
        const totalSistemRupiah = parseInt(c.totalSistemRupiah ?? ((c.kasSistem || 0) + bankTotal)) || 0;
        let gantunganText = '-';
        if (gNet !== 0) {
            const sign = gNet > 0 ? '+' : '-';
            gantunganText = `<span style="color: ${gNet > 0 ? '#F59E0B' : '#3B82F6'}; font-weight: 500;">${sign}${formatIdr(Math.abs(gNet))}</span>`;
        }

        let selisihHtml = `<span style="color: ${c.selisih < 0 ? '#ef4444' : (c.selisih > 0 ? '#10b981' : 'inherit')}">${formatIdr(c.selisih)}</span>`;
        
        tr.innerHTML = `
            <td>${window.formatDateToDMY(c.timestamp)}</td>
            <td>${c.id}</td>
            <td>${typeHtml}</td>
            <td>${formatIdr(c.kasSistem)}</td>
            <td>${formatIdr(bankTotal)}</td>
            <td>${formatIdr(totalSistemRupiah)}</td>
            <td>${formatIdr(c.kasFisik)}</td>
            <td>${gantunganText}</td>
            <td><strong>${selisihHtml}</strong></td>
            <td>${c.catatan || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openEditClosingModal('${c.id}')"><i class="fa-solid fa-pen"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if(sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">Belum ada riwayat closing.</td></tr>';
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
    const typeEl = document.getElementById('editClosingType');
    if(typeEl) typeEl.value = c.type || c.closingType || 'final';
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
    const closingType = document.getElementById('editClosingType')?.value || 'temporary';
    const note = document.getElementById('editClosingNote').value;

    const closings = getClosings();
    const idx = closings.findIndex(x => x.id === id);
    if(idx === -1) return;

    closings[idx].timestamp = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
    closings[idx].type = closingType;
    closings[idx].kasFisik = kasFisik;
    const gPiutang = closings[idx].gantunganPiutang || 0;
    const gUtang = closings[idx].gantunganUtang || 0;
    const bankTotal = parseInt(closings[idx].bankSistem ?? ((closings[idx].bankBCA || 0) + (closings[idx].bankMandiri || 0))) || 0;
    const totalSistemRupiah = kasSistem + bankTotal;
    const totalFisikPlusBank = kasFisik + bankTotal;
    closings[idx].bankSistem = bankTotal;
    closings[idx].totalSistemRupiah = totalSistemRupiah;
    closings[idx].totalFisikPlusBank = totalFisikPlusBank;
    closings[idx].selisih = totalFisikPlusBank - totalSistemRupiah + gPiutang - gUtang;
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
    if(document.getElementById('profVisionKey')) {
        const valKey = p.visionKey || localStorage.getItem('mc_vision_api_key') || '';
        document.getElementById('profVisionKey').value = (valKey === 'null' || valKey === 'undefined') ? '' : valKey;
    }
    document.getElementById('profPhone').value = p.phone || '';
    if(document.getElementById('profWaNumber')) document.getElementById('profWaNumber').value = p.phoneWA || '';
    document.getElementById('profFooter').value = p.footer || '';
    document.getElementById('profWaTemplate').value = p.waTemplate || DEFAULT_WA_TEMPLATE;

    // Load Start Balances
    let initCash = localStorage.getItem('mc_initial_cash');
    if (initCash === null) {
        initCash = (getCash() || 0).toString();
        localStorage.setItem('mc_initial_cash', initCash);
        if (typeof pushToUniversalDatastore === 'function') {
            pushToUniversalDatastore('mc_initial_cash', parseInt(initCash));
        }
    }
    
    let initBCA = localStorage.getItem('mc_initial_bank_bca');
    if (initBCA === null) {
        initBCA = (getBankBCA() || 0).toString();
        localStorage.setItem('mc_initial_bank_bca', initBCA);
        if (typeof pushToUniversalDatastore === 'function') {
            pushToUniversalDatastore('mc_initial_bank_bca', parseInt(initBCA));
        }
    }

    let initMandiri = localStorage.getItem('mc_initial_bank_mandiri');
    if (initMandiri === null) {
        initMandiri = (getBankMandiri() || 0).toString();
        localStorage.setItem('mc_initial_bank_mandiri', initMandiri);
        if (typeof pushToUniversalDatastore === 'function') {
            pushToUniversalDatastore('mc_initial_bank_mandiri', parseInt(initMandiri));
        }
    }

    document.getElementById('initCash').value = initCash;
    document.getElementById('initBankBCA').value = initBCA;
    document.getElementById('initBankMandiri').value = initMandiri;
    
    // Load existing valas to table
    const currencies = getCurrencies();
    document.getElementById('initValasBody').innerHTML = ''; // reset
    currencies.forEach(c => {
        const initStock = (c.initialStock !== undefined && c.initialStock !== null) ? c.initialStock : (c.stock || 0);
        addInitValasRow(c.code, initStock, c.initial_rate_locked ?? ''); // kurs saldo awal independen
    });

    recalcInitTotal();
    
    document.getElementById('initCash').addEventListener('input', recalcInitTotal);
    document.getElementById('initBankBCA').addEventListener('input', recalcInitTotal);
    document.getElementById('initBankMandiri').addEventListener('input', recalcInitTotal);

    if(typeof loadWaTemplatesSettings === 'function') loadWaTemplatesSettings();
    if(typeof loadWaGatewaySettings === 'function') loadWaGatewaySettings();
}

window.switchSettingsTab = function(tabName) {
    document.querySelectorAll('.settings-tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.add('hidden');
    });
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.classList.remove('active', 'btn-primary');
        btn.classList.add('btn-outline');
    });

    const activeTab = document.getElementById('settings-tab-' + tabName);
    const activeBtn = document.getElementById('btn-tab-settings-' + tabName);

    if (activeTab) {
        activeTab.style.display = 'block';
        activeTab.classList.remove('hidden');
    }
    if (activeBtn) {
        activeBtn.classList.remove('btn-outline');
        activeBtn.classList.add('btn-primary', 'active');
    }

    if (tabName === 'wa' && typeof loadWaTemplatesSettings === 'function') {
        loadWaTemplatesSettings();
    }
    if (tabName === 'wa-gateway' && typeof loadWaGatewaySettings === 'function') {
        loadWaGatewaySettings();
    }
    if (tabName === 'ai' && typeof loadGeminiSettings === 'function') {
        loadGeminiSettings();
    }
};

function getDefaultWaTemplate() {
    const templates = getWaTemplates();
    return templates.find(t => t.isDefault) || templates[0] || {
        id: 'wa-fallback',
        name: 'Default',
        category: 'Transaksi',
        isDefault: true,
        content: getProfile().waTemplate || DEFAULT_WA_TEMPLATE
    };
}

window.getDefaultWaTemplate = getDefaultWaTemplate;

const WA_TEMPLATE_PURPOSES = [
    { id: 'pos', label: 'POS / Bukti Transaksi' },
    { id: 'riwayat', label: 'Riwayat Transaksi' },
    { id: 'booking', label: 'Booking Valas' },
    { id: 'waiting', label: 'Antrean / Valas Ready' },
    { id: 'old-money', label: 'Uang Lama' },
    { id: 'kurs', label: 'Kirim Kurs' },
    { id: 'broadcast', label: 'Broadcast Nasabah' },
    { id: 'audit', label: 'Audit Transaksi' },
    { id: 'customer', label: 'Kontak Nasabah' }
];

function normalizeWaTemplatePurposes(template) {
    return Array.isArray(template?.purposes) ? template.purposes : [];
}

window.getWaTemplateForPurpose = function(purpose) {
    const templates = getWaTemplates();
    return templates.find(template => normalizeWaTemplatePurposes(template).includes(purpose))
        || getDefaultWaTemplate();
};

function renderWaTemplatePurposeChoices(selected = []) {
    const box = document.getElementById('waTemplatePurposes');
    if (!box) return;
    box.innerHTML = WA_TEMPLATE_PURPOSES.map(purpose => `
        <label style="display:flex;align-items:center;gap:7px;font-size:.78rem;cursor:pointer;">
            <input type="checkbox" class="wa-template-purpose" value="${purpose.id}" ${selected.includes(purpose.id) ? 'checked' : ''}>
            ${purpose.label}
        </label>
    `).join('');
}

function getWaTemplatePurposeLabels(template) {
    const selected = normalizeWaTemplatePurposes(template);
    if (!selected.length) return '<span class="text-muted">Default / semua</span>';
    return WA_TEMPLATE_PURPOSES.filter(purpose => selected.includes(purpose.id))
        .map(purpose => `<span style="display:inline-block;margin:2px 3px 2px 0;padding:2px 5px;border-radius:4px;background:rgba(37,211,102,.12);color:#86efac;font-size:.68rem;">${purpose.label}</span>`)
        .join('');
}

window.loadWaTemplatesSettings = function() {
    const tbody = document.getElementById('waTemplatesTableBody');
    if(!tbody) return;
    const templates = getWaTemplates();
    tbody.innerHTML = templates.map(t => `
        <tr>
            <td><strong>${t.name || '-'}</strong><br><small class="text-muted">${(t.content || '').substring(0, 80)}${(t.content || '').length > 80 ? '...' : ''}</small></td>
            <td>${t.category || '-'}</td>
            <td>${getWaTemplatePurposeLabels(t)}</td>
            <td class="text-center">${t.isDefault ? '<span class="badge" style="background:#10b981;color:white;padding:4px 8px;border-radius:4px;">Ya</span>' : '-'}</td>
            <td class="text-center" style="white-space:nowrap;">
                <button class="btn btn-sm btn-primary mx-1" onclick="editWaTemplate('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-danger mx-1" onclick="deleteWaTemplate('${t.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="text-center text-muted">Belum ada template.</td></tr>';
    const purposeBox = document.getElementById('waTemplatePurposes');
    if (purposeBox && !purposeBox.children.length) renderWaTemplatePurposeChoices([]);
};

window.newWaTemplate = function() {
    document.getElementById('waTemplateId').value = '';
    document.getElementById('waTemplateName').value = '';
    document.getElementById('waTemplateCategory').value = 'Transaksi';
    document.getElementById('waTemplateContent').value = '';
    document.getElementById('waTemplateDefault').checked = getWaTemplates().length === 0;
    renderWaTemplatePurposeChoices([]);
};

window.editWaTemplate = function(id) {
    const template = getWaTemplates().find(t => t.id === id);
    if(!template) return;
    document.getElementById('waTemplateId').value = template.id;
    document.getElementById('waTemplateName').value = template.name || '';
    document.getElementById('waTemplateCategory').value = template.category || '';
    document.getElementById('waTemplateContent').value = template.content || '';
    document.getElementById('waTemplateDefault').checked = !!template.isDefault;
    renderWaTemplatePurposeChoices(normalizeWaTemplatePurposes(template));
};

window.saveWaTemplateFromSettings = function() {
    const id = document.getElementById('waTemplateId').value || ('wa-' + Date.now());
    const name = document.getElementById('waTemplateName').value.trim();
    const category = document.getElementById('waTemplateCategory').value.trim() || 'Transaksi';
    const content = document.getElementById('waTemplateContent').value.trim();
    const isDefault = document.getElementById('waTemplateDefault').checked;
    const purposes = Array.from(document.querySelectorAll('.wa-template-purpose:checked')).map(input => input.value);

    if(!name || !content) {
        alert('Nama template dan isi pesan wajib diisi.');
        return;
    }

    let templates = getWaTemplates();
    if(isDefault) {
        templates = templates.map(t => ({ ...t, isDefault: false }));
    }

    const idx = templates.findIndex(t => t.id === id);
    const next = { id, name, category, content, purposes, isDefault: isDefault || templates.length === 0 };
    if(idx > -1) templates[idx] = next;
    else templates.push(next);

    if(!templates.some(t => t.isDefault) && templates.length > 0) {
        templates[0].isDefault = true;
    }

    saveWaTemplates(templates);
    loadWaTemplatesSettings();
    newWaTemplate();
    alert('Template WhatsApp berhasil disimpan.');
};

window.deleteWaTemplate = function(id) {
    let templates = getWaTemplates();
    if(templates.length <= 1) {
        alert('Minimal harus ada satu template WhatsApp.');
        return;
    }
    if(!confirm('Hapus template WhatsApp ini?')) return;
    const deleted = templates.find(t => t.id === id);
    templates = templates.filter(t => t.id !== id);
    if(deleted && deleted.isDefault && templates.length > 0) {
        templates[0].isDefault = true;
    }
    saveWaTemplates(templates);
    loadWaTemplatesSettings();
    newWaTemplate();
};

function getWaGatewaySettings() {
    try {
        const value = JSON.parse(localStorage.getItem('mc_wa_gateway') || '{}');
        return value && typeof value === 'object' ? value : {};
    } catch (error) {
        return {};
    }
}

window.loadWaGatewaySettings = function() {
    const settings = getWaGatewaySettings();
    const fields = {
        waGatewayProvider: settings.provider || '',
        waGatewayEndpoint: settings.endpoint || '',
        waGatewayToken: settings.token || '',
        waGatewaySender: settings.sender || '',
        waGatewayHeaders: settings.headers || '',
        waGatewayPayload: settings.payload || ''
    };

    Object.entries(fields).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.value = value;
    });
    const enabled = document.getElementById('waGatewayEnabled');
    if (enabled) enabled.checked = Boolean(settings.enabled);
    const method = document.getElementById('waGatewayMethod');
    if (method) method.value = settings.method || 'POST';
    const bodyFormat = document.getElementById('waGatewayBodyFormat');
    if (bodyFormat) bodyFormat.value = settings.bodyFormat || 'form';
    window.updateWaGatewayStatus();
};

window.updateWaGatewayStatus = function() {
    const status = document.getElementById('waGatewayStatus');
    const enabled = document.getElementById('waGatewayEnabled');
    if (!status) return;
    const isEnabled = Boolean(enabled && enabled.checked);
    status.textContent = isEnabled ? 'Aktif' : 'Nonaktif';
    status.style.background = isEnabled ? '#16a34a' : '#64748b';
};

// Status aktif harus langsung tersimpan, walau pengguna belum menekan tombol Simpan.
window.persistWaGatewayEnabled = function() {
    const enabled = Boolean(document.getElementById('waGatewayEnabled')?.checked);
    const existing = getWaGatewaySettings();
    const settings = {
        ...existing,
        enabled,
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem('mc_wa_gateway', JSON.stringify(settings));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_wa_gateway', settings);
    }
};

window.toggleWaGatewayTokenVisibility = function() {
    const token = document.getElementById('waGatewayToken');
    if (!token) return;
    token.type = token.type === 'password' ? 'text' : 'password';
};

window.applyWaGatewayPreset = function(provider) {
    if (provider !== 'fonnte') return;
    const set = (id, value) => {
        const input = document.getElementById(id);
        if (input) input.value = value;
    };
    set('waGatewayProvider', 'Fonnte');
    set('waGatewayEndpoint', 'https://api.fonnte.com/send');
    set('waGatewayMethod', 'POST');
    set('waGatewayBodyFormat', 'form');
    set('waGatewayHeaders', '{"Authorization":"{TOKEN}"}');
    set('waGatewayPayload', '{"target":"{TARGET}","message":"{MESSAGE}","countryCode":"0"}');
    alert('Format API Fonnte sudah diisi. Masukkan Token Fonnte Anda, aktifkan Gateway, lalu Simpan.');
};

window.saveWaGatewaySettings = function() {
    const provider = document.getElementById('waGatewayProvider')?.value.trim() || '';
    const endpoint = document.getElementById('waGatewayEndpoint')?.value.trim() || '';
    const token = document.getElementById('waGatewayToken')?.value.trim() || '';
    const sender = document.getElementById('waGatewaySender')?.value.trim() || '';
    const method = document.getElementById('waGatewayMethod')?.value || 'POST';
    const bodyFormat = document.getElementById('waGatewayBodyFormat')?.value || 'form';
    const headers = document.getElementById('waGatewayHeaders')?.value.trim() || '';
    const payload = document.getElementById('waGatewayPayload')?.value.trim() || '';
    const enabled = Boolean(document.getElementById('waGatewayEnabled')?.checked);

    if (enabled && (!endpoint || !token)) {
        alert('URL Endpoint API dan Token / API Key wajib diisi saat WA Gateway diaktifkan.');
        return false;
    }
    for (const [label, value] of [['Header API', headers], ['Payload API', payload]]) {
        if (!value) continue;
        try {
            const parsed = JSON.parse(value);
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
        } catch (error) {
            alert(`${label} harus berupa objek JSON yang valid.`);
            return false;
        }
    }

    const settings = { provider, endpoint, token, sender, method, bodyFormat, headers, payload, enabled, updatedAt: new Date().toISOString() };
    localStorage.setItem('mc_wa_gateway', JSON.stringify(settings));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_wa_gateway', settings);
    }
    window.updateWaGatewayStatus();
    alert('Pengaturan WA Gateway berhasil disimpan.');
    return true;
};

window.testWaGatewayConnection = async function() {
    // Simpan dulu seluruh kolom yang sedang terlihat agar tes memakai konfigurasi terbaru.
    if (!window.saveWaGatewaySettings()) return;
    const settings = getWaGatewaySettings();
    const phone = document.getElementById('waGatewayTestPhone')?.value.trim() || '';
    if (!settings.enabled || !settings.endpoint || !settings.token) {
        alert('Aktifkan dan lengkapi WA Gateway sebelum melakukan tes.');
        return;
    }
    if (!phone) {
        alert('Masukkan nomor WhatsApp tujuan untuk pesan tes.');
        return;
    }
    try {
        await window.sendWhatsAppGateway(phone, 'Tes koneksi WA Gateway dari MC-ALMARA. Jika pesan ini diterima, pengaturan sudah benar.', { reference: 'WA-GATEWAY-TEST' });
        alert('Permintaan tes diterima oleh WA Gateway. Periksa perangkat/provider untuk status benar-benar terkirim ke WhatsApp.');
    } catch (error) {
        alert(`Tes WA Gateway gagal: ${error.message || error}`);
    }
};

window.addInitValasRow = function(code = '', stock = '', rate = '') {
    const currencies = getCurrencies();
    const usedCodes = Array.from(document.querySelectorAll('.init-valas-row .init-v-code'))
        .map(el => (el.value || '').trim())
        .filter(Boolean);
    const firstAvailableCode = currencies.find(c => !usedCodes.some(uc => uc.toUpperCase() === (c.code || '').toUpperCase()))?.code
        || currencies[0]?.code
        || '';
    const resolvedCode = code || firstAvailableCode || '';
    const resolvedRate = rate !== '' ? rate : '';

    const tbody = document.getElementById('initValasBody');
    const tr = document.createElement('tr');
    tr.className = 'init-valas-row';
    
    tr.innerHTML = `
        <td>
            <select class="form-control text-center init-v-code" style="font-weight:bold;">
                ${currencies.length === 0 ? '<option value="">-- Tambah di Manajemen Kurs dulu --</option>' : ''}
                ${currencies.map(c => {
                    const curCode = c.code || '';
                    const selected = curCode.toUpperCase() === resolvedCode.toUpperCase() ? 'selected' : '';
                    return `<option value="${curCode}" ${selected}>${curCode}</option>`;
                }).join('')}
                ${resolvedCode && !currencies.some(c => (c.code || '').toUpperCase() === resolvedCode.toUpperCase()) ? `<option value="${resolvedCode}" selected>${resolvedCode}</option>` : ''}
            </select>
        </td>
        <td><input type="number" class="form-control init-v-stock" value="${stock}" placeholder="0"></td>
        <td>
            <div class="input-group">
                <span class="input-group-text border-0 bg-transparent text-muted">Rp</span>
                <input type="number" class="form-control init-v-rate" value="${resolvedRate}" placeholder="Isi manual">
            </div>
        </td>
        <td class="text-end align-middle fw-bold init-v-total">Rp 0</td>
        <td class="text-center align-middle">
            <button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove(); recalcInitTotal();"><i class="fa-solid fa-trash"></i></button>
        </td>
    `;
    
    tbody.appendChild(tr);
    
    const codeSelect = tr.querySelector('.init-v-code');
    const rateInput = tr.querySelector('.init-v-rate');

    if (codeSelect && rateInput) {
        codeSelect.addEventListener('change', () => {
            recalcInitTotal();
        });
    }

    tr.querySelectorAll('input, select').forEach(inp => {
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
    
    // Simpan ke kunci awal (Saldo Awal Terkunci)
    localStorage.setItem('mc_initial_cash', cashVal.toString());
    localStorage.setItem('mc_initial_bank_bca', bankBcaVal.toString());
    localStorage.setItem('mc_initial_bank_mandiri', bankMandiriVal.toString());
    
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_initial_cash', cashVal);
        pushToUniversalDatastore('mc_initial_bank_bca', bankBcaVal);
        pushToUniversalDatastore('mc_initial_bank_mandiri', bankMandiriVal);
    }
    
    saveCash(cashVal);
    saveBankBCA(bankBcaVal);
    saveBankMandiri(bankMandiriVal);

    // Save Custom Initial Valas
    let masterCurrencies = getCurrencies();
    const rows = document.querySelectorAll('.init-valas-row');
    
    rows.forEach(tr => {
        const code = tr.querySelector('.init-v-code').value.trim();
        const stock = parseFloat(tr.querySelector('.init-v-stock').value) || 0;
        const rate = parseFloat(tr.querySelector('.init-v-rate').value) || 0;
        
        if(!code) return;
        
        let c = masterCurrencies.find(x => x.code.toUpperCase() === code.toUpperCase());
        if(c) {
            c.stock = stock;
            c.initialStock = stock;
            c.initial_rate_locked = rate;
            c.initial_rate_source = 'settings';
        } else {
            masterCurrencies.push({
                code: code,
                buy: rate,
                sell: rate + 150,
                stock: stock,
                initialStock: stock,
                alert: 1000,
                initial_rate_locked: rate,
                initial_rate_source: 'settings'
            });
        }
    });
    
    saveCurrencies(masterCurrencies);
    
    alert('Keseluruhan aset awal berhasil diterapkan.\n\nSaldo kas dan bank diset langsung tanpa membuat mutasi penyesuaian sistem. Kurs pada tabel Pengaturan disimpan sebagai kurs modal awal terkunci dan tidak akan ikut berubah saat Manajemen Kurs disinkronkan ke Smartdeal.');
    
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
                <button class="btn btn-sm btn-primary mx-1" onclick="editMasterJob(${i})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-danger mx-1" onclick="removeMasterJob(${i})"><i class="fa-solid fa-trash"></i></button>
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
                <button class="btn btn-sm btn-primary mx-1" onclick="editMasterCitizen(${i})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-danger mx-1" onclick="removeMasterCitizen(${i})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" class="text-center text-muted">Belum ada data</td></tr>';

    loadIso4217Table();
}

function addMasterJob() {
    const input = document.getElementById('newJobInput');
    const risk = document.getElementById('newJobRisk');
    const editIndexEl = document.getElementById('editJobIndex');
    const val = input.value?.trim();
    if(val) {
        const jobs = getMasterJobs();
        const editIndex = editIndexEl && editIndexEl.value !== '' ? parseInt(editIndexEl.value, 10) : -1;
        if(editIndex >= 0 && editIndex < jobs.length) {
            jobs[editIndex] = { name: val, risk: risk ? risk.value : 'Rendah' };
        } else {
            jobs.push({ name: val, risk: risk ? risk.value : 'Rendah' });
        }
        saveMasterJobs(jobs);
        clearMasterJobForm();
        loadMasterDataView();
    }
}

function editMasterJob(index) {
    const jobs = getMasterJobs();
    const job = jobs[index];
    if(!job) return;
    document.getElementById('editJobIndex').value = index;
    document.getElementById('newJobInput').value = job.name || '';
    document.getElementById('newJobRisk').value = job.risk || 'Rendah';
    const btn = document.getElementById('btnSaveJob');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-save"></i>';
}

function clearMasterJobForm() {
    const input = document.getElementById('newJobInput');
    const risk = document.getElementById('newJobRisk');
    const editIndexEl = document.getElementById('editJobIndex');
    if(input) input.value = '';
    if(risk) risk.value = 'Rendah';
    if(editIndexEl) editIndexEl.value = '';
    const btn = document.getElementById('btnSaveJob');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
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
    const editIndexEl = document.getElementById('editCitizenIndex');
    const val = input.value?.trim();
    if(val) {
        const citizens = getMasterCitizens();
        const editIndex = editIndexEl && editIndexEl.value !== '' ? parseInt(editIndexEl.value, 10) : -1;
        if(editIndex >= 0 && editIndex < citizens.length) {
            citizens[editIndex] = { name: val, risk: risk ? risk.value : 'Rendah' };
        } else {
            citizens.push({ name: val, risk: risk ? risk.value : 'Rendah' });
        }
        saveMasterCitizens(citizens);
        clearMasterCitizenForm();
        loadMasterDataView();
    }
}

function editMasterCitizen(index) {
    const citizens = getMasterCitizens();
    const citizen = citizens[index];
    if(!citizen) return;
    document.getElementById('editCitizenIndex').value = index;
    document.getElementById('newCitizenInput').value = citizen.name || '';
    document.getElementById('newCitizenRisk').value = citizen.risk || 'Rendah';
    const btn = document.getElementById('btnSaveCitizen');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-save"></i>';
}

function clearMasterCitizenForm() {
    const input = document.getElementById('newCitizenInput');
    const risk = document.getElementById('newCitizenRisk');
    const editIndexEl = document.getElementById('editCitizenIndex');
    if(input) input.value = '';
    if(risk) risk.value = 'Rendah';
    if(editIndexEl) editIndexEl.value = '';
    const btn = document.getElementById('btnSaveCitizen');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
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
    const countryCode = (document.getElementById('newMcCountryCode')?.value || '').trim().toUpperCase();
    
    if(!code) {
        alert("Kode Mata Uang tidak boleh kosong!");
        return;
    }
    
    let db = getMasterCurrencies();
    if(db.find(c => c.code === code)) {
        alert("Kode mata uang ini sudah ada di master data!");
        return;
    }
    
    db.push({ code, country, symbol, flag, countryCode });
    saveMasterCurrencies(db);
    
    document.getElementById('newMcCode').value = '';
    document.getElementById('newMcCountry').value = '';
    document.getElementById('newMcSymbol').value = '';
    document.getElementById('newMcFlag').value = '';
    if (document.getElementById('newMcCountryCode')) document.getElementById('newMcCountryCode').value = '';
    
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

window.iso4217Target = null;

function renderIso4217Rows(targetBodyId, searchValue, mode = 'page') {
    const tbody = document.getElementById(targetBodyId);
    if (!tbody) return;

    const query = (searchValue || '').trim().toLowerCase();
    const source = typeof getIso4217Reference === 'function' ? getIso4217Reference() : [];
    const filtered = source.filter(item => {
        if (!query) return true;
        const haystack = `${item.code} ${item.country || ''} ${item.currencyName || ''} ${item.symbol || ''}`.toLowerCase();
        return haystack.includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada kode yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const payload = `'${item.code}','${(item.country || '').replace(/'/g, "\\'")}','${(item.currencyName || '').replace(/'/g, "\\'")}','${(item.symbol || '').replace(/'/g, "\\'")}','${(item.countryCode || '').replace(/'/g, "\\'")}'`;
        const pageActions = `
            <button class="btn btn-sm btn-primary" onclick="addIso4217ToMaster(${payload})"><i class="fa-solid fa-plus"></i> Tambah ke Master</button>
            <button class="btn btn-sm btn-outline" onclick="applyIso4217ToMaster(${payload})"><i class="fa-solid fa-database"></i> Isi Master</button>
            <button class="btn btn-sm btn-outline" onclick="applyIso4217ToCurrencyForm(${payload})"><i class="fa-solid fa-money-bill-transfer"></i> Form Kurs</button>
            <button class="btn btn-sm btn-outline" onclick="applyIso4217ToOldMoneyForm(${payload})"><i class="fa-solid fa-coins"></i> Form Koin</button>
        `;
        const modalAction = `<button class="btn btn-sm btn-primary" onclick="applyIso4217ToActiveForm(${payload})"><i class="fa-solid fa-arrow-right"></i> Pakai ke Form</button>`;

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.2rem;">${item.flag || ''}</span>
                        <strong>${item.code}</strong>
                    </div>
                </td>
                <td>${item.country || '-'}</td>
                <td>${item.currencyName || '-'}</td>
                <td class="text-center">${item.symbol || item.code}</td>
                <td class="text-center" style="white-space: nowrap;">${mode === 'modal' ? modalAction : pageActions}</td>
            </tr>
        `;
    }).join('');
}

window.loadIso4217Table = function() {
    const filter = document.getElementById('iso4217Filter')?.value || '';
    renderIso4217Rows('iso4217TableBody', filter, 'page');
}

window.loadIso4217ModalTable = function() {
    const filter = document.getElementById('iso4217FilterModal')?.value || '';
    renderIso4217Rows('iso4217ModalTableBody', filter, 'modal');
}

window.openIso4217Modal = function(target = null) {
    if (target) {
        window.iso4217Target = target;
    }

    const modal = document.getElementById('iso4217Modal');
    if (!modal) return;
    modal.style.display = 'block';
    window.loadIso4217ModalTable();

    const input = document.getElementById('iso4217FilterModal');
    if (input) {
        setTimeout(() => input.focus(), 50);
    }
}

window.closeIso4217Modal = function() {
    const modal = document.getElementById('iso4217Modal');
    if (modal) modal.style.display = 'none';
}

window.applyIso4217ToMaster = function(code, country, currencyName, symbol, countryCode) {
    const flagBuilder = (window.AlmaraApp && window.AlmaraApp.utils && window.AlmaraApp.utils.buildFlagEmoji) || window.buildFlagEmoji;
    document.getElementById('newMcCode').value = code || '';
    document.getElementById('newMcCountry').value = country || currencyName || '';
    document.getElementById('newMcSymbol').value = symbol || code || '';
    document.getElementById('newMcFlag').value = typeof flagBuilder === 'function' ? flagBuilder(countryCode || '') : '';
    if (document.getElementById('newMcCountryCode')) document.getElementById('newMcCountryCode').value = countryCode || '';
    alert(`Kode ${code} sudah dimasukkan ke form Master Data.`);
}

window.addIso4217ToMaster = function(code, country, currencyName, symbol, countryCode) {
    let db = getMasterCurrencies();
    const exists = db.find(item => item.code === code);

    if (exists) {
        alert(`Kode ${code} sudah ada di Master Data.`);
        return;
    }

    const flagBuilder = (window.AlmaraApp && window.AlmaraApp.utils && window.AlmaraApp.utils.buildFlagEmoji) || window.buildFlagEmoji;
    const normalizedCountryCode = (countryCode || '').toUpperCase();

    db.push({
        code,
        country: country || currencyName || code,
        symbol: symbol || code,
        countryCode: normalizedCountryCode,
        flag: typeof flagBuilder === 'function' ? flagBuilder(normalizedCountryCode) : ''
    });

    saveMasterCurrencies(db);
    loadMasterCurrencyList();
    loadIso4217Table();

    if (document.getElementById('newMcCode')) document.getElementById('newMcCode').value = '';
    if (document.getElementById('newMcCountry')) document.getElementById('newMcCountry').value = '';
    if (document.getElementById('newMcSymbol')) document.getElementById('newMcSymbol').value = '';
    if (document.getElementById('newMcFlag')) document.getElementById('newMcFlag').value = '';
    if (document.getElementById('newMcCountryCode')) document.getElementById('newMcCountryCode').value = '';

    alert(`Kode ${code} berhasil ditambahkan ke Master Data.`);
}

window.applyIso4217ToCurrencyForm = function(code) {
    openCurrencyModal();
    document.getElementById('modalCurCode').value = code || '';
    window.iso4217Target = 'currency';
    window.closeIso4217Modal();
}

window.applyIso4217ToOldMoneyForm = function(code, country, currencyName) {
    openOldMoneyItemModal();
    document.getElementById('modalOldItemCode').value = code || '';
    const descInput = document.getElementById('modalOldItemDesc');
    if (descInput && !descInput.value.trim()) {
        descInput.value = currencyName || country || code || '';
    }
    window.iso4217Target = 'old-money';
    window.closeIso4217Modal();
}

window.applyIso4217ToOldMoneySupplierForm = function(code) {
    const input = document.getElementById('modalOldSupplierCurrency');
    if (input) input.value = code || '';
    window.iso4217Target = 'old-money-supplier';
    window.closeIso4217Modal();
}

window.applyIso4217ToValasGalleryForm = function(code, country, currencyName) {
    const codeInput = document.getElementById('modalValasCode');
    if (codeInput) {
        codeInput.value = code || '';
    }
    const descInput = document.getElementById('modalValasDesc');
    if (descInput && !descInput.value.trim()) {
        descInput.value = currencyName || country || code || '';
    }
    window.iso4217Target = 'valas-gallery';
    window.closeIso4217Modal();
}

window.applyIso4217ToActiveForm = function(code, country, currencyName, symbol, countryCode) {
    if (window.iso4217Target === 'currency') {
        window.applyIso4217ToCurrencyForm(code, country, currencyName, symbol, countryCode);
        return;
    }

    if (window.iso4217Target === 'old-money') {
        window.applyIso4217ToOldMoneyForm(code, country, currencyName, symbol, countryCode);
        return;
    }

    if (window.iso4217Target === 'old-money-supplier') {
        window.applyIso4217ToOldMoneySupplierForm(code, country, currencyName, symbol, countryCode);
        return;
    }

    if (window.iso4217Target === 'valas-gallery') {
        window.applyIso4217ToValasGalleryForm(code, country, currencyName, symbol, countryCode);
        return;
    }

    window.applyIso4217ToMaster(code, country, currencyName, symbol, countryCode);
    window.closeIso4217Modal();
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

    const readSavedVisionKey = () => {
        let key = localStorage.getItem('mc_vision_api_key');
        if (key === 'null' || key === 'undefined' || key === '') {
            key = null;
        }
        if (!key) {
            const p = getProfile();
            if (p && p.visionKey && p.visionKey !== 'null' && p.visionKey !== 'undefined' && p.visionKey !== '') {
                key = p.visionKey;
            }
        }
        return key ? key.trim() : null;
    };

    const saveVisionKey = (key) => {
        const cleanKey = (key || '').trim();
        if (!cleanKey) return;
        localStorage.setItem('mc_vision_api_key', cleanKey);
        const p = getProfile();
        if (p) {
            p.visionKey = cleanKey;
            saveProfile(p);
        }
    };

    const clearVisionKey = () => {
        localStorage.removeItem('mc_vision_api_key');
        const p = getProfile();
        if (p) {
            p.visionKey = '';
            saveProfile(p);
        }
    };

    const askVisionKey = async (message) => {
        const promptResult = await Swal.fire({
            icon: 'warning',
            title: 'API Key Google Vision Dibutuhkan',
            text: message,
            input: 'password',
            inputLabel: 'Masukkan API Key Google Cloud Vision',
            inputPlaceholder: 'Tempel API key Vision di sini',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true,
            confirmButtonText: 'Simpan & Coba Lagi',
            cancelButtonText: 'Batal',
            inputValidator: (value) => {
                if (!value || !value.trim()) return 'API key belum diisi.';
                return null;
            }
        });

        if (!promptResult.isConfirmed) return null;
        saveVisionKey(promptResult.value);
        return promptResult.value.trim();
    };

    const readSavedGeminiKey = () => {
        const key = (localStorage.getItem('mc_gemini_api_key') || '').trim();
        return key && key !== 'null' && key !== 'undefined' ? key : null;
    };

    const saveGeminiKey = (key) => {
        const cleanKey = (key || '').trim();
        if (!cleanKey) return;
        localStorage.setItem('mc_gemini_api_key', cleanKey);
        const input = document.getElementById('settingsGeminiKey');
        if (input) input.value = cleanKey;
    };

    const askGeminiKey = async () => {
        const promptResult = await Swal.fire({
            icon: 'info',
            title: 'Pakai Gemini untuk Auto-Fill',
            text: 'Google Vision perlu billing. Masukkan Google Gemini API Key agar Auto-Fill tetap bisa membaca identitas tanpa Cloud Vision.',
            input: 'password',
            inputLabel: 'Google Gemini API Key',
            inputPlaceholder: 'Tempel Gemini API key dari Google AI Studio',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true,
            confirmButtonText: 'Simpan & Lanjut',
            cancelButtonText: 'Batal',
            inputValidator: (value) => {
                if (!value || !value.trim()) return 'Gemini API key belum diisi.';
                return null;
            }
        });

        if (!promptResult.isConfirmed) return null;
        saveGeminiKey(promptResult.value);
        return promptResult.value.trim();
    };

    const showVisionBillingError = async (message) => {
        await Swal.fire({
            icon: 'info',
            title: 'Billing Google Cloud Belum Aktif',
            html: `
                <div style="text-align:left; line-height:1.45;">
                    <p style="margin:0 0 10px;">API key sudah terbaca, tetapi project Google Cloud untuk key ini belum mengaktifkan billing.</p>
                    <p style="margin:0 0 10px;">Aktifkan billing pada project Google Cloud yang sama dengan API key tersebut, pastikan Cloud Vision API aktif, lalu coba Auto-Fill lagi.</p>
                    <small style="color:#64748b;">Detail Google: ${message}</small>
                </div>
            `,
            confirmButtonText: 'Mengerti'
        });
    };

    if(!currentCustPhotoBase64) {
        return Swal.fire({
            icon: 'warning',
            title: 'Belum Ada Foto!',
            text: 'Harap unggah (Pilih File) foto identitas terlebih dahulu di kotak sebelah atas sebelum menggunakan fitur AI Auto-Fill.'
        });
    }

    const btn = document.getElementById('btnOcrKtp');
    const originalText = btn.innerHTML;
    
    let apiKey = readSavedVisionKey();

    try {
        // Ambil data Base64 murni tanpa prefix "data:image/jpeg;base64,"
        const base64Data = currentCustPhotoBase64.split(",")[1];

        const runGeminiOcrFallback = async () => {
            let geminiKey = readSavedGeminiKey();
            if (!geminiKey) {
                geminiKey = await askGeminiKey();
            }
            if (!geminiKey) return null;

            Swal.fire({
                title: 'Membaca Identitas dengan Gemini AI...',
                text: 'Google Vision dilewati karena billing belum aktif. Gemini sedang membaca teks identitas.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const geminiPrompt = [
                'Baca semua teks yang terlihat pada foto identitas ini.',
                'Kembalikan teks OCR mentah baris per baris saja.',
                'Jangan menjelaskan, jangan menambah komentar, jangan pakai markdown.',
                'Pertahankan label seperti NIK, Nama, Tempat/Tgl Lahir, Alamat, Jenis Kelamin, Pekerjaan bila terlihat.'
            ].join(' ');

            const geminiResponse = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'X-AI-Provider': 'gemini',
                    'X-Gemini-Key': geminiKey
                },
                body: JSON.stringify({
                    message: geminiPrompt,
                    image: currentCustPhotoBase64
                })
            });

            const geminiResult = await geminiResponse.json();
            console.log("========== GEMINI OCR FALLBACK ==========");
            console.log("HTTP STATUS :", geminiResponse.status);
            console.log("RESPONSE :", geminiResult);
            console.log("=========================================");

            if (!geminiResponse.ok || geminiResult.status !== 'success' || !geminiResult.reply) {
                alert("Fallback Gemini gagal: " + (geminiResult.message || 'Gemini tidak mengembalikan teks identitas.'));
                return null;
            }

            return geminiResult.reply
                .replace(/```(?:text|json)?/gi, '')
                .replace(/```/g, '')
                .trim();
        };

        const sendOcrRequest = (key) => fetch('/api/ocr/vision', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            },
            body: JSON.stringify({
                image_base64: base64Data,
                api_key: key || null
            })
        });

        let response = null;
        let result = null;
        let hasPromptedForKey = false;

        while (true) {
            Swal.fire({
                title: 'Menghubungi Cloud Vision AI...',
                text: 'Mohon tunggu sebentar, sistem sedang membaca data identitas Anda.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            response = await sendOcrRequest(apiKey);
            result = await response.json();

            console.log("========== OCR DEBUG ==========");
            console.log("HTTP STATUS :", response.status);
            console.log("RESPONSE :", result);
            console.log("===============================");

            if(response.ok && result.status === 'success') {
                break;
            }

            Swal.close();

            const message = result.message || 'Server gagal membaca identitas.';
            const googleCode = Number(result.google_code || response.status || 0);
            const errorType = result.error_type || '';
            const isBillingProblem = errorType === 'billing_not_enabled' || /billing|bill/i.test(message);
            const isKeyProblem = ['invalid_key', 'permission_denied'].includes(errorType)
                || [400, 401, 422].includes(googleCode)
                || /API key|GOOGLE_VISION_API_KEY|key/i.test(message);

            if (isBillingProblem) {
                const fallbackText = await runGeminiOcrFallback();
                if (fallbackText) {
                    result = {
                        status: 'success',
                        data: {
                            responses: [
                                {
                                    textAnnotations: [
                                        { description: fallbackText }
                                    ]
                                }
                            ]
                        },
                        key_source: 'gemini_fallback'
                    };
                    break;
                }
                await showVisionBillingError(message);
                return;
            }

            if (isKeyProblem && !hasPromptedForKey) {
                clearVisionKey();
                hasPromptedForKey = true;
                apiKey = await askVisionKey('Key server/browser kosong, salah, belum memiliki izin Vision API, terkena pembatasan, atau kuota habis.');
                if (apiKey) {
                    continue;
                }
            }

            alert("Error OCR: " + message);
            return;
        }

        const data = result.data;

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
        const fullRawDescription = annotations[0]?.description || '';
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

        if (reconstructedLines.length === 0 && fullRawDescription) {
            reconstructedLines = fullRawDescription
                .split(/\r?\n/)
                .map(line => line.replace(/\s+/g, ' ').trim())
                .filter(Boolean);
        }

        const fullTextUpper = reconstructedLines.join('\n').toUpperCase();
        const cleanText = fullTextUpper.replace(/\r/g, '');

        let identitasValue = "";
        let tipeIdentitasTerdeteksi = 'KTP';

        const normalizeOcrDate = (value) => {
            if (!value) return '';
            const cleaned = value.replace(/[^\d]/g, '');
            if (cleaned.length !== 8) return '';

            const day = cleaned.substring(0, 2);
            const month = cleaned.substring(2, 4);
            const year = cleaned.substring(4, 8);
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);

            if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
                return '';
            }

            return `${day}-${month}-${year}`;
        };
        const buildLabeledValue = (lines, upperLines, index, inlineValue, stopPatterns = []) => {
            const chunks = [];
            const normalizedInline = (inlineValue || '').replace(/^[\s:;=\-|]+/, '').trim();
            if (normalizedInline) chunks.push(normalizedInline);

            for (let i = index + 1; i < upperLines.length; i++) {
                const nextUpper = upperLines[i];
                const nextLine = (lines[i] || '').trim();
                if (!nextLine) continue;
                if (stopPatterns.some(pattern => pattern.test(nextUpper))) break;
                if (/^[0-9]+[.\-]/.test(nextLine) && chunks.length > 0) break;
                chunks.push(nextLine.replace(/^[\s:;=\-|]+/, '').trim());
                if (chunks.length >= 3) break;
            }

            return chunks.join(' ').replace(/\s+/g, ' ').trim();
        };
        const findBestDate = (value) => {
            if (!value) return '';
            const patterns = [
                /\b\d{2}[\s\-./]\d{2}[\s\-./]\d{4}\b/g,
                /\b\d{2}[\s\-./]\d{2}[\s\-./]\d{2}\b/g,
                /\b\d{2}\s+\d{2}\s+\d{4}\b/g
            ];
            for (const pattern of patterns) {
                const match = value.match(pattern);
                if (match && match[0]) {
                    const normalized = normalizeOcrDate(match[0].length === 8 ? match[0] : match[0]);
                    if (normalized) return normalized;
                    const rawDigits = match[0].replace(/[^\d]/g, '');
                    if (rawDigits.length === 6) {
                        const day = rawDigits.substring(0, 2);
                        const month = rawDigits.substring(2, 4);
                        const yearTwo = parseInt(rawDigits.substring(4, 6), 10);
                        const fullYear = yearTwo > 30 ? 1900 + yearTwo : 2000 + yearTwo;
                        return `${day}-${month}-${fullYear}`;
                    }
                }
            }
            return '';
        };
        const cleanNameValue = (value) => value
            .replace(/[^A-Z\s'.-]/gi, ' ')
            .replace(/\b(INDONESIA|DRIVING|LICENSE|SURAT|IZIN|MENGEMUDI|PASSPORT|PASPOR)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const cleanAddressValue = (value) => value
            .replace(/[:;=|]/g, ' ')
            .replace(/\b(ALAMAT|ADDRESS)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const extractAfterLabel = (lines, upperLines, labels, stopPatterns = [], maxLines = 3) => {
            for (let i = 0; i < upperLines.length; i++) {
                if (labels.some(pattern => pattern.test(upperLines[i]))) {
                    const inline = lines[i]
                        .replace(labels.find(pattern => pattern.test(upperLines[i])), '')
                        .replace(/^[\s:;=\-|]+/, '')
                        .trim();
                    return buildLabeledValue(lines, upperLines, i, inline, stopPatterns).trim();
                }
            }
            return '';
        };

        // IDENTIFIKASI TIPE DOKUMEN
        const fullRawText = fullRawDescription.toUpperCase();
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
            const passportLines = reconstructedLines
                .map(line => line.replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            const passportUpperLines = passportLines.map(line => line.toUpperCase());
            const findPassportLine = (patterns) => {
                for (let i = 0; i < passportUpperLines.length; i++) {
                    if (patterns.some(pattern => pattern.test(passportUpperLines[i]))) {
                        return { index: i, text: passportLines[i], upper: passportUpperLines[i] };
                    }
                }
                return null;
            };
            const sanitizePassportLabel = (value) => value
                .replace(/^(FULL\s*NAME|SURNAME|GIVEN\s*NAMES?|NAMES?|NAME|NAMA|PLACE\s*OF\s*BIRTH|BIRTH\s*PLACE|TEMPAT\s*LAHIR|DATE\s*OF\s*BIRTH|BIRTH\s*DATE|TANGGAL\s*LAHIR|TEMPAT\/TGL\s*LAHIR|PLACE\/DATE\s*OF\s*BIRTH|ADDRESS|ALAMAT)\s*[:;=\-]*/i, '')
                .replace(/^[\s:;=\-|]+/, '')
                .trim();
            let passNumMatch = fullTextUpper.match(/\b([A-Z]{1,2}\d{6,7})\b/);
            if (passNumMatch) identitasValue = passNumMatch[1];
            
            let mrzArea = fullTextUpper.replace(/\s+/g, '');
            let mrz1 = mrzArea.match(/P<([A-Z]{3})([A-Z<]+)/);
            if(mrz1) extractedNama = mrz1[2].replace(/<+$/, '').replace(/<+/g, ' ').trim();
            
            let mrz2 = mrzArea.match(/([A-Z0-9<]{8,9})([A-Z]{3})(\d{6})\d([MF<])/);
            if(mrz2) {
                if(!identitasValue) identitasValue = mrz2[1].replace(/</g, '');
                let dob = mrz2[3];
                let year = parseInt(dob.substring(0,2));
                year = year > 30 ? "19" + year : "20" + year;
                extractedTglLahir = `${dob.substring(4,6)}-${dob.substring(2,4)}-${year}`;
                if (mrz2[4] === 'M') extractedGender = 'Laki-Laki';
                else if (mrz2[4] === 'F') extractedGender = 'Wanita';
            }

            if(!extractedNama) {
                let nameMatch = fullTextUpper.match(/FULL NAME[\s\n:;=\|]*([A-Z\s]+)/);
                if(nameMatch) extractedNama = nameMatch[1].split('\n')[0].trim();
            }
            if(!extractedNama) {
                const nameLine = findPassportLine([
                    /\bFULL\s*NAME\b/i,
                    /\bGIVEN\s*NAMES?\b/i,
                    /\bSURNAME\b/i,
                    /^\s*NAMA\b/i,
                    /^\s*NAME\b/i
                ]);
                if (nameLine) {
                    const nameInline = sanitizePassportLabel(nameLine.text);
                    const nameValue = buildLabeledValue(
                        passportLines,
                        passportUpperLines,
                        nameLine.index,
                        nameInline,
                        [/\bPLACE\s*OF\s*BIRTH\b/i, /\bDATE\s*OF\s*BIRTH\b/i, /\bNATIONALITY\b/i, /\bSEX\b/i, /\bADDRESS\b/i]
                    );
                    if (nameValue && nameValue.length > 2) extractedNama = nameValue;
                }
            }
            if (!extractedNama) {
                const passportNameFallback = extractAfterLabel(
                    passportLines,
                    passportUpperLines,
                    [/\bNAME\b/i, /\bNAMA\b/i, /\bGIVEN\s*NAMES?\b/i, /\bSURNAME\b/i],
                    [/\bDATE\s*OF\s*BIRTH\b/i, /\bPLACE\s*OF\s*BIRTH\b/i, /\bNATIONALITY\b/i, /\bSEX\b/i]
                );
                if (passportNameFallback) extractedNama = cleanNameValue(passportNameFallback);
            }
            if(!extractedTptLahir) {
                let placeMatch = fullTextUpper.match(/PLACE OF BIRTH[\s\n:;=\|]*([A-Z\s]+)/);
                if(placeMatch) extractedTptLahir = placeMatch[1].split('\n')[0].replace(/[^A-Z\s]/g, '').trim();
            }
            if (!extractedTglLahir) {
                const dobLine = findPassportLine([
                    /\bDATE\s*OF\s*BIRTH\b/i,
                    /\bBIRTH\s*DATE\b/i,
                    /\bTANGGAL\s*LAHIR\b/i,
                    /\bTEMPAT\s*\/?\s*TGL\s*LAHIR\b/i
                ]);
                if (dobLine) {
                    const dobText = buildLabeledValue(
                        passportLines,
                        passportUpperLines,
                        dobLine.index,
                        sanitizePassportLabel(dobLine.text),
                        [/\bPLACE\s*OF\s*BIRTH\b/i, /\bADDRESS\b/i, /\bNATIONALITY\b/i, /\bSEX\b/i]
                    );
                    const dobMatch = dobText.match(/\b\d{2}[\s\-./]?\d{2}[\s\-./]?\d{4}\b/);
                    if (dobMatch) extractedTglLahir = normalizeOcrDate(dobMatch[0]) || extractedTglLahir;
                    if (!extractedTptLahir) {
                        const placeFromDob = dobText.replace(/\b\d{2}[\s\-./]?\d{2}[\s\-./]?\d{4}\b/, ' ').replace(/[,;:/-]+/g, ' ').replace(/\s+/g, ' ').trim();
                        if (placeFromDob) extractedTptLahir = placeFromDob;
                    }
                }
            }
            if (!extractedTglLahir) {
                const dobFallback = extractAfterLabel(
                    passportLines,
                    passportUpperLines,
                    [/\bDATE\s*OF\s*BIRTH\b/i, /\bBIRTH\s*DATE\b/i, /\bTANGGAL\s*LAHIR\b/i, /\bDOB\b/i],
                    [/\bPLACE\s*OF\s*BIRTH\b/i, /\bADDRESS\b/i, /\bNATIONALITY\b/i, /\bSEX\b/i]
                );
                const fallbackDate = findBestDate(dobFallback || fullTextUpper);
                if (fallbackDate) extractedTglLahir = fallbackDate;
            }
            if(!extractedTptLahir) {
                const placeLine = findPassportLine([
                    /\bPLACE\s*OF\s*BIRTH\b/i,
                    /\bBIRTH\s*PLACE\b/i,
                    /\bTEMPAT\s*LAHIR\b/i
                ]);
                if (placeLine) {
                    const placeValue = buildLabeledValue(
                        passportLines,
                        passportUpperLines,
                        placeLine.index,
                        sanitizePassportLabel(placeLine.text),
                        [/\bDATE\s*OF\s*BIRTH\b/i, /\bADDRESS\b/i, /\bNATIONALITY\b/i, /\bSEX\b/i]
                    );
                    if (placeValue) extractedTptLahir = placeValue.replace(/[^A-Z\s]/gi, ' ').replace(/\s+/g, ' ').trim();
                }
            }
            if (!extractedTptLahir) {
                const placeFallback = extractAfterLabel(
                    passportLines,
                    passportUpperLines,
                    [/\bPLACE\s*OF\s*BIRTH\b/i, /\bBIRTH\s*PLACE\b/i, /\bTEMPAT\s*LAHIR\b/i],
                    [/\bDATE\s*OF\s*BIRTH\b/i, /\bADDRESS\b/i, /\bNATIONALITY\b/i, /\bSEX\b/i]
                );
                if (placeFallback) extractedTptLahir = cleanNameValue(placeFallback);
            }
            if (alamatArr.length === 0) {
                const addressLine = findPassportLine([/\bADDRESS\b/i, /\bALAMAT\b/i]);
                if (addressLine) {
                    const addressValue = buildLabeledValue(
                        passportLines,
                        passportUpperLines,
                        addressLine.index,
                        sanitizePassportLabel(addressLine.text),
                        [/\bNATIONALITY\b/i, /\bSEX\b/i, /\bPLACE\s*OF\s*BIRTH\b/i, /\bDATE\s*OF\s*BIRTH\b/i]
                    );
                    if (addressValue) {
                        alamatArr = addressValue.split(/\s{2,}|,\s*/).map(part => part.trim()).filter(Boolean);
                    }
                }
            }
            if (alamatArr.length === 0) {
                const addressFallback = extractAfterLabel(
                    passportLines,
                    passportUpperLines,
                    [/\bADDRESS\b/i, /\bALAMAT\b/i],
                    [/\bNATIONALITY\b/i, /\bSEX\b/i, /\bPLACE\s*OF\s*BIRTH\b/i, /\bDATE\s*OF\s*BIRTH\b/i],
                    4
                );
                if (addressFallback) {
                    alamatArr = [cleanAddressValue(addressFallback)];
                }
            }
        }

        // ===================================
        // 2. PARSER KHUSUS SIM
        // ===================================
        else if (tipeIdentitasTerdeteksi === 'SIM') {
            const simLines = reconstructedLines
                .map(line => line.replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            const simUpperLines = simLines.map(line => line.toUpperCase());
            const simStopPatterns = [
                /\bNO\.?\s*SIM\b/i,
                /\bTEMPAT\s*\/?\s*TGL\s*LAHIR\b/i,
                /\bTEMPAT\s+LAHIR\b/i,
                /\bTGL\.?\s*LAHIR\b/i,
                /\bALAMAT\b/i,
                /\bPRIA\s*\/\s*WANITA\b/i,
                /\bPEKERJAAN\b/i,
                /\bGOL\.?\s*DARAH\b/i,
                /\bPROVINSI\b/i,
                /\bKECAMATAN\b/i,
                /\bBERLAKU\b/i
            ];
            const sanitizeSimLabel = (value) => value
                .replace(/^[0-9]+[.\-:\s]*/g, '')
                .replace(/^(NO\.?\s*SIM|NAMA|TEMPAT\/TGL LAHIR|TEMPAT TGL LAHIR|TEMPAT LAHIR|TGL LAHIR|ALAMAT|PEKERJAAN|PRIA\/WANITA|PRIA \/ WANITA)\s*[:;=\-]*/i, '')
                .trim();
            const isLikelySectionHeader = (line) => /^(GOL\.? DARAH|PEKERJAAN|PROVINSI|KOTA|KECAMATAN|BERLAKU|NO\.? SIM|TEMPAT\/TGL LAHIR|TEMPAT TGL LAHIR|ALAMAT|NAMA|PRIA\/WANITA)/i.test(line);
            const findLineByLabel = (patterns) => {
                for (let i = 0; i < simUpperLines.length; i++) {
                    if (patterns.some(pattern => pattern.test(simUpperLines[i]))) {
                        return { index: i, text: simLines[i], upper: simUpperLines[i] };
                    }
                }
                return null;
            };

            let simNomorMatch = cleanText.match(/\b\d{4}[-\s]*\d{4}[-\s]*\d{4,6}\b/);
            if (simNomorMatch) identitasValue = simNomorMatch[0].replace(/[\s-]/g, '');
            if (!identitasValue) {
                let any12Digits = cleanText.replace(/[\s-]/g, '').match(/\b\d{12,14}\b/);
                if(any12Digits) identitasValue = any12Digits[0];
            }

            const namaLine = findLineByLabel([
                /\b1[\.\-]?\s*NAMA\b/i,
                /\bNAMA\b/i
            ]);
            if (namaLine) {
                let namaCandidate = buildLabeledValue(simLines, simUpperLines, namaLine.index, sanitizeSimLabel(namaLine.text), simStopPatterns);
                if (namaCandidate.length > 2) extractedNama = namaCandidate;
            }
            if (!extractedNama) {
                const namaFallback = extractAfterLabel(
                    simLines,
                    simUpperLines,
                    [/\b1[\.\-]?\s*NAMA\b/i, /\bNAMA\b/i],
                    simStopPatterns
                );
                if (namaFallback) extractedNama = cleanNameValue(namaFallback);
            }
            if (!extractedNama) {
                const candidateLine = simLines.find((line, index) => {
                    const upper = simUpperLines[index];
                    if (isLikelySectionHeader(upper)) return false;
                    if (/\d{6,}/.test(line)) return false;
                    const lettersOnly = line.replace(/[^A-Z]/gi, '');
                    return lettersOnly.length >= 6 && lettersOnly.length <= 40;
                });
                if (candidateLine) extractedNama = cleanNameValue(candidateLine);
            }

            const lahirLine = findLineByLabel([
                /\b2[\.\-]?\s*(TEMPAT\s*\/?\s*TGL|TEMPAT|TGL)\s*LAHIR\b/i,
                /\bTEMPAT\s*\/?\s*TGL\.?\s*LAHIR\b/i,
                /\bTEMPAT\s+LAHIR\b/i,
                /\bTGL\.?\s*LAHIR\b/i
            ]);
            if (lahirLine) {
                let textB = buildLabeledValue(simLines, simUpperLines, lahirLine.index, sanitizeSimLabel(lahirLine.text), simStopPatterns);

                let dateM = textB.match(/\b\d{2}[\-\.\/]\d{2}[\-\.\/]\d{4}\b/);
                if (!dateM) {
                    dateM = textB.match(/\b\d{2}\s+\d{2}\s+\d{4}\b/);
                }
                if (dateM) {
                    extractedTglLahir = normalizeOcrDate(dateM[0]) || dateM[0].replace(/[\.\/\s]/g, '-').replace(/-+/g, '-');
                    let pStr = textB.replace(dateM[0], ' ').replace(/[,;:\/\-]+/g, ' ').replace(/\s+/g, ' ').trim();
                    if (pStr) extractedTptLahir = pStr;
                }
            }
            if (!extractedTglLahir) {
                const dateFallback = findBestDate(simLines.join(' '));
                if (dateFallback) extractedTglLahir = dateFallback;
            }
            if (!extractedTptLahir) {
                const ttlFallback = extractAfterLabel(
                    simLines,
                    simUpperLines,
                    [/\bTEMPAT\s*\/?\s*TGL\.?\s*LAHIR\b/i, /\bTEMPAT\s+LAHIR\b/i, /\bTGL\.?\s*LAHIR\b/i],
                    simStopPatterns
                );
                if (ttlFallback) {
                    const placeOnly = ttlFallback
                        .replace(/\b\d{2}[\s\-./]?\d{2}[\s\-./]?\d{2,4}\b/g, ' ')
                        .replace(/[,;:/-]+/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (placeOnly) extractedTptLahir = cleanNameValue(placeOnly);
                }
            }

            const genderLine = findLineByLabel([
                /\bPRIA\s*\/\s*WANITA\b/i,
                /\b3[\.\-]?\s*PRIA\s*\/\s*WANITA\b/i
            ]);
            if (genderLine) {
                let genderText = buildLabeledValue(simLines, simUpperLines, genderLine.index, sanitizeSimLabel(genderLine.text), simStopPatterns).toUpperCase();
                if (genderText.includes('PRIA') || genderText.includes('LAKI')) extractedGender = 'Laki-Laki';
                else if (genderText.includes('WANITA') || genderText.includes('PEREMPUAN')) extractedGender = 'Wanita';
            }

            const jobLine = findLineByLabel([
                /\b5[\.\-]?\s*PEKERJAAN\b/i,
                /\bPEKERJAAN\b/i
            ]);
            if (jobLine) {
                let jobText = buildLabeledValue(simLines, simUpperLines, jobLine.index, sanitizeSimLabel(jobLine.text), simStopPatterns);
                if (jobText) extractedPekerjaan = jobText;
            }

            const alamatLine = findLineByLabel([
                /\b4[\.\-]?\s*ALAMAT\b/i,
                /\bALAMAT\b/i
            ]);
            if (alamatLine) {
                let startIdx = alamatLine.index;
                let firstAlamat = sanitizeSimLabel(alamatLine.text);
                if (firstAlamat) alamatArr.push(firstAlamat);

                for (let i = startIdx + 1; i < simLines.length; i++) {
                    const nextLine = simLines[i].trim();
                    const nextUpper = simUpperLines[i];
                    if (!nextLine) continue;
                    if (/(^|\b)(5[\.\-]?\s*PEKERJAAN|PEKERJAAN|PRIA\s*\/\s*WANITA|GOL\.?\s*DARAH|BERLAKU|NO\.?\s*SIM|TEMPAT\s*\/?\s*TGL\s*LAHIR)(\b|$)/i.test(nextUpper)) {
                        break;
                    }
                    alamatArr.push(nextLine.replace(/[:;=\|]/g, '').trim());
                    if (alamatArr.length >= 3) break;
                }
            }
            if (alamatArr.length === 0) {
                const addressFallback = extractAfterLabel(
                    simLines,
                    simUpperLines,
                    [/\b4[\.\-]?\s*ALAMAT\b/i, /\bALAMAT\b/i],
                    simStopPatterns,
                    4
                );
                if (addressFallback) {
                    alamatArr = [cleanAddressValue(addressFallback)];
                }
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
        
        // 1. Set Combobox Tipe Identitas (KTP / SIM / PASSPORT)
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

        // 2. Sinkronkan placeholder/disabled state field identitas aktif
        if(typeof toggleCustPassportPlaceholder === 'function') {
            toggleCustPassportPlaceholder();
        }

        // 3. Isikan Nomor Identitas ke field yang benar
        if (identitasValue) {
            const nikInput = document.getElementById('modalCustNik');
            const otherIdInput = document.getElementById('modalCustIdNo');

            if (tipeIdentitasTerdeteksi === 'KTP') {
                if (nikInput) {
                    nikInput.disabled = false;
                    nikInput.value = identitasValue;
                }
                if (otherIdInput) {
                    otherIdInput.value = '';
                }
            } else {
                if (otherIdInput) {
                    otherIdInput.disabled = false;
                    otherIdInput.value = identitasValue;
                }
                if (nikInput) {
                    nikInput.value = '';
                }
            }
        }

        // 4. Isikan Nama
        if (extractedNama) document.getElementById('modalCustName').value = cleanNameValue(extractedNama);
        
        // 5. Isikan Tempat & Tgl
        if (extractedTptLahir) document.getElementById('modalCustBirthPlace').value = cleanNameValue(extractedTptLahir);
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
        
        // 6. Isikan Gender
        if (extractedGender) document.getElementById('modalCustGender').value = extractedGender;

        // 7. Pekerjaan (Dropdown Auto-Inject jika opsi tidak ada)
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

        // 8. Isikan Alamat
        if (alamatArr.length > 0) {
            // Karena diminta Kapital Semua di nama, alamat sebaiknya juga dikapital
            let finalAlamat = cleanAddressValue(alamatArr.join(' ')).toUpperCase();
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

// Export Bank Mutation functions globally
window.openMutationModal = openMutationModal;
window.closeMutationModal = closeMutationModal;
window.saveMutation = saveMutation;
window.loadMutationsTable = loadMutationsTable;
