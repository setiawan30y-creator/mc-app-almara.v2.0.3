(function () {
    'use strict';

    const rootId = 'resetTableRoot';
    const riskLabel = { high: ['Tinggi', '#ef4444'], mid: ['Sedang', '#f59e0b'], low: ['Rendah', '#22c55e'] };
    let rows = [];

    function esc(v) {
        return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    }

    async function api(url, options) {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const doFetch = window.authFetch || window.fetch;
        const res = await doFetch(url, Object.assign({
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf }
        }, options || {}));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const firstError = data.errors ? Object.values(data.errors).flat()[0] : null;
            throw new Error(firstError || data.message || 'Permintaan gagal.');
        }
        return data;
    }

    function render() {
        const root = document.getElementById(rootId);
        if (!root) return;
        const body = rows.length ? rows.map(r => {
            const risk = riskLabel[r.danger] || riskLabel.mid;
            return `<tr>
                <td style="width:42px;text-align:center;"><input type="checkbox" class="rz-check" data-reset-scope="${esc(r.code)}"></td>
                <td><div style="font-weight:700;">${esc(r.label)}</div><div class="rz-desc">${esc(r.desc)}</div></td>
                <td><span class="rz-risk" style="color:${risk[1]};border-color:${risk[1]}55;background:${risk[1]}18">${risk[0]}</span></td>
                <td style="text-align:right;font-variant-numeric:tabular-nums;">${Number(r.rows || 0).toLocaleString('id-ID')}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="4" style="text-align:center;padding:18px;">Memuat daftar data...</td></tr>';

        root.innerHTML = `
        <style>
            #${rootId} .rz-wrap{overflow:auto;border:1px solid rgba(148,163,184,.3);border-radius:12px}
            #${rootId} table{width:100%;border-collapse:collapse;min-width:560px}
            #${rootId} th{padding:11px 14px;text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.6px;opacity:.7;background:rgba(148,163,184,.1);white-space:nowrap}
            #${rootId} td{padding:12px 14px;border-top:1px solid rgba(148,163,184,.2);vertical-align:middle;font-size:.88rem}
            #${rootId} tr:hover td{background:rgba(239,68,68,.04)}
            #${rootId} .rz-desc{font-size:.76rem;opacity:.65;margin-top:2px;line-height:1.4}
            #${rootId} .rz-risk{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid;font-size:.72rem;font-weight:700}
            #${rootId} .rz-confirm{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:16px}
            #${rootId} .rz-confirm label{display:block;font-size:.8rem;font-weight:600;margin-bottom:6px}
            #${rootId} .rz-note{margin-top:14px;padding:10px 14px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.08);border-radius:6px;font-size:.82rem;line-height:1.5}
        </style>
        <div class="rz-wrap">
            <table>
                <thead><tr>
                    <th style="text-align:center;"><input type="checkbox" id="rzAll" title="Pilih semua"></th>
                    <th>Data</th><th>Risiko</th><th style="text-align:right;">Jumlah di MySQL</th>
                </tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>
        <div class="rz-note"><i class="fa-solid fa-circle-info"></i> Sebelum menghapus, sistem otomatis membuat backup (database + berkas). Jika backup gagal, reset dibatalkan. Master valuta, profil perusahaan, pengguna, dan aturan goAML tidak ikut dihapus.</div>
        <div class="rz-confirm">
            <div><label for="rzPassword">Password Anda</label><input type="password" id="rzPassword" class="form-control" autocomplete="current-password" placeholder="Konfirmasi dengan password"></div>
            <div><label for="rzWord">Ketik <b>RESET</b></label><input type="text" id="rzWord" class="form-control" autocomplete="off" placeholder="RESET"></div>
        </div>`;

        document.getElementById('rzAll')?.addEventListener('change', e => {
            root.querySelectorAll('.rz-check').forEach(c => { c.checked = e.target.checked; });
        });
    }

    async function load() {
        try {
            const r = await api('/api/data-reset/summary');
            rows = r.data || [];
        } catch (e) {
            rows = [];
            console.warn('[Reset]', e.message);
        }
        const checked = new Set(Array.from(document.querySelectorAll('.rz-check:checked')).map(c => c.dataset.resetScope));
        render();
        document.querySelectorAll('.rz-check').forEach(c => { if (checked.has(c.dataset.resetScope)) c.checked = true; });
    }

    function clearLocal(scopes) {
        const arrayKeys = new Set();
        const scalars = {};
        const add = (...k) => k.forEach(x => arrayKeys.add(x));
        if (scopes.includes('transactions')) { add('mc_transactions'); localStorage.removeItem('mc_invoice_seq'); }
        if (scopes.includes('customers')) add('mc_customers');
        if (scopes.includes('cashBank')) Object.assign(scalars, { mc_cash: 0, mc_bank_bca: 0, mc_bank_mandiri: 0, mc_initial_cash: 0, mc_initial_bank_bca: 0, mc_initial_bank_mandiri: 0 });
        if (scopes.includes('openingBalance')) {
            Object.assign(scalars, { mc_initial_cash: 0, mc_initial_bank_bca: 0, mc_initial_bank_mandiri: 0 });
            if (!scopes.includes('currencyStock') && typeof getCurrencies === 'function') {
                // Server sudah meng-nol-kan saldo awal valas; cukup samakan cache browser tanpa kirim ulang.
                try {
                    const list = getCurrencies().map(c => ({ ...c, initialStock: 0, initial_rate_locked: 0, initial_rate_source: '' }));
                    localStorage.setItem('mc_currencies', JSON.stringify(list));
                } catch (e) { /* abaikan */ }
            }
        }
        if (scopes.includes('currencyStock') && typeof getCurrencies === 'function' && typeof saveCurrencies === 'function') {
            saveCurrencies(getCurrencies().map(c => ({ ...c, stock: 0, initialStock: 0, initial_rate_locked: 0, initial_rate_source: '', avg_buy_rate: 0, modalRate: 0, avgCost: 0, costRate: 0, modalValue: 0 })));
        }
        if (scopes.includes('expenses')) add('mc_expenses');
        if (scopes.includes('operations')) add('mc_mutations', 'mc_closings', 'mc_adjustments', 'mc_assets', 'mc_investors', 'mc_hris_employees', 'mc_hris_attendance', 'mc_hris_kasbon', 'mc_hris_bpjs', 'mc_hris_leave');
        if (scopes.includes('bookingDemo')) add('mc_bookings', 'mc_demo_transactions', 'mc_demo_stock', 'mc_demo_customers');
        if (scopes.includes('gantungan')) add('mc_gantungans');
        if (scopes.includes('oldMoney')) { add('mc_old_money_stock', 'mc_old_money_suppliers', 'mc_old_money_trxs'); scalars.mc_old_money_cash = 0; }
        if (scopes.includes('biRates')) { add('mc_bi_rates'); localStorage.setItem('mc_bi_rates_reset_at', new Date().toISOString()); }

        Object.entries(scalars).forEach(([k, v]) => localStorage.setItem(k, String(v)));
        arrayKeys.forEach(k => localStorage.setItem(k, JSON.stringify([])));
    }

    window.resetSelectedData = async function () {
        const scopes = Array.from(document.querySelectorAll('.rz-check:checked')).map(c => c.dataset.resetScope);
        if (!scopes.length) { alert('Pilih minimal satu data yang akan direset.'); return; }
        const password = document.getElementById('rzPassword')?.value || '';
        const word = (document.getElementById('rzWord')?.value || '').trim();
        if (!password) { alert('Isi password Anda untuk konfirmasi.'); return; }
        if (word !== 'RESET') { alert('Ketik RESET (huruf besar) untuk konfirmasi.'); return; }
        const names = rows.filter(r => scopes.includes(r.code)).map(r => '- ' + r.label).join('\n');
        if (!confirm('Hapus data berikut dari MySQL dan browser?\n\n' + names + '\n\nBackup otomatis dibuat lebih dulu. Tindakan ini tidak bisa dibatalkan.')) return;

        const btn = document.querySelector('button[onclick="resetSelectedData()"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuat backup &amp; menghapus...'; }
        try {
            const r = await api('/api/data-reset', { method: 'POST', body: JSON.stringify({ scopes, password, confirm: word }) });
            clearLocal(scopes);
            if (typeof pushToUniversalDatastore === 'function') {
                const cleared = ['mc_expenses', 'mc_mutations', 'mc_closings', 'mc_adjustments', 'mc_assets', 'mc_investors', 'mc_bookings', 'mc_gantungans', 'mc_old_money_stock', 'mc_old_money_suppliers', 'mc_old_money_trxs', 'mc_bi_rates', 'mc_demo_transactions', 'mc_demo_stock', 'mc_demo_customers', 'mc_hris_employees', 'mc_hris_attendance', 'mc_hris_kasbon', 'mc_hris_bpjs', 'mc_hris_leave'];
                const map = { expenses: ['mc_expenses'], operations: ['mc_mutations', 'mc_closings', 'mc_adjustments', 'mc_assets', 'mc_investors', 'mc_hris_employees', 'mc_hris_attendance', 'mc_hris_kasbon', 'mc_hris_bpjs', 'mc_hris_leave'], bookingDemo: ['mc_bookings', 'mc_demo_transactions', 'mc_demo_stock', 'mc_demo_customers'], gantungan: ['mc_gantungans'], oldMoney: ['mc_old_money_stock', 'mc_old_money_suppliers', 'mc_old_money_trxs'], biRates: ['mc_bi_rates'] };
                scopes.forEach(s => (map[s] || []).forEach(k => { try { pushToUniversalDatastore(k, []); } catch (e) {} }));
            }
            alert('Reset berhasil.' + (r.backup ? '\nBackup sebelum reset: ' + r.backup : '') + '\nAplikasi akan dimuat ulang.');
            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            alert('Reset gagal: ' + e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Reset Data yang Dipilih'; }
        }
    };
    window.resetDatabase = window.resetSelectedData;

    // Mulai dari nol: pilih semua cakupan lalu jalankan alur reset yang sama
    // (password + kata RESET + backup otomatis).
    window.resetAllData = function () {
        const checks = document.querySelectorAll('.rz-check');
        if (!checks.length) { alert('Daftar data belum termuat. Buka ulang tab Danger Zone.'); return; }
        checks.forEach(c => { c.checked = true; });
        const all = document.getElementById('rzAll'); if (all) all.checked = true;
        if (!confirm('RESET TOTAL: semua data operasional (transaksi, nasabah, kas, bank, stok, pengeluaran, closing, gantungan, alert) akan dikosongkan dan aplikasi kembali seperti baru dengan saldo 0.\n\nMaster valuta, profil perusahaan, dan pengguna tetap ada.\n\nLanjutkan?')) return;
        window.resetSelectedData();
    };

    function hookTab() {
        const orig = window.switchSettingsTab;
        if (typeof orig !== 'function' || window.__rzHooked) return;
        window.__rzHooked = true;
        const wrapped = function (tab) {
            const r = orig.apply(this, arguments);
            if (tab === 'danger') load();
            return r;
        };
        window.switchSettingsTab = wrapped;
    }

    document.addEventListener('DOMContentLoaded', function () { render(); hookTab(); });
    window.addEventListener('load', hookTab);
})();
