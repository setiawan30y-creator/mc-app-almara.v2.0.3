// Kill-switch: PWA dinonaktifkan. Service worker ini menghapus dirinya dan semua cache.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll(); })
      .then(function (clients) { clients.forEach(function (c) { /* tidak reload otomatis */ }); })
  );
});
// Tidak ada handler fetch: semua permintaan langsung ke jaringan.
