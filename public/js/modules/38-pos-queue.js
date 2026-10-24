// Transaksi / POS - antrean nasabah & riwayat nasabah
// - Antrean: beberapa nasabah dilayani bersamaan, satu "form" per nasabah. Nomor invoice TIDAK dibuat
//   saat form dibuka, tetapi dialokasikan server saat transaksi disubmit (lihat allocatePosDocumentId di 03-pos.js).
// - Riwayat nasabah: 30 hari terakhir, dikelompokkan per 5 hari (menggantikan "5 invoice terakhir").
// Warna memakai variabel tema (--mc-*). Fungsi lama (renderPosDraftSessions, showCustomerHistory) diganti di sini.
(function () {
    'use strict';

    const DAYS_WINDOW = 30;
    const BLOCK_DAYS = 5;

    const $ = (id) => document.getElementById(id);
    const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rp = (n) => `Rp ${nf.format(Math.round(Number(n) || 0))}`;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    function injectStyle() {
        if ($('pq-style')) return;
        const st = document.createElement('style');
        st.id = 'pq-style';
        st.textContent = `
        #posDraftSessionList { --pq-bd: var(--mc-border, rgba(148,163,184,.3)); --pq-pri: var(--mc-primary, #22c55e); --pq-mut: var(--mc-text-muted, #94a3b8);
            --pq-ok: var(--mc-buy, #22c55e); --pq-card: var(--mc-card-bg, #18181b); --pq-tx: var(--mc-text, #fafafa);
            display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; }
        .pq-chip { display: flex; align-items: center; gap: 8px; border: 1px solid var(--pq-bd); background: var(--pq-card); color: var(--pq-tx); border-radius: 12px;
            padding: 7px 8px 7px 10px; cursor: pointer; min-width: 150px; max-width: 240px; text-align: left; font: inherit; position: relative; transition: border-color .15s, background .15s; }
        .pq-chip:hover { border-color: var(--pq-pri); }
        .pq-chip.on { border-color: var(--pq-pri); background: color-mix(in srgb, var(--pq-pri) 12%, var(--pq-card)); box-shadow: 0 0 0 1px var(--pq-pri) inset; }
        .pq-chip.done { opacity: .85; }
        .pq-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--pq-mut); flex: none; }
        .pq-chip.busy .pq-dot { background: var(--mc-warning, #f59e0b); } .pq-chip.done .pq-dot { background: var(--pq-ok); }
        .pq-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .pq-name { font-weight: 700; font-size: .84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pq-sub { font-size: .72rem; color: var(--pq-mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pq-x { border: 0; background: transparent; color: var(--pq-mut); cursor: pointer; font-size: 1rem; line-height: 1; padding: 2px 5px; border-radius: 6px; }
        .pq-x:hover { color: var(--mc-danger, #ef4444); background: color-mix(in srgb, var(--mc-danger, #ef4444) 12%, transparent); }
        .pq-tools { display: flex; align-items: center; gap: 6px; }
        .pq-link { border: 0; background: none; color: var(--pq-pri); cursor: pointer; font-size: .78rem; font-weight: 700; padding: 4px 6px; }
        .pq-empty { color: var(--pq-mut); font-size: .84rem; align-self: center; }

        .pqh { display: flex; flex-direction: column; gap: 6px; --pqh-bd: var(--mc-border, rgba(148,163,184,.3)); --pqh-mut: var(--mc-text-muted, #94a3b8); }
        .pqh details { border: 1px solid var(--pqh-bd); border-radius: 10px; overflow: hidden; }
        .pqh summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 10px; font-size: .78rem; }
        .pqh summary::-webkit-details-marker { display: none; }
        .pqh summary b { flex: 1; font-size: .8rem; } .pqh summary span { color: var(--pqh-mut); }
        .pqh details:not([open]) summary::after { content: '\\25B8'; color: var(--pqh-mut); } .pqh details[open] summary::after { content: '\\25BE'; color: var(--pqh-mut); }
        .pqh details.empty summary { opacity: .55; cursor: default; }
        .pqh-body { border-top: 1px solid var(--pqh-bd); padding: 6px 10px 8px; display: flex; flex-direction: column; gap: 8px; }
        .pqh-inv { font-size: .76rem; } .pqh-inv-top { display: flex; justify-content: space-between; gap: 8px; font-weight: 700; }
        .pqh-inv-top small { display: block; color: var(--pqh-mut); font-weight: 500; font-size: .68rem; }
        .pqh-line { color: var(--pqh-mut); padding-left: 2px; }
        .pqh-in { color: var(--mc-buy, #22c55e); } .pqh-out { color: var(--mc-danger, #ef4444); }
        .pqh-sum { display: flex; gap: 10px; font-size: .72rem; color: var(--pqh-mut); padding: 2px 2px 0; }`;
        document.head.appendChild(st);
    }

    // ---------------------------------------------------------------- antrean nasabah
    function cartTotal(cart) {
        return (Array.isArray(cart) ? cart : []).reduce((s, i) => s + (Number(i.totalIdr) || 0), 0);
    }

    window.renderPosDraftSessions = function () {
        const wrap = $('posDraftSessionList');
        if (!wrap) return;
        injectStyle();
        const sessions = getPosDraftSessions();
        if (!sessions.length) {
            wrap.innerHTML = '<span class="pq-empty">Belum ada nasabah dalam antrean. Tekan tombol + untuk memulai transaksi baru.</span>';
            document.querySelectorAll('#pos-view .pos-flow-card').forEach((card) => { card.style.display = 'none'; });
            return;
        }
        const activeId = getActivePosDraftId();
        const doneCount = sessions.filter((s) => s.completed).length;
        wrap.innerHTML = sessions.map((s, i) => {
            const items = Array.isArray(s.cart) ? s.cart.length : 0;
            const name = (s.fields && s.fields.customerSearch) || s.label || `Nasabah ${i + 1}`;
            const status = s.completed ? 'done' : (items ? 'busy' : '');
            const sub = s.completed
                ? `Selesai${s.fields && s.fields.invoice ? ' - ' + s.fields.invoice : ''}`
                : (items ? `${items} item - ${rp(cartTotal(s.cart))}` : 'Belum ada item');
            return `<div class="pq-chip ${s.id === activeId ? 'on' : ''} ${status}" role="button" tabindex="0" data-pq="switch" data-id="${esc(s.id)}" title="${esc(name)}">
                <i class="pq-dot"></i><span class="pq-main"><span class="pq-name">${esc(name)}</span><span class="pq-sub">${esc(sub)}</span></span>
                <button type="button" class="pq-x" data-pq="close" data-id="${esc(s.id)}" aria-label="Tutup antrean ini">&times;</button></div>`;
        }).join('') + (doneCount ? `<span class="pq-tools"><button type="button" class="pq-link" data-pq="clear-done">Bersihkan ${doneCount} yang selesai</button></span>` : '');
    };

    window.closePosDraftById = function (id) {
        saveActivePosDraftNow();
        const sessions = getPosDraftSessions();
        const target = sessions.find((x) => x.id === id);
        if (!target) return;
        const hasItems = !target.completed && Array.isArray(target.cart) && target.cart.length > 0;
        if (hasItems && !confirm('Antrean ini masih berisi item yang belum diproses. Tutup dan buang?')) return;
        const wasActive = getActivePosDraftId() === id;
        const rest = sessions.filter((x) => x.id !== id);
        savePosDraftSessions(rest);
        if (!rest.length) {
            activePosDraftIdMemory = '';
            localStorage.removeItem(POS_DRAFT_ACTIVE_KEY);
            currentCart = [];
            if (typeof renderCart === 'function') renderCart();
            window.renderPosDraftSessions();
            return;
        }
        if (wasActive) { setActivePosDraftId(rest[0].id); applyPosDraftToForm(rest[0]); } else window.renderPosDraftSessions();
    };

    window.clearCompletedPosDrafts = function () {
        saveActivePosDraftNow();
        const sessions = getPosDraftSessions();
        const activeId = getActivePosDraftId();
        const rest = sessions.filter((s) => !s.completed);
        if (rest.length === sessions.length) return;
        if (!rest.length) {
            savePosDraftSessions([]);
            activePosDraftIdMemory = '';
            localStorage.removeItem(POS_DRAFT_ACTIVE_KEY);
            currentCart = [];
            if (typeof renderCart === 'function') renderCart();
            window.renderPosDraftSessions();
            return;
        }
        savePosDraftSessions(rest);
        if (!rest.some((s) => s.id === activeId)) { setActivePosDraftId(rest[0].id); applyPosDraftToForm(rest[0]); } else window.renderPosDraftSessions();
    };

    function bindQueue() {
        if (window.__pqBound) return;
        window.__pqBound = true;
        document.addEventListener('click', (ev) => {
            const t = ev.target.closest ? ev.target.closest('#posDraftSessionList [data-pq]') : null;
            if (!t) return;
            ev.stopPropagation();
            const a = t.dataset.pq;
            if (a === 'close') window.closePosDraftById(t.dataset.id);
            else if (a === 'switch') window.switchPosDraftSession(t.dataset.id);
            else if (a === 'clear-done') window.clearCompletedPosDrafts();
        });
        document.addEventListener('keydown', (ev) => {
            if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('#posDraftSessionList .pq-chip')) {
                ev.preventDefault();
                window.switchPosDraftSession(ev.target.dataset.id);
            }
        });
    }

    // ---------------------------------------------------------------- riwayat nasabah per 5 hari
    const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const fmtDay = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;

    /** Kelompokkan transaksi nasabah 30 hari terakhir menjadi 6 blok @5 hari (blok 0 = terbaru, termasuk hari ini). */
    window.buildCustomerHistoryBlocks = function (transactions, customerId, now) {
        const today = dayStart(now || new Date());
        const blocks = [];
        for (let b = 0; b < DAYS_WINDOW / BLOCK_DAYS; b++) {
            const to = new Date(today); to.setDate(to.getDate() - b * BLOCK_DAYS);
            const from = new Date(to); from.setDate(from.getDate() - (BLOCK_DAYS - 1));
            blocks.push({ from, to, invoices: {} });
        }
        (Array.isArray(transactions) ? transactions : []).forEach((t) => {
            if (String(t.customerId || t.id_cif || '') !== String(customerId)) return;
            const ts = new Date(t.timestamp);
            if (Number.isNaN(ts.getTime())) return;
            const diff = Math.floor((today - dayStart(ts)) / 86400000);
            if (diff < 0 || diff >= DAYS_WINDOW) return;
            const block = blocks[Math.floor(diff / BLOCK_DAYS)];
            const key = t.id || t.itemId;
            const inv = block.invoices[key] || (block.invoices[key] = { id: t.id, timestamp: t.timestamp, items: [] });
            inv.items.push(t);
        });
        blocks.forEach((b) => {
            b.list = Object.values(b.invoices).sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp));
            b.jual = 0; b.beli = 0;
            b.list.forEach((inv) => inv.items.forEach((i) => { if (i.tipe === 'JUAL') b.jual += Number(i.total) || 0; else b.beli += Number(i.total) || 0; }));
        });
        return blocks;
    };

    window.showCustomerHistory = function () {
        const custId = ($('trxCustomer') && $('trxCustomer').value) || window._posLastProcessedCustomerId || '';
        const container = $('customerPosHistoryContainer');
        const listEl = $('customerPosHistoryList');
        if (!container || !listEl) return;
        if (!custId || custId === '-') { container.style.display = 'none'; return; }
        injectStyle();

        // almaraStore / almaraUtils di 03-pos.js adalah const lokal (bukan window.*), ambil dari window.AlmaraApp.
        const app = window.AlmaraApp || {};
        const store = app.store, utils = app.utils;
        const all = (store && store.getTransactions) ? store.getTransactions() : [];
        const blocks = window.buildCustomerHistoryBlocks(all, custId);
        const total = blocks.reduce((s, b) => s + b.list.length, 0);
        container.style.display = 'block';
        if (!total) { listEl.innerHTML = '<div style="text-align:center;color:var(--mc-text-muted,#64748b);font-style:italic;padding:5px;">Belum ada transaksi dalam 30 hari terakhir.</div>'; return; }

        const flag = (c) => (utils && utils.getFlagHtml ? utils.getFlagHtml(c) : esc(c));
        const rate = (r) => (utils && utils.formatRate ? utils.formatRate(r) : r);
        const dmy = (d) => (utils && utils.formatDateToDMY ? utils.formatDateToDMY(d) : String(d).slice(0, 10));
        let opened = false;
        listEl.className = 'pqh';
        listEl.innerHTML = blocks.map((b) => {
            const has = b.list.length > 0;
            const open = has && !opened ? (opened = true) : false;
            const head = `<summary><b>${fmtDay(b.from)} - ${fmtDay(b.to)}</b><span>${has ? `${b.list.length} invoice` : 'tidak ada transaksi'}</span></summary>`;
            if (!has) return `<details class="empty">${head}</details>`;
            const body = b.list.map((inv) => {
                let net = 0;
                const lines = inv.items.map((i) => {
                    net += i.tipe === 'JUAL' ? Number(i.total) || 0 : -(Number(i.total) || 0);
                    return `<div class="pqh-line"><span class="${i.tipe === 'BELI' ? 'pqh-in' : 'pqh-out'}"><b>${esc(i.tipe)}</b></span> ${nf.format(Number(i.nominal) || 0)} ${flag(i.valuta)} @ ${esc(rate(i.rate))}</div>`;
                }).join('');
                return `<div class="pqh-inv"><div class="pqh-inv-top"><span>${esc(dmy(inv.timestamp))}${inv.id ? `<small>${esc(inv.id)}</small>` : ''}</span><span class="${net >= 0 ? 'pqh-in' : 'pqh-out'}">${rp(Math.abs(net))}</span></div>${lines}</div>`;
            }).join('');
            return `<details ${open ? 'open' : ''}>${head}<div class="pqh-body">${body}<div class="pqh-sum"><span>Jual ${rp(b.jual)}</span><span>Beli ${rp(b.beli)}</span></div></div></details>`;
        }).join('');
    };

    function init() {
        injectStyle();
        bindQueue();
        const lbl = document.querySelector('#customerPosHistoryContainer > div');
        if (lbl && lbl.textContent.includes('5 Terakhir')) lbl.innerHTML = '<i class="fa-solid fa-history"></i> Riwayat Transaksi Nasabah (30 hari, per 5 hari)';
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
