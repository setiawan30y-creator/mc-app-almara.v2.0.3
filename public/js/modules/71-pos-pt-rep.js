// @2026-Alifiandra
/* =====================================================================
 * MODULE 71: PERWAKILAN PT DI KASIR ("Diwakili oleh")
 *
 * Saat nasabah PERUSAHAAN dipilih di Kasir, kasir memilih orang yang hadir
 * mewakili PT (dari menu Nasabah > Perwakilan PT). Hanya perwakilan aktif
 * dengan kuasa yang masih berlaku yang bisa dipilih.
 *
 * - Nasabah yang dilaporkan (SIPESAT, dll.) tetap PT-nya; perwakilan dicatat
 *   sebagai data internal di transaksi (representativeId/Name/Role/...).
 * - Nama perwakilan tampil di nota ("Diwakili") dan di tanda tangan penerima.
 * - Orang yang sama bertransaksi untuk dirinya sendiri: daftarkan sebagai
 *   nasabah perorangan biasa dan pilih namanya sebagai nasabah.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcPosPtRep) return;
    window.__mcPosPtRep = true;

    var ROLE_LABEL = { executor: 'Pelaksana transaksi', signatory: 'Penanda tangan', courier: 'Kurir pengambil' };
    var ROLE_ORDER = { executor: 0, signatory: 1, courier: 2 };
    var S = { cid: '', list: null, loading: false, err: '', selected: {}, token: 0 };

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var fmtDay = function (s) { if (!s) return ''; var a = String(s).slice(0, 10).split('-'); return a.length === 3 ? a[2] + ' ' + M[+a[1] - 1] + ' ' + a[0] : s; };

    function customers() { try { var l = typeof getCustomers === 'function' ? getCustomers() : []; return Array.isArray(l) ? l : []; } catch (e) { return []; } }
    function customerOf(id) { return customers().filter(function (c) { return String(c.id_nasabah) === String(id); })[0] || null; }
    function isCorporate(c) {
        var raw = String((c && (c.kn != null ? c.kn : c.customer_type)) || '').trim().toLowerCase();
        return raw === '2' || raw.indexOf('perusahaan') >= 0 || raw.indexOf('corporate') >= 0;
    }
    function currentCid() { return ($('trxCustomer') && $('trxCustomer').value) || ''; }

    /* Boleh dipilih? Aktif, sudah mulai berlaku, belum lewat masa berlaku. */
    function validity(r) {
        var t = today();
        if (r.status === 'inactive') return { ok: false, t: 'nonaktif' };
        if (r.valid_from && r.valid_from > t) return { ok: false, t: 'belum berlaku' };
        if (r.valid_until && r.valid_until < t) return { ok: false, t: 'kuasa kedaluwarsa ' + fmtDay(r.valid_until) };
        if (r.valid_until) {
            var days = Math.round((Date.parse(r.valid_until + 'T00:00:00') - Date.parse(t + 'T00:00:00')) / 86400000);
            if (days <= 30) return { ok: true, warn: true, t: 'kuasa berakhir ' + (days === 0 ? 'hari ini' : days + ' hari lagi') };
        }
        return { ok: true, t: r.valid_until ? 's.d. ' + fmtDay(r.valid_until) : 'tanpa batas' };
    }

    async function fetchList(cid) {
        var my = ++S.token;
        S.loading = true; S.err = ''; S.list = null; paint();
        try {
            var request = window.authFetch || fetch;
            var res = await request('api/pt-representatives/pos?customer_id=' + encodeURIComponent(cid), { headers: { Accept: 'application/json' } });
            var out = await res.json().catch(function () { return {}; });
            if (!res.ok) throw new Error(out.message || 'Gagal memuat (' + res.status + ')');
            if (my !== S.token) return;
            S.list = (Array.isArray(out.data) ? out.data : []).sort(function (a, b) {
                var oa = a.role_type in ROLE_ORDER ? ROLE_ORDER[a.role_type] : 9, ob = b.role_type in ROLE_ORDER ? ROLE_ORDER[b.role_type] : 9;
                return oa - ob || String(a.name).localeCompare(String(b.name));
            });
        } catch (e) {
            if (my !== S.token) return;
            S.list = []; S.err = e.message || 'Gagal memuat data perwakilan';
        } finally {
            if (my === S.token) { S.loading = false; paint(); }
        }
    }

    function injectStyle() {
        if ($('ptrep-pos-style')) return;
        var st = document.createElement('style'); st.id = 'ptrep-pos-style';
        st.textContent = [
            '#posRepBox{grid-column:1/-1;margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(59,130,246,.35);background:rgba(59,130,246,.07);font-size:.82rem}',
            '#posRepBox.need{border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.08)}',
            '#posRepBox label{display:flex;align-items:center;gap:6px;font-weight:700;margin:0 0 6px}',
            '#posRepBox select{width:100%;padding:7px 9px;border-radius:8px;border:1px solid rgba(148,163,184,.45);background:var(--mc-input-bg,transparent);color:inherit;font-size:.84rem}',
            '#posRepBox select option{color:#0f172a}',
            '#posRepBox .pr-info{display:flex;gap:10px;align-items:center;margin-top:8px}',
            '#posRepBox .pr-info img{width:38px;height:38px;border-radius:8px;object-fit:cover;flex:0 0 auto}',
            '#posRepBox .pr-muted{opacity:.8;font-size:.76rem;line-height:1.4}',
            '#posRepBox .pr-warn{color:#d97706;font-weight:600}',
            '#posRepBox .pr-bad{color:#ef4444;font-weight:600}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function selectedRep(cid) {
        var id = S.selected[cid];
        if (!id || !Array.isArray(S.list) || S.cid !== cid) return null;
        var r = S.list.filter(function (x) { return String(x.id) === String(id); })[0];
        return r && validity(r).ok ? r : null;
    }

    function paint() {
        var card = $('posCustomerProfileCard');
        var box = $('posRepBox');
        var cid = currentCid();
        var c = cid ? customerOf(cid) : null;
        if (!card || !c || !isCorporate(c) || card.classList.contains('hidden')) { if (box) box.remove(); return; }
        injectStyle();
        if (!box) {
            box = document.createElement('div'); box.id = 'posRepBox';
            box.addEventListener('change', function (e) { if (e.target.id === 'posRepSelect') { S.selected[currentCid()] = e.target.value; paint(); } });
        }
        // Selalu di bawah kartu nasabah (sebelum peringatan izin bila ada)
        var warn = $('licPosWarn');
        if (box.parentNode !== card) { if (warn && warn.parentNode === card) card.insertBefore(box, warn); else card.appendChild(box); }

        var head = '<label for="posRepSelect"><i class="fa-solid fa-building-user"></i> Diwakili oleh <span style="color:#ef4444">*</span></label>';
        if (S.loading || S.list === null) { box.className = ''; box.innerHTML = head + '<div class="pr-muted"><i class="fa-solid fa-spinner fa-spin"></i> Memuat perwakilan PT...</div>'; return; }
        if (S.err) { box.className = 'need'; box.innerHTML = head + '<div class="pr-muted pr-bad">' + esc(S.err) + '</div>'; return; }
        if (!S.list.length) {
            box.className = 'need';
            box.innerHTML = head + '<div class="pr-muted">Belum ada perwakilan terdaftar untuk PT ini. Daftarkan di menu <b>Nasabah &rsaquo; Perwakilan PT</b>.</div>';
            return;
        }
        var sel = S.selected[cid] || '';
        var opts = '<option value="">-- Pilih orang yang hadir --</option>' + S.list.map(function (r) {
            var v = validity(r);
            return '<option value="' + esc(r.id) + '"' + (String(r.id) === String(sel) && v.ok ? ' selected' : '') + (v.ok ? '' : ' disabled') + '>' +
                esc(r.name) + ' · ' + esc(ROLE_LABEL[r.role_type] || r.role_type) + (v.ok ? '' : ' (' + esc(v.t) + ')') + '</option>';
        }).join('');
        var rep = selectedRep(cid);
        var info = '';
        if (rep) {
            var v = validity(rep);
            info = '<div class="pr-info">' + (rep.photo_url ? '<img src="' + esc(rep.photo_url) + '" alt="">' : '') +
                '<div class="pr-muted">' + (rep.position ? esc(rep.position) + ' · ' : '') + esc(rep.id_type || 'ID') + (rep.id_last4 ? ' ••••' + esc(rep.id_last4) : '') +
                (rep.authority_ref ? '<br>Kuasa: ' + esc(rep.authority_ref) : '') +
                '<br><span class="' + (v.warn ? 'pr-warn' : '') + '">Berlaku ' + esc(v.t) + '</span> &middot; cocokkan dengan identitas asli.</div></div>';
        } else {
            info = '<div class="pr-muted" style="margin-top:6px">Pilih orang yang hadir. Perwakilan dengan kuasa kedaluwarsa tidak bisa dipilih.</div>';
        }
        box.className = rep ? '' : 'need';
        box.innerHTML = head + '<select id="posRepSelect">' + opts + '</select>' + info;
    }

    function refresh() {
        var cid = currentCid();
        var c = cid ? customerOf(cid) : null;
        if (!c || !isCorporate(c)) { S.cid = cid; S.token++; S.list = null; paint(); return; }
        if (S.cid !== cid) { S.cid = cid; fetchList(cid); return; }
        paint();
    }

    /* Dipakai 03-pos.js saat menyimpan transaksi. */
    window.mcPosRepresentative = function (cid) {
        var r = selectedRep(String(cid || ''));
        return r ? { id: r.id, name: r.name, role: r.role_type, role_label: ROLE_LABEL[r.role_type] || r.role_type, position: r.position, authority_ref: r.authority_ref, valid_until: r.valid_until } : null;
    };

    /* Dipanggil sebelum transaksi diproses. true = boleh lanjut. */
    window.mcPosRepresentativeCheck = async function (cid) {
        var c = cid ? customerOf(cid) : null;
        if (!c || !isCorporate(c)) return true;
        if (S.cid !== cid || S.list === null) { S.cid = ''; refresh(); }
        // tunggu daftar termuat (maks ±5 detik)
        for (var i = 0; i < 25 && (S.loading || S.list === null); i++) await new Promise(function (r) { setTimeout(r, 200); });
        if (selectedRep(cid)) return true;
        var hasList = Array.isArray(S.list) && S.list.length > 0;
        var anyValid = hasList && S.list.some(function (r) { return validity(r).ok; });
        if (!window.Swal) {
            if (anyValid) { alert('Pilih "Diwakili oleh": orang yang hadir mewakili PT.'); return false; }
            return confirm('Tidak ada perwakilan PT yang berlaku. Lanjutkan transaksi tanpa mencatat perwakilan?');
        }
        if (anyValid) {
            await window.Swal.fire({ icon: 'warning', title: 'Pilih perwakilan PT', text: 'Nasabah ini perusahaan. Pilih di "Diwakili oleh" siapa orang yang hadir bertransaksi.', confirmButtonText: 'Pilih sekarang' });
            var s = $('posRepSelect'); if (s) { s.focus(); s.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            return false;
        }
        var msg = hasList
            ? 'Semua perwakilan PT ini nonaktif atau kuasanya sudah kedaluwarsa. Minta surat kuasa terbaru, lalu perbarui di menu Perwakilan PT.'
            : (S.err ? 'Data perwakilan tidak bisa dimuat (' + S.err + ').' : 'Belum ada perwakilan terdaftar untuk PT ini. Daftarkan di menu Nasabah > Perwakilan PT.');
        var r = await window.Swal.fire({ icon: 'warning', title: 'Perwakilan PT belum tercatat', text: msg + ' Lanjutkan transaksi tanpa mencatat perwakilan?',
            showCancelButton: true, confirmButtonText: 'Lanjutkan', cancelButtonText: 'Batal', reverseButtons: true });
        return !!r.isConfirmed;
    };

    function hookPos() {
        var fn = window.updateModernCustomerProfileCard;
        if (typeof fn !== 'function' || fn.__ptrep) return;
        var wrapped = function () {
            var r = fn.apply(this, arguments);
            try { refresh(); } catch (e) { /* abaikan */ }
            return r;
        };
        Object.keys(fn).forEach(function (k) { wrapped[k] = fn[k]; }); // pertahankan penanda modul lain
        wrapped.__ptrep = true;
        window.updateModernCustomerProfileCard = wrapped;
    }

    hookPos();
    setInterval(function () {
        hookPos();
        // jaga kotak tetap sesuai bila kartu dirender ulang tanpa lewat fungsi di atas
        var cid = currentCid();
        if (cid !== S.cid || (!$('posRepBox') && cid)) refresh();
    }, 2000);
})();
