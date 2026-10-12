/*
 * ERP Closing Bridge
 * Closing Harian lama tetap menjadi UI utama.
 * Temporary menyimpan draft/count fisik tanpa mengosongkan denominasi.
 * Cash Count dikirim ke ERP dan dipulihkan setelah reload.
 */
(function () {
    'use strict';

    const ERP_SUMMARY_URL = '/erp/closing/summary';
    const ERP_STORE_URL = '/erp/closing';
    const DRAFT_PREFIX = 'almara:closing:draft:';
    const ALLOWED_DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];

    const ids = {
        physical: ['closingFisik', 'physical_cash'],
        physicalSummary: ['physical-summary'],
        cashTotal: ['cash-total'],
        expected: ['closingKasSistem', 'expected-cash'],
        hanging: ['closingGantunganPiutang', 'hanging-cash'],
        expenses: ['closingTotalExpenses'],
        accounted: ['accounted-cash'],
        difference: ['closingSelisih', 'difference'],
        date: ['closingDateInput'],
        type: ['closingType'],
        note: ['closingNote'],
        source: ['closingErpSourceStatus']
    };

    const find = list => {
        for (const id of list) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    };

    const money = value => {
        const n = Number(value || 0);
        return typeof formatIdr === 'function' ? formatIdr(n) : `Rp ${n.toLocaleString('id-ID')}`;
    };

    const parseMoney = value => {
        if (value === null || value === undefined || value === '') return 0;
        const negative = String(value).trim().startsWith('-');
        const digits = String(value).replace(/[^0-9]/g, '');
        const n = Number(digits || 0);
        return negative ? -n : n;
    };

    function closingDate() {
        return (find(ids.date)?.value || document.querySelector('[name="closing_date"]')?.value || new Date().toISOString()).slice(0, 10);
    }

    function denominationInputs() {
        return Array.from(document.querySelectorAll('input.denom-qty[data-denom]'));
    }

    function denominationRows() {
        return denominationInputs().map(input => ({
            denomination: Number(input.dataset.denom || 0),
            quantity: Math.max(0, Number(input.value || 0))
        })).filter(row => ALLOWED_DENOMS.includes(row.denomination) && row.quantity > 0);
    }

    function denominationsJson() {
        return JSON.stringify(denominationRows());
    }

    function calculateDenominationTotal() {
        return denominationInputs().reduce((total, input) => {
            const denom = Number(input.dataset.denom || 0);
            const qty = Math.max(0, Number(input.value || 0));
            return total + (denom * qty);
        }, 0);
    }

    function physicalValue() {
        const denominationTotal = calculateDenominationTotal();
        if (denominationInputs().length) return denominationTotal;
        const el = find(ids.physical);
        return el ? parseMoney(el.value !== undefined && el.value !== '' ? el.value : el.textContent) : 0;
    }

    function writeText(list, value) {
        const el = find(list);
        if (el) el.textContent = money(value);
    }

    function setPhysical(value) {
        const n = Number(value || 0);
        const hidden = find(ids.physical);
        if (hidden) {
            if ('value' in hidden) hidden.value = String(n);
            hidden.dataset.value = String(n);
        }
        writeText(ids.physicalSummary, n);
        writeText(ids.cashTotal, n);

        denominationInputs().forEach(input => {
            const row = input.closest('tr');
            const totalCell = row?.querySelector('.line-total');
            if (totalCell) {
                const line = Number(input.dataset.denom || 0) * Math.max(0, Number(input.value || 0));
                totalCell.textContent = money(line);
            }
        });
    }

    function updateReconciliation(data = window.__almaraErpClosingSummary || {}) {
        const expected = Number(data.expected_cash || 0);
        const hanging = Number(data.hanging_amount || 0);
        const physical = physicalValue();
        const accounted = physical + hanging;
        const difference = accounted - expected;

        writeText(ids.physicalSummary, physical);
        writeText(ids.cashTotal, physical);
        writeText(ids.accounted, accounted);

        const diffEl = find(ids.difference);
        if (diffEl) {
            diffEl.textContent = difference === 0 ? money(0) : `${difference < 0 ? '-' : '+'}${money(Math.abs(difference))}`;
            diffEl.classList.toggle('ok', difference === 0);
            diffEl.classList.toggle('bad', difference < 0);
            diffEl.classList.toggle('warn', difference > 0);
        }

        const expectedEl = find(ids.expected);
        if (expectedEl) expectedEl.textContent = money(expected);
        const hangingEl = find(ids.hanging);
        if (hangingEl) hangingEl.textContent = money(hanging);

        setPhysical(physical);
        renderVaultBalance(physical, window.__almaraClosingStatus || 'TEMPORARY');
        return { expected, hanging, physical, accounted, difference };
    }

    function draftKey(date = closingDate()) { return `${DRAFT_PREFIX}${date}`; }

    function snapshotClosingForm() {
        const controls = denominationInputs();
        return {
            date: closingDate(),
            physical: calculateDenominationTotal(),
            denominations: denominationRows(),
            controls: controls.map((el, index) => ({
                index, id: el.id || '', name: el.name || '', value: el.value,
                checked: el.checked, type: el.type, denom: el.dataset.denom || ''
            })),
            savedAt: Date.now()
        };
    }

    function saveDraft(snapshot) {
        try {
            localStorage.setItem(draftKey(snapshot.date), JSON.stringify(snapshot));
            return true;
        } catch (_) { return false; }
    }

    function restoreClosingForm(snapshot) {
        if (!snapshot) return;
        const controls = denominationInputs();
        snapshot.controls.forEach(item => {
            let el = item.id ? document.getElementById(item.id) : null;
            if (!el && item.name) el = controls.find(x => x.name === item.name);
            if (!el && item.denom) el = controls.find(x => x.dataset.denom === String(item.denom));
            if (!el) el = controls[item.index];
            if (el) el.value = item.value ?? '';
        });
        setPhysical(calculateDenominationTotal() || Number(snapshot.physical || 0));
        updateReconciliation();
        saveDraft(snapshot);
        document.dispatchEvent(new CustomEvent('almara:closing-draft-restored', { detail: snapshot }));
    }

    function loadDraft(date = closingDate()) {
        try {
            const raw = localStorage.getItem(draftKey(date));
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }

    async function fetchSummary(date = closingDate()) {
        const response = await fetch(`${ERP_SUMMARY_URL}?date=${encodeURIComponent(date)}&ts=${Date.now()}`, {
            credentials: 'same-origin', cache: 'no-store',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!response.ok) throw new Error(`ERP summary HTTP ${response.status}`);
        const result = await response.json();
        if (result.status !== 'success' || !result.data) throw new Error('Format ERP summary tidak valid.');
        return result.data;
    }

    function renderSummary(data) {
        window.__almaraErpClosingSummary = data;
        updateReconciliation(data);
        const source = find(ids.source);
        if (source) {
            source.textContent = `ERP Ledger aktif • Expected Cash ${money(data.expected_cash || 0)} • Gantungan ${money(data.hanging_amount || 0)}`;
            source.style.color = '#166534';
        }
    }

    async function refresh() {
        try {
            const data = await fetchSummary();
            renderSummary(data);
            return data;
        } catch (error) {
            console.warn('[ERP Closing]', error);
            updateReconciliation();
            return null;
        }
    }

    function csrf() {
        return typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    function ensureHidden(name, value) {
        const form = document.getElementById('closing-form');
        if (!form) return null;
        let input = form.querySelector(`input[name="${name}"]`);
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            form.appendChild(input);
        }
        input.value = value;
        return input;
    }

    function ensureClosingActions() {
        const form = document.getElementById('closing-form');
        if (!form) return;
        const submit = form.querySelector('button[type="submit"]');
        if (!submit || form.dataset.erpActionsReady === '1') return;
        form.dataset.erpActionsReady = '1';

        submit.type = 'submit';
        submit.textContent = 'Simpan Sementara';
        submit.dataset.closingMode = 'temporary';
        submit.classList.add('temporary-closing-button');

        const final = submit.cloneNode(true);
        final.textContent = 'Reconcile & Closing';
        final.dataset.closingMode = 'final';
        final.classList.add('final-closing-button');
        submit.insertAdjacentElement('afterend', final);
    }

    async function postFinal() {
        const response = await fetch(ERP_STORE_URL, {
            method: 'POST', credentials: 'same-origin',
            headers: {
                Accept: 'application/json, text/html',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf()
            },
            body: new URLSearchParams({
                closing_date: closingDate(),
                physical_cash: String(physicalValue()),
                closing_mode: 'final',
                denominations: denominationsJson(),
                notes: find(ids.note)?.value || 'Closing Final dari Closing Harian Kasir'
            }).toString()
        });
        if (response.status === 419) throw new Error('Token keamanan kedaluwarsa (419). Refresh halaman lalu ulangi closing.');
        if (!response.ok) throw new Error(`ERP Closing gagal (HTTP ${response.status}).`);
        return response;
    }

    function install() {
        if (window.__erpClosingBridgeInstalled) return true;
        if (typeof window.saveClosing !== 'function') return false;
        const legacySave = window.saveClosing;
        window.__erpClosingBridgeInstalled = true;

        window.saveClosing = async function () {
            const type = find(ids.type)?.value || 'temporary';
            const snapshot = snapshotClosingForm();
            if (type !== 'final') {
                saveDraft(snapshot);
                const result = await Promise.resolve(legacySave.apply(this, arguments));
                [0, 50, 200, 500, 900].forEach(delay => setTimeout(() => restoreClosingForm(snapshot), delay));
                setTimeout(refresh, 900);
                return result;
            }

            const erp = await fetchSummary();
            const current = updateReconciliation(erp);
            if (Math.abs(current.difference) >= 0.005) {
                alert(`Closing Final belum dapat dikunci. Selisih ERP = ${money(current.difference)}.`);
                return;
            }
            if (!confirm('ERP menunjukkan BALANCED. Simpan dan kunci Closing Final?')) return;
            try {
                await postFinal();
                localStorage.removeItem(draftKey(closingDate()));
                await refresh();
                alert('Closing Final berhasil dicatat di ERP Ledger.');
            } catch (error) {
                console.error('[ERP Closing]', error);
                alert(error.message || 'Closing Final gagal disimpan ke ERP.');
            }
        };
        return true;
    }

    function bindDenominationCalculation() {
        denominationInputs().forEach(input => {
            if (input.dataset.erpReconBound === '1') return;
            input.dataset.erpReconBound = '1';
            input.addEventListener('input', () => updateReconciliation());
            input.addEventListener('change', () => updateReconciliation());
        });
        updateReconciliation();
    }

    function bindTemporarySubmitDraft() {
        const form = document.getElementById('closing-form');
        if (!form || form.dataset.erpTemporaryDraftBound === '1') return;
        form.dataset.erpTemporaryDraftBound = '1';
        ensureClosingActions();

        form.addEventListener('submit', event => {
            const submitter = event.submitter;
            const mode = submitter?.dataset?.closingMode || 'temporary';
            const snapshot = snapshotClosingForm();
            saveDraft(snapshot);
            ensureHidden('closing_mode', mode);
            ensureHidden('denominations', denominationsJson());
            ensureHidden('physical_cash', String(snapshot.physical));

            if (mode === 'final') {
                const current = updateReconciliation();
                if (Math.abs(current.difference) >= 0.005) {
                    event.preventDefault();
                    alert(`Closing Final belum balance. Selisih ${money(current.difference)}.`);
                    return;
                }
                if (!confirm('Simpan Closing Final? Setelah ini status menjadi CLOSED.')) {
                    event.preventDefault();
                }
            }
        }, true);
    }

    function renderVaultBalance(physical, status) {
        const summary = document.querySelector('.summary');
        if (!summary) return;
        let metric = document.getElementById('vault-balance-metric');
        if (!metric) {
            metric = document.createElement('div');
            metric.className = 'metric';
            metric.id = 'vault-balance-metric';
            metric.innerHTML = '<div class="label">Total Rp (Sisa di Brankas)</div><div class="value"></div><div class="vault-status"></div>';
            summary.appendChild(metric);
        }
        metric.querySelector('.value').textContent = money(physical);
        const badge = metric.querySelector('.vault-status');
        const final = status === 'CLOSED';
        badge.textContent = final ? '● FINAL' : '● TERSIMPAN SEMENTARA';
        badge.style.cssText = `display:inline-block;margin-top:3px;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:800;color:${final ? '#166534' : '#9a6700'};background:${final ? '#f2faf4' : '#fff8e8'};border:1px solid ${final ? '#b8d9c1' : '#ead29b'}`;
    }

    function boot() {
        install();
        bindDenominationCalculation();
        bindTemporarySubmitDraft();
        const draft = loadDraft();
        if (draft) restoreClosingForm(draft);
        refresh();

        let tries = 0;
        const timer = setInterval(() => {
            install(); bindDenominationCalculation(); bindTemporarySubmitDraft();
            const currentDraft = loadDraft();
            if (currentDraft) restoreClosingForm(currentDraft);
            tries++;
            if (tries >= 30) clearInterval(timer);
        }, 500);
    }

    document.addEventListener('almara:closing-saved', () => { const draft = loadDraft(); if (draft) restoreClosingForm(draft); refresh(); });
    document.addEventListener('almara:closing-updated', () => { const draft = loadDraft(); if (draft) restoreClosingForm(draft); refresh(); });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    window.refreshClosingFromErp = refresh;
    window.recalculateClosingReconciliation = updateReconciliation;
})();
