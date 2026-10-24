// @2026-Alifiandra
/* =====================================================================
 * 57-goaml.js  —  Pelaporan BI & Regulasi > GoAML
 *
 * Dua tab:
 *  1) Laporan   : temuan yang tertangkap aturan (LTKT, LTKM, LTKL, CDD, dst.),
 *                 ditinjau oleh kepatuhan, lalu dibuat draft laporan.
 *  2) Pengaturan: aturan threshold (nominal, periode, jumlah transaksi, jenis
 *                 dan metode transaksi) beserta dasar regulasinya.
 *
 * Alur: aturan aktif dievaluasi server setiap transaksi tersimpan. Bila
 * terpenuhi, temuan otomatis muncul di tab Laporan. Aplikasi TIDAK mengirim
 * apa pun ke portal GoAML; keputusan akhir tetap pada petugas kepatuhan.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcGoaml) return;
    window.__mcGoaml = true;

    var $ = function (id) { return document.getElementById(id); };
    var http = function (url, opt) { return (window.authFetch || window.fetch)(url, opt); };
    var EDITORS = { owner: 1, superadmin: 1, admin: 1, supervisor: 1 };

    var RESULTS = {
        LTKT: { label: 'LTKT', full: 'Laporan Transaksi Keuangan Tunai', cls: 'b-blue' },
        LTKM: { label: 'LTKM', full: 'Laporan Transaksi Keuangan Mencurigakan', cls: 'b-red' },
        LTKL: { label: 'LTKL', full: 'Laporan Transfer Dana dari/ke Luar Negeri', cls: 'b-purple' },
        LKU_BI: { label: 'LKU BI', full: 'Masuk Laporan Kegiatan Usaha BI', cls: 'b-teal' },
        CDD: { label: 'CDD', full: 'Customer Due Diligence', cls: 'b-amber' },
        UNDERLYING: { label: 'Underlying', full: 'Pemeriksaan dokumen underlying', cls: 'b-amber' },
        COMPLIANCE_REVIEW: { label: 'Tinjauan', full: 'Tinjauan kepatuhan', cls: 'b-gray' },
        INTERNAL_ALERT: { label: 'Internal', full: 'Peringatan internal', cls: 'b-gray' }
    };
    var STATUS = {
        OPEN: { label: 'Baru', cls: 'b-amber', todo: true },
        IN_REVIEW: { label: 'Ditinjau', cls: 'b-blue', todo: true },
        ESCALATED: { label: 'Eskalasi', cls: 'b-red', todo: true },
        APPROVED: { label: 'Disetujui', cls: 'b-green', todo: false },
        REJECTED: { label: 'Ditolak', cls: 'b-gray', todo: false }
    };
    var REVIEW_OPTIONS = [
        ['IN_REVIEW', 'Sedang ditinjau', 'Tandai bahwa temuan sedang diperiksa.', false],
        ['APPROVED', 'Disetujui untuk dilaporkan', 'Transaksi memenuhi kriteria pelaporan. Draft laporan dapat dibuat.', true],
        ['REJECTED', 'Ditolak, tidak perlu dilaporkan', 'Setelah diperiksa, tidak memenuhi kriteria pelaporan.', true],
        ['ESCALATED', 'Eskalasi ke atasan / kepatuhan', 'Perlu keputusan pihak yang berwenang.', true]
    ];
    var TEMPLATES = {
        usdlimit: { name: 'Batas Transaksi per Bulan (ekuivalen USD)', code: 'REG-LIMIT-USD-1M', rule_type: 'REGULATORY', result_type: 'UNDERLYING', transaction_type: 'JUAL', payment_method: '', period_unit: 'MONTH', period_days: 1, min_transactions: '', amount_operator: '>', amount_unit: 'USD', amount_usd: 10000, total_amount_idr: '', severity: 'REVIEW', action: 'REVIEW', priority: 40, internal_note: 'Batas per nasabah per bulan kalender. Sesuaikan nilai, jenis transaksi, dan dasar regulasi dengan ketentuan yang berlaku.' },
        ltkt: { name: 'LTKT: Transaksi Tunai per Hari', code: 'REG-LTKT-CASH-1D', rule_type: 'REGULATORY', result_type: 'LTKT', transaction_type: '', payment_method: 'CASH', period_unit: 'DAY', period_days: 1, min_transactions: '', amount_operator: '>=', amount_unit: 'IDR', amount_usd: '', total_amount_idr: 500000000, severity: 'REVIEW', action: 'REVIEW', priority: 50, internal_note: 'Sesuaikan nilai ambang dengan ketentuan PPATK yang berlaku.' },
        ltkm: { name: 'LTKM: Monitoring Penjualan Valas', code: 'IM-LTKM-JUAL', rule_type: 'INTERNAL_MONITORING', result_type: 'LTKM', transaction_type: 'JUAL', payment_method: '', period_unit: 'DAY', period_days: 3, min_transactions: '', amount_operator: '>', amount_unit: 'IDR', amount_usd: '', total_amount_idr: 500000000, severity: 'WARNING', action: 'REVIEW', priority: 100, internal_note: 'Monitoring internal; keputusan akhir oleh kepatuhan.' },
        freq: { name: 'Frekuensi Transaksi Tidak Wajar', code: 'IM-FREQ-3TX-7D', rule_type: 'INTERNAL_MONITORING', result_type: 'COMPLIANCE_REVIEW', transaction_type: '', payment_method: '', period_unit: 'DAY', period_days: 7, min_transactions: 3, amount_operator: '>', amount_unit: 'IDR', amount_usd: '', total_amount_idr: 100000000, severity: 'WARNING', action: 'REVIEW', priority: 120, internal_note: '' }
    };

    var S = { tab: 'laporan', alerts: [], rules: [], drafts: [], loaded: false, busy: false, result: '', status: '', q: '', from: '', to: '', timer: null, err: '' };

    function role() { try { return String((JSON.parse(localStorage.getItem('mc_currentUser')) || {}).role || '').toLowerCase(); } catch (e) { return ''; } }
    function canEdit() { return !!EDITORS[role()]; }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function idr(v) { return 'Rp ' + Math.round(num(v)).toLocaleString('id-ID'); }
    function toDate(v) { if (!v) return null; var d = new Date(String(v).indexOf('T') > -1 ? v : String(v).replace(' ', 'T')); return isNaN(d.getTime()) ? null : d; }
    function fmt(v) {
        var d = toDate(v); if (!d) return '-';
        var p = function (n) { return String(n).padStart(2, '0'); };
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function dayKey(v) { var d = toDate(v); return d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : ''; }
    function badge(map, key, fallback) {
        var m = map[String(key || '').toUpperCase()] || { label: fallback || key || '-', cls: 'b-gray' };
        return '<span class="gm-b ' + m.cls + '">' + esc(m.label) + '</span>';
    }

    function api(path, opt) {
        opt = opt || {};
        opt.headers = Object.assign({ 'Accept': 'application/json' }, opt.body ? { 'Content-Type': 'application/json' } : {}, opt.headers || {});
        opt.cache = 'no-store';
        return http('api' + path, opt).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) {
                    var msg = j && j.message ? j.message : 'Permintaan gagal (HTTP ' + r.status + ')';
                    if (j && j.errors) { var f = Object.keys(j.errors)[0]; if (f && j.errors[f] && j.errors[f][0]) msg = j.errors[f][0]; }
                    var e = new Error(msg); e.status = r.status; throw e;
                }
                return j;
            });
        });
    }

    /* ---------- Gaya ---------- */
    function injectStyle() {
        if ($('gm-style')) return;
        var st = document.createElement('style');
        st.id = 'gm-style';
        st.textContent = [
            '.gm{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#10b981);display:grid;gap:16px}',
            '.gm-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.gm-head h2{margin:0;font-size:1.2rem}.gm-head p{margin:4px 0 0;color:var(--mut);font-size:.84rem;max-width:720px;line-height:1.5}',
            '.gm-head .act{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}',
            '.gm-tabs{display:flex;gap:6px;border-bottom:1px solid var(--bd);overflow-x:auto}',
            '.gm-tab{background:none;border:0;border-bottom:3px solid transparent;color:var(--mut);font:inherit;font-weight:700;font-size:.9rem;padding:10px 16px;cursor:pointer;white-space:nowrap;display:flex;gap:8px;align-items:center}',
            '.gm-tab.on{color:inherit;border-bottom-color:var(--pri)}.gm-tab .n{background:#ef4444;color:#fff;border-radius:99px;font-size:.68rem;padding:1px 7px;min-width:18px;text-align:center}',
            '.gm-card{border:1px solid var(--bd);border-radius:14px;padding:16px 18px}.gm-card>h3{margin:0 0 4px;font-size:.95rem}.gm-card>.sub{margin:0 0 12px;color:var(--mut);font-size:.8rem;line-height:1.45}',
            '.gm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}',
            '.gm-kpi{border:1px solid var(--bd);border-radius:14px;padding:13px 15px}.gm-kpi .t{font-size:.73rem;color:var(--mut);font-weight:600}.gm-kpi .v{font-size:1.4rem;font-weight:800;margin-top:3px}.gm-kpi .s{font-size:.72rem;color:var(--mut);margin-top:1px}',
            '.gm-kpi.warn .v{color:#f59e0b}.gm-kpi.ok .v{color:var(--pri)}.gm-kpi.bad .v{color:#f87171}',
            '.gm-chips{display:flex;gap:8px;flex-wrap:wrap}.gm-chip{border:1px solid var(--bd);background:none;color:inherit;border-radius:99px;font:inherit;font-size:.78rem;font-weight:600;padding:5px 12px;cursor:pointer}',
            '.gm-chip.on{background:var(--pri);border-color:var(--pri);color:var(--mc-primary-contrast,#fff)}.gm-chip i{font-style:normal;opacity:.75;margin-left:5px;font-weight:700}',
            '.gm-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;align-items:end;margin-top:12px}',
            '.gm label.l{display:block;font-size:.77rem;font-weight:600;margin:0 0 5px}.gm .form-control,.gm-modal .form-control{width:100%;box-sizing:border-box}.gm small{display:block;margin-top:4px;color:var(--mut);font-size:.75rem;line-height:1.4}',
            '.gm-tw{overflow:auto;border:1px solid var(--bd);border-radius:12px}',
            '.gm table{width:100%;border-collapse:collapse;font-size:.8rem}.gm th{text-align:left;padding:10px;font-size:.71rem;letter-spacing:.03em;white-space:nowrap;background:var(--mc-table-head,var(--mc-card-bg,#1e293b));border-bottom:1px solid var(--bd)}',
            '.gm td{padding:10px;border-bottom:1px solid var(--bd);vertical-align:top}.gm td.r,.gm th.r{text-align:right;white-space:nowrap}.gm td.mono{font-family:ui-monospace,Consolas,monospace;font-size:.76rem}',
            '.gm tr.hot td{background:rgba(245,158,11,.06)}.gm .nt{font-size:.73rem;color:var(--mut);margin-top:2px;line-height:1.35}',
            '.gm-b{display:inline-block;font-size:.67rem;font-weight:700;padding:2px 9px;border-radius:99px;white-space:nowrap}',
            '.b-blue{background:rgba(59,130,246,.15);color:#60a5fa}.b-red{background:rgba(239,68,68,.16);color:#f87171}.b-purple{background:rgba(168,85,247,.15);color:#c084fc}.b-teal{background:rgba(20,184,166,.15);color:#2dd4bf}.b-amber{background:rgba(245,158,11,.16);color:#f59e0b}.b-green{background:rgba(16,185,129,.15);color:#10b981}.b-gray{background:rgba(148,163,184,.18);color:var(--mut)}',
            '.gm-empty{padding:34px 12px;text-align:center;color:var(--mut)}.gm-err{border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.08);border-radius:12px;padding:12px 14px;font-size:.83rem}',
            '.gm-info{display:flex;gap:10px;font-size:.8rem;line-height:1.5;color:var(--mut);border:1px dashed var(--bd);border-radius:12px;padding:12px 14px}.gm-info i{color:var(--pri);margin-top:3px}',
            '.gm-btn{font:inherit;font-weight:700;font-size:.78rem;border-radius:8px;padding:6px 11px;border:1px solid var(--bd);background:none;color:inherit;cursor:pointer}.gm-btn:hover{background:rgba(148,163,184,.14)}.gm-btn.pri{background:var(--pri);border-color:var(--pri);color:var(--mc-primary-contrast,#fff)}.gm-btn[disabled]{opacity:.5;cursor:not-allowed}',
            '.gm-sw{position:relative;width:38px;height:22px;display:inline-block}.gm-sw input{opacity:0;width:0;height:0}.gm-sw span{position:absolute;inset:0;background:rgba(148,163,184,.45);border-radius:99px;transition:.15s;cursor:pointer}.gm-sw span:before{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.15s}.gm-sw input:checked+span{background:var(--pri)}.gm-sw input:checked+span:before{transform:translateX(16px)}',
            '.gm-rules{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}.gm-rule{border:1px solid var(--bd);border-radius:14px;padding:14px 16px;display:grid;gap:8px}.gm-rule.off{opacity:.6}',
            '.gm-rule h4{margin:0;font-size:.92rem;line-height:1.3}.gm-rule .crit{font-size:.8rem;line-height:1.5;border-left:3px solid var(--pri);padding-left:10px}.gm-rule .row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
            '#gmBody{display:grid;gap:16px}',
            '.gm-rule .row:first-child{flex-wrap:nowrap;align-items:flex-start}.gm-rule .row:first-child h4{flex:1;min-width:0}',
            '.gm-group{margin:4px 0 0;font-size:.8rem;font-weight:800;letter-spacing:.05em;color:var(--mut);text-transform:uppercase}',
            '.gm-ov{position:fixed;inset:0;background:rgba(2,6,23,.6);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow:auto}',
            '.gm-modal{background:var(--mc-card-bg,#1e293b);color:var(--mc-text,inherit);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:880px;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.4)}',
            '.gm-modal.sm{max-width:520px}.gm-mh{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.gm-mh h3{margin:0;font-size:1.05rem}.gm-mh .x{margin-left:auto}',
            '.gm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px 16px}.gm-grid .wide{grid-column:1/-1}',
            '.gm-sec{margin:16px 0 8px;font-size:.78rem;font-weight:800;letter-spacing:.05em;color:var(--mut);text-transform:uppercase}',
            '.gm-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}.gm-sum div{border:1px solid var(--bd);border-radius:10px;padding:9px 11px}.gm-sum b{display:block;font-size:.95rem;margin-top:2px}.gm-sum span{font-size:.72rem;color:var(--mut)}',
            '.gm-prev{border:1px solid var(--pri);background:rgba(16,185,129,.07);border-radius:10px;padding:10px 12px;font-size:.82rem;line-height:1.5}',
            '.gm-opt{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--bd);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer}.gm-opt input{margin-top:3px}.gm-opt.on{border-color:var(--pri);background:rgba(16,185,129,.07)}.gm-opt b{font-size:.85rem}.gm-opt span{display:block;font-size:.76rem;color:var(--mut)}',
            '.gm-toast{position:fixed;right:18px;bottom:18px;z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid var(--pri);padding:11px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 12px 30px rgba(0,0,0,.35);max-width:360px}.gm-toast.err{border-left-color:#ef4444}',
            '.goaml-nav-badge{margin-left:auto;background:#ef4444;color:#fff;border-radius:99px;font-size:.66rem;font-weight:800;padding:1px 7px;line-height:1.4}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function toast(msg, isErr) {
        var t = document.createElement('div'); t.className = 'gm-toast' + (isErr ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
        document.body.appendChild(t); setTimeout(function () { t.remove(); }, isErr ? 6000 : 3200);
    }

    /* ---------- Data ---------- */
    function loadAll() {
        S.busy = true; S.err = '';
        return Promise.all([api('/goaml/alerts'), api('/goaml/rules'), api('/goaml/ltkm')]).then(function (r) {
            S.alerts = Array.isArray(r[0]) ? r[0] : []; S.rules = Array.isArray(r[1]) ? r[1] : []; S.drafts = Array.isArray(r[2]) ? r[2] : [];
            S.loaded = true;
        }).catch(function (e) { S.err = e.message || 'Gagal memuat data.'; }).then(function () { S.busy = false; render(); updateNavBadge(); });
    }
    function pendingCount() { return S.alerts.filter(function (a) { return (STATUS[a.status] || {}).todo; }).length; }

    /* ---------- Kerangka ---------- */
    function shell() {
        var root = $('goamlRoot');
        if (!root) return null;
        if (root.getAttribute('data-ready') === '1') return root;
        injectStyle();
        root.className = 'gm'; root.setAttribute('data-ready', '1');
        root.addEventListener('click', onClick);
        root.addEventListener('change', onChange);
        root.addEventListener('input', onInput);
        return root;
    }

    function render() {
        var root = shell(); if (!root) return;
        var head = '<div class="gm-head"><div><h2>GoAML &amp; Kepatuhan APU-PPT</h2><p>Atur ambang batas (threshold) di tab Pengaturan. Transaksi yang terjaring aturan otomatis masuk ke tab Laporan untuk ditinjau dan dibuatkan draft pelaporan.</p></div>' +
            '<div class="act"><button class="gm-btn" data-act="refresh"><i class="fa-solid fa-rotate"></i> Muat Ulang</button>' +
            (S.tab === 'laporan' ? '<button class="gm-btn" data-act="export"><i class="fa-solid fa-file-excel"></i> Export Excel</button>' : (canEdit() ? '<button class="gm-btn pri" data-act="rule-new"><i class="fa-solid fa-plus"></i> Tambah Aturan</button>' : '')) + '</div></div>';
        var p = pendingCount();
        var tabs = '<div class="gm-tabs" role="tablist"><button class="gm-tab ' + (S.tab === 'laporan' ? 'on' : '') + '" data-act="tab" data-tab="laporan" role="tab"><i class="fa-solid fa-flag"></i> Laporan Temuan' + (p ? '<span class="n">' + p + '</span>' : '') + '</button>' +
            '<button class="gm-tab ' + (S.tab === 'pengaturan' ? 'on' : '') + '" data-act="tab" data-tab="pengaturan" role="tab"><i class="fa-solid fa-sliders"></i> Pengaturan Threshold</button></div>';
        var body = S.err ? '<div class="gm-err"><b>Gagal memuat data.</b><br>' + esc(S.err) + '<br><button class="gm-btn" style="margin-top:8px" data-act="refresh">Coba Lagi</button></div>'
            : !S.loaded ? '<div class="gm-empty">Memuat data...</div>'
            : (S.tab === 'laporan' ? viewReports() : viewSettings());
        root.innerHTML = head + tabs + '<div id="gmBody">' + body + '</div>';
    }

    /* ---------- Tab Laporan ---------- */
    function filtered() {
        var q = S.q.trim().toLowerCase();
        return S.alerts.filter(function (a) {
            if (S.result && String(a.result_type || 'COMPLIANCE_REVIEW') !== S.result) return false;
            if (S.status === 'TODO' && !(STATUS[a.status] || {}).todo) return false;
            if (S.status && S.status !== 'TODO' && a.status !== S.status) return false;
            var d = dayKey(a.created_at);
            if (S.from && d && d < S.from) return false;
            if (S.to && d && d > S.to) return false;
            if (q && ((a.alert_no || '') + ' ' + (a.customer_name || '') + ' ' + (a.customer_id || '') + ' ' + (a.invoice_summary || '') + ' ' + ((a.rule || {}).name || '')).toLowerCase().indexOf(q) < 0) return false;
            return true;
        });
    }
    function viewReports() {
        var all = S.alerts, todo = all.filter(function (a) { return (STATUS[a.status] || {}).todo; });
        var appr = all.filter(function (a) { return a.status === 'APPROVED'; });
        var rej = all.filter(function (a) { return a.status === 'REJECTED'; });
        var kpis = '<div class="gm-kpis">' +
            kpi('Perlu Tindak Lanjut', todo.length, 'Baru, ditinjau, eskalasi', todo.length ? 'warn' : 'ok') +
            kpi('Disetujui', appr.length, 'Wajib dilaporkan', 'ok') +
            kpi('Draft LTKM', S.drafts.length, 'Dibuat dari temuan disetujui', '') +
            kpi('Ditolak', rej.length, 'Tidak memenuhi kriteria', '') + '</div>';
        var counts = {}; all.forEach(function (a) { var k = a.result_type || 'COMPLIANCE_REVIEW'; counts[k] = (counts[k] || 0) + 1; });
        var chips = '<div class="gm-chips"><button class="gm-chip ' + (!S.result ? 'on' : '') + '" data-act="chip" data-v="">Semua<i>' + all.length + '</i></button>' +
            Object.keys(counts).map(function (k) { return '<button class="gm-chip ' + (S.result === k ? 'on' : '') + '" data-act="chip" data-v="' + esc(k) + '" title="' + esc((RESULTS[k] || {}).full || k) + '">' + esc((RESULTS[k] || { label: k }).label) + '<i>' + counts[k] + '</i></button>'; }).join('') + '</div>';
        var rows = filtered();
        var table = rows.length ? '<div class="gm-tw"><table><thead><tr><th>Temuan</th><th>Nasabah</th><th>Aturan</th><th>Jenis</th><th class="r">Transaksi</th><th class="r">Total (IDR)</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
            rows.map(function (a) {
                var hot = (STATUS[a.status] || {}).todo;
                return '<tr class="' + (hot ? 'hot' : '') + '"><td><b class="mono">' + esc(a.alert_no) + '</b><div class="nt">' + esc(fmt(a.created_at)) + '</div></td>' +
                    '<td>' + esc(a.customer_name || '-') + '<div class="nt mono">' + esc(a.customer_id || '-') + '</div></td>' +
                    '<td>' + esc((a.rule || {}).name || '-') + '<div class="nt">' + esc((a.rule || {}).code || '') + '</div></td>' +
                    '<td>' + badge(RESULTS, a.result_type || 'COMPLIANCE_REVIEW') + '</td>' +
                    '<td class="r">' + num(a.transaction_count) + '</td><td class="r">' + idr(a.total_amount_idr) + (a.total_amount_usd != null ? '<div class="nt">' + usd(a.total_amount_usd) + '</div>' : '') + '</td>' +
                    '<td>' + badge(STATUS, a.status) + '</td>' +
                    '<td style="white-space:nowrap"><button class="gm-btn" data-act="detail" data-id="' + a.id + '">Detail</button> ' +
                    (canEdit() ? '<button class="gm-btn pri" data-act="review" data-id="' + a.id + '">Tinjau</button>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
            : '<div class="gm-empty">' + (all.length ? 'Tidak ada temuan untuk filter ini.' : 'Belum ada transaksi yang terjaring aturan. Temuan akan muncul otomatis setelah transaksi memenuhi threshold.') + '</div>';
        var filter = '<div class="gm-filter"><div><label class="l" for="gmStatus">Status</label><select id="gmStatus" class="form-control"><option value="">Semua status</option><option value="TODO"' + (S.status === 'TODO' ? ' selected' : '') + '>Perlu tindak lanjut</option>' +
            Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (S.status === k ? ' selected' : '') + '>' + STATUS[k].label + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="l" for="gmFrom">Dari tanggal</label><input id="gmFrom" type="date" class="form-control" value="' + esc(S.from) + '"></div>' +
            '<div><label class="l" for="gmTo">Sampai tanggal</label><input id="gmTo" type="date" class="form-control" value="' + esc(S.to) + '"></div>' +
            '<div><label class="l" for="gmQ">Cari</label><input id="gmQ" class="form-control" placeholder="No. temuan, nasabah, invoice" value="' + esc(S.q) + '"></div></div>';
        var drafts = '<div class="gm-card"><h3>Draft LTKM</h3><p class="sub">Draft dibuat dari temuan LTKM yang sudah disetujui. Isi draft adalah salinan (snapshot) saat dibuat, sehingga tidak berubah bila data transaksi berubah.</p>' +
            (S.drafts.length ? '<div class="gm-tw"><table><thead><tr><th>No. Draft</th><th>Temuan</th><th>Nasabah</th><th>Periode</th><th class="r">Total (IDR)</th><th>Status</th><th></th></tr></thead><tbody>' +
                S.drafts.map(function (r) {
                    return '<tr><td class="mono"><b>' + esc(r.report_no) + '</b></td><td class="mono">' + esc((r.alert || {}).alert_no || ('#' + r.alert_id)) + '</td><td>' + esc(r.customer_name || '-') + '<div class="nt mono">' + esc(r.customer_id || '-') + '</div></td>' +
                        '<td>' + esc(fmt(r.period_start)) + '<div class="nt">s.d. ' + esc(fmt(r.period_end)) + '</div></td><td class="r">' + idr(r.total_amount_idr) + '</td><td><span class="gm-b b-blue">' + esc(r.status || 'DRAFT') + '</span></td>' +
                        '<td><button class="gm-btn" data-act="draft" data-id="' + r.id + '">Detail</button></td></tr>';
                }).join('') + '</tbody></table></div>' : '<div class="gm-empty" style="padding:18px">Belum ada draft LTKM.</div>') + '</div>';
        return kpis + '<div class="gm-card"><h3>Temuan Transaksi</h3>' + chips + filter + '<div style="margin-top:14px">' + table + '</div></div>' + drafts;
    }
    function kpi(t, v, s, cls) { return '<div class="gm-kpi ' + cls + '"><div class="t">' + esc(t) + '</div><div class="v">' + v + '</div><div class="s">' + esc(s) + '</div></div>'; }

    /* ---------- Tab Pengaturan ---------- */
    function usd(v) { return 'USD ' + num(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }); }
    function periodText(r) {
        var n = r.period_days || 1;
        return String(r.period_unit || 'DAY').toUpperCase() === 'MONTH' ? (n === 1 ? 'per bulan kalender' : 'dalam ' + n + ' bulan kalender') : 'dalam ' + n + ' hari';
    }
    function describe(r) {
        var c = r.conditions || {}, parts = [];
        var type = String(c.transaction_type || '').toUpperCase();
        var subject = 'Transaksi ' + (type || 'JUAL/BELI') + (r.payment_method ? ' ' + String(r.payment_method).toUpperCase() : '') + ' per nasabah';
        var isUsd = String(r.amount_unit || 'IDR').toUpperCase() === 'USD';
        var amt = isUsd ? r.amount_usd : r.total_amount_idr;
        if (r.min_transactions) parts.push('minimal ' + r.min_transactions + ' transaksi');
        if (amt !== null && amt !== undefined && amt !== '') parts.push('total ' + (r.amount_operator || '>') + ' ' + (isUsd ? usd(amt) + ' (ekuivalen)' : idr(amt)));
        return subject + (parts.length ? ': ' + parts.join(' dan ') : '') + ' ' + periodText(r) + '.';
    }
    function validityLine(r) {
        var f = String(r.effective_from || '').slice(0, 10), u = String(r.effective_until || '').slice(0, 10);
        if (!f && !u) return '';
        var today = dayKey(new Date().toISOString());
        var state = (u && u < today) ? '<span class="gm-b b-gray">Berakhir</span> ' : (f && f > today) ? '<span class="gm-b b-amber">Belum berlaku</span> ' : '';
        var d = function (k) { var p = k.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
        return '<div class="nt">' + state + 'Berlaku ' + (f ? 'mulai ' + d(f) : 'sejak awal') + (u ? ' s.d. ' + d(u) : '') + '</div>';
    }
    function viewSettings() {
        var ed = canEdit();
        var byType = {};
        S.rules.forEach(function (r) { var k = r.result_type || 'COMPLIANCE_REVIEW'; (byType[k] = byType[k] || []).push(r); });
        var order = ['LTKT', 'LTKM', 'LTKL', 'LKU_BI', 'CDD', 'UNDERLYING', 'COMPLIANCE_REVIEW', 'INTERNAL_ALERT'];
        var keys = Object.keys(byType).sort(function (a, b) { return (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)); });
        var hits = {}; S.alerts.forEach(function (a) { if (a.rule_id) hits[a.rule_id] = (hits[a.rule_id] || 0) + 1; });
        var info = '<div class="gm-info"><i class="fa-solid fa-circle-info"></i><div><b>Cara kerja:</b> setiap transaksi yang tersimpan dicocokkan dengan aturan yang <b>aktif</b>, dihitung per nasabah dalam periode (hari) yang diatur. Jika memenuhi nominal dan/atau jumlah transaksi, sistem membuat temuan di tab <b>Laporan Temuan</b>. Perubahan aturan berlaku untuk transaksi berikutnya dan menaikkan nomor versi aturan. Aplikasi tidak mengirim laporan ke portal GoAML.' +
            (ed ? '' : '<br><b>Anda hanya dapat melihat.</b> Perubahan aturan dilakukan oleh owner, superadmin, admin, atau supervisor.') + '</div></div>';
        var tpl = ed ? '<div class="gm-card"><h3>Mulai dari template</h3><p class="sub">Isi awal aturan umum. Nilai ambang dan dasar regulasi dapat disesuaikan sebelum disimpan.</p><div class="gm-chips">' +
            '<button class="gm-chip" data-act="rule-tpl" data-v="usdlimit">Batas bulanan (USD)</button><button class="gm-chip" data-act="rule-tpl" data-v="ltkt">LTKT: transaksi tunai</button><button class="gm-chip" data-act="rule-tpl" data-v="ltkm">LTKM: monitoring penjualan</button><button class="gm-chip" data-act="rule-tpl" data-v="freq">Frekuensi transaksi</button></div></div>' : '';
        var list = keys.length ? keys.map(function (k) {
            var rs = byType[k].slice().sort(function (a, b) { return num(a.priority) - num(b.priority); });
            return '<div class="gm-group">' + esc((RESULTS[k] || { label: k }).label) + ' &middot; ' + esc((RESULTS[k] || { full: '' }).full) + '</div><div class="gm-rules">' + rs.map(function (r) {
                return '<div class="gm-rule ' + (r.is_active ? '' : 'off') + '"><div class="row"><h4>' + esc(r.name) + '</h4>' +
                    (ed ? '<label class="gm-sw" title="' + (r.is_active ? 'Nonaktifkan' : 'Aktifkan') + '"><input type="checkbox" data-act="toggle" data-id="' + r.id + '"' + (r.is_active ? ' checked' : '') + '><span></span></label>' : '<span class="gm-b ' + (r.is_active ? 'b-green' : 'b-gray') + '">' + (r.is_active ? 'Aktif' : 'Nonaktif') + '</span>') + '</div>' +
                    '<div class="nt mono">' + esc(r.code) + ' &middot; v' + esc(r.version) + ' &middot; ' + (r.rule_type === 'REGULATORY' ? 'Regulasi' : 'Monitoring internal') + '</div>' +
                    '<div class="crit">' + esc(describe(r)) + '</div>' + validityLine(r) +
                    ((r.regulation_source || r.regulation_no) ? '<div class="nt">Dasar: ' + esc([r.regulation_source, r.regulation_no, r.regulation_article].filter(Boolean).join(' &middot; ').replace(/&middot;/g, '·')) + '</div>' : '') +
                    '<div class="row"><span class="nt">' + (hits[r.id] || 0) + ' temuan tercatat &middot; ' + esc(r.severity) + '</span>' + (ed ? '<span style="display:flex;gap:6px"><button class="gm-btn" data-act="rule-revise" data-id="' + r.id + '" title="Ganti ambang karena regulasi berubah, riwayat tetap tersimpan">Ganti Ambang</button><button class="gm-btn" data-act="rule-edit" data-id="' + r.id + '">Ubah</button></span>' : '') + '</div></div>';
            }).join('') + '</div>';
        }).join('') : '<div class="gm-empty">Belum ada aturan. ' + (ed ? 'Tambahkan aturan pertama dari template di atas.' : '') + '</div>';
        return info + tpl + list;
    }

    /* ---------- Modal ---------- */
    function openModal(html, small) {
        closeModal();
        var ov = document.createElement('div'); ov.className = 'gm-ov gm'; ov.id = 'gmOv';
        ov.innerHTML = '<div class="gm-modal ' + (small ? 'sm' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
        ov.addEventListener('click', onClick); ov.addEventListener('input', onInput); ov.addEventListener('change', onChange);
        document.body.appendChild(ov);
        var f = ov.querySelector('input,select,textarea,button[data-act]'); if (f) f.focus();
    }
    function closeModal() { var o = $('gmOv'); if (o) o.remove(); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    function mh(title, sub) { return '<div class="gm-mh"><div><h3>' + esc(title) + '</h3>' + (sub ? '<div class="nt">' + esc(sub) + '</div>' : '') + '</div><button class="gm-btn x" data-act="close" aria-label="Tutup">Tutup</button></div>'; }

    function txTable(list) {
        if (!list.length) return '<div class="gm-empty" style="padding:14px">Rincian transaksi tidak tersedia.</div>';
        return '<div class="gm-tw"><table><thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Jenis</th><th>Valuta</th><th class="r">Nominal</th><th class="r">Total (IDR)</th><th>Bayar</th></tr></thead><tbody>' +
            list.map(function (t) { return '<tr><td class="mono"><b>' + esc(t.id || '-') + '</b></td><td>' + esc(fmt(t.timestamp)) + '</td><td>' + esc(t.tipe || '-') + '</td><td>' + esc(t.valuta || '-') + '</td><td class="r">' + num(t.nominal).toLocaleString('id-ID') + '</td><td class="r">' + idr(t.total) + '</td><td>' + esc(t.paymentMethod || '-') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    function alertById(id) { return S.alerts.filter(function (a) { return Number(a.id) === Number(id); })[0]; }
    function canDraft(a) { return a && a.status === 'APPROVED' && String(a.result_type || '').toUpperCase() === 'LTKM'; }
    function hasDraft(a) { return S.drafts.some(function (d) { return Number(d.alert_id) === Number(a.id); }); }

    function showDetail(id) {
        var a = alertById(id); if (!a) return;
        var rule = a.rule || {}, tx = (a.transactions || []).map(function (x) { return x.transaction || {}; });
        openModal(mh(a.alert_no, (a.customer_name || '-') + ' · ' + (a.customer_id || '-')) +
            '<div class="gm-sum"><div><span>Jenis laporan</span><b>' + esc((RESULTS[a.result_type] || { label: a.result_type || '-' }).label) + '</b></div><div><span>Status</span><b>' + esc((STATUS[a.status] || { label: a.status }).label) + '</b></div><div><span>Jumlah transaksi</span><b>' + num(a.transaction_count) + '</b></div><div><span>Total</span><b>' + idr(a.total_amount_idr) + '</b>' + (a.total_amount_usd != null ? '<span>' + usd(a.total_amount_usd) + '</span>' : '') + '</div></div>' +
            '<div class="gm-sec">Alasan terjaring</div><div class="gm-prev">' + esc(a.reason || '-') + '</div>' +
            '<div class="gm-sec">Aturan &amp; dasar regulasi</div><div class="nt" style="font-size:.82rem">' + esc(rule.name || '-') + ' (' + esc(rule.code || '-') + ')<br>' + esc([rule.regulation_source, rule.regulation_no, rule.regulation_article].filter(Boolean).join(' · ') || 'Dasar regulasi belum diisi') + '</div>' +
            '<div class="gm-sec">Periode</div><div class="nt" style="font-size:.82rem">' + esc(fmt(a.period_start)) + ' s.d. ' + esc(fmt(a.period_end)) + '</div>' +
            '<div class="gm-sec">Transaksi terkait</div>' + txTable(tx) +
            '<div class="gm-sec">Hasil tinjauan</div><div class="nt" style="font-size:.82rem">' + (a.reviewed_by ? 'Oleh ' + esc(a.reviewed_by) + ' pada ' + esc(fmt(a.reviewed_at)) + '<br>' : '') + esc(a.review_note || 'Belum ada catatan tinjauan.') + '</div>' +
            '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">' +
            (canEdit() ? '<button class="gm-btn" data-act="review" data-id="' + a.id + '">Tinjau</button>' : '') +
            (canEdit() && canDraft(a) ? '<button class="gm-btn pri" data-act="make-draft" data-id="' + a.id + '">' + (hasDraft(a) ? 'Lihat Draft LTKM' : 'Buat Draft LTKM') + '</button>' : '') + '</div>');
    }

    function showReview(id) {
        var a = alertById(id); if (!a || !canEdit()) return;
        openModal(mh('Tinjau Temuan', a.alert_no + ' · ' + (a.customer_name || '-')) +
            REVIEW_OPTIONS.map(function (o) { return '<label class="gm-opt ' + (a.status === o[0] ? 'on' : '') + '"><input type="radio" name="gmRs" value="' + o[0] + '"' + (a.status === o[0] ? ' checked' : '') + '><div><b>' + o[1] + '</b><span>' + o[2] + '</span></div></label>'; }).join('') +
            '<label class="l" for="gmNote" style="margin-top:12px">Catatan kepatuhan <span id="gmNoteReq" style="color:#f87171"></span></label><textarea id="gmNote" class="form-control" rows="3" maxlength="5000" placeholder="Dasar keputusan, hasil klarifikasi nasabah, dokumen pendukung">' + esc(a.review_note || '') + '</textarea>' +
            '<div id="gmRvErr" class="gm-err" style="display:none;margin-top:10px"></div>' +
            '<div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end"><button class="gm-btn" data-act="close">Batal</button><button class="gm-btn pri" data-act="review-save" data-id="' + a.id + '">Simpan Tinjauan</button></div>', true);
        syncReviewNote();
    }
    function syncReviewNote() {
        var sel = document.querySelector('input[name="gmRs"]:checked'); var need = sel && REVIEW_OPTIONS.filter(function (o) { return o[0] === sel.value; })[0][3];
        var m = $('gmNoteReq'); if (m) m.textContent = need ? '(wajib)' : '';
        Array.prototype.forEach.call(document.querySelectorAll('.gm-opt'), function (o) { o.classList.toggle('on', o.querySelector('input').checked); });
    }
    function saveReview(id) {
        var sel = document.querySelector('input[name="gmRs"]:checked'), note = ($('gmNote').value || '').trim(), err = $('gmRvErr');
        var need = sel && REVIEW_OPTIONS.filter(function (o) { return o[0] === sel.value; })[0][3];
        if (!sel) { err.style.display = 'block'; err.textContent = 'Pilih keputusan tinjauan.'; return; }
        if (need && !note) { err.style.display = 'block'; err.textContent = 'Catatan kepatuhan wajib diisi untuk keputusan ini.'; return; }
        api('/goaml/alerts/' + id + '/review', { method: 'POST', body: JSON.stringify({ status: sel.value, review_note: note || null }) })
            .then(function () { closeModal(); toast('Tinjauan tersimpan.'); return loadAll(); })
            .catch(function (e) { err.style.display = 'block'; err.textContent = e.message; });
    }

    function makeDraft(id) {
        var a = alertById(id);
        if (a && hasDraft(a)) { var d = S.drafts.filter(function (x) { return Number(x.alert_id) === Number(a.id); })[0]; showDraft(d.id); return; }
        api('/goaml/alerts/' + id + '/ltkm', { method: 'POST', body: JSON.stringify({}) })
            .then(function (res) { toast(res.message || 'Draft LTKM dibuat.'); return loadAll().then(function () { var rid = (res.report || {}).id; if (rid) showDraft(rid); }); })
            .catch(function (e) { toast(e.message, true); });
    }
    function showDraft(id) {
        api('/goaml/ltkm/' + id).then(function (res) {
            var r = res.report || res, a = r.alert || {}, rule = a.rule || {}, tx = (a.transactions || []).map(function (x) { return x.transaction || {}; });
            openModal(mh(r.report_no || 'Draft LTKM', (r.customer_name || '-') + ' · ' + (r.customer_id || '-')) +
                '<div class="gm-sum"><div><span>Status draft</span><b>' + esc(r.status || 'DRAFT') + '</b></div><div><span>Temuan asal</span><b>' + esc(a.alert_no || r.alert_id) + '</b></div><div><span>Jumlah transaksi</span><b>' + num(r.transaction_count) + '</b></div><div><span>Total</span><b>' + idr(r.total_amount_idr) + '</b></div></div>' +
                '<div class="gm-sec">Periode</div><div class="nt" style="font-size:.82rem">' + esc(fmt(r.period_start)) + ' s.d. ' + esc(fmt(r.period_end)) + '</div>' +
                '<div class="gm-sec">Dasar</div><div class="nt" style="font-size:.82rem">' + esc(rule.name || '-') + ' (' + esc(rule.code || '-') + ')<br>' + esc(a.reason || '-') + '</div>' +
                '<div class="gm-sec">Transaksi</div>' + txTable(tx) +
                '<div class="gm-sec">Catatan tinjauan temuan</div><div class="nt" style="font-size:.82rem">' + esc(a.review_note || '-') + '</div>');
        }).catch(function (e) { toast(e.message, true); });
    }

    /* ---------- Form aturan ---------- */
    function ruleById(id) { return S.rules.filter(function (r) { return Number(r.id) === Number(id); })[0]; }
    function showRuleForm(r, tpl) {
        if (!canEdit()) return;
        var v = r ? {
            id: r.id, name: r.name, code: r.code, rule_type: r.rule_type || 'REGULATORY', result_type: r.result_type || 'COMPLIANCE_REVIEW',
            transaction_type: (r.conditions || {}).transaction_type || '', payment_method: r.payment_method || '', period_unit: String(r.period_unit || 'DAY').toUpperCase(), period_days: r.period_days || '', min_transactions: r.min_transactions || '', amount_unit: String(r.amount_unit || 'IDR').toUpperCase(), amount_usd: r.amount_usd == null ? '' : num(r.amount_usd),
            amount_operator: r.amount_operator || '>', total_amount_idr: r.total_amount_idr == null ? '' : Math.round(num(r.total_amount_idr)), severity: r.severity || 'WARNING', action: r.action || 'REVIEW', priority: r.priority || 100,
            regulation_source: r.regulation_source || '', regulation_no: r.regulation_no || '', regulation_article: r.regulation_article || '', effective_from: String(r.effective_from || '').slice(0, 10), effective_until: String(r.effective_until || '').slice(0, 10), internal_note: r.internal_note || ''
        } : Object.assign({ id: '', regulation_source: '', regulation_no: '', regulation_article: '', effective_from: '', effective_until: '', rule_type: 'INTERNAL_MONITORING', result_type: 'COMPLIANCE_REVIEW', transaction_type: '', payment_method: '', period_unit: 'DAY', period_days: 1, min_transactions: '', amount_operator: '>', amount_unit: 'IDR', amount_usd: '', total_amount_idr: '', severity: 'WARNING', action: 'REVIEW', priority: 100, internal_note: '', name: '', code: '' }, tpl || {});
        var opt = function (list, cur) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
        var pm = [['', 'Semua metode'], ['CASH', 'Tunai (CASH)'], ['TRANSFER', 'Transfer'], ['SPLIT', 'Campuran (SPLIT)']];
        if (v.payment_method && !pm.some(function (o) { return o[0] === String(v.payment_method).toUpperCase(); })) pm.push([v.payment_method, v.payment_method]);
        var f = function (id, label, input, wide, hint) { return '<div class="' + (wide ? 'wide' : '') + '"><label class="l" for="' + id + '">' + label + '</label>' + input + (hint ? '<small>' + hint + '</small>' : '') + '</div>'; };
        openModal(mh(r ? 'Ubah Aturan' : 'Tambah Aturan', r ? r.code + ' · versi ' + r.version : 'Aturan baru aktif setelah disimpan') +
            '<input type="hidden" id="grId" value="' + esc(v.id) + '">' +
            '<div class="gm-sec" style="margin-top:0">1. Identitas aturan</div><div class="gm-grid">' +
            f('grName', 'Nama aturan', '<input id="grName" class="form-control" maxlength="180" value="' + esc(v.name) + '">', true) +
            f('grCode', 'Kode aturan', '<input id="grCode" class="form-control" maxlength="80" style="text-transform:uppercase" value="' + esc(v.code) + '">', false, 'Unik, tanpa spasi. Contoh: REG-LTKT-CASH-1D') +
            f('grType', 'Sifat aturan', '<select id="grType" class="form-control">' + opt([['REGULATORY', 'Regulasi'], ['INTERNAL_MONITORING', 'Monitoring internal']], v.rule_type) + '</select>') +
            f('grResult', 'Hasil jika terpenuhi', '<select id="grResult" class="form-control">' + opt(Object.keys(RESULTS).map(function (k) { return [k, RESULTS[k].label + ' · ' + RESULTS[k].full]; }), v.result_type) + '</select>', true) + '</div>' +
            '<div class="gm-sec">2. Kriteria threshold (dihitung per nasabah)</div><div class="gm-grid">' +
            f('grTx', 'Jenis transaksi', '<select id="grTx" class="form-control">' + opt([['', 'JUAL dan BELI'], ['JUAL', 'JUAL saja'], ['BELI', 'BELI saja']], v.transaction_type) + '</select>', false, 'JUAL dan BELI tidak digabung bila salah satu dipilih.') +
            f('grPm', 'Metode pembayaran', '<select id="grPm" class="form-control">' + opt(pm, String(v.payment_method).toUpperCase() === v.payment_method ? v.payment_method : v.payment_method) + '</select>') +
            f('grUnit', 'Satuan periode', '<select id="grUnit" class="form-control">' + opt([['MONTH', 'Bulan kalender'], ['DAY', 'Hari (jendela berjalan)']], v.period_unit) + '</select>', false, '<span id="grUnitHint"></span>') +
            f('grDays', 'Lama periode', '<input id="grDays" type="number" min="1" max="366" class="form-control" value="' + esc(v.period_days) + '">', false, 'Contoh: satuan Bulan dan lama 1 = per bulan kalender.') +
            f('grMin', 'Minimal jumlah transaksi', '<input id="grMin" type="number" min="1" class="form-control" value="' + esc(v.min_transactions) + '">', false, 'Kosongkan bila tidak dipakai.') +
            f('grOp', 'Operator nominal', '<select id="grOp" class="form-control">' + opt([['>', 'lebih dari (>)'], ['>=', 'minimal (>=)'], ['=', 'sama dengan (=)'], ['<', 'kurang dari (<)'], ['<=', 'maksimal (<=)']], v.amount_operator) + '</select>') +
            f('grAu', 'Satuan nominal', '<select id="grAu" class="form-control">' + opt([['USD', 'Ekuivalen USD'], ['IDR', 'Rupiah (IDR)']], v.amount_unit) + '</select>', false, 'USD: transaksi valas lain dikonversi dengan kurs tengah USD pada master valuta.') +
            f('grAmt', '<span id="grAmtLabel">Total nominal</span>', '<input id="grAmt" type="number" min="0" step="any" class="form-control" value="' + esc(v.amount_unit === 'USD' ? v.amount_usd : v.total_amount_idr) + '">', false, '<span id="grAmtHint"></span>') + '</div>' +
            '<div class="gm-sec">3. Dasar regulasi</div><div class="gm-grid">' +
            f('grSrc', 'Sumber', '<input id="grSrc" class="form-control" maxlength="80" placeholder="PPATK / BI / Internal" value="' + esc(v.regulation_source) + '">') +
            f('grNo', 'Nomor regulasi', '<input id="grNo" class="form-control" maxlength="120" value="' + esc(v.regulation_no) + '">') +
            f('grArt', 'Pasal / ketentuan', '<input id="grArt" class="form-control" maxlength="120" value="' + esc(v.regulation_article) + '">') +
            f('grFrom', 'Berlaku mulai', '<input id="grFrom" type="date" class="form-control" value="' + esc(v.effective_from) + '">') +
            f('grUntil', 'Berlaku sampai', '<input id="grUntil" type="date" class="form-control" value="' + esc(v.effective_until) + '">') + '</div>' +
            '<div class="gm-sec">4. Penanganan</div><div class="gm-grid">' +
            f('grSev', 'Tingkat (severity)', '<select id="grSev" class="form-control">' + opt([['INFO', 'INFO'], ['WARNING', 'WARNING'], ['REVIEW', 'REVIEW'], ['BLOCK', 'BLOCK']], v.severity) + '</select>') +
            f('grAct', 'Tindakan', '<select id="grAct" class="form-control">' + opt([['ALERT', 'ALERT'], ['REVIEW', 'REVIEW'], ['FLAG', 'FLAG'], ['REQUIRE_APPROVAL', 'REQUIRE_APPROVAL'], ['BLOCK', 'BLOCK']], v.action) + '</select>') +
            f('grPri', 'Prioritas', '<input id="grPri" type="number" min="1" class="form-control" value="' + esc(v.priority) + '">', false, 'Angka kecil dievaluasi lebih dulu.') +
            f('grNote', 'Catatan internal', '<textarea id="grNote" class="form-control" rows="2" maxlength="5000">' + esc(v.internal_note) + '</textarea>', true) + '</div>' +
            '<div class="gm-sec">Pratinjau</div><div class="gm-prev" id="grPrev"></div><div id="grErr" class="gm-err" style="display:none;margin-top:10px"></div>' +
            '<div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end"><button class="gm-btn" data-act="close">Batal</button><button class="gm-btn pri" data-act="rule-save">Simpan Aturan</button></div>');
        refreshRulePreview();
    }
    function readRule() {
        var g = function (id) { return ($(id) || {}).value || ''; };
        return {
            name: g('grName').trim(), code: g('grCode').trim().toUpperCase(), rule_type: g('grType'), result_type: g('grResult'), transaction_type: g('grTx'), payment_method: g('grPm'),
            period_unit: g('grUnit'), period_days: g('grDays'), min_transactions: g('grMin'), amount_operator: g('grOp'), amount_unit: g('grAu'), total_amount_idr: g('grAmt'), regulation_source: g('grSrc'), regulation_no: g('grNo'), regulation_article: g('grArt'),
            effective_from: g('grFrom'), effective_until: g('grUntil'), severity: g('grSev'), action: g('grAct'), priority: g('grPri'), internal_note: g('grNote')
        };
    }
    function refreshRulePreview() {
        var r = readRule(); var p = $('grPrev'); if (!p) return;
        var res = RESULTS[r.result_type] || { label: r.result_type };
        var isUsd = r.amount_unit === 'USD', has = r.total_amount_idr !== '';
        p.textContent = 'Temuan ' + res.label + ' dibuat bila ' + describe({ conditions: { transaction_type: r.transaction_type }, payment_method: r.payment_method, min_transactions: r.min_transactions, amount_unit: r.amount_unit, amount_usd: isUsd && has ? r.total_amount_idr : null, total_amount_idr: !isUsd && has ? r.total_amount_idr : null, amount_operator: r.amount_operator, period_unit: r.period_unit, period_days: r.period_days || 1 }).replace(/\.$/, '') + '.';
        var l = $('grAmtLabel'); if (l) l.textContent = isUsd ? 'Total nominal (ekuivalen USD)' : 'Total nominal (IDR)';
        var h = $('grAmtHint'); if (h) h.textContent = has ? (isUsd ? usd(r.total_amount_idr) : idr(r.total_amount_idr)) : (isUsd ? 'Isi 10000 untuk USD 10.000' : '');
        var u = $('grUnitHint'); if (u) u.textContent = r.period_unit === 'MONTH' ? 'Dihitung dari tanggal 1 bulan tersebut sampai transaksi terakhir.' : 'Jendela berjalan sebelum transaksi pemicu; 1 hari = 24 jam.';
    }
    function saveRule() {
        var r = readRule(), id = $('grId').value, err = $('grErr');
        var fail = function (m) { err.style.display = 'block'; err.textContent = m; };
        if (!r.name) return fail('Nama aturan wajib diisi.');
        if (!r.code || /\s/.test(r.code)) return fail('Kode aturan wajib diisi dan tidak boleh mengandung spasi.');
        if (r.total_amount_idr === '' && r.min_transactions === '') return fail('Isi total nominal atau minimal jumlah transaksi; tanpa kriteria, setiap transaksi akan menjadi temuan.');
        if (r.period_days === '' || Number(r.period_days) < 1) return fail('Lama periode wajib diisi (minimal 1).');
        if (r.effective_from && r.effective_until && r.effective_until < r.effective_from) return fail('Tanggal berlaku sampai harus setelah tanggal mulai.');
        var existing = id ? ruleById(id) : null;
        var body = {
            name: r.name, code: r.code, rule_type: r.rule_type, regulation_source: r.regulation_source || null, regulation_no: r.regulation_no || null, regulation_article: r.regulation_article || null,
            effective_from: r.effective_from || null, effective_until: r.effective_until || null, target: 'CUSTOMER', classification: r.rule_type === 'INTERNAL_MONITORING' ? 'INTERNAL_WARNING' : null,
            severity: r.severity, action: r.action, result_type: r.result_type, min_transactions: r.min_transactions !== '' ? Number(r.min_transactions) : null, period_days: r.period_days !== '' ? Number(r.period_days) : null, period_unit: r.period_unit,
            amount_unit: r.amount_unit, amount_usd: r.amount_unit === 'USD' && r.total_amount_idr !== '' ? Number(r.total_amount_idr) : null,
            total_amount_idr: r.amount_unit === 'IDR' && r.total_amount_idr !== '' ? Number(r.total_amount_idr) : null, amount_operator: r.amount_operator, payment_method: r.payment_method || null,
            conditions: Object.assign({}, existing && existing.conditions || {}, { logic: 'AND', aggregation: 'CUSTOMER', amount_basis: r.amount_unit === 'USD' ? 'USD_EQUIVALENT' : 'IDR_TOTAL', transaction_type: r.transaction_type || null }),
            internal_note: r.internal_note || null, priority: Number(r.priority || 100), is_active: existing ? !!existing.is_active : true
        };
        api(id ? '/goaml/rules/' + id : '/goaml/rules', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) })
            .then(function () { closeModal(); toast(id ? 'Aturan diperbarui (versi naik).' : 'Aturan tersimpan dan aktif.'); return loadAll(); })
            .catch(function (e) { fail(e.message); });
    }
    function toggleRule(id, on, input) {
        api('/goaml/rules/' + id, { method: 'PUT', body: JSON.stringify({ is_active: on }) })
            .then(function () { toast(on ? 'Aturan diaktifkan.' : 'Aturan dinonaktifkan.'); return loadAll(); })
            .catch(function (e) { if (input) input.checked = !on; toast(e.message, true); });
    }

    function showRevise(id) {
        var r = ruleById(id); if (!r || !canEdit()) return;
        var isUsd = String(r.amount_unit || 'IDR').toUpperCase() === 'USD';
        var cur = isUsd ? usd(r.amount_usd) : idr(r.total_amount_idr);
        openModal(mh('Ganti Ambang karena Regulasi Berubah', r.name) +
            '<div class="gm-info"><i class="fa-solid fa-circle-info"></i><div>Aturan lama (<b>' + esc(cur) + '</b>) dibatasi sampai sehari sebelum tanggal berlaku baru, lalu dibuat aturan baru dengan nilai baru. Temuan dan riwayat lama tetap tersimpan, dan transaksi lama tidak dievaluasi ulang.</div></div>' +
            '<div class="gm-grid" style="margin-top:12px"><div><label class="l" for="rvDate">Tanggal berlaku baru</label><input id="rvDate" type="date" class="form-control"></div>' +
            '<div><label class="l" for="rvAmt">Nilai ambang baru (' + (isUsd ? 'ekuivalen USD' : 'IDR') + ')</label><input id="rvAmt" type="number" min="0" step="any" class="form-control"></div>' +
            '<div><label class="l" for="rvNo">Nomor regulasi baru</label><input id="rvNo" class="form-control" maxlength="120"></div>' +
            '<div><label class="l" for="rvArt">Pasal / ketentuan</label><input id="rvArt" class="form-control" maxlength="120"></div></div>' +
            '<div id="rvErr" class="gm-err" style="display:none;margin-top:10px"></div>' +
            '<div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end"><button class="gm-btn" data-act="close">Batal</button><button class="gm-btn pri" data-act="rule-revise-save" data-id="' + r.id + '">Terapkan</button></div>', true);
    }
    function reviseSave(id) {
        var r = ruleById(id), err = $('rvErr'), fail = function (m) { err.style.display = 'block'; err.textContent = m; };
        var date = $('rvDate').value, amt = $('rvAmt').value;
        if (!date) return fail('Tanggal berlaku baru wajib diisi.');
        if (amt === '' || Number(amt) < 0) return fail('Nilai ambang baru wajib diisi.');
        var from = String(r.effective_from || '').slice(0, 10);
        if (from && date <= from) return fail('Tanggal berlaku baru harus setelah tanggal mulai aturan lama (' + from + ').');
        var isUsd = String(r.amount_unit || 'IDR').toUpperCase() === 'USD';
        var prev = new Date(date + 'T00:00:00Z'); prev.setUTCDate(prev.getUTCDate() - 1);
        var until = prev.toISOString().slice(0, 10), stamp = date.replace(/-/g, '');
        var body = {
            name: r.name, code: String(r.code).replace(/-\d{8}$/, '') + '-' + stamp, rule_type: r.rule_type, regulation_source: r.regulation_source || null, regulation_no: $('rvNo').value.trim() || null, regulation_article: $('rvArt').value.trim() || null,
            effective_from: date, effective_until: null, target: r.target || 'CUSTOMER', classification: r.classification || null, severity: r.severity, action: r.action, result_type: r.result_type,
            min_transactions: r.min_transactions || null, period_days: r.period_days || null, period_unit: String(r.period_unit || 'DAY').toUpperCase(), amount_unit: isUsd ? 'USD' : 'IDR',
            amount_usd: isUsd ? Number(amt) : null, total_amount_idr: isUsd ? null : Number(amt), amount_operator: r.amount_operator, payment_method: r.payment_method || null,
            conditions: r.conditions || {}, internal_note: r.internal_note || null, priority: r.priority || 100, is_active: true
        };
        api('/goaml/rules', { method: 'POST', body: JSON.stringify(body) })
            .then(function () { return api('/goaml/rules/' + id, { method: 'PUT', body: JSON.stringify({ effective_until: until }) }); })
            .then(function () { closeModal(); toast('Ambang baru berlaku mulai ' + date.split('-').reverse().join('/') + '. Aturan lama berakhir ' + until.split('-').reverse().join('/') + '.'); return loadAll(); })
            .catch(function (e) { fail(e.message); });
    }

    /* ---------- Export ---------- */
    function exportXlsx() {
        var rows = filtered();
        if (!rows.length) { toast('Tidak ada data untuk diekspor.', true); return; }
        if (typeof XLSX === 'undefined' || typeof window.safeExportXLSX !== 'function') { toast('Library Excel belum termuat.', true); return; }
        var d1 = [['No. Temuan', 'Tanggal', 'Nasabah', 'ID Nasabah', 'Aturan', 'Kode Aturan', 'Jenis Laporan', 'Dasar Regulasi', 'Periode Mulai', 'Periode Selesai', 'Jumlah Transaksi', 'Total (IDR)', 'Total (ekuivalen USD)', 'Status', 'Catatan Tinjauan', 'Ditinjau Oleh', 'Tanggal Tinjauan']];
        var d2 = [['No. Temuan', 'No. Invoice', 'Tanggal', 'Jenis', 'Valuta', 'Nominal', 'Kurs', 'Total (IDR)', 'Metode Bayar']];
        rows.forEach(function (a) {
            var rule = a.rule || {};
            d1.push([a.alert_no, fmt(a.created_at), a.customer_name || '', String(a.customer_id || ''), rule.name || '', rule.code || '', (RESULTS[a.result_type] || { label: a.result_type || '' }).label,
                [rule.regulation_source, rule.regulation_no, rule.regulation_article].filter(Boolean).join(' · '), fmt(a.period_start), fmt(a.period_end), num(a.transaction_count), num(a.total_amount_idr), a.total_amount_usd != null ? num(a.total_amount_usd) : '',
                (STATUS[a.status] || { label: a.status }).label, a.review_note || '', a.reviewed_by || '', a.reviewed_at ? fmt(a.reviewed_at) : '']);
            (a.transactions || []).forEach(function (x) { var t = x.transaction || {}; d2.push([a.alert_no, t.id || x.transaction_invoice_id || '', fmt(t.timestamp), t.tipe || '', t.valuta || '', num(t.nominal), num(t.rate), num(t.total || x.amount_idr), t.paymentMethod || '']); });
        });
        var w1 = XLSX.utils.aoa_to_sheet(d1), w2 = XLSX.utils.aoa_to_sheet(d2);
        w1['!cols'] = [22, 17, 24, 14, 38, 26, 14, 36, 17, 17, 10, 18, 18, 12, 40, 16, 17].map(function (w) { return { wch: w }; });
        w2['!cols'] = [22, 22, 17, 8, 8, 14, 12, 18, 12].map(function (w) { return { wch: w }; });
        var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, w1, 'Temuan'); XLSX.utils.book_append_sheet(wb, w2, 'Transaksi');
        var n = new Date(); var tag = n.getFullYear() + String(n.getMonth() + 1).padStart(2, '0') + String(n.getDate()).padStart(2, '0');
        Promise.resolve(window.safeExportXLSX(wb, 'GoAML_Temuan_' + tag + '.xlsx')).then(function (ok) { if (ok) toast(rows.length + ' temuan diekspor.'); });
    }

    /* ---------- Event ---------- */
    function onClick(e) {
        var el = e.target.closest('[data-act]'); if (!el || el.tagName === 'INPUT' && el.type === 'checkbox') return;
        var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
        switch (act) {
            case 'tab': S.tab = el.getAttribute('data-tab'); render(); break;
            case 'refresh': S.loaded = false; render(); loadAll(); break;
            case 'chip': S.result = el.getAttribute('data-v') || ''; render(); break;
            case 'detail': showDetail(id); break;
            case 'review': showReview(id); break;
            case 'review-save': saveReview(id); break;
            case 'make-draft': makeDraft(id); break;
            case 'draft': showDraft(id); break;
            case 'export': exportXlsx(); break;
            case 'close': closeModal(); break;
            case 'rule-new': showRuleForm(null); break;
            case 'rule-tpl': showRuleForm(null, TEMPLATES[el.getAttribute('data-v')]); break;
            case 'rule-edit': showRuleForm(ruleById(id)); break;
            case 'rule-save': saveRule(); break;
            case 'rule-revise': showRevise(id); break;
            case 'rule-revise-save': reviseSave(id); break;
        }
    }
    function onChange(e) {
        var t = e.target;
        if (t.getAttribute && t.getAttribute('data-act') === 'toggle') { toggleRule(t.getAttribute('data-id'), t.checked, t); return; }
        if (t.name === 'gmRs') { syncReviewNote(); return; }
        if (t.id === 'gmStatus') { S.status = t.value; render(); }
        else if (t.id === 'gmFrom') { S.from = t.value; render(); }
        else if (t.id === 'gmTo') { S.to = t.value; render(); }
        else if (t.id && t.id.indexOf('gr') === 0) refreshRulePreview();
    }
    var qTimer = null;
    function onInput(e) {
        var t = e.target;
        if (t.id === 'gmQ') {
            S.q = t.value; clearTimeout(qTimer);
            qTimer = setTimeout(function () { var pos = t.selectionStart; render(); var n = $('gmQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }, 250);
        } else if (t.id && t.id.indexOf('gr') === 0) refreshRulePreview();
    }

    /* ---------- Lencana menu & pengait ---------- */
    function updateNavBadge() {
        var link = document.querySelector('.nav-item[data-target="laporan-goaml-view"]'); if (!link) return;
        var b = link.querySelector('.goaml-nav-badge'), n = pendingCount();
        if (!n) { if (b) b.remove(); return; }
        injectStyle();
        if (!b) { b = document.createElement('span'); b.className = 'goaml-nav-badge'; link.appendChild(b); }
        b.textContent = n > 99 ? '99+' : String(n);
        b.title = n + ' temuan perlu tindak lanjut';
    }
    function viewVisible() { var s = $('laporan-goaml-view'); return !!s && !s.classList.contains('hidden'); }
    function poll() {
        if (document.hidden) return;
        if (viewVisible() && !$('gmOv')) { loadAll(); return; }
        if (!viewVisible()) api('/goaml/alerts').then(function (a) { if (Array.isArray(a)) { S.alerts = a; updateNavBadge(); } }).catch(function () {});
    }

    window.loadGoamlView = function () { shell(); if (!S.loaded) render(); loadAll(); };
    if (!S.timer) S.timer = setInterval(poll, 45000);
    setTimeout(function () { if (role()) api('/goaml/alerts').then(function (a) { if (Array.isArray(a)) { S.alerts = a; updateNavBadge(); } }).catch(function () {}); }, 4000);
})();
