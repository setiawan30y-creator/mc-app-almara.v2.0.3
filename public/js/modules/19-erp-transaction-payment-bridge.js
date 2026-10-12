/*
 * ERP Transaction -> Payment -> Cash/Bank bridge.
 * The legacy POS remains the cashier UI. This bridge posts the completed
 * transaction to the ERP ledger after the legacy transaction has been saved.
 */
(function () {
    'use strict';

    const POST_URL = '/erp/transactions/{transaction}/payments';
    const RETRY_DELAYS = [800, 1600, 3000, 5000];
    const SYNC_PREFIX = 'mc_erp_payment_sync:';

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function csrf() {
        return typeof window.getCsrfToken === 'function'
            ? window.getCsrfToken()
            : document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    function activeSession() {
        try {
            return typeof window.getActivePosDraft === 'function' ? window.getActivePosDraft() : null;
        } catch (_) {
            return null;
        }
    }

    function transactionItemRef(receiptId, item, index) {
        const source = String(item?.id || 'ITEM').replace(/\s+/g, '');
        if (source.startsWith(String(receiptId))) return source;
        return `${receiptId}-${source}-${String(index + 1).padStart(2, '0')}`;
    }

    function positive(value) {
        return Math.abs(Number(value || 0));
    }

    function buildAllocations(cart, payCash, payTransfer) {
        const rows = Array.isArray(cart) ? cart.filter(item => positive(item?.totalIdr) > 0) : [];
        if (!rows.length) return [];

        const baseTotal = rows.reduce((sum, item) => sum + positive(item.totalIdr), 0);
        if (baseTotal <= 0) return [];

        let cashRemaining = positive(payCash);
        let transferRemaining = positive(payTransfer);
        let itemTotalRemaining = baseTotal;
        const allocations = [];

        rows.forEach((item, index) => {
            const rawItemTotal = positive(item.totalIdr);
            const isLast = index === rows.length - 1;
            const itemTarget = isLast
                ? Math.max(0, itemTotalRemaining)
                : Math.min(itemTotalRemaining, Math.max(0, Math.round(rawItemTotal)));

            const cash = isLast
                ? Math.min(cashRemaining, itemTarget)
                : Math.min(cashRemaining, Math.max(0, Math.round(positive(payCash) * rawItemTotal / baseTotal)));
            const transfer = Math.max(0, itemTarget - cash);

            cashRemaining = Math.max(0, cashRemaining - cash);
            transferRemaining = Math.max(0, transferRemaining - transfer);
            itemTotalRemaining = Math.max(0, itemTotalRemaining - itemTarget);

            allocations.push({
                item,
                cash: Math.max(0, cash),
                transfer: Math.max(0, transfer)
            });
        });

        // Correct the final row for any integer rounding drift while preserving
        // the exact transaction total required by TransactionPostingService.
        if (allocations.length) {
            const allocatedCash = allocations.reduce((sum, row) => sum + row.cash, 0);
            const allocatedTransfer = allocations.reduce((sum, row) => sum + row.transfer, 0);
            const cashDrift = positive(payCash) - allocatedCash;
            const transferDrift = positive(payTransfer) - allocatedTransfer;
            const last = allocations[allocations.length - 1];
            last.cash = Math.max(0, last.cash + cashDrift);
            last.transfer = Math.max(0, last.transfer + transferDrift);
        }

        return allocations;
    }

    function markState(ref, state, detail = '') {
        try {
            localStorage.setItem(SYNC_PREFIX + ref, JSON.stringify({
                state,
                detail,
                at: new Date().toISOString()
            }));
        } catch (_) {}
    }

    async function postOne(transactionRef, payments) {
        const url = POST_URL.replace('{transaction}', encodeURIComponent(transactionRef));
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrf(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ payments })
        });

        let payload = null;
        try { payload = await response.json(); } catch (_) {}

        if (!response.ok) {
            const errors = payload?.errors
                ? Object.values(payload.errors).flat().join(' ')
                : '';
            throw new Error(errors || payload?.message || `ERP Payment HTTP ${response.status}`);
        }

        return payload;
    }

    async function postCompletedDraft(session) {
        const printContext = session?.lastPrint;
        const summary = printContext?.summary;
        const cart = Array.isArray(printContext?.cart) ? printContext.cart : [];
        if (!summary || !summary.receiptId || !cart.length) return { skipped: true };

        // Booking/DP transactions are stored outside the normal transactions table.
        // ERP payment for bookings will be wired when booking settlement is implemented.
        if (String(summary.receiptId).toUpperCase().startsWith('BKG-') || session.fields?.checkoutType === 'BOOKING') {
            return { skipped: true, reason: 'booking' };
        }

        const receiptId = String(summary.receiptId);
        const payCash = Number(summary.payCash || 0);
        const payTransfer = Number(summary.payTransfer || 0);
        const baseTotal = cart.reduce((sum, item) => sum + positive(item.totalIdr), 0);
        const paidTotal = positive(payCash) + positive(payTransfer);

        // TransactionPostingService intentionally requires payment == transaction total.
        // If a fee/discount changes the paid total, leave it pending instead of posting
        // an incorrect ERP amount. The fee/discount ledger can be added separately.
        if (Math.abs(baseTotal - paidTotal) > 0.005) {
            markState(receiptId, 'pending_adjustment', 'ERP payment skipped because fee/discount makes paid total differ from item totals.');
            console.warn('[ERP Payment Bridge] Pending adjustment:', receiptId, { baseTotal, paidTotal });
            return { skipped: true, reason: 'adjustment' };
        }

        const bankName = String(session.fields?.bank || 'BCA').trim() || 'BCA';
        const allocations = buildAllocations(cart, payCash, payTransfer);
        const results = [];

        for (let index = 0; index < allocations.length; index++) {
            const allocation = allocations[index];
            const transactionRef = transactionItemRef(receiptId, allocation.item, index);
            const payments = [];

            if (allocation.cash > 0) {
                payments.push({
                    method: 'cash',
                    amount: allocation.cash,
                    currency_code: 'IDR',
                    reference: receiptId,
                    idempotency_key: `POS:${receiptId}:${transactionRef}:CASH`,
                    description: `POS Cash ${receiptId}`
                });
            }

            if (allocation.transfer > 0) {
                payments.push({
                    method: 'bank',
                    amount: allocation.transfer,
                    currency_code: 'IDR',
                    bank_name: bankName,
                    reference: receiptId,
                    bank_reference: receiptId,
                    idempotency_key: `POS:${receiptId}:${transactionRef}:BANK:${bankName.toUpperCase()}`,
                    description: `POS Transfer ${bankName} ${receiptId}`
                });
            }

            if (!payments.length) continue;

            let lastError = null;
            for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
                try {
                    const payload = await postOne(transactionRef, payments);
                    results.push({ transactionRef, ok: true, payload });
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
                }
            }

            if (lastError) {
                markState(receiptId, 'error', lastError.message || String(lastError));
                throw new Error(`ERP ${transactionRef}: ${lastError.message || lastError}`);
            }
        }

        markState(receiptId, 'posted', `ERP posted ${results.length} transaction item(s).`);
        document.dispatchEvent(new CustomEvent('almara:erp-payment-posted', {
            detail: { receiptId, results }
        }));
        return { skipped: false, receiptId, results };
    }

    async function bridgeAfterProcess() {
        const session = activeSession();
        if (!session?.completed) return;
        try {
            const result = await postCompletedDraft(session);
            if (!result.skipped) {
                console.info('[ERP Payment Bridge] Posted:', result.receiptId);
                if (typeof window.refreshActiveRealtimeViews === 'function') {
                    window.refreshActiveRealtimeViews();
                }
            }
        } catch (error) {
            console.error('[ERP Payment Bridge] Posting failed:', error);
        }
    }

    function install() {
        if (window.__almaraErpPaymentBridgeInstalled) return true;
        if (typeof window.processPayment !== 'function') return false;

        const original = window.processPayment;
        window.processPayment = async function (...args) {
            const result = await original.apply(this, args);
            setTimeout(bridgeAfterProcess, 250);
            return result;
        };

        window.__almaraErpPaymentBridgeInstalled = true;
        console.info('[ERP Payment Bridge] Transaction → Payment → Cash/Bank aktif.');
        return true;
    }

    let attempts = 0;
    const timer = setInterval(() => {
        if (install() || ++attempts >= 60) clearInterval(timer);
    }, 250);

    window.addEventListener('load', install, { once: true });
})();
