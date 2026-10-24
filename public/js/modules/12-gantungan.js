// Gantungan
// Catatan Rp yang sedang di luar laci saat closing. Hanya catatan: tidak mengubah saldo ledger.
// Sisa tiap nama dihitung server (nominal - cicilan) dan dibaca juga oleh Closing Harian.
// Warna memakai variabel tema (--mc-*), sehingga ikut Tema & Tampilan.
(function () {
    'use strict';

    const OUT = 'OUTSIDE_CASH';
    const OWED = 'OWED_CHANGE';
    const DELETE_ROLES = ['owner', 'superadmin', 'admin'];

    const S = {
        data: null, loading: false, error: '', loadedAt: 0, busy: false,
        q: '', sort: 'balance', chip: 'all', status: 'open', importing: false
    };

    // ---------- util ----------
    const $ = (id) => document.getElementById(id);
    const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rp = (n) => `${n < 0 ? '-' : ''}Rp ${nf.format(Math.abs(Math.round(Number(n) || 0)))}`;
    const dateShort = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
    const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
    const ageText = (d) => (d <= 0 ? 'Hari ini' : `${d} hari`);
    const digits = (v) => parseInt(String(v || '').replace(/[^\d]/g, ''), 10) || 0;

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
            icon: opts.icon || 'question', title: opts.title, text: opts.text,
            showCancelButton: true, confirmButtonText: opts.confirmText || 'Ya', cancelButtonText: 'Batal'
        })).then((r) => !!r.isConfirmed);
    }

    function role() {
        try { const u = (typeof getCurrentUser === 'function' && getCurrentUser()) || {}; return String(u.role || '').toLowerCase(); } catch (e) { return ''; }
    }
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
    async function load(force) {
        if (S.loading) return;
        if (!force && S.data && Date.now() - S.loadedAt < 4000) { renderAll(); return; }
        S.loading = true; S.error = '';
        if (!S.data) renderAll();
        try {
            const res = await api('api/gantungan');
            S.data = res.data; S.loadedAt = Date.now();
        } catch (e) {
            S.error = e.message;
        } finally {
            S.loading = false;
        }
        renderAll();
        if (S.data) importLegacyOnce();
    }

    // Catatan lama (localStorage mc_gantungans) dipindahkan ke database satu kali.
    async function importLegacyOnce() {
        if (S.importing) return;
        let items = [];
        try { items = JSON.parse(localStorage.getItem('mc_gantungans') || '[]'); } catch (e) { items = []; }
        if (!Array.isArray(items) || !items.length) return;
        S.importing = true;
        try {
            const res = await api('api/gantungan/import-legacy', { method: 'POST', body: { items } });
            localStorage.setItem('mc_gantungans', '[]');
            if (typeof pushToUniversalDatastore === 'function') { try { pushToUniversalDatastore('mc_gantungans', []); } catch (e) { /* tidak kritis */ } }
            S.data = res.data; S.loadedAt = Date.now();
            renderAll();
            if (res.imported > 0) toast('success', res.message);
        } catch (e) {
            toast('error', 'Impor catatan lama gagal: ' + e.message);
        } finally {
            S.importing = false;
        }
    }

    // ---------- turunan ----------
    function tone(p) {
        if (p.outside <= 0 && p.owed > 0) return 'info';
        if (p.oldest_days > (S.data.summary.overdue_days || 7)) return 'bad';
        if (p.oldest_days > 3) return 'warn';
        return 'ok';
    }

    function filteredPeople() {
        const q = S.q.toLowerCase().trim();
        const limit = S.data.summary.overdue_days || 7;
        const list = S.data.people.filter((p) => {
            if (S.chip === 'overdue' && !p.items.some((i) => i.type === OUT && i.age_days > limit)) return false;
            if (S.chip === 'owed' && p.owed <= 0) return false;
            if (!q) return true;
            return p.name.toLowerCase().includes(q) || p.items.some((i) =>
                String(i.description || '').toLowerCase().includes(q) || String(i.reference_no).toLowerCase().includes(q) || String(i.category || '').toLowerCase().includes(q));
        });
        const by = {
            balance: (a, b) => Math.abs(b.balance) - Math.abs(a.balance),
            oldest: (a, b) => b.oldest_days - a.oldest_days,
            name: (a, b) => a.name.localeCompare(b.name, 'id'),
            recent: (a, b) => String(b.last_activity).localeCompare(String(a.last_activity))
        };
        return list.sort(by[S.sort] || by.balance);
    }

    function filteredItems() {
        const q = S.q.toLowerCase().trim();
        return S.data.items.filter((i) => {
            if (S.status === 'open' && i.status !== 'OUTSTANDING') return false;
            if (S.status === 'settled' && i.status === 'OUTSTANDING') return false;
            if (!q) return true;
            return i.recipient.toLowerCase().includes(q) || String(i.description || '').toLowerCase().includes(q)
                || String(i.reference_no).toLowerCase().includes(q) || String(i.category || '').toLowerCase().includes(q);
        });
    }

    const findPerson = (key) => (S.data ? S.data.people.find((p) => p.key === key) : null);
    const findItem = (id) => (S.data ? S.data.items.find((i) => String(i.id) === String(id)) : null);

    // ---------- tampilan ----------
    function shellHtml() {
        return `
        <div class="gt-head">
            <div>
                <h2><i class="fa-solid fa-hand-holding-dollar"></i> Gantungan</h2>
                <p>Catatan Rp yang sedang di luar laci. Nilainya otomatis dihitung sebagai kas saat <b>Closing Harian</b>, tanpa mengubah saldo ledger.</p>
            </div>
            <div class="gt-head-actions">
                <button type="button" class="gt-btn gt-btn-ghost" data-act="refresh" title="Muat ulang"><i class="fa-solid fa-rotate"></i></button>
                <button type="button" class="gt-btn gt-btn-ghost" data-act="export"><i class="fa-solid fa-file-csv"></i> Export</button>
                <button type="button" class="gt-btn gt-btn-ghost" data-act="to-closing"><i class="fa-solid fa-lock"></i> Closing Harian</button>
                <button type="button" class="gt-btn gt-btn-primary" data-act="add"><i class="fa-solid fa-plus"></i> Tambah Gantungan</button>
            </div>
        </div>
        <div id="gtKpis" class="gt-kpis"></div>
        <div id="gtToday" class="gt-today"></div>

        <div class="gt-section-head">
            <h3><i class="fa-solid fa-address-card"></i> Kartu per Nama <span id="gtCardCount" class="gt-count"></span></h3>
            <div class="gt-tools">
                <div class="gt-search"><i class="fa-solid fa-magnifying-glass"></i><input id="gtSearch" type="search" placeholder="Cari nama, keterangan, atau nomor..." autocomplete="off"></div>
                <select id="gtSort" class="gt-select" title="Urutkan kartu">
                    <option value="balance">Sisa terbesar</option>
                    <option value="oldest">Paling lama</option>
                    <option value="recent">Aktivitas terbaru</option>
                    <option value="name">Nama A-Z</option>
                </select>
            </div>
        </div>
        <div id="gtChips" class="gt-chips"></div>
        <div id="gtCards" class="gt-cards"></div>

        <div class="gt-section-head" style="margin-top:26px">
            <h3><i class="fa-solid fa-list"></i> Semua Catatan</h3>
            <div class="gt-tools">
                <select id="gtStatus" class="gt-select">
                    <option value="open">Belum lunas</option>
                    <option value="settled">Sudah lunas</option>
                    <option value="all">Semua</option>
                </select>
            </div>
        </div>
        <div id="gtTable" class="gt-tablewrap"></div>`;
    }

    function ensureShell() {
        const root = $('gantunganRoot');
        if (!root) return null;
        if (!root.dataset.ready) {
            root.className = 'gt-root';
            root.innerHTML = shellHtml();
            root.dataset.ready = '1';
        }
        return root;
    }

    function renderAll() {
        const root = ensureShell();
        if (!root) return;
        if (!S.data) {
            $('gtKpis').innerHTML = '';
            $('gtToday').innerHTML = '';
            $('gtChips').innerHTML = '';
            $('gtTable').innerHTML = '';
            $('gtCards').innerHTML = S.error
                ? `<div class="gt-state gt-state-bad"><i class="fa-solid fa-circle-exclamation"></i> ${esc(S.error)}<br><button type="button" class="gt-btn gt-btn-ghost" data-act="refresh">Coba lagi</button></div>`
                : '<div class="gt-state"><i class="fa-solid fa-spinner fa-spin"></i> Memuat gantungan...</div>';
            return;
        }
        renderKpis();
        renderChips();
        renderCards();
        renderTable();
        const sel = $('gtSort'); if (sel && sel.value !== S.sort) sel.value = S.sort;
        const st = $('gtStatus'); if (st && st.value !== S.status) st.value = S.status;
    }

    function renderKpis() {
        const s = S.data.summary;
        $('gtKpis').innerHTML = `
            <div class="gt-kpi tone-warn"><span><i class="fa-solid fa-arrow-up-right-from-square"></i> Rp di luar laci</span><b>${rp(s.outside)}</b><small>${s.people} nama &middot; ${s.open_count} catatan</small></div>
            <div class="gt-kpi tone-info"><span><i class="fa-solid fa-arrow-rotate-left"></i> Kembalian menggantung</span><b>${rp(s.owed)}</b><small>mengurangi kas saat closing</small></div>
            <div class="gt-kpi tone-ok"><span><i class="fa-solid fa-scale-balanced"></i> Dihitung di Closing</span><b>${rp(s.net)}</b><small>fisik + gantungan = kas seharusnya</small></div>
            <div class="gt-kpi ${s.overdue_count ? 'tone-bad' : 'tone-mut'}"><span><i class="fa-solid fa-hourglass-end"></i> Lewat ${s.overdue_days} hari</span><b>${rp(s.overdue_amount)}</b><small>${s.overdue_count ? s.overdue_count + ' catatan perlu ditagih' : 'tidak ada yang tertunggak'}</small></div>`;
        $('gtToday').innerHTML = `<i class="fa-solid fa-calendar-day"></i> Hari ini: <b class="tx-warn">+${rp(s.new_today)}</b> keluar &middot; <b class="tx-ok">${rp(s.paid_today)}</b> kembali`;
    }

    function renderChips() {
        const limit = S.data.summary.overdue_days || 7;
        const all = S.data.people.length;
        const overdue = S.data.people.filter((p) => p.items.some((i) => i.type === OUT && i.age_days > limit)).length;
        const owed = S.data.people.filter((p) => p.owed > 0).length;
        const chip = (key, label, n) => `<button type="button" class="gt-chip${S.chip === key ? ' on' : ''}" data-chip="${key}">${label} <i>${n}</i></button>`;
        $('gtChips').innerHTML = chip('all', 'Semua nama', all) + chip('overdue', `Lewat ${limit} hari`, overdue) + chip('owed', 'Ada kembalian menggantung', owed);
    }

    function cardHtml(p) {
        const t = tone(p);
        const initial = (p.name.trim()[0] || '?').toUpperCase();
        const main = p.balance >= 0 ? p.balance : Math.abs(p.balance);
        const label = p.balance >= 0 ? 'Sisa gantungan' : 'Kembalian menggantung';
        const mini = p.items.slice(0, 3).map((i) => `<li class="${i.type === OWED ? 'owed' : ''}">
            <span><b>${esc(i.category || (i.type === OWED ? 'Kembalian' : 'Gantungan'))}</b><small>${esc(i.description || i.reference_no)}</small></span>
            <em>${i.type === OWED ? '-' : ''}${rp(i.remaining)}</em></li>`).join('');
        const more = p.items.length > 3 ? `<li class="more">+${p.items.length - 3} catatan lain</li>` : '';
        const both = p.outside > 0 && p.owed > 0
            ? `<div class="gt-split"><span>Keluar <b>${rp(p.outside)}</b></span><span>Kembalian <b>-${rp(p.owed)}</b></span></div>` : '';
        return `<article class="gt-card tone-${t}" data-key="${esc(p.key)}">
            <header>
                <div class="gt-avatar">${esc(initial)}</div>
                <div class="gt-who"><b>${esc(p.name)}</b><small>${p.open_count} catatan &middot; aktif ${esc(dateShort(p.last_activity))}</small></div>
                <span class="gt-age" title="Umur catatan tertua">${esc(ageText(p.oldest_days))}</span>
            </header>
            <div class="gt-sisa"><small>${label}</small><strong>${rp(main)}</strong></div>
            ${both}
            <div class="gt-bar" title="${p.progress}% sudah kembali"><i style="width:${Math.min(100, p.progress)}%"></i></div>
            <div class="gt-meta">Awal ${rp(p.original)} &middot; Kembali ${rp(p.paid)} (${nf.format(p.progress)}%)</div>
            <ul class="gt-mini">${mini}${more}</ul>
            <footer>
                <button type="button" class="gt-btn gt-btn-primary gt-sm" data-act="pay-person" data-key="${esc(p.key)}"><i class="fa-solid fa-coins"></i> ${p.outside > 0 || p.owed <= 0 ? 'Terima / Cicil' : 'Serahkan'}</button>
                <button type="button" class="gt-btn gt-btn-ghost gt-sm" data-act="add-for" data-key="${esc(p.key)}" title="Tambah catatan untuk ${esc(p.name)}"><i class="fa-solid fa-plus"></i></button>
                <button type="button" class="gt-btn gt-btn-ghost gt-sm" data-act="detail" data-key="${esc(p.key)}"><i class="fa-solid fa-clock-rotate-left"></i> Detail</button>
            </footer>
        </article>`;
    }

    function renderCards() {
        const list = filteredPeople();
        const total = S.data.people.length;
        const count = $('gtCardCount');
        if (count) count.textContent = list.length === total ? `${total} nama` : `${list.length} dari ${total} nama`;
        if (!list.length) {
            $('gtCards').innerHTML = total
                ? '<div class="gt-state"><i class="fa-solid fa-filter-circle-xmark"></i> Tidak ada nama yang cocok dengan pencarian atau filter.</div>'
                : '<div class="gt-state gt-state-ok"><i class="fa-solid fa-circle-check"></i> Tidak ada gantungan tersisa. Semua nama sudah lunas.</div>';
            return;
        }
        $('gtCards').innerHTML = list.map(cardHtml).join('');
    }

    function renderTable() {
        const rows = filteredItems();
        if (!rows.length) {
            $('gtTable').innerHTML = '<div class="gt-state"><i class="fa-solid fa-inbox"></i> Tidak ada catatan.</div>';
            return;
        }
        const limit = S.data.summary.overdue_days || 7;
        const body = rows.map((i) => {
            const open = i.status === 'OUTSTANDING';
            const typeChip = i.type === OWED ? '<span class="gt-pill tone-info">Kembalian</span>' : '<span class="gt-pill tone-warn">Rp keluar</span>';
            const age = open ? `<span class="${i.age_days > limit && i.type === OUT ? 'tx-bad' : ''}">${esc(ageText(i.age_days))}</span>` : '<span class="gt-mut">-</span>';
            const status = open
                ? `<span class="gt-pill ${i.paid > 0 ? 'tone-warn' : 'tone-bad'}">${i.paid > 0 ? 'Dicicil' : 'Belum lunas'}</span>`
                : `<span class="gt-pill tone-ok">Lunas ${esc(dateShort(i.returned_at))}</span>`;
            const actions = (open ? `<button type="button" class="gt-btn gt-btn-ghost gt-xs" data-act="pay-item" data-id="${i.id}" title="Cicil"><i class="fa-solid fa-coins"></i></button>
                <button type="button" class="gt-btn gt-btn-ghost gt-xs" data-act="settle-item" data-id="${i.id}" title="Lunasi"><i class="fa-solid fa-check-double"></i></button>` : '')
                + `<button type="button" class="gt-btn gt-btn-ghost gt-xs" data-act="detail" data-key="${esc(i.person_key)}" title="Detail"><i class="fa-solid fa-clock-rotate-left"></i></button>`
                + (canDelete() ? `<button type="button" class="gt-btn gt-btn-danger gt-xs" data-act="delete-item" data-id="${i.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>` : '');
            return `<tr>
                <td>${esc(dateShort(i.occurred_at))}</td>
                <td>${age}</td>
                <td><b>${esc(i.reference_no)}</b></td>
                <td>${esc(i.recipient)}</td>
                <td>${typeChip}${i.category ? `<small class="gt-cat">${esc(i.category)}</small>` : ''}</td>
                <td class="r">${rp(i.amount)}</td>
                <td class="r"><b>${rp(i.remaining)}</b></td>
                <td class="gt-desc">${esc(i.description || '-')}</td>
                <td>${status}</td>
                <td class="gt-actions">${actions}</td>
            </tr>`;
        }).join('');
        $('gtTable').innerHTML = `<table class="gt-table">
            <thead><tr><th>Tanggal</th><th>Umur</th><th>No</th><th>Nama</th><th>Jenis</th><th class="r">Nominal</th><th class="r">Sisa</th><th>Keterangan</th><th>Status</th><th></th></tr></thead>
            <tbody>${body}</tbody></table>`;
    }

    // ---------- modal ----------
    let escHandler = null;
    function closeModal() {
        const el = $('gtOverlay');
        if (el) el.remove();
        if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
    }

    function openModal(html) {
        closeModal();
        const el = document.createElement('div');
        el.id = 'gtOverlay';
        el.className = 'gt-overlay';
        el.innerHTML = `<div class="gt-dialog" role="dialog" aria-modal="true">${html}</div>`;
        document.body.appendChild(el);
        el.addEventListener('mousedown', (e) => { if (e.target === el) closeModal(); });
        escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', escHandler);
        return el;
    }

    function bindMoney(input) {
        if (!input) return;
        input.addEventListener('input', () => {
            const v = digits(input.value);
            input.value = v > 0 ? nf.format(v) : '';
        });
    }

    function setBusy(btn, busy, label) {
        if (!btn) return;
        btn.disabled = busy;
        if (busy) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...'; }
        else if (btn.dataset.label) btn.innerHTML = label || btn.dataset.label;
    }

    // --- tambah ---
    function openAdd(prefillName) {
        const cats = (S.data && S.data.categories) || ['Operasional', 'Pinjaman staf', 'Belanja / kurir', 'Pickup valas', 'Lainnya'];
        const names = (S.data && S.data.names) || [];
        const el = openModal(`
            <div class="gt-dlg-head"><h3><i class="fa-solid fa-plus"></i> Tambah Gantungan</h3><button type="button" class="gt-x" data-close>&times;</button></div>
            <form id="gtAddForm" autocomplete="off">
                <label class="gt-field"><span>Nama</span>
                    <input id="gtfName" list="gtNames" type="text" maxlength="150" placeholder="Contoh: Rayyan" required value="${esc(prefillName || '')}">
                    <datalist id="gtNames">${names.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
                    <small id="gtfHint" class="gt-hint"></small></label>
                <div class="gt-field"><span>Jenis catatan</span>
                    <div class="gt-seg">
                        <label><input type="radio" name="gtfType" value="${OUT}" checked><b>Rp keluar / dipakai</b><small>dianggap masih ada, menambah kas saat closing</small></label>
                        <label><input type="radio" name="gtfType" value="${OWED}"><b>Kembalian menggantung</b><small>kembalian yang belum diberikan, mengurangi kas</small></label>
                    </div></div>
                <div class="gt-row">
                    <label class="gt-field"><span>Nominal (Rp)</span><input id="gtfAmount" type="text" inputmode="numeric" placeholder="0" required></label>
                    <label class="gt-field"><span>Kategori</span><select id="gtfCat"><option value="">- pilih -</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
                </div>
                <label class="gt-field"><span>Keterangan</span><textarea id="gtfDesc" rows="2" maxlength="500" placeholder="Contoh: dipakai beli galon dan ATK" required></textarea></label>
                <p class="gt-note"><i class="fa-solid fa-circle-info"></i> Hanya catatan. Saldo kas di ledger tidak berubah; nilainya ikut dihitung saat Closing Harian.</p>
                <div class="gt-dlg-foot"><button type="button" class="gt-btn gt-btn-ghost" data-close>Batal</button><button type="submit" class="gt-btn gt-btn-primary" id="gtfSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div>
            </form>`);
        bindMoney($('gtfAmount'));
        const nameInput = $('gtfName');
        const hint = () => {
            const p = S.data ? findPerson(String(nameInput.value).trim().replace(/\s+/g, ' ').toLowerCase()) : null;
            $('gtfHint').textContent = p ? `${p.name} sudah punya sisa ${rp(Math.abs(p.balance))}. Catatan ini akan menambah kartunya.` : '';
        };
        nameInput.addEventListener('input', hint); hint();
        el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
        $('gtAddForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = digits($('gtfAmount').value);
            if (amount <= 0) { toast('warning', 'Nominal harus lebih besar dari Rp 0.'); return; }
            const btn = $('gtfSave'); setBusy(btn, true);
            try {
                const res = await api('api/gantungan', { method: 'POST', body: {
                    recipient: nameInput.value, type: el.querySelector('input[name="gtfType"]:checked').value,
                    amount, category: $('gtfCat').value || null, description: $('gtfDesc').value
                } });
                S.data = res.data; S.loadedAt = Date.now();
                closeModal(); renderAll(); toast('success', res.message);
            } catch (err) {
                setBusy(btn, false); toast('error', err.message);
            }
        });
        setTimeout(() => (prefillName ? $('gtfAmount') : nameInput).focus(), 30);
    }

    // --- bayar / cicil ---
    function openPay(ctx) {
        // ctx: { mode:'person', key, type } atau { mode:'item', id }
        let title, name, remaining, type, note = '';
        if (ctx.mode === 'person') {
            const p = findPerson(ctx.key); if (!p) return;
            type = ctx.type || (p.outside > 0 ? OUT : OWED);
            name = p.name;
            remaining = type === OUT ? p.outside : p.owed;
            title = type === OUT ? 'Terima pengembalian / cicilan' : 'Serahkan kembalian';
            note = `Dialokasikan ke catatan tertua lebih dulu (${p.items.filter((i) => i.type === type).length} catatan).`;
        } else {
            const i = findItem(ctx.id); if (!i) return;
            type = i.type; name = i.recipient; remaining = i.remaining;
            title = i.type === OUT ? 'Terima pengembalian / cicilan' : 'Serahkan kembalian';
            note = `${i.reference_no}${i.description ? ' &middot; ' + esc(i.description) : ''}`;
        }
        const el = openModal(`
            <div class="gt-dlg-head"><h3><i class="fa-solid fa-coins"></i> ${esc(title)}</h3><button type="button" class="gt-x" data-close>&times;</button></div>
            <form id="gtPayForm" autocomplete="off">
                <div class="gt-payinfo"><div><small>Nama</small><b>${esc(name)}</b></div><div><small>Sisa saat ini</small><b>${rp(remaining)}</b></div></div>
                <p class="gt-note">${note}</p>
                <label class="gt-field"><span>Jumlah (Rp)</span><input id="gtpAmount" type="text" inputmode="numeric" placeholder="0" required></label>
                <div class="gt-quick">
                    <button type="button" data-frac="0.25">25%</button><button type="button" data-frac="0.5">50%</button><button type="button" data-frac="1">Lunas semua</button>
                </div>
                <label class="gt-field"><span>Catatan (opsional)</span><input id="gtpNote" type="text" maxlength="255" placeholder="Contoh: dibayar tunai"></label>
                <div class="gt-after" id="gtpAfter"></div>
                <div class="gt-dlg-foot"><button type="button" class="gt-btn gt-btn-ghost" data-close>Batal</button><button type="submit" class="gt-btn gt-btn-primary" id="gtpSave"><i class="fa-solid fa-check"></i> Simpan</button></div>
            </form>`);
        const input = $('gtpAmount'); bindMoney(input);
        const after = () => {
            const v = digits(input.value);
            $('gtpAfter').innerHTML = v > remaining
                ? `<span class="tx-bad"><i class="fa-solid fa-triangle-exclamation"></i> Melebihi sisa (${rp(remaining)}).</span>`
                : `Sisa setelah ini: <b>${rp(Math.max(0, remaining - v))}</b>${v >= remaining && v > 0 ? ' &middot; <span class="tx-ok">akan lunas</span>' : ''}`;
        };
        input.addEventListener('input', after); after();
        el.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) { closeModal(); return; }
            const q = e.target.closest('[data-frac]');
            if (q) { input.value = nf.format(Math.round(remaining * parseFloat(q.dataset.frac))); after(); input.focus(); }
        });
        $('gtPayForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = digits(input.value);
            if (amount <= 0) { toast('warning', 'Nominal harus lebih besar dari Rp 0.'); return; }
            if (amount > remaining) { toast('warning', 'Nominal melebihi sisa gantungan.'); return; }
            const btn = $('gtpSave'); setBusy(btn, true);
            const note = $('gtpNote').value;
            try {
                let res;
                if (ctx.mode === 'person') {
                    res = await api('api/gantungan/pay-person', { method: 'POST', body: { name, type, amount, all: amount >= remaining, note } });
                } else {
                    res = await api(`api/gantungan/${ctx.id}/pay`, { method: 'POST', body: { amount, note } });
                }
                S.data = res.data; S.loadedAt = Date.now();
                closeModal(); renderAll(); toast('success', res.message);
            } catch (err) {
                setBusy(btn, false); toast('error', err.message);
            }
        });
        setTimeout(() => input.focus(), 30);
    }

    // --- detail ---
    function openDetail(key) {
        const p = findPerson(key);
        const settled = S.data.items.filter((i) => i.person_key === key && i.status !== 'OUTSTANDING');
        const open = p ? p.items : [];
        const name = p ? p.name : (settled[0] ? settled[0].recipient : '');
        if (!open.length && !settled.length) return;

        const itemBlock = (i) => {
            const isOpen = i.status === 'OUTSTANDING';
            const pct = i.amount > 0 ? Math.round(i.paid / i.amount * 100) : 0;
            const pays = i.payments.length
                ? `<ul class="gt-pays">${i.payments.map((x) => `<li><i class="fa-solid fa-circle"></i><span>${esc(dateTime(x.paid_at))}${x.by ? ' &middot; ' + esc(x.by) : ''}${x.note ? ` &middot; <em>${esc(x.note)}</em>` : ''}</span><b>${rp(x.amount)}</b></li>`).join('')}</ul>`
                : '<p class="gt-mut" style="margin:6px 0 0">Belum ada pengembalian.</p>';
            return `<div class="gt-item${isOpen ? '' : ' done'}">
                <div class="gt-item-top">
                    <div><b>${esc(i.reference_no)}</b> <span class="gt-pill ${i.type === OWED ? 'tone-info' : 'tone-warn'}">${i.type === OWED ? 'Kembalian' : 'Rp keluar'}</span>${i.category ? ` <small class="gt-cat">${esc(i.category)}</small>` : ''}
                        <small class="gt-mut" style="display:block">${esc(dateTime(i.occurred_at))}${i.created_by_name ? ' &middot; dicatat ' + esc(i.created_by_name) : ''}</small></div>
                    <div class="gt-item-amt"><small>${isOpen ? 'Sisa' : 'Lunas'}</small><b>${rp(isOpen ? i.remaining : i.amount)}</b></div>
                </div>
                ${i.description ? `<p class="gt-item-desc">${esc(i.description)}</p>` : ''}
                <div class="gt-bar"><i style="width:${Math.min(100, pct)}%"></i></div>
                <div class="gt-meta">Nominal ${rp(i.amount)} &middot; Kembali ${rp(i.paid)} (${pct}%)</div>
                ${pays}
                ${isOpen ? `<div class="gt-item-actions">
                    <button type="button" class="gt-btn gt-btn-primary gt-sm" data-act="pay-item" data-id="${i.id}"><i class="fa-solid fa-coins"></i> Cicil</button>
                    <button type="button" class="gt-btn gt-btn-ghost gt-sm" data-act="settle-item" data-id="${i.id}"><i class="fa-solid fa-check-double"></i> Lunasi</button>
                    ${canDelete() ? `<button type="button" class="gt-btn gt-btn-danger gt-sm" data-act="delete-item" data-id="${i.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>` : ''}
            </div>`;
        };

        openModal(`
            <div class="gt-dlg-head"><h3><i class="fa-solid fa-user"></i> ${esc(name)}</h3><button type="button" class="gt-x" data-close>&times;</button></div>
            ${p ? `<div class="gt-payinfo"><div><small>Sisa gantungan</small><b>${rp(Math.abs(p.balance))}</b></div><div><small>Catatan aktif</small><b>${p.open_count}</b></div><div><small>Tertua</small><b>${esc(ageText(p.oldest_days))}</b></div></div>` : ''}
            <div class="gt-detail">
                ${open.map(itemBlock).join('') || '<p class="gt-mut">Semua catatan sudah lunas.</p>'}
                ${settled.length ? `<details class="gt-done"><summary>Sudah lunas (${settled.length})</summary>${settled.map(itemBlock).join('')}</details>` : ''}
            </div>
            <div class="gt-dlg-foot">${p ? `<button type="button" class="gt-btn gt-btn-ghost" data-act="add-for" data-key="${esc(key)}"><i class="fa-solid fa-plus"></i> Tambah catatan</button>` : ''}<button type="button" class="gt-btn gt-btn-primary" data-close>Tutup</button></div>`);
    }

    // --- aksi tanpa modal ---
    async function settleItem(id) {
        const i = findItem(id); if (!i) return;
        const ok = await confirmBox({
            title: `Lunasi ${i.recipient}?`,
            text: `Sisa ${rp(i.remaining)} dicatat sudah ${i.type === OWED ? 'diserahkan' : 'kembali'}. Pastikan uangnya sudah ada di laci.`,
            confirmText: 'Ya, lunasi'
        });
        if (!ok) return;
        try {
            const res = await api(`api/gantungan/${id}/settle`, { method: 'POST' });
            S.data = res.data; S.loadedAt = Date.now();
            closeModal(); renderAll(); toast('success', res.message);
        } catch (err) { toast('error', err.message); }
    }

    async function deleteItem(id) {
        const i = findItem(id); if (!i) return;
        const ok = await confirmBox({
            icon: 'warning', title: `Hapus ${i.reference_no}?`,
            text: 'Catatan beserta riwayat cicilannya dihapus permanen. Sisa gantungan nama ini ikut berubah.', confirmText: 'Ya, hapus'
        });
        if (!ok) return;
        try {
            const res = await api(`api/gantungan/${id}`, { method: 'DELETE' });
            S.data = res.data; S.loadedAt = Date.now();
            closeModal(); renderAll(); toast('success', res.message);
        } catch (err) { toast('error', err.message); }
    }

    function exportCsv() {
        if (!S.data) return;
        const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
        const lines = [['Nama', 'No', 'Tanggal', 'Umur (hari)', 'Jenis', 'Kategori', 'Nominal', 'Kembali', 'Sisa', 'Keterangan'].map(q).join(',')];
        S.data.people.forEach((p) => p.items.forEach((i) => lines.push([
            p.name, i.reference_no, (i.occurred_at || '').slice(0, 10), i.age_days, i.type === OWED ? 'Kembalian menggantung' : 'Rp keluar',
            i.category || '', Math.round(i.amount), Math.round(i.paid), Math.round(i.remaining), i.description || ''
        ].map(q).join(','))));
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `gantungan-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    // ---------- event ----------
    function onClick(e) {
        if (e.target.closest('[data-close]')) { closeModal(); return; }
        const chip = e.target.closest('[data-chip]');
        if (chip) { S.chip = chip.dataset.chip; renderChips(); renderCards(); return; }
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'refresh') load(true);
        else if (act === 'add') openAdd('');
        else if (act === 'add-for') { const p = findPerson(btn.dataset.key); openAdd(p ? p.name : ''); }
        else if (act === 'export') exportCsv();
        else if (act === 'to-closing') {
            const nav = document.querySelector('.nav-item[data-target="closing-view"]');
            if (nav) nav.click(); else toast('info', 'Buka menu Closing Harian dari sidebar.');
        }
        else if (act === 'pay-person') openPay({ mode: 'person', key: btn.dataset.key });
        else if (act === 'pay-item') openPay({ mode: 'item', id: btn.dataset.id });
        else if (act === 'settle-item') settleItem(btn.dataset.id);
        else if (act === 'delete-item') deleteItem(btn.dataset.id);
        else if (act === 'detail') openDetail(btn.dataset.key);
    }

    function bindOnce() {
        if (window.__gtBound) return;
        window.__gtBound = true;
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#gantunganRoot') && !e.target.closest('#gtOverlay')) return;
            onClick(e);
        });
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'gtSearch') { S.q = e.target.value; if (S.data) { renderCards(); renderTable(); } }
        });
        document.addEventListener('change', (e) => {
            if (!e.target) return;
            if (e.target.id === 'gtSort') { S.sort = e.target.value; if (S.data) renderCards(); }
            else if (e.target.id === 'gtStatus') { S.status = e.target.value; if (S.data) renderTable(); }
        });
    }

    // ---------- publik ----------
    window.initGantunganView = function () { bindOnce(); ensureShell(); load(false); };
    window.refreshGantungan = function () { return load(true); };
    // Kompatibel dengan pemanggil lama.
    window.openGantunganModal = function () { bindOnce(); ensureShell(); if (S.data) openAdd(''); else load(true).then(() => openAdd('')); };
    window.loadGantungansTable = function () { if (S.data) { renderCards(); renderTable(); } };
})();
