// Backwards compatibility hooks and DTTOT module

// ==============================
// DTTOT MANAGEMENT
// ==============================
const dtottUtils = window.AlmaraApp.utils;
const DTTOT_STORAGE_KEYS = ['mc_dttot', 'mc_dtott', 'mc_investors'];

function readDttotFromStorage() {
    for (const key of DTTOT_STORAGE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } catch (error) {
            console.warn('Gagal membaca data DTTOT dari storage key:', key, error);
        }
    }
    if (dtottUtils && typeof dtottUtils.safeArrayGet === 'function') {
        const safe = dtottUtils.safeArrayGet('mc_dttot');
        if (Array.isArray(safe) && safe.length) return safe;
        const legacy = dtottUtils.safeArrayGet('mc_dtott');
        if (Array.isArray(legacy) && legacy.length) return legacy;
        return dtottUtils.safeArrayGet('mc_investors');
    }
    return [];
}

function normalizeDttotName(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractDttotBlockedNames(list) {
    const rows = Array.isArray(list) ? list : [];
    if (rows.length <= 1) return [];

    const headers = Array.isArray(rows[0]) ? rows[0].map(h => String(h || '').toLowerCase()) : [];
    const namaIndices = [];
    headers.forEach((h, idx) => {
        if (h.includes('nama')) namaIndices.push(idx);
    });

    const blocked = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;
        if (namaIndices.length > 0) {
            namaIndices.forEach(idx => {
                if (row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') {
                    blocked.push(String(row[idx]).trim());
                }
            });
        } else {
            row.forEach(cell => {
                if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
                    blocked.push(String(cell).trim());
                }
            });
        }
    }

    return [...new Set(blocked)];
}

window.getDtottList = function() {
    return readDttotFromStorage();
};

window.getDttotBlockedNames = function() {
    return extractDttotBlockedNames(window.getDtottList());
};

window.findDttotMatches = function(name) {
    const normalizedInput = normalizeDttotName(name);
    if (!normalizedInput) return [];

    const inputTokens = normalizedInput.split(' ').filter(token => token.length >= 3);
    const blockedNames = window.getDttotBlockedNames();
    const matches = [];

    blockedNames.forEach(rawName => {
        const normalizedBlocked = normalizeDttotName(rawName);
        if (!normalizedBlocked) return;

        if (normalizedBlocked === normalizedInput) {
            matches.push(rawName);
            return;
        }

        if (normalizedBlocked.includes(normalizedInput) || normalizedInput.includes(normalizedBlocked)) {
            matches.push(rawName);
            return;
        }

        if (inputTokens.length > 0 && inputTokens.every(token => normalizedBlocked.includes(token))) {
            matches.push(rawName);
        }
    });

    return [...new Set(matches)];
};

window.saveDtottList = function(list) {
    const payload = Array.isArray(list) ? list : [];
    localStorage.setItem('mc_dttot', JSON.stringify(payload));
    localStorage.setItem('mc_dtott', JSON.stringify(payload));
};

window.loadDtottTable = function() {
    const list = window.getDtottList();
    const thead = document.getElementById('dtottTableHead');
    const tbody = document.getElementById('dtottTableBody');
    if(!tbody || !thead) return;
    
    if(!list || list.length <= 1) {
        thead.innerHTML = `<tr><th style="width: 50px;">No</th><th>Nama Lengkap (Terblokir)</th></tr>`;
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Belum ada data DTTOT yang diunggah.</td></tr>';
        return;
    }

    const headers = list[0];
    let theadHtml = '<tr><th style="width: 50px;">No</th>';
    headers.forEach(h => {
        theadHtml += `<th>${h || '-'}</th>`;
    });
    theadHtml += '</tr>';
    thead.innerHTML = theadHtml;

    let tbodyHtml = '';
    for(let i = 1; i < list.length; i++) {
        const row = list[i];
        tbodyHtml += `<tr><td class="text-center">${i}</td>`;
        for(let j = 0; j < headers.length; j++) {
            tbodyHtml += `<td>${row[j] || '-'}</td>`;
        }
        tbodyHtml += '</tr>';
    }
    tbody.innerHTML = tbodyHtml;
};

