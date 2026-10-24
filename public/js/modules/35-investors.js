// Penanam Saham (investor)
// Profil investor dan riwayat setor/tarik modal disimpan di MySQL lewat /api/investors.
// Hanya catatan: tidak membuat mutasi kas/bank. Modal disetor = total setor - total tarik.
// Warna memakai variabel tema (--mc-*), sehingga ikut Tema & Tampilan.
(function () {
    'use strict';

    const WRITE_ROLES = ['owner', 'superadmin', 'admin'];
    const DELETE_ROLES = ['owner', 'superadmin'];
    const STATUS = {
        AKTIF: { label: 'Aktif', tone: 'ok' },
        NONAKTIF: { label: 'Nonaktif', tone: 'warn' },
        KELUAR: { label: 'Keluar', tone: 'mut' }
    };
    const TYPE_LABEL = { PERORANGAN: 'Perorangan', BADAN_USAHA: 'Badan usaha' };
    const SEG_COLORS = ['--mc-primary', '--mc-info', '--mc-warning', '--mc-buy', '--mc-danger', '--mc-link'];

    const S = {
        data: null, loading: false, error: '', loadedAt: 0, importing: false,
        tab: 'list', q: '', status: 'AKTIF',
        month: '', method: 'net_profit'
    };

    // ---------- util ----------
    const $ = (id) => document.getElementById(id);
    const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    const pf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rp = (n) => `${n < 0 ? '-' : ''}Rp ${nf.format(Math.abs(Math.round(Number(n) || 0)))}`;
    const pct = (n) => `${pf.format(Number(n) || 0)}%`;
    const dateShort = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
    const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const digits = (v) => parseInt(String(v || '').replace(/[^\d]/g, ''), 10) || 0;

    function cssVar(name, fallback) {
        try { return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; }
    }
    function swalOpts(extra) {
        return Object.assign({
            background: cssVar('--mc-card-bg', '#1e293b'), color: cssVar('--mc-text', '#f8fafc'),
            confirmButtonColor: cssVar('--mc-primary', '#22c55e'), cancelButtonColor: cssVar('--mc-secondary', '#64748b')
        }, extra || {});
    }
    function toast(icon, title) {
        if (window.Swal) window.Swal.fire(swalOpts({ icon, title, toast: true, position: 'top-end', timer: 2800, showConfirmButton: false }));
        else alert(title);
    }
    function confirmBox(opts) {
        if (!window.Swal) return Promise.resolve(window.confirm(opts.text || opts.title));
        return window.Swal.fire(swalOpts({
            icon: opts.icon || 'question', title: opts.title, text: opts.text,
            showCancelButton: true, confirmButtonText: opts.confirmText || 'Ya', cancelButtonText: 'Batal'
        })).then((r) => !!r.isConfirmed);
    }

    function role() {
        try { const u = (typeof getCurrentUser === 'function' && getCurrentUser()) || {}; return String(u.role || '').toLowerCase(); } catch (e) { return ''; }
    }
    const canWrite = () => WRITE_ROLES.includes(role());
    const canDelete = () => DELETE_ROLES.includes(role());

    async function api(path, options) {
        const opts = Object.assign({}, options || {});
        if (opts.body && typeof opts.body !== 'string') {
            opts.body = JSON.stringify(opts.body);
            opts.headers = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, opts.headers || {});
        }
        const response = await window.authFetch(path, opts);
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status === 'error') {
            const first = result.errors ? Object.values(result.errors).flat()[0] : null;
            throw new Error(first || result.message || `Permintaan gagal (HTTP ${response.status}).`);
        }
        return result;
    }

    // ---------- data ----------
    const legacyShape = (i) => ({
        id_investor: i.code, nama: i.name, kontak: i.phone || i.email || '', modal: i.capital,
        persentase: i.share_percent, tgl_gabung: i.join_date, status: i.status
    });

    // Dipakai modul akuntansi (modal disetor). Bentuk data sama seperti versi lama.
    window.getInvestors = function () {
        if (S.data) return S.data.investors.map(legacyShape);
        try { const raw = JSON.parse(localStorage.getItem('mc_investors') || '[]'); return Array.isArray(raw) ? raw : []; } catch (e) { return []; }
    };

    async function load(force, silent) {
        if (S.loading) return;
        if (!force && S.data && Date.now() - S.loadedAt < 4000) { renderAll(); return; }
        if (typeof window.authFetch !== 'function') return;
        S.loading = true; S.error = '';
        if (!S.data && !silent) renderAll();
        try {
            const res = await api('api/investors');
            S.data = res.data; S.loadedAt = Date.now();
        } catch (e) {
            S.error = e.message;
        } finally {
            S.loading = false;
        }
        renderAll();
        if (S.data) importLegacyOnce();
    }

    // Data lama di browser (localStorage mc_investors) dipindahkan ke database satu kali.
    async function importLegacyOnce() {
        if (S.importing || !canWrite()) return;
        let items = [];
        try { items = JSON.parse(localStorage.getItem('mc_investors') || '[]'); } catch (e) { items = []; }
        if (!Array.isArray(items) || !items.length || !items.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return;
        S.importing = true;
        try {
            const res = await api('api/investors/import-legacy', { method: 'POST', body: { items } });
            localStorage.setItem('mc_investors', '[]');
            if (typeof pushToUniversalDatastore === 'function') { try { pushToUniversalDatastore('mc_investors', []); } catch (e) { /* tidak kritis */ } }
            S.data = res.data; S.loadedAt = Date.now();
            renderAll();
            if (res.imported > 0) toast('success', res.message);
        } catch (e) {
            toast('error', 'Impor data investor lama gagal: ' + e.message);
        } finally {
            S.importing = false;
        }
    }

    const find = (key) => (S.data ? S.data.investors.find((i) => String(i.id) === String(key) || i.code === key) : null);

    // ---------- tampilan: kerangka ----------
    function shellHtml() {
        return `
        <div class="iv-head">
            <div>
                <h2><i class="fa-solid fa-chart-pie"></i> Penanam Saham</h2>
                <p>Kelola investor, hak persentase, riwayat setor dan tarik modal, serta peraga pembagian laba bulanan. Hanya catatan: tidak mengubah saldo kas atau bank.</p>
            </div>
            <div class="iv-head-actions">
                <button type="button" class="iv-btn iv-btn-ghost" data-act="refresh" title="Muat ulang"><i class="fa-solid fa-rotate"></i></button>
                <button type="button" class="iv-btn iv-btn-ghost" data-act="export"><i class="fa-solid fa-file-csv"></i> Export</button>
                <button type="button" class="iv-btn iv-btn-primary" data-act="add" data-need="write"><i class="fa-solid fa-plus"></i> Tambah Investor</button>
            </div>
        </div>
        <div id="ivKpis" class="iv-kpis"></div>
        <div id="ivComp" class="iv-comp"></div>

        <div class="iv-tabs" role="tablist">
            <button type="button" class="iv-tab on" data-tab="list" role="tab"><i class="fa-solid fa-users"></i> Daftar Investor</button>
            <button type="button" class="iv-tab" data-tab="sim" role="tab"><i class="fa-solid fa-calculator"></i> Peraga Pembagian Laba</button>
        </div>

        <section id="ivPanelList">
            <div class="iv-tools">
                <div class="iv-search"><i class="fa-solid fa-magnifying-glass"></i><input id="ivSearch" type="search" placeholder="Cari nama, kode, kontak..." autocomplete="off"></div>
                <select id="ivStatus" class="iv-select" title="Filter status">
                    <option value="AKTIF">Aktif</option>
                    <option value="NONAKTIF">Nonaktif</option>
                    <option value="KELUAR">Keluar</option>
                    <option value="ALL">Semua status</option>
                </select>
            </div>
            <div id="ivTable" class="iv-tablewrap"></div>
        </section>

        <section id="ivPanelSim" class="iv-hide">
            <div class="iv-simbar">
                <label class="iv-field"><span>Bulan laba (basis transaksi)</span><input id="ivMonth" type="month"></label>
                <label class="iv-field"><span>Metode perhitungan</span>
                    <select id="ivMethod" class="iv-select">
                        <option value="net_profit">Persentase dari laba bersih</option>
                        <option value="flat_capital">Nilai tetap (persentase dari modal disetor)</option>
                    </select></label>
                <div class="iv-netbox"><small>Estimasi laba bersih bulan terpilih (sebelum pajak dan prive)</small><b id="ivNet">Rp 0</b></div>
            </div>
            <div id="ivSimTable" class="iv-tablewrap"></div>
            <p class="iv-note"><i class="fa-solid fa-circle-info"></i> Peraga saja untuk bahan pembagian laba. Perhitungan tidak membuat transaksi dan hanya melibatkan investor berstatus Aktif.</p>
        </section>`;
    }

    function ensureShell() {
        const root = $('investorRoot');
        if (!root) return null;
        if (!root.dataset.ready) {
            root.className = 'iv-root';
            root.innerHTML = shellHtml();
            root.dataset.ready = '1';
        }
        return root;
    }

    function renderAll() {
        const root = ensureShell();
        if (!root) return;
        root.querySelectorAll('[data-need="write"]').forEach((b) => { b.style.display = canWrite() ? '' : 'none'; });
        if (!S.data) {
            $('ivKpis').innerHTML = ''; $('ivComp').innerHTML = '';
            $('ivTable').innerHTML = S.error
                ? `<div class="iv-state iv-state-bad"><i class="fa-solid fa-circle-exclamation"></i> ${esc(S.error)}<br><button type="button" class="iv-btn iv-btn-ghost" data-act="refresh">Coba lagi</button></div>`
                : '<div class="iv-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data investor...</div>';
            return;
        }
        renderKpis(); renderComp(); renderTable();
        if (S.tab === 'sim') renderSim();
        const st = $('ivStatus'); if (st && st.value !== S.status) st.value = S.status;
    }

    function renderKpis() {
        const s = S.data.summary;
        const over = s.total_share > 100.00005;
        const full = Math.abs(s.total_share - 100) < 0.00005;
        $('ivKpis').innerHTML = `
            <div class="iv-kpi tone-ok"><span><i class="fa-solid fa-vault"></i> Modal disetor</span><b>${rp(s.total_capital)}</b><small>seluruh investor, setelah penarikan</small></div>
            <div class="iv-kpi tone-info"><span><i class="fa-solid fa-user-check"></i> Investor aktif</span><b>${s.active_count}</b><small>${s.inactive_count ? s.inactive_count + ' nonaktif / keluar' : 'tidak ada yang nonaktif'}</small></div>
            <div class="iv-kpi ${over ? 'tone-bad' : full ? 'tone-ok' : 'tone-warn'}"><span><i class="fa-solid fa-percent"></i> Total hak investor</span><b>${pct(s.total_share)}</b><small>${over ? 'Melebihi 100%, perbaiki hak investor' : full ? 'Hak sudah teralokasi penuh' : 'Sisa ' + pct(s.remaining_share) + ' untuk perusahaan'}</small></div>
            <div class="iv-kpi tone-mut"><span><i class="fa-solid fa-hand-holding-dollar"></i> Nilai tetap per periode</span><b>${rp(s.fixed_value)}</b><small>modal x hak, bila memakai metode nilai tetap</small></div>`;
    }

    function renderComp() {
        const active = S.data.investors.filter((i) => i.status === 'AKTIF' && i.share_percent > 0);
        if (!active.length) { $('ivComp').innerHTML = ''; return; }
        const total = active.reduce((s, i) => s + i.share_percent, 0);
        const rest = Math.max(0, 100 - total);
        const scale = Math.max(100, total);
        const seg = active.map((i, idx) => {
            const color = SEG_COLORS[idx % SEG_COLORS.length];
            return { name: i.name, share: i.share_percent, style: `background: var(${color}, #64748b)` };
        });
        $('ivComp').innerHTML = `
            <div class="iv-compbar" role="img" aria-label="Komposisi hak investor">
                ${seg.map((x) => `<i style="width:${x.share / scale * 100}%;${x.style}" title="${esc(x.name)}: ${esc(pct(x.share))}"></i>`).join('')}
                ${rest > 0 ? `<i class="rest" style="width:${rest / scale * 100}%" title="Perusahaan: ${esc(pct(rest))}"></i>` : ''}
            </div>
            <div class="iv-legend">
                ${seg.map((x) => `<span><i style="${x.style}"></i>${esc(x.name)} <b>${esc(pct(x.share))}</b></span>`).join('')}
                ${rest > 0 ? `<span><i class="rest"></i>Perusahaan <b>${esc(pct(rest))}</b></span>` : ''}
            </div>`;
    }

    function filteredInvestors() {
        const q = S.q.toLowerCase().trim();
        return S.data.investors.filter((i) => {
            if (S.status !== 'ALL' && i.status !== S.status) return false;
            if (!q) return true;
            return [i.name, i.code, i.phone, i.email, i.id_number].some((v) => String(v || '').toLowerCase().includes(q));
        });
    }

    function renderTable() {
        const rows = filteredInvestors();
        if (!rows.length) {
            $('ivTable').innerHTML = S.data.investors.length
                ? '<div class="iv-state"><i class="fa-solid fa-filter-circle-xmark"></i> Tidak ada investor yang cocok dengan pencarian atau filter.</div>'
                : `<div class="iv-state"><i class="fa-solid fa-user-plus"></i> Belum ada investor.${canWrite() ? '<br><button type="button" class="iv-btn iv-btn-primary" data-act="add">Tambah investor pertama</button>' : ''}</div>`;
            return;
        }
        const total = rows.reduce((a, i) => ({ capital: a.capital + i.capital, share: a.share + (i.status === 'AKTIF' ? i.share_percent : 0), fixed: a.fixed + i.fixed_value }), { capital: 0, share: 0, fixed: 0 });
        const body = rows.map((i) => {
            const st = STATUS[i.status] || STATUS.AKTIF;
            const contact = [i.phone, i.email].filter(Boolean).map(esc).join('<br>') || '<span class="iv-mut">-</span>';
            const actions = `<button type="button" class="iv-btn iv-btn-ghost iv-xs" data-act="detail" data-id="${i.id}" title="Detail"><i class="fa-solid fa-eye"></i></button>`
                + (canWrite() ? `<button type="button" class="iv-btn iv-btn-ghost iv-xs" data-act="capital" data-id="${i.id}" title="Setor / tarik modal"><i class="fa-solid fa-coins"></i></button>
                    <button type="button" class="iv-btn iv-btn-ghost iv-xs" data-act="edit" data-id="${i.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>` : '')
                + (canDelete() ? `<button type="button" class="iv-btn iv-btn-danger iv-xs" data-act="delete" data-id="${i.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>` : '');
            return `<tr>
                <td><div class="iv-who"><span class="iv-avatar">${esc((i.name.trim()[0] || '?').toUpperCase())}</span>
                    <span><b>${esc(i.name)}</b><small>${esc(i.code)} &middot; ${esc(TYPE_LABEL[i.type] || i.type)}</small></span></div></td>
                <td class="iv-contact">${contact}</td>
                <td class="r">${rp(i.capital)}</td>
                <td class="r"><b>${esc(pct(i.share_percent))}</b><div class="iv-minibar"><i style="width:${Math.min(100, i.share_percent)}%"></i></div></td>
                <td class="r">${rp(i.fixed_value)}</td>
                <td>${esc(dateShort(i.join_date))}</td>
                <td><span class="iv-pill tone-${st.tone}">${st.label}</span></td>
                <td class="iv-actions">${actions}</td>
            </tr>`;
        }).join('');
        $('ivTable').innerHTML = `<table class="iv-table">
            <thead><tr><th>Investor</th><th>Kontak</th><th class="r">Modal disetor</th><th class="r">Hak</th><th class="r">Nilai tetap</th><th>Bergabung</th><th>Status</th><th></th></tr></thead>
            <tbody>${body}</tbody>
            <tfoot><tr><td colspan="2">Total (${rows.length} investor)</td><td class="r">${rp(total.capital)}</td><td class="r">${esc(pct(total.share))}</td><td class="r">${rp(total.fixed)}</td><td colspan="3"></td></tr></tfoot>
        </table>`;
    }

    // ---------- peraga pembagian laba ----------
    // Perkiraan laba bersih satu bulan (YYYY-MM) langsung dari transaksi dan pengeluaran lokal.
    function estimateNetProfit(monthStr) {
        if (!monthStr) return 0;
        const trxs = typeof getTransactions === 'function' ? getTransactions() : [];
        const exps = typeof getExpenses === 'function' ? getExpenses() : [];
        const currencies = typeof getCurrencies === 'function' ? getCurrencies() : [];
        let margin = 0, totalBebanOp = 0, totalPendapatanNonOp = 0, d25 = 0;

        trxs.forEach((t) => {
            const tDate = t.timestamp ? t.timestamp.substring(0, 7) : '';
            if (tDate !== monthStr) return;
            const cur = currencies.find((c) => c.code === t.valuta);
            if (!cur) return;
            const mid = (parseFloat(cur.buy) + parseFloat(cur.sell)) / 2;
            if (t.tipe === 'JUAL') margin += (parseFloat(t.rate) - mid) * parseFloat(t.nominal);
            else margin += (mid - parseFloat(t.rate)) * parseFloat(t.nominal);
        });

        exps.forEach((e) => {
            const eDate = e.timestamp ? e.timestamp.substring(0, 7) : '';
            if (eDate !== monthStr) return;
            const cat = e.kategori ? e.kategori.substring(0, 2) : '';
            const nominal = parseFloat(e.nominal) || 0;
            if (e.tipe === 'KELUAR') {
                if (cat === '25') d25 += nominal;
                else if (cat >= '07' && cat <= '15') totalBebanOp += nominal;
                else if (!cat) totalBebanOp += nominal;
            } else if (e.tipe === 'PENDAPATAN' || e.tipe === 'MASUK') {
                if ((cat >= '16' && cat <= '24') || !cat) totalPendapatanNonOp += nominal;
            }
        });

        const laba = margin > 0 ? margin : 0;
        const rugi = margin < 0 ? Math.abs(margin) : 0;
        return (laba + totalPendapatanNonOp) - (totalBebanOp + rugi) - d25;
    }

    function simRows() {
        const net = estimateNetProfit(S.month);
        const pos = net > 0 ? net : 0;
        const list = S.data.investors.filter((i) => i.status === 'AKTIF' && i.share_percent > 0).map((i) => {
            const amount = S.method === 'net_profit' ? (i.share_percent / 100) * pos : (i.share_percent / 100) * i.capital;
            const basis = S.method === 'net_profit' ? `${pct(i.share_percent)} dari laba bersih` : `${pct(i.share_percent)} dari ${rp(i.capital)}`;
            return { i, amount, basis };
        });
        const distributed = list.reduce((s, x) => s + x.amount, 0);
        return { net, pos, list, distributed, retained: pos - distributed };
    }

    function renderSim() {
        if (!S.data) return;
        if (!S.month) S.month = todayStr().slice(0, 7);
        const m = $('ivMonth'); if (m && m.value !== S.month) m.value = S.month;
        const me = $('ivMethod'); if (me && me.value !== S.method) me.value = S.method;
        const r = simRows();
        const net = $('ivNet');
        net.textContent = r.net < 0 ? `${rp(r.net)} (Rugi)` : rp(r.net);
        net.className = r.net < 0 ? 'tx-bad' : 'tx-ok';
        if (!r.list.length) {
            $('ivSimTable').innerHTML = '<div class="iv-state"><i class="fa-solid fa-users-slash"></i> Belum ada investor aktif dengan hak persentase.</div>';
            return;
        }
        const retainedLabel = r.retained < 0 ? `Kurang dari laba: ditanggung perusahaan ${rp(Math.abs(r.retained))}` : rp(r.retained);
        $('ivSimTable').innerHTML = `<table class="iv-table">
            <thead><tr><th>Investor</th><th class="r">Hak</th><th class="r">Estimasi diterima</th></tr></thead>
            <tbody>${r.list.map((x) => `<tr>
                <td><div class="iv-who"><span class="iv-avatar">${esc((x.i.name.trim()[0] || '?').toUpperCase())}</span><span><b>${esc(x.i.name)}</b><small>${esc(x.i.code)}</small></span></div></td>
                <td class="r">${esc(pct(x.i.share_percent))}</td>
                <td class="r"><b class="tx-ok">${rp(x.amount)}</b><small class="iv-sub">${esc(x.basis)}</small></td></tr>`).join('')}</tbody>
            <tfoot>
                <tr><td colspan="2">Total peraga pembagian</td><td class="r">${rp(r.distributed)}</td></tr>
                <tr><td colspan="2">Sisa laba / disimpan perusahaan</td><td class="r ${r.retained < 0 ? 'tx-bad' : ''}">${retainedLabel}</td></tr>
            </tfoot></table>`;
    }

    // ---------- modal ----------
    let escHandler = null;
    function closeModal() {
        const el = $('ivOverlay');
        if (el) el.remove();
        if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
    }
    function openModal(html, wide) {
        closeModal();
        const el = document.createElement('div');
        el.id = 'ivOverlay'; el.className = 'iv-overlay';
        el.innerHTML = `<div class="iv-dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
        document.body.appendChild(el);
        el.addEventListener('mousedown', (e) => { if (e.target === el) closeModal(); });
        escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', escHandler);
        return el;
    }
    function bindMoney(input) {
        if (!input) return;
        input.addEventListener('input', () => { const v = digits(input.value); input.value = v > 0 ? nf.format(v) : ''; });
    }
    function setBusy(btn, busy) {
        if (!btn) return;
        btn.disabled = busy;
        if (busy) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...'; }
        else if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
    function fieldError(id, message) {
        const el = $(id + 'Err');
        if (el) el.textContent = message || '';
        const input = $(id);
        if (input) input.classList.toggle('bad', !!message);
        return !message;
    }

    // --- tambah / edit ---
    function openForm(inv) {
        if (!canWrite()) { toast('warning', 'Peran Anda tidak boleh mengubah data investor.'); return; }
        const editing = !!inv;
        const others = S.data.investors.filter((i) => i.status === 'AKTIF' && (!editing || i.id !== inv.id)).reduce((s, i) => s + i.share_percent, 0);
        const room = Math.max(0, Math.round((100 - others) * 10000) / 10000);
        const v = inv || { name: '', type: 'PERORANGAN', id_number: '', phone: '', email: '', address: '', join_date: todayStr(), status: 'AKTIF', share_percent: '', notes: '' };

        const el = openModal(`
            <div class="iv-dlg-head"><h3><i class="fa-solid ${editing ? 'fa-user-pen' : 'fa-user-plus'}"></i> ${editing ? 'Edit Investor' : 'Tambah Investor'}${editing ? ` <small>${esc(inv.code)}</small>` : ''}</h3><button type="button" class="iv-x" data-close aria-label="Tutup">&times;</button></div>
            <form id="ivForm" novalidate autocomplete="off">
                <fieldset><legend>Identitas</legend>
                    <label class="iv-field"><span>Nama investor <em>*</em></span>
                        <input id="ivfName" type="text" maxlength="150" placeholder="Contoh: Rayyan atau PT Mitra Almara" value="${esc(v.name)}"><small id="ivfNameErr" class="iv-err"></small></label>
                    <div class="iv-row">
                        <div class="iv-field"><span>Jenis</span>
                            <div class="iv-seg two">
                                <label><input type="radio" name="ivfType" value="PERORANGAN"${v.type !== 'BADAN_USAHA' ? ' checked' : ''}><b>Perorangan</b></label>
                                <label><input type="radio" name="ivfType" value="BADAN_USAHA"${v.type === 'BADAN_USAHA' ? ' checked' : ''}><b>Badan usaha</b></label>
                            </div></div>
                        <label class="iv-field"><span>No. identitas (NIK / NPWP)</span><input id="ivfIdNo" type="text" inputmode="numeric" maxlength="40" placeholder="Opsional" value="${esc(v.id_number || '')}"></label>
                    </div>
                </fieldset>
                <fieldset><legend>Kontak</legend>
                    <div class="iv-row">
                        <label class="iv-field"><span>No. HP</span><input id="ivfPhone" type="tel" maxlength="40" placeholder="Contoh: 0812 3456 7890" value="${esc(v.phone || '')}"><small id="ivfPhoneErr" class="iv-err"></small></label>
                        <label class="iv-field"><span>Email</span><input id="ivfEmail" type="email" maxlength="150" placeholder="nama@email.com" value="${esc(v.email || '')}"><small id="ivfEmailErr" class="iv-err"></small></label>
                    </div>
                    <label class="iv-field"><span>Alamat</span><input id="ivfAddress" type="text" maxlength="255" placeholder="Opsional" value="${esc(v.address || '')}"></label>
                </fieldset>
                <fieldset><legend>Kepemilikan</legend>
                    <div class="iv-row">
                        <label class="iv-field"><span>Hak persentase (%) <em>*</em></span>
                            <input id="ivfShare" type="number" min="0" max="100" step="0.01" inputmode="decimal" placeholder="0" value="${esc(v.share_percent)}">
                            <small id="ivfShareErr" class="iv-err"></small><small id="ivfShareHint" class="iv-hint"></small></label>
                        ${editing
                            ? `<div class="iv-field"><span>Modal disetor</span><div class="iv-readonly">${rp(inv.capital)}<small>Ubah lewat tombol Setor / tarik modal</small></div></div>`
                            : `<label class="iv-field"><span>Modal awal (Rp)</span><input id="ivfCapital" type="text" inputmode="numeric" placeholder="0"><small class="iv-hint">Dicatat sebagai setoran pertama.</small></label>`}
                    </div>
                    <div class="iv-row">
                        <label class="iv-field"><span>Tanggal bergabung</span><input id="ivfJoin" type="date" max="${todayStr()}" value="${esc(v.join_date || todayStr())}"><small id="ivfJoinErr" class="iv-err"></small></label>
                        ${editing
                            ? `<label class="iv-field"><span>Status</span><select id="ivfStatus">${Object.keys(STATUS).map((k) => `<option value="${k}"${v.status === k ? ' selected' : ''}>${STATUS[k].label}</option>`).join('')}</select><small class="iv-hint">Nonaktif / keluar tidak dihitung dalam hak 100%.</small></label>`
                            : '<div></div>'}
                    </div>
                    <label class="iv-field"><span>Catatan</span><textarea id="ivfNotes" rows="2" maxlength="1000" placeholder="Opsional, misalnya ketentuan bagi hasil">${esc(v.notes || '')}</textarea></label>
                </fieldset>
                <div class="iv-dlg-foot"><button type="button" class="iv-btn iv-btn-ghost" data-close>Batal</button><button type="submit" class="iv-btn iv-btn-primary" id="ivfSave"><i class="fa-solid fa-floppy-disk"></i> ${editing ? 'Simpan Perubahan' : 'Simpan Investor'}</button></div>
            </form>`, true);

        bindMoney($('ivfCapital'));
        const share = $('ivfShare');
        const hint = () => {
            const val = parseFloat(share.value) || 0;
            const statusEl = $('ivfStatus');
            const counted = !statusEl || statusEl.value === 'AKTIF';
            const left = Math.round((room - (counted ? val : 0)) * 10000) / 10000;
            $('ivfShareHint').innerHTML = counted
                ? (left < 0 ? `<span class="tx-bad">Melebihi sisa alokasi ${esc(pct(room))}.</span>` : `Sisa alokasi: <b>${esc(pct(left))}</b> dari ${esc(pct(room))}`)
                : 'Tidak dihitung karena status tidak aktif.';
        };
        share.addEventListener('input', hint);
        if ($('ivfStatus')) $('ivfStatus').addEventListener('change', hint);
        hint();

        $('ivForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = $('ivfName').value.trim().replace(/\s+/g, ' ');
            const phone = $('ivfPhone').value.trim();
            const email = $('ivfEmail').value.trim();
            const shareVal = $('ivfShare').value;
            const join = $('ivfJoin').value;
            const statusVal = $('ivfStatus') ? $('ivfStatus').value : 'AKTIF';
            let ok = true;
            ok = fieldError('ivfName', name.length < 2 ? 'Nama minimal 2 karakter.' : '') && ok;
            ok = fieldError('ivfPhone', phone && !/^[0-9+()\-\s.]+$/.test(phone) ? 'Hanya angka, spasi, +, -, titik, dan kurung.' : '') && ok;
            ok = fieldError('ivfEmail', email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Format email tidak valid.' : '') && ok;
            const shareNum = parseFloat(shareVal);
            let shareMsg = '';
            if (shareVal === '' || isNaN(shareNum)) shareMsg = 'Hak persentase wajib diisi (boleh 0).';
            else if (shareNum < 0 || shareNum > 100) shareMsg = 'Hak persentase harus antara 0 dan 100.';
            else if (statusVal === 'AKTIF' && shareNum > room + 0.00005 && (!editing || shareNum > (inv.status === 'AKTIF' ? inv.share_percent : 0) + 0.00005)) shareMsg = `Melebihi sisa alokasi ${pct(room)}.`;
            ok = fieldError('ivfShare', shareMsg) && ok;
            ok = fieldError('ivfJoin', join && join > todayStr() ? 'Tanggal tidak boleh di masa depan.' : '') && ok;
            if (!ok) { const bad = el.querySelector('.bad'); if (bad) bad.focus(); return; }

            const body = {
                name, type: el.querySelector('input[name="ivfType"]:checked').value,
                id_number: $('ivfIdNo').value.trim() || null, phone: phone || null, email: email || null,
                address: $('ivfAddress').value.trim() || null, join_date: join || null,
                share_percent: shareNum, notes: $('ivfNotes').value.trim() || null
            };
            if (editing) body.status = statusVal; else body.initial_capital = digits($('ivfCapital').value);

            const btn = $('ivfSave'); setBusy(btn, true);
            try {
                const res = await api(editing ? `api/investors/${inv.id}` : 'api/investors', { method: editing ? 'PUT' : 'POST', body });
                S.data = res.data; S.loadedAt = Date.now();
                closeModal(); renderAll(); toast('success', res.message);
            } catch (err) {
                setBusy(btn, false); toast('error', err.message);
            }
        });
        setTimeout(() => $('ivfName').focus(), 30);
    }

    // --- setor / tarik modal ---
    function openCapital(inv) {
        if (!canWrite()) { toast('warning', 'Peran Anda tidak boleh mengubah modal investor.'); return; }
        const el = openModal(`
            <div class="iv-dlg-head"><h3><i class="fa-solid fa-coins"></i> Modal ${esc(inv.name)}</h3><button type="button" class="iv-x" data-close aria-label="Tutup">&times;</button></div>
            <div class="iv-info"><div><small>Modal disetor saat ini</small><b>${rp(inv.capital)}</b></div><div><small>Total disetor</small><b>${rp(inv.deposited)}</b></div><div><small>Total ditarik</small><b>${rp(inv.withdrawn)}</b></div></div>
            <form id="ivCapForm" novalidate autocomplete="off">
                <div class="iv-field"><span>Jenis</span>
                    <div class="iv-seg two">
                        <label><input type="radio" name="ivcType" value="SETOR" checked><b>Setor modal</b><small>menambah modal</small></label>
                        <label><input type="radio" name="ivcType" value="TARIK"><b>Tarik modal</b><small>mengurangi modal</small></label>
                    </div></div>
                <div class="iv-row">
                    <label class="iv-field"><span>Nominal (Rp) <em>*</em></span><input id="ivcAmount" type="text" inputmode="numeric" placeholder="0"><small id="ivcAmountErr" class="iv-err"></small></label>
                    <label class="iv-field"><span>Tanggal</span><input id="ivcDate" type="date" max="${todayStr()}" value="${todayStr()}"><small id="ivcDateErr" class="iv-err"></small></label>
                </div>
                <label class="iv-field"><span>Catatan</span><input id="ivcNote" type="text" maxlength="255" placeholder="Contoh: tambahan modal kuartal ini"></label>
                <div class="iv-after" id="ivcAfter"></div>
                <p class="iv-note"><i class="fa-solid fa-circle-info"></i> Hanya catatan. Saldo kas atau bank di ledger tidak berubah.</p>
                <div class="iv-dlg-foot"><button type="button" class="iv-btn iv-btn-ghost" data-close>Batal</button><button type="submit" class="iv-btn iv-btn-primary" id="ivcSave"><i class="fa-solid fa-check"></i> Simpan</button></div>
            </form>`);
        const amount = $('ivcAmount'); bindMoney(amount);
        const type = () => el.querySelector('input[name="ivcType"]:checked').value;
        const after = () => {
            const v = digits(amount.value);
            const next = inv.capital + (type() === 'SETOR' ? v : -v);
            $('ivcAfter').innerHTML = next < 0
                ? `<span class="tx-bad"><i class="fa-solid fa-triangle-exclamation"></i> Penarikan melebihi modal (${rp(inv.capital)}).</span>`
                : `Modal setelah transaksi: <b>${rp(next)}</b>`;
        };
        amount.addEventListener('input', after);
        el.querySelectorAll('input[name="ivcType"]').forEach((r) => r.addEventListener('change', after));
        after();

        $('ivCapForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const v = digits(amount.value);
            const date = $('ivcDate').value;
            let ok = true;
            ok = fieldError('ivcAmount', v <= 0 ? 'Nominal harus lebih besar dari Rp 0.' : (type() === 'TARIK' && v > inv.capital ? `Melebihi modal (${rp(inv.capital)}).` : '')) && ok;
            ok = fieldError('ivcDate', !date ? 'Tanggal wajib diisi.' : (date > todayStr() ? 'Tanggal tidak boleh di masa depan.' : '')) && ok;
            if (!ok) return;
            const btn = $('ivcSave'); setBusy(btn, true);
            try {
                const res = await api(`api/investors/${inv.id}/capital`, { method: 'POST', body: { type: type(), amount: v, occurred_on: date, note: $('ivcNote').value.trim() || null } });
                S.data = res.data; S.loadedAt = Date.now();
                closeModal(); renderAll(); toast('success', res.message);
            } catch (err) {
                setBusy(btn, false); toast('error', err.message);
            }
        });
        setTimeout(() => amount.focus(), 30);
    }

    // --- detail ---
    function openDetail(inv) {
        const st = STATUS[inv.status] || STATUS.AKTIF;
        const kv = (k, v) => `<div><small>${k}</small><b>${v || '<span class="iv-mut">-</span>'}</b></div>`;
        const moves = inv.movements.length ? inv.movements.map((m) => `<li class="${m.type === 'SETOR' ? 'in' : 'out'}">
                <span class="iv-mv-ico"><i class="fa-solid ${m.type === 'SETOR' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></span>
                <span class="iv-mv-main"><b>${m.type === 'SETOR' ? 'Setor modal' : 'Tarik modal'}</b><small>${esc(dateShort(m.occurred_on))}${m.by ? ' &middot; ' + esc(m.by) : ''}${m.note ? ' &middot; ' + esc(m.note) : ''}</small></span>
                <em>${m.type === 'SETOR' ? '+' : '-'}${rp(m.amount)}</em>
                ${canDelete() ? `<button type="button" class="iv-btn iv-btn-danger iv-xs" data-act="del-move" data-id="${inv.id}" data-mv="${m.id}" title="Hapus riwayat"><i class="fa-solid fa-trash"></i></button>` : ''}
            </li>`).join('') : '<li class="iv-empty">Belum ada riwayat modal.</li>';

        openModal(`
            <div class="iv-dlg-head"><h3><i class="fa-solid fa-user"></i> ${esc(inv.name)} <small>${esc(inv.code)}</small></h3><button type="button" class="iv-x" data-close aria-label="Tutup">&times;</button></div>
            <div class="iv-kv">
                ${kv('Status', `<span class="iv-pill tone-${st.tone}">${st.label}</span>`)}
                ${kv('Jenis', esc(TYPE_LABEL[inv.type] || inv.type))}
                ${kv('Hak persentase', esc(pct(inv.share_percent)))}
                ${kv('Modal disetor', rp(inv.capital))}
                ${kv('No. identitas', esc(inv.id_number))}
                ${kv('Bergabung', esc(dateShort(inv.join_date)))}
                ${kv('No. HP', esc(inv.phone))}
                ${kv('Email', esc(inv.email))}
                ${kv('Alamat', esc(inv.address))}
                ${kv('Nilai tetap per periode', rp(inv.fixed_value))}
            </div>
            ${inv.notes ? `<p class="iv-notes"><i class="fa-solid fa-note-sticky"></i> ${esc(inv.notes)}</p>` : ''}
            <h4 class="iv-sub-h">Riwayat modal</h4>
            <ul class="iv-moves">${moves}</ul>
            <p class="iv-mut" style="font-size:.74rem;margin:10px 0 0">Dicatat oleh ${esc(inv.created_by_name || '-')}${inv.updated_by_name ? ', terakhir diubah oleh ' + esc(inv.updated_by_name) : ''}.</p>
            <div class="iv-dlg-foot">
                ${canWrite() ? `<button type="button" class="iv-btn iv-btn-ghost" data-act="capital" data-id="${inv.id}"><i class="fa-solid fa-coins"></i> Setor / tarik modal</button><button type="button" class="iv-btn iv-btn-ghost" data-act="edit" data-id="${inv.id}"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}
                <button type="button" class="iv-btn iv-btn-primary" data-close>Tutup</button>
            </div>`, true);
    }

    // --- aksi tanpa modal ---
    async function removeInvestor(inv) {
        const ok = await confirmBox({
            icon: 'warning', title: `Hapus ${inv.name}?`,
            text: 'Investor beserta seluruh riwayat modalnya dihapus permanen. Bila hanya berhenti berinvestasi, lebih baik ubah statusnya menjadi Nonaktif atau Keluar.',
            confirmText: 'Ya, hapus'
        });
        if (!ok) return;
        try {
            const res = await api(`api/investors/${inv.id}`, { method: 'DELETE' });
            S.data = res.data; S.loadedAt = Date.now();
            closeModal(); renderAll(); toast('success', res.message);
        } catch (err) { toast('error', err.message); }
    }

    async function removeMovement(inv, mvId) {
        const ok = await confirmBox({ icon: 'warning', title: 'Hapus riwayat modal?', text: 'Modal disetor investor akan dihitung ulang tanpa riwayat ini.', confirmText: 'Ya, hapus' });
        if (!ok) return;
        try {
            const res = await api(`api/investors/${inv.id}/capital/${mvId}`, { method: 'DELETE' });
            S.data = res.data; S.loadedAt = Date.now();
            renderAll(); toast('success', res.message);
            const fresh = find(inv.id); if (fresh) openDetail(fresh); else closeModal();
        } catch (err) { toast('error', err.message); }
    }

    function downloadCsv(name, lines) {
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

    function exportCsv() {
        if (!S.data) return;
        if (S.tab === 'sim') {
            const r = simRows();
            const lines = [['Kode', 'Investor', 'Hak (%)', 'Dasar', 'Estimasi diterima'].map(q).join(',')];
            r.list.forEach((x) => lines.push([x.i.code, x.i.name, x.i.share_percent, x.basis, Math.round(x.amount)].map(q).join(',')));
            lines.push(['', 'Total', '', '', Math.round(r.distributed)].map(q).join(','));
            downloadCsv(`peraga-laba-${S.month || 'bulan'}.csv`, lines);
            return;
        }
        const lines = [['Kode', 'Nama', 'Jenis', 'No identitas', 'HP', 'Email', 'Alamat', 'Bergabung', 'Status', 'Hak (%)', 'Modal disetor', 'Nilai tetap'].map(q).join(',')];
        filteredInvestors().forEach((i) => lines.push([i.code, i.name, TYPE_LABEL[i.type] || i.type, i.id_number, i.phone, i.email, i.address,
            i.join_date, (STATUS[i.status] || {}).label, i.share_percent, Math.round(i.capital), Math.round(i.fixed_value)].map(q).join(',')));
        downloadCsv(`investor-${todayStr()}.csv`, lines);
    }

    function setTab(tab) {
        S.tab = tab === 'sim' ? 'sim' : 'list';
        document.querySelectorAll('#investorRoot .iv-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
        $('ivPanelList').classList.toggle('iv-hide', S.tab !== 'list');
        $('ivPanelSim').classList.toggle('iv-hide', S.tab !== 'sim');
        if (S.tab === 'sim') renderSim();
    }

    // ---------- event ----------
    function onClick(e) {
        if (e.target.closest('[data-close]')) { closeModal(); return; }
        const tab = e.target.closest('[data-tab]');
        if (tab) { setTab(tab.dataset.tab); return; }
        const btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        const act = btn.dataset.act;
        const inv = btn.dataset.id ? find(btn.dataset.id) : null;
        if (act === 'refresh') load(true);
        else if (act === 'add') openForm(null);
        else if (act === 'export') exportCsv();
        else if (inv && act === 'detail') openDetail(inv);
        else if (inv && act === 'edit') openForm(inv);
        else if (inv && act === 'capital') openCapital(inv);
        else if (inv && act === 'delete') removeInvestor(inv);
        else if (inv && act === 'del-move') removeMovement(inv, btn.dataset.mv);
    }

    function bindOnce() {
        if (window.__ivBound) return;
        window.__ivBound = true;
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#investorRoot') && !e.target.closest('#ivOverlay')) return;
            onClick(e);
        });
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'ivSearch') { S.q = e.target.value; if (S.data) renderTable(); }
        });
        document.addEventListener('change', (e) => {
            if (!e.target) return;
            if (e.target.id === 'ivStatus') { S.status = e.target.value; if (S.data) renderTable(); }
            else if (e.target.id === 'ivMonth') { S.month = e.target.value; renderSim(); }
            else if (e.target.id === 'ivMethod') { S.method = e.target.value; renderSim(); }
        });
    }

    // ---------- publik ----------
    window.initInvestorView = function () { bindOnce(); ensureShell(); load(false); };
    window.loadInvestorTable = window.initInvestorView; // pemanggil lama
    window.switchInvestorTab = function (t) { ensureShell(); setTab(t === 'dividend' ? 'sim' : t); };
    window.openInvestorModal = function (key) { bindOnce(); ensureShell(); const go = () => openForm(key ? find(key) : null); if (S.data) go(); else load(true).then(go); };
    window.refreshInvestors = function () { return load(true, true); };

    // Muat di latar belakang agar perhitungan akuntansi (modal disetor) memakai data MySQL.
    bindOnce();
    setTimeout(() => { load(false, true); }, 1500);
})();
