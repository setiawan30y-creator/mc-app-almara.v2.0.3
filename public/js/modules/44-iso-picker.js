/* =====================================================================
 * 44-iso-picker.js  —  Pemilih Kode Mata Uang ISO 4217 (seluruh dunia)
 *
 *  Dipakai semua form yang menambah kode valas: Manajemen Kurs (45-currency-form.js), Koin & Uang Lama
 *  (item & pengepul), Galeri Valas, dan tombol "Buka ISO 4217".
 *
 *  - window.openIsoPicker({ title, onPick(item), current })   -> jendela pencarian kode / negara / nama mata uang
 *  - window.attachIsoPicker(input, { onPick, suffix })         -> ubah kolom kode menjadi pemilih (klik / tombol Cari)
 *  Sumber data: daftar ISO 4217 bawaan modul ini (164 kode), diperkaya nama negara dari getIso4217Reference().
 * ===================================================================== */
(function () {
    'use strict';

    var RAW = `AED|United Arab Emirates dirham|784|د.إ
AFN|Afghan afghani|971|؋
ALL|Albanian lek|008|L
AMD|Armenian dram|051|֏
ANG|Netherlands Antillean guilder|532|ƒ
AOA|Angolan kwanza|973|Kz
ARS|Argentine peso|032|$
AUD|Australian dollar|036|$
AWG|Aruban florin|533|ƒ
AZN|Azerbaijani manat|944|₼
BAM|Bosnia and Herzegovina convertible mark|977|KM
BBD|Barbadian dollar|052|$
BDT|Bangladeshi taka|050|৳
BGN|Bulgarian lev|975|лв
BHD|Bahraini dinar|048|د.ب
BIF|Burundian franc|108|FBu
BMD|Bermudian dollar|060|$
BND|Brunei dollar|096|$
BOB|Bolivian boliviano|068|Bs.
BRL|Brazilian real|986|R$
BSD|Bahamian dollar|044|$
BTN|Bhutanese ngultrum|064|Nu.
BWP|Botswana pula|072|P
BYN|Belarusian ruble|933|Br
BZD|Belize dollar|084|$
CAD|Canadian dollar|124|$
CDF|Congolese franc|976|FC
CHF|Swiss franc|756|CHF
CLF|Unidad de Fomento|990|UF
CLP|Chilean peso|152|$
CNY|Chinese yuan renminbi|156|¥
COP|Colombian peso|170|$
CRC|Costa Rican colón|188|₡
CUP|Cuban peso|192|$
CVE|Cape Verdean escudo|132|$
CZK|Czech koruna|203|Kč
DJF|Djiboutian franc|262|Fdj
DKK|Danish krone|208|kr
DOP|Dominican peso|214|$
DZD|Algerian dinar|012|د.ج
EGP|Egyptian pound|818|£
ERN|Eritrean nakfa|232|Nfk
ETB|Ethiopian birr|230|Br
EUR|Euro|978|€
FJD|Fijian dollar|242|$
FKP|Falkland Islands pound|238|£
GBP|Pound sterling|826|£
GEL|Georgian lari|981|₾
GHS|Ghanaian cedi|936|₵
GIP|Gibraltar pound|292|£
GMD|Gambian dalasi|270|D
GNF|Guinean franc|324|FG
GTQ|Guatemalan quetzal|320|Q
GYD|Guyanese dollar|328|$
HKD|Hong Kong dollar|344|$
HNL|Honduran lempira|340|L
HTG|Haitian gourde|332|G
HUF|Hungarian forint|348|Ft
IDR|Indonesian rupiah|360|Rp
ILS|Israeli new shekel|376|₪
INR|Indian rupee|356|₹
IQD|Iraqi dinar|368|ع.د
IRR|Iranian rial|364|﷼
ISK|Icelandic króna|352|kr
JMD|Jamaican dollar|388|$
JOD|Jordanian dinar|400|د.أ
JPY|Japanese yen|392|¥
KES|Kenyan shilling|404|KSh
KGS|Kyrgyzstani som|417|с
KHR|Cambodian riel|116|៛
KMF|Comorian franc|174|CF
KPW|North Korean won|408|₩
KRW|South Korean won|410|₩
KWD|Kuwaiti dinar|414|د.ك
KYD|Cayman Islands dollar|136|$
KZT|Kazakhstani tenge|398|₸
LAK|Lao kip|418|₭
LBP|Lebanese pound|422|ل.ل
LKR|Sri Lankan rupee|144|Rs
LRD|Liberian dollar|430|$
LSL|Lesotho loti|426|L
LYD|Libyan dinar|434|ل.د
MAD|Moroccan dirham|504|د.م.
MDL|Moldovan leu|498|L
MGA|Malagasy ariary|969|Ar
MKD|Macedonian denar|807|ден
MMK|Burmese kyat|104|K
MNT|Mongolian tögrög|496|₮
MOP|Macanese pataca|446|MOP$
MRU|Mauritanian ouguiya|929|UM
MUR|Mauritian rupee|480|₨
MVR|Maldivian rufiyaa|462|Rf
MWK|Malawian kwacha|454|MK
MXN|Mexican peso|484|$
MYR|Malaysian ringgit|458|RM
MZN|Mozambican metical|943|MT
NAD|Namibian dollar|516|$
NGN|Nigerian naira|566|₦
NIO|Nicaraguan córdoba|558|C$
NOK|Norwegian krone|578|kr
NPR|Nepalese rupee|524|₨
NZD|New Zealand dollar|554|$
OMR|Omani rial|512|ر.ع.
PAB|Panamanian balboa|590|B/.
PEN|Peruvian sol|604|S/
PGK|Papua New Guinean kina|598|K
PHP|Philippine peso|608|₱
PKR|Pakistani rupee|586|₨
PLN|Polish złoty|985|zł
PYG|Paraguayan guaraní|600|₲
QAR|Qatari riyal|634|ر.ق
RON|Romanian leu|946|lei
RSD|Serbian dinar|941|дин.
RUB|Russian ruble|643|₽
RWF|Rwandan franc|646|FRw
SAR|Saudi riyal|682|ر.س
SBD|Solomon Islands dollar|090|$
SCR|Seychellois rupee|690|₨
SDG|Sudanese pound|938|ج.س.
SEK|Swedish krona|752|kr
SGD|Singapore dollar|702|$
SHP|Saint Helena pound|654|£
SLE|Sierra Leonean leone|925|Le
SOS|Somali shilling|706|Sh
SRD|Surinamese dollar|968|$
SSP|South Sudanese pound|728|£
STN|São Tomé and Príncipe dobra|930|Db
SVC|Salvadoran colón|222|₡
SYP|Syrian pound|760|£
SZL|Eswatini lilangeni|748|L
THB|Thai baht|764|฿
TJS|Tajikistani somoni|972|SM
TMT|Turkmenistani manat|934|m
TND|Tunisian dinar|788|د.ت
TOP|Tongan paʻanga|776|T$
TRY|Turkish lira|949|₺
TTD|Trinidad and Tobago dollar|780|$
TWD|New Taiwan dollar|901|NT$
TZS|Tanzanian shilling|834|Sh
UAH|Ukrainian hryvnia|980|₴
UGX|Ugandan shilling|800|USh
USD|United States dollar|840|$
UYU|Uruguayan peso|858|$U
UYW|Unidad previsional|927|
UZS|Uzbekistani sum|860|so'm
VED|Venezuelan bolívar digital|926|Bs.
VES|Venezuelan bolívar soberano|928|Bs.
VND|Vietnamese đồng|704|₫
VUV|Vanuatu vatu|548|Vt
WST|Samoan tālā|882|T
XAF|Central African CFA franc|950|FCFA
XAG|Silver (one troy ounce)|961|
XAU|Gold (one troy ounce)|959|
XCD|East Caribbean dollar|951|$
XCG|Caribbean guilder|532|ƒ
XDR|Special drawing rights|960|
XOF|West African CFA franc|952|CFA
XPD|Palladium (one troy ounce)|964|
XPF|CFP franc|953|₣
XPT|Platinum (one troy ounce)|962|
YER|Yemeni rial|886|﷼
ZAR|South African rand|710|R
ZMW|Zambian kwacha|967|ZK
ZWG|Zimbabwe Gold|924|ZiG`;
    var BASE = RAW.trim().split('\n').map(function (l) {
        var p = l.split('|'); return { code: p[0], name: p[1], numeric: p[2], symbol: p[3] || '' };
    });

    var $ = function (id) { return document.getElementById(id); };
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    // bendera emoji: dari kode negara referensi; bila tidak ada, dari 2 huruf pertama kode mata uang (USD -> US, JPY -> JP)
    function flagOf(item) {
        var cc = String((item && item.countryCode) || '').toUpperCase(), code = String((item && item.code) || '').toUpperCase();
        if (!/^[A-Z]{2}$/.test(cc)) cc = /^X/.test(code) ? '' : code.slice(0, 2);
        if (!/^[A-Z]{2}$/.test(cc)) return '\uD83C\uDF10';
        return String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1));
    }

    // gabungkan daftar ISO bawaan dengan referensi aplikasi (nama negara bahasa Indonesia, simbol, kode negara)
    var cache = null;
    function list() {
        if (cache) return cache;
        var ref = {}; try { (typeof window.getIso4217Reference === 'function' ? window.getIso4217Reference() : []).forEach(function (r) { if (r && r.code) ref[r.code] = r; }); } catch (e) { /* abaikan */ }
        var seen = {};
        var out = BASE.map(function (b) {
            seen[b.code] = 1; var r = ref[b.code] || {};
            return { code: b.code, name: r.currencyName && r.currencyName !== b.code ? b.name : b.name, country: r.country || '', countryCode: r.countryCode || '', numeric: b.numeric, symbol: r.symbol && r.symbol !== b.code ? r.symbol : b.symbol, iso: true };
        });
        Object.keys(ref).forEach(function (c) { if (!seen[c] && /^[A-Z]{3}$/.test(c)) out.push({ code: c, name: ref[c].currencyName || c, country: ref[c].country || '', countryCode: ref[c].countryCode || '', numeric: '', symbol: ref[c].symbol || c, iso: false }); });
        out.sort(function (a, b) { return a.code.localeCompare(b.code); });
        cache = out; return out;
    }
    function itemOf(code) { code = String(code || '').toUpperCase(); return list().filter(function (i) { return i.code === code; })[0] || null; }
    function registered() { var m = {}; try { (typeof window.getCurrencies === 'function' ? window.getCurrencies() : []).forEach(function (c) { m[String(c.code).toUpperCase()] = 1; }); } catch (e) { /* abaikan */ } return m; }

    function injectStyle() {
        if ($('ip-style')) return;
        var st = document.createElement('style'); st.id = 'ip-style';
        st.textContent = [
            '.ip-ov{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10100;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:4vh 12px;--ip-bd:var(--mc-border,rgba(148,163,184,.28));--ip-mut:var(--mc-text-muted,#94a3b8);--ip-pri:var(--mc-primary,#22c55e);--ip-inp:var(--mc-input-bg,rgba(255,255,255,.05))}',
            '.ip-ov *{box-sizing:border-box}.ip-md{background:var(--mc-card-bg,#18181b);color:var(--mc-text,#fafafa);border:1px solid var(--ip-bd);border-radius:var(--mc-radius,14px);width:100%;max-width:760px;box-shadow:0 24px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;max-height:90vh}',
            '.ip-h{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--ip-bd)}.ip-h h3{margin:0;font-size:1.05rem}.ip-h small{display:block;color:var(--ip-mut);font-size:.76rem;margin-top:2px}',
            '.ip-x{border:0;background:transparent;color:var(--ip-mut);font-size:1.5rem;cursor:pointer;line-height:1}',
            '.ip-s{display:flex;gap:8px;padding:12px 18px;border-bottom:1px solid var(--ip-bd)}',
            '.ip-in{flex:1;min-width:0;background:var(--ip-inp);border:1px solid var(--mc-input-border,var(--ip-bd));color:var(--mc-text,#fafafa);border-radius:var(--mc-input-radius,10px);padding:9px 12px;font-size:.9rem;font-family:inherit}',
            '.ip-b{border:1px solid var(--ip-pri);background:var(--ip-pri);color:#fff;border-radius:var(--mc-btn-radius,10px);padding:9px 16px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;gap:6px;align-items:center}',
            '.ip-b.o{background:transparent;color:var(--mc-text,#fafafa);border-color:var(--ip-bd)}',
            '.ip-meta{padding:8px 18px;color:var(--ip-mut);font-size:.78rem}',
            '.ip-l{overflow-y:auto;padding:0 8px 10px;flex:1}.ip-r{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:10px;cursor:pointer;border:1px solid transparent}',
            '.ip-r:hover,.ip-r.act{background:var(--ip-inp);border-color:var(--ip-bd)}.ip-f{width:30px;text-align:center;font-size:1.3rem}.ip-c{width:52px;font-weight:900;letter-spacing:.03em}',
            '.ip-n{flex:1;min-width:0}.ip-n b{display:block;font-size:.88rem;font-weight:600}.ip-n small{color:var(--ip-mut);font-size:.76rem}.ip-num{color:var(--ip-mut);font-size:.76rem;width:40px;text-align:right}',
            '.ip-tag{font-size:.64rem;font-weight:800;border-radius:999px;padding:2px 8px;background:color-mix(in srgb,var(--ip-pri) 20%,transparent);color:var(--ip-pri);white-space:nowrap}',
            '.ip-e{text-align:center;color:var(--ip-mut);padding:34px 12px}',
            '.ip-grp{display:flex;align-items:stretch;gap:6px;width:100%}.ip-grp input{flex:1;min-width:0;cursor:pointer}.ip-grp button{white-space:nowrap}',
            '.ip-info{font-size:.76rem;margin-top:5px;color:var(--ip-mut,#94a3b8);display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ip-info b{color:var(--mc-text,#fafafa)}',
            '.ip-sfx{margin-top:6px;display:flex;gap:6px;align-items:center;font-size:.76rem;color:var(--ip-mut,#94a3b8)}.ip-sfx input{width:90px;text-transform:uppercase}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ jendela pencarian
    function search(q) {
        var f = fold(q).trim(); if (!f) return list();
        var terms = f.split(/\s+/);
        return list().filter(function (i) {
            var hay = fold(i.code + ' ' + i.name + ' ' + i.country + ' ' + i.numeric + ' ' + i.symbol);
            return terms.every(function (t) { return hay.indexOf(t) !== -1; });
        }).sort(function (a, b) { // kode yang diawali kata kunci tampil lebih dulu
            var ac = fold(a.code).indexOf(f) === 0 ? 0 : 1, bc = fold(b.code).indexOf(f) === 0 ? 0 : 1; return ac - bc || a.code.localeCompare(b.code);
        });
    }
    function closePicker() { var m = $('ipModal'); if (m) m.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape' && $('ipModal')) { e.stopPropagation(); closePicker(); } }
    function openPicker(opt) {
        opt = opt || {}; injectStyle(); closePicker(); cache = null;
        var reg = registered(), results = [], act = 0;
        var ov = document.createElement('div'); ov.className = 'ip-ov'; ov.id = 'ipModal';
        ov.innerHTML = '<div class="ip-md" role="dialog" aria-modal="true"><div class="ip-h"><div><h3><i class="fa-solid fa-globe"></i> ' + esc(opt.title || 'Pilih Kode Mata Uang') + '</h3><small>Standar ISO 4217 &mdash; seluruh dunia. Cari berdasarkan kode, negara, atau nama mata uang.</small></div><button type="button" class="ip-x" data-ip="x" aria-label="Tutup">&times;</button></div>' +
            '<div class="ip-s"><input class="ip-in" id="ipQ" type="search" placeholder="mis. USD, Jepang, rupiah, 840..." autocomplete="off"><button type="button" class="ip-b" data-ip="go"><i class="fa-solid fa-magnifying-glass"></i> Cari</button></div>' +
            '<div class="ip-meta" id="ipMeta"></div><div class="ip-l" id="ipList"></div></div>';
        document.body.appendChild(ov);
        document.addEventListener('keydown', onKey, true);
        var q = $('ipQ');
        function draw() {
            results = search(q.value); act = 0;
            $('ipMeta').textContent = results.length + ' dari ' + list().length + ' kode ditampilkan' + (opt.current ? ' · terpilih saat ini: ' + String(opt.current).toUpperCase() : '');
            $('ipList').innerHTML = results.length ? results.map(function (i, k) {
                return '<div class="ip-r' + (k === 0 ? ' act' : '') + '" data-ip="pick" data-k="' + k + '"><span class="ip-f">' + flagOf(i) + '</span><span class="ip-c">' + esc(i.code) + '</span>' +
                    '<span class="ip-n"><b>' + esc(i.name) + '</b><small>' + esc(i.country || '') + (i.symbol ? (i.country ? ' · ' : '') + 'simbol ' + esc(i.symbol) : '') + '</small></span>' + (reg[i.code] ? '<span class="ip-tag">Sudah terdaftar</span>' : '') + '<span class="ip-num">' + esc(i.numeric) + '</span></div>';
            }).join('') : '<div class="ip-e"><i class="fa-regular fa-face-frown" style="font-size:1.6rem;display:block;margin-bottom:8px"></i>Tidak ada kode yang cocok dengan "' + esc(q.value) + '".</div>';
        }
        function setAct(k) {
            var rows = ov.querySelectorAll('.ip-r'); if (!rows.length) return; act = Math.max(0, Math.min(rows.length - 1, k));
            rows.forEach(function (r, i) { r.classList.toggle('act', i === act); }); rows[act].scrollIntoView({ block: 'nearest' });
        }
        function pick(k) { var it = results[k]; if (!it) return; closePicker(); if (typeof opt.onPick === 'function') opt.onPick(it); }
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) closePicker(); });
        ov.addEventListener('click', function (e) {
            var el = e.target.closest('[data-ip]'); if (!el) return;
            if (el.dataset.ip === 'x') closePicker(); else if (el.dataset.ip === 'go') draw(); else if (el.dataset.ip === 'pick') pick(parseInt(el.dataset.k, 10));
        });
        q.addEventListener('input', draw);
        q.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAct(act + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(act - 1); } else if (e.key === 'Enter') { e.preventDefault(); if (results.length) pick(act); }
        });
        draw(); setTimeout(function () { q.focus(); }, 30);
    }

    // ------------------------------------------------------------ ubah kolom kode menjadi pemilih
    var attached = [];
    function infoHtml(code) {
        var it = itemOf(code);
        if (!code) return 'Belum dipilih. Klik kolom atau tombol <b>Cari</b> untuk memilih kode ISO 4217.';
        if (!it) return '<span style="color:var(--mc-warning,#f59e0b)">' + esc(code) + ' &mdash; bukan kode ISO 4217 standar.</span>';
        return flagOf(it) + ' <b>' + esc(it.code) + '</b> &middot; ' + esc(it.name) + (it.country ? ' &middot; ' + esc(it.country) : '') + (it.numeric ? ' &middot; ' + esc(it.numeric) : '');
    }
    function splitDerived(code) {
        code = String(code || '').toUpperCase(); if (!code || itemOf(code)) return { base: code, suffix: '', dash: false };
        var m = code.match(/^([A-Z]{3})(-?)([A-Z0-9]{1,4})$/);
        if (m && itemOf(m[1])) return { base: m[1], suffix: m[3], dash: m[2] === '-' };
        return { base: code, suffix: '', dash: false };
    }
    function attach(input, opts) {
        if (!input || input.dataset.ipAttached === '1') return;
        opts = opts || {}; injectStyle();
        input.dataset.ipAttached = '1'; input.readOnly = true; input.placeholder = opts.placeholder || 'Pilih kode ISO 4217...'; input.removeAttribute('list'); input.style.cursor = 'pointer';
        var grp = document.createElement('div'); grp.className = 'ip-grp'; input.parentNode.insertBefore(grp, input); grp.appendChild(input);
        var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ip-b'; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Cari'; grp.appendChild(btn);
        var info = document.createElement('div'); info.className = 'ip-info'; grp.insertAdjacentElement('afterend', info);
        var rec = { input: input, info: info, last: null, sfx: null, base: '', dash: false, opts: opts };
        if (opts.suffix) {
            var s = document.createElement('div'); s.className = 'ip-sfx'; s.innerHTML = '<span>Kode turunan (opsional)</span><input type="text" class="ip-in" maxlength="4" placeholder="mis. K" aria-label="Akhiran kode turunan">';
            info.insertAdjacentElement('afterend', s); rec.sfx = s.querySelector('input');
            rec.sfx.addEventListener('input', function () {
                rec.sfx.value = rec.sfx.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (!rec.base) return; input.value = rec.base + (rec.sfx.value ? (rec.dash ? '-' : '') + rec.sfx.value : ''); rec.last = input.value; fire(input); refresh(rec, true);
            });
        }
        var open = function () {
            openPicker({ title: opts.title, current: rec.base || input.value, onPick: function (it) {
                rec.base = it.code; input.value = it.code + (rec.sfx && rec.sfx.value ? (rec.dash ? '-' : '') + rec.sfx.value : ''); rec.last = input.value; fire(input); refresh(rec, true);
                if (typeof opts.onPick === 'function') opts.onPick(it, input);
            } });
        };
        input.addEventListener('click', open); btn.addEventListener('click', open);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        attached.push(rec); refresh(rec, true);
    }
    function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
    function refresh(rec, force) {
        var v = String(rec.input.value || '').toUpperCase();
        if (!force && v === rec.last) return; rec.last = v;
        var d = splitDerived(v); rec.base = d.base; rec.dash = d.dash;
        if (rec.sfx) rec.sfx.value = d.suffix;
        rec.info.innerHTML = infoHtml(d.base);
    }
    setInterval(function () {
        attached = attached.filter(function (r) { return document.body.contains(r.input); });
        attached.forEach(function (r) { if (r.input.offsetParent !== null) refresh(r, false); });
    }, 400);

    // tombol lama "Buka ISO 4217" (menu Manajemen Kurs / halaman ISO) memakai jendela baru
    window.openIso4217Modal = function (target) {
        if (target) window.iso4217Target = target;
        openPicker({ title: 'Kode Mata Uang ISO 4217', onPick: function (it) {
            if (typeof window.applyIso4217ToActiveForm === 'function') window.applyIso4217ToActiveForm(it.code, it.country || it.name, it.name, it.symbol, it.countryCode);
        } });
    };
    window.closeIso4217Modal = function () { closePicker(); var m = $('iso4217Modal'); if (m) m.style.display = 'none'; };
    window.openIsoPicker = openPicker;
    window.attachIsoPicker = attach;
    window.getIsoCurrencyList = list;
})();
