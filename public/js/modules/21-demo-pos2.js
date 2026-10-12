/* Demo POS: isolated from POS, currency master, and operational reports. */
(function () {
    const STOCK_KEY = 'mc_demo_pos_stock_v1';
    const TRX_KEY = 'mc_demo_pos_transactions_v1';
    const CART_KEY = 'mc_demo_pos_cart_v1';
    const safeGet = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } };
    const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
    const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
    let type = 'BELI';
    let cart = safeGet(CART_KEY);
    let lastTransaction = null;

    function stock() { return safeGet(STOCK_KEY); }
    function renderStock() {
        const rows = stock();
        const body = document.getElementById('demoPosStockBody');
        const select = document.getElementById('demoPosCurrency');
        if (!body || !select) return;
        body.innerHTML = rows.length ? rows.map(item => `<tr><td><strong>${esc(item.code)}</strong></td><td>${Number(item.stock || 0).toLocaleString('id-ID')}</td><td>${rupiah(item.buy)}</td><td>${rupiah(item.sell)}</td><td><button class="btn btn-sm btn-danger" onclick="window.demoPosDeleteStock('${esc(item.id)}')" title="Hapus"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted">Belum ada stok demo. Tambahkan stok untuk mulai latihan.</td></tr>';
        const current = select.value;
        select.innerHTML = '<option value="">Pilih valas demo</option>' + rows.map(item => `<option value="${esc(item.id)}">${esc(item.code)} — stok ${Number(item.stock || 0).toLocaleString('id-ID')}</option>`).join('');
        if (rows.some(item => item.id === current)) select.value = current;
    }
    function renderCart() {
        const buy = document.getElementById('demoPosBuyCart'); const sell = document.getElementById('demoPosSellCart'); const total = document.getElementById('demoPosTotal');
        if (!buy || !sell || !total) return;
        const render = (side, empty) => { const lines = cart.filter(item => item.type === side); return lines.length ? lines.map((item, index) => `<div class="pos-cart-row"><strong>${esc(item.code)}</strong><span>${Number(item.amount).toLocaleString('id-ID')} × ${rupiah(item.rate)}</span><strong>${rupiah(item.total)}</strong><button class="btn btn-sm btn-danger" onclick="window.demoPosRemoveCart(${index})"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : `<div class="pos-empty-cart">${empty}</div>`; };
        buy.innerHTML = render('BELI', 'Belum ada pembelian demo'); sell.innerHTML = render('JUAL', 'Belum ada penjualan demo');
        total.textContent = rupiah(cart.reduce((sum, item) => sum + Number(item.total || 0), 0));
    }
    function renderHistory() {
        const host = document.getElementById('demoPosHistory'); if (!host) return;
        const items = safeGet(TRX_KEY).slice().reverse().slice(0, 30);
        host.innerHTML = items.length ? items.map(trx => `<div style="padding:10px 0;border-bottom:1px solid var(--border-color, #e2e8f0);"><div class="flex-between"><strong>${esc(trx.invoice)}</strong><strong style="color:#0f766e;">${rupiah(trx.total)}</strong></div><small class="text-muted">${esc(trx.date)} · ${esc(trx.customer || 'Tanpa data nasabah')} · ${esc(trx.payment)}</small><div style="margin-top:5px;font-size:.82rem;">${trx.items.map(item => `${esc(item.type)} ${esc(item.code)} ${Number(item.amount).toLocaleString('id-ID')}`).join(' · ')}</div></div>`).join('') : '<div class="text-muted">Belum ada transaksi demo.</div>';
    }
    function newInvoice() { return 'DEMO-' + new Date().toISOString().slice(0,10).replaceAll('-', '') + '-' + String(Date.now()).slice(-5); }
    function resetForm() { cart = []; save(CART_KEY, cart); const today = new Date().toISOString().slice(0,10); document.getElementById('demoPosInvoice').value = newInvoice(); document.getElementById('demoPosDate').value = today; ['demoPosCustomer','demoPosRate','demoPosAmount','demoPosNote'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); document.getElementById('demoPosPayment').value = 'CASH'; renderCart(); renderStock(); }
    window.loadDemoPos = function () { if (!document.getElementById('demoPosInvoice')) return; if (!document.getElementById('demoPosInvoice').value) resetForm(); else { renderStock(); renderCart(); } renderHistory(); };
    window.demoPosSetType = function (next) { type = next; document.getElementById('demoPosBeli').classList.toggle('active', next === 'BELI'); document.getElementById('demoPosJual').classList.toggle('active', next === 'JUAL'); window.demoPosFillRate(); };
    window.demoPosFillRate = function () { const item = stock().find(row => row.id === document.getElementById('demoPosCurrency')?.value); const rate = document.getElementById('demoPosRate'); if (item && rate) rate.value = type === 'BELI' ? item.buy : item.sell; };
    window.demoPosAddCart = function () { const item = stock().find(row => row.id === document.getElementById('demoPosCurrency')?.value); const amount = Number(document.getElementById('demoPosAmount')?.value); const rate = Number(document.getElementById('demoPosRate')?.value); if (!item || amount <= 0 || rate <= 0) return alert('Pilih valas demo, lalu isi kurs dan jumlah yang valid.'); if (type === 'JUAL' && amount > Number(item.stock || 0)) return alert('Stok demo ' + item.code + ' tidak mencukupi.'); cart.push({ id: item.id, code: item.code, type, amount, rate, total: amount * rate }); save(CART_KEY, cart); document.getElementById('demoPosAmount').value = ''; renderCart(); };
    window.demoPosRemoveCart = function (index) { cart.splice(index, 1); save(CART_KEY, cart); renderCart(); };
    window.demoPosClearCart = function () { cart = []; save(CART_KEY, cart); renderCart(); };
    window.demoPosAddStock = function () { const code = prompt('Kode valas demo (contoh: USD):'); if (!code) return; const amount = Number(prompt('Jumlah stok demo:', '0')); const buy = Number(prompt('Kurs beli demo:', '0')); const sell = Number(prompt('Kurs jual demo:', '0')); if (!Number.isFinite(amount) || !Number.isFinite(buy) || !Number.isFinite(sell)) return alert('Angka stok dan kurs harus valid.'); const list = stock(); list.push({ id: 'demo_stock_' + Date.now(), code: code.trim().toUpperCase(), stock: amount, buy, sell }); save(STOCK_KEY, list); renderStock(); };
    window.demoPosDeleteStock = function (id) { if (!confirm('Hapus stok demo ini?')) return; save(STOCK_KEY, stock().filter(item => item.id !== id)); cart = cart.filter(item => item.id !== id); save(CART_KEY, cart); renderStock(); renderCart(); };
    window.demoPosProcess = function () { if (!cart.length) return alert('Keranjang demo masih kosong.'); const list = stock(); for (const line of cart) { const item = list.find(row => row.id === line.id); if (!item || (line.type === 'JUAL' && Number(item.stock || 0) < line.amount)) return alert('Stok demo ' + line.code + ' tidak mencukupi.'); }
        cart.forEach(line => { const item = list.find(row => row.id === line.id); item.stock = Number(item.stock || 0) + (line.type === 'BELI' ? line.amount : -line.amount); });
        const trx = { id: 'demo_trx_' + Date.now(), invoice: document.getElementById('demoPosInvoice').value || newInvoice(), date: document.getElementById('demoPosDate').value, customer: document.getElementById('demoPosCustomer').value.trim(), payment: document.getElementById('demoPosPayment').value, note: document.getElementById('demoPosNote').value.trim(), items: cart, total: cart.reduce((sum, item) => sum + item.total, 0), createdAt: new Date().toISOString() };
        const history = safeGet(TRX_KEY); history.push(trx); save(STOCK_KEY, list); save(TRX_KEY, history); lastTransaction = trx; renderHistory(); document.getElementById('demoPosPrint').classList.remove('hidden'); alert('Transaksi demo berhasil disimpan. Data POS utama tidak berubah.'); resetForm(); };
    window.demoPosPrintLast = function () { const trx = lastTransaction || safeGet(TRX_KEY).slice(-1)[0]; if (!trx) return alert('Belum ada transaksi demo untuk dicetak.'); const popup = window.open('', '_blank', 'width=420,height=650'); if (!popup) return alert('Izinkan pop-up untuk mencetak rincian demo.'); popup.document.write(`<!doctype html><html><head><title>Rincian Demo</title><style>body{font:13px Arial;padding:18px;color:#111}h2{text-align:center;margin:0 0 12px}table{width:100%;border-collapse:collapse}td,th{padding:7px 0;border-bottom:1px dashed #999;text-align:left}td:last-child,th:last-child{text-align:right}.total{font-size:17px;font-weight:bold;margin-top:14px;text-align:right}</style></head><body><h2>RINCIAN TRANSAKSI DEMO</h2><div>No: ${esc(trx.invoice)}<br>Tanggal: ${esc(trx.date)}<br>Pembayaran: ${esc(trx.payment)}</div><table><thead><tr><th>Item</th><th>Qty × Kurs</th><th>Jumlah</th></tr></thead><tbody>${trx.items.map(i => `<tr><td>${esc(i.type)} ${esc(i.code)}</td><td>${Number(i.amount).toLocaleString('id-ID')} × ${rupiah(i.rate)}</td><td>${rupiah(i.total)}</td></tr>`).join('')}</tbody></table><div class="total">TOTAL ${rupiah(trx.total)}</div>${trx.note ? `<p>Catatan: ${esc(trx.note)}</p>` : ''}</body></html>`); popup.document.close(); popup.focus(); popup.print(); };
})();
