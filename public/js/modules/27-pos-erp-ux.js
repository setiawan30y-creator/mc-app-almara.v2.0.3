/* POS ERP UX enhancement.
 * Visual/workspace layer only: reuses the existing draft-session engine in 03-pos.js.
 * IMPORTANT: this module intentionally does not use a DOM-wide MutationObserver.
 * The POS view mutates itself frequently; observing its subtree can create a
 * render -> mutation -> render loop and freeze the browser.
 */
(function () {
    'use strict';

    const DRAFT_KEY = 'mc_pos_draft_sessions_v1';
    const ACTIVE_KEY = 'mc_pos_active_draft_id_v1';

    function sessions() {
        try {
            const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (_) { return []; }
    }

    function activeSession() {
        const rows = sessions();
        const id = localStorage.getItem(ACTIVE_KEY) || (rows[0] && rows[0].id);
        return rows.find(row => row.id === id) || rows[0] || null;
    }

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    }

    function customerName(session) {
        const id = session?.fields?.customer || '';
        if (!id || id === '-') return 'Belum memilih nasabah';
        try {
            const customers = window.AlmaraApp?.store?.getCustomers?.() || [];
            const row = customers.find(c => String(c.id_nasabah) === String(id));
            return row?.nama || session?.fields?.customerSearch || id;
        } catch (_) {
            return session?.fields?.customerSearch || id;
        }
    }

    function installHeader() {
        const bar = document.getElementById('posDraftFloatingBar');
        if (!bar || bar.dataset.erpUxReady === '1') return;
        bar.dataset.erpUxReady = '1';

        const head = document.createElement('div');
        head.className = 'pos-erp-workspace-head';
        head.innerHTML = `
            <div class="pos-erp-workspace-title"><span class="dot"></span> Teller Workspace · Multi Customer</div>
            <div class="pos-erp-workspace-actions">
                <button type="button" class="btn btn-sm btn-primary" id="posErpNewCustomerBtn" title="Ctrl+N">
                    <i class="fa-solid fa-user-plus"></i> Nasabah Baru
                </button>
                <button type="button" class="btn btn-sm btn-outline pos-erp-secondary" id="posErpResetBtn" title="Reset form aktif">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
            </div>`;
        bar.prepend(head);

        document.getElementById('posErpNewCustomerBtn')?.addEventListener('click', () => {
            if (typeof window.addPosDraftSession === 'function') window.addPosDraftSession();
        });
        document.getElementById('posErpResetBtn')?.addEventListener('click', () => {
            if (typeof window.resetActivePosDraft === 'function') window.resetActivePosDraft();
        });
    }

    function decorateTabs() {
        const wrap = document.getElementById('posDraftSessionList');
        if (!wrap) return;
        const rows = sessions();
        wrap.querySelectorAll('button').forEach((button, index) => {
            const row = rows[index];
            if (!row) return;
            const count = Array.isArray(row.cart) ? row.cart.length : 0;
            const done = Boolean(row.completed);
            button.setAttribute('aria-label', `${customerName(row)}${done ? ', selesai' : ', aktif'}`);
            const oldBadge = button.querySelector('.pos-erp-session-badge');
            if (oldBadge) oldBadge.remove();
            const badge = document.createElement('span');
            badge.className = 'pos-erp-session-badge' + (done ? ' completed' : '');
            badge.innerHTML = done
                ? '<i class="fa-solid fa-check"></i> selesai'
                : `<i class="fa-solid fa-cart-shopping"></i> ${count}`;
            button.appendChild(badge);
        });
    }

    function installCustomerContext() {
        const view = document.getElementById('pos-view');
        if (!view) return;
        let node = document.getElementById('posErpCustomerContext');
        if (!node) {
            node = document.createElement('div');
            node.id = 'posErpCustomerContext';
            node.className = 'pos-erp-customer-context';
            const bar = document.getElementById('posDraftFloatingBar');
            if (bar && bar.parentNode === view) bar.insertAdjacentElement('afterend', node);
            else view.prepend(node);
        }
        const row = activeSession();
        const html = !row
            ? '<i class="fa-solid fa-user"></i><strong> Belum ada workspace</strong>'
            : `<i class="fa-solid ${row.completed ? 'fa-circle-check' : 'fa-user'}"></i>
               <strong>${esc(customerName(row))}</strong>
               <small>· ${row.completed ? `Selesai ${esc(row.lastPrint?.summary?.receiptId || '')}` : 'Workspace aktif'}</small>`;
        if (node.innerHTML !== html) node.innerHTML = html;
    }

    function installInvoiceNote() {
        const input = document.getElementById('posTrxIdPreviewModern');
        if (!input || document.getElementById('posErpInvoiceNote')) return;
        const note = document.createElement('div');
        note.id = 'posErpInvoiceNote';
        note.className = 'pos-erp-invoice-note';
        note.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span>Nomor invoice dibuat otomatis saat <strong>Submit Pembayaran</strong>. Draft tidak memakai nomor invoice.</span>';
        input.closest('.form-group, .mb-3, .field, div')?.appendChild(note);
    }

    function keyboardShortcuts(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
            const active = document.activeElement;
            if (active && /INPUT|TEXTAREA|SELECT/.test(active.tagName) && active.value) return;
            event.preventDefault();
            if (typeof window.addPosDraftSession === 'function') window.addPosDraftSession();
        }
    }

    function boot() {
        const view = document.getElementById('pos-view');
        if (!view || view.dataset.erpUxBooted === '1') return;
        view.dataset.erpUxBooted = '1';
        installHeader();
        installInvoiceNote();
        installCustomerContext();
        decorateTabs();
        document.addEventListener('keydown', keyboardShortcuts, { passive: false });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
