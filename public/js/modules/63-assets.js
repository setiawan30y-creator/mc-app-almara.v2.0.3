// @2026-Alifiandra
/* =====================================================================
 * 63-assets.js  —  Laporan > Aset & Penyusutan
 *
 * Register aset tetap + penyusutan sesuai praktik akuntansi (PSAK 16 / SAK EMKM):
 *  - Harga perolehan, nilai residu, masa manfaat, metode (garis lurus, saldo menurun
 *    ganda, atau tidak disusutkan untuk tanah).
 *  - Penyusutan dibebankan per akhir bulan, konvensi bulan perolehan (bisa diganti).
 *  - Pelepasan aset: laba/rugi = hasil penjualan - nilai buku.
 *  - Laporan tahunan: mutasi harga perolehan & akumulasi penyusutan per kategori,
 *    beban penyusutan bulanan, dan jurnal.
 *  - Jejak audit (siapa mengubah apa) dan ekspor Excel / cetak.
 *
 * Satu mesin hitung (window.MCAssets) dipakai juga oleh Neraca dan Laba Rugi BI
 * agar angka di semua laporan sama.
 * Data: mc_assets (kompatibel dengan data lama), mc_asset_settings, mc_asset_log.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcAssets) return;
    window.__mcAssets = true;

    var CATS = [
        { id: 'komputer', name: 'Komputer & elektronik', code: 'KOM', years: 4, method: 'SL' },
        { id: 'mebel', name: 'Mebel, brankas & perlengkapan kantor', code: 'MBL', years: 8, method: 'SL' },
        { id: 'peralatan', name: 'Peralatan operasional (mesin hitung uang, CCTV, detektor)', code: 'PRL', years: 4, method: 'SL' },
        { id: 'kendaraan', name: 'Kendaraan', code: 'KND', years: 8, method: 'SL' },
        { id: 'renovasi', name: 'Renovasi bangunan sewa', code: 'RNV', years: 5, method: 'SL' },
        { id: 'bangunan', name: 'Bangunan', code: 'BGN', years: 20, method: 'SL' },
        { id: 'tanah', name: 'Tanah (tidak disusutkan)', code: 'TNH', years: 0, method: 'NONE' },
        { id: 'lainnya', name: 'Lainnya', code: 'LNN', years: 4, method: 'SL' }
    ];
    var METHODS = { SL: 'Garis lurus', DDB: 'Saldo menurun ganda', NONE: 'Tidak disusutkan' };
    var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var K = { assets: 'mc_assets', settings: 'mc_asset_settings', log: 'mc_asset_log' };
    var MANAGE = ['owner', 'superadmin', 'admin', 'supervisor'];

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
    var catOf = function (id) { return CATS.filter(function (c) { return c.id === id; })[0] || CATS[CATS.length - 1]; };

    /* ============================ Penyimpanan ============================ */
    function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    function write(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return false; }
        try { if (typeof window.pushToUniversalDatastore === 'function') window.pushToUniversalDatastore(k, v); } catch (e) { /* abaikan */ }
        return true;
    }
    function assets() { var a = read(K.assets, []); return Array.isArray(a) ? a.filter(function (x) { return x && typeof x === 'object'; }) : []; }
    function saveAssetsList(list) { if (typeof window.saveAssets === 'function') { window.saveAssets(list); return true; } return write(K.assets, list); }
    function settings() { var s = read(K.settings, {}); return { convention: s.convention === 'next' ? 'next' : 'acq', capThreshold: Math.max(0, num(s.capThreshold)) }; }
    function actor() { try { var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null; return (u && (u.fullName || u.username)) || ''; } catch (e) { return ''; } }
    function role() { try { var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null; return (u && u.role) || ''; } catch (e) { return ''; } }
    function canManage() { return MANAGE.indexOf(role()) > -1; }
    function companyName() { try { var p = typeof window.getProfile === 'function' ? window.getProfile() : JSON.parse(localStorage.getItem('mc_profile') || '{}'); return (p && p.name) || 'Perusahaan'; } catch (e) { return 'Perusahaan'; } }
    function logEvent(action, a, detail) {
        var l = read(K.log, []); if (!Array.isArray(l)) l = [];
        l.push({ ts: new Date().toISOString(), user: actor(), action: action, id: a ? a.id : '', name: a ? a.name : '', detail: detail || '' });
        write(K.log, l.slice(-300));
    }

    /* ============================ Mesin hitung ============================ */
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    function parseDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if (!m) return null; var d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : d; }
    var mIdx = function (d) { return d.getFullYear() * 12 + d.getMonth(); };
    var monthDate = function (mi) { return { y: Math.floor(mi / 12), m: mi % 12 }; };
    function lastClosedMonth(asOf) { var last = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0).getDate(); return asOf.getDate() === last ? mIdx(asOf) : mIdx(asOf) - 1; }

    function norm(a) {
        var cost = Math.max(0, num(a.purchasePrice)), method = a.method === 'DDB' || a.method === 'NONE' ? a.method : 'SL';
        if (a.category === 'tanah' && !a.method) method = 'NONE';
        return { cost: cost, res: Math.min(Math.max(0, num(a.residualValue)), cost), method: method, lm: Math.round(num(a.usefulLifeYears) * 12), acq: parseDate(a.purchaseDate), disp: a.disposalDate ? parseDate(a.disposalDate) : null };
    }
    var cache = {};
    function schedule(a) {
        var n = norm(a), conv = settings().convention, key = [a.id, n.cost, n.res, n.method, n.lm, a.purchaseDate, a.disposalDate || '', conv].join('|');
        if (cache[key]) return cache[key];
        var out = { start: 0, rows: [], n: n };
        if (n.acq && n.method !== 'NONE' && n.lm > 0 && n.cost > 0) {
            var s = mIdx(n.acq) + (conv === 'next' ? 1 : 0), end = s + n.lm - 1;
            if (n.disp) end = Math.min(end, mIdx(n.disp) - (conv === 'next' ? 0 : 1));
            var base = n.cost - n.res, nbv = n.cost, acc = 0, r = 2 / n.lm;
            for (var i = 0; i <= end - s; i++) {
                var dep;
                if (n.method === 'DDB') dep = i === n.lm - 1 ? nbv - n.res : Math.min(nbv - n.res, Math.round(nbv * r));
                else dep = Math.round(base * (i + 1) / n.lm) - Math.round(base * i / n.lm);
                dep = Math.max(0, dep); acc += dep; nbv = n.cost - acc;
                out.rows.push({ m: s + i, dep: dep, acc: acc, nbv: nbv });
            }
            out.start = s;
        }
        if (Object.keys(cache).length > 2000) cache = {};
        cache[key] = out; return out;
    }
    function accAt(a, asOf) {
        var sc = schedule(a); if (!sc.rows.length) return 0;
        var i = Math.min(lastClosedMonth(asOf) - sc.start, sc.rows.length - 1); return i < 0 ? 0 : sc.rows[i].acc;
    }
    function expenseBetween(a, fromMi, toMi) { var t = 0; schedule(a).rows.forEach(function (r) { if (r.m >= fromMi && r.m <= toMi) t += r.dep; }); return t; }
    function totalAcc(a) { var r = schedule(a).rows; return r.length ? r[r.length - 1].acc : 0; }

    // Gambaran satu aset per tanggal laporan.
    function view(a, asOf) {
        var n = norm(a), existing = !!n.acq && n.acq <= asOf, disposed = !!n.disp && n.disp <= asOf;
        var acc = existing && !disposed ? accAt(a, asOf) : 0, cost = existing && !disposed ? n.cost : 0;
        var st = !n.acq ? 'invalid' : !existing ? 'future' : disposed ? 'disposed' : n.method === 'NONE' ? 'land' : (n.cost - acc <= n.res && n.cost > 0 && schedule(a).rows.length && lastClosedMonth(asOf) >= schedule(a).rows[schedule(a).rows.length - 1].m) ? 'full' : 'active';
        return { a: a, n: n, status: st, cost: cost, acc: acc, nbv: cost - acc, active: existing && !disposed };
    }
    function totalsAt(asOf) { var t = { cost: 0, acc: 0, nbv: 0 }; assets().forEach(function (a) { var v = view(a, asOf); t.cost += v.cost; t.acc += v.acc; t.nbv += v.nbv; }); return t; }
    function expenseForMonth(y, m0) { var mi = y * 12 + m0, t = 0; assets().forEach(function (a) { t += expenseBetween(a, mi, mi); }); return t; }

    window.MCAssets = { list: assets, totalsAt: totalsAt, expenseForMonth: expenseForMonth, accumulatedAt: function (a, d) { return accAt(a, d); }, schedule: schedule };

    /* ============================ Format ============================ */
    var nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    var rp = function (n) { n = Math.round(num(n)) || 0; return (n < 0 ? '-Rp ' : 'Rp ') + nf.format(Math.abs(n)); };
    var plain = function (n) { n = Math.round(num(n)) || 0; return n < 0 ? '(' + nf.format(-n) + ')' : nf.format(n); };
    var dmy = function (d) { return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '-'; };
    var dLong = function (d) { return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '-'; };
    var yrs = function (y) { y = num(y); return y % 1 ? String(y).replace('.', ',') : String(y); };

    /* ============================ Keadaan ============================ */
    var S = { tab: 'reg', asOf: ymd(new Date()), q: '', cat: '', status: 'all', sort: 'date', year: new Date().getFullYear(), built: false, openId: null };

    /* ============================ Gaya ============================ */
    function style() {
        if ($('ast-style')) return; var st = document.createElement('style'); st.id = 'ast-style';
        st.textContent = [
            '.ast{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#64748b);--pri:var(--mc-primary,#1D6C5D);--card:var(--mc-card-bg,#fff);--soft:rgba(100,116,139,.08);color:var(--mc-text,inherit);container-type:inline-size;display:flex;flex-direction:column;gap:14px}.ast *{box-sizing:border-box}',
            '.ast-head{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid var(--bd);border-left:4px solid var(--pri);border-radius:14px;padding:12px 16px;background:var(--card)}.ast-head h2{margin:0;font-size:1.1rem}.ast-head p{margin:2px 0 0;color:var(--mut);font-size:.8rem}.ast-head .act{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}',
            '.ast-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--bd);background:var(--card);color:inherit;font:inherit;font-weight:700;font-size:.82rem;border-radius:10px;cursor:pointer;min-height:40px;padding:0 14px;white-space:nowrap}.ast-btn:hover{border-color:var(--pri)}.ast-btn.pri{background:var(--pri);border-color:var(--pri);color:#fff}.ast-btn.dng{color:#dc2626}.ast-btn.sm{min-height:34px;padding:0 10px;font-size:.78rem}.ast-btn.ic{width:34px;min-width:34px;padding:0}.ast-btn:disabled{opacity:.5;cursor:not-allowed}',
            '.ast-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.ast-k{border:1px solid var(--bd);border-radius:12px;background:var(--card);padding:11px 14px;min-width:0}.ast-k small{display:block;font-size:.7rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.03em}.ast-k b{display:block;font-size:1.12rem;margin-top:3px;overflow-wrap:anywhere}.ast-k.neg b{color:#dc2626}.ast-k.pos b{color:var(--pri)}',
            '.ast-tabs{display:flex;gap:6px;border-bottom:1px solid var(--bd)}.ast-tab{border:0;border-bottom:3px solid transparent;background:none;color:var(--mut);font:inherit;font-weight:700;font-size:.86rem;padding:10px 16px;cursor:pointer;min-height:44px}.ast-tab.on{color:var(--pri);border-bottom-color:var(--pri)}',
            '.ast-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.ast-f{display:flex;flex-direction:column;gap:3px;min-width:0}.ast-f label{font-size:.68rem;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.03em}',
            '.ast input,.ast select,.ast textarea{border:1px solid var(--mc-input-border,var(--bd));background:var(--mc-input-bg,#fff);color:var(--mc-text,inherit);border-radius:10px;font:inherit;font-size:.86rem;min-height:40px;padding:0 11px;max-width:100%;min-width:0}.ast textarea{padding:9px 11px;min-height:70px;resize:vertical}.ast input:focus,.ast select:focus,.ast textarea:focus{outline:2px solid color-mix(in srgb,var(--pri) 45%,transparent)}',
            '.ast-card{border:1px solid var(--bd);border-radius:14px;background:var(--card);overflow:hidden}.ast-wrap{overflow-x:auto}.ast-t{width:100%;border-collapse:collapse;font-size:.82rem}.ast-t th{background:var(--soft);color:var(--mut);font-size:.68rem;text-transform:uppercase;letter-spacing:.03em;text-align:left;padding:9px 11px;white-space:nowrap;border-bottom:1px solid var(--bd)}.ast-t td{padding:9px 11px;border-bottom:1px solid var(--bd);vertical-align:middle}.ast-t tr:last-child td{border-bottom:0}.ast-t .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.ast-t tfoot td{background:var(--soft);font-weight:800;border-top:2px solid var(--bd)}.ast-t tr.sub td{background:var(--soft);font-weight:800}.ast-t tr.dis td{opacity:.62}',
            '.ast-n b{display:block}.ast-n small{color:var(--mut);font-size:.72rem}.ast-chip{display:inline-block;font-size:.68rem;font-weight:800;border-radius:99px;padding:2px 9px;white-space:nowrap}.ast-chip.active{background:rgba(22,163,74,.13);color:#15803d}.ast-chip.full{background:rgba(100,116,139,.18);color:#475569}.ast-chip.land{background:rgba(37,99,235,.12);color:#1d4ed8}.ast-chip.disposed{background:rgba(220,38,38,.12);color:#b91c1c}.ast-chip.future,.ast-chip.invalid{background:rgba(217,119,6,.15);color:#b45309}',
            '.ast-acts{display:flex;gap:5px;justify-content:flex-end}.ast-empty{padding:38px 18px;text-align:center;color:var(--mut);font-size:.88rem;line-height:1.6}',
            '.ast-cards{display:none;flex-direction:column;gap:10px}.ast-ac{border:1px solid var(--bd);border-radius:14px;background:var(--card);padding:12px 14px}.ast-ac.dis{opacity:.7}.ast-ac .top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.ast-ac .g{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin:10px 0}.ast-ac .g small{display:block;font-size:.66rem;color:var(--mut);text-transform:uppercase;font-weight:700}.ast-ac .g b{font-size:.86rem}.ast-ac .acts{display:flex;gap:6px;flex-wrap:wrap}',
            '.ast-note{font-size:.76rem;color:var(--mut);line-height:1.55}.ast-box{border:1px solid var(--bd);border-radius:12px;background:var(--soft);padding:11px 14px;font-size:.8rem;line-height:1.6}.ast-sec{margin:0 0 8px;font-size:.92rem}',
            '.ast-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px;--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#64748b);--pri:var(--mc-primary,#1D6C5D);--soft:rgba(100,116,139,.08)}.ast-ov *{box-sizing:border-box}.ast-modal{background:var(--mc-card-bg,#fff);color:var(--mc-text,#18221F);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;padding:18px 20px;box-shadow:0 24px 60px rgba(0,0,0,.3)}.ast-modal.wide{max-width:860px}.ast-modal h3{margin:0 0 12px;font-size:1.02rem}.ast-modal p{margin:0 0 10px;font-size:.86rem;line-height:1.55}',
            '.ast-modal .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}.ast-modal .grid .full{grid-column:1/-1}.ast-modal .ast-f input,.ast-modal .ast-f select,.ast-modal .ast-f textarea{width:100%}.ast-modal input,.ast-modal select,.ast-modal textarea{border:1px solid var(--mc-input-border,var(--bd));background:var(--mc-input-bg,#fff);color:inherit;border-radius:10px;font:inherit;font-size:.88rem;min-height:42px;padding:0 11px}.ast-modal textarea{padding:9px 11px;min-height:70px}.ast-modal .ast-f label{font-size:.68rem;font-weight:800;color:var(--mut);text-transform:uppercase}.ast-mf{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}',
            '.ast-err{background:rgba(220,38,38,.09);border:1px solid rgba(220,38,38,.3);color:#b91c1c;border-radius:10px;padding:9px 12px;font-size:.82rem;margin-bottom:10px}.ast-warn{background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.35);color:#92400e;border-radius:10px;padding:9px 12px;font-size:.8rem;margin-bottom:10px}.ast-hint{font-size:.72rem;color:var(--mut);margin-top:3px}',
            '.ast-res{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;border:1px solid var(--bd);border-radius:12px;background:var(--soft);padding:12px 14px;margin:10px 0}.ast-res small{display:block;font-size:.68rem;color:var(--mut);text-transform:uppercase;font-weight:700}.ast-res b{font-size:.92rem}.ast-res .pos{color:#15803d}.ast-res .neg{color:#b91c1c}',
            '.ast-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:10px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:90vw}.ast-toast.err{border-left-color:#ef4444}',
            '@container (max-width:1000px){.ast-kpi{grid-template-columns:repeat(3,minmax(0,1fr))}}',
            '@container (max-width:760px){.ast-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.ast-reg .ast-card{display:none}.ast-reg .ast-cards{display:flex}.ast-head .act{width:100%}.ast-head .act .ast-btn{flex:1}.ast-f{flex:1 1 140px}.ast-tab{flex:1;padding:10px 6px}}',
            '@media (max-width:560px){.ast-modal .grid{grid-template-columns:1fr}.ast-modal{padding:16px}.ast-mf .ast-btn{flex:1}.ast-res{grid-template-columns:1fr}}'
        ].join('\n'); document.head.appendChild(st);
    }
    function toast(m, err) { document.querySelectorAll('.ast-toast').forEach(function (o) { o.remove(); }); var t = document.createElement('div'); t.className = 'ast-toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800); }
    function dialog(html, wide) { closeDialog(); var ov = document.createElement('div'); ov.className = 'ast-ov'; ov.id = 'astOv'; ov.innerHTML = '<div class="ast-modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>'; ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeDialog(); }); ov.addEventListener('click', onClick); ov.addEventListener('input', onInput); ov.addEventListener('change', onChange); ov.addEventListener('submit', onSubmit); document.body.appendChild(ov); var f = ov.querySelector('input:not([type=hidden]),select'); if (f && !wide) f.focus(); }
    function closeDialog() { var o = $('astOv'); if (o) o.remove(); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDialog(); });

    /* ============================ Render ============================ */
    function build() {
        var root = $('assetRoot'); if (!root) return null; if (S.built) return root;
        style(); S.built = true; root.className = 'ast';
        root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
        return root;
    }
    var asOfDate = function () { return parseDate(S.asOf) || new Date(); };
    function render() {
        var root = build(); if (!root) return;
        var asOf = asOfDate(), mg = canManage();
        root.innerHTML = '<div class="ast-head"><div><h2>Aset &amp; Penyusutan</h2><p>Register aset tetap dan penyusutan sesuai standar akuntansi (PSAK 16 / SAK EMKM).</p></div><div class="act">' +
            '<button class="ast-btn" data-act="export"><i class="fa-solid fa-file-excel"></i> Excel</button><button class="ast-btn" data-act="print"><i class="fa-solid fa-print"></i> Cetak</button>' +
            (mg ? '<button class="ast-btn" data-act="settings" aria-label="Pengaturan"><i class="fa-solid fa-gear"></i></button><button class="ast-btn pri" data-act="add"><i class="fa-solid fa-plus"></i> Tambah aset</button>' : '') + '</div></div>' +
            kpiHtml(asOf) + '<div class="ast-tabs" role="tablist"><button class="ast-tab' + (S.tab === 'reg' ? ' on' : '') + '" role="tab" data-act="tab" data-t="reg">Daftar Aset</button><button class="ast-tab' + (S.tab === 'rep' ? ' on' : '') + '" role="tab" data-act="tab" data-t="rep">Laporan Tahunan</button></div>' +
            (S.tab === 'reg' ? regHtml(asOf, mg) : repHtml(mg));
    }
    function kpiHtml(asOf) {
        var vs = assets().map(function (a) { return view(a, asOf); }), cost = 0, acc = 0, cnt = 0, ytd = 0, y0 = asOf.getFullYear() * 12, mi = lastClosedMonth(asOf);
        vs.forEach(function (v) { cost += v.cost; acc += v.acc; if (v.active) cnt++; if (v.status !== 'future' && v.status !== 'invalid') ytd += expenseBetween(v.a, y0, mi); });
        return '<div class="ast-kpi"><div class="ast-k"><small>Harga perolehan</small><b>' + rp(cost) + '</b></div><div class="ast-k neg"><small>Akumulasi penyusutan</small><b>' + rp(acc) + '</b></div><div class="ast-k pos"><small>Nilai buku</small><b>' + rp(cost - acc) + '</b></div><div class="ast-k"><small>Beban tahun berjalan</small><b>' + rp(ytd) + '</b></div><div class="ast-k"><small>Aset aktif</small><b>' + cnt + ' unit</b></div></div>';
    }
    var STATUS = { active: 'Aktif', full: 'Habis disusutkan', land: 'Tidak disusutkan', disposed: 'Dilepas', future: 'Belum diperoleh', invalid: 'Tanggal tidak valid' };
    function filtered(asOf) {
        var q = S.q.trim().toLowerCase();
        var rows = assets().map(function (a) { return view(a, asOf); }).filter(function (v) {
            if (S.cat && (v.a.category || 'lainnya') !== S.cat) return false;
            if (S.status === 'active' && !(v.status === 'active' || v.status === 'land')) return false;
            if (S.status === 'full' && v.status !== 'full') return false;
            if (S.status === 'disposed' && v.status !== 'disposed') return false;
            if (S.status === 'all' && (v.status === 'future')) return false;
            if (q && (String(v.a.name || '') + ' ' + String(v.a.code || v.a.id || '') + ' ' + String(v.a.notes || '')).toLowerCase().indexOf(q) < 0) return false;
            return true;
        });
        rows.sort(function (x, y) { if (S.sort === 'name') return String(x.a.name).localeCompare(String(y.a.name)); if (S.sort === 'value') return y.nbv - x.nbv; return String(y.a.purchaseDate || '').localeCompare(String(x.a.purchaseDate || '')); });
        return rows;
    }
    function regHtml(asOf, mg) {
        var rows = filtered(asOf), all = assets().length;
        var bar = '<div class="ast-bar"><div class="ast-f" style="flex:2 1 200px"><label for="astQ">Cari aset</label><input id="astQ" type="search" placeholder="Nama, kode, atau keterangan" value="' + esc(S.q) + '"></div>' +
            '<div class="ast-f"><label for="astCat">Kategori</label><select id="astCat"><option value="">Semua</option>' + CATS.map(function (c) { return '<option value="' + c.id + '"' + (S.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
            '<div class="ast-f"><label for="astSt">Status</label><select id="astSt">' + [['all', 'Semua'], ['active', 'Aktif'], ['full', 'Habis disusutkan'], ['disposed', 'Dilepas']].map(function (o) { return '<option value="' + o[0] + '"' + (S.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="ast-f"><label for="astSort">Urutkan</label><select id="astSort">' + [['date', 'Terbaru'], ['name', 'Nama'], ['value', 'Nilai buku']].map(function (o) { return '<option value="' + o[0] + '"' + (S.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
            '<div class="ast-f"><label for="astAsOf">Per tanggal</label><input id="astAsOf" type="date" value="' + esc(S.asOf) + '"></div></div>';
        var note = '<div class="ast-note">Penyusutan dibebankan per akhir bulan (' + (settings().convention === 'next' ? 'mulai bulan setelah perolehan' : 'mulai bulan perolehan, penuh satu bulan') + '). Pilih tanggal akhir bulan untuk posisi tutup buku. Angka yang sama dipakai di Neraca dan Laba Rugi BI.</div>';
        if (!all) return bar + '<div class="ast-card"><div class="ast-empty"><i class="fa-solid fa-building" style="font-size:1.8rem;opacity:.5"></i><br>Belum ada aset tetap terdaftar.' + (mg ? '<br><button class="ast-btn pri" style="margin-top:12px" data-act="add"><i class="fa-solid fa-plus"></i> Tambah aset pertama</button>' : '') + '</div></div>';
        var tc = 0, ta = 0; rows.forEach(function (v) { tc += v.cost; ta += v.acc; });
        var body = rows.length ? rows.map(function (v) { return rowHtml(v, mg); }).join('') : '<tr><td colspan="8"><div class="ast-empty">Tidak ada aset yang cocok dengan filter.</div></td></tr>';
        var cards = rows.length ? rows.map(function (v) { return cardHtml(v, mg); }).join('') : '<div class="ast-card"><div class="ast-empty">Tidak ada aset yang cocok dengan filter.</div></div>';
        return '<div class="ast-reg" style="display:flex;flex-direction:column;gap:14px">' + bar + note + '<div class="ast-card"><div class="ast-wrap"><table class="ast-t" id="assetTable"><thead><tr><th>Aset</th><th>Perolehan</th><th class="r">Harga perolehan</th><th>Umur / metode</th><th class="r">Akumulasi</th><th class="r">Nilai buku</th><th>Status</th><th></th></tr></thead><tbody id="assetTableBody">' + body + '</tbody>' +
            '<tfoot><tr><td colspan="2">Total (' + rows.length + ' aset)</td><td class="r">' + rp(tc) + '</td><td></td><td class="r">' + rp(ta) + '</td><td class="r">' + rp(tc - ta) + '</td><td colspan="2"></td></tr></tfoot></table></div></div><div class="ast-cards">' + cards + '</div></div>';
    }
    function lifeLabel(v) { return v.n.method === 'NONE' ? '-' : yrs(v.a.usefulLifeYears) + ' th · ' + (v.n.method === 'DDB' ? 'Saldo menurun' : 'Garis lurus'); }
    function actsHtml(v, mg) {
        var id = esc(v.a.id), h = '<button class="ast-btn sm ic" data-act="detail" data-id="' + id + '" aria-label="Jadwal penyusutan" title="Jadwal penyusutan"><i class="fa-solid fa-table-list"></i></button>';
        if (mg) {
            h += '<button class="ast-btn sm ic" data-act="edit" data-id="' + id + '" aria-label="Ubah" title="Ubah"><i class="fa-solid fa-pen"></i></button>';
            h += v.status === 'disposed' ? '<button class="ast-btn sm ic" data-act="undispose" data-id="' + id + '" aria-label="Batalkan pelepasan" title="Batalkan pelepasan"><i class="fa-solid fa-rotate-left"></i></button>' : '<button class="ast-btn sm ic" data-act="dispose" data-id="' + id + '" aria-label="Lepas aset" title="Jual / hapus dari daftar"><i class="fa-solid fa-hand-holding-dollar"></i></button>';
            h += '<button class="ast-btn sm ic dng" data-act="del" data-id="' + id + '" aria-label="Hapus" title="Hapus"><i class="fa-solid fa-trash"></i></button>';
        }
        return h;
    }
    function rowHtml(v, mg) {
        var a = v.a, c = catOf(a.category), acq = v.n.acq;
        return '<tr class="' + (v.status === 'disposed' ? 'dis' : '') + '"><td class="ast-n"><b>' + esc(a.name) + '</b><small>' + esc(a.code || a.id) + ' · ' + esc(c.name.split(' (')[0]) + '</small></td><td>' + dmy(acq) + '</td><td class="r">' + rp(v.n.cost) + '</td><td>' + esc(lifeLabel(v)) + (v.n.res ? '<br><small style="color:var(--mut)">Residu ' + rp(v.n.res) + '</small>' : '') + '</td>' +
            '<td class="r">' + rp(v.acc) + '</td><td class="r"><b>' + rp(v.nbv) + '</b></td><td><span class="ast-chip ' + v.status + '">' + STATUS[v.status] + '</span></td><td><div class="ast-acts">' + actsHtml(v, mg) + '</div></td></tr>';
    }
    function cardHtml(v, mg) {
        var a = v.a, c = catOf(a.category);
        return '<div class="ast-ac' + (v.status === 'disposed' ? ' dis' : '') + '"><div class="top"><div class="ast-n"><b>' + esc(a.name) + '</b><small>' + esc(a.code || a.id) + ' · ' + esc(c.name.split(' (')[0]) + '</small></div><span class="ast-chip ' + v.status + '">' + STATUS[v.status] + '</span></div>' +
            '<div class="g"><div><small>Perolehan</small><b>' + dmy(v.n.acq) + '</b></div><div><small>Umur / metode</small><b>' + esc(lifeLabel(v)) + '</b></div><div><small>Harga perolehan</small><b>' + rp(v.n.cost) + '</b></div><div><small>Akumulasi</small><b>' + rp(v.acc) + '</b></div><div class="full" style="grid-column:1/-1"><small>Nilai buku</small><b style="font-size:1rem">' + rp(v.nbv) + '</b></div></div><div class="acts">' + actsHtml(v, mg) + '</div></div>';
    }

    /* ---------- Laporan tahunan ---------- */
    function yearReport(year) {
        var jan1 = new Date(year, 0, 1), dec31 = new Date(year, 11, 31), prevEnd = new Date(year - 1, 11, 31), y0 = year * 12, y1 = year * 12 + 11, by = {}, tot = null;
        var blank = function () { return { cb: 0, add: 0, disp: 0, ab: 0, exp: 0, adisp: 0, gain: 0 }; };
        tot = blank();
        assets().forEach(function (a) {
            var n = norm(a); if (!n.acq || !n.cost) return; var id = a.category || 'lainnya'; if (!by[id]) by[id] = blank(); var r = by[id];
            var begin = n.acq < jan1 && !(n.disp && n.disp < jan1);
            if (begin) { r.cb += n.cost; r.ab += accAt(a, prevEnd); }
            if (n.acq >= jan1 && n.acq <= dec31 && !(n.disp && n.disp < jan1)) r.add += n.cost;
            r.exp += expenseBetween(a, y0, y1);
            if (n.disp && n.disp >= jan1 && n.disp <= dec31) { r.disp += n.cost; var ta = totalAcc(a); r.adisp += ta; r.gain += num(a.disposalProceeds) - (n.cost - ta); }
        });
        Object.keys(by).forEach(function (k) { Object.keys(by[k]).forEach(function (f) { tot[f] += by[k][f]; }); });
        var months = []; for (var m = 0; m < 12; m++) months.push(expenseForMonth(year, m));
        return { by: by, tot: tot, months: months, gain: tot.gain };
    }
    function repHtml() {
        var y = S.year, rep = yearReport(y), cur = new Date().getFullYear(), opts = '';
        for (var i = cur + 1; i >= cur - 12; i--) opts += '<option value="' + i + '"' + (i === y ? ' selected' : '') + '>' + i + '</option>';
        var t = rep.tot, keys = CATS.map(function (c) { return c.id; }).filter(function (id) { return rep.by[id]; });
        var rows = keys.map(function (id) {
            var r = rep.by[id], ce = r.cb + r.add - r.disp, ae = r.ab + r.exp - r.adisp;
            return '<tr><td>' + esc(catOf(id).name.split(' (')[0]) + '</td><td class="r">' + plain(r.cb) + '</td><td class="r">' + plain(r.add) + '</td><td class="r">' + plain(-r.disp) + '</td><td class="r"><b>' + plain(ce) + '</b></td><td class="r">' + plain(r.ab) + '</td><td class="r">' + plain(r.exp) + '</td><td class="r">' + plain(-r.adisp) + '</td><td class="r"><b>' + plain(ae) + '</b></td><td class="r"><b>' + plain(ce - ae) + '</b></td></tr>';
        }).join('') || '<tr><td colspan="10"><div class="ast-empty">Tidak ada aset pada tahun ini.</div></td></tr>';
        var tce = t.cb + t.add - t.disp, tae = t.ab + t.exp - t.adisp;
        var ms = rep.months.map(function (v, m) { return '<tr><td>' + MONTHS[m] + ' ' + y + '</td><td class="r">' + plain(v) + '</td></tr>'; }).join('');
        var sum = rep.months.reduce(function (a, b) { return a + b; }, 0);
        return '<div class="ast-reg" style="display:flex;flex-direction:column;gap:14px"><div class="ast-bar"><div class="ast-f"><label for="astYear">Tahun buku</label><select id="astYear">' + opts + '</select></div></div>' +
            '<div><h3 class="ast-sec">Mutasi aset tetap tahun ' + y + '</h3><div class="ast-card"><div class="ast-wrap"><table class="ast-t" id="assetMutasiTable"><thead><tr><th rowspan="2">Kategori</th><th class="r" colspan="4" style="text-align:center">Harga perolehan</th><th class="r" colspan="4" style="text-align:center">Akumulasi penyusutan</th><th class="r" rowspan="2">Nilai buku akhir</th></tr><tr><th class="r">Saldo awal</th><th class="r">Penambahan</th><th class="r">Pelepasan</th><th class="r">Saldo akhir</th><th class="r">Saldo awal</th><th class="r">Beban</th><th class="r">Pelepasan</th><th class="r">Saldo akhir</th></tr></thead><tbody>' + rows + '</tbody>' +
            '<tfoot><tr><td>Total</td><td class="r">' + plain(t.cb) + '</td><td class="r">' + plain(t.add) + '</td><td class="r">' + plain(-t.disp) + '</td><td class="r">' + plain(tce) + '</td><td class="r">' + plain(t.ab) + '</td><td class="r">' + plain(t.exp) + '</td><td class="r">' + plain(-t.adisp) + '</td><td class="r">' + plain(tae) + '</td><td class="r">' + plain(tce - tae) + '</td></tr></tfoot></table></div></div>' +
            '<div class="ast-note" style="margin-top:6px">Laba (rugi) pelepasan aset tahun ini: <b>' + rp(rep.gain) + '</b> (hasil penjualan dikurangi nilai buku saat dilepas). Nilai ini belum otomatis masuk ke Laba Rugi; catat sebagai pendapatan / beban non-operasional bila ada.</div></div>' +
            '<div><h3 class="ast-sec">Beban penyusutan bulanan dan jurnal</h3><div class="ast-card"><div class="ast-wrap"><table class="ast-t" id="assetBulananTable"><thead><tr><th>Bulan</th><th class="r">Beban penyusutan</th></tr></thead><tbody>' + ms + '</tbody><tfoot><tr><td>Total ' + y + '</td><td class="r">' + plain(sum) + '</td></tr></tfoot></table></div></div>' +
            '<div class="ast-box" style="margin-top:8px"><b>Jurnal penyusutan bulanan</b><br>Debit: Beban Penyusutan Aset Tetap<br>&nbsp;&nbsp;&nbsp;Kredit: 110 – Akumulasi Penyusutan Aset Tetap (-/-)<br><span style="color:var(--mut)">Nilai sesuai kolom "Beban penyusutan" di atas. Aset tetap pada Neraca (109) dicatat sebesar harga perolehan.</span></div></div></div>';
    }

    /* ============================ Detail jadwal ============================ */
    function detail(id) {
        var a = assets().filter(function (x) { return String(x.id) === String(id); })[0]; if (!a) return;
        var sc = schedule(a), n = sc.n, v = view(a, asOfDate()), byYear = {};
        sc.rows.forEach(function (r) { var y = monthDate(r.m).y; if (!byYear[y]) byYear[y] = { dep: 0, acc: 0, nbv: 0 }; byYear[y].dep += r.dep; byYear[y].acc = r.acc; byYear[y].nbv = r.nbv; });
        var yrRows = Object.keys(byYear).map(function (y) { var b = byYear[y]; return '<tr><td>' + y + '</td><td class="r">' + plain(b.dep) + '</td><td class="r">' + plain(b.acc) + '</td><td class="r">' + plain(b.nbv) + '</td></tr>'; }).join('');
        var moRows = sc.rows.map(function (r) { var d = monthDate(r.m); return '<tr><td>' + MONTHS[d.m] + ' ' + d.y + '</td><td class="r">' + plain(r.dep) + '</td><td class="r">' + plain(r.acc) + '</td><td class="r">' + plain(r.nbv) + '</td></tr>'; }).join('');
        dialog('<h3>' + esc(a.name) + '</h3><div class="ast-res"><div><small>Kode</small><b>' + esc(a.code || a.id) + '</b></div><div><small>Kategori</small><b>' + esc(catOf(a.category).name.split(' (')[0]) + '</b></div><div><small>Tanggal perolehan</small><b>' + dLong(n.acq) + '</b></div><div><small>Harga perolehan</small><b>' + rp(n.cost) + '</b></div><div><small>Nilai residu</small><b>' + rp(n.res) + '</b></div><div><small>Umur / metode</small><b>' + esc(lifeLabel(v)) + '</b></div><div><small>Akumulasi per ' + dmy(asOfDate()) + '</small><b>' + rp(v.acc) + '</b></div><div><small>Nilai buku</small><b>' + rp(v.nbv) + '</b></div>' +
            (n.disp ? '<div class="full" style="grid-column:1/-1"><small>Dilepas</small><b>' + dLong(n.disp) + ' · hasil ' + rp(a.disposalProceeds) + '</b></div>' : '') + '</div>' +
            (a.notes ? '<p><b>Keterangan:</b> ' + esc(a.notes) + '</p>' : '') +
            (yrRows ? '<h3 style="font-size:.9rem">Ringkasan per tahun</h3><div class="ast-card"><div class="ast-wrap"><table class="ast-t"><thead><tr><th>Tahun</th><th class="r">Beban</th><th class="r">Akumulasi</th><th class="r">Nilai buku</th></tr></thead><tbody>' + yrRows + '</tbody></table></div></div><details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:.84rem;min-height:36px;display:flex;align-items:center">Jadwal per bulan (' + sc.rows.length + ' bulan)</summary><div class="ast-card" style="margin-top:6px;max-height:280px;overflow:auto"><table class="ast-t"><thead><tr><th>Bulan</th><th class="r">Beban</th><th class="r">Akumulasi</th><th class="r">Nilai buku</th></tr></thead><tbody>' + moRows + '</tbody></table></div></details>' : '<p class="ast-note">Aset ini tidak disusutkan atau belum memiliki jadwal penyusutan.</p>') +
            '<div class="ast-mf"><button class="ast-btn" data-act="close">Tutup</button></div>', true);
    }

    /* ============================ Form aset ============================ */
    function moneyVal(id) { var e = $(id); return e ? Number(String(e.value).replace(/\D/g, '')) || 0 : 0; }
    function moneyFmt(n) { return n ? nf.format(Math.round(n)) : ''; }
    function nextCode(catId) { var c = catOf(catId), y = new Date().getFullYear(), pre = c.code + '-' + y + '-', max = 0; assets().forEach(function (a) { if (String(a.code || '').indexOf(pre) === 0) max = Math.max(max, parseInt(String(a.code).slice(pre.length), 10) || 0); }); return pre + ('000' + (max + 1)).slice(-3); }
    function form(id) {
        var a = id ? assets().filter(function (x) { return String(x.id) === String(id); })[0] : null; if (id && !a) return;
        var n = a ? norm(a) : null, cat = a ? (a.category || 'lainnya') : 'komputer', c = catOf(cat), method = a ? n.method : c.method, years = a ? a.usefulLifeYears : c.years;
        dialog('<h3>' + (a ? 'Ubah aset' : 'Tambah aset') + '</h3><form id="astForm" novalidate><input type="hidden" id="astId" value="' + esc(a ? a.id : '') + '"><div id="astFErr"></div><div class="grid">' +
            '<div class="ast-f full"><label for="astName">Nama aset</label><input id="astName" maxlength="120" placeholder="Contoh: Komputer kasir, brankas" value="' + esc(a ? a.name : '') + '"></div>' +
            '<div class="ast-f"><label for="astCatF">Kategori</label><select id="astCatF">' + CATS.map(function (x) { return '<option value="' + x.id + '"' + (x.id === cat ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
            '<div class="ast-f"><label for="astCode">Kode aset</label><input id="astCode" maxlength="30" value="' + esc(a ? (a.code || a.id) : nextCode(cat)) + '"></div>' +
            '<div class="ast-f"><label for="astDate">Tanggal perolehan</label><input id="astDate" type="date" value="' + esc(a ? a.purchaseDate : ymd(new Date())) + '"></div>' +
            '<div class="ast-f"><label for="astPrice">Harga perolehan (Rp)</label><input id="astPrice" inputmode="numeric" autocomplete="off" placeholder="0" value="' + moneyFmt(a ? n.cost : 0) + '"></div>' +
            '<div class="ast-f"><label for="astMethod">Metode penyusutan</label><select id="astMethod">' + Object.keys(METHODS).map(function (k) { return '<option value="' + k + '"' + (k === method ? ' selected' : '') + '>' + METHODS[k] + '</option>'; }).join('') + '</select></div>' +
            '<div class="ast-f"><label for="astLife">Masa manfaat (tahun)</label><input id="astLife" type="number" min="0" max="50" step="0.5" value="' + esc(years) + '"></div>' +
            '<div class="ast-f"><label for="astRes">Nilai residu (Rp)</label><input id="astRes" inputmode="numeric" autocomplete="off" placeholder="0" value="' + moneyFmt(a ? n.res : 0) + '"></div>' +
            '<div class="ast-f full"><label for="astNotes">Keterangan (no. seri, lokasi, pemasok, no. faktur)</label><textarea id="astNotes" maxlength="400">' + esc(a ? a.notes : '') + '</textarea></div></div>' +
            '<div class="ast-hint">Masa manfaat dan metode terisi otomatis dari kategori sebagai usulan. Sesuaikan dengan kebijakan akuntansi perusahaan. Penyusutan dimulai ' + (settings().convention === 'next' ? 'bulan setelah perolehan' : 'pada bulan perolehan') + '.</div>' +
            '<div id="astPreview" class="ast-res" style="margin-top:12px"></div><div class="ast-mf"><button type="button" class="ast-btn" data-act="close">Batal</button><button type="submit" class="ast-btn pri">Simpan</button></div></form>');
        preview();
    }
    function formAsset() {
        return { purchasePrice: moneyVal('astPrice'), residualValue: moneyVal('astRes'), method: $('astMethod').value, usefulLifeYears: num($('astLife').value), purchaseDate: $('astDate').value, category: $('astCatF').value, id: $('astId').value || '__new', disposalDate: '' };
    }
    function preview() {
        var box = $('astPreview'); if (!box) return; var f = formAsset(), n = norm(f);
        if (!n.acq || !n.cost || (f.method !== 'NONE' && n.lm <= 0)) { box.innerHTML = '<div style="grid-column:1/-1;color:var(--mut)">Isi tanggal, harga, dan masa manfaat untuk melihat perkiraan penyusutan.</div>'; return; }
        if (f.method === 'NONE') { box.innerHTML = '<div style="grid-column:1/-1">Aset ini tidak disusutkan. Nilai buku tetap sebesar harga perolehan.</div>'; return; }
        var sc = schedule(f), first = sc.rows[0], last = sc.rows[sc.rows.length - 1], d0 = monthDate(sc.start), d1 = monthDate(last.m);
        box.innerHTML = '<div><small>Beban bulan pertama</small><b>' + rp(first.dep) + '</b></div><div><small>Dibebankan selama</small><b>' + sc.rows.length + ' bulan</b></div><div><small>Mulai</small><b>' + MONTHS[d0.m] + ' ' + d0.y + '</b></div><div><small>Selesai</small><b>' + MONTHS[d1.m] + ' ' + d1.y + '</b></div>';
    }
    function submitForm() {
        var err = [], name = $('astName').value.trim(), f = formAsset(), n = norm(f), code = $('astCode').value.trim(), id = $('astId').value;
        if (!name) err.push('Nama aset wajib diisi.');
        if (!n.acq) err.push('Tanggal perolehan wajib diisi.'); else if (n.acq > new Date(Date.now() + 86400000)) err.push('Tanggal perolehan tidak boleh di masa depan.');
        if (!n.cost) err.push('Harga perolehan harus lebih dari 0.');
        if (f.method !== 'NONE' && (f.usefulLifeYears <= 0 || f.usefulLifeYears > 50)) err.push('Masa manfaat harus antara 0,5 dan 50 tahun.');
        if (f.residualValue > n.cost) err.push('Nilai residu tidak boleh melebihi harga perolehan.');
        var list = assets();
        if (code && list.some(function (x) { return String(x.id) !== String(id) && String(x.code || x.id).toLowerCase() === code.toLowerCase(); })) err.push('Kode aset sudah dipakai aset lain.');
        if (err.length) { $('astFErr').innerHTML = '<div class="ast-err">' + err.map(esc).join('<br>') + '</div>'; $('astFErr').scrollIntoView({ block: 'nearest' }); return; }
        var rec = { name: name, category: f.category, code: code || nextCode(f.category), purchaseDate: f.purchaseDate, purchasePrice: n.cost, residualValue: n.res, method: f.method, usefulLifeYears: f.method === 'NONE' ? 0 : f.usefulLifeYears, notes: $('astNotes').value.trim() };
        var now = new Date().toISOString(), who = actor(), msg;
        if (id) {
            var i = list.findIndex(function (x) { return String(x.id) === String(id); }); if (i < 0) return;
            var old = list[i], diffs = [];
            [['name', 'nama'], ['purchaseDate', 'tanggal'], ['purchasePrice', 'harga'], ['residualValue', 'residu'], ['usefulLifeYears', 'masa manfaat'], ['method', 'metode']].forEach(function (p) { if (String(old[p[0]] == null ? '' : old[p[0]]) !== String(rec[p[0]])) diffs.push(p[1] + ': ' + (old[p[0]] == null ? '-' : old[p[0]]) + ' → ' + rec[p[0]]); });
            list[i] = Object.assign({}, old, rec, { updatedAt: now, updatedBy: who }); logEvent('ubah', list[i], diffs.join('; ') || 'tanpa perubahan nilai'); msg = 'Aset diperbarui.';
        } else {
            var th = settings().capThreshold; if (th && n.cost < th && !window.__astConfirmLow) { $('astFErr').innerHTML = '<div class="ast-warn">Harga perolehan di bawah batas kapitalisasi (' + rp(th) + '). Biasanya dibebankan langsung, bukan dicatat sebagai aset. Tekan Simpan sekali lagi bila tetap ingin mencatatnya.</div>'; window.__astConfirmLow = true; return; }
            window.__astConfirmLow = false;
            var nid = 'AST-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
            var dup = list.some(function (x) { return String(x.name).toLowerCase() === name.toLowerCase() && x.purchaseDate === rec.purchaseDate && num(x.purchasePrice) === n.cost; });
            list.push(Object.assign({ id: nid, createdAt: now, createdBy: who }, rec)); logEvent('tambah', list[list.length - 1], rp(n.cost) + (dup ? ' (mirip aset yang sudah ada)' : '')); msg = dup ? 'Aset disimpan. Perhatian: ada aset serupa dengan nama, tanggal, dan harga yang sama.' : 'Aset disimpan.';
        }
        if (!saveAssetsList(list)) { toast('Gagal menyimpan: penyimpanan browser penuh atau diblokir.', true); return; }
        closeDialog(); render(); toast(msg);
    }

    /* ============================ Pelepasan / hapus ============================ */
    function disposeForm(id) {
        var a = assets().filter(function (x) { return String(x.id) === String(id); })[0]; if (!a) return;
        dialog('<h3>Lepas aset: ' + esc(a.name) + '</h3><p class="ast-note">Gunakan untuk aset yang dijual, rusak, atau dihapus dari daftar. Penyusutan berhenti pada tanggal pelepasan dan laba (rugi) dihitung dari nilai buku.</p><form id="astDispForm" novalidate><input type="hidden" id="astDId" value="' + esc(a.id) + '"><div id="astDErr"></div><div class="grid"><div class="ast-f"><label for="astDDate">Tanggal pelepasan</label><input id="astDDate" type="date" value="' + ymd(new Date()) + '"></div><div class="ast-f"><label for="astDAmt">Hasil penjualan (Rp, isi 0 bila dibuang)</label><input id="astDAmt" inputmode="numeric" autocomplete="off" placeholder="0"></div></div><div id="astDPrev" class="ast-res"></div><div class="ast-mf"><button type="button" class="ast-btn" data-act="close">Batal</button><button type="submit" class="ast-btn pri">Lepas aset</button></div></form>');
        dispPrev();
    }
    function dispPrev() {
        var a = assets().filter(function (x) { return String(x.id) === String($('astDId').value); })[0], box = $('astDPrev'); if (!a || !box) return;
        var d = parseDate($('astDDate').value), n = norm(a); if (!d) { box.innerHTML = '<div style="grid-column:1/-1;color:var(--mut)">Isi tanggal pelepasan.</div>'; return; }
        var t = Object.assign({}, a, { disposalDate: ymd(d) }), acc = totalAcc(t), nbv = n.cost - acc, g = moneyVal('astDAmt') - nbv;
        box.innerHTML = '<div><small>Akumulasi s/d pelepasan</small><b>' + rp(acc) + '</b></div><div><small>Nilai buku saat dilepas</small><b>' + rp(nbv) + '</b></div><div style="grid-column:1/-1"><small>' + (g >= 0 ? 'Laba pelepasan' : 'Rugi pelepasan') + '</small><b class="' + (g >= 0 ? 'pos' : 'neg') + '">' + rp(Math.abs(g)) + '</b></div>';
    }
    function submitDispose() {
        var id = $('astDId').value, d = parseDate($('astDDate').value), list = assets(), i = list.findIndex(function (x) { return String(x.id) === String(id); }); if (i < 0) return;
        var n = norm(list[i]); if (!d) { $('astDErr').innerHTML = '<div class="ast-err">Tanggal pelepasan wajib diisi.</div>'; return; }
        if (n.acq && d < n.acq) { $('astDErr').innerHTML = '<div class="ast-err">Tanggal pelepasan tidak boleh sebelum tanggal perolehan.</div>'; return; }
        var amt = moneyVal('astDAmt'); list[i] = Object.assign({}, list[i], { disposalDate: ymd(d), disposalProceeds: amt, updatedAt: new Date().toISOString(), updatedBy: actor() });
        var acc = totalAcc(list[i]); logEvent('lepas', list[i], 'tanggal ' + ymd(d) + ', hasil ' + rp(amt) + ', nilai buku ' + rp(n.cost - acc));
        if (!saveAssetsList(list)) { toast('Gagal menyimpan.', true); return; } closeDialog(); render(); toast('Aset dilepas.');
    }
    function confirmBox(title, text, act, id, label) { dialog('<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><div class="ast-mf"><button class="ast-btn" data-act="close">Batal</button><button class="ast-btn pri" data-act="' + act + '" data-id="' + esc(id) + '">' + esc(label) + '</button></div>'); }

    /* ============================ Pengaturan & log ============================ */
    function settingsDlg() {
        var s = settings();
        dialog('<h3>Pengaturan penyusutan</h3><form id="astSetForm"><div class="grid"><div class="ast-f full"><label for="astConv">Kapan penyusutan dimulai</label><select id="astConv"><option value="acq"' + (s.convention === 'acq' ? ' selected' : '') + '>Bulan perolehan (penuh satu bulan)</option><option value="next"' + (s.convention === 'next' ? ' selected' : '') + '>Bulan setelah perolehan</option></select><div class="ast-hint">Berlaku untuk semua aset dan semua laporan (daftar aset, Neraca, Laba Rugi). Mengubahnya akan mengubah angka laporan periode lalu.</div></div>' +
            '<div class="ast-f full"><label for="astCap">Batas kapitalisasi (Rp)</label><input id="astCap" inputmode="numeric" placeholder="0 = tanpa batas" value="' + moneyFmt(s.capThreshold) + '"><div class="ast-hint">Pembelian di bawah nilai ini sebaiknya dibebankan langsung. Aplikasi akan memberi peringatan saat menambah aset.</div></div></div><div class="ast-mf"><button type="button" class="ast-btn" data-act="log"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat perubahan</button><button type="button" class="ast-btn" data-act="close">Batal</button><button type="submit" class="ast-btn pri">Simpan</button></div></form>');
    }
    function logDlg() {
        var l = read(K.log, []); if (!Array.isArray(l)) l = []; l = l.slice().reverse();
        var rows = l.length ? l.map(function (e) { var d = new Date(e.ts); return '<tr><td style="white-space:nowrap">' + dmy(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</td><td>' + esc(e.user || '-') + '</td><td><b>' + esc(e.action) + '</b></td><td>' + esc(e.name || '') + '</td><td>' + esc(e.detail || '') + '</td></tr>'; }).join('') : '<tr><td colspan="5"><div class="ast-empty">Belum ada riwayat.</div></td></tr>';
        dialog('<h3>Riwayat perubahan aset</h3><div class="ast-card" style="max-height:60vh;overflow:auto"><table class="ast-t"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Aset</th><th>Rincian</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="ast-mf"><button class="ast-btn" data-act="close">Tutup</button></div>', true);
    }

    /* ============================ Ekspor & cetak ============================ */
    function exportData() {
        var asOf = asOfDate(), rows = filtered(asOf), rep = yearReport(S.year);
        var reg = [[companyName()], ['Daftar Aset Tetap dan Penyusutan'], ['Per tanggal ' + dLong(asOf)], [], ['Kode', 'Nama aset', 'Kategori', 'Tanggal perolehan', 'Harga perolehan', 'Nilai residu', 'Masa manfaat (th)', 'Metode', 'Akumulasi penyusutan', 'Nilai buku', 'Status']];
        var tc = 0, ta = 0;
        rows.forEach(function (v) { tc += v.cost; ta += v.acc; reg.push([v.a.code || v.a.id, v.a.name, catOf(v.a.category).name, dmy(v.n.acq), v.n.cost, v.n.res, num(v.a.usefulLifeYears), METHODS[v.n.method], v.acc, v.nbv, STATUS[v.status]]); });
        reg.push(['', 'TOTAL', '', '', tc, '', '', '', ta, tc - ta, '']);
        var mut = [[companyName()], ['Mutasi Aset Tetap Tahun ' + S.year], [], ['Kategori', 'HP saldo awal', 'Penambahan', 'Pelepasan', 'HP saldo akhir', 'Akum. saldo awal', 'Beban penyusutan', 'Akum. pelepasan', 'Akum. saldo akhir', 'Nilai buku akhir']];
        CATS.forEach(function (c) { var r = rep.by[c.id]; if (!r) return; var ce = r.cb + r.add - r.disp, ae = r.ab + r.exp - r.adisp; mut.push([c.name, r.cb, r.add, -r.disp, ce, r.ab, r.exp, -r.adisp, ae, ce - ae]); });
        var t = rep.tot, tce = t.cb + t.add - t.disp, tae = t.ab + t.exp - t.adisp; mut.push(['TOTAL', t.cb, t.add, -t.disp, tce, t.ab, t.exp, -t.adisp, tae, tce - tae]); mut.push([]); mut.push(['Bulan', 'Beban penyusutan']);
        rep.months.forEach(function (v, m) { mut.push([MONTHS[m] + ' ' + S.year, v]); });
        var fname = 'Aset_Penyusutan_' + S.asOf;
        if (window.XLSX) {
            var wb = XLSX.utils.book_new(), w1 = XLSX.utils.aoa_to_sheet(reg), w2 = XLSX.utils.aoa_to_sheet(mut);
            w1['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]; w2['!cols'] = [{ wch: 36 }].concat(new Array(9).fill({ wch: 18 }));
            XLSX.utils.book_append_sheet(wb, w1, 'Daftar Aset'); XLSX.utils.book_append_sheet(wb, w2, 'Mutasi ' + S.year); XLSX.writeFile(wb, fname + '.xlsx'); toast('File Excel dibuat.'); return;
        }
        var csv = '﻿' + reg.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = fname + '.csv'; document.body.appendChild(a); a.click(); a.remove(); toast('File CSV dibuat.');
    }
    function printReport() {
        var asOf = asOfDate(), rows = filtered(asOf), tc = 0, ta = 0, who = actor();
        rows.forEach(function (v) { tc += v.cost; ta += v.acc; });
        var tr = rows.map(function (v, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(v.a.code || v.a.id) + '</td><td>' + esc(v.a.name) + '</td><td>' + dmy(v.n.acq) + '</td><td class="r">' + plain(v.n.cost) + '</td><td>' + esc(lifeLabel(v)) + '</td><td class="r">' + plain(v.acc) + '</td><td class="r">' + plain(v.nbv) + '</td><td>' + STATUS[v.status] + '</td></tr>'; }).join('');
        var w = window.open('', '_blank'); if (!w) { toast('Pop-up diblokir. Izinkan pop-up untuk mencetak.', true); return; }
        w.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Daftar Aset Tetap</title><style>@page{size:A4 landscape;margin:14mm}body{font:11px/1.4 Arial,sans-serif;color:#111}h1{font-size:15px;margin:0}h2{font-size:12px;margin:2px 0 10px;font-weight:400}table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:4px 6px;text-align:left}th{background:#eee}.r{text-align:right}tfoot td{font-weight:700;background:#f3f3f3}.sig{display:flex;justify-content:space-between;margin-top:40px}.sig div{width:30%;text-align:center}.sig span{display:block;margin-top:56px;border-top:1px solid #333;padding-top:3px}.f{margin-top:10px;color:#555;font-size:10px}</style></head><body><h1>' + esc(companyName()) + '</h1><h2>Daftar Aset Tetap dan Penyusutan per ' + esc(dLong(asOf)) + '</h2><table><thead><tr><th>No</th><th>Kode</th><th>Nama aset</th><th>Tgl perolehan</th><th class="r">Harga perolehan (Rp)</th><th>Umur / metode</th><th class="r">Akumulasi (Rp)</th><th class="r">Nilai buku (Rp)</th><th>Status</th></tr></thead><tbody>' + tr + '</tbody><tfoot><tr><td colspan="4">Total</td><td class="r">' + plain(tc) + '</td><td></td><td class="r">' + plain(ta) + '</td><td class="r">' + plain(tc - ta) + '</td><td></td></tr></tfoot></table>' +
            '<div class="sig"><div>Disusun oleh<span>' + esc(who) + '</span></div><div>Diperiksa oleh<span>&nbsp;</span></div><div>Disetujui oleh<span>&nbsp;</span></div></div><div class="f">Dicetak ' + esc(dLong(new Date())) + ' ' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) + (who ? ' oleh ' + esc(who) : '') + '. Penyusutan dibebankan per akhir bulan.</div></body></html>'); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 300);
    }

    /* ============================ Event ============================ */
    function onClick(e) {
        var t = e.target.closest('[data-act]'); if (!t) return; var a = t.dataset.act, id = t.dataset.id;
        if (['add', 'edit', 'dispose', 'undispose', 'del', 'settings', 'do-del', 'do-undispose'].indexOf(a) > -1 && !canManage()) { toast('Anda tidak memiliki izin untuk mengubah aset.', true); return; }
        switch (a) {
            case 'tab': S.tab = t.dataset.t; render(); break;
            case 'add': form(null); break; case 'edit': form(id); break; case 'detail': detail(id); break; case 'dispose': disposeForm(id); break;
            case 'undispose': confirmBox('Batalkan pelepasan?', 'Aset akan kembali tercatat aktif dan penyusutan dilanjutkan sesuai jadwal.', 'do-undispose', id, 'Batalkan pelepasan'); break;
            case 'del': confirmBox('Hapus aset?', 'Aset dihapus dari daftar dan laporan. Bila aset sudah dijual atau tidak dipakai, sebaiknya gunakan "Lepas aset" agar riwayatnya tetap ada. Penghapusan tercatat di riwayat perubahan.', 'do-del', id, 'Hapus'); break;
            case 'do-del': var l = assets(), x = l.filter(function (q) { return String(q.id) === String(id); })[0]; if (x) { saveAssetsList(l.filter(function (q) { return String(q.id) !== String(id); })); logEvent('hapus', x, rp(x.purchasePrice)); } closeDialog(); render(); toast('Aset dihapus.'); break;
            case 'do-undispose': var l2 = assets(), i = l2.findIndex(function (q) { return String(q.id) === String(id); }); if (i > -1) { var o = l2[i]; l2[i] = Object.assign({}, o, { disposalDate: '', disposalProceeds: 0, updatedAt: new Date().toISOString(), updatedBy: actor() }); saveAssetsList(l2); logEvent('batal lepas', l2[i], ''); } closeDialog(); render(); toast('Pelepasan dibatalkan.'); break;
            case 'settings': settingsDlg(); break; case 'log': logDlg(); break;
            case 'export': exportData(); break; case 'print': printReport(); break; case 'close': closeDialog(); break;
        }
    }
    function onInput(e) {
        var id = e.target.id;
        if (id === 'astQ') { S.q = e.target.value; var p = e.target.selectionStart; render(); var q = $('astQ'); if (q) { q.focus(); try { q.setSelectionRange(p, p); } catch (x) { /* abaikan */ } } }
        else if (id === 'astPrice' || id === 'astRes' || id === 'astDAmt' || id === 'astCap') { var d = e.target.value.replace(/\D/g, ''); e.target.value = d ? nf.format(+d) : ''; if (id === 'astDAmt') dispPrev(); else if (id !== 'astCap') preview(); }
        else if (id === 'astDate' || id === 'astLife') preview(); else if (id === 'astDDate') dispPrev();
    }
    function onChange(e) {
        var id = e.target.id, v = e.target.value;
        if (id === 'astCat') { S.cat = v; render(); } else if (id === 'astSt') { S.status = v; render(); } else if (id === 'astSort') { S.sort = v; render(); } else if (id === 'astAsOf') { S.asOf = v || ymd(new Date()); render(); } else if (id === 'astYear') { S.year = +v; render(); }
        else if (id === 'astCatF') { var c = catOf(v); $('astMethod').value = c.method; $('astLife').value = c.years; var code = $('astCode'); if (code && !$('astId').value) code.value = nextCode(v); preview(); }
        else if (id === 'astMethod') { if (v === 'NONE') $('astLife').value = 0; else if (!num($('astLife').value)) $('astLife').value = catOf($('astCatF').value).years || 4; preview(); }
    }
    function onSubmit(e) {
        e.preventDefault(); var id = e.target.id;
        if (id === 'astForm') submitForm(); else if (id === 'astDispForm') submitDispose();
        else if (id === 'astSetForm') {
            if (!canManage()) return; var s = { convention: $('astConv').value, capThreshold: moneyVal('astCap') }; var old = settings(); write(K.settings, s); cache = {};
            if (old.convention !== s.convention) logEvent('pengaturan', null, 'konvensi: ' + old.convention + ' → ' + s.convention); closeDialog(); render(); toast('Pengaturan disimpan.');
        }
    }

    /* ============================ Kompatibilitas ============================ */
    window.loadAssetReport = function () { var m = $('assetRoot'); if (!m) return; cache = {}; render(); };
    window.openAssetModal = function (id) { if (!canManage()) { toast('Anda tidak memiliki izin untuk mengubah aset.', true); return; } form(id || null); };
    window.closeAssetModal = closeDialog;
    window.deleteAsset = function (id) { if (canManage()) confirmBox('Hapus aset?', 'Aset dihapus dari daftar dan laporan.', 'do-del', id, 'Hapus'); };

    function init() { if (!$('assetRoot')) { setTimeout(init, 300); return; } render(); }
    window.addEventListener('storage', function (e) { if (e.key === K.assets || e.key === K.settings) { cache = {}; if ($('assetRoot') && S.built && !$('astOv')) render(); } });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
