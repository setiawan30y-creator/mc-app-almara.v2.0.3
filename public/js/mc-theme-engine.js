(function () {
    'use strict';

    const KEY = 'mc_global_theme_v2';

    const defaults = {
        primary: '#1D6C5D', primaryHover: '#123D35', secondary: '#69736F',
        pageBg: '#F7F5EF', cardBg: '#FCFBF7', sidebarBg: '#0B2F29', sidebarText: '#B8CEC4',
        headerBg: '#FFFFFF', text: '#18221F', textMuted: '#69736F', border: '#D7D8CF',
        inputBg: '#FFFFFF', inputBorder: '#D7D8CF', buttonBg: '#1D6C5D', buttonText: '#FFFFFF',
        shadow: '0 2px 12px rgba(0,0,0,.06)', radius: '12px',
        buy: '#16A34A', sell: '#A94138', draft: '#EAB308', final: '#16A34A'
    };

    const map = {
        primary:'--mc-primary', primaryHover:'--mc-primary-hover', secondary:'--mc-secondary',
        pageBg:'--mc-page-bg', cardBg:'--mc-card-bg', sidebarBg:'--mc-sidebar-bg', sidebarText:'--mc-sidebar-text',
        headerBg:'--mc-header-bg', text:'--mc-text', textMuted:'--mc-text-muted', border:'--mc-border',
        inputBg:'--mc-input-bg', inputBorder:'--mc-input-border', buttonBg:'--mc-button-bg', buttonText:'--mc-button-text',
        shadow:'--mc-shadow', radius:'--mc-radius', buy:'--mc-buy', sell:'--mc-sell', draft:'--mc-draft', final:'--mc-final'
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

    window.MCTheme = { defaults, load, apply, reset, key: KEY, version: 5 };

    if (document.body) apply(load(), false);
    else document.addEventListener('DOMContentLoaded', function () { apply(load(), false); }, { once: true });
})();
