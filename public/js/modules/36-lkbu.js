/* =====================================================================
 * 36-lkbu.js  —  LKBU (B0001–B0006): sumber tunggal kode akun BI
 *
 *  - Katalog kode akun Laba/Rugi B0003 (01–25) SATU tempat.
 *  - Kategori pengeluaran/pendapatan (form Jurnal Keuangan) diambil dari katalog
 *    ini, jadi kode di form = kode di laporan.
 *  - Setiap pengeluaran disimpan / dihapus / diubah -> B0003 dihitung ulang
 *    otomatis (tanpa tombol Kalkulasi, tanpa membaca tabel #plTable).
 *  - Perhitungan memakai window.computeLabaRugi() (06-regulatory-reports.js).
 * ===================================================================== */
(function () {
    'use strict';

    // kind: INCOME = pendapatan, EXPENSE = beban, AUTO = dihitung sistem (bukan input jurnal)
    var ACCOUNTS = {
        '01': { name: 'Penjualan UKA', kind: 'AUTO' },
        '02': { name: 'Pencairan TC', kind: 'AUTO' },
        '03': { name: 'Saldo Awal UKA dan TC', kind: 'AUTO' },
        '04': { name: 'Pembelian UKA dan TC', kind: 'AUTO' },
        '05': { name: 'Saldo Akhir UKA dan TC', kind: 'AUTO' },
        '06': { name: 'Pendapatan Pengiriman Uang', kind: 'INCOME' },
        '07': { name: 'Beban Gaji, Upah dan Tunjangan', kind: 'EXPENSE' },
        '08': { name: 'Beban Sewa', kind: 'EXPENSE' },
        '09': { name: 'Beban Iklan dan promosi', kind: 'EXPENSE' },
        '10': { name: 'Beban Air, Listrik dan Telepon', kind: 'EXPENSE' },
        '11': { name: 'Beban Transportasi dan perjalanan', kind: 'EXPENSE' },
        '12': { name: 'Beban Pemeliharaan kendaraan', kind: 'EXPENSE' },
        '13': { name: 'Penyusutan Aset Tetap', kind: 'AUTO' },
        '14': { name: 'Beban Asuransi', kind: 'EXPENSE' },
        '15': { name: 'Beban Lain-Lain (Operasional)', kind: 'EXPENSE' },
        '16': { name: 'Pendapatan Bunga bank', kind: 'INCOME' },
        '17': { name: 'Beban Administrasi Bank', kind: 'EXPENSE' },
        '18': { name: 'Beban Bunga Pinjaman', kind: 'EXPENSE' },
        '19': { name: 'Laba Penjualan Aset Tetap', kind: 'INCOME' },
        '20': { name: 'Rugi Penjualan Aset Tetap', kind: 'EXPENSE' },
        '21': { name: 'Laba Selisih Kurs', kind: 'AUTO' },
        '22': { name: 'Rugi Selisih Kurs', kind: 'EXPENSE' },
        '23': { name: 'Pendapatan Lain-Lain', kind: 'INCOME' },
        '24': { name: 'Beban Lain-Lain (Non Operasional)', kind: 'EXPENSE' },
        '25': { name: 'Pajak Penghasilan', kind: 'EXPENSE' }
    };

    var FALLBACK = { PENDAPATAN: '23', PENGELUARAN: '15' };

    function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

    var byName = {};
    Object.keys(ACCOUNTS).forEach(function (c) { byName[norm(ACCOUNTS[c].name)] = c; });

    /** "07-Beban Sewa" untuk kode 07 (format yang disimpan di e.kategori). */
    function label(code) { return code + '-' + ACCOUNTS[code].name; }

    /** Kode BI sebuah jurnal: dari awalan "NN-", lalu nama kategori lama, lalu fallback per tipe. */
    function codeOf(exp) {
        var kat = String((exp && exp.kategori) || '').trim();
        var m = kat.match(/^(\d{2})\s*-/);
        if (m && ACCOUNTS[m[1]]) return m[1];
        var hit = byName[norm(kat.replace(/^\d{2}\s*-\s*/, ''))];
        if (hit) return hit;
        return (exp && exp.tipe === 'PENDAPATAN') ? FALLBACK.PENDAPATAN : FALLBACK.PENGELUARAN;
    }

    /** Daftar kategori untuk dropdown form jurnal. type: PENGELUARAN | PENDAPATAN */
    function optionsFor(type) {
        var want = type === 'PENDAPATAN' ? 'INCOME' : 'EXPENSE';
        return Object.keys(ACCOUNTS).filter(function (c) { return ACCOUNTS[c].kind === want; }).map(label);
    }

    window.LKBU_ACCOUNTS = ACCOUNTS;
    window.lkbuCodeOf = codeOf;
    window.lkbuExpenseOptions = optionsFor;
    /** true bila jurnal masuk akun pendapatan (kode INCOME), false bila beban. Dipakai Neraca & B0003 agar konsisten. */
    window.lkbuIsIncome = function (exp) { var a = ACCOUNTS[codeOf(exp)]; return !!a && a.kind === 'INCOME'; };

    // ---------------------------------------------------------------- B0003
    var TOTAL_ROWS = {
        'pendapatan/(rugi) operasional kotor uka-tc': 'opKotorUkaTc',
        'pendapatan/(rugi) operasional kotor': 'opKotor',
        'total beban operasional': 'totalBebanOp',
        'pendapatan/(rugi) operasional bersih': 'opBersih',
        'laba/(rugi) sebelum pajak penghasilan': 'labaSebelumPajak',
        'laba (rugi) bersih': 'labaBersih',
        'laba/(rugi) bersih': 'labaBersih'
    };

    function fmt(n) {
        return typeof window.formatIdr === 'function' ? window.formatIdr(n) : String(Math.round(n));
    }

    function ensurePeriod() {
        var mEl = document.getElementById('lkbuB0003Month');
        var yEl = document.getElementById('lkbuB0003Year');
        if (!mEl || !yEl) return null;
        var now = new Date();
        if (!mEl.value) mEl.value = String(now.getMonth() + 1).padStart(2, '0');
        if (!yEl.value) yEl.value = String(now.getFullYear());
        var y = String(yEl.value).trim();
        if (!/^\d{4}$/.test(y) || +y < 2000 || +y > 2100) return null;
        return { m: mEl.value, y: y };
    }

    /** Hitung & isi tabel B0003. opts.silent=true -> tanpa alert. */
    function renderB0003(opts) {
        var silent = !opts || opts.silent !== false;
        var panelRows = document.querySelectorAll('#lkbu-panel-b0003 table tbody tr');
        var period = ensurePeriod();
        if (!panelRows.length || typeof window.computeLabaRugi !== 'function') return { updated: 0 };
        if (!period) {
            if (!silent) alert('Pilih bulan dan masukkan tahun laporan yang valid.');
            return { updated: 0 };
        }
        var r = window.computeLabaRugi(period.y, period.m);
        var updated = 0;
        panelRows.forEach(function (row) {
            var cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            var code = (cells[0].textContent || '').trim();
            var value;
            if (/^\d{2}$/.test(code) && r.d[code] !== undefined) value = r.d[code];
            else {
                var key = TOTAL_ROWS[norm(cells[1].textContent)];
                if (key) value = r[key];
            }
            if (value === undefined) return;
            var cell = cells[cells.length - 1];
            cell.textContent = fmt(value);
            updated++;
        });
        var stamp = document.getElementById('lkbuB0003Stamp');
        if (stamp) stamp.textContent = 'Diperbarui otomatis ' + new Date().toLocaleTimeString('id-ID') + ' · periode ' + period.m + '/' + period.y;
        return { updated: updated, result: r };
    }
    window.lkbuRenderB0003 = renderB0003;

    var timer = null;
    /** Panggil setelah data pengeluaran/aset/transaksi berubah. */
    function refresh() {
        clearTimeout(timer);
        timer = setTimeout(function () {
            try { renderB0003({ silent: true }); } catch (e) { console.warn('LKBU B0003:', e); }
            try {
                var pm = document.getElementById('plMonth'), py = document.getElementById('plYear');
                if (pm && py && pm.value && py.value && typeof window.loadLabaRugi === 'function') window.loadLabaRugi();
            } catch (e) { console.warn('LKBU plTable:', e); }
        }, 80);
    }
    window.lkbuRefresh = refresh;

    // ----------------------------------------------------- hook ke penyimpanan
    function hookSaveExpenses() {
        if (typeof window.saveExpenses !== 'function' || window.saveExpenses.__lkbu) return;
        var orig = window.saveExpenses;
        var wrapped = function () {
            var out = orig.apply(this, arguments);
            refresh();
            return out;
        };
        wrapped.__lkbu = true;
        window.saveExpenses = wrapped;
    }

    function hookStorage() {
        if (Storage.prototype.__lkbuHooked) return;
        var set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k) {
            var out = set.apply(this, arguments);
            if (k === 'mc_expenses' || k === 'mc_assets') refresh();
            return out;
        };
        Storage.prototype.__lkbuHooked = true;
    }

    // ------------------------------------------------------------------ init
    function bindUi() {
        document.addEventListener('click', function (e) {
            var t = e.target && e.target.closest ? e.target.closest('[data-target="laporan-lku-view"], [data-lkbu-tab="b0003"]') : null;
            if (t) setTimeout(function () { renderB0003({ silent: true }); }, 30);
        }, true);
        ['lkbuB0003Month', 'lkbuB0003Year'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', function () { renderB0003({ silent: true }); });
        });
        var btn = document.querySelector('#lkbu-panel-b0003 button[onclick*="kalkulasiLabaRugiB0003"]');
        if (btn) btn.parentElement.insertAdjacentHTML('beforeend', '<small id="lkbuB0003Stamp" class="text-muted" style="margin-left:12px;align-self:center"></small>');
    }

    function init() {
        hookSaveExpenses();
        hookStorage();
        bindUi();
        renderB0003({ silent: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
