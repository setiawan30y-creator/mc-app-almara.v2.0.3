// @2026-Alifiandra
/* =====================================================================
 * 53-profile-form.js  —  Pengaturan > Profil Perusahaan
 *  - Gaya form formal (kartu bernomor, kolom rapi, responsif, ikut tema).
 *  - Pratinjau kop struk langsung dari isian (nama, alamat, telepon, izin BI, penutup).
 *  - Penanda "belum disimpan" dan peringatan sebelum pindah tab bila ada perubahan.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcProfileForm) return;
    window.__mcProfileForm = true;

    var $ = function (id) { return document.getElementById(id); };
    var FIELDS = ['profName', 'profAddress', 'profBiLicense', 'profIdpjk', 'profReporterCode', 'profGoamlOrgId', 'profPhone', 'profWaNumber', 'profFooter'];
    var dirty = false;

    function injectStyle() {
        if ($('pf-style')) return;
        var st = document.createElement('style');
        st.id = 'pf-style';
        st.textContent = [
            '.pf{--pf-bd:var(--mc-border,rgba(148,163,184,.35));--pf-mut:var(--mc-text-muted,#94a3b8);--pf-pri:var(--mc-primary,#2563eb);display:grid;gap:16px}',
            '.pf-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}',
            '.pf-head h2{margin:0;font-size:1.2rem}.pf-head p{margin:4px 0 0;color:var(--pf-mut);font-size:.85rem;max-width:640px;line-height:1.5}',
            '.pf-head .pf-actions{margin-left:auto;display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
            '.pf-dirty{font-size:.78rem;font-weight:700;color:#fbbf24;display:none}.pf-dirty.show{display:inline}',
            '.pf-layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr);gap:16px;align-items:start}',
            '@media(max-width:1000px){.pf-layout{grid-template-columns:1fr}}',
            '.pf-main{display:grid;gap:16px}',
            '.pf-card{border:1px solid var(--pf-bd);border-radius:14px;padding:16px 18px}',
            '.pf-card>h3{margin:0 0 4px;font-size:.95rem;display:flex;align-items:center;gap:8px}',
            '.pf-card>h3 span{display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--pf-pri);color:#fff;font-size:.74rem;align-items:center;justify-content:center;flex:none}',
            '.pf-card>p{margin:0 0 14px;color:var(--pf-mut);font-size:.8rem;line-height:1.45}',
            '.pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px 16px}.pf-grid .wide{grid-column:1/-1}',
            '.pf label.pf-l{display:block;font-size:.8rem;font-weight:600;margin:0 0 5px}.pf label.pf-l em{color:#f87171;font-style:normal}',
            '.pf .form-control{width:100%;box-sizing:border-box}',
            '.pf small{color:var(--pf-mut);display:block;line-height:1.45;font-size:.78rem;margin-top:4px}',
            '.pf-side{position:sticky;top:12px;display:grid;gap:16px}',
            '@media(max-width:1000px){.pf-side{position:static}}',
            '.pf-slip{background:#fff;color:#111827;border-radius:10px;padding:18px 16px;font-family:"Courier New",ui-monospace,monospace;font-size:.76rem;line-height:1.5;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.25)}',
            '.pf-slip .n{font-weight:700;font-size:.95rem;letter-spacing:.02em;overflow-wrap:anywhere}',
            '.pf-slip .a{margin-top:2px;overflow-wrap:anywhere;white-space:pre-line}',
            '.pf-slip hr{border:0;border-top:1px dashed #9ca3af;margin:10px 0}',
            '.pf-slip .row{display:flex;justify-content:space-between;gap:8px;text-align:left}',
            '.pf-slip .f{font-style:italic;overflow-wrap:anywhere}',
            '.pf-fav{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function setDirty(v) {
        dirty = v;
        var d = $('pfDirty'); if (d) d.classList.toggle('show', v);
    }

    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    function preview() {
        var box = $('pfSlip'); if (!box) return;
        var g = function (id) { var e = $(id); return e ? (e.value || '').trim() : ''; };
        var name = g('profName') || 'Nama Perusahaan';
        var phone = g('profWaNumber') || g('profPhone');
        box.innerHTML =
            '<div class="n">' + esc(name.toUpperCase()) + '</div>' +
            '<div class="a">' + esc(g('profAddress') || 'Alamat perusahaan') + '</div>' +
            (phone ? '<div>Telp/WA: ' + esc(phone) + '</div>' : '') +
            (g('profBiLicense') ? '<div>Izin BI: ' + esc(g('profBiLicense')) + '</div>' : '') +
            '<hr><div class="row"><span>No. Invoice</span><span>INV-0001</span></div>' +
            '<div class="row"><span>Tanggal</span><span>01/01/2026</span></div>' +
            '<hr><div class="f">' + esc(g('profFooter') || 'Pesan penutup struk') + '</div>';
    }

    function bind() {
        var root = $('settings-tab-profile');
        if (!root || root.__pfBound) return;
        root.__pfBound = true;
        root.addEventListener('input', function (e) {
            if (e.target && FIELDS.indexOf(e.target.id) > -1) { setDirty(true); preview(); }
        });
        var origSubmit = window.submitProfile;
        if (typeof origSubmit === 'function' && !origSubmit.__pf) {
            var wrapped = function () { var r = origSubmit.apply(this, arguments); if (r !== false) setDirty(false); return r; };
            wrapped.__pf = true;
            window.submitProfile = wrapped;
        }
        var origLoad = window.loadSettingsProfile;
        if (typeof origLoad === 'function' && !origLoad.__pf) {
            var wl = function () { var r = origLoad.apply(this, arguments); setDirty(false); preview(); return r; };
            wl.__pf = true;
            window.loadSettingsProfile = wl;
        }
        injectStyle();
        preview();
    }

    // Peringatan bila meninggalkan tab Profil dengan perubahan belum disimpan.
    function hookTabs() {
        var orig = window.switchSettingsTab;
        if (typeof orig !== 'function' || orig.__pf) return;
        var wrapped = function (tab) {
            if (dirty && tab !== 'profile' && typeof Swal !== 'undefined' && Swal.fire) {
                var self = this, args = arguments;
                Swal.fire({ icon: 'warning', title: 'Perubahan belum disimpan', text: 'Profil perusahaan memiliki perubahan yang belum disimpan.', showCancelButton: true, showDenyButton: true, confirmButtonText: 'Simpan & pindah', denyButtonText: 'Buang perubahan', cancelButtonText: 'Tetap di sini' })
                    .then(function (r) {
                        if (r.isConfirmed) { var ok = window.submitProfile(); if (ok === false) return; orig.apply(self, args); }
                        else if (r.isDenied) { if (typeof window.loadSettingsProfile === 'function') window.loadSettingsProfile(); setDirty(false); orig.apply(self, args); }
                    });
                return;
            }
            return orig.apply(this, arguments);
        };
        wrapped.__pf = true;
        window.switchSettingsTab = wrapped;
    }

    setInterval(function () { bind(); hookTabs(); }, 1500);
})();
