// Old money, HRIS, and booking modules

// ==============================
// OLD MONEY MODULE LOGIC (ISOLATED)
// ==============================

// --- Storage Helpers ---
const getOldMoneyStock = () => { let d = JSON.parse(localStorage.getItem('mc_old_money_stock')); return Array.isArray(d) ? d : []; };
const saveOldMoneyStock = async (data) => {
    localStorage.setItem('mc_old_money_stock', JSON.stringify(data));
    if (typeof window.pushToUniversalDatastore === 'function') {
        await window.pushToUniversalDatastore('mc_old_money_stock', data);
    }
};
const getOldMoneyTrxs = () => { let d = JSON.parse(localStorage.getItem('mc_old_money_trxs')); return Array.isArray(d) ? d : []; };
const saveOldMoneyTrxs = async (data) => {
    localStorage.setItem('mc_old_money_trxs', JSON.stringify(data));
    if (typeof window.pushToUniversalDatastore === 'function') {
        await window.pushToUniversalDatastore('mc_old_money_trxs', data);
    }
};
const getOldMoneySuppliers = () => { let d = JSON.parse(localStorage.getItem('mc_old_money_suppliers')); return Array.isArray(d) ? d : []; };
const saveOldMoneySuppliers = async (data) => {
    localStorage.setItem('mc_old_money_suppliers', JSON.stringify(data));
    if (typeof window.pushToUniversalDatastore === 'function') {
        await window.pushToUniversalDatastore('mc_old_money_suppliers', data);
    }
};
const getOldMoneyCash = () => parseFloat(localStorage.getItem('mc_old_money_cash')) || 0;
const saveOldMoneyCash = async (val) => {
    localStorage.setItem('mc_old_money_cash', val.toString());
    if(typeof window.pushToUniversalDatastore === 'function') {
        await window.pushToUniversalDatastore('mc_old_money_cash', Number(val));
    }
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
window.oldMoneyEditingTrxId = null;
window.oldMoneyEditingTrxTimestamp = null;
window.oldMoneyActiveStockCategory = 'KOIN';
window.oldMoneyActiveFormCategory = 'KOIN';
window.currentOldMoneyItemPhotoBase64 = null;
window.currentOldMoneySupplierPhotoBase64 = null;
window.oldMoneySupplierTab = 'KOIN';
window.oldMoneySelectedTrxIds = new Set();

function getOldMoneyUsedInvoiceSeqSet(trxs = getOldMoneyTrxs()) {
    const used = new Set();
    (Array.isArray(trxs) ? trxs : []).forEach(trx => {
        const match = String(trx && trx.id || '').match(/^OM-(\d+)$/i);
        if (!match) return;
        const seq = parseInt(match[1], 10);
        if (Number.isFinite(seq)) used.add(seq);
    });
    return used;
}

function nextOldMoneyTrxId(trxs = getOldMoneyTrxs()) {
    const used = getOldMoneyUsedInvoiceSeqSet(trxs);
    let seq = 1;
    while (used.has(seq)) seq += 1;
    return `OM-${String(seq).padStart(4, '0')}`;
}

function normalizeOldMoneyTrxDate(value) {
    const d = new Date(value || new Date().toISOString());
    return Number.isNaN(d.getTime()) ? new Date() : d;
}

function buildOldMoneyRebuildState(sourceTrxs = getOldMoneyTrxs()) {
    const baseStock = getOldMoneyStock().map(item => ({
        ...item,
        qty: 0,
        buyPrice: 0,
        category: normalizeOldMoneyCategory(item.category)
    }));
    const stockById = new Map(baseStock.map(item => [String(item.id || ''), item]));
    let cash = 0;
    const sortedTrxs = [...(Array.isArray(sourceTrxs) ? sourceTrxs : [])].sort((a, b) => {
        const timeA = normalizeOldMoneyTrxDate(a?.date).getTime();
        const timeB = normalizeOldMoneyTrxDate(b?.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
    });

    sortedTrxs.forEach(trx => {
        const type = String(trx?.type || '').toUpperCase();
        if (type === 'TOPUP') {
            cash += parseInt(trx.totalRp) || 0;
            return;
        }
        if (!Array.isArray(trx?.items) || trx.items.length === 0) return;

        const totalRp = parseInt(trx.totalRp) || 0;
        if (type === 'BELI') {
            cash -= totalRp;
        } else if (type === 'JUAL') {
            cash += totalRp;
        }

        trx.items.forEach(oldItem => {
            const item = stockById.get(String(oldItem?.itemId || ''));
            if (!item) return;
            const qty = parseFloat(oldItem.qty) || 0;
            const rate = parseFloat(oldItem.kurs) || 0;
            if (type === 'BELI') {
                const prevQty = parseFloat(item.qty) || 0;
                const prevAvg = parseFloat(item.buyPrice) || 0;
                const nextQty = prevQty + qty;
                if (nextQty > 0) {
                    item.buyPrice = ((prevQty * prevAvg) + (qty * rate)) / nextQty;
                } else if (rate > 0) {
                    item.buyPrice = rate;
                }
                item.qty = prevQty + qty;
            } else if (type === 'JUAL') {
                item.qty = (parseFloat(item.qty) || 0) - qty;
            }
        });
    });

    return {
        stock: baseStock,
        cash: Math.max(0, cash)
    };
}

async function persistOldMoneyStateAfterTransactionRemoval(remainingTrxs, removedIds = []) {
    const rebuilt = buildOldMoneyRebuildState(remainingTrxs);
    await saveOldMoneyStock(rebuilt.stock);
    await saveOldMoneyCash(rebuilt.cash);
    await saveOldMoneyTrxs(remainingTrxs);

    const removedSet = new Set((Array.isArray(removedIds) ? removedIds : []).map(id => String(id || '').trim()).filter(Boolean));
    if (removedSet.size > 0) {
        removedSet.forEach(id => window.oldMoneySelectedTrxIds.delete(id));
        if (window.lastOldMoneyTrx && removedSet.has(String(window.lastOldMoneyTrx.id || '').trim())) {
            window.lastOldMoneyTrx = null;
        }
        if (window.oldMoneyEditingTrxId && removedSet.has(String(window.oldMoneyEditingTrxId || '').trim())) {
            clearOldMoneyEditState();
        }
    }

    loadOldMoneyDashboard();
    loadOldMoneyItems();
    loadOldMoneyStockTable();
    loadOldMoneyTrxTable();
}

window.toggleOldMoneyTrxSelection = function(id, checked = null) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return;
    const shouldSelect = checked === null
        ? !window.oldMoneySelectedTrxIds.has(normalizedId)
        : Boolean(checked);
    if (shouldSelect) window.oldMoneySelectedTrxIds.add(normalizedId);
    else window.oldMoneySelectedTrxIds.delete(normalizedId);
    updateOldMoneySelectedCount();
};

window.setOldMoneyTrxSelectionAll = function(checked = true) {
    const ids = Array.from(document.querySelectorAll('#oldMoneyTrxTableBody input[data-oldmoney-trx-checkbox="1"]'))
        .map(input => String(input.dataset.trxId || '').trim())
        .filter(Boolean);
    ids.forEach(id => {
        if (checked) window.oldMoneySelectedTrxIds.add(id);
        else window.oldMoneySelectedTrxIds.delete(id);
    });
    loadOldMoneyTrxTable();
    updateOldMoneySelectedCount();
};

window.clearOldMoneyTrxSelection = function() {
    window.oldMoneySelectedTrxIds = new Set();
    loadOldMoneyTrxTable();
    updateOldMoneySelectedCount();
};

function updateOldMoneySelectedCount() {
    const el = document.getElementById('oldMoneySelectedCount');
    if (!el) return;
    el.textContent = `${window.oldMoneySelectedTrxIds.size} dipilih`;
}

window.deleteOldMoneyTransaction = async function(trxId) {
    const id = String(trxId || '').trim();
    if (!id) return;
    if (!confirm(`Hapus transaksi ${id}? Stok dan kas akan disesuaikan kembali.`)) return;

    const trxs = getOldMoneyTrxs();
    const target = trxs.find(item => String(item.id || '').trim() === id);
    if (!target) return alert('Transaksi tidak ditemukan!');
    const remaining = trxs.filter(item => String(item.id || '').trim() !== id);
    await persistOldMoneyStateAfterTransactionRemoval(remaining, [id]);
    alert(`Transaksi ${id} berhasil dihapus.`);
};

window.deleteSelectedOldMoneyTransactions = async function() {
    const ids = Array.from(window.oldMoneySelectedTrxIds).map(id => String(id || '').trim()).filter(Boolean);
    if (ids.length === 0) return alert('Belum ada transaksi yang dipilih.');
    if (!confirm(`Hapus ${ids.length} transaksi terpilih? Stok dan kas akan disesuaikan kembali.`)) return;

    const trxs = getOldMoneyTrxs();
    const remaining = trxs.filter(item => !ids.includes(String(item.id || '').trim()));
    await persistOldMoneyStateAfterTransactionRemoval(remaining, ids);
    alert(`${ids.length} transaksi berhasil dihapus.`);
};

window.deleteAllOldMoneyTransactions = async function() {
    const trxs = getOldMoneyTrxs();
    if (trxs.length === 0) return alert('Tidak ada transaksi untuk dihapus.');
    if (!confirm(`Hapus semua ${trxs.length} transaksi old money? Stok dan kas akan direset berdasarkan master item.`)) return;

    await persistOldMoneyStateAfterTransactionRemoval([], trxs.map(item => item.id));
    window.oldMoneySelectedTrxIds = new Set();
    alert('Semua transaksi old money berhasil dihapus.');
};

function normalizeOldMoneyCategory(category) {
    return String(category || '').toUpperCase() === 'KOIN' ? 'KOIN' : 'UANG_LAMA';
}

function getOldMoneyCategoryLabel(category) {
    return normalizeOldMoneyCategory(category) === 'KOIN' ? 'Koin' : 'Uang Lama';
}

function escapeOldMoneyHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function extractOldMoneyDenomination(item) {
    if (!item || !item.desc) return 1;
    const numMatch = String(item.desc).match(/[\d.,]+/);
    if (!numMatch) return 1;

    const parsed = parseOldMoneyFormattedNumber(numMatch[0]);
    return parsed > 0 ? parsed : 1;
}

function getOldMoneyStockValasAmount(item) {
    const qty = parseFloat(item?.qty) || 0;
    const category = normalizeOldMoneyCategory(item?.category);
    if (category === 'KOIN') {
        return qty * extractOldMoneyDenomination(item);
    }
    return qty;
}

function parseOldMoneyFormattedNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    let normalized = raw.replace(/[^\d,.-]/g, '');
    if (normalized.includes(',')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
        const dotParts = normalized.split('.');
        if (dotParts.length > 1) {
            const lastPart = dotParts[dotParts.length - 1];
            if (/^\d{3}$/.test(lastPart)) {
                normalized = dotParts.join('');
            }
        }
    }
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatOldMoneyNumericDisplay(value, kind = 'decimal') {
    const amount = Number(value) || 0;
    if (!amount) return '';
    if (kind === 'idr') {
        return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(amount));
    }
    if (kind === 'rate') {
        return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(amount);
    }
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(amount);
}

function updateOldMoneyCheckoutButton() {
    const btn = document.getElementById('btnOldMoneyCheckout');
    if (!btn) return;
    if (window.oldMoneyEditingTrxId) {
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Update & Cetak Struk';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Checkout & Cetak Struk';
    }
}

function normalizeOldMoneyPhone(phone) {
    let sanitized = String(phone || '').replace(/[^0-9]/g, '');
    if (!sanitized) return '';
    if (sanitized.startsWith('0')) sanitized = '62' + sanitized.substring(1);
    return sanitized;
}

function findCustomerIdByOldMoneyTrx(trx) {
    if (trx && (trx.counterpartType === 'SUPPLIER' || trx.supplierId)) return '-';
    const customers = getCustomers();
    const targetPhone = normalizeOldMoneyPhone(trx.supplierPhone);
    const targetName = String(trx.supplier || '').trim().toLowerCase();

    const found = customers.find(customer => {
        const customerPhone = normalizeOldMoneyPhone(customer.hp || customer.no_hp || '');
        const customerName = String(customer.nama || '').trim().toLowerCase();
        return (targetPhone && customerPhone === targetPhone) || (targetName && customerName === targetName);
    });

    return found ? found.id_nasabah : '-';
}

function canReverseOldMoneyTransaction(trx, stock, cash) {
    if (!trx || !Array.isArray(trx.items)) {
        return { ok: false, message: 'Data transaksi lama tidak valid untuk diedit.' };
    }

    if (trx.type === 'BELI') {
        for (const oldItem of trx.items) {
            const stockItem = stock.find(item => item.id === oldItem.itemId);
            const currentQty = stockItem ? (parseInt(stockItem.qty) || 0) : 0;
            if (currentQty < (parseInt(oldItem.qty) || 0)) {
                return {
                    ok: false,
                    message: `Transaksi ${trx.id} belum bisa diedit karena stok ${oldItem.itemDesc || oldItem.itemId} sudah terpakai.`
                };
            }
        }
    }

    if (trx.type === 'JUAL' && cash < (parseInt(trx.totalRp) || 0)) {
        return {
            ok: false,
            message: `Transaksi ${trx.id} belum bisa diedit karena kas koin saat ini tidak cukup untuk membalik transaksi jual tersebut.`
        };
    }

    return { ok: true };
}

function reverseOldMoneyTransactionEffect(trx, stock, cash) {
    let nextCash = cash;

    trx.items.forEach(oldItem => {
        const itemIdx = stock.findIndex(item => item.id === oldItem.itemId);
        if (itemIdx === -1) return;

        if (trx.type === 'BELI') {
            stock[itemIdx].qty -= parseInt(oldItem.qty) || 0;
        } else if (trx.type === 'JUAL') {
            stock[itemIdx].qty += parseInt(oldItem.qty) || 0;
        }
    });

    if (trx.type === 'BELI') {
        nextCash += parseInt(trx.totalRp) || 0;
    } else if (trx.type === 'JUAL') {
        nextCash -= parseInt(trx.totalRp) || 0;
    }

    return nextCash;
}

function clearOldMoneyEditState() {
    window.oldMoneyEditingTrxId = null;
    window.oldMoneyEditingTrxTimestamp = null;
    updateOldMoneyCheckoutButton();
}

function getEditableOldMoneyStockQty(itemId) {
    const stock = getOldMoneyStock();
    const stockItem = stock.find(item => item.id === itemId);
    let availableQty = stockItem ? (parseInt(stockItem.qty) || 0) : 0;

    if (!window.oldMoneyEditingTrxId) {
        return availableQty;
    }

    const trx = getOldMoneyTrxs().find(item => item.id === window.oldMoneyEditingTrxId);
    if (!trx || trx.type !== 'JUAL' || !Array.isArray(trx.items)) {
        return availableQty;
    }

    const oldItem = trx.items.find(item => item.itemId === itemId);
    return availableQty + (oldItem ? (parseInt(oldItem.qty) || 0) : 0);
}

