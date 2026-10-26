<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="author" content="&#64;2026-Alifiandra">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#047857">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="MC Almara">
    <link rel="apple-touch-icon" href="{{ asset('favicon.png') }}">
    @php
        $faviconPath = public_path('favicon.png');
    @endphp
    <link rel="icon" href="{{ file_exists($faviconPath) ? asset('favicon.png') . '?v=' . filemtime($faviconPath) : asset('favicon.ico') }}" type="image/png">
    <title>MC-ALMARA | Aplikasi Money Changer</title>
    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- SheetJS (Excel Export) -->
    <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <script src="https://npmcdn.com/flatpickr/dist/l10n/id.js"></script>
    <script>
        // Error handler - log only, don't destroy the page
        window._jsErrors = [];
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            console.error('JS ERROR:', msg, 'at', url, 'line', lineNo);
            window._jsErrors.push({msg, url, lineNo, error: error ? error.stack : ''});
            return true; // suppress red screen
        };

        // Pencatat & pemutus loop muat ulang (diagnostik). Lihat: sessionStorage 'mc_reload_log'.
        window.mcSafeReload = function(reason) {
            try {
                var log = JSON.parse(sessionStorage.getItem('mc_reload_log') || '[]');
                log.push({ t: Date.now(), reason: reason, url: location.href });
                log = log.slice(-30);
                sessionStorage.setItem('mc_reload_log', JSON.stringify(log));
                var recent = log.filter(function(x) { return x.reason !== 'unload' && Date.now() - x.t < 15000; }).length;
                if (recent >= 4) { console.error('[MC] Loop muat ulang dihentikan. Log:', log); window.__mcReloadBlocked = true; return; }
            } catch (e) {}
            window.location.reload();
        };
        window.addEventListener('beforeunload', function() {
            try {
                var log = JSON.parse(sessionStorage.getItem('mc_reload_log') || '[]');
                log.push({ t: Date.now(), reason: 'unload', url: location.href });
                sessionStorage.setItem('mc_reload_log', JSON.stringify(log.slice(-30)));
            } catch (e) {}
        });

        window.getCsrfToken = function() {
            var meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : '';
        };

        window.setCsrfToken = function(token) {
            var meta = document.querySelector('meta[name="csrf-token"]');
            if(meta && token) meta.setAttribute('content', token);
        };

        window.authFetch = function(url, options) {
            options = options || {};
            var headers = Object.assign({
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': window.getCsrfToken()
            }, options.headers || {});
            return fetch(url, Object.assign({ credentials: 'same-origin' }, options, { headers: headers }));
        };

        window.isHandlingSingleSessionConflict = false;

        function clearLocalAuthState() {
            try { localStorage.removeItem('mc_currentUser'); } catch (e) {}
            try { sessionStorage.removeItem('mc_currentUser_password'); } catch (e) {}
        }

        async function handleSingleSessionConflict(message, title) {
            if (window.isHandlingSingleSessionConflict) return;
            window.isHandlingSingleSessionConflict = true;
            clearLocalAuthState();

            var text = message || 'Akun ini sudah dipakai di perangkat lain. Silakan login ulang.';
            try {
                if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
                    await Swal.fire({
                        icon: 'warning',
                        title: title || 'Sesi Dipindah',
                        text: text,
                        timer: 1800,
                        showConfirmButton: false,
                        background: '#1e293b',
                        color: '#f8fafc'
                    });
                } else {
                    alert(text);
                }
            } catch (e) {}

            window.mcSafeReload('single-session-conflict');
        }

        // Global manual re-auth / logout confirm
        window.forceSessionLogout = function() {
            if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
                Swal.fire({
                    title: 'Hubungkan Kembali?',
                    text: 'Apakah Anda ingin memuat ulang halaman untuk masuk (login) kembali ke server?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#3b82f6',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Ya, Login Kembali',
                    cancelButtonText: 'Batal',
                    background: '#1e293b',
                    color: '#f8fafc'
                }).then(function(res) {
                    if (res.isConfirmed) {
                        localStorage.removeItem('mc_currentUser');
                        sessionStorage.removeItem('mc_currentUser_password');
                        window.location.reload();
                    }
                });
            } else {
                if (confirm('Apakah Anda ingin memuat ulang halaman untuk masuk (login) kembali ke server?')) {
                    localStorage.removeItem('mc_currentUser');
                    sessionStorage.removeItem('mc_currentUser_password');
                    window.location.reload();
                }
            }
        };

        var nativeFetch = window.fetch.bind(window);
        (function() {
            window.fetch = async function(resource, options) {
                options = options || {};
                var method = String(options.method || 'GET').toUpperCase();
                var url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
                var isSameOriginApi = !/^https?:\/\//i.test(url) || url.indexOf(window.location.origin) === 0;
                if (isSameOriginApi) {
                    options.credentials = options.credentials || 'same-origin';
                    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
                        options.headers = Object.assign({
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-TOKEN': window.getCsrfToken()
                        }, options.headers || {});
                    }
                }
                
                try {
                    // Belum login: jangan panggil API (mencegah sesi/cookie ditimpa oleh polling otomatis).
                    if (isSameOriginApi && !window.__MC_DEV_BYPASS) {
                        var _p = '';
                        try { _p = new URL(url, window.location.origin).pathname; } catch (e) {}
                        if (/^\/api\//.test(_p) && !/^\/api\/public\//.test(_p) && !localStorage.getItem('mc_currentUser')) {
                            return new Response(JSON.stringify({ status: 'error', message: 'Unauthenticated.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
                        }
                    }
                    var response = await nativeFetch(resource, options);
                    if (isSameOriginApi && response.status === 423) {
                        var conflictMessage = 'Akun ini sudah dipakai di perangkat lain. Silakan login ulang.';
                        try {
                            var conflictClone = response.clone();
                            var conflictResult = await conflictClone.json().catch(function() { return {}; });
                            if (conflictResult && conflictResult.message) {
                                conflictMessage = conflictResult.message;
                            }
                        } catch (e) {}
                        handleSingleSessionConflict(conflictMessage);
                        return response;
                    }
                    if (isSameOriginApi && response.status === 401) {
                        var hasLocalUser = localStorage.getItem('mc_currentUser');
                        if (hasLocalUser) {
                            // Tidak ada login ulang otomatis (password tidak disimpan di browser).
                            // Mode dev bypass menyuntik login admin di setiap muat ulang; jangan redirect (bisa loop).
                            if (!window.__MC_DEV_BYPASS) {
                                var authCode = '';
                                try {
                                    var authBody = await response.clone().json().catch(function() { return {}; });
                                    authCode = (authBody && authBody.code) || '';
                                } catch (e) {}
                                if (authCode === 'session_idle_timeout') {
                                    handleSingleSessionConflict('Sesi berakhir karena tidak ada aktivitas. Silakan login kembali.', 'Sesi Berakhir');
                                } else if (authCode === 'single_session_conflict') {
                                    handleSingleSessionConflict('Akun ini sedang dipakai di perangkat lain. Silakan login kembali.', 'Sesi Dipindah');
                                } else {
                                    handleSingleSessionConflict('Sesi login berakhir. Silakan login kembali.', 'Sesi Berakhir');
                                }
                                return response;
                            }

                            // Mode dev bypass: tampilkan pemberitahuan sekali, tanpa redirect
                            if (!window.isHandlingSessionExpiry && !window.sessionExpiredAcknowledged) {
                                window.isHandlingSessionExpiry = true;
                                
                                if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
                                    Swal.fire({
                                        icon: 'warning',
                                        title: 'Sesi Berakhir',
                                        text: 'Sesi login Anda di server telah berakhir atau tidak valid. Silakan klik Lanjut untuk terus menggunakan aplikasi.',
                                        background: '#1e293b',
                                        color: '#f8fafc',
                                        confirmButtonColor: '#3b82f6',
                                        confirmButtonText: 'Lanjut'
                                    }).then(function() {
                                        window.isHandlingSessionExpiry = false;
                                        window.sessionExpiredAcknowledged = true;
                                        
                                        // Tampilkan indikator offline di header
                                        var ind = document.getElementById('connectionStatusIndicator');
                                        if (ind) ind.style.display = 'flex';
                                    });
                                } else {
                                    alert('Sesi login Anda di server telah berakhir atau tidak valid. Silakan klik OK untuk terus menggunakan aplikasi.');
                                    window.isHandlingSessionExpiry = false;
                                    window.sessionExpiredAcknowledged = true;
                                    var ind = document.getElementById('connectionStatusIndicator');
                                    if (ind) ind.style.display = 'flex';
                                }
                            }
                        }
                    }
                    return response;
                } catch (err) {
                    throw err;
                }
            };
        })();

        // Inline login function - available even if later modules fail
        async function handleAuthLogin() {
            var un = document.getElementById('loginUsername').value.trim();
            var pw = document.getElementById('loginPassword').value;
            var errorEl = document.getElementById('loginError');

            if(!un || !pw) {
                errorEl.textContent = 'Username dan Password wajib diisi!';
                errorEl.style.display = 'block';
                return;
            }

            try {
                var response = await window.authFetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: un, password: pw })
                });
                var result = await response.json().catch(function() { return {}; });
                if(!response.ok || !result.user) {
                    throw new Error(result.message || 'Username atau password salah!');
                }
                var user = result.user;
                if(result.csrfToken) window.setCsrfToken(result.csrfToken);
                localStorage.setItem('mc_currentUser', JSON.stringify(user));
                try { sessionStorage.removeItem('mc_currentUser_password'); } catch(e) {}
                localStorage.setItem('mc_last_login_at', String(Date.now()));
                errorEl.style.display = 'none';
                if (String(user.role || '').toLowerCase() === 'papan') {
                    window.location.href = '/papan-kurs';
                    return;
                }
                var btn = document.getElementById('theLoginBtn');
                if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';

                if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
                    Swal.fire({ icon: 'success', title: 'Selamat Datang, ' + user.fullName, timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#f8fafc' });
                }
                if (typeof checkAuth === 'function') checkAuth();
                else {
                    var loginEl = document.getElementById('loginContainer');
                    var appEl = document.getElementById('appContainer');
                    if(loginEl) loginEl.style.display = 'none';
                    if(appEl) appEl.style.display = 'flex';
                }
            } catch(error) {
                errorEl.textContent = error.message || 'Username atau password salah!';
                errorEl.style.display = 'block';
            }
        }
        window.handleAuthLogin = handleAuthLogin;
    </script>
    <!-- SweetAlert2 (Modern Notification) -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <!-- Select2 for Searchable Dropdowns -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <link rel="stylesheet" href="{{ asset('css/styles.css?v=' . time()) }}">
    <link rel="stylesheet" href="{{ asset('css/apv-theme.css?v=' . time()) }}" id="apvThemeCSS">
    <!-- Global MC-Almara Theme Engine -->
    <script src="{{ asset('js/mc-theme-engine.js?v=20261024-1') }}"></script>
    <link rel="stylesheet" href="{{ asset('css/business-ui.css?v=' . time()) }}">
    <link rel="stylesheet" href="{{ asset('css/dashboard-modern.css?v=' . time()) }}">
    <link rel="stylesheet" href="{{ asset('css/sidebar-modern.css?v=' . time()) }}">
    <link rel="stylesheet" href="{{ asset('css/sipesat-modern.css?v=' . time()) }}">
    <link rel="stylesheet" href="{{ asset('css/pt-reps.css?v=' . time()) }}">
    <link rel="stylesheet" href="{{ asset('css/mobile-app.css?v=' . time()) }}">
    </head>

<body>
    <script>
        // Apply the saved theme before any application UI is parsed. This avoids
        // the dark-theme flash while the deferred theme switcher initializes.
        (function () {
            try {
                var storedTheme = localStorage.getItem('mc_app_theme');
                var initialTheme = (!storedTheme || storedTheme === 'dark') ? 'apv' : storedTheme;
                if (initialTheme === 'apv') document.body.classList.add('apv-theme');
                if (initialTheme === 'light') document.body.classList.add('light-theme');
            } catch (e) {
                document.body.classList.add('apv-theme');
            }
        })();
    </script>
    <!-- Floating Visual Error Logger for debugging -->
    <div id="visual-error-logger" style="position:fixed; top:0; left:0; width:100%; max-height:150px; overflow-y:auto; background:rgba(239, 68, 68, 0.95); color:white; z-index:9999999; font-family:monospace; font-size:12px; padding:10px; box-sizing:border-box; display:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.3); padding-bottom:4px; margin-bottom:6px;">
            <span>JS RUNTIME ERRORS</span>
            <button onclick="document.getElementById('visual-error-logger').style.display='none'" style="background:none; border:none; color:white; cursor:pointer; font-weight:bold;">Tutup</button>
        </div>
        <div id="visual-error-list">Tidak ada error terdeteksi.</div>
    </div>
    <script>
        // Pencatat error tampilan. Peringatan jinak peramban (ResizeObserver) diabaikan.
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            var text = String(msg || '');
            if (/ResizeObserver loop/i.test(text)) { return true; }
            var logger = document.getElementById('visual-error-logger');
            var list = document.getElementById('visual-error-list');
            if (logger && list) {
                logger.style.display = 'block';
                if (list.innerHTML.indexOf('Tidak ada error') === 0) {
                    list.innerHTML = '';
                }
                var fileName = url ? url.split('/').pop() : 'inline';
                var div = document.createElement('div');
                var strong = document.createElement('strong');
                strong.textContent = text;
                div.appendChild(document.createTextNode('\u2022 '));
                div.appendChild(strong);
                div.appendChild(document.createTextNode(' (' + fileName + ':' + lineNo + ')'));
                list.appendChild(div);
            }
            return false;
        };
        
        // Immediately determine if user is logged in BEFORE any rendering
        var _isLoggedIn = false;
        try {
            var _u = JSON.parse(localStorage.getItem('mc_currentUser'));
            if(_u && _u.username) _isLoggedIn = true;
        } catch(e) {}
        
    </script>

    <!-- Login Screen -->
    <div class="login-container" id="loginContainer">
        <script>
            if(_isLoggedIn) document.getElementById('loginContainer').style.display = 'none';
        </script>
        <div class="login-box panel">
            
            <div class="text-center mb-4">
                <img src="{{ asset('img/logo-almara.png') }}" alt="Logo Almara Putra Valasindo" style="height: 120px; object-fit: contain; margin-bottom: 15px;">
                <h2 class="mt-2">ALMARA PUTRA VALASINDO</h2>
                <p class="text-muted" style="margin-bottom: 2px; font-size: 1.1rem;">Authorized Money Changer</p>
                <p style="font-size: 0.75rem; color: #10B981; font-weight: bold; margin: 5px 0 0 0; background: rgba(16, 185, 129, 0.1); display: inline-block; padding: 2px 10px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.25);">Versi 2.0.0</p>
                <p class="text-muted" style="font-size: 1.25rem; font-style: italic; color: #cbd5e1 !important; margin-top: 10px;">Bismillahirrahmanirrahim</p>
            </div>
            <div class="form-group">
                <label>Username</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="fa-solid fa-user"></i></span>
                    <input type="text" id="loginUsername" class="form-control" placeholder="Masukkan username">
                </div>
            </div>
            <div class="form-group mb-3">
                <label>Password</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="fa-solid fa-lock"></i></span>
                    <input type="password" id="loginPassword" class="form-control" placeholder="Masukkan password">
                </div>
            </div>
            <button id="theLoginBtn" class="btn btn-primary btn-block btn-lg mt-4" style="position: relative; z-index: 2147483647 !important; pointer-events: auto !important; cursor: pointer !important;" onclick="handleAuthLogin();"><i class="fa-solid fa-right-to-bracket"></i> Masuk (Login)</button>
            <div id="loginError" class="text-red text-center mt-3" style="display:none; font-size:0.9rem;">Username atau password salah!</div>
        </div>
    </div>

    <!-- Main App UI (Hidden by default) -->
    <div class="app-container" id="appContainer" style="display: none;">
        <script>
            if(_isLoggedIn) document.getElementById('appContainer').style.display = 'flex';
        </script>
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header almara-sidebar-header">
                <div class="sidebar-brand almara-sidebar-brand">
                    <div class="almara-sidebar-logo-wrap">
                        <img src="{{ asset('img/logo-almara.png') }}" alt="Logo Almara Putra Valasindo">
                    </div>
                    <div class="sidebar-brand-text almara-sidebar-brand-text">
                        <h2 id="sidebarBrandName">ALMARA PUTRA VALASINDO</h2>
                        <span class="almara-sidebar-subtitle">Authorized Money Changer</span>
                        <span class="almara-sidebar-version">Versi 2.0.3</span>
                    </div>
                </div>
                <button class="collapse-sidebar" id="collapseSidebar" title="Ciutkan sidebar"><i class="fa-solid fa-angles-left"></i></button>
                <button class="close-sidebar" id="closeSidebar"><i class="fa-solid fa-xmark"></i></button>
            </div>            <nav class="sidebar-nav sidebar-nav-grouped">

                <section class="sidebar-menu-group" data-sidebar-group-section="dashboard">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="dashboard" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-gauge-high"></i><span>Ringkasan</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="dashboard">
                    <a href="#" class="nav-item active" data-target="dashboard-view" data-sidebar-group="dashboard"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="transaksi">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="transaksi" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-cash-register"></i><span>Transaksi & Operasional</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="transaksi">
                    <a href="#" class="nav-item" data-target="pos-view" data-sidebar-group="transaksi" id="navPosReal"><i class="fa-solid fa-cash-register"></i> Transaksi / POS</a>
                    <a href="#" class="nav-item" data-target="demo-pos-view" data-sidebar-group="transaksi"><i class="fa-solid fa-flask"></i> Demo Transaksi</a>
                    <a href="#" class="nav-item" data-target="kurs-hari-ini-view" data-sidebar-group="transaksi"><i class="fa-solid fa-money-bill-trend-up"></i> Kurs Hari Ini</a>
                    <a href="#" class="nav-item" data-target="booking-view" data-sidebar-group="transaksi"><i class="fa-solid fa-book-bookmark"></i> Daftar Booking</a>
                    <a href="#" class="nav-item" data-target="pickup-view" data-sidebar-group="transaksi"><i class="fa-solid fa-motorcycle"></i> Serah Terima / Pickup</a>
                    <a href="#" class="nav-item" data-target="closing-view" data-sidebar-group="transaksi"><i class="fa-solid fa-box-archive"></i> Closing Harian</a>
                    <a href="#" class="nav-item" data-target="mutation-view" data-sidebar-group="transaksi"><i class="fa-solid fa-building-columns"></i> Mutasi Bank</a>
                    <a href="#" class="nav-item" data-target="old-money-view" data-sidebar-group="transaksi"><i class="fa-solid fa-coins"></i> Koin & Uang Lama</a>
                    <a href="#" class="nav-item" data-target="valas-gallery-view" data-sidebar-group="transaksi"><i class="fa-solid fa-images"></i> Galeri Valas</a>
                    <a href="#" class="nav-item" data-target="waiting-list-view" data-sidebar-group="transaksi"><i class="fa-solid fa-hourglass-half"></i> Permintaan Valas</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="nasabah">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="nasabah" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-users-shield"></i><span>Nasabah</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="nasabah">
                    <a href="#" class="nav-item" data-target="customers-view" data-sidebar-group="nasabah"><i class="fa-solid fa-users"></i> Data Nasabah</a>
                    <a href="#" class="nav-item" data-target="pt-rep-view" data-sidebar-group="nasabah"><i class="fa-solid fa-building-user"></i> Perwakilan PT</a>
                    <a href="#" class="nav-item" data-target="dtott-view" data-sidebar-group="nasabah"><i class="fa-solid fa-user-shield"></i> DTTOT</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="master">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="master" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-database"></i><span>Master Data & Valuta</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="master">
                    <a href="#" class="nav-item" data-target="currency-view" data-sidebar-group="master"><i class="fa-solid fa-money-bill-transfer"></i> Manajemen Kurs</a>
                    <a href="#" class="nav-item" data-target="masterdata-view" data-sidebar-group="master"><i class="fa-solid fa-database"></i> Master Data</a>
                    <a href="/papan-kurs" target="_blank" rel="noopener" class="nav-item nav-item--external" data-sidebar-group="master"><i class="fa-solid fa-desktop"></i> Monitor Papan Kurs <i class="fa-solid fa-arrow-up-right-from-square ext"></i></a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="keuangan">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="keuangan" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-coins"></i><span>Keuangan</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="keuangan">
                    <a href="#" class="nav-item" data-target="expense-view" data-sidebar-group="keuangan"><i class="fa-solid fa-receipt"></i> Pengeluaran & Pendapatan</a>
                    <a href="#" class="nav-item" data-target="gantungan-view" data-sidebar-group="keuangan"><i class="fa-solid fa-hand-holding-dollar"></i> Gantungan</a>
                    <a href="#" class="nav-item" data-target="investor-view" data-sidebar-group="keuangan"><i class="fa-solid fa-hand-holding-dollar"></i> Penanam Saham</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="laporan">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="laporan" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-chart-column"></i><span>Pelaporan Akuntansi</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="laporan">
                    <a href="#" class="nav-item" data-target="harian-view" data-sidebar-group="laporan"><i class="fa-solid fa-calendar-day"></i> Laporan Harian</a>
                    <a href="#" class="nav-item" data-target="laporan-posisi-valuta-view" data-sidebar-group="laporan"><i class="fa-solid fa-table-list"></i> Rekap Valuta</a>
                    <a href="#" class="nav-item" data-target="reports-view" data-sidebar-group="laporan"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Transaksi</a>
                    <a href="#" class="nav-item" data-target="laporan-aset-view" data-sidebar-group="laporan"><i class="fa-solid fa-building"></i> Aset & Penyusutan</a>
                    <a href="#" class="nav-item" data-target="laporan-bukubesar-view" data-sidebar-group="laporan"><i class="fa-solid fa-book"></i> Buku Besar</a>
                    <a href="#" class="nav-item" data-target="laporan-coretax-view" data-sidebar-group="laporan"><i class="fa-solid fa-file-invoice-dollar"></i> CoreTax</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="bi">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="bi" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-building-columns"></i><span>Pelaporan BI & Regulasi</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="bi">
                    <a href="#" class="nav-item" data-target="laporan-lku-view" data-sidebar-group="bi"><i class="fa-solid fa-file-invoice"></i> LKBU</a>
                    <a href="#" class="nav-item" data-target="laporan-granular-view" data-sidebar-group="bi"><i class="fa-solid fa-file-invoice"></i> Granular</a>
                    <a href="#" class="nav-item" data-target="laporan-sipesat-view" data-sidebar-group="bi"><i class="fa-solid fa-file-invoice"></i> Sipesat</a>
                    <a href="#" class="nav-item" data-target="laporan-goaml-view" data-sidebar-group="bi"><i class="fa-solid fa-file-invoice"></i> GoAML</a>
                    <a href="#" class="nav-item" data-target="laporan-sipendar-view" data-sidebar-group="bi"><i class="fa-solid fa-file-invoice"></i> Sipendar</a>
                    <a href="#" class="nav-item" data-target="almara-regulatory-chat-view" data-sidebar-group="bi"><i class="fa-solid fa-wand-magic-sparkles"></i> Chat Regulatory AI</a>
                    <a href="#" class="nav-item" data-target="almara-regulatory-ai-view" data-sidebar-group="bi"><i class="fa-solid fa-book-bookmark"></i> Sumber Regulasi</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="tools">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="tools" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-toolbox"></i><span>Komunikasi & Tools</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="tools">
                    <a href="#" class="nav-item" data-target="ai-chat-view" data-sidebar-group="tools"><i class="fa-solid fa-robot"></i> Tanya AI / Deteksi Valas</a>
                    <a href="#" class="nav-item" data-target="translator-view" data-sidebar-group="tools"><i class="fa-solid fa-language"></i> Penerjemah Bahasa</a>
                    <a href="#" class="nav-item" data-target="user-chat-view" data-sidebar-group="tools"><i class="fa-solid fa-comments"></i> Chat</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="administrasi">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="administrasi" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-folder-tree"></i><span>Administrasi & Berkas</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="administrasi">
                    <a href="#" class="nav-item" data-target="hris-view" data-sidebar-group="administrasi"><i class="fa-solid fa-users-gear"></i> HRIS / Karyawan</a>
                    <a href="#" class="nav-item" data-target="documents-view" data-sidebar-group="administrasi"><i class="fa-solid fa-folder-open"></i> Penyimpanan Berkas</a>
                    <a href="#" class="nav-item" data-target="letter-number-view" data-sidebar-group="administrasi"><i class="fa-solid fa-file-signature"></i> Nomor Surat</a>
                    </div>
                </section>

                <section class="sidebar-menu-group" data-sidebar-group-section="pengaturan">
                    <button type="button" class="sidebar-group-toggle" data-sidebar-group-toggle="pengaturan" aria-expanded="true">
                        <span class="sidebar-group-label"><i class="fa-solid fa-sliders"></i><span>Pengaturan Sistem</span></span>
                        <i class="fa-solid fa-chevron-down sidebar-group-chevron"></i>
                    </button>
                    <div class="sidebar-group-items" data-sidebar-group-items="pengaturan">
                    <a href="#" class="nav-item" data-target="settings-view" data-sidebar-group="pengaturan"><i class="fa-solid fa-gear"></i> Pengaturan</a>
                    </div>
                </section>
            </nav>
            <div class="sidebar-footer">
                <div class="user-info">
                    <i class="fa-solid fa-user-circle"></i>
                    <span>Admin Kasir<br><small>Shift 1</small></span>
                </div>
                <button type="button" class="sb-sync" onclick="manualSyncAll()" title="Kirim data lokal ke server MySQL secara manual">
                    <i class="fa-solid fa-cloud-arrow-up"></i> <span>Sinkronkan Data</span>
                </button>
                <div class="dev-credit">&#64;2026-Alifiandra</div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Header -->
            <header class="top-header">
                <div class="header-left">
                    <button class="menu-toggle" id="menuToggle"><i class="fa-solid fa-bars"></i></button>
                    <h1 id="pageTitle">Dashboard</h1>
                </div>
                <div class="header-right">
                    <div id="connectionStatusIndicator" class="connection-status" style="margin-right: 15px; display: none; align-items: center; gap: 5px; color: #f43f5e; font-weight: bold; font-size: 0.88rem; cursor: pointer; border: 1px solid rgba(244, 63, 94, 0.4); padding: 4px 10px; border-radius: 4px; background: rgba(244, 63, 94, 0.1);" onclick="forceSessionLogout()" title="Sesi server berakhir. Beberapa data mungkin tidak tersinkron. Klik untuk masuk kembali.">
                        <i class="fa-solid fa-circle-exclamation"></i> Offline (Sesi Terputus)
                    </div>
                    <div class="header-time-row">
                        <div class="header-environment">
                            <div id="headerLocationWidget" class="header-env-chip header-env-location" title="Lokasi perangkat">
                                <i class="fa-solid fa-location-dot"></i>
                                <span>-</span>
                            </div>
                            <div id="headerWeatherWidget" class="header-env-chip header-env-weather" title="Cuaca saat ini">
                                <i class="fa-solid fa-cloud-sun"></i>
                                <span>-</span>
                            </div>
                        </div>
                        <div id="liveDate" style="font-weight: bold; color: #94A3B8;"></div>
                        <div class="live-clock" id="liveClock">12:00:00</div>
                    </div>
                    <div class="notification" style="cursor: pointer;" onclick="showStockAlertModal()" title="Cek Notifikasi Stok">
                        <i class="fa-solid fa-bell"></i>
                        <span class="badge" id="stockAlertBadge"></span>
                    </div>
                    <!-- Theme Switcher Dropdown -->
                    <div style="position: relative; margin-left: 16px;" id="themeSwitcherWrap">
                        <button id="themeSwitcherBtn" onclick="toggleThemePanel()" title="Pilih Tema" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#94A3B8;padding:5px 10px;border-radius:8px;cursor:pointer;font-size:0.78rem;font-weight:600;transition:all 0.2s;">
                            <i id="themeIconCurrent" class="fa-solid fa-moon"></i>
                            <span id="themeLabelCurrent">Dark</span>
                            <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;opacity:0.7;"></i>
                        </button>
                        <div id="themeSwitcherPanel" style="display:none;position:absolute;top:calc(100% + 8px);right:0;background:#1e293b;border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,0.35);padding:6px;z-index:9999;min-width:165px;">
                            <div style="padding:4px 8px 6px;font-size:9.5px;font-weight:800;color:#475569;letter-spacing:1px;text-transform:uppercase;">PILIH TEMA</div>
                            <button onclick="applyTheme('dark')" id="themeOptDark" style="display:flex;align-items:center;gap:9px;width:100%;background:transparent;border:none;color:#94A3B8;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:0.8rem;font-weight:500;transition:background 0.15s;">
                                <i class="fa-solid fa-moon" style="width:16px;"></i> Dark (Default)
                                <i class="fa-solid fa-check" id="checkDark" style="margin-left:auto;color:#3b82f6;display:none;"></i>
                            </button>
                            <button onclick="applyTheme('light')" id="themeOptLight" style="display:flex;align-items:center;gap:9px;width:100%;background:transparent;border:none;color:#94A3B8;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:0.8rem;font-weight:500;transition:background 0.15s;">
                                <i class="fa-solid fa-sun" style="width:16px;"></i> Light
                                <i class="fa-solid fa-check" id="checkLight" style="margin-left:auto;color:#3b82f6;display:none;"></i>
                            </button>
                            <button onclick="applyTheme('apv')" id="themeOptApv" style="display:flex;align-items:center;gap:9px;width:100%;background:transparent;border:none;color:#94A3B8;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:0.8rem;font-weight:500;transition:background 0.15s;">
                                <i class="fa-solid fa-crown" style="width:16px;color:#C9F36A;"></i> APV Theme
                                <i class="fa-solid fa-check" id="checkApv" style="margin-left:auto;color:#3b82f6;display:none;"></i>
                            </button>
                            <div class="mc-theme-divider"></div>
                            <div class="mc-sidebar-group-color-title">
                                <i class="fa-solid fa-font"></i>
                                <span>Warna Teks Grup Sidebar</span>
                            </div>
                            <div id="mcSidebarGroupColors" class="mc-sidebar-group-colors">
                                <label><span>Ringkasan</span><input type="color" data-sidebar-color="dashboard" value="#0653c1"></label>
                                <label><span>Transaksi & Operasional</span><input type="color" data-sidebar-color="transaksi" value="#94A3B8"></label>
                                <label><span>Nasabah</span><input type="color" data-sidebar-color="nasabah" value="#94A3B8"></label>
                                <label><span>Master Data & Valuta</span><input type="color" data-sidebar-color="master" value="#94A3B8"></label>
                                <label><span>Keuangan</span><input type="color" data-sidebar-color="keuangan" value="#94A3B8"></label>
                                <label><span>Pelaporan Akuntansi</span><input type="color" data-sidebar-color="laporan" value="#94A3B8"></label>
                                <label><span>BI & Regulasi</span><input type="color" data-sidebar-color="bi" value="#94A3B8"></label>
                                <label><span>Tools</span><input type="color" data-sidebar-color="tools" value="#94A3B8"></label>
                                <label><span>Administrasi & Berkas</span><input type="color" data-sidebar-color="administrasi" value="#94A3B8"></label>
                                <label><span>Pengaturan Sistem</span><input type="color" data-sidebar-color="pengaturan" value="#94A3B8"></label>
                            </div>
                            <button type="button" id="resetSidebarGroupColors" class="mc-sidebar-group-reset">
                                <i class="fa-solid fa-rotate-left"></i> Kembalikan warna standar
                            </button>
                        </div>
                    </div>
                    <div class="header-calculator" style="cursor: pointer; margin-left: 20px; font-size: 1.2rem; color: #94A3B8;" onclick="toggleMultiCalculator()" title="Kalkulator Multi-Baris">
                        <i class="fa-solid fa-calculator"></i>
                    </div>
                    <div class="header-chat" style="cursor: pointer; margin-left: 20px; font-size: 1.2rem; color: #94A3B8; position: relative;" onclick="document.querySelector('.nav-item[data-target=\'user-chat-view\']')?.click()" title="Chat">
                        <i class="fa-solid fa-comments"></i>
                        <span id="chatUnreadHeaderBadge" style="position: absolute; top: -7px; right: -8px; background: #ef4444; color: #ffffff; font-size: 0.65rem; padding: 1px 5px; border-radius: 10px; display: none; font-weight: bold; line-height: 1;">0</span>
                    </div>
                </div>
            </header>

            <!-- Views Container -->
            <div class="view-container">
                <!-- Dashboard View -->
                <section id="dashboard-view" class="view-section active">
                    <!-- @2026-Alifiandra : Dashboard (desain modern). Semua ID dipakai oleh 02-dashboard.js & 30-dashboard-analytics.js -->
                    <div class="dsh-hero">
                        <div class="dsh-hero-text">
                            <span class="dsh-eyebrow"><i class="fa-solid fa-calendar-day"></i> <span id="dshHeroDate">Tinjauan Hari Ini</span></span>
                            <h2 id="dshGreeting">Ringkasan Operasional</h2>
                            <p>Posisi kas, bank, stok valuta, dan transaksi dalam satu layar.</p>
                        </div>
                        <div class="dsh-filter" role="group" aria-label="Filter tanggal">
                            <label class="dsh-filter-field">
                                <i class="fa-regular fa-calendar"></i>
                                <input type="date" id="dashDateFilter" class="form-control" aria-label="Pilih tanggal">
                            </label>
                            <button type="button" class="dsh-btn dsh-btn-solid" onclick="loadDashboard()"><i class="fa-solid fa-filter"></i> <span>Terapkan</span></button>
                            <button type="button" class="dsh-btn dsh-btn-ghost" onclick="document.getElementById('dashDateFilter').value = ''; loadDashboard();" title="Kembali ke hari ini"><i class="fa-solid fa-rotate-left"></i> <span>Reset</span></button>
                        </div>
                    </div>

                    <div class="dsh-section-title">Posisi Saat Ini</div>
                    <div class="dsh-kpi-grid dsh-kpi-grid--4">
                        <div class="dsh-kpi dsh-tone-teal">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-wallet"></i></div>
                            <div class="stat-details">
                                <h3>Brankas Tunai (Cash)</h3>
                                <p class="stat-value" id="dashTotalKas">Rp 0</p>
                            </div>
                        </div>
                        <div class="dsh-kpi dsh-tone-blue">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-building-columns"></i></div>
                            <div class="stat-details">
                                <h3>Saldo Bank (Transfer)</h3>
                                <p class="stat-value" id="dashTotalBank">Rp 0</p>
                                <div class="dsh-chips">
                                    <span class="dsh-chip dsh-chip-blue">BCA <strong id="dashBCA">Rp 0</strong></span>
                                    <span class="dsh-chip dsh-chip-amber">Mandiri <strong id="dashMandiri">Rp 0</strong></span>
                                </div>
                            </div>
                        </div>
                        <div class="dsh-kpi dsh-tone-violet">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-sack-dollar"></i></div>
                            <div class="stat-details">
                                <h3>Total Valuta (Estimasi)</h3>
                                <p class="stat-value" id="dashTotalValuta">Rp 0</p>
                                <small id="dashTotalValutaHint" class="dsh-hint">Berdasarkan saldo awal valas</small>
                            </div>
                        </div>
                        <div class="dsh-kpi dsh-kpi-hero">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
                            <div class="stat-details">
                                <h3>Profit Hari Ini</h3>
                                <p class="stat-value" id="dashProfit">Rp 0</p>
                            </div>
                        </div>
                    </div>

                    <div class="dsh-section-title">Aktivitas Transaksi</div>
                    <div class="dsh-kpi-grid dsh-kpi-grid--4">
                        <div class="dsh-kpi dsh-tone-green">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-arrow-down"></i></div>
                            <div class="stat-details">
                                <h3>Total Pembelian</h3>
                                <p class="stat-value" id="dashTotalPurchases">Rp 0</p>
                            </div>
                        </div>
                        <div class="dsh-kpi dsh-tone-red">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-arrow-up"></i></div>
                            <div class="stat-details">
                                <h3>Total Penjualan</h3>
                                <p class="stat-value" id="dashTotalSales">Rp 0</p>
                            </div>
                        </div>
                        <div class="dsh-kpi dsh-tone-amber">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-receipt"></i></div>
                            <div class="stat-details">
                                <h3>Pengeluaran</h3>
                                <p class="stat-value" id="dashTotalExpenses">Rp 0</p>
                            </div>
                        </div>
                        <div class="dsh-kpi dsh-tone-violet">
                            <div class="dsh-kpi-icon"><i class="fa-solid fa-scale-unbalanced"></i></div>
                            <div class="stat-details">
                                <h3>Selisih Rekons.</h3>
                                <p class="stat-value" id="dashTotalSelisih">Rp 0</p>
                                <small id="dashTotalSelisihHint" class="dsh-hint">Belum ada closing</small>
                            </div>
                        </div>
                    </div>

                    <div class="dsh-market dashboard-content dashboard-market-layout">
                        <!-- Grafik -->
                        <div class="dsh-card chart-panel">
                            <div class="dsh-card-head chart-panel-header">
                                <h3><i class="fa-solid fa-chart-line"></i> <span id="dashChartTitle">Grafik Qty & Kurs (7 Hari)</span></h3>
                                <div class="chart-controls">
                                    <div class="chart-range-tabs" role="group" aria-label="Periode grafik transaksi">
                                        <button type="button" class="chart-range-btn" data-range="1H" onclick="setDashboardChartRange('1H')">1H</button>
                                        <button type="button" class="chart-range-btn" data-range="3H" onclick="setDashboardChartRange('3H')">3H</button>
                                        <button type="button" class="chart-range-btn" data-range="7H" onclick="setDashboardChartRange('7H')">7H</button>
                                        <button type="button" class="chart-range-btn" data-range="1M" onclick="setDashboardChartRange('1M')">1M</button>
                                        <button type="button" class="chart-range-btn" data-range="3M" onclick="setDashboardChartRange('3M')">3M</button>
                                        <button type="button" class="chart-range-btn" data-range="1Y" onclick="setDashboardChartRange('1Y')">1Y</button>
                                    </div>
                                    <select id="dashboardChartCurrency" class="form-control chart-currency-select" onchange="loadDashboard()" aria-label="Pilih valuta grafik">
                                        <option value="ALL">Semua Valuta</option>
                                    </select>
                                </div>
                            </div>
                            <div class="dsh-chart-box"><canvas id="transactionChart"></canvas></div>
                        </div>

                        <!-- Live stok valuta -->
                        <div class="dsh-card stock-panel">
                            <div class="dsh-card-head">
                                <h3><i class="fa-solid fa-boxes-stacked"></i> Live Stok Valuta</h3>
                                <div class="stock-search">
                                    <i class="fa-solid fa-magnifying-glass"></i>
                                    <input type="text" id="dashboardStockSearch" class="form-control" placeholder="Cari kode..." autocomplete="off" oninput="loadStockMonitor()" aria-label="Cari valuta">
                                </div>
                            </div>
                            <div class="stock-list" id="dashboardStockList">
                                <!-- Diisi oleh JS -->
                            </div>
                        </div>
                    </div>

                    <!-- Aktivitas terbaru -->
                    <div class="dsh-card dsh-recent">
                        <div class="dsh-card-head">
                            <h3><i class="fa-solid fa-list-check"></i> Aktivitas Terbaru</h3>
                        </div>
                        <div class="table-responsive">
                            <table class="table dsh-table">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>Tipe</th>
                                        <th>Valuta</th>
                                        <th>Nominal Valuta</th>
                                        <th>Total (Rp)</th>
                                        <th>Kasir</th>
                                    </tr>
                                </thead>
                                <tbody id="recentActivities">
                                    <!-- Diisi oleh JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="dsh-section-title">Analitik</div>
                    <div class="mc-dashboard-analytics-grid" id="mcDashboardAnalytics">
                        <div class="dsh-card mc-analytics-card">
                            <div class="dsh-card-head"><h3><i class="fa-solid fa-map-location-dot"></i> Wilayah Nasabah</h3><span class="mc-analytics-badge" id="dashRegionTotal">0 nasabah</span></div>
                            <div class="mc-chart-wrap"><canvas id="dashRegionChart"></canvas></div>
                        </div>
                        <div class="dsh-card mc-analytics-card">
                            <div class="dsh-card-head"><h3><i class="fa-solid fa-money-bill-transfer"></i> Transaksi Mata Uang</h3><span class="mc-analytics-badge" id="dashCurrencyTotal">Rp 0</span></div>
                            <div class="mc-chart-wrap"><canvas id="dashCurrencyChart"></canvas></div>
                        </div>
                        <div class="dsh-card mc-analytics-card">
                            <div class="dsh-card-head"><h3><i class="fa-solid fa-right-left"></i> Beli vs Jual</h3><span class="mc-analytics-badge" id="dashBuySellTotal">0 transaksi</span></div>
                            <div class="mc-chart-wrap"><canvas id="dashBuySellChart"></canvas></div>
                        </div>
                        <div class="dsh-card mc-analytics-card">
                            <div class="dsh-card-head"><h3><i class="fa-solid fa-chart-area"></i> Trend Nilai Transaksi</h3><span class="mc-analytics-badge" id="dashTrendTotal">Rp 0</span></div>
                            <div class="mc-chart-wrap"><canvas id="dashTrendChart"></canvas></div>
                        </div>
                        <div class="dsh-card mc-analytics-card">
                            <div class="dsh-card-head"><h3><i class="fa-solid fa-users"></i> Nasabah Aktif</h3><span class="mc-analytics-badge" id="dashCustomerTotal">0 aktif</span></div>
                            <div class="mc-chart-wrap"><canvas id="dashCustomerChart"></canvas></div>
                        </div>
                        <div class="dsh-card mc-analytics-card">
                            <div class="dsh-card-head"><h3><i class="fa-solid fa-shield-halved"></i> Ringkasan Compliance</h3><span class="mc-analytics-badge">GoAML</span></div>
                            <div class="mc-compliance-mini">
                                <div><span>Transaksi diperiksa</span><strong id="dashComplianceTrx">0</strong></div>
                                <div><span>Nasabah aktif</span><strong id="dashComplianceCustomer">0</strong></div>
                                <div><span>Wilayah terdata</span><strong id="dashComplianceRegion">0</strong></div>
                            </div>
                            <small class="dsh-hint">Ringkasan analitik dashboard. Detail alert tetap di menu BI &amp; Regulasi &rsaquo; GoAML.</small>
                        </div>
                    </div>
                </section>

                <!-- Demo POS: data, stok, dan riwayat terpisah dari POS operasional -->
                <section id="demo-pos-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left:4px solid #0f766e; margin-bottom:16px;">
                        <div><h2 style="color:#0f766e;"><i class="fa-solid fa-flask"></i> Demo Transaksi</h2><p class="text-muted mt-2">Area latihan. Stok dan transaksi di sini tidak mengubah data POS utama.</p></div>
                        <span class="badge" style="position:static;background:#0f766e;">DATA DEMO</span>
                    </div>
                    <div class="pos-layout-modern pos-flow-layout">
                        <div class="pos-card-modern pos-flow-card">
                            <div class="pos-card-header-modern"><h3><i class="fa-solid fa-file-invoice"></i> DATA TRANSAKSI DEMO</h3></div>
                            <div class="pos-meta-grid">
                                <div class="form-group"><label>No. Invoice</label><input id="demoPosInvoice" class="form-control" readonly></div>
                                <div class="form-group"><label>Tanggal</label><input id="demoPosDate" type="date" class="form-control"></div>
                                <div class="form-group"><label>Nama Nasabah <small class="text-muted">(opsional)</small></label><input id="demoPosCustomer" class="form-control" placeholder="Boleh dikosongkan"></div>
                            </div>
                        </div>
                        <div class="pos-card-modern pos-flow-card">
                            <div class="pos-card-header-modern"><h3><i class="fa-solid fa-right-left"></i> TRANSAKSI</h3><button class="btn btn-sm btn-outline text-danger" type="button" onclick="window.demoPosClearCart()"><i class="fa-solid fa-trash-can"></i> Kosongkan</button></div>
                            <div class="pos-trade-grid">
                                <div class="pos-entry-panel">
                                    <div class="pos-type-toggle"><button type="button" id="demoPosBeli" class="pos-type-btn active beli" onclick="window.demoPosSetType('BELI')">Kita Beli Valas</button><button type="button" id="demoPosJual" class="pos-type-btn jual" onclick="window.demoPosSetType('JUAL')">Kita Jual Valas</button></div>
                                    <div class="pos-input-grid mt-3">
                                        <div class="form-group"><label>Valas Demo</label><select id="demoPosCurrency" class="form-control" onchange="window.demoPosFillRate()"></select></div>
                                        <div class="form-group"><label>Kurs Deal</label><input id="demoPosRate" type="number" class="form-control" placeholder="0"></div>
                                        <div class="form-group"><label>Jumlah Valas</label><input id="demoPosAmount" type="number" class="form-control" placeholder="0"></div>
                                    </div>
                                    <button type="button" class="btn btn-outline mt-3" onclick="window.demoPosAddCart()"><i class="fa-solid fa-cart-plus"></i> Tambah ke Keranjang</button>
                                </div>
                                <div class="pos-cart-panel"><div class="pos-cart-lanes"><div class="pos-cart-lane pos-cart-lane-buy"><div class="pos-lane-title"><span>Kita Beli Valas</span></div><div id="demoPosBuyCart" class="cart-box pos-split-cart"></div></div><div class="pos-cart-lane pos-cart-lane-sell"><div class="pos-lane-title"><span>Kita Jual Valas</span></div><div id="demoPosSellCart" class="cart-box pos-split-cart"></div></div></div><div class="pos-total-strip mt-3"><div><span>Total Demo</span><strong id="demoPosTotal">Rp 0</strong></div></div></div>
                            </div>
                        </div>
                        <div class="pos-card-modern pos-flow-card"><div class="pos-card-header-modern"><h3><i class="fa-solid fa-wallet"></i> PEMBAYARAN</h3></div><div class="pos-payment-grid"><div class="pos-entry-panel"><div class="pos-input-grid"><div class="form-group"><label>Metode Pembayaran</label><select id="demoPosPayment" class="form-control"><option value="CASH">Tunai</option><option value="TRANSFER">Transfer</option><option value="QRIS">QRIS</option></select></div><div class="form-group"><label>Catatan <small class="text-muted">(opsional)</small></label><input id="demoPosNote" class="form-control" placeholder="Catatan demo"></div></div><button type="button" id="demoPosSave" class="btn btn-primary btn-lg mt-3" onclick="window.demoPosProcess()"><i class="fa-solid fa-check-double"></i> Simpan Transaksi Demo</button><button type="button" id="demoPosPrint" class="btn btn-secondary mt-3 hidden" onclick="window.demoPosPrintLast()"><i class="fa-solid fa-print"></i> Cetak Rincian Demo</button></div></div></div>
                    </div>
                    <div class="row mt-4" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;">
                        <div class="panel"><div class="flex-between mb-3"><h3><i class="fa-solid fa-boxes-stacked"></i> Stok Demo</h3><button class="btn btn-sm btn-primary" onclick="window.demoPosAddStock()"><i class="fa-solid fa-plus"></i> Tambah Stok</button></div><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Valas</th><th>Stok</th><th>Beli</th><th>Jual</th><th></th></tr></thead><tbody id="demoPosStockBody"></tbody></table></div></div>
                        <div class="panel"><div class="flex-between mb-3"><h3><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Transaksi Demo</h3><button type="button" class="btn btn-sm btn-outline" onclick="window.demoPosResetForm()"><i class="fa-solid fa-plus"></i> Transaksi Baru</button></div><div class="table-responsive" style="max-height:330px;overflow:auto;"><table class="table table-sm"><thead><tr><th>Tanggal</th><th>Invoice</th><th>Nasabah</th><th>Rincian</th><th>Total</th><th>Aksi</th></tr></thead><tbody id="demoPosHistory"></tbody></table></div></div>
                    </div>
                </section>

                <!-- POS / Transaction View -->
                <section id="pos-view" class="view-section hidden">
                    <div class="pos-layout-modern pos-flow-layout">
                        <div style="display: none !important;">
                            <select id="trxType" class="form-control">
                                <option value="BELI">BELI</option>
                                <option value="JUAL">JUAL</option>
                            </select>
                            <select id="trxCurrency" class="form-control"></select>
                            <select id="trxCustomer" class="form-control"></select>
                            <select id="checkoutType"><option value="CASH">CASH</option></select>
                            <input type="number" id="dpAmount" value="0">
                        </div>

                        <div id="posDraftFloatingBar" style="position: sticky; top: 70px; z-index: 60; margin-bottom: 12px; background: rgba(15, 23, 42, 0.94); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 8px; padding: 10px; box-shadow: 0 12px 28px rgba(0,0,0,.22);">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <button type="button" class="btn btn-sm btn-primary" onclick="window.addPosDraftSession()"><i class="fa-solid fa-plus"></i> Tambah Form</button>
                                    <div id="posDraftSessionList" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"></div>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <button type="button" class="btn btn-sm btn-outline" onclick="window.toggleActivePosDraftMinimize()" title="Min / Max"><i class="fa-solid fa-window-minimize"></i></button>
                                    <button type="button" class="btn btn-sm btn-outline" onclick="window.resetActivePosDraft()" title="Reset Form"><i class="fa-solid fa-rotate-left"></i></button>
                                    <button type="button" class="btn btn-sm btn-danger" onclick="window.closeActivePosDraft()" title="Close Form"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                            </div>
                        </div>

                        <div class="pos-card-modern pos-flow-card">
                            <div class="pos-card-header-modern">
                                <h3><i class="fa-solid fa-file-invoice"></i> 1. DATA TRANSAKSI</h3>
                            </div>
                            <div class="pos-meta-grid">
                                <div class="form-group">
                                    <label>No. Invoice</label>
                                    <input type="text" class="form-control" id="posTrxIdPreviewModern" value="[Otomatis]" readonly>
                                </div>
                                <div class="form-group" id="posTrxDateContainer">
                                    <label>Tanggal</label>
                                    <input type="date" id="trxCheckoutDate" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Jam</label>
                                    <input type="time" id="posTrxTimePreviewModern" class="form-control" readonly>
                                </div>
                            </div>
                        </div>

                        <div class="pos-card-modern pos-flow-card">
                            <div class="pos-card-header-modern">
                                <h3><i class="fa-solid fa-right-left"></i> 2. TRANSAKSI</h3>
                                <div class="pos-header-actions">
                                    <button type="button" class="btn btn-sm btn-outline" onclick="showSection('kurs-hari-ini-view')">
                                        <i class="fa-solid fa-gear"></i> Kelola Valas
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline text-danger" onclick="window.clearPosCartModern()">
                                        <i class="fa-solid fa-trash-can"></i> Kosongkan
                                    </button>
                                </div>
                            </div>

                            <div class="pos-trade-grid">
                                <div class="pos-entry-panel">
                                    <div class="pos-subheader">
                                        <span><i class="fa-solid fa-money-bill-transfer"></i> Pilih Valas</span>
                                    </div>
                                    <div class="pos-type-toggle">
                                        <button type="button" id="posTypeBeliBtnModern" class="pos-type-btn active beli" onclick="window.setPosTransactionType('BELI')">Kita Beli Valas</button>
                                        <button type="button" id="posTypeJualBtnModern" class="pos-type-btn jual" onclick="window.setPosTransactionType('JUAL')">Kita Jual Valas</button>
                                    </div>
                                    <div class="pos-valas-search-container">
                                        <input type="text" id="posValasSearchModern" class="form-control" placeholder="Cari valas / negara..." onfocus="window.openPosValasDropdown()" onclick="window.openPosValasDropdown()" oninput="window.filterPosValasModern()">
                                        <i class="fa-solid fa-magnifying-glass"></i>
                                        <div id="posValasListModern" class="pos-valas-list-modern hidden">
                                            <div style="text-align: center; color: var(--text-muted); padding: 20px;">Memuat valas...</div>
                                        </div>
                                    </div>

                                    <div class="pos-rate-strip" id="posRateInfoModern">
                                        <span>Sumber: <strong>Master Kurs Almara</strong></span>
                                        <span>Update: <strong id="posLastRateUpdateModern">-</strong></span>
                                        <span>Petugas: <strong id="posRateUpdaterModern">-</strong></span>
                                        <button type="button" class="btn btn-sm btn-primary" onclick="window.refreshActiveRealtimeViews()">
                                            <i class="fa-solid fa-arrows-rotate"></i>
                                        </button>
                                    </div>

                                    <div class="pos-input-grid mt-3">
                                        <div class="form-group">
                                            <label>Mode Kurs</label>
                                            <select id="trxRateMode" class="form-control" onchange="togglePosRateMode()">
                                                <option value="AUTO">Otomatis (Master Kurs)</option>
                                                <option value="MANUAL">Manual Input</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Rate (Kurs Deal)</label>
                                            <input type="number" id="trxRate" class="form-control" placeholder="0">
                                        </div>
                                        <div class="form-group">
                                            <label>Jumlah Valas</label>
                                            <input type="number" id="trxAmount" class="form-control" placeholder="0">
                                        </div>
                                    </div>

                                    <div class="pos-nominal-chips">
                                        <button type="button" class="pos-nominal-chip" onclick="window.setPosAmountSheet(100)">100</button>
                                        <button type="button" class="pos-nominal-chip" onclick="window.setPosAmountSheet(500)">500</button>
                                        <button type="button" class="pos-nominal-chip" onclick="window.setPosAmountSheet(1000)">1.000</button>
                                        <button type="button" class="pos-nominal-chip" onclick="window.setPosAmountSheet(5000)">5.000</button>
                                        <button type="button" class="pos-nominal-chip" onclick="window.setPosAmountSheet(10000)">10.000</button>
                                        <button type="button" class="pos-nominal-chip" onclick="document.getElementById('trxAmount').focus()"><i class="fa-solid fa-calculator"></i> Custom</button>
                                    </div>

                                    <div class="pos-action-row">
                                        <button type="button" id="btnAddToCart" class="btn btn-outline">
                                            <i class="fa-solid fa-cart-plus"></i> Tambah ke Keranjang (F2)
                                        </button>
                                        <button type="button" class="btn btn-outline text-danger" onclick="resetPosForm(true)">
                                            <i class="fa-solid fa-rotate-left"></i> Clear (F3)
                                        </button>
                                    </div>
                                </div>

                                <div class="pos-cart-panel">
                                    <div class="pos-cart-lanes">
                                        <div class="pos-cart-lane pos-cart-lane-buy">
                                            <div class="pos-lane-title">
                                                <span><i class="fa-solid fa-cart-plus"></i> Kita Beli Valas</span>
                                                <small>MC bayar rupiah</small>
                                            </div>
                                            <div class="pos-cart-header">
                                                <span>Valas</span><span>Qty</span><span>Kurs</span><span>Jumlah Rp</span><span></span>
                                            </div>
                                            <div class="cart-box pos-split-cart" id="posBuyCartContainer">
                                                <div class="pos-empty-cart">Belum ada pembelian valas</div>
                                            </div>
                                        </div>

                                        <div class="pos-cart-lane pos-cart-lane-sell">
                                            <div class="pos-lane-title">
                                                <span><i class="fa-solid fa-cart-shopping"></i> Kita Jual Valas</span>
                                                <small>MC terima rupiah</small>
                                            </div>
                                            <div class="pos-cart-header">
                                                <span>Valas</span><span>Qty</span><span>Kurs</span><span>Jumlah Rp</span><span></span>
                                            </div>
                                            <div class="cart-box pos-split-cart" id="posSellCartContainer">
                                                <div class="pos-empty-cart">Belum ada penjualan valas</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div id="cartHeader" style="display: none;"></div>
                                    <div class="cart-box" id="cartContainer" style="display: none;"></div>

                                    <div class="summary-box mt-3" style="display: none;">
                                        <span id="summaryType">BELI</span>
                                        <span id="summaryCurrency">-</span>
                                        <span id="summaryRate">0</span>
                                        <span id="summaryAmount">0</span>
                                        <span id="summaryTotalIdr">Rp 0</span>
                                    </div>

                                    <div class="pos-total-strip">
                                        <div>
                                            <span>Jumlah</span>
                                            <strong id="posSubtotalValModern">Rp 0</strong>
                                        </div>
                                        <div>
                                            <span>Total Akhir</span>
                                            <strong id="grandTotalIdr">Rp 0</strong>
                                        </div>
                                        <div>
                                            <span>Tambah / Selisih</span>
                                            <strong id="posChangeModern">Rp 0</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="pos-card-modern pos-flow-card">
                            <div class="pos-card-header-modern">
                                <h3><i class="fa-solid fa-user-tag"></i> 3. DATA NASABAH <span style="color: #f87171;">*</span></h3>
                                <button type="button" class="btn btn-sm btn-primary" onclick="window.openCustomerModal()">
                                    <i class="fa-solid fa-user-plus"></i> Nasabah Baru
                                </button>
                            </div>

                            <div class="pos-customer-layout">
                                <div class="pos-customer-main">
                                    <div style="position: relative; margin-bottom: 15px;">
                                        <input type="text" id="posCustomerSearchModern" class="form-control" placeholder="Cari member, nama, telp, NIK..." oninput="window.filterPosCustomerModern()" autocomplete="off">
                                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                                        <div id="posCustomerResultsModern" class="pos-customer-results-modern hidden"></div>
                                    </div>

                                    <div id="posCustomerProfileCard" class="pos-customer-profile-card hidden">
                                        <div id="posCustomerAvatar" class="pos-customer-avatar">
                                            <img id="posCustomerAvatarImg" alt="Foto Identitas Nasabah" class="hidden">
                                            <i id="posCustomerAvatarFallback" class="fa-solid fa-id-card"></i>
                                        </div>
                                        <div class="pos-customer-info-grid">
                                            <span class="pos-customer-info-label">ID Member:</span>
                                            <span class="pos-customer-info-value" id="posCustIdVal">-</span>
                                            <span class="pos-customer-info-label">Nama:</span>
                                            <span class="pos-customer-info-value" id="posCustNameVal">-</span>
                                            <span class="pos-customer-info-label">No. Telp:</span>
                                            <span class="pos-customer-info-value" id="posCustPhoneVal">-</span>
                                            <span class="pos-customer-info-label">Alamat:</span>
                                            <span class="pos-customer-info-value" id="posCustAddressVal">-</span>
                                            <span class="pos-customer-info-label">Warga Negara:</span>
                                            <span class="pos-customer-info-value" id="posCustCitizenVal">-</span>
                                            <span class="pos-customer-info-label">Tipe:</span>
                                            <span class="pos-customer-info-value" id="posCustTypeVal">-</span>
                                            <span class="pos-customer-info-label">Poin:</span>
                                            <span class="pos-customer-info-value" id="posCustPointsVal" style="color: #f59e0b; font-weight: bold;">0</span>
                                        </div>
                                    </div>

                                    <div id="posCustActionsModern" class="flex-between mt-2 hidden" style="gap: 8px;">
                                        <button type="button" class="btn btn-sm btn-outline" style="flex: 1;" onclick="window.showPosCustomerDetail()">
                                            <i class="fa-solid fa-id-card"></i> Detail Info
                                        </button>
                                        <button type="button" class="btn btn-sm btn-outline text-danger" style="flex: 1;" onclick="window.clearPosCustomerSelection()">
                                            <i class="fa-solid fa-trash-can"></i> Hapus
                                        </button>
                                    </div>
                                </div>

                                <div class="pos-customer-history-panel">
                                    <div id="customerPosHistoryContainer" class="pos-customer-history-box" style="display:none;">
                                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; font-weight: bold;"><i class="fa-solid fa-history"></i> Riwayat Transaksi Nasabah (30 hari, per 5 hari)</div>
                                        <div id="customerPosHistoryList" style="display: flex; flex-direction: column; gap: 6px;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="pos-card-modern pos-flow-card">
                            <div class="pos-card-header-modern">
                                <h3><i class="fa-solid fa-cash-register"></i> 4. DATA PEMBAYARAN</h3>
                            </div>

                            <div class="pos-payment-grid">
                                <div class="pos-entry-panel">
                                    <div class="pos-input-grid">
                                        <div class="form-group">
                                            <label>Metode Pembayaran</label>
                                            <select id="paymentMethod" class="form-control">
                                                <option value="CASH">Tunai (Kasir)</option>
                                                <option value="TRANSFER">Transfer Bank</option>
                                                <option value="SPLIT">Split (Tunai + Transfer)</option>
                                            </select>
                                        </div>
                                        <div class="form-group" id="transferBankContainer" style="display: none;">
                                            <label>Tujuan Bank</label>
                                            <select id="transferBankTarget" class="form-control">
                                                <option value="BCA">Bank BCA</option>
                                                <option value="MANDIRI">Bank Mandiri</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Uang Diterima (Rp)</label>
                                            <input type="number" id="posCashReceivedModern" class="form-control" placeholder="0" oninput="window.recalculatePosChange()">
                                        </div>
                                    </div>

                                    <div id="transferPaymentContainer" class="hidden mt-3">
                                        <div class="form-group">
                                            <label>Bukti Transfer</label>
                                            <input type="file" id="transferProof" class="form-control" accept="image/*">
                                        </div>
                                    </div>

                                    <div id="splitPaymentContainer" class="hidden mt-3">
                                        <div class="pos-input-grid">
                                            <div class="form-group">
                                                <label>Tunai (Rp)</label>
                                                <input type="number" id="splitCashAmount" class="form-control" placeholder="0">
                                            </div>
                                            <div class="form-group">
                                                <label>Transfer (Rp)</label>
                                                <input type="number" id="splitTransferAmount" class="form-control" placeholder="0">
                                            </div>
                                        </div>
                                        <div class="form-group mt-2">
                                            <label>Bukti Transfer</label>
                                            <input type="file" id="splitTransferProof" class="form-control" accept="image/*">
                                        </div>
                                    </div>

                                    <div class="pos-input-grid mt-3">
                                        <div class="form-group">
                                            <label>Tujuan Transaksi</label>
                                            <select id="trxTransactionPurpose" class="form-control">
                                                <option value="PERJALANAN_WISATA">Perjalanan / Wisata</option>
                                                <option value="PERJALANAN_DINAS">Perjalanan Dinas</option>
                                                <option value="BISNIS_PERDAGANGAN">Bisnis / Perdagangan</option>
                                                <option value="PEMBAYARAN_BARANG_JASA">Pembayaran Barang / Jasa</option>
                                                <option value="PENDIDIKAN">Pendidikan</option>
                                                <option value="KESEHATAN">Kesehatan / Pengobatan</option>
                                                <option value="IBADAH">Ibadah / Keagamaan</option>
                                                <option value="BIAYA_HIDUP">Biaya Hidup di Luar Negeri</option>
                                                <option value="KELUARGA_REMITANSI">Keluarga / Remitansi</option>
                                                <option value="INVESTASI">Investasi</option>
                                                <option value="TABUNGAN_SIMPANAN">Tabungan / Simpanan</option>
                                                <option value="LAINNYA">Lainnya</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Sumber Dana</label>
                                            <select id="trxSourceOfFunds" class="form-control">
                                                <option value="GAJI">Gaji / Penghasilan Rutin</option>
                                                <option value="HASIL_USAHA">Hasil Usaha</option>
                                                <option value="TABUNGAN">Tabungan Pribadi</option>
                                                <option value="HASIL_INVESTASI">Hasil Investasi</option>
                                                <option value="PENJUALAN_ASET">Penjualan Aset</option>
                                                <option value="PINJAMAN">Pinjaman</option>
                                                <option value="WARISAN_HIBAH">Warisan / Hibah</option>
                                                <option value="PENSIUN">Pensiun</option>
                                                <option value="TRANSFER_KELUARGA">Transfer Keluarga</option>
                                                <option value="REIMBURSEMENT">Reimbursement / Biaya Dinas</option>
                                                <option value="LAINNYA">Lainnya</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div class="pos-input-grid mt-3">
                                        <div class="form-group">
                                            <label>Diskon (Rp)</label>
                                            <input type="number" id="posDiscountModern" class="form-control" placeholder="0" oninput="window.recalculatePosGrandTotal()">
                                        </div>
                                        <div class="form-group">
                                            <label>Biaya Lain (Rp)</label>
                                            <input type="number" id="posFeeModern" class="form-control" placeholder="0" oninput="window.recalculatePosGrandTotal()">
                                        </div>
                                    </div>

                                    <label id="posWaGatewayOption" style="display:flex; align-items:flex-start; gap:9px; margin:14px 0 8px; padding:10px 12px; border:1px solid rgba(37,211,102,.25); border-radius:8px; background:rgba(37,211,102,.06); cursor:pointer;">
                                        <input type="checkbox" id="posSendWaGateway" style="width:17px; height:17px; margin-top:2px; accent-color:#25D366;">
                                        <span style="line-height:1.35;">
                                            <strong style="color:#25D366;"><i class="fa-brands fa-whatsapp"></i> Kirim WA otomatis</strong>
                                            <small id="posWaGatewayHint" class="text-muted" style="display:block;">Kirim ucapan terima kasih ke nasabah setelah transaksi berhasil.</small>
                                        </span>
                                    </label>

                                    <button id="btnProcessPayment" class="btn btn-primary btn-block btn-lg disabled" onclick="processPayment()" disabled>
                                        <i class="fa-solid fa-check-double"></i> Proses Transaksi (F5)
                                    </button>

                                    <div class="mt-3 pos-print-actions">
                                        <button id="btnPrintReceipt" class="btn btn-secondary btn-block hidden"><i class="fa-solid fa-print"></i> Cetak Struk (Thermal)</button>
                                        <button id="btnPrintInvoice" class="btn btn-info btn-block hidden"><i class="fa-solid fa-file-invoice"></i> Cetak Invoice (Dot Matrix)</button>
                                        <button id="btnSendWA" class="btn btn-success btn-block hidden"><i class="fa-brands fa-whatsapp"></i> Kirim WA</button>
                                    </div>
                                </div>

                                <div class="pos-entry-panel">
                                    <div class="pos-input-grid">
                                        <div class="form-group">
                                            <label>Pengambil Valas</label>
                                            <select id="trxReceiver" class="form-control">
                                                <option value="SAME">Sama dengan Nasabah</option>
                                                <option value="MANUAL">Isi Manual</option>
                                            </select>
                                            <input type="text" id="trxReceiverManual" class="form-control mt-2 hidden" placeholder="Tulis nama pengambil manual">
                                        </div>
                                        <div class="form-group">
                                            <label>Upload Underlying</label>
                                            <input type="file" id="trxUnderlyingFile" class="form-control" accept="image/*,.pdf">
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label>Catatan / Underlying</label>
                                        <textarea id="trxKeteranganModern" class="form-control" rows="3" placeholder="Catatan tambahan transaksi atau alasan underlying..." style="resize: none;"></textarea>
                                    </div>

                                    <div class="pos-photo-box">
                                        <label><i class="fa-solid fa-camera"></i> Foto Nasabah / Pengambil</label>
                                        <div class="pos-photo-row">
                                            <div id="trxCustomerPhotoPlaceholder" class="pos-photo-placeholder">
                                                <i class="fa-solid fa-user"></i>
                                            </div>
                                            <img id="trxCustomerPhotoPreview" src="" alt="Foto Wajah Nasabah" class="pos-photo-preview">
                                            <div class="pos-photo-actions">
                                                <button type="button" class="btn btn-sm btn-outline" onclick="window.openTrxCustomerCamera()"><i class="fa-solid fa-video"></i> Ambil Gambar</button>
                                                <button type="button" class="btn btn-sm btn-outline text-danger" id="btnRemoveTrxCustomerPhoto" onclick="window.removeTrxCustomerPhoto()"><i class="fa-solid fa-trash"></i> Hapus Foto</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div id="posFloatingTotalPopup" class="hidden" style="position: fixed; top: 90px; right: 20px; z-index: 99998; width: min(360px, calc(100vw - 32px)); pointer-events: auto;">
                    <div class="panel" style="padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(148, 163, 184, 0.18); background: rgba(15, 23, 42, 0.96); box-shadow: 0 20px 60px rgba(0,0,0,0.45); backdrop-filter: blur(14px);">
                        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                            <div>
                                <div id="posFloatingTotalCaption" style="color:#94a3b8; font-size:0.72rem; font-weight:800; letter-spacing:0.03em; text-transform:uppercase;">Transaksi Selesai</div>
                                <div id="posFloatingTotalTitle" style="margin-top:4px; color:#f8fafc; font-size:1rem; font-weight:800; line-height:1.25;">Total Rupiah yang Harus Dikeluarkan</div>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline" onclick="window.hidePosFloatingTotalPopup()" style="min-width: 32px; width: 32px; height: 32px; padding: 0; border-radius: 8px;"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div id="posFloatingTotalAmount" style="margin-top:12px; font-size:2rem; line-height:1.05; font-weight:900; letter-spacing:-0.02em;">Rp 0</div>
                        <div id="posFloatingTotalMeta" style="margin-top:8px; color:#cbd5e1; font-size:0.8rem; line-height:1.35;">-</div>
                        <div style="margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                            <span id="posFloatingTotalBadge" style="display:inline-flex; align-items:center; padding:4px 8px; border-radius:999px; background: rgba(59,130,246,0.16); color:#93c5fd; font-size:0.72rem; font-weight:800;">-</span>
                            <span style="color:#94a3b8; font-size:0.72rem;">Popup ini muncul setelah transaksi diproses.</span>
                        </div>
                    </div>
                </div>

                <!-- Daftar Booking View (dirender oleh public/js/modules/42-booking.js) -->
                <section id="booking-view" class="view-section hidden">
                    <div id="bookingRoot"></div>
                </section>

                <!-- Antrean Permintaan Valas (Waiting List) View -->
                <section id="waiting-list-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #EC4899;">
                        <div>
                            <h2 style="color: #EC4899;"><i class="fa-solid fa-hourglass-half"></i> Antrean Permintaan Valas (Empty/Out of Stock)</h2>
                            <p class="text-muted mt-2">Daftar permintaan valas dari nasabah ketika stok sedang kosong. Anda dapat mengabari nasabah langsung via WhatsApp ketika valas sudah ready.</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-primary" onclick="addWaitingListEntry()" style="background:#EC4899; color:white; border:none; display: flex; align-items: center; gap: 6px; font-weight: bold;"><i class="fa-solid fa-plus-circle"></i> Tambah Antrean</button>
                            <button class="btn btn-secondary" onclick="loadWaitingListTable()"><i class="fa-solid fa-rotate-right"></i> Segarkan</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <!-- Filters and Search -->
                        <div class="flex-between mb-4" style="flex-wrap: wrap; gap: 15px; display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; gap: 6px; background: rgba(15, 23, 42, 0.4); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                <button class="btn btn-sm waiting-list-tab active" data-status="ALL" onclick="setWaitingListFilter('ALL')" style="background: #EC4899; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer;">Semua</button>
                                <button class="btn btn-sm waiting-list-tab" data-status="PENDING" onclick="setWaitingListFilter('PENDING')" style="background: rgba(255,255,255,0.03); color: #94a3b8; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer;">Menunggu</button>
                                <button class="btn btn-sm waiting-list-tab" data-status="READY" onclick="setWaitingListFilter('READY')" style="background: rgba(255,255,255,0.03); color: #94a3b8; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer;">Ready</button>
                                <button class="btn btn-sm waiting-list-tab" data-status="CANCELLED" onclick="setWaitingListFilter('CANCELLED')" style="background: rgba(255,255,255,0.03); color: #94a3b8; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer;">Batal</button>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center; width: 100%; max-width: 320px;">
                                <i class="fa-solid fa-search" style="color: #94A3B8;"></i>
                                <input type="text" id="searchWaitingList" class="form-control" placeholder="Cari nama, no HP, valas, catatan..." oninput="filterWaitingList()" style="width: 100%; border-radius: 20px; font-size: 0.85rem; padding: 6px 12px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.1); color: white;">
                            </div>
                        </div>

                        <!-- Table -->
                        <div class="table-responsive">
                            <table class="table table-hover" style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="border-bottom: 2px solid rgba(255,255,255,0.08); text-align: left;">
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">Tanggal</th>
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">Nama Nasabah</th>
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">No. WhatsApp</th>
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; text-align: center;">Mata Uang</th>
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; text-align: right;">Jumlah Qty</th>
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">Catatan</th>
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; text-align: center;">Status</th>
                                        <th style="padding: 12px; color: #94a3b8; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; text-align: center;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="waitingListTableBody">
                                    <!-- Dynamic rows loaded by JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Penerjemah Bahasa View (&#64;2026-Alifiandra): dirender oleh public/js/modules/62-translator.js -->
                <section id="translator-view" class="view-section hidden">
                    <div id="translatorRoot"></div>
                </section>

                <!-- Obrolan Kasir View -->
                <section id="user-chat-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #EC4899; max-width: 1000px; margin: 0 auto;">
                        <div>
                            <h2 style="color: #EC4899;"><i class="fa-solid fa-comments"></i> Obrolan Kasir & Internal</h2>
                            <p class="text-muted mt-2">Komunikasi real-time antar sesama teller, admin, dan owner untuk koordinasi operasional.</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="window.minimizeUserChat()" class="btn btn-sm btn-outline" style="border-color: rgba(255,255,255,0.15); color: #f8fafc;"><i class="fa-solid fa-minus"></i> Minimize</button>
                            <button onclick="window.loadChatInterface()" class="btn btn-sm btn-outline" style="border-color: rgba(255,255,255,0.15); color: #f8fafc;"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
                        </div>
                    </div>

                    <div class="panel mt-4" style="padding: 0; display: flex; height: calc(100vh - 250px); min-height: 500px; max-height: 650px; overflow: hidden; border-radius: 12px; max-width: 1000px; margin: 20px auto 0;">
                        
                        <!-- Left Sidebar: Users List -->
                        <div style="width: 240px; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; background: rgba(15, 23, 42, 0.15); flex-shrink: 0;">
                            <div style="padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                <h3 style="font-size: 0.95rem; font-weight: 700; color: #f8fafc; margin: 0; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-address-book" style="color: #64748b;"></i> Kontak Aktif</h3>
                            </div>
                            <div id="userChatList" style="flex: 1; overflow-y: auto; padding: 12px 10px;">
                                <!-- Contact list loaded by JS -->
                            </div>
                        </div>

                        <!-- Right Panel: Message Box -->
                        <div style="flex: 1; display: flex; flex-direction: column; background: rgba(30, 41, 59, 0.05);">
                            
                            <!-- Header Room Details -->
                            <div style="padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(15, 23, 42, 0.2); display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #38bdf8;"></div>
                                    <h3 id="userChatHeaderTitle" style="font-size: 0.95rem; font-weight: 700; color: #f8fafc; margin: 0;">Semua Akun</h3>
                                </div>
                            </div>

                            <!-- Messages Content Window -->
                            <div id="userChatMessagesBody" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; background: rgba(15, 23, 42, 0.3);">
                                <!-- Message bubbles populated via JS -->
                            </div>

                            <!-- Message Send Bar -->
                            <div id="userChatAttachmentPreview" class="hidden" style="padding: 10px 20px; background: rgba(15, 23, 42, 0.78); border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                                <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                                    <div id="userChatAttachmentThumb" style="width: 42px; height: 42px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); display:flex; align-items:center; justify-content:center; color:#94a3b8; overflow:hidden;"></div>
                                    <div style="min-width:0;">
                                        <div id="userChatAttachmentName" style="font-size:0.82rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:420px;">Berkas dipilih</div>
                                        <div id="userChatAttachmentSize" style="font-size:0.68rem; color:#94a3b8;">-</div>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline text-danger" onclick="window.clearUserChatAttachment()" style="border-color:rgba(239,68,68,.25);"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                            <div style="padding: 15px 20px; background: rgba(30, 41, 59, 0.5); border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 10px; position: relative;">
                                <input type="file" id="userChatFileInput" style="display:none;" onchange="window.handleUserChatFileSelected(this)">
                                <input type="file" id="userChatImageInput" accept="image/*" style="display:none;" onchange="window.handleUserChatFileSelected(this)">
                                <button type="button" class="btn btn-outline" onclick="window.openUserChatFilePicker()" title="Kirim file" style="width:40px; height:40px; padding:0; display:flex; align-items:center; justify-content:center; border-color:rgba(148,163,184,.25); color:#cbd5e1;"><i class="fa-solid fa-paperclip"></i></button>
                                <button type="button" class="btn btn-outline" onclick="window.openUserChatImagePicker()" title="Kirim gambar" style="width:40px; height:40px; padding:0; display:flex; align-items:center; justify-content:center; border-color:rgba(148,163,184,.25); color:#cbd5e1;"><i class="fa-solid fa-image"></i></button>
                                <button type="button" class="btn btn-outline" onclick="window.toggleUserChatEmojiPicker()" title="Emotikon" style="width:40px; height:40px; padding:0; display:flex; align-items:center; justify-content:center; border-color:rgba(148,163,184,.25); color:#cbd5e1;"><i class="fa-regular fa-face-smile"></i></button>
                                <div id="userChatEmojiPicker" class="hidden" style="position:absolute; bottom:62px; left:112px; z-index:20; background:#0f172a; border:1px solid rgba(255,255,255,.12); border-radius:10px; padding:8px; box-shadow:0 12px 28px rgba(0,0,0,.35); display:grid; grid-template-columns:repeat(8, 30px); gap:4px;"></div>
                                <input type="text" id="userChatInputMessage" class="form-control" placeholder="Ketik pesan Anda di sini..." style="flex: 1; margin: 0; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148,163,184,0.25); color: #f8fafc; border-radius: 8px; padding: 10px 15px;">
                                <button id="btnSendUserChat" class="btn btn-primary" style="padding: 10px 20px; background: #EC4899; border-color: #EC4899; color: #fff; border-radius: 8px; font-weight: bold; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-paper-plane"></i> Kirim</button>
                            </div>

                        </div>
                    </div>
                </section>

                <!-- Penyimpanan Berkas View (&#64;2026-Alifiandra): dirender oleh public/js/modules/60-documents.js -->
                <section id="documents-view" class="view-section hidden">
                    <div id="docsRoot"></div>
                </section>

                <!-- Chat AI View (&#64;2026-Alifiandra): dirender oleh public/js/modules/61-ai-assistant.js -->
                <section id="ai-chat-view" class="view-section hidden">
                    <div id="aiChatRoot"></div>
                </section>

                <!-- Kurs Hari Ini -->
                <section id="kurs-hari-ini-view" class="view-section hidden">
                    <!-- Seluruh isi dirender oleh public/js/modules/41-kurs-hari-ini.js -->
                    <div id="kursRoot"></div>
                </section>


                <!-- Currency Rate View -->
                <section id="currency-view" class="view-section hidden">
                    <!-- Seluruh isi dirender oleh public/js/modules/47-kurs-page.js -->
                    <div id="kursMgrRoot"></div>
                </section>

                <!-- Nomor Surat (&#64;2026-Alifiandra): dirender oleh public/js/modules/28-letter-number.js -->
                <section id="letter-number-view" class="view-section hidden">
                    <div id="letter-number-module-root"></div>
                </section>

                <!-- Old Money View -->
                <section id="old-money-view" class="view-section hidden">
                    <!-- Koin & Uang Lama (dirender oleh public/js/modules/43-koin-uang-lama.js) -->
                    <div id="omRoot"></div>
                </section>

                <!-- Report View -->
                <section id="reports-view" class="view-section hidden">
                    <style>
                        #reports-view .report-ledger-card {
                            display: grid;
                            grid-template-columns: minmax(190px, 1.2fr) repeat(3, minmax(150px, 1fr));
                            gap: 10px;
                            margin: 14px 0 16px;
                            padding: 12px;
                            border: 1px solid rgba(148, 163, 184, 0.22);
                            border-radius: 8px;
                            background: rgba(15, 23, 42, 0.34);
                        }
                        #reports-view .report-ledger-item {
                            min-height: 58px;
                            padding: 10px 12px;
                            border: 1px solid rgba(148, 163, 184, 0.18);
                            border-radius: 7px;
                            background: rgba(2, 6, 23, 0.18);
                        }
                        #reports-view .report-ledger-item span {
                            display: block;
                            margin-bottom: 5px;
                            color: var(--text-muted);
                            font-size: 0.72rem;
                            font-weight: 800;
                            letter-spacing: 0;
                            text-transform: uppercase;
                        }
                        #reports-view .report-ledger-item strong {
                            display: block;
                            color: var(--text-primary);
                            font-size: 1rem;
                            line-height: 1.15;
                            white-space: nowrap;
                        }
                        #reports-view .report-ledger-wrap {
                            max-height: 68vh;
                            overflow: auto;
                            border: 1px solid rgba(148, 163, 184, 0.24);
                            border-radius: 8px;
                            background: rgba(255, 255, 255, 0.02);
                        }
                        #reports-view .report-ledger-table {
                            width: 100%;
                            margin: 0;
                            border-collapse: collapse;
                            font-size: 0.78rem;
                            line-height: 1.2;
                        }
                        #reports-view .report-ledger-table thead th {
                            position: sticky;
                            top: 0;
                            z-index: 2;
                            padding: 7px 8px;
                            border-bottom: 1px solid rgba(148, 163, 184, 0.34);
                            background: var(--bg-card);
                            color: var(--text-muted);
                            font-size: 0.72rem;
                            font-weight: 800;
                            text-transform: uppercase;
                            white-space: nowrap;
                        }
                        #reports-view .report-ledger-table tbody td {
                            padding: 5px 8px;
                            border-bottom: 1px solid rgba(148, 163, 184, 0.18);
                            color: var(--text-primary);
                            vertical-align: middle;
                            white-space: nowrap;
                        }
                        #reports-view .report-ledger-table tbody tr:nth-child(even) td {
                            background: rgba(148, 163, 184, 0.04);
                        }
                        #reports-view .report-ledger-table tbody tr:hover td {
                            background: rgba(59, 130, 246, 0.08);
                        }
                        #reports-view .report-action-cell {
                            min-width: 230px;
                        }
                        #reports-view .report-row-actions {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 4px;
                            flex-wrap: nowrap;
                        }
                        #reports-view .report-wa-template {
                            width: 108px !important;
                            min-width: 108px;
                            height: 28px !important;
                            padding: 2px 6px !important;
                            margin: 0 !important;
                            font-size: 0.72rem !important;
                            line-height: 1;
                        }
                        #reports-view .report-row-actions .btn {
                            width: 28px;
                            min-width: 28px;
                            height: 28px;
                            padding: 0;
                            margin: 0 !important;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 6px;
                            font-size: 0.78rem;
                        }
                        @media (max-width: 1100px) {
                            #reports-view .report-ledger-card {
                                grid-template-columns: repeat(2, minmax(160px, 1fr));
                            }
                        }
                    </style>
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Riwayat Transaksi (Buku Besar)</h2>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <input type="file" id="historicalTrxInput" class="form-control" accept=".xlsx, .xls, .csv" style="max-width: 250px;" title="Gunakan file hasil Export Excel">
                            <button class="btn btn-success" onclick="uploadHistoricalTransactions()"><i class="fa-solid fa-upload"></i> Upload Histori</button>
                            <button class="btn btn-primary" onclick="exportTableToExcel('reportTable', 'Laporan_Transaksi')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-info" onclick="printBulkReceipts()" style="background: #3b82f6; color: white; border: none;"><i class="fa-solid fa-print"></i> Cetak Masal</button>
                            <button class="btn btn-danger" onclick="deleteAllTransactions()"><i class="fa-solid fa-trash-can"></i> Hapus Semua</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak Tampilan</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div class="filter-controls">
                            <!-- Row 1: 5 Kategori -->
                            <div class="form-group row mb-2">
                                <div class="col">
                                    <label>Cari Invoice</label>
                                    <input type="text" id="filterInvoice" class="form-control" placeholder="No. Invoice">
                                </div>
                                <div class="col">
                                    <label>Ketik Nama</label>
                                    <input type="text" id="filterNama" class="form-control" placeholder="Nama Nasabah">
                                </div>
                                <div class="col">
                                    <label>Ketik No HP</label>
                                    <input type="text" id="filterHp" class="form-control" placeholder="No Tlp/HP">
                                </div>
                                <div class="col">
                                    <label>Mata Uang</label>
                                    <select id="filterValuta" class="form-control">
                                        <option value="">-- Semua --</option>
                                    </select>
                                </div>
                                <div class="col">
                                    <label>Tipe Transaksi</label>
                                    <select id="filterTipe" class="form-control">
                                        <option value="">-- Semua --</option>
                                        <option value="JUAL">JUAL</option>
                                        <option value="BELI">BELI</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Row 2: Tanggal & Action -->
                            <div class="form-group row">
                                <div class="col-md-4">
                                    <label>Dari Tanggal</label>
                                    <input type="date" id="reportStartDate" class="form-control">
                                </div>
                                <div class="col-md-4">
                                    <label>Sampai Tanggal</label>
                                    <input type="date" id="reportEndDate" class="form-control">
                                </div>
                                <div class="col-md-4" style="display: flex; align-items: flex-end; gap: 10px;">
                                    <button class="btn btn-secondary" id="btnFilterReport" style="flex: 2;">Tampilkan Riwayat</button>
                                    <button type="button" class="btn btn-outline" style="flex: 1; border: 1px solid #94a3b8; color: #94a3b8;" onclick="window.resetReportFilter()">Reset</button>
                                </div>
                            </div>
                        </div>

                        <div class="report-ledger-card" data-role-special="transactionLedgerCard">
                            <div class="report-ledger-item">
                                <span>Transaksi (Buku Besar)</span>
                                <strong id="reportLedgerTotalTrx">0 Transaksi</strong>
                            </div>
                            <div class="report-ledger-item">
                                <span>Total Beli</span>
                                <strong id="reportLedgerTotalBuy">Rp 0</strong>
                            </div>
                            <div class="report-ledger-item">
                                <span>Total Jual</span>
                                <strong id="reportLedgerTotalSell">Rp 0</strong>
                            </div>
                            <div class="report-ledger-item">
                                <span>Net Rupiah</span>
                                <strong id="reportLedgerNet">Rp 0</strong>
                            </div>
                        </div>

                        <div class="table-responsive mt-3 report-ledger-wrap">
                            <table class="table report-ledger-table" id="reportTable">
                                <thead>
                                    <tr>
                                        <th>Tanggal/Waktu</th>
                                        <th>No. Invoice</th>
                                        <th>Tipe</th>
                                        <th>ID Nasabah</th>
                                        <th>Valuta</th>
                                        <th>Nominal Valuta</th>
                                        <th>Kurs/Rate</th>
                                        <th>Total IDR</th>
                                        <th style="text-align: center;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="reportTableBody">
                                    <!-- Injected -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Laporan Harian View -->
                <section id="harian-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan Harian (Daily Financial Report)</h2>
                            <p class="text-muted mt-2">Ringkasan Posisi Keuangan (Kas, Bank, dan Valuta Asing) HARI INI.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak Tampilan</button>
                            <button class="btn btn-primary" onclick="loadLaporanHarian()"><i class="fa-solid fa-rotate-right"></i> Perbarui</button>
                        </div>
                    </div>

                    <div class="stats-grid mt-4">
                        <div class="stat-card" style="border-left: 4px solid #F87171; background: rgba(30, 41, 59, 0.6);">
                            <div class="stat-icon" style="color:#F87171;"><i class="fa-solid fa-wallet"></i></div>
                            <div class="stat-details">
                                <h3>Saldo Kas Awal Harian</h3>
                                <p class="stat-value" id="harianKasAwal" style="color:#F87171;">Rp 0</p>
                                <small class="text-muted">Kas Akhir Kemarin</small>
                            </div>
                        </div>
                        <div class="stat-card" style="border-left: 4px solid #10B981; background: rgba(30, 41, 59, 0.6);">
                            <div class="stat-icon text-green"><i class="fa-solid fa-wallet"></i></div>
                            <div class="stat-details">
                                <h3>Saldo Kas Riil Saat Ini</h3>
                                <p class="stat-value text-green" id="harianKasAkhir">Rp 0</p>
                                <small class="text-muted">Brankas Uang Fisik</small>
                            </div>
                        </div>
                        <div class="stat-card" style="border-left: 4px solid #3B82F6; background: rgba(30, 41, 59, 0.6);">
                            <div class="stat-icon" style="color: #60A5FA;"><i class="fa-solid fa-building-columns"></i></div>
                            <div class="stat-details">
                                <h3>Saldo Rekening Bank (Total)</h3>
                                <p class="stat-value" id="harianTotalBank" style="color:#60A5FA;">Rp 0</p>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 5px;">
                                    <span style="color:#93c5fd;">BCA: Rp <strong id="harianBankBCA">0</strong></span>
                                    <span style="color:#fde047;">Mandiri: Rp <strong id="harianBankMandiri">0</strong></span>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card" style="border-left: 4px solid #F59E0B; background: rgba(30, 41, 59, 0.6);">
                            <div class="stat-icon" style="color:#F59E0B;"><i class="fa-solid fa-arrow-trend-up"></i></div>
                            <div class="stat-details">
                                <h3>Profit Transaksi Valas</h3>
                                <p class="stat-value" id="harianProfit" style="color:#F59E0B;">Rp 0</p>
                                <small class="text-muted">Estimasi Keuntungan Hari Ini</small>
                            </div>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div class="flex-between mb-3">
                            <h3><i class="fa-solid fa-boxes-stacked"></i> Stok Valuta Asing Terkini</h3>
                            <button class="btn btn-sm btn-outline" onclick="exportTableToExcel('harianValasTable', 'Stok_Valuta_Hari_Ini')"><i class="fa-solid fa-file-excel"></i> Export Stok</button>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-bordered table-striped" id="harianValasTable">
                                <thead style="background:#1e293b; color:#cbd5e1;">
                                    <tr>
                                        <th>Mata Uang (Kode)</th>
                                        <th>Negara</th>
                                        <th style="text-align:right;">Sisa Stok (Lembar/Asing)</th>
                                        <th style="text-align:right;">Rata-rata Kurs Beli (Modal)</th>
                                        <th style="text-align:right;">Estimasi Total Valuasi (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody id="harianValasTableBody">
                                    <tr><td colspan="5" class="text-center text-muted">Memuat data valuta...</td></tr>
                                </tbody>
                                <tfoot style="background:#0f172a; color:#fff;">
                                    <tr>
                                        <th colspan="4" class="text-end py-3">Total Valuasi Global Seluruh Valas:</th>
                                        <th id="harianTotalValuasiAsing" class="text-end text-success py-3" style="font-size: 1.1rem;">Rp 0</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- HRIS View (&#64;2026-Alifiandra) : UI dirender oleh public/js/modules/59-hris.js -->
                <section id="hris-view" class="view-section hidden">
                    <div id="hrisRoot"></div>
                </section>

                <!-- Customer Preview Modal -->
                <div id="customerPreviewModal" class="modal">
                    <div class="modal-content panel" style="width: 95%; max-width: 1100px; max-height: 90vh; overflow-y: auto;">
                        <div class="modal-header flex-between mb-4">
                            <h3 style="color: #0ea5e9;"><i class="fa-solid fa-address-card"></i> Preview Data Nasabah</h3>
                            <span class="close-modal" onclick="closeCustomerPreviewModal()"><i class="fa-solid fa-xmark"></i></span>
                        </div>
                        <div class="row" style="display: flex; gap: 30px; flex-wrap: wrap;">
                            <div class="col" style="flex: 1; min-width: 350px;">
                                <table class="table table-sm table-borderless" style="font-size: 0.95rem;">
                                    <tr><td style="width: 150px; color: #94A3B8;">ID Nasabah (Sistem)</td><td>: <strong id="previewCustId" style="color: #f8fafc;">-</strong></td></tr>
                                    <tr><td style="color: #94A3B8;">Nama Lengkap</td><td>: <strong id="previewCustName" style="color: #f8fafc;">-</strong></td></tr>
                                    <tr><td style="color: #94A3B8;">Tipe (KN)</td><td>: <span id="previewCustType" style="color: #e2e8f0;">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">No. Handphone</td><td>: <span id="previewCustPhone" style="color: #10B981;">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">TTL</td><td>: <span id="previewCustBirth">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">Alamat</td><td>: <span id="previewCustAddress">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">Jenis Kelamin</td><td>: <span id="previewCustGender">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">Kewarganegaraan</td><td>: <span id="previewCustCitizen">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">Pekerjaan</td><td>: <span id="previewCustJob">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">Jenis ID</td><td>: <span id="previewCustIdType">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">No KTP / Dokumen</td><td>: <span id="previewCustKtp" style="color: #f8fafc;">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">ID Lainnya</td><td>: <span id="previewCustOtherId">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">No. CIF (Reporting)</td><td>: <span id="previewCustCif">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">NPWP</td><td>: <span id="previewCustNpwp">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">No Rekening</td><td>: <span id="previewCustBank">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">ID Lokal (Member)</td><td>: <span id="previewCustLocalId">-</span></td></tr>
                                    <tr><td style="color: #94A3B8;">Tanggal Terdaftar</td><td>: <span id="previewCustRegDate">-</span></td></tr>
                                </table>
                            </div>
                            <div class="col" style="flex: 2; min-width: 450px; text-align: center;">
                                <div style="background: rgba(15,23,42,0.6); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                    <h4 style="color: #94A3B8; margin-bottom: 15px; font-size: 0.9rem;">Foto KTP / Identitas</h4>
                                    <div style="min-height: 250px; display: flex; align-items: center; justify-content: center; width: 100%;">
                                        <img id="previewCustPhotoImg" src="" alt="Identitas" style="max-width: 100%; max-height: 700px; border-radius: 8px; display: none; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                                        <div id="previewCustPhotoPlaceholder" style="color: #64748b; font-style: italic; display: none; flex-direction: column; align-items: center;">
                                            <i class="fa-solid fa-image" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.5;"></i>
                                            <p>Tidak ada foto identitas</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top: 20px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 15px; text-align: right; display: flex; gap: 10px; justify-content: flex-end;">
                            <button class="btn btn-primary" onclick="editFromPreview()"><i class="fa-solid fa-pen"></i> Edit Data Ini</button>
                            <button class="btn btn-secondary" onclick="closeCustomerPreviewModal()"><i class="fa-solid fa-check"></i> Tutup Preview</button>
                        </div>
                    </div>
                </div>

                <!-- Customers View -->

                <section id="customers-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Data Nasabah (KYC)</h2>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <button class="btn btn-primary" onclick="openCustomerModal()"><i class="fa-solid fa-plus"></i> Tambah Nasabah</button>
                        </div>
                    </div>

                    <div class="panel mt-3 cx-import" data-role-special="customerImportTools">
                        <div class="cx-import-head">
                            <div>
                                <div class="cx-title"><i class="fa-solid fa-file-import"></i> Impor Data Nasabah</div>
                                <div class="cx-sub">Unggah file Excel/CSV. Nasabah dengan ID yang sama diperbarui; kolom yang dikosongkan tidak menimpa data lama.</div>
                            </div>
                            <div class="cx-import-tools">
                                <button type="button" class="cx-btn ghost" onclick="downloadCustomerTemplate()"><i class="fa-solid fa-download"></i> Unduh Template</button>
                                <button type="button" class="cx-btn danger" onclick="resetAllCustomersData()"><i class="fa-solid fa-trash-can"></i> Reset Data</button>
                            </div>
                        </div>
                        <div class="cx-drop" id="cxDrop">
                            <input type="file" id="customerExcelInput" accept=".xlsx,.xls,.csv" style="display:none">
                            <i class="fa-solid fa-cloud-arrow-up cx-drop-ico"></i>
                            <div class="cx-drop-text">
                                <b id="customerExcelFileName">Belum ada file dipilih</b>
                                <small>Tarik file ke sini, atau klik Pilih File. Format .xlsx, .xls, atau .csv</small>
                            </div>
                            <button type="button" class="cx-btn ghost" id="cxPick"><i class="fa-regular fa-folder-open"></i> Pilih File</button>
                            <button type="button" class="cx-btn primary" id="btnCustomerExcelUpload" disabled><i class="fa-solid fa-file-import"></i> Proses Import</button>
                        </div>
                        <details class="cx-format">
                            <summary>Lihat format kolom</summary>
                            <div>Wajib ada kolom <b>Nama</b>. Kolom lain opsional: ID_Nasabah, IDPJK, Tipe (1=perorangan, 2=perusahaan), Tempat_Lahir (Lokasi Terbit untuk perusahaan), Tanggal_Lahir (Tanggal Terbit), Alamat, Warga_Negara, Jenis_Kelamin, Pekerjaan, No_HP, No_Rekening, No_KTP, Selain_KTP, No_CIF, NPWP, Local_ID, Tgl_Daftar, Jenis_ID, Jenis_Badan_Usaha, Bidang_Usaha, NIB. Tanpa ID_Nasabah, sistem membuat ID baru (atau mencocokkan No_KTP yang sudah ada).</div>
                        </details>
                    </div>

                    <div class="cx-stats" id="cxStats"></div>

                    <style>
                        #customers-view .cx-import{padding:18px 20px}
                        #customers-view .cx-import-head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px}
                        #customers-view .cx-title{font-weight:800;font-size:1rem;display:flex;gap:9px;align-items:center}
                        #customers-view .cx-sub{font-size:.8rem;opacity:.7;margin-top:4px;max-width:640px;line-height:1.45}
                        #customers-view .cx-import-tools{display:flex;gap:8px;flex-wrap:wrap}
                        #customers-view .cx-btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:transparent;color:inherit;font-weight:700;font-size:.82rem;cursor:pointer;font-family:inherit;white-space:nowrap}
                        #customers-view .cx-btn:hover{border-color:#3b82f6;color:#3b82f6}
                        #customers-view .cx-btn.primary{background:#10B981;border-color:#10B981;color:#fff}
                        #customers-view .cx-btn.primary:hover{background:#059669;color:#fff}
                        #customers-view .cx-btn.primary:disabled{opacity:.45;cursor:not-allowed}
                        #customers-view .cx-btn.danger{border-color:rgba(239,68,68,.5);color:#ef4444}
                        #customers-view .cx-btn.danger:hover{background:#ef4444;color:#fff;border-color:#ef4444}
                        #customers-view .cx-drop{display:flex;align-items:center;gap:14px;flex-wrap:wrap;border:2px dashed rgba(148,163,184,.45);border-radius:14px;padding:14px 16px;transition:.15s}
                        #customers-view .cx-drop.drag{border-color:#3b82f6;background:rgba(59,130,246,.08)}
                        #customers-view .cx-drop.has-file{border-style:solid;border-color:#10B981;background:rgba(16,185,129,.06)}
                        #customers-view .cx-drop-ico{font-size:1.6rem;opacity:.6}
                        #customers-view .cx-drop-text{flex:1;min-width:200px}
                        #customers-view .cx-drop-text b{display:block;font-size:.9rem;word-break:break-all}
                        #customers-view .cx-drop-text small{opacity:.65;font-size:.76rem}
                        #customers-view .cx-format{margin-top:12px;font-size:.8rem}
                        #customers-view .cx-format summary{cursor:pointer;font-weight:700;opacity:.8}
                        #customers-view .cx-format div{margin-top:8px;line-height:1.55;opacity:.8}

                        #customers-view .cx-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:16px}
                        #customers-view .cx-stat{display:flex;gap:14px;align-items:center;padding:16px 18px;border-radius:14px;border:1px solid rgba(148,163,184,.25);background:rgba(148,163,184,.06)}
                        #customers-view .cx-stat-ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex:none}
                        #customers-view .cx-stat.blue .cx-stat-ico{background:rgba(59,130,246,.16);color:#3b82f6}
                        #customers-view .cx-stat.green .cx-stat-ico{background:rgba(16,185,129,.16);color:#10b981}
                        #customers-view .cx-stat.amber .cx-stat-ico{background:rgba(245,158,11,.16);color:#f59e0b}
                        #customers-view .cx-stat.violet .cx-stat-ico{background:rgba(139,92,246,.16);color:#8b5cf6}
                        #customers-view .cx-stat.teal .cx-stat-ico{background:rgba(20,184,166,.16);color:#14b8a6}
                        #customers-view .cx-stat-label{font-size:.74rem;opacity:.7;font-weight:600}
                        #customers-view .cx-stat-val{font-size:1.55rem;font-weight:800;line-height:1.15;font-variant-numeric:tabular-nums}
                        #customers-view .cx-stat-sub{font-size:.7rem;opacity:.55;margin-top:1px}

                        #customers-view .customer-table-panel{padding:16px 18px}
                        #customers-view .cx-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
                        #customers-view .cx-search{position:relative;flex:1 1 280px;min-width:220px}
                        #customers-view .cx-search>i{position:absolute;left:13px;top:50%;transform:translateY(-50%);opacity:.5;pointer-events:none}
                        #customers-view .cx-search #searchCustomerInput{width:100%;height:40px;padding:0 38px 0 38px;border-radius:10px;margin:0}
                        #customers-view .cx-search button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:50%;background:rgba(148,163,184,.3);color:inherit;cursor:pointer;display:none;align-items:center;justify-content:center;font-size:.7rem}
                        #customers-view .cx-toolbar select,#customers-view .cx-toolbar input[type=date]{height:40px;border-radius:10px;margin:0;font-size:.82rem}
                        #customers-view .cx-dates{display:flex;gap:6px;align-items:center}
                        #customers-view .cx-dates span{opacity:.55;font-size:.76rem}
                        #customers-view .cx-actions{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;align-items:center}
                        #customers-view .cx-actions .cx-btn{height:40px}
                        #customers-view .cx-menu{position:relative}
                        #customers-view .cx-menu-list{position:absolute;right:0;top:calc(100% + 6px);min-width:250px;background:var(--mc-card-bg,#1e293b);color:var(--mc-text,inherit);border:1px solid rgba(148,163,184,.3);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.28);padding:6px;display:none;z-index:60}
                        #customers-view .cx-menu-list.open{display:block}
                        #customers-view .cx-menu-list button{display:flex;width:100%;gap:10px;align-items:center;text-align:left;border:0;background:transparent;color:inherit;padding:10px 12px;border-radius:8px;cursor:pointer;font-size:.82rem;font-family:inherit}
                        #customers-view .cx-menu-list button:hover{background:rgba(59,130,246,.12)}
                        #customers-view .cx-menu-list hr{border:0;border-top:1px solid rgba(148,163,184,.25);margin:4px 0}
                        #customers-view .cx-sub-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}
                        #customers-view .cx-qd{display:flex;gap:6px;flex-wrap:wrap}
                        #customers-view .cx-qd button{border:1px solid rgba(148,163,184,.3);background:transparent;color:inherit;border-radius:999px;padding:4px 12px;font-size:.74rem;cursor:pointer;font-family:inherit}
                        #customers-view .cx-qd button:hover{border-color:#3b82f6;color:#3b82f6}
                        #customers-view .cx-count{font-size:.8rem;opacity:.75;margin-left:auto;font-weight:600}
                        #customers-view .cx-active{display:none;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
                        #customers-view .cx-chip{display:inline-flex;gap:6px;align-items:center;padding:4px 6px 4px 12px;border-radius:999px;background:rgba(59,130,246,.14);color:#3b82f6;font-size:.76rem;font-weight:600}
                        #customers-view .cx-chip button{border:0;background:rgba(59,130,246,.25);color:inherit;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:.62rem}
                        #customers-view .cx-link{border:0;background:transparent;color:#3b82f6;cursor:pointer;font-size:.78rem;font-weight:700;text-decoration:underline;font-family:inherit}

                        #customers-view .customers-table-wrap{margin-top:12px;border:1px solid rgba(148,163,184,.25);border-radius:12px;max-height:62vh;overflow:auto}
                        #customers-view .customers-ledger-table{border-collapse:separate;border-spacing:0;font-size:.8rem;margin:0;width:100%}
                        #customers-view .customers-ledger-table thead th{position:sticky;top:0;z-index:3;background:var(--mc-table-head,var(--mc-card-bg,#1e293b));padding:11px 10px;font-size:.7rem;letter-spacing:.04em;text-transform:uppercase;opacity:1;color:var(--mc-text-muted,#94a3b8);border-bottom:1px solid rgba(148,163,184,.3);white-space:nowrap}
                        #customers-view .customers-ledger-table tbody td{padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.14);vertical-align:middle;white-space:nowrap;background:transparent}
                        #customers-view .customers-ledger-table tbody tr:hover td{background:rgba(59,130,246,.07)}
                        #customers-view .customers-ledger-table .customer-name-cell{min-width:200px;white-space:normal}
                        #customers-view .customers-ledger-table .customer-address-cell{max-width:260px;overflow:hidden;text-overflow:ellipsis}
                        #customers-view .customers-ledger-table thead th:last-child{right:0;z-index:4}
                        #customers-view .customers-ledger-table .customer-action-cell{position:sticky;right:0;background:var(--mc-card-bg,#1e293b);z-index:2;box-shadow:-6px 0 12px rgba(0,0,0,.12);padding:6px 9px}
                        #customers-view .customer-row-actions{display:inline-flex;gap:5px}
                        #customers-view .customer-row-actions .btn{width:28px;height:28px;min-width:28px;padding:0;border-radius:8px;margin:0!important;display:inline-flex;align-items:center;justify-content:center;font-size:.72rem}
                        #customers-view .cx-kn{display:inline-block;min-width:22px;text-align:center;padding:2px 7px;border-radius:6px;font-weight:800;font-size:.72rem}
                        #customers-view .cx-kn.k1{background:rgba(16,185,129,.16);color:#10b981}
                        #customers-view .cx-kn.k2{background:rgba(245,158,11,.18);color:#f59e0b}
                        #customers-view .cx-audit{font-size:.66rem;opacity:.6;margin-top:2px}
                        #customers-view .cx-empty{text-align:center;padding:44px 16px!important;opacity:.75}
                        #customers-view .cx-empty i{font-size:2rem;display:block;margin-bottom:10px;opacity:.5}
                        #customers-view .cx-pager{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}
                        #customers-view .cx-pager-info{font-size:.8rem;opacity:.75}
                        #customers-view .cx-pager-nav{display:flex;gap:4px;flex-wrap:wrap}
                        #customers-view .cx-pager-nav button{min-width:34px;height:34px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:transparent;color:inherit;cursor:pointer;font-weight:700;font-size:.78rem;font-family:inherit}
                        #customers-view .cx-pager-nav button:hover:not(:disabled){border-color:#3b82f6;color:#3b82f6}
                        #customers-view .cx-pager-nav button.on{background:#3b82f6;border-color:#3b82f6;color:#fff}
                        #customers-view .cx-pager-nav button:disabled{opacity:.35;cursor:not-allowed}
                        #customers-view .cx-pager-nav .gap{padding:0 6px;align-self:center;opacity:.5}
                        @media(max-width:760px){#customers-view .cx-actions{margin-left:0}#customers-view .cx-count{margin-left:0;width:100%}}
                    </style>

                    <div class="panel mt-3 customer-table-panel">
                        <div class="cx-toolbar">
                            <div class="cx-search">
                                <i class="fa-solid fa-magnifying-glass"></i>
                                <input type="text" id="searchCustomerInput" class="form-control" placeholder="Cari nama, ID, no. HP, KTP, CIF, NPWP, alamat..." autocomplete="off">
                                <button type="button" id="cxSearchClear" title="Hapus pencarian"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                            <select id="filterCustomerType" class="form-control" style="width:auto">
                                <option value="ALL">Semua Tipe</option>
                                <option value="1">Perorangan</option>
                                <option value="2">Perusahaan</option>
                            </select>
                            <div class="cx-dates">
                                <input type="date" id="filterCustomerDateStart" class="form-control" title="Terdaftar dari tanggal">
                                <span>s.d</span>
                                <input type="date" id="filterCustomerDateEnd" class="form-control" title="Terdaftar sampai tanggal">
                            </div>
                            <div class="cx-actions">
                                <button type="button" class="cx-btn" onclick="openBlastWaModal()" title="Kirim WhatsApp ke nasabah yang dicentang"><i class="fa-brands fa-whatsapp" style="color:#25d366"></i> WA</button>
                                <div class="cx-menu">
                                    <button type="button" class="cx-btn" id="cxExportToggle"><i class="fa-solid fa-file-export"></i> Ekspor <i class="fa-solid fa-chevron-down" style="font-size:.65rem"></i></button>
                                    <div class="cx-menu-list" id="cxExportMenu">
                                        <button type="button" data-export="xlsx-filter"><i class="fa-solid fa-file-excel" style="color:#10b981"></i> Excel - sesuai hasil filter</button>
                                        <button type="button" data-export="xlsx-all"><i class="fa-solid fa-file-excel" style="color:#10b981"></i> Excel - semua nasabah</button>
                                        <button type="button" data-export="csv-filter"><i class="fa-solid fa-file-csv" style="color:#0ea5e9"></i> CSV - sesuai hasil filter</button>
                                        <hr>
                                        <button type="button" data-export="template"><i class="fa-solid fa-table" style="color:#f59e0b"></i> Template import kosong</button>
                                    </div>
                                </div>
                                <button type="button" class="cx-btn" onclick="printCustomersPdf()" title="Cetak / simpan PDF sesuai hasil filter"><i class="fa-solid fa-file-pdf" style="color:#ef4444"></i> PDF</button>
                            </div>
                        </div>
                        <div class="cx-sub-toolbar">
                            <div class="cx-qd">
                                <button type="button" data-qdate="today">Hari ini</button>
                                <button type="button" data-qdate="7">7 hari</button>
                                <button type="button" data-qdate="month">Bulan ini</button>
                                <button type="button" data-qdate="year">Tahun ini</button>
                            </div>
                            <select id="cxSort" class="form-control" style="width:auto;height:34px;font-size:.78rem;border-radius:8px;margin:0">
                                <option value="newest">Urutan: Terbaru</option>
                                <option value="oldest">Urutan: Terlama</option>
                                <option value="name_asc">Nama A-Z</option>
                                <option value="name_desc">Nama Z-A</option>
                            </select>
                            <select id="cxPageSize" class="form-control" style="width:auto;height:34px;font-size:.78rem;border-radius:8px;margin:0">
                                <option value="25">25 / halaman</option>
                                <option value="50" selected>50 / halaman</option>
                                <option value="100">100 / halaman</option>
                                <option value="250">250 / halaman</option>
                                <option value="0">Tampilkan semua</option>
                            </select>
                            <span class="cx-count" id="customerTotalSummary">0 nasabah</span>
                        </div>
                        <div class="cx-active" id="cxActive"></div>

                        <div class="table-responsive customers-table-wrap">
                            <table class="table customers-ledger-table">
                                <thead>
                                    <tr style="white-space: nowrap;">
                                        <th style="width:40px;text-align:center;"><input type="checkbox" id="chkAllCust" onchange="toggleAllCustomers(this)" title="Pilih semua pada halaman ini"></th>
                                        <th>IDPJK</th>
                                        <th>KN(tipe)</th>
                                        <th>NO TLP</th>
                                        <th>Nama Lengkap</th>
                                        <th>Tempat Lahir</th>
                                        <th>Tanggal Lahir</th>
                                        <th>Alamat</th>
                                        <th>Jenis ID</th>
                                        <th>No KTP</th>
                                        <th>ID Lain</th>
                                        <th>No CIF</th>
                                        <th>NPWP</th>
                                        <th>Local ID</th>
                                        <th>Jenis Kelamin</th>
                                        <th>Warga Negara</th>
                                        <th>Pekerjaan</th>
                                        <th>No Rekening</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="customersTableBody"></tbody>
                            </table>
                        </div>
                        <div class="cx-pager" id="cxPager"></div>
                    </div>
                </section>

                <!-- Mutations View -->
                <section id="mutation-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Data Mutasi Rekening Bank</h2>
                            <p class="text-muted mt-2" style="margin:4px 0 0;">Klik kartu bank untuk melihat rincian mutasi. Tabel di bawah adalah mutasi manual yang diinput kasir.</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <input type="file" id="historicalMutationInput" class="form-control" accept=".xlsx, .xls, .csv" style="max-width: 200px;" title="Gunakan file hasil Export Excel">
                            <button class="btn btn-success" onclick="uploadHistoricalMutations()"><i class="fa-solid fa-upload"></i> Upload Histori</button>
                            <button class="btn btn-primary" onclick="exportTableToExcel('mutationTable', 'Mutasi_Bank')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                            <button class="btn btn-success" onclick="openMutationModal()"><i class="fa-solid fa-plus"></i> Tambah Mutasi</button>
                        </div>
                    </div>
                    <!-- Kartu saldo per rekening bank (dari ledger ERP) -->
                    <div id="bankMutationCards" class="mt-4" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px;"></div>
                    <div id="bankMutationDetail" class="panel mt-4" style="display:none;"></div>

                    <div class="panel mt-4">
                        <div class="table-responsive">
                            <table class="table" id="mutationTable">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>ID Mutasi</th>
                                        <th>Tipe Mutasi</th>
                                        <th>Bank</th>
                                        <th>Keterangan</th>
                                        <th>Nominal (Rp)</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="mutationsTableBody">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Galeri Valas View -->
                <section id="valas-gallery-view" class="view-section hidden">
                    <!-- Galeri Valas (dirender oleh public/js/modules/11-gallery.js) -->
                    <div id="vgRoot"></div>
                </section>

                <!-- Gantungan View -->
                <section id="gantungan-view" class="view-section hidden">
                    <style id="gt-style">
                        .gt-root, .gt-overlay {
                            --gt-bd: var(--mc-border, rgba(148,163,184,.28));
                            --gt-card: var(--mc-card-bg, #18181b);
                            --gt-tx: var(--mc-text, #fafafa);
                            --gt-mut: var(--mc-text-muted, #a1a1aa);
                            --gt-pri: var(--mc-primary, #22c55e);
                            --gt-ok: var(--mc-buy, #22c55e);
                            --gt-bad: var(--mc-danger, #ef4444);
                            --gt-warn: var(--mc-warning, #f59e0b);
                            --gt-info: var(--mc-info, #3b82f6);
                            --gt-r: var(--mc-radius, 12px);
                            --gt-br: var(--mc-btn-radius, 8px);
                            --gt-ir: var(--mc-input-radius, 8px);
                            --gt-soft: color-mix(in srgb, var(--gt-tx) 5%, transparent);
                            --gt-soft2: color-mix(in srgb, var(--gt-tx) 9%, transparent);
                            --gt-in-bg: var(--mc-input-bg, color-mix(in srgb, var(--gt-tx) 6%, var(--gt-card)));
                            --gt-in-bd: var(--mc-input-border, var(--gt-bd));
                            color: var(--gt-tx);
                        }
                        .gt-root { display: block; }
                        .gt-root *, .gt-overlay * { box-sizing: border-box; }
                        .gt-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; background: var(--gt-card); border: 1px solid var(--gt-bd); border-left: 4px solid var(--gt-warn); border-radius: var(--gt-r); padding: 18px 20px; box-shadow: var(--mc-shadow, none); }
                        .gt-head h2 { margin: 0; font-size: 1.35rem; display: flex; align-items: center; gap: 10px; color: var(--gt-warn); }
                        .gt-head p { margin: 6px 0 0; color: var(--gt-mut); max-width: 62ch; line-height: 1.5; font-size: .92rem; }
                        .gt-head p b { color: var(--gt-tx); }
                        .gt-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }

                        .gt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid transparent; border-radius: var(--gt-br); padding: 9px 15px; font: inherit; font-size: .88rem; font-weight: 600; cursor: pointer; transition: filter .15s, transform .05s, background .15s; line-height: 1.2; }
                        .gt-btn:disabled { opacity: .55; cursor: not-allowed; }
                        .gt-btn:active:not(:disabled) { transform: translateY(1px); }
                        .gt-btn-primary { background: var(--gt-pri); color: var(--mc-primary-contrast, #fff); }
                        .gt-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
                        .gt-btn-ghost { background: var(--gt-soft); color: var(--gt-tx); border-color: var(--gt-bd); }
                        .gt-btn-ghost:hover:not(:disabled) { background: var(--gt-soft2); }
                        .gt-btn-danger { background: color-mix(in srgb, var(--gt-bad) 14%, transparent); color: var(--gt-bad); border-color: color-mix(in srgb, var(--gt-bad) 35%, transparent); }
                        .gt-btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--gt-bad) 24%, transparent); }
                        .gt-sm { padding: 7px 12px; font-size: .82rem; }
                        .gt-xs { padding: 5px 8px; font-size: .78rem; }

                        .gt-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 16px; }
                        .gt-kpi { --t: var(--gt-mut); background: var(--gt-card); border: 1px solid var(--gt-bd); border-top: 3px solid var(--t); border-radius: var(--gt-r); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; box-shadow: var(--mc-shadow, none); }
                        .gt-kpi.tone-warn { --t: var(--gt-warn); } .gt-kpi.tone-info { --t: var(--gt-info); } .gt-kpi.tone-ok { --t: var(--gt-ok); } .gt-kpi.tone-bad { --t: var(--gt-bad); }
                        .gt-kpi span { font-size: .78rem; color: var(--gt-mut); text-transform: uppercase; letter-spacing: .03em; font-weight: 600; }
                        .gt-kpi span i { color: var(--t); margin-right: 5px; }
                        .gt-kpi b { font-size: 1.55rem; font-weight: 800; color: var(--t); font-variant-numeric: tabular-nums; }
                        .gt-kpi.tone-mut b { color: var(--gt-tx); }
                        .gt-kpi small { color: var(--gt-mut); font-size: .78rem; }
                        .gt-today { margin: 12px 2px 0; color: var(--gt-mut); font-size: .85rem; }
                        .gt-today i { margin-right: 6px; }
                        .tx-ok { color: var(--gt-ok); } .tx-bad { color: var(--gt-bad); } .tx-warn { color: var(--gt-warn); }

                        .gt-section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin: 24px 0 10px; }
                        .gt-section-head h3 { margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 9px; }
                        .gt-section-head h3 i { color: var(--gt-warn); }
                        .gt-count { font-size: .78rem; font-weight: 600; color: var(--gt-mut); background: var(--gt-soft); border: 1px solid var(--gt-bd); border-radius: 999px; padding: 2px 10px; }
                        .gt-tools { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
                        .gt-search { position: relative; }
                        .gt-search i { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--gt-mut); font-size: .85rem; pointer-events: none; }
                        .gt-search input, .gt-select { background: var(--gt-in-bg); color: var(--gt-tx); border: 1px solid var(--gt-in-bd); border-radius: var(--gt-ir); padding: 9px 12px; font: inherit; font-size: .88rem; }
                        .gt-search input { padding-left: 34px; width: min(300px, 78vw); }
                        .gt-search input:focus, .gt-select:focus { outline: 2px solid color-mix(in srgb, var(--gt-pri) 55%, transparent); outline-offset: 1px; }

                        .gt-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
                        .gt-chip { background: var(--gt-soft); color: var(--gt-tx); border: 1px solid var(--gt-bd); border-radius: 999px; padding: 6px 13px; font: inherit; font-size: .82rem; cursor: pointer; display: inline-flex; gap: 7px; align-items: center; }
                        .gt-chip i { font-style: normal; font-size: .72rem; background: var(--gt-soft2); border-radius: 999px; padding: 1px 7px; color: var(--gt-mut); }
                        .gt-chip.on { background: color-mix(in srgb, var(--gt-pri) 18%, transparent); border-color: var(--gt-pri); }
                        .gt-chip.on i { background: var(--gt-pri); color: var(--mc-primary-contrast, #fff); }

                        .gt-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; }
                        .gt-card { --t: var(--gt-ok); background: var(--gt-card); border: 1px solid var(--gt-bd); border-top: 4px solid var(--t); border-radius: var(--gt-r); padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--mc-shadow, none); transition: transform .15s, border-color .15s; }
                        .gt-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--t) 55%, var(--gt-bd)); }
                        .gt-card.tone-warn { --t: var(--gt-warn); } .gt-card.tone-bad { --t: var(--gt-bad); } .gt-card.tone-info { --t: var(--gt-info); }
                        .gt-card header { display: flex; align-items: center; gap: 11px; }
                        .gt-avatar { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 1.05rem; color: var(--t); background: color-mix(in srgb, var(--t) 16%, transparent); border: 1px solid color-mix(in srgb, var(--t) 40%, transparent); flex: none; }
                        .gt-who { min-width: 0; flex: 1; display: flex; flex-direction: column; }
                        .gt-who b { font-size: 1.02rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                        .gt-who small { color: var(--gt-mut); font-size: .75rem; }
                        .gt-age { font-size: .74rem; font-weight: 700; color: var(--t); background: color-mix(in srgb, var(--t) 14%, transparent); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
                        .gt-sisa { display: flex; flex-direction: column; }
                        .gt-sisa small { color: var(--gt-mut); font-size: .76rem; }
                        .gt-sisa strong { font-size: 1.7rem; font-weight: 800; color: var(--t); font-variant-numeric: tabular-nums; line-height: 1.15; }
                        .gt-split { display: flex; gap: 14px; font-size: .78rem; color: var(--gt-mut); flex-wrap: wrap; }
                        .gt-split b { color: var(--gt-tx); }
                        .gt-bar { height: 7px; background: var(--gt-soft2); border-radius: 999px; overflow: hidden; }
                        .gt-bar i { display: block; height: 100%; background: var(--gt-ok); border-radius: 999px; transition: width .3s; }
                        .gt-meta { font-size: .76rem; color: var(--gt-mut); margin-top: -4px; }
                        .gt-mini { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; border-top: 1px dashed var(--gt-bd); padding-top: 8px; }
                        .gt-mini li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: .82rem; }
                        .gt-mini li span { min-width: 0; display: flex; flex-direction: column; }
                        .gt-mini li b { font-weight: 600; }
                        .gt-mini li small { color: var(--gt-mut); font-size: .74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                        .gt-mini li em { font-style: normal; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
                        .gt-mini li.owed em { color: var(--gt-info); }
                        .gt-mini li.more { color: var(--gt-mut); font-size: .76rem; justify-content: flex-start; }
                        .gt-card footer { display: flex; gap: 8px; margin-top: auto; padding-top: 4px; }
                        .gt-card footer .gt-btn-primary { flex: 1; }

                        .gt-state { grid-column: 1 / -1; text-align: center; padding: 34px 16px; background: var(--gt-card); border: 1px dashed var(--gt-bd); border-radius: var(--gt-r); color: var(--gt-mut); }
                        .gt-state i { font-size: 1.4rem; display: block; margin-bottom: 8px; }
                        .gt-state-ok i { color: var(--gt-ok); } .gt-state-bad i { color: var(--gt-bad); }

                        .gt-tablewrap { background: var(--gt-card); border: 1px solid var(--gt-bd); border-radius: var(--gt-r); overflow-x: auto; }
                        .gt-table { width: 100%; border-collapse: collapse; font-size: .85rem; min-width: 880px; }
                        .gt-table th { background: var(--mc-table-head, var(--gt-soft)); text-align: left; padding: 10px 12px; font-size: .74rem; text-transform: uppercase; letter-spacing: .03em; color: var(--gt-mut); white-space: nowrap; }
                        .gt-table td { padding: 10px 12px; border-top: 1px solid var(--gt-bd); vertical-align: middle; }
                        .gt-table tbody tr:hover { background: var(--mc-table-hover, var(--gt-soft)); }
                        .gt-table .r { text-align: right; font-variant-numeric: tabular-nums; }
                        .gt-desc { max-width: 260px; color: var(--gt-mut); }
                        .gt-actions { white-space: nowrap; text-align: right; }
                        .gt-actions .gt-btn { margin-left: 4px; }
                        .gt-cat { display: block; color: var(--gt-mut); font-size: .72rem; margin-top: 3px; }
                        .gt-mut { color: var(--gt-mut); }
                        .gt-pill { --t: var(--gt-mut); display: inline-block; font-size: .72rem; font-weight: 700; color: var(--t); background: color-mix(in srgb, var(--t) 14%, transparent); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
                        .gt-pill.tone-ok { --t: var(--gt-ok); } .gt-pill.tone-warn { --t: var(--gt-warn); } .gt-pill.tone-bad { --t: var(--gt-bad); } .gt-pill.tone-info { --t: var(--gt-info); }

                        /* Modal */
                        .gt-overlay { position: fixed; inset: 0; z-index: 10050; background: rgba(2, 6, 23, .62); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 16px; }
                        .gt-dialog { background: var(--gt-card); color: var(--gt-tx); border: 1px solid var(--gt-bd); border-radius: var(--gt-r); width: min(540px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; padding: 20px; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
                        .gt-dlg-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
                        .gt-dlg-head h3 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 9px; }
                        .gt-dlg-head h3 i { color: var(--gt-pri); }
                        .gt-x { background: none; border: 0; color: var(--gt-mut); font-size: 1.6rem; line-height: 1; cursor: pointer; padding: 0 4px; }
                        .gt-x:hover { color: var(--gt-tx); }
                        .gt-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 13px; }
                        .gt-field > span { font-size: .8rem; color: var(--gt-mut); font-weight: 600; }
                        .gt-field input[type=text], .gt-field input[type=search], .gt-field select, .gt-field textarea { background: var(--gt-in-bg); color: var(--gt-tx); border: 1px solid var(--gt-in-bd); border-radius: var(--gt-ir); padding: 10px 12px; font: inherit; width: 100%; }
                        .gt-field input:focus, .gt-field select:focus, .gt-field textarea:focus { outline: 2px solid color-mix(in srgb, var(--gt-pri) 55%, transparent); outline-offset: 1px; }
                        .gt-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                        @media (max-width: 520px) { .gt-row { grid-template-columns: 1fr; } }
                        .gt-hint { color: var(--gt-warn); min-height: 1em; font-size: .78rem; }
                        .gt-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                        .gt-seg label { position: relative; display: flex; flex-direction: column; gap: 3px; border: 1px solid var(--gt-bd); border-radius: var(--gt-ir); padding: 10px 12px 10px 34px; cursor: pointer; background: var(--gt-soft); }
                        .gt-seg label:has(input:checked) { border-color: var(--gt-pri); background: color-mix(in srgb, var(--gt-pri) 12%, transparent); }
                        .gt-seg input { position: absolute; left: 12px; top: 14px; accent-color: var(--gt-pri); }
                        .gt-seg b { font-size: .86rem; }
                        .gt-seg small { color: var(--gt-mut); font-size: .72rem; line-height: 1.35; }
                        @media (max-width: 520px) { .gt-seg { grid-template-columns: 1fr; } }
                        .gt-note { color: var(--gt-mut); font-size: .8rem; margin: 2px 0 14px; line-height: 1.5; }
                        .gt-note i { margin-right: 5px; color: var(--gt-info); }
                        .gt-dlg-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
                        .gt-payinfo { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
                        .gt-payinfo > div { flex: 1; min-width: 110px; background: var(--gt-soft); border: 1px solid var(--gt-bd); border-radius: var(--gt-ir); padding: 9px 12px; display: flex; flex-direction: column; }
                        .gt-payinfo small { color: var(--gt-mut); font-size: .72rem; }
                        .gt-payinfo b { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
                        .gt-quick { display: flex; gap: 8px; margin: -4px 0 13px; }
                        .gt-quick button { flex: 1; background: var(--gt-soft); color: var(--gt-tx); border: 1px solid var(--gt-bd); border-radius: var(--gt-br); padding: 7px; font: inherit; font-size: .8rem; cursor: pointer; }
                        .gt-quick button:hover { border-color: var(--gt-pri); }
                        .gt-after { font-size: .85rem; color: var(--gt-mut); margin-bottom: 8px; min-height: 1.3em; }
                        .gt-after b { color: var(--gt-tx); }
                        .gt-detail { display: flex; flex-direction: column; gap: 12px; }
                        .gt-item { border: 1px solid var(--gt-bd); border-radius: var(--gt-ir); padding: 12px; background: var(--gt-soft); display: flex; flex-direction: column; gap: 8px; }
                        .gt-item.done { opacity: .75; }
                        .gt-item-top { display: flex; justify-content: space-between; gap: 12px; }
                        .gt-item-amt { text-align: right; display: flex; flex-direction: column; }
                        .gt-item-amt small { color: var(--gt-mut); font-size: .72rem; }
                        .gt-item-amt b { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
                        .gt-item-desc { margin: 0; font-size: .84rem; }
                        .gt-pays { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
                        .gt-pays li { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; font-size: .8rem; color: var(--gt-mut); }
                        .gt-pays li i { font-size: .45rem; color: var(--gt-ok); margin-right: 6px; vertical-align: middle; }
                        .gt-pays li span { flex: 1; }
                        .gt-pays li b { color: var(--gt-ok); font-variant-numeric: tabular-nums; }
                        .gt-item-actions { display: flex; gap: 8px; flex-wrap: wrap; }
                        .gt-done summary { cursor: pointer; color: var(--gt-mut); font-size: .84rem; margin: 6px 0; }
                        .gt-done .gt-item { margin-top: 8px; }
                        @media (max-width: 640px) {
                            .gt-head-actions { width: 100%; }
                            .gt-head-actions .gt-btn-primary { flex: 1; }
                            .gt-kpi b { font-size: 1.3rem; }
                        }
                    </style>
                    <div id="gantunganRoot" class="gt-root"></div>
                </section>

                <!-- Serah Terima / Pickup Valas View -->
                <section id="pickup-view" class="view-section hidden">
                    <!-- Seluruh isi dirender oleh public/js/modules/40-pickup.js -->
                    <div id="pickupRoot"></div>
                </section>

                <!-- Jurnal Keuangan View -->
                <section id="expense-view" class="view-section hidden">
                    <!-- Jurnal Keuangan: seluruh isi dirender oleh public/js/modules/37-expenses.js -->
                    <div id="expenseRoot"></div>
                </section>

                <!-- Ekuitas & Kewajiban View -->
                <section id="adjustment-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Jurnal Ekuitas & Kewajiban (Pasiva)</h2>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportTableToExcel('adjustmentTable', 'Penyesuaian_Ekuitas_Kewajiban')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-success" onclick="openAdjustmentModal()"><i class="fa-solid fa-plus"></i> Tambah Catatan Modal/Hutang</button>
                        </div>
                    </div>
                    <div class="panel mt-4">
                        <div class="table-responsive">
                            <table class="table" id="adjustmentTable">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>ID Jurnal</th>
                                        <th>Kategori Akun (BI)</th>
                                        <th>Tipe Pergerakan</th>
                                        <th>Keterangan</th>
                                        <th>Kas/Bank</th>
                                        <th style="text-align: right;">Nominal (Rp)</th>
                                        <th style="text-align: center;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="adjustmentsTableBody">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Penanam Saham: seluruh isi dirender oleh public/js/modules/35-investors.js -->
                <section id="investor-view" class="view-section hidden">
                    <style id="iv-style">
                        .iv-root, .iv-overlay {
                            --iv-bd: var(--mc-border, rgba(148,163,184,.28));
                            --iv-card: var(--mc-card-bg, #18181b);
                            --iv-tx: var(--mc-text, #fafafa);
                            --iv-mut: var(--mc-text-muted, #a1a1aa);
                            --iv-pri: var(--mc-primary, #22c55e);
                            --iv-ok: var(--mc-buy, #22c55e);
                            --iv-bad: var(--mc-danger, #ef4444);
                            --iv-warn: var(--mc-warning, #f59e0b);
                            --iv-info: var(--mc-info, #3b82f6);
                            --iv-r: var(--mc-radius, 12px);
                            --iv-br: var(--mc-btn-radius, 8px);
                            --iv-ir: var(--mc-input-radius, 8px);
                            --iv-soft: color-mix(in srgb, var(--iv-tx) 5%, transparent);
                            --iv-soft2: color-mix(in srgb, var(--iv-tx) 9%, transparent);
                            --iv-in-bg: var(--mc-input-bg, color-mix(in srgb, var(--iv-tx) 6%, var(--iv-card)));
                            --iv-in-bd: var(--mc-input-border, var(--iv-bd));
                            color: var(--iv-tx);
                        }
                        .iv-root *, .iv-overlay * { box-sizing: border-box; }
                        .iv-hide { display: none !important; }
                        .iv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; background: var(--iv-card); border: 1px solid var(--iv-bd); border-left: 4px solid var(--iv-pri); border-radius: var(--iv-r); padding: 18px 20px; box-shadow: var(--mc-shadow, none); }
                        .iv-head h2 { margin: 0; font-size: 1.35rem; display: flex; align-items: center; gap: 10px; color: var(--iv-pri); }
                        .iv-head p { margin: 6px 0 0; color: var(--iv-mut); max-width: 66ch; line-height: 1.5; font-size: .92rem; }
                        .iv-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }

                        .iv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid transparent; border-radius: var(--iv-br); padding: 9px 15px; font: inherit; font-size: .88rem; font-weight: 600; cursor: pointer; transition: filter .15s, background .15s; line-height: 1.2; }
                        .iv-btn:disabled { opacity: .55; cursor: not-allowed; }
                        .iv-btn-primary { background: var(--iv-pri); color: var(--mc-primary-contrast, #fff); }
                        .iv-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
                        .iv-btn-ghost { background: var(--iv-soft); color: var(--iv-tx); border-color: var(--iv-bd); }
                        .iv-btn-ghost:hover:not(:disabled) { background: var(--iv-soft2); }
                        .iv-btn-danger { background: color-mix(in srgb, var(--iv-bad) 14%, transparent); color: var(--iv-bad); border-color: color-mix(in srgb, var(--iv-bad) 35%, transparent); }
                        .iv-btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--iv-bad) 24%, transparent); }
                        .iv-xs { padding: 5px 8px; font-size: .78rem; }

                        .iv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 16px; }
                        .iv-kpi { --t: var(--iv-mut); background: var(--iv-card); border: 1px solid var(--iv-bd); border-top: 3px solid var(--t); border-radius: var(--iv-r); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; box-shadow: var(--mc-shadow, none); }
                        .iv-kpi.tone-ok { --t: var(--iv-ok); } .iv-kpi.tone-info { --t: var(--iv-info); } .iv-kpi.tone-warn { --t: var(--iv-warn); } .iv-kpi.tone-bad { --t: var(--iv-bad); }
                        .iv-kpi span { font-size: .78rem; color: var(--iv-mut); text-transform: uppercase; letter-spacing: .03em; font-weight: 600; }
                        .iv-kpi span i { color: var(--t); margin-right: 5px; }
                        .iv-kpi b { font-size: 1.5rem; font-weight: 800; color: var(--t); font-variant-numeric: tabular-nums; }
                        .iv-kpi.tone-mut b { color: var(--iv-tx); }
                        .iv-kpi small { color: var(--iv-mut); font-size: .78rem; }

                        .iv-comp { margin-top: 14px; }
                        .iv-compbar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; background: var(--iv-soft2); border: 1px solid var(--iv-bd); }
                        .iv-compbar i { display: block; height: 100%; opacity: .9; border-right: 2px solid var(--iv-card); }
                        .iv-compbar i.rest, .iv-legend i.rest { background: repeating-linear-gradient(45deg, var(--iv-soft2), var(--iv-soft2) 4px, transparent 4px, transparent 8px); opacity: 1; }
                        .iv-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: .8rem; color: var(--iv-mut); }
                        .iv-legend span { display: inline-flex; align-items: center; gap: 6px; }
                        .iv-legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
                        .iv-legend b { color: var(--iv-tx); }

                        .iv-tabs { display: flex; gap: 6px; margin: 22px 0 14px; border-bottom: 1px solid var(--iv-bd); flex-wrap: wrap; }
                        .iv-tab { background: none; border: 0; border-bottom: 3px solid transparent; color: var(--iv-mut); padding: 10px 16px; font: inherit; font-weight: 600; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; margin-bottom: -1px; }
                        .iv-tab:hover { color: var(--iv-tx); }
                        .iv-tab.on { color: var(--iv-tx); border-bottom-color: var(--iv-pri); }
                        .iv-tab.on i { color: var(--iv-pri); }

                        .iv-tools { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
                        .iv-search { position: relative; }
                        .iv-search i { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--iv-mut); font-size: .85rem; pointer-events: none; }
                        .iv-search input, .iv-select { background: var(--iv-in-bg); color: var(--iv-tx); border: 1px solid var(--iv-in-bd); border-radius: var(--iv-ir); padding: 9px 12px; font: inherit; font-size: .88rem; }
                        .iv-search input { padding-left: 34px; width: min(320px, 78vw); }
                        .iv-search input:focus, .iv-select:focus { outline: 2px solid color-mix(in srgb, var(--iv-pri) 55%, transparent); outline-offset: 1px; }

                        .iv-tablewrap { background: var(--iv-card); border: 1px solid var(--iv-bd); border-radius: var(--iv-r); overflow-x: auto; }
                        .iv-table { width: 100%; border-collapse: collapse; font-size: .86rem; min-width: 860px; }
                        .iv-table th { background: var(--mc-table-head, var(--iv-soft)); text-align: left; padding: 10px 12px; font-size: .74rem; text-transform: uppercase; letter-spacing: .03em; color: var(--iv-mut); white-space: nowrap; }
                        .iv-table td { padding: 11px 12px; border-top: 1px solid var(--iv-bd); vertical-align: middle; }
                        .iv-table tbody tr:hover { background: var(--mc-table-hover, var(--iv-soft)); }
                        .iv-table .r { text-align: right; font-variant-numeric: tabular-nums; }
                        .iv-table tfoot td { font-weight: 700; background: var(--iv-soft); }
                        .iv-who { display: flex; align-items: center; gap: 11px; }
                        .iv-who > span:last-child { display: flex; flex-direction: column; min-width: 0; }
                        .iv-who small { color: var(--iv-mut); font-size: .74rem; }
                        .iv-avatar { width: 36px; height: 36px; border-radius: 50%; flex: none; display: grid; place-items: center; font-weight: 800; color: var(--iv-pri); background: color-mix(in srgb, var(--iv-pri) 16%, transparent); border: 1px solid color-mix(in srgb, var(--iv-pri) 38%, transparent); }
                        .iv-contact { color: var(--iv-mut); font-size: .8rem; line-height: 1.5; }
                        .iv-minibar { height: 4px; background: var(--iv-soft2); border-radius: 999px; margin-top: 5px; overflow: hidden; min-width: 56px; margin-left: auto; width: 70px; }
                        .iv-minibar i { display: block; height: 100%; background: var(--iv-pri); }
                        .iv-actions { white-space: nowrap; text-align: right; }
                        .iv-actions .iv-btn { margin-left: 4px; }
                        .iv-sub { display: block; color: var(--iv-mut); font-size: .72rem; margin-top: 2px; font-weight: 400; }
                        .iv-mut { color: var(--iv-mut); }
                        .iv-pill { --t: var(--iv-mut); display: inline-block; font-size: .72rem; font-weight: 700; color: var(--t); background: color-mix(in srgb, var(--t) 14%, transparent); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
                        .iv-pill.tone-ok { --t: var(--iv-ok); } .iv-pill.tone-warn { --t: var(--iv-warn); } .iv-pill.tone-bad { --t: var(--iv-bad); }
                        .tx-ok { color: var(--iv-ok); } .tx-bad { color: var(--iv-bad); }
                        .iv-state { text-align: center; padding: 36px 16px; color: var(--iv-mut); }
                        .iv-state i { font-size: 1.4rem; display: block; margin-bottom: 8px; }
                        .iv-state-bad i { color: var(--iv-bad); }
                        .iv-state .iv-btn { margin-top: 12px; }
                        .iv-note { color: var(--iv-mut); font-size: .8rem; margin: 12px 2px 0; line-height: 1.5; }
                        .iv-note i { margin-right: 5px; color: var(--iv-info); }

                        .iv-simbar { display: grid; grid-template-columns: minmax(180px, 240px) minmax(220px, 320px) 1fr; gap: 14px; align-items: end; margin-bottom: 14px; }
                        @media (max-width: 900px) { .iv-simbar { grid-template-columns: 1fr; } }
                        .iv-netbox { background: var(--iv-card); border: 1px solid var(--iv-bd); border-radius: var(--iv-r); padding: 10px 16px; display: flex; flex-direction: column; }
                        .iv-netbox small { color: var(--iv-mut); font-size: .76rem; }
                        .iv-netbox b { font-size: 1.5rem; font-variant-numeric: tabular-nums; }

                        /* Modal */
                        .iv-overlay { position: fixed; inset: 0; z-index: 10050; background: rgba(2, 6, 23, .62); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 16px; }
                        .iv-dialog { background: var(--iv-card); color: var(--iv-tx); border: 1px solid var(--iv-bd); border-radius: var(--iv-r); width: min(520px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; padding: 20px; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
                        .iv-dialog.wide { width: min(680px, 100%); }
                        .iv-dlg-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
                        .iv-dlg-head h3 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 9px; }
                        .iv-dlg-head h3 i { color: var(--iv-pri); }
                        .iv-dlg-head h3 small { color: var(--iv-mut); font-weight: 500; font-size: .8rem; }
                        .iv-x { background: none; border: 0; color: var(--iv-mut); font-size: 1.6rem; line-height: 1; cursor: pointer; padding: 0 4px; }
                        .iv-x:hover { color: var(--iv-tx); }
                        .iv-dialog fieldset { border: 1px solid var(--iv-bd); border-radius: var(--iv-ir); padding: 12px 14px 4px; margin: 0 0 14px; min-width: 0; }
                        .iv-dialog legend { padding: 0 8px; font-size: .76rem; text-transform: uppercase; letter-spacing: .04em; color: var(--iv-mut); font-weight: 700; }
                        .iv-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; min-width: 0; }
                        .iv-field > span { font-size: .8rem; color: var(--iv-mut); font-weight: 600; }
                        .iv-field > span em { color: var(--iv-bad); font-style: normal; }
                        .iv-field input[type=text], .iv-field input[type=tel], .iv-field input[type=email], .iv-field input[type=number], .iv-field input[type=date], .iv-field input[type=month], .iv-field select, .iv-field textarea { background: var(--iv-in-bg); color: var(--iv-tx); border: 1px solid var(--iv-in-bd); border-radius: var(--iv-ir); padding: 10px 12px; font: inherit; width: 100%; color-scheme: light dark; }
                        .iv-field input:focus, .iv-field select:focus, .iv-field textarea:focus { outline: 2px solid color-mix(in srgb, var(--iv-pri) 55%, transparent); outline-offset: 1px; }
                        .iv-field input.bad { border-color: var(--iv-bad); }
                        .iv-err { color: var(--iv-bad); font-size: .76rem; min-height: 0; }
                        .iv-hint { color: var(--iv-mut); font-size: .76rem; }
                        .iv-hint b { color: var(--iv-tx); }
                        .iv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                        @media (max-width: 560px) { .iv-row { grid-template-columns: 1fr; } }
                        .iv-seg { display: grid; gap: 8px; }
                        .iv-seg.two { grid-template-columns: 1fr 1fr; }
                        .iv-seg label { position: relative; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--iv-bd); border-radius: var(--iv-ir); padding: 9px 12px 9px 32px; cursor: pointer; background: var(--iv-soft); }
                        .iv-seg label:has(input:checked) { border-color: var(--iv-pri); background: color-mix(in srgb, var(--iv-pri) 12%, transparent); }
                        .iv-seg input { position: absolute; left: 11px; top: 12px; accent-color: var(--iv-pri); }
                        .iv-seg b { font-size: .84rem; }
                        .iv-seg small { color: var(--iv-mut); font-size: .72rem; }
                        .iv-readonly { background: var(--iv-soft); border: 1px dashed var(--iv-bd); border-radius: var(--iv-ir); padding: 9px 12px; font-weight: 700; display: flex; flex-direction: column; }
                        .iv-readonly small { font-weight: 400; color: var(--iv-mut); font-size: .72rem; }
                        .iv-dlg-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
                        .iv-info { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
                        .iv-info > div { flex: 1; min-width: 120px; background: var(--iv-soft); border: 1px solid var(--iv-bd); border-radius: var(--iv-ir); padding: 9px 12px; display: flex; flex-direction: column; }
                        .iv-info small { color: var(--iv-mut); font-size: .72rem; }
                        .iv-info b { font-size: 1.02rem; font-variant-numeric: tabular-nums; }
                        .iv-after { font-size: .85rem; color: var(--iv-mut); min-height: 1.3em; }
                        .iv-after b { color: var(--iv-tx); }
                        .iv-kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
                        .iv-kv > div { background: var(--iv-soft); border: 1px solid var(--iv-bd); border-radius: var(--iv-ir); padding: 9px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
                        .iv-kv small { color: var(--iv-mut); font-size: .72rem; }
                        .iv-notes { margin: 12px 0 0; font-size: .86rem; color: var(--iv-mut); }
                        .iv-notes i { margin-right: 6px; }
                        .iv-sub-h { margin: 18px 0 8px; font-size: .9rem; }
                        .iv-moves { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
                        .iv-moves li { display: flex; align-items: center; gap: 10px; background: var(--iv-soft); border: 1px solid var(--iv-bd); border-radius: var(--iv-ir); padding: 8px 10px; }
                        .iv-mv-ico { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: .75rem; }
                        .iv-moves li.in .iv-mv-ico { color: var(--iv-ok); background: color-mix(in srgb, var(--iv-ok) 16%, transparent); }
                        .iv-moves li.out .iv-mv-ico { color: var(--iv-warn); background: color-mix(in srgb, var(--iv-warn) 16%, transparent); }
                        .iv-mv-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
                        .iv-mv-main small { color: var(--iv-mut); font-size: .74rem; }
                        .iv-moves em { font-style: normal; font-weight: 700; font-variant-numeric: tabular-nums; }
                        .iv-moves li.in em { color: var(--iv-ok); } .iv-moves li.out em { color: var(--iv-warn); }
                        .iv-empty { color: var(--iv-mut); justify-content: center; font-size: .85rem; }
                        @media (max-width: 640px) { .iv-head-actions { width: 100%; } .iv-head-actions .iv-btn-primary { flex: 1; } }
                    </style>
                    <div id="investorRoot" class="iv-root"></div>
                </section>

                <!-- Closing Harian: seluruh isi dirender oleh public/js/modules/34-closing-daily.js -->
                <section id="closing-view" class="view-section hidden">
                    <style id="cd-style">
                        #closing-view .cd {
                            --cd-bd: var(--mc-border, rgba(148,163,184,.28));
                            --cd-card: var(--mc-card-bg, #18181b);
                            --cd-tx: var(--mc-text, #fafafa);
                            --cd-mut: var(--mc-text-muted, #a1a1aa);
                            --cd-pri: var(--mc-primary, #22c55e);
                            --cd-ok: var(--mc-buy, #22c55e);
                            --cd-bad: var(--mc-danger, #ef4444);
                            --cd-warn: var(--mc-warning, #f59e0b);
                            --cd-info: var(--mc-info, #3b82f6);
                            --cd-r: var(--mc-radius, 12px);
                            --cd-br: var(--mc-btn-radius, 8px);
                            --cd-ir: var(--mc-input-radius, 8px);
                            --cd-soft: color-mix(in srgb, var(--cd-tx) 5%, transparent);
                            --cd-soft2: color-mix(in srgb, var(--cd-tx) 9%, transparent);
                            color: var(--cd-tx);
                            display: grid; gap: 16px;
                        }
                        #closing-view .cd-card { background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: var(--cd-r); padding: 18px 20px; box-shadow: var(--mc-shadow, none); min-width: 0; }
                        #closing-view .cd-center { text-align: center; padding: 28px 16px; color: var(--cd-mut); }
                        #closing-view .cd-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
                        #closing-view .cd-head-main { display: flex; align-items: center; gap: 14px; }
                        #closing-view .cd-head h2 { margin: 0; font-size: 1.25rem; color: var(--cd-tx); }
                        #closing-view .cd-head p { margin: 3px 0 0; font-size: .85rem; color: var(--cd-mut); }
                        #closing-view .cd-ico { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex: none;
                            color: var(--cd-pri); background: color-mix(in srgb, var(--cd-pri) 16%, transparent); }
                        #closing-view .cd-head-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                        #closing-view .cd-datenav { display: flex; align-items: center; gap: 6px; }
                        #closing-view input[type=date], #closing-view input[type=month], #closing-view .cd-filters select, #closing-view .cd-field textarea, #closing-view .cd-input-sm, #closing-view .cd-stepper input {
                            font: inherit; color: var(--cd-tx); background: var(--mc-input-bg, var(--cd-soft)); border: 1px solid var(--mc-input-border, var(--cd-bd));
                            border-radius: var(--cd-ir); padding: 8px 10px; outline: none; box-sizing: border-box; color-scheme: light dark; }
                        #closing-view input:focus, #closing-view textarea:focus, #closing-view select:focus { border-color: var(--cd-pri); box-shadow: 0 0 0 3px color-mix(in srgb, var(--cd-pri) 22%, transparent); }
                        #closing-view input:disabled, #closing-view textarea:disabled { opacity: .65; cursor: not-allowed; }
                        #closing-view .cd-btn-ico { width: 36px; height: 36px; border-radius: var(--cd-br); border: 1px solid var(--cd-bd); background: var(--cd-soft); color: var(--cd-tx); cursor: pointer; }
                        #closing-view .cd-btn-ico:hover:not(:disabled) { border-color: var(--cd-pri); color: var(--cd-pri); }
                        #closing-view .cd-btn-ico:disabled { opacity: .4; cursor: not-allowed; }
                        #closing-view .cd-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 99px; font-size: .8rem; font-weight: 700; white-space: nowrap;
                            --t: var(--cd-mut); color: var(--t); background: color-mix(in srgb, var(--t) 15%, transparent); border: 1px solid color-mix(in srgb, var(--t) 38%, transparent); }
                        #closing-view .tone-ok { --t: var(--cd-ok); } #closing-view .tone-bad { --t: var(--cd-bad); }
                        #closing-view .tone-warn { --t: var(--cd-warn); } #closing-view .tone-info { --t: var(--cd-info); } #closing-view .tone-mut { --t: var(--cd-mut); }
                        #closing-view .cd-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--cd-r); margin-bottom: 8px; --t: var(--cd-mut);
                            border: 1px solid color-mix(in srgb, var(--t) 40%, transparent); background: color-mix(in srgb, var(--t) 11%, transparent); font-size: .88rem; }
                        #closing-view .cd-banner > i { color: var(--t); font-size: 1.1rem; }
                        #closing-view .cd-banner > div { flex: 1; }
                        #closing-view .cd-linkbtn { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; font-size: .82rem; font-weight: 600; color: var(--mc-link, var(--cd-pri)); }
                        #closing-view .cd-linkbtn:hover { text-decoration: underline; }
                        #closing-view .cd-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
                        #closing-view .cd-kpi { display: flex; gap: 14px; align-items: center; padding: 16px 18px; background: var(--cd-card); border: 1px solid var(--cd-bd); border-radius: var(--cd-r); --t: var(--cd-info); }
                        #closing-view .cd-kpi.tone-ok { --t: var(--cd-ok); } #closing-view .cd-kpi.tone-bad { --t: var(--cd-bad); } #closing-view .cd-kpi.tone-primary { --t: var(--cd-pri); border-color: color-mix(in srgb, var(--cd-pri) 55%, transparent); }
                        #closing-view .cd-kpi-ico { width: 42px; height: 42px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; color: var(--t); background: color-mix(in srgb, var(--t) 16%, transparent); }
                        #closing-view .cd-kpi small { display: block; color: var(--cd-mut); font-size: .76rem; }
                        #closing-view .cd-kpi strong { display: block; font-size: 1.2rem; line-height: 1.25; font-variant-numeric: tabular-nums; }
                        #closing-view .cd-kpi em { font-style: normal; font-size: .72rem; color: var(--cd-mut); }
                        #closing-view .cd-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
                        #closing-view .cd-main { display: grid; gap: 16px; min-width: 0; }
                        #closing-view .cd-side { display: grid; gap: 16px; position: sticky; top: 12px; }
                        #closing-view .cd-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
                        #closing-view .cd-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
                        #closing-view .cd-card-head h3 { margin: 0; font-size: 1rem; color: var(--cd-tx); }
                        #closing-view .cd-card-head h3 i { color: var(--cd-pri); margin-right: 8px; }
                        #closing-view .cd-dens { display: grid; gap: 8px; }
                        #closing-view .cd-den { display: grid; grid-template-columns: minmax(130px, 1fr) auto minmax(110px, 1fr); gap: 12px; align-items: center; padding: 8px 12px; border: 1px solid var(--cd-bd); border-radius: var(--cd-ir); background: var(--cd-soft); }
                        #closing-view .cd-den-label { font-weight: 600; font-variant-numeric: tabular-nums; }
                        #closing-view .cd-den-label i { color: var(--cd-pri); width: 22px; }
                        #closing-view .cd-den-sub { text-align: right; font-variant-numeric: tabular-nums; color: var(--cd-mut); }
                        #closing-view .cd-stepper { display: flex; align-items: center; gap: 4px; }
                        #closing-view .cd-stepper button { width: 32px; height: 34px; border-radius: var(--cd-br); border: 1px solid var(--cd-bd); background: var(--cd-card); color: var(--cd-tx); cursor: pointer; font-size: 1rem; }
                        #closing-view .cd-stepper button:hover:not(:disabled) { border-color: var(--cd-pri); color: var(--cd-pri); }
                        #closing-view .cd-stepper button:disabled { opacity: .4; cursor: not-allowed; }
                        #closing-view .cd-stepper input { width: 84px; text-align: center; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
                        #closing-view .cd-stepper input::-webkit-outer-spin-button, #closing-view .cd-stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                        #closing-view .cd-total { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding: 14px 16px; border-radius: var(--cd-ir);
                            background: color-mix(in srgb, var(--cd-pri) 12%, transparent); border: 1px solid color-mix(in srgb, var(--cd-pri) 40%, transparent); }
                        #closing-view .cd-total strong { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
                        #closing-view .cd-tablewrap { overflow-x: auto; border: 1px solid var(--cd-bd); border-radius: var(--cd-ir); }
                        #closing-view .cd-scroll { max-height: 280px; overflow-y: auto; }
                        #closing-view .cd-table { width: 100%; border-collapse: collapse; font-size: .88rem; }
                        #closing-view .cd-table th { text-align: left; padding: 10px 12px; font-size: .72rem; letter-spacing: .05em; text-transform: uppercase; color: var(--cd-mut);
                            background: var(--mc-table-head, var(--cd-soft)); border-bottom: 1px solid var(--cd-bd); white-space: nowrap; position: sticky; top: 0; }
                        #closing-view .cd-table td { padding: 10px 12px; border-bottom: 1px solid var(--cd-bd); vertical-align: middle; }
                        #closing-view .cd-table tr:last-child td { border-bottom: 0; }
                        #closing-view .cd-table tbody tr:hover { background: var(--mc-table-hover, var(--cd-soft)); }
                        #closing-view .cd-table tr.is-active { background: color-mix(in srgb, var(--cd-pri) 10%, transparent); }
                        #closing-view .cd-table tr.is-legacy { opacity: .78; }
                        #closing-view .r { text-align: right; font-variant-numeric: tabular-nums; }
                        #closing-view .cd-input-sm { width: 110px; text-align: right; padding: 6px 8px; }
                        #closing-view .cd-mut { color: var(--cd-mut); }
                        #closing-view .cd-hint { margin: 10px 0 0; font-size: .78rem; color: var(--cd-mut); line-height: 1.5; }
                        #closing-view .cd-empty { text-align: center; color: var(--cd-mut); padding: 18px 10px !important; list-style: none; }
                        #closing-view .tx-ok { color: var(--cd-ok); } #closing-view .tx-bad { color: var(--cd-bad); }
                        #closing-view .tx-info { color: var(--cd-info); } #closing-view .tx-warn { color: var(--cd-warn); }
                        #closing-view .cd-chip { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: .74rem; font-weight: 600; --t: var(--cd-mut);
                            color: var(--t); background: color-mix(in srgb, var(--t) 14%, transparent); }
                        #closing-view .cd-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
                        #closing-view .cd-mini { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
                        #closing-view .cd-mini > div { padding: 10px 14px; border: 1px solid var(--cd-bd); border-radius: var(--cd-ir); background: var(--cd-soft); }
                        #closing-view .cd-mini small { display: block; color: var(--cd-mut); font-size: .74rem; }
                        #closing-view .cd-mini strong { font-size: 1.02rem; font-variant-numeric: tabular-nums; }
                        #closing-view .cd-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-height: 260px; overflow-y: auto; }
                        #closing-view .cd-list li { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 9px 12px; border: 1px solid var(--cd-bd); border-radius: var(--cd-ir); background: var(--cd-soft); font-variant-numeric: tabular-nums; }
                        #closing-view .cd-list small { display: block; color: var(--cd-mut); font-size: .74rem; }
                        #closing-view .cd-timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
                        #closing-view .cd-timeline li { display: flex; gap: 12px; align-items: flex-start; }
                        #closing-view .cd-timeline li > i { font-size: .5rem; margin-top: 7px; color: var(--cd-pri); }
                        #closing-view .cd-timeline small { display: block; color: var(--cd-mut); font-size: .76rem; }
                        #closing-view .cd-note { font-style: italic; }
                        #closing-view .cd-recon .cd-card-head { margin-bottom: 10px; }
                        #closing-view .cd-rows { display: grid; gap: 8px; font-size: .9rem; }
                        #closing-view .cd-rows > div { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
                        #closing-view .cd-rows span { color: var(--cd-mut); }
                        #closing-view .cd-rows-sum { padding-top: 8px; border-top: 1px dashed var(--cd-bd); }
                        #closing-view .cd-rows-sum span { color: var(--cd-tx); }
                        #closing-view .cd-diff { margin: 14px 0; padding: 14px 16px; text-align: center; border-radius: var(--cd-r); --t: var(--cd-mut);
                            background: color-mix(in srgb, var(--t) 12%, transparent); border: 1px solid color-mix(in srgb, var(--t) 45%, transparent); }
                        #closing-view .cd-diff.tone-ok { --t: var(--cd-ok); } #closing-view .cd-diff.tone-bad { --t: var(--cd-bad); }
                        #closing-view .cd-diff.tone-info { --t: var(--cd-info); } #closing-view .cd-diff.tone-mut { --t: var(--cd-mut); }
                        #closing-view .cd-diff small { display: block; color: var(--cd-mut); }
                        #closing-view .cd-diff strong { display: block; font-size: 1.9rem; line-height: 1.2; color: var(--t); font-variant-numeric: tabular-nums; }
                        #closing-view .cd-diff span { font-size: .76rem; font-weight: 700; letter-spacing: .06em; color: var(--t); }
                        #closing-view .cd-field label { display: block; font-size: .8rem; font-weight: 600; margin-bottom: 6px; }
                        #closing-view .cd-field textarea { width: 100%; resize: vertical; }
                        #closing-view .cd-check { display: flex; gap: 10px; align-items: flex-start; margin-top: 12px; padding: 10px 12px; border-radius: var(--cd-ir); font-size: .86rem; cursor: pointer;
                            border: 1px solid color-mix(in srgb, var(--cd-warn) 45%, transparent); background: color-mix(in srgb, var(--cd-warn) 10%, transparent); }
                        #closing-view .cd-check input { margin-top: 3px; accent-color: var(--cd-pri); }
                        #closing-view .cd-actions { display: grid; gap: 10px; margin-top: 14px; }
                        #closing-view .cd-actions .btn { width: 100%; justify-content: center; }
                        #closing-view .cd-actions .btn:disabled { opacity: .5; cursor: not-allowed; }
                        #closing-view .cd-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
                        #closing-view .cd-checks li { display: flex; gap: 10px; align-items: flex-start; font-size: .86rem; --t: var(--cd-mut); }
                        #closing-view .cd-checks li > i { color: var(--t); margin-top: 3px; }
                        #closing-view .cd-checks li.lv-ok { --t: var(--cd-ok); } #closing-view .cd-checks li.lv-warn { --t: var(--cd-warn); }
                        #closing-view .cd-checks li.lv-bad { --t: var(--cd-bad); } #closing-view .cd-checks li.lv-info { --t: var(--cd-info); }
                        #closing-view .cd-checks small { display: block; color: var(--cd-mut); font-size: .76rem; }
                        #closing-view .cd-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
                        @media (max-width: 1100px) {
                            #closing-view .cd-grid { grid-template-columns: 1fr; }
                            #closing-view .cd-side { position: static; order: -1; }
                        }
                        @media (max-width: 600px) {
                            #closing-view .cd-den { grid-template-columns: 1fr auto; }
                            #closing-view .cd-den-sub { grid-column: 1 / -1; text-align: left; }
                            #closing-view .cd-card { padding: 14px; }
                        }
                    </style>
                    <div id="closingRoot"></div>
                </section>

                <!-- Laporan CoreTax View -->
                <section id="laporan-coretax-view" class="view-section hidden">
                    <div id="coretaxRoot"></div>
                </section>

                <!-- Master Data View -->
                <section id="masterdata-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Master Data Konfigurasi</h2>
                    </div>
                    
                    <div class="row mt-4" style="display: flex; gap: 20px; flex-wrap: wrap;">
                        <!-- Master Pekerjaan -->
                        <div class="col panel" style="flex: 1; min-width: 350px;">
                            <h3>Daftar Pekerjaan & Profil Risiko</h3>
                            <hr class="divider">
                            <div class="form-group row align-center" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <input type="hidden" id="editJobIndex" value="">
                                <div style="flex: 2;"><input type="text" id="newJobInput" class="form-control" placeholder="Nama pekerjaan..."></div>
                                <div style="flex: 1;">
                                    <select id="newJobRisk" class="form-control">
                                        <option value="Rendah">Rendah</option>
                                        <option value="Sedang">Sedang</option>
                                        <option value="Tinggi">Tinggi</option>
                                    </select>
                                </div>
                                <div style="flex: 0.5;"><button class="btn btn-primary w-100" id="btnSaveJob" onclick="addMasterJob()"><i class="fa-solid fa-plus"></i></button></div>
                                <div style="flex: 0.5;"><button class="btn btn-secondary w-100" onclick="clearMasterJobForm()"><i class="fa-solid fa-eraser"></i></button></div>
                            </div>
                            <div class="table-responsive mt-3">
                                <table class="table table-bordered table-sm" style="font-size: 0.9rem;">
                                    <thead style="background: #1e293b; color: #cbd5e1;">
                                        <tr>
                                            <th>Pekerjaan</th>
                                            <th class="text-center">Bobot Risiko</th>
                                            <th class="text-center" style="width: 110px;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="masterJobListTable">
                                        <!-- Injected Jobs -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <!-- Master Warga Negara -->
                        <div class="col panel" style="flex: 1; min-width: 350px;">
                            <h3>Daftar Warga Negara & Profil Risiko</h3>
                            <hr class="divider">
                            <div class="form-group row align-center" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <input type="hidden" id="editCitizenIndex" value="">
                                <div style="flex: 2;"><input type="text" id="newCitizenInput" class="form-control" placeholder="Tambah warga negara..."></div>
                                <div style="flex: 1;">
                                    <select id="newCitizenRisk" class="form-control">
                                        <option value="Rendah">Rendah</option>
                                        <option value="Sedang">Sedang</option>
                                        <option value="Tinggi">Tinggi</option>
                                    </select>
                                </div>
                                <div style="flex: 0.5;"><button class="btn btn-primary w-100" id="btnSaveCitizen" onclick="addMasterCitizen()"><i class="fa-solid fa-plus"></i></button></div>
                                <div style="flex: 0.5;"><button class="btn btn-secondary w-100" onclick="clearMasterCitizenForm()"><i class="fa-solid fa-eraser"></i></button></div>
                            </div>
                            <div class="table-responsive mt-3">
                                <table class="table table-bordered table-sm" style="font-size: 0.9rem;">
                                    <thead style="background: #1e293b; color: #cbd5e1;">
                                        <tr>
                                            <th>Warga Negara</th>
                                            <th class="text-center">Bobot Risiko</th>
                                            <th class="text-center" style="width: 110px;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="masterCitizenList">
                                        <!-- Injected Citizenships -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div class="row mt-4">
                        <div class="col-12 panel" style="width: 100%;">
                            <div class="flex-between" style="gap: 10px; flex-wrap: wrap;">
                                <div>
                                    <h3>Sumber Mata Uang ISO 4217</h3>
                                    <small class="text-muted">Referensi global untuk aplikasi utama dan modul koin saat ingin menambahkan kode mata uang baru.</small>
                                </div>
                                <button class="btn btn-outline" onclick="openIso4217Modal()" style="border-color: #60a5fa; color: #93c5fd;"><i class="fa-solid fa-up-right-from-square"></i> Buka Modal ISO 4217</button>
                            </div>
                            <hr class="divider">
                            <div class="form-group">
                                <input type="text" id="iso4217Filter" class="form-control" placeholder="Cari kode, negara, atau nama mata uang..." oninput="loadIso4217Table()">
                            </div>
                            <div class="table-responsive mt-3" style="max-height: 460px; overflow-y: auto;">
                                <table class="table table-bordered table-sm" style="font-size: 0.9rem;">
                                    <thead style="background: #1e293b; color: #fff; position: sticky; top: 0; z-index: 1;">
                                        <tr>
                                            <th style="width: 90px;">Kode</th>
                                            <th>Negara / Entitas</th>
                                            <th>Nama Mata Uang</th>
                                            <th class="text-center" style="width: 100px;">Simbol</th>
                                            <th class="text-center" style="width: 290px;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="iso4217TableBody">
                                        <tr>
                                            <td colspan="5" class="text-center text-muted">Memuat referensi ISO 4217...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- DTTOT View -->
                <section id="dtott-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Daftar DTTOT (Orang yang Diblokir)</h2>
                    </div>
                    
                    <div class="panel mt-4">
                        <div class="form-group row align-center">
                            <div class="col-md-6">
                                <label>Unggah Daftar DTTOT Baru (Excel/CSV)</label>
                                <input type="file" id="dtottFileInput" class="form-control" accept=".xlsx, .xls, .csv">
                            </div>
                            <div class="col-md-3" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-primary w-100" onclick="uploadDtottFile()"><i class="fa-solid fa-upload"></i> Unggah File</button>
                            </div>
                            <div class="col-md-3" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-danger w-100" onclick="clearDtottList()"><i class="fa-solid fa-trash"></i> Kosongkan</button>
                            </div>
                        </div>

                        <div class="row mt-4 mb-2">
                            <div class="col-md-12">
                                <input type="text" id="dtottSearchInput" class="form-control" placeholder="Cari nama atau data di dalam tabel DTTOT..." onkeyup="filterDtottTable()">
                            </div>
                        </div>

                        <div class="table-responsive mt-2">
                            <table class="table table-bordered">
                                <thead id="dtottTableHead">
                                    <tr>
                                        <th style="width: 50px;">No</th>
                                        <th>Nama Lengkap (Terblokir)</th>
                                    </tr>
                                </thead>
                                <tbody id="dtottTableBody">
                                    <!-- Injected -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <section id="settings-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #0ea5e9;">
                        <div>
                            <h2 style="color: #38bdf8;"><i class="fa-solid fa-gear"></i> Pengaturan Sistem</h2>
                            <p class="text-muted mt-2">Kelola profil perusahaan, saldo awal, hak akses pengguna, dan area reset data.</p>
                        </div>
                    </div>

                    <div class="panel mt-4" style="padding: 0; background: transparent; border: none; box-shadow: none;">
                        <div class="hris-tabs" style="display: flex; gap: 10px; border-bottom: 2px solid #334155; padding-bottom: 10px; overflow-x: auto;">
                            <button class="btn btn-primary btn-sm settings-tab-btn active" id="btn-tab-settings-profile" onclick="switchSettingsTab('profile')"><i class="fa-solid fa-building"></i> Profil</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-wa" onclick="switchSettingsTab('wa')"><i class="fa-brands fa-whatsapp"></i> Template WA</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-wa-gateway" onclick="switchSettingsTab('wa-gateway')"><i class="fa-solid fa-tower-broadcast"></i> WA Gateway</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-login" onclick="switchSettingsTab('login')"><i class="fa-solid fa-right-to-bracket"></i> Halaman Login</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-balance" onclick="switchSettingsTab('balance')"><i class="fa-solid fa-scale-balanced"></i> Saldo Awal</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-users" onclick="switchSettingsTab('users')"><i class="fa-solid fa-users-gear"></i> Pengguna & Akses</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-danger" onclick="switchSettingsTab('danger')"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-ai" onclick="switchSettingsTab('ai')"><i class="fa-solid fa-robot"></i> Asisten AI</button>
                        </div>
                    </div>

                    <div class="panel settings-tab-content" id="settings-tab-profile">
                        <div class="pf">
                            <div class="pf-head">
                                <div>
                                    <h2><i class="fa-solid fa-building"></i> Profil Perusahaan</h2>
                                    <p>Identitas resmi perusahaan yang tercetak pada struk, invoice, laporan, dan dokumen pelaporan. Pastikan data sesuai dokumen perizinan.</p>
                                </div>
                                <div class="pf-actions">
                                    <span class="pf-dirty" id="pfDirty">Ada perubahan yang belum disimpan</span>
                                    <button type="button" class="btn btn-primary" onclick="submitProfile()"><i class="fa-solid fa-floppy-disk"></i> Simpan Profil</button>
                                </div>
                            </div>

                            <div class="pf-layout">
                                <div class="pf-main">
                                    <section class="pf-card">
                                        <h3><span>1</span> Identitas Perusahaan</h3>
                                        <p>Nama dan kontak yang ditampilkan kepada nasabah.</p>
                                        <div class="pf-grid">
                                            <div class="wide">
                                                <label class="pf-l" for="profName">Nama perusahaan <em>*</em></label>
                                                <input type="text" id="profName" class="form-control" maxlength="120" placeholder="Nama perusahaan sesuai izin usaha" autocomplete="organization">
                                            </div>
                                            <div class="wide">
                                                <label class="pf-l" for="profAddress">Alamat lengkap</label>
                                                <textarea id="profAddress" class="form-control" rows="2" maxlength="300" placeholder="Jalan, nomor, kelurahan, kecamatan, kota"></textarea>
                                            </div>
                                            <div>
                                                <label class="pf-l" for="profPhone">Telepon kantor</label>
                                                <input type="text" id="profPhone" class="form-control" inputmode="tel" maxlength="30" placeholder="Kode area dan nomor telepon">
                                            </div>
                                            <div>
                                                <label class="pf-l" for="profWaNumber">Nomor WhatsApp perusahaan</label>
                                                <input type="text" id="profWaNumber" class="form-control" inputmode="tel" maxlength="30" placeholder="Nomor WhatsApp aktif">
                                                <small>Dicantumkan pada struk dan pesan WA (tag [NO_HP_MC]).</small>
                                            </div>
                                        </div>
                                    </section>

                                    <section class="pf-card">
                                        <h3><span>2</span> Perizinan &amp; Pelaporan</h3>
                                        <p>Dipakai pada dokumen resmi dan pelaporan ke regulator (LKU/LKBU BI dan goAML PPATK).</p>
                                        <div class="pf-grid">
                                            <div>
                                                <label class="pf-l" for="profBiLicense">Nomor izin Bank Indonesia</label>
                                                <input type="text" id="profBiLicense" class="form-control" maxlength="80" placeholder="Nomor izin penyelenggara KUPVA BB">
                                            </div>
                                            <div>
                                                <label class="pf-l" for="profIdpjk">Kode IDPJK (penyelenggara)</label>
                                                <input type="text" id="profIdpjk" class="form-control" maxlength="40" placeholder="Kode IDPJK">
                                            </div>
                                            <div>
                                                <label class="pf-l" for="profReporterCode">Nomor sandi pelapor (LKU/LKBU BI)</label>
                                                <input type="text" id="profReporterCode" class="form-control" maxlength="60" placeholder="Nomor sandi pelapor" autocomplete="off">
                                            </div>
                                            <div>
                                                <label class="pf-l" for="profGoamlOrgId">ID organisasi goAML (PPATK)</label>
                                                <input type="text" id="profGoamlOrgId" class="form-control" maxlength="60" placeholder="ID organisasi goAML" autocomplete="off">
                                            </div>
                                        </div>
                                    </section>

                                    <section class="pf-card">
                                        <h3><span>3</span> Cetak Struk</h3>
                                        <p>Atur isi baris pada struk, invoice, dan cetak masal. Isi pesan WhatsApp dikelola terpisah di tab Template WA.</p>
                                        <div class="pf-grid">
                                            <div class="wide">
                                                <label class="pf-l" for="profFooter">Pesan penutup struk</label>
                                                <input type="text" id="profFooter" class="form-control" maxlength="160" placeholder="Kalimat penutup di bagian bawah struk">
                                            </div>
                                        </div>
                                        <div id="pfReceiptEditor"></div>
                                    </section>

                                    <div class="form-group" id="visionKeyBox" style="display:none;"></div>

                                    <section class="pf-card" id="faviconUploadGroup">
                                        <h3><span>4</span> Identitas Aplikasi</h3>
                                        <p>Ikon yang tampil di tab browser dan menggantikan favicon bawaan.</p>
                                        <label class="pf-l" for="faviconUploadInput"><i class="fa-solid fa-image"></i> Favicon aplikasi</label>
                                        <input type="file" id="faviconUploadInput" class="form-control" accept="image/png">
                                        <small>Unggah PNG persegi (disarankan 512 &times; 512 px, maksimal 1 MB).</small>
                                        <div class="pf-fav">
                                            <img id="faviconPreview" src="{{ file_exists($faviconPath) ? asset('favicon.png') . '?v=' . filemtime($faviconPath) : asset('favicon.ico') }}" alt="Pratinjau favicon" style="width:36px; height:36px; object-fit:contain; border:1px solid #dce4e8; border-radius:7px; background:#fff; padding:3px;">
                                            <button type="button" class="btn btn-outline btn-sm" onclick="uploadAppFavicon()"><i class="fa-solid fa-upload"></i> Unggah Favicon</button>
                                        </div>
                                    </section>
                                </div>

                                <aside class="pf-side">
                                    <section class="pf-card">
                                        <h3>Pratinjau Kop Struk</h3>
                                        <p>Tampilan ringkas dari isian di samping.</p>
                                        <div class="pf-slip" id="pfSlip"></div>
                                    </section>
                                </aside>
                            </div>
                        </div>
                    </div>

                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-wa" style="display:none;">
                        <div id="waTplRoot"><p class="text-muted">Memuat template WhatsApp...</p></div>
                    </div>

                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-wa-gateway" style="display:none;">
                        <div id="waGwRoot"><p class="text-muted">Memuat pengaturan WA Gateway...</p></div>
                    </div>

                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-login" style="display:none;">
                        <div id="loginPageRoot"><p class="text-muted">Memuat pengaturan halaman login...</p></div>
                    </div>

                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-balance" style="display:none;">
                        <h2>Form Input Saldo Awal (Modal Dasar)</h2>
                        <hr class="divider mb-4">
                        <div class="form-group row">
                            <div class="col-md-6 mb-3">
                                <label>Modal Kas Tunai (Fisik) Rupiah</label>
                                <div class="input-group">
                                    <span class="input-group-text">Rp</span>
                                    <input type="number" id="initCash" class="form-control" placeholder="0">
                                </div>
                                <small class="text-muted">Akan menjadi titik nol laci kasir.</small>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label>Modal Bank BCA</label>
                                <div class="input-group">
                                    <span class="input-group-text">Rp</span>
                                    <input type="number" id="initBankBCA" class="form-control" placeholder="0">
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label>Modal Bank Mandiri</label>
                                <div class="input-group">
                                    <span class="input-group-text">Rp</span>
                                    <input type="number" id="initBankMandiri" class="form-control" placeholder="0">
                                </div>
                            </div>
                        </div>

                        <hr class="divider my-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5>Inventaris Modal: Saldo Awal Valuta Asing</h5>
                            <button class="btn btn-sm btn-outline-primary" onclick="addInitValasRow()"><i class="fa-solid fa-plus"></i> Tambah Valas (Dari Manajemen Kurs)</button>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead class="text-center" style="background:#f8fafc;">
                                    <tr>
                                        <th>Kode Valas</th>
                                        <th>Jumlah Saldo (Lembar/Asing)</th>
                                        <th>Kurs Modal Dasar (Rp)</th>
                                        <th>Total Ekuivalen (Rp)</th>
                                        <th>Hapus</th>
                                    </tr>
                                </thead>
                                <tbody id="initValasBody">
                                    <!-- Dynamic rows from JS -->
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colspan="3" class="text-end align-middle">Total Valas Awal:</th>
                                        <th id="initTotalValasRp" class="text-end text-success align-middle" style="font-size: 1.1rem;">Rp 0</th>
                                        <th></th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div class="mt-3" style="padding: 12px 14px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; border-radius: 6px; color: #cbd5e1;">
                            <strong>Catatan kurs modal awal:</strong> kurs pada menu `Saldo Awal` sekarang independen. Kode valas masih bisa diambil dari `Manajemen Kurs`, tetapi nilai kurs diisi dan disimpan manual di Pengaturan, tidak mengikuti sinkronisasi kurs otomatis, dan tidak otomatis berubah dari halaman kurs utama.
                        </div>

                        <div class="mt-4 p-3 rounded text-center" style="background: #1e293b; border: 1px solid #334155;">
                            <h3 class="m-0" style="color: #38bdf8;">Total Keseluruhan Modal: <span id="initTotalModalDisplay">Rp 0</span></h3>
                            <small class="text-muted">Gabungan Kas + Bank + Total Ekuivalen Valas</small>
                        </div>
                        
                        <button class="btn btn-success mt-4 w-100" onclick="saveInitialBalances()"><i class="fa-solid fa-save"></i> Terapkan Semua Saldo Awal ke Sistem</button>
                    </div>

                    <!-- Pengguna & Akses -->
                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-users" style="display:none;">
                        <style id="ua-style">
                            #settings-tab-users, #userModal {
                                --ua-bd: var(--mc-border, rgba(148,163,184,.28));
                                --ua-card: var(--mc-card-bg, #18181b);
                                --ua-tx: var(--mc-text, #fafafa);
                                --ua-mut: var(--mc-text-muted, #a1a1aa);
                                --ua-pri: var(--mc-primary, #22c55e);
                                --ua-info: var(--mc-info, #3b82f6);
                                --ua-warn: var(--mc-warning, #f59e0b);
                                --ua-ok: var(--mc-buy, #22c55e);
                                --ua-bad: var(--mc-danger, #ef4444);
                                --ua-r: var(--mc-radius, 12px);
                                --ua-br: var(--mc-btn-radius, 8px);
                                --ua-ir: var(--mc-input-radius, 8px);
                                --ua-soft: color-mix(in srgb, var(--ua-tx) 5%, transparent);
                                --ua-soft2: color-mix(in srgb, var(--ua-tx) 9%, transparent);
                            }
                            #settings-tab-users .ua { color: var(--ua-tx); }
                            #settings-tab-users .ua-head, #settings-tab-users .ua-sec-head { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
                            #settings-tab-users .ua-ico { width:44px; height:44px; border-radius:calc(var(--ua-r) * .9); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex:none;
                                background: color-mix(in srgb, var(--ua-pri) 16%, transparent); color: var(--ua-pri); }
                            #settings-tab-users .ua-head-txt { flex:1; min-width:220px; }
                            #settings-tab-users .ua-head-txt h2, #settings-tab-users .ua-sec-head h3 { margin:0; font-size:1.15rem; color:var(--ua-tx); }
                            #settings-tab-users .ua-head-txt p, #settings-tab-users .ua-sec-head p { margin:3px 0 0; font-size:.84rem; color:var(--ua-mut); }
                            #settings-tab-users .ua-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin:18px 0; }
                            #settings-tab-users .ua-stat { display:flex; align-items:center; gap:12px; padding:14px 16px; background:var(--ua-card); border:1px solid var(--ua-bd); border-radius:var(--ua-r); }
                            #settings-tab-users .ua-stat-ico { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex:none; --t:var(--ua-pri);
                                background:color-mix(in srgb, var(--t) 16%, transparent); color:var(--t); }
                            #settings-tab-users .ua-stat.tone-info .ua-stat-ico { --t:var(--ua-info); }
                            #settings-tab-users .ua-stat.tone-buy .ua-stat-ico { --t:var(--ua-ok); }
                            #settings-tab-users .ua-stat.tone-warning .ua-stat-ico { --t:var(--ua-warn); }
                            #settings-tab-users .ua-stat strong { display:block; font-size:1.35rem; line-height:1.1; }
                            #settings-tab-users .ua-stat small { color:var(--ua-mut); font-size:.78rem; }
                            #settings-tab-users .ua-toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
                            #settings-tab-users .ua-search { position:relative; flex:1; min-width:220px; }
                            #settings-tab-users .ua-search i { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--ua-mut); pointer-events:none; }
                            #settings-tab-users .ua-search input { padding-left:36px; }
                            #settings-tab-users .ua-input, #userModal .ua-input { width:100%; box-sizing:border-box; padding:10px 12px; font:inherit; color:var(--ua-tx);
                                background:var(--mc-input-bg, var(--ua-soft)); border:1px solid var(--mc-input-border, var(--ua-bd)); border-radius:var(--ua-ir); outline:none; transition:border-color .15s, box-shadow .15s; }
                            #settings-tab-users .ua-input:focus, #userModal .ua-input:focus { border-color:var(--ua-pri); box-shadow:0 0 0 3px color-mix(in srgb, var(--ua-pri) 22%, transparent); }
                            #settings-tab-users select.ua-input, #userModal select.ua-input { width:auto; min-width:160px; }
                            #userModal select.ua-input { width:100%; }
                            #settings-tab-users .ua-count { font-size:.82rem; color:var(--ua-mut); margin-left:auto; }
                            #settings-tab-users .ua-tablewrap { overflow-x:auto; border:1px solid var(--ua-bd); border-radius:var(--ua-r); background:var(--ua-card); }
                            #settings-tab-users .ua-table { width:100%; border-collapse:collapse; min-width:560px; }
                            #settings-tab-users .ua-table th { text-align:left; padding:11px 16px; font-size:.74rem; letter-spacing:.05em; text-transform:uppercase; color:var(--ua-mut);
                                background:var(--mc-table-head, var(--ua-soft)); border-bottom:1px solid var(--ua-bd); white-space:nowrap; }
                            #settings-tab-users .ua-table td { padding:12px 16px; border-bottom:1px solid var(--ua-bd); vertical-align:middle; }
                            #settings-tab-users .ua-table tr:last-child td { border-bottom:0; }
                            #settings-tab-users .ua-table tbody tr:hover { background:var(--mc-table-hover, var(--ua-soft)); }
                            #settings-tab-users .ua-user { display:flex; align-items:center; gap:12px; }
                            #settings-tab-users .ua-user-txt b { display:block; }
                            #settings-tab-users .ua-user-txt small, #settings-tab-users .ua-muted { color:var(--ua-mut); font-size:.82rem; }
                            .ua-av { --ua-c:var(--mc-primary,#22c55e); width:38px; height:38px; border-radius:50%; flex:none; display:inline-flex; align-items:center; justify-content:center; overflow:hidden;
                                font-weight:700; font-size:.85rem; color:var(--ua-c); background:color-mix(in srgb, var(--ua-c) 18%, transparent); border:2px solid color-mix(in srgb, var(--ua-c) 45%, transparent); }
                            .ua-av img { width:100%; height:100%; object-fit:cover; display:block; }
                            #settings-tab-users .ua-you { font-size:.68rem; font-weight:700; padding:2px 7px; border-radius:99px; margin-left:6px; vertical-align:middle;
                                background:color-mix(in srgb, var(--ua-pri) 18%, transparent); color:var(--ua-pri); }
                            #settings-tab-users .ua-badge { display:inline-block; padding:4px 11px; border-radius:99px; font-size:.78rem; font-weight:700;
                                color:var(--ua-c); background:color-mix(in srgb, var(--ua-c) 16%, transparent); border:1px solid color-mix(in srgb, var(--ua-c) 40%, transparent); }
                            #settings-tab-users .ua-actions-cell { text-align:right; white-space:nowrap; }
                            #settings-tab-users .ua-icon-btn { width:34px; height:34px; border-radius:var(--ua-br); border:1px solid var(--ua-bd); background:var(--ua-soft); color:var(--ua-tx); cursor:pointer; margin-left:6px; transition:all .15s; }
                            #settings-tab-users .ua-icon-btn:hover { border-color:var(--ua-pri); color:var(--ua-pri); background:color-mix(in srgb, var(--ua-pri) 12%, transparent); }
                            #settings-tab-users .ua-icon-btn.danger:hover { border-color:var(--ua-bad); color:var(--ua-bad); background:color-mix(in srgb, var(--ua-bad) 12%, transparent); }
                            #settings-tab-users .ua-empty { text-align:center; padding:36px 16px !important; color:var(--ua-mut); }
                            #settings-tab-users .ua-empty i { font-size:1.8rem; display:block; margin-bottom:8px; opacity:.6; }

                            #settings-tab-users .ua-access { margin-top:30px; padding-top:24px; border-top:1px solid var(--ua-bd); }
                            #settings-tab-users .ua-sec-actions { margin-left:auto; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
                            #settings-tab-users .ua-dirty { font-size:.78rem; font-weight:700; padding:4px 10px; border-radius:99px; color:var(--ua-warn); background:color-mix(in srgb, var(--ua-warn) 16%, transparent); }
                            #settings-tab-users .ua-dirty[hidden] { display:none; }
                            #settings-tab-users .ua-hidden-select { display:none; }
                            #settings-tab-users .ua-rolebar { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 8px; }
                            #settings-tab-users .ua-pill { display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:99px; cursor:pointer; font:inherit; font-size:.86rem; font-weight:600;
                                color:var(--ua-tx); background:var(--ua-soft); border:1px solid var(--ua-bd); transition:all .15s; }
                            #settings-tab-users .ua-pill:hover { border-color:var(--ua-c); }
                            #settings-tab-users .ua-pill.active { color:var(--ua-c); background:color-mix(in srgb, var(--ua-c) 16%, transparent); border-color:var(--ua-c); }
                            #settings-tab-users .ua-dot { width:9px; height:9px; border-radius:50%; background:var(--ua-c); }
                            #settings-tab-users .ua-pill em { font-style:normal; font-size:.72rem; padding:1px 7px; border-radius:99px; background:var(--ua-soft2); color:var(--ua-mut); }
                            #settings-tab-users .ua-meta { display:flex; flex-wrap:wrap; gap:12px 20px; align-items:center; margin:10px 0 16px; font-size:.84rem; color:var(--ua-mut); }
                            #settings-tab-users .ua-meta b { color:var(--ua-tx); }
                            #settings-tab-users .ua-summary { display:flex; gap:16px; flex-wrap:wrap; }
                            #settings-tab-users .ua-meta .ua-search { max-width:280px; margin-left:auto; flex:1; }
                            #settings-tab-users .ua-note { font-size:.82rem; color:var(--ua-warn); margin-bottom:12px; }
                            #settings-tab-users .ua-cols { display:flex; gap:18px; flex-wrap:wrap; align-items:flex-start; }
                            #settings-tab-users .ua-col-main { flex:2; min-width:320px; display:grid; gap:14px; }
                            #settings-tab-users .ua-col-side { flex:1; min-width:260px; display:grid; gap:14px; }
                            #settings-tab-users .ua-group { background:var(--ua-card); border:1px solid var(--ua-bd); border-radius:var(--ua-r); padding:14px; }
                            #settings-tab-users .ua-group-head { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
                            #settings-tab-users .ua-group-count { font-size:.74rem; padding:2px 8px; border-radius:99px; background:var(--ua-soft2); color:var(--ua-mut); }
                            #settings-tab-users .ua-group-btns { margin-left:auto; display:flex; gap:12px; }
                            #settings-tab-users .ua-link { background:none; border:0; padding:0; cursor:pointer; font:inherit; font-size:.78rem; color:var(--mc-link, var(--ua-pri)); }
                            #settings-tab-users .ua-link:hover { text-decoration:underline; }
                            #settings-tab-users .ua-opts { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:8px; }
                            #settings-tab-users .ua-group.compact .ua-opts { grid-template-columns:1fr; }
                            #settings-tab-users .ua-opt { position:relative; display:flex; align-items:center; gap:10px; padding:9px 12px; cursor:pointer; user-select:none; font-size:.88rem;
                                border:1px solid var(--ua-bd); border-radius:var(--ua-ir); background:var(--ua-soft); transition:border-color .15s, background .15s; }
                            #settings-tab-users .ua-opt:hover { border-color:var(--ua-pri); }
                            #settings-tab-users .ua-opt input { position:absolute; opacity:0; pointer-events:none; }
                            #settings-tab-users .ua-sw { width:34px; height:19px; border-radius:99px; flex:none; position:relative; background:var(--ua-soft2); border:1px solid var(--ua-bd); transition:background .18s; }
                            #settings-tab-users .ua-sw::after { content:""; position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%; background:var(--ua-mut); transition:transform .18s, background .18s; }
                            #settings-tab-users .ua-opt input:checked + .ua-sw { background:color-mix(in srgb, var(--ua-pri) 35%, transparent); border-color:var(--ua-pri); }
                            #settings-tab-users .ua-opt input:checked + .ua-sw::after { transform:translateX(15px); background:var(--ua-pri); }
                            #settings-tab-users .ua-opt:has(input:checked) { border-color:color-mix(in srgb, var(--ua-pri) 55%, transparent); background:color-mix(in srgb, var(--ua-pri) 7%, transparent); }
                            #settings-tab-users .ua-opt input:focus-visible + .ua-sw { outline:2px solid var(--ua-pri); outline-offset:2px; }

                            #userModal { display:none; position:fixed; inset:0; z-index:10050; align-items:center; justify-content:center; padding:16px; background:rgba(2,6,23,.62); backdrop-filter:blur(3px); }
                            #userModal .ua-dialog { width:100%; max-width:480px; max-height:92vh; overflow:auto; box-sizing:border-box; color:var(--ua-tx);
                                background:var(--ua-card); border:1px solid var(--ua-bd); border-radius:var(--ua-r); box-shadow:var(--mc-shadow, 0 24px 60px rgba(0,0,0,.5)); }
                            #userModal .ua-dhead { display:flex; align-items:center; gap:12px; padding:18px 22px; border-bottom:1px solid var(--ua-bd); }
                            #userModal .ua-dhead h3 { margin:0; font-size:1.05rem; flex:1; color:var(--ua-tx); }
                            #userModal .ua-x { width:34px; height:34px; border-radius:50%; border:0; cursor:pointer; background:var(--ua-soft); color:var(--ua-mut); }
                            #userModal .ua-x:hover { color:var(--ua-bad); }
                            #userModal .ua-dbody { padding:20px 22px; display:grid; gap:16px; }
                            #userModal .ua-photo { display:flex; align-items:center; gap:16px; }
                            #userModal .ua-photo .ua-av { width:76px; height:76px; font-size:1.4rem; }
                            #userModal .ua-photo-btns { display:flex; gap:8px; flex-wrap:wrap; }
                            #userModal .ua-field label { display:block; font-size:.8rem; font-weight:600; margin-bottom:6px; color:var(--ua-mut); }
                            #userModal .ua-hint { margin-top:6px; font-size:.78rem; color:var(--ua-mut); }
                            #userModal .ua-pwwrap { position:relative; }
                            #userModal .ua-pwwrap .ua-input { padding-right:42px; }
                            #userModal .ua-eye { position:absolute; right:4px; top:50%; transform:translateY(-50%); width:34px; height:34px; border:0; background:none; cursor:pointer; color:var(--ua-mut); }
                            #userModal .ua-meter { height:4px; border-radius:4px; margin-top:8px; background:var(--ua-soft2); overflow:hidden; }
                            #userModal .ua-meter > div { height:100%; width:0; border-radius:4px; transition:width .2s; }
                            #userModal .ua-meter .weak { background:var(--ua-bad); }
                            #userModal .ua-meter .mid { background:var(--ua-warn); }
                            #userModal .ua-meter .good { background:var(--ua-ok); }
                            #userModal .ua-dfoot { display:flex; gap:10px; justify-content:flex-end; padding:14px 22px 20px; border-top:1px solid var(--ua-bd); }
                            #settings-tab-users .ua-urow { display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin:16px 0 8px; }
                            #settings-tab-users .ua-urow select.ua-input { flex:1; min-width:240px; max-width:420px; }
                            #settings-tab-users .ua-custom-toggle { width:auto; }
                            #settings-tab-users .ua-info { color:var(--ua-mut); }
                            #settings-tab-users .ua-info b { color:var(--ua-tx); }
                            #settings-tab-users .ua-cols.is-locked .ua-opt { opacity:.55; pointer-events:none; }
                            #settings-tab-users .ua-cols.is-locked .ua-link { display:none; }
                            #settings-tab-users .ua-subtitle { margin:24px 0 10px; font-size:.95rem; color:var(--ua-tx); }
                            #settings-tab-users .ua-subtitle i { color:var(--ua-warn); margin-right:6px; }
                            #settings-tab-users .ua-crow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:10px 14px; margin-bottom:8px; background:var(--ua-card); border:1px solid var(--ua-bd); border-radius:var(--ua-r); }
                            #settings-tab-users .ua-crow .ua-user-txt { flex:1; min-width:140px; }
                            #settings-tab-users .ua-crow-btns { margin-left:auto; }
                            #settings-tab-users .ua-custom-tag { font-size:.7rem; font-weight:700; padding:2px 8px; border-radius:99px; margin-left:6px; color:var(--ua-warn); background:color-mix(in srgb, var(--ua-warn) 16%, transparent); }
                            @media (max-width:640px) {
                                #settings-tab-users .ua-count { margin-left:0; }
                                #settings-tab-users .ua-meta .ua-search { max-width:none; margin-left:0; }
                                #userModal .ua-dfoot .btn { flex:1; }
                            }
                        </style>

                        <div id="userManagementPanel" class="ua">
                            <div class="ua-head">
                                <div class="ua-ico"><i class="fa-solid fa-users-gear"></i></div>
                                <div class="ua-head-txt">
                                    <h2>Pengguna &amp; Akses</h2>
                                    <p>Kelola akun yang bisa masuk ke aplikasi dan atur menu yang boleh dibuka tiap role.</p>
                                </div>
                                <button type="button" class="btn btn-primary" onclick="openUserModal()"><i class="fa-solid fa-user-plus"></i> Tambah Pengguna</button>
                            </div>

                            <div class="ua-stats" id="uaStats"></div>

                            <div class="ua-toolbar">
                                <div class="ua-search">
                                    <i class="fa-solid fa-magnifying-glass"></i>
                                    <input type="search" id="uaSearch" class="ua-input" placeholder="Cari username, nama, atau role..." autocomplete="off">
                                </div>
                                <select id="uaRoleFilter" class="ua-input" aria-label="Filter role"><option value="all">Semua role</option></select>
                                <span class="ua-count" id="uaCount"></span>
                            </div>

                            <div class="ua-tablewrap">
                                <table class="ua-table">
                                    <thead>
                                        <tr>
                                            <th>Pengguna</th>
                                            <th>Role</th>
                                            <th>Level Akses</th>
                                            <th style="text-align:right;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="userTableBody"></tbody>
                                </table>
                            </div>

                            <div class="ua-access" id="roleAccessSettingsPanel">
                                <div class="ua-sec-head">
                                    <div class="ua-ico"><i class="fa-solid fa-key"></i></div>
                                    <div>
                                        <h3>Setting Hak Akses</h3>
                                        <p>Pilih role, lalu aktifkan menu dan fitur yang boleh dipakai role tersebut.</p>
                                    </div>
                                    <div class="ua-sec-actions">
                                        <span class="ua-dirty" id="raDirty" hidden><i class="fa-solid fa-circle-exclamation"></i> Belum disimpan</span>
                                        <button type="button" class="btn btn-outline" onclick="resetRoleAccessToDefault()"><i class="fa-solid fa-rotate-left"></i> Reset Default</button>
                                        <button type="button" class="btn btn-primary" onclick="saveRoleAccessSettings()"><i class="fa-solid fa-floppy-disk"></i> Simpan Hak Akses</button>
                                    </div>
                                </div>

                                <select id="roleAccessEditor" class="ua-hidden-select" onchange="loadRoleAccessEditor()" aria-hidden="true" tabindex="-1">
                                    <option value="owner">Owner</option>
                                    <option value="admin">Admin</option>
                                    <option value="kasir">Kasir</option>
                                    <option value="teller">Teller</option>
                                </select>
                                <div class="ua-rolebar" id="raRolePills"></div>

                                <div class="ua-meta">
                                    <div class="ua-summary" id="raSummary"></div>
                                    <div class="ua-search">
                                        <i class="fa-solid fa-magnifying-glass"></i>
                                        <input type="search" id="raSearch" class="ua-input" placeholder="Cari menu atau fitur..." autocomplete="off">
                                    </div>
                                </div>
                                <div class="ua-note" id="raNote" style="display:none;"></div>

                                <div class="ua-cols">
                                    <div class="ua-col-main" id="roleAccessMenuList"></div>
                                    <div class="ua-col-side">
                                        <div id="roleAccessSpecialList"></div>
                                        <div id="roleAccessActionList"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="ua-access" id="userAccessPanel" data-role-special="accessSettings">
                                <div class="ua-sec-head">
                                    <div class="ua-ico"><i class="fa-solid fa-user-lock"></i></div>
                                    <div>
                                        <h3>Akses Per Pengguna</h3>
                                        <p>Role memberi akses dasar. Di sini Anda bisa mengatur menu khusus untuk satu orang tanpa mengubah role-nya.</p>
                                    </div>
                                    <div class="ua-sec-actions">
                                        <span class="ua-dirty" id="uaUDirty" hidden><i class="fa-solid fa-circle-exclamation"></i> Belum disimpan</span>
                                        <button type="button" class="btn btn-outline" id="uaUCopy"><i class="fa-solid fa-copy"></i> Salin dari Role</button>
                                        <button type="button" class="btn btn-outline" id="uaUClear"><i class="fa-solid fa-rotate-left"></i> Kembali ke Role</button>
                                        <button type="button" class="btn btn-primary" id="uaUSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Akses Pengguna</button>
                                    </div>
                                </div>

                                <div class="ua-urow">
                                    <select id="uaUserSel" class="ua-input" aria-label="Pilih pengguna"></select>
                                    <label class="ua-opt ua-custom-toggle">
                                        <input type="checkbox" id="uaCustomOn">
                                        <span class="ua-sw"></span><span class="ua-opt-txt">Pakai akses khusus untuk pengguna ini</span>
                                    </label>
                                </div>
                                <div class="ua-note ua-info" id="uaUInfo"></div>

                                <div class="ua-meta">
                                    <div class="ua-summary" id="uaUSummary"></div>
                                    <div class="ua-search">
                                        <i class="fa-solid fa-magnifying-glass"></i>
                                        <input type="search" id="uaUserSearch" class="ua-input" placeholder="Cari menu atau fitur..." autocomplete="off">
                                    </div>
                                </div>

                                <div class="ua-cols is-locked" id="uaUCols">
                                    <div class="ua-col-main" id="uaUserMenuList"></div>
                                    <div class="ua-col-side">
                                        <div id="uaUserSpecialList"></div>
                                        <div id="uaUserActionList"></div>
                                    </div>
                                </div>

                                <h4 class="ua-subtitle"><i class="fa-solid fa-star"></i> Pengguna dengan akses khusus</h4>
                                <div id="uaCustomList"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Form Pengguna -->
                    <div id="userModal" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
                        <div class="ua-dialog">
                            <div class="ua-dhead">
                                <div class="ua-ico" style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb, var(--ua-pri) 16%, transparent);color:var(--ua-pri);"><i class="fa-solid fa-user-pen"></i></div>
                                <h3 id="userModalTitle">Form Pengguna</h3>
                                <button type="button" class="ua-x" onclick="closeUserModal()" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                            <div class="ua-dbody">
                                <input type="hidden" id="editUserId">
                                <div class="ua-photo">
                                    <div id="previewUserPhoto"></div>
                                    <div>
                                        <div class="ua-photo-btns">
                                            <label for="mUserPhoto" class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;"><i class="fa-solid fa-camera"></i> Pilih Foto</label>
                                            <button type="button" class="btn btn-outline btn-sm" id="uaPhotoClear" onclick="clearUserPhoto()" style="display:none;"><i class="fa-solid fa-trash"></i> Hapus</button>
                                        </div>
                                        <div class="ua-hint">Opsional. JPG atau PNG, maksimal 3 MB.</div>
                                        <input type="file" id="mUserPhoto" accept="image/*" onchange="handleUserPhoto(this)" style="display:none;">
                                    </div>
                                </div>
                                <div class="ua-field">
                                    <label for="mUserUsername">Username</label>
                                    <input type="text" id="mUserUsername" class="ua-input" autocomplete="off" placeholder="contoh: nama.kasir">
                                </div>
                                <div class="ua-field">
                                    <label for="mUserFullName">Nama Lengkap</label>
                                    <input type="text" id="mUserFullName" class="ua-input" autocomplete="off">
                                </div>
                                <div class="ua-field">
                                    <label for="mUserPassword">Password</label>
                                    <div class="ua-pwwrap">
                                        <input type="password" id="mUserPassword" class="ua-input" autocomplete="new-password" placeholder="Kata sandi...">
                                        <button type="button" class="ua-eye" onclick="toggleUserPassword()" aria-label="Tampilkan password"><i class="fa-solid fa-eye" id="uaPwEye"></i></button>
                                    </div>
                                    <div class="ua-meter"><div id="uaPwBar"></div></div>
                                    <div class="ua-hint" id="uaPwText"></div>
                                </div>
                                <div class="ua-field">
                                    <label for="mUserRole">Role (Hak Akses)</label>
                                    <select id="mUserRole" class="ua-input">
                                        <option value="owner">Owner (Admin Super)</option>
                                        <option value="kasir">Kasir</option>
                                        <option value="teller">Teller</option>
                                        <option value="admin">Admin</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="kurir">Kurir</option>
                                        <option value="keamanan">Keamanan / Satpam</option>
                                        <option value="papan">Papan Kurs</option>
                                        <option value="lainnya">Lainnya</option>
                                    </select>
                                    <div class="ua-hint" id="uaRoleHint"></div>
                                </div>
                            </div>
                            <div class="ua-dfoot">
                                <button type="button" class="btn btn-outline" onclick="closeUserModal()">Batal</button>
                                <button type="button" class="btn btn-primary" id="uaSaveBtn" onclick="saveUser()"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengguna</button>
                            </div>
                        </div>
                    </div>


                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-danger" style="display:none;">
                        <style>
                            #settings-tab-danger .dz-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}
                            #settings-tab-danger .dz-head .dz-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.1rem}
                            #settings-tab-danger .dz-ico.green{background:rgba(16,185,129,.15);color:#10b981}
                            #settings-tab-danger .dz-ico.red{background:rgba(239,68,68,.15);color:#ef4444}
                            #settings-tab-danger .dz-head h3{margin:0;font-size:1.1rem}
                            #settings-tab-danger .dz-head p{margin:2px 0 0;font-size:.82rem;opacity:.7}
                            #settings-tab-danger .dz-section{border-radius:16px;padding:22px;margin-bottom:22px;border:1px solid rgba(148,163,184,.28)}
                            #settings-tab-danger .dz-section.backup{border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.04)}
                            #settings-tab-danger .dz-section.reset{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.04)}
                            #settings-tab-danger .dz-checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:16px}
                            #settings-tab-danger .dz-checks label{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(148,163,184,.3);border-radius:10px;cursor:pointer;font-size:.88rem}
                            #settings-tab-danger .dz-checks label:hover{border-color:#ef4444;background:rgba(239,68,68,.06)}
                            #settings-tab-danger .dz-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
                            #settings-tab-danger .dz-note{margin-top:14px;padding:10px 14px;border-left:3px solid #f59e0b;background:rgba(245,158,11,.08);border-radius:6px;font-size:.82rem;line-height:1.5}
                        </style>

                        <div class="dz-section backup">
                            <div class="dz-head">
                                <div class="dz-ico green"><i class="fa-solid fa-database"></i></div>
                                <div>
                                    <h3>Backup &amp; Restore</h3>
                                    <p>Backup otomatis terjadwal ke MySQL (ledger ERP) dan backup manual. Dilakukan sebelum reset data apa pun.</p>
                                </div>
                            </div>
                            <div id="backup-module-root"></div>
                        </div>

                        <div class="dz-section reset">
                            <div class="dz-head">
                                <div class="dz-ico red"><i class="fa-solid fa-triangle-exclamation"></i></div>
                                <div>
                                    <h3 style="color:#ef4444;">Reset Data (Danger Zone)</h3>
                                    <p>Pilih hanya halaman/data yang ingin direset. Master valuta, profil perusahaan, dan pengguna tidak dihapus dari sini.</p>
                                </div>
                            </div>
                            <div id="resetTableRoot"></div>
                            <div class="dz-actions">
                                <button type="button" class="btn btn-success" onclick="backupDatabase()"><i class="fa-solid fa-download"></i> Unduh Backup JSON (Browser)</button>
                                <button type="button" class="btn btn-info" onclick="triggerRestore()" style="background:#3b82f6;color:white;border:none;"><i class="fa-solid fa-rotate-left"></i> Restore Database</button>
                                <input type="file" id="restoreFileInput" style="display:none;" accept=".json" onchange="restoreDatabase(event)">
                                <button type="button" class="btn btn-danger" onclick="resetSelectedData()"><i class="fa-solid fa-trash"></i> Reset Data yang Dipilih</button>
                                <button type="button" class="btn btn-danger" onclick="resetAllData()" style="background:#7f1d1d;border-color:#7f1d1d;"><i class="fa-solid fa-skull-crossbones"></i> Reset Total (Mulai dari Nol)</button>
                            </div>
                        </div>
                    </div>


                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-ai" style="display:none;">
                        <div id="aiCfgRoot"></div>
                    </div>
                </section>


                <!-- LAPORAN BI PLACEHOLDERS -->
                <section id="laporan-lku-view" class="view-section hidden">
    <style>
        #laporan-lku-view{--lk-accent:var(--mc-buy,#10b981);--lk-line:var(--mc-border,rgba(148,163,184,.35))}
        #laporan-lku-view .lkbu-tabs{display:flex;flex-wrap:wrap;gap:0;border-bottom:1px solid var(--lk-line);margin-bottom:18px}
        #laporan-lku-view .lkbu-tab{appearance:none;border:0;border-bottom:3px solid transparent;background:transparent;color:inherit;padding:13px 16px;cursor:pointer;font-weight:700;font-size:.92rem;text-align:left;transition:background .15s,color .15s}
        #laporan-lku-view .lkbu-tab:hover{background:color-mix(in srgb,var(--mc-primary,#3b82f6) 10%,transparent)}
        #laporan-lku-view .lkbu-tab:focus-visible{outline:2px solid var(--mc-primary,#3b82f6);outline-offset:-2px}
        #laporan-lku-view .lkbu-tab.active{border-bottom-color:var(--lk-accent);color:var(--lk-accent);background:color-mix(in srgb,var(--lk-accent) 9%,transparent)}
        #laporan-lku-view .lkbu-code{font-size:.72rem;opacity:.7;margin-left:5px;font-weight:600}
        #laporan-lku-view .lkbu-panel{display:none}
        #laporan-lku-view .lkbu-panel.active{display:block}
        #laporan-lku-view .lkbu-source-table td.text-end,#laporan-lku-view .lkbu-source-table th.text-end{font-variant-numeric:tabular-nums}
        #laporan-lku-view .lkbu-source-table tr.lkbu-total td{font-weight:700;background:color-mix(in srgb,var(--lk-accent) 7%,transparent)}
        #laporan-lku-view .lkbu-empty{min-height:220px;display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed var(--lk-line);border-radius:12px;padding:30px}
        @media(max-width:900px){#laporan-lku-view .lkbu-tab{flex:1 1 45%;font-size:.82rem}}
        @media(max-width:600px){#laporan-lku-view .lkbu-tab{flex:1 1 100%}}
    </style>

    <div class="panel" style="margin-bottom:18px;">
        <div style="margin-bottom:10px;">
            <h2 style="margin:0;">LKBU - Laporan Keuangan dan Bisnis Umum</h2>
            <p class="text-muted mt-2" style="margin-bottom:0;">Pusat pelaporan LKBU. Pilih tab B0001 sampai B0006 untuk membuka masing-masing kelompok laporan.</p>
        </div>
        <div class="lkbu-tabs" role="tablist" aria-label="LKBU">
            <button type="button" class="lkbu-tab active" data-lkbu-tab="b0001">Kegiatan Usaha Bulanan <span class="lkbu-code">B0001</span></button>
            <button type="button" class="lkbu-tab" data-lkbu-tab="b0002">Keuangan Neraca <span class="lkbu-code">B0002</span></button>
            <button type="button" class="lkbu-tab" data-lkbu-tab="b0003">Keuangan Laba/Rugi <span class="lkbu-code">B0003</span></button>
            <button type="button" class="lkbu-tab" data-lkbu-tab="b0004">Perubahan Ekuitas <span class="lkbu-code">B0004</span></button>
            <button type="button" class="lkbu-tab" data-lkbu-tab="b0005">Kurs <span class="lkbu-code">B0005</span></button>
            <button type="button" class="lkbu-tab" data-lkbu-tab="b0006">Money Remittance <span class="lkbu-code">B0006</span></button>
        </div>
    </div>

    <div id="lkbu-panel-b0001" class="lkbu-panel active">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan LKU (Bank Indonesia)</h2>
                            <p class="text-muted mt-2">Menampilkan data mutasi Saldo Awal, Total Beli, Total Jual, dan Sisa Stok KUPVA berdasarkan Kalkulator Retrospektif.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-success" onclick="exportLkuTxt()"><i class="fa-solid fa-file-lines"></i> Export TXT</button>
                            <button class="btn btn-primary" onclick="exportTableToExcel('lkuTable', 'Laporan_LKU')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-3">
                                <label>Periode Laporan</label>
                                <input type="month" id="lkuReportPeriod" class="form-control" onchange="applyLkuPeriodToDates(this.value); loadLaporanLku();">
                            </div>
                            <div class="col-md-3">
                                <label>Dari Tanggal (Start Date)</label>
                                <input type="date" id="lkuStartDate" class="form-control" onchange="syncLkuPeriodFromDates(); loadLaporanLku();">
                            </div>
                            <div class="col-md-4">
                                <label>Sampai Tanggal (End Date)</label>
                                <input type="date" id="lkuEndDate" class="form-control" onchange="syncLkuPeriodFromDates(); loadLaporanLku();">
                            </div>
                            <div class="col-md-2" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-secondary w-100" id="btnFilterLku"><i class="fa-solid fa-search"></i> Filter</button>
                            </div>
                        </div>

                        <div class="mt-4" style="padding:16px; border:1px solid var(--mc-border); border-radius:8px; background:var(--mc-card-bg); color:var(--mc-text);">
                            <div class="flex-between" style="gap: 12px; flex-wrap: wrap;">
                                <div>
                                    <h3 style="margin-bottom: 4px;">Kurs Tengah BI Bulanan</h3>
                                    <small class="text-muted">Input kurs akhir bulan untuk valuasi sisa akhir LKU. Kurs awal otomatis memakai kurs BI bulan sebelumnya.</small>
                                </div>
                            </div>

                            <div class="form-group row mt-3" style="display:none;">
                                <input type="hidden" id="biRateEditId" value="">
                                <input type="month" id="biRatePeriod" class="form-control" style="display:none;">
                                <div style="flex:1; min-width:140px;">
                                    <label>Valuta</label>
                                    <select id="biRateCurrency" class="form-control"></select>
                                </div>
                                <div style="flex:1; min-width:150px;">
                                    <label>Jenis Kurs</label>
                                    <select id="biRateType" class="form-control" onchange="updateBiRateTypeNote()">
                                        <option value="akhir">Akhir Periode</option>
                                        <option value="awal">Awal Periode</option>
                                    </select>
                                </div>
                                <div style="flex:1; min-width:170px;">
                                    <label>Kurs Tengah BI</label>
                                    <input type="number" id="biRateValue" class="form-control" placeholder="0">
                                </div>
                                <div style="flex:1.4; min-width:220px;">
                                    <label>Keterangan</label>
                                    <input type="text" id="biRateNote" class="form-control" placeholder="Kurs Tengah BI Akhir Bulan">
                                </div>
                                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                                    <button type="button" class="btn btn-primary" onclick="saveBiRateFromLku()"><i class="fa-solid fa-save"></i> Simpan</button>
                                    <button type="button" class="btn btn-secondary" onclick="clearBiRateForm()"><i class="fa-solid fa-eraser"></i> Bersihkan</button>
                                </div>
                            </div>

                            <div class="mt-3 p-3" style="border:1px dashed var(--mc-border);border-radius:8px;background:var(--mc-card-bg);color:var(--mc-text);">
                                <div style="font-weight:600;margin-bottom:6px;"><i class="fa-solid fa-file-csv"></i> Upload Kurs Tengah BI sekaligus</div>
                                <div class="text-muted" style="font-size:.85rem;margin-bottom:10px;">Unggah file Excel atau CSV berisi banyak valuta dan kurs BI. Data dengan kombinasi periode, valuta, dan jenis yang sama akan diperbarui, bukan digandakan.</div>
                                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                                    <input type="file" id="biRateCsvFile" class="form-control" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="max-width:360px;">
                                    <button type="button" class="btn btn-primary" onclick="importBiRatesExcelTemplate(document.getElementById('biRateCsvFile'))"><i class="fa-solid fa-upload"></i> Import Excel / CSV</button>
                                    <button type="button" class="btn btn-secondary" onclick="downloadBiRateCsvTemplate()"><i class="fa-solid fa-download"></i> Unduh Template CSV</button>
                                </div>
                                <small class="text-muted d-block mt-2">Template Excel: kolom A nama valuta (contoh USD - US Dollar), kolom B Kurs Tengah BI, kolom C tanggal kurs. Impor menyimpan sebagai Kurs Akhir Periode.</small>
                            </div>
                            <div id="biRateStatus" class="mt-2 text-muted" style="font-size:0.85rem;"></div>
                            <div class="table-responsive mt-3" style="max-height: 260px; overflow-y:auto;">
                                <table class="table table-bordered table-sm" style="font-size:0.86rem;">
                                    <thead style="background:#1e293b; color:#fff; position:sticky; top:0; z-index:1;">
                                        <tr>
                                            <th>Periode</th>
                                            <th>Valuta</th>
                                            <th>Jenis</th>
                                            <th class="text-end">Kurs Tengah BI</th>
                                            <th>Keterangan</th>
                                            <th class="text-center" style="width:110px;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="biRatesTableBody">
                                        <tr><td colspan="6" class="text-center text-muted">Belum ada kurs BI bulanan.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="table-responsive mt-3">
                            <table class="table table-bordered table-striped" style="border: 1px solid #e2e8f0; font-size: 0.85rem;" id="lkuTable">
                                <thead class="text-center">
                                    <tr>
                                        <th rowspan="2" class="align-middle">Valuta</th>
                                        <th colspan="3">Saldo Awal</th>
                                        <th colspan="3" style="color: #10b981;">Pembelian (+)</th>
                                        <th colspan="3" style="color: #ef4444;">Penjualan (-)</th>
                                        <th colspan="3">Sisa Akhir</th>
                                    </tr>
                                    <tr>
                                        <th>Valas</th>
                                        <th>Kurs BI Awal</th>
                                        <th>Total Rp</th>
                                        <th style="color: #10b981;">Valas</th>
                                        <th style="color: #10b981;">Kurs Rata</th>
                                        <th style="color: #10b981;">Total Rp</th>
                                        <th style="color: #ef4444;">Valas</th>
                                        <th style="color: #ef4444;">Kurs Rata</th>
                                        <th style="color: #ef4444;">Total Rp</th>
                                        <th>Valas</th>
                                        <th>Kurs BI Akhir</th>
                                        <th>Total Rp</th>
                                    </tr>
                                </thead>
                                <tbody id="lkuTableBody">
                                    <tr><td colspan="13" class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Menghitung rekam jejak...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
    </div>

    <div id="lkbu-panel-b0002" class="lkbu-panel">
  <div class="panel header-panel">
    <div class="d-flex flex-wrap align-items-end gap-2">
      <div>
        <label for="lkbuB0002Date" class="form-label">Tanggal Neraca</label>
        <input type="date" id="lkbuB0002Date" class="form-control">
      </div>
      <button type="button" class="btn btn-primary" onclick="window.kalkulasiNeracaB0002()">
        Kalkulasi Neraca
      </button>
      <button type="button" class="btn btn-success" onclick="window.exportNeracaExcel()">
        Export Excel
      </button>
    </div>
  </div>

  <div class="row g-3 mt-1">
    <div class="col-12 col-lg-6">
      <div class="panel lkbu-source-table h-100">
        <h5 class="mb-3">Aktiva</h5>
        <div class="table-responsive">
          <table class="table table-bordered table-sm">
            <thead><tr><th style="width:80px">Kode</th><th>Aktiva</th><th class="text-end">Nilai</th></tr></thead>
            <tbody>
              <tr><td>101</td><td>Kas dalam Rupiah</td><td id="lkbuB0002Aktiva101" class="text-end">0</td></tr>
              <tr><td>102</td><td>Bank dalam Rupiah</td><td id="lkbuB0002Aktiva102" class="text-end">0</td></tr>
              <tr><td>103</td><td>Kas dalam UKA</td><td id="lkbuB0002Aktiva103" class="text-end">0</td></tr>
              <tr><td>104</td><td>Bank dalam UKA</td><td id="lkbuB0002Aktiva104" class="text-end">0</td></tr>
              <tr><td>105</td><td>Piutang TC</td><td id="lkbuB0002Aktiva105" class="text-end">0</td></tr>
              <tr><td>106</td><td>Piutang Lain-Lain</td><td id="lkbuB0002Aktiva106" class="text-end">0</td></tr>
              <tr><td>107</td><td>Sewa dibayar Di Muka</td><td id="lkbuB0002Aktiva107" class="text-end">0</td></tr>
              <tr><td>108</td><td>Asuransi dibayar Di Muka</td><td id="lkbuB0002Aktiva108" class="text-end">0</td></tr>
              <tr><td>109</td><td>Aset Tetap-harga perolehan</td><td id="lkbuB0002Aktiva109" class="text-end">0</td></tr>
              <tr><td>110</td><td>Akumulasi Penyusutan Aset Tetap (-/-)</td><td id="lkbuB0002Aktiva110" class="text-end">0</td></tr>
              <tr><td>111</td><td>Aset Lain-lain</td><td id="lkbuB0002Aktiva111" class="text-end">0</td></tr>
              <tr class="fw-bold"><td></td><td>Jumlah Aset</td><td id="lkbuB0002AktivaTotal" class="text-end">0</td></tr>
              <tr class="fw-bold"><td></td><td>Neraca Seimbang (selisih)</td><td id="lkbuB0002Balance" class="text-end">0</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="col-12 col-lg-6">
      <div class="panel lkbu-source-table h-100">
        <h5 class="mb-3">Pasiva</h5>
        <div class="table-responsive">
          <table class="table table-bordered table-sm">
            <thead><tr><th style="width:80px">Kode</th><th>Pasiva</th><th class="text-end">Nilai</th></tr></thead>
            <tbody>
              <tr><td>201</td><td>Pinjaman dalam Rupiah</td><td id="lkbuB0002Pasiva201" class="text-end">0</td></tr>
              <tr><td>202</td><td>Pinjaman dalam UKA</td><td id="lkbuB0002Pasiva202" class="text-end">0</td></tr>
              <tr><td>203</td><td>Hutang Sewa</td><td id="lkbuB0002Pasiva203" class="text-end">0</td></tr>
              <tr><td>204</td><td>Kewajiban Pengiriman Uang</td><td id="lkbuB0002Pasiva204" class="text-end">0</td></tr>
              <tr><td>205</td><td>Kewajiban Lain-lain</td><td id="lkbuB0002Pasiva205" class="text-end">0</td></tr>
              <tr><td>206</td><td>Modal Disetor</td><td id="lkbuB0002Pasiva206" class="text-end">0</td></tr>
              <tr><td>207</td><td>Laba Ditahan</td><td id="lkbuB0002Pasiva207" class="text-end">0</td></tr>
              <tr><td>290</td><td>Akumulasi Rugi (-/-)</td><td id="lkbuB0002Pasiva290" class="text-end">0</td></tr>
              <tr class="fw-bold"><td></td><td>Jumlah Kewajiban dan Ekuitas</td><td id="lkbuB0002PasivaTotal" class="text-end">0</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="lkbu-panel-b0003" class="lkbu-panel">
        <div class="panel header-panel">
            <div class="flex-between"><div><h2>Keuangan Laba/Rugi <span class="lkbu-code">B0003</span></h2><p class="text-muted mt-2">Format akun mengikuti template BI 20250003. Nilai terisi otomatis dari jurnal pengeluaran/pendapatan dan transaksi.</p></div><div style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-primary" type="button" onclick="window.exportLabaRugiExcel()"><i class="fa-solid fa-file-excel"></i> Ekspor Excel</button><button class="btn btn-secondary" type="button" onclick="window.print()">Cetak</button></div></div>
            <div class="row mt-3">
                <div class="col-md-3"><label for="lkbuB0003Month">Bulan Laporan</label><select id="lkbuB0003Month" class="form-control"><option value="01">Januari</option><option value="02">Februari</option><option value="03">Maret</option><option value="04">April</option><option value="05">Mei</option><option value="06">Juni</option><option value="07">Juli</option><option value="08">Agustus</option><option value="09">September</option><option value="10">Oktober</option><option value="11">November</option><option value="12">Desember</option></select></div>
                <div class="col-md-3"><label for="lkbuB0003Year">Tahun Laporan</label><input type="number" id="lkbuB0003Year" class="form-control" min="2000" max="2100"></div>
                <div class="col-md-3 d-flex align-items-end"><button class="btn btn-success" type="button" onclick="window.kalkulasiLabaRugiB0003()"><i class="fa-solid fa-rotate"></i> Hitung Ulang</button></div>
            </div>
        </div>
        <div class="panel mt-4 lkbu-source-table"><div class="table-responsive"><table class="table table-bordered table-sm"><thead><tr><th style="width:80px">Kode</th><th>Akun</th><th class="text-end">Nilai</th></tr></thead><tbody><tr class=""><td>01</td><td>Penjualan UKA</td><td class="text-end">0</td></tr><tr class=""><td>02</td><td>Pencairan TC</td><td class="text-end">0</td></tr><tr class=""><td>03</td><td>Saldo Awal UKA dan TC</td><td class="text-end">0</td></tr><tr class=""><td>04</td><td>Pembelian UKA dan TC</td><td class="text-end">0</td></tr><tr class=""><td>05</td><td>Saldo Akhir UKA dan TC</td><td class="text-end">0</td></tr><tr class="lkbu-total"><td></td><td>Pendapatan/(Rugi) Operasional Kotor UKA-TC</td><td class="text-end">0</td></tr><tr class=""><td>06</td><td>Pendapatan Pengiriman Uang</td><td class="text-end">0</td></tr><tr class="lkbu-total"><td></td><td>Pendapatan/(Rugi) Operasional Kotor</td><td class="text-end">0</td></tr><tr class=""><td>07</td><td>Beban Gaji, Upah dan Tunjangan</td><td class="text-end">0</td></tr><tr class=""><td>08</td><td>Beban Sewa</td><td class="text-end">0</td></tr><tr class=""><td>09</td><td>Beban Iklan dan promosi</td><td class="text-end">0</td></tr><tr class=""><td>10</td><td>Beban Air, Listrik dan Telepon</td><td class="text-end">0</td></tr><tr class=""><td>11</td><td>Beban Transportasi dan perjalanan</td><td class="text-end">0</td></tr><tr class=""><td>12</td><td>Beban Pemeliharaan kendaraan</td><td class="text-end">0</td></tr><tr class=""><td>13</td><td>Penyusutan Aset Tetap</td><td class="text-end">0</td></tr><tr class=""><td>14</td><td>Beban Asuransi</td><td class="text-end">0</td></tr><tr class=""><td>15</td><td>Beban Lain-Lain (Operasional)</td><td class="text-end">0</td></tr><tr class="lkbu-total"><td></td><td>Pendapatan/(Rugi) Operasional Bersih</td><td class="text-end">0</td></tr><tr class=""><td>16</td><td>Pendapatan Bunga bank</td><td class="text-end">0</td></tr><tr class=""><td>17</td><td>Beban Administrasi Bank</td><td class="text-end">0</td></tr><tr class=""><td>18</td><td>Beban Bunga Pinjaman</td><td class="text-end">0</td></tr><tr class=""><td>19</td><td>Laba Penjualan Aset Tetap</td><td class="text-end">0</td></tr><tr class=""><td>20</td><td>Rugi Penjualan Aset Tetap</td><td class="text-end">0</td></tr><tr class=""><td>21</td><td>Laba Selisih Kurs</td><td class="text-end">0</td></tr><tr class=""><td>22</td><td>Rugi Selisih Kurs</td><td class="text-end">0</td></tr><tr class=""><td>23</td><td>Pendapatan Lain-Lain</td><td class="text-end">0</td></tr><tr class=""><td>24</td><td>Beban Lain-Lain (Non Operasional)</td><td class="text-end">0</td></tr><tr class="lkbu-total"><td></td><td>Laba/(Rugi) Sebelum Pajak Penghasilan</td><td class="text-end">0</td></tr><tr class=""><td>25</td><td>Pajak Penghasilan</td><td class="text-end">0</td></tr><tr class="lkbu-total"><td></td><td>Laba/(Rugi) Bersih</td><td class="text-end">0</td></tr></tbody></table></div></div>
    </div>

    <div id="lkbu-panel-b0004" class="lkbu-panel">
        <div class="panel header-panel">
            <h2>Perubahan Ekuitas <span class="lkbu-code">B0004</span></h2>
            <p class="text-muted mt-2">Format kolom mengikuti template sumber 20250004.xls.</p>
            <div class="d-flex flex-wrap align-items-end gap-2 mt-3">
                <div>
                    <label for="lkbuB0004Date" class="form-label">Tanggal Posisi</label>
                    <input type="date" id="lkbuB0004Date" class="form-control">
                </div>
                <button type="button" class="btn btn-primary" onclick="window.kalkulasiEkuitasB0004()">
                    Hitung B0004
                </button>
                <button type="button" class="btn btn-success" onclick="window.exportLkbuB0004Excel()">
                    Ekspor Excel
                </button>
            </div>
        </div>
        <div class="panel mt-4 lkbu-source-table">
            <div class="table-responsive">
                <table id="lkbuB0004Table" class="table table-bordered table-sm">
                    <thead>
                        <tr>
                            <th>Keterangan</th>
                            <th class="text-end">01-Saldo Positif</th>
                            <th class="text-end">02-Saldo Negatif</th>
                            <th class="text-end">03-Laba periode berjalan (net)</th>
                            <th class="text-end">04-Rugi periode berjalan (-/-)</th>
                            <th class="text-end">05-Pembagian Dividen(-/-)</th>
                            <th class="text-end">06-Menambah ekuitas (net)</th>
                            <th class="text-end">07-Mengurangi ekuitas (-/-)</th>
                            <th class="text-end">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr data-b0004-row="modal">
                            <td>Modal Disetor</td>
                            <td class="text-end" data-b0004-col="01">0</td>
                            <td class="text-end" data-b0004-col="02">0</td>
                            <td class="text-end" data-b0004-col="03">0</td>
                            <td class="text-end" data-b0004-col="04">0</td>
                            <td class="text-end" data-b0004-col="05">0</td>
                            <td class="text-end" data-b0004-col="06">0</td>
                            <td class="text-end" data-b0004-col="07">0</td>
                            <td class="text-end" data-b0004-col="jumlah">0</td>
                        </tr>
                        <tr data-b0004-row="laba">
                            <td>Laba Ditahan/Akumulasi Rugi</td>
                            <td class="text-end" data-b0004-col="01">0</td>
                            <td class="text-end" data-b0004-col="02">0</td>
                            <td class="text-end" data-b0004-col="03">0</td>
                            <td class="text-end" data-b0004-col="04">0</td>
                            <td class="text-end" data-b0004-col="05">0</td>
                            <td class="text-end" data-b0004-col="06">0</td>
                            <td class="text-end" data-b0004-col="07">0</td>
                            <td class="text-end" data-b0004-col="jumlah">0</td>
                        </tr>
                        <tr class="lkbu-total" data-b0004-row="total">
                            <td>Jumlah</td>
                            <td class="text-end" data-b0004-col="01">0</td>
                            <td class="text-end" data-b0004-col="02">0</td>
                            <td class="text-end" data-b0004-col="03">0</td>
                            <td class="text-end" data-b0004-col="04">0</td>
                            <td class="text-end" data-b0004-col="05">0</td>
                            <td class="text-end" data-b0004-col="06">0</td>
                            <td class="text-end" data-b0004-col="07">0</td>
                            <td class="text-end" data-b0004-col="jumlah">0</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <div id="lkbu-panel-b0005" class="lkbu-panel">
        <div class="panel header-panel">
            <h2>Kurs <span class="lkbu-code">B0005</span></h2>
            <p class="text-muted mt-2">Tab B0005 untuk data kurs yang digunakan dalam pelaporan LKBU.</p>
            <div class="lkbu-empty text-muted">Modul B0005 siap dikembangkan pada tahap berikutnya.</div>
        </div>
    </div>

    <div id="lkbu-panel-b0006" class="lkbu-panel">
        <div class="panel header-panel">
            <h2>Money Remittance <span class="lkbu-code">B0006</span></h2>
            <p class="text-muted mt-2">Tab B0006 untuk pelaporan kegiatan money remittance.</p>
            <div class="lkbu-empty text-muted">Modul B0006 siap dikembangkan pada tahap berikutnya.</div>
        </div>
    </div>

    <script>
    (function(){
        function activateLkbuTab(code){
            var root = document.getElementById('laporan-lku-view');
            if (!root) return;
            root.querySelectorAll('.lkbu-tab').forEach(function(btn){
                var active = btn.getAttribute('data-lkbu-tab') === code;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            root.querySelectorAll('.lkbu-panel').forEach(function(panel){
                panel.classList.toggle('active', panel.id === 'lkbu-panel-' + code);
            });
        }

        window.activateLkbuTab = activateLkbuTab;

        // Event delegation: tetap bekerja walaupun dashboard/section dirender ulang.
        document.addEventListener('click', function(e){
            var btn = e.target.closest ? e.target.closest('#laporan-lku-view .lkbu-tab') : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            activateLkbuTab(btn.getAttribute('data-lkbu-tab'));
        }, true);

        // Set state awal setelah DOM tersedia.
        function initLkbuTabs(){
            var root = document.getElementById('laporan-lku-view');
            if (!root) return;
            var active = root.querySelector('.lkbu-tab.active');
            activateLkbuTab(active ? active.getAttribute('data-lkbu-tab') : 'b0001');
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initLkbuTabs);
        } else {
            initLkbuTabs();
        }
    })();
    </script>
</section>
                <section id="laporan-posisi-valuta-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan Rekap Valuta</h2>
                            <p class="text-muted mt-2">Rekap saldo awal, pembelian, penjualan, dan sisa saldo per kode mata uang penuh. Kode seperti USD, USDK, dan USDST tampil masing-masing.</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button class="btn btn-primary" onclick="exportTableToExcel('posisiValutaTable', 'Laporan_Rekap_Valuta')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-3">
                                <label>Periode Laporan</label>
                                <input type="month" id="posisiValutaPeriod" class="form-control" onchange="applyPosisiValutaPeriodToDates(this.value); loadLaporanPosisiValuta();">
                            </div>
                            <div class="col-md-3">
                                <label>Dari Tanggal</label>
                                <input type="date" id="posisiValutaStartDate" class="form-control" onchange="syncPosisiValutaPeriodFromDates(); loadLaporanPosisiValuta();">
                            </div>
                            <div class="col-md-3">
                                <label>Sampai Tanggal</label>
                                <input type="date" id="posisiValutaEndDate" class="form-control" onchange="syncPosisiValutaPeriodFromDates(); loadLaporanPosisiValuta();">
                            </div>
                            <div class="col-md-2">
                                <label>Valuta</label>
                                <select id="posisiValutaFilter" class="form-control" onchange="loadLaporanPosisiValuta()">
                                    <option value="ALL">Semua Valuta</option>
                                </select>
                            </div>
                            <div class="col-md-1" style="display:flex; align-items:flex-end;">
                                <button class="btn btn-secondary w-100" onclick="loadLaporanPosisiValuta()"><i class="fa-solid fa-search"></i></button>
                            </div>
                        </div>

                        <div class="table-responsive mt-3">
                            <table class="table table-bordered table-striped" style="border: 1px solid #e2e8f0; font-size: 0.82rem;" id="posisiValutaTable">
                                <thead class="text-center">
                                    <tr>
                                        <th rowspan="2" class="align-middle">Valuta</th>
                                        <th rowspan="2" class="align-middle">Negara / Nama</th>
                                        <th colspan="3">Saldo Awal</th>
                                        <th colspan="3" style="color:#10b981;">Pembelian (+)</th>
                                        <th colspan="3" style="color:#ef4444;">Penjualan (-)</th>
                                        <th colspan="3" style="color:#60a5fa;">Sisa Saldo</th>
                                        <th colspan="3" style="color:#f59e0b;">Total Transaksi</th>
                                    </tr>
                                    <tr>
                                        <th>Qty</th>
                                        <th>Kurs Rata-rata</th>
                                        <th>Total Rp</th>
                                        <th style="color:#10b981;">Qty</th>
                                        <th style="color:#10b981;">Kurs Rata-rata</th>
                                        <th style="color:#10b981;">Total Rp</th>
                                        <th style="color:#ef4444;">Qty</th>
                                        <th style="color:#ef4444;">Kurs Rata-rata</th>
                                        <th style="color:#ef4444;">Total Rp</th>
                                        <th style="color:#60a5fa;">Qty</th>
                                        <th style="color:#60a5fa;">Kurs Rata-rata</th>
                                        <th style="color:#60a5fa;">Total Rp</th>
                                        <th style="color:#f59e0b;">Qty</th>
                                        <th style="color:#f59e0b;">Kurs Rata-rata</th>
                                        <th style="color:#f59e0b;">Total Rp</th>
                                    </tr>
                                </thead>
                                <tbody id="posisiValutaTableBody">
                                    <tr><td colspan="17" class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Menghitung rekap valuta...</td></tr>
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colspan="4" class="text-end">TOTAL RP</th>
                                        <th id="posisiValutaTotalAwal" class="text-end">Rp 0</th>
                                        <th colspan="2"></th>
                                        <th id="posisiValutaTotalBeli" class="text-end text-success">Rp 0</th>
                                        <th colspan="2"></th>
                                        <th id="posisiValutaTotalJual" class="text-end text-danger">Rp 0</th>
                                        <th colspan="2"></th>
                                        <th id="posisiValutaTotalSisa" class="text-end text-info">Rp 0</th>
                                        <th colspan="2"></th>
                                        <th id="posisiValutaTotalTransaksi" class="text-end" style="color:#f59e0b;">Rp 0</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </section>
                <section id="laporan-granular-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan Granular BI</h2>
                            <p class="text-muted mt-2">Data Transaksi Terperinci harian sesuai format Bank Indonesia.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportGranularExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel (Format BI)</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>
                    
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-5">
                                <label>Dari Tanggal</label>
                                <input type="date" id="granularStartDate" class="form-control">
                            </div>
                            <div class="col-md-5">
                                <label>Sampai Tanggal</label>
                                <input type="date" id="granularEndDate" class="form-control">
                            </div>
                            <div class="col-md-2" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-secondary w-100" id="btnFilterGranular" onclick="loadLaporanGranular()"><i class="fa-solid fa-search"></i> Filter</button>
                            </div>
                        </div>

                        <div class="table-responsive mt-3">
                            <table class="table table-bordered table-striped" style="border: 1px solid #e2e8f0; font-size: 0.85rem;" id="tableGranularBi">
                                <thead class="text-center" style="background:#1e293b; color:#fff;">
                                    <tr>
                                        <th>ID KC*)</th>
                                        <th>Tanggal Transaksi</th>
                                        <th>Jenis Identitas Nasabah<br><small>(NIK / NPWP / IZIN KUPVA BB)</small></th>
                                        <th>Nomor Identitas Nasabah<br><small>[NOMOR NIK / NPWP / IZIN KUPVA BB]</small></th>
                                        <th>Nama Lengkap</th>
                                        <th>Pekerjaan</th>
                                        <th>Jenis Kustomer</th>
                                        <th>Mata Uang</th>
                                        <th>Nominal Transaksi Valas</th>
                                        <th>Nilai Kurs Transaksi</th>
                                        <th>Jenis Transaksi</th>
                                        <th>Tujuan Transaksi</th>
                                        <th>Metode Penyelesaian Transaksi</th>
                                        <th>Delivery Channel</th>
                                    </tr>
                                </thead>
                                <tbody id="granularTableBody">
                                    <tr><td colspan="14" class="text-center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan data granular...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                <section id="pt-rep-view" class="view-section hidden">
                    <div id="ptRepRoot"></div>
                </section>
                <section id="laporan-sipesat-view" class="view-section hidden">
                    <div id="sipesatRoot"></div>
                </section>
                                <section id="almara-regulatory-ai-view" class="view-section hidden">
                    <div id="regAiRoot"></div>
                </section>
<section id="almara-regulatory-chat-view" class="view-section hidden">
    <div id="regChatRoot"></div>
</section>
                <section id="laporan-goaml-view" class="view-section hidden">
                    <div id="goamlRoot"></div>
                </section>
                <section id="laporan-sipendar-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Laporan SIPENDAR</h2>
                        <p class="text-muted mt-2">Sistem Informasi Pelaporan Ekspor Nilai Tunai & Uang Palsu.</p>
                    </div>
                </section>

                <section id="laporan-aset-view" class="view-section hidden">
                    <div id="assetRoot"></div>
                </section>

                <!-- BUKU BESAR VIEW -->
                <section id="laporan-bukubesar-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Buku Besar (General Ledger)</h2>
                            <p class="text-muted mt-2">Daftar mutasi per akun transaksi.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportTableToExcel('glTable', 'Buku_Besar')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>
                    
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-4">
                                <label>Pilih Akun</label>
                                <select id="ledgerAccount" class="form-control" onchange="loadBukuBesar()">
                                    <option value="ALL">Semua Akun (Jurnal Umum)</option>
                                    <option value="KAS">Kas Tunai</option>
                                    <option value="BANK">Bank</option>
                                    <option value="VALAS">Persediaan Valas</option>
                                    <option value="BIAYA">Beban / Biaya</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label>Bulan</label>
                                <select id="ledgerMonth" class="form-control" onchange="loadBukuBesar()"></select>
                            </div>
                            <div class="col-md-3">
                                <label>Tahun</label>
                                <select id="ledgerYear" class="form-control" onchange="loadBukuBesar()"></select>
                            </div>
                            <div class="col-md-2" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-primary w-100" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak</button>
                            </div>
                        </div>
                        
                        <div class="table-responsive mt-3">
                            <table class="table table-bordered table-striped" id="glTable">
                                <thead style="background:#1e293b; color:#fff;">
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Keterangan / Ref</th>
                                        <th class="text-end">Debit</th>
                                        <th class="text-end">Kredit</th>
                                        <th class="text-end">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody id="ledgerTableBody">
                                    <tr><td colspan="5" class="text-center text-muted">Memuat data...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                
                <!-- LABA RUGI VIEW -->
                <section id="laporan-labarugi-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan Laba / Rugi</h2>
                            <p class="text-muted mt-2">Kinerja keuangan berdasarkan operasional berjalan.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportLabaRugiExcel()"><i class="fa-solid fa-file-excel"></i> Export Laba Rugi (BI Format)</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>
                    
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-5">
                                <label>Bulan</label>
                                <select id="plMonth" class="form-control" onchange="loadLabaRugi()"></select>
                            </div>
                            <div class="col-md-5">
                                <label>Tahun</label>
                                <select id="plYear" class="form-control" onchange="loadLabaRugi()"></select>
                            </div>
                            <div class="col-md-2" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-primary w-100" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak</button>
                            </div>
                        </div>
                        
                        <div class="table-responsive mt-4">
                            <table class="table" style="width: 100%; border: 1px solid #e2e8f0;" id="plTable">
                                <thead style="background:#f8fafc; border-bottom: 2px solid #cbd5e1;">
                                    <tr>
                                        <th>Deskripsi</th>
                                        <th class="text-end">Nilai (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="background: rgba(16, 185, 129, 0.05);"><td colspan="2"><strong class="text-green">PENDAPATAN OPERASIONAL</strong></td></tr>
                                    <tr>
                                        <td style="padding-left: 30px;">Pendapatan Margin Valas</td>
                                        <td class="text-end" id="plMargin">0</td>
                                    </tr>
                                    <tr style="border-top: 1px solid #e2e8f0;">
                                        <td><strong>Total Pendapatan</strong></td>
                                        <td class="text-end font-weight-bold text-green" id="plTotalPendapatan">0</td>
                                    </tr>
                                    
                                    <tr style="background: rgba(239, 68, 68, 0.05); margin-top:10px;"><td colspan="2"><strong class="text-red">BEBAN OPERASIONAL</strong></td></tr>
                                    <tr>
                                        <td style="padding-left: 30px;">Total Pengeluaran Kas/Bank</td>
                                        <td class="text-end" id="plExpenses">0</td>
                                    </tr>
                                    <tr>
                                        <td style="padding-left: 30px;">Beban Penyusutan Aset Tetap</td>
                                        <td class="text-end text-red" id="plDepreciation">0</td>
                                    </tr>
                                    <tr style="border-top: 1px solid #e2e8f0;">
                                        <td><strong>Total Beban Operasional</strong></td>
                                        <td class="text-end font-weight-bold text-red" id="plTotalBeban">0</td>
                                    </tr>
                                    
                                    <tr style="background: #1e293b; color: #fff; font-size: 1.1rem;">
                                        <td><strong>LABA BERSIH OPERASIONAL</strong></td>
                                        <td class="text-end font-weight-bold" id="plNetIncome">0</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                
                <!-- NERACA & EKUITAS VIEW -->
                <section id="laporan-neraca-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Neraca & Laporan Ekuitas</h2>
                            <p class="text-muted mt-2">Posisi kekayaan dan permodalan perusahaan berdasarkan persamaan dasar akuntansi.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportNeracaExcel()"><i class="fa-solid fa-file-excel"></i> Export Neraca (BI Format)</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>
                    
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-10">
                                <label>Posisi per Tanggal</label>
                                <input type="date" id="bsDate" class="form-control" onchange="loadNeraca()">
                            </div>
                        </div>
                        
                        <div class="row mt-4" id="neracaContainer">
                            <div class="col-md-6">
                                <h4 class="mb-3 font-weight-bold" style="border-bottom: 2px solid #cbd5e1; padding-bottom: 10px;">AKTIVA</h4>
                                <table class="table table-borderless table-sm" id="neracaTableL">
                                </table>
                            </div>
                            
                            <div class="col-md-6">
                                <h4 class="mb-3 font-weight-bold" style="border-bottom: 2px solid #cbd5e1; padding-bottom: 10px;">PASIVA</h4>
                                <table class="table table-borderless table-sm" id="neracaTableR">
                                </table>
                            </div>
                            
                            <!-- Hidden elements needed for Ekuitas calculation compatibility -->
                            <div style="display:none;">
                                <span id="bsRetainedEarnings">0</span>
                                <span id="bsCurrentYearEarnings">0</span>
                                <span id="bsPrive">0</span>
                            </div>
                        </div>
                    </div>
                </section>


            </div> <!-- END CONTENT WRAPPER -->
        </main>
    </div>


    <!-- Blast WA Modal -->
    <div id="blastWaModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalBlastWaTitle">Broadcast WhatsApp</h2>
                <span class="close-modal" onclick="closeBlastWaModal()">&times;</span>
            </div>
            
            <div id="blastWaSetupView">
                <div class="form-group mb-3">
                    <label>Penerima (Hanya nasabah dengan nomor valid yang dihitung):</label>
                    <div style="padding: 10px; background: #1E293B; border-radius: 5px; color: #10B981; font-weight: bold;">
                        <span id="blastWaCount">0</span> Nasabah Terpilih
                    </div>
                </div>
                <div class="form-group mb-3">
                    <label>Pilih Template:</label>
                    <select id="blastWaTemplateSelect" class="form-control" onchange="applyBlastWaTemplate()">
                        <option value="">Tulis Manual</option>
                    </select>
                </div>
                <div class="form-group mb-3">
                    <label>Isi Pesan:</label>
                    <textarea id="blastWaTemplate" class="form-control" rows="6" placeholder="Ketik pesan Anda di sini...&#10;Contoh: Halo [NAMA], kami informasikan bahwa..."></textarea>
                    <small style="color: #94A3B8; display: block; margin-top: 5px;">Gunakan <b>[NAMA]</b> atau <b>[NAMA_NASABAH]</b> untuk menyisipkan nama nasabah secara otomatis.</small>
                </div>
                <button class="btn btn-success mt-4 btn-block" onclick="startBlastWa()"><i class="fa-solid fa-paper-plane"></i> Mulai Proses Broadcast</button>
            </div>

            <div id="blastWaQueueView" class="hidden">
                <div style="margin-bottom: 15px; color: #F59E0B; font-weight: bold; font-size: 0.9em; background: rgba(245, 158, 11, 0.1); padding: 10px; border-radius: 5px;">
                    <i>Kebijakan browser tidak mengizinkan puluhan tab WA terbuka sekaligus secara otomatis. Silakan klik tombol "Kirim WA" di bawah ini secara satu per satu.</i>
                </div>
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nasabah</th>
                                <th>No HP</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="blastWaQueueBody">
                            <!-- Injected -->
                        </tbody>
                    </table>
                </div>
                <button class="btn btn-secondary mt-4 btn-block" onclick="closeBlastWaModal()">Selesai / Tutup</button>
            </div>
        </div>
    </div>

    <style>
        #customerModal .modal-content {
            background:
                radial-gradient(circle at 18% 22%, rgba(37, 99, 235, 0.12), transparent 28%),
                linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(17, 24, 39, 0.96));
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 14px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.52);
            padding: 28px 30px 0;
            overflow: hidden !important;
        }
        #customerModal .modal-header {
            border-bottom: none;
            margin-bottom: 24px !important;
            align-items: flex-start;
        }
        #customerModal .customer-modal-title {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        #customerModal .customer-modal-icon {
            width: 58px;
            height: 58px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 1.55rem;
            background: linear-gradient(135deg, #4f7cff, #1d4ed8);
            box-shadow: 0 12px 32px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255,255,255,0.24);
        }
        #customerModal #modalCustTitle {
            margin: 0;
            color: #f8fafc;
            font-size: 1.7rem;
            line-height: 1.1;
        }
        #customerModal .customer-modal-subtitle {
            margin: 6px 0 0;
            color: #a9b4c7;
            font-size: 0.96rem;
        }
        #customerModal .close-modal {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(15, 23, 42, 0.72);
            border: 1px solid rgba(148, 163, 184, 0.18);
            color: #cbd5e1;
            font-size: 2rem;
            line-height: 1;
        }
        #customerModal .customer-create-grid {
            display: grid;
            grid-template-columns: minmax(360px, 0.72fr) minmax(520px, 1.28fr);
            gap: 26px;
            max-height: calc(90vh - 160px);
            overflow-y: auto;
            padding-bottom: 26px;
        }
        #customerModal .customer-panel {
            background: rgba(15, 23, 42, 0.48);
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 12px;
            padding: 22px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        #customerModal .customer-photo-drop {
            min-height: 420px;
            border: 1.5px dashed rgba(59, 130, 246, 0.9);
            border-radius: 14px;
            background: rgba(2, 6, 23, 0.24);
            padding: 18px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 20px;
            position: relative;
            overflow: hidden;
        }
        #customerModal .customer-photo-placeholder {
            color: #e2e8f0;
            text-align: center;
            font-size: 1.15rem;
            font-weight: 800;
        }
        #customerModal .customer-photo-placeholder i {
            display: block;
            color: #94a3b8;
            font-size: 4rem;
            margin-bottom: 18px;
        }
        #customerModal .customer-photo-placeholder small {
            display: block;
            max-width: 320px;
            margin-top: 14px;
            color: #a9b4c7;
            font-size: 0.92rem;
            font-weight: 500;
            line-height: 1.5;
        }
        #customerModal .customer-photo-actions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: auto;
        }
        #customerModal .customer-photo-actions .btn {
            min-height: 68px;
            border-radius: 10px;
            font-weight: 800;
            font-size: 0.95rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        #customerModal .customer-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 22px;
        }
        #customerModal .form-group {
            margin-bottom: 0;
        }
        #customerModal .field-full {
            grid-column: 1 / -1;
        }
        #customerModal label {
            color: #cbd5e1;
            font-weight: 600;
            margin-bottom: 8px;
        }
        #customerModal .required-mark {
            color: #ef4444;
        }
        #customerModal .form-control,
        #customerModal .select2-container--default .select2-selection--single {
            min-height: 54px;
            border-radius: 10px !important;
            background: rgba(2, 6, 23, 0.38) !important;
            border: 1px solid rgba(148, 163, 184, 0.28) !important;
            color: #e5e7eb !important;
            box-shadow: none !important;
        }
        #customerModal textarea.form-control {
            min-height: 84px;
            resize: vertical;
        }
        #customerModal .form-control::placeholder {
            color: rgba(148, 163, 184, 0.72);
        }
        #customerModal .entity-toggle-group {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }
        #customerModal .entity-toggle-btn {
            min-height: 112px;
            border-radius: 10px;
            background: rgba(30, 41, 59, 0.62);
            border: 1px solid rgba(148, 163, 184, 0.18);
            color: #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            position: relative;
            cursor: pointer;
        }
        #customerModal .entity-toggle-btn input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }
        #customerModal .entity-toggle-btn span {
            display: grid;
            gap: 8px;
            font-weight: 800;
        }
        #customerModal .entity-toggle-btn i {
            font-size: 1.35rem;
            margin: 0 !important;
            color: #cbd5e1;
        }
        #customerModal .entity-toggle-btn:has(input:checked) {
            border-color: #3b82f6;
            background: linear-gradient(135deg, rgba(37, 99, 235, 0.46), rgba(30, 41, 59, 0.64));
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.28);
            color: #f8fafc;
        }
        #customerModal .entity-toggle-btn:has(input:checked)::after {
            content: "\2713";
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #3b82f6;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
        }
        #customerModal .customer-system-section {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            padding: 14px;
            border-radius: 10px;
            border: 1px dashed rgba(59, 130, 246, 0.36);
            background: rgba(59, 130, 246, 0.06);
        }
        #customerModal .customer-modal-footer {
            margin: 0 -30px;
            padding: 14px 30px;
            border-top: 1px solid rgba(148, 163, 184, 0.16);
            display: flex;
            justify-content: flex-end;
            gap: 14px;
            background: rgba(15, 23, 42, 0.72);
        }
        #customerModal .customer-modal-footer .btn {
            min-width: 190px;
            height: 48px;
            border-radius: 10px;
            font-weight: 800;
        }
        #customerModal .customer-info-note {
            margin-top: 20px;
            color: #cbd5e1;
            border: 1px solid rgba(59, 130, 246, 0.26);
            background: rgba(37, 99, 235, 0.08);
            border-radius: 10px;
            padding: 12px 14px;
            font-size: 0.82rem;
            line-height: 1.45;
        }
        /* ============================================================
           CUSTOMER MODAL ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â GLOBAL THEME BRIDGE
           Theme & Appearance is the single source of truth.
           ============================================================ */
        html[data-mc-theme] body.apv-theme #customerModal .modal-content {
            background: var(--mc-card-bg) !important;
            color: var(--mc-text) !important;
            border-color: var(--mc-border) !important;
            box-shadow: var(--mc-shadow) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .modal-header,
        html[data-mc-theme] body.apv-theme #customerModal .customer-modal-title,
        html[data-mc-theme] body.apv-theme #customerModal .customer-modal-subtitle,
        html[data-mc-theme] body.apv-theme #customerModal .customer-panel,
        html[data-mc-theme] body.apv-theme #customerModal label {
            color: var(--mc-text) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-modal-subtitle,
        html[data-mc-theme] body.apv-theme #customerModal .customer-photo-placeholder small,
        html[data-mc-theme] body.apv-theme #customerModal label {
            color: var(--mc-text-muted) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .close-modal {
            background: var(--mc-input-bg) !important;
            color: var(--mc-text-muted) !important;
            border-color: var(--mc-border) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-panel {
            background: color-mix(in srgb, var(--mc-card-bg) 92%, var(--mc-page-bg)) !important;
            border-color: var(--mc-border) !important;
            box-shadow: none !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-photo-drop {
            background: var(--mc-input-bg) !important;
            border-color: color-mix(in srgb, var(--mc-primary) 55%, var(--mc-border)) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-photo-placeholder {
            color: var(--mc-text) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-photo-placeholder i {
            color: var(--mc-text-muted) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .form-control,
        html[data-mc-theme] body.apv-theme #customerModal .select2-container--default .select2-selection--single {
            background: var(--mc-input-bg) !important;
            color: var(--mc-text) !important;
            border-color: var(--mc-input-border) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .form-control::placeholder {
            color: var(--mc-text-muted) !important;
            opacity: .75 !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .entity-toggle-btn {
            background: var(--mc-input-bg) !important;
            color: var(--mc-text-muted) !important;
            border-color: var(--mc-border) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .entity-toggle-btn i {
            color: var(--mc-text-muted) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .entity-toggle-btn:has(input:checked) {
            background: color-mix(in srgb, var(--mc-primary) 18%, var(--mc-card-bg)) !important;
            border-color: var(--mc-primary) !important;
            color: var(--mc-text) !important;
            box-shadow: 0 0 0 1px color-mix(in srgb, var(--mc-primary) 30%, transparent) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .entity-toggle-btn:has(input:checked)::after {
            background: var(--mc-primary) !important;
            color: var(--mc-button-text) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-system-section {
            background: color-mix(in srgb, var(--mc-primary) 7%, var(--mc-card-bg)) !important;
            border-color: color-mix(in srgb, var(--mc-primary) 38%, var(--mc-border)) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-info-note {
            color: var(--mc-text-muted) !important;
            background: color-mix(in srgb, var(--mc-primary) 8%, var(--mc-card-bg)) !important;
            border-color: color-mix(in srgb, var(--mc-primary) 28%, var(--mc-border)) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-info-note i {
            color: var(--mc-primary) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-modal-footer {
            background: var(--mc-card-bg) !important;
            border-color: var(--mc-border) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-modal-icon {
            background: var(--mc-button-bg) !important;
            color: var(--mc-button-text) !important;
            box-shadow: var(--mc-shadow) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-photo-actions .btn-primary,
        html[data-mc-theme] body.apv-theme #customerModal .customer-modal-footer .btn-primary {
            background: var(--mc-button-bg) !important;
            border-color: var(--mc-button-bg) !important;
            color: var(--mc-button-text) !important;
        }
        html[data-mc-theme] body.apv-theme #customerModal .customer-photo-actions .btn-secondary,
        html[data-mc-theme] body.apv-theme #customerModal .customer-modal-footer .btn-secondary {
            background: var(--mc-input-bg) !important;
            border-color: var(--mc-border) !important;
            color: var(--mc-text) !important;
        }

        .pos-customer-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
            gap: 14px;
            align-items: start;
        }
        .pos-customer-main,
        .pos-customer-history-panel {
            min-width: 0;
        }
        .pos-customer-history-box {
            padding: 12px;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.16);
            background: rgba(15, 23, 42, 0.42);
        }
        .pos-customer-history-box #customerPosHistoryList {
            max-height: 290px;
            overflow: auto;
            padding-right: 4px;
        }
        .pos-customer-profile-card {
            display: grid;
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 12px;
            align-items: start;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.42);
        }
        .pos-customer-avatar {
            width: 64px;
            height: 64px;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(59, 130, 246, 0.32);
            background: rgba(30, 41, 59, 0.92);
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 64px;
        }
        .pos-customer-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .pos-customer-avatar i {
            color: #93c5fd;
            font-size: 1.45rem;
        }
        .pos-customer-info-grid {
            display: grid;
            grid-template-columns: 110px minmax(0, 1fr);
            gap: 4px 10px;
            align-items: start;
            min-width: 0;
        }
        .pos-customer-info-label {
            color: #94a3b8;
            font-size: 0.76rem;
            font-weight: 700;
            line-height: 1.25;
        }
        .pos-customer-info-value {
            color: #e2e8f0;
            font-size: 0.8rem;
            line-height: 1.35;
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            min-width: 0;
        }
        .pos-customer-history-entry {
            padding: 7px 8px;
            border-radius: 6px;
            border: 1px solid rgba(148, 163, 184, 0.10);
            border-left: 3px solid rgba(59, 130, 246, 0.65);
            background: rgba(2, 6, 23, 0.28);
        }
        .pos-customer-history-entry .pos-history-topline {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: baseline;
            margin-bottom: 3px;
        }
        .pos-customer-history-entry .pos-history-date {
            color: #cbd5e1;
            font-size: 0.74rem;
            font-weight: 800;
        }
        .pos-customer-history-entry .pos-history-total {
            font-size: 0.78rem;
            font-weight: 800;
            text-align: right;
            white-space: nowrap;
        }
        .pos-customer-history-entry .pos-history-items {
            display: grid;
            gap: 2px;
        }
        .pos-customer-history-entry .pos-history-item {
            font-size: 0.68rem;
            line-height: 1.25;
            color: #dbeafe;
            overflow-wrap: anywhere;
        }
        #pos-view.pos-draft-completed .pos-card-modern,
        #pos-view.pos-draft-completed .pos-flow-card {
            opacity: 0.88;
            filter: grayscale(0.12);
        }
        #pos-view.pos-draft-completed .pos-print-actions {
            opacity: 1;
            filter: none;
        }
        #posDraftSessionList .btn.btn-secondary {
            background: rgba(100, 116, 139, 0.35);
            border-color: rgba(148, 163, 184, 0.28);
            color: #e2e8f0;
        }
        #posDraftSessionList .btn.btn-secondary:hover {
            background: rgba(100, 116, 139, 0.48);
            color: #fff;
        }
        #customerModal #modalCustPhoto {
            display: none;
        }
        @media (max-width: 980px) {
            .pos-customer-layout {
                grid-template-columns: 1fr;
            }
            .pos-customer-profile-card {
                grid-template-columns: 56px minmax(0, 1fr);
            }
            .pos-customer-avatar {
                width: 56px;
                height: 56px;
                flex-basis: 56px;
            }
            .pos-customer-info-grid {
                grid-template-columns: 96px minmax(0, 1fr);
            }
            .pos-customer-history-box #customerPosHistoryList {
                max-height: 220px;
            }
            #customerModal .customer-create-grid,
            #customerModal .customer-form-grid,
            #customerModal .customer-system-section {
                grid-template-columns: 1fr;
            }
            #customerModal .modal-content {
                padding: 20px 18px 0;
            }
            #customerModal .customer-modal-footer {
                margin: 0 -18px;
                padding: 14px 18px;
            }
        }
    </style>

    <!-- Customer Modal -->
    <div id="customerModal" class="modal">
        <div class="modal-content panel" style="width: 96%; max-width: 1380px; max-height: 92vh;">
            <div class="modal-header flex-between">
                <div class="customer-modal-title">
                    <div class="customer-modal-icon"><i class="fa-solid fa-user-plus"></i></div>
                    <div>
                        <h2 id="modalCustTitle">Tambah Nasabah Baru</h2>
                        <p class="customer-modal-subtitle">Lengkapi data identitas nasabah</p>
                    </div>
                </div>
                <span class="close-modal" onclick="closeCustomerModal()">&times;</span>
            </div>
            <input type="hidden" id="modalCustId">
            <input type="hidden" id="modalCustRegDate">
            
            <div class="customer-create-grid">
                <!-- Left Side: Photo Upload & Preview -->
                <div class="customer-panel">
                    <div class="form-group">
                        <label style="margin-bottom: 18px; display: block;">Foto Identitas (KTP/Passport)</label>
                        <input type="file" id="modalCustPhoto" class="form-control" accept="image/*" onchange="handleCustomerPhoto(this)">
                        <!-- Preview Canvas hidden -->
                        <canvas id="photoCanvas" style="display:none;"></canvas>
                        
                        <div class="customer-photo-drop" title="Klik area ini untuk memilih foto identitas" onclick="if(!event.target.closest('button')) document.getElementById('modalCustPhoto')?.click();">
                            <img id="modalCustPhotoPreview" src="" alt="Preview Identitas" onclick="openGlobalImagePreview(this.src)" title="Klik untuk memperbesar" style="max-width: 100%; max-height: 330px; display: none; object-fit: contain; border-radius: 10px; cursor: zoom-in;">
                            <span id="modalCustPhotoPlaceholder" class="customer-photo-placeholder">
                                <i class="fa-regular fa-id-card"></i>
                                Belum ada foto
                                <small>Unggah gambar di sini atau ambil foto menggunakan kamera USB.</small>
                            </span>
                            <div class="customer-photo-actions">
                                <button type="button" id="btnOcrKtp" class="btn btn-primary" onclick="window.triggerKtpOcr()">
                                    <i class="fa-solid fa-cloud-arrow-up"></i> <span>Auto-Fill<br><small>(AI Cloud)</small></span>
                                </button>
                                <button type="button" class="btn btn-secondary" onclick="window.openCameraModal('modalCustPhotoPreview', 'modalCustPhotoPlaceholder')">
                                    <i class="fa-solid fa-camera"></i> <span>Kamera USB<br><small>Ambil Foto</small></span>
                                </button>
                            </div>
                        </div>
                        <div class="customer-info-note">
                            <i class="fa-solid fa-circle-info" style="color:#3b82f6; margin-right: 6px;"></i>
                            Fitur Auto-Fill akan membaca data dari KTP secara otomatis menggunakan AI Cloud. Pastikan foto jelas dan tidak buram.
                        </div>
                    </div>
                </div>

                <!-- Right Side: Form Inputs -->
                <div class="customer-panel">
                    <div class="customer-form-grid">
                    <!-- Row 1: Tipe KN & ID PJK -->
                    <div class="form-group">
                            <label style="margin-bottom: 12px; display: block;">Tipe Entitas / KN (tipe) <span class="required-mark">*</span></label>
                            <div class="entity-toggle-group">
                                <label class="entity-toggle-btn" title="Klik untuk mendaftarkan orang pribadi">
                                    <input type="radio" name="modalCustTypeGroup" value="1" onchange="if(typeof toggleEntitas==='function') toggleEntitas(); window.updateCustomerBusinessTypeUI();">
                                    <span><i class="fas fa-user" style="margin-right: 5px;"></i> Perorangan (1)</span>
                                </label>
                                <label class="entity-toggle-btn" title="Klik untuk mendaftarkan institusi/korporasi">
                                    <input type="radio" name="modalCustTypeGroup" value="2" onchange="toggleEntitas()">
                                    <span><i class="fas fa-building" style="margin-right: 5px;"></i> Perusahaan (2)</span>
                                </label>
                            </div>
                            <input type="hidden" id="modalCustType" value="">
                            <input type="hidden" id="modalCustIdPjk">
                    </div>

                    <!-- Jenis Badan Usaha: hanya tampil jika KN = Perusahaan -->
                    <div class="form-group field-full" id="modalCustBusinessTypeGroup" style="display: none;">
                            <label>Jenis Badan Usaha <span class="required-mark">*</span></label>
                            <select id="modalCustBusinessType" class="form-control" onchange="window.updateCustomerNameLabel()">
                                <option value="">Pilih Jenis Badan Usaha</option>
                                <option value="KUPVA">KUPVA</option>
                                <option value="BANK">BANK</option>
                                <option value="YAYASAN">YAYASAN</option>
                                <option value="BADAN USAHA PT">BADAN USAHA PT</option>
                                <option value="BADAN USAHA CV">BADAN USAHA CV</option>
                            </select>
                    </div>

                    <!-- Row 2: Nama & No Tlp -->
                    <div class="form-group">
                            <label id="modalCustNameLabel">Nama Lengkap <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustName" class="form-control" placeholder="Sesuai Identitas">
                    </div>
                    <div class="form-group">
                            <label>No. TLP <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustPhone" class="form-control" placeholder="08xx...">
                    </div>

                    <!-- Row 3: Tempat & Tgl Lahir -->
                    <div class="form-group">
                            <label id="modalCustBirthPlaceLabel">Tempat Lahir <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustBirthPlace" class="form-control" placeholder="Kota/Kab">
                    </div>
                    <div class="form-group">
                            <label id="modalCustBirthDateLabel">Tanggal Lahir <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustBirthDate" class="form-control" placeholder="Pilih Tanggal..">
                    </div>

                    <!-- Row 4: Alamat & Jenis ID -->
                    <div class="form-group">
                            <label>Alamat (Sesuai ID) <span class="required-mark">*</span></label>
                            <textarea id="modalCustAddress" class="form-control" rows="2" placeholder="Alamat lengkap sesuai identitas"></textarea>
                    </div>
                    
                    <div class="form-group">
                            <label>Jenis Identitas <span class="required-mark">*</span></label>
                            <select id="modalCustIdType" class="form-control" onchange="toggleCustPassportPlaceholder()">
                                <option value="KTP">KTP (Indonesia)</option>
                                <option value="PASSPORT">Passport (Asing)</option>
                                <option value="SIM">SIM / Lainnya</option>
                            </select>
                    </div>

                    <!-- Row 5: KTP & ID Lain -->
                    <div class="form-group" id="modalCustNikGroup">
                            <label>Nomor KTP (NIK) <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustNik" class="form-control" placeholder="Ketik NIK secara manual atau gunakan Auto-Fill" inputmode="numeric" autocomplete="off">
                    </div>
                    <div class="form-group" id="modalCustIdNoGroup" style="display:none;">
                            <label>Nomor ID (Lainnya) <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustIdNo" class="form-control" placeholder="Ketik nomor ID secara manual (opsional)" autocomplete="off">
                    </div>

                    <!-- Row 6: Gender, WN, Pekerjaan -->
                    <div class="form-group" id="modalCustGenderGroup">
                            <label>Jenis Kelamin</label>
                            <select id="modalCustGender" class="form-control">
                                <option value="Pria">Pria</option>
                                <option value="Wanita">Wanita</option>
                            </select>
                    </div>
                    <div class="form-group">
                            <label>Warga Negara</label>
                            <select id="modalCustCitizen" class="form-control select2-modal">
                                <!-- Populated by master -->
                            </select>
                    </div>
                    <div class="form-group field-full" id="modalCustJobGroup">
                            <label>Pekerjaan</label>
                            <select id="modalCustJob" class="form-control select2-modal">
                                <!-- Populated by master -->
                            </select>
                    </div>
                    <!-- Bidang Usaha: menggantikan Pekerjaan jika KN = Perusahaan -->
                    <div class="form-group field-full" id="modalCustBusinessFieldGroup" style="display: none;">
                            <label>Bidang Usaha <span class="required-mark">*</span></label>
                            <select id="modalCustBusinessField" class="form-control">
                                <option value="">Pilih Bidang Usaha</option>
                                <option value="KUPVA / MONEY CHANGER">KUPVA / Money Changer</option>
                                <option value="PERBANKAN">Perbankan</option>
                                <option value="JASA KEUANGAN">Jasa Keuangan</option>
                                <option value="ASURANSI">Asuransi</option>
                                <option value="KOPERASI">Koperasi</option>
                                <option value="PERDAGANGAN">Perdagangan</option>
                                <option value="PERDAGANGAN ECERAN">Perdagangan Eceran</option>
                                <option value="PERDAGANGAN BESAR">Perdagangan Besar</option>
                                <option value="JASA">Jasa</option>
                                <option value="JASA PROFESIONAL">Jasa Profesional</option>
                                <option value="TEKNOLOGI INFORMASI">Teknologi Informasi</option>
                                <option value="TELEKOMUNIKASI">Telekomunikasi</option>
                                <option value="MANUFAKTUR / INDUSTRI">Manufaktur / Industri</option>
                                <option value="KONSTRUKSI">Konstruksi</option>
                                <option value="PROPERTI / REAL ESTATE">Properti / Real Estate</option>
                                <option value="PERHOTELAN">Perhotelan</option>
                                <option value="RESTORAN / KULINER">Restoran / Kuliner</option>
                                <option value="TRANSPORTASI">Transportasi</option>
                                <option value="LOGISTIK / PERGUDANGAN">Logistik / Pergudangan</option>
                                <option value="PENDIDIKAN">Pendidikan</option>
                                <option value="KESEHATAN">Kesehatan</option>
                                <option value="FARMASI">Farmasi</option>
                                <option value="PERTANIAN">Pertanian</option>
                                <option value="PERKEBUNAN">Perkebunan</option>
                                <option value="PETERNAKAN">Peternakan</option>
                                <option value="PERIKANAN">Perikanan</option>
                                <option value="KEHUTANAN">Kehutanan</option>
                                <option value="PERTAMBANGAN">Pertambangan</option>
                                <option value="ENERGI / MIGAS">Energi / Migas</option>
                                <option value="UTILITAS">Utilitas</option>
                                <option value="YAYASAN / SOSIAL">Yayasan / Sosial</option>
                                <option value="ORGANISASI / NIRLABA">Organisasi / Nirlaba</option>
                                <option value="MEDIA / PENERBITAN">Media / Penerbitan</option>
                                <option value="PERIKLANAN / KREATIF">Periklanan / Kreatif</option>
                                <option value="TRAVEL / PARIWISATA">Travel / Pariwisata</option>
                                <option value="PENDUKUNG USAHA">Pendukung Usaha</option>
                                <option value="LAINNYA">Lainnya</option>
                            </select>
                    </div>

                    <!-- Row 7: Standardized IDs (Sistem & Reporting) -->
                    <div class="customer-system-section">
                        <div class="form-group">
                            <label style="color: #60A5FA; font-weight: bold;">ID Nasabah (Sistem)</label>
                            <input type="text" id="modalCustInternalId" class="form-control" readonly placeholder="Otomatis (ALM-xxxxx)">
                            <small class="text-muted">ID Internal untuk sinkronisasi database.</small>
                        </div>
                        <div class="form-group">
                            <label style="color: #60A5FA; font-weight: bold;">No. CIF (Reporting)</label>
                            <input type="text" id="modalCustCif" class="form-control" placeholder="Otomatis (AMR-0001 / P-0001)" readonly>
                            <small class="text-muted">Nomor unik nasabah untuk laporan mutasi.</small>
                        </div>
                    </div>

                    <!-- NIB: hanya tampil jika KN = Perusahaan -->
                    <div class="form-group field-full" id="modalCustNibGroup" style="display: none;">
                            <label>NIB <span style="font-weight: normal; opacity: .75;">(opsional)</span></label>
                            <input type="text" id="modalCustNib" class="form-control" placeholder="Nomor Induk Berusaha">
                    </div>

                    <!-- Row 8: NPWP, Local ID, Rekening -->
                    <div class="form-group">
                            <label>NPWP</label>
                            <input type="text" id="modalCustNpwp" class="form-control" placeholder="No NPWP">
                    </div>
                    <div class="form-group">
                            <label>Local ID (Ref External)</label>
                            <input type="text" id="modalCustLocalId" class="form-control" placeholder="Ref id bank/lainnya">
                    </div>
                    <div class="form-group field-full">
                            <label>Nomor Rekening / Virtual Account (Refund)</label>
                            <input type="text" id="modalCustBankAcc" class="form-control" placeholder="No Rekening / OVO / Dana..">
                    </div>
                    </div>
                </div>
            </div>
            <div class="customer-modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeCustomerModal()"><i class="fa-solid fa-xmark"></i> Batal</button>
                <button type="button" class="btn btn-primary" onclick="saveCustomer()"><i class="fa-solid fa-floppy-disk"></i> Simpan Nasabah</button>
            </div>
        </div>
    </div>
    <div id="customerUpdateModal" class="modal">
        <style>
            #customerUpdateModal .upd-shell{width:95%;max-width:1200px;max-height:92vh;overflow-y:auto;border-top:0;padding:0;border-radius:18px;overflow-x:hidden}
            #customerUpdateModal .upd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 24px;background:linear-gradient(135deg,rgba(245,158,11,.22),rgba(245,158,11,.04));border-bottom:1px solid rgba(245,158,11,.35)}
            #customerUpdateModal .upd-head .upd-title{display:flex;align-items:center;gap:14px;min-width:0}
            #customerUpdateModal .upd-avatar{width:46px;height:46px;border-radius:14px;background:#f59e0b;color:#1f1300;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex:0 0 auto}
            #customerUpdateModal .upd-head h2{margin:0;font-size:1.25rem;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            #customerUpdateModal .upd-badge{display:inline-block;margin-top:4px;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.4px;background:rgba(245,158,11,.18);color:#f59e0b;border:1px solid rgba(245,158,11,.4)}
            #customerUpdateModal .upd-body{display:flex;flex-wrap:wrap;gap:22px;padding:22px 24px 24px}
            #customerUpdateModal .upd-photo{flex:1 1 300px;min-width:280px}
            #customerUpdateModal .upd-main{flex:1.6 1 380px;min-width:0}
            #customerUpdateModal .upd-card{border:1px solid rgba(148,163,184,.28);background:rgba(148,163,184,.06);border-radius:14px;padding:16px 18px;margin-bottom:16px}
            #customerUpdateModal .upd-card-title{display:flex;align-items:center;gap:8px;margin:0 0 14px;font-size:.78rem;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#f59e0b}
            #customerUpdateModal .upd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
            #customerUpdateModal .upd-full{grid-column:1/-1}
            #customerUpdateModal .upd-grid label{display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;opacity:.85}
            #customerUpdateModal .upd-grid .form-control{width:100%}
            #customerUpdateModal .upd-types{display:grid;grid-template-columns:1fr 1fr;gap:10px}
            #customerUpdateModal .upd-types .radio-card{margin:0;cursor:pointer;border-radius:12px;border:2px solid rgba(148,163,184,.35);overflow:hidden}
            #customerUpdateModal .upd-types .radio-card:has(input:checked){border-color:#f59e0b;background:rgba(245,158,11,.14)}
            #customerUpdateModal .upd-system{border:1px dashed #f59e0b;background:rgba(245,158,11,.06)}
            #customerUpdateModal .upd-actions{position:sticky;bottom:0;display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;padding:14px 24px;background:inherit;border-top:1px solid rgba(148,163,184,.28)}
            @media(max-width:640px){#customerUpdateModal .upd-grid{grid-template-columns:1fr}#customerUpdateModal .upd-body{padding:16px}}
        </style>
        <div class="modal-content panel upd-shell">
            <div class="upd-head">
                <div class="upd-title">
                    <div class="upd-avatar"><i class="fa-solid fa-user-pen"></i></div>
                    <div style="min-width:0;">
                        <h2>Update Data Nasabah</h2>
                        <span class="upd-badge" id="update_entityBadge">PERORANGAN</span>
                    </div>
                </div>
                <span class="close-modal" onclick="const m = document.getElementById('customerUpdateModal'); m.style.display='none'; m.classList.remove('show');">&times;</span>
            </div>

            <div class="upd-body">
                <!-- Kolom kiri: foto identitas -->
                <div class="upd-photo">
                    <div class="form-group mb-3">
                        <label>Foto Identitas (KTP/Passport)</label>
                        <div class="d-flex gap-2 mb-2">
                             <input type="file" id="update_modalCustPhoto" class="form-control" accept="image/*" onchange="previewUpdateCustPhoto(this)" style="flex: 1;">
                             <button type="button" class="btn btn-secondary" onclick="window.openCameraModal('update_previewImg', 'update_photoPlaceholder')" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; white-space: nowrap;"><i class="fa-solid fa-camera"></i> Kamera USB</button>
                        </div>
                        <div id="update_photoContainer" class="photo-preview-box" style="width: 100%; height: 350px; background: #0f172a; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                            <img id="update_previewImg" src="" style="width: 100%; height: 100%; object-fit: contain; display: none;">
                            <div id="update_photoPlaceholder" style="text-align: center; color: #475569;">
                                <i class="fa-solid fa-camera-retro fa-3x mb-3"></i>
                                <p>Belum ada foto</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Kolom kanan: form -->
                <div class="upd-main">
                    <input type="hidden" id="update_modalCustId">

                    <div class="upd-card">
                        <div class="upd-card-title"><i class="fa-solid fa-id-badge"></i> Tipe Entitas</div>
                        <div class="upd-grid">
                            <div class="upd-full">
                                <div class="upd-types">
                                    <label class="radio-card text-center">
                                        <input type="radio" name="update_custType" value="1" id="update_typePerorangan" onchange="window.updateCustomerUpdateUI()">
                                        <div class="card-body p-2"><i class="fa-solid fa-user mb-1"></i><br><small>Perorangan (1)</small></div>
                                    </label>
                                    <label class="radio-card text-center">
                                        <input type="radio" name="update_custType" value="2" id="update_typePerusahaan" onchange="window.updateCustomerUpdateUI()">
                                        <div class="card-body p-2"><i class="fa-solid fa-building mb-1"></i><br><small>Perusahaan (2)</small></div>
                                    </label>
                                </div>
                            </div>
                            <div id="update_businessTypeGroup" style="display:none;">
                                <label>Jenis Badan Usaha</label>
                                <select id="update_modalCustBusinessType" class="form-control" onchange="window.updateCustomerUpdateUI()">
                                <option value="">Pilih Jenis Badan Usaha</option>
                                <option value="KUPVA">KUPVA</option>
                                <option value="BANK">BANK</option>
                                <option value="YAYASAN">YAYASAN</option>
                                <option value="BADAN USAHA PT">BADAN USAHA PT</option>
                                <option value="BADAN USAHA CV">BADAN USAHA CV</option>
                            
                                </select>
                            </div>
                            <div id="update_nibGroup" style="display:none;">
                                <label>NIB <span style="font-weight:normal;opacity:.7;">(opsional)</span></label>
                                <input type="text" id="update_modalCustNib" class="form-control" placeholder="Nomor Induk Berusaha">
                            </div>
                            <div>
                                <label>IDPJK</label>
                                <input type="text" id="update_modalCustIdpjk" class="form-control" placeholder="IDPJK Lengkap">
                            </div>
                        </div>
                    </div>

                    <div class="upd-card">
                        <div class="upd-card-title"><i class="fa-solid fa-address-card"></i> <span id="update_sectionDataTitle">Data Diri</span></div>
                        <div class="upd-grid">
                            <div>
                                <label id="update_nameLabel">Nama Lengkap</label>
                                <input type="text" id="update_modalCustName" class="form-control" placeholder="Sesuai Identitas">
                            </div>
                            <div>
                                <label>No. Telepon</label>
                                <input type="text" id="update_modalCustPhone" class="form-control" placeholder="08xx....">
                            </div>
                            <div>
                                <label id="update_birthPlaceLabel">Tempat Lahir</label>
                                <input type="text" id="update_modalCustBirthPlace" class="form-control" placeholder="Kota/Kab">
                            </div>
                            <div>
                                <label id="update_birthDateLabel">Tanggal Lahir</label>
                                <input type="text" id="update_modalCustBirthDate" class="form-control flatpickr" placeholder="Pilih Tanggal..">
                            </div>
                            <div class="upd-full">
                                <label>Alamat (Sesuai ID)</label>
                                <textarea id="update_modalCustAddress" class="form-control" rows="2" placeholder="Alamat lengkap..."></textarea>
                            </div>
                            <div id="update_genderGroup">
                                <label>Jenis Kelamin</label>
                                <select id="update_modalCustGender" class="form-control">
                                    <option value="Pria">Pria</option>
                                    <option value="Wanita">Wanita</option>
                                </select>
                            </div>
                            <div>
                                <label>Warga Negara</label>
                                <select id="update_modalCustCitizen" class="form-control select2-modal">
                                    <!-- Populated via JS -->
                                </select>
                            </div>
                            <div class="upd-full" id="update_jobGroup">
                                <label>Pekerjaan</label>
                                <select id="update_modalCustJob" class="form-control select2-modal">
                                    <!-- Populated via JS -->
                                </select>
                            </div>
                            <div class="upd-full" id="update_businessFieldGroup" style="display:none;">
                                <label>Bidang Usaha</label>
                                <select id="update_modalCustBusinessField" class="form-control">
                                <option value="">Pilih Bidang Usaha</option>
                                <option value="KUPVA / MONEY CHANGER">KUPVA / Money Changer</option>
                                <option value="PERBANKAN">Perbankan</option>
                                <option value="JASA KEUANGAN">Jasa Keuangan</option>
                                <option value="ASURANSI">Asuransi</option>
                                <option value="KOPERASI">Koperasi</option>
                                <option value="PERDAGANGAN">Perdagangan</option>
                                <option value="PERDAGANGAN ECERAN">Perdagangan Eceran</option>
                                <option value="PERDAGANGAN BESAR">Perdagangan Besar</option>
                                <option value="JASA">Jasa</option>
                                <option value="JASA PROFESIONAL">Jasa Profesional</option>
                                <option value="TEKNOLOGI INFORMASI">Teknologi Informasi</option>
                                <option value="TELEKOMUNIKASI">Telekomunikasi</option>
                                <option value="MANUFAKTUR / INDUSTRI">Manufaktur / Industri</option>
                                <option value="KONSTRUKSI">Konstruksi</option>
                                <option value="PROPERTI / REAL ESTATE">Properti / Real Estate</option>
                                <option value="PERHOTELAN">Perhotelan</option>
                                <option value="RESTORAN / KULINER">Restoran / Kuliner</option>
                                <option value="TRANSPORTASI">Transportasi</option>
                                <option value="LOGISTIK / PERGUDANGAN">Logistik / Pergudangan</option>
                                <option value="PENDIDIKAN">Pendidikan</option>
                                <option value="KESEHATAN">Kesehatan</option>
                                <option value="FARMASI">Farmasi</option>
                                <option value="PERTANIAN">Pertanian</option>
                                <option value="PERKEBUNAN">Perkebunan</option>
                                <option value="PETERNAKAN">Peternakan</option>
                                <option value="PERIKANAN">Perikanan</option>
                                <option value="KEHUTANAN">Kehutanan</option>
                                <option value="PERTAMBANGAN">Pertambangan</option>
                                <option value="ENERGI / MIGAS">Energi / Migas</option>
                                <option value="UTILITAS">Utilitas</option>
                                <option value="YAYASAN / SOSIAL">Yayasan / Sosial</option>
                                <option value="ORGANISASI / NIRLABA">Organisasi / Nirlaba</option>
                                <option value="MEDIA / PENERBITAN">Media / Penerbitan</option>
                                <option value="PERIKLANAN / KREATIF">Periklanan / Kreatif</option>
                                <option value="TRAVEL / PARIWISATA">Travel / Pariwisata</option>
                                <option value="PENDUKUNG USAHA">Pendukung Usaha</option>
                                <option value="LAINNYA">Lainnya</option>
                            
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="upd-card">
                        <div class="upd-card-title"><i class="fa-solid fa-passport"></i> Dokumen Identitas</div>
                        <div class="upd-grid">
                            <div class="upd-full">
                                <label>Jenis Identitas</label>
                                <select id="update_modalCustIdType" class="form-control">
                                    <option value="KTP">KTP (Indonesia)</option>
                                    <option value="PASSPORT">Passport (Asing)</option>
                                    <option value="SIM">SIM / Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label>Nomor KTP (NIK)</label>
                                <input type="text" id="update_modalCustNik" class="form-control" placeholder="16 Digit NIK">
                            </div>
                            <div>
                                <label>Nomor ID (Lainnya)</label>
                                <input type="text" id="update_modalCustIdNo" class="form-control" placeholder="No Passport/SIM">
                            </div>
                            <div>
                                <label>NPWP (Jika ada)</label>
                                <input type="text" id="update_modalCustNpwp" class="form-control" placeholder="No NPWP">
                            </div>
                            <div>
                                <label>Local ID (Ref External)</label>
                                <input type="text" id="update_modalCustLocalId" class="form-control" placeholder="Ref id bank/lainnya">
                            </div>
                            <div class="upd-full">
                                <label>Nomor Rekening / Virtual Account (Refund)</label>
                                <input type="text" id="update_modalCustBankAcc" class="form-control" placeholder="No Rekening / OVO / Dana..">
                            </div>
                        </div>
                    </div>

                    <div class="upd-card upd-system">
                        <div class="upd-card-title"><i class="fa-solid fa-lock"></i> Data Sistem</div>
                        <div class="upd-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">
                            <div>
                                <label>ID Nasabah (Sistem)</label>
                                <input type="text" id="update_modalCustInternalId" class="form-control" readonly style="background-color:#1e293b;color:#94a3b8;">
                            </div>
                            <div>
                                <label>No. CIF (Reporting)</label>
                                <input type="text" id="update_modalCustCif" class="form-control" style="background-color:#1e293b;color:#fff;">
                            </div>
                            <div>
                                <label>Tanggal Update</label>
                                <input type="text" id="update_modalCustUpdateDate" class="form-control" readonly style="background-color:#1e293b;color:#F59E0B;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="upd-actions">
                <small class="text-muted" style="margin-right:auto;">Pastikan data sudah diperiksa kembali sebelum melakukan Update.</small>
                <button type="button" class="btn btn-secondary" onclick="const m = document.getElementById('customerUpdateModal'); m.style.display='none'; m.classList.remove('show');"><i class="fa-solid fa-xmark"></i> Batal</button>
                <button type="button" class="btn btn-warning" style="background:#f59e0b;border:none;color:#000;font-weight:bold;padding:10px 22px;" onclick="updateCustomer()"><i class="fa-solid fa-floppy-disk"></i> UPDATE DATA NASABAH</button>
            </div>
        </div>
    </div>

    <!-- Expense Modal -->
    <!-- Bank Mutation Modal -->
    <div id="mutationModal" class="modal">
        <div class="modal-content panel" style="width: 90%; max-width: 500px; border-top: 5px solid #10b981;">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalMutTitle">Tambah Mutasi Bank</h2>
                <span class="close-modal" onclick="closeMutationModal()">&times;</span>
            </div>
            <input type="hidden" id="modalMutId">
            <div class="form-group">
                <label>Tanggal Mutasi</label>
                <input type="date" id="modalMutDate" class="form-control">
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Bank</label>
                    <select id="modalMutBank" class="form-control">
                        <option value="BCA">Bank BCA</option>
                        <option value="MANDIRI">Bank Mandiri</option>
                    </select>
                </div>
                <div class="col">
                    <label>Tipe Mutasi</label>
                    <select id="modalMutType" class="form-control">
                        <option value="MASUK">Uang Masuk (Debit)</option>
                        <option value="KELUAR">Uang Keluar (Kredit)</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Nominal (Rp)</label>
                <input type="number" id="modalMutAmount" class="form-control" placeholder="0">
            </div>
            <div class="form-group">
                <label>Keterangan</label>
                <textarea id="modalMutDesc" class="form-control" rows="3" placeholder="Contoh: Setoran modal awal, Transfer masuk..."></textarea>
            </div>
            <button class="btn btn-success mt-4 btn-block" onclick="saveMutation()">
                <i class="fa-solid fa-save"></i> Simpan Mutasi
            </button>
        </div>
    </div>

    <!-- Jurnal Ekuitas & Kewajiban Modal -->
    <div id="adjustmentModal" class="modal">
        <div class="modal-content panel">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalAdjTitle">Catat Ekuitas / Kewajiban (Pasiva)</h2>
                <span class="close-modal" onclick="closeAdjustmentModal()">&times;</span>
            </div>
            <input type="hidden" id="modalAdjId">
            <div class="form-group row">
                <div class="col">
                    <label>Kategori Akun (Pasiva BI)</label>
                    <select id="modalAdjCategory" class="form-control">
                        <option value="206-Modal Disetor">206-Modal Disetor</option>
                        <option value="05-Pembagian Dividen(-/-)">05-Pembagian Dividen</option>
                        <option value="201-Pinjaman dalam Rupiah">201-Pinjaman dalam Rupiah</option>
                        <option value="202-Pinjaman dalam UKA">202-Pinjaman dalam UKA</option>
                        <option value="203-Hutang Sewa">203-Hutang Sewa</option>
                        <option value="204-Kewajiban Pengiriman Uang">204-Kewajiban Pengiriman Uang</option>
                        <option value="205-Kewajiban Lain-lain">205-Kewajiban Lain-lain</option>
                        <option value="104-Bank dalam UKA">104-Bank dalam UKA</option>
                        <option value="105-Piutang TC">105-Piutang TC</option>
                        <option value="106-Piutang Lain-Lain">106-Piutang Lain-Lain</option>
                        <option value="107-Sewa dibayar Di Muka">107-Sewa dibayar Di Muka</option>
                        <option value="108-Asuransi dibayar Di Muka">108-Asuransi dibayar Di Muka</option>
                        <option value="111-Aset Lain-lain">111-Aset Lain-lain</option>
                    </select>
                </div>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Tipe Pergerakan Saldo Akun</label>
                    <select id="modalAdjType" class="form-control">
                        <option value="PENAMBAHAN">Penambahan Saldo (+)</option>
                        <option value="PENGURANGAN">Pengurangan Saldo (-)</option>
                    </select>
                </div>
                <div class="col">
                    <label>Dampak terhadap Kas / Bank</label>
                    <select id="modalAdjImpact" class="form-control">
                        <option value="MASUK_CASH">Uang Masuk ke Kas Tunai</option>
                        <option value="KELUAR_CASH">Uang Keluar dari Kas Tunai</option>
                        <option value="MASUK_BCA">Uang Masuk ke Bank BCA</option>
                        <option value="KELUAR_BCA">Uang Keluar dari Bank BCA</option>
                        <option value="MASUK_MANDIRI">Uang Masuk ke Bank Mandiri</option>
                        <option value="KELUAR_MANDIRI">Uang Keluar dari Bank Mandiri</option>
                        <option value="TIDAK_ADA">Tidak Berdampak (Hanya Catatan Penyesuaian)</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Catatan / Keterangan</label>
                <input type="text" id="modalAdjDesc" class="form-control" placeholder="Contoh: Tambahan Modal atau Tarik Dividen Kas..">
            </div>
            <div class="form-group">
                <label>Nominal (Rp)</label>
                <input type="number" id="modalAdjAmount" class="form-control" placeholder="0">
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="saveAdjustment()">Simpan Jurnal Ekuitas/Kewajiban</button>
        </div>
    </div>







    <!-- Global Image Lightbox -->
    <div id="globalImageLightbox" class="modal" onclick="this.classList.remove('show')" style="z-index: 9999; cursor: zoom-out; align-items: center; justify-content: center; background-color: rgba(0,0,0,0.85); padding: 1vmin;">
        <img id="globalLightboxImg" src="" style="width: 95vw; height: 95vh; object-fit: contain;">
    </div>

    <!-- Edit Transaction Modal Form (Hidden) -->
    <div id="editTransactionModal" class="modal" style="display: none;">
        <div class="modal-content panel" style="max-width: 800px; max-height: 90vh; overflow-y: auto; width: 100%;">
            <div class="flex-between mb-3">
                <h3 style="color: #38bdf8; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-pen-to-square"></i> Edit Transaksi <span id="editTrxInvoiceId" style="color: #60a5fa; font-weight: bold;"></span></h3>
                <span class="close-modal" onclick="closeEditTrxModal()"><i class="fa-solid fa-xmark"></i></span>
            </div>
            <hr class="divider mb-3">
            
            <form id="editTrxForm" onsubmit="event.preventDefault(); saveEditedTransaction();">
                <div class="row mb-3" style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Tanggal Transaksi</label>
                        <input type="datetime-local" id="editTrxTimestamp" class="form-control" required>
                    </div>
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Pilih Nasabah <span style="color: #f87171;">*</span></label>
                        <select id="editTrxCustomer" class="form-control" style="width: 100%;">
                            <!-- Loaded dynamically -->
                        </select>
                    </div>
                </div>
                
                <div class="row mb-3" style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Metode Pembayaran</label>
                        <select id="editTrxPaymentMethod" class="form-control" onchange="toggleEditTrxPaymentMethodFields()" style="background-image: none;">
                            <option value="CASH">CASH / TUNAI</option>
                            <option value="TRANSFER">TRANSFER BANK</option>
                            <option value="SPLIT">SPLIT (CASH & TRANSFER)</option>
                        </select>
                    </div>
                    <div class="col" id="editTrxBankGroup" style="flex: 1; min-width: 250px; display: none;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Bank Tujuan</label>
                        <select id="editTrxBank" class="form-control" style="background-image: none;">
                            <option value="BCA">BANK BCA</option>
                            <option value="MANDIRI">BANK MANDIRI</option>
                        </select>
                    </div>
                </div>
                
                <div class="row mb-3" id="editTrxSplitGroup" style="display: none; gap: 15px; flex-wrap: wrap;">
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Nominal Tunai (Cash)</label>
                        <input type="number" id="editTrxCashAmount" class="form-control" value="0">
                    </div>
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Nominal Transfer</label>
                        <input type="number" id="editTrxTransferAmount" class="form-control" value="0">
                    </div>
                </div>

                <div class="row mb-3" style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Tujuan Transaksi</label>
                        <select id="editTrxTransactionPurpose" class="form-control" style="background-image: none;">
                            <option value="PERJALANAN_WISATA">Perjalanan / Wisata</option>
                            <option value="PERJALANAN_DINAS">Perjalanan Dinas</option>
                            <option value="BISNIS_PERDAGANGAN">Bisnis / Perdagangan</option>
                            <option value="PEMBAYARAN_BARANG_JASA">Pembayaran Barang / Jasa</option>
                            <option value="PENDIDIKAN">Pendidikan</option>
                            <option value="KESEHATAN">Kesehatan / Pengobatan</option>
                            <option value="IBADAH">Ibadah / Keagamaan</option>
                            <option value="BIAYA_HIDUP">Biaya Hidup di Luar Negeri</option>
                            <option value="KELUARGA_REMITANSI">Keluarga / Remitansi</option>
                            <option value="INVESTASI">Investasi</option>
                            <option value="TABUNGAN_SIMPANAN">Tabungan / Simpanan</option>
                            <option value="LAINNYA">Lainnya</option>
                        </select>
                    </div>
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Sumber Dana</label>
                        <select id="editTrxSourceOfFunds" class="form-control" style="background-image: none;">
                            <option value="GAJI">Gaji / Penghasilan Rutin</option>
                            <option value="HASIL_USAHA">Hasil Usaha</option>
                            <option value="TABUNGAN">Tabungan Pribadi</option>
                            <option value="HASIL_INVESTASI">Hasil Investasi</option>
                            <option value="PENJUALAN_ASET">Penjualan Aset</option>
                            <option value="PINJAMAN">Pinjaman</option>
                            <option value="WARISAN_HIBAH">Warisan / Hibah</option>
                            <option value="PENSIUN">Pensiun</option>
                            <option value="TRANSFER_KELUARGA">Transfer Keluarga</option>
                            <option value="REIMBURSEMENT">Reimbursement / Biaya Dinas</option>
                            <option value="LAINNYA">Lainnya</option>
                        </select>
                    </div>
                </div>
                
                <div class="row mb-3" style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Kasir / Input Oleh</label>
                        <input type="text" id="editTrxKasir" class="form-control" required>
                    </div>
                    <div class="col" style="flex: 1; min-width: 250px;">
                        <label class="form-label" style="display: block; margin-bottom: 5px; font-weight: 600;">Keterangan / Memo</label>
                        <textarea id="editTrxKeterangan" class="form-control" rows="2" placeholder="Catatan transaksi..."></textarea>
                    </div>
                </div>
                
                <div class="mb-3">
                    <div class="flex-between mb-2">
                        <label class="form-label" style="font-weight: 600; margin: 0;">Item Transaksi</label>
                        <button type="button" class="btn btn-sm btn-outline" onclick="window.addEditTrxRow()"><i class="fa-solid fa-plus"></i> Tambah Baris</button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th style="width: 110px;">Tipe</th>
                                    <th style="width: 120px;">Valuta</th>
                                    <th>Nominal</th>
                                    <th>Kurs / Rate</th>
                                    <th style="width: 180px; text-align: right;">Total IDR</th>
                                    <th style="width: 50px; text-align: center;">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="editTrxItemsBody">
                                <!-- Dynamic rows from JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="flex-between p-3 rounded mb-4" style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2);">
                    <div style="font-weight: bold; font-size: 1.1rem; color: #38bdf8;">Jumlah Bayar (Grand Total):</div>
                    <div id="editTrxGrandTotalDisplay" style="font-weight: bold; font-size: 1.3rem; color: #60a5fa;">Rp 0</div>
                </div>
                
                <div class="d-flex gap-2 justify-content-end">
                    <button type="button" class="btn btn-secondary" onclick="closeEditTrxModal()"><i class="fa-solid fa-xmark"></i> Batal</button>
                    <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Simpan Perubahan</button>
                </div>
            </form>
        </div>
    </div>

    <div id="myAccountModal" class="modal">
        <div class="modal-content panel" style="max-width: 420px; max-height: 90vh; overflow-y: auto;">
            <div class="flex-between mb-3">
                <h3><i class="fa-solid fa-user-gear"></i> Akun Saya</h3>
                <span class="close-modal" onclick="closeMyAccountModal()"><i class="fa-solid fa-xmark"></i></span>
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-bottom:10px;">
                <button type="button" class="btn btn-sm btn-outline" onclick="scrollUserProfileForm('myAccountModal', -1)"><i class="fa-solid fa-arrow-up"></i> Atas</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="scrollUserProfileForm('myAccountModal', 1)"><i class="fa-solid fa-arrow-down"></i> Bawah</button>
            </div>
            <hr class="divider mb-3">
            <div class="form-group mb-2">
                <label>Nama Lengkap</label>
                <input type="text" id="myAccountFullName" class="form-control" readonly>
            </div>
            <div class="form-group mb-2">
                <label>Role</label>
                <input type="text" id="myAccountRole" class="form-control" readonly>
            </div>
            <div class="form-group mb-2" style="text-align: center;">
                <label>Foto Profil</label>
                <input type="file" id="myAccountPhoto" class="form-control" accept="image/*" onchange="handleMyAccountPhoto(this)">
                <div id="myAccountPhotoPreview" style="margin-top:10px; max-height:110px; display:flex; justify-content:center; overflow:hidden; border-radius: 5px;"></div>
            </div>
            <div class="form-group mb-2">
                <label>Username Login</label>
                <input type="text" id="myAccountUsername" class="form-control" placeholder="Username login">
            </div>
            <div class="form-group mb-2">
                <label>Password Baru</label>
                <input type="password" id="myAccountPassword" class="form-control" placeholder="Kosongkan jika tidak diganti">
            </div>
            <div class="form-group mb-3">
                <label>Ulangi Password Baru</label>
                <input type="password" id="myAccountPasswordConfirm" class="form-control" placeholder="Ulangi password baru">
            </div>
            <button class="btn btn-primary w-100" onclick="saveMyAccount()"><i class="fa-solid fa-save"></i> Simpan Akun Saya</button>
            <button class="btn btn-outline w-100 mt-2" onclick="handleLogout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
        </div>
    </div>

    <!-- Reusable Camera Capture Modal -->
    <div id="cameraModal" class="modal" style="display: none; z-index: 10050;">
        <div class="modal-content panel" style="max-width: 600px; max-height: 95vh; display: flex; flex-direction: column; align-items: center;">
            <div class="flex-between w-100 mb-3">
                <h3 style="color: #38bdf8; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-camera"></i> Ambil Foto via Kamera USB</h3>
                <span class="close-modal" onclick="window.closeCameraModal()"><i class="fa-solid fa-xmark"></i></span>
            </div>
            <hr class="divider mb-3 w-100">
            
            <div class="form-group w-100 mb-3" style="display: flex; flex-direction: column; gap: 4px;">
                <label style="color: #94a3b8; font-size: 0.85rem;"><i class="fa-solid fa-gear"></i> Sumber Kamera (Pilih Kamera USB)</label>
                <select id="cameraSourceSelect" class="form-control" style="width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px;" onchange="window.changeCameraSource(this.value)"></select>
            </div>
            
            <div style="position: relative; width: 100%; height: 350px; background: #000; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                <!-- Catatan: video tidak di-mirror agar teks KTP/Passport tidak terbalik -->
                <video id="cameraVideo" style="width: 100%; height: 100%; object-fit: contain;"></video>
                <div id="cameraLoading" style="position: absolute; color: #fff; font-weight: bold; background: rgba(0,0,0,0.6); padding: 10px 20px; border-radius: 5px;">Mengaktifkan Kamera...</div>
            </div>
            
            <div class="d-flex gap-2 mt-4 w-100 justify-content-center">
                <button type="button" class="btn btn-secondary" onclick="window.closeCameraModal()"><i class="fa-solid fa-xmark"></i> Batal</button>
                <button type="button" class="btn btn-primary" onclick="window.captureCameraSnapshot()"><i class="fa-solid fa-camera"></i> Ambil Gambar</button>
            </div>
        </div>
    </div>

    <!-- Send Kurs WA Modal -->
    <div id="sendKursWaModal" class="modal" style="display: none; z-index: 10050;">
        <div class="modal-content panel" style="width: 95%; max-width: 460px;">
            <div class="modal-header flex-between mb-4">
                <h2>Kirim Kurs via WhatsApp</h2>
                <span class="close-modal" onclick="window.closeSendKursWaModal()">&times;</span>
            </div>
            <form id="sendKursWaModalForm" onsubmit="event.preventDefault(); window.submitSendKursWa();">
                <div class="form-group mb-3">
                    <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Pilih Kontak Favorit</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="mSendKursWaFavorite" class="form-control" style="flex: 1; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; height: auto;" onchange="window.selectWaFavorite(this.value)">
                            <!-- Kontak favorit akan diisi via JS -->
                        </select>
                        <button type="button" class="btn btn-danger" id="btnDeleteWaFavorite" onclick="window.deleteWaFavorite()" style="background: #ef4444; border: none; color: white; display: none; height: 38px; padding: 0 12px; border-radius: 6px;" title="Hapus dari Favorit">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>

                <hr class="divider mb-3" style="border-color: rgba(255,255,255,0.06); margin: 15px 0;">

                <div class="form-group mb-3">
                    <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Nomor WhatsApp Tujuan</label>
                    <input type="text" id="mSendKursWaPhone" class="form-control" placeholder="Contoh: 08123456789" style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px;">
                    <small class="text-muted" style="display: block; margin-top: 4px; font-size: 0.75rem;">Kosongkan jika ingin memilih kontak atau grup secara manual di WhatsApp.</small>
                </div>

                <div class="form-group mb-3">
                    <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Simpan Nomor ke Kontak Favorit</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="text" id="mSendKursWaName" class="form-control" placeholder="Masukkan nama (misal: Nama agen)" style="flex: 1; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px;">
                        <button type="button" class="btn btn-outline" onclick="window.saveWaFavorite()" style="border-color: #38bdf8; color: #38bdf8; height: 38px; padding: 0 12px; font-size: 0.85rem; white-space: nowrap; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-star"></i> Simpan
                        </button>
                    </div>
                </div>

                <button type="submit" class="btn btn-success btn-block mt-4" style="background:#25D366; color:white; border:none; border-radius: 6px; padding: 10px; font-weight: bold;"><i class="fa-brands fa-whatsapp"></i> Kirim ke WhatsApp</button>
            </form>
        </div>
    </div>




    <!-- Valas Waiting List Modal -->
    <div id="valasWaitingListModal" class="modal" style="display: none; z-index: 10050;">
        <div class="modal-content panel" style="width: 95%; max-width: 480px;">
            <div class="modal-header flex-between mb-4">
                <h2 id="wlModalTitle">Tambah Antrean Permintaan Valas</h2>
                <span class="close-modal" onclick="window.closeWaitingListModal()">&times;</span>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
                <input type="hidden" id="wlEntryId">
                <div class="form-group">
                    <label style="font-weight: 600; color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Nama Nasabah</label>
                    <input type="text" id="wlName" class="form-control" placeholder="Masukkan nama nasabah..." style="width: 100%;">
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">No. WhatsApp</label>
                    <input type="text" id="wlPhone" class="form-control" placeholder="Contoh: 08123456789" style="width: 100%;">
                </div>
                <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="font-weight: 600; color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Valas</label>
                        <select id="wlCurrency" class="form-control" style="width: 100%;"></select>
                    </div>
                    <div>
                        <label style="font-weight: 600; color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Jumlah Qty</label>
                        <input type="number" id="wlAmount" class="form-control" placeholder="Contoh: 1000" style="width: 100%;">
                    </div>
                </div>
                <div class="form-group" id="wlStatusGroup" style="display: none;">
                    <label style="font-weight: 600; color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Status</label>
                    <select id="wlStatus" class="form-control" style="width: 100%;">
                        <option value="PENDING">Menunggu</option>
                        <option value="READY">Ready</option>
                        <option value="CANCELLED">Batal</option>
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Catatan / Keterangan</label>
                    <textarea id="wlNotes" class="form-control" placeholder="Contoh: Seri baru pecahan 100, lembaran mulus..." style="width: 100%; height: 70px; resize: none;"></textarea>
                </div>
            </div>
            <div class="modal-footer mt-4" style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-secondary" onclick="window.closeWaitingListModal()"><i class="fa-solid fa-xmark"></i> Batal</button>
                <button type="button" class="btn btn-primary" onclick="window.saveWaitingListEntry()" style="background: #EC4899; border-color: #EC4899; color: white;"><i class="fa-solid fa-save"></i> Simpan</button>
            </div>
        </div>
    </div>

    <!-- Floating Multi-Calculator Widget -->
    <div id="floating-multi-calculator" class="floating-calc-widget hidden" style="position: fixed; bottom: 80px; right: 20px; width: 495px; max-height: 600px; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; z-index: 9999; overflow: hidden; color: #f8fafc; font-family: 'Outfit', sans-serif;">
        <!-- Header/Drag Handle -->
        <div class="calc-header" style="padding: 12px 16px; background: rgba(30, 41, 59, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.95rem; color: #38bdf8;">
                <i class="fa-solid fa-calculator"></i> Kalkulator Multi-Baris
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button onclick="toggleMinimizeCalculator()" class="btn-calc-action" title="Minimize" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 2px; font-size: 0.8rem;"><i class="fa-solid fa-window-minimize"></i></button>
                <button onclick="toggleMultiCalculator()" class="btn-calc-action" title="Close" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 2px; font-size: 0.9rem;"><i class="fa-solid fa-circle-xmark"></i></button>
            </div>
        </div>

        <div id="calc-expandable-content" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
            <!-- Global Mode Selection (BELI / JUAL) -->
            <div class="calc-global-mode" style="padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); gap: 10px; background: rgba(15, 23, 42, 0.25);">
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Mode Kurs Global:</span>
                <div style="display: flex; background: rgba(15, 23, 42, 0.6); border-radius: 6px; padding: 2px; border: 1px solid rgba(255,255,255,0.08);">
                    <button onclick="setCalcGlobalMode('BELI')" id="btn-calc-mode-beli" style="padding: 4px 12px; font-size: 0.75rem; border: none; border-radius: 4px; cursor: pointer; font-weight: 700; background: #10b981; color: white;">BELI (Kurs Beli)</button>
                    <button onclick="setCalcGlobalMode('JUAL')" id="btn-calc-mode-jual" style="padding: 4px 12px; font-size: 0.75rem; border: none; border-radius: 4px; cursor: pointer; font-weight: 700; background: transparent; color: #94a3b8;">JUAL (Kurs Jual)</button>
                </div>
            </div>

            <!-- Tabs for Sheets -->
            <div class="calc-tabs-bar" style="display: flex; background: rgba(15, 23, 42, 0.4); border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding: 6px 12px 0; overflow-x: auto; align-items: center; gap: 4px; justify-content: space-between;">
                <div id="calc-tabs-list" style="display: flex; gap: 4px; align-items: flex-end;">
                    <!-- Dynamic Tabs go here -->
                </div>
                <button onclick="addNewCalcSheet()" class="btn" style="padding: 2px 8px; margin-bottom: 4px; font-size: 0.8rem; background: rgba(255,255,255,0.05); color: #94a3b8; border: none; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-plus"></i></button>
            </div>

            <!-- Calculator Content Area -->
            <div id="calc-sheet-content" style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 12px; min-height: 220px; max-height: 380px;">
                <!-- Dynamic Active Sheet Table goes here -->
            </div>

            <!-- Sticky Footer Summary -->
            <div class="calc-footer" style="padding: 12px 16px; background: rgba(30, 41, 59, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
                    <span style="color: #94a3b8;"><i class="fa-solid fa-arrow-down" style="color: #f87171; margin-right: 4px;"></i>Total Beli (Kita Bayar):</span>
                    <span id="calc-total-beli" style="font-weight: 700; color: #f87171; font-size: 0.9rem;">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
                    <span style="color: #94a3b8;"><i class="fa-solid fa-arrow-up" style="color: #34d399; margin-right: 4px;"></i>Total Jual (Kita Terima):</span>
                    <span id="calc-total-jual" style="font-weight: 700; color: #34d399; font-size: 0.9rem;">Rp 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 8px;">
                    <span style="font-weight: 700; color: #e2e8f0;" id="calc-selisih-label">SELISIH AKHIR:</span>
                    <span id="calc-selisih-val" style="font-weight: 800; color: #38bdf8; font-size: 1.05rem;">Rp 0</span>
                </div>
                <div class="calc-actions-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 4px;">
                    <button onclick="splitSelectedRows()" class="btn btn-sm btn-outline" style="font-size: 0.75rem; padding: 6px; display: flex; align-items: center; justify-content: center; gap: 4px;" title="Pisahkan baris yang dicentang ke lembar baru"><i class="fa-solid fa-scissors"></i> Pisah Baris</button>
                    <button onclick="mergeToOtherSheetPrompt()" class="btn btn-sm btn-outline" style="font-size: 0.75rem; padding: 6px; display: flex; align-items: center; justify-content: center; gap: 4px;" title="Masukkan total lembar ini ke lembar lain"><i class="fa-solid fa-code-merge"></i> Gabung Total</button>
                    <button onclick="copyCalcSummary()" class="btn btn-sm btn-outline" style="font-size: 0.75rem; padding: 6px; display: flex; align-items: center; justify-content: center; gap: 4px;" title="Salin rincian kalkulator ke clipboard"><i class="fa-solid fa-copy"></i> Salin Rincian</button>
                    <button onclick="sendCalcTotalToPos()" class="btn btn-sm btn-primary" style="font-size: 0.75rem; padding: 6px; display: flex; align-items: center; justify-content: center; gap: 4px;" title="Kirim total akhir ke form POS transaksi aktif"><i class="fa-solid fa-paper-plane"></i> Kirim ke POS</button>
                </div>
            </div>
        </div>
    </div>

    @php
        $frontendModules = [
            '01-core.js',
            '02-dashboard.js',
            '03-pos.js',
            '04-customer-currency.js',
            '05-finance-ops.js',
            '06-regulatory-reports.js',
            '07-dtott.js',
            '08-auth.js',
            '09-operations.js',
            '10-accounting.js',
            '11-gallery.js',
            '12-gantungan.js',
            
            '15-calculator.js',
            '17-waiting-list.js',
            '19-userchat.js',
            '20-mobilemode.js',
            '21-demo-pos.js',
            '22-backup.js',
            '23-regulatory-ai.js',
            '24-regulatory-chat.js',
            '31-data-reset.js',
            '32-customer-tools.js',
            '33-user-access.js',
            '34-closing-daily.js',
            '35-investors.js',
            '36-lkbu.js',
            '37-expenses.js',
            '38-pos-queue.js',
            '39-pos-payment.js',
            '40-pickup.js',
            '41-kurs-hari-ini.js','42-booking.js','43-koin-uang-lama.js','44-iso-picker.js','45-currency-form.js','46-kurs-sync.js','47-kurs-page.js','48-session-guard.js','49-popup-style.js','50-vision-key.js','51-wa-gateway.js','52-wa-template.js','53-profile-form.js','54-login-page-settings.js','55-sidebar-brand.js','56-coretax.js','57-goaml.js','58-ai-settings.js','59-hris.js','60-documents.js','61-ai-assistant.js','62-translator.js','63-assets.js','64-mobile-focus.js','65-dashboard-ui.js','66-sidebar-ui.js','67-sipesat.js','68-pt-reps.js',
        ];
    @endphp
    <script src="{{ asset('js/sync.js') }}?v={{ time() }}"></script>
    @foreach ($frontendModules as $frontendModule)
        <script src="{{ asset('js/modules/' . $frontendModule) }}?v={{ time() }}"></script>
    @endforeach
    <script>
    window.toggleSettingsCard = function(button) {
        var card = button && button.closest('.settings-tab-content');
        if (!card) return;
        var isMinimized = card.classList.toggle('settings-card-minimized');
        button.setAttribute('aria-expanded', isMinimized ? 'false' : 'true');
        button.title = isMinimized ? 'Buka kartu' : 'Ciutkan kartu';
        button.innerHTML = '<i class="fa-solid ' + (isMinimized ? 'fa-plus' : 'fa-minus') + '"></i>';
        try { localStorage.setItem('mc_settings_card_' + card.id, isMinimized ? 'minimized' : 'open'); } catch (e) {}
    };

    window.initializeSettingsCardCollapse = function() {
        document.querySelectorAll('#settings-view .settings-tab-content').forEach(function(card) {
            if (card.querySelector(':scope > .settings-card-collapse')) return;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'settings-card-collapse';
            button.setAttribute('aria-label', 'Ciutkan kartu pengaturan');
            button.setAttribute('aria-expanded', 'true');
            button.title = 'Ciutkan kartu';
            button.innerHTML = '<i class="fa-solid fa-minus"></i>';
            button.addEventListener('click', function() { window.toggleSettingsCard(button); });
            card.insertBefore(button, card.firstChild);
            try {
                if (localStorage.getItem('mc_settings_card_' + card.id) === 'minimized') window.toggleSettingsCard(button);
            } catch (e) {}
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.initializeSettingsCardCollapse);
    else window.initializeSettingsCardCollapse();

    window.uploadAppFavicon = async function() {
        var input = document.getElementById('faviconUploadInput');
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            alert('Pilih gambar PNG favicon terlebih dahulu.');
            return;
        }
        if (file.type !== 'image/png') {
            alert('Gunakan file PNG untuk favicon.');
            return;
        }
        if (file.size > 1024 * 1024) {
            alert('Ukuran favicon maksimal 1 MB.');
            return;
        }
        var formData = new FormData();
        formData.append('favicon', file);
        try {
            var response = await window.authFetch('/api/branding/favicon', { method: 'POST', body: formData });
            var result = await response.json().catch(function() { return {}; });
            if (!response.ok) throw new Error(result.message || 'Favicon gagal diunggah.');
            var url = result.url || '/favicon.png?v=' + Date.now();
            document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(function(link) { link.href = url; });
            document.getElementById('faviconPreview').src = url;
            input.value = '';
            if (typeof Swal !== 'undefined') Swal.fire({ icon: 'success', title: 'Favicon diperbarui', text: 'Refresh halaman lain untuk melihat ikon terbaru.', timer: 1800, showConfirmButton: false });
            else alert('Favicon berhasil diperbarui.');
        } catch (error) {
            alert(error.message || 'Favicon gagal diunggah.');
        }
    };

    // FAILSAFE: If one of the frontend modules crashed and checkAuth never ran, do it here
        (async function() {
            try {
                var response = await window.authFetch('/auth/me', { cache: 'no-store' });
                if(response.ok) {
                    var result = await response.json();
                    if(result.csrfToken) window.setCsrfToken(result.csrfToken);
                    if(result.user) localStorage.setItem('mc_currentUser', JSON.stringify(result.user));
                } else if(response.status === 423) {
                    var result423 = await response.json().catch(function() { return {}; });
                    await handleSingleSessionConflict(result423.message || 'Akun ini sudah dipakai di perangkat lain. Silakan login ulang.');
                    return;
                } else if(response.status === 401) {
                    console.warn('Session server belum aktif; login lokal tidak dihapus otomatis.');
                }
                var user = JSON.parse(localStorage.getItem('mc_currentUser'));
            var loginEl = document.getElementById('loginContainer');
            var appEl = document.getElementById('appContainer');
            if (user && user.username && loginEl && appEl) {
                loginEl.style.display = 'none';
                appEl.style.display = 'flex';
                // Try to set user info in sidebar
                var userSpan = document.querySelector('.user-info span');
                if(userSpan) {
                    var roleName = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
                    userSpan.innerHTML = (user.fullName || user.username) + '<br><small>' + roleName + '</small>';
                }
            } else if (loginEl && appEl) {
                loginEl.style.display = 'flex';
                appEl.style.display = 'none';
            }
        } catch(e) { console.error('Failsafe checkAuth error:', e); }
    })();
    </script>
    <script>
        // INIT FLATPICKR FOR CUSTOMER BIRTH DATE
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof window.flatpickr === 'function') {
                window.flatpickr("#modalCustBirthDate", {
                    dateFormat: "d M Y",
                    allowInput: true
                });
            } else {
                console.warn('[Flatpickr] Library belum tersedia.');
            }
        });

        // RESET FILTER FUNCTIONS
window.resetReportFilter = function() {
    ['filterInvoice', 'filterNama', 'filterHp', 'reportStartDate', 'reportEndDate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const valutaS = document.getElementById('filterValuta');
    if(valutaS) valutaS.selectedIndex = 0;
    const tipeS = document.getElementById('filterTipe');
    if(tipeS) tipeS.selectedIndex = 0;
    
    window.loadReportsTable();
};
    </script>
    <!-- Global Toast Container for User Chat Notifications -->
    <!-- Global Toast Container for User Chat Notifications -->
    <div id="global-toast-container" style="position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none;"></div>

    <!-- ============================================================
         APV THEME SWITCHER SCRIPT
         3 Tema: apv (default) | light | dark
         ============================================================ -->
    <script>
    (function() {
        var SIDEBAR_GROUP_COLOR_KEY = 'mc_sidebar_group_colors_v1';
        var SIDEBAR_GROUP_COLOR_DEFAULTS = {
            dashboard:'#94A3B8', transaksi:'#94A3B8', nasabah:'#94A3B8',
            master:'#94A3B8', keuangan:'#94A3B8', laporan:'#94A3B8',
            bi:'#94A3B8', tools:'#94A3B8', administrasi:'#94A3B8', pengaturan:'#94A3B8'
        };
        function loadSidebarGroupColors(){
            try{
                var saved=JSON.parse(localStorage.getItem(SIDEBAR_GROUP_COLOR_KEY)||'{}');
                return Object.assign({}, SIDEBAR_GROUP_COLOR_DEFAULTS, saved||{});
            }catch(e){ return Object.assign({}, SIDEBAR_GROUP_COLOR_DEFAULTS); }
        }
        function applySidebarGroupColors(colors, persist){
            colors=Object.assign({}, SIDEBAR_GROUP_COLOR_DEFAULTS, colors||{});
            var root=document.documentElement;
            Object.keys(colors).forEach(function(group){
                root.style.setProperty('--mc-sidebar-group-'+group+'-color', colors[group]);
                document.querySelectorAll('.sidebar-menu-group[data-sidebar-group-section="'+group+'"] .sidebar-group-toggle')
                    .forEach(function(el){ el.style.setProperty('color', colors[group], 'important'); });
            });
            document.querySelectorAll('#mcSidebarGroupColors input[data-sidebar-color]').forEach(function(input){
                var group=input.getAttribute('data-sidebar-color');
                if(colors[group]) input.value=colors[group];
            });
            if(persist){
                try{ localStorage.setItem(SIDEBAR_GROUP_COLOR_KEY, JSON.stringify(colors)); }catch(e){}
            }
        }
        function initSidebarGroupColors(){
            var panel=document.getElementById('themeSwitcherPanel');
            var box=document.getElementById('mcSidebarGroupColors');
            if(panel) panel.classList.add('mc-theme-expanded');
            if(!box) return;
            var colors=loadSidebarGroupColors();
            box.querySelectorAll('input[data-sidebar-color]').forEach(function(input){
                input.addEventListener('input',function(){
                    var group=input.getAttribute('data-sidebar-color');
                    colors[group]=input.value;
                    applySidebarGroupColors(colors,true);
                });
            });
            var reset=document.getElementById('resetSidebarGroupColors');
            if(reset) reset.addEventListener('click',function(){
                colors=Object.assign({}, SIDEBAR_GROUP_COLOR_DEFAULTS);
                applySidebarGroupColors(colors,true);
            });
            applySidebarGroupColors(colors,false);
        }
        window.MCSidebarGroupColors={load:loadSidebarGroupColors,apply:applySidebarGroupColors,reset:function(){applySidebarGroupColors(SIDEBAR_GROUP_COLOR_DEFAULTS,true);}};
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initSidebarGroupColors,{once:true});
        else initSidebarGroupColors();
    })();
    </script>
    <script>
    (function() {
        var themes = {
            dark:  { label: 'Dark',  icon: 'fa-moon',  bodyClass: '',           btnColor: '#94A3B8',  btnBg: 'rgba(255,255,255,0.06)',        btnBorder: '1px solid rgba(255,255,255,0.12)' },
            light: { label: 'Light', icon: 'fa-sun',   bodyClass: 'light-theme', btnColor: '#64748b',  btnBg: '#f1f5f9',                      btnBorder: '1px solid #e2e8f0' },
            apv:   { label: 'APV',   icon: 'fa-crown', bodyClass: 'apv-theme',   btnColor: '#1D6C5D',  btnBg: 'rgba(29,108,93,0.10)',          btnBorder: '1px solid rgba(29,108,93,0.25)' }
        };
        // APV is the standard workspace. Existing dark-theme preferences are
        // migrated once to the new default; an explicit Light selection stays.
        var savedTheme = localStorage.getItem('mc_app_theme');
        var currentTheme = (!savedTheme || savedTheme === 'dark') ? 'apv' : savedTheme;

        function applyTheme(name) {
            if (!themes[name]) name = 'apv';
            currentTheme = name;
            localStorage.setItem('mc_app_theme', name);
            var body = document.body;
            body.classList.remove('light-theme', 'apv-theme');
            if (themes[name].bodyClass) body.classList.add(themes[name].bodyClass);

            // Update button
            var iconEl  = document.getElementById('themeIconCurrent');
            var labelEl = document.getElementById('themeLabelCurrent');
            var btn     = document.getElementById('themeSwitcherBtn');
            if (iconEl) {
                iconEl.className = 'fa-solid ' + themes[name].icon;
                iconEl.style.color = (name === 'apv') ? '#1D6C5D' : '';
            }
            if (labelEl) labelEl.textContent = themes[name].label;
            if (btn) {
                btn.style.color      = themes[name].btnColor;
                btn.style.background = themes[name].btnBg;
                btn.style.border     = themes[name].btnBorder;
            }

            // Checkmarks
            ['dark','light','apv'].forEach(function(t) {
                var chk = document.getElementById('check' + t.charAt(0).toUpperCase() + t.slice(1));
                if (chk) chk.style.display = (t === name) ? 'inline' : 'none';
                var opt = document.getElementById('themeOpt' + t.charAt(0).toUpperCase() + t.slice(1));
                if (opt) {
                    var isSelected = t === name;
                    var isApv = isSelected && t === 'apv';
                    opt.style.background = isSelected ? (isApv ? 'rgba(29,108,93,0.10)' : 'rgba(59,130,246,0.12)') : 'transparent';
                    opt.style.color = isSelected ? (isApv ? '#1D6C5D' : '#93c5fd') : '';
                }
            });

            // Panel background sesuai tema
            var panel = document.getElementById('themeSwitcherPanel');
            if (panel) {
                if (name === 'apv') {
                    panel.style.background = '#f7f5ef';
                    panel.style.border     = '1px solid #d7d8cf';
                    panel.style.boxShadow  = '0 8px 28px rgba(25,43,36,0.08)';
                } else {
                    panel.style.background = '#1e293b';
                    panel.style.border     = '1px solid rgba(255,255,255,0.12)';
                    panel.style.boxShadow  = '0 8px 28px rgba(0,0,0,0.35)';
                }
            }
            closeSwitcherPanel();
        }

        function toggleThemePanel() {
            var panel = document.getElementById('themeSwitcherPanel');
            if (!panel) return;
            panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
        }
        function closeSwitcherPanel() {
            var p = document.getElementById('themeSwitcherPanel');
            if (p) p.style.display = 'none';
        }
        document.addEventListener('click', function(e) {
            var wrap = document.getElementById('themeSwitcherWrap');
            if (wrap && !wrap.contains(e.target)) closeSwitcherPanel();
        });

        window.applyTheme       = applyTheme;
        window.toggleThemePanel = toggleThemePanel;
        // Override toggleTheme lama: klik icon sun lama = cycle 3 tema
        window.toggleTheme = function() {
            var order = ['dark','light','apv'];
            var idx = order.indexOf(currentTheme);
            applyTheme(order[(idx + 1) % 3]);
        };

        // Terapkan tema tersimpan
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() { applyTheme(currentTheme); });
        } else {
            applyTheme(currentTheme);
        }
    })();
    </script>
    <style id="mc-theme-sidebar-group-colors-style">
        .mc-theme-divider{height:1px;margin:5px 4px 7px;background:rgba(148,163,184,.18);}
        .mc-sidebar-group-color-title{display:flex;align-items:center;gap:7px;padding:7px 8px 5px;color:#64748b;font-size:9.5px;font-weight:800;letter-spacing:.65px;text-transform:uppercase;}
        .mc-sidebar-group-color-title i{font-size:10px;color:#1D6C5D;}
        .mc-sidebar-group-colors{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow-y:auto;padding:0 3px;}
        .mc-sidebar-group-colors label{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 7px;border-radius:6px;color:#64748b;font-size:10px;line-height:1.15;cursor:pointer;}
        .mc-sidebar-group-colors label:hover{background:rgba(29,108,93,.07);}
        .mc-sidebar-group-colors input[type="color"]{width:28px;height:20px;padding:1px;border:1px solid #cbd5e1;border-radius:5px;background:transparent;cursor:pointer;flex:0 0 28px;}
        .mc-sidebar-group-reset{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin:6px 0 2px;padding:6px 7px;border:1px solid #d7d8cf;border-radius:7px;background:#f8fafc;color:#64748b;font-size:10px;font-weight:700;cursor:pointer;}
        .mc-sidebar-group-reset:hover{background:#eef6f3;color:#1D6C5D;border-color:#b9d8ce;}
        #themeSwitcherPanel.mc-theme-expanded{min-width:290px!important;}
        body:not(.apv-theme) #themeSwitcherPanel .mc-sidebar-group-color-title{color:#94a3b8;}
        body:not(.apv-theme) #themeSwitcherPanel .mc-sidebar-group-colors label{color:#cbd5e1;}
        body:not(.apv-theme) #themeSwitcherPanel .mc-sidebar-group-reset{background:#0f172a;color:#cbd5e1;border-color:rgba(255,255,255,.14);}
    </style>
        <script>
    (function(){
        var STORAGE='mc_sidebar_groups_v1';
        var defaults={dashboard:true,transaksi:true,nasabah:true,master:true,keuangan:true,laporan:true,bi:true,tools:true,administrasi:true,pengaturan:true};

        function readState(){
            try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(STORAGE)||'{}'));}catch(e){return Object.assign({},defaults);}
        }
        function saveState(state){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}}

        function setGroup(groupId,open,persist){
            var section=document.querySelector('[data-sidebar-group-section="'+groupId+'"]');
            if(!section)return;
            section.classList.toggle('is-collapsed',!open);
            var btn=section.querySelector('[data-sidebar-group-toggle="'+groupId+'"]');
            if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
            if(persist){var state=readState();state[groupId]=!!open;saveState(state);}
        }

        function refreshEmptyGroups(){
            document.querySelectorAll('[data-sidebar-group-section]').forEach(function(section){
                var visible=Array.from(section.querySelectorAll('.sidebar-group-items > .nav-item')).some(function(el){
                    return getComputedStyle(el).display!=='none';
                });
                section.style.display=visible?'':'none';
            });
        }

        function openGroupForTarget(target){
            var item=document.querySelector('.sidebar-group-items .nav-item[data-target="'+target+'"]');
            if(!item)return;
            var section=item.closest('[data-sidebar-group-section]');
            if(section)setGroup(section.getAttribute('data-sidebar-group-section'),true,true);
        }

        window.toggleSidebarGroup=function(groupId){
            var section=document.querySelector('[data-sidebar-group-section="'+groupId+'"]');
            if(!section)return;
            var open=!section.classList.contains('is-collapsed');
            setGroup(groupId,!open,true);
        };

        function init(){
            var state=readState();
            document.querySelectorAll('[data-sidebar-group-toggle]').forEach(function(btn){
                btn.addEventListener('click',function(){window.toggleSidebarGroup(btn.getAttribute('data-sidebar-group-toggle'));});
            });
            Object.keys(state).forEach(function(id){setGroup(id,state[id],false);});

            document.querySelectorAll('.sidebar-group-items .nav-item').forEach(function(item){
                item.addEventListener('click',function(e){
                    var section=item.closest('[data-sidebar-group-section]');
                    if(section)setGroup(section.getAttribute('data-sidebar-group-section'),true,true);
                    if(item.getAttribute('data-sidebar-action')==='theme'){
                        e.preventDefault();
                        if(typeof window.toggleThemePanel==='function'){
                            window.toggleThemePanel();
                        }
                    }
                },true);
            });

            var observer=new MutationObserver(function(){refreshEmptyGroups();});
            observer.observe(document.querySelector('.sidebar-nav-grouped'),{subtree:true,attributes:true,attributeFilter:['style','class']});
            refreshEmptyGroups();

            window.openSidebarMenuGroup=openGroupForTarget;
        }

        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
    })();
    </script>
    <script src="{{ asset('js/modules/29-letter-archive.js?v=20261005-2') }}"></script>
    <script src="{{ asset('js/modules/28-letter-number.js?v=20261015-1') }}"></script>
    <script src="{{ asset('js/pwa.js?v=1.0.0') }}"></script>
<script src="{{ asset('js/modules/30-dashboard-analytics.js?v=20261008-1') }}"></script>
</body>

</html>











