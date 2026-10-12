(function () {
    'use strict';

    const STYLE_ID = 'almara-currency-master-ui-style';
    const DEFAULT_DENOMS = {
        USD: { banknote: [100, 50, 20, 10, 5, 1], coin: [1, 0.25, 0.10, 0.05] },
        EUR: { banknote: [500, 200, 100, 50, 20, 10, 5], coin: [2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01] },
        SGD: { banknote: [1000, 500, 100, 50, 20, 10, 5, 2], coin: [1, 0.50, 0.20, 0.10, 0.05] },
        AUD: { banknote: [100, 50, 20, 10, 5], coin: [2, 1, 0.50, 0.20, 0.10, 0.05] }
    };

    function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
    function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
    function fmtDenom(v) { const n = num(v); return Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 4 }); }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* Master Kurs: modal overlay + dedicated scroll viewport */
            #currencyModal.almara-currency-master-open,
            #currencyModal.show.almara-currency-master-open {
                position:fixed !important;
                inset:0 !important;
                z-index:9999 !important;
                width:100vw !important;
                height:100vh !important;
                max-width:none !important;
                max-height:none !important;
                padding:20px !important;
                box-sizing:border-box !important;
                overflow:hidden !important;
                display:flex !important;
                align-items:center !important;
                justify-content:center !important;
            }
            #currencyModal .almara-currency-modal {
                width:min(1180px, calc(100vw - 40px)) !important;
                height:min(900px, calc(100vh - 40px)) !important;
                max-height:calc(100vh - 40px) !important;
                min-height:0 !important;
                overflow:hidden !important;
                padding:0 !important;
                margin:0 !important;
                border-radius:18px;
                display:grid !important;
                grid-template-rows:auto minmax(0,1fr) auto !important;
                box-sizing:border-box !important;
            }
            #currencyModal .almara-cm-head {
                position:relative;
                z-index:5;
                background:inherit;
                min-height:82px;
                box-sizing:border-box;
            }
            #currencyModal .almara-cm-scroll {
                min-height:0 !important;
                height:auto !important;
                max-height:none !important;
                overflow-y:auto !important;
                overflow-x:hidden !important;
                overscroll-behavior:contain;
                -webkit-overflow-scrolling:touch;
                scrollbar-width:thin;
                scrollbar-gutter:stable;
                box-sizing:border-box;
            }
            #currencyModal .almara-cm-body {
                min-height:max-content !important;
            }
            #currencyModal .almara-cm-footer {
                position:relative;
                z-index:5;
                background:inherit;
                min-height:82px;
                box-sizing:border-box;
            }
            @media(max-width:700px){
                #currencyModal.almara-currency-master-open,
                #currencyModal.show.almara-currency-master-open {
                    padding:8px !important;
                }
                #currencyModal .almara-currency-modal {
                    width:100% !important;
                    height:calc(100vh - 16px) !important;
                    max-height:calc(100vh - 16px) !important;
                }
            }
            .almara-cm-head { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 24px; border-bottom:1px solid rgba(148,163,184,.22); }
            .almara-cm-title { display:flex; align-items:center; gap:14px; }
            .almara-cm-title-icon { width:46px; height:46px; border-radius:13px; display:grid; place-items:center; background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#fff; font-size:22px; box-shadow:0 8px 20px rgba(245,158,11,.22); }
            .almara-cm-title h2 { margin:0; font-size:1.35rem; }
            .almara-cm-title p { margin:3px 0 0; color:#64748b; font-size:.86rem; }
            .almara-cm-body { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:18px; padding:20px 24px; }
            .almara-cm-card { background:rgba(248,250,252,.82); border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
            .almara-cm-card-head { padding:14px 16px; font-weight:800; display:flex; align-items:center; gap:9px; border-bottom:1px solid #e2e8f0; }
            .almara-cm-card-head i { color:#2563eb; }
            .almara-cm-card-body { padding:16px; }
            .almara-cm-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
            .almara-cm-field label { display:block; font-weight:700; font-size:.82rem; margin-bottom:6px; color:#334155; }
            .almara-cm-field input, .almara-cm-field select { width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:9px; padding:10px 11px; background:#fff; color:#0f172a; }
            .almara-cm-field small { display:block; margin-top:5px; color:#64748b; font-size:.73rem; }
            .almara-cm-switch { display:flex; align-items:center; gap:9px; height:40px; }
            .almara-cm-switch input { display:none; }
            .almara-cm-switch .track { width:40px; height:22px; border-radius:20px; background:#94a3b8; position:relative; cursor:pointer; }
            .almara-cm-switch .track:after { content:''; width:18px; height:18px; background:#fff; border-radius:50%; position:absolute; top:2px; left:2px; transition:.15s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
            .almara-cm-switch input:checked + .track { background:#10b981; }
            .almara-cm-switch input:checked + .track:after { left:20px; }
            .almara-cm-tabs { display:flex; gap:8px; padding:12px 16px 0; }
            .almara-cm-tab { border:1px solid #cbd5e1; background:#fff; border-radius:9px; padding:10px 14px; font-weight:700; cursor:pointer; flex:1; }
            .almara-cm-tab.active { background:#2563eb; color:#fff; border-color:#2563eb; }
            .almara-cm-denom-layout { display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:14px 16px 16px; }
            .almara-cm-denom-panel { background:#fff; border:1px solid #e2e8f0; border-radius:11px; overflow:hidden; min-width:0; }
            .almara-cm-denom-toolbar { display:flex; gap:7px; align-items:center; flex-wrap:wrap; padding:10px 12px; border-bottom:1px solid #eef2f7; background:#fff; }
            .almara-cm-denom-toolbar input { flex:1 1 180px; min-width:140px; border:1px solid #cbd5e1; border-radius:8px; padding:9px 10px; }
            .almara-cm-denom-toolbar button { border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; background:#fff; color:#334155; font-weight:700; cursor:pointer; }
            .almara-cm-denom-toolbar button.primary { background:#16a34a; border-color:#16a34a; color:#fff; }
            .almara-cm-denom-toolbar button.preset { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
             .almara-cm-denom-scroll { max-height:270px; min-height:90px; overflow-y:auto !important; scrollbar-width:auto; scrollbar-gutter:stable; }
            .almara-cm-denom-input { width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:7px; padding:7px 8px; background:#fff; font-weight:700; }
            .almara-cm-denom-help { padding:8px 12px; color:#64748b; font-size:.72rem; background:#f8fafc; border-top:1px solid #eef2f7; }
            .almara-cm-denom-head { padding:11px 13px; font-weight:800; background:#f8fafc; display:flex; justify-content:space-between; align-items:center; }
            .almara-cm-denom-table { width:100%; border-collapse:collapse; }
            .almara-cm-denom-table th,.almara-cm-denom-table td { padding:8px 10px; border-top:1px solid #eef2f7; text-align:left; font-size:.8rem; }
            .almara-cm-denom-table th { color:#64748b; font-size:.72rem; }
            .almara-cm-actions { display:flex; gap:5px; justify-content:flex-end; }
            .almara-cm-mini { border:0; border-radius:7px; width:30px; height:30px; cursor:pointer; color:#fff; }
            .almara-cm-mini.edit { background:#2563eb; } .almara-cm-mini.del { background:#ef4444; }
            .almara-cm-add { margin:10px 12px 13px; border:0; border-radius:8px; padding:9px 12px; background:#16a34a; color:#fff; font-weight:700; cursor:pointer; }
            .almara-cm-preview { position:sticky; top:0; align-self:start; }
            .almara-cm-preview-box { margin:16px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; }
            .almara-cm-preview-top { padding:15px; background:linear-gradient(135deg,#eff6ff,#fff); display:flex; align-items:center; gap:12px; }
            .almara-cm-flag { width:54px; height:38px; border-radius:6px; background:#e2e8f0; display:grid; place-items:center; font-weight:900; color:#334155; }
            .almara-cm-preview-top strong { font-size:1.25rem; }
            .almara-cm-preview-top small { display:block; color:#64748b; margin-top:2px; }
            .almara-cm-preview-section { padding:12px 15px; border-top:1px solid #eef2f7; }
            .almara-cm-preview-section h4 { margin:0 0 7px; font-size:.8rem; }
            .almara-cm-preview-list { display:flex; flex-wrap:wrap; gap:6px; }
            .almara-cm-chip { border:1px solid #dbeafe; background:#eff6ff; color:#1d4ed8; border-radius:999px; padding:5px 9px; font-size:.74rem; font-weight:700; }
            .almara-cm-note { margin:0 16px 16px; padding:11px 12px; border-radius:10px; background:#ecfdf5; color:#166534; font-size:.76rem; }
            .almara-cm-footer { display:flex; justify-content:space-between; gap:10px; padding:14px 24px; border-top:1px solid #e2e8f0; }
            .almara-cm-footer button { min-width:120px; }
            .almara-cm-denom-empty { color:#94a3b8; text-align:center; padding:15px; font-size:.78rem; }
            .almara-cm-inline-add { display:flex; gap:7px; padding:0 12px 12px; }
            .almara-cm-inline-add input { flex:1; border:1px solid #cbd5e1; border-radius:8px; padding:8px; }
            @media(max-width:900px){ .almara-cm-body{grid-template-columns:1fr}.almara-cm-preview{position:static}.almara-cm-denom-layout,.almara-cm-grid{grid-template-columns:1fr} }
        `;
        document.head.appendChild(style);
    }

    function ensureModal() {
        const modal = document.getElementById('currencyModal');
        if (!modal) return null;
        injectStyle();
        modal.innerHTML = `
            <div class="modal-content panel almara-currency-modal">
                <div class="almara-cm-head">
                    <div class="almara-cm-title"><div class="almara-cm-title-icon"><i class="fa-solid fa-coins"></i></div><div><h2>Tambah Valuta</h2><p>Tambahkan valuta baru ke Manajemen Kurs.</p></div></div>
                    <button type="button" class="btn btn-outline" onclick="closeCurrencyModal()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="almara-cm-scroll"><div class="almara-cm-body">
                    <div>
                        <div class="almara-cm-card"><div class="almara-cm-card-head"><i class="fa-regular fa-file-lines"></i> Informasi Valuta</div><div class="almara-cm-card-body"><div class="almara-cm-grid">
                            <div class="almara-cm-field"><label>Kode Valuta *</label><input id="modalCurCode" list="masterCurList" oninput="handleCurrencyCodeInput()"><small>Contoh: USD, EUR, SGD</small></div>
                            <div class="almara-cm-field"><label>Nama Valuta *</label><input id="modalCurName" placeholder="US Dollar"></div>
                            <div class="almara-cm-field"><label>Kode Numeric (ISO 4217)</label><input id="modalCurNumeric" placeholder="840"></div>
                            <div class="almara-cm-field"><label>Simbol</label><input id="modalCurSymbol" placeholder="$"></div>
                            <div class="almara-cm-field"><label>Jumlah Desimal</label><input id="modalCurDecimals" type="number" min="0" max="6" value="2"><small>Angka di belakang koma</small></div>
                            <div class="almara-cm-field"><label>Status</label><label class="almara-cm-switch"><input id="modalCurActive" type="checkbox" checked><span class="track"></span><strong>Aktif</strong></label></div>
                        </div></div></div>
                        <div class="almara-cm-card" style="margin-top:16px"><div class="almara-cm-card-head"><i class="fa-solid fa-chart-line"></i> Kurs & Stok</div><div class="almara-cm-card-body"><div class="almara-cm-grid">
                            <div class="almara-cm-field"><label>Base Rate Beli</label><input type="number" id="modalCurBuy" oninput="calculateCurrencyHasil()"></div>
                            <div class="almara-cm-field"><label>Base Rate Jual</label><input type="number" id="modalCurSell" oninput="calculateCurrencyHasil()"></div>
                            <div class="almara-cm-field"><label>Stok Awal</label><input type="number" id="modalCurStock"></div>
                            <div class="almara-cm-field"><label>Batas Aman (Alert)</label><input type="number" id="modalCurAlert"></div>
                            <div class="almara-cm-field"><label>Selisih Beli</label><input type="number" id="modalMarginBuy" oninput="calculateCurrencyHasil()"><small>Hasil Beli: <b id="modalHasilBuy">0</b></small></div>
                            <div class="almara-cm-field"><label>Selisih Jual</label><input type="number" id="modalMarginSell" oninput="calculateCurrencyHasil()"><small>Hasil Jual: <b id="modalHasilSell">0</b></small></div>
                        </div></div></div>
                        <div class="almara-cm-card almara-cm-denom-card" style="margin-top:16px"><div class="almara-cm-card-head"><i class="fa-solid fa-coins"></i> Denominasi (Pecahan Uang) — Kelola melalui Edit</div>
                            <div class="almara-cm-tabs"><button type="button" class="almara-cm-tab active" data-tab="banknote">Uang Kertas (Banknote)</button><button type="button" class="almara-cm-tab" data-tab="coin">Koin (Coin)</button></div>
                            <div class="almara-cm-denom-layout">
                                <div class="almara-cm-denom-panel">
                                    <div class="almara-cm-denom-head"><span>Banknote</span><span id="cmBanknoteCount">0</span></div>
                                    <div class="almara-cm-denom-toolbar">
                                        <input id="cmBanknoteBulk" type="text" placeholder="100, 50, 20, 10, 5, 1">
                                        <button type="button" class="primary" onclick="window.almaraBulkAddDenom('banknote')"><i class="fa-solid fa-layer-group"></i> Tambah Banyak</button>
                                        <button type="button" class="preset" onclick="window.almaraLoadDenomPreset('banknote')"><i class="fa-solid fa-wand-magic-sparkles"></i> Preset</button>
                                    </div>
                                    <div class="almara-cm-denom-scroll"><div id="cmBanknoteTable"></div></div>
                                    <button type="button" class="almara-cm-add" onclick="window.almaraAddDenom('banknote')"><i class="fa-solid fa-plus"></i> Tambah 1 Pecahan</button>
                                    <div class="almara-cm-denom-help">Bisa paste sekaligus memakai koma, spasi, garis miring, atau baris baru. Sistem otomatis menghapus duplikat dan mengurutkan terbesar ke terkecil.</div>
                                </div>
                                <div class="almara-cm-denom-panel">
                                    <div class="almara-cm-denom-head"><span>Coin</span><span id="cmCoinCount">0</span></div>
                                    <div class="almara-cm-denom-toolbar">
                                        <input id="cmCoinBulk" type="text" placeholder="2, 1, 0.50, 0.20, 0.10">
                                        <button type="button" class="primary" onclick="window.almaraBulkAddDenom('coin')"><i class="fa-solid fa-layer-group"></i> Tambah Banyak</button>
                                        <button type="button" class="preset" onclick="window.almaraLoadDenomPreset('coin')"><i class="fa-solid fa-wand-magic-sparkles"></i> Preset</button>
                                    </div>
                                    <div class="almara-cm-denom-scroll"><div id="cmCoinTable"></div></div>
                                    <button type="button" class="almara-cm-add" onclick="window.almaraAddDenom('coin')"><i class="fa-solid fa-plus"></i> Tambah 1 Pecahan</button>
                                    <div class="almara-cm-denom-help">Untuk koin, gunakan nilai desimal sesuai Jumlah Desimal valuta.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <aside class="almara-cm-card almara-cm-preview"><div class="almara-cm-card-head"><i class="fa-solid fa-eye"></i> Preview Valuta</div><div class="almara-cm-preview-box"><div class="almara-cm-preview-top"><div class="almara-cm-flag" id="cmPreviewFlag">USD</div><div><strong id="cmPreviewCode">USD</strong><small id="cmPreviewName">US Dollar</small></div></div><div class="almara-cm-preview-section"><h4>Daftar Denominasi</h4><div class="almara-cm-preview-list" id="cmPreviewBanknotes"></div></div><div class="almara-cm-preview-section"><h4>Koin</h4><div class="almara-cm-preview-list" id="cmPreviewCoins"></div></div></div><p class="almara-cm-note"><i class="fa-solid fa-circle-info"></i> Denominasi yang disimpan menjadi referensi untuk Transaction, Stock Denominasi, dan Closing.</p></aside>
                </div></div>
                <div class="almara-cm-footer"><button type="button" class="btn btn-outline" onclick="closeCurrencyModal()"><i class="fa-solid fa-xmark"></i> Batal</button><button type="button" class="btn btn-primary" onclick="window.almaraSaveCurrencyMaster()"><i class="fa-solid fa-floppy-disk"></i> Simpan Valuta</button></div>
            </div>`;
        if (!modal.dataset.denomInlineBound) {
            modal.dataset.denomInlineBound = '1';
            modal.addEventListener('change', function (event) {
                const input = event.target.closest('.almara-cm-denom-input');
                if (!input || !window.__almaraCurrencyDraft) return;
                const type = input.dataset.denomType;
                const index = Number(input.dataset.denomIndex);
                const arr = window.__almaraCurrencyDraft.denominations[type] || [];
                const value = num(input.value);
                if (value <= 0) { renderDenoms(); return; }
                if (arr.some((x,i) => i !== index && x === value)) { alert('Pecahan tersebut sudah ada.'); renderDenoms(); return; }
                arr[index] = value;
                arr.sort((a,b)=>b-a);
                renderDenoms();
            });
        }
        return modal;
    }

    function seedDenoms(code) { const key=String(code||'').trim().toUpperCase(); const seed=DEFAULT_DENOMS[key]||{banknote:[],coin:[]}; return {banknote:[...seed.banknote],coin:[...seed.coin]}; }
    function normalizeDenoms(c) { const d=c&&c.denominations; if(d&&typeof d==='object') return {banknote:Array.isArray(d.banknote)?d.banknote.map(num).filter(x=>x>0):[],coin:Array.isArray(d.coin)?d.coin.map(num).filter(x=>x>0):[]}; return seedDenoms(c&&c.code); }

    function renderDenoms() {
        const modal=document.getElementById('currencyModal'); if(!modal||!window.__almaraCurrencyDraft)return; const d=window.__almaraCurrencyDraft.denominations;
        const render=(type,id,countId)=>{const arr=d[type]||[],host=document.getElementById(id);document.getElementById(countId).textContent=arr.length;if(!arr.length){host.innerHTML='<div class="almara-cm-denom-empty">Belum ada pecahan. Gunakan input cepat di atas.</div>';return;}host.innerHTML=`<table class="almara-cm-denom-table"><thead><tr><th style="width:38px">#</th><th>Pecahan</th><th style="width:82px">Status</th><th style="width:76px">Aksi</th></tr></thead><tbody>${arr.map((v,i)=>`<tr><td>${i+1}</td><td><input class="almara-cm-denom-input" data-denom-type="${type}" data-denom-index="${i}" type="number" min="0.000001" step="any" value="${esc(v)}"></td><td><span style="color:#16a34a;font-weight:700">Aktif</span></td><td><div class="almara-cm-actions"><button type="button" class="almara-cm-mini del" onclick="window.almaraDeleteDenom('${type}',${i})"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('')}</tbody></table>`;};
        render('banknote','cmBanknoteTable','cmBanknoteCount'); render('coin','cmCoinTable','cmCoinCount');
        const code=document.getElementById('modalCurCode')?.value||'USD', name=document.getElementById('modalCurName')?.value||'Nama Valuta'; document.getElementById('cmPreviewCode').textContent=code; document.getElementById('cmPreviewName').textContent=name; document.getElementById('cmPreviewFlag').textContent=code.slice(0,3).toUpperCase(); document.getElementById('cmPreviewBanknotes').innerHTML=d.banknote.map(v=>`<span class="almara-cm-chip">${esc(fmtDenom(v))}</span>`).join('')||'<span style="color:#94a3b8;font-size:.75rem">-</span>'; document.getElementById('cmPreviewCoins').innerHTML=d.coin.map(v=>`<span class="almara-cm-chip">${esc(fmtDenom(v))}</span>`).join('')||'<span style="color:#94a3b8;font-size:.75rem">-</span>';
    }

    function fill(c) {
        c=c||{}; const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';}; set('modalCurCode',c.code||''); set('modalCurName',c.name||c.label||''); set('modalCurNumeric',c.numeric_code||''); set('modalCurSymbol',c.symbol||''); set('modalCurDecimals',c.decimals??2); set('modalCurBuy',c.base_buy??c.buy??''); set('modalCurSell',c.base_sell??c.sell??''); set('modalCurStock',c.stock??''); set('modalCurAlert',c.alert??''); set('modalMarginBuy',c.margin_buy??''); set('modalMarginSell',c.margin_sell??''); const active=document.getElementById('modalCurActive');if(active)active.checked=c.active!==false; window.__almaraCurrencyDraft={denominations:normalizeDenoms(c)}; renderDenoms(); ['modalCurCode','modalCurName'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderDenoms)); if(typeof window.calculateCurrencyHasil==='function')window.calculateCurrencyHasil();
    }

    window.handleCurrencyCodeInput=function(){const input=document.getElementById('modalCurCode');if(!input||input.disabled)return;const code=String(input.value||'').trim().toUpperCase();if(!code)return;const currencies=typeof getCurrencies==='function'?getCurrencies():[];const exists=currencies.some(c=>String(c.code||'').trim().toUpperCase()===code);if(exists){alert('Valuta '+code+' sudah terdaftar di Manajemen Kurs. Gunakan tombol Edit untuk mengubah data atau menambahkan pecahan.');input.value='';input.focus();}}

function open(code=null) { const modal=ensureModal();if(!modal)return;const currencies=typeof getCurrencies==='function'?getCurrencies():[];const editCode=String(code||'').trim().toUpperCase();const c=editCode?currencies.find(x=>String(x.code||'').toUpperCase()===editCode):null;const isEdit=!!c;window.__almaraCurrencyMode=isEdit?'edit':'add';fill(c||{code:'',name:'',active:true,denominations:{banknote:[],coin:[]}});const input=document.getElementById('modalCurCode');if(input)input.disabled=isEdit;const title=modal.querySelector('.almara-cm-title h2');if(title)title.textContent=isEdit?'Edit Valuta':'Tambah Valuta';const subtitle=modal.querySelector('.almara-cm-title p');if(subtitle)subtitle.textContent=isEdit?'Ubah data valuta dan kelola pecahan.':'Tambahkan valuta baru. Pecahan ditambahkan setelah valuta tersimpan melalui Edit.';const denomCard=modal.querySelector('.almara-cm-denom-layout')?.closest('.almara-cm-card');if(denomCard)denomCard.style.display=isEdit?'':'none';const footerSave=modal.querySelector('button[onclick*="almaraSaveCurrencyMaster"]');if(footerSave)footerSave.innerHTML='<i class="fa-solid fa-floppy-disk"></i> '+(isEdit?'Simpan Perubahan':'Simpan Valuta');modal.classList.add('show','almara-currency-master-open'); }

    window.almaraAddDenom=function(type){const v=prompt(type==='coin'?'Masukkan nilai pecahan koin:':'Masukkan nilai pecahan uang kertas:');if(v===null)return;const n=num(String(v).replace(/,/g,''));if(n<=0)return alert('Pecahan harus lebih besar dari 0.');const arr=window.__almaraCurrencyDraft.denominations[type]||(window.__almaraCurrencyDraft.denominations[type]=[]);if(arr.includes(n))return alert('Pecahan tersebut sudah ada.');arr.push(n);arr.sort((a,b)=>b-a);renderDenoms();};
    window.almaraBulkAddDenom=function(type){const id=type==='banknote'?'cmBanknoteBulk':'cmCoinBulk';const input=document.getElementById(id);if(!input||!window.__almaraCurrencyDraft)return;const raw=String(input.value||'').trim();if(!raw)return;const values=raw.split(/[\\s,;|\\/]+/).map(v=>num(String(v).replace(/,/g,''))).filter(v=>v>0);const arr=window.__almaraCurrencyDraft.denominations[type]||(window.__almaraCurrencyDraft.denominations[type]=[]);let added=0;values.forEach(v=>{if(!arr.includes(v)){arr.push(v);added++;}});arr.sort((a,b)=>b-a);input.value='';renderDenoms();if(!added&&values.length)alert('Semua pecahan yang dimasukkan sudah ada.');};
    window.almaraLoadDenomPreset=function(type){const code=String(document.getElementById('modalCurCode')?.value||'').trim().toUpperCase();const preset=DEFAULT_DENOMS[code]?.[type]||[];if(!preset.length)return alert('Preset '+type+' untuk '+(code||'valuta ini')+' belum tersedia. Gunakan input cepat.');const arr=window.__almaraCurrencyDraft.denominations[type]||(window.__almaraCurrencyDraft.denominations[type]=[]);preset.forEach(v=>{if(!arr.includes(v))arr.push(v);});arr.sort((a,b)=>b-a);renderDenoms();};
    window.almaraEditDenom=function(type,index){const arr=window.__almaraCurrencyDraft?.denominations?.[type]||[];if(arr[index]==null)return;const value=prompt('Ubah nilai pecahan:',arr[index]);if(value===null)return;const n=num(String(value).replace(/,/g,''));if(n<=0)return alert('Pecahan harus lebih besar dari 0.');if(arr.some((x,i)=>i!==index&&x===n))return alert('Pecahan tersebut sudah ada.');arr[index]=n;arr.sort((a,b)=>b-a);renderDenoms();};
    window.almaraDeleteDenom=function(type,index){const arr=window.__almaraCurrencyDraft?.denominations?.[type]||[];if(arr[index]==null)return;arr.splice(index,1);renderDenoms();};

    async function syncCurrencyDenominations(code, data) {
        const request = window.authFetch || window.fetch;
        const payload = {
            currency_code: code,
            denominations: [
                ...(data.denominations?.banknote || []).map(v => ({
                    denomination: Number(v),
                    type: 'banknote',
                    buy: Number(data.buy) || 0,
                    sell: Number(data.sell) || 0,
                    margin_buy: 0,
                    margin_sell: 0,
                    stock: 0,
                    alert_stock: Number(data.alert) || 0,
                    is_active: true
                })),
                ...(data.denominations?.coin || []).map(v => ({
                    denomination: Number(v),
                    type: 'coin',
                    buy: Number(data.buy) || 0,
                    sell: Number(data.sell) || 0,
                    margin_buy: 0,
                    margin_sell: 0,
                    stock: 0,
                    alert_stock: Number(data.alert) || 0,
                    is_active: true
                }))
            ]
        };
        const options = () => {
            const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
            const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            if (csrf) headers['X-CSRF-TOKEN'] = csrf;
            return {
                method: 'POST',
                credentials: 'same-origin',
                headers,
                body: JSON.stringify(payload)
            };
        };
        let response = await request('api/currency-denominations/sync', options());
        let result = await response.json().catch(() => ({}));
        if (response.status === 419 && typeof refreshCsrfTokenFromServer === 'function') {
            if (await refreshCsrfTokenFromServer()) {
                response = await request('api/currency-denominations/sync', options());
                result = await response.json().catch(() => ({}));
            }
        }
        if (!response.ok || result.status === 'error') {
            throw new Error(result.message || ('Gagal menyimpan pecahan (HTTP ' + response.status + ')'));
        }
        return result;
    }

    window.almaraSaveCurrencyMaster=async function(){
        const code=String(document.getElementById('modalCurCode')?.value||'').trim().toUpperCase();
        const currencies=typeof getCurrencies==='function'?getCurrencies():[];
        const index=currencies.findIndex(c=>String(c.code||'').trim().toUpperCase()===code);
        const isEditMode=window.__almaraCurrencyMode==='edit';

        if(code&&index>=0&&!isEditMode){
            alert('Valuta '+code+' sudah terdaftar di Manajemen Kurs. Gunakan tombol Edit untuk mengubah data atau menambahkan pecahan.');
            return;
        }

        const name=String(document.getElementById('modalCurName')?.value||'').trim();
        const baseBuy=num(document.getElementById('modalCurBuy')?.value);
        const baseSell=num(document.getElementById('modalCurSell')?.value);
        if(!code||!name||baseBuy<=0||baseSell<=0){
            alert('Kode, Nama Valuta, Base Rate Beli, dan Base Rate Jual wajib diisi.');
            return;
        }

        const old=index>=0?currencies[index]:{};
        const mb=num(document.getElementById('modalMarginBuy')?.value);
        const ms=num(document.getElementById('modalMarginSell')?.value);
        const data={
            ...old,
            code,
            name,
            label:name,
            numeric_code:String(document.getElementById('modalCurNumeric')?.value||'').trim(),
            symbol:String(document.getElementById('modalCurSymbol')?.value||'').trim(),
            decimals:Math.max(0,Math.min(6,num(document.getElementById('modalCurDecimals')?.value,2))),
            active:!!document.getElementById('modalCurActive')?.checked,
            base_buy:baseBuy,
            base_sell:baseSell,
            buy:baseBuy+mb,
            sell:baseSell+ms,
            stock:num(document.getElementById('modalCurStock')?.value),
            alert:num(document.getElementById('modalCurAlert')?.value,500),
            margin_buy:mb,
            margin_sell:ms,
            denominations:{
                banknote:[...(window.__almaraCurrencyDraft?.denominations?.banknote||[])],
                coin:[...(window.__almaraCurrencyDraft?.denominations?.coin||[])]
            },
            denomination_updated_at:new Date().toISOString()
        };

        const user=typeof getCurrentUser==='function'?getCurrentUser():null;
        data.inputBy=index>=0?(old.inputBy||user?.fullName||'Admin Kasir'):(user?.fullName||'Admin Kasir');
        data.editBy=index>=0?(user?.fullName||'Admin Kasir'):'';

        const button=document.querySelector('#currencyModal button[onclick*="almaraSaveCurrencyMaster"]');
        const originalText=button?.innerHTML||'<i class="fa-solid fa-floppy-disk"></i> Simpan Valuta';
        if(button){
            button.disabled=true;
            button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        }

        try{
            // Simpan HANYA valuta yang sedang dibuat/diedit.
            // Jangan memblokir penyimpanan karena ada valuta lama lain yang gagal sync.
            if(typeof saveToMySQL_Currency!=='function'){
                throw new Error('Fungsi penyimpanan Currency ke database tidak tersedia.');
            }

            const result=await saveToMySQL_Currency(data);
            if(!result||result.ok!==true){
                throw new Error(result?.message||'Server menolak penyimpanan valuta.');
            }

            // Pecahan disinkronkan setelah master valuta berhasil dibuat.
            await syncCurrencyDenominations(code,data);

            // Update local runtime setelah database sukses.
            const nextCurrencies=Array.isArray(currencies)?[...currencies]:[];
            if(index>=0) nextCurrencies[index]=data;
            else nextCurrencies.push(data);
            localStorage.setItem('mc_currencies',JSON.stringify(nextCurrencies));

            // Tutup modal SEGERA setelah seluruh penyimpanan sukses.
            if(typeof closeCurrencyModal==='function') closeCurrencyModal();

            if(typeof renderCurrencies==='function'){
                try{ renderCurrencies(); }catch(refreshError){ console.warn('Render tabel valuta gagal:',refreshError); }
            }
            if(typeof loadCurrencyTable==='function'){
                try{ loadCurrencyTable(); }catch(refreshError){ console.warn('Refresh tabel valuta gagal:',refreshError); }
            }

            alert('Valuta '+code+' berhasil disimpan.');
        }catch(error){
            console.error('Master valuta gagal disimpan:',error);
            alert('Valuta gagal disimpan ke database: '+(error?.message||error));
        }finally{
            if(button){
                button.disabled=false;
                button.innerHTML=originalText;
            }
        }
    };
    window.closeCurrencyModal=function(){const modal=document.getElementById('currencyModal');if(modal)modal.classList.remove('show','almara-currency-master-open');window.__almaraCurrencyDraft=null;window.__almaraCurrencyMode=null;};
    window.openCurrencyModal=open;
    window.almaraCurrencyMasterUI={open,renderDenoms};
})();