// 1. Navigation Init Hook
window.initOldMoneyView = function() {
    window.loadOldMoneyDashboard();
    window.loadOldMoneyItems();
    window.loadOldMoneyCustomerSelect();
    window.setOldMoneyStockCategory(window.oldMoneyActiveStockCategory || 'KOIN');
    window.handleOldMoneyCategoryChange(window.oldMoneyActiveFormCategory || 'KOIN');
    window.loadOldMoneyStockTable();
    window.loadOldMoneyTrxTable();
    updateOldMoneyCheckoutButton();
}

window.setOldMoneyStockCategory = function(category) {
    window.oldMoneyActiveStockCategory = normalizeOldMoneyCategory(category);
    const isKoin = window.oldMoneyActiveStockCategory === 'KOIN';
    const tabKoin = document.getElementById('oldMoneyStockTabKoin');
    const tabUangLama = document.getElementById('oldMoneyStockTabUangLama');

    if (tabKoin) {
        tabKoin.style.background = isKoin ? '#f59e0b' : 'transparent';
        tabKoin.style.color = isKoin ? '#0f172a' : '#cbd5e1';
    }
    if (tabUangLama) {
        tabUangLama.style.background = !isKoin ? '#f59e0b' : 'transparent';
        tabUangLama.style.color = !isKoin ? '#0f172a' : '#cbd5e1';
    }

    window.loadOldMoneyStockTable();
}

window.handleOldMoneyCategoryChange = function(category = null) {
    const categorySelect = document.getElementById('oldMoneyTrxCategory');
    const nextCategory = normalizeOldMoneyCategory(category || categorySelect?.value || 'KOIN');
    window.oldMoneyActiveFormCategory = nextCategory;
    if (categorySelect) categorySelect.value = nextCategory;

    const qtyLabel = document.getElementById('oldMoneyQtyLabel');
    const valasLabel = document.getElementById('oldMoneyValasLabel');
    const valasInput = document.getElementById('oldMoneyValas');
    const hint = document.getElementById('oldMoneyCategoryHint');

    if (qtyLabel) qtyLabel.textContent = nextCategory === 'KOIN' ? 'Keping/Lembar' : 'Qty/Lembar';
    if (valasLabel) valasLabel.textContent = 'Jumlah Valas';
    if (valasInput) {
        valasInput.readOnly = true;
        valasInput.style.background = 'rgba(148, 163, 184, 0.08)';
        valasInput.placeholder = 'Otomatis dari keping/qty x nominal';
    }
    if (hint) {
        hint.textContent = nextCategory === 'KOIN'
            ? 'Mode Koin aktif. Jumlah valas dihitung otomatis dari keping x nominal item.'
            : 'Mode Uang Lama aktif. Jumlah valas dihitung otomatis dari qty x nominal item.';
    }

    window.loadOldMoneyItems();
    window.autoFillOldMoneyKurs();
}

window.handleOldMoneyMoneyFocus = function(input) {
    if (!input) return;
    const value = parseOldMoneyFormattedNumber(input.value);
    input.value = value ? String(value).replace('.', ',') : '';
}

window.handleOldMoneyMoneyTyping = function(input) {
    if (!input) return;
    input.value = input.value.replace(/[^\d,.-]/g, '');
    window.calculateOldMoneyForm();
}

window.handleOldMoneyMoneyBlur = function(input, kind = 'decimal') {
    if (!input) return;
    const value = parseOldMoneyFormattedNumber(input.value);
    input.value = formatOldMoneyNumericDisplay(value, kind);
    window.calculateOldMoneyForm();
}

window.openOldMoneyIsoModal = function() { window.openIso4217Modal('old-money'); }
window.closeOldMoneyIsoModal = function() { window.closeIso4217Modal(); }
window.loadOldMoneyIsoTable = function() { window.loadIso4217ModalTable(); }
window.useOldMoneyIsoCode = function(code, currencyName = '', country = '') {
    window.applyIso4217ToOldMoneyForm(code, country, currencyName);
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

window.previewOldMoneyItemPhoto = function(input) {
    const preview = document.getElementById('modalOldItemPhotoPreview');
    const placeholder = document.getElementById('modalOldItemPhotoPlaceholder');
    if (!preview || !placeholder) return;

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            window.currentOldMoneyItemPhotoBase64 = e.target.result;
            preview.src = e.target.result;
            preview.style.display = 'block';
            preview.style.cursor = 'zoom-in';
            preview.onclick = () => window.openGlobalImagePreview(e.target.result);
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

window.previewOldMoneySupplierPhoto = function(input) {
    const preview = document.getElementById('modalOldSupplierPhotoPreview');
    const placeholder = document.getElementById('modalOldSupplierPhotoPlaceholder');
    if (!preview || !placeholder || !input.files?.[0]) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        window.currentOldMoneySupplierPhotoBase64 = e.target.result;
        preview.src = e.target.result;
        preview.style.display = 'block';
        preview.style.cursor = 'zoom-in';
        preview.onclick = () => window.openGlobalImagePreview(e.target.result);
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(input.files[0]);
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
    
    const elCash = document.getElementById('oldMoneyCashTotal');
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
            document.getElementById('modalOldSupplierCategory').value = normalizeOldMoneyCategory(sup.category || 'KOIN');
            document.getElementById('modalOldSupplierCurrency').value = sup.currency || '';
            document.getElementById('modalOldSupplierBuy').value = sup.buyPrice || '';
            document.getElementById('modalOldSupplierSell').value = sup.sellPrice || '';
            document.getElementById('modalOldSupplierNotes').value = sup.notes || '';
            window.currentOldMoneySupplierPhotoBase64 = sup.photo || null;
        }
    } else {
        document.getElementById('modalOldSupplierName').value = '';
        document.getElementById('modalOldSupplierCategory').value = 'KOIN';
        document.getElementById('modalOldSupplierCurrency').value = '';
        document.getElementById('modalOldSupplierBuy').value = '';
        document.getElementById('modalOldSupplierSell').value = '';
        document.getElementById('modalOldSupplierNotes').value = '';
        window.currentOldMoneySupplierPhotoBase64 = null;
    }
    const photoInput = document.getElementById('modalOldSupplierPhoto');
    const photoPreview = document.getElementById('modalOldSupplierPhotoPreview');
    const photoPlaceholder = document.getElementById('modalOldSupplierPhotoPlaceholder');
    if (photoInput) photoInput.value = '';
    if (photoPreview && window.currentOldMoneySupplierPhotoBase64) {
        photoPreview.src = window.currentOldMoneySupplierPhotoBase64;
        photoPreview.style.display = 'block';
        photoPreview.style.cursor = 'zoom-in';
        photoPreview.onclick = () => window.openGlobalImagePreview(window.currentOldMoneySupplierPhotoBase64);
        if (photoPlaceholder) photoPlaceholder.style.display = 'none';
    } else {
        if (photoPreview) { photoPreview.src = ''; photoPreview.style.display = 'none'; photoPreview.onclick = null; }
        if (photoPlaceholder) photoPlaceholder.style.display = 'flex';
    }
    window.loadOldMoneySupplierNameOptions();
    window.loadOldMoneySupplierCurrencyOptions();
    window.loadOldMoneySupplierTable();
    document.getElementById('oldMoneySupplierModal').style.display = 'block';
}

window.closeOldMoneySupplierModal = function() { 
    const md = document.getElementById('oldMoneySupplierModal');
    if(md) md.style.display = 'none'; 
}

window.saveOldMoneySupplier = async function() {
    const id = document.getElementById('modalOldSupplierId').value;
    const name = document.getElementById('modalOldSupplierName').value.trim();
    const category = normalizeOldMoneyCategory(document.getElementById('modalOldSupplierCategory').value);
    const currency = document.getElementById('modalOldSupplierCurrency').value.trim().toUpperCase();
    const buyPrice = parseInt(document.getElementById('modalOldSupplierBuy').value) || 0;
    const sellPrice = parseInt(document.getElementById('modalOldSupplierSell').value) || 0;
    const notes = document.getElementById('modalOldSupplierNotes').value.trim();

    if (!name) return alert('Nama suplayer wajib diisi!');

    let photo = window.currentOldMoneySupplierPhotoBase64 || null;
    try {
        if (photo && photo.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
            photo = await window.uploadBase64FileToFolder(photo, 'old-money/suppliers', name);
        }
    } catch (uploadError) {
        alert('Gagal upload foto suplayer: ' + (uploadError.message || uploadError));
        return;
    }

    const suppliers = window.getOldMoneySuppliers();
    if (id) {
        const idx = suppliers.findIndex(s => s.id === id);
        if (idx !== -1) {
            suppliers[idx] = { ...suppliers[idx], name, category, currency, buyPrice, sellPrice, notes, photo };
        }
    } else {
        suppliers.push({
            id: 'SUP' + Date.now(),
            name,
            category,
            currency,
            buyPrice,
            sellPrice,
            notes,
            photo
        });
    }

    await window.saveOldMoneySuppliers(suppliers);
    
    document.getElementById('modalOldSupplierId').value = '';
    document.getElementById('modalOldSupplierName').value = '';
    document.getElementById('modalOldSupplierCategory').value = 'KOIN';
    document.getElementById('modalOldSupplierCurrency').value = '';
    document.getElementById('modalOldSupplierBuy').value = '';
    document.getElementById('modalOldSupplierSell').value = '';
    document.getElementById('modalOldSupplierNotes').value = '';
    window.currentOldMoneySupplierPhotoBase64 = null;
    
    window.loadOldMoneySupplierTable();
    window.autoFillOldMoneyKurs();
    alert('Suplayer / Acuan Harga berhasil disimpan!');
}

// 4. Items Master
window.openOldMoneyItemModal = function(id = '') {
    const stock = window.getOldMoneyStock();
    document.getElementById('modalOldItemId').value = id;
    const photoInput = document.getElementById('modalOldItemPhoto');
    const photoPreview = document.getElementById('modalOldItemPhotoPreview');
    const photoPlaceholder = document.getElementById('modalOldItemPhotoPlaceholder');
    if (id) {
        const item = stock.find(s => s.id === id);
        if (item) {
            document.getElementById('modalOldItemCategory').value = normalizeOldMoneyCategory(item.category);
            document.getElementById('modalOldItemCode').value = item.code || '';
            document.getElementById('modalOldItemDesc').value = item.desc || '';
            document.getElementById('modalOldItemBuyPrice').value = item.buyPrice || 0;
            window.currentOldMoneyItemPhotoBase64 = item.photo || null;
            if (photoPreview && item.photo) {
                photoPreview.src = item.photo;
                photoPreview.style.display = 'block';
                photoPreview.style.cursor = 'zoom-in';
                photoPreview.onclick = () => window.openGlobalImagePreview(item.photo);
                if (photoPlaceholder) photoPlaceholder.style.display = 'none';
            } else {
                if (photoPreview) {
                    photoPreview.src = '';
                    photoPreview.style.display = 'none';
                    photoPreview.onclick = null;
                }
                if (photoPlaceholder) photoPlaceholder.style.display = 'flex';
            }
        }
    } else {
        document.getElementById('modalOldItemCategory').value = 'KOIN';
        document.getElementById('modalOldItemCode').value = '';
        document.getElementById('modalOldItemDesc').value = '';
        document.getElementById('modalOldItemBuyPrice').value = '';
        window.currentOldMoneyItemPhotoBase64 = null;
        if (photoPreview) {
            photoPreview.src = '';
            photoPreview.style.display = 'none';
            photoPreview.onclick = null;
        }
        if (photoPlaceholder) photoPlaceholder.style.display = 'flex';
    }
    if (photoInput) photoInput.value = '';
    document.getElementById('oldMoneyItemModal').style.display = 'block';
}

window.closeOldMoneyItemModal = function() { 
    const md = document.getElementById('oldMoneyItemModal');
    if(md) md.style.display = 'none'; 
}

