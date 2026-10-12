// POS and transaction flow

// ==============================
// POS / TRANSACTION LOGIC
// ==============================
const { store: almaraStore, utils: almaraUtils, auth: almaraAuth } = window.AlmaraApp;
window._trxReceiverManualDirty = false;

function getPosWaGatewaySettings() {
    try {
        const settings = JSON.parse(localStorage.getItem('mc_wa_gateway') || '{}');
        return settings && typeof settings === 'object' ? settings : {};
    } catch (error) {
        return {};
    }
}

function normalizePosWhatsAppNumber(phone) {
    let value = String(phone || '').replace(/\D/g, '');
    if (value.startsWith('0')) value = '62' + value.slice(1);
    if (value && !value.startsWith('62')) value = '62' + value;
    return value;
}

window.updatePosWaGatewayOption = function() {
    const toggle = document.getElementById('posSendWaGateway');
    const hint = document.getElementById('posWaGatewayHint');
    const gateway = getPosWaGatewaySettings();
    const isReady = Boolean(gateway.enabled && gateway.endpoint && gateway.token);
    if (toggle) {
        toggle.disabled = !isReady;
        if (!isReady) toggle.checked = false;
    }
    if (hint) {
        hint.textContent = isReady
            ? 'Kirim ucapan terima kasih ke nasabah setelah transaksi berhasil.'
            : 'WA Gateway belum aktif. Atur terlebih dahulu di Pengaturan → WA Gateway.';
    }
};

function buildPosThankYouMessage(summary) {
    const profile = almaraStore.getProfile();
    const customer = (almaraStore.getCustomers() || []).find(c => c.id_nasabah === summary.customerId);
    const customerName = customer?.nama || 'Pelanggan';
    return `Halo ${customerName},\n\nTerima kasih telah bertransaksi di *${profile.name || 'MC-ALMARA'}*.\n\nReferensi transaksi: *${summary.receiptId}*\nTanggal: ${almaraUtils.formatDateToDMY(summary.timestamp)}\n\nKami senang dapat melayani Anda. Sampai jumpa kembali.`;
}

async function sendPosThankYouViaGateway(summary) {
    const customer = (almaraStore.getCustomers() || []).find(c => c.id_nasabah === summary.customerId);
    const target = normalizePosWhatsAppNumber(customer?.no_hp);
    if (!target) throw new Error('Nomor WhatsApp nasabah belum tersedia.');
    return window.sendWhatsAppGateway(target, buildPosThankYouMessage(summary), { reference: summary.receiptId });
}

function toggleReceiverManualInput() {
    const receiverSelect = document.getElementById('trxReceiver');
    const manualInput = document.getElementById('trxReceiverManual');
    if (!receiverSelect || !manualInput) return;

    const isManual = receiverSelect.value === 'MANUAL';
    manualInput.classList.toggle('hidden', !isManual);
    manualInput.disabled = !isManual;
    if (isManual) {
        manualInput.focus();
    } else {
        manualInput.value = '';
        window._trxReceiverManualDirty = false;
    }
}

function syncReceiverWithCustomer(force = false) {
    const customerSelect = document.getElementById('trxCustomer');
    const receiverSelect = document.getElementById('trxReceiver');
    if (!customerSelect || !receiverSelect) return;

    const currentReceiver = receiverSelect.value;
    const shouldFollow = force || !currentReceiver || currentReceiver === 'SAME' || currentReceiver === customerSelect.dataset.lastCustomerValue;

    if (shouldFollow) {
        const nextValue = customerSelect.value || 'SAME';
        if (window.jQuery) {
            $(receiverSelect).val(nextValue).trigger('change.select2');
        } else {
            receiverSelect.value = nextValue;
        }
    }

    customerSelect.dataset.lastCustomerValue = customerSelect.value || '';
    toggleReceiverManualInput();
}
window.togglePosRateMode = function() {
    const rateModeEl = document.getElementById('trxRateMode');
    const rateEl = document.getElementById('trxRate');
    const hintEl = document.getElementById('trxRateHint');
    if (!rateModeEl || !rateEl) return;

    // Selalu izinkan input rate tanpa dikunci
    rateEl.readOnly = false;
    rateEl.style.background = '';

    const isAuto = rateModeEl.value !== 'MANUAL';
    if (hintEl) {
        hintEl.textContent = isAuto
            ? 'Mode otomatis akan mengambil kurs dari master sesuai tipe BELI/JUAL.'
            : 'Mode manual aktif. Anda bisa override kurs deal untuk transaksi ini.';
    }

    if (isAuto) {
        updatePosSummary();
    }

    updateAddToCartState();
}

function updateAddToCartState() {
    const addBtn = document.getElementById('btnAddToCart');
    if (!addBtn) return;

    const activeSession = getActivePosDraft();
    if (activeSession && activeSession.completed) {
        addBtn.disabled = true;
        addBtn.classList.add('disabled');
        return;
    }

    const currency = document.getElementById('trxCurrency') ? document.getElementById('trxCurrency').value : '';
    const amount = parseFloat(document.getElementById('trxAmount') ? document.getElementById('trxAmount').value : '');
    const rate = parseFloat(document.getElementById('trxRate') ? document.getElementById('trxRate').value : '');

    const isReady = Boolean(currency) && amount > 0 && rate > 0;
    addBtn.disabled = !isReady;
    addBtn.classList.toggle('disabled', !isReady);
}

function updateProcessPaymentState() {
    const processBtn = document.getElementById('btnProcessPayment');
    if (!processBtn) return;

    const activeSession = getActivePosDraft();
    if (activeSession && activeSession.completed) {
        processBtn.disabled = true;
        processBtn.classList.add('disabled');
        return;
    }

    const customerId = document.getElementById('trxCustomer')?.value || '';
    const isReady = Boolean(customerId) && currentCart.length > 0;

    processBtn.disabled = !isReady;
    processBtn.classList.toggle('disabled', !isReady);
}

const POS_DRAFT_STORAGE_KEY = 'mc_pos_draft_sessions_v1';
const POS_DRAFT_ACTIVE_KEY = 'mc_pos_active_draft_id_v1';
const POS_JUAL_MONTHLY_LIMIT_USD = 10000;
let isApplyingPosDraft = false;
let posDraftSaveTimer = null;
let activePosDraftIdMemory = localStorage.getItem(POS_DRAFT_ACTIVE_KEY) || '';

