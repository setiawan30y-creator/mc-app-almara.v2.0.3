/* MC-Almara - Direct Theme Settings sidebar button */
(function () {
    'use strict';

    function installThemeMenu() {
        var nav = document.querySelector('aside.sidebar .sidebar-nav');
        if (!nav) return false;

        if (nav.querySelector('#themeSettingsSidebarMenu') || nav.querySelector('a[href="/settings/theme"]')) {
            return true;
        }

        var settings = nav.querySelector('a[data-target="settings-view"]');
        if (!settings) return false;

        var item = document.createElement('a');
        item.id = 'themeSettingsSidebarMenu';
        item.href = '/settings/theme';
        item.className = 'nav-item';
        item.setAttribute('data-theme-settings-menu', 'true');
        item.title = 'Tema & Tampilan';
        item.style.cssText = 'display:flex!important;align-items:center;gap:10px;visibility:visible!important;opacity:1!important;pointer-events:auto!important;';
        item.innerHTML = '<i class="fa-solid fa-palette" style="color:#a78bfa;"></i><span>Tema & Tampilan</span>';

        settings.insertAdjacentElement('afterend', item);
        return true;
    }

    function boot() {
        if (installThemeMenu()) return;
        var tries = 0;
        var timer = setInterval(function () {
            if (installThemeMenu() || ++tries >= 100) clearInterval(timer);
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
