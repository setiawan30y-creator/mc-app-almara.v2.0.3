// @2026-Alifiandra
/* =====================================================================
 * 50-vision-key.js  —  Pengaturan API key Google Cloud Vision (Auto-Fill KTP)
 *
 *  - Tampil di Pengaturan > Profil, hanya untuk owner / superadmin / admin.
 *  - Key bersifat "tulis saja": disimpan terenkripsi di server (POST api/integrations/vision),
 *    tidak pernah dimuat kembali ke browser. Layar hanya menampilkan status dan 4 karakter terakhir.
 *  - Tombol Tes Koneksi memanggil server untuk menguji key ke Google (gambar 1x1 piksel,
 *    tanpa data nasabah) dan menerjemahkan hasilnya ke langkah perbaikan.
 *  - Membersihkan sisa key lama di localStorage / profil lokal (versi sebelumnya
 *    menyimpannya polos dan ikut tersinkron ke semua pengguna).
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcVisionKey) return;
    window.__mcVisionKey = true;

    var EDIT = { owner: 1, superadmin: 1, admin: 1 };
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var http = function (url, opt) { return (window.authFetch || window.fetch)(url, opt); };
    var S = { meta: null, busy: false, built: false };

    function role() {
        try { return String((JSON.parse(localStorage.getItem('mc_currentUser')) || {}).role || '').toLowerCase(); } catch (e) { return ''; }
    }

    /* ---- bersihkan sisa key lama di browser ---- */
    function scrubLegacy() {
        try {
            if (localStorage.getItem('mc_vision_api_key') !== null) localStorage.removeItem('mc_vision_api_key');
            var raw = localStorage.getItem('mc_profile');
            if (raw && raw.indexOf('visionKey') > -1) {
                var p = JSON.parse(raw);
                if (p && typeof p === 'object' && 'visionKey' in p) {
                    delete p.visionKey;
                    localStorage.setItem('mc_profile', JSON.stringify(p));
                }
            }
        } catch (e) { /* abaikan */ }
    }

    function injectStyle() {
        if ($('vk-style')) return;
        var st = document.createElement('style');
        st.id = 'vk-style';
        st.textContent = [
            '.vk{--vk-bd:var(--mc-border,rgba(148,163,184,.35));--vk-mut:var(--mc-text-muted,#94a3b8);--vk-inp:var(--mc-input-bg,rgba(15,23,42,.45));' +
                'border:1px solid var(--vk-bd);border-radius:14px;padding:16px 18px;max-width:720px}',
            '.vk-head{display:flex;gap:12px;align-items:flex-start}',
            '.vk-head>i{font-size:1.3rem;color:#10B981;margin-top:3px}',
            '.vk-head b{display:block;font-size:.98rem}',
            '.vk-head small{display:block;color:var(--vk-mut);line-height:1.45;margin-top:2px}',
            '.vk-badge{margin-left:auto;flex:none;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px;border:1px solid transparent;white-space:nowrap}',
            '.vk-badge.ok{background:rgba(34,197,94,.14);color:#4ade80;border-color:rgba(34,197,94,.35)}',
            '.vk-badge.env{background:rgba(59,130,246,.14);color:#60a5fa;border-color:rgba(59,130,246,.35)}',
            '.vk-badge.no{background:rgba(245,158,11,.14);color:#fbbf24;border-color:rgba(245,158,11,.35)}',
            '.vk-info{font-size:.84rem;color:var(--vk-mut);margin:12px 0 10px;line-height:1.5}',
            '.vk-info b{color:inherit;font-weight:700}',
            '.vk-row{display:flex;gap:8px}',
            '.vk-row input{flex:1;min-width:0;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.02em}',
            '.vk-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
            '.vk-actions .vk-danger{border-color:rgba(248,113,113,.5);color:#f87171}',
            '.vk-actions button[disabled]{opacity:.45;cursor:not-allowed}',
            '.vk-result{display:none;margin-top:12px;border-radius:10px;padding:10px 14px;font-size:.85rem;line-height:1.5;border:1px solid transparent}',
            '.vk-result.show{display:block}',
            '.vk-result.ok{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.35)}',
            '.vk-result.err{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.4)}',
            '.vk-result.warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.4)}',
            '.vk-result small{display:block;opacity:.7;margin-top:4px;overflow-wrap:anywhere}',
            '.vk-help{margin-top:12px;font-size:.84rem;color:var(--vk-mut)}',
            '.vk-help summary{cursor:pointer;font-weight:600}',
            '.vk-help ol{margin:8px 0 0 18px;padding:0;line-height:1.6}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function build(box) {
        injectStyle();
        box.innerHTML =
            '<div class="vk">' +
            '<div class="vk-head"><i class="fa-solid fa-id-card-clip"></i>' +
            '<div><b>Auto-Fill KTP (Google Cloud Vision)</b>' +
            '<small>API key dipakai server untuk membaca foto identitas. Key disimpan terenkripsi di server dan tidak ditampilkan kembali.</small></div>' +
            '<span class="vk-badge no" id="vkBadge">Memeriksa...</span></div>' +
            '<div class="vk-info" id="vkInfo"></div>' +
            '<div class="vk-row"><input type="password" id="vkInput" class="form-control" autocomplete="new-password" autocapitalize="off" autocorrect="off" ' +
            'spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="Tempel API key baru di sini">' +
            '<button type="button" class="btn btn-outline" id="vkEye" title="Tampilkan / sembunyikan" aria-label="Tampilkan atau sembunyikan key"><i class="fa-solid fa-eye"></i></button></div>' +
            '<div class="vk-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" id="vkSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Key</button>' +
            '<button type="button" class="btn btn-outline btn-sm" id="vkTest"><i class="fa-solid fa-plug-circle-check"></i> Tes Koneksi</button>' +
            '<button type="button" class="btn btn-outline btn-sm vk-danger" id="vkClear"><i class="fa-solid fa-trash"></i> Hapus Key</button></div>' +
            '<div class="vk-result" id="vkResult" role="status" aria-live="polite"></div>' +
            '<details class="vk-help"><summary>Cara mendapatkan API key</summary><ol>' +
            '<li>Buka Google Cloud Console, lalu buat atau pilih sebuah project.</li>' +
            '<li>Aktifkan <b>Cloud Vision API</b> dan pastikan <b>billing</b> project aktif.</li>' +
            '<li>Menu <b>APIs &amp; Services &rarr; Credentials &rarr; Create credentials &rarr; API key</b>.</li>' +
            '<li>Batasi key: <b>API restrictions</b> hanya Cloud Vision API (dan batasi ke alamat IP server bila IP-nya tetap).</li>' +
            '<li>Tempel key di kolom di atas, klik <b>Simpan Key</b>, lalu <b>Tes Koneksi</b>.</li></ol></details></div>';

        $('vkSave').addEventListener('click', save);
        $('vkTest').addEventListener('click', test);
        $('vkClear').addEventListener('click', clear);
        $('vkEye').addEventListener('click', function () {
            var i = $('vkInput');
            var show = i.type === 'password';
            i.type = show ? 'text' : 'password';
            this.firstElementChild.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        });
        $('vkInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
        S.built = true;
    }

    function result(kind, html) {
        var r = $('vkResult');
        if (!r) return;
        r.className = 'vk-result show ' + kind;
        r.innerHTML = html;
    }
    function clearResult() { var r = $('vkResult'); if (r) { r.className = 'vk-result'; r.innerHTML = ''; } }

    function render() {
        var m = S.meta;
        var badge = $('vkBadge'), info = $('vkInfo');
        if (!badge || !info) return;
        var inp = $('vkInput');
        if (!m) { badge.className = 'vk-badge no'; badge.textContent = 'Tidak diketahui'; info.textContent = 'Status belum bisa dimuat. Muat ulang halaman.'; return; }

        var when = m.updated_at ? new Date(m.updated_at) : null;
        var meta = (m.updated_by && when && !isNaN(when))
            ? ' Diatur oleh <b>' + esc(m.updated_by) + '</b> pada ' + esc(when.toLocaleString('id-ID')) + '.' : '';

        if (m.source === 'database') {
            badge.className = 'vk-badge ok'; badge.textContent = 'Aktif';
            info.innerHTML = 'Key tersimpan di server (berakhiran <b>&hellip;' + esc(m.last4) + '</b>).' + meta;
        } else if (m.source === 'env') {
            badge.className = 'vk-badge env'; badge.textContent = 'Dari file .env';
            info.innerHTML = 'Server memakai key dari file <b>.env</b> (berakhiran <b>&hellip;' + esc(m.last4) + '</b>). Menyimpan key di sini akan dipakai lebih dulu dan menimpanya.';
        } else {
            badge.className = 'vk-badge no'; badge.textContent = 'Belum diatur';
            info.innerHTML = 'Fitur Auto-Fill KTP <b>belum bisa dipakai</b> sampai API key diisi.';
        }
        if (m.unreadable) {
            info.innerHTML += '<br><b>Perhatian:</b> key yang tersimpan tidak bisa dibaca (kemungkinan APP_KEY server berubah). Masukkan key lagi.';
        }
        if (inp) inp.placeholder = m.source === 'database' ? 'Tempel key baru untuk mengganti' : 'Tempel API key di sini';
        $('vkClear').disabled = m.source !== 'database';
        $('vkTest').disabled = !m.configured;
    }

    function setBusy(b) {
        S.busy = b;
        ['vkSave', 'vkTest', 'vkClear'].forEach(function (id) { var el = $(id); if (el) el.disabled = b || (id === 'vkClear' && (!S.meta || S.meta.source !== 'database')) || (id === 'vkTest' && (!S.meta || !S.meta.configured)); });
    }

    function json(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); }

    function refresh() {
        return Promise.resolve(http('api/integrations/vision', { headers: { 'Accept': 'application/json' } }))
            .then(json)
            .then(function (x) { S.meta = (x.ok && x.j && x.j.status === 'success') ? x.j.data : null; render(); })
            .catch(function () { S.meta = null; render(); });
    }

    var HINT = {
        key_missing: ['warn', 'API key belum diatur.'],
        invalid_key: ['err', 'Google menolak key ini (tidak valid). Salin ulang key dari Google Cloud Console tanpa spasi.'],
        permission_denied: ['err', 'Key belum berizin memakai <b>Cloud Vision API</b>, atau dibatasi (pembatasan API / alamat IP). Aktifkan Cloud Vision API dan periksa pembatasan key.'],
        billing_not_enabled: ['warn', 'Billing project Google Cloud belum aktif. Aktifkan billing. Selama belum aktif, Auto-Fill memakai Gemini bila key Gemini diisi di tab Asisten AI.'],
        quota_exceeded: ['warn', 'Kuota Google Cloud Vision habis. Periksa kuota di Google Cloud Console.'],
        network_error: ['err', 'Server tidak dapat menghubungi Google. Periksa koneksi internet server.'],
        vision_rejected: ['err', 'Google menolak permintaan.']
    };

    function test(quiet) {
        if (S.busy) return Promise.resolve();
        setBusy(true);
        result('warn', '<i class="fa-solid fa-spinner fa-spin"></i> Menguji koneksi ke Google Cloud Vision...');
        return Promise.resolve(http('api/integrations/vision/test', { method: 'POST', headers: { 'Accept': 'application/json' } }))
            .then(json)
            .then(function (x) {
                if (x.ok && x.j.status === 'success') {
                    result('ok', '<i class="fa-solid fa-circle-check"></i> <b>Berhasil.</b> Auto-Fill KTP siap dipakai.');
                } else {
                    var h = HINT[x.j.error_type] || ['err', esc(x.j.message || 'Tes gagal.')];
                    result(h[0], '<i class="fa-solid fa-circle-exclamation"></i> ' + h[1] +
                        (x.j.message && x.j.error_type !== 'key_missing' ? '<small>Detail Google: ' + esc(x.j.message) + '</small>' : ''));
                }
            })
            .catch(function () { result('err', 'Tidak bisa menghubungi server aplikasi.'); })
            .then(function () { setBusy(false); });
    }

    function save() {
        if (S.busy) return;
        var inp = $('vkInput');
        var key = (inp.value || '').trim();
        if (!/^[A-Za-z0-9_\-]{20,128}$/.test(key)) {
            result('err', 'Format key tidak valid. Salin ulang key dari Google Cloud Console (tanpa spasi atau tanda kutip).');
            inp.focus();
            return;
        }
        setBusy(true);
        clearResult();
        Promise.resolve(http('api/integrations/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ api_key: key })
        })).then(json).then(function (x) {
            if (!x.ok || x.j.status !== 'success') {
                var msg = x.j.message || 'Gagal menyimpan.';
                if (x.j.errors) msg = Object.keys(x.j.errors).map(function (k) { return x.j.errors[k][0]; }).join(' ');
                throw new Error(msg);
            }
            inp.value = '';
            inp.type = 'password';
            S.meta = x.j.data; render();
            setBusy(false);
            return test();
        }).catch(function (e) {
            result('err', esc(e && e.message ? e.message : 'Gagal menyimpan.'));
            setBusy(false);
        });
    }

    function ask(title, text, yes) {
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            return Swal.fire({ icon: 'warning', title: title, text: text, showCancelButton: true, confirmButtonText: yes, cancelButtonText: 'Batal', reverseButtons: true, focusCancel: true })
                .then(function (r) { return !!r.isConfirmed; });
        }
        return Promise.resolve(window.confirm(title + '\n\n' + text));
    }

    function clear() {
        if (S.busy) return;
        ask('Hapus API key Vision?', 'Auto-Fill KTP tidak akan berfungsi sampai key diisi lagi (kecuali server masih punya key di file .env).', 'Ya, hapus').then(function (ok) {
            if (!ok) return;
            setBusy(true);
            Promise.resolve(http('api/integrations/vision', { method: 'DELETE', headers: { 'Accept': 'application/json' } }))
                .then(json)
                .then(function (x) {
                    if (!x.ok) throw new Error(x.j.message || 'Gagal menghapus.');
                    S.meta = x.j.data; render();
                    result('warn', 'Key dihapus dari database.');
                })
                .catch(function (e) { result('err', esc(e.message || 'Gagal menghapus.')); })
                .then(function () { setBusy(false); });
        });
    }

    function ensure() {
        var box = $('visionKeyBox');
        if (!box) return;
        if (!EDIT[role()]) { box.style.display = 'none'; return; }
        if (!S.built || !box.firstChild) { build(box); S.built = true; refresh(); }
        box.style.display = '';
    }

    function hookTab() {
        var orig = window.switchSettingsTab;
        if (typeof orig !== 'function' || window.__vkHooked) return;
        window.__vkHooked = true;
        window.switchSettingsTab = function (tab) {
            var r = orig.apply(this, arguments);
            if (tab === 'profile') { ensure(); if (S.built) refresh(); }
            return r;
        };
    }

    scrubLegacy();
    setInterval(function () { hookTab(); ensure(); scrubLegacy(); }, 2500);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hookTab(); ensure(); });
    else { hookTab(); ensure(); }
    window.addEventListener('load', function () { hookTab(); ensure(); });
})();
