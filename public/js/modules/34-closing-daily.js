// Closing Harian
// Semua angka berasal dari ledger ERP lewat /api/closing/*. Browser hanya menampilkan dan
// mengirim hasil hitung fisik; server menghitung ulang total dari pecahan.
// Warna memakai variabel tema (--mc-*), sehingga ikut Tema & Tampilan.
(function () {
    'use strict';

    const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
    const VARIANCE_ROLES = ['owner', 'superadmin', 'admin', 'supervisor'];
    const REOPEN_ROLES = ['owner', 'superadmin'];
    const DRAFT_KEY = (date) => `mc_closing_draft_${date}`;

    const STATUS = {
        NONE: { label: 'Belum closing', tone: 'mut', icon: 'fa-circle-dot' },
        TEMPORARY: { label: 'Tersimpan sementara', tone: 'warn', icon: 'fa-floppy-disk' },
        SHORT: { label: 'Belum final - kurang', tone: 'bad', icon: 'fa-triangle-exclamation' },
        OVER: { label: 'Belum final - lebih', tone: 'info', icon: 'fa-triangle-exclamation' },
        BALANCED: { label: 'Seimbang', tone: 'ok', icon: 'fa-scale-balanced' },
        DRAFT: { label: 'Draft', tone: 'mut', icon: 'fa-pen' },
        CLOSED: { label: 'Closed', tone: 'ok', icon: 'fa-lock' },
        CLOSED_VAR: { label: 'Closed - ada selisih', tone: 'warn', icon: 'fa-lock' }
    };

    const ACTION_LABEL = {
        SAVE_TEMPORARY: 'Disimpan sementara',
        FINALIZE: 'Dikunci (seimbang)',
        FINALIZE_VARIANCE: 'Dikunci dengan selisih',
        REOPEN: 'Dibuka kembali'
    };

    const S = {
        date: '', data: null, loading: false, error: '', dirty: false, busy: false,
        denoms: {}, stock: {}, notes: '', accept: false,
        month: '', status: '', history: null
    };

    // ---------- util ----------
    const $ = (id) => document.getElementById(id);
    const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    const qf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rp = (n) => `${n < 0 ? '-' : ''}Rp ${nf.format(Math.abs(Math.round(Number(n) || 0)))}`;
    const signed = (n) => (Math.abs(n) < 0.5 ? rp(0) : `${n > 0 ? '+' : '-'}${rp(Math.abs(n))}`);
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = () => ymd(new Date());
    const shiftDay = (date, delta) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + delta); return ymd(d); };
    const longDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const shortDate = (date) => (date ? new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
    const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

    function cssVar(name, fallback) {
        try { return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; }
    }

    function swalOpts(extra) {
        return Object.assign({
            background: cssVar('--mc-card-bg', '#1e293b'),
            color: cssVar('--mc-text', '#f8fafc'),
            confirmButtonColor: cssVar('--mc-primary', '#22c55e'),
            cancelButtonColor: cssVar('--mc-secondary', '#64748b')
        }, extra || {});
    }

    function toast(icon, title) {
        if (window.Swal) window.Swal.fire(swalOpts({ icon, title, toast: true, position: 'top-end', timer: 2600, showConfirmButton: false }));
        else alert(title);
    }

    function confirmBox(opts) {
        if (!window.Swal) return Promise.resolve(window.confirm(opts.text || opts.title));
        return window.Swal.fire(swalOpts({
            icon: opts.icon || 'question', title: opts.title, html: opts.html, text: opts.text,
            showCancelButton: true, confirmButtonText: opts.confirmText || 'Ya', cancelButtonText: 'Batal'
        })).then((r) => !!r.isConfirmed);
    }

    function user() { return (typeof getCurrentUser === 'function' && getCurrentUser()) || {}; }
    function role() { return String(user().role || '').toLowerCase(); }
    const canVariance = () => VARIANCE_ROLES.includes(role());
    const canReopen = () => REOPEN_ROLES.includes(role());

    async function api(path, options) {
        const response = await window.authFetch(path, options);
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status === 'error') {
            const first = result.errors ? Object.values(result.errors).flat()[0] : null;
            throw new Error(first || result.message || `Permintaan gagal (HTTP ${response.status}).`);
        }
        return result;
    }

    // ---------- turunan status ----------
    function closingStatusKey(closing) {
        if (!closing) return 'NONE';
        if (closing.status === 'CLOSED') return Math.abs(closing.difference) >= 0.005 ? 'CLOSED_VAR' : 'CLOSED';
        return STATUS[closing.status] ? closing.status : 'DRAFT';
    }

    const isLocked = () => !!(S.data && S.data.closing && S.data.closing.status === 'CLOSED');

    function physicalTotal() {
        return DENOMS.reduce((sum, d) => sum + d * (parseInt(S.denoms[d], 10) || 0), 0);
    }

    function recon() {
        const cash = S.data ? S.data.cash : { expected: 0, hanging: 0 };
        const physical = physicalTotal();
        const accounted = physical + cash.hanging;
        return { physical, hanging: cash.hanging, expected: cash.expected, accounted, diff: accounted - cash.expected };
    }

    // ---------- draft lokal (hitungan belum disimpan) ----------
    function saveDraft() {
        if (!S.date || isLocked()) return;
        try {
            localStorage.setItem(DRAFT_KEY(S.date), JSON.stringify({ denoms: S.denoms, stock: S.stock, notes: S.notes, at: Date.now() }));
        } catch (e) { /* abaikan */ }
    }
    function readDraft() {
        try { return JSON.parse(localStorage.getItem(DRAFT_KEY(S.date)) || 'null'); } catch (e) { return null; }
    }
    function clearDraft() {
        try { localStorage.removeItem(DRAFT_KEY(S.date)); } catch (e) { /* abaikan */ }
    }

    // ---------- muat data ----------
    async function load(date, opts) {
        opts = opts || {};
        if (date) S.date = date;
        if (!S.date) S.date = todayStr();
        S.loading = true;
        S.error = '';
        if (!opts.silent) renderShell();
        try {
            const res = await api(`api/closing/day?date=${encodeURIComponent(S.date)}`, { cache: 'no-store' });
            S.data = res.data;
            hydrateInputs();
        } catch (e) {
            S.error = e.message || 'Data closing gagal dimuat.';
        }
        S.loading = false;
        renderAll();
        loadHistory();
    }

    function hydrateInputs() {
        S.denoms = {};
        S.stock = {};
        S.notes = '';
        S.accept = false;
        S.dirty = false;
        const c = S.data.closing;
        if (c) {
            c.denominations.forEach((r) => { S.denoms[r.denomination] = r.quantity; });
            S.notes = c.notes || '';
        }
        S.data.stocks.forEach((s) => { if (s.physical_qty !== null) S.stock[s.currency_code] = s.physical_qty; });

        if (!c || c.status !== 'CLOSED') {
            const draft = readDraft();
            const lastLog = c && c.logs && c.logs[0] ? Date.parse(c.logs[0].created_at) || 0 : 0;
            if (draft && (!c || draft.at > lastLog)) {
                S.denoms = draft.denoms || S.denoms;
                S.stock = draft.stock || S.stock;
                S.notes = draft.notes != null ? draft.notes : S.notes;
                S.dirty = true;
            }
        }
    }

    async function loadHistory() {
        const wrap = $('cdHistory');
        if (!wrap) return;
        const qs = new URLSearchParams();
        if (S.month) qs.set('month', S.month);
        if (S.status) qs.set('status', S.status);
        try {
            const res = await api(`api/closing/history?${qs.toString()}`, { cache: 'no-store' });
            S.history = res.data;
        } catch (e) {
            S.history = { items: [], stats: null, error: e.message };
        }
        renderHistory();
    }

    // ---------- tampilan ----------
    function root() { return $('closingRoot'); }

    function renderShell() {
        const r = root();
        if (!r) return;
        r.innerHTML = `<div class="cd"><div class="cd-card cd-center"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data closing...</div></div>`;
    }

    function statusPill(key) {
        const s = STATUS[key] || STATUS.NONE;
        return `<span class="cd-pill tone-${s.tone}"><i class="fa-solid ${s.icon}"></i> ${esc(s.label)}</span>`;
    }

    function renderAll() {
        const r = root();
        if (!r) return;
        if (S.error || !S.data) {
            r.innerHTML = `<div class="cd"><div class="cd-card cd-center">
                <i class="fa-solid fa-circle-exclamation" style="color:var(--cd-bad);font-size:1.6rem;"></i>
                <p>${esc(S.error || 'Data belum tersedia.')}</p>
                <button type="button" class="btn btn-primary" data-act="refresh"><i class="fa-solid fa-rotate"></i> Coba lagi</button></div></div>`;
            return;
        }

        const d = S.data;
        const closing = d.closing;
        const key = closingStatusKey(closing);
        const locked = isLocked();

        r.innerHTML = `<div class="cd">
            <div class="cd-card cd-head">
                <div class="cd-head-main">
                    <div class="cd-ico"><i class="fa-solid fa-box-archive"></i></div>
                    <div>
                        <h2>Closing Harian</h2>
                        <p>${esc(longDate(d.date))}${closing ? ` &middot; ${esc(closing.closing_no)}` : ''}</p>
                    </div>
                </div>
                <div class="cd-head-tools">
                    <div class="cd-datenav">
                        <button type="button" class="cd-btn-ico" data-act="prev" title="Hari sebelumnya"><i class="fa-solid fa-chevron-left"></i></button>
                        <input type="date" id="cdDate" value="${esc(d.date)}" max="${esc(todayStr())}">
                        <button type="button" class="cd-btn-ico" data-act="next" title="Hari berikutnya" ${d.date >= todayStr() ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
                        <button type="button" class="btn btn-outline btn-sm" data-act="today">Hari ini</button>
                    </div>
                    ${statusPill(key)}
                    <button type="button" class="cd-btn-ico" data-act="refresh" title="Muat ulang dari ledger"><i class="fa-solid fa-rotate"></i></button>
                    <button type="button" class="btn btn-outline btn-sm" data-act="print" ${closing ? '' : 'disabled title="Simpan closing terlebih dahulu"'}><i class="fa-solid fa-print"></i> Berita Acara</button>
                </div>
            </div>

            <div id="cdBanner">${bannerHtml()}</div>

            <div class="cd-kpis">
                ${kpi('fa-vault', 'Saldo Awal Kas', d.cash.opening, 'Saldo akhir hari sebelumnya', '')}
                ${kpi('fa-arrow-down', 'Kas Masuk', d.cash.in, `${countFlows('IN')} mutasi`, 'ok')}
                ${kpi('fa-arrow-up', 'Kas Keluar', d.cash.out, d.cash.expense > 0 ? `termasuk pengeluaran ${rp(d.cash.expense)}` : `${countFlows('OUT')} mutasi`, 'bad')}
                ${kpi('fa-scale-balanced', 'Kas Seharusnya', d.cash.expected, 'Awal + masuk - keluar', 'primary')}
            </div>

            <div class="cd-grid">
                <div class="cd-main">
                    ${countCardHtml(locked)}
                    ${stockCardHtml(locked)}
                    ${bankCardHtml()}
                    ${tradesCardHtml()}
                    ${flowsCardHtml()}
                    <div class="cd-two">${gantunganCardHtml()}${expensesCardHtml()}</div>
                    ${closing && closing.logs && closing.logs.length ? auditCardHtml(closing) : ''}
                </div>
                <aside class="cd-side">
                    <div class="cd-card cd-recon" id="cdRecon">${reconHtml()}</div>
                    <div class="cd-card" id="cdChecks">${checksHtml()}</div>
                </aside>
            </div>

            <div class="cd-card" id="cdHistory">${historyShellHtml()}</div>
        </div>`;

        renderHistory();
        updateRecon();
    }

    function countFlows(dir) {
        return (S.data.flows || []).filter((f) => f.direction === dir).reduce((s, f) => s + f.count, 0);
    }

    function kpi(icon, label, value, sub, tone) {
        return `<div class="cd-kpi ${tone ? 'tone-' + tone : ''}">
            <span class="cd-kpi-ico"><i class="fa-solid ${icon}"></i></span>
            <div><small>${esc(label)}</small><strong>${rp(value)}</strong><em>${esc(sub)}</em></div></div>`;
    }

    function bannerHtml() {
        const d = S.data;
        const out = [];
        if (d.is_future) out.push(`<div class="cd-banner tone-warn"><i class="fa-solid fa-calendar-xmark"></i><div>Tanggal ini belum tiba. Closing hanya bisa dibuat untuk hari ini atau sebelumnya.</div></div>`);
        if (!d.cash.has_account) out.push(`<div class="cd-banner tone-bad"><i class="fa-solid fa-circle-exclamation"></i><div>Akun kas IDR belum ada di ledger ERP. Isi saldo awal kas di Pengaturan terlebih dahulu.</div></div>`);
        if (isLocked()) {
            const c = d.closing;
            out.push(`<div class="cd-banner tone-ok"><i class="fa-solid fa-lock"></i>
                <div><b>Closing sudah dikunci</b> ${c.closed_at ? `pada ${esc(dateTime(c.closed_at))}` : ''}${c.closed_by_name ? ` oleh ${esc(c.closed_by_name)}` : ''}. Angka tidak bisa diubah.</div>
                ${canReopen() ? '<button type="button" class="btn btn-outline btn-sm" data-act="reopen"><i class="fa-solid fa-lock-open"></i> Buka kembali</button>' : ''}</div>`);
        }
        if (d.unclosed_days && d.unclosed_days.length && !isLocked()) {
            out.push(`<div class="cd-banner tone-warn"><i class="fa-solid fa-calendar-day"></i>
                <div><b>${d.unclosed_days.length} hari sebelumnya belum dikunci:</b> ${d.unclosed_days.slice(0, 8).map((x) => `<button type="button" class="cd-linkbtn" data-act="open-date" data-date="${esc(x)}">${esc(shortDate(x))}</button>`).join(' ')}</div></div>`);
        }
        return out.join('');
    }

    function countCardHtml(locked) {
        const rows = DENOMS.map((den) => {
            const coin = den <= 1000;
            const qty = S.denoms[den] || '';
            return `<div class="cd-den">
                <span class="cd-den-label"><i class="fa-solid ${coin ? 'fa-coins' : 'fa-money-bill-wave'}"></i> ${rp(den)}</span>
                <div class="cd-stepper">
                    <button type="button" data-step="-1" data-den="${den}" ${locked ? 'disabled' : ''} aria-label="Kurangi">&minus;</button>
                    <input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-qty="${den}" value="${esc(qty)}" ${locked ? 'disabled' : ''} aria-label="Jumlah lembar ${den}">
                    <button type="button" data-step="1" data-den="${den}" ${locked ? 'disabled' : ''} aria-label="Tambah">+</button>
                </div>
                <span class="cd-den-sub" data-sub="${den}">${rp(den * (parseInt(qty, 10) || 0))}</span>
            </div>`;
        }).join('');
        return `<div class="cd-card">
            <div class="cd-card-head">
                <h3><i class="fa-solid fa-hand-holding-dollar"></i> Hitung Uang Fisik (Rupiah)</h3>
                ${locked ? '' : '<button type="button" class="cd-linkbtn" data-act="reset-count"><i class="fa-solid fa-eraser"></i> Kosongkan</button>'}
            </div>
            <div class="cd-dens">${rows}</div>
            <div class="cd-total"><span>Total uang fisik</span><strong id="cdPhysBig">${rp(physicalTotal())}</strong></div>
        </div>`;
    }

    function stockCardHtml(locked) {
        const stocks = S.data.stocks;
        if (!stocks.length) return '';
        const rows = stocks.map((s) => {
            const val = S.stock[s.currency_code];
            const has = val !== undefined && val !== null && val !== '';
            const diff = has ? Number(val) - s.system_qty : null;
            return `<tr data-stockrow="${esc(s.currency_code)}">
                <td><b>${esc(s.currency_code)}</b></td>
                <td class="r">${qf.format(s.system_qty)}</td>
                <td class="r"><input type="number" min="0" step="any" inputmode="decimal" class="cd-input-sm" data-stock="${esc(s.currency_code)}" value="${has ? esc(val) : ''}" placeholder="-" ${locked ? 'disabled' : ''}></td>
                <td class="r" data-stockdiff="${esc(s.currency_code)}">${stockDiffHtml(diff, s.rate)}</td>
                <td class="r cd-mut">${s.value ? rp(s.value) : '-'}</td>
            </tr>`;
        }).join('');
        return `<div class="cd-card">
            <div class="cd-card-head">
                <h3><i class="fa-solid fa-coins"></i> Stok Valas</h3>
                ${locked ? '' : '<button type="button" class="cd-linkbtn" data-act="fill-stock"><i class="fa-solid fa-check-double"></i> Semua sesuai sistem</button>'}
            </div>
            <div class="cd-tablewrap"><table class="cd-table">
                <thead><tr><th>Valuta</th><th class="r">Sistem</th><th class="r">Fisik</th><th class="r">Selisih</th><th class="r">Nilai sistem</th></tr></thead>
                <tbody>${rows}</tbody></table></div>
            <p class="cd-hint">Kosongkan kolom Fisik bila valuta tidak dihitung hari ini. Nilai memakai rata-rata beli atau kurs beli.</p>
        </div>`;
    }

    function stockDiffHtml(diff, rate) {
        if (diff === null) return '<span class="cd-mut">belum dihitung</span>';
        if (Math.abs(diff) < 0.000001) return '<span class="tx-ok"><i class="fa-solid fa-check"></i> sesuai</span>';
        const cls = diff < 0 ? 'tx-bad' : 'tx-info';
        const value = rate ? ` <small>(${signed(diff * rate)})</small>` : '';
        return `<span class="${cls}">${diff > 0 ? '+' : ''}${qf.format(diff)}${value}</span>`;
    }

    function bankCardHtml() {
        const banks = S.data.banks;
        const body = banks.length ? banks.map((b) => `<tr>
            <td><b>${esc(b.bank_name)}</b><br><small class="cd-mut">${esc(b.account_number || b.code)}</small></td>
            <td class="r">${rp(b.opening)}</td><td class="r tx-ok">${rp(b.in)}</td><td class="r tx-bad">${rp(b.out)}</td>
            <td class="r"><b>${rp(b.closing)}</b></td></tr>`).join('')
            : '<tr><td colspan="5" class="cd-empty">Belum ada rekening bank di ledger.</td></tr>';
        const total = banks.reduce((s, b) => s + b.closing, 0);
        return `<div class="cd-card">
            <div class="cd-card-head"><h3><i class="fa-solid fa-building-columns"></i> Rekening Bank</h3>${banks.length ? `<span class="cd-mut">Total ${rp(total)}</span>` : ''}</div>
            <div class="cd-tablewrap"><table class="cd-table">
                <thead><tr><th>Rekening</th><th class="r">Saldo awal</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo akhir</th></tr></thead>
                <tbody>${body}</tbody></table></div>
            <p class="cd-hint">Cocokkan saldo akhir dengan rekening koran. Saldo bank tidak ikut dihitung dalam selisih kas.</p>
        </div>`;
    }

    function tradesCardHtml() {
        const t = S.data.trades;
        const rows = t.by_currency.length ? t.by_currency.map((r) => `<tr>
            <td><b>${esc(r.currency)}</b></td>
            <td><span class="cd-chip ${r.type === 'BELI' ? 'tone-ok' : 'tone-info'}">${esc(r.type)}</span></td>
            <td class="r">${r.count}</td><td class="r">${qf.format(r.qty)}</td><td class="r">${rp(r.total)}</td></tr>`).join('')
            : '<tr><td colspan="5" class="cd-empty">Belum ada transaksi pada tanggal ini.</td></tr>';
        const pay = (t.by_payment || []).reduce((acc, p) => { acc[p.method] = (acc[p.method] || 0) + p.total; return acc; }, {});
        const payChips = Object.entries(pay).map(([m, v]) => `<span class="cd-chip">${esc(m)}: ${rp(v)}</span>`).join(' ');
        return `<div class="cd-card">
            <div class="cd-card-head"><h3><i class="fa-solid fa-right-left"></i> Transaksi Hari Ini</h3><span class="cd-mut">${t.count} transaksi</span></div>
            <div class="cd-mini">
                <div><small>Total beli (kas keluar)</small><strong>${rp(t.buy_total)}</strong></div>
                <div><small>Total jual (kas masuk)</small><strong>${rp(t.sell_total)}</strong></div>
                <div><small>Selisih jual - beli</small><strong>${rp(t.sell_total - t.buy_total)}</strong></div>
            </div>
            <div class="cd-tablewrap cd-scroll"><table class="cd-table">
                <thead><tr><th>Valuta</th><th>Tipe</th><th class="r">Trx</th><th class="r">Jumlah valas</th><th class="r">Nilai Rp</th></tr></thead>
                <tbody>${rows}</tbody></table></div>
            ${payChips ? `<div class="cd-chips">${payChips}</div>` : ''}
        </div>`;
    }

    function flowsCardHtml() {
        const flows = S.data.flows;
        if (!flows.length) return '';
        const rows = flows.map((f) => `<tr>
            <td>${esc(f.label)}</td>
            <td><span class="cd-chip ${f.direction === 'IN' ? 'tone-ok' : 'tone-bad'}">${f.direction === 'IN' ? 'Masuk' : 'Keluar'}</span></td>
            <td class="r">${f.count}</td><td class="r ${f.direction === 'IN' ? 'tx-ok' : 'tx-bad'}">${rp(f.total)}</td></tr>`).join('');
        return `<div class="cd-card">
            <div class="cd-card-head"><h3><i class="fa-solid fa-list-check"></i> Rincian Arus Kas</h3><span class="cd-mut">${S.data.cash.movement_count} mutasi</span></div>
            <div class="cd-tablewrap"><table class="cd-table">
                <thead><tr><th>Sumber</th><th>Arah</th><th class="r">Mutasi</th><th class="r">Total</th></tr></thead>
                <tbody>${rows}</tbody></table></div></div>`;
    }

    function gantunganCardHtml() {
        const g = S.data.gantungan;
        const net = g.reduce((s, x) => s + x.amount, 0);
        const people = new Map();
        g.forEach((x) => {
            const key = String(x.recipient || '').trim().toLowerCase();
            if (!people.has(key)) people.set(key, { name: x.recipient, total: 0, count: 0, oldest: x.occurred_at });
            const p = people.get(key);
            p.total += x.amount; p.count += 1;
            if (x.occurred_at && (!p.oldest || x.occurred_at < p.oldest)) p.oldest = x.occurred_at;
        });
        const body = people.size ? Array.from(people.values()).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).map((p) => `<li>
                <div><b>${esc(p.name)}</b><small>${p.count} catatan &middot; sejak ${esc(shortDate((p.oldest || '').slice(0, 10)))}</small></div>
                <span class="${p.total < 0 ? 'tx-bad' : ''}">${rp(p.total)}</span></li>`).join('')
            : '<li class="cd-empty">Tidak ada gantungan tersisa.</li>';
        return `<div class="cd-card">
            <div class="cd-card-head"><h3><i class="fa-solid fa-hourglass-half"></i> Gantungan</h3><span class="cd-mut">${g.length ? rp(net) : ''}</span></div>
            <ul class="cd-list">${body}</ul>
            <p class="cd-mut" style="margin:10px 0 0;font-size:.78rem">Rp yang masih di luar laci ikut dihitung sebagai kas. <a href="#" data-cd-gantungan style="color:var(--cd-pri)">Kelola gantungan</a></p>
        </div>`;
    }

    function expensesCardHtml() {
        const e = S.data.expenses;
        const total = e.reduce((s, x) => s + x.amount, 0);
        const body = e.length ? e.map((x) => `<li><div><b>${esc(x.description || 'Pengeluaran')}</b><small>${esc(dateTime(x.posted_at))}</small></div><span class="tx-bad">${rp(x.amount)}</span></li>`).join('')
            : '<li class="cd-empty">Tidak ada pengeluaran kas hari ini.</li>';
        return `<div class="cd-card">
            <div class="cd-card-head"><h3><i class="fa-solid fa-receipt"></i> Pengeluaran Kas</h3><span class="cd-mut">${e.length ? rp(total) : ''}</span></div>
            <ul class="cd-list">${body}</ul>
        </div>`;
    }

    function auditCardHtml(closing) {
        const items = closing.logs.map((l) => {
            const reason = l.detail && (l.detail.reason || l.detail.notes);
            return `<li><i class="fa-solid fa-circle"></i><div>
                <b>${esc(ACTION_LABEL[l.action] || l.action)}</b> &middot; ${esc(l.user_name || '-')}
                <small>${esc(dateTime(l.created_at))}${l.detail && l.detail.difference !== undefined && l.action !== 'REOPEN' ? ` &middot; selisih ${esc(signed(l.detail.difference))}` : ''}</small>
                ${reason ? `<small class="cd-note">&ldquo;${esc(reason)}&rdquo;</small>` : ''}</div></li>`;
        }).join('');
        return `<div class="cd-card">
            <div class="cd-card-head"><h3><i class="fa-solid fa-clock-rotate-left"></i> Jejak Audit</h3></div>
            <ul class="cd-timeline">${items}</ul></div>`;
    }

    // ---------- panel rekonsiliasi ----------
    function reconHtml() {
        const locked = isLocked();
        return `
            <div class="cd-card-head"><h3><i class="fa-solid fa-scale-balanced"></i> Rekonsiliasi Kas</h3></div>
            <div class="cd-rows">
                <div><span>Kas seharusnya (ledger)</span><b id="cdExp">${rp(0)}</b></div>
                <div><span>Uang fisik terhitung</span><b id="cdPhys">${rp(0)}</b></div>
                <div><span>Gantungan (di luar brankas)</span><b id="cdHang">${rp(0)}</b></div>
                <div class="cd-rows-sum"><span>Total dipertanggungjawabkan</span><b id="cdAcc">${rp(0)}</b></div>
            </div>
            <div class="cd-diff" id="cdDiffBox">
                <small>Selisih</small>
                <strong id="cdDiff">${rp(0)}</strong>
                <span id="cdDiffLabel"></span>
            </div>
            <div class="cd-field">
                <label for="cdNotes">Catatan <span class="cd-mut">(wajib bila menutup dengan selisih)</span></label>
                <textarea id="cdNotes" rows="3" maxlength="1000" placeholder="Contoh: selisih Rp 5.000 karena kembalian salah hitung..." ${locked ? 'disabled' : ''}>${esc(S.notes)}</textarea>
            </div>
            <div id="cdVariance"></div>
            <div class="cd-actions" id="cdActions"></div>`;
    }

    function checksHtml() {
        const items = (S.data.checks || []).slice();
        const r = recon();
        if (!isLocked()) {
            items.push(r.physical > 0
                ? { level: 'ok', label: 'Uang fisik sudah dihitung', detail: null }
                : { level: 'warn', label: 'Uang fisik belum dihitung', detail: 'Isi jumlah lembar pada kartu hitung fisik.' });
            items.push(Math.abs(r.diff) < 0.5 && r.physical > 0
                ? { level: 'ok', label: 'Kas seimbang', detail: null }
                : { level: r.physical > 0 ? 'bad' : 'info', label: r.physical > 0 ? `Ada selisih ${signed(r.diff)}` : 'Selisih belum bisa dinilai', detail: null });
        }
        const icon = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', bad: 'fa-circle-xmark', info: 'fa-circle-info' };
        return `<div class="cd-card-head"><h3><i class="fa-solid fa-clipboard-check"></i> Checklist Closing</h3></div>
            <ul class="cd-checks">${items.map((c) => `<li class="lv-${c.level}"><i class="fa-solid ${icon[c.level] || icon.info}"></i>
                <div><b>${esc(c.label)}</b>${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</div></li>`).join('')}</ul>`;
    }

    function updateRecon() {
        if (!S.data) return;
        const r = recon();
        const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
        set('cdExp', rp(r.expected));
        set('cdPhys', rp(r.physical));
        set('cdPhysBig', rp(r.physical));
        set('cdHang', rp(r.hanging));
        set('cdAcc', rp(r.accounted));
        set('cdDiff', signed(r.diff));

        const balanced = Math.abs(r.diff) < 0.5;
        const box = $('cdDiffBox');
        const label = $('cdDiffLabel');
        const tone = r.physical <= 0 && !isLocked() ? 'mut' : balanced ? 'ok' : r.diff < 0 ? 'bad' : 'info';
        if (box) box.className = `cd-diff tone-${tone}`;
        if (label) {
            label.textContent = r.physical <= 0 && !isLocked() ? 'Hitung uang fisik untuk melihat selisih'
                : balanced ? 'SEIMBANG' : r.diff < 0 ? 'KURANG dari ledger' : 'LEBIH dari ledger';
        }

        DENOMS.forEach((den) => set2(`[data-sub="${den}"]`, rp(den * (parseInt(S.denoms[den], 10) || 0))));
        renderVarianceAndActions(r, balanced);

        const checks = $('cdChecks');
        if (checks) checks.innerHTML = checksHtml();
    }

    function set2(selector, text) {
        const el = document.querySelector(selector);
        if (el) el.textContent = text;
    }

    function renderVarianceAndActions(r, balanced) {
        const variance = $('cdVariance');
        const actions = $('cdActions');
        if (!variance || !actions) return;
        const d = S.data;

        if (isLocked()) {
            variance.innerHTML = '';
            actions.innerHTML = `<button type="button" class="btn btn-outline" data-act="print"><i class="fa-solid fa-print"></i> Cetak Berita Acara</button>`;
            return;
        }

        const blocked = d.is_future || !d.cash.has_account;
        const counted = r.physical > 0;
        let varianceHtml = '';
        let finalDisabled = blocked || !counted;
        let finalLabel = '<i class="fa-solid fa-lock"></i> Kunci Closing Final';
        let hint = '';

        if (counted && !balanced) {
            const reasonOk = S.notes.trim().length >= 10;
            if (canVariance()) {
                varianceHtml = `<label class="cd-check"><input type="checkbox" id="cdAccept" ${S.accept ? 'checked' : ''}>
                    <span>Tutup dengan selisih <b>${esc(signed(r.diff))}</b> dan catat alasannya</span></label>`;
                finalLabel = '<i class="fa-solid fa-lock"></i> Kunci dengan Selisih';
                finalDisabled = blocked || !S.accept || !reasonOk;
                if (S.accept && !reasonOk) hint = 'Isi catatan minimal 10 karakter sebagai alasan selisih.';
                else if (!S.accept) hint = 'Periksa kembali hitungan. Jika selisih tidak bisa dijelaskan, centang opsi di atas.';
            } else {
                finalDisabled = true;
                hint = 'Masih ada selisih. Hitung ulang, atau minta Supervisor/Admin untuk menutup dengan selisih.';
            }
        } else if (!counted) {
            hint = 'Isi hitungan uang fisik untuk mengunci closing.';
        }
        variance.innerHTML = varianceHtml;

        actions.innerHTML = `
            <button type="button" class="btn btn-outline" data-act="save-temp" ${blocked || S.busy ? 'disabled' : ''}><i class="fa-solid fa-floppy-disk"></i> Simpan Sementara</button>
            <button type="button" class="btn btn-primary" data-act="finalize" ${finalDisabled || S.busy ? 'disabled' : ''}>${finalLabel}</button>
            ${hint ? `<p class="cd-hint">${esc(hint)}</p>` : ''}
            ${S.dirty ? '<p class="cd-hint tx-warn"><i class="fa-solid fa-circle-exclamation"></i> Ada hitungan yang belum disimpan ke server (tersimpan di browser ini).</p>' : ''}`;
    }

    // ---------- riwayat ----------
    function historyShellHtml() {
        const month = S.month;
        return `<div class="cd-card-head">
                <h3><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Closing</h3>
                <div class="cd-filters">
                    <input type="month" id="cdMonth" value="${esc(month)}" title="Filter bulan">
                    <select id="cdStatus" title="Filter status">
                        <option value="">Semua status</option>
                        <option value="CLOSED"${S.status === 'CLOSED' ? ' selected' : ''}>Closed</option>
                        <option value="TEMPORARY"${S.status === 'TEMPORARY' ? ' selected' : ''}>Sementara</option>
                    </select>
                    <button type="button" class="btn btn-outline btn-sm" data-act="export"><i class="fa-solid fa-file-excel"></i> Export</button>
                </div>
            </div>
            <div id="cdHistBody"><div class="cd-center"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</div></div>`;
    }

    function legacyRows() {
        if (S.status) return [];
        const list = (typeof getClosings === 'function' ? getClosings() : []) || [];
        return list.filter((c) => c && c.source !== 'erp').map((c) => {
            const date = String(c.timestamp || '').slice(0, 10);
            return { date, id: c.id, type: (c.type || c.closingType || 'final'), expected: Number(c.kasSistem) || 0, physical: Number(c.kasFisik) || 0,
                hanging: (Number(c.gantunganPiutang) || 0) - (Number(c.gantunganUtang) || 0), diff: Number(c.selisih) || 0, notes: c.catatan || '' };
        }).filter((c) => c.date && (!S.month || c.date.startsWith(S.month))).sort((a, b) => b.date.localeCompare(a.date));
    }

    function renderHistory() {
        const body = $('cdHistBody');
        if (!body || !S.history) return;
        const h = S.history;
        if (h.error) { body.innerHTML = `<div class="cd-center tx-bad">${esc(h.error)}</div>`; return; }

        const legacy = legacyRows();
        const st = h.stats;
        const stats = st ? `<div class="cd-mini">
            <div><small>Hari ditutup</small><strong>${st.closed}</strong></div>
            <div><small>Belum final</small><strong>${st.open}</strong></div>
            <div><small>Hari dengan selisih</small><strong>${st.variance_days}</strong></div>
            <div><small>Selisih bersih</small><strong>${signed(st.variance_net)}</strong></div>
        </div>` : '';

        const rows = h.items.map((c) => {
            const key = closingStatusKey(c);
            return `<tr class="${c.date === S.date ? 'is-active' : ''}">
                <td><b>${esc(shortDate(c.date))}</b><br><small class="cd-mut">${esc(c.closing_no)}</small></td>
                <td>${statusPill(key)}</td>
                <td class="r">${rp(c.expected_cash)}</td><td class="r">${rp(c.physical_cash)}</td><td class="r">${rp(c.hanging_amount)}</td>
                <td class="r ${Math.abs(c.difference) < 0.5 ? 'tx-ok' : c.difference < 0 ? 'tx-bad' : 'tx-info'}"><b>${signed(c.difference)}</b></td>
                <td>${esc(c.closed_by_name || '-')}</td>
                <td class="r"><button type="button" class="cd-linkbtn" data-act="open-date" data-date="${esc(c.date)}">Buka</button></td>
            </tr>`;
        }).join('');

        const legacyHtml = legacy.map((c) => `<tr class="is-legacy">
            <td><b>${esc(shortDate(c.date))}</b><br><small class="cd-mut">${esc(c.id)}</small></td>
            <td><span class="cd-pill tone-mut"><i class="fa-solid fa-box-archive"></i> Arsip lama (${esc(c.type === 'final' ? 'final' : 'sementara')})</span></td>
            <td class="r">${rp(c.expected)}</td><td class="r">${rp(c.physical)}</td><td class="r">${rp(c.hanging)}</td>
            <td class="r ${Math.abs(c.diff) < 0.5 ? 'tx-ok' : c.diff < 0 ? 'tx-bad' : 'tx-info'}"><b>${signed(c.diff)}</b></td>
            <td>-</td><td class="r"><span class="cd-mut">hanya baca</span></td></tr>`).join('');

        const empty = !h.items.length && !legacy.length;
        body.innerHTML = `${stats}
            <div class="cd-tablewrap"><table class="cd-table">
                <thead><tr><th>Tanggal</th><th>Status</th><th class="r">Kas seharusnya</th><th class="r">Fisik</th><th class="r">Gantungan</th><th class="r">Selisih</th><th>Dikunci oleh</th><th></th></tr></thead>
                <tbody>${empty ? '<tr><td colspan="8" class="cd-empty">Belum ada riwayat closing pada filter ini.</td></tr>' : rows + legacyHtml}</tbody></table></div>
            ${legacy.length ? '<p class="cd-hint">Arsip lama berasal dari sistem closing sebelumnya (data browser) dan hanya dapat dibaca.</p>' : ''}`;
    }

    // ---------- aksi ----------
    function collectPayload(mode) {
        return {
            date: S.date,
            mode,
            denominations: DENOMS.map((den) => ({ denomination: den, quantity: parseInt(S.denoms[den], 10) || 0 })).filter((r) => r.quantity > 0),
            stock_counts: Object.entries(S.stock)
                .filter(([, v]) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v)))
                .map(([code, v]) => ({ currency_code: code, physical_qty: Number(v) })),
            notes: S.notes.trim(),
            accept_variance: mode === 'final' && S.accept
        };
    }

    async function submit(mode) {
        if (S.busy || !S.data) return;
        const r = recon();
        if (mode === 'final') {
            const ok = await confirmBox({
                icon: 'warning',
                title: Math.abs(r.diff) < 0.5 ? 'Kunci closing?' : 'Kunci closing dengan selisih?',
                html: `<div style="text-align:left;line-height:1.8;">
                    Kas seharusnya: <b>${esc(rp(r.expected))}</b><br>
                    Uang fisik + gantungan: <b>${esc(rp(r.accounted))}</b><br>
                    Selisih: <b>${esc(signed(r.diff))}</b><br><br>
                    Setelah dikunci, angka tidak bisa diubah kecuali dibuka kembali oleh Owner/Superadmin.</div>`,
                confirmText: 'Ya, kunci'
            });
            if (!ok) return;
        }
        S.busy = true;
        updateRecon();
        try {
            const res = await api('api/closing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(collectPayload(mode))
            });
            clearDraft();
            S.data = res.data;
            hydrateInputs();
            syncLegacy(S.data);
            toast('success', res.message || 'Tersimpan.');
        } catch (e) {
            toast('error', e.message);
        }
        S.busy = false;
        renderAll();
        loadHistory();
    }

    // Dashboard utama masih membaca mc_closings. Salinan ringkas dijaga agar kartu selisih di dashboard tetap benar.
    function syncLegacy(day) {
        const c = day && day.closing;
        if (!c || typeof getClosings !== 'function' || typeof saveClosings !== 'function') return;
        try {
            const list = getClosings().filter((x) => x.id !== c.closing_no);
            list.push({
                id: c.closing_no, source: 'erp', timestamp: `${c.date}T12:00:00`,
                type: c.status === 'CLOSED' ? 'final' : 'temporary',
                kasSistem: c.expected_cash, bankSistem: 0, totalSistemRupiah: c.expected_cash,
                kasFisik: c.physical_cash, totalFisikPlusBank: c.physical_cash,
                gantunganPiutang: Math.max(0, c.hanging_amount), gantunganUtang: Math.max(0, -c.hanging_amount), pengeluaranHari: c.expense,
                selisih: c.difference, catatan: c.notes || ''
            });
            saveClosings(list);
        } catch (e) { /* tidak kritis */ }
    }

    async function reopen() {
        let reason = '';
        if (window.Swal) {
            const res = await window.Swal.fire(swalOpts({
                title: 'Buka kembali closing?', input: 'textarea', inputLabel: 'Alasan membuka kembali (wajib)',
                inputPlaceholder: 'Contoh: salah hitung pecahan 50.000', showCancelButton: true,
                confirmButtonText: 'Buka kembali', cancelButtonText: 'Batal',
                inputValidator: (v) => (String(v || '').trim().length < 5 ? 'Alasan minimal 5 karakter.' : undefined)
            }));
            if (!res.isConfirmed) return;
            reason = String(res.value || '').trim();
        } else {
            reason = String(window.prompt('Alasan membuka kembali closing:') || '').trim();
            if (reason.length < 5) return;
        }
        try {
            const res = await api(`api/closing/${encodeURIComponent(S.date)}/reopen`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason })
            });
            S.data = res.data;
            hydrateInputs();
            syncLegacy(S.data);
            toast('success', res.message);
        } catch (e) {
            toast('error', e.message);
        }
        renderAll();
        loadHistory();
    }

    function exportHistory() {
        const h = S.history;
        if (!h) return;
        const header = ['Tanggal', 'No Closing', 'Status', 'Saldo Awal', 'Kas Masuk', 'Kas Keluar', 'Pengeluaran', 'Kas Seharusnya', 'Uang Fisik', 'Gantungan', 'Selisih', 'Dikunci Oleh', 'Catatan'];
        const rows = h.items.map((c) => [c.date, c.closing_no, STATUS[closingStatusKey(c)].label, c.opening_cash, c.cash_in, c.cash_out, c.expense,
            c.expected_cash, c.physical_cash, c.hanging_amount, c.difference, c.closed_by_name || '', c.notes || '']);
        const name = `closing-harian-${S.month || 'semua'}`;
        if (window.XLSX) {
            const ws = window.XLSX.utils.aoa_to_sheet([header, ...rows]);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Closing');
            window.XLSX.writeFile(wb, `${name}.xlsx`);
            return;
        }
        const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
        const blob = new Blob(['sep=;\r\n' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    // ---------- berita acara ----------
    function printReport() {
        const d = S.data;
        const c = d && d.closing;
        if (!c) return toast('info', 'Simpan closing terlebih dahulu.');
        const profile = (typeof getProfile === 'function' && getProfile()) || {};
        const key = closingStatusKey(c);
        const w = window.open('', '_blank');
        if (!w) return toast('warning', 'Izinkan pop-up untuk mencetak berita acara.');

        const den = c.denominations.map((x) => `<tr><td>${esc(rp(x.denomination))}</td><td class="r">${x.quantity}</td><td class="r">${esc(rp(x.denomination * x.quantity))}</td></tr>`).join('')
            || '<tr><td colspan="3">-</td></tr>';
        const stock = c.stock_counts.map((x) => `<tr><td>${esc(x.currency_code)}</td><td class="r">${esc(qf.format(x.system_qty))}</td><td class="r">${esc(qf.format(x.physical_qty))}</td><td class="r">${esc(qf.format(x.difference))}</td></tr>`).join('');
        const bank = d.banks.map((b) => `<tr><td>${esc(b.bank_name)} ${esc(b.account_number || '')}</td><td class="r">${esc(rp(b.opening))}</td><td class="r">${esc(rp(b.in))}</td><td class="r">${esc(rp(b.out))}</td><td class="r">${esc(rp(b.closing))}</td></tr>`).join('');
        const hang = d.gantungan.map((g) => `<tr><td>${esc(g.reference_no)}</td><td>${esc(g.recipient)}${g.category ? ' (' + esc(g.category) + ')' : ''}</td><td class="r">${esc(rp(g.original))}</td><td class="r">${esc(rp(g.amount))}</td></tr>`).join('');

        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Berita Acara Closing ${esc(c.closing_no)}</title>
            <style>
                body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:28px;font-size:12px}
                h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
                .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px}
                table{width:100%;border-collapse:collapse}td,th{border:1px solid #bbb;padding:5px 8px;text-align:left}th{background:#f1f1f1}
                .r{text-align:right}.meta td{border:0;padding:2px 6px 2px 0}.sum td{font-weight:bold}
                .sign{display:flex;gap:40px;margin-top:50px}.sign div{flex:1;text-align:center}.sign span{display:block;margin-top:60px;border-top:1px solid #111;padding-top:4px}
                @media print{body{margin:12mm}}
            </style></head><body>
            <div class="top"><div><h1>BERITA ACARA CLOSING HARIAN</h1><div>${esc(profile.name || '')}${profile.address ? ' &mdash; ' + esc(profile.address) : ''}</div></div>
            <div style="text-align:right"><b>${esc(c.closing_no)}</b><br>${esc(STATUS[key].label)}</div></div>
            <table class="meta"><tr><td>Tanggal closing</td><td>: ${esc(longDate(d.date))}</td></tr>
            <tr><td>Dikunci</td><td>: ${esc(c.closed_at ? dateTime(c.closed_at) : 'belum dikunci')}${c.closed_by_name ? ' oleh ' + esc(c.closed_by_name) : ''}</td></tr>
            <tr><td>Dicetak</td><td>: ${esc(dateTime(new Date().toISOString()))} oleh ${esc(user().fullName || user().username || '-')}</td></tr></table>
            <h2>Rekonsiliasi Kas Rupiah</h2>
            <table><tr><td>Saldo awal kas</td><td class="r">${esc(rp(c.opening_cash))}</td></tr>
            <tr><td>Kas masuk</td><td class="r">${esc(rp(c.cash_in))}</td></tr>
            <tr><td>Kas keluar (termasuk pengeluaran ${esc(rp(c.expense))})</td><td class="r">${esc(rp(c.cash_out))}</td></tr>
            <tr class="sum"><td>Kas seharusnya</td><td class="r">${esc(rp(c.expected_cash))}</td></tr>
            <tr><td>Uang fisik terhitung</td><td class="r">${esc(rp(c.physical_cash))}</td></tr>
            <tr><td>Gantungan outstanding</td><td class="r">${esc(rp(c.hanging_amount))}</td></tr>
            <tr class="sum"><td>Total dipertanggungjawabkan</td><td class="r">${esc(rp(c.accounted_cash))}</td></tr>
            <tr class="sum"><td>Selisih</td><td class="r">${esc(signed(c.difference))}</td></tr></table>
            ${c.notes ? `<h2>Catatan</h2><p>${esc(c.notes)}</p>` : ''}
            <h2>Rincian Pecahan</h2><table><tr><th>Pecahan</th><th class="r">Lembar/keping</th><th class="r">Jumlah</th></tr>${den}</table>
            ${stock ? `<h2>Hitung Fisik Stok Valas</h2><table><tr><th>Valuta</th><th class="r">Sistem</th><th class="r">Fisik</th><th class="r">Selisih</th></tr>${stock}</table>` : ''}
            ${bank ? `<h2>Rekening Bank</h2><table><tr><th>Rekening</th><th class="r">Saldo awal</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo akhir</th></tr>${bank}</table>` : ''}
            ${hang ? `<h2>Gantungan (Rp di luar laci)</h2><table><tr><th>No</th><th>Nama</th><th class="r">Nominal awal</th><th class="r">Sisa dihitung</th></tr>${hang}</table>` : ''}
            <div class="sign"><div><span>Kasir / Teller</span></div><div><span>Supervisor</span></div><div><span>Owner / Pimpinan</span></div></div>
            </body></html>`);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
    }

    // ---------- event ----------
    function setQty(den, value) {
        const n = Math.max(0, parseInt(value, 10) || 0);
        S.denoms[den] = n || '';
        S.dirty = true;
        saveDraft();
    }

    function bind() {
        if (window.__cdBound) return;
        window.__cdBound = true;

        document.addEventListener('click', (e) => {
            const scope = e.target.closest('#closingRoot');
            if (!scope) return;
            const step = e.target.closest('[data-step]');
            if (step) {
                const den = step.dataset.den;
                const input = scope.querySelector(`[data-qty="${den}"]`);
                const next = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(step.dataset.step, 10));
                input.value = next || '';
                setQty(den, next);
                updateRecon();
                return;
            }
            const hang = e.target.closest('[data-cd-gantungan]');
            if (hang) {
                e.preventDefault();
                const nav = document.querySelector('.nav-item[data-target="gantungan-view"]');
                if (nav) nav.click();
                return;
            }
            const btn = e.target.closest('[data-act]');
            if (!btn || btn.disabled) return;
            const act = btn.dataset.act;
            if (act === 'prev') guardNavigate(shiftDay(S.date, -1));
            else if (act === 'next') guardNavigate(shiftDay(S.date, 1));
            else if (act === 'today') guardNavigate(todayStr());
            else if (act === 'open-date') guardNavigate(btn.dataset.date, true);
            else if (act === 'refresh') guardNavigate(S.date, false, true);
            else if (act === 'save-temp') submit('temporary');
            else if (act === 'finalize') submit('final');
            else if (act === 'reopen') reopen();
            else if (act === 'print') printReport();
            else if (act === 'export') exportHistory();
            else if (act === 'reset-count') {
                S.denoms = {};
                S.dirty = true;
                saveDraft();
                scope.querySelectorAll('[data-qty]').forEach((i) => { i.value = ''; });
                updateRecon();
            } else if (act === 'fill-stock') {
                S.data.stocks.forEach((s) => { S.stock[s.currency_code] = s.system_qty; });
                S.dirty = true;
                saveDraft();
                scope.querySelectorAll('[data-stock]').forEach((i) => { i.value = S.stock[i.dataset.stock]; refreshStockRow(i.dataset.stock); });
                updateRecon();
            }
        });

        document.addEventListener('input', (e) => {
            if (!e.target.closest('#closingRoot')) return;
            const qty = e.target.closest('[data-qty]');
            if (qty) { setQty(qty.dataset.qty, qty.value); updateRecon(); return; }
            const stock = e.target.closest('[data-stock]');
            if (stock) {
                S.stock[stock.dataset.stock] = stock.value === '' ? '' : Number(stock.value);
                S.dirty = true;
                saveDraft();
                refreshStockRow(stock.dataset.stock);
                updateRecon();
                return;
            }
            if (e.target.id === 'cdNotes') {
                S.notes = e.target.value;
                S.dirty = true;
                saveDraft();
                updateRecon();
            }
        });

        document.addEventListener('change', (e) => {
            if (!e.target.closest('#closingRoot')) return;
            if (e.target.id === 'cdDate' && e.target.value) guardNavigate(e.target.value, false, false, e.target);
            else if (e.target.id === 'cdAccept') { S.accept = e.target.checked; updateRecon(); }
            else if (e.target.id === 'cdMonth') { S.month = e.target.value; loadHistory(); }
            else if (e.target.id === 'cdStatus') { S.status = e.target.value; loadHistory(); }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('#closingRoot [data-qty]')) return;
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('#closingRoot [data-qty]'));
            const next = inputs[inputs.indexOf(e.target) + 1];
            if (next) { next.focus(); next.select(); }
        });
    }

    function refreshStockRow(code) {
        const s = S.data.stocks.find((x) => x.currency_code === code);
        const cell = document.querySelector(`[data-stockdiff="${code}"]`);
        if (!s || !cell) return;
        const v = S.stock[code];
        const has = v !== undefined && v !== null && v !== '';
        cell.innerHTML = stockDiffHtml(has ? Number(v) - s.system_qty : null, s.rate);
    }

    async function guardNavigate(date, scrollTop, forceReload, dateInput) {
        if (!date) return;
        if (date > todayStr()) date = todayStr();
        const same = date === S.date;
        if (S.dirty && !isLocked() && (!same || forceReload)) {
            const ok = await confirmBox({
                title: same ? 'Muat ulang data?' : 'Pindah tanggal?',
                text: 'Hitungan yang belum disimpan ke server tetap tersimpan sebagai draft di browser ini untuk tanggal tersebut.',
                confirmText: 'Lanjutkan'
            });
            if (!ok) { if (dateInput) dateInput.value = S.date; return; }
        }
        await load(date);
        if (scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ---------- titik masuk ----------
    window.initClosingView = function () {
        bind();
        if (!S.date) S.date = todayStr();
        if (!S.month) S.month = S.date.slice(0, 7);
        load(S.date);
    };

    window.refreshClosingView = function () {
        if (!S.dirty) load(S.date, { silent: true });
    };
})();
