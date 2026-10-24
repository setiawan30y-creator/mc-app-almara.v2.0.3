/* =====================================================================
 * 41-kurs-hari-ini.js  —  Kurs Hari Ini (papan kurs internal + kalkulator cepat)
 *
 *  - Papan kurs: kartu per valuta (beli/jual, selisih, tren, stok, rincian pecahan).
 *  - Pilih beberapa kartu (checkbox) -> kirim WhatsApp (modal & pengirim ada di 04-customer-currency.js).
 *  - Klik kartu -> dipakai kalkulator. Kalkulator: Valas -> Rp atau Rp -> Valas.
 *  - Otomatis diperbarui saat kurs/stok berubah (polling ringan, hanya saat halaman terbuka).
 *  - Warna memakai variabel tema (--mc-*).
 * ===================================================================== */
(function () {
    'use strict';

    var S = { q: '', focus: '', mode: 'fx2idr', dir: 'beli', showDenom: true, sig: '', denoms: null, denomAt: 0, timer: null, ready: false };
    window.selectedKursCodes = window.selectedKursCodes || [];

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var nfId = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
    var rpf = function (n) { return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(n) || 0); };
    var rate = function (v) {
        try { var u = window.AlmaraApp && window.AlmaraApp.utils; if (u && u.formatRate) return u.formatRate(v || 0).replace(/,0000$/, ''); } catch (e) { /* fallback */ }
        return nfId.format(Number(v) || 0);
    };
    var num = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };

    function currencies() { try { return (typeof getCurrencies === 'function' ? getCurrencies() : JSON.parse(localStorage.getItem('mc_currencies'))) || []; } catch (e) { return []; } }
    function masters() { try { return typeof getMasterCurrencies === 'function' ? getMasterCurrencies() : []; } catch (e) { return []; } }
    function baseOf(code) { return String(code || '').trim().toUpperCase().substring(0, 3); }
    function toast(icon, title) { if (window.Swal) window.Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 2200, showConfirmButton: false }); }

    // ------------------------------------------------------------ gaya
    function injectStyle() {
        if ($('kh-style')) return;
        var st = document.createElement('style'); st.id = 'kh-style';
        st.textContent = [
            '.kh-root{--kh-bd:var(--mc-border,rgba(148,163,184,.28));--kh-card:var(--mc-card-bg,#18181b);--kh-tx:var(--mc-text,#fafafa);--kh-mut:var(--mc-text-muted,#a1a1aa);',
            '--kh-pri:var(--mc-primary,#22c55e);--kh-buy:var(--mc-buy,#22c55e);--kh-sell:var(--mc-danger,#ef4444);--kh-warn:var(--mc-warning,#f59e0b);--kh-inp:var(--mc-input-bg,rgba(148,163,184,.08));--kh-r:var(--mc-radius,14px);color:var(--kh-tx)}',
            '.kh-root *{box-sizing:border-box}',
            '.kh-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
            '.kh-head h2{margin:0;font-size:1.25rem}.kh-head p{margin:4px 0 0;color:var(--kh-mut);font-size:.85rem}',
            '.kh-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
            '.kh-search{position:relative}.kh-search i{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--kh-mut);font-size:.8rem;pointer-events:none}',
            '.kh-search input{padding:8px 11px 8px 32px;width:210px;background:var(--kh-inp);border:1px solid var(--mc-input-border,var(--kh-bd));color:var(--kh-tx);border-radius:var(--mc-input-radius,10px);font:inherit}',
            '.kh-btn{border:1px solid var(--kh-bd);background:transparent;color:var(--kh-tx);padding:8px 13px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:600;font-size:.82rem;display:inline-flex;align-items:center;gap:7px}',
            '.kh-btn:hover{background:var(--kh-inp)}.kh-btn[disabled]{opacity:.5;cursor:not-allowed}.kh-btn.on{border-color:var(--kh-pri);color:var(--kh-pri)}',
            '.kh-btn.wa{background:#25d366;border-color:#25d366;color:#fff}.kh-btn.wa[disabled]{background:transparent;color:var(--kh-mut);border-color:var(--kh-bd)}',
            '.kh-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}',
            '@media(max-width:1100px){.kh-layout{grid-template-columns:1fr}}',
            '.kh-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:12px}',
            '.kh-card{background:var(--kh-card);border:1px solid var(--kh-bd);border-radius:var(--kh-r);padding:12px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:border-color .15s,box-shadow .15s}',
            '.kh-card:hover{border-color:var(--kh-pri)}.kh-card.sel{border-color:var(--kh-pri);box-shadow:0 0 0 1px var(--kh-pri)}.kh-card.foc{box-shadow:0 0 0 2px color-mix(in srgb,var(--kh-pri) 55%,transparent)}',
            '.kh-top{display:flex;align-items:center;gap:8px}.kh-top input{width:16px;height:16px;margin:0;accent-color:var(--kh-pri);cursor:pointer}',
            '.kh-flag{width:34px;height:24px;border-radius:4px;border:1px solid var(--kh-bd);overflow:hidden;display:inline-flex;align-items:center;justify-content:center;background:var(--kh-inp);font-size:.7rem;font-weight:700;flex:none}',
            '.kh-flag img{width:100%;height:100%;object-fit:cover}',
            '.kh-code{font-weight:800;font-size:1.05rem;display:flex;align-items:center;gap:6px}.kh-ctry{margin-left:auto;color:var(--kh-mut);font-size:.72rem;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}',
            '.kh-up{color:var(--kh-buy)}.kh-dn{color:var(--kh-sell)}.kh-flat{color:var(--kh-mut)}',
            '.kh-rates{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
            '.kh-rate{border-radius:10px;padding:7px 8px;text-align:center;border:1px solid transparent}',
            '.kh-rate small{display:block;font-size:.65rem;font-weight:800;letter-spacing:.06em}.kh-rate b{font-size:1.08rem}',
            '.kh-rate.b{background:color-mix(in srgb,var(--kh-buy) 10%,transparent);border-color:color-mix(in srgb,var(--kh-buy) 25%,transparent);color:var(--kh-buy)}',
            '.kh-rate.s{background:color-mix(in srgb,var(--kh-sell) 10%,transparent);border-color:color-mix(in srgb,var(--kh-sell) 25%,transparent);color:var(--kh-sell)}',
            '.kh-meta{display:flex;justify-content:space-between;align-items:center;font-size:.76rem;color:var(--kh-mut)}',
            '.kh-meta b{color:var(--kh-tx)}.kh-low{color:var(--kh-warn);font-weight:700}.kh-ok{color:var(--kh-buy)}',
            '.kh-den{border-top:1px solid var(--kh-bd);padding-top:8px}.kh-den summary{cursor:pointer;font-size:.72rem;font-weight:700;color:var(--kh-mut);list-style:none}',
            '.kh-den summary::-webkit-details-marker{display:none}.kh-den summary:after{content:" ▾"}.kh-den[open] summary:after{content:" ▴"}',
            '.kh-dr{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;padding:4px 0;font-size:.74rem;border-top:1px dashed var(--kh-bd)}.kh-dr:first-of-type{border-top:0}',
            '.kh-dr .b{color:var(--kh-buy);text-align:right}.kh-dr .s{color:var(--kh-sell);text-align:right}.kh-dh{color:var(--kh-mut);font-size:.66rem;text-transform:uppercase}',
            '.kh-calc{background:var(--kh-card);border:1px solid var(--kh-bd);border-radius:var(--kh-r);padding:16px;position:sticky;top:12px}',
            '.kh-calc h3{margin:0 0 12px;font-size:1rem;display:flex;gap:8px;align-items:center}',
            '.kh-f{margin-bottom:11px}.kh-f label{display:block;font-size:.72rem;color:var(--kh-mut);margin-bottom:4px;font-weight:600}',
            '.kh-f select,.kh-f input{width:100%;background:var(--kh-inp);border:1px solid var(--mc-input-border,var(--kh-bd));color:var(--kh-tx);border-radius:var(--mc-input-radius,10px);padding:9px 11px;font:inherit}',
            '.kh-seg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--kh-bd);border-radius:10px;overflow:hidden}',
            '.kh-seg button{border:0;background:transparent;color:var(--kh-mut);padding:8px 6px;font-weight:700;font-size:.78rem;cursor:pointer}',
            '.kh-seg button.on{background:var(--kh-pri);color:#fff}',
            '.kh-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.kh-chips button{border:1px solid var(--kh-bd);background:transparent;color:var(--kh-tx);border-radius:999px;padding:2px 10px;font-size:.74rem;cursor:pointer}.kh-chips button:hover{border-color:var(--kh-pri)}',
            '.kh-res{background:color-mix(in srgb,var(--kh-pri) 10%,transparent);border:1px dashed color-mix(in srgb,var(--kh-pri) 50%,transparent);border-radius:12px;padding:12px;margin-top:4px}',
            '.kh-res small{color:var(--kh-mut);font-size:.7rem;text-transform:uppercase;font-weight:700;letter-spacing:.05em}.kh-res b{display:block;font-size:1.55rem;color:var(--kh-pri);margin-top:2px;word-break:break-word}',
            '.kh-ref{display:flex;justify-content:space-between;font-size:.8rem;color:var(--kh-mut);margin:2px 0 8px}.kh-ref b{color:var(--kh-tx)}',
            '.kh-empty{grid-column:1/-1;text-align:center;padding:40px 16px;color:var(--kh-mut);border:1px dashed var(--kh-bd);border-radius:var(--kh-r)}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ shell
    function shell() {
        var root = $('kursRoot'); if (!root) return false;
        if (root.dataset.ready === '1') return true;
        root.className = 'kh-root';
        root.innerHTML =
            '<div class="kh-head"><div><h2><i class="fa-solid fa-money-bill-trend-up"></i> Kurs Hari Ini</h2>' +
            '<p>Referensi kurs aktif untuk teller/kasir <span id="khStamp"></span></p></div>' +
            '<div class="kh-tools"><div class="kh-search"><i class="fa-solid fa-magnifying-glass"></i><input id="khSearch" placeholder="Cari kode atau negara" autocomplete="off"></div>' +
            '<button class="kh-btn on" id="khDenomBtn" data-kh="denom" title="Tampilkan rincian pecahan"><i class="fa-solid fa-coins"></i> Pecahan</button>' +
            '<button class="kh-btn" id="khAllBtn" data-kh="all"><i class="fa-solid fa-square-check"></i> Pilih semua</button>' +
            '<button class="kh-btn wa" id="khWaBtn" data-kh="wa" disabled><i class="fa-brands fa-whatsapp"></i> Kirim WA (<span id="khCount">0</span>)</button></div></div>' +
            '<div class="kh-layout"><div class="kh-board" id="khBoard"></div>' +
            '<aside class="kh-calc"><h3><i class="fa-solid fa-calculator"></i> Kalkulator Kurs Cepat</h3>' +
            '<div class="kh-f"><label>Valas</label><select id="khCur"></select></div>' +
            '<div class="kh-f"><label>Jenis transaksi</label><div class="kh-seg" id="khDir"><button data-kh="dir" data-v="beli" class="on" title="Nasabah menjual ke kita">Kita BELI</button><button data-kh="dir" data-v="jual" title="Nasabah membeli dari kita">Kita JUAL</button></div></div>' +
            '<div class="kh-f"><label>Arah hitung</label><div class="kh-seg" id="khMode"><button data-kh="mode" data-v="fx2idr" class="on">Valas → Rp</button><button data-kh="mode" data-v="idr2fx">Rp → Valas</button></div></div>' +
            '<div class="kh-f"><label id="khAmtLabel">Jumlah valas</label><input id="khAmt" inputmode="decimal" value="1" autocomplete="off"><div class="kh-chips" id="khChips"></div></div>' +
            '<div class="kh-ref"><span>Kurs acuan</span><b id="khRate">Rp 0</b></div>' +
            '<div class="kh-res"><small id="khResLabel">Hasil (Rp)</small><b id="khRes">Rp 0</b></div>' +
            '<button class="kh-btn" data-kh="copy" style="width:100%;justify-content:center;margin-top:10px"><i class="fa-regular fa-copy"></i> Salin hasil</button></aside></div>';
        root.dataset.ready = '1';
        return true;
    }

    // ------------------------------------------------------------ papan
    function flagOf(code) {
        var base = baseOf(code), ms = masters();
        var m = ms.find(function (x) { return x.code === code; }) || ms.find(function (x) { return x.code === base; }) || {};
        return { cc: String(m.countryCode || '').toLowerCase(), country: m.country || 'Global' };
    }
    function trendIcon(t) {
        if (t === 'up') return '<span class="kh-up" title="Naik">▲</span>';
        if (t === 'down') return '<span class="kh-dn" title="Turun">▼</span>';
        return '<span class="kh-flat" title="Stabil">─</span>';
    }
    function denomHtml(code) {
        if (!S.showDenom || !S.denoms) return '';
        var rows = S.denoms.filter(function (r) { return String(r.currency_code || '').toUpperCase() === code && Number(r.is_active) !== 0; })
            .sort(function (a, b) { return Number(b.denomination || 0) - Number(a.denomination || 0); });
        if (!rows.length) return '';
        return '<details class="kh-den" data-stop="1"><summary>Rincian pecahan (' + rows.length + ')</summary>' +
            '<div class="kh-dr kh-dh"><span>Pecahan</span><span>Beli</span><span>Jual</span></div>' +
            rows.map(function (r) {
                return '<div class="kh-dr"><span>' + (r.type === 'coin' ? 'Koin ' : 'Kertas ') + esc(nfId.format(r.denomination)) + '</span><span class="b">' + esc(rate(r.buy)) + '</span><span class="s">' + esc(rate(r.sell)) + '</span></div>';
            }).join('') + '</details>';
    }
    function cardHtml(c) {
        var code = String(c.code || '').toUpperCase(), f = flagOf(code);
        var low = (Number(c.stock) || 0) <= (Number(c.alert) || 0);
        var sel = window.selectedKursCodes.indexOf(code) !== -1;
        var spread = (Number(c.sell) || 0) - (Number(c.buy) || 0);
        return '<div class="kh-card' + (sel ? ' sel' : '') + (S.focus === code ? ' foc' : '') + '" data-code="' + esc(code) + '" data-country="' + esc(f.country.toLowerCase()) + '">' +
            '<div class="kh-top"><input type="checkbox" data-kh="chk" value="' + esc(code) + '"' + (sel ? ' checked' : '') + ' aria-label="Pilih ' + esc(code) + '">' +
            '<span class="kh-flag">' + (f.cc ? '<img src="https://flagcdn.com/w80/' + esc(f.cc) + '.png" alt="" loading="lazy" onerror="this.remove()">' : esc(code.slice(0, 2))) + '</span>' +
            '<span class="kh-code">' + esc(code) + ' ' + trendIcon(c.trend) + '</span><span class="kh-ctry">' + esc(f.country) + '</span></div>' +
            '<div class="kh-rates"><div class="kh-rate b"><small>BELI</small><b>' + esc(rate(c.buy)) + '</b></div><div class="kh-rate s"><small>JUAL</small><b>' + esc(rate(c.sell)) + '</b></div></div>' +
            '<div class="kh-meta"><span>Selisih <b>' + esc(rate(spread)) + '</b></span><span>Stok <b>' + esc(new Intl.NumberFormat('id-ID').format(Number(c.stock) || 0)) + '</b> ' +
            (low ? '<i class="fa-solid fa-triangle-exclamation kh-low" title="Stok minim"></i>' : '<i class="fa-solid fa-circle-check kh-ok" title="Stok aman"></i>') + '</span></div>' +
            denomHtml(code) + '</div>';
    }
    function visibleList() {
        var q = S.q.toLowerCase().trim();
        return currencies().filter(function (c) {
            if (!q) return true;
            var code = String(c.code || '').toLowerCase(), country = flagOf(String(c.code || '').toUpperCase()).country.toLowerCase();
            return code.indexOf(q) !== -1 || country.indexOf(q) !== -1;
        });
    }
    function renderBoard() {
        var el = $('khBoard'); if (!el) return;
        var list = visibleList();
        el.innerHTML = list.length ? list.map(cardHtml).join('') : '<div class="kh-empty"><i class="fa-solid fa-circle-info" style="font-size:1.6rem;display:block;margin-bottom:8px"></i>' + (S.q ? 'Tidak ada valuta yang cocok.' : 'Belum ada kurs aktif. Isi di menu Manajemen Kurs.') + '</div>';
        // kalkulator
        var sel = $('khCur'), all = currencies();
        if (sel) {
            var keep = S.focus || sel.value;
            sel.innerHTML = all.map(function (c) { return '<option value="' + esc(c.code) + '">' + esc(String(c.code).toUpperCase()) + '</option>'; }).join('');
            if (keep && all.some(function (c) { return c.code === keep; })) sel.value = keep; else if (all.length) sel.value = all[0].code;
            S.focus = sel.value;
        }
        updateSelectionUI(); calc();
        var st = $('khStamp'); if (st) st.textContent = '· diperbarui ' + new Date().toLocaleTimeString('id-ID');
    }
    function updateSelectionUI() {
        var n = window.selectedKursCodes.length;
        var c = $('khCount'); if (c) c.textContent = n;
        var wa = $('khWaBtn'); if (wa) wa.disabled = n === 0;
        var ab = $('khAllBtn'); if (ab) ab.innerHTML = n ? '<i class="fa-regular fa-square"></i> Batal pilih' : '<i class="fa-solid fa-square-check"></i> Pilih semua';
        document.querySelectorAll('#khBoard .kh-card').forEach(function (card) {
            var code = card.dataset.code, on = window.selectedKursCodes.indexOf(code) !== -1;
            card.classList.toggle('sel', on); card.classList.toggle('foc', S.focus === code);
            var cb = card.querySelector('[data-kh=chk]'); if (cb) cb.checked = on;
        });
    }

    // ------------------------------------------------------------ kalkulator
    function calc() {
        var code = ($('khCur') || {}).value, cur = currencies().find(function (c) { return c.code === code; });
        var r = cur ? (S.dir === 'beli' ? Number(cur.buy) : Number(cur.sell)) || 0 : 0;
        var amt = num(($('khAmt') || {}).value);
        var lbl = $('khAmtLabel'), rl = $('khResLabel');
        if (lbl) lbl.textContent = S.mode === 'fx2idr' ? 'Jumlah valas (' + (code || '-') + ')' : 'Jumlah Rupiah';
        if (rl) rl.textContent = S.mode === 'fx2idr' ? 'Hasil (Rp)' : 'Hasil (' + (code || '-') + ')';
        var out = S.mode === 'fx2idr' ? amt * r : (r ? amt / r : 0);
        if ($('khRate')) $('khRate').textContent = rpf(r);
        var text = S.mode === 'fx2idr' ? rpf(out) : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(out) + ' ' + (code || '');
        if ($('khRes')) $('khRes').textContent = text;
        var chips = $('khChips');
        if (chips) {
            var vals = S.mode === 'fx2idr' ? [1, 10, 50, 100, 500, 1000] : [100000, 500000, 1000000, 5000000, 10000000];
            chips.innerHTML = vals.map(function (v) { return '<button type="button" data-kh="chip" data-v="' + v + '">' + new Intl.NumberFormat('id-ID').format(v) + '</button>'; }).join('');
        }
        S.lastText = text;
    }

    // ------------------------------------------------------------ pecahan & polling
    async function loadDenoms(force) {
        if (!force && S.denoms && Date.now() - S.denomAt < 60000) return;
        try {
            var res = await fetch('/api/currency-denominations?active=true', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            var j = await res.json();
            if (j.status === 'success' && Array.isArray(j.data)) { S.denoms = j.data; S.denomAt = Date.now(); }
        } catch (e) { /* pecahan opsional */ }
    }
    function signature() {
        return currencies().map(function (c) { return [c.code, c.buy, c.sell, c.stock, c.alert, c.trend].join('|'); }).join(';');
    }
    function visible() { var v = $('kurs-hari-ini-view'); return !!v && !v.classList.contains('hidden') && v.offsetParent !== null; }
    function tick() {
        if (!visible() || document.hidden) return;
        var sg = signature();
        if (sg !== S.sig) { S.sig = sg; renderBoard(); }
    }

    // ------------------------------------------------------------ event
    var bound = false;
    function bind() {
        if (bound) return; bound = true;
        document.addEventListener('click', function (ev) {
            var root = $('kursRoot'); if (!root || !root.contains(ev.target)) return;
            var t = ev.target.closest('[data-kh]');
            if (t) {
                var a = t.dataset.kh;
                if (a === 'chk') {
                    var code = t.value, i = window.selectedKursCodes.indexOf(code);
                    if (i === -1) window.selectedKursCodes.push(code); else window.selectedKursCodes.splice(i, 1);
                    updateSelectionUI(); return;
                }
                if (a === 'all') { window.selectAllKurs(window.selectedKursCodes.length === 0); return; }
                if (a === 'wa') { if (typeof window.sendSelectedKursViaWa === 'function') window.sendSelectedKursViaWa(); return; }
                if (a === 'denom') { S.showDenom = !S.showDenom; t.classList.toggle('on', S.showDenom); renderBoard(); return; }
                if (a === 'dir') { S.dir = t.dataset.v; document.querySelectorAll('#khDir button').forEach(function (b) { b.classList.toggle('on', b === t); }); calc(); return; }
                if (a === 'mode') { S.mode = t.dataset.v; document.querySelectorAll('#khMode button').forEach(function (b) { b.classList.toggle('on', b === t); }); $('khAmt').value = S.mode === 'fx2idr' ? '1' : '1000000'; calc(); return; }
                if (a === 'chip') { $('khAmt').value = new Intl.NumberFormat('id-ID').format(Number(t.dataset.v)); calc(); return; }
                if (a === 'copy') {
                    var txt = S.lastText || ''; try { navigator.clipboard.writeText(txt); } catch (e) { /* abaikan */ }
                    toast('success', 'Hasil disalin'); return;
                }
            }
            var card = ev.target.closest('.kh-card');
            if (card && !ev.target.closest('.kh-den') && !ev.target.closest('input')) {
                S.focus = card.dataset.code; var sel = $('khCur'); if (sel) sel.value = S.focus; updateSelectionUI(); calc();
            }
        });
        document.addEventListener('input', function (ev) {
            if (ev.target.id === 'khSearch') { S.q = ev.target.value; renderBoard(); }
            else if (ev.target.id === 'khAmt') {
                var raw = ev.target.value.replace(/[^\d,]/g, ''), parts = raw.split(',');
                var intPart = parts[0].replace(/^0+(?=\d)/, '');
                ev.target.value = (intPart ? new Intl.NumberFormat('id-ID').format(Number(intPart)) : '') + (parts.length > 1 ? ',' + parts[1].slice(0, 4) : '');
                calc();
            }
        });
        document.addEventListener('change', function (ev) {
            if (ev.target.id === 'khCur') { S.focus = ev.target.value; updateSelectionUI(); calc(); }
        });
    }

    // ------------------------------------------------------------ API publik (nama lama tetap)
    window.loadKursHariIniTable = function () {
        injectStyle(); bind();
        if (!shell()) return;
        S.sig = signature(); renderBoard();
        loadDenoms(false).then(function () { if (S.denoms) renderBoard(); });
        if (!S.timer) S.timer = setInterval(tick, 4000);
    };
    window.filterKursHariIni = function () { var s = $('khSearch'); S.q = s ? s.value : ''; renderBoard(); };
    window.calculateQuickRate = calc;
    window.selectAllKurs = function (on) {
        window.selectedKursCodes = on ? visibleList().map(function (c) { return String(c.code).toUpperCase(); }) : [];
        updateSelectionUI();
    };
    window.toggleKursSelection = function (code) {
        var i = window.selectedKursCodes.indexOf(code);
        if (i === -1) window.selectedKursCodes.push(code); else window.selectedKursCodes.splice(i, 1);
        updateSelectionUI();
    };
    window.updateKursSelectionUI = updateSelectionUI;
})();