function makePosDraftSession(label = '') {
    const now = new Date();
    return {
        id: 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: label || `Form ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        minimized: false,
        cart: [],
        lastPrint: null,
        fields: {
            invoice: '',
            date: now.toISOString().split('T')[0],
            time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            trxType: 'BELI',
            currency: '',
            valasSearch: '',
            rateMode: 'AUTO',
            rate: '',
            amount: '',
            customer: '',
            customerSearch: '',
            paymentMethod: 'CASH',
            bank: 'BCA',
            cashReceived: '',
            splitCash: '',
            splitTransfer: '',
            transactionPurpose: 'PERJALANAN_WISATA',
            sourceOfFunds: 'GAJI',
            discount: '',
            fee: '',
            receiver: 'SAME',
            receiverManual: '',
            keterangan: '',
            customerPhoto: ''
        }
    };
}

function getPosDraftSessions() {
    try {
        const parsed = JSON.parse(localStorage.getItem(POS_DRAFT_STORAGE_KEY) || '[]');
        return Array.isArray(parsed) && parsed.length ? parsed : [makePosDraftSession('Form 1')];
    } catch(e) {
        return [makePosDraftSession('Form 1')];
    }
}

function savePosDraftSessions(sessions) {
    localStorage.setItem(POS_DRAFT_STORAGE_KEY, JSON.stringify(Array.isArray(sessions) ? sessions : []));
}

function setActivePosDraftPrintContext(cart, summary) {
    const sessions = getPosDraftSessions();
    const activeId = getActivePosDraftId();
    const idx = sessions.findIndex(s => s.id === activeId);
    if (idx >= 0) {
        sessions[idx].lastPrint = cart && summary ? { cart: [...cart], summary: { ...summary } } : null;
        savePosDraftSessions(sessions);
        renderPosDraftSessions();
    }
}

function applyPosDraftPrintContext(session = getActivePosDraft()) {
    const printBtn = document.getElementById('btnPrintReceipt');
    const invoiceBtn = document.getElementById('btnPrintInvoice');
    const waBtn = document.getElementById('btnSendWA');
    const printContext = session && session.lastPrint;
    const hasPrintContext = !!(printContext && Array.isArray(printContext.cart) && printContext.summary);

    if (typeof window.setPosPrintButtonsVisibility === 'function') {
        window.setPosPrintButtonsVisibility(hasPrintContext);
    }

    if (printBtn) printBtn.onclick = null;
    if (invoiceBtn) invoiceBtn.onclick = null;
    if (waBtn) waBtn.onclick = null;

    if (!hasPrintContext) return;

    const printCart = [...printContext.cart];
    const printSummary = { ...printContext.summary };
    if (printBtn) printBtn.onclick = () => printReceipt(printCart, printSummary);
    if (invoiceBtn) invoiceBtn.onclick = () => printInvoice(printCart, printSummary);
    if (waBtn) waBtn.onclick = () => sendWhatsAppReceipt(printCart, printSummary);
}

function hidePosFloatingTotalPopup() {
    const popup = document.getElementById('posFloatingTotalPopup');
    if (!popup) return;
    popup.classList.add('hidden');
}

function renderPosFloatingTotalPopup(session = getActivePosDraft()) {
    const popup = document.getElementById('posFloatingTotalPopup');
    if (!popup) return;

    const printContext = session && session.lastPrint;
    const summary = printContext && printContext.summary ? printContext.summary : null;
    if (!summary) {
        hidePosFloatingTotalPopup();
        return;
    }

    const grandTotal = parseFloat(summary.grandTotal) || 0;
    const isCashOut = grandTotal < 0;
    const amount = almaraUtils.formatIdr(Math.abs(grandTotal));
    const titleEl = document.getElementById('posFloatingTotalTitle');
    const amountEl = document.getElementById('posFloatingTotalAmount');
    const metaEl = document.getElementById('posFloatingTotalMeta');
    const captionEl = document.getElementById('posFloatingTotalCaption');
    const badgeEl = document.getElementById('posFloatingTotalBadge');

    if (titleEl) titleEl.textContent = isCashOut ? 'Total Rupiah yang Harus Dikeluarkan' : 'Total Rupiah yang Diterima';
    if (amountEl) {
        amountEl.textContent = amount;
        amountEl.style.color = isCashOut ? '#f87171' : '#10b981';
    }
    if (captionEl) {
        captionEl.textContent = isCashOut
            ? 'Pembayaran ke nasabah'
            : 'Dana masuk dari nasabah';
    }
    if (badgeEl) {
        badgeEl.textContent = summary.receiptId || '-';
        badgeEl.style.background = isCashOut ? 'rgba(239, 68, 68, 0.16)' : 'rgba(16, 185, 129, 0.16)';
        badgeEl.style.color = isCashOut ? '#fca5a5' : '#86efac';
    }
    if (metaEl) {
        const customers = almaraStore.getCustomers() || [];
        const customer = summary.customerId ? customers.find(c => c.id_nasabah === summary.customerId) : null;
        metaEl.textContent = `${customer ? customer.nama || 'Pelanggan' : 'Pelanggan'} • ${summary.paymentMethod || 'CASH'} • ${summary.receiptId || '-'}`;
    }

    popup.classList.remove('hidden');
}

window.hidePosFloatingTotalPopup = hidePosFloatingTotalPopup;
window.showPosFloatingTotalPopup = renderPosFloatingTotalPopup;

function applyPosDraftCompletedMode(session) {
    const view = document.getElementById('pos-view');
    if (!view) return;

    const isCompleted = Boolean(session && session.completed);
    view.classList.toggle('pos-draft-completed', isCompleted);

    const whitelistedButtonIds = new Set(['btnPrintReceipt', 'btnPrintInvoice', 'btnSendWA']);
    const managedNodes = view.querySelectorAll('input, select, textarea, button');
    managedNodes.forEach(node => {
        const isInDraftBar = Boolean(node.closest('#posDraftFloatingBar'));
        const isWhitelisted = whitelistedButtonIds.has(node.id) || Boolean(node.closest('.pos-print-actions'));
        if (isInDraftBar || isWhitelisted) return;

        if (!isCompleted) {
            if (node.dataset.posDisabledPrev === '1') {
                node.disabled = true;
            } else {
                node.disabled = false;
            }
            if ((node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') && node.dataset.posReadonlyPrev === '1') {
                node.readOnly = true;
            } else if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                node.readOnly = false;
            }
            return;
        }

        if (!node.dataset.posDisabledPrev) {
            node.dataset.posDisabledPrev = node.disabled ? '1' : '0';
        }
        if ((node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') && !node.dataset.posReadonlyPrev) {
            node.dataset.posReadonlyPrev = node.readOnly ? '1' : '0';
        }

        node.disabled = true;
        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
            node.readOnly = true;
        }
    });

    updateAddToCartState();
    updateProcessPaymentState();
}

function getActivePosDraftId() {
    const sessions = getPosDraftSessions();
    const stored = activePosDraftIdMemory || localStorage.getItem(POS_DRAFT_ACTIVE_KEY);
    const activeId = sessions.some(s => s.id === stored) ? stored : sessions[0].id;
    activePosDraftIdMemory = activeId;
    return activeId;
}

function setActivePosDraftId(id) {
    activePosDraftIdMemory = id;
    localStorage.setItem(POS_DRAFT_ACTIVE_KEY, id);
}

function getActivePosDraft() {
    const sessions = getPosDraftSessions();
    const activeId = getActivePosDraftId();
    return sessions.find(s => s.id === activeId) || sessions[0];
}

function setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value || '';
    if (window.jQuery && $(el).hasClass('select2-hidden-accessible')) {
        $(el).val(value || '').trigger('change.select2');
    }
}

function collectPosDraftFromForm() {
    const active = getActivePosDraft();
    const get = id => document.getElementById(id);
    const photo = get('trxCustomerPhotoPreview');
    return {
        ...active,
        cart: Array.isArray(currentCart) ? [...currentCart] : [],
        fields: {
            invoice: get('posTrxIdPreviewModern')?.value || '',
            date: get('trxCheckoutDate')?.value || '',
            time: get('posTrxTimePreviewModern')?.value || '',
            trxType: get('trxType')?.value || 'BELI',
            currency: get('trxCurrency')?.value || '',
            valasSearch: get('posValasSearchModern')?.value || '',
            rateMode: get('trxRateMode')?.value || 'AUTO',
            rate: get('trxRate')?.value || '',
            amount: get('trxAmount')?.value || '',
            customer: get('trxCustomer')?.value || '',
            customerSearch: get('posCustomerSearchModern')?.value || '',
            paymentMethod: get('paymentMethod')?.value || 'CASH',
            bank: get('transferBankTarget')?.value || 'BCA',
            cashReceived: get('posCashReceivedModern')?.value || '',
            splitCash: get('splitCashAmount')?.value || '',
            splitTransfer: get('splitTransferAmount')?.value || '',
            transactionPurpose: get('trxTransactionPurpose')?.value || 'PERJALANAN_WISATA',
            sourceOfFunds: get('trxSourceOfFunds')?.value || 'GAJI',
            discount: get('posDiscountModern')?.value || '',
            fee: get('posFeeModern')?.value || '',
            receiver: get('trxReceiver')?.value || 'SAME',
            receiverManual: get('trxReceiverManual')?.value || '',
            keterangan: get('trxKeteranganModern')?.value || '',
            sendWaGateway: Boolean(get('posSendWaGateway')?.checked),
            customerPhoto: photo && !photo.classList.contains('hidden') ? (photo.getAttribute('src') || '') : ''
        }
    };
}

function saveActivePosDraftNow() {
    if (isApplyingPosDraft) return;
    clearTimeout(posDraftSaveTimer);
    const sessions = getPosDraftSessions();
    const activeId = activePosDraftIdMemory || getActivePosDraftId();
    const idx = sessions.findIndex(s => s.id === activeId);
    if (idx >= 0) {
        sessions[idx] = collectPosDraftFromForm();
        sessions[idx].id = activeId;
        savePosDraftSessions(sessions);
        renderPosDraftSessions();
    }
}

function scheduleSaveActivePosDraft() {
    if (isApplyingPosDraft) return;
    clearTimeout(posDraftSaveTimer);
    posDraftSaveTimer = setTimeout(saveActivePosDraftNow, 180);
}

function applyPosDraftToForm(session) {
    if (!session) return;
    isApplyingPosDraft = true;
    const f = session.fields || {};
    currentCart = Array.isArray(session.cart) ? [...session.cart] : [];

    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };

    setVal('posTrxIdPreviewModern', f.invoice && f.invoice !== '[Otomatis]' ? f.invoice : '[Dibuat saat proses]');
    setVal('trxCheckoutDate', f.date);
    setVal('posTrxTimePreviewModern', f.time);
    setSelectValue('trxType', f.trxType || 'BELI');
    setSelectValue('trxCurrency', f.currency || '');
    setVal('posValasSearchModern', f.valasSearch);
    setSelectValue('trxRateMode', f.rateMode || 'AUTO');
    setVal('trxRate', f.rate);
    setVal('trxAmount', f.amount);
    setSelectValue('trxCustomer', f.customer || '');
    setVal('posCustomerSearchModern', f.customerSearch);
    setSelectValue('paymentMethod', f.paymentMethod || 'CASH');
    setSelectValue('transferBankTarget', f.bank || 'BCA');
    setVal('posCashReceivedModern', f.cashReceived);
    setVal('splitCashAmount', f.splitCash);
    setVal('splitTransferAmount', f.splitTransfer);
    setSelectValue('trxTransactionPurpose', f.transactionPurpose || 'PERJALANAN_WISATA');
    setSelectValue('trxSourceOfFunds', f.sourceOfFunds || 'GAJI');
    setVal('posDiscountModern', f.discount);
    setVal('posFeeModern', f.fee);
    setSelectValue('trxReceiver', f.receiver || 'SAME');
    setVal('trxReceiverManual', f.receiverManual);
    setVal('trxKeteranganModern', f.keterangan);
    const waGatewayToggle = document.getElementById('posSendWaGateway');
    if (waGatewayToggle) waGatewayToggle.checked = Boolean(f.sendWaGateway);
    window.updatePosWaGatewayOption();

    const img = document.getElementById('trxCustomerPhotoPreview');
    const placeholder = document.getElementById('trxCustomerPhotoPlaceholder');
    if (img && placeholder) {
        if (f.customerPhoto) {
            img.src = f.customerPhoto;
            img.classList.remove('hidden');
            placeholder.style.display = 'none';
        } else {
            img.src = '';
            img.classList.add('hidden');
            placeholder.style.display = 'flex';
        }
    }

    document.querySelectorAll('#pos-view .pos-flow-card').forEach(card => {
        card.style.display = session.minimized ? 'none' : '';
    });

    renderCart();
    window.togglePosRateMode();
    document.getElementById('paymentMethod')?.dispatchEvent(new Event('change'));
    if (typeof window.updateModernCustomerProfileCard === 'function') window.updateModernCustomerProfileCard();
    if (typeof window.renderPosValasListModern === 'function') window.renderPosValasListModern();
    showCustomerHistory();
    toggleReceiverManualInput();
    applyPosDraftCompletedMode(session);
    updateProcessPaymentState();
    applyPosDraftPrintContext(session);
    renderPosFloatingTotalPopup(session);
    renderPosDraftSessions();
    isApplyingPosDraft = false;
}

function renderPosDraftSessions() {
    const wrap = document.getElementById('posDraftSessionList');
    if (!wrap) return;
    const sessions = getPosDraftSessions();
    const activeId = getActivePosDraftId();
    wrap.innerHTML = sessions.map((session, index) => {
        const count = Array.isArray(session.cart) ? session.cart.length : 0;
        const active = session.id === activeId;
        const name = session.fields?.customerSearch || session.label || `Form ${index + 1}`;
        const completed = Boolean(session.completed);
        const buttonClass = active
            ? (completed ? 'btn-secondary' : 'btn-primary')
            : (completed ? 'btn-secondary' : 'btn-outline');
        const icon = completed
            ? '<i class="fa-solid fa-circle-check"></i>'
            : (session.minimized ? '<i class="fa-solid fa-window-minimize"></i>' : '<i class="fa-solid fa-file-invoice"></i>');
        return `
            <button type="button" class="btn btn-sm ${buttonClass}" onclick="window.switchPosDraftSession('${session.id}')" title="${completed ? 'Transaksi selesai' : count + ' item keranjang'}">
                ${icon}
                ${name} ${count ? `(${count})` : ''}
            </button>
        `;
    }).join('');
}

function ensurePosDraftSessionReady() {
    const sessions = getPosDraftSessions();
    savePosDraftSessions(sessions);
    setActivePosDraftId(getActivePosDraftId());
    applyPosDraftToForm(getActivePosDraft());
}

window.switchPosDraftSession = function(id) {
    saveActivePosDraftNow();
    setActivePosDraftId(id);
    applyPosDraftToForm(getActivePosDraft());
};

window.addPosDraftSession = function() {
    saveActivePosDraftNow();
    const sessions = getPosDraftSessions();
    const draft = makePosDraftSession(`Form ${sessions.length + 1}`);
    sessions.push(draft);
    savePosDraftSessions(sessions);
    setActivePosDraftId(draft.id);
    applyPosDraftToForm(draft);
};

window.resetActivePosDraft = function() {
    if (!confirm('Reset isi form transaksi aktif?')) return;
    const sessions = getPosDraftSessions();
    const activeId = getActivePosDraftId();
    const idx = sessions.findIndex(s => s.id === activeId);
    if (idx >= 0) {
        sessions[idx] = { ...makePosDraftSession(sessions[idx].label), id: activeId, label: sessions[idx].label };
        savePosDraftSessions(sessions);
        applyPosDraftToForm(sessions[idx]);
    }
};

window.closeActivePosDraft = function() {
    const sessions = getPosDraftSessions();
    if (sessions.length <= 1) {
        window.resetActivePosDraft();
        return;
    }
    if (!confirm('Tutup form transaksi aktif?')) return;
    const activeId = getActivePosDraftId();
    const nextSessions = sessions.filter(s => s.id !== activeId);
    savePosDraftSessions(nextSessions);
    setActivePosDraftId(nextSessions[0].id);
    applyPosDraftToForm(nextSessions[0]);
};

window.toggleActivePosDraftMinimize = function() {
    saveActivePosDraftNow();
    const sessions = getPosDraftSessions();
    const activeId = getActivePosDraftId();
    const idx = sessions.findIndex(s => s.id === activeId);
    if (idx >= 0) {
        sessions[idx].minimized = !sessions[idx].minimized;
        savePosDraftSessions(sessions);
        applyPosDraftToForm(sessions[idx]);
    }
};

function loadPosForm() {
    let currencies = [];
    let masterCurrencies = [];
    try {
        currencies = almaraStore.getCurrencies();
        masterCurrencies = almaraStore.getMasterCurrencies();
    } catch (e) {
        console.error("Gagal mengambil currencies dari almaraStore:", e);
    }

    if (!Array.isArray(currencies)) {
        currencies = [];
    }
    if (!Array.isArray(masterCurrencies)) {
        masterCurrencies = [];
    }

    if (currencies.length === 0) {
        console.warn("loadPosForm: Data currencies kosong, memuat default fallback.");
        currencies = [
            { code: 'USD', buy: 15400, sell: 15600, stock: 0 },
            { code: 'EUR', buy: 16800, sell: 17100, stock: 0 },
            { code: 'SGD', buy: 11500, sell: 11700, stock: 0 },
            { code: 'AUD', buy: 10100, sell: 10300, stock: 0 },
            { code: 'JPY', buy: 98, sell: 102, stock: 0 }
        ];
    }

    const select = document.getElementById('trxCurrency');
    
    if(select) {
        let html = '<option value="">-- Ketik Pencarian --</option>';
        try {
            currencies.forEach(c => {
                if (!c || !c.code) return;
                const mc = masterCurrencies.find(m => m && m.code === c.code) || { flag: '', country: '' };
                const stockVal = parseFloat(c.stock) || 0;
                html += `<option value="${c.code}">${mc.flag || ''} ${c.code} ${mc.country ? '- ' + mc.country : ''} (Stok: ${stockVal})</option>`;
            });
        } catch (loopError) {
            console.error("Error saat merender opsi select currencies:", loopError);
        }

        if(window.jQuery) {
            if ($(select).hasClass("select2-hidden-accessible")) {
                $(select).select2('destroy');
            }
            select.innerHTML = html;
            $(select).select2({ placeholder: "Ketik pencarian..." });
            $(select).off('change.posSummary').on('change.posSummary', () => {
                updatePosSummary();
                updateAddToCartState();
            });
            $(select).trigger('change');
        } else {
            select.innerHTML = html;
        }
    }
    
    // Default Checkout Date
    const trxCheckoutDateEl = document.getElementById('trxCheckoutDate');
    if(trxCheckoutDateEl) trxCheckoutDateEl.value = new Date().toISOString().split('T')[0];
    const trxTimePreviewEl = document.getElementById('posTrxTimePreviewModern');
    if (trxTimePreviewEl) {
        const now = new Date();
        trxTimePreviewEl.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    const trxIdPreviewEl = document.getElementById('posTrxIdPreviewModern');
    if (trxIdPreviewEl && !window.editingTrxId) {
        trxIdPreviewEl.value = '[Dibuat saat proses]';
    }
    applyPosInvoiceManualAccess();
    const rateModeEl = document.getElementById('trxRateMode');
    if (rateModeEl && !rateModeEl.value) {
        rateModeEl.value = 'AUTO';
    }
    const typeEl = document.getElementById('trxType');
    const amountEl = document.getElementById('trxAmount');
    const rateEl = document.getElementById('trxRate');

    if (typeEl) typeEl.onchange = updatePosSummary;
    if (amountEl) amountEl.oninput = updatePosSummary;
    if (rateEl) {
        rateEl.oninput = () => {
            const rateMode = document.getElementById('trxRateMode');
            if (rateMode && rateMode.value !== 'MANUAL') {
                rateMode.value = 'MANUAL';
                window.togglePosRateMode();
            }
            updatePosSummary();
        };
    }

    // Load Nasabah
    const customers = almaraStore.getCustomers();
    const custSelect = document.getElementById('trxCustomer');
    const recSelect = document.getElementById('trxReceiver');
    const receiverManualInput = document.getElementById('trxReceiverManual');
    if (window.jQuery && !$(custSelect).hasClass("select2-hidden-accessible")) {
        $(custSelect).select2({ placeholder: "Cari nasabah..." });
        $(custSelect).off('change.posCustomer').on('change.posCustomer', () => {
            showCustomerHistory();
            syncReceiverWithCustomer();
            updateAddToCartState();
        });
    } else if (window.jQuery) {
        $(custSelect).off('change.posCustomer').on('change.posCustomer', () => {
            showCustomerHistory();
            syncReceiverWithCustomer();
            updateAddToCartState();
        });
    } else {
        custSelect.onchange = () => {
            showCustomerHistory();
            syncReceiverWithCustomer();
            updateAddToCartState();
        };
    }
    if (window.jQuery && recSelect && !$(recSelect).hasClass("select2-hidden-accessible")) {
        $(recSelect).select2({ placeholder: "Cari pengambil valas..." });
        $(recSelect).off('change.posReceiver').on('change.posReceiver', () => {
            toggleReceiverManualInput();
        });
    } else if (recSelect) {
        recSelect.onchange = () => {
            toggleReceiverManualInput();
        };
    }
    
    const customerOptions = customers.map(c => {
        let idn = c.no_ktp && c.no_ktp !== '-' ? `KTP: ${c.no_ktp}` : (c.selain_ktp && c.selain_ktp !== '-' ? c.selain_ktp : '');
        return `<option value="${c.id_nasabah}">${c.id_nasabah} - ${c.nama}${idn ? ` - ${idn}` : ''} - HP: ${c.no_hp || '-'} - ${c.warga_negara || 'Lokal'}</option>`;
    }).join('');
    
    custSelect.innerHTML = '<option value="">-- Pilih Nasabah Wajib --</option>' + customerOptions;
    if (recSelect) {
        recSelect.innerHTML = '<option value="SAME">-- Sama dengan Nasabah --</option><option value="MANUAL">-- Isi Manual --</option><option value="-">-- Pengunjung Biasa --</option>' + customerOptions;
    }
    
    if (window.jQuery) {
        $(custSelect).trigger('change.select2');
        if (recSelect) $(recSelect).trigger('change.select2');
    }

    if (receiverManualInput) {
        receiverManualInput.oninput = () => {
            window._trxReceiverManualDirty = Boolean(receiverManualInput.value.trim());
        };
    }

    resetPosForm(true);
    
    if(!window.preserveCart) {
        currentCart = [];
        window.editingTrxId = null;
    }
    window.preserveCart = false;
    
    renderCart();
    window.togglePosRateMode();
    updateAddToCartState();

    applyPosDraftPrintContext(getActivePosDraft());
    
    // Initialize customer history view
    showCustomerHistory();
    syncReceiverWithCustomer(true);

    // Modern UI Initializations
    if (typeof window.renderPosValasListModern === 'function') {
        window.renderPosValasListModern();
    }
    if (typeof window.updateModernCustomerProfileCard === 'function') {
        window.updateModernCustomerProfileCard();
    }
    ensurePosDraftSessionReady();
}

function showCustomerHistory() {
    const custId = document.getElementById('trxCustomer').value || window._posLastProcessedCustomerId || '';
    const container = document.getElementById('customerPosHistoryContainer');
    const listEl = document.getElementById('customerPosHistoryList');
    
    if (!container || !listEl) return;
    
    if (custId === '-' || !custId) {
        container.style.display = 'none';
        return;
    }
    
    const allTrxs = almaraStore.getTransactions();
    const custTrxs = allTrxs.filter(t => t.customerId === custId);
    
    if (custTrxs.length === 0) {
        container.style.display = 'block';
        listEl.innerHTML = '<div style="text-align: center; color: #64748B; font-style: italic; padding: 5px;">Belum ada histori transaksi.</div>';
        return;
    }
    
    const invMap = {};
    custTrxs.forEach(t => {
        if (!invMap[t.id]) invMap[t.id] = { id: t.id, timestamp: t.timestamp, items: [] };
        invMap[t.id].items.push(t);
    });
    
    let invoices = Object.values(invMap);
    invoices.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    invoices = invoices.slice(0, 5); // Ambil 5 invoice terakhir
    
    let html = '';
    invoices.forEach(inv => {
        let total = 0;
        let itemsHtml = inv.items.map(i => {
            total += (i.tipe === 'JUAL' ? i.total : -i.total);
            return `<div class="pos-history-item"><span class="${i.tipe === 'BELI' ? 'text-green' : 'text-red'} font-weight-bold">${i.tipe}</span> ${i.nominal.toLocaleString()} ${almaraUtils.getFlagHtml(i.valuta)} @ ${almaraUtils.formatRate(i.rate)}</div>`;
        }).join('');
        
        let invDate = almaraUtils.formatDateToDMY(inv.timestamp);
        let invIdText = inv.id ? `<span style="color: #94A3B8; font-size: 0.7rem; display: block;">${inv.id}</span>` : '';
        
        html += `
            <div class="pos-customer-history-entry">
                <div class="pos-history-topline">
                    <div>
                        <div class="pos-history-date">${invDate}</div>
                        ${invIdText}
                    </div>
                    <div class="pos-history-total" style="color: ${total >= 0 ? '#10B981' : '#F87171'};">${almaraUtils.formatIdr(Math.abs(total))}</div>
                </div>
                <div class="pos-history-items">${itemsHtml}</div>
                <div style="margin-top: 3px; font-size: 0.66rem; color: #94a3b8; text-align: right;">Grand Total</div>
            </div>
        `;
    });
    
    container.style.display = 'block';
    listEl.innerHTML = html;
}

function updatePosSummary() {
    try {
        const type = document.getElementById('trxType').value;
        const curCode = document.getElementById('trxCurrency').value;
        const amountVal = document.getElementById('trxAmount').value;
        const amount = parseFloat(amountVal) || 0;
        const currencies = almaraStore.getCurrencies() || [];
        const cur = currencies.find(c => c && c.code === curCode);
        const rateMode = document.getElementById('trxRateMode') ? document.getElementById('trxRateMode').value : 'AUTO';

        // Auto fill rate if currency is selected and mode is AUTO
        if(cur && rateMode !== 'MANUAL' && document.activeElement !== document.getElementById('trxRate')) {
            document.getElementById('trxRate').value = type === 'BELI' ? cur.buy : cur.sell;
        }
        
        const rate = parseFloat(document.getElementById('trxRate').value) || 0;
        const totalIdr = amount * rate;

        // Update UI Summary
        const masterCurrencies = almaraStore.getMasterCurrencies() || [];
        const mc = masterCurrencies.find(m => m && m.code === curCode) || { flag: '' };
        document.getElementById('summaryType').textContent = type;
        document.getElementById('summaryType').className = type === 'BELI' ? 'text-green' : 'text-red';
        document.getElementById('summaryCurrency').textContent = curCode ? `${mc.flag || ''} ${curCode}` : '-';
        document.getElementById('summaryRate').textContent = almaraUtils.formatRate(rate);
        document.getElementById('summaryAmount').textContent = amountVal ? new Intl.NumberFormat().format(amount) : '0';
        document.getElementById('summaryTotalIdr').textContent = almaraUtils.formatIdr(totalIdr);
        updateAddToCartState();
    } catch (err) {
        console.error("Gagal updatePosSummary:", err);
    }
}

function resetPosForm(clearPhoto = false) {
    document.getElementById('trxCurrency').value = '';
    if(window.jQuery) {
        $('#trxCurrency').val(null).trigger('change.select2');
        $('#trxCurrency').select2('close');
    }
    if (document.getElementById('trxRateMode')) {
        document.getElementById('trxRateMode').value = 'AUTO';
    }
    document.getElementById('trxAmount').value = '';
    document.getElementById('trxRate').value = '';
    const receiverManualInput = document.getElementById('trxReceiverManual');
    if (receiverManualInput) {
        receiverManualInput.value = '';
        receiverManualInput.classList.add('hidden');
        receiverManualInput.disabled = true;
    }
    const receiverSelect = document.getElementById('trxReceiver');
    if (receiverSelect) {
        receiverSelect.value = 'SAME';
        if (window.jQuery) {
            $('#trxReceiver').val('SAME').trigger('change.select2');
        }
    }
    window._trxReceiverManualDirty = false;
    window.togglePosRateMode();
    updatePosSummary();
    updateAddToCartState();
    if (clearPhoto && typeof window.removeTrxCustomerPhoto === 'function') {
        window.removeTrxCustomerPhoto();
    }
    if (clearPhoto) {
        const underlyingFileEl = document.getElementById('trxUnderlyingFile');
        if (underlyingFileEl) underlyingFileEl.value = '';
    }

    if (clearPhoto) {
        const trxIdPreviewEl = document.getElementById('posTrxIdPreviewModern');
        if (trxIdPreviewEl && !window.editingTrxId) {
            trxIdPreviewEl.value = '[Dibuat saat proses]';
        }
        applyPosInvoiceManualAccess();
        const trxTimePreviewEl = document.getElementById('posTrxTimePreviewModern');
        if (trxTimePreviewEl) {
            const now = new Date();
            trxTimePreviewEl.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        const discountEl = document.getElementById('posDiscountModern');
        if (discountEl) discountEl.value = '';
        const feeEl = document.getElementById('posFeeModern');
        if (feeEl) feeEl.value = '';
        const cashReceivedEl = document.getElementById('posCashReceivedModern');
        if (cashReceivedEl) cashReceivedEl.value = '';
        const purposeEl = document.getElementById('trxTransactionPurpose');
        if (purposeEl) purposeEl.value = 'PERJALANAN_WISATA';
        const sourceFundsEl = document.getElementById('trxSourceOfFunds');
        if (sourceFundsEl) sourceFundsEl.value = 'GAJI';
        const changeEl = document.getElementById('posChangeModern');
        if (changeEl) changeEl.textContent = 'Rp 0';
        const custSearchEl = document.getElementById('posCustomerSearchModern');
        if (custSearchEl) custSearchEl.value = '';
        const customerSelectEl = document.getElementById('trxCustomer');
        if (customerSelectEl) {
            if (window.jQuery) {
                $('#trxCustomer').val('').trigger('change.select2');
            } else {
                customerSelectEl.value = '';
            }
            customerSelectEl.dataset.lastCustomerValue = '';
        }
        const customerResultsEl = document.getElementById('posCustomerResultsModern');
        if (customerResultsEl) {
            customerResultsEl.classList.add('hidden');
            customerResultsEl.innerHTML = '';
        }
        const keteranganEl = document.getElementById('trxKeteranganModern');
        if (keteranganEl) keteranganEl.value = '';
    }

    // Reset modern valas input only after adding an item.
    const valasSearchEl = document.getElementById('posValasSearchModern');
    if (valasSearchEl) valasSearchEl.value = '';

    if (typeof window.updateModernCustomerProfileCard === 'function') {
        window.updateModernCustomerProfileCard();
    }
    if (typeof window.renderPosValasListModern === 'function') {
        window.renderPosValasListModern();
    }
    updateProcessPaymentState();
}

function resetPosTradeEntryOnly() {
    const currencyEl = document.getElementById('trxCurrency');
    if (currencyEl) currencyEl.value = '';
    if(window.jQuery) {
        $('#trxCurrency').val(null).trigger('change.select2');
        $('#trxCurrency').select2('close');
    }
    const rateModeEl = document.getElementById('trxRateMode');
    if (rateModeEl) rateModeEl.value = 'AUTO';
    const amountEl = document.getElementById('trxAmount');
    if (amountEl) amountEl.value = '';
    const rateEl = document.getElementById('trxRate');
    if (rateEl) rateEl.value = '';
    const valasSearchEl = document.getElementById('posValasSearchModern');
    if (valasSearchEl) valasSearchEl.value = '';

    window.togglePosRateMode();
    updatePosSummary();
    updateAddToCartState();
    if (typeof window.renderPosValasListModern === 'function') {
        window.renderPosValasListModern();
    }
    updateProcessPaymentState();
}

function getPosDateFromInput() {
    const checkoutDateEl = document.getElementById('trxCheckoutDate');
    const value = checkoutDateEl && checkoutDateEl.value ? checkoutDateEl.value : '';
    if (value) {
        const parts = value.split('-').map(Number);
        if (parts.length === 3 && parts.every(Boolean)) {
            return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        }
    }
    return new Date();
}

function getPosMonthKey(dateValue) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getPosExistingDocumentMax(prefix) {
    const normalizedPrefix = String(prefix || '').toUpperCase();
    if (!normalizedPrefix) return 0;

    const sources = [];
    if (typeof window.safeArrayGet === 'function') {
        sources.push(window.safeArrayGet('mc_transactions'));
        sources.push(window.safeArrayGet('mc_bookings'));
    }
    if (window.AlmaraApp?.store?.getTransactions) {
        sources.push(window.AlmaraApp.store.getTransactions());
    }
    if (typeof getBookings === 'function') {
        sources.push(getBookings());
    }

    const pattern = new RegExp(`\\b${normalizedPrefix}-(\\d+)\\b`, 'i');
    let maxSeq = 0;
    sources.flat().filter(Boolean).forEach(row => {
        ['id', 'invoiceId', 'bookingId', 'itemId'].forEach(field => {
            const value = String(row[field] || '');
            const match = value.match(pattern);
            if (!match) return;
            const num = parseInt(match[1], 10);
            if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
        });
    });

    return maxSeq;
}

function isPosInvoiceManualOwner() {
    const user = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
    const role = String(user && user.role ? user.role : '').toLowerCase();
    const accessRole = typeof getAccessRoleForUserRole === 'function' ? getAccessRoleForUserRole(role) : role;
    const permissions = typeof getRolePermissions === 'function' ? getRolePermissions() : {};
    return permissions[accessRole]?.actions?.manualInvoice === true;
}

function normalizeManualInvoiceId(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || raw === '[OTOMATIS]' || raw.startsWith('[')) return '';

    let numeric = '';
    const directMatch = raw.match(/^INV-(\d+)$/);
    if (directMatch) numeric = directMatch[1];
    else if (/^\d+$/.test(raw)) numeric = raw;

    if (!numeric) return null;
    return `INV-${parseInt(numeric, 10).toString().padStart(4, '0')}`;
}

function isPosDocumentIdUsed(documentId, rows) {
    const target = String(documentId || '').toUpperCase();
    if (!target) return false;
    return (Array.isArray(rows) ? rows : []).some(row => {
        const id = String(row.id || '').toUpperCase();
        const invoiceId = String(row.invoiceId || '').toUpperCase();
        const itemId = String(row.itemId || '').toUpperCase();
        return id === target || invoiceId === target || itemId === target || itemId.startsWith(`${target}-`);
    });
}

function applyPosInvoiceManualAccess() {
    const input = document.getElementById('posTrxIdPreviewModern');
    if (!input) return;

    const canManual = isPosInvoiceManualOwner() && !window.editingTrxId;
    input.readOnly = !canManual;
    input.title = canManual
        ? 'Owner dapat mengisi manual. Contoh: INV-0001 atau 1.'
        : 'Nomor invoice otomatis. Hanya owner yang dapat mengisi manual.';
    input.placeholder = canManual ? 'INV-0001' : '[Otomatis]';
}

function nextPosDocumentId(prefix, storageKey) {
    const seq = getPosExistingDocumentMax(prefix) + 1;
    localStorage.setItem(storageKey, seq);
    return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

function peekPosDocumentId(prefix, storageKey) {
    const seq = getPosExistingDocumentMax(prefix) + 1;
    localStorage.setItem(storageKey, Math.max(0, seq - 1));
    return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

function getPosMonthlyLimitInfo(customerId, pendingJualTotal = 0) {
    const currencies = almaraStore.getCurrencies();
    const usd = currencies.find(c => String(c.code || '').toUpperCase() === 'USD');
    const usdRate = parseFloat(usd && (usd.sell || usd.buy || usd.base_sell || usd.base_buy)) || 0;
    const limit = usdRate > 0 ? POS_JUAL_MONTHLY_LIMIT_USD * usdRate : 0;
    const selectedMonthKey = getPosMonthKey(getPosDateFromInput());
    const editingId = window.editingTrxId || null;

    const used = almaraStore.getTransactions()
        .filter(t => String(t.tipe || '').toUpperCase() === 'JUAL')
        .filter(t => String(t.customerId || t.id_cif || '') === String(customerId || ''))
        .filter(t => !editingId || t.id !== editingId)
        .filter(t => getPosMonthKey(t.timestamp) === selectedMonthKey)
        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

    return {
        limit,
        usdRate,
        used,
        pending: pendingJualTotal,
        remaining: Math.max(limit - used, 0),
        exceeded: limit > 0 && (used + pendingJualTotal) > limit,
        monthKey: selectedMonthKey
    };
}

function buildPosMonthlyLimitMessage(info, customerId) {
    const customerObj = almaraStore.getCustomers().find(c => String(c.id_nasabah || '') === String(customerId || ''));
    const namaNasabah = customerObj ? customerObj.nama : customerId;
    return [
        `Penjualan untuk ${namaNasabah} sudah melewati batas bulanan.`,
        `Batas maksimal: ${POS_JUAL_MONTHLY_LIMIT_USD.toLocaleString('id-ID')} USD x kurs jual USD ${almaraUtils.formatRate(info.usdRate)} = ${almaraUtils.formatIdr(info.limit)}.`,
        `Sudah terpakai bulan ini: ${almaraUtils.formatIdr(info.used)}.`,
        `Tambahan transaksi ini: ${almaraUtils.formatIdr(info.pending)}.`,
        `Sisa limit: ${almaraUtils.formatIdr(info.remaining)}.`
    ].join('\n');
}

function showPosMonthlyLimitWarning(info, customerId) {
    const message = buildPosMonthlyLimitMessage(info, customerId);
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Limit Penjualan Bulanan',
            text: message,
            confirmButtonText: 'Mengerti'
        });
    } else {
        alert(message);
    }
}

function escapePosHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getCurrentUserCanOverridePosLimit() {
    const user = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
    const role = String(user && user.role ? user.role : '').toLowerCase();
    return role === 'owner' || role === 'admin';
}

function getMatchingPosLimitApproval(customerId, info) {
    const storedApproval = getPosLimitApprovalRequests().find(req => {
        const sameCustomer = String(req.customerId || '') === String(customerId || '');
        const sameMonth = req.monthKey === info.monthKey;
        const coversPending = (parseFloat(req.pending) || 0) >= (parseFloat(info.pending) || 0);
        return req.status === 'approved' && sameCustomer && sameMonth && coversPending;
    });
    if (storedApproval) return storedApproval;

    const approval = window._posMonthlyLimitApproval;
    if (!approval) return null;
    const sameCustomer = String(approval.customerId || '') === String(customerId || '');
    const sameMonth = approval.monthKey === info.monthKey;
    const coversPending = (parseFloat(approval.pending) || 0) >= (parseFloat(info.pending) || 0);
    return sameCustomer && sameMonth && coversPending ? approval : null;
}

function getPosLimitApprovalRequests() {
    try {
        const requests = JSON.parse(localStorage.getItem('mc_pos_limit_approvals'));
        return Array.isArray(requests) ? requests : [];
    } catch (error) {
        return [];
    }
}
window.getPosLimitApprovalRequests = getPosLimitApprovalRequests;

function normalizePosLimitApprovalList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return [];
}

function rememberPosLimitApprovalSeen(requestId, status) {
    if (!requestId || !status) return;
    const seen = window.safeArrayGet ? window.safeArrayGet('mc_pos_limit_approval_seen') : [];
    const key = `${requestId}:${status}`;
    if (!seen.includes(key)) {
        seen.push(key);
        localStorage.setItem('mc_pos_limit_approval_seen', JSON.stringify(seen.slice(-100)));
    }
}

function hasSeenPosLimitApproval(requestId, status) {
    const seen = window.safeArrayGet ? window.safeArrayGet('mc_pos_limit_approval_seen') : [];
    return seen.includes(`${requestId}:${status}`);
}

function mergePosLimitApprovalRequests(localRequests, remoteRequests) {
    const merged = new Map();
    [...normalizePosLimitApprovalList(localRequests), ...normalizePosLimitApprovalList(remoteRequests)].forEach(req => {
        if (!req || !req.id) return;
        const existing = merged.get(req.id);
        if (!existing) {
            merged.set(req.id, req);
            return;
        }
        const existingTime = new Date(existing.approvedAt || existing.rejectedAt || existing.requestedAt || 0).getTime();
        const nextTime = new Date(req.approvedAt || req.rejectedAt || req.requestedAt || 0).getTime();
        if ((nextTime || 0) >= (existingTime || 0)) {
            merged.set(req.id, { ...existing, ...req });
        }
    });
    return Array.from(merged.values());
}

function savePosLimitApprovalRequests(requests, options = {}) {
    const cleanRequests = Array.isArray(requests) ? requests : [];
    const previous = getPosLimitApprovalRequests();
    const next = mergePosLimitApprovalRequests(previous, cleanRequests);
    localStorage.setItem('mc_pos_limit_approvals', JSON.stringify(next));
    if (!options.skipPush && typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_pos_limit_approvals', next);
    }
    if (typeof window.updateHeaderNotificationBadge === 'function') window.updateHeaderNotificationBadge();
}
window.savePosLimitApprovalRequests = savePosLimitApprovalRequests;

async function refreshPosLimitApprovalsFromServer({ notify = false } = {}) {
    try {
        const response = await fetch(`api/datastore?approval_ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return getPosLimitApprovalRequests();
        const result = await response.json();
        const remote = normalizePosLimitApprovalList(result && result.data ? result.data.mc_pos_limit_approvals : []);
        if (!remote.length) return getPosLimitApprovalRequests();

        const currentUser = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
        const localBefore = getPosLimitApprovalRequests();
        const merged = mergePosLimitApprovalRequests(localBefore, remote);
        savePosLimitApprovalRequests(merged, { skipPush: true });

        if (notify && currentUser) {
            const mine = merged.filter(req => String(req.requestedByUserId || '') === String(currentUser.id || ''));
            const approved = mine.find(req => req.status === 'approved' && !hasSeenPosLimitApproval(req.id, 'approved'));
            const rejected = mine.find(req => req.status === 'rejected' && !hasSeenPosLimitApproval(req.id, 'rejected'));
            if (approved) {
                window._posMonthlyLimitApproval = approved;
                rememberPosLimitApprovalSeen(approved.id, 'approved');
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Approval Disetujui', 'Silakan lanjutkan transaksi tanpa refresh halaman. Keranjang tetap aman.', 'success');
                } else {
                    alert('Approval disetujui. Silakan lanjutkan transaksi tanpa refresh halaman.');
                }
            } else if (rejected) {
                rememberPosLimitApprovalSeen(rejected.id, 'rejected');
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Approval Ditolak', rejected.rejectNote || 'Permintaan limit ditolak admin/owner.', 'warning');
                } else {
                    alert('Approval ditolak admin/owner.');
                }
            }
        }
        return merged;
    } catch (error) {
        return getPosLimitApprovalRequests();
    }
}
window.refreshPosLimitApprovalsFromServer = refreshPosLimitApprovalsFromServer;

