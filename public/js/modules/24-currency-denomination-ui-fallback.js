(function () {
    'use strict';

    const EDITOR_ID = 'almaraCurrencyDenominationEditor';
    const MASTER_KEY = 'mc_master_currencies';

    const num = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const esc = (value) => String(value ?? '').replace(/[&<>\"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function getMaster() {
        try {
            if (typeof window.getMasterCurrencies === 'function') {
                const data = window.getMasterCurrencies();
                if (Array.isArray(data)) return data;
            }
        } catch (_) {}
        try {
            const data = JSON.parse(localStorage.getItem(MASTER_KEY) || '[]');
            return Array.isArray(data) ? data : [];
        } catch (_) { return []; }
    }

    function saveMaster(list) {
        try {
            if (typeof window.saveMasterCurrencies === 'function') {
                window.saveMasterCurrencies(list);
                return;
            }
        } catch (_) {}
        localStorage.setItem(MASTER_KEY, JSON.stringify(list));
        try {
            if (typeof window.pushToUniversalDatastore === 'function') {
                window.pushToUniversalDatastore(MASTER_KEY, list);
            }
        } catch (_) {}
    }

    function code() {
        return String(document.getElementById('modalCurCode')?.value || '').trim().toUpperCase();
    }

    function normalize(item) {
        if (!item || typeof item !== 'object') return null;
        const value = num(item.value ?? item.denomination ?? item.nominal);
        if (!(value > 0)) return null;
        return {
            value,
            type: String(item.type || 'banknote') === 'coin' ? 'coin' : 'banknote',
            buyAdjustment: num(item.buyAdjustment ?? item.buy_adjustment ?? 0),
            sellAdjustment: num(item.sellAdjustment ?? item.sell_adjustment ?? 0),
            active: item.active !== false
        };
    }

    function existing() {
        const c = code();
        const item = getMaster().find(x => String(x?.code || '').toUpperCase() === c);
        if (!item) return [];
        const source = item.denominations || {};
        const banknotes = Array.isArray(item.banknotes) ? item.banknotes : (Array.isArray(source.banknote) ? source.banknote : []);
        const coins = Array.isArray(item.coins) ? item.coins : (Array.isArray(source.coin) ? source.coin : []);
        return [...banknotes, ...coins].map(x => normalize(typeof x === 'object' ? x : { value: x })).filter(Boolean).sort((a,b) => b.value-a.value);
    }

    function row(item = {}) {
        const type = item.type === 'coin' ? 'coin' : 'banknote';
        return `<div data-denom-row class="almara-denom-row">
            <input data-field="value" type="number" min="0" step="any" value="${esc(item.value ?? '')}" placeholder="100">
            <select data-field="type"><option value="banknote" ${type === 'banknote' ? 'selected' : ''}>Uang Kertas</option><option value="coin" ${type === 'coin' ? 'selected' : ''}>Koin</option></select>
            <input data-field="buyAdjustment" type="number" step="any" value="${esc(item.buyAdjustment ?? 0)}" placeholder="0">
            <input data-field="sellAdjustment" type="number" step="any" value="${esc(item.sellAdjustment ?? 0)}" placeholder="0">
            <label><input data-field="active" type="checkbox" ${item.active !== false ? 'checked' : ''}> Aktif</label>
            <button type="button" data-remove title="Hapus">×</button>
        </div>`;
    }

    function rows() {
        return Array.from(document.querySelectorAll(`#${EDITOR_ID} [data-denom-row]`)).map(r => normalize({
            value: r.querySelector('[data-field="value"]')?.value,
            type: r.querySelector('[data-field="type"]')?.value,
            buyAdjustment: r.querySelector('[data-field="buyAdjustment"]')?.value,
            sellAdjustment: r.querySelector('[data-field="sellAdjustment"]')?.value,
            active: !!r.querySelector('[data-field="active"]')?.checked
        })).filter(Boolean);
    }

    function persist() {
        const c = code();
        if (!c) return;
        const list = getMaster();
        let index = list.findIndex(x => String(x?.code || '').toUpperCase() === c);
        if (index < 0) {
            list.push({ code: c, buy: num(document.getElementById('modalCurBuy')?.value), sell: num(document.getElementById('modalCurSell')?.value) });
            index = list.length - 1;
        }
        const clean = rows();
        const banknotes = clean.filter(x => x.type === 'banknote');
        const coins = clean.filter(x => x.type === 'coin');
        list[index] = { ...list[index], code: c, denominations: { banknote: banknotes, coin: coins }, banknotes, coins, denominationUpdatedAt: new Date().toISOString() };
        saveMaster(list);
        try {
            const runtime = typeof window.getCurrencies === 'function' ? window.getCurrencies() : [];
            if (Array.isArray(runtime)) {
                const ri = runtime.findIndex(x => String(x?.code || '').toUpperCase() === c);
                if (ri >= 0 && typeof window.saveCurrencies === 'function') {
                    runtime[ri] = { ...runtime[ri], denominations: { banknote: banknotes, coin: coins }, banknotes, coins };
                    window.saveCurrencies(runtime);
                }
            }
        } catch (_) {}
    }

    function render() {
        const body = document.querySelector(`#${EDITOR_ID} [data-denom-body]`);
        if (!body) return;
        const data = existing();
        body.innerHTML = data.length ? data.map(row).join('') : '<div class="almara-denom-empty">Belum ada pecahan. Klik <b>+ Tambah Pecahan</b> atau <b>Preset USD</b>.</div>';
        const preset = document.querySelector(`#${EDITOR_ID} [data-preset-usd]`);
        if (preset) preset.style.display = code() === 'USD' ? 'inline-flex' : 'none';
    }

    function addEditor() {
        const modal = document.getElementById('currencyModal');
        if (!modal) return null;
        // Master UI baru sudah memiliki editor denominasi sendiri.
        // Jangan inject fallback kedua karena dapat mengacaukan scroll dan proses simpan.
        if (modal.querySelector('.almara-currency-modal')) return null;
        let editor = document.getElementById(EDITOR_ID);
        if (editor) return editor;

        editor = document.createElement('section');
        editor.id = EDITOR_ID;
        editor.innerHTML = `<div class="almara-denom-head"><div><div class="almara-denom-title">Daftar Pecahan Mata Uang</div><div class="almara-denom-sub">Input pecahan fisik dan atur selisih kurs per pecahan.</div></div><div class="almara-denom-actions"><button type="button" data-preset-usd>Preset USD</button><button type="button" data-add>+ Tambah Pecahan</button></div></div><div class="almara-denom-headrow"><span>Pecahan</span><span>Jenis</span><span>Selisih Beli</span><span>Selisih Jual</span><span>Status</span><span></span></div><div data-denom-body class="almara-denom-body"></div><div class="almara-denom-note">Contoh: USD 100/50/20 normal, USD 10 dapat diberi selisih -300/+300.</div>`;

        const style = document.createElement('style');
        style.id = 'almara-denom-fallback-style';
        style.textContent = `#${EDITOR_ID}{margin:20px 0;border:1px solid #d7e1eb;border-radius:14px;background:#f8fafc;overflow:hidden;width:100%;box-sizing:border-box}.almara-denom-head{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:16px;background:#fff;border-bottom:1px solid #e2e8f0}.almara-denom-title{font-size:18px;font-weight:800;color:#17212b}.almara-denom-sub{font-size:13px;color:#64748b;margin-top:4px}.almara-denom-actions{display:flex;gap:8px;flex-wrap:wrap}.almara-denom-actions button{border:1px solid #0f766e;background:#fff;color:#0f766e;border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer}.almara-denom-actions button[data-add]{background:#0f766e;color:#fff}.almara-denom-headrow,.almara-denom-row{display:grid;grid-template-columns:1fr 1.05fr 1fr 1fr 90px 42px;gap:9px;align-items:center}.almara-denom-headrow{padding:10px 16px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:800}.almara-denom-body{padding:0 16px;background:#fff}.almara-denom-row{padding:10px 0;border-bottom:1px solid #e2e8f0}.almara-denom-row input[type=number],.almara-denom-row select{width:100%;min-height:42px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;background:#fff;font-size:14px}.almara-denom-row label{font-size:12px;font-weight:700;color:#334155}.almara-denom-row button{height:40px;border:1px solid #fecaca;background:#fff1f2;color:#dc2626;border-radius:8px;font-size:20px;cursor:pointer}.almara-denom-empty{text-align:center;padding:22px;color:#64748b;background:#f8fafc;margin:10px 0;border-radius:10px}.almara-denom-note{padding:12px 16px;background:#f0fdf4;color:#166534;font-size:12px}.almara-denom-actions [data-preset-usd]{display:none}@media(max-width:850px){.almara-denom-headrow{display:none}.almara-denom-row{grid-template-columns:1fr 1fr}.almara-denom-row button{grid-column:2}.almara-denom-head{align-items:flex-start;flex-direction:column}}`;
        if (!document.getElementById(style.id)) document.head.appendChild(style);

        const form = modal.querySelector('form');
        const footer = modal.querySelector('.modal-footer, [class*="modal-footer"]');
        const codeField = document.getElementById('modalCurCode');
        const anchor = footer || form || codeField?.closest('div') || modal.lastElementChild || modal;
        if (footer) footer.parentElement.insertBefore(editor, footer);
        else if (form) form.appendChild(editor);
        else anchor.parentElement ? anchor.parentElement.insertBefore(editor, anchor.nextSibling) : modal.appendChild(editor);

        editor.addEventListener('click', e => {
            if (e.target.closest('[data-add]')) {
                const body = editor.querySelector('[data-denom-body]');
                if (body.querySelector('.almara-denom-empty')) body.innerHTML = '';
                body.insertAdjacentHTML('beforeend', row());
            }
            if (e.target.closest('[data-remove]')) e.target.closest('[data-denom-row]')?.remove();
            if (e.target.closest('[data-preset-usd]')) {
                const values = [100,50,20,10,5,1];
                render();
                const current = rows();
                const map = new Map(current.map(x => [x.value, x]));
                values.forEach(v => { if (!map.has(v)) map.set(v, {value:v,type:'banknote',buyAdjustment:[10,5,1].includes(v)?-300:0,sellAdjustment:[10,5,1].includes(v)?300:0,active:true}); });
                editor.querySelector('[data-denom-body]').innerHTML = Array.from(map.values()).sort((a,b)=>b.value-a.value).map(row).join('');
            }
        });

        codeField?.addEventListener('change', render);
        render();
        return editor;
    }

    function bindSave() {
        const modal = document.getElementById('currencyModal');
        if (!modal || modal.querySelector('.almara-currency-modal') || modal.dataset.denomFallbackSave === '1') return;
        modal.dataset.denomFallbackSave = '1';
        modal.addEventListener('click', e => {
            const button = e.target.closest('button, input[type=submit]');
            if (!button) return;
            const text = String(button.textContent || button.value || '').trim().toLowerCase();
            if (text.includes('simpan')) persist();
        }, true);
    }

    function boot() {
        addEditor();
        bindSave();
        const modal = document.getElementById('currencyModal');
        if (modal && modal.dataset.denomFallbackObserver !== '1') {
            modal.dataset.denomFallbackObserver = '1';
            new MutationObserver(() => { addEditor(); bindSave(); }).observe(modal, {childList:true,subtree:true});
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    setTimeout(boot, 500);
    setTimeout(boot, 1500);
})();
