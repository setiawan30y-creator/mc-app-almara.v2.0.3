// @2026-Alifiandra
/* =====================================================================
 * MODULE 68: PERWAKILAN PT (data internal PKS)
 *
 * Mencatat orang-orang yang berhubungan dengan sebuah PT (nasabah corporate):
 * penanda tangan, pelaksana transaksi, kurir pengambil, dan kontak lain,
 * lengkap dengan dasar kewenangan (PKS / surat kuasa) dan masa berlakunya.
 * DATA INTERNAL: tidak ikut dilaporkan ke SIPESAT (SIPESAT hanya melaporkan PT).
 * Penyimpanan: tabel mc_pt_representatives (No. identitas & telepon terenkripsi).
 * Tampilan: css/pt-reps.css
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcPtReps) return;
    window.__mcPtReps = true;

    var ROLES = {
        signatory: { label: 'Penanda tangan', icon: 'fa-signature', hint: 'Berwenang menandatangani / mewakili PT' },
        executor: { label: 'Pelaksana transaksi', icon: 'fa-money-bill-transfer', hint: 'Boleh bertransaksi atas nama PT' },
        courier: { label: 'Kurir pengambil', icon: 'fa-motorcycle', hint: 'Hanya mengambil / mengantar uang atau valas' },
        other: { label: 'Kontak lain', icon: 'fa-address-card', hint: 'Hanya sebagai catatan' }
    };
    var ID_TYPES = ['KTP', 'SIM', 'PASSPORT', 'LAINNYA'];
    var S = { built: false, rows: [], pt: '', q: '', role: 'all', reveal: {}, editing: null, loading: false, files: {} };

    function $(id) { return document.getElementById(id); }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function p2(n) { return String(n).padStart(2, '0'); }
    function todayStr() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
    function fmtDay(s) { if (!s) return '-'; var a = String(s).slice(0, 10).split('-'), M = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']; return a.length === 3 ? a[2] + ' ' + M[+a[1] - 1] + ' ' + a[0] : s; }
    function toast(msg, bad) {
        if (window.Swal && typeof Swal.fire === 'function') Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2400, icon: bad ? 'error' : 'success', title: msg });
        else if (bad) alert(msg);
    }
    async function api(path, method, body) {
        var request = window.authFetch || fetch;
        var res = await request('api/' + path, { method: method || 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var first = out.errors ? (Object.values(out.errors)[0] || [])[0] : '';
            throw new Error(first || out.message || 'Permintaan gagal (' + res.status + ').');
        }
        return out;
    }

    /* ---------- Data ---------- */
    function isCorporate(c) {
        var raw = String((c && (c.kn != null ? c.kn : c.customer_type)) || '').trim().toLowerCase();
        return raw === '2' || raw.indexOf('perusahaan') >= 0 || raw.indexOf('corporate') >= 0;
    }
    function ptList() {
        var map = {}, list = typeof getCustomers === 'function' ? getCustomers() : [];
        (Array.isArray(list) ? list : []).forEach(function (c) {
            if (c && isCorporate(c) && c.id_nasabah) map[c.id_nasabah] = { id: String(c.id_nasabah), name: c.nama || c.id_nasabah, npwp: c.npwp || '' };
        });
        S.rows.forEach(function (r) { if (!map[r.customer_id]) map[r.customer_id] = { id: r.customer_id, name: r.customer_id + ' (data nasabah tidak ditemukan)', npwp: '' }; });
        var q = S.q.trim().toLowerCase();
        return Object.keys(map).map(function (k) { return map[k]; })
            .filter(function (p) { return !q || (p.name + ' ' + p.id).toLowerCase().indexOf(q) >= 0; })
            .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    }
    function ptInfo(id) {
        var list = typeof getCustomers === 'function' ? getCustomers() : [];
        var c = (Array.isArray(list) ? list : []).filter(function (x) { return x.id_nasabah === id; })[0];
        return c ? { id: id, name: c.nama || id, npwp: c.npwp || '' } : { id: id, name: id, npwp: '' };
    }
    function validity(r) {
        if (r.status === 'inactive') return { k: 'off', t: 'Nonaktif' };
        var t = todayStr();
        if (r.valid_until && r.valid_until < t) return { k: 'bad', t: 'Kedaluwarsa' };
        if (r.valid_from && r.valid_from > t) return { k: 'warn', t: 'Belum berlaku' };
        if (r.valid_until) {
            var days = Math.round((new Date(r.valid_until + 'T00:00:00') - new Date(t + 'T00:00:00')) / 86400000);
            if (days <= 30) return { k: 'warn', t: 'Berakhir ' + days + ' hari lagi' };
        }
        return { k: 'ok', t: 'Aktif' };
    }
    function mask(v) { var s = String(v || ''); return s.length <= 6 ? s.replace(/./g, '•') : s.slice(0, 2) + '•'.repeat(s.length - 6) + s.slice(-4); }
    function ptRows(id) { return S.rows.filter(function (r) { return r.customer_id === id; }); }

    async function loadRows() {
        S.loading = true; paintMain();
        try { var out = await api('pt-representatives'); S.rows = Array.isArray(out.data) ? out.data : []; }
        catch (e) { S.rows = []; toast(e.message, true); }
        S.loading = false; paintAll();
    }

    /* ---------- Markup ---------- */
    function build() {
        var root = $('ptRepRoot'); if (!root || S.built) return !!root;
        S.built = true;
        root.innerHTML =
            '<div class="ptr-head"><div><h2>Perwakilan PT</h2><p>Orang yang berhubungan dengan PT: penanda tangan, pelaksana transaksi, dan kurir pengambil.</p></div>' +
            '<span class="ptr-chip"><i class="fa-solid fa-lock"></i> Data internal PKS &middot; tidak masuk SIPESAT</span></div>' +
            '<div class="ptr-grid"><aside class="ptr-card ptr-side"><input type="search" id="ptrSearch" class="ptr-input" placeholder="Cari nama / ID PT..." aria-label="Cari PT"><div id="ptrList" class="ptr-list"></div></aside>' +
            '<section class="ptr-card ptr-main" id="ptrMain"></section></div><div id="ptrModal"></div><div hidden>&#64;2026-Alifiandra</div>';
        root.addEventListener('click', onClick);
        root.addEventListener('input', function (e) { if (e.target.id === 'ptrSearch') { S.q = e.target.value; paintList(); } });
        root.addEventListener('change', onChange);
        root.addEventListener('submit', function (e) { if (e.target.id === 'ptrForm') { e.preventDefault(); save(); } });
        return true;
    }

    function paintAll() { paintList(); paintMain(); }
    function paintList() {
        var el = $('ptrList'); if (!el) return;
        var list = ptList();
        if (!list.length) { el.innerHTML = '<div class="ptr-empty">Belum ada nasabah corporate (PT). Tambahkan di menu Data Nasabah dengan tipe Corporate.</div>'; return; }
        el.innerHTML = list.map(function (p) {
            var rows = ptRows(p.id), act = rows.filter(function (r) { return validity(r).k === 'ok' || validity(r).k === 'warn'; }).length, bad = rows.filter(function (r) { return validity(r).k === 'bad'; }).length;
            return '<button type="button" class="ptr-pt' + (S.pt === p.id ? ' on' : '') + '" data-ptr="pt" data-id="' + esc(p.id) + '"><b>' + esc(p.name) + '</b><small>' + esc(p.id) + '</small>' +
                '<span class="ptr-cnt">' + act + ' aktif' + (bad ? ' &middot; <u class="bad">' + bad + ' kedaluwarsa</u>' : '') + '</span></button>';
        }).join('');
    }
    function paintMain() {
        var el = $('ptrMain'); if (!el) return;
        if (S.loading) { el.innerHTML = '<div class="ptr-empty"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>'; return; }
        if (!S.pt) { el.innerHTML = '<div class="ptr-empty big"><i class="fa-solid fa-building-user"></i><p>Pilih PT di sebelah kiri untuk melihat dan mengelola orang yang berwenang.</p></div>'; return; }
        var info = ptInfo(S.pt), rows = ptRows(S.pt);
        var chips = ['all'].concat(Object.keys(ROLES)).map(function (k) {
            var n = k === 'all' ? rows.length : rows.filter(function (r) { return r.role_type === k; }).length;
            return '<button type="button" class="ptr-tab' + (S.role === k ? ' on' : '') + '" data-ptr="role" data-role="' + k + '">' + (k === 'all' ? 'Semua' : ROLES[k].label) + ' <em>' + n + '</em></button>';
        }).join('');
        var shown = rows.filter(function (r) { return S.role === 'all' || r.role_type === S.role; });
        el.innerHTML =
            '<div class="ptr-top"><div><h3>' + esc(info.name) + '</h3><p>ID nasabah: <strong>' + esc(info.id) + '</strong>' + (info.npwp && info.npwp !== '-' ? ' &middot; NPWP: ' + esc(info.npwp) : '') + '</p></div>' +
            '<div class="ptr-actions"><button type="button" class="ptr-btn pri" data-ptr="add"><i class="fa-solid fa-user-plus"></i> Tambah orang</button>' +
            '<button type="button" class="ptr-btn" data-ptr="export"><i class="fa-solid fa-file-excel"></i> Excel</button>' +
            '<button type="button" class="ptr-btn" data-ptr="print"><i class="fa-solid fa-print"></i> Cetak</button></div></div>' +
            '<div class="ptr-tabs">' + chips + '</div>' +
            (shown.length ? '<div class="ptr-people">' + shown.map(card).join('') + '</div>'
                : '<div class="ptr-empty">' + (rows.length ? 'Tidak ada orang pada kategori ini.' : 'Belum ada orang yang didaftarkan untuk PT ini. Klik "Tambah orang".') + '</div>');
    }
    function card(r) {
        var v = validity(r), role = ROLES[r.role_type] || ROLES.other, shown = !!S.reveal[r.id];
        var docs = [];
        if (r.id_photo_url) docs.push('<a href="' + esc(r.id_photo_url) + '" target="_blank" rel="noopener"><i class="fa-regular fa-id-card"></i> Foto identitas</a>');
        if (r.authority_doc_url) docs.push('<a href="' + esc(r.authority_doc_url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-file-signature"></i> Surat kuasa / PKS</a>');
        var initials = String(r.name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
        return '<article class="ptr-person' + (v.k === 'off' || v.k === 'bad' ? ' dim' : '') + '">' +
            '<div class="ptr-ph">' + (r.photo_url ? '<img src="' + esc(r.photo_url) + '" alt="">' : esc(initials)) + '</div>' +
            '<div class="ptr-info"><div class="ptr-nm"><b>' + esc(r.name) + '</b><span class="ptr-st ' + v.k + '">' + esc(v.t) + '</span></div>' +
            '<div class="ptr-rl"><i class="fa-solid ' + role.icon + '"></i> ' + esc(role.label) + (r.position ? ' &middot; ' + esc(r.position) : '') + '</div>' +
            '<dl><dt>' + esc(r.id_type) + '</dt><dd>' + esc(shown ? r.id_number : mask(r.id_number)) + ' <button type="button" class="ptr-eye" data-ptr="reveal" data-id="' + r.id + '" title="Tampilkan / sembunyikan" aria-label="Tampilkan atau sembunyikan nomor"><i class="fa-solid ' + (shown ? 'fa-eye-slash' : 'fa-eye') + '"></i></button></dd>' +
            (r.phone ? '<dt>Telepon</dt><dd>' + esc(r.phone) + '</dd>' : '') +
            '<dt>Dasar kewenangan</dt><dd>' + esc(r.authority_ref || '-') + '</dd>' +
            '<dt>Masa berlaku</dt><dd>' + (r.valid_from && r.valid_until ? fmtDay(r.valid_from) + ' &ndash; ' + fmtDay(r.valid_until) : r.valid_from ? 'Mulai ' + fmtDay(r.valid_from) + ', tanpa batas' : r.valid_until ? 'Sampai ' + fmtDay(r.valid_until) : 'Tanpa batas') + '</dd></dl>' +
            (docs.length ? '<div class="ptr-docs">' + docs.join('') + '</div>' : '') +
            '<div class="ptr-row-act"><button type="button" data-ptr="edit" data-id="' + r.id + '"><i class="fa-solid fa-pen"></i> Ubah</button>' +
            '<button type="button" data-ptr="toggle" data-id="' + r.id + '">' + (r.status === 'inactive' ? '<i class="fa-solid fa-toggle-on"></i> Aktifkan' : '<i class="fa-solid fa-toggle-off"></i> Nonaktifkan') + '</button>' +
            '<button type="button" class="del" data-ptr="del" data-id="' + r.id + '"><i class="fa-solid fa-trash"></i> Hapus</button></div></div></article>';
    }

    /* ---------- Form ---------- */
    function openForm(r) {
        S.editing = r || null; S.files = {};
        var d = r || { role_type: 'executor', id_type: 'KTP', status: 'active' };
        var field = function (id, label, val, extra) { return '<div class="ptr-f"><label for="' + id + '">' + label + '</label><input class="ptr-input" id="' + id + '" value="' + esc(val || '') + '" ' + (extra || '') + '></div>'; };
        var fileRow = function (id, label, cur) { return '<div class="ptr-f"><label for="' + id + '">' + label + '</label><input class="ptr-input" type="file" id="' + id + '" accept="image/*,application/pdf">' + (cur ? '<small>Sudah ada berkas. <a href="' + esc(cur) + '" target="_blank" rel="noopener">Lihat</a> &middot; pilih berkas baru untuk mengganti.</small>' : '') + '</div>'; };
        $('ptrModal').innerHTML = '<div class="ptr-ov" data-ptr="close-bg"><form id="ptrForm" class="ptr-dlg" role="dialog" aria-modal="true" autocomplete="off">' +
            '<div class="ptr-dh"><h3>' + (r ? 'Ubah data orang' : 'Tambah orang') + ' &middot; ' + esc(ptInfo(S.pt).name) + '</h3><button type="button" class="ptr-x" data-ptr="close" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="ptr-db"><div id="ptrErr"></div>' +
            '<div class="ptr-fg"><div class="ptr-f"><label for="ptrRole">Peran</label><select class="ptr-input" id="ptrRole">' + Object.keys(ROLES).map(function (k) { return '<option value="' + k + '"' + (d.role_type === k ? ' selected' : '') + '>' + ROLES[k].label + '</option>'; }).join('') + '</select><small id="ptrRoleHint">' + esc((ROLES[d.role_type] || ROLES.other).hint) + '</small></div>' +
            field('ptrName', 'Nama lengkap', d.name, 'required maxlength="150" placeholder="Nama lengkap"') + field('ptrPos', 'Jabatan', d.position, 'maxlength="120" placeholder="Contoh: Direktur / Staf keuangan"') +
            '<div class="ptr-f"><label for="ptrIdType">Jenis identitas</label><select class="ptr-input" id="ptrIdType">' + ID_TYPES.map(function (k) { return '<option' + (d.id_type === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></div>' +
            field('ptrIdNo', 'Nomor identitas', d.id_number, 'required maxlength="50" inputmode="numeric" placeholder="Nomor identitas"') + field('ptrPhone', 'Telepon', d.phone, 'maxlength="30" inputmode="tel" placeholder="08xxxxxxxxxx"') +
            '<div class="ptr-f full"><label for="ptrAddr">Alamat</label><input class="ptr-input" id="ptrAddr" maxlength="500" value="' + esc(d.address || '') + '" placeholder="Alamat sesuai identitas"></div>' +
            field('ptrRef', 'Dasar kewenangan (No. PKS / surat kuasa)', d.authority_ref, 'maxlength="150" placeholder="Nomor dokumen"') +
            '<div class="ptr-f"><label for="ptrStatus">Status</label><select class="ptr-input" id="ptrStatus"><option value="active"' + (d.status === 'active' ? ' selected' : '') + '>Aktif</option><option value="inactive"' + (d.status === 'inactive' ? ' selected' : '') + '>Nonaktif</option></select></div>' +
            '<div class="ptr-f"><label for="ptrFrom">Berlaku dari</label><input class="ptr-input" type="date" id="ptrFrom" value="' + esc(d.valid_from || '') + '"></div>' +
            '<div class="ptr-f"><label for="ptrUntil">Berlaku sampai</label><input class="ptr-input" type="date" id="ptrUntil" value="' + esc(d.valid_until || '') + '"><small>Kosongkan bila tanpa batas waktu.</small></div>' +
            fileRow('ptrFilePhoto', 'Pas foto (opsional)', d.photo_url) + fileRow('ptrFileId', 'Foto identitas (KTP / SIM)', d.id_photo_url) + '<div class="ptr-f full ptr-ocrbox"><button type="button" class="ptr-btn" id="ptrOcrBtn" data-ptr="ocr"><i class="fa-solid fa-wand-magic-sparkles"></i> Isi otomatis dari foto identitas (OCR)</button><div id="ptrOcrMsg" class="ptr-ocr" role="status"></div></div>' + fileRow('ptrFileDoc', 'Surat kuasa / PKS', d.authority_doc_url) +
            '<div class="ptr-f full"><label for="ptrNotes">Catatan</label><input class="ptr-input" id="ptrNotes" maxlength="1000" value="' + esc(d.notes || '') + '" placeholder="Catatan internal"></div></div></div>' +
            '<div class="ptr-df"><button type="button" class="ptr-btn" data-ptr="close">Batal</button><button type="submit" class="ptr-btn pri" id="ptrSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div></form></div>';
        setTimeout(function () { var n = $('ptrName'); if (n) n.focus(); }, 30);
    }
    function closeForm() { var m = $('ptrModal'); if (m) m.innerHTML = ''; S.editing = null; }

    function readFile(file) {
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onerror = function () { reject(new Error('Berkas tidak bisa dibaca.')); };
            if (file.type === 'application/pdf') { r.onload = function (e) { resolve(e.target.result); }; r.readAsDataURL(file); return; }
            r.onload = function (e) {
                var img = new Image();
                img.onerror = function () { reject(new Error('Format gambar tidak didukung.')); };
                img.onload = function () {
                    var s = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
                    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    resolve(c.toDataURL('image/jpeg', 0.82));
                };
                img.src = e.target.result;
            };
            r.readAsDataURL(file);
        });
    }
    async function uploadFile(inputId, fallback, label) {
        var f = $(inputId) && $(inputId).files && $(inputId).files[0];
        if (!f) return fallback || null;
        if (typeof window.uploadBase64FileToFolder !== 'function') throw new Error('Fitur unggah berkas belum siap.');
        var data = await readFile(f);
        return await window.uploadBase64FileToFolder(data, 'pt/documents', S.pt + '-' + label + '-' + Date.now());
    }
    async function save() {
        var err = $('ptrErr'), btn = $('ptrSave'), fail = function (m) { err.innerHTML = '<div class="ptr-msg">' + esc(m) + '</div>'; };
        var v = function (id) { return ($(id).value || '').trim(); };
        var name = v('ptrName'), idNo = v('ptrIdNo'), from = $('ptrFrom').value, until = $('ptrUntil').value;
        if (!name) return fail('Nama lengkap wajib diisi.');
        if (!idNo) return fail('Nomor identitas wajib diisi.');
        if (from && until && until < from) return fail('Masa berlaku akhir tidak boleh sebelum tanggal mulai.');
        var dup = S.rows.filter(function (r) { return r.customer_id === S.pt && r.id_number === idNo && r.role_type === $('ptrRole').value && (!S.editing || r.id !== S.editing.id); })[0];
        if (dup) return fail('Orang dengan nomor identitas dan peran yang sama sudah terdaftar untuk PT ini (' + dup.name + ').');
        var old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...'; err.innerHTML = '';
        try {
            var cur = S.editing || {};
            var body = {
                customer_id: S.pt, role_type: $('ptrRole').value, name: name, position: v('ptrPos') || null, id_type: $('ptrIdType').value, id_number: idNo,
                phone: v('ptrPhone') || null, address: v('ptrAddr') || null, authority_ref: v('ptrRef') || null, valid_from: from || null, valid_until: until || null,
                status: $('ptrStatus').value, notes: v('ptrNotes') || null,
                photo_url: await uploadFile('ptrFilePhoto', cur.photo_url, 'foto'),
                id_photo_url: await uploadFile('ptrFileId', cur.id_photo_url, 'identitas'),
                authority_doc_url: await uploadFile('ptrFileDoc', cur.authority_doc_url, 'kuasa')
            };
            if (S.editing) await api('pt-representatives/' + S.editing.id, 'PUT', body); else await api('pt-representatives', 'POST', body);
            closeForm(); toast('Data tersimpan.'); await loadRows();
        } catch (e) { btn.disabled = false; btn.innerHTML = old; fail(e.message || 'Gagal menyimpan.'); }
    }

    /* ---------- OCR foto identitas (KTP / SIM) ---------- */
    var DIGIT_FIX = { O: '0', D: '0', Q: '0', I: '1', L: '1', '|': '1', Z: '2', S: '5', B: '8', G: '6' };
    function fixDigits(tok) { return String(tok || '').toUpperCase().replace(/[^A-Z0-9|]/g, '').replace(/[ODQIL|ZSBG]/g, function (c) { return DIGIT_FIX[c]; }); }
    function cleanVal(v) { return String(v || '').replace(/^[\s:;.\-]+/, '').replace(/\s+/g, ' ').trim(); }
    /* Susun ulang baris dari kata + koordinat (kolom label dan isi KTP jadi satu baris). */
    function rebuildLines(annotations) {
        var words = (annotations || []).slice(1), lines = [];
        words.forEach(function (w) {
            var v = w.boundingPoly && w.boundingPoly.vertices; if (!v || !v.length) return;
            var ys = v.map(function (q) { return q.y || 0; }), xs = v.map(function (q) { return q.x || 0; });
            var y = ys.reduce(function (a, b) { return a + b; }, 0) / ys.length, x = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
            var h = Math.max.apply(null, ys) - Math.min.apply(null, ys), tol = Math.max(10, h * 0.6), hit = null;
            for (var i = 0; i < lines.length; i++) { if (Math.abs(lines[i].y - y) <= tol) { hit = lines[i]; break; } }
            if (!hit) { hit = { y: y, w: [] }; lines.push(hit); }
            hit.w.push({ t: w.description, x: x });
        });
        return lines.sort(function (a, b) { return a.y - b.y; }).map(function (l) { return l.w.sort(function (a, b) { return a.x - b.x; }).map(function (q) { return q.t; }).join(' '); });
    }
    function parseIdText(lines, raw) {
        var all = (raw || lines.join('\n')).toUpperCase(), out = { type: '', number: '', name: '', address: '' };
        var isKtp = /NIK|PROVINSI|KEWARGANEGARAAN|GOL\.?\s*DARAH/.test(all), isSim = /SURAT\s+IZIN\s+MENGEMUDI|\bSIM\b|DRIVING\s+LICEN/.test(all);
        out.type = isKtp ? 'KTP' : (isSim ? 'SIM' : '');
        var get = function (re) { for (var i = 0; i < lines.length; i++) { var m = lines[i].match(re); if (m && cleanVal(m[1])) return cleanVal(m[1]); } return ''; };
        if (out.type === 'SIM') {
            out.name = get(/^\s*1[.\s:]+(.+)$/) || get(/^\s*NAMA\s*[:.\-]?\s*(.+)$/i);
            out.address = get(/^\s*5[.\s:]+(.+)$/) || get(/^\s*ALAMAT\s*[:.\-]?\s*(.+)$/i);
            var m = all.replace(/[\s-]/g, '').match(/\d{12,14}/); out.number = m ? m[0] : '';
        } else {
            var nikLine = get(/^\s*NIK\s*[:;.\-]?\s*(.+)$/i), nik = '';
            if (nikLine) { var mm = fixDigits(nikLine).match(/\d{16}/); if (mm) nik = mm[0]; }
            if (!nik) { var m2 = all.replace(/[\s.-]/g, '').match(/\d{16}/); if (m2) nik = m2[0]; }
            out.number = nik;
            out.name = get(/^\s*NAMA\s*[:;.\-]?\s*(.+)$/i);
            var parts = [get(/^\s*ALAMAT\s*[:;.\-]?\s*(.+)$/i), get(/^\s*RT\s*\/?\s*RW\s*[:;.\-]?\s*(.+)$/i), get(/^\s*(?:KEL|DESA)[\s\/A-Z]*[:;.\-]\s*(.+)$/i), get(/^\s*KECAMATAN\s*[:;.\-]?\s*(.+)$/i)];
            out.address = parts[0] ? [parts[0], parts[1] ? 'RT/RW ' + parts[1] : '', parts[2] ? 'Kel. ' + parts[2] : '', parts[3] ? 'Kec. ' + parts[3] : ''].filter(Boolean).join(', ') : '';
            if (!out.type && out.number) out.type = 'KTP';
        }
        out.name = out.name.replace(/[^A-Za-z.' -]/g, '').replace(/\s+/g, ' ').trim();
        return out;
    }
    async function currentIdImage() {
        var f = $('ptrFileId') && $('ptrFileId').files && $('ptrFileId').files[0];
        if (f) { if (f.type === 'application/pdf') throw new Error('OCR hanya untuk foto (JPG/PNG), bukan PDF.'); return await readFile(f); }
        var url = S.editing && S.editing.id_photo_url;
        if (!url) throw new Error('Pilih foto identitas dulu.');
        if (/\.pdf($|\?)/i.test(url)) throw new Error('OCR hanya untuk foto (JPG/PNG), bukan PDF.');
        var res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Foto identitas yang tersimpan tidak bisa dibaca.');
        var blob = await res.blob();
        return await readFile(new File([blob], 'id.jpg', { type: blob.type || 'image/jpeg' }));
    }
    async function runOcr() {
        var btn = $('ptrOcrBtn'), st = $('ptrOcrMsg'); if (!btn || btn.disabled) return;
        var set = function (cls, t) { st.className = 'ptr-ocr ' + cls; st.textContent = t; };
        var old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membaca...'; set('', '');
        try {
            var dataUrl = await currentIdImage();
            var request = window.authFetch || fetch, csrf = document.querySelector('meta[name="csrf-token"]');
            var res = await request('/api/ocr/vision', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf ? csrf.getAttribute('content') : '' }, body: JSON.stringify({ image_base64: dataUrl.split(',')[1] }) });
            var out = await res.json().catch(function () { return {}; });
            if (!res.ok || out.status !== 'success') {
                if (['key_missing', 'invalid_key', 'permission_denied'].indexOf(out.error_type) >= 0) throw new Error('OCR belum siap: kunci Google Vision belum diatur. Minta owner/admin mengisinya di Pengaturan → Profil.');
                throw new Error(out.message || 'OCR gagal. Isi data secara manual.');
            }
            var ann = out.data && out.data.responses && out.data.responses[0] && out.data.responses[0].textAnnotations;
            if (!ann || !ann.length) throw new Error('Tidak ada tulisan yang terbaca. Gunakan foto yang tegak, jelas, dan terang.');
            var r = parseIdText(rebuildLines(ann), ann[0].description || ''), filled = [];
            ['ptrIdType', 'ptrIdNo', 'ptrName', 'ptrAddr'].forEach(function (id) { $(id).classList.remove('ocr-hit'); });
            var put = function (id, val, label) { if (val) { $(id).value = val; $(id).classList.add('ocr-hit'); filled.push(label); } };
            put('ptrIdType', r.type, 'jenis'); put('ptrIdNo', r.number, 'nomor'); put('ptrName', r.name, 'nama'); put('ptrAddr', r.address, 'alamat');
            if (!filled.length) throw new Error('Teks terbaca tetapi bukan format KTP/SIM yang dikenali. Isi manual.');
            set('ok', 'Terisi otomatis: ' + filled.join(', ') + '. Periksa dan koreksi sebelum menyimpan.');
        } catch (e) { set('bad', e.message || 'OCR gagal.'); }
        btn.disabled = false; btn.innerHTML = old;
    }
    window.__ptrParseIdText = parseIdText;

    /* ---------- Aksi ---------- */
    function find(id) { return S.rows.filter(function (r) { return String(r.id) === String(id); })[0]; }
    function toRow(r) { return { customer_id: r.customer_id, role_type: r.role_type, name: r.name, position: r.position, id_type: r.id_type, id_number: r.id_number, phone: r.phone, address: r.address, authority_ref: r.authority_ref, valid_from: r.valid_from, valid_until: r.valid_until, status: r.status, photo_url: r.photo_url, id_photo_url: r.id_photo_url, authority_doc_url: r.authority_doc_url, notes: r.notes }; }
    async function onClick(e) {
        var t = e.target.closest('[data-ptr]'); if (!t) return;
        var a = t.dataset.ptr, id = t.dataset.id, r;
        if (a === 'close-bg') { if (e.target === t) closeForm(); return; }
        if (a === 'pt') { S.pt = id; S.role = 'all'; paintAll(); }
        else if (a === 'role') { S.role = t.dataset.role; paintMain(); }
        else if (a === 'add') openForm(null);
        else if (a === 'edit') { r = find(id); if (r) openForm(r); }
        else if (a === 'close') closeForm();
        else if (a === 'reveal') { S.reveal[id] = !S.reveal[id]; paintMain(); }
        else if (a === 'toggle') {
            r = find(id); if (!r) return;
            try { var b = toRow(r); b.status = r.status === 'inactive' ? 'active' : 'inactive'; await api('pt-representatives/' + r.id, 'PUT', b); toast(b.status === 'active' ? 'Diaktifkan.' : 'Dinonaktifkan.'); await loadRows(); } catch (x) { toast(x.message, true); }
        } else if (a === 'del') {
            r = find(id); if (!r) return;
            if (!confirm('Hapus ' + r.name + ' dari daftar PT ini? Tindakan ini tidak bisa dibatalkan. Bila hanya tidak berlaku lagi, gunakan Nonaktifkan.')) return;
            try { await api('pt-representatives/' + r.id, 'DELETE'); toast('Dihapus.'); await loadRows(); } catch (x) { toast(x.message, true); }
        } else if (a === 'ocr') runOcr();
        else if (a === 'export') exportExcel();
        else if (a === 'print') window.print();
    }
    function onChange(e) {
        if (e.target.id === 'ptrRole') { var h = $('ptrRoleHint'); if (h) h.textContent = (ROLES[e.target.value] || ROLES.other).hint; }
    }
    function exportExcel() {
        var rows = ptRows(S.pt);
        if (!rows.length) { alert('Belum ada data untuk diekspor.'); return; }
        if (typeof XLSX === 'undefined') { alert('Pustaka Excel belum termuat. Muat ulang halaman lalu coba lagi.'); return; }
        var info = ptInfo(S.pt), data = [['No', 'PT', 'ID Nasabah PT', 'Peran', 'Nama', 'Jabatan', 'Jenis Identitas', 'No. Identitas', 'Telepon', 'Alamat', 'Dasar Kewenangan', 'Berlaku Dari', 'Berlaku Sampai', 'Status', 'Catatan']];
        rows.forEach(function (r, i) { data.push([i + 1, info.name, info.id, (ROLES[r.role_type] || ROLES.other).label, r.name, r.position || '', r.id_type, String(r.id_number || ''), String(r.phone || ''), r.address || '', r.authority_ref || '', r.valid_from || '', r.valid_until || '', validity(r).t, r.notes || '']); });
        var ws = XLSX.utils.aoa_to_sheet(data); ws['!cols'] = [5, 28, 16, 20, 26, 20, 14, 22, 16, 36, 24, 14, 14, 18, 30].map(function (w) { return { wch: w }; });
        var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Perwakilan PT');
        var name = 'Perwakilan_PT_' + String(info.id).replace(/[^A-Za-z0-9_-]/g, '') + '.xlsx';
        if (typeof window.safeExportXLSX === 'function') window.safeExportXLSX(wb, name); else XLSX.writeFile(wb, name);
    }

    var kdBound = false;
    window.initPtReps = function () {
        if (!build()) return;
        if (!kdBound) { kdBound = true; document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && $('ptrForm')) closeForm(); }); }
        loadRows();
    };
})();
