// Currency, reports, customers, ID generation, WhatsApp, and customer edit flows

// ==============================
// CURRENCY MANAGEMENT
// ==============================

function escapeReportHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getReportTransactionTime(trx) {
    const raw = trx && (trx.timestamp || trx.date || trx.createdAt || trx.created_at);
    if (!raw) return 0;
    const normalized = String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T');
    const time = new Date(normalized).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function sortReportTransactions(transactions) {
    return [...transactions].sort((a, b) => {
        const timeDiff = getReportTransactionTime(b) - getReportTransactionTime(a);
        if (timeDiff !== 0) return timeDiff;
        return String(b?.itemId || b?.id || '').localeCompare(String(a?.itemId || a?.id || ''));
    }).slice();
}

function getCurrencyBaseCode(code) {
    return String(code || '').trim().toUpperCase().substring(0, 3);
}

function findParentCurrency(code, currencies = getCurrencies()) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const baseCode = getCurrencyBaseCode(normalizedCode);
    if (!baseCode || normalizedCode === baseCode) return null;
    return currencies.find(c => String(c.code || '').trim().toUpperCase() === baseCode) || null;
}

function getCurrencyBaseRate(currency, type) {
    if (!currency) return 0;
    const baseKey = type === 'sell' ? 'base_sell' : 'base_buy';
    const finalKey = type === 'sell' ? 'sell' : 'buy';
    const marginKey = type === 'sell' ? 'margin_sell' : 'margin_buy';
    const explicitBase = parseFloat(currency[baseKey]);
    if (Number.isFinite(explicitBase) && explicitBase > 0) return explicitBase;
    const finalRate = parseFloat(currency[finalKey]) || 0;
    const margin = parseFloat(currency[marginKey]) || 0;
    return finalRate > 0 ? finalRate - margin : 0;
}

function getInheritedBaseRates(code, currencies = getCurrencies()) {
    const parent = findParentCurrency(code, currencies);
    if (!parent) return { buy: 0, sell: 0 };
    return {
        buy: getCurrencyBaseRate(parent, 'buy'),
        sell: getCurrencyBaseRate(parent, 'sell')
    };
}

function repairDerivedCurrencyRates(currencies) {
    let changed = false;
    currencies.forEach(c => {
        const parentRates = getInheritedBaseRates(c.code, currencies);
        if (!parentRates.buy && !parentRates.sell) return;

        const marginBuy = parseFloat(c.margin_buy) || 0;
        const marginSell = parseFloat(c.margin_sell) || 0;
        const baseBuy = getCurrencyBaseRate(c, 'buy');
        const baseSell = getCurrencyBaseRate(c, 'sell');

        if (parentRates.buy > 0 && baseBuy <= 0) {
            c.base_buy = parentRates.buy;
            c.buy = parentRates.buy + marginBuy;
            changed = true;
        }
        if (parentRates.sell > 0 && baseSell <= 0) {
            c.base_sell = parentRates.sell;
            c.sell = parentRates.sell + marginSell;
            changed = true;
        }
    });
    return changed;
}

