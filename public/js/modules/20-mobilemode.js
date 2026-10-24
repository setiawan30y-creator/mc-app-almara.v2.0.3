// @2026-Alifiandra
/* =====================================================================
 * MODULE 20: MODE TAMPILAN HP (gaya aplikasi Flutter / Material)
 *
 * - Menyalakan body.mobile-mode otomatis di HP / layar <= 768px (bisa diubah
 *   lewat tombol di header, disimpan di localStorage 'mc_mobileModeEnabled').
 * - Membuat menu bawah (Navigation Bar) dan tirai (scrim) untuk laci menu.
 * - Laci menu menutup saat tirai/tombol Esc/menu dipilih.
 * Seluruh tampilan ada di css/mobile-app.css. Isian yang diketik di-zoom
 * oleh 64-mobile-focus.js.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcMobileMode) return;
    window.__mcMobileMode = true;

    var KEY = 'mc_mobileModeEnabled';
    var NAV = [
        { target: 'dashboard-view',  icon: 'fa-chart-pie',     label: 'Home' },
        { target: 'pos-view',        icon: 'fa-cash-register', label: 'POS' },
        { target: 'user-chat-view',  icon: 'fa-comments',      label: 'Chat' },
        { target: 'translator-view', icon: 'fa-language',      label: 'Translator' },
        { target: 'sidebar-menu',    icon: 'fa-bars',          label: 'Lainnya' }
    ];
    var enabled = false;

    function $(id) { return document.getElementById(id); }
    function store(get, val) {
        try { return get ? localStorage.getItem(KEY) : localStorage.setItem(KEY, val); } catch (e) { return null; }
    }
    function detect() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    }

    /* ---------- Sidebar (laci) ---------- */
    function sidebar() { return $('sidebar'); }
    function scrim() {
        var s = $('mScrim');
        if (!s) {
            s = document.createElement('div');
            s.id = 'mScrim'; s.className = 'm-scrim';
            s.addEventListener('click', closeDrawer);
            document.body.appendChild(s);
        }
        return s;
    }
    function syncScrim() {
        var sb = sidebar(), open = !!(sb && sb.classList.contains('open') && document.body.classList.contains('mobile-mode'));
        scrim().classList.toggle('show', open);
    }
    function openDrawer() { var sb = sidebar(); if (sb) { sb.classList.add('open'); syncScrim(); } }
    function closeDrawer() { var sb = sidebar(); if (sb) { sb.classList.remove('open'); syncScrim(); } }

    /* ---------- Markup ---------- */
    function injectHeaderToggle() {
        var right = document.querySelector('.top-header .header-right');
        if (!right || $('headerMobileToggleBtn')) return;
        var b = document.createElement('button');
        b.type = 'button'; b.id = 'headerMobileToggleBtn'; b.className = 'header-mobile-toggle';
        b.style.cssText = 'cursor:pointer;margin-left:16px;font-size:1.2rem;color:#94A3B8;background:none;border:0;display:flex;align-items:center;justify-content:center';
        b.addEventListener('click', function () { window.toggleMobileMode(); });
        right.appendChild(b);
    }
    function injectBottomNav() {
        var host = $('appContainer');
        if (!host || document.querySelector('.mobile-bottom-nav')) return;
        var nav = document.createElement('nav');
        nav.className = 'mobile-bottom-nav';
        nav.setAttribute('aria-label', 'Menu utama');
        nav.innerHTML = NAV.map(function (n, i) {
            return '<a href="#" class="mobile-bottom-nav-item' + (i === 0 ? ' active' : '') + '" data-target="' + n.target + '">' +
                '<i class="fa-solid ' + n.icon + '"></i><span>' + n.label + '</span></a>';
        }).join('');
        nav.addEventListener('click', function (e) {
            var item = e.target.closest('.mobile-bottom-nav-item');
            if (!item) return;
            e.preventDefault();
            var target = item.getAttribute('data-target');
            if (target === 'sidebar-menu') { openDrawer(); return; }
            var link = document.querySelector('.nav-item[data-target="' + target + '"]');
            if (link) link.click();
        });
        host.appendChild(nav);
    }

    /* ---------- Status ---------- */
    function toggleLook() {
        var btn = $('headerMobileToggleBtn');
        if (!btn) return;
        btn.innerHTML = '<i class="fa-solid ' + (enabled ? 'fa-desktop' : 'fa-mobile-screen-button') + '"></i>';
        btn.title = enabled ? 'Ubah ke Tampilan Desktop' : 'Ubah ke Tampilan Mobile';
        btn.setAttribute('aria-label', btn.title);
        btn.style.color = enabled ? 'var(--mc-primary,#1D6C5D)' : '';
    }
    function apply() {
        document.body.classList.toggle('mobile-mode', enabled);
        if (enabled) closeDrawer(); else syncScrim();
        toggleLook();
        window.dispatchEvent(new Event('resize'));
    }

    window.toggleMobileMode = function () {
        enabled = !enabled;
        store(false, String(enabled));
        apply();
        if (window.Swal && typeof Swal.fire === 'function') {
            Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1800, icon: 'success',
                title: enabled ? 'Tampilan Mobile aktif' : 'Tampilan Desktop aktif' });
        }
    };

    /* ---------- Menu bawah mengikuti halaman aktif ---------- */
    function syncActive() {
        var sec = document.querySelector('.view-section.active');
        if (!sec) return;
        var id = sec.id;
        document.querySelectorAll('.mobile-bottom-nav-item').forEach(function (it) {
            it.classList.toggle('active', it.getAttribute('data-target') === id);
        });
        if (document.body.classList.contains('mobile-mode')) closeDrawer();
    }
    function observeViews() {
        var mo = new MutationObserver(syncActive);
        document.querySelectorAll('.view-section').forEach(function (s) {
            mo.observe(s, { attributes: true, attributeFilter: ['class'] });
        });
        syncActive();
    }

    function init() {
        injectHeaderToggle();
        injectBottomNav();
        var saved = store(true);
        enabled = saved !== null ? saved === 'true' : detect();
        apply();
        observeViews();
        var sb = sidebar();
        if (sb) new MutationObserver(syncScrim).observe(sb, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    }
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', function () { setTimeout(init, 700); });
    else setTimeout(init, 700);
})();

/* Mesin tema global: dimuat bila belum ada di halaman. */
(function () {
    function load() {
        if (window.MCTheme || document.getElementById('mcGlobalThemeEngine')) return;
        var s = document.createElement('script');
        s.id = 'mcGlobalThemeEngine';
        s.src = '/js/mc-theme-engine.js?v=20261014-1';
        s.onload = function () { if (window.MCTheme) window.MCTheme.apply(window.MCTheme.load(), false); };
        s.onerror = function () { console.warn('Mesin tema global gagal dimuat; tema bawaan dipakai.'); };
        document.head.appendChild(s);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
    else load();
})();
