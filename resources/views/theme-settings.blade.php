<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MC-Almara | Theme & Appearance</title>
<link rel="stylesheet" href="{{ asset('css/mc-theme-engine.css?v=20260924-2') }}">
<style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--mc-page-bg);color:var(--mc-text)}
.wrap{max-width:1500px;margin:auto;padding:28px}.top{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px}.title h1{margin:0;font-size:28px}.title p{margin:6px 0 0;color:var(--mc-text-muted)}
.actions{display:flex;gap:10px;flex-wrap:wrap}.btn{border:1px solid var(--mc-border);background:var(--mc-card-bg);color:var(--mc-text);padding:11px 16px;border-radius:10px;cursor:pointer;font-weight:700}.btn.primary{background:var(--mc-button-bg);color:var(--mc-button-text);border-color:var(--mc-button-bg)}.btn.back{background:transparent}
.grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(420px,.8fr);gap:22px}.cardbox{background:var(--mc-card-bg);border:1px solid var(--mc-border);border-radius:var(--mc-radius);box-shadow:var(--mc-shadow);padding:22px}.section{margin-bottom:24px}.section h2{font-size:16px;margin:0 0 14px}.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.field label{display:block;font-size:12px;font-weight:800;margin-bottom:6px;color:var(--mc-text-muted)}.field input{width:100%;height:42px;border:1px solid var(--mc-input-border);border-radius:9px;padding:0 10px}.color{display:flex;gap:8px}.color input[type=color]{width:46px;padding:3px}.color input[type=text]{flex:1}.presets{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px}.preset{min-height:66px;text-align:left}.preset small{display:block;margin-top:3px;font-weight:500;color:var(--mc-text-muted)}.preview{position:sticky;top:20px}.mock{height:610px;border:1px solid var(--p-border);border-radius:14px;overflow:hidden;background:var(--p-page);box-shadow:var(--p-shadow);display:grid;grid-template-columns:170px 1fr}.mock-side{background:var(--p-sidebar);color:var(--p-sidebar-text);padding:18px}.mock-side strong{display:block;margin-bottom:22px}.mock-side div{padding:9px 8px;border-radius:8px;margin:3px 0}.mock-side .active{background:var(--p-primary);color:white}.mock-main{padding:20px;color:var(--p-text)}.mock-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--p-border);padding-bottom:14px}.mock-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}.mock-card{background:var(--p-card);border:1px solid var(--p-border);border-radius:var(--p-radius);padding:18px;box-shadow:var(--p-shadow)}.mock-card small{color:var(--p-muted)}.mock-button{display:inline-block;margin-top:18px;padding:10px 15px;border-radius:9px;background:var(--p-button);color:var(--p-button-text);font-weight:800}.mock-buy{color:var(--p-buy);font-weight:800}.mock-sell{color:var(--p-sell);font-weight:800}.hint{font-size:12px;color:var(--mc-text-muted);margin-top:12px}.toast{position:fixed;right:25px;bottom:25px;background:#0B2F29;color:white;padding:13px 17px;border-radius:10px;opacity:0;transform:translateY(10px);transition:.2s}.toast.show{opacity:1;transform:none}
@media(max-width:1100px){.grid{grid-template-columns:1fr}.preview{position:static}}@media(max-width:850px){.presets{grid-template-columns:repeat(2,1fr)}.fields{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.wrap{padding:14px}.top{align-items:flex-start;flex-direction:column}.fields{grid-template-columns:1fr}.presets{grid-template-columns:1fr}.mock{grid-template-columns:110px 1fr}.mock-side{padding:10px}}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><div class="title"><h1>🎨 Theme & Appearance</h1><p>Atur identitas visual MC-Almara dari satu tempat. Almara Default mengikuti tampilan APV saat ini.</p></div><div class="actions"><button type="button" class="btn back" id="theme-back">← Kembali</button><button type="button" class="btn" id="theme-dashboard">⌂ Dashboard</button><button class="btn" id="theme-reset">Pulihkan Almara Default</button><button class="btn primary" id="theme-save">Simpan Tema</button></div></div>
<div class="grid">
<div class="cardbox">
<div class="section"><h2>Preset MC-Almara</h2><div class="presets">
<button class="btn preset" data-preset="default">Almara Default<small>APV sekarang</small></button>
<button class="btn preset" data-preset="light">Almara Light<small>lebih terang</small></button>
<button class="btn preset" data-preset="dark">Almara Dark<small>dark workspace</small></button>
<button class="btn preset" data-preset="forest">Almara Forest<small>forest / emerald</small></button>
<button class="btn preset" data-preset="classic">Almara Classic<small>blue classic</small></button>
</div></div>
<div class="section"><h2>Warna & Komponen Global</h2><div class="fields">
@foreach([['primary','Primary'],['primaryHover','Primary Hover'],['secondary','Secondary'],['pageBg','Background Halaman'],['cardBg','Background Kartu'],['sidebarBg','Sidebar'],['sidebarText','Text Sidebar'],['headerBg','Header'],['text','Text Utama'],['textMuted','Text Sekunder'],['border','Border'],['inputBg','Input Background'],['inputBorder','Input Border'],['buttonBg','Button'],['buttonText','Button Text'],['buy','BUY'],['sell','SELL'],['draft','Draft'],['final','Final']] as $f)
<div class="field"><label>{{ $f[1] }}</label><div class="color"><input type="color" id="theme-{{ $f[0] }}" data-theme-field><input type="text" id="theme-{{ $f[0] }}-text" value="" maxlength="7" spellcheck="false"></div></div>
@endforeach
</div></div>
<div class="section"><h2>Border & Shadow</h2><div class="fields"><div class="field"><label>Shadow</label><input data-theme-field id="theme-shadow" type="text"></div><div class="field"><label>Border Radius</label><input data-theme-field id="theme-radius" type="text"></div></div></div>
<p class="hint">Preview berubah langsung. <b>Simpan Tema</b> menyimpan pilihan pada browser ini. Tidak mengubah fungsi transaksi atau modul bisnis.</p>
</div>
<div class="cardbox preview"><h2 style="margin-top:0">Live Preview · MC-Almara</h2><div id="theme-preview" class="mock"><div class="mock-side"><strong>MC-ALMARA</strong><div class="active">Dashboard</div><div>Transaksi</div><div>Nasabah</div><div>Stock Valas</div><div>Closing</div></div><div class="mock-main"><div class="mock-head"><b>Dashboard</b><span style="color:var(--p-muted)">Teller Workspace</span></div><div class="mock-cards"><div class="mock-card"><small>Total Kas</small><h2>Rp 125.000.000</h2><span class="mock-buy">+ Kas Masuk</span></div><div class="mock-card"><small>Mutasi Bank</small><h2>Rp 45.000.000</h2><span class="mock-sell">- Kas Keluar</span></div></div><div class="mock-card" style="margin-top:12px"><small>Contoh transaksi</small><p>USD 100 × Rp 16.500</p><span class="mock-button">Simpan Transaksi</span></div></div></div></div>
</div></div>
<div id="theme-toast" class="toast"></div>
<script src="{{ asset('js/mc-theme-engine.js?v=20260924-2') }}"></script><script src="{{ asset('js/mc-theme-settings.js?v=20260924-2') }}"></script>
<script>
(function(){
 const dashboard=()=>{window.location.href='/';};
 document.getElementById('theme-dashboard')?.addEventListener('click',dashboard);
 document.getElementById('theme-back')?.addEventListener('click',()=>{
   if(document.referrer && new URL(document.referrer).origin===window.location.origin && window.history.length>1) window.history.back();
   else dashboard();
 });
})();
</script>
</body></html>
