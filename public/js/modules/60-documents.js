// @2026-Alifiandra
/* =====================================================================
 * 60-documents.js  —  Administrasi > Penyimpanan Berkas
 *
 * Arsip digital perusahaan: folder bersarang, unggah banyak berkas sekaligus
 * (klik atau seret-lepas), pratinjau gambar/PDF, tanggal berlaku (untuk
 * perizinan), pencarian, dan pengurutan.
 *
 * Data memakai kunci lama (mc_documents, mc_document_folders) sehingga berkas
 * yang sudah tersimpan tetap muncul. Berkas fisik disimpan lewat
 * window.uploadBase64FileToFolder -> public/uploads/company/documents.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcDocs) return;
    window.__mcDocs = true;

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var ymd = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

    var MAX_BYTES = 10 * 1024 * 1024;
    var TYPES = {
        pdf: ['application/pdf', 'fa-file-pdf', '#ef4444', 'PDF'], jpg: ['image/jpeg', 'fa-file-image', '#10b981', 'Gambar'], jpeg: ['image/jpeg', 'fa-file-image', '#10b981', 'Gambar'],
        png: ['image/png', 'fa-file-image', '#10b981', 'Gambar'], gif: ['image/gif', 'fa-file-image', '#10b981', 'Gambar'], webp: ['image/webp', 'fa-file-image', '#10b981', 'Gambar'],
        doc: ['application/msword', 'fa-file-word', '#3b82f6', 'Word'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'fa-file-word', '#3b82f6', 'Word'],
        xls: ['application/vnd.ms-excel', 'fa-file-excel', '#22c55e', 'Excel'], xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'fa-file-excel', '#22c55e', 'Excel'],
        ppt: ['application/vnd.ms-powerpoint', 'fa-file-powerpoint', '#f97316', 'PowerPoint'], pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'fa-file-powerpoint', '#f97316', 'PowerPoint'],
        zip: ['application/zip', 'fa-file-zipper', '#fbbf24', 'Arsip'], rar: ['application/x-rar-compressed', 'fa-file-zipper', '#fbbf24', 'Arsip'], txt: ['text/plain', 'fa-file-lines', '#94a3b8', 'Teks']
    };
    var ACCEPT = '.' + Object.keys(TYPES).join(',.');
    var extOf = function (n) { var m = /\.([a-z0-9]+)$/i.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; };
    var typeOf = function (n) { return TYPES[extOf(n)] || ['application/octet-stream', 'fa-file', '#94a3b8', 'Berkas']; };

    function bytes(b) { b = +b || 0; if (!b) return '0 B'; var u = ['B', 'KB', 'MB', 'GB'], i = Math.min(3, Math.floor(Math.log(b) / Math.log(1024))); return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0).replace('.', ',') + ' ' + u[i]; }
    function when(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return '-'; return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
    function dateOnly(s) { return s ? new Date(s + 'T00:00:00') : null; }

    /* ---------- Data ---------- */
    var arr = function (k) { return typeof window.safeArrayGet === 'function' ? window.safeArrayGet(k) : (function () { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } })(); };
    var DOCS = function () { return arr('mc_documents'); };
    var CUSTOM = function () { return arr('mc_document_folders'); };
    function put(key, data) { localStorage.setItem(key, JSON.stringify(data)); if (typeof pushToUniversalDatastore === 'function') pushToUniversalDatastore(key, data); }
    function companyName() { try { var p = typeof getProfile === 'function' ? getProfile() : JSON.parse(localStorage.getItem('mc_profile') || '{}'); return (p && p.name) || 'Perusahaan'; } catch (e) { return 'Perusahaan'; } }
    function folders() {
        return [{ id: 'default-perizinan', name: 'Perizinan', isDefault: true }, { id: 'default-sewa-gedung', name: 'Sewa Gedung', isDefault: true },
            { id: 'default-pt', name: companyName(), isDefault: true }, { id: 'default-pks', name: 'PKS', isDefault: true }, { id: 'default-banner', name: 'Banner', isDefault: true },
            { id: 'default-kartu-nama', name: 'Kartu Nama', isDefault: true }].concat(CUSTOM());
    }
    function folderById(id) { return folders().filter(function (f) { return f.id === id; })[0] || null; }
    function children(pid, all) { return (all || folders()).filter(function (f) { return (f.parentId || null) === (pid || null); }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'id-ID'); }); }
    function descendants(id, all) {
        all = all || folders(); var ids = {}; ids[id] = 1; var go = true;
        while (go) { go = false; all.forEach(function (f) { if (f.parentId && ids[f.parentId] && !ids[f.id]) { ids[f.id] = 1; go = true; } }); }
        return ids;
    }
    function pathOf(id) { var all = folders(), out = [], cur = folderById(id), guard = 0; while (cur && guard++ < 20) { out.unshift(cur); cur = cur.parentId ? folderById(cur.parentId) : null; } return out; }
    function actor() { try { var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null; return (u && (u.fullName || u.username)) || ''; } catch (e) { return ''; } }
    function expState(d) {
        if (!d.expires) return null; var diff = Math.round((dateOnly(d.expires) - dateOnly(ymd())) / 86400000);
        if (diff < 0) return ['r', 'Kedaluwarsa ' + Math.abs(diff) + ' hari lalu']; if (diff <= 60) return ['a', 'Berakhir ' + diff + ' hari lagi']; return ['g', 'Berlaku s.d. ' + when(d.expires)];
    }

    var S = { folder: 'default-perizinan', q: '', scope: 'folder', sort: 'new', type: '', pending: [], built: false, busy: false };

    /* ---------- Gaya ---------- */
    function style() {
        if ($('dc-style')) return; var st = document.createElement('style'); st.id = 'dc-style';
        st.textContent = [
            '.dc{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#6366f1);display:grid;gap:16px}.dc *{box-sizing:border-box}',
            '.dc-head{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border:1px solid var(--bd);border-radius:16px;padding:16px 20px;background:linear-gradient(135deg,rgba(251,191,36,.16),rgba(251,191,36,.02))}',
            '.dc-head .ic{width:44px;height:44px;border-radius:12px;background:#f59e0b;color:#fff;display:grid;place-items:center;font-size:1.15rem;flex:none}.dc-head h2{margin:0;font-size:1.18rem}.dc-head p{margin:3px 0 0;color:var(--mut);font-size:.83rem}.dc-head .act{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}',
            '.dc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.dc-kpi{border:1px solid var(--bd);border-radius:14px;padding:12px 15px}.dc-kpi .t{font-size:.72rem;color:var(--mut);font-weight:600}.dc-kpi .v{font-size:1.35rem;font-weight:800;margin-top:2px}.dc-kpi.warn .v{color:#f59e0b}.dc-kpi.bad .v{color:#f87171}',
            '.dc-main{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px;align-items:start}@media(max-width:900px){.dc-main{grid-template-columns:1fr}}',
            '.dc-card{border:1px solid var(--bd);border-radius:16px;padding:14px 16px;min-width:0}.dc-card h3{margin:0 0 10px;font-size:.92rem}',
            '.dc-fold{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;cursor:pointer;font-size:.85rem;border:1px solid transparent}.dc-fold:hover{background:rgba(148,163,184,.1)}.dc-fold.on{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.4);font-weight:700}',
            '.dc-fold .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dc-fold .c{font-size:.7rem;color:var(--mut);font-weight:700}.dc-fold .x{opacity:0;display:flex;gap:2px}.dc-fold:hover .x,.dc-fold.on .x{opacity:1}',
            '.dc-ib{background:none;border:0;color:var(--mut);cursor:pointer;padding:3px 5px;border-radius:6px;font-size:.78rem}.dc-ib:hover{color:inherit;background:rgba(148,163,184,.18)}.dc-ib.d:hover{color:#f87171}',
            '.dc-crumb{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:.85rem;margin-bottom:10px}.dc-crumb a{color:var(--mut);cursor:pointer}.dc-crumb a:hover{color:inherit}.dc-crumb b{font-size:1rem}',
            '.dc-tool{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.dc-tool .grow{flex:1;min-width:190px}',
            '.dc .form-control,.dc-ov .form-control{width:100%}.dc .dc-tool select.form-control,.dc .dc-tool .grow.form-control{width:auto}.dc .dc-tool .grow.form-control{width:100%}.dc-ov label.l{display:block;font-size:.74rem;font-weight:700;margin:0 0 4px}.dc-ov small.h{display:block;color:var(--mut);font-size:.72rem;margin-top:3px}',
            '.dc-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.8rem;padding:8px 13px;border-radius:10px;cursor:pointer;white-space:nowrap}.dc-btn:hover{border-color:var(--pri)}.dc-btn.pri{background:var(--pri);border-color:var(--pri);color:#fff}.dc-btn.dng{color:#f87171}.dc-btn.sm{padding:5px 9px;font-size:.75rem}.dc-btn:disabled{opacity:.55;cursor:not-allowed}',
            '.dc-drop{border:2px dashed var(--bd);border-radius:14px;padding:16px;text-align:center;color:var(--mut);font-size:.84rem;margin-bottom:12px;cursor:pointer;transition:.15s}.dc-drop.over,.dc-drop:hover{border-color:#f59e0b;background:rgba(245,158,11,.07);color:inherit}.dc-drop i{font-size:1.3rem;display:block;margin-bottom:5px}',
            '.dc-table{width:100%;border-collapse:collapse;font-size:.84rem}.dc-table th{text-align:left;font-size:.72rem;color:var(--mut);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--bd);white-space:nowrap}.dc-table td{padding:10px;border-bottom:1px solid var(--bd);vertical-align:middle}.dc-wrap{overflow-x:auto}',
            '.dc-file{display:flex;gap:11px;align-items:center;min-width:220px}.dc-file i.t{font-size:1.45rem;flex:none}.dc-file .nm{font-weight:600;overflow-wrap:anywhere;cursor:pointer}.dc-file .nm:hover{color:var(--pri)}.dc-file .nt{font-size:.74rem;color:var(--mut);margin-top:2px;overflow-wrap:anywhere}',
            '.dc-b{display:inline-block;border-radius:99px;font-size:.68rem;font-weight:800;padding:2px 9px}.dc-b.g{background:rgba(16,185,129,.16);color:#34d399}.dc-b.a{background:rgba(245,158,11,.16);color:#fbbf24}.dc-b.r{background:rgba(239,68,68,.16);color:#f87171}.dc-b.n{background:rgba(148,163,184,.16);color:var(--mut)}',
            '.dc-empty{text-align:center;color:var(--mut);padding:30px 12px;font-size:.86rem;line-height:1.6}.dc-empty i{display:block;font-size:1.8rem;margin-bottom:8px;opacity:.6}',
            '.dc-ov{position:fixed;inset:0;background:rgba(2,6,23,.62);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow-y:auto;--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#6366f1)}',
            '.dc-modal{background:var(--mc-card-bg,#1e293b);color:var(--mc-text,inherit);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:560px;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.4)}.dc-modal.wide{max-width:960px}.dc-mh{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.dc-mh h3{margin:0;font-size:1.05rem}.dc-mh .x{margin-left:auto}',
            '.dc-f{display:grid;grid-template-columns:1fr 1fr;gap:11px}.dc-f .full{grid-column:1/-1}@media(max-width:560px){.dc-f{grid-template-columns:1fr}}.dc-mf{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px}',
            '.dc-pend{border:1px solid var(--bd);border-radius:10px;margin-top:10px;max-height:190px;overflow:auto}.dc-pend div{display:flex;gap:9px;align-items:center;padding:7px 10px;border-bottom:1px solid var(--bd);font-size:.8rem}.dc-pend div:last-child{border:0}.dc-pend span{flex:1;overflow-wrap:anywhere}',
            '.dc-msg{font-size:.8rem;line-height:1.5;border-radius:10px;padding:8px 11px;border:1px solid rgba(248,113,113,.5);background:rgba(239,68,68,.08);color:#f87171;margin-top:10px}',
            '.dc-pv{text-align:center}.dc-pv img{max-width:100%;max-height:74vh;border-radius:8px}.dc-pv iframe{width:100%;height:74vh;border:0;border-radius:8px;background:#fff}',
            '.dc-toast{position:fixed;right:18px;bottom:18px;z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:11px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:min(420px,90vw)}.dc-toast.err{border-left-color:#ef4444}'
        ].join('\n'); document.head.appendChild(st);
    }
    function toast(m, err) { document.querySelectorAll('.dc-toast').forEach(function (o) { o.remove(); }); var t = document.createElement('div'); t.className = 'dc-toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, err ? 6000 : 3000); }
    function modal(html, wide) {
        closeModal(); var ov = document.createElement('div'); ov.className = 'dc-ov dc'; ov.id = 'dcOv';
        ov.innerHTML = '<div class="dc-modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
        ['click', 'change', 'submit', 'dragover', 'dragleave', 'drop'].forEach(function (ev) { ov.addEventListener(ev, handlers[ev]); });
        document.body.appendChild(ov); var f = ov.querySelector('input:not([type=hidden]):not([type=file]),select,textarea'); if (f) f.focus();
    }
    function closeModal() { var o = $('dcOv'); if (o) o.remove(); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    function mh(t, sub) { return '<div class="dc-mh"><div><h3>' + esc(t) + '</h3>' + (sub ? '<div style="color:var(--mut);font-size:.78rem;margin-top:2px">' + esc(sub) + '</div>' : '') + '</div><button type="button" class="dc-btn sm x" data-act="close">Tutup</button></div>'; }
    function folderOptions(sel, o) {
        o = o || {}; var all = folders(), ex = o.exclude || {}, out = o.root ? '<option value="">/ Utama</option>' : '';
        (function walk(pid, depth) { children(pid, all).forEach(function (f) { if (ex[f.id]) return; out += '<option value="' + esc(f.id) + '"' + (f.id === sel ? ' selected' : '') + '>' + new Array(depth + 1).join('— ') + esc(f.name) + '</option>'; walk(f.id, depth + 1); }); })(null, 0);
        return out;
    }

    /* ---------- Kerangka ---------- */
    function build() {
        var root = $('docsRoot'); if (!root) return null; if (S.built) return root;
        style(); S.built = true; root.className = 'dc';
        root.addEventListener('click', handlers.click); root.addEventListener('change', handlers.change); root.addEventListener('input', handlers.input);
        root.addEventListener('dragover', handlers.dragover); root.addEventListener('dragleave', handlers.dragleave); root.addEventListener('drop', handlers.drop);
        return root;
    }
    function render() {
        var root = build(); if (!root) return;
        if (!folderById(S.folder)) S.folder = 'default-perizinan';
        var keepQ = $('dcQ') ? $('dcQ').value : S.q, focus = document.activeElement && document.activeElement.id === 'dcQ';
        var docs = DOCS(), all = folders();
        var total = docs.reduce(function (s, d) { return s + (+d.size || 0); }, 0), soon = 0, expired = 0;
        docs.forEach(function (d) { var e = expState(d); if (e && e[0] === 'a') soon++; if (e && e[0] === 'r') expired++; });
        var counts = {}; docs.forEach(function (d) { counts[d.folderId] = (counts[d.folderId] || 0) + 1; });
        var tree = (function walk(pid, depth) {
            return children(pid, all).map(function (f) {
                var on = f.id === S.folder;
                return '<div class="dc-fold' + (on ? ' on' : '') + '" data-act="folder" data-id="' + esc(f.id) + '" style="margin-left:' + depth * 16 + 'px"><i class="fa-solid ' + (on ? 'fa-folder-open' : 'fa-folder') + '" style="color:' + (f.isDefault ? '#fbbf24' : '#60a5fa') + '"></i><span class="n" title="' + esc(f.name) + '">' + esc(f.name) + '</span><span class="x"><button class="dc-ib" data-act="folder-new" data-id="' + esc(f.id) + '" title="Subfolder" aria-label="Tambah subfolder"><i class="fa-solid fa-folder-plus"></i></button>' +
                    (f.isDefault ? '' : '<button class="dc-ib" data-act="folder-edit" data-id="' + esc(f.id) + '" title="Ubah" aria-label="Ubah folder"><i class="fa-solid fa-pen"></i></button><button class="dc-ib d" data-act="folder-del-ask" data-id="' + esc(f.id) + '" title="Hapus" aria-label="Hapus folder"><i class="fa-solid fa-trash"></i></button>') + '</span><span class="c">' + (counts[f.id] || 0) + '</span></div>' + walk(f.id, depth + 1);
            }).join('');
        })(null, 0);
        var path = pathOf(S.folder);
        root.innerHTML = '<div class="dc-head"><div class="ic"><i class="fa-solid fa-folder-open"></i></div><div><h2>Penyimpanan Berkas</h2><p>Arsip digital perusahaan: perizinan, sewa gedung, dokumen badan usaha, PKS, dan lainnya.</p></div>' +
            '<div class="act"><button class="dc-btn" data-act="folder-new" data-id="' + esc(S.folder) + '"><i class="fa-solid fa-folder-plus"></i> Folder Baru</button><button class="dc-btn pri" data-act="up-open"><i class="fa-solid fa-upload"></i> Unggah Berkas</button></div></div>' +
            '<div class="dc-kpis"><div class="dc-kpi"><div class="t">Total berkas</div><div class="v">' + docs.length + '</div></div><div class="dc-kpi"><div class="t">Ruang terpakai</div><div class="v">' + bytes(total) + '</div></div>' +
            '<div class="dc-kpi' + (soon ? ' warn' : '') + '"><div class="t">Segera berakhir (&le;60 hari)</div><div class="v">' + soon + '</div></div><div class="dc-kpi' + (expired ? ' bad' : '') + '"><div class="t">Kedaluwarsa</div><div class="v">' + expired + '</div></div></div>' +
            '<div class="dc-main"><div class="dc-card"><h3><i class="fa-solid fa-folder-tree" style="color:#fbbf24"></i> Folder</h3>' + tree + '</div><div class="dc-card">' +
            '<div class="dc-crumb">' + path.map(function (f, i) { return i === path.length - 1 ? '<b>' + esc(f.name) + '</b>' : '<a data-act="folder" data-id="' + esc(f.id) + '">' + esc(f.name) + '</a><i class="fa-solid fa-chevron-right" style="font-size:.6rem;color:var(--mut)"></i>'; }).join('') + '</div>' +
            '<div class="dc-drop" id="dcDrop" data-act="up-open"><i class="fa-solid fa-cloud-arrow-up"></i>Seret berkas ke sini atau klik untuk memilih &middot; maks. 10 MB per berkas</div>' +
            '<div class="dc-tool"><input class="form-control grow" id="dcQ" type="search" placeholder="Cari nama berkas atau catatan..." value="' + esc(keepQ) + '"><select class="form-control" id="dcScope"><option value="folder"' + (S.scope === 'folder' ? ' selected' : '') + '>Folder ini</option><option value="tree"' + (S.scope === 'tree' ? ' selected' : '') + '>Termasuk subfolder</option><option value="all"' + (S.scope === 'all' ? ' selected' : '') + '>Semua folder</option></select>' +
            '<select class="form-control" id="dcType"><option value="">Semua jenis</option>' + ['PDF', 'Gambar', 'Word', 'Excel', 'PowerPoint', 'Arsip', 'Teks'].map(function (t) { return '<option' + (S.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
            '<select class="form-control" id="dcSort"><option value="new"' + (S.sort === 'new' ? ' selected' : '') + '>Terbaru</option><option value="old"' + (S.sort === 'old' ? ' selected' : '') + '>Terlama</option><option value="name"' + (S.sort === 'name' ? ' selected' : '') + '>Nama A-Z</option><option value="size"' + (S.sort === 'size' ? ' selected' : '') + '>Ukuran terbesar</option><option value="exp"' + (S.sort === 'exp' ? ' selected' : '') + '>Masa berlaku terdekat</option></select></div>' +
            '<div id="dcList"></div></div></div>';
        paintList();
        if (focus) { var q = $('dcQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
    function paintList() {
        var box = $('dcList'); if (!box) return; var q = (S.q || '').toLowerCase().trim(), all = folders(), tree = descendants(S.folder, all);
        var list = DOCS().filter(function (d) {
            if (S.scope === 'folder' && d.folderId !== S.folder) return false; if (S.scope === 'tree' && !tree[d.folderId]) return false;
            if (S.type && typeOf(d.name)[3] !== S.type) return false;
            return !q || (String(d.name) + ' ' + (d.notes || '')).toLowerCase().indexOf(q) >= 0;
        });
        list.sort(function (a, b) {
            if (S.sort === 'name') return String(a.name).localeCompare(String(b.name), 'id-ID'); if (S.sort === 'size') return (+b.size || 0) - (+a.size || 0);
            if (S.sort === 'exp') return String(a.expires || '9999').localeCompare(String(b.expires || '9999'));
            var d = new Date(b.uploaded_at) - new Date(a.uploaded_at); return S.sort === 'old' ? -d : d;
        });
        if (!list.length) { box.innerHTML = '<div class="dc-empty"><i class="fa-regular fa-folder-open"></i>' + (q || S.type ? 'Tidak ada berkas yang cocok.' : 'Folder ini masih kosong. Seret berkas ke area di atas atau klik <b>Unggah Berkas</b>.') + '</div>'; return; }
        box.innerHTML = '<div class="dc-wrap"><table class="dc-table"><thead><tr><th>Berkas</th>' + (S.scope !== 'folder' ? '<th>Folder</th>' : '') + '<th>Ukuran</th><th>Diunggah</th><th>Masa berlaku</th><th></th></tr></thead><tbody>' + list.map(function (d) {
            var t = typeOf(d.name), ex = expState(d), f = folderById(d.folderId), prev = t[3] === 'PDF' || t[3] === 'Gambar';
            return '<tr><td><div class="dc-file"><i class="fa-solid ' + t[1] + ' t" style="color:' + t[2] + '"></i><div><div class="nm" data-act="' + (prev ? 'view' : 'dl') + '" data-id="' + esc(d.id) + '">' + esc(d.name) + '</div>' + (d.notes ? '<div class="nt">' + esc(d.notes) + '</div>' : '') + '</div></div></td>' +
                (S.scope !== 'folder' ? '<td>' + esc(f ? f.name : '-') + '</td>' : '') + '<td style="white-space:nowrap">' + bytes(d.size) + '</td><td style="white-space:nowrap">' + when(d.uploaded_at) + (d.uploaded_by ? '<div style="font-size:.72rem;color:var(--mut)">' + esc(d.uploaded_by) + '</div>' : '') + '</td>' +
                '<td>' + (ex ? '<span class="dc-b ' + ex[0] + '">' + esc(ex[1]) + '</span>' : '<span style="color:var(--mut)">-</span>') + '</td><td style="white-space:nowrap;text-align:right">' + (prev ? '<button class="dc-btn sm" data-act="view" data-id="' + esc(d.id) + '" aria-label="Lihat"><i class="fa-solid fa-eye"></i></button> ' : '') +
                '<button class="dc-btn sm" data-act="dl" data-id="' + esc(d.id) + '" aria-label="Unduh"><i class="fa-solid fa-download"></i></button> <button class="dc-btn sm" data-act="doc-edit" data-id="' + esc(d.id) + '" aria-label="Ubah"><i class="fa-solid fa-pen"></i></button> <button class="dc-btn sm dng" data-act="doc-del-ask" data-id="' + esc(d.id) + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></td></tr>';
        }).join('') + '</tbody></table></div><div style="margin-top:8px;font-size:.74rem;color:var(--mut)">' + list.length + ' berkas</div>';
    }

    /* ---------- Folder ---------- */
    function folderModal(parentId, editId) {
        var e = editId ? folderById(editId) : null;
        modal(mh(e ? 'Ubah Folder' : 'Folder Baru') + '<form id="dcFolderForm" data-edit="' + esc(editId || '') + '"><div class="dc-f"><div class="full"><label class="l" for="dcFName">Nama folder</label><input class="form-control" id="dcFName" value="' + esc(e ? e.name : '') + '" placeholder="Contoh: Perizinan 2026" maxlength="80"></div>' +
            '<div class="full"><label class="l" for="dcFParent">Letak folder</label><select class="form-control" id="dcFParent">' + folderOptions(e ? (e.parentId || '') : (parentId || ''), { root: true, exclude: e ? descendants(e.id) : {} }) + '</select></div></div><div id="dcErr"></div><div class="dc-mf"><button type="button" class="dc-btn" data-act="close">Batal</button><button type="submit" class="dc-btn pri">Simpan</button></div></form>', false);
    }
    function dupFolder(name, parent, except) { var n = name.trim().toLowerCase(); return folders().some(function (f) { return f.id !== except && String(f.name).trim().toLowerCase() === n && (f.parentId || null) === (parent || null); }); }
    function saveFolder(form) {
        var name = $('dcFName').value.trim(), parent = $('dcFParent').value || null, edit = form.dataset.edit, err = $('dcErr');
        var fail = function (m) { err.innerHTML = '<div class="dc-msg">' + esc(m) + '</div>'; };
        if (!name) return fail('Nama folder wajib diisi.'); if (dupFolder(name, parent, edit)) return fail('Sudah ada folder bernama sama di lokasi ini.');
        var c = CUSTOM();
        if (edit) { var i = c.findIndex(function (f) { return f.id === edit; }); if (i < 0) return fail('Folder tidak ditemukan.'); if (parent && descendants(edit)[parent]) return fail('Folder tidak bisa dipindah ke dalam dirinya sendiri.'); c[i].name = name; c[i].parentId = parent; S.folder = edit; }
        else { var nf = { id: 'folder-' + Date.now(), name: name, parentId: parent, isDefault: false }; c.push(nf); S.folder = nf.id; }
        put('mc_document_folders', c); closeModal(); render(); toast(edit ? 'Folder diperbarui.' : 'Folder dibuat.');
    }
    function delFolder(id) {
        var all = folders(), ids = descendants(id, all), f = folderById(id); if (!f || f.isDefault) return;
        put('mc_document_folders', CUSTOM().filter(function (x) { return !ids[x.id]; })); put('mc_documents', DOCS().filter(function (d) { return !ids[d.folderId]; }));
        if (ids[S.folder]) S.folder = f.parentId || 'default-perizinan'; closeModal(); render(); toast('Folder dihapus dari daftar.');
    }

    /* ---------- Unggah ---------- */
    function addPending(files) {
        var bad = [];
        Array.prototype.forEach.call(files, function (f) {
            if (!TYPES[extOf(f.name)]) bad.push(f.name + ' (format tidak didukung)'); else if (f.size > MAX_BYTES) bad.push(f.name + ' (lebih dari 10 MB)'); else if (f.size === 0) bad.push(f.name + ' (kosong)');
            else if (!S.pending.some(function (p) { return p.name === f.name && p.size === f.size; })) S.pending.push(f);
        });
        return bad;
    }
    function uploadModal(files) {
        S.pending = []; var bad = files ? addPending(files) : [];
        modal(mh('Unggah Berkas', 'PDF, gambar, Word, Excel, PowerPoint, ZIP/RAR, TXT · maks. 10 MB per berkas') +
            '<form id="dcUpForm"><div class="dc-f"><div class="full"><label class="l" for="dcUpFolder">Simpan ke folder</label><select class="form-control" id="dcUpFolder">' + folderOptions(S.folder) + '</select></div>' +
            '<div class="full"><div class="dc-drop" id="dcUpDrop" style="margin:0"><i class="fa-solid fa-paperclip"></i>Seret berkas ke sini atau <label for="dcUpFile" style="text-decoration:underline;cursor:pointer;margin:0">pilih dari komputer</label><input type="file" id="dcUpFile" multiple accept="' + ACCEPT + '" style="display:none"></div><div id="dcPend"></div></div>' +
            '<div class="full"><label class="l" for="dcUpNote">Catatan (berlaku untuk semua berkas)</label><input class="form-control" id="dcUpNote" placeholder="Opsional, mis. nomor izin atau masa sewa"></div>' +
            '<div class="full"><label class="l" for="dcUpExp">Tanggal berlaku sampai (opsional)</label><input type="date" class="form-control" id="dcUpExp"><small class="h">Isi untuk perizinan atau kontrak; sistem menandai yang segera berakhir.</small></div></div>' +
            '<div id="dcErr">' + (bad.length ? '<div class="dc-msg">Tidak dapat ditambahkan: ' + esc(bad.join('; ')) + '</div>' : '') + '</div><div class="dc-mf"><button type="button" class="dc-btn" data-act="close">Batal</button><button type="submit" class="dc-btn pri" id="dcUpGo"><i class="fa-solid fa-upload"></i> Unggah</button></div></form>');
        paintPending();
    }
    function paintPending() {
        var el = $('dcPend'); if (!el) return;
        el.innerHTML = S.pending.length ? '<div class="dc-pend">' + S.pending.map(function (f, i) { var t = typeOf(f.name); return '<div><i class="fa-solid ' + t[1] + '" style="color:' + t[2] + '"></i><span>' + esc(f.name) + '</span><small style="color:var(--mut)">' + bytes(f.size) + '</small><button type="button" class="dc-ib d" data-act="pend-rm" data-i="' + i + '" aria-label="Hapus dari daftar"><i class="fa-solid fa-xmark"></i></button></div>'; }).join('') + '</div>' : '';
    }
    function readData(file) {
        return new Promise(function (res, rej) {
            var r = new FileReader(); r.onerror = function () { rej(new Error('Gagal membaca ' + file.name)); };
            r.onload = function () { res(String(r.result).replace(/^data:[^;,]*;base64,/, 'data:' + typeOf(file.name)[0] + ';base64,')); }; r.readAsDataURL(file);
        });
    }
    async function doUpload(form) {
        var err = $('dcErr'); if (S.busy) return;
        if (!S.pending.length) { err.innerHTML = '<div class="dc-msg">Pilih minimal satu berkas.</div>'; return; }
        var folder = $('dcUpFolder').value, note = $('dcUpNote').value.trim(), exp = $('dcUpExp').value, btn = $('dcUpGo'), files = S.pending.slice(), ok = 0, fails = [];
        S.busy = true; btn.disabled = true; err.innerHTML = '';
        for (var i = 0; i < files.length; i++) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah ' + (i + 1) + ' / ' + files.length + '...';
            try {
                var url = await window.uploadBase64FileToFolder(await readData(files[i]), 'company/documents', files[i].name);
                var docs = DOCS(); docs.push({ id: 'doc-' + Date.now() + '-' + i, folderId: folder, name: files[i].name, url: url, size: files[i].size, notes: note, expires: exp || '', uploaded_at: new Date().toISOString(), uploaded_by: actor() });
                put('mc_documents', docs); ok++;
            } catch (e) { fails.push(files[i].name + ': ' + e.message); }
        }
        S.busy = false; S.pending = [];
        if (fails.length) { S.pending = []; btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-upload"></i> Unggah'; err.innerHTML = '<div class="dc-msg">' + (ok ? ok + ' berkas berhasil. ' : '') + 'Gagal: ' + esc(fails.join('; ')) + '</div>'; S.folder = folder; paintPending(); render(); return; }
        S.folder = folder; closeModal(); render(); toast(ok + ' berkas berhasil diunggah.');
    }

    /* ---------- Ubah / hapus berkas ---------- */
    function docModal(id) {
        var d = DOCS().filter(function (x) { return x.id === id; })[0]; if (!d) return;
        var base = d.name.replace(/\.[^.]+$/, '');
        modal(mh('Ubah Info Berkas', d.name) + '<form id="dcDocForm" data-id="' + esc(id) + '"><div class="dc-f"><div class="full"><label class="l" for="dcDName">Nama berkas</label><input class="form-control" id="dcDName" value="' + esc(base) + '"><small class="h">Ekstensi .' + esc(extOf(d.name)) + ' dipertahankan otomatis.</small></div>' +
            '<div class="full"><label class="l" for="dcDFolder">Folder</label><select class="form-control" id="dcDFolder">' + folderOptions(d.folderId) + '</select></div><div class="full"><label class="l" for="dcDNote">Catatan</label><input class="form-control" id="dcDNote" value="' + esc(d.notes) + '"></div>' +
            '<div class="full"><label class="l" for="dcDExp">Tanggal berlaku sampai</label><input type="date" class="form-control" id="dcDExp" value="' + esc(d.expires) + '"></div></div><div id="dcErr"></div><div class="dc-mf"><button type="button" class="dc-btn" data-act="close">Batal</button><button type="submit" class="dc-btn pri">Simpan</button></div></form>');
    }
    function saveDoc(form) {
        var id = form.dataset.id, name = $('dcDName').value.trim().replace(/[\\/:*?"<>|]/g, '-'); if (!name) { $('dcErr').innerHTML = '<div class="dc-msg">Nama berkas tidak boleh kosong.</div>'; return; }
        var docs = DOCS(), i = docs.findIndex(function (x) { return x.id === id; }); if (i < 0) return;
        docs[i].name = name + '.' + extOf(docs[i].name); docs[i].folderId = $('dcDFolder').value; docs[i].notes = $('dcDNote').value.trim(); docs[i].expires = $('dcDExp').value || '';
        put('mc_documents', docs); closeModal(); render(); toast('Info berkas diperbarui.');
    }
    function confirmBox(title, msg, act, id) {
        modal(mh(title) + '<p style="margin:0;font-size:.88rem;line-height:1.55">' + esc(msg) + '</p><div class="dc-mf"><button class="dc-btn" data-act="close">Batal</button><button class="dc-btn dng" data-act="' + act + '" data-id="' + esc(id) + '">Hapus</button></div>');
    }
    function viewDoc(id) {
        var d = DOCS().filter(function (x) { return x.id === id; })[0]; if (!d) return; var t = typeOf(d.name)[3];
        modal(mh(d.name, bytes(d.size) + ' · ' + when(d.uploaded_at)) + '<div class="dc-pv">' + (t === 'PDF' ? '<iframe src="' + esc(d.url) + '" title="' + esc(d.name) + '"></iframe>' : '<img src="' + esc(d.url) + '" alt="' + esc(d.name) + '">') + '</div><div class="dc-mf"><a class="dc-btn" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> Buka di tab baru</a><button class="dc-btn pri" data-act="dl" data-id="' + esc(d.id) + '"><i class="fa-solid fa-download"></i> Unduh</button></div>', true);
    }
    function download(id) {
        var d = DOCS().filter(function (x) { return x.id === id; })[0]; if (!d) return;
        var a = document.createElement('a'); a.href = d.url; a.download = d.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    }

    /* ---------- Event ---------- */
    var handlers = {
        click: function (e) {
            var t = e.target.closest('[data-act]'); if (!t) return; var a = t.dataset.act, id = t.dataset.id;
            if ((a === 'folder') && e.target.closest('.dc-ib')) return;
            switch (a) {
                case 'close': closeModal(); break;
                case 'folder': S.folder = id; render(); break;
                case 'folder-new': e.stopPropagation(); folderModal(id); break;
                case 'folder-edit': e.stopPropagation(); folderModal('', id); break;
                case 'folder-del-ask': e.stopPropagation(); var f = folderById(id), n = Object.keys(descendants(id)).length - 1, c = DOCS().filter(function (d) { return descendants(id)[d.folderId]; }).length;
                    confirmBox('Hapus folder?', 'Folder "' + (f ? f.name : '') + '"' + (n ? ', ' + n + ' subfolder,' : '') + ' dan ' + c + ' berkas di dalamnya akan dihapus dari daftar. Berkas fisik di server tidak ikut terhapus.', 'folder-del', id); break;
                case 'folder-del': delFolder(id); break;
                case 'up-open': if (t.id === 'dcDrop' && e.target.closest('label')) break; uploadModal(); break;
                case 'pend-rm': S.pending.splice(+t.dataset.i, 1); paintPending(); break;
                case 'view': viewDoc(id); break;
                case 'dl': download(id); break;
                case 'doc-edit': docModal(id); break;
                case 'doc-del-ask': var d = DOCS().filter(function (x) { return x.id === id; })[0]; confirmBox('Hapus berkas?', '"' + (d ? d.name : '') + '" akan dihapus dari daftar. Berkas fisik di server tidak ikut terhapus.', 'doc-del', id); break;
                case 'doc-del': put('mc_documents', DOCS().filter(function (x) { return x.id !== id; })); closeModal(); render(); toast('Berkas dihapus dari daftar.'); break;
            }
        },
        change: function (e) {
            var t = e.target;
            if (t.id === 'dcScope') { S.scope = t.value; render(); } else if (t.id === 'dcType') { S.type = t.value; paintList(); } else if (t.id === 'dcSort') { S.sort = t.value; paintList(); }
            else if (t.id === 'dcUpFile') { var bad = addPending(t.files); t.value = ''; paintPending(); $('dcErr').innerHTML = bad.length ? '<div class="dc-msg">Tidak dapat ditambahkan: ' + esc(bad.join('; ')) + '</div>' : ''; }
        },
        input: function (e) { if (e.target.id === 'dcQ') { S.q = e.target.value; paintList(); } },
        submit: function (e) { e.preventDefault(); var f = e.target; if (f.id === 'dcFolderForm') saveFolder(f); else if (f.id === 'dcUpForm') doUpload(f); else if (f.id === 'dcDocForm') saveDoc(f); },
        dragover: function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); var z = e.target.closest('.dc-drop'); if (z) z.classList.add('over'); } },
        dragleave: function (e) { var z = e.target.closest('.dc-drop'); if (z) z.classList.remove('over'); },
        drop: function (e) {
            if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return; e.preventDefault(); document.querySelectorAll('.dc-drop.over').forEach(function (z) { z.classList.remove('over'); });
            if ($('dcOv') && $('dcUpForm')) { var bad = addPending(e.dataTransfer.files); paintPending(); $('dcErr').innerHTML = bad.length ? '<div class="dc-msg">Tidak dapat ditambahkan: ' + esc(bad.join('; ')) + '</div>' : ''; }
            else uploadModal(e.dataTransfer.files);
        }
    };

    window.initDocumentsView = render;
    window.renderDocumentsTable = render;
    window.renderFoldersList = render;
    document.addEventListener('click', function (e) { var n = e.target.closest && e.target.closest('.nav-item'); if (n && n.getAttribute('data-target') === 'documents-view') setTimeout(render, 0); });
    document.addEventListener('DOMContentLoaded', render);
    if (document.readyState !== 'loading') render();
})();
