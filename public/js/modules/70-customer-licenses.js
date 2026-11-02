// @2026-Alifiandra
/* =====================================================================
 * 70-customer-licenses.js  —  Nasabah > Perizinan Nasabah
 *
 *  - Data izin nasabah perusahaan (PT, CV, Yayasan, dll.): beberapa izin per nasabah,
 *    masing-masing dengan nomor, tanggal terbit, tanggal berakhir, dan dokumen.
 *  - Status: Kedaluwarsa / Segera habis (≤ N hari) / Berlaku / Tanpa batas.
 *  - Pengingat jatuh tempo:
 *      1) ikon perizinan + angka di header (semua pengguna),
 *      2) popup sekali per hari saat membuka aplikasi (owner/admin/supervisor),
 *      3) peringatan di Kasir saat nasabah perusahaan dipilih.
 *  Data dari /api/customer-licenses* (tabel mc_customer_licenses).
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcCustLicenses) return;
    window.__mcCustLicenses = true;

    var VIEW_ID = 'customer-license-view', ROOT_ID = 'custLicRoot';
    var MAIN_TYPE = 'DOKUMEN_UTAMA';
    var TYPES = {
        DOKUMEN_UTAMA: 'Dokumen Legalitas Utama',
        NIB: 'NIB (Nomor Induk Berusaha)', AKTA_PENDIRIAN: 'Akta Pendirian', AKTA_PERUBAHAN: 'Akta Perubahan',
        SK_KEMENKUMHAM: 'SK Kemenkumham', IZIN_USAHA: 'Izin Usaha / SIUP', IZIN_OPERASIONAL: 'Izin Operasional',
        DOMISILI: 'Surat Keterangan Domisili', NPWP: 'NPWP Badan', LAINNYA: 'Lainnya'
    };
    var REMIND_OPTIONS = [7, 14, 30, 60, 90];
    var STATE = {
        expired: { t: 'Kedaluwarsa', c: 'bad', i: 'fa-circle-xmark' },
        soon: { t: 'Segera habis', c: 'warn', i: 'fa-hourglass-half' },
        ok: { t: 'Berlaku', c: 'ok', i: 'fa-circle-check' },
        none: { t: 'Tanpa batas', c: 'off', i: 'fa-infinity' }
    };

    var S = { built: false, rows: [], remind: 30, q: '', filter: 'all', editing: null, cust: '', loading: false, alerts: null, alertsAt: 0, posWarned: '' };

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var fmtDay = function (s) { if (!s) return '-'; var a = String(s).slice(0, 10).split('-'); return a.length === 3 ? a[2] + ' ' + M[+a[1] - 1] + ' ' + a[0] : s; };

    function user() { try { return typeof getCurrentUser === 'function' ? getCurrentUser() : null; } catch (e) { return null; } }
    function role() { var u = user(); return String((u && u.role) || '').toLowerCase(); }
    function canManage() { return ['owner', 'superadmin', 'admin', 'supervisor'].indexOf(role()) > -1; }
    function canDelete() { return ['owner', 'superadmin', 'admin'].indexOf(role()) > -1; }
    function toast(icon, title) { if (window.Swal) window.Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 2400, showConfirmButton: false }); }
    function alertBox(icon, title, text) { if (window.Swal) return window.Swal.fire({ icon: icon, title: title, text: text }); alert(title + (text ? '\n\n' + text : '')); return Promise.resolve(); }

    async function api(path, method, body) {
        var request = window.authFetch || fetch;
        var csrf = document.querySelector('meta[name="csrf-token"]');
        var res = await request('/api/' + path, {
            method: method || 'GET', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf ? csrf.content : '' },
            body: body ? JSON.stringify(body) : undefined
        });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var first = out.errors ? (Object.values(out.errors)[0] || [])[0] : '';
            throw new Error(first || out.message || 'Permintaan gagal (' + res.status + ').');
        }
        return out;
    }

    /* ---------------------------------------------------------- data nasabah */
    function customers() { try { var l = typeof getCustomers === 'function' ? getCustomers() : []; return Array.isArray(l) ? l : []; } catch (e) { return []; } }
    function isCorporate(c) {
        var raw = String((c && (c.kn != null ? c.kn : c.customer_type)) || '').trim().toLowerCase();
        return raw === '2' || raw.indexOf('perusahaan') >= 0 || raw.indexOf('corporate') >= 0;
    }
    function custInfo(id) {
        var c = customers().filter(function (x) { return String(x.id_nasabah) === String(id); })[0];
        return c ? { id: String(id), name: c.nama || id, type: c.jenis_badan_usaha || 'Perusahaan', npwp: c.npwp || '', nib: c.nib || '' }
            : { id: String(id), name: id + ' (data nasabah tidak ditemukan)', type: '', npwp: '', nib: '' };
    }
    function companies() {
        var map = {};
        customers().forEach(function (c) { if (c && isCorporate(c) && c.id_nasabah) map[c.id_nasabah] = custInfo(c.id_nasabah); });
        S.rows.forEach(function (r) { if (!map[r.customer_id]) map[r.customer_id] = custInfo(r.customer_id); });
        return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    }
    function rowsOf(id) { return S.rows.filter(function (r) { return String(r.customer_id) === String(id); }); }
    function worstState(list) {
        var order = { expired: 0, soon: 1, ok: 2, none: 3 };
        return list.reduce(function (w, r) { return w === null || order[r.state] < order[w] ? r.state : w; }, null);
    }
    function daysText(r) {
        if (r.state === 'none') return 'Tidak ada tanggal berakhir';
        if (r.days_left < 0) return 'Lewat ' + Math.abs(r.days_left) + ' hari';
        if (r.days_left === 0) return 'Berakhir hari ini';
        return r.days_left + ' hari lagi';
    }
    function badge(r) {
        var s = STATE[r.state] || STATE.none;
        return '<span class="cl-badge ' + s.c + '"><i class="fa-solid ' + s.i + '"></i> ' + s.t + '</span>';
    }

    /* ---------------------------------------------------------- gaya */
    function injectStyle() {
        if ($('cl-style')) return;
        var st = document.createElement('style'); st.id = 'cl-style';
        st.textContent = [
            '.cl{--c-bd:var(--mc-border,rgba(148,163,184,.28));--c-card:var(--mc-card-bg,#18181b);--c-tx:var(--mc-text,#f8fafc);--c-mut:var(--mc-text-muted,#94a3b8);--c-pri:var(--mc-primary,#22c55e);',
            '--c-ok:var(--mc-buy,#16a34a);--c-bad:var(--mc-danger,#ef4444);--c-warn:var(--mc-warning,#f59e0b);--c-inp:var(--mc-input-bg,rgba(148,163,184,.08));--c-r:var(--mc-radius,14px);color:var(--c-tx);display:grid;gap:16px}',
            '.cl *{box-sizing:border-box}',
            '.cl-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}',
            '.cl-head h2{margin:0;font-size:1.25rem;display:flex;gap:10px;align-items:center}.cl-head p{margin:4px 0 0;color:var(--c-mut);font-size:.85rem;max-width:720px;line-height:1.5}',
            '.cl-btn{border:1px solid var(--c-bd);background:transparent;color:var(--c-tx);padding:8px 13px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:600;font-size:.82rem;display:inline-flex;align-items:center;gap:7px;font-family:inherit}',
            '.cl-btn:hover{background:var(--c-inp)}.cl-btn[disabled]{opacity:.5;cursor:not-allowed}.cl-btn.sm{padding:5px 10px;font-size:.76rem}',
            '.cl-btn.pri{background:var(--mc-button-bg,var(--c-pri));border-color:var(--mc-button-bg,var(--c-pri));color:var(--mc-button-text,#fff)}.cl-btn.del:hover{border-color:var(--c-bad);color:var(--c-bad)}',
            '.cl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}',
            '.cl-stat{background:var(--c-card);border:1px solid var(--c-bd);border-radius:12px;padding:12px 14px;cursor:pointer;text-align:left;color:inherit;font-family:inherit}',
            '.cl-stat:hover,.cl-stat.on{border-color:var(--c-pri)}.cl-stat small{display:block;color:var(--c-mut);font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;font-weight:700}',
            '.cl-stat b{display:block;font-size:1.5rem;margin-top:2px}.cl-stat.bad b{color:var(--c-bad)}.cl-stat.warn b{color:var(--c-warn)}.cl-stat.ok b{color:var(--c-ok)}',
            '.cl-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.cl-bar .sp{flex:1}',
            '.cl-in{height:38px;background:var(--c-inp);border:1px solid var(--mc-input-border,var(--c-bd));color:var(--c-tx);border-radius:var(--mc-input-radius,10px);padding:0 10px;font:inherit;font-size:.86rem}',
            '.cl-search{min-width:240px;flex:1;max-width:380px}',
            '.cl-set{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--c-mut)}',
            '.cl-co{background:var(--c-card);border:1px solid var(--c-bd);border-radius:var(--c-r);overflow:hidden}',
            '.cl-co.bad{border-left:4px solid var(--c-bad)}.cl-co.warn{border-left:4px solid var(--c-warn)}',
            '.cl-co-h{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--c-bd)}',
            '.cl-co-h b{font-size:.98rem}.cl-co-h small{display:block;color:var(--c-mut);font-size:.75rem;margin-top:2px}.cl-co-h .sp{flex:1}',
            '.cl-t{width:100%;border-collapse:collapse;font-size:.82rem}',
            '.cl-t th{color:var(--c-mut);font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:8px 12px;border-bottom:1px solid var(--c-bd);white-space:nowrap}',
            '.cl-t td{padding:9px 12px;border-bottom:1px solid var(--c-bd);vertical-align:top}.cl-t tr:last-child td{border-bottom:0}',
            '.cl-t td small{display:block;color:var(--c-mut);font-size:.72rem}.cl-acts{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}',
            '.cl-badge{display:inline-flex;gap:5px;align-items:center;padding:2px 9px;border-radius:999px;font-size:.72rem;font-weight:700;white-space:nowrap}',
            '.cl-badge.bad{background:color-mix(in srgb,var(--c-bad) 16%,transparent);color:var(--c-bad)}.cl-badge.warn{background:color-mix(in srgb,var(--c-warn) 18%,transparent);color:var(--c-warn)}',
            '.cl-badge.ok{background:color-mix(in srgb,var(--c-ok) 15%,transparent);color:var(--c-ok)}.cl-badge.off{background:rgba(148,163,184,.15);color:var(--c-mut)}',
            '.cl-empty{text-align:center;padding:30px 16px;color:var(--c-mut);border:1px dashed var(--c-bd);border-radius:12px;line-height:1.6}',
            '.cl-none{padding:12px 16px;color:var(--c-mut);font-size:.82rem}',
            '.cl-ov{position:fixed;inset:0;background:rgba(2,6,23,.6);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px}',
            '.cl-dlg{background:var(--mc-card-bg,#1e293b);color:var(--mc-text,#f8fafc);border:1px solid var(--mc-border,#334155);border-radius:16px;width:min(560px,100%);max-height:92vh;overflow:auto;padding:20px}',
            '.cl-dlg h3{margin:0 0 4px;font-size:1.05rem}.cl-dlg>p{margin:0 0 14px;color:var(--mc-text-muted,#94a3b8);font-size:.82rem}',
            '.cl-fg{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cl-fg .full{grid-column:1/-1}@media(max-width:560px){.cl-fg{grid-template-columns:1fr}}',
            '.cl-f label{display:block;font-size:.76rem;font-weight:700;color:var(--mc-text-muted,#94a3b8);margin-bottom:5px}.cl-f .cl-in{width:100%}.cl-f textarea.cl-in{height:auto;padding:8px 10px;min-height:60px}',
            '.cl-f small{display:block;color:var(--mc-text-muted,#94a3b8);font-size:.72rem;margin-top:4px}',
            '.cl-chk{display:inline-flex;gap:6px;align-items:center;font-size:.8rem;margin-top:6px;cursor:pointer}',
            '.cl-err{margin-top:10px;padding:9px 12px;border-radius:8px;background:rgba(239,68,68,.12);color:#fca5a5;font-size:.82rem}',
            '.cl-dlg-acts{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}',
            /* ikon header & peringatan kasir */
            '.lic-bell{position:relative;margin-right:10px}.lic-bell .badge{background:#f59e0b!important;color:#111!important}.lic-bell.has-expired .badge{background:#ef4444!important;color:#fff!important}',
            '#licPosWarn{grid-column:1/-1;margin-top:10px;padding:9px 12px;border-radius:10px;font-size:.8rem;line-height:1.45;border:1px solid}',
            '#licPosWarn.bad{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.4);color:#ef4444}#licPosWarn.warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.45);color:#d97706}',
            '#licPosWarn b{display:block;margin-bottom:2px}',
            /* popup pengingat izin (gaya kartu modern, warna kontras tetap) */
            'html body .swal2-popup.lic-pop{padding:0!important;border-radius:20px!important;overflow:hidden;background:#111827!important;border:1px solid #1f2a3c!important;box-shadow:0 30px 80px -20px rgba(0,0,0,.65)!important}',
            'html body .swal2-popup.lic-pop .swal2-html-container{margin:0!important;padding:0!important;color:#e2e8f0!important;font-size:.9rem!important;text-align:left!important}',
            'html body .swal2-popup.lic-pop .swal2-actions{margin:0!important;padding:14px 22px 20px!important;justify-content:flex-end;background:#0d1320;border-top:1px solid #1f2a3c}',
            '.lp-head{display:flex;gap:14px;align-items:flex-start;padding:22px 22px 16px}',
            '.lp-ico{flex:0 0 46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.25rem}',
            '.lp-ico.x{background:rgba(239,68,68,.16);color:#f87171;box-shadow:inset 0 0 0 1px rgba(239,68,68,.35)}',
            '.lp-ico.w{background:rgba(245,158,11,.16);color:#fbbf24;box-shadow:inset 0 0 0 1px rgba(245,158,11,.35)}',
            '.lp-ico.ok{background:rgba(34,197,94,.16);color:#4ade80;box-shadow:inset 0 0 0 1px rgba(34,197,94,.35)}',
            '.lp-ttl{margin:0;color:#f8fafc!important;font-size:1.12rem;font-weight:700;line-height:1.3}',
            '.lp-sub{margin:4px 0 0!important;color:#cbd5e1!important;font-size:.86rem;line-height:1.5}',
            '.lp-chips{display:flex;gap:8px;flex-wrap:wrap;padding:0 22px 12px}',
            '.lp-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:.75rem;font-weight:600}',
            '.lp-chip.x{background:rgba(239,68,68,.15);color:#fca5a5}.lp-chip.w{background:rgba(245,158,11,.15);color:#fcd34d}',
            '.lp-list{display:flex;flex-direction:column;gap:8px;padding:0 22px 18px;max-height:46vh;overflow:auto}',
            '.lp-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;background:#1a2332;border:1px solid #243044;position:relative}',
            '.lp-item::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0}',
            '.lp-item.x::before{background:#ef4444}.lp-item.w::before{background:#f59e0b}',
            '.lp-main{flex:1;min-width:0}',
            '.lp-name{color:#f8fafc!important;font-weight:700;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.lp-doc{color:#a8b3c4!important;font-size:.78rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.lp-side{text-align:right;flex:0 0 auto}',
            '.lp-pill{display:inline-block;padding:3px 9px;border-radius:999px;font-size:.74rem;font-weight:700;white-space:nowrap}',
            '.lp-pill.x{background:rgba(239,68,68,.18);color:#fca5a5}.lp-pill.w{background:rgba(245,158,11,.18);color:#fcd34d}',
            '.lp-date{color:#a8b3c4!important;font-size:.74rem;margin-top:4px;white-space:nowrap}',
            '.lp-more{color:#a8b3c4!important;font-size:.8rem;text-align:center;padding-top:2px}',
            '@media (max-width:480px){.lp-head{padding:18px 16px 12px}.lp-chips,.lp-list{padding-left:16px;padding-right:16px}}'
        ].join('\n');
        document.head.appendChild(st);
    }

    /* ---------------------------------------------------------- halaman */
    function build() {
        var root = $(ROOT_ID); if (!root) return;
        injectStyle();
        root.innerHTML =
            '<div class="cl">' +
            '<div class="cl-head"><div><h2><i class="fa-solid fa-file-shield"></i> Perizinan Nasabah</h2>' +
            '<p>Pantau masa berlaku izin nasabah perusahaan (PT, CV, Yayasan, dll.). Masa berlaku <b>dokumen legalitas utama</b> diisi di form data nasabah (<i>Tanggal Terbit</i> &amp; <i>Berlaku Sampai</i>) dan otomatis tampil di sini. Izin lain (NIB, SK, Domisili, dll.) bisa ditambahkan bila perlu. Pengingat muncul di ikon header, popup saat membuka aplikasi, dan di Kasir.</p></div></div>' +
            '<div class="cl-stats" id="clStats"></div>' +
            '<div class="cl-bar"><input type="search" class="cl-in cl-search" id="clSearch" placeholder="Cari nama perusahaan, ID, atau nomor izin...">' +
            '<select class="cl-in" id="clFilter"><option value="all">Semua status</option><option value="expired">Kedaluwarsa</option><option value="soon">Segera habis</option><option value="ok">Berlaku</option><option value="none">Tanpa batas</option><option value="empty">Belum ada izin</option></select>' +
            '<div class="sp"></div><label class="cl-set">Ingatkan <select class="cl-in" id="clRemind"' + (['owner', 'superadmin', 'admin'].indexOf(role()) > -1 ? '' : ' disabled') + '>' +
            REMIND_OPTIONS.map(function (d) { return '<option value="' + d + '">' + d + ' hari</option>'; }).join('') + '</select> sebelum berakhir</label></div>' +
            '<div id="clList"><div class="cl-empty"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data perizinan...</div></div>' +
            '<div id="clModal"></div></div>';
        root.addEventListener('click', onClick);
        root.addEventListener('input', function (e) { if (e.target.id === 'clSearch') { S.q = e.target.value; render(); } });
        root.addEventListener('change', onChange);
        S.built = true;
    }

    function stats() {
        var cos = companies(), c = { expired: 0, soon: 0, ok: 0, none: 0, empty: 0 };
        S.rows.forEach(function (r) { c[r.state] = (c[r.state] || 0) + 1; });
        cos.forEach(function (co) { if (!rowsOf(co.id).length) c.empty++; });
        var card = function (k, cls, label, sub) { return '<button type="button" class="cl-stat ' + cls + (S.filter === k ? ' on' : '') + '" data-f="' + k + '"><small>' + label + '</small><b>' + c[k] + '</b><small style="text-transform:none;letter-spacing:0;font-weight:400">' + sub + '</small></button>'; };
        $('clStats').innerHTML = card('expired', 'bad', 'Kedaluwarsa', 'izin sudah lewat') + card('soon', 'warn', 'Segera habis', '≤ ' + S.remind + ' hari lagi') +
            card('ok', 'ok', 'Berlaku', 'izin aktif') + card('none', '', 'Tanpa batas', 'tidak ada tanggal berakhir') + card('empty', '', 'Belum ada izin', 'perusahaan tanpa data izin');
    }

    function render() {
        var box = $('clList'); if (!box) return;
        stats();
        var q = S.q.trim().toLowerCase(), f = S.filter;
        var cos = companies().filter(function (co) {
            var rows = rowsOf(co.id);
            if (f === 'empty' && rows.length) return false;
            if (f !== 'all' && f !== 'empty' && !rows.some(function (r) { return r.state === f; })) return false;
            if (!q) return true;
            var hay = (co.name + ' ' + co.id + ' ' + co.type + ' ' + rows.map(function (r) { return r.label + ' ' + (r.number || ''); }).join(' ')).toLowerCase();
            return hay.indexOf(q) >= 0;
        });
        var order = { expired: 0, soon: 1, ok: 2, none: 3 };
        cos.sort(function (a, b) {
            var wa = worstState(rowsOf(a.id)), wb = worstState(rowsOf(b.id));
            var oa = wa === null ? 4 : order[wa], ob = wb === null ? 4 : order[wb];
            return oa - ob || String(a.name).localeCompare(String(b.name));
        });
        if (!cos.length) {
            box.innerHTML = '<div class="cl-empty">' + (companies().length ? 'Tidak ada data yang cocok dengan pencarian/filter.' : 'Belum ada nasabah perusahaan. Daftarkan nasabah dengan tipe <b>Perusahaan (2)</b> di menu Nasabah terlebih dahulu.') + '</div>';
            return;
        }
        box.innerHTML = cos.map(function (co) {
            var rows = rowsOf(co.id), w = worstState(rows);
            var cls = w === 'expired' ? ' bad' : (w === 'soon' ? ' warn' : '');
            var shown = f === 'all' || f === 'empty' ? rows : rows.filter(function (r) { return r.state === f; });
            return '<section class="cl-co' + cls + '"><div class="cl-co-h"><div><b>' + esc(co.name) + '</b><small>' + esc([co.type, co.id, co.nib ? 'NIB ' + co.nib : ''].filter(Boolean).join(' · ')) + '</small></div><div class="sp"></div>' +
                (canManage() ? '<button type="button" class="cl-btn sm pri" data-act="add" data-cust="' + esc(co.id) + '"><i class="fa-solid fa-plus"></i> Tambah izin</button>' : '') + '</div>' +
                (shown.length ? '<div style="overflow-x:auto"><table class="cl-t"><thead><tr><th>Jenis izin</th><th>Nomor</th><th>Terbit</th><th>Berakhir</th><th>Status</th><th>Dokumen</th><th></th></tr></thead><tbody>' +
                    shown.map(function (r) {
                        return '<tr><td><b>' + esc(r.label) + '</b>' + (r.license_type === MAIN_TYPE ? '<small><i class="fa-solid fa-link"></i> dari form data nasabah</small>' : (r.notes ? '<small>' + esc(r.notes) + '</small>' : '')) + '</td><td>' + esc(r.number || '-') + '</td><td>' + esc(fmtDay(r.issued_at)) + '</td>' +
                            '<td>' + esc(fmtDay(r.expires_at)) + '<small>' + esc(daysText(r)) + '</small></td><td>' + badge(r) + '</td>' +
                            '<td>' + (r.document_url ? '<a href="' + esc(r.document_url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-file-lines"></i> Lihat</a>' : '<small>-</small>') + '</td>' +
                            '<td><div class="cl-acts">' + (r.license_type === MAIN_TYPE
                                ? (canManage() ? '<button type="button" class="cl-btn sm" data-act="cust" data-cust="' + esc(r.customer_id) + '" title="Diubah lewat form data nasabah"><i class="fa-solid fa-user-pen"></i> Ubah di data nasabah</button>' : '')
                                : (canManage() ? '<button type="button" class="cl-btn sm" data-act="edit" data-id="' + r.id + '"><i class="fa-solid fa-pen"></i> Ubah</button>' : '') +
                                  (canDelete() ? '<button type="button" class="cl-btn sm del" data-act="del" data-id="' + r.id + '"><i class="fa-solid fa-trash"></i></button>' : '')) + '</div></td></tr>';
                    }).join('') + '</tbody></table></div>'
                    : '<div class="cl-none">Belum ada data izin untuk perusahaan ini.</div>') +
                '</section>';
        }).join('');
    }

    async function load() {
        if (S.loading) return;
        S.loading = true;
        try {
            var r = await api('customer-licenses');
            S.rows = Array.isArray(r.data) ? r.data : [];
            S.remind = Number(r.remind_days) || 30;
            if (r.types && typeof r.types === 'object') TYPES = r.types;
            var sel = $('clRemind'); if (sel) sel.value = String(S.remind);
            render();
        } catch (e) {
            var box = $('clList'); if (box) box.innerHTML = '<div class="cl-err">Data perizinan tidak bisa dimuat: ' + esc(e.message) + '</div>';
        } finally { S.loading = false; }
    }

    /* ---------------------------------------------------------- formulir */
    function openForm(custId, row) {
        S.editing = row || null; S.cust = custId;
        var d = row || { license_type: 'NIB' }, co = custInfo(custId), noExp = row ? !row.expires_at : false;
        $('clModal').innerHTML = '<div class="cl-ov" data-act="close-bg"><form class="cl-dlg" id="clForm" autocomplete="off">' +
            '<h3>' + (row ? 'Ubah izin' : 'Tambah izin') + '</h3><p>' + esc(co.name) + (co.type ? ' · ' + esc(co.type) : '') + '</p>' +
            '<div class="cl-fg">' +
            '<div class="cl-f"><label for="clType">Jenis izin</label><select class="cl-in" id="clType">' + Object.keys(TYPES).filter(function (k) { return k !== MAIN_TYPE; }).map(function (k) { return '<option value="' + k + '"' + (d.license_type === k ? ' selected' : '') + '>' + esc(TYPES[k]) + '</option>'; }).join('') + '</select></div>' +
            '<div class="cl-f" id="clNameWrap"' + (d.license_type === 'LAINNYA' ? '' : ' style="display:none"') + '><label for="clName">Nama izin</label><input class="cl-in" id="clName" maxlength="150" placeholder="Nama dokumen izin" value="' + esc(d.license_name || '') + '"></div>' +
            '<div class="cl-f full"><label for="clNumber">Nomor izin / dokumen</label><input class="cl-in" id="clNumber" maxlength="100" placeholder="Nomor sesuai dokumen" value="' + esc(d.number || '') + '"></div>' +
            '<div class="cl-f"><label for="clIssued">Tanggal terbit</label><input type="date" class="cl-in" id="clIssued" value="' + esc(d.issued_at || '') + '"></div>' +
            '<div class="cl-f"><label for="clExpires">Berlaku sampai</label><input type="date" class="cl-in" id="clExpires" value="' + esc(d.expires_at || '') + '"' + (noExp ? ' disabled' : '') + '>' +
            '<label class="cl-chk"><input type="checkbox" id="clNoExp"' + (noExp ? ' checked' : '') + '> Berlaku tanpa batas waktu</label></div>' +
            '<div class="cl-f full"><label for="clFile">Dokumen (PDF / foto)</label><input type="file" class="cl-in" id="clFile" accept=".pdf,image/*" style="padding-top:6px">' +
            (d.document_url ? '<small>Dokumen saat ini: <a href="' + esc(d.document_url) + '" target="_blank" rel="noopener">lihat</a>. Pilih berkas baru untuk mengganti.</small>' : '<small>Opsional. Maksimal sekitar 5 MB.</small>') + '</div>' +
            '<div class="cl-f full"><label for="clNotes">Catatan</label><textarea class="cl-in" id="clNotes" maxlength="1000" placeholder="Opsional, mis. instansi penerbit atau proses perpanjangan">' + esc(d.notes || '') + '</textarea></div>' +
            '</div><div id="clErr"></div>' +
            '<div class="cl-dlg-acts"><button type="button" class="cl-btn" data-act="close">Batal</button><button type="submit" class="cl-btn pri" id="clSave"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div>' +
            '</form></div>';
        $('clForm').addEventListener('submit', function (e) { e.preventDefault(); save(); });
        $('clType').addEventListener('change', function () { $('clNameWrap').style.display = this.value === 'LAINNYA' ? '' : 'none'; });
        $('clNoExp').addEventListener('change', function () { $('clExpires').disabled = this.checked; if (this.checked) $('clExpires').value = ''; });
        setTimeout(function () { var n = $('clNumber'); if (n) n.focus(); }, 30);
    }
    function closeForm() { $('clModal').innerHTML = ''; S.editing = null; }

    function readFile(file) {
        return new Promise(function (resolve, reject) {
            if (file.size > 6 * 1024 * 1024) { reject(new Error('Berkas terlalu besar (maksimal sekitar 5 MB).')); return; }
            var r = new FileReader();
            r.onerror = function () { reject(new Error('Berkas tidak bisa dibaca.')); };
            r.onload = function (e) { resolve(e.target.result); };
            r.readAsDataURL(file);
        });
    }

    async function save() {
        var err = $('clErr'), btn = $('clSave');
        var fail = function (m) { err.innerHTML = '<div class="cl-err">' + esc(m) + '</div>'; };
        err.innerHTML = '';
        var type = $('clType').value, noExp = $('clNoExp').checked;
        var body = {
            customer_id: S.cust, license_type: type,
            license_name: type === 'LAINNYA' ? $('clName').value.trim() : null,
            number: $('clNumber').value.trim() || null,
            issued_at: $('clIssued').value || null,
            expires_at: noExp ? null : ($('clExpires').value || null),
            document_url: S.editing ? (S.editing.document_url || null) : null,
            notes: $('clNotes').value.trim() || null
        };
        if (type === 'LAINNYA' && !body.license_name) return fail('Isi nama izin untuk jenis "Lainnya".');
        if (!noExp && !body.expires_at) return fail('Isi tanggal "Berlaku sampai", atau centang "Berlaku tanpa batas waktu".');
        if (body.issued_at && body.expires_at && body.expires_at < body.issued_at) return fail('Tanggal berakhir tidak boleh sebelum tanggal terbit.');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        try {
            var f = $('clFile').files && $('clFile').files[0];
            if (f) {
                if (typeof window.uploadBase64FileToFolder !== 'function') throw new Error('Fitur unggah berkas belum siap. Muat ulang halaman.');
                body.document_url = await window.uploadBase64FileToFolder(await readFile(f), 'pt/documents', S.cust + '-izin-' + type.toLowerCase() + '-' + Date.now());
            }
            if (S.editing) await api('customer-licenses/' + S.editing.id, 'PUT', body);
            else await api('customer-licenses', 'POST', body);
            closeForm();
            toast('success', 'Data izin disimpan');
            await load();
            fetchAlerts(true);
        } catch (e) {
            fail(e.message || 'Gagal menyimpan.');
            btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
        }
    }

    async function remove(id) {
        var r = S.rows.filter(function (x) { return String(x.id) === String(id); })[0]; if (!r) return;
        var ok = true;
        if (window.Swal) ok = (await window.Swal.fire({ icon: 'warning', title: 'Hapus izin ini?', text: r.label + (r.number ? ' (' + r.number + ')' : '') + ' milik ' + custInfo(r.customer_id).name + ' akan dihapus.', showCancelButton: true, confirmButtonText: 'Ya, hapus', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626' })).isConfirmed;
        else ok = confirm('Hapus izin ' + r.label + '?');
        if (!ok) return;
        try { await api('customer-licenses/' + id, 'DELETE'); toast('success', 'Izin dihapus'); await load(); fetchAlerts(true); }
        catch (e) { alertBox('error', 'Gagal menghapus', e.message); }
    }

    function onClick(e) {
        var t = e.target;
        if (t.classList && t.classList.contains('cl-ov') && t.getAttribute('data-act') === 'close-bg') return closeForm();
        var b = t.closest('button'); if (!b) return;
        var act = b.getAttribute('data-act');
        if (b.hasAttribute('data-f')) { var k = b.getAttribute('data-f'); S.filter = S.filter === k ? 'all' : k; $('clFilter').value = S.filter; render(); return; }
        if (act === 'add') openForm(b.getAttribute('data-cust'));
        else if (act === 'edit') { var r = S.rows.filter(function (x) { return String(x.id) === b.getAttribute('data-id'); })[0]; if (r) openForm(r.customer_id, r); }
        else if (act === 'del') remove(b.getAttribute('data-id'));
        else if (act === 'cust') {
            var cid = b.getAttribute('data-cust');
            if (typeof window.openCustomerUpdateModal === 'function') window.openCustomerUpdateModal(cid);
            else alertBox('info', 'Ubah di data nasabah', 'Buka menu Nasabah, lalu ubah "Berlaku Sampai" pada data perusahaan ini.');
        }
        else if (act === 'close') closeForm();
    }

    async function onChange(e) {
        var t = e.target;
        if (t.id === 'clFilter') { S.filter = t.value; render(); }
        else if (t.id === 'clRemind') {
            try { await api('customer-licenses/settings', 'POST', { remind_days: Number(t.value) }); toast('success', 'Pengingat: ' + t.value + ' hari sebelum berakhir'); await load(); fetchAlerts(true); }
            catch (err) { alertBox('error', 'Gagal menyimpan', err.message); t.value = String(S.remind); }
        }
    }

    /* ---------------------------------------------------------- pengingat */
    function loggedIn() { var u = user(); return !!(u && u.role); }

    async function fetchAlerts(force) {
        if (!loggedIn()) return;
        if (!force && S.alerts && Date.now() - S.alertsAt < 10 * 60 * 1000) return;
        S.alertsAt = Date.now(); // juga membatasi percobaan ulang bila gagal
        try {
            var r = await api('customer-licenses/alerts');
            S.alerts = r;
            window.mcLicenseAlerts = r;
            renderBell();
            refreshPosWarning();
            maybePopup();
        } catch (e) { /* diam: tabel belum dimigrasi atau sesi habis */ }
    }

    function alertItems() { return (S.alerts && Array.isArray(S.alerts.data)) ? S.alerts.data : []; }

    function renderBell() {
        var stock = document.querySelector('.top-header .notification:not(.lic-bell)');
        if (!stock) return;
        var bell = $('licAlertBell');
        if (!bell) {
            injectStyle();
            bell = document.createElement('div');
            bell.id = 'licAlertBell'; bell.className = 'notification lic-bell'; bell.style.cursor = 'pointer';
            bell.innerHTML = '<i class="fa-solid fa-file-shield"></i><span class="badge" id="licAlertBadge"></span>';
            bell.addEventListener('click', showAlertList);
            stock.parentNode.insertBefore(bell, stock);
        }
        var items = alertItems(), expired = items.filter(function (r) { return r.state === 'expired'; }).length;
        var badgeEl = $('licAlertBadge');
        badgeEl.textContent = items.length ? items.length : '';
        badgeEl.style.display = items.length ? 'block' : 'none';
        bell.classList.toggle('has-expired', expired > 0);
        bell.title = items.length ? 'Perizinan nasabah: ' + expired + ' kedaluwarsa, ' + (items.length - expired) + ' segera habis' : 'Perizinan nasabah: tidak ada izin yang mendekati jatuh tempo';
        bell.style.display = (items.length || canManage()) ? '' : 'none';
    }

    function alertTable(items, max) {
        var list = items.slice(0, max || items.length);
        return '<div class="lp-list">' + list.map(function (r) {
            var c = r.state === 'expired' ? 'x' : 'w';
            return '<div class="lp-item ' + c + '"><div class="lp-main"><div class="lp-name">' + esc(r.customer_name || r.customer_id) + '</div>' +
                '<div class="lp-doc">' + esc(r.label) + (r.number ? ' · ' + esc(r.number) : '') + '</div></div>' +
                '<div class="lp-side"><span class="lp-pill ' + c + '">' + esc(daysText(r)) + '</span><div class="lp-date">' + esc(fmtDay(r.expires_at)) + '</div></div></div>';
        }).join('') + (items.length > list.length ? '<div class="lp-more">+ ' + (items.length - list.length) + ' izin lainnya</div>' : '') + '</div>';
    }

    /* Kerangka popup: ikon + judul + keterangan + ringkasan + daftar. */
    function alertHtml(kind, icon, title, sub, items, max) {
        var html = '<div class="lp-head"><div class="lp-ico ' + kind + '"><i class="fa-solid ' + icon + '"></i></div>' +
            '<div><h3 class="lp-ttl">' + esc(title) + '</h3><p class="lp-sub">' + sub + '</p></div></div>';
        if (items && items.length) {
            var ex = items.filter(function (r) { return r.state === 'expired'; }).length, so = items.length - ex;
            html += '<div class="lp-chips">' + (ex ? '<span class="lp-chip x"><i class="fa-solid fa-circle-xmark"></i> ' + ex + ' kedaluwarsa</span>' : '') +
                (so ? '<span class="lp-chip w"><i class="fa-solid fa-clock"></i> ' + so + ' segera habis</span>' : '') + '</div>' + alertTable(items, max);
        }
        return html;
    }
    function popOpts(html, extra) {
        injectStyle();
        var o = { html: html, width: 560, showConfirmButton: true, customClass: { popup: 'lic-pop' }, buttonsStyling: true, focusConfirm: false };
        for (var k in extra) o[k] = extra[k];
        return o;
    }

    function openLicensePage() {
        var nav = document.querySelector('.nav-item[data-target="' + VIEW_ID + '"]');
        if (nav) nav.click();
    }

    function showAlertList() {
        var items = alertItems(), remind = (S.alerts && S.alerts.remind_days) || 30;
        if (!window.Swal) { if (items.length) alert(items.length + ' izin nasabah kedaluwarsa / segera habis.'); return; }
        if (!items.length) {
            window.Swal.fire(popOpts(alertHtml('ok', 'fa-shield-halved', 'Perizinan aman', 'Tidak ada izin nasabah yang kedaluwarsa atau berakhir dalam ' + remind + ' hari ke depan.'),
                { showCancelButton: canManage(), confirmButtonText: 'Tutup', cancelButtonText: 'Buka Perizinan', reverseButtons: true }))
                .then(function (r) { if (r.dismiss === window.Swal.DismissReason.cancel) openLicensePage(); });
            return;
        }
        var expired = items.filter(function (r) { return r.state === 'expired'; }).length;
        window.Swal.fire(popOpts(alertHtml(expired ? 'x' : 'w', 'fa-file-shield', 'Izin nasabah jatuh tempo',
            'Izin yang sudah lewat atau berakhir dalam <b style="color:#f8fafc">' + remind + ' hari</b> ke depan.', items),
            { showCancelButton: canManage(), confirmButtonText: 'Tutup', cancelButtonText: 'Buka Perizinan Nasabah', reverseButtons: true }))
            .then(function (r) { if (r.dismiss === window.Swal.DismissReason.cancel) openLicensePage(); });
    }

    function maybePopup() {
        if (!canManage()) return;
        var items = alertItems(); if (!items.length) return;
        var key = 'mc_lic_popup_' + today() + '_' + ((user() && (user().id || user().username)) || '');
        try { if (localStorage.getItem(key)) return; } catch (e) { /* lanjut */ }
        var tries = 0;
        (function attempt() {
            if (window.Swal && window.Swal.isVisible && window.Swal.isVisible()) { if (++tries < 20) setTimeout(attempt, 3000); return; }
            try { localStorage.setItem(key, '1'); } catch (e) { /* abaikan */ }
            var expired = items.filter(function (r) { return r.state === 'expired'; }).length;
            if (!window.Swal) return;
            window.Swal.fire(popOpts(alertHtml(expired ? 'x' : 'w', expired ? 'fa-triangle-exclamation' : 'fa-hourglass-half',
                expired ? expired + ' izin nasabah sudah kedaluwarsa' : items.length + ' izin nasabah segera habis',
                'Segera minta dokumen perpanjangan dari nasabah berikut.', items, 8),
                { showCancelButton: true, confirmButtonText: 'Nanti', cancelButtonText: 'Buka Perizinan Nasabah', reverseButtons: true }))
                .then(function (r) { if (r.dismiss === window.Swal.DismissReason.cancel) openLicensePage(); });
        })();
    }

    /* Kasir: peringatan saat nasabah perusahaan dengan izin bermasalah dipilih. */
    function refreshPosWarning() {
        var card = $('posCustomerProfileCard'); if (!card) return;
        var old = $('licPosWarn');
        var cid = ($('trxCustomer') && $('trxCustomer').value) || '';
        var items = cid ? alertItems().filter(function (r) { return String(r.customer_id) === String(cid); }) : [];
        if (!items.length || card.classList.contains('hidden')) { if (old) old.remove(); if (!cid) S.posWarned = ''; return; }
        var expired = items.filter(function (r) { return r.state === 'expired'; });
        var el = old || document.createElement('div');
        el.id = 'licPosWarn';
        el.className = expired.length ? 'bad' : 'warn';
        el.innerHTML = '<b><i class="fa-solid fa-file-shield"></i> ' + (expired.length ? 'Izin perusahaan sudah kedaluwarsa' : 'Izin perusahaan segera habis') + '</b>' +
            items.map(function (r) { return esc(r.label) + (r.number ? ' (' + esc(r.number) + ')' : '') + ': ' + esc(daysText(r)) + ', ' + esc(fmtDay(r.expires_at)); }).join('<br>') +
            '<br><span style="opacity:.85">Minta dokumen izin terbaru sebelum melanjutkan transaksi.</span>';
        if (!old) card.appendChild(el);
        if (S.posWarned !== cid) {
            S.posWarned = cid;
            if (window.Swal && !(window.Swal.isVisible && window.Swal.isVisible())) {
                window.Swal.fire({ icon: expired.length ? 'error' : 'warning', toast: true, position: 'top-end', timer: 6000, showConfirmButton: false,
                    title: expired.length ? 'Izin nasabah ini sudah kedaluwarsa' : 'Izin nasabah ini segera habis' });
            }
        }
    }

    // Setelah data nasabah disimpan (mis. "Berlaku Sampai" diubah), segarkan pengingat & daftar.
    window.mcRefreshLicenseAlerts = function () { fetchAlerts(true); if (visible() && S.built) load(); };
    function hookCustomerSave() {
        var fn = window.saveToMySQL_Customer;
        if (typeof fn !== 'function' || fn.__lic) return;
        var wrapped = function () {
            var r = fn.apply(this, arguments);
            Promise.resolve(r).then(function () { setTimeout(window.mcRefreshLicenseAlerts, 800); }).catch(function () { /* abaikan */ });
            return r;
        };
        wrapped.__lic = true;
        window.saveToMySQL_Customer = wrapped;
    }

    function hookPos() {
        var fn = window.updateModernCustomerProfileCard;
        if (typeof fn !== 'function' || fn.__lic) return;
        var wrapped = function () {
            var r = fn.apply(this, arguments);
            try { refreshPosWarning(); } catch (e) { /* abaikan */ }
            return r;
        };
        wrapped.__lic = true;
        window.updateModernCustomerProfileCard = wrapped;
    }

    /* ---------------------------------------------------------- siklus hidup */
    function visible() { var v = $(VIEW_ID); return !!v && !v.classList.contains('hidden') && v.offsetParent !== null; }
    window.loadCustomerLicenses = function () { if (!$(ROOT_ID)) return; if (!S.built || !$('clList')) build(); load(); };

    var wasVisible = false;
    setInterval(function () {
        hookPos();
        hookCustomerSave();
        var now = visible();
        if (now && !wasVisible) window.loadCustomerLicenses();
        wasVisible = now;
        if (loggedIn() && Date.now() - S.alertsAt > 15 * 60 * 1000) fetchAlerts(true);
        else if (S.alerts && !$('licAlertBell')) renderBell();
    }, 2000);
})();
