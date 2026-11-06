// Laporan Rekonsiliasi Harian @2026-Alifiandra
// Riwayat setiap hari: kas, rekening bank, dan valas (Rp) — angka sistem, hitungan fisik, selisih,
// status closing, siapa yang mengunci dan alasannya. Data dari server (/api/closing/report).
// Klik satu hari untuk rincian per rekening, per valuta, dan daftar transaksinya.
(function () {
    'use strict';

    const VIEW_ID = 'rekon-report-view', ROOT_ID = 'rekonRoot';
    const S = { from: '', to: '', filter: 'all', data: null, loading: false, error: '', built: false };
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    const qf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
    const rp = (n) => (n < 0 ? '-' : '') + 'Rp ' + nf.format(Math.abs(Math.round(Number(n) || 0)));
    const sg = (n) => { const v = Math.round(Number(n) || 0); return v === 0 ? 'Rp 0' : (v > 0 ? '+' : '-') + 'Rp ' + nf.format(Math.abs(v)); };
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const dateTxt = (s) => { const d = new Date(s + 'T12:00:00'); return `${DAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
    const STATUS = {
        CLOSED: ['ok', 'Dikunci'], TEMPORARY: ['warn', 'Sementara'], DRAFT: ['warn', 'Draft'],
        SHORT: ['bad', 'Belum final'], OVER: ['bad', 'Belum final'], BALANCED: ['warn', 'Belum final'], NONE: ['mut', 'Belum closing']
    };
    const st = (s) => STATUS[s] || ['warn', s];
    const tone = (n) => (Math.abs(n) < 0.5 ? 'zero' : n > 0 ? 'pos' : 'neg');

    async function api(path) {
        const res = await (window.authFetch || window.fetch)(path, { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.status === 'error') throw new Error(json.message || ('Permintaan gagal (HTTP ' + res.status + ')'));
        return json;
    }

    function injectStyle() {
        if ($('rr-style')) return;
        const el = document.createElement('style');
        el.id = 'rr-style';
        el.textContent = `
        .rr{--rr-bd:var(--mc-border,rgba(148,163,184,.3));color:var(--mc-text,inherit)}
        .rr-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px}
        .rr-head h2{margin:0;font-size:1.3rem}.rr-head p{margin:4px 0 0;opacity:.7;font-size:.85rem;max-width:760px}
        .rr-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
        .rr-tools input[type=date]{padding:7px 10px;border-radius:9px;border:1px solid var(--rr-bd);background:transparent;color:inherit}
        .rr-btn{display:inline-flex;gap:7px;align-items:center;height:36px;padding:0 13px;border-radius:9px;border:1px solid var(--rr-bd);background:transparent;color:inherit;font-weight:700;font-size:.8rem;cursor:pointer}
        .rr-btn:hover{border-color:#3b82f6;color:#3b82f6}.rr-btn.on{background:#3b82f6;border-color:#3b82f6;color:#fff}
        .rr-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
        .rr-sum div{border:1px solid var(--rr-bd);border-radius:12px;padding:10px 14px;background:var(--mc-card-bg,transparent)}
        .rr-sum small{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.4px;opacity:.7;font-weight:800}
        .rr-sum b{font-size:1.05rem}
        .rr-wrap{overflow:auto;border:1px solid var(--rr-bd);border-radius:12px;max-height:70vh;background:var(--mc-card-bg,transparent)}
        .rr-tbl{width:100%;border-collapse:collapse;font-size:.82rem;white-space:nowrap}
        .rr-tbl th{position:sticky;background:var(--mc-card-bg,#fff);z-index:1;padding:8px 10px;font-size:.7rem;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--rr-bd)}
        .rr-tbl thead tr:first-child th{top:0}.rr-tbl thead tr:nth-child(2) th{top:31px}
        .rr-tbl th.g{text-align:center;border-left:2px solid var(--rr-bd)}
        .rr-tbl td{padding:9px 10px;border-bottom:1px solid var(--rr-bd)}
        .rr-tbl td.r,.rr-tbl th.r{text-align:right}.rr-tbl .gl{border-left:2px solid var(--rr-bd)}
        .rr-tbl tbody tr{cursor:pointer}.rr-tbl tbody tr:hover td{background:rgba(59,130,246,.07)}
        .rr-tbl tfoot td{font-weight:800;border-top:2px solid var(--rr-bd);position:sticky;bottom:0;background:var(--mc-card-bg,#fff)}
        .rr-pos{color:#059669;font-weight:800}.rr-neg{color:#dc2626;font-weight:800}.rr-zero{opacity:.55}
        .rr-st{display:inline-block;padding:3px 9px;border-radius:999px;font-size:.7rem;font-weight:800}
        .rr-st.ok{background:rgba(16,185,129,.15);color:#059669}.rr-st.warn{background:rgba(245,158,11,.18);color:#b45309}
        .rr-st.bad{background:rgba(239,68,68,.15);color:#dc2626}.rr-st.mut{background:rgba(100,116,139,.15);color:#64748b}
        .rr-note{max-width:260px;overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:bottom}
        .rr-dim{opacity:.5}
        .rr-ov{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);display:flex;justify-content:center;align-items:flex-start;padding:24px;overflow:auto}
        .rr-md{background:var(--mc-card-bg,#fff);color:var(--mc-text,#0f172a);border-radius:16px;width:100%;max-width:1100px;box-shadow:0 25px 60px rgba(0,0,0,.35)}
        .rr-mh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--rr-bd)}
        .rr-mh h3{margin:0;font-size:1.1rem}.rr-x{border:0;background:transparent;color:inherit;font-size:1.6rem;cursor:pointer}
        .rr-mb{padding:16px 20px;display:grid;gap:16px}
        .rr-box{border:1px solid var(--rr-bd);border-radius:12px;padding:12px 14px}
        .rr-box h4{margin:0 0 8px;font-size:.9rem}
        .rr-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;font-size:.83rem}
        .rr-kv div small{display:block;opacity:.65;font-size:.72rem}
        @media print{.rr-tools,.rr-btn{display:none!important}}
        `;
        document.head.appendChild(el);
    }

    function quick(kind) {
        const now = new Date();
        let a = new Date(now), b = new Date(now);
        if (kind === 'month') a = new Date(now.getFullYear(), now.getMonth(), 1);
        else if (kind === 'last') { a = new Date(now.getFullYear(), now.getMonth() - 1, 1); b = new Date(now.getFullYear(), now.getMonth(), 0); }
        else if (kind === '7') a.setDate(a.getDate() - 6);
        else if (kind === '30') a.setDate(a.getDate() - 29);
        S.from = ymd(a); S.to = ymd(b);
        $('rrFrom').value = S.from; $('rrTo').value = S.to;
        load();
    }

    function build() {
        const root = $(ROOT_ID); if (!root) return;
        injectStyle();
        if (!S.from) { const n = new Date(); S.from = ymd(new Date(n.getFullYear(), n.getMonth(), 1)); S.to = ymd(n); }
        root.className = 'rr';
        root.innerHTML = `
            <div class="rr-head"><div><h2><i class="fa-solid fa-scale-balanced"></i> Laporan Rekonsiliasi Harian</h2>
                <p>Riwayat setiap hari: kas, rekening bank, dan valas (Rp) — angka sistem, hitungan fisik, dan selisihnya. Klik satu baris untuk rinciannya.</p></div>
                <div style="display:flex;gap:8px"><button class="rr-btn" data-rr="xlsx"><i class="fa-solid fa-file-excel"></i> Export Excel</button><button class="rr-btn" data-rr="print"><i class="fa-solid fa-print"></i> Cetak</button></div></div>
            <div class="rr-tools">
                <input type="date" id="rrFrom" value="${esc(S.from)}" max="${esc(ymd(new Date()))}"> <span>s/d</span>
                <input type="date" id="rrTo" value="${esc(S.to)}" max="${esc(ymd(new Date()))}">
                <button class="rr-btn" data-rr-q="month">Bulan ini</button><button class="rr-btn" data-rr-q="last">Bulan lalu</button>
                <button class="rr-btn" data-rr-q="7">7 hari</button><button class="rr-btn" data-rr-q="30">30 hari</button>
                <span style="flex:1"></span>
                <button class="rr-btn" data-rr-f="all">Semua</button><button class="rr-btn" data-rr-f="diff">Ada selisih</button>
                <button class="rr-btn" data-rr-f="open">Belum dikunci</button><button class="rr-btn" data-rr-f="none">Belum closing</button>
            </div>
            <div class="rr-sum" id="rrSum"></div>
            <div id="rrBody"></div>`;
        root.addEventListener('click', onClick);
        $('rrFrom').addEventListener('change', (e) => { S.from = e.target.value; load(); });
        $('rrTo').addEventListener('change', (e) => { S.to = e.target.value; load(); });
        S.built = true;
        load();
    }

    function onClick(e) {
        const q = e.target.closest('[data-rr-q]'); if (q) return quick(q.dataset.rrQ);
        const f = e.target.closest('[data-rr-f]'); if (f) { S.filter = f.dataset.rrF; render(); return; }
        const a = e.target.closest('[data-rr]');
        if (a && a.dataset.rr === 'xlsx') return exportXlsx();
        if (a && a.dataset.rr === 'print') return printReport();
        const row = e.target.closest('tr[data-date]'); if (row) openDetail(row.dataset.date);
    }

    async function load(silent) {
        if (!S.from || !S.to) return;
        S.loading = true; S.error = '';
        if (!silent && $('rrBody')) $('rrBody').innerHTML = '<div style="padding:24px;opacity:.65"><i class="fa-solid fa-spinner fa-spin"></i> Memuat laporan...</div>';
        try {
            const res = await api(`/api/closing/report?from=${encodeURIComponent(S.from)}&to=${encodeURIComponent(S.to)}`);
            S.data = res.data;
        } catch (err) { S.error = err.message; }
        S.loading = false;
        render();
    }

    function filtered() {
        const days = (S.data && S.data.days) || [];
        if (S.filter === 'diff') return days.filter((d) => Math.abs(d.total_difference) >= 0.5);
        if (S.filter === 'open') return days.filter((d) => d.status !== 'CLOSED' && d.status !== 'NONE');
        if (S.filter === 'none') return days.filter((d) => d.status === 'NONE');
        return days;
    }

    const cell = (n, counted) => (counted ? `<span class="rr-${tone(n)}">${esc(sg(n))}</span>` : '<span class="rr-dim">belum dihitung</span>');

    function render() {
        const body = $('rrBody'); if (!body) return;
        document.querySelectorAll('#rekonRoot [data-rr-f]').forEach((b) => b.classList.toggle('on', b.dataset.rrF === S.filter));
        if (S.error) { body.innerHTML = `<div class="panel text-red" style="padding:16px">Laporan belum bisa dimuat: ${esc(S.error)}</div>`; $('rrSum').innerHTML = ''; return; }
        if (!S.data) return;
        const s = S.data.summary;
        $('rrSum').innerHTML = `
            <div><small>Jumlah hari</small><b>${s.days}</b></div>
            <div><small>Dikunci</small><b style="color:#059669">${s.closed}</b></div>
            <div><small>Belum dikunci / belum closing</small><b style="color:#b45309">${s.open} / ${s.none}</b></div>
            <div><small>Hari dengan selisih</small><b style="color:#dc2626">${s.variance_days}</b></div>
            <div><small>Selisih kas</small><b class="rr-${tone(s.cash)}">${esc(sg(s.cash))}</b></div>
            <div><small>Selisih bank</small><b class="rr-${tone(s.bank)}">${esc(sg(s.bank))}</b></div>
            <div><small>Selisih valas (Rp)</small><b class="rr-${tone(s.valas)}">${esc(sg(s.valas))}</b></div>
            <div><small>Total selisih</small><b class="rr-${tone(s.total)}">${esc(sg(s.total))}</b></div>`;
        const days = filtered();
        const tot = days.reduce((a, d) => ({ c: a.c + d.cash.difference, b: a.b + d.bank.difference, v: a.v + d.valas.difference, t: a.t + d.total_difference }), { c: 0, b: 0, v: 0, t: 0 });
        body.innerHTML = `<div class="rr-wrap"><table class="rr-tbl">
            <thead>
                <tr><th rowspan="2">Tanggal</th><th rowspan="2">Status</th><th class="g" colspan="3">Kas Tunai</th><th class="g" colspan="3">Rekening Bank</th><th class="g" colspan="3">Valas (Rp)</th><th class="g" rowspan="2">Total Selisih</th><th rowspan="2">Dikunci oleh</th><th rowspan="2">Alasan / Catatan</th></tr>
                <tr><th class="r gl">Sistem</th><th class="r">Fisik</th><th class="r">Selisih</th><th class="r gl">Sistem</th><th class="r">Rek. Koran</th><th class="r">Selisih</th><th class="r gl">Sistem</th><th class="r">Fisik</th><th class="r">Selisih</th></tr>
            </thead>
            <tbody>${days.map((d) => `
                <tr data-date="${esc(d.date)}" title="Klik untuk rincian">
                    <td><b>${esc(dateTxt(d.date))}</b>${d.movement_count ? '' : ' <span class="rr-dim">· tanpa transaksi</span>'}</td>
                    <td><span class="rr-st ${st(d.status)[0]}">${esc(st(d.status)[1])}</span></td>
                    <td class="r gl">${esc(rp(d.cash.expected))}</td><td class="r">${d.cash.counted ? esc(rp(d.cash.physical + d.cash.hanging)) : '<span class="rr-dim">-</span>'}</td><td class="r">${cell(d.cash.difference, d.cash.counted)}</td>
                    <td class="r gl">${esc(rp(d.bank.system))}</td><td class="r">${d.bank.counted ? esc(rp(d.bank.statement)) : '<span class="rr-dim">-</span>'}</td><td class="r">${cell(d.bank.difference, d.bank.counted)}</td>
                    <td class="r gl">${esc(rp(d.valas.system_value))}</td><td class="r">${d.valas.counted ? esc(rp(d.valas.physical_value)) + `<div class="rr-dim" style="font-size:.7rem">${d.valas.counted} dari ${d.valas.items.length} valuta</div>` : '<span class="rr-dim">-</span>'}</td><td class="r">${cell(d.valas.difference, d.valas.counted)}</td>
                    <td class="r gl"><span class="rr-${tone(d.total_difference)}">${esc(sg(d.total_difference))}</span></td>
                    <td>${esc(d.closed_by || '-')}</td>
                    <td><span class="rr-note" title="${esc(d.notes || '')}">${esc(d.notes || '-')}</span></td>
                </tr>`).join('') || '<tr><td colspan="14" style="text-align:center;padding:24px;opacity:.65">Tidak ada hari di filter ini.</td></tr>'}</tbody>
            <tfoot><tr><td colspan="4">Total (${days.length} hari)</td><td class="r"><span class="rr-${tone(tot.c)}">${esc(sg(tot.c))}</span></td><td colspan="2"></td><td class="r"><span class="rr-${tone(tot.b)}">${esc(sg(tot.b))}</span></td><td colspan="2"></td><td class="r"><span class="rr-${tone(tot.v)}">${esc(sg(tot.v))}</span></td><td class="r gl"><span class="rr-${tone(tot.t)}">${esc(sg(tot.t))}</span></td><td colspan="2"></td></tr></tfoot>
        </table></div>
        <p style="font-size:.75rem;opacity:.65;margin-top:8px">Kas pada hari yang sudah dikunci memakai angka saat closing. <b>Valas (Rp)</b>: Sistem = seluruh stok valas akhir hari × kurs valuasi; Fisik = valas yang dihitung × kurs valuasi; Selisih = (fisik − sistem) × kurs, hanya untuk valuta yang dihitung. Kurs valuasi = modal rata-rata (atau kurs beli). "Belum dihitung" = hitungan fisik belum diisi di Closing Harian.</p>`;
    }

    // ---------- rincian satu hari ----------
    async function openDetail(date) {
        const d = ((S.data && S.data.days) || []).find((x) => x.date === date); if (!d) return;
        closeDetail();
        const ov = document.createElement('div'); ov.className = 'rr-ov'; ov.id = 'rrModal';
        const bankRows = d.bank.accounts.map((b) => `<tr><td>${esc(b.name)}</td><td class="r">${esc(rp(b.opening))}</td><td class="r rr-pos">${esc(rp(b.in))}</td><td class="r rr-neg">${esc(rp(b.out))}</td><td class="r"><b>${esc(rp(b.system))}</b></td><td class="r">${b.statement === null ? '<span class="rr-dim">-</span>' : esc(rp(b.statement))}</td><td class="r">${b.difference === null ? '<span class="rr-dim">belum dihitung</span>' : `<span class="rr-${tone(b.difference)}">${esc(sg(b.difference))}</span>`}</td></tr>`).join('');
        const valRows = d.valas.items.map((v) => `<tr><td><b>${esc(v.code)}</b></td><td class="r">${esc(qf.format(v.system_qty))}</td><td class="r">${v.physical_qty === null ? '<span class="rr-dim">-</span>' : esc(qf.format(v.physical_qty))}</td><td class="r">${v.diff_qty === null ? '<span class="rr-dim">-</span>' : `<span class="rr-${tone(v.diff_qty)}">${v.diff_qty > 0 ? '+' : ''}${esc(qf.format(v.diff_qty))}</span>`}</td><td class="r">${esc(qf.format(v.rate))}</td><td class="r">${esc(rp(v.system_qty * v.rate))}</td><td class="r">${v.diff_value === null ? '<span class="rr-dim">belum dihitung</span>' : `<span class="rr-${tone(v.diff_value)}">${esc(sg(v.diff_value))}</span>`}</td></tr>`).join('');
        ov.innerHTML = `<div class="rr-md" role="dialog" aria-modal="true">
            <div class="rr-mh"><h3>${esc(dateTxt(d.date))} <span class="rr-st ${st(d.status)[0]}">${esc(st(d.status)[1])}</span></h3>
                <div style="display:flex;gap:8px;align-items:center"><button class="rr-btn" data-rrd="open"><i class="fa-solid fa-box-archive"></i> Buka di Closing Harian</button><button class="rr-x" data-rrd="close" aria-label="Tutup">&times;</button></div></div>
            <div class="rr-mb">
                <div class="rr-box"><h4><i class="fa-solid fa-wallet"></i> Kas Tunai</h4><div class="rr-kv">
                    <div><small>Saldo awal hari</small>${esc(rp(d.cash.opening))}</div><div><small>Masuk</small><span class="rr-pos">${esc(rp(d.cash.in))}</span></div>
                    <div><small>Keluar</small><span class="rr-neg">${esc(rp(d.cash.out))}</span></div><div><small>Termasuk biaya</small>${esc(rp(d.cash.expense))}</div>
                    <div><small>Seharusnya (sistem)</small><b>${esc(rp(d.cash.expected))}</b></div><div><small>Uang fisik</small>${d.cash.counted ? esc(rp(d.cash.physical)) : '<span class="rr-dim">belum dihitung</span>'}</div>
                    <div><small>Gantungan</small>${esc(rp(d.cash.hanging))}</div><div><small>Selisih kas</small>${cell(d.cash.difference, d.cash.counted)}</div></div></div>
                <div class="rr-box"><h4><i class="fa-solid fa-building-columns"></i> Rekening Bank</h4><div style="overflow:auto"><table class="rr-tbl"><thead><tr><th>Rekening</th><th class="r">Saldo awal</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Sistem</th><th class="r">Rek. Koran</th><th class="r">Selisih</th></tr></thead><tbody>${bankRows || '<tr><td colspan="7" class="rr-dim">Tidak ada rekening.</td></tr>'}</tbody></table></div></div>
                <div class="rr-box"><h4><i class="fa-solid fa-coins"></i> Valas</h4><div style="overflow:auto"><table class="rr-tbl"><thead><tr><th>Valuta</th><th class="r">Stok sistem</th><th class="r">Stok fisik</th><th class="r">Selisih lembar</th><th class="r">Kurs valuasi</th><th class="r">Nilai sistem</th><th class="r">Selisih Rp</th></tr></thead><tbody>${valRows || '<tr><td colspan="7" class="rr-dim">Tidak ada stok valas.</td></tr>'}</tbody></table></div></div>
                <div class="rr-box"><h4><i class="fa-solid fa-flag-checkered"></i> Hasil</h4><div class="rr-kv">
                    <div><small>Total selisih</small><span class="rr-${tone(d.total_difference)}">${esc(sg(d.total_difference))}</span></div>
                    <div><small>No. closing</small>${esc(d.closing_no || '-')}</div><div><small>Dikunci oleh</small>${esc(d.closed_by || '-')}</div>
                    <div><small>Waktu kunci</small>${d.closed_at ? esc(new Date(d.closed_at).toLocaleString('id-ID')) : '-'}</div></div>
                    <div style="margin-top:8px;font-size:.85rem"><small style="opacity:.65">Alasan / catatan</small><div>${esc(d.notes || '-')}</div></div></div>
                <div class="rr-box"><h4><i class="fa-solid fa-list"></i> Transaksi hari ini</h4><div id="rrTrades" class="rr-dim">Memuat...</div></div>
            </div></div>`;
        document.body.appendChild(ov);
        ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeDetail(); });
        ov.addEventListener('click', (e) => {
            const b = e.target.closest('[data-rrd]'); if (!b) return;
            if (b.dataset.rrd === 'close') closeDetail();
            if (b.dataset.rrd === 'open') { closeDetail(); openClosing(d.date); }
        });
        try {
            const res = await api(`/api/closing/day?date=${encodeURIComponent(date)}`);
            const list = (res.data && res.data.trade_list) || [];
            const box = $('rrTrades'); if (!box) return;
            box.className = '';
            box.innerHTML = list.length ? `<div style="overflow:auto"><table class="rr-tbl"><thead><tr><th>Jam</th><th>Invoice</th><th>Tipe</th><th>Valuta</th><th class="r">Jumlah</th><th class="r">Total</th><th>Bayar</th></tr></thead><tbody>${list.map((t) => `<tr><td>${esc(t.time || '')}</td><td>${esc(t.invoice || '')}</td><td>${esc(t.type || '')}</td><td>${esc(t.currency || '')}</td><td class="r">${esc(qf.format(t.qty || 0))}</td><td class="r">${esc(rp(t.total || 0))}</td><td>${esc(t.method || '')}</td></tr>`).join('')}</tbody></table></div>` : '<span class="rr-dim">Tidak ada transaksi valas.</span>';
        } catch (e) { const box = $('rrTrades'); if (box) box.textContent = 'Daftar transaksi belum bisa dimuat: ' + e.message; }
    }
    function closeDetail() { const m = $('rrModal'); if (m) m.remove(); }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

    function openClosing(date) {
        const nav = document.querySelector('.nav-item[data-target="closing-view"]');
        if (nav) nav.click();
        let tries = 0;
        const t = setInterval(() => {
            const inp = $('cdDate');
            if (inp || ++tries > 30) {
                clearInterval(t);
                if (inp && inp.value !== date) { inp.value = date; inp.dispatchEvent(new Event('change', { bubbles: true })); }
            }
        }, 150);
    }

    // ---------- export & cetak ----------
    function rowsForExport() {
        return filtered().map((d) => ({
            Tanggal: d.date, Status: st(d.status)[1],
            'Kas Sistem': Math.round(d.cash.expected), 'Kas Fisik+Gantungan': d.cash.counted ? Math.round(d.cash.physical + d.cash.hanging) : '', 'Selisih Kas': d.cash.counted ? Math.round(d.cash.difference) : '',
            'Bank Sistem': Math.round(d.bank.system), 'Bank Rek. Koran': d.bank.counted ? Math.round(d.bank.statement) : '', 'Selisih Bank': d.bank.counted ? Math.round(d.bank.difference) : '',
            'Valas Sistem (Rp)': Math.round(d.valas.system_value), 'Valas Fisik (Rp)': d.valas.counted ? Math.round(d.valas.physical_value) : '', 'Selisih Valas (Rp)': d.valas.counted ? Math.round(d.valas.difference) : '',
            'Total Selisih': Math.round(d.total_difference), 'Dikunci oleh': d.closed_by || '', 'Alasan / Catatan': d.notes || ''
        }));
    }
    function exportXlsx() {
        if (typeof XLSX === 'undefined') { alert('Library Excel belum termuat. Muat ulang halaman (Ctrl+F5).'); return; }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsForExport()), 'Rekonsiliasi');
        const name = `Rekonsiliasi_Harian_${S.from}_sd_${S.to}.xlsx`;
        if (typeof window.safeExportXLSX === 'function') window.safeExportXLSX(wb, name); else XLSX.writeFile(wb, name);
    }
    function printReport() {
        const rows = rowsForExport(); if (!rows.length) return;
        const cols = Object.keys(rows[0]);
        const w = window.open('', '_blank'); if (!w) return;
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Rekonsiliasi Harian</title><style>body{font-family:Arial,sans-serif;font-size:10px;margin:16px}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #999;padding:4px 5px}th{background:#eee}td.n{text-align:right}@page{size:A4 landscape;margin:10mm}</style></head><body>
            <h2>Laporan Rekonsiliasi Harian</h2><div>Periode ${esc(S.from)} s/d ${esc(S.to)} · dicetak ${esc(new Date().toLocaleString('id-ID'))}</div>
            <table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${typeof r[c] === 'number' ? 'n' : ''}">${esc(typeof r[c] === 'number' ? nf.format(r[c]) : r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>
            <script>window.onload=function(){window.print();}<\/script></body></html>`);
        w.document.close();
    }

    // ---------- siklus hidup ----------
    function visible() { const v = $(VIEW_ID); return !!v && !v.classList.contains('hidden') && v.offsetParent !== null; }
    window.initRekonReport = function () { if (!$(ROOT_ID)) return; if (!S.built || !$('rrBody')) build(); else load(true); };
    // Data dari akun lain berubah (closing dikunci, transaksi baru) -> laporan diperbarui.
    window.refreshRekonReport = function () { if (visible() && S.built && !$('rrModal')) load(true); };
    let was = false;
    setInterval(() => { const now = visible(); if (now && !was) window.initRekonReport(); was = now; }, 800);
})();
