// @2026-Alifiandra
/* Nama perusahaan di header sidebar mengikuti Profil Perusahaan. */
(function () {
    'use strict';
    function apply() {
        var el = document.getElementById('sidebarBrandName');
        if (!el) return false;
        var name = '';
        try {
            var p = JSON.parse(localStorage.getItem('mc_profile') || '{}');
            name = String((p && p.name) || '').trim();
        } catch (e) {}
        if (name && name !== 'Money Changer') {
            if (el.textContent !== name) el.textContent = name;
            el.title = name;
            var img = document.querySelector('.almara-sidebar-logo-wrap img');
            if (img) img.alt = 'Logo ' + name;
        }
        return true;
    }
    var n = 0;
    var t = setInterval(function () { apply(); if (++n > 40) clearInterval(t); }, 500);
    window.addEventListener('storage', function (e) { if (e.key === 'mc_profile') apply(); });
    var save = window.saveProfile;
    if (typeof save === 'function') {
        window.saveProfile = function () { var r = save.apply(this, arguments); apply(); return r; };
    }
    if (document.readyState !== 'loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
})();
