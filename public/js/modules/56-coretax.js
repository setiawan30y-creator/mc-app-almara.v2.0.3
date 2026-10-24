// @2026-Alifiandra
/* =====================================================================
 * 56-coretax.js  —  Laporan > CoreTax
 *  - Data dasar laporan pajak per transaksi, disusun mengikuti isian portal CoreTax DJP:
 *    identitas lawan transaksi (TIN/NIK 16 digit, Paspor, ID lain), kode transaksi
 *    (Normal / NoVAT), Masa Pajak, DPP, tarif dan PPN.
 *  - Validasi per baris (ID 16 digit, nilai, tanggal) sebelum diekspor.
 *  - Ekspor Excel: sheet Data, Rekap, dan Validasi.
 *  - Menyediakan loadCoretaxReport / exportCoretaxExcel (dipanggil dari 01-core.js dan tombol laporan).
 * Catatan: ini data siap-rekonsiliasi, bukan berkas XML resmi DJP.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcCoretax) return;
    window.__mcCoretax = true;

    var SETTINGS_KEY = 'mc_coretax_settings';
    var MAX_RENDER = 500;
    var DEFAULTS = { npwp: '', name: '', pkp: 'TIDAK', treatment: 'NOVAT', rate: 12, dppFactor: 100 };
    var state = { period: '', type: '', status: '', q: '', rows: [], shown: [] };
    var $ = function (id) { return document.getElementById(id); };

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function digits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function idr(v) {
        return typeof window.formatIdr === 'function' ? window.formatIdr(v)
            : 'Rp ' + Math.round(num(v)).toLocaleString('id-ID');
    }
    function nf(v, d) {
        return num(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d == null ? 2 : d });
    }
    function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    function dateKey(ts) {
        var s = String(ts || '');
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[1] + '-' + m[2] + '-' + m[3];
        var d = new Date(s);
        if (isNaN(d.getTime())) return '';
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function dmy(key) { var p = String(key || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }

    /* ---------- Pengaturan ---------- */
    function loadSettings() {
        var s = {};
        try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) {}
        var out = {};
        Object.keys(DEFAULTS).forEach(function (k) { out[k] = s[k] != null ? s[k] : DEFAULTS[k]; });
        if (!out.name) {
            try { out.name = (JSON.parse(localStorage.getItem('mc_profile') || '{}') || {}).name || ''; } catch (e) {}
        }
        return out;
    }
    function saveSettings(s) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
        if (typeof window.pushToUniversalDatastore === 'function') window.pushToUniversalDatastore(SETTINGS_KEY, s);
    }
    function normTaxId(v) {
        var d = digits(v);
        if (d.length === 15) d = '0' + d;
        return d.length === 16 ? d : '';
    }

    /* ---------- Identitas lawan transaksi ---------- */
    function resolveIdentity(c) {
        if (!c) {
            return { type: 'NIK', label: 'ID tidak tersedia', number: '0000000000000000', level: 'warn',
                note: 'Tanpa data nasabah: ID diisi 16 digit nol.', name: 'Pelanggan Umum', address: '', country: '' };
        }
        var jenis = String(c.jenis_id || '').trim().toUpperCase();
        var kn = String(c.kn || c.customer_type || '').toLowerCase();
        var isCorp = kn === '2' || kn.indexOf('perusahaan') > -1 || kn.indexOf('corporate') > -1 || !!c.jenis_badan_usaha;
        var base = { name: c.nama || 'Pelanggan', address: c.alamat && c.alamat !== '-' ? c.alamat : '', country: c.warga_negara || '' };
        var tin = normTaxId(c.npwp && c.npwp !== '-' ? c.npwp : '');
        if (tin) return Object.assign(base, { type: 'TIN', label: 'NPWP', number: tin, level: 'ok', note: '' });
        if (isCorp) {
            return Object.assign(base, { type: 'TIN', label: 'NPWP', number: digits(c.npwp), level: 'err',
                note: 'NPWP badan belum diisi atau bukan 15/16 digit.' });
        }
        var primary = c.no_ktp && c.no_ktp !== '-' ? c.no_ktp : '';
        var other = c.selain_ktp && c.selain_ktp !== '-' ? c.selain_ktp : '';
        if (jenis === 'PASSPORT' || jenis === 'PASPOR') {
            var pn = String(other || primary).trim();
            return Object.assign(base, { type: 'PASSPORT', label: 'Paspor', number: pn, level: pn ? 'ok' : 'err', note: pn ? '' : 'Nomor paspor kosong.' });
        }
        if (jenis && jenis !== 'KTP') {
            var on = String(other || primary).trim();
            return Object.assign(base, { type: 'OTHER', label: jenis, number: on, level: on ? 'ok' : 'err', note: on ? '' : 'Nomor identitas kosong.' });
        }
        var nik = digits(primary || other);
        if (nik.length === 16) return Object.assign(base, { type: 'NIK', label: 'NIK', number: nik, level: 'ok', note: '' });
        return Object.assign(base, { type: 'NIK', label: 'NIK', number: nik, level: 'err',
            note: nik ? 'NIK harus 16 digit (terisi ' + nik.length + ').' : 'NIK belum diisi.' });
    }

    /* ---------- Penyusunan baris ---------- */
    function buildRows() {
        var s = loadSettings();
        var customers = typeof window.getCustomers === 'function' ? window.getCustomers() : [];
        var byId = {};
        customers.forEach(function (c) { if (c && c.id_nasabah != null) byId[String(c.id_nasabah).trim()] = c; });
        var trxs = typeof window.getTransactions === 'function' ? window.getTransactions() : [];
        var rate = num(s.rate) / 100, factor = num(s.dppFactor) / 100;
        var rows = [];
        trxs.forEach(function (t) {
            if (!t) return;
            var tipe = String(t.tipe || '').toUpperCase();
            if (tipe !== 'JUAL' && tipe !== 'BELI') return;
            var st = String(t.status || '').toUpperCase();
            if (st === 'VOID' || st === 'BATAL' || st === 'CANCELLED' || st === 'CANCELED') return;
            var key = dateKey(t.timestamp);
            var cust = t.customerId ? byId[String(t.customerId).trim()] : null;
            var idn = resolveIdentity(cust);
            var nilai = Math.round(num(t.total));
            var vat = tipe === 'JUAL' && s.treatment === 'VAT';
            var dpp = vat ? Math.round(nilai * factor) : 0;
            var ppn = vat ? Math.round(dpp * rate) : 0;
            var issues = [];
            var level = idn.level;
            if (idn.note) issues.push(idn.note);
            if (!key) { issues.push('Tanggal transaksi tidak valid.'); level = 'err'; }
            if (nilai <= 0) { issues.push('Nilai transaksi nol/negatif.'); level = 'err'; }
            if (!t.valuta) { issues.push('Kode valuta kosong.'); level = 'err'; }
            rows.push({
                key: key, period: key.slice(0, 7), date: dmy(key),
                doc: String(t.invoiceId || t.id || t.itemId || ''),
                tipe: tipe, arah: tipe === 'JUAL' ? 'Penyerahan (Jual)' : 'Perolehan (Beli)',
                code: vat ? 'Normal' : 'NoVAT',
                idType: idn.type, idLabel: idn.label, idNumber: idn.number,
                name: idn.name, address: idn.address, country: idn.country,
                valuta: String(t.valuta || ''), nominal: num(t.nominal), kurs: num(t.rate),
                nilai: nilai, dpp: dpp, ppn: ppn,
                level: level, issues: issues, note: String(t.keterangan || '')
            });
        });
        rows.sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : (a.doc < b.doc ? 1 : -1); });
        return rows;
    }
    function applyFilters() {
        var q = state.q.trim().toLowerCase();
        state.shown = state.rows.filter(function (r) {
            if (state.period && r.period !== state.period) return false;
            if (state.type && r.tipe !== state.type) return false;
            if (state.status === 'OK' && r.level !== 'ok') return false;
            if (state.status === 'WARN' && r.level !== 'warn') return false;
            if (state.status === 'ERR' && r.level !== 'err') return false;
            if (q && (r.doc + ' ' + r.name + ' ' + r.idNumber + ' ' + r.valuta).toLowerCase().indexOf(q) < 0) return false;
            return true;
        });
    }

    /* ---------- Tampilan ---------- */
    function injectStyle() {
        if ($('ctx-style')) return;
        var st = document.createElement('style');
        st.id = 'ctx-style';
        st.textContent = [
            '.ctx{--ctx-bd:var(--mc-border,rgba(148,163,184,.3));--ctx-mut:var(--mc-text-muted,#94a3b8);--ctx-pri:var(--mc-primary,#10b981);display:grid;gap:16px}',
            '.ctx-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}',
            '.ctx-head h2{margin:0;font-size:1.2rem}.ctx-head p{margin:4px 0 0;color:var(--ctx-mut);font-size:.84rem;max-width:680px;line-height:1.5}',
            '.ctx-actions{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}',
            '.ctx-card{border:1px solid var(--ctx-bd);border-radius:14px;padding:16px 18px}',
            '.ctx-card>h3{margin:0 0 4px;font-size:.95rem}.ctx-card>.sub{margin:0 0 12px;color:var(--ctx-mut);font-size:.8rem;line-height:1.45}',
            '.ctx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 16px}',
            '.ctx label.l{display:block;font-size:.78rem;font-weight:600;margin:0 0 5px}',
            '.ctx .form-control{width:100%;box-sizing:border-box}',
            '.ctx small{display:block;margin-top:4px;color:var(--ctx-mut);font-size:.76rem;line-height:1.4}',
            '.ctx-set summary{cursor:pointer;font-weight:700;font-size:.95rem;list-style:none;display:flex;align-items:center;gap:8px}',
            '.ctx-set summary::-webkit-details-marker{display:none}',
            '.ctx-set summary:after{content:"\\25BE";margin-left:auto;color:var(--ctx-mut)}.ctx-set[open] summary:after{content:"\\25B4"}',
            '.ctx-set .body{margin-top:12px}',
            '.ctx-warnbar{display:inline-block;margin-left:6px;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:99px;background:rgba(245,158,11,.16);color:#f59e0b}',
            '.ctx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}',
            '.ctx-kpi{border:1px solid var(--ctx-bd);border-radius:14px;padding:14px 16px}',
            '.ctx-kpi .t{font-size:.74rem;color:var(--ctx-mut);font-weight:600;letter-spacing:.02em}',
            '.ctx-kpi .v{font-size:1.25rem;font-weight:800;margin-top:4px;overflow-wrap:anywhere}',
            '.ctx-kpi .s{font-size:.74rem;color:var(--ctx-mut);margin-top:2px}',
            '.ctx-kpi.bad .v{color:#f87171}.ctx-kpi.good .v{color:var(--ctx-pri)}',
            '.ctx-filter{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end}',
            '.ctx-tw{overflow:auto;max-height:60vh;border:1px solid var(--ctx-bd);border-radius:12px}',
            '.ctx table{width:100%;border-collapse:collapse;font-size:.8rem}',
            '.ctx th{position:sticky;top:0;z-index:1;text-align:left;padding:10px;font-size:.72rem;letter-spacing:.03em;white-space:nowrap;background:var(--mc-table-head,var(--mc-card-bg,#1e293b));border-bottom:1px solid var(--ctx-bd)}',
            '.ctx td{padding:9px 10px;border-bottom:1px solid var(--ctx-bd);vertical-align:top}',
            '.ctx td.r,.ctx th.r{text-align:right;white-space:nowrap}',
            '.ctx td.mono{font-family:ui-monospace,Consolas,monospace;font-size:.76rem;white-space:nowrap}',
            '.ctx tr.err td{background:rgba(239,68,68,.06)}',
            '.ctx-b{display:inline-block;font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap}',
            '.ctx-b.ok{background:rgba(16,185,129,.15);color:#10b981}.ctx-b.warn{background:rgba(245,158,11,.16);color:#f59e0b}.ctx-b.err{background:rgba(239,68,68,.16);color:#f87171}',
            '.ctx-b.jual{background:rgba(59,130,246,.15);color:#60a5fa}.ctx-b.beli{background:rgba(168,85,247,.15);color:#c084fc}',
            '.ctx-note{font-size:.75rem;color:var(--ctx-mut);margin-top:3px;line-height:1.35}',
            '.ctx-info{display:flex;gap:10px;font-size:.8rem;line-height:1.5;color:var(--ctx-mut);border:1px dashed var(--ctx-bd);border-radius:12px;padding:12px 14px}',
            '.ctx-info i{color:var(--ctx-pri);margin-top:3px}',
            '.ctx-empty{padding:34px 10px;text-align:center;color:var(--ctx-mut)}',
            '@media print{.ctx-actions,.ctx-set,.ctx-filter-card{display:none!important}.ctx-tw{max-height:none;overflow:visible}}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function buildShell() {
        var root = $('coretaxRoot');
        if (!root || root.getAttribute('data-ready') === '1') return root;
        injectStyle();
        var s = loadSettings();
        root.className = 'ctx';
        root.setAttribute('data-ready', '1');
        root.innerHTML = [
            '<div class="ctx-head"><div><h2>Laporan Pajak CoreTax</h2>',
            '<p>Data transaksi per Masa Pajak yang disusun mengikuti isian portal CoreTax DJP, lengkap dengan pemeriksaan identitas lawan transaksi sebelum diekspor.</p></div>',
            '<div class="ctx-actions"><button type="button" class="btn btn-primary" id="ctxExport"><i class="fa-solid fa-file-excel"></i> Export Excel</button>',
            '<button type="button" class="btn btn-secondary" id="ctxPrint"><i class="fa-solid fa-print"></i> Cetak</button></div></div>',

            '<details class="ctx-card ctx-set" id="ctxSet"><summary><i class="fa-solid fa-sliders"></i> Identitas Wajib Pajak &amp; Perlakuan PPN <span class="ctx-warnbar" id="ctxSetWarn" style="display:none">Belum lengkap</span></summary>',
            '<div class="body"><div class="ctx-grid">',
            '<div><label class="l" for="ctxNpwp">NPWP / NIK Penjual (16 digit)</label><input class="form-control" id="ctxNpwp" inputmode="numeric" maxlength="22" placeholder="16 digit">',
            '<small id="ctxNpwpHint">NPWP 15 digit otomatis diubah menjadi 16 digit.</small></div>',
            '<div><label class="l" for="ctxName">Nama Wajib Pajak</label><input class="form-control" id="ctxName" placeholder="Nama sesuai NPWP"></div>',
            '<div><label class="l" for="ctxIdtku">ID TKU (tempat kegiatan usaha pusat)</label><input class="form-control" id="ctxIdtku" readonly><small>NPWP 16 digit + 000000.</small></div>',
            '<div><label class="l" for="ctxPkp">Status PKP</label><select class="form-control" id="ctxPkp"><option value="TIDAK">Bukan PKP</option><option value="YA">PKP</option></select></div>',
            '<div><label class="l" for="ctxTreat">Perlakuan PPN atas penjualan valas (JUAL)</label><select class="form-control" id="ctxTreat"><option value="NOVAT">Tidak dikenai PPN (NoVAT)</option><option value="VAT">Dikenai PPN (Normal)</option></select>',
            '<small>Pembelian valas (BELI) selalu NoVAT.</small></div>',
            '<div><label class="l" for="ctxRate">Tarif PPN (%)</label><input class="form-control" id="ctxRate" type="number" min="0" max="100" step="0.01"></div>',
            '<div><label class="l" for="ctxFactor">Faktor DPP (%) dari nilai transaksi</label><input class="form-control" id="ctxFactor" type="number" min="0" max="100" step="0.01"><small>100 = DPP sama dengan nilai transaksi.</small></div>',
            '</div><div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button type="button" class="btn btn-primary" id="ctxSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan</button><span id="ctxSaved" class="ctx-note" style="display:none">Tersimpan.</span></div></div></details>',

            '<div class="ctx-info"><i class="fa-solid fa-circle-info"></i><div>Uang dan valuta asing pada dasarnya bukan Barang Kena Pajak, sehingga bawaan aplikasi adalah <b>NoVAT</b>. Ubah ke &ldquo;Dikenai PPN&rdquo; hanya bila ada ketentuan atau jasa yang memang dikenai PPN pada usaha Anda. Berkas Excel ini adalah data pendukung untuk rekonsiliasi dan impor, bukan XML resmi DJP; cocokkan dengan template resmi di portal CoreTax dan konfirmasikan perlakuan pajak kepada konsultan pajak Anda.</div></div>',

            '<div class="ctx-card ctx-filter-card"><div class="ctx-filter">',
            '<div><label class="l" for="ctxPeriod">Masa Pajak</label><input class="form-control" type="month" id="ctxPeriod"></div>',
            '<div><label class="l" for="ctxType">Jenis Transaksi</label><select class="form-control" id="ctxType"><option value="">Semua</option><option value="JUAL">JUAL (penyerahan)</option><option value="BELI">BELI (perolehan)</option></select></div>',
            '<div><label class="l" for="ctxStatus">Status Data</label><select class="form-control" id="ctxStatus"><option value="">Semua</option><option value="OK">Lengkap</option><option value="WARN">Peringatan</option><option value="ERR">Perlu dilengkapi</option></select></div>',
            '<div><label class="l" for="ctxQ">Cari</label><input class="form-control" id="ctxQ" placeholder="No. dokumen, nama, ID, valuta"></div>',
            '<div><button type="button" class="btn btn-secondary" id="ctxAll" style="width:100%">Semua Periode</button></div>',
            '</div></div>',

            '<div class="ctx-kpis" id="ctxKpis"></div>',
            '<div class="ctx-card" id="ctxRekapCard"><h3>Rekap Masa Pajak</h3><p class="sub" id="ctxRekapSub"></p><div class="ctx-tw" style="max-height:none"><table id="ctxRekap"></table></div></div>',
            '<div class="ctx-card"><h3>Rincian Transaksi</h3><p class="sub" id="ctxCount"></p><div class="ctx-tw"><table id="ctxTable"></table></div></div>'
        ].join('');

        $('ctxNpwp').value = s.npwp; $('ctxName').value = s.name; $('ctxPkp').value = s.pkp;
        $('ctxTreat').value = s.treatment; $('ctxRate').value = s.rate; $('ctxFactor').value = s.dppFactor;
        $('ctxPeriod').value = state.period = today();
        refreshSettingHints();

        $('ctxPeriod').addEventListener('change', function () { state.period = this.value; render(); });
        $('ctxType').addEventListener('change', function () { state.type = this.value; render(); });
        $('ctxStatus').addEventListener('change', function () { state.status = this.value; render(); });
        $('ctxQ').addEventListener('input', function () { state.q = this.value; render(); });
        $('ctxAll').addEventListener('click', function () { state.period = ''; $('ctxPeriod').value = ''; render(); });
        $('ctxNpwp').addEventListener('input', refreshSettingHints);
        $('ctxSave').addEventListener('click', onSave);
        $('ctxPrint').addEventListener('click', function () { window.print(); });
        $('ctxExport').addEventListener('click', function () { window.exportCoretaxExcel(); });
        return root;
    }

    function refreshSettingHints() {
        var raw = $('ctxNpwp').value, id = normTaxId(raw);
        $('ctxIdtku').value = id ? id + '000000' : '';
        var hint = $('ctxNpwpHint');
        if (!raw) hint.textContent = 'NPWP 15 digit otomatis diubah menjadi 16 digit.';
        else if (id) hint.textContent = 'Valid: ' + id;
        else hint.textContent = 'Harus 15 atau 16 digit (terisi ' + digits(raw).length + ').';
        $('ctxSetWarn').style.display = id && $('ctxName').value.trim() ? 'none' : 'inline-block';
    }

    function onSave() {
        var rate = Math.min(100, Math.max(0, num($('ctxRate').value)));
        var factor = Math.min(100, Math.max(0, num($('ctxFactor').value)));
        var s = {
            npwp: normTaxId($('ctxNpwp').value) || digits($('ctxNpwp').value),
            name: $('ctxName').value.trim(), pkp: $('ctxPkp').value,
            treatment: $('ctxTreat').value, rate: rate, dppFactor: factor
        };
        saveSettings(s);
        $('ctxNpwp').value = s.npwp; $('ctxRate').value = rate; $('ctxFactor').value = factor;
        refreshSettingHints();
        var ok = $('ctxSaved'); ok.style.display = 'inline';
        setTimeout(function () { ok.style.display = 'none'; }, 2200);
        render(true);
    }

    function render(rebuild) {
        if (!buildShell()) return;
        if (rebuild || !state.rows.length) state.rows = buildRows();
        applyFilters();
        var rows = state.shown;
        var docs = {}, nilai = 0, dpp = 0, ppn = 0, bad = 0, warn = 0;
        rows.forEach(function (r) {
            docs[r.doc] = 1; nilai += r.nilai; dpp += r.dpp; ppn += r.ppn;
            if (r.level === 'err') bad++; else if (r.level === 'warn') warn++;
        });
        $('ctxKpis').innerHTML = [
            kpi('Dokumen', Object.keys(docs).length.toLocaleString('id-ID'), rows.length + ' baris transaksi', ''),
            kpi('Nilai Transaksi', idr(nilai), 'Total IDR pada filter ini', ''),
            kpi('PPN Terutang', idr(ppn), dpp ? 'DPP ' + idr(dpp) : 'Tidak ada transaksi dikenai PPN', ppn ? 'good' : ''),
            kpi('Perlu Dilengkapi', bad.toLocaleString('id-ID'), warn ? warn + ' peringatan' : 'Tidak ada peringatan', bad ? 'bad' : 'good')
        ].join('');

        var groups = {};
        rows.forEach(function (r) {
            var k = r.code + '|' + r.tipe;
            var g = groups[k] || (groups[k] = { code: r.code, tipe: r.tipe, docs: {}, n: 0, nilai: 0, dpp: 0, ppn: 0 });
            g.docs[r.doc] = 1; g.n++; g.nilai += r.nilai; g.dpp += r.dpp; g.ppn += r.ppn;
        });
        var keys = Object.keys(groups).sort();
        $('ctxRekapSub').textContent = 'Masa Pajak: ' + (state.period ? state.period.slice(5) + '/' + state.period.slice(0, 4) : 'Semua periode');
        $('ctxRekap').innerHTML = '<thead><tr><th>Kode Transaksi</th><th>Jenis</th><th class="r">Dokumen</th><th class="r">Baris</th><th class="r">Nilai Transaksi</th><th class="r">DPP</th><th class="r">PPN</th></tr></thead><tbody>' +
            (keys.length ? keys.map(function (k) {
                var g = groups[k];
                return '<tr><td>' + (g.code === 'Normal' ? 'Normal (PPN dipungut)' : 'NoVAT (tidak dikenai PPN)') + '</td><td>' + g.tipe + '</td><td class="r">' + Object.keys(g.docs).length +
                    '</td><td class="r">' + g.n + '</td><td class="r">' + idr(g.nilai) + '</td><td class="r">' + idr(g.dpp) + '</td><td class="r">' + idr(g.ppn) + '</td></tr>';
            }).join('') : '<tr><td colspan="7" class="ctx-empty">Belum ada data pada filter ini.</td></tr>') + '</tbody>';

        var slice = rows.slice(0, MAX_RENDER);
        $('ctxCount').textContent = rows.length ? ('Menampilkan ' + slice.length + ' dari ' + rows.length + ' baris' + (rows.length > MAX_RENDER ? '. Export Excel memuat seluruh baris.' : '.')) : '';
        $('ctxTable').innerHTML = '<thead><tr><th>Tanggal</th><th>No. Dokumen</th><th>Jenis</th><th>ID Lawan Transaksi</th><th>Nama Lawan Transaksi</th><th>Valuta</th><th class="r">Nominal</th><th class="r">Kurs</th><th class="r">Nilai (IDR)</th><th class="r">DPP</th><th class="r">PPN</th><th>Status</th></tr></thead><tbody>' +
            (slice.length ? slice.map(function (r) {
                var badge = r.level === 'ok' ? '<span class="ctx-b ok">Lengkap</span>' : r.level === 'warn' ? '<span class="ctx-b warn">Peringatan</span>' : '<span class="ctx-b err">Perlu dilengkapi</span>';
                return '<tr class="' + (r.level === 'err' ? 'err' : '') + '"><td>' + esc(r.date) + '</td><td class="mono">' + esc(r.doc) + '</td>' +
                    '<td><span class="ctx-b ' + r.tipe.toLowerCase() + '">' + r.tipe + '</span></td>' +
                    '<td><div class="mono">' + esc(r.idNumber || '-') + '</div><div class="ctx-note">' + esc(r.idLabel) + '</div></td>' +
                    '<td>' + esc(r.name) + '</td><td>' + esc(r.valuta) + '</td><td class="r">' + nf(r.nominal) + '</td><td class="r">' + nf(r.kurs) + '</td>' +
                    '<td class="r">' + idr(r.nilai) + '</td><td class="r">' + (r.dpp ? idr(r.dpp) : '&ndash;') + '</td><td class="r">' + (r.ppn ? idr(r.ppn) : '&ndash;') + '</td>' +
                    '<td>' + badge + (r.issues.length ? '<div class="ctx-note">' + esc(r.issues.join(' ')) + '</div>' : '') + '</td></tr>';
            }).join('') : '<tr><td colspan="12" class="ctx-empty">Tidak ada transaksi untuk filter ini.</td></tr>') + '</tbody>';
    }
    function kpi(t, v, s, cls) {
        return '<div class="ctx-kpi ' + cls + '"><div class="t">' + esc(t) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>';
    }

    /* ---------- Ekspor ---------- */
    async function doExport() {
        buildShell();
        state.rows = buildRows();
        applyFilters();
        var rows = state.shown;
        if (!rows.length) { alert('Tidak ada data untuk diekspor ke CoreTax.'); return; }
        if (typeof XLSX === 'undefined') { alert('Library Excel (SheetJS) belum termuat.'); return; }
        var s = loadSettings();
        var bad = rows.filter(function (r) { return r.level === 'err'; });
        if (bad.length && !window.confirm(bad.length + ' baris masih perlu dilengkapi (lihat sheet Validasi). Tetap export?')) return;

        var head = ['No', 'Tanggal Dokumen', 'Nomor Dokumen', 'Jenis Transaksi', 'Kode Transaksi', 'Jenis ID Lawan Transaksi', 'Nomor ID Lawan Transaksi',
            'Nama Lawan Transaksi', 'Alamat', 'Kewarganegaraan', 'Valuta', 'Nominal Valuta', 'Kurs (IDR)', 'Nilai Transaksi (IDR)', 'DPP (IDR)',
            'Tarif PPN (%)', 'PPN (IDR)', 'Status Data', 'Keterangan'];
        var data = [head];
        var tot = { nilai: 0, dpp: 0, ppn: 0 };
        rows.forEach(function (r, i) {
            tot.nilai += r.nilai; tot.dpp += r.dpp; tot.ppn += r.ppn;
            data.push([i + 1, r.date, r.doc, r.arah, r.code, r.idType, String(r.idNumber), r.name, r.address, r.country, r.valuta,
                r.nominal, r.kurs, r.nilai, r.dpp, r.code === 'Normal' ? num(s.rate) : 0, r.ppn,
                r.level === 'ok' ? 'Lengkap' : r.level === 'warn' ? 'Peringatan' : 'Perlu dilengkapi', r.note]);
        });
        var ws = XLSX.utils.aoa_to_sheet(data);
        // Nomor ID wajib teks agar angka nol di depan tidak hilang.
        for (var i = 1; i < data.length; i++) {
            var cell = ws['G' + (i + 1)];
            if (cell) { cell.t = 's'; cell.v = String(data[i][6]); cell.z = '@'; }
        }
        ws['!cols'] = [6, 14, 24, 18, 12, 14, 24, 28, 34, 14, 8, 14, 12, 18, 16, 10, 14, 16, 30].map(function (w) { return { wch: w }; });
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };

        var period = state.period ? state.period.slice(5) + '/' + state.period.slice(0, 4) : 'Semua periode';
        var rekap = [
            ['REKAP LAPORAN PAJAK CORETAX'], [],
            ['Nama Wajib Pajak', s.name || '-'], ['NPWP (16 digit)', normTaxId(s.npwp) || s.npwp || '-'],
            ['ID TKU', normTaxId(s.npwp) ? normTaxId(s.npwp) + '000000' : '-'], ['Status PKP', s.pkp === 'YA' ? 'PKP' : 'Bukan PKP'],
            ['Masa Pajak', period], ['Perlakuan PPN JUAL', s.treatment === 'VAT' ? 'Dikenai PPN (Normal), tarif ' + num(s.rate) + '%, faktor DPP ' + num(s.dppFactor) + '%' : 'Tidak dikenai PPN (NoVAT)'],
            [], ['Kode Transaksi', 'Jenis', 'Jumlah Dokumen', 'Jumlah Baris', 'Nilai Transaksi (IDR)', 'DPP (IDR)', 'PPN (IDR)']
        ];
        var g = {};
        rows.forEach(function (r) {
            var k = r.code + '|' + r.tipe;
            var o = g[k] || (g[k] = { code: r.code, tipe: r.tipe, docs: {}, n: 0, nilai: 0, dpp: 0, ppn: 0 });
            o.docs[r.doc] = 1; o.n++; o.nilai += r.nilai; o.dpp += r.dpp; o.ppn += r.ppn;
        });
        Object.keys(g).sort().forEach(function (k) {
            var o = g[k]; rekap.push([o.code, o.tipe, Object.keys(o.docs).length, o.n, o.nilai, o.dpp, o.ppn]);
        });
        rekap.push(['TOTAL', '', '', rows.length, tot.nilai, tot.dpp, tot.ppn]);
        var wsR = XLSX.utils.aoa_to_sheet(rekap);
        wsR['!cols'] = [34, 16, 16, 14, 22, 18, 16].map(function (w) { return { wch: w }; });

        var val = [['Nomor Dokumen', 'Tanggal', 'Nama Lawan Transaksi', 'Tingkat', 'Catatan']];
        rows.filter(function (r) { return r.level !== 'ok'; }).forEach(function (r) {
            val.push([r.doc, r.date, r.name, r.level === 'err' ? 'Perlu dilengkapi' : 'Peringatan', r.issues.join(' ')]);
        });
        if (val.length === 1) val.push(['Tidak ada catatan: seluruh baris lengkap.', '', '', '', '']);
        var wsV = XLSX.utils.aoa_to_sheet(val);
        wsV['!cols'] = [26, 12, 30, 18, 70].map(function (w) { return { wch: w }; });

        try {
            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            XLSX.utils.book_append_sheet(wb, wsR, 'Rekap');
            XLSX.utils.book_append_sheet(wb, wsV, 'Validasi');
            var tag = state.period || 'semua-periode';
            var ok = await window.safeExportXLSX(wb, 'CoreTax_' + tag + '.xlsx');
            if (ok && typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Export Berhasil', text: rows.length + ' baris diekspor. Periksa sheet Validasi sebelum digunakan.' });
            }
        } catch (e) {
            console.error('Export CoreTax:', e);
            alert('Terjadi kesalahan saat mengekspor file Excel.');
        }
    }

    /* ---------- Pengait ke aplikasi ---------- */
    window.loadCoretaxReport = function () { state.rows = []; render(true); };
    window.exportCoretaxExcel = doExport;
    window.addEventListener('storage', function (e) {
        if (e.key === 'mc_transactions' || e.key === 'mc_customers') state.rows = [];
    });
})();
