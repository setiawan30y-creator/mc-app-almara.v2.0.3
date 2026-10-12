(function () {
    'use strict';

    function addThemeSettingsButton() {
        var nav = document.querySelector('.sidebar nav');
        if (!nav) return false;

        if (nav.querySelector('a[href="/settings/theme"]')) return true;

        var settingsItem = nav.querySelector('a[data-target="settings-view"]');
        var button = document.createElement('a');
        button.href = '/settings/theme';
        button.className = 'nav-item';
        button.setAttribute('data-theme-settings-link', 'true');
        button.innerHTML = '<i class="fa-solid fa-palette"></i> Tema & Tampilan';

        if (settingsItem && settingsItem.parentNode) {
            settingsItem.parentNode.insertBefore(button, settingsItem.nextSibling);
        } else {
            nav.appendChild(button);
        }

        return true;
    }

    function init() {
        if (addThemeSettingsButton()) return;

        var observer = new MutationObserver(function () {
            if (addThemeSettingsButton()) observer.disconnect();
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(function () { observer.disconnect(); }, 10000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
