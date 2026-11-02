// @2026-Alifiandra
/* =====================================================================
 * 69-kurs-history.js  —  Master Data & Valuta > Riwayat Kurs (audit BI)
 *
 *  - Status & pengaturan jadwal pencatatan (jam mulai, jam selesai, interval, hari).
 *  - Tombol "Catat Sekarang" (pencatatan manual).
 *  - Tampilan "Per Jam" (matriks valuta x jam, satu tanggal) dan "Daftar" (semua catatan).
 *  - Ekspor Excel / CSV dan cetak untuk diserahkan saat audit.
 *  Data dari /api/rate-history* (server mencatat otomatis lewat mc:rate-snapshot).
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcKursHistory) return;
    window.__mcKursHistory = true;

    var VIEW_ID = 'kurs-history-view', ROOT_ID = 'kurHistRoot';
    var DAYS = [[1, 'Sen'], [2, 'Sel'], [3, 'Rab'], [4, 'Kam'], [5, 'Jum'], [6, 'Sab'], [7, 'Min']];
    var SRC = { jadwal: 'Terjadwal', manual: 'Manual', perubahan: 'Perubahan kurs' };
    var MAX_ROWS_SHOWN = 3000;

    var S = { built: false, status: null, rows: [], from: '', to: '', code: '', source: '', mode: 'matrix', loading: false, lastTick: 0, dirty: false };

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var nf = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    var fmt = function (n) { return n == null || n === '' ? '-' : nf.format(Number(n) || 0); };
    // Selisih (margin) dengan tanda: +50 / −50 / 0
    var fmtM = function (n) { if (n == null || n === '') return '-'; var v = Number(n) || 0; return v > 0 ? '+' + nf.format(v) : (v < 0 ? '−' + nf.format(Math.abs(v)) : '0'); };
    var numOrEmpty = function (n) { return n == null || n === '' ? '' : Number(n); };
    var srcLine = function (base, margin) { return base == null ? '' : fmt(base) + ' · ' + fmtM(margin); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var dmy = function (s) { if (!s) return '-'; var p = String(s).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
    var hm = function (s) { return s ? String(s).slice(11, 16) : '-'; };

    function role() { try { var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null; return String((u && u.role) || '').toLowerCase(); } catch (e) { return ''; } }
    function canEdit() { return ['owner', 'superadmin', 'admin'].indexOf(role()) > -1; }
    function canSnap() { return ['owner', 'superadmin', 'admin', 'supervisor'].indexOf(role()) > -1; }
    function userName() { try { var u = getCurrentUser(); return (u && (u.fullName || u.name || u.username)) || ''; } catch (e) { return ''; } }
    function company() { try { var p = typeof getProfile === 'function' ? getProfile() : null; return (p && p.name) || 'Money Changer'; } catch (e) { return 'Money Changer'; } }
    function countryOf(code) {
        try {
            var base = String(code || '').slice(0, 3).toUpperCase();
            var m = (typeof getMasterCurrencies === 'function' ? getMasterCurrencies() : []).filter(function (x) { return String(x.code || '').toUpperCase() === base; })[0];
            return m ? (m.country || m.name || '') : '';
        } catch (e) { return ''; }
    }
    function labelOf(r) { return r.label || countryOf(r.code) || ''; }
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

    /* ---------------------------------------------------------- gaya */
    function injectStyle() {
        if ($('khist-style')) return;
        var st = document.createElement('style'); st.id = 'khist-style';
        st.textContent = [
            '.khs{--k-bd:var(--mc-border,rgba(148,163,184,.28));--k-card:var(--mc-card-bg,#18181b);--k-tx:var(--mc-text,#f8fafc);--k-mut:var(--mc-text-muted,#94a3b8);--k-pri:var(--mc-primary,#22c55e);',
            '--k-buy:var(--mc-buy,#16a34a);--k-sell:var(--mc-sell,#dc2626);--k-warn:var(--mc-warning,#f59e0b);--k-inp:var(--mc-input-bg,rgba(148,163,184,.08));--k-r:var(--mc-radius,14px);color:var(--k-tx);display:grid;gap:16px}',
            '.khs *{box-sizing:border-box}',
            '.khs-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}',
            '.khs-head h2{margin:0;font-size:1.25rem;display:flex;gap:10px;align-items:center}.khs-head p{margin:4px 0 0;color:var(--k-mut);font-size:.85rem;max-width:720px;line-height:1.5}',
            '.khs-acts{display:flex;gap:8px;flex-wrap:wrap}',
            '.khs-btn{border:1px solid var(--k-bd);background:transparent;color:var(--k-tx);padding:8px 13px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:600;font-size:.82rem;display:inline-flex;align-items:center;gap:7px;font-family:inherit}',
            '.khs-btn:hover{background:var(--k-inp)}.khs-btn[disabled]{opacity:.5;cursor:not-allowed}',
            '.khs-btn.pri{background:var(--mc-button-bg,var(--k-pri));border-color:var(--mc-button-bg,var(--k-pri));color:var(--mc-button-text,#fff)}',
            '.khs-btn.on{border-color:var(--k-pri);color:var(--k-pri);background:color-mix(in srgb,var(--k-pri) 10%,transparent)}',
            '.khs-card{background:var(--k-card);border:1px solid var(--k-bd);border-radius:var(--k-r);padding:16px 18px}',
            '.khs-card>h3{margin:0 0 4px;font-size:.95rem;display:flex;gap:8px;align-items:center}.khs-card>p{margin:0 0 14px;color:var(--k-mut);font-size:.8rem}',
            '.khs-tg{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--k-bd);background:transparent;color:var(--k-tx);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:.8rem;flex:none}',
            '.khs-tg:hover{background:var(--k-inp);border-color:var(--k-pri);color:var(--k-pri)}',
            '.khs-sum{font-weight:500;font-size:.78rem;color:var(--k-mut);margin-left:6px}',
            '.khs-card.collapsed>h3{margin:0}.khs-card.collapsed #khsSettingsBody{display:none}',
            '.khs-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}',
            '.khs-stat{border:1px solid var(--k-bd);border-radius:12px;padding:10px 12px}.khs-stat small{display:block;color:var(--k-mut);font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;font-weight:700}',
            '.khs-stat b{display:block;font-size:1rem;margin-top:3px}.khs-stat em{font-style:normal;font-size:.75rem;color:var(--k-mut)}',
            '.khs-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}.khs-dot.ok{background:#22c55e}.khs-dot.bad{background:#ef4444}.khs-dot.off{background:#94a3b8}',
            '.khs-warn{margin-top:12px;padding:10px 12px;border-left:3px solid var(--k-warn);background:color-mix(in srgb,var(--k-warn) 10%,transparent);border-radius:8px;font-size:.8rem;line-height:1.5}',
            '.khs-warn code{background:rgba(0,0,0,.25);padding:1px 6px;border-radius:5px;font-size:.75rem}',
            '.khs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 14px;align-items:end}',
            '.khs-f label{display:block;font-size:.74rem;font-weight:700;color:var(--k-mut);margin-bottom:5px}',
            '.khs-f input,.khs-f select{width:100%;height:38px;background:var(--k-inp);border:1px solid var(--mc-input-border,var(--k-bd));color:var(--k-tx);border-radius:var(--mc-input-radius,10px);padding:0 10px;font:inherit;font-size:.86rem}',
            '.khs-f input[type=checkbox]{width:17px;height:17px;padding:0;flex:none}',
            '.khs-days{display:flex;gap:6px;flex-wrap:wrap}.khs-days label{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--k-bd);border-radius:999px;padding:5px 11px;font-size:.8rem;cursor:pointer;font-weight:600}',
            '.khs-days input{accent-color:var(--k-pri)}.khs-days label.on{border-color:var(--k-pri);color:var(--k-pri)}',
            '.khs-sw{display:flex;align-items:center;gap:8px;font-size:.84rem;font-weight:600;cursor:pointer}.khs-sw input{width:17px;height:17px;accent-color:var(--k-pri)}',
            '.khs-slots{margin-top:12px;font-size:.78rem;color:var(--k-mut);line-height:1.6}.khs-slots span{display:inline-block;border:1px solid var(--k-bd);border-radius:6px;padding:0 7px;margin:2px 3px 2px 0;color:var(--k-tx);font-variant-numeric:tabular-nums}',
            '.khs-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}.khs-bar .sp{flex:1}',
            '.khs-quick button{border:1px solid var(--k-bd);background:transparent;color:var(--k-tx);border-radius:999px;padding:4px 11px;font-size:.76rem;cursor:pointer;font-family:inherit}.khs-quick button:hover{border-color:var(--k-pri)}',
            '.khs-seg{display:inline-flex;border:1px solid var(--k-bd);border-radius:10px;overflow:hidden}.khs-seg button{border:0;background:transparent;color:var(--k-mut);padding:7px 12px;font-weight:700;font-size:.8rem;cursor:pointer;font-family:inherit}',
            '.khs-seg button.on{background:var(--k-pri);color:#fff}',
            '.khs-tw{overflow:auto;border:1px solid var(--k-bd);border-radius:12px;max-height:70vh}',
            '.khs-t{width:100%;border-collapse:separate;border-spacing:0;font-size:.82rem;font-variant-numeric:tabular-nums}',
            '.khs-t th{position:sticky;top:0;z-index:1;background:var(--mc-table-head,var(--k-card));color:var(--k-mut);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:9px 10px;border-bottom:1px solid var(--k-bd);white-space:nowrap}',
            '.khs-t td{padding:8px 10px;border-bottom:1px solid var(--k-bd);white-space:nowrap;vertical-align:top}.khs-t tr:last-child td{border-bottom:0}',
            '.khs-t td.r,.khs-t th.r{text-align:right}.khs-t tr:hover td{background:var(--mc-table-hover,rgba(148,163,184,.06))}',
            '.khs-t .sticky{position:sticky;left:0;background:var(--k-card);z-index:2}.khs-t th.sticky{z-index:3}',
            '.khs-cell b{display:block;color:var(--k-buy);font-weight:700}.khs-cell span{display:block;color:var(--k-sell);font-weight:700;margin-top:3px}',
            '.khs-cell small,.khs-src{display:block;font-size:.66rem;color:var(--k-mut);font-weight:400;white-space:nowrap}',
            '.khs-t th.grp{text-align:center;border-left:1px solid var(--k-bd)}.khs-t td.gl,.khs-t th.gl{border-left:1px solid var(--k-bd)}',
            '.khs-m{color:var(--k-mut)}',
            '.khs-code{font-weight:800}.khs-sub{display:block;color:var(--k-mut);font-size:.72rem;font-weight:400}',
            '.khs-tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:.7rem;font-weight:700}',
            '.khs-tag.jadwal{background:color-mix(in srgb,var(--k-pri) 15%,transparent);color:var(--k-pri)}.khs-tag.manual{background:rgba(56,189,248,.15);color:#38bdf8}.khs-tag.perubahan{background:color-mix(in srgb,var(--k-warn) 18%,transparent);color:var(--k-warn)}',
            '.khs-chg{color:var(--k-mut);font-size:.74rem}',
            '.khs-empty{text-align:center;padding:36px 16px;color:var(--k-mut);border:1px dashed var(--k-bd);border-radius:12px;line-height:1.6}',
            '.khs-note{font-size:.76rem;color:var(--k-mut);margin-top:8px}',
            '@media(max-width:640px){.khs-acts{width:100%}.khs-acts .khs-btn{flex:1;justify-content:center}}'
        ].join('\n');
        document.head.appendChild(st);
    }

    /* ---------------------------------------------------------- kerangka */
    function build() {
        var root = $(ROOT_ID); if (!root) return;
        injectStyle();
        var today = ymd(new Date());
        S.from = S.from || today; S.to = S.to || today;
        root.innerHTML =
            '<div class="khs">' +
            '<div class="khs-head"><div><h2><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Kurs</h2>' +
            '<p>Arsip kurs sumber, selisih, dan kurs hasil (beli/jual) seluruh valuta yang dicatat otomatis sesuai jadwal, ditambah pencatatan manual dan setiap perubahan kurs. Data tidak bisa diubah atau dihapus dari aplikasi, sehingga dapat dijadikan bukti saat audit Bank Indonesia.</p></div>' +
            '<div class="khs-acts">' +
            (canSnap() ? '<button type="button" class="khs-btn pri" data-k="snap"><i class="fa-solid fa-camera"></i> Catat Sekarang</button>' : '') +
            '<button type="button" class="khs-btn" data-k="xlsx"><i class="fa-solid fa-file-excel" style="color:#10b981"></i> Excel</button>' +
            '<button type="button" class="khs-btn" data-k="csv"><i class="fa-solid fa-file-csv"></i> CSV</button>' +
            '<button type="button" class="khs-btn" data-k="print"><i class="fa-solid fa-print"></i> Cetak</button>' +
            '</div></div>' +

            '<section class="khs-card"><h3><i class="fa-solid fa-signal"></i> Status Pencatatan</h3><p>Pencatatan terjadwal berjalan di server, jadi tetap tercatat walaupun aplikasi tidak sedang dibuka.</p><div id="khsStatus"><div class="khs-note">Memuat status...</div></div></section>' +

            '<section class="khs-card" id="khsSettingsCard"><h3><i class="fa-solid fa-sliders"></i> Jadwal Pencatatan<span class="khs-sum" id="khsSettingsSum"></span>' +
            '<button type="button" class="khs-tg" data-k="toggle-settings" aria-controls="khsSettingsBody" aria-expanded="true" title="Sembunyikan"><i class="fa-solid fa-minus"></i></button></h3>' +
            '<div id="khsSettingsBody"><p>' + (canEdit() ? 'Atur jam operasional dan selang waktu pencatatan.' : 'Hanya owner/admin yang dapat mengubah jadwal.') + '</p><div id="khsSettings"></div></div></section>' +

            '<section class="khs-card"><h3><i class="fa-solid fa-table"></i> Data Riwayat</h3><p>Pilih periode, lalu tampilkan per jam (matriks satu tanggal) atau sebagai daftar.</p>' +
            '<div class="khs-grid">' +
            '<div class="khs-f"><label for="khsFrom">Dari tanggal</label><input type="date" id="khsFrom" value="' + esc(S.from) + '"></div>' +
            '<div class="khs-f"><label for="khsTo">Sampai tanggal</label><input type="date" id="khsTo" value="' + esc(S.to) + '"></div>' +
            '<div class="khs-f"><label for="khsCode">Valuta</label><select id="khsCode"><option value="">Semua valuta</option></select></div>' +
            '<div class="khs-f"><label for="khsSource">Jenis catatan</label><select id="khsSource"><option value="">Semua</option><option value="jadwal">Terjadwal</option><option value="manual">Manual</option><option value="perubahan">Perubahan kurs</option></select></div>' +
            '<div class="khs-f"><button type="button" class="khs-btn pri" data-k="load" style="width:100%;justify-content:center;height:38px"><i class="fa-solid fa-magnifying-glass"></i> Tampilkan</button></div>' +
            '</div>' +
            '<div class="khs-bar"><div class="khs-quick">' +
            '<button type="button" data-q="today">Hari ini</button> <button type="button" data-q="yesterday">Kemarin</button> <button type="button" data-q="7">7 hari</button> <button type="button" data-q="month">Bulan ini</button> <button type="button" data-q="lastmonth">Bulan lalu</button>' +
            '</div><div class="sp"></div><div class="khs-seg" id="khsMode"><button type="button" data-mode="matrix">Per Jam</button><button type="button" data-mode="list">Daftar</button></div></div>' +
            '<div id="khsResult" style="margin-top:14px"></div></section>' +
            '</div>';

        root.addEventListener('click', onClick);
        root.addEventListener('change', onChange);
        S.built = true;
        applySettingsCollapse(readCollapse());
        fillCodes();
        markMode();
    }

    function fillCodes() {
        var sel = $('khsCode'); if (!sel) return;
        var list = [];
        try { list = (typeof getCurrencies === 'function' ? getCurrencies() : []) || []; } catch (e) { list = []; }
        var codes = list.map(function (c) { return String(c.code || '').trim(); }).filter(Boolean);
        S.rows.forEach(function (r) { if (codes.indexOf(r.code) < 0) codes.push(r.code); });
        codes = codes.filter(function (c, i) { return codes.indexOf(c) === i; }).sort();
        var cur = S.code;
        sel.innerHTML = '<option value="">Semua valuta</option>' + codes.map(function (c) { return '<option value="' + esc(c) + '"' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    }

    function markMode() {
        document.querySelectorAll('#khsMode button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === S.mode); });
    }

    /* ---------------------------------------------------------- status & pengaturan */
    function renderStatus() {
        var box = $('khsStatus'); if (!box) return;
        var st = S.status; if (!st) return;
        var s = st.settings || {};
        var next = st.next_slot ? dmy(st.next_slot) + ' ' + hm(st.next_slot) : '-';
        var last = st.last_scheduled ? dmy(st.last_scheduled) + ' ' + hm(st.last_scheduled) : 'Belum ada';
        var alive = !!st.scheduler_alive;
        box.innerHTML =
            '<div class="khs-stats">' +
            '<div class="khs-stat"><small>Pencatatan otomatis</small><b><span class="khs-dot ' + (s.enabled ? 'ok' : 'off') + '"></span>' + (s.enabled ? 'Aktif' : 'Nonaktif') + '</b><em>' + esc(s.start) + '–' + esc(s.end) + ', tiap ' + esc(intervalLabel(s.interval)) + '</em></div>' +
            '<div class="khs-stat"><small>Penjadwal server</small><b><span class="khs-dot ' + (alive ? 'ok' : 'bad') + '"></span>' + (alive ? 'Berjalan' : 'Tidak terdeteksi') + '</b><em>' + (st.scheduler_beat ? 'Terakhir: ' + esc(String(st.scheduler_beat).slice(11, 16)) : 'Belum pernah berjalan') + '</em></div>' +
            '<div class="khs-stat"><small>Terakhir dicatat</small><b>' + esc(last) + '</b><em>' + (st.last_scheduled_count ? esc(st.last_scheduled_count) + ' valuta' : '&nbsp;') + '</em></div>' +
            '<div class="khs-stat"><small>Jadwal berikutnya</small><b>' + esc(next) + '</b><em>Waktu server: ' + esc(hm(st.server_time)) + '</em></div>' +
            '<div class="khs-stat"><small>Total catatan</small><b>' + nf.format(st.total_records || 0) + '</b><em>' + (st.first_record ? 'Sejak ' + esc(dmy(st.first_record)) : 'Belum ada') + '</em></div>' +
            '</div>' +
            (alive ? '' : '<div class="khs-warn"><b>Penjadwal server belum berjalan.</b> Pencatatan otomatis membutuhkan cron Laravel di server: <code>* * * * * cd /path/aplikasi &amp;&amp; php artisan schedule:run</code>. Di komputer lokal (Laragon), jalankan <code>php artisan schedule:work</code> atau buat Task Scheduler Windows. Pencatatan manual tetap bisa dipakai.</div>');
    }

    var COLLAPSE_KEY = 'mc_khs_settings_collapsed';
    function readCollapse() { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (e) { return false; } }
    function applySettingsCollapse(collapsed) {
        var card = $('khsSettingsCard'), btn = document.querySelector('[data-k="toggle-settings"]');
        if (!card || !btn) return;
        card.classList.toggle('collapsed', collapsed);
        btn.innerHTML = '<i class="fa-solid ' + (collapsed ? 'fa-plus' : 'fa-minus') + '"></i>';
        btn.title = collapsed ? 'Tampilkan' : 'Sembunyikan';
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        updateSettingsSummary();
    }
    function updateSettingsSummary() {
        var el = $('khsSettingsSum'), card = $('khsSettingsCard'); if (!el) return;
        var s = S.status && S.status.settings;
        el.textContent = card && card.classList.contains('collapsed') && s
            ? '— ' + (s.enabled ? s.start + '–' + s.end + ', tiap ' + intervalLabel(s.interval) : 'nonaktif') : '';
    }

    function intervalLabel(m) { m = Number(m) || 60; return m < 60 ? m + ' menit' : (m === 60 ? '1 jam' : (m / 60) + ' jam'); }

    function renderSettings() {
        var box = $('khsSettings'); if (!box || !S.status) return;
        var s = S.status.settings || {}, dis = canEdit() ? '' : ' disabled';
        var ints = S.status.intervals || [15, 30, 60, 120];
        box.innerHTML =
            '<div class="khs-grid">' +
            '<div class="khs-f"><label class="khs-sw"><input type="checkbox" id="khsEnabled"' + (s.enabled ? ' checked' : '') + dis + '> Pencatatan otomatis aktif</label></div>' +
            '<div class="khs-f"><label for="khsStart">Jam mulai</label><input type="time" id="khsStart" value="' + esc(s.start) + '"' + dis + '></div>' +
            '<div class="khs-f"><label for="khsEnd">Jam selesai</label><input type="time" id="khsEnd" value="' + esc(s.end) + '"' + dis + '></div>' +
            '<div class="khs-f"><label for="khsInterval">Catat setiap</label><select id="khsInterval"' + dis + '>' + ints.map(function (m) { return '<option value="' + m + '"' + (Number(s.interval) === m ? ' selected' : '') + '>' + intervalLabel(m) + '</option>'; }).join('') + '</select></div>' +
            '</div>' +
            '<div class="khs-f" style="margin-top:12px"><label>Hari pencatatan</label><div class="khs-days" id="khsDays">' +
            DAYS.map(function (d) { var on = (s.days || []).indexOf(d[0]) > -1; return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" value="' + d[0] + '"' + (on ? ' checked' : '') + dis + '> ' + d[1] + '</label>'; }).join('') +
            '</div></div>' +
            '<div class="khs-f" style="margin-top:12px"><label class="khs-sw"><input type="checkbox" id="khsLogChanges"' + (s.log_changes ? ' checked' : '') + dis + '> Catat juga setiap kali kurs diubah (jam, kurs lama, kurs baru, petugas)</label></div>' +
            '<div class="khs-slots" id="khsSlotPreview"></div>' +
            (canEdit() ? '<div class="khs-bar"><button type="button" class="khs-btn pri" data-k="save"><i class="fa-solid fa-floppy-disk"></i> Simpan Jadwal</button><span class="khs-note" id="khsDirty"></span></div>' : '');
        previewSlots();
    }

    function readSettingsForm() {
        return {
            enabled: !!($('khsEnabled') && $('khsEnabled').checked),
            start: ($('khsStart') && $('khsStart').value) || '08:00',
            end: ($('khsEnd') && $('khsEnd').value) || '17:00',
            interval: Number(($('khsInterval') && $('khsInterval').value) || 60),
            days: Array.prototype.map.call(document.querySelectorAll('#khsDays input:checked'), function (c) { return Number(c.value); }),
            log_changes: !!($('khsLogChanges') && $('khsLogChanges').checked)
        };
    }

    function previewSlots() {
        var box = $('khsSlotPreview'); if (!box) return;
        var f = readSettingsForm();
        var toMin = function (t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); };
        var a = toMin(f.start), b = toMin(f.end), out = [];
        if (b < a) { box.innerHTML = '<span style="color:var(--k-sell);border-color:var(--k-sell)">Jam selesai lebih awal dari jam mulai</span>'; return; }
        for (var m = a; m <= b && out.length < 100; m += f.interval) out.push(pad(Math.floor(m / 60)) + ':' + pad(m % 60));
        var dayNames = DAYS.filter(function (d) { return f.days.indexOf(d[0]) > -1; }).map(function (d) { return d[1]; }).join(', ') || '(belum ada hari dipilih)';
        box.innerHTML = '<b>' + out.length + ' kali per hari</b> pada ' + esc(dayNames) + ': ' + out.map(function (t) { return '<span>' + t + '</span>'; }).join('');
    }

    async function saveSettings() {
        var f = readSettingsForm();
        if (!f.days.length) return alertBox('warning', 'Pilih hari pencatatan', 'Centang minimal satu hari.');
        var btn = document.querySelector('[data-k="save"]'); if (btn) btn.disabled = true;
        try {
            var r = await api('rate-history/settings', 'POST', f);
            S.status.settings = r.data;
            S.dirty = false;
            toast('success', 'Jadwal pencatatan disimpan');
            await loadStatus();
        } catch (e) {
            alertBox('error', 'Gagal menyimpan', e.message);
        } finally { if (btn) btn.disabled = false; }
    }

    async function loadStatus() {
        try {
            var r = await api('rate-history/status');
            S.status = r.data;
            renderStatus();
            if (!S.dirty) renderSettings();
            updateSettingsSummary();
        } catch (e) {
            var box = $('khsStatus'); if (box) box.innerHTML = '<div class="khs-warn">Status tidak bisa dimuat: ' + esc(e.message) + '</div>';
        }
    }

    /* ---------------------------------------------------------- data */
    async function loadRows() {
        if (S.loading) return;
        S.from = $('khsFrom').value; S.to = $('khsTo').value;
        S.code = $('khsCode').value; S.source = $('khsSource').value;
        if (!S.from || !S.to) return;
        if (S.to < S.from) return alertBox('warning', 'Periode tidak valid', 'Tanggal akhir tidak boleh sebelum tanggal awal.');
        S.loading = true;
        var res = $('khsResult'); if (res) res.innerHTML = '<div class="khs-note"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</div>';
        try {
            var q = 'from=' + encodeURIComponent(S.from) + '&to=' + encodeURIComponent(S.to) + (S.code ? '&code=' + encodeURIComponent(S.code) : '') + (S.source ? '&source=' + encodeURIComponent(S.source) : '');
            var r = await api('rate-history?' + q);
            S.rows = Array.isArray(r.data) ? r.data : [];
            if (S.from !== S.to && S.mode === 'matrix') S.mode = 'list';
            markMode();
            renderResult();
        } catch (e) {
            S.rows = [];
            if (res) res.innerHTML = '<div class="khs-warn">' + esc(e.message) + '</div>';
        } finally { S.loading = false; }
    }

    function matrixData() {
        var rows = S.rows.filter(function (r) { return r.source !== 'perubahan'; });
        var cols = [], colMeta = {}, codes = [], cell = {};
        rows.forEach(function (r) {
            var key = hm(r.slot || r.taken_at) + (r.source === 'manual' ? '|' + r.taken_at : '');
            if (!colMeta[key]) { colMeta[key] = { time: hm(r.slot || r.taken_at), manual: r.source === 'manual', sort: (r.slot || r.taken_at) }; cols.push(key); }
            if (codes.indexOf(r.code) < 0) codes.push(r.code);
            cell[r.code + '#' + key] = r;
        });
        cols.sort(function (a, b) { return colMeta[a].sort < colMeta[b].sort ? -1 : 1; });
        codes.sort();
        return { cols: cols, colMeta: colMeta, codes: codes, cell: cell, labels: rows.reduce(function (m, r) { m[r.code] = labelOf(r); return m; }, {}) };
    }

    function renderResult() {
        var box = $('khsResult'); if (!box) return;
        if (!S.rows.length) {
            box.innerHTML = '<div class="khs-empty"><i class="fa-regular fa-folder-open" style="font-size:1.6rem"></i><br>Belum ada catatan kurs pada periode ini.' +
                (canSnap() ? '<br>Klik <b>Catat Sekarang</b> untuk membuat catatan pertama, atau tunggu jadwal berikutnya.' : '') + '</div>';
            return;
        }
        if (S.mode === 'matrix') {
            if (S.from !== S.to) { box.innerHTML = '<div class="khs-note">Tampilan Per Jam hanya untuk satu tanggal. Pilih tanggal yang sama di "Dari" dan "Sampai", atau gunakan tampilan Daftar.</div>'; return; }
            var m = matrixData();
            if (!m.cols.length) { box.innerHTML = '<div class="khs-empty">Tidak ada catatan terjadwal/manual pada tanggal ini. Lihat tampilan <b>Daftar</b> untuk catatan perubahan kurs.</div>'; return; }
            box.innerHTML = '<div class="khs-tw"><table class="khs-t"><thead><tr><th class="sticky">Valuta</th>' +
                m.cols.map(function (k) { var c = m.colMeta[k]; return '<th class="r">' + esc(c.time) + (c.manual ? '<span class="khs-sub">manual</span>' : '') + '</th>'; }).join('') +
                '</tr></thead><tbody>' +
                m.codes.map(function (code) {
                    return '<tr><td class="sticky"><span class="khs-code">' + esc(code) + '</span><span class="khs-sub">' + esc(m.labels[code] || '') + '</span></td>' +
                        m.cols.map(function (k) {
                            var r = m.cell[code + '#' + k];
                            if (!r) return '<td class="r khs-cell"><span style="color:var(--k-mut)">-</span></td>';
                            var sb = srcLine(r.base_buy, r.margin_buy), ss = srcLine(r.base_sell, r.margin_sell);
                            return '<td class="r khs-cell"><b>' + fmt(r.buy) + '</b>' + (sb ? '<small>' + sb + '</small>' : '') + '<span>' + fmt(r.sell) + '</span>' + (ss ? '<small>' + ss + '</small>' : '') + '</td>';
                        }).join('') + '</tr>';
                }).join('') +
                '</tbody></table></div><div class="khs-note"><b style="color:var(--k-buy)">Hijau</b> = kurs beli, <b style="color:var(--k-sell)">merah</b> = kurs jual (kurs hasil). Angka kecil di bawahnya = <b>kurs sumber · selisih</b>. ' + m.codes.length + ' valuta, ' + m.cols.length + ' waktu pencatatan.</div>';
            return;
        }
        var shown = S.rows.slice(0, MAX_ROWS_SHOWN);
        box.innerHTML = '<div class="khs-tw"><table class="khs-t"><thead>' +
            '<tr><th rowspan="2">Tanggal</th><th rowspan="2">Jam</th><th rowspan="2">Jenis</th><th rowspan="2">Valuta</th><th colspan="3" class="grp">Beli</th><th colspan="3" class="grp">Jual</th><th rowspan="2" class="gl">Kurs hasil sebelumnya</th><th rowspan="2">Dicatat oleh</th></tr>' +
            '<tr><th class="r gl">Sumber</th><th class="r">Selisih</th><th class="r">Hasil</th><th class="r gl">Sumber</th><th class="r">Selisih</th><th class="r">Hasil</th></tr></thead><tbody>' +
            shown.map(function (r) {
                var prev = r.source === 'perubahan' ? '<span class="khs-chg">Beli ' + fmt(r.prev_buy) + ' · Jual ' + fmt(r.prev_sell) + '</span>' : '';
                return '<tr><td>' + esc(dmy(r.taken_at)) + '</td><td>' + esc(String(r.taken_at).slice(11, 19)) + (r.slot && r.source === 'jadwal' ? '<span class="khs-sub">jadwal ' + esc(hm(r.slot)) + '</span>' : '') + '</td>' +
                    '<td><span class="khs-tag ' + esc(r.source) + '">' + esc(SRC[r.source] || r.source) + '</span></td>' +
                    '<td><span class="khs-code">' + esc(r.code) + '</span><span class="khs-sub">' + esc(labelOf(r)) + '</span></td>' +
                    '<td class="r gl">' + fmt(r.base_buy) + '</td><td class="r khs-m">' + fmtM(r.margin_buy) + '</td><td class="r" style="color:var(--k-buy);font-weight:700">' + fmt(r.buy) + '</td>' +
                    '<td class="r gl">' + fmt(r.base_sell) + '</td><td class="r khs-m">' + fmtM(r.margin_sell) + '</td><td class="r" style="color:var(--k-sell);font-weight:700">' + fmt(r.sell) + '</td>' +
                    '<td class="gl">' + prev + '</td><td>' + esc(r.recorded_by || (r.source === 'jadwal' ? 'Sistem' : '-')) + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="khs-note">' + nf.format(S.rows.length) + ' catatan' + (S.rows.length > MAX_ROWS_SHOWN ? ', ditampilkan ' + nf.format(MAX_ROWS_SHOWN) + ' pertama (ekspor berisi semua)' : '') + '.</div>';
    }

    /* ---------------------------------------------------------- ekspor & cetak */
    function periodText() { return S.from === S.to ? dmy(S.from) : dmy(S.from) + ' s.d. ' + dmy(S.to); }
    function headerAoa(title) {
        return [[company()], [title], ['Periode: ' + periodText() + (S.code ? ' | Valuta: ' + S.code : '') + (S.source ? ' | Jenis: ' + (SRC[S.source] || S.source) : '')],
            ['Dibuat: ' + new Date().toLocaleString('id-ID') + (userName() ? ' oleh ' + userName() : '')], []];
    }
    function listAoa() {
        return [['Tanggal', 'Jam', 'Jadwal', 'Jenis', 'Kode', 'Valuta',
            'Sumber Beli', 'Selisih Beli', 'Kurs Beli (Hasil)', 'Sumber Jual', 'Selisih Jual', 'Kurs Jual (Hasil)',
            'Kurs Beli Sebelumnya', 'Kurs Jual Sebelumnya', 'Dicatat oleh']].concat(S.rows.map(function (r) {
            return [dmy(r.taken_at), String(r.taken_at).slice(11, 19), r.slot ? hm(r.slot) : '', SRC[r.source] || r.source, r.code, labelOf(r),
                numOrEmpty(r.base_buy), numOrEmpty(r.margin_buy), Number(r.buy) || 0, numOrEmpty(r.base_sell), numOrEmpty(r.margin_sell), Number(r.sell) || 0,
                numOrEmpty(r.prev_buy), numOrEmpty(r.prev_sell),
                r.recorded_by || (r.source === 'jadwal' ? 'Sistem' : '')];
        }));
    }
    function matrixAoa() {
        var m = matrixData(); if (!m.cols.length) return null;
        var head = ['Kode', 'Valuta'];
        m.cols.forEach(function (k) {
            var t = m.colMeta[k].time + (m.colMeta[k].manual ? ' (manual)' : '');
            head.push(t + ' Sumber Beli', t + ' Selisih Beli', t + ' Beli', t + ' Sumber Jual', t + ' Selisih Jual', t + ' Jual');
        });
        return [head].concat(m.codes.map(function (code) {
            var row = [code, m.labels[code] || ''];
            m.cols.forEach(function (k) {
                var r = m.cell[code + '#' + k];
                if (!r) { row.push('', '', '', '', '', ''); return; }
                row.push(numOrEmpty(r.base_buy), numOrEmpty(r.margin_buy), Number(r.buy), numOrEmpty(r.base_sell), numOrEmpty(r.margin_sell), Number(r.sell));
            });
            return row;
        }));
    }
    function ensureData() {
        if (!S.rows.length) { alertBox('info', 'Belum ada data', 'Tampilkan data periode yang ingin diekspor terlebih dahulu.'); return false; }
        return true;
    }
    function fileBase() { return 'Riwayat-Kurs_' + S.from + (S.from !== S.to ? '_sd_' + S.to : ''); }

    function exportXlsx() {
        if (!ensureData()) return;
        if (!window.XLSX) return exportCsv();
        var wb = XLSX.utils.book_new();
        var list = XLSX.utils.aoa_to_sheet(headerAoa('Laporan Riwayat Kurs (Daftar)').concat(listAoa()));
        list['!cols'] = [12, 10, 8, 15, 10, 22, 13, 11, 16, 13, 11, 16, 18, 18, 16].map(function (w) { return { wch: w }; });
        XLSX.utils.book_append_sheet(wb, list, 'Daftar');
        if (S.from === S.to) {
            var mx = matrixAoa();
            if (mx) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headerAoa('Laporan Riwayat Kurs per Jam').concat(mx)), 'Per Jam');
        }
        XLSX.writeFile(wb, fileBase() + '.xlsx');
    }

    function exportCsv() {
        if (!ensureData()) return;
        var lines = headerAoa('Laporan Riwayat Kurs').concat(listAoa()).map(function (row) {
            return row.map(function (v) { var s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';');
        });
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileBase() + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }

    function printReport() {
        if (!ensureData()) return;
        var m = (S.mode === 'matrix' && S.from === S.to) ? matrixData() : null;
        var useMatrix = !!(m && m.cols.length);
        var table;
        if (useMatrix) {
            table = '<table><thead><tr><th>Valuta</th>' + m.cols.map(function (k) { var c = m.colMeta[k]; return '<th class="r">' + esc(c.time) + (c.manual ? ' (manual)' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
                m.codes.map(function (code) {
                    return '<tr><td><b>' + esc(code) + '</b><br><small>' + esc(m.labels[code] || '') + '</small></td>' + m.cols.map(function (k) {
                        var r = m.cell[code + '#' + k]; if (!r) return '<td class="r">-</td>';
                        var sb = srcLine(r.base_buy, r.margin_buy), ss = srcLine(r.base_sell, r.margin_sell);
                        return '<td class="r">B <b>' + fmt(r.buy) + '</b>' + (sb ? '<br><small>' + sb + '</small>' : '') + '<br>J <b>' + fmt(r.sell) + '</b>' + (ss ? '<br><small>' + ss + '</small>' : '') + '</td>';
                    }).join('') + '</tr>';
                }).join('') + '</tbody></table><p class="meta">B = kurs beli, J = kurs jual (kurs hasil). Angka kecil = kurs sumber · selisih.</p>';
        } else {
            table = '<table><thead><tr><th rowspan="2">Tanggal</th><th rowspan="2">Jam</th><th rowspan="2">Jenis</th><th rowspan="2">Valuta</th><th colspan="3" class="c">Beli</th><th colspan="3" class="c">Jual</th><th rowspan="2">Kurs hasil sebelumnya</th><th rowspan="2">Dicatat oleh</th></tr>' +
                '<tr><th class="r">Sumber</th><th class="r">Selisih</th><th class="r">Hasil</th><th class="r">Sumber</th><th class="r">Selisih</th><th class="r">Hasil</th></tr></thead><tbody>' +
                S.rows.map(function (r) {
                    return '<tr><td>' + esc(dmy(r.taken_at)) + '</td><td>' + esc(String(r.taken_at).slice(11, 19)) + '</td><td>' + esc(SRC[r.source] || r.source) + '</td><td><b>' + esc(r.code) + '</b> ' + esc(labelOf(r)) + '</td>' +
                        '<td class="r">' + fmt(r.base_buy) + '</td><td class="r">' + fmtM(r.margin_buy) + '</td><td class="r"><b>' + fmt(r.buy) + '</b></td>' +
                        '<td class="r">' + fmt(r.base_sell) + '</td><td class="r">' + fmtM(r.margin_sell) + '</td><td class="r"><b>' + fmt(r.sell) + '</b></td>' +
                        '<td>' + (r.source === 'perubahan' ? 'B ' + fmt(r.prev_buy) + ' / J ' + fmt(r.prev_sell) : '') + '</td><td>' + esc(r.recorded_by || (r.source === 'jadwal' ? 'Sistem' : '')) + '</td></tr>';
                }).join('') + '</tbody></table>';
        }
        var w = window.open('', '_blank');
        if (!w) return alertBox('warning', 'Jendela cetak diblokir', 'Izinkan pop-up untuk situs ini lalu coba lagi.');
        w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(fileBase()) + '</title><style>' +
            '@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#000;font-size:9.5px}' +
            'h1{font-size:15px;margin:0}h2{font-size:12px;margin:2px 0 8px;font-weight:normal}.meta{font-size:9.5px;color:#333;margin:6px 0 10px}' +
            'table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eee}.r{text-align:right}.c{text-align:center}small{color:#555;font-size:8.5px}' +
            'thead{display:table-header-group}tr{page-break-inside:avoid}' +
            '.sign{margin-top:28px;display:flex;justify-content:space-between}.sign>div{width:40%;text-align:center}.sign .ln{margin:55px auto 0;width:75%;border-top:1px solid #000}' +
            '</style></head><body><h1>' + esc(company()) + '</h1><h2>Laporan Riwayat Kurs' + (useMatrix ? ' per Jam' : '') + ' (kurs sumber, selisih, dan kurs hasil)</h2>' +
            '<div class="meta">Periode: ' + esc(periodText()) + (S.code ? ' &middot; Valuta: ' + esc(S.code) : '') + (S.source ? ' &middot; Jenis: ' + esc(SRC[S.source] || S.source) : '') +
            ' &middot; Dicetak: ' + esc(new Date().toLocaleString('id-ID')) + (userName() ? ' oleh ' + esc(userName()) : '') + '</div>' + table +
            '<div class="sign"><div>Dibuat oleh,<div class="ln"></div></div><div>Mengetahui,<div class="ln"></div></div></div>' +
            '</body></html>');
        w.document.close();
        setTimeout(function () { w.focus(); w.print(); }, 400);
    }

    async function snapNow() {
        var btn = document.querySelector('[data-k="snap"]'); if (btn) btn.disabled = true;
        try {
            var r = await api('rate-history/snapshot', 'POST', {});
            toast('success', r.message || 'Kurs dicatat');
            var today = ymd(new Date());
            if (S.from <= today && S.to >= today) await loadRows();
            loadStatus();
        } catch (e) {
            alertBox('error', 'Gagal mencatat kurs', e.message);
        } finally { if (btn) btn.disabled = false; }
    }

    function quickRange(k) {
        var d = new Date(), from, to;
        if (k === 'today') { from = to = ymd(d); }
        else if (k === 'yesterday') { d.setDate(d.getDate() - 1); from = to = ymd(d); }
        else if (k === '7') { to = ymd(d); d.setDate(d.getDate() - 6); from = ymd(d); }
        else if (k === 'month') { to = ymd(d); from = ymd(new Date(d.getFullYear(), d.getMonth(), 1)); }
        else if (k === 'lastmonth') { from = ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)); to = ymd(new Date(d.getFullYear(), d.getMonth(), 0)); }
        if (!from) return;
        $('khsFrom').value = from; $('khsTo').value = to;
        S.mode = from === to ? 'matrix' : 'list';
        markMode();
        loadRows();
    }

    /* ---------------------------------------------------------- event */
    function onClick(e) {
        var b = e.target.closest('button'); if (!b || b.disabled) return;
        var k = b.getAttribute('data-k');
        if (k === 'load') loadRows();
        else if (k === 'save') saveSettings();
        else if (k === 'snap') snapNow();
        else if (k === 'toggle-settings') {
            var c = !$('khsSettingsCard').classList.contains('collapsed');
            try { localStorage.setItem(COLLAPSE_KEY, c ? '1' : '0'); } catch (e2) { /* abaikan */ }
            applySettingsCollapse(c);
        }
        else if (k === 'xlsx') exportXlsx();
        else if (k === 'csv') exportCsv();
        else if (k === 'print') printReport();
        else if (b.hasAttribute('data-q')) quickRange(b.getAttribute('data-q'));
        else if (b.hasAttribute('data-mode')) {
            S.mode = b.getAttribute('data-mode'); markMode();
            if (S.mode === 'matrix' && S.from !== S.to) { $('khsTo').value = $('khsFrom').value; loadRows(); } else renderResult();
        }
    }

    function onChange(e) {
        var t = e.target; if (!t) return;
        if (t.closest('#khsSettings')) {
            S.dirty = true;
            if (t.closest('#khsDays')) t.closest('label').classList.toggle('on', t.checked);
            var d = $('khsDirty'); if (d) d.textContent = 'Ada perubahan yang belum disimpan.';
            previewSlots();
        } else if (t.id === 'khsCode' || t.id === 'khsSource') {
            loadRows();
        }
    }

    /* ---------------------------------------------------------- siklus hidup */
    function visible() { var v = $(VIEW_ID); return !!v && !v.classList.contains('hidden') && v.offsetParent !== null; }

    function open() {
        if (!$(ROOT_ID)) return;
        if (!S.built || !$('khsResult')) build();
        S.lastTick = Date.now();
        loadStatus();
        loadRows();
    }
    window.loadKursHistory = open;

    var wasVisible = false;
    setInterval(function () {
        var now = visible();
        if (now && !wasVisible) open();
        else if (now && !document.hidden && Date.now() - S.lastTick > 60000) {
            S.lastTick = Date.now();
            loadStatus();
            var today = ymd(new Date());
            if (S.from <= today && S.to >= today) loadRows();
        }
        wasVisible = now;
    }, 1500);
})();
