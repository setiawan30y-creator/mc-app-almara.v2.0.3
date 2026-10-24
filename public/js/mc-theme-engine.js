(function () {
    'use strict';

    const KEY = 'mc_global_theme_v2';

    const defaults = {
        primary: '#1D6C5D', primaryHover: '#123D35', secondary: '#69736F',
        pageBg: '#F7F5EF', cardBg: '#FCFBF7', sidebarBg: '#0B2F29', sidebarText: '#B8CEC4',
        headerBg: '#FFFFFF', text: '#18221F', textMuted: '#69736F', border: '#D7D8CF',
        inputBg: '#FFFFFF', inputBorder: '#D7D8CF', buttonBg: '#1D6C5D', buttonText: '#FFFFFF',
        shadow: '0 2px 12px rgba(0,0,0,.06)', radius: '12px',
        buy: '#16A34A', sell: '#A94138', draft: '#EAB308', final: '#16A34A',
        // Token tambahan v6. Nilai kosong = pakai tampilan bawaan aplikasi.
        info: '', warning: '', danger: '', link: '',
        tableHeadBg: '', tableHover: '', tableZebra: '',
        fontFamily: '', fontSize: '', headingWeight: '', tabularNums: '',
        btnRadius: '', btnWeight: '', btnCase: '', btnShadow: '',
        inputRadius: '', cardBorderWidth: '', density: '',
        sidebarGradient: '', navRadius: '', smoothMotion: ''
    };

    const FONTS = {
        inter: { label: 'Inter (bawaan)', stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", google: 'Inter:wght@400;500;600;700;800' },
        jakarta: { label: 'Plus Jakarta Sans', stack: "'Plus Jakarta Sans', 'Inter', sans-serif", google: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
        poppins: { label: 'Poppins', stack: "'Poppins', 'Inter', sans-serif", google: 'Poppins:wght@400;500;600;700' },
        manrope: { label: 'Manrope', stack: "'Manrope', 'Inter', sans-serif", google: 'Manrope:wght@400;500;600;700;800' },
        dmsans: { label: 'DM Sans', stack: "'DM Sans', 'Inter', sans-serif", google: 'DM+Sans:wght@400;500;600;700' },
        nunito: { label: 'Nunito Sans', stack: "'Nunito Sans', 'Inter', sans-serif", google: 'Nunito+Sans:wght@400;600;700;800' },
        roboto: { label: 'Roboto', stack: "'Roboto', 'Inter', sans-serif", google: 'Roboto:wght@400;500;700' },
        source: { label: 'Source Sans 3', stack: "'Source Sans 3', 'Inter', sans-serif", google: 'Source+Sans+3:wght@400;600;700' },
        merriweather: { label: 'Merriweather (serif)', stack: "'Merriweather', Georgia, serif", google: 'Merriweather:wght@400;700' },
        system: { label: 'Font sistem (tanpa unduhan)', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", google: '' }
    };

    const SHADOWS = {
        none: 'none',
        soft: '0 1px 2px rgba(15,23,42,.05), 0 2px 12px rgba(15,23,42,.06)',
        medium: '0 2px 4px rgba(15,23,42,.06), 0 8px 24px rgba(15,23,42,.10)',
        strong: '0 4px 8px rgba(15,23,42,.10), 0 16px 40px rgba(15,23,42,.18)',
        glow: '0 0 0 1px rgba(99,102,241,.25), 0 8px 30px rgba(99,102,241,.25)'
    };

    const PRESETS = {
        default: { name: 'Almara Default', note: 'Tampilan APV sekarang', values: {} },
        emerald: { name: 'Emerald Bersih', note: 'Terang, hijau segar', values: {
            primary:'#059669', primaryHover:'#047857', secondary:'#64748B', pageBg:'#F1F5F9', cardBg:'#FFFFFF',
            sidebarBg:'#064E3B', sidebarText:'#A7F3D0', headerBg:'#FFFFFF', text:'#0F172A', textMuted:'#64748B',
            border:'#E2E8F0', inputBg:'#FFFFFF', inputBorder:'#CBD5E1', buttonBg:'#059669', buttonText:'#FFFFFF',
            buy:'#059669', sell:'#DC2626', radius:'16px', shadow:SHADOWS.soft,
            fontFamily:'jakarta', btnRadius:'10px', inputRadius:'10px', btnWeight:'600', headingWeight:'700',
            tableHeadBg:'#F8FAFC', tableHover:'#F0FDF4', sidebarGradient:'1', navRadius:'10px', tabularNums:'1', smoothMotion:'1' } },
        midnight: { name: 'Midnight Indigo', note: 'Gelap elegan, aksen indigo', values: {
            primary:'#818CF8', primaryHover:'#6366F1', secondary:'#8B93B5', pageBg:'#0B1020', cardBg:'#131A2E',
            sidebarBg:'#080C18', sidebarText:'#A5B4FC', headerBg:'#0F1629', text:'#E6E9F5', textMuted:'#8B93B5',
            border:'#232C4A', inputBg:'#0F1629', inputBorder:'#2E3963', buttonBg:'#6366F1', buttonText:'#FFFFFF',
            buy:'#34D399', sell:'#F87171', radius:'14px', shadow:'0 8px 30px rgba(0,0,0,.35)',
            fontFamily:'jakarta', btnRadius:'10px', inputRadius:'10px', btnWeight:'600', headingWeight:'700',
            tableHeadBg:'#101730', tableHover:'#1A2342', link:'#A5B4FC', sidebarGradient:'1', navRadius:'10px', tabularNums:'1', smoothMotion:'1' } },
        ocean: { name: 'Ocean Blue', note: 'Biru tenang, profesional', values: {
            primary:'#0369A1', primaryHover:'#075985', secondary:'#52718A', pageBg:'#F0F9FF', cardBg:'#FFFFFF',
            sidebarBg:'#0C4A6E', sidebarText:'#BAE6FD', headerBg:'#FFFFFF', text:'#082F49', textMuted:'#52718A',
            border:'#BAE6FD', inputBg:'#FFFFFF', inputBorder:'#7DD3FC', buttonBg:'#0369A1', buttonText:'#FFFFFF',
            buy:'#059669', sell:'#DC2626', radius:'12px', shadow:SHADOWS.soft,
            fontFamily:'dmsans', btnRadius:'8px', inputRadius:'8px', btnWeight:'600', headingWeight:'700',
            tableHeadBg:'#E0F2FE', tableHover:'#F0F9FF', sidebarGradient:'1', navRadius:'8px', tabularNums:'1' } },
        sunset: { name: 'Sunset Hangat', note: 'Oranye hangat, tombol pil', values: {
            primary:'#C2410C', primaryHover:'#9A3412', secondary:'#9A6B4F', pageBg:'#FFF7ED', cardBg:'#FFFFFF',
            sidebarBg:'#431407', sidebarText:'#FDBA74', headerBg:'#FFFFFF', text:'#431407', textMuted:'#9A6B4F',
            border:'#FED7AA', inputBg:'#FFFFFF', inputBorder:'#FDBA74', buttonBg:'#C2410C', buttonText:'#FFFFFF',
            buy:'#15803D', sell:'#B91C1C', radius:'20px', shadow:SHADOWS.medium,
            fontFamily:'poppins', btnRadius:'999px', inputRadius:'12px', btnWeight:'600', headingWeight:'600',
            tableHeadBg:'#FFEDD5', tableHover:'#FFF7ED', navRadius:'12px', smoothMotion:'1' } },
        rose: { name: 'Rose Lembut', note: 'Merah muda modern', values: {
            primary:'#BE185D', primaryHover:'#9D174D', secondary:'#9D6B83', pageBg:'#FDF2F8', cardBg:'#FFFFFF',
            sidebarBg:'#500724', sidebarText:'#FBCFE8', headerBg:'#FFFFFF', text:'#4A0D26', textMuted:'#9D6B83',
            border:'#FBCFE8', inputBg:'#FFFFFF', inputBorder:'#F9A8D4', buttonBg:'#BE185D', buttonText:'#FFFFFF',
            buy:'#047857', sell:'#BE123C', radius:'18px', shadow:SHADOWS.soft,
            fontFamily:'nunito', btnRadius:'12px', inputRadius:'12px', btnWeight:'700', headingWeight:'700',
            tableHeadBg:'#FCE7F3', tableHover:'#FDF2F8', navRadius:'12px', smoothMotion:'1' } },
        royal: { name: 'Royal Purple', note: 'Ungu mewah', values: {
            primary:'#7C3AED', primaryHover:'#6D28D9', secondary:'#7C6BA8', pageBg:'#F5F3FF', cardBg:'#FFFFFF',
            sidebarBg:'#2E1065', sidebarText:'#DDD6FE', headerBg:'#FFFFFF', text:'#1E1B4B', textMuted:'#6B63A0',
            border:'#DDD6FE', inputBg:'#FFFFFF', inputBorder:'#C4B5FD', buttonBg:'#7C3AED', buttonText:'#FFFFFF',
            buy:'#059669', sell:'#DC2626', radius:'16px', shadow:SHADOWS.medium,
            fontFamily:'manrope', btnRadius:'10px', inputRadius:'10px', btnWeight:'700', headingWeight:'700',
            tableHeadBg:'#EDE9FE', tableHover:'#F5F3FF', sidebarGradient:'1', navRadius:'10px', tabularNums:'1', smoothMotion:'1' } },
        slate: { name: 'Slate Datar', note: 'Netral, tegas, tanpa bayangan', values: {
            primary:'#334155', primaryHover:'#1E293B', secondary:'#64748B', pageBg:'#F8FAFC', cardBg:'#FFFFFF',
            sidebarBg:'#0F172A', sidebarText:'#CBD5E1', headerBg:'#FFFFFF', text:'#0F172A', textMuted:'#64748B',
            border:'#E2E8F0', inputBg:'#FFFFFF', inputBorder:'#CBD5E1', buttonBg:'#334155', buttonText:'#FFFFFF',
            buy:'#16A34A', sell:'#DC2626', radius:'6px', shadow:'none',
            fontFamily:'system', btnRadius:'6px', inputRadius:'6px', btnWeight:'600', headingWeight:'600', cardBorderWidth:'1',
            tableHeadBg:'#F1F5F9', tableHover:'#F8FAFC', navRadius:'6px', tabularNums:'1' } },
        graphite: { name: 'Graphite Gelap', note: 'Gelap netral, aksen hijau', values: {
            primary:'#22C55E', primaryHover:'#16A34A', secondary:'#A1A1AA', pageBg:'#0F0F10', cardBg:'#18181B',
            sidebarBg:'#09090B', sidebarText:'#D4D4D8', headerBg:'#111113', text:'#FAFAFA', textMuted:'#A1A1AA',
            border:'#27272A', inputBg:'#111113', inputBorder:'#3F3F46', buttonBg:'#16A34A', buttonText:'#FFFFFF',
            buy:'#4ADE80', sell:'#F87171', radius:'12px', shadow:'0 6px 24px rgba(0,0,0,.45)',
            fontFamily:'inter', btnRadius:'8px', inputRadius:'8px', btnWeight:'600', headingWeight:'700', cardBorderWidth:'1',
            tableHeadBg:'#1C1C20', tableHover:'#202024', link:'#86EFAC', navRadius:'8px', tabularNums:'1', smoothMotion:'1' } }
    };

    const map = {
        primary:'--mc-primary', primaryHover:'--mc-primary-hover', secondary:'--mc-secondary',
        pageBg:'--mc-page-bg', cardBg:'--mc-card-bg', sidebarBg:'--mc-sidebar-bg', sidebarText:'--mc-sidebar-text',
        headerBg:'--mc-header-bg', text:'--mc-text', textMuted:'--mc-text-muted', border:'--mc-border',
        inputBg:'--mc-input-bg', inputBorder:'--mc-input-border', buttonBg:'--mc-button-bg', buttonText:'--mc-button-text',
        shadow:'--mc-shadow', radius:'--mc-radius', buy:'--mc-buy', sell:'--mc-sell', draft:'--mc-draft', final:'--mc-final',
        info:'--mc-info', warning:'--mc-warning', danger:'--mc-danger', link:'--mc-link',
        tableHeadBg:'--mc-table-head', tableHover:'--mc-table-hover',
        btnRadius:'--mc-btn-radius', inputRadius:'--mc-input-radius'
    };

    function normalize(theme) { return Object.assign({}, defaults, theme || {}); }

    function load() {
        try { return normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); }
        catch (e) { return normalize(); }
    }

    function installDashboardBridge() {
        if (document.getElementById('mc-dashboard-theme-bridge')) return;
        const style = document.createElement('style');
        style.id = 'mc-dashboard-theme-bridge';
        style.textContent = `
/* MC-Almara global theme bridge for legacy Dashboard/APV CSS. */
html[data-mc-theme] body .main-content,
html[data-mc-theme] body .view-container,
html[data-mc-theme] body #appContainer { background: var(--mc-page-bg) !important; color: var(--mc-text) !important; }
html[data-mc-theme] body #dashboard-view { background: transparent !important; color: var(--mc-text) !important; }
/* Only real surfaces are cards. Layout wrappers keep the page background so gaps remain visible. */
html[data-mc-theme] body #dashboard-view > .mb-4,
html[data-mc-theme] body #dashboard-view .stats-grid > .stat-card,
html[data-mc-theme] body #dashboard-view .dashboard-content > .panel,
html[data-mc-theme] body #dashboard-view > .panel.mt-4,
html[data-mc-theme] body #dashboard-view .panel,
html[data-mc-theme] body #dashboard-view .stat-card,
html[data-mc-theme] body #dashboard-view .chart-panel,
html[data-mc-theme] body #dashboard-view .stock-panel,
html[data-mc-theme] body #dashboard-view .summary-box {
  background-color: var(--mc-card-bg) !important;
  color: var(--mc-text) !important;
  border-color: var(--mc-border) !important;
}
html[data-mc-theme] body #dashboard-view > .stats-grid,
html[data-mc-theme] body #dashboard-view > .dashboard-content {
  background-color: var(--mc-page-bg) !important;
  color: var(--mc-text) !important;
}
body.apv-theme .panel,
body.apv-theme .stat-card,
body.apv-theme .card,
body.apv-theme .dashboard-card { background: var(--mc-card-bg) !important; border-color: var(--mc-border) !important; box-shadow: var(--mc-shadow) !important; color: var(--mc-text) !important; }
body.apv-theme .panel-header { border-color: var(--mc-border) !important; }
body.apv-theme .panel-header h3,
body.apv-theme .stat-card .stat-value { color: var(--mc-text) !important; }
body.apv-theme .panel-header h3 i,
body.apv-theme .text-primary,
body.apv-theme .text-blue { color: var(--mc-primary) !important; }
body.apv-theme .stat-card h3,
body.apv-theme .text-muted { color: var(--mc-text-muted) !important; }
body.apv-theme .table thead th { background: var(--mc-card-bg) !important; color: var(--mc-text-muted) !important; border-color: var(--mc-border) !important; }
body.apv-theme .table tbody td { color: var(--mc-text) !important; border-color: var(--mc-border) !important; }
body.apv-theme .top-header { background: var(--mc-header-bg) !important; border-color: var(--mc-border) !important; color: var(--mc-text) !important; }
body.apv-theme .top-header h1,
body.apv-theme #pageTitle { color: var(--mc-text) !important; }
body.apv-theme input,
body.apv-theme select,
body.apv-theme textarea { background: var(--mc-input-bg) !important; color: var(--mc-text) !important; border-color: var(--mc-input-border) !important; }
body.apv-theme button.btn-primary,
body.apv-theme .btn-primary,
body.apv-theme .btn-success { background: var(--mc-button-bg) !important; border-color: var(--mc-button-bg) !important; color: var(--mc-button-text) !important; }
body.apv-theme .sidebar { background: var(--mc-sidebar-bg) !important; border-color: var(--mc-border) !important; }
body.apv-theme .sidebar-header,
body.apv-theme .sidebar-footer { background: var(--mc-sidebar-bg) !important; border-color: var(--mc-border) !important; }
body.apv-theme .sidebar-nav .nav-item { color: var(--mc-sidebar-text) !important; }
body.apv-theme .sidebar-nav .nav-item:hover { background: var(--mc-primary-hover) !important; color: var(--mc-button-text) !important; }
body.apv-theme .sidebar-nav .nav-item.active { background: var(--mc-primary) !important; color: var(--mc-button-text) !important; }
body.apv-theme .sidebar-nav .nav-item.active i { color: var(--mc-button-text) !important; }
body.apv-theme .stat-card:nth-child(n) { border-top-color: var(--mc-primary) !important; }
body.apv-theme .stat-icon { background: color-mix(in srgb, var(--mc-primary) 12%, transparent) !important; color: var(--mc-primary) !important; }
body.apv-theme .stat-icon.text-green { background: color-mix(in srgb, var(--mc-buy) 12%, transparent) !important; color: var(--mc-buy) !important; }
body.apv-theme .stat-icon.text-red { background: color-mix(in srgb, var(--mc-sell) 12%, transparent) !important; color: var(--mc-sell) !important; }

/* Dashboard semantic surfaces: page background must NOT leak into controls. */
html[data-mc-theme] body #dashboard-view .form-control,
html[data-mc-theme] body #dashboard-view select,
html[data-mc-theme] body #dashboard-view textarea {
  background: var(--mc-input-bg) !important;
  color: var(--mc-text) !important;
  border-color: var(--mc-input-border) !important;
}
html[data-mc-theme] body #dashboard-view .table thead th {
  background: var(--mc-card-bg) !important;
  color: var(--mc-text-muted) !important;
  border-color: var(--mc-border) !important;
}
html[data-mc-theme] body #dashboard-view .table tbody td {
  background: transparent !important;
  color: var(--mc-text) !important;
  border-color: var(--mc-border) !important;
}
html[data-mc-theme] body #dashboard-view .stock-item {
  background: var(--mc-card-bg) !important;
  color: var(--mc-text) !important;
  border-color: var(--mc-border) !important;
}
html[data-mc-theme] body #dashboard-view .stock-code,
html[data-mc-theme] body #dashboard-view .stock-amount {
  color: var(--mc-text) !important;
}
html[data-mc-theme] body #dashboard-view .stock-name,
html[data-mc-theme] body #dashboard-view .stock-rate-chip span {
  color: var(--mc-text-muted) !important;
}
html[data-mc-theme] body #dashboard-view .chart-range-btn {
  background: var(--mc-card-bg) !important;
  color: var(--mc-text-muted) !important;
  border-color: var(--mc-border) !important;
}
html[data-mc-theme] body #dashboard-view .chart-range-btn:hover,
html[data-mc-theme] body #dashboard-view .chart-range-btn.active {
  background: var(--mc-primary) !important;
  color: var(--mc-button-text) !important;
  border-color: var(--mc-primary) !important;
}
`;
        document.head.appendChild(style);
    }

    function loadFont(key) {
        const f = FONTS[key];
        const old = document.getElementById('mc-theme-font');
        if (!f || !f.google) { if (old) old.remove(); return; }
        const href = 'https://fonts.googleapis.com/css2?family=' + f.google + '&display=swap';
        if (old && old.getAttribute('href') === href) return;
        if (old) old.remove();
        const link = document.createElement('link');
        link.id = 'mc-theme-font';
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function buildExtraCss(t) {
        const P = 'html[data-mc-theme] body';
        const r = [];
        const font = FONTS[t.fontFamily];
        if (font) {
            r.push(`${P}, ${P} input, ${P} select, ${P} textarea, ${P} button, ${P} .btn, ${P} .form-control, ${P} .select2-container, ${P} .swal2-popup { font-family: ${font.stack} !important; }`);
        }
        if (t.fontSize) r.push(`html[data-mc-theme] { font-size: ${parseInt(t.fontSize, 10)}px !important; }`);
        if (t.headingWeight) r.push(`${P} h1, ${P} h2, ${P} h3, ${P} h4, ${P} .panel-header h3, ${P} .stat-value, ${P} .modal-header h2, ${P} .modal-header h3 { font-weight: ${parseInt(t.headingWeight, 10)} !important; }`);
        if (t.tabularNums === '1') r.push(`${P} table, ${P} .stat-value, ${P} .text-end, ${P} .stock-amount, ${P} input[type=number] { font-variant-numeric: tabular-nums; }`);

        // Kartu
        const cardSel = `${P} .panel, ${P} .stat-card, ${P} .card, ${P} .dashboard-card, ${P} .modal-content`;
        r.push(`${cardSel} { border-radius: var(--mc-radius) !important; }`);
        if (t.cardBorderWidth !== '') r.push(`${cardSel} { border-width: ${parseInt(t.cardBorderWidth, 10)}px !important; border-style: solid !important; }`);
        const pad = { compact: '14px', normal: '20px', comfortable: '28px' }[t.density];
        if (pad) r.push(`${P} .panel:not(.panel-header):not(.header-panel) { padding: ${pad} !important; }`);

        // Tombol
        const btnSel = `${P} .btn, ${P} button.btn, ${P} .mc-btn-primary`;
        if (t.btnRadius) r.push(`${btnSel} { border-radius: ${t.btnRadius} !important; }`);
        if (t.btnWeight) r.push(`${btnSel} { font-weight: ${parseInt(t.btnWeight, 10)} !important; }`);
        if (t.btnCase === 'uppercase') r.push(`${btnSel} { text-transform: uppercase !important; letter-spacing: .4px; }`);
        if (t.btnShadow === '1') r.push(`${P} .btn-primary, ${P} .btn-success, ${P} .btn-danger { box-shadow: 0 4px 14px color-mix(in srgb, var(--mc-button-bg) 35%, transparent) !important; }`);
        if (t.danger) r.push(`${P} .btn-danger { background: ${t.danger} !important; border-color: ${t.danger} !important; color: #fff !important; }`);
        if (t.warning) r.push(`${P} .btn-warning { background: ${t.warning} !important; border-color: ${t.warning} !important; color: #1f2937 !important; }`);
        if (t.info) r.push(`${P} .btn-info { background: ${t.info} !important; border-color: ${t.info} !important; color: #fff !important; }`);

        // Input
        const inSel = `${P} .form-control, ${P} input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]):not([type=file]), ${P} select, ${P} textarea`;
        if (t.inputRadius) r.push(`${inSel} { border-radius: ${t.inputRadius} !important; }`);
        r.push(`${P} .form-control:focus, ${P} input:focus, ${P} select:focus, ${P} textarea:focus { border-color: var(--mc-primary) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--mc-primary) 22%, transparent) !important; outline: none !important; }`);

        // Tabel
        if (t.tableHeadBg) r.push(`${P} .table thead th, ${P} table thead th { background: ${t.tableHeadBg} !important; }`);
        if (t.tableHover) r.push(`${P} .table tbody tr:hover td, ${P} table tbody tr:hover td { background: ${t.tableHover} !important; }`);
        if (t.tableZebra === '1') r.push(`${P} .table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--mc-border) 22%, transparent) !important; }`);

        // Tautan
        if (t.link) r.push(`${P} main a:not(.btn):not(.nav-item), ${P} .main-content a:not(.btn):not(.nav-item) { color: ${t.link}; }`);

        // Sidebar
        if (t.sidebarGradient === '1') r.push(`${P}.apv-theme .sidebar { background: linear-gradient(180deg, var(--mc-sidebar-bg), color-mix(in srgb, var(--mc-sidebar-bg) 72%, #000)) !important; }`);
        if (t.navRadius) r.push(`${P} .sidebar-nav .nav-item { border-radius: ${t.navRadius} !important; }`);

        // Gerak halus
        if (t.smoothMotion === '1') r.push(`${P} .btn, ${P} .panel, ${P} .stat-card, ${P} .nav-item, ${P} input, ${P} select { transition: background-color .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease !important; } ${P} .stat-card:hover { transform: translateY(-2px); }`);

        return r.join('\n');
    }

    function installExtraCss(t) {
        let style = document.getElementById('mc-theme-extra');
        if (!style) {
            style = document.createElement('style');
            style.id = 'mc-theme-extra';
            document.head.appendChild(style);
        }
        style.textContent = buildExtraCss(t);
        loadFont(t.fontFamily);
    }

    function syncFromServer() {
        if (window.MC_THEME_SYNC === false || typeof fetch !== 'function') return;
        fetch('/api/theme', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
            .then(r => r.ok ? r.json() : null)
            .then(res => {
                const remote = res && res.data;
                if (!remote || typeof remote !== 'object') return;
                const merged = normalize(remote);
                let local = null;
                try { local = localStorage.getItem(KEY); } catch (e) {}
                if (JSON.stringify(merged) !== JSON.stringify(normalize(local ? JSON.parse(local) : null))) {
                    apply(merged, true);
                }
            })
            .catch(() => {});
    }

    function apply(theme, persist = true) {
        const t = normalize(theme);
        const root = document.documentElement;
        Object.keys(map).forEach(k => root.style.setProperty(map[k], t[k]));

        const legacy = {
            '--bg-dark': t.pageBg, '--panel-bg': t.cardBg, '--panel-border': t.border,
            '--text-primary': t.text, '--text-muted': t.textMuted,
            '--accent-green': t.primary, '--accent-green-hover': t.primaryHover,
            '--accent-red': t.sell, '--accent-blue': t.primary, '--accent-blue-hover': t.primaryHover,
            '--border-radius': t.radius
        };
        Object.keys(legacy).forEach(k => root.style.setProperty(k, legacy[k]));
        root.dataset.mcTheme = t.name || 'almara-default';
        installExtraCss(t);

        if (document.body) {
            document.body.classList.add('apv-theme');
            const apvLegacy = {
                '--bg-dark': t.pageBg, '--panel-bg': t.cardBg, '--panel-border': t.border,
                '--text-primary': t.text, '--text-muted': t.textMuted,
                '--accent-green': t.primary, '--accent-green-hover': t.primaryHover,
                '--accent-red': t.sell, '--accent-blue': t.primary, '--accent-blue-hover': t.primaryHover,
                '--sidebar-bg-apv': t.sidebarBg, '--sidebar-hover-apv': t.primaryHover,
                '--sidebar-active-apv': t.primary, '--sidebar-border-apv': t.border,
                '--sidebar-text-apv': t.sidebarText, '--sidebar-label-apv': t.secondary
            };
            Object.entries(apvLegacy).forEach(([key, value]) => document.body.style.setProperty(key, value, 'important'));
            installDashboardBridge();
        }

        if (persist) {
            try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('mc-theme-applied', { detail: t }));
        return t;
    }

    function reset() {
        try { localStorage.removeItem(KEY); } catch (e) {}
        return apply(defaults, false);
    }

    window.MCTheme = { defaults, load, apply, reset, key: KEY, version: 6, fonts: FONTS, shadows: SHADOWS, presets: PRESETS, sync: syncFromServer, normalize };

    if (document.body) { apply(load(), false); syncFromServer(); }
    else document.addEventListener('DOMContentLoaded', function () { apply(load(), false); syncFromServer(); }, { once: true });
})();
