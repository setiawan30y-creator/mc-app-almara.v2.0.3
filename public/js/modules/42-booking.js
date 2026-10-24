/* =====================================================================
 * 42-booking.js  —  Daftar Booking
 *
 *  Alur:  Booking (DP)  ->  nasabah datang  ->  "Ambil -> Transaksi"  ->  submit di halaman Transaksi
 *
 *  - Nomor invoice TIDAK dibuat saat booking. Invoice (INV-xxxx berurutan) baru terbit ketika kasir
 *    menekan Proses Pembayaran di halaman Transaksi setelah nasabah datang dan melunasi sisanya.
 *  - "Ambil -> Transaksi" memuat booking ke form Transaksi (nasabah + valas + kurs deal). Di sana
 *    jumlah yang dibayar otomatis = total - DP. Booking ditandai Selesai & tertaut ke invoice
 *    setelah submit berhasil (lihat window.finalizeBookingImport; dipanggil 03-pos.js).
 *  - Dua cetakan berukuran sama (10 x 14 cm) untuk di-staples: Bukti Booking + Invoice kasir.
 *  - Booking dibatalkan -> stok dilepas, DP dikembalikan atau hangus.
 *  - Data booking di `mc_bookings`; invoice di `mc_transactions` (MySQL).
 *  - Menggantikan seluruh kode booking lama di 09-operations.js.
 * ===================================================================== */
