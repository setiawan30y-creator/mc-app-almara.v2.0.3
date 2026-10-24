// POS - Data Pembayaran
// - Kolom jumlah diterima terisi otomatis sesuai total (atau DP untuk booking), selama kasir belum mengubahnya sendiri.
// - Labelnya mengikuti metode: Tunai / Transfer BCA / Transfer Mandiri.
// - Metode Split: kolom itu disembunyikan, yang tampil hanya Tunai dan Transfer.
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    let dirty = false; // kasir mengetik sendiri jumlahnya

    function bankLabel() {
        const v = ($('transferBankTarget') && $('transferBankTarget').value) || 'BCA';
        return v === 'MANDIRI' ? 'Mandiri' : v === 'BCA' ? 'BCA' : v;
    }

    function amountDue() {
        const cart = (typeof currentCart !== 'undefined' && Array.isArray(currentCart)) ? currentCart : [];
        let raw = 0;
        cart.forEach((i) => { raw += (Number(i.totalIdr) || 0) * (i.type === 'JUAL' ? 1 : -1); });
        const discount = parseFloat($('posDiscountModern') && $('posDiscountModern').value) || 0;
        const fee = parseFloat($('posFeeModern') && $('posFeeModern').value) || 0;
        const finalGt = raw >= 0 ? raw - discount + fee : raw + fee - discount;
        const abs = Math.abs(finalGt);
        const checkout = $('checkoutType') ? $('checkoutType').value : 'CASH';
        if (checkout === 'BOOKING') {
            const dp = parseFloat($('dpAmount') && $('dpAmount').value) || 0;
            return Math.min(dp, abs);
        }
        const imp = typeof window.getPosBookingImport === 'function' ? window.getPosBookingImport() : null;
        if (imp) return Math.max(0, abs - imp.dp); // DP booking sudah dibayar
        return abs;
    }

    function applyMethodUi() {
        const input = $('posCashReceivedModern');
        if (!input) return;
        const group = input.closest('.form-group');
        const label = group ? group.querySelector('label') : null;
        const method = ($('paymentMethod') && $('paymentMethod').value) || 'CASH';
        if (group) group.style.display = method === 'SPLIT' ? 'none' : '';
        if (label) label.textContent = method === 'TRANSFER' ? `Transfer ${bankLabel()} (Rp)` : 'Tunai (Rp)';
    }

    function autofill() {
        const input = $('posCashReceivedModern');
        if (!input) return;
        const due = amountDue();
        if (due <= 0) dirty = false; // keranjang kosong / form direset
        if (dirty) return;
        if ((($('paymentMethod') && $('paymentMethod').value) || 'CASH') === 'SPLIT') { input.value = ''; return; }
        input.value = due > 0 ? String(Number(due.toFixed(2))) : '';
        const change = $('posChangeModern');
        const utils = (window.AlmaraApp || {}).utils;
        if (change) change.textContent = utils && utils.formatIdr ? utils.formatIdr(0) : 'Rp 0';
    }

    function refresh(resetDirty) {
        if (resetDirty) dirty = false;
        applyMethodUi();
        autofill();
    }

    // setiap total berubah (keranjang, diskon, fee) -> isi ulang jumlah
    if (typeof window.recalculatePosChange === 'function' && !window.recalculatePosChange.__pay) {
        const original = window.recalculatePosChange;
        const wrapped = function () {
            autofill();
            return original.apply(this, arguments);
        };
        wrapped.__pay = true;
        window.recalculatePosChange = wrapped;
    }

    document.addEventListener('input', (ev) => {
        const id = ev.target && ev.target.id;
        if (id === 'posCashReceivedModern' && ev.isTrusted) dirty = true;
        else if (id === 'dpAmount') autofill();
    });
    document.addEventListener('change', (ev) => {
        const id = ev.target && ev.target.id;
        if (id === 'paymentMethod' || id === 'transferBankTarget') refresh(id === 'paymentMethod');
        else if (id === 'checkoutType') refresh(true);
    });
    // jQuery/select2 memicu 'change' lewat jQuery saja; pasang juga di sini bila tersedia
    if (window.jQuery) {
        window.jQuery(document).on('change', '#paymentMethod, #transferBankTarget, #checkoutType', function () {
            refresh(this.id !== 'transferBankTarget');
        });
    }

    function init() { refresh(true); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.refreshPosPaymentUi = refresh;
})();
