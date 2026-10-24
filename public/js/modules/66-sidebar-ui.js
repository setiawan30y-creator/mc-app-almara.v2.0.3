// @2026-Alifiandra
/* =====================================================================
 * 66-sidebar-ui.js  —  Pencarian menu & kemudahan sidebar
 *
 *  - Kolom "Cari menu": menyaring item sidebar, Enter membuka hasil pertama,
 *    Esc mengosongkan. Tekan "/" di mana saja (di luar kolom isian) untuk fokus.
 *  - Memberi atribut title pada tiap menu (tooltip saat sidebar diciutkan).
 *  - Menggulir item aktif agar terlihat di daftar.
 * Akordeon grup, warna grup dan hak akses tetap ditangani skrip inline di blade
 * dan 08-auth.js; modul ini tidak mengubahnya.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcSidebarUi) return;
    window.__mcSidebarUi = true;

    function $(s, r) { return (r || document).querySelector(s); }
    function all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
    function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

    var sidebar, input;

    function items() { return all('.sidebar-group-items .nav-item', sidebar); }
    function labelOf(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

    function titles() {
        items().forEach(function (el) { if (!el.getAttribute('title')) el.setAttribute('title', labelOf(el)); });
    }

    function isRbacHidden(el) {
        // Item disembunyikan hak akses (style inline) tidak boleh ikut dihitung sebagai hasil.
        return el.style && el.style.display === 'none';
    }

    function filter() {
        var q = norm(input.value), hits = 0;
        sidebar.classList.toggle('is-searching', !!q);
        items().forEach(function (el) {
            var show = !q || norm(labelOf(el)).indexOf(q) !== -1;
            el.classList.toggle('is-filtered', !show);
            if (show && !isRbacHidden(el)) hits++;
        });
        sidebar.classList.toggle('no-result', !!q && hits === 0);
        // Sembunyikan grup yang tidak punya hasil saat mencari.
        all('.sidebar-menu-group', sidebar).forEach(function (g) {
            var any = all('.sidebar-group-items .nav-item', g).some(function (el) { return !el.classList.contains('is-filtered') && !isRbacHidden(el); });
            g.classList.toggle('is-empty', !!q && !any);
        });
    }

    function firstVisible() {
        return items().filter(function (el) { return !el.classList.contains('is-filtered') && !isRbacHidden(el) && el.offsetParent !== null; })[0];
    }

    function build() {
        sidebar = $('#sidebar');
        if (!sidebar || $('.sb-search', sidebar)) return;
        var header = $('.sidebar-header', sidebar), nav = $('.sidebar-nav', sidebar);
        if (!header || !nav) return;

        var box = document.createElement('div');
        box.className = 'sb-search';
        box.innerHTML = '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>' +
            '<input id="sidebarSearch" type="search" placeholder="Cari menu" autocomplete="off" aria-label="Cari menu">' +
            '<kbd aria-hidden="true">/</kbd>';
        header.insertAdjacentElement('afterend', box);

        var empty = document.createElement('div');
        empty.className = 'sb-empty';
        empty.textContent = 'Menu tidak ditemukan.';
        nav.insertAdjacentElement('beforebegin', empty);

        input = $('input', box);
        input.addEventListener('input', filter);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { input.value = ''; filter(); input.blur(); }
            else if (e.key === 'Enter') { var f = firstVisible(); if (f) { e.preventDefault(); f.click(); input.value = ''; filter(); input.blur(); } }
        });
        // Setelah memilih menu, kosongkan pencarian agar daftar kembali utuh.
        nav.addEventListener('click', function (e) { if (e.target.closest('.nav-item') && input.value) { input.value = ''; filter(); } });

        document.addEventListener('keydown', function (e) {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            var t = e.target, tag = t && t.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
            if (document.body.classList.contains('sidebar-collapsed') && !document.body.classList.contains('mobile-mode')) return;
            e.preventDefault();
            if (document.body.classList.contains('mobile-mode')) sidebar.classList.add('open');
            input.focus();
        });
    }

    function keepActiveVisible() {
        var a = $('.sidebar-nav .nav-item.active', sidebar);
        if (a && a.offsetParent !== null) { try { a.scrollIntoView({ block: 'nearest' }); } catch (e) { /* abaikan */ } }
    }

    function init() {
        build();
        if (!sidebar) return;
        titles();
        var nav = $('.sidebar-nav', sidebar), t = null;
        if (nav) {
            new MutationObserver(function (list) {
                // Hanya bila sebuah menu BARU menjadi aktif (bukan saat grup dibuka/ditutup atau disaring).
                var changed = list.some(function (m) {
                    return m.target.classList && m.target.classList.contains('nav-item') &&
                        m.target.classList.contains('active') && String(m.oldValue || '').indexOf('active') === -1;
                });
                if (!changed) return;
                clearTimeout(t);
                t = setTimeout(keepActiveVisible, 120);
            }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
        }
        setTimeout(keepActiveVisible, 300);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
    else setTimeout(init, 500);
})();
