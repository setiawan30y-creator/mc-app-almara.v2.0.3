// @2026-Alifiandra
/* =====================================================================
 * 64-mobile-focus.js  —  Perilaku kolom isian di HP (gaya aplikasi Flutter)
 *
 * Saat pengguna mengetuk kolom isian di layar HP:
 *  - kolom yang diketik membesar sedikit (zoom lembut), berbingkai warna utama
 *    dan terangkat dengan bayangan, sehingga jelas mana yang sedang diisi;
 *  - halaman otomatis menggulir agar kolom itu berada di atas keyboard;
 *  - menu bawah disembunyikan selama keyboard terbuka supaya tidak menutupi kolom;
 *  - di iOS ukuran huruf kolom dijaga 16px agar browser tidak melakukan zoom sendiri.
 * Berlaku untuk semua halaman dan dialog, tanpa mengubah fungsi kolomnya.
 * Aktif di mode HP (body.mobile-mode) atau layar <= 768px.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcMobileFocus) return;
    window.__mcMobileFocus = true;

    var SKIP = { checkbox: 1, radio: 1, range: 1, file: 1, button: 1, submit: 1, reset: 1, image: 1, color: 1, hidden: 1 };
    var GROUP = '.form-group, .input-group, .ast-f, .hr-f, .dc-f, .ln-f, .aic-row, .trc-type, label';
    var active = null, group = null, baseH = window.innerHeight, kbOpen = false, timer = null;
    var vv = window.visualViewport || null;

    function isField(el) {
        if (!el || !el.tagName) return false;
        var t = el.tagName;
        if (t === 'TEXTAREA' || t === 'SELECT') return !el.disabled && !el.readOnly;
        if (t !== 'INPUT') return false;
        return !SKIP[(el.type || 'text').toLowerCase()] && !el.disabled && !el.readOnly;
    }
    function isMobile() { return document.body.classList.contains('mobile-mode') || (window.matchMedia && window.matchMedia('(max-width:768px)').matches); }

    function style() {
        if (document.getElementById('mc-mf-style')) return;
        var s = document.createElement('style'); s.id = 'mc-mf-style';
        s.textContent = [
            '.mc-mf-group{transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s ease;transform-origin:left center}',
            'body.mc-mf-on .mc-mf-group.mc-mf-live{transform:scale(1.03);position:relative;z-index:5}',
            'body.mc-mf-on .mc-mf-field{border-color:var(--mc-primary,#1D6C5D) !important;border-radius:12px !important;outline:none !important;',
            'box-shadow:0 0 0 3px color-mix(in srgb,var(--mc-primary,#1D6C5D) 26%,transparent),0 10px 24px rgba(15,23,42,.14) !important;background-color:var(--mc-input-bg,#fff)}',
            'body.mc-mf-on .mc-mf-live > label,body.mc-mf-on .mc-mf-live > .ast-f label{color:var(--mc-primary,#1D6C5D) !important}',
            'body.mc-kb-open .mobile-bottom-nav{display:none !important}',
            '@supports (-webkit-touch-callout:none){body.mc-mf-on input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),body.mc-mf-on select,body.mc-mf-on textarea{font-size:16px !important}}',
            '@media (prefers-reduced-motion:reduce){.mc-mf-group{transition:none}body.mc-mf-on .mc-mf-group.mc-mf-live{transform:none}}'
        ].join('\n');
        document.head.appendChild(s);
    }

    function clear() {
        if (active) active.classList.remove('mc-mf-field');
        if (group) group.classList.remove('mc-mf-live');
        active = null; group = null;
    }
    function reveal(el, smooth) {
        if (!el || !el.isConnected) return;
        var h = vv ? vv.height : window.innerHeight, top = vv ? vv.offsetTop : 0, r = el.getBoundingClientRect();
        var pad = 24, below = r.bottom > top + h - pad, above = r.top < top + pad;
        if (!below && !above && !smooth) return;
        try { el.scrollIntoView({ block: h < 420 ? 'start' : 'center', inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' }); } catch (e) { el.scrollIntoView(); }
    }
    function updateKeyboard() {
        if (!isMobile()) { document.body.classList.remove('mc-kb-open'); kbOpen = false; return; }
        var h = vv ? vv.height : window.innerHeight; baseH = Math.max(baseH, window.innerHeight);
        var kb = Math.max(0, baseH - h - (vv ? vv.offsetTop : 0)), open = kb > 120 && !!active;
        if (open !== kbOpen) { kbOpen = open; document.body.classList.toggle('mc-kb-open', open); }
        if (open && active) reveal(active, false);
    }

    document.addEventListener('focusin', function (e) {
        var el = e.target; if (!isField(el) || !isMobile()) return;
        style(); document.body.classList.add('mc-mf-on'); clearTimeout(timer);
        if (active !== el) clear();
        active = el; el.classList.add('mc-mf-field');
        var g = el.closest(GROUP); if (g && g !== el && g.querySelectorAll('input,textarea,select').length <= 2) { group = g; g.classList.add('mc-mf-group', 'mc-mf-live'); }
        // Tunggu animasi keyboard selesai, lalu gulirkan kolom ke area yang terlihat.
        setTimeout(function () { reveal(el, true); updateKeyboard(); }, 280);
    }, true);
    document.addEventListener('focusout', function (e) {
        if (!isField(e.target)) return;
        timer = setTimeout(function () {
            if (active && document.activeElement !== active) { clear(); document.body.classList.remove('mc-mf-on', 'mc-kb-open'); kbOpen = false; }
        }, 120);
    }, true);

    if (vv) { vv.addEventListener('resize', updateKeyboard); vv.addEventListener('scroll', function () { if (kbOpen && active) reveal(active, false); }); }
    window.addEventListener('resize', updateKeyboard);
    window.addEventListener('orientationchange', function () { setTimeout(function () { baseH = window.innerHeight; updateKeyboard(); }, 300); });
})();