(function () {
    'use strict';

    var S = { tab: 'active', when: 'all', q: '', month: '', sort: 'arrival', sig: '', timer: null, bound: false, busy: false };

    // ------------------------------------------------------------ util
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
    var rp = function (n) { return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0)); };
    var rateFmt = function (v) {
        try { if (typeof formatRate === 'function') return String(formatRate(v || 0)).replace(/,0000$/, ''); } catch (e) { /* abaikan */ }
        return nf.format(Number(v) || 0);
    };
    var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; };
    var round0 = function (n) { return Math.round(Number(n) || 0); };

    function toast(icon, title) {
        if (window.Swal) window.Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 2800, showConfirmButton: false });
        else alert(title);
    }
    function parseDate(v) {
        if (!v) return null;
        var s = String(v); if (s.indexOf('T') === -1) s = s.replace(' ', 'T');
        var d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    function fmtDT(v) {
        var d = parseDate(v); if (!d) return v ? String(v) : '-';
        return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function fmtD(v) {
        var d = parseDate(v); if (!d) return v ? String(v) : '-';
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function toLocalInput(d) {
        var p = function (n) { return String(n).padStart(2, '0'); };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function relTime(d) {
        var diff = d.getTime() - Date.now(), abs = Math.abs(diff);
        var m = Math.round(abs / 60000), h = Math.round(abs / 3600000), dd = Math.round(abs / 86400000), t;
        if (m < 60) t = Math.max(m, 1) + ' menit'; else if (h < 48) t = h + ' jam'; else t = dd + ' hari';
        return diff >= 0 ? 'dalam ' + t : 'terlambat ' + t;
    }

    function safeGet(fn, fallback) { try { return typeof fn === 'function' ? fn() : fallback; } catch (e) { return fallback; } }
    function allRows() { return safeGet(window.getBookings, null) || (window.safeArrayGet ? window.safeArrayGet('mc_bookings') : []) || []; }
    function customers() { return safeGet(window.getCustomers, []) || []; }
    function currencies() { return safeGet(window.getCurrencies, []) || []; }
    function profile() { return safeGet(window.getProfile, {}) || {}; }
    function currentUserName() {
        var u = safeGet(window.getCurrentUser, null);
        return (u && (u.fullName || u.username)) || 'Admin Kasir';
    }
    function custId(c) { return String(c.id_nasabah || c.internal_id || ''); }
    function custName(c) { return c ? (c.nama || c.name || custId(c)) : ''; }
    function custPhone(c) { return c ? (c.no_hp || c.phone || '') : ''; }

    // ------------------------------------------------------------ model
    function groupBookings() {
        var map = {}, order = [];
        allRows().forEach(function (r) {
            if (!r || !r.id) return;
            if (!map[r.id]) { map[r.id] = []; order.push(r.id); }
            map[r.id].push(r);
        });
        var cmap = {};
        customers().forEach(function (c) { cmap[custId(c)] = c; });

        return order.map(function (id) {
            var rows = map[id], f = rows[0];
            var st = String(f.status || '').toUpperCase();
            var status = st === 'PENDING' ? 'active' : (st === 'CANCELLED' ? 'cancelled' : 'done');
            var jual = 0, beli = 0;
            rows.forEach(function (r) { var t = num(r.total); if (String(r.tipe).toUpperCase() === 'JUAL') jual += t; else beli += t; });
            var net = jual - beli;
            var total = Math.abs(net) || (jual + beli);
            var dp = num(f.dpAmount);
            var remaining = status === 'active'
                ? (f.remainingAmount != null && f.remainingAmount !== '' ? num(f.remainingAmount) : Math.max(total - dp, 0))
                : num(f.settledRemaining != null ? f.settledRemaining : 0);
            var arrival = parseDate(f.expectedArrival);
            var c = cmap[String(f.customerId || '')] || null;
            var when = 'later';
            if (status === 'active' && arrival) {
                var now = new Date();
                if (arrival.getTime() < now.getTime()) when = 'late';
                else if (sameDay(arrival, now)) when = 'today';
            } else if (status === 'active') when = 'none';
            return {
                id: id, rows: rows, first: f, status: status, customer: c, customerId: f.customerId || '',
                name: c ? custName(c) : (f.customerName || f.customerId || 'Pengunjung Biasa'),
                phone: custPhone(c),
                created: f.timestamp, createdDate: parseDate(f.timestamp), arrival: arrival, when: when,
                total: total, dp: dp, remaining: remaining, dir: net >= 0 ? 'IN' : 'OUT',
                invoiceId: f.invoiceId || '',
                settled: f.settledAt || '', cancelledAt: f.cancelledAt || '', cancelReason: f.cancelReason || ''
            };
        });
    }
    function activeCount(list) { return list.filter(function (b) { return b.status === 'active'; }).length; }

    // ------------------------------------------------------------ gaya
    function injectStyle() {
        if ($('bk-style')) return;
        var st = document.createElement('style'); st.id = 'bk-style';
        st.textContent = [
            '.bk-root,.bk-ov{--bk-bd:var(--mc-border,rgba(148,163,184,.28));--bk-card:var(--mc-card-bg,#18181b);--bk-tx:var(--mc-text,#fafafa);--bk-mut:var(--mc-text-muted,#94a3b8);',
            '--bk-pri:var(--mc-primary,#22c55e);--bk-buy:var(--mc-buy,#22c55e);--bk-bad:var(--mc-danger,#ef4444);--bk-warn:var(--mc-warning,#f59e0b);--bk-info:var(--mc-info,#38bdf8);',
            '--bk-inp:var(--mc-input-bg,rgba(255,255,255,.04));--bk-r:var(--mc-radius,14px);color:var(--bk-tx)}',
            '.bk-root *,.bk-ov *{box-sizing:border-box}',
            '.bk-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
            '.bk-head h2{margin:0;font-size:1.25rem;display:flex;gap:9px;align-items:center}.bk-head h2 i{color:var(--bk-warn)}',
            '.bk-head p{margin:4px 0 0;color:var(--bk-mut);font-size:.85rem;max-width:640px}',
            '.bk-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
            '.bk-btn{border:1px solid var(--bk-bd);background:transparent;color:var(--bk-tx);padding:8px 13px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:700;font-size:.82rem;display:inline-flex;gap:7px;align-items:center;white-space:nowrap}',
            '.bk-btn:hover{background:var(--bk-inp)}.bk-btn[disabled]{opacity:.5;cursor:not-allowed}',
            '.bk-btn.pri{background:var(--bk-pri);border-color:var(--bk-pri);color:#fff}.bk-btn.pri:hover{filter:brightness(1.08)}',
            '.bk-btn.warn{background:var(--bk-warn);border-color:var(--bk-warn);color:#fff}',
            '.bk-btn.bad{color:var(--bk-bad);border-color:color-mix(in srgb,var(--bk-bad) 45%,transparent)}',
            '.bk-btn.sm{padding:5px 9px;font-size:.76rem}.bk-btn.ico{padding:6px 9px}',
            '.bk-btn.wa{color:#25d366;border-color:color-mix(in srgb,#25d366 45%,transparent)}',
            '.bk-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px}',
            '.bk-stat{background:var(--bk-card);border:1px solid var(--bk-bd);border-radius:var(--bk-r);padding:12px 14px}',
            '.bk-stat small{display:block;color:var(--bk-mut);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}',
            '.bk-stat b{display:block;font-size:1.25rem;margin-top:3px}.bk-stat span{color:var(--bk-mut);font-size:.74rem}',
            '.bk-stat.warn b{color:var(--bk-warn)}.bk-stat.bad b{color:var(--bk-bad)}.bk-stat.ok b{color:var(--bk-buy)}',
            '.bk-prep{background:var(--bk-card);border:1px solid var(--bk-bd);border-radius:var(--bk-r);padding:10px 14px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
            '.bk-prep>small{color:var(--bk-mut);font-weight:700;font-size:.74rem;margin-right:4px}',
            '.bk-chip{border:1px solid var(--bk-bd);border-radius:999px;padding:4px 10px;font-size:.78rem;font-weight:700;display:inline-flex;gap:5px;align-items:center}',
            '.bk-chip.out{color:var(--bk-bad);border-color:color-mix(in srgb,var(--bk-bad) 40%,transparent)}.bk-chip.in{color:var(--bk-buy);border-color:color-mix(in srgb,var(--bk-buy) 40%,transparent)}',
            '.bk-panel{background:var(--bk-card);border:1px solid var(--bk-bd);border-radius:var(--bk-r);padding:14px}',
            '.bk-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px}',
            '.bk-seg{display:inline-flex;border:1px solid var(--bk-bd);border-radius:10px;overflow:hidden}',
            '.bk-seg button{border:0;background:transparent;color:var(--bk-mut);padding:8px 12px;font-weight:700;font-size:.8rem;cursor:pointer;border-right:1px solid var(--bk-bd)}',
            '.bk-seg button:last-child{border-right:0}.bk-seg button.on{background:var(--bk-pri);color:#fff}.bk-seg button em{font-style:normal;opacity:.8;margin-left:4px}',
            '.bk-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
            '.bk-filters input,.bk-filters select{background:var(--bk-inp);border:1px solid var(--mc-input-border,var(--bk-bd));color:var(--bk-tx);border-radius:var(--mc-input-radius,10px);padding:8px 11px;font-size:.84rem}',
            '.bk-filters input[type=search]{width:230px}',
            '.bk-tw{overflow-x:auto}.bk-table{width:100%;border-collapse:collapse;min-width:960px}',
            '.bk-table th{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--bk-mut);text-align:left;padding:9px 10px;border-bottom:1px solid var(--bk-bd);white-space:nowrap}',
            '.bk-table td{padding:11px 10px;border-bottom:1px dashed var(--bk-bd);vertical-align:top;font-size:.85rem}',
            '.bk-table tr:last-child td{border-bottom:0}.bk-table tbody tr:hover{background:var(--bk-inp)}',
            '.bk-table .r{text-align:right}.bk-table .nw{white-space:nowrap}',
            '.bk-no{font-weight:800;font-size:.92rem}.bk-sub{color:var(--bk-mut);font-size:.74rem;display:block;margin-top:2px}',
            '.bk-line{display:block;white-space:nowrap}.bk-line b{font-weight:800}',
            '.bk-tag{display:inline-block;border-radius:999px;padding:2px 9px;font-size:.7rem;font-weight:800;margin-top:3px}',
            '.bk-tag.late{background:color-mix(in srgb,var(--bk-bad) 16%,transparent);color:var(--bk-bad)}',
            '.bk-tag.today{background:color-mix(in srgb,var(--bk-warn) 18%,transparent);color:var(--bk-warn)}',
            '.bk-tag.later{background:var(--bk-inp);color:var(--bk-mut)}',
            '.bk-tag.done{background:color-mix(in srgb,var(--bk-buy) 16%,transparent);color:var(--bk-buy)}',
            '.bk-tag.cancel{background:color-mix(in srgb,var(--bk-bad) 16%,transparent);color:var(--bk-bad)}',
            '.bk-act{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}',
            '.bk-empty{text-align:center;padding:42px 16px;color:var(--bk-mut)}',
            '.bk-empty i{display:block;font-size:2rem;margin-bottom:10px;opacity:.6}',
            '.bk-inv{color:var(--bk-info);font-weight:700;font-size:.74rem;display:block;margin-top:2px}',
            '.bk-badge{margin-left:auto;background:var(--mc-warning,#f59e0b);color:#fff;border-radius:999px;font-size:.68rem;font-weight:800;padding:1px 7px;line-height:1.5}',
            '.bk-badge.late{background:var(--mc-danger,#ef4444)}',
            /* modal */
            '.bk-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10050;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:4vh 12px}',
            '.bk-md{background:var(--mc-card-bg,#18181b);color:var(--mc-text,#fafafa);border:1px solid var(--mc-border,rgba(148,163,184,.28));border-radius:var(--mc-radius,14px);width:100%;max-width:640px;box-shadow:0 24px 60px rgba(0,0,0,.5)}',
            '.bk-md.wide{max-width:760px}',
            '.bk-mh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--mc-border,rgba(148,163,184,.28))}',
            '.bk-mh h3{margin:0;font-size:1.05rem}.bk-mx{border:0;background:transparent;color:inherit;font-size:1.2rem;cursor:pointer;opacity:.7}',
            '.bk-mb{padding:16px 18px}.bk-mf{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--mc-border,rgba(148,163,184,.28))}',
            '.bk-f{margin-bottom:12px}.bk-f label{display:block;font-size:.74rem;color:var(--mc-text-muted,#94a3b8);font-weight:700;margin-bottom:4px}',
            '.bk-f input,.bk-f select,.bk-f textarea{width:100%;background:var(--mc-input-bg,rgba(255,255,255,.04));border:1px solid var(--mc-input-border,var(--mc-border,rgba(148,163,184,.28)));color:var(--mc-text,#fafafa);border-radius:var(--mc-input-radius,10px);padding:9px 11px;font-size:.88rem;font-family:inherit}',
            '.bk-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.bk-row2{grid-template-columns:1fr}}',
            '.bk-items{border:1px solid var(--mc-border,rgba(148,163,184,.28));border-radius:12px;padding:10px;margin-bottom:12px}',
            '.bk-it{display:grid;grid-template-columns:1.1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px}',
            '@media(max-width:560px){.bk-it{grid-template-columns:1fr 1fr}}',
            '.bk-it .bk-f{margin:0}.bk-sum{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;background:color-mix(in srgb,var(--mc-primary,#22c55e) 10%,transparent);border:1px dashed color-mix(in srgb,var(--mc-primary,#22c55e) 50%,transparent);border-radius:12px;padding:10px 14px;font-weight:800;margin-bottom:12px}',
            '.bk-kv{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--mc-border,rgba(148,163,184,.28));font-size:.88rem}',
            '.bk-kv:last-child{border-bottom:0}.bk-kv span{color:var(--mc-text-muted,#94a3b8)}',
            '.bk-note{font-size:.78rem;color:var(--mc-text-muted,#94a3b8);margin:8px 0}',
            '.bk-split{display:none;margin-top:8px}.bk-split.on{display:block}',
            '.bk-flow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:.8rem;margin-bottom:12px}',
            '.bk-flow b{background:var(--mc-input-bg,rgba(255,255,255,.04));border:1px solid var(--mc-border,rgba(148,163,184,.28));border-radius:8px;padding:4px 9px}',
            '.bk-chk{display:flex;gap:8px;align-items:center;font-size:.85rem;margin:10px 0}.bk-chk input{width:auto}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ modal ringan
    function openModal(opt) {
        closeModal();
        var ov = document.createElement('div'); ov.className = 'bk-ov'; ov.id = 'bkModal';
        ov.innerHTML = '<div class="bk-md ' + (opt.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
            '<div class="bk-mh"><h3>' + opt.title + '</h3><button class="bk-mx" data-bk="close" aria-label="Tutup">&times;</button></div>' +
            '<div class="bk-mb">' + opt.body + '</div>' +
            '<div class="bk-mf">' + (opt.footer || '') + '</div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('mousedown', function (e) { if (e.target === ov && opt.dismissable !== false) closeModal(); });
        if (typeof opt.onOpen === 'function') opt.onOpen(ov);
        return ov;
    }
    function closeModal() { var m = $('bkModal'); if (m) m.remove(); }
    function modalOpen() { return !!$('bkModal'); }
    function showError(box, msg) {
        var el = $('bkErr'); if (!el) return;
        el.style.display = msg ? 'block' : 'none'; el.textContent = msg || '';
        if (msg && box && box.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    var ERR = '<div id="bkErr" style="display:none;color:var(--mc-danger,#ef4444);font-weight:700;font-size:.84rem;margin:6px 0"></div>';

    // ------------------------------------------------------------ uang (kas / bank / mutasi)
    // sign: +1 uang masuk ke usaha, -1 uang keluar dari usaha
    function moveMoney(method, amount, sign, note, ref, bankName) {
        amount = round0(amount); if (amount <= 0) return;
        var m = String(method).toUpperCase();
        if (m === 'CASH') { saveCash(getCash() + sign * amount); return; }
        if (m === 'BCA') saveBankBCA(getBankBCA() + sign * amount);
        else if (m === 'MANDIRI') saveBankMandiri(getBankMandiri() + sign * amount);
        var muts = safeGet(window.getMutations, []) || [];
        muts.push({
            id_mutasi: 'MUT-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10),
            timestamp: new Date().toISOString(), tipe: sign > 0 ? 'MASUK' : 'KELUAR', nominal: amount,
            keterangan: note + ' (Ref: ' + ref + ')', bank: bankName || m
        });
        saveMutations(muts);
    }

    // metode bayar bawaan kasir (CASH/TRANSFER/SPLIT) -> CASH | BCA | MANDIRI
    function normMethod(row) {
        var m = String((row && row.paymentMethod) || 'CASH').toUpperCase();
        if (m === 'BCA' || m === 'MANDIRI' || m === 'CASH') return m;
        if (m === 'TRANSFER') { var bk = String((row && row.bank) || 'BCA').toUpperCase(); return bk === 'MANDIRI' ? 'MANDIRI' : 'BCA'; }
        return 'CASH';
    }

    // ------------------------------------------------------------ nomor booking
    async function nextBookingId() {
        try {
            if (typeof allocatePosDocumentId === 'function') return await allocatePosDocumentId('BKG', 'mc_booking_seq');
        } catch (e) { /* jatuh ke nomor lokal */ }
        var seq = (parseInt(localStorage.getItem('mc_booking_seq'), 10) || 0) + 1;
        localStorage.setItem('mc_booking_seq', seq);
        return 'BKG-' + String(seq).padStart(4, '0');
    }

    // ------------------------------------------------------------ cetak (10 x 14 cm, sama dengan invoice kasir)
    function printCss() {
        return '@page{size:10cm 14cm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:"Arial Narrow",Arial,sans-serif;color:#000;font-size:12px;line-height:1.25}' +
            '.pg{width:10cm;min-height:14cm;padding:.85cm .45cm .5cm;page-break-after:always;position:relative}.pg:last-child{page-break-after:auto}' +
            '.h{text-align:center;margin-bottom:5px}.h h1{margin:0;font-size:15px;text-transform:uppercase;letter-spacing:.5px}.h p{margin:1px 0;font-size:11px}' +
            '.ttl{text-align:center;font-weight:bold;font-size:14px;letter-spacing:1px;border:1px solid #000;padding:3px 0;margin:6px 0}' +
            '.dd{border-top:1px dashed #000;margin:4px 0}.dbl{border-top:3px double #000;margin:5px 0}' +
            '.r{display:flex;justify-content:space-between;gap:8px;padding:2px 0}.r span:last-child{text-align:right}.b{font-weight:bold}' +
            '.ref{border:1px dashed #000;padding:4px 6px;margin:6px 0;font-size:11.5px;text-align:center}' +
            '.sig{display:flex;justify-content:space-between;margin-top:14px}.sg{text-align:center;width:46%;font-size:11px}.sg i{display:block;border-top:1px dashed #000;margin:26px 0 2px}' +
            '.nt{font-size:10.5px;font-style:italic;text-align:center;margin-top:8px;line-height:1.2}' +
            '.stamp{position:absolute;right:.6cm;top:3.3cm;border:3px solid #000;padding:2px 10px;font-weight:bold;font-size:18px;transform:rotate(-12deg);opacity:.75;letter-spacing:2px}' +
            '.stp{position:absolute;left:0;right:0;bottom:.25cm;text-align:center;font-size:9px;color:#444}';
    }
    function headerHtml(p) {
        var addr = (p.address && String(p.address).toLowerCase() !== 'pusat valuta asing terpercaya') ? p.address : 'Pusat Valuta Asing Terpercaya';
        return '<div class="h"><h1>' + esc(p.name || 'Money Changer') + '</h1><p>' + esc(addr) + '</p><p>Telp/WA: ' + esc(p.phone || '-') + '</p></div>';
    }
    function maskPhone(ph) { ph = String(ph || ''); return !ph ? '-' : (ph.length > 3 ? ph.slice(0, -3) + '***' : '***'); }
    function itemsHtml(rows) {
        return rows.map(function (r) {
            return '<div class="r"><span>' + esc(String(r.tipe).toUpperCase() === 'JUAL' ? 'Jual ' : 'Beli ') + esc(r.valuta) + ' ' + nf.format(num(r.nominal)) + ' @ ' + rateFmt(r.rate) + '</span><span class="b">' + rp(r.total) + '</span></div>';
        }).join('');
    }
    function slipPage(b) {
        var p = profile(), f = b.first;
        var dirIn = b.dir === 'IN';
        return '<div class="pg">' + headerHtml(p) + '<div class="ttl">BUKTI BOOKING</div>' +
            '<div class="r"><span>No. Booking</span><span class="b">' + esc(b.id) + '</span></div>' +
            '<div class="r"><span>Tanggal</span><span>' + esc(fmtDT(b.created)) + '</span></div>' +
            '<div class="r"><span>Nama</span><span class="b">' + esc(b.name) + '</span></div>' +
            '<div class="r"><span>No. CIF</span><span>' + esc((b.customer && b.customer.no_cif) || '-') + '</span></div>' +
            '<div class="r"><span>Telp</span><span>' + esc(maskPhone(b.phone)) + '</span></div>' +
            '<div class="r"><span>Jadwal Datang</span><span class="b">' + esc(fmtDT(f.expectedArrival)) + '</span></div>' +
            '<div class="dbl"></div><div class="r b"><span>Rincian Booking</span><span>Total (IDR)</span></div><div class="dd"></div>' +
            itemsHtml(b.rows) + '<div class="dd"></div>' +
            '<div class="r b" style="font-size:14px"><span>TOTAL</span><span>' + rp(b.total) + '</span></div>' +
            '<div class="r"><span>' + (dirIn ? 'DP diterima' : 'DP dibayarkan') + ' (' + esc(f.paymentMethod || '-') + ')</span><span class="b">' + rp(b.dp) + '</span></div>' +
            '<div class="r b"><span>' + (dirIn ? 'Sisa pelunasan' : 'Sisa dibayarkan') + '</span><span>' + rp(Math.max(b.total - b.dp, 0)) + '</span></div>' +
            '<div class="ref">' + (b.invoiceId ? 'No. Invoice: <b>' + esc(b.invoiceId) + '</b>' : 'No. invoice diterbitkan saat pelunasan &amp; pengambilan valas') + '</div>' +
            '<div class="sig"><div class="sg">Petugas / Kasir<i></i>' + esc(f.kasir || '-') + '</div><div class="sg">Nasabah<i></i>' + esc(b.name) + '</div></div>' +
            '<div class="nt">Simpan bukti ini dan bawa saat pengambilan valas.<br>Booking dapat dibatalkan sesuai ketentuan yang berlaku.</div>' +
            '<div class="stp">Lampiran 1 &mdash; satukan (staples) dengan Invoice pelunasan</div></div>';
    }
    function printPages(pages, title) {
        var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + printCss() + '</style></head><body>' + pages.join('') + '</body></html>';
        var f = document.createElement('iframe');
        f.setAttribute('aria-hidden', 'true');
        f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
        document.body.appendChild(f);
        var d = f.contentWindow.document; d.open(); d.write(html); d.close();
        setTimeout(function () {
            try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('error', 'Gagal membuka dialog cetak.'); }
            setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 60000);
        }, 450);
    }
    function findBooking(id) { return groupBookings().filter(function (b) { return b.id === id; })[0] || null; }
    function printSlip(id) { var b = findBooking(id); if (!b) return toast('error', 'Booking tidak ditemukan.'); printPages([slipPage(b)], 'Bukti ' + b.id); }
    function printInvoice(id) {
        var b = findBooking(id); if (!b || !b.invoiceId) return toast('warning', 'Booking ini belum memiliki invoice.');
        if (typeof window.reprintReceipt === 'function') window.reprintReceipt(b.invoiceId);
    }

    // ------------------------------------------------------------ rangka halaman
    function shell() {
        var root = $('bookingRoot'); if (!root) return null;
        if (root.dataset.ready === '1') return root;
        root.className = 'bk-root';
        root.innerHTML =
            '<div class="bk-head"><div><h2><i class="fa-solid fa-book-bookmark"></i> Daftar Booking</h2>' +
            '<p>Nasabah membayar DP, valas diambil kemudian. Saat nasabah datang, klik <b>Ambil &rarr; Transaksi</b>: booking dimuat ke halaman Transaksi, terima sisa pembayaran lalu submit di sana. Nomor invoice baru terbit saat itu, dan Bukti Booking + Invoice disatukan dengan staples.</p></div>' +
            '<div class="bk-tools"><button class="bk-btn" data-bk="csv"><i class="fa-solid fa-file-csv"></i> Ekspor</button>' +
            '<button class="bk-btn" data-bk="refresh"><i class="fa-solid fa-rotate-right"></i> Perbarui</button>' +
            '<button class="bk-btn pri" data-bk="new"><i class="fa-solid fa-plus"></i> Tambah Booking</button></div></div>' +
            '<div id="bkStats" class="bk-stats"></div><div id="bkPrep"></div>' +
            '<div class="bk-panel"><div class="bk-bar"><div class="bk-seg" id="bkTabs"></div>' +
            '<div class="bk-filters"><select id="bkWhen" title="Jadwal"><option value="all">Semua jadwal</option><option value="today">Hari ini</option><option value="late">Terlambat</option><option value="later">Mendatang</option></select>' +
            '<input type="month" id="bkMonth" title="Bulan booking dibuat">' +
            '<select id="bkSort"><option value="arrival">Urut: jadwal datang</option><option value="newest">Urut: terbaru</option></select>' +
            '<input type="search" id="bkQ" placeholder="Cari no. booking, nama, telp, invoice..."></div></div>' +
            '<div class="bk-tw"><table class="bk-table"><thead><tr><th>Booking</th><th>Jadwal Datang</th><th>Nasabah</th><th>Rincian Valas</th><th class="r">Total</th><th class="r">DP</th><th class="r">Sisa</th><th>Status</th><th class="r">Aksi</th></tr></thead>' +
            '<tbody id="bkBody"></tbody></table></div></div>';
        root.dataset.ready = '1';
        return root;
    }

    function stats(list) {
        var act = list.filter(function (b) { return b.status === 'active'; });
        var late = act.filter(function (b) { return b.when === 'late'; }).length;
        var today = act.filter(function (b) { return b.when === 'today'; }).length;
        var dpIn = 0, dpOut = 0, remIn = 0, remOut = 0;
        act.forEach(function (b) { if (b.dir === 'IN') { dpIn += b.dp; remIn += b.remaining; } else { dpOut += b.dp; remOut += b.remaining; } });
        var done = list.filter(function (b) { return b.status === 'done'; });
        var mon = new Date(), doneMonth = done.filter(function (b) { var d = parseDate(b.settled); return d && d.getMonth() === mon.getMonth() && d.getFullYear() === mon.getFullYear(); });
        return { act: act.length, late: late, today: today, dp: dpIn - dpOut, rem: remIn - remOut, doneMonth: doneMonth.length };
    }
    function renderStats(list) {
        var s = stats(list);
        $('bkStats').innerHTML =
            '<div class="bk-stat"><small>Booking aktif</small><b>' + s.act + '</b><span>menunggu pengambilan</span></div>' +
            '<div class="bk-stat warn"><small>Datang hari ini</small><b>' + s.today + '</b><span>siapkan valasnya</span></div>' +
            '<div class="bk-stat ' + (s.late ? 'bad' : '') + '"><small>Terlambat</small><b>' + s.late + '</b><span>lewat jadwal datang</span></div>' +
            '<div class="bk-stat"><small>DP ditahan</small><b>' + rp(Math.abs(s.dp)) + '</b><span>uang muka booking aktif</span></div>' +
            '<div class="bk-stat"><small>Sisa tagihan</small><b>' + rp(Math.abs(s.rem)) + '</b><span>dibayar saat pengambilan</span></div>' +
            '<div class="bk-stat ok"><small>Selesai bulan ini</small><b>' + s.doneMonth + '</b><span>sudah jadi invoice</span></div>';
    }
    function renderPrep(list) {
        var act = list.filter(function (b) { return b.status === 'active'; });
        var host = $('bkPrep'); if (!host) return;
        if (!act.length) { host.innerHTML = ''; return; }
        var sum = {};
        act.forEach(function (b) {
            b.rows.forEach(function (r) {
                var k = String(r.tipe).toUpperCase() + '|' + r.valuta;
                sum[k] = (sum[k] || 0) + num(r.nominal);
            });
        });
        var chips = Object.keys(sum).sort().map(function (k) {
            var p = k.split('|'), jual = p[0] === 'JUAL';
            return '<span class="bk-chip ' + (jual ? 'out' : 'in') + '"><i class="fa-solid ' + (jual ? 'fa-arrow-up-from-bracket' : 'fa-arrow-down-to-bracket') + '"></i>' +
                (jual ? 'Serahkan ' : 'Terima ') + nf.format(sum[k]) + ' ' + esc(p[1]) + '</span>';
        }).join('');
        var lackChips = '';
        try {
            var cs = currencies();
            Object.keys(sum).filter(function (k) { return k.indexOf('JUAL|') === 0; }).forEach(function (k) {
                var code = k.split('|')[1], c = cs.filter(function (x) { return x.code === code; })[0];
                if (c && num(c.stock) < 0) lackChips += '<span class="bk-chip out" style="border-color:var(--mc-danger,#ef4444);color:var(--mc-danger,#ef4444)"><i class="fa-solid fa-magnifying-glass"></i>Cari ' + nf.format(-num(c.stock)) + ' ' + esc(code) + ' lagi</span>';
            });
        } catch (e) { /* abaikan */ }
        host.innerHTML = '<div class="bk-prep"><small>VALAS YANG DISIAPKAN</small>' + chips + lackChips + '</div>';
    }
    function renderTabs(list) {
        var c = { active: 0, done: 0, cancelled: 0 };
        list.forEach(function (b) { c[b.status]++; });
        var defs = [['active', 'Aktif'], ['done', 'Selesai'], ['cancelled', 'Dibatalkan'], ['all', 'Semua']];
        $('bkTabs').innerHTML = defs.map(function (d) {
            var n = d[0] === 'all' ? list.length : c[d[0]];
            return '<button data-bk="tab" data-v="' + d[0] + '" class="' + (S.tab === d[0] ? 'on' : '') + '">' + d[1] + '<em>' + n + '</em></button>';
        }).join('');
        var w = $('bkWhen'); if (w) { w.style.display = S.tab === 'active' ? '' : 'none'; w.value = S.when; }
    }

    function statusCell(b) {
        if (b.status === 'done') return '<span class="bk-tag done">Selesai</span>' + (b.invoiceId ? '<span class="bk-inv">' + esc(b.invoiceId) + '</span>' : '') + '<span class="bk-sub">' + esc(fmtD(b.settled)) + '</span>';
        if (b.status === 'cancelled') return '<span class="bk-tag cancel">Dibatalkan</span>' + (b.cancelReason ? '<span class="bk-sub">' + esc(b.cancelReason) + '</span>' : '');
        return '<span class="bk-tag later">Menunggu</span>' + (isImported(b.id) ? '<span class="bk-inv">Sedang di halaman Transaksi</span>' : '');
    }
    function arrivalCell(b) {
        if (!b.arrival) return '<span class="bk-sub">-</span>';
        var tag = '';
        if (b.status === 'active') {
            var cls = b.when === 'late' ? 'late' : (b.when === 'today' ? 'today' : 'later');
            tag = '<br><span class="bk-tag ' + cls + '">' + (b.when === 'today' ? 'Hari ini &middot; ' : '') + esc(relTime(b.arrival)) + '</span>';
        }
        return '<span class="nw">' + esc(fmtDT(b.arrival)) + '</span>' + tag;
    }
    function actionCell(b) {
        var id = esc(b.id), h = '';
        if (b.status === 'active') {
            h += '<button class="bk-btn pri sm" data-bk="export" data-id="' + id + '" title="Muat booking ke halaman Transaksi untuk pelunasan"><i class="fa-solid fa-arrow-right-to-bracket"></i> Ambil &rarr; Transaksi</button>';
            h += '<button class="bk-btn sm ico" data-bk="slip" data-id="' + id + '" title="Cetak bukti booking"><i class="fa-solid fa-print"></i></button>';
            h += '<button class="bk-btn sm ico wa" data-bk="wa" data-id="' + id + '" title="Kirim WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>';
            h += '<button class="bk-btn sm ico" data-bk="resched" data-id="' + id + '" title="Ubah jadwal datang"><i class="fa-regular fa-calendar"></i></button>';
            h += '<button class="bk-btn sm ico bad" data-bk="cancel" data-id="' + id + '" title="Batalkan booking"><i class="fa-solid fa-xmark"></i></button>';
        } else if (b.status === 'done') {
            if (b.invoiceId) h += '<button class="bk-btn pri sm" data-bk="inv" data-id="' + id + '" title="Cetak ulang invoice"><i class="fa-solid fa-print"></i> Invoice</button>';
            h += '<button class="bk-btn sm" data-bk="slip" data-id="' + id + '" title="Cetak ulang bukti booking">Bukti Booking</button>';
        } else {
            h += '<button class="bk-btn sm" data-bk="slip" data-id="' + id + '" title="Cetak bukti booking"><i class="fa-solid fa-print"></i></button>';
        }
        return '<div class="bk-act">' + h + '</div>';
    }

    function filtered(list) {
        var q = S.q.trim().toLowerCase();
        var out = list.filter(function (b) {
            if (S.tab !== 'all' && b.status !== S.tab) return false;
            if (S.tab === 'active' && S.when !== 'all' && b.when !== S.when) return false;
            if (S.month) {
                var d = b.createdDate;
                if (!d) return false;
                var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                if (ym !== S.month) return false;
            }
            if (q) {
                var hay = (b.id + ' ' + b.invoiceId + ' ' + b.name + ' ' + b.phone + ' ' + b.customerId).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        out.sort(function (a, b) {
            if (S.sort === 'arrival' && S.tab === 'active') {
                var x = a.arrival ? a.arrival.getTime() : Infinity, y = b.arrival ? b.arrival.getTime() : Infinity;
                return x - y;
            }
            return (b.createdDate ? b.createdDate.getTime() : 0) - (a.createdDate ? a.createdDate.getTime() : 0);
        });
        return out;
    }

    function renderBody(list) {
        var rows = filtered(list), body = $('bkBody'); if (!body) return;
        if (!rows.length) {
            var none = !list.length;
            body.innerHTML = '<tr><td colspan="9"><div class="bk-empty"><i class="fa-regular fa-calendar-check"></i>' +
                (none ? 'Belum ada booking. Klik <b>Tambah Booking</b> untuk membuat yang pertama.' : 'Tidak ada booking yang cocok dengan filter ini.') + '</div></td></tr>';
            return;
        }
        body.innerHTML = rows.map(function (b) {
            var items = b.rows.map(function (r) {
                var jual = String(r.tipe).toUpperCase() === 'JUAL';
                return '<span class="bk-line">' + (jual ? 'Serahkan ' : 'Terima ') + '<b>' + nf.format(num(r.nominal)) + '</b> ' + esc(r.valuta) + ' <span class="bk-sub" style="display:inline">@ ' + rateFmt(r.rate) + '</span></span>';
            }).join('');
            var rem = b.status === 'active' ? '<b style="color:var(--bk-bad)">' + rp(b.remaining) + '</b>' : '<span class="bk-sub">' + (b.status === 'done' ? rp(b.remaining) : '-') + '</span>';
            return '<tr><td><span class="bk-no">' + esc(b.id) + '</span><span class="bk-sub">' + esc(fmtDT(b.created)) + '</span></td>' +
                '<td>' + arrivalCell(b) + '</td>' +
                '<td>' + esc(b.name) + (b.phone ? '<span class="bk-sub"><i class="fa-solid fa-phone"></i> ' + esc(b.phone) + '</span>' : '') + '</td>' +
                '<td>' + items + '</td>' +
                '<td class="r nw">' + rp(b.total) + '</td>' +
                '<td class="r nw" style="color:var(--bk-buy)">' + rp(b.dp) + '</td>' +
                '<td class="r nw">' + rem + '</td>' +
                '<td>' + statusCell(b) + '</td>' +
                '<td class="r">' + actionCell(b) + '</td></tr>';
        }).join('');
    }

    // Jaring pengaman: bila ada invoice di Transaksi Utama yang membawa kode booking (conversionSourceBookingId)
    // tetapi booking masih Aktif (mis. data tertimpa sinkronisasi / perangkat lain), tandai Selesai.
    function reconcileConverted() {
        try {
            var trx = safeGet(window.getTransactions, []) || [], byBooking = {};
            trx.forEach(function (t) { if (t && t.conversionSourceBookingId && t.id) byBooking[t.conversionSourceBookingId] = t; });
            var rows = allRows(), changed = false;
            var next = rows.map(function (r) {
                var t = byBooking[r.id];
                if (!t || String(r.status).toUpperCase() !== 'PENDING') return r;
                var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; });
                o.status = 'CONVERTED_TO_INVOICE'; o.bookingStatus = 'CONVERTED_TO_INVOICE'; o.invoiceId = t.invoiceId || t.id;
                o.settledAt = t.timestamp || new Date().toISOString(); o.settledBy = t.kasir || ''; o.remainingAmount = 0;
                changed = true; return o;
            });
            if (changed) saveBookings(next);
        } catch (e) { /* abaikan */ }
    }
    function render() {
        injectStyle();
        reconcileConverted();
        if (!shell()) return;
        var list = groupBookings();
        renderStats(list); renderPrep(list); renderTabs(list); renderBody(list);
        updateBadge(list);
        S.sig = signature();
    }
    function signature() {
        try { return JSON.stringify(allRows().map(function (r) { return [r.itemId, r.status, r.expectedArrival, r.invoiceId]; })).length + ':' + allRows().length + ':' + (localStorage.getItem('mc_bookings') || '').length; }
        catch (e) { return String(Date.now()); }
    }

    // ------------------------------------------------------------ lencana sidebar + pengingat
    function updateBadge(list) {
        list = list || groupBookings();
        var a = document.querySelector('.nav-item[data-target="booking-view"]'); if (!a) return;
        var act = list.filter(function (b) { return b.status === 'active'; });
        var late = act.filter(function (b) { return b.when === 'late'; }).length;
        var el = a.querySelector('.bk-badge');
        if (!act.length) { if (el) el.remove(); return; }
        if (!el) { el = document.createElement('span'); a.appendChild(el); }
        el.className = 'bk-badge' + (late ? ' late' : '');
        el.textContent = act.length;
        el.title = act.length + ' booking aktif' + (late ? ', ' + late + ' terlambat' : '');
    }
    function seenKeys() { try { return JSON.parse(localStorage.getItem('mc_booking_reminders_seen') || '[]') || []; } catch (e) { return []; } }
    function reminderTick() {
        var list = groupBookings(); updateBadge(list);
        var seen = seenKeys(), now = Date.now();
        var up = list.filter(function (b) {
            if (b.status !== 'active' || !b.arrival) return false;
            var key = 'booking_arrival_reminder:' + b.id + ':' + (b.first.expectedArrival || '');
            var diff = b.arrival.getTime() - now;
            return diff > 0 && diff <= 15 * 60000 && seen.indexOf(key) === -1;
        })[0];
        if (!up) return;
        seen.push('booking_arrival_reminder:' + up.id + ':' + (up.first.expectedArrival || ''));
        try { localStorage.setItem('mc_booking_reminders_seen', JSON.stringify(seen.slice(-300))); } catch (e) { /* abaikan */ }
        var items = up.rows.map(function (r) { return nf.format(num(r.nominal)) + ' ' + r.valuta; }).join(', ');
        if (window.Swal) window.Swal.fire({ icon: 'info', title: 'Pengingat Booking', text: up.id + ' (' + up.name + ') dijadwalkan ' + fmtDT(up.arrival) + '. Siapkan ' + items + '.', toast: true, position: 'top-end', timer: 15000, showConfirmButton: true, confirmButtonText: 'Oke' });
    }

    // ------------------------------------------------------------ form booking baru
    function itemRowHtml(curOpts) {
        return '<div class="bk-it"><div class="bk-f"><label>Valuta</label><select class="bk-cur">' + curOpts + '</select></div>' +
            '<div class="bk-f"><label>Nominal valas</label><input type="number" class="bk-amt" min="0" step="any" placeholder="0"></div>' +
            '<div class="bk-f"><label>Kurs (Rp)</label><input type="number" class="bk-rate" min="0" step="any" placeholder="0"></div>' +
            '<button class="bk-btn bad sm ico" type="button" data-bk="rmline" title="Hapus baris"><i class="fa-solid fa-trash"></i></button></div>';
    }
    function openCreate() {
        var custs = customers(), curs = currencies();
        if (!custs.length) return toast('warning', 'Data nasabah masih kosong. Tambahkan nasabah terlebih dahulu.');
        if (!curs.length) return toast('warning', 'Data valuta masih kosong.');
        var dl = custs.map(function (c) {
            return '<option value="' + esc(custId(c) + ' — ' + custName(c) + (custPhone(c) ? ' — ' + custPhone(c) : '')) + '"></option>';
        }).join('');
        var curOpts = curs.map(function (c) { return '<option value="' + esc(c.code) + '">' + esc(c.code) + ' (stok ' + nf.format(num(c.stock)) + ')</option>'; }).join('');
        var arrival = new Date(Date.now() + 3600000); arrival.setMinutes(0, 0, 0);

        var body = '<div class="bk-f"><label>Nasabah</label><input id="bkCust" list="bkCustList" placeholder="Ketik ID, nama, atau no. telp" autocomplete="off"><datalist id="bkCustList">' + dl + '</datalist></div>' +
            '<div class="bk-row2"><div class="bk-f"><label>Jenis booking</label><select id="bkTipe"><option value="JUAL">JUAL &mdash; kita menjual valas ke nasabah</option><option value="BELI">BELI &mdash; kita membeli valas dari nasabah</option></select></div>' +
            '<div class="bk-f"><label>Jadwal datang</label><input type="datetime-local" id="bkArr" value="' + toLocalInput(arrival) + '"></div></div>' +
            '<div class="bk-items" id="bkItems">' + itemRowHtml(curOpts) + '<button class="bk-btn sm" type="button" data-bk="addline"><i class="fa-solid fa-plus"></i> Tambah valuta</button></div>' +
            '<div id="bkStockHint" class="bk-note" style="display:none;border:1px solid var(--mc-warning,#f59e0b);border-radius:10px;padding:8px 10px;color:var(--mc-warning,#f59e0b)"></div>' +
            '<div class="bk-sum"><span>Total: <span id="bkTot">Rp 0</span></span><span>Sisa: <span id="bkRem">Rp 0</span></span></div>' +
            '<div class="bk-row2"><div class="bk-f"><label>DP (Rp)</label><input type="number" id="bkDp" min="0" step="any" placeholder="0">' +
            '<div class="bk-chips" style="margin-top:6px;display:flex;gap:6px"><button class="bk-btn sm" type="button" data-bk="dppct" data-v="0.25">25%</button><button class="bk-btn sm" type="button" data-bk="dppct" data-v="0.5">50%</button><button class="bk-btn sm" type="button" data-bk="dppct" data-v="1">100%</button></div></div>' +
            '<div class="bk-f"><label>Metode DP</label><select id="bkPay"><option value="CASH">Tunai</option><option value="BCA">Transfer BCA</option><option value="MANDIRI">Transfer Mandiri</option></select></div></div>' +
            '<div class="bk-f"><label>Catatan (opsional)</label><input id="bkNote" placeholder="Catatan internal"></div>' + ERR;
        var foot = '<button class="bk-btn" data-bk="close">Tutup</button><button class="bk-btn" data-bk="save" data-print="0">Simpan</button><button class="bk-btn pri" data-bk="save" data-print="1"><i class="fa-solid fa-print"></i> Simpan & Cetak</button>';

        openModal({ title: '<i class="fa-solid fa-plus"></i> Tambah Booking', body: body, footer: foot, wide: true, dismissable: false, onOpen: function () {
            var ov = $('bkModal');
            ov._curs = curs;
            fillRates(ov);
            recalc();
        } });
    }
    function rateFor(cur, tipe) {
        if (!cur) return 0;
        return num(tipe === 'BELI' ? (cur.buy || cur.base_buy) : (cur.sell || cur.base_sell));
    }
    function fillRates(ov, force) {
        var tipe = $('bkTipe').value, curs = ov._curs || currencies();
        ov.querySelectorAll('.bk-it').forEach(function (row) {
            var rateEl = row.querySelector('.bk-rate');
            if (force || !rateEl.value) {
                var cur = curs.filter(function (c) { return c.code === row.querySelector('.bk-cur').value; })[0];
                rateEl.value = rateFor(cur, tipe) || '';
            }
        });
    }
    function formLines() {
        return Array.prototype.map.call(document.querySelectorAll('#bkItems .bk-it'), function (row) {
            return { valuta: row.querySelector('.bk-cur').value, nominal: num(row.querySelector('.bk-amt').value), rate: num(row.querySelector('.bk-rate').value) };
        });
    }
    function recalc() {
        if (!$('bkTot')) return;
        var total = formLines().reduce(function (s, l) { return s + l.nominal * l.rate; }, 0);
        var dpEl = $('bkDp'), dp = num(dpEl.value);
        if (dp > total) { dp = total; dpEl.value = round0(total); }
        $('bkTot').textContent = rp(total); $('bkRem').textContent = rp(Math.max(total - dp, 0));
        var hint = $('bkStockHint');
        if (hint) {
            var curs = ($('bkModal') && $('bkModal')._curs) || currencies(), need = {}, msgs = [];
            if ($('bkTipe').value === 'JUAL') formLines().forEach(function (l) { if (l.nominal > 0) need[l.valuta] = (need[l.valuta] || 0) + l.nominal; });
            Object.keys(need).forEach(function (code) {
                var c = curs.filter(function (x) { return x.code === code; })[0], have = c ? num(c.stock) : 0;
                if (have < need[code]) msgs.push(code + ': stok ' + nf.format(have) + ', dibutuhkan ' + nf.format(need[code]) + ' &rarr; perlu dicari ' + nf.format(need[code] - Math.max(have, 0)));
            });
            hint.style.display = msgs.length ? 'block' : 'none';
            hint.innerHTML = msgs.length ? '<b>Stok kurang (booking tetap bisa disimpan):</b><br>' + msgs.join('<br>') : '';
        }
    }
    function resolveCustomer(text) {
        text = String(text || '').trim().toLowerCase(); if (!text) return null;
        var list = customers();
        var exact = list.filter(function (c) {
            var lbl = (custId(c) + ' — ' + custName(c) + (custPhone(c) ? ' — ' + custPhone(c) : '')).toLowerCase();
            return lbl === text || custId(c).toLowerCase() === text;
        })[0];
        if (exact) return exact;
        var part = list.filter(function (c) { return (custName(c) + ' ' + custPhone(c)).toLowerCase().indexOf(text) !== -1; });
        return part.length === 1 ? part[0] : null;
    }

    async function saveCreate(printAfter) {
        if (S.busy) return; S.busy = true;
        try {
            var cust = resolveCustomer($('bkCust').value);
            var tipe = $('bkTipe').value, arrival = $('bkArr').value, method = $('bkPay').value;
            var dp = num($('bkDp').value), note = $('bkNote').value.trim();
            var lines = formLines().filter(function (l) { return l.nominal > 0 || l.rate > 0; });
            if (!cust) return showError(null, 'Pilih nasabah dari daftar (ketik ID atau nama lalu pilih).');
            if (!lines.length) return showError(null, 'Isi minimal satu valuta.');
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].nominal <= 0) return showError(null, 'Nominal valas ' + lines[i].valuta + ' harus lebih dari 0.');
                if (lines[i].rate <= 0) return showError(null, 'Kurs ' + lines[i].valuta + ' harus lebih dari 0.');
            }
            if (!arrival) return showError(null, 'Jadwal datang wajib diisi.');
            var total = lines.reduce(function (s, l) { return s + l.nominal * l.rate; }, 0);
            if (dp < 0 || dp > total + 0.5) return showError(null, 'DP tidak boleh melebihi total.');

            var curs = currencies(), need = {};
            lines.forEach(function (l) { need[l.valuta] = (need[l.valuta] || 0) + l.nominal; });
            for (var code in need) {
                var ci = curs.findIndex(function (c) { return c.code === code; });
                if (ci === -1) return showError(null, 'Valuta ' + code + ' tidak ditemukan.');
                // Booking TIDAK dibatasi stok: valas yang kurang dicarikan sebelum nasabah datang.
            }
            showError(null, '');
            var id = await nextBookingId();
            var now = new Date().toISOString(), kasir = currentUserName();
            var rows = lines.map(function (l, idx) {
                return {
                    id: id, itemId: id + '-' + l.valuta + '-' + String(idx + 1).padStart(2, '0'), timestamp: now,
                    tipe: tipe, valuta: l.valuta, nominal: l.nominal, rate: l.rate, total: round0(l.nominal * l.rate),
                    customerId: custId(cust), customerName: custName(cust), paymentMethod: method, bank: method === 'CASH' ? null : method,
                    expectedArrival: arrival, kasir: kasir, keterangan: note,
                    tipe_transaksi: 'BOOKING', status: 'PENDING', bookingId: id, invoiceId: null,
                    dpAmount: dp, remainingAmount: Math.max(round0(total) - dp, 0)
                };
            });
            // stok dicadangkan (JUAL) / dicatat (BELI), sama seperti booking dari kasir
            Object.keys(need).forEach(function (code) {
                var ci = curs.findIndex(function (c) { return c.code === code; });
                curs[ci].stock = num(curs[ci].stock) + (tipe === 'JUAL' ? -need[code] : need[code]);
            });
            await saveCurrencies(curs);
            if (dp > 0) moveMoney(method, dp, tipe === 'JUAL' ? 1 : -1, tipe === 'JUAL' ? 'DP Booking' : 'DP Booking (dibayarkan)', id);
            saveBookings(allRows().concat(rows));
            closeModal(); render();
            var lack = tipe === 'JUAL' ? Object.keys(need).map(function (code) {
                var c = curs.filter(function (x) { return x.code === code; })[0]; return c && num(c.stock) < 0 ? nf.format(-num(c.stock)) + ' ' + code : '';
            }).filter(Boolean) : [];
            toast(lack.length ? 'warning' : 'success', 'Booking ' + id + ' tersimpan' + (lack.length ? ' — kekurangan stok yang perlu dicari: ' + lack.join(', ') : ''));
            if (typeof loadStockMonitor === 'function') { try { loadStockMonitor(); } catch (e) { /* abaikan */ } }
            if (printAfter) printSlip(id);
        } finally { S.busy = false; }
    }

    // ------------------------------------------------------------ ambil -> halaman Transaksi
    // Peta { idDraftTransaksi: idBooking }: tiap form transaksi (draft) bisa membawa satu booking.
    var IMPORT_KEY = 'mc_pos_booking_import_v1';
    function importMap() { try { return JSON.parse(localStorage.getItem(IMPORT_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function saveImportMap(m) { try { localStorage.setItem(IMPORT_KEY, JSON.stringify(m)); } catch (e) { /* abaikan */ } }
    function activeDraftId() { try { return typeof getActivePosDraftId === 'function' ? getActivePosDraftId() : ''; } catch (e) { return ''; } }
    function isImported(bookingId) {
        var m = importMap();
        return Object.keys(m).some(function (k) { return m[k] === bookingId; });
    }

    // dipakai 03-pos.js / 39-pos-payment.js: data booking pada form transaksi aktif (atau null)
    window.getPosBookingImport = function () {
        var did = activeDraftId(); if (!did) return null;
        var bid = importMap()[did]; if (!bid) return null;
        var b = findBooking(bid); if (!b || b.status !== 'active') return null;
        return { bookingId: b.id, dp: b.dp, dpMethod: normMethod(b.first), rows: b.rows, bookingTimestamp: b.created, dir: b.dir, name: b.name };
    };

    window.finalizeBookingImport = function (imp, invoiceId, info) {
        info = info || {};
        var nowIso = new Date().toISOString(), who = currentUserName();
        saveBookings(allRows().map(function (r) {
            if (r.id !== imp.bookingId || String(r.status).toUpperCase() !== 'PENDING') return r;
            var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; });
            o.status = 'CONVERTED_TO_INVOICE'; o.bookingStatus = 'CONVERTED_TO_INVOICE'; o.invoiceId = invoiceId;
            o.settledAt = nowIso; o.settledBy = who; o.settledRemaining = round0(info.remaining || 0); o.remainingAmount = 0;
            o.settlementMethod = info.paymentMethod || null;
            return o;
        }));
        var m = importMap();
        Object.keys(m).forEach(function (k) { if (m[k] === imp.bookingId) delete m[k]; });
        saveImportMap(m);
        renderPosBanner();
        if ($('bookingRoot') && $('bookingRoot').dataset.ready === '1') render();
    };

    function releaseImport() {
        var did = activeDraftId(), m = importMap();
        if (did && m[did]) { delete m[did]; saveImportMap(m); }
        renderPosBanner();
        if (typeof window.recalculatePosGrandTotal === 'function') window.recalculatePosGrandTotal();
        if (window.refreshPosPaymentUi) window.refreshPosPaymentUi(true);
    }

    function renderPosBanner() {
        var posView = $('pos-view'), old = $('posBookingBanner');
        var imp = window.getPosBookingImport();
        if (!posView || !imp) { if (old) old.remove(); return; }
        var cart = typeof currentCart !== 'undefined' && Array.isArray(currentCart) ? currentCart : [];
        var gt = 0; cart.forEach(function (i) { gt += (Number(i.totalIdr) || 0) * (i.type === 'JUAL' ? 1 : -1); });
        var dueNow = Math.max(0, Math.abs(gt) - imp.dp);
        var html = '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:space-between">' +
            '<div><b><i class="fa-solid fa-book-bookmark"></i> Dari booking ' + esc(imp.bookingId) + '</b> &middot; ' + esc(imp.name) +
            '<div style="font-size:.82rem;opacity:.85;margin-top:3px">DP sudah ' + (imp.dir === 'IN' ? 'diterima' : 'dibayarkan') + ' <b>' + rp(imp.dp) + '</b> &middot; yang dibayar sekarang <b>' + rp(dueNow) + '</b> &middot; nomor invoice terbit saat Proses Pembayaran</div></div>' +
            '<button type="button" class="bk-btn sm" data-bk="release">Lepas dari booking</button></div>';
        if (!old) {
            old = document.createElement('div'); old.id = 'posBookingBanner'; old.className = 'bk-root';
            old.style.cssText = 'margin:0 0 12px;padding:12px 14px;border-radius:12px;border:1px solid var(--mc-warning,#f59e0b);background:color-mix(in srgb,var(--mc-warning,#f59e0b) 12%,transparent);color:var(--mc-text,#fafafa)';
            posView.insertBefore(old, posView.firstChild);
        }
        if (old.dataset.h !== html) { old.innerHTML = html; old.dataset.h = html; }
    }

    function exportToPos(id) {
        var b = findBooking(id);
        if (!b || b.status !== 'active') return toast('warning', 'Booking aktif tidak ditemukan.');
        if (isImported(id) && !window.confirm('Booking ' + id + ' sudah dimuat di salah satu form Transaksi. Muat lagi di form baru?')) return;
        var nav = document.querySelector('.nav-item[data-target="pos-view"]');
        if (!nav) return toast('error', 'Menu Transaksi tidak ditemukan.');
        nav.click();
        setTimeout(function () {
            try {
                if (typeof window.addPosDraftSession === 'function') window.addPosDraftSession();
                var did = activeDraftId();
                if (!did) return toast('error', 'Form Transaksi belum siap. Coba lagi.');
                var m = importMap();
                Object.keys(m).forEach(function (k) { if (m[k] === id) delete m[k]; });
                m[did] = id; saveImportMap(m);
                var stamp = Date.now();
                currentCart = b.rows.map(function (r, idx) {
                    return { id: String(stamp) + idx, type: String(r.tipe).toUpperCase(), curCode: r.valuta, amount: num(r.nominal), rate: num(r.rate), totalIdr: num(r.total) };
                });
                if (b.customerId && typeof window.selectPosCustomerModern === 'function') window.selectPosCustomerModern(b.customerId);
                if (typeof renderCart === 'function') renderCart();
                if (typeof window.recalculatePosGrandTotal === 'function') window.recalculatePosGrandTotal();
                if (typeof updateProcessPaymentState === 'function') updateProcessPaymentState();
                if (typeof scheduleSaveActivePosDraft === 'function') scheduleSaveActivePosDraft();
                if (window.refreshPosPaymentUi) window.refreshPosPaymentUi(true);
                renderPosBanner(); render();
                toast('success', 'Booking ' + id + ' dimuat. Terima sisa pembayaran lalu Proses Pembayaran.');
            } catch (e) { console.error(e); toast('error', 'Gagal memuat booking ke Transaksi: ' + (e.message || e)); }
        }, 300);
    }

    // ------------------------------------------------------------ batal & ubah jadwal
    function openCancel(id) {
        var b = findBooking(id);
        if (!b || b.status !== 'active') return toast('warning', 'Booking aktif tidak ditemukan.');
        var dirIn = b.dir === 'IN';
        var dpBlock = b.dp > 0
            ? '<div class="bk-f"><label>' + (dirIn ? 'DP ' + rp(b.dp) + ' yang sudah diterima' : 'DP ' + rp(b.dp) + ' yang sudah dibayarkan') + '</label><select id="bkDisp">' +
              '<option value="REFUND">' + (dirIn ? 'Kembalikan DP ke nasabah' : 'DP dikembalikan oleh nasabah') + '</option><option value="FORFEIT">' + (dirIn ? 'DP hangus (menjadi pendapatan usaha)' : 'DP hangus (tidak dikembalikan)') + '</option></select></div>'
            : '';
        openModal({ title: '<i class="fa-solid fa-xmark"></i> Batalkan Booking ' + esc(b.id), body:
            '<div class="bk-note">Stok valas yang dicadangkan akan dikembalikan. Booking tetap tercatat dengan status Dibatalkan.</div>' +
            '<div class="bk-f"><label>Alasan pembatalan (wajib)</label><select id="bkWhy"><option value="">Pilih alasan...</option><option>Nasabah membatalkan</option><option>Nasabah tidak datang</option><option>Kurs tidak sesuai</option><option>Stok tidak tersedia</option><option>Kesalahan input</option><option value="__other">Lainnya...</option></select></div>' +
            '<div class="bk-f" id="bkWhyBox" style="display:none"><label>Tulis alasan</label><input id="bkWhyTxt" placeholder="Alasan pembatalan"></div>' + dpBlock + ERR,
            footer: '<button class="bk-btn" data-bk="close">Kembali</button><button class="bk-btn bad" data-bk="docancel" data-id="' + esc(id) + '">Ya, Batalkan Booking</button>',
            onOpen: function () { $('bkWhy').addEventListener('change', function () { $('bkWhyBox').style.display = this.value === '__other' ? '' : 'none'; }); } });
    }
    async function doCancel(id) {
        if (S.busy) return; S.busy = true;
        try {
            var b = findBooking(id);
            if (!b || b.status !== 'active') return showError(null, 'Booking sudah tidak aktif.');
            var why = $('bkWhy').value; if (why === '__other') why = $('bkWhyTxt').value.trim();
            if (!why) return showError(null, 'Alasan pembatalan wajib diisi.');
            var disp = b.dp > 0 ? $('bkDisp').value : 'NONE';

            var curs = currencies();
            b.rows.forEach(function (r) {
                var ci = curs.findIndex(function (c) { return c.code === r.valuta; });
                if (ci > -1) curs[ci].stock = num(curs[ci].stock) + (String(r.tipe).toUpperCase() === 'JUAL' ? num(r.nominal) : -num(r.nominal));
            });
            await saveCurrencies(curs);
            if (disp === 'REFUND') moveMoney(normMethod(b.first), b.dp, b.dir === 'IN' ? -1 : 1, 'Pengembalian DP Booking', b.id);

            var nowIso = new Date().toISOString(), who = currentUserName();
            saveBookings(allRows().map(function (r) {
                if (r.id !== b.id) return r;
                var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; });
                o.status = 'CANCELLED'; o.bookingStatus = 'CANCELLED'; o.cancelReason = why; o.cancelledAt = nowIso; o.cancelledBy = who; o.dpDisposition = disp;
                return o;
            }));
            closeModal(); render();
            toast('success', 'Booking ' + b.id + ' dibatalkan');
            if (typeof loadStockMonitor === 'function') { try { loadStockMonitor(); } catch (e) { /* abaikan */ } }
        } finally { S.busy = false; }
    }
    function openResched(id) {
        var b = findBooking(id); if (!b || b.status !== 'active') return;
        var cur = b.arrival || new Date();
        openModal({ title: '<i class="fa-regular fa-calendar"></i> Ubah Jadwal ' + esc(b.id), body:
            '<div class="bk-f"><label>Jadwal datang baru</label><input type="datetime-local" id="bkNewArr" value="' + toLocalInput(cur) + '"></div>' + ERR,
            footer: '<button class="bk-btn" data-bk="close">Tutup</button><button class="bk-btn pri" data-bk="dosched" data-id="' + esc(id) + '">Simpan Jadwal</button>' });
    }
    function doResched(id) {
        var v = $('bkNewArr').value; if (!v) return showError(null, 'Jadwal wajib diisi.');
        saveBookings(allRows().map(function (r) {
            if (r.id !== id) return r;
            var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); o.expectedArrival = v; return o;
        }));
        closeModal(); render(); toast('success', 'Jadwal diperbarui');
    }

    // ------------------------------------------------------------ WhatsApp
    async function sendWa(id) {
        var b = findBooking(id); if (!b || b.status !== 'active') return toast('warning', 'Booking aktif tidak ditemukan.');
        var phone = String(b.phone || '').replace(/[^0-9]/g, '');
        if (phone.indexOf('0') === 0) phone = '62' + phone.slice(1); else if (phone.indexOf('8') === 0) phone = '62' + phone;
        if (!phone) return toast('warning', 'Nomor WhatsApp nasabah belum tersedia.');
        var lines = b.rows.map(function (t) { return '- ' + t.tipe + ' ' + nf.format(num(t.nominal)) + ' ' + t.valuta + ' @ ' + rateFmt(t.rate) + ' = ' + rp(t.total); }).join('\n');
        var fallback = ['Halo ' + b.name + ',', 'Booking valas Anda sudah tercatat.', '', 'No Booking: ' + b.id, 'Jam Kedatangan: ' + fmtDT(b.arrival), lines,
            'Total: ' + rp(b.total), 'DP: ' + rp(b.dp), 'Sisa Pelunasan: ' + rp(b.remaining), '', 'Mohon datang sesuai jadwal. Terima kasih.'].join('\n');
        var text = fallback;
        try {
            if (typeof window.buildWaMessageForPurpose === 'function') {
                text = window.buildWaMessageForPurpose('booking', fallback, { customerName: b.name, invoice: b.id, date: fmtDT(b.arrival), currencyList: lines, total: rp(b.total), paymentMethod: 'BOOKING', paymentDetail: 'DP: ' + rp(b.dp) + ' | Sisa: ' + rp(b.remaining) });
            }
            await window.sendWhatsAppGateway(phone, text, { reference: b.id });
            toast('success', 'Pesan booking terkirim lewat WA Gateway');
        } catch (e) { toast('error', 'Gagal mengirim WhatsApp: ' + (e.message || e)); }
    }

    // ------------------------------------------------------------ ekspor CSV
    function exportCsv() {
        var list = filtered(groupBookings());
        if (!list.length) return toast('info', 'Tidak ada data untuk diekspor.');
        var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
        var head = ['No. Booking', 'Status', 'Dibuat', 'Jadwal Datang', 'Nasabah', 'Telp', 'Rincian', 'Total', 'DP', 'Sisa', 'No. Invoice', 'Alasan Batal'];
        var rows = list.map(function (b) {
            return [b.id, b.status === 'active' ? 'Aktif' : (b.status === 'done' ? 'Selesai' : 'Dibatalkan'), fmtDT(b.created), fmtDT(b.arrival), b.name, b.phone,
                b.rows.map(function (r) { return r.tipe + ' ' + r.nominal + ' ' + r.valuta + ' @' + r.rate; }).join('; '),
                round0(b.total), round0(b.dp), round0(b.remaining), b.status === 'done' ? b.invoiceId : '', b.cancelReason].map(q).join(',');
        });
        var blob = new Blob(['﻿' + head.map(q).join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'daftar-booking-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    // ------------------------------------------------------------ event
    function bind() {
        if (S.bound) return; S.bound = true;
        document.addEventListener('click', function (ev) {
            var t = ev.target.closest('[data-bk]'); if (!t) return;
            var act = t.dataset.bk, id = t.dataset.id;
            if (act === 'close') return closeModal();
            if (act === 'new') return openCreate();
            if (act === 'refresh') { render(); return toast('success', 'Daftar diperbarui'); }
            if (act === 'csv') return exportCsv();
            if (act === 'tab') { S.tab = t.dataset.v; render(); return; }
            if (act === 'slip') return printSlip(id);
            if (act === 'inv') return printInvoice(id);
            if (act === 'wa') return sendWa(id);
            if (act === 'export') return exportToPos(id);
            if (act === 'release') return releaseImport();
            if (act === 'cancel') return openCancel(id);
            if (act === 'docancel') return doCancel(id);
            if (act === 'resched') return openResched(id);
            if (act === 'dosched') return doResched(id);
            if (act === 'save') return saveCreate(t.dataset.print === '1');
            if (act === 'addline') {
                var ov = $('bkModal'), curOpts = (ov._curs || currencies()).map(function (c) { return '<option value="' + esc(c.code) + '">' + esc(c.code) + ' (stok ' + nf.format(num(c.stock)) + ')</option>'; }).join('');
                t.insertAdjacentHTML('beforebegin', itemRowHtml(curOpts)); fillRates(ov); recalc(); return;
            }
            if (act === 'rmline') {
                var rows = document.querySelectorAll('#bkItems .bk-it');
                if (rows.length > 1) { t.closest('.bk-it').remove(); recalc(); }
                return;
            }
            if (act === 'dppct') {
                var total = formLines().reduce(function (s, l) { return s + l.nominal * l.rate; }, 0);
                $('bkDp').value = round0(total * num(t.dataset.v)); recalc();
            }
        });
        document.addEventListener('input', function (ev) {
            var id = ev.target.id;
            if (id === 'bkQ') { S.q = ev.target.value; renderBody(groupBookings()); }
            else if (ev.target.closest && ev.target.closest('#bkModal') && /bk-amt|bk-rate/.test(ev.target.className) || id === 'bkDp') recalc();
        });
        document.addEventListener('change', function (ev) {
            var id = ev.target.id, ov = $('bkModal');
            if (id === 'bkMonth') { S.month = ev.target.value; renderBody(groupBookings()); }
            else if (id === 'bkSort') { S.sort = ev.target.value; renderBody(groupBookings()); }
            else if (id === 'bkWhen') { S.when = ev.target.value; renderBody(groupBookings()); }
            else if (ov && id === 'bkTipe') { fillRates(ov, true); recalc(); }
            else if (ov && ev.target.classList && ev.target.classList.contains('bk-cur')) {
                var row = ev.target.closest('.bk-it'), cur = (ov._curs || currencies()).filter(function (c) { return c.code === ev.target.value; })[0];
                row.querySelector('.bk-rate').value = rateFor(cur, $('bkTipe').value) || ''; recalc();
            }
        });
        document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && modalOpen()) closeModal(); });
    }

    function tick() {
        reconcileConverted();
        var view = $('booking-view');
        if (!view || view.classList.contains('hidden') || modalOpen() || document.hidden) return;
        if (signature() !== S.sig) render();
    }

    // ------------------------------------------------------------ API publik (nama lama tetap)
    window.loadBookingsTable = function () {
        injectStyle(); bind(); render();
        if (!S.timer) S.timer = setInterval(tick, 5000);
    };
    window.openBookingEntryForm = function () { injectStyle(); bind(); shell(); openCreate(); };
    window.settleBooking = function (id) { injectStyle(); bind(); exportToPos(id); };
    window.exportBookingToPos = function (id) { injectStyle(); bind(); exportToPos(id); };
    window.cancelBooking = function (id) { injectStyle(); bind(); openCancel(id); };
    window.printBookingReceipt = function (booking) { if (booking && booking.id) printSlip(booking.id); };
    window.printBookingReceiptById = function (id) { printSlip(id); };
    window.printBookingInvoice = function (id) { printInvoice(id); };
    window.sendBookingWhatsApp = function (id) { return sendWa(id); };

    // lencana sidebar & pengingat berjalan sejak aplikasi dibuka
    function boot() {
        injectStyle(); bind(); reconcileConverted(); updateBadge(); setInterval(reconcileConverted, 5000); setInterval(reminderTick, 60000); setTimeout(reminderTick, 4000);
        setInterval(function () { var v = $('pos-view'); if (v && !v.classList.contains('hidden')) renderPosBanner(); else if ($('posBookingBanner')) renderPosBanner(); }, 800);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
