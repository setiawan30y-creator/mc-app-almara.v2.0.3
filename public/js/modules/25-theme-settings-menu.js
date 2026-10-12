/*
 * MC-Almara - Theme Settings sidebar menu
 * Adds a dedicated button ABOVE the Pengaturan menu item.
 */
(function () {
    'use strict';

    function getSidebarNav() {
        return document.querySelector('aside.sidebar .sidebar-nav')
            || document.querySelector('.sidebar .sidebar-nav')
            || document.querySelector('.sidebar nav')
            || document.querySelector('.sidebar-nav');
    }

    function addThemeSettingsMenu() {
        var sidebarNav = getSidebarNav();
        if (!sidebarNav) return false;

        if (sidebarNav.querySelector('[data-theme-settings-menu="true"]') ||
            sidebarNav.querySelector('a[href="/settings/theme"]')) {
            return true;
        }

        var settingsItem = Array.from(sidebarNav.querySelectorAll('a')).find(function (a) {
            var text = (a.textContent || '').trim().toLowerCase();
            return text === 'pengaturan' || text.includes('pengaturan');
        });

        var button = document.createElement('a');
        button.href = '/settings/theme';
        button.className = 'nav-item';
        button.setAttribute('data-theme-settings-menu', 'true');
        button.title = 'Tema & Tampilan';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.innerHTML = '<i class="fa-solid fa-palette" style="color:#a78bfa;"></i><span>Tema & Tampilan</span>';

        // PENTING: tombol ditempatkan DI ATAS Pengaturan.
        if (settingsItem && settingsItem.parentNode) {
            settingsItem.parentNode.insertBefore(button, settingsItem);
        } else {
            sidebarNav.appendChild(button);
        }

        return true;
    }

    function init() {
        if (addThemeSettingsMenu()) return;

        var attempts = 0;
        var timer = setInterval(function () {
            if (addThemeSettingsMenu() || ++attempts >= 80) {
                clearInterval(timer);
            }
        }, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
