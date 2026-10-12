(function () {
    'use strict';

    // Active ISO 4217 dataset: alphabetic code, name, numeric code,
    // decimal digits, and common symbol. Source reference verified against
    // the ISO 4217 maintenance data presentation (SIX Group) on 2026-09-23.
    const ISO = `
AED|United Arab Emirates dirham|784|2|د.إ
AFN|Afghan afghani|971|2|؋
ALL|Albanian lek|008|2|L
AMD|Armenian dram|051|2|֏
ANG|Netherlands Antillean guilder|532|2|ƒ
AOA|Angolan kwanza|973|2|Kz
ARS|Argentine peso|032|2|$
AUD|Australian dollar|036|2|$
AWG|Aruban florin|533|2|ƒ
AZN|Azerbaijani manat|944|2|₼
BAM|Bosnia and Herzegovina convertible mark|977|2|KM
BBD|Barbadian dollar|052|2|$
BDT|Bangladeshi taka|050|2|৳
BGN|Bulgarian lev|975|2|лв
BHD|Bahraini dinar|048|3|د.ب
BIF|Burundian franc|108|0|FBu
BMD|Bermudian dollar|060|2|$
BND|Brunei dollar|096|2|$
BOB|Bolivian boliviano|068|2|Bs.
BRL|Brazilian real|986|2|R$
BSD|Bahamian dollar|044|2|$
BTN|Bhutanese ngultrum|064|2|Nu.
BWP|Botswana pula|072|2|P
BYN|Belarusian ruble|933|2|Br
BZD|Belize dollar|084|2|$
CAD|Canadian dollar|124|2|$
CDF|Congolese franc|976|2|FC
CHF|Swiss franc|756|2|CHF
CLF|Unidad de Fomento|990|4|UF
CLP|Chilean peso|152|0|$
CNY|Chinese yuan renminbi|156|2|¥
COP|Colombian peso|170|2|$
CRC|Costa Rican colón|188|2|₡
CUP|Cuban peso|192|2|$
CVE|Cape Verdean escudo|132|2|$
CZK|Czech koruna|203|2|Kč
DJF|Djiboutian franc|262|0|Fdj
DKK|Danish krone|208|2|kr
DOP|Dominican peso|214|2|$
DZD|Algerian dinar|012|2|د.ج
EGP|Egyptian pound|818|2|£
ERN|Eritrean nakfa|232|2|Nfk
ETB|Ethiopian birr|230|2|Br
EUR|Euro|978|2|€
FJD|Fijian dollar|242|2|$
FKP|Falkland Islands pound|238|2|£
GBP|Pound sterling|826|2|£
GEL|Georgian lari|981|2|₾
GHS|Ghanaian cedi|936|2|₵
GIP|Gibraltar pound|292|2|£
GMD|Gambian dalasi|270|2|D
GNF|Guinean franc|324|0|FG
GTQ|Guatemalan quetzal|320|2|Q
GYD|Guyanese dollar|328|2|$
HKD|Hong Kong dollar|344|2|$
HNL|Honduran lempira|340|2|L
HTG|Haitian gourde|332|2|G
HUF|Hungarian forint|348|2|Ft
IDR|Indonesian rupiah|360|2|Rp
ILS|Israeli new shekel|376|2|₪
INR|Indian rupee|356|2|₹
IQD|Iraqi dinar|368|3|ع.د
IRR|Iranian rial|364|2|﷼
ISK|Icelandic króna|352|0|kr
JMD|Jamaican dollar|388|2|$
JOD|Jordanian dinar|400|3|د.أ
JPY|Japanese yen|392|0|¥
KES|Kenyan shilling|404|2|KSh
KGS|Kyrgyzstani som|417|2|с
KHR|Cambodian riel|116|2|៛
KMF|Comorian franc|174|0|CF
KPW|North Korean won|408|2|₩
KRW|South Korean won|410|0|₩
KWD|Kuwaiti dinar|414|3|د.ك
KYD|Cayman Islands dollar|136|2|$
KZT|Kazakhstani tenge|398|2|₸
LAK|Lao kip|418|2|₭
LBP|Lebanese pound|422|2|ل.ل
LKR|Sri Lankan rupee|144|2|Rs
LRD|Liberian dollar|430|2|$
LSL|Lesotho loti|426|2|L
LYD|Libyan dinar|434|3|ل.د
MAD|Moroccan dirham|504|2|د.م.
MDL|Moldovan leu|498|2|L
MGA|Malagasy ariary|969|2|Ar
MKD|Macedonian denar|807|2|ден
MMK|Burmese kyat|104|2|K
MNT|Mongolian tögrög|496|2|₮
MOP|Macanese pataca|446|2|MOP$
MRU|Mauritanian ouguiya|929|2|UM
MUR|Mauritian rupee|480|2|₨
MVR|Maldivian rufiyaa|462|2|Rf
MWK|Malawian kwacha|454|2|MK
MXN|Mexican peso|484|2|$
MYR|Malaysian ringgit|458|2|RM
MZN|Mozambican metical|943|2|MT
NAD|Namibian dollar|516|2|$
NGN|Nigerian naira|566|2|₦
NIO|Nicaraguan córdoba|558|2|C$
NOK|Norwegian krone|578|2|kr
NPR|Nepalese rupee|524|2|₨
NZD|New Zealand dollar|554|2|$
OMR|Omani rial|512|3|ر.ع.
PAB|Panamanian balboa|590|2|B/.
PEN|Peruvian sol|604|2|S/
PGK|Papua New Guinean kina|598|2|K
PHP|Philippine peso|608|2|₱
PKR|Pakistani rupee|586|2|₨
PLN|Polish złoty|985|2|zł
PYG|Paraguayan guaraní|600|0|₲
QAR|Qatari riyal|634|2|ر.ق
RON|Romanian leu|946|2|lei
RSD|Serbian dinar|941|2|дин.
RUB|Russian ruble|643|2|₽
RWF|Rwandan franc|646|0|FRw
SAR|Saudi riyal|682|2|ر.س
SBD|Solomon Islands dollar|090|2|$
SCR|Seychellois rupee|690|2|₨
SDG|Sudanese pound|938|2|ج.س.
SEK|Swedish krona|752|2|kr
SGD|Singapore dollar|702|2|$
SHP|Saint Helena pound|654|2|£
SLE|Sierra Leonean leone|925|2|Le
SOS|Somali shilling|706|2|Sh
SRD|Surinamese dollar|968|2|$
SSP|South Sudanese pound|728|2|£
STN|São Tomé and Príncipe dobra|930|2|Db
SVC|Salvadoran colón|222|2|₡
SYP|Syrian pound|760|2|£
SZL|Eswatini lilangeni|748|2|L
THB|Thai baht|764|2|฿
TJS|Tajikistani somoni|972|2|SM
TMT|Turkmenistani manat|934|2|m
TND|Tunisian dinar|788|3|د.ت
TOP|Tongan paʻanga|776|2|T$
TRY|Turkish lira|949|2|₺
TTD|Trinidad and Tobago dollar|780|2|$
TWD|New Taiwan dollar|901|2|NT$
TZS|Tanzanian shilling|834|2|Sh
UAH|Ukrainian hryvnia|980|2|₴
UGX|Ugandan shilling|800|0|USh
USD|United States dollar|840|2|$
UYU|Uruguayan peso|858|2|$U
UYW|Unidad previsional|927|4|
UZS|Uzbekistani sum|860|2|so'm
VED|Venezuelan bolívar digital|926|2|Bs.
VES|Venezuelan bolívar soberano|928|2|Bs.
VND|Vietnamese đồng|704|0|₫
VUV|Vanuatu vatu|548|0|Vt
WST|Samoan tālā|882|2|T
XAF|Central African CFA franc|950|0|FCFA
XAG|Silver (one troy ounce)|961||
XAU|Gold (one troy ounce)|959||
XCD|East Caribbean dollar|951|2|$
XCG|Caribbean guilder|532|2|ƒ
XDR|Special drawing rights|960||
XOF|West African CFA franc|952|0|CFA
XPD|Palladium (one troy ounce)|964||
XPF|CFP franc|953|0|₣
XPT|Platinum (one troy ounce)|962||
YER|Yemeni rial|886|2|﷼
ZAR|South African rand|710|2|R
ZMW|Zambian kwacha|967|2|ZK
ZWG|Zimbabwe Gold|924|2|ZiG
`.trim().split('\n').map(line => {
        const [code, name, numeric, decimals, symbol] = line.split('|');
        return { code, name, numeric, decimals: decimals === '' ? null : Number(decimals), symbol: symbol || '' };
    });

    const ISO_MAP = Object.fromEntries(ISO.map(c => [c.code, c]));

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
    }

    function applyCurrency(code) {
        const item = ISO_MAP[String(code || '').toUpperCase()];
        if (!item) return;

        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el && value !== null && value !== undefined) el.value = value;
        };

        set('modalCurNumeric', item.numeric);
        set('modalCurName', item.name);
        set('modalCurSymbol', item.symbol);
        if (item.decimals !== null) set('modalCurDecimals', item.decimals);

        const previewCode = document.getElementById('cmPreviewCode');
        const previewName = document.getElementById('cmPreviewName');
        const previewFlag = document.getElementById('cmPreviewFlag');
        if (previewCode) previewCode.textContent = item.code;
        if (previewName) previewName.textContent = item.name;
        if (previewFlag) previewFlag.textContent = item.code;

        if (typeof window.handleCurrencyCodeInput === 'function') {
            try { window.handleCurrencyCodeInput(); } catch (_) {}
        }
    }

    function enhanceCurrencyCodeField() {
        const old = document.getElementById('modalCurCode');
        if (!old || old.tagName === 'SELECT') return;

        const current = String(old.value || '').trim().toUpperCase();
        const select = document.createElement('select');
        select.id = 'modalCurCode';
        select.name = old.name || 'currency_code';
        select.className = old.className;
        select.required = old.required;
        select.style.width = '100%';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Pilih Kode ISO 4217...';
        select.appendChild(placeholder);

        ISO.forEach(item => {
            const option = document.createElement('option');
            option.value = item.code;
            option.textContent = `${item.code} — ${item.name} (${item.numeric})`;
            select.appendChild(option);
        });

        if (current && !ISO_MAP[current]) {
            const option = document.createElement('option');
            option.value = current;
            option.textContent = `${current} — Kode tersimpan (legacy)`;
            select.appendChild(option);
        }

        old.replaceWith(select);

        select.addEventListener('change', function () {
            applyCurrency(this.value);
        });

        if (current) {
            select.value = current;
            applyCurrency(current);
        }
    }

    function watchModal() {
        enhanceCurrencyCodeField();
        const modal = document.getElementById('currencyModal');
        if (!modal) return;
        if (modal.dataset.iso4217Observer === '1') return;
        modal.dataset.iso4217Observer = '1';
        new MutationObserver(() => enhanceCurrencyCodeField()).observe(modal, { childList: true, subtree: true });
    }

    const boot = () => {
        watchModal();
        const observer = new MutationObserver(watchModal);
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