if (!window.__posLimitApprovalPollingStarted) {
    window.__posLimitApprovalPollingStarted = true;
    setInterval(() => {
        const user = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
        if (!user) return;
        refreshPosLimitApprovalsFromServer({ notify: true });
    }, 4000);
}

function getPendingPosLimitApprovalRequests() {
    return getPosLimitApprovalRequests().filter(req => req.status === 'pending');
}
window.getPendingPosLimitApprovalRequests = getPendingPosLimitApprovalRequests;

window.approvePosLimitRequest = function(requestId) {
    const currentUser = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
    const role = String(currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
    if (role !== 'owner' && role !== 'admin') {
        alert('Hanya admin/owner yang bisa menyetujui permintaan limit.');
        return;
    }

    const requests = getPosLimitApprovalRequests();
    const index = requests.findIndex(req => req.id === requestId);
    if (index < 0) return alert('Permintaan approval tidak ditemukan.');

    requests[index] = {
        ...requests[index],
        status: 'approved',
        approvedBy: currentUser && currentUser.fullName ? currentUser.fullName : 'Admin/Owner',
        approvedByRole: currentUser && currentUser.role ? currentUser.role : '',
        approvedAt: new Date().toISOString()
    };
    savePosLimitApprovalRequests(requests);
    if (typeof Swal !== 'undefined') Swal.fire('Disetujui', 'Permintaan limit sudah disetujui. Teller bisa melanjutkan transaksi.', 'success');
    else alert('Permintaan limit sudah disetujui.');
};

window.rejectPosLimitRequest = function(requestId) {
    const currentUser = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
    const role = String(currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
    if (role !== 'owner' && role !== 'admin') {
        alert('Hanya admin/owner yang bisa menolak permintaan limit.');
        return;
    }

    const rejectNow = (note = '') => {
        const requests = getPosLimitApprovalRequests();
        const index = requests.findIndex(req => req.id === requestId);
        if (index < 0) return alert('Permintaan approval tidak ditemukan.');
        requests[index] = {
            ...requests[index],
            status: 'rejected',
            rejectedBy: currentUser && currentUser.fullName ? currentUser.fullName : 'Admin/Owner',
            rejectedAt: new Date().toISOString(),
            rejectNote: note
        };
        savePosLimitApprovalRequests(requests);
        if (typeof Swal !== 'undefined') Swal.fire('Ditolak', 'Permintaan limit sudah ditolak.', 'info');
        else alert('Permintaan limit sudah ditolak.');
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'question',
            title: 'Tolak Permintaan?',
            input: 'text',
            inputPlaceholder: 'Catatan penolakan (opsional)',
            showCancelButton: true,
            confirmButtonText: 'Tolak',
            cancelButtonText: 'Batal'
        }).then(result => {
            if (result.isConfirmed) rejectNow(String(result.value || '').trim());
        });
    } else if (confirm('Tolak permintaan limit ini?')) {
        rejectNow('');
    }
};

