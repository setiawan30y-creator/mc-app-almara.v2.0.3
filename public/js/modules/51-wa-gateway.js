// @2026-Alifiandra
/* =====================================================================
 * 51-wa-gateway.js  —  Pengaturan WA Gateway (untuk provider apa pun)
 *
 *  - Satu mesin generik: admin mengisi URL, header, dan payload dengan placeholder,
 *    server mengisi dan mengirim. Template siap pakai tersedia untuk beberapa provider;
 *    pilih "Kustom" untuk provider lain sesuai dokumentasinya.
 *  - Konfigurasi dan token disimpan di server (token terenkripsi, tidak pernah dimuat
 *    kembali ke browser). Tombol WhatsApp di seluruh aplikasi hanya mengirim nomor + pesan
 *    ke api/wa-gateway/send.
 *  - Tes kirim menampilkan request (token disamarkan) dan respons mentah provider,
 *    sehingga provider baru mudah disetel.
 *  - Mengekspos window.__waGwStatus ({enabled, configured, ready, provider}) untuk
 *    kasir (opsi "kirim WA otomatis") tanpa membuka rahasia apa pun.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcWaGateway) return;
    window.__mcWaGateway = true;

    var EDIT = { owner: 1, superadmin: 1, admin: 1 };
    var PRIV = { owner: 1, superadmin: 1 };
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var http = function (url, opt) { return (window.authFetch || window.fetch)(url, opt); };
    var S = { cfg: null, built: false, dirty: false, busy: false, clearToken: false, focus: 'wgPayload' };

    var PLACEHOLDERS = [
        ['{TARGET}', 'Nomor tujuan 6281234567890'],
        ['{TARGET_0}', 'Nomor tujuan 081234567890'],
        ['{TARGET_PLUS}', 'Nomor tujuan +6281234567890'],
        ['{CHAT_ID}', 'ID chat 6281234567890@c.us'],
        ['{MESSAGE}', 'Isi pesan'],
        ['{TOKEN}', 'Token / API key'],
        ['{TOKEN_BASE64}', 'Token dalam Base64 (untuk Basic Auth)'],
        ['{SENDER}', 'Nomor pengirim / device / instance / session'],
        ['{REFERENCE}', 'Referensi transaksi']
    ];

    var PRESETS = [
        {
            id: 'fonnte', name: 'Fonnte', endpoint: 'https://api.fonnte.com/send', method: 'POST', body_format: 'form',
            headers: '{"Authorization":"{TOKEN}"}', payload: '{"target":"{TARGET}","message":"{MESSAGE}"}',
            hint: 'Token: token device dari dashboard Fonnte. Nomor pengirim dikosongkan.'
        },
        {
            id: 'wablas', name: 'Wablas', endpoint: 'https://GANTI-DOMAIN.wablas.com/api/send-message', method: 'POST', body_format: 'form',
            headers: '{"Authorization":"{TOKEN}"}', payload: '{"phone":"{TARGET}","message":"{MESSAGE}"}',
            hint: 'Ganti GANTI-DOMAIN dengan domain server Wablas Anda. Token: token API Wablas (bila memakai secret key, tulis token.secret).'
        },
        {
            id: 'waha', name: 'WAHA (self-hosted)', endpoint: 'http://localhost:3000/api/sendText', method: 'POST', body_format: 'json',
            headers: '{"X-Api-Key":"{TOKEN}"}', payload: '{"session":"{SENDER}","chatId":"{CHAT_ID}","text":"{MESSAGE}"}',
            sender: 'default', allow_private: true,
            hint: 'Isi "Sender" dengan nama session (biasanya default). Token: API key WAHA, kosongkan bila WAHA tanpa key. Gateway di server/LAN sendiri: centang "Izinkan alamat jaringan lokal" di bagian Lanjutan.'
        },
        {
            id: 'ultramsg', name: 'UltraMsg', endpoint: 'https://api.ultramsg.com/{SENDER}/messages/chat', method: 'POST', body_format: 'form',
            headers: '{}', payload: '{"token":"{TOKEN}","to":"{TARGET}","body":"{MESSAGE}"}',
            hint: 'Isi "Sender" dengan Instance ID (mis. instance12345) dan Token dengan token instance.'
        },
        {
            id: 'meta', name: 'WhatsApp Cloud API (Meta)', endpoint: 'https://graph.facebook.com/v22.0/{SENDER}/messages', method: 'POST', body_format: 'json',
            headers: '{"Authorization":"Bearer {TOKEN}"}',
            payload: '{"messaging_product":"whatsapp","to":"{TARGET}","type":"text","text":{"body":"{MESSAGE}"}}',
            success_rule: 'json', success_path: 'messages.0.id',
            hint: 'Sender = Phone Number ID, Token = access token. Pesan teks bebas hanya diterima nasabah yang menghubungi Anda dalam 24 jam terakhir; di luar itu Meta mewajibkan template pesan terdaftar. Sesuaikan versi API (v22.0) dengan dokumentasi Meta.'
        },
        {
            id: 'custom', name: 'Kustom (provider lain)', endpoint: '', method: 'POST', body_format: 'form', headers: '', payload: '',
            hint: 'Salin URL, header, dan isi request dari dokumentasi provider Anda, lalu ganti nilai yang berubah-ubah dengan placeholder di bawah.'
        }
    ];

    function role() {
        try { return String((JSON.parse(localStorage.getItem('mc_currentUser')) || {}).role || '').toLowerCase(); } catch (e) { return ''; }
    }
    function loggedIn() { try { return !!JSON.parse(localStorage.getItem('mc_currentUser')); } catch (e) { return false; } }
    function json(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); }

    function scrubLegacy() {
        try { if (localStorage.getItem('mc_wa_gateway') !== null) localStorage.removeItem('mc_wa_gateway'); } catch (e) { /* abaikan */ }
    }

    /* ---------------- status untuk seluruh aplikasi ---------------- */
    function refreshStatus() {
        if (!loggedIn() || window.__MC_DEV_BYPASS_NO_STATUS) return Promise.resolve();
        return Promise.resolve(http('api/wa-gateway/status', { headers: { 'Accept': 'application/json' } }))
            .then(json)
            .then(function (x) {
                if (x.ok && x.j && x.j.status === 'success') {
                    window.__waGwStatus = x.j.data;
                    if (typeof window.updatePosWaGatewayOption === 'function') { try { window.updatePosWaGatewayOption(); } catch (e) { /* abaikan */ } }
                }
            })
            .catch(function () { /* abaikan */ });
    }

    /* ---------------- gaya ---------------- */
    function injectStyle() {
        if ($('wg-style')) return;
        var st = document.createElement('style');
        st.id = 'wg-style';
        st.textContent = [
            '.wg{--wg-bd:var(--mc-border,rgba(148,163,184,.35));--wg-mut:var(--mc-text-muted,#94a3b8);--wg-inp:var(--mc-input-bg,rgba(15,23,42,.45));--wg-pri:var(--mc-primary,#2563eb);display:grid;gap:16px}',
            '.wg-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}',
            '.wg-head h2{margin:0;font-size:1.2rem}.wg-head p{margin:4px 0 0;color:var(--wg-mut);font-size:.85rem;max-width:620px;line-height:1.5}',
            '.wg-badge{margin-left:auto;font-size:.74rem;font-weight:700;padding:4px 12px;border-radius:999px;border:1px solid transparent;white-space:nowrap}',
            '.wg-badge.on{background:rgba(34,197,94,.14);color:#4ade80;border-color:rgba(34,197,94,.35)}',
            '.wg-badge.off{background:rgba(148,163,184,.14);color:var(--wg-mut);border-color:var(--wg-bd)}',
            '.wg-badge.warn{background:rgba(245,158,11,.14);color:#fbbf24;border-color:rgba(245,158,11,.35)}',
            '.wg-card{border:1px solid var(--wg-bd);border-radius:14px;padding:16px 18px}',
            '.wg-card>h3{margin:0 0 12px;font-size:.95rem;display:flex;align-items:center;gap:8px}',
            '.wg-card>h3 span{display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--wg-pri);color:#fff;font-size:.74rem;align-items:center;justify-content:center;flex:none}',
            '.wg-switch{display:flex;gap:12px;align-items:flex-start;cursor:pointer}',
            '.wg-switch input{width:18px;height:18px;margin-top:3px;accent-color:var(--wg-pri);flex:none}',
            '.wg-switch small,.wg small,.wg .wg-help{color:var(--wg-mut);display:block;line-height:1.45}',
            '.wg-presets{display:flex;gap:8px;flex-wrap:wrap}',
            '.wg-pill{border:1px solid var(--wg-bd);background:transparent;color:inherit;border-radius:999px;padding:6px 14px;font-size:.84rem;cursor:pointer;font-family:inherit}',
            '.wg-pill:hover{background:var(--wg-inp)}.wg-pill.on{background:var(--wg-pri);border-color:var(--wg-pri);color:#fff}',
            '.wg-hint{margin-top:10px;font-size:.83rem;line-height:1.5;color:var(--wg-mut);border-left:3px solid var(--wg-pri);padding:2px 0 2px 10px}',
            '.wg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px 16px}',
            '.wg-grid .wide{grid-column:1/-1}',
            '.wg label.wg-l{display:block;font-size:.8rem;font-weight:600;margin:0 0 5px}',
            '.wg textarea{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem;line-height:1.5;min-height:92px;resize:vertical;white-space:pre}',
            '.wg-ph{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 2px}',
            '.wg-ph button{border:1px dashed var(--wg-bd);background:transparent;color:inherit;border-radius:8px;padding:3px 9px;font-size:.76rem;cursor:pointer;font-family:ui-monospace,Menlo,Consolas,monospace}',
            '.wg-ph button:hover{background:var(--wg-inp);border-style:solid}',
            '.wg-js{font-size:.76rem;margin-top:4px}.wg-js.ok{color:#4ade80}.wg-js.bad{color:#f87171}.wg-js.warn{color:#fbbf24}.wg-js.nil{color:var(--wg-mut)}',
            '.wg-tok{display:flex;gap:8px}.wg-tok input{flex:1;min-width:0}',
            '.wg-link{background:none;border:0;padding:0;color:#f87171;cursor:pointer;font-size:.78rem;text-decoration:underline;font-family:inherit}',
            '.wg details{margin-top:2px}.wg details>summary{cursor:pointer;font-weight:600;font-size:.9rem;padding:2px 0}',
            '.wg details .wg-grid{margin-top:12px}',
            '.wg-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
            '.wg-bar .wg-dirty{font-size:.8rem;color:#fbbf24;display:none}.wg-bar .wg-dirty.show{display:inline}',
            '.wg-test{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.wg-test>div{flex:1;min-width:220px;max-width:360px}',
            '.wg-res{display:none;margin-top:14px;border-radius:12px;padding:12px 14px;border:1px solid transparent;font-size:.86rem;line-height:1.5}',
            '.wg-res.show{display:block}.wg-res.ok{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.35)}',
            '.wg-res.bad{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.4)}.wg-res.warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.4)}',
            '.wg-res details{margin-top:8px}.wg-res summary{cursor:pointer;font-size:.8rem;color:var(--wg-mut)}',
            '.wg-res pre{margin:6px 0 0;padding:10px;border-radius:8px;background:var(--wg-inp);font-size:.76rem;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto}',
            '.wg-ro{border:1px solid var(--wg-bd);border-radius:14px;padding:16px 18px;max-width:640px}',
            '.wg .form-control{width:100%;box-sizing:border-box}.wg .wg-tok .form-control{width:auto}',
            '.wg button[disabled]{opacity:.5;cursor:not-allowed}'
        ].join('\n');
        document.head.appendChild(st);
    }

    /* ---------------- tampilan ---------------- */
    function buildReadOnly(root) {
        injectStyle();
        root.innerHTML = '<div class="wg"><div class="wg-head"><div><h2><i class="fa-solid fa-tower-broadcast" style="color:#25D366;"></i> WhatsApp Gateway</h2>' +
            '<p>Pengaturan WA Gateway hanya bisa diubah oleh owner, superadmin, atau admin.</p></div><span class="wg-badge off" id="wgBadgeRo">Memeriksa...</span></div>' +
            '<div class="wg-ro" id="wgRoInfo"></div></div>';
        refreshStatus().then(function () {
            var s = window.__waGwStatus || {};
            var b = $('wgBadgeRo'), i = $('wgRoInfo');
            if (!b || !i) return;
            b.className = 'wg-badge ' + (s.ready ? 'on' : 'off');
            b.textContent = s.ready ? 'Aktif' : 'Nonaktif';
            i.textContent = s.ready ? 'Tombol WhatsApp memakai gateway ' + (s.provider || 'yang telah diatur') + '.' : 'Tombol WhatsApp otomatis belum bisa dipakai. Hubungi owner/admin.';
        });
    }

    function build(root) {
        injectStyle();
        var pills = PRESETS.map(function (p) { return '<button type="button" class="wg-pill" data-preset="' + p.id + '">' + esc(p.name) + '</button>'; }).join('');
        var phs = PLACEHOLDERS.map(function (p) { return '<button type="button" data-ph="' + esc(p[0]) + '" title="' + esc(p[1]) + '">' + esc(p[0]) + '</button>'; }).join('');

        root.innerHTML =
            '<div class="wg">' +
            '<div class="wg-head"><div><h2><i class="fa-solid fa-tower-broadcast" style="color:#25D366;"></i> WhatsApp Gateway</h2>' +
            '<p>Hubungkan layanan WA Gateway mana pun yang punya API HTTP. Pilih template provider atau isi manual sesuai dokumentasinya. Token disimpan terenkripsi di server.</p></div>' +
            '<span class="wg-badge off" id="wgBadge">Memeriksa...</span></div>' +

            '<div class="wg-card"><label class="wg-switch"><input type="checkbox" id="wgEnabled"><span><b>Aktifkan WA Gateway</b>' +
            '<small>Semua tombol WhatsApp di aplikasi (struk, riwayat, nasabah, booking, dll.) akan mengirim lewat gateway ini.</small></span></label></div>' +

            '<div class="wg-card"><h3><span>1</span> Pilih provider</h3><div class="wg-presets" id="wgPresets">' + pills + '</div>' +
            '<div class="wg-hint" id="wgHint">Pilih template untuk mengisi URL, header, dan payload otomatis, atau "Kustom" untuk provider lain.</div></div>' +

            '<div class="wg-card"><h3><span>2</span> Koneksi</h3><div class="wg-grid">' +
            '<div><label class="wg-l" for="wgName">Nama gateway</label><input type="text" id="wgName" class="form-control" maxlength="60" placeholder="Nama provider"></div>' +
            '<div class="wide"><label class="wg-l" for="wgEndpoint">URL endpoint pengiriman</label><input type="text" id="wgEndpoint" class="form-control" maxlength="2048" spellcheck="false" placeholder="https://alamat-provider/api/kirim-pesan">' +
            '<small>Boleh memakai placeholder, mis. {SENDER} untuk instance/ID perangkat di dalam alamat.</small></div>' +
            '<div><label class="wg-l" for="wgToken">Token / API key</label><div class="wg-tok"><input type="password" id="wgToken" class="form-control" autocomplete="new-password" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore placeholder="Tempel token baru">' +
            '<button type="button" class="btn btn-outline" id="wgEye" title="Tampilkan / sembunyikan" aria-label="Tampilkan atau sembunyikan token"><i class="fa-solid fa-eye"></i></button></div>' +
            '<small id="wgTokInfo"></small></div>' +
            '<div><label class="wg-l" for="wgSender">Pengirim / Device / Instance / Session</label><input type="text" id="wgSender" class="form-control" maxlength="200" placeholder="Sesuai provider (boleh kosong)"><small>Dipakai pada placeholder {SENDER}.</small></div>' +
            '</div></div>' +

            '<div class="wg-card"><h3><span>3</span> Format request</h3><div class="wg-grid">' +
            '<div><label class="wg-l" for="wgMethod">Metode</label><select id="wgMethod" class="form-control"><option value="POST">POST</option><option value="GET">GET</option></select></div>' +
            '<div><label class="wg-l" for="wgFormat">Format isi (body)</label><select id="wgFormat" class="form-control"><option value="form">Form (x-www-form-urlencoded)</option><option value="json">JSON</option><option value="query">Query string di URL</option></select><small id="wgFormatNote"></small></div>' +
            '<div class="wide"><label class="wg-l" for="wgHeaders">Header (objek JSON)</label><textarea id="wgHeaders" class="form-control" rows="3" spellcheck="false" placeholder=\'{"Authorization":"{TOKEN}"}\'></textarea><div class="wg-js nil" id="wgHeadersJs"></div></div>' +
            '<div class="wide"><label class="wg-l" for="wgPayload">Payload / isi request (objek JSON)</label><textarea id="wgPayload" class="form-control" rows="6" spellcheck="false" placeholder=\'{"target":"{TARGET}","message":"{MESSAGE}"}\'></textarea><div class="wg-js nil" id="wgPayloadJs"></div>' +
            '<div class="wg-help" style="margin-top:8px;">Klik placeholder untuk menyisipkannya di kolom yang terakhir diklik:</div><div class="wg-ph" id="wgPh">' + phs + '</div></div>' +
            '</div></div>' +

            '<div class="wg-card"><details><summary>Lanjutan</summary><div class="wg-grid">' +
            '<div><label class="wg-l" for="wgRule">Cara menilai pengiriman berhasil</label><select id="wgRule" class="form-control">' +
            '<option value="auto">Otomatis (disarankan)</option><option value="http">Cukup HTTP 2xx</option><option value="json">Periksa kolom di respons JSON</option></select>' +
            '<small>Otomatis: HTTP 2xx dan tidak ada tanda gagal (status/success false, detail nomor ditolak).</small></div>' +
            '<div id="wgJsonRule" style="display:none"><label class="wg-l" for="wgPath">Kolom respons</label><input type="text" id="wgPath" class="form-control" maxlength="100" placeholder="mis. status atau messages.0.id">' +
            '<label class="wg-l" for="wgValue" style="margin-top:8px;">Nilai yang diharapkan</label><input type="text" id="wgValue" class="form-control" maxlength="100" placeholder="kosong = cukup ada isinya"></div>' +
            '<div class="wide"><label class="wg-switch"><input type="checkbox" id="wgPrivate"><span><b>Izinkan alamat jaringan lokal</b>' +
            '<small id="wgPrivateNote">Centang hanya jika gateway ada di server/LAN sendiri (mis. WAHA di localhost). Khusus owner/superadmin.</small></span></label></div>' +
            '</div></details></div>' +

            '<div class="wg-bar"><button type="button" class="btn btn-primary" id="wgSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan</button>' +
            '<span class="wg-dirty" id="wgDirty">Ada perubahan yang belum disimpan.</span></div>' +

            '<div class="wg-card"><h3><span>4</span> Tes kirim</h3><div class="wg-test">' +
            '<div><label class="wg-l" for="wgTestPhone">Nomor WhatsApp tujuan</label><input type="text" id="wgTestPhone" class="form-control" inputmode="tel" placeholder="Contoh: 081234567890"></div>' +
            '<button type="button" class="btn btn-success" id="wgTest"><i class="fa-solid fa-paper-plane"></i> Kirim Pesan Tes</button></div>' +
            '<small style="margin-top:8px;">Tes memakai pengaturan yang tersimpan (perubahan otomatis disimpan dulu). Hasilnya menampilkan request dan respons mentah provider.</small>' +
            '<div class="wg-res" id="wgRes" role="status" aria-live="polite"></div></div>' +
            '</div>';

        bind(root);
        S.built = true;
    }

    function bind(root) {
        root.addEventListener('input', function (e) {
            var id = e.target && e.target.id;
            if (!id || id === 'wgTestPhone') return;
            markDirty();
            if (id === 'wgHeaders' || id === 'wgPayload') validateJson();
        });
        root.addEventListener('change', function (e) {
            var id = e.target && e.target.id;
            if (!id || id === 'wgTestPhone') return;
            markDirty();
            if (id === 'wgMethod' || id === 'wgFormat') syncFormat();
            if (id === 'wgRule') syncRule();
        });
        root.addEventListener('focusin', function (e) {
            var id = e.target && e.target.id;
            if (id === 'wgEndpoint' || id === 'wgHeaders' || id === 'wgPayload' || id === 'wgSender') S.focus = id;
        });
        root.addEventListener('click', function (e) {
            var t = e.target.closest ? e.target.closest('button') : null;
            if (!t) return;
            if (t.getAttribute('data-preset')) applyPreset(t.getAttribute('data-preset'));
            else if (t.getAttribute('data-ph')) insertPlaceholder(t.getAttribute('data-ph'));
            else if (t.id === 'wgSave') save();
            else if (t.id === 'wgTest') test();
            else if (t.id === 'wgEye') {
                var i = $('wgToken'); var show = i.type === 'password';
                i.type = show ? 'text' : 'password';
                t.firstElementChild.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            } else if (t.id === 'wgClearTok') { S.clearToken = !S.clearToken; markDirty(); renderTokenInfo(); }
        });
    }

    function markDirty() {
        S.dirty = true;
        var d = $('wgDirty'); if (d) d.classList.add('show');
    }
    function clearDirty() {
        S.dirty = false;
        var d = $('wgDirty'); if (d) d.classList.remove('show');
    }

    function renderBadge() {
        var b = $('wgBadge'); if (!b || !S.cfg) return;
        var c = S.cfg;
        if (c.enabled && c.configured) { b.className = 'wg-badge on'; b.textContent = 'Aktif'; }
        else if (c.enabled && !c.configured) { b.className = 'wg-badge warn'; b.textContent = 'Belum lengkap'; }
        else { b.className = 'wg-badge off'; b.textContent = 'Nonaktif'; }
    }

    function renderTokenInfo() {
        var el = $('wgTokInfo'); if (!el || !S.cfg) return;
        var c = S.cfg;
        var html;
        if (S.clearToken) html = 'Token tersimpan akan <b>dihapus</b> saat Anda menyimpan. <button type="button" class="wg-link" id="wgClearTok" style="color:inherit">Batalkan</button>';
        else if (c.token_unreadable) html = '<b>Perhatian:</b> token tersimpan tidak bisa dibaca (APP_KEY server berubah). Masukkan token lagi.';
        else if (c.token_set) html = 'Token tersimpan (berakhiran <b>&hellip;' + esc(c.token_last4) + '</b>). Kosongkan kolom untuk mempertahankan. <button type="button" class="wg-link" id="wgClearTok">Hapus token</button>';
        else html = 'Belum ada token. Boleh kosong bila gateway Anda tidak memerlukan token.';
        el.innerHTML = html;
    }

    function fill(c) {
        $('wgEnabled').checked = !!c.enabled;
        $('wgName').value = c.provider || '';
        $('wgEndpoint').value = c.endpoint || '';
        $('wgSender').value = c.sender || '';
        $('wgMethod').value = c.method || 'POST';
        $('wgFormat').value = c.body_format || 'form';
        $('wgHeaders').value = c.headers || '';
        $('wgPayload').value = c.payload || '';
        $('wgRule').value = c.success_rule || 'auto';
        $('wgPath').value = c.success_path || '';
        $('wgValue').value = c.success_value || '';
        $('wgPrivate').checked = !!c.allow_private;
        $('wgToken').value = '';
        $('wgToken').type = 'password';
        var canPriv = !!PRIV[role()];
        $('wgPrivate').disabled = !canPriv;
        $('wgPrivateNote').textContent = canPriv
            ? 'Centang hanya jika gateway ada di server/LAN sendiri (mis. WAHA di localhost). Khusus owner/superadmin.'
            : 'Hanya owner atau superadmin yang dapat mengubah pengaturan ini.';
        // tandai template yang cocok dengan nama
        var match = PRESETS.filter(function (p) { return p.name.toLowerCase().indexOf(String(c.provider || '').toLowerCase()) === 0 && c.provider; })[0];
        markPreset(match ? match.id : '');
        S.clearToken = false;
        syncFormat(); syncRule(); validateJson(); renderBadge(); renderTokenInfo();
        clearDirty();
    }

    function markPreset(id) {
        document.querySelectorAll('#wgPresets .wg-pill').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-preset') === id); });
        var p = PRESETS.filter(function (x) { return x.id === id; })[0];
        var h = $('wgHint');
        if (h) h.textContent = p ? p.hint : 'Pilih template untuk mengisi URL, header, dan payload otomatis, atau "Kustom" untuk provider lain.';
    }

    function syncFormat() {
        var get = $('wgMethod').value === 'GET';
        var f = $('wgFormat');
        f.disabled = get;
        $('wgFormatNote').textContent = get ? 'Metode GET mengirim payload sebagai query string.' : '';
    }
    function syncRule() { $('wgJsonRule').style.display = $('wgRule').value === 'json' ? '' : 'none'; }

    function applyPreset(id) {
        var p = PRESETS.filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        var has = ($('wgEndpoint').value || '').trim() !== '' || ($('wgPayload').value || '').trim() !== '';
        var go = function () {
            $('wgName').value = id === 'custom' ? ($('wgName').value || '') : p.name.replace(/ \(.*\)$/, '');
            $('wgEndpoint').value = p.endpoint;
            $('wgMethod').value = p.method;
            $('wgFormat').value = p.body_format;
            $('wgHeaders').value = p.headers;
            $('wgPayload').value = p.payload;
            $('wgSender').value = p.sender || '';
            $('wgRule').value = p.success_rule || 'auto';
            $('wgPath').value = p.success_path || '';
            $('wgValue').value = '';
            if (p.allow_private && PRIV[role()]) $('wgPrivate').checked = true;
            markPreset(id); syncFormat(); syncRule(); validateJson(); markDirty();
        };
        if (!has) { go(); return; }
        ask('Pakai template ' + p.name + '?', 'URL, header, dan payload yang sekarang akan diganti. Token yang tersimpan tidak berubah.', 'Ya, ganti').then(function (ok) { if (ok) go(); });
    }

    function insertPlaceholder(ph) {
        var el = $(S.focus) || $('wgPayload');
        el.focus();
        var s = el.selectionStart != null ? el.selectionStart : el.value.length;
        var e = el.selectionEnd != null ? el.selectionEnd : s;
        el.value = el.value.slice(0, s) + ph + el.value.slice(e);
        el.selectionStart = el.selectionEnd = s + ph.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function checkJson(id, outId, needMsg) {
        var v = ($(id).value || '').trim(), out = $(outId);
        if (!v) { out.className = 'wg-js nil'; out.textContent = needMsg ? 'Kosong: memakai isi bawaan (target + message).' : 'Kosong: memakai Authorization: {TOKEN} bila token diisi.'; return true; }
        try {
            var o = JSON.parse(v);
            if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('harus berupa objek { ... }');
            var msgs = [];
            if (needMsg) {
                if (v.indexOf('{MESSAGE}') < 0) msgs.push('belum ada {MESSAGE}');
                if (!/\{(TARGET|TARGET_0|TARGET_PLUS|CHAT_ID)\}/.test(v)) msgs.push('belum ada placeholder nomor tujuan');
            }
            out.className = 'wg-js ' + (msgs.length ? 'warn' : 'ok');
            out.textContent = msgs.length ? 'JSON valid, tetapi ' + msgs.join(' dan ') + '.' : 'JSON valid.';
            return true;
        } catch (e) {
            out.className = 'wg-js bad';
            out.textContent = 'JSON tidak valid: ' + e.message;
            return false;
        }
    }
    function validateJson() { var a = checkJson('wgHeaders', 'wgHeadersJs', false); var b = checkJson('wgPayload', 'wgPayloadJs', true); return a && b; }

    function ask(title, text, yes) {
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            return Swal.fire({ icon: 'question', title: title, text: text, showCancelButton: true, confirmButtonText: yes, cancelButtonText: 'Batal', reverseButtons: true })
                .then(function (r) { return !!r.isConfirmed; });
        }
        return Promise.resolve(window.confirm(title + '\n\n' + text));
    }
    function notify(type, text) {
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            return Swal.fire({ icon: type, title: type === 'success' ? 'Tersimpan' : 'Tidak bisa disimpan', text: text, timer: type === 'success' ? 1500 : undefined, showConfirmButton: type !== 'success' });
        }
        alert(text);
        return Promise.resolve();
    }

    /* ---------------- simpan & muat ---------------- */
    function load() {
        var root = $('waGwRoot');
        if (!root) return Promise.resolve();
        if (!EDIT[role()]) { if (!root.__ro) { buildReadOnly(root); root.__ro = true; } else refreshStatus(); return Promise.resolve(); }
        if (!S.built || !$('wgSave')) build(root);
        return Promise.resolve(http('api/wa-gateway', { headers: { 'Accept': 'application/json' } }))
            .then(json)
            .then(function (x) {
                if (!x.ok || x.j.status !== 'success') throw new Error('x');
                S.cfg = x.j.data; fill(S.cfg);
            })
            .catch(function () { var b = $('wgBadge'); if (b) { b.className = 'wg-badge warn'; b.textContent = 'Gagal memuat'; } });
    }

    function body() {
        return {
            enabled: $('wgEnabled').checked,
            provider: $('wgName').value.trim(),
            endpoint: $('wgEndpoint').value.trim(),
            method: $('wgMethod').value,
            body_format: $('wgFormat').value,
            headers: $('wgHeaders').value.trim(),
            payload: $('wgPayload').value.trim(),
            sender: $('wgSender').value.trim(),
            token: $('wgToken').value.trim(),
            clear_token: S.clearToken,
            success_rule: $('wgRule').value,
            success_path: $('wgPath').value.trim(),
            success_value: $('wgValue').value.trim(),
            allow_private: $('wgPrivate').checked
        };
    }

    function save(silent) {
        if (S.busy) return Promise.resolve(false);
        if (!validateJson()) { notify('error', 'Header atau payload belum berupa objek JSON yang valid.'); return Promise.resolve(false); }
        var b = body();
        if (b.enabled && !b.endpoint) { notify('error', 'URL endpoint wajib diisi untuk mengaktifkan WA Gateway.'); $('wgEndpoint').focus(); return Promise.resolve(false); }
        S.busy = true; $('wgSave').disabled = true;
        return Promise.resolve(http('api/wa-gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(b) }))
            .then(json)
            .then(function (x) {
                if (!x.ok || x.j.status !== 'success') {
                    var msg = x.j.message || 'Gagal menyimpan.';
                    if (x.j.errors) msg = Object.keys(x.j.errors).map(function (k) { return x.j.errors[k][0]; }).join(' ');
                    throw new Error(msg);
                }
                S.cfg = x.j.data; fill(S.cfg); refreshStatus();
                if (!silent) notify('success', x.j.message || 'Pengaturan WA Gateway tersimpan.');
                return true;
            })
            .catch(function (e) { notify('error', e && e.message ? e.message : 'Gagal menyimpan.'); return false; })
            .then(function (ok) { S.busy = false; var s = $('wgSave'); if (s) s.disabled = false; return ok; });
    }

    function result(kind, html) { var r = $('wgRes'); r.className = 'wg-res show ' + kind; r.innerHTML = html; }

    function test() {
        var phone = ($('wgTestPhone').value || '').trim();
        if (!phone) { result('warn', 'Masukkan nomor WhatsApp tujuan untuk pesan tes.'); $('wgTestPhone').focus(); return; }
        var go = S.dirty ? save(true) : Promise.resolve(true);
        go.then(function (ok) {
            if (!ok) return;
            var btn = $('wgTest'); btn.disabled = true;
            result('warn', '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim pesan tes...');
            return Promise.resolve(http('api/wa-gateway/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ target: phone }) }))
                .then(json)
                .then(function (x) {
                    var j = x.j || {}, good = x.ok && j.status === 'success';
                    var html = '<b>' + (good ? '<i class="fa-solid fa-circle-check"></i> Diterima gateway.' : '<i class="fa-solid fa-circle-exclamation"></i> Gagal.') + '</b> ' + esc(j.message || '');
                    if (good) html += '<br><small>Periksa HP tujuan. "Diterima gateway" berarti provider menerima permintaan; pengiriman ke WhatsApp mengikuti status perangkat/akun provider.</small>';
                    if (j.request && j.request.method) {
                        html += '<details><summary>Request yang dikirim (token disamarkan)</summary><pre>' + esc(j.request.method + ' ' + j.request.url + '\nFormat: ' + j.request.body_format + '\nHeader: ' + JSON.stringify(j.request.headers, null, 2) + '\nIsi: ' + JSON.stringify(j.request.payload, null, 2)) + '</pre></details>';
                    }
                    if (j.response && j.response.status) {
                        html += '<details' + (good ? '' : ' open') + '><summary>Respons provider (HTTP ' + esc(j.response.status) + ')</summary><pre>' + esc(j.response.body || '(kosong)') + '</pre></details>';
                    }
                    result(good ? 'ok' : 'bad', html);
                })
                .catch(function () { result('bad', 'Tidak bisa menghubungi server aplikasi.'); })
                .then(function () { btn.disabled = false; });
        });
    }

    /* ---------------- pemasangan ---------------- */
    function ensure() {
        var root = $('waGwRoot');
        if (!root || !loggedIn()) return;
        if (!root.__init) { root.__init = true; load(); }
    }
    function hookTab() {
        var orig = window.switchSettingsTab;
        if (typeof orig !== 'function' || window.__wgHooked) return;
        window.__wgHooked = true;
        window.switchSettingsTab = function (tab) {
            var r = orig.apply(this, arguments);
            if (tab === 'wa-gateway' && !S.dirty) load();
            return r;
        };
    }

    window.loadWaGatewaySettings = function () { if (!S.dirty) return load(); };
    window.WaGatewayUI = { status: function () { return window.__waGwStatus || null; }, refresh: refreshStatus };

    scrubLegacy();
    setInterval(function () { hookTab(); ensure(); scrubLegacy(); }, 2500);
    setInterval(refreshStatus, 120000);
    var boot = function () { hookTab(); ensure(); refreshStatus(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    window.addEventListener('load', boot);
})();
