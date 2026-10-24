// Jurnal Keuangan (menu Pengeluaran)
// - Setiap jurnal punya kode akun BI (01-25) dari katalog 36-lkbu.js: kode di form = kode di LKBU B0003.
// - Disimpan ke MySQL (erp_expenses + ledger kas/bank) lewat /api/erp/expenses/sync.
// - Kompatibel: data kerja tetap mc_expenses, sehingga Neraca, LKBU, Dashboard, Investor membaca seperti biasa.
// Warna memakai variabel tema (--mc-*).
(function () {
    'use strict';

    const SOURCES = [
        { v: 'CASH', l: 'Kas Tunai' },
        { v: 'BCA', l: 'Bank BCA' },
        { v: 'MANDIRI', l: 'Bank Mandiri' }
    ];
    const S = { month: '', type: '', code: '', q: '', sync: { state: 'idle', msg: '' }, merged: false };

    const $ = (id) => document.getElementById(id);
    const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rp = (n) => `${n < 0 ? '-' : ''}Rp ${nf.format(Math.abs(Math.round(Number(n) || 0)))}`;
    const monthNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const todayStr = () => { const d = new Date(); return `${monthNow()}-${String(d.getDate()).padStart(2, '0')}`; };
    const digits = (v) => parseInt(String(v || '').replace(/[^\d]/g, ''), 10) || 0;
    const accounts = () => window.LKBU_ACCOUNTS || {};
    const codeOf = (e) => (typeof window.lkbuCodeOf === 'function' ? window.lkbuCodeOf(e) : String(e.kategori || '').slice(0, 2));
    const accName = (c) => (accounts()[c] ? accounts()[c].name : '');
    const srcLabel = (s) => (s === 'CASH' ? 'Kas Tunai' : s === 'MANDIRI' ? 'Bank Mandiri' : 'Bank BCA');

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

    // ---------- gaya ----------
    function injectStyle() {
        if ($('ex-style')) return;
        const st = document.createElement('style');
        st.id = 'ex-style';
        st.textContent = `
        .ex-root, .ex-overlay { --ex-bd: var(--mc-border, rgba(148,163,184,.28)); --ex-card: var(--mc-card-bg, #18181b); --ex-tx: var(--mc-text, #fafafa);
            --ex-mut: var(--mc-text-muted, #a1a1aa); --ex-pri: var(--mc-primary, #22c55e); --ex-ok: var(--mc-buy, #22c55e); --ex-bad: var(--mc-danger, #ef4444);
            --ex-inp: var(--mc-input-bg, rgba(148,163,184,.08)); --ex-r: var(--mc-radius, 14px); color: var(--ex-tx); }
        .ex-root * { box-sizing: border-box; }
        .ex-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .ex-head h2 { margin: 0; font-size: 1.25rem; } .ex-head p { margin: 4px 0 0; color: var(--ex-mut); font-size: .85rem; }
        .ex-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ex-btn { border: 1px solid var(--ex-bd); background: transparent; color: var(--ex-tx); padding: 9px 14px; border-radius: var(--mc-btn-radius, 10px); cursor: pointer; font-weight: 600; font-size: .85rem; }
        .ex-btn:hover { background: color-mix(in srgb, var(--ex-tx) 7%, transparent); }
        .ex-btn-primary { background: var(--ex-pri); border-color: var(--ex-pri); color: #fff; }
        .ex-btn-primary:hover { background: color-mix(in srgb, var(--ex-pri) 88%, #000); }
        .ex-btn-danger { color: var(--ex-bad); border-color: color-mix(in srgb, var(--ex-bad) 40%, transparent); padding: 6px 9px; }
        .ex-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 14px; }
        .ex-card { background: var(--ex-card); border: 1px solid var(--ex-bd); border-radius: var(--ex-r); padding: 14px 16px; }
        .ex-card small { color: var(--ex-mut); display: block; font-size: .76rem; text-transform: uppercase; letter-spacing: .04em; }
        .ex-card strong { display: block; font-size: 1.3rem; margin-top: 4px; font-variant-numeric: tabular-nums; }
        .ex-card.in strong { color: var(--ex-ok); } .ex-card.out strong { color: var(--ex-bad); }
        .ex-panel { background: var(--ex-card); border: 1px solid var(--ex-bd); border-radius: var(--ex-r); padding: 14px 16px; margin-bottom: 14px; }
        .ex-filters { display: grid; grid-template-columns: 170px 170px 1fr 1.4fr; gap: 10px; }
        .ex-filters label, .ex-form label { display: flex; flex-direction: column; gap: 5px; font-size: .78rem; color: var(--ex-mut); font-weight: 600; }
        .ex-in { width: 100%; background: var(--ex-inp); color: var(--ex-tx); border: 1px solid var(--mc-input-border, var(--ex-bd)); border-radius: var(--mc-input-radius, 10px); padding: 9px 11px; font: inherit; }
        .ex-in:focus { outline: 2px solid color-mix(in srgb, var(--ex-pri) 55%, transparent); outline-offset: 0; }
        .ex-sync { display: flex; align-items: center; gap: 8px; font-size: .78rem; color: var(--ex-mut); margin: 0 0 12px; }
        .ex-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ex-mut); } .ex-sync.ok .ex-dot { background: var(--ex-ok); } .ex-sync.err .ex-dot { background: var(--ex-bad); }
        .ex-sync.err { color: var(--ex-bad); } .ex-sync button { border: 0; background: none; color: var(--ex-pri); cursor: pointer; font-weight: 700; padding: 0; }
        .ex-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start; }
        .ex-table-wrap { overflow-x: auto; }
        .ex-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
        .ex-table th { text-align: left; color: var(--ex-mut); font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; padding: 8px 10px; border-bottom: 1px solid var(--ex-bd); white-space: nowrap; }
        .ex-table td { padding: 10px; border-bottom: 1px solid color-mix(in srgb, var(--ex-bd) 60%, transparent); vertical-align: top; }
        .ex-table tbody tr:hover { background: var(--mc-table-hover, color-mix(in srgb, var(--ex-tx) 5%, transparent)); }
        .ex-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 700; }
        .ex-num.in { color: var(--ex-ok); } .ex-num.out { color: var(--ex-bad); }
        .ex-chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: .72rem; font-weight: 700; }
        .ex-chip.in { color: var(--ex-ok); background: color-mix(in srgb, var(--ex-ok) 15%, transparent); }
        .ex-chip.out { color: var(--ex-bad); background: color-mix(in srgb, var(--ex-bad) 15%, transparent); }
        .ex-code { display: inline-flex; gap: 6px; align-items: baseline; }
        .ex-code b { background: color-mix(in srgb, var(--ex-pri) 16%, transparent); color: var(--ex-pri); border-radius: 6px; padding: 1px 7px; font-size: .76rem; }
        .ex-code span { color: var(--ex-mut); font-size: .8rem; }
        .ex-by { display: block; color: var(--ex-mut); font-size: .72rem; margin-top: 3px; }
        .ex-empty { text-align: center; color: var(--ex-mut); padding: 34px 10px; }
        .ex-bi h3 { margin: 0 0 4px; font-size: .95rem; } .ex-bi > p { margin: 0 0 10px; color: var(--ex-mut); font-size: .76rem; }
        .ex-bi ul { list-style: none; margin: 0; padding: 0; }
        .ex-bi li { display: flex; align-items: center; gap: 8px; padding: 7px 4px; border-bottom: 1px dashed color-mix(in srgb, var(--ex-bd) 70%, transparent); cursor: pointer; font-size: .82rem; border-radius: 6px; }
        .ex-bi li:hover, .ex-bi li.on { background: color-mix(in srgb, var(--ex-pri) 10%, transparent); }
        .ex-bi li b { color: var(--ex-pri); width: 22px; } .ex-bi li span { flex: 1; min-width: 0; } .ex-bi li em { font-style: normal; font-weight: 700; font-variant-numeric: tabular-nums; }
        .ex-bi li.zero { opacity: .5; }
        .ex-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 10050; padding: 14px; }
        .ex-dialog { background: var(--ex-card); border: 1px solid var(--ex-bd); border-radius: var(--ex-r); width: 100%; max-width: 520px; max-height: 92vh; overflow: auto; padding: 20px; box-shadow: var(--mc-shadow, 0 20px 50px rgba(0,0,0,.4)); }
        .ex-dialog h3 { margin: 0 0 14px; display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; }
        .ex-x { border: 0; background: none; color: var(--ex-mut); font-size: 1.5rem; cursor: pointer; line-height: 1; }
        .ex-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .ex-form .full { grid-column: 1 / -1; }
        .ex-seg { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--ex-bd); border-radius: 10px; overflow: hidden; }
        .ex-seg button { border: 0; background: transparent; color: var(--ex-mut); padding: 9px; cursor: pointer; font-weight: 700; font-size: .84rem; }
        .ex-seg button.on.out { background: color-mix(in srgb, var(--ex-bad) 18%, transparent); color: var(--ex-bad); }
        .ex-seg button.on.in { background: color-mix(in srgb, var(--ex-ok) 18%, transparent); color: var(--ex-ok); }
        .ex-hint { grid-column: 1 / -1; font-size: .78rem; color: var(--ex-mut); background: color-mix(in srgb, var(--ex-pri) 8%, transparent); border-radius: 10px; padding: 9px 11px; }
        .ex-err { grid-column: 1 / -1; color: var(--ex-bad); font-size: .8rem; min-height: 1em; }
        .ex-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        @media (max-width: 980px) { .ex-grid { grid-template-columns: 1fr; } .ex-filters { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .ex-filters, .ex-form { grid-template-columns: 1fr; } }
        @media print { .ex-actions, .ex-filters, .ex-sync, .ex-bi, .ex-col-act { display: none !important; } .ex-grid { grid-template-columns: 1fr; } }`;
        document.head.appendChild(st);
    }

    // ---------- data ----------
    const all = () => (typeof getExpenses === 'function' ? getExpenses() : []);
    const inMonth = (e, month) => !month || String(e.timestamp || '').startsWith(month);
    function filtered() {
        const q = S.q.trim().toLowerCase();
        return all().filter((e) => inMonth(e, S.month)
            && (!S.type || (e.tipe || 'PENGELUARAN') === S.type)
            && (!S.code || codeOf(e) === S.code)
            && (!q || `${e.id_pengeluaran} ${e.deskripsi} ${e.kategori}`.toLowerCase().includes(q)))
            .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    }

    function setSync(state, msg) { S.sync = { state, msg: msg || '' }; paintSync(); }
    function paintSync() {
        const el = $('exSync'); if (!el) return;
        const map = { idle: ['', 'MySQL: menunggu sinkron'], busy: ['', 'Menyinkronkan ke MySQL...'], ok: ['ok', 'Tersimpan di MySQL (jurnal + ledger kas/bank)'], err: ['err', S.sync.msg || 'Gagal sinkron'] };
        const [cls, text] = map[S.sync.state] || map.idle;
        el.className = `ex-sync ${cls}`;
        el.innerHTML = `<i class="ex-dot"></i><span>${esc(text)}</span>${S.sync.state === 'err' ? ' <button type="button" data-ex="resync">Coba lagi</button>' : ''}`;
    }
    async function pushToServer(deleted, alertOnError) {
        setSync('busy');
        const ok = typeof window.syncExpensesToLedger === 'function' ? await window.syncExpensesToLedger(deleted || [], !!alertOnError) : false;
        setSync(ok ? 'ok' : 'err', ok ? '' : 'Tersimpan di browser, belum masuk MySQL. Cek koneksi lalu coba lagi.');
        return ok;
    }

    /** Ambil jurnal yang sudah ada di MySQL tapi belum ada di browser ini (perangkat lain / data hilang). */
    async function mergeFromServer() {
        if (S.merged || typeof window.authFetch !== 'function') return;
        S.merged = true;
        try {
            const res = await window.authFetch('api/erp/expenses');
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.status !== 'success') return;
            const local = all();
            const have = new Set(local.map((e) => String(e.id_pengeluaran)));
            const add = (json.data || []).filter((r) => !have.has(String(r.id_pengeluaran))).map((r) => ({
                id_pengeluaran: r.id_pengeluaran, timestamp: r.timestamp, tipe: r.tipe, kategori: r.kategori, deskripsi: r.deskripsi || '',
                sumber: r.sumber, nominal: r.nominal, inputBy: r.inputBy || '', editBy: r.editBy || ''
            }));
            if (add.length) { localStorage.setItem('mc_expenses', JSON.stringify(local.concat(add))); render(); }
        } catch (e) { console.warn('Jurnal dari MySQL tidak dapat dimuat:', e.message); }
    }

    // ---------- tampilan ----------
    function shell() {
        const root = $('expenseRoot');
        if (!root || root.dataset.ready) return root;
        root.dataset.ready = '1';
        root.className = 'ex-root';
        root.innerHTML = `
            <div class="ex-head">
                <div><h2>Jurnal Keuangan</h2><p>Pendapatan lain dan beban. Setiap jurnal otomatis masuk ke LKBU B0003 (Laba/Rugi) sesuai kode akun BI, dan mempengaruhi Neraca.</p></div>
                <div class="ex-actions">
                    <button type="button" class="ex-btn" data-ex="excel"><i class="fa-solid fa-file-excel"></i> Excel</button>
                    <button type="button" class="ex-btn" data-ex="print"><i class="fa-solid fa-print"></i> Cetak</button>
                    <button type="button" class="ex-btn ex-btn-primary" data-ex="add"><i class="fa-solid fa-plus"></i> Tambah Jurnal</button>
                </div>
            </div>
            <div class="ex-cards" id="exCards"></div>
            <div class="ex-panel ex-filters">
                <label>Bulan<input type="month" class="ex-in" id="exMonth"></label>
                <label>Tipe<select class="ex-in" id="exType"><option value="">Semua</option><option value="PENGELUARAN">Beban / Pengeluaran</option><option value="PENDAPATAN">Pendapatan</option></select></label>
                <label>Kode akun BI<select class="ex-in" id="exCode"></select></label>
                <label>Cari<input type="search" class="ex-in" id="exQ" placeholder="ID, keterangan, kategori"></label>
            </div>
            <div class="ex-sync" id="exSync"></div>
            <div class="ex-grid">
                <div class="ex-panel ex-table-wrap" style="margin:0"><table class="ex-table" id="expenseTable">
                    <thead><tr><th>Tanggal</th><th>ID</th><th>Tipe</th><th>Kode BI</th><th>Keterangan</th><th>Kas/Bank</th><th class="ex-num">Nominal</th><th class="ex-col-act"></th></tr></thead>
                    <tbody id="expensesTableBody"></tbody></table></div>
                <div class="ex-panel ex-bi" id="exBi" style="margin:0"></div>
            </div>`;
        $('exMonth').value = S.month = S.month || monthNow();
        const codes = accounts();
        $('exCode').innerHTML = '<option value="">Semua kode</option>' + Object.keys(codes)
            .filter((c) => codes[c].kind !== 'AUTO').map((c) => `<option value="${c}">${c} - ${esc(codes[c].name)}</option>`).join('');
        return root;
    }

    function render() {
        if (!shell()) return;
        const month = all().filter((e) => inMonth(e, S.month));
        const inc = month.filter((e) => e.tipe === 'PENDAPATAN').reduce((s, e) => s + Number(e.nominal || 0), 0);
        const out = month.filter((e) => (e.tipe || 'PENGELUARAN') !== 'PENDAPATAN').reduce((s, e) => s + Number(e.nominal || 0), 0);
        $('exCards').innerHTML = `
            <div class="ex-card in"><small>Pendapatan lain</small><strong>${rp(inc)}</strong></div>
            <div class="ex-card out"><small>Beban / pengeluaran</small><strong>${rp(out)}</strong></div>
            <div class="ex-card"><small>Selisih periode</small><strong>${rp(inc - out)}</strong></div>
            <div class="ex-card"><small>Jumlah jurnal</small><strong>${nf.format(month.length)}</strong></div>`;

        const me = role();
        const rows = filtered();
        $('expensesTableBody').innerHTML = rows.length ? rows.map((e) => {
            const isIn = e.tipe === 'PENDAPATAN';
            const c = codeOf(e);
            const by = (me === 'admin' || me === 'owner' || me === 'superadmin') && (e.inputBy || e.editBy)
                ? `<span class="ex-by">${e.inputBy ? 'Input: ' + esc(e.inputBy) : ''}${e.editBy ? ' · Edit: ' + esc(e.editBy) : ''}</span>` : '';
            return `<tr><td>${esc(window.formatDateToDMY ? window.formatDateToDMY(e.timestamp) : String(e.timestamp).slice(0, 10))}</td>
                <td><b>${esc(e.id_pengeluaran)}</b></td>
                <td><span class="ex-chip ${isIn ? 'in' : 'out'}">${isIn ? 'Pendapatan' : 'Beban'}</span></td>
                <td><span class="ex-code"><b>${esc(c)}</b><span>${esc(accName(c))}</span></span></td>
                <td>${esc(e.deskripsi)}${by}</td><td>${esc(srcLabel(e.sumber === 'BANK' ? 'BCA' : e.sumber))}</td>
                <td class="ex-num ${isIn ? 'in' : 'out'}">${isIn ? '+' : '-'}${rp(e.nominal)}</td>
                <td class="ex-col-act"><button type="button" class="ex-btn ex-btn-danger" data-ex="del" data-id="${esc(e.id_pengeluaran)}" title="Hapus"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        }).join('') : '<tr><td colspan="8" class="ex-empty">Belum ada jurnal pada filter ini.</td></tr>';

        // ringkasan per kode BI (sama dengan angka B0003 untuk bulan terpilih)
        const totals = {};
        month.forEach((e) => { const c = codeOf(e); totals[c] = (totals[c] || 0) + Number(e.nominal || 0); });
        const codes = accounts();
        const items = Object.keys(codes).filter((c) => codes[c].kind !== 'AUTO').map((c) => {
            const t = totals[c] || 0;
            return `<li data-ex="code" data-code="${c}" class="${S.code === c ? 'on' : ''} ${t ? '' : 'zero'}"><b>${c}</b><span>${esc(codes[c].name)}</span><em>${t ? nf.format(t) : '-'}</em></li>`;
        }).join('');
        $('exBi').innerHTML = `<h3>Ringkasan per kode BI</h3><p>Angka ini yang tampil di LKBU B0003 bulan ${esc(S.month || 'semua')}. Klik untuk memfilter.</p><ul>${items}</ul>`;
        paintSync();
    }

    // ---------- form ----------
    function role() { try { const u = (typeof getCurrentUser === 'function' && getCurrentUser()) || {}; return String(u.role || '').toLowerCase(); } catch (e) { return ''; } }

    function openForm() {
        closeForm();
        const ov = document.createElement('div');
        ov.className = 'ex-overlay'; ov.id = 'exOverlay';
        ov.innerHTML = `<div class="ex-dialog" role="dialog" aria-modal="true" aria-label="Tambah jurnal">
            <h3>Tambah Jurnal <button type="button" class="ex-x" data-ex="close" aria-label="Tutup">&times;</button></h3>
            <div class="ex-form">
                <div class="full ex-seg" id="exfType"><button type="button" class="on out" data-t="PENGELUARAN">Beban / Pengeluaran</button><button type="button" data-t="PENDAPATAN">Pendapatan lain</button></div>
                <label>Tanggal<input type="date" class="ex-in" id="exfDate" value="${todayStr()}"></label>
                <label>Sumber / tujuan dana<select class="ex-in" id="exfSource">${SOURCES.map((s) => `<option value="${s.v}">${s.l}</option>`).join('')}</select></label>
                <label class="full">Kategori akun (kode BI)<select class="ex-in" id="exfCat"></select></label>
                <label class="full">Keterangan<input type="text" class="ex-in" id="exfDesc" maxlength="200" placeholder="Contoh: Pembelian kertas HVS"></label>
                <label class="full">Nominal (Rp)<input type="text" inputmode="numeric" class="ex-in" id="exfAmt" placeholder="0"></label>
                <div class="ex-hint" id="exfHint"></div>
                <div class="ex-err" id="exfErr"></div>
            </div>
            <div class="ex-foot"><button type="button" class="ex-btn" data-ex="close">Batal</button><button type="button" class="ex-btn ex-btn-primary" data-ex="save">Simpan Jurnal</button></div></div>`;
        document.body.appendChild(ov);
        setType('PENGELUARAN');
        $('exfDesc').focus();
    }
    function closeForm() { const o = $('exOverlay'); if (o) o.remove(); }
    let formType = 'PENGELUARAN';
    function setType(t) {
        formType = t;
        document.querySelectorAll('#exfType button').forEach((b) => { const on = b.dataset.t === t; b.className = `${on ? 'on ' : ''}${b.dataset.t === 'PENDAPATAN' ? 'in' : 'out'}`; });
        const list = typeof window.lkbuExpenseOptions === 'function' ? window.lkbuExpenseOptions(t) : [];
        $('exfCat').innerHTML = list.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
        hint();
    }
    function hint() {
        const cat = $('exfCat'), h = $('exfHint'); if (!cat || !h) return;
        const src = srcLabel($('exfSource').value);
        h.innerHTML = `Masuk ke <b>LKBU B0003 kode ${esc(String(cat.value).slice(0, 2))}</b> dan ${formType === 'PENDAPATAN' ? 'menambah' : 'mengurangi'} <b>${esc(src)}</b>. Laba/rugi periode ikut berubah di Neraca.`;
    }

    function saveForm() {
        const err = (m) => { $('exfErr').textContent = m; };
        const amount = digits($('exfAmt').value);
        const desc = $('exfDesc').value.trim();
        const source = $('exfSource').value;
        const category = $('exfCat').value;
        const date = $('exfDate').value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Tanggal wajib diisi.');
        if (!desc) return err('Keterangan wajib diisi.');
        if (!amount || amount <= 0) return err('Nominal harus lebih dari 0.');
        if (!category) return err('Pilih kategori akun.');

        let cash = getCash(), bca = getBankBCA(), man = getBankMandiri();
        const sign = formType === 'PENDAPATAN' ? 1 : -1;
        if (sign < 0) {
            if (source === 'CASH' && cash < amount) return err('Kas Tunai tidak mencukupi.');
            if (source === 'BCA' && bca < amount) return err('Saldo Bank BCA tidak mencukupi.');
            if (source === 'MANDIRI' && man < amount) return err('Saldo Bank Mandiri tidak mencukupi.');
        }
        if (source === 'CASH') cash += sign * amount; else if (source === 'BCA') bca += sign * amount; else if (source === 'MANDIRI') man += sign * amount;

        const now = new Date().toISOString();
        const stamp = `${date}T${now.substring(11)}`;
        const user = (typeof getCurrentUser === 'function' && getCurrentUser()) || null;
        const list = all();
        list.push({
            id_pengeluaran: (formType === 'PENDAPATAN' ? 'INC-' : 'EXP-') + Date.now().toString().slice(-6),
            timestamp: stamp, tipe: formType, kategori: category, deskripsi: desc, sumber: source, nominal: amount,
            inputBy: user ? user.fullName : 'Admin Kasir', editBy: ''
        });
        saveExpenses(list);
        if (source === 'CASH') saveCash(cash); else if (source === 'BCA') saveBankBCA(bca); else saveBankMandiri(man);
        closeForm();
        render();
        pushToServer([], true).then((ok) => { if (ok) toast('success', 'Jurnal tersimpan dan masuk ke LKBU B0003'); });
        refreshDashboard();
    }

    async function remove(id) {
        const list = all();
        const idx = list.findIndex((x) => String(x.id_pengeluaran) === String(id));
        if (idx < 0) return;
        const e = list[idx];
        const ok = await confirmBox({ icon: 'warning', title: 'Hapus jurnal ini?', text: `${e.id_pengeluaran} - ${e.deskripsi}. Saldo kas/bank dikembalikan otomatis dan LKBU dihitung ulang.`, confirmText: 'Hapus' });
        if (!ok) return;
        const src = e.sumber === 'BANK' ? 'BCA' : e.sumber;
        const back = (e.tipe === 'PENDAPATAN' ? -1 : 1) * Number(e.nominal || 0);
        if (src === 'CASH') saveCash(getCash() + back); else if (src === 'BCA') saveBankBCA(getBankBCA() + back); else if (src === 'MANDIRI') saveBankMandiri(getBankMandiri() + back);
        list.splice(idx, 1);
        saveExpenses(list);
        render();
        pushToServer([id], true);
        refreshDashboard();
    }
    function refreshDashboard() {
        try { const d = $('dashboard-view'); if (d && d.classList.contains('active') && typeof loadDashboard === 'function') loadDashboard(); } catch (e) { /* abaikan */ }
    }

    // ---------- event ----------
    function bindOnce() {
        if (window.__exBound) return;
        window.__exBound = true;
        document.addEventListener('click', (ev) => {
            const t = ev.target.closest ? ev.target.closest('[data-ex], #exfType button') : null;
            if (!t) return;
            if (t.closest('#exfType')) { setType(t.dataset.t); return; }
            const a = t.dataset.ex;
            if (!t.closest('#expenseRoot') && !t.closest('#exOverlay')) return;
            if (a === 'add') openForm();
            else if (a === 'close') closeForm();
            else if (a === 'save') saveForm();
            else if (a === 'del') remove(t.dataset.id);
            else if (a === 'print') window.print();
            else if (a === 'excel') { if (typeof window.exportTableToExcel === 'function') window.exportTableToExcel('expenseTable', 'Jurnal_Keuangan'); }
            else if (a === 'resync') pushToServer([], true);
            else if (a === 'code') { S.code = S.code === t.dataset.code ? '' : t.dataset.code; const el = $('exCode'); if (el) el.value = S.code; render(); }
        });
        document.addEventListener('input', (ev) => {
            const id = ev.target && ev.target.id;
            if (id === 'exQ') { S.q = ev.target.value; render(); }
            else if (id === 'exfAmt') { const n = digits(ev.target.value); ev.target.value = n ? nf.format(n) : ''; }
        });
        document.addEventListener('change', (ev) => {
            const id = ev.target && ev.target.id;
            if (id === 'exMonth') { S.month = ev.target.value; render(); }
            else if (id === 'exType') { S.type = ev.target.value; render(); }
            else if (id === 'exCode') { S.code = ev.target.value; render(); }
            else if (id === 'exfCat' || id === 'exfSource') hint();
        });
        document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeForm(); });
    }

    // ---------- API publik (nama lama tetap ada) ----------
    window.loadExpensesTable = function () {
        injectStyle(); bindOnce(); shell(); render();
        if (S.sync.state === 'idle') pushToServer([], false); // impor jurnal lama ke MySQL bila belum ada
        mergeFromServer();
    };
    window.openExpenseModal = function () { injectStyle(); bindOnce(); openForm(); };
    window.closeExpenseModal = closeForm;
    window.saveExpense = saveForm;
    window.deleteExpense = remove;
})();
