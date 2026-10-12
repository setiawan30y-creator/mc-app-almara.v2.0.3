// Regulatory, accounting, backup, reset, and export helper flows

// ==============================
// LAPORAN LKU (REKAM JEJAK STOK MUNDUR / TIME-TRAVEL ALGORITHM)
// ==============================
function getLkuMonthRange(period) {
    const [year, month] = String(period || '').split('-').map(n => parseInt(n, 10));
    if(!year || !month) return null;
    const lastDate = new Date(year, month, 0).getDate();
    return {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${year}-${String(month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`
    };
}

function getLkuPeriodFromEndDate() {
    const reportPeriod = document.getElementById('lkuReportPeriod')?.value;
    if(reportPeriod) return reportPeriod;
    const biPeriod = document.getElementById('biRatePeriod')?.value;
    if(biPeriod) return biPeriod;
    const endEl = document.getElementById('lkuEndDate');
    const endStr = endEl && endEl.value ? endEl.value : new Date().toISOString().split('T')[0];
    return endStr.substring(0, 7);
}

function applyLkuPeriodToDates(period) {
    const nextPeriod = period || getLkuPeriodFromEndDate();
    const range = getLkuMonthRange(nextPeriod);
    if(!range) return;

    const periodEl = document.getElementById('lkuReportPeriod');
    const startEl = document.getElementById('lkuStartDate');
    const endEl = document.getElementById('lkuEndDate');
    const biPeriodEl = document.getElementById('biRatePeriod');
    if(periodEl) periodEl.value = nextPeriod;
    if(startEl) startEl.value = range.start;
    if(endEl) endEl.value = range.end;
    if(biPeriodEl) biPeriodEl.value = nextPeriod;
}

function syncLkuPeriodFromDates() {
    const endEl = document.getElementById('lkuEndDate');
    const startEl = document.getElementById('lkuStartDate');
    const period = (endEl && endEl.value ? endEl.value : startEl?.value || '').substring(0, 7);
    if(!period) return;
    const periodEl = document.getElementById('lkuReportPeriod');
    const biPeriodEl = document.getElementById('biRatePeriod');
    if(periodEl) periodEl.value = period;
    if(biPeriodEl) biPeriodEl.value = period;
    renderBiRatesTable();
    updateBiRateStatus();
}

function getPreviousMonthPeriod(period) {
    const [year, month] = String(period || '').split('-').map(n => parseInt(n, 10));
    if(!year || !month) return '';
    const date = new Date(year, month - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeBiRateType(type) {
    return type === 'awal' ? 'awal' : 'akhir';
}

function findBiRate(period, currency, type = 'akhir') {
    const code = String(currency || '').substring(0, 3).toUpperCase();
    const expectedType = normalizeBiRateType(type);
    return getBiRates().find(r => {
        const rowType = normalizeBiRateType(r.type || r.rateType || 'akhir');
        return r.period === period && String(r.currency || '').toUpperCase() === code && rowType === expectedType;
    });
}

function findOpeningBiRate(period, currency) {
    const prevPeriod = getPreviousMonthPeriod(period);
    return findBiRate(prevPeriod, currency, 'akhir') || findBiRate(period, currency, 'awal');
}

function hasOpeningBiRate(period, currency) {
    return !!findOpeningBiRate(period, currency);
}

function parseLkuDate(value) {
    const date = new Date(value);
    if(isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function formatLkuDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function cleanLkuNumber(value) {
    if(typeof value === 'number') return value;
    if(!value) return 0;
    let s = String(value).replace(/Rp|\s+/gi, '').trim();
    if(s.includes('.') && s.includes(',')) {
        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        if(lastComma > lastDot) s = s.replace(/\./g, '').replace(/,/g, '.');
        else s = s.replace(/,/g, '');
    } else if(s.includes(',')) {
        const pts = s.split(',');
        if(pts.length === 2 && pts[1].length === 3) s = s.replace(/,/g, '');
        else s = s.replace(/,/g, '.');
    } else if(s.includes('.')) {
        const pts = s.split('.');
        if(pts.length > 2 || (pts.length === 2 && pts[1].length === 3)) s = s.replace(/\./g, '');
    }
    return parseFloat(s) || 0;
}

function getLkuEffectiveDate(endStr) {
    const endDate = parseLkuDate(endStr);
    const today = parseLkuDate(formatLkuDate(new Date()));
    if(!endDate) return today;
    if(today && endDate > today) return today;
    return endDate;
}

function calculateLkuOpeningAverageRate(currency, transactions, endStr) {
    const code = String(currency?.code || '').substring(0, 3).toUpperCase();
    const effectiveDate = getLkuEffectiveDate(endStr);
    if(!code || !effectiveDate) return 0;

    const previousDate = new Date(effectiveDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = formatLkuDate(previousDate);

    const currencyTransactions = transactions
        .map(t => {
            const trxCode = String(t?.valuta || t?.curCode || t?.currency || t?.code || '').toUpperCase();
            if(trxCode !== code) return null;
            const rawDate = t?.timestamp || t?.date || t?.createdAt || t?.created_at;
            const trxDate = parseLkuTransactionDate(rawDate);
            if(!trxDate) return null;
            const dateStr = formatLkuDate(trxDate);
            const type = String(t.tipe || t.type || t.transactionType || '').trim().toUpperCase();
            const nominal = cleanLkuNumber(t.nominal ?? t.amount ?? t.qty ?? t.quantity);
            const rate = cleanLkuNumber(t.rate);
            const total = cleanLkuNumber(t.total ?? t.totalIdr ?? t.totalIDR ?? t.total_rupiah) || (nominal * rate);
            return { dateStr, type, nominal, total, timestamp: trxDate.getTime() };
        })
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp);

    const stockNow = cleanLkuNumber(currency?.stock);
    const netAll = currencyTransactions.reduce((sum, t) => {
        if(t.type === 'BELI' || t.type.includes('BELI')) return sum + t.nominal;
        if(t.type === 'JUAL' || t.type.includes('JUAL')) return sum - t.nominal;
        return sum;
    }, 0);

    const explicitInitialStock = currency?.initialStock ?? currency?.startingStock;
    let qty = explicitInitialStock !== undefined && explicitInitialStock !== null
        ? cleanLkuNumber(explicitInitialStock)
        : Math.max(stockNow - netAll, 0);
    let totalCost = qty * (cleanLkuNumber(currency?.initial_rate_locked) || 0);

    currencyTransactions
        .filter(t => t.dateStr <= previousDateStr)
        .forEach(t => {
            if(t.type === 'BELI' || t.type.includes('BELI')) {
                qty += t.nominal;
                totalCost += t.total;
            } else if(t.type === 'JUAL' || t.type.includes('JUAL')) {
                const avg = qty > 0 ? totalCost / qty : 0;
                qty -= t.nominal;
                totalCost -= t.nominal * avg;
                if(qty < 0) qty = 0;
                if(totalCost < 0) totalCost = 0;
            }
        });

    if(qty > 0) return totalCost / qty;
    return cleanLkuNumber(currency?.initial_rate_locked);
}

function parseLkuTransactionDate(value) {
    if(!value) return null;
    let date = null;
    const parts = String(value).split(/[-/ T]/);
    if(String(value).includes('-') && parts.length >= 3 && parts[0].length === 4) {
        date = new Date(value);
    } else if(parts.length >= 3 && parts[0].length <= 2) {
        date = new Date(`${parts[2].slice(0,4)}-${parts[1]}-${parts[0]}`);
    } else {
        date = new Date(value);
    }
    if(isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function populateBiRateCurrencySelect() {
    const select = document.getElementById('biRateCurrency');
    if(!select) return;
    const codes = Array.from(new Set(getCurrencies()
        .map(c => String(c.code || '').substring(0, 3).toUpperCase())
        .filter(Boolean)))
        .sort();
    select.innerHTML = codes.map(code => `<option value="${code}">${code}</option>`).join('') || '<option value="">Belum ada valuta</option>';
}

function initBiRatesPanel() {
    const periodEl = document.getElementById('biRatePeriod');
    if(!periodEl) return;
    populateBiRateCurrencySelect();
    if(!periodEl.value) periodEl.value = getLkuPeriodFromEndDate();
    const reportPeriodEl = document.getElementById('lkuReportPeriod');
    if(reportPeriodEl && !reportPeriodEl.value) reportPeriodEl.value = periodEl.value;
    renderBiRatesTable();
    updateBiRateStatus();
}

function clearBiRateForm() {
    const period = getLkuPeriodFromEndDate();
    const idEl = document.getElementById('biRateEditId');
    const periodEl = document.getElementById('biRatePeriod');
    const typeEl = document.getElementById('biRateType');
    const valueEl = document.getElementById('biRateValue');
    const noteEl = document.getElementById('biRateNote');
    if(idEl) idEl.value = '';
    if(periodEl) periodEl.value = period;
    if(typeEl) typeEl.value = 'akhir';
    if(valueEl) valueEl.value = '';
    if(noteEl) noteEl.value = 'Kurs Tengah BI Akhir Bulan';
}

function updateBiRateTypeNote() {
    const type = normalizeBiRateType(document.getElementById('biRateType')?.value || 'akhir');
    const noteEl = document.getElementById('biRateNote');
    if(!noteEl) return;
    const defaultNotes = ['Kurs Tengah BI Awal Periode', 'Kurs Tengah BI Akhir Bulan'];
    if(noteEl.value && !defaultNotes.includes(noteEl.value)) return;
    noteEl.value = type === 'awal' ? 'Kurs Tengah BI Awal Periode' : 'Kurs Tengah BI Akhir Bulan';
}

function saveBiRateFromLku() {
    const id = document.getElementById('biRateEditId')?.value || '';
    const period = document.getElementById('biRatePeriod')?.value || '';
    const currency = document.getElementById('biRateCurrency')?.value || '';
    const type = normalizeBiRateType(document.getElementById('biRateType')?.value || 'akhir');
    const rate = parseFloat(document.getElementById('biRateValue')?.value || '0') || 0;
    const note = document.getElementById('biRateNote')?.value || (type === 'awal' ? 'Kurs Tengah BI Awal Periode' : 'Kurs Tengah BI Akhir Bulan');

    if(!period || !currency || rate <= 0) {
        alert('Periode, valuta, dan kurs BI wajib diisi.');
        return;
    }

    let rates = getBiRates();
    const existingIndex = id
        ? rates.findIndex(r => r.id === id)
        : rates.findIndex(r => r.period === period && String(r.currency || '').toUpperCase() === currency && normalizeBiRateType(r.type || r.rateType || 'akhir') === type);
    const next = {
        id: id || `BI-${period}-${currency}-${type}`,
        period,
        currency,
        type,
        rate,
        note,
        updatedAt: new Date().toISOString()
    };

    if(existingIndex >= 0) rates[existingIndex] = next;
    else rates.push(next);

    saveBiRates(rates);
    clearBiRateForm();
    renderBiRatesTable();
    updateBiRateStatus();
    loadLaporanLku();
    alert('Kurs Tengah BI berhasil disimpan.');
}

function editBiRate(id) {
    const rate = getBiRates().find(r => r.id === id);
    if(!rate) return;
    document.getElementById('biRateEditId').value = rate.id;
    document.getElementById('biRatePeriod').value = rate.period;
    document.getElementById('biRateCurrency').value = rate.currency;
    const typeEl = document.getElementById('biRateType');
    if(typeEl) typeEl.value = normalizeBiRateType(rate.type || rate.rateType || 'akhir');
    document.getElementById('biRateValue').value = rate.rate;
    document.getElementById('biRateNote').value = rate.note || '';
}

function deleteBiRate(id) {
    if(!confirm('Hapus kurs BI ini?')) return;
    saveBiRates(getBiRates().filter(r => r.id !== id));
    renderBiRatesTable();
    updateBiRateStatus();
    loadLaporanLku();
}

function renderBiRatesTable() {
    const tbody = document.getElementById('biRatesTableBody');
    if(!tbody) return;
    const currentPeriod = document.getElementById('biRatePeriod')?.value || getLkuPeriodFromEndDate();
    const rates = getBiRates()
        .slice()
        .sort((a, b) => (b.period || '').localeCompare(a.period || '') || String(a.currency).localeCompare(String(b.currency)));
    const visible = rates.filter(r => !currentPeriod || r.period === currentPeriod);
    const fmtRp = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num || 0);

    tbody.innerHTML = visible.map(r => `
        <tr>
            <td>${r.period}</td>
            <td><strong>${r.currency}</strong></td>
            <td>${normalizeBiRateType(r.type || r.rateType || 'akhir') === 'awal' ? 'Awal Periode' : 'Akhir Periode'}</td>
            <td class="text-end">${fmtRp(r.rate)}</td>
            <td>${r.note || '-'}</td>
            <td class="text-center" style="white-space:nowrap;">
                <button type="button" class="btn btn-sm btn-primary mx-1" onclick="editBiRate('${r.id}')"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn btn-sm btn-danger mx-1" onclick="deleteBiRate('${r.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">Belum ada kurs BI untuk periode ini.</td></tr>';
}

function updateBiRateStatus() {
    const statusEl = document.getElementById('biRateStatus');
    if(!statusEl) return;
    const endPeriod = getLkuPeriodFromEndDate();
    const prevPeriod = getPreviousMonthPeriod(endPeriod);
    const codes = Array.from(new Set(getCurrencies().map(c => String(c.code || '').substring(0, 3).toUpperCase()).filter(Boolean))).sort();
    const missingCurrent = codes.filter(code => !findBiRate(endPeriod, code, 'akhir'));
    const missingOpening = codes.filter(code => !hasOpeningBiRate(endPeriod, code));
    statusEl.innerHTML = `Periode laporan: <strong>${endPeriod}</strong>. Kurs awal dari akhir <strong>${prevPeriod}</strong>, atau dari input awal periode jika bulan sebelumnya belum ada. ` +
        `Belum input kurs akhir: <strong style="color:${missingCurrent.length ? '#f59e0b' : '#10b981'};">${missingCurrent.length ? missingCurrent.join(', ') : 'Lengkap'}</strong>. ` +
        `Belum input kurs awal: <strong style="color:${missingOpening.length ? '#f59e0b' : '#10b981'};">${missingOpening.length ? missingOpening.join(', ') : 'Lengkap'}</strong>.`;
}

window.initBiRatesPanel = initBiRatesPanel;
window.clearBiRateForm = clearBiRateForm;
window.saveBiRateFromLku = saveBiRateFromLku;
window.editBiRate = editBiRate;
window.deleteBiRate = deleteBiRate;
window.renderBiRatesTable = renderBiRatesTable;
window.updateBiRateStatus = updateBiRateStatus;
window.updateBiRateTypeNote = updateBiRateTypeNote;
window.applyLkuPeriodToDates = applyLkuPeriodToDates;
window.syncLkuPeriodFromDates = syncLkuPeriodFromDates;

async function loadLaporanLku() {
    try {
        const selectedPeriod = document.getElementById('lkuReportPeriod')?.value || document.getElementById('biRatePeriod')?.value;
        if(selectedPeriod) applyLkuPeriodToDates(selectedPeriod);
        let startStr = document.getElementById('lkuStartDate').value;
        let endStr = document.getElementById('lkuEndDate').value;
        
        // Auto-fill dates if empty so the user always sees something instead of blank blocks
        if(!startStr || !endStr) {
            const period = selectedPeriod || new Date().toISOString().split('T')[0].substring(0, 7);
            const range = getLkuMonthRange(period);
            if(range) {
                startStr = range.start;
                endStr = range.end;
            } else {
                const todayStr = new Date().toISOString().split('T')[0];
                if(!startStr) startStr = todayStr.substring(0, 8) + '01';
                if(!endStr) endStr = todayStr;
            }
            
            document.getElementById('lkuStartDate').value = startStr;
            document.getElementById('lkuEndDate').value = endStr;
            const reportPeriodEl = document.getElementById('lkuReportPeriod');
            if(reportPeriodEl) reportPeriodEl.value = endStr.substring(0, 7);
            const biPeriodEl = document.getElementById('biRatePeriod');
            if(biPeriodEl) biPeriodEl.value = endStr.substring(0, 7);
        }
        
        const trxs = typeof getServerTransactionsLikeRwt === 'function'
            ? await getServerTransactionsLikeRwt()
            : getTransactions();
        const currencies = getCurrencies();
        const endPeriod = endStr.substring(0, 7);
        const prevPeriod = getPreviousMonthPeriod(endPeriod);
        const currencyByCode = {};
        currencies.forEach(c => {
            const code = String(c?.code || '').substring(0, 3).toUpperCase();
            if(code) currencyByCode[code] = c;
        });
        
        let lkuData = {};
        const ensureLkuRow = (rawCode, stock = 0) => {
            const codeMatches = String(rawCode || '').toUpperCase().match(/[A-Z]{3}/g);
            const baseCode = codeMatches ? codeMatches[codeMatches.length - 1] : String(rawCode || '').substring(0, 3).toUpperCase().trim();
            if(!baseCode) return '';
            const openingModalRate = calculateLkuOpeningAverageRate(currencyByCode[baseCode], trxs, endStr);
            const awalRate = openingModalRate || (findOpeningBiRate(endPeriod, baseCode)?.rate || 0);
            const akhirRate = findBiRate(endPeriod, baseCode, 'akhir');
            if(!lkuData[baseCode]) {
                lkuData[baseCode] = {
                    valuta: baseCode,
                    currentStock: 0,
                    kursAwal: parseFloat(awalRate) || 0,
                    kursAkhir: akhirRate ? parseFloat(akhirRate.rate) || 0 : 0,
                    hasKursAwal: !!awalRate,
                    hasKursAkhir: !!akhirRate,
                    sumJualAfter: 0,
                    sumBeliAfter: 0,
                    sumJualPeriod: 0,
                    sumBeliPeriod: 0,
                    sumJualRpPeriod: 0,
                    sumBeliRpPeriod: 0
                };
            }
            lkuData[baseCode].currentStock += (parseFloat(stock) || 0);
            return baseCode;
        };

        currencies.forEach(c => {
            if (!c || !c.code) return;
            ensureLkuRow(c.code, c.stock);
        });
        
        trxs.forEach(t => {
            const trxValuta = t?.valuta || t?.curCode || t?.currency || t?.code;
            const trxTimestamp = t?.timestamp || t?.date || t?.createdAt || t?.created_at;
            if (!t || !trxValuta || !trxTimestamp) return;
            
            // Standardize code: find the 3-letter currency code (e.g. "USD" from "US USD")
            let code = ensureLkuRow(trxValuta, 0);
            if(!code || !lkuData[code]) return;
            
            // Robust Strict DD/MM/YYYY Parsing
            let dObj = parseLkuTransactionDate(trxTimestamp);
            if(!dObj) return;
            
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
            
            let nominal = cleanValArr(t.nominal ?? t.amount ?? t.qty ?? t.quantity);
            let totalRp = cleanValArr(t.total ?? t.totalIdr ?? t.totalIDR ?? t.total_rupiah);
            let rawTipe = String(t.tipe || t.type || t.transactionType || '').trim().toUpperCase();
            
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
        const fmtRate4 = (num) => new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        }).format(num || 0);
        const rateCell = (hasRate, rate, periodLabel) => hasRate
            ? fmtRate4(rate)
            : `<span style="color:#f59e0b;" title="Input kurs BI ${periodLabel}">Belum input</span>`;
        const rateCellAuto = (hasRate, rate, periodLabel) => hasRate
            ? fmtRate4(rate)
            : `<span style="color:#f59e0b;" title="Input kurs BI ${periodLabel}">Belum input</span>`;
        
        Object.keys(lkuData).sort().forEach(code => {
            let d = lkuData[code];
            
            let stokAkhir = d.currentStock + d.sumJualAfter - d.sumBeliAfter;
            let saldoAwal = stokAkhir + d.sumJualPeriod - d.sumBeliPeriod;
            
            let avgBeli = d.sumBeliPeriod > 0 ? (d.sumBeliRpPeriod / d.sumBeliPeriod) : 0;
            let avgJual = d.sumJualPeriod > 0 ? (d.sumJualRpPeriod / d.sumJualPeriod) : 0;
            let saldoAwalValue = saldoAwal * d.kursAwal;
            let modalBeforeSellQty = saldoAwal + d.sumBeliPeriod;
            let modalBeforeSellValue = saldoAwalValue + d.sumBeliRpPeriod;
            let avgModalBeforeSell = modalBeforeSellQty > 0 ? (modalBeforeSellValue / modalBeforeSellQty) : 0;
            let sisaAkhirValue = modalBeforeSellValue - (d.sumJualPeriod * avgModalBeforeSell);
            let autoKursAkhir = stokAkhir > 0 ? (sisaAkhirValue / stokAkhir) : 0;
            let finalKursAkhir = d.hasKursAkhir ? d.kursAkhir : autoKursAkhir;
            let hasFinalKursAkhir = d.hasKursAkhir || finalKursAkhir > 0;
            
            let rpAwal = saldoAwalValue;
            let rpAkhir = stokAkhir * finalKursAkhir;
            
            html += `
                <tr>
                    <td class="text-center font-weight-bold align-middle">${code}</td>
                    
                    <td class="text-end">${fmt(saldoAwal)}</td>
                    <td class="text-end text-muted">${rateCell(d.hasKursAwal, d.kursAwal, prevPeriod)}</td>
                    <td class="text-end">${fmtRp(rpAwal)}</td>
                    
                    <td class="text-end text-success">+ ${fmt(d.sumBeliPeriod)}</td>
                    <td class="text-end text-muted">${fmtRate4(avgBeli)}</td>
                    <td class="text-end text-success">${fmtRp(d.sumBeliRpPeriod)}</td>
                    
                    <td class="text-end text-danger">- ${fmt(d.sumJualPeriod)}</td>
                    <td class="text-end text-muted">${fmtRate4(avgJual)}</td>
                    <td class="text-end text-danger">${fmtRp(d.sumJualRpPeriod)}</td>
                    
                    <td class="text-end font-weight-bold text-info">${fmt(stokAkhir)}</td>
                    <td class="text-end text-muted">${rateCellAuto(hasFinalKursAkhir, finalKursAkhir, endPeriod)}</td>
                    <td class="text-end font-weight-bold text-info">${fmtRp(rpAkhir)}</td>
                </tr>
            `;
        });
        
        if(html === '') {
            html = '<tr><td colspan="13" class="text-center">Tidak ada Master Valuta yang terdaftar atau data belum disinkronkan.</td></tr>';
        }
        tbody.innerHTML = html;
        initBiRatesPanel();
        
    } catch(err) {
        console.error("Error loading LKU:", err);
        const tbody = document.getElementById('lkuTableBody');
        if(tbody) tbody.innerHTML = `<tr><td colspan="13" class="text-center text-danger">Terjadi kesalahan sistem saat memproses rekam jejak.</td></tr>`;
    }
}

function normalizeFullCurrencyCode(value) {
    const raw = String(value || '').toUpperCase().trim();
    const tokens = raw.match(/[A-Z0-9]+/g) || [];
    if(tokens.length > 1 && tokens[0].length <= 2) return tokens.slice(1).join('');
    return tokens.join('');
}

function getPosisiValutaMonthRange(period) {
    if(!period) return null;
    const [year, month] = period.split('-').map(Number);
    if(!year || !month) return null;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return {
        start: formatLkuDate(start),
        end: formatLkuDate(end)
    };
}

window.applyPosisiValutaPeriodToDates = function(period) {
    const range = getPosisiValutaMonthRange(period);
    if(!range) return;
    const startEl = document.getElementById('posisiValutaStartDate');
    const endEl = document.getElementById('posisiValutaEndDate');
    if(startEl) startEl.value = range.start;
    if(endEl) endEl.value = range.end;
};

window.syncPosisiValutaPeriodFromDates = function() {
    const startEl = document.getElementById('posisiValutaStartDate');
    const endEl = document.getElementById('posisiValutaEndDate');
    const periodEl = document.getElementById('posisiValutaPeriod');
    const start = startEl?.value || '';
    const end = endEl?.value || '';
    if(!periodEl) return;
    periodEl.value = start && end && start.substring(0, 7) === end.substring(0, 7) ? start.substring(0, 7) : '';
};

function populatePosisiValutaFilter(codes) {
    const select = document.getElementById('posisiValutaFilter');
    if(!select) return;
    const current = select.value || 'ALL';
    select.innerHTML = '<option value="ALL">Semua Valuta</option>' + codes.map(code => `<option value="${code}">${code}</option>`).join('');
    select.value = Array.from(select.options).some(opt => opt.value === current) ? current : 'ALL';
}

function buildPosisiValutaTransactions(trxs, code) {
    return trxs
        .map(t => {
            const trxCode = normalizeFullCurrencyCode(t?.valuta || t?.curCode || t?.currency || t?.code);
            if(trxCode !== code) return null;
            const trxDate = parseLkuTransactionDate(t?.timestamp || t?.date || t?.createdAt || t?.created_at);
            if(!trxDate) return null;
            const type = String(t.tipe || t.type || t.transactionType || '').trim().toUpperCase();
            const nominal = cleanLkuNumber(t.nominal ?? t.amount ?? t.qty ?? t.quantity);
            const rate = cleanLkuNumber(t.rate);
            const total = cleanLkuNumber(t.total ?? t.totalIdr ?? t.totalIDR ?? t.total_rupiah) || (nominal * rate);
            return {
                date: trxDate,
                type,
                nominal,
                rate,
                total,
                key: String(t?.itemId || t?.id || '').trim(),
                timestamp: trxDate.getTime()
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            const timeDiff = a.timestamp - b.timestamp;
            if(timeDiff !== 0) return timeDiff;
            return String(a.key || '').localeCompare(String(b.key || ''));
        });
}

function calculatePosisiValutaRow(code, currency, trxs, startDate, endDate) {
    const currencyTransactions = buildPosisiValutaTransactions(trxs, code);
    const stockNow = cleanLkuNumber(currency?.stock);
    const netAll = currencyTransactions.reduce((sum, t) => {
        if(t.type === 'BELI' || t.type.includes('BELI')) return sum + t.nominal;
        if(t.type === 'JUAL' || t.type.includes('JUAL')) return sum - t.nominal;
        return sum;
    }, 0);

    const explicitInitialStock = currency?.initialStock ?? currency?.startingStock;
    let qty = explicitInitialStock !== undefined && explicitInitialStock !== null
        ? cleanLkuNumber(explicitInitialStock)
        : Math.max(stockNow - netAll, 0);
    let value = qty * (cleanLkuNumber(currency?.initial_rate_locked) || cleanLkuNumber(currency?.buy) || 0);

    const applyBuy = (t) => {
        qty += t.nominal;
        value += t.total;
    };
    const applySell = (t) => {
        const avg = qty > 0 ? value / qty : 0;
        qty -= t.nominal;
        value -= t.nominal * avg;
        if(qty < 0) qty = 0;
        if(value < 0) value = 0;
    };

    currencyTransactions
        .filter(t => t.date < startDate)
        .forEach(t => {
            if(t.type === 'BELI' || t.type.includes('BELI')) applyBuy(t);
            if(t.type === 'JUAL' || t.type.includes('JUAL')) applySell(t);
        });

    const openingQty = qty;
    const openingValue = value;
    const openingRate = openingQty > 0 ? openingValue / openingQty : 0;

    const summary = {
        buyQty: 0,
        buyValue: 0,
        sellQty: 0,
        sellValue: 0
    };

    currencyTransactions
        .filter(t => t.date >= startDate && t.date <= endDate)
        .forEach(t => {
            if(t.type === 'BELI' || t.type.includes('BELI')) {
                summary.buyQty += t.nominal;
                summary.buyValue += t.total;
                applyBuy(t);
            }
            if(t.type === 'JUAL' || t.type.includes('JUAL')) {
                summary.sellQty += t.nominal;
                summary.sellValue += t.total;
                applySell(t);
            }
        });

    const closingQty = qty;
    const closingValue = value;
    const totalQty = summary.buyQty + summary.sellQty;
    const totalValue = summary.buyValue + summary.sellValue;

    return {
        code,
        openingQty,
        openingRate,
        openingValue,
        buyQty: summary.buyQty,
        buyRate: summary.buyQty > 0 ? summary.buyValue / summary.buyQty : 0,
        buyValue: summary.buyValue,
        sellQty: summary.sellQty,
        sellRate: summary.sellQty > 0 ? summary.sellValue / summary.sellQty : 0,
        sellValue: summary.sellValue,
        closingQty,
        closingRate: closingQty > 0 ? closingValue / closingQty : 0,
        closingValue,
        totalQty,
        totalRate: totalQty > 0 ? totalValue / totalQty : 0,
        totalValue
    };
}

window.initLaporanPosisiValuta = function() {
    const periodEl = document.getElementById('posisiValutaPeriod');
    const todayPeriod = new Date().toISOString().split('T')[0].substring(0, 7);
    if(periodEl && !periodEl.value) {
        periodEl.value = todayPeriod;
        window.applyPosisiValutaPeriodToDates(todayPeriod);
    }
    loadLaporanPosisiValuta();
};

window.loadLaporanPosisiValuta = async function() {
    const startEl = document.getElementById('posisiValutaStartDate');
    const endEl = document.getElementById('posisiValutaEndDate');
    const periodEl = document.getElementById('posisiValutaPeriod');
    const tbody = document.getElementById('posisiValutaTableBody');
    if(!startEl || !endEl || !tbody) return;

    if(!startEl.value || !endEl.value) {
        const period = periodEl?.value || new Date().toISOString().split('T')[0].substring(0, 7);
        if(periodEl && !periodEl.value) periodEl.value = period;
        window.applyPosisiValutaPeriodToDates(period);
    }

    const startDate = parseLkuDate(startEl.value);
    const endDate = parseLkuDate(endEl.value);
    if(!startDate || !endDate || startDate > endDate) {
        tbody.innerHTML = '<tr><td colspan="17" class="text-center text-danger">Periode laporan tidak valid.</td></tr>';
        return;
    }

    const currencies = getCurrencies();
    const transactions = typeof getServerTransactionsLikeRwt === 'function'
        ? await getServerTransactionsLikeRwt()
        : getTransactions();
    const masterCurrencies = typeof getMasterCurrencies === 'function' ? getMasterCurrencies() : [];
    const currencyMap = {};
    currencies.forEach(c => {
        const code = normalizeFullCurrencyCode(c.code);
        if(code) currencyMap[code] = c;
    });

    const codes = Array.from(new Set([
        ...currencies.map(c => normalizeFullCurrencyCode(c.code)),
        ...transactions.map(t => normalizeFullCurrencyCode(t.valuta || t.curCode || t.currency || t.code))
    ].filter(Boolean))).sort();

    populatePosisiValutaFilter(codes);

    const selectedCode = document.getElementById('posisiValutaFilter')?.value || 'ALL';
    const displayCodes = selectedCode === 'ALL' ? codes : codes.filter(code => code === selectedCode);
    const fmtQty = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(num || 0);
    const fmtRate = (num) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(num || 0);
    const fmtRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

    let totals = {
        openingValue: 0,
        buyValue: 0,
        sellValue: 0,
        closingValue: 0,
        totalValue: 0
    };

    const rows = displayCodes.map(code => {
        const c = currencyMap[code] || { code, stock: 0, buy: 0, initial_rate_locked: 0 };
        const baseCode = code.substring(0, 3);
        const master = masterCurrencies.find(m => String(m.code || '').toUpperCase() === code)
            || masterCurrencies.find(m => String(m.code || '').toUpperCase() === baseCode)
            || {};
        const row = calculatePosisiValutaRow(code, c, transactions, startDate, endDate);

        totals.openingValue += row.openingValue;
        totals.buyValue += row.buyValue;
        totals.sellValue += row.sellValue;
        totals.closingValue += row.closingValue;
        totals.totalValue += row.totalValue;

        const name = master.country || master.currencyName || '-';
        return `
            <tr>
                <td class="text-center font-weight-bold">${code}</td>
                <td>${name}</td>
                <td class="text-end">${fmtQty(row.openingQty)}</td>
                <td class="text-end text-muted">${fmtRate(row.openingRate)}</td>
                <td class="text-end">${fmtRp(row.openingValue)}</td>
                <td class="text-end text-success">${fmtQty(row.buyQty)}</td>
                <td class="text-end text-muted">${fmtRate(row.buyRate)}</td>
                <td class="text-end text-success">${fmtRp(row.buyValue)}</td>
                <td class="text-end text-danger">${fmtQty(row.sellQty)}</td>
                <td class="text-end text-muted">${fmtRate(row.sellRate)}</td>
                <td class="text-end text-danger">${fmtRp(row.sellValue)}</td>
                <td class="text-end text-info font-weight-bold">${fmtQty(row.closingQty)}</td>
                <td class="text-end text-muted">${fmtRate(row.closingRate)}</td>
                <td class="text-end text-info font-weight-bold">${fmtRp(row.closingValue)}</td>
                <td class="text-end" style="color:#f59e0b;">${fmtQty(row.totalQty)}</td>
                <td class="text-end text-muted">${fmtRate(row.totalRate)}</td>
                <td class="text-end" style="color:#f59e0b;">${fmtRp(row.totalValue)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows.join('') || '<tr><td colspan="17" class="text-center text-muted">Tidak ada data valuta pada periode ini.</td></tr>';

    const totalMap = {
        posisiValutaTotalAwal: totals.openingValue,
        posisiValutaTotalBeli: totals.buyValue,
        posisiValutaTotalJual: totals.sellValue,
        posisiValutaTotalSisa: totals.closingValue,
        posisiValutaTotalTransaksi: totals.totalValue
    };
    Object.keys(totalMap).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = fmtRp(totalMap[id]);
    });
};

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
window.resetSelectedData = async function() {
    const scopes = Array.from(document.querySelectorAll('[data-reset-scope]:checked')).map(el => el.dataset.resetScope);
    if (!scopes.length) {
        alert('Pilih minimal satu halaman/data yang akan direset.');
        return;
    }
    if (!confirm(`Reset ${scopes.length} pilihan data? Data yang dipilih tidak dapat dikembalikan.`)) return;
    if (prompt('Ketik "RESET" untuk mengonfirmasi penghapusan data yang dipilih:') !== 'RESET') {
        alert('Konfirmasi tidak valid. Reset dibatalkan.');
        return;
    }

    const arrayKeys = new Set();
    const scalarValues = {};
    const add = (...keys) => keys.forEach(key => arrayKeys.add(key));
    if (scopes.includes('transactions')) { add('mc_transactions'); localStorage.removeItem('mc_invoice_seq'); }
    if (scopes.includes('customers')) add('mc_customers');
    if (scopes.includes('cashBank')) Object.assign(scalarValues, { mc_cash: 0, mc_bank_bca: 0, mc_bank_mandiri: 0 });
    if (scopes.includes('currencyStock')) {
        const resetCurrencies = getCurrencies().map(c => ({ ...c, stock: 0, initialStock: 0, initial_rate_locked: 0, initial_rate_source: '', avg_buy_rate: 0, modalRate: 0, avgCost: 0, costRate: 0, modalValue: 0 }));
        saveCurrencies(resetCurrencies);
    }
    if (scopes.includes('expenses')) add('mc_expenses');
    if (scopes.includes('operations')) add('mc_mutations', 'mc_closings', 'mc_adjustments', 'mc_assets', 'mc_investors', 'mc_hris_employees', 'mc_hris_attendance', 'mc_hris_kasbon', 'mc_hris_bpjs', 'mc_hris_leave');
    if (scopes.includes('bookingDemo')) add('mc_bookings', 'mc_demo_transactions', 'mc_demo_stock', 'mc_demo_customers');
    if (scopes.includes('gantungan')) add('mc_gantungans');
    if (scopes.includes('oldMoney')) { add('mc_old_money_stock', 'mc_old_money_suppliers', 'mc_old_money_trxs'); scalarValues.mc_old_money_cash = 0; }
    if (scopes.includes('biRates')) { add('mc_bi_rates'); localStorage.setItem('mc_bi_rates_reset_at', new Date().toISOString()); }

    Object.entries(scalarValues).forEach(([key, value]) => localStorage.setItem(key, String(value)));
    arrayKeys.forEach(key => localStorage.setItem(key, JSON.stringify([])));
    const syncTasks = [];
    if (typeof pushToUniversalDatastore === 'function') {
        Object.entries(scalarValues).forEach(([key, value]) => syncTasks.push(pushToUniversalDatastore(key, value)));
        arrayKeys.forEach(key => syncTasks.push(pushToUniversalDatastore(key, [])));
    }
    if (scopes.includes('transactions')) syncTasks.push(fetch('api/transactions/clear-all', { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error('Gagal membersihkan transaksi server'); }));
    if (scopes.includes('customers')) syncTasks.push(fetch('api/customers/clear-all', { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error('Gagal membersihkan nasabah server'); }));
    try {
        await Promise.all(syncTasks);
        alert('Data pilihan berhasil direset. Aplikasi akan dimuat ulang.');
        setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
        console.error('Reset pilihan gagal:', error);
        alert(`Sebagian reset tidak tersinkron ke server: ${error.message}. Jangan refresh; periksa koneksi lalu ulangi.`);
    }
};

// Kompatibilitas untuk tombol lama/custom shortcut.
window.resetDatabase = window.resetSelectedData;

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

