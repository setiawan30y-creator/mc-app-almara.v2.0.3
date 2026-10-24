// @2026-Alifiandra
/* =====================================================================
 * 48-session-guard.js  —  Logout otomatis saat tidak aktif + pengaturannya
 *
 *  - Browser menghitung aktivitas nyata (klik, ketik, sentuh, gulir). Polling
 *    sinkronisasi di latar belakang TIDAK dihitung.
 *  - Satu menit sebelum batas, muncul peringatan dengan tombol "Tetap masuk".
 *  - Browser mengirim denyut ke server (POST api/session/ping, paling sering
 *    tiap 30 detik saat aktif). Server menolak sesi yang idle melewati batas,
 *    jadi penghitung di browser bukan satu-satunya pengaman.
 *  - Batas diatur di Pengaturan > Keamanan (owner, superadmin, admin) dan
 *    disimpan di server (kunci security_session_policy).
 *  - Password tidak pernah disimpan di browser; tidak ada login ulang otomatis.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcSessionGuard) return;
    window.__mcSessionGuard = true;

    var ACT_KEY = 'sess_last_activity';          // lokal saja (tidak berawalan mc_, tidak ikut sinkron)
    var FLAG_KEY = 'sess_idle_logout';
    var PING_EVERY = 30000;
    var POLICY_REFRESH = 300000;
    var EDIT_ROLES = { owner: 1, superadmin: 1, admin: 1 };

    var G = {
        idleMs: 0, warnMs: 60000, lastAct: Date.now(), lastPing: 0, pingBusy: false,
        loaded: false, loading: false, who: '', seen: '', tryAt: 0, policy: null, out: false, warned: false, lastLoad: 0
    };

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var http = function (url, opt) { return (window.authFetch || window.fetch)(url, opt); };

    function user() {
        try { return JSON.parse(localStorage.getItem('mc_currentUser')); } catch (e) { return null; }
    }
    function role() { var u = user(); return String((u && u.role) || '').toLowerCase(); }
    function guardOn() { return !!user() && !window.__MC_DEV_BYPASS; }

    /* ---------------- aktivitas & denyut ke server ---------------- */
    var lastWrite = 0;
    function touch(type) {
        if (G.out || !guardOn()) return;
        // Saat peringatan tampil, hanya tindakan sengaja yang membatalkan hitung mundur.
        if (G.warned && (type === 'mousemove' || type === 'scroll' || type === 'wheel')) return;
        var now = Date.now();
        G.lastAct = now;
        if (now - lastWrite > 5000) {
            lastWrite = now;
            try { localStorage.setItem(ACT_KEY, String(now)); } catch (e) { /* abaikan */ }
        }
        if (G.warned) hideWarn();
        if (now - G.lastPing >= PING_EVERY) ping();
    }

    function ping() {
        if (G.pingBusy || !guardOn()) return;
        G.pingBusy = true;
        G.lastPing = Date.now();
        var p;
        try { p = http('api/session/ping', { method: 'POST' }); } catch (e) { G.pingBusy = false; return; }
        Promise.resolve(p).catch(function () { /* jaringan putus: biarkan */ }).then(function () { G.pingBusy = false; });
    }

    var moveAt = 0;
    ['mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach(function (ev) {
        document.addEventListener(ev, function () { touch(ev); }, true);
    });
    ['mousemove', 'wheel'].forEach(function (ev) {
        document.addEventListener(ev, function () {
            var n = Date.now();
            if (n - moveAt < 1000) return;
            moveAt = n;
            touch(ev);
        }, { capture: true, passive: true });
    });
    document.addEventListener('scroll', function () {
        var n = Date.now();
        if (n - moveAt < 1000) return;
        moveAt = n;
        touch('scroll');
    }, { capture: true, passive: true });
    window.addEventListener('storage', function (e) {
        if (e.key !== ACT_KEY || !e.newValue) return;
        var t = parseInt(e.newValue, 10);
        if (t > G.lastAct) { G.lastAct = t; if (G.warned) hideWarn(); }
    });

    /* ---------------- kebijakan dari server ---------------- */
    function applyPolicy(d) {
        G.policy = d.policy || null;
        G.idleMs = Math.max(0, parseInt(d.effective_idle_seconds, 10) || 0) * 1000;
        var warn = Math.max(10, parseInt(d.warn_seconds, 10) || 60) * 1000;
        G.warnMs = G.idleMs ? Math.min(warn, Math.floor(G.idleMs / 2)) : warn;
        G.loaded = true;
    }

    function loadPolicy() {
        if (G.loading || !guardOn()) return Promise.resolve();
        G.loading = true;
        var u = user();
        return Promise.resolve(http('api/session-policy', { headers: { 'Accept': 'application/json' } }))
            .then(function (r) { return r && r.ok ? r.json() : null; })
            .then(function (j) {
                if (j && j.status === 'success' && j.data) {
                    applyPolicy(j.data);
                    G.who = u ? String(u.username || u.id || '') : '';
                    G.lastLoad = Date.now();
                }
            })
            .catch(function () { /* coba lagi pada siklus berikutnya */ })
            .then(function () { G.loading = false; });
    }

    /* ---------------- peringatan & logout ---------------- */
    function injectStyle() {
        if ($('sg-style')) return;
        var st = document.createElement('style');
        st.id = 'sg-style';
        st.textContent =
            '#sgWarn{position:fixed;right:20px;bottom:20px;z-index:100000;width:min(400px,calc(100vw - 32px));display:none;gap:12px;align-items:flex-start;' +
            'background:#1e293b;color:#f8fafc;border:1px solid #334155;border-left:4px solid #f59e0b;border-radius:12px;padding:14px 16px;box-shadow:0 12px 32px rgba(0,0,0,.45)}' +
            '#sgWarn.sg-show{display:flex}' +
            '#sgWarn .sg-ic{color:#f59e0b;font-size:1.25rem;line-height:1.3}' +
            '#sgWarn .sg-tx{flex:1;min-width:0;font-size:.88rem;line-height:1.45}' +
            '#sgWarn .sg-tx strong{display:block;font-size:.95rem;margin-bottom:2px}' +
            '#sgWarn .sg-tx b{font-variant-numeric:tabular-nums;color:#fbbf24}' +
            '#sgWarn .sg-bt{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}' +
            '#sgWarn button{border:0;border-radius:8px;padding:7px 12px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}' +
            '#sgWarn .sg-stay{background:#3b82f6;color:#fff}#sgWarn .sg-stay:hover{background:#2563eb}' +
            '#sgWarn .sg-out{background:transparent;color:#cbd5e1;border:1px solid #475569}#sgWarn .sg-out:hover{background:#334155}' +
            '.sg-switch{display:flex;gap:12px;align-items:flex-start;margin:6px 0 16px;cursor:pointer}' +
            '.sg-switch input{width:18px;height:18px;margin-top:3px;accent-color:#3b82f6;flex:none}' +
            '.sg-switch small{display:block;color:var(--mc-text-muted,#94a3b8);margin-top:2px}' +
            '.sg-chips{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}' +
            '.sg-chip{border:1px solid var(--mc-border,rgba(148,163,184,.45));background:transparent;color:var(--mc-text,inherit);border-radius:999px;padding:3px 11px;font-size:.78rem;cursor:pointer;font-family:inherit}' +
            '.sg-chip:hover{background:var(--mc-input-bg,rgba(148,163,184,.18))}.sg-chip.on{background:var(--mc-primary,#2563eb);border-color:var(--mc-primary,#2563eb);color:#fff}' +
            '.sg-note{display:flex;gap:10px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.3);color:var(--mc-text,inherit);border-radius:10px;padding:10px 14px;font-size:.84rem;margin:6px 0 4px;line-height:1.5}' +
            '.sg-note i{color:#38bdf8;margin-top:3px}' +
            '.sg-fields.off{opacity:.45}' +
            '#sgStatus{font-size:.8rem;margin-top:10px}';
        document.head.appendChild(st);
    }

    function ensureWarn() {
        var el = $('sgWarn');
        if (el) return el;
        injectStyle();
        el = document.createElement('div');
        el.id = 'sgWarn';
        el.setAttribute('role', 'alertdialog');
        el.setAttribute('aria-live', 'assertive');
        el.innerHTML =
            '<div class="sg-ic"><i class="fa-solid fa-hourglass-half"></i></div>' +
            '<div class="sg-tx"><strong>Sesi akan segera berakhir</strong>' +
            'Tidak ada aktivitas. Anda akan keluar otomatis dalam <b id="sgCount">1:00</b>.' +
            '<div class="sg-bt"><button type="button" class="sg-stay" id="sgStay">Tetap masuk</button>' +
            '<button type="button" class="sg-out" id="sgOut">Keluar sekarang</button></div></div>';
        document.body.appendChild(el);
        $('sgStay').addEventListener('click', function () {
            G.lastAct = Date.now();
            try { localStorage.setItem(ACT_KEY, String(G.lastAct)); } catch (e) { /* abaikan */ }
            hideWarn();
            G.lastPing = 0;
            ping();
        });
        $('sgOut').addEventListener('click', function () { logout('manual'); });
        return el;
    }

    function fmt(sec) {
        sec = Math.max(0, sec);
        return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
    }
    function showWarn(sec) {
        var el = ensureWarn();
        G.warned = true;
        el.classList.add('sg-show');
        var c = $('sgCount');
        if (c) c.textContent = fmt(sec);
    }
    function hideWarn() {
        G.warned = false;
        var el = $('sgWarn');
        if (el) el.classList.remove('sg-show');
    }

    function logout(reason) {
        if (G.out) return;
        G.out = true;
        hideWarn();
        if (reason === 'idle') { try { sessionStorage.setItem(FLAG_KEY, '1'); } catch (e) { /* abaikan */ } }
        var done = function () {
            try { if (typeof setCurrentUser === 'function') setCurrentUser(null); } catch (e) { /* abaikan */ }
            try { localStorage.removeItem('mc_currentUser'); } catch (e) { /* abaikan */ }
            window.location.reload();
        };
        var p;
        try { p = http('/logout', { method: 'POST' }); } catch (e) { done(); return; }
        Promise.resolve(p).catch(function () { /* sesi server mungkin sudah berakhir */ }).then(done);
    }

    function tick() {
        if (G.out) return;
        if (!guardOn()) { hideWarn(); G.loaded = false; G.who = ''; G.seen = ''; return; }

        var u = user();
        var who = u ? String(u.username || u.id || '') : '';
        if (who !== G.seen) { G.seen = who; G.loaded = false; G.lastAct = Date.now(); G.tryAt = 0; }
        var now = Date.now();
        if ((!G.loaded || now - G.lastLoad > POLICY_REFRESH) && now - G.tryAt > 15000) {
            G.tryAt = now;
            loadPolicy();
        }

        try {
            var shared = parseInt(localStorage.getItem(ACT_KEY) || '0', 10);
            if (shared > G.lastAct) G.lastAct = shared;
        } catch (e) { /* abaikan */ }

        if (!G.loaded || !G.idleMs) { hideWarn(); return; }

        var idle = Date.now() - G.lastAct;
        if (idle >= G.idleMs) { logout('idle'); return; }
        if (idle >= G.idleMs - G.warnMs) showWarn(Math.ceil((G.idleMs - idle) / 1000));
        else if (G.warned) hideWarn();
    }

    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });

    // Pesan di layar login setelah keluar otomatis.
    function showIdleNotice() {
        var flag = null;
        try { flag = sessionStorage.getItem(FLAG_KEY); } catch (e) { /* abaikan */ }
        if (!flag) return;
        var el = $('loginError');
        if (!el) return;
        try { sessionStorage.removeItem(FLAG_KEY); } catch (e) { /* abaikan */ }
        el.textContent = 'Anda keluar otomatis karena tidak ada aktivitas. Silakan login kembali.';
        el.style.display = 'block';
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showIdleNotice);
    else showIdleNotice();
    window.addEventListener('load', showIdleNotice);

    /* ---------------- pengaturan (owner / superadmin / admin) ---------------- */
    function tabHtml() {
        return '<h2><i class="fa-solid fa-shield-halved" style="color:#38bdf8;"></i> Keamanan Sesi</h2>' +
            '<hr class="divider mb-4">' +
            '<p class="text-muted" style="margin-bottom:14px;">Atur kapan pengguna keluar otomatis bila tidak ada aktivitas di layar (klik, ketik, sentuh). ' +
            'Sinkronisasi data di latar belakang tidak dihitung sebagai aktivitas.</p>' +
            '<label class="sg-switch"><input type="checkbox" id="sgEnabled"><span><b>Logout otomatis saat tidak aktif</b>' +
            '<small>Disarankan aktif, terutama untuk komputer kasir yang dipakai bergantian.</small></span></label>' +
            '<div class="sg-fields" id="sgFields"><div class="form-group row">' +
            '<div class="col-md-4"><label>Batas tidak aktif (menit)</label>' +
            '<input type="number" id="sgIdle" class="form-control" min="5" max="720" step="1" inputmode="numeric">' +
            '<small class="text-muted">5 sampai 720 menit. Berlaku untuk semua peran kecuali Kurir.</small>' +
            '<div class="sg-chips" data-for="sgIdle"><button type="button" class="sg-chip" data-v="15">15</button><button type="button" class="sg-chip" data-v="30">30</button>' +
            '<button type="button" class="sg-chip" data-v="60">60</button><button type="button" class="sg-chip" data-v="120">120</button></div></div>' +
            '<div class="col-md-4"><label>Batas untuk Kurir (menit)</label>' +
            '<input type="number" id="sgCourier" class="form-control" min="5" max="1440" step="1" inputmode="numeric">' +
            '<small class="text-muted">5 sampai 1440 menit. Kurir bekerja di lapangan sehingga bisa lebih panjang.</small>' +
            '<div class="sg-chips" data-for="sgCourier"><button type="button" class="sg-chip" data-v="240">240</button><button type="button" class="sg-chip" data-v="480">480</button>' +
            '<button type="button" class="sg-chip" data-v="720">720</button></div></div></div></div>' +
            '<div class="sg-note"><i class="fa-solid fa-circle-info"></i><div>Layar Papan Kurs tidak pernah keluar otomatis. ' +
            'Peringatan muncul 60 detik sebelum keluar. Perubahan berlaku di perangkat lain paling lambat 5 menit.</div></div>' +
            '<div id="sgStatus" class="text-muted"></div>' +
            '<button type="button" class="btn btn-primary mt-3" id="sgSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan Keamanan</button>';
    }

    function syncChips() {
        document.querySelectorAll('#settings-tab-security .sg-chips').forEach(function (box) {
            var inp = $(box.getAttribute('data-for'));
            box.querySelectorAll('.sg-chip').forEach(function (b) {
                b.classList.toggle('on', !!inp && String(inp.value) === b.getAttribute('data-v'));
            });
        });
    }
    function syncDim() {
        var f = $('sgFields'), c = $('sgEnabled');
        if (f && c) f.classList.toggle('off', !c.checked);
    }

    function fillForm() {
        var st = $('sgStatus');
        if (st) st.textContent = 'Memuat pengaturan...';
        return Promise.resolve(http('api/session-policy', { headers: { 'Accept': 'application/json' } }))
            .then(function (r) { return r && r.ok ? r.json() : null; })
            .then(function (j) {
                if (!j || j.status !== 'success') throw new Error('x');
                var p = j.data.policy || {};
                $('sgEnabled').checked = !!p.enabled;
                $('sgIdle').value = p.idle_minutes;
                $('sgCourier').value = p.courier_idle_minutes;
                syncChips(); syncDim();
                if (st) {
                    var when = p.updated_at ? new Date(p.updated_at) : null;
                    st.innerHTML = p.updated_by && when && !isNaN(when)
                        ? 'Terakhir diubah oleh <b>' + esc(p.updated_by) + '</b> pada ' + esc(when.toLocaleString('id-ID')) + '.'
                        : 'Memakai pengaturan bawaan (30 menit).';
                }
            })
            .catch(function () { if (st) st.textContent = 'Gagal memuat pengaturan. Muat ulang halaman.'; });
    }

    function notify(type, text) {
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            return Swal.fire({
                icon: type, title: type === 'success' ? 'Tersimpan' : 'Tidak bisa disimpan', text: text,
                timer: type === 'success' ? 1600 : undefined, showConfirmButton: type !== 'success',
            });
        }
        alert(text);
        return Promise.resolve();
    }

    function save() {
        var enabled = $('sgEnabled').checked;
        var idle = parseInt($('sgIdle').value, 10);
        var courier = parseInt($('sgCourier').value, 10);
        if (!(idle >= 5 && idle <= 720)) { notify('error', 'Batas tidak aktif harus antara 5 dan 720 menit.'); return; }
        if (!(courier >= 5 && courier <= 1440)) { notify('error', 'Batas Kurir harus antara 5 dan 1440 menit.'); return; }
        if (enabled) { submit(enabled, idle, courier); return; }
        askConfirm('Nonaktifkan logout otomatis?', 'Tanpa logout otomatis, pengguna yang meninggalkan komputer tetap masuk.', 'Ya, nonaktifkan')
            .then(function (ok) { if (ok) submit(enabled, idle, courier); });
    }

    function askConfirm(title, text, yes) {
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            return Swal.fire({
                icon: 'warning', title: title, text: text, showCancelButton: true,
                confirmButtonText: yes, cancelButtonText: 'Batal', reverseButtons: true, focusCancel: true
            }).then(function (r) { return !!r.isConfirmed; });
        }
        return Promise.resolve(window.confirm(title + '\n\n' + text));
    }

    function submit(enabled, idle, courier) {
        var btn = $('sgSave');
        if (btn) btn.disabled = true;
        http('api/session-policy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ enabled: enabled, idle_minutes: idle, courier_idle_minutes: courier })
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
        }).then(function (x) {
            if (!x.ok || x.j.status !== 'success') {
                var msg = (x.j && x.j.message) || 'Terjadi kesalahan di server.';
                if (x.j && x.j.errors) { msg = Object.keys(x.j.errors).map(function (k) { return x.j.errors[k][0]; }).join(' '); }
                throw new Error(msg);
            }
            applyPolicy(x.j.data);
            G.lastLoad = Date.now();
            G.lastAct = Date.now();
            return fillForm().then(function () { return notify('success', x.j.message || 'Pengaturan keamanan sesi tersimpan.'); });
        }).catch(function (e) {
            notify('error', e && e.message ? e.message : 'Gagal menyimpan.');
        }).then(function () { if (btn) btn.disabled = false; });
    }

    function ensureSettingsUi() {
        var ok = !!EDIT_ROLES[role()];
        var btn = $('btn-tab-settings-security');
        var panel = $('settings-tab-security');
        if (!ok) {
            if (btn) btn.remove();
            if (panel) panel.remove();
            return;
        }
        if (btn && panel) return;
        var anchorBtn = $('btn-tab-settings-users');
        var anchorPanel = $('settings-tab-users');
        if (!anchorBtn || !anchorPanel) return;
        injectStyle();

        btn = document.createElement('button');
        btn.className = 'btn btn-outline btn-sm settings-tab-btn';
        btn.id = 'btn-tab-settings-security';
        btn.type = 'button';
        btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Keamanan';
        btn.addEventListener('click', function () {
            if (typeof window.switchSettingsTab === 'function') window.switchSettingsTab('security');
        });
        anchorBtn.insertAdjacentElement('afterend', btn);

        panel = document.createElement('div');
        panel.className = 'panel mt-4 settings-tab-content hidden';
        panel.id = 'settings-tab-security';
        panel.style.display = 'none';
        panel.innerHTML = tabHtml();
        anchorPanel.insertAdjacentElement('afterend', panel);

        $('sgSave').addEventListener('click', save);
        $('sgEnabled').addEventListener('change', syncDim);
        panel.addEventListener('input', function (e) { if (e.target && /^sg(Idle|Courier)$/.test(e.target.id)) syncChips(); });
        panel.addEventListener('click', function (e) {
            var chip = e.target.closest && e.target.closest('.sg-chip');
            if (!chip) return;
            var inp = $(chip.parentNode.getAttribute('data-for'));
            if (inp) { inp.value = chip.getAttribute('data-v'); syncChips(); }
        });
    }

    function hookTab() {
        var orig = window.switchSettingsTab;
        if (typeof orig !== 'function' || window.__sgHooked) return;
        window.__sgHooked = true;
        window.switchSettingsTab = function (tab) {
            if (tab === 'security') ensureSettingsUi();
            var r = orig.apply(this, arguments);
            if (tab === 'security' && $('sgSave')) fillForm();
            return r;
        };
    }

    setInterval(function () { hookTab(); ensureSettingsUi(); }, 2000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hookTab(); ensureSettingsUi(); });
    else { hookTab(); ensureSettingsUi(); }
    window.addEventListener('load', function () { hookTab(); ensureSettingsUi(); });

    window.SessionGuard = {
        state: function () { return { idleMs: G.idleMs, warnMs: G.warnMs, loaded: G.loaded, warned: G.warned, idleFor: Date.now() - G.lastAct }; },
        reload: loadPolicy,
        _tick: tick
    };
})();
