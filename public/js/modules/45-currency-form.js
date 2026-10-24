/* =====================================================================
 * 45-currency-form.js  —  Form Tambah / Edit Valuta (Manajemen Kurs)
 *
 *  Menggantikan modal lama (#currencyModal di dashboard.blade.php) dan fungsi lamanya di 04-customer-currency.js.
 *   - Kode valuta dipilih dari daftar ISO 4217 seluruh dunia (pemilih yang sama dengan form lain, 44-iso-picker.js).
 *   - Kode turunan (mis. USDK untuk pecahan kecil) tetap didukung dan otomatis mewarisi kurs dasar induknya.
 *   - Pratinjau kurs akhir (kurs dasar + selisih), selisih beli-jual, dan status stok langsung terlihat.
 *   - Data tersimpan dengan bentuk yang sama seperti sebelumnya (mc_currencies), jadi laporan/kasir tidak berubah.
 * ===================================================================== */
(function () {
    'use strict';

    var S = { editing: false, orig: '', base: '', suffix: '', sep: ' ', busy: false };

    var $ = function (id) { return document.getElementById(id); };
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
    var nfmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
    function nf(n) { return nfmt.format(Number(n) || 0); }
    // parser angka yang paham format Indonesia (15.600,5) maupun titik desimal (15600.5)
    function pn(v) {
        var s = String(v == null ? '' : v).trim().replace(/\s/g, ''); if (!s) return 0;
        var neg = s.charAt(0) === '-'; s = s.replace(/[^0-9.,]/g, '');
        var dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
        if (dots && commas) { var last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(',')); s = s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1); }
        else if (commas > 1 || dots > 1) s = s.replace(/[.,]/g, '');
        else if (commas === 1) s = /,\d{3}$/.test(s) && !/^0,/.test(s) ? s.replace(',', '') : s.replace(',', '.');
        else if (dots === 1 && /\.\d{3}$/.test(s) && !/^0\./.test(s)) s = s.replace('.', '');
        var n = parseFloat(s); return isFinite(n) ? (neg ? -n : n) : 0;
    }
    function toast(icon, title) {
        if (window.Swal) window.Swal.fire({ icon: icon, title: title, toast: true, position: 'top-end', timer: 2600, showConfirmButton: false });
        else alert(title);
    }
    function isoList() { return typeof window.getIsoCurrencyList === 'function' ? window.getIsoCurrencyList() : []; }
    function isoItem(code) { code = String(code || '').toUpperCase(); return isoList().filter(function (i) { return i.code === code; })[0] || null; }
    function flagEmoji(item, code) {
        var cc = String((item && item.countryCode) || '').toUpperCase(), c = String(code || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(cc)) cc = /^X/.test(c) ? '' : c.slice(0, 2);
        if (!/^[A-Z]{2}$/.test(cc)) return '🌐';
        return String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1));
    }
    function splitCode(code) {
        code = String(code || '').trim();
        if (!code || isoItem(code)) return { base: code.toUpperCase(), suffix: '', sep: ' ' };
        var m = code.match(/^([A-Za-z]{3})([ -]?)(\S.{0,5})$/);
        if (m && isoItem(m[1].toUpperCase())) return { base: m[1].toUpperCase(), suffix: m[3].trim(), sep: m[2] };   // huruf & pemisah kode turunan dipertahankan
        return { base: code.toUpperCase(), suffix: '', sep: ' ' };
    }
    // Kode turunan ditulis dengan spasi ("USD KECIL") agar tidak terbaca sebagai kode ISO baku.
    function fullCode() { return S.base ? S.base + (S.suffix ? S.sep + S.suffix : '') : ''; }
    // Inisial nama profil perusahaan (mis. "PT Almara Valuta" -> " (AV)"); kosong bila profil belum diisi.
    function ini() {
        var name = '';
        try { var p = typeof getProfile === 'function' ? getProfile() : null; name = String((p && p.name) || '').trim(); } catch (e) { /* abaikan */ }
        var skip = { pt: 1, cv: 1, ud: 1, pd: 1, tbk: 1 };
        var t = name.split(/[^A-Za-z0-9]+/).filter(function (x) { return x && !skip[x.toLowerCase()]; });
        if (!t.length) return '';
        return ' (' + (t.length === 1 ? t[0].toUpperCase().slice(0, 6) : t.map(function (x) { return x.charAt(0); }).join('').toUpperCase().slice(0, 5)) + ')';
    }
    function currencies() { try { return typeof getCurrencies === 'function' ? getCurrencies() : []; } catch (e) { return []; } }

    // ------------------------------------------------------------ gaya
    function injectStyle() {
        if ($('cf-style')) return;
        var st = document.createElement('style'); st.id = 'cf-style';
        st.textContent = [
            '.cf-ov{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10040;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:3vh 12px;',
            '--cf-bd:var(--mc-border,rgba(148,163,184,.28));--cf-mut:var(--mc-text-muted,#94a3b8);--cf-pri:var(--mc-primary,#22c55e);--cf-buy:#10b981;--cf-sell:#ef4444;--cf-warn:var(--mc-warning,#f59e0b);--cf-inp:var(--mc-input-bg,rgba(255,255,255,.05))}',
            '.cf-ov *{box-sizing:border-box}.cf-md{background:var(--mc-card-bg,#18181b);color:var(--mc-text,#fafafa);border:1px solid var(--cf-bd);border-radius:var(--mc-radius,16px);width:100%;max-width:720px;box-shadow:0 24px 60px rgba(0,0,0,.5)}',
            '.cf-h{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--cf-bd)}.cf-h h3{margin:0;font-size:1.1rem;display:flex;gap:10px;align-items:center}.cf-h small{display:block;color:var(--cf-mut);font-size:.78rem;margin-top:2px;font-weight:400}',
            '.cf-x{border:0;background:transparent;color:var(--cf-mut);font-size:1.6rem;cursor:pointer;line-height:1}',
            '.cf-b{padding:18px 20px;display:flex;flex-direction:column;gap:16px}',
            '.cf-sec{border:1px solid var(--cf-bd);border-radius:14px;padding:14px 16px}.cf-sec>h4{margin:0 0 12px;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--cf-mut);display:flex;gap:8px;align-items:center}',
            '.cf-cur{display:flex;gap:14px;align-items:center;cursor:pointer;border-radius:12px;padding:6px}.cf-cur.locked{cursor:default}.cf-cur:not(.locked):hover{background:var(--cf-inp)}',
            '.cf-fl{font-size:2.4rem;line-height:1;width:56px;text-align:center}.cf-cc{font-size:1.5rem;font-weight:900;letter-spacing:.04em}.cf-cn{font-size:.86rem;color:var(--cf-mut);margin-top:2px}',
            '.cf-btn{border:1px solid var(--cf-bd);background:transparent;color:var(--mc-text,#fafafa);padding:9px 15px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:700;font-size:.85rem;display:inline-flex;gap:7px;align-items:center;font-family:inherit}',
            '.cf-btn:hover{background:var(--cf-inp)}.cf-btn.pri{background:var(--cf-pri);border-color:var(--cf-pri);color:#fff}.cf-btn[disabled]{opacity:.55;cursor:not-allowed}',
            '.cf-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.cf-g2{grid-template-columns:1fr}}',
            '.cf-f label{display:block;font-size:.74rem;font-weight:700;color:var(--cf-mut);margin-bottom:5px}',
            '.cf-in{width:100%;background:var(--cf-inp);border:1px solid var(--mc-input-border,var(--cf-bd));color:var(--mc-text,#fafafa);border-radius:var(--mc-input-radius,10px);padding:10px 12px;font-size:.95rem;font-family:inherit}',
            '.cf-in[readonly]{opacity:.75;cursor:not-allowed;background:color-mix(in srgb,var(--cf-inp) 60%,transparent);border-style:dashed}.cf-in[readonly]:focus{outline:none}',
            '.cf-in:focus{outline:2px solid color-mix(in srgb,var(--cf-pri) 55%,transparent);outline-offset:0}.cf-in.sfx{width:110px;text-transform:uppercase}',
            '.cf-hint{font-size:.76rem;color:var(--cf-mut);margin-top:5px;line-height:1.4}.cf-hint.warn{color:var(--cf-warn)}.cf-hint.bad{color:var(--cf-sell)}.cf-hint.ok{color:var(--cf-buy)}.cf-hint a{color:var(--mc-info,#38bdf8);cursor:pointer;font-weight:700}',
            '.cf-res{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}@media(max-width:560px){.cf-res{grid-template-columns:1fr}}',
            '.cf-card{border-radius:12px;padding:10px 12px;border:1px solid var(--cf-bd);background:var(--cf-inp)}.cf-card small{display:block;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--cf-mut)}.cf-card b{font-size:1.25rem}',
            '.cf-card.buy b{color:var(--cf-buy)}.cf-card.sell b{color:var(--cf-sell)}.cf-card.bad{border-color:var(--cf-sell)}',
            '.cf-sfx{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;font-size:.8rem;color:var(--cf-mut)}',
            '.cf-meta{font-size:.74rem;color:var(--cf-mut)}.cf-lock{font-size:.7rem;font-weight:800;border-radius:999px;padding:3px 10px;background:var(--cf-inp);border:1px solid var(--cf-bd);color:var(--cf-mut)}',
            '.cf-f2{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:14px 20px;border-top:1px solid var(--cf-bd)}',
            '.cf-err{display:none;color:var(--cf-sell);font-weight:700;font-size:.86rem}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ pembuka
    function closeModal() { var m = $('cfModal'); if (m) m.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape' && $('cfModal') && !$('ipModal')) closeModal(); }
    function open(code, preset) {
        injectStyle(); closeModal();
        var c = null;
        if (code) { c = currencies().filter(function (x) { return String(x.code) === String(code); })[0] || null; if (!c) return toast('error', 'Valuta ' + code + ' tidak ditemukan.'); }
        S.editing = !!c; S.orig = c ? c.code : '';
        var sp = splitCode(c ? c.code : (preset || '')); S.base = sp.base; S.suffix = sp.suffix; S.sep = sp.sep; S.busy = false;
        var baseBuy = c ? (c.base_buy !== undefined ? c.base_buy : c.buy) : '', baseSell = c ? (c.base_sell !== undefined ? c.base_sell : c.sell) : '';
        var admin = false; try { var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null; admin = u && (u.role === 'admin' || u.role === 'owner'); } catch (e) { /* abaikan */ }
        var ov = document.createElement('div'); ov.className = 'cf-ov'; ov.id = 'cfModal';
        ov.innerHTML = '<div class="cf-md" role="dialog" aria-modal="true"><div class="cf-h"><h3><i class="fa-solid fa-money-bill-transfer"></i><span id="cfTitle"></span></h3><button type="button" class="cf-x" data-cf="close" aria-label="Tutup">&times;</button></div>' +
            '<div class="cf-b">' +
            '<div class="cf-sec"><h4><i class="fa-solid fa-globe"></i> Mata uang (ISO 4217)</h4><div class="cf-cur' + (S.editing ? ' locked' : '') + '" id="cfCur" data-cf="' + (S.editing ? 'noop' : 'pick') + '"></div><div id="cfSfxBox"></div></div>' +
            '<div class="cf-sec"><h4><i class="fa-solid fa-scale-balanced"></i> Kurs dasar (Web / Master)</h4><div class="cf-g2"><div class="cf-f"><label for="cfBuy">Kurs dasar beli (Rp)</label><input class="cf-in" id="cfBuy" inputmode="decimal" autocomplete="off" value="' + (baseBuy !== '' ? esc(nf(baseBuy)) : '') + '" placeholder="0"></div>' +
            '<div class="cf-f"><label for="cfSell">Kurs dasar jual (Rp)</label><input class="cf-in" id="cfSell" inputmode="decimal" autocomplete="off" value="' + (baseSell !== '' ? esc(nf(baseSell)) : '') + '" placeholder="0"></div></div><div class="cf-hint" id="cfInherit"></div></div>' +
            '<div class="cf-sec"><h4><i class="fa-solid fa-sliders"></i> Selisih &amp; kurs akhir</h4><div class="cf-g2"><div class="cf-f"><label for="cfMb">Selisih beli (mis. -50)</label><input class="cf-in" id="cfMb" inputmode="decimal" autocomplete="off" value="' + (c && c.margin_buy ? esc(nf(c.margin_buy)) : '') + '" placeholder="0"></div>' +
            '<div class="cf-f"><label for="cfMs">Selisih jual (mis. 50)</label><input class="cf-in" id="cfMs" inputmode="decimal" autocomplete="off" value="' + (c && c.margin_sell ? esc(nf(c.margin_sell)) : '') + '" placeholder="0"></div></div>' +
            '<div class="cf-res"><div class="cf-card buy"><small>Kurs Beli' + ini() + '</small><b id="cfFinalBuy">-</b></div><div class="cf-card sell"><small>Kurs Jual' + ini() + '</small><b id="cfFinalSell">-</b></div></div><div class="cf-hint" id="cfSpreadHint"></div></div>' +
            '<div class="cf-sec"><h4><i class="fa-solid fa-boxes-stacked"></i> Stok</h4><div class="cf-g2"><div class="cf-f"><label for="cfStock">' + (S.editing ? 'Stok saat ini' : 'Stok awal') + '</label><input class="cf-in" id="cfStock" inputmode="decimal" autocomplete="off" value="' + (c ? esc(nf(c.stock || 0)) : '') + '" placeholder="0"></div>' +
            '<div class="cf-f"><label for="cfAlert">Batas aman (peringatan stok)</label><input class="cf-in" id="cfAlert" inputmode="decimal" autocomplete="off" value="' + (c ? esc(nf(c.alert || 0)) : '') + '" placeholder="500"></div></div><div class="cf-hint" id="cfStockHint"></div>' +
            (S.editing ? '<div class="cf-hint"><i class="fa-solid fa-lock"></i> Stok dikunci: berubah otomatis lewat transaksi (pembelian, penjualan, closing). Koreksi stok dilakukan lewat menu Saldo Awal / penyesuaian.</div>' : '') + '</div>' +
            '<div id="cfErr" class="cf-err"></div></div>' +
            '<div class="cf-f2"><span class="cf-meta">' + (admin && c && (c.inputBy || c.editBy) ? (c.inputBy ? 'Input: ' + esc(c.inputBy) : '') + (c.editBy ? ' · Edit: ' + esc(c.editBy) : '') : '') + '</span><div style="display:flex;gap:8px"><button type="button" class="cf-btn" data-cf="close">Batal</button><button type="button" class="cf-btn pri" id="cfSave" data-cf="save"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div></div></div>';
        // Gaya penting dipasang inline agar tidak bisa disembunyikan/ditimpa CSS tema lain.
        ['display:flex', 'visibility:visible', 'opacity:1', 'position:fixed', 'z-index:10040'].forEach(function (d) { var kv = d.split(':'); ov.style.setProperty(kv[0], kv[1], 'important'); });
        document.body.appendChild(ov);
        document.addEventListener('keydown', onKey);
        ov.addEventListener('click', function (e) {
            var el = e.target.closest('[data-cf]'); if (!el) return;
            var a = el.dataset.cf;
            if (a === 'close') closeModal(); else if (a === 'pick') pickIso(); else if (a === 'save') save(); else if (a === 'inherit') inherit();
        });
        ov.addEventListener('input', function (e) {
            if (e.target.id === 'cfSfx') {
                // Isi persis seperti diketik (huruf besar/kecil dipertahankan); hanya karakter berbahaya dibuang dan spasi ganda dirapikan.
                var v = e.target.value.replace(/[^A-Za-z0-9 ()\-.\/+*#&]/g, '').replace(/^ +/, '').replace(/ {2,}/g, ' ');
                if (v !== e.target.value) e.target.value = v;
                S.suffix = v.trim(); S.sep = ' '; renderSfxPreview(); renderCode(true);
            }
            recalc();
        });
        ov.querySelector('.cf-md').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } });
        if (S.editing) {
            ['cfBuy', 'cfSell', 'cfStock'].forEach(function (id) {
                var el = $(id); if (!el) return;
                el.readOnly = true; el.tabIndex = -1;
                el.title = id === 'cfStock' ? 'Dikunci: stok berubah lewat transaksi' : 'Dikunci: kurs dasar mengikuti sumber/master kurs';
                var lb = ov.querySelector('label[for="' + id + '"]'); if (lb) lb.innerHTML = lb.textContent + ' <i class="fa-solid fa-lock" style="font-size:.7em;opacity:.7"></i>';
            });
        }
        renderCode(); recalc();
        setTimeout(function () { var f = S.base ? (S.editing ? $('cfMb') : $('cfBuy')) : null; if (f) f.focus(); else if (!S.base) pickIso(); }, 60);
    }
    function pickIso() {
        if (typeof window.openIsoPicker !== 'function') return toast('error', 'Pemilih ISO 4217 belum termuat. Muat ulang halaman.');
        window.openIsoPicker({ title: 'Pilih Kode Valuta (ISO 4217)', current: S.base, onPick: function (it) { S.base = it.code; renderCode(); recalc(); var b = $('cfBuy'); if (b) b.focus(); } });
    }

    function renderSfxPreview() { var p = $('cfSfxPrev'); if (p) p.textContent = S.suffix ? fullCode() : S.base + ' (tanpa turunan)'; }
    function renderCode(keepFocus) {
        var box = $('cfCur'); if (!box) return;
        var it = isoItem(S.base), code = fullCode();
        $('cfTitle').innerHTML = (S.editing ? 'Edit Valuta' : 'Tambah Valuta') + (code ? ' <small style="display:inline;margin-left:4px">' + esc(code) + '</small>' : '');
        if (!S.base) { box.innerHTML = '<span class="cf-fl">🌐</span><div style="flex:1"><div class="cf-cc" style="font-size:1.05rem">Pilih kode valuta</div><div class="cf-cn">Klik untuk mencari berdasarkan kode, negara, atau nama mata uang.</div></div><span class="cf-btn pri"><i class="fa-solid fa-magnifying-glass"></i> Cari</span>'; }
        else box.innerHTML = '<span class="cf-fl">' + flagEmoji(it, S.base) + '</span><div style="flex:1;min-width:0"><div class="cf-cc">' + esc(code) + (S.suffix ? ' <small class="cf-cn" style="font-size:.7rem">turunan ' + esc(S.base) + '</small>' : '') + '</div><div class="cf-cn">' + (it ? esc(it.name) + (it.country ? ' · ' + esc(it.country) : '') + (it.numeric ? ' · ' + esc(it.numeric) : '') : '<span style="color:var(--cf-warn)">Bukan kode ISO 4217 standar (data lama)</span>') + '</div></div>' +
            (S.editing ? '<span class="cf-lock"><i class="fa-solid fa-lock"></i> Kode terkunci</span>' : '<span class="cf-btn"><i class="fa-solid fa-magnifying-glass"></i> Ganti</span>');
        var sb = $('cfSfxBox');
        if (S.editing) sb.innerHTML = '';
        else if (S.base && isoItem(S.base)) {
            var has = $('cfSfx'); if (has && has.dataset.base !== S.base) has = null; if (!has) sb.innerHTML = '<div class="cf-sfx"><span>Kode turunan (opsional)</span><input class="cf-in sfx" id="cfSfx" data-base="' + esc(S.base) + '" maxlength="6" placeholder="mis. (kc) atau (B)" value="' + esc(S.suffix) + '" autocomplete="off"><span>Untuk kurs pecahan berbeda. Hasil: <b id="cfSfxPrev"></b>. Kurs dasar otomatis mengikuti ' + esc(S.base) + ' bila sudah terdaftar.</span></div>';
        } else sb.innerHTML = '';
        renderSfxPreview();
    }
    function parentRates(code) {
        try { return typeof window.getInheritedBaseRates === 'function' ? window.getInheritedBaseRates(code, currencies()) : { buy: 0, sell: 0 }; } catch (e) { return { buy: 0, sell: 0 }; }
    }
    function inherit() {
        var pr = parentRates(fullCode()); if (pr.buy > 0) $('cfBuy').value = nf(pr.buy); if (pr.sell > 0) $('cfSell').value = nf(pr.sell); recalc();
    }
    function recalc() {
        if (!$('cfModal')) return;
        var code = fullCode(), pr = parentRates(code), bb = pn($('cfBuy').value), bs = pn($('cfSell').value), mb = pn($('cfMb').value), ms = pn($('cfMs').value);
        var inh = $('cfInherit');
        if (pr.buy > 0 || pr.sell > 0) inh.innerHTML = 'Kode turunan: kurs dasar induk <b>' + esc(S.base) + '</b> = beli ' + nf(pr.buy) + ' / jual ' + nf(pr.sell) + '. Kolom yang dikosongkan otomatis memakai kurs induk. <a data-cf="inherit">Pakai kurs induk</a>'; else inh.innerHTML = '';
        var eb = bb > 0 ? bb : pr.buy, es = bs > 0 ? bs : pr.sell, fb = eb + mb, fs = es + ms;
        $('cfFinalBuy').textContent = eb > 0 ? 'Rp ' + nf(fb) : '-'; $('cfFinalSell').textContent = es > 0 ? 'Rp ' + nf(fs) : '-';
        var sp = fs - fb, ok = eb > 0 && es > 0;
        var h = $('cfSpreadHint');
        h.className = 'cf-hint ' + (ok && sp < 0 ? 'bad' : ok && sp === 0 ? 'warn' : '');
        h.textContent = ok && sp < 0 ? 'Kurs jual lebih rendah dari kurs beli: setiap transaksi akan rugi. Periksa kembali angkanya.' : (ok && sp === 0 ? 'Selisih nol: tidak ada margin keuntungan.' : '');
        var st = pn($('cfStock').value), al = pn($('cfAlert').value), sh = $('cfStockHint');
        sh.className = 'cf-hint ' + (al > 0 && st <= al ? 'bad' : '');
        sh.textContent = al > 0 && st <= al ? 'Stok berada di bawah batas aman. Kasir akan melihat peringatan stok menipis.' : (al > 0 ? 'Peringatan muncul bila stok ≤ ' + nf(al) + '.' : '');
    }

    // ------------------------------------------------------------ simpan
    function showErr(m) { var e = $('cfErr'); if (e) { e.style.display = m ? 'block' : 'none'; e.textContent = m || ''; } }
    async function save() {
        if (S.busy) return;
        var code = fullCode();
        if (!code) return showErr('Pilih kode valuta terlebih dahulu.');
        if (!S.editing && !isoItem(S.base)) return showErr('Kode harus berasal dari daftar ISO 4217.');
        if (S.suffix && !/^[A-Za-z0-9()][A-Za-z0-9 ()\-.\/+*#&]{0,5}$/.test(S.suffix)) return showErr('Kode turunan: huruf, angka, spasi, atau tanda ( ) - . / + * # & (maks. 6 karakter).');
        if (code.length > 10) return showErr('Kode terlalu panjang (maks. 10 karakter termasuk kode ISO).');
        var list = currencies(), idx = list.findIndex(function (c) { return String(c.code || '').toLowerCase() === code.toLowerCase(); });
        if (!S.editing && idx !== -1) return showErr('Kode ' + code + ' sudah terdaftar. Gunakan tombol Edit pada daftar kurs.');
        var pr = parentRates(code), bb = pn($('cfBuy').value), bs = pn($('cfSell').value), mb = pn($('cfMb').value), ms = pn($('cfMs').value);
        if (S.editing && idx !== -1) {   // kolom terkunci: pakai nilai tersimpan, bukan hasil baca ulang tampilan
            var ex = list[idx];
            bb = parseFloat(ex.base_buy !== undefined ? ex.base_buy : ex.buy) || 0;
            bs = parseFloat(ex.base_sell !== undefined ? ex.base_sell : ex.sell) || 0;
        }
        if (!(bb > 0) && pr.buy > 0) bb = pr.buy; if (!(bs > 0) && pr.sell > 0) bs = pr.sell;
        if (!(bb > 0) || !(bs > 0)) return showErr('Kurs dasar beli dan jual wajib diisi (lebih dari 0).');
        var stock = (S.editing && idx !== -1) ? (parseFloat(list[idx].stock) || 0) : pn($('cfStock').value), al = $('cfAlert').value.trim() === '' ? 500 : pn($('cfAlert').value);
        if (stock < 0) return showErr('Stok tidak boleh negatif.');
        var fb = bb + mb, fs = bs + ms;
        if (fs < fb && !confirm('Kurs jual (' + nf(fs) + ') lebih rendah dari kurs beli (' + nf(fb) + '). Tetap simpan?')) return;
        var user = ''; try { var u = getCurrentUser(); user = (u && (u.fullName || u.username)) || ''; } catch (e) { /* abaikan */ }
        user = user || 'Admin Kasir';
        var data = Object.assign({}, idx !== -1 ? list[idx] : {}, { code: code, buy: fb, sell: fs, base_buy: bb, base_sell: bs, stock: stock, alert: al, margin_buy: mb, margin_sell: ms });
        if (idx !== -1) { data.inputBy = list[idx].inputBy || user; data.editBy = user; list[idx] = data; } else { data.inputBy = user; data.editBy = ''; list.push(data); }
        S.busy = true; var btn = $('cfSave'), old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...'; showErr('');
        try {
            var results = await saveCurrencies(list);
            var fails = (Array.isArray(results) ? results : []).filter(function (r) { return r.status === 'rejected' || (r.status === 'fulfilled' && r.value && r.value.ok === false); });
            if (fails.length) {
                var det = fails.map(function (r) { return r.status === 'rejected' ? (r.reason && r.reason.message) || 'Penyimpanan gagal' : (r.value && r.value.message) || 'Penyimpanan ditolak server'; }).join('; ');
                showErr('Belum tersimpan seluruhnya ke server: ' + det + '. Form tetap dibuka, periksa koneksi lalu coba lagi.');
                return;
            }
            closeModal();
            if (typeof loadCurrencyTable === 'function') loadCurrencyTable();
            toast('success', 'Valuta ' + code + ' berhasil disimpan');
        } catch (e) {
            console.error('Gagal menyimpan valuta:', e); showErr('Gagal menyimpan valuta: ' + (e.message || e));
        } finally { S.busy = false; if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; } }
    }

    // ------------------------------------------------------------ API (nama lama tetap)
    var api = {
        openCurrencyModal: function (code) { open(code || null); },
        closeCurrencyModal: closeModal,
        saveCurrency: save,
        calculateCurrencyHasil: function () { recalc(); },
        handleCurrencyCodeInput: function () { recalc(); },
        // dari halaman referensi ISO ("Form Kurs"): buka form dengan kode terpilih
        applyIso4217ToCurrencyForm: function (code) {
            open(null, String(code || '').toUpperCase());
            if (typeof window.closeIso4217Modal === 'function') window.closeIso4217Modal();
        }
    };
    // Namespace sendiri: dipakai halaman Manajemen Kurs agar tidak bisa tertimpa skrip lain.
    window.CurrencyForm = { open: api.openCurrencyModal, close: closeModal, save: save };
    // Nama lama dikunci: bila ada skrip lama/lain mencoba menimpanya, penimpaan diabaikan (tanpa error).
    Object.keys(api).forEach(function (name) {
        try {
            Object.defineProperty(window, name, { configurable: true, enumerable: true, get: function () { return api[name]; }, set: function () { /* diabaikan */ } });
        } catch (e) { window[name] = api[name]; }
    });
})();