function loadCurrencyTable() {
    const currencies = getCurrencies();
    if (repairDerivedCurrencyRates(currencies)) {
        saveCurrencies(currencies);
    }
    if (typeof window.renderSmartdealSyncStatus === 'function') {
        window.renderSmartdealSyncStatus();
    }
    const masterCurrencies = getMasterCurrencies();
    const tbody = document.getElementById('currenciesTableBody');
    const currentUserRole = getCurrentUser() ? getCurrentUser().role : 'kasir';
    tbody.innerHTML = '';

    currencies.forEach(c => {
        const currencyCode = String(c.code || '').toUpperCase();
        const baseCurrencyCode = getCurrencyBaseCode(currencyCode);
        const mc = masterCurrencies.find(m => m.code === currencyCode) || masterCurrencies.find(m => m.code === baseCurrencyCode) || { flag: '', country: '', countryCode: '' };
        const countryCode = String(mc.countryCode || '').toLowerCase();
        const flagUrl = countryCode ? `https://flagcdn.com/w80/${countryCode}.png` : '';
        const tr = document.createElement('tr');
        const isAlert = (c.stock || 0) <= (c.alert || 0);
        const codeNote = currencyCode.length > 3 && mc.code === baseCurrencyCode ? `Turunan ${baseCurrencyCode}` : (mc.country || 'Unknown');
        
        const trendIcon = c.trend === 'up' 
            ? `<span style="color: #10B981; font-size: 1.2rem; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; width: 100%;">▲</span>` 
            : (c.trend === 'down' 
                ? `<span style="color: #ef4444; font-size: 1.2rem; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; width: 100%;">▼</span>` 
                : `<span style="color: #64748b; font-size: 1rem; opacity: 0.6; display: inline-flex; align-items: center; justify-content: center; width: 100%;">─</span>`);

        tr.innerHTML = `
            <td>
                <div class="currency-table-identity">
                    <span class="stock-flag currency-table-flag" title="${codeNote}">
                        ${flagUrl ? `<img src="${flagUrl}" alt="${currencyCode}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">` : ''}
                        <span class="stock-flag-fallback">${(mc.countryCode || currencyCode).slice(0, 2).toUpperCase()}</span>
                    </span>
                    <div>
                        <strong class="currency-table-code">${c.code || ''}</strong><br>
                        <small class="currency-table-country">${codeNote}</small>
                    </div>
                </div>
            </td>
            <td style="text-align: center; vertical-align: middle;">
                ${trendIcon}
            </td>
            <td><strong>${formatRate(c.buy)}</strong></td>
            <td><strong>${formatRate(c.sell)}</strong></td>
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
        document.getElementById('modalMarginBuy').value = '';
        document.getElementById('modalMarginSell').value = '';
        if(window.calculateCurrencyHasil) window.calculateCurrencyHasil();
    }
}

function handleCurrencyCodeInput() {
    const inputCode = document.getElementById('modalCurCode');
    const buyInput = document.getElementById('modalCurBuy');
    const sellInput = document.getElementById('modalCurSell');
    if (!inputCode || !buyInput || !sellInput) return;

    inputCode.value = String(inputCode.value || '');
    const parentRates = getInheritedBaseRates(inputCode.value);
    const currentBuy = parseFloat(buyInput.value) || 0;
    const currentSell = parseFloat(sellInput.value) || 0;

    if (parentRates.buy > 0 && currentBuy <= 0) buyInput.value = parentRates.buy;
    if (parentRates.sell > 0 && currentSell <= 0) sellInput.value = parentRates.sell;
    if (window.calculateCurrencyHasil) window.calculateCurrencyHasil();
}

window.handleCurrencyCodeInput = handleCurrencyCodeInput;

function closeCurrencyModal() {
    document.getElementById('currencyModal').classList.remove('show');
}

window.calculateCurrencyHasil = function() {
    const baseBuy = parseFloat(document.getElementById('modalCurBuy').value) || 0;
    const mb = parseFloat(document.getElementById('modalMarginBuy').value) || 0;
    const finalBuy = baseBuy + mb;
    const elBuy = document.getElementById('modalHasilBuy');
    if (elBuy) elBuy.innerText = finalBuy.toLocaleString('id-ID');
    
    const baseSell = parseFloat(document.getElementById('modalCurSell').value) || 0;
    const ms = parseFloat(document.getElementById('modalMarginSell').value) || 0;
    const finalSell = baseSell + ms;
    const elSell = document.getElementById('modalHasilSell');
    if (elSell) elSell.innerText = finalSell.toLocaleString('id-ID');
};

function saveCurrency() {
    const code = document.getElementById('modalCurCode').value.trim();
    let baseBuy = parseFloat(document.getElementById('modalCurBuy').value);
    let baseSell = parseFloat(document.getElementById('modalCurSell').value);
    const stock = parseFloat(document.getElementById('modalCurStock').value);
    const alertValue = parseFloat(document.getElementById('modalCurAlert').value);
    const mb = parseFloat(document.getElementById('modalMarginBuy').value) || 0;
    const ms = parseFloat(document.getElementById('modalMarginSell').value) || 0;
    const currencies = getCurrencies();
    const parentRates = getInheritedBaseRates(code, currencies);

    if ((!Number.isFinite(baseBuy) || baseBuy <= 0) && parentRates.buy > 0) {
        baseBuy = parentRates.buy;
    }
    if ((!Number.isFinite(baseSell) || baseSell <= 0) && parentRates.sell > 0) {
        baseSell = parentRates.sell;
    }

    if(!code || isNaN(baseBuy) || isNaN(baseSell)) {
        alert("Kode, Base Rate Beli, dan Jual harus diisi!");
        return;
    }
    
    const buy = baseBuy + mb;
    const sell = baseSell + ms;

    const index = currencies.findIndex(c => String(c.code || '').toLowerCase() === code.toLowerCase());
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

async function executeDeleteCurrency(code, currencies) {
    const normalizedCode = String(code || '');
    if (typeof window.deleteFromMySQL_Currency === 'function') {
        const result = await window.deleteFromMySQL_Currency(normalizedCode);
        if (!result.ok) {
            const message = result.message || 'server tidak merespons';
            alert(`Valuta ${normalizedCode} gagal dihapus dari database: ${message}`);
            if (result.status === 401) {
                window.location.reload();
            }
            return;
        }
    }

    const newCurrencies = currencies.filter(c => String(c.code || '') !== normalizedCode);
    saveCurrencies(newCurrencies);
    loadCurrencyTable();
    alert(`Valuta ${normalizedCode} berhasil dihapus.`);
}



// ==============================
// REPORTS
// ==============================
function buildCustomerLookup(customers) {
    const lookup = new Map();
    (customers || []).forEach(c => {
        [c.id_nasabah, c.no_cif, c.id_cif, c.local_id]
            .filter(Boolean)
            .forEach(key => lookup.set(String(key).toLowerCase(), c));
    });
    return lookup;
}

function findReportCustomer(transaction, customerLookup) {
    const keys = [
        transaction.customerId,
        transaction.id_cif,
        transaction.no_cif,
        transaction.customerCode,
    ];

    for (const key of keys) {
        if (!key || key === '-') continue;
        const customer = customerLookup.get(String(key).toLowerCase());
        if (customer) return customer;
    }

    return null;
}

function normalizeWhatsAppNumber(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
}

function getReportWaTemplateOptions() {
    const templates = typeof getWaTemplates === 'function' ? getWaTemplates() : [];
    const defaultTemplate = typeof getDefaultWaTemplate === 'function' ? getDefaultWaTemplate() : templates[0];
    return templates.map(template => {
        const selected = defaultTemplate && template.id === defaultTemplate.id ? 'selected' : '';
        return `<option value="${template.id}" ${selected}>${template.name}</option>`;
    }).join('');
}

function buildTransactionWaMessage(transaction, customer, template) {
    const profile = getProfile();
    const invoiceTrxs = getTransactions().filter(t => t.id === transaction.id);
    const detailRows = (invoiceTrxs.length ? invoiceTrxs : [transaction]).map(item => {
        const type = item.tipe || item.type || '-';
        const valuta = item.valuta || item.curCode || '-';
        const nominal = parseFloat(item.nominal || item.amount || 0).toLocaleString('id-ID');
        const rate = typeof formatRate === 'function' ? formatRate(item.rate || 0) : (item.rate || 0);
        const total = typeof formatIdr === 'function' ? formatIdr(item.total || item.totalIdr || item.totalIDR || 0) : (item.total || 0);
        return `- ${type} ${nominal} ${valuta} @ ${rate} = ${total}`;
    }).join('\n');

    const content = template && template.content
        ? template.content
        : `Halo [NAMA_NASABAH], berikut detail transaksi Anda.\n\nInvoice: [NO_INVOICE]\nTanggal: [TANGGAL]\n[VALUTA_LIST]\nTotal: [GRAND_TOTAL]`;

    return content
        .replace(/\[NAMA_MC\]/g, profile.name || 'MC-ALMARA')
        .replace(/\[NO_HP_MC\]/g, profile.phoneWA || profile.phone || '-')
        .replace(/\[NAMA_NASABAH\]/g, (customer && customer.nama) || transaction.customerName || 'Bapak/Ibu')
        .replace(/\[NO_INVOICE\]/g, transaction.id || '-')
        .replace(/\[TANGGAL\]/g, transaction.timestamp ? window.formatDateToDMY(transaction.timestamp) : '-')
        .replace(/\[VALUTA_LIST\]/g, detailRows)
        .replace(/\[GRAND_TOTAL\]/g, formatIdr(transaction.total || 0))
        .replace(/\[METODE_BAYAR\]/g, transaction.paymentMethod || '-')
        .replace(/\[METODE_RINCIAN\]/g, transaction.paymentDetail || '-');
}

function buildPurposeTransactionWaMessage(transaction, customer, purpose, selectedTemplate = null) {
    const fallback = buildTransactionWaMessage(transaction, customer, selectedTemplate || null);
    const rows = getTransactions().filter(item => item.id === transaction.id);
    const currencyList = (rows.length ? rows : [transaction]).map(item =>
        `- ${item.tipe || '-'} ${Number(item.nominal || 0).toLocaleString('id-ID')} ${item.valuta || '-'} @ ${formatRate(item.rate || 0)} = ${formatIdr(item.total || 0)}`
    ).join('\n');
    return window.buildWaMessageForPurpose(purpose, fallback, {
        customerName: customer?.nama || transaction.customerName || 'Nasabah',
        invoice: transaction.id || '-', date: transaction.timestamp ? window.formatDateToDMY(transaction.timestamp) : '-',
        currencyList, total: formatIdr(transaction.total || 0), paymentMethod: transaction.paymentMethod || '-'
    });
}

window.sendReportWhatsApp = async function(invoiceId, selectId) {
    const transactions = getTransactions();
    const transaction = transactions.find(t => t.id === invoiceId);
    if(!transaction) return alert('Transaksi tidak ditemukan.');

    const customerLookup = buildCustomerLookup(getCustomers());
    const customer = findReportCustomer(transaction, customerLookup);
    const waNum = normalizeWhatsAppNumber(customer ? customer.no_hp : '');
    if(!waNum) return alert('Nomor HP nasabah belum tersedia.');

    const templates = typeof getWaTemplates === 'function' ? getWaTemplates() : [];
    const selectedId = document.getElementById(selectId) ? document.getElementById(selectId).value : '';
    const template = templates.find(t => t.id === selectedId) || (typeof getDefaultWaTemplate === 'function' ? getDefaultWaTemplate() : templates[0]);
    try {
        await window.sendWhatsAppGateway(waNum, buildPurposeTransactionWaMessage(transaction, customer, 'riwayat', template), { reference: invoiceId });
        alert('Pesan transaksi berhasil dikirim melalui WA Gateway.');
    } catch (error) {
        alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
    }
};

function updateReportLedgerSummary(transactions) {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    let totalBuy = 0;
    let totalSell = 0;
    transactions.forEach(t => {
        const total = parseFloat(t.total || t.totalIdr || t.totalIDR || 0) || 0;
        const type = String(t.tipe || t.type || '').toUpperCase();
        if (type === 'BELI') totalBuy += total;
        if (type === 'JUAL') totalSell += total;
    });

    setText('reportLedgerTotalTrx', `${transactions.length.toLocaleString('id-ID')} Transaksi`);
    setText('reportLedgerTotalBuy', formatIdr(totalBuy));
    setText('reportLedgerTotalSell', formatIdr(totalSell));
    setText('reportLedgerNet', formatIdr(totalSell - totalBuy));
}

async function loadReportsTable() {
    const trxs = typeof getServerTransactionsLikeRwt === 'function'
        ? await getServerTransactionsLikeRwt()
        : getTransactions();
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
    const custMap = buildCustomerLookup(allCustomers);
    
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
            const cObj = findReportCustomer(t, custMap);
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
    const sortedTrxs = sortReportTransactions(filteredTrxs);
    updateReportLedgerSummary(sortedTrxs);
    
    tbody.innerHTML = sortedTrxs.map((t, index) => {
        let waBtn = '';
        const customer = findReportCustomer(t, custMap);
        const waNum = normalizeWhatsAppNumber(customer ? customer.no_hp : '');
        const waSelectId = `reportWaTemplate_${index}`;
        const waOptions = getReportWaTemplateOptions();
        if(waNum) {
            waBtn = `
                <select id="${waSelectId}" class="form-control form-control-sm report-wa-template" title="Pilih Template WA">
                    ${waOptions}
                </select>
                <button type="button" class="btn btn-sm" onclick='window.sendReportWhatsApp(${JSON.stringify(t.id)}, ${JSON.stringify(waSelectId)})' style="background:#25d366; color:white;" title="Kirim WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>`;
        } else {
            waBtn = `<button type="button" class="btn btn-sm" style="background:#94a3b8; color:white; cursor:not-allowed;" title="Nomor HP nasabah belum tersedia" disabled><i class="fa-brands fa-whatsapp"></i></button>`;
        }

        const limitInfoHtml = '';

        let customerPhotoUrl = '';
        if (t.raw_json) {
            try {
                const parsed = JSON.parse(t.raw_json);
                customerPhotoUrl = parsed.customerPhoto || '';
            } catch(e) {}
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
                <td>${t.id}${limitInfoHtml}</td>
                <td class="font-weight-bold ${t.tipe === 'BELI' ? 'text-green' : 'text-red'}">${t.tipe}</td>
                <td>
                    ${t.customerId || '-'}
                    ${customerPhotoUrl ? `<i class="fa-solid fa-camera text-info mx-1" style="cursor:pointer;" onclick="window.viewTrxCustomerPhoto('${customerPhotoUrl}')" title="Lihat Foto Wajah Nasabah"></i>` : ''}
                </td>
                <td>${window.getFlagHtml(t.valuta)}</td>
                <td>${t.nominal.toLocaleString()}</td>
                <td>${formatRate(t.rate)}</td>
                <td>${formatIdr(t.total)}</td>
                <td class="report-action-cell">
                    <div class="report-row-actions">
                        ${waBtn}
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.reprintReceipt('${t.id}')" title="Cetak Ulang Struk"><i class="fa-solid fa-print"></i></button>
                        ${customerPhotoUrl ? `<button type="button" class="btn btn-info btn-sm" style="background:#0ea5e9; color:white; border:none;" onclick="window.viewTrxCustomerPhoto('${customerPhotoUrl}')" title="Lihat Foto Wajah Nasabah"><i class="fa-solid fa-camera"></i></button>` : ''}
                        <button type="button" class="btn btn-primary btn-sm" onclick="window.editTransaction('${t.id}')" title="Edit Transaksi"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="window.voidTransaction('${t.id}')" title="Batalkan Transaksi"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="9" class="text-center">Tidak ada transaksi pada periode ini</td></tr>`;
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
    
    const formatRateNota = (angka) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(angka);
    
    let fullHtml = `<html><head><title>Cetak Masal</title><style>
        @page { size: 10cm 14cm; margin: 0; }
        html, body { margin: 0; padding: 0; min-height: 100%; }
        body { font-family: 'Courier New', Courier, monospace; width: 10cm; margin: 0; padding: 0.85cm 0.45cm 0.5cm; box-sizing: border-box; font-size: 12px; font-weight: normal; color: #000; }
        .center { text-align: center; }
        .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
        .divider-double { border-top: 1px dashed #000; border-bottom: 1px dashed #000; height: 2px; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
        small { font-size: 0.8em; color: #000; }
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
        let custPhone = cust.no_hp || '-';
        if(custPhone !== '-') custPhone = custPhone.length > 3 ? custPhone.slice(0, -3) + '***' : '***';
        const custCitizenship = cust.kewarganegaraan || '-';
        
        let recIdToUse = firstTrx.receiverId || firstTrx.customerId;
        const rec = recIdToUse === firstTrx.customerId ? cust : (customers.find(c => c.id_nasabah === recIdToUse) || {});
        const recName = recIdToUse === firstTrx.customerId ? custName : (rec.nama || 'Pengunjung Biasa');
        
        let grandTotal = 0;
        let itemsHtml = '';
        
        const beliTrxs = invoiceTrxs.filter(i => i.tipe === 'BELI');
        const jualTrxs = invoiceTrxs.filter(i => i.tipe === 'JUAL');
        const isMixed = beliTrxs.length > 0 && jualTrxs.length > 0;
        
        if (beliTrxs.length > 0) {
            if (isMixed) itemsHtml += '<div style="font-weight: bold; margin-bottom: 2px; font-size:13px;">BELI</div>';
            itemsHtml += `
                <div class="row" style="font-weight:bold; border-bottom:1px solid #000; margin-bottom:4px; font-size:13px;">
                    <span>Rincian Transaksi</span>
                    <span style="text-align:right;">Total (IDR)</span>
                </div>
            `;
            beliTrxs.forEach(item => {
                grandTotal -= parseFloat(item.total);
                itemsHtml += `
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; font-size: 13px; margin-bottom: 5px; line-height: 1.2;">
                    <span style="flex-shrink: 0; margin-right: 10px;">${item.valuta} ${parseFloat(item.nominal).toLocaleString('id-ID')} @ ${formatRateNota(item.rate)}</span>
                    <span style="flex-grow: 1; text-align: right; font-weight: bold;">${formatIdr(item.total)}</span>
                </div>
                `;
            });
        }
        
        if (isMixed) {
            itemsHtml += '<div class="divider" style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>';
        }
        
        if (jualTrxs.length > 0) {
            if (isMixed) itemsHtml += '<div style="font-weight: bold; margin-bottom: 2px; font-size:13px;">JUAL</div>';
            itemsHtml += `
                <div class="row" style="font-weight:bold; border-bottom:1px solid #000; margin-bottom:4px; font-size:13px;">
                    <span>Rincian Transaksi</span>
                    <span style="text-align:right;">Total (IDR)</span>
                </div>
            `;
            jualTrxs.forEach(item => {
                grandTotal += parseFloat(item.total);
                itemsHtml += `
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; font-size: 13px; margin-bottom: 5px; line-height: 1.2;">
                    <span style="flex-shrink: 0; margin-right: 10px;">${item.valuta} ${parseFloat(item.nominal).toLocaleString('id-ID')} @ ${formatRateNota(item.rate)}</span>
                    <span style="flex-grow: 1; text-align: right; font-weight: bold;">${formatIdr(item.total)}</span>
                </div>
                `;
            });
        }
        
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
        
        let labelInvoice = 'No. Invoice';
        if (beliTrxs.length > 0 && jualTrxs.length === 0) labelInvoice = 'Invoice Pembelian';
        else if (jualTrxs.length > 0 && beliTrxs.length === 0) labelInvoice = 'Invoice Penjualan';
        else if (isMixed) labelInvoice = 'Nota Transaksi';

        const dateStr = window.formatDateToDMY(firstTrx.timestamp);
        const phone = profile.phone || '';
        let contactLine = `<span>Telp/WA: ${phone || '-'}</span> | <span>Tgl: ${dateStr}</span>`;
        const addressToShow = profile.address || '';
        
        fullHtml += `
            <div style="margin-bottom: 2rem;">
            <h2 class="center" style="margin-top: 5px; margin-bottom: 0px; font-size: 15px;">${profile.name || 'MC-ALMARA'}</h2>
            ${addressToShow ? `<div class="center" style="font-size: 11px; margin-top: 2px; margin-bottom: 2px;">${addressToShow}</div>` : ''}
            ${profile.biLicense ? `<div class="center" style="font-size: 11px; margin-bottom: 2px;">No. Izin: ${profile.biLicense}</div>` : ''}
            <div class="center">
                <div style="font-size: 11px; margin-top: 2px; white-space: nowrap; text-align: center;">
                    ${contactLine}
                </div>
            </div>
            <div class="divider"></div>
            <div class="row"><span>${labelInvoice}:</span><span>${receiptId}</span></div>
            <div class="row"><span>No. CIF:</span><span>${cust.no_cif || '-'}</span></div>
            <div class="row"><span>Nama:</span><span>${custName}</span></div>
            <div class="row"><span>Telp:</span><span>${custPhone}</span></div>
            <div class="divider-double"></div>
            ${itemsHtml}
            <div class="divider"></div>
            <div class="row">
                <strong>GRAND TOTAL</strong>
                <strong>${formatIdr(Math.abs(grandTotal))}</strong>
            </div>
            <div class="row"><span>Metode:</span><span>${firstTrx.paymentMethod || 'CASH'}</span></div>
            ${firstTrx.paymentMethod === 'SPLIT' ? `
                <div class="row"><span>Via Tunai:</span><span>${formatIdr(Math.abs(payCash))}</span></div>
                <div class="row"><span>Via Transfer:</span><span>${formatIdr(Math.abs(payTransfer))}</span></div>
            ` : ''}
            <div class="divider"></div>
            <div class="row" style="margin-top:5px; font-size: 11px;">
                <div style="text-align:center; width:45%;">
                    Petugas / Kasir<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${firstTrx.kasir || 'Kasir'}</div>
                </div>
                <div style="text-align:center; width:45%;">
                    Penerima<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${recName}</div>
                </div>
            </div>
            <div class="center" style="margin-top:4px; font-size: 10.5px; font-style: italic; line-height: 1.2;">
                Hitung kembali uang Anda, Kami tidak menerima<br>komplin setelah meninggalkan counter
            </div>
            <div class="center" style="margin-top:10px; font-weight: bold !important;">${profile.footer || ''}</div>
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
    
    printInvoice(cart, summary);
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

    async function processVoid(id) {
        const { store: almaraStore, utils: almaraUtils, auth: almaraAuth } = window.AlmaraApp || {};
        let trxs = getTransactions();
        let trxGroup = trxs.filter(t => t.id === id);
        
        if (trxGroup.length === 0) {
            try {
                if (typeof getServerTransactionsLikeRwt === 'function') {
                    const serverTrxs = await getServerTransactionsLikeRwt();
                    trxGroup = serverTrxs.filter(t => t.id === id);
                }
            } catch (e) {
                console.error("Failed to load audit transactions fallback for void:", e);
            }
        }
        
        if(trxGroup.length === 0) {
            alert("Data transaksi tidak ditemukan!");
            return false;
        }
        
        let currencies = getCurrencies();
        let kasTunai = getCash();
        let bankBCA = getBankBCA();
        let bankMandiri = getBankMandiri();
        let mutations = getMutations();
        
        // Reverse stock logic
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
            let sign = t.tipe === 'JUAL' ? 1 : -1;
            grandTotal += (t.total * sign);
        });
        
        // Reverse cashier/bank balances logic
        const paymentMethod = trxGroup[0].paymentMethod || 'CASH';
        const bankTgt = trxGroup[0].bank || 'BCA';
        
        let oldPayCash = 0;
        let oldPayTransfer = 0;
        if (paymentMethod === 'CASH') {
            oldPayCash = grandTotal;
        } else if (paymentMethod === 'TRANSFER') {
            oldPayTransfer = grandTotal;
        } else if (paymentMethod === 'SPLIT') {
            const oldMut = mutations.find(m => m.keterangan && m.keterangan.includes(id));
            let oldTransferAmt = 0;
            if (oldMut) {
                oldTransferAmt = oldMut.nominal;
            } else {
                oldTransferAmt = Math.abs(grandTotal) / 2;
            }
            const oldSign = grandTotal < 0 ? -1 : 1;
            oldPayTransfer = oldTransferAmt * oldSign;
            oldPayCash = (Math.abs(grandTotal) - oldTransferAmt) * oldSign;
        }
        
        kasTunai -= oldPayCash;
        if (bankTgt === 'BCA') {
            bankBCA -= oldPayTransfer;
        } else {
            bankMandiri -= oldPayTransfer;
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
        const filteredMut = mutations.filter(m => !m.keterangan || (m.keterangan && !m.keterangan.includes(id)));
        saveMutations(filteredMut);
        
        // Delete from MySQL database
        if (typeof window.deleteFromMySQL_Transaction === 'function') {
            await window.deleteFromMySQL_Transaction(id);
        }
        
        alert(`Transaksi ${id} sukses dihapus dan dibatalkan!`);
        if (typeof loadReportsTable === 'function') loadReportsTable();
        if (typeof loadDashboard === 'function') loadDashboard();
    }
};

window.editTransaction = async function(id) {
    console.log("editTransaction clicked for ID:", id);
    
    try {
        const { store: almaraStore, utils: almaraUtils, auth: almaraAuth } = window.AlmaraApp || {};
        let trxs = getTransactions();
        let trxGroup = trxs.filter(t => t && t.id === id);
        
        if (trxGroup.length === 0) {
            try {
                if (typeof getServerTransactionsLikeRwt === 'function') {
                    const serverTrxs = await getServerTransactionsLikeRwt();
                    trxGroup = serverTrxs.filter(t => t && t.id === id);
                }
            } catch (e) {
                console.error("Failed to load audit transactions fallback for edit:", e);
            }
        }

        if(trxGroup.length === 0) {
            alert("Aksi Edit Gagal: Data riwayat transaksi tidak ditemukan di sistem!");
            return false;
        }

        // Set Invoice ID
        document.getElementById('editTrxInvoiceId').innerText = id;

        // Set Timestamp
        let ts = String(trxGroup[0].timestamp || '');
        if (ts) {
            ts = ts.replace(' ', 'T');
            if (ts.length > 16) {
                ts = ts.substring(0, 16);
            }
            document.getElementById('editTrxTimestamp').value = ts;
        }

        // Set Customer Options and Selection
        const custSelect = document.getElementById('editTrxCustomer');
        const customers = almaraStore.getCustomers();
        const customerOptions = customers.map(c => {
            const internalId = String(c.id_nasabah || '').replace(/"/g, '&quot;');
            const name = String(c.nama || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const phone = String(c.no_hp || '-').replace(/"/g, '&quot;');
            const nationality = String(c.warga_negara || 'Lokal').replace(/"/g, '&quot;');
            let idn = c.no_ktp && c.no_ktp !== '-' ? `KTP: ${c.no_ktp}` : (c.selain_ktp && c.selain_ktp !== '-' ? c.selain_ktp : '');
            idn = String(idn).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<option value="${internalId}">${internalId} - ${name}${idn ? ` - ${idn}` : ''} - HP: ${phone} - ${nationality}</option>`;
        }).join('');
        custSelect.innerHTML = '<option value="">-- Pilih Nasabah Wajib --</option>' + customerOptions;
        
        const custId = trxGroup[0].customerId || trxGroup[0].id_cif || '';
        custSelect.value = custId;
        
        if (window.jQuery && typeof $.fn.select2 === 'function') {
            if (!$(custSelect).hasClass("select2-hidden-accessible")) {
                $(custSelect).select2({
                    dropdownParent: $('#editTransactionModal'),
                    placeholder: "Pilih Nasabah"
                });
            }
            $(custSelect).val(custId).trigger('change');
        }

        // Set Payment Method and Bank options
        const pm = trxGroup[0].paymentMethod || 'CASH';
        document.getElementById('editTrxPaymentMethod').value = pm;
        
        const bankTgt = trxGroup[0].bank || 'BCA';
        document.getElementById('editTrxBank').value = bankTgt;

        // Handle Split inputs if PM is SPLIT
        let cashAmt = 0;
        let transferAmt = 0;
        if (pm === 'SPLIT') {
            let groupTotal = 0;
            trxGroup.forEach(t => {
                const sign = t.tipe === 'JUAL' ? 1 : -1;
                groupTotal += (t.total * sign);
            });
            const mutations = almaraStore.getMutations();
            const mut = mutations.find(m => m.keterangan && m.keterangan.includes(id));
            if (mut) {
                transferAmt = mut.nominal;
                cashAmt = Math.abs(groupTotal) - transferAmt;
            } else {
                transferAmt = Math.abs(groupTotal) / 2;
                cashAmt = Math.abs(groupTotal) - transferAmt;
            }
        }
        document.getElementById('editTrxCashAmount').value = cashAmt;
        document.getElementById('editTrxTransferAmount').value = transferAmt;
        const purposeEl = document.getElementById('editTrxTransactionPurpose');
        if (purposeEl) purposeEl.value = trxGroup[0].transactionPurpose || 'PERJALANAN_WISATA';
        const sourceFundsEl = document.getElementById('editTrxSourceOfFunds');
        if (sourceFundsEl) sourceFundsEl.value = trxGroup[0].sourceOfFunds || 'GAJI';

        // Set Kasir and Keterangan
        document.getElementById('editTrxKasir').value = trxGroup[0].kasir || trxGroup[0].inputBy || '';
        document.getElementById('editTrxKeterangan').value = trxGroup[0].keterangan || '';

        // Load Items in modal table
        const tbody = document.getElementById('editTrxItemsBody');
        tbody.innerHTML = '';
        
        trxGroup.forEach(t => {
            window.addEditTrxRow({
                tipe: t.tipe,
                valuta: t.valuta,
                nominal: t.nominal,
                rate: t.rate,
                total: t.total,
                itemId: t.itemId
            });
        });

        window.toggleEditTrxPaymentMethodFields();
        const modal = document.getElementById('editTransactionModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
        
    } catch (err) {
        console.error("Error in editTransaction:", err);
        alert("Terjadi kesalahan saat membuka form edit: " + err.message + "\n\nDetail: " + err.stack);
    }
};

window.closeEditTrxModal = function() {
    const modal = document.getElementById('editTransactionModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
};

window.toggleEditTrxPaymentMethodFields = function() {
    const paymentMethod = document.getElementById('editTrxPaymentMethod').value;
    const bankGroup = document.getElementById('editTrxBankGroup');
    const splitGroup = document.getElementById('editTrxSplitGroup');

    if (paymentMethod === 'TRANSFER') {
        if (bankGroup) bankGroup.style.display = 'block';
        if (splitGroup) splitGroup.style.display = 'none';
    } else if (paymentMethod === 'SPLIT') {
        if (bankGroup) bankGroup.style.display = 'block';
        if (splitGroup) splitGroup.style.display = 'flex';
        
        // Auto calculate split transfer balance if cash amount changes
        const cashInput = document.getElementById('editTrxCashAmount');
        if (cashInput && !cashInput.hasAttribute('data-listener-added')) {
            cashInput.setAttribute('data-listener-added', 'true');
            cashInput.addEventListener('input', function() {
                const tbody = document.getElementById('editTrxItemsBody');
                const rows = tbody.querySelectorAll('tr');
                let grandTotal = 0;
                rows.forEach(row => {
                    const tipe = row.querySelector('.edit-row-tipe').value;
                    const total = parseFloat(row.querySelector('.edit-row-total').value) || 0;
                    const sign = tipe === 'JUAL' ? 1 : -1;
                    grandTotal += (total * sign);
                });
                const totalAbs = Math.abs(grandTotal);
                let cashVal = parseFloat(this.value) || 0;
                if (cashVal > totalAbs) {
                    this.value = totalAbs;
                    cashVal = totalAbs;
                }
                const transferEl = document.getElementById('editTrxTransferAmount');
                if (transferEl) {
                    transferEl.value = (totalAbs - cashVal).toFixed(2);
                }
            });
        }
    } else {
        if (bankGroup) bankGroup.style.display = 'none';
        if (splitGroup) splitGroup.style.display = 'none';
    }
};

window.addEditTrxRow = function(itemData = null) {
    const { store: almaraStore, utils: almaraUtils, auth: almaraAuth } = window.AlmaraApp || {};
    const tbody = document.getElementById('editTrxItemsBody');
    if (!tbody) return;

    const rowId = 'edit-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const tr = document.createElement('tr');
    tr.id = rowId;

    const tipeVal = itemData ? itemData.tipe : 'JUAL';
    const valutaVal = itemData ? itemData.valuta : 'USD';
    const nominalVal = itemData ? itemData.nominal : 0;
    const rateVal = itemData ? itemData.rate : 0;
    const totalVal = itemData ? itemData.total : 0;
    const itemIdVal = itemData ? itemData.itemId : '';

    const currencies = almaraStore.getCurrencies();
    const curOptions = currencies.map(c => `<option value="${c.code}" ${c.code === valutaVal ? 'selected' : ''}>${c.code}</option>`).join('');

    tr.innerHTML = `
        <td>
            <select class="form-control edit-row-tipe" style="background-image:none; padding:4px 8px;" onchange="window.calculateEditTrxGrandTotal()">
                <option value="JUAL" ${tipeVal === 'JUAL' ? 'selected' : ''}>JUAL</option>
                <option value="BELI" ${tipeVal === 'BELI' ? 'selected' : ''}>BELI</option>
            </select>
            <input type="hidden" class="edit-row-item-id" value="${itemIdVal}">
        </td>
        <td>
            <select class="form-control edit-row-valuta" style="background-image:none; padding:4px 8px;" onchange="window.calculateEditTrxGrandTotal()">
                ${curOptions}
            </select>
        </td>
        <td>
            <input type="number" step="any" class="form-control edit-row-nominal" value="${nominalVal}" style="padding:4px 8px;" oninput="window.updateEditTrxRowTotal(this)">
        </td>
        <td>
            <input type="number" step="any" class="form-control edit-row-rate" value="${rateVal}" style="padding:4px 8px;" oninput="window.updateEditTrxRowTotal(this)">
        </td>
        <td>
            <input type="number" step="any" class="form-control edit-row-total" value="${totalVal}" readonly style="text-align: right; background: rgba(0,0,0,0.15); padding:4px 8px;">
        </td>
        <td style="text-align: center; vertical-align: middle;">
            <button type="button" class="btn btn-sm btn-danger" onclick="window.removeEditTrxRow(this)" style="padding: 4px 8px;"><i class="fa-solid fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
    window.calculateEditTrxGrandTotal();
};

window.updateEditTrxRowTotal = function(element) {
    const row = element.closest('tr');
    if (!row) return;
    const nominal = parseFloat(row.querySelector('.edit-row-nominal').value) || 0;
    const rate = parseFloat(row.querySelector('.edit-row-rate').value) || 0;
    const totalInput = row.querySelector('.edit-row-total');
    if (totalInput) {
        totalInput.value = (nominal * rate).toFixed(2);
    }
    window.calculateEditTrxGrandTotal();
};

window.removeEditTrxRow = function(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
    }
    window.calculateEditTrxGrandTotal();
};

window.calculateEditTrxGrandTotal = function() {
    const tbody = document.getElementById('editTrxItemsBody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    let grandTotal = 0;
    rows.forEach(row => {
        const tipe = row.querySelector('.edit-row-tipe').value;
        const total = parseFloat(row.querySelector('.edit-row-total').value) || 0;
        const sign = tipe === 'JUAL' ? 1 : -1;
        grandTotal += (total * sign);
    });

    const totalEl = document.getElementById('editTrxGrandTotalDisplay');
    if (totalEl) {
        const fmtVal = typeof formatIdr === 'function' ? formatIdr(Math.abs(grandTotal)) : 'Rp ' + Number(Math.abs(grandTotal)).toLocaleString('id-ID');
        totalEl.textContent = fmtVal;
        if (grandTotal < 0) {
            totalEl.style.color = '#f87171';
        } else {
            totalEl.style.color = '#10b981';
        }
    }
    
    // Update split fields helper if payment method is split
    const pm = document.getElementById('editTrxPaymentMethod').value;
    if (pm === 'SPLIT') {
        const cashInput = document.getElementById('editTrxCashAmount');
        const transferEl = document.getElementById('editTrxTransferAmount');
        if (cashInput && transferEl) {
            const totalAbs = Math.abs(grandTotal);
            let cashVal = parseFloat(cashInput.value) || 0;
            if (cashVal > totalAbs) {
                cashInput.value = totalAbs;
                cashVal = totalAbs;
            }
            transferEl.value = (totalAbs - cashVal).toFixed(2);
        }
    }
};

window.saveEditedTransaction = async function() {
    const { store: almaraStore, utils: almaraUtils, auth: almaraAuth } = window.AlmaraApp || {};
    const tbody = document.getElementById('editTrxItemsBody');
    const rows = tbody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("Gagal: Transaksi harus memiliki minimal 1 item!");
        return;
    }

    let newGrandTotal = 0;
    const editedItems = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const tipe = row.querySelector('.edit-row-tipe').value;
        const valuta = row.querySelector('.edit-row-valuta').value;
        const nominal = parseFloat(row.querySelector('.edit-row-nominal').value) || 0;
        const rate = parseFloat(row.querySelector('.edit-row-rate').value) || 0;
        const total = nominal * rate;
        const itemId = row.querySelector('.edit-row-item-id').value;

        if (nominal <= 0 || rate <= 0) {
            alert("Nominal dan Rate item ke-" + (i + 1) + " harus lebih besar dari 0!");
            return;
        }

        editedItems.push({
            tipe,
            valuta,
            nominal,
            rate,
            total,
            itemId
        });

        const sign = tipe === 'JUAL' ? 1 : -1;
        newGrandTotal += (total * sign);
    }

    const paymentMethod = document.getElementById('editTrxPaymentMethod').value;
    const bankTgt = document.getElementById('editTrxBank').value;
    let payCash = 0;
    let payTransfer = 0;

    const requiredPayment = newGrandTotal;
    const absReq = Math.abs(requiredPayment);

    if (paymentMethod === 'CASH') {
        payCash = requiredPayment;
    } else if (paymentMethod === 'TRANSFER') {
        payTransfer = requiredPayment;
    } else if (paymentMethod === 'SPLIT') {
        const splitCashVal = parseFloat(document.getElementById('editTrxCashAmount').value) || 0;
        const splitTransferVal = parseFloat(document.getElementById('editTrxTransferAmount').value) || 0;

        if (Math.abs((splitCashVal + splitTransferVal) - absReq) > 1) {
            alert("Total Tunai dan Transfer harus sama dengan Jumlah Bayar (Grand Total): Rp " + Number(absReq).toLocaleString('id-ID'));
            return;
        }

        const sign = requiredPayment < 0 ? -1 : 1;
        payCash = splitCashVal * sign;
        payTransfer = splitTransferVal * sign;
    }

    let cash = almaraStore.getCash();
    let bankBCA = almaraStore.getBankBCA();
    let bankMandiri = almaraStore.getBankMandiri();
    const currencies = almaraStore.getCurrencies();
    let trxs = almaraStore.getTransactions();
    let mutations = almaraStore.getMutations();

    const receiptId = document.getElementById('editTrxInvoiceId').innerText;
    const oldTrxGroup = trxs.filter(t => t.id === receiptId);
    if (oldTrxGroup.length === 0) {
        alert("Error: Transaksi lama tidak ditemukan!");
        return;
    }

    // Reverse old transactions stock & balances
    let oldGrandTotal = 0;
    oldTrxGroup.forEach(t => {
        const curIdx = currencies.findIndex(c => c.code === t.valuta);
        if (curIdx > -1) {
            if (t.tipe === 'JUAL') {
                currencies[curIdx].stock += t.nominal;
            } else {
                currencies[curIdx].stock -= t.nominal;
            }
        }
        const sign = t.tipe === 'JUAL' ? 1 : -1;
        oldGrandTotal += (t.total * sign);
    });

    const oldPayMethod = oldTrxGroup[0].paymentMethod || 'CASH';
    const oldBankTgt = oldTrxGroup[0].bank || 'BCA';

    let oldPayCash = 0;
    let oldPayTransfer = 0;
    if (oldPayMethod === 'CASH') {
        oldPayCash = oldGrandTotal;
    } else if (oldPayMethod === 'TRANSFER') {
        oldPayTransfer = oldGrandTotal;
    } else if (oldPayMethod === 'SPLIT') {
        const oldMut = mutations.find(m => m.keterangan && m.keterangan.includes(receiptId));
        let oldTransferAmt = 0;
        if (oldMut) {
            oldTransferAmt = oldMut.nominal;
        } else {
            oldTransferAmt = Math.abs(oldGrandTotal) / 2;
        }
        const oldSign = oldGrandTotal < 0 ? -1 : 1;
        oldPayTransfer = oldTransferAmt * oldSign;
        oldPayCash = (Math.abs(oldGrandTotal) - oldTransferAmt) * oldSign;
    }

    // Deduct old balances from registers
    cash -= oldPayCash;
    if (oldBankTgt === 'BCA') {
        bankBCA -= oldPayTransfer;
    } else {
        bankMandiri -= oldPayTransfer;
    }

    // Apply new currency stock changes
    for (let item of editedItems) {
        const curIdx = currencies.findIndex(c => c.code === item.valuta);
        if (curIdx > -1) {
            if (item.tipe === 'JUAL') {
                currencies[curIdx].stock -= item.nominal;
            } else {
                currencies[curIdx].stock += item.nominal;
            }
        }
    }

    // Verify cashier cash / bank availability
    const displayFmtIdr = (val) => typeof formatIdr === 'function' ? formatIdr(val) : 'Rp ' + Number(val).toLocaleString('id-ID');
    if (payCash < 0 && cash + payCash < 0) {
        const deficit = Math.abs(cash + payCash);
        const confirmMsg = `Kas Tunai tidak mencukupi untuk perubahan ini! Sisa Kas: ${displayFmtIdr(cash)}, Kurang: ${displayFmtIdr(deficit)}. Tetap lanjutkan?`;
        let proceed = false;
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Konfirmasi Kas Tunai',
                text: confirmMsg,
                showCancelButton: true,
                confirmButtonText: 'Lanjut',
                cancelButtonText: 'Batal',
                background: '#1e293b',
                color: '#f8fafc',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            });
            proceed = result.isConfirmed;
        } else {
            proceed = confirm(confirmMsg);
        }
        if (!proceed) {
            return;
        }
    }
    let currentBankVal = bankTgt === 'BCA' ? bankBCA : bankMandiri;
    if (payTransfer < 0 && currentBankVal + payTransfer < 0) {
        const deficit = Math.abs(currentBankVal + payTransfer);
        const confirmMsg = `Saldo Bank ${bankTgt} tidak mencukupi untuk perubahan ini! Saldo Bank: ${displayFmtIdr(currentBankVal)}, Kurang: ${displayFmtIdr(deficit)}. Tetap lanjutkan?`;
        let proceed = false;
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Konfirmasi Saldo Bank',
                text: confirmMsg,
                showCancelButton: true,
                confirmButtonText: 'Lanjut',
                cancelButtonText: 'Batal',
                background: '#1e293b',
                color: '#f8fafc',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33'
            });
            proceed = result.isConfirmed;
        } else {
            proceed = confirm(confirmMsg);
        }
        if (!proceed) {
            return;
        }
    }

    // Apply new balances
    cash += payCash;
    if (bankTgt === 'BCA') {
        bankBCA += payTransfer;
    } else {
        bankMandiri += payTransfer;
    }

    // Update bank mutations
    mutations = mutations.filter(m => !m.keterangan || (m.keterangan && !m.keterangan.includes(receiptId)));
    
    let rawTimestamp = document.getElementById('editTrxTimestamp').value;
    const finalTimestamp = rawTimestamp ? rawTimestamp.replace('T', ' ') + ':00' : new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (Math.abs(payTransfer) > 0) {
        mutations.push({
            id_mutasi: 'MUT-' + Date.now().toString().slice(-6),
            timestamp: finalTimestamp,
            tipe: payTransfer > 0 ? 'MASUK' : 'KELUAR',
            nominal: Math.abs(payTransfer),
            keterangan: `Transaksi Valas (Ref: ${receiptId})`,
            bank: bankTgt
        });
    }

    // Save state
    almaraStore.saveCurrencies(currencies);
    almaraStore.saveCash(cash);
    almaraStore.saveBankBCA(bankBCA);
    almaraStore.saveBankMandiri(bankMandiri);
    almaraStore.saveMutations(mutations);

    // Rebuild transaction array
    trxs = trxs.filter(t => t.id !== receiptId);

    const customers = almaraStore.getCustomers() || [];
    const customerId = document.getElementById('editTrxCustomer').value;
    const customerObj = customers.find(c => c.id_nasabah === customerId) || {};
    const customerName = customerObj.nama || '';
    const currentUser = getCurrentUser();
    const editByUser = currentUser && currentUser.fullName ? currentUser.fullName : 'Admin Kasir';
    const inputByUser = oldTrxGroup[0].inputBy || oldTrxGroup[0].kasir || 'Admin Kasir';
    const keterangan = document.getElementById('editTrxKeterangan').value;
    const kasir = document.getElementById('editTrxKasir').value || editByUser;
    const transactionPurpose = document.getElementById('editTrxTransactionPurpose')?.value || oldTrxGroup[0].transactionPurpose || 'PERJALANAN_WISATA';
    const sourceOfFunds = document.getElementById('editTrxSourceOfFunds')?.value || oldTrxGroup[0].sourceOfFunds || 'GAJI';

    const newTransactionRows = editedItems.map((item, index) => {
        let itemId = item.itemId;
        if (!itemId || !itemId.startsWith(receiptId)) {
            itemId = `${receiptId}-${String(item.valuta).replace(/\s+/g, '')}-${String(index + 1).padStart(2, '0')}`;
        }

        return {
            id: receiptId,
            itemId: itemId,
            timestamp: finalTimestamp,
            tipe: item.tipe,
            valuta: item.valuta,
            nominal: item.nominal,
            rate: item.rate,
            total: item.total,
            kasir: kasir,
            inputBy: inputByUser,
            editBy: editByUser,
            customerId: customerId !== '' ? customerId : null,
            id_cif: customerId !== '' ? customerId : null,
            customerName: customerName,
            paymentMethod: paymentMethod,
            bank: (paymentMethod === 'TRANSFER' || paymentMethod === 'SPLIT') ? bankTgt : null,
            transactionPurpose,
            sourceOfFunds,
            transferProof: oldTrxGroup[0].transferProof || null,
            isOldMoney: oldTrxGroup[0].isOldMoney || false,
            keterangan: keterangan,
            tipe_transaksi: oldTrxGroup[0].tipe_transaksi || 'CASH',
            status: oldTrxGroup[0].status || 'LUNAS',
            bookingId: oldTrxGroup[0].bookingId || null,
            invoiceId: oldTrxGroup[0].invoiceId || receiptId,
            dpAmount: oldTrxGroup[0].dpAmount || 0,
            remainingAmount: oldTrxGroup[0].remainingAmount || 0,
            limitExceeded: oldTrxGroup[0].limitExceeded !== undefined ? oldTrxGroup[0].limitExceeded : false,
            limitUsd: oldTrxGroup[0].limitUsd || null,
            limitIdr: oldTrxGroup[0].limitIdr || null,
            limitUsedIdr: oldTrxGroup[0].limitUsedIdr || null,
            limitPendingIdr: oldTrxGroup[0].limitPendingIdr || null,
            limitUnderlying: oldTrxGroup[0].limitUnderlying || null,
            limitRequestedBy: oldTrxGroup[0].limitRequestedBy || null,
            limitApprovedBy: oldTrxGroup[0].limitApprovedBy || null,
            limitApprovedByRole: oldTrxGroup[0].limitApprovedByRole || null,
            limitApprovedAt: oldTrxGroup[0].limitApprovedAt || null
        };
    });

    newTransactionRows.forEach(row => trxs.push(row));
    almaraStore.saveTransactions(trxs);

    window.closeEditTrxModal();

    window.__almaraSuppressAutoTransactionPush = true;
    window.__almaraPendingTransactionIds = newTransactionRows.map(t => String(t.itemId || t.id));

    try {
        if (typeof window.pushTransactionsToMySQL === 'function') {
            const syncResults = await window.pushTransactionsToMySQL(newTransactionRows);
            console.log("Edit Sync Results:", syncResults);
        }
        if (typeof window.syncFromMySQL_Transactions === 'function') {
            await window.syncFromMySQL_Transactions({ pushLocal: false, refreshUi: true, silent: true, force: true });
        }
    } catch (e) {
        console.error("Gagal sinkronisasi ke MySQL setelah edit:", e);
    } finally {
        window.__almaraSuppressAutoTransactionPush = false;
        window.__almaraPendingTransactionIds = [];
    }

    alert("Transaksi " + receiptId + " berhasil diperbarui!");
    if (typeof loadReportsTable === 'function') loadReportsTable();
    if (typeof loadDashboard === 'function') loadDashboard();
};
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
function parseCustomerRegistrationDate(raw) {
    if (raw instanceof Date) {
        const time = raw.getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    const text = String(raw || '').trim();
    if (!text || text === '-') return 0;

    if (/^\d+$/.test(text)) {
        const numericValue = Number(text);
        if (numericValue > 100000000000) return numericValue;
        if (numericValue > 20000 && numericValue < 80000) {
            return Math.round((numericValue - 25569) * 86400 * 1000);
        }
    }

    const isoLike = text.includes('T') ? text : text.replace(' ', 'T');
    const directTime = new Date(isoLike).getTime();
    if (!Number.isNaN(directTime)) return directTime;

    const localDate = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (localDate) {
        const year = localDate[3].length === 2 ? Number(`20${localDate[3]}`) : Number(localDate[3]);
        const time = new Date(
            year,
            Number(localDate[2]) - 1,
            Number(localDate[1]),
            Number(localDate[4] || 12),
            Number(localDate[5] || 0),
            Number(localDate[6] || 0)
        ).getTime();
        return Number.isNaN(time) ? 0 : time;
    }

    return 0;
}

function getCustomerRegistrationTime(customer) {
    const candidates = [
        customer?.tgl_daftar,
        customer?.tanggal_daftar,
        customer?.tanggal_input,
        customer?.created_at,
        customer?.createdAt,
        customer?.timestamp,
        customer?.updated_at
    ];

    for (const candidate of candidates) {
        const time = parseCustomerRegistrationDate(candidate);
        if (time > 0) return time;
    }

    const numericId = String(customer?.id_nasabah || customer?.local_id || customer?.no_cif || '').match(/\d{8,}/);
    return numericId ? Number(numericId[0]) || 0 : 0;
}

const CUSTOMER_TABLE_FILTER_KEY = 'mc_customer_table_filters';

function getCustomerTableFilterElements() {
    return {
        searchInput: document.getElementById('searchCustomerInput'),
        typeInput: document.getElementById('filterCustomerType'),
        startDateInput: document.getElementById('filterCustomerDateStart'),
        endDateInput: document.getElementById('filterCustomerDateEnd')
    };
}

function getCustomerTableFilters() {
    const { searchInput, typeInput, startDateInput, endDateInput } = getCustomerTableFilterElements();
    return {
        search: searchInput ? searchInput.value : '',
        type: typeInput ? typeInput.value : 'ALL',
        startDate: startDateInput ? startDateInput.value : '',
        endDate: endDateInput ? endDateInput.value : ''
    };
}

function saveCustomerTableFilters() {
    try {
        localStorage.setItem(CUSTOMER_TABLE_FILTER_KEY, JSON.stringify(getCustomerTableFilters()));
    } catch(e) {
        console.warn('Gagal menyimpan filter tabel nasabah:', e);
    }
}

function restoreCustomerTableFilters() {
    let filters = {};
    try {
        filters = JSON.parse(localStorage.getItem(CUSTOMER_TABLE_FILTER_KEY) || '{}') || {};
    } catch(e) {
        filters = {};
    }

    const { searchInput, typeInput, startDateInput, endDateInput } = getCustomerTableFilterElements();
    if(searchInput && !searchInput.value && filters.search) searchInput.value = filters.search;
    if(typeInput && typeInput.value === 'ALL' && filters.type) typeInput.value = filters.type;
    if(startDateInput && !startDateInput.value && filters.startDate) startDateInput.value = filters.startDate;
    if(endDateInput && !endDateInput.value && filters.endDate) endDateInput.value = filters.endDate;
}

function resetCustomerTableFilters() {
    const { searchInput, typeInput, startDateInput, endDateInput } = getCustomerTableFilterElements();
    if(searchInput) searchInput.value = '';
    if(typeInput) typeInput.value = 'ALL';
    if(startDateInput) startDateInput.value = '';
    if(endDateInput) endDateInput.value = '';
    localStorage.removeItem(CUSTOMER_TABLE_FILTER_KEY);
}

window.resetCustomerDateFilters = function() {
    const { startDateInput, endDateInput } = getCustomerTableFilterElements();
    if(startDateInput) startDateInput.value = '';
    if(endDateInput) endDateInput.value = '';
    filterCustomersTable();
};

function filterCustomersTable() {
    saveCustomerTableFilters();
    const search = document.getElementById('searchCustomerInput') ? document.getElementById('searchCustomerInput').value.toLowerCase() : '';
    const typeFilter = document.getElementById('filterCustomerType') ? document.getElementById('filterCustomerType').value : 'ALL';
    
    // New Date Filters
    const startDate = document.getElementById('filterCustomerDateStart') ? document.getElementById('filterCustomerDateStart').value : '';
    const endDate = document.getElementById('filterCustomerDateEnd') ? document.getElementById('filterCustomerDateEnd').value : '';
    
    let customers = getCustomers().map(c => ({
        ...c,
        id_nasabah: c.id_nasabah || c.local_id || c.no_cif || '-',
        nama: c.nama || '-',
        no_hp: c.no_hp || '-',
        no_ktp: c.no_ktp || '-',
        selain_ktp: c.selain_ktp || '-',
        tgl_daftar: c.tgl_daftar || '-'
    }));
    const totalCustomers = customers.length;
    
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
            String(c.nama || '').toLowerCase().includes(search) ||
            String(c.id_nasabah || '').toLowerCase().includes(search) ||
            String(c.no_hp || '').toLowerCase().includes(search) ||
            (c.no_ktp !== '-' && String(c.no_ktp || '').toLowerCase().includes(search)) ||
            (c.selain_ktp !== '-' && String(c.selain_ktp || '').toLowerCase().includes(search))
        );
    }

    customers.sort((a, b) => {
        const dateDiff = getCustomerRegistrationTime(b) - getCustomerRegistrationTime(a);
        if (dateDiff !== 0) return dateDiff;
        return String(b.id_nasabah || b.local_id || b.no_cif || b.nama || '')
            .localeCompare(String(a.id_nasabah || a.local_id || a.no_cif || a.nama || ''));
    });

    const tbody = document.getElementById('customersTableBody');
    if(!tbody) return;
    const totalSummary = document.getElementById('customerTotalSummary');
    if(totalSummary) {
        const fmtCount = (num) => new Intl.NumberFormat('id-ID').format(num || 0);
        totalSummary.textContent = customers.length === totalCustomers
            ? `Total Nasabah: ${fmtCount(totalCustomers)}`
            : `Tampil: ${fmtCount(customers.length)} dari ${fmtCount(totalCustomers)} nasabah`;
    }
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
            <td>${c.idpjk || '-'}</td>
            <td>${knLabel}</td>
            <td>${c.no_hp || '-'}</td>
            <td class="customer-name-cell">
                ${c.nama || '-'}
                ${(currentUserRole === 'admin' || currentUserRole === 'owner') && (c.inputBy || c.editBy) ? `
                    <div style="margin-top:3px; font-size:0.66rem; color:#64748b; line-height:1.15;">
                        ${c.inputBy ? `Input: ${c.inputBy}<br>` : ''}
                        ${c.editBy ? `Edit: ${c.editBy}` : ''}
                    </div>
                ` : ''}
            </td>
            <td>${c.tempat_lahir || '-'}</td>
            <td>${formatDateOnly(c.tanggal_lahir)}</td>
            <td class="customer-address-cell" title="${String(c.alamat || '-').replace(/"/g, '&quot;')}">${c.alamat || '-'}</td>
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
            <td class="customer-action-cell">
                <div class="customer-row-actions">
                    <button class="btn" style="background:#0ea5e9; color:white; border:none;" onclick="handleCustAction(this, 'preview')" title="Preview Detail"><i class="fa-solid fa-eye"></i></button>
                    ${c.no_hp && c.no_hp !== '-' ? `<button type="button" class="btn" style="background:#25d366; color:white; border:none;" onclick="window.sendCustomerWhatsAppById(decodeURIComponent('${encodeURIComponent(String(c.id_nasabah || c.internal_id || c.id_cif || '')).replace(/'/g, '%27')}'), decodeURIComponent('${encodeURIComponent(String(c.no_hp || c.phone || '')).replace(/'/g, '%27')}'), decodeURIComponent('${encodeURIComponent(String(c.nama || c.name || 'Nasabah')).replace(/'/g, '%27')}'))" title="Kirim WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                    <button class="btn btn-primary" onclick="handleCustAction(this, 'edit')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-danger" onclick="handleCustAction(this, 'delete')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
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

function loadCustomersTable(options = {}) {
    if(options.resetFilters) resetCustomerTableFilters();
    else restoreCustomerTableFilters();

    filterCustomersTable();
}

window.deleteCustomer = async function(id) {
    if(confirm('Hapus data nasabah ini? Tindakan ini tidak dapat dibatalkan.')) {
        try {
            const request = window.authFetch || fetch;
            const res = await request(`api/customers?id_nasabah=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `HTTP Error ${res.status}`);
            }
            const data = await res.json();
            console.log('Hapus Laravel Status:', data);

            let customers = getCustomers();
            customers = customers.filter(c => String(c.id_nasabah) !== String(id));
            saveCustomers(customers);
            if (customers.length === 0) {
                localStorage.setItem('mc_customers_reset_at', new Date().toISOString());
            }
            loadCustomersTable();
        } catch(err) {
            console.error("Hapus Laravel Gagal:", err);
            alert("Gagal menghapus data dari server: " + err.message);
            if (typeof syncFromMySQL_Customers === 'function') {
                await syncFromMySQL_Customers({ refreshUi: true, silent: true });
            } else {
                window.location.reload();
            }
        }
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
        confirmButtonText: 'SAYA YAKIN, HAPUS SEKARANG!',
        cancelButtonText: 'Batal'
    });

    if (!secondConfirm.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Menghapus Data...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const request = window.authFetch || fetch;
        let res = await request('api/customers/clear-all', {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });

        if(res.status === 404 || res.status === 405) {
            res = await request('api/customers?id_nasabah=__ALL__', {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            });
        }

        const rawResponse = await res.text();
        let result = {};
        try {
            result = rawResponse ? JSON.parse(rawResponse) : {};
        } catch(parseError) {
            const htmlTitle = rawResponse.match(/<title>(.*?)<\/title>/i)?.[1];
            const htmlHeading = rawResponse.match(/<h1>(.*?)<\/h1>/i)?.[1];
            const cleanMessage = htmlTitle || htmlHeading || rawResponse.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            throw new Error(cleanMessage || `Server mengembalikan respons tidak valid (${res.status}).`);
        }

        if(res.ok && result.status === 'success') {
            await request('api/datastore?store_key=mc_customers', {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            }).catch(err => console.warn('Gagal menghapus cache mc_customers di datastore:', err));
            localStorage.removeItem('mc_customers');
            localStorage.setItem('mc_customers_reset_at', new Date().toISOString());
            window.__mcCustomersMemory = [];
            if(typeof loadCustomersTable === 'function') loadCustomersTable();
            Swal.fire({
                icon: 'success',
                title: 'Data Bersih',
                text: 'Seluruh data nasabah telah dihapus dari sistem.',
                background: '#1e293b',
                color: '#fff'
            });
        } else {
            throw new Error(result.message || `Gagal menghapus data nasabah (${res.status}).`);
        }
    } catch(e) {
        console.error("Reset Gagal:", e);
        if(typeof loadCustomersTable === 'function') loadCustomersTable();
        Swal.fire("Error", e.message || "Terjadi kesalahan sistem saat mencoba menghapus data.", "error");
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

window.getCustomerCifPrefix = function(customerType = null) {
    const selectedType = customerType || (document.getElementById('modalCustType') ? document.getElementById('modalCustType').value : '');
    return String(selectedType) === '2' ? 'P-' : 'AMR-';
};

window.getCustomerCifNumber = function(noCif) {
    const value = String(noCif || '').trim();
    if(!value || value === '-') return 0;

    const match = value.match(/^(?:AMR|P|CIF-\d{8})-(\d+)$/i);
    if(!match) return 0;

    const num = parseInt(match[1], 10);
    return Number.isFinite(num) ? num : 0;
};

window.generateStandardCif = function(customerType = null, existingCif = null) {
    const customers = getCustomers();

    const existingNum = window.getCustomerCifNumber(existingCif);
    const prefix = window.getCustomerCifPrefix(customerType);
    if(existingNum > 0) {
        return `${prefix}${String(existingNum).padStart(4, '0')}`;
    }

    let globalMax = 0;
    customers.forEach(c => {
        const num = window.getCustomerCifNumber(c.no_cif);
        if(num > globalMax) globalMax = num;
    });

    return `${prefix}${String(globalMax + 1).padStart(4, '0')}`;
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
    populateBlastWaTemplateSelect();
    applyBlastWaTemplate();
    updateBlastWaCount();
};

window.closeBlastWaModal = function() {
    document.getElementById('blastWaModal').classList.remove('show');
};

function populateBlastWaTemplateSelect() {
    const select = document.getElementById('blastWaTemplateSelect');
    if(!select) return;

    const templates = typeof getWaTemplates === 'function' ? getWaTemplates() : [];
    const defaultTemplate = typeof getDefaultWaTemplate === 'function' ? getDefaultWaTemplate() : templates[0];
    const manualOption = '<option value="">Tulis Manual</option>';
    const options = templates.map(t => {
        const selected = defaultTemplate && t.id === defaultTemplate.id ? 'selected' : '';
        const category = t.category ? ` - ${t.category}` : '';
        return `<option value="${t.id}" ${selected}>${t.name || 'Template'}${category}</option>`;
    }).join('');

    select.innerHTML = manualOption + options;
}

window.applyBlastWaTemplate = function() {
    const select = document.getElementById('blastWaTemplateSelect');
    const textarea = document.getElementById('blastWaTemplate');
    if(!select || !textarea) return;

    if(!select.value) {
        textarea.focus();
        return;
    }

    const templates = typeof getWaTemplates === 'function' ? getWaTemplates() : [];
    const template = templates.find(t => t.id === select.value);
    if(template && template.content) {
        textarea.value = template.content;
    }
};

function buildBroadcastWaMessage(template, customer) {
    const profile = typeof getProfile === 'function' ? getProfile() : {};
    const customerName = customer?.nama || 'Bapak/Ibu';
    return template
        .replace(/\[NAMA\]/g, customerName)
        .replace(/\[NAMA_NASABAH\]/g, customerName)
        .replace(/\[NAMA_MC\]/g, profile.name || 'MC-ALMARA')
        .replace(/\[NO_HP_MC\]/g, profile.phoneWA || profile.phone || '-')
        .replace(/\[TANGGAL\]/g, new Date().toLocaleDateString('id-ID'))
        .replace(/\[NO_INVOICE\]/g, '-')
        .replace(/\[VALUTA_LIST\]/g, '-')
        .replace(/\[GRAND_TOTAL\]/g, '-')
        .replace(/\[METODE_BAYAR\]/g, '-')
        .replace(/\[METODE_RINCIAN\]/g, '-');
}

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
            const fallbackMessage = buildBroadcastWaMessage(template, c);
            const finalMsg = window.buildWaMessageForPurpose('broadcast', fallbackMessage, { customerName: c.nama });
            const waNum = normalizeWhatsAppNumber(c.no_hp);
            const encodedMsg = encodeURIComponent(finalMsg).replace(/'/g, '%27');
            
            tr.innerHTML = `
                <td>${c.nama}</td>
                <td>${c.no_hp}</td>
                <td>
                    <button class="btn btn-sm btn-success btn-wa-send" onclick="sendWaTo('${waNum}', '${encodedMsg}', this)">
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

window.sendWaTo = async function(phone, msg, btnElement) {
    try {
        await window.sendWhatsAppGateway(phone, decodeURIComponent(msg));
        btnElement.classList.remove('btn-success');
        btnElement.classList.add('btn-secondary');
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Terkirim';
    } catch (error) {
        alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
    }
};

window.sendCustomerWhatsAppById = async function(customerId, fallbackPhone = '', fallbackName = '') {
    const customer = (getCustomers() || []).find(item => {
        const keys = [item.id_nasabah, item.internal_id, item.id_cif, item.no_cif].map(value => String(value || ''));
        return keys.includes(String(customerId || ''));
    });
    const phone = customer?.no_hp || customer?.phone || fallbackPhone;
    const name = customer?.nama || customer?.name || fallbackName || 'Nasabah';
    const reference = customer?.id_nasabah || customer?.internal_id || customerId || 'CUSTOMER-WA';
    if (!phone || phone === '-') {
        alert('Nomor WhatsApp nasabah kosong. Periksa kolom No. HP pada data nasabah.');
        return;
    }
    return window.sendCustomerWhatsApp(phone, name, reference);
};

window.sendCustomerWhatsApp = async function(phone, name, reference = '') {
    try {
        const target = normalizeWhatsAppNumber(phone);
        if (!target || target.length < 10) {
            alert('Nomor WhatsApp nasabah tidak valid. Periksa kolom No. HP nasabah.');
            return;
        }
        const fallback = `Halo [NAMA_NASABAH],\n\nSalam dari *[NAMA_MC]*. Ada yang dapat kami bantu?`;
        const message = window.buildWaMessageForPurpose('customer', fallback, { customerName: name });
        await window.sendWhatsAppGateway(target, message, { reference: reference || 'CUSTOMER-WA' });
        alert('Pesan WhatsApp berhasil dikirim melalui Gateway.');
    } catch (error) {
        const maskedTarget = normalizeWhatsAppNumber(phone).replace(/(\d{4})\d+(\d{3})$/, '$1***$2');
        alert(`Gagal mengirim WhatsApp ke ${maskedTarget}: ${error.message || error}`);
    }
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
        currentUpdateCustPhotoBase64 = cust.foto_id || null;
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

window.updateCustomer = async function() {
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

    let uploadedPhoto = currentUpdateCustPhotoBase64;
    try {
        if (uploadedPhoto && uploadedPhoto.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
            const oldPhotoUrl = String(customers[index].foto_id || '');
            const canReplaceOldPhoto = oldPhotoUrl.startsWith('/uploads/') || oldPhotoUrl.includes('/uploads/customers/photos/');
            uploadedPhoto = await window.uploadBase64FileToFolder(uploadedPhoto, 'customers/photos', `${id}-foto-identitas`, {
                overwrite: true,
                replaceUrl: canReplaceOldPhoto ? oldPhotoUrl : ''
            });
        }
    } catch (uploadError) {
        Swal.fire("Gagal Upload Foto", uploadError.message || String(uploadError), "error");
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
        foto_id: uploadedPhoto,
        editBy: getCurrentUser() ? getCurrentUser().username : 'system',
        tgl_update: new Date().toISOString(),
        kn: $('input[name="update_custType"]:checked').val() || customers[index].kn
    };

    // Update Array & Local Storage (Perbaiki Key ke mc_customers)
    customers[index] = updatedData;
    localStorage.setItem('mc_customers', JSON.stringify(customers));

    // Sinkronisasi ke MySQL
    if (typeof window.saveToMySQL_Customer === 'function') {
        await window.saveToMySQL_Customer(updatedData);
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
        'modalCustId', 'modalCustType', 'modalCustName', 'modalCustIdPjk',
        'modalCustBirthPlace', 'modalCustBirthDate', 'modalCustAddress', 'modalCustIdType',
        'modalCustGender', 'modalCustCitizen', 'modalCustJob',
        'modalCustNik', 'modalCustIdNo', 'modalCustPhone', 'modalCustBankAcc',
        'modalCustCif', 'modalCustNpwp', 'modalCustLocalId', 'modalCustVisibleId',
        'modalCustInternalId', 'modalCustRegDate'
    ];
    
    fields.forEach(f => {
        const el = document.getElementById(f);
        if(el) {
            if(el.tagName === 'SELECT') el.selectedIndex = 0;
            else el.value = '';
            
            // Default: Lock fields until entity type is selected (except for special ones)
            const permanentEnabled = [
                'modalCustId', 'modalCustType', 'modalCustVisibleId', 'modalCustInternalId',
                'modalCustCif', 'modalCustRegDate', 'modalCustLocalId', 'btnOcrKtp',
                // Nomor identitas dapat diisi manual; OCR hanya membantu mengisi otomatis.
                'modalCustNik', 'modalCustIdNo'
            ];
            if(!permanentEnabled.includes(f)) {
                el.disabled = true;
            } else {
                el.disabled = false;
            }
        }
    });
    
    const photoInput = document.getElementById('modalCustPhoto');
    const nikInput = document.getElementById('modalCustNik');
    const otherIdInput = document.getElementById('modalCustIdNo');
    if (photoInput) photoInput.disabled = true;
    if (nikInput) nikInput.disabled = false;
    if (otherIdInput) {
        otherIdInput.disabled = false;
        otherIdInput.placeholder = "Nomor ID lainnya (opsional)";
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
            
            fill('modalCustNik', c.no_ktp !== '-' ? c.no_ktp : '');
            fill('modalCustIdNo', c.selain_ktp !== '-' ? c.selain_ktp : '');
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
    const idInternalInput = document.getElementById('modalCustInternalId');
    const idHiddenInput = document.getElementById('modalCustId');
    const cifInput = document.getElementById('modalCustCif');

    // Generate NEW Standard ID Nasabah if not editing
    if(idHiddenInput && !idHiddenInput.value) {
        const newId = window.generateStandardId();
        if(idVisibleInput) idVisibleInput.value = newId;
        if(idHiddenInput) idHiddenInput.value = newId;
        if(idInternalInput) idInternalInput.value = newId;
    } else if(idHiddenInput && idInternalInput && !idInternalInput.value) {
        idInternalInput.value = idHiddenInput.value;
    }

    // Generate NEW Standard CIF. If only the entity type changes, keep the number and swap the prefix.
    if(cifInput) {
        const typeKn = document.getElementById('modalCustType') ? document.getElementById('modalCustType').value : '';
        if(!cifInput.value || cifInput.value === '-') {
            cifInput.value = window.generateStandardCif(typeKn);
        } else if(window.getCustomerCifNumber(cifInput.value) > 0) {
            cifInput.value = window.generateStandardCif(typeKn, cifInput.value);
        }
    }
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.remove('show');
}

async function saveCustomer() {
    const idElem = document.getElementById('modalCustId');
    const internalIdElem = document.getElementById('modalCustInternalId');
    let id = idElem ? idElem.value : '';
    // Ambil langsung dari radio yang dipilih agar nilai UI dan nilai yang dikirim
    // tidak pernah berbeda. Kode database: 1=Perorangan, 2=Perusahaan.
    const selectedKn = String(document.querySelector('input[name="modalCustTypeGroup"]:checked')?.value || document.getElementById('modalCustType').value || '').trim();
    if (selectedKn !== '1' && selectedKn !== '2') {
        alert('Pilih Tipe Entitas / KN: Perorangan atau Perusahaan.');
        return;
    }
    // Nilai yang disimpan selalu kode standar database: 1=Perorangan, 2=Perusahaan.
    const typeKn = selectedKn === '2' ? '2' : '1';
    document.getElementById('modalCustType').value = typeKn;
    const name = document.getElementById('modalCustName').value;
    const idPjk = document.getElementById('modalCustIdPjk').value;
    const birthPlace = document.getElementById('modalCustBirthPlace').value;
    const birthDate = document.getElementById('modalCustBirthDate').value;
    const address = document.getElementById('modalCustAddress').value;
    const gender = document.getElementById('modalCustGender').value;
    const citizen = document.getElementById('modalCustCitizen').value;
    const job = document.getElementById('modalCustJob').value;
    const identityType = String(document.getElementById('modalCustIdType').value || '').trim().toUpperCase();
    const identityNumber = document.getElementById('modalCustNik').value.trim();
    const otherId = document.getElementById('modalCustIdNo').value.trim();
    // Nomor pada input utama hanya menjadi NIK saat jenisnya KTP. Untuk
    // Passport/SIM/Sertifikat, nomor tersebut disimpan sebagai Nomor ID lainnya.
    const isKtpIdentity = identityType === 'KTP';
    const storedNik = isKtpIdentity ? (identityNumber || '-') : '-';
    const storedOtherId = isKtpIdentity ? (otherId || '-') : (otherId || identityNumber || '-');
    const phone = document.getElementById('modalCustPhone').value;
    const bankAcc = document.getElementById('modalCustBankAcc').value;
    const cif = document.getElementById('modalCustCif').value;
    const npwp = document.getElementById('modalCustNpwp').value;
    const localId = document.getElementById('modalCustLocalId').value;

    if(!name) {
        alert("Nama wajib diisi untuk standar KYC!");
        return;
    }

    const dttotMatches = typeof window.findDttotMatches === 'function' ? window.findDttotMatches(name) : [];
    if (dttotMatches.length > 0) {
        const sampleMatches = dttotMatches.slice(0, 5).join('<br>');
        const warningText = `
            <div style="text-align:left; line-height:1.5;">
                <p style="margin:0 0 10px;">Nama <strong>${String(name).replace(/[&<>"]/g, '')}</strong> terdeteksi di daftar DTTOT.</p>
                <p style="margin:0 0 10px;">Kecocokan ditemukan pada:</p>
                <div style="padding:10px; background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 6px; max-height: 140px; overflow:auto;">${sampleMatches}</div>
                <p style="margin:10px 0 0;">Pilih <strong>Tolak</strong> untuk membatalkan penyimpanan, atau <strong>Lanjut</strong> jika tetap ingin menyimpan data ini.</p>
            </div>
        `;

        let continueSave = false;
        if (typeof Swal !== 'undefined') {
            const decision = await Swal.fire({
                icon: 'warning',
                title: 'Peringatan DTTOT',
                html: warningText,
                showDenyButton: true,
                confirmButtonText: 'Lanjut',
                denyButtonText: 'Tolak',
                reverseButtons: true,
                background: '#1e293b',
                color: '#f8fafc'
            });
            continueSave = !!decision.isConfirmed;
        } else {
            continueSave = confirm(`Nama "${name}" terdeteksi di daftar DTTOT. Klik OK untuk lanjut simpan, atau Cancel untuk tolak.`);
        }

        if (!continueSave) {
            return;
        }
    }

    const customers = getCustomers();

    let generatedId = id;
    if (!generatedId) {
        generatedId = window.generateStandardId();
    }
    if (idElem) idElem.value = generatedId;
    if (internalIdElem) internalIdElem.value = generatedId;
    
    // Auto generate CIF if empty
    let autoCif = cif;
    if(!autoCif || autoCif.trim() === '' || autoCif === '-') {
        autoCif = window.generateStandardCif(typeKn);
    } else if(window.getCustomerCifNumber(autoCif) > 0) {
        autoCif = window.generateStandardCif(typeKn, autoCif);
    }

    const regDateInput = document.getElementById('modalCustRegDate');
    const finalRegDate = (regDateInput && regDateInput.value) ? new Date(regDateInput.value).toISOString() : new Date().toISOString();

    let uploadedPhoto = currentCustPhotoBase64 || null;
    try {
        if (uploadedPhoto && uploadedPhoto.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
            uploadedPhoto = await window.uploadBase64FileToFolder(uploadedPhoto, 'customers/photos', `${generatedId}-foto-identitas`);
        }
    } catch (uploadError) {
        alert("Gagal upload foto nasabah: " + (uploadError.message || uploadError));
        return;
    }

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
        no_ktp: storedNik,
        selain_ktp: storedOtherId,
        no_cif: autoCif,
        npwp: npwp || '-',
        local_id: localId || '-',
        jenis_kelamin: gender,
        warga_negara: citizen,
        pekerjaan: job || '-',
        no_rekening: bankAcc || '-',
        tgl_daftar: finalRegDate,
        foto_id: uploadedPhoto
    };
    
    const existingIndex = customers.findIndex(c => String(c.id_nasabah || '').trim() === String(generatedId).trim());
    const currUser = getCurrentUser() ? getCurrentUser().fullName : 'Admin Kasir';
    if(existingIndex === -1) {
        customerData.inputBy = currUser;
        customerData.editBy = '';
        customers.push(customerData);
    } else {
        if(existingIndex > -1) {
            customerData.tgl_daftar = finalRegDate; // Override with user input from form
            customerData.inputBy = customers[existingIndex].inputBy || currUser;
            customerData.editBy = currUser;
            customers[existingIndex] = customerData;
        }
    }

    try {
        // Menyimpan master nasabah bukan transaksi; cegah refresh POS/sync
        // setelahnya menampilkan popup transaksi yang tidak berhubungan.
        if (typeof window.suppressTransactionNotifications === 'function') {
            window.suppressTransactionNotifications(8000);
        }
        saveCustomers(customers);
        if(typeof window.saveToMySQL_Customer === 'function') {
            await window.saveToMySQL_Customer(customerData);
        }
        
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
        if (typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('customers:updated', {
                detail: { customerId: generatedId, customerName: name }
            }));
        }
        
        alert("Data Nasabah Berhasil Disimpan!");
    } catch (e) {
        alert("Gagal menyimpan data nasabah! Error: " + e.message);
    }
}

// Settings Utility
// Old resetDatabase removed to prevent conflicts

// ==============================
// USB CAMERA CAPTURE (WEBCAM)
// ==============================
let cameraStream = null;
let cameraTargetPreviewId = null;
let cameraTargetPlaceholderId = null;

// Mengisi daftar device kamera yang terhubung
async function populateCameraDevices() {
    const select = document.getElementById('cameraSourceSelect');
    if (!select) return;
    
    // Clear select
    select.innerHTML = '';
    
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.text = "Tidak ada kamera terdeteksi";
            select.appendChild(opt);
            return;
        }
        
        const savedDeviceId = localStorage.getItem('selectedCameraDeviceId');
        let selectedIndex = 0;
        
        videoDevices.forEach((device, index) => {
            const opt = document.createElement('option');
            opt.value = device.deviceId;
            opt.text = device.label || `Kamera ${index + 1}`;
            if (savedDeviceId && device.deviceId === savedDeviceId) {
                selectedIndex = index;
            }
            select.appendChild(opt);
        });
        
        // Pilih kamera yang sesuai
        select.selectedIndex = selectedIndex;
    } catch (e) {
        console.error("Gagal membaca list device kamera:", e);
    }
}

window.openCameraModal = async function(targetPreviewId, targetPlaceholderId) {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    const loading = document.getElementById('cameraLoading');
    
    if (!modal || !video) {
        alert("Elemen kamera tidak ditemukan!");
        return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Akses Kamera Ditolak (Browser Security Policy):\n\nKamera hanya dapat diakses melalui koneksi aman (HTTPS) atau dari komputer server lokal (http://localhost atau http://127.0.0.1).\n\nJika Anda membuka aplikasi ini melalui alamat IP (contoh: http://192.168.1.100 atau domain http://almara.test), peramban (browser) secara otomatis memblokir akses hardware.\n\nSOLUSI CEPAT (Untuk Google Chrome / Microsoft Edge):\n1. Buka tab baru di browser dan ketik: chrome://flags/#unsafely-treat-insecure-origin-as-secure\n2. Cari bagian 'Insecure origins treated as secure'\n3. Ubah statusnya menjadi 'Enabled'\n4. Masukkan alamat URL web Anda di kotak teks (contoh: http://192.168.1.100 atau http://almara.test)\n5. Klik tombol 'Relaunch' di pojok kanan bawah.");
        return;
    }
    
    cameraTargetPreviewId = targetPreviewId;
    cameraTargetPlaceholderId = targetPlaceholderId;
    
    // Tampilkan modal
    modal.style.display = 'flex';
    modal.classList.add('show');
    loading.style.display = 'block';
    
    // Request webcam access dengan constraint dasar terlebih dahulu untuk memicu izin browser
    try {
        if (cameraStream) {
            window.closeCameraModal();
        }
        
        // Pemicu dialog izin kamera dari browser (label device hanya muncul jika izin sudah diberikan)
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        initialStream.getTracks().forEach(track => track.stop());
        
        // Baca list kamera setelah izin diberikan
        await populateCameraDevices();
        
        // Mulai stream dengan kamera terpilih
        const select = document.getElementById('cameraSourceSelect');
        const activeDeviceId = select ? select.value : null;
        
        await window.startCameraStream(activeDeviceId);
    } catch (err) {
        console.error("Gagal mengakses kamera USB:", err);
        loading.style.display = 'none';
        alert("Tidak dapat mengakses kamera USB. Pastikan kamera terhubung dan izin peramban telah diberikan.\nDetail error: " + err.message);
        window.closeCameraModal();
    }
};

window.startCameraStream = async function(deviceId) {
    const video = document.getElementById('cameraVideo');
    const loading = document.getElementById('cameraLoading');
    if (!video) return;
    
    loading.style.display = 'block';
    
    // Stop current stream if any
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    try {
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraStream = stream;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            loading.style.display = 'none';
        };
        
        if (deviceId) {
            localStorage.setItem('selectedCameraDeviceId', deviceId);
        }
    } catch (err) {
        console.error("Gagal memulai camera stream dengan deviceId:", deviceId, err);
        // Fallback ke kamera default jika deviceId yang dipilih gagal
        if (deviceId) {
            console.log("Mencoba fallback ke kamera default...");
            await window.startCameraStream(null);
        } else {
            loading.style.display = 'none';
            throw err;
        }
    }
};

window.changeCameraSource = async function(deviceId) {
    if (!deviceId) return;
    try {
        await window.startCameraStream(deviceId);
    } catch (err) {
        alert("Gagal memindahkan sumber kamera: " + err.message);
    }
};

window.closeCameraModal = function() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
    
    if (video) {
        video.srcObject = null;
    }
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
};

window.captureCameraSnapshot = function() {
    const video = document.getElementById('cameraVideo');
    if (!video || !cameraStream) {
        alert("Kamera tidak aktif!");
        return;
    }
    
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    
    const base64Data = canvas.toDataURL('image/jpeg', 0.90);
    
    if (cameraTargetPreviewId) {
        const preview = document.getElementById(cameraTargetPreviewId);
        if (preview) {
            preview.src = base64Data;
            preview.style.display = 'block';
        }
        
        if (cameraTargetPreviewId === 'update_previewImg') {
            currentUpdateCustPhotoBase64 = base64Data;
        } else if (cameraTargetPreviewId === 'modalCustPhotoPreview') {
            currentCustPhotoBase64 = base64Data;
        }
    }
    
    if (cameraTargetPlaceholderId) {
        const placeholder = document.getElementById(cameraTargetPlaceholderId);
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }
    
    window.closeCameraModal();
};

// ==============================
// KURS HARI INI (INTERNAL LOOKUP & CALCULATOR)
// ==============================
window.loadKursHariIniTable = function() {
    const container = document.getElementById('kursHariIniContainer');
    const calcSelect = document.getElementById('calcKursValuta');
    if (!container) return;

    const activeCurrencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
    const masterCurrencies = typeof getMasterCurrencies === 'function' ? getMasterCurrencies() : [];

    // Populate calculator dropdown
    if (calcSelect) {
        const prevVal = calcSelect.value;
        calcSelect.innerHTML = activeCurrencies.map(c => `<option value="${c.code}">${c.code} - ${c.code}</option>`).join('');
        if (prevVal && activeCurrencies.some(c => c.code === prevVal)) {
            calcSelect.value = prevVal;
        } else if (activeCurrencies.length > 0) {
            calcSelect.value = activeCurrencies[0].code;
        }
    }

    let html = '';

    activeCurrencies.forEach(c => {
        const currencyCode = String(c.code || '').toUpperCase();
        const baseCurrencyCode = getCurrencyBaseCode(currencyCode);
        const mc = masterCurrencies.find(m => m.code === currencyCode) || masterCurrencies.find(m => m.code === baseCurrencyCode) || { flag: '', country: '', countryCode: '' };
        const countryCode = String(mc.countryCode || '').toLowerCase();
        const flagUrl = countryCode ? `https://flagcdn.com/w80/${countryCode}.png` : '';
        const countryName = mc.country || 'Global';

        const isLowStock = (c.stock || 0) <= (c.alert || 0);

        const trendIconMini = c.trend === 'up' 
            ? `<span style="color: #10B981; font-size: 0.95rem; line-height: 1; margin-left: 6px;" title="Tren Naik">▲</span>` 
            : (c.trend === 'down' 
                ? `<span style="color: #ef4444; font-size: 0.95rem; line-height: 1; margin-left: 6px;" title="Tren Turun">▼</span>` 
                : `<span style="color: #64748b; font-size: 0.8rem; opacity: 0.6; line-height: 1; margin-left: 6px;" title="Tren Stabil">─</span>`);

        html += `
            <div class="kurs-card" data-code="${currencyCode}" data-country="${countryName.toLowerCase()}" onclick="window.handleKursCardClick(event, '${currencyCode}')" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s ease; cursor: pointer; user-select: none;">
                <!-- Header: Checkbox, Flag, Code, Country -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" class="kurs-select-checkbox" value="${currencyCode}" style="width: 15px; height: 15px; margin: 0; cursor: pointer; accent-color: #38bdf8;" onchange="window.toggleKursSelection('${currencyCode}')">
                    
                    <span style="width: 32px; height: 22px; border-radius: 3px; overflow: hidden; display: inline-flex; border: 1px solid rgba(255,255,255,0.1); justify-content: center; align-items: center; background: #0f172a; flex-shrink: 0;">
                        ${flagUrl ? `<img src="${flagUrl}" alt="${currencyCode}" style="width:100%; height:100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">` : ''}
                        <span style="display:none; font-weight:bold; font-size:0.75rem; color:#fff;">${currencyCode.slice(0, 2)}</span>
                    </span>
                    
                    <strong style="font-size: 1.1rem; color: #f8fafc; letter-spacing: 0.2px; display: inline-flex; align-items: center;">${currencyCode} ${trendIconMini}</strong>
                    
                    <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 500; margin-left: auto; text-align: right; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${countryName}">${countryName}</span>
                </div>
                
                <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 0;">
                
                <!-- Rates Box -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; text-align: center;">
                    <div style="background: rgba(16, 185, 129, 0.05); padding: 4px 2px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.1); display: flex; flex-direction: column; justify-content: center;">
                        <span style="font-size: 0.65rem; color: #34d399; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2px;">BELI</span>
                        <div style="font-size: 1.05rem; font-weight: 700; color: #10B981;">${typeof formatRate === 'function' ? formatRate(c.buy) : c.buy.toLocaleString()}</div>
                    </div>
                    <div style="background: rgba(239, 68, 68, 0.05); padding: 4px 2px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.1); display: flex; flex-direction: column; justify-content: center;">
                        <span style="font-size: 0.65rem; color: #f87171; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2px;">JUAL</span>
                        <div style="font-size: 1.05rem; font-weight: 700; color: #ef4444;">${typeof formatRate === 'function' ? formatRate(c.sell) : c.sell.toLocaleString()}</div>
                    </div>
                </div>
                
                <!-- Footer Info: Stock -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #cbd5e1;">
                    <span>Stok: <strong style="color:#f8fafc;">${(c.stock || 0).toLocaleString('id-ID')}</strong></span>
                    ${isLowStock 
                        ? `<span style="color: #f87171; font-weight: bold;" title="Stok Minim"><i class="fa-solid fa-triangle-exclamation"></i></span>`
                        : `<span style="color: #34d399; font-weight: bold;" title="Stok Aman"><i class="fa-solid fa-circle-check"></i></span>`}
                </div>
            </div>
        `;
     });

     container.innerHTML = html || '<div style="color: #94a3b8; text-align: center; grid-column: 1/-1; padding: 40px; font-size: 1.1rem;"><i class="fa-solid fa-circle-info fa-2x mb-3" style="color:#64748b;"></i><br>Tidak ada valuta aktif saat ini.</div>';
     
     // Run initial conversion calculation
     window.calculateQuickRate();

     // Restore selections
     if (typeof window.updateKursSelectionUI === 'function') {
         window.updateKursSelectionUI();
     }
};

window.filterKursHariIni = function() {
    const query = (document.getElementById('searchKursHariIni')?.value || '').toLowerCase().trim();
    const cards = document.querySelectorAll('#kursHariIniContainer .kurs-card');
    
    cards.forEach(card => {
        const code = (card.getAttribute('data-code') || '').toLowerCase();
        const country = (card.getAttribute('data-country') || '').toLowerCase();
        
        if (code.includes(query) || country.includes(query)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

window.calculateQuickRate = function() {
    const valutaCode = document.getElementById('calcKursValuta')?.value;
    const type = document.getElementById('calcKursTipe')?.value;
    const amount = parseFloat(document.getElementById('calcKursAmount')?.value) || 0;
    
    const rateLabel = document.getElementById('calcKursRateLabel');
    const totalLabel = document.getElementById('calcKursTotalLabel');
    
    if (!valutaCode) {
        if (rateLabel) rateLabel.innerText = 'Rp 0';
        if (totalLabel) totalLabel.innerText = 'Rp 0';
        return;
    }
    
    const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
    const cObj = currencies.find(c => c.code === valutaCode);
    
    if (!cObj) {
        if (rateLabel) rateLabel.innerText = 'Rp 0';
        if (totalLabel) totalLabel.innerText = 'Rp 0';
        return;
    }
    
    const rate = type === 'beli' ? (cObj.buy || 0) : (cObj.sell || 0);
    const total = amount * rate;
    
    if (rateLabel) rateLabel.innerText = `Rp ${rate.toLocaleString('id-ID')}`;
    if (totalLabel) totalLabel.innerText = `Rp ${total.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

// ==========================================
// VIEWER FOTO WAJAH NASABAH (TRANSAKSI)
// ==========================================
window.viewTrxCustomerPhoto = function(photoUrl) {
    if (!photoUrl) return;
    if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
        Swal.fire({
            title: 'Foto Wajah Nasabah',
            imageUrl: photoUrl,
            imageWidth: 400,
            imageAlt: 'Foto Wajah Nasabah',
            background: '#1e293b',
            color: '#f8fafc',
            confirmButtonColor: '#38bdf8',
            confirmButtonText: 'Tutup'
        });
    } else {
        window.open(photoUrl, '_blank');
    }
};

// ==========================================
// SELEKSI KURS & KIRIM WHATSAPP
// ==========================================
window.selectedKursCodes = [];

window.toggleKursSelection = function(code) {
    const idx = window.selectedKursCodes.indexOf(code);
    if (idx === -1) {
        window.selectedKursCodes.push(code);
    } else {
        window.selectedKursCodes.splice(idx, 1);
    }
    window.updateKursSelectionUI();
};

window.handleKursCardClick = function(event, code) {
    if (event.target.closest('.kurs-select-checkbox') || event.target.closest('button') || event.target.closest('a') || event.target.closest('input')) {
        return;
    }
    window.toggleKursSelection(code);
};

window.selectAllKurs = function(shouldSelectAll) {
    const checkboxes = document.querySelectorAll('.kurs-select-checkbox');
    window.selectedKursCodes = [];
    if (shouldSelectAll) {
        checkboxes.forEach(cb => {
            window.selectedKursCodes.push(cb.value);
            cb.checked = true;
        });
    } else {
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
    }
    window.updateKursSelectionUI();
};

window.updateKursSelectionUI = function() {
    const countEl = document.getElementById('selectedKursCount');
    const sendBtn = document.getElementById('btnSendWaKurs');
    const selectAllBtn = document.getElementById('btnSelectAllKurs');
    const deselectAllBtn = document.getElementById('btnDeselectAllKurs');
    
    if (countEl) countEl.textContent = window.selectedKursCodes.length;
    if (sendBtn) {
        sendBtn.disabled = window.selectedKursCodes.length === 0;
    }
    
    if (selectAllBtn && deselectAllBtn) {
        if (window.selectedKursCodes.length > 0) {
            selectAllBtn.style.display = 'none';
            deselectAllBtn.style.display = 'inline-flex';
        } else {
            selectAllBtn.style.display = 'inline-flex';
            deselectAllBtn.style.display = 'none';
        }
    }
    
    const cards = document.querySelectorAll('#kursHariIniContainer .kurs-card');
    cards.forEach(card => {
        const code = card.getAttribute('data-code');
        const cb = card.querySelector('.kurs-select-checkbox');
        if (window.selectedKursCodes.includes(code)) {
            card.style.borderColor = 'rgba(56, 189, 248, 0.5)';
            card.style.background = 'rgba(56, 189, 248, 0.08)';
            if (cb) cb.checked = true;
        } else {
            card.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            card.style.background = 'rgba(30, 41, 59, 0.5)';
            if (cb) cb.checked = false;
        }
    });
};

window.sendSelectedKursViaWa = function() {
    if (window.selectedKursCodes.length === 0) {
        alert("Pilih setidaknya satu mata uang!");
        return;
    }
    
    const phoneInput = document.getElementById('mSendKursWaPhone');
    if (phoneInput) phoneInput.value = '';
    const nameInput = document.getElementById('mSendKursWaName');
    if (nameInput) nameInput.value = '';
    
    window.populateWaFavoritesDropdown();
    
    const modal = document.getElementById('sendKursWaModal');
    if (modal) modal.style.display = 'flex';
};

window.closeSendKursWaModal = function() {
    const modal = document.getElementById('sendKursWaModal');
    if (modal) modal.style.display = 'none';
};

window.submitSendKursWa = async function() {
    const activeCurrencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
    const selectedCurrencies = activeCurrencies.filter(c => window.selectedKursCodes.includes(c.code));
    
    if (selectedCurrencies.length === 0) {
        alert("Data valas terpilih tidak ditemukan!");
        return;
    }
    
    const profile = (typeof getProfile === 'function') ? getProfile() : (typeof almaraStore !== 'undefined' && almaraStore.getProfile ? almaraStore.getProfile() : {});
    const companyName = profile.name || 'Money Changer Almara';
    
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateTimeStr = new Date().toLocaleDateString('id-ID', options);
    
    let text = `*KURS HARI INI - ${companyName.toUpperCase()}*\n`;
    text += `Tanggal: ${dateTimeStr} WIB\n\n`;
    text += `Berikut referensi kurs transaksi terupdate:\n\n`;
    
    const formatRateText = (val) => {
        return typeof formatRate === 'function' ? formatRate(val) : val.toLocaleString('id-ID');
    };
    
    selectedCurrencies.forEach((c, idx) => {
        text += `${idx + 1}. *${c.code}*\n`;
        text += `   - Beli: Rp ${formatRateText(c.buy)}\n`;
        text += `   - Jual: Rp ${formatRateText(c.sell)}\n`;
    });
    
    text += `\n*Catatan:* Kurs dapat berubah sewaktu-waktu. Harap konfirmasi sebelum bertransaksi.\n`;
    text += `Terima kasih.`;
    text = window.buildWaMessageForPurpose('kurs', text, { currencyList: text, date: dateTimeStr, paymentMethod: 'Informasi kurs' });
    
    const phoneInput = document.getElementById('mSendKursWaPhone');
    const phoneVal = phoneInput ? phoneInput.value.trim() : '';
    
    let phone = phoneVal.replace(/[^0-9]/g, '');
    if (phone) {
        if (phone.startsWith('0')) {
            phone = '62' + phone.substring(1);
        }
    }
    
    if (!phone) {
        alert('Nomor WhatsApp tujuan wajib diisi untuk pengiriman via WA Gateway.');
        return;
    }
    try {
        await window.sendWhatsAppGateway(phone, text);
        window.closeSendKursWaModal();
        alert('Kurs berhasil dikirim melalui WA Gateway.');
    } catch (error) {
        alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
    }
};

// ==========================================
// WA FAVORITES HELPERS
// ==========================================
function getWaFavorites() {
    return window.safeArrayGet('mc_wa_favorites');
}

function saveWaFavorites(data) {
    localStorage.setItem('mc_wa_favorites', JSON.stringify(data));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_wa_favorites', data);
    }
}

window.populateWaFavoritesDropdown = function() {
    const select = document.getElementById('mSendKursWaFavorite');
    if (!select) return;
    
    const favorites = getWaFavorites();
    
    let html = '<option value="">-- Pilih Kontak Favorit --</option>';
    favorites.forEach(f => {
        const curList = Array.isArray(f.currencies) && f.currencies.length > 0 ? f.currencies.join(', ') : 'Semua';
        html += `<option value="${f.phone}">${escapeHtml(f.name)} (${curList})</option>`;
    });
    
    select.innerHTML = html;
    
    // Hide delete button initially
    const deleteBtn = document.getElementById('btnDeleteWaFavorite');
    if (deleteBtn) deleteBtn.style.display = 'none';
};

window.selectWaFavorite = function(phone) {
    const phoneInput = document.getElementById('mSendKursWaPhone');
    if (phoneInput) {
        phoneInput.value = phone || '';
    }
    
    const deleteBtn = document.getElementById('btnDeleteWaFavorite');
    if (deleteBtn) {
        deleteBtn.style.display = phone ? 'inline-block' : 'none';
    }
    
    const nameInput = document.getElementById('mSendKursWaName');
    if (nameInput) nameInput.value = '';
    
    if (phone) {
        const favorites = getWaFavorites();
        const fav = favorites.find(f => f.phone === phone);
        if (fav && Array.isArray(fav.currencies)) {
            window.selectedKursCodes = [...fav.currencies];
            window.updateKursSelectionUI();
        }
    }
};

window.saveWaFavorite = function() {
    const phoneInput = document.getElementById('mSendKursWaPhone');
    const nameInput = document.getElementById('mSendKursWaName');
    
    const rawPhone = phoneInput ? phoneInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!rawPhone) {
        alert("Masukkan nomor telepon terlebih dahulu!");
        return;
    }
    if (!name) {
        alert("Masukkan nama kontak untuk menyimpan!");
        return;
    }
    
    let phone = rawPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }
    
    const currentCurrencies = [...window.selectedKursCodes];
    
    const favorites = getWaFavorites();
    const existsIdx = favorites.findIndex(f => f.phone === phone);
    
    if (existsIdx !== -1) {
        favorites[existsIdx].name = name;
        favorites[existsIdx].currencies = currentCurrencies;
    } else {
        favorites.push({ name, phone, currencies: currentCurrencies });
    }
    
    saveWaFavorites(favorites);
    window.populateWaFavoritesDropdown();
    
    const select = document.getElementById('mSendKursWaFavorite');
    if (select) select.value = phone;
    window.selectWaFavorite(phone);
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Kontak & Valas Disimpan',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1200,
            showConfirmButton: false
        });
    }
};

window.deleteWaFavorite = function() {
    const select = document.getElementById('mSendKursWaFavorite');
    if (!select) return;
    
    const phone = select.value;
    if (!phone) return;
    
    const favorites = getWaFavorites();
    const newFavorites = favorites.filter(f => f.phone !== phone);
    saveWaFavorites(newFavorites);
    
    window.populateWaFavoritesDropdown();
    window.selectWaFavorite('');
    
    const phoneInput = document.getElementById('mSendKursWaPhone');
    if (phoneInput) phoneInput.value = '';
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Kontak Dihapus dari Favorit',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1200,
            showConfirmButton: false
        });
    }
};

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
