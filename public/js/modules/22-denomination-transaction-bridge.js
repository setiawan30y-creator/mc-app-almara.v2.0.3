(function () {
    'use strict';

    const RATE_KEY = 'mc_currency_denomination_rates_v1';
    const TX_PENDING_KEY = 'mc_pending_denomination_items_v1';
    const STYLE_ID = 'almara-denomination-bridge-style';
    let wrapped = false;

    const n = (v, fallback = 0) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : fallback;
    };

    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

    function getRateMap() {
        try {
            const data = JSON.parse(localStorage.getItem(RATE_KEY) || '{}');
            return data && typeof data === 'object' ? data : {};
        } catch (_) { return {}; }
    }

    function saveRateMap(data) {
        localStorage.setItem(RATE_KEY, JSON.stringify(data || {}));
        if (typeof window.pushToUniversalDatastore === 'function') {
            try { window.pushToUniversalDatastore(RATE_KEY, data || {}); } catch (_) {}
        }
    }

    function rateKey(code, type, value) {
        return `${String(code || '').toUpperCase()}|${String(type || 'banknote').toLowerCase()}|${Number(value)}`;
    }

    function getAdjustment(code, type, value) {
        const map = getRateMap();
        const key = rateKey(code, type, value);
        const row = map[key] || {};
        return {
            buy: n(row.buyAdjustment ?? row.buy_adjustment ?? row.buy ?? 0),
            sell: n(row.sellAdjustment ?? row.sell_adjustment ?? row.sell ?? 0)
        };
    }

    function setAdjustment(code, type, value, buy, sell) {
        const map = getRateMap();
        map[rateKey(code, type, value)] = {
            code: String(code || '').toUpperCase(),
            type: String(type || 'banknote').toLowerCase(),
            value: n(value),
            buyAdjustment: n(buy),
            sellAdjustment: n(sell),
            updatedAt: new Date().toISOString()
        };
        saveRateMap(map);
    }

    function extractDenominations(currency) {
        if (!currency || typeof currency !== 'object') return { banknote: [], coin: [] };
        const source = currency.denominations || currency.denomination || currency.denoms || {};
        const bank = currency.banknotes || currency.banknote || source.banknote || source.banknotes || [];
        const coin = currency.coins || currency.coin || source.coin || source.coins || [];

        const normalize = (list) => (Array.isArray(list) ? list : []).map(item => {
            if (typeof item === 'number') return { value: item, active: true };
            if (typeof item === 'string') return { value: n(item), active: true };
            if (!item || typeof item !== 'object') return null;
            const value = item.value ?? item.denomination ?? item.nominal ?? item.amount;
            return {
                ...item,
                value: n(value),
                active: item.active !== false
            };
        }).filter(item => item && item.value > 0 && item.active !== false);

        return { banknote: normalize(bank), coin: normalize(coin) };
    }

    function getCurrencyMaster(code) {
        const list = window.AlmaraApp?.store?.getMasterCurrencies ? window.AlmaraApp.store.getMasterCurrencies() : [];
        return (Array.isArray(list) ? list : []).find(c => String(c?.code || '').toUpperCase() === String(code || '').toUpperCase()) || null;
    }

    function getCurrencyBase(code) {
        const list = window.AlmaraApp?.store?.getCurrencies ? window.AlmaraApp.store.getCurrencies() : [];
        return (Array.isArray(list) ? list : []).find(c => String(c?.code || '').toUpperCase() === String(code || '').toUpperCase()) || null;
    }

    function getTransactionRate(code, type, value) {
        const cur = getCurrencyBase(code) || {};
        const base = type === 'BELI' ? n(cur.buy ?? cur.base_buy) : n(cur.sell ?? cur.base_sell);
        const adj = getAdjustment(code, 'banknote', value);
        const adjustment = type === 'BELI' ? adj.buy : adj.sell;
        return { base, adjustment, final: base + adjustment };
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .almara-denom-tx-wrap{margin-top:10px;padding:11px 12px;border:1px solid #dbe4ef;border-radius:10px;background:#f8fafc}
            .almara-denom-tx-grid{display:grid;grid-template-columns:minmax(180px,1fr) 110px;gap:9px;align-items:end}
            .almara-denom-tx-wrap label{display:block;font-size:.78rem;font-weight:800;color:#334155;margin-bottom:5px}
            .almara-denom-tx-wrap select,.almara-denom-tx-wrap input{width:100%;box-sizing:border-box;min-height:40px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:8px 10px}
            .almara-denom-tx-meta{margin-top:8px;display:flex;flex-wrap:wrap;gap:7px;font-size:.75rem;color:#475569}
            .almara-denom-chip{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:700}
            .almara-denom-adjust{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#fff7ed;color:#c2410c;font-weight:700}
            .almara-denom-master-btn{border:1px solid #f59e0b;background:#fff7ed;color:#b45309;border-radius:7px;padding:5px 8px;font-size:.72rem;font-weight:800;cursor:pointer;margin-left:6px}
            .almara-denom-master-rate{font-size:.7rem;color:#64748b;margin-left:7px}
            @media(max-width:700px){.almara-denom-tx-grid{grid-template-columns:1fr}.almara-denom-tx-wrap{margin-top:8px}}
        `;
        document.head.appendChild(style);
    }

    function findCurrencyField() { return document.getElementById('trxCurrency'); }

    function ensureTransactionField() {
        const currency = findCurrencyField();
        if (!currency) return null;
        ensureStyle();

        let wrap = document.getElementById('almaraTransactionDenomination');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'almaraTransactionDenomination';
            wrap.className = 'almara-denom-tx-wrap';
            wrap.innerHTML = `
                <div class="almara-denom-tx-grid">
                    <div><label for="trxDenomination">Denominasi / Pecahan</label><select id="trxDenomination"><option value="">Pilih pecahan...</option></select></div>
                    <div><label for="trxDenominationQty">Jumlah</label><input id="trxDenominationQty" type="number" min="1" step="1" value="1"></div>
                </div>
                <div class="almara-denom-tx-meta"><span class="almara-denom-chip" id="trxDenominationNominal">Nominal: -</span><span class="almara-denom-adjust" id="trxDenominationAdjustment">Selisih kurs: Rp 0</span></div>
            `;
            const parent = currency.closest('.form-group') || currency.parentElement;
            if (parent && parent.parentElement) parent.parentElement.insertBefore(wrap, parent.nextSibling);
            else currency.insertAdjacentElement('afterend', wrap);
        }

        bindTransactionFieldEvents();
        populateTransactionDenominations();
        return wrap;
    }

    function bindTransactionFieldEvents() {
        const currency = document.getElementById('trxCurrency');
        const denom = document.getElementById('trxDenomination');
        const qty = document.getElementById('trxDenominationQty');
        if (!currency || !denom || !qty) return;
        if (currency.dataset.denomBridgeBound !== '1') {
            currency.dataset.denomBridgeBound = '1';
            currency.addEventListener('change', () => {
                populateTransactionDenominations();
                applyDenominationToRate();
            });
        }
        if (denom.dataset.denomBridgeBound !== '1') {
            denom.dataset.denomBridgeBound = '1';
            denom.addEventListener('change', () => {
                updateDenominationAmount();
                applyDenominationToRate();
            });
        }
        if (qty.dataset.denomBridgeBound !== '1') {
            qty.dataset.denomBridgeBound = '1';
            qty.addEventListener('input', () => updateDenominationAmount());
        }

        const type = document.getElementById('trxType');
        if (type && type.dataset.denomBridgeBound !== '1') {
            type.dataset.denomBridgeBound = '1';
            type.addEventListener('change', () => applyDenominationToRate());
        }
    }

    function populateTransactionDenominations() {
        const select = document.getElementById('trxDenomination');
        const codeEl = document.getElementById('trxCurrency');
        if (!select || !codeEl) return;
        const code = String(codeEl.value || '').toUpperCase();
        const master = getCurrencyMaster(code);
        const denoms = extractDenominations(master);
        const all = [
            ...denoms.banknote.map(d => ({ ...d, kind: 'banknote' })),
            ...denoms.coin.map(d => ({ ...d, kind: 'coin' }))
        ];
        const current = select.value;
        select.innerHTML = '<option value="">Pilih pecahan...</option>' + all.map(d => {
            const adj = getAdjustment(code, d.kind, d.value);
            const type = document.getElementById('trxType')?.value || 'BELI';
            const delta = type === 'BELI' ? adj.buy : adj.sell;
            const deltaText = delta ? ` • ${delta > 0 ? '+' : ''}${delta.toLocaleString('id-ID')}` : '';
            return `<option value="${esc(d.kind)}:${esc(d.value)}">${esc(code)} ${esc(d.value.toLocaleString('id-ID'))} ${d.kind === 'coin' ? 'Koin' : 'Banknote'}${esc(deltaText)}</option>`;
        }).join('');
        if (current && Array.from(select.options).some(o => o.value === current)) select.value = current;
        select.disabled = !code || all.length === 0;
        updateDenominationAmount(false);
        applyDenominationToRate();
    }

    function selectedDenomination() {
        const select = document.getElementById('trxDenomination');
        if (!select || !select.value) return null;
        const [kind, rawValue] = select.value.split(':');
        const value = n(rawValue);
        return value > 0 ? { kind, value } : null;
    }

    function updateDenominationAmount(resetQty = false) {
        const selected = selectedDenomination();
        const qtyEl = document.getElementById('trxDenominationQty');
        const amountEl = document.getElementById('trxAmount');
        const nominalEl = document.getElementById('trxDenominationNominal');
        if (!qtyEl || !amountEl || !nominalEl) return;
        if (!selected) {
            nominalEl.textContent = 'Nominal: -';
            return;
        }
        if (resetQty || !n(qtyEl.value)) qtyEl.value = '1';
        const qty = Math.max(1, Math.floor(n(qtyEl.value, 1)));
        qtyEl.value = String(qty);
        const nominal = selected.value * qty;
        amountEl.value = nominal;
        nominalEl.textContent = `Nominal: ${nominal.toLocaleString('id-ID')} ${String(document.getElementById('trxCurrency')?.value || '').toUpperCase()}`;
        amountEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function applyDenominationToRate() {
        const code = String(document.getElementById('trxCurrency')?.value || '').toUpperCase();
        const selected = selectedDenomination();
        const type = String(document.getElementById('trxType')?.value || 'BELI').toUpperCase();
        const rateEl = document.getElementById('trxRate');
        const modeEl = document.getElementById('trxRateMode');
        const adjustEl = document.getElementById('trxDenominationAdjustment');
        if (!rateEl || !modeEl || !adjustEl) return;
        if (!code || !selected) {
            adjustEl.textContent = 'Selisih kurs: Rp 0';
            return;
        }
        const adj = getAdjustment(code, selected.kind, selected.value);
        const adjustment = type === 'BELI' ? adj.buy : adj.sell;
        const base = getCurrencyBase(code);
        const baseRate = base ? n(type === 'BELI' ? base.buy : base.sell) : 0;
        adjustEl.textContent = `Selisih kurs: ${adjustment > 0 ? '+' : ''}${adjustment.toLocaleString('id-ID')} • Acuan Rp ${baseRate.toLocaleString('id-ID')}`;
        if (modeEl.value !== 'MANUAL') {
            rateEl.value = baseRate + adjustment;
            rateEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function queuePendingDenomination(type, code, amount, rate, denomination) {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(TX_PENDING_KEY) || '[]'); } catch (_) { list = []; }
        list.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, code, amount, rate, denomination, createdAt: Date.now() });
        list = list.filter(x => Date.now() - n(x.createdAt) < 6 * 60 * 60 * 1000).slice(-100);
        localStorage.setItem(TX_PENDING_KEY, JSON.stringify(list));
    }

    function takePendingForTransaction(row) {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(TX_PENDING_KEY) || '[]'); } catch (_) { list = []; }
        const type = String(row?.tipe || row?.type || '').toUpperCase();
        const code = String(row?.valuta || row?.curCode || row?.currency || '').toUpperCase();
        const amount = n(row?.nominal ?? row?.amount);
        const rate = n(row?.rate);
        const idx = list.findIndex(x => String(x.type).toUpperCase() === type && String(x.code).toUpperCase() === code && Math.abs(n(x.amount) - amount) < 0.000001 && Math.abs(n(x.rate) - rate) < 0.000001);
        if (idx < 0) return null;
        const match = list.splice(idx, 1)[0];
        localStorage.setItem(TX_PENDING_KEY, JSON.stringify(list));
        return match;
    }

    function wrapAddToCart() {
        if (wrapped || typeof window.addToCart !== 'function') return;
        const original = window.addToCart;
        window.addToCart = async function (...args) {
            const selected = selectedDenomination();
            const code = String(document.getElementById('trxCurrency')?.value || '').toUpperCase();
            const type = String(document.getElementById('trxType')?.value || 'BELI').toUpperCase();
            const amount = n(document.getElementById('trxAmount')?.value);
            const rate = n(document.getElementById('trxRate')?.value);
            const qty = n(document.getElementById('trxDenominationQty')?.value, 1);
            const result = await original.apply(this, args);
            if (selected && code && amount > 0 && rate > 0) {
                queuePendingDenomination(type, code, amount, rate, {
                    type: selected.kind,
                    value: selected.value,
                    quantity: qty,
                    adjustment: getAdjustment(code, selected.kind, selected.value)[type === 'BELI' ? 'buy' : 'sell']
                });
                const row = document.querySelector('.pos-cart-row:last-child');
                if (row && !row.querySelector('.almara-cart-denom')) {
                    const label = document.createElement('div');
                    label.className = 'almara-cart-denom';
                    label.style.cssText = 'font-size:.68rem;color:#2563eb;font-weight:700;';
                    label.textContent = `${code} ${selected.value.toLocaleString('id-ID')} × ${qty}`;
                    row.querySelector('strong')?.parentElement?.appendChild(label);
                }
            }
            return result;
        };
        wrapped = true;
    }

    function wrapSaveTransactions() {
        const store = window.AlmaraApp?.store;
        if (!store || typeof store.saveTransactions !== 'function' || store.saveTransactions.__denomBridgeWrapped) return;
        const original = store.saveTransactions;
        const wrappedSave = function (data) {
            const rows = Array.isArray(data) ? data.map(row => ({ ...row })) : [];
            rows.forEach(row => {
                if (row && !row.denomination_value) {
                    const match = takePendingForTransaction(row);
                    if (match) {
                        row.denomination_type = match.denomination.type;
                        row.denomination_value = match.denomination.value;
                        row.denomination_quantity = match.denomination.quantity;
                        row.denomination_adjustment = match.denomination.adjustment;
                    }
                }
            });
            return original.call(this, rows);
        };
        wrappedSave.__denomBridgeWrapped = true;
        store.saveTransactions = wrappedSave;
    }

    function enhanceMasterRows() {
        const modal = document.getElementById('currencyModal');
        if (!modal || !document.getElementById('modalCurCode')) return;
        const code = String(document.getElementById('modalCurCode').value || '').toUpperCase();
        if (!code) return;
        ['cmBanknoteTable', 'cmCoinTable'].forEach((tableId) => {
            const box = document.getElementById(tableId);
            if (!box) return;
            const type = tableId === 'cmCoinTable' ? 'coin' : 'banknote';
            box.querySelectorAll('tr').forEach(row => {
                if (row.querySelector('.almara-denom-master-btn')) return;
                const firstCell = row.querySelector('td');
                if (!firstCell) return;
                const value = n(String(firstCell.textContent || '').replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.'));
                if (!(value > 0)) return;
                const actions = row.querySelector('.almara-cm-actions') || row.lastElementChild;
                if (!actions) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'almara-denom-master-btn';
                btn.textContent = 'Atur Selisih';
                const adj = getAdjustment(code, type, value);
                const badge = document.createElement('span');
                badge.className = 'almara-denom-master-rate';
                badge.textContent = `B ${adj.buy >= 0 ? '+' : ''}${adj.buy.toLocaleString('id-ID')} / J ${adj.sell >= 0 ? '+' : ''}${adj.sell.toLocaleString('id-ID')}`;
                btn.onclick = () => openAdjustmentDialog(code, type, value);
                actions.appendChild(btn);
                actions.appendChild(badge);
            });
        });
    }

    async function openAdjustmentDialog(code, type, value) {
        const current = getAdjustment(code, type, value);
        if (typeof Swal === 'undefined') {
            const buy = prompt(`Selisih Beli ${code} ${value}:`, current.buy);
            if (buy === null) return;
            const sell = prompt(`Selisih Jual ${code} ${value}:`, current.sell);
            if (sell === null) return;
            setAdjustment(code, type, value, buy, sell);
            enhanceMasterRows();
            return;
        }
        const result = await Swal.fire({
            title: `Selisih Kurs ${code} ${value}`,
            html: `<div style="text-align:left"><label>Selisih Beli</label><input id="denomBuyAdj" class="swal2-input" type="number" value="${esc(current.buy)}"><small>Contoh -300 = kurs acuan dikurangi Rp300</small><label style="display:block;margin-top:10px">Selisih Jual</label><input id="denomSellAdj" class="swal2-input" type="number" value="${esc(current.sell)}"></div>`,
            showCancelButton: true,
            confirmButtonText: 'Simpan Selisih',
            cancelButtonText: 'Batal',
            preConfirm: () => ({
                buy: n(document.getElementById('denomBuyAdj')?.value),
                sell: n(document.getElementById('denomSellAdj')?.value)
            })
        });
        if (!result.isConfirmed) return;
        setAdjustment(code, type, value, result.value.buy, result.value.sell);
        enhanceMasterRows();
        populateTransactionDenominations();
        applyDenominationToRate();
    }

    function boot() {
        ensureStyle();
        ensureTransactionField();
        wrapAddToCart();
        wrapSaveTransactions();
        enhanceMasterRows();
        const observer = new MutationObserver(() => {
            ensureTransactionField();
            wrapAddToCart();
            wrapSaveTransactions();
            enhanceMasterRows();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.setInterval(() => {
            wrapAddToCart();
            wrapSaveTransactions();
            enhanceMasterRows();
        }, 1000);
    }

    window.AlmaraDenominationBridge = {
        getAdjustment,
        setAdjustment,
        extractDenominations,
        populateTransactionDenominations,
        applyDenominationToRate
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
