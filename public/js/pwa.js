// PWA dinonaktifkan. File ini hanya membersihkan service worker & cache lama
// (supaya tidak ada sisa dari versi sebelumnya yang menimpa sesi/cookie atau memuat ulang halaman).
(function () {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations()
    .then(function (regs) { regs.forEach(function (r) { r.unregister(); }); })
    .catch(function () {});
  if (window.caches && caches.keys) {
    caches.keys()
      .then(function (keys) { keys.forEach(function (k) { if (/^mc-almara-pwa/.test(k)) caches.delete(k); }); })
      .catch(function () {});
  }
})();
