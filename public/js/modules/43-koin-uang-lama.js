/* =====================================================================
 * 43-koin-uang-lama.js  —  Koin Asing & Uang Kertas Lama (halaman mandiri)
 *
 *  Kasir sendiri (seperti Transaksi) dengan kas, stok, dan laba yang terpisah dari transaksi utama.
 *
 *  Tab:  Kasir  |  Stok & Item  |  Riwayat  |  Kas Koin  |  Acuan Harga
 *
 *  Prinsip data (satu sumber kebenaran = riwayat transaksi `mc_old_money_trxs`):
 *   - Stok, kas, dan harga pokok (rata-rata bergerak) SELALU dihitung ulang dari riwayat (replay()).
 *     Tambah / ubah / hapus transaksi ditolak bila membuat stok atau kas menjadi minus.
 *   - Laba = harga jual - harga pokok rata-rata (per nominal valas, bukan per keping).
 *   - Nomor OM-xxxx dialokasikan server (api/pos/next-document) agar tidak ganda antar perangkat.
 *   - Kunci penyimpanan lama tetap dipakai: mc_old_money_stock / _trxs / _suppliers / _cash.
 *   - Menggantikan seluruh kode lama di 09-operations.js dan blok HTML lama di dashboard.
 * ===================================================================== */
