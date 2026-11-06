// Data Nasabah: Upload Foto ID Massal @2026-Alifiandra
// Pilih banyak foto sekaligus (atau satu folder). Setiap foto dicocokkan otomatis ke nasabah lewat
// NAMA FILE: nama lengkap nasabah, ID Nasabah, atau No KTP/identitas. Hasil cocok ditampilkan dulu;
// foto yang namanya ganda / tidak ditemukan bisa dipilihkan manual. Setiap foto disimpan ke database
// (server) satu per satu; foto dikecilkan dulu agar ringan.
(function () {
    'use strict';

    const S = { items: [], busy: false, overwrite: false, filter: 'all' };
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fold = (v) => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const digits = (v) => String(v == null ? '' : v).replace(/\D+/g, '');
    const NOISE = new Set(['ktp', 'foto', 'photo', 'id', 'paspor', 'passport', 'sim', 'kitas', 'kitap', 'identitas', 'scan', 'img', 'image', 'copy', 'salinan']);

    /** Nama untuk dicocokkan: huruf kecil, tanpa aksen/tanda baca, tanpa kata seperti "KTP"/"foto" dan nomor urut. */
    function normName(v) {
        let words = fold(v).replace(/\.[a-z0-9]{2,5}$/, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        while (words.length > 1 && (NOISE.has(words[words.length - 1]) || /^\d{1,3}$/.test(words[words.length - 1]))) words.pop();
        while (words.length > 1 && NOISE.has(words[0])) words.shift();
        return words.join(' ');
    }

    function customers() {
        try { return (typeof window.getCustomers === 'function' ? window.getCustomers() : JSON.parse(localStorage.getItem('mc_customers') || '[]')) || []; }
        catch (e) { return []; }
    }

    function buildIndex(list) {
        const byName = new Map(), byId = new Map(), byIdNo = new Map();
        list.forEach((c) => {
            const id = String(c.id_nasabah || '').trim();
            if (id) byId.set(id.toLowerCase(), c);
            const n = normName(c.nama);
            if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(c); }
            [c.no_ktp, c.selain_ktp, c.no_cif].forEach((x) => { const d = digits(x); if (d.length >= 6) byIdNo.set(d, c); });
        });
        return { byName, byId, byIdNo };
    }

    function matchFile(file, idx) {
        const base = String(file.name).replace(/\.[^.]+$/, '').trim();
        const byId = idx.byId.get(base.toLowerCase());
        if (byId) return { status: 'ok', how: 'ID Nasabah', cust: byId };
        const d = digits(base);
        if (d.length >= 8 && d.length >= base.replace(/\s+/g, '').length - 4) {
            const c = idx.byIdNo.get(d);
            if (c) return { status: 'ok', how: 'No identitas', cust: c };
        }
        const list = idx.byName.get(normName(base)) || [];
        if (list.length === 1) return { status: 'ok', how: 'Nama', cust: list[0] };
        if (list.length > 1) return { status: 'dup', how: 'Nama ganda', options: list };
        return { status: 'none', how: 'Tidak ditemukan' };
    }

    function custLabel(c) {
        const idno = digits(c.no_ktp) || digits(c.selain_ktp);
        return `${c.nama || '-'} — ${c.id_nasabah}` + (idno ? ` · ID …${idno.slice(-4)}` : '') + (c.tanggal_lahir && c.tanggal_lahir !== '-' ? ` · lahir ${c.tanggal_lahir}` : '');
    }

    // ---------- tampilan ----------
    function injectStyle() {
        if ($('pb-style')) return;
        const st = document.createElement('style');
        st.id = 'pb-style';
        st.textContent = `
        #customers-view .pb-panel{padding:18px 20px}
        #customers-view .pb-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}
        #customers-view .pb-title{font-weight:800;font-size:1rem;display:flex;gap:9px;align-items:center}
        #customers-view .pb-sub{font-size:.8rem;opacity:.75;margin-top:4px;max-width:720px;line-height:1.5}
        #customers-view .pb-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
        #customers-view .pb-sum{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
        #customers-view .pb-sum span{border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:5px 12px;font-size:.8rem;font-weight:700;cursor:pointer}
        #customers-view .pb-sum span.on{background:#3b82f6;border-color:#3b82f6;color:#fff}
        #customers-view .pb-list{max-height:460px;overflow:auto;border:1px solid rgba(148,163,184,.3);border-radius:12px}
        #customers-view .pb-row{display:grid;grid-template-columns:56px minmax(140px,1fr) 120px minmax(220px,1.4fr) 110px;gap:10px;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(148,163,184,.18);font-size:.84rem}
        #customers-view .pb-row img{width:56px;height:40px;object-fit:cover;border-radius:6px;background:rgba(148,163,184,.15)}
        #customers-view .pb-fn{word-break:break-all;font-weight:600}
        #customers-view .pb-tag{display:inline-block;padding:3px 9px;border-radius:999px;font-size:.72rem;font-weight:800}
        #customers-view .pb-tag.ok{background:rgba(16,185,129,.15);color:#059669}
        #customers-view .pb-tag.dup{background:rgba(245,158,11,.18);color:#b45309}
        #customers-view .pb-tag.none{background:rgba(239,68,68,.15);color:#dc2626}
        #customers-view .pb-tag.has{background:rgba(100,116,139,.18);color:#475569}
        #customers-view .pb-row select,#customers-view .pb-row input{width:100%;padding:6px 8px;border-radius:8px;border:1px solid rgba(148,163,184,.4);background:transparent;color:inherit;font-size:.8rem}
        #customers-view .pb-res{font-size:.75rem;font-weight:700}
        #customers-view .pb-res.ok{color:#059669} #customers-view .pb-res.err{color:#dc2626} #customers-view .pb-res.skip{color:#64748b}
        @media (max-width:760px){#customers-view .pb-row{grid-template-columns:56px 1fr;}}
        `;
        document.head.appendChild(st);
    }

    function mount() {
        const anchor = document.querySelector('#customers-view .cx-import');
        if (!anchor || $('pbPanel')) return;
        injectStyle();
        const panel = document.createElement('div');
        panel.className = 'panel mt-3 pb-panel';
        panel.id = 'pbPanel';
        panel.innerHTML = `
            <div class="pb-head">
                <div>
                    <div class="pb-title"><i class="fa-regular fa-id-card"></i> Upload Foto ID Massal</div>
                    <div class="pb-sub">Pilih banyak foto sekaligus atau satu folder. Foto dikenali dari <b>nama file</b>:
                        <b>nama lengkap nasabah</b> (mis. <i>Nama Lengkap.jpg</i>), <b>ID Nasabah</b>, atau <b>No KTP/identitas</b>.
                        Kata seperti "KTP", "foto", atau nomor urut di belakang nama diabaikan. Impor Excel nasabah dulu, baru foto.</div>
                </div>
            </div>
            <div class="pb-tools">
                <input type="file" id="pbFiles" accept="image/jpeg,image/png,image/webp" multiple style="display:none">
                <input type="file" id="pbFolder" accept="image/*" webkitdirectory directory multiple style="display:none">
                <button type="button" class="cx-btn ghost" data-pb="pick"><i class="fa-regular fa-images"></i> Pilih Foto</button>
                <button type="button" class="cx-btn ghost" data-pb="folder"><i class="fa-regular fa-folder-open"></i> Pilih Folder</button>
                <label style="display:inline-flex;gap:6px;align-items:center;font-size:.82rem"><input type="checkbox" id="pbOverwrite"> Ganti foto yang sudah ada</label>
                <button type="button" class="cx-btn primary" data-pb="go" id="pbGo" disabled><i class="fa-solid fa-cloud-arrow-up"></i> Simpan Foto ke Database</button>
                <button type="button" class="cx-btn ghost" data-pb="clear" id="pbClear" style="display:none"><i class="fa-solid fa-xmark"></i> Kosongkan</button>
            </div>
            <div id="pbBody"></div>
            <datalist id="pbCustList"></datalist>`;
        anchor.insertAdjacentElement('afterend', panel);

        panel.addEventListener('click', (e) => {
            const t = e.target.closest('[data-pb],[data-pb-filter]');
            if (!t || S.busy) return;
            if (t.dataset.pbFilter) { S.filter = t.dataset.pbFilter; render(); return; }
            const a = t.dataset.pb;
            if (a === 'pick') $('pbFiles').click();
            else if (a === 'folder') $('pbFolder').click();
            else if (a === 'go') run();
            else if (a === 'clear') { S.items.forEach((it) => it.thumb && URL.revokeObjectURL(it.thumb)); S.items = []; render(); }
        });
        ['pbFiles', 'pbFolder'].forEach((id) => $(id).addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; }));
        $('pbOverwrite').addEventListener('change', (e) => { S.overwrite = e.target.checked; S.items.forEach((it) => { if (it.result && it.result.skip) it.result = null; }); render(); });
        panel.addEventListener('change', (e) => {
            const row = e.target.closest('[data-pb-row]'); if (!row) return;
            const it = S.items[+row.dataset.pbRow]; if (!it) return;
            if (e.target.matches('select')) it.chosen = e.target.value || '';
            if (e.target.matches('input[list]')) {
                const m = String(e.target.value).match(/—\s*(\S+)/);
                it.chosen = m ? m[1] : '';
                if (it.chosen && !custMap(true).has(it.chosen)) it.chosen = '';
            }
            render();
        });
        // Tarik & lepas foto ke panel
        panel.addEventListener('dragover', (e) => { e.preventDefault(); });
        panel.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
        render();
    }

    function addFiles(fileList) {
        const idx = buildIndex(customers());
        const have = new Set(S.items.map((it) => it.file.name + '|' + it.file.size));
        Array.from(fileList || []).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)).forEach((f) => {
            if (have.has(f.name + '|' + f.size)) return;
            const m = matchFile(f, idx);
            S.items.push({ file: f, thumb: URL.createObjectURL(f), match: m, chosen: m.status === 'ok' ? String(m.cust.id_nasabah) : '', result: null });
        });
        render();
    }

    let MAP = null;
    function custMap(refresh) {
        if (!MAP || refresh) { MAP = new Map(); customers().forEach((c) => MAP.set(String(c.id_nasabah), c)); }
        return MAP;
    }
    function targetOf(it) {
        if (!it.chosen) return null;
        return custMap().get(it.chosen) || null;
    }

    function render() {
        const body = $('pbBody'); if (!body) return;
        custMap(true);
        const n = S.items.length;
        $('pbClear').style.display = n ? '' : 'none';
        const ready = S.items.filter((it) => targetOf(it) && !(it.result && (it.result.ok || it.result.skip)));
        $('pbGo').disabled = S.busy || !ready.length;
        $('pbGo').innerHTML = S.busy ? '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...' : `<i class="fa-solid fa-cloud-arrow-up"></i> Simpan ${ready.length || ''} Foto ke Database`;
        if (!n) { body.innerHTML = ''; return; }

        const dl = $('pbCustList');
        if (dl && !dl.dataset.filled) { dl.innerHTML = customers().map((c) => `<option value="${esc(custLabel(c))}">`).join(''); dl.dataset.filled = '1'; }

        const cnt = { all: n, ok: 0, dup: 0, none: 0 };
        S.items.forEach((it) => { cnt[it.match.status]++; });
        const show = S.items.map((it, i) => [it, i]).filter(([it]) => S.filter === 'all' || it.match.status === S.filter);
        body.innerHTML = `
            <div class="pb-sum">
                <span data-pb-filter="all" class="${S.filter === 'all' ? 'on' : ''}">Semua ${n}</span>
                <span data-pb-filter="ok" class="${S.filter === 'ok' ? 'on' : ''}">✓ Cocok ${cnt.ok}</span>
                <span data-pb-filter="dup" class="${S.filter === 'dup' ? 'on' : ''}">⚠ Nama ganda ${cnt.dup}</span>
                <span data-pb-filter="none" class="${S.filter === 'none' ? 'on' : ''}">✕ Tidak ditemukan ${cnt.none}</span>
            </div>
            <div class="pb-list">${show.map(([it, i]) => {
                const cust = targetOf(it);
                const hasPhoto = cust && cust.foto_id && !S.overwrite;
                let pick = '';
                if (it.match.status === 'dup') {
                    pick = `<select><option value="">Pilih nasabah yang benar...</option>${it.match.options.map((c) => `<option value="${esc(c.id_nasabah)}" ${it.chosen === String(c.id_nasabah) ? 'selected' : ''}>${esc(custLabel(c))}</option>`).join('')}</select>`;
                } else if (it.match.status === 'none') {
                    pick = `<input list="pbCustList" placeholder="Ketik nama / ID nasabah lalu pilih" value="${cust ? esc(custLabel(cust)) : ''}">`;
                } else {
                    pick = `<div>${esc(custLabel(cust || it.match.cust))}</div>`;
                }
                const tag = hasPhoto ? '<span class="pb-tag has">Sudah ada foto</span>' : `<span class="pb-tag ${it.match.status}">${esc(it.match.how)}</span>`;
                const res = it.result ? `<span class="pb-res ${it.result.ok ? 'ok' : it.result.skip ? 'skip' : 'err'}">${esc(it.result.msg)}</span>` : '';
                return `<div class="pb-row" data-pb-row="${i}"><img src="${esc(it.thumb)}" alt=""><div class="pb-fn">${esc(it.file.name)}</div><div>${tag}</div><div>${pick}</div><div>${res}</div></div>`;
            }).join('') || '<div style="padding:14px;opacity:.65">Tidak ada foto di filter ini.</div>'}</div>`;
    }

    let rt = null;
    function renderSoon() { clearTimeout(rt); rt = setTimeout(render, 150); }

    // ---------- simpan ----------
    function compress(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const max = 1600, scale = Math.min(1, max / Math.max(img.width, img.height));
                const cv = document.createElement('canvas');
                cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
                const ctx = cv.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
                ctx.drawImage(img, 0, 0, cv.width, cv.height);
                URL.revokeObjectURL(url);
                resolve(cv.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca')); };
            img.src = url;
        });
    }

    async function uploadOne(it, cust) {
        const dataUrl = await compress(it.file);
        const doFetch = window.authFetch || window.fetch;
        const csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
        const res = await doFetch('/api/customers/photo', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf },
            body: JSON.stringify({ id_nasabah: String(cust.id_nasabah), data_url: dataUrl, overwrite: S.overwrite })
        });
        const json = await res.json().catch(() => ({}));
        if (json.status === 'skipped') return { ok: false, skip: true, msg: 'Dilewati (sudah ada foto)' };
        if (!res.ok || json.status !== 'success') throw new Error(json.message || ('HTTP ' + res.status));
        return { ok: true, msg: '✓ Tersimpan', url: json.url };
    }

    async function run() {
        const jobs = S.items.filter((it) => targetOf(it) && !(it.result && (it.result.ok || it.result.skip)));
        if (!jobs.length) return;
        // Satu nasabah satu foto: bila beberapa file menunjuk nasabah yang sama, hanya yang pertama dipakai.
        const seen = new Set();
        jobs.forEach((it) => {
            const id = it.chosen;
            if (seen.has(id)) it.result = { ok: false, skip: true, msg: 'Dilewati (nasabah sama dengan foto lain)' };
            seen.add(id);
        });
        const queue = jobs.filter((it) => !it.result || !it.result.skip);
        S.busy = true; render();
        const urls = {};
        let i = 0;
        const worker = async () => {
            while (i < queue.length) {
                const it = queue[i++];
                const cust = targetOf(it);
                try { it.result = await uploadOne(it, cust); if (it.result.ok) urls[cust.id_nasabah] = it.result.url; }
                catch (e) { it.result = { ok: false, msg: 'Gagal: ' + e.message }; }
                renderSoon();
            }
        };
        await Promise.all([worker(), worker(), worker()]);
        S.busy = false;

        // Salinan di browser diperbarui hanya untuk foto yang sudah diterima database.
        if (Object.keys(urls).length) {
            try {
                const list = customers().map((c) => (urls[c.id_nasabah] ? Object.assign({}, c, { foto_id: urls[c.id_nasabah] }) : c));
                window.__almaraApplyingRemoteSync = true;
                try { localStorage.setItem('mc_customers', JSON.stringify(list)); } finally { window.__almaraApplyingRemoteSync = false; }
                window.__mcCustomersMemory = list;
            } catch (e) { /* cache penuh: data tetap aman di database */ }
            if (typeof window.loadCustomersTable === 'function') window.loadCustomersTable();
        }
        render();
        const ok = S.items.filter((it) => it.result && it.result.ok).length;
        const fail = S.items.filter((it) => it.result && !it.result.ok && !it.result.skip).length;
        const skip = S.items.filter((it) => it.result && it.result.skip).length;
        const msg = `Tersimpan di database: ${ok}` + (skip ? `\nDilewati: ${skip}` : '') + (fail ? `\nGagal: ${fail} (lihat keterangan merah)` : '');
        if (window.Swal) window.Swal.fire({ icon: fail ? 'warning' : 'success', title: 'Upload foto selesai', text: msg });
        else alert(msg);
    }

    function init() { mount(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    // Data nasabah berubah (impor / akun lain) -> daftar pilihan nasabah disegarkan.
    document.addEventListener('almara:data-changed', () => { const dl = $('pbCustList'); if (dl) delete dl.dataset.filled; });
})();
