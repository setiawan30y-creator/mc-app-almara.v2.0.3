/*
 * Data Nasabah: pencarian, filter, statistik, pagination, import & export.
 * Menggantikan implementasi lama (handler ganda, filter tersimpan yang
 * menyembunyikan data, export mengabaikan filter, tabel tanpa escape).
 */
(function () {
    'use strict';

    const state = { page: 1, pageSize: 50, sort: 'newest', filtered: [], importing: false, pendingFile: null };
    const FILTER_KEY = 'mc_customer_table_filters';

    // ---------- util ----------
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const nf = (n) => new Intl.NumberFormat('id-ID').format(n || 0);
    const clean = (v) => { const s = String(v == null ? '' : v).trim(); return s; };
    const has = (v) => { const s = clean(v); return s !== '' && s !== '-'; };
    const fold = (v) => String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const digits = (v) => String(v == null ? '' : v).replace(/\D+/g, '');

    function getAll() {
        try { return typeof window.getCustomers === 'function' ? (window.getCustomers() || []) : JSON.parse(localStorage.getItem('mc_customers') || '[]'); }
        catch (e) { return []; }
    }

    function knOf(c) {
        const raw = String(c.kn ?? c.customer_type ?? '').trim().toLowerCase();
        return raw === '2' || raw.includes('perusahaan') || raw.includes('corporate') || raw.includes('badan') ? '2' : '1';
    }

    function regTime(c) {
        return typeof window.getCustomerRegistrationTime === 'function' ? window.getCustomerRegistrationTime(c) : (Date.parse(c.tgl_daftar) || 0);
    }

    function isoDate(ms) {
        if (!ms) return '';
        const d = new Date(ms);
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    function fmtDate(v) {
        if (typeof window.formatDateOnly === 'function') return window.formatDateOnly(v);
        return has(v) ? String(v) : '-';
    }

    // ---------- filter ----------
    function readFilters() {
        return {
            search: $('searchCustomerInput') ? $('searchCustomerInput').value.trim() : '',
            type: $('filterCustomerType') ? $('filterCustomerType').value : 'ALL',
            start: $('filterCustomerDateStart') ? $('filterCustomerDateStart').value : '',
            end: $('filterCustomerDateEnd') ? $('filterCustomerDateEnd').value : ''
        };
    }

    function searchBlob(c) {
        return fold([c.nama, c.id_nasabah, c.idpjk, c.no_hp, c.no_ktp, c.selain_ktp, c.no_cif, c.npwp, c.local_id,
            c.alamat, c.no_rekening, c.pekerjaan, c.tempat_lahir, c.bidang_usaha, c.jenis_badan_usaha, c.nib].filter(has).join(' | '));
    }

    function applyFilters(all, f) {
        const tokens = fold(f.search).split(/\s+/).filter(Boolean);
        const startMs = f.start ? new Date(f.start + 'T00:00:00').getTime() : null;
        const endMs = f.end ? new Date(f.end + 'T23:59:59.999').getTime() : null;

        return all.filter(c => {
            if (f.type !== 'ALL' && knOf(c) !== f.type) return false;

            if (startMs !== null || endMs !== null) {
                const t = regTime(c);
                // Tanggal rusak/kosong tidak disembunyikan agar data tidak "hilang".
                if (t > 0) {
                    if (startMs !== null && t < startMs) return false;
                    if (endMs !== null && t > endMs) return false;
                }
            }

            if (tokens.length) {
                const blob = searchBlob(c);
                const blobDigits = digits(blob);
                for (const tk of tokens) {
                    if (blob.includes(tk)) continue;
                    const d = digits(tk);
                    // Nomor telepon/ID: cocokkan tanpa spasi, strip, atau tanda baca.
                    if (d.length >= 3 && d.length === tk.replace(/[\s+\-().]/g, '').length && blobDigits.includes(d)) continue;
                    return false;
                }
            }
            return true;
        });
    }

    function sortList(list) {
        const byName = (a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id', { sensitivity: 'base' });
        switch (state.sort) {
            case 'oldest': return list.sort((a, b) => regTime(a) - regTime(b));
            case 'name_asc': return list.sort(byName);
            case 'name_desc': return list.sort((a, b) => byName(b, a));
            default: return list.sort((a, b) => (regTime(b) - regTime(a)) || String(b.id_nasabah || '').localeCompare(String(a.id_nasabah || '')));
        }
    }

    // ---------- tampilan ----------
    function renderStats(all) {
        const box = $('cxStats');
        if (!box) return;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        let corp = 0, month = 0, phone = 0;
        all.forEach(c => {
            if (knOf(c) === '2') corp++;
            if (regTime(c) >= monthStart) month++;
            if (has(c.no_hp)) phone++;
        });
        const cards = [
            ['fa-users', 'Total Nasabah', all.length, 'Seluruh data tersimpan', 'blue'],
            ['fa-user', 'Perorangan', all.length - corp, all.length ? Math.round((all.length - corp) * 100 / all.length) + '% dari total' : '-', 'green'],
            ['fa-building', 'Perusahaan', corp, all.length ? Math.round(corp * 100 / all.length) + '% dari total' : '-', 'amber'],
            ['fa-user-plus', 'Baru Bulan Ini', month, 'Terdaftar ' + now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), 'violet'],
            ['fa-phone', 'Punya No. HP', phone, all.length ? Math.round(phone * 100 / all.length) + '% bisa dihubungi' : '-', 'teal']
        ];
        box.innerHTML = cards.map(c => `<div class="cx-stat ${c[4]}"><span class="cx-stat-ico"><i class="fa-solid ${c[0]}"></i></span>
            <div><div class="cx-stat-label">${c[1]}</div><div class="cx-stat-val">${nf(c[2])}</div><div class="cx-stat-sub">${esc(c[3])}</div></div></div>`).join('');
    }

    function renderChips(f) {
        const box = $('cxActive');
        if (!box) return;
        const chips = [];
        if (f.search) chips.push(['search', 'Cari: ' + f.search]);
        if (f.type !== 'ALL') chips.push(['type', 'Tipe: ' + (f.type === '2' ? 'Perusahaan' : 'Perorangan')]);
        if (f.start || f.end) chips.push(['date', 'Tgl daftar: ' + (f.start || '...') + ' s.d ' + (f.end || '...')]);
        box.style.display = chips.length ? 'flex' : 'none';
        box.innerHTML = chips.length
            ? chips.map(c => `<span class="cx-chip">${esc(c[1])}<button type="button" data-clear="${c[0]}" title="Hapus filter"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
              + '<button type="button" class="cx-link" data-clear="all">Hapus semua filter</button>'
            : '';
        const clearBtn = $('cxSearchClear');
        if (clearBtn) clearBtn.style.display = f.search ? 'inline-flex' : 'none';
    }

    function rowHtml(c) {
        const kn = knOf(c);
        const saved = String(c.jenis_id || c.identity_type || '').trim().toUpperCase();
        const valid = ['KTP', 'SIM', 'PASSPORT', 'KITAS', 'SERTIFIKAT'];
        const jenisId = valid.includes(saved) ? saved : (has(c.no_ktp) ? 'KTP' : (has(c.selain_ktp) ? 'LAINNYA' : '-'));
        const isKtp = jenisId === 'KTP';
        const noKtp = isKtp && has(c.no_ktp) ? c.no_ktp : '-';
        const idLain = !isKtp ? (has(c.selain_ktp) ? c.selain_ktp : (has(c.no_ktp) ? c.no_ktp : '-')) : (has(c.selain_ktp) ? c.selain_ktp : '-');
        const id = String(c.id_nasabah || c.local_id || c.no_cif || c.nama || '');
        const user = (typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null) || {};
        const showAudit = (user.role === 'admin' || user.role === 'owner' || user.role === 'superadmin') && (c.inputBy || c.editBy);
        const attr = (v) => esc(JSON.stringify(String(v == null ? '' : v)));
        const wa = has(c.no_hp)
            ? `<button type="button" class="btn" style="background:#25d366;color:#fff;border:none;" onclick="window.sendCustomerWhatsAppById(${attr(c.id_nasabah || c.internal_id || c.id_cif || '')},${attr(c.no_hp || c.phone || '')},${attr(c.nama || 'Nasabah')})" title="Kirim WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>`
            : '';
        return `<tr data-id="${esc(id)}">
            <td style="text-align:center;"><input type="checkbox" class="chk-cust" value="${esc(c.id_nasabah)}" onchange="updateBlastWaCount()"></td>
            <td>${esc(c.idpjk || '-')}</td>
            <td><span class="cx-kn k${kn}" title="${kn === '2' ? 'Perusahaan' : 'Perorangan'}">${kn}</span></td>
            <td>${esc(c.no_hp || '-')}</td>
            <td class="customer-name-cell"><strong>${esc(c.nama || '-')}</strong>${showAudit ? `<div class="cx-audit">${c.inputBy ? 'Input: ' + esc(c.inputBy) : ''}${c.inputBy && c.editBy ? ' · ' : ''}${c.editBy ? 'Edit: ' + esc(c.editBy) : ''}</div>` : ''}</td>
            <td>${esc(c.tempat_lahir || '-')}</td>
            <td>${esc(fmtDate(c.tanggal_lahir))}</td>
            <td class="customer-address-cell" title="${esc(c.alamat || '-')}">${esc(c.alamat || '-')}</td>
            <td>${esc(jenisId)}</td>
            <td>${esc(noKtp)}</td>
            <td>${esc(idLain)}</td>
            <td>${esc(c.no_cif || '-')}</td>
            <td>${esc(c.npwp || '-')}</td>
            <td>${esc(c.local_id || '-')}</td>
            <td>${esc(c.jenis_kelamin || '-')}</td>
            <td>${esc(c.warga_negara || '-')}</td>
            <td>${esc(c.pekerjaan || '-')}</td>
            <td>${esc(c.no_rekening || '-')}</td>
            <td class="customer-action-cell"><div class="customer-row-actions">
                <button type="button" class="btn" style="background:#0ea5e9;color:#fff;border:none;" onclick="handleCustAction(this,'preview')" title="Lihat detail"><i class="fa-solid fa-eye"></i></button>
                ${wa}
                <button type="button" class="btn btn-primary" onclick="handleCustAction(this,'edit')" title="Ubah"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn btn-danger" onclick="handleCustAction(this,'delete')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </div></td></tr>`;
    }

    function renderPager(total) {
        const box = $('cxPager');
        if (!box) return;
        const size = state.pageSize === 0 ? total || 1 : state.pageSize;
        const pages = Math.max(1, Math.ceil(total / size));
        if (state.page > pages) state.page = pages;
        const from = total ? (state.page - 1) * size + 1 : 0;
        const to = Math.min(total, state.page * size);

        const nums = [];
        const add = (n) => nums.push(n);
        for (let p = 1; p <= pages; p++) {
            if (p === 1 || p === pages || Math.abs(p - state.page) <= 1) add(p);
            else if (nums[nums.length - 1] !== '…') add('…');
        }

        box.innerHTML = `<div class="cx-pager-info">Menampilkan <b>${nf(from)}–${nf(to)}</b> dari <b>${nf(total)}</b> hasil</div>
            <div class="cx-pager-nav">
                <button type="button" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
                ${nums.map(n => n === '…' ? '<span class="gap">…</span>' : `<button type="button" data-page="${n}" class="${n === state.page ? 'on' : ''}">${n}</button>`).join('')}
                <button type="button" data-page="${state.page + 1}" ${state.page >= pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
            </div>`;
    }

    function render() {
        const all = getAll().map(c => Object.assign({}, c, { id_nasabah: c.id_nasabah || c.local_id || c.no_cif || '' }));
        const f = readFilters();
        const list = sortList(applyFilters(all, f));
        state.filtered = list;

        renderStats(all);
        renderChips(f);

        const tbody = $('customersTableBody');
        if (!tbody) return;
        const size = state.pageSize === 0 ? list.length || 1 : state.pageSize;
        const pages = Math.max(1, Math.ceil(list.length / size));
        if (state.page > pages) state.page = pages;
        const pageRows = list.slice((state.page - 1) * size, state.page * size);

        tbody.innerHTML = pageRows.length
            ? pageRows.map(rowHtml).join('')
            : `<tr><td colspan="19" class="cx-empty"><i class="fa-regular fa-folder-open"></i><div>${all.length ? 'Tidak ada nasabah yang cocok dengan pencarian/filter.' : 'Belum ada data nasabah.'}</div>${all.length ? '<button type="button" class="cx-link" data-clear="all">Hapus semua filter</button>' : ''}</td></tr>`;

        const sum = $('customerTotalSummary');
        if (sum) sum.textContent = list.length === all.length ? `${nf(all.length)} nasabah` : `${nf(list.length)} dari ${nf(all.length)} nasabah`;

        const chkAll = $('chkAllCust');
        if (chkAll) chkAll.checked = false;
        renderPager(list.length);
        if (typeof window.updateBlastWaCount === 'function') window.updateBlastWaCount();
    }

    let timer = null;
    function scheduleRender() {
        clearTimeout(timer);
        timer = setTimeout(() => { state.page = 1; render(); }, 180);
    }

    function clearFilter(which) {
        if (which === 'search' || which === 'all') { if ($('searchCustomerInput')) $('searchCustomerInput').value = ''; }
        if (which === 'type' || which === 'all') { if ($('filterCustomerType')) $('filterCustomerType').value = 'ALL'; }
        if (which === 'date' || which === 'all') {
            if ($('filterCustomerDateStart')) $('filterCustomerDateStart').value = '';
            if ($('filterCustomerDateEnd')) $('filterCustomerDateEnd').value = '';
        }
        state.page = 1;
        render();
    }

    function quickDate(kind) {
        const now = new Date();
        const p = (n) => String(n).padStart(2, '0');
        const iso = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        let s = '', e = iso(now);
        if (kind === 'today') s = e;
        else if (kind === '7') { const d = new Date(now); d.setDate(d.getDate() - 6); s = iso(d); }
        else if (kind === 'month') s = iso(new Date(now.getFullYear(), now.getMonth(), 1));
        else if (kind === 'year') s = iso(new Date(now.getFullYear(), 0, 1));
        else { s = ''; e = ''; }
        $('filterCustomerDateStart').value = s;
        $('filterCustomerDateEnd').value = e;
        state.page = 1;
        render();
    }

    // ---------- export ----------
    const EXPORT_COLS = [
        ['ID_Nasabah', c => c.id_nasabah], ['IDPJK', c => c.idpjk || '-'], ['Tipe', c => Number(knOf(c))], ['Nama', c => c.nama],
        ['Tempat_Lahir', c => c.tempat_lahir], ['Tanggal_Lahir', c => c.tanggal_lahir], ['Alamat', c => c.alamat],
        ['Warga_Negara', c => c.warga_negara], ['Jenis_Kelamin', c => c.jenis_kelamin], ['Pekerjaan', c => c.pekerjaan],
        ['No_HP', c => c.no_hp], ['No_Rekening', c => c.no_rekening], ['No_KTP', c => c.no_ktp], ['Selain_KTP', c => c.selain_ktp],
        ['No_CIF', c => c.no_cif], ['NPWP', c => c.npwp], ['Local_ID', c => c.local_id], ['Tgl_Daftar', c => isoDate(regTime(c)) || c.tgl_daftar || ''],
        ['Jenis_ID', c => c.jenis_id || c.identity_type || ''], ['Jenis_Badan_Usaha', c => c.jenis_badan_usaha || ''],
        ['Bidang_Usaha', c => c.bidang_usaha || ''], ['NIB', c => c.nib || '']
    ];

    function ensureXlsx() {
        if (typeof XLSX === 'undefined') { notify('error', 'Library Excel belum termuat', 'Muat ulang halaman (Ctrl+F5) lalu coba lagi.'); return false; }
        return true;
    }

    function notify(icon, title, text, html) {
        if (typeof Swal !== 'undefined') {
            Swal.fire(Object.assign({ icon, title, background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3B82F6' }, html ? { html } : { text }));
        } else {
            alert(title + (text ? '\n' + text : ''));
        }
    }

    function sheetFor(list) {
        const rows = list.map(c => { const o = {}; EXPORT_COLS.forEach(([h, fn]) => { const v = fn(c); o[h] = v == null ? '' : v; }); return o; });
        return XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLS.map(x => x[0]) });
    }

    function fileStamp() { return new Date().toISOString().slice(0, 10); }

    function save(wb, name) {
        if (typeof window.safeExportXLSX === 'function') window.safeExportXLSX(wb, name);
        else XLSX.writeFile(wb, name);
    }

    function filterActive() { const f = readFilters(); return !!(f.search || f.type !== 'ALL' || f.start || f.end); }

    window.exportCustomersXlsx = function (scope) {
        if (!ensureXlsx()) return;
        const all = getAll();
        const useFiltered = scope ? scope === 'filtered' : filterActive();
        const list = useFiltered ? state.filtered.slice() : sortList(all.slice());
        if (!list.length) return notify('info', 'Tidak ada data', useFiltered ? 'Tidak ada nasabah pada hasil filter saat ini.' : 'Belum ada data nasabah untuk diekspor.');
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheetFor(list), 'Nasabah');
        save(wb, `Data_Nasabah_${useFiltered ? 'Filter_' : ''}${fileStamp()}.xlsx`);
    };

    window.exportCustomersCsv = function (scope) {
        if (!ensureXlsx()) return;
        const list = (scope ? scope === 'filtered' : filterActive()) ? state.filtered : sortList(getAll().slice());
        if (!list.length) return notify('info', 'Tidak ada data', 'Tidak ada nasabah untuk diekspor.');
        const csv = '﻿' + XLSX.utils.sheet_to_csv(sheetFor(list));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `Data_Nasabah_${fileStamp()}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
    };

    window.downloadCustomerTemplate = function () {
        if (!ensureXlsx()) return;
        const example = {
            ID_Nasabah: 'ALM-0001', IDPJK: '-', Tipe: 1, Nama: 'CONTOH NAMA', Tempat_Lahir: 'Jakarta', Tanggal_Lahir: '1990-01-31',
            Alamat: 'Jl. Contoh No. 1', Warga_Negara: 'INDONESIA', Jenis_Kelamin: 'Laki-laki', Pekerjaan: 'Karyawan Swasta',
            No_HP: '081234567890', No_Rekening: '-', No_KTP: '3171000000000001', Selain_KTP: '-', No_CIF: '-', NPWP: '-',
            Local_ID: '-', Tgl_Daftar: isoDate(Date.now()), Jenis_ID: 'KTP', Jenis_Badan_Usaha: '', Bidang_Usaha: '', NIB: ''
        };
        const ws = XLSX.utils.json_to_sheet([example], { header: EXPORT_COLS.map(x => x[0]) });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Nasabah');
        save(wb, 'Template_Import_Nasabah.xlsx');
    };

    window.printCustomersPdf = function () {
        const list = state.filtered;
        if (!list.length) return notify('info', 'Tidak ada data', 'Tidak ada nasabah untuk dicetak.');
        const f = readFilters();
        const desc = [f.search && 'Cari "' + f.search + '"', f.type !== 'ALL' && (f.type === '2' ? 'Perusahaan' : 'Perorangan'), (f.start || f.end) && ('Daftar ' + (f.start || '...') + ' s.d ' + (f.end || '...'))].filter(Boolean).join(' · ') || 'Semua data';
        const rows = list.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.idpjk || '-')}</td><td>${knOf(c)}</td><td>${esc(c.nama || '-')}</td><td>${esc(c.no_hp || '-')}</td><td>${esc(c.tempat_lahir || '-')}</td><td>${esc(fmtDate(c.tanggal_lahir))}</td><td>${esc(c.alamat || '-')}</td><td>${esc(c.no_ktp || c.selain_ktp || '-')}</td><td>${esc(c.pekerjaan || '-')}</td></tr>`).join('');
        const w = window.open('', '_blank');
        if (!w) return notify('warning', 'Pop-up diblokir', 'Izinkan pop-up untuk situs ini lalu klik PDF lagi.');
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Data Nasabah</title><style>
            @page{size:A4 landscape;margin:12mm}body{font:11px Arial,sans-serif;color:#111}h2{margin:0 0 2px}p{margin:0 0 10px;color:#555}
            table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee}
            tr{page-break-inside:avoid}</style></head><body>
            <h2>Laporan Data Nasabah (KYC)</h2><p>${esc(desc)} · ${nf(list.length)} nasabah · dicetak ${new Date().toLocaleString('id-ID')}</p>
            <table><thead><tr><th>No</th><th>IDPJK</th><th>KN</th><th>Nama</th><th>No HP</th><th>Tempat Lahir</th><th>Tgl Lahir</th><th>Alamat</th><th>No Identitas</th><th>Pekerjaan</th></tr></thead><tbody>${rows}</tbody></table>
            <script>window.onload=function(){setTimeout(function(){window.print();},300)}<\/script></body></html>`);
        w.document.close();
    };

    // ---------- import ----------
    const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const ALIASES = {
        id_nasabah: ['ID_Nasabah', 'ID Nasabah', 'internal_id', 'id_nasabah'],
        idpjk: ['IDPJK'],
        kn: ['Tipe', 'KN(TIPE)', 'KN Tipe', 'KN', 'customer_type'],
        nama: ['Nama', 'Nama Lengkap', 'name'],
        tempat_lahir: ['Tempat_Lahir', 'Tempat Lahir', 'Lokasi Terbit'],
        tanggal_lahir: ['Tanggal_Lahir', 'Tanggal Lahir', 'Tanggal Terbit'],
        alamat: ['Alamat', 'address'],
        warga_negara: ['Warga_Negara', 'Warga Negara'],
        jenis_kelamin: ['Jenis_Kelamin', 'Jenis Kelamin'],
        pekerjaan: ['Pekerjaan'],
        no_hp: ['No_HP', 'No HP', 'NO TLP', 'No Telp', 'Phone', 'HP'],
        no_rekening: ['No_Rekening', 'No Rekening'],
        no_ktp: ['No_KTP', 'No KTP', 'identity_number'],
        selain_ktp: ['Selain_KTP', 'Selain KTP', 'ID Lain'],
        no_cif: ['No_CIF', 'No CIF', 'id_cif'],
        npwp: ['NPWP'],
        local_id: ['Local_ID', 'Local ID'],
        tgl_daftar: ['Tgl_Daftar', 'Tgl Daftar', 'Tanggal Daftar'],
        jenis_id: ['Jenis_ID', 'Jenis ID'],
        jenis_badan_usaha: ['Jenis_Badan_Usaha', 'Jenis Badan Usaha'],
        bidang_usaha: ['Bidang_Usaha', 'Bidang Usaha'],
        nib: ['NIB']
    };

    function cellText(v) {
        if (v == null) return '';
        if (v instanceof Date) return isNaN(v.getTime()) ? '' : isoDate(v.getTime());
        if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('fullwide', { useGrouping: false }) : String(v);
        return String(v).trim();
    }

    function parseDateText(s) {
        s = clean(s);
        if (!s || s === '-') return null;
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        let d = null;
        if (m) d = new Date(+m[1], +m[2] - 1, +m[3], 12);
        else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) {
            const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
            d = new Date(y, +m[2] - 1, +m[1], 12);
        } else { const t = Date.parse(s); if (!isNaN(t)) d = new Date(t); }
        return d && !isNaN(d.getTime()) ? d.toISOString() : null;
    }

    function parseCsv(text) {
        const rows = []; let row = [], field = '', q = false;
        const src = String(text || '').replace(/^﻿/, '');
        const first = src.split(/\r?\n/, 1)[0] || '';
        const counts = { ',': (first.match(/,/g) || []).length, ';': (first.match(/;/g) || []).length, '\t': (first.match(/\t/g) || []).length };
        const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ',';
        for (let i = 0; i < src.length; i++) {
            const ch = src[i], nx = src[i + 1];
            if (ch === '"') { if (q && nx === '"') { field += '"'; i++; } else q = !q; continue; }
            if (ch === delim && !q) { row.push(field.trim()); field = ''; continue; }
            if ((ch === '\n' || ch === '\r') && !q) {
                if (ch === '\r' && nx === '\n') i++;
                row.push(field.trim());
                if (row.some(x => x !== '')) rows.push(row);
                row = []; field = ''; continue;
            }
            field += ch;
        }
        row.push(field.trim());
        if (row.some(x => x !== '')) rows.push(row);
        return rows;
    }

    function readRows(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Browser gagal membaca file yang dipilih.'));
            reader.onload = (e) => {
                try {
                    if (/\.csv$/i.test(file.name)) {
                        resolve(parseCsv(new TextDecoder('utf-8').decode(e.target.result)));
                    } else {
                        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
                    }
                } catch (err) { reject(err); }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function buildPlan(rows, existing) {
        // Cari baris judul (maks. 10 baris pertama) yang memuat kolom Nama.
        let headerIdx = -1, map = {};
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const m = {};
            (rows[i] || []).forEach((h, idx) => { const k = norm(h); if (k && m[k] === undefined) m[k] = idx; });
            if (m[norm('Nama')] !== undefined || m[norm('Nama Lengkap')] !== undefined) { headerIdx = i; map = m; break; }
        }
        if (headerIdx < 0) throw new Error('Baris judul tidak ditemukan. Pastikan ada kolom "Nama". Gunakan tombol "Unduh Template" sebagai contoh.');

        const colOf = (field) => { for (const a of ALIASES[field]) { const i = map[norm(a)]; if (i !== undefined) return i; } return undefined; };
        const cols = {}; Object.keys(ALIASES).forEach(f => { cols[f] = colOf(f); });

        const byId = new Map(existing.map(c => [String(c.id_nasabah || '').trim(), c]));
        const byKtp = new Map(existing.filter(c => has(c.no_ktp)).map(c => [String(c.no_ktp).trim(), c]));
        const usedIds = new Set(byId.keys());
        const plan = { add: 0, update: 0, dupInFile: 0, skipped: [], records: new Map(), mapped: Object.keys(cols).filter(f => cols[f] !== undefined) };
        const genId = (n) => { let id, k = 0; do { id = 'ALM-' + Date.now().toString().slice(-8) + '-' + (n + 1) + (k ? '-' + k : ''); k++; } while (usedIds.has(id)); usedIds.add(id); return id; };

        for (let r = headerIdx + 1; r < rows.length; r++) {
            const row = rows[r] || [];
            if (!row.some(x => cellText(x) !== '')) continue;
            const g = (f) => (cols[f] === undefined ? '' : cellText(row[cols[f]]));
            const nama = g('nama');
            if (!nama || nama === '-') { plan.skipped.push(`Baris ${r + 1}: Nama kosong`); continue; }

            const incoming = {};
            ['idpjk', 'tempat_lahir', 'alamat', 'warga_negara', 'jenis_kelamin', 'pekerjaan', 'no_hp', 'no_rekening', 'no_ktp', 'selain_ktp', 'no_cif', 'npwp', 'local_id', 'jenis_id', 'jenis_badan_usaha', 'bidang_usaha', 'nib'].forEach(f => { const v = g(f); if (v !== '' && v !== '-') incoming[f] = v; });
            const tl = g('tanggal_lahir'); if (tl && tl !== '-') incoming.tanggal_lahir = tl;
            const tipe = g('kn').toLowerCase();
            if (tipe) incoming.kn = (tipe === '2' || /perusahaan|corporate|badan|^pt|^cv/.test(tipe)) ? '2' : '1';
            const tgl = parseDateText(g('tgl_daftar')); if (tgl) incoming.tgl_daftar = tgl;
            incoming.nama = nama;

            let id = g('id_nasabah');
            let current = id ? byId.get(id) : null;
            if (!id) {
                const ktp = incoming.no_ktp && byKtp.get(String(incoming.no_ktp).trim());
                if (ktp) { id = String(ktp.id_nasabah); current = ktp; }
                else id = genId(r);
            }
            if (plan.records.has(id)) plan.dupInFile++;
            const base = plan.records.get(id) || current || null;
            const rec = Object.assign(
                base ? {} : { idpjk: '-', tempat_lahir: '-', tanggal_lahir: '-', alamat: '-', warga_negara: '-', jenis_kelamin: '-', pekerjaan: '-', no_hp: '-', no_rekening: '-', no_ktp: '-', selain_ktp: '-', no_cif: '-', npwp: '', local_id: '', kn: '1', tgl_daftar: new Date().toISOString() },
                base || {}, incoming, { id_nasabah: id });
            if (!plan.records.has(id)) { if (current) plan.update++; else plan.add++; }
            plan.records.set(id, rec);
        }
        plan.list = Array.from(plan.records.values());
        return plan;
    }

    function saveCache(customers) {
        const compact = customers.map(c => { const n = Object.assign({}, c); if (typeof n.foto_id === 'string' && n.foto_id.length > 5000) delete n.foto_id; delete n.raw_json; return n; });
        window.__mcCustomersMemory = compact;
        window.__almaraLastLocalCustomerWriteAt = Date.now();
        try { localStorage.setItem('mc_customers', JSON.stringify(compact)); return true; }
        catch (e) {
            try { localStorage.removeItem('mc_customers'); localStorage.setItem('mc_customers', JSON.stringify(compact)); return true; }
            catch (e2) { return false; }
        }
    }

    function setImportUi(busy) {
        const btn = $('btnCustomerExcelUpload');
        if (btn) {
            btn.disabled = busy || !state.pendingFile;
            btn.innerHTML = busy ? '<i class="fa-solid fa-spinner fa-spin"></i> Mengimpor...' : '<i class="fa-solid fa-file-import"></i> Proses Import';
        }
    }

    function setFile(file) {
        state.pendingFile = file || null;
        const label = $('customerExcelFileName');
        if (label) label.textContent = file ? file.name + ' (' + Math.max(1, Math.round(file.size / 1024)) + ' KB)' : 'Belum ada file dipilih';
        const drop = $('cxDrop');
        if (drop) drop.classList.toggle('has-file', !!file);
        setImportUi(false);
    }

    window.handleCustomerExcelSelected = function () { const i = $('customerExcelInput'); setFile(i && i.files && i.files[0] ? i.files[0] : null); };

    window.uploadCustomersExcel = async function () {
        if (state.importing) return false;
        const file = state.pendingFile;
        if (!file) { const i = $('customerExcelInput'); if (i) i.click(); return false; }
        if (!ensureXlsx()) return false;
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { notify('error', 'Format tidak didukung', 'Gunakan file .xlsx, .xls, atau .csv.'); return false; }

        state.importing = true; setImportUi(true);
        try {
            const rows = await readRows(file);
            const plan = buildPlan(rows, getAll());
            if (!plan.list.length) {
                notify('warning', 'Tidak ada data valid', plan.skipped.length ? plan.skipped.slice(0, 8).join('\n') : 'File tidak berisi baris data.');
                return false;
            }

            const skippedHtml = plan.skipped.length
                ? `<div style="margin-top:10px;text-align:left;font-size:.82rem;max-height:120px;overflow:auto;color:#fbbf24">Dilewati (${plan.skipped.length}):<br>${plan.skipped.slice(0, 8).map(esc).join('<br>')}${plan.skipped.length > 8 ? '<br>...' : ''}</div>` : '';
            const summary = `<div style="text-align:left;line-height:1.8">
                <b style="color:#34d399">${nf(plan.add)}</b> nasabah baru<br>
                <b style="color:#60a5fa">${nf(plan.update)}</b> nasabah diperbarui (ID cocok)<br>
                ${plan.dupInFile ? `<b style="color:#fbbf24">${nf(plan.dupInFile)}</b> baris ganda dalam file (digabung)<br>` : ''}
                <span style="opacity:.7;font-size:.8rem">Kolom terbaca: ${plan.mapped.length} dari ${Object.keys(ALIASES).length}. Kolom kosong tidak menimpa data yang sudah ada.</span>${skippedHtml}</div>`;

            if (typeof Swal !== 'undefined') {
                const ok = await Swal.fire({ title: 'Konfirmasi Import', html: summary, icon: 'question', showCancelButton: true, confirmButtonText: 'Lanjutkan Import', cancelButtonText: 'Batal', background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#10B981' });
                if (!ok.isConfirmed) return false;
            } else if (!confirm(`Import ${plan.add} baru dan ${plan.update} diperbarui?`)) return false;

            if (typeof Swal !== 'undefined') Swal.fire({ title: 'Menyimpan ke database...', text: 'Jangan tutup halaman.', allowOutsideClick: false, allowEscapeKey: false, background: '#1e293b', color: '#f8fafc', didOpen: () => Swal.showLoading() });

            let okCount = 0, failCount = 0, errors = [];
            if (typeof window.saveBulkToMySQL_Customers === 'function') {
                const res = await window.saveBulkToMySQL_Customers(plan.list, { onProgress: (p) => { if (typeof Swal !== 'undefined' && Swal.update) Swal.update({ text: `Batch ${p.completedBatches}/${p.totalBatches} (${nf(p.successCount)} tersimpan)` }); } });
                okCount = res.successCount; failCount = res.failedCount; errors = res.errors || [];
                if (!res.ok && !errors.length) errors = [res.message || 'Server menolak data'];
                if (!res.ok && okCount === 0 && failCount === 0) failCount = plan.list.length;
            } else { failCount = plan.list.length; errors = ['Fungsi penyimpanan ke server tidak tersedia.']; }

            // Perbarui cache hanya dengan data yang diterima server (atau semua jika server tak melaporkan rincian).
            const merged = getAll().slice();
            const index = new Map(merged.map((c, i) => [String(c.id_nasabah), i]));
            plan.list.forEach(rec => { const i = index.get(String(rec.id_nasabah)); if (i === undefined) merged.push(rec); else merged[i] = Object.assign({}, merged[i], rec); });
            const cached = saveCache(merged);
            if (failCount === 0 && okCount > 0) localStorage.removeItem('mc_customers_reset_at');

            state.page = 1;
            if (typeof window.loadCustomersTable === 'function') window.loadCustomersTable(); else render();
            const input = $('customerExcelInput'); if (input) input.value = '';
            setFile(null);

            const errHtml = errors.length ? `<div style="margin-top:10px;text-align:left;font-size:.8rem;color:#fca5a5;max-height:130px;overflow:auto">${errors.slice(0, 6).map(esc).join('<br>')}${errors.length > 6 ? '<br>...' : ''}</div>` : '';
            const partial = failCount > 0 || !cached;
            notify(partial ? 'warning' : 'success', partial ? 'Import Selesai Sebagian' : 'Import Berhasil', '',
                `<div style="text-align:left;line-height:1.7">Tersimpan di database: <b>${nf(okCount)}</b>${failCount ? `<br>Gagal: <b style="color:#f87171">${nf(failCount)}</b>` : ''}${!cached ? '<br><span style="color:#fbbf24">Cache browser penuh; data tetap aman di database.</span>' : ''}${errHtml}</div>`);
        } catch (err) {
            console.error(err);
            notify('error', 'Gagal Import', String(err && err.message || err));
        } finally {
            state.importing = false; setImportUi(false);
        }
        return false;
    };

    // ---------- pengikatan ----------
    function bind() {
        const root = $('customers-view');
        if (!root || root.dataset.cxBound) return;
        root.dataset.cxBound = '1';

        $('searchCustomerInput')?.addEventListener('input', scheduleRender);
        $('filterCustomerType')?.addEventListener('change', () => { state.page = 1; render(); });
        $('filterCustomerDateStart')?.addEventListener('change', () => { state.page = 1; render(); });
        $('filterCustomerDateEnd')?.addEventListener('change', () => { state.page = 1; render(); });
        $('cxSort')?.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; render(); });
        $('cxPageSize')?.addEventListener('change', (e) => { state.pageSize = parseInt(e.target.value, 10) || 0; state.page = 1; render(); });
        $('cxSearchClear')?.addEventListener('click', () => { clearFilter('search'); $('searchCustomerInput')?.focus(); });
        $('cxResetFilters')?.addEventListener('click', () => clearFilter('all'));

        root.addEventListener('click', (e) => {
            const clr = e.target.closest('[data-clear]'); if (clr) { clearFilter(clr.dataset.clear); return; }
            const pg = e.target.closest('[data-page]'); if (pg && !pg.disabled) { state.page = parseInt(pg.dataset.page, 10) || 1; render(); $('customers-view').querySelector('.customers-table-wrap')?.scrollTo({ top: 0 }); return; }
            const qd = e.target.closest('[data-qdate]'); if (qd) { quickDate(qd.dataset.qdate); return; }
            const ex = e.target.closest('[data-export]'); if (ex) {
                const kind = ex.dataset.export;
                $('cxExportMenu')?.classList.remove('open');
                if (kind === 'xlsx-filter') window.exportCustomersXlsx('filtered');
                else if (kind === 'xlsx-all') window.exportCustomersXlsx('all');
                else if (kind === 'csv-filter') window.exportCustomersCsv('filtered');
                else if (kind === 'template') window.downloadCustomerTemplate();
                return;
            }
            if (e.target.closest('#cxExportToggle')) { $('cxExportMenu')?.classList.toggle('open'); return; }
            if (!e.target.closest('#cxExportMenu')) $('cxExportMenu')?.classList.remove('open');
        });

        // Import: satu pengendali klik saja (tanpa onpointerdown/onmousedown ganda).
        $('cxPick')?.addEventListener('click', () => $('customerExcelInput')?.click());
        $('customerExcelInput')?.addEventListener('change', window.handleCustomerExcelSelected);
        $('btnCustomerExcelUpload')?.addEventListener('click', (e) => { e.preventDefault(); window.uploadCustomersExcel(); });
        const drop = $('cxDrop');
        if (drop) {
            ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
            ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
            drop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) setFile(f); });
        }
        setFile(null);
    }

    // Gantikan fungsi lama agar semua pemanggil (sync, import, hapus, edit) memakai logika baru.
    window.filterCustomersTable = function () { render(); };
    window.loadCustomersTable = function (options) {
        options = options || {};
        if (options.resetFilters) { clearFilter('all'); return; }
        render();
    };
    window.resetCustomerDateFilters = function () { clearFilter('date'); };
    window.toggleAllCustomers = function (el) {
        document.querySelectorAll('#customersTableBody .chk-cust').forEach(chk => { chk.checked = el.checked; });
        if (typeof window.updateBlastWaCount === 'function') window.updateBlastWaCount();
    };

    try { localStorage.removeItem(FILTER_KEY); } catch (e) {}

    function init() { bind(); if ($('customersTableBody')) render(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.mcCustomerTools = { render, state, buildPlan, applyFilters, parseCsv };
})();
