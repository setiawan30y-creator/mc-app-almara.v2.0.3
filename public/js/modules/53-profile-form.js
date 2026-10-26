// @2026-Alifiandra
/* =====================================================================
 * 53-profile-form.js  —  Pengaturan > Profil Perusahaan
 *  - Gaya form formal (kartu bernomor, kolom rapi, responsif, ikut tema).
 *  - Pratinjau kop struk langsung dari isian (nama, alamat, telepon, izin BI, penutup).
 *  - Penanda "belum disimpan" dan peringatan sebelum pindah tab bila ada perubahan.
 *  - Cetak Struk: ubah teks peringatan & label tanda tangan, tampil/sembunyi baris,
 *    dan tambah/ubah/hapus/urutkan baris tambahan (window.pfCollectReceipt).
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcProfileForm) return;
    window.__mcProfileForm = true;

    var $ = function (id) { return document.getElementById(id); };
    var FIELDS = ['profName', 'profAddress', 'profBiLicense', 'profIdpjk', 'profReporterCode', 'profGoamlOrgId', 'profPhone', 'profWaNumber', 'profFooter'];
    var dirty = false;

    // ---------- Pengaturan Cetak Struk ----------
    var RC_MAX_LINES = 15, RC_MAX_LEN = 200;
    var RC_POS = [['top', 'Di bawah kop (atas)'], ['total', 'Setelah total / metode'], ['bottom', 'Sebelum pesan penutup']];
    var RC_ALIGN = [['center', 'Tengah'], ['left', 'Kiri'], ['right', 'Kanan']];
    var rc = null;

    function rcDefaults() {
        var d = window.MC_RECEIPT_DEFAULTS || {};
        return {
            disclaimer: typeof d.disclaimer === 'string' ? d.disclaimer : 'Hitung kembali uang Anda, Kami tidak menerima\nkomplin setelah meninggalkan counter',
            signLeft: d.signLeft || 'Petugas / Kasir', signRight: d.signRight || 'Penerima',
            showLicense: true, showCif: true, showCustPhone: true, lines: []
        };
    }
    function rcLoad() {
        var p = {}; try { p = typeof getProfile === 'function' ? (getProfile() || {}) : {}; } catch (e) { p = {}; }
        var r = (p.receipt && typeof p.receipt === 'object') ? p.receipt : {};
        var d = rcDefaults();
        rc = {
            disclaimer: typeof r.disclaimer === 'string' ? r.disclaimer : d.disclaimer,
            signLeft: typeof r.signLeft === 'string' ? r.signLeft : d.signLeft,
            signRight: typeof r.signRight === 'string' ? r.signRight : d.signRight,
            showLicense: r.showLicense !== false, showCif: r.showCif !== false, showCustPhone: r.showCustPhone !== false,
            lines: (Array.isArray(r.lines) ? r.lines : []).slice(0, RC_MAX_LINES).map(function (l) {
                return { text: String((l && l.text) || ''), pos: (l && l.pos) || 'bottom', align: (l && l.align) || 'center', bold: !!(l && l.bold) };
            })
        };
    }
    window.pfCollectReceipt = function () {
        if (!rc) rcLoad();
        var d = rcDefaults();
        var okPos = RC_POS.map(function (x) { return x[0]; }), okAl = RC_ALIGN.map(function (x) { return x[0]; });
        return {
            disclaimer: String(rc.disclaimer || '').slice(0, 300),
            signLeft: String(rc.signLeft || '').trim().slice(0, 40) || d.signLeft,
            signRight: String(rc.signRight || '').trim().slice(0, 40) || d.signRight,
            showLicense: !!rc.showLicense, showCif: !!rc.showCif, showCustPhone: !!rc.showCustPhone,
            lines: rc.lines.filter(function (l) { return String(l.text || '').trim() !== ''; }).slice(0, RC_MAX_LINES).map(function (l) {
                return { text: String(l.text).slice(0, RC_MAX_LEN), pos: okPos.indexOf(l.pos) > -1 ? l.pos : 'bottom', align: okAl.indexOf(l.align) > -1 ? l.align : 'center', bold: !!l.bold };
            })
        };
    };

    function opts(list, v) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }

    function rcRender() {
        var box = $('pfReceiptEditor'); if (!box) return;
        if (!rc) rcLoad();
        var rows = rc.lines.map(function (l, i) {
            return '<div class="pf-rl" data-i="' + i + '">' +
                '<div class="pf-rl-n">' + (i + 1) + '</div>' +
                '<textarea class="form-control" rows="1" maxlength="' + RC_MAX_LEN + '" data-rl="text" placeholder="Isi baris, contoh: Kurs dapat berubah sewaktu-waktu">' + esc(l.text) + '</textarea>' +
                '<select class="form-control" data-rl="pos" title="Posisi baris">' + opts(RC_POS, l.pos) + '</select>' +
                '<select class="form-control" data-rl="align" title="Perataan">' + opts(RC_ALIGN, l.align) + '</select>' +
                '<label class="pf-chk" title="Cetak tebal"><input type="checkbox" data-rl="bold"' + (l.bold ? ' checked' : '') + '> Tebal</label>' +
                '<div class="pf-rl-btn">' +
                '<button type="button" class="btn btn-outline btn-sm" data-act="up" title="Naikkan"' + (i === 0 ? ' disabled' : '') + '><i class="fa-solid fa-arrow-up"></i></button>' +
                '<button type="button" class="btn btn-outline btn-sm" data-act="down" title="Turunkan"' + (i === rc.lines.length - 1 ? ' disabled' : '') + '><i class="fa-solid fa-arrow-down"></i></button>' +
                '<button type="button" class="btn btn-outline btn-sm pf-del" data-act="del" title="Hapus baris"><i class="fa-solid fa-trash"></i></button>' +
                '</div></div>';
        }).join('');
        box.innerHTML =
            '<div class="pf-sub">Teks pada struk</div>' +
            '<div class="pf-grid">' +
            '<div class="wide"><label class="pf-l" for="pfRcDisclaimer">Teks peringatan</label>' +
            '<textarea id="pfRcDisclaimer" class="form-control" rows="2" maxlength="300" data-rc="disclaimer" placeholder="Kosongkan bila tidak ingin dicetak">' + esc(rc.disclaimer) + '</textarea>' +
            '<small>Dicetak miring di atas pesan penutup. Tekan Enter untuk pindah baris.</small></div>' +
            '<div><label class="pf-l" for="pfRcSignLeft">Label tanda tangan kiri</label><input type="text" id="pfRcSignLeft" class="form-control" maxlength="40" data-rc="signLeft" value="' + esc(rc.signLeft) + '" placeholder="Petugas / Kasir"></div>' +
            '<div><label class="pf-l" for="pfRcSignRight">Label tanda tangan kanan</label><input type="text" id="pfRcSignRight" class="form-control" maxlength="40" data-rc="signRight" value="' + esc(rc.signRight) + '" placeholder="Penerima"></div>' +
            '</div>' +
            '<div class="pf-sub">Tampilkan pada struk</div>' +
            '<div class="pf-checks">' +
            '<label class="pf-chk"><input type="checkbox" data-rc="showLicense"' + (rc.showLicense ? ' checked' : '') + '> Nomor izin BI</label>' +
            '<label class="pf-chk"><input type="checkbox" data-rc="showCif"' + (rc.showCif ? ' checked' : '') + '> No. CIF nasabah</label>' +
            '<label class="pf-chk"><input type="checkbox" data-rc="showCustPhone"' + (rc.showCustPhone ? ' checked' : '') + '> Telepon nasabah</label>' +
            '</div>' +
            '<div class="pf-sub">Baris tambahan <span class="pf-count">' + rc.lines.length + '/' + RC_MAX_LINES + '</span></div>' +
            (rows ? '<div class="pf-rls">' + rows + '</div>' : '<small style="margin:0 0 10px">Belum ada baris tambahan. Contoh: jam operasional, nomor rekening, atau catatan kurs.</small>') +
            '<button type="button" class="btn btn-outline btn-sm" data-act="add"' + (rc.lines.length >= RC_MAX_LINES ? ' disabled' : '') + '><i class="fa-solid fa-plus"></i> Tambah baris</button>' +
            ' <button type="button" class="btn btn-outline btn-sm" data-act="reset" title="Kembalikan teks peringatan, label, dan pilihan tampil ke bawaan"><i class="fa-solid fa-rotate-left"></i> Kembalikan bawaan</button>';
    }

    function rcChanged() { setDirty(true); preview(); }

    function rcBind() {
        var box = $('pfReceiptEditor'); if (!box || box.__rcBound) return;
        box.__rcBound = true;
        var onField = function (e) {
            var t = e.target; if (!t) return;
            if (t.dataset.rc) {
                rc[t.dataset.rc] = t.type === 'checkbox' ? t.checked : t.value;
                rcChanged();
            } else if (t.dataset.rl) {
                var row = t.closest('.pf-rl'); if (!row) return;
                var l = rc.lines[+row.dataset.i]; if (!l) return;
                l[t.dataset.rl] = t.type === 'checkbox' ? t.checked : t.value;
                rcChanged();
            }
        };
        box.addEventListener('input', onField);
        box.addEventListener('change', onField);
        box.addEventListener('click', function (e) {
            var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
            var act = b.dataset.act, row = b.closest('.pf-rl'), i = row ? +row.dataset.i : -1;
            if (act === 'add') { if (rc.lines.length >= RC_MAX_LINES) return; rc.lines.push({ text: '', pos: 'bottom', align: 'center', bold: false }); }
            else if (act === 'del') rc.lines.splice(i, 1);
            else if (act === 'up' && i > 0) rc.lines.splice(i - 1, 0, rc.lines.splice(i, 1)[0]);
            else if (act === 'down' && i < rc.lines.length - 1) rc.lines.splice(i + 1, 0, rc.lines.splice(i, 1)[0]);
            else if (act === 'reset') { var d = rcDefaults(); rc.disclaimer = d.disclaimer; rc.signLeft = d.signLeft; rc.signRight = d.signRight; rc.showLicense = rc.showCif = rc.showCustPhone = true; }
            else return;
            rcRender(); rcChanged();
            if (act === 'add') { var ta = box.querySelectorAll('.pf-rl textarea'); if (ta.length) ta[ta.length - 1].focus(); }
        });
    }

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
            '.pf-fav{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px}',
            '.pf-sub{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--pf-mut);margin:18px 0 8px;display:flex;gap:8px;align-items:center}',
            '.pf-sub .pf-count{font-weight:600;text-transform:none;letter-spacing:0;opacity:.8}',
            '.pf-checks{display:flex;gap:10px 22px;flex-wrap:wrap}',
            '.pf-chk{display:inline-flex;align-items:center;gap:6px;font-size:.84rem;cursor:pointer;white-space:nowrap}',
            '.pf-chk input{width:16px;height:16px;accent-color:var(--pf-pri)}',
            '.pf-rls{display:grid;gap:8px;margin-bottom:10px}',
            '.pf-rl{display:grid;grid-template-columns:22px minmax(0,1fr) 190px 100px auto auto;gap:8px;align-items:center;border:1px solid var(--pf-bd);border-radius:10px;padding:8px}',
            '.pf-rl-n{width:22px;height:22px;border-radius:50%;background:color-mix(in srgb,var(--pf-pri) 18%,transparent);color:var(--pf-pri);font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center}',
            '.pf-rl textarea{resize:vertical;min-height:38px}',
            '.pf-rl-btn{display:flex;gap:4px}.pf-rl-btn .btn{padding:6px 9px}.pf-rl-btn .pf-del{color:#f87171}',
            '@media(max-width:900px){.pf-rl{grid-template-columns:22px minmax(0,1fr) 1fr}.pf-rl textarea{grid-column:2/-1}.pf-rl select{grid-column:auto}.pf-rl-btn{grid-column:1/-1;justify-content:flex-end}}',
            '.pf-slip .l{margin:2px 0;overflow-wrap:anywhere}',
            '.pf-slip .sg{display:flex;justify-content:space-between;gap:10px;margin-top:6px}.pf-slip .sg div{flex:1;border-bottom:1px dashed #9ca3af;padding-bottom:18px;font-size:.7rem}',
            '.pf-slip .d{font-style:italic;font-size:.7rem;margin-top:6px}'
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
        if (!rc) rcLoad();
        var lines = function (pos) {
            return rc.lines.filter(function (l) { return l.pos === pos && String(l.text || '').trim(); }).map(function (l) {
                return '<div class="l" style="text-align:' + esc(l.align || 'center') + ';' + (l.bold ? 'font-weight:700;' : '') + '">' + esc(l.text).replace(/\n/g, '<br>') + '</div>';
            }).join('');
        };
        box.innerHTML =
            '<div class="n">' + esc(name.toUpperCase()) + '</div>' +
            '<div class="a">' + esc(g('profAddress') || 'Alamat perusahaan') + '</div>' +
            (rc.showLicense && g('profBiLicense') ? '<div>No. Izin: ' + esc(g('profBiLicense')) + '</div>' : '') +
            '<div>Telp/WA: ' + esc(phone || '-') + ' | Tgl: 01 Jan 2026</div>' +
            lines('top') +
            '<hr><div class="row"><span>No. Invoice</span><span>INV-0001</span></div>' +
            (rc.showCif ? '<div class="row"><span>No. CIF</span><span>CIF-0001</span></div>' : '') +
            '<div class="row"><span>Nama</span><span>Nama nasabah</span></div>' +
            (rc.showCustPhone ? '<div class="row"><span>Telp</span><span>0812xxxx***</span></div>' : '') +
            '<hr><div class="row"><b>GRAND TOTAL</b><b>Rp 1.650.000</b></div>' +
            '<div class="row"><span>Metode</span><span>CASH</span></div>' +
            lines('total') +
            '<div class="sg"><div>' + esc(rc.signLeft || 'Petugas / Kasir') + '</div><div>' + esc(rc.signRight || 'Penerima') + '</div></div>' +
            (String(rc.disclaimer || '').trim() ? '<div class="d">' + esc(String(rc.disclaimer).trim()).replace(/\n/g, '<br>') + '</div>' : '') +
            lines('bottom') +
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
            var wrapped = function () { var r = origSubmit.apply(this, arguments); if (r !== false) { setDirty(false); rcLoad(); rcRender(); preview(); } return r; };
            wrapped.__pf = true;
            window.submitProfile = wrapped;
        }
        var origLoad = window.loadSettingsProfile;
        if (typeof origLoad === 'function' && !origLoad.__pf) {
            var wl = function () { var r = origLoad.apply(this, arguments); rcLoad(); rcRender(); setDirty(false); preview(); return r; };
            wl.__pf = true;
            window.loadSettingsProfile = wl;
        }
        injectStyle();
        rcLoad();
        rcRender();
        rcBind();
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