window.uploadDtottFile = function() {
    const fileInput = document.getElementById('dtottFileInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            // Baca seluruh row / kolom yang ada
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
            
            // Filter row kosong
            const validData = jsonData.filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== ''));
            
            if(validData.length > 1) {
                window.saveDtottList(validData);
                window.loadDtottTable();
                alert(`Berhasil mengunggah daftar tabel DTTOT.`);
                fileInput.value = ''; // reset form
            } else {
                alert("File yang diunggah kosong atau tidak sesuai standar.");
            }
        } catch(error) {
            console.error("Error parsing DTTOT file:", error);
            alert("Terjadi kesalahan saat membaca file. Pastikan formatnya benar (Excel/CSV).");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.clearDtottList = function() {
    if(confirm("Apakah Anda yakin ingin mengosongkan daftar DTTOT?")) {
        window.saveDtottList([]);
        window.loadDtottTable();
    }
};

window.filterDtottTable = function() {
    const input = document.getElementById('dtottSearchInput');
    const filter = input ? input.value.toLowerCase() : '';
    const tbody = document.getElementById('dtottTableBody');
    if (!tbody) return;

    const trs = tbody.getElementsByTagName('tr');
    for (let i = 0; i < trs.length; i++) {
        const tds = trs[i].getElementsByTagName('td');
        if (tds.length <= 1) continue; // Skip the 'No Data' placeholder row

        let match = false;
        for (let j = 0; j < tds.length; j++) {
            if (tds[j].textContent.toLowerCase().indexOf(filter) > -1) {
                match = true;
                break;
            }
        }
        
        if (match) {
            trs[i].style.display = '';
        } else {
            trs[i].style.display = 'none';
        }
    }
};

window.getDttotList = window.getDtottList;
window.saveDttotList = window.saveDtottList;
window.loadDttotTable = window.loadDtottTable;
window.uploadDttotFile = window.uploadDtottFile;
window.clearDttotList = window.clearDtottList;
window.filterDttotTable = window.filterDtottTable;

window.uploadBatchRates = function() {
    const fileInput = document.getElementById('batchRateInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Expected format (or similar):
            // Row 0: [Kode, Beli, Jual] <- Header
            // Row 1: ['USD', 15000, 15500]
            let jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            jsonData = jsonData.map(row => {
                if(row && row.length === 1 && typeof row[0] === 'string') {
                    if(row[0].includes(';')) return row[0].split(';');
                    if(row[0].includes(',')) return row[0].split(',');
                }
                return row;
            });
            
            const currencies = getCurrencies();
            let updatedCount = 0;

            let cleanNum = (val) => {
                if(typeof val === 'number') return val;
                if(!val) return 0;
                let s = String(val).replace(/Rp|\s+/gi, '').trim();
                
                if(s.includes('.') && s.includes(',')) {
                    const lastDot = s.lastIndexOf('.');
                    const lastComma = s.lastIndexOf(',');
                    if(lastComma > lastDot) {
                        s = s.replace(/\./g, '').replace(/,/g, '.'); 
                    } else {
                        s = s.replace(/,/g, ''); 
                    }
                } else if(s.includes(',')) {
                    const parts = s.split(',');
                    if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/,/g, ''); 
                    } else if(parts.length > 2) {
                        s = s.replace(/,/g, '');
                    } else {
                        s = s.replace(/,/g, '.'); 
                    }
                } else if (s.includes('.')) {
                    const parts = s.split('.');
                    if(parts.length > 2) {
                        s = s.replace(/\./g, ''); 
                    } else if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/\./g, ''); 
                    }
                }
                
                return parseFloat(s) || 0;
            };

            jsonData.forEach((row, index) => {
                if(!row || row.length < 2) return;
                
                // Smart auto-detect code column
                let codeIdx = -1;
                let actualCode = '';
                for(let i=0; i<row.length; i++) {
                    const rawVal = String(row[i] || '').trim().toUpperCase();
                    if (!rawVal) continue;
                    let matches = rawVal.match(/[A-Z]{3}/g);
                    let parsedVal = matches ? matches[matches.length - 1] : rawVal;
                    
                    if(parsedVal && currencies.find(c => c.code.toUpperCase() === parsedVal)) {
                        codeIdx = i; 
                        actualCode = parsedVal;
                        break;
                    }
                }
                
                if(codeIdx === -1) return; // No recognized currency code in this row
                
                const code = actualCode;
                
                // Get all valid numbers to the right of the currency code
                let numbers = [];
                for(let i = codeIdx + 1; i < row.length; i++) {
                    let num = cleanNum(row[i]);
                    // Ignore very small numbers which might be margin artifacts if they copied the HTML table natively
                    if(num > 100) {
                        numbers.push(num);
                    } else if (num > 0 && num <= 100 && numbers.length === 0) {
                        // Exception for certain currencies that might genuinely be less than 100? None practically, but just in case.
                        numbers.push(num); 
                    }
                }

                if(code && numbers.length >= 2) {
                    let baseBuy = numbers[0];
                    // Find the next number that represents the sell rate.
                    // If they copied from HTML, array is [15000, 15000, 15500, 15500] (Buy, SistemBuy, Sell, SistemSell)
                    let baseSell = numbers.find(n => n !== baseBuy) || numbers[1];

                    // Safely ensure Buy is <= Sell to avoid inverted mistakes
                    const finalBuy = Math.min(baseBuy, baseSell);
                    const finalSell = Math.max(baseBuy, baseSell);
                    
                    const targets = currencies.filter(c => {
                        const curCode = String(c.code || '').trim().toUpperCase();
                        return curCode === code || curCode.substring(0, 3) === code;
                    });

                    targets.forEach(currency => {
                        const mb = currency.margin_buy || 0;
                        const ms = currency.margin_sell || 0;
                        currency.base_buy = finalBuy;
                        currency.base_sell = finalSell;
                        currency.buy = finalBuy + mb;
                        currency.sell = finalSell + ms;
                        updatedCount++;
                    });
                }
            });

            if(updatedCount > 0) {
                saveCurrencies(currencies);
                loadCurrencyTable();
                alert(`Berhasil memperbarui kurs untuk ${updatedCount} mata uang.`);
                fileInput.value = ''; // Reset form
            } else {
                alert("Tidak ada kurs yang diperbarui. Pastikan format kolom: Kode | Beli | Jual dan kode mata uang sudah terdaftar.");
            }
        } catch(error) {
            console.error("Error parsing Rate file:", error);
            alert("Terjadi kesalahan membaca file. Pastikan formatnya benar (Excel/CSV).");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.uploadHistoricalTransactions = function() {
    const fileInput = document.getElementById('historicalTrxInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // read as formatted strings because Excel export includes Rp and dot formatting
            let jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            jsonData = jsonData.map(row => {
                if(row && row.length === 1 && typeof row[0] === 'string') {
                    if(row[0].includes(';')) return row[0].split(';');
                    if(row[0].includes(',')) return row[0].split(',');
                }
                return row;
            });
            
            let txs = getTransactions();
            let currencies = getCurrencies();
            let addCount = 0;
            let totalCashAccumulated = 0;
            let totalBankAccumulated = 0;
            
            // Detect column mapping based on headers (assuming Row 0)
            let header = jsonData[0] || [];
            let cMap = { tgl: 0, inv: 1, tipe: 2, nasabah: 3, valuta: 4, nominal: 5, rate: 6, total: 7 };
            
            header.forEach((c, idx) => {
                let l = String(c).toLowerCase().trim();
                if(l.includes('waktu') || l.includes('tanggal')) cMap.tgl = idx;
                if(l.includes('invoice')) cMap.inv = idx;
                if(l === 'tipe') cMap.tipe = idx;
                if(l.includes('nasabah')) cMap.nasabah = idx;
                if(l.includes('valuta') && !l.includes('nominal')) cMap.valuta = idx;
                if(l.includes('nominal')) cMap.nominal = idx;
                if(l.includes('kurs') || l.includes('rate')) cMap.rate = idx;
                if(l.includes('total') || l.includes('idr')) cMap.total = idx;
            });
            
            let cleanNum = (val) => {
                if(typeof val === 'number') return val;
                if(!val) return 0;
                let s = String(val).replace(/Rp|\s+/gi, '').trim();
                
                if(s.includes('.') && s.includes(',')) {
                    const lastDot = s.lastIndexOf('.');
                    const lastComma = s.lastIndexOf(',');
                    if(lastComma > lastDot) {
                        s = s.replace(/\./g, '').replace(/,/g, '.'); 
                    } else {
                        s = s.replace(/,/g, ''); 
                    }
                } else if(s.includes(',')) {
                    const parts = s.split(',');
                    if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/,/g, ''); 
                    } else if(parts.length > 2) {
                        s = s.replace(/,/g, '');
                    } else {
                        s = s.replace(/,/g, '.'); 
                    }
                } else if (s.includes('.')) {
                    const parts = s.split('.');
                    if(parts.length > 2) {
                        s = s.replace(/\./g, ''); 
                    } else if(parts.length === 2 && parts[1].length === 3) {
                        s = s.replace(/\./g, ''); 
                    }
                }
                
                return parseFloat(s) || 0;
            };
            
            // Predict the next available INV- number from existing database
            let maxInvNumber = 0;
            txs.forEach(t => {
                if(t.id && t.id.startsWith("INV-")) {
                    let num = parseInt(t.id.replace("INV-", ""), 10);
                    if(!isNaN(num) && num > maxInvNumber) maxInvNumber = num;
                }
            });
            let autoInvCounter = maxInvNumber + 1;
            
            // Track state for automatic invoice bundling
            let lastAutoInv = null;
            let lastAutoTipe = null;
            let lastAutoNasabah = null;
            let lastAutoDate = null;
            
            jsonData.forEach((row, i) => {
                // Skip header or empty
                if(i === 0 || !row || row.length < 5) return; 
                if(String(row[cMap.tgl]).includes('Tanggal/Waktu') || String(row[cMap.inv]).includes('Invoice')) return; 
                
                const rawTanggal = row[cMap.tgl];
                let inv = String(row[cMap.inv] || '').trim();
                const tipe = String(row[cMap.tipe]).trim().toUpperCase();
                let customerId = String(row[cMap.nasabah]).trim();
                
                // AUTO INVOICE INJECTION: If invoice is blank or '-', bind them!
                if(!inv || inv === '-' || inv.toLowerCase() === 'undefined') {
                    if(tipe === lastAutoTipe && customerId === lastAutoNasabah && rawTanggal === lastAutoDate) {
                        inv = lastAutoInv; // Bundle with previous
                    } else {
                        inv = 'INV-' + autoInvCounter.toString().padStart(4, '0');
                        lastAutoInv = inv;
                        lastAutoTipe = tipe;
                        lastAutoNasabah = customerId;
                        lastAutoDate = rawTanggal;
                        autoInvCounter++;
                    }
                }
                
                // Valuta could be "PH PHP" if exported natively due to flag image inner text
                let rawValuta = String(row[cMap.valuta]).trim().toUpperCase();
                let valutaMatches = rawValuta.match(/[A-Z]{3}/g);
                const valuta = valutaMatches ? valutaMatches[valutaMatches.length - 1] : rawValuta; 
                
                // Prevent invalid parsing (Invoice check removed since it auto-generates now)
                if(!tipe || !valuta || valuta.length !== 3) return;
                
                const nominal = cleanNum(row[cMap.nominal]);
                const rate = cleanNum(row[cMap.rate]);
                let total = cleanNum(row[cMap.total]);
                if (!total || total < 1) total = nominal * rate;
                
                if(customerId.toLowerCase().includes('umum') || customerId === '-') {
                    customerId = '-';
                }
                
                // Strict DD/MM/YYYY check first to prevent US format hijacking
                let dt = null;
                let pts = String(rawTanggal).split(/[-/ ]/);
                if(pts.length >= 3 && pts[0].length <= 2 && !isNaN(pts[0]) && !isNaN(pts[1])) {
                    // strictly enforce DD/MM/YYYY
                    dt = new Date(`${pts[2]}-${pts[1]}-${pts[0]}`);
                } else {
                    dt = new Date(rawTanggal);
                }
                
                if(isNaN(dt?.getTime())) dt = new Date(); // fallback if unrecognized format
                
                let paymentMethod = 'CASH';
                if(row[8] && String(row[8]).toUpperCase().includes('TRANSFER')) {
                    paymentMethod = 'TRANSFER';
                }
                
                let opValuta = valuta;
                let opTipe = tipe;
                
                // USER REQUEST: Completely bypass duplicate checks so they can upload massive 
                // pre-sorted files without false positives skipping their data.
                let existingTx = null; 
                
                if(existingTx) {
                    existingTx.timestamp = dt.toISOString();
                    existingTx.customerId = customerId;
                    existingTx.tipe = opTipe;
                    existingTx.valuta = opValuta;
                    existingTx.nominal = nominal;
                    existingTx.total = total;
                    existingTx.rate = rate;
                    existingTx.paymentMethod = paymentMethod;
                    updatedCount++; // Track as update
                } else {
                    const newTx = {
                        id: inv,
                        timestamp: dt.toISOString(),
                        customerId: customerId,
                        tipe: opTipe,
                        valuta: opValuta,
                        nominal: nominal,
                        total: total,
                        rate: rate,
                        paymentMethod: paymentMethod
                    };
                    txs.push(newTx);
                    addCount++;
                }
                
                // 1. Adjust Physical Multi-Currency stocks
                const cIdx = currencies.findIndex(c => c.code === opValuta);
                if(cIdx !== -1) {
                    if(opTipe === 'BELI') {
                        currencies[cIdx].stock = (currencies[cIdx].stock || 0) + nominal;
                    } else if (opTipe === 'JUAL') {
                        currencies[cIdx].stock = (currencies[cIdx].stock || 0) - nominal;
                    }
                }
                
                // 2. Adjust Cash Flow. BELI removes IDR cash. JUAL adds IDR cash.
                if(opTipe === 'BELI') {
                    if(paymentMethod === 'TRANSFER') totalBankAccumulated -= total;
                    else totalCashAccumulated -= total;
                } else if(opTipe === 'JUAL') {
                    if(paymentMethod === 'TRANSFER') totalBankAccumulated += total;
                    else totalCashAccumulated += total;
                }
            });
            
            if(addCount > 0) {
                // Sort transactions by date descending so newer is first
                txs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                saveTransactions(txs);
                saveCurrencies(currencies);
                
                let currentCash = parseFloat(localStorage.getItem('mc_cash')) || 0;
                currentCash += totalCashAccumulated;
                localStorage.setItem('mc_cash', currentCash.toString());
                
                let currentBank = parseFloat(localStorage.getItem('mc_bank')) || 0;
                currentBank += totalBankAccumulated;
                localStorage.setItem('mc_bank', currentBank.toString());
                
                if(typeof loadReportsTable === 'function') loadReportsTable();
                if(typeof loadDashboard === 'function') loadDashboard();
                
                alert(`Berhasil mengimpor ${addCount} transaksi. Saldo Kas Brankas & Stok Valuta telah disesuaikan otomatis.`);
                fileInput.value = '';
            } else {
                alert("Tidak ada transaksi baru yang diunggah. Pastikan format tabel cocok dengan hasil Export Excel dan No. Invoice belum ter-record sebelumnya.");
            }
            
        } catch(error) {
            console.error("Error parsing Historical Trans file:", error);
            alert("Terjadi kesalahan membaca file. Pastikan Anda mengunggah format hasil Export Excel (.xlsx).");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.uploadHistoricalMutations = function() {
    const fileInput = document.getElementById('historicalMutationInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            let mutations = window.safeArrayGet('mc_mutations');
            let addCount = 0;
            
            jsonData.forEach((row, i) => {
                if(i === 0 || row.includes('ID Mutasi') || row.includes('Waktu')) return; 
                if(!row || row.length < 6) return;
                
                const rawWaktu = row[0];
                const idMutasi = String(row[1]).trim();
                const tipe = String(row[2]).trim().toUpperCase();
                const bank = String(row[3]).trim();
                const ket = String(row[4]).trim();
                
                if(!idMutasi || idMutasi === 'undefined') return;
                if(mutations.find(m => m.id === idMutasi)) return; // prevent duplicate
                
                const cleanNum = (str) => {
                    if(typeof str === 'number') return str;
                    if(!str) return 0;
                    let val = String(str).replace(/Rp/gi, '').trim(); 
                    val = val.replace(/\./g, ''); 
                    val = val.replace(/,/g, '.'); 
                    return parseFloat(val) || 0;
                };
                
                const nominal = cleanNum(row[5]);
                let dt = new Date(rawWaktu);
                if(isNaN(dt.getTime())) dt = new Date();
                
                mutations.push({
                    id: idMutasi,
                    timestamp: dt.toISOString(),
                    type: tipe,
                    bank: bank,
                    amount: nominal,
                    description: ket
                });
                addCount++;
            });
            
            if(addCount > 0) {
                mutations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                localStorage.setItem('mc_mutations', JSON.stringify(mutations));
                if(typeof loadMutationTable === 'function') loadMutationTable();
                alert(`Berhasil mengimpor ${addCount} daftar mutasi bank.`);
                fileInput.value = '';
            } else {
                alert("Tidak ada mutasi baru yang diunggah. Pastikan format tabel cocok dan ID belum terdaftar.");
            }
        } catch(error) {
            console.error(error);
            alert("Gagal membaca file mutasi. Pastikan format export benar.");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.uploadHistoricalClosings = function() {
    const fileInput = document.getElementById('historicalClosingInput');
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Silakan pilih file Excel/CSV terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            
            let closings = window.safeArrayGet('mc_closing_history');
            let addCount = 0;
            
            jsonData.forEach((row, i) => {
                if(i === 0 || row.includes('ID Referensi') || row.includes('Waktu Closing')) return; 
                if(!row || row.length < 5) return;
                
                const rawWaktu = row[0];
                const idRef = String(row[1]).trim();
                
                if(!idRef || idRef === 'undefined') return;
                if(closings.find(c => c.id === idRef)) return;
                
                const cleanNum = (str) => {
                    if(typeof str === 'number') return str;
                    if(!str) return 0;
                    let val = String(str).replace(/Rp/gi, '').trim(); 
                    val = val.replace(/\./g, ''); 
                    val = val.replace(/,/g, '.'); 
                    return parseFloat(val) || 0;
                };
                
                const kasSistem = cleanNum(row[2]);
                const kasFisik = cleanNum(row[3]);
                const selisih = cleanNum(row[4]);
                const ket = row[5] ? String(row[5]) : '-';
                const kasir = row[6] ? String(row[6]) : '-';
                
                let dt = new Date(rawWaktu);
                if(isNaN(dt.getTime())) dt = new Date();
                
                closings.push({
                    id: idRef,
                    timestamp: dt.toISOString(),
                    sistem: kasSistem,
                    fisik: kasFisik,
                    selisih: selisih,
                    note: ket,
                    user: kasir
                });
                addCount++;
            });
            
            if(addCount > 0) {
                closings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                localStorage.setItem('mc_closing_history', JSON.stringify(closings));
                if(typeof loadClosingHistoryTable === 'function') loadClosingHistoryTable();
                alert(`Berhasil mengimpor ${addCount} riwayat closing.`);
                fileInput.value = '';
            } else {
                alert("Tidak ada riwayat closing baru yang diunggah.");
            }
        } catch(error) {
            console.error(error);
            alert("Gagal membaca file closing. Pastikan format export benar.");
        }
    };
    reader.readAsArrayBuffer(file);
};

window.handleCustomerExcelSelected = function() {
    const fileInput = document.getElementById('customerExcelInput');
    const btn = document.getElementById('btnCustomerExcelUpload');
    const fileNameLabel = document.getElementById('customerExcelFileName');
    if (!fileInput || !btn) return;

    if (fileInput.files && fileInput.files.length > 0) {
        btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Proses Import';
        btn.disabled = false;
        btn.classList.remove('disabled');
        if (fileNameLabel) fileNameLabel.textContent = fileInput.files[0].name;
    } else {
        btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Proses Import';
        btn.disabled = false;
        btn.classList.remove('disabled');
        if (fileNameLabel) fileNameLabel.textContent = 'Belum ada file dipilih';
    }
};

window.openCustomerExcelPicker = function() {
    const fileInput = document.getElementById('customerExcelInput');
    if (!fileInput) return;
    if (typeof fileInput.showPicker === 'function') {
        fileInput.showPicker();
        return;
    }
    fileInput.click();
};

window.activateCustomerExcelButtons = function() {
    const chooseBtn = document.getElementById('btnCustomerExcelChoose');
    const importBtn = document.getElementById('btnCustomerExcelUpload');
    const fileInput = document.getElementById('customerExcelInput');

    if (chooseBtn) {
        chooseBtn.onclick = function() {
            window.openCustomerExcelPicker();
        };
        chooseBtn.style.pointerEvents = 'auto';
        chooseBtn.style.cursor = 'pointer';
    }

    if (fileInput) {
        fileInput.style.pointerEvents = 'auto';
        fileInput.style.cursor = 'pointer';
        fileInput.disabled = false;
    }

    if (importBtn) {
        importBtn.onclick = function() {
            window.uploadCustomersExcel();
        };
        importBtn.onpointerdown = function(e) {
            e.preventDefault();
            window.uploadCustomersExcel();
        };
        importBtn.onmousedown = function(e) {
            e.preventDefault();
            window.uploadCustomersExcel();
        };
        importBtn.style.pointerEvents = 'auto';
        importBtn.style.cursor = 'pointer';
        importBtn.disabled = false;
        importBtn.classList.remove('disabled');
    }
};

window.triggerCustomerExcelUpload = function() {
    const fileInput = document.getElementById('customerExcelInput');
    if (!fileInput) return;

    if (!fileInput.files || fileInput.files.length === 0) {
        window.openCustomerExcelPicker();
        return;
    }

    window.uploadCustomersExcel();
};

// Dashboard sudah menyediakan importer nasabah utama. Jangan menimpanya dengan
// versi lama modul DTTOT karena dapat memakai susunan kolom yang berbeda.
window.uploadCustomersExcel = window.uploadCustomersExcel || function() {
    const fileInput = document.getElementById('customerExcelInput');
    const importButton = document.getElementById('btnCustomerExcelUpload');
    const setImportLoading = (isLoading) => {
        if (importButton) {
            importButton.disabled = isLoading;
            importButton.style.pointerEvents = isLoading ? 'none' : 'auto';
            importButton.style.cursor = isLoading ? 'wait' : 'pointer';
            importButton.innerHTML = isLoading
                ? '<i class="fa-solid fa-spinner fa-spin"></i> Mengimpor...'
                : '<i class="fa-solid fa-file-import"></i> Proses Import';
        }
        if (typeof Swal !== 'undefined') {
            if (isLoading) {
                Swal.fire({
                    title: 'Mengimpor Data Nasabah',
                    text: 'File sedang dibaca dan data sedang disimpan.',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    background: '#1e293b',
                    color: '#f8fafc',
                    didOpen: () => Swal.showLoading()
                });
            } else if (Swal.isLoading && Swal.isLoading()) {
                Swal.close();
            }
        }
    };
    if(!fileInput || !fileInput.files || fileInput.files.length === 0) {
        window.openCustomerExcelPicker();
        return;
    }
    if(importButton && importButton.disabled) return;
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    setImportLoading(true);

    const compactCustomerForStorage = (customer) => {
        if (!customer || typeof customer !== 'object') return customer;
        const next = {...customer};
        if (typeof next.foto_id === 'string' && next.foto_id.length > 5000) delete next.foto_id;
        delete next.raw_json;
        return next;
    };
    const saveImportedCustomersCache = (customers) => {
        const compactCustomers = customers.map(compactCustomerForStorage);
        window.__mcCustomersMemory = compactCustomers;
        try {
            localStorage.setItem('mc_customers', JSON.stringify(compactCustomers));
            return true;
        } catch(error) {
            if(error && (error.name === 'QuotaExceededError' || String(error.message || '').toLowerCase().includes('quota'))) {
                localStorage.removeItem('mc_customers');
                try {
                    localStorage.setItem('mc_customers', JSON.stringify(compactCustomers));
                    return true;
                } catch(retryError) {
                    console.warn('Cache nasabah lokal penuh, data tetap disimpan ke database.', retryError);
                    window.__mcCustomersMemory = compactCustomers;
                    return false;
                }
            }
            throw error;
        }
    };

    const parseCsvRows = (text) => {
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;
        const normalized = String(text || '').replace(/^\uFEFF/, '');
        const firstLine = normalized.split(/\r?\n/, 1)[0] || '';
        const delimiterCounts = {
            ',': (firstLine.match(/,/g) || []).length,
            ';': (firstLine.match(/;/g) || []).length,
            '\t': (firstLine.match(/\t/g) || []).length
        };
        const delimiter = Object.keys(delimiterCounts).sort((a, b) => delimiterCounts[b] - delimiterCounts[a])[0] || ',';

        for (let i = 0; i < normalized.length; i++) {
            const ch = normalized[i];
            const next = normalized[i + 1];

            if (ch === '"') {
                if (inQuotes && next === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch === delimiter && !inQuotes) {
                row.push(field.trim());
                field = '';
                continue;
            }

            if ((ch === '\n' || ch === '\r') && !inQuotes) {
                if (ch === '\r' && next === '\n') i++;
                row.push(field.trim());
                if (row.some(cell => String(cell || '').trim() !== '')) rows.push(row);
                row = [];
                field = '';
                continue;
            }

            field += ch;
        }

        row.push(field.trim());
        if (row.some(cell => String(cell || '').trim() !== '')) rows.push(row);
        return rows;
    };

    const buildUniqueImportedCustomerId = (existingCustomers, rowIndex) => {
        const used = new Set((existingCustomers || []).map(c => String(c?.id_nasabah || '').trim()).filter(Boolean));
        let candidate = typeof window.generateStandardId === 'function'
            ? window.generateStandardId()
            : `ALM-${Date.now()}-${rowIndex + 1}`;
        let sequence = 1;
        while (used.has(String(candidate).trim())) {
            candidate = `ALM-${Date.now()}-${rowIndex + 1}-${sequence++}`;
        }
        return candidate;
    };

    const excelSerialToDateString = (serial) => {
        const num = Number(serial);
        if (!Number.isFinite(num) || num <= 0) return '';
        const ms = Math.round((num - 25569) * 86400 * 1000);
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString();
    };

    const normalizeCellValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return String(value).trim();
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
        return String(value).trim();
    };
    
    reader.onload = async function(e) {
        try {
            const fileName = String(file.name || '').toLowerCase();
            let jsonData = [];
            if(fileName.endsWith('.csv')) {
                const decoder = new TextDecoder('utf-8');
                const csvText = decoder.decode(e.target.result);
                jsonData = parseCsvRows(csvText);
                if(jsonData.length === 0 || jsonData.every(row => row.length < 3)) {
                    const workbook = XLSX.read(csvText, {type: 'string'});
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
                }
            } else {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1, raw: false});
            }
            
            let customers = getCustomers();
            let addCount = 0;
            const importedCustomers = [];
            const normalizeImportHeader = (value) => String(value || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '');
            const headerMap = {};
            if(Array.isArray(jsonData[0])) {
                jsonData[0].forEach((header, index) => {
                    const key = normalizeImportHeader(header);
                    if(key) headerMap[key] = index;
                });
            }
            const getHeaderCell = (row, aliases, fallbackIndex) => {
                for(const alias of aliases) {
                    const index = headerMap[normalizeImportHeader(alias)];
                    if(index !== undefined && row[index] !== undefined && normalizeCellValue(row[index]) !== '') {
                        return row[index];
                    }
                }
                if (fallbackIndex !== undefined && row[fallbackIndex] !== undefined) {
                    return row[fallbackIndex];
                }
                return undefined;
            };

            const firstNonEmptyCell = (row) => {
                for (const cell of row) {
                    const normalized = normalizeCellValue(cell);
                    if (normalized !== '') return normalized;
                }
                return '';
            };

            const parseExcelDate = (value) => {
                if (value === null || value === undefined || value === '') return '';
                if (value instanceof Date && !Number.isNaN(value.getTime())) {
                    return value.toISOString();
                }
                const raw = normalizeCellValue(value);
                if (!raw || raw === '-') return '';
                const serial = excelSerialToDateString(raw);
                if (serial) return serial;
                const parsed = new Date(raw);
                if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
                return raw;
            };
            
            jsonData.forEach((row, i) => {
                // Asumsi baris 0 adalah header ("ID Nasabah", "Tipe", "Nama Lengkap" dll.)
                if(!Array.isArray(row) || row.length < 2) return; 
                if(i === 0 || row.includes('ID Nasabah') || row.includes('Tipe')) return; 
                if(!firstNonEmptyCell(row)) return;
                
                const idNasabahRaw = getHeaderCell(row, ['ID_Nasabah', 'ID Nasabah', 'ID NASABAH', 'internal_id', 'memberid', 'member', 'idmember'], 0);
                const tipeLabel = normalizeCellValue(getHeaderCell(row, ['Tipe', 'KN(TIPE)', 'KN Tipe', 'KN', 'customer_type', 'kn'], 1));
                const namaRaw = getHeaderCell(row, ['Nama', 'Nama Lengkap', 'Nama_Lengkap', 'NAMA LENGKAP', 'full_name', 'name'], 2);
                const idpjk = normalizeCellValue(getHeaderCell(row, ['IDPJK', 'Idpjk', 'ID PJK'], 3)) || '-';
                const warga_negara = normalizeCellValue(getHeaderCell(row, ['Warga_Negara', 'Warga Negara', 'Citizenship'], 4)) || '-';
                const jenis_kelamin = normalizeCellValue(getHeaderCell(row, ['Jenis_Kelamin', 'Jenis Kelamin', 'Gender'], 5)) || '-';
                const tempat_lahir = normalizeCellValue(getHeaderCell(row, ['Tempat_Lahir', 'Tempat Lahir', 'Birth Place'], 6)) || '-';
                const tanggal_lahir = normalizeCellValue(getHeaderCell(row, ['Tanggal_Lahir', 'Tanggal Lahir', 'Birth Date'], 7)) || '-';
                const alamat = normalizeCellValue(getHeaderCell(row, ['Alamat', 'Address'], 8)) || '-';
                const pekerjaan = normalizeCellValue(getHeaderCell(row, ['Pekerjaan', 'Job', 'Occupation'], 9)) || '-';
                const no_hp = normalizeCellValue(getHeaderCell(row, ['No_HP', 'No HP', 'NO TLP', 'No TLP', 'No Telp', 'Phone', 'Telepon'], 10)) || '-';
                const no_rekening = normalizeCellValue(getHeaderCell(row, ['No_Rekening', 'No Rekening', 'Bank Account'], 11)) || '';
                const no_ktp = normalizeCellValue(getHeaderCell(row, ['No_KTP', 'No KTP', 'NO KTP', 'Identity Number', 'identity_number'], 12)) || '-';
                const selain_ktp = normalizeCellValue(getHeaderCell(row, ['Selain_KTP', 'Selain KTP', 'ID Lain', 'Other ID'], 13)) || '-';
                const no_cif = normalizeCellValue(getHeaderCell(row, ['No_CIF', 'No CIF', 'id_cif', 'CIF'], 14)) || '';
                const npwp = normalizeCellValue(getHeaderCell(row, ['NPWP'], 15)) || '';
                const local_id = normalizeCellValue(getHeaderCell(row, ['Local_ID', 'Local ID', 'LocalID'], 16)) || '';

                const idNasabah = normalizeCellValue(idNasabahRaw);
                const nama = normalizeCellValue(namaRaw) || idNasabah || 'Tanpa Nama';
                
                let typeKn = '1';
                if(tipeLabel.toLowerCase().includes('perusahaan') || tipeLabel.toLowerCase().includes('corporate') || tipeLabel === '2') {
                    typeKn = '2';
                }

                // Normalisasi ID Nasabah: Gunakan standar ALM-xxxxx
                let finalId = idNasabah;
                if(!finalId || finalId === '-' || /^(perorangan|corporate|tipe|nama)$/i.test(finalId) || isNaN(parseInt(finalId))) {
                    finalId = buildUniqueImportedCustomerId(customers, i);
                }

                const existingIdx = customers.findIndex(c => String(c.id_nasabah).trim() === String(finalId).trim());
                
                // Cek Tanggal Daftar dari Excel
                const tglDaftarValue = getHeaderCell(row, ['Tgl_Daftar', 'Tgl Daftar', 'Tanggal Daftar', 'Registration Date'], 17);
                let tglDaftarExcel = normalizeCellValue(tglDaftarValue);
                let finalTglDaftar = new Date().toISOString(); 
                
                if(tglDaftarExcel && tglDaftarExcel !== '-') {
                    const parsedExcelDate = parseExcelDate(tglDaftarExcel);
                    if (parsedExcelDate) {
                        finalTglDaftar = parsedExcelDate;
                    }
                } else if(existingIdx !== -1 && customers[existingIdx].tgl_daftar) {
                    // Jika data sudah ada dan Excel tidak punya tanggal baru, gunakan tanggal lama
                    finalTglDaftar = customers[existingIdx].tgl_daftar;
                }

                const newC = {
                    id_nasabah: finalId,
                    idpjk: idpjk,
                    kn: typeKn,
                    nama: nama,
                    tempat_lahir: tempat_lahir,
                    tanggal_lahir: tanggal_lahir,
                    alamat: alamat,
                    jenis_kelamin: jenis_kelamin,
                    warga_negara: warga_negara,
                    pekerjaan: pekerjaan,
                    no_ktp: no_ktp,
                    selain_ktp: selain_ktp,
                    no_hp: no_hp,
                    no_rekening: no_rekening,
                    no_cif: no_cif,
                    npwp: npwp,
                    local_id: local_id,
                    tgl_daftar: finalTglDaftar
                };
                
                if(existingIdx !== -1) {
                    customers[existingIdx] = {...customers[existingIdx], ...newC};
                    addCount++;
                } else {
                    customers.push(newC);
                    addCount++;
                }
                importedCustomers.push(newC);
            });
            
            if(addCount > 0) {
                let mysqlSuccessCount = 0;
                let mysqlFailedCount = 0;
                let errorDetails = '';

                if (typeof window.saveBulkToMySQL_Customers === 'function') {
                    if (typeof Swal !== 'undefined' && Swal.update) {
                        Swal.update({ text: `Mengunggah ${importedCustomers.length} data nasabah ke MySQL...` });
                    }
                    const bulkResult = await window.saveBulkToMySQL_Customers(importedCustomers);
                    mysqlSuccessCount = bulkResult.successCount;
                    mysqlFailedCount = bulkResult.failedCount;
                    if (bulkResult.errors && bulkResult.errors.length > 0) {
                        errorDetails = '\n\nDetail Gagal:\n' + bulkResult.errors.slice(0, 5).join('\n') + 
                                       (bulkResult.errors.length > 5 ? '\n...dan ' + (bulkResult.errors.length - 5) + ' baris lainnya.' : '');
                    }
                } else if(typeof window.saveToMySQL_Customer === 'function') {
                    for (let index = 0; index < importedCustomers.length; index++) {
                        const customer = importedCustomers[index];
                        if (typeof Swal !== 'undefined' && Swal.update) {
                            Swal.update({ text: `Menyimpan data ${index + 1} dari ${importedCustomers.length}...` });
                        }
                        const result = await window.saveToMySQL_Customer(customer);
                        if (result && result.ok) mysqlSuccessCount++;
                        else mysqlFailedCount++;
                    }
                }
                const cacheSaved = saveImportedCustomersCache(customers);
                if(typeof loadCustomersTable === 'function') loadCustomersTable();
                const successText = !cacheSaved
                    ? 'Data sudah dikirim ke database. Cache browser penuh, jadi tabel ditampilkan dari memori sementara.'
                    : mysqlFailedCount > 0
                    ? `Berhasil membaca ${addCount} data. Tersimpan ke database: ${mysqlSuccessCount}, gagal: ${mysqlFailedCount}.${errorDetails}`
                    : `Berhasil mengimpor / memperbarui ${addCount} data nasabah.`;
                if(typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: (mysqlFailedCount > 0 || !cacheSaved) ? 'warning' : 'success',
                        title: (mysqlFailedCount > 0 || !cacheSaved) ? 'Import Selesai Sebagian' : 'Import Berhasil',
                        text: successText,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } else {
                    alert(successText);
                }
                fileInput.value = '';
                if (typeof window.handleCustomerExcelSelected === 'function') window.handleCustomerExcelSelected();
            } else {
                if(typeof Swal !== 'undefined') {
                    Swal.fire('Tidak Ada Data Valid', 'Tidak ada data nasabah valid yang diunggah. Pastikan format tabel cocok.', 'warning');
                } else {
                    alert("Tidak ada data nasabah valid yang diunggah. Pastikan format tabel cocok.");
                }
            }
            
        } catch(error) {
            console.error("Error parsing Customer Excel file:", error);
            if(typeof Swal !== 'undefined') {
                Swal.fire('Gagal Import', `Terjadi kesalahan membaca file: ${error.message || error}. Gunakan file .xlsx, .xls, atau .csv dengan kolom nasabah yang sesuai.`, 'error');
            } else {
                alert(`Terjadi kesalahan membaca file: ${error.message || error}. Gunakan file .xlsx, .xls, atau .csv dengan kolom nasabah yang sesuai.`);
            }
        } finally {
            setImportLoading(false);
        }
    };
    reader.onerror = function() {
        setImportLoading(false);
        if(typeof Swal !== 'undefined') {
            Swal.fire('Gagal Membaca File', 'Browser gagal membaca file yang dipilih.', 'error');
        } else {
            alert('Browser gagal membaca file yang dipilih.');
        }
    };
    reader.readAsArrayBuffer(file);
};

setTimeout(() => {
    if (typeof window.activateCustomerExcelButtons === 'function') {
        window.activateCustomerExcelButtons();
    }
}, 300);

