(function () {
    'use strict';

    const DRAFT_PREFIX = 'almara:closing:draft:';
    const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];

    const money = n => {
        n = Number(n || 0);
        return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
    };

    function dateKey() {
        const input = document.querySelector('#closingDateInput, input[name="closing_date"], input[name="date"]');
        return (input?.value || new Date().toISOString()).slice(0, 10);
    }

    function readSavedPhysical() {
        try {
            const raw = localStorage.getItem(DRAFT_PREFIX + dateKey());
            if (!raw) return 0;
            const draft = JSON.parse(raw);
            if (Array.isArray(draft.denominations)) {
                return draft.denominations.reduce((sum, row) => {
                    const d = Number(row.denomination || row.denom || 0);
                    const q = Number(row.quantity || row.qty || 0);
                    return sum + (DENOMS.includes(d) ? d * q : 0);
                }, 0);
            }
            return Number(draft.physical || 0);
        } catch (_) { return 0; }
    }

    function calculatePhysical() {
        const inputs = [...document.querySelectorAll('input.denom-qty[data-denom]')];
        if (inputs.length) {
            const value = inputs.reduce((sum, input) => {
                const d = Number(input.dataset.denom || 0);
                const q = Number(input.value || 0);
                return sum + (DENOMS.includes(d) ? d * Math.max(0, q) : 0);
            }, 0);
            return value || readSavedPhysical();
        }
        return readSavedPhysical();
    }

    function findRow(labelText) {
        const nodes = [...document.querySelectorAll('body *')].filter(el => {
            if (el.children.length > 3) return false;
            return el.textContent.trim() === labelText;
        });
        return nodes.sort((a, b) => a.textContent.length - b.textContent.length)[0] || null;
    }

    function updatePhysicalDisplay() {
        const value = calculatePhysical();
        const label = findRow('Total Uang Fisik (Kalkulasi)');
        if (!label) return;

        let row = label.parentElement;
        let valueEl = row?.querySelector('.value, .amount, [class*="value"], [class*="amount"]');
        if (!valueEl && row) {
            const candidates = [...row.children].filter(el => el !== label);
            valueEl = candidates[candidates.length - 1];
        }
        if (valueEl) {
            valueEl.textContent = money(value);
            valueEl.style.fontWeight = '900';
        }
        label.dataset.closingStatusPatched = '1';
    }

    function getStatus() {
        const type = document.querySelector('#closingType, select[name="closing_type"], select[name="closing_mode"]');
        const value = String(type?.value || '').toLowerCase();
        if (value === 'final' || value === 'closed') return 'FINAL';
        return 'TEMPORARY';
    }

    function addStatusBadge() {
        const label = findRow('Total Rp (Sisa di Brankas)');
        if (!label) return;
        const row = label.parentElement;
        if (!row) return;

        let badge = document.getElementById('closing-harian-status-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'closing-harian-status-badge';
            badge.setAttribute('role', 'status');
            row.insertAdjacentElement('afterend', badge);
        }

        const final = getStatus() === 'FINAL';
        badge.textContent = final ? '🟢  FINAL' : '🟡  ● TERSIMPAN SEMENTARA';
        badge.style.cssText = [
            'display:block', 'width:max-content', 'margin:8px 0 4px auto',
            'padding:6px 10px', 'border-radius:5px', 'font-size:11px',
            'font-weight:900', 'letter-spacing:.2px',
            `color:${final ? '#166534' : '#92400e'}`,
            `background:${final ? '#dcfce7' : '#fef3c7'}`,
            `border:2px solid ${final ? '#22c55e' : '#f59e0b'}`,
            'box-sizing:border-box'
        ].join(';');

        let note = document.getElementById('closing-harian-status-note');
        if (!note) {
            note = document.createElement('div');
            note.id = 'closing-harian-status-note';
            badge.insertAdjacentElement('afterend', note);
        }
        note.textContent = final ? 'Kas sudah dikunci' : 'Data sudah tersimpan, tetapi belum dikunci sebagai Closing Final';
        note.style.cssText = `display:block;text-align:right;font-size:10px;font-weight:700;color:${final ? '#166534' : '#92400e'};margin-bottom:8px`;
    }

    function run() {
        updatePhysicalDisplay();
        addStatusBadge();
    }

    function boot() {
        run();
        let count = 0;
        const timer = setInterval(() => {
            run();
            if (++count >= 40) clearInterval(timer);
        }, 500);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    window.addEventListener('storage', run);
    document.addEventListener('almara:closing-saved', run);
    document.addEventListener('almara:closing-updated', run);
})();
