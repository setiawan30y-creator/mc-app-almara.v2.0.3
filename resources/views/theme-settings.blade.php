<!DOCTYPE html>
<html lang="id">
<head>
    <meta name="author" content="&#64;2026-Alifiandra">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="csrf-token" content="{{ csrf_token() }}">
<title>Tema &amp; Tampilan - MC Almara</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="{{ asset('css/mc-theme-engine.css?v=20261014-1') }}">
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--mc-page-bg);color:var(--mc-text);line-height:1.45}
.ts-wrap{max-width:1600px;margin:0 auto;padding:24px 28px 60px}
.ts-top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:22px}
.ts-top h1{margin:0;font-size:1.65rem;display:flex;align-items:center;gap:12px}
.ts-top h1 i{width:42px;height:42px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:1.05rem;background:color-mix(in srgb,var(--mc-primary) 14%,transparent);color:var(--mc-primary)}
.ts-top p{margin:6px 0 0;color:var(--mc-text-muted);font-size:.9rem}
.ts-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.ts-btn{border:1px solid var(--mc-border);background:var(--mc-card-bg);color:var(--mc-text);padding:10px 16px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:600;font-size:.88rem;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
.ts-btn:hover{border-color:var(--mc-primary);color:var(--mc-primary)}
.ts-btn.primary{background:var(--mc-button-bg);color:var(--mc-button-text);border-color:var(--mc-button-bg)}
.ts-btn.primary:hover{background:var(--mc-primary-hover);color:var(--mc-button-text)}
.ts-dirty{font-size:.8rem;color:var(--mc-draft);font-weight:700;display:none}
.ts-dirty.on{display:inline-flex;gap:6px;align-items:center}
.ts-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(380px,.95fr);gap:22px;align-items:start}
.ts-card{background:var(--mc-card-bg);border:1px solid var(--mc-border);border-radius:var(--mc-radius);box-shadow:var(--mc-shadow);padding:20px}
.ts-card h2{margin:0 0 14px;font-size:.78rem;letter-spacing:.9px;text-transform:uppercase;color:var(--mc-text-muted)}
.ts-presets{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.ts-preset{text-align:left;border:2px solid var(--mc-border);border-radius:14px;padding:10px;background:var(--mc-card-bg);cursor:pointer;color:var(--mc-text);font-family:inherit}
.ts-preset:hover{border-color:var(--mc-primary)}
.ts-preset.on{border-color:var(--mc-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--mc-primary) 20%,transparent)}
.ts-swatch{height:54px;border-radius:9px;display:grid;grid-template-columns:28% 1fr;overflow:hidden;border:1px solid rgba(0,0,0,.08);margin-bottom:8px}
.ts-swatch i{display:block}
.ts-swatch .m{padding:6px;display:flex;flex-direction:column;gap:4px;justify-content:center}
.ts-swatch .m b{display:block;height:8px;border-radius:3px;width:70%}
.ts-swatch .m span{display:block;height:14px;border-radius:4px;width:40%}
.ts-preset strong{display:block;font-size:.84rem}
.ts-preset small{color:var(--mc-text-muted);font-size:.72rem}
.ts-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:22px 0 16px;border-bottom:1px solid var(--mc-border);padding-bottom:12px}
.ts-tab{border:0;background:transparent;color:var(--mc-text-muted);padding:9px 14px;border-radius:9px;cursor:pointer;font-weight:700;font-size:.85rem;font-family:inherit;display:inline-flex;gap:8px;align-items:center}
.ts-tab:hover{background:color-mix(in srgb,var(--mc-primary) 8%,transparent)}
.ts-tab.on{background:color-mix(in srgb,var(--mc-primary) 14%,transparent);color:var(--mc-primary)}
.ts-pane{display:none}.ts-pane.on{display:block}
.ts-group{margin-bottom:22px}
.ts-group h3{margin:0 0 12px;font-size:.9rem}
.ts-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.ts-field label{display:block;font-size:.76rem;font-weight:700;color:var(--mc-text-muted);margin-bottom:6px}
.ts-field .hint{font-size:.7rem;color:var(--mc-text-muted);margin-top:4px;opacity:.85}
.ts-color{display:flex;gap:8px;align-items:center}
.ts-color input[type=color]{width:44px;height:40px;padding:3px;border-radius:9px;cursor:pointer;flex:none}
.ts-color input[type=text]{flex:1;min-width:0;height:40px;padding:0 10px;border-radius:9px;font-family:ui-monospace,Consolas,monospace;font-size:.82rem;text-transform:uppercase}
.ts-color button{border:0;background:transparent;color:var(--mc-text-muted);cursor:pointer;font-size:.9rem;padding:4px 6px}
.ts-field select,.ts-field input[type=text]{width:100%;height:40px;padding:0 10px;border-radius:9px;font-family:inherit}
.ts-range{display:flex;gap:10px;align-items:center}
.ts-range input[type=range]{flex:1;accent-color:var(--mc-primary)}
.ts-range output{min-width:46px;text-align:right;font-weight:700;font-size:.82rem}
.ts-switch{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.86rem;font-weight:600;color:var(--mc-text)}
.ts-switch input{width:18px;height:18px;accent-color:var(--mc-primary)}
/* Preview */
.ts-preview{position:sticky;top:18px}
.mock{border:1px solid var(--mc-border);border-radius:var(--mc-radius);overflow:hidden;background:var(--mc-page-bg);box-shadow:var(--mc-shadow);display:grid;grid-template-columns:150px 1fr;min-height:560px}
.mock-side{background:var(--mc-sidebar-bg);color:var(--mc-sidebar-text);padding:16px 12px}
.mock-side.grad{background:linear-gradient(180deg,var(--mc-sidebar-bg),color-mix(in srgb,var(--mc-sidebar-bg) 72%,#000))}
.mock-side strong{display:block;margin:2px 6px 18px;color:#fff;font-size:.95rem}
.mock-nav{padding:9px 10px;border-radius:var(--mc-nav-radius,8px);margin:3px 0;font-size:.82rem;display:flex;gap:9px;align-items:center}
.mock-nav.on{background:var(--mc-primary);color:var(--mc-button-text)}
.mock-main{padding:16px;min-width:0}
.mock-head{display:flex;justify-content:space-between;align-items:center;background:var(--mc-header-bg);border:1px solid var(--mc-border);border-radius:var(--mc-radius);padding:10px 14px;margin-bottom:14px}
.mock-head b{font-weight:var(--mc-heading-weight,700)}
.mock-head span{color:var(--mc-text-muted);font-size:.78rem}
.mock-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mock-card{background:var(--mc-card-bg);border:var(--mc-card-border-w,1px) solid var(--mc-border);border-radius:var(--mc-radius);padding:var(--mc-pad,16px);box-shadow:var(--mc-shadow)}
.mock-card small{color:var(--mc-text-muted);font-size:.74rem}
.mock-card .val{font-size:1.2rem;font-weight:var(--mc-heading-weight,700);margin:4px 0;font-variant-numeric:var(--mc-num,normal)}
.up{color:var(--mc-buy);font-weight:700;font-size:.78rem}.down{color:var(--mc-sell);font-weight:700;font-size:.78rem}
.mock-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.m-btn{padding:9px 14px;border:1px solid transparent;font-size:.8rem;cursor:default;border-radius:var(--mc-btn-radius,8px);font-weight:var(--mc-btn-weight,600);text-transform:var(--mc-btn-case,none);font-family:inherit;box-shadow:var(--mc-btn-shadow,none)}
.m-btn.p{background:var(--mc-button-bg);color:var(--mc-button-text)}
.m-btn.o{background:transparent;border-color:var(--mc-primary);color:var(--mc-primary)}
.m-btn.d{background:var(--mc-danger,#dc2626);color:#fff}
.m-btn.w{background:var(--mc-warning,#f59e0b);color:#1f2937}
.m-btn.i{background:var(--mc-info,#0ea5e9);color:#fff}
.m-input{width:100%;height:38px;margin-top:6px;padding:0 10px;background:var(--mc-input-bg);border:1px solid var(--mc-input-border);color:var(--mc-text);border-radius:var(--mc-input-radius,8px);font-family:inherit}
.m-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:.78rem;font-variant-numeric:var(--mc-num,normal)}
.m-table th{background:var(--mc-table-head,var(--mc-card-bg));color:var(--mc-text-muted);text-align:left;padding:8px;border-bottom:1px solid var(--mc-border);font-size:.7rem;text-transform:uppercase}
.m-table td{padding:8px;border-bottom:1px solid var(--mc-border)}
.m-table tr:hover td{background:var(--mc-table-hover,transparent)}
.m-table.zebra tr:nth-child(even) td{background:color-mix(in srgb,var(--mc-border) 22%,transparent)}
.m-table .r{text-align:right}
.badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:.68rem;font-weight:700}
.b-buy{background:color-mix(in srgb,var(--mc-buy) 15%,transparent);color:var(--mc-buy)}
.b-sell{background:color-mix(in srgb,var(--mc-sell) 15%,transparent);color:var(--mc-sell)}
.b-draft{background:color-mix(in srgb,var(--mc-draft) 20%,transparent);color:var(--mc-draft)}
.ts-toast{position:fixed;right:24px;bottom:24px;background:#0f172a;color:#fff;padding:13px 18px;border-radius:12px;opacity:0;transform:translateY(10px);transition:.2s;z-index:50;max-width:380px;font-size:.88rem}
.ts-toast.show{opacity:1;transform:none}
@media(max-width:1180px){.ts-grid{grid-template-columns:1fr}.ts-preview{position:static}}
@media(max-width:640px){.ts-wrap{padding:16px 14px 50px}.mock{grid-template-columns:1fr}.mock-side{display:none}.mock-cards{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="ts-wrap">
    <div class="ts-top">
        <div>
            <h1><i class="fa-solid fa-palette"></i> Tema &amp; Tampilan</h1>
            <p>Atur warna, huruf, kartu, tombol, dan bentuk seluruh halaman. Perubahan terlihat langsung di pratinjau dan di halaman ini.</p>
        </div>
        <div class="ts-actions">
            <span class="ts-dirty" id="tsDirty"><i class="fa-solid fa-circle"></i> Belum disimpan</span>
            <button type="button" class="ts-btn" id="tsBack"><i class="fa-solid fa-arrow-left"></i> Kembali</button>
            <button type="button" class="ts-btn" id="tsReset"><i class="fa-solid fa-rotate-left"></i> Pulihkan Bawaan</button>
            <button type="button" class="ts-btn primary" id="tsSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Tema</button>
        </div>
    </div>

    <div class="ts-grid">
        <div>
            <div class="ts-card">
                <h2>Pilih Tema Jadi</h2>
                <div class="ts-presets" id="tsPresets"></div>

                <div class="ts-tabs" id="tsTabs"></div>
                <div id="tsPanes"></div>
            </div>
        </div>

        <div class="ts-preview">
            <div class="ts-card">
                <h2>Pratinjau Langsung</h2>
                <div class="mock" id="tsMock">
                    <div class="mock-side" id="tsMockSide">
                        <strong>MC ALMARA</strong>
                        <div class="mock-nav on"><i class="fa-solid fa-gauge"></i> Dashboard</div>
                        <div class="mock-nav"><i class="fa-solid fa-cash-register"></i> Transaksi</div>
                        <div class="mock-nav"><i class="fa-solid fa-users"></i> Nasabah</div>
                        <div class="mock-nav"><i class="fa-solid fa-coins"></i> Stok Valas</div>
                        <div class="mock-nav"><i class="fa-solid fa-lock"></i> Closing</div>
                    </div>
                    <div class="mock-main">
                        <div class="mock-head"><b>Dashboard</b><span>Teller Workspace</span></div>
                        <div class="mock-cards">
                            <div class="mock-card"><small>Brankas Tunai</small><div class="val">Rp 125.000.000</div><span class="up">▲ Kas masuk</span></div>
                            <div class="mock-card"><small>Saldo Bank</small><div class="val">Rp 45.250.000</div><span class="down">▼ Kas keluar</span></div>
                        </div>
                        <div class="mock-card" style="margin-top:12px">
                            <small>Transaksi baru</small>
                            <input class="m-input" value="USD 100 × Rp 16.500" readonly>
                            <div class="mock-row">
                                <span class="m-btn p">Simpan</span><span class="m-btn o">Batal</span>
                                <span class="m-btn i">Info</span><span class="m-btn w">Tahan</span><span class="m-btn d">Hapus</span>
                            </div>
                        </div>
                        <div class="mock-card" style="margin-top:12px">
                            <small>Riwayat terbaru</small>
                            <table class="m-table" id="tsMockTable">
                                <thead><tr><th>Invoice</th><th>Jenis</th><th class="r">Total</th></tr></thead>
                                <tbody>
                                    <tr><td>INV-0001</td><td><span class="badge b-buy">BELI</span></td><td class="r">1.650.000</td></tr>
                                    <tr><td>INV-0002</td><td><span class="badge b-sell">JUAL</span></td><td class="r">3.310.000</td></tr>
                                    <tr><td>INV-0003</td><td><span class="badge b-draft">DRAFT</span></td><td class="r">825.000</td></tr>
                                    <tr><td>INV-0004</td><td><span class="badge b-buy">BELI</span></td><td class="r">4.120.000</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <p style="font-size:.78rem;color:var(--mc-text-muted);margin:12px 0 0">Tema disimpan di server dan berlaku untuk semua pengguna setelah memuat ulang halaman. Tidak mengubah data atau fungsi transaksi.</p>
            </div>
        </div>
    </div>
</div>
<div id="tsToast" class="ts-toast"></div>
<input type="file" id="tsImportFile" accept=".json" style="display:none">
<script>window.MC_THEME_SYNC = false;</script>
<script src="{{ asset('js/mc-theme-engine.js?v=20261024-1') }}"></script>
<script src="{{ asset('js/mc-theme-settings.js?v=20261024-1') }}"></script>
</body>
</html>