function upsertPosLimitApprovalRequest(request) {
    const requests = getPosLimitApprovalRequests();
    const existingIndex = requests.findIndex(req =>
        req.status === 'pending'
        && String(req.customerId || '') === String(request.customerId || '')
        && req.monthKey === request.monthKey
        && String(req.requestedByUserId || '') === String(request.requestedByUserId || '')
    );

    if (existingIndex >= 0) {
        requests[existingIndex] = { ...requests[existingIndex], ...request, id: requests[existingIndex].id };
    } else {
        requests.push(request);
    }
    savePosLimitApprovalRequests(requests);
    return existingIndex >= 0 ? requests[existingIndex] : request;
}

function buildPosLimitApprovalPayload(info, customerId, underlying, approver = null) {
    const currentUser = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
    const customerObj = almaraStore.getCustomers().find(c => String(c.id_nasabah || '') === String(customerId || ''));
    return {
        id: `LIM-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        customerId,
        customerName: customerObj ? customerObj.nama : customerId,
        monthKey: info.monthKey,
        limitUsd: POS_JUAL_MONTHLY_LIMIT_USD,
        usdRate: info.usdRate,
        limit: info.limit,
        used: info.used,
        pending: info.pending,
        underlying,
        requestedByUserId: currentUser && currentUser.id ? currentUser.id : '',
        requestedBy: currentUser && currentUser.fullName ? currentUser.fullName : 'Kasir/Teller',
        requestedByRole: currentUser && currentUser.role ? currentUser.role : '',
        requestedAt: new Date().toISOString(),
        status: approver ? 'approved' : 'pending',
        approvedBy: approver && approver.fullName ? approver.fullName : '',
        approvedByRole: approver && approver.role ? approver.role : '',
        approvedAt: approver ? new Date().toISOString() : ''
    };
}

async function requestPosLimitOverride(info, customerId) {
    const currentUser = almaraAuth.getCurrentUser ? almaraAuth.getCurrentUser() : null;
    const canOverride = getCurrentUserCanOverridePosLimit();
    const message = `${buildPosMonthlyLimitMessage(info, customerId)}\n\nTransaksi ini membutuhkan underlying/persetujuan Owner/Admin.`;

    let underlying = '';
    if (typeof Swal !== 'undefined') {
        const result = canOverride
            ? await Swal.fire({
                icon: 'warning',
                title: 'Limit Terlampaui',
                text: message,
                input: 'textarea',
                inputLabel: 'Underlying / alasan persetujuan',
                inputPlaceholder: 'Contoh: transaksi korporasi, dokumen pendukung lengkap, approval owner...',
                inputAttributes: {
                    'aria-label': 'Underlying limit transaksi'
                },
                showCancelButton: true,
                confirmButtonText: 'Setujui & Lanjutkan',
                cancelButtonText: 'Batalkan',
                inputValidator: (value) => {
                    if (!String(value || '').trim()) return 'Underlying/alasan wajib diisi.';
                    return null;
                }
            })
            : await Swal.fire({
                icon: 'warning',
                title: 'Ajukan Persetujuan Admin/Owner',
                html: `
                    <div style="text-align:left; font-size:0.95rem; line-height:1.35; margin-bottom:12px; white-space:pre-line;">${escapePosHtml(message)}</div>
                    <textarea id="posLimitUnderlying" class="swal2-textarea" placeholder="Underlying / alasan persetujuan"></textarea>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Kirim Permintaan',
                cancelButtonText: 'Batalkan',
                preConfirm: () => {
                    const note = document.getElementById('posLimitUnderlying')?.value.trim() || '';
                    if (!note) {
                        Swal.showValidationMessage('Underlying/alasan wajib diisi.');
                        return false;
                    }
                    return { underlying: note };
                }
            });
        if (!result.isConfirmed) return null;
        if (canOverride) {
            underlying = String(result.value || '').trim();
        } else {
            underlying = result.value.underlying;
        }
    } else {
        if (!canOverride) {
            underlying = prompt(message + '\n\nIsi underlying/alasan untuk dikirim ke admin/owner:') || '';
        } else {
            underlying = prompt(message + '\n\nIsi underlying/alasan:') || '';
        }
        if (!underlying.trim()) {
            alert('Underlying/alasan wajib diisi.');
            return null;
        }
    }

    if (!canOverride) {
        upsertPosLimitApprovalRequest(buildPosLimitApprovalPayload(info, customerId, underlying, null));
        if (typeof Swal !== 'undefined') {
            Swal.fire('Permintaan Terkirim', 'Admin/Owner akan menerima notifikasi approval. Setelah disetujui, ulangi tambah/proses transaksi.', 'info');
        } else {
            alert('Permintaan approval sudah dikirim. Setelah disetujui, ulangi tambah/proses transaksi.');
        }
        return null;
    }

    const directApproval = buildPosLimitApprovalPayload(info, customerId, underlying, currentUser);
    const requests = getPosLimitApprovalRequests();
    requests.push(directApproval);
    savePosLimitApprovalRequests(requests);
    return directApproval;
}

async function ensurePosMonthlyLimitAllowed(customerId, pendingJualTotal) {
    if (pendingJualTotal <= 0) return true;

    await refreshPosLimitApprovalsFromServer({ notify: false });
    const limitInfo = getPosMonthlyLimitInfo(customerId, pendingJualTotal);
    if (!limitInfo.limit) {
        alert(`Kurs USD belum tersedia, limit ${POS_JUAL_MONTHLY_LIMIT_USD.toLocaleString('id-ID')} USD belum bisa dihitung. Lengkapi kurs USD di Manajemen Kurs terlebih dahulu.`);
        return false;
    }
    if (!limitInfo.exceeded) {
        return true;
    }

    const existingApproval = getMatchingPosLimitApproval(customerId, limitInfo);
    if (existingApproval) return true;

    const approval = await requestPosLimitOverride(limitInfo, customerId);
    if (!approval) return false;
    window._posMonthlyLimitApproval = approval;
    return true;
}

async function addToCart() {
    const type = document.getElementById('trxType').value;
    const curCode = document.getElementById('trxCurrency').value;
    const customerId = document.getElementById('trxCustomer').value;

    const amount = parseFloat(document.getElementById('trxAmount').value);
    const rate = parseFloat(document.getElementById('trxRate').value);

    if(!curCode || !amount || !rate) {
        alert("Mohon lengkapi form transaksi untuk dimasukkan ke keranjang.");
        updateAddToCartState();
        return;
    }

    const currencies = almaraStore.getCurrencies();
    const cur = currencies.find(c => c.code === curCode);
    
    if(!cur) {
        alert("Kode Valuta tidak valid. Silakan ketik kode yang benar (misal: USD).");
        return;
    }

    const totalIdr = amount * rate;

    // Limit Check for Cart (JUAL means we give out foreign currency)
    // We must calculate if total amount in cart + this amount > stock
    if(type === 'JUAL') {
        const cartAmount = currentCart.filter(item => item.curCode === curCode && item.type === 'JUAL').reduce((sum, item) => sum + item.amount, 0);
        const stockVal = parseFloat(cur.stock) || 0;
        if((cartAmount + amount) > stockVal) {
            const deficit = (cartAmount + amount) - stockVal;
            const confirmMsg = stockVal <= 0
                ? `Stok ${curCode} kosong, mau lanjut?`
                : `Stok ${curCode} tidak mencukupi (Tersedia: ${stockVal.toLocaleString()}, Kurang: ${deficit.toLocaleString()}), mau lanjut?`;
            
            let proceed = false;
            if (typeof Swal !== 'undefined') {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'Konfirmasi Stok',
                    text: confirmMsg,
                    showCancelButton: true,
                    confirmButtonText: 'OK',
                    cancelButtonText: 'Batal',
                    background: '#1e293b',
                    color: '#f8fafc',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33'
                });
                proceed = result.isConfirmed;
            } else {
                proceed = confirm(confirmMsg);
            }
            if (!proceed) {
                return;
            }
        }

        const pendingJualTotal = currentCart
            .filter(item => item.type === 'JUAL')
            .reduce((sum, item) => sum + item.totalIdr, totalIdr);
        if (customerId) {
            const limitAllowed = await ensurePosMonthlyLimitAllowed(customerId, pendingJualTotal);
            if (!limitAllowed) {
                return;
            }
        }
    }

    currentCart.push({
        id: Date.now().toString(),
        type, 
        curCode, 
        amount, 
        rate, 
        totalIdr
    });

    renderCart();
    resetPosTradeEntryOnly();
    setActivePosDraftPrintContext(null, null);
    scheduleSaveActivePosDraft();

    // Hide print buttons whenever cart is modified
    if (typeof window.setPosPrintButtonsVisibility === 'function') {
        window.setPosPrintButtonsVisibility(false);
    }
}

function removeFromCart(id) {
    currentCart = currentCart.filter(item => item.id !== id);
    renderCart();
    setActivePosDraftPrintContext(null, null);
    scheduleSaveActivePosDraft();
    if (typeof window.setPosPrintButtonsVisibility === 'function') {
        window.setPosPrintButtonsVisibility(false);
    }
}

