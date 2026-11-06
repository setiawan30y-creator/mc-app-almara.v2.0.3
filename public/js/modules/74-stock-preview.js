// Dashboard: pratinjau penuh "Live Stok Valuta" @2026-Alifiandra
// Klik kartu Live Stok Valuta (atau tombol perbesar) -> tabel lengkap seluruh stok valas:
// bendera, kode, negara, stok, batas minimum, status, kurs beli/jual, modal rata-rata, nilai Rupiah.
// Angka stok berasal dari buku besar server (disalin oleh sync.js); tampilan ikut berubah otomatis
// saat ada perubahan dari akun lain.
(function () {
    'use strict';

    const S = { q: '', filter: 'all', sort: 'code', dir: 1, open: false };
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const qf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
    const rp = (n) => (typeof window.formatIdr === 'function' ? window.formatIdr(Math.round(n)) : 'Rp ' + Math.round(n).toLocaleString('id-ID'));
    const rate = (n) => {
        try { if (window.AlmaraApp && window.AlmaraApp.utils && window.AlmaraApp.utils.formatRate) return String(window.AlmaraApp.utils.formatRate(n || 0)).replace(/,0000$/, ''); } catch (e) { /* abaikan */ }
        return qf.format(n || 0);
    };

    function injectStyle() {
        if ($('sp-style')) return;
        const st = document.createElement('style');
        st.id = 'sp-style';
        st.textContent = `
        .stock-panel.sp-clickable .dsh-card-head h3 { cursor: pointer; }
        .stock-panel.sp-clickable .stock-list { cursor: zoom-in; }
        .sp-open-btn { border: 1px solid var(--mc-border, rgba(148,163,184,.35)); background: transparent; color: inherit; border-radius: 8px;
            width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: 0 0 auto; }
        .sp-open-btn:hover { background: rgba(148,163,184,.15); }
        .sp-ov { position: fixed; inset: 0; z-index: 10050; background: rgba(15,23,42,.55); display: flex; align-items: stretch; justify-content: center; padding: 24px; }
        .sp-md { background: var(--mc-card-bg, #fff); color: var(--mc-text, #0f172a); border-radius: 16px; width: 100%; max-width: 1280px;
            display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(0,0,0,.35); overflow: hidden; }
        .sp-hd { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--mc-border, rgba(148,163,184,.3)); flex-wrap: wrap; }
        .sp-hd h3 { margin: 0; font-size: 1.15rem; flex: 1 1 auto; }
        .sp-hd .sp-sub { font-size: .8rem; opacity: .7; font-weight: 500; display: block; margin-top: 2px; }
        .sp-x { border: 0; background: transparent; color: inherit; font-size: 1.6rem; line-height: 1; cursor: pointer; padding: 0 6px; }
        .sp-tools { display: flex; gap: 10px; align-items: center; padding: 12px 20px; flex-wrap: wrap; }
        .sp-tools input { flex: 1 1 220px; min-width: 160px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--mc-border, rgba(148,163,184,.4));
            background: var(--mc-input-bg, transparent); color: inherit; }
        .sp-chip { border: 1px solid var(--mc-border, rgba(148,163,184,.4)); background: transparent; color: inherit; border-radius: 999px; padding: 6px 14px;
            font-weight: 600; font-size: .82rem; cursor: pointer; }
        .sp-chip.on { background: var(--mc-primary, #10b981); border-color: var(--mc-primary, #10b981); color: #fff; }
        .sp-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; padding: 0 20px 12px; }
        .sp-sum div { border: 1px solid var(--mc-border, rgba(148,163,184,.3)); border-radius: 12px; padding: 10px 14px; }
        .sp-sum small { display: block; font-size: .72rem; opacity: .7; text-transform: uppercase; letter-spacing: .4px; font-weight: 700; }
        .sp-sum b { font-size: 1.1rem; }
        .sp-body { flex: 1 1 auto; overflow: auto; padding: 0 20px 16px; }
        .sp-tbl { width: 100%; border-collapse: collapse; font-size: .88rem; }
        .sp-tbl th { position: sticky; top: 0; background: var(--mc-card-bg, #fff); text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .4px;
            padding: 10px 8px; border-bottom: 2px solid var(--mc-border, rgba(148,163,184,.4)); cursor: pointer; white-space: nowrap; user-select: none; }
        .sp-tbl th.r, .sp-tbl td.r { text-align: right; }
        .sp-tbl td { padding: 9px 8px; border-bottom: 1px solid var(--mc-border, rgba(148,163,184,.2)); white-space: nowrap; }
        .sp-tbl tr:hover td { background: rgba(148,163,184,.08); }
        .sp-tbl tfoot td { font-weight: 800; border-top: 2px solid var(--mc-border, rgba(148,163,184,.4)); border-bottom: 0; }
        .sp-flag { width: 26px; height: 18px; object-fit: cover; border-radius: 3px; vertical-align: middle; box-shadow: 0 0 0 1px rgba(0,0,0,.08); }
        .sp-fb { display: inline-block; width: 26px; text-align: center; font-size: .7rem; font-weight: 800; opacity: .7; }
        .sp-code { font-weight: 800; margin-left: 8px; }
        .sp-st { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: .72rem; font-weight: 800; }
        .sp-st.ok { background: rgba(16,185,129,.15); color: #059669; }
        .sp-st.low { background: rgba(245,158,11,.18); color: #b45309; }
        .sp-st.out { background: rgba(239,68,68,.15); color: #dc2626; }
        .sp-buy { color: #059669; font-weight: 700; } .sp-sell { color: #dc2626; font-weight: 700; }
        .sp-ft { padding: 10px 20px; font-size: .75rem; opacity: .65; border-top: 1px solid var(--mc-border, rgba(148,163,184,.3)); }
        @media (max-width: 640px) { .sp-ov { padding: 0; } .sp-md { border-radius: 0; } }
        `;
        document.head.appendChild(st);
    }

    function currencies() { try { return (window.AlmaraApp.store.getCurrencies() || []).filter(Boolean); } catch (e) { return []; } }
    function masters() { try { return window.AlmaraApp.store.getMasterCurrencies ? window.AlmaraApp.store.getMasterCurrencies() || [] : []; } catch (e) { return []; } }
    async function transactions() {
        try { if (typeof window.getServerTransactionsLikeRwt === 'function') return await window.getServerTransactionsLikeRwt(); } catch (e) { /* abaikan */ }
        try { return window.AlmaraApp.store.getTransactions() || []; } catch (e) { return []; }
    }

    async function rows() {
        const trxs = await transactions();
        const ms = masters();
        return currencies().map((c) => {
            const code = String(c.code || '').toUpperCase();
            const base = code.substring(0, 3);
            const m = ms.find((x) => String(x.code || '').toUpperCase() === code) || ms.find((x) => String(x.code || '').toUpperCase() === base) || {};
            const stock = num(c.stock), min = num(c.alert);
            let cost = { rate: 0, value: 0 };
            try { if (typeof calculateCurrencyAverageCost === 'function') cost = calculateCurrencyAverageCost(c, trxs) || cost; } catch (e) { /* abaikan */ }
            const status = stock <= 0 ? 'out' : (stock <= min ? 'low' : 'ok');
            return {
                code, display: String(c.code || ''),
                name: code.length > 3 && String(m.code || '').toUpperCase() === base ? 'Turunan ' + base + (m.country ? ' · ' + m.country : '') : (m.country || m.currencyName || '-'),
                currencyName: m.currencyName || '', flag: String(m.countryCode || '').toLowerCase(),
                stock, min, status, buy: num(c.buy), sell: num(c.sell), avg: num(cost.rate), value: num(cost.value),
                trend: c.trend || ''
            };
        });
    }

    const STATUS = { ok: ['ok', 'Aman'], low: ['low', 'Menipis'], out: ['out', 'Habis'] };
    const COLS = [
        ['code', 'Valuta', ''], ['name', 'Negara / Nama', ''], ['stock', 'Stok', 'r'], ['min', 'Batas Min.', 'r'], ['status', 'Status', ''],
        ['buy', 'Kurs Beli', 'r'], ['sell', 'Kurs Jual', 'r'], ['avg', 'Modal Rata-rata', 'r'], ['value', 'Nilai (Rp)', 'r']
    ];

    async function render() {
        const box = $('spBody'); if (!box) return;
        let list = await rows();
        const all = list.slice();
        const q = S.q.trim().toLowerCase();
        if (q) list = list.filter((r) => [r.code, r.name, r.currencyName].join(' ').toLowerCase().includes(q));
        if (S.filter === 'low') list = list.filter((r) => r.status !== 'ok');
        if (S.filter === 'has') list = list.filter((r) => r.stock > 0);
        const order = { out: 0, low: 1, ok: 2 };
        list.sort((a, b) => {
            const k = S.sort;
            const va = k === 'status' ? order[a.status] : a[k], vb = k === 'status' ? order[b.status] : b[k];
            return (typeof va === 'string' ? String(va).localeCompare(String(vb)) : (va - vb)) * S.dir;
        });

        const totalValue = list.reduce((s, r) => s + r.value, 0);
        const sumBox = $('spSum');
        if (sumBox) {
            sumBox.innerHTML = `
                <div><small>Jumlah valuta</small><b>${all.length}</b></div>
                <div><small>Ada stok</small><b>${all.filter((r) => r.stock > 0).length}</b></div>
                <div><small>Menipis / habis</small><b style="color:#dc2626">${all.filter((r) => r.status !== 'ok').length}</b></div>
                <div><small>Total nilai (modal)</small><b>${esc(rp(all.reduce((s, r) => s + r.value, 0)))}</b></div>`;
        }

        const arrow = (k) => (S.sort === k ? (S.dir > 0 ? ' ▲' : ' ▼') : '');
        const trend = (t) => (t === 'up' ? ' <span style="color:#10b981">▲</span>' : t === 'down' ? ' <span style="color:#ef4444">▼</span>' : '');
        box.innerHTML = `
            <table class="sp-tbl">
                <thead><tr>${COLS.map(([k, l, cls]) => `<th class="${cls}" data-sp-sort="${k}">${l}${arrow(k)}</th>`).join('')}</tr></thead>
                <tbody>${list.length ? list.map((r) => `
                    <tr>
                        <td>${r.flag ? `<img class="sp-flag" src="https://flagcdn.com/w40/${esc(r.flag)}.png" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;sp-fb&quot;>${esc(r.code.substring(0, 2))}</span>'">` : `<span class="sp-fb">${esc(r.code.substring(0, 2))}</span>`}<span class="sp-code">${esc(r.display)}</span>${trend(r.trend)}</td>
                        <td>${esc(r.name)}${r.currencyName && r.name !== r.currencyName ? `<div style="font-size:.75rem;opacity:.65">${esc(r.currencyName)}</div>` : ''}</td>
                        <td class="r"><b>${esc(qf.format(r.stock))}</b></td>
                        <td class="r">${esc(qf.format(r.min))}</td>
                        <td><span class="sp-st ${STATUS[r.status][0]}">${STATUS[r.status][1]}</span></td>
                        <td class="r sp-buy">${esc(rate(r.buy))}</td>
                        <td class="r sp-sell">${esc(rate(r.sell))}</td>
                        <td class="r">${r.avg ? esc(rate(r.avg)) : '-'}</td>
                        <td class="r">${esc(rp(r.value))}</td>
                    </tr>`).join('') : `<tr><td colspan="9" style="text-align:center;opacity:.65;padding:24px">Tidak ada valuta yang cocok.</td></tr>`}
                </tbody>
                <tfoot><tr><td colspan="8">Total nilai (${list.length} valuta tampil)</td><td class="r">${esc(rp(totalValue))}</td></tr></tfoot>
            </table>`;
        const t = $('spTime'); if (t) t.textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID');
    }

    function open() {
        injectStyle();
        close();
        S.open = true;
        const ov = document.createElement('div');
        ov.className = 'sp-ov'; ov.id = 'spModal';
        ov.innerHTML = `
            <div class="sp-md" role="dialog" aria-modal="true" aria-label="Stok valuta lengkap">
                <div class="sp-hd">
                    <h3><i class="fa-solid fa-boxes-stacked"></i> Live Stok Valuta — Lengkap<span class="sp-sub">Stok dari buku besar server · <span id="spTime"></span></span></h3>
                    <button type="button" class="sp-x" data-sp="close" aria-label="Tutup">&times;</button>
                </div>
                <div class="sp-tools">
                    <input type="text" id="spSearch" placeholder="Cari kode, negara, atau nama mata uang..." value="${esc(S.q)}" autocomplete="off">
                    <button type="button" class="sp-chip ${S.filter === 'all' ? 'on' : ''}" data-sp-filter="all">Semua</button>
                    <button type="button" class="sp-chip ${S.filter === 'has' ? 'on' : ''}" data-sp-filter="has">Ada stok</button>
                    <button type="button" class="sp-chip ${S.filter === 'low' ? 'on' : ''}" data-sp-filter="low">Menipis / habis</button>
                </div>
                <div class="sp-sum" id="spSum"></div>
                <div class="sp-body" id="spBody"><div style="padding:24px;opacity:.65">Memuat...</div></div>
                <div class="sp-ft">Nilai = stok × modal rata-rata (sama dengan kartu Total Valuta). Klik judul kolom untuk mengurutkan.</div>
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
        ov.addEventListener('click', (e) => {
            const t = e.target.closest('[data-sp],[data-sp-filter],[data-sp-sort]');
            if (!t) return;
            if (t.dataset.sp === 'close') return close();
            if (t.dataset.spFilter) {
                S.filter = t.dataset.spFilter;
                ov.querySelectorAll('[data-sp-filter]').forEach((b) => b.classList.toggle('on', b.dataset.spFilter === S.filter));
                render();
            }
            if (t.dataset.spSort) {
                if (S.sort === t.dataset.spSort) S.dir = -S.dir; else { S.sort = t.dataset.spSort; S.dir = ['stock', 'value', 'buy', 'sell', 'avg', 'min'].includes(S.sort) ? -1 : 1; }
                render();
            }
        });
        $('spSearch').addEventListener('input', (e) => { S.q = e.target.value; render(); });
        setTimeout(() => { const i = $('spSearch'); if (i) i.focus(); }, 30);
        render();
    }
    function close() { const m = $('spModal'); if (m) m.remove(); S.open = false; }

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.open) close(); });
    // Data berubah dari akun lain / perangkat lain -> tabel ikut diperbarui.
    document.addEventListener('almara:data-changed', () => { if (S.open) render(); });

    function bind() {
        const list = $('dashboardStockList');
        const panel = list ? list.closest('.stock-panel') : null;
        if (!panel || panel.dataset.spBound) return;
        panel.dataset.spBound = '1';
        injectStyle();
        panel.classList.add('sp-clickable');
        const head = panel.querySelector('.dsh-card-head');
        if (head && !head.querySelector('.sp-open-btn')) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'sp-open-btn'; btn.title = 'Lihat semua stok (layar penuh)';
            btn.setAttribute('aria-label', 'Lihat semua stok valuta');
            btn.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>';
            head.appendChild(btn);
        }
        panel.addEventListener('click', (e) => {
            if (e.target.closest('input, .stock-search')) return; // kotak cari di kartu tetap berfungsi
            const keyword = ($('dashboardStockSearch') || {}).value || '';
            if (keyword && !S.open) S.q = keyword;
            open();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
    window.openStockPreview = open;
})();
