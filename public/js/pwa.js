(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var deferredPrompt = null;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var installButton = null;
  var updateButton = null;

  function makeButton(id, text, icon) {
    var btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + text;
    btn.style.cssText = [
      'position:fixed','right:18px','bottom:18px','z-index:99998',
      'border:1px solid rgba(255,255,255,.12)','border-radius:12px',
      'padding:10px 14px','background:#047857','color:#fff',
      'font-weight:700','font-size:13px','cursor:pointer',
      'box-shadow:0 10px 30px rgba(0,0,0,.22)'
    ].join(';');
    document.body.appendChild(btn);
    return btn;
  }

  function showInstallButton() {
    if (!installButton) installButton = makeButton('almaraPwaInstall', 'Install App', 'fa-download');
    installButton.style.display = 'block';
  }

  function hideInstallButton() {
    if (installButton) installButton.style.display = 'none';
  }

  function showUpdateButton(registration) {
    if (!updateButton) updateButton = makeButton('almaraPwaUpdate', 'Update App', 'fa-arrows-rotate');
    updateButton.onclick = function () {
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      updateButton.style.display = 'none';
    };
    updateButton.style.bottom = '68px';
    updateButton.style.display = 'block';
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone) showInstallButton();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideInstallButton();
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest || !event.target.closest('#almaraPwaInstall')) return;
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      hideInstallButton();
    });
  });

  navigator.serviceWorker.register('/sw.js?v=1.0.3', { scope: '/' })
    .then(function (registration) {
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateButton(registration);
          }
        });
      });
    })
    .catch(function (error) {
      console.warn('[MC Almara PWA] Service Worker gagal didaftarkan:', error);
    });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (window.__almaraPwaReloading) return;
    window.__almaraPwaReloading = true;
    window.location.reload();
  });
})();
