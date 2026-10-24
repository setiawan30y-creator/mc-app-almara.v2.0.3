/* =====================================================================
 * 47-kurs-page.js  —  Halaman Manajemen Kurs Valuta
 *
 *  - Header, kartu "Sumber acuan kurs" (URL + status sinkronisasi), tabel kurs, referensi global.
 *  - Mesin sinkronisasi ada di 46-kurs-sync.js (window.KursSync); form tambah/edit di 45-currency-form.js.
 *  - Kerangka dibangun sekali; pembaruan berikutnya hanya mengganti status & isi tabel,
 *    sehingga kolom URL dan pencarian tidak hilang saat data tersinkron.
 *  - Mengambil alih window.loadCurrencyTable (dipanggil navigasi, sync.js, form valuta).
 * ===================================================================== */
(function () {
    'use strict';

    var S = { q: '', low: false, dirty: false, err: '', ready: false, timer: null };
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var ROLES_SOURCE = { owner: 1, superadmin: 1, admin: 1, supervisor: 1 };

    // Inisial dari nama profil perusahaan: "PT Almara Valuta" -> "AV", satu kata -> kata itu.
    function companyInitials() {
        var name = '';
        try { var p = typeof getProfile === 'function' ? getProfile() : null; name = String((p && p.name) || '').trim(); } catch (e) { /* abaikan */ }
        var skip = { pt: 1, cv: 1, ud: 1, pd: 1, tbk: 1 };
        var toks = name.split(/[^A-Za-z0-9]+/).filter(function (t) { return t && !skip[t.toLowerCase()]; });
        if (!toks.length) return '';
        if (toks.length === 1) return toks[0].toUpperCase().slice(0, 6);
        return toks.map(function (t) { return t.charAt(0); }).join('').toUpperCase().slice(0, 5);
    }

    // Kurs dasar (dari sumber/master); bila belum tersimpan, hitung dari kurs akhir dikurangi margin.
    function baseOf(c, type) {
        var b = parseFloat(type === 'sell' ? c.base_sell : c.base_buy);
        if (b > 0) return b;
        var fin = parseFloat(type === 'sell' ? c.sell : c.buy) || 0;
        return fin - (parseFloat(type === 'sell' ? c.margin_sell : c.margin_buy) || 0);
    }

    function user() { try { return typeof getCurrentUser === 'function' ? getCurrentUser() : null; } catch (e) { return null; } }
    function role() { var u = user(); return u && u.role ? String(u.role).toLowerCase() : 'kasir'; }
    function canEditSource() { return !!ROLES_SOURCE[role()]; }
    function showAudit() { var r = role(); return r === 'admin' || r === 'owner' || r === 'superadmin'; }
    function sync() { return window.KursSync; }

    function fmtTime(iso) {
        if (!iso) return '-';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '-';
        var today = new Date();
        var sameDay = d.toDateString() === today.toDateString();
        var hm = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return sameDay ? 'hari ini ' + hm : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' + hm;
    }

    function ago(iso) {
        if (!iso) return '';
        var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
        if (s < 60) return s + ' detik';
        if (s < 3600) return Math.floor(s / 60) + ' menit';
        if (s < 86400) return Math.floor(s / 3600) + ' jam ' + Math.floor((s % 3600) / 60) + ' menit';
        return Math.floor(s / 86400) + ' hari';
    }

    // ------------------------------------------------------------ gaya
    function injectStyle() {
        if ($('kp-style')) return;
        var st = document.createElement('style');
        st.id = 'kp-style';
        st.textContent = [
            '.kp{--kp-bd:var(--mc-border,rgba(148,163,184,.28));--kp-card:var(--mc-card-bg,#18181b);--kp-tx:var(--mc-text,#fafafa);--kp-mut:var(--mc-text-muted,#94a3b8);',
            '--kp-pri:var(--mc-primary,#22c55e);--kp-ok:var(--mc-buy,#22c55e);--kp-bad:var(--mc-danger,#ef4444);--kp-warn:var(--mc-warning,#f59e0b);--kp-info:var(--mc-info,#3b82f6);',
            '--kp-inp:var(--mc-input-bg,rgba(15,23,42,.5));--kp-r:var(--mc-radius,12px);color:var(--kp-tx)}',
            '.kp *{box-sizing:border-box}.kp [hidden]{display:none!important}',
            '.kp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
            '.kp-head h2{margin:0;font-size:1.25rem}.kp-head p{margin:4px 0 0;color:var(--kp-mut);font-size:.85rem}',
            '.kp-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
            '.kp-btn{border:1px solid var(--kp-bd);background:transparent;color:var(--kp-tx);padding:8px 14px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-size:.85rem;font-weight:600;display:inline-flex;align-items:center;gap:7px;font-family:inherit}',
            '.kp-btn:hover{background:var(--kp-inp)}.kp-btn[disabled]{opacity:.5;cursor:not-allowed}',
            '.kp-btn.pri{background:var(--kp-pri);border-color:var(--kp-pri);color:#fff}.kp-btn.pri:hover{filter:brightness(1.08)}',
            '.kp-btn.sync{border-color:var(--kp-warn);color:var(--kp-warn)}',
            '.kp-btn.sm{padding:5px 10px;font-size:.78rem}',
            '.kp-btn.del{color:var(--kp-bad);border-color:color-mix(in srgb,var(--kp-bad) 35%,transparent);background:color-mix(in srgb,var(--kp-bad) 8%,transparent)}',
            '.kp-card{background:var(--kp-card);border:1px solid var(--kp-bd);border-radius:var(--kp-r);padding:14px 16px;margin-bottom:14px}',
            '.kp-card h3{margin:0 0 10px;font-size:.95rem;display:flex;align-items:center;gap:8px}',
            '.kp-src{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
            '.kp-src input[type=url]{flex:1;min-width:240px;padding:9px 12px;background:var(--kp-inp);border:1px solid var(--mc-input-border,var(--kp-bd));color:var(--kp-tx);border-radius:var(--mc-input-radius,10px);font-size:.88rem;font-family:inherit}',
            '.kp-src input[type=url]:focus{outline:none;border-color:var(--kp-pri)}.kp-src input[readonly]{opacity:.7}',
            '.kp-hint{margin:8px 0 0;font-size:.78rem;color:var(--kp-mut);line-height:1.5}',
            '.kp-err{margin:8px 0 0;font-size:.8rem;color:var(--kp-bad)}',
            '.kp-sw{display:inline-flex;align-items:center;gap:8px;font-size:.82rem;color:var(--kp-mut);cursor:pointer;user-select:none}',
            '.kp-sw input{position:absolute;opacity:0;pointer-events:none}',
            '.kp-sw i{width:34px;height:19px;border-radius:99px;background:var(--kp-bd);position:relative;transition:.15s;flex:none}',
            '.kp-sw i:after{content:"";position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:.15s}',
            '.kp-sw input:checked+i{background:var(--kp-ok)}.kp-sw input:checked+i:after{left:17px}',
            '.kp-sw input:focus-visible+i{outline:2px solid var(--kp-pri);outline-offset:2px}',
            '.kp-status{margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.82rem;color:var(--kp-mut)}',
            '.kp-dot{width:9px;height:9px;border-radius:50%;background:var(--kp-mut);flex:none}',
            '.kp-dot.ok{background:var(--kp-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--kp-ok) 22%,transparent)}',
            '.kp-dot.down{background:var(--kp-bad);box-shadow:0 0 0 3px color-mix(in srgb,var(--kp-bad) 22%,transparent)}',
            '.kp-dot.warn{background:var(--kp-warn)}.kp-dot.run{background:var(--kp-info);animation:kpPulse 1s infinite}',
            '@keyframes kpPulse{50%{opacity:.3}}',
            '.kp-status b{color:var(--kp-tx)}.kp-status .sp{flex:1}',
            '.kp-alert{margin-top:12px;padding:11px 14px;border-radius:10px;border:1px solid;font-size:.84rem;line-height:1.55;display:flex;gap:10px;align-items:flex-start}',
            '.kp-alert i{margin-top:3px}.kp-alert.down{background:color-mix(in srgb,var(--kp-bad) 10%,transparent);border-color:color-mix(in srgb,var(--kp-bad) 40%,transparent)}',
            '.kp-alert.down i{color:var(--kp-bad)}',
            '.kp-alert.warn{background:color-mix(in srgb,var(--kp-warn) 10%,transparent);border-color:color-mix(in srgb,var(--kp-warn) 40%,transparent)}.kp-alert.warn i{color:var(--kp-warn)}',
            '.kp-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}',
            '.kp-search{position:relative}.kp-search i{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--kp-mut);font-size:.8rem;pointer-events:none}',
            '.kp-search input{padding:8px 11px 8px 32px;width:220px;max-width:100%;background:var(--kp-inp);border:1px solid var(--mc-input-border,var(--kp-bd));color:var(--kp-tx);border-radius:var(--mc-input-radius,10px);font-size:.85rem;font-family:inherit}',
            '.kp-search input:focus{outline:none;border-color:var(--kp-pri)}',
            '.kp-chip{padding:6px 12px;border-radius:99px;border:1px solid var(--kp-bd);font-size:.78rem;color:var(--kp-mut);background:transparent;cursor:default;font-family:inherit}',
            'button.kp-chip{cursor:pointer}button.kp-chip.on{border-color:var(--kp-warn);color:var(--kp-warn)}',
            '.kp-tbl{width:100%;border-collapse:collapse}',
            '.kp-tbl th{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--kp-mut);text-align:left;padding:8px 10px;border-bottom:1px solid var(--kp-bd);white-space:nowrap}',
            '.kp-tbl td{padding:10px;border-bottom:1px solid color-mix(in srgb,var(--kp-bd) 55%,transparent);vertical-align:middle;font-size:.88rem}',
            '.kp-tbl tbody tr:hover{background:color-mix(in srgb,var(--kp-inp) 70%,transparent)}',
            '.kp-tbl .r{text-align:right}.kp-tbl .c{text-align:center}',
            '.kp-id{display:flex;align-items:center;gap:10px}',
            '.kp-flag{width:34px;height:24px;border-radius:4px;border:1px solid var(--kp-bd);overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:var(--kp-mut);flex:none;background:var(--kp-inp)}',
            '.kp-flag img{width:100%;height:100%;object-fit:cover}',
            '.kp-id small{display:block;color:var(--kp-mut);font-size:.72rem}',
            '.kp-up{color:var(--kp-ok)}.kp-dn{color:var(--kp-bad)}.kp-flat{color:var(--kp-mut);opacity:.6}',
            '.kp-num{font-variant-numeric:tabular-nums;font-weight:700}.kp-res{background:color-mix(in srgb,var(--kp-pri) 7%,transparent)}',
            '.kp-badge{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:99px;font-size:.66rem;font-weight:700;background:color-mix(in srgb,var(--kp-bad) 14%,transparent);color:var(--kp-bad)}',
            '.kp-mg{font-size:.78rem;color:var(--kp-mut);line-height:1.5}.kp-mg b.b{color:var(--kp-ok)}.kp-mg b.s{color:var(--kp-bad)}',
            '.kp-aud{font-size:.68rem;color:var(--kp-mut);opacity:.8;line-height:1.3;margin-top:3px}',
            '.kp-act{display:flex;gap:6px;justify-content:flex-end}',
            '.kp-empty{text-align:center;color:var(--kp-mut);padding:26px 10px}',
            '.kp-mid th,.kp-mid td{font-size:.85rem}',
            '@media(max-width:700px){.kp-search input{width:100%}.kp-search{flex:1}}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ kerangka
    function ensure() {
        var root = $('kursMgrRoot');
        if (!root) return null;
        if (root.__kpReady) return root;   // properti JS (bukan atribut): ikut hilang bila elemen diganti/dikloning
        injectStyle();
        root.__kpReady = true;
        root.dataset.ready = '1';
        root.className = 'kp';
        root.innerHTML =
            '<div class="kp-head"><div><h2>Manajemen Kurs Valuta</h2>' +
            '<p>Atur kurs, margin, dan stok minimum tiap valuta. Kurs dasar bisa disinkronkan otomatis dari URL sumber.</p></div>' +
            '<div class="kp-tools"><button type="button" class="kp-btn sync" data-act="sync" id="kpSyncBtn"><i class="fa-solid fa-rotate"></i><span>Sync</span></button>' +
            '<button type="button" class="kp-btn pri" data-act="add"><i class="fa-solid fa-plus"></i> Tambah Valuta</button></div></div>' +

            '<div class="kp-card"><h3><i class="fa-solid fa-link"></i> Sumber acuan kurs</h3>' +
            '<div class="kp-src"><input type="url" id="kpUrl" placeholder="https://contoh.com/halaman-kurs" autocomplete="off" spellcheck="false" aria-label="URL sumber acuan kurs">' +
            '<button type="button" class="kp-btn" data-act="save" id="kpSave"><i class="fa-solid fa-check"></i> Simpan</button>' +
            '<label class="kp-sw"><input type="checkbox" id="kpAuto"><i></i><span>Otomatis tiap 1 menit</span></label></div>' +
            '<div class="kp-err" id="kpErr" hidden></div>' +
            '<p class="kp-hint">Masukkan alamat halaman yang memuat tabel kurs (kode valuta, kurs beli, kurs jual). Saat sinkron, hanya <b>kurs dasar</b> yang diperbarui; ' +
            '<b>margin tetap</b> dan Kurs Beli/Jual dihitung ulang. Jika sumber tidak bisa dibuka, kurs tetap memakai angka terakhir.</p>' +
            '<div id="kpStatus"></div></div>' +

            '<div class="kp-card"><div class="kp-bar">' +
            '<div class="kp-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" id="kpQ" placeholder="Cari kode / negara" autocomplete="off" aria-label="Cari valuta"></div>' +
            '<span class="kp-chip" id="kpCount"></span><button type="button" class="kp-chip" id="kpLow" data-act="low"></button></div>' +
            '<div class="table-responsive"><table class="kp-tbl"><thead><tr>' +
            '<th>Valuta</th><th class="c">Trend</th><th class="r">Kurs Beli</th><th class="r">Kurs Jual</th><th class="r" id="kpBuyTh">Kurs Beli</th><th class="r" id="kpSellTh">Kurs Jual</th>' +
            '<th class="r">Stok</th><th class="r">Batas Aman</th><th>Margin (Rp)</th><th></th></tr></thead>' +
            '<tbody id="currenciesTableBody"></tbody></table></div></div>' +

            '<div class="kp-card"><div class="kp-bar" style="justify-content:space-between;margin-bottom:8px">' +
            '<h3 style="margin:0"><i class="fa-solid fa-globe"></i> Referensi Kurs Global (Mid-Market)</h3>' +
            '<button type="button" class="kp-btn sm" data-act="global"><i class="fa-solid fa-rotate-right"></i> Perbarui</button></div>' +
            '<div class="table-responsive"><table class="kp-tbl kp-mid"><thead><tr><th>Mata Uang</th><th class="r">Kurs Tengah (Rp)</th><th class="r">Status</th></tr></thead>' +
            '<tbody id="globalRatesTableBody"><tr><td colspan="3" class="kp-empty">Klik "Perbarui" untuk mengambil kurs global secara live.</td></tr></tbody></table></div>' +
            '<p class="kp-hint">Data dari Open ExchangeRate-API (mid-market), hanya sebagai acuan tren nilai tukar dunia.</p></div>';

        bind(root);
        return root;
    }

    function bind(root) {
        root.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]');
            if (!b) return;
            var act = b.dataset.act;
            if (act === 'sync') { sync() && sync().run({ auto: false }); }
            else if (act === 'add') openForm();
            else if (act === 'save') saveSource();
            else if (act === 'low') { S.low = !S.low; renderTable(); }
            else if (act === 'global') call('fetchGlobalRates');
            else if (act === 'edit') openForm(b.dataset.code);
            else if (act === 'del') call('deleteCurrency', b.dataset.code);
        });
        root.addEventListener('input', function (e) {
            if (e.target.id === 'kpQ') { S.q = e.target.value; renderTable(); }
            else if (e.target.id === 'kpUrl') { S.dirty = true; S.err = ''; paintErr(); }
        });
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.id === 'kpUrl') { e.preventDefault(); saveSource(); }
        });
        root.addEventListener('change', function (e) {
            if (e.target.id === 'kpAuto' && sync()) sync().setEnabled(e.target.checked);
        });
        // Gambar bendera yang gagal dimuat -> tampilkan kode negara.
        root.addEventListener('error', function (e) {
            var t = e.target;
            if (t && t.tagName === 'IMG' && t.closest('.kp-flag')) t.remove();
        }, true);
    }

    // Panggil fungsi global dengan pesan jelas bila belum termuat atau error (tidak diam-diam gagal).
    function call(name, arg) {
        if (typeof window[name] !== 'function') {
            if (window.Swal) window.Swal.fire({ icon: 'error', title: 'Fitur belum termuat', text: 'Muat ulang halaman dengan Ctrl+F5. (' + name + ')' });
            else alert('Fitur belum termuat. Muat ulang halaman dengan Ctrl+F5. (' + name + ')');
            return;
        }
        try {
            window[name](arg);
            if (name === 'openCurrencyModal') verifyModal();
        } catch (err) {
            console.error('[Kurs] ' + name + ' gagal:', err);
            var msg = 'Terjadi kesalahan: ' + (err && err.message ? err.message : err);
            if (window.Swal) window.Swal.fire({ icon: 'error', title: 'Gagal membuka', text: msg }); else alert(msg);
        }
    }

    // Bila form valuta dibuat tetapi tidak tampil, beri tahu alasannya (bukan diam saja).
    function verifyModal() {
        setTimeout(function () {
            var m = document.getElementById('cfModal');
            var r = m ? m.getBoundingClientRect() : null;
            if (m && r.width > 0 && r.height > 0 && getComputedStyle(m).visibility !== 'hidden' && getComputedStyle(m).display !== 'none') return;
            var d = ['form ' + (m ? 'ada di halaman' : 'tidak ada di halaman (terhapus / tidak terbentuk)')];
            if (m) {
                var cs = getComputedStyle(m);
                d.push('display=' + cs.display, 'visibility=' + cs.visibility, 'opacity=' + cs.opacity, 'ukuran=' + Math.round(r.width) + 'x' + Math.round(r.height), 'induk=' + (m.parentElement ? m.parentElement.tagName : '-'));
            }
            d.push('gaya form ' + (document.getElementById('cf-style') ? 'termuat' : 'TIDAK termuat'), 'fungsi=' + (window.openCurrencyModal ? window.openCurrencyModal.toString().length + ' karakter' : '-'));
            var why = d.join('; ');
            console.error('[Kurs] openCurrencyModal:', why);
            if (window.Swal) window.Swal.fire({ icon: 'error', title: 'Form valuta tidak tampil', text: why });
        }, 250);
    }

    // Buka form lewat namespace CurrencyForm (45-currency-form.js), bukan nama global lama yang bisa tertimpa.
    function openForm(code) {
        if (window.CurrencyForm && typeof window.CurrencyForm.open === 'function') {
            try { window.CurrencyForm.open(code); verifyModal(); } catch (err) {
                console.error('[Kurs] form valuta gagal:', err);
                if (window.Swal) window.Swal.fire({ icon: 'error', title: 'Gagal membuka form', text: String(err && err.message || err) });
            }
        } else call('openCurrencyModal', code);
    }

    function saveSource() {
        if (!canEditSource() || !sync()) return;
        var input = $('kpUrl');
        var res = sync().setSource(input.value);
        S.err = res.ok ? '' : res.message;
        if (res.ok) S.dirty = false;
        paintErr();
        paintSource();
    }

    function paintErr() {
        var el = $('kpErr');
        if (!el) return;
        el.hidden = !S.err;
        el.textContent = S.err;
    }

    // ------------------------------------------------------------ sumber & status
    function paintSource() {
        if (!ensure() || !sync()) return;
        var K = sync();
        var cfg = K.config();
        var st = K.state();
        var name = K.sourceName();
        var edit = canEditSource();

        var input = $('kpUrl');
        input.readOnly = !edit;
        if (document.activeElement !== input && !S.dirty && input.value !== cfg.url) input.value = cfg.url;
        $('kpSave').hidden = !edit;
        var auto = $('kpAuto');
        auto.disabled = !edit;
        if (auto.checked !== cfg.enabled) auto.checked = cfg.enabled;

        var btn = $('kpSyncBtn');
        var busy = K.isBusy();
        btn.disabled = busy || !cfg.url;
        btn.title = cfg.url ? 'Ambil kurs terbaru dari ' + cfg.url : 'Isi URL sumber kurs terlebih dahulu';
        btn.innerHTML = busy
            ? '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyinkronkan...</span>'
            : '<i class="fa-solid fa-rotate"></i><span>Sync' + (name ? ' (' + esc(name) + ')' : '') + '</span>';

        var html = '';
        var dot = 'idle', line = '';
        if (!cfg.url) {
            line = 'Belum ada sumber. Isi URL halaman kurs lalu klik <b>Simpan</b>.';
        } else if (busy) {
            dot = 'run'; line = 'Menyinkronkan dari <b>' + esc(name) + '</b>...';
        } else if (st.status === 'ok') {
            dot = 'ok';
            line = 'Tersambung ke <b>' + esc(name) + '</b> · berhasil ' + esc(fmtTime(st.lastOk)) + ' · ' + esc(st.message);
        } else if (st.status === 'down') {
            dot = 'down'; line = '<b>' + esc(name) + '</b> tidak dapat diakses';
        } else if (st.status === 'nomatch') {
            dot = 'warn'; line = '<b>' + esc(name) + '</b> terbaca, tetapi kode valuta tidak cocok';
        } else {
            line = 'Menunggu sinkronisasi pertama dari <b>' + esc(name) + '</b>...';
        }
        html += '<div class="kp-status"><span class="kp-dot ' + dot + '"></span><span>' + line + '</span><span class="sp"></span><span id="kpNext"></span></div>';

        if (cfg.url && !busy && st.status === 'down') {
            html += '<div class="kp-alert down" role="alert"><i class="fa-solid fa-triangle-exclamation"></i><div>' +
                '<b>Sumber kurs ' + esc(name) + ' sedang down.</b> Kurs <b>tidak diubah</b> dan tetap memakai angka terakhir' +
                (st.lastOk ? ' (terakhir berhasil ' + esc(fmtTime(st.lastOk)) + ')' : ' yang tersimpan') + '.<br>' +
                'Down sejak ' + esc(fmtTime(st.downSince)) + ' (' + esc(ago(st.downSince)) + ' lalu) · gagal ' + st.fails + ' kali berturut-turut.<br>' +
                '<span style="opacity:.85">Penyebab: ' + esc(st.message) + '</span><br>' +
                (cfg.enabled ? 'Sistem mencoba lagi otomatis tiap 1 menit.' : 'Sinkron otomatis nonaktif; klik tombol Sync untuk mencoba lagi.') +
                '</div></div>';
        } else if (cfg.url && !busy && st.status === 'nomatch') {
            html += '<div class="kp-alert warn" role="status"><i class="fa-solid fa-circle-info"></i><div>' + esc(st.message) + '</div></div>';
        }
        $('kpStatus').innerHTML = html;
        paintNext();
    }

    function paintNext() {
        var el = $('kpNext');
        if (!el || !sync()) return;
        var K = sync(), cfg = K.config();
        if (!cfg.url) { el.textContent = ''; return; }
        if (!cfg.enabled) { el.textContent = 'Sinkron otomatis nonaktif'; return; }
        if (K.isBusy()) { el.textContent = ''; return; }
        var left = Math.max(0, Math.ceil((K.nextAt() - Date.now()) / 1000));
        el.textContent = 'Sinkron berikutnya ' + left + ' dtk';
    }

    // ------------------------------------------------------------ tabel
    function flagCell(master, code) {
        var cc = String(master.countryCode || '').toLowerCase();
        var fallback = (master.countryCode || code).slice(0, 2).toUpperCase();
        return '<span class="kp-flag" title="' + esc(master.country || '') + '">' +
            (cc ? '<img src="https://flagcdn.com/w80/' + esc(cc) + '.png" alt="" loading="lazy">' : '') + esc(fallback) + '</span>';
    }

    function renderTable() {
        var root = ensure();
        if (!root) return;
        var tbody = $('currenciesTableBody');
        var all = getCurrencies();
        var masters = typeof getMasterCurrencies === 'function' ? getMasterCurrencies() : [];
        var fmt = typeof formatRate === 'function' ? formatRate : function (v) { return String(v); };
        var q = S.q.trim().toLowerCase();
        var audit = showAudit();

        var rows = all.map(function (c) {
            var code = String(c.code || '').toUpperCase();
            var base = typeof getCurrencyBaseCode === 'function' ? getCurrencyBaseCode(code) : code.slice(0, 3);
            var m = masters.find(function (x) { return x.code === code; }) || masters.find(function (x) { return x.code === base; }) || {};
            var derived = code.length > 3 && m.code === base;
            return { c: c, code: code, m: m, note: derived ? 'Turunan ' + base : (m.country || '-') };
        });
        var lowCount = rows.filter(function (r) { return (r.c.stock || 0) <= (r.c.alert || 0); }).length;
        $('kpCount').textContent = rows.length + ' valuta';
        var lowBtn = $('kpLow');
        lowBtn.textContent = 'Stok menipis (' + lowCount + ')';
        lowBtn.classList.toggle('on', S.low);

        rows = rows.filter(function (r) {
            if (S.low && (r.c.stock || 0) > (r.c.alert || 0)) return false;
            return !q || (r.code + ' ' + r.note + ' ' + (r.m.name || '')).toLowerCase().indexOf(q) >= 0;
        });

        var ini = companyInitials() ? ' (' + companyInitials() + ')' : '';
        if ($('kpBuyTh')) $('kpBuyTh').textContent = 'Kurs Beli' + ini;
        if ($('kpSellTh')) $('kpSellTh').textContent = 'Kurs Jual' + ini;
        var html;
        if (!rows.length) {
            html = '<tr><td colspan="10" class="kp-empty">' +
                (all.length ? 'Tidak ada valuta yang cocok dengan pencarian.' : 'Belum ada valuta. Klik "Tambah Valuta" untuk memulai.') + '</td></tr>';
        } else html = rows.map(function (r) {
            var c = r.c;
            var stock = Number(c.stock) || 0, alert = Number(c.alert) || 0;
            var low = stock <= alert;
            var trend = c.trend === 'up' ? '<span class="kp-up" title="Naik">▲</span>'
                : c.trend === 'down' ? '<span class="kp-dn" title="Turun">▼</span>' : '<span class="kp-flat">─</span>';
            var aud = audit && (c.inputBy || c.editBy)
                ? '<div class="kp-aud">' + (c.inputBy ? 'Input: ' + esc(c.inputBy) + '<br>' : '') + (c.editBy ? 'Edit: ' + esc(c.editBy) : '') + '</div>' : '';
            return '<tr>' +
                '<td><div class="kp-id">' + flagCell(r.m, r.code) + '<div><b>' + esc(c.code) + '</b><small>' + esc(r.note) + '</small></div></div></td>' +
                '<td class="c">' + trend + '</td>' +
                '<td class="r kp-num">' + fmt(baseOf(c, 'buy')) + '</td>' +
                '<td class="r kp-num">' + fmt(baseOf(c, 'sell')) + '</td>' +
                '<td class="r kp-num kp-res">' + fmt(c.buy) + '</td>' +
                '<td class="r kp-num kp-res">' + fmt(c.sell) + '</td>' +
                '<td class="r kp-num"' + (low ? ' style="color:var(--kp-bad)"' : '') + '>' + stock.toLocaleString('id-ID') +
                (low ? '<span class="kp-badge">' + (stock <= 0 ? 'Habis' : 'Menipis') + '</span>' : '') + '</td>' +
                '<td class="r" style="color:var(--kp-mut)">' + alert.toLocaleString('id-ID') + '</td>' +
                '<td><div class="kp-mg">B: <b class="b">' + esc(c.margin_buy || 0) + '</b><br>J: <b class="s">' + esc(c.margin_sell || 0) + '</b></div>' + aud + '</td>' +
                '<td><div class="kp-act">' +
                '<button type="button" class="kp-btn sm" data-act="edit" data-code="' + esc(c.code) + '"><i class="fa-solid fa-pen"></i> Edit</button>' +
                '<button type="button" class="kp-btn sm del" data-act="del" data-code="' + esc(c.code) + '" aria-label="Hapus ' + esc(c.code) + '"><i class="fa-solid fa-trash"></i></button>' +
                '</div></td></tr>';
        }).join('');
        // Jangan bangun ulang bila isi sama: tombol yang sedang ditekan tidak boleh diganti di tengah klik.
        if (tbody.__kpHtml !== html) { tbody.innerHTML = html; tbody.__kpHtml = html; }
    }

    // ------------------------------------------------------------ titik masuk (dipanggil navigasi, sync.js, form valuta)
    window.loadCurrencyTable = function () {
        if (!ensure()) return;
        try {
            var list = getCurrencies();
            if (typeof repairDerivedCurrencyRates === 'function' && repairDerivedCurrencyRates(list)) saveCurrencies(list);
        } catch (e) { /* abaikan */ }
        renderTable();
        paintSource();
        paintErr();
    };

    function start() {
        window.addEventListener('kurs-sync-change', function () {
            var root = $('kursMgrRoot');
            if (root && root.__kpReady) paintSource();
        });
        // Hitung mundur sinkron berikutnya; hanya bekerja bila halaman terlihat.
        S.timer = setInterval(function () {
            var root = $('kursMgrRoot');
            if (root && root.__kpReady && root.offsetParent !== null) paintNext();
        }, 1000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