(function () {
    'use strict';

    var K = { stock: 'mc_old_money_stock', trxs: 'mc_old_money_trxs', sup: 'mc_old_money_suppliers', cash: 'mc_old_money_cash' };
    var S = {
        tab: 'kasir', cat: 'KOIN', q: '', type: 'BELI', sel: '', cart: [], cp: { kind: 'WALKIN', customerId: '', supplierId: '' }, note: '', editing: null, printAfter: true,
        stk: { cat: 'KOIN', q: '', low: false },
        his: { from: '', to: '', type: '', cat: '', q: '', sel: {} },
        kas: { from: '', to: '' },
        sup: { cat: 'KOIN', q: '' },
        view: 'lg', sig: '', pending: false, bound: false, busy: false, timer: null, photo: null
    };

    // ------------------------------------------------------------ util
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    };
    var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; };
    var round0 = function (n) { return Math.round(Number(n) || 0); };
    var nfIn = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });
    var rp = function (n) { var v = Math.round(Number(n) || 0); return (v < 0 ? '-Rp ' : 'Rp ') + new Intl.NumberFormat('id-ID').format(Math.abs(v)); };
    var nf = function (n) { return nfIn.format(Number(n) || 0); };
    // "1.234,5" / "1234.5" / "1,5" -> angka
    function pn(value) {
        var raw = String(value == null ? '' : value).trim(); if (!raw) return 0;
        var s = raw.replace(/[^\d,.\-]/g, '');
        if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
        else { var p = s.split('.'); if (p.length > 1 && /^\d{3}$/.test(p[p.length - 1])) s = p.join(''); }
        var n = parseFloat(s); return isFinite(n) ? n : 0;
    }
    function toast(icon, title) {
        if (window.Swal) window.Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
        else alert(title);
    }
    function ls(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function readArr(key) { try { var d = JSON.parse(ls(key)); return Array.isArray(d) ? d : []; } catch (e) { return []; } }
    function pad2(n) { return String(n).padStart(2, '0'); }
    function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function parseDate(v) {
        if (!v) return null; var s = String(v); if (s.indexOf('T') === -1) s = s.replace(' ', 'T');
        var d = new Date(s); return isNaN(d.getTime()) ? null : d;
    }
    function fmtDT(v) { var d = parseDate(v); return d ? pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : '-'; }
    function userName() { try { var u = getCurrentUser(); return (u && (u.fullName || u.username)) || 'Admin'; } catch (e) { return 'Admin'; } }
    function normCat(c) { return String(c || '').toUpperCase() === 'KOIN' ? 'KOIN' : 'UANG_LAMA'; }
    function catLabel(c) { return normCat(c) === 'KOIN' ? 'Koin' : 'Uang Lama'; }
    function baseCur(it) { var m = (String(it.code || '') + ' ' + String(it.desc || '')).toUpperCase().match(/[A-Z]{3}/); return m ? m[0] : ''; }
    function flag(code) { try { return typeof window.getFlagHtml === 'function' && code ? window.getFlagHtml(code) : esc(code || ''); } catch (e) { return esc(code || ''); } }

    // ------------------------------------------------------------ hak akses
    function cfg() {
        try { var u = getCurrentUser(); return (u && typeof getEffectiveAccessConfig === 'function') ? getEffectiveAccessConfig(u) : null; } catch (e) { return null; }
    }
    function can(key) {
        var c = cfg(); if (!c) return false;
        var a = c.actions || {}, sp = c.special || {};
        switch (key) {
            case 'edit': return !!a.edit;
            case 'delete': return !!a.delete;
            case 'editTrx': return !!(a.edit && a.oldMoneyEdit);
            case 'deleteTrx': return !!(a.delete && a.oldMoneyDelete);
            case 'profit': return a.profit !== false;
            case 'supplier': return !!sp.oldMoneySupplierManagement;
            default: return false;
        }
    }

    // ------------------------------------------------------------ penyimpanan (nama publik lama tetap)
    function push(key, data) { try { if (typeof window.pushToUniversalDatastore === 'function') return window.pushToUniversalDatastore(key, data); } catch (e) { /* abaikan */ } }
    window.getOldMoneyStock = function () { return readArr(K.stock); };
    window.getOldMoneyTrxs = function () { return readArr(K.trxs); };
    window.getOldMoneySuppliers = function () { return readArr(K.sup); };
    window.getOldMoneyCash = function () { return parseFloat(ls(K.cash)) || 0; };
    window.saveOldMoneyStock = async function (d) { localStorage.setItem(K.stock, JSON.stringify(d)); await push(K.stock, d); };
    window.saveOldMoneyTrxs = async function (d) { localStorage.setItem(K.trxs, JSON.stringify(d)); await push(K.trxs, d); };
    window.saveOldMoneySuppliers = async function (d) { localStorage.setItem(K.sup, JSON.stringify(d)); await push(K.sup, d); };
    window.saveOldMoneyCash = async function (v) { localStorage.setItem(K.cash, String(v)); await push(K.cash, Number(v)); };

    // ------------------------------------------------------------ master item
    function denomFromDesc(desc) {
        var m = String(desc || '').match(/[\d.,]+/); if (!m) return 1;
        var v = pn(m[0]); return v > 0 ? v : 1;
    }
    function normItem(it) {
        var refBuy = it.refBuy != null ? num(it.refBuy) : num(it.buyPrice);
        return {
            id: String(it.id || ''), category: normCat(it.category), code: String(it.code || ''), desc: String(it.desc || ''),
            denom: num(it.denom) > 0 ? num(it.denom) : denomFromDesc(it.desc),
            refBuy: refBuy, refSell: it.refSell != null ? num(it.refSell) : refBuy,
            minStock: num(it.minStock), photo: it.photo || null,
            qty: num(it.qty), valas: num(it.valas), costTotal: num(it.costTotal), buyPrice: num(it.buyPrice)
        };
    }

    // ------------------------------------------------------------ replay: stok, kas, harga pokok dari riwayat
    function trxTime(t) { var d = parseDate(t && t.date); return d ? d.getTime() : 0; }
    function replay(trxs, masterItems) {
        var stock = {}, order = [];
        (masterItems || []).forEach(function (m) {
            var it = normItem(m); it.qty = 0; it.valas = 0; it.costTotal = 0;
            stock[it.id] = it; order.push(it.id);
        });
        var idx = (trxs || []).map(function (t, i) { return { t: t, i: i }; });
        idx.sort(function (a, b) {
            var d = trxTime(a.t) - trxTime(b.t); if (d) return d;
            return String(a.t && a.t.id || '').localeCompare(String(b.t && b.t.id || ''));
        });
        var cash = 0, errors = [], out = new Array(trxs.length);
        var err = function (t, kind, msg) { errors.push({ key: String(t.id) + '|' + kind, id: t.id, msg: msg }); };
        idx.forEach(function (e) {
            var t = e.t, type = String(t.type || '').toUpperCase(), c = Object.assign({}, t);
            if (type === 'TOPUP') {
                cash += num(t.totalRp);
                if (num(t.totalRp) < 0 && cash < -0.5) err(t, 'KAS', 'Kas koin menjadi minus (' + rp(cash) + ')');
            } else if (type === 'ADJUST') {
                var s = stock[t.itemId], d = num(t.qty); c.costRp = 0;
                if (!s) err(t, 'ITEM', 'Item opname tidak ditemukan');
                else if (d >= 0) {
                    var avgQ = s.qty > 0 ? s.costTotal / s.qty : num(s.refBuy) * s.denom;
                    s.qty += d; s.valas += d * s.denom; s.costTotal += d * avgQ;
                } else {
                    if (s.qty < -d - 1e-9) err(t, 'STOK:' + s.id, 'Stok ' + (s.desc || s.code) + ' menjadi minus');
                    var r = s.qty > 0 ? Math.min(-d / s.qty, 1) : 0, co = s.costTotal * r;
                    c.costRp = co; s.qty += d; s.valas -= s.valas * r; s.costTotal -= co;
                }
            } else if (type === 'BELI' || type === 'JUAL') {
                var tot = 0;
                c.items = (t.items || []).map(function (l) {
                    var L = Object.assign({}, l), s2 = stock[L.itemId], q = num(L.qty), total = num(L.totalRp);
                    var valas = num(L.valasAmt) > 0 ? num(L.valasAmt) : (num(L.denom) || 1) * q;
                    L.valasAmt = valas; tot += total;
                    if (type === 'BELI') {
                        if (s2) { s2.qty += q; s2.valas += valas; s2.costTotal += total; L.buyPrice = s2.valas > 0 ? s2.costTotal / s2.valas : num(L.kurs); }
                        L.costRp = total;
                    } else if (!s2) { err(t, 'ITEM:' + L.itemId, 'Item ' + (L.itemDesc || L.itemId) + ' tidak ditemukan'); L.costRp = 0; }
                    else {
                        if (s2.qty < q - 1e-9) err(t, 'STOK:' + s2.id, 'Stok ' + (s2.desc || s2.code) + ' tidak cukup');
                        var ratio = s2.qty > 0 ? Math.min(q / s2.qty, 1) : 0, costOut = s2.costTotal * ratio, valasOut = s2.valas * ratio;
                        L.costRp = costOut; L.buyPrice = valasOut > 0 ? costOut / valasOut : (s2.valas > 0 ? s2.costTotal / s2.valas : num(s2.refBuy));
                        s2.qty -= q; s2.valas -= valasOut; s2.costTotal -= costOut;
                    }
                    return L;
                });
                cash += type === 'BELI' ? -tot : tot;
                if (type === 'BELI' && cash < -0.5) err(t, 'KAS', 'Kas koin tidak cukup (kurang ' + rp(-cash) + ')');
            }
            c.cashBalanceAfter = Math.round(cash);
            out[e.i] = c;
        });
        var items = order.map(function (id) {
            var s3 = stock[id];
            if (Math.abs(s3.qty) < 1e-9) { s3.qty = 0; s3.valas = 0; s3.costTotal = 0; }
            s3.buyPrice = s3.valas > 0 ? s3.costTotal / s3.valas : num(s3.refBuy);
            return s3;
        });
        return { stock: items, cash: Math.round(cash), trxs: out, errors: errors };
    }

    var cache = { raw: '', model: null };
    function model() {
        var raw = (ls(K.stock) || '') + '\u0001' + (ls(K.trxs) || '') + '\u0001' + (ls(K.cash) || '');
        if (cache.raw !== raw || !cache.model) { cache.raw = raw; cache.model = replay(window.getOldMoneyTrxs(), window.getOldMoneyStock()); }
        return cache.model;
    }
    function itemById(id) { return model().stock.filter(function (i) { return i.id === id; })[0] || null; }

    // validasi + simpan: tolak bila menimbulkan galat stok/kas baru
    async function commit(newTrxs, newMaster) {
        var master = newMaster || window.getOldMoneyStock();
        var before = {}; replay(window.getOldMoneyTrxs(), window.getOldMoneyStock()).errors.forEach(function (e) { before[e.key] = 1; });
        var after = replay(newTrxs, master);
        var fresh = after.errors.filter(function (e) { return !before[e.key]; });
        if (fresh.length) return { ok: false, msg: fresh[0].msg + (fresh[0].id ? ' [' + fresh[0].id + ']' : '') };
        await window.saveOldMoneyStock(after.stock);
        await window.saveOldMoneyCash(after.cash);
        await window.saveOldMoneyTrxs(after.trxs);
        cache.raw = '';
        return { ok: true, model: after };
    }

    // ------------------------------------------------------------ nomor dokumen
    function localNextId(trxs) {
        var used = {}; (trxs || []).forEach(function (t) { var m = String(t.id || '').match(/^OM-(\d+)$/i); if (m) used[parseInt(m[1], 10)] = 1; });
        var n = 1; while (used[n]) n++; return 'OM-' + String(n).padStart(4, '0');
    }
    async function nextTrxId() {
        var trxs = window.getOldMoneyTrxs(), hint = 0;
        trxs.forEach(function (t) { var m = String(t.id || '').match(/^OM-(\d+)$/i); if (m) hint = Math.max(hint, parseInt(m[1], 10)); });
        try {
            var f = window.authFetch || window.fetch;
            var csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
            var res = await f('api/pos/next-document', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf }, body: JSON.stringify({ prefix: 'OM', min_seq: hint }) });
            var j = await res.json().catch(function () { return {}; });
            if (res.ok && j.status === 'success' && j.data && j.data.id && !trxs.some(function (t) { return t.id === j.data.id; })) return j.data.id;
        } catch (e) { /* pakai nomor lokal */ }
        return localNextId(trxs);
    }

    // ------------------------------------------------------------ statistik
    function profitOf(t) {
        var type = String(t.type || '').toUpperCase();
        if (type === 'JUAL') return (t.items || []).reduce(function (s, l) { return s + num(l.totalRp) - num(l.costRp); }, 0);
        if (type === 'ADJUST') return -num(t.costRp);
        return 0;
    }
    function statsOf(trxs) {
        var now = new Date(), today = dayKey(now), month = now.getFullYear() + '-' + pad2(now.getMonth() + 1);
        var r = { profitToday: 0, profitMonth: 0, profitAll: 0, nToday: 0, beliToday: 0, jualToday: 0 };
        trxs.forEach(function (t) {
            var type = String(t.type || '').toUpperCase(), d = parseDate(t.date); if (!d) return;
            var p = profitOf(t), k = dayKey(d);
            r.profitAll += p; if (k.slice(0, 7) === month) r.profitMonth += p;
            if (k === today) { r.profitToday += p; if (type === 'BELI' || type === 'JUAL') { r.nToday++; if (type === 'BELI') r.beliToday += num(t.totalRp); else r.jualToday += num(t.totalRp); } }
        });
        return r;
    }
    function bestSupplier(item, kind) { // kind: 'terima' (kita jual ke pengepul: harga tertinggi) | 'jual' (kita beli dari pengepul: terendah)
        var cur = baseCur(item); if (!cur) return null;
        var list = window.getOldMoneySuppliers().filter(function (s) {
            return String(s.currency || '').toUpperCase() === cur && normCat(s.category || 'KOIN') === item.category && num(kind === 'terima' ? s.buyPrice : s.sellPrice) > 0;
        });
        if (!list.length) return null;
        list.sort(function (a, b) { return kind === 'terima' ? num(b.buyPrice) - num(a.buyPrice) : num(a.sellPrice) - num(b.sellPrice); });
        return { name: list[0].name, price: num(kind === 'terima' ? list[0].buyPrice : list[0].sellPrice) };
    }

    // ------------------------------------------------------------ gaya
    function injectStyle() {
        if ($('om-style')) return;
        var st = document.createElement('style'); st.id = 'om-style';
        st.textContent = [
            '.om-root,.om-ov{--om-bd:var(--mc-border,rgba(148,163,184,.28));--om-card:var(--mc-card-bg,#18181b);--om-tx:var(--mc-text,#fafafa);--om-mut:var(--mc-text-muted,#94a3b8);',
            '--om-pri:var(--mc-primary,#22c55e);--om-buy:var(--mc-buy,#22c55e);--om-bad:var(--mc-danger,#ef4444);--om-warn:var(--mc-warning,#f59e0b);--om-info:var(--mc-info,#38bdf8);',
            '--om-inp:var(--mc-input-bg,rgba(255,255,255,.04));--om-r:var(--mc-radius,14px);color:var(--om-tx)}',
            '.om-root *,.om-ov *{box-sizing:border-box}',
            '.om-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
            '.om-head h2{margin:0;font-size:1.25rem;display:flex;gap:9px;align-items:center}.om-head h2 i{color:var(--om-warn)}',
            '.om-head p{margin:4px 0 0;color:var(--om-mut);font-size:.85rem;max-width:660px}.om-tools{display:flex;gap:8px;flex-wrap:wrap}',
            '.om-btn{border:1px solid var(--om-bd);background:transparent;color:var(--om-tx);padding:8px 13px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:700;font-size:.82rem;display:inline-flex;gap:7px;align-items:center;white-space:nowrap}',
            '.om-btn:hover{background:var(--om-inp)}.om-btn[disabled]{opacity:.5;cursor:not-allowed}',
            '.om-btn.pri{background:var(--om-pri);border-color:var(--om-pri);color:#fff}.om-btn.pri:hover{filter:brightness(1.08)}',
            '.om-btn.bad{color:var(--om-bad);border-color:color-mix(in srgb,var(--om-bad) 45%,transparent)}.om-btn.sm{padding:5px 9px;font-size:.76rem}.om-btn.ico{padding:6px 9px}',
            '.om-btn.wa{color:#25d366;border-color:color-mix(in srgb,#25d366 45%,transparent)}.om-btn.blk{width:100%;justify-content:center;padding:11px}',
            '.om-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:12px}',
            '.om-stat{background:var(--om-card);border:1px solid var(--om-bd);border-radius:var(--om-r);padding:12px 14px}',
            '.om-stat small{display:block;color:var(--om-mut);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}',
            '.om-stat b{display:block;font-size:1.25rem;margin-top:3px}.om-stat span{color:var(--om-mut);font-size:.76rem;display:block;margin-top:2px}',
            '.om-stat.g b{color:var(--om-buy)}.om-stat.w b{color:var(--om-warn)}.om-stat.b b{color:var(--om-info)}',
            '.om-tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;border-bottom:1px solid var(--om-bd)}',
            '.om-tabs button{border:0;background:transparent;color:var(--om-mut);padding:10px 14px;font-weight:700;font-size:.85rem;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}',
            '.om-tabs button.on{color:var(--om-tx);border-bottom-color:var(--om-pri)}.om-tabs button em{font-style:normal;background:var(--om-inp);border-radius:999px;padding:1px 7px;font-size:.7rem;margin-left:5px}',
            '.om-panel{background:var(--om-card);border:1px solid var(--om-bd);border-radius:var(--om-r);padding:14px}.om-panel h3{margin:0 0 10px;font-size:1rem;display:flex;gap:8px;align-items:center}',
            '.om-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.9fr);gap:14px;align-items:start}@media(max-width:1100px){.om-layout{grid-template-columns:1fr}}',
            '.om-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}',
            '.om-seg{display:inline-flex;border:1px solid var(--om-bd);border-radius:10px;overflow:hidden}.om-seg button{border:0;background:transparent;color:var(--om-mut);padding:8px 13px;font-weight:700;font-size:.8rem;cursor:pointer;border-right:1px solid var(--om-bd)}',
            '.om-seg button:last-child{border-right:0}.om-seg button.on{background:var(--om-pri);color:#fff}.om-seg button.on.beli{background:var(--om-bad)}.om-seg button.on.jual{background:var(--om-buy)}',
            '.om-in{background:var(--om-inp);border:1px solid var(--mc-input-border,var(--om-bd));color:var(--om-tx);border-radius:var(--mc-input-radius,10px);padding:8px 11px;font-size:.85rem;font-family:inherit;min-width:0}',
            '.om-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;max-height:520px;overflow-y:auto;padding:2px}',
            '.om-card{border:1px solid var(--om-bd);border-radius:12px;padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:6px;background:var(--om-card)}',
            '.om-card:hover{border-color:var(--om-pri)}.om-card.sel{border-color:var(--om-pri);box-shadow:0 0 0 1px var(--om-pri)}.om-card.low{border-color:color-mix(in srgb,var(--om-warn) 60%,transparent)}',
            '.om-card .ph{height:64px;border-radius:8px;background:var(--om-inp) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--om-mut);font-size:1.4rem}',
            '.om-card b{font-size:.9rem;line-height:1.2}.om-card small{color:var(--om-mut);font-size:.72rem}.om-row{display:flex;justify-content:space-between;gap:6px;font-size:.76rem;color:var(--om-mut)}.om-row b{color:var(--om-tx);font-size:.78rem}',
            '.om-grid.v-xl{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}.om-grid.v-xl .ph{height:150px;font-size:2.6rem}.om-grid.v-xl b{font-size:1.05rem}',
            '.om-grid.v-lg{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}.om-grid.v-lg .ph{height:90px;font-size:1.8rem}',
            '.om-grid.v-md{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}.om-grid.v-md .ph{height:50px}.om-grid.v-md .om-card{padding:8px}',
            '.om-grid.v-sm{grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:6px}.om-grid.v-sm .om-card{padding:6px 8px;gap:2px}',
            '.om-grid.v-list,.om-grid.v-content{grid-template-columns:1fr;gap:6px}.om-grid.v-list .om-card{flex-direction:row;align-items:center;gap:12px;padding:7px 12px}.om-grow{flex:1;color:var(--om-mut);font-size:.82rem}',
            '.om-grid.v-tiles{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}.om-grid.v-tiles .om-card,.om-grid.v-content .om-card{flex-direction:row;align-items:center;gap:10px}',
            '.om-grid.v-tiles .ph,.om-grid.v-content .ph{width:64px;height:64px;flex:0 0 64px}.om-grid.v-content .ph{width:80px;height:80px;flex-basis:80px}.om-tb{display:flex;flex-direction:column;gap:2px;min-width:0}',
            '.om-vw{position:relative}.om-vm{position:absolute;right:0;top:calc(100% + 6px);z-index:50;background:var(--om-card);border:1px solid var(--om-bd);border-radius:12px;padding:6px;min-width:210px;box-shadow:0 14px 40px rgba(0,0,0,.4)}',
            '.om-vm[hidden]{display:none}.om-vm button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:var(--om-tx);padding:8px 10px;border-radius:8px;cursor:pointer;font-size:.86rem;text-align:left}',
            '.om-vm button:hover{background:var(--om-inp)}.om-vm button .dot{width:10px;text-align:center;color:var(--om-pri);font-weight:900}.om-vm button i{width:18px;text-align:center;color:var(--om-mut)}',
            '.om-table tr.sel{background:color-mix(in srgb,var(--om-pri) 14%,transparent)}',
            '.om-empty{text-align:center;padding:36px 14px;color:var(--om-mut);border:1px dashed var(--om-bd);border-radius:var(--om-r)}',
            '.om-f{margin-bottom:10px}.om-f label{display:block;font-size:.72rem;color:var(--om-mut);font-weight:700;margin-bottom:4px}.om-f .om-in{width:100%}',
            '.om-r2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.om-r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}@media(max-width:560px){.om-r2,.om-r3{grid-template-columns:1fr}}',
            '.om-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.om-chips button{border:1px solid var(--om-bd);background:transparent;color:var(--om-tx);border-radius:999px;padding:3px 10px;font-size:.74rem;font-weight:700;cursor:pointer}',
            '.om-hint{font-size:.76rem;color:var(--om-mut);margin-top:4px}.om-hint.ok{color:var(--om-buy)}.om-hint.bad{color:var(--om-bad)}.om-hint.warn{color:var(--om-warn)}',
            '.om-sel{background:var(--om-inp);border:1px dashed var(--om-bd);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:.85rem}',
            '.om-line{border:1px solid var(--om-bd);border-radius:10px;padding:9px 11px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.om-line b{font-size:.86rem}.om-line small{color:var(--om-mut);display:block;font-size:.74rem}',
            '.om-total{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px dashed var(--om-bd);margin-top:6px;font-weight:800}.om-total span:last-child{font-size:1.25rem}',
            '.om-ban{border:1px solid var(--om-warn);background:color-mix(in srgb,var(--om-warn) 12%,transparent);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:.84rem;display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap}',
            '.om-tw{overflow-x:auto}.om-table{width:100%;border-collapse:collapse;min-width:760px}.om-table th{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--om-mut);text-align:left;padding:9px 8px;border-bottom:1px solid var(--om-bd);white-space:nowrap}',
            '.om-table td{padding:9px 8px;border-bottom:1px dashed var(--om-bd);vertical-align:top;font-size:.84rem}.om-table tr:last-child td{border-bottom:0}.om-table tbody tr:hover{background:var(--om-inp)}.om-table .r{text-align:right}.om-table .nw{white-space:nowrap}',
            '.om-table tfoot td{font-weight:800;border-top:1px solid var(--om-bd)}',
            '.om-tag{display:inline-block;border-radius:999px;padding:2px 9px;font-size:.7rem;font-weight:800}.om-tag.beli{background:color-mix(in srgb,var(--om-bad) 16%,transparent);color:var(--om-bad)}.om-tag.jual{background:color-mix(in srgb,var(--om-buy) 16%,transparent);color:var(--om-buy)}',
            '.om-tag.topup{background:color-mix(in srgb,var(--om-info) 16%,transparent);color:var(--om-info)}.om-tag.adjust{background:color-mix(in srgb,var(--om-warn) 18%,transparent);color:var(--om-warn)}.om-tag.low{background:color-mix(in srgb,var(--om-warn) 18%,transparent);color:var(--om-warn)}',
            '.om-sub{display:block;color:var(--om-mut);font-size:.73rem;margin-top:2px}.om-act{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.om-pos{color:var(--om-buy)}.om-neg{color:var(--om-bad)}',
            '.om-sum{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.om-sum span{border:1px solid var(--om-bd);border-radius:999px;padding:4px 11px;font-size:.78rem;font-weight:700}',
            '.om-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10050;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:4vh 12px}',
            '.om-md{background:var(--mc-card-bg,#18181b);color:var(--mc-text,#fafafa);border:1px solid var(--om-bd);border-radius:var(--mc-radius,14px);width:100%;max-width:620px;box-shadow:0 24px 60px rgba(0,0,0,.5)}.om-md.wide{max-width:820px}',
            '.om-mh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--om-bd)}.om-mh h3{margin:0;font-size:1.05rem}.om-mx{border:0;background:transparent;color:inherit;font-size:1.3rem;cursor:pointer;opacity:.7}',
            '.om-mb{padding:16px 18px}.om-mf{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--om-bd)}',
            '.om-ph{width:96px;height:96px;border-radius:10px;border:1px dashed var(--om-bd);background:var(--om-inp) center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--om-mut);font-size:.7rem;text-align:center}',
            '.om-kv{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed var(--om-bd);font-size:.86rem}.om-kv:last-child{border-bottom:0}.om-kv span{color:var(--om-mut)}',
            '.om-help li{margin-bottom:6px;font-size:.86rem;line-height:1.45}.om-badge{background:var(--om-inp);border-radius:8px;padding:1px 7px;font-weight:700;font-size:.78rem}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ modal ringan
    function openModal(opt) {
        closeModal();
        var ov = document.createElement('div'); ov.className = 'om-ov'; ov.id = 'omModal';
        ov.innerHTML = '<div class="om-md ' + (opt.wide ? 'wide' : '') + '" role="dialog" aria-modal="true"><div class="om-mh"><h3>' + opt.title + '</h3><button class="om-mx" data-om="close" aria-label="Tutup">&times;</button></div>' +
            '<div class="om-mb">' + opt.body + '</div><div class="om-mf">' + (opt.footer || '') + '</div></div>';
        document.body.appendChild(ov);
        if (opt.dismissable !== false) ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
        if (typeof opt.onOpen === 'function') opt.onOpen(ov);
        return ov;
    }
    function closeModal() { var m = $('omModal'); if (m) m.remove(); S.photo = null; }
    function modalOpen() { return !!$('omModal'); }
    var ERR = '<div id="omErr" style="display:none;color:var(--mc-danger,#ef4444);font-weight:700;font-size:.84rem;margin:8px 0"></div>';
    function showErr(msg) { var el = $('omErr'); if (!el) return toast('error', msg); el.style.display = msg ? 'block' : 'none'; el.textContent = msg || ''; }
    function confirmBox(title, text, okLabel, danger) {
        return new Promise(function (resolve) {
            var ov = openModal({ title: title, body: '<p style="margin:0;line-height:1.5">' + text + '</p>', dismissable: false,
                footer: '<button class="om-btn" data-om="cn">Batal</button><button class="om-btn ' + (danger ? 'bad' : 'pri') + '" data-om="ok">' + okLabel + '</button>' });
            ov.addEventListener('click', function (e) {
                var b = e.target.closest('[data-om]'); if (!b) return;
                if (b.dataset.om === 'ok') { closeModal(); resolve(true); } else if (b.dataset.om === 'cn' || b.dataset.om === 'close') { closeModal(); resolve(false); }
            });
        });
    }

    // ------------------------------------------------------------ rangka halaman
    function shell() {
        var root = $('omRoot'); if (!root) return null;
        if (root.dataset.ready === '1') return root;
        root.className = 'om-root';
        root.innerHTML = '<div class="om-head"><div><h2><i class="fa-solid fa-coins"></i> Koin Asing & Uang Kertas Lama</h2>' +
            '<p>Kasir mandiri: kas, stok, dan laba terpisah dari transaksi utama. Stok dan kas selalu dihitung dari riwayat, sehingga bisa diaudit.</p></div>' +
            '<div class="om-tools"><button class="om-btn" data-om="help"><i class="fa-regular fa-circle-question"></i> Cara pakai</button>' +
            '<button class="om-btn pri" data-om="item-new"><i class="fa-solid fa-plus"></i> Tambah Item</button></div></div>' +
            '<div id="omStats" class="om-stats"></div><div id="omNotice"></div><div id="omTabs" class="om-tabs"></div><div id="omBody"></div>';
        root.dataset.ready = '1';
        return root;
    }
    function renderStats() {
        var m = model(), st = statsOf(m.trxs), val = m.stock.reduce(function (s, i) { return s + i.costTotal; }, 0);
        var low = m.stock.filter(function (i) { return i.minStock > 0 && i.qty <= i.minStock; }).length;
        var h = '<div class="om-stat w"><small>Kas koin (Rp)</small><b>' + rp(m.cash) + '</b><span><a href="#" data-om="cash-in" style="color:var(--om-info)">+ Topup</a> &nbsp; <a href="#" data-om="cash-out" style="color:var(--om-info)">&minus; Tarik</a></span></div>' +
            '<div class="om-stat g"><small>Nilai stok (harga pokok)</small><b>' + rp(val) + '</b><span>' + m.stock.filter(function (i) { return i.qty > 0; }).length + ' item ada stok' + (low ? ' &middot; <span class="om-neg">' + low + ' menipis</span>' : '') + '</span></div>';
        if (can('profit')) h += '<div class="om-stat b"><small>Laba (realisasi)</small><b>' + rp(st.profitMonth) + '</b><span>Hari ini ' + rp(st.profitToday) + ' &middot; total ' + rp(st.profitAll) + '</span></div>';
        h += '<div class="om-stat"><small>Transaksi hari ini</small><b>' + st.nToday + '</b><span>Beli ' + rp(st.beliToday) + ' &middot; Jual ' + rp(st.jualToday) + '</span></div>';
        $('omStats').innerHTML = h;
    }
    function renderNotice() {
        var m = model(), el = $('omNotice'); if (!el) return;
        var storedCash = window.getOldMoneyCash(), msgs = [];
        if (Math.abs(storedCash - m.cash) > 0.5) msgs.push('kas tersimpan ' + rp(storedCash) + ' &ne; hitungan riwayat ' + rp(m.cash));
        var stored = {}; window.getOldMoneyStock().forEach(function (i) { stored[i.id] = num(i.qty); });
        var diff = m.stock.filter(function (i) { return Math.abs((stored[i.id] || 0) - i.qty) > 1e-9; }).length;
        if (diff) msgs.push(diff + ' item stok berbeda dengan hitungan riwayat');
        if (!msgs.length) { el.innerHTML = ''; return; }
        el.innerHTML = '<div class="om-ban"><div><b><i class="fa-solid fa-triangle-exclamation"></i> Saldo tersimpan tidak sama dengan riwayat:</b> ' + msgs.join('; ') + '. Tampilan di bawah memakai hitungan riwayat.</div>' +
            '<button class="om-btn sm" data-om="reconcile">Terapkan hitungan riwayat</button></div>';
    }
    function renderTabs() {
        var m = model(), nTrx = m.trxs.filter(function (t) { return ['BELI', 'JUAL'].indexOf(String(t.type).toUpperCase()) !== -1; }).length;
        var defs = [['kasir', 'Kasir', 'fa-cash-register', S.cart.length || ''], ['stok', 'Stok & Item', 'fa-boxes-stacked', m.stock.length], ['riwayat', 'Riwayat', 'fa-clock-rotate-left', nTrx], ['kas', 'Kas Koin', 'fa-wallet', ''], ['acuan', 'Acuan Harga', 'fa-handshake', window.getOldMoneySuppliers().length]];
        $('omTabs').innerHTML = defs.map(function (d) {
            return '<button data-om="tab" data-v="' + d[0] + '" class="' + (S.tab === d[0] ? 'on' : '') + '"><i class="fa-solid ' + d[2] + '"></i> ' + d[1] + (d[3] !== '' ? '<em>' + d[3] + '</em>' : '') + '</button>';
        }).join('');
    }
    function renderBody() {
        var b = $('omBody'); if (!b) return;
        if (S.tab === 'kasir') b.innerHTML = kasirFrame();
        else if (S.tab === 'stok') b.innerHTML = stokHtml();
        else if (S.tab === 'riwayat') b.innerHTML = riwayatHtml();
        else if (S.tab === 'kas') b.innerHTML = kasHtml();
        else b.innerHTML = acuanHtml();
        if (S.tab === 'kasir') { renderCatalog(); renderEntry(); renderCart(); }
    }
    function typing() {
        var a = document.activeElement, r = $('omRoot');
        return !!(a && r && r.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
    }
    // render penuh; fokus, isi, dan posisi kursor kolom yang sedang diketik dipertahankan
    function render() {
        injectStyle(); if (!shell()) return;
        var a = document.activeElement, keep = null;
        if (a && a.id && $('omRoot') && $('omRoot').contains(a)) {
            keep = { id: a.id, v: a.value, s: null, e: null };
            try { keep.s = a.selectionStart; keep.e = a.selectionEnd; } catch (x) { /* tipe input tanpa seleksi */ }
        }
        var ent = {}; ['omQty', 'omKurs', 'omTotal'].forEach(function (k) { if ($(k)) ent[k] = $(k).value; });
        renderStats(); renderNotice(); renderTabs(); renderBody();
        if (S.tab === 'kasir' && S.sel) Object.keys(ent).forEach(function (k) { if ($(k) && ent[k] !== '') $(k).value = ent[k]; });
        if (keep && $(keep.id)) {
            var n = $(keep.id); if (n !== document.activeElement) n.focus();
            if (n.value !== keep.v && keep.id.indexOf('Qty') === -1 && keep.id !== 'omKurs' && keep.id !== 'omTotal') n.value = keep.v;
            try { if (keep.s != null) n.setSelectionRange(keep.s, keep.e); } catch (x) { /* abaikan */ }
        }
        S.sig = signature();
    }
    // render karena data berubah dari luar (sinkronisasi/perangkat lain): tunda bila pengguna sedang mengetik
    function softRender() {
        var r = $('omRoot'); if (!r || r.offsetParent === null) return;
        if (signature() === S.sig) return;
        if (modalOpen() || S.busy || typing()) { S.pending = true; return; }
        S.pending = false; render();
    }
    function signature() { return (ls(K.stock) || '').length + ':' + (ls(K.trxs) || '').length + ':' + (ls(K.cash) || '') + ':' + (ls(K.sup) || '').length + ':' + (ls('mc_customers') || '').length; }

    // ------------------------------------------------------------ TAB KASIR
    function saveDraft() { try { sessionStorage.setItem('mc_om_draft', JSON.stringify({ cart: S.cart, type: S.type, cp: S.cp, note: S.note, editing: S.editing })); } catch (e) { /* abaikan */ } }
    function loadDraft() {
        try { var d = JSON.parse(sessionStorage.getItem('mc_om_draft') || 'null'); if (d && Array.isArray(d.cart)) { S.cart = d.cart; S.type = d.type || 'BELI'; S.cp = d.cp || S.cp; S.note = d.note || ''; S.editing = d.editing || null; } } catch (e) { /* abaikan */ }
    }
    var VIEWS = [['xl', 'Extra large icons', 'fa-regular fa-image'], ['lg', 'Large icons', 'fa-regular fa-square'], ['md', 'Medium icons', 'fa-solid fa-table-cells-large'], ['sm', 'Small icons', 'fa-solid fa-table-cells'],
        ['list', 'List', 'fa-solid fa-list'], ['details', 'Details', 'fa-solid fa-bars'], ['tiles', 'Tiles', 'fa-solid fa-grip'], ['content', 'Content', 'fa-solid fa-list-check']];
    function viewDef() { return VIEWS.filter(function (v) { return v[0] === S.view; })[0] || VIEWS[1]; }
    function loadView() { try { var v = localStorage.getItem('om_view_mode'); if (v && VIEWS.some(function (x) { return x[0] === v; })) S.view = v; } catch (e) { /* abaikan */ } }
    function viewMenuHtml() {
        return VIEWS.map(function (v) {
            return '<button type="button" data-om="view" data-v="' + v[0] + '" class="' + (S.view === v[0] ? 'on' : '') + '"><span class="dot">' + (S.view === v[0] ? '&bull;' : '') + '</span><i class="' + v[2] + '"></i><span>' + v[1] + '</span></button>';
        }).join('');
    }
    function kasirFrame() {
        return '<div class="om-layout"><div class="om-panel"><div class="om-bar">' +
            '<div class="om-seg" id="omCatSeg"><button data-om="cat" data-v="KOIN">Koin</button><button data-om="cat" data-v="UANG_LAMA">Uang Lama</button></div>' +
            '<input class="om-in" id="omQ" type="search" placeholder="Cari kode / nama item..." value="' + esc(S.q) + '" style="flex:0 1 200px;width:200px;min-width:120px">' +
            '<div class="om-vw"><button type="button" class="om-btn ico" data-om="viewmenu" title="Tampilan" aria-haspopup="true"><i class="' + viewDef()[2] + '"></i> <i class="fa-solid fa-chevron-down" style="font-size:.6rem"></i></button><div class="om-vm" id="omViewMenu" hidden>' + viewMenuHtml() + '</div></div></div>' +
            '<div id="omCatalog"></div><div id="omEntry" style="margin-top:12px"></div></div>' +
            '<div class="om-panel" id="omCart"></div></div>';
    }
    function photoHtml(i) { return '<div class="ph" style="' + (i.photo ? 'background-image:url(\'' + esc(i.photo) + '\')' : '') + '">' + (i.photo ? '' : '<i class="fa-solid fa-coins"></i>') + '</div>'; }
    function itemHtml(i, mode) {
        var low = i.minStock > 0 && i.qty <= i.minStock, cls = 'om-card' + (S.sel === i.id ? ' sel' : '') + (low ? ' low' : '');
        var at = ' data-om="pick" data-id="' + esc(i.id) + '"';
        var stokB = '<b class="' + (i.qty > 0 ? 'om-pos' : 'om-neg') + '">' + nf(i.qty) + '</b>';
        if (mode === 'sm') return '<div class="' + cls + '"' + at + ' title="' + esc(i.desc) + '"><b>' + flag(i.code) + '</b><span class="om-sub">' + stokB + ' &middot; ' + nf(i.denom) + '</span></div>';
        if (mode === 'list') return '<div class="' + cls + '"' + at + '><b>' + flag(i.code) + '</b><span class="om-grow">' + esc(i.desc) + '</span><span>Stok ' + stokB + '</span></div>';
        if (mode === 'tiles') return '<div class="' + cls + '"' + at + '>' + photoHtml(i) + '<div class="om-tb"><b>' + flag(i.code) + '</b><small>' + esc(i.desc) + '</small><span class="om-sub">Stok ' + stokB + ' &middot; nominal ' + nf(i.denom) + '</span></div></div>';
        if (mode === 'content') return '<div class="' + cls + '"' + at + '>' + photoHtml(i) + '<div class="om-tb"><b>' + flag(i.code) + ' &middot; ' + esc(i.desc) + '</b>' +
            '<span class="om-sub">Stok ' + stokB + ' &middot; nominal ' + nf(i.denom) + ' &middot; total valas ' + nf(i.valas) + (i.minStock ? ' &middot; min ' + nf(i.minStock) : '') + '</span>' +
            '<span class="om-sub">Modal rata-rata ' + (i.buyPrice ? rp(i.buyPrice) : '-') + ' &middot; saran beli ' + (i.refBuy ? rp(i.refBuy) : '-') + ' &middot; saran jual ' + (i.refSell ? rp(i.refSell) : '-') + '</span></div></div>';
        return '<div class="' + cls + '"' + at + '>' + photoHtml(i) + '<b>' + flag(i.code) + '</b><small>' + esc(i.desc) + '</small>' +
            '<div class="om-row"><span>Stok</span>' + stokB + '</div><div class="om-row"><span>Nominal</span><b>' + nf(i.denom) + '</b></div><div class="om-row"><span>Modal/valas</span><b>' + (i.buyPrice ? nf(i.buyPrice) : '-') + '</b></div></div>';
    }
    function renderCatalog() {
        var host = $('omCatalog'); if (!host) return;
        document.querySelectorAll('#omCatSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === S.cat); });
        var q = S.q.trim().toLowerCase();
        var items = model().stock.filter(function (i) { return i.category === S.cat && (!q || (i.code + ' ' + i.desc).toLowerCase().indexOf(q) !== -1); });
        if (!items.length) { host.innerHTML = '<div class="om-empty"><i class="fa-solid fa-coins" style="font-size:1.6rem;display:block;margin-bottom:8px;opacity:.6"></i>Belum ada item ' + catLabel(S.cat).toLowerCase() + (q ? ' yang cocok' : '') + '. <a href="#" data-om="item-new" style="color:var(--om-info)">Tambah item</a></div>'; return; }
        if (S.view === 'details') {
            host.innerHTML = '<div class="om-tw" style="max-height:520px;overflow-y:auto"><table class="om-table" style="min-width:560px"><thead><tr><th>Item</th><th style="text-align:right">Nominal</th><th style="text-align:right">Stok</th><th style="text-align:right">Modal/valas</th><th style="text-align:right">Saran beli / jual</th></tr></thead><tbody>' +
                items.map(function (i) {
                    return '<tr class="om-pick' + (S.sel === i.id ? ' sel' : '') + '" data-om="pick" data-id="' + esc(i.id) + '" style="cursor:pointer"><td>' + flag(i.code) + '<span class="om-sub">' + esc(i.desc) + '</span></td><td style="text-align:right">' + nf(i.denom) + '</td>' +
                        '<td style="text-align:right"><b class="' + (i.qty > 0 ? 'om-pos' : 'om-neg') + '">' + nf(i.qty) + '</b></td><td style="text-align:right">' + (i.buyPrice ? rp(i.buyPrice) : '-') + '</td><td style="text-align:right">' + (i.refBuy ? rp(i.refBuy) : '-') + ' / ' + (i.refSell ? rp(i.refSell) : '-') + '</td></tr>';
                }).join('') + '</tbody></table></div>';
            return;
        }
        host.innerHTML = '<div class="om-grid v-' + S.view + '">' + items.map(function (i) { return itemHtml(i, S.view); }).join('') + '</div>';
    }
    function cartQtyOf(id) { return S.cart.filter(function (l) { return l.itemId === id; }).reduce(function (s, l) { return s + num(l.qty); }, 0); }
    function renderEntry() {
        var host = $('omEntry'); if (!host) return;
        var it = S.sel ? itemById(S.sel) : null;
        if (!it) { host.innerHTML = '<div class="om-empty" style="padding:22px">Pilih item di atas untuk mulai mengisi transaksi.</div>'; return; }
        var kurs0 = S.type === 'BELI' ? it.refBuy : it.refSell;
        host.innerHTML = '<div class="om-sel"><b>' + flag(it.code) + ' &middot; ' + esc(it.desc) + '</b><span class="om-sub">' + catLabel(it.category) + ' &middot; nominal ' + nf(it.denom) + ' per keping/lembar &middot; stok ' + nf(it.qty - cartQtyOf(it.id)) + ' tersedia &middot; modal rata-rata ' + (it.buyPrice ? rp(it.buyPrice) + '/valas' : '-') + '</span></div>' +
            '<div class="om-r3"><div class="om-f"><label>Jumlah keping / lembar</label><input class="om-in" id="omQty" inputmode="numeric" placeholder="0" autocomplete="off">' +
            '<div class="om-chips"><button data-om="qty+" data-v="1">+1</button><button data-om="qty+" data-v="10">+10</button><button data-om="qty+" data-v="50">+50</button><button data-om="qty+" data-v="100">+100</button></div></div>' +
            '<div class="om-f"><label>Jumlah valas</label><input class="om-in" id="omValas" readonly placeholder="otomatis"></div>' +
            '<div class="om-f"><label>Kurs (Rp / valas)</label><input class="om-in" id="omKurs" inputmode="decimal" autocomplete="off" value="' + (kurs0 ? nf(kurs0) : '') + '"></div></div>' +
            '<div class="om-r2"><div class="om-f"><label>Total kesepakatan (Rp) &mdash; boleh diubah, kurs menyesuaikan</label><input class="om-in" id="omTotal" inputmode="numeric" autocomplete="off" placeholder="0"></div>' +
            '<div class="om-f"><label>&nbsp;</label><button class="om-btn pri blk" data-om="add"><i class="fa-solid fa-cart-plus"></i> Tambah ke keranjang</button></div></div><div id="omHint" class="om-hint"></div>';
        entryCalc('qty');
    }
    function entryVals() {
        var it = S.sel ? itemById(S.sel) : null; if (!it) return null;
        var qty = Math.floor(pn(($('omQty') || {}).value)), valas = qty * it.denom;
        return { it: it, qty: qty, valas: valas, kurs: pn(($('omKurs') || {}).value), total: pn(($('omTotal') || {}).value) };
    }
    function entryCalc(source) {
        var v = entryVals(); if (!v) return;
        var valasEl = $('omValas'), kEl = $('omKurs'), tEl = $('omTotal');
        if (valasEl) valasEl.value = v.valas ? nf(v.valas) : '';
        if (source === 'total') { if (v.valas > 0 && v.total > 0) kEl.value = nf(Math.round(v.total / v.valas * 10000) / 10000); }
        else { tEl.value = v.valas > 0 && v.kurs > 0 ? new Intl.NumberFormat('id-ID').format(round0(v.valas * v.kurs)) : ''; }
        entryHint();
    }
    function entryHint() {
        var v = entryVals(), el = $('omHint'); if (!v || !el) return;
        var total = pn(($('omTotal') || {}).value), kurs = total > 0 && v.valas > 0 ? total / v.valas : v.kurs, parts = [], cls = '';
        if (S.type === 'JUAL') {
            var avail = v.it.qty - cartQtyOf(v.it.id);
            if (v.qty > avail) { parts.push('Stok tidak cukup (tersedia ' + nf(avail) + ').'); cls = 'bad'; }
            else if (v.it.buyPrice > 0 && kurs > 0 && v.valas > 0) {
                var p = total - v.it.buyPrice * v.valas, pct = v.it.buyPrice * v.valas ? p / (v.it.buyPrice * v.valas) * 100 : 0;
                parts.push((p >= 0 ? 'Perkiraan laba ' : 'RUGI ') + rp(Math.abs(p)) + ' (' + pct.toFixed(1) + '% dari modal)'); cls = p >= 0 ? 'ok' : 'bad';
            }
            var best = bestSupplier(v.it, 'terima'); if (best) parts.push('Acuan pengepul: ' + rp(best.price) + '/valas (' + esc(best.name) + ')');
        } else {
            if (v.it.refBuy > 0 && kurs > 0) { var d = kurs - v.it.refBuy; parts.push('Saran beli ' + rp(v.it.refBuy) + ' &middot; selisih ' + (d >= 0 ? '+' : '') + rp(d)); cls = d > 0 ? 'warn' : 'ok'; }
            var bs = bestSupplier(v.it, 'terima');
            if (bs && kurs > 0 && v.valas > 0) { var pot = (bs.price - kurs) * v.valas; parts.push('Jika dijual ke ' + esc(bs.name) + ' (' + rp(bs.price) + '/valas): ' + (pot >= 0 ? 'laba ' : 'rugi ') + rp(Math.abs(pot))); }
        }
        el.className = 'om-hint ' + cls; el.innerHTML = parts.join(' &middot; ');
    }
    function pickItem(id) {
        S.sel = id; renderCatalog(); renderEntry(); var q = $('omQty'); if (q) q.focus();
    }
    function addToCart() {
        var v = entryVals(); if (!v) return toast('warning', 'Pilih item terlebih dahulu.');
        var total = round0(pn(($('omTotal') || {}).value));
        if (v.qty <= 0) return toast('warning', 'Jumlah keping / lembar harus lebih dari 0.');
        if (total <= 0) return toast('warning', 'Total kesepakatan harus lebih dari 0.');
        if (S.type === 'JUAL' && v.qty > v.it.qty - cartQtyOf(v.it.id)) return toast('error', 'Stok ' + (v.it.desc || v.it.code) + ' tidak cukup.');
        S.cart.push({ itemId: v.it.id, itemCode: v.it.code, itemDesc: v.it.desc, denom: v.it.denom, valasAmt: v.valas, kurs: Math.round(total / v.valas * 10000) / 10000, qty: v.qty, totalRp: total, type: S.type, category: v.it.category });
        saveDraft(); renderCart(); renderTabs(); renderEntry(); renderCatalog();
        var q = $('omQty'); if (q) q.focus();
    }
    function cartTotal() { return S.cart.reduce(function (s, l) { return s + num(l.totalRp); }, 0); }
    function customersList() { try { return typeof getCustomers === 'function' ? getCustomers() : []; } catch (e) { return []; } }
    function custLabel(c) { return String(c.id_nasabah) + ' — ' + (c.nama || '') + (c.no_hp ? ' — ' + c.no_hp : ''); }
    function renderCart() {
        var host = $('omCart'); if (!host) return;
        var m = model(), total = cartTotal(), isBeli = S.type === 'BELI';
        var cashNow = m.cash, cashAfter = isBeli ? cashNow - total : cashNow + total;
        if (S.editing) { var old = m.trxs.filter(function (t) { return t.id === S.editing.id; })[0]; if (old) { var ot = num(old.totalRp); cashNow = m.cash + (String(old.type).toUpperCase() === 'BELI' ? ot : -ot); cashAfter = isBeli ? cashNow - total : cashNow + total; } }
        var cust = customersList();
        var cp = S.cp;
        var cpHtml = '<div class="om-seg" style="margin-bottom:8px"><button data-om="cp" data-v="WALKIN" class="' + (cp.kind === 'WALKIN' ? 'on' : '') + '">Walk-in</button><button data-om="cp" data-v="CUSTOMER" class="' + (cp.kind === 'CUSTOMER' ? 'on' : '') + '">Nasabah</button><button data-om="cp" data-v="SUPPLIER" class="' + (cp.kind === 'SUPPLIER' ? 'on' : '') + '">Pengepul</button></div>';
        if (cp.kind === 'CUSTOMER') {
            var cur = cust.filter(function (c) { return String(c.id_nasabah) === cp.customerId; })[0];
            cpHtml += '<input class="om-in" id="omCust" list="omCustList" style="width:100%" placeholder="Ketik ID / nama / no. telp nasabah" value="' + esc(cur ? custLabel(cur) : '') + '" autocomplete="off"><datalist id="omCustList">' + cust.map(function (c) { return '<option value="' + esc(custLabel(c)) + '"></option>'; }).join('') + '</datalist>';
        } else if (cp.kind === 'SUPPLIER') {
            var sups = window.getOldMoneySuppliers(), names = {}; sups.forEach(function (s) { names[s.name] = s; });
            cpHtml += '<select class="om-in" id="omSupSel" style="width:100%"><option value="">-- pilih pengepul --</option>' + Object.keys(names).sort().map(function (n) { return '<option value="' + esc(names[n].id) + '" ' + (cp.supplierId === names[n].id ? 'selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>';
        }
        var lines = S.cart.length ? S.cart.map(function (l, i) {
            return '<div class="om-line"><div><b><span class="om-tag ' + l.type.toLowerCase() + '">' + l.type + '</span> ' + esc(l.itemCode) + ' &middot; ' + esc(l.itemDesc) + '</b><small>' + nf(l.qty) + ' &times; ' + nf(l.denom) + ' = ' + nf(l.valasAmt) + ' valas @ ' + rp(l.kurs) + '</small></div><div style="text-align:right"><b>' + rp(l.totalRp) + '</b><br><button class="om-btn sm ico bad" data-om="rm" data-i="' + i + '" title="Hapus"><i class="fa-solid fa-trash"></i></button></div></div>';
        }).join('') : '<div class="om-empty" style="padding:22px">Keranjang kosong</div>';
        var short = isBeli && cashAfter < -0.5;
        host.innerHTML = '<h3><i class="fa-solid fa-cart-shopping"></i> ' + (S.editing ? 'Edit ' + esc(S.editing.id) : 'Keranjang') + '</h3>' +
            (S.editing ? '<div class="om-ban" style="padding:8px 10px"><span>Mengedit transaksi lama. Simpan untuk menimpa, atau batalkan.</span><button class="om-btn sm" data-om="edit-cancel">Batal edit</button></div>' : '') +
            '<div class="om-seg" style="margin-bottom:10px;width:100%"><button style="flex:1" data-om="type" data-v="BELI" class="beli ' + (isBeli ? 'on' : '') + '">BELI &mdash; kita membeli</button><button style="flex:1" data-om="type" data-v="JUAL" class="jual ' + (!isBeli ? 'on' : '') + '">JUAL &mdash; kita menjual</button></div>' +
            '<div class="om-f"><label>Pihak transaksi</label>' + cpHtml + '</div>' + lines +
            '<div class="om-total"><span>Total ' + (isBeli ? 'dibayar' : 'diterima') + '</span><span class="' + (isBeli ? 'om-neg' : 'om-pos') + '">' + rp(total) + '</span></div>' +
            '<div class="om-hint ' + (short ? 'bad' : '') + '" style="margin:0 0 8px">Kas koin: ' + rp(cashNow) + ' &rarr; ' + rp(cashAfter) + (short ? ' &mdash; kas tidak cukup. <a href="#" data-om="cash-in" style="color:var(--om-info)">Topup kas</a>' : '') + '</div>' +
            '<div class="om-f"><input class="om-in" id="omNote" placeholder="Catatan (opsional)" value="' + esc(S.note) + '"></div>' +
            '<label style="display:flex;gap:8px;align-items:center;font-size:.84rem;margin:6px 0 10px"><input type="checkbox" id="omPrint" ' + (S.printAfter ? 'checked' : '') + '> Cetak struk setelah disimpan</label>' +
            '<button class="om-btn pri blk" data-om="checkout" ' + (S.cart.length && !short ? '' : 'disabled') + '><i class="fa-solid fa-check-double"></i> ' + (S.editing ? 'Simpan Perubahan' : 'Proses Transaksi') + '</button>' +
            (S.cart.length ? '<button class="om-btn blk" style="margin-top:8px" data-om="clear">Kosongkan keranjang</button>' : '');
    }
    function resolveCustomer(text) {
        text = String(text || '').trim().toLowerCase(); if (!text) return null;
        var list = customersList();
        var ex = list.filter(function (c) { return custLabel(c).toLowerCase() === text || String(c.id_nasabah).toLowerCase() === text; })[0];
        if (ex) return ex;
        var part = list.filter(function (c) { return ((c.nama || '') + ' ' + (c.no_hp || '')).toLowerCase().indexOf(text) !== -1; });
        return part.length === 1 ? part[0] : null;
    }
    function counterpart() {
        var cp = S.cp, out = { counterpartType: 'CUSTOMER', customerId: null, supplierId: null, supplier: 'Nasabah Walk-In', supplierPhone: '-', supplierCitizenship: 'WNI' };
        if (cp.kind === 'CUSTOMER') {
            var c = customersList().filter(function (x) { return String(x.id_nasabah) === cp.customerId; })[0];
            if (!c) return null;
            out.customerId = String(c.id_nasabah); out.supplier = c.nama || out.supplier; out.supplierPhone = c.hp || c.no_hp || '-';
            out.supplierCitizenship = c.kewarganegaraan || c.citizenship || c.kwn || c.warga_negara || 'WNI';
        } else if (cp.kind === 'SUPPLIER') {
            var s = window.getOldMoneySuppliers().filter(function (x) { return x.id === cp.supplierId; })[0];
            if (!s) return null;
            out.counterpartType = 'SUPPLIER'; out.supplierId = s.id; out.supplier = s.name; out.supplierPhone = '-'; out.supplierCitizenship = '-';
        }
        return out;
    }
    async function checkout() {
        if (S.busy) return; S.busy = true;
        try {
            if (!S.cart.length) return toast('warning', 'Keranjang masih kosong.');
            var cp = counterpart();
            if (!cp) return toast('warning', S.cp.kind === 'SUPPLIER' ? 'Pilih pengepul terlebih dahulu.' : 'Pilih nasabah dari daftar terlebih dahulu.');
            var total = cartTotal(), editing = S.editing, trxs = window.getOldMoneyTrxs();
            var firstStr = (S.cart[0].itemCode ? S.cart[0].itemCode + ' ' : '') + S.cart[0].itemDesc;
            var trx = Object.assign({
                id: editing ? editing.id : await nextTrxId(), date: editing ? editing.date : new Date().toISOString(), type: S.type,
                itemDesc: S.cart.length > 1 ? firstStr + ' (+' + (S.cart.length - 1) + ' lainnya)' : firstStr,
                qty: S.cart.reduce(function (s, l) { return s + num(l.qty); }, 0), totalRp: total, note: S.note || '',
                category: S.cart.every(function (l) { return l.category === 'KOIN'; }) ? 'KOIN' : normCat(S.cart[0].category),
                by: editing ? (editing.by || userName()) : userName(), items: S.cart.map(function (l) { return Object.assign({}, l); })
            }, cp);
            if (editing) trx.editedAt = new Date().toISOString(), trx.editedBy = userName();
            var next = editing ? trxs.map(function (t) { return t.id === editing.id ? trx : t; }) : [trx].concat(trxs);
            var r = await commit(next);
            if (!r.ok) return toast('error', r.msg);
            var saved = r.model.trxs.filter(function (t) { return t.id === trx.id; })[0] || trx;
            S.cart = []; S.editing = null; S.note = ''; S.sel = ''; saveDraft();
            render(); toast('success', (editing ? 'Transaksi ' : 'Transaksi ') + trx.id + ' tersimpan');
            if (S.printAfter) printTrx(saved.id);
        } finally { S.busy = false; }
    }

    // ------------------------------------------------------------ TAB STOK & ITEM
    function stokHtml() {
        return '<div class="om-panel"><div class="om-bar"><div class="om-seg"><button data-om="stk-cat" data-v="KOIN" class="' + (S.stk.cat === 'KOIN' ? 'on' : '') + '">Koin</button><button data-om="stk-cat" data-v="UANG_LAMA" class="' + (S.stk.cat === 'UANG_LAMA' ? 'on' : '') + '">Uang Lama</button></div>' +
            '<input class="om-in" id="omStkQ" type="search" placeholder="Cari item..." value="' + esc(S.stk.q) + '" style="flex:1;min-width:150px">' +
            '<label style="font-size:.82rem;display:flex;gap:6px;align-items:center"><input type="checkbox" id="omStkLow" ' + (S.stk.low ? 'checked' : '') + '> Hanya stok menipis</label>' +
            '<button class="om-btn" data-om="opname"><i class="fa-solid fa-clipboard-check"></i> Opname / Stok Awal</button><button class="om-btn pri" data-om="item-new"><i class="fa-solid fa-plus"></i> Item</button></div>' +
            '<div id="omStkList"></div></div>';
    }
    function renderStk() {
        var host = $('omStkList'); if (!host) return;
        var q = S.stk.q.trim().toLowerCase();
        var rows = model().stock.filter(function (i) {
            return i.category === S.stk.cat && (!q || (i.code + ' ' + i.desc).toLowerCase().indexOf(q) !== -1) && (!S.stk.low || (i.minStock > 0 && i.qty <= i.minStock));
        });
        if (!rows.length) { host.innerHTML = '<div class="om-empty">Tidak ada item.</div>'; return; }
        var tq = 0, tv = 0, tc = 0;
        var body = rows.map(function (i) {
            tq += i.qty; tv += i.valas; tc += i.costTotal;
            var low = i.minStock > 0 && i.qty <= i.minStock;
            return '<tr><td>' + flag(i.code) + '<span class="om-sub">' + esc(i.desc) + '</span></td><td style="text-align:right">' + nf(i.denom) + '</td>' +
                '<td style="text-align:right"><b class="' + (low ? 'om-neg' : '') + '">' + nf(i.qty) + '</b>' + (i.minStock ? '<span class="om-sub">min ' + nf(i.minStock) + (low ? ' &middot; menipis' : '') + '</span>' : '') + '</td>' +
                '<td style="text-align:right">' + nf(i.valas) + '</td><td style="text-align:right">' + (i.buyPrice ? rp(i.buyPrice) : '-') + '</td><td style="text-align:right">' + rp(i.costTotal) + '</td>' +
                '<td style="text-align:right">' + (i.refBuy ? rp(i.refBuy) : '-') + ' / ' + (i.refSell ? rp(i.refSell) : '-') + '</td>' +
                '<td><div class="om-act">' + (can('edit') ? '<button class="om-btn sm ico" data-om="item-edit" data-id="' + esc(i.id) + '" title="Ubah"><i class="fa-solid fa-pen"></i></button>' : '') +
                (can('delete') ? '<button class="om-btn sm ico bad" data-om="item-del" data-id="' + esc(i.id) + '" title="Hapus"><i class="fa-solid fa-trash"></i></button>' : '') + '</div></td></tr>';
        }).join('');
        host.innerHTML = '<div class="om-tw"><table class="om-table"><thead><tr><th>Item</th><th style="text-align:right">Nominal</th><th style="text-align:right">Stok (pcs)</th><th style="text-align:right">Total valas</th><th style="text-align:right">Modal rata-rata</th><th style="text-align:right">Nilai (modal)</th><th style="text-align:right">Saran beli / jual</th><th></th></tr></thead><tbody>' + body +
            '</tbody><tfoot><tr><td>Total</td><td></td><td style="text-align:right">' + nf(tq) + '</td><td style="text-align:right">' + nf(tv) + '</td><td></td><td style="text-align:right">' + rp(tc) + '</td><td></td><td></td></tr></tfoot></table></div>';
    }

    // ------------------------------------------------------------ TAB RIWAYAT
    function riwayatHtml() {
        var h = S.his;
        return '<div class="om-panel"><div class="om-bar"><input class="om-in" type="date" id="omHFrom" value="' + h.from + '"><input class="om-in" type="date" id="omHTo" value="' + h.to + '">' +
            '<select class="om-in" id="omHType"><option value="">Semua jenis</option><option value="BELI">Beli</option><option value="JUAL">Jual</option><option value="TOPUP">Kas</option><option value="ADJUST">Opname</option></select>' +
            '<select class="om-in" id="omHCat"><option value="">Semua kategori</option><option value="KOIN">Koin</option><option value="UANG_LAMA">Uang Lama</option></select>' +
            '<input class="om-in" id="omHQ" type="search" placeholder="Cari no. / pihak / item..." value="' + esc(h.q) + '" style="flex:1;min-width:150px">' +
            '<button class="om-btn" data-om="csv"><i class="fa-solid fa-file-csv"></i> CSV</button>' +
            (can('deleteTrx') ? '<button class="om-btn bad" data-om="bulk-del"><i class="fa-solid fa-trash"></i> Hapus terpilih</button>' : '') + '</div>' +
            '<div id="omHisSum" class="om-sum"></div><div id="omHisList"></div></div>';
    }
    function hisRows() {
        var h = S.his, q = h.q.trim().toLowerCase();
        var from = h.from ? new Date(h.from + 'T00:00:00').getTime() : 0, to = h.to ? new Date(h.to + 'T23:59:59').getTime() : Infinity;
        return model().trxs.filter(function (t) {
            var ty = String(t.type || '').toUpperCase(), tm = trxTime(t);
            if (tm < from || tm > to) return false;
            if (h.type && ty !== h.type) return false;
            if (h.cat && normCat(t.category) !== h.cat && ty !== 'TOPUP') return false;
            if (h.cat && ty === 'TOPUP') return false;
            if (q && (String(t.id) + ' ' + (t.supplier || '') + ' ' + (t.itemDesc || '') + ' ' + (t.note || '')).toLowerCase().indexOf(q) === -1) return false;
            return true;
        }).sort(function (a, b) { return trxTime(b) - trxTime(a) || String(b.id).localeCompare(String(a.id)); });
    }
    function trxLabel(t) {
        var ty = String(t.type || '').toUpperCase();
        return ty === 'TOPUP' ? (num(t.totalRp) >= 0 ? 'Topup kas' : 'Tarik kas') : ty === 'ADJUST' ? 'Opname' : ty;
    }
    function renderHis() {
        var host = $('omHisList'); if (!host) return;
        var rows = hisRows(), beli = 0, jual = 0, profit = 0;
        rows.forEach(function (t) { var ty = String(t.type).toUpperCase(); if (ty === 'BELI') beli += num(t.totalRp); if (ty === 'JUAL') jual += num(t.totalRp); profit += profitOf(t); });
        $('omHisSum').innerHTML = '<span>' + rows.length + ' transaksi</span><span>Beli ' + rp(beli) + '</span><span>Jual ' + rp(jual) + '</span>' + (can('profit') ? '<span class="' + (profit >= 0 ? 'om-pos' : 'om-neg') + '">Laba ' + rp(profit) + '</span>' : '');
        if (!rows.length) { host.innerHTML = '<div class="om-empty">Belum ada transaksi pada filter ini.</div>'; return; }
        host.innerHTML = '<div class="om-tw"><table class="om-table"><thead><tr><th style="width:28px"></th><th>No. / Waktu</th><th>Jenis</th><th>Pihak</th><th>Item</th><th style="text-align:right">Total</th>' + (can('profit') ? '<th style="text-align:right">Laba</th>' : '') + '<th></th></tr></thead><tbody>' +
            rows.slice(0, 300).map(function (t) {
                var ty = String(t.type).toUpperCase(), p = profitOf(t), mine = ty === 'BELI' || ty === 'JUAL';
                return '<tr><td><input type="checkbox" data-om="hsel" data-id="' + esc(t.id) + '" ' + (S.his.sel[t.id] ? 'checked' : '') + '></td>' +
                    '<td><b>' + esc(t.id) + '</b><span class="om-sub">' + fmtDT(t.date) + (t.by ? ' &middot; ' + esc(t.by) : '') + (t.editedAt ? ' &middot; diubah' : '') + '</span></td>' +
                    '<td><span class="om-tag ' + (ty === 'TOPUP' ? 'topup' : ty.toLowerCase()) + '">' + trxLabel(t) + '</span></td>' +
                    '<td>' + esc(t.supplier || '-') + (t.counterpartType === 'SUPPLIER' ? '<span class="om-sub">Pengepul</span>' : '') + '</td>' +
                    '<td>' + esc(t.itemDesc || t.note || '-') + '</td><td style="text-align:right"><b>' + (ty === 'ADJUST' ? nf(t.qty) + ' pcs' : rp(t.totalRp)) + '</b></td>' +
                    (can('profit') ? '<td style="text-align:right" class="' + (p >= 0 ? 'om-pos' : 'om-neg') + '">' + (ty === 'JUAL' || ty === 'ADJUST' ? rp(p) : '-') + '</td>' : '') +
                    '<td><div class="om-act"><button class="om-btn sm ico" data-om="detail" data-id="' + esc(t.id) + '" title="Detail"><i class="fa-solid fa-eye"></i></button>' +
                    (mine ? '<button class="om-btn sm ico" data-om="print" data-id="' + esc(t.id) + '" title="Cetak"><i class="fa-solid fa-print"></i></button><button class="om-btn sm ico wa" data-om="wa" data-id="' + esc(t.id) + '" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>' : '') +
                    (mine && can('editTrx') ? '<button class="om-btn sm ico" data-om="edit" data-id="' + esc(t.id) + '" title="Ubah"><i class="fa-solid fa-pen"></i></button>' : '') +
                    (can('deleteTrx') ? '<button class="om-btn sm ico bad" data-om="del" data-id="' + esc(t.id) + '" title="Hapus"><i class="fa-solid fa-trash"></i></button>' : '') + '</div></td></tr>';
            }).join('') + '</tbody></table></div>' + (rows.length > 300 ? '<div class="om-hint">Menampilkan 300 terbaru. Persempit filter atau ekspor CSV untuk semua.</div>' : '');
    }
    function exportCsv() {
        var rows = hisRows(); if (!rows.length) return toast('warning', 'Tidak ada data untuk diekspor.');
        var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
        var lines = [['No', 'Waktu', 'Jenis', 'Pihak', 'Item', 'Qty', 'Valas', 'Total Rp', 'Harga Pokok Rp', 'Laba Rp', 'Saldo Kas Setelah', 'Kasir', 'Catatan'].map(q).join(',')];
        rows.forEach(function (t) {
            var items = t.items && t.items.length ? t.items : [null];
            items.forEach(function (l, i) {
                lines.push([t.id, fmtDT(t.date), trxLabel(t), t.supplier || '', l ? l.itemCode + ' ' + l.itemDesc : (t.itemDesc || ''), l ? l.qty : (t.qty || ''), l ? l.valasAmt : '',
                    l ? l.totalRp : t.totalRp, l ? Math.round(num(l.costRp)) : '', l && String(t.type).toUpperCase() === 'JUAL' ? Math.round(num(l.totalRp) - num(l.costRp)) : '', i === 0 ? t.cashBalanceAfter : '', t.by || '', t.note || ''].map(q).join(','));
            });
        });
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'koin-uang-lama-' + dayKey(new Date()) + '.csv'; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    function detailTrx(id) {
        var t = model().trxs.filter(function (x) { return x.id === id; })[0]; if (!t) return;
        var ty = String(t.type).toUpperCase();
        var lines = (t.items || []).map(function (l) {
            return '<div class="om-line"><div><b>' + esc(l.itemCode) + ' &middot; ' + esc(l.itemDesc) + '</b><small>' + nf(l.qty) + ' &times; ' + nf(l.denom) + ' = ' + nf(l.valasAmt) + ' valas @ ' + rp(l.kurs) + (ty === 'JUAL' && can('profit') ? ' &middot; pokok ' + rp(l.costRp) : '') + '</small></div><b>' + rp(l.totalRp) + '</b></div>';
        }).join('');
        openModal({ title: esc(t.id) + ' &middot; ' + trxLabel(t), body:
            '<div class="om-kv"><span>Waktu</span><b>' + fmtDT(t.date) + '</b></div><div class="om-kv"><span>Pihak</span><b>' + esc(t.supplier || '-') + '</b></div>' +
            '<div class="om-kv"><span>Kasir</span><b>' + esc(t.by || '-') + '</b></div>' + (t.note ? '<div class="om-kv"><span>Catatan</span><b>' + esc(t.note) + '</b></div>' : '') +
            '<div class="om-kv"><span>Total</span><b>' + rp(t.totalRp) + '</b></div>' + (ty === 'JUAL' && can('profit') ? '<div class="om-kv"><span>Laba</span><b class="' + (profitOf(t) >= 0 ? 'om-pos' : 'om-neg') + '">' + rp(profitOf(t)) + '</b></div>' : '') +
            '<div class="om-kv"><span>Saldo kas setelahnya</span><b>' + rp(t.cashBalanceAfter) + '</b></div><div style="margin-top:12px">' + lines + '</div>',
            footer: '<button class="om-btn" data-om="close">Tutup</button>' });
    }
    async function delTrxs(ids) {
        if (!ids.length) return toast('warning', 'Pilih transaksi dahulu.');
        if (!await confirmBox('Hapus transaksi', 'Hapus <b>' + ids.length + '</b> transaksi? Stok dan kas dihitung ulang dari sisa riwayat. Penghapusan ditolak bila membuat stok/kas minus.', 'Hapus', true)) return;
        var set = {}; ids.forEach(function (i) { set[i] = 1; });
        var r = await commit(window.getOldMoneyTrxs().filter(function (t) { return !set[t.id]; }));
        if (!r.ok) return toast('error', 'Ditolak: ' + r.msg);
        S.his.sel = {}; render(); toast('success', ids.length + ' transaksi dihapus');
    }
    function editTrx(id) {
        var t = window.getOldMoneyTrxs().filter(function (x) { return x.id === id; })[0]; if (!t) return;
        var ty = String(t.type).toUpperCase(); if (ty !== 'BELI' && ty !== 'JUAL') return;
        S.editing = { id: t.id, date: t.date, by: t.by }; S.type = ty; S.note = t.note || ''; S.cart = (t.items || []).map(function (l) { return Object.assign({}, l, { type: ty, category: l.category || t.category }); });
        S.cp = { kind: t.counterpartType === 'SUPPLIER' ? 'SUPPLIER' : (t.customerId ? 'CUSTOMER' : 'WALKIN'), customerId: t.customerId || '', supplierId: t.supplierId || '' };
        S.tab = 'kasir'; saveDraft(); render(); toast('info', 'Mengedit ' + id);
    }

    // ------------------------------------------------------------ cetak & WhatsApp
    function printTrx(id) {
        var t = model().trxs.filter(function (x) { return x.id === id; })[0]; if (!t) return toast('error', 'Transaksi tidak ditemukan.');
        if (typeof printReceipt !== 'function') return toast('error', 'Template nota belum tersedia. Muat ulang halaman.');
        var ty = String(t.type).toUpperCase() === 'BELI' ? 'BELI' : 'JUAL', total = Math.abs(num(t.totalRp));
        var cart = (t.items || []).map(function (l, i) {
            var q = num(l.qty), d = num(l.denom) || 1;
            return { id: l.itemId || ('OLD-MONEY-' + t.id + '-' + (i + 1)), type: ty, curCode: l.itemCode || 'KOIN', amount: num(l.valasAmt) || d * q, rate: num(l.kurs), totalIdr: num(l.totalRp), denom: d, qty: q, oldMoneyDesc: l.itemDesc || l.itemCode || 'KOIN' };
        });
        printReceipt(cart, { receiptId: t.id, paymentMethod: 'CASH', grandTotal: ty === 'BELI' ? -total : total, payCash: total, payTransfer: 0, customerId: t.customerId || null, receiverId: t.customerId || null,
            oldMoneyCategory: normCat(t.category), receiverManualName: t.supplier || 'Nasabah Walk-In', timestamp: t.date || Date.now(), kasir: t.by || userName() });
    }
    async function waTrx(id) {
        var t = model().trxs.filter(function (x) { return x.id === id; })[0]; if (!t) return;
        var cust = t.customerId ? customersList().filter(function (c) { return String(c.id_nasabah) === String(t.customerId); })[0] : null;
        var raw = (cust && (cust.hp || cust.no_hp)) || (t.supplierPhone !== '-' ? t.supplierPhone : '');
        var phone = String(raw || '').replace(/\D/g, ''); if (phone.charAt(0) === '0') phone = '62' + phone.slice(1);
        if (!phone) return toast('warning', 'Nomor WhatsApp belum tersedia pada transaksi ini.');
        var prof = {}; try { prof = typeof getProfile === 'function' ? getProfile() : {}; } catch (e) { /* abaikan */ }
        var itemsText = (t.items || []).map(function (l, i) { return (i + 1) + '. ' + (l.itemCode ? l.itemCode + ' ' : '') + l.itemDesc + '\n   ' + nf(l.qty) + ' pcs x ' + rp(l.kurs) + ' = ' + rp(l.totalRp); }).join('\n');
        var fallback = ['Halo ' + (t.supplier || 'Pelanggan') + ',', '', 'Berikut rincian transaksi koin & uang lama dari ' + (prof.name || 'kami') + ':', 'No. Invoice: ' + t.id, 'Tanggal: ' + fmtDT(t.date), 'Jenis: ' + t.type, '', itemsText, '', 'Total: ' + rp(t.totalRp), '', 'Terima kasih.'].join('\n');
        var text = typeof window.buildWaMessageForPurpose === 'function' ? window.buildWaMessageForPurpose('old-money', fallback, { customerName: t.supplier || 'Pelanggan', invoice: t.id, date: fmtDT(t.date), currencyList: itemsText, total: rp(t.totalRp) }) : fallback;
        try { await window.sendWhatsAppGateway(phone, text, { reference: t.id }); toast('success', 'Bukti terkirim via WhatsApp'); }
        catch (e) { toast('error', 'Gagal kirim WhatsApp: ' + (e && e.message || e)); }
    }

    // ------------------------------------------------------------ TAB KAS KOIN
    function kasHtml() {
        return '<div class="om-panel"><div class="om-bar"><input class="om-in" type="date" id="omKFrom" value="' + S.kas.from + '"><input class="om-in" type="date" id="omKTo" value="' + S.kas.to + '"><span style="flex:1"></span>' +
            '<button class="om-btn pri" data-om="cash-in"><i class="fa-solid fa-circle-plus"></i> Topup Kas</button><button class="om-btn" data-om="cash-out"><i class="fa-solid fa-circle-minus"></i> Tarik Kas</button></div><div id="omKasList"></div></div>';
    }
    function renderKas() {
        var host = $('omKasList'); if (!host) return;
        var from = S.kas.from ? new Date(S.kas.from + 'T00:00:00').getTime() : 0, to = S.kas.to ? new Date(S.kas.to + 'T23:59:59').getTime() : Infinity;
        var rows = model().trxs.filter(function (t) { var ty = String(t.type).toUpperCase(); return ty !== 'ADJUST' && trxTime(t) >= from && trxTime(t) <= to; })
            .sort(function (a, b) { return trxTime(b) - trxTime(a) || String(b.id).localeCompare(String(a.id)); });
        if (!rows.length) { host.innerHTML = '<div class="om-empty">Belum ada mutasi kas.</div>'; return; }
        host.innerHTML = '<div class="om-tw"><table class="om-table"><thead><tr><th>Waktu</th><th>No.</th><th>Keterangan</th><th style="text-align:right">Masuk</th><th style="text-align:right">Keluar</th><th style="text-align:right">Saldo</th></tr></thead><tbody>' + rows.slice(0, 300).map(function (t) {
            var ty = String(t.type).toUpperCase(), amt = num(t.totalRp), inn = ty === 'JUAL' || (ty === 'TOPUP' && amt > 0), v = Math.abs(amt);
            return '<tr><td>' + fmtDT(t.date) + '</td><td>' + esc(t.id) + '</td><td>' + trxLabel(t) + (t.supplier && ty !== 'TOPUP' ? ' &middot; ' + esc(t.supplier) : '') + (t.note ? '<span class="om-sub">' + esc(t.note) + '</span>' : '') + '</td>' +
                '<td style="text-align:right" class="om-pos">' + (inn ? rp(v) : '') + '</td><td style="text-align:right" class="om-neg">' + (!inn ? rp(v) : '') + '</td><td style="text-align:right"><b>' + rp(t.cashBalanceAfter) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function cashModal(sign) {
        openModal({ title: sign > 0 ? 'Topup Kas Koin' : 'Tarik Kas Koin', body: '<p class="om-hint" style="margin-top:0">Saldo kas saat ini: <b>' + rp(model().cash) + '</b>. Kas ini terpisah dari kas transaksi utama.</p>' +
            '<div class="om-f"><label>Nominal (Rp)</label><input class="om-in" id="omCashAmt" inputmode="numeric" autocomplete="off" placeholder="0"></div><div class="om-f"><label>Catatan</label><input class="om-in" id="omCashNote" placeholder="Keterangan"></div>' + ERR,
            footer: '<button class="om-btn" data-om="close">Batal</button><button class="om-btn pri" data-om="cash-save" data-sign="' + sign + '">Simpan</button>', onOpen: function () { var e = $('omCashAmt'); if (e) e.focus(); } });
    }
    async function saveCash(sign) {
        var amt = round0(pn(($('omCashAmt') || {}).value)); if (amt <= 0) return showErr('Nominal harus lebih dari 0.');
        var trx = { id: await nextTrxId(), date: new Date().toISOString(), type: 'TOPUP', totalRp: sign * amt, itemDesc: sign > 0 ? 'Topup kas' : 'Tarik kas', note: ($('omCashNote') || {}).value || '', by: userName(), supplier: '-' };
        var r = await commit([trx].concat(window.getOldMoneyTrxs())); if (!r.ok) return showErr(r.msg);
        closeModal(); render(); toast('success', 'Kas diperbarui');
    }

    // ------------------------------------------------------------ TAB ACUAN HARGA
    function acuanHtml() {
        return '<div class="om-panel"><div class="om-bar"><div class="om-seg"><button data-om="sup-cat" data-v="KOIN" class="' + (S.sup.cat === 'KOIN' ? 'on' : '') + '">Koin</button><button data-om="sup-cat" data-v="UANG_LAMA" class="' + (S.sup.cat === 'UANG_LAMA' ? 'on' : '') + '">Uang Lama</button></div>' +
            '<input class="om-in" id="omSupQ" type="search" placeholder="Cari pengepul / mata uang..." value="' + esc(S.sup.q) + '" style="flex:1;min-width:150px">' +
            (can('supplier') ? '<button class="om-btn pri" data-om="sup-new"><i class="fa-solid fa-plus"></i> Pengepul</button>' : '') + '</div>' +
            '<p class="om-hint" style="margin:0 0 10px">Harga acuan pengepul dipakai sebagai petunjuk di Kasir: harga <b>terima</b> = yang pengepul bayar saat kita jual ke mereka; harga <b>jual</b> = yang pengepul minta saat kita membeli dari mereka. Tidak mengubah stok maupun kas.</p><div id="omSupList"></div></div>';
    }
    function renderSup() {
        var host = $('omSupList'); if (!host) return;
        var q = S.sup.q.trim().toLowerCase();
        var rows = window.getOldMoneySuppliers().filter(function (s) { return normCat(s.category || 'KOIN') === S.sup.cat && (!q || (String(s.name) + ' ' + s.currency).toLowerCase().indexOf(q) !== -1); })
            .sort(function (a, b) { return String(a.currency).localeCompare(String(b.currency)) || String(a.name).localeCompare(String(b.name)); });
        if (!rows.length) { host.innerHTML = '<div class="om-empty">Belum ada data pengepul.</div>'; return; }
        var bestBuy = {}, bestSell = {};
        rows.forEach(function (s) { var c = String(s.currency).toUpperCase(); if (num(s.buyPrice) > (bestBuy[c] || 0)) bestBuy[c] = num(s.buyPrice); if (num(s.sellPrice) > 0 && (!bestSell[c] || num(s.sellPrice) < bestSell[c])) bestSell[c] = num(s.sellPrice); });
        host.innerHTML = '<div class="om-tw"><table class="om-table"><thead><tr><th>Mata uang</th><th>Pengepul</th><th style="text-align:right">Harga terima (kita jual)</th><th style="text-align:right">Harga jual (kita beli)</th><th>Catatan</th><th></th></tr></thead><tbody>' + rows.map(function (s) {
            var c = String(s.currency).toUpperCase();
            return '<tr><td>' + flag(c) + '</td><td><b>' + esc(s.name) + '</b></td><td style="text-align:right" class="' + (num(s.buyPrice) && num(s.buyPrice) === bestBuy[c] ? 'om-pos' : '') + '">' + (num(s.buyPrice) ? rp(s.buyPrice) + (num(s.buyPrice) === bestBuy[c] ? ' &#9733;' : '') : '-') + '</td>' +
                '<td style="text-align:right" class="' + (num(s.sellPrice) && num(s.sellPrice) === bestSell[c] ? 'om-pos' : '') + '">' + (num(s.sellPrice) ? rp(s.sellPrice) + (num(s.sellPrice) === bestSell[c] ? ' &#9733;' : '') : '-') + '</td><td>' + esc(s.note || '') + '</td>' +
                '<td>' + (can('supplier') ? '<div class="om-act"><button class="om-btn sm ico" data-om="sup-edit" data-id="' + esc(s.id) + '"><i class="fa-solid fa-pen"></i></button><button class="om-btn sm ico bad" data-om="sup-del" data-id="' + esc(s.id) + '"><i class="fa-solid fa-trash"></i></button></div>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function supModal(id) {
        var s = id ? window.getOldMoneySuppliers().filter(function (x) { return x.id === id; })[0] : null; s = s || {};
        openModal({ title: id ? 'Ubah Pengepul' : 'Tambah Pengepul', body:
            '<div class="om-r2"><div class="om-f"><label>Nama pengepul</label><input class="om-in" id="omSName" value="' + esc(s.name || '') + '" placeholder="Nama pengepul"></div>' +
            '<div class="om-f"><label>Kategori</label><select class="om-in" id="omSCat"><option value="KOIN" ' + (normCat(s.category) === 'KOIN' ? 'selected' : '') + '>Koin</option><option value="UANG_LAMA" ' + (normCat(s.category) === 'UANG_LAMA' && s.category ? 'selected' : '') + '>Uang Lama</option></select></div></div>' +
            '<div class="om-f"><label>Kode mata uang (3 huruf)</label><input class="om-in" id="omSCur" maxlength="3" style="text-transform:uppercase" value="' + esc(s.currency || '') + '" placeholder="mis. USD"></div>' +
            '<div class="om-r2"><div class="om-f"><label>Harga terima (Rp / valas)</label><input class="om-in" id="omSBuy" inputmode="decimal" value="' + (s.buyPrice ? nf(s.buyPrice) : '') + '"></div><div class="om-f"><label>Harga jual (Rp / valas)</label><input class="om-in" id="omSSell" inputmode="decimal" value="' + (s.sellPrice ? nf(s.sellPrice) : '') + '"></div></div>' +
            '<div class="om-f"><label>Catatan</label><input class="om-in" id="omSNote" value="' + esc(s.note || '') + '"></div>' + ERR,
            footer: '<button class="om-btn" data-om="close">Batal</button><button class="om-btn pri" data-om="sup-save" data-id="' + esc(id || '') + '">Simpan</button>',
            onOpen: function (ov) { if (typeof window.attachIsoPicker === 'function') window.attachIsoPicker(ov.querySelector('#omSCur'), { title: 'Pilih Kode Mata Uang (ISO 4217)' }); } });
    }
    async function saveSup(id) {
        var name = ($('omSName').value || '').trim(), cur = ($('omSCur').value || '').trim().toUpperCase();
        if (!name) return showErr('Nama pengepul wajib diisi.');
        if (!/^[A-Z]{3}$/.test(cur)) return showErr('Kode mata uang harus 3 huruf.');
        var buy = pn($('omSBuy').value), sell = pn($('omSSell').value); if (buy <= 0 && sell <= 0) return showErr('Isi minimal salah satu harga.');
        var list = window.getOldMoneySuppliers(), cat = $('omSCat').value;
        var row = { id: id || ('SUP-' + Date.now().toString(36).toUpperCase()), name: name, currency: cur, category: cat, buyPrice: buy, sellPrice: sell, note: $('omSNote').value || '', updatedAt: new Date().toISOString() };
        if (list.some(function (x) { return x.id !== row.id && x.name.toLowerCase() === name.toLowerCase() && String(x.currency).toUpperCase() === cur && normCat(x.category) === cat; })) return showErr('Pengepul untuk mata uang ini sudah ada.');
        list = id ? list.map(function (x) { return x.id === id ? row : x; }) : list.concat(row);
        await window.saveOldMoneySuppliers(list); closeModal(); render(); toast('success', 'Pengepul disimpan');
    }

    // ------------------------------------------------------------ ITEM & OPNAME
    function itemModal(id) {
        var it = id ? window.getOldMoneyStock().map(normItem).filter(function (x) { return x.id === id; })[0] : null; it = it || { category: S.tab === 'stok' ? S.stk.cat : S.cat, denom: 1 };
        var codes = []; try { codes = (typeof getCurrencies === 'function' ? getCurrencies() : []).map(function (c) { return c.code; }).filter(Boolean); } catch (e) { /* abaikan */ }
        S.photo = it.photo || null;
        openModal({ title: id ? 'Ubah Item' : 'Tambah Item', body:
            '<div class="om-r2"><div class="om-f"><label>Kategori</label><select class="om-in" id="omICat"><option value="KOIN" ' + (it.category === 'KOIN' ? 'selected' : '') + '>Koin</option><option value="UANG_LAMA" ' + (it.category === 'UANG_LAMA' ? 'selected' : '') + '>Uang Lama</option></select></div>' +
            '<div class="om-f"><label>Kode mata uang</label><input class="om-in" id="omICode" list="omCodes" maxlength="12" style="text-transform:uppercase" value="' + esc(it.code || '') + '" placeholder="mis. USD"><datalist id="omCodes">' + codes.map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join('') + '</datalist></div></div>' +
            '<div class="om-f"><label>Nama / deskripsi</label><input class="om-in" id="omIDesc" value="' + esc(it.desc || '') + '" placeholder="mis. 1 Dollar 1964 / 100 Dollar seri lama"></div>' +
            '<div class="om-r3"><div class="om-f"><label>Nominal per keping/lembar</label><input class="om-in" id="omIDen" inputmode="decimal" value="' + nf(it.denom || 1) + '"></div>' +
            '<div class="om-f"><label>Saran harga beli (Rp/valas)</label><input class="om-in" id="omIBuy" inputmode="decimal" value="' + (it.refBuy ? nf(it.refBuy) : '') + '"></div><div class="om-f"><label>Saran harga jual (Rp/valas)</label><input class="om-in" id="omISell" inputmode="decimal" value="' + (it.refSell ? nf(it.refSell) : '') + '"></div></div>' +
            '<div class="om-r2"><div class="om-f"><label>Batas stok menipis (pcs)</label><input class="om-in" id="omIMin" inputmode="numeric" value="' + (it.minStock ? nf(it.minStock) : '') + '"></div>' +
            '<div class="om-f"><label>Foto (opsional)</label><div style="display:flex;gap:8px;align-items:center"><div class="om-ph" id="omIPh" style="' + (it.photo ? 'background-image:url(\'' + esc(it.photo) + '\')' : '') + '">' + (it.photo ? '' : '<i class="fa-solid fa-image"></i>') + '</div><input type="file" id="omIFile" accept="image/*" style="max-width:150px;font-size:.75rem"></div></div></div>' +
            '<p class="om-hint">Stok dan modal item dihitung dari transaksi. Untuk stok awal, simpan item lalu pakai <b>Opname / Stok Awal</b>.</p>' + ERR,
            footer: '<button class="om-btn" data-om="close">Batal</button><button class="om-btn pri" data-om="item-save" data-id="' + esc(id || '') + '">Simpan</button>',
            onOpen: function (ov) {
                if (typeof window.attachIsoPicker === 'function') window.attachIsoPicker(ov.querySelector('#omICode'), { title: 'Pilih Kode Mata Uang (ISO 4217)', onPick: function (it) { var d = ov.querySelector('#omIDesc'); if (d && !d.value.trim()) d.value = it.name; } });
                var f = ov.querySelector('#omIFile');
                f.addEventListener('change', function () {
                    var file = f.files && f.files[0]; if (!file) return;
                    var fr = new FileReader(); fr.onload = function () {
                        var img = new Image(); img.onload = function () {
                            var sc = Math.min(1, 240 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
                            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); S.photo = c.toDataURL('image/jpeg', 0.75);
                            var ph = $('omIPh'); ph.style.backgroundImage = 'url(' + S.photo + ')'; ph.innerHTML = '';
                        }; img.src = fr.result;
                    }; fr.readAsDataURL(file);
                });
            } });
    }
    async function saveItem(id) {
        var code = ($('omICode').value || '').trim().toUpperCase(), desc = ($('omIDesc').value || '').trim(), den = pn($('omIDen').value);
        if (!code) return showErr('Kode mata uang wajib diisi.'); if (!desc) return showErr('Nama / deskripsi wajib diisi.'); if (den <= 0) return showErr('Nominal harus lebih dari 0.');
        var list = window.getOldMoneyStock(), cat = $('omICat').value;
        if (list.some(function (x) { return x.id !== id && String(x.code).toUpperCase() === code && String(x.desc).trim().toLowerCase() === desc.toLowerCase() && normCat(x.category) === cat; })) return showErr('Item dengan kode dan nama yang sama sudah ada.');
        var old = id ? list.filter(function (x) { return x.id === id; })[0] : null;
        var row = Object.assign({}, old || {}, { id: id || ('ITM-' + Date.now().toString(36).toUpperCase()), category: cat, code: code, desc: desc, denom: den, refBuy: pn($('omIBuy').value), refSell: pn($('omISell').value), minStock: pn($('omIMin').value), photo: S.photo || null });
        var next = id ? list.map(function (x) { return x.id === id ? row : x; }) : list.concat(row);
        var r = await commit(window.getOldMoneyTrxs(), next); if (!r.ok) return showErr(r.msg);
        closeModal(); render(); toast('success', 'Item disimpan');
    }
    async function delItem(id) {
        var it = itemById(id); if (!it) return;
        var used = window.getOldMoneyTrxs().some(function (t) { return t.itemId === id || (t.items || []).some(function (l) { return l.itemId === id; }); });
        if (used) return toast('error', 'Item sudah punya riwayat transaksi, tidak bisa dihapus. Set stok ke 0 lewat opname bila tidak dipakai lagi.');
        if (!await confirmBox('Hapus item', 'Hapus item <b>' + esc(it.code + ' ' + it.desc) + '</b>?', 'Hapus', true)) return;
        var r = await commit(window.getOldMoneyTrxs(), window.getOldMoneyStock().filter(function (x) { return x.id !== id; })); if (!r.ok) return toast('error', r.msg);
        render(); toast('success', 'Item dihapus');
    }
    function opnameModal() {
        var items = model().stock; if (!items.length) return toast('warning', 'Tambah item terlebih dahulu.');
        openModal({ title: 'Opname / Stok Awal', body: '<p class="om-hint" style="margin-top:0">Masukkan jumlah fisik yang dihitung. Selisih dicatat sebagai transaksi opname (bisa ditelusuri). Penambahan memakai modal rata-rata (atau saran harga beli bila stok kosong); pengurangan tercatat sebagai kerugian.</p>' +
            '<div class="om-f"><label>Item</label><select class="om-in" id="omOItem">' + items.map(function (i) { return '<option value="' + esc(i.id) + '" data-q="' + i.qty + '">' + esc(catLabel(i.category) + ' &middot; ' + i.code + ' ' + i.desc).replace(/&amp;middot;/g, '·') + ' (stok ' + nf(i.qty) + ')</option>'; }).join('') + '</select></div>' +
            '<div class="om-r2"><div class="om-f"><label>Jumlah fisik (pcs)</label><input class="om-in" id="omOQty" inputmode="numeric" autocomplete="off"></div><div class="om-f"><label>Catatan</label><input class="om-in" id="omONote" placeholder="mis. stok awal / selisih hitung"></div></div>' + ERR,
            footer: '<button class="om-btn" data-om="close">Batal</button><button class="om-btn pri" data-om="op-save">Simpan</button>' });
    }
    async function saveOpname() {
        var sel = $('omOItem'), it = itemById(sel.value), q = $('omOQty').value; if (!it) return showErr('Pilih item.');
        if (String(q).trim() === '') return showErr('Isi jumlah fisik.');
        var phys = Math.floor(pn(q)); if (phys < 0) return showErr('Jumlah tidak boleh negatif.');
        var diff = phys - it.qty; if (diff === 0) return showErr('Jumlah sama dengan stok tercatat.');
        var trx = { id: await nextTrxId(), date: new Date().toISOString(), type: 'ADJUST', itemId: it.id, itemCode: it.code, itemDesc: it.code + ' ' + it.desc, qty: diff, totalRp: 0, category: it.category, note: $('omONote').value || 'Opname', by: userName(), supplier: '-' };
        var r = await commit([trx].concat(window.getOldMoneyTrxs())); if (!r.ok) return showErr(r.msg);
        closeModal(); render(); toast('success', 'Opname dicatat (' + (diff > 0 ? '+' : '') + nf(diff) + ' pcs)');
    }
    function helpModal() {
        openModal({ title: 'Cara pakai', body: '<ol class="om-help"><li>Tambah <b>Item</b> (kode mata uang, nama, nominal per keping/lembar, saran harga).</li><li>Isi stok awal lewat <b>Opname / Stok Awal</b>, dan modal kerja lewat <b>Topup Kas</b>.</li>' +
            '<li>Di <b>Kasir</b>: pilih BELI (kita membeli) atau JUAL, pilih item, isi jumlah keping. Ubah <b>kurs</b> atau <b>total kesepakatan</b>; yang satunya menyesuaikan.</li>' +
            '<li>Laba dihitung dari harga pokok rata-rata per nominal valas. Kas dan stok koin terpisah dari transaksi utama.</li><li>Transaksi yang membuat stok atau kas minus ditolak, termasuk saat mengubah/menghapus riwayat.</li></ol>', footer: '<button class="om-btn pri" data-om="close">Mengerti</button>' });
    }
    async function reconcile() {
        if (!await confirmBox('Terapkan hitungan riwayat', 'Stok dan kas tersimpan akan disamakan dengan hasil hitung ulang dari riwayat transaksi.', 'Terapkan')) return;
        var m = model(); await window.saveOldMoneyStock(m.stock); await window.saveOldMoneyCash(m.cash); cache.raw = ''; render(); toast('success', 'Saldo disamakan dengan riwayat');
    }

    // ------------------------------------------------------------ event
    function onClick(e) {
        var el = e.target.closest('[data-om]'); if (!el) return;
        var a = el.dataset.om, id = el.dataset.id, v = el.dataset.v;
        if (el.tagName === 'A') e.preventDefault();
        if (a === 'hsel') { if (el.checked) S.his.sel[id] = 1; else delete S.his.sel[id]; return; }
        switch (a) {
            case 'close': closeModal(); break;
            case 'tab': S.tab = v; render(); break;
            case 'help': helpModal(); break;
            case 'item-new': itemModal(); break;
            case 'item-edit': itemModal(id); break;
            case 'item-save': saveItem(id); break;
            case 'item-del': delItem(id); break;
            case 'opname': opnameModal(); break;
            case 'op-save': saveOpname(); break;
            case 'viewmenu': { var m = $('omViewMenu'); if (m) m.hidden = !m.hidden; break; }
            case 'view': S.view = v; try { localStorage.setItem('om_view_mode', v); } catch (x) { /* abaikan */ } var vb = document.querySelector('[data-om=viewmenu] i'); if (vb) vb.className = viewDef()[2]; var vm = $('omViewMenu'); if (vm) { vm.innerHTML = viewMenuHtml(); vm.hidden = true; } renderCatalog(); break;
            case 'cat': S.cat = v; S.sel = ''; renderCatalog(); renderEntry(); break;
            case 'pick': pickItem(id); break;
            case 'qty+': { var q = $('omQty'); if (q) { q.value = String(Math.floor(pn(q.value)) + num(v)); entryCalc('qty'); } break; }
            case 'add': addToCart(); break;
            case 'rm': S.cart.splice(num(el.dataset.i), 1); saveDraft(); renderCart(); renderTabs(); renderEntry(); renderCatalog(); break;
            case 'clear': S.cart = []; saveDraft(); renderCart(); renderTabs(); renderEntry(); break;
            case 'type': S.type = v; S.cart = S.cart.length && !S.editing ? S.cart.map(function (l) { return Object.assign({}, l, { type: v }); }) : S.cart; saveDraft(); renderCart(); renderEntry(); break;
            case 'cp': S.cp = { kind: v, customerId: '', supplierId: '' }; saveDraft(); renderCart(); break;
            case 'checkout': checkout(); break;
            case 'edit-cancel': S.editing = null; S.cart = []; S.note = ''; saveDraft(); render(); break;
            case 'stk-cat': S.stk.cat = v; renderBody(); break;
            case 'sup-cat': S.sup.cat = v; renderBody(); break;
            case 'sup-new': supModal(); break;
            case 'sup-edit': supModal(id); break;
            case 'sup-save': saveSup(id); break;
            case 'sup-del': confirmBox('Hapus pengepul', 'Hapus data pengepul ini?', 'Hapus', true).then(function (ok) { if (ok) window.saveOldMoneySuppliers(window.getOldMoneySuppliers().filter(function (s) { return s.id !== id; })).then(render); }); break;
            case 'cash-in': cashModal(1); break;
            case 'cash-out': cashModal(-1); break;
            case 'cash-save': saveCash(num(el.dataset.sign) || 1); break;
            case 'detail': detailTrx(id); break;
            case 'print': printTrx(id); break;
            case 'wa': waTrx(id); break;
            case 'edit': editTrx(id); break;
            case 'del': delTrxs([id]); break;
            case 'bulk-del': delTrxs(Object.keys(S.his.sel)); break;
            case 'csv': exportCsv(); break;
            case 'reconcile': reconcile(); break;
        }
    }
    function onInput(e) {
        var t = e.target, id = t.id;
        if (id === 'omQ') { S.q = t.value; renderCatalog(); }
        else if (id === 'omQty' || id === 'omKurs') entryCalc('qty');
        else if (id === 'omTotal') entryCalc('total');
        else if (id === 'omNote') { S.note = t.value; saveDraft(); }
        else if (id === 'omStkQ') { S.stk.q = t.value; renderStk(); }
        else if (id === 'omSupQ') { S.sup.q = t.value; renderSup(); }
        else if (id === 'omHQ') { S.his.q = t.value; renderHis(); }
    }
    function onChange(e) {
        var t = e.target, id = t.id;
        if (id === 'omPrint') S.printAfter = t.checked;
        else if (id === 'omCust') { var c = resolveCustomer(t.value); S.cp.customerId = c ? String(c.id_nasabah) : ''; saveDraft(); }
        else if (id === 'omSupSel') { S.cp.supplierId = t.value; saveDraft(); }
        else if (id === 'omStkLow') { S.stk.low = t.checked; renderStk(); }
        else if (id === 'omHFrom') { S.his.from = t.value; renderHis(); } else if (id === 'omHTo') { S.his.to = t.value; renderHis(); }
        else if (id === 'omHType') { S.his.type = t.value; renderHis(); } else if (id === 'omHCat') { S.his.cat = t.value; renderHis(); }
        else if (id === 'omKFrom') { S.kas.from = t.value; renderKas(); } else if (id === 'omKTo') { S.kas.to = t.value; renderKas(); }
        else if (id === 'omOItem') { /* tidak ada aksi */ }
    }
    // render bagian daftar setelah body dibangun
    var baseRenderBody = renderBody;
    renderBody = function () {
        baseRenderBody();
        if (S.tab === 'stok') renderStk(); else if (S.tab === 'riwayat') { var h = S.his; if ($('omHType')) $('omHType').value = h.type; if ($('omHCat')) $('omHCat').value = h.cat; renderHis(); } else if (S.tab === 'kas') renderKas(); else if (S.tab === 'acuan') renderSup();
    };
    function bind() {
        if (S.bound) return; S.bound = true;
        document.addEventListener('click', function (e) { if (e.target.closest('#omRoot,#omModal')) onClick(e); });
        document.addEventListener('input', function (e) { if (e.target.closest('#omRoot,#omModal')) onInput(e); });
        document.addEventListener('change', function (e) { if (e.target.closest('#omRoot,#omModal')) onChange(e); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalOpen()) closeModal(); });
        document.addEventListener('click', function (e) { var m = $('omViewMenu'); if (m && !m.hidden && !e.target.closest('.om-vw')) m.hidden = true; });
        S.timer = setInterval(softRender, 4000);
        document.addEventListener('focusout', function () { if (S.pending) setTimeout(function () { if (!typing()) softRender(); }, 400); });
    }

    // ------------------------------------------------------------ API publik
    function init() { loadDraft(); loadView(); bind(); render(); }
    window.initOldMoneyView = init;
    window.loadOldMoneyDashboard = function () { softRender(); };
    window.loadOldMoneyCustomerSelect = function () { /* daftar nasabah dibaca saat keranjang dirender; tidak perlu render ulang */ };
    window.openOldMoneyItemModal = function (id) { bind(); itemModal(id); };
    window.openOldMoneySupplierModal = function (id) { bind(); supModal(id); };
    window.printOldMoneyReceiptRaw = printTrx;
    window.sendOldMoneyReceiptWhatsApp = waTrx;
    window.applyIso4217ToOldMoneyForm = function (code, country, currencyName) {
        bind(); itemModal();
        if ($('omICode')) $('omICode').value = code || '';
        if ($('omIDesc') && !$('omIDesc').value.trim()) $('omIDesc').value = currencyName || country || code || '';
        if (typeof window.closeIso4217Modal === 'function') window.closeIso4217Modal();
    };
    window.applyIso4217ToOldMoneySupplierForm = function (code) {
        bind(); supModal();
        if ($('omSCur')) $('omSCur').value = String(code || '').toUpperCase().slice(0, 3);
        if (typeof window.closeIso4217Modal === 'function') window.closeIso4217Modal();
    };
    document.addEventListener('click', function (e) {
        var n = e.target.closest && e.target.closest('.nav-item');
        if (n && n.getAttribute('data-target') === 'old-money-view') setTimeout(init, 0);
    });
    if ($('omRoot') && $('omRoot').offsetParent !== null) init();
})();
