(function () {
    'use strict';

    const EDITOR_ID = 'almaraCurrencyDenominationEditor';
    const MASTER_KEY = 'mc_master_currencies';
    let initialized = false;
    let saveWrapped = false;

    const num = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function getMasterCurrencies() {
        try {
            if (typeof window.getMasterCurrencies === 'function') {
                const list = window.getMasterCurrencies();
                if (Array.isArray(list)) return list;
            }
        } catch (_) {}
        try {
            const list = JSON.parse(localStorage.getItem(MASTER_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (_) {
            return [];
        }
    }

    function saveMasterCurrencies(list) {
        const normalized = Array.isArray(list) ? list : [];
        try {
            if (typeof window.saveMasterCurrencies === 'function') {
                window.saveMasterCurrencies(normalized);
                return;
            }
        } catch (_) {}
        localStorage.setItem(MASTER_KEY, JSON.stringify(normalized));
        try {
            if (typeof window.pushToUniversalDatastore === 'function') {
                window.pushToUniversalDatastore(MASTER_KEY, normalized);
            }
        } catch (_) {}
    }

    function getCode() {
        return String(document.getElementById('modalCurCode')?.value || '').trim().toUpperCase();
    }

    function normalizeDenomination(item) {
        if (!item || typeof item !== 'object') return null;
        const value = num(item.value ?? item.denomination ?? item.nominal ?? item.amount);
        if (!(value > 0)) return null;
        const type = String(item.type || item.kind || 'banknote').toLowerCase() === 'coin' ? 'coin' : 'banknote';
        return {
            value,
            type,
            buyAdjustment: num(item.buyAdjustment ?? item.buy_adjustment ?? item.buy ?? 0),
            sellAdjustment: num(item.sellAdjustment ?? item.sell_adjustment ?? item.sell ?? 0),
            active: item.active !== false
        };
    }

    function getDenominationsForCode(code) {
        const upper = String(code || '').toUpperCase();
        const master = getMasterCurrencies().find(c => String(c?.code || '').toUpperCase() === upper);
        if (!master) return [];
        const source = master.denominations || {};
        const banknotes = Array.isArray(master.banknotes) ? master.banknotes : (Array.isArray(source.banknote) ? source.banknote : (Array.isArray(source.banknotes) ? source.banknotes : []));
        const coins = Array.isArray(master.coins) ? master.coins : (Array.isArray(source.coin) ? source.coin : (Array.isArray(source.coins) ? source.coins : []));
        return [
            ...banknotes.map(item => normalizeDenomination({ ...(typeof item === 'object' ? item : { value: item }), type: 'banknote' })),
            ...coins.map(item => normalizeDenomination({ ...(typeof item === 'object' ? item : { value: item }), type: 'coin' }))
        ].filter(Boolean).sort((a, b) => a.type.localeCompare(b.type) || a.value - b.value);
    }

    function getRowsFromEditor() {
        const editor = document.getElementById(EDITOR_ID);
        if (!editor) return [];
        return Array.from(editor.querySelectorAll('[data-denom-row]')).map(row => ({
            value: num(row.querySelector('[data-field="value"]')?.value),
            type: row.querySelector('[data-field="type"]')?.value === 'coin' ? 'coin' : 'banknote',
            buyAdjustment: num(row.querySelector('[data-field="buyAdjustment"]')?.value),
            sellAdjustment: num(row.querySelector('[data-field="sellAdjustment"]')?.value),
            active: !!row.querySelector('[data-field="active"]')?.checked
        })).filter(row => row.value > 0);
    }

    function persistDenominations(code, denominations) {
        const upper = String(code || '').trim().toUpperCase();
        if (!upper) return;

        const clean = denominations
            .map(normalizeDenomination)
            .filter(Boolean)
            .sort((a, b) => a.type.localeCompare(b.type) || a.value - b.value);

        const banknotes = clean.filter(d => d.type === 'banknote');
        const coins = clean.filter(d => d.type === 'coin');
        const current = getMasterCurrencies();
        const index = current.findIndex(c => String(c?.code || '').toUpperCase() === upper);

        const base = index >= 0 ? { ...current[index] } : {
            code: upper,
            buy: num(document.getElementById('modalCurBuy')?.value),
            sell: num(document.getElementById('modalCurSell')?.value),
            stock: num(document.getElementById('modalCurStock')?.value),
            alert: num(document.getElementById('modalCurAlert')?.value)
        };

        const updated = {
            ...base,
            code: upper,
            denominations: { banknote: banknotes, coin: coins },
            banknotes,
            coins,
            denominationUpdatedAt: new Date().toISOString()
        };

        if (index >= 0) current[index] = updated;
        else current.push(updated);
        saveMasterCurrencies(current);

        // Keep the runtime currency list aware of denominations as well.
        try {
            const currencies = typeof window.getCurrencies === 'function' ? window.getCurrencies() : [];
            if (Array.isArray(currencies)) {
                const i = currencies.findIndex(c => String(c?.code || '').toUpperCase() === upper);
                if (i >= 0) {
                    currencies[i] = { ...currencies[i], denominations: { banknote: banknotes, coin: coins }, banknotes, coins };
                    if (typeof window.saveCurrencies === 'function') window.saveCurrencies(currencies);
                }
            }
        } catch (_) {}
    }

    function rowHtml(item = { value: '', type: 'banknote', buyAdjustment: 0, sellAdjustment: 0, active: true }) {
        return `
            <div data-denom-row style="display:grid;grid-template-columns:minmax(120px,1fr) 130px minmax(120px,1fr) minmax(120px,1fr) 74px 42px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <input data-field="value" type="number" min="0" step="any" value="${esc(item.value)}" placeholder="100" class="form-control" style="min-height:40px;">
                <select data-field="type" class="form-control" style="min-height:40px;">
                    <option value="banknote" ${item.type === 'banknote' ? 'selected' : ''}>Uang Kertas</option>
                    <option value="coin" ${item.type === 'coin' ? 'selected' : ''}>Koin</option>
                </select>
                <input data-field="buyAdjustment" type="number" step="any" value="${esc(item.buyAdjustment)}" placeholder="0" class="form-control" style="min-height:40px;">
                <input data-field="sellAdjustment" type="number" step="any" value="${esc(item.sellAdjustment)}" placeholder="0" class="form-control" style="min-height:40px;">
                <label style="display:flex;justify-content:center;align-items:center;gap:5px;font-size:.8rem;font-weight:700;color:#334155;margin:0;">
                    <input data-field="active" type="checkbox" ${item.active !== false ? 'checked' : ''}> Aktif
                </label>
                <button type="button" data-remove-denom class="btn btn-sm" title="Hapus" style="height:40px;border:1px solid #fecaca;background:#fff1f2;color:#dc2626;border-radius:8px;">×</button>
            </div>`;
    }

    function renderRows(denominations) {
        const body = document.querySelector(`#${EDITOR_ID} [data-denom-body]`);
        if (!body) return;
        body.innerHTML = denominations.length
            ? denominations.map(rowHtml).join('')
            : '<div data-empty-denom style="padding:18px;text-align:center;color:#64748b;background:#f8fafc;border-radius:10px;">Belum ada pecahan. Klik <strong>+ Tambah Pecahan</strong> untuk mulai.</div>';
    }

    function ensureStyle() {
        if (document.getElementById('almara-denomination-editor-style')) return;
        const style = document.createElement('style');
        style.id = 'almara-denomination-editor-style';
        style.textContent = `
            #${EDITOR_ID}{margin-top:18px;border:1px solid #dbe4ee;border-radius:12px;background:#f8fafc;overflow:hidden}
            #${EDITOR_ID} .denom-head{padding:14px 16px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
            #${EDITOR_ID} .denom-title{font-size:1rem;font-weight:800;color:#0f172a}
            #${EDITOR_ID} .denom-sub{font-size:.78rem;color:#64748b;margin-top:3px}
            #${EDITOR_ID} .denom-table-head{display:grid;grid-template-columns:minmax(120px,1fr) 130px minmax(120px,1fr) minmax(120px,1fr) 74px 42px;gap:8px;padding:9px 16px;font-size:.72rem;font-weight:800;color:#475569;background:#f1f5f9}
            #${EDITOR_ID} .denom-body{padding:0 16px;background:#fff}
            #${EDITOR_ID} .denom-foot{padding:12px 16px;background:#f8fafc;color:#475569;font-size:.78rem}
            @media(max-width:850px){#${EDITOR_ID} .denom-table-head{display:none}#${EDITOR_ID} [data-denom-row]{grid-template-columns:1fr 1fr!important;padding:12px 0}#${EDITOR_ID} [data-denom-row] label{justify-content:flex-start!important}#${EDITOR_ID} [data-denom-row] button{grid-column:2}}
        `;
        document.head.appendChild(style);
    }

    function ensureEditor() {
        const modal = document.getElementById('currencyModal');
        const saveButton = modal?.querySelector('[onclick="saveCurrency()"]');
        if (!modal || !saveButton) return null;
        ensureStyle();
        let editor = document.getElementById(EDITOR_ID);
        if (!editor) {
            editor = document.createElement('section');
            editor.id = EDITOR_ID;
            editor.innerHTML = `
                <div class="denom-head">
                    <div><div class="denom-title">Daftar Pecahan Mata Uang</div><div class="denom-sub">Simpan pecahan per valuta dan atur selisih kurs beli/jual dari Base Rate.</div></div>
                    <div style="display:flex;gap:7px;flex-wrap:wrap;">
                        <button type="button" data-preset-usd class="btn btn-sm btn-outline" style="display:none;">Preset USD</button>
                        <button type="button" data-add-denom class="btn btn-sm btn-primary">+ Tambah Pecahan</button>
                    </div>
                </div>
                <div class="denom-table-head"><span>Pecahan</span><span>Jenis</span><span>Selisih Beli</span><span>Selisih Jual</span><span>Status</span><span></span></div>
                <div class="denom-body" data-denom-body></div>
                <div class="denom-foot">Contoh USD: 100, 50, 20, 10, 5, 1. Misalnya USD 10 dapat diberi selisih beli <strong>-300</strong> dan jual <strong>+300</strong>.</div>
            `;
            saveButton.parentElement?.insertBefore(editor, saveButton);
            editor.addEventListener('click', handleEditorClick);
        }
        return editor;
    }

    function updatePresetButton() {
        const button = document.querySelector(`#${EDITOR_ID} [data-preset-usd]`);
        if (!button) return;
        button.style.display = getCode() === 'USD' ? 'inline-flex' : 'none';
    }

    function refreshEditor() {
        const editor = ensureEditor();
        if (!editor) return;
        updatePresetButton();
        renderRows(getDenominationsForCode(getCode()));
    }

    function handleEditorClick(event) {
        const add = event.target.closest('[data-add-denom]');
        if (add) {
            const body = document.querySelector(`#${EDITOR_ID} [data-denom-body]`);
            if (!body) return;
            const empty = body.querySelector('[data-empty-denom]');
            if (empty) empty.remove();
            body.insertAdjacentHTML('beforeend', rowHtml({ value: '', type: 'banknote', buyAdjustment: 0, sellAdjustment: 0, active: true }));
            return;
        }

        const preset = event.target.closest('[data-preset-usd]');
        if (preset) {
            const existing = getRowsFromEditor();
            const values = [100, 50, 20, 10, 5, 1];
            const map = new Map(existing.map(item => [item.value, item]));
            values.forEach(value => {
                if (!map.has(value)) {
                    map.set(value, { value, type: 'banknote', buyAdjustment: value === 10 || value === 5 || value === 1 ? -300 : 0, sellAdjustment: value === 10 || value === 5 || value === 1 ? 300 : 0, active: true });
                }
            });
            renderRows(Array.from(map.values()).sort((a, b) => b.value - a.value));
            return;
        }

        const remove = event.target.closest('[data-remove-denom]');
        if (remove) {
            remove.closest('[data-denom-row]')?.remove();
        }
    }

    function wrapSaveCurrency() {
        if (saveWrapped || typeof window.saveCurrency !== 'function') return;
        const original = window.saveCurrency;
        window.saveCurrency = async function (...args) {
            const code = getCode();
            const denominations = getRowsFromEditor();
            if (code) persistDenominations(code, denominations);
            const result = original.apply(this, args);
            if (result && typeof result.then === 'function') await result;
            if (code) persistDenominations(code, denominations);
            return result;
        };
        saveWrapped = true;
    }

    function bindCodeChange() {
        const field = document.getElementById('modalCurCode');
        if (!field || field.dataset.denomEditorBound === '1') return;
        field.dataset.denomEditorBound = '1';
        field.addEventListener('change', refreshEditor);
        field.addEventListener('input', () => {
            window.clearTimeout(field.__denomRefreshTimer);
            field.__denomRefreshTimer = window.setTimeout(refreshEditor, 120);
        });
    }

    function observeModal() {
        const modal = document.getElementById('currencyModal');
        if (!modal || modal.dataset.denomEditorObserved === '1') return;
        modal.dataset.denomEditorObserved = '1';
        const observer = new MutationObserver(() => {
            ensureEditor();
            bindCodeChange();
            wrapSaveCurrency();
            updatePresetButton();
        });
        observer.observe(modal, { attributes: true, childList: true, subtree: true });
    }

    function boot() {
        if (initialized) return;
        initialized = true;
        ensureEditor();
        bindCodeChange();
        wrapSaveCurrency();
        observeModal();
        refreshEditor();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.AlmaraCurrencyDenominationEditor = {
        refresh: refreshEditor,
        getRows: getRowsFromEditor,
        persist: () => persistDenominations(getCode(), getRowsFromEditor())
    };
})();