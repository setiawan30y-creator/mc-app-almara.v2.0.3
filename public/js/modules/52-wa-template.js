// @2026-Alifiandra
/* =====================================================================
 * 52-wa-template.js  —  Pengaturan > Template WA
 *
 *  - Daftar template + editor + pratinjau pesan (memakai mesin yang sama dengan
 *    tombol WA: window.renderWaTemplate di 01-core.js), jadi apa yang terlihat di
 *    pratinjau = isi pesan yang benar-benar terkirim.
 *  - "Peruntukan" menentukan template mana yang dipakai tiap tombol WA di aplikasi.
 *    Satu peruntukan hanya boleh dimiliki satu template; sisanya memakai template default.
 *  - Memindahkan template lama dari Profil Perusahaan (mc_profile.waTemplate) ke daftar
 *    template, supaya hanya ada satu tempat mengelola isi pesan.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcWaTemplateUI) return;
    window.__mcWaTemplateUI = true;

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var MAX_LEN = 4000;

    var PURPOSES = [
        { id: 'pos', label: 'Kasir: bukti transaksi', where: 'Tombol WA setelah transaksi di halaman Kasir (POS)' },
        { id: 'pos-thanks', label: 'Kasir: ucapan terima kasih otomatis', where: 'Opsi "kirim WA otomatis" di Kasir (lewat WA Gateway)' },
        { id: 'riwayat', label: 'Riwayat transaksi', where: 'Tombol WA di Laporan / Riwayat Transaksi' },
        { id: 'booking', label: 'Booking valas', where: 'Tombol WA di halaman Booking' },
        { id: 'old-money', label: 'Koin & uang lama', where: 'Tombol WA bukti di Koin & Uang Lama' },
        { id: 'kurs', label: 'Kirim kurs', where: 'Tombol Kirim Kurs via WA' },
        { id: 'broadcast', label: 'Broadcast nasabah', where: 'Pesan massal ke nasabah terpilih' },
        { id: 'customer', label: 'Kontak nasabah', where: 'Tombol WA di data Nasabah' }
    ];
    window.WA_TEMPLATE_PURPOSES = PURPOSES;
    var PURPOSE_IDS = PURPOSES.map(function (p) { return p.id; });

    var S = { editId: '', built: false, focusTa: true };

    function list() { try { return (typeof getWaTemplates === 'function' ? getWaTemplates() : []) || []; } catch (e) { return []; } }
    function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function purposesOf(t) { return Array.isArray(t && t.purposes) ? t.purposes.filter(function (p) { return PURPOSE_IDS.indexOf(p) > -1; }) : []; }
    function purposeLabel(id) { var p = PURPOSES.filter(function (x) { return x.id === id; })[0]; return p ? p.label : id; }

    function say(type, text) {
        if (typeof Swal !== 'undefined' && Swal.fire) {
            return Swal.fire({ icon: type, title: type === 'success' ? 'Tersimpan' : (type === 'info' ? 'Info' : 'Belum bisa disimpan'), text: text, timer: type === 'success' ? 1600 : undefined, showConfirmButton: type !== 'success' });
        }
        alert(text); return Promise.resolve();
    }
    function confirmBox(title, text, yes) {
        if (typeof Swal !== 'undefined' && Swal.fire) {
            return Swal.fire({ icon: 'warning', title: title, text: text, showCancelButton: true, confirmButtonText: yes, cancelButtonText: 'Batal', reverseButtons: true })
                .then(function (r) { return !!r.isConfirmed; });
        }
        return Promise.resolve(window.confirm(title + '\n\n' + text));
    }

    /* ---------- migrasi: template lama di Profil -> daftar template ---------- */
    window.migrateProfileWaTemplate = function () {
        try {
            if (typeof getProfile !== 'function') return;
            var p = getProfile();
            if (!p || typeof p.waTemplate === 'undefined') return;
            var content = String(p.waTemplate || '').trim();
            var all = list();
            var base = typeof DEFAULT_WA_TEMPLATE === 'string' ? DEFAULT_WA_TEMPLATE : '';
            if (content && norm(content) !== norm(base) && !all.some(function (t) { return norm(t.content) === norm(content); })) {
                var hasPos = all.some(function (t) { return purposesOf(t).indexOf('pos') > -1; });
                var id = all.some(function (t) { return t.id === 'wa-bukti-digital'; }) ? 'wa-bukti-digital-' + Date.now() : 'wa-bukti-digital';
                all = all.concat([{ id: id, name: 'Bukti Digital (dari Profil)', category: 'Transaksi', content: content, purposes: hasPos ? [] : ['pos'], isDefault: all.length === 0 }]);
                saveWaTemplates(all);
            }
            var next = {}; Object.keys(p).forEach(function (k) { if (k !== 'waTemplate') next[k] = p[k]; });
            saveProfile(next);
        } catch (e) { /* abaikan */ }
    };

    /* ---------- gaya ---------- */
    function injectStyle() {
        if ($('wt-style')) return;
        var st = document.createElement('style');
        st.id = 'wt-style';
        st.textContent = [
            '.wt{--wt-bd:var(--mc-border,rgba(148,163,184,.35));--wt-mut:var(--mc-text-muted,#94a3b8);--wt-inp:var(--mc-input-bg,rgba(15,23,42,.45));--wt-pri:var(--mc-primary,#2563eb);display:grid;gap:16px}',
            '.wt-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.wt-head h2{margin:0;font-size:1.2rem}',
            '.wt-head p{margin:4px 0 0;color:var(--wt-mut);font-size:.85rem;max-width:640px;line-height:1.5}.wt-head .btn{margin-left:auto}',
            '.wt-grid{display:grid;grid-template-columns:minmax(300px,.95fr) minmax(340px,1.25fr);gap:16px;align-items:start}',
            '@media(max-width:980px){.wt-grid{grid-template-columns:1fr}}',
            '.wt-card{border:1px solid var(--wt-bd);border-radius:14px;padding:16px 18px}',
            '.wt-card>h3{margin:0 0 12px;font-size:.95rem}',
            '.wt-card small,.wt .wt-help{color:var(--wt-mut);display:block;line-height:1.45;font-size:.8rem}',
            '.wt-items{display:grid;gap:10px}',
            '.wt-item{border:1px solid var(--wt-bd);border-radius:12px;padding:12px 14px;display:grid;gap:6px}',
            '.wt-item.on{border-color:var(--wt-pri);box-shadow:0 0 0 1px var(--wt-pri) inset}',
            '.wt-item-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.wt-item-top b{font-size:.92rem}',
            '.wt-tag{font-size:.7rem;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(148,163,184,.16);color:var(--wt-mut)}',
            '.wt-tag.def{background:rgba(34,197,94,.16);color:#4ade80}.wt-tag.use{background:rgba(37,211,102,.12);color:#4ade80}',
            '.wt-snip{font-size:.8rem;color:var(--wt-mut);line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:pre-line}',
            '.wt-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}',
            '.wt-btn{border:1px solid var(--wt-bd);background:transparent;color:inherit;border-radius:8px;padding:4px 11px;font-size:.78rem;cursor:pointer;font-family:inherit}',
            '.wt-btn:hover{background:var(--wt-inp)}.wt-btn.danger:hover{border-color:#f87171;color:#f87171}',
            '.wt-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 16px}.wt-fields .wide{grid-column:1/-1}',
            '.wt label.wt-l{display:block;font-size:.8rem;font-weight:600;margin:0 0 5px}',
            '.wt .form-control{width:100%;box-sizing:border-box}',
            '.wt textarea.form-control{min-height:190px;line-height:1.55;resize:vertical}',
            '.wt-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 0}',
            '.wt-chips button{border:1px dashed var(--wt-bd);background:transparent;color:inherit;border-radius:8px;padding:3px 9px;font-size:.76rem;cursor:pointer;font-family:ui-monospace,Menlo,Consolas,monospace}',
            '.wt-chips button:hover{background:var(--wt-inp);border-style:solid}',
            '.wt-meta{display:flex;justify-content:space-between;gap:10px;font-size:.76rem;color:var(--wt-mut);margin-top:4px}',
            '.wt-warn{font-size:.78rem;color:#fbbf24;margin-top:4px;display:none}.wt-warn.show{display:block}',
            '.wt-purp{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px}',
            '.wt-purp label{display:flex;gap:9px;align-items:flex-start;padding:9px 11px;border:1px solid var(--wt-bd);border-radius:10px;cursor:pointer;font-size:.82rem;line-height:1.35}',
            '.wt-purp label:hover{background:var(--wt-inp)}.wt-purp input{margin-top:2px;accent-color:var(--wt-pri);flex:none}',
            '.wt-purp label small{margin-top:2px}.wt-purp .taken{display:block;color:#fbbf24;font-size:.72rem;margin-top:2px}',
            '.wt-switch{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.wt-switch input{margin-top:3px;accent-color:var(--wt-pri)}',
            '.wt-prev{background:#0b141a;border-radius:12px;padding:14px;min-height:80px}',
            '.wt-bubble{background:#005c4b;color:#e9edef;border-radius:10px 10px 2px 10px;padding:9px 12px;max-width:100%;font-size:.86rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 1px 1px rgba(0,0,0,.3)}',
            '.wt-bar{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}',
            '.wt-usage{width:100%;border-collapse:collapse;font-size:.82rem}',
            '.wt-usage th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--wt-mut);padding:6px 8px;border-bottom:1px solid var(--wt-bd)}',
            '.wt-usage td{padding:8px;border-bottom:1px solid var(--wt-bd);vertical-align:top}.wt-usage tr:last-child td{border-bottom:0}.wt-usage td small{margin-top:2px}'
        ].join('\n');
        document.head.appendChild(st);
    }

    /* ---------- kerangka ---------- */
    function build(root) {
        injectStyle();
        var chips = (window.WA_TAGS || []).map(function (t) {
            return '<button type="button" data-tag="[' + esc(t.tag) + ']" title="' + esc(t.desc) + '">[' + esc(t.tag) + ']</button>';
        }).join('');
        var purp = PURPOSES.map(function (p) {
            return '<label><input type="checkbox" class="wa-template-purpose" value="' + p.id + '"><span><b>' + esc(p.label) + '</b><small>' + esc(p.where) + '</small><span class="taken" data-taken="' + p.id + '"></span></span></label>';
        }).join('');

        root.innerHTML =
            '<div class="wt">' +
            '<div class="wt-head"><div><h2><i class="fa-brands fa-whatsapp" style="color:#25D366;"></i> Template WhatsApp</h2>' +
            '<p>Kelola isi pesan WhatsApp. Atur peruntukan tiap template agar tombol WA di setiap halaman memakai pesan yang tepat. Pengiriman memakai WA Gateway yang diatur di tab WA Gateway.</p></div>' +
            '<button type="button" class="btn btn-success" data-act="new"><i class="fa-solid fa-plus"></i> Template Baru</button></div>' +

            '<div class="wt-grid">' +
            '<div style="display:grid;gap:16px;">' +
            '<div class="wt-card"><h3>Daftar Template</h3><div class="wt-items" id="waTemplatesList"></div></div>' +
            '<div class="wt-card"><h3>Pemakaian per Tombol WA</h3><small style="margin-bottom:8px;">Template yang akan dipakai tiap tombol saat ini. Tombol tanpa template khusus memakai template default.</small><div style="overflow-x:auto;"><table class="wt-usage"><thead><tr><th>Tombol / halaman</th><th>Template</th></tr></thead><tbody id="waTemplateUsage"></tbody></table></div></div>' +
            '</div>' +

            '<div class="wt-card"><h3 id="wtEditTitle">Template Baru</h3>' +
            '<input type="hidden" id="waTemplateId">' +
            '<div class="wt-fields">' +
            '<div><label class="wt-l" for="waTemplateName">Nama template</label><input type="text" id="waTemplateName" class="form-control" maxlength="80" placeholder="Nama template"></div>' +
            '<div><label class="wt-l" for="waTemplateCategory">Kategori</label><input type="text" id="waTemplateCategory" class="form-control" maxlength="40" placeholder="Mis. Transaksi, Informasi" list="wtCats"><datalist id="wtCats"><option value="Transaksi"><option value="Informasi"><option value="Promosi"><option value="Pengingat"></datalist></div>' +
            '<div class="wide"><label class="wt-l" for="waTemplateContent">Isi pesan</label><textarea id="waTemplateContent" class="form-control" maxlength="' + MAX_LEN + '" placeholder="Tulis isi pesan. Klik tag di bawah untuk menyisipkan data otomatis."></textarea>' +
            '<div class="wt-chips" id="wtChips">' + chips + '</div>' +
            '<div class="wt-meta"><span id="wtTagHint">Gunakan *teks* untuk tebal dan _teks_ untuk miring (format WhatsApp).</span><span id="wtCount">0 / ' + MAX_LEN + '</span></div>' +
            '<div class="wt-warn" id="wtUnknown"></div></div>' +
            '<div class="wide"><label class="wt-l">Peruntukan (tombol yang memakai template ini)</label><small style="margin-bottom:8px;">Boleh kosong. Satu peruntukan hanya dimiliki satu template; jika sudah dipakai template lain, peruntukan itu dipindahkan ke template ini saat disimpan.</small><div class="wt-purp" id="waTemplatePurposes">' + purp + '</div></div>' +
            '<div class="wide"><label class="wt-switch"><input type="checkbox" id="waTemplateDefault"><span><b>Jadikan template default</b><small>Dipakai tombol WA yang tidak punya template khusus.</small></span></label></div>' +
            '<div class="wide"><label class="wt-l">Pratinjau</label><div class="wt-prev"><div class="wt-bubble" id="wtPreview"></div></div><small style="margin-top:6px;">Data nasabah dan transaksi pada pratinjau adalah contoh. Nama dan nomor perusahaan diambil dari Profil.</small></div>' +
            '</div>' +
            '<div class="wt-bar"><button type="button" class="btn btn-primary" data-act="save"><i class="fa-solid fa-floppy-disk"></i> Simpan Template</button>' +
            '<button type="button" class="btn btn-secondary" data-act="new"><i class="fa-solid fa-eraser"></i> Kosongkan</button></div>' +
            '</div>' +
            '</div></div>';

        root.addEventListener('click', onClick);
        root.addEventListener('input', function (e) { if (e.target && (e.target.id === 'waTemplateContent')) refreshEditorMeta(); });
        root.addEventListener('change', function (e) { if (e.target && e.target.classList && e.target.classList.contains('wa-template-purpose')) refreshTaken(); });
        root.addEventListener('focusin', function (e) { S.focusTa = e.target && e.target.id === 'waTemplateContent' ? true : S.focusTa; });
        S.built = true;
    }

    /* ---------- tampilan data ---------- */
    function renderList() {
        var box = $('waTemplatesList'); if (!box) return;
        var all = list();
        if (!all.length) { box.innerHTML = '<small>Belum ada template. Klik "Template Baru".</small>'; return; }
        box.innerHTML = all.map(function (t) {
            var uses = purposesOf(t).map(function (p) { return '<span class="wt-tag use">' + esc(purposeLabel(p)) + '</span>'; }).join('');
            return '<div class="wt-item' + (t.id === S.editId ? ' on' : '') + '">' +
                '<div class="wt-item-top"><b>' + esc(t.name || 'Tanpa nama') + '</b>' + (t.isDefault ? '<span class="wt-tag def">Default</span>' : '') +
                '<span class="wt-tag">' + esc(t.category || '-') + '</span></div>' +
                (uses ? '<div class="wt-item-top">' + uses + '</div>' : '') +
                '<div class="wt-snip">' + esc(String(t.content || '').slice(0, 220)) + '</div>' +
                '<div class="wt-acts"><button type="button" class="wt-btn" data-act="edit" data-id="' + esc(t.id) + '"><i class="fa-solid fa-pen"></i> Ubah</button>' +
                '<button type="button" class="wt-btn" data-act="dup" data-id="' + esc(t.id) + '"><i class="fa-regular fa-copy"></i> Duplikat</button>' +
                '<button type="button" class="wt-btn danger" data-act="del" data-id="' + esc(t.id) + '"><i class="fa-solid fa-trash"></i> Hapus</button></div></div>';
        }).join('');
    }

    function renderUsage() {
        var body = $('waTemplateUsage'); if (!body) return;
        var get = typeof window.getWaTemplateForPurpose === 'function' ? window.getWaTemplateForPurpose : function () { return null; };
        body.innerHTML = PURPOSES.map(function (p) {
            var t = get(p.id), own = t && purposesOf(t).indexOf(p.id) > -1;
            return '<tr><td><b>' + esc(p.label) + '</b><small>' + esc(p.where) + '</small></td><td>' + (t ? esc(t.name) : '-') +
                '<small>' + (own ? 'Template khusus' : 'Template default') + '</small></td></tr>';
        }).join('');
    }

    function refreshTaken() {
        var all = list();
        PURPOSES.forEach(function (p) {
            var el = document.querySelector('[data-taken="' + p.id + '"]'); if (!el) return;
            var cb = document.querySelector('.wa-template-purpose[value="' + p.id + '"]');
            var owner = all.filter(function (t) { return t.id !== ($('waTemplateId').value || '') && purposesOf(t).indexOf(p.id) > -1; })[0];
            el.textContent = (cb && cb.checked && owner) ? 'Dipindahkan dari "' + (owner.name || 'template lain') + '"' : (owner ? 'Saat ini: ' + (owner.name || 'template lain') : '');
        });
    }

    function refreshEditorMeta() {
        var ta = $('waTemplateContent'); if (!ta) return;
        var v = ta.value;
        $('wtCount').textContent = v.length + ' / ' + MAX_LEN;
        var tags = (window.WA_TAGS || []).map(function (t) { return t.tag; });
        var unknown = [];
        (v.match(/\[[A-Za-z_]+\]/g) || []).forEach(function (m) {
            var k = m.slice(1, -1).toUpperCase();
            if (tags.indexOf(k) < 0 && ['PELANGGAN', 'NASABAH', 'NAMA'].indexOf(k) < 0 && unknown.indexOf(m) < 0) unknown.push(m);
        });
        var w = $('wtUnknown');
        w.className = 'wt-warn' + (unknown.length ? ' show' : '');
        w.textContent = unknown.length ? 'Tag tidak dikenal (akan tampil apa adanya): ' + unknown.join(', ') : '';
        var sample = {};
        (window.WA_TAGS || []).forEach(function (t) { sample[t.tag] = t.sample; });
        var out = typeof window.renderWaTemplate === 'function' ? window.renderWaTemplate(v, {
            customerName: sample.NAMA_NASABAH, invoice: sample.NO_INVOICE, date: sample.TANGGAL,
            currencyList: sample.VALUTA_LIST, total: sample.GRAND_TOTAL, paymentMethod: sample.METODE_BAYAR, paymentDetail: sample.METODE_RINCIAN
        }) : v;
        $('wtPreview').textContent = out || 'Pratinjau pesan akan tampil di sini.';
    }

    /* ---------- aksi ---------- */
    function fillEditor(t) {
        S.editId = t ? t.id : '';
        $('waTemplateId').value = t ? t.id : '';
        $('waTemplateName').value = t ? (t.name || '') : '';
        $('waTemplateCategory').value = t ? (t.category || '') : 'Transaksi';
        $('waTemplateContent').value = t ? (t.content || '') : '';
        $('waTemplateDefault').checked = t ? !!t.isDefault : list().length === 0;
        var sel = t ? purposesOf(t) : [];
        document.querySelectorAll('.wa-template-purpose').forEach(function (cb) { cb.checked = sel.indexOf(cb.value) > -1; });
        $('wtEditTitle').textContent = t ? 'Ubah Template' : 'Template Baru';
        refreshEditorMeta(); refreshTaken(); renderList();
    }

    function insertTag(tag) {
        var ta = $('waTemplateContent'); ta.focus();
        var s = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
        var e = ta.selectionEnd != null ? ta.selectionEnd : s;
        ta.value = ta.value.slice(0, s) + tag + ta.value.slice(e);
        ta.selectionStart = ta.selectionEnd = s + tag.length;
        refreshEditorMeta();
    }

    function save() {
        var name = $('waTemplateName').value.trim();
        var content = $('waTemplateContent').value.trim();
        if (!name) { say('error', 'Nama template wajib diisi.'); $('waTemplateName').focus(); return; }
        if (!content) { say('error', 'Isi pesan wajib diisi.'); $('waTemplateContent').focus(); return; }
        var id = $('waTemplateId').value || ('wa-' + Date.now());
        var category = $('waTemplateCategory').value.trim() || 'Transaksi';
        var wantDefault = $('waTemplateDefault').checked;
        var chosen = Array.prototype.map.call(document.querySelectorAll('.wa-template-purpose:checked'), function (c) { return c.value; });

        var all = list().map(function (t) { return Object.assign({}, t); });
        var moved = [];
        // satu peruntukan = satu template
        all.forEach(function (t) {
            if (t.id === id) return;
            var keep = purposesOf(t).filter(function (p) {
                if (chosen.indexOf(p) > -1) { moved.push(purposeLabel(p)); return false; }
                return true;
            });
            if (Array.isArray(t.purposes)) t.purposes = keep;
        });
        if (wantDefault) all.forEach(function (t) { t.isDefault = false; });

        var next = { id: id, name: name, category: category, content: content, purposes: chosen, isDefault: wantDefault };
        var i = all.findIndex(function (t) { return t.id === id; });
        if (i > -1) all[i] = next; else all.push(next);
        // selalu harus ada tepat satu template default
        if (!all.some(function (t) { return t.isDefault; })) next.isDefault = true;
        saveWaTemplates(all);
        renderList(); renderUsage();
        fillEditor(null);
        say('success', moved.length ? 'Template tersimpan. Peruntukan ' + moved.join(', ') + ' dipindahkan ke template ini.' : 'Template WhatsApp tersimpan.');
    }

    function remove(id) {
        var all = list();
        if (all.length <= 1) { say('error', 'Minimal harus ada satu template WhatsApp.'); return; }
        var t = all.filter(function (x) { return x.id === id; })[0]; if (!t) return;
        var used = purposesOf(t).map(purposeLabel);
        confirmBox('Hapus template "' + (t.name || '') + '"?', used.length ? 'Tombol berikut akan memakai template default: ' + used.join(', ') + '.' : 'Template ini tidak dipakai tombol khusus mana pun.', 'Ya, hapus').then(function (ok) {
            if (!ok) return;
            var rest = list().filter(function (x) { return x.id !== id; });
            if (!rest.some(function (x) { return x.isDefault; })) rest[0].isDefault = true;
            saveWaTemplates(rest);
            if (S.editId === id) fillEditor(null); else renderList();
            renderUsage();
        });
    }

    function duplicate(id) {
        var t = list().filter(function (x) { return x.id === id; })[0]; if (!t) return;
        fillEditor(null);
        $('waTemplateName').value = (t.name || 'Template') + ' (salinan)';
        $('waTemplateCategory').value = t.category || 'Transaksi';
        $('waTemplateContent').value = t.content || '';
        $('waTemplateDefault').checked = false;
        refreshEditorMeta(); refreshTaken();
        $('waTemplateName').focus();
    }

    function onClick(e) {
        var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
        var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
        if (b.getAttribute('data-tag')) insertTag(b.getAttribute('data-tag'));
        else if (act === 'new') fillEditor(null);
        else if (act === 'save') save();
        else if (act === 'edit') { fillEditor(list().filter(function (t) { return t.id === id; })[0] || null); $('waTemplateName').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else if (act === 'dup') duplicate(id);
        else if (act === 'del') remove(id);
    }

    window.loadWaTemplatesSettings = function () {
        var root = $('waTplRoot'); if (!root) return;
        window.migrateProfileWaTemplate();
        if (!S.built || !$('waTemplatesList')) build(root);
        renderList(); renderUsage();
        if (!$('waTemplateContent').value && !$('waTemplateId').value) fillEditor(null);
    };
    // Kompatibilitas dengan pemanggil lama
    window.newWaTemplate = function () { if (S.built) fillEditor(null); };
    window.editWaTemplate = function (id) { if (S.built) fillEditor(list().filter(function (t) { return t.id === id; })[0] || null); };
    window.saveWaTemplateFromSettings = save;
    window.deleteWaTemplate = remove;

    function boot() {
        try { if (JSON.parse(localStorage.getItem('mc_currentUser'))) window.migrateProfileWaTemplate(); } catch (e) { /* abaikan */ }
    }
    setTimeout(boot, 4000);
    setInterval(function () { var r = $('waTplRoot'); if (r && !r.__init) { r.__init = true; window.loadWaTemplatesSettings(); } }, 2500);
})();
