// @2026-Alifiandra
/* =====================================================================
 * 54-login-page-settings.js  —  Pengaturan > Halaman Login
 *  - Nama perusahaan, logo, teks sisi merek, teks form, motif valas, gambar latar opsional.
 *  - Disimpan di server (dapat dibaca halaman login tanpa login).
 *  - Warna TIDAK diatur di sini: halaman login mengikuti Pengaturan > Tema
 *    (warna utama, utama hover, sekunder). Panel ini hanya menampilkan warna yang dipakai.
 *  - Pratinjau memuat halaman login asli (/login?preview=1) sehingga yang terlihat = hasil nyata.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcLoginPageUI) return;
    window.__mcLoginPageUI = true;

    var EDIT = { owner: 1, superadmin: 1, admin: 1 };
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var http = function (url, opt) { return (window.authFetch || window.fetch)(url, opt); };
    var S = { built: false, data: null, dirty: false, busy: false };

    function role() { try { return String((JSON.parse(localStorage.getItem('mc_currentUser')) || {}).role || '').toLowerCase(); } catch (e) { return ''; } }
    function json(r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); }

    function say(type, text) {
        if (typeof Swal !== 'undefined' && Swal.fire) {
            return Swal.fire({ icon: type, title: type === 'success' ? 'Tersimpan' : 'Belum bisa disimpan', text: text, timer: type === 'success' ? 1600 : undefined, showConfirmButton: type !== 'success' });
        }
        alert(text); return Promise.resolve();
    }
    function ask(title, text, yes) {
        if (typeof Swal !== 'undefined' && Swal.fire) {
            return Swal.fire({ icon: 'question', title: title, text: text, showCancelButton: true, confirmButtonText: yes, cancelButtonText: 'Batal', reverseButtons: true }).then(function (r) { return !!r.isConfirmed; });
        }
        return Promise.resolve(window.confirm(title + '\n\n' + text));
    }

    function injectStyle() {
        if ($('lp-style')) return;
        var st = document.createElement('style');
        st.id = 'lp-style';
        st.textContent = [
            '.lp{--lp-bd:var(--mc-border,rgba(148,163,184,.35));--lp-mut:var(--mc-text-muted,#94a3b8);--lp-inp:var(--mc-input-bg,rgba(15,23,42,.45));--lp-pri:var(--mc-primary,#2563eb);display:grid;gap:16px}',
            '.lp-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.lp-head h2{margin:0;font-size:1.2rem}',
            '.lp-head p{margin:4px 0 0;color:var(--lp-mut);font-size:.85rem;max-width:640px;line-height:1.5}',
            '.lp-head .lp-top{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}',
            '.lp-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:16px;align-items:start}',
            '@media(max-width:1100px){.lp-layout{grid-template-columns:1fr}}',
            '.lp-col{display:grid;gap:16px}',
            '.lp-card{border:1px solid var(--lp-bd);border-radius:14px;padding:16px 18px}',
            '.lp-card>h3{margin:0 0 4px;font-size:.95rem}.lp-card>p{margin:0 0 14px;color:var(--lp-mut);font-size:.8rem;line-height:1.45}',
            '.lp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px 16px}.lp-grid .wide{grid-column:1/-1}',
            '.lp label.lp-l{display:block;font-size:.8rem;font-weight:600;margin:0 0 5px}',
            '.lp .form-control{width:100%;box-sizing:border-box}',
            '.lp small,.lp .lp-help{display:block;color:var(--lp-mut);font-size:.78rem;line-height:1.45;margin-top:4px}',
            '.lp-asset{display:flex;gap:14px;align-items:center;flex-wrap:wrap}',
            '.lp-thumb{width:84px;height:84px;border:1px dashed var(--lp-bd);border-radius:12px;display:grid;place-items:center;overflow:hidden;background:var(--lp-inp);color:var(--lp-mut);font-size:.72rem;text-align:center;flex:none}',
            '.lp-thumb.bg{width:150px;height:84px}.lp-thumb img{width:100%;height:100%;object-fit:contain}.lp-thumb.bg img{object-fit:cover}',
            '.lp-btns{display:flex;gap:8px;flex-wrap:wrap}',
            '.lp-switch{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.lp-switch input{margin-top:3px;accent-color:var(--lp-pri)}',
            '.lp-sw{display:flex;gap:10px;flex-wrap:wrap}.lp-sw div{display:flex;align-items:center;gap:8px;font-size:.8rem;border:1px solid var(--lp-bd);border-radius:10px;padding:6px 10px}',
            '.lp-sw i{width:22px;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.15);display:inline-block}',
            '.lp-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.lp-dirty{font-size:.8rem;color:#fbbf24;display:none}.lp-dirty.show{display:inline}',
            '.lp-prev{position:sticky;top:12px}',
            '.lp-frame{border:1px solid var(--lp-bd);border-radius:12px;overflow:hidden;background:#fff;position:relative}',
            '.lp-frame iframe{border:0;width:1280px;height:760px;transform-origin:0 0;display:block;pointer-events:none}',
            '.lp button[disabled]{opacity:.5;cursor:not-allowed}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function build(root) {
        injectStyle();
        var feat = [0, 1, 2, 3].map(function (i) {
            return '<div class="wide"><label class="lp-l" for="lpF' + i + '">Poin keunggulan ' + (i + 1) + '</label><input type="text" id="lpF' + i + '" class="form-control" maxlength="90" data-f="' + i + '"></div>';
        }).join('');
        root.innerHTML =
            '<div class="lp">' +
            '<div class="lp-head"><div><h2><i class="fa-solid fa-right-to-bracket"></i> Halaman Login</h2>' +
            '<p>Atur nama, logo, dan kata-kata pada halaman login. Warna halaman login mengikuti Pengaturan Tema.</p></div>' +
            '<div class="lp-top"><a class="btn btn-outline btn-sm" href="/settings/theme" target="_blank" rel="noopener"><i class="fa-solid fa-palette"></i> Atur warna di Tema</a>' +
            '<a class="btn btn-outline btn-sm" href="/login?preview=1" target="_blank" rel="noopener"><i class="fa-solid fa-up-right-from-square"></i> Buka pratinjau</a></div></div>' +

            '<div class="lp-layout"><div class="lp-col">' +

            '<div class="lp-card"><h3>Identitas</h3><p>Tampil di sudut kiri atas halaman login dan pada judul tab browser.</p><div class="lp-grid">' +
            '<div class="wide"><label class="lp-l" for="lpName">Nama perusahaan</label><input type="text" id="lpName" class="form-control" maxlength="120" placeholder="Nama perusahaan">' +
            '<small id="lpNameHint"></small></div>' +
            '<div class="wide"><label class="lp-l">Logo</label><div class="lp-asset"><div class="lp-thumb" id="lpLogoThumb">Belum ada logo</div>' +
            '<div><div class="lp-btns"><button type="button" class="btn btn-outline btn-sm" data-act="up-logo"><i class="fa-solid fa-upload"></i> Unggah logo</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-act="del-logo" id="lpDelLogo"><i class="fa-solid fa-trash"></i> Hapus</button></div>' +
            '<small>PNG, JPG, atau WebP, maksimal 1 MB. Disarankan persegi dengan latar putih atau transparan. Bila kosong, tampil inisial nama perusahaan.</small></div></div>' +
            '<input type="file" id="lpFileLogo" accept="image/png,image/jpeg,image/webp" hidden></div>' +
            '</div></div>' +

            '<div class="lp-card"><h3>Kata-kata sisi kiri</h3><p>Pesan utama yang dilihat pengguna sebelum masuk.</p><div class="lp-grid">' +
            '<div class="wide"><label class="lp-l" for="lpHeadline">Judul</label><input type="text" id="lpHeadline" class="form-control" maxlength="140"></div>' +
            '<div class="wide"><label class="lp-l" for="lpDesc">Penjelasan singkat</label><textarea id="lpDesc" class="form-control" rows="2" maxlength="260"></textarea></div>' +
            feat + '</div><small>Kosongkan poin yang tidak dipakai.</small></div>' +

            '<div class="lp-card"><h3>Kata-kata form login</h3><p>Teks di sisi kanan, dekat kolom username dan password.</p><div class="lp-grid">' +
            '<div class="wide"><label class="lp-l" for="lpWTitle">Judul form</label><input type="text" id="lpWTitle" class="form-control" maxlength="80"></div>' +
            '<div class="wide"><label class="lp-l" for="lpWDesc">Kalimat pembuka</label><input type="text" id="lpWDesc" class="form-control" maxlength="200"><small>Tulis {nama} untuk menyisipkan nama perusahaan.</small></div>' +
            '<div><label class="lp-l" for="lpBtn">Tulisan tombol</label><input type="text" id="lpBtn" class="form-control" maxlength="30"></div>' +
            '<div class="wide"><label class="lp-l" for="lpNote">Catatan keamanan (di bawah tombol)</label><input type="text" id="lpNote" class="form-control" maxlength="200"></div>' +
            '</div></div>' +

            '<div class="lp-card"><h3>Latar</h3><p>Motif valas bawaan sudah menjadi latar sisi kiri. Gambar latar sendiri bersifat opsional.</p><div class="lp-grid">' +
            '<div class="wide"><label class="lp-switch"><input type="checkbox" id="lpArt"><span><b>Tampilkan motif valas</b><small>Pola guilloche seperti pengaman uang kertas, simbol mata uang, dan pita kode mata uang.</small></span></label></div>' +
            '<div class="wide"><label class="lp-l">Gambar latar (opsional)</label><div class="lp-asset"><div class="lp-thumb bg" id="lpBgThumb">Belum ada</div>' +
            '<div><div class="lp-btns"><button type="button" class="btn btn-outline btn-sm" data-act="up-bg"><i class="fa-solid fa-upload"></i> Unggah gambar</button>' +
            '<button type="button" class="btn btn-outline btn-sm" data-act="del-bg" id="lpDelBg"><i class="fa-solid fa-trash"></i> Hapus</button></div>' +
            '<small>PNG, JPG, atau WebP, maksimal 3 MB. Otomatis diberi lapisan warna tema agar teks tetap terbaca.</small></div></div>' +
            '<input type="file" id="lpFileBg" accept="image/png,image/jpeg,image/webp" hidden></div>' +
            '</div></div>' +

            '<div class="lp-card"><h3>Warna yang dipakai</h3><p>Diambil dari Pengaturan &gt; Tema. Ubah di sana agar warna aplikasi dan halaman login tetap serasi.</p><div class="lp-sw" id="lpSw"></div></div>' +

            '<div class="lp-bar"><button type="button" class="btn btn-primary" data-act="save" id="lpSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan</button>' +
            '<button type="button" class="btn btn-secondary" data-act="reset"><i class="fa-solid fa-rotate-left"></i> Isi ulang dengan teks bawaan</button>' +
            '<span class="lp-dirty" id="lpDirty">Ada perubahan yang belum disimpan.</span></div>' +
            '</div>' +

            '<div class="lp-prev"><div class="lp-card"><h3>Pratinjau</h3><p>Halaman login yang tersimpan. Muat ulang otomatis setelah Anda menyimpan atau mengunggah.</p>' +
            '<div class="lp-frame" id="lpFrameBox"><iframe id="lpFrame" title="Pratinjau halaman login" loading="lazy"></iframe></div></div></div>' +
            '</div></div>';

        root.addEventListener('input', function () { markDirty(); });
        root.addEventListener('change', function (e) {
            if (e.target && e.target.type === 'file') onFile(e.target);
            else markDirty();
        });
        root.addEventListener('click', onClick);
        if (window.ResizeObserver) new ResizeObserver(scaleFrame).observe($('lpFrameBox'));
        S.built = true;
    }

    function scaleFrame() {
        var box = $('lpFrameBox'), fr = $('lpFrame'); if (!box || !fr) return;
        var k = box.clientWidth / 1280;
        fr.style.transform = 'scale(' + k + ')';
        box.style.height = Math.round(760 * k) + 'px';
    }
    function reloadFrame() { var fr = $('lpFrame'); if (fr) { fr.src = '/login?preview=1&t=' + Date.now(); scaleFrame(); } }

    function markDirty() { S.dirty = true; var d = $('lpDirty'); if (d) d.classList.add('show'); }
    function clearDirty() { S.dirty = false; var d = $('lpDirty'); if (d) d.classList.remove('show'); }

    function fill(d) {
        var s = d.settings;
        $('lpName').value = s.company_name || '';
        $('lpNameHint').textContent = s.company_name ? 'Kosongkan untuk memakai nama dari Profil Perusahaan.' : 'Saat ini memakai nama dari Profil Perusahaan: ' + d.company_name_effective + '.';
        $('lpHeadline').value = s.headline || '';
        $('lpDesc').value = s.description || '';
        [0, 1, 2, 3].forEach(function (i) { $('lpF' + i).value = (s.features || [])[i] || ''; });
        $('lpWTitle').value = s.welcome_title || '';
        $('lpWDesc').value = s.welcome_desc || '';
        $('lpBtn').value = s.button_label || '';
        $('lpNote').value = s.security_note || '';
        $('lpArt').checked = !!s.show_art;
        $('lpLogoThumb').innerHTML = d.logo_url ? '<img src="' + esc(d.logo_url) + '" alt="Logo">' : 'Belum ada logo';
        $('lpBgThumb').innerHTML = d.bg_url ? '<img src="' + esc(d.bg_url) + '" alt="Latar">' : 'Belum ada';
        $('lpDelLogo').disabled = !d.logo_url; $('lpDelBg').disabled = !d.bg_url;
        var t = d.theme || {};
        $('lpSw').innerHTML = [['Warna utama', t.primary], ['Utama saat disorot', t.primaryHover], ['Warna sekunder (aksen)', t.secondary]].map(function (x) {
            return '<div><i style="background:' + esc(x[1]) + '"></i><span>' + esc(x[0]) + ' <b>' + esc(x[1]) + '</b></span></div>';
        }).join('');
        clearDirty();
    }

    function body() {
        return {
            company_name: $('lpName').value.trim(), headline: $('lpHeadline').value.trim(), description: $('lpDesc').value.trim(),
            features: [0, 1, 2, 3].map(function (i) { return $('lpF' + i).value.trim(); }),
            welcome_title: $('lpWTitle').value.trim(), welcome_desc: $('lpWDesc').value.trim(), button_label: $('lpBtn').value.trim(),
            security_note: $('lpNote').value.trim(), show_art: $('lpArt').checked
        };
    }

    function errText(x) {
        var m = x.j.message || 'Gagal menyimpan.';
        if (x.j.errors) m = Object.keys(x.j.errors).map(function (k) { return x.j.errors[k][0]; }).join(' ');
        return m;
    }

    function load() {
        var root = $('loginPageRoot'); if (!root) return Promise.resolve();
        if (!EDIT[role()]) { root.innerHTML = '<p class="text-muted">Pengaturan halaman login hanya bisa diubah oleh owner, superadmin, atau admin.</p>'; return Promise.resolve(); }
        if (!S.built || !$('lpSave')) build(root);
        return Promise.resolve(http('api/login-page', { headers: { 'Accept': 'application/json' } })).then(json).then(function (x) {
            if (!x.ok || x.j.status !== 'success') throw new Error(errText(x));
            S.data = x.j.data; fill(S.data); reloadFrame();
        }).catch(function () { root.insertAdjacentHTML('afterbegin', '<p class="text-muted">Gagal memuat pengaturan halaman login.</p>'); });
    }

    function save() {
        if (S.busy) return;
        S.busy = true; $('lpSave').disabled = true;
        Promise.resolve(http('api/login-page', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body()) }))
            .then(json).then(function (x) {
                if (!x.ok || x.j.status !== 'success') throw new Error(errText(x));
                S.data = x.j.data; fill(S.data); reloadFrame(); say('success', 'Pengaturan halaman login tersimpan.');
            }).catch(function (e) { say('error', e.message || 'Gagal menyimpan.'); })
            .then(function () { S.busy = false; var b = $('lpSave'); if (b) b.disabled = false; });
    }

    function onFile(input) {
        var f = input.files && input.files[0]; if (!f) return;
        var type = input.id === 'lpFileLogo' ? 'logo' : 'bg';
        var max = type === 'logo' ? 1 : 3;
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { say('error', 'Gunakan gambar PNG, JPG, atau WebP.'); input.value = ''; return; }
        if (f.size > max * 1024 * 1024) { say('error', 'Ukuran gambar maksimal ' + max + ' MB.'); input.value = ''; return; }
        var fd = new FormData(); fd.append('type', type); fd.append('file', f);
        Promise.resolve(http('api/login-page/asset', { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } })).then(json).then(function (x) {
            if (!x.ok || x.j.status !== 'success') throw new Error(errText(x));
            // jaga isian teks yang belum disimpan
            var keep = S.dirty ? body() : null; S.data = x.j.data; fill(S.data);
            if (keep) { $('lpName').value = keep.company_name; $('lpHeadline').value = keep.headline; $('lpDesc').value = keep.description; $('lpWTitle').value = keep.welcome_title; $('lpWDesc').value = keep.welcome_desc; $('lpBtn').value = keep.button_label; $('lpNote').value = keep.security_note; $('lpArt').checked = keep.show_art; keep.features.forEach(function (v, i) { $('lpF' + i).value = v; }); markDirty(); }
            reloadFrame(); say('success', x.j.message || 'Berkas tersimpan.');
        }).catch(function (e) { say('error', e.message || 'Gagal mengunggah.'); }).then(function () { input.value = ''; });
    }

    function delAsset(type) {
        ask(type === 'logo' ? 'Hapus logo?' : 'Hapus gambar latar?', 'Halaman login akan memakai tampilan bawaan.', 'Ya, hapus').then(function (ok) {
            if (!ok) return;
            Promise.resolve(http('api/login-page/asset/' + type, { method: 'DELETE', headers: { 'Accept': 'application/json' } })).then(json).then(function (x) {
                if (!x.ok || x.j.status !== 'success') throw new Error(errText(x));
                var keep = S.dirty ? body() : null; S.data = x.j.data; fill(S.data);
                if (keep) { $('lpName').value = keep.company_name; $('lpHeadline').value = keep.headline; $('lpDesc').value = keep.description; $('lpWTitle').value = keep.welcome_title; $('lpWDesc').value = keep.welcome_desc; $('lpBtn').value = keep.button_label; $('lpNote').value = keep.security_note; $('lpArt').checked = keep.show_art; keep.features.forEach(function (v, i) { $('lpF' + i).value = v; }); markDirty(); }
                reloadFrame();
            }).catch(function (e) { say('error', e.message || 'Gagal menghapus.'); });
        });
    }

    function resetTexts() {
        var d = S.data && S.data.defaults; if (!d) return;
        $('lpHeadline').value = d.headline; $('lpDesc').value = d.description;
        d.features.forEach(function (v, i) { $('lpF' + i).value = v; });
        $('lpWTitle').value = d.welcome_title; $('lpWDesc').value = d.welcome_desc; $('lpBtn').value = d.button_label; $('lpNote').value = d.security_note;
        markDirty();
    }

    function onClick(e) {
        var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
        var a = b.getAttribute('data-act');
        if (a === 'save') save();
        else if (a === 'reset') resetTexts();
        else if (a === 'up-logo') $('lpFileLogo').click();
        else if (a === 'up-bg') $('lpFileBg').click();
        else if (a === 'del-logo') delAsset('logo');
        else if (a === 'del-bg') delAsset('bg');
    }

    function hookTab() {
        var orig = window.switchSettingsTab;
        if (typeof orig !== 'function' || orig.__lp) return;
        var w = function (tab) {
            var r = orig.apply(this, arguments);
            if (tab === 'login' && !S.dirty) load();
            return r;
        };
        w.__lp = true; window.switchSettingsTab = w;
    }
    window.loadLoginPageSettings = function () { if (!S.dirty) return load(); };

    setInterval(function () {
        hookTab();
        var root = $('loginPageRoot');
        if (root && !root.__init && localStorage.getItem('mc_currentUser')) { root.__init = true; load(); }
    }, 2500);
})();
