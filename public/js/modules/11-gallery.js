/* =====================================================================
 * 11-gallery.js  —  Galeri Referensi Valas
 *
 *  Tujuan: membantu teller baru mengenali uang yang MASIH DITERIMA dan yang TIDAK BISA DITERIMA.
 *   - Status dibuat sangat jelas (hijau = diterima, merah = tolak) lengkap dengan alasan dan ciri-ciri.
 *   - Filter status / mata uang / pencarian, 8 mode tampilan (Extra large … Content).
 *   - Pencarian dengan FOTO (seperti Google Lens): foto uang pelanggan dibandingkan dengan foto galeri
 *     langsung di browser (tanpa kirim ke server). Hasilnya perkiraan kemiripan, bukan pengganti pengecekan.
 *   - Admin / owner / supervisor dapat menambah, mengubah, dan menghapus acuan.
 *
 *  Data: localStorage 'mc_valas_gallery' (disinkronkan ke datastore). Bentuk data lama tetap dipakai:
 *        { id, code, status: 'DITERIMA'|'TIDAK_DITERIMA', desc, notes, photo }  + opsional { reason, series, updatedAt }
 * ===================================================================== */
(function () {
    'use strict';

    var KEY = 'mc_valas_gallery';
    var S = { q: '', status: 'ALL', cur: '', sort: 'code', view: 'lg', list: [], sig: '', guideOpen: true, bound: false, timer: null, photo: null, ph: { items: [], busy: false, token: 0 } };

    // ------------------------------------------------------------ util
    var $ = function (id) { return document.getElementById(id); };
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function toast(icon, title) {
        if (window.Swal) window.Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 2600, showConfirmButton: false });
        else alert(title);
    }
    function flag(code) { try { return typeof window.getFlagHtml === 'function' && code ? window.getFlagHtml(code) : ''; } catch (e) { return ''; } }
    function isAdmin() {
        try { var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null; return ['owner', 'admin', 'supervisor'].indexOf(String(u && u.role || '').toLowerCase()) !== -1; } catch (e) { return false; }
    }
    function withTimeout(p, ms, msg) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(msg)); }, ms); })]); }
    function isOk(item) { return item.status === 'DITERIMA'; }

    // ------------------------------------------------------------ penyimpanan (nama publik lama tetap)
    window.getValasGallery = function () { try { var d = JSON.parse(ls(KEY)); return Array.isArray(d) ? d : []; } catch (e) { return []; } };
    window.saveValasGallery = function (data) {
        localStorage.setItem(KEY, JSON.stringify(data));
        if (typeof window.pushToUniversalDatastore === 'function') {
            Promise.resolve(window.pushToUniversalDatastore(KEY, data)).catch(function (e) { console.warn('Sinkronisasi galeri valas tertunda:', e); });
        }
    };
    window.currentValasGalleryPhotoBase64 = null;

    // ------------------------------------------------------------ tampilan (dropdown seperti Explorer)
    var VIEWS = [['xl', 'Extra large icons', 'fa-regular fa-image'], ['lg', 'Large icons', 'fa-regular fa-square'], ['md', 'Medium icons', 'fa-solid fa-table-cells-large'], ['sm', 'Small icons', 'fa-solid fa-table-cells'],
        ['list', 'List', 'fa-solid fa-list'], ['details', 'Details', 'fa-solid fa-bars'], ['tiles', 'Tiles', 'fa-solid fa-grip'], ['content', 'Content', 'fa-solid fa-list-check']];
    function viewDef() { return VIEWS.filter(function (v) { return v[0] === S.view; })[0] || VIEWS[1]; }
    function loadPrefs() {
        try {
            var v = localStorage.getItem('vg_view_mode'); if (v && VIEWS.some(function (x) { return x[0] === v; })) S.view = v;
            S.guideOpen = localStorage.getItem('vg_guide_closed') !== '1';
        } catch (e) { /* abaikan */ }
    }
    function viewMenuHtml() {
        return VIEWS.map(function (v) {
            return '<button type="button" data-vg="view" data-v="' + v[0] + '" class="' + (S.view === v[0] ? 'on' : '') + '"><span class="dot">' + (S.view === v[0] ? '&bull;' : '') + '</span><i class="' + v[2] + '"></i><span>' + v[1] + '</span></button>';
        }).join('');
    }

    // ------------------------------------------------------------ gaya
    function injectStyle() {
        if ($('vg-style')) return;
        var st = document.createElement('style'); st.id = 'vg-style';
        st.textContent = [
            '.vg-root,.vg-ov{--vg-bd:var(--mc-border,rgba(148,163,184,.28));--vg-card:var(--mc-card-bg,#18181b);--vg-tx:var(--mc-text,#fafafa);--vg-mut:var(--mc-text-muted,#94a3b8);--vg-pri:var(--mc-primary,#22c55e);',
            '--vg-ok:#10b981;--vg-no:#ef4444;--vg-warn:var(--mc-warning,#f59e0b);--vg-info:var(--mc-info,#38bdf8);--vg-inp:var(--mc-input-bg,rgba(255,255,255,.04));--vg-r:var(--mc-radius,14px);color:var(--vg-tx)}',
            '.vg-root *,.vg-ov *{box-sizing:border-box}',
            '.vg-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}.vg-head h2{margin:0;font-size:1.25rem;display:flex;gap:9px;align-items:center}.vg-head h2 i{color:var(--vg-warn)}',
            '.vg-head p{margin:4px 0 0;color:var(--vg-mut);font-size:.85rem;max-width:640px}.vg-tools{display:flex;gap:8px;flex-wrap:wrap}',
            '.vg-btn{border:1px solid var(--vg-bd);background:transparent;color:var(--vg-tx);padding:8px 13px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:700;font-size:.82rem;display:inline-flex;gap:7px;align-items:center;justify-content:center;font-family:inherit}',
            '.vg-btn:hover{background:var(--vg-inp)}.vg-btn[disabled]{opacity:.5;cursor:not-allowed}.vg-btn.pri{background:var(--vg-pri);border-color:var(--vg-pri);color:#fff}.vg-btn.sm{padding:5px 9px;font-size:.76rem}',
            '.vg-btn.bad{color:var(--vg-no);border-color:color-mix(in srgb,var(--vg-no) 45%,transparent)}.vg-btn.lens{background:linear-gradient(135deg,#4285f4,#34a853 55%,#fbbc05);border:0;color:#fff}',
            '.vg-guide{border:1px solid var(--vg-bd);border-radius:var(--vg-r);background:var(--vg-card);padding:12px 16px;margin-bottom:12px}.vg-guide h3{margin:0 0 8px;font-size:.95rem;display:flex;justify-content:space-between;gap:8px;align-items:center}',
            '.vg-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.vg-step{display:flex;gap:10px;align-items:flex-start;font-size:.84rem;line-height:1.4}',
            '.vg-step>b{flex:0 0 26px;height:26px;border-radius:50%;background:var(--vg-inp);display:flex;align-items:center;justify-content:center;font-size:.8rem}.vg-step.ok>b{background:var(--vg-ok);color:#fff}.vg-step.no>b{background:var(--vg-no);color:#fff}',
            '.vg-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.vg-stat{border:1px solid var(--vg-bd);background:var(--vg-card);border-radius:12px;padding:8px 14px;font-size:.8rem;cursor:pointer;color:var(--vg-mut)}',
            '.vg-stat b{display:block;font-size:1.2rem;color:var(--vg-tx)}.vg-stat.ok b{color:var(--vg-ok)}.vg-stat.no b{color:var(--vg-no)}.vg-stat.on{border-color:var(--vg-pri);box-shadow:0 0 0 1px var(--vg-pri)}',
            '.vg-panel{background:var(--vg-card);border:1px solid var(--vg-bd);border-radius:var(--vg-r);padding:14px}',
            '.vg-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}',
            '.vg-in{background:var(--vg-inp);border:1px solid var(--mc-input-border,var(--vg-bd));color:var(--vg-tx);border-radius:var(--mc-input-radius,10px);padding:8px 11px;font-size:.85rem;font-family:inherit;max-width:100%}',
            '.vg-seg{display:inline-flex;border:1px solid var(--vg-bd);border-radius:10px;overflow:hidden}.vg-seg button{border:0;border-right:1px solid var(--vg-bd);background:transparent;color:var(--vg-mut);padding:8px 13px;font-weight:700;font-size:.8rem;cursor:pointer;font-family:inherit}',
            '.vg-seg button:last-child{border-right:0}.vg-seg button.on{background:var(--vg-pri);color:#fff}.vg-seg button.on.ok{background:var(--vg-ok)}.vg-seg button.on.no{background:var(--vg-no)}',
            '.vg-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.vg-chip{border:1px solid var(--vg-bd);background:transparent;color:var(--vg-tx);border-radius:999px;padding:4px 11px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit}',
            '.vg-chip.on{background:var(--vg-pri);border-color:var(--vg-pri);color:#fff}',
            '.vg-vw{position:relative}.vg-vm{position:absolute;right:0;top:calc(100% + 6px);z-index:50;background:var(--vg-card);border:1px solid var(--vg-bd);border-radius:12px;padding:6px;min-width:210px;box-shadow:0 14px 40px rgba(0,0,0,.4)}',
            '.vg-vm[hidden]{display:none}.vg-vm button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:var(--vg-tx);padding:8px 10px;border-radius:8px;cursor:pointer;font-size:.86rem;text-align:left;font-family:inherit}',
            '.vg-vm button:hover{background:var(--vg-inp)}.vg-vm .dot{width:10px;text-align:center;color:var(--vg-pri);font-weight:900}.vg-vm i{width:18px;text-align:center;color:var(--vg-mut)}',
            '.vg-grid{display:grid;gap:12px}.vg-grid.v-xl{grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}.vg-grid.v-lg{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}.vg-grid.v-md{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}',
            '.vg-grid.v-sm{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}.vg-grid.v-list,.vg-grid.v-content{grid-template-columns:1fr;gap:8px}.vg-grid.v-tiles{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}',
            '.vg-card{position:relative;border:2px solid var(--vg-bd);border-radius:14px;background:var(--vg-card);overflow:hidden;cursor:pointer;display:flex;flex-direction:column}.vg-card:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.28)}',
            '.vg-card.ok{border-color:color-mix(in srgb,var(--vg-ok) 70%,transparent)}.vg-card.no{border-color:color-mix(in srgb,var(--vg-no) 75%,transparent)}',
            '.vg-ph{background:var(--vg-inp) center/contain no-repeat;display:flex;align-items:center;justify-content:center;color:var(--vg-mut);font-size:.78rem;text-align:center}',
            '.v-xl .vg-ph{height:230px}.v-lg .vg-ph{height:150px}.v-md .vg-ph{height:100px}.v-sm .vg-ph{height:64px}',
            '.vg-ban{font-size:.74rem;font-weight:900;letter-spacing:.04em;padding:5px 10px;display:flex;gap:6px;align-items:center;justify-content:center}.vg-ban.ok{background:var(--vg-ok);color:#fff}.vg-ban.no{background:var(--vg-no);color:#fff}',
            '.vg-bd{padding:10px 12px;display:flex;flex-direction:column;gap:3px;min-width:0}.vg-bd b{font-size:.95rem}.vg-bd small{color:var(--vg-mut);font-size:.78rem;line-height:1.35}.vg-bd .why{font-size:.78rem;font-weight:700}.vg-bd .why.no{color:var(--vg-no)}.vg-bd .why.ok{color:var(--vg-ok)}',
            '.v-sm .vg-bd{padding:6px 8px}.v-sm .vg-bd small,.v-sm .vg-bd .why,.v-md .vg-bd small{display:none}.v-sm .vg-ban,.v-md .vg-ban{font-size:.62rem;padding:3px 6px}',
            '.v-list .vg-card,.v-tiles .vg-card,.v-content .vg-card{flex-direction:row;align-items:center}.v-list .vg-ph{display:none}.v-list .vg-ban{order:3;margin-left:auto;border-radius:8px;margin-right:10px;padding:4px 10px}.v-list .vg-bd{flex-direction:row;align-items:center;gap:12px;flex:1}',
            '.v-tiles .vg-ph{width:84px;height:84px;flex:0 0 84px}.v-content .vg-ph{width:150px;height:100px;flex:0 0 150px}.v-tiles .vg-ban,.v-content .vg-ban{position:absolute;top:8px;right:8px;border-radius:8px}',
            '.vg-tbl{overflow-x:auto}.vg-table{width:100%;border-collapse:collapse;min-width:640px}.vg-table th{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--vg-mut);text-align:left;padding:8px;border-bottom:1px solid var(--vg-bd)}',
            '.vg-table td{padding:8px;border-bottom:1px dashed var(--vg-bd);font-size:.84rem;vertical-align:middle}.vg-table tbody tr{cursor:pointer}.vg-table tbody tr:hover{background:var(--vg-inp)}.vg-th{width:64px;height:40px;border-radius:6px;background:var(--vg-inp) center/cover no-repeat}',
            '.vg-tag{display:inline-block;border-radius:999px;padding:2px 10px;font-size:.7rem;font-weight:900;color:#fff}.vg-tag.ok{background:var(--vg-ok)}.vg-tag.no{background:var(--vg-no)}',
            '.vg-empty{text-align:center;padding:36px 14px;color:var(--vg-mut);border:1px dashed var(--vg-bd);border-radius:var(--vg-r)}',
            '.vg-ov{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10050;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:3vh 12px}',
            '.vg-md{background:var(--mc-card-bg,#18181b);color:var(--mc-text,#fafafa);border:1px solid var(--vg-bd);border-radius:var(--mc-radius,14px);width:100%;max-width:620px;box-shadow:0 24px 60px rgba(0,0,0,.5)}.vg-md.wide{max-width:880px}',
            '.vg-mh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--vg-bd)}.vg-mh h3{margin:0;font-size:1.05rem}.vg-mx{border:0;background:transparent;color:var(--vg-mut);font-size:1.5rem;cursor:pointer;line-height:1}',
            '.vg-mb{padding:16px 18px}.vg-mf{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--vg-bd)}',
            '.vg-f{margin-bottom:10px}.vg-f label{display:block;font-size:.72rem;color:var(--vg-mut);font-weight:700;margin-bottom:4px}.vg-f .vg-in{width:100%}.vg-r2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.vg-r2{grid-template-columns:1fr}}',
            '.vg-big{display:flex;gap:14px;align-items:center;border-radius:14px;padding:14px 16px;margin-bottom:12px;color:#fff;font-weight:800}.vg-big.ok{background:var(--vg-ok)}.vg-big.no{background:var(--vg-no)}.vg-big i{font-size:2rem}.vg-big small{display:block;font-weight:600;opacity:.95;margin-top:2px}',
            '.vg-zoom{position:relative;overflow:hidden;border-radius:12px;background:var(--vg-inp);height:min(52vh,420px);display:flex;align-items:center;justify-content:center;cursor:zoom-in}.vg-zoom img{max-width:100%;max-height:100%;object-fit:contain;transition:transform .15s}.vg-zoom.z{cursor:zoom-out}.vg-zoom.z img{transform:scale(2.4)}',
            '.vg-nav{display:flex;justify-content:space-between;gap:8px;margin-top:10px}.vg-kv{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--vg-bd);font-size:.86rem}.vg-kv span{color:var(--vg-mut)}',
            '.vg-drop{border:2px dashed var(--vg-bd);border-radius:14px;padding:22px;text-align:center;color:var(--vg-mut);cursor:pointer}.vg-drop.over{border-color:var(--vg-pri);background:var(--vg-inp)}.vg-drop img{max-width:100%;max-height:200px;border-radius:10px;display:block;margin:0 auto 8px}',
            '.vg-res{display:flex;gap:12px;align-items:center;border:2px solid var(--vg-bd);border-radius:12px;padding:8px;margin-top:8px;cursor:pointer}.vg-res.ok{border-color:var(--vg-ok)}.vg-res.no{border-color:var(--vg-no)}.vg-res .vg-ph{width:96px;height:64px;flex:0 0 96px;border-radius:8px}',
            '.vg-sim{margin-left:auto;text-align:right;font-size:.74rem;color:var(--vg-mut);min-width:84px}.vg-sim b{display:block;font-size:1.1rem;color:var(--vg-tx)}.vg-sim i{display:block;height:5px;border-radius:3px;background:var(--vg-pri);margin-top:4px}',
            '.vg-note{font-size:.76rem;color:var(--vg-mut);margin:8px 0;line-height:1.45}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ modal
    function openModal(opt) {
        closeModal();
        var ov = document.createElement('div'); ov.className = 'vg-ov'; ov.id = 'vgModal';
        ov.innerHTML = '<div class="vg-md ' + (opt.wide ? 'wide' : '') + '" role="dialog" aria-modal="true"><div class="vg-mh"><h3>' + opt.title + '</h3><button class="vg-mx" data-vg="close" aria-label="Tutup">&times;</button></div><div class="vg-mb">' + opt.body + '</div>' + (opt.footer ? '<div class="vg-mf">' + opt.footer + '</div>' : '') + '</div>';
        document.body.appendChild(ov);
        ov.addEventListener('mousedown', function (e) { if (e.target === ov && opt.dismissable !== false) closeModal(); });
        if (opt.onOpen) opt.onOpen(ov);
        return ov;
    }
    function closeModal() { var m = $('vgModal'); if (m) m.remove(); S.ph.token++; }
    function modalOpen() { return !!$('vgModal'); }

    // ------------------------------------------------------------ rangka & filter
    function shell() {
        var root = $('vgRoot'); if (!root) return null;
        if (root.dataset.ready === '1') return root;
        root.className = 'vg-root';
        root.innerHTML = '<div class="vg-head"><div><h2><i class="fa-solid fa-images"></i> Galeri Referensi Valas</h2><p>Panduan visual uang yang <b style="color:var(--vg-ok)">masih diterima</b> dan yang <b style="color:var(--vg-no)">tidak bisa diterima</b>. Cari dengan kode, kata kunci, atau foto uang pelanggan.</p></div>' +
            '<div class="vg-tools"><button class="vg-btn lens" data-vg="lens"><i class="fa-solid fa-camera"></i> Cari dengan Foto</button><button class="vg-btn pri" id="vgAdd" data-vg="add" style="display:none"><i class="fa-solid fa-plus"></i> Tambah Acuan</button></div></div>' +
            '<div id="vgGuide"></div><div id="vgStats" class="vg-stats"></div>' +
            '<div class="vg-panel"><div class="vg-bar">' +
            '<input class="vg-in" id="vgQ" type="search" placeholder="Cari kode, judul, atau kata kunci..." style="flex:1;min-width:150px">' +
            '<div class="vg-seg" id="vgSeg"><button data-vg="st" data-v="ALL">Semua</button><button class="ok" data-vg="st" data-v="DITERIMA">Diterima</button><button class="no" data-vg="st" data-v="TIDAK_DITERIMA">Tidak diterima</button></div>' +
            '<select class="vg-in" id="vgSort"><option value="code">Urut: Kode A-Z</option><option value="status">Urut: Status</option><option value="new">Urut: Terbaru</option></select>' +
            '<div class="vg-vw"><button type="button" class="vg-btn" data-vg="viewmenu" title="Tampilan" aria-haspopup="true"><i id="vgViewIcon" class="' + viewDef()[2] + '"></i> <i class="fa-solid fa-chevron-down" style="font-size:.6rem"></i></button><div class="vg-vm" id="vgViewMenu" hidden></div></div>' +
            '<button class="vg-btn" data-vg="reset" title="Reset filter"><i class="fa-solid fa-rotate-left"></i></button></div>' +
            '<div id="vgCurs" class="vg-chips"></div><div id="vgList"></div></div>';
        root.dataset.ready = '1';
        return root;
    }
    function renderGuide() {
        var h = $('vgGuide'); if (!h) return;
        if (!S.guideOpen) { h.innerHTML = '<div style="margin-bottom:10px"><button class="vg-btn sm" data-vg="guide"><i class="fa-regular fa-circle-question"></i> Tampilkan panduan teller</button></div>'; return; }
        h.innerHTML = '<div class="vg-guide"><h3><span><i class="fa-solid fa-user-graduate" style="color:var(--vg-info)"></i> Panduan cepat untuk teller baru</span><button class="vg-btn sm" data-vg="guide">Sembunyikan</button></h3><div class="vg-steps">' +
            '<div class="vg-step"><b>1</b><span>Cari kode valas (mis. USD) atau tekan <b>Cari dengan Foto</b> lalu foto uang pelanggan.</span></div>' +
            '<div class="vg-step ok"><b><i class="fa-solid fa-check"></i></b><span><b>DITERIMA (hijau)</b> &mdash; boleh dibeli. Cocokkan seri, tahun, dan warna dengan foto acuan.</span></div>' +
            '<div class="vg-step no"><b><i class="fa-solid fa-xmark"></i></b><span><b>TIDAK DITERIMA (merah)</b> &mdash; tolak dengan sopan dan jelaskan alasannya (tertera di kartu).</span></div>' +
            '<div class="vg-step"><b>?</b><span>Tidak ada di galeri, atau ragu? <b>Jangan diterima dulu</b> &mdash; tanyakan supervisor.</span></div></div></div>';
    }
    function sorted(list) {
        var l = list.slice();
        if (S.sort === 'status') l.sort(function (a, b) { return (isOk(b) ? 1 : 0) - (isOk(a) ? 1 : 0) || String(a.code).localeCompare(String(b.code)); });
        else if (S.sort === 'new') l.sort(function (a, b) { return String(b.updatedAt || b.id).localeCompare(String(a.updatedAt || a.id)); });
        else l.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)) || (isOk(b) ? 1 : 0) - (isOk(a) ? 1 : 0) || String(a.desc).localeCompare(String(b.desc)); });
        return l;
    }
    function filtered() {
        var q = S.q.trim().toLowerCase();
        return sorted(window.getValasGallery().filter(function (i) {
            if (S.status !== 'ALL' && i.status !== S.status) return false;
            if (S.cur && String(i.code).toUpperCase() !== S.cur) return false;
            if (q && (String(i.code || '') + ' ' + (i.desc || '') + ' ' + (i.notes || '') + ' ' + (i.reason || '') + ' ' + (i.series || '')).toLowerCase().indexOf(q) === -1) return false;
            return true;
        }));
    }
    function renderStats() {
        var all = window.getValasGallery(), ok = all.filter(isOk).length;
        var el = $('vgStats'); if (!el) return;
        el.innerHTML = '<div class="vg-stat ' + (S.status === 'ALL' ? 'on' : '') + '" data-vg="st" data-v="ALL"><b>' + all.length + '</b>Semua acuan</div>' +
            '<div class="vg-stat ok ' + (S.status === 'DITERIMA' ? 'on' : '') + '" data-vg="st" data-v="DITERIMA"><b>' + ok + '</b>Diterima</div>' +
            '<div class="vg-stat no ' + (S.status === 'TIDAK_DITERIMA' ? 'on' : '') + '" data-vg="st" data-v="TIDAK_DITERIMA"><b>' + (all.length - ok) + '</b>Tidak diterima</div>';
        document.querySelectorAll('#vgSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === S.status); });
        var codes = {}; all.forEach(function (i) { var c = String(i.code || '').toUpperCase(); if (c) codes[c] = (codes[c] || 0) + 1; });
        $('vgCurs').innerHTML = Object.keys(codes).length ? '<button class="vg-chip ' + (!S.cur ? 'on' : '') + '" data-vg="cur" data-v="">Semua mata uang</button>' + Object.keys(codes).sort().map(function (c) {
            return '<button class="vg-chip ' + (S.cur === c ? 'on' : '') + '" data-vg="cur" data-v="' + esc(c) + '">' + esc(c) + ' <small>' + codes[c] + '</small></button>';
        }).join('') : '';
    }
    function banner(i) { return isOk(i) ? '<div class="vg-ban ok"><i class="fa-solid fa-circle-check"></i> DITERIMA</div>' : '<div class="vg-ban no"><i class="fa-solid fa-ban"></i> TIDAK DITERIMA</div>'; }
    function photoDiv(i) { return '<div class="vg-ph" style="' + (i.photo ? 'background-image:url(\'' + esc(i.photo) + '\')' : '') + '">' + (i.photo ? '' : 'Tidak ada foto') + '</div>'; }
    function whyLine(i) {
        var t = isOk(i) ? (i.notes ? String(i.notes).split('\n')[0] : '') : (i.reason || i.notes || '');
        return t ? '<span class="why ' + (isOk(i) ? 'ok' : 'no') + '">' + (isOk(i) ? '' : 'Alasan: ') + esc(String(t).slice(0, 140)) + '</span>' : '';
    }
    function cardHtml(i) {
        var cls = 'vg-card ' + (isOk(i) ? 'ok' : 'no'), at = ' data-vg="detail" data-id="' + esc(i.id) + '"';
        var title = '<b>' + flag(i.code) + ' ' + esc(String(i.code || '').toUpperCase()) + ' &middot; ' + esc(i.desc || '-') + '</b>';
        var series = i.series ? '<small>Seri/tahun: ' + esc(i.series) + '</small>' : '';
        if (S.view === 'sm') return '<div class="' + cls + '"' + at + '>' + photoDiv(i) + '<div class="vg-bd"><b>' + esc(String(i.code || '').toUpperCase()) + '</b></div>' + banner(i) + '</div>';
        if (S.view === 'list') return '<div class="' + cls + '"' + at + '><div class="vg-bd">' + title + '<small style="flex:1">' + esc(String(i.reason || i.notes || '').slice(0, 110)) + '</small></div>' + banner(i) + '</div>';
        if (S.view === 'tiles') return '<div class="' + cls + '"' + at + '>' + photoDiv(i) + '<div class="vg-bd">' + title + series + whyLine(i) + '</div>' + banner(i) + '</div>';
        if (S.view === 'content') return '<div class="' + cls + '"' + at + '>' + photoDiv(i) + '<div class="vg-bd">' + title + series + '<small>' + esc(i.notes || '') + '</small>' + (isOk(i) ? '' : whyLine(i)) + '</div>' + banner(i) + '</div>';
        return '<div class="' + cls + '"' + at + '>' + banner(i) + photoDiv(i) + '<div class="vg-bd">' + title + series + '<small>' + esc(String(i.notes || '').slice(0, 130)) + '</small>' + (isOk(i) ? '' : whyLine(i)) + '</div></div>';
    }
    function renderList() {
        var host = $('vgList'); if (!host) return;
        var items = filtered(); S.list = items;
        if (!items.length) {
            host.innerHTML = '<div class="vg-empty"><i class="fa-solid fa-folder-open" style="font-size:2rem;display:block;margin-bottom:8px;opacity:.6"></i>' + (window.getValasGallery().length ? 'Tidak ada acuan yang cocok. Coba kata kunci lain atau <a href="#" data-vg="reset" style="color:var(--vg-info)">reset filter</a>.' : 'Belum ada acuan valas.' + (isAdmin() ? ' Klik <b>Tambah Acuan</b> untuk memulai.' : ' Hubungi admin untuk menambahkan.')) + '</div>';
            return;
        }
        if (S.view === 'details') {
            host.innerHTML = '<div class="vg-tbl"><table class="vg-table"><thead><tr><th></th><th>Mata uang</th><th>Judul</th><th>Status</th><th>Seri / tahun</th><th>Alasan / catatan</th></tr></thead><tbody>' + items.map(function (i) {
                return '<tr data-vg="detail" data-id="' + esc(i.id) + '"><td><div class="vg-th" style="' + (i.photo ? 'background-image:url(\'' + esc(i.photo) + '\')' : '') + '"></div></td><td>' + flag(i.code) + ' <b>' + esc(String(i.code || '').toUpperCase()) + '</b></td><td>' + esc(i.desc || '-') + '</td>' +
                    '<td><span class="vg-tag ' + (isOk(i) ? 'ok' : 'no') + '">' + (isOk(i) ? 'DITERIMA' : 'TIDAK DITERIMA') + '</span></td><td>' + esc(i.series || '-') + '</td><td>' + esc(String((isOk(i) ? i.notes : (i.reason || i.notes)) || '').slice(0, 140)) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
            return;
        }
        host.innerHTML = '<div class="vg-grid v-' + S.view + '">' + items.map(cardHtml).join('') + '</div>';
    }
    function render() {
        injectStyle(); if (!shell()) return;
        var add = $('vgAdd'); if (add) add.style.display = isAdmin() ? '' : 'none';
        var sel = $('vgSort'); if (sel && sel.value !== S.sort) sel.value = S.sort;
        var vm = $('vgViewMenu'); if (vm) vm.innerHTML = viewMenuHtml();
        var vi = $('vgViewIcon'); if (vi) vi.className = viewDef()[2];
        renderGuide(); renderStats(); renderList();
        S.sig = signature();
    }
    function signature() { var raw = ls(KEY) || ''; return raw.length + ':' + raw.slice(-40); }

    // ------------------------------------------------------------ detail
    function detail(id) {
        var idx = S.list.map(function (x) { return x.id; }).indexOf(id), i = (idx > -1 ? S.list[idx] : window.getValasGallery().filter(function (x) { return x.id === id; })[0]);
        if (!i) return;
        var ok = isOk(i);
        openModal({ wide: true, title: flag(i.code) + ' ' + esc(String(i.code || '').toUpperCase()) + ' &middot; ' + esc(i.desc || ''), body:
            '<div class="vg-big ' + (ok ? 'ok' : 'no') + '"><i class="fa-solid ' + (ok ? 'fa-circle-check' : 'fa-ban') + '"></i><div>' + (ok ? 'DITERIMA &mdash; boleh dibeli' : 'TIDAK DITERIMA &mdash; tolak dengan sopan') +
            '<small>' + (ok ? 'Pastikan seri/tahun, warna, dan kondisi fisik sesuai foto acuan.' : esc(i.reason || 'Lihat catatan di bawah.')) + '</small></div></div>' +
            (i.photo ? '<div class="vg-zoom" id="vgZoom" data-vg="zoom"><img src="' + esc(i.photo) + '" alt="Foto acuan"></div><div class="vg-note" style="text-align:center">Klik gambar untuk memperbesar</div>' : '<div class="vg-empty">Tidak ada foto acuan</div>') +
            '<div style="margin-top:10px">' + (i.series ? '<div class="vg-kv"><span>Seri / tahun</span><b>' + esc(i.series) + '</b></div>' : '') + (!ok && i.reason ? '<div class="vg-kv"><span>Alasan ditolak</span><b style="color:var(--vg-no)">' + esc(i.reason) + '</b></div>' : '') +
            '<div class="vg-kv" style="display:block"><span>Ciri-ciri / catatan</span><div style="margin-top:4px;white-space:pre-wrap;line-height:1.5">' + (esc(i.notes) || '<span style="color:var(--vg-mut)">Tidak ada catatan tambahan.</span>') + '</div></div></div>' +
            '<div class="vg-nav"><button class="vg-btn sm" data-vg="nav" data-id="' + esc(idx > 0 ? S.list[idx - 1].id : '') + '" ' + (idx > 0 ? '' : 'disabled') + '><i class="fa-solid fa-chevron-left"></i> Sebelumnya</button><button class="vg-btn sm" data-vg="nav" data-id="' + esc(idx > -1 && idx < S.list.length - 1 ? S.list[idx + 1].id : '') + '" ' + (idx > -1 && idx < S.list.length - 1 ? '' : 'disabled') + '>Berikutnya <i class="fa-solid fa-chevron-right"></i></button></div>',
            footer: (isAdmin() ? '<button class="vg-btn bad" data-vg="del" data-id="' + esc(i.id) + '"><i class="fa-solid fa-trash"></i> Hapus</button><button class="vg-btn" data-vg="edit" data-id="' + esc(i.id) + '"><i class="fa-solid fa-pen"></i> Ubah</button>' : '') + '<button class="vg-btn pri" data-vg="close">Tutup</button>' });
    }

    // ------------------------------------------------------------ form tambah / ubah
    function resizeToDataUrl(file, max) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onerror = function () { reject(new Error('Gagal membaca file')); };
            fr.onload = function () {
                var img = new Image();
                img.onerror = function () { reject(new Error('File bukan gambar yang valid')); };
                img.onload = function () {
                    var sc = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.82));
                };
                img.src = fr.result;
            };
            fr.readAsDataURL(file);
        });
    }
    function formModal(id) {
        if (!isAdmin()) return toast('warning', 'Hanya admin / supervisor yang dapat mengubah galeri.');
        var it = id ? window.getValasGallery().filter(function (x) { return x.id === id; })[0] : null; it = it || { status: 'DITERIMA' };
        var codes = []; try { codes = (typeof getCurrencies === 'function' ? getCurrencies() : []).map(function (c) { return c.code; }).filter(Boolean); } catch (e) { /* abaikan */ }
        S.photo = it.photo || null; window.currentValasGalleryPhotoBase64 = S.photo;
        openModal({ title: id ? 'Ubah Acuan Valas' : 'Tambah Acuan Valas', dismissable: false, body:
            '<div class="vg-f"><label>Status penerimaan</label><div class="vg-seg" id="vgFSt" style="width:100%"><button type="button" style="flex:1" class="ok ' + (it.status === 'DITERIMA' ? 'on' : '') + '" data-vg="fst" data-v="DITERIMA">DITERIMA</button><button type="button" style="flex:1" class="no ' + (it.status !== 'DITERIMA' ? 'on' : '') + '" data-vg="fst" data-v="TIDAK_DITERIMA">TIDAK DITERIMA</button></div></div>' +
            '<div class="vg-r2"><div class="vg-f"><label>Kode mata uang</label><input class="vg-in" id="vgFCode" list="vgCodes" maxlength="6" style="text-transform:uppercase" value="' + esc(it.code || '') + '" placeholder="mis. USD"><datalist id="vgCodes">' + codes.map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join('') + '</datalist></div>' +
            '<div class="vg-f"><label>Seri / tahun (opsional)</label><input class="vg-in" id="vgFSeries" value="' + esc(it.series || '') + '" placeholder="mis. Seri 1996 / Cetakan 2013"></div></div>' +
            '<div class="vg-f"><label>Judul acuan</label><input class="vg-in" id="vgFDesc" value="' + esc(it.desc || '') + '" placeholder="mis. 100 Dollar seri biru"></div>' +
            '<div class="vg-f" id="vgFReasonBox" style="' + (it.status === 'DITERIMA' ? 'display:none' : '') + '"><label>Alasan ditolak (tampil jelas di kartu)</label><input class="vg-in" id="vgFReason" value="' + esc(it.reason || '') + '" placeholder="mis. Seri lama sudah ditarik dari peredaran"></div>' +
            '<div class="vg-f"><label>Ciri-ciri / cara memeriksa</label><textarea class="vg-in" id="vgFNotes" rows="4" placeholder="mis. Benang pengaman, watermark, ukuran, warna utama...">' + esc(it.notes || '') + '</textarea></div>' +
            '<div class="vg-f"><label>Foto acuan</label><div class="vg-drop" id="vgFDrop" data-vg="pickfile">' + (it.photo ? '<img id="vgFImg" src="' + esc(it.photo) + '" alt="">' : '<img id="vgFImg" style="display:none" alt="">') + '<span id="vgFHint">Klik untuk ambil foto / pilih file</span></div><input type="file" id="vgFFile" accept="image/*" hidden></div>' +
            '<div id="vgErr" style="display:none;color:var(--vg-no);font-weight:700;font-size:.84rem"></div>',
            footer: '<button class="vg-btn" data-vg="close">Batal</button><button class="vg-btn pri" id="vgSave" data-vg="save" data-id="' + esc(id || '') + '" data-status="' + esc(it.status) + '">Simpan</button>',
            onOpen: function (ov) {
                if (typeof window.attachIsoPicker === 'function') window.attachIsoPicker(ov.querySelector('#vgFCode'), { title: 'Pilih Kode Mata Uang (ISO 4217)', onPick: function (it) { var d = ov.querySelector('#vgFDesc'); if (d && !d.value.trim()) d.value = it.name; } });
                ov.querySelector('#vgFFile').addEventListener('change', async function (e) {
                    var f = e.target.files && e.target.files[0]; if (!f) return;
                    try { S.photo = await resizeToDataUrl(f, 1100); window.currentValasGalleryPhotoBase64 = S.photo; var im = $('vgFImg'); im.src = S.photo; im.style.display = 'block'; $('vgFHint').textContent = 'Klik untuk mengganti foto'; }
                    catch (err) { var er = $('vgErr'); er.style.display = 'block'; er.textContent = err.message; }
                });
            } });
    }
    async function saveItem(id, status) {
        var code = ($('vgFCode').value || '').trim().toUpperCase(), desc = ($('vgFDesc').value || '').trim(), er = $('vgErr');
        var fail = function (m) { er.style.display = 'block'; er.textContent = m; };
        if (!code) return fail('Kode mata uang wajib diisi.'); if (!desc) return fail('Judul acuan wajib diisi.');
        var reason = ($('vgFReason').value || '').trim();
        if (status !== 'DITERIMA' && !reason) return fail('Isi alasan ditolak agar teller paham mengapa uang ini tidak diterima.');
        var btn = $('vgSave'), old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        var photo = S.photo || null;
        try {
            if (photo && photo.indexOf('data:') === 0 && typeof window.uploadBase64FileToFolder === 'function') {
                photo = await withTimeout(window.uploadBase64FileToFolder(photo, 'transactions/proofs', 'valas-' + code), 30000, 'Upload foto terlalu lama. Periksa koneksi lalu coba lagi.');
            }
        } catch (e) { btn.disabled = false; btn.innerHTML = old; return fail('Gagal upload foto: ' + (e.message || e)); }
        var list = window.getValasGallery(), now = new Date().toISOString();
        var row = { id: id || ('GAL' + Date.now()), code: code, status: status, desc: desc, notes: ($('vgFNotes').value || '').trim(), photo: photo, series: ($('vgFSeries').value || '').trim(), reason: status === 'DITERIMA' ? '' : reason, updatedAt: now };
        if (id) { var at = list.findIndex(function (x) { return x.id === id; }); if (at > -1) list[at] = Object.assign({}, list[at], row); else list.push(row); } else list.push(row);
        window.saveValasGallery(list); S.featCache = {};
        closeModal(); render(); toast('success', 'Acuan valas disimpan');
    }
    async function delItem(id) {
        var ok;
        if (window.Swal) ok = (await window.Swal.fire({ icon: 'warning', title: 'Hapus acuan ini?', text: 'Tidak bisa dibatalkan.', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal' })).isConfirmed; else ok = confirm('Hapus acuan valas ini?');
        if (!ok) return;
        window.saveValasGallery(window.getValasGallery().filter(function (x) { return x.id !== id; }));
        closeModal(); render(); toast('success', 'Acuan dihapus');
    }

    // ------------------------------------------------------------ pencarian dengan foto (kemiripan visual di browser)
    var FW = 96, FH = 48;
    S.featCache = {};
    function normCanvas(img) {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; if (!w || !h) return null;
        var c = document.createElement('canvas'); c.width = FW; c.height = FH;
        var x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#808080'; x.fillRect(0, 0, FW, FH);
        var m = 0.06, sx = w * m, sy = h * m, sw = w * (1 - 2 * m), sh = h * (1 - 2 * m);
        if (h > w) { x.save(); x.translate(FW / 2, FH / 2); x.rotate(Math.PI / 2); x.drawImage(img, sx, sy, sw, sh, -FH / 2, -FW / 2, FH, FW); x.restore(); }
        else x.drawImage(img, sx, sy, sw, sh, 0, 0, FW, FH);
        return c;
    }
    function featuresOf(canvas, flip) {
        var d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, FW, FH).data, n = FW * FH;
        var px = function (i) { var k = (flip ? (n - 1 - i) : i) * 4; return [d[k], d[k + 1], d[k + 2]]; };
        var g = new Float32Array(24 * 12), cnt = new Float32Array(24 * 12), L = new Float32Array(6 * 3 * 3), lc = new Float32Array(18), H = new Float32Array(12), hsum = 0;
        for (var y = 0; y < FH; y++) for (var xx = 0; xx < FW; xx++) {
            var p = px(y * FW + xx), r = p[0], gg = p[1], b = p[2], gray = 0.299 * r + 0.587 * gg + 0.114 * b;
            var gi = Math.floor(y / 4) * 24 + Math.floor(xx / 4); g[gi] += gray; cnt[gi]++;
            var li = Math.floor(y / 16) * 6 + Math.floor(xx / 16); L[li * 3] += r; L[li * 3 + 1] += gg; L[li * 3 + 2] += b; lc[li]++;
            var mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
            if (s > 0.18 && v > 0.15) {
                var hue; var df = mx - mn;
                if (mx === r) hue = ((gg - b) / df) % 6; else if (mx === gg) hue = (b - r) / df + 2; else hue = (r - gg) / df + 4;
                hue = (hue * 60 + 360) % 360; var w = s * v; H[Math.floor(hue / 30) % 12] += w; hsum += w;
            }
        }
        var mean = 0, i; for (i = 0; i < g.length; i++) { g[i] /= cnt[i]; mean += g[i]; } mean /= g.length;
        var sd = 0; for (i = 0; i < g.length; i++) { g[i] -= mean; sd += g[i] * g[i]; } sd = Math.sqrt(sd / g.length) || 1; for (i = 0; i < g.length; i++) g[i] /= sd;
        for (i = 0; i < 18; i++) { L[i * 3] /= lc[i]; L[i * 3 + 1] /= lc[i]; L[i * 3 + 2] /= lc[i]; }
        if (hsum > 0) for (i = 0; i < 12; i++) H[i] /= hsum;
        return { g: g, l: L, h: H, hs: hsum };
    }
    function similarity(a, b) {
        var i, dot = 0; for (i = 0; i < a.g.length; i++) dot += a.g[i] * b.g[i]; var gs = Math.max(0, dot / a.g.length);
        var dist = 0; for (i = 0; i < 18; i++) { var dr = a.l[i * 3] - b.l[i * 3], dg = a.l[i * 3 + 1] - b.l[i * 3 + 1], db = a.l[i * 3 + 2] - b.l[i * 3 + 2]; dist += Math.sqrt(dr * dr + dg * dg + db * db); }
        var ls = Math.max(0, 1 - (dist / 18 / 441.67) * 2.5);
        var hs = 0; for (i = 0; i < 12; i++) hs += Math.min(a.h[i], b.h[i]); if (!a.hs || !b.hs) hs = 0.5;
        return 0.4 * gs + 0.35 * ls + 0.25 * hs;
    }
    function loadImg(src, cors) {
        return new Promise(function (resolve, reject) {
            var im = new Image(); if (cors) im.crossOrigin = 'anonymous';
            im.onload = function () { resolve(im); }; im.onerror = function () { reject(new Error('gagal memuat')); }; im.src = src;
        });
    }
    async function featOfItem(i) {
        var key = i.id + '|' + i.photo; if (S.featCache[key] !== undefined) return S.featCache[key];
        var f = null;
        try {
            var im; try { im = await loadImg(i.photo, true); } catch (e) { im = await loadImg(i.photo, false); }
            var c = normCanvas(im); if (c) f = featuresOf(c, false);
        } catch (e) { f = null; }
        S.featCache[key] = f; return f;
    }
    async function runPhotoSearch(dataUrl) {
        var token = ++S.ph.token, out = $('vgLensOut'); if (!out) return;
        var items = window.getValasGallery().filter(function (i) { return i.photo; });
        if (!items.length) { out.innerHTML = '<div class="vg-empty">Belum ada foto acuan di galeri untuk dibandingkan.</div>'; return; }
        out.innerHTML = '<div class="vg-note"><i class="fa-solid fa-spinner fa-spin"></i> Membandingkan dengan ' + items.length + ' foto acuan...</div>';
        var q;
        try { var im = await loadImg(dataUrl, false), c = normCanvas(im); q = [featuresOf(c, false), featuresOf(c, true)]; }
        catch (e) { out.innerHTML = '<div class="vg-empty">Foto tidak bisa dibaca. Coba foto lain.</div>'; return; }
        var scored = [], skipped = 0;
        for (var k = 0; k < items.length; k++) {
            if (token !== S.ph.token) return;
            var f = await featOfItem(items[k]);
            if (!f) { skipped++; continue; }
            scored.push({ item: items[k], score: Math.max(similarity(q[0], f), similarity(q[1], f)) });
        }
        if (token !== S.ph.token) return;
        scored.sort(function (a, b) { return b.score - a.score; });
        var top = scored.slice(0, 6);
        if (!top.length) { out.innerHTML = '<div class="vg-empty">Tidak ada foto acuan yang bisa dibandingkan.</div>'; return; }
        var best = top[0], bp = Math.round(best.score * 100);
        var verdict = bp >= 70 ? 'Sangat mirip dengan acuan teratas' : (bp >= 55 ? 'Mirip dengan acuan teratas' : 'Tidak ada yang benar-benar mirip');
        out.innerHTML = '<div class="vg-note" style="margin-top:12px"><b>' + verdict + '.</b> ' + (bp < 55 ? 'Mungkin uang ini belum ada di galeri &mdash; <b>jangan diterima dulu</b>, tanyakan supervisor.' : 'Buka kartu untuk melihat status dan ciri-cirinya.') + '</div>' + top.map(function (r) {
            var i = r.item, p = Math.round(r.score * 100);
            return '<div class="vg-res ' + (isOk(i) ? 'ok' : 'no') + '" data-vg="detail" data-id="' + esc(i.id) + '"><div class="vg-ph" style="background-image:url(\'' + esc(i.photo) + '\')"></div><div style="min-width:0"><b>' + flag(i.code) + ' ' + esc(String(i.code).toUpperCase()) + ' &middot; ' + esc(i.desc || '') + '</b>' +
                '<div style="margin-top:4px"><span class="vg-tag ' + (isOk(i) ? 'ok' : 'no') + '">' + (isOk(i) ? 'DITERIMA' : 'TIDAK DITERIMA') + '</span></div></div><div class="vg-sim"><b>' + p + '%</b>kemiripan<i style="width:' + Math.max(6, p) + '%"></i></div></div>';
        }).join('') + '<div class="vg-note">Pencarian ini membandingkan warna, pola, dan tata letak secara visual &mdash; hasilnya <b>perkiraan</b>. Selalu cocokkan seri, tahun, dan ciri-ciri fisik sebelum memutuskan.' + (skipped ? ' (' + skipped + ' foto acuan tidak bisa dibaca.)' : '') + '</div>';
    }
    function lensModal() {
        S.ph.token++;
        openModal({ wide: true, title: '<i class="fa-solid fa-camera"></i> Cari dengan Foto', body:
            '<p class="vg-note" style="margin-top:0">Foto uang pelanggan (letakkan di permukaan polos, terang, tanpa pantulan) atau pilih gambar. Bisa juga tempel gambar dengan <b>Ctrl+V</b> atau seret ke kotak di bawah. Foto diproses di perangkat ini dan tidak dikirim ke server.</p>' +
            '<div class="vg-drop" id="vgDrop" data-vg="lenspick"><i class="fa-solid fa-cloud-arrow-up" style="font-size:1.8rem;display:block;margin-bottom:6px"></i><img id="vgLensImg" style="display:none" alt=""><span id="vgLensHint">Klik untuk pilih foto, atau seret ke sini</span></div>' +
            '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="vg-btn" data-vg="lenscam"><i class="fa-solid fa-camera"></i> Ambil foto dengan kamera</button></div>' +
            '<input type="file" id="vgLensFile" accept="image/*" hidden><input type="file" id="vgLensCam" accept="image/*" capture="environment" hidden><div id="vgLensOut"></div>',
            footer: '<button class="vg-btn pri" data-vg="close">Tutup</button>',
            onOpen: function (ov) {
                var handle = async function (file) {
                    if (!file || !/^image\//.test(file.type || 'image/')) return;
                    try { var url = await resizeToDataUrl(file, 900); showLensImage(url); runPhotoSearch(url); } catch (e) { $('vgLensOut').innerHTML = '<div class="vg-empty">' + esc(e.message) + '</div>'; }
                };
                ov._handle = handle;
                ['vgLensFile', 'vgLensCam'].forEach(function (id) { ov.querySelector('#' + id).addEventListener('change', function (e) { handle(e.target.files && e.target.files[0]); e.target.value = ''; }); });
                var drop = ov.querySelector('#vgDrop');
                ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
                ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); if (t === 'drop' && e.dataTransfer && e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); }); });
            } });
    }
    function showLensImage(url) { var im = $('vgLensImg'); if (im) { im.src = url; im.style.display = 'block'; $('vgLensHint').textContent = 'Klik untuk mengganti foto'; } }

    // ------------------------------------------------------------ event
    function onClick(e) {
        var el = e.target.closest('[data-vg]'); if (!el) return;
        var a = el.dataset.vg, id = el.dataset.id, v = el.dataset.v;
        if (el.tagName === 'A') e.preventDefault();
        switch (a) {
            case 'close': closeModal(); break;
            case 'viewmenu': { var m = $('vgViewMenu'); if (m) m.hidden = !m.hidden; break; }
            case 'view': S.view = v; try { localStorage.setItem('vg_view_mode', v); } catch (x) { /* abaikan */ } render(); break;
            case 'st': S.status = v; renderStats(); renderList(); break;
            case 'cur': S.cur = v; renderStats(); renderList(); break;
            case 'reset': S.q = ''; S.status = 'ALL'; S.cur = ''; S.sort = 'code'; var q = $('vgQ'); if (q) q.value = ''; render(); break;
            case 'guide': S.guideOpen = !S.guideOpen; try { localStorage.setItem('vg_guide_closed', S.guideOpen ? '0' : '1'); } catch (x) { /* abaikan */ } renderGuide(); break;
            case 'lens': lensModal(); break;
            case 'lenspick': { var f = $('vgLensFile'); if (f) f.click(); break; }
            case 'lenscam': { var c = $('vgLensCam'); if (c) c.click(); break; }
            case 'add': formModal(); break;
            case 'edit': formModal(id); break;
            case 'del': delItem(id); break;
            case 'detail': if (id) detail(id); break;
            case 'nav': if (id) detail(id); break;
            case 'zoom': { var z = $('vgZoom'); if (z) z.classList.toggle('z'); break; }
            case 'fst': {
                document.querySelectorAll('#vgFSt button').forEach(function (b) { b.classList.toggle('on', b === el); });
                var rb = $('vgFReasonBox'); if (rb) rb.style.display = v === 'DITERIMA' ? 'none' : '';
                var sv = $('vgSave'); if (sv) sv.dataset.status = v; break;
            }
            case 'pickfile': { var ff = $('vgFFile'); if (ff) ff.click(); break; }
            case 'save': saveItem(id, el.dataset.status); break;
        }
    }
    function softRender() {
        var r = $('vgRoot'); if (!r || r.offsetParent === null) return;
        if (signature() === S.sig) return;
        var a = document.activeElement;
        if (modalOpen() || (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && r.contains(a))) return;
        render();
    }
    function bind() {
        if (S.bound) return; S.bound = true;
        document.addEventListener('click', function (e) {
            if (e.target.closest('#vgRoot,#vgModal')) onClick(e);
            var m = $('vgViewMenu'); if (m && !m.hidden && !e.target.closest('.vg-vw')) m.hidden = true;
        });
        document.addEventListener('input', function (e) { if (e.target.id === 'vgQ') { S.q = e.target.value; renderList(); } });
        document.addEventListener('change', function (e) { if (e.target.id === 'vgSort') { S.sort = e.target.value; renderList(); } });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalOpen()) closeModal(); });
        document.addEventListener('paste', function (e) {
            var ov = $('vgModal'); if (!ov || !ov._handle || !e.clipboardData) return;
            var files = Array.prototype.slice.call(e.clipboardData.files || []).filter(function (f) { return /^image\//.test(f.type); });
            if (files[0]) { e.preventDefault(); ov._handle(files[0]); }
        });
        S.timer = setInterval(softRender, 4000);
    }

    // ------------------------------------------------------------ API publik (nama lama tetap)
    function init() { loadPrefs(); bind(); render(); var q = $('vgQ'); if (q && q.value !== S.q) q.value = S.q; }
    window.initValasGalleryView = init;
    window.loadValasGalleryGrid = function () { if ($('vgRoot') && $('vgRoot').dataset.ready === '1') { renderStats(); renderList(); } else init(); };
    window.resetValasGalleryFilter = function () { S.q = ''; S.status = 'ALL'; S.cur = ''; if ($('vgRoot')) render(); };
    window.openValasGalleryModal = function (id) { bind(); formModal(id); };
    window.closeValasGalleryModal = closeModal;
    window.saveValasGalleryItem = function () { toast('info', 'Gunakan tombol Simpan pada form.'); };
    window.deleteValasGalleryItem = delItem;
    window.previewValasGalleryPhoto = function () { /* diganti form baru */ };
    window.applyIso4217ToValasGalleryForm = function (code, country, currencyName) {
        bind(); formModal();
        if ($('vgFCode')) $('vgFCode').value = String(code || '').toUpperCase().slice(0, 6);
        if ($('vgFDesc') && !$('vgFDesc').value.trim()) $('vgFDesc').value = currencyName || country || code || '';
        if (typeof window.closeIso4217Modal === 'function') window.closeIso4217Modal();
    };
    // tombol cepat dari form Transaksi: buka galeri dengan pencarian kode valas terpilih
    window.quickOpenValasGallery = function () {
        var sel = document.getElementById('trxCurrency'), code = '';
        if (sel) { var opt = sel.options[sel.selectedIndex]; if (opt && opt.value) code = String(opt.text || opt.value).split(' ')[0].replace(/[^A-Z]/gi, '').toUpperCase(); }
        var nav = document.querySelector('.nav-item[data-target="valas-gallery-view"]'); if (nav) nav.click();
        setTimeout(function () { S.q = code; S.status = 'ALL'; S.cur = ''; render(); var q = $('vgQ'); if (q) q.value = code; }, 30);
    };
    document.addEventListener('click', function (e) {
        var n = e.target.closest && e.target.closest('.nav-item');
        if (n && n.getAttribute('data-target') === 'valas-gallery-view') setTimeout(init, 0);
    });
})();
