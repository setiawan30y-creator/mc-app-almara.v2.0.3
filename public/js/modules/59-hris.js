// @2026-Alifiandra
/* =====================================================================
 * 59-hris.js  —  Administrasi > HRIS / Karyawan
 *
 * Enam tab dalam satu modul:
 *  1) Karyawan   : data & akun karyawan (otomatis jadi akun login), dokumen.
 *  2) Absensi    : Clock IN/OUT dengan PIN, keterlambatan dari jadwal shift,
 *                  koreksi oleh pengelola.
 *  3) Shift&Cuti : kalender bulanan, jadwal massal, cuti/izin/sakit,
 *                  jatah cuti tahunan, view/JPEG/cetak kalender.
 *  4) Kasbon     : pinjaman & cicilan, tersambung ke saldo Kas/Bank.
 *  5) BPJS       : potongan Kesehatan & Ketenagakerjaan per karyawan.
 *  6) Penggajian : rekap semua karyawan per bulan, slip cetak, Excel.
 *
 * Data lama (mc_hris_*) dipakai apa adanya. Fungsi lama yang dipanggil modul
 * lain (switchHrisTab, renderHrisScheduleCalendar, ...) tetap tersedia.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcHris) return;
    window.__mcHris = true;

    /* ---------- Utilitas ---------- */
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
    var idr = function (n) { return typeof window.formatIdr === 'function' ? window.formatIdr(num(n)) : 'Rp ' + Math.round(num(n)).toLocaleString('id-ID'); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var ymd = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var hm = function (d) { d = d || new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    var normT = function (t) { return t ? String(t).replace('.', ':').slice(0, 5) : ''; };
    var toMin = function (t) { var m = /^(\d{1,2})[:.](\d{2})/.exec(String(t || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; };
    var isActive = function (e) { return String((e && e.status) || '').trim().toLowerCase() === 'aktif'; };
    var initials = function (n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); };
    var monthLabel = function (mm) { var p = String(mm).split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }); };
    var dateLabel = function (s) { if (!s) return '-'; var d = new Date(s + 'T00:00:00'); return isNaN(d) ? esc(s) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); };

    var EMP = function () { return typeof getHrisEmployees === 'function' ? getHrisEmployees() : []; };
    var ATT = function () { return typeof getHrisAttendance === 'function' ? getHrisAttendance() : []; };
    var KAS = function () { return typeof getHrisKasbon === 'function' ? getHrisKasbon() : []; };
    var BPJ = function () { return typeof getHrisBpjs === 'function' ? getHrisBpjs() : []; };
    var LVE = function () { return typeof getHrisLeave === 'function' ? getHrisLeave() : []; };

    function canManage() {
        try {
            var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            var role = user && typeof getAccessRoleForUserRole === 'function' ? getAccessRoleForUserRole(user.role) : 'kasir';
            var perms = typeof getRolePermissions === 'function' ? getRolePermissions() : {};
            var cfg = (typeof getEffectiveAccessConfig === 'function' && user) ? getEffectiveAccessConfig(user) : (perms[role] || {});
            return Array.isArray(cfg.menus) && cfg.menus.indexOf('hris-view') >= 0;
        } catch (e) { return false; }
    }
    function actor() { try { var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null; return (u && (u.fullName || u.username)) || 'Admin HRIS'; } catch (e) { return 'Admin HRIS'; } }
    function companyName() { try { return (JSON.parse(localStorage.getItem('mc_profile') || '{}').name) || 'Perusahaan'; } catch (e) { return 'Perusahaan'; } }

    var TABS = [['emp', 'Karyawan', 'fa-users', true], ['att', 'Absensi', 'fa-clock', true], ['leave', 'Shift & Cuti', 'fa-calendar-days', false],
        ['kasbon', 'Kasbon', 'fa-hand-holding-dollar', true], ['bpjs', 'BPJS', 'fa-heart-pulse', true], ['payroll', 'Penggajian', 'fa-file-invoice-dollar', true]];
    var ROLES = ['Kasir', 'Teller', 'Admin', 'Supervisor', 'Kurir', 'Keamanan', 'Lainnya'];
    var LEAVE_TYPES = {
        JADWAL_SHIFT: ['Jadwal Shift', 'b'], LIBUR_SHIFT: ['Libur / Off', 'n'], CUTI: ['Cuti', 'g'], IZIN: ['Izin', 'a'], SAKIT: ['Sakit', 'r']
    };
    var SHIFT_PRESETS = [['Shift Pagi', '08:00', '17:00'], ['Shift Midle', '10:00', '19:00'], ['Shift Siang', '12:00', '21:00']];
    var CUTI_QUOTA = 12;
    var RATE_KEY = 'mc_hris_bpjs_rates';

    var S = {
        tab: 'emp', empQ: '', empStatus: '', empRole: '',
        attDate: ymd(), pinFail: 0, pinLockUntil: 0, pinNiks: [],
        schMonth: ymd().slice(0, 7), schEmp: 'ALL', lvMonth: '', lvType: '',
        kbEmp: '', kbMonth: '', pyMonth: ymd().slice(0, 7), pyEmp: 'ALL', pyRows: [],
        oldFiles: {}, kbWarned: false, built: false
    };

    /* ---------- Gaya ---------- */
    function injectStyle() {
        if ($('hr-style')) return;
        var st = document.createElement('style'); st.id = 'hr-style';
        st.textContent = [
            '.hr{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#6366f1);display:grid;gap:16px}.hr *{box-sizing:border-box}.hr .hidden{display:none!important}',
            '.hr-head{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border:1px solid var(--bd);border-radius:16px;padding:16px 20px;background:linear-gradient(135deg,rgba(99,102,241,.16),rgba(99,102,241,.02))}',
            '.hr-head .ic{width:44px;height:44px;border-radius:12px;background:var(--pri);color:#fff;display:grid;place-items:center;font-size:1.15rem;flex:none}.hr-head h2{margin:0;font-size:1.18rem}.hr-head p{margin:3px 0 0;color:var(--mut);font-size:.83rem}',
            '.hr-head .act{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}',
            '.hr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.hr-kpi{border:1px solid var(--bd);border-radius:14px;padding:12px 15px}.hr-kpi .t{font-size:.72rem;color:var(--mut);font-weight:600}.hr-kpi .v{font-size:1.4rem;font-weight:800;margin-top:2px}.hr-kpi .s{font-size:.72rem;color:var(--mut)}.hr-kpi.warn .v{color:#f59e0b}.hr-kpi.bad .v{color:#f87171}',
            '.hr-tabs{display:flex;gap:6px;border-bottom:1px solid var(--bd);overflow-x:auto}.hr-tab{background:none;border:0;border-bottom:3px solid transparent;color:var(--mut);font:inherit;font-weight:700;font-size:.88rem;padding:10px 15px;cursor:pointer;white-space:nowrap;display:flex;gap:8px;align-items:center}.hr-tab.active{color:inherit;border-bottom-color:var(--pri)}',
            '.hr-card{border:1px solid var(--bd);border-radius:16px;padding:16px 18px;min-width:0}.hr-card>h3{margin:0 0 4px;font-size:.96rem}.hr-card>.sub{margin:0 0 12px;color:var(--mut);font-size:.8rem;line-height:1.45}',
            '.hr-tool{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.hr-tool .grow{flex:1;min-width:190px}.hr .hr-tool .form-control,.hr .hr-tool input[type=date],.hr .hr-tool input[type=month]{width:auto}.hr .hr-tool .grow.form-control{width:100%}.hr-card+.hr-card{margin-top:16px}',
            '.hr .form-control,.hr-ov .form-control{width:100%;box-sizing:border-box}.hr label.l,.hr-ov label.l{display:block;font-size:.74rem;font-weight:700;margin:0 0 4px}.hr small.h,.hr-ov small.h{display:block;color:var(--mut);font-size:.72rem;line-height:1.4;margin-top:3px}',
            '.hr-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.8rem;padding:8px 13px;border-radius:10px;cursor:pointer;white-space:nowrap}.hr-btn:hover{border-color:var(--pri)}.hr-btn.pri{background:var(--pri);border-color:var(--pri);color:#fff}.hr-btn.ok{background:#10b981;border-color:#10b981;color:#fff}.hr-btn.dng{color:#f87171}.hr-btn.sm{padding:5px 10px;font-size:.75rem}.hr-btn:disabled{opacity:.55;cursor:not-allowed}',
            '.hr-b{display:inline-block;border-radius:99px;font-size:.68rem;font-weight:800;padding:2px 9px}.hr-b.g{background:rgba(16,185,129,.16);color:#34d399}.hr-b.a{background:rgba(245,158,11,.16);color:#fbbf24}.hr-b.r{background:rgba(239,68,68,.16);color:#f87171}.hr-b.b{background:rgba(99,102,241,.2);color:#a5b4fc}.hr-b.n{background:rgba(148,163,184,.16);color:var(--mut)}',
            '.hr-empty{text-align:center;color:var(--mut);padding:26px 12px;font-size:.86rem;line-height:1.6}.hr-empty i{display:block;font-size:1.7rem;margin-bottom:8px;opacity:.6}',
            '.hr-msg{font-size:.8rem;line-height:1.5;border-radius:10px;padding:8px 11px;border:1px solid var(--bd)}.hr-msg.ok{border-color:rgba(52,211,153,.5);background:rgba(16,185,129,.08);color:#34d399}.hr-msg.bad{border-color:rgba(248,113,113,.5);background:rgba(239,68,68,.08);color:#f87171}.hr-msg.warn{border-color:rgba(251,191,36,.5);background:rgba(245,158,11,.08);color:#fbbf24}',
            '.hr-emp{display:grid;grid-template-columns:48px minmax(0,1fr) auto auto;gap:6px 14px;align-items:center;border:1px solid var(--bd);border-radius:13px;padding:11px 14px;margin-bottom:9px}.hr-emp:hover{border-color:var(--pri)}',
            '.hr-av{width:44px;height:44px;border-radius:50%;background:rgba(99,102,241,.22);display:grid;place-items:center;font-weight:800;font-size:.85rem;overflow:hidden}.hr-av img{width:100%;height:100%;object-fit:cover}',
            '.hr-emp h4{margin:0;font-size:.92rem;overflow-wrap:anywhere}.hr-emp .m{color:var(--mut);font-size:.76rem;margin-top:2px;overflow-wrap:anywhere}.hr-emp .pay{text-align:right;font-size:.84rem;font-weight:700}.hr-emp .pay small{display:block;color:var(--mut);font-weight:500;font-size:.72rem}',
            '@media(max-width:760px){.hr-emp{grid-template-columns:44px minmax(0,1fr)}.hr-emp .pay{text-align:left;grid-column:2}.hr-emp .a{grid-column:2}}',
            '.hr-grid2{display:grid;grid-template-columns:minmax(290px,380px) minmax(0,1fr);gap:16px;align-items:start}@media(max-width:960px){.hr-grid2{grid-template-columns:1fr}}',
            '.hr-clock{font-size:2.6rem;font-weight:800;text-align:center;letter-spacing:.02em;font-variant-numeric:tabular-nums}.hr-date{text-align:center;color:var(--mut);font-size:.82rem;margin-bottom:14px}',
            '.hr-pin{text-align:center;font-size:1.6rem;letter-spacing:.6em;font-weight:800}.hr-inout{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.hr-inout .hr-btn{justify-content:center;padding:13px;font-size:.92rem}',
            '.hr-table{width:100%;border-collapse:collapse;font-size:.84rem}.hr-table th{text-align:left;font-size:.72rem;color:var(--mut);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--bd);white-space:nowrap}.hr-table td{padding:9px 10px;border-bottom:1px solid var(--bd);vertical-align:middle}.hr-table .r{text-align:right}.hr-table .c{text-align:center}.hr-table tfoot td{font-weight:800;border-top:2px solid var(--bd)}.hr-wrap{overflow-x:auto}',
            '.hr-chips{display:flex;gap:6px;flex-wrap:wrap}.hr-chip{border:1px solid var(--bd);border-radius:99px;font-size:.73rem;font-weight:600;padding:3px 10px;color:var(--mut)}',
            '.hr-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:.76rem;color:var(--mut);margin:8px 0 10px}.hr-legend b{margin-right:5px}',
            '.sch{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:1px 5px;border-radius:5px;color:#fff!important;font-weight:800;font-size:.7rem}.sch-p{background:#2563eb}.sch-shift-s{background:#10b981}.sch-midle{background:#8b5cf6}.sch-o{background:#64748b}.sch-c{background:#dc2626}.sch-i{background:#f59e0b;color:#111827!important}.sch-s{background:#ec4899}',
            '.hris-schedule-table{border-collapse:collapse;font-size:.72rem;min-width:900px;width:100%}.hris-schedule-table th,.hris-schedule-table td{border:1px solid var(--bd);padding:4px 3px;text-align:center}.hris-schedule-table th:first-child,.hris-schedule-table td:first-child{text-align:left;min-width:130px;position:sticky;left:0;background:var(--mc-card-bg,#0f172a);z-index:1;padding-left:8px}.hris-schedule-cell{display:flex;flex-direction:column;align-items:center;gap:1px;min-height:26px;justify-content:center}.hris-schedule-cell small{font-size:.6rem;color:var(--mut)}.hris-schedule-day small{color:var(--mut);font-weight:500}',
            '.hr-quota{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-bottom:14px}.hr-q{border:1px solid var(--bd);border-radius:12px;padding:10px 12px;font-size:.8rem}.hr-q b{display:block;margin-bottom:5px}.hr-bar{height:6px;border-radius:99px;background:rgba(148,163,184,.2);overflow:hidden}.hr-bar i{display:block;height:100%;background:var(--pri)}.hr-bar i.hi{background:#f59e0b}.hr-bar i.full{background:#ef4444}',
            '.hr-ov{position:fixed;inset:0;background:rgba(2,6,23,.62);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow-y:auto;--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#6366f1)}',
            '.hr-modal{background:var(--mc-card-bg,#1e293b);color:var(--mc-text,inherit);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:760px;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.4)}.hr-modal.sm{max-width:480px}.hr-mh{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.hr-mh h3{margin:0;font-size:1.05rem}.hr-mh .x{margin-left:auto}',
            '.hr-f{display:grid;grid-template-columns:1fr 1fr;gap:11px}.hr-f .full{grid-column:1/-1}@media(max-width:560px){.hr-f{grid-template-columns:1fr}}.hr-sec{border-top:1px solid var(--bd);margin-top:16px;padding-top:14px}.hr-sec h5{margin:0 0 10px;font-size:.84rem}',
            '.hr-mf{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px}',
            '.hr-docs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:11px}.hr-doc{border:1px dashed var(--bd);border-radius:12px;padding:10px}.hr-doc .pv{margin-top:7px;min-height:54px}.hr-doc .pv img{max-height:80px;border-radius:8px;cursor:zoom-in;max-width:100%}.hr-doc .pv a{font-size:.78rem;color:var(--pri)}',
            '.hr-pills{display:flex;gap:6px;flex-wrap:wrap}.hr-pill{border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-size:.78rem;font-weight:700;border-radius:99px;padding:5px 12px;cursor:pointer}.hr-pill.on{background:var(--pri);border-color:var(--pri);color:#fff}',
            '.hr-checks{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px;max-height:150px;overflow:auto;border:1px solid var(--bd);border-radius:10px;padding:8px}.hr-checks label{display:flex;gap:7px;align-items:center;font-size:.8rem;cursor:pointer}',
            '.hr-slip{font-size:.86rem}.hr-slip dl{display:grid;grid-template-columns:150px 1fr;gap:5px 10px;margin:0 0 14px}.hr-slip dt{color:var(--mut)}.hr-slip dd{margin:0}.hr-slip table{width:100%;border-collapse:collapse}.hr-slip td{padding:7px 4px;border-bottom:1px solid var(--bd)}.hr-slip td:last-child{text-align:right;font-variant-numeric:tabular-nums}.hr-slip tr.tot td{font-weight:800;font-size:1rem;border-top:2px solid var(--bd)}',
            '.hr-toast{position:fixed;right:18px;bottom:18px;z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:11px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:min(420px,90vw)}.hr-toast.err{border-left-color:#ef4444}'
        ].join('\n');
        document.head.appendChild(st);
    }
    function toast(msg, err) {
        document.querySelectorAll('.hr-toast').forEach(function (o) { o.remove(); });
        var t = document.createElement('div'); t.className = 'hr-toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
        document.body.appendChild(t); setTimeout(function () { t.remove(); }, err ? 6000 : 3200);
    }

    /* ---------- Modal ---------- */
    function openModal(html, small) {
        closeModal();
        var ov = document.createElement('div'); ov.className = 'hr-ov hr'; ov.id = 'hrOv';
        ov.innerHTML = '<div class="hr-modal ' + (small ? 'sm' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
        ov.addEventListener('click', onClick); ov.addEventListener('change', onChange); ov.addEventListener('input', onInput); ov.addEventListener('submit', onSubmit);
        document.body.appendChild(ov);
        var f = ov.querySelector('input:not([type=hidden]):not([readonly]),select,textarea'); if (f) f.focus();
    }
    function closeModal() { var o = $('hrOv'); if (o) o.remove(); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    function mh(title, sub) { return '<div class="hr-mh"><div><h3>' + esc(title) + '</h3>' + (sub ? '<div style="color:var(--mut);font-size:.78rem;margin-top:2px">' + esc(sub) + '</div>' : '') + '</div><button type="button" class="hr-btn sm x" data-act="close">Tutup</button></div>'; }
    function confirmBox(title, msg, okLabel, act, id) {
        openModal(mh(title) + '<p style="margin:0;font-size:.88rem;line-height:1.55">' + esc(msg) + '</p><div class="hr-mf"><button class="hr-btn" data-act="close">Batal</button><button class="hr-btn dng" data-act="' + act + '" data-id="' + esc(id) + '">' + esc(okLabel) + '</button></div>', true);
    }

    /* ---------- Kerangka ---------- */
    function build() {
        var root = $('hrisRoot'); if (!root) return null;
        if (S.built) return root;
        injectStyle(); root.className = 'hr'; S.built = true; loadPinStatus();
        root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput); root.addEventListener('submit', onSubmit); root.addEventListener('keydown', onKey);
        root.innerHTML = '<div class="hr-head"><div class="ic"><i class="fa-solid fa-users-gear"></i></div><div><h2>HRIS &middot; Karyawan &amp; Penggajian</h2><p>Data karyawan, absensi, shift &amp; cuti, kasbon, BPJS, dan slip gaji dalam satu tempat.</p></div><div class="act hris-manage-only" id="hrHeadAct"></div></div>' +
            '<div id="hrKpis" class="hris-manage-only"></div><div class="hr-tabs" role="tablist" id="hrTabs">' +
            TABS.map(function (t) { return '<button class="hr-tab hris-tab-btn' + (t[3] ? ' hris-manage-only' : '') + '" role="tab" id="btn-tab-hris-' + t[0] + '" data-act="tab" data-tab="' + t[0] + '"><i class="fa-solid ' + t[2] + '"></i> ' + t[1] + '</button>'; }).join('') + '</div>' +
            '<div>' + TABS.map(function (t) { return '<div id="hris-tab-' + t[0] + '" class="hris-tab-content hidden" style="display:none"></div>'; }).join('') + '</div>';
        setInterval(function () { var c = $('hrClock'); if (c) c.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }); }, 1000);
        return root;
    }

    window.switchHrisTab = function (tab) {
        if (!build()) return;
        var manage = canManage();
        if (!manage && tab !== 'leave') tab = 'leave';
        S.tab = tab;
        TABS.forEach(function (t) {
            var p = $('hris-tab-' + t[0]), b = $('btn-tab-hris-' + t[0]), on = t[0] === tab;
            if (p) { p.style.display = on ? 'block' : 'none'; p.classList.toggle('hidden', !on); }
            if (b) { b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
        });
        document.querySelectorAll('#hrisRoot .hris-manage-only').forEach(function (el) { el.style.display = manage ? '' : 'none'; });
        paintKpis(); paintHeadAct();
        var fn = { emp: paintEmp, att: paintAtt, leave: paintLeave, kasbon: paintKasbon, bpjs: paintBpjs, payroll: paintPayroll }[tab];
        if (fn) fn();
    };
    function paintHeadAct() {
        var a = $('hrHeadAct'); if (!a) return;
        a.innerHTML = S.tab === 'emp' ? '<button class="hr-btn pri" data-act="emp-new"><i class="fa-solid fa-user-plus"></i> Tambah Akun Karyawan</button>' : '';
    }
    function refresh() { window.switchHrisTab(S.tab); }

    function paintKpis() {
        var box = $('hrKpis'); if (!box) return;
        var emps = EMP(), act = emps.filter(isActive), today = ymd();
        var present = ATT().filter(function (a) { return a.date === today && a.in_time; }).length;
        var off = 0; var lv = LVE();
        act.forEach(function (e) { var en = findSchedule(lv, e.nik, today); if (en && (en.type === 'CUTI' || en.type === 'IZIN' || en.type === 'SAKIT')) off++; });
        var debt = 0; KAS().forEach(function (k) { debt += (k.type === 'PINJAM' ? 1 : -1) * num(k.amount); });
        box.innerHTML = '<div class="hr-kpis"><div class="hr-kpi"><div class="t">Karyawan aktif</div><div class="v">' + act.length + '</div><div class="s">dari ' + emps.length + ' terdaftar</div></div>' +
            '<div class="hr-kpi"><div class="t">Hadir hari ini</div><div class="v">' + present + '<span style="font-size:.9rem;color:var(--mut)"> / ' + act.length + '</span></div><div class="s">sudah Clock IN</div></div>' +
            '<div class="hr-kpi' + (off ? ' warn' : '') + '"><div class="t">Cuti / izin / sakit hari ini</div><div class="v">' + off + '</div><div class="s">menurut jadwal</div></div>' +
            '<div class="hr-kpi' + (debt > 0 ? ' warn' : '') + '"><div class="t">Kasbon beredar</div><div class="v" style="font-size:1.15rem">' + idr(Math.max(0, debt)) + '</div><div class="s">belum dilunasi</div></div></div>';
    }

    /* ---------- 1. Karyawan ---------- */
    function paintEmp() {
        var box = $('hris-tab-emp'); if (!box) return;
        var q = S.empQ.toLowerCase(), emps = EMP().filter(function (e) {
            if (S.empStatus === 'aktif' && !isActive(e)) return false;
            if (S.empStatus === 'nonaktif' && isActive(e)) return false;
            if (S.empRole && e.role !== S.empRole) return false;
            return !q || (String(e.name) + ' ' + e.nik + ' ' + (e.phone || '')).toLowerCase().indexOf(q) >= 0;
        }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        var keep = $('hrEmpQ') ? $('hrEmpQ').value : S.empQ, focus = document.activeElement && document.activeElement.id === 'hrEmpQ';
        box.innerHTML = '<div class="hr-card"><h3>Data Karyawan</h3><p class="sub">Setiap karyawan otomatis memiliki akun login: username memakai NIK/User, password awal memakai PIN absensi.</p>' +
            '<div class="hr-tool"><input class="form-control grow" id="hrEmpQ" type="search" placeholder="Cari nama, NIK, atau telepon..." value="' + esc(keep) + '">' +
            '<select class="form-control" id="hrEmpStatus"><option value="">Semua status</option><option value="aktif"' + (S.empStatus === 'aktif' ? ' selected' : '') + '>Aktif</option><option value="nonaktif"' + (S.empStatus === 'nonaktif' ? ' selected' : '') + '>Non-aktif</option></select>' +
            '<select class="form-control" id="hrEmpRole"><option value="">Semua jabatan</option>' + ROLES.map(function (r) { return '<option' + (S.empRole === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
            (emps.length ? emps.map(empRow).join('') : '<div class="hr-empty"><i class="fa-solid fa-user-plus"></i>' + (EMP().length ? 'Tidak ada karyawan yang cocok dengan filter.' : 'Belum ada karyawan. Klik <b>Tambah Akun Karyawan</b> untuk memulai.') + '</div>') + '</div>';
        if (focus) { var el = $('hrEmpQ'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
    function empRow(e) {
        var docs = [['photo', 'Foto'], ['ktp', 'KTP'], ['sim', 'SIM'], ['ijazah', 'Ijazah']].filter(function (d) { return e[d[0]]; }).map(function (d) { return '<span class="hr-b n">' + d[1] + '</span>'; }).join(' ');
        return '<div class="hr-emp"><div class="hr-av">' + (e.photo && /^(data:image|https?:|\/|storage)/.test(e.photo) ? '<img src="' + esc(e.photo) + '" alt="">' : esc(initials(e.name))) + '</div>' +
            '<div><h4>' + esc(e.name) + '</h4><div class="m">NIK ' + esc(e.nik) + ' &middot; ' + esc(e.role) + (e.phone ? ' &middot; ' + esc(e.phone) : '') + '</div>' +
            '<div class="m" style="margin-top:5px"><span class="hr-b ' + (isActive(e) ? 'g' : 'r') + '">' + esc(e.status) + '</span> ' + docs + '</div>' + (e.notes ? '<div class="m">' + esc(e.notes) + '</div>' : '') + '</div>' +
            '<div class="pay">' + idr(e.salary) + '<small>/bulan &middot; makan ' + idr(e.food) + '/hari</small></div>' +
            '<div class="a"><button class="hr-btn sm" data-act="emp-edit" data-id="' + esc(e.nik) + '"><i class="fa-solid fa-pen"></i> Edit</button></div></div>';
    }

    function filePv(val, label) {
        if (!val) return '<span style="color:var(--mut);font-size:.76rem">Belum ada</span>';
        if (/^data:application\/pdf/.test(val) || /\.pdf($|\?)/i.test(val)) return '<a href="' + esc(val) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-file-pdf"></i> ' + esc(label) + ' (PDF)</a>';
        return '<img src="' + esc(val) + '" alt="' + esc(label) + '" data-act="zoom" data-src="' + esc(val) + '">';
    }
    var DOCS = [['photo', 'hrEPhoto', 'Foto Close-Up', 'image/*'], ['photoFull', 'hrEPhotoFull', 'Foto Full Body', 'image/*'], ['ktp', 'hrEKtp', 'Scan / Foto KTP', 'image/*,application/pdf'],
        ['sim', 'hrESim', 'SIM (opsional)', 'image/*,application/pdf'], ['ijazah', 'hrEIjazah', 'Ijazah (opsional)', 'image/*,application/pdf']];

    function empModal(nik) {
        var e = nik ? EMP().filter(function (x) { return x.nik === nik; })[0] : null;
        var d = e || { role: 'Kasir', status: 'Aktif', salary: 2000000, food: 25000 };
        S.oldFiles = {}; DOCS.forEach(function (x) { S.oldFiles[x[0]] = (e && e[x[0]]) || ''; });
        openModal(mh(e ? 'Edit Karyawan' : 'Tambah Akun Karyawan', e ? e.name : 'Akun login dibuat otomatis dari data ini') +
            '<form id="hrEmpForm" data-edit="' + (e ? esc(e.nik) : '') + '" novalidate><div class="hr-f">' +
            '<div><label class="l" for="hrENik">NIK / User (username login)</label><input class="form-control" id="hrENik" value="' + esc(d.nik) + '"' + (e ? ' readonly' : '') + ' placeholder="Nomor identitas / username" autocomplete="off"></div>' +
            '<div><label class="l" for="hrEName">Nama lengkap</label><input class="form-control" id="hrEName" value="' + esc(d.name) + '" placeholder="Nama lengkap"></div>' +
            '<div><label class="l" for="hrEPhone">No. telepon / WA</label><input class="form-control" id="hrEPhone" value="' + esc(d.phone) + '" inputmode="tel" placeholder="08xxxxxxxxxx"></div>' +
            '<div><label class="l" for="hrEMaps">Link Maps (opsional)</label><input class="form-control" type="url" id="hrEMaps" value="' + esc(d.maps) + '" placeholder="https://maps.google.com/..."></div>' +
            '<div class="full"><label class="l" for="hrEAddr">Alamat</label><textarea class="form-control" id="hrEAddr" rows="2" placeholder="Jalan, RT/RW, kelurahan, kecamatan">' + esc(d.address) + '</textarea></div></div>' +
            '<div class="hr-sec"><h5><i class="fa-solid fa-briefcase"></i> Pekerjaan &amp; gaji</h5><div class="hr-f">' +
            '<div><label class="l" for="hrERole">Jabatan</label><select class="form-control" id="hrERole">' + ROLES.map(function (r) { return '<option' + (d.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="l" for="hrEStatus">Status kerja</label><select class="form-control" id="hrEStatus"><option value="Aktif"' + (isActive(d) ? ' selected' : '') + '>Aktif</option><option value="Non-Aktif (Resign)"' + (!isActive(d) ? ' selected' : '') + '>Non-Aktif (Resign)</option></select></div>' +
            '<div><label class="l" for="hrESalary">Gaji pokok / bulan (Rp)</label><input class="form-control" type="number" min="0" id="hrESalary" value="' + esc(d.salary) + '"></div>' +
            '<div><label class="l" for="hrEFood">Uang makan / hari masuk (Rp)</label><input class="form-control" type="number" min="0" id="hrEFood" value="' + esc(d.food) + '"></div></div></div>' +
            '<div class="hr-sec"><h5><i class="fa-solid fa-key"></i> PIN absensi</h5><div class="hr-f"><div><label class="l" for="hrEPin">PIN 4 angka</label><div style="display:flex;gap:6px"><input class="form-control" id="hrEPin" type="password" inputmode="numeric" maxlength="4" value="" placeholder="' + (S.pinNiks.indexOf(String(d.nik || '')) >= 0 ? 'Kosongkan bila tidak diganti' : '4 angka') + '" autocomplete="new-password"><button type="button" class="hr-btn sm" data-act="pin-eye" title="Tampilkan / sembunyikan"><i class="fa-solid fa-eye"></i></button><button type="button" class="hr-btn sm" data-act="pin-rand" title="Acak">Acak</button></div>' +
            '<small class="h">Dipakai untuk Clock IN/OUT dan sebagai password awal akun login. PIN disimpan terenkripsi (hash) dan tidak bisa dilihat kembali. Hindari PIN mudah (0000, 1234).</small></div></div></div>' +
            '<div class="hr-sec"><h5><i class="fa-solid fa-folder-open"></i> Dokumen karyawan</h5><div class="hr-docs">' +
            DOCS.map(function (x) { return '<div class="hr-doc"><label class="l" for="' + x[1] + '">' + x[2] + '</label><input type="file" class="form-control" id="' + x[1] + '" accept="' + x[3] + '"><div class="pv" id="pv-' + x[1] + '">' + filePv(S.oldFiles[x[0]], x[2]) + '</div></div>'; }).join('') + '</div></div>' +
            '<div id="hrEmpErr" style="margin-top:12px"></div><div class="hr-mf"><button type="button" class="hr-btn" data-act="close">Batal</button><button type="submit" class="hr-btn pri" id="hrEmpSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Karyawan</button></div></form>');
    }

    function readFile(file) {
        return new Promise(function (resolve) {
            if (!file) { resolve(''); return; }
            var r = new FileReader();
            if (file.type === 'application/pdf') { r.onload = function (ev) { resolve(ev.target.result); }; r.readAsDataURL(file); return; }
            r.onload = function (ev) {
                var img = new Image();
                img.onload = function () {
                    var c = document.createElement('canvas'), w = img.width, h = img.height, MAX = 800;
                    if (w > h && w > MAX) { h *= MAX / w; w = MAX; } else if (h > MAX) { w *= MAX / h; h = MAX; }
                    c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); resolve(c.toDataURL('image/jpeg', 0.6));
                };
                img.onerror = function () { resolve(''); };
                img.src = ev.target.result;
            };
            r.readAsDataURL(file);
        });
    }
    function uploadStored(value, category, filename) {
        if (!value || typeof window.uploadBase64FileToFolder !== 'function') return Promise.resolve(value || '');
        return Promise.resolve(window.uploadBase64FileToFolder(value, category, filename));
    }
    function accessRoleFor(role) {
        var r = String(role || '').toLowerCase();
        if (r.indexOf('supervisor') >= 0) return 'supervisor'; if (r.indexOf('admin') >= 0) return 'admin'; if (r.indexOf('kasir') >= 0) return 'kasir';
        if (r.indexOf('teller') >= 0) return 'teller'; if (r.indexOf('kurir') >= 0) return 'kurir'; if (r.indexOf('keamanan') >= 0) return 'keamanan'; return 'teller';
    }
    function userIdFor(nik) { var s = String(nik || '').replace(/[^a-z0-9_-]/gi, '').toLowerCase(); return s ? 'hris_' + s : 'hris_' + Date.now(); }

    async function syncToUserAccess(emp, pin) {
        if (!emp || !emp.nik || typeof getUsers !== 'function' || typeof saveUsers !== 'function') return false;
        var username = String(emp.nik).trim(), lower = username.toLowerCase(), users = getUsers();
        var idx = users.findIndex(function (u) { return String(u.hrisNik || '').toLowerCase() === lower || String(u.username || '').toLowerCase() === lower; });
        var next = { username: username, fullName: emp.name, role: accessRoleFor(emp.role), photo: emp.photo || '', hrisNik: emp.nik, hrisEmployee: true, hrisStatus: emp.status || 'Aktif' };
        if (idx >= 0) users[idx] = Object.assign({}, users[idx], next, { id: users[idx].id || userIdFor(emp.nik) });
        else users.push(Object.assign({ id: userIdFor(emp.nik) }, next));
        saveUsers(users);
        if (typeof loadUsersTable === 'function') loadUsersTable();
        try {
            var request = window.authFetch || fetch;
            var remote = typeof window.refreshServerUsers === 'function' ? await window.refreshServerUsers() : [];
            var ru = (Array.isArray(remote) ? remote : []).filter(function (u) { return String(u.username || '').toLowerCase() === lower; })[0];
            var res = await request('api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: (ru && ru.id) || '', username: username, fullName: emp.name, role: next.role, photo: emp.photo || '', password: pin ? String(pin) : '' }) });
            var out = await res.json().catch(function () { return {}; });
            if (!res.ok) throw new Error(out.message || 'Akun pengguna gagal disimpan ke server.');
            if (out.user) {
                var li = users.findIndex(function (u) { return String(u.username || '').toLowerCase() === lower; });
                if (li >= 0) users[li] = Object.assign({}, users[li], out.user, next);
                saveUsers(users);
            }
            if (typeof loadUsersTable === 'function') await loadUsersTable();
            return true;
        } catch (err) { console.warn('Sinkronisasi akun akses belum berhasil:', err); return false; }
    }

    var WEAK_PINS = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','2345','3456','4567','5678','6789','0123','1212','2580','1122','0852'];
    function randomPin() { var p; do { p = String(Math.floor(1000 + Math.random() * 9000)); } while (WEAK_PINS.indexOf(p) >= 0); return p; }
    async function loadPinStatus() {
        try {
            if (!canManage()) return;
            var request = window.authFetch || fetch;
            var res = await request('api/hris/pins', { headers: { 'Accept': 'application/json' } });
            if (!res.ok) return;
            var out = await res.json().catch(function () { return {}; });
            S.pinNiks = Array.isArray(out.niks) ? out.niks.map(String) : [];
            // Bersihkan sisa PIN teks biasa di cache lokal untuk karyawan yang PIN-nya sudah aman di server.
            var list = EMP(), dirty = false;
            list.forEach(function (e) { if (e && e.pin !== undefined && S.pinNiks.indexOf(String(e.nik)) >= 0) { delete e.pin; dirty = true; } });
            if (dirty) saveHrisEmployees(list);
        } catch (e) { /* abaikan */ }
    }
    async function savePinRemote(nik, pin) {
        var request = window.authFetch || fetch;
        var res = await request('api/hris/pins', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ nik: nik, pin: pin }) });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error((out.errors && out.errors.pin && out.errors.pin[0]) || out.message || 'PIN gagal disimpan ke server.');
        if (S.pinNiks.indexOf(String(nik)) < 0) S.pinNiks.push(String(nik));
    }
    async function saveEmp(form) {
        var err = $('hrEmpErr'), editNik = form.dataset.edit;
        var v = function (id) { return ($(id).value || '').trim(); };
        var nik = v('hrENik'), name = v('hrEName'), pin = v('hrEPin');
        var fail = function (m) { err.innerHTML = '<div class="hr-msg bad">' + esc(m) + '</div>'; };
        if (!nik) return fail('NIK / User wajib diisi.');
        if (!name) return fail('Nama lengkap wajib diisi.');
        var hasPin = S.pinNiks.indexOf(String(editNik || nik)) >= 0;
        if (pin === '' && hasPin) { /* PIN lama dipertahankan */ }
        else if (!/^\d{4}$/.test(pin)) return fail('PIN harus 4 angka.');
        else if (WEAK_PINS.indexOf(pin) >= 0) return fail('PIN terlalu mudah ditebak. Pilih PIN lain.');
        if (!editNik && EMP().some(function (e) { return String(e.nik).toLowerCase() === nik.toLowerCase(); })) return fail('NIK / User sudah terdaftar. Gunakan tombol Edit pada karyawan tersebut.');
        var btn = $('hrEmpSave'), old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...'; err.innerHTML = '';
        try {
            var files = {};
            for (var i = 0; i < DOCS.length; i++) {
                var x = DOCS[i], f = $(x[1]).files[0];
                var val = f ? await readFile(f) : S.oldFiles[x[0]];
                var cat = (x[0] === 'photo' || x[0] === 'photoFull') ? 'hris/photos' : 'hris/documents';
                var nm = { photo: 'foto-close-up', photoFull: 'foto-full-body', ktp: 'ktp', sim: 'sim', ijazah: 'ijazah' }[x[0]];
                files[x[0]] = await uploadStored(val, cat, nik + '-' + nm);
            }
            var data = { nik: nik, name: name, phone: v('hrEPhone'), maps: v('hrEMaps'), address: v('hrEAddr'), role: $('hrERole').value, status: $('hrEStatus').value,
                salary: num($('hrESalary').value), food: num($('hrEFood').value), notes: (EMP().filter(function (e) { return e.nik === nik; })[0] || {}).notes || '',
                photo: files.photo, photoFull: files.photoFull, ktp: files.ktp, sim: files.sim, ijazah: files.ijazah };
            var list = EMP(), at = list.findIndex(function (e) { return e.nik === nik; });
            if (at >= 0) { list[at] = Object.assign({}, list[at], data); delete list[at].pin; } else list.push(data);
            saveHrisEmployees(list);
            if (pin) await savePinRemote(nik, pin);
            var synced = await syncToUserAccess(data, pin);
            closeModal(); refresh();
            toast(synced ? 'Karyawan tersimpan. Akun login ikut dibuat/diperbarui.' : 'Karyawan tersimpan, tetapi akun login belum tersinkron. Pastikan Anda login sebagai Owner atau Superadmin.', !synced);
        } catch (ex) {
            console.error(ex); btn.disabled = false; btn.innerHTML = old; fail(ex && ex.message && /PIN/.test(ex.message) ? ex.message : 'Gagal memproses berkas. Coba file lain atau ukuran lebih kecil.');
        }
    }

    /* ---------- Jadwal (dipakai Absensi & Shift) ---------- */
    function dateOnly(value) {
        if (!value) return null;
        var d = new Date(value + (String(value).indexOf('T') >= 0 ? '' : 'T00:00:00'));
        if (isNaN(d.getTime())) return null; d.setHours(0, 0, 0, 0); return d;
    }
    function scheduleCode(entry) {
        if (!entry) return { code: '', cls: '', label: '' };
        if (entry.type === 'JADWAL_SHIFT') {
            var n = String(entry.shiftName || 'Shift').toLowerCase(), code = 'P', cls = 'sch-p';
            if (n.indexOf('midle') >= 0 || n.indexOf('middle') >= 0) { code = 'M'; cls = 'sch-midle'; }
            else if (n.indexOf('malam') >= 0 || n.indexOf('night') >= 0) code = 'M';
            else if (n.indexOf('siang') >= 0 || n.indexOf('sore') >= 0) { code = 'S'; cls = 'sch-shift-s'; }
            return { code: code, cls: cls, label: ((entry.shiftName || 'Jadwal') + ' ' + (entry.startTime || '') + '-' + (entry.endTime || '')).trim() };
        }
        if (entry.type === 'LIBUR_SHIFT') return { code: 'O', cls: 'sch-o', label: 'Libur / Off Shift' };
        if (entry.type === 'CUTI') return { code: 'C', cls: 'sch-c', label: 'Cuti' };
        if (entry.type === 'IZIN') return { code: 'I', cls: 'sch-i', label: 'Izin' };
        if (entry.type === 'SAKIT') return { code: 'S', cls: 'sch-s', label: 'Sakit' };
        return { code: '-', cls: 'sch-o', label: entry.type || '-' };
    }
    function findSchedule(entries, nik, date) {
        var d = typeof date === 'string' ? dateOnly(date) : date;
        var m = entries.filter(function (e) { if (e.nik !== nik) return false; var s = dateOnly(e.startDate), en = dateOnly(e.endDate); return s && en && d >= s && d <= en; });
        var pr = { SAKIT: 5, CUTI: 4, IZIN: 3, LIBUR_SHIFT: 2, JADWAL_SHIFT: 1 };
        return m.sort(function (a, b) { return (pr[b.type] || 0) - (pr[a.type] || 0); })[0] || null;
    }

    /* ---------- 2. Absensi ---------- */
    function paintAtt() {
        var box = $('hris-tab-att'); if (!box) return;
        var act = EMP().filter(isActive), manage = canManage();
        var selKeep = $('hrAttEmp') ? $('hrAttEmp').value : '';
        box.innerHTML = '<div class="hr-grid2"><div class="hr-card"><h3>Absensi Hari Ini</h3><p class="sub">Pilih nama Anda, masukkan PIN, lalu tekan Clock IN atau Clock OUT.</p>' +
            '<div class="hr-clock" id="hrClock">' + new Date().toLocaleTimeString('id-ID', { hour12: false }) + '</div><div class="hr-date">' + new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</div>' +
            '<label class="l" for="hrAttEmp">Nama karyawan</label><select class="form-control" id="hrAttEmp"><option value="">-- Pilih nama Anda --</option>' + act.map(function (e) { return '<option value="' + esc(e.nik) + '"' + (e.nik === selKeep ? ' selected' : '') + '>' + esc(e.name) + ' (' + esc(e.role) + ')</option>'; }).join('') + '</select>' +
            '<div id="hrAttInfo" style="margin:10px 0"></div><label class="l" for="hrAttPin">PIN absensi</label><input class="form-control hr-pin" id="hrAttPin" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off">' +
            '<div class="hr-inout"><button class="hr-btn ok" data-act="clock" data-type="IN"><i class="fa-solid fa-right-to-bracket"></i> Clock IN</button><button class="hr-btn dng" style="border-color:#ef4444" data-act="clock" data-type="OUT"><i class="fa-solid fa-right-from-bracket"></i> Clock OUT</button></div>' +
            '<div id="hrAttMsg" style="margin-top:12px" role="status" aria-live="polite"></div></div>' +
            '<div class="hr-card"><div class="hr-tool" style="margin-bottom:8px"><h3 style="margin:0;flex:1">Rekap Absensi</h3><button class="hr-btn sm" data-act="att-prev" aria-label="Hari sebelumnya"><i class="fa-solid fa-chevron-left"></i></button><input type="date" class="form-control" id="hrAttDate" value="' + esc(S.attDate) + '" style="width:auto"><button class="hr-btn sm" data-act="att-next" aria-label="Hari berikutnya"><i class="fa-solid fa-chevron-right"></i></button>' +
            (manage ? '<button class="hr-btn sm pri" data-act="att-add"><i class="fa-solid fa-plus"></i> Tambah Manual</button>' : '') + '</div><div id="hrAttTable"></div></div></div>';
        paintAttTable(); paintAttInfo();
    }
    function attFor(nik, date) { return ATT().filter(function (a) { return a.nik === nik && a.date === date; })[0]; }
    function paintAttInfo() {
        var el = $('hrAttInfo'), sel = $('hrAttEmp'); if (!el || !sel) return;
        var nik = sel.value; if (!nik) { el.innerHTML = ''; return; }
        var today = ymd(), log = attFor(nik, today), sc = findSchedule(LVE(), nik, today), out = [];
        if (sc) { var l = scheduleCode(sc); out.push('<span class="hr-b ' + ((LEAVE_TYPES[sc.type] || [])[1] || 'n') + '">Jadwal: ' + esc(l.label) + '</span>'); }
        else out.push('<span class="hr-b n">Belum ada jadwal hari ini</span>');
        out.push(log ? (log.out_time ? '<span class="hr-b g">Selesai &middot; ' + esc(normT(log.in_time)) + ' - ' + esc(normT(log.out_time)) + '</span>' : '<span class="hr-b a">Bekerja sejak ' + esc(normT(log.in_time)) + '</span>') : '<span class="hr-b n">Belum Clock IN</span>');
        var warn = sc && (sc.type === 'CUTI' || sc.type === 'SAKIT' || sc.type === 'IZIN') ? '<div class="hr-msg warn" style="margin-top:8px">Hari ini tercatat ' + esc(LEAVE_TYPES[sc.type][0]) + '. Clock IN tetap bisa dilakukan, tetapi mohon konfirmasi ke atasan.</div>' : '';
        el.innerHTML = '<div class="hr-chips">' + out.join(' ') + '</div>' + warn;
    }
    function paintAttTable() {
        var box = $('hrAttTable'); if (!box) return;
        var date = S.attDate, logs = ATT().filter(function (a) { return a.date === date; });
        var act = EMP().filter(isActive), lv = LVE();
        var missing = act.filter(function (e) { return !logs.some(function (l) { return l.nik === e.nik; }); });
        var manage = canManage();
        var rows = logs.map(function (l) {
            var a = toMin(l.in_time), b = toMin(l.out_time), dur = (a != null && b != null && b >= a) ? Math.floor((b - a) / 60) + 'j ' + pad((b - a) % 60) + 'm' : '-';
            return '<tr><td><b>' + esc(l.name) + '</b><div style="color:var(--mut);font-size:.72rem">' + esc(l.role) + '</div></td><td class="c"><b style="color:#34d399">' + esc(normT(l.in_time) || '-') + '</b></td><td class="c"><b style="color:#f87171">' + esc(normT(l.out_time) || '-') + '</b></td><td class="c">' + dur + '</td>' +
                '<td>' + (l.out_time ? '<span class="hr-b g">Selesai</span>' : '<span class="hr-b a">Bekerja</span>') + (num(l.late_min) > 0 ? ' <span class="hr-b r">Terlambat ' + num(l.late_min) + ' mnt</span>' : '') + '</td>' +
                (manage ? '<td class="r" style="white-space:nowrap"><button class="hr-btn sm" data-act="att-edit" data-id="' + esc(l.id) + '" aria-label="Koreksi"><i class="fa-solid fa-pen"></i></button> <button class="hr-btn sm dng" data-act="att-del-ask" data-id="' + esc(l.id) + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></td>' : '') + '</tr>';
        }).join('');
        var miss = missing.map(function (e) {
            var sc = findSchedule(lv, e.nik, date), l = sc ? scheduleCode(sc) : null;
            return '<span class="hr-chip">' + esc(e.name) + (l ? ' &middot; ' + esc(l.label) : '') + '</span>';
        }).join('');
        box.innerHTML = (rows ? '<div class="hr-wrap"><table class="hr-table"><thead><tr><th>Karyawan</th><th class="c">Masuk</th><th class="c">Pulang</th><th class="c">Durasi</th><th>Status</th>' + (manage ? '<th></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="hr-empty"><i class="fa-regular fa-clock"></i>Belum ada absensi pada ' + dateLabel(date) + '.</div>') +
            (miss && act.length ? '<div style="margin-top:14px"><div style="font-size:.76rem;font-weight:700;color:var(--mut);margin-bottom:6px">Belum absen (' + missing.length + ')</div><div class="hr-chips">' + miss + '</div></div>' : '');
    }
    var clockBusy = false;
    async function clock(type) {
        if (clockBusy) return;
        var msg = $('hrAttMsg'), nik = $('hrAttEmp').value, pin = $('hrAttPin').value.trim();
        var say = function (cls, t) { msg.innerHTML = '<div class="hr-msg ' + cls + '">' + esc(t) + '</div>'; };
        if (Date.now() < S.pinLockUntil) return say('bad', 'Terlalu banyak PIN salah. Coba lagi dalam ' + Math.ceil((S.pinLockUntil - Date.now()) / 1000) + ' detik.');
        if (!nik) return say('bad', 'Pilih nama Anda terlebih dahulu.');
        if (!/^\d{4}$/.test(pin)) return say('bad', 'Masukkan PIN 4 angka.');
        var emp = EMP().filter(function (e) { return e.nik === nik; })[0];
        if (!emp) return say('bad', 'Karyawan tidak ditemukan.');
        clockBusy = true;
        var vr = null, out = {};
        try {
            var request = window.authFetch || fetch;
            vr = await request('api/hris/pins/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ nik: nik, pin: pin }) });
            out = await vr.json().catch(function () { return {}; });
        } catch (ex) { clockBusy = false; return say('bad', 'Server tidak terjangkau. Coba lagi.'); }
        clockBusy = false;
        if (!vr.ok || !out.ok) {
            $('hrAttPin').value = '';
            if (out.locked) { S.pinLockUntil = Date.now() + (Number(out.retry_after) || 60) * 1000; return say('bad', (out.message || 'Absensi dikunci sementara.') + ' Coba lagi dalam ' + (Number(out.retry_after) || 60) + ' detik.'); }
            return say('bad', (out.message || 'PIN salah.') + (out.remaining != null ? ' Sisa percobaan: ' + out.remaining + '.' : ''));
        }
        var atts = ATT(), today = ymd(), now = hm(), idx = atts.findIndex(function (a) { return a.nik === nik && a.date === today; });
        if (type === 'IN') {
            if (idx !== -1) return say('warn', 'Anda sudah Clock IN hari ini pukul ' + normT(atts[idx].in_time) + '.');
            var sc = findSchedule(LVE(), nik, today), late = 0, shiftInfo = '';
            if (sc && sc.type === 'JADWAL_SHIFT' && toMin(sc.startTime) != null) { late = Math.max(0, toMin(now) - toMin(sc.startTime)); shiftInfo = sc.shiftName || ''; }
            atts.push({ id: Date.now().toString(), nik: emp.nik, name: emp.name, role: emp.role, date: today, in_time: now, out_time: null, late_min: late, shift: shiftInfo });
            say(late > 0 ? 'warn' : 'ok', 'Clock IN berhasil pukul ' + now + (late > 0 ? '. Terlambat ' + late + ' menit dari jadwal ' + sc.startTime + '.' : '. Selamat bekerja!'));
        } else {
            if (idx === -1) return say('warn', 'Anda belum Clock IN hari ini.');
            if (atts[idx].out_time) return say('warn', 'Anda sudah Clock OUT pukul ' + normT(atts[idx].out_time) + '.');
            atts[idx].out_time = now; say('ok', 'Clock OUT berhasil pukul ' + now + '. Terima kasih, hati-hati di jalan.');
        }
        $('hrAttPin').value = ''; saveHrisAttendance(atts); paintAttTable(); paintAttInfo(); paintKpis();
    }
    function attModal(id) {
        var l = id ? ATT().filter(function (a) { return a.id === id; })[0] : null, act = EMP().filter(isActive);
        openModal(mh(l ? 'Koreksi Absensi' : 'Tambah Absensi Manual', l ? l.name + ' · ' + dateLabel(l.date) : 'Untuk karyawan yang lupa Clock IN/OUT') +
            '<form id="hrAttForm" data-id="' + esc(id || '') + '"><div class="hr-f">' +
            (l ? '' : '<div class="full"><label class="l" for="hrAfEmp">Karyawan</label><select class="form-control" id="hrAfEmp">' + act.map(function (e) { return '<option value="' + esc(e.nik) + '">' + esc(e.name) + '</option>'; }).join('') + '</select></div><div class="full"><label class="l" for="hrAfDate">Tanggal</label><input type="date" class="form-control" id="hrAfDate" value="' + esc(S.attDate) + '"></div>') +
            '<div><label class="l" for="hrAfIn">Jam masuk</label><input type="time" class="form-control" id="hrAfIn" value="' + esc(normT(l && l.in_time)) + '"></div><div><label class="l" for="hrAfOut">Jam pulang</label><input type="time" class="form-control" id="hrAfOut" value="' + esc(normT(l && l.out_time)) + '"></div></div>' +
            '<small class="h">Koreksi tercatat atas nama Anda. Kosongkan jam pulang bila karyawan masih bekerja.</small><div id="hrAfErr" style="margin-top:10px"></div><div class="hr-mf"><button type="button" class="hr-btn" data-act="close">Batal</button><button type="submit" class="hr-btn pri">Simpan</button></div></form>', true);
    }
    function saveAtt(form) {
        var id = form.dataset.id, inT = $('hrAfIn').value, outT = $('hrAfOut').value, err = $('hrAfErr');
        var fail = function (m) { err.innerHTML = '<div class="hr-msg bad">' + esc(m) + '</div>'; };
        if (!inT) return fail('Jam masuk wajib diisi.');
        if (outT && toMin(outT) < toMin(inT)) return fail('Jam pulang tidak boleh lebih awal dari jam masuk.');
        var atts = ATT();
        if (id) { var l = atts.filter(function (a) { return a.id === id; })[0]; if (!l) return fail('Data tidak ditemukan.'); l.in_time = inT; l.out_time = outT || null; l.edited_by = actor(); }
        else {
            var nik = $('hrAfEmp').value, date = $('hrAfDate').value, emp = EMP().filter(function (e) { return e.nik === nik; })[0];
            if (!emp || !date) return fail('Pilih karyawan dan tanggal.');
            if (atts.some(function (a) { return a.nik === nik && a.date === date; })) return fail('Karyawan ini sudah punya absensi pada tanggal tersebut. Gunakan tombol koreksi.');
            atts.push({ id: Date.now().toString(), nik: nik, name: emp.name, role: emp.role, date: date, in_time: inT, out_time: outT || null, late_min: 0, edited_by: actor(), manual: true });
        }
        saveHrisAttendance(atts); closeModal(); paintAttTable(); paintKpis(); toast('Absensi disimpan.');
    }

    /* ---------- Kalender: view / cetak / JPEG (dipertahankan dari versi sebelumnya) ---------- */
function buildHrisScheduleCalendarStandaloneHtml(options = {}) {
    const table = document.getElementById('hrisScheduleCalendarTable');
    const month = document.getElementById('hrisScheduleMonth')?.value || new Date().toISOString().slice(0, 7);
    if(!table) return '';

    const [year, monthNum] = month.split('-').map(Number);
    const titleDate = new Date(year, monthNum - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const shouldPrint = options.print === true;
    const shouldDownload = options.download === true;
    const filename = `jadwal-shift-cuti-${month}.jpeg`;

    return `
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Jadwal Shift ${titleDate}</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: Arial, sans-serif;
                    color:#e5e7eb;
                    margin: 0;
                    background: #0f172a;
                }
                .page {
                    padding: 18px;
                    min-width: 980px;
                }
                .topbar {
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:14px;
                    margin-bottom: 12px;
                }
                h2 { margin: 0 0 5px; color:#fff; letter-spacing:0; }
                p { margin: 0; color:#cbd5e1; }
                .actions { display:flex; gap:8px; flex-wrap:wrap; }
                .actions button {
                    border:0;
                    border-radius:6px;
                    padding:9px 12px;
                    background:#2563eb;
                    color:#fff;
                    font-weight:700;
                    cursor:pointer;
                }
                .actions .download {
                    background:#10b981;
                }
                table {
                    width:100%;
                    border-collapse: collapse;
                    font-size: 10px;
                    table-layout: fixed;
                    background:#111827;
                }
                th, td {
                    border:1px solid #334155;
                    padding:5px 3px;
                    text-align:center;
                    vertical-align:middle;
                }
                th {
                    background:#1e293b;
                    color:#bfdbfe;
                }
                th:first-child, td:first-child {
                    width:130px;
                    text-align:left;
                    background:#1e293b;
                    color:#fff;
                }
                .text-muted, small { color:#94a3b8; }
                .sch {
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    min-width:18px;
                    height:18px;
                    padding:1px 4px;
                    border-radius:3px;
                    color:#fff !important;
                    font-weight:800;
                    text-align:center;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .sch-p { background:#2563eb !important; }
                .sch-shift-s { background:#10b981 !important; }
                .sch-midle { background:#8b5cf6 !important; }
                .sch-o { background:#64748b !important; }
                .sch-c { background:#dc2626 !important; }
                .sch-i { background:#f59e0b !important; color:#111827 !important; }
                .sch-s { background:#ec4899 !important; }
                .legend {
                    display:flex;
                    gap:12px;
                    flex-wrap:wrap;
                    margin:12px 0;
                    font-size:12px;
                    color:#e5e7eb;
                }
                .table-shell {
                    overflow:auto;
                    border:1px solid #334155;
                    border-radius:8px;
                }
                .signature {
                    display:flex;
                    justify-content:flex-end;
                    margin-top:28px;
                    font-size:11px;
                    color:#e5e7eb;
                }
                @media (max-width: 900px) {
                    body { overflow-x:auto; }
                    .page { padding:12px; }
                    .topbar { flex-direction:column; }
                    table { font-size:9px; }
                }
                @media print {
                    body { background:#fff; color:#111827; }
                    .page { padding: 0; min-width: 0; width: 100%; }
                    .actions { display:none; }
                    h2, p { color:#111827; text-align:center; }
                    .table-shell { overflow: visible; border: 0; border-radius: 0; }
                    table { background:#fff; color:#111827; font-size:7px; width: 100%; table-layout: fixed; }
                    th:first-child, td:first-child { width: 105px; }
                    th, td { border-color:#334155; color:#111827; }
                    th, th:first-child, td:first-child { background:#e2e8f0 !important; color:#111827; }
                    .legend, .signature { color:#111827; }
                    .sch { min-width: 14px; height: 14px; font-size: 8px; padding: 0 3px; }
                    small { font-size: 7px; }
                    @page { size: A4 landscape; margin: 8mm; }
                }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="topbar">
                    <div>
                        <h2>JADWAL SHIFT & CUTI KARYAWAN</h2>
                        <p>Periode ${titleDate}</p>
                    </div>
                    <div class="actions">
                        <button class="download" onclick="if(window.opener && window.opener.downloadHrisScheduleCalendarJpeg){ window.opener.downloadHrisScheduleCalendarJpeg(); } else { alert('Buka dari halaman Shift & Cuti lalu klik Download JPEG.'); }">Download JPEG</button>
                        <button onclick="window.print()">Print</button>
                    </div>
                </div>
                <div class="legend">
                    <span><b class="sch sch-p">P</b> Shift/Jadwal</span>
                    <span><b class="sch sch-shift-s">S</b> Shift Siang</span>
                    <span><b class="sch sch-midle">M</b> Shift Midle</span>
                    <span><b class="sch sch-o">O</b> Off</span>
                    <span><b class="sch sch-c">C</b> Cuti</span>
                    <span><b class="sch sch-i">I</b> Izin</span>
                    <span><b class="sch sch-s">S</b> Sakit</span>
                </div>
                <div class="table-shell">${table.outerHTML}</div>
                <div class="signature">
                    <div style="text-align:center; min-width:180px;">
                        Dibuat oleh,<br><br><br>
                        ____________________
                    </div>
                </div>
            </div>
            <script>
                function downloadScheduleJpeg() {
                    var page = document.querySelector('.page');
                    if (!page) return;
                    var clone = page.cloneNode(true);
                    var actions = clone.querySelector('.actions');
                    if (actions) actions.remove();
                    var shell = clone.querySelector('.table-shell');
                    if (shell) {
                        shell.style.overflow = 'visible';
                        shell.style.maxHeight = 'none';
                    }
                    var width = Math.ceil(Math.max(page.scrollWidth, page.offsetWidth, 980));
                    var height = Math.ceil(Math.max(page.scrollHeight, page.offsetHeight, 520));
                    clone.style.position = 'static';
                    clone.style.left = 'auto';
                    clone.style.top = 'auto';
                    clone.style.width = width + 'px';
                    clone.style.background = '#0f172a';
                    var serialized = new XMLSerializer().serializeToString(clone);
                    var styleText = document.querySelector('style') ? document.querySelector('style').textContent : '';
                    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
                        '<foreignObject width="100%" height="100%">' +
                        '<div xmlns="http://www.w3.org/1999/xhtml"><style>' + styleText + '</style>' + serialized + '</div>' +
                        '</foreignObject></svg>';
                    var img = new Image();
                    img.onload = function() {
                        var canvas = document.createElement('canvas');
                        canvas.width = width * 2;
                        canvas.height = height * 2;
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        var link = document.createElement('a');
                        link.download = '${filename}';
                        link.href = canvas.toDataURL('image/jpeg', 0.92);
                        link.click();
                        URL.revokeObjectURL(objectUrl);
                    };
                    img.onerror = function() {
                        alert('Gagal membuat JPEG jadwal. Coba gunakan Print atau buka ulang view jadwal.');
                    };
                    var objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
                    img.src = objectUrl;
                }
                ${shouldDownload ? 'window.onload = function(){ if(window.opener && window.opener.downloadHrisScheduleCalendarJpeg) window.opener.downloadHrisScheduleCalendarJpeg(); };' : ''}
            <\/script>
            ${shouldPrint ? '<script>window.onload = function(){ window.print(); }<\/script>' : ''}
        </body>
        </html>
    `;
}

window.openHrisScheduleCalendarView = function() {
    const html = buildHrisScheduleCalendarStandaloneHtml({ print: false });
    if(!html) return;
    const printWindow = window.open('', '_blank');
    if(!printWindow) return alert('Popup diblokir browser. Izinkan popup untuk membuka view jadwal.');
    printWindow.document.write(html);
    printWindow.document.close();
};

window.printHrisScheduleCalendar = function() {
    const html = buildHrisScheduleCalendarStandaloneHtml({ print: true });
    if(!html) return;
    const printWindow = window.open('', '_blank');
    if(!printWindow) return alert('Popup print diblokir browser. Izinkan popup untuk aplikasi ini.');
    printWindow.document.write(html);
    printWindow.document.close();
};

window.downloadHrisScheduleCalendarJpeg = function() {
    const table = document.getElementById('hrisScheduleCalendarTable');
    const month = document.getElementById('hrisScheduleMonth')?.value || new Date().toISOString().slice(0, 7);
    if(!table) return;

    const [year, monthNum] = month.split('-').map(Number);
    const titleDate = new Date(year, monthNum - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const filename = `jadwal-shift-cuti-${month}.jpeg`;

    const headerCells = Array.from(table.querySelectorAll('thead th'));
    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
    if(headerCells.length <= 1 || bodyRows.length === 0) {
        alert('Belum ada data jadwal untuk didownload.');
        return;
    }

    const days = headerCells.slice(1).map(th => {
        const parts = th.innerText.trim().split(/\s+/);
        return { day: parts[0] || '', dow: parts[1] || '' };
    });
    const rows = bodyRows.map(tr => {
        const cells = Array.from(tr.children);
        const nameParts = (cells[0]?.innerText || '').trim().split(/\n+/);
        return {
            name: nameParts[0] || '-',
            role: nameParts[1] || '',
            cells: cells.slice(1).map(td => {
                const badge = td.querySelector('.sch');
                const time = td.querySelector('small')?.innerText || '';
                return {
                    code: badge ? badge.innerText.trim() : '',
                    className: badge ? badge.className : '',
                    time
                };
            })
        };
    });

    const scale = 2;
    const width = 1754; // A4 landscape ratio at screen-friendly resolution
    const height = 1240;
    const margin = 28;
    const contentW = width - (margin * 2);
    const nameW = 160;
    const dayW = (contentW - nameW) / days.length;
    const headH = 44;
    const rowH = Math.max(36, Math.min(48, (height - margin - 78 - 34 - headH - 112 - margin) / Math.max(rows.length, 1)));
    const legendH = 34;
    const titleH = 78;
    const signatureH = 92;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const drawText = (text, x, y, options = {}) => {
        ctx.font = `${options.weight || 400} ${options.size || 12}px Arial`;
        ctx.fillStyle = options.color || '#e5e7eb';
        ctx.textAlign = options.align || 'left';
        ctx.textBaseline = options.baseline || 'alphabetic';
        ctx.fillText(String(text || ''), x, y);
    };
    const drawCell = (x, y, w, h, fill = '#111827') => {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    };
    const badgeColor = className => {
        if(className.includes('sch-shift-s')) return '#10b981';
        if(className.includes('sch-midle')) return '#8b5cf6';
        if(className.includes('sch-o')) return '#64748b';
        if(className.includes('sch-c')) return '#dc2626';
        if(className.includes('sch-i')) return '#f59e0b';
        if(className.includes('sch-s')) return '#ec4899';
        return '#2563eb';
    };
    const drawBadge = (code, className, x, y, size = 22) => {
        if(!code) return;
        ctx.fillStyle = badgeColor(className);
        ctx.beginPath();
        const r = 4;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + size - r, y);
        ctx.quadraticCurveTo(x + size, y, x + size, y + r);
        ctx.lineTo(x + size, y + size - r);
        ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
        ctx.lineTo(x + r, y + size);
        ctx.quadraticCurveTo(x, y + size, x, y + size - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();
        drawText(code, x + size / 2, y + size / 2 + 1, {
            size: 12,
            weight: 800,
            color: className.includes('sch-i') ? '#111827' : '#ffffff',
            align: 'center',
            baseline: 'middle'
        });
    };

    drawText('JADWAL SHIFT & CUTI KARYAWAN', margin, margin + 24, { size: 28, weight: 800, color: '#ffffff' });
    drawText(`Periode ${titleDate}`, margin, margin + 54, { size: 18, color: '#cbd5e1' });

    const legend = [
        ['P', 'sch-p', 'Shift/Jadwal'],
        ['S', 'sch-shift-s', 'Shift Siang'],
        ['M', 'sch-midle', 'Shift Midle'],
        ['O', 'sch-o', 'Off'],
        ['C', 'sch-c', 'Cuti'],
        ['I', 'sch-i', 'Izin'],
        ['S', 'sch-s', 'Sakit']
    ];
    let lx = margin;
    const ly = margin + titleH + 2;
    legend.forEach(([code, cls, label]) => {
        drawBadge(code, cls, lx, ly - 15, 20);
        drawText(label, lx + 26, ly, { size: 12, color: '#ffffff' });
        lx += 116;
    });

    let x = margin;
    let y = margin + titleH + legendH;
    drawCell(x, y, nameW, headH, '#1e293b');
    drawText('Nama', x + 8, y + 25, { size: 12, weight: 700, color: '#ffffff' });
    days.forEach((d, idx) => {
        const cx = margin + nameW + (idx * dayW);
        drawCell(cx, y, dayW, headH, '#1e293b');
        drawText(d.day, cx + dayW / 2, y + 17, { size: 12, weight: 800, color: '#bfdbfe', align: 'center' });
        drawText(d.dow, cx + dayW / 2, y + 33, { size: 8, weight: 700, color: '#93c5fd', align: 'center' });
    });

    rows.forEach((row, rowIdx) => {
        const ry = y + headH + (rowIdx * rowH);
        drawCell(margin, ry, nameW, rowH, '#1e293b');
        drawText(row.name, margin + 8, ry + Math.min(20, rowH - 17), { size: 11, weight: 800, color: '#ffffff' });
        drawText(row.role, margin + 8, ry + Math.min(35, rowH - 5), { size: 9, color: '#94a3b8' });
        row.cells.forEach((cell, idx) => {
            const cx = margin + nameW + (idx * dayW);
            drawCell(cx, ry, dayW, rowH, '#111827');
            if(cell.code) {
                const badgeSize = Math.min(20, Math.max(16, dayW - 12));
                drawBadge(cell.code, cell.className, cx + (dayW - badgeSize) / 2, ry + 6, badgeSize);
                drawText(cell.time, cx + dayW / 2, ry + rowH - 7, { size: 8, color: '#93c5fd', align: 'center' });
            }
        });
    });

    const sigY = Math.min(height - margin - 60, y + headH + (rows.length * rowH) + 42);
    drawText('Dibuat oleh,', width - margin - 150, sigY, { size: 12, color: '#ffffff', align: 'center' });
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(width - margin - 220, sigY + 48);
    ctx.lineTo(width - margin - 80, sigY + 48);
    ctx.stroke();

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    document.body.appendChild(link);
    link.click();
    link.remove();
};



    /* ---------- 3. Shift & Cuti ---------- */
    function paintLeave() {
        var box = $('hris-tab-leave'); if (!box) return;
        var manage = canManage(), act = EMP().filter(isActive);
        if (S.schEmp !== 'ALL' && !act.some(function (e) { return e.nik === S.schEmp; })) S.schEmp = 'ALL';
        box.innerHTML = '<div class="hr-card"><h3>Kalender Shift &amp; Cuti</h3><p class="sub">Jadwal kerja, libur, cuti, izin, dan sakit karyawan aktif per bulan.</p>' +
            '<div class="hr-tool"><input type="month" class="form-control" id="hrisScheduleMonth" value="' + esc(S.schMonth) + '">' +
            '<select class="form-control" id="hrisScheduleEmployee"></select><span style="flex:1"></span>' +
            '<button class="hr-btn sm" data-act="cal-view"><i class="fa-solid fa-expand"></i> View</button><button class="hr-btn sm" data-act="cal-jpeg"><i class="fa-solid fa-image"></i> JPEG</button><button class="hr-btn sm" data-act="cal-print"><i class="fa-solid fa-print"></i> Cetak</button>' +
            (manage ? '<button class="hr-btn sm pri" data-act="lv-new"><i class="fa-solid fa-plus"></i> Tambah Jadwal / Cuti</button>' : '') + '</div>' +
            '<div class="hr-legend"><span><span class="sch sch-p">P</span> Pagi</span><span><span class="sch sch-midle">M</span> Midle</span><span><span class="sch sch-shift-s">S</span> Siang</span><span><span class="sch sch-o">O</span> Libur</span><span><span class="sch sch-c">C</span> Cuti</span><span><span class="sch sch-i">I</span> Izin</span><span><span class="sch sch-s">S</span> Sakit</span></div>' +
            '<div class="hr-wrap"><table class="hris-schedule-table" id="hrisScheduleCalendarTable"><thead id="hrisScheduleCalendarHead"></thead><tbody id="hrisScheduleCalendarBody"></tbody></table></div></div>' +
            (manage ? '<div class="hr-card"><h3>Jatah Cuti ' + new Date().getFullYear() + '</h3><p class="sub">Pemakaian cuti tahun berjalan dari jatah ' + CUTI_QUOTA + ' hari per karyawan.</p><div class="hr-quota" id="hrQuota"></div></div>' +
                '<div class="hr-card"><div class="hr-tool"><h3 style="margin:0;flex:1">Daftar Jadwal &amp; Pengajuan</h3><input type="month" class="form-control" id="hrLvMonth" value="' + esc(S.lvMonth) + '" title="Filter bulan"><select class="form-control" id="hrLvType"><option value="">Semua jenis</option>' +
                Object.keys(LEAVE_TYPES).map(function (k) { return '<option value="' + k + '"' + (S.lvType === k ? ' selected' : '') + '>' + LEAVE_TYPES[k][0] + '</option>'; }).join('') + '</select></div><div id="hrLvList"></div></div>' : '');
        window.renderHrisScheduleCalendar();
        if (manage) { paintQuota(); paintLvList(); }
    }

    window.renderHrisScheduleCalendar = function () {
        var monthEl = $('hrisScheduleMonth'), selEl = $('hrisScheduleEmployee'), head = $('hrisScheduleCalendarHead'), body = $('hrisScheduleCalendarBody');
        if (!monthEl || !selEl || !head || !body) return;
        if (!monthEl.value) monthEl.value = S.schMonth;
        S.schMonth = monthEl.value;
        var emps = EMP().filter(isActive), cur = selEl.value || S.schEmp || 'ALL';
        selEl.innerHTML = '<option value="ALL">Semua Karyawan</option>' + emps.map(function (e) { return '<option value="' + esc(e.nik) + '">' + esc(e.name) + '</option>'; }).join('');
        selEl.value = Array.prototype.some.call(selEl.options, function (o) { return o.value === cur; }) ? cur : 'ALL';
        S.schEmp = selEl.value;
        var p = S.schMonth.split('-').map(Number), year = p[0], month = p[1], days = new Date(year, month, 0).getDate(), entries = LVE();
        var shown = S.schEmp === 'ALL' ? emps : emps.filter(function (e) { return e.nik === S.schEmp; });
        var th = '';
        for (var d = 1; d <= days; d++) th += '<th class="hris-schedule-day">' + d + '<br><small>' + new Date(year, month - 1, d).toLocaleDateString('id-ID', { weekday: 'short' }) + '</small></th>';
        head.innerHTML = '<tr><th>Nama</th>' + th + '</tr>';
        body.innerHTML = shown.map(function (emp) {
            var tds = '';
            for (var i = 1; i <= days; i++) {
                var dt = new Date(year, month - 1, i); dt.setHours(0, 0, 0, 0);
                var en = findSchedule(entries, emp.nik, dt), it = scheduleCode(en);
                tds += '<td><div class="hris-schedule-cell">' + (en ? '<span class="sch ' + it.cls + '" title="' + esc(it.label) + '">' + it.code + '</span>' + (en.type === 'JADWAL_SHIFT' ? '<small>' + esc(en.startTime || '') + '</small>' : '') : '') + '</div></td>';
            }
            return '<tr><td><strong>' + esc(emp.name) + '</strong><br><small style="color:var(--mut)">' + esc(emp.role || emp.nik) + '</small></td>' + tds + '</tr>';
        }).join('') || '<tr><td colspan="' + (days + 1) + '" style="text-align:center;color:var(--mut)">Belum ada karyawan aktif.</td></tr>';
    };

    function cutiUsed(nik, year) {
        var n = 0;
        LVE().forEach(function (l) {
            if (l.nik !== nik || l.type !== 'CUTI') return;
            var s = dateOnly(l.startDate), e = dateOnly(l.endDate); if (!s || !e) return;
            for (var d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) if (d.getFullYear() === year) n++;
        });
        return n;
    }
    function paintQuota() {
        var el = $('hrQuota'); if (!el) return; var y = new Date().getFullYear();
        el.innerHTML = EMP().filter(isActive).map(function (e) {
            var u = cutiUsed(e.nik, y), pct = Math.min(100, Math.round(u / CUTI_QUOTA * 100));
            return '<div class="hr-q"><b>' + esc(e.name) + '</b><div class="hr-bar"><i class="' + (u >= CUTI_QUOTA ? 'full' : u >= CUTI_QUOTA * .75 ? 'hi' : '') + '" style="width:' + pct + '%"></i></div><div style="color:var(--mut);margin-top:4px">' + u + ' / ' + CUTI_QUOTA + ' hari &middot; sisa ' + Math.max(0, CUTI_QUOTA - u) + '</div></div>';
        }).join('') || '<div class="hr-empty">Belum ada karyawan aktif.</div>';
    }
    function paintLvList() {
        var el = $('hrLvList'); if (!el) return; var emps = EMP();
        var list = LVE().filter(function (l) {
            if (S.lvType && l.type !== S.lvType) return false;
            if (S.lvMonth && String(l.startDate).slice(0, 7) !== S.lvMonth && String(l.endDate).slice(0, 7) !== S.lvMonth) return false; return true;
        }).sort(function (a, b) { return String(b.startDate).localeCompare(String(a.startDate)); });
        el.innerHTML = list.length ? '<div class="hr-wrap"><table class="hr-table"><thead><tr><th>Karyawan</th><th>Mulai</th><th>Sampai</th><th>Jam / Shift</th><th>Jenis</th><th>Catatan</th><th></th></tr></thead><tbody>' +
            list.map(function (l) {
                var e = emps.filter(function (x) { return x.nik === l.nik; })[0], t = LEAVE_TYPES[l.type] || [l.type, 'n'];
                return '<tr><td><b>' + esc(e ? e.name : 'Tidak dikenal') + '</b></td><td>' + dateLabel(l.startDate) + '</td><td>' + dateLabel(l.endDate) + '</td><td>' + (l.type === 'JADWAL_SHIFT' ? esc(l.shiftName || '') + '<div style="color:var(--mut);font-size:.72rem">' + esc(l.startTime || '--') + ' - ' + esc(l.endTime || '--') + '</div>' : '-') + '</td><td><span class="hr-b ' + t[1] + '">' + t[0] + '</span></td><td>' + esc(l.remarks || '') + '</td>' +
                    '<td class="r" style="white-space:nowrap"><button class="hr-btn sm" data-act="lv-edit" data-id="' + esc(l.id) + '" aria-label="Edit"><i class="fa-solid fa-pen"></i></button> <button class="hr-btn sm dng" data-act="lv-del-ask" data-id="' + esc(l.id) + '" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></td></tr>';
            }).join('') + '</tbody></table></div>' : '<div class="hr-empty"><i class="fa-regular fa-calendar"></i>Belum ada jadwal atau pengajuan untuk filter ini.</div>';
    }

    function lvModal(id) {
        var l = id ? LVE().filter(function (x) { return x.id === id; })[0] : null, act = EMP().filter(isActive), t = ymd();
        var d = l || { type: 'JADWAL_SHIFT', shiftName: 'Shift Pagi', startTime: '08:00', endTime: '17:00', startDate: t, endDate: t };
        openModal(mh(l ? 'Edit Jadwal / Pengajuan' : 'Tambah Jadwal / Cuti', 'Satu entri bisa untuk beberapa karyawan sekaligus') +
            '<form id="hrLvForm" data-id="' + esc(id || '') + '"><div class="hr-f"><div class="full"><label class="l">Karyawan</label>' +
            (l ? '<select class="form-control" id="hrLvEmpOne">' + EMP().map(function (e) { return '<option value="' + esc(e.nik) + '"' + (e.nik === l.nik ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select>' :
                '<div class="hr-checks" id="hrLvChecks">' + act.map(function (e) { return '<label><input type="checkbox" value="' + esc(e.nik) + '"> ' + esc(e.name) + '</label>'; }).join('') + '</div><button type="button" class="hr-btn sm" style="margin-top:6px" data-act="lv-all">Pilih semua</button>') + '</div>' +
            '<div class="full"><label class="l" for="hrLvType2">Jenis</label><select class="form-control" id="hrLvType2">' + Object.keys(LEAVE_TYPES).map(function (k) { return '<option value="' + k + '"' + (d.type === k ? ' selected' : '') + '>' + LEAVE_TYPES[k][0] + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="l" for="hrLvS">Tanggal mulai</label><input type="date" class="form-control" id="hrLvS" value="' + esc(d.startDate) + '"></div><div><label class="l" for="hrLvE">Tanggal selesai</label><input type="date" class="form-control" id="hrLvE" value="' + esc(d.endDate) + '"></div></div>' +
            '<div id="hrLvShift" class="hr-sec" style="' + (d.type === 'JADWAL_SHIFT' ? '' : 'display:none') + '"><h5>Jam kerja</h5><div class="hr-pills" style="margin-bottom:10px">' + SHIFT_PRESETS.map(function (p) { return '<button type="button" class="hr-pill" data-act="preset" data-n="' + p[0] + '" data-s="' + p[1] + '" data-e="' + p[2] + '">' + p[0] + ' ' + p[1] + '-' + p[2] + '</button>'; }).join('') + '</div>' +
            '<div class="hr-f"><div class="full"><label class="l" for="hrLvName">Nama shift</label><input class="form-control" id="hrLvName" value="' + esc(d.shiftName) + '"></div><div><label class="l" for="hrLvST">Jam masuk</label><input type="time" class="form-control" id="hrLvST" value="' + esc(d.startTime) + '"></div><div><label class="l" for="hrLvET">Jam pulang</label><input type="time" class="form-control" id="hrLvET" value="' + esc(d.endTime) + '"></div></div></div>' +
            '<div style="margin-top:11px"><label class="l" for="hrLvRem">Catatan</label><input class="form-control" id="hrLvRem" value="' + esc(d.remarks) + '" placeholder="Opsional"></div><div id="hrLvErr" style="margin-top:10px"></div>' +
            '<div class="hr-mf"><button type="button" class="hr-btn" data-act="close">Batal</button><button type="submit" class="hr-btn pri">Simpan</button></div></form>');
    }
    function saveLv(form) {
        var id = form.dataset.id, type = $('hrLvType2').value, s = $('hrLvS').value, e = $('hrLvE').value, err = $('hrLvErr');
        var fail = function (m) { err.innerHTML = '<div class="hr-msg bad">' + esc(m) + '</div>'; };
        var niks = id ? [$('hrLvEmpOne').value] : Array.prototype.map.call(document.querySelectorAll('#hrLvChecks input:checked'), function (c) { return c.value; });
        if (!niks.length) return fail('Pilih minimal satu karyawan.');
        if (!s || !e) return fail('Tanggal mulai dan selesai wajib diisi.');
        if (e < s) return fail('Tanggal selesai tidak boleh sebelum tanggal mulai.');
        var name = $('hrLvName').value.trim(), st = $('hrLvST').value, et = $('hrLvET').value;
        if (type === 'JADWAL_SHIFT' && (!name || !st || !et)) return fail('Isi nama shift, jam masuk, dan jam pulang.');
        var all = LVE(), rem = $('hrLvRem').value.trim();
        var base = { type: type, startDate: s, endDate: e, shiftName: type === 'JADWAL_SHIFT' ? name : '', startTime: type === 'JADWAL_SHIFT' ? st : '', endTime: type === 'JADWAL_SHIFT' ? et : '', remarks: rem };
        if (type === 'CUTI') {
            var yr = +s.slice(0, 4), len = Math.round((dateOnly(e) - dateOnly(s)) / 86400000) + 1, over = [];
            niks.forEach(function (n) { var u = cutiUsed(n, yr) - (id ? cutiLen(id) : 0); if (u + len > CUTI_QUOTA) over.push(((EMP().filter(function (x) { return x.nik === n; })[0] || {}).name) + ' (' + (u + len) + ' hari)'); });
            if (over.length && !form.dataset.warned) { form.dataset.warned = '1'; return fail('Melebihi jatah ' + CUTI_QUOTA + ' hari: ' + over.join(', ') + '. Tekan Simpan sekali lagi bila disetujui.'); }
        }
        if (id) { var i = all.findIndex(function (x) { return x.id === id; }); if (i >= 0) all[i] = Object.assign({}, all[i], base, { nik: niks[0] }); }
        else niks.forEach(function (n, k) { all.push(Object.assign({ id: 'LV' + Date.now() + k, nik: n, created_at: new Date().toISOString() }, base)); });
        saveHrisLeaveStorage(all); closeModal(); refresh(); toast('Jadwal / pengajuan tersimpan.');
    }
    function cutiLen(id) { var l = LVE().filter(function (x) { return x.id === id; })[0]; return l && l.type === 'CUTI' ? Math.round((dateOnly(l.endDate) - dateOnly(l.startDate)) / 86400000) + 1 : 0; }

    /* ---------- 4. Kasbon ---------- */
    function debtOf(nik, kas) { var s = 0; (kas || KAS()).forEach(function (k) { if (k.nik === nik) s += (k.type === 'PINJAM' ? 1 : -1) * num(k.amount); }); return s; }
    function paintKasbon() {
        var box = $('hris-tab-kasbon'); if (!box) return;
        var emps = EMP(), kas = KAS(), owing = emps.map(function (e) { return { e: e, d: debtOf(e.nik, kas) }; }).filter(function (x) { return x.d > 0; }).sort(function (a, b) { return b.d - a.d; });
        var list = kas.filter(function (k) { return (!S.kbEmp || k.nik === S.kbEmp) && (!S.kbMonth || String(k.date).slice(0, 7) === S.kbMonth); }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); });
        // saldo berjalan per karyawan (urut waktu)
        var run = {}, bal = {}; kas.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)); }).forEach(function (k) { run[k.nik] = (run[k.nik] || 0) + (k.type === 'PINJAM' ? 1 : -1) * num(k.amount); bal[k.id] = run[k.nik]; });
        box.innerHTML = '<div class="hr-card"><div class="hr-tool" style="margin-bottom:6px"><div style="flex:1"><h3 style="margin:0">Kasbon Karyawan</h3><div class="sub" style="margin:2px 0 0">Pinjaman dan cicilan; terhubung ke saldo Kas / Bank kecuali potong gaji.</div></div><button class="hr-btn pri" data-act="kb-new"><i class="fa-solid fa-plus"></i> Catat Kasbon / Cicilan</button></div>' +
            (owing.length ? '<div class="hr-quota">' + owing.map(function (x) { return '<div class="hr-q"><b>' + esc(x.e.name) + '</b><span style="color:#f87171;font-weight:800">' + idr(x.d) + '</span><div style="margin-top:6px"><button class="hr-btn sm" data-act="kb-pay" data-id="' + esc(x.e.nik) + '">Catat cicilan</button></div></div>'; }).join('') + '</div>' : '<div class="hr-msg ok" style="margin-bottom:12px">Tidak ada kasbon yang belum lunas.</div>') +
            '<div class="hr-tool"><select class="form-control" id="hrKbEmp"><option value="">Semua karyawan</option>' + emps.map(function (e) { return '<option value="' + esc(e.nik) + '"' + (S.kbEmp === e.nik ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select><input type="month" class="form-control" id="hrKbMonth" value="' + esc(S.kbMonth) + '"></div>' +
            (list.length ? '<div class="hr-wrap"><table class="hr-table"><thead><tr><th>Tanggal</th><th>Karyawan</th><th>Jenis</th><th>Sumber</th><th>Keterangan</th><th class="r">Nominal</th><th class="r">Sisa hutang</th></tr></thead><tbody>' + list.map(function (k) {
                var e = emps.filter(function (x) { return x.nik === k.nik; })[0], p = k.type === 'PINJAM';
                return '<tr><td>' + dateLabel(k.date) + '</td><td><b>' + esc(e ? e.name : k.nik) + '</b></td><td><span class="hr-b ' + (p ? 'r' : 'g') + '">' + (p ? 'Pinjam' : 'Cicil') + '</span></td><td>' + esc((k.source || 'TUNAI').replace('_', ' ')) + '</td><td>' + esc(k.desc || '') + '</td><td class="r" style="color:' + (p ? '#f87171' : '#34d399') + '">' + (p ? '-' : '+') + idr(k.amount) + '</td><td class="r">' + idr(Math.max(0, bal[k.id] || 0)) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '<div class="hr-empty"><i class="fa-solid fa-hand-holding-dollar"></i>Belum ada catatan kasbon.</div>') + '</div>';
    }
    function kbModal(nik) {
        openModal(mh('Catat Kasbon / Cicilan', 'Saldo Kas / Bank akan disesuaikan otomatis') +
            '<form id="hrKbForm"><div class="hr-f"><div class="full"><label class="l" for="hrKbF_emp">Karyawan</label><select class="form-control" id="hrKbF_emp" data-chg="kb-sisa"><option value="">-- Pilih karyawan --</option>' + EMP().filter(isActive).map(function (e) { return '<option value="' + esc(e.nik) + '"' + (e.nik === nik ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select><small class="h" id="hrKbSisa"></small></div>' +
            '<div><label class="l" for="hrKbF_type">Jenis</label><select class="form-control" id="hrKbF_type" data-chg="kb-type"><option value="PINJAM"' + (nik ? '' : ' selected') + '>Pinjam (uang keluar)</option><option value="CICIL"' + (nik ? ' selected' : '') + '>Cicilan (uang masuk)</option></select></div>' +
            '<div><label class="l" for="hrKbF_date">Tanggal</label><input type="date" class="form-control" id="hrKbF_date" value="' + ymd() + '"></div>' +
            '<div><label class="l" for="hrKbF_src">Sumber / tujuan dana</label><select class="form-control" id="hrKbF_src"><option value="TUNAI">Kas tunai</option><option value="BCA">Rekening BCA</option><option value="MANDIRI">Rekening Mandiri</option><option value="POTONG_GAJI" id="hrKbOptPG">Potong gaji</option></select></div>' +
            '<div><label class="l" for="hrKbF_amt">Nominal (Rp)</label><input type="number" min="1" class="form-control" id="hrKbF_amt"></div>' +
            '<div class="full"><label class="l" for="hrKbF_desc">Keterangan</label><input class="form-control" id="hrKbF_desc" placeholder="Contoh: kebutuhan keluarga"></div></div>' +
            '<div id="hrKbErr" style="margin-top:10px"></div><div class="hr-mf"><button type="button" class="hr-btn" data-act="close">Batal</button><button type="submit" class="hr-btn pri">Simpan</button></div></form>', true);
        kbToggle(); kbSisa();
    }
    function kbToggle() {
        var t = $('hrKbF_type'), o = $('hrKbOptPG'), s = $('hrKbF_src'); if (!t || !o) return;
        o.hidden = o.disabled = t.value !== 'CICIL'; if (t.value !== 'CICIL' && s.value === 'POTONG_GAJI') s.value = 'TUNAI';
    }
    function kbSisa() {
        var el = $('hrKbSisa'), n = $('hrKbF_emp'); if (!el || !n) return;
        if (!n.value) { el.textContent = ''; return; }
        var d = debtOf(n.value); el.textContent = 'Sisa hutang saat ini: ' + idr(Math.max(0, d)); el.style.color = d > 0 ? '#f87171' : '#34d399';
    }
    function saveKb(form) {
        var err = $('hrKbErr'), fail = function (m) { err.innerHTML = '<div class="hr-msg bad">' + esc(m) + '</div>'; };
        var nik = $('hrKbF_emp').value, type = $('hrKbF_type').value, date = $('hrKbF_date').value, src = $('hrKbF_src').value, amt = Math.round(num($('hrKbF_amt').value)), desc = $('hrKbF_desc').value.trim();
        if (!nik) return fail('Pilih karyawan.'); if (!date) return fail('Tanggal wajib diisi.'); if (amt <= 0) return fail('Nominal harus lebih dari 0.');
        if (type === 'PINJAM' && src === 'POTONG_GAJI') return fail('Pinjaman tidak bisa memakai sumber Potong Gaji.');
        var debt = debtOf(nik);
        if (type === 'CICIL' && amt > debt) return fail('Cicilan (' + idr(amt) + ') melebihi sisa hutang (' + idr(Math.max(0, debt)) + ').');
        var emp = EMP().filter(function (e) { return e.nik === nik; })[0], name = emp ? emp.name : nik, user = actor();
        if (src !== 'POTONG_GAJI') {
            var out = type === 'PINJAM', bank = src === 'BCA' ? 'BCA' : src === 'MANDIRI' ? 'MANDIRI' : '';
            var cur = !bank ? getCash() : (bank === 'BCA' ? getBankBCA() : getBankMandiri());
            if (out && cur < amt && !form.dataset.lowOk) { form.dataset.lowOk = '1'; return fail('Saldo ' + (bank || 'kas tunai') + ' (' + idr(cur) + ') tidak cukup untuk pinjaman ini. Tekan Simpan sekali lagi bila tetap ingin melanjutkan.'); }
            var nxt = out ? cur - amt : cur + amt;
            if (!bank) saveCash(nxt); else if (bank === 'BCA') saveBankBCA(nxt); else saveBankMandiri(nxt);
            if (bank && typeof getMutations === 'function' && typeof saveMutations === 'function') {
                var m = getMutations(); m.push({ id_mutasi: 'MUT-' + Date.now().toString().slice(-6), waktu: new Date().toISOString(), tipe: out ? 'KELUAR' : 'MASUK', bank: bank, keterangan: (out ? 'Pemberian' : 'Cicilan') + ' Kasbon - ' + name + (desc ? ' (' + desc + ')' : ''), nominal: amt, inputBy: user }); saveMutations(m);
            }
        }
        var kas = KAS(); kas.push({ id: Date.now().toString(), nik: nik, type: type, source: src, date: date, amount: amt, desc: desc, inputBy: user }); saveHrisKasbon(kas);
        closeModal(); refresh(); toast('Kasbon tercatat' + (src === 'POTONG_GAJI' ? ' (dipotong dari gaji).' : ' dan saldo ' + (src === 'TUNAI' ? 'kas' : src) + ' disesuaikan.'));
        try { var dv = $('dashboard-view'); if (dv && dv.classList.contains('active') && typeof loadDashboard === 'function') loadDashboard(); if (window.loadMutationTable) window.loadMutationTable(); } catch (e) { /* abaikan */ }
    }

    /* ---------- 5. BPJS ---------- */
    function rates() { try { var r = JSON.parse(localStorage.getItem(RATE_KEY) || 'null'); if (r && isFinite(r.kes) && isFinite(r.tk)) return r; } catch (e) { /* default */ } return { kes: 1, tk: 3 }; }
    function paintBpjs() {
        var box = $('hris-tab-bpjs'); if (!box) return;
        var emps = EMP().filter(isActive), bps = BPJ(), r = rates(), tk = 0, tt = 0;
        var rows = emps.map(function (e) { var b = bps.filter(function (x) { return x.nik === e.nik; })[0] || { kes: 0, tk: 0 }; tk += num(b.kes); tt += num(b.tk);
            return '<tr><td><b>' + esc(e.name) + '</b><div style="color:var(--mut);font-size:.72rem">' + esc(e.nik) + '</div></td><td class="r">' + idr(e.salary) + '</td><td class="r"><input type="number" min="0" class="form-control" style="width:130px;text-align:right;display:inline-block" data-bpjs="kes" data-id="' + esc(e.nik) + '" value="' + num(b.kes) + '"></td><td class="r"><input type="number" min="0" class="form-control" style="width:130px;text-align:right;display:inline-block" data-bpjs="tk" data-id="' + esc(e.nik) + '" value="' + num(b.tk) + '"></td><td class="r"><b id="hrBp-' + esc(e.nik) + '">' + idr(num(b.kes) + num(b.tk)) + '</b></td></tr>'; }).join('');
        box.innerHTML = '<div class="hr-card"><h3>Potongan BPJS Karyawan</h3><p class="sub">Potongan bagian karyawan dihitung dari gaji pokok. Nilai bisa diedit langsung per baris; perubahan tersimpan otomatis dan masuk ke slip gaji.</p>' +
            '<div class="hr-tool"><div><label class="l" for="hrRtKes">Kesehatan (%)</label><input type="number" step="0.1" min="0" max="10" class="form-control" id="hrRtKes" value="' + r.kes + '" style="width:110px"></div><div><label class="l" for="hrRtTk">Ketenagakerjaan (%)</label><input type="number" step="0.1" min="0" max="10" class="form-control" id="hrRtTk" value="' + r.tk + '" style="width:110px"></div>' +
            '<div style="align-self:flex-end;display:flex;gap:8px"><button class="hr-btn" data-act="bp-rate">Simpan tarif</button><button class="hr-btn pri" data-act="bp-ask"><i class="fa-solid fa-wand-magic-sparkles"></i> Hitung otomatis semua</button></div></div>' +
            '<small class="h" style="margin-bottom:12px">Standar potongan karyawan: Kesehatan 1%, Ketenagakerjaan 3% (JHT 2% + JP 1%; JKK/JKM ditanggung perusahaan). Batas upah tertinggi BPJS tidak dihitung otomatis; ubah nominal manual bila gaji melebihi batas.</small>' +
            (rows ? '<div class="hr-wrap"><table class="hr-table"><thead><tr><th>Karyawan</th><th class="r">Gaji pokok</th><th class="r">Kesehatan</th><th class="r">Ketenagakerjaan</th><th class="r">Total</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="2">Total</td><td class="r" id="hrBpK">' + idr(tk) + '</td><td class="r" id="hrBpT">' + idr(tt) + '</td><td class="r" id="hrBpA">' + idr(tk + tt) + '</td></tr></tfoot></table></div>' : '<div class="hr-empty"><i class="fa-solid fa-heart-pulse"></i>Belum ada karyawan aktif.</div>') + '</div>';
    }
    function bpjsSet(nik, field, val) {
        var bps = BPJ(), b = bps.filter(function (x) { return x.nik === nik; })[0];
        if (!b) { b = { nik: nik, kes: 0, tk: 0 }; bps.push(b); } b[field] = Math.max(0, Math.round(num(val))); saveHrisBpjs(bps);
        var cell = $('hrBp-' + nik); if (cell) cell.textContent = idr(b.kes + b.tk);
        var k = 0, t = 0; EMP().filter(isActive).forEach(function (e) { var x = bps.filter(function (y) { return y.nik === e.nik; })[0]; if (x) { k += num(x.kes); t += num(x.tk); } });
        if ($('hrBpK')) { $('hrBpK').textContent = idr(k); $('hrBpT').textContent = idr(t); $('hrBpA').textContent = idr(k + t); }
    }
    function bpjsAuto() {
        var r = rates(), bps = BPJ();
        EMP().filter(isActive).forEach(function (e) { var b = bps.filter(function (x) { return x.nik === e.nik; })[0]; if (!b) { b = { nik: e.nik }; bps.push(b); } b.kes = Math.floor(num(e.salary) * r.kes / 100); b.tk = Math.floor(num(e.salary) * r.tk / 100); });
        saveHrisBpjs(bps); closeModal(); paintBpjs(); toast('Potongan BPJS dihitung ulang dari gaji pokok.');
    }

    /* ---------- 6. Penggajian ---------- */
    function calcPay(emp, mm) {
        var days = ATT().filter(function (a) { return a.nik === emp.nik && String(a.date).slice(0, 7) === mm && a.in_time; }).length;
        var late = ATT().filter(function (a) { return a.nik === emp.nik && String(a.date).slice(0, 7) === mm && num(a.late_min) > 0; }).length;
        var basic = num(emp.salary), food = days * num(emp.food), kb = 0;
        KAS().forEach(function (k) { if (k.nik === emp.nik && k.type === 'CICIL' && String(k.date).slice(0, 7) === mm && (k.source === 'POTONG_GAJI' || String(k.desc || '').toLowerCase().indexOf('potong gaji') >= 0)) kb += num(k.amount); });
        var b = BPJ().filter(function (x) { return x.nik === emp.nik; })[0] || { kes: 0, tk: 0 }, bp = num(b.kes) + num(b.tk);
        return { emp: emp, days: days, late: late, basic: basic, food: food, kb: kb, bpKes: num(b.kes), bpTk: num(b.tk), bp: bp, thp: basic + food - kb - bp };
    }
    function paintPayroll() {
        var box = $('hris-tab-payroll'); if (!box) return;
        var act = EMP().filter(isActive);
        box.innerHTML = '<div class="hr-card"><h3>Penggajian</h3><p class="sub">Rumus: gaji pokok + (hari hadir &times; uang makan) &minus; cicilan kasbon potong gaji &minus; BPJS. Hari hadir dihitung dari Clock IN pada bulan terpilih.</p>' +
            '<div class="hr-tool"><input type="month" class="form-control" id="hrPyMonth" value="' + esc(S.pyMonth) + '"><select class="form-control" id="hrPyEmp"><option value="ALL">Semua karyawan aktif</option>' + act.map(function (e) { return '<option value="' + esc(e.nik) + '"' + (S.pyEmp === e.nik ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select>' +
            '<button class="hr-btn pri" data-act="py-run"><i class="fa-solid fa-calculator"></i> Hitung Gaji</button><button class="hr-btn" data-act="py-xlsx" ' + (S.pyRows.length ? '' : 'disabled') + '><i class="fa-solid fa-file-excel"></i> Excel</button></div><div id="hrPyOut">' + payrollTable() + '</div></div>';
    }
    function payrollTable() {
        var rows = S.pyRows; if (!rows.length) return '<div class="hr-empty"><i class="fa-solid fa-file-invoice-dollar"></i>Pilih bulan lalu tekan <b>Hitung Gaji</b>.</div>';
        var T = { basic: 0, food: 0, kb: 0, bp: 0, thp: 0 };
        var body = rows.map(function (r, i) { ['basic', 'food', 'kb', 'bp', 'thp'].forEach(function (k) { T[k] += r[k]; });
            var warn = r.thp < 0 ? ' <span class="hr-b r">THP negatif</span>' : (r.kb > 0 && r.kb > r.basic + r.food ? ' <span class="hr-b a">Kasbon besar</span>' : '');
            return '<tr><td><b>' + esc(r.emp.name) + '</b><div style="color:var(--mut);font-size:.72rem">' + esc(r.emp.role) + '</div></td><td class="c">' + r.days + (r.late ? ' <span class="hr-b a" title="Hari terlambat">' + r.late + ' tlt</span>' : '') + '</td><td class="r">' + idr(r.basic) + '</td><td class="r">' + idr(r.food) + '</td><td class="r" style="color:#f87171">' + idr(r.kb) + '</td><td class="r" style="color:#f87171">' + idr(r.bp) + '</td><td class="r"><b>' + idr(r.thp) + '</b>' + warn + '</td><td class="r"><button class="hr-btn sm" data-act="py-slip" data-i="' + i + '"><i class="fa-solid fa-receipt"></i> Slip</button></td></tr>'; }).join('');
        return '<div class="hr-wrap"><table class="hr-table"><thead><tr><th>Karyawan</th><th class="c">Hadir</th><th class="r">Gaji pokok</th><th class="r">Uang makan</th><th class="r">Kasbon</th><th class="r">BPJS</th><th class="r">Diterima (THP)</th><th></th></tr></thead><tbody>' + body +
            '</tbody><tfoot><tr><td colspan="2">Total ' + rows.length + ' karyawan</td><td class="r">' + idr(T.basic) + '</td><td class="r">' + idr(T.food) + '</td><td class="r">' + idr(T.kb) + '</td><td class="r">' + idr(T.bp) + '</td><td class="r">' + idr(T.thp) + '</td><td></td></tr></tfoot></table></div>';
    }
    function runPayroll() {
        var mm = $('hrPyMonth').value; S.pyMonth = mm; S.pyEmp = $('hrPyEmp').value;
        if (!mm) return toast('Pilih bulan terlebih dahulu.', true);
        var list = EMP().filter(isActive).filter(function (e) { return S.pyEmp === 'ALL' || e.nik === S.pyEmp; });
        S.pyRows = list.map(function (e) { return calcPay(e, mm); }); S.pyMonthRun = mm; paintPayroll();
    }
    function slipHtml(r, mm) {
        return '<div class="hr-slip" id="hrSlipPrint"><div style="text-align:center;margin-bottom:12px"><b style="font-size:1.05rem">' + esc(companyName()) + '</b><div style="color:var(--mut)">SLIP GAJI &middot; ' + esc(monthLabel(mm)) + '</div></div>' +
            '<dl><dt>Nama</dt><dd>' + esc(r.emp.name) + '</dd><dt>NIK</dt><dd>' + esc(r.emp.nik) + '</dd><dt>Jabatan</dt><dd>' + esc(r.emp.role) + '</dd><dt>Hari hadir</dt><dd>' + r.days + ' hari</dd></dl>' +
            '<table><tr><td>Gaji pokok</td><td>' + idr(r.basic) + '</td></tr><tr><td>Uang makan (' + r.days + ' &times; ' + idr(r.emp.food) + ')</td><td>' + idr(r.food) + '</td></tr>' +
            '<tr><td>(-) Cicilan kasbon (potong gaji)</td><td style="color:#dc2626">' + idr(r.kb) + '</td></tr><tr><td>(-) BPJS Kesehatan</td><td style="color:#dc2626">' + idr(r.bpKes) + '</td></tr><tr><td>(-) BPJS Ketenagakerjaan</td><td style="color:#dc2626">' + idr(r.bpTk) + '</td></tr>' +
            '<tr class="tot"><td>Gaji diterima (THP)</td><td>' + idr(r.thp) + '</td></tr></table>' + (r.thp < 0 ? '<div class="hr-msg bad" style="margin-top:10px">Potongan melebihi pendapatan. Tinjau kasbon / BPJS sebelum membayar.</div>' : '') + '</div>';
    }
    function printSlip() {
        var el = $('hrSlipPrint'); if (!el) return;
        var w = window.open('', '_blank'); if (!w) return toast('Popup diblokir browser. Izinkan popup untuk mencetak.', true);
        w.document.write('<html><head><meta charset="utf-8"><title>Slip Gaji</title><style>body{font-family:Arial,sans-serif;color:#111;max-width:560px;margin:24px auto;font-size:14px}dl{display:grid;grid-template-columns:140px 1fr;gap:4px 8px;margin:0 0 14px}dt{color:#555}dd{margin:0}table{width:100%;border-collapse:collapse}td{padding:7px 4px;border-bottom:1px solid #ddd}td:last-child{text-align:right}tr.tot td{font-weight:700;border-top:2px solid #111}.hr-msg{display:none}</style></head><body>' + el.innerHTML.replace(/var\(--mut\)/g, '#555') + '<div style="margin-top:50px;display:flex;justify-content:space-between"><div style="text-align:center">Penerima<br><br><br>(________)</div><div style="text-align:center">Dibuat oleh<br><br><br>(________)</div></div></body></html>');
        w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 250);
    }
    function exportXlsx() {
        if (!S.pyRows.length) return;
        if (typeof XLSX === 'undefined' || typeof window.safeExportXLSX !== 'function') return toast('Library Excel belum termuat. Muat ulang halaman.', true);
        var aoa = [['NIK', 'Nama', 'Jabatan', 'Hari hadir', 'Gaji pokok', 'Uang makan', 'Kasbon', 'BPJS Kes', 'BPJS TK', 'THP']];
        S.pyRows.forEach(function (r) { aoa.push([r.emp.nik, r.emp.name, r.emp.role, r.days, r.basic, r.food, r.kb, r.bpKes, r.bpTk, r.thp]); });
        var ws = XLSX.utils.aoa_to_sheet(aoa), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Penggajian');
        window.safeExportXLSX(wb, 'penggajian-' + (S.pyMonthRun || S.pyMonth) + '.xlsx');
    }

    /* ---------- Event ---------- */
    function onClick(e) {
        var t = e.target.closest('[data-act]'); if (!t) return;
        var a = t.dataset.act, id = t.dataset.id;
        switch (a) {
            case 'tab': window.switchHrisTab(t.dataset.tab); break;
            case 'close': closeModal(); break;
            case 'emp-new': loadPinStatus().then(function () { empModal(); }); break;
            case 'emp-edit': loadPinStatus().then(function () { empModal(id); }); break;
            case 'pin-eye': var p = $('hrEPin'); p.type = p.type === 'password' ? 'text' : 'password'; break;
            case 'pin-rand': $('hrEPin').value = randomPin(); $('hrEPin').type = 'text'; break;
            case 'zoom': if (typeof window.openGlobalImagePreview === 'function') window.openGlobalImagePreview(t.dataset.src); break;
            case 'clock': clock(t.dataset.type); break;
            case 'att-prev': case 'att-next': var d = new Date(S.attDate + 'T00:00:00'); d.setDate(d.getDate() + (a === 'att-next' ? 1 : -1)); S.attDate = ymd(d); $('hrAttDate').value = S.attDate; paintAttTable(); break;
            case 'att-add': attModal(); break;
            case 'att-edit': attModal(id); break;
            case 'att-del-ask': confirmBox('Hapus absensi?', 'Catatan absensi ini akan dihapus permanen.', 'Hapus', 'att-del', id); break;
            case 'att-del': saveHrisAttendance(ATT().filter(function (x) { return x.id !== id; })); closeModal(); paintAttTable(); paintKpis(); toast('Absensi dihapus.'); break;
            case 'cal-view': window.openHrisScheduleCalendarView(); break;
            case 'cal-jpeg': window.downloadHrisScheduleCalendarJpeg(); break;
            case 'cal-print': window.printHrisScheduleCalendar(); break;
            case 'lv-new': lvModal(); break;
            case 'lv-edit': lvModal(id); break;
            case 'lv-all': document.querySelectorAll('#hrLvChecks input').forEach(function (c) { c.checked = true; }); break;
            case 'lv-del-ask': confirmBox('Hapus jadwal?', 'Entri jadwal / pengajuan ini akan dihapus.', 'Hapus', 'lv-del', id); break;
            case 'lv-del': saveHrisLeaveStorage(LVE().filter(function (x) { return x.id !== id; })); closeModal(); refresh(); toast('Jadwal dihapus.'); break;
            case 'preset': $('hrLvName').value = t.dataset.n; $('hrLvST').value = t.dataset.s; $('hrLvET').value = t.dataset.e; break;
            case 'kb-new': kbModal(); break;
            case 'kb-pay': kbModal(id); break;
            case 'bp-rate': var k = num($('hrRtKes').value), tk = num($('hrRtTk').value); if (k < 0 || tk < 0 || k > 10 || tk > 10) return toast('Tarif harus antara 0 dan 10 persen.', true); localStorage.setItem(RATE_KEY, JSON.stringify({ kes: k, tk: tk })); toast('Tarif disimpan.'); break;
            case 'bp-ask': var r = rates(); openModal(mh('Hitung ulang BPJS?') + '<p style="margin:0;font-size:.88rem;line-height:1.55">Semua karyawan aktif akan dihitung ulang: Kesehatan ' + r.kes + '% dan Ketenagakerjaan ' + r.tk + '% dari gaji pokok. Nilai yang pernah diedit manual akan tertimpa.</p><div class="hr-mf"><button class="hr-btn" data-act="close">Batal</button><button class="hr-btn pri" data-act="bp-run">Hitung</button></div>', true); break;
            case 'bp-run': bpjsAuto(); break;
            case 'py-run': runPayroll(); break;
            case 'py-xlsx': exportXlsx(); break;
            case 'py-slip': var row = S.pyRows[+t.dataset.i]; if (row) openModal(mh('Slip Gaji') + slipHtml(row, S.pyMonthRun || S.pyMonth) + '<div class="hr-mf"><button class="hr-btn" data-act="close">Tutup</button><button class="hr-btn pri" data-act="slip-print"><i class="fa-solid fa-print"></i> Cetak</button></div>', true); break;
            case 'slip-print': printSlip(); break;
        }
    }
    function onChange(e) {
        var t = e.target, id = t.id;
        if (id === 'hrEmpStatus') { S.empStatus = t.value; paintEmp(); }
        else if (id === 'hrEmpRole') { S.empRole = t.value; paintEmp(); }
        else if (id === 'hrAttEmp') paintAttInfo();
        else if (id === 'hrAttDate') { S.attDate = t.value || ymd(); paintAttTable(); }
        else if (id === 'hrisScheduleMonth' || id === 'hrisScheduleEmployee') { if (id === 'hrisScheduleEmployee') S.schEmp = t.value; window.renderHrisScheduleCalendar(); }
        else if (id === 'hrLvMonth') { S.lvMonth = t.value; paintLvList(); }
        else if (id === 'hrLvType') { S.lvType = t.value; paintLvList(); }
        else if (id === 'hrLvType2') $('hrLvShift').style.display = t.value === 'JADWAL_SHIFT' ? '' : 'none';
        else if (id === 'hrKbEmp') { S.kbEmp = t.value; paintKasbon(); }
        else if (id === 'hrKbMonth') { S.kbMonth = t.value; paintKasbon(); }
        else if (id === 'hrKbF_emp') kbSisa();
        else if (id === 'hrKbF_type') kbToggle();
        else if (id === 'hrPyMonth' || id === 'hrPyEmp') { S.pyRows = []; if (id === 'hrPyMonth') S.pyMonth = t.value; else S.pyEmp = t.value; paintPayroll(); }
        else if (t.dataset && t.dataset.bpjs) bpjsSet(t.dataset.id, t.dataset.bpjs, t.value);
        else if (/^hrE(Photo|PhotoFull|Ktp|Sim|Ijazah)$/.test(id)) {
            var meta = DOCS.filter(function (x) { return x[1] === id; })[0], f = t.files[0], pv = $('pv-' + id);
            if (!f) return;
            readFile(f).then(function (v) { pv.innerHTML = filePv(v, meta[2]); });
        }
    }
    function onInput(e) {
        var t = e.target;
        if (t.id === 'hrEmpQ') { S.empQ = t.value; paintEmp(); }
        else if (t.id === 'hrAttPin' || t.id === 'hrEPin') t.value = t.value.replace(/\D/g, '').slice(0, 4);
    }
    function onKey(e) {
        if (e.key === 'Enter' && e.target.id === 'hrAttPin') { e.preventDefault(); clock('IN'); }
    }
    function onSubmit(e) {
        e.preventDefault(); var f = e.target;
        if (f.id === 'hrEmpForm') saveEmp(f); else if (f.id === 'hrAttForm') saveAtt(f); else if (f.id === 'hrLvForm') saveLv(f); else if (f.id === 'hrKbForm') saveKb(f);
    }

    /* ---------- Kompatibilitas modul lain ---------- */
    window.renderHrisEmployees = function () { if (S.built && S.tab === 'emp') paintEmp(); };
    window.renderHrisAttendanceTable = function () { if (S.built && $('hrAttTable')) paintAttTable(); };
    window.renderHrisLeaveTable = function () { if (S.built && S.tab === 'leave') paintLeave(); };
    window.renderHrisKasbonTable = function () { if (S.built && S.tab === 'kasbon') paintKasbon(); };
    window.renderHrisBpjsTable = function () { if (S.built && S.tab === 'bpjs') paintBpjs(); };

    window.openGlobalImagePreview = window.openGlobalImagePreview || function (src) {
        var m = $('globalImageLightbox'), img = $('globalImageLightboxImg');
        if (m && img) { img.src = src; m.classList.add('show'); }
    };

    document.addEventListener('DOMContentLoaded', function () { build(); });
    if (document.readyState !== 'loading') build();
})();
