// Transaksi/POS: pilih hasil pencarian dengan keyboard @2026-Alifiandra
// Berlaku untuk "Cari nasabah" dan "Cari valas":
//   ketik → Tab (atau ↓) = fokus ke hasil paling atas → ↓/↑/Tab pindah → Enter = pilih.
//   Enter langsung di kolom cari = pilih hasil paling atas. Esc = tutup daftar.
(function () {
    'use strict';

    const FIELDS = [
        { input: 'posCustomerSearchModern', list: 'posCustomerResultsModern', item: ':scope > div[onclick]', next: null },
        { input: 'posValasSearchModern', list: 'posValasListModern', item: '.pos-valas-item-modern', next: 'trxAmount' }
    ];
    const $ = (id) => document.getElementById(id);

    function injectStyle() {
        if ($('pk-style')) return;
        const st = document.createElement('style');
        st.id = 'pk-style';
        st.textContent = `
        #posCustomerResultsModern > div[onclick].pk-active, #posValasListModern .pos-valas-item-modern.pk-active {
            background: rgba(59,130,246,.14) !important; outline: 2px solid #3b82f6; outline-offset: -2px; }
        #posCustomerResultsModern > div[onclick]:focus, #posValasListModern .pos-valas-item-modern:focus { outline: 2px solid #3b82f6; outline-offset: -2px; }`;
        document.head.appendChild(st);
    }

    const fieldOfInput = (el) => FIELDS.find((f) => el && el.id === f.input);
    const fieldOfItem = (el) => FIELDS.find((f) => { const l = $(f.list); return l && el && l.contains(el); });
    const listOpen = (f) => { const l = $(f.list); return !!l && !l.classList.contains('hidden') && l.offsetParent !== null; };
    const items = (f) => { const l = $(f.list); return l ? Array.from(l.querySelectorAll(f.item)) : []; };

    function activate(f, index) {
        const list = items(f);
        if (!list.length) return false;
        const i = Math.max(0, Math.min(index, list.length - 1));
        list.forEach((el, n) => { el.classList.toggle('pk-active', n === i); el.tabIndex = -1; });
        list[i].focus({ preventScroll: true });
        list[i].scrollIntoView({ block: 'nearest' });
        return true;
    }

    function choose(f, el) {
        if (!el) return;
        el.click(); // memakai fungsi pilih bawaan (selectPosCustomerModern / selectPosValasModern)
        setTimeout(() => {
            const next = f.next && $(f.next);
            if (next) { next.focus(); if (next.select) next.select(); }
            else { const inp = $(f.input); if (inp) inp.blur(); }
        }, 30);
    }

    document.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        // Di kolom cari
        const fi = fieldOfInput(e.target);
        if (fi) {
            if (fi.input === 'posValasSearchModern' && !listOpen(fi) && (e.key === 'ArrowDown' || e.key === 'Enter') && typeof window.openPosValasDropdown === 'function') {
                window.openPosValasDropdown();
            }
            if (!listOpen(fi) || !items(fi).length) return;
            if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
                e.preventDefault();
                activate(fi, 0);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(fi, items(fi)[0]);
            } else if (e.key === 'Escape') {
                const l = $(fi.list); if (l) l.classList.add('hidden');
            }
            return;
        }

        // Di salah satu hasil
        const ft = fieldOfItem(e.target);
        if (!ft) return;
        const list = items(ft);
        const i = list.findIndex((el) => el === e.target || el.contains(e.target));
        if (i < 0) return;
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            if (i < list.length - 1) activate(ft, i + 1);
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            if (i > 0) activate(ft, i - 1);
            else { list.forEach((el) => el.classList.remove('pk-active')); const inp = $(ft.input); if (inp) inp.focus(); }
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choose(ft, list[i]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            const l = $(ft.list); if (l) l.classList.add('hidden');
            const inp = $(ft.input); if (inp) inp.focus();
        }
    }, true);

    // Daftar dirender ulang saat mengetik: tandai hasil teratas sebagai pilihan Enter.
    document.addEventListener('input', (e) => {
        const f = fieldOfInput(e.target); if (!f) return;
        setTimeout(() => { const list = items(f); list.forEach((el, n) => el.classList.toggle('pk-active', n === 0)); }, 0);
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyle); else injectStyle();
})();
