// Dashboard and daily report logic

// ==============================
// DASHBOARD LOGIC
// ==============================
const { store, utils } = window.AlmaraApp;
let mainChart;
let dashboardChartRange = '7H';
const DASHBOARD_CHART_RANGES = {
    '1H': { label: '1 Hari', days: 1, bucket: 'hour' },
    '3H': { label: '3 Hari', days: 3, bucket: 'day' },
    '7H': { label: '7 Hari', days: 7, bucket: 'day' },
    '1M': { label: '1 Bulan', days: 30, bucket: 'day' },
    '3M': { label: '3 Bulan', days: 90, bucket: 'week' },
    '1Y': { label: '1 Tahun', months: 12, bucket: 'month' }
};

function getDashboardTransactionTime(trx) {
    const raw = trx && (trx.timestamp || trx.date || trx.createdAt || trx.created_at);
    if (!raw) return 0;
    const normalized = String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T');
    const time = new Date(normalized).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function sortDashboardTransactions(transactions) {
    return [...transactions].sort((a, b) => {
        const timeDiff = getDashboardTransactionTime(b) - getDashboardTransactionTime(a);
        if (timeDiff !== 0) return timeDiff;
        return String(b?.itemId || b?.id || '').localeCompare(String(a?.itemId || a?.id || ''));
    }).slice();
}

function parseDashboardMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const text = String(value ?? '').trim();
    if (!text || text === '-') return 0;
    const negative = text.includes('-') || /^\((.*)\)$/.test(text);
    const numeric = parseFloat(text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    return negative ? -Math.abs(numeric) : numeric;
}

function getDashboardClosingTime(closing) {
    const raw = closing?.timestamp || closing?.date || closing?.createdAt || closing?.created_at || closing?.tanggal;
    if (!raw) return 0;
    const normalized = String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T');
    const time = new Date(normalized).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function getDashboardClosingDifference(closing) {
    const explicit = closing?.selisih ?? closing?.difference ?? closing?.reconciliationDiff ?? closing?.selisihRekons;
    if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
        return parseDashboardMoney(explicit);
    }

    const kasSistem = parseDashboardMoney(closing?.kasSistem ?? closing?.cashSystem);
    const bankSistem = parseDashboardMoney(closing?.bankSistem ?? ((closing?.bankBCA || 0) + (closing?.bankMandiri || 0)));
    const totalSistemRupiah = parseDashboardMoney(closing?.totalSistemRupiah ?? (kasSistem + bankSistem));
    const kasFisik = parseDashboardMoney(closing?.kasFisik ?? closing?.fisik ?? closing?.cashPhysical);
    const totalFisikPlusBank = parseDashboardMoney(closing?.totalFisikPlusBank ?? (kasFisik + bankSistem));
    const gantunganPiutang = parseDashboardMoney(closing?.gantunganPiutang);
    const gantunganUtang = parseDashboardMoney(closing?.gantunganUtang);

    return totalFisikPlusBank - totalSistemRupiah + gantunganPiutang - gantunganUtang;
}

function getDashboardReconciliationSummary(closings, targetDate, isFiltered) {
    const allClosings = Array.isArray(closings) ? closings : [];
    const candidates = allClosings
        .filter(c => {
            if (!isFiltered) return true;
            const time = getDashboardClosingTime(c);
            if (!time) return false;
            return new Date(time).toISOString().slice(0, 10) === targetDate;
        })
        .sort((a, b) => getDashboardClosingTime(b) - getDashboardClosingTime(a));

    if (candidates.length === 0) {
        return { value: 0, source: isFiltered ? `Belum ada closing ${targetDate}` : 'Belum ada closing' };
    }

    const latest = candidates[0];
    const type = latest.type || latest.closingType || 'final';
    const typeLabel = type === 'final' ? 'Closing final terakhir' : 'Cek sementara terakhir';
    const time = getDashboardClosingTime(latest);
    const dateLabel = time ? window.formatDateToDMY(new Date(time)) : '';

    return {
        value: getDashboardClosingDifference(latest),
        source: dateLabel ? `${typeLabel}: ${dateLabel}` : typeLabel
    };
}

async function loadDashboard() {
    const trxs = typeof getServerTransactionsLikeRwt === 'function'
        ? await getServerTransactionsLikeRwt()
        : store.getTransactions();
    const currencies = store.getCurrencies();
    if (typeof repairDerivedCurrencyRates === 'function' && repairDerivedCurrencyRates(currencies)) {
        store.saveCurrencies(currencies);
    }
    let totalKas = store.getCash();
    let totalBank = store.getBankBCA() + store.getBankMandiri();
    
    // Hitung Estimasi Valuta dalam IDR berbasis modal rata-rata beli.
    // Saldo awal memakai kurs modal awal; transaksi BELI menambah rata-rata modal.
    let estimasiValutaIdr = 0;
    let estimasiValutaQty = 0;
    let alertsCount = 0;
    
    const stockSearchEl = document.getElementById('dashboardStockSearch');
    const stockKeyword = (stockSearchEl ? stockSearchEl.value : '').trim().toLowerCase();
    const masterCurrencies = store.getMasterCurrencies ? store.getMasterCurrencies() : [];

    currencies.forEach(c => {
        const modalCost = calculateCurrencyAverageCost(c, trxs);
        const estValue = modalCost.value || 0;
        estimasiValutaIdr += estValue;
        estimasiValutaQty += parseFloat(c.stock) || 0;
        
        if((c.stock || 0) <= (c.alert || 0)) {
            alertsCount++;
        }
    });

    const filteredCurrencies = stockKeyword
        ? currencies.filter(c => {
            const code = String(c.code || '').toUpperCase();
            const baseCode = code.substring(0, 3);
            const master = masterCurrencies.find(m => String(m.code || '').toUpperCase() === code)
                || masterCurrencies.find(m => String(m.code || '').toUpperCase() === baseCode)
                || {};
            const searchable = [
                c.code,
                master.code,
                master.country,
                master.currencyName,
                master.symbol,
                master.countryCode
            ].filter(Boolean).join(' ').toLowerCase();

            return searchable.includes(stockKeyword);
        })
        : currencies;

    const stockListHtml = filteredCurrencies.map(c => {
        let statusClass = 'status-aman';
        if((c.stock || 0) <= (c.alert || 0)) {
            statusClass = 'status-bahaya';
        }
        const codeDisplay = String(c.code || '');
        const code = codeDisplay.toUpperCase();
        const baseCode = code.substring(0, 3);
        const master = masterCurrencies.find(m => String(m.code || '').toUpperCase() === code)
            || masterCurrencies.find(m => String(m.code || '').toUpperCase() === baseCode)
            || {};
        const countryCode = String(master.countryCode || '').toLowerCase();
        const flagUrl = countryCode ? `https://flagcdn.com/w80/${countryCode}.png` : '';
        const title = code.length > 3 && String(master.code || '').toUpperCase() === baseCode
            ? `Turunan ${baseCode}`
            : (master.country || code);
        
        const trendIconMini = c.trend === 'up' 
            ? `<span style="color: #10B981; font-size: 0.85rem; line-height: 1; margin-left: 5px;" title="Tren Naik">▲</span>` 
            : (c.trend === 'down' 
                ? `<span style="color: #ef4444; font-size: 0.85rem; line-height: 1; margin-left: 5px;" title="Tren Turun">▼</span>` 
                : `<span style="color: #64748b; font-size: 0.75rem; opacity: 0.6; line-height: 1; margin-left: 5px;" title="Tren Stabil">─</span>`);

        return `
            <div class="stock-item">
                <div class="stock-identity">
                    <span class="${statusClass} status-indicator"></span>
                    <span class="stock-flag" title="${title}">
                        ${flagUrl
                            ? `<img src="${flagUrl}" alt="${code}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"><span class="stock-flag-fallback">${code.substring(0, 2)}</span>`
                            : `<span class="stock-flag-fallback" style="display:inline;">${code.substring(0, 2)}</span>`}
                    </span>
                    <span class="stock-code" style="display: inline-flex; align-items: center;">${codeDisplay} ${trendIconMini}</span>
                </div>
                <div class="stock-metrics">
                    <span class="stock-amount">${(c.stock || 0).toLocaleString()}</span>
                    <div class="stock-rate-pair">
                        <div class="stock-rate-chip stock-rate-buy">
                            <span>Beli</span>
                            <strong>${utils.formatRate(c.buy || 0).replace(/,0000$/, '')}</strong>
                        </div>
                        <div class="stock-rate-chip stock-rate-sell">
                            <span>Jual</span>
                            <strong>${utils.formatRate(c.sell || 0).replace(/,0000$/, '')}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') || `
        <div class="stock-empty">
            Tidak ada valuta yang cocok.
        </div>
    `;

    document.getElementById('dashboardStockList').innerHTML = stockListHtml;
    if (typeof window.updateHeaderNotificationBadge === 'function') {
        window.updateHeaderNotificationBadge();
    } else {
        document.getElementById('stockAlertBadge').textContent = alertsCount > 0 ? alertsCount : '';
        document.getElementById('stockAlertBadge').style.display = alertsCount > 0 ? 'block' : 'none';
    }

    // Hitung Profit & Total Trx Berdasarkan Tanggal Filter
    let targetDate = new Date().toISOString().split('T')[0];
    const dashDateFilterEl = document.getElementById('dashDateFilter');
    let isFiltered = false;
    
    if (dashDateFilterEl && dashDateFilterEl.value) {
        targetDate = dashDateFilterEl.value;
        isFiltered = true;
    }
    
    // Update texts labels based on date selection
    const profitLabel = document.querySelector('#dashProfit')?.closest('.stat-details')?.querySelector('h3');
    if(profitLabel) {
        profitLabel.textContent = isFiltered ? 'Profit (' + targetDate + ')' : 'Profit Hari Ini';
    }

    const todayTrx = trxs.filter(t => t.timestamp.startsWith(targetDate));
    
    let sumProfit = 0;
    let sumBeli = 0;
    let sumJual = 0;

    todayTrx.forEach(t => {
        if(t.tipe === 'BELI') {
            sumBeli += t.total;
        } else if (t.tipe === 'JUAL') {
            sumJual += t.total;
        }

        const curData = currencies.find(c => c.code === t.valuta);
        if(curData && t.tipe === 'JUAL') {
             const avgModalRate = calculateCurrencyAverageCost(curData, trxs).rate || curData.buy || 0;
             sumProfit += ((parseFloat(t.rate) || 0) - avgModalRate) * (parseFloat(t.nominal) || 0);
        }
    });

    const expenses = store.getExpenses();
    const todayExpenses = expenses.filter(e => e.timestamp.startsWith(targetDate));
    let sumExp = 0;
    todayExpenses.forEach(e => sumExp += e.nominal);

    document.getElementById('dashTotalKas').textContent = utils.formatIdr(totalKas);
    document.getElementById('dashTotalBank').textContent = utils.formatIdr(totalBank);
    if(document.getElementById('dashBCA')) document.getElementById('dashBCA').textContent = utils.formatIdr(store.getBankBCA());
    if(document.getElementById('dashMandiri')) document.getElementById('dashMandiri').textContent = utils.formatIdr(store.getBankMandiri());
    document.getElementById('dashTotalValuta').textContent = utils.formatIdr(estimasiValutaIdr);
    if(document.getElementById('dashTotalValutaHint')) {
        const hasAnyBuyTransaction = trxs.some(t => String(t.tipe || t.type || '').toUpperCase() === 'BELI');
        document.getElementById('dashTotalValutaHint').textContent = estimasiValutaQty > 0
            ? (hasAnyBuyTransaction ? 'Berdasarkan rata-rata kurs pembelian' : 'Berdasarkan saldo awal valas')
            : 'Belum ada stok valuta';
    }
    document.getElementById('dashProfit').textContent = utils.formatIdr(sumProfit);
    if(document.getElementById('dashTotalPurchases')) document.getElementById('dashTotalPurchases').textContent = utils.formatIdr(sumBeli);
    if(document.getElementById('dashTotalSales')) document.getElementById('dashTotalSales').textContent = utils.formatIdr(sumJual);
    if(document.getElementById('dashTotalExpenses')) document.getElementById('dashTotalExpenses').textContent = utils.formatIdr(sumExp);

    // Hitung Selisih Rekonsiliasi terbaru dari riwayat closing.
    const closings = store.getClosings();
    const reconciliationSummary = getDashboardReconciliationSummary(closings, targetDate, isFiltered);
    const totalSelisih = reconciliationSummary.value;

    const selisihEl = document.getElementById('dashTotalSelisih');
    if(selisihEl) {
        selisihEl.textContent = utils.formatIdr(Math.abs(totalSelisih));
        if(totalSelisih < 0) {
            selisihEl.textContent = '-' + selisihEl.textContent;
            selisihEl.style.color = '#ef4444'; // Red (Kekurangan)
        } else if(totalSelisih > 0) {
            selisihEl.textContent = '+' + selisihEl.textContent;
            selisihEl.style.color = '#10b981'; // Green (Kelebihan)
        } else {
            selisihEl.style.color = '#8b5cf6'; // Neutral
        }
    }
    const selisihHint = document.getElementById('dashTotalSelisihHint');
    if(selisihHint) selisihHint.textContent = reconciliationSummary.source;

    // Update text labels for dynamic date
    const labelsToUpdate = [
        { id: '#dashTotalPurchases', text: 'Total Pembelian' },
        { id: '#dashTotalSales', text: 'Total Penjualan' },
        { id: '#dashTotalExpenses', text: 'Pengeluaran' }
    ];
    
    labelsToUpdate.forEach(l => {
        const el = document.querySelector(l.id)?.closest('.stat-details')?.querySelector('h3');
        if(el) {
            el.textContent = isFiltered ? l.text + ' (' + targetDate + ')' : l.text;
        }
    });

    // Load Recent Activity (last 5) for target date if filtered, or all if not
    const recentSource = isFiltered ? todayTrx : trxs;
    let acts = sortDashboardTransactions(recentSource).slice(0, 5);
    document.getElementById('recentActivities').innerHTML = acts.map(t => `
        <tr>
            <td>${utils.formatDateToDMY(t.timestamp)}</td>
            <td><span class="${t.tipe === 'BELI' ? 'text-green' : 'text-red'} font-weight-bold">${t.tipe}</span></td>
            <td>${utils.getFlagHtml(t.valuta)}</td>
            <td>${t.nominal.toLocaleString()}</td>
            <td>${utils.formatIdr(t.total)}</td>
            <td>${t.kasir}</td>
        </tr>
    `).join('') || `<tr><td colspan="6" class="text-center">Belum ada transaksi</td></tr>`;

    // Render Chart
    renderChart(trxs, isFiltered ? targetDate : null);
}

function loadStockMonitor() {
    // Just re-renders part of the dashboard
    loadDashboard();
}

function setDashboardChartRange(range) {
    if(!DASHBOARD_CHART_RANGES[range]) return;
    dashboardChartRange = range;
    loadDashboard();
}

function syncDashboardChartControls() {
    document.querySelectorAll('.chart-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === dashboardChartRange);
    });
}

function populateDashboardChartCurrencySelect(currencies) {
    const select = document.getElementById('dashboardChartCurrency');
    if(!select) return;

    const currentValue = select.value || 'ALL';
    const masterCurrencies = store.getMasterCurrencies ? store.getMasterCurrencies() : [];
    const options = currencies
        .map(c => String(c.code || ''))
        .filter(Boolean)
        .filter((code, index, arr) => arr.indexOf(code) === index)
        .sort((a, b) => a.localeCompare(b))
        .map(code => {
            return `<option value="${code}">${code}</option>`;
        })
        .join('');

    select.innerHTML = `<option value="ALL">Semua Valuta</option>${options}`;
    select.value = [...select.options].some(opt => opt.value === currentValue) ? currentValue : 'ALL';
}

function getDashboardChartDateRange(baseDateStr, rangeConfig) {
    const end = baseDateStr ? new Date(baseDateStr + 'T23:59:59') : new Date();
    const start = new Date(end);

    if(rangeConfig.months) {
        start.setMonth(start.getMonth() - rangeConfig.months + 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else {
        start.setDate(start.getDate() - rangeConfig.days + 1);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
}

function buildDashboardChartBuckets(start, end, bucketType) {
    const buckets = [];
    const cursor = new Date(start);

    while(cursor <= end) {
        const bucketStart = new Date(cursor);
        const bucketEnd = new Date(cursor);
        let key = '';
        let label = '';

        if(bucketType === 'hour') {
            bucketEnd.setMinutes(59, 59, 999);
            key = bucketStart.toISOString().slice(0, 13);
            label = bucketStart.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            cursor.setHours(cursor.getHours() + 1);
        } else if(bucketType === 'week') {
            bucketEnd.setDate(bucketEnd.getDate() + 6);
            bucketEnd.setHours(23, 59, 59, 999);
            if(bucketEnd > end) bucketEnd.setTime(end.getTime());
            key = bucketStart.toISOString().slice(0, 10);
            label = bucketStart.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            cursor.setDate(cursor.getDate() + 7);
        } else if(bucketType === 'month') {
            bucketEnd.setMonth(bucketEnd.getMonth() + 1, 0);
            bucketEnd.setHours(23, 59, 59, 999);
            if(bucketEnd > end) bucketEnd.setTime(end.getTime());
            key = bucketStart.toISOString().slice(0, 7);
            label = bucketStart.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
            cursor.setMonth(cursor.getMonth() + 1);
        } else {
            bucketEnd.setHours(23, 59, 59, 999);
            key = bucketStart.toISOString().slice(0, 10);
            label = bucketStart.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            cursor.setDate(cursor.getDate() + 1);
        }

        buckets.push({ key, label, start: bucketStart, end: bucketEnd, buyQty: 0, sellQty: 0, rateTotal: 0, rateQty: 0 });
    }

    return buckets;
}

function calculateCurrencyAverageCost(currency, transactions) {
    const code = String(currency?.code || '').toUpperCase();
    const stockNow = parseFloat(currency?.stock) || 0;
    if (stockNow <= 0) return { rate: 0, value: 0 };

    const currencyTransactions = transactions
        .filter(t => String(t?.valuta || t?.currency || '').toUpperCase() === code)
        .sort((a, b) => getDashboardTransactionTime(a) - getDashboardTransactionTime(b));

    const transactionNetQty = currencyTransactions.reduce((sum, t) => {
        const type = String(t.tipe || t.type || '').toUpperCase();
        const nominal = parseFloat(t.nominal ?? t.amount) || 0;
        if(type === 'BELI') return sum + nominal;
        if(type === 'JUAL') return sum - nominal;
        return sum;
    }, 0);

    const explicitInitialQty = currency?.initialStock ?? currency?.startingStock;
    const initialQty = explicitInitialQty !== undefined && explicitInitialQty !== null
        ? (parseFloat(explicitInitialQty) || 0)
        : Math.max(stockNow - transactionNetQty, 0);
    const initialRate = parseFloat(currency?.initial_rate_locked) || 0;
    const hasBuyTransaction = currencyTransactions.some(t => String(t.tipe || t.type || '').toUpperCase() === 'BELI');

    if (!hasBuyTransaction) {
        return {
            rate: initialRate,
            value: initialQty * initialRate
        };
    }

    let qty = initialQty;
    let totalCost = qty * initialRate;

    currencyTransactions.forEach(t => {
        const type = String(t.tipe || t.type || '').toUpperCase();
        const nominal = parseFloat(t.nominal ?? t.amount) || 0;
        const rate = parseFloat(t.rate) || 0;
        const total = parseFloat(t.total ?? t.totalIdr ?? t.totalIDR) || (nominal * rate);

        if(type === 'BELI') {
            qty += nominal;
            totalCost += total;
        } else if(type === 'JUAL') {
            const avgCost = qty > 0.0001 ? totalCost / qty : 0;
            qty -= nominal;
            totalCost -= nominal * avgCost;
            if(qty < 0) qty = 0;
            if(totalCost < 0) totalCost = 0;
        }
    });

    if(qty > 0.0001 && totalCost > 0) {
        const calculatedRate = totalCost / qty;
        if (isFinite(calculatedRate) && calculatedRate > 0) {
            return { rate: calculatedRate, value: stockNow * calculatedRate };
        }
    }

    const fallbackRate = parseFloat(currency?.avg_buy_rate ?? currency?.initial_rate_locked) || 0;
    return { rate: fallbackRate, value: stockNow * fallbackRate };
}

function renderChart(trxs, baseDateStr) {
    const ctx = document.getElementById('transactionChart').getContext('2d');
    const currencies = store.getCurrencies();
    populateDashboardChartCurrencySelect(currencies);
    syncDashboardChartControls();

    const rangeConfig = DASHBOARD_CHART_RANGES[dashboardChartRange] || DASHBOARD_CHART_RANGES['7H'];
    const currencySelect = document.getElementById('dashboardChartCurrency');
    const selectedCurrency = currencySelect ? currencySelect.value : 'ALL';
    const currencyLabel = selectedCurrency === 'ALL' ? 'Valas' : selectedCurrency;
    
    // Update chart title if specific date is pushed
    const chartTitleEl = document.getElementById('dashChartTitle');
    if(chartTitleEl) {
        const suffix = baseDateStr ? ' sampai ' + baseDateStr : ' terakhir';
        chartTitleEl.textContent = `Grafik Qty & Kurs (${rangeConfig.label}${suffix})`;
    }

    const { start, end } = getDashboardChartDateRange(baseDateStr, rangeConfig);
    const buckets = buildDashboardChartBuckets(start, end, rangeConfig.bucket);
    const sourceTransactions = selectedCurrency === 'ALL'
        ? trxs
        : trxs.filter(t => String(t.valuta || t.currency || '').toUpperCase() === selectedCurrency.toUpperCase());

    sourceTransactions.forEach(t => {
        const trxDate = new Date(t.timestamp || t.date || t.created_at || 0);
        if(isNaN(trxDate.getTime()) || trxDate < start || trxDate > end) return;

        const bucket = buckets.find(item => trxDate >= item.start && trxDate <= item.end);
        if(!bucket) return;

        const type = String(t.tipe || t.type || '').toUpperCase();
        const qty = parseFloat(t.nominal ?? t.amount) || 0;
        const trxRate = parseFloat(t.rate) || 0;

        if(type === 'BELI') bucket.buyQty += qty;
        if(type === 'JUAL') bucket.sellQty += qty;

        if(trxRate > 0 && qty > 0) {
            bucket.rateTotal += trxRate * qty;
            bucket.rateQty += qty;
        }
    });

    const labels = buckets.map(item => item.label);
    const buyQtyValues = buckets.map(item => item.buyQty);
    const sellQtyValues = buckets.map(item => item.sellQty);
    const rateValues = buckets.map(item => item.rateQty > 0 ? (item.rateTotal / item.rateQty) : null);
    const formatChartNumber = value => {
        const rounded = Math.abs(value) >= 100 ? 0 : 2;
        return (parseFloat(value) || 0).toLocaleString('id-ID', { maximumFractionDigits: rounded });
    };
    const datasets = [
        {
            type: 'line',
            label: `Qty Beli (${currencyLabel})`,
            data: buyQtyValues,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.14)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.35,
            yAxisID: 'yQty'
        },
        {
            type: 'line',
            label: `Qty Jual (${currencyLabel})`,
            data: sellQtyValues,
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.35,
            yAxisID: 'yQty'
        },
        {
            type: 'line',
            label: `Kurs Rata-rata (${currencyLabel})`,
            data: rateValues,
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.35,
            spanGaps: true,
            yAxisID: 'yRate'
        }
    ];

    if(mainChart) mainChart.destroy();
    
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    top: 4,
                    right: 8,
                    bottom: 0,
                    left: 0
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'start',
                    labels: {
                        color: '#CBD5E1',
                        boxWidth: 9,
                        boxHeight: 9,
                        usePointStyle: true,
                        padding: 10,
                        font: {
                            size: 11,
                            weight: '700'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const value = context.parsed.y || 0;
                            if(context.dataset.yAxisID === 'yRate') {
                                return `Kurs: ${utils.formatRate(value)}`;
                            }
                            return `${context.dataset.label}: ${formatChartNumber(value)}`;
                        }
                    }
                }
            },
            scales: {
                yQty: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    border: { dash: [5, 5] },
                    title: {
                        display: true,
                        text: 'Qty',
                        color: '#94A3B8'
                    },
                    ticks: {
                        color: '#94A3B8',
                        maxTicksLimit: 5,
                        callback: value => formatChartNumber(value)
                    }
                },
                yRate: {
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: {
                        display: true,
                        text: 'Kurs',
                        color: '#FBBF24'
                    },
                    ticks: {
                        color: '#FBBF24',
                        maxTicksLimit: 5,
                        callback: value => formatChartNumber(value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#94A3B8',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 6
                    }
                }
            }
        }
    });
}

// ==============================
// LAPORAN HARIAN LOGIC
// ==============================
function loadLaporanHarian() {
    const currencies = store.getCurrencies();
    const masterCurrencies = store.getMasterCurrencies();
    const mutasi = store.getMutations();
    const trxs = store.getTransactions();
    const expenses = store.getExpenses();
    const adjustments = store.getAdjustments();
    
    // 1. Stok Valas & Valuasi (Tabel Bawah)
    let htmlValas = '';
    let totalValuasi = 0;
    
    if(currencies.length === 0) {
        htmlValas = '<tr><td colspan="5" class="text-center text-muted">Belum ada data mata uang.</td></tr>';
    } else {
        currencies.forEach(c => {
            const mc = masterCurrencies.find(m => m.code === c.code) || { flag: '', country: '-' };
            const stock = parseFloat(c.stock) || 0;
            const modalCost = calculateCurrencyAverageCost(c, trxs);
            const modalRate = modalCost.rate;
            const rowValuasi = modalCost.value;
            totalValuasi += rowValuasi;
            
            // Re-use logic getFlagHtml if available, otherwise manual fallback
            let flagHtml = utils.getFlagHtml ? utils.getFlagHtml(c.code) : `<span class="currency-flag">${mc.flag} </span> ${c.code}`;
            
            htmlValas += `
                <tr>
                    <td>${flagHtml}</td>
                    <td>${mc.country}</td>
                    <td style="text-align:right;">${stock.toLocaleString()}</td>
                    <td style="text-align:right;">${utils.formatRate(modalRate)}</td>
                    <td style="text-align:right;">${utils.formatIdr(rowValuasi)}</td>
                </tr>
            `;
        });
    }
    const valBody = document.getElementById('harianValasTableBody');
    if(valBody) valBody.innerHTML = htmlValas;
    
    const totVal = document.getElementById('harianTotalValuasiAsing');
    if(totVal) totVal.textContent = utils.formatIdr(totalValuasi);
    
    // 2. Real-time Kas dan Bank (Kotak Atas)
    const kasAkhir = store.getCash();
    const bankBCA = store.getBankBCA();
    const bankMandiri = store.getBankMandiri();
    const totalBank = bankBCA + bankMandiri;
    
    if(document.getElementById('harianKasAkhir')) document.getElementById('harianKasAkhir').textContent = utils.formatIdr(kasAkhir);
    if(document.getElementById('harianTotalBank')) document.getElementById('harianTotalBank').textContent = utils.formatIdr(totalBank);
    if(document.getElementById('harianBankBCA')) document.getElementById('harianBankBCA').textContent = bankBCA.toLocaleString();
    if(document.getElementById('harianBankMandiri')) document.getElementById('harianBankMandiri').textContent = bankMandiri.toLocaleString();
    
    // 3. Profit Hari Ini & Reverse Kas Awal
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Filter List Transaksi Hari Ini
    const todayTrxs = trxs.filter(t => t.timestamp && t.timestamp.startsWith(todayStr));
    const todayMutasi = mutasi.filter(m => m.timestamp && m.timestamp.startsWith(todayStr));
    const todayExpenses = expenses.filter(e => e.timestamp && e.timestamp.startsWith(todayStr));
    const todayAdjustments = adjustments.filter(a => a.timestamp && a.timestamp.startsWith(todayStr));
    
    // Hitung Profit dan Pergerakan Kas Fisik IDR murni
    let todayProfit = 0;
    
    // Kita akan menghitung "Berapa banyak uang KAS FISIK yang MENGALIR hari ini?"
    // Nilai netKasChange (+) berarti Kas Fisik Bertambah hari ini (Nasabah bayar kas, mutasi masuk kas).
    // Nilai netKasChange (-) berarti Kas Fisik Berkurang hari ini.
    let netKasChange = 0; 
    
    // Kelompokkan mutasi berdasarkan Keterangan (Ref ID) untuk mengisolasi nilai Bank saat SPLIT
    const mutBankMap = {}; // key: Ref ID, value: nominal mutasi bank
    todayMutasi.forEach(m => {
        if(m.keterangan && m.keterangan.includes('Ref:')) {
            const match = m.keterangan.match(/Ref:\s*(INV-\d+)/);
            if(match && match[1]) {
                const ref = match[1];
                if(!mutBankMap[ref]) mutBankMap[ref] = 0;
                // 'MASUK' ke bank berarti mutasi positif ke bank, tapi kita simpan nilai absolutnya saja
                mutBankMap[ref] += (m.nominal || 0);
            }
        }
    });

    // Proses Transaksi
    // Karena satu invoice bisa punya beberapa item, kita hitung grand total IDR per invoice dulu
    const invMap = {};
    todayTrxs.forEach(t => {
        if(!invMap[t.id]) invMap[t.id] = { items: [], paymentMethod: t.paymentMethod, bank: t.bank };
        invMap[t.id].items.push(t);
    });

    Object.keys(invMap).forEach(invoiceId => {
        const inv = invMap[invoiceId];
        let invGrandTotal = 0; // Negative = MC Bayar (Customer Jual valas), Positive = MC Terima (Customer Beli valas)
        let invProfit = 0;
        
        inv.items.forEach(t => {
            const c = currencies.find(x => x.code === t.valuta);
            if(c) {
                if(t.tipe === 'JUAL') { // MC Jual valas, dapat IDR (Positif)
                    const avgModalRate = calculateCurrencyAverageCost(c, trxs).rate || c.buy || 0;
                    const gp = ((parseFloat(t.rate) || 0) - avgModalRate) * (parseFloat(t.nominal) || 0);
                    invProfit += gp;
                    invGrandTotal += t.total; // bertambah IDR
                } else { // MC Beli valas, keluar IDR (Negatif)
                    invGrandTotal -= t.total; // berkurang IDR
                }
            }
        });

        todayProfit += invProfit;

        // Tentukan porsi KAS yang berubah dari invoice ini
        let cashPortion = 0;
        if(inv.paymentMethod === 'CASH') {
            cashPortion = invGrandTotal; // 100% dari grand total masuk/keluar ke kas
        } else if(inv.paymentMethod === 'TRANSFER') {
            cashPortion = 0; // 0% ke kas, semua ke bank
        } else if(inv.paymentMethod === 'SPLIT') {
            // Karena split, porsi kas = (Total Besaran Invoice) dikurangi (Besaran Mutasi Bank untuk Invoice ini)
            const absGrandTotal = Math.abs(invGrandTotal);
            const mutBankVal = mutBankMap[invoiceId] || 0;
            const absCash = absGrandTotal - mutBankVal;
            
            // Pertahankan arah aliran (positif = uang masuk MC, negatif = uang keluar MC)
            cashPortion = invGrandTotal >= 0 ? absCash : -absCash;
        } else {
            // Jika undefined / lama
            cashPortion = invGrandTotal;
        }

        netKasChange += cashPortion;
    });
    
    // Pergerakan Mutasi Manual: 
    // Jika mutasi bukan karena transaksi (keterangan tidak mengandung Transaksi Valas)
    todayMutasi.forEach(m => {
        if(m.keterangan && m.keterangan.includes('Ref:')) return; // Sudah dihitung
        // Mutasi manual ini biasanya mempengaruhi Bank. Apakah bank ke kas? 
        // MC App biasanya mencatat Expense / Adjustment untuk kas. Mutasi di sini mungkin memotong Kas jika kas -> bank.
        // Berdasarkan logika app, jika mutasi dari Kas ke Bank dicatat sebagai MASUK (ke Bank), berarti Kas Berkurang.
        if (m.sumberBank === 'KAS' && m.tipe === 'MASUK') { // Bank bertambah, Kas berkurang
            netKasChange -= (m.nominal || 0); 
        } else if (m.bank === 'KAS' || m.keterangan.toLowerCase().includes('kas')) { // Fallback heuristik 
            // Jika ada pencatatan tarik tunai dari bank (KELUAR dari bank) berarti masuk ke Kas
            if(m.tipe === 'KELUAR' && m.keterangan.toLowerCase().includes('tarik')) netKasChange += (m.nominal || 0);
        }
    });
    
    // Pengeluaran / Expenses (Beban Kas)
    todayExpenses.forEach(e => {
        if(e.kasBank === 'CASH') netKasChange -= e.nominal;
    });
    
    // Penyesuaian Ekuitas / Modal Dasar
    todayAdjustments.forEach(a => {
        if(a.kasBank === 'CASH') {
            if(a.tipePergerakan === 'IN') netKasChange += a.nominal;
            else if(a.tipePergerakan === 'OUT') netKasChange -= a.nominal;
        }
    });

    // Reverse: Kas Saat Ini (Akhir) dikurangi dengan total pergerakan Kas Hari Ini
    const kasAwal = kasAkhir - netKasChange;

    if(document.getElementById('harianProfit')) document.getElementById('harianProfit').textContent = utils.formatIdr(todayProfit);
    if(document.getElementById('harianKasAwal')) document.getElementById('harianKasAwal').textContent = utils.formatIdr(kasAwal);
}