function renderCart() {
    const cartContainer = document.getElementById('cartContainer');
    const buyCartContainer = document.getElementById('posBuyCartContainer');
    const sellCartContainer = document.getElementById('posSellCartContainer');
    const grandTotalNode = document.getElementById('grandTotalIdr');
    const processBtn = document.getElementById('btnProcessPayment');
    
    let grandTotal = 0;
    let html = '';

    const renderCartRows = (items, emptyText) => {
        if (!items.length) {
            return `<div class="pos-empty-cart">${emptyText}</div>`;
        }

        return items.map(item => `
            <div class="pos-cart-row">
                <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                    <span class="badge ${item.type === 'BELI' ? 'bg-green' : 'bg-red'}" style="font-size: 0.65rem; padding: 2px 4px;">${item.type[0]}</span>
                    <strong>${item.curCode}</strong>
                </div>
                <div>${item.amount.toLocaleString()}</div>
                <div style="color: #94A3B8;">@${item.rate.toLocaleString()}</div>
                <div style="font-weight: 800; color: ${item.type === 'JUAL' ? '#10B981' : '#F87171'};">
                    ${item.type === 'JUAL' ? '+' : '-'}${almaraUtils.formatIdr(item.totalIdr).replace(/[^\d.,]/g, '')}
                </div>
                <div style="text-align: right;">
                    <button class="btn btn-sm" style="color: #F87171; padding: 0;" onclick="removeFromCart('${item.id}')"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `).join('');
    };

    if(currentCart.length === 0) {
        html = '<div style="text-align: center; color: #94A3B8; padding: 10px;">Keranjang Kosong</div>';
        if (grandTotalNode) grandTotalNode.textContent = 'Rp 0';
    } else {
        currentCart.forEach(item => {
            let sign = item.type === 'JUAL' ? 1 : -1;
            grandTotal += (item.totalIdr * sign);

            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="flex: 2; display: flex; align-items: center; gap: 5px;">
                        <span class="badge ${item.type === 'BELI' ? 'bg-green' : 'bg-red'}" style="font-size: 0.65rem; padding: 2px 4px;">${item.type[0]}</span>
                        <strong>${item.curCode}</strong>
                    </div>
                    <div style="flex: 1; text-align: center;">${item.amount.toLocaleString()}</div>
                    <div style="flex: 1.5; text-align: center; font-size: 0.8rem; color: #94A3B8;">@${item.rate.toLocaleString()}</div>
                    <div style="flex: 2; text-align: right; font-weight: bold; color: ${item.type === 'JUAL' ? '#10B981' : '#F87171'};">
                        ${item.type === 'JUAL' ? '+' : '-'}${almaraUtils.formatIdr(item.totalIdr).replace(/[^\d.,]/g, '')}
                    </div>
                    <div style="width: 25px; text-align: right;">
                        <button class="btn btn-sm" style="color: #F87171; padding: 0;" onclick="removeFromCart('${item.id}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
            `;
        });
        
        if (grandTotalNode) {
            grandTotalNode.textContent = almaraUtils.formatIdr(Math.abs(grandTotal));
            grandTotalNode.style.color = grandTotal < 0 ? '#F87171' : '#10B981';
        }
        
    }

    if (cartContainer) cartContainer.innerHTML = html;
    if (buyCartContainer) {
        buyCartContainer.innerHTML = renderCartRows(currentCart.filter(item => item.type === 'BELI'), 'Belum ada pembelian valas');
    }
    if (sellCartContainer) {
        sellCartContainer.innerHTML = renderCartRows(currentCart.filter(item => item.type === 'JUAL'), 'Belum ada penjualan valas');
    }

    if (typeof window.recalculatePosGrandTotal === 'function') {
        window.recalculatePosGrandTotal();
    }
    updateProcessPaymentState();
}

function readPosFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        if(!file) return resolve('');
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Gagal membaca file bukti transfer.'));
        reader.readAsDataURL(file);
    });
}

async function processPayment() {
    if(currentCart.length === 0) {
        alert('Keranjang transaksi masih kosong.');
        return;
    }
    if (!document.getElementById('trxCustomer')?.value) {
        alert('Pilih data nasabah terlebih dahulu.');
        updateProcessPaymentState();
        return;
    }

    const customerIdForLimit = document.getElementById('trxCustomer').value;
    const pendingJualTotalForLimit = currentCart
        .filter(item => item.type === 'JUAL')
        .reduce((sum, item) => sum + item.totalIdr, 0);
    if (pendingJualTotalForLimit > 0 && customerIdForLimit) {
        const limitAllowed = await ensurePosMonthlyLimitAllowed(customerIdForLimit, pendingJualTotalForLimit);
        if (!limitAllowed) return;
    }

    // Calculate Grand Total from Cart
    let grandTotal = 0; // Negative means MC pays out IDR, Positive means MC receives IDR
    currentCart.forEach(item => {
        let sign = item.type === 'JUAL' ? 1 : -1;
        grandTotal += (item.totalIdr * sign);
    });

    const discount = parseFloat(document.getElementById('posDiscountModern')?.value) || 0;
    const fee = parseFloat(document.getElementById('posFeeModern')?.value) || 0;
    
    if (grandTotal >= 0) {
        grandTotal = grandTotal - discount + fee;
    } else {
        grandTotal = grandTotal + fee - discount;
    }

    const checkoutType = document.getElementById('checkoutType') ? document.getElementById('checkoutType').value : 'CASH';
    window.updatePosWaGatewayOption();
    const sendThankYouViaGateway = Boolean(document.getElementById('posSendWaGateway')?.checked);
    let dpAmountVal = 0;
    let remainingAmountVal = 0;
    let requiredPayment = grandTotal;
    
    if (checkoutType === 'BOOKING') {
        dpAmountVal = parseFloat(document.getElementById('dpAmount').value) || 0;
        const absGt = Math.abs(grandTotal);
        if (dpAmountVal > absGt) dpAmountVal = absGt;
        
        let sign = grandTotal < 0 ? -1 : 1;
        requiredPayment = dpAmountVal * sign;
        remainingAmountVal = absGt - dpAmountVal;
    }

    const paymentMethod = document.getElementById('paymentMethod').value;
    let payCash = 0;
    let payTransfer = 0;
    let transferProofFile = null;

    if (paymentMethod === 'CASH') {
        payCash = requiredPayment;
    } else if (paymentMethod === 'TRANSFER') {
        transferProofFile = document.getElementById('transferProof').files[0];
        payTransfer = requiredPayment;
    } else if (paymentMethod === 'SPLIT') {
        const splitCashVal = parseFloat(document.getElementById('splitCashAmount').value) || 0;
        const splitTransferVal = parseFloat(document.getElementById('splitTransferAmount').value) || 0;
        transferProofFile = document.getElementById('splitTransferProof').files[0];
        
        // Let's enforce that if we are paying out to customer (negative grandTotal),
        // the split should represent amounts out.
        // For simplicity, let's work in absolutes for the split.
        const absReq = Math.abs(requiredPayment);
        
        if(Math.abs((splitCashVal + splitTransferVal) - absReq) > 1) { // allow small precision difference
            alert("Total Tunai dan Transfer harus sama dengan Jumlah Bayar (Grand Total / DP)!");
            return;
        }
        
        let absCash = splitCashVal;
        let absTransfer = splitTransferVal;
        
        // Apply signing for the balances
        let sign = grandTotal < 0 ? -1 : 1;
        payCash = absCash * sign;
        payTransfer = absTransfer * sign;
    }

    let cash = almaraStore.getCash();
    let bankBCA = almaraStore.getBankBCA();
    let bankMandiri = almaraStore.getBankMandiri();
    const bankTgt = document.getElementById('transferBankTarget').value || 'BCA';
    
    const currencies = almaraStore.getCurrencies();
    let trxs = almaraStore.getTransactions();
    let mutations = almaraStore.getMutations();

    // =============== REVERSE OLD TRANSACTION (EDIT MODE) =================
    if (window.editingTrxId) {
        const oldTrxGroup = trxs.filter(t => t.id === window.editingTrxId);
        if (oldTrxGroup.length > 0) {
            let oldGrandTotal = 0;
            oldTrxGroup.forEach(t => {
                const curIdx = currencies.findIndex(c => c.code === t.valuta);
                if(curIdx > -1) {
                    if(t.tipe === 'JUAL') currencies[curIdx].stock += t.nominal;
                    else currencies[curIdx].stock -= t.nominal;
                }
                let sign = t.tipe === 'JUAL' ? 1 : -1;
                oldGrandTotal += (t.total * sign);
            });
            const oldPayMethod = oldTrxGroup[0].paymentMethod;
            const oldBankTgt = oldTrxGroup[0].bank || 'BCA';
            if (oldPayMethod === 'TRANSFER') {
                if (oldBankTgt === 'BCA') bankBCA -= oldGrandTotal;
                else bankMandiri -= oldGrandTotal;
            } else {
                cash -= oldGrandTotal;
            }
            
            // Remove old from memory arrays temporarily
            trxs = trxs.filter(t => t.id !== window.editingTrxId);
            mutations = mutations.filter(m => !m.keterangan || (m.keterangan && !m.keterangan.includes(window.editingTrxId)));
        }
    }
    // =====================================================================

    const currentBankBalance = bankTgt === 'BCA' ? bankBCA : bankMandiri;

    // Check if we have enough IDR reserves for BELI (paying out IDR)
    if(grandTotal < 0) {
        if((cash + payCash) < 0) { // payCash is negative here
            const deficit = Math.abs(payCash) - cash;
            const confirmMsg = `Kas Tunai tidak mencukupi! Sisa Kas: ${almaraUtils.formatIdr(cash)}, Kurang: ${almaraUtils.formatIdr(deficit)}. Tetap lanjutkan?`;
            let proceed = false;
            if (typeof Swal !== 'undefined') {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'Konfirmasi Kas Tunai',
                    text: confirmMsg,
                    showCancelButton: true,
                    confirmButtonText: 'Lanjut',
                    cancelButtonText: 'Batal',
                    background: '#1e293b',
                    color: '#f8fafc',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33'
                });
                proceed = result.isConfirmed;
            } else {
                proceed = confirm(confirmMsg);
            }
            if (!proceed) {
                return;
            }
        }
        if((currentBankBalance + payTransfer) < 0) {
            const deficit = Math.abs(payTransfer) - currentBankBalance;
            const confirmMsg = `Saldo Bank ${bankTgt} tidak mencukupi! Saldo Bank: ${almaraUtils.formatIdr(currentBankBalance)}, Kurang: ${almaraUtils.formatIdr(deficit)}. Tetap lanjutkan?`;
            let proceed = false;
            if (typeof Swal !== 'undefined') {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'Konfirmasi Saldo Bank',
                    text: confirmMsg,
                    showCancelButton: true,
                    confirmButtonText: 'Lanjut',
                    cancelButtonText: 'Batal',
                    background: '#1e293b',
                    color: '#f8fafc',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33'
                });
                proceed = result.isConfirmed;
            } else {
                proceed = confirm(confirmMsg);
            }
            if (!proceed) {
                return;
            }
        }
    }

    // Save Transactions (group by a single receipt/booking id)
    let receiptId = window.editingTrxId;
    if (!receiptId) {
        if (checkoutType === 'BOOKING') {
            receiptId = nextPosDocumentId('BKG', 'mc_booking_seq');
        } else {
            const manualInput = document.getElementById('posTrxIdPreviewModern');
            const manualInvoice = isPosInvoiceManualOwner() ? normalizeManualInvoiceId(manualInput?.value) : '';

            if (manualInvoice === null) {
                alert('Format No. Invoice manual tidak valid. Gunakan contoh: INV-0001 atau cukup angka 1.');
                return;
            }

            receiptId = manualInvoice || nextPosDocumentId('INV', 'mc_invoice_seq');
            if (isPosDocumentIdUsed(receiptId, trxs)) {
                alert(`No. Invoice ${receiptId} sudah digunakan. Silakan gunakan nomor lain.`);
                return;
            }

            if (manualInput) manualInput.value = receiptId;
            const manualSeq = parseInt(String(receiptId).replace('INV-', ''), 10);
            const currentSeq = parseInt(localStorage.getItem('mc_invoice_seq')) || 0;
            if (Number.isFinite(manualSeq) && manualSeq > currentSeq) {
                localStorage.setItem('mc_invoice_seq', manualSeq);
            }
        }
    }

    // Currencies sudah di-load di atas

    // Deduct stock for all items
    for(let item of currentCart) {
        const curIndex = currencies.findIndex(c => c.code === item.curCode);
        if(item.type === 'JUAL') {
            currencies[curIndex].stock -= item.amount;
        } else {
            currencies[curIndex].stock += item.amount;
        }
    }

    let transferProofUrl = null;
    if (transferProofFile && typeof window.uploadBase64FileToFolder === 'function') {
        try {
            const proofDataUrl = await readPosFileAsDataUrl(transferProofFile);
            transferProofUrl = await window.uploadBase64FileToFolder(proofDataUrl, 'transactions/proofs', `${receiptId}-bukti-transfer`);
        } catch (uploadError) {
            alert("Gagal upload bukti transfer: " + (uploadError.message || uploadError));
            return;
        }
    }

    let underlyingFileUrl = null;
    const underlyingFile = document.getElementById('trxUnderlyingFile')?.files?.[0] || null;
    if (underlyingFile) {
        try {
            const underlyingDataUrl = await readPosFileAsDataUrl(underlyingFile);
            if (typeof window.uploadBase64FileToFolder === 'function') {
                underlyingFileUrl = await window.uploadBase64FileToFolder(underlyingDataUrl, 'transactions/underlying', `${receiptId}-underlying`);
            } else {
                const response = await fetch('api/uploads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                    },
                    body: JSON.stringify({
                        category: 'transactions/underlying',
                        data_url: underlyingDataUrl,
                        filename: `${receiptId}-underlying`
                    })
                });
                if (response.ok) {
                    const res = await response.json();
                    underlyingFileUrl = res.url;
                }
            }
        } catch (uploadError) {
            alert("Gagal upload underlying: " + (uploadError.message || uploadError));
            return;
        }
    }

    let customerPhotoUrl = null;
    const custPhotoPreview = document.getElementById('trxCustomerPhotoPreview');
    if (custPhotoPreview && custPhotoPreview.style.display !== 'none' && custPhotoPreview.src.startsWith('data:')) {
        try {
            if (typeof window.uploadBase64FileToFolder === 'function') {
                customerPhotoUrl = await window.uploadBase64FileToFolder(custPhotoPreview.src, 'transactions/proofs', `${receiptId}-wajah-nasabah`);
            } else {
                const response = await fetch('api/uploads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                    },
                    body: JSON.stringify({
                        category: 'transactions/proofs',
                        data_url: custPhotoPreview.src,
                        filename: `${receiptId}-wajah-nasabah`
                    })
                });
                if (response.ok) {
                    const res = await response.json();
                    customerPhotoUrl = res.url;
                }
            }
        } catch (uploadError) {
            console.error("Gagal upload foto wajah nasabah:", uploadError);
            alert("Gagal upload foto wajah nasabah: " + (uploadError.message || uploadError));
        }
    }

    // Apply Balances
    cash += payCash;
    if(bankTgt === 'BCA') bankBCA += payTransfer;
    else bankMandiri += payTransfer;

    let finalTimestamp = window.editingTrxTimestamp || new Date().toISOString();
    const checkoutDateEl = document.getElementById('trxCheckoutDate');
    if(checkoutDateEl && checkoutDateEl.value && !window.editingTrxTimestamp) {
        const currTime = new Date().toISOString().substring(11);
        finalTimestamp = checkoutDateEl.value + 'T' + currTime;
    }

    // Log Bank Mutation if involved
    if(Math.abs(payTransfer) > 0) {
        // mutations sudah di-load dan disesuaikan di atas
        mutations.push({
            id_mutasi: 'MUT-' + Date.now().toString().slice(-6),
            timestamp: finalTimestamp,
            tipe: payTransfer > 0 ? 'MASUK' : 'KELUAR',
            nominal: Math.abs(payTransfer),
            keterangan: `Transaksi Valas (Ref: ${receiptId})`,
            bank: bankTgt
        });
        almaraStore.saveMutations(mutations);
    }

    almaraStore.saveCurrencies(currencies);
    almaraStore.saveCash(cash);
    almaraStore.saveBankBCA(bankBCA);
    almaraStore.saveBankMandiri(bankMandiri);

    const currentUser = almaraAuth.getCurrentUser();
    const inputByUser = window.editingTrxInputBy || (currentUser && currentUser.fullName ? currentUser.fullName : 'Admin Kasir');
    const editByUser = window.editingTrxId ? (currentUser && currentUser.fullName ? currentUser.fullName : 'Admin Kasir') : '';

    window.editingTrxId = null; // Clear edit state after success
    window.editingTrxTimestamp = null;
    window.editingTrxInputBy = null;
    
    // trxs sudah di-load dan disesuaikan di atas
    const customerId = document.getElementById('trxCustomer').value;
    let rawReceiverId = document.getElementById('trxReceiver') ? document.getElementById('trxReceiver').value : 'SAME';
    const receiverManualName = document.getElementById('trxReceiverManual') ? document.getElementById('trxReceiverManual').value.trim() : '';
    const transactionPurpose = document.getElementById('trxTransactionPurpose')?.value || 'PERJALANAN_WISATA';
    const sourceOfFunds = document.getElementById('trxSourceOfFunds')?.value || 'GAJI';
    if (rawReceiverId === 'MANUAL' && !receiverManualName) {
        alert('Isi nama pengambil valas manual terlebih dahulu.');
        return;
    }
    const receiverId = (rawReceiverId === 'SAME') ? (customerId || null) : (rawReceiverId === 'MANUAL' ? null : rawReceiverId);
    const limitApproval = customerId
        ? getMatchingPosLimitApproval(customerId, getPosMonthlyLimitInfo(customerId, pendingJualTotalForLimit))
        : null;
    
    const notesVal = document.getElementById('trxKeteranganModern')?.value.trim() || '';
    let notesList = [];
    if (notesVal) notesList.push(notesVal);
    if (discount > 0) notesList.push(`Diskon: ${almaraUtils.formatIdr(discount)}`);
    if (fee > 0) notesList.push(`Biaya Lain: ${almaraUtils.formatIdr(fee)}`);
    const finalKeterangan = notesList.join(' | ');

    const newTransactionRows = [];
    currentCart.forEach((item, index) => {
        const transactionRow = {
            id: receiptId,    // Use same receipt ID to group
            itemId: (item.id && String(item.id).startsWith(receiptId))
                ? item.id
                : `${receiptId}-${String(item.id || 'ITEM').replace(/\s+/g, '')}-${String(index + 1).padStart(2, '0')}`,
            sourceItemId: item.id,
            timestamp: finalTimestamp,
            tipe: item.type,
            valuta: item.curCode,
            nominal: item.amount,
            rate: item.rate,
            total: item.totalIdr,
            kasir: currentUser && currentUser.fullName ? currentUser.fullName : 'Admin Kasir',
            inputBy: inputByUser,
            editBy: editByUser,
            customerId: customerId && customerId !== '-' ? customerId : null,
            receiverId: receiverId && receiverId !== '-' ? receiverId : null,
            receiverManualName: rawReceiverId === 'MANUAL' ? receiverManualName : null,
            transactionPurpose,
            sourceOfFunds,
            paymentMethod: paymentMethod,
            bank: (paymentMethod === 'TRANSFER' || paymentMethod === 'SPLIT') ? bankTgt : null,
            transferProof: transferProofUrl,
            underlyingFile: underlyingFileUrl,
            customerPhoto: customerPhotoUrl,
            keterangan: finalKeterangan,
            // Mode Booking Data
            tipe_transaksi: checkoutType, // 'CASH' or 'BOOKING'
            status: checkoutType === 'BOOKING' ? 'PENDING' : 'LUNAS',
            bookingId: checkoutType === 'BOOKING' ? receiptId : null,
            invoiceId: checkoutType === 'BOOKING' ? null : receiptId,
            dpAmount: checkoutType === 'BOOKING' ? dpAmountVal : 0,
            remainingAmount: checkoutType === 'BOOKING' ? remainingAmountVal : 0,
            limitExceeded: Boolean(limitApproval && item.type === 'JUAL'),
            limitUsd: limitApproval && item.type === 'JUAL' ? limitApproval.limitUsd : null,
            limitIdr: limitApproval && item.type === 'JUAL' ? limitApproval.limit : null,
            limitUsedIdr: limitApproval && item.type === 'JUAL' ? limitApproval.used : null,
            limitPendingIdr: limitApproval && item.type === 'JUAL' ? limitApproval.pending : null,
            limitUnderlying: limitApproval && item.type === 'JUAL' ? limitApproval.underlying : null,
            limitRequestedBy: limitApproval && item.type === 'JUAL' ? limitApproval.requestedBy : null,
            limitApprovedBy: limitApproval && item.type === 'JUAL' ? limitApproval.approvedBy : null,
            limitApprovedByRole: limitApproval && item.type === 'JUAL' ? limitApproval.approvedByRole : null,
            limitApprovedAt: limitApproval && item.type === 'JUAL' ? limitApproval.approvedAt : null
        };
        newTransactionRows.push(transactionRow);
    });

    if (checkoutType === 'BOOKING') {
        const bookings = typeof almaraStore.getBookings === 'function' ? almaraStore.getBookings() : window.safeArrayGet('mc_bookings');
        almaraStore.saveBookings([...(Array.isArray(bookings) ? bookings : []), ...newTransactionRows]);
    } else {
        newTransactionRows.forEach(row => trxs.push(row));
        window.__almaraSuppressAutoTransactionPush = true;
        window.__almaraPendingTransactionIds = newTransactionRows.map(t => String(t.itemId || t.id));

        try {
            almaraStore.saveTransactions(trxs);
            const runBackgroundTransactionSync = async () => {
                let transactionSyncWarning = '';
                try {
                    if (typeof window.pushTransactionsToMySQL === 'function') {
                        const syncResults = await window.pushTransactionsToMySQL(newTransactionRows);
                        const failedSync = syncResults.find(result => !result || !result.ok);
                        if (failedSync) {
                            transactionSyncWarning = "\n\nCatatan: transaksi sudah tersimpan di browser, tetapi belum masuk database. Pesan: " + (failedSync.message || 'koneksi/server belum merespons');
                        }
                    } else if (typeof window.saveToMySQL_Transaction === 'function') {
                        const syncResults = [];
                        for (const trx of newTransactionRows) {
                            syncResults.push(await window.saveToMySQL_Transaction(trx));
                        }
                        const failedSync = syncResults.find(result => !result || !result.ok);
                        if (failedSync) {
                            transactionSyncWarning = "\n\nCatatan: transaksi sudah tersimpan di browser, tetapi belum masuk database. Pesan: " + (failedSync.message || 'koneksi/server belum merespons');
                        }
                    }

                    if (typeof window.syncFromMySQL_Transactions === 'function') {
                        await window.syncFromMySQL_Transactions({ pushLocal: false, refreshUi: true, silent: true, force: true });
                    }

                    if (transactionSyncWarning) {
                        console.warn(transactionSyncWarning.trim());
                    }
                } catch (syncError) {
                    console.warn('Background transaction sync skipped:', syncError);
                }
            };
            setTimeout(runBackgroundTransactionSync, 0);
        } finally {
            window.__almaraSuppressAutoTransactionPush = false;
            window.__almaraPendingTransactionIds = [];
        }
    }

    alert(`${checkoutType === 'BOOKING' ? 'Booking' : 'Pembayaran'} Berhasil! (Disimpan dengan ref: ${receiptId})`);

    
    // Setup Print Button
    if (typeof window.setPosPrintButtonsVisibility === 'function') {
        window.setPosPrintButtonsVisibility(true);
    }
    const printBtn = document.getElementById('btnPrintReceipt');
    const invoiceBtn = document.getElementById('btnPrintInvoice');
    const waBtn = document.getElementById('btnSendWA');
    
    // Create a copy of the cart for printing
    const printCart = [...currentCart];
    const printSummary = {
        receiptId,
        paymentMethod,
        grandTotal,
        payCash,
        payTransfer,
        customerId: customerId && customerId !== '-' ? customerId : null,
        receiverId: receiverId && receiverId !== '-' ? receiverId : null,
        receiverManualName: rawReceiverId === 'MANUAL' ? receiverManualName : null,
        transactionPurpose,
        sourceOfFunds,
        timestamp: finalTimestamp,
        kasir: currentUser && currentUser.fullName ? currentUser.fullName : 'Admin Kasir'
    };
    window._posLastProcessedCustomerId = customerId && customerId !== '-' ? customerId : '';
    setActivePosDraftPrintContext(printCart, printSummary);

    printBtn.onclick = () => printReceipt(printCart, printSummary);
    if (invoiceBtn) invoiceBtn.onclick = () => printInvoice(printCart, printSummary);
    if(waBtn) waBtn.onclick = () => sendWhatsAppReceipt(printCart, printSummary);

    if (sendThankYouViaGateway && checkoutType !== 'BOOKING') {
        sendPosThankYouViaGateway(printSummary)
            .then(() => alert('Ucapan terima kasih berhasil dikirim melalui WA Gateway.'))
            .catch((error) => {
                console.error('WA Gateway pengiriman otomatis gagal:', error);
                alert(`Transaksi tersimpan, tetapi WA otomatis gagal dikirim: ${error.message || 'periksa pengaturan Gateway.'}`);
            });
    }

    const sessions = getPosDraftSessions();
    const activeId = getActivePosDraftId();
    const idx = sessions.findIndex(s => s.id === activeId);
    if (idx >= 0) {
        const completedSnapshot = collectPosDraftFromForm();
        completedSnapshot.id = activeId;
        completedSnapshot.completed = true;
        completedSnapshot.completedAt = finalTimestamp;
        completedSnapshot.label = sessions[idx].label || completedSnapshot.label;
        completedSnapshot.cart = [...printCart];
        completedSnapshot.lastPrint = {
            cart: [...printCart],
            summary: { ...printSummary }
        };
        completedSnapshot.fields = {
            ...(completedSnapshot.fields || {}),
            invoice: receiptId,
            customer: customerId || '',
            customerSearch: document.getElementById('posCustomerSearchModern')?.value || '',
            paymentMethod,
            transactionPurpose,
            sourceOfFunds,
            bank: (paymentMethod === 'TRANSFER' || paymentMethod === 'SPLIT') ? bankTgt : 'BCA'
        };
        sessions[idx] = completedSnapshot;
        savePosDraftSessions(sessions);
        setActivePosDraftId(activeId);
        applyPosDraftToForm(sessions[idx]);
    }

    updateProcessPaymentState();
    loadDashboard(); // Refresh Dashboard figures
    if (typeof loadReportsTable === 'function') loadReportsTable();
    if (typeof window.refreshActiveRealtimeViews === 'function') window.refreshActiveRealtimeViews();
}

async function sendWhatsAppReceipt(cart, summary) {
    const profile = almaraStore.getProfile();
    const assignedTemplate = typeof window.getWaTemplateForPurpose === 'function'
        ? window.getWaTemplateForPurpose('pos')
        : null;
    let waTemplate = assignedTemplate?.content || profile.waTemplate || DEFAULT_WA_TEMPLATE;
    
    // Process [VALUTA_LIST]
    let valutaListText = '';
    cart.forEach(item => {
        valutaListText += `- ${item.type} ${item.amount.toLocaleString()} ${item.curCode} \n  (@ ${almaraUtils.formatRate(item.rate)}) = ${almaraUtils.formatIdr(item.totalIdr)}\n`;
    });
    
    // Process [METODE_RINCIAN]
    let metodeRincianText = '';
    if(summary.paymentMethod === 'SPLIT') {
        metodeRincianText += `  - Tunai: ${almaraUtils.formatIdr(Math.abs(summary.payCash))}\n`;
        metodeRincianText += `  - Transfer: ${almaraUtils.formatIdr(Math.abs(summary.payTransfer))}\n`;
    }
    
    const customers = almaraStore.getCustomers();
    const customer = summary.customerId ? customers.find(c => c.id_nasabah === summary.customerId) : null;
    const custName = customer ? (customer.nama || 'Pelanggan') : 'Pelanggan';
    
    let text = waTemplate
        .replace(/\[NAMA_NASABAH\]/gi, custName)
        .replace(/\[PELANGGAN\]/gi, custName)
        .replace(/\[NASABAH\]/gi, custName)
        .replace(/\[NAMA\]/gi, custName)
        .replace(/\[NAMA_MC\]/gi, profile.name)
        .replace(/\[NO_HP_MC\]/gi, profile.phone !== '-' ? profile.phone : '')
        .replace(/\[NO_INVOICE\]/gi, summary.receiptId)
        .replace(/\[TANGGAL\]/gi, almaraUtils.formatDateToDMY(summary.timestamp))
        .replace(/\[GRAND_TOTAL\]/gi, almaraUtils.formatIdr(Math.abs(summary.grandTotal)))
        .replace(/\[METODE_BAYAR\]/gi, summary.paymentMethod)
        .replace(/\[VALUTA_LIST\]/gi, valutaListText.trim())
        .replace(/\[METODE_RINCIAN\]/gi, metodeRincianText.trim());

    // Clean up excessive empty lines
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');

    let phone = '';
    if (customer && customer.no_hp) {
        phone = customer.no_hp.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    }
    
    try {
        await window.sendWhatsAppGateway(phone, text, { reference: summary.receiptId });
        alert('Pesan WhatsApp berhasil dikirim melalui Gateway.');
    } catch (error) {
        alert(`Gagal mengirim WhatsApp: ${error.message || error}`);
    }
}

const PRINT_DECIMAL_RATE_CURRENCIES = new Set(['VND', 'KRW', 'JPY', 'IQD', 'THB', 'TWD']);
function formatPrintRate(rate, currencyCode = '') {
    const value = Number(rate);
    if (!Number.isFinite(value)) return '0';
    const code = String(currencyCode || '').toUpperCase();
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: PRINT_DECIMAL_RATE_CURRENCIES.has(code) ? 4 : 0
    }).format(value);
}

function printReceipt(cart, summary) {
    const profile = almaraStore.getProfile();
    const customers = almaraStore.getCustomers();
    const cust = customers.find(c => c.id_nasabah === summary.customerId) || {};
    const custName = cust.nama || 'Pengunjung Biasa';
    let custPhone = cust.no_hp || '-';
    if(custPhone !== '-') custPhone = custPhone.length > 3 ? custPhone.slice(0, -3) + '***' : '***';
    const custCitizenship = cust.kewarganegaraan || '-';
    
    const recIdToUse = summary.receiverId || summary.customerId;
    const rec = recIdToUse === summary.customerId ? cust : (customers.find(c => c.id_nasabah === recIdToUse) || {});
    const recName = summary.receiverManualName || (recIdToUse === summary.customerId ? custName : (rec.nama || 'Pengunjung Biasa'));

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    // Generate Items HTML: Kelompokkan BELI dan JUAL
    let itemsHtml = `
        <div class="row" style="font-weight:bold; border-bottom:1px solid #000; margin-bottom:4px; font-size:16px;">
            <span>Rincian Transaksi</span>
            <span style="text-align:right;">Total (IDR)</span>
        </div>
    `;
    const beliCart = cart.filter(i => i.type === 'BELI');
    const jualCart = cart.filter(i => i.type === 'JUAL');
    const isMixed = beliCart.length > 0 && jualCart.length > 0;
    let totalBeli = 0;
    let totalJual = 0;
    
    if (beliCart.length > 0) {
        itemsHtml += '<div style="font-weight:bold; margin:3px 0 4px; font-size:17px; border-bottom:1px dashed #000;">BELI</div>';

        itemsHtml += beliCart.map(item => {
            totalBeli += item.totalIdr;
            return `
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; font-size: 17px; margin-bottom: 5px; line-height: 1.2;">
                <span style="flex-shrink: 0; margin-right: 10px;">${item.curCode} ${item.amount.toLocaleString('id-ID')} @ ${formatPrintRate(item.rate, item.curCode)}</span>
                <span style="flex-grow: 1; text-align: right; font-weight: bold;">${almaraUtils.formatIdr(item.totalIdr)}</span>
            </div>
            `;
        }).join('');

        if (isMixed || beliCart.length > 1) {
            itemsHtml += `
                <div class="row" style="font-weight:bold;">
                    <span>Total Beli</span>
                    <span>${almaraUtils.formatIdr(totalBeli)}</span>
                </div>
            `;
        }
    }
    
    if (isMixed) {
        itemsHtml += '<div class="divider" style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>';
    }
    
    if (jualCart.length > 0) {
        itemsHtml += '<div style="font-weight:bold; margin:3px 0 4px; font-size:17px; border-bottom:1px dashed #000;">JUAL</div>';

        itemsHtml += jualCart.map(item => {
            totalJual += item.totalIdr;
            return `
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; font-size: 17px; margin-bottom: 5px; line-height: 1.2;">
                <span style="flex-shrink: 0; margin-right: 10px;">${item.curCode} ${item.amount.toLocaleString('id-ID')} @ ${formatPrintRate(item.rate, item.curCode)}</span>
                <span style="flex-grow: 1; text-align: right; font-weight: bold;">${almaraUtils.formatIdr(item.totalIdr)}</span>
            </div>
            `;
        }).join('');

        if (isMixed || jualCart.length > 1) {
            itemsHtml += `
                <div class="row" style="font-weight:bold;">
                    <span>Total Jual</span>
                    <span>${almaraUtils.formatIdr(totalJual)}</span>
                </div>
            `;
        }
    }
    if (isMixed) {
        const netTotal = totalJual - totalBeli;
        itemsHtml += `
            <div class="divider" style="border-bottom: 1px dashed #000; margin: 4px 0;"></div>
            <div class="row" style="font-weight:bold; font-size:16px;">
                <span>${netTotal >= 0 ? 'Tambah Rp' : 'Kembali Rp'}</span>
                <span>${almaraUtils.formatIdr(Math.abs(netTotal))}</span>
            </div>
        `;
    }
    let labelInvoice = 'No. Invoice';
    if (beliCart.length > 0 && jualCart.length === 0) labelInvoice = 'Invoice Pembelian';
    else if (jualCart.length > 0 && beliCart.length === 0) labelInvoice = 'Invoice Penjualan';
    else if (isMixed) labelInvoice = 'Nota Transaksi';

    const dateStr = almaraUtils.formatDateToDMY(summary.timestamp || Date.now());
    const phone = profile.phone || '';
    let contactLine = `<span>Telp/WA: ${phone || '-'}</span> | <span>Tgl: ${dateStr}</span>`;
    const addressToShow = profile.address || '';

    printWindow.document.write(`<!DOCTYPE html>
        <html><head>
            <style>
                @page { size: 10cm 14cm; margin: 0; }
                html, body { margin: 0; padding: 0; min-height: 100%; }
                body { font-family: 'Arial Narrow', Arial, sans-serif; width: 10cm; margin: 0; padding: 0.85cm 0.45cm 0.5cm; box-sizing: border-box; font-size: 12px; color: #000; }
                .center { text-align: center; }
                .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
                .divider-double { border-top: 1px dashed #000; border-bottom: 1px dashed #000; height: 2px; margin: 4px 0; }
                .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                small { font-size: 0.8em; color: #000; }
                .uppercase { text-align: center; font-weight: bold !important; font-size: 17px; }
            </style>
        </head><body>
            <h2 class="center" style="margin-top: 5px; margin-bottom: 0px; font-size: 20px;">${profile.name || 'MC-ALMARA'}</h2>
            ${addressToShow ? `<div class="center" style="font-size: 15px; margin-top: 2px; margin-bottom: 2px;">${addressToShow}</div>` : ''}
            ${profile.biLicense ? `<div class="center" style="font-size: 1em; margin-bottom: 2px;">No. Izin: ${profile.biLicense}</div>` : ''}
            <div class="center">
                <div style="font-size: 15px; margin-top: 2px; white-space: nowrap; text-align: center;">
                    ${contactLine}
                </div>
            </div>
            <div class="divider"></div>
            <div class="row"><span>${labelInvoice}:</span><span>${summary.receiptId || '-'}</span></div>
            <div class="row"><span>No. CIF:</span><span>${cust.no_cif || '-'}</span></div>
            <div class="row"><span>Nama:</span><span>${custName}</span></div>
            <div class="row"><span>Telp:</span><span>${custPhone}</span></div>
            <div class="divider-double"></div>
            ${itemsHtml}
            <div class="divider"></div>
            <div class="row">
                <span>GRAND TOTAL</span>
                <span>${almaraUtils.formatIdr(Math.abs(summary.grandTotal))}</span>
            </div>
            <div class="row"><span>Metode:</span><span>${summary.paymentMethod}</span></div>
            ${summary.paymentMethod === 'SPLIT' ? `
                <div class="row"><span>Via Tunai:</span><span>${almaraUtils.formatIdr(Math.abs(summary.payCash))}</span></div>
                <div class="row"><span>Via Transfer:</span><span>${almaraUtils.formatIdr(Math.abs(summary.payTransfer))}</span></div>
            ` : ''}
            <div class="divider"></div>
            <div class="row" style="margin-top:5px; font-size: 1em;">
                <div style="text-align:center; width:45%;">
                    Petugas / Kasir<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${summary.kasir || (almaraAuth.getCurrentUser() ? almaraAuth.getCurrentUser().fullName : 'Kasir')}</div>
                </div>
                <div style="text-align:center; width:45%;">
                    Penerima<br><br><br><br>
                    <div style="border-top:1px dashed #000; padding-top:2px;">${recName || '-'}</div>
                </div>
            </div>
            <div class="center" style="margin-top:4px; font-size: 15px; font-style: italic; line-height: 1.2;">
                Hitung kembali uang Anda, Kami tidak menerima<br>komplin setelah meninggalkan counter
            </div>
            <div class="center" style="margin-top:10px; font-weight: bold !important;">${profile.footer || ''}</div>
        </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function printInvoice(cart, summary) {
    const customers = almaraStore.getCustomers();
    const cust = customers.find(c => c.id_nasabah === summary.customerId) || {};
    const custName = cust.nama || 'Pengunjung Biasa';
    let custPhone = cust.no_hp || '-';
    if(custPhone !== '-') custPhone = custPhone.length > 3 ? custPhone.slice(0, -3) + '***' : '***';
    
    const recIdToUse = summary.receiverId || summary.customerId;
    const rec = recIdToUse === summary.customerId ? cust : (customers.find(c => c.id_nasabah === recIdToUse) || {});
    const recName = summary.receiverManualName || (recIdToUse === summary.customerId ? custName : (rec.nama || 'Pengunjung Biasa'));

    const profile = almaraStore.getProfile();
    const printWindow = window.open('', '_blank');
    
    const beliCart = cart.filter(i => i.type === 'BELI');
    const jualCart = cart.filter(i => i.type === 'JUAL');
    const isMixed = beliCart.length > 0 && jualCart.length > 0;

    let labelInvoice = 'No. Invoice';
    if (beliCart.length > 0 && jualCart.length === 0) labelInvoice = 'Invoice Pembelian';
    else if (jualCart.length > 0 && beliCart.length === 0) labelInvoice = 'Invoice Penjualan';
    else if (isMixed) labelInvoice = 'Nota Transaksi';

    const dateStr = almaraUtils.formatDateToDMY(summary.timestamp || Date.now());
    const phone = profile.phone || '';
    const addressToShow = (profile.address && profile.address.toLowerCase() !== 'pusat valuta asing terpercaya') ? profile.address : 'Pusat Valuta Asing Terpercaya';

    const renderInvoiceGroup = (label, rows) => {
        if (!rows.length) return { html: '', total: 0 };

        let total = 0;
        const rowsHtml = rows.map((item) => {
            total += item.totalIdr;
            const desc = `${item.curCode} ${item.amount.toLocaleString('id-ID')} @ ${formatPrintRate(item.rate, item.curCode)}`;
            return `
            <div class="row-flex" style="font-size: 15px;">
                    <span>${desc}</span>
                    <span class="font-weight-bold">${almaraUtils.formatIdr(item.totalIdr)}</span>
                </div>
            `;
        }).join('');

        const totalHtml = (isMixed || rows.length > 1)
            ? `<div class="row-flex font-weight-bold" style="font-size: 12.5px;"><span>Total ${label}</span><span>${almaraUtils.formatIdr(total)}</span></div>`
            : '';

        return {
            total,
            html: `
                <div class="font-weight-bold" style="font-size: 15px; border-bottom: 1px dashed #000; margin: 3px 0 3px;">${label}</div>
                ${rowsHtml}
                ${totalHtml}
            `
        };
    };

    const beliGroup = renderInvoiceGroup('BELI', beliCart);
    const jualGroup = renderInvoiceGroup('JUAL', jualCart);
    let itemsHtml = `${beliGroup.html}${isMixed ? '<div class="divider-dashed"></div>' : ''}${jualGroup.html}`;
    if (isMixed) {
        const netTotal = jualGroup.total - beliGroup.total;
        itemsHtml += `
            <div class="divider-dashed"></div>
            <div class="row-flex font-weight-bold" style="font-size: 15px;">
                <span>${netTotal >= 0 ? 'Tambah Rp' : 'Kembali Rp'}</span>
                <span>${almaraUtils.formatIdr(Math.abs(netTotal))}</span>
            </div>
        `;
    }

    printWindow.document.write(`
        <html><head>
            <title>Invoice Transaksi</title>
            <style>
                @page { size: 10cm 14cm; margin: 0; }
                body { font-family: 'Arial Narrow', Arial, sans-serif; width: 10cm; margin: 0; padding: 0.85cm 0.45cm 0.5cm; box-sizing: border-box; color: #000; font-size: 12px; line-height: 1.25;}
                
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-weight-bold { font-weight: bold; }
                
                .header { text-align: center; margin-bottom: 5px; }
                .header h1 { margin: 0; font-size: 15px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;}
                .header p { margin: 1px 0; font-size: 11px; }
                
                .divider-dashed { border-top: 1px dashed #000; margin: 4px 0; }
                .divider-double { border-top: 3px double #000; margin: 5px 0; }
                
                .row-flex { display: flex; justify-content: space-between; padding: 2px 0; }
                
                .signature-section { display: flex; justify-content: space-between; margin-top: 15px; }
                .signature-box { text-align: center; width: 46%; font-size: 11px; }
                .signature-line { border-top: 1px dashed #000; margin-top: 25px; margin-bottom: 2px; width: 100%; }
                
                .disclaimer { font-size: 10.5px; font-style: italic; margin-top: 10px; text-align: center; line-height: 1.2; }
                .footer-thank { font-size: 13px; font-weight: bold; text-align: center; margin-top: 8px; letter-spacing: 0.5px; }
            </style>
        </head><body>
            <div class="header">
                <h1>${profile.name || 'MC-ALMARA'}</h1>
                <p>${addressToShow}</p>
                <p>Telp/WA: ${phone || '-'} | Tgl: ${dateStr}</p>
            </div>
            
            <div class="divider-dashed"></div>
            
            <div class="row-flex">
                <span>${labelInvoice}:</span>
                <span>${summary.receiptId || '-'}</span>
            </div>
            <div class="row-flex">
                <span>No. CIF:</span>
                <span>${cust.no_cif || '-'}</span>
            </div>
            <div class="row-flex">
                <span>Nama:</span>
                <span class="font-weight-bold">${custName}</span>
            </div>
            <div class="row-flex">
                <span>Telp:</span>
                <span>${custPhone}</span>
            </div>
            
            <div class="divider-double"></div>
            <div class="row-flex font-weight-bold" style="font-size: 15px;">
                <span>Rincian Transaksi</span>
                <span>Total (IDR)</span>
            </div>
            
            <div class="divider-dashed" style="margin-top: 2px;"></div>
            
            <div style="margin: 2px 0;">
                ${itemsHtml}
            </div>
            
            <div class="divider-dashed"></div>
            
            <div class="row-flex">
                <span>GRAND TOTAL</span>
                <span class="font-weight-bold">${almaraUtils.formatIdr(Math.abs(summary.grandTotal))}</span>
            </div>
            <div class="row-flex">
                <span>Metode:</span>
                <span>${summary.paymentMethod}</span>
            </div>
            
            ${summary.paymentMethod === 'SPLIT' ? `
                <div class="row-flex" style="font-size: 9px; color: #555;">
                    <span>- Tunai:</span>
                    <span>${almaraUtils.formatIdr(Math.abs(summary.payCash))}</span>
                </div>
                <div class="row-flex" style="font-size: 9px; color: #555;">
                    <span>- Transfer:</span>
                    <span>${almaraUtils.formatIdr(Math.abs(summary.payTransfer))}</span>
                </div>
            ` : ''}
            
            <div class="divider-dashed"></div>
            
            <div class="signature-section">
                <div class="signature-box">
                    <span>Petugas / Kasir</span>
                    <div class="signature-line"></div>
                    <span>${summary.kasir || (almaraAuth.getCurrentUser() ? almaraAuth.getCurrentUser().fullName : 'Kasir')}</span>
                </div>
                <div class="signature-box">
                    <span>Penerima</span>
                    <div class="signature-line"></div>
                    <span>${recName}</span>
                </div>
            </div>
            
            <div class="disclaimer">
                Hitung kembali uang Anda, Kami tidak menerima<br>komplin setelah meninggalkan counter
            </div>
            
            <div class="footer-thank">
                Terima Kasih Atas Kunjungan Anda
            </div>
        </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
}

// ==========================================
// KODE KAMERA WAJAH NASABAH (TRANSAKSI)
// ==========================================
window.openTrxCustomerCamera = function() {
    if (typeof window.openCameraModal === 'function') {
        window.openCameraModal('trxCustomerPhotoPreview', 'trxCustomerPhotoPlaceholder');
        // Polling status pratinjau kamera untuk menampilkan tombol hapus
        const interval = setInterval(() => {
            const img = document.getElementById('trxCustomerPhotoPreview');
            const btn = document.getElementById('btnRemoveTrxCustomerPhoto');
            if (img && img.style.display !== 'none' && img.src.startsWith('data:')) {
                if (btn) btn.style.display = 'block';
                clearInterval(interval);
            }
            const modal = document.getElementById('cameraModal');
            if (modal && modal.style.display === 'none') {
                clearInterval(interval);
            }
        }, 500);
    } else {
        alert("Modul kamera tidak tersedia di aplikasi.");
    }
};

window.removeTrxCustomerPhoto = function() {
    const img = document.getElementById('trxCustomerPhotoPreview');
    const placeholder = document.getElementById('trxCustomerPhotoPlaceholder');
    const btn = document.getElementById('btnRemoveTrxCustomerPhoto');
    if (img) {
        img.src = '';
        img.style.display = 'none';
    }
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    if (btn) {
        btn.style.display = 'none';
    }
};

// =====================================================================
// MODERN POS 3-COLUMN LAYOUT HELPERS
// =====================================================================

window.renderPosValasListModern = function() {
    const searchVal = (document.getElementById('posValasSearchModern')?.value || '').toLowerCase();
    const listContainer = document.getElementById('posValasListModern');
    if (!listContainer) return;

    let currencies = [];
    let masterCurrencies = [];
    try {
        currencies = almaraStore.getCurrencies();
        masterCurrencies = almaraStore.getMasterCurrencies();
    } catch (e) {
        console.error("Gagal mengambil data untuk list valas modern:", e);
    }

    if (!Array.isArray(currencies)) currencies = [];
    if (!Array.isArray(masterCurrencies)) masterCurrencies = [];

    const selectedCurrency = document.getElementById('trxCurrency')?.value || '';

    // Filter currencies
    const filtered = currencies.filter(c => {
        if (!c || !c.code) return false;
        const code = c.code.toLowerCase();
        const mc = masterCurrencies.find(m => m && m.code === c.code) || { country: '' };
        const country = (mc.country || '').toLowerCase();
        return code.includes(searchVal) || country.includes(searchVal);
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Valas tidak ditemukan</div>';
        return;
    }

    let html = '';
    filtered.forEach(c => {
        const mc = masterCurrencies.find(m => m && m.code === c.code) || { flag: '', country: '' };
        const buyRate = parseFloat(c.buy) || 0;
        const sellRate = parseFloat(c.sell) || 0;
        const stockVal = parseFloat(c.stock) || 0;
        const isSelected = c.code === selectedCurrency;

        html += `
            <div class="pos-valas-item-modern ${isSelected ? 'selected' : ''}" onclick="window.selectPosValasModern('${c.code}')">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.6rem; line-height: 1;">${mc.flag || '🏳️'}</span>
                    <div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${c.code}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${mc.country || '-'}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.8rem; font-weight: bold; color: var(--accent-green);">B: ${buyRate.toLocaleString('id-ID')}</div>
                    <div style="font-size: 0.8rem; font-weight: bold; color: var(--accent-red);">S: ${sellRate.toLocaleString('id-ID')}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">Stok: ${stockVal.toLocaleString('id-ID')}</div>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
};

window.openPosValasDropdown = function() {
    saveActivePosDraftNow();
    const listContainer = document.getElementById('posValasListModern');
    if (!listContainer) return;
    if (typeof window.renderPosValasListModern === 'function') {
        window.renderPosValasListModern();
    }
    listContainer.classList.remove('hidden');
};

window.closePosValasDropdown = function() {
    const listContainer = document.getElementById('posValasListModern');
    if (listContainer) listContainer.classList.add('hidden');
};

window.selectPosValasModern = function(code) {
    saveActivePosDraftNow();
    const select = document.getElementById('trxCurrency');
    if (!select) return;

    if (window.jQuery) {
        $(select).val(code).trigger('change');
    } else {
        select.value = code;
        select.dispatchEvent(new Event('change'));
    }

    window.renderPosValasListModern();
    const searchInput = document.getElementById('posValasSearchModern');
    if (searchInput) searchInput.value = code;
    window.closePosValasDropdown();
    scheduleSaveActivePosDraft();
};

window.filterPosValasModern = function() {
    if (!isApplyingPosDraft) {
        scheduleSaveActivePosDraft();
    }
    window.openPosValasDropdown();
    window.renderPosValasListModern();
};

window.filterPosCustomerModern = function() {
    const searchVal = (document.getElementById('posCustomerSearchModern')?.value || '').toLowerCase();
    const resultsContainer = document.getElementById('posCustomerResultsModern');
    if (!resultsContainer) return;

    if (!searchVal) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        return;
    }

    let customers = [];
    try {
        customers = almaraStore.getCustomers();
    } catch (e) {
        console.error("Gagal mengambil data customer untuk search:", e);
    }

    if (!Array.isArray(customers)) customers = [];

    const filtered = customers.filter(c => {
        if (!c) return false;
        const name = (c.nama || '').toLowerCase();
        const id = (c.id_nasabah || '').toLowerCase();
        const phone = (c.no_hp || '').toLowerCase();
        const ktp = (c.no_ktp || '').toLowerCase();
        const cif = (c.no_cif || '').toLowerCase();
        return name.includes(searchVal) || id.includes(searchVal) || phone.includes(searchVal) || ktp.includes(searchVal) || cif.includes(searchVal);
    });

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Nasabah tidak ditemukan</div>';
        resultsContainer.classList.remove('hidden');
        return;
    }

    let html = '';
    filtered.slice(0, 10).forEach(c => {
        let subText = `ID: ${c.id_nasabah}`;
        if (c.no_hp && c.no_hp !== '-') subText += ` | HP: ${c.no_hp}`;
        if (c.no_ktp && c.no_ktp !== '-') subText += ` | NIK: ${c.no_ktp}`;

        html += `
            <div style="padding: 10px 12px; border-bottom: 1px solid var(--panel-border); cursor: pointer; transition: background 0.2s;" 
                 onmouseover="this.style.background='rgba(59, 130, 246, 0.08)'" 
                 onmouseout="this.style.background='transparent'" 
                 onclick="window.selectPosCustomerModern('${c.id_nasabah}')">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${c.nama}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${subText}</div>
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
};

window.refreshPosCustomerSearchModern = function(customerId = '') {
    if (typeof window.loadPosForm === 'function') {
        window.loadPosForm();
    }

    const searchInput = document.getElementById('posCustomerSearchModern');
    if (!searchInput) return;

    if (customerId) {
        const customers = almaraStore.getCustomers() || [];
        const chosen = customers.find(c => c.id_nasabah === customerId);
        if (chosen) {
            searchInput.value = chosen.nama || '';
            window.selectPosCustomerModern(customerId);
            return;
        }
    }

    if (searchInput.value.trim()) {
        window.filterPosCustomerModern();
    } else {
        const resultsContainer = document.getElementById('posCustomerResultsModern');
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
        }
    }
};

window.selectPosCustomerModern = function(id) {
    const select = document.getElementById('trxCustomer');
    if (!select) return;

    if (window.jQuery) {
        $(select).val(id).trigger('change');
    } else {
        select.value = id;
        select.dispatchEvent(new Event('change'));
    }

    // Update search bar text
    const custs = almaraStore.getCustomers() || [];
    const chosen = custs.find(c => c.id_nasabah === id);
    const searchInput = document.getElementById('posCustomerSearchModern');
    if (searchInput && chosen) {
        searchInput.value = chosen.nama;
    }

    // Hide results
    const resultsContainer = document.getElementById('posCustomerResultsModern');
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
    }

    window.updateModernCustomerProfileCard();
    updateProcessPaymentState();
};

window.updateModernCustomerProfileCard = function() {
    const customerId = document.getElementById('trxCustomer')?.value || '';
    const profileCard = document.getElementById('posCustomerProfileCard');
    const actionsBox = document.getElementById('posCustActionsModern');
    if (!profileCard || !actionsBox) return;

    if (!customerId) {
        profileCard.classList.add('hidden');
        actionsBox.classList.add('hidden');
        return;
    }

    const customers = almaraStore.getCustomers() || [];
    const c = customers.find(item => item.id_nasabah === customerId);

    if (!c) {
        profileCard.classList.add('hidden');
        actionsBox.classList.add('hidden');
        return;
    }

    // Update fields
    document.getElementById('posCustIdVal').textContent = c.id_nasabah || c.no_cif || '-';
    document.getElementById('posCustNameVal').textContent = c.nama || '-';
    document.getElementById('posCustPhoneVal').textContent = c.no_hp || '-';
    document.getElementById('posCustAddressVal').textContent = c.alamat || '-';
    document.getElementById('posCustCitizenVal').textContent = c.warga_negara || '-';
    document.getElementById('posCustTypeVal').textContent = c.kn || '-';
    
    // Poin Calculation or display
    const transactions = almaraStore.getTransactions() || [];
    const pointsCount = transactions.filter(t => t.customerId === customerId).length * 10;
    document.getElementById('posCustPointsVal').textContent = pointsCount;

    // Show Avatar or custom letter avatar
    const avatarEl = document.getElementById('posCustomerAvatar');
    const avatarImg = document.getElementById('posCustomerAvatarImg');
    const avatarFallback = document.getElementById('posCustomerAvatarFallback');
    if (avatarEl) {
        const photoSrc = String(c.foto_id || c.photo_id || c.foto || c.photo || '').trim();
        if (avatarImg && avatarFallback) {
            if (photoSrc) {
                avatarImg.src = photoSrc;
                avatarImg.classList.remove('hidden');
                avatarFallback.classList.add('hidden');
            } else {
                avatarImg.src = '';
                avatarImg.classList.add('hidden');
                avatarFallback.classList.remove('hidden');
            }
        }
    }

    profileCard.classList.remove('hidden');
    actionsBox.classList.remove('hidden');
};

window.showPosCustomerDetail = function() {
    const customerId = document.getElementById('trxCustomer')?.value || '';
    if (customerId && typeof window.openCustomerUpdateModal === 'function') {
        window.openCustomerUpdateModal(customerId);
    } else {
        alert('Silakan pilih nasabah terlebih dahulu.');
    }
};

window.clearPosCustomerSelection = function() {
    const select = document.getElementById('trxCustomer');
    if (!select) return;

    if (window.jQuery) {
        $(select).val('').trigger('change');
    } else {
        select.value = '';
        select.dispatchEvent(new Event('change'));
    }

    const searchInput = document.getElementById('posCustomerSearchModern');
    if (searchInput) searchInput.value = '';
    window._posLastProcessedCustomerId = '';

    window.updateModernCustomerProfileCard();
    updateProcessPaymentState();
    showCustomerHistory();
};

window.setPosTransactionType = function(type) {
    const select = document.getElementById('trxType');
    if (!select) return;

    select.value = type;
    select.dispatchEvent(new Event('change'));

    // Update active button state
    const beliBtn = document.getElementById('posTypeBeliBtnModern');
    const jualBtn = document.getElementById('posTypeJualBtnModern');

    if (type === 'BELI') {
        beliBtn.classList.add('active');
        jualBtn.classList.remove('active');
    } else {
        beliBtn.classList.remove('active');
        jualBtn.classList.add('active');
    }
};

window.setPosAmountSheet = function(val) {
    const input = document.getElementById('trxAmount');
    if (!input) return;

    input.value = val;
    input.dispatchEvent(new Event('input'));
};

window.recalculatePosGrandTotal = function() {
    let rawGt = 0;
    currentCart.forEach(item => {
        let sign = item.type === 'JUAL' ? 1 : -1;
        rawGt += (item.totalIdr * sign);
    });

    const discount = parseFloat(document.getElementById('posDiscountModern')?.value) || 0;
    const fee = parseFloat(document.getElementById('posFeeModern')?.value) || 0;

    let finalGt = rawGt >= 0 ? (rawGt - discount + fee) : (rawGt + fee - discount);

    const subtotalNode = document.getElementById('posSubtotalValModern');
    if (subtotalNode) {
        subtotalNode.textContent = almaraUtils.formatIdr(Math.abs(rawGt));
    }

    const grandTotalNode = document.getElementById('grandTotalIdr');
    if (grandTotalNode) {
        grandTotalNode.textContent = almaraUtils.formatIdr(Math.abs(finalGt));
        grandTotalNode.style.color = finalGt < 0 ? '#F87171' : '#10B981';
    }

    // Trigger split amount auto calculation if split payment is active
    if (document.getElementById('paymentMethod')?.value === 'SPLIT') {
        const cashVal = parseFloat(document.getElementById('splitCashAmount')?.value) || 0;
        const transferEl = document.getElementById('splitTransferAmount');
        if (transferEl) {
            transferEl.value = Math.max(0, Math.abs(finalGt) - cashVal);
        }
    }

    window.recalculatePosChange();
};

window.recalculatePosChange = function() {
    let rawGt = 0;
    currentCart.forEach(item => {
        let sign = item.type === 'JUAL' ? 1 : -1;
        rawGt += (item.totalIdr * sign);
    });

    const discount = parseFloat(document.getElementById('posDiscountModern')?.value) || 0;
    const fee = parseFloat(document.getElementById('posFeeModern')?.value) || 0;
    let finalGt = rawGt >= 0 ? (rawGt - discount + fee) : (rawGt + fee - discount);

    const cashReceived = parseFloat(document.getElementById('posCashReceivedModern')?.value) || 0;
    const changeNode = document.getElementById('posChangeModern');

    if (changeNode) {
        const change = Math.max(0, cashReceived - Math.abs(finalGt));
        changeNode.textContent = almaraUtils.formatIdr(change);
    }
};

window.setPosPrintButtonsVisibility = function(visible) {
    const buttons = ['btnPrintInvoice', 'btnSendWA'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            if (visible) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }
    });
    // Keep thermal print button permanently hidden
    const thermalBtn = document.getElementById('btnPrintReceipt');
    if (thermalBtn) thermalBtn.classList.add('hidden');
};

window.clearPosCartModern = function() {
    if (confirm("Apakah Anda yakin ingin mengosongkan seluruh keranjang belanja?")) {
        currentCart = [];
        renderCart();
        setActivePosDraftPrintContext(null, null);
        scheduleSaveActivePosDraft();
        if (typeof window.setPosPrintButtonsVisibility === 'function') {
            window.setPosPrintButtonsVisibility(false);
        }
    }
};

document.addEventListener('input', function(e) {
    if (!e.target.closest || !e.target.closest('#pos-view')) return;
    scheduleSaveActivePosDraft();
});

document.addEventListener('change', function(e) {
    if (!e.target.closest || !e.target.closest('#pos-view')) return;
    scheduleSaveActivePosDraft();
});

document.addEventListener('DOMContentLoaded', function() {
    window.updatePosWaGatewayOption();
});

// Listeners to close customer search autocomplete on click outside
document.addEventListener('click', function(e) {
    const navTarget = e.target.closest && e.target.closest('.nav-item');
    if (navTarget && !document.getElementById('pos-view')?.classList.contains('hidden')) {
        saveActivePosDraftNow();
    }

    const resultsContainer = document.getElementById('posCustomerResultsModern');
    const searchInput = document.getElementById('posCustomerSearchModern');
    if (resultsContainer && searchInput && !resultsContainer.contains(e.target) && e.target !== searchInput) {
        resultsContainer.classList.add('hidden');
    }

    const valasContainer = document.querySelector('.pos-valas-search-container');
    const valasList = document.getElementById('posValasListModern');
    if (valasContainer && valasList && !valasContainer.contains(e.target)) {
        valasList.classList.add('hidden');
    }
});

window.addEventListener('customers:updated', function(e) {
    const customerId = e && e.detail ? e.detail.customerId : '';
    if (typeof window.refreshPosCustomerSearchModern === 'function') {
        window.refreshPosCustomerSearchModern(customerId);
    } else if (typeof window.loadPosForm === 'function') {
        window.loadPosForm();
    }
});

// Keyboard Shortcut F2, F3, F5 mappings
document.addEventListener('keydown', function(e) {
    const posView = document.getElementById('pos-view');
    if (!posView || posView.classList.contains('hidden')) return;

    if (e.key === 'F2') {
        e.preventDefault();
        const addBtn = document.getElementById('btnAddToCart');
        if (addBtn && !addBtn.disabled && !addBtn.classList.contains('disabled')) {
            addToCart();
        }
    } else if (e.key === 'F3') {
        e.preventDefault();
        resetPosForm(true);
    } else if (e.key === 'F5') {
        e.preventDefault();
        const processBtn = document.getElementById('btnProcessPayment');
        if (processBtn && !processBtn.disabled && !processBtn.classList.contains('disabled')) {
            processPayment();
        }
    }
});
