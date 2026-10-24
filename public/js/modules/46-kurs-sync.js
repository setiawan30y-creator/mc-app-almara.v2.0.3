/* =====================================================================
 * 46-kurs-sync.js  —  Sinkronisasi kurs dasar dari URL sumber acuan
 *
 *  - URL sumber disimpan di `mc_kurs_source` ({url, enabled}); dipakai bersama semua perangkat.
 *  - Halaman sumber diambil lewat server (api/kurs-source), tabelnya dibaca di browser.
 *  - Berjalan otomatis tiap 1 menit selama pengguna login (dan bisa dijalankan manual).
 *  - Hanya kurs DASAR yang diperbarui; margin tetap, kurs beli/jual dihitung ulang.
 *  - Jika sumber down / tidak terbaca, angka kurs TIDAK diubah (tetap angka terakhir)
 *    dan status "down" disimpan untuk ditampilkan di halaman Manajemen Kurs.
 *  - Status sync bersifat lokal per perangkat (key tanpa awalan mc_).
 *
 *  API: window.KursSync { config(), sourceName(), setSource(url), setEnabled(bool),
 *       run(opts), state(), nextAt(), parseHtml(html), nameFromUrl(url), INTERVAL }
 * ===================================================================== */
(function () {
    'use strict';

    var CFG_KEY = 'mc_kurs_source';
    var ST_KEY = 'kurs_sync_status';
    var LOCK_KEY = 'kurs_sync_lock';
    var LEGACY_KEY = 'mc_smartdeal_sync_status';
    var LEGACY_URL = 'https://smartdeal.co.id/rates/dki_banten';
    var INTERVAL = 60 * 1000;
    var FETCH_TIMEOUT = 25 * 1000;

    var busy = false;
    var nextAt = 0;

    // ------------------------------------------------------------ util
    function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* abaikan */ } }
    function readJson(key) { try { return JSON.parse(lsGet(key)) || null; } catch (e) { return null; } }
    function toast(icon, title) {
        if (window.Swal) window.Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 3200, showConfirmButton: false });
    }
    function emit() {
        try { window.dispatchEvent(new CustomEvent('kurs-sync-change')); } catch (e) { /* abaikan */ }
    }
    function loggedIn() {
        try { return typeof getCurrentUser === 'function' ? !!getCurrentUser() : true; } catch (e) { return false; }
    }

    // ------------------------------------------------------------ konfigurasi
    function config() {
        var c = readJson(CFG_KEY);
        if (!c) {
            // Migrasi: instalasi lama yang sudah pernah sync Smartdeal tetap berjalan.
            if (lsGet(LEGACY_KEY)) {
                c = { url: LEGACY_URL, enabled: true };
                lsSet(CFG_KEY, JSON.stringify(c));
            } else {
                c = { url: '', enabled: true };
            }
        }
        return { url: String(c.url || '').trim(), enabled: c.enabled !== false };
    }

    function saveConfig(c) { lsSet(CFG_KEY, JSON.stringify({ url: c.url, enabled: c.enabled !== false })); }

    // "https://www.smartdeal.co.id/rates/x" -> "Smartdeal"
    function nameFromUrl(url) {
        try {
            var host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
            var parts = host.split('.');
            var generic = { co: 1, com: 1, net: 1, org: 1, or: 1, id: 1, go: 1, web: 1, ac: 1, biz: 1, info: 1, my: 1, sg: 1, uk: 1 };
            while (parts.length > 1 && generic[parts[parts.length - 1]]) parts.pop();
            var label = parts[parts.length - 1] || host;
            return label.charAt(0).toUpperCase() + label.slice(1);
        } catch (e) { return ''; }
    }

    function validUrl(url) {
        try { var u = new URL(url); return /^https?:$/.test(u.protocol) && !!u.hostname; } catch (e) { return false; }
    }

    function sourceName() { var c = config(); return c.url ? nameFromUrl(c.url) : ''; }

    // ------------------------------------------------------------ status
    function state() {
        var s = readJson(ST_KEY) || {};
        return {
            status: s.status || 'idle',       // idle | ok | down | nomatch
            url: s.url || '',
            lastTry: s.lastTry || null,
            lastOk: s.lastOk || null,
            downSince: s.downSince || null,
            fails: s.fails || 0,
            matched: s.matched || 0,
            changed: s.changed || 0,
            message: s.message || '',
            mode: s.mode || 'auto'
        };
    }

    function saveState(patch) {
        var s = Object.assign(state(), patch);
        lsSet(ST_KEY, JSON.stringify(s));
        emit();
        return s;
    }

    // ------------------------------------------------------------ parser tabel kurs
    function parseNumber(text) {
        var s = String(text || '').replace(/[^\d.,]/g, '');
        if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
            s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(/,/g, '.') : s.replace(/,/g, '');
        } else if (s.indexOf(',') >= 0) {
            s = s.replace(/,/g, '.');
        } else if (s.indexOf('.') >= 0) {
            if (!/\.(\d{1,2})$/.test(s)) s = s.replace(/\./g, '');
        }
        var m = s.match(/\d+(\.\d+)?/);
        var v = m ? parseFloat(m[0]) : 0;
        return v > 0 ? v : 0;
    }

    // Mengembalikan { USD: {buy, sell}, ... } dari tabel HTML apa pun yang memuat kode 3 huruf + dua angka.
    function parseHtml(html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var out = {};
        Array.prototype.forEach.call(doc.querySelectorAll('tr'), function (tr) {
            var tds = tr.querySelectorAll('td');
            if (tds.length < 2) return;
            var code = '', nums = [], full = '';
            Array.prototype.forEach.call(tds, function (td) {
                var t = (td.textContent || '').trim();
                full += t + ' ';
                if (!code) { var m = t.match(/([A-Z]{3})/); if (m) code = m[1]; }
                var n = parseNumber(t);
                if (n) nums.push(n);
            });
            if (!code || nums.length < 2) return;

            var pair = nums.slice(-2);
            var buy = Math.min(pair[0], pair[1]);
            var sell = Math.max(pair[0], pair[1]);
            var is1000 = full.indexOf('1000') >= 0;
            var is100 = full.indexOf('100') >= 0 && !is1000;

            // Harga paket (mis. per 100 lembar): tidak ada valuta bernilai > Rp 100.000 per unit.
            if (buy >= 100000) {
                var div = is1000 ? 1000 : 100;
                buy /= div; sell /= div;
            }
            if (!out[code] || is100) out[code] = { buy: buy, sell: sell };
        });
        return out;
    }

    // ------------------------------------------------------------ ambil + terapkan
    async function fetchSource(url) {
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT) : null;
        try {
            var res = await fetch('api/kurs-source?url=' + encodeURIComponent(url) + '&cb=' + Date.now(), {
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                signal: ctrl ? ctrl.signal : undefined
            });
            var data = null;
            try { data = await res.json(); } catch (e) { /* bukan JSON */ }
            if (res.status === 401) throw new Error('Sesi login berakhir. Muat ulang halaman.');
            if (!res.ok || !data || data.status !== 'success' || !data.html) {
                throw new Error((data && data.message) || ('Server mengembalikan HTTP ' + res.status));
            }
            return data.html;
        } catch (e) {
            if (e && e.name === 'AbortError') throw new Error('Sumber tidak merespons (waktu habis).');
            throw e;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async function applyRates(rates) {
        var list = getCurrencies();
        var matched = 0, changed = 0;
        list.forEach(function (c) {
            var code = String(c.code || '').trim().toUpperCase();
            var r = rates[code] || rates[code.substring(0, 3)];
            if (!r) return;
            matched++;
            var mb = parseFloat(c.margin_buy) || 0;
            var ms = parseFloat(c.margin_sell) || 0;
            var same = Math.abs((parseFloat(c.base_buy) || 0) - r.buy) < 1e-9
                && Math.abs((parseFloat(c.base_sell) || 0) - r.sell) < 1e-9
                && Math.abs((parseFloat(c.buy) || 0) - (r.buy + mb)) < 1e-9
                && Math.abs((parseFloat(c.sell) || 0) - (r.sell + ms)) < 1e-9;
            if (same) return;
            c.base_buy = r.buy; c.base_sell = r.sell;
            c.buy = r.buy + mb; c.sell = r.sell + ms;
            changed++;
        });
        // Simpan hanya bila ada yang berubah: tiap simpan menulis ulang semua valuta ke database.
        if (changed > 0) await saveCurrencies(list);
        return { matched: matched, changed: changed };
    }

    function refreshViews() {
        try { if (typeof loadCurrencyTable === 'function') loadCurrencyTable(); } catch (e) { /* abaikan */ }
        try {
            var dash = document.getElementById('dashboard-view');
            if (typeof loadDashboard === 'function' && dash && dash.classList.contains('active')) loadDashboard();
        } catch (e) { /* abaikan */ }
    }

    async function run(opts) {
        opts = opts || {};
        var auto = !!opts.auto;
        var cfg = config();
        if (!cfg.url) {
            if (!auto) toast('info', 'Isi URL sumber kurs terlebih dahulu.');
            return null;
        }
        if (busy) return null;
        busy = true;
        emit();
        var before = state();
        var name = nameFromUrl(cfg.url);
        var nowIso = new Date().toISOString();
        try {
            var html = await fetchSource(cfg.url);
            var rates = parseHtml(html);
            if (!Object.keys(rates).length) throw new Error('Tabel kurs tidak ditemukan di halaman sumber (struktur halaman mungkin berubah).');

            var res = await applyRates(rates);
            if (res.matched === 0) {
                saveState({ status: 'nomatch', url: cfg.url, lastTry: nowIso, downSince: null, fails: 0, matched: 0, changed: 0, mode: auto ? 'auto' : 'manual',
                    message: 'Sumber terbaca, tetapi tidak ada kode valuta yang cocok dengan Manajemen Kurs. Kurs terakhir tetap dipakai.' });
            } else {
                saveState({ status: 'ok', url: cfg.url, lastTry: nowIso, lastOk: nowIso, downSince: null, fails: 0, matched: res.matched, changed: res.changed, mode: auto ? 'auto' : 'manual',
                    message: res.changed ? res.changed + ' valuta diperbarui dari ' + name + '. Margin tetap.' : 'Kurs sudah sama dengan sumber.' });
                if (res.changed) refreshViews();
                if (before.status === 'down') toast('success', 'Sumber ' + name + ' kembali normal.');
                else if (!auto) toast('success', res.changed ? res.changed + ' valuta diperbarui dari ' + name : 'Kurs sudah sama dengan ' + name);
            }
            return state();
        } catch (e) {
            // Sumber down: JANGAN ubah angka kurs. Hanya catat status.
            var firstDown = before.status !== 'down' || before.url !== cfg.url;
            saveState({ status: 'down', url: cfg.url, lastTry: nowIso, downSince: firstDown ? nowIso : (before.downSince || nowIso),
                fails: firstDown ? 1 : (before.fails || 0) + 1, mode: auto ? 'auto' : 'manual', message: (e && e.message) || 'Sumber tidak dapat diakses.' });
            if (firstDown || !auto) toast('warning', 'Sumber ' + name + ' tidak dapat diakses. Kurs memakai angka terakhir.');
            return state();
        } finally {
            busy = false;
            emit();
        }
    }

    // ------------------------------------------------------------ jadwal otomatis
    function tick() {
        nextAt = Date.now() + INTERVAL;
        var cfg = config();
        if (!cfg.enabled || !cfg.url || !loggedIn()) { emit(); return; }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        // Beberapa tab terbuka: cukup satu yang menarik data per siklus.
        var last = parseInt(lsGet(LOCK_KEY), 10) || 0;
        if (Date.now() - last < INTERVAL - 5000) { emit(); return; }
        lsSet(LOCK_KEY, String(Date.now()));
        run({ auto: true });
    }

    function start() {
        if (window.__kursSyncTimer) return;
        nextAt = Date.now() + 4000;
        setTimeout(tick, 4000);
        window.__kursSyncTimer = setInterval(tick, INTERVAL);
    }

    // ------------------------------------------------------------ pengaturan dari UI
    function setSource(url) {
        url = String(url || '').trim();
        var cfg = config();
        if (url && !validUrl(url)) return { ok: false, message: 'URL tidak valid. Awali dengan http:// atau https://' };
        if (url === cfg.url) return { ok: true, unchanged: true };
        saveConfig({ url: url, enabled: cfg.enabled });
        lsSet(ST_KEY, JSON.stringify({}));   // sumber baru: riwayat status lama tidak relevan
        emit();
        if (url) run({ auto: false });
        return { ok: true };
    }

    function setEnabled(on) {
        var cfg = config();
        saveConfig({ url: cfg.url, enabled: !!on });
        if (on) nextAt = Date.now() + INTERVAL;
        emit();
    }

    window.KursSync = {
        INTERVAL: INTERVAL,
        config: config,
        sourceName: sourceName,
        nameFromUrl: nameFromUrl,
        validUrl: validUrl,
        setSource: setSource,
        setEnabled: setEnabled,
        run: run,
        state: state,
        nextAt: function () { return nextAt; },
        isBusy: function () { return busy; },
        parseHtml: parseHtml
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