window.saveOldMoneyItem = async function() {
    const id = document.getElementById('modalOldItemId').value;
    const category = normalizeOldMoneyCategory(document.getElementById('modalOldItemCategory').value);
    const code = document.getElementById('modalOldItemCode').value.trim();
    const desc = document.getElementById('modalOldItemDesc').value.trim();
    const buyPrice = parseInt(document.getElementById('modalOldItemBuyPrice').value) || 0;
    let photo = window.currentOldMoneyItemPhotoBase64 || null;

    if (!desc) return alert('Nama spesifik/deskripsi wajib diisi!');

    try {
        if (photo && photo.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
            const safeCode = code || category || 'old-money';
            photo = await window.uploadBase64FileToFolder(photo, 'old-money/items', `${safeCode}-${desc}`);
        }
    } catch (uploadError) {
        alert("Gagal upload foto item: " + (uploadError.message || uploadError));
        return;
    }

    let stock = window.getOldMoneyStock();
    if (id) {
        const idx = stock.findIndex(s => s.id === id);
        if (idx !== -1) {
            stock[idx] = { ...stock[idx], category, code, desc, buyPrice, photo };
        }
    } else {
        stock.push({
            id: 'ITM' + Date.now(),
            category,
            code,
            desc,
            buyPrice,
            qty: 0,
            photo
        });
    }

    try {
        await window.saveOldMoneyStock(stock);
        window.oldMoneyActiveStockCategory = category;
        window.oldMoneyActiveFormCategory = category;
        window.setOldMoneyStockCategory(category);
        window.handleOldMoneyCategoryChange(category);
        window.loadOldMoneyItems();
        window.loadOldMoneyStockTable();
        window.loadOldMoneyDashboard();
        window.closeOldMoneyItemModal();
        alert(`Item master ${getOldMoneyCategoryLabel(category)} berhasil disimpan!`);
    } catch(e) {
        console.error('Gagal menyimpan item master old money:', e);
        alert('Gagal menyimpan item master: ' + (e.message || e));
    }
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

window.saveOldMoneyTopup = async function() {
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

    await window.saveOldMoneyCash(cash);

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
        await window.saveOldMoneyTrxs(trxs);
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
    stock
        .map(item => ({ ...item, category: normalizeOldMoneyCategory(item.category) }))
        .filter(item => item.category === normalizeOldMoneyCategory(window.oldMoneyActiveFormCategory))
        .forEach(item => {
        const categoryLabel = getOldMoneyCategoryLabel(item.category);
        options += `<option value="${item.id}" data-price="${item.buyPrice}">${categoryLabel} - ${item.code ? item.code+' - ' : ''}${item.desc} (Sisa: ${item.qty})</option>`;
        });
    
    select.innerHTML = options;
    
    if (window.jQuery) {
        $(select).trigger('change.select2');
    }
}

window.filterOldMoneySupplierTable = function() {
    window.loadOldMoneySupplierTable();
}

window.setOldMoneySupplierTab = function(category) {
    window.oldMoneySupplierTab = normalizeOldMoneyCategory(category);
    const isKoin = window.oldMoneySupplierTab === 'KOIN';
    const koinTab = document.getElementById('oldMoneySupplierTabKoin');
    const uangLamaTab = document.getElementById('oldMoneySupplierTabUangLama');
    if (koinTab) {
        koinTab.className = isKoin ? 'btn btn-sm' : 'btn btn-sm btn-outline';
        koinTab.style.cssText = isKoin ? 'padding:4px 9px; background:#f59e0b; color:#0f172a; border:none;' : 'padding:4px 9px;';
    }
    if (uangLamaTab) {
        uangLamaTab.className = isKoin ? 'btn btn-sm btn-outline' : 'btn btn-sm';
        uangLamaTab.style.cssText = isKoin ? 'padding:4px 9px;' : 'padding:4px 9px; background:#38bdf8; color:#0f172a; border:none;';
    }
    window.loadOldMoneySupplierTable();
}

window.loadOldMoneySupplierNameOptions = function() {
    const list = document.getElementById('oldMoneySupplierNameList');
    if (!list) return;

    const names = [...new Set(getOldMoneySuppliers()
        .map(supplier => String(supplier.name || '').trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'id'));
    list.innerHTML = names.map(name => `<option value="${name}"></option>`).join('');
}

window.loadOldMoneySupplierCurrencyOptions = function() {
    const list = document.getElementById('oldMoneySupplierCurrencyList');
    if (!list) return;

    const iso = typeof getIso4217Reference === 'function' ? getIso4217Reference() : [];
    list.innerHTML = iso.map(item => `<option value="${item.code}">${item.currencyName || item.country || ''}</option>`).join('');
}

window.loadOldMoneySupplierTable = function() {
    let suppliers = getOldMoneySuppliers();
    const tbody = document.getElementById('oldMoneySupplierTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('modalOldSupplierFilter');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const activeCategory = normalizeOldMoneyCategory(window.oldMoneySupplierTab || 'KOIN');
    suppliers = suppliers.filter(supplier => normalizeOldMoneyCategory(supplier.category || 'KOIN') === activeCategory);

    if (search) {
        const isoReference = typeof getIso4217Reference === 'function' ? getIso4217Reference() : [];
        suppliers = suppliers.filter(s => {
            const currencyCode = String(s.currency || '').trim().toUpperCase();
            const currencyReference = isoReference.find(item => String(item.code || '').toUpperCase() === currencyCode) || {};
            const searchable = [
                s.name,
                s.currency,
                s.notes,
                s.country,
                currencyReference.country,
                currencyReference.currencyName
            ].filter(Boolean).join(' ').toLowerCase();
            return searchable.includes(search);
        });
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada daftar suplayer/pengepul.</td></tr>';
        return;
    }

    suppliers.forEach(s => {
        let cur = s.currency || '-';
        let buy = s.buyPrice ? window.formatIdr(s.buyPrice).replace('Rp ','') : '0';
        let sell = s.sellPrice ? window.formatIdr(s.sellPrice).replace('Rp ','') : '0';
        
        tbody.innerHTML += `
            <tr>
                <td style="white-space:nowrap;">
                    ${s.photo ? `<img src="${s.photo}" alt="" style="width:32px; height:32px; object-fit:cover; border-radius:50%; vertical-align:middle; margin-right:8px;">` : ''}<strong>${s.name}</strong>
                </td>
                <td>${cur}</td>
                <td style="max-width:180px; white-space:normal;">${s.notes || '-'}</td>
                <td style="text-align: right; color: #10b981;">Rp ${buy}</td>
                <td style="text-align: right; color: #ef4444;">Rp ${sell}</td>
                <td style="text-align: center;">
                    ${s.photo ? `<button class="btn btn-sm btn-outline" style="padding:4px 8px; color:#8b5cf6; border-color:#8b5cf6;" onclick="window.showOldMoneySupplierPhoto('${s.id}')" title="Tampilkan foto"><i class="fa-solid fa-image"></i></button>` : ''}
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px; color:#38bdf8; border-color:#38bdf8;" onclick="window.showOldMoneySupplierDetails('${s.id}')" title="Tampilkan detail"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px;" onclick="window.openOldMoneySupplierModal('${s.id}')"><i class="fa-solid fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px; color: #ef4444; border-color: #ef4444;" onclick="window.deleteOldMoneySupplier('${s.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

window.showOldMoneySupplierDetails = function(id) {
    const supplier = getOldMoneySuppliers().find(item => item.id === id);
    if (!supplier) return alert('Data suplayer tidak ditemukan.');

    const category = getOldMoneyCategoryLabel(normalizeOldMoneyCategory(supplier.category || 'KOIN'));
    const buy = window.formatIdr(parseInt(supplier.buyPrice) || 0);
    const sell = window.formatIdr(parseInt(supplier.sellPrice) || 0);
    const detailText = [
        `Kategori: ${category}`,
        `Mata uang: ${supplier.currency || '-'}`,
        `Harga beli: ${buy}`,
        `Harga jual: ${sell}`,
        `Catatan: ${supplier.notes || '-'}`
    ].join('\n');

    if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
        const photo = supplier.photo ? `<img src="${supplier.photo}" alt="Foto suplayer" style="width:96px;height:96px;object-fit:cover;border-radius:8px;margin-bottom:12px;">` : '';
        const escaped = detailText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        Swal.fire({ title: supplier.name || 'Detail Suplayer', html: `${photo}<div style="text-align:left;line-height:1.7;">${escaped}</div>`, confirmButtonText: 'Tutup', background: '#1e293b', color: '#f8fafc' });
        return;
    }
    alert(`${supplier.name || 'Detail Suplayer'}\n\n${detailText}`);
}

window.showOldMoneySupplierPhoto = function(id) {
    const supplier = getOldMoneySuppliers().find(item => item.id === id);
    if (!supplier || !supplier.photo) return alert('Foto suplayer belum tersedia.');
    if (typeof window.openGlobalImagePreview === 'function') {
        window.openGlobalImagePreview(supplier.photo);
        return;
    }
    window.open(supplier.photo, '_blank', 'noopener');
}

function getOldMoneyBaseCurrencyCode(item) {
    const raw = `${item?.code || ''} ${item?.desc || ''}`.toUpperCase();
    const matches = raw.match(/[A-Z]{3}/g);
    return matches ? matches[0] : '';
}

function getOldMoneyCurrencyMeta(item) {
    const baseCode = getOldMoneyBaseCurrencyCode(item);
    const masterCurrencies = typeof getMasterCurrencies === 'function'
        ? getMasterCurrencies()
        : (window.AlmaraApp?.store?.getMasterCurrencies ? window.AlmaraApp.store.getMasterCurrencies() : []);
    const meta = masterCurrencies.find(m => String(m.code || '').toUpperCase() === baseCode) || null;
    return { baseCode, meta };
}

window.deleteOldMoneySupplier = async function(id) {
    if (!confirm('Hapus acuan harga suplayer ini?')) return;
    let suppliers = getOldMoneySuppliers();
    suppliers = suppliers.filter(s => s.id !== id);
    await saveOldMoneySuppliers(suppliers);
    window.loadOldMoneySupplierTable();
    window.autoFillOldMoneyKurs();
}

window.loadOldMoneyStockTable = function() {
    const stock = getOldMoneyStock();
    const tbody = document.getElementById('oldMoneyStockTableBody');
    if (!tbody) return;
    const search = (document.getElementById('oldMoneyStockSearch')?.value || '').toLowerCase().trim();
    const activeCategory = normalizeOldMoneyCategory(window.oldMoneyActiveStockCategory);

    let filteredStock = stock
        .map(item => ({ ...item, category: normalizeOldMoneyCategory(item.category) }))
        .filter(item => item.category === activeCategory);

    if (search) {
        filteredStock = filteredStock.filter(item => {
            const combined = `${item.category} ${item.code || ''} ${item.desc || ''}`.toLowerCase();
            return combined.includes(search);
        });
    }

    tbody.innerHTML = '';
    if (filteredStock.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Belum ada item ${activeCategory === 'KOIN' ? 'koin' : 'uang lama'} yang cocok.</td></tr>`;
        return;
    }

    filteredStock.forEach(item => {
        const stokKeping = parseFloat(item.qty) || 0;
        const stokValas = getOldMoneyStockValasAmount(item);
        const kursRata = parseFloat(item.buyPrice) || 0;
        const totalRp = stokValas * kursRata;
        const currencyInfo = getOldMoneyCurrencyMeta(item);
        const metaLabel = currencyInfo.meta
            ? [currencyInfo.meta.country, currencyInfo.meta.currencyName].filter(Boolean).join(' - ')
            : '';
        // Ekstrak mata uang (kata pertama dari code atau desc)
        let nameStr = (item.code ? item.code : item.desc) || '';
        let currencyCode = nameStr.split(' ')[0] || 'item';
        
        // Membatasi panjangnya agar tidak terlalu panjang, misalnya jika yang terisi "Pecahan"
        if(currencyCode.length > 5 || currencyCode.trim() === '') {
            currencyCode = 'item';
        }

        tbody.innerHTML += `
            <tr>
                <td>
                    <strong>${item.code || currencyCode.toUpperCase()}</strong><br>
                    ${metaLabel ? `<small class="text-muted">${metaLabel}</small><br>` : ''}
                    <small class="text-muted">${item.desc || getOldMoneyCategoryLabel(item.category)}</small>
                </td>
                <td style="text-align: right; font-weight: bold; color: ${stokKeping > 0 ? '#10b981' : '#ef4444'};">${formatOldMoneyNumericDisplay(stokKeping, 'valas')}</td>
                <td style="text-align: right;">${formatOldMoneyNumericDisplay(stokValas, 'valas')}</td>
                <td style="text-align: right;">${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kursRata)}</td>
                <td style="text-align: right; font-weight: 600;">${formatIdr(totalRp)}</td>
                <td style="text-align: center;">
                    ${item.photo ? `<button class="btn btn-sm btn-outline" style="padding:4px 8px; color: #3b82f6; border-color: #3b82f6;" onclick="window.openGlobalImagePreview('${item.photo}')" title="Lihat Foto"><i class="fa-solid fa-eye"></i></button>` : `<button class="btn btn-sm btn-outline" style="padding:4px 8px; opacity: 0.5; cursor: not-allowed;" disabled title="Tidak ada foto"><i class="fa-solid fa-eye-slash"></i></button>`}
                    <button class="btn btn-sm btn-outline" style="padding:4px 8px;" onclick="window.openOldMoneyItemModal('${item.id}')" title="Edit Item"><i class="fa-solid fa-edit"></i></button>
                    ${item.qty === 0 ? `<button class="btn btn-sm btn-outline" style="padding:4px 8px; color: #ef4444; border-color: #ef4444;" onclick="window.deleteOldMoneyItem('${item.id}')" title="Hapus Item"><i class="fa-solid fa-trash"></i></button>` : ''}
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
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Belum ada transaksi.</td></tr>';
        updateOldMoneySelectedCount();
        return;
    }

    trxs.forEach(trx => {
        let typeColor = trx.type === 'JUAL' ? '#10b981' : (trx.type === 'BELI' ? '#ef4444' : '#3b82f6');
        let dt = new Date(trx.date);
        let timeStr = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;

        tbody.innerHTML += `
            <tr>
                <td style="text-align:center;">
                    <input type="checkbox" data-oldmoney-trx-checkbox="1" data-trx-id="${escapeOldMoneyHtml(trx.id)}" ${window.oldMoneySelectedTrxIds.has(trx.id) ? 'checked' : ''} onchange="window.toggleOldMoneyTrxSelection('${trx.id}', this.checked)">
                </td>
                <td>${timeStr}</td>
                <td><small>${trx.id}</small></td>
                <td style="color: ${typeColor}; font-weight: bold;">${trx.type}</td>
                <td>${trx.itemDesc}</td>
                <td style="text-align: right;">${trx.qty}</td>
                <td style="text-align: right; color: ${trx.type === 'JUAL' || trx.type === 'TOPUP' ? '#10b981' : '#ef4444'};">Rp ${window.formatRp(trx.totalRp)}</td>
                <td>${trx.supplier}</td>
                <td style="text-align: center;">
                    ${['JUAL','BELI'].includes(trx.type) ? `
                        <button class="btn btn-sm btn-outline" style="padding:2px 8px;" onclick="window.editOldMoneyTransaction('${trx.id}')" title="Edit transaksi"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn btn-sm btn-outline" style="padding:2px 8px;" onclick="window.printOldMoneyReceiptRaw('${trx.id}')" title="Cetak struk"><i class="fa-solid fa-print"></i></button>
                        <button class="btn btn-sm btn-outline" style="padding:2px 8px; color: #22c55e; border-color: #22c55e;" onclick="window.sendOldMoneyReceiptWhatsApp('${trx.id}')" title="Kirim WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                    ` : '-'}
                    <button class="btn btn-sm btn-outline" style="padding:2px 8px; color:#ef4444; border-color:#ef4444; margin-left:4px;" onclick="window.deleteOldMoneyTransaction('${trx.id}')" title="Hapus transaksi"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    updateOldMoneySelectedCount();
}

window.deleteOldMoneyItem = async function(id) {
    if (!confirm('Hapus item ini selamanya?')) return;
    let stock = getOldMoneyStock();
    stock = stock.filter(s => s.id !== id);
    await saveOldMoneyStock(stock);
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
        const activeCategory = normalizeOldMoneyCategory(item ? item.category : window.oldMoneyActiveFormCategory);
        window.oldMoneyActiveFormCategory = activeCategory;
        const categorySelect = document.getElementById('oldMoneyTrxCategory');
        if (categorySelect) categorySelect.value = activeCategory;
        
        const basePrice = parseInt(opt.getAttribute('data-price')) || 0;
        if(priceHint) priceHint.textContent = activeCategory === 'KOIN'
            ? `Saran Base Modal / pcs: ${formatIdr(basePrice)}`
            : `Saran Base Modal / valas: ${formatIdr(basePrice)}`;

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
            if(kursInput) kursInput.value = formatOldMoneyNumericDisplay(koinKurs, 'rate');
            if(kursHint) kursHint.textContent = activeCategory === 'KOIN'
                ? `Saran Kurs Koin: ${formatIdr(koinKurs)}`
                : `Saran Kurs Uang Lama: ${formatIdr(koinKurs)}`;
        } else {
            if(kursInput) kursInput.value = '';
            if(kursHint) kursHint.textContent = activeCategory === 'KOIN' ? `Saran Kurs Koin: -` : `Saran Kurs Uang Lama: -`;
        }
    } else {
        if(kursInput) kursInput.value = '';
        if(kursHint) kursHint.textContent = 'Kurs Master: -';
        if(priceHint) priceHint.textContent = normalizeOldMoneyCategory(window.oldMoneyActiveFormCategory) === 'KOIN' ? 'Saran Base Modal / pcs: -' : 'Saran Base Modal / valas: -';
    }
    
    calculateOldMoneyForm();
}

window.calculateOldMoneyForm = function() {
    const denomEl = document.getElementById('oldMoneyDenom');
    const qtyEl = document.getElementById('oldMoneyQty');
    const kursEl = document.getElementById('oldMoneyKurs');
    const category = normalizeOldMoneyCategory(window.oldMoneyActiveFormCategory);
    
    const denom = denomEl ? parseFloat(denomEl.value) || 0 : 1;
    const qty = qtyEl ? parseFloat(qtyEl.value) || 0 : 0;
    const kurs = kursEl ? parseOldMoneyFormattedNumber(kursEl.value) : 0;
    const elValas = document.getElementById('oldMoneyValas');
    
    const valasAmt = denom * qty;
    if(elValas) elValas.value = formatOldMoneyNumericDisplay(valasAmt, 'valas');
    
    const totalRp = valasAmt * kurs;
    const elRp = document.getElementById('oldMoneyTotalRp');
    if(elRp) elRp.value = formatOldMoneyNumericDisplay(totalRp, 'idr');
}

window.oldMoneyCart = [];

window.editOldMoneyTransaction = function(trxId) {
    const trxs = getOldMoneyTrxs();
    const trx = trxs.find(item => item.id === trxId);
    if (!trx) return alert('Transaksi tidak ditemukan!');
    if (!['BELI', 'JUAL'].includes(trx.type)) return alert('Hanya transaksi BELI/JUAL yang bisa diedit dari riwayat ini.');
    if (!Array.isArray(trx.items) || trx.items.length === 0) return alert('Rincian item transaksi ini tidak lengkap.');

    const stock = getOldMoneyStock();
    const cash = getOldMoneyCash();
    const reverseCheck = canReverseOldMoneyTransaction(trx, stock, cash);
    if (!reverseCheck.ok) return alert(reverseCheck.message);

    window.oldMoneyEditingTrxId = trx.id;
    window.oldMoneyEditingTrxTimestamp = trx.date || null;
    window.oldMoneyActiveFormCategory = normalizeOldMoneyCategory((trx.items[0] && trx.items[0].category) || 'KOIN');
    window.oldMoneyCart = trx.items.map(item => ({
        itemId: item.itemId,
        itemCode: item.itemCode || '',
        itemDesc: item.itemDesc || trx.itemDesc || '',
        denom: parseFloat(item.denom) || 1,
        valasAmt: parseFloat(item.valasAmt) || ((parseFloat(item.denom) || 1) * (parseFloat(item.qty) || 0)),
        kurs: parseFloat(item.kurs) || 0,
        qty: parseInt(item.qty) || 0,
        totalRp: parseInt(item.totalRp) || 0,
        type: trx.type,
        supplierId: item.supplierId || trx.supplierId || null,
        supplierName: item.supplierName || trx.supplier || '',
        supplierPhone: item.supplierPhone || trx.supplierPhone || '-',
        priceSource: item.priceSource || (trx.supplierId ? 'SUPPLIER' : 'MASTER_ITEM'),
        buyPrice: parseInt(item.buyPrice) || 0,
        category: normalizeOldMoneyCategory(item.category || 'KOIN')
    }));

    const typeEl = document.getElementById('oldMoneyTrxType');
    if (typeEl) typeEl.value = trx.type;
    const categoryEl = document.getElementById('oldMoneyTrxCategory');
    if (categoryEl) categoryEl.value = window.oldMoneyActiveFormCategory;
    window.handleOldMoneyCategoryChange(window.oldMoneyActiveFormCategory);

    const customerEl = document.getElementById('oldMoneyCustomer');
    if (customerEl) {
        customerEl.value = findCustomerIdByOldMoneyTrx(trx);
        if (window.jQuery) {
            $(customerEl).trigger('change.select2');
        }
    }
    renderOldMoneyCart();
    updateOldMoneyCheckoutButton();
    window.autoFillOldMoneyKurs();
    alert(`Transaksi ${trx.id} dimuat ke form edit. Ubah data yang diperlukan lalu klik tombol checkout untuk menyimpan revisi.`);
};

function addToOldMoneyCart() {
    const type = document.getElementById('oldMoneyTrxType').value;
    const itemId = document.getElementById('oldMoneyItem').value;
    const category = normalizeOldMoneyCategory(window.oldMoneyActiveFormCategory);
    const denom = parseFloat(document.getElementById('oldMoneyDenom').value) || 0;
    const qty = parseInt(document.getElementById('oldMoneyQty').value) || 0;
    const valasAmt = parseOldMoneyFormattedNumber(document.getElementById('oldMoneyValas').value);
    const kurs = parseOldMoneyFormattedNumber(document.getElementById('oldMoneyKurs').value);
    const totalRp = Math.round(parseOldMoneyFormattedNumber(document.getElementById('oldMoneyTotalRp').value));

    if (!itemId) return alert('Pilih master item/koin terlebih dahulu!');
    if (qty <= 0) return alert('Jumlah unit > 0!');
    if (totalRp <= 0) return alert('Total kesepakatan bernilai > 0!');

    const stock = getOldMoneyStock();
    const item = stock.find(s => s.id === itemId);
    if (!item) return alert('Item invalid!');
    
    // Check stock if JUAL
    if (type === 'JUAL') {
        const currentQtyInCart = window.oldMoneyCart.filter(i => i.itemId === itemId).reduce((sum, item) => sum + item.qty, 0);
        const availableQty = getEditableOldMoneyStockQty(itemId);
        if (availableQty < (qty + currentQtyInCart)) return alert(`Stok koin tidak cukup! Sisa: ${availableQty - currentQtyInCart}`);
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
        type: type,
        category
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
    window.handleOldMoneyCategoryChange(window.oldMoneyActiveFormCategory);
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

async function processOldMoneyCheckout() {
    if (window.oldMoneyCart.length === 0) return alert('Keranjang kosong!');
    
    // Validasi satu tipe (BELI atau JUAL)
    const formsType = window.oldMoneyCart[0].type;
    const mixedType = window.oldMoneyCart.some(i => i.type !== formsType);
    if(mixedType) return alert('Keranjang tidak boleh mencampur item JUAL dan BELI dalam satu checkout!');

    const customerId = document.getElementById('oldMoneyCustomer') ? document.getElementById('oldMoneyCustomer').value : '-';
    let grandTotal = window.oldMoneyCart.reduce((sum, item) => sum + item.totalRp, 0);

    const stock = getOldMoneyStock();
    let cash = getOldMoneyCash();
    let trxs = getOldMoneyTrxs();

    if (window.oldMoneyEditingTrxId) {
        const oldTrx = trxs.find(item => item.id === window.oldMoneyEditingTrxId);
        if (!oldTrx) {
            clearOldMoneyEditState();
            return alert('Transaksi edit lama tidak ditemukan. Silakan ulangi proses edit.');
        }

        const reverseCheck = canReverseOldMoneyTransaction(oldTrx, stock, cash);
        if (!reverseCheck.ok) return alert(reverseCheck.message);

        cash = reverseOldMoneyTransactionEffect(oldTrx, stock, cash);
        trxs = trxs.filter(item => item.id !== oldTrx.id);

        if (typeof window.deleteFromMySQL_Transaction === 'function') {
            await window.deleteFromMySQL_Transaction(window.oldMoneyEditingTrxId);
        }
    }

    if (formsType === 'BELI') {
        if (cash < grandTotal) return alert(`Kas Koin tidak cukup! Butuh ${formatIdr(grandTotal)}, Sisa Kas: ${formatIdr(cash)}`);
    }

    if (formsType === 'JUAL') {
        for (const cartItem of window.oldMoneyCart) {
            const stockItem = stock.find(item => item.id === cartItem.itemId);
            const currentQty = stockItem ? (parseInt(stockItem.qty) || 0) : 0;
            if (currentQty < (parseInt(cartItem.qty) || 0)) {
                return alert(`Stok ${cartItem.itemDesc} tidak cukup untuk menyimpan transaksi ini.`);
            }
        }
    }
    
    // Process Cart Items
    window.oldMoneyCart.forEach(cartItem => {
        const itemIdx = stock.findIndex(s => s.id === cartItem.itemId);
        if(itemIdx !== -1) {
            // Snapshot HPP (Harga Modal / buyPrice) saat ini juga untuk akurasi laba selamanya
            cartItem.buyPrice = stock[itemIdx].buyPrice;

            if (formsType === 'BELI') {
                const prevQty = parseFloat(stock[itemIdx].qty) || 0;
                const prevAvg = parseFloat(stock[itemIdx].buyPrice) || 0;
                const incomingQty = parseFloat(cartItem.qty) || 0;
                const incomingRate = parseFloat(cartItem.kurs) || 0;
                const combinedQty = prevQty + incomingQty;
                if (combinedQty > 0) {
                    stock[itemIdx].buyPrice = ((prevQty * prevAvg) + (incomingQty * incomingRate)) / combinedQty;
                } else {
                    stock[itemIdx].buyPrice = incomingRate || prevAvg;
                }
                stock[itemIdx].qty += cartItem.qty;
            } else if (formsType === 'JUAL') {
                stock[itemIdx].qty -= cartItem.qty;
            }
            cartItem.buyPrice = stock[itemIdx].buyPrice;
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

    await saveOldMoneyCash(cash);
    await saveOldMoneyStock(stock);

    const firstItemStr = `${window.oldMoneyCart[0].itemCode ? window.oldMoneyCart[0].itemCode+' ' : ''}${window.oldMoneyCart[0].itemDesc}`;
    const descStr = window.oldMoneyCart.length > 1 ? `${firstItemStr} (+${window.oldMoneyCart.length - 1} lainnya)` : firstItemStr;
    const totalQty = window.oldMoneyCart.reduce((sum, item) => sum + item.qty, 0);

    const newTrx = {
        id: window.oldMoneyEditingTrxId || nextOldMoneyTrxId(trxs),
        date: window.oldMoneyEditingTrxTimestamp || new Date().toISOString(),
        type: formsType,
        itemDesc: descStr,
        qty: totalQty,
        totalRp: grandTotal,
        supplier: counterpartName,
        supplierPhone: counterpartPhone,
        supplierCitizenship: counterpartCitizenship,
        counterpartType: 'CUSTOMER',
        customerId: customerId !== '-' ? customerId : null,
        cashBalanceAfter: cash,
        items: [...window.oldMoneyCart]
    };
    if (window.oldMoneyEditingTrxId) {
        newTrx.editedAt = new Date().toISOString();
    }

    trxs.unshift(newTrx);
    await saveOldMoneyTrxs(trxs);

    // Reset UI
    window.oldMoneyCart = [];
    renderOldMoneyCart();

    if (document.getElementById('oldMoneyCustomer')) {
        document.getElementById('oldMoneyCustomer').value = '-';
        if (window.jQuery) $('#oldMoneyCustomer').trigger('change.select2');
    }

    clearOldMoneyEditState();

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
    const addressToShow = (profile.address && profile.address.toLowerCase() !== 'pusat valuta asing terpercaya') ? profile.address : '';

    const htmlCetak = `
    <html>
    <head>
        <title>Struk Transaksi - ${trx.id}</title>
        <style>
            @page { size: 9cm 14cm; margin: 0; }
            html, body { margin: 0; padding: 0; min-height: 100%; }
            body { font-family: 'Courier New', Courier, monospace; width: 9cm; margin: 0; padding: 0.4cm 0.4cm 0.5cm; box-sizing: border-box; font-size: 10px; color: #000; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .header-mc { font-size: 13px; margin-bottom: 5px; }
            .divider { border-top: 1px dashed #000; margin: 4px 0; }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
        </style>
    </head>
    <body onload="window.print(); window.close();">
        <div class="text-center font-bold header-mc">${profile.name}</div>
        ${profile.biLicense ? `<div class="text-center" style="font-size: 9px; font-weight: bold; margin-bottom: 5px;">Izin BI: ${profile.biLicense}</div>` : ''}
        ${addressToShow ? `<div class="text-center" style="font-size: 9px;">${addressToShow}</div>` : ''}
        <div class="text-center" style="font-size: 9px;">Telp/WA: ${profile.phone || '-'}</div>
        <div class="divider"></div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 10px;">
            <tr><td style="width: 60px; padding: 2px 0;">No Inv</td><td style="padding: 2px 0;">: ${trx.id}</td></tr>
            <tr><td style="padding: 2px 0;">Tanggal</td><td style="padding: 2px 0;">: ${dateStr}</td></tr>
            <tr><td style="padding: 2px 0;">Pihak</td><td style="padding: 2px 0;">: ${trx.supplier}</td></tr>
            <tr><td style="padding: 2px 0;">No Tlp</td><td style="padding: 2px 0;">: ${maskedPhone}</td></tr>
        </table>
        
        <div class="divider"></div>
        <div style="margin-bottom: 6px; font-weight: bold; font-size: 11px;">Rincian Transaksi (${trx.qty} pcs):</div>
        ${itemsHtml}
        
        <div class="divider"></div>
        <div class="row font-bold" style="font-size: 12px;">
            <span>TOTAL:</span>
            <span>Rp ${new Intl.NumberFormat('id-ID').format(trx.totalRp)}</span>
        </div>
        
        <div class="divider"></div>
        <div class="text-center" style="font-size: 8.5px; margin-bottom: 5px;">
            <p>Terima kasih atas kunjungan Anda.</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 9px; text-align: center; margin-top: 5px;">
            <div style="width: 45%;">
                <p style="margin-bottom: 25px;">Petugas,</p>
                <p style="font-weight: bold; text-decoration: underline;">${adminName}</p>
            </div>
            <div style="width: 45%;">
                <p style="margin-bottom: 25px;">Penerima,</p>
                <p style="font-weight: bold; text-decoration: underline;">${trx.supplier}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    printWindow.document.write(htmlCetak);
    printWindow.document.close();
}

window.sendOldMoneyReceiptWhatsApp = async function(trxId) {
    const trxs = getOldMoneyTrxs();
    const trx = trxs.find(item => item.id === trxId);
    if (!trx) return alert('Transaksi tidak ditemukan!');

    const phone = normalizeOldMoneyPhone(trx.supplierPhone);
    if (!phone) return alert('Nomor WhatsApp nasabah belum tersedia pada transaksi ini.');

    const profile = getProfile();
    const dt = new Date(trx.date);
    const dateStr = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
    const itemsArray = Array.isArray(trx.items) ? trx.items : [];

    let itemsText = '';
    itemsArray.forEach((item, index) => {
        itemsText += `${index + 1}. ${item.itemCode ? item.itemCode + ' ' : ''}${item.itemDesc}\n`;
        itemsText += `   ${item.qty} pcs x Rp ${formatRp(item.kurs || 0)} = Rp ${formatRp(item.totalRp || 0)}\n`;
    });

    const fallbackText = [
        `Halo ${trx.supplier || 'Pelanggan'},`,
        '',
        `Berikut rincian transaksi koin & uang lama dari ${profile.name || 'MC Almara'}:`,
        `No. Invoice: ${trx.id}`,
        `Tanggal: ${dateStr}`,
        `Tipe: ${trx.type}`,
        '',
        itemsText.trim(),
        '',
        `Total: Rp ${formatRp(trx.totalRp || 0)}`,
        '',
        'Terima kasih.'
    ].filter(Boolean).join('\n');

    const text = window.buildWaMessageForPurpose('old-money', fallbackText, {
        customerName: trx.supplier || 'Pelanggan', invoice: trx.id, date: dateStr,
        currencyList: itemsText.trim(), total: `Rp ${formatRp(trx.totalRp || 0)}`
    });

    try {
        await window.sendWhatsAppGateway(phone, text, { reference: trx.id });
        alert('Bukti transaksi berhasil dikirim melalui WA Gateway.');
    } catch (error) {
        alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
    }
};

// ==============================
// HRIS MODULE LOGIC
// ==============================

// Tab Switching
window.switchHrisTab = function(tabName) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const role = user ? getAccessRoleForUserRole(user.role) : 'kasir';
    const permissions = typeof getRolePermissions === 'function' ? getRolePermissions() : {};
    const roleConfig = permissions[role] || {};
    const canManageHris = Array.isArray(roleConfig.menus) && roleConfig.menus.includes('hris-view');
    if (!canManageHris && tabName !== 'leave') {
        tabName = 'leave';
    }

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
    const escapeHrisText = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    tbody.innerHTML = emps.map(e => `
        <tr>
            <td><strong>${e.nik}</strong></td>
            <td>${e.name}</td>
            <td>${e.role}</td>
            <td style="text-align:right;">
                <span class="text-green">${formatIdr(e.salary)}</span>/bln<br>
                <small class="text-muted">+ ${formatIdr(e.food)}/hr</small>
            </td>
            <td style="max-width: 220px; white-space: normal;">${e.notes ? escapeHrisText(e.notes) : '<span class="text-muted">-</span>'}</td>
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
            const renderHrisFilePreview = (targetId, fileUrl, label) => {
                if(!fileUrl) return;
                const isPdf = String(fileUrl).startsWith('data:application/pdf') || String(fileUrl).toLowerCase().includes('.pdf');
                document.getElementById(targetId).innerHTML = isPdf
                    ? `<span class="badge bg-info"><i class="fa-solid fa-file-pdf"></i> ${label} PDF Tersimpan</span>`
                    : `<img src="${fileUrl}" style="height:80px; border-radius:4px; border:1px solid #4ade80;">`;
            };

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
            document.getElementById('modalHrisEmpNotes').value = e.notes || '';
            
            // Show previews if they exist
            renderHrisFilePreview('previewEmpPhoto', e.photo, 'Foto');
            renderHrisFilePreview('previewEmpPhotoFull', e.photoFull, 'Foto Full Body');
            renderHrisFilePreview('previewEmpKtp', e.ktp, 'KTP');
            renderHrisFilePreview('previewEmpSim', e.sim, 'SIM');
            renderHrisFilePreview('previewEmpIjazah', e.ijazah, 'Ijazah');
            
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
        document.getElementById('modalHrisEmpNotes').value = '';
        
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

async function uploadHrisStoredFile(value, category, filename) {
    if(!value || typeof window.uploadBase64FileToFolder !== 'function') return value || '';
    return window.uploadBase64FileToFolder(value, category, filename);
}

function mapHrisEmployeeRoleToAccessRole(role) {
    const cleanRole = String(role || '').toLowerCase();
    if(cleanRole.includes('supervisor')) return 'supervisor';
    if(cleanRole.includes('admin')) return 'admin';
    if(cleanRole.includes('kasir')) return 'kasir';
    if(cleanRole.includes('teller')) return 'teller';
    if(cleanRole.includes('kurir')) return 'kurir';
    if(cleanRole.includes('keamanan')) return 'keamanan';
    return 'teller';
}

function buildHrisUserId(nik) {
    const safeNik = String(nik || '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    return safeNik ? `hris_${safeNik}` : `hris_${Date.now()}`;
}

async function syncHrisEmployeeToUserAccess(emp) {
    if(!emp || !emp.nik || typeof getUsers !== 'function' || typeof saveUsers !== 'function') return false;

    const username = String(emp.nik).trim();
    const users = getUsers();
    const usernameLower = username.toLowerCase();
    const existingIndex = users.findIndex(u => {
        const sameLinkedEmployee = String(u.hrisNik || '').toLowerCase() === usernameLower;
        const sameUsername = String(u.username || '').toLowerCase() === usernameLower;
        return sameLinkedEmployee || sameUsername;
    });
    const nextUserData = {
        username,
        fullName: emp.name,
        role: mapHrisEmployeeRoleToAccessRole(emp.role),
        password: String(emp.pin || ''),
        photo: emp.photo || '',
        hrisNik: emp.nik,
        hrisEmployee: true,
        hrisStatus: emp.status || 'Aktif'
    };

    if(existingIndex >= 0) {
        users[existingIndex] = {
            ...users[existingIndex],
            ...nextUserData,
            id: users[existingIndex].id || buildHrisUserId(emp.nik)
        };
    } else {
        users.push({
            id: buildHrisUserId(emp.nik),
            ...nextUserData
        });
    }

    saveUsers(users);
    if(typeof loadUsersTable === 'function') loadUsersTable();

    // Simpan pula pada database pengguna agar akun tetap ada setelah refresh
    // dan dapat digunakan untuk login dari perangkat lain.
    try {
        const request = window.authFetch || fetch;
        const remoteUsers = typeof window.refreshServerUsers === 'function'
            ? await window.refreshServerUsers()
            : [];
        const remoteUser = (Array.isArray(remoteUsers) ? remoteUsers : []).find(user =>
            String(user.username || '').toLowerCase() === usernameLower
        );
        const response = await request('api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: remoteUser?.id || '',
                username,
                fullName: emp.name,
                role: nextUserData.role,
                photo: emp.photo || '',
                password: String(emp.pin || '')
            })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Akun pengguna gagal disimpan ke server.');
        if (result.user) {
            const localIndex = users.findIndex(user => String(user.username || '').toLowerCase() === usernameLower);
            if (localIndex >= 0) users[localIndex] = { ...users[localIndex], ...result.user, ...nextUserData };
            saveUsers(users);
        }
        if(typeof loadUsersTable === 'function') await loadUsersTable();
        return true;
    } catch (error) {
        console.warn('Karyawan tersimpan, tetapi sinkronisasi akun akses belum berhasil:', error);
        return false;
    }
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
    const notes = document.getElementById('modalHrisEmpNotes').value.trim();

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

        bPhoto = await uploadHrisStoredFile(bPhoto, 'hris/photos', `${nik}-foto-close-up`);
        bFull = await uploadHrisStoredFile(bFull, 'hris/photos', `${nik}-foto-full-body`);
        bKtp = await uploadHrisStoredFile(bKtp, 'hris/documents', `${nik}-ktp`);
        bSim = await uploadHrisStoredFile(bSim, 'hris/documents', `${nik}-sim`);
        bIjazah = await uploadHrisStoredFile(bIjazah, 'hris/documents', `${nik}-ijazah`);

        let emps = getHrisEmployees();
        const idx = emps.findIndex(e => e.nik === nik);
        
        const newEmpData = { 
            nik, name, phone, maps, address, role, status, salary, food, pin, notes,
            photo: bPhoto, photoFull: bFull, ktp: bKtp, sim: bSim, ijazah: bIjazah 
        };
        
        if(idx !== -1) {
            emps[idx] = newEmpData;
        } else {
            emps.push(newEmpData);
        }

        saveHrisEmployees(emps);
        const syncedToAccess = await syncHrisEmployeeToUserAccess(newEmpData);
        closeHrisEmployeeModal();
        renderHrisEmployees();
        alert(syncedToAccess
            ? "Data Karyawan berhasil disimpan. Akun login otomatis masuk ke Manajemen Pengguna & Akses."
            : "Data Karyawan tersimpan, tetapi akun akses belum dapat disinkronkan. Pastikan Anda login sebagai Owner atau Superadmin.");
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
function hrisEscapeText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function hrisDateOnly(value) {
    if(!value) return null;
    const date = new Date(value + (String(value).includes('T') ? '' : 'T00:00:00'));
    if(isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function getHrisScheduleCode(entry) {
    if(!entry) return { code: '', className: '', label: '' };
    if(entry.type === 'JADWAL_SHIFT') {
        const shiftName = String(entry.shiftName || 'Shift').toLowerCase();
        let code = 'P';
        let className = 'sch-p';
        if(shiftName.includes('midle') || shiftName.includes('middle')) {
            code = 'M';
            className = 'sch-midle';
        } else if(shiftName.includes('malam') || shiftName.includes('night')) code = 'M';
        else if(shiftName.includes('siang') || shiftName.includes('sore')) {
            code = 'S';
            className = 'sch-shift-s';
        }
        return {
            code,
            className,
            label: `${entry.shiftName || 'Jadwal'} ${entry.startTime || ''}-${entry.endTime || ''}`.trim()
        };
    }
    if(entry.type === 'LIBUR_SHIFT') return { code: 'O', className: 'sch-o', label: 'Libur / Off Shift' };
    if(entry.type === 'CUTI') return { code: 'C', className: 'sch-c', label: 'Cuti' };
    if(entry.type === 'IZIN') return { code: 'I', className: 'sch-i', label: 'Izin' };
    if(entry.type === 'SAKIT') return { code: 'S', className: 'sch-s', label: 'Sakit' };
    return { code: '-', className: 'sch-o', label: entry.type || '-' };
}

function findHrisScheduleForDate(entries, nik, date) {
    const matches = entries.filter(entry => {
        if(entry.nik !== nik) return false;
        const start = hrisDateOnly(entry.startDate);
        const end = hrisDateOnly(entry.endDate);
        return start && end && date >= start && date <= end;
    });
    const priority = { SAKIT: 5, CUTI: 4, IZIN: 3, LIBUR_SHIFT: 2, JADWAL_SHIFT: 1 };
    return matches.sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0))[0] || null;
}

window.renderHrisScheduleCalendar = function() {
    const monthEl = document.getElementById('hrisScheduleMonth');
    const empFilterEl = document.getElementById('hrisScheduleEmployee');
    const head = document.getElementById('hrisScheduleCalendarHead');
    const body = document.getElementById('hrisScheduleCalendarBody');
    if(!monthEl || !empFilterEl || !head || !body) return;

    const todayMonth = new Date().toISOString().slice(0, 7);
    if(!monthEl.value) monthEl.value = todayMonth;

    const employees = getHrisEmployees().filter(e => e.status !== 'Nonaktif');
    const currentFilter = empFilterEl.value || 'ALL';
    empFilterEl.innerHTML = '<option value="ALL">Semua Karyawan</option>' + employees.map(e => `<option value="${e.nik}">${hrisEscapeText(e.name)} (${hrisEscapeText(e.nik)})</option>`).join('');
    empFilterEl.value = Array.from(empFilterEl.options).some(opt => opt.value === currentFilter) ? currentFilter : 'ALL';

    const [year, month] = monthEl.value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const entries = getHrisLeave();
    const shownEmployees = empFilterEl.value === 'ALL' ? employees : employees.filter(e => e.nik === empFilterEl.value);

    const dayHeaders = Array.from({ length: daysInMonth }, (_, idx) => {
        const day = idx + 1;
        const d = new Date(year, month - 1, day);
        const dow = d.toLocaleDateString('id-ID', { weekday: 'short' });
        return `<th class="hris-schedule-day">${day}<br><small>${dow}</small></th>`;
    }).join('');

    head.innerHTML = `<tr><th>Nama</th>${dayHeaders}</tr>`;

    body.innerHTML = shownEmployees.map(emp => {
        const dayCells = Array.from({ length: daysInMonth }, (_, idx) => {
            const d = new Date(year, month - 1, idx + 1);
            d.setHours(0, 0, 0, 0);
            const entry = findHrisScheduleForDate(entries, emp.nik, d);
            const item = getHrisScheduleCode(entry);
            const content = entry
                ? `<span class="sch ${item.className}" title="${hrisEscapeText(item.label)}">${item.code}</span>${entry.type === 'JADWAL_SHIFT' ? `<small>${hrisEscapeText(entry.startTime || '')}</small>` : ''}`
                : '';
            return `<td><div class="hris-schedule-cell">${content}</div></td>`;
        }).join('');

        return `
            <tr>
                <td><strong>${hrisEscapeText(emp.name)}</strong><br><small class="text-muted">${hrisEscapeText(emp.role || emp.nik)}</small></td>
                ${dayCells}
            </tr>
        `;
    }).join('') || `<tr><td colspan="${daysInMonth + 1}" class="text-center text-muted">Belum ada karyawan aktif.</td></tr>`;
};

function buildHrisScheduleCalendarStandaloneHtml(options = {}) {
    const table = document.getElementById('hrisScheduleCalendarTable');
    const month = document.getElementById('hrisScheduleMonth')?.value || new Date().toISOString().slice(0, 7);
    if(!table) return '';

    const [year, monthNum] = month.split('-').map(Number);
    const titleDate = new Date(year, monthNum - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const shouldPrint = options.print === true;
    const shouldDownload = options.download === true;
    const filename = `jadwal-shift-cuti-${month}.jpeg`;

    return `
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Jadwal Shift ${titleDate}</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: Arial, sans-serif;
                    color:#e5e7eb;
                    margin: 0;
                    background: #0f172a;
                }
                .page {
                    padding: 18px;
                    min-width: 980px;
                }
                .topbar {
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:14px;
                    margin-bottom: 12px;
                }
                h2 { margin: 0 0 5px; color:#fff; letter-spacing:0; }
                p { margin: 0; color:#cbd5e1; }
                .actions { display:flex; gap:8px; flex-wrap:wrap; }
                .actions button {
                    border:0;
                    border-radius:6px;
                    padding:9px 12px;
                    background:#2563eb;
                    color:#fff;
                    font-weight:700;
                    cursor:pointer;
                }
                .actions .download {
                    background:#10b981;
                }
                table {
                    width:100%;
                    border-collapse: collapse;
                    font-size: 10px;
                    table-layout: fixed;
                    background:#111827;
                }
                th, td {
                    border:1px solid #334155;
                    padding:5px 3px;
                    text-align:center;
                    vertical-align:middle;
                }
                th {
                    background:#1e293b;
                    color:#bfdbfe;
                }
                th:first-child, td:first-child {
                    width:130px;
                    text-align:left;
                    background:#1e293b;
                    color:#fff;
                }
                .text-muted, small { color:#94a3b8; }
                .sch {
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    min-width:18px;
                    height:18px;
                    padding:1px 4px;
                    border-radius:3px;
                    color:#fff !important;
                    font-weight:800;
                    text-align:center;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .sch-p { background:#2563eb !important; }
                .sch-shift-s { background:#10b981 !important; }
                .sch-midle { background:#8b5cf6 !important; }
                .sch-o { background:#64748b !important; }
                .sch-c { background:#dc2626 !important; }
                .sch-i { background:#f59e0b !important; color:#111827 !important; }
                .sch-s { background:#ec4899 !important; }
                .legend {
                    display:flex;
                    gap:12px;
                    flex-wrap:wrap;
                    margin:12px 0;
                    font-size:12px;
                    color:#e5e7eb;
                }
                .table-shell {
                    overflow:auto;
                    border:1px solid #334155;
                    border-radius:8px;
                }
                .signature {
                    display:flex;
                    justify-content:flex-end;
                    margin-top:28px;
                    font-size:11px;
                    color:#e5e7eb;
                }
                @media (max-width: 900px) {
                    body { overflow-x:auto; }
                    .page { padding:12px; }
                    .topbar { flex-direction:column; }
                    table { font-size:9px; }
                }
                @media print {
                    body { background:#fff; color:#111827; }
                    .page { padding: 0; min-width: 0; width: 100%; }
                    .actions { display:none; }
                    h2, p { color:#111827; text-align:center; }
                    .table-shell { overflow: visible; border: 0; border-radius: 0; }
                    table { background:#fff; color:#111827; font-size:7px; width: 100%; table-layout: fixed; }
                    th:first-child, td:first-child { width: 105px; }
                    th, td { border-color:#334155; color:#111827; }
                    th, th:first-child, td:first-child { background:#e2e8f0 !important; color:#111827; }
                    .legend, .signature { color:#111827; }
                    .sch { min-width: 14px; height: 14px; font-size: 8px; padding: 0 3px; }
                    small { font-size: 7px; }
                    @page { size: A4 landscape; margin: 8mm; }
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="topbar">
                    <div>
                        <h2>JADWAL SHIFT & CUTI KARYAWAN</h2>
                        <p>Periode ${titleDate}</p>
                    </div>
                    <div class="actions">
                        <button class="download" onclick="if(window.opener && window.opener.downloadHrisScheduleCalendarJpeg){ window.opener.downloadHrisScheduleCalendarJpeg(); } else { alert('Buka dari halaman Shift & Cuti lalu klik Download JPEG.'); }">Download JPEG</button>
                        <button onclick="window.print()">Print</button>
                    </div>
                </div>
                <div class="legend">
                    <span><b class="sch sch-p">P</b> Shift/Jadwal</span>
                    <span><b class="sch sch-shift-s">S</b> Shift Siang</span>
                    <span><b class="sch sch-midle">M</b> Shift Midle</span>
                    <span><b class="sch sch-o">O</b> Off</span>
                    <span><b class="sch sch-c">C</b> Cuti</span>
                    <span><b class="sch sch-i">I</b> Izin</span>
                    <span><b class="sch sch-s">S</b> Sakit</span>
                </div>
                <div class="table-shell">${table.outerHTML}</div>
                <div class="signature">
                    <div style="text-align:center; min-width:180px;">
                        Dibuat oleh,<br><br><br>
                        ____________________
                    </div>
                </div>
            </div>
            <script>
                function downloadScheduleJpeg() {
                    var page = document.querySelector('.page');
                    if (!page) return;
                    var clone = page.cloneNode(true);
                    var actions = clone.querySelector('.actions');
                    if (actions) actions.remove();
                    var shell = clone.querySelector('.table-shell');
                    if (shell) {
                        shell.style.overflow = 'visible';
                        shell.style.maxHeight = 'none';
                    }
                    var width = Math.ceil(Math.max(page.scrollWidth, page.offsetWidth, 980));
                    var height = Math.ceil(Math.max(page.scrollHeight, page.offsetHeight, 520));
                    clone.style.position = 'static';
                    clone.style.left = 'auto';
                    clone.style.top = 'auto';
                    clone.style.width = width + 'px';
                    clone.style.background = '#0f172a';
                    var serialized = new XMLSerializer().serializeToString(clone);
                    var styleText = document.querySelector('style') ? document.querySelector('style').textContent : '';
                    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
                        '<foreignObject width="100%" height="100%">' +
                        '<div xmlns="http://www.w3.org/1999/xhtml"><style>' + styleText + '</style>' + serialized + '</div>' +
                        '</foreignObject></svg>';
                    var img = new Image();
                    img.onload = function() {
                        var canvas = document.createElement('canvas');
                        canvas.width = width * 2;
                        canvas.height = height * 2;
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        var link = document.createElement('a');
                        link.download = '${filename}';
                        link.href = canvas.toDataURL('image/jpeg', 0.92);
                        link.click();
                        URL.revokeObjectURL(objectUrl);
                    };
                    img.onerror = function() {
                        alert('Gagal membuat JPEG jadwal. Coba gunakan Print atau buka ulang view jadwal.');
                    };
                    var objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
                    img.src = objectUrl;
                }
                ${shouldDownload ? 'window.onload = function(){ if(window.opener && window.opener.downloadHrisScheduleCalendarJpeg) window.opener.downloadHrisScheduleCalendarJpeg(); };' : ''}
            <\/script>
            ${shouldPrint ? '<script>window.onload = function(){ window.print(); }<\/script>' : ''}
        </body>
        </html>
    `;
}

window.openHrisScheduleCalendarView = function() {
    const html = buildHrisScheduleCalendarStandaloneHtml({ print: false });
    if(!html) return;
    const printWindow = window.open('', '_blank');
    if(!printWindow) return alert('Popup diblokir browser. Izinkan popup untuk membuka view jadwal.');
    printWindow.document.write(html);
    printWindow.document.close();
};

window.printHrisScheduleCalendar = function() {
    const html = buildHrisScheduleCalendarStandaloneHtml({ print: true });
    if(!html) return;
    const printWindow = window.open('', '_blank');
    if(!printWindow) return alert('Popup print diblokir browser. Izinkan popup untuk aplikasi ini.');
    printWindow.document.write(html);
    printWindow.document.close();
};

window.downloadHrisScheduleCalendarJpeg = function() {
    const table = document.getElementById('hrisScheduleCalendarTable');
    const month = document.getElementById('hrisScheduleMonth')?.value || new Date().toISOString().slice(0, 7);
    if(!table) return;

    const [year, monthNum] = month.split('-').map(Number);
    const titleDate = new Date(year, monthNum - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const filename = `jadwal-shift-cuti-${month}.jpeg`;

    const headerCells = Array.from(table.querySelectorAll('thead th'));
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    if(headerCells.length <= 1 || bodyRows.length === 0) {
        alert('Belum ada data jadwal untuk didownload.');
        return;
    }

    const days = headerCells.slice(1).map(th => {
        const parts = th.innerText.trim().split(/\s+/);
        return { day: parts[0] || '', dow: parts[1] || '' };
    });
    const rows = bodyRows.map(tr => {
        const cells = Array.from(tr.children);
        const nameParts = (cells[0]?.innerText || '').trim().split(/\n+/);
        return {
            name: nameParts[0] || '-',
            role: nameParts[1] || '',
            cells: cells.slice(1).map(td => {
                const badge = td.querySelector('.sch');
                const time = td.querySelector('small')?.innerText || '';
                return {
                    code: badge ? badge.innerText.trim() : '',
                    className: badge ? badge.className : '',
                    time
                };
            })
        };
    });

    const scale = 2;
    const width = 1754; // A4 landscape ratio at screen-friendly resolution
    const height = 1240;
    const margin = 28;
    const contentW = width - (margin * 2);
    const nameW = 160;
    const dayW = (contentW - nameW) / days.length;
    const headH = 44;
    const rowH = Math.max(36, Math.min(48, (height - margin - 78 - 34 - headH - 112 - margin) / Math.max(rows.length, 1)));
    const legendH = 34;
    const titleH = 78;
    const signatureH = 92;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const drawText = (text, x, y, options = {}) => {
        ctx.font = `${options.weight || 400} ${options.size || 12}px Arial`;
        ctx.fillStyle = options.color || '#e5e7eb';
        ctx.textAlign = options.align || 'left';
        ctx.textBaseline = options.baseline || 'alphabetic';
        ctx.fillText(String(text || ''), x, y);
    };
    const drawCell = (x, y, w, h, fill = '#111827') => {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    };
    const badgeColor = className => {
        if(className.includes('sch-shift-s')) return '#10b981';
        if(className.includes('sch-midle')) return '#8b5cf6';
        if(className.includes('sch-o')) return '#64748b';
        if(className.includes('sch-c')) return '#dc2626';
        if(className.includes('sch-i')) return '#f59e0b';
        if(className.includes('sch-s')) return '#ec4899';
        return '#2563eb';
    };
    const drawBadge = (code, className, x, y, size = 22) => {
        if(!code) return;
        ctx.fillStyle = badgeColor(className);
        ctx.beginPath();
        const r = 4;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + size - r, y);
        ctx.quadraticCurveTo(x + size, y, x + size, y + r);
        ctx.lineTo(x + size, y + size - r);
        ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
        ctx.lineTo(x + r, y + size);
        ctx.quadraticCurveTo(x, y + size, x, y + size - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();
        drawText(code, x + size / 2, y + size / 2 + 1, {
            size: 12,
            weight: 800,
            color: className.includes('sch-i') ? '#111827' : '#ffffff',
            align: 'center',
            baseline: 'middle'
        });
    };

    drawText('JADWAL SHIFT & CUTI KARYAWAN', margin, margin + 24, { size: 28, weight: 800, color: '#ffffff' });
    drawText(`Periode ${titleDate}`, margin, margin + 54, { size: 18, color: '#cbd5e1' });

    const legend = [
        ['P', 'sch-p', 'Shift/Jadwal'],
        ['S', 'sch-shift-s', 'Shift Siang'],
        ['M', 'sch-midle', 'Shift Midle'],
        ['O', 'sch-o', 'Off'],
        ['C', 'sch-c', 'Cuti'],
        ['I', 'sch-i', 'Izin'],
        ['S', 'sch-s', 'Sakit']
    ];
    let lx = margin;
    const ly = margin + titleH + 2;
    legend.forEach(([code, cls, label]) => {
        drawBadge(code, cls, lx, ly - 15, 20);
        drawText(label, lx + 26, ly, { size: 12, color: '#ffffff' });
        lx += 116;
    });

    let x = margin;
    let y = margin + titleH + legendH;
    drawCell(x, y, nameW, headH, '#1e293b');
    drawText('Nama', x + 8, y + 25, { size: 12, weight: 700, color: '#ffffff' });
    days.forEach((d, idx) => {
        const cx = margin + nameW + (idx * dayW);
        drawCell(cx, y, dayW, headH, '#1e293b');
        drawText(d.day, cx + dayW / 2, y + 17, { size: 12, weight: 800, color: '#bfdbfe', align: 'center' });
        drawText(d.dow, cx + dayW / 2, y + 33, { size: 8, weight: 700, color: '#93c5fd', align: 'center' });
    });

    rows.forEach((row, rowIdx) => {
        const ry = y + headH + (rowIdx * rowH);
        drawCell(margin, ry, nameW, rowH, '#1e293b');
        drawText(row.name, margin + 8, ry + Math.min(20, rowH - 17), { size: 11, weight: 800, color: '#ffffff' });
        drawText(row.role, margin + 8, ry + Math.min(35, rowH - 5), { size: 9, color: '#94a3b8' });
        row.cells.forEach((cell, idx) => {
            const cx = margin + nameW + (idx * dayW);
            drawCell(cx, ry, dayW, rowH, '#111827');
            if(cell.code) {
                const badgeSize = Math.min(20, Math.max(16, dayW - 12));
                drawBadge(cell.code, cell.className, cx + (dayW - badgeSize) / 2, ry + 6, badgeSize);
                drawText(cell.time, cx + dayW / 2, ry + rowH - 7, { size: 8, color: '#93c5fd', align: 'center' });
            }
        });
    });

    const sigY = Math.min(height - margin - 60, y + headH + (rows.length * rowH) + 42);
    drawText('Dibuat oleh,', width - margin - 150, sigY, { size: 12, color: '#ffffff', align: 'center' });
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(width - margin - 220, sigY + 48);
    ctx.lineTo(width - margin - 80, sigY + 48);
    ctx.stroke();

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

window.toggleHrisLeaveScheduleFields = function() {
    const type = document.getElementById('modalHrisLeaveType')?.value;
    const fields = document.getElementById('modalHrisScheduleFields');
    if(fields) fields.style.display = type === 'JADWAL_SHIFT' ? 'block' : 'none';
};

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
        if(l.type === 'JADWAL_SHIFT') badgeColor = 'bg-primary';

        const scheduleText = l.type === 'JADWAL_SHIFT'
            ? `<strong>${l.shiftName || 'Jadwal Kerja'}</strong><br><small class="text-muted">${l.startTime || '--:--'} - ${l.endTime || '--:--'}</small>`
            : '<span class="text-muted">-</span>';

        return `
            <tr>
                <td><strong>${empName}</strong><br><small class="text-muted">${l.nik}</small></td>
                <td>${l.startDate}</td>
                <td>${l.endDate}</td>
                <td>${scheduleText}</td>
                <td style="text-align:center;"><span class="badge ${badgeColor}">${l.type}</span></td>
                <td>${l.remarks}</td>
                <td style="text-align:center;">
                    <button class="btn btn-sm btn-outline text-red" onclick="deleteHrisLeave('${l.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    if(typeof renderHrisScheduleCalendar === 'function') renderHrisScheduleCalendar();
};

window.openHrisLeaveModal = function() {
    document.getElementById('hrisLeaveModal').classList.add('show');
    
    // Populate Employee Select
    const sel = document.getElementById('modalHrisLeaveEmp');
    sel.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + getHrisEmployees().map(e => `<option value="${e.nik}">${e.name} (${e.nik})</option>`).join('');
    
    document.getElementById('modalHrisLeaveId').value = '';
    document.getElementById('modalHrisLeaveType').value = 'JADWAL_SHIFT';
    document.getElementById('modalHrisLeaveShiftName').value = 'Shift Pagi';
    document.getElementById('modalHrisLeaveStartTime').value = '08:00';
    document.getElementById('modalHrisLeaveEndTime').value = '17:00';
    document.getElementById('modalHrisLeaveStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalHrisLeaveEndDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('modalHrisLeaveRemarks').value = '';
    toggleHrisLeaveScheduleFields();
};

window.closeHrisLeaveModal = function() {
    document.getElementById('hrisLeaveModal').classList.remove('show');
};

window.saveHrisLeave = function() {
    const nik = document.getElementById('modalHrisLeaveEmp').value;
    const type = document.getElementById('modalHrisLeaveType').value;
    const startDate = document.getElementById('modalHrisLeaveStartDate').value;
    const endDate = document.getElementById('modalHrisLeaveEndDate').value;
    const shiftName = document.getElementById('modalHrisLeaveShiftName').value.trim();
    const startTime = document.getElementById('modalHrisLeaveStartTime').value;
    const endTime = document.getElementById('modalHrisLeaveEndTime').value;
    const remarks = document.getElementById('modalHrisLeaveRemarks').value;

    if(!nik || !type || !startDate || !endDate) return alert("Pilih Nama, Tipe, dan rentang tanggal dengan lengkap!");
    if(type === 'JADWAL_SHIFT' && (!shiftName || !startTime || !endTime)) {
        return alert("Untuk Schedule / Jadwal Kerja, isi Nama Shift, Jam Masuk, dan Jam Pulang.");
    }

    let leaves = getHrisLeave();
    leaves.push({
        id: 'LV' + Date.now(),
        nik, type, startDate, endDate, shiftName, startTime, endTime, remarks,
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
    const nikInput = document.getElementById('modalCustNik');
    const otherIdInput = document.getElementById('modalCustIdNo');
    if (!nikInput || !otherIdInput) return;

    // Kedua nomor identitas selalu boleh diketik manual. Pemilihan jenis ID
    // hanya mengubah bantuan teks dan tidak lagi mengunci/mengosongkan input.
    nikInput.disabled = false;
    otherIdInput.disabled = false;
    nikInput.readOnly = false;
    otherIdInput.readOnly = false;
    nikInput.placeholder = type === 'KTP'
        ? '16 Digit NIK (bisa diketik manual)'
        : 'NIK (bisa diketik manual)';
    otherIdInput.placeholder = type
        ? `Nomor ${type} / ID lainnya (opsional)`
        : 'Nomor ID lainnya (opsional)';
};

// ==============================
// BOOKING LOGIC
// ==============================
window.openBookingEntryForm = function() {
    const customers = getCustomers();
    const currencies = getCurrencies();
    if(!customers.length) return alert('Data nasabah masih kosong. Tambahkan nasabah terlebih dahulu.');
    if(!currencies.length) return alert('Data valuta masih kosong.');

    const customerOptions = customers.map(c => {
        const id = c.id_nasabah || c.internal_id || '';
        const name = c.nama || c.name || id;
        const phone = c.no_hp || c.phone || '-';
        return `<option value="${id}">${id} - ${name} - ${phone}</option>`;
    }).join('');
    const currencyOptions = currencies.map(c => `<option value="${c.code}">${c.code} - Stok: ${Number(c.stock || 0).toLocaleString()}</option>`).join('');

    Swal.fire({
        title: 'Tambah Booking',
        html: `
            <div style="text-align:left;">
                <style>
                    .booking-form-grid { display:grid; gap:12px; }
                    .booking-form-row { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
                    .booking-field label { display:block; margin:0 0 5px; color:#42564f; font-size:13px; font-weight:700; }
                    .booking-field input, .booking-field select {
                        width:100%; height:40px; box-sizing:border-box; margin:0; padding:8px 10px;
                        border-radius:7px; border:1px solid #bfcfc6;
                        background:#fdfefd; color:#1b302a;
                    }
                    .booking-field input:focus, .booking-field select:focus { outline:none; border-color:#1d6c5d; box-shadow:0 0 0 3px rgba(29,108,93,.14); }
                    .booking-select-search + .select2-container { width:100% !important; }
                    .booking-select-search + .select2-container .select2-selection--single { height:40px !important; border:1px solid #bfcfc6 !important; border-radius:7px !important; background:#fdfefd !important; }
                    .booking-select-search + .select2-container .select2-selection__rendered { line-height:38px !important; color:#1b302a !important; font-size:13px; }
                    @media (max-width: 560px) { .booking-form-row { grid-template-columns: 1fr; } }
                </style>
                <div class="booking-form-grid">
                    <div class="booking-field">
                        <label>Nasabah</label>
                        <select id="bookingCustomer" class="booking-select-search">${customerOptions}</select>
                    </div>
                    <div class="booking-form-row">
                        <div class="booking-field">
                            <label>Tipe</label>
                            <select id="bookingType">
                                <option value="JUAL">JUAL - Valas keluar ke nasabah</option>
                                <option value="BELI">BELI - Valas masuk dari nasabah</option>
                            </select>
                        </div>
                        <div class="booking-field">
                            <label>Valuta</label>
                            <select id="bookingCurrency" class="booking-select-search">${currencyOptions}</select>
                        </div>
                    </div>
                    <div class="booking-form-row">
                        <div class="booking-field">
                            <label>Nominal Valas</label>
                            <input type="number" id="bookingAmount" placeholder="0">
                        </div>
                        <div class="booking-field">
                            <label>Kurs Deal</label>
                            <input type="number" id="bookingRate" placeholder="0">
                        </div>
                    </div>
                    <div class="booking-form-row">
                        <div class="booking-field">
                            <label>DP / Uang Muka (Rp)</label>
                            <input type="number" id="bookingDp" placeholder="0">
                        </div>
                        <div class="booking-field">
                            <label>Jam Kedatangan</label>
                            <input type="datetime-local" id="bookingArrival">
                        </div>
                    </div>
                    <div class="booking-field">
                        <label>Metode DP</label>
                        <select id="bookingPaymentMethod">
                            <option value="CASH">Tunai</option>
                            <option value="BCA">Transfer BCA</option>
                            <option value="MANDIRI">Transfer Mandiri</option>
                        </select>
                    </div>
                </div>
                <div id="bookingPreviewTotal" style="margin-top:10px; color:#176b5b; font-weight:800;">Total: Rp 0 | Sisa: Rp 0</div>
            </div>
        `,
        width: 620,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Simpan Booking',
        denyButtonText: '<i class="fa-solid fa-print"></i> Simpan & Cetak',
        cancelButtonText: 'Tutup',
        background: '#f4f8f5',
        color: '#1b302a',
        confirmButtonColor: '#176b5b',
        denyButtonColor: '#286a91',
        didOpen: () => {
            const typeEl = document.getElementById('bookingType');
            const curEl = document.getElementById('bookingCurrency');
            const amountEl = document.getElementById('bookingAmount');
            const rateEl = document.getElementById('bookingRate');
            const dpEl = document.getElementById('bookingDp');
            const previewEl = document.getElementById('bookingPreviewTotal');
            const arrivalEl = document.getElementById('bookingArrival');
            if (window.jQuery && window.jQuery.fn.select2) {
                const selectOptions = { width: '100%', dropdownParent: window.jQuery('.swal2-popup'), minimumResultsForSearch: 0 };
                window.jQuery('#bookingCustomer').select2({ ...selectOptions, placeholder: 'Cari nasabah...' });
                window.jQuery('#bookingCurrency').select2({ ...selectOptions, placeholder: 'Cari valuta...' });
            }
            if(arrivalEl && !arrivalEl.value) {
                const nextHour = new Date(Date.now() + 60 * 60 * 1000);
                nextHour.setMinutes(0, 0, 0);
                arrivalEl.value = nextHour.toISOString().slice(0, 16);
            }
            const fillRate = () => {
                const cur = currencies.find(c => c.code === curEl.value);
                if(cur && !rateEl.value) rateEl.value = typeEl.value === 'BELI' ? (cur.buy || 0) : (cur.sell || 0);
                updatePreview();
            };
            const updatePreview = () => {
                const total = (parseFloat(amountEl.value) || 0) * (parseFloat(rateEl.value) || 0);
                let dp = parseFloat(dpEl.value) || 0;
                if(dp > total) {
                    dp = total;
                    dpEl.value = total;
                }
                previewEl.textContent = `Total: ${formatIdr(total)} | Sisa: ${formatIdr(Math.max(total - dp, 0))}`;
            };
            typeEl.addEventListener('change', () => { rateEl.value = ''; fillRate(); });
            curEl.addEventListener('change', () => { rateEl.value = ''; fillRate(); });
            amountEl.addEventListener('input', updatePreview);
            rateEl.addEventListener('input', updatePreview);
            dpEl.addEventListener('input', updatePreview);
            fillRate();
        },
        preConfirm: () => {
            const payload = {
                customerId: document.getElementById('bookingCustomer').value,
                tipe: document.getElementById('bookingType').value,
                valuta: document.getElementById('bookingCurrency').value,
                nominal: parseFloat(document.getElementById('bookingAmount').value) || 0,
                rate: parseFloat(document.getElementById('bookingRate').value) || 0,
                dpAmount: parseFloat(document.getElementById('bookingDp').value) || 0,
                expectedArrival: document.getElementById('bookingArrival').value || '',
                paymentMethod: document.getElementById('bookingPaymentMethod').value,
            };
            payload.total = payload.nominal * payload.rate;
            payload.remainingAmount = Math.max(payload.total - payload.dpAmount, 0);
            if(!payload.customerId) return Swal.showValidationMessage('Nasabah wajib dipilih.');
            if(!payload.valuta) return Swal.showValidationMessage('Valuta wajib dipilih.');
            if(payload.nominal <= 0) return Swal.showValidationMessage('Nominal valas wajib lebih dari 0.');
            if(payload.rate <= 0) return Swal.showValidationMessage('Kurs wajib lebih dari 0.');
            if(payload.dpAmount < 0 || payload.dpAmount > payload.total) return Swal.showValidationMessage('DP tidak valid.');
            if(!payload.expectedArrival) return Swal.showValidationMessage('Jam kedatangan wajib diisi.');
            return payload;
        },
        preDeny: () => {
            const payload = {
                customerId: document.getElementById('bookingCustomer').value,
                tipe: document.getElementById('bookingType').value,
                valuta: document.getElementById('bookingCurrency').value,
                nominal: parseFloat(document.getElementById('bookingAmount').value) || 0,
                rate: parseFloat(document.getElementById('bookingRate').value) || 0,
                dpAmount: parseFloat(document.getElementById('bookingDp').value) || 0,
                expectedArrival: document.getElementById('bookingArrival').value || '',
                paymentMethod: document.getElementById('bookingPaymentMethod').value,
                printAfterSave: true
            };
            payload.total = payload.nominal * payload.rate;
            payload.remainingAmount = Math.max(payload.total - payload.dpAmount, 0);
            if(!payload.customerId || !payload.valuta || payload.nominal <= 0 || payload.rate <= 0 || !payload.expectedArrival || payload.dpAmount < 0 || payload.dpAmount > payload.total) {
                Swal.showValidationMessage('Lengkapi data booking yang wajib dan pastikan nominal, kurs, DP, serta jadwal valid.');
                return false;
            }
            return payload;
        }
    }).then(result => {
        if(!result.isConfirmed && !result.isDenied) return;
        const data = result.value;
        const currencies = getCurrencies();
        const curIndex = currencies.findIndex(c => c.code === data.valuta);
        if(curIndex === -1) return alert('Valuta tidak ditemukan.');
        if(data.tipe === 'JUAL' && (parseFloat(currencies[curIndex].stock) || 0) < data.nominal) {
            return alert('Stok valuta tidak mencukupi untuk booking ini.');
        }

        let cash = getCash();
        let bca = getBankBCA();
        let mandiri = getBankMandiri();
        if(data.paymentMethod === 'CASH') cash += data.dpAmount;
        if(data.paymentMethod === 'BCA') bca += data.dpAmount;
        if(data.paymentMethod === 'MANDIRI') mandiri += data.dpAmount;

        if(data.tipe === 'JUAL') currencies[curIndex].stock -= data.nominal;
        else currencies[curIndex].stock += data.nominal;

        const nextBookingId = (() => {
            let seq = parseInt(localStorage.getItem('mc_booking_seq')) || 0;
            seq += 1;
            localStorage.setItem('mc_booking_seq', seq);
            return 'BKG-' + seq.toString().padStart(4, '0');
        })();
        const currentUser = getCurrentUser ? getCurrentUser() : null;
        const row = {
            id: nextBookingId,
            itemId: `${nextBookingId}-${data.valuta}-01`,
            timestamp: new Date().toISOString(),
            tipe: data.tipe,
            valuta: data.valuta,
            nominal: data.nominal,
            rate: data.rate,
            total: data.total,
            customerId: data.customerId,
            paymentMethod: data.paymentMethod,
            expectedArrival: data.expectedArrival,
            kasir: currentUser && currentUser.fullName ? currentUser.fullName : 'Admin Kasir',
            tipe_transaksi: 'BOOKING',
            status: 'PENDING',
            bookingId: nextBookingId,
            invoiceId: null,
            dpAmount: data.dpAmount,
            remainingAmount: data.remainingAmount
        };

        saveCurrencies(currencies);
        saveCash(cash);
        saveBankBCA(bca);
        saveBankMandiri(mandiri);
        saveBookings([...(getBookings ? getBookings() : window.safeArrayGet('mc_bookings')), row]);
        loadBookingsTable();
        if (data.printAfterSave) window.printBookingReceipt(row);
        Swal.fire({icon:'success', title:'Booking tersimpan', text:`Nomor booking: ${nextBookingId}`});
    });
};

window.printBookingReceipt = function(booking) {
    const customers = typeof getCustomers === 'function' ? getCustomers() : [];
    const customer = customers.find(item => (item.id_nasabah || item.internal_id) === booking.customerId) || {};
    const profile = typeof getProfile === 'function' ? getProfile() : {};
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) return alert('Popup cetak diblokir browser. Izinkan popup lalu coba cetak kembali.');
    const customerName = String(customer.nama || customer.name || booking.customerId || '-').replace(/[<>&]/g, '');
    printWindow.document.write(`<!doctype html><html><head><title>${booking.id}</title><style>body{font:13px Arial;color:#111;padding:20px}.head{text-align:center;border-bottom:1px dashed #222;padding-bottom:12px;margin-bottom:12px}table{width:100%;border-collapse:collapse}td{padding:5px 0;vertical-align:top}.total{font-weight:bold;font-size:15px;border-top:1px dashed #222;padding-top:8px}</style></head><body><div class="head"><strong>${String(profile.name || 'MC-ALMARA').replace(/[<>&]/g, '')}</strong><br>BUKTI BOOKING VALAS</div><table><tr><td>No. Booking</td><td>: ${booking.id}</td></tr><tr><td>Nasabah</td><td>: ${customerName}</td></tr><tr><td>Tipe</td><td>: ${booking.tipe}</td></tr><tr><td>Valuta</td><td>: ${booking.valuta} ${Number(booking.nominal || 0).toLocaleString('id-ID')}</td></tr><tr><td>Kurs Deal</td><td>: ${formatIdr(booking.rate || 0)}</td></tr><tr><td>Jadwal Datang</td><td>: ${formatBookingArrival(booking.expectedArrival)}</td></tr><tr><td>Metode DP</td><td>: ${booking.paymentMethod || '-'}</td></tr><tr><td class="total">Total</td><td class="total">: ${formatIdr(booking.total || 0)}</td></tr><tr><td>DP</td><td>: ${formatIdr(booking.dpAmount || 0)}</td></tr><tr><td class="total">Sisa</td><td class="total">: ${formatIdr(booking.remainingAmount || 0)}</td></tr></table><p style="margin-top:24px;text-align:center">Simpan bukti ini untuk pengambilan valas.</p><script>window.onload=function(){window.print();};<\/script></body></html>`);
    printWindow.document.close();
};

window.printBookingReceiptById = function(bookingId) {
    const booking = (typeof getBookings === 'function' ? getBookings() : []).find(item => item.id === bookingId && item.status === 'PENDING');
    if (!booking) return alert('Booking aktif tidak ditemukan.');
    window.printBookingReceipt(booking);
};

function formatBookingArrival(value) {
    if(!value) return '-';
    const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if(Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getBookingCustomer(row, customers) {
    return customers.find(c => String(c.id_nasabah || c.internal_id || '') === String(row.customerId || '')) || null;
}

function normalizeBookingPhone(phone) {
    let clean = String(phone || '').replace(/[^0-9]/g, '');
    if(clean.startsWith('0')) clean = '62' + clean.slice(1);
    if(clean.startsWith('8')) clean = '62' + clean;
    return clean;
}

function getBookingReminderKey(bookingId, expectedArrival) {
    return `booking_arrival_reminder:${bookingId}:${expectedArrival || ''}`;
}

function markBookingReminderSeen(bookingId, expectedArrival) {
    const seen = window.safeArrayGet ? window.safeArrayGet('mc_booking_reminders_seen') : [];
    const key = getBookingReminderKey(bookingId, expectedArrival);
    if(!seen.includes(key)) {
        seen.push(key);
        localStorage.setItem('mc_booking_reminders_seen', JSON.stringify(seen.slice(-300)));
    }
}

function hasBookingReminderSeen(bookingId, expectedArrival) {
    const seen = window.safeArrayGet ? window.safeArrayGet('mc_booking_reminders_seen') : [];
    return seen.includes(getBookingReminderKey(bookingId, expectedArrival));
}

function checkBookingArrivalReminders() {
    const bookings = typeof getBookings === 'function' ? getBookings() : window.safeArrayGet('mc_bookings');
    const customers = typeof getCustomers === 'function' ? getCustomers() : [];
    const now = Date.now();
    const upcoming = bookings.find(row => {
        if(!row || row.status !== 'PENDING' || !row.expectedArrival) return false;
        if(hasBookingReminderSeen(row.id, row.expectedArrival)) return false;
        const arrival = new Date(String(row.expectedArrival).includes('T') ? row.expectedArrival : String(row.expectedArrival).replace(' ', 'T')).getTime();
        if(Number.isNaN(arrival)) return false;
        const diff = arrival - now;
        return diff > 0 && diff <= 15 * 60 * 1000;
    });

    if(!upcoming) return;
    markBookingReminderSeen(upcoming.id, upcoming.expectedArrival);
    const customer = getBookingCustomer(upcoming, customers);
    const customerName = customer ? (customer.nama || customer.name || upcoming.customerId) : (upcoming.customerId || 'Nasabah');
    const message = `Booking ${upcoming.id} atas nama ${customerName} dijadwalkan datang ${formatBookingArrival(upcoming.expectedArrival)}. Siapkan ${Number(upcoming.nominal || 0).toLocaleString('id-ID')} ${upcoming.valuta}.`;

    if(typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Pengingat Booking',
            text: message,
            confirmButtonText: 'Mengerti',
            background: '#1e293b',
            color: '#f8fafc'
        });
    } else {
        alert(message);
    }
}

if(!window.__bookingArrivalReminderTimer) {
    window.__bookingArrivalReminderTimer = setInterval(checkBookingArrivalReminders, 60 * 1000);
    setTimeout(checkBookingArrivalReminders, 3000);
}

window.sendBookingWhatsApp = async function(bookingId) {
    const bookings = typeof getBookings === 'function' ? getBookings() : window.safeArrayGet('mc_bookings');
    const customers = getCustomers();
    const rows = bookings.filter(t => t.id === bookingId && t.status === 'PENDING');
    if(!rows.length) return alert('Booking tidak ditemukan atau sudah tidak aktif.');
    const base = rows[0];
    const customer = getBookingCustomer(base, customers);
    const phone = normalizeBookingPhone(customer ? (customer.no_hp || customer.phone) : '');
    if(!phone) return alert('Nomor WhatsApp nasabah belum tersedia.');

    const customerName = customer ? (customer.nama || customer.name || 'Nasabah') : 'Nasabah';
    const lines = rows.map(t => `- ${t.tipe} ${Number(t.nominal || 0).toLocaleString('id-ID')} ${t.valuta} @ ${formatRate(t.rate || 0)} = ${formatIdr(t.total || 0)}`).join('\n');
    const total = rows.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const dp = parseFloat(base.dpAmount) || 0;
    const remaining = parseFloat(base.remainingAmount) || Math.max(total - dp, 0);
    const fallbackText = [
        `Halo ${customerName},`,
        `Booking valas Anda sudah tercatat.`,
        ``,
        `No Booking: ${bookingId}`,
        `Jam Kedatangan: ${formatBookingArrival(base.expectedArrival)}`,
        lines,
        `Total: ${formatIdr(total)}`,
        `DP: ${formatIdr(dp)}`,
        `Sisa Pelunasan: ${formatIdr(remaining)}`,
        ``,
        `Mohon datang sesuai jadwal. Terima kasih.`
    ].join('\n');
    const text = window.buildWaMessageForPurpose('booking', fallbackText, {
        customerName, invoice: bookingId, date: formatBookingArrival(base.expectedArrival),
        currencyList: lines, total: formatIdr(total), paymentMethod: 'BOOKING',
        paymentDetail: `DP: ${formatIdr(dp)} | Sisa: ${formatIdr(remaining)}`
    });
    try {
        await window.sendWhatsAppGateway(phone, text, { reference: bookingId });
        alert('Pesan booking berhasil dikirim melalui WA Gateway.');
    } catch (error) {
        alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
    }
};

function renderBookingTotalsSummary(pendingBookings) {
    const target = document.getElementById('bookingTotalsSummary');
    if(!target) return;
    const totals = {};
    pendingBookings.forEach(t => {
        const key = `${t.tipe || '-'} ${t.valuta || '-'}`;
        totals[key] = (totals[key] || 0) + (parseFloat(t.nominal) || 0);
    });
    const entries = Object.entries(totals);
    if(entries.length === 0) {
        target.innerHTML = '<div style="color:#94A3B8; padding:10px 0;">Belum ada total valas booking aktif.</div>';
        return;
    }
    target.innerHTML = entries.map(([label, amount]) => `
        <div style="border:1px solid rgba(148,163,184,0.2); background:rgba(15,23,42,0.45); border-radius:8px; padding:10px 12px;">
            <div style="color:#94A3B8; font-size:0.78rem;">Total Valas Booking</div>
            <div style="color:#FBBF24; font-weight:800; font-size:1.05rem;">${amount.toLocaleString('id-ID')} ${label}</div>
        </div>
    `).join('');
}

window.loadBookingsTable = function() {
    const bookings = typeof getBookings === 'function' ? getBookings() : window.safeArrayGet('mc_bookings');
    const customers = getCustomers();
    const tbody = document.getElementById('bookingsTableBody');
    if(!tbody) return;

    // Filter by PENDING status
    const pendingBookings = bookings.filter(t => t.status === 'PENDING');
    renderBookingTotalsSummary(pendingBookings);
    
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
        const customer = customers.find(c => String(c.id_nasabah || c.internal_id || '') === String(baseTrx.customerId || ''));
        const custName = customer ? (customer.nama || customer.name || baseTrx.customerId) : (baseTrx.customerId ? baseTrx.customerId : 'Pengunjung Biasa');
        const custPhone = customer ? (customer.no_hp || customer.phone || '') : '';
        
        return k.toLowerCase().includes(searchTerm) || 
               custName.toLowerCase().includes(searchTerm) || 
               custPhone.toLowerCase().includes(searchTerm);
    });

    let html = '';
    
    if (Object.keys(grouped).length === 0) {
        html = '<tr><td colspan="9" class="text-center">Tidak ada booking aktif / semua sudah lunas.</td></tr>';
    } else if (matchedKeys.length === 0) {
        html = '<tr><td colspan="9" class="text-center">Pencarian tidak menemukan data.</td></tr>';
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
            
            const customer = customers.find(c => String(c.id_nasabah || c.internal_id || '') === String(baseTrx.customerId || ''));
            let custName = customer ? (customer.nama || customer.name || baseTrx.customerId) : (baseTrx.customerId ? baseTrx.customerId : 'Pengunjung Biasa');
            let custPhoneHtml = customer && (customer.no_hp || customer.phone) ? `<br><small class="text-muted"><i class="fa-solid fa-phone"></i> ${customer.no_hp || customer.phone}</small>` : '';
            
            html += `<tr>
                <td>${window.formatDateToDMY(baseTrx.timestamp)}</td>
                <td>${formatBookingArrival(baseTrx.expectedArrival)}</td>
                <td><strong>${baseTrx.id}</strong></td>
                <td>${custName} ${custPhoneHtml}</td>
                <td>${valasSummary}</td>
                <td style="text-align: right;">${formatIdr(Math.abs(totalIdr))}</td>
                <td style="text-align: right; color:#10B981;">${formatIdr(dp)}</td>
                <td style="text-align: right; color:#F87171; font-weight: bold;">${formatIdr(remaining)}</td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-outline" onclick="window.printBookingReceiptById('${baseTrx.id}')" title="Cetak bukti booking"><i class="fa-solid fa-print"></i> Cetak</button>
                    <button class="btn btn-sm btn-success" onclick="sendBookingWhatsApp('${baseTrx.id}')" style="background:#25D366; border:none;" title="Kirim WhatsApp"><i class="fa-brands fa-whatsapp"></i> WA</button>
                    <button class="btn btn-sm btn-primary" onclick="settleBooking('${baseTrx.id}', ${remaining}, ${dp})"><i class="fa-solid fa-file-invoice-dollar"></i> Lunasi & Buat Invoice</button>
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
               <div class="booking-settle-caption">Nominal sisa yang harus dibayar nasabah</div><h3 class="booking-settle-amount">${formatIdr(remainingIdr)}</h3>
               <br>
               Pilih metode masuknya sisa pelunasan:
               <select id="settleMethod" class="swal2-input" style="width: 80%; font-size:16px;">
                   <option value="CASH">Masuk Kas / Tunai</option>
                   <option value="BCA">Transfer (BCA)</option>
                   <option value="MANDIRI">Transfer (Mandiri)</option>
                   <option value="SPLIT">Split (Tunai + Transfer)</option>
               </select>
               <div id="settleSplitContainer" class="booking-settle-split" style="display:none; margin-top:20px; text-align:left; padding: 12px; border-radius: 8px;">
                   <label>Nominal Tunai Masuk:</label>
                   <input type="number" id="settleSplitCash" class="swal2-input" style="width:90%; height:40px; font-size:14px; margin-top: 5px; margin-bottom:10px;" placeholder="0">
                   <label>Nominal Transfer Masuk:</label>
                   <input type="number" id="settleSplitTransfer" class="swal2-input" style="width:90%; height:40px; font-size:14px; margin-top: 5px; margin-bottom:10px;" placeholder="0">
                   <label>Bank Tujuan Transfer:</label>
                   <select id="settleSplitBank" class="swal2-input" style="width:90%; height:40px; font-size:14px; margin-top: 5px;">
                       <option value="BCA">BCA</option>
                       <option value="MANDIRI">Mandiri</option>
                   </select>
               </div>`,
        showCancelButton: true,
        confirmButtonText: 'Terima & Lunasi',
        cancelButtonText: 'Tutup',
        background: '#f4f8f5',
        color: '#1b302a',
        confirmButtonColor: '#176b5b',
        customClass: { popup: 'booking-settlement-modal' },
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
            
            // Convert booking rows into real invoice rows
            let bookings = typeof getBookings === 'function' ? getBookings() : window.safeArrayGet('mc_bookings');
            let trxs = getTransactions();
            let affected = false;
            let invoiceId;
            if (typeof nextPosDocumentId === 'function') {
                invoiceId = nextPosDocumentId('INV', 'mc_invoice_seq');
            } else {
                const seq = (parseInt(localStorage.getItem('mc_invoice_seq')) || 0) + 1;
                localStorage.setItem('mc_invoice_seq', seq);
                invoiceId = 'INV-' + String(seq).padStart(4, '0');
            }
            // Protect invoice integrity if several bookings are settled in one
            // session before the background server sync finishes.
            const usedInvoiceIds = new Set(trxs.map(row => String(row.id || row.invoiceId || '').toUpperCase()));
            while (usedInvoiceIds.has(String(invoiceId).toUpperCase())) {
                const nextSeq = (parseInt(localStorage.getItem('mc_invoice_seq')) || 0) + 1;
                localStorage.setItem('mc_invoice_seq', nextSeq);
                invoiceId = 'INV-' + String(nextSeq).padStart(4, '0');
            }
            
            const updatedRows = [];
            const nextBookings = bookings.map((t, index) => {
                if(t.id === trxId && t.status === 'PENDING') {
                    const invoiceRow = { ...t };
                    const oldItemId = t.itemId || `${trxId}-${index + 1}`;
                    const suffix = String(oldItemId).replace(String(trxId), '').replace(/^-/, '') || String(index + 1).padStart(2, '0');
                    invoiceRow.bookingId = trxId;
                    invoiceRow.conversionSourceBookingId = trxId;
                    invoiceRow.id = invoiceId;
                    invoiceRow.invoiceId = invoiceId;
                    invoiceRow.itemId = `${invoiceId}-${suffix}`;
                    invoiceRow.status = 'LUNAS';
                    invoiceRow.tipe_transaksi = 'CASH';
                    invoiceRow.dpAmount = (invoiceRow.dpAmount || 0) + remainingIdr; // total finally
                    invoiceRow.remainingAmount = 0;
                    invoiceRow.paymentMethod = method === 'CASH' ? 'TUNAI (PELUNASAN DP)' : (method === 'SPLIT' ? 'SPLIT (PELUNASAN)' : 'TRANSFER');
                    if (method === 'BCA' || method === 'MANDIRI') invoiceRow.bank = method;
                    if (method === 'SPLIT') invoiceRow.bank = data.bankTgt;
                    updatedRows.push(invoiceRow);
                    trxs.push(invoiceRow);
                    affected = true;

                    return {
                        ...t,
                        status: 'CONVERTED_TO_INVOICE',
                        bookingStatus: 'CONVERTED_TO_INVOICE',
                        tipe_transaksi: 'BOOKING',
                        invoiceId,
                        remainingAmount: 0,
                    };
                }
                return t;
            });
            
            if(affected) {
                saveTransactions(trxs);
                if (typeof saveBookings === 'function') saveBookings(nextBookings);
                // Cetak struk invoice utama dari data yang baru dipindahkan.
                // Uses the same receipt printer as a regular POS transaction.
                if (typeof window.reprintReceipt === 'function') {
                    window.reprintReceipt(invoiceId);
                }
                if (typeof window.pushTransactionsToMySQL === 'function') {
                    (async () => {
                        try {
                            await window.pushTransactionsToMySQL(updatedRows);
                            if (typeof window.syncFromMySQL_Transactions === 'function') {
                                await window.syncFromMySQL_Transactions({ pushLocal: false, refreshUi: true, silent: true, force: true });
                            }
                        } catch (syncError) {
                            console.warn('Sinkronisasi pelunasan booking gagal:', syncError);
                        }
                    })();
                }
                Swal.fire({icon:'success', title:'Lunas!', text:`Booking ${trxId} telah menjadi invoice ${invoiceId}.`});
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
            let bookings = typeof getBookings === 'function' ? getBookings() : window.safeArrayGet('mc_bookings');
            let currencies = getCurrencies();
            const cancelledRows = [];
            
            bookings.forEach(t => {
                 if(t.id === trxId) {
                     t.status = 'CANCELLED';
                     t.bookingStatus = 'CANCELLED';
                     cancelledRows.push(t);
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
            
            if (typeof saveBookings === 'function') saveBookings(bookings);
            saveCurrencies(currencies);
            Swal.fire({icon:'success', title:'Dibatalkan!', text:'Reservasi dihapus dan stok telah dilepas.'});
            loadBookingsTable();
            if(typeof loadStockMonitor === 'function') loadStockMonitor();
        }
    });
};

