// @2026-Alifiandra
/* =====================================================================
 * 65-dashboard-ui.js  —  Sapaan & tanggal pada banner Dashboard
 * Hanya mengisi teks banner (#dshGreeting, #dshHeroDate). Angka, grafik dan
 * daftar tetap dikerjakan 02-dashboard.js dan 30-dashboard-analytics.js.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcDashboardUi) return;
    window.__mcDashboardUi = true;

    var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    function $(id) { return document.getElementById(id); }
    function longDate(d) { return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
    function part(h) { return h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 19 ? 'sore' : 'malam'; }
    function userName() {
        try {
            var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : JSON.parse(localStorage.getItem('mc_currentUser') || 'null');
            var n = u && (u.name || u.fullName || u.full_name || u.username);
            return n ? String(n).trim().split(/\s+/)[0] : '';
        } catch (e) { return ''; }
    }
    function refresh() {
        var greet = $('dshGreeting'), dateEl = $('dshHeroDate');
        if (!greet || !dateEl) return;
        var now = new Date(), name = userName();
        greet.textContent = 'Selamat ' + part(now.getHours()) + (name ? ', ' + name : '');
        var f = $('dashDateFilter'), v = f && f.value;
        if (v) {
            var p = v.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
            dateEl.textContent = 'Tinjauan ' + longDate(d);
        } else {
            dateEl.textContent = 'Hari ini · ' + longDate(now);
        }
    }
    function later() { setTimeout(refresh, 60); }

    document.addEventListener('change', function (e) { if (e.target && e.target.id === 'dashDateFilter') refresh(); });
    document.addEventListener('click', function (e) {
        if (e.target.closest && (e.target.closest('#dashboard-view .dsh-btn') || e.target.closest('[data-target="dashboard-view"]'))) later();
    });
    setInterval(refresh, 60000);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(refresh, 400); });
    else setTimeout(refresh, 400);
})();
