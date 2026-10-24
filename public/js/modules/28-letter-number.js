// @2026-Alifiandra
/* =====================================================================
 * 28-letter-number.js  —  Administrasi > Nomor Surat
 *
 * Satu halaman untuk: membuat nomor surat (aman dari nomor ganda, dihitung
 * server), riwayat nomor dengan filter, arsip dokumen per nomor, dan
 * pengaturan format/jenis surat. API: /api/letter-numbers/*.
 * Dirender ke #letter-number-module-root.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcLetters) return;
    window.__mcLetters = true;

    var API = '/api/letter-numbers';
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var ymd = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var csrf = function () { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.getAttribute('content') : ''; };

    var ST = { WAIT: 'MENUNGGU DOKUMEN', UP: 'DOKUMEN TERUPLOAD', VOID: 'BATAL' };
    var ST_LABEL = {}; ST_LABEL[ST.WAIT] = ['Menunggu dokumen', 'a']; ST_LABEL[ST.UP] = ['Dokumen lengkap', 'g']; ST_LABEL[ST.VOID] = ['Batal', 'r'];
    var MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    var ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp', MAX = 10 * 1024 * 1024;
    var TOKENS = [['{NO}', 'nomor urut'], ['{COMPANY}', 'kode perusahaan'], ['{TYPE}', 'kode jenis'], ['{MONTH}', 'bulan'], ['{YEAR}', 'tahun']];

    var S = { settings: null, records: [], last: null, q: '', type: '', status: '', from: '', to: '', busy: false, built: false, loadErr: '' };

    async function req(url, opt) {
        opt = opt || {}; opt.credentials = 'same-origin';
        opt.headers = Object.assign({ 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf(), 'X-Requested-With': 'XMLHttpRequest' }, opt.headers || {});
        var r = await fetch(url, opt), d = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(d.message || (d.errors ? Object.values(d.errors)[0][0] : 'HTTP ' + r.status));
        return d;
    }
    function role() { try { return String((JSON.parse(localStorage.getItem('mc_currentUser') || '{}').role) || '').toLowerCase(); } catch (e) { return ''; } }
    var canSettings = function () { return ['owner', 'superadmin', 'admin'].indexOf(role()) >= 0; };
    var canManage = function () { return ['owner', 'superadmin', 'admin', 'supervisor'].indexOf(role()) >= 0; };
    var typeName = function (c) { var t = ((S.settings && S.settings.letter_types) || []).filter(function (x) { return x.code === c; })[0]; return t ? t.name : ''; };
    var day = function (v) { return String(v || '').slice(0, 10); };
    var dlabel = function (v) { var d = new Date(day(v) + 'T00:00:00'); return isNaN(d) ? '-' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); };

    /* ---------- Gaya ---------- */
    function style() {
        if ($('ln-style')) return; var st = document.createElement('style'); st.id = 'ln-style';
        st.textContent = [
            '.ln{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#6366f1);display:grid;gap:16px}.ln *{box-sizing:border-box}',
            '.ln-head{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border:1px solid var(--bd);border-radius:16px;padding:16px 20px;background:linear-gradient(135deg,rgba(251,191,36,.16),rgba(251,191,36,.02))}',
            '.ln-head .ic{width:44px;height:44px;border-radius:12px;background:#f59e0b;color:#fff;display:grid;place-items:center;font-size:1.15rem;flex:none}.ln-head h2{margin:0;font-size:1.18rem}.ln-head p{margin:3px 0 0;color:var(--mut);font-size:.83rem}.ln-head .act{margin-left:auto;display:flex;gap:8px}',
            '.ln-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.ln-kpi{border:1px solid var(--bd);border-radius:14px;padding:12px 15px}.ln-kpi .t{font-size:.72rem;color:var(--mut);font-weight:600}.ln-kpi .v{font-size:1.4rem;font-weight:800;margin-top:2px}.ln-kpi.warn .v{color:#f59e0b}',
            '.ln-main{display:grid;grid-template-columns:minmax(300px,390px) minmax(0,1fr);gap:16px;align-items:start}@media(max-width:1000px){.ln-main{grid-template-columns:1fr}}',
            '.ln-card{border:1px solid var(--bd);border-radius:16px;padding:16px 18px;min-width:0}.ln-card h3{margin:0 0 4px;font-size:.96rem}.ln-card .sub{margin:0 0 12px;color:var(--mut);font-size:.8rem;line-height:1.45}',
            '.ln .form-control,.ln-ov .form-control{width:100%}.ln label.l,.ln-ov label.l{display:block;font-size:.74rem;font-weight:700;margin:0 0 4px}.ln small.h,.ln-ov small.h{display:block;color:var(--mut);font-size:.72rem;line-height:1.4;margin-top:3px}.ln-row{display:grid;gap:12px}',
            '.ln-prev{border:1px dashed var(--bd);border-radius:12px;padding:12px 14px;margin:2px 0}.ln-prev .t{font-size:.7rem;color:var(--mut);text-transform:uppercase;font-weight:700;letter-spacing:.04em}.ln-prev .n{font-size:1.35rem;font-weight:800;margin-top:4px;word-break:break-all;font-variant-numeric:tabular-nums}',
            '.ln-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.8rem;padding:8px 13px;border-radius:10px;cursor:pointer;white-space:nowrap}.ln-btn:hover{border-color:var(--pri)}.ln-btn.pri{background:var(--pri);border-color:var(--pri);color:#fff}.ln-btn.dng{color:#f87171}.ln-btn.sm{padding:5px 9px;font-size:.75rem}.ln-btn.full{width:100%;justify-content:center;padding:11px}.ln-btn:disabled{opacity:.55;cursor:not-allowed}',
            '.ln-result{border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.08);border-radius:14px;padding:14px 16px}.ln-result .t{font-size:.7rem;color:#34d399;text-transform:uppercase;font-weight:800}.ln-result .n{font-size:1.4rem;font-weight:800;margin:4px 0;word-break:break-all}.ln-result .m{font-size:.78rem;color:var(--mut)}',
            '.ln-drop{border:2px dashed var(--bd);border-radius:12px;padding:14px;text-align:center;color:var(--mut);font-size:.82rem;margin-top:12px;cursor:pointer}.ln-drop.over,.ln-drop:hover{border-color:#f59e0b;background:rgba(245,158,11,.07);color:inherit}',
            '.ln-files{margin-top:10px}.ln-file{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--bd);font-size:.8rem}.ln-file span{flex:1;min-width:140px;overflow-wrap:anywhere}',
            '.ln-tool{display:grid;grid-template-columns:minmax(180px,2fr) repeat(4,minmax(110px,1fr)) auto;gap:8px;align-items:end;margin-bottom:10px}@media(max-width:1200px){.ln-tool{grid-template-columns:1fr 1fr 1fr}}@media(max-width:640px){.ln-tool{grid-template-columns:1fr 1fr}}',
            '.ln-table{width:100%;border-collapse:collapse;font-size:.84rem}.ln-table th{text-align:left;font-size:.72rem;color:var(--mut);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--bd);white-space:nowrap}.ln-table td{padding:10px;border-bottom:1px solid var(--bd);vertical-align:top}.ln-wrap{overflow-x:auto}.ln-table tr.void td{opacity:.55}.ln-table tr.void .no{text-decoration:line-through}',
            '.ln-no{font-weight:800;font-variant-numeric:tabular-nums;cursor:pointer}.ln-no:hover{color:var(--pri)}.ln-sub{font-size:.72rem;color:var(--mut)}',
            '.ln-b{display:inline-block;border-radius:99px;font-size:.68rem;font-weight:800;padding:2px 9px;white-space:nowrap}.ln-b.g{background:rgba(16,185,129,.16);color:#34d399}.ln-b.a{background:rgba(245,158,11,.16);color:#fbbf24}.ln-b.r{background:rgba(239,68,68,.16);color:#f87171}',
            '.ln-empty{text-align:center;color:var(--mut);padding:30px 12px;font-size:.86rem;line-height:1.6}.ln-empty i{display:block;font-size:1.8rem;margin-bottom:8px;opacity:.6}.ln-msg{font-size:.8rem;line-height:1.5;border-radius:10px;padding:8px 11px;border:1px solid rgba(248,113,113,.5);background:rgba(239,68,68,.08);color:#f87171;margin-top:10px}.ln-note{font-size:.78rem;line-height:1.5;border-radius:10px;padding:8px 11px;border:1px solid rgba(251,191,36,.45);background:rgba(245,158,11,.08);color:#fbbf24}',
            '.ln-ov{position:fixed;inset:0;background:rgba(2,6,23,.62);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow-y:auto;--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#6366f1)}',
            '.ln-modal{background:var(--mc-card-bg,#1e293b);color:var(--mc-text,inherit);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:560px;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.4)}.ln-modal.wide{max-width:760px}.ln-mh{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.ln-mh h3{margin:0;font-size:1.05rem}.ln-mh .x{margin-left:auto}.ln-mf{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px}',
            '.ln-f{display:grid;grid-template-columns:1fr 1fr;gap:11px}.ln-f .full{grid-column:1/-1}@media(max-width:560px){.ln-f{grid-template-columns:1fr}}.ln-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.ln-chip{border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-size:.72rem;font-weight:700;border-radius:99px;padding:3px 10px;cursor:pointer}.ln-chip:hover{border-color:var(--pri)}',
            '.ln-types{width:100%;border-collapse:collapse;font-size:.84rem;margin-top:6px}.ln-types td{padding:4px 4px 4px 0}.ln-types th{text-align:left;font-size:.72rem;color:var(--mut);padding:4px 4px 4px 0}',
            '.ln-toast{position:fixed;right:18px;bottom:18px;z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:11px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:min(420px,90vw)}.ln-toast.err{border-left-color:#ef4444}'
        ].join('\n'); document.head.appendChild(st);
    }
    function toast(m, err) { document.querySelectorAll('.ln-toast').forEach(function (o) { o.remove(); }); var t = document.createElement('div'); t.className = 'ln-toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, err ? 6000 : 3000); }
    function modal(html, wide) {
        closeModal(); var ov = document.createElement('div'); ov.className = 'ln-ov ln'; ov.id = 'lnOv';
        ov.innerHTML = '<div class="ln-modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
        ov.addEventListener('focusout', function (e) { if (e.target.id === 'lnSFmt') S.fmtSel = [e.target.selectionStart, e.target.selectionEnd]; }); ov.addEventListener('click', onClick); ov.addEventListener('input', onInput); ov.addEventListener('change', onChange); ov.addEventListener('submit', onSubmit);
        document.body.appendChild(ov); var f = ov.querySelector('input:not([type=hidden]):not([type=file]),select,textarea'); if (f) f.focus();
    }
    function closeModal() { var o = $('lnOv'); if (o) o.remove(); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    function mh(t, sub) { return '<div class="ln-mh"><div><h3>' + esc(t) + '</h3>' + (sub ? '<div style="color:var(--mut);font-size:.78rem;margin-top:2px">' + esc(sub) + '</div>' : '') + '</div><button type="button" class="ln-btn sm x" data-act="close">Tutup</button></div>'; }

    /* ---------- Muat data ---------- */
    async function load() {
        try {
            var r = await Promise.all([req(API + '/settings'), req(API + '/records')]);
            S.settings = r[0].data; S.records = Array.isArray(r[1].data) ? r[1].data : []; S.loadErr = '';
        } catch (e) { S.loadErr = e.message; }
        render();
    }

    /* ---------- Render ---------- */
    function build() {
        var root = $('letter-number-module-root'); if (!root) return null; if (S.built) return root;
        style(); S.built = true; root.className = 'ln';
        root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange); root.addEventListener('submit', onSubmit);
        root.addEventListener('dragover', function (e) { var z = e.target.closest('.ln-drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
        root.addEventListener('dragleave', function (e) { var z = e.target.closest('.ln-drop'); if (z) z.classList.remove('over'); });
        root.addEventListener('drop', function (e) { var z = e.target.closest('.ln-drop'); if (!z) return; e.preventDefault(); z.classList.remove('over'); uploadFiles(+z.dataset.rec, e.dataTransfer.files); });
        return root;
    }
    function render() {
        var root = build(); if (!root) return;
        if (S.loadErr && !S.settings) { root.innerHTML = '<div class="ln-card"><div class="ln-empty"><i class="fa-solid fa-triangle-exclamation"></i>Nomor Surat belum dapat dimuat: ' + esc(S.loadErr) + '<br><button class="ln-btn" style="margin-top:12px" data-act="reload">Coba lagi</button></div></div>'; return; }
        if (!S.settings) { root.innerHTML = '<div class="ln-card"><div class="ln-empty"><i class="fa-solid fa-spinner fa-spin"></i>Memuat...</div></div>'; return; }
        var year = String(new Date().getFullYear()), recs = S.records;
        var thisYear = recs.filter(function (r) { return day(r.letter_date).slice(0, 4) === year; }).length, wait = recs.filter(function (r) { return r.status === ST.WAIT; }).length, vd = recs.filter(function (r) { return r.status === ST.VOID; }).length;
        var keepType = $('lnType') ? $('lnType').value : '', keepDate = $('lnDate') ? $('lnDate').value : ymd(), keepSub = $('lnSubject') ? $('lnSubject').value : '';
        root.innerHTML = '<div class="ln-head"><div class="ic"><i class="fa-solid fa-file-signature"></i></div><div><h2>Nomor Surat</h2><p>Nomor otomatis per jenis surat, aman dari nomor ganda, lengkap dengan riwayat dan arsip dokumen.</p></div>' +
            '<div class="act">' + (canSettings() ? '<button class="ln-btn" data-act="settings"><i class="fa-solid fa-gear"></i> Pengaturan</button>' : '') + '</div></div>' +
            '<div class="ln-kpis"><div class="ln-kpi"><div class="t">Nomor tahun ' + year + '</div><div class="v">' + thisYear + '</div></div><div class="ln-kpi"><div class="t">Total nomor</div><div class="v">' + recs.length + '</div></div><div class="ln-kpi' + (wait ? ' warn' : '') + '"><div class="t">Menunggu dokumen</div><div class="v">' + wait + '</div></div><div class="ln-kpi"><div class="t">Dibatalkan</div><div class="v">' + vd + '</div></div></div>' +
            '<div class="ln-main"><div class="ln-row"><div class="ln-card"><h3>Buat Nomor Surat</h3><p class="sub">Pilih jenis surat, nomor langsung diterbitkan berurutan.</p><form id="lnCreate" class="ln-row">' +
            '<div><label class="l" for="lnType">Jenis surat</label><select class="form-control" id="lnType">' + S.settings.letter_types.map(function (t) { return '<option value="' + esc(t.code) + '"' + (t.code === keepType ? ' selected' : '') + '>' + esc(t.code) + ' — ' + esc(t.name) + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="l" for="lnDate">Tanggal surat</label><input type="date" class="form-control" id="lnDate" value="' + esc(keepDate) + '"></div>' +
            '<div><label class="l" for="lnSubject">Perihal (opsional)</label><input class="form-control" id="lnSubject" maxlength="255" value="' + esc(keepSub) + '" placeholder="Isi singkat surat"></div>' +
            '<div class="ln-prev"><div class="t">Nomor berikutnya</div><div class="n" id="lnPreview">...</div></div><div id="lnErr"></div>' +
            '<button type="submit" class="ln-btn pri full" id="lnGo"><i class="fa-solid fa-plus"></i> Buat Nomor</button></form></div><div id="lnLast">' + lastHtml() + '</div></div>' +
            '<div class="ln-card"><h3>Riwayat Nomor Surat</h3><p class="sub">Nomor yang sudah terbit tidak dapat dihapus. Bila salah, tandai Batal agar urutan tetap tercatat.</p>' +
            '<div class="ln-tool"><div><label class="l" for="lnQ">Cari</label><input class="form-control" id="lnQ" type="search" placeholder="Nomor, perihal, jenis..." value="' + esc(S.q) + '"></div>' +
            '<div><label class="l" for="lnFType">Jenis</label><select class="form-control" id="lnFType"><option value="">Semua</option>' + S.settings.letter_types.map(function (t) { return '<option value="' + esc(t.code) + '"' + (S.type === t.code ? ' selected' : '') + '>' + esc(t.code) + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="l" for="lnFStatus">Status</label><select class="form-control" id="lnFStatus"><option value="">Semua</option>' + Object.keys(ST_LABEL).map(function (k) { return '<option value="' + k + '"' + (S.status === k ? ' selected' : '') + '>' + ST_LABEL[k][0] + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="l" for="lnFrom">Dari</label><input type="date" class="form-control" id="lnFrom" value="' + esc(S.from) + '"></div><div><label class="l" for="lnTo">Sampai</label><input type="date" class="form-control" id="lnTo" value="' + esc(S.to) + '"></div><button class="ln-btn" data-act="reset"><i class="fa-solid fa-rotate-left"></i> Reset</button></div><div id="lnList"></div></div></div>';
        paintList(); refreshPreview();
        if (document.activeElement && document.activeElement.id === 'lnQ') { var q = $('lnQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
    function lastHtml() {
        var l = S.last; if (!l) return '';
        var rec = S.records.filter(function (r) { return r.id === l.record_id; })[0], docs = (rec && rec.documents) || [];
        return '<div class="ln-result"><div class="t"><i class="fa-solid fa-circle-check"></i> Nomor terakhir dibuat</div><div class="n">' + esc(l.number) + '</div><div class="m">Jenis ' + esc(l.letter_type) + ' &middot; urutan ' + esc(l.sequence) + ' &middot; tahun ' + esc(l.year) + '</div>' +
            '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="ln-btn sm" data-act="copy" data-v="' + esc(l.number) + '"><i class="fa-solid fa-copy"></i> Salin nomor</button></div>' +
            '<div class="ln-drop" data-rec="' + l.record_id + '" data-act="pick" data-id="' + l.record_id + '"><i class="fa-solid fa-paperclip"></i> Seret surat &amp; lampiran ke sini atau klik untuk memilih</div>' +
            '<div class="ln-files">' + docs.map(function (d) { return fileRow(d, false); }).join('') + '</div></div>';
    }
    function fileRow(d, mgr) {
        var id = encodeURIComponent(d.id);
        return '<div class="ln-file"><i class="fa-solid fa-paperclip"></i><span>' + esc(d.file_name || 'File') + '</span><a class="ln-btn sm" target="_blank" rel="noopener" href="' + API + '/documents/' + id + '/preview"><i class="fa-solid fa-eye"></i> Lihat</a><a class="ln-btn sm" href="' + API + '/documents/' + id + '/download"><i class="fa-solid fa-download"></i></a>' +
            (canManage() ? '<button class="ln-btn sm dng" data-act="doc-del-ask" data-id="' + d.id + '" aria-label="Hapus dokumen"><i class="fa-solid fa-trash"></i></button>' : '') + '</div>';
    }
    function filtered() {
        var q = S.q.trim().toLowerCase();
        return S.records.filter(function (r) {
            if (S.type && r.letter_type !== S.type) return false; if (S.status && r.status !== S.status) return false;
            var d = day(r.letter_date); if (S.from && d < S.from) return false; if (S.to && d > S.to) return false;
            return !q || [r.letter_number, r.letter_type, typeName(r.letter_type), r.subject, d].join(' ').toLowerCase().indexOf(q) >= 0;
        });
    }
    function paintList() {
        var box = $('lnList'); if (!box) return; var list = filtered();
        if (!list.length) { box.innerHTML = '<div class="ln-empty"><i class="fa-regular fa-file-lines"></i>' + (S.records.length ? 'Tidak ada nomor yang cocok dengan filter.' : 'Belum ada nomor surat. Buat nomor pertama di sebelah kiri.') + '</div>'; return; }
        box.innerHTML = '<div class="ln-wrap"><table class="ln-table"><thead><tr><th>Nomor</th><th>Jenis</th><th>Tanggal</th><th>Perihal</th><th>Status</th><th>Dokumen</th><th></th></tr></thead><tbody>' + list.map(function (r) {
            var docs = r.documents || [], s = ST_LABEL[r.status] || [r.status, 'a'];
            return '<tr class="' + (r.status === ST.VOID ? 'void' : '') + '"><td><span class="ln-no no" data-act="copy" data-v="' + esc(r.letter_number) + '" title="Klik untuk menyalin">' + esc(r.letter_number) + '</span></td><td>' + esc(r.letter_type) + '<div class="ln-sub">' + esc(typeName(r.letter_type)) + '</div></td><td style="white-space:nowrap">' + dlabel(r.letter_date) + '</td><td>' + esc(r.subject || '-') + '</td>' +
                '<td><span class="ln-b ' + s[1] + '">' + esc(s[0]) + '</span></td><td style="min-width:200px">' + (docs.length ? docs.map(function (d) { return fileRow(d); }).join('') : '<span class="ln-sub">Belum ada file</span>') + '</td>' +
                '<td style="white-space:nowrap;text-align:right">' + (r.status !== ST.VOID ? '<button class="ln-btn sm" data-act="pick" data-id="' + r.id + '" title="Unggah dokumen"><i class="fa-solid fa-upload"></i></button> ' : '') + (canManage() ? '<button class="ln-btn sm" data-act="edit" data-id="' + r.id + '" title="Ubah perihal / status"><i class="fa-solid fa-pen"></i></button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="ln-sub" style="margin-top:8px">' + list.length + ' dari ' + S.records.length + ' nomor (maks. 1000 terbaru)</div>';
    }

    var prevTimer;
    function refreshPreview() {
        clearTimeout(prevTimer); prevTimer = setTimeout(async function () {
            var el = $('lnPreview'), t = $('lnType'), d = $('lnDate'); if (!el || !t || !t.value) return;
            try { var r = await req(API + '/preview?letter_type=' + encodeURIComponent(t.value) + '&date=' + encodeURIComponent(d.value || ymd())); if ($('lnPreview')) $('lnPreview').textContent = r.data.number; }
            catch (e) { if ($('lnPreview')) $('lnPreview').textContent = '-'; }
        }, 150);
    }

    /* ---------- Aksi ---------- */
    async function create() {
        if (S.busy) return; var err = $('lnErr'), btn = $('lnGo'); err.innerHTML = '';
        S.busy = true; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuat...';
        try {
            var r = await req(API + '/next', { method: 'POST', body: JSON.stringify({ letter_type: $('lnType').value, date: $('lnDate').value || null, subject: $('lnSubject').value.trim() || null }) });
            S.last = r.data; $('lnSubject').value = ''; await reloadRecords(); toast('Nomor ' + r.data.number + ' berhasil dibuat. Silakan unggah dokumennya.');
        } catch (e) { err.innerHTML = '<div class="ln-msg">' + esc(e.message) + '</div>'; }
        finally { S.busy = false; var b = $('lnGo'); if (b) { b.disabled = false; b.innerHTML = '<i class="fa-solid fa-plus"></i> Buat Nomor'; } }
    }
    async function reloadRecords() { var r = await req(API + '/records'); S.records = Array.isArray(r.data) ? r.data : []; render(); }
    function readData(file) {
        return new Promise(function (res, rej) { var fr = new FileReader(); fr.onerror = function () { rej(new Error('Gagal membaca file')); }; var ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [])[1];
            fr.onload = function () { res(String(fr.result).replace(/^data:[^;,]*;base64,/, 'data:' + (MIME[(ext || '').toLowerCase()] || file.type) + ';base64,')); }; fr.readAsDataURL(file); });
    }
    async function uploadFiles(recId, files) {
        files = Array.prototype.slice.call(files || []); if (!files.length || !recId) return;
        var ok = 0, fails = [];
        for (var i = 0; i < files.length; i++) {
            var f = files[i], ext = ((/\.([a-z0-9]+)$/i.exec(f.name) || [])[1] || '').toLowerCase();
            if (!MIME[ext]) { fails.push(f.name + ' (format tidak didukung)'); continue; } if (f.size > MAX) { fails.push(f.name + ' (lebih dari 10 MB)'); continue; } if (!f.size) { fails.push(f.name + ' (kosong)'); continue; }
            toast('Mengunggah ' + (i + 1) + ' / ' + files.length + ': ' + f.name);
            try { await req(API + '/records/' + recId + '/documents', { method: 'POST', body: JSON.stringify({ data_url: await readData(f), filename: f.name }) }); ok++; } catch (e) { fails.push(f.name + ': ' + e.message); }
        }
        await reloadRecords();
        toast((ok ? ok + ' file berhasil diunggah. ' : '') + (fails.length ? 'Gagal: ' + fails.join('; ') : ''), fails.length > 0);
    }
    function pick(recId) {
        var inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = ACCEPT; inp.onchange = function () { uploadFiles(recId, inp.files); }; inp.click();
    }
    function editModal(id) {
        var r = S.records.filter(function (x) { return x.id === id; })[0]; if (!r) return;
        modal(mh('Ubah Nomor Surat', r.letter_number) + '<form id="lnEditForm" data-id="' + id + '"><div class="ln-f"><div class="full"><label class="l" for="lnESub">Perihal</label><input class="form-control" id="lnESub" maxlength="255" value="' + esc(r.subject) + '"></div>' +
            '<div class="full"><label class="l" for="lnESt">Status</label><select class="form-control" id="lnESt">' + Object.keys(ST_LABEL).map(function (k) { return '<option value="' + k + '"' + (r.status === k ? ' selected' : '') + '>' + ST_LABEL[k][0] + '</option>'; }).join('') + '</select>' +
            '<small class="h">Pilih Batal bila nomor tidak jadi dipakai. Nomor tetap tercatat, tidak dipakai ulang, dan tidak dapat menerima dokumen baru.</small></div></div><div id="lnEErr"></div><div class="ln-mf"><button type="button" class="ln-btn" data-act="close">Batal</button><button type="submit" class="ln-btn pri">Simpan</button></div></form>', false);
    }
    function confirmDel(id) { modal(mh('Hapus dokumen?') + '<p style="margin:0;font-size:.88rem;line-height:1.55">Berkas akan dihapus permanen dari server. Nomor suratnya tetap ada.</p><div class="ln-mf"><button class="ln-btn" data-act="close">Batal</button><button class="ln-btn dng" data-act="doc-del" data-id="' + id + '">Hapus</button></div>', false); }
    function copy(v) { var done = function () { toast('Disalin: ' + v); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { toast('Gagal menyalin.', true); }); else { var t = document.createElement('textarea'); t.value = v; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Gagal menyalin.', true); } t.remove(); } }

    /* ---------- Pengaturan ---------- */
    var draft = null;
    function sampleNo(s) {
        var now = new Date(), m = s.month_format === 'numeric' ? pad(now.getMonth() + 1) : (s.month_format === 'long' ? now.toLocaleDateString('id-ID', { month: 'long' }).toLowerCase() : now.toLocaleDateString('id-ID', { month: 'short' }).replace('.', '').toLowerCase());
        var t = s.letter_types[0] ? s.letter_types[0].code : 'SK';
        return String(s.format || '').replace(/\{NO\}/g, String(1).padStart(+s.digits || 4, '0')).replace(/\{COMPANY\}/g, s.company_code || '').replace(/\{TYPE\}/g, t).replace(/\{MONTH\}/g, m).replace(/\{YEAR\}/g, String(now.getFullYear()));
    }
    function settingsModal() {
        draft = JSON.parse(JSON.stringify(S.settings)); S.fmtSel = null;
        modal(mh('Pengaturan Nomor Surat', 'Perubahan hanya berlaku untuk nomor berikutnya') + '<form id="lnSetForm"><div class="ln-f">' +
            '<div><label class="l" for="lnSCo">Kode perusahaan</label><input class="form-control" id="lnSCo" maxlength="20" value="' + esc(draft.company_code) + '"></div><div><label class="l" for="lnSDg">Jumlah digit nomor urut</label><input type="number" min="1" max="10" class="form-control" id="lnSDg" value="' + esc(draft.digits) + '"></div>' +
            '<div class="full"><label class="l" for="lnSFmt">Format nomor</label><input class="form-control" id="lnSFmt" value="' + esc(draft.format) + '"><div class="ln-chips">' + TOKENS.map(function (t) { return '<button type="button" class="ln-chip" data-act="token" data-v="' + t[0] + '" title="' + t[1] + '">' + t[0] + '</button>'; }).join('') + '</div><small class="h">Wajib memuat {NO}. Klik token untuk menyisipkan.</small></div>' +
            '<div><label class="l" for="lnSMo">Format bulan</label><select class="form-control" id="lnSMo"><option value="short"' + (draft.month_format === 'short' ? ' selected' : '') + '>Singkat (okt)</option><option value="numeric"' + (draft.month_format === 'numeric' ? ' selected' : '') + '>Angka (10)</option><option value="long"' + (draft.month_format === 'long' ? ' selected' : '') + '>Lengkap (oktober)</option></select></div>' +
            '<div><label class="l" for="lnSRs">Reset nomor urut</label><select class="form-control" id="lnSRs"><option value="yearly"' + (draft.reset_mode === 'yearly' ? ' selected' : '') + '>Setiap tahun</option><option value="never"' + (draft.reset_mode === 'never' ? ' selected' : '') + '>Tidak pernah</option></select></div>' +
            '<div class="full"><div class="ln-prev"><div class="t">Contoh hasil</div><div class="n" id="lnSEx">' + esc(sampleNo(draft)) + '</div></div></div></div>' +
            '<div style="margin-top:14px"><b style="font-size:.84rem">Jenis surat</b><div id="lnTypes"></div><button type="button" class="ln-btn sm" style="margin-top:8px" data-act="type-add"><i class="fa-solid fa-plus"></i> Tambah jenis</button></div><div id="lnSErr"></div>' +
            '<div class="ln-mf"><button type="button" class="ln-btn" data-act="close">Batal</button><button type="submit" class="ln-btn pri">Simpan Pengaturan</button></div></form>', true);
        paintTypes();
    }
    function paintTypes() { var b = $('lnTypes'); if (!b) return; b.innerHTML = '<table class="ln-types"><thead><tr><th>Kode</th><th>Nama</th><th></th></tr></thead><tbody>' + draft.letter_types.map(function (t, i) { return '<tr><td style="width:130px"><input class="form-control" data-tc="' + i + '" value="' + esc(t.code) + '" maxlength="20"></td><td><input class="form-control" data-tn="' + i + '" value="' + esc(t.name) + '" maxlength="100"></td><td style="width:40px"><button type="button" class="ln-btn sm dng" data-act="type-del" data-i="' + i + '" aria-label="Hapus jenis"><i class="fa-solid fa-trash"></i></button></td></tr>'; }).join('') + '</tbody></table>'; }
    function syncDraft() {
        draft.company_code = $('lnSCo').value.toUpperCase(); draft.digits = +$('lnSDg').value || 4; draft.format = $('lnSFmt').value; draft.month_format = $('lnSMo').value; draft.reset_mode = $('lnSRs').value;
        if ($('lnSEx')) $('lnSEx').textContent = sampleNo(draft);
    }
    async function saveSettings() {
        syncDraft(); var err = $('lnSErr'), fail = function (m) { err.innerHTML = '<div class="ln-msg">' + esc(m) + '</div>'; };
        if (!draft.company_code.trim()) return fail('Kode perusahaan wajib diisi.'); if (draft.format.indexOf('{NO}') < 0) return fail('Format nomor wajib memuat {NO}.');
        var codes = {}; for (var i = 0; i < draft.letter_types.length; i++) { var t = draft.letter_types[i]; t.code = String(t.code).trim().toUpperCase(); if (!t.code || !String(t.name).trim()) return fail('Kode dan nama jenis surat wajib diisi semua.'); if (codes[t.code]) return fail('Kode jenis surat "' + t.code + '" dobel.'); codes[t.code] = 1; }
        try { var r = await req(API + '/settings', { method: 'POST', body: JSON.stringify(draft) }); S.settings = r.data; closeModal(); render(); toast('Pengaturan nomor surat tersimpan.'); } catch (e) { fail(e.message); }
    }

    /* ---------- Event ---------- */
    function onClick(e) {
        var t = e.target.closest('[data-act]'); if (!t) return; var a = t.dataset.act, id = +t.dataset.id;
        switch (a) {
            case 'close': closeModal(); break; case 'reload': load(); break;
            case 'settings': settingsModal(); break;
            case 'token': var f = $('lnSFmt'), sel = S.fmtSel || [f.value.length, f.value.length], p = sel[0], q = sel[1]; f.value = f.value.slice(0, p) + t.dataset.v + f.value.slice(q); S.fmtSel = [p + t.dataset.v.length, p + t.dataset.v.length]; f.focus(); f.setSelectionRange(S.fmtSel[0], S.fmtSel[1]); syncDraft(); break;
            case 'type-add': syncTypes(); draft.letter_types.push({ code: '', name: '' }); paintTypes(); break;
            case 'type-del': syncTypes(); if (draft.letter_types.length > 1) { draft.letter_types.splice(+t.dataset.i, 1); paintTypes(); } break;
            case 'copy': copy(t.dataset.v); break;
            case 'pick': pick(id); break;
            case 'edit': editModal(id); break;
            case 'doc-del-ask': confirmDel(id); break;
            case 'doc-del': req(API + '/documents/' + id, { method: 'DELETE' }).then(function () { closeModal(); return reloadRecords(); }).then(function () { toast('Dokumen dihapus.'); }).catch(function (x) { toast(x.message, true); }); break;
            case 'reset': S.q = S.type = S.status = S.from = S.to = ''; render(); break;
        }
    }
    function syncTypes() { document.querySelectorAll('[data-tc]').forEach(function (i) { draft.letter_types[+i.dataset.tc].code = i.value; }); document.querySelectorAll('[data-tn]').forEach(function (i) { draft.letter_types[+i.dataset.tn].name = i.value; }); }
    function onInput(e) {
        var t = e.target;
        if (t.id === 'lnQ') { S.q = t.value; paintList(); } else if (t.id === 'lnSCo' || t.id === 'lnSDg' || t.id === 'lnSFmt') syncDraft();
        else if (t.dataset && t.dataset.tc != null) { draft.letter_types[+t.dataset.tc].code = t.value.toUpperCase(); t.value = t.value.toUpperCase(); } else if (t.dataset && t.dataset.tn != null) draft.letter_types[+t.dataset.tn].name = t.value;
    }
    function onChange(e) {
        var t = e.target;
        if (t.id === 'lnType' || t.id === 'lnDate') refreshPreview();
        else if (t.id === 'lnFType') { S.type = t.value; paintList(); } else if (t.id === 'lnFStatus') { S.status = t.value; paintList(); } else if (t.id === 'lnFrom') { S.from = t.value; paintList(); } else if (t.id === 'lnTo') { S.to = t.value; paintList(); }
        else if (t.id === 'lnSMo' || t.id === 'lnSRs') syncDraft();
    }
    function onSubmit(e) {
        e.preventDefault(); var f = e.target;
        if (f.id === 'lnCreate') create(); else if (f.id === 'lnSetForm') saveSettings();
        else if (f.id === 'lnEditForm') {
            var id = f.dataset.id; req(API + '/records/' + id, { method: 'PUT', body: JSON.stringify({ subject: $('lnESub').value.trim() || null, status: $('lnESt').value }) })
                .then(function () { closeModal(); return reloadRecords(); }).then(function () { toast('Nomor surat diperbarui.'); }).catch(function (x) { $('lnEErr').innerHTML = '<div class="ln-msg">' + esc(x.message) + '</div>'; });
        }
    }

    // Kompatibilitas dengan modul lama
    window.AlmaraLetterArchive = window.AlmaraLetterArchive || { render: function () { return Promise.resolve(); } };
    document.addEventListener('click', function (e) { var n = e.target.closest && e.target.closest('.nav-item'); if (n && n.getAttribute('data-target') === 'letter-number-view') setTimeout(function () { if (S.settings) reloadRecords().catch(function () { }); else load(); }, 0); });
    function init() { if ($('letter-number-module-root')) load(); else setTimeout(init, 300); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
