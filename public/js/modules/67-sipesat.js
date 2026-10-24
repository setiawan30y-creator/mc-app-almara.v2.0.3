// @2026-Alifiandra
/* =====================================================================
 * MODULE 67: LAPORAN SIPESAT (filter triwulan + rentang tanggal)
 *
 * Daftar nasabah dilaporkan per triwulan berdasarkan TANGGAL DAFTAR (tgl_daftar).
 *   - Mode "Triwulan": pilih tahun + TW1..TW4 (Jan-Mar, Apr-Jun, Jul-Sep, Okt-Des).
 *   - Mode "Rentang tanggal": dari - sampai (bebas).
 * Tanggal dibandingkan sebagai teks YYYY-MM-DD (tanpa zona waktu) agar tidak ada
 * nasabah yang bergeser ke triwulan lain. Tampilan: css/sipesat-modern.css
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcSipesat) return;
    window.__mcSipesat = true;

    var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var HEAD = ['No', 'Tanggal Daftar', 'ID Nasabah', 'IDPJK', 'Kode Nasabah', 'Nama', 'Tempat Lahir', 'Tanggal Lahir', 'Alamat', 'No KTP', 'No ID (Lainnya)', 'No CIF', 'NPWP', 'Local ID'];
    var S = { built: false, mode: 'tw', year: 0, q: 1, start: '', end: '', query: '', rows: [], noDate: 0, all: [] };

    function $(id) { return document.getElementById(id); }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function p2(n) { return String(n).padStart(2, '0'); }
    function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
    function valid(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate(); }

    /* tgl_daftar bisa 'YYYY-MM-DD', 'DD-MM-YYYY', '04 Nov 2026', dll -> 'YYYY-MM-DD' atau '' */
    function toDay(raw) {
        var s = String(raw == null ? '' : raw).trim(), m;
        if (!s || s === '-') return '';
        if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)) && valid(+m[1], +m[2], +m[3])) return m[1] + '-' + m[2] + '-' + m[3];
        if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/)) && valid(+m[3], +m[2], +m[1])) return m[3] + '-' + p2(m[2]) + '-' + p2(m[1]);
        var t = Date.parse(s);
        if (!isNaN(t)) return ymd(new Date(t));
        return '';
    }
    function customerDay(c) {
        var d = toDay(c && c.tgl_daftar);
        if (d) return d;
        if (typeof getCustomerRegistrationTime === 'function') {
            var t = getCustomerRegistrationTime(c);
            if (t > 86400000) return ymd(new Date(t));
        }
        return '';
    }
    function fmtDay(s) { if (!s) return '-'; var a = s.split('-'); return a[2] + ' ' + MON[+a[1] - 1] + ' ' + a[0]; }
    function fmtOther(v) {
        if (typeof formatDateOnly === 'function' && v) { try { return formatDateOnly(v); } catch (e) { /* lanjut */ } }
        var d = toDay(v); return d ? fmtDay(d) : (v || '-');
    }
    function qRange(y, q) {
        var m1 = (q - 1) * 3 + 1, last = new Date(y, m1 + 2, 0).getDate();
        return { start: y + '-' + p2(m1) + '-01', end: y + '-' + p2(m1 + 2) + '-' + p2(last) };
    }
    function currentQ() { return Math.floor(new Date().getMonth() / 3) + 1; }
    function kn(c) { return c.kn == '1' ? '1-Perorangan' : (c.kn == '2' ? '2-Corporate' : (c.kn || '-')); }

    /* ---------- Data ---------- */
    function load() {
        var list = typeof getCustomers === 'function' ? getCustomers() : [];
        S.all = (Array.isArray(list) ? list : []).map(function (c) { return { c: c, day: customerDay(c) }; });
        S.noDate = S.all.filter(function (x) { return !x.day; }).length;
    }
    function period() {
        if (S.mode === 'tw') return qRange(S.year, S.q);
        return { start: S.start, end: S.end };
    }
    function inPeriod() {
        var p = period();
        return S.all.filter(function (x) { return x.day && (!p.start || x.day >= p.start) && (!p.end || x.day <= p.end); })
            .sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : String(a.c.id_nasabah || '').localeCompare(String(b.c.id_nasabah || '')); });
    }
    function years() {
        var set = {}, cy = new Date().getFullYear(); set[cy] = 1;
        S.all.forEach(function (x) { if (x.day) set[+x.day.slice(0, 4)] = 1; });
        return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
    }
    function countQ(y, q) { var r = qRange(y, q); return S.all.filter(function (x) { return x.day && x.day >= r.start && x.day <= r.end; }).length; }

    /* ---------- Markup ---------- */
    function build() {
        var root = $('sipesatRoot'); if (!root || S.built) return !!root;
        S.built = true;
        root.innerHTML =
            '<div class="sp-head"><div><h2>Laporan SIPESAT</h2><p>Daftar nasabah dilaporkan per triwulan berdasarkan tanggal daftar.</p></div>' +
            '<div class="sp-actions"><button type="button" class="sp-btn" data-sp="export"><i class="fa-solid fa-file-excel"></i> Export Excel</button>' +
            '<button type="button" class="sp-btn ghost" data-sp="print"><i class="fa-solid fa-print"></i> Cetak</button></div></div>' +
            '<div class="sp-card sp-filter">' +
            '<div class="sp-row"><div class="sp-field"><span class="sp-lbl">Jenis filter</span><div class="sp-seg" role="tablist">' +
            '<button type="button" data-sp="mode" data-mode="tw" id="spModeTw">Triwulan</button><button type="button" data-sp="mode" data-mode="range" id="spModeRange">Rentang tanggal</button></div></div>' +
            '<div class="sp-field" id="spYearBox"><label for="spYear">Tahun</label><select id="spYear" class="form-control"></select></div></div>' +
            '<div id="spQuarters" class="sp-quarters"></div>' +
            '<div class="sp-row" id="spRangeBox"><div class="sp-field"><label for="sipesatStartDate">Dari tanggal daftar</label><input type="date" id="sipesatStartDate" class="form-control"></div>' +
            '<div class="sp-field"><label for="sipesatEndDate">Sampai tanggal daftar</label><input type="date" id="sipesatEndDate" class="form-control"></div></div>' +
            '<div class="sp-period" id="spPeriod"></div></div>' +
            '<div id="spStats" class="sp-stats"></div><div id="spWarn" class="sp-warn"></div>' +
            '<div class="sp-card"><div class="sp-tools"><input type="search" id="spSearch" class="sp-search" placeholder="Cari nama, ID nasabah, KTP..." aria-label="Cari">' +
            '<span class="sp-period" id="spShown"></span></div>' +
            '<div class="sp-wrap"><table class="sp-table" id="tableSipesat"><thead><tr>' + HEAD.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>' +
            '<tbody id="sipesatTableBody"></tbody></table></div></div>' +
            '<div hidden>&#64;2026-Alifiandra</div>';
        root.addEventListener('click', onClick);
        root.addEventListener('change', onChange);
        root.addEventListener('input', function (e) { if (e.target.id === 'spSearch') { S.query = e.target.value; paintTable(); } });
        return true;
    }

    function onClick(e) {
        var t = e.target.closest('[data-sp]'); if (!t) return;
        var a = t.dataset.sp;
        if (a === 'mode') { setMode(t.dataset.mode); }
        else if (a === 'q') { S.mode = 'tw'; S.q = +t.dataset.q; refresh(); }
        else if (a === 'export') exportExcel();
        else if (a === 'print') window.print();
    }
    function onChange(e) {
        var id = e.target.id;
        if (id === 'spYear') { S.year = +e.target.value; refresh(); }
        else if (id === 'sipesatStartDate' || id === 'sipesatEndDate') {
            S.mode = 'range'; S.start = $('sipesatStartDate').value; S.end = $('sipesatEndDate').value;
            if (S.start && S.end && S.start > S.end) { var x = S.start; S.start = S.end; S.end = x; }
            refresh();
        }
    }
    function setMode(m) {
        if (m === S.mode) return;
        if (m === 'range') { var p = qRange(S.year, S.q); S.start = p.start; S.end = p.end; }
        S.mode = m; refresh();
    }

    /* ---------- Gambar ---------- */
    function refresh() {
        load(); S.rows = inPeriod();
        var tw = S.mode === 'tw';
        $('spModeTw').classList.toggle('on', tw); $('spModeRange').classList.toggle('on', !tw);
        $('spYearBox').style.display = tw ? '' : 'none';
        $('spQuarters').style.display = tw ? '' : 'none';
        $('spRangeBox').style.display = tw ? 'none' : '';
        var ys = years(); if (ys.indexOf(S.year) < 0) ys.unshift(S.year);
        $('spYear').innerHTML = ys.map(function (y) { return '<option value="' + y + '"' + (y === S.year ? ' selected' : '') + '>' + y + '</option>'; }).join('');
        $('spQuarters').innerHTML = [1, 2, 3, 4].map(function (q) {
            var r = qRange(S.year, q), n = countQ(S.year, q);
            return '<button type="button" class="sp-q' + (S.q === q ? ' on' : '') + '" data-sp="q" data-q="' + q + '"><b>TW ' + q + '</b>' +
                '<small>' + MON[(q - 1) * 3] + ' &ndash; ' + MON[(q - 1) * 3 + 2] + ' ' + S.year + '</small><em>' + n + ' nasabah</em></button>';
        }).join('');
        if (!tw) { $('sipesatStartDate').value = S.start; $('sipesatEndDate').value = S.end; }
        var p = period();
        $('spPeriod').innerHTML = 'Periode laporan: <strong>' + (tw ? 'Triwulan ' + S.q + ' ' + S.year + ' &middot; ' : '') +
            (p.start ? fmtDay(p.start) : 'awal') + ' &ndash; ' + (p.end ? fmtDay(p.end) : 'sekarang') + '</strong>';
        paintStats(); paintTable();
    }

    function monthsIn(p) {
        if (!p.start || !p.end) return [];
        var out = [], a = p.start.slice(0, 7), b = p.end.slice(0, 7), y = +a.slice(0, 4), m = +a.slice(5);
        while ((y + '-' + p2(m)) <= b && out.length < 24) { out.push(y + '-' + p2(m)); m++; if (m > 12) { m = 1; y++; } }
        return out;
    }
    function paintStats() {
        var rows = S.rows, per = rows.filter(function (x) { return x.c.kn == '1'; }).length, corp = rows.filter(function (x) { return x.c.kn == '2'; }).length;
        var ms = monthsIn(period()), mini = '';
        if (ms.length && ms.length <= 12) {
            var cnt = ms.map(function (k) { return rows.filter(function (x) { return x.day.slice(0, 7) === k; }).length; }), mx = Math.max.apply(null, cnt.concat([1]));
            mini = '<div class="sp-mini">' + ms.map(function (k, i) { return '<div><span>' + MON[+k.slice(5) - 1] + '</span><i style="width:' + Math.round(cnt[i] / mx * 100) + '%"></i><u>' + cnt[i] + '</u></div>'; }).join('') + '</div>';
        }
        var nf = function (n) { return new Intl.NumberFormat('id-ID').format(n); };
        $('spStats').innerHTML =
            '<div class="sp-stat main"><span>Total dilaporkan</span><b id="sipesatTotalCount">' + nf(rows.length) + '</b></div>' +
            '<div class="sp-stat"><span>Perorangan</span><b>' + nf(per) + '</b></div>' +
            '<div class="sp-stat"><span>Corporate</span><b>' + nf(corp) + '</b></div>' +
            (mini ? '<div class="sp-stat"><span>Per bulan</span>' + mini + '</div>' : '');
        var w = $('spWarn');
        if (S.noDate > 0) { w.className = 'sp-warn show'; w.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <strong>' + S.noDate + ' nasabah</strong> tidak memiliki tanggal daftar yang valid sehingga tidak masuk ke laporan periode mana pun. Lengkapi tanggal daftarnya di menu Nasabah.'; }
        else { w.className = 'sp-warn'; w.innerHTML = ''; }
    }
    function paintTable() {
        var tb = $('sipesatTableBody'), q = S.query.trim().toLowerCase();
        var rows = !q ? S.rows : S.rows.filter(function (x) {
            var c = x.c; return [c.nama, c.id_nasabah, c.no_ktp, c.no_cif, c.npwp, c.local_id, c.idpjk].join(' ').toLowerCase().indexOf(q) >= 0;
        });
        $('spShown').textContent = rows.length === S.rows.length ? rows.length + ' baris' : rows.length + ' dari ' + S.rows.length + ' baris';
        if (!rows.length) { tb.innerHTML = '<tr><td colspan="14" class="sp-empty">' + (S.rows.length ? 'Tidak ada hasil pencarian.' : 'Tidak ada nasabah yang mendaftar pada periode ini.') + '</td></tr>'; return; }
        var h = [];
        rows.forEach(function (x, i) {
            var c = x.c;
            h.push('<tr><td class="c">' + (i + 1) + '</td><td class="c nw">' + fmtDay(x.day) + '</td><td class="c nw"><strong>' + esc(c.id_nasabah || '-') + '</strong></td><td class="c">' + esc(c.idpjk || '-') + '</td>' +
                '<td class="c nw">' + esc(kn(c)) + '</td><td>' + esc(c.nama || '-') + '</td><td>' + esc(c.tempat_lahir || '-') + '</td><td class="c nw">' + esc(fmtOther(c.tanggal_lahir)) + '</td>' +
                '<td class="addr">' + esc(c.alamat || '-') + '</td><td class="c nw">' + esc(c.no_ktp || '-') + '</td><td class="c">' + esc(c.selain_ktp || '-') + '</td>' +
                '<td class="c">' + esc(c.no_cif || '-') + '</td><td class="c">' + esc(c.npwp || '-') + '</td><td class="c">' + esc(c.local_id || '-') + '</td></tr>');
        });
        tb.innerHTML = h.join('');
    }

    /* ---------- Export ---------- */
    async function exportExcel() {
        if (!S.rows.length) { alert('Tidak ada data pada periode ini untuk diekspor.'); return; }
        if (typeof XLSX === 'undefined') { alert('Pustaka Excel belum termuat. Muat ulang halaman lalu coba lagi.'); return; }
        var data = [HEAD];
        S.rows.forEach(function (x, i) {
            var c = x.c;
            data.push([i + 1, fmtDay(x.day), c.id_nasabah || '', c.idpjk || '', kn(c), c.nama || '', c.tempat_lahir || '', fmtOther(c.tanggal_lahir), c.alamat || '',
                String(c.no_ktp || ''), String(c.selain_ktp || ''), String(c.no_cif || ''), String(c.npwp || ''), String(c.local_id || '')]);
        });
        var ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [5, 15, 16, 22, 14, 30, 18, 15, 40, 20, 18, 16, 20, 16].map(function (w) { return { wch: w }; });
        var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'SIPESAT');
        var p = period(), tag = S.mode === 'tw' ? S.year + '_TW' + S.q : (p.start || 'awal') + '_sd_' + (p.end || 'akhir');
        try {
            var ok = typeof window.safeExportXLSX === 'function' ? await window.safeExportXLSX(wb, 'SIPESAT_' + tag + '.xlsx') : (XLSX.writeFile(wb, 'SIPESAT_' + tag + '.xlsx'), true);
            if (ok && window.Swal && typeof Swal.fire === 'function') Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2200, icon: 'success', title: 'Export SIPESAT berhasil' });
        } catch (err) { console.error(err); alert('Gagal melakukan export SIPESAT.'); }
    }

    /* ---------- Titik masuk ---------- */
    window.initSipesat = function () {
        if (!build()) return;
        if (!S.year) { S.year = new Date().getFullYear(); S.q = currentQ(); }
        refresh();
    };
    window.loadLaporanSipesat = window.initSipesat;
    window.exportSipesatExcel = exportExcel;
})();
