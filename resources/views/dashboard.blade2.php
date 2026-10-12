<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
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

        window.isPerformingSilentLogin = false;
        window.isHandlingSingleSessionConflict = false;

        function clearLocalAuthState() {
            try { localStorage.removeItem('mc_currentUser'); } catch (e) {}
            try { sessionStorage.removeItem('mc_currentUser_password'); } catch (e) {}
        }

        async function handleSingleSessionConflict(message) {
            if (window.isHandlingSingleSessionConflict) return;
            window.isHandlingSingleSessionConflict = true;
            clearLocalAuthState();

            var text = message || 'Akun ini sudah dipakai di perangkat lain. Silakan login ulang.';
            try {
                if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
                    await Swal.fire({
                        icon: 'warning',
                        title: 'Sesi Dipindah',
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

            window.location.reload();
        }

        async function silentReLogin() {
            if (window.isPerformingSilentLogin) return false;
            window.isPerformingSilentLogin = true;
            try {
                var currentUser = JSON.parse(localStorage.getItem('mc_currentUser'));
                var password = sessionStorage.getItem('mc_currentUser_password');
                if (!currentUser || !currentUser.username || !password) {
                    window.isPerformingSilentLogin = false;
                    return false;
                }
                var response = await nativeFetch('/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': window.getCsrfToken()
                    },
                    body: JSON.stringify({ username: currentUser.username, password: password })
                });
                var result = await response.json().catch(function() { return {}; });
                if (response.ok && result.user) {
                    if (result.csrfToken) window.setCsrfToken(result.csrfToken);
                    localStorage.setItem('mc_currentUser', JSON.stringify(result.user));
                    window.isPerformingSilentLogin = false;
                    
                    // Hide offline indicator if active
                    var ind = document.getElementById('connectionStatusIndicator');
                    if (ind) ind.style.display = 'none';
                    window.sessionExpiredAcknowledged = false;
                    
                    return true;
                }
            } catch (e) {
                console.error("Silent re-login error:", e);
            }
            window.isPerformingSilentLogin = false;
            return false;
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
                            // Coba re-login otomatis di latar belakang
                            var loggedIn = await silentReLogin();
                            if (loggedIn) {
                                // Update token CSRF and retry
                                if (options.headers) {
                                    options.headers['X-CSRF-TOKEN'] = window.getCsrfToken();
                                }
                                return await nativeFetch(resource, options);
                            }
                            
                            // Jika re-login otomatis gagal, dan belum diakui (acknowledged) oleh user
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
                try { sessionStorage.setItem('mc_currentUser_password', pw); } catch(e) {}
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
    <link rel="stylesheet" href="{{ asset('css/business-ui.css?v=' . time()) }}">
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
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            var logger = document.getElementById('visual-error-logger');
            var list = document.getElementById('visual-error-list');
            if (logger && list) {
                logger.style.display = 'block';
                if (list.innerHTML.indexOf('Tidak ada error') === 0) {
                    list.innerHTML = '';
                }
                var fileName = url ? url.split('/').pop() : 'inline';
                list.innerHTML += '<div>• <strong>' + msg + '</strong> (' + fileName + ':' + lineNo + ')</div>';
            }
            try {
                fetch('/debug_logger.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        msg: msg,
                        url: url,
                        lineNo: lineNo,
                        columnNo: columnNo,
                        stack: error ? error.stack : '',
                        userAgent: navigator.userAgent
                    })
                }).catch(function() {});
            } catch(e) {}
            return false;
        };
        
        // Immediately determine if user is logged in BEFORE any rendering
        var _isLoggedIn = false;
        try {
            var _u = JSON.parse(localStorage.getItem('mc_currentUser'));
            if(_u && _u.username) _isLoggedIn = true;
        } catch(e) {}
        
        try {
            fetch('/debug_logger.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    msg: "DUMP_STORAGE",
                    mc_currencies: localStorage.getItem('mc_currencies'),
                    mc_currentUser: localStorage.getItem('mc_currentUser')
                })
            }).catch(function() {});
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
            <div class="sidebar-header" style="display: flex; align-items: center; justify-content: space-between;">
                <div class="sidebar-brand" style="display: flex; align-items: center; gap: 10px;">
                    <img src="{{ asset('img/logo-almara.png') }}" alt="Logo" style="height: 35px; object-fit: contain;">
                    <div class="sidebar-brand-text" style="display: flex; flex-direction: column;">
                        <h2 style="margin: 0; font-size: 1.1rem; letter-spacing: 0.5px;">ALMARA PUTRA VALASINDO</h2>
                        <span style="font-size: 0.65rem; color: #94A3B8; letter-spacing: 1px; text-transform: uppercase; margin-top:2px;">Authorized Money Changer</span>
                        <span style="font-size: 0.6rem; color: #10B981; font-weight: bold; margin-top: 2px; letter-spacing: 0.5px;">Versi 2.0.0</span>
                    </div>
                </div>
                <button class="collapse-sidebar" id="collapseSidebar" title="Ciutkan sidebar"><i class="fa-solid fa-angles-left"></i></button>
                <button class="close-sidebar" id="closeSidebar"><i class="fa-solid fa-xmark"></i></button>
            </div>            <nav class="sidebar-nav">
                <!-- Group 1: Operasional Utama -->                <div class="sidebar-group-title" style="padding: 15px 20px 6px 15px; color: #475569; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(255,255,255,0.02); margin-top: 5px; margin-bottom: 5px;">Operasional Utama</div>
                <a href="#" class="nav-item active" data-target="dashboard-view"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
                <a href="#" class="nav-item" id="navPosReal" data-target="pos-view"><i class="fa-solid fa-cash-register"></i> Transaksi / POS</a>
                <a href="#" class="nav-item" data-target="demo-pos-view"><i class="fa-solid fa-flask"></i> Demo Transaksi</a>
                <a href="#" class="nav-item" data-target="kurs-hari-ini-view"><i class="fa-solid fa-money-bill-trend-up" style="color: #38bdf8;"></i> Kurs Hari Ini</a>
                <a href="#" class="nav-item" data-target="currency-view"><i class="fa-solid fa-money-bill-transfer"></i> Manajemen Kurs</a>
                <a href="#" class="nav-item" data-target="mutation-view"><i class="fa-solid fa-building-columns"></i> Mutasi Bank</a>
                <a href="#" class="nav-item" data-target="closing-view"><i class="fa-solid fa-box-archive"></i> Closing Harian</a>
                <a href="#" class="nav-item" data-target="customers-view"><i class="fa-solid fa-users"></i> Data Nasabah</a>
                <a href="#" class="nav-item" data-target="booking-view"><i class="fa-solid fa-book-bookmark" style="color: #FBBF24;"></i> Daftar Booking</a>
                <a href="#" class="nav-item" data-target="old-money-view"><i class="fa-solid fa-coins" style="color: #FBBF24;"></i> Koin & Uang Lama</a>

                <!-- Group 2: Bantuan -->
                <div class="sidebar-group-title" style="padding: 15px 20px 6px 15px; color: #475569; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(255,255,255,0.02); margin-top: 10px; margin-bottom: 5px;">Bantuan</div>
                <a href="#" class="nav-item" data-target="documents-view"><i class="fa-solid fa-folder-open" style="color: #FBBF24;"></i> Penyimpanan Berkas</a>
                <a href="#" class="nav-item" data-target="ai-chat-view"><i class="fa-solid fa-robot" style="color: #EC4899;"></i> Tanya AI / Deteksi Valas</a>
                <a href="#" class="nav-item" data-target="valas-gallery-view"><i class="fa-solid fa-images" style="color: #FBBF24;"></i> Galeri Valas</a>
                <a href="#" class="nav-item" data-target="pickup-view"><i class="fa-solid fa-motorcycle" style="color: #F97316;"></i> Serah Terima / Pickup</a>
                <a href="#" class="nav-item" data-target="gantungan-view"><i class="fa-solid fa-hand-holding-dollar" style="color: #FBBF24;"></i> Catatan Gantungan</a>
                <a href="#" class="nav-item" data-target="waiting-list-view"><i class="fa-solid fa-hourglass-half" style="color: #EC4899;"></i> Permintaan Valas</a>
                <a href="#" class="nav-item" data-target="translator-view"><i class="fa-solid fa-language" style="color: #38bdf8;"></i> Penerjemah Bahasa</a>
                <a href="#" class="nav-item" data-target="user-chat-view"><i class="fa-solid fa-comments" style="color: #EC4899;"></i> Chat</a>

                <!-- Group 3: Keuangan & Kas -->
                <div class="sidebar-group-title" style="padding: 15px 20px 6px 15px; color: #475569; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(255,255,255,0.02); margin-top: 10px; margin-bottom: 5px;">Keuangan & Kas</div>
                <a href="#" class="nav-item" data-target="expense-view"><i class="fa-solid fa-receipt"></i> Pengeluaran & Pendapatan</a>
                <a href="#" class="nav-item" data-target="adjustment-view"><i class="fa-solid fa-scale-unbalanced"></i> Ekuitas & Kewajiban</a>
                <a href="#" class="nav-item" data-target="investor-view"><i class="fa-solid fa-hand-holding-dollar" style="color:#10b981;"></i> Penanam Saham</a>

                <!-- Group 4: Laporan & Audit -->
                <div class="sidebar-group-title" style="padding: 15px 20px 6px 15px; color: #475569; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(255,255,255,0.02); margin-top: 10px; margin-bottom: 5px;">Laporan & Audit</div>
                <a href="#" class="nav-item" data-target="harian-view"><i class="fa-solid fa-calendar-day"></i> Laporan Harian</a>
                <a href="#" class="nav-item" data-target="laporan-posisi-valuta-view"><i class="fa-solid fa-table-list"></i> Rekap Valuta</a>
                <a href="#" class="nav-item" data-target="reports-view"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Transaksi</a>
                <a href="#" class="nav-item" data-target="audit-view"><i class="fa-solid fa-shield-halved"></i> RWT</a>
                <a href="#" class="nav-item" data-target="dtott-view"><i class="fa-solid fa-user-shield"></i> DTTOT</a>

                <div class="nav-accordion-header" onclick="toggleNavMenu('menuBi')" style="cursor:pointer; padding: 10px 20px 5px; color: #94A3B8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
                    <span>Laporan BI</span>
                    <i class="fa-solid fa-chevron-down" id="icon-menuBi"></i>
                </div>
                <div id="menuBi" class="nav-submenu" style="display: none;">
                    <a href="#" class="nav-item" data-target="laporan-lku-view" style="padding-left: 35px;"><i class="fa-solid fa-file-invoice text-xs"></i> LKU</a>
                    <a href="#" class="nav-item" data-target="laporan-granular-view" style="padding-left: 35px;"><i class="fa-solid fa-file-invoice text-xs"></i> Granular</a>
                    <a href="#" class="nav-item" data-target="laporan-sipesat-view" style="padding-left: 35px;"><i class="fa-solid fa-file-invoice text-xs"></i> Sipesat</a>
                    <a href="#" class="nav-item" data-target="laporan-goaml-view" style="padding-left: 35px;"><i class="fa-solid fa-file-invoice text-xs"></i> GoAML</a>
                    <a href="#" class="nav-item" data-target="laporan-sipendar-view" style="padding-left: 35px;"><i class="fa-solid fa-file-invoice text-xs"></i> Sipendar</a>
                </div>

                <div class="nav-accordion-header" onclick="toggleNavMenu('menuKeuangan')" style="cursor:pointer; padding: 10px 20px 5px; color: #94A3B8; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
                    <span>Laporan Keuangan</span>
                    <i class="fa-solid fa-chevron-down" id="icon-menuKeuangan"></i>
                </div>
                <div id="menuKeuangan" class="nav-submenu" style="display: none;">
                    <a href="#" class="nav-item" data-target="laporan-aset-view" style="padding-left: 35px;"><i class="fa-solid fa-building text-xs"></i> Aset & Penyusutan</a>
                    <a href="#" class="nav-item" data-target="laporan-bukubesar-view" style="padding-left: 35px;"><i class="fa-solid fa-book text-xs"></i> Buku Besar</a>
                    <a href="#" class="nav-item" data-target="laporan-labarugi-view" style="padding-left: 35px;"><i class="fa-solid fa-chart-line text-xs"></i> Laba / Rugi</a>
                    <a href="#" class="nav-item" data-target="laporan-neraca-view" style="padding-left: 35px;"><i class="fa-solid fa-scale-balanced text-xs"></i> Neraca</a>
                    <a href="#" class="nav-item" data-target="laporan-ekuitas-view" style="padding-left: 35px;"><i class="fa-solid fa-money-bill-trend-up text-xs"></i> Ekuitas</a>
                    <a href="#" class="nav-item" data-target="laporan-coretax-view" style="padding-left: 35px;"><i class="fa-solid fa-file-invoice-dollar text-xs"></i> Pajak CoreTax</a>
                </div>

                <!-- Group 5: Sistem & HRIS -->
                <div class="sidebar-group-title" style="padding: 15px 20px 6px 15px; color: #475569; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(255,255,255,0.02); margin-top: 10px; margin-bottom: 5px;">Sistem & HRIS</div>
                <a href="#" class="nav-item" data-target="hris-view"><i class="fa-solid fa-users-gear" style="color:#6366f1;"></i> HRIS / Karyawan</a>
                <a href="/papan-kurs" target="_blank" class="nav-item" style="color: #10B981;">
                    <i class="fa-solid fa-desktop" style="color: #10B981;"></i> Monitor Papan Kurs 
                    <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.75rem; margin-left: 5px; opacity: 0.7;"></i>
                </a>
                <a href="#" class="nav-item" data-target="masterdata-view"><i class="fa-solid fa-database"></i> Master Data</a>
                <a href="#" class="nav-item" data-target="settings-view"><i class="fa-solid fa-gear"></i> Pengaturan</a>
            </nav>
            <div class="sidebar-footer" style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                <div class="user-info">
                    <i class="fa-solid fa-user-circle"></i>
                    <span>Admin Kasir<br><small>Shift 1</small></span>
                </div>
                <button class="btn btn-sm btn-outline w-100" onclick="manualSyncAll()" style="font-size: 0.8rem; border-color: #38bdf8; color: #38bdf8; background: rgba(56, 189, 248, 0.05); padding: 6px; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer;" title="Kirim data lokal ke server MySQL secara manual">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Sinkronkan Data
                </button>
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
                    <div class="mb-4" style="background: rgba(30, 41, 59, 0.6); border-left: 3px solid #3b82f6; border-radius: 6px; padding: 6px 15px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; border-top: 1px solid rgba(59, 130, 246, 0.15); border-right: 1px solid rgba(59, 130, 246, 0.15); border-bottom: 1px solid rgba(59, 130, 246, 0.15); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="font-size: 0.9rem; font-weight: 600; color: #f8fafc; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                            <i class="fa-solid fa-calendar-day" style="color: #60a5fa;"></i> Tinjauan Hari Ini
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex: 1; flex-wrap: nowrap;">
                            <input type="date" id="dashDateFilter" class="form-control" style="font-size: 0.8rem; padding: 2px 10px; height: 28px; line-height: 1.2; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.3); color: #f8fafc; border-radius: 4px; width: 140px; margin: 0;" placeholder="Pilih Tanggal">
                            <button class="btn btn-primary" style="padding: 0 10px; font-size: 0.8rem; height: 28px; line-height: 1.2; border-radius: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap; margin: 0;" onclick="loadDashboard()"><i class="fa-solid fa-filter"></i> Terapkan</button>
                            <button class="btn btn-outline" style="padding: 0 10px; font-size: 0.8rem; height: 28px; line-height: 1.2; border-radius: 4px; border: 1px solid rgba(148, 163, 184, 0.4); color: #cbd5e1; display: flex; align-items: center; gap: 5px; background: transparent; white-space: nowrap; margin: 0;" onclick="document.getElementById('dashDateFilter').value = ''; loadDashboard();"><i class="fa-solid fa-rotate-left"></i> Reset</button>
                        </div>
                    </div>
                
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa-solid fa-wallet"></i></div>
                            <div class="stat-details">
                                <h3>Brankas Tunai (Cash)</h3>
                                <p class="stat-value" id="dashTotalKas">Rp 0</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: #60A5FA;"><i class="fa-solid fa-building-columns"></i>
                            </div>
                            <div class="stat-details">
                                <h3>Saldo Bank (Transfer)</h3>
                                <p class="stat-value" id="dashTotalBank">Rp 0</p>
                                <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
                                    <span style="background: rgba(59, 130, 246, 0.15); color: #93C5FD; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(59, 130, 246, 0.3);">
                                        BCA: <strong id="dashBCA" style="color: #EFF6FF;">Rp 0</strong>
                                    </span>
                                    <span style="background: rgba(234, 179, 8, 0.15); color: #FDE047; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(234, 179, 8, 0.3);">
                                        Mandiri: <strong id="dashMandiri" style="color: #FEF08A;">Rp 0</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon"><i class="fa-solid fa-sack-dollar"></i></div>
                            <div class="stat-details">
                                <h3>Total Valuta (Estimasi)</h3>
                                <p class="stat-value" id="dashTotalValuta">Rp 0</p>
                                <small id="dashTotalValutaHint" class="text-muted" style="display:block; margin-top: 2px;">Berdasarkan saldo awal valas</small>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon text-green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                            <div class="stat-details">
                                <h3>Profit Hari Ini</h3>
                                <p class="stat-value text-green" id="dashProfit">Rp 0</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-grid mt-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                        <div class="stat-card">
                            <div class="stat-icon text-green"><i class="fa-solid fa-arrow-down"></i></div>
                            <div class="stat-details">
                                <h3>Total Pembelian</h3>
                                <p class="stat-value text-green" id="dashTotalPurchases">Rp 0</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon text-red"><i class="fa-solid fa-arrow-up"></i></div>
                            <div class="stat-details">
                                <h3>Total Penjualan</h3>
                                <p class="stat-value text-red" id="dashTotalSales">Rp 0</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: #FBBF24;"><i class="fa-solid fa-receipt"></i></div>
                            <div class="stat-details">
                                <h3>Pengeluaran</h3>
                                <p class="stat-value" style="color: #FBBF24;" id="dashTotalExpenses">Rp 0</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon" style="color: #8B5CF6;"><i class="fa-solid fa-scale-unbalanced"></i></div>
                            <div class="stat-details">
                                <h3>Selisih Rekons.</h3>
                                <p class="stat-value" style="color: #8B5CF6;" id="dashTotalSelisih">Rp 0</p>
                                <small id="dashTotalSelisihHint" class="text-muted" style="display:block; margin-top: 2px;">Belum ada closing</small>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-content dashboard-market-layout mt-4">
                        <!-- Chart -->
                        <div class="panel chart-panel">
                            <div class="panel-header chart-panel-header">
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
                                    <select id="dashboardChartCurrency" class="form-control chart-currency-select" onchange="loadDashboard()">
                                        <option value="ALL">Semua Valuta</option>
                                    </select>
                                </div>
                            </div>
                            <canvas id="transactionChart"></canvas>
                        </div>

                        <!-- Stock Live Monitoring -->
                        <div class="panel stock-panel">
                            <div class="panel-header">
                                <h3><i class="fa-solid fa-boxes-stacked"></i> Live Stok Valuta</h3>
                                <div class="stock-search">
                                    <i class="fa-solid fa-magnifying-glass"></i>
                                    <input type="text" id="dashboardStockSearch" class="form-control" placeholder="Cari kode..." autocomplete="off" oninput="loadStockMonitor()">
                                </div>
                            </div>
                            <div class="stock-list" id="dashboardStockList">
                                <!-- Stock items injected by JS -->
                            </div>
                        </div>
                    </div>

                    <!-- Recent Activity -->
                    <div class="panel mt-4">
                        <div class="flex-between mb-2" style="gap:10px; flex-wrap:wrap;">
                            <h3 style="margin:0;"><i class="fa-solid fa-list-check"></i> Aktivitas Terbaru</h3>
                        </div>
                        <div class="table-responsive">
                            <table class="table">
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
                                    <!-- Injected by JS -->
                                </tbody>
                            </table>
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
                                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; font-weight: bold;"><i class="fa-solid fa-history"></i> Riwayat Transaksi Nasabah (5 Terakhir)</div>
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

                <!-- Daftar Booking View -->
                <section id="booking-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #FBBF24;">
                        <div>
                            <h2 style="color: #FBBF24;"><i class="fa-solid fa-book-bookmark"></i> Daftar Booking Aktif</h2>
                            <p class="text-muted mt-2">Daftar nasabah yang sudah membayar DP namun valas belum diambil / pelunasan selesai.</p>
                        </div>
                        <div>
                            <button class="btn btn-warning" onclick="openBookingEntryForm()" style="background:#F59E0B; color:white; border:none;"><i class="fa-solid fa-plus"></i> Tambah Booking</button>
                            <button class="btn btn-primary" onclick="loadBookingsTable()"><i class="fa-solid fa-rotate-right"></i> Perbarui</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div id="bookingTotalsSummary" class="mb-3" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px;"></div>
                        <div class="mb-3" style="display: flex; gap: 10px; align-items: center;">
                            <i class="fa-solid fa-search" style="color: #94A3B8;"></i>
                            <input type="text" id="searchBookingInput" class="form-control" placeholder="Cari No. Booking, Nama, atau No. Telp..." oninput="loadBookingsTable()" style="max-width: 400px; border-radius: 20px;">
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Waktu Transaksi</th>
                                        <th>Jam Kedatangan</th>
                                        <th>No. Booking</th>
                                        <th>Nasabah</th>
                                        <th>Total Valas</th>
                                        <th style="text-align: right;">Total IDR</th>
                                        <th style="text-align: right;">DP Masuk</th>
                                        <th style="text-align: right; color: #F87171;">Sisa Tagihan</th>
                                        <th style="text-align: center;">Aksi Pelunasan</th>
                                    </tr>
                                </thead>
                                <tbody id="bookingsTableBody">
                                </tbody>
                            </table>
                        </div>
                    </div>
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

                <!-- Penerjemah Bahasa View -->
                <section id="translator-view" class="view-section hidden">
                    <style>
                        .translator-tab {
                            padding: 8px 16px;
                            font-size: 0.85rem;
                            font-weight: 600;
                            border-radius: 6px;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            border: none;
                        }
                        .translator-tab.active {
                            background: #38bdf8;
                            color: #0f172a;
                        }
                        .translator-tab:not(.active) {
                            background: rgba(255, 255, 255, 0.03);
                            color: #94a3b8;
                        }
                        .translator-tab:not(.active):hover {
                            background: rgba(255, 255, 255, 0.06);
                            color: #f8fafc;
                        }
                        #translator-view .translator-mode[hidden] { display: none !important; }
                        #translator-view .translator-mode { display: block; }
                        #translator-view #contentTransSpeak { display: flex; flex-direction: column; overflow: hidden; }
                        #translator-view .translator-text-grid { display: grid; grid-template-columns: 1fr 40px 1fr; gap: 15px; align-items: stretch; position: relative; }
                        #translator-view .translator-speak-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 5px 0; flex: 0 0 auto; }
                        @media (max-width: 768px) {
                            /* 56px app header + 64px bottom nav + container spacing: panel bicara selalu berada di area layar yang tersisa. */
                            #translator-view.active.translator-speak-active { display:flex !important; flex-direction:column; height:calc(100dvh - 150px - env(safe-area-inset-bottom)); min-height:0; overflow:hidden; }
                            #translator-view.active.translator-speak-active > .header-panel { flex:0 0 auto; margin-bottom:8px; padding:10px 12px !important; }
                            #translator-view.active.translator-speak-active > .header-panel h2 { font-size:1rem !important; margin:0; }
                            #translator-view.active.translator-speak-active > .header-panel p { display:none; }
                            #translator-view.active.translator-speak-active #contentTransSpeak { flex:1 1 auto; min-height:0 !important; height:auto !important; margin-top:0 !important; }
                            #translator-view .header-panel { align-items: stretch; }
                            #translator-view .header-panel > div:last-child { width: 100%; }
                            #translator-view .translator-tab { flex: 1; min-height: 46px; padding: 8px 10px; font-size: .78rem; }
                            #translator-view .translator-text-grid { grid-template-columns: 1fr; gap: 10px; }
                            #translator-view .translator-swap { height: 40px; }
                            #translator-view .translator-swap button { transform: rotate(90deg); }
                            #translator-view #contentTransSpeak { height: calc(100dvh - 190px) !important; min-height: 0 !important; max-height: none !important; padding: 10px !important; }
                            #translator-view .translator-speak-header { align-items: stretch !important; gap: 10px !important; }
                            #translator-view .translator-speak-header > div { width: 100%; justify-content: space-between; }
                            #translator-view .translator-speak-header select { width: min(58vw, 190px) !important; }
                            #translator-view .translator-speak-actions { position:sticky; bottom:0; z-index:2; grid-template-columns:1fr 1fr; gap:8px; margin:0 -2px -2px; padding:10px 2px calc(4px + env(safe-area-inset-bottom)); background:rgba(15, 23, 42, .98); box-shadow:0 -10px 18px rgba(15, 23, 42, .85); }
                            #translator-view .translator-speak-actions .btn { min-width: 0; height: 64px !important; padding: 8px !important; gap: 6px !important; font-size: .78rem !important; }
                            #translator-view .translator-speak-actions .btn > div { min-width: 0; }
                            #translator-view .translator-speak-actions .btn span:last-child { font-size: .78rem !important; white-space: nowrap; }
                            #translator-view #transSpeakChatLog { margin-bottom: 0 !important; padding-bottom: 12px !important; }
                        }
                        @keyframes pulse-red {
                            0% {
                                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                                transform: scale(1);
                            }
                            70% {
                                box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                                transform: scale(1.04);
                            }
                            100% {
                                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
                                transform: scale(1);
                            }
                        }
                    </style>

                    <script>
                        window.switchTranslatorMode = function(mode) {
                            const tabText = document.getElementById('tabTransText');
                            const tabSpeak = document.getElementById('tabTransSpeak');
                            const contentText = document.getElementById('contentTransText');
                            const contentSpeak = document.getElementById('contentTransSpeak');

                            if (!tabText || !tabSpeak || !contentText || !contentSpeak) return;

                            if (mode === 'text') {
                                tabText.classList.add('active');
                                tabSpeak.classList.remove('active');
                                contentText.hidden = false;
                                contentSpeak.hidden = true;
                                document.getElementById('translator-view')?.classList.remove('translator-speak-active');
                            } else {
                                tabText.classList.remove('active');
                                tabSpeak.classList.add('active');
                                contentText.hidden = true;
                                contentSpeak.hidden = false;
                                document.getElementById('translator-view')?.classList.add('translator-speak-active');
                                // Scroll to bottom of chat
                                setTimeout(() => {
                                    const chatLogEl = document.getElementById('transSpeakChatLog');
                                    if (chatLogEl) chatLogEl.scrollTop = chatLogEl.scrollHeight;
                                }, 50);
                            }
                        };
                    </script>

                    <div class="panel header-panel flex-between" style="border-left: 4px solid #38bdf8;">
                        <div>
                            <h2 style="color: #38bdf8;"><i class="fa-solid fa-language"></i> Penerjemah Bahasa Asing</h2>
                            <p class="text-muted mt-2">Penerjemah real-time untuk membantu teller / kasir berkomunikasi dengan nasabah mancanegara.</p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="tabTransText" class="translator-tab active" onclick="switchTranslatorMode('text')"><i class="fa-solid fa-keyboard"></i> Mode Teks</button>
                            <button id="tabTransSpeak" class="translator-tab" onclick="switchTranslatorMode('speak')"><i class="fa-solid fa-comments"></i> Mode Bicara (Percakapan)</button>
                        </div>
                    </div>

                    <!-- MODE TEKS CONTENT -->
                    <div id="contentTransText" class="panel mt-4 translator-mode">
                        <div class="translator-text-grid">
                            
                            <!-- Left Column: Source -->
                            <div style="display: flex; flex-direction: column; gap: 10px; background: rgba(30, 41, 59, 0.2); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <label style="font-weight: 700; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Bahasa Asal</label>
                                    <select id="transLangSource" onchange="saveTranslatorLanguages()" style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); color: #38bdf8; border-radius: 6px; padding: 4px 8px; font-size: 0.8rem; font-weight: 600; width: 140px;"></select>
                                </div>
                                <textarea id="transTextSource" oninput="debounceTranslate()" placeholder="Ketik kalimat di sini, atau klik tombol mikrofon di bawah untuk berbicara..." style="flex: 1; min-height: 150px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; color: #f8fafc; font-size: 0.95rem; resize: none; line-height: 1.5;"></textarea>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                                    <div style="display: flex; gap: 8px;">
                                        <button id="btnTransTextMic" onclick="toggleSpeechListen('btnTransTextMic', document.getElementById('transLangSource').value)" class="btn btn-sm btn-outline" style="border-radius: 50%; width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; border-color: rgba(255,255,255,0.15); color: #f8fafc;" title="Bicara ke Mikrofon"><i class="fa-solid fa-microphone"></i></button>
                                        <button onclick="speakSourceText()" class="btn btn-sm btn-outline" style="border-radius: 50%; width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; border-color: rgba(255,255,255,0.15); color: #38bdf8;" title="Dengarkan Suara Asal"><i class="fa-solid fa-volume-high"></i></button>
                                    </div>
                                    <button onclick="document.getElementById('transTextSource').value=''; translateTextMode();" class="btn btn-xs btn-outline" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2); background: transparent;">Hapus Teks</button>
                                </div>
                            </div>

                            <!-- Swap Button Column -->
                            <div class="translator-swap" style="display: flex; align-items: center; justify-content: center;">
                                <button onclick="swapTextLanguages()" class="btn" style="border-radius: 50%; width: 38px; height: 38px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); color: #38bdf8; cursor: pointer; transition: all 0.2s;" title="Tukar Bahasa"><i class="fa-solid fa-right-left"></i></button>
                            </div>

                            <!-- Right Column: Target -->
                            <div style="display: flex; flex-direction: column; gap: 10px; background: rgba(30, 41, 59, 0.2); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <label style="font-weight: 700; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Bahasa Terjemahan</label>
                                    <select id="transLangTarget" onchange="saveTranslatorLanguages()" style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); color: #38bdf8; border-radius: 6px; padding: 4px 8px; font-size: 0.8rem; font-weight: 600; width: 140px;"></select>
                                </div>
                                <textarea id="transTextTarget" readonly placeholder="Hasil terjemahan akan muncul di sini..." style="flex: 1; min-height: 150px; background: rgba(15, 23, 42, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; color: #f8fafc; font-size: 0.95rem; resize: none; line-height: 1.5; font-weight: 600;"></textarea>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="speakTargetText()" class="btn btn-sm btn-outline" style="border-radius: 50%; width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; border-color: rgba(255,255,255,0.15); color: #38bdf8;" title="Dengarkan Suara Terjemahan"><i class="fa-solid fa-volume-high"></i></button>
                                        <button onclick="navigator.clipboard.writeText(document.getElementById('transTextTarget').value); alert('Terjemahan berhasil disalin!');" class="btn btn-sm btn-outline" style="border-radius: 50%; width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; border-color: rgba(255,255,255,0.15); color: #94a3b8;" title="Salin ke Clipboard"><i class="fa-solid fa-copy"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Extra Options -->
                        <div class="mt-4 flex-between" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                            <label style="display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" id="transTextAutoPlay" checked style="width:16px; height:16px; cursor:pointer;">
                                Suarakan hasil terjemahan secara otomatis
                            </label>
                            <button onclick="translateTextMode()" class="btn btn-primary" style="background:#38bdf8; border:none; color:#0f172a; font-weight:bold; padding: 8px 24px;"><i class="fa-solid fa-language"></i> Terjemahkan Sekarang</button>
                        </div>
                    </div>

                    <!-- MODE BICARA/PERCAKAPAN CONTENT -->
                    <div id="contentTransSpeak" class="panel mt-4 translator-mode" hidden style="height: calc(100vh - 280px); min-height: 480px; max-height: 620px;">
                        <!-- Configuration Header -->
                        <div class="translator-speak-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; margin-bottom: 12px; gap: 15px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">Bahasa Asing Nasabah:</span>
                                <select id="transSpeakLangTarget" onchange="saveTranslatorLanguages()" style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); color: #EC4899; border-radius: 6px; padding: 4px 8px; font-size: 0.8rem; font-weight: 600; width: 180px;"></select>
                            </div>
                            <div style="display: flex; gap: 15px; align-items: center;">
                                <label style="display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 0.82rem; cursor: pointer; margin: 0;">
                                    <input type="checkbox" id="transSpeakAutoPlay" checked style="width:15px; height:15px; cursor:pointer;">
                                    Auto-Suara Terjemahan
                                </label>
                                <button onclick="clearTransChatLog()" class="btn btn-xs btn-outline" style="border-color: rgba(239, 68, 68, 0.25); color: #ef4444;"><i class="fa-solid fa-trash-can"></i> Hapus Obrolan</button>
                            </div>
                        </div>

                        <!-- Chat Bubbles Log Area -->
                        <div id="transSpeakChatLog" style="flex: 1; overflow-y: auto; padding: 10px; background: rgba(15, 23, 42, 0.3); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; margin-bottom: 15px; display: flex; flex-direction: column;">
                            <!-- Bubbles filled via JS -->
                        </div>

                        <!-- Large Mic Action Buttons -->
                        <div class="translator-speak-actions">
                            
                            <!-- Left: Kasir Mic -->
                            <button id="btnTransSpeakMicKasir" onclick="toggleSpeechListen('btnTransSpeakMicKasir', 'id-ID')" class="btn" style="height: 60px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); color: #38bdf8; font-weight: bold; border-radius: 12px; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: all 0.2s;">
                                <i class="fa-solid fa-microphone" style="font-size: 1.25rem;"></i>
                                <div style="text-align: left; line-height: 1.2;">
                                    <span style="display: block; font-size: 0.85rem; font-weight: normal; color: #94a3b8;">Kasir Berbicara</span>
                                    <span>Bahasa INDONESIA</span>
                                </div>
                            </button>

                            <!-- Right: Nasabah Mic -->
                            <button id="btnTransSpeakMicNasabah" onclick="toggleSpeechListen('btnTransSpeakMicNasabah', document.getElementById('transSpeakLangTarget').value)" class="btn" style="height: 60px; background: rgba(236, 72, 153, 0.1); border: 1px solid rgba(236, 72, 153, 0.25); color: #EC4899; font-weight: bold; border-radius: 12px; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: all 0.2s;">
                                <i class="fa-solid fa-microphone" style="font-size: 1.25rem;"></i>
                                <div style="text-align: left; line-height: 1.2;">
                                    <span style="display: block; font-size: 0.85rem; font-weight: normal; color: #94a3b8;">Nasabah Berbicara</span>
                                    <span>Bahasa ASING</span>
                                </div>
                            </button>

                        </div>
                    </div>
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

                <!-- Penyimpanan Berkas View -->
                <section id="documents-view" class="view-section hidden">
                    <style>
                        .folder-item {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 10px 12px;
                            border-radius: 6px;
                            color: #cbd5e1;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            background: rgba(30, 41, 59, 0.2);
                            border: 1px solid rgba(255, 255, 255, 0.03);
                        }
                        .folder-item:hover {
                            background: rgba(255, 255, 255, 0.05);
                            color: #f8fafc;
                        }
                        .folder-item.active {
                            background: rgba(245, 158, 11, 0.15);
                            border-color: rgba(245, 158, 11, 0.4);
                            color: #FBBF24;
                            font-weight: 600;
                        }
                        .folder-name-container {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                            flex: 1;
                        }
                        .folder-actions {
                            display: flex;
                            gap: 6px;
                            opacity: 0;
                            transition: opacity 0.2s ease;
                        }
                        .folder-item:hover .folder-actions {
                            opacity: 1;
                        }
                        .folder-action-btn {
                            background: none;
                            border: none;
                            color: #94a3b8;
                            cursor: pointer;
                            padding: 2px;
                            font-size: 0.85rem;
                            transition: color 0.1s ease;
                        }
                        .folder-action-btn:hover {
                            color: #f8fafc;
                        }
                        .folder-action-btn.delete:hover {
                            color: #ef4444;
                        }
                        .folder-action-btn.rename:hover {
                            color: #38bdf8;
                        }
                        .folder-action-btn.add:hover {
                            color: #10b981;
                        }
                    </style>

                    <div class="panel header-panel flex-between" style="border-left: 4px solid #FBBF24;">
                        <div>
                            <h2 style="color: #FBBF24;"><i class="fa-solid fa-folder-open"></i> Penyimpanan Berkas</h2>
                            <p class="text-muted mt-2">Penyimpanan berkas digital penting perusahaan (Perizinan, Sewa Gedung, Dokumen PT, PKS, dll).</p>
                        </div>
                        <div>
                            <button class="btn btn-warning" onclick="window.openDocumentFolderModal()" style="background:#F59E0B; color:white; border:none;"><i class="fa-solid fa-folder-plus"></i> Tambah Folder Baru</button>
                            <button class="btn btn-primary" onclick="window.openDocumentUploadModal()"><i class="fa-solid fa-upload"></i> Unggah Berkas Baru</button>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; margin-top: 20px; align-items: flex-start; flex-wrap: wrap;">
                        <!-- Kolom Kiri: Daftar Folder -->
                        <div class="panel" style="flex: 1; min-width: 250px; max-width: 320px; padding: 15px;">
                            <h3 style="color: #f8fafc; font-size: 1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-folder" style="color: #FBBF24;"></i> Daftar Folder
                            </h3>
                            <hr class="divider mb-3" style="border-color: rgba(255,255,255,0.06);">
                            
                            <div id="documentsFolderList" style="display: flex; flex-direction: column; gap: 6px;">
                                <!-- Daftar folder diisi via JS -->
                            </div>
                        </div>

                        <!-- Kolom Kanan: Daftar Berkas -->
                        <div class="panel" style="flex: 3; min-width: 500px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <h3 id="currentFolderNameHeader" style="color: #FBBF24; font-size: 1.2rem; margin: 0; display: flex; align-items: center; gap: 10px;">
                                        <i class="fa-solid fa-folder-open"></i> Memuat...
                                    </h3>
                                    <div id="currentFolderActionsArea">
                                        <!-- Tombol Aksi Folder Kustom diisi via JS -->
                                    </div>
                                </div>
                                
                                <!-- Pencarian -->
                                <div style="display: flex; gap: 10px; align-items: center; width: 100%; max-width: 350px;">
                                    <i class="fa-solid fa-search" style="color: #94A3B8;"></i>
                                    <input type="text" id="searchDocumentInput" class="form-control" placeholder="Cari nama berkas atau catatan..." oninput="window.renderDocumentsTable()" style="border-radius: 20px; padding: 6px 15px; font-size: 0.9rem;">
                                </div>
                            </div>

                            <div class="table-responsive">
                                <table class="table table-hover" id="documentsTable">
                                    <thead>
                                        <tr>
                                            <th style="width: 70px; text-align: center;">Format</th>
                                            <th>Nama Berkas</th>
                                            <th>Catatan / Keterangan</th>
                                            <th style="width: 100px;">Ukuran</th>
                                            <th style="width: 160px;">Tanggal Unggah</th>
                                            <th style="width: 180px; text-align: center;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="documentsTableBody">
                                        <tr>
                                            <td colspan="6" class="text-center text-muted">Memuat daftar berkas...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Chat AI View -->
                <section id="ai-chat-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #EC4899; background: rgba(30, 41, 59, 0.45); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 15px 20px; border-radius: 8px;">
                        <div>
                            <h2 style="color: #EC4899; display: flex; align-items: center; gap: 10px; margin: 0;"><i class="fa-solid fa-robot"></i> Tanya AI / Deteksi Gambar Valas</h2>
                            <span style="color: #64748b; font-size: 0.88rem; margin-top: 4px; display: block;">Asisten cerdas pendeteksi uang kertas, koin, dan tanya jawab finansial via Google Gemini API</span>
                        </div>
                    </div>

                    <div class="row mt-4" style="display: flex; gap: 20px; height: calc(100vh - 220px); min-height: 500px;">
                        <!-- Left Panel: Chat Sessions / History -->
                        <div class="col-md-3" style="width: 25%; display: flex; flex-direction: column; background: rgba(15, 23, 42, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; height: 100%;">
                            <div style="padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #f8fafc;">Riwayat Chat</h3>
                                <button class="btn btn-sm btn-primary" onclick="startNewChatSession()" style="padding: 4px 10px; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-plus"></i> Baru</button>
                            </div>
                            <div id="ai-chat-sessions-list" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                                <!-- Chat sessions list dynamically populated here -->
                            </div>
                        </div>

                        <!-- Right Panel: Conversation Room -->
                        <div class="col-md-9" style="width: 75%; display: flex; flex-direction: column; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; height: 100%; position: relative;">
                            <!-- Active Session Chat Box -->
                            <div id="ai-chat-messages-container" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; background: rgba(15, 23, 42, 0.15);">
                                <!-- Welcome screen / messages populated here -->
                            </div>

                            <!-- Image Preview Area (if uploading image) -->
                            <div id="ai-chat-image-preview-container" class="hidden" style="padding: 10px 20px; background: rgba(30, 41, 59, 0.8); border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div id="ai-chat-image-thumbnail" style="width: 50px; height: 50px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);"></div>
                                    <span style="font-size: 0.8rem; color: #cbd5e1;" id="ai-chat-image-name">gambar_valas.jpg</span>
                                </div>
                                <button onclick="removeChatUploadedImage()" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem;"><i class="fa-solid fa-circle-xmark"></i></button>
                            </div>

                            <!-- Quick Suggestion Chips -->
                            <div id="ai-chat-quick-suggestions" style="padding: 10px 20px 0; display: flex; gap: 8px; flex-wrap: wrap; background: rgba(15, 23, 42, 0.15);">
                                <button onclick="sendSuggestedPrompt('Bagaimana kondisi indeks saham (IHSG, Dow Jones, dll.) saat ini?')" class="btn btn-sm btn-outline" style="border-radius: 20px; font-size: 0.75rem; padding: 4px 12px; border-color: rgba(255,255,255,0.1); color: #cbd5e1; background: rgba(30, 41, 59, 0.3); cursor: pointer;"><i class="fa-solid fa-chart-line" style="color: #38bdf8; margin-right: 4px;"></i> Indeks Saham</button>
                                <button onclick="sendSuggestedPrompt('Berapa harga Bitcoin (BTC) terbaru dan bagaimana analisis pasarnya?')" class="btn btn-sm btn-outline" style="border-radius: 20px; font-size: 0.75rem; padding: 4px 12px; border-color: rgba(255,255,255,0.1); color: #cbd5e1; background: rgba(30, 41, 59, 0.3); cursor: pointer;"><i class="fa-brands fa-bitcoin" style="color: #f59e0b; margin-right: 4px;"></i> Bitcoin</button>
                                <button onclick="sendSuggestedPrompt('Berapa harga emas Logam Mulia (Antam) per gram hari ini?')" class="btn btn-sm btn-outline" style="border-radius: 20px; font-size: 0.75rem; padding: 4px 12px; border-color: rgba(255,255,255,0.1); color: #cbd5e1; background: rgba(30, 41, 59, 0.3); cursor: pointer;"><i class="fa-solid fa-coins" style="color: #eab308; margin-right: 4px;"></i> Emas LM (Antam)</button>
                                <button onclick="sendSuggestedPrompt('Berapa harga perak murni per gram hari ini dan prospeknya?')" class="btn btn-sm btn-outline" style="border-radius: 20px; font-size: 0.75rem; padding: 4px 12px; border-color: rgba(255,255,255,0.1); color: #cbd5e1; background: rgba(30, 41, 59, 0.3); cursor: pointer;"><i class="fa-solid fa-circle" style="color: #cbd5e1; margin-right: 4px;"></i> Perak</button>
                                <button onclick="sendSuggestedPrompt('Bagaimana kondisi dan tren analisis prospek kurs valas hari ini?')" class="btn btn-sm btn-outline" style="border-radius: 20px; font-size: 0.75rem; padding: 4px 12px; border-color: rgba(255,255,255,0.1); color: #cbd5e1; background: rgba(30, 41, 59, 0.3); cursor: pointer;"><i class="fa-solid fa-comments-dollar" style="color: #10b981; margin-right: 4px;"></i> Analisis Kurs</button>
                            </div>

                            <!-- Input Form Area -->
                            <div style="padding: 15px 20px; background: rgba(30, 41, 59, 0.5); border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; gap: 12px;">
                                <!-- Upload Image Button -->
                                <button onclick="triggerChatImageUpload()" class="btn btn-outline" style="padding: 10px 14px; border: 1px solid rgba(148, 163, 184, 0.3); background: rgba(15, 23, 42, 0.5); color: #EC4899; border-radius: 8px; cursor: pointer;" title="Unggah gambar mata uang untuk dideteksi"><i class="fa-solid fa-camera"></i></button>
                                <input type="file" id="ai-chat-image-input" accept="image/*" style="display: none;" onchange="handleChatImageUpload(this)">

                                <!-- Text Input -->
                                <input type="text" id="ai-chat-text-input" class="form-control" style="flex: 1; margin: 0; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.3); color: #f8fafc; border-radius: 8px; padding: 10px 15px;" placeholder="Ketik pesan atau upload gambar uang di sini..." onkeypress="handleChatEnter(event)">

                                <!-- Send Button -->
                                <button onclick="sendChatMessage()" class="btn btn-primary" style="padding: 10px 20px; background: #EC4899; border-color: #EC4899; color: #fff; border-radius: 8px; display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-paper-plane"></i> Kirim</button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Kurs Hari Ini (Internal Board & Calculator) -->
                <section id="kurs-hari-ini-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="flex-wrap: wrap; gap: 15px; background: rgba(30, 41, 59, 0.45); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 15px 20px; border-radius: 8px;">
                        <div>
                            <h2 style="color: #38bdf8; display: flex; align-items: center; gap: 10px; margin: 0;"><i class="fa-solid fa-money-bill-trend-up"></i> Kurs Hari Ini (Internal Only)</h2>
                            <span style="color: #64748b; font-size: 0.88rem; margin-top: 4px; display: block;">Lookup referensi kurs aktif untuk panduan teller/kasir</span>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center; min-width: 280px; flex: 1; justify-content: flex-end; flex-wrap: wrap;">
                            <button class="btn btn-outline" id="btnSelectAllKurs" onclick="window.selectAllKurs(true)" style="padding: 6px 12px; font-size: 0.8rem; border-color: #38bdf8; color: #38bdf8; height: 32px; display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-square-check"></i> Pilih Semua
                            </button>
                            <button class="btn btn-outline" id="btnDeselectAllKurs" onclick="window.selectAllKurs(false)" style="padding: 6px 12px; font-size: 0.8rem; border-color: #64748b; color: #94a3b8; height: 32px; display: none; align-items: center; gap: 6px;">
                                <i class="fa-regular fa-square"></i> Batal Pilih
                            </button>
                            <button class="btn btn-success" id="btnSendWaKurs" onclick="window.sendSelectedKursViaWa()" style="background:#25D366; color:white; border:none; padding: 6px 12px; font-size: 0.8rem; height: 32px; display: inline-flex; align-items: center; gap: 6px;" disabled>
                                <i class="fa-brands fa-whatsapp"></i> Kirim WA (<span id="selectedKursCount">0</span>)
                            </button>
                            <div style="position: relative; width: 100%; max-width: 240px;">
                                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none;"></i>
                                <input type="text" id="searchKursHariIni" class="form-control" placeholder="Cari Kode ISO..." style="width: 100%; padding-left: 36px; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; font-size: 0.85rem; height: 32px;" oninput="window.filterKursHariIni()">
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap;">
                        <!-- Left Side: Rates Board Grid -->
                        <div style="flex: 3; min-width: 500px; display: flex; flex-direction: column; gap: 20px;">
                            <div class="panel" style="background: #1e293b; border-radius: 8px; padding: 15px; border: 1px solid rgba(255,255,255,0.04); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
                                <div id="kursHariIniContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 10px;">
                                    <!-- Injected dynamically by JS -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right Side: Quick Calculator Tool -->
                        <div style="flex: 1.2; min-width: 320px;">
                            <div class="panel" style="background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 20px; position: -webkit-sticky; position: sticky; top: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                                <h3 style="color: #38bdf8; display: flex; align-items: center; gap: 8px; margin-top: 0; margin-bottom: 15px;"><i class="fa-solid fa-calculator"></i> Kalkulator Kurs Cepat</h3>
                                <hr class="divider mb-4" style="border-color: rgba(255,255,255,0.08);">
                                
                                <div class="form-group mb-3">
                                    <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Pilih Valas</label>
                                    <select id="calcKursValuta" class="form-control" style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; width:100%;" onchange="window.calculateQuickRate()"></select>
                                </div>
                                
                                <div class="form-group mb-3">
                                    <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Jenis Transaksi</label>
                                    <select id="calcKursTipe" class="form-control" style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; width:100%;" onchange="window.calculateQuickRate()">
                                        <option value="beli">Nasabah Jual ke Kita (Kita BELI)</option>
                                        <option value="jual">Nasabah Beli dari Kita (Kita JUAL)</option>
                                    </select>
                                </div>
                                
                                <div class="form-group mb-3">
                                    <label style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 6px; display: block;">Jumlah Valas</label>
                                    <input type="number" id="calcKursAmount" class="form-control" value="1" min="0" step="any" style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px;" oninput="window.calculateQuickRate()">
                                </div>
                                
                                <div class="form-group mb-3" style="background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 8px; border: 1px solid #334155;">
                                    <span style="color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Nilai Kurs Acuan</span>
                                    <div id="calcKursRateLabel" style="font-size: 1.4rem; font-weight: bold; color: #f8fafc; margin-top: 4px;">Rp 0</div>
                                </div>
                                
                                <div class="form-group mb-0" style="background: rgba(56, 189, 248, 0.08); padding: 15px; border-radius: 8px; border: 1px dashed rgba(56, 189, 248, 0.4);">
                                    <span style="color: #38bdf8; font-size: 0.8rem; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Hasil Konversi (IDR)</span>
                                    <div id="calcKursTotalLabel" style="font-size: 1.8rem; font-weight: bold; color: #10B981; margin-top: 6px;">Rp 0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


                <!-- Currency Rate View -->
                <section id="currency-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="flex-wrap: wrap; gap: 10px;">
                        <h2>Manajemen Kurs Valuta</h2>
                        <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
                            <input type="file" id="batchRateInput" class="form-control" accept=".xlsx, .xls, .csv" style="max-width: 250px;">
                            <button class="btn btn-success" onclick="uploadBatchRates()"><i class="fa-solid fa-upload"></i> Update via Excel</button>
                            <button class="btn btn-outline" onclick="syncSmartdealRates(event)" style="border-color: #f59e0b; color: #fbbf24;"><i class="fa-solid fa-globe"></i> Sync Smartdeal</button>
                            <button class="btn btn-primary" onclick="openCurrencyModal()"><i class="fa-solid fa-plus"></i> Tambah Valuta</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div style="margin-bottom: 12px; padding: 10px 12px; border-left: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.08); color: #f8fafc; font-size: 0.9rem;">
                            <strong>Catatan Sync Smartdeal:</strong> saat tombol sync dijalankan, kolom <strong>margin/selisih point</strong> tetap dipertahankan. Sistem hanya memperbarui kurs dasar dari Smartdeal, lalu menghitung ulang <strong>Kurs Beli</strong> dan <strong>Kurs Jual</strong> final secara otomatis.
                        </div>
                        <div id="smartdealSyncStatus" style="margin-bottom: 12px; padding: 10px 12px; border-left: 3px solid #64748b; background: rgba(15, 23, 42, 0.45); color: #cbd5e1; font-size: 0.88rem;">
                            <strong>Status Sync Smartdeal:</strong> Belum ada riwayat sync.
                        </div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Kode</th>
                                        <th>Trend</th>
                                        <th>Kurs Beli</th>
                                        <th>Kurs Jual</th>
                                        <th>Stok Saat Ini</th>
                                        <th>Batas Aman (Alert)</th>
                                        <th>Margin (Rp)</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="currenciesTableBody">
                                    <!-- Injected by JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Global API Integration -->
                    <div class="panel mt-4" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(59, 130, 246, 0.3);">
                        <div class="flex-between mb-3">
                            <h3 style="margin: 0; color: #60A5FA;"><i class="fa-solid fa-globe"></i> Referensi Kurs Global (Mid-Market)</h3>
                            <button class="btn btn-sm btn-outline" onclick="fetchGlobalRates()"><i class="fa-solid fa-rotate-right"></i> Perbarui</button>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-sm table-bordered" style="color: #cbd5e1; font-size: 0.9rem;">
                                <thead>
                                    <tr style="background: rgba(15, 23, 42, 0.8);">
                                        <th>Mata Uang</th>
                                        <th class="text-end">Kurs Tengah (Rp)</th>
                                        <th class="text-end">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="globalRatesTableBody">
                                    <tr>
                                        <td colspan="3" class="text-center text-muted">Klik 'Perbarui' untuk mengambil data konversi global secara live...</td>
                                    </tr>
                                </tbody>
                            </table>
                            <small class="text-muted mt-2 d-block">*Data diambil secara live dari Open ExchangeRate-API (Mid-Market Rate). Gunakan ini hanya sebagai acuan tren nilai tukar dunia hari ini.</small>
                        </div>
                    </div>
                </section>

                <!-- Old Money View -->
                <section id="old-money-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #F59E0B;">
                        <div>
                            <h2 style="color: #FBBF24;"><i class="fa-solid fa-coins"></i> Koin Asing & Uang Kertas Lama</h2>
                            <p class="text-muted mt-2">Pencatatan 100% terisolasi dari kasir dan pembukuan utama.</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <button class="btn btn-warning" data-role-special="oldMoneySupplierManagement" onclick="openOldMoneySupplierModal()" style="background: #D97706; color: white; border: none;"><i class="fa-solid fa-users"></i> Master Suplayer/Pengepul</button>
                            <button class="btn btn-primary" onclick="openOldMoneyItemModal()"><i class="fa-solid fa-plus"></i> Tambah Item Koin / Uang</button>
                        </div>
                    </div>

                    <div class="stats-grid mt-4" style="grid-template-columns: repeat(3, 1fr);">
                        <div class="stat-card" style="border-left: 4px solid #F59E0B; background: rgba(245, 158, 11, 0.1);">
                            <div class="stat-icon" style="color:#F59E0B;"><i class="fa-solid fa-wallet"></i></div>
                            <div class="stat-details">
                                <h3>Total Kas Rupiah (Khusus Koin)</h3>
                                <p class="stat-value" id="oldMoneyCashTotal" style="color:#F59E0B;">Rp 0</p>
                                <button class="btn btn-sm btn-outline mt-2" onclick="openOldMoneyTopupModal()"><i class="fa-solid fa-money-bill-transfer"></i> Topup / Tarik Modal</button>
                            </div>
                        </div>
                        <div class="stat-card" style="border-left: 4px solid #10B981; background: rgba(16, 185, 137, 0.1);">
                            <div class="stat-icon text-green"><i class="fa-solid fa-sack-dollar"></i></div>
                            <div class="stat-details">
                                <h3>Total Valuasi Stok (Modal)</h3>
                                <p class="stat-value text-green" id="oldMoneyStockValuation">Rp 0</p>
                            </div>
                        </div>
                        <div class="stat-card" style="border-left: 4px solid #3B82F6; background: rgba(59, 130, 246, 0.1);">
                            <div class="stat-icon" style="color:#3B82F6;"><i class="fa-solid fa-chart-line"></i></div>
                            <div class="stat-details">
                                <h3>Laba Koin Terkumpul</h3>
                                <p class="stat-value" id="oldMoneyTotalProfit" style="color:#3B82F6;">Rp 0</p>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-content mt-4" style="grid-template-columns: 1fr 1fr;">
                        <!-- Transaction Form -->
                        <div class="panel">
                            <h3><i class="fa-solid fa-cash-register"></i> Transaksi Koin / Uang Lama</h3>
                            <hr class="divider">
                            <div class="form-group row">
                                <div class="col-md-6">
                                    <label>Kategori Transaksi</label>
                                    <select id="oldMoneyTrxCategory" class="form-control" onchange="window.handleOldMoneyCategoryChange()">
                                        <option value="KOIN">Koin</option>
                                        <option value="UANG_LAMA">Uang Lama</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label>Tipe Transaksi</label>
                                    <select id="oldMoneyTrxType" class="form-control" onchange="autoFillOldMoneyKurs()">
                                        <option value="BELI">BELI (Uang Kas Keluar)</option>
                                        <option value="JUAL">JUAL (Uang Kas Masuk)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group row">
                                <div class="col">
                                    <label>Nasabah (Pelanggan)</label>
                                    <select id="oldMoneyCustomer" class="form-control">
                                        <option value="-">-- Pengunjung Biasa --</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <small class="text-muted d-block" id="oldMoneyCategoryHint">Mode Koin aktif. Item dan hitungan akan mengikuti kategori ini.</small>
                            </div>
                            <div class="form-group row">
                                <div class="col mb-3">
                                    <label>Pilih Item</label>
                                    <select id="oldMoneyItem" class="form-control" onchange="autoFillOldMoneyKurs()">
                                        <option value="">-- Kosong --</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group row">
                                <input type="hidden" id="oldMoneyDenom" value="1">
                                <div class="col">
                                    <label id="oldMoneyQtyLabel">Keping/Lembar</label>
                                    <input type="number" id="oldMoneyQty" class="form-control" placeholder="0" oninput="calculateOldMoneyForm()">
                                </div>
                                <div class="col">
                                    <label id="oldMoneyValasLabel">Jumlah Valas</label>
                                    <input type="text" id="oldMoneyValas" class="form-control" placeholder="0" inputmode="decimal" onfocus="window.handleOldMoneyMoneyFocus(this)" oninput="window.handleOldMoneyMoneyTyping(this)" onblur="window.handleOldMoneyMoneyBlur(this, 'valas')">
                                </div>
                            </div>
                            <div class="form-group row mt-3">
                                <div class="col">
                                    <label>Kurs (Rp/Valas)</label>
                                    <input type="text" id="oldMoneyKurs" class="form-control" placeholder="Manual/Auto" inputmode="decimal" onfocus="window.handleOldMoneyMoneyFocus(this)" oninput="window.handleOldMoneyMoneyTyping(this)" onblur="window.handleOldMoneyMoneyBlur(this, 'rate')">
                                    <small class="text-muted" id="oldMoneyKursHint">Kurs Master: -</small>
                                </div>
                                <div class="col">
                                    <label>Total Rupiah (Jumlah Rp)</label>
                                    <input type="text" id="oldMoneyTotalRp" class="form-control" placeholder="0" inputmode="numeric" onfocus="window.handleOldMoneyMoneyFocus(this)" oninput="window.handleOldMoneyMoneyTyping(this)" onblur="window.handleOldMoneyMoneyBlur(this, 'idr')">
                                </div>
                            </div>
                            <div class="form-group">
                                <small class="text-muted" id="oldMoneyPriceHint">Saran Harga Beli Master (jika ada): -</small>
                            </div>
                            <button class="btn btn-outline btn-block mt-3" onclick="addToOldMoneyCart()"><i class="fa-solid fa-cart-plus"></i> Tambah ke Keranjang</button>

                            <hr class="divider mt-4">

                            <h3><i class="fa-solid fa-shopping-cart"></i> Keranjang Koin</h3>
                            <div class="cart-box" id="oldMoneyCartContainer" style="background: rgba(15, 23, 42, 0.6); padding: 10px; border-radius: 8px; min-height: 50px;">
                                <div style="text-align: center; color: #94A3B8; padding: 10px;">Keranjang Kosong</div>
                            </div>

                            <div class="summary-total mt-3 mb-3">
                                <span>Grand Total Rupiah</span>
                                <h3 id="oldMoneyGrandTotalIdr" class="text-green" style="margin: 0; font-size: 1.5rem;">Rp 0</h3>
                            </div>

                            <button class="btn btn-primary btn-block btn-lg" id="btnOldMoneyCheckout" onclick="processOldMoneyCheckout()" disabled><i class="fa-solid fa-check-double"></i> Checkout & Cetak Struk</button>
                        </div>

                        <!-- Stock Table -->
                        <div class="panel">
                            <h3><i class="fa-solid fa-boxes-stacked"></i> Stok Tersedia</h3>
                            <hr class="divider">
                            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
                                <div style="display:flex; gap:8px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.15); padding: 6px; border-radius: 999px;">
                                    <button type="button" id="oldMoneyStockTabKoin" class="btn btn-sm" onclick="window.setOldMoneyStockCategory('KOIN')" style="background:#f59e0b; color:#0f172a; border:none; border-radius:999px; padding:6px 14px;">Stok Koin</button>
                                    <button type="button" id="oldMoneyStockTabUangLama" class="btn btn-sm" onclick="window.setOldMoneyStockCategory('UANG_LAMA')" style="background:transparent; color:#cbd5e1; border:none; border-radius:999px; padding:6px 14px;">Stok Uang Lama</button>
                                </div>
                                <input type="text" id="oldMoneyStockSearch" class="form-control" placeholder="Cari kode / nama item..." oninput="window.loadOldMoneyStockTable()" style="max-width: 260px;">
                            </div>
                            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-sm old-money-stock-table">
                                    <colgroup>
                                        <col style="width: 29%;">
                                        <col style="width: 11%;">
                                        <col style="width: 15%;">
                                        <col style="width: 15%;">
                                        <col style="width: 20%;">
                                        <col style="width: 10%;">
                                    </colgroup>
                                    <thead style="position: sticky; top: 0; background: #1e293b; z-index: 1;">
                                        <tr>
                                            <th>Valas</th>
                                            <th style="text-align: right;">Stok Koin<br><small style="color:#94a3b8; font-weight: 400;">Jml keping</small></th>
                                            <th style="text-align: right;">Stok Valas<br><small style="color:#94a3b8; font-weight: 400;">Nilai nominal</small></th>
                                            <th style="text-align: right;">Kurs Rata-rata<br><small style="color:#94a3b8; font-weight: 400;">Rp per valas</small></th>
                                            <th style="text-align: right;">Jumlah Rp<br><small style="color:#94a3b8; font-weight: 400;">Valas x kurs</small></th>
                                            <th style="text-align: center;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="oldMoneyStockTableBody">
                                        <!-- Injected -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Transaction History -->
                    <div class="panel mt-4">
                        <div class="flex-between mb-2">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <h3><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Transaksi Modul Ini</h3>
                                <div style="display: flex; align-items: center; gap: 5px; margin-left: 15px;">
                                    <input type="text" id="oldMoneyFilterText" class="form-control" placeholder="Cari ID, Nama, Item, Tipe..." style="width: 200px; padding: 2px 8px; font-size: 0.85rem;">
                                    <input type="date" id="oldMoneyFilterStart" class="form-control" style="width: 130px; padding: 2px 5px; font-size: 0.85rem;">
                                    <span style="color: #64748b; font-size: 0.85rem;">s/d</span>
                                    <input type="date" id="oldMoneyFilterEnd" class="form-control" style="width: 130px; padding: 2px 5px; font-size: 0.85rem;">
                                    <button class="btn btn-sm btn-primary" onclick="loadOldMoneyTrxTable()" style="padding: 2px 10px;"><i class="fa-solid fa-search"></i> Cari</button>
                                </div>
                                <div id="oldMoneySelectedCount" style="margin-left: 12px; color: #94a3b8; font-size: 0.8rem;">0 dipilih</div>
                            </div>
                            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:flex-end;">
                                <button class="btn btn-sm btn-outline" onclick="window.setOldMoneyTrxSelectionAll(true)"><i class="fa-solid fa-check-double"></i> Pilih Semua</button>
                                <button class="btn btn-sm btn-outline" onclick="window.clearOldMoneyTrxSelection()"><i class="fa-solid fa-xmark"></i> Batal Pilih</button>
                                <button class="btn btn-sm btn-danger" onclick="window.deleteSelectedOldMoneyTransactions()"><i class="fa-solid fa-trash"></i> Hapus Pilihan</button>
                                <button class="btn btn-sm btn-danger" onclick="window.deleteAllOldMoneyTransactions()"><i class="fa-solid fa-trash-can"></i> Hapus Semua</button>
                                <button class="btn btn-sm btn-secondary" onclick="exportTableToExcel('oldMoneyTrxTable', 'Riwayat_Koin_Uang_Lama')"><i class="fa-solid fa-file-excel"></i> Export CSV</button>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-sm" id="oldMoneyTrxTable">
                                <thead>
                                    <tr>
                                        <th style="text-align:center; width: 38px;"><i class="fa-solid fa-square-check"></i></th>
                                        <th>Waktu</th>
                                        <th>ID Trx</th>
                                        <th>Tipe</th>
                                        <th>Item</th>
                                        <th style="text-align: right;">Qty</th>
                                        <th style="text-align: right;">Total Rp</th>
                                        <th>Pihak / Suplayer</th>
                                        <th style="text-align: center;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="oldMoneyTrxTableBody">
                                    <!-- Injected -->
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                            <button class="btn btn-warning" onclick="restoreTransactionsFromRwt()" title="Pulihkan transaksi yang hilang dari RWT/Audit"><i class="fa-solid fa-rotate-left"></i> Pulihkan dari RWT</button>
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

                <!-- RWT View -->
                <section id="audit-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #ef4444;">
                        <div>
                            <h2 class="text-red"><i class="fa-solid fa-shield-halved"></i> RWT</h2>
                            <p class="text-muted mt-2">Ringkasan riwayat transaksi untuk tindak lanjut operasional dan kontrol internal.</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <button class="btn btn-primary" onclick="loadAuditTable()"><i class="fa-solid fa-rotate-right"></i> Refresh Data</button>
                            <button class="btn btn-secondary" onclick="exportTableToExcel('auditTable', 'Data_RWT')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div class="filter-controls">
                            <!-- Row 1: 5 Kategori -->
                            <div class="form-group row mb-2">
                                <div class="col">
                                    <label>Cari Invoice</label>
                                    <input type="text" id="filterAuditInvoice" class="form-control" placeholder="No. Invoice" oninput="filterAuditTable()">
                                </div>
                                <div class="col">
                                    <label>Ketik Nama</label>
                                    <input type="text" id="filterAuditNama" class="form-control" placeholder="Nama Nasabah" oninput="filterAuditTable()">
                                </div>
                                <div class="col">
                                    <label>Ketik No HP</label>
                                    <input type="text" id="filterAuditHp" class="form-control" placeholder="No Tlp/HP" oninput="filterAuditTable()">
                                </div>
                                <div class="col">
                                    <label>Mata Uang</label>
                                    <select id="filterAuditValuta" class="form-control" onchange="filterAuditTable()">
                                        <option value="">-- Semua --</option>
                                    </select>
                                </div>
                                <div class="col">
                                    <label>Tipe Transaksi</label>
                                    <select id="filterAuditTipe" class="form-control" onchange="filterAuditTable()">
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
                                    <input type="date" id="auditStartDate" class="form-control" onchange="filterAuditTable()">
                                </div>
                                <div class="col-md-4">
                                    <label>Sampai Tanggal</label>
                                    <input type="date" id="auditEndDate" class="form-control" onchange="filterAuditTable()">
                                </div>
                                <div class="col-md-4" style="display: flex; align-items: flex-end; gap: 10px;">
                                    <button class="btn btn-secondary" style="flex: 2;" onclick="loadAuditTable()">Tampilkan RWT</button>
                                    <button class="btn btn-outline" style="flex: 1; border: 1px solid #ef4444; color: #ef4444;" onclick="window.resetAuditFilter()">Reset</button>
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table table-bordered table-sm" id="auditTable">
                                <thead style="background: rgba(239, 68, 68, 0.1);">
                                        <th>Tanggal/Waktu</th>
                                        <th>No. Invoice</th>
                                        <th>Tipe</th>
                                        <th>Nasabah</th>
                                        <th>Valuta</th>
                                        <th>Catatan</th>
                                        <th class="text-end">Nominal Valuta</th>
                                        <th class="text-end">Kurs/Rate</th>
                                        <th class="text-end">Total IDR</th>
                                        <th style="text-align: center;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="auditTableBody">
                                    <tr><td colspan="10" class="text-center text-muted">Memuat data RWT...</td></tr>
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

                <!-- HRIS View -->
                <section id="hris-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #6366f1;">
                        <div>
                            <h2 style="color: #6366f1;"><i class="fa-solid fa-users-gear"></i> HRIS (Karyawan & Gaji)</h2>
                            <p class="text-muted mt-2">Kelola Data Karyawan, Absensi Harian, Kasbon, dan Slip Gaji.</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <button class="btn btn-primary hris-manage-only" onclick="openHrisEmployeeModal()" style="background: #4f46e5; border-color: #4f46e5;"><i class="fa-solid fa-user-plus"></i> Tambah Karyawan</button>
                        </div>
                    </div>

                    <div class="panel mt-4" style="padding: 0; background: transparent; border: none; box-shadow: none;">
                        <div class="hris-tabs" style="display: flex; gap: 10px; border-bottom: 2px solid #334155; padding-bottom: 10px; overflow-x: auto;">
                            <button class="btn btn-primary btn-sm hris-tab-btn active hris-manage-only" id="btn-tab-hris-emp" onclick="switchHrisTab('emp')"><i class="fa-solid fa-users"></i> Data Karyawan</button>
                            <button class="btn btn-outline btn-sm hris-tab-btn hris-manage-only" id="btn-tab-hris-att" onclick="switchHrisTab('att')"><i class="fa-solid fa-clock"></i> Absensi (Clock In/Out)</button>
                            <button class="btn btn-outline btn-sm hris-tab-btn" id="btn-tab-hris-leave" onclick="switchHrisTab('leave')"><i class="fa-solid fa-calendar-alt"></i> Shift & Cuti</button>
                            <button class="btn btn-outline btn-sm hris-tab-btn hris-manage-only" id="btn-tab-hris-kasbon" onclick="switchHrisTab('kasbon')"><i class="fa-solid fa-hand-holding-dollar"></i> Kasbon & Hutang</button>
                            <button class="btn btn-outline btn-sm hris-tab-btn hris-manage-only" id="btn-tab-hris-bpjs" onclick="switchHrisTab('bpjs')"><i class="fa-solid fa-heart-pulse"></i> BPJS (Kes & TK)</button>
                            <button class="btn btn-outline btn-sm hris-tab-btn hris-manage-only" id="btn-tab-hris-payroll" onclick="switchHrisTab('payroll')"><i class="fa-solid fa-file-invoice-dollar"></i> Penggajian (Payroll)</button>
                        </div>
                    </div>

                    <div class="hris-content-area mt-3">
                        <!-- TAB: EMPLOYEE -->
                        <div id="hris-tab-emp" class="hris-tab-content">
                            <div class="panel">
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>ID/NIK</th>
                                                <th>Nama Karyawan</th>
                                                <th>Jabatan</th>
                                                <th style="text-align: right;">Gaji Pkk & UM</th>
                                                <th>Catatan</th>
                                                <th style="text-align: center;">Status</th>
                                                <th style="text-align: center;">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody id="hrisEmpTableBody">
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: ATTENDANCE -->
                        <div id="hris-tab-att" class="hris-tab-content hidden" style="display:none;">
                            <div class="row" style="display: flex; flex-wrap: wrap; gap: 20px;">
                                <!-- Form Absen Kiri -->
                                <div class="col" style="flex: 1; min-width: 300px;">
                                    <div class="panel text-center" style="background: rgba(30, 41, 59, 0.8);">
                                        <h3 class="mb-3" style="color: #60A5FA;">Absensi Shift Hari Ini</h3>
                                        <div class="live-clock mb-4" id="hrisLiveClock" style="font-size: 2.5rem; color: #f8fafc;">12:00:00</div>
                                        
                                        <select id="hrisAttEmpSelect" class="form-control mb-3">
                                            <option value="">-- Pilih Nama Anda --</option>
                                        </select>
                                        <input type="password" id="hrisAttPin" class="form-control mb-3 text-center" placeholder="PIN Absen (4 digit)" maxlength="4" style="font-size: 1.5rem; letter-spacing: 5px;">
                                        
                                        <div style="display: flex; gap: 10px; justify-content: center;">
                                            <button class="btn btn-primary btn-lg" style="background: #10B981; border: none; width: 140px;" onclick="processHrisAttendance('IN')"><i class="fa-solid fa-right-to-bracket"></i> CLOCK IN</button>
                                            <button class="btn btn-danger btn-lg" style="width: 140px;" onclick="processHrisAttendance('OUT')"><i class="fa-solid fa-right-from-bracket"></i> CLOCK OUT</button>
                                        </div>
                                    </div>
                                </div>
                                <!-- Tabel Hari Ini Kanan -->
                                <div class="col" style="flex: 2; min-width: 400px;">
                                    <div class="panel">
                                        <div class="flex-between mb-3">
                                            <h3 style="margin:0;"><i class="fa-solid fa-calendar-day"></i> Log Absen Hari Ini</h3>
                                            <input type="date" id="hrisAttDateFilter" class="form-control form-control-sm" style="max-width: 150px;" onchange="renderHrisAttendanceTable()">
                                        </div>
                                        <div class="table-responsive">
                                            <table class="table table-sm text-center">
                                                <thead>
                                                    <tr>
                                                        <th style="text-align:left;">Nama</th>
                                                        <th>Clock IN</th>
                                                        <th>Clock OUT</th>
                                                        <th>Status</th>
                                                        <th>Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="hrisAttTableBody">
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: LEAVE & SCHEDULE -->
                        <div id="hris-tab-leave" class="hris-tab-content hidden" style="display:none;">
                            <div class="panel">
                                <div class="flex-between mb-3" style="gap:12px; flex-wrap:wrap;">
                                    <div>
                                        <h3 style="margin:0;"><i class="fa-solid fa-calendar-days"></i> Kalender Schedule Bulanan</h3>
                                        <small class="text-muted">Tampilan ringkas untuk view dan print jadwal kerja, cuti, izin, sakit, dan libur shift.</small>
                                    </div>
                                    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:end;">
                                        <div>
                                            <label style="font-size:0.78rem;">Bulan</label>
                                            <input type="month" id="hrisScheduleMonth" class="form-control" onchange="renderHrisScheduleCalendar()" style="width:150px;">
                                        </div>
                                        <div>
                                            <label style="font-size:0.78rem;">Karyawan</label>
                                            <select id="hrisScheduleEmployee" class="form-control" onchange="renderHrisScheduleCalendar()" style="width:190px;">
                                                <option value="ALL">Semua Karyawan</option>
                                            </select>
                                        </div>
                                        <button class="btn btn-primary" onclick="openHrisScheduleCalendarView()"><i class="fa-solid fa-up-right-from-square"></i> View Jadwal</button>
                                        <button class="btn btn-success" onclick="downloadHrisScheduleCalendarJpeg()"><i class="fa-solid fa-image"></i> Download JPEG</button>
                                        <button class="btn btn-secondary" onclick="printHrisScheduleCalendar()"><i class="fa-solid fa-print"></i> Print Jadwal</button>
                                    </div>
                                </div>
                                <div class="hris-schedule-legend mb-3">
                                    <span><b class="sch sch-p">P</b> Shift/Jadwal</span>
                                    <span><b class="sch sch-shift-s">S</b> Shift Siang</span>
                                    <span><b class="sch sch-midle">M</b> Shift Midle</span>
                                    <span><b class="sch sch-o">O</b> Off</span>
                                    <span><b class="sch sch-c">C</b> Cuti</span>
                                    <span><b class="sch sch-i">I</b> Izin</span>
                                    <span><b class="sch sch-s">S</b> Sakit</span>
                                </div>
                                <div class="table-responsive hris-schedule-wrap">
                                    <table class="table table-sm hris-schedule-table" id="hrisScheduleCalendarTable">
                                        <thead id="hrisScheduleCalendarHead"></thead>
                                        <tbody id="hrisScheduleCalendarBody"></tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="panel hris-manage-only" id="hrisScheduleManagePanel">
                                <div class="flex-between mb-3">
                                    <h3 style="margin:0;"><i class="fa-solid fa-calendar-alt"></i> Schedule, Shift & Cuti</h3>
                                    <button class="btn btn-primary btn-sm" onclick="openHrisLeaveModal()"><i class="fa-solid fa-plus"></i> Tambah Schedule/Cuti</button>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Nama Karyawan</th>
                                                <th>Tanggal Mulai</th>
                                                <th>Tanggal Selesai</th>
                                                <th>Jam / Schedule</th>
                                                <th style="text-align:center;">Jenis Tipe</th>
                                                <th>Keterangan / Alasan</th>
                                                <th style="text-align:center;">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody id="hrisLeaveTableBody">
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: KASBON -->
                        <div id="hris-tab-kasbon" class="hris-tab-content hidden" style="display:none;">
                            <div class="panel">
                                <div class="flex-between mb-3">
                                    <h3 style="margin:0;"><i class="fa-solid fa-hand-holding-dollar"></i> Catatan Kasbon / Pinjaman</h3>
                                    <button class="btn btn-primary btn-sm" onclick="openHrisKasbonModal()"><i class="fa-solid fa-plus"></i> Mutasi Kasbon</button>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Tanggal</th>
                                                <th>Nama Karyawan</th>
                                                <th style="text-align:center;">Tipe (Pinjam/Cicil)</th>
                                                <th>Keterangan</th>
                                                <th style="text-align: right;">Nominal Mutasi (Rp)</th>
                                                <th style="text-align: right;">Sisa Hutang Saat Ini</th>
                                            </tr>
                                        </thead>
                                        <tbody id="hrisKasbonTableBody">
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: BPJS -->
                        <div id="hris-tab-bpjs" class="hris-tab-content hidden" style="display:none;">
                            <div class="panel">
                                <div class="flex-between mb-3">
                                    <h3 style="margin:0;"><i class="fa-solid fa-heart-pulse"></i> Data Potongan BPJS</h3>
                                    <button class="btn btn-primary btn-sm" onclick="openHrisBpjsModal()"><i class="fa-solid fa-pen"></i> Update Master BPJS</button>
                                </div>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>NIK</th>
                                                <th>Nama Karyawan</th>
                                                <th style="text-align: right;">Pot. Kesehatan (1%)</th>
                                                <th style="text-align: right;">Pot. Ketenagakerjaan (2%)</th>
                                                <th style="text-align: right;">Total Potongan BPJS</th>
                                            </tr>
                                        </thead>
                                        <tbody id="hrisBpjsTableBody">
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: PAYROLL -->
                        <div id="hris-tab-payroll" class="hris-tab-content hidden" style="display:none;">
                            <div class="panel">
                                <div class="row align-items-end mb-4" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                    <div class="col" style="flex: 1; min-width: 200px;">
                                        <label>Pilih Karyawan</label>
                                        <select id="hrisPayrollEmp" class="form-control"></select>
                                    </div>
                                    <div class="col" style="flex: 1; min-width: 150px;">
                                        <label>Bulan Cicilan/Gaji</label>
                                        <input type="month" id="hrisPayrollMonth" class="form-control">
                                    </div>
                                    <div class="col" style="flex: 1; min-width: 200px;">
                                        <button class="btn btn-primary btn-block" onclick="generateHrisPayroll()"><i class="fa-solid fa-calculator"></i> Kalkulasi Gaji</button>
                                    </div>
                                </div>

                                <div id="hrisPayrollResult" class="hidden" style="display:none; border: 1px solid #334155; border-radius: 8px; padding: 20px; background: rgba(15, 23, 42, 0.4);">
                                    <div class="flex-between mb-4 border-bottom pb-2">
                                        <h3 style="color: #60A5FA; margin:0;">Ringkasan Slip Gaji <span id="lblPayTitle" style="color:#f8fafc; font-weight:normal;"></span></h3>
                                        <button class="btn btn-sm btn-outline" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak Tampilan (PDF/Kertas)</button>
                                    </div>
                                    
                                    <div class="row" style="display: flex; gap: 30px; flex-wrap: wrap;">
                                        <div class="col" style="flex: 1; min-width: 300px;">
                                            <table class="table table-sm table-borderless">
                                                <tbody>
                                                    <tr><td style="width: 180px;"><strong>Nama Karyawan</strong></td><td style="width:10px;">:</td><td id="lblPayName">-</td></tr>
                                                    <tr><td><strong>Jabatan</strong></td><td>:</td><td id="lblPayRole">-</td></tr>
                                                    <tr><td><strong>Total Hari / Kehadiran</strong></td><td>:</td><td><strong id="lblPayDays" style="color: #10B981;">0 Hari</strong></td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <div class="col" style="flex: 1; min-width: 300px;">
                                            <table class="table table-sm table-bordered">
                                                <tbody style="font-family: monospace; font-size: 1rem;">
                                                    <tr><td>(+) Gaji Pokok</td><td style="text-align: right;" id="valPayBasic">Rp 0</td></tr>
                                                    <tr><td>(+) Uang Makan (Total)</td><td style="text-align: right;" id="valPayFood">Rp 0</td></tr>
                                                    <tr><td>(-) Potongan Kasbon Bln Ini</td><td style="text-align: right; color: #ef4444;" id="valPayKasbon">Rp 0</td></tr>
                                                    <tr style="background: rgba(16,185,137,0.2); font-weight: bold;">
                                                        <td>TOTAL TAKE HOME PAY</td>
                                                        <td style="text-align: right; font-size: 1.2rem; color: #10B981;" id="valPayTotal">Rp 0</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
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

                    <div class="panel mt-3" data-role-special="customerImportTools" style="position: relative; z-index: 50; pointer-events: auto; overflow: visible;">
                        <div style="display:flex; gap:14px; flex-wrap: wrap; align-items: end;">
                            <div style="display:flex; flex-direction: column; gap: 6px; min-width: 260px; flex: 1;">
                                <label for="customerExcelInput" class="text-muted" style="font-size: 0.82rem;">Pilih file Excel nasabah</label>
                                <input type="file" id="customerExcelInput" accept=".xlsx, .xls, .csv" title="Upload Data Nasabah" onchange="handleCustomerExcelSelected()" class="form-control" style="cursor: pointer; position: relative; z-index: 51; pointer-events: auto;" />
                                <small class="text-muted">Urutan kolom wajib: ID_Nasabah, IDPJK, Tipe (1=perorangan, 2=perusahaan), Nama, Tempat_Lahir, Tanggal_Lahir, Alamat, Warga_Negara, Jenis_Kelamin, Pekerjaan, No_HP, No_Rekening, No_KTP, Selain_KTP, No_CIF, NPWP, Local_ID, Tgl_Daftar.</small>
                            </div>
                            <div id="customerExcelFileName" class="text-muted" style="min-width: 220px; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-bottom: 10px;">Belum ada file dipilih</div>
                            <button type="button" class="btn btn-success" id="btnCustomerExcelUpload" onclick="uploadCustomersExcel(); return false;" onpointerdown="uploadCustomersExcel(); return false;" onmousedown="uploadCustomersExcel(); return false;" ontouchstart="uploadCustomersExcel(); return false;" style="white-space: nowrap; position: relative; z-index: 51; pointer-events: auto !important; cursor: pointer !important; user-select: none;"><i class="fa-solid fa-file-import"></i> Proses Import</button>
                            <button type="button" class="btn btn-danger" onclick="resetAllCustomersData()" style="white-space: nowrap;"><i class="fa-solid fa-trash-can"></i> Reset Data</button>
                        </div>
                    </div>
                    <script>
                        (function() {
                            function getCustomersFallback() {
                                try {
                                    if (typeof window.getCustomers === 'function') return window.getCustomers();
                                    const raw = localStorage.getItem('mc_customers');
                                    const parsed = raw ? JSON.parse(raw) : [];
                                    return Array.isArray(parsed) ? parsed : [];
                                } catch (e) {
                                    return [];
                                }
                            }

                            function saveCustomersFallback(customers) {
                                if (typeof window.saveCustomers === 'function') {
                                    window.saveCustomers(customers);
                                    return;
                                }
                                localStorage.setItem('mc_customers', JSON.stringify(customers));
                            }

                            function generateIdFallback() {
                                if (typeof window.generateStandardId === 'function') return window.generateStandardId();
                                return 'ALM-' + String(Date.now()).slice(-6);
                            }

                            function buildUniqueImportedCustomerId(existingCustomers, rowIndex) {
                                const used = new Set((existingCustomers || []).map(c => String((c && c.id_nasabah) || '').trim()).filter(Boolean));
                                let candidate = generateIdFallback();
                                let sequence = 1;
                                while (used.has(String(candidate).trim())) {
                                    candidate = 'ALM-' + Date.now() + '-' + (rowIndex + 1) + '-' + sequence++;
                                }
                                return candidate;
                            }

                            function updateCustomerExcelLabel() {
                                const input = document.getElementById('customerExcelInput');
                                const label = document.getElementById('customerExcelFileName');
                                const button = document.getElementById('btnCustomerExcelUpload');
                                if (label) label.textContent = input && input.files && input.files[0] ? input.files[0].name : 'Belum ada file dipilih';
                                if (button) {
                                    button.disabled = false;
                                    button.classList.remove('disabled');
                                    button.style.pointerEvents = 'auto';
                                    button.style.cursor = 'pointer';
                                }
                            }

                            function importCustomersInline() {
                                const fileInput = document.getElementById('customerExcelInput');
                                const importButton = document.getElementById('btnCustomerExcelUpload');
                                const setImportLoading = function(isLoading) {
                                    if (importButton) {
                                        importButton.disabled = isLoading;
                                        importButton.style.pointerEvents = isLoading ? 'none' : 'auto';
                                        importButton.style.cursor = isLoading ? 'wait' : 'pointer';
                                        importButton.innerHTML = isLoading
                                            ? '<i class="fa-solid fa-spinner fa-spin"></i> Mengimpor...'
                                            : '<i class="fa-solid fa-file-import"></i> Proses Import';
                                    }
                                    if (typeof Swal !== 'undefined') {
                                        if (isLoading) {
                                            Swal.fire({
                                                title: 'Mengimpor Data Nasabah',
                                                text: 'File sedang dibaca dan data sedang disimpan.',
                                                allowOutsideClick: false,
                                                allowEscapeKey: false,
                                                background: '#1e293b',
                                                color: '#f8fafc',
                                                didOpen: () => Swal.showLoading()
                                            });
                                        } else if (Swal.isLoading && Swal.isLoading()) {
                                            Swal.close();
                                        }
                                    }
                                };
                                if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                                    if (typeof fileInput?.showPicker === 'function') fileInput.showPicker();
                                    return false;
                                }
                                if (importButton && importButton.disabled) return false;
                                if (typeof XLSX === 'undefined') {
                                    alert('Library Excel belum termuat. Coba refresh halaman sekali lagi.');
                                    return false;
                                }

                                const file = fileInput.files[0];
                                const reader = new FileReader();
                                setImportLoading(true);
                                const compactCustomerForStorage = function(customer) {
                                    if (!customer || typeof customer !== 'object') return customer;
                                    const next = { ...customer };
                                    if (typeof next.foto_id === 'string' && next.foto_id.length > 5000) delete next.foto_id;
                                    delete next.raw_json;
                                    return next;
                                };
                                const saveImportedCustomersCache = function(customers) {
                                    const compactCustomers = customers.map(compactCustomerForStorage);
                                    window.__mcCustomersMemory = compactCustomers;
                                    window.__almaraLastLocalCustomerWriteAt = Date.now();
                                    try {
                                        localStorage.setItem('mc_customers', JSON.stringify(compactCustomers));
                                        return true;
                                    } catch (error) {
                                        if (error && (error.name === 'QuotaExceededError' || String(error.message || '').toLowerCase().includes('quota'))) {
                                            localStorage.removeItem('mc_customers');
                                            try {
                                                localStorage.setItem('mc_customers', JSON.stringify(compactCustomers));
                                                return true;
                                            } catch (retryError) {
                                                console.warn('Cache nasabah lokal penuh, data tetap disimpan ke database.', retryError);
                                                window.__mcCustomersMemory = compactCustomers;
                                                return false;
                                            }
                                        }
                                        throw error;
                                    }
                                };
                                const parseCustomerCsvRows = function(text) {
                                    const rows = [];
                                    let row = [];
                                    let field = '';
                                    let inQuotes = false;
                                    const normalized = String(text || '').replace(/^\uFEFF/, '');
                                    const firstLine = normalized.split(/\r?\n/, 1)[0] || '';
                                    const delimiterCounts = {
                                        ',': (firstLine.match(/,/g) || []).length,
                                        ';': (firstLine.match(/;/g) || []).length,
                                        '\t': (firstLine.match(/\t/g) || []).length
                                    };
                                    const delimiter = Object.keys(delimiterCounts).sort((a, b) => delimiterCounts[b] - delimiterCounts[a])[0] || ',';

                                    for (let i = 0; i < normalized.length; i++) {
                                        const ch = normalized[i];
                                        const next = normalized[i + 1];

                                        if (ch === '"') {
                                            if (inQuotes && next === '"') {
                                                field += '"';
                                                i++;
                                            } else {
                                                inQuotes = !inQuotes;
                                            }
                                            continue;
                                        }

                                        if (ch === delimiter && !inQuotes) {
                                            row.push(field.trim());
                                            field = '';
                                            continue;
                                        }

                                        if ((ch === '\n' || ch === '\r') && !inQuotes) {
                                            if (ch === '\r' && next === '\n') i++;
                                            row.push(field.trim());
                                            if (row.some(cell => String(cell || '').trim() !== '')) rows.push(row);
                                            row = [];
                                            field = '';
                                            continue;
                                        }

                                        field += ch;
                                    }

                                    row.push(field.trim());
                                    if (row.some(cell => String(cell || '').trim() !== '')) rows.push(row);
                                    return rows;
                                };

                                reader.onload = async function(e) {
                                    try {
                                        const fileName = String(file.name || '').toLowerCase();
                                        let jsonData = [];
                                        if (fileName.endsWith('.csv')) {
                                            const csvText = new TextDecoder('utf-8').decode(e.target.result);
                                            jsonData = parseCustomerCsvRows(csvText);
                                            if (jsonData.length === 0 || jsonData.every(row => row.length < 3)) {
                                                const workbook = XLSX.read(csvText, { type: 'string' });
                                                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                                                jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
                                            }
                                        } else {
                                            const data = new Uint8Array(e.target.result);
                                            const workbook = XLSX.read(data, { type: 'array' });
                                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                                            jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
                                        }

                                        let customers = getCustomersFallback();
                                        let addCount = 0;
                                        const importedCustomers = [];
                                        const normalizeImportHeader = (value) => String(value || '')
                                            .toLowerCase()
                                            .replace(/[^a-z0-9]+/g, '');
                                        const headerMap = {};
                                        if (Array.isArray(jsonData[0])) {
                                            jsonData[0].forEach((header, index) => {
                                                const key = normalizeImportHeader(header);
                                                if (key) headerMap[key] = index;
                                            });
                                        }
                                        const requiredHeaders = [
                                            'ID_Nasabah', 'IDPJK', 'Tipe', 'Nama', 'Tempat_Lahir', 'Tanggal_Lahir', 'Alamat',
                                            'Warga_Negara', 'Jenis_Kelamin', 'Pekerjaan', 'No_HP', 'No_Rekening', 'No_KTP',
                                            'Selain_KTP', 'No_CIF', 'NPWP', 'Local_ID', 'Tgl_Daftar'
                                        ];
                                        const missingHeaders = requiredHeaders.filter(header => headerMap[normalizeImportHeader(header)] === undefined);
                                        if (missingHeaders.length) {
                                            throw new Error('Header kolom wajib belum lengkap: ' + missingHeaders.join(', '));
                                        }
                                        const getHeaderCell = (row, aliases, fallbackIndex) => {
                                            for (const alias of aliases) {
                                                const index = headerMap[normalizeImportHeader(alias)];
                                                if (index !== undefined && row[index] !== undefined && String(row[index]).trim() !== '') {
                                                    return row[index];
                                                }
                                            }
                                            return row[fallbackIndex];
                                        };

                                        jsonData.forEach((row, i) => {
                                            if (!Array.isArray(row) || row.length < 3) return;
                                            if (i === 0 || row.includes('ID Nasabah') || row.includes('Tipe')) return;

                                            const idNasabahValue = getHeaderCell(row, ['ID_Nasabah', 'ID Nasabah', 'ID NASABAH', 'internal_id'], 0);
                                            const tipeValue = getHeaderCell(row, ['Tipe', 'KN(TIPE)', 'KN Tipe', 'KN', 'customer_type'], 2);
                                            const namaValue = getHeaderCell(row, ['Nama', 'Nama Lengkap', 'NAMA LENGKAP', 'name'], 3);
                                            const idNasabah = idNasabahValue !== undefined ? String(idNasabahValue).trim() : null;
                                            const tipeLabel = tipeValue !== undefined ? String(tipeValue).trim() : '';
                                            const nama = namaValue !== undefined ? String(namaValue).trim() : null;
                                            const idpjk = getHeaderCell(row, ['IDPJK'], 1) !== undefined ? String(getHeaderCell(row, ['IDPJK'], 1)).trim() : '-';
                                            const tempat_lahir = getHeaderCell(row, ['Tempat_Lahir', 'Tempat Lahir'], 4) !== undefined ? String(getHeaderCell(row, ['Tempat_Lahir', 'Tempat Lahir'], 4)).trim() : '-';
                                            const tanggal_lahir = getHeaderCell(row, ['Tanggal_Lahir', 'Tanggal Lahir'], 5) !== undefined ? String(getHeaderCell(row, ['Tanggal_Lahir', 'Tanggal Lahir'], 5)).trim() : '-';
                                            const alamat = getHeaderCell(row, ['Alamat'], 6) !== undefined ? String(getHeaderCell(row, ['Alamat'], 6)).trim() : '-';
                                            const warga_negara = getHeaderCell(row, ['Warga_Negara', 'Warga Negara'], 7) !== undefined ? String(getHeaderCell(row, ['Warga_Negara', 'Warga Negara'], 7)).trim() : '-';
                                            const jenis_kelamin = getHeaderCell(row, ['Jenis_Kelamin', 'Jenis Kelamin'], 8) !== undefined ? String(getHeaderCell(row, ['Jenis_Kelamin', 'Jenis Kelamin'], 8)).trim() : '-';
                                            const pekerjaan = getHeaderCell(row, ['Pekerjaan'], 9) !== undefined ? String(getHeaderCell(row, ['Pekerjaan'], 9)).trim() : '-';
                                            const no_hp = getHeaderCell(row, ['No_HP', 'No HP', 'NO TLP', 'No TLP', 'No Telp', 'Phone'], 10) !== undefined ? String(getHeaderCell(row, ['No_HP', 'No HP', 'NO TLP', 'No TLP', 'No Telp', 'Phone'], 10)).trim() : '-';
                                            const no_rekening = getHeaderCell(row, ['No_Rekening', 'No Rekening'], 11) !== undefined ? String(getHeaderCell(row, ['No_Rekening', 'No Rekening'], 11)).trim() : '';
                                            const no_ktp = getHeaderCell(row, ['No_KTP', 'No KTP', 'NO KTP', 'identity_number'], 12) !== undefined ? String(getHeaderCell(row, ['No_KTP', 'No KTP', 'NO KTP', 'identity_number'], 12)).trim() : '-';
                                            const selain_ktp = getHeaderCell(row, ['Selain_KTP', 'Selain KTP', 'ID Lain'], 13) !== undefined ? String(getHeaderCell(row, ['Selain_KTP', 'Selain KTP', 'ID Lain'], 13)).trim() : '-';
                                            const no_cif = getHeaderCell(row, ['No_CIF', 'No CIF', 'id_cif'], 14) !== undefined ? String(getHeaderCell(row, ['No_CIF', 'No CIF', 'id_cif'], 14)).trim() : '';
                                            const npwp = getHeaderCell(row, ['NPWP'], 15) !== undefined ? String(getHeaderCell(row, ['NPWP'], 15)).trim() : '';
                                            const local_id = getHeaderCell(row, ['Local_ID', 'Local ID'], 16) !== undefined ? String(getHeaderCell(row, ['Local_ID', 'Local ID'], 16)).trim() : '';

                                            if (!idNasabah || !nama || idNasabah === '-' || idNasabah === '') return;

                                            let typeKn = '1';
                                            if (tipeLabel.toLowerCase().includes('perusahaan') || tipeLabel.toLowerCase().includes('corporate') || tipeLabel === '2') {
                                                typeKn = '2';
                                            }

                                            let finalId = idNasabah;
                                            if (!idNasabah || idNasabah === '-' || isNaN(parseInt(idNasabah, 10)) || idNasabah.includes('Perorangan') || idNasabah.includes('Corporate') || idNasabah.toLowerCase().includes('tipe')) {
                                                finalId = buildUniqueImportedCustomerId(customers, i);
                                            }

                                            const existingIdx = customers.findIndex(c => String(c.id_nasabah || '').trim() === String(finalId).trim());
                                            let finalTglDaftar = new Date().toISOString();
                                            const tglDaftarValue = getHeaderCell(row, ['Tgl_Daftar', 'Tgl Daftar', 'Tanggal Daftar'], 17);
                                            const tglDaftarExcel = tglDaftarValue !== undefined ? String(tglDaftarValue).trim() : null;

                                            if (tglDaftarExcel && tglDaftarExcel !== '-') {
                                                const parsed = new Date(tglDaftarExcel);
                                                if (!isNaN(parsed.getTime())) finalTglDaftar = parsed.toISOString();
                                            } else if (existingIdx !== -1 && customers[existingIdx].tgl_daftar) {
                                                finalTglDaftar = customers[existingIdx].tgl_daftar;
                                            }

                                            const newCustomer = {
                                                id_nasabah: finalId,
                                                idpjk,
                                                kn: typeKn,
                                                nama,
                                                tempat_lahir,
                                                tanggal_lahir,
                                                alamat,
                                                jenis_kelamin,
                                                warga_negara,
                                                pekerjaan,
                                                no_ktp,
                                                selain_ktp,
                                                no_hp,
                                                no_rekening,
                                                no_cif,
                                                npwp,
                                                local_id,
                                                tgl_daftar: finalTglDaftar
                                            };

                                            if (existingIdx !== -1) {
                                                customers[existingIdx] = { ...customers[existingIdx], ...newCustomer };
                                            } else {
                                                customers.push(newCustomer);
                                            }
                                            importedCustomers.push(newCustomer);
                                            addCount++;
                                        });

                                        if (addCount > 0) {
                                            let mysqlSuccessCount = 0;
                                            let mysqlFailedCount = 0;
                                            let errorDetails = '';

                                            if (typeof window.saveBulkToMySQL_Customers === 'function') {
                                                if (typeof Swal !== 'undefined' && Swal.update) {
                                                    Swal.update({ text: 'Mengunggah ' + importedCustomers.length + ' data nasabah ke MySQL...' });
                                                }
                                                const bulkResult = await window.saveBulkToMySQL_Customers(importedCustomers);
                                                mysqlSuccessCount = bulkResult.successCount;
                                                mysqlFailedCount = bulkResult.failedCount;
                                                if (!bulkResult.ok) {
                                                    mysqlFailedCount = importedCustomers.length;
                                                    errorDetails = '\n\nServer belum menerima data: ' + (bulkResult.message || 'respons penyimpanan tidak valid');
                                                }
                                                if (bulkResult.errors && bulkResult.errors.length > 0) {
                                                    errorDetails = '\n\nDetail Gagal:\n' + bulkResult.errors.slice(0, 5).join('\n') + 
                                                                   (bulkResult.errors.length > 5 ? '\n...dan ' + (bulkResult.errors.length - 5) + ' baris lainnya.' : '');
                                                }
                                            } else if (typeof window.saveToMySQL_Customer === 'function') {
                                                for (let index = 0; index < importedCustomers.length; index++) {
                                                    const customer = importedCustomers[index];
                                                    if (typeof Swal !== 'undefined' && Swal.update) {
                                                        Swal.update({ text: 'Menyimpan data ' + (index + 1) + ' dari ' + importedCustomers.length + '...' });
                                                    }
                                                    const result = await window.saveToMySQL_Customer(customer);
                                                    if (result && result.ok) mysqlSuccessCount++;
                                                    else mysqlFailedCount++;
                                                }
                                            }
                                            const cacheSaved = saveImportedCustomersCache(customers);
                                            if (mysqlFailedCount === 0 && mysqlSuccessCount > 0) {
                                                localStorage.removeItem('mc_customers_reset_at');
                                            }
                                            if (typeof window.loadCustomersTable === 'function') window.loadCustomersTable();
                                            const successText = !cacheSaved
                                                ? 'Data sudah dikirim ke database. Cache browser penuh, jadi tabel ditampilkan dari memori sementara.'
                                                : mysqlFailedCount > 0
                                                ? 'Berhasil membaca ' + addCount + ' data. Tersimpan ke database: ' + mysqlSuccessCount + ', gagal: ' + mysqlFailedCount + '.' + errorDetails
                                                : 'Berhasil mengimpor / memperbarui ' + addCount + ' data nasabah.';
                                            if (typeof Swal !== 'undefined') {
                                                Swal.fire({
                                                    icon: (mysqlFailedCount > 0 || !cacheSaved) ? 'warning' : 'success',
                                                    title: (mysqlFailedCount > 0 || !cacheSaved) ? 'Import Selesai Sebagian' : 'Import Berhasil',
                                                    text: successText,
                                                    background: '#1e293b',
                                                    color: '#f8fafc'
                                                });
                                            } else {
                                                alert(successText);
                                            }
                                            fileInput.value = '';
                                            updateCustomerExcelLabel();
                                        } else {
                                            if (typeof Swal !== 'undefined') {
                                                Swal.fire('Tidak Ada Data Valid', 'Tidak ada data nasabah valid yang diunggah. Pastikan format tabel cocok.', 'warning');
                                            } else {
                                                alert('Tidak ada data nasabah valid yang diunggah. Pastikan format tabel cocok.');
                                            }
                                        }
                                    } catch (error) {
                                        console.error(error);
                                        if (typeof Swal !== 'undefined') {
                                            Swal.fire('Gagal Import', 'Gagal membaca file nasabah: ' + (error.message || error) + '. Gunakan file .xlsx, .xls, atau .csv dengan kolom nasabah yang sesuai.', 'error');
                                        } else {
                                            alert('Gagal membaca file nasabah: ' + (error.message || error) + '. Gunakan file .xlsx, .xls, atau .csv dengan kolom nasabah yang sesuai.');
                                        }
                                    } finally {
                                        setImportLoading(false);
                                    }
                                };
                                reader.onerror = function() {
                                    setImportLoading(false);
                                    if (typeof Swal !== 'undefined') {
                                        Swal.fire('Gagal Membaca File', 'Browser gagal membaca file yang dipilih.', 'error');
                                    } else {
                                        alert('Browser gagal membaca file yang dipilih.');
                                    }
                                };

                                reader.readAsArrayBuffer(file);
                                return false;
                            }

                            window.handleCustomerExcelSelected = updateCustomerExcelLabel;
                            window.uploadCustomersExcel = importCustomersInline;

                            setTimeout(function() {
                                const input = document.getElementById('customerExcelInput');
                                const button = document.getElementById('btnCustomerExcelUpload');
                                if (input) {
                                    input.disabled = false;
                                    input.addEventListener('change', updateCustomerExcelLabel);
                                }
                                if (button) {
                                    button.disabled = false;
                                    button.classList.remove('disabled');
                                    button.onclick = function() { return importCustomersInline(); };
                                    button.onpointerdown = function(e) { e.preventDefault(); return importCustomersInline(); };
                                    button.onmousedown = function(e) { e.preventDefault(); return importCustomersInline(); };
                                }
                                updateCustomerExcelLabel();
                            }, 50);
                        })();
                    </script>

                    <style>
                        #customers-view .customer-table-panel {
                            padding: 16px;
                            border-radius: 10px;
                        }
                        #customers-view .customer-table-toolbar {
                            display: grid;
                            grid-template-columns: 1fr;
                            gap: 10px;
                            align-items: stretch;
                            margin-bottom: 12px;
                        }
                        #customers-view .customer-filter-bar {
                            display: grid;
                            grid-template-columns: minmax(320px, 1fr) 150px 154px 28px 154px 38px;
                            gap: 8px;
                            align-items: center;
                            min-width: 0;
                        }
                        #customers-view #searchCustomerInput {
                            width: 100%;
                            min-width: 0;
                            height: 38px;
                        }
                        #customers-view .customer-filter-bar .form-control {
                            height: 38px;
                            margin: 0;
                            font-size: 0.82rem;
                            min-width: 0;
                        }
                        #customers-view .customer-toolbar-actions {
                            display: flex;
                            gap: 8px;
                            align-items: center;
                            justify-content: flex-end;
                            flex-wrap: wrap;
                            min-width: 0;
                        }
                        #customers-view .customer-toolbar-actions .btn {
                            height: 36px;
                            min-width: 36px;
                            padding: 0 11px;
                            border-radius: 8px;
                            font-size: 0.8rem;
                            font-weight: 700;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                            white-space: nowrap;
                        }
                        #customers-view .customer-date-reset-btn {
                            width: 38px;
                            height: 38px;
                            min-width: 38px;
                            padding: 0;
                            border-radius: 8px;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            border: 1px solid rgba(148, 163, 184, 0.28);
                            background: rgba(15, 23, 42, 0.58);
                            color: #cbd5e1;
                            cursor: pointer;
                        }
                        #customers-view .customer-date-reset-btn:hover {
                            color: #f8fafc;
                            border-color: rgba(96, 165, 250, 0.55);
                            background: rgba(59, 130, 246, 0.18);
                        }
                        #customers-view #customerTotalSummary {
                            height: 36px;
                            display: inline-flex;
                            align-items: center;
                            font-size: 0.82rem !important;
                            padding: 0 10px !important;
                            max-width: 100%;
                        }
                        #customers-view .customers-table-wrap {
                            border: 1px solid rgba(148, 163, 184, 0.15);
                            border-radius: 10px;
                            max-height: 62vh;
                            overflow: auto;
                        }
                        #customers-view .customers-ledger-table {
                            border-collapse: collapse;
                            font-size: 0.78rem;
                            line-height: 1.2;
                            margin: 0;
                        }
                        #customers-view .customers-ledger-table thead th {
                            position: sticky;
                            top: 0;
                            z-index: 3;
                            background: #111827;
                            padding: 8px 9px;
                            color: #aebbd0;
                            font-size: 0.7rem;
                            letter-spacing: 0.02em;
                            border-bottom: 1px solid rgba(148, 163, 184, 0.22);
                            white-space: nowrap;
                        }
                        #customers-view .customers-ledger-table tbody td {
                            padding: 5px 9px;
                            border-bottom: 1px solid rgba(148, 163, 184, 0.13);
                            vertical-align: middle;
                            white-space: nowrap;
                        }
                        #customers-view .customers-ledger-table tbody tr:nth-child(even) td {
                            background: rgba(15, 23, 42, 0.22);
                        }
                        #customers-view .customers-ledger-table tbody tr:hover td {
                            background: rgba(59, 130, 246, 0.09);
                        }
                        #customers-view .customers-ledger-table .customer-name-cell {
                            min-width: 190px;
                            white-space: normal;
                        }
                        #customers-view .customers-ledger-table .customer-address-cell {
                            max-width: 260px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        #customers-view .customers-ledger-table .customer-action-cell {
                            position: sticky;
                            right: 0;
                            background: #111827;
                            z-index: 2;
                            box-shadow: -4px 0 10px rgba(0,0,0,0.22);
                            padding: 4px 7px;
                        }
                        #customers-view .customer-row-actions {
                            display: inline-flex;
                            gap: 5px;
                            align-items: center;
                            justify-content: center;
                            padding: 3px;
                            border: 1px solid rgba(148, 163, 184, 0.16);
                            border-radius: 7px;
                            background: rgba(15, 23, 42, 0.72);
                        }
                        #customers-view .customer-row-actions .btn {
                            width: 27px;
                            height: 27px;
                            min-width: 27px;
                            padding: 0;
                            border-radius: 6px;
                            margin: 0 !important;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 0.72rem;
                        }
                        @media (max-width: 980px) {
                            #customers-view .customer-filter-bar {
                                grid-template-columns: 1fr 1fr;
                            }
                            #customers-view .customer-filter-separator {
                                display: none !important;
                            }
                            #customers-view .customer-toolbar-actions {
                                justify-content: flex-start;
                            }
                        }
                        @media (max-width: 640px) {
                            #customers-view .customer-filter-bar {
                                grid-template-columns: 1fr;
                            }
                        }
                    </style>

                    <div class="panel mt-4 customer-table-panel">
                        <div class="customer-table-toolbar">
                            <div class="customer-filter-bar">
                                <input type="text" id="searchCustomerInput" class="form-control" placeholder="Cari nasabah..." autocomplete="off" oninput="filterCustomersTable()">
                                <select id="filterCustomerType" class="form-control" onchange="filterCustomersTable()">
                                    <option value="ALL">Semua Tipe</option>
                                    <option value="1">Perorangan</option>
                                    <option value="2">Corporate</option>
                                </select>
                                <input type="date" id="filterCustomerDateStart" class="form-control" title="Dari Tanggal Daftar" onchange="filterCustomersTable()">
                                <span class="customer-filter-separator" style="display: flex; align-items: center; justify-content:center; color: #94A3B8; font-size:0.78rem;">s.d</span>
                                <input type="date" id="filterCustomerDateEnd" class="form-control" title="Sampai Tanggal Daftar" onchange="filterCustomersTable()">
                                <button type="button" class="customer-date-reset-btn" onclick="resetCustomerDateFilters()" title="Reset tanggal awal dan akhir"><i class="fa-solid fa-rotate-left"></i></button>
                            </div>
                            <div class="customer-toolbar-actions">
                                <div id="customerTotalSummary" class="text-muted" style="font-size: 0.9rem; white-space: nowrap; padding: 8px 10px; border: 1px solid rgba(148,163,184,0.18); border-radius: 6px; background: rgba(15,23,42,0.35);">
                                    Total Nasabah: 0
                                </div>
                                <button class="btn btn-success" onclick="openBlastWaModal()" title="Broadcast WhatsApp"><i class="fa-brands fa-whatsapp"></i> WA</button>
                                <button class="btn btn-primary" style="background: #10B981; border: none;" onclick="exportCustomersXlsx()" title="Export Excel"><i class="fa-solid fa-file-excel"></i> Excel</button>
                                <button class="btn btn-danger" onclick="printCustomersPdf()" title="Cetak PDF"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                            </div>
                        </div>
                        <div class="table-responsive customers-table-wrap">
                            <table class="table customers-ledger-table">
                                <thead>
                                    <tr style="white-space: nowrap;">
                                        <th style="width: 40px; text-align: center;"><input type="checkbox" id="chkAllCust" onchange="toggleAllCustomers(this)"></th>
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
                                        <th style="position: sticky; right: 0; background: #0f172a; z-index: 2; box-shadow: -4px 0 10px rgba(0,0,0,0.3);">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="customersTableBody">
                                    <!-- Injected -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Mutations View -->
                <section id="mutation-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Data Mutasi Rekening Bank</h2>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <input type="file" id="historicalMutationInput" class="form-control" accept=".xlsx, .xls, .csv" style="max-width: 200px;" title="Gunakan file hasil Export Excel">
                            <button class="btn btn-success" onclick="uploadHistoricalMutations()"><i class="fa-solid fa-upload"></i> Upload Histori</button>
                            <button class="btn btn-primary" onclick="exportTableToExcel('mutationTable', 'Mutasi_Bank')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                            <button class="btn btn-success" onclick="openMutationModal()"><i class="fa-solid fa-plus"></i> Tambah Mutasi</button>
                        </div>
                    </div>
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
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #f59e0b;">
                        <div>
                            <h2 style="color: #f59e0b;"><i class="fa-solid fa-images"></i> Galeri Referensi Valas</h2>
                            <p class="text-muted mt-2">Acuan visual mata uang yang diterima (Accepted) dan tidak diterima (Rejected/Expired).</p>
                        </div>
                        <div id="valasGalleryAdminBtn" style="display: none;">
                            <button class="btn btn-primary" onclick="window.openValasGalleryModal()"><i class="fa-solid fa-plus"></i> Tambah Acuan Valas</button>
                        </div>
                    </div>

                    <!-- Filter & Pencarian -->
                    <div class="panel mt-4">
                        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 250px;">
                                <label style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; display: block;">Cari Deskripsi / Keterangan</label>
                                <input type="text" id="valasGallerySearch" class="form-control" placeholder="Ketik kode valas, judul, atau kata kunci..." oninput="window.loadValasGalleryGrid()">
                            </div>
                            <div style="width: 200px;">
                                <label style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; display: block;">Status Penerimaan</label>
                                <select id="valasGalleryStatusFilter" class="form-control" onchange="window.loadValasGalleryGrid()">
                                    <option value="ALL">Semua Status</option>
                                    <option value="DITERIMA">Diterima (Accepted)</option>
                                    <option value="TIDAK_DITERIMA">Tidak Diterima (Rejected)</option>
                                </select>
                            </div>
                            <div style="margin-top: 24px;">
                                <button class="btn btn-outline" onclick="window.resetValasGalleryFilter()"><i class="fa-solid fa-rotate-left"></i> Reset</button>
                            </div>
                        </div>
                    </div>

                    <!-- Grid Card Acuan -->
                    <div class="mt-4" id="valasGalleryGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                        <!-- Injected dynamically -->
                    </div>
                </section>

                <!-- Catatan Gantungan View -->
                <section id="gantungan-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #FBBF24;">
                        <div>
                            <h2 style="color: #FBBF24;"><i class="fa-solid fa-hand-holding-dollar"></i> Gantungan per Nama</h2>
                            <p class="text-muted mt-2">Catat pinjaman dan cicilan berdasarkan nama. Saldo setiap orang ditampilkan pada kartu masing-masing.</p>
                        </div>
                        <div>
                            <button class="btn btn-primary" onclick="window.openGantunganModal()"><i class="fa-solid fa-plus"></i> Tambah Gantungan</button>
                        </div>
                    </div>

                    <div id="gantunganPersonCards" class="dashboard-grid mt-3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:15px;"></div>

                    <!-- Statistik Ringkasan Gantungan -->
                    <div class="dashboard-grid mt-4" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px;">
                        <div class="stat-card panel" style="border-top: 4px solid #F59E0B;">
                            <div class="stat-title" style="color: #94a3b8; font-size: 0.85rem;">Total Gantungan Piutang (Uang Kurang)</div>
                            <div class="stat-value" id="gantunganTotalPiutang" style="font-size: 1.8rem; font-weight: bold; margin-top: 8px; color: #F59E0B;">Rp 0</div>
                        </div>
                        <div class="stat-card panel" style="border-top: 4px solid #3B82F6;">
                            <div class="stat-title" style="color: #94a3b8; font-size: 0.85rem;">Total Gantungan Utang (Kembalian Menggantung)</div>
                            <div class="stat-value" id="gantunganTotalUtang" style="font-size: 1.8rem; font-weight: bold; margin-top: 8px; color: #3B82F6;">Rp 0</div>
                        </div>
                        <div class="stat-card panel" style="border-top: 4px solid #cbd5e1;">
                            <div class="stat-title" style="color: #94a3b8; font-size: 0.85rem;">Net Saldo Gantungan (Piutang - Utang)</div>
                            <div class="stat-value" id="gantunganNetSaldo" style="font-size: 1.8rem; font-weight: bold; margin-top: 8px; color: #cbd5e1;">Rp 0</div>
                        </div>
                    </div>

                    <!-- Filter & Tabel -->
                    <div class="panel mt-4">
                        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap; margin-bottom: 20px;">
                            <div style="flex: 1; min-width: 250px;">
                                <label style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; display: block;">Cari Nasabah / Keterangan</label>
                                <input type="text" id="gantunganSearch" class="form-control" placeholder="Ketik nama nasabah, keterangan, atau ID..." oninput="window.loadGantungansTable()">
                            </div>
                            <div style="width: 200px;">
                                <label style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; display: block;">Status Pelunasan</label>
                                <select id="gantunganFilterStatus" class="form-control" onchange="window.loadGantungansTable()">
                                    <option value="all">Semua Status</option>
                                    <option value="BELUM_LUNAS">Belum Lunas</option>
                                    <option value="LUNAS">Sudah Lunas</option>
                                </select>
                            </div>
                            <div style="margin-top: 24px;">
                                <button class="btn btn-outline" onclick="document.getElementById('gantunganSearch').value=''; document.getElementById('gantunganFilterStatus').value='all'; window.loadGantungansTable();"><i class="fa-solid fa-rotate-left"></i> Reset</button>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table" id="gantunganTable">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Usia</th>
                                        <th>ID Gantungan</th>
                                <th>Nama</th>
                                <th>Jenis Catatan</th>
                                        <th style="text-align: right;">Nominal Awal</th>
                                        <th style="text-align: right;">Sisa Saldo</th>
                                        <th>Keterangan / Alasan</th>
                                        <th style="text-align: center;">Status</th>
                                        <th style="text-align: center;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="gantunganTableBody">
                                    <!-- Diisi via JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Serah Terima & Pickup Valas (Ojol-Style) View -->
                <section id="pickup-view" class="view-section hidden">
                    <div class="panel header-panel flex-between" style="border-left: 4px solid #F97316;">
                        <div>
                            <h2 style="color: #F97316; display: flex; align-items: center; gap: 10px; margin: 0;"><i class="fa-solid fa-motorcycle"></i> Serah Terima & Pickup Valas (Ojol-Style)</h2>
                            <p class="text-muted mt-2">Pencatatan alur pelepasan, pengiriman, dan serah terima valas yang dibawa kurir untuk dijual ke luar kantor.</p>
                        </div>
                        <div>
                            <button class="btn btn-primary" style="background:#F97316; border-color:#F97316;" onclick="window.openCreatePickupModal()"><i class="fa-solid fa-plus"></i> Buat Permintaan Pickup</button>
                        </div>
                    </div>

                    <!-- Statistik Ringkasan Pickup -->
                    <div class="dashboard-grid mt-4" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px;">
                        <div class="stat-card panel" style="border-top: 4px solid #F59E0B;">
                            <div class="stat-title" style="color: #94a3b8; font-size: 0.85rem;">Pickup / Penugasan Aktif</div>
                            <div class="stat-value" id="pickupStatActive" style="font-size: 1.8rem; font-weight: bold; margin-top: 8px; color: #F59E0B;">0</div>
                        </div>
                        <div class="stat-card panel" style="border-top: 4px solid #3B82F6;">
                            <div class="stat-title" style="color: #94a3b8; font-size: 0.85rem;">Volume Valas Transit (Est. Rp)</div>
                            <div class="stat-value" id="pickupStatTransit" style="font-size: 1.8rem; font-weight: bold; margin-top: 8px; color: #3B82F6;">Rp 0</div>
                        </div>
                        <div class="stat-card panel" style="border-top: 4px solid #10B981;">
                            <div class="stat-title" style="color: #94a3b8; font-size: 0.85rem;">Selesai Hari Ini</div>
                            <div class="stat-value" id="pickupStatCompletedToday" style="font-size: 1.8rem; font-weight: bold; margin-top: 8px; color: #10B981;">0</div>
                        </div>
                    </div>

                    <!-- Judul Section Realtime -->
                    <h3 class="mt-5 mb-3" style="color: #f8fafc; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10B981; animation: pulse 2s infinite;"></span> Tugas & Pelacakan Aktif (Real-Time)</h3>
                    
                    <!-- Grid Penugasan Ojol Aktif -->
                    <div id="pickupActiveList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;" class="mb-5">
                        <!-- Injected dynamically by JS -->
                    </div>

                    <!-- Riwayat Serah Terima Selesai -->
                    <div class="panel mt-4">
                        <h3 style="color: #cbd5e1; margin-top: 0; margin-bottom: 20px;"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Serah Terima Selesai</h3>
                        <div class="table-responsive">
                            <table class="table" id="pickupHistoryTable">
                                <thead>
                                    <tr>
                                        <th>Tanggal Buat</th>
                                        <th>No. Pickup</th>
                                        <th>Kurir / Driver</th>
                                        <th>Tujuan</th>
                                        <th>Valas Bawaan</th>
                                        <th style="text-align: right;">Total Estimasi</th>
                                        <th style="text-align: right;">Total Realisasi Jual</th>
                                        <th style="text-align: center;">Status</th>
                                        <th style="text-align: center;">Bukti / Struk</th>
                                    </tr>
                                </thead>
                                <tbody id="pickupHistoryTableBody">
                                    <!-- Diisi via JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- Jurnal Keuangan View -->
                <section id="expense-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Jurnal Keuangan (Pendapatan & Pengeluaran)</h2>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportTableToExcel('expenseTable', 'Jurnal_Keuangan')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                            <button class="btn btn-success" onclick="openExpenseModal()"><i class="fa-solid fa-plus"></i> Tambah Jurnal</button>
                        </div>
                    </div>
                    <div class="panel mt-4">
                        <div class="table-responsive">
                            <table class="table" id="expenseTable">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>ID Jurnal</th>
                                        <th>Tipe</th>
                                        <th>Kategori Akun (BI)</th>
                                        <th>Keterangan</th>
                                        <th>Kas/Bank</th>
                                        <th style="text-align: right;">Nominal (Rp)</th>
                                        <th style="text-align: center;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="expensesTableBody">
                                </tbody>
                            </table>
                        </div>
                    </div>
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

                <!-- Investor View -->
                <section id="investor-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Penanam Saham / Investor</h2>
                            <p class="text-muted mt-2">Kelola daftar investor dan peraga pembagian dividen laba bulanan.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="openInvestorModal()"><i class="fa-solid fa-plus"></i> Tambah Investor</button>
                        </div>
                    </div>
                    
                    <div class="panel mt-4">
                        <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #334155;">
                            <button class="btn btn-link tabInvMode" style="color: #f8fafc; font-weight: bold; border-bottom: 2px solid #3b82f6; border-radius: 0; padding: 10px 20px; background: transparent !important; box-shadow: none;" onclick="switchInvestorTab('list')" id="tabInvList">Daftar Investor</button>
                            <button class="btn btn-link tabInvMode" style="color: #94A3B8; font-weight: normal; border-radius: 0; padding: 10px 20px; border-bottom: 2px solid transparent; background: transparent !important; box-shadow: none;" onclick="switchInvestorTab('dividend')" id="tabInvDiv">Peraga Pembagian Laba</button>
                        </div>
                        
                        <div id="investorListContainer">
                            <div class="table-responsive">
                                <table class="table table-bordered">
                                    <thead>
                                        <tr>
                                            <th>ID Investor</th>
                                            <th>Nama</th>
                                            <th>Kontak (HP/Email)</th>
                                            <th style="text-align: right;">Modal Disetor (Rp)</th>
                                            <th style="text-align: center;">Hak (%)</th>
                                            <th style="text-align: right;">Fee (Rp)</th>
                                            <th>Tgl Gabung</th>
                                            <th style="text-align: center;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="investorsTableBody">
                                    </tbody>
                                    <tfoot>
                                        <tr style="background: rgba(15,23,42,0.8); font-weight: bold;">
                                            <td colspan="3" class="text-end">Total:</td>
                                            <td class="text-end text-green" id="invTotalModal">Rp 0</td>
                                            <td class="text-center text-blue" id="invTotalPercent">0%</td>
                                            <td class="text-end text-blue" id="invTotalFee">Rp 0</td>
                                            <td colspan="2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        
                        <div id="investorDividendContainer" class="hidden" style="display: none;">
                            <div class="form-group row align-center" style="margin-bottom: 15px;">
                                <div class="col-md-4">
                                    <label>Pilih Bulan Laba (Basis Transaksi)</label>
                                    <input type="month" id="dividendMonthInput" class="form-control" onchange="simulateDividend()">
                                    
                                    <label style="margin-top: 10px; display: block;">Metode Kalkulasi Persentase</label>
                                    <select id="dividendMethodInput" class="form-control" onchange="simulateDividend()" style="background: rgba(15, 23, 42, 0.8); color: #f8fafc; border: 1px solid rgba(59, 130, 246, 0.3);">
                                        <option value="net_profit">Profesional (% dikalikan Laba Bersih)</option>
                                        <option value="flat_capital">Perjanjian Nilai Tetap (% dikalikan Modal Disetor)</option>
                                    </select>
                                </div>
                                <div class="col-md-8">
                                    <div class="summary-box" style="padding: 10px 20px;">
                                        <span style="font-size: 0.9rem; color: #94A3B8;">Otomatisasi Laba Bersih Bulan Terpilih (Sebelum Pajak & Prive):</span>
                                        <h3 id="dividendNetProfit" class="text-green mt-1">Rp 0</h3>
                                    </div>
                                </div>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-bordered">
                                    <thead>
                                        <tr>
                                            <th>Nama Investor</th>
                                            <th style="text-align: center;">Persentase Hak (%)</th>
                                            <th style="text-align: right;">Estimasi Laba Diterima (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody id="dividendSimulationBody">
                                        <tr><td colspan="3" class="text-center text-muted">Silahkan pilih bulan untuk simulasi pembagian laba.</td></tr>
                                    </tbody>
                                    <tfoot>
                                        <tr style="background: rgba(15,23,42,0.8); font-weight: bold; border-top: 2px solid rgba(255,255,255,0.1);">
                                            <td colspan="2" class="text-end">Total Peraga Pembagian:</td>
                                            <td class="text-end text-blue" id="divTotalDistributed">Rp 0</td>
                                        </tr>
                                        <tr style="background: rgba(15,23,42,0.8); font-weight: bold;">
                                            <td colspan="2" class="text-end">Sisa Laba / Disimpan:</td>
                                            <td class="text-end text-green" id="divTotalRetained">Rp 0</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- Investor Modal -->
                <div id="investorModal" class="modal">
                    <div class="modal-content panel" style="max-width: 450px;">
                        <div class="flex-between mb-3">
                            <h3 id="investorModalTitle">Tambah Investor</h3>
                            <span class="close-modal" onclick="closeInvestorModal()"><i class="fa-solid fa-xmark"></i></span>
                        </div>
                        <hr class="divider mb-3">
                        <input type="hidden" id="modalInvId">
                        <div class="form-group mb-2">
                            <label>Nama Investor</label>
                            <input type="text" id="modalInvName" class="form-control" placeholder="Nama Lengkap / Perusahaan">
                        </div>
                        <div class="form-group mb-2">
                            <label>Kontak (No. HP/Email)</label>
                            <input type="text" id="modalInvContact" class="form-control" placeholder="081xxx atau email">
                        </div>
                        <div class="form-group mb-2">
                            <label>Modal Disetor (Konversi Nilai Rupiah)</label>
                            <input type="text" id="modalInvCapital" class="form-control" placeholder="0" oninput="formatCurrencyInput(this)">
                        </div>
                        <div class="form-group mb-3">
                            <label>Hak Persentase Pembagian (%)</label>
                            <input type="number" id="modalInvPercent" class="form-control" placeholder="Maksimal 100" min="0" max="100" step="0.01">
                        </div>
                        <div class="form-group mb-3">
                            <label>Tanggal Gabung</label>
                            <input type="date" id="modalInvJoinDate" class="form-control">
                        </div>
                        <button class="btn btn-primary w-100 mt-2" onclick="saveInvestor()"><i class="fa-solid fa-save"></i> Simpan Data Investor</button>
                    </div>
                </div>

                <!-- Closing Kasir View -->
                <section id="closing-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Closing Harian Kasir (Rincian Fisik Uang Rupiah)</h2>
                    </div>
                    <div class="panel mt-4">
                        <div class="row" style="display: flex; gap: 20px; flex-wrap: wrap;">
                            <div class="col" style="flex: 1; min-width: 300px;">
                                <h3>Input Denominasi</h3>
                                <hr class="divider">
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Lembar / Keping - <strong>100.000</strong></label>
                                    <input type="number" id="denom100k" class="form-control denom-input" placeholder="0" style="flex: 1;" min="0">
                                </div>
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Lembar / Keping - <strong>50.000</strong></label>
                                    <input type="number" id="denom50k" class="form-control denom-input" placeholder="0" style="flex: 1;" min="0">
                                </div>
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Lembar / Keping - <strong>20.000</strong></label>
                                    <input type="number" id="denom20k" class="form-control denom-input" placeholder="0" style="flex: 1;" min="0">
                                </div>
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Lembar / Keping - <strong>10.000</strong></label>
                                    <input type="number" id="denom10k" class="form-control denom-input" placeholder="0" style="flex: 1;" min="0">
                                </div>
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Lembar / Keping - <strong>5.000</strong></label>
                                    <input type="number" id="denom5k" class="form-control denom-input" placeholder="0" style="flex: 1;" min="0">
                                </div>
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Lembar / Keping - <strong>2.000</strong></label>
                                    <input type="number" id="denom2k" class="form-control denom-input" placeholder="0" style="flex: 1;" min="0">
                                </div>
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Lembar / Keping - <strong>1.000</strong></label>
                                    <input type="number" id="denom1k" class="form-control denom-input" placeholder="0" style="flex: 1;" min="0">
                                </div>
                                <div class="form-group row align-center">
                                    <label class="col" style="flex: 1;">Total Koin (Rupiah)</label>
                                    <input type="text" id="denomKoin" class="form-control denom-input" placeholder="Rp 0" style="flex: 1;" inputmode="numeric">
                                </div>
                            </div>
                            
                            <div class="col" style="flex: 1; min-width: 300px; background: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px;">
                                <h3>Ringkasan Rekonsiliasi</h3>
                                <hr class="divider">
                                <div class="summary-box mt-3">
                                    <div class="summary-row">
                                        <span>Total Uang Fisik (Kalkulasi)</span>
                                        <strong id="closingFisik" class="text-green">Rp 0</strong>
                                    </div>
                                    <div class="summary-row" style="color:#C084FC; font-size:0.9rem; margin-top:4px;">
                                        <span>Total Valas (Nilai Stok dalam Rp)</span>
                                        <span id="closingValasValue">Rp 0</span>
                                    </div>
                                    <div class="summary-row">
                                        <span>Total Bank (BCA + Mandiri)</span>
                                        <strong id="closingBankSistem">Rp 0</strong>
                                    </div>
                                    <div class="summary-row" style="font-size:0.8rem; color:#93C5FD; margin-top:2px; padding-left:12px;">
                                        <span>↳ BCA</span><span id="closingBankBca">Rp 0</span>
                                    </div>
                                    <div class="summary-row" style="font-size:0.8rem; color:#93C5FD; margin-top:2px; padding-left:12px;">
                                        <span>↳ Mandiri</span><span id="closingBankMandiri">Rp 0</span>
                                    </div>
                                    <div class="summary-row">
                                        <span>Total Rp (Sisa di Brankas)</span>
                                        <strong id="closingKasSistem">Rp 0</strong>
                                    </div>
                                    <div class="summary-row" style="color: #F87171; font-size: 0.9rem; margin-top: 4px;">
                                        <span>Pengeluaran Hari Ini</span>
                                        <span id="closingTotalExpenses">Rp 0</span>
                                    </div>
                                    <div class="summary-row" style="color: #F59E0B; font-size: 0.9rem; margin-top: 6px;">
                                        <span>Total Gantungan (Piutang)</span>
                                        <span id="closingGantunganPiutang">Rp 0</span>
                                    </div>
                                    <div class="summary-row hidden" aria-hidden="true"><span>Gantungan Utang</span><span id="closingGantunganUtang">Rp 0</span></div>
                                    <div class="summary-row hidden" aria-hidden="true"><span>Total Sistem</span><span id="closingTotalSistemRupiah">Rp 0</span></div>
                                    <div class="summary-row hidden" aria-hidden="true"><span>Total Fisik + Bank</span><span id="closingTotalFisikBank">Rp 0</span></div>
                                    <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
                                    <div class="summary-row">
                                        <span>Selisih Rekonsiliasi</span>
                                        <h2 id="closingSelisih">Rp 0</h2>
                                    </div>
                                </div>
                                
                                <div class="form-group mt-4">
                                    <label>Tanggal & Waktu Closing (Kosongkan jika hari ini/sekarang)</label>
                                    <input type="datetime-local" id="closingDateInput" class="form-control" onchange="calculateClosingPhysical()">
                                </div>
                                <div class="form-group mt-2">
                                    <label>Jenis Closing</label>
                                    <select id="closingType" class="form-control" onchange="updateClosingModeUi()">
                                        <option value="temporary">Cek Sementara</option>
                                        <option value="final">Closing Final</option>
                                    </select>
                                    <small id="closingModeHelp" class="text-muted" style="display:block; margin-top:6px;">Cek sementara hanya mencatat posisi kas dan tidak mengubah saldo kas sistem.</small>
                                </div>
                                <div class="form-group mt-2">
                                    <label>Catatan Closing (Opsional)</label>
                                    <textarea id="closingNote" class="form-control" rows="3" placeholder="Keterangan jika ada selisih..."></textarea>
                                </div>
                                
                                <button id="btnSaveClosing" class="btn btn-primary btn-block btn-lg mt-3" onclick="saveClosing()"><i class="fa-solid fa-clipboard-check"></i> Simpan Cek Sementara</button>
                                <button class="btn btn-secondary btn-block mt-2" onclick="openClosingHistoryModal()"><i class="fa-solid fa-history"></i> Lihat Riwayat Closing</button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Laporan CoreTax View -->
                <section id="laporan-coretax-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan Pajak (Basis CoreTax DJP)</h2>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <button class="btn btn-primary" onclick="exportCoretaxExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel CoreTax</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak Tampilan</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div class="filter-controls">
                            <div class="form-group row">
                                <div class="col-md-3">
                                    <label>Tipe Transaksi</label>
                                    <select id="coretaxFilterType" class="form-control" onchange="loadCoretaxReport()">
                                        <option value="">-- Semua --</option>
                                        <option value="JUAL">JUAL</option>
                                        <option value="BELI">BELI</option>
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <label>Dari Tanggal</label>
                                    <input type="date" id="coretaxStartDate" class="form-control" onchange="loadCoretaxReport()">
                                </div>
                                <div class="col-md-3">
                                    <label>Sampai Tanggal</label>
                                    <input type="date" id="coretaxEndDate" class="form-control" onchange="loadCoretaxReport()">
                                </div>
                                <div class="col-md-3" style="display: flex; align-items: flex-end;">
                                    <button class="btn btn-secondary w-100" onclick="loadCoretaxReport()"><i class="fa-solid fa-filter"></i> Terapkan Filter</button>
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive mt-4">
                            <table class="table table-bordered" id="coretaxTable">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>No. Dokumen (Invoice)</th>
                                        <th>NIK / NPWP</th>
                                        <th>Nama Lawan Transaksi</th>
                                        <th>Uraian Transaksi</th>
                                        <th style="text-align: right;">DPP (Total IDR)</th>
                                        <th style="text-align: right;">Pajak / PPN</th>
                                    </tr>
                                </thead>
                                <tbody id="coretaxTableBody">
                                    <tr>
                                        <td colspan="7" class="text-center text-muted">Tidak ada data untuk rentang waktu ini.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-balance" onclick="switchSettingsTab('balance')"><i class="fa-solid fa-scale-balanced"></i> Saldo Awal</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-users" onclick="switchSettingsTab('users')"><i class="fa-solid fa-users-gear"></i> Pengguna & Akses</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-danger" onclick="switchSettingsTab('danger')"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone</button>
                            <button class="btn btn-outline btn-sm settings-tab-btn" id="btn-tab-settings-ai" onclick="switchSettingsTab('ai')"><i class="fa-solid fa-robot"></i> Asisten AI</button>
                        </div>
                    </div>

                    <div class="panel settings-tab-content" id="settings-tab-profile">
                        <h2>Pengaturan Identitas Perusahaan</h2>
                        <hr class="divider mb-4">
                        <div class="form-group">
                            <label>Nama Perusahaan / Toko</label>
                            <input type="text" id="profName" class="form-control" placeholder="Contoh: MC-ALMARA">
                        </div>
                        <div class="form-group row">
                            <div class="col">
                                <label>Alamat Perusahaan</label>
                                <textarea id="profAddress" class="form-control" rows="2" placeholder="Contoh: Jl. Sudirman No 123..."></textarea>
                            </div>
                            <div class="col">
                                <label>Nomor Izin BI</label>
                                <input type="text" id="profBiLicense" class="form-control" placeholder="Contoh: No. 12/345/BI/2026">
                            </div>
                            <div class="col">
                                <label>Kode IDPJK (Penyelenggara)</label>
                                <input type="text" id="profIdpjk" class="form-control" placeholder="Contoh: 12345678">
                            </div>
                        </div>
                        <div class="form-group row">
                            <div class="col">
                                <label>No. Telepon Kantor</label>
                                <input type="text" id="profPhone" class="form-control" placeholder="Contoh: 021-1234567">
                            </div>
                            <div class="col">
                                <label>Nomor WhatsApp (Untuk Struk)</label>
                                <input type="text" id="profWaNumber" class="form-control" placeholder="Contoh: 08123456789">
                            </div>
                            <div class="col">
                                <label>Pesan Footer (Untuk Struk)</label>
                                <input type="text" id="profFooter" class="form-control" placeholder="Contoh: Terima Kasih Atas Kunjungan Anda">
                            </div>
                        </div>
                        <div class="form-group row mt-3">
                            <div class="col-md-4">
                                <label style="color: #10B981;">Token / API Key AI Cloud (Vision)</label>
                                <input type="password" id="profVisionKey" class="form-control" placeholder="Masukkan Google API Key">
                            </div>
                        </div>
                        <div class="form-group mt-3">
                            <label>Template Pesan WhatsApp (Pengiriman Bukti Digital)</label>
                            <textarea id="profWaTemplate" class="form-control" rows="8" placeholder="Ketik template Anda di sini..."></textarea>
                            <div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 10px; margin-top: 10px; font-size: 0.8rem; color: #94A3B8;">
                                <strong class="text-white">Gunakan Tag Dinamis Berikut:</strong><br>
                                <code>[NAMA_MC]</code> : Nama Toko/Perusahaan<br>
                                <code>[NAMA_NASABAH]</code> : Memanggil Nama Nasabah Terpilih (atau 'Kak' jika Umum)<br>
                                <code>[NO_INVOICE]</code> : Nomor Invoice<br>
                                <code>[TANGGAL]</code> : Tanggal Transaksi<br>
                                <code>[VALUTA_LIST]</code> : Daftar Rincian Valuta<br>
                                <code>[GRAND_TOTAL]</code> : Nilai Total Tagihan / Kembali<br>
                                <code>[METODE_BAYAR]</code> : Metode Pembayaran (CASH/TRANSFER/SPLIT)<br>
                                <code>[METODE_RINCIAN]</code> : Rincian Split Bill (Jika SPLIT)<br>
                            </div>
                        </div>
                        <div class="form-group mt-3" id="faviconUploadGroup">
                            <label><i class="fa-solid fa-image"></i> Favicon Aplikasi</label>
                            <input type="file" id="faviconUploadInput" class="form-control" accept="image/png">
                            <small class="text-muted" style="display:block; margin-top:6px;">Unggah PNG persegi (disarankan 512 × 512 px, maksimal 1 MB). Ikon ini tampil di tab browser dan akan menggantikan favicon bawaan.</small>
                            <div style="display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap;">
                                <img id="faviconPreview" src="{{ file_exists($faviconPath) ? asset('favicon.png') . '?v=' . filemtime($faviconPath) : asset('favicon.ico') }}" alt="Preview favicon" style="width:36px; height:36px; object-fit:contain; border:1px solid #dce4e8; border-radius:7px; background:#fff; padding:3px;">
                                <button type="button" class="btn btn-outline btn-sm" onclick="uploadAppFavicon()"><i class="fa-solid fa-upload"></i> Unggah Favicon</button>
                            </div>
                        </div>
                        <button class="btn btn-primary mt-3" onclick="submitProfile()"><i class="fa-solid fa-save"></i> Simpan Pengaturan Profil</button>
                    </div>

                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-wa" style="display:none;">
                        <div class="flex-between" style="gap: 12px; flex-wrap: wrap;">
                            <div>
                                <h2>Template WhatsApp</h2>
                                <p class="text-muted mt-2">Kelola pilihan pesan yang muncul di tombol WA riwayat transaksi.</p>
                            </div>
                            <button class="btn btn-success" onclick="newWaTemplate()"><i class="fa-solid fa-plus"></i> Template Baru</button>
                        </div>
                        <hr class="divider mb-4">

                        <div class="row" style="display:flex; gap:20px; flex-wrap:wrap;">
                            <div class="col" style="flex: 1.1; min-width: 320px;">
                                <div class="table-responsive">
                                    <table class="table table-bordered">
                                        <thead>
                                            <tr>
                                                <th>Nama Template</th>
                                                <th>Kategori</th>
                                                <th>Peruntukan Tombol WA</th>
                                                <th style="width:90px; text-align:center;">Default</th>
                                                <th style="width:130px; text-align:center;">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody id="waTemplatesTableBody">
                                            <tr><td colspan="5" class="text-center text-muted">Belum ada template.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="col" style="flex: 1; min-width: 320px;">
                                <input type="hidden" id="waTemplateId">
                                <div class="form-group">
                                    <label>Nama Template</label>
                                    <input type="text" id="waTemplateName" class="form-control" placeholder="Contoh: Reminder DP">
                                </div>
                                <div class="form-group">
                                    <label>Kategori</label>
                                    <input type="text" id="waTemplateCategory" class="form-control" placeholder="Contoh: Transaksi / Follow Up">
                                </div>
                                <div class="form-group">
                                    <label>Isi Pesan</label>
                                    <textarea id="waTemplateContent" class="form-control" rows="10" placeholder="Tulis pesan template WA..."></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Peruntukan Template</label>
                                    <small class="text-muted" style="display:block; margin:-2px 0 8px;">Pilih tombol/halaman WA yang memakai template ini. Template tanpa pilihan memakai status Default.</small>
                                    <div id="waTemplatePurposes" style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:7px; padding:10px; border:1px solid rgba(255,255,255,.1); border-radius:8px;"></div>
                                </div>
                                <label style="display:flex; gap:8px; align-items:center; margin: 8px 0 14px;">
                                    <input type="checkbox" id="waTemplateDefault">
                                    Jadikan default untuk tombol WA transaksi
                                </label>
                                <div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 10px; font-size: 0.8rem; color: #94A3B8;">
                                    <strong class="text-white">Tag yang bisa dipakai:</strong><br>
                                    <code>[NAMA_MC]</code>, <code>[NO_HP_MC]</code>, <code>[NAMA_NASABAH]</code>, <code>[NO_INVOICE]</code>, <code>[TANGGAL]</code>, <code>[VALUTA_LIST]</code>, <code>[GRAND_TOTAL]</code>, <code>[METODE_BAYAR]</code>, <code>[METODE_RINCIAN]</code>
                                </div>
                                <div class="mt-3" style="display:flex; gap:10px; flex-wrap:wrap;">
                                    <button class="btn btn-primary" onclick="saveWaTemplateFromSettings()"><i class="fa-solid fa-save"></i> Simpan Template</button>
                                    <button class="btn btn-secondary" onclick="newWaTemplate()"><i class="fa-solid fa-eraser"></i> Bersihkan Kolom</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-wa-gateway" style="display:none;">
                        <div class="flex-between" style="gap: 12px; flex-wrap: wrap;">
                            <div>
                                <h2><i class="fa-solid fa-tower-broadcast" style="color:#25D366;"></i> Pengaturan WhatsApp Gateway</h2>
                                <p class="text-muted mt-2">Simpan koneksi provider WhatsApp Gateway untuk integrasi pengiriman pesan otomatis.</p>
                            </div>
                            <span id="waGatewayStatus" class="badge" style="background:#64748b;color:#fff;padding:6px 10px;border-radius:99px;">Nonaktif</span>
                        </div>
                        <hr class="divider mb-4">

                        <div class="form-group row">
                            <div class="col-md-4">
                                <label>Provider / Nama Gateway</label>
                                <input type="text" id="waGatewayProvider" class="form-control" placeholder="Contoh: Fonnte, Wablas, WAHA">
                            </div>
                            <div class="col-md-8">
                                <label>URL Endpoint API</label>
                                <input type="url" id="waGatewayEndpoint" class="form-control" placeholder="https://domain-gateway.com/api/send-message">
                                <small class="text-muted">Masukkan endpoint pengiriman pesan dari provider Anda.</small>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:-2px 0 14px;">
                            <span class="text-muted" style="font-size:.8rem;">Pakai format siap pakai:</span>
                            <button type="button" class="btn btn-sm btn-outline" onclick="applyWaGatewayPreset('fonnte')"><i class="fa-solid fa-wand-magic-sparkles"></i> Gunakan Format Fonnte</button>
                            <small class="text-muted">Token tetap Anda isi dari dashboard Fonnte.</small>
                        </div>
                        <div class="form-group row">
                            <div class="col-md-3">
                                <label>Metode Request</label>
                                <select id="waGatewayMethod" class="form-control"><option value="POST">POST</option><option value="GET">GET</option></select>
                            </div>
                            <div class="col-md-3">
                                <label>Format Body</label>
                                <select id="waGatewayBodyFormat" class="form-control"><option value="form">Form Data</option><option value="json">JSON</option></select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Header API (JSON)</label>
                            <textarea id="waGatewayHeaders" class="form-control" rows="3" spellcheck="false" placeholder='Contoh: {"Authorization":"{TOKEN}"}'></textarea>
                        </div>
                        <div class="form-group">
                            <label>Payload API (JSON)</label>
                            <textarea id="waGatewayPayload" class="form-control" rows="5" spellcheck="false" placeholder='Contoh: {"target":"{TARGET}","message":"{MESSAGE}"}'></textarea>
                            <small class="text-muted">Placeholder tersedia: <code>{TOKEN}</code>, <code>{TARGET}</code>, <code>{MESSAGE}</code>, <code>{SENDER}</code>, <code>{REFERENCE}</code>. Ikuti dokumentasi provider Anda.</small>
                        </div>
                        <div class="form-group row">
                            <div class="col-md-6">
                                <label>Token / API Key</label>
                                <div style="display:flex; gap:8px;">
                                    <input type="password" id="waGatewayToken" class="form-control" autocomplete="new-password" placeholder="Token dari provider WhatsApp Gateway">
                                    <button type="button" class="btn btn-outline" onclick="toggleWaGatewayTokenVisibility()" title="Tampilkan/sembunyikan token"><i class="fa-solid fa-eye"></i></button>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <label>Nomor Pengirim / Device ID</label>
                                <input type="text" id="waGatewaySender" class="form-control" placeholder="Contoh: 628123456789 atau device-utama">
                            </div>
                        </div>
                        <label style="display:flex; align-items:center; gap:9px; margin: 14px 0; cursor:pointer;">
                            <input type="checkbox" id="waGatewayEnabled" onchange="persistWaGatewayEnabled(); updateWaGatewayStatus()">
                            Aktifkan WhatsApp Gateway untuk integrasi otomatis
                        </label>
                        <div style="background:rgba(245,158,11,.10);border-left:3px solid #f59e0b;padding:10px 12px;font-size:.82rem;color:#cbd5e1;">
                            Semua tombol WhatsApp aplikasi memakai koneksi ini. Isi header dan payload sesuai dokumentasi provider agar Anda bisa mengganti gateway tanpa perubahan kode.
                        </div>
                        <div class="mt-3" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;">
                            <button class="btn btn-primary" onclick="saveWaGatewaySettings()"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan WA Gateway</button>
                            <div style="min-width:220px;flex:1;max-width:360px;">
                                <label style="font-size:.78rem;">Nomor WA untuk tes</label>
                                <input type="text" id="waGatewayTestPhone" class="form-control" placeholder="Contoh: 081234567890">
                            </div>
                            <button class="btn btn-success" onclick="testWaGatewayConnection()"><i class="fa-solid fa-paper-plane"></i> Kirim Pesan Tes</button>
                        </div>
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
                            <strong>Catatan kurs modal awal:</strong> kurs pada menu `Saldo Awal` sekarang independen. Kode valas masih bisa diambil dari `Manajemen Kurs`, tetapi nilai kurs diisi dan disimpan manual di Pengaturan, tidak mengikuti `Sync Smartdeal`, dan tidak otomatis berubah dari halaman kurs utama.
                        </div>

                        <div class="mt-4 p-3 rounded text-center" style="background: #1e293b; border: 1px solid #334155;">
                            <h3 class="m-0" style="color: #38bdf8;">Total Keseluruhan Modal: <span id="initTotalModalDisplay">Rp 0</span></h3>
                            <small class="text-muted">Gabungan Kas + Bank + Total Ekuivalen Valas</small>
                        </div>
                        
                        <button class="btn btn-success mt-4 w-100" onclick="saveInitialBalances()"><i class="fa-solid fa-save"></i> Terapkan Semua Saldo Awal ke Sistem</button>
                    </div>

                    <!-- Manajemen Pengguna (User Management) -->
                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-users" style="display:none;">
                        <div id="userManagementPanel">
                        <div class="flex-between">
                            <h2><i class="fa-solid fa-users-gear"></i> Manajemen Pengguna (Akses)</h2>
                            <button class="btn btn-primary" onclick="openUserModal()"><i class="fa-solid fa-user-plus"></i> Tambah Pengguna</button>
                        </div>
                        <hr class="divider mb-4">
                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th style="width: 50px;">Foto</th>
                                        <th>Username</th>
                                        <th>Nama Lengkap</th>
                                        <th>Role / Akses</th>
                                        <th class="text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="userTableBody">
                                    <!-- Dynamic Users -->
                                </tbody>
                            </table>
                        </div>
                        <div class="mt-4" id="roleAccessSettingsPanel">
                            <div class="flex-between" style="align-items: flex-start; gap: 12px;">
                                <div>
                                    <h3 style="margin-bottom: 6px;"><i class="fa-solid fa-key"></i> Setting Hak Akses</h3>
                                    <p class="text-muted" style="margin: 0;">Atur sendiri menu dan area khusus untuk tiap role pengguna.</p>
                                </div>
                                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                                    <select id="roleAccessEditor" class="form-control" onchange="loadRoleAccessEditor()" style="min-width: 170px;">
                                        <option value="owner">Owner</option>
                                        <option value="admin">Admin</option>
                                        <option value="kasir">Kasir</option>
                                        <option value="teller">Teller</option>
                                    </select>
                                    <button class="btn btn-outline" onclick="resetRoleAccessToDefault()"><i class="fa-solid fa-rotate-left"></i> Reset Default</button>
                                    <button class="btn btn-primary" onclick="saveRoleAccessSettings()"><i class="fa-solid fa-save"></i> Simpan Hak Akses</button>
                                </div>
                            </div>
                            <div class="row mt-3" style="display:flex; gap:20px; flex-wrap:wrap;">
                                <div class="col" style="flex: 2; min-width: 320px;">
                                    <label class="mb-2 d-block">Akses Menu</label>
                                    <div id="roleAccessMenuList" style="display:grid; gap:14px;"></div>
                                </div>
                                <div class="col" style="flex: 1; min-width: 260px;">
                                    <label class="mb-2 d-block">Area Khusus</label>
                                    <div id="roleAccessSpecialList" style="display:grid; gap:10px;"></div>
                                    <label class="mb-2 d-block mt-4">Hak Tombol Aksi</label>
                                    <div id="roleAccessActionList" style="display:grid; gap:10px;"></div>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    <!-- User Modal Form (Hidden) -->
                    <div id="userModal" class="modal">
                        <div class="modal-content panel" style="max-width: 400px; max-height: 90vh; overflow-y: auto;">
                            <div class="flex-between mb-3">
                                <h3 id="userModalTitle">Form Pengguna</h3>
                                <span class="close-modal" onclick="closeUserModal()"><i class="fa-solid fa-xmark"></i></span>
                            </div>
                            <div style="display:flex; gap:8px; justify-content:flex-end; margin-bottom:10px;">
                                <button type="button" class="btn btn-sm btn-outline" onclick="scrollUserProfileForm('userModal', -1)"><i class="fa-solid fa-arrow-up"></i> Atas</button>
                                <button type="button" class="btn btn-sm btn-outline" onclick="scrollUserProfileForm('userModal', 1)"><i class="fa-solid fa-arrow-down"></i> Bawah</button>
                            </div>
                            <hr class="divider mb-3">
                            <input type="hidden" id="editUserId">
                            <div class="form-group mb-2">
                                <label>Username</label>
                                <input type="text" id="mUserUsername" class="form-control">
                            </div>
                            <div class="form-group mb-2">
                                <label>Nama Lengkap</label>
                                <input type="text" id="mUserFullName" class="form-control">
                            </div>
                            <div class="form-group mb-2" style="text-align: center;">
                                <label>Foto Profil / Wajah (Opsional)</label>
                                <input type="file" id="mUserPhoto" class="form-control" accept="image/*" onchange="handleUserPhoto(this)">
                                <div id="previewUserPhoto" style="margin-top:10px; max-height:100px; display:flex; justify-content:center; overflow:hidden; border-radius: 5px;"></div>
                            </div>
                            <div class="form-group mb-2">
                                <label>Password (Isi jika ingin diubah/baru)</label>
                                <input type="password" id="mUserPassword" class="form-control" placeholder="Kata sandi...">
                            </div>
                            <div class="form-group mb-3">
                                <label>Role (Hak Akses)</label>
                                <select id="mUserRole" class="form-control" style="background-image: none;">
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
                            </div>
                            <button class="btn btn-primary w-100 mt-2" onclick="saveUser()"><i class="fa-solid fa-save"></i> Simpan Pengguna</button>
                        </div>
                    </div>


                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-danger" style="display:none; border: 1px solid #ef4444;">
                        <h2 style="color: #3B82F6;"><i class="fa-solid fa-triangle-exclamation"></i> Manajemen Data (Danger Zone)</h2>
                        <p class="mt-2 text-muted">Pilih hanya halaman/data yang ingin direset. Master valuta, profil perusahaan, dan pengguna tidak dihapus dari sini.</p>
                        <div class="mt-3" style="padding: 12px 14px; background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 6px;">
                            <div style="font-weight: 600; margin-bottom: 8px;">Pilih data yang ingin direset:</div>
                            <div class="text-muted" style="line-height: 1.7; display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px 16px;">
                                <label><input type="checkbox" data-reset-scope="transactions"> Transaksi Utama & Riwayat</label>
                                <label><input type="checkbox" data-reset-scope="customers"> Data Nasabah</label>
                                <label><input type="checkbox" data-reset-scope="cashBank"> Kas & Saldo Bank</label>
                                <label><input type="checkbox" data-reset-scope="currencyStock"> Stok Valas</label>
                                <label><input type="checkbox" data-reset-scope="expenses"> Pengeluaran</label>
                                <label><input type="checkbox" data-reset-scope="operations"> Mutasi, Closing, Penyesuaian, Aset, Investor & HRIS</label>
                                <label><input type="checkbox" data-reset-scope="bookingDemo"> Booking & Demo Transaksi</label>
                                <label><input type="checkbox" data-reset-scope="gantungan"> Gantungan</label>
                                <label><input type="checkbox" data-reset-scope="oldMoney"> Koin & Uang Lama</label>
                                <label><input type="checkbox" data-reset-scope="biRates"> Kurs BI / LKU</label>
                            </div>
                            </div>
                            <div class="d-flex gap-2 mt-4 flex-wrap">
                                <button type="button" class="btn btn-success" onclick="backupDatabase()"><i class="fa-solid fa-download"></i> Backup Database (Unduh JSON)</button>
                                <button type="button" class="btn btn-info" onclick="triggerRestore()" style="background: #3b82f6; color: white; border: none; outline: none; border-radius: 6px; padding: 10px 15px;"><i class="fa-solid fa-upload"></i> Restore Database File</button>
                                <input type="file" id="restoreFileInput" style="display: none;" accept=".json" onchange="restoreDatabase(event)">
                                <button type="button" class="btn btn-danger" onclick="resetSelectedData()"><i class="fa-solid fa-trash"></i> Reset Data yang Dipilih</button>
                            </div>
                        </div>

                    <div class="panel mt-4 settings-tab-content hidden" id="settings-tab-ai" style="display:none;">
                        <h2>Konfigurasi Asisten AI</h2>
                        <hr class="divider mb-4">
                        <p class="text-muted mb-3">Aplikasi ini mendukung Asisten AI berbasis Google Gemini atau ChatGPT/OpenAI untuk mendeteksi mata uang/koin dari gambar dan tanya jawab cerdas secara instan.</p>
                        <div class="form-group mb-3">
                            <label>Provider AI Aktif</label>
                            <select id="settingsAiProvider" class="form-control">
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">ChatGPT / OpenAI</option>
                            </select>
                            <small class="text-muted" style="display: block; margin-top: 4px;">Pilih provider yang akan dipakai di halaman Tanya AI / Deteksi Valas.</small>
                        </div>
                        <div class="form-group mb-3">
                            <label>Google Gemini API Key</label>
                            <input type="password" id="settingsGeminiKey" class="form-control" placeholder="Masukkan Google Gemini API Key Anda (misal: AIzaSy...)">
                            <small class="text-muted" style="display: block; margin-top: 4px;">Kunci API disimpan secara lokal di browser Anda untuk privasi penuh. Anda bisa mendapatkan Kunci API gratis dari Google AI Studio.</small>
                        </div>
                        <div class="form-group mb-3">
                            <label>ChatGPT / OpenAI API Key</label>
                            <input type="password" id="settingsOpenAiKey" class="form-control" placeholder="Masukkan OpenAI API Key Anda">
                            <small class="text-muted" style="display: block; margin-top: 4px;">Digunakan saat provider aktif adalah ChatGPT / OpenAI.</small>
                        </div>
                        <div class="form-group mb-3">
                            <label>Model ChatGPT</label>
                            <input type="text" id="settingsOpenAiModel" class="form-control" placeholder="gpt-4o-mini">
                        </div>
                        <button class="btn btn-primary mt-2" onclick="saveAISettings()"><i class="fa-solid fa-save"></i> Simpan Pengaturan AI</button>
                    </div>
                </section>


                <!-- LAPORAN BI PLACEHOLDERS -->
                <section id="laporan-lku-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan LKU (Bank Indonesia)</h2>
                            <p class="text-muted mt-2">Menampilkan data mutasi Saldo Awal, Total Beli, Total Jual, dan Sisa Stok KUPVA berdasarkan Kalkulator Retrospektif.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
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

                        <div class="mt-4" style="padding: 16px; border: 1px solid rgba(59,130,246,0.35); border-radius: 8px; background: rgba(15,23,42,0.35);">
                            <div class="flex-between" style="gap: 12px; flex-wrap: wrap;">
                                <div>
                                    <h3 style="margin-bottom: 4px;">Kurs Tengah BI Bulanan</h3>
                                    <small class="text-muted">Input kurs akhir bulan untuk valuasi sisa akhir LKU. Kurs awal otomatis memakai kurs BI bulan sebelumnya.</small>
                                </div>
                            </div>

                            <div class="form-group row mt-3" style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
                                <input type="hidden" id="biRateEditId" value="">
                                <div style="flex:1; min-width:160px;">
                                    <label>Periode Bulan</label>
                                    <input type="month" id="biRatePeriod" class="form-control" onchange="applyLkuPeriodToDates(this.value); renderBiRatesTable(); updateBiRateStatus(); loadLaporanLku();">
                                </div>
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
                <section id="laporan-sipesat-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan SIPESAT</h2>
                            <p class="text-muted mt-2">Sistem Informasi Pengawasan Terpadu (Daftar Nasabah berdasarkan Tanggal Input).</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportSipesatExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel (SIPESAT)</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>
                    
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-5">
                                <label>Dari Tanggal Input</label>
                                <input type="date" id="sipesatStartDate" class="form-control">
                            </div>
                            <div class="col-md-5">
                                <label>Sampai Tanggal Input</label>
                                <input type="date" id="sipesatEndDate" class="form-control">
                            </div>
                            <div class="col-md-2">
                                <label style="display:block; visibility:hidden; margin-bottom: 5px;">Filter Aksi</label>
                                <button type="button" class="btn btn-secondary w-100" id="btnFilterSipesat" onclick="loadLaporanSipesat()" style="position: relative; z-index: 10;"><i class="fa-solid fa-search"></i> Filter</button>
                            </div>
                        </div>

                        <div id="sipesatSummary" class="mt-3" style="padding: 10px 14px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; border-radius: 6px; color: #cbd5e1;">
                            Total data ditemukan: <strong id="sipesatTotalCount" style="color: #f8fafc;">0</strong>
                        </div>

                        <div class="table-responsive mt-3">
                            <table class="table table-bordered table-striped" style="border: 1px solid #e2e8f0; font-size: 0.85rem;" id="tableSipesat">
                                <thead class="text-center" style="background:#1e293b; color:#fff;">
                                    <tr>
                                        <th>No</th>
                                        <th>Tanggal Input</th>
                                        <th>ID Nasabah</th>
                                        <th>IDPJK</th>
                                        <th>Kode Nasabah</th>
                                        <th>Nama</th>
                                        <th>Tempat Lahir</th>
                                        <th>Tanggal Lahir</th>
                                        <th>Alamat</th>
                                        <th>No KTP</th>
                                        <th>No ID (Lainnya)</th>
                                        <th>No CIF</th>
                                        <th>NPWP</th>
                                        <th>Local ID</th>
                                    </tr>
                                </thead>
                                <tbody id="sipesatTableBody">
                                    <tr><td colspan="12" class="text-center text-muted">Pilih tanggal untuk memuat data SIPESAT...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                <section id="laporan-goaml-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Laporan GoAML (PPATK)</h2>
                        <p class="text-muted mt-2">Anti Money Laundering / Pencegahan Pencucian Uang untuk disetor ke sistem GoAML.</p>
                    </div>
                </section>
                <section id="laporan-sipendar-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Laporan SIPENDAR</h2>
                        <p class="text-muted mt-2">Sistem Informasi Pelaporan Ekspor Nilai Tunai & Uang Palsu.</p>
                    </div>
                </section>

                <!-- LAPORAN KEUANGAN PLACEHOLDERS -->
                <section id="laporan-bukubesar-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Buku Besar (General Ledger)</h2>
                        <p class="text-muted mt-2">Detail perpindahan Debit dan Kredit per akun.</p>
                    </div>
                    
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-4">
                                <label>Dari Tanggal</label>
                                <input type="date" id="glStartDate" class="form-control">
                            </div>
                            <div class="col-md-4">
                                <label>Sampai Tanggal</label>
                                <input type="date" id="glEndDate" class="form-control">
                            </div>
                            <div class="col-md-3">
                                <label>Pilih Akun Rekapitulasi</label>
                                <select id="glAccountFilter" class="form-control bg-dark text-white border-secondary">
                                    <option value="ALL">Semua Akun Kas/Bank</option>
                                    <option value="CASH">Kas Tunai Rupiah Berjalan</option>
                                    <option value="BANK">Rekening Bank</option>
                                </select>
                            </div>
                            <div class="col-md-1" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-secondary w-100" id="btnFilterGL"><i class="fa-solid fa-search"></i></button>
                            </div>
                        </div>

                        <div class="table-responsive mt-3">
                            <table class="table table-bordered table-striped" style="border: 1px solid #e2e8f0; font-size: 0.85rem;">
                                <thead class="text-center bg-dark text-white">
                                    <tr>
                                        <th>Waktu (Timestamp)</th>
                                        <th>Kode Referensi</th>
                                        <th>Keterangan Transaksi</th>
                                        <th style="color: #10b981;">Debit (Masuk)</th>
                                        <th style="color: #ef4444;">Kredit (Keluar)</th>
                                        <th>Saldo Kumulatif</th>
                                    </tr>
                                </thead>
                                <tbody id="glTableBody">
                                    <tr><td colspan="6" class="text-center text-muted">Data akan otomatis terhubung selagi Anda melakukan transaksi.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                
                <section id="laporan-neraca-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Neraca (Balance Sheet)</h2>
                        <p class="text-muted mt-2">Laporan posisi keuangan Tanggal tersebut secara garis besar (Aktiva lancar, Kewajiban, Modal dipertahankan).</p>
                    </div>
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-5">
                                <label>Hitung Posisi Per Tanggal/Waktu Terkini</label>
                                <input type="date" id="neracaDate" class="form-control">
                            </div>
                            <div class="col-md-2" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-secondary w-100" id="btnFilterNeraca" onclick="loadLaporanNeraca()"><i class="fa-solid fa-search"></i> Kalkulasi Ulang</button>
                            </div>
                        </div>
                        
                        <div class="row mt-4">
                            <!-- AKTIVA -->
                            <div class="col-md-6">
                                <div class="p-3 rounded" style="background:#1e293b; border:1px solid #334155;">
                                    <h4 class="text-center" style="color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom:10px;">AKTIVA</h4>
                                    <table class="table table-borderless table-sm mt-3" style="color:#f8fafc; font-size: 0.85rem;">
                                        <tbody id="neracaAktivaBody">
                                            <tr><td>101-Kas dalam Rupiah</td><td class="text-end" id="val_101">0</td></tr>
                                            <tr><td>102-Bank dalam Rupiah</td><td class="text-end" id="val_102">0</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>103-Kas dalam UKA</td><td class="text-end" id="val_103">0</td></tr>
                                            <tr><td>104-Bank dalam UKA</td><td class="text-end" id="val_104">0</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>105-Piutang TC</td><td class="text-end" id="val_105">0</td></tr>
                                            <tr><td>106-Piutang Lain-Lain</td><td class="text-end" id="val_106">0</td></tr>
                                            <tr><td>107-Sewa dibayar Di Muka</td><td class="text-end" id="val_107">0</td></tr>
                                            <tr><td>108-Asuransi dibayar Di Muka</td><td class="text-end" id="val_108">0</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>109-Aset Tetap-harga perolehan</td><td class="text-end" id="val_109">0</td></tr>
                                            <tr><td>110-Akumulasi Penyusutan Aset Tetap (-/-)</td><td class="text-end" id="val_110">0</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>111-Aset Lain-lain</td><td class="text-end" id="val_111">0</td></tr>
                                        </tbody>
                                        <tfoot>
                                            <tr style="border-top:1px solid #475569;">
                                                <th class="py-2">Jumlah Aset</th>
                                                <th class="text-end py-2" id="neracaTotalAktiva">0</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <!-- PASIVA & EKUITAS -->
                            <div class="col-md-6 mt-3 mt-md-0">
                                <div class="p-3 rounded" style="background:#1e293b; border:1px solid #334155;">
                                    <h4 class="text-center" style="color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom:10px;">PASIVA</h4>
                                    <table class="table table-borderless table-sm mt-3" style="color:#f8fafc; font-size: 0.85rem;">
                                        <tbody id="neracaPasivaBody">
                                            <tr><td>201-Pinjaman dalam Rupiah</td><td class="text-end" id="val_201">0</td></tr>
                                            <tr><td>202-Pinjaman dalam UKA</td><td class="text-end" id="val_202">0</td></tr>
                                            <tr><td>203-Hutang Sewa</td><td class="text-end" id="val_203">0</td></tr>
                                            <tr><td>204-Kewajiban Pengiriman Uang</td><td class="text-end" id="val_204">0</td></tr>
                                            <tr><td>205-Kewajiban Lain-lain</td><td class="text-end" id="val_205">0</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>206-Modal Disetor</td><td class="text-end" id="val_206">0</td></tr>
                                            <tr><td>207-Laba Ditahan</td><td class="text-end" id="val_207">0</td></tr>
                                            <tr><td>290-Akumulasi Rugi (-/-)</td><td class="text-end" id="val_290">0</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                            <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                        </tbody>
                                        <tfoot>
                                            <tr style="border-top:1px solid #475569;">
                                                <th class="py-2">Jumlah Kewajiban dan Ekuitas</th>
                                                <th class="text-end py-2" id="neracaTotalPasiva">0</th>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                <section id="laporan-labarugi-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Laba/Rugi (Profit & Loss)</h2>
                        <p class="text-muted mt-2">Rekapitulasi total pendapatan penjualan valuta kotor dan margin bersih setelah dikurangi beban operasional.</p>
                    </div>
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-5">
                                <label>Dari Tanggal (Periode Awal)</label>
                                <input type="date" id="plStartDate" class="form-control">
                            </div>
                            <div class="col-md-5">
                                <label>Sampai Tanggal (Periode Akhir)</label>
                                <input type="date" id="plEndDate" class="form-control">
                            </div>
                            <div class="col-md-2" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-secondary w-100" id="btnFilterPL" onclick="loadLaporanLabaRugi()"><i class="fa-solid fa-search"></i> Terapkan</button>
                            </div>
                        </div>

                        <div class="table-responsive mt-4">
                            <table class="table table-bordered table-sm" style="font-size:0.85rem; border: 1px solid #e2e8f0; border-collapse: collapse;">
                                <thead style="background:#1e293b; color:#fff;">
                                    <tr><th colspan="3" class="p-2 text-center">Akun</th></tr>
                                </thead>
                                <tbody id="plPendapatanBody">
                                    <tr><td colspan="2" class="ps-3">01-Penjualan UKA</td><td class="text-end" id="pl_01">0</td></tr>
                                    <tr><td colspan="2" class="ps-3">02-Pencairan TC</td><td class="text-end" id="pl_02">0</td></tr>
                                    <tr><td colspan="3">&nbsp;</td></tr>
                                    <tr><td class="ps-4">03-Saldo Awal UKA dan TC</td><td class="text-end" id="pl_03">0</td><td></td></tr>
                                    <tr><td class="ps-4">04-Pembelian UKA dan TC</td><td class="text-end" id="pl_04">0</td><td></td></tr>
                                    <tr><td class="ps-4">05-Saldo Akhir UKA dan TC</td><td class="text-end" id="pl_05">0</td><td></td></tr>
                                </tbody>
                                <tbody>
                                    <tr style="background:#f8fafc;"><th colspan="2" class="ps-3 py-2">Pendapatan/(Rugi) Operasional Kotor UKA-TC</th><th class="text-end py-2" id="pl_kotor_ukatc">0</th></tr>
                                    <tr><td colspan="2" class="ps-3">06-Pendapatan Pengiriman Uang</td><td class="text-end" id="pl_06">0</td></tr>
                                    <tr style="background:#f1f5f9; border-top: 2px solid #cbd5e1;"><th colspan="2" class="ps-3 py-2">Pendapatan/(Rugi) Operasional Kotor</th><th class="text-end py-2" id="pl_kotor_op">0</th></tr>
                                    
                                    <tr><td class="ps-4">07-Beban Gaji, Upah dan Tunjangan</td><td class="text-end" id="pl_07">0</td><td></td></tr>
                                    <tr><td class="ps-4">08-Beban Sewa</td><td class="text-end" id="pl_08">0</td><td></td></tr>
                                    <tr><td class="ps-4">09-Beban Iklan dan promosi</td><td class="text-end" id="pl_09">0</td><td></td></tr>
                                    <tr><td class="ps-4">10-Beban Air, Listrik dan Telepon</td><td class="text-end" id="pl_10">0</td><td></td></tr>
                                    <tr><td class="ps-4">11-Beban Transportasi dan perjalanan</td><td class="text-end" id="pl_11">0</td><td></td></tr>
                                    <tr><td class="ps-4">12-Beban Pemeliharaan kendaraan</td><td class="text-end" id="pl_12">0</td><td></td></tr>
                                    <tr><td class="ps-4">13-Penyusutan Aset Tetap</td><td class="text-end" id="pl_13">0</td><td></td></tr>
                                    <tr><td class="ps-4">14-Beban Asuransi</td><td class="text-end" id="pl_14">0</td><td></td></tr>
                                    <tr><td class="ps-4">15-Beban Lain-Lain (Operasional)</td><td class="text-end" id="pl_15">0</td><td></td></tr>
                                    
                                    <tr style="background:#f1f5f9; border-top: 2px solid #cbd5e1;"><th colspan="2" class="ps-3 py-2">Pendapatan/(Rugi) Operasional Bersih</th><th class="text-end py-2" id="pl_bersih_op">0</th></tr>
                                    
                                    <tr><td class="ps-4">16-Pendapatan Bunga bank</td><td class="text-end" id="pl_16">0</td><td></td></tr>
                                    <tr><td class="ps-4">17-Beban Administrasi Bank</td><td class="text-end" id="pl_17">0</td><td></td></tr>
                                    <tr><td class="ps-4">18-Beban Bunga Pinjaman</td><td class="text-end" id="pl_18">0</td><td></td></tr>
                                    <tr><td class="ps-4">19-Laba Penjualan Aset Tetap</td><td class="text-end" id="pl_19">0</td><td></td></tr>
                                    <tr><td class="ps-4">20-Rugi Penjualan Aset Tetap</td><td class="text-end" id="pl_20">0</td><td></td></tr>
                                    <tr><td class="ps-4">21-Laba Selisih Kurs</td><td class="text-end" id="pl_21">0</td><td></td></tr>
                                    <tr><td class="ps-4">22-Rugi Selisih Kurs</td><td class="text-end" id="pl_22">0</td><td></td></tr>
                                    <tr><td class="ps-4">23-Pendapatan Lain-Lain</td><td class="text-end" id="pl_23">0</td><td></td></tr>
                                    <tr><td class="ps-4">24-Beban Lain-Lain (Non Operasional)</td><td class="text-end" id="pl_24">0</td><td></td></tr>
                                    
                                    <tr style="background:#f1f5f9; border-top: 2px solid #cbd5e1;"><th colspan="2" class="ps-3 py-2">Laba/(Rugi) Sebelum Pajak Penghasilan</th><th class="text-end py-2" id="pl_sblm_pajak">0</th></tr>
                                    
                                    <tr><td colspan="2" class="ps-3">25-Pajak Penghasilan</td><td class="text-end" id="pl_25">0</td></tr>
                                </tbody>
                                <tfoot style="background:#10b981; border-color: #059669; color:#fff;">
                                    <tr>
                                        <th colspan="2" class="py-3 px-3" style="font-size:1.1rem;">Laba/(Rugi) Bersih</th>
                                        <th class="py-3 px-3 text-end fw-bold" style="font-size:1.1rem;" id="plLabaBersih">0</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </section>
                
                <section id="laporan-ekuitas-view" class="view-section hidden">
                    <div class="panel header-panel">
                        <h2>Laporan Perubahan Ekuitas</h2>
                        <p class="text-muted mt-2">Monitoring penambahan atau penarikan Modal pemilik / investasi pemodal utama untuk rekap deviden.</p>
                    </div>
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-5">
                                <label>Dari Tanggal (Periode)</label>
                                <input type="date" id="eqStartDate" class="form-control">
                            </div>
                            <div class="col-md-5">
                                <label>Sampai Tanggal (Periode)</label>
                                <input type="date" id="eqEndDate" class="form-control">
                            </div>
                            <div class="col-md-2" style="display: flex; align-items: flex-end;">
                                <button class="btn btn-secondary w-100" id="btnFilterEq" onclick="loadLaporanEkuitas()"><i class="fa-solid fa-search"></i> Terapkan</button>
                            </div>
                        </div>

                        <div class="table-responsive mt-4">
                            <table class="table table-bordered table-striped text-center" style="font-size:0.85rem; border: 1px solid #e2e8f0; border-collapse: collapse;">
                                <thead style="background:#1e293b; color:#fff;">
                                    <tr>
                                        <th class="p-2">Keterangan</th>
                                        <th class="p-2">Modal Disetor</th>
                                        <th class="p-2">Laba Ditahan/Akumulasi Rugi</th>
                                        <th class="p-2">Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody id="eqBody">
                                    <tr><td class="text-start">01-Saldo Positif</td><td class="text-end" id="eq_01_m">0</td><td class="text-end" id="eq_01_l">0</td><td class="text-end" id="eq_01_j">0</td></tr>
                                    <tr><td class="text-start">02-Saldo Negatif</td><td></td><td class="text-end" id="eq_02_l">0</td><td></td></tr>
                                    <tr><td class="text-start">03-Laba periode berjalan (net)</td><td></td><td class="text-end" id="eq_03_l">0</td><td class="text-end" id="eq_03_j">0</td></tr>
                                    <tr><td class="text-start">04-Rugi periode berjalan (-/-)</td><td></td><td class="text-end" id="eq_04_l">0</td><td></td></tr>
                                    <tr><td class="text-start">05-Pembagian Dividen(-/-)</td><td></td><td class="text-end" id="eq_05_l">0</td><td class="text-end" id="eq_05_j">0</td></tr>
                                    <tr><td class="text-start">06-Menambah ekuitas (net)</td><td class="text-end" id="eq_06_m">0</td><td></td><td class="text-end" id="eq_06_j">0</td></tr>
                                    <tr><td class="text-start">07-Mengurangi ekuitas (-/-)</td><td class="text-end" id="eq_07_m">0</td><td></td><td></td></tr>
                                </tbody>
                                <tfoot>
                                    <tr style="background:#f1f5f9; font-weight:bold;">
                                        <td class="text-start py-2">TOTAL</td>
                                        <td class="text-end" id="eq_tot_m">0</td>
                                        <td class="text-end" id="eq_tot_l">0</td>
                                        <td class="text-end" id="eq_tot_j">0</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </section>

                <section id="laporan-aset-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan Aset & Penyusutan</h2>
                            <p class="text-muted mt-2">Daftar aset tetap perusahaan dan kalkulasi penyusutan secara garis lurus (Straight-line method).</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" onclick="exportTableToExcel('assetTable', 'Aset_Penyusutan')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                            <button class="btn btn-success" onclick="openAssetModal()"><i class="fa-solid fa-plus"></i> Tambah Aset</button>
                        </div>
                    </div>

                    <div class="panel mt-4">
                        <div class="table-responsive">
                            <table class="table table-bordered table-striped" style="border: 1px solid #e2e8f0; font-size: 0.9rem;" id="assetTable">
                                <thead style="background:#1e293b; color:#fff;">
                                    <tr>
                                        <th>Nama Aset</th>
                                        <th>Tgl Perolehan</th>
                                        <th>Harga Perolehan</th>
                                        <th>Masa Manfaat (Thn)</th>
                                        <th>Akumulasi Penyusutan</th>
                                        <th>Nilai Buku (Sisa)</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="assetTableBody">
                                    <!-- Injected by JS -->
                                </tbody>
                                <tfoot style="background:#0f172a; color:#fff;">
                                    <tr>
                                        <th colspan="2" class="text-end">TOTAL KESELURUHAN:</th>
                                        <th id="totalAssetPrice" class="text-success">Rp 0</th>
                                        <th></th>
                                        <th id="totalAssetDepreciation" class="text-danger">Rp 0</th>
                                        <th id="totalAssetBookValue" class="text-info">Rp 0</th>
                                        <th></th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
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
                            <button class="btn btn-primary" style="background: #10B981; border: none;" onclick="exportEkuitasExcel()"><i class="fa-solid fa-file-excel"></i> Export Ekuitas (BI Format)</button>
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

                <!-- EKUITAS VIEW (BI FORMAT) -->
                <section id="laporan-ekuitas-view" class="view-section hidden">
                    <div class="panel header-panel flex-between">
                        <div>
                            <h2>Laporan Ekuitas (Format BI)</h2>
                            <p class="text-muted mt-2">Disesuaikan dengan format template resmi Bank Indonesia.</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" style="background: #10B981; border: none;" onclick="exportEkuitasExcel()"><i class="fa-solid fa-file-excel"></i> Export Ekuitas (BI Format)</button>
                            <button class="btn btn-secondary" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak PDF</button>
                        </div>
                    </div>
                    <div class="panel mt-4">
                        <div class="filter-controls form-group row">
                            <div class="col-md-10">
                                <label>Posisi per Tanggal</label>
                                <input type="date" id="eqDate" class="form-control" onchange="loadEkuitasUi()">
                            </div>
                        </div>
                        <div class="row mt-4">
                            <div class="col-md-12">
                                <table class="table table-bordered table-striped mt-3">
                                    <thead class="bg-dark text-white">
                                        <tr>
                                            <th>Keterangan</th>
                                            <th class="text-end">Modal Disetor</th>
                                            <th class="text-end">Laba Ditahan/Akumulasi Rugi</th>
                                            <th class="text-end">Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>01-Saldo Positif</td>
                                            <td class="text-end" id="ui_e_01">0</td>
                                            <td class="text-end">0</td>
                                            <td class="text-end" id="ui_e_01_total">0</td>
                                        </tr>
                                        <tr>
                                            <td>02-Saldo Negatif</td>
                                            <td class="text-end"></td>
                                            <td class="text-end" id="ui_e_02">0</td>
                                            <td class="text-end"></td>
                                        </tr>
                                        <tr>
                                            <td>03-Laba periode berjalan (net)</td>
                                            <td class="text-end"></td>
                                            <td class="text-end" id="ui_e_03">0</td>
                                            <td class="text-end" id="ui_e_03_total">0</td>
                                        </tr>
                                        <tr>
                                            <td>04-Rugi periode berjalan (-/-)</td>
                                            <td class="text-end"></td>
                                            <td class="text-end" id="ui_e_04">0</td>
                                            <td class="text-end"></td>
                                        </tr>
                                        <tr>
                                            <td>05-Pembagian Dividen(-/-)</td>
                                            <td class="text-end"></td>
                                            <td class="text-end" id="ui_e_05">0</td>
                                            <td class="text-end text-danger" id="ui_e_05_total">(0)</td>
                                        </tr>
                                        <tr>
                                            <td>06-Menambah ekuitas (net)</td>
                                            <td class="text-end"></td>
                                            <td class="text-end">0</td>
                                            <td class="text-end">0</td>
                                        </tr>
                                        <tr>
                                            <td>07-Mengurangi ekuitas (-/-)</td>
                                            <td class="text-end"></td>
                                            <td class="text-end">0</td>
                                            <td class="text-end"></td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr style="background:#f1f5f9; border-top:2px solid #334155; font-size:1.1rem; margin-top:10px;">
                                            <th>TOTAL</th>
                                            <th class="text-end" id="ui_e_t1">0</th>
                                            <th class="text-end" id="ui_e_t2">0</th>
                                            <th class="text-end" id="ui_e_total">0</th>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>

            </div> <!-- END CONTENT WRAPPER -->
        </main>
    </div>

    <!-- Currency Modal -->
    <div id="currencyModal" class="modal">
        <div class="modal-content panel">
            <div class="modal-header flex-between mb-4">
                <h2>Edit/Tambah Valuta</h2>
                <span class="close-modal" onclick="closeCurrencyModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Kode Valuta (Misal: USD)</label>
                <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px; margin: 6px 0;">
                    <small class="text-muted">Untuk kurs pecahan kecil, boleh buat kode turunan seperti USDK atau USD-K.</small>
                    <button type="button" class="btn btn-sm btn-outline" onclick="openIso4217Modal('currency')" style="white-space: nowrap;"><i class="fa-solid fa-book-open"></i> Buka ISO 4217</button>
                </div>
                <input type="text" id="modalCurCode" list="masterCurList" class="form-control" oninput="handleCurrencyCodeInput()" onblur="handleCurrencyCodeInput()">
                <datalist id="masterCurList"></datalist>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Base Rate Beli (Web/Master)</label>
                    <input type="number" id="modalCurBuy" class="form-control" oninput="calculateCurrencyHasil()">
                </div>
                <div class="col">
                    <label>Base Rate Jual (Web/Master)</label>
                    <input type="number" id="modalCurSell" class="form-control" oninput="calculateCurrencyHasil()">
                </div>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Stok Awal</label>
                    <input type="number" id="modalCurStock" class="form-control">
                </div>
                <div class="col">
                    <label>Batas Aman (Alert)</label>
                    <input type="number" id="modalCurAlert" class="form-control">
                </div>
            </div>
            <div class="form-group row mt-2">
                <div class="col">
                    <label>Selisih Beli (<small>Misal: -50</small>)</label>
                    <input type="number" id="modalMarginBuy" class="form-control" placeholder="-50" oninput="calculateCurrencyHasil()">
                    <div style="margin-top: 5px; font-size: 0.85rem; padding: 5px; background: rgba(16,185,137,0.1); border-left: 3px solid #10B981;">
                        Hasil Beli: <strong id="modalHasilBuy" class="text-green">0</strong>
                    </div>
                </div>
                <div class="col">
                    <label>Selisih Jual (<small>Misal: +50</small>)</label>
                    <input type="number" id="modalMarginSell" class="form-control" placeholder="50" oninput="calculateCurrencyHasil()">
                    <div style="margin-top: 5px; font-size: 0.85rem; padding: 5px; background: rgba(239,68,68,0.1); border-left: 3px solid #ef4444;">
                        Hasil Jual: <strong id="modalHasilSell" class="text-red">0</strong>
                    </div>
                </div>
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="saveCurrency()">Simpan</button>
        </div>
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
                                    <input type="radio" name="modalCustTypeGroup" value="1" onchange="toggleEntitas()">
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

                    <!-- Row 2: Nama & No Tlp -->
                    <div class="form-group">
                            <label>Nama Lengkap <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustName" class="form-control" placeholder="Sesuai Identitas">
                    </div>
                    <div class="form-group">
                            <label>No. TLP <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustPhone" class="form-control" placeholder="08xx...">
                    </div>

                    <!-- Row 3: Tempat & Tgl Lahir -->
                    <div class="form-group">
                            <label>Tempat Lahir <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustBirthPlace" class="form-control" placeholder="Kota/Kab">
                    </div>
                    <div class="form-group">
                            <label>Tanggal Lahir <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustBirthDate" class="form-control" placeholder="Pilih Tanggal..">
                    </div>

                    <!-- Row 4: Alamat & Jenis ID -->
                    <div class="form-group">
                            <label>Alamat (Sesuai ID) <span class="required-mark">*</span></label>
                            <textarea id="modalCustAddress" class="form-control" rows="2" placeholder="Alamat lengkap sesuai identitas"></textarea>
                    </div>
                    
                    <div class="form-group">
                            <label>Jenis Identitas <span class="required-mark">*</span></label>
                            <select id="modalCustIdType" class="form-control">
                                <option value="KTP">KTP (Indonesia)</option>
                                <option value="PASSPORT">Passport (Asing)</option>
                                <option value="SIM">SIM / Lainnya</option>
                            </select>
                    </div>

                    <!-- Row 5: KTP & ID Lain -->
                    <div class="form-group">
                            <label>Nomor KTP (NIK) <span class="required-mark">*</span></label>
                            <input type="text" id="modalCustNik" class="form-control" placeholder="Ketik NIK secara manual atau gunakan Auto-Fill" inputmode="numeric" autocomplete="off">
                    </div>
                    <div class="form-group">
                            <label>Nomor ID (Lainnya)</label>
                            <input type="text" id="modalCustIdNo" class="form-control" placeholder="Ketik nomor ID secara manual (opsional)" autocomplete="off">
                    </div>

                    <!-- Row 6: Gender, WN, Pekerjaan -->
                    <div class="form-group">
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
                    <div class="form-group field-full">
                            <label>Pekerjaan</label>
                            <select id="modalCustJob" class="form-control select2-modal">
                                <!-- Populated by master -->
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
                            <input type="text" id="modalCustCif" class="form-control" placeholder="Otomatis (AMR-0001 / P-0001)">
                            <small class="text-muted">Nomor unik nasabah untuk laporan mutasi.</small>
                        </div>
                    </div>

                    <!-- Row 8: NPWP, Local ID, Rekening -->
                    <div class="form-group">
                            <label>NPWP (Jika ada)</label>
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
        <div class="modal-content panel" style="width: 95%; max-width: 1200px; max-height: 90vh; overflow-y: auto; border-top: 5px solid #f59e0b;">
            <div class="modal-header flex-between mb-4">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-user-pen" style="color: #f59e0b; font-size: 1.5rem;"></i>
                    <h2 style="margin: 0;">Update Data Nasabah</h2>
                </div>
                <span class="close-modal" onclick="const m = document.getElementById('customerUpdateModal'); m.style.display='none'; m.classList.remove('show');">&times;</span>
            </div>

            <div class="row" style="display: flex; flex-wrap: wrap; gap: 20px;">
                <!-- Left Column: Photo & Scanner -->
                <div class="col-md-5" style="flex: 1; min-width: 300px; border-right: 1px dashed #334155; padding-right: 20px;">
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

                <!-- Right Column: Form Fields -->
                <div class="col-md-7" style="flex: 1.5; min-width: 350px;">
                    <!-- Hidden State -->
                    <input type="hidden" id="update_modalCustId">
                    
                    <div class="form-group row">
                        <div class="col">
                            <label>Tipe Entitas / KN(tipe) <span class="text-danger">*Wajib Pilih</span></label>
                            <div class="d-flex gap-2">
                                <label class="radio-card flex-fill text-center">
                                    <input type="radio" name="update_custType" value="1" id="update_typePerorangan"> 
                                    <div class="card-body p-2">
                                        <i class="fa-solid fa-user mb-1"></i><br><small>Perorangan (1)</small>
                                    </div>
                                </label>
                                <label class="radio-card flex-fill text-center">
                                    <input type="radio" name="update_custType" value="2" id="update_typePerusahaan">
                                    <div class="card-body p-2">
                                        <i class="fa-solid fa-building mb-1"></i><br><small>Perusahaan (2)</small>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div class="col">
                            <label>IDPJK</label>
                            <input type="text" id="update_modalCustIdpjk" class="form-control" placeholder="IDPJK Lengkap">
                        </div>
                    </div>

                    <div class="form-group row">
                        <div class="col">
                            <label>Nama Lengkap</label>
                            <input type="text" id="update_modalCustName" class="form-control" placeholder="Sesuai Identitas">
                        </div>
                        <div class="col">
                            <label>NO TLP</label>
                            <input type="text" id="update_modalCustPhone" class="form-control" placeholder="08xx....">
                        </div>
                    </div>

                    <div class="form-group row">
                        <div class="col">
                            <label>Tempat Lahir</label>
                            <input type="text" id="update_modalCustBirthPlace" class="form-control" placeholder="Kota/Kab">
                        </div>
                        <div class="col">
                            <label>Tanggal Lahir</label>
                            <input type="text" id="update_modalCustBirthDate" class="form-control flatpickr" placeholder="Pilih Tanggal..">
                        </div>
                    </div>

                    <div class="form-group row">
                        <div class="col">
                            <label>Alamat (Sesuai ID)</label>
                            <textarea id="update_modalCustAddress" class="form-control" rows="2" placeholder="Alamat lengkap..."></textarea>
                        </div>
                    </div>
                    
                    <div class="form-group row">
                        <div class="col">
                            <label>Jenis Identitas</label>
                            <select id="update_modalCustIdType" class="form-control">
                                <option value="KTP">KTP (Indonesia)</option>
                                <option value="PASSPORT">Passport (Asing)</option>
                                <option value="SIM">SIM / Lainnya</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group row">
                        <div class="col">
                            <label>Nomor KTP (NIK)</label>
                            <input type="text" id="update_modalCustNik" class="form-control" placeholder="16 Digit NIK">
                        </div>
                        <div class="col">
                            <label>Nomor ID (Lainnya)</label>
                            <input type="text" id="update_modalCustIdNo" class="form-control" placeholder="No Passport/SIM">
                        </div>
                    </div>

                    <div class="form-group row">
                        <div class="col">
                            <label>Jenis Kelamin</label>
                            <select id="update_modalCustGender" class="form-control">
                                <option value="Pria">Pria</option>
                                <option value="Wanita">Wanita</option>
                            </select>
                        </div>
                        <div class="col">
                            <label>Warga Negara</label>
                            <select id="update_modalCustCitizen" class="form-control select2-modal">
                                <!-- Populated via JS -->
                            </select>
                        </div>
                        <div class="col">
                            <label>Pekerjaan</label>
                            <select id="update_modalCustJob" class="form-control select2-modal">
                                <!-- Populated via JS -->
                            </select>
                        </div>
                    </div>

                    <!-- Readonly IDs and Update Date -->
                    <div class="form-group row" style="background: rgba(245, 158, 11, 0.05); padding: 10px; border-radius: 8px; border: 1px dashed #f59e0b;">
                        <div class="col">
                            <label style="color: #f59e0b; font-weight: bold;">ID Nasabah (Sistem)</label>
                            <input type="text" id="update_modalCustInternalId" class="form-control" readonly style="background-color: #1e293b; color: #94a3b8;">
                        </div>
                        <div class="col">
                            <label style="color: #f59e0b; font-weight: bold;">No. CIF (Reporting)</label>
                            <input type="text" id="update_modalCustCif" class="form-control" style="background-color: #1e293b; color: #fff;">
                        </div>
                        <div class="col">
                            <label style="color: #f59e0b; font-weight: bold;">Tanggal Update</label>
                            <input type="text" id="update_modalCustUpdateDate" class="form-control" readonly style="background-color: #1e293b; color: #F59E0B;">
                        </div>
                    </div>

                    <div class="form-group row mt-3">
                        <div class="col">
                            <label>NPWP (Jika ada)</label>
                            <input type="text" id="update_modalCustNpwp" class="form-control" placeholder="No NPWP">
                        </div>
                        <div class="col">
                            <label>Local ID (Ref External)</label>
                            <input type="text" id="update_modalCustLocalId" class="form-control" placeholder="Ref id bank/lainnya">
                        </div>
                    </div>                    <div class="form-group row">
                        <div class="col">
                            <label>Nomor Rekening / Virtual Account (Refund)</label>
                            <input type="text" id="update_modalCustBankAcc" class="form-control" placeholder="No Rekening / OVO / Dana..">
                        </div>
                    </div>

                    <button class="btn btn-warning mt-4 btn-block btn-lg" style="background: #f59e0b; border:none; color:#000; font-weight:bold;" onclick="updateCustomer()">
                        <i class="fa-solid fa-save"></i> UPDATE DATA NASABAH
                    </button>
                    <small class="text-muted d-block text-center mt-2">Pastikan data sudah diperiksa kembali sebelum melakukan Update.</small>
                </div>
            </div>
        </div>
    </div>

    <!-- Expense Modal -->
    <div id="expenseModal" class="modal">
        <div class="modal-content panel">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalExpTitle">Input Jurnal Pendapatan/Beban</h2>
                <span class="close-modal" onclick="closeExpenseModal()">&times;</span>
            </div>
            <input type="hidden" id="modalExpId">
            <div class="form-group">
                <label>Tanggal Jurnal</label>
                <input type="date" id="modalExpDate" class="form-control">
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Tipe Jurnal</label>
                    <select id="modalExpType" class="form-control" onchange="updateExpCategoryOptions()">
                        <option value="PENGELUARAN">Beban / Pengeluaran</option>
                        <option value="PENDAPATAN">Pendapatan Lain-lain</option>
                    </select>
                </div>
                <div class="col">
                    <label>Sumber / Tujuan Dana</label>
                    <select id="modalExpSource" class="form-control">
                        <option value="CASH">Kas Tunai</option>
                        <option value="BCA">Bank BCA</option>
                        <option value="MANDIRI">Bank Mandiri</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Kategori Akun (Standar BI)</label>
                <select id="modalExpCategory" class="form-control">
                    <!-- Populated by JS -->
                </select>
            </div>
            <div class="form-group">
                <label>Catatan / Keterangan</label>
                <input type="text" id="modalExpDesc" class="form-control" placeholder="Contoh: Beli Kertas HVS">
            </div>
            <div class="form-group">
                <label>Nominal (Rp)</label>
                <input type="number" id="modalExpAmount" class="form-control" placeholder="0">
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="saveExpense()">Simpan Jurnal</button>
        </div>
    </div>

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

    <!-- Asset Modal -->
    <div id="assetModal" class="modal">
        <div class="modal-content panel">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalAssetTitle">Tambah Aset Baru</h2>
                <span class="close-modal" onclick="closeAssetModal()">&times;</span>
            </div>
            <input type="hidden" id="modalAssetId">
            <div class="form-group">
                <label>Nama Aset</label>
                <input type="text" id="modalAssetName" class="form-control" placeholder="Contoh: Komputer Kasir, Brankas...">
            </div>
            <div class="form-group">
                <label>Tanggal Perolehan (Pembelian)</label>
                <input type="date" id="modalAssetDate" class="form-control">
            </div>
            <div class="form-group">
                <label>Harga Perolehan (Rp)</label>
                <input type="number" id="modalAssetPrice" class="form-control" placeholder="0">
            </div>
            <div class="form-group">
                <label>Masa Manfaat (Tahun)</label>
                <input type="number" id="modalAssetLife" class="form-control" placeholder="Contoh: 4">
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="saveAsset()">Simpan Aset</button>
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

    <!-- Old Money Supplier Modal -->
    <div id="oldMoneySupplierModal" class="modal">
        <div class="modal-content panel" style="width: 96%; max-width: 1160px; max-height: 90vh; overflow-y: auto; padding:18px;">
            <div class="modal-header flex-between mb-3" style="padding-bottom:10px; border-bottom:1px solid rgba(148,163,184,.18);">
                <h2 id="modalOldSupplierTitle">Tambah Suplayer / Pengepul Baru</h2>
                <span class="close-modal" onclick="window.closeOldMoneySupplierModal()">&times;</span>
            </div>
            <input type="hidden" id="modalOldSupplierId">
            <div style="display:flex; gap:18px; align-items:flex-start; flex-wrap:wrap;">
                <div style="flex:1 1 310px; min-width:0;">
                    <div class="form-group mb-2">
                        <label>Nama Suplayer / Pihak Pengepul</label>
                        <input type="text" id="modalOldSupplierName" list="oldMoneySupplierNameList" class="form-control" placeholder="Pilih atau ketik nama suplayer/pengepul">
                        <datalist id="oldMoneySupplierNameList"></datalist>
                    </div>
                    <div class="form-group mb-2">
                        <label>Kategori Acuan</label>
                        <select id="modalOldSupplierCategory" class="form-control">
                            <option value="KOIN">Koin</option>
                            <option value="UANG_LAMA">Uang Kertas Lama</option>
                        </select>
                    </div>
                    <div class="form-group row mb-2" style="gap:8px; margin-left:0; margin-right:0;">
                        <div class="col" style="padding-left:0;">
                            <label>Mata Uang / Koin</label>
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                <small class="text-muted" style="flex:1; font-size:.74rem;">Kode ISO 4217</small>
                                <button type="button" class="btn btn-sm btn-outline" onclick="openIso4217Modal('old-money-supplier')" style="white-space:nowrap; padding:3px 7px;"><i class="fa-solid fa-book-open"></i></button>
                            </div>
                            <input type="text" id="modalOldSupplierCurrency" list="oldMoneySupplierCurrencyList" class="form-control" placeholder="USD" style="text-transform:uppercase;">
                            <datalist id="oldMoneySupplierCurrencyList"></datalist>
                        </div>
                        <div class="col" style="padding-left:0; padding-right:0;">
                            <label>Harga Beli Rp</label>
                            <input type="number" id="modalOldSupplierBuy" class="form-control" placeholder="0">
                        </div>
                        <div class="col" style="padding-right:0;">
                            <label>Harga Jual Rp</label>
                            <input type="number" id="modalOldSupplierSell" class="form-control" placeholder="0">
                        </div>
                    </div>
                    <div class="form-group mb-2">
                        <label>Catatan</label>
                        <textarea id="modalOldSupplierNotes" class="form-control" rows="2" placeholder="Keterangan suplayer atau acuan harga."></textarea>
                    </div>
                    <div class="form-group mb-2">
                        <label>Foto Suplayer / Pengepul</label>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="flex:1; min-width:0;">
                                <input type="file" id="modalOldSupplierPhoto" class="form-control" accept="image/*" onchange="window.previewOldMoneySupplierPhoto(this)">
                                <small class="text-muted" style="font-size:.74rem;">Opsional</small>
                            </div>
                            <img id="modalOldSupplierPhotoPreview" src="" alt="Preview Suplayer" style="width:58px; height:58px; object-fit:cover; border-radius:6px; border:1px solid rgba(148,163,184,.25); display:none;">
                            <div id="modalOldSupplierPhotoPlaceholder" style="width:58px; height:58px; border-radius:6px; border:1px dashed rgba(148,163,184,.35); display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:.68rem; text-align:center; padding:5px;">Belum ada foto</div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block mt-2" onclick="window.saveOldMoneySupplier()"><i class="fa-solid fa-floppy-disk"></i> Simpan Data</button>
                </div>
                <div style="flex:1.65 1 580px; min-width:0; border-left:1px solid rgba(148,163,184,.18); padding-left:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap;">
                        <h4 class="mb-0" style="margin:0; font-size:1rem;">Daftar Suplayer & Acuan Harga</h4>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button type="button" id="oldMoneySupplierTabKoin" class="btn btn-sm" onclick="window.setOldMoneySupplierTab('KOIN')" style="padding:4px 9px; background:#f59e0b; color:#0f172a; border:none;">Koin</button>
                            <button type="button" id="oldMoneySupplierTabUangLama" class="btn btn-sm btn-outline" onclick="window.setOldMoneySupplierTab('UANG_LAMA')" style="padding:4px 9px;">Uang Lama</button>
                            <input type="text" id="modalOldSupplierFilter" class="form-control" style="width:190px; height:30px; font-size:.78rem;" placeholder="Cari nama / negara / ISO..." onkeyup="window.filterOldMoneySupplierTable()">
                        </div>
                    </div>
                    <div class="table-responsive" style="max-height:430px; overflow-y:auto; border:1px solid rgba(148,163,184,.16);">
                        <table class="table table-sm table-bordered" style="margin:0; font-size:.79rem;">
                            <thead style="position:sticky; top:0; background:#1e293b; z-index:1;">
                                <tr>
                                    <th>Suplayer</th>
                                    <th>ISO</th>
                                    <th>Catatan</th>
                                    <th style="text-align:right;">Beli</th>
                                    <th style="text-align:right;">Jual</th>
                                    <th style="text-align:center;">Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="oldMoneySupplierTableBody">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Old Money Item Modal -->
    <div id="oldMoneyItemModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 760px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header flex-between mb-4" style="position: sticky; top: 0; z-index: 3; background: #1e293b; padding: 12px 0 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.18);">
                <h2 id="modalOldItemTitle">Definisi Uang/Koin Baru</h2>
                <span class="close-modal" onclick="window.closeOldMoneyItemModal()">&times;</span>
            </div>
            <input type="hidden" id="modalOldItemId">
            <div class="form-group">
                <label>Kategori Jenis Barang</label>
                <select id="modalOldItemCategory" class="form-control">
                    <option value="KOIN">Koin</option>
                    <option value="UANG_LAMA">Uang Lama</option>
                </select>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Mata Uang (Valas)</label>
                    <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <small class="text-muted">Gunakan kode ISO 4217 bila item mengacu ke mata uang resmi.</small>
                        <button type="button" class="btn btn-sm btn-outline" onclick="openIso4217Modal('old-money')" style="white-space: nowrap;"><i class="fa-solid fa-book-open"></i> Cari Kode ISO</button>
                    </div>
                    <input type="text" id="modalOldItemCode" class="form-control" placeholder="Contoh: USD, EUR">
                </div>
                <div class="col">
                    <label>Nama Spesifik</label>
                    <input type="text" id="modalOldItemDesc" class="form-control" placeholder="Contoh: Koin 1 Euro">
                </div>
            </div>
              <div class="form-group">
                  <label>Saran Kurs Modal Beli (Rp / Valas)</label>
                  <input type="number" id="modalOldItemBuyPrice" class="form-control" placeholder="Contoh: 15000">
                  <small class="text-muted">Ini digunakan sebagai otomatisasi Kurs Beli dari Nasabah.</small>
              </div>
              <div class="form-group">
                  <label>Foto Referensi Item</label>
                  <input type="file" id="modalOldItemPhoto" class="form-control" accept="image/*" onchange="window.previewOldMoneyItemPhoto(this)">
                  <small class="text-muted">Opsional, tapi bagus untuk acuan visual saat menerima atau menjual item serupa.</small>
                  <div style="margin-top: 12px; display:flex; align-items:center; gap:12px;">
                      <img id="modalOldItemPhotoPreview" src="" alt="Preview Item" style="width: 110px; height: 110px; object-fit: cover; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.25); display:none;">
                      <div id="modalOldItemPhotoPlaceholder" style="width: 110px; height: 110px; border-radius: 10px; border: 1px dashed rgba(148, 163, 184, 0.35); display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.8rem; text-align:center; padding:10px;">
                          Belum ada foto referensi
                      </div>
                  </div>
              </div>
              <div style="position: sticky; bottom: 0; z-index: 3; background: linear-gradient(180deg, rgba(30, 41, 59, 0) 0%, rgba(30, 41, 59, 0.92) 18%, rgba(30, 41, 59, 1) 100%); padding-top: 18px; margin-top: 16px;">
                  <button class="btn btn-primary btn-block" onclick="window.saveOldMoneyItem()">Simpan Item Master</button>
              </div>
          </div>
      </div>

    <!-- Valas Gallery Add/Edit Modal -->
    <div id="valasGalleryModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 680px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header flex-between mb-4" style="position: sticky; top: 0; z-index: 3; background: #1e293b; padding: 12px 0 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.18);">
                <h2 id="modalValasTitle">Tambah Referensi Acuan Valas</h2>
                <span class="close-modal" onclick="window.closeValasGalleryModal()">&times;</span>
            </div>
            <input type="hidden" id="modalValasId">
            <div class="form-group row">
                <div class="col">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <label style="margin-bottom:0;">Kode Valas (Mata Uang)</label>
                        <button type="button" class="btn btn-sm btn-outline" onclick="window.openIso4217Modal('valas-gallery')" style="white-space: nowrap; font-size: 0.75rem; padding: 2px 8px;"><i class="fa-solid fa-book-open"></i> Cari Kode ISO</button>
                    </div>
                    <input type="text" id="modalValasCode" class="form-control" placeholder="Contoh: USD, SGD, EUR" style="text-transform: uppercase;">
                </div>
                <div class="col">
                    <label>Status Penerimaan</label>
                    <select id="modalValasStatus" class="form-control">
                        <option value="DITERIMA">DITERIMA (Accepted)</option>
                        <option value="TIDAK_DITERIMA">TIDAK DITERIMA (Rejected/Expired)</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Judul / Nama Spesifik Acuan</label>
                <input type="text" id="modalValasDesc" class="form-control" placeholder="Contoh: USD 100 Kepala Kecil / Lembar Robek">
            </div>
            <div class="form-group">
                <label>Kriteria & Catatan Penjelasan</label>
                <textarea id="modalValasNotes" class="form-control" rows="3" placeholder="Jelaskan secara detail ciri-ciri, nomor seri, atau kondisi yang diterima/ditolak..."></textarea>
            </div>
            <div class="form-group">
                <label>Foto Acuan Banknote</label>
                <input type="file" id="modalValasPhoto" class="form-control" accept="image/*" onchange="window.previewValasGalleryPhoto(this)">
                <small class="text-muted">Masukkan foto depan/belakang banknote sebagai acuan visual staf.</small>
                <div style="margin-top: 12px; display:flex; align-items:center; gap:12px;">
                    <img id="modalValasPhotoPreview" src="" alt="Preview Banknote" style="width: 150px; height: 90px; object-fit: contain; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.25); display:none;">
                    <div id="modalValasPhotoPlaceholder" style="width: 150px; height: 90px; border-radius: 6px; border: 1px dashed rgba(148, 163, 184, 0.35); display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.8rem; text-align:center; padding:10px;">
                        Belum ada foto referensi
                    </div>
                </div>
            </div>
            <div style="position: sticky; bottom: 0; z-index: 3; background: linear-gradient(180deg, rgba(30, 41, 59, 0) 0%, rgba(30, 41, 59, 0.92) 18%, rgba(30, 41, 59, 1) 100%); padding-top: 18px; margin-top: 16px;">
                <button id="saveValasGalleryButton" class="btn btn-primary btn-block" onclick="window.saveValasGalleryItem()">Simpan Data Acuan</button>
            </div>
        </div>
    </div>

    <!-- 1. Modal Buat Permintaan Pickup -->
    <div id="createPickupModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header flex-between mb-4" style="position: sticky; top: 0; z-index: 3; background: #1e293b; padding: 12px 0 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.18);">
                <h2>Buat Permintaan Pickup Valas</h2>
                <span class="close-modal" onclick="window.closeCreatePickupModal()">&times;</span>
            </div>
            <form id="createPickupForm" onsubmit="event.preventDefault(); window.saveNewPickup();">
                <div class="form-group row">
                    <div class="col">
                        <label>Pilih Kurir / Driver</label>
                        <select id="createPickupCourier" class="form-control" style="background:#0f172a; color:#fff;" required></select>
                    </div>
                </div>
                <div class="form-group row">
                    <div class="col">
                        <label>Jenis Kendaraan</label>
                        <select id="createPickupVehicleType" class="form-control" style="background:#0f172a; color:#fff;">
                            <option value="Motor">Sepeda Motor</option>
                            <option value="Mobil">Mobil</option>
                            <option value="Lainnya">Lainnya / Umum</option>
                        </select>
                    </div>
                    <div class="col">
                        <label>Plat Nomor Kendaraan</label>
                        <input type="text" id="createPickupVehiclePlate" class="form-control" placeholder="Contoh: B 1234 ABC" style="text-transform: uppercase;">
                    </div>
                </div>
                <div class="form-group">
                    <label>Lokasi Tujuan Penjualan / Penyerahan</label>
                    <input type="text" id="createPickupDestination" class="form-control" placeholder="Contoh: Smartdeal Kantor Pusat, Bank BCA, Cabang Roxy" required>
                </div>

                <div class="form-group">
                    <label style="font-weight: 600; color:#38bdf8; display:flex; justify-content:space-between; align-items:center;">
                        <span>Daftar Valas Yang Dibawa</span>
                    </label>
                    <div id="createPickupCurrenciesContainer" style="background: rgba(15, 23, 42, 0.4); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
                        <!-- Injected dynamic rows -->
                    </div>
                </div>

                <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <strong style="color: #38bdf8; font-size: 0.9rem;">Total Estimasi Nilai Rupiah:</strong>
                    <strong style="color: #fff; font-size: 1.15rem;" id="createPickupTotalEstIdr">Rp 0</strong>
                </div>

                <div class="form-group">
                    <label>Memo / Catatan Tambahan</label>
                    <textarea id="createPickupNotes" class="form-control" rows="2" placeholder="Masukkan catatan opsional..."></textarea>
                </div>

                <div style="position: sticky; bottom: 0; z-index: 3; background: linear-gradient(180deg, rgba(30, 41, 59, 0) 0%, rgba(30, 41, 59, 0.92) 18%, rgba(30, 41, 59, 1) 100%); padding-top: 18px; margin-top: 16px;">
                    <button type="submit" class="btn btn-primary btn-block" style="background:#F97316; border-color:#F97316; font-weight:bold;"><i class="fa-solid fa-paper-plane"></i> Kirim Tugas Pickup</button>
                </div>
            </form>
        </div>
    </div>

    <!-- 2. Modal Kurir Pickup (Start Trip) -->
    <div id="pickupStartModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2>Konfirmasi Pickup Valas oleh Kurir</h2>
                <span class="close-modal" onclick="window.closePickupStartModal()">&times;</span>
            </div>
            <input type="hidden" id="startPickupId">
            <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px; margin-bottom: 15px;">
                <span style="font-size: 0.75rem; color:#f59e0b; text-transform: uppercase; font-weight: bold;">NOMOR PICKUP</span>
                <div style="font-size: 1rem; font-weight: bold; color: #f8fafc;" id="startPickupNo">ALM-PKP-...</div>
                <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 8px;" id="startPickupValasText">Detail valas</div>
            </div>

            <div class="form-group row">
                <div class="col">
                    <label>Jenis Kendaraan Kurir</label>
                    <select id="startPickupType" class="form-control" style="background:#0f172a; color:#fff;">
                        <option value="Motor">Sepeda Motor</option>
                        <option value="Mobil">Mobil</option>
                        <option value="Lainnya">Lainnya / Umum</option>
                    </select>
                </div>
                <div class="col">
                    <label>Plat Nomor</label>
                    <input type="text" id="startPickupPlate" class="form-control" placeholder="Contoh: B 1234 ABC" style="text-transform: uppercase;">
                </div>
            </div>

            <div class="form-group">
                <label>Foto Bukti Serah Terima Awal (Opsional)</label>
                <button type="button" class="btn btn-outline btn-block" onclick="window.triggerStartPickupPhotoUpload()"><i class="fa-solid fa-camera"></i> Ambil Foto / File Foto</button>
                <input type="hidden" id="startPickupPhotoData">
                <div style="margin-top: 12px; text-align: center;">
                    <img id="startPickupPhotoPreview" src="" alt="Bukti serah terima" style="width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display:none;">
                </div>
            </div>

            <div class="mt-4">
                <button type="button" class="btn btn-warning btn-block" style="background:#f59e0b; border-color:#f59e0b; font-weight: bold;" onclick="window.confirmPickupStart()"><i class="fa-solid fa-motorcycle"></i> Konfirmasi Mulai Perjalanan</button>
            </div>
        </div>
    </div>

    <!-- 3. Modal Konfirmasi Jual / Serah Terima di Tujuan (Deliver & OTP) -->
    <div id="pickupDeliverModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 580px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header flex-between mb-4" style="position: sticky; top: 0; z-index: 3; background: #1e293b; padding: 12px 0 14px; border-bottom: 1px solid rgba(148, 163, 184, 0.18);">
                <h2>Konfirmasi Penjualan / Tiba di Tujuan</h2>
                <span class="close-modal" onclick="window.closePickupDeliverModal()">&times;</span>
            </div>
            <input type="hidden" id="deliverPickupId">
            
            <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; border-radius: 6px; padding: 12px; margin-bottom: 15px;">
                <span style="font-size: 0.75rem; color:#10b981; text-transform: uppercase; font-weight: bold;">NOMOR PICKUP</span>
                <div style="font-size: 1rem; font-weight: bold; color: #f8fafc;" id="deliverPickupNo">ALM-PKP-...</div>
            </div>

            <div class="form-group">
                <label>Nama Penerima / Kasir Counter Tujuan</label>
                <input type="text" id="deliverRecipient" class="form-control" placeholder="Contoh: Kasir Smartdeal Budi" required>
            </div>

            <div class="form-group">
                <label style="font-weight:600; color:#38bdf8;">Kurs Realisasi Penjualan (Kurs Asli)</label>
                <div id="deliverPickupCurrenciesRealization" style="background: rgba(15, 23, 42, 0.4); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
                    <!-- Dynamic currency rows for inputting actual rate -->
                </div>
            </div>

            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <strong style="color: #10b981; font-size: 0.9rem;">Total Rupiah Hasil Jual:</strong>
                <strong style="color: #fff; font-size: 1.15rem;" id="deliverPickupTotalRealIdr">Rp 0</strong>
            </div>

            <div class="form-group">
                <label>Upload Foto Struk / Bukti Transaksi Jual</label>
                <button type="button" class="btn btn-outline btn-block" onclick="window.triggerDeliverPickupPhotoUpload()"><i class="fa-solid fa-camera"></i> Foto Struk Nota / Kwitansi</button>
                <input type="hidden" id="deliverPickupPhotoData">
                <div style="margin-top: 12px; text-align: center;">
                    <img id="deliverPickupPhotoPreview" src="" alt="Bukti struk" style="width: 100%; max-height: 180px; object-fit: contain; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); display:none;">
                </div>
            </div>

            <!-- PIN OTP BOX (Ojol-style!) -->
            <div class="form-group" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 15px; margin-top: 20px;">
                <label style="color: #f59e0b; font-weight: bold;"><i class="fa-solid fa-key"></i> PIN OTP Verifikasi Serah Terima</label>
                <input type="text" id="deliverPin" class="form-control" placeholder="Masukkan 4-digit PIN OTP dari Kasir/Teller" style="text-align: center; font-size: 1.3rem; letter-spacing: 4px; font-weight: bold; background: #0f172a; color:#f59e0b; border-color: rgba(245, 158, 11, 0.4);" required maxlength="4">
                <small class="text-muted d-block mt-2">PIN ini di-generate oleh pembuat permintaan di kantor. Tanyakan PIN kepada kasir/teller utama untuk menyelesaikan tugas ojol ini.</small>
            </div>

            <div style="position: sticky; bottom: 0; z-index: 3; background: linear-gradient(180deg, rgba(30, 41, 59, 0) 0%, rgba(30, 41, 59, 0.92) 18%, rgba(30, 41, 59, 1) 100%); padding-top: 18px; margin-top: 16px;">
                <button type="button" class="btn btn-success btn-block" style="background:#10b981; border-color:#10b981; font-weight: bold;" onclick="window.confirmPickupDelivered()"><i class="fa-solid fa-check-double"></i> Verifikasi & Selesaikan Handover</button>
            </div>
        </div>
    </div>

    <!-- 4. Modal Konfirmasi Selesai Uang Masuk Brankas (Kasir Kantor) -->
    <div id="pickupCompleteModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2>Konfirmasi Terima Setoran Rupiah</h2>
                <span class="close-modal" onclick="window.closePickupCompleteModal()">&times;</span>
            </div>
            <input type="hidden" id="completePickupId">
            
            <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.4;">Kurir telah menyelesaikan penjualan valas. Konfirmasi bahwa uang Rupiah hasil penjualan fisik telah masuk brankas kasir / rekening bank kantor.</p>

            <div style="background: rgba(56, 189, 248, 0.1); border-radius: 8px; padding: 15px; margin: 15px 0; border: 1px solid rgba(56, 189, 248, 0.2);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size:0.85rem;"><span style="color:#94a3b8;">No. Pickup:</span> <strong id="completePickupNo">ALM-PKP-...</strong></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size:0.85rem;"><span style="color:#94a3b8;">Kurir:</span> <strong id="completePickupCourier">Nama Kurir</strong></div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;"><span style="color:#f8fafc; font-weight:600;">Jumlah Setoran Rupiah:</span> <strong style="color:#10b981; font-size: 1.15rem;" id="completePickupAmountText">Rp 0</strong></div>
            </div>

            <div class="form-group">
                <label>Lokasi Uang Masuk (Mutasi Otomatis)</label>
                <select id="completePickupTargetBox" class="form-control" style="background:#0f172a; color:#fff;">
                    <option value="CASH">Tunai (Laci Brankas Kasir)</option>
                    <option value="BCA">Transfer Bank BCA</option>
                    <option value="MANDIRI">Transfer Bank Mandiri</option>
                </select>
                <small class="text-muted d-block mt-2">Sistem akan otomatis menambah saldo kas/bank brankas kasir di dashboard & mencatat jurnal mutasi masuk.</small>
            </div>

            <div class="mt-4">
                <button type="button" class="btn btn-primary btn-block" style="background:#38bdf8; border-color:#38bdf8; color: #0f172a; font-weight: bold;" onclick="window.confirmPickupComplete()"><i class="fa-solid fa-square-check"></i> Konfirmasi Selesai & Terima Uang</button>
            </div>
        </div>
    </div>

    <!-- Gantungan Add Modal -->
    <div id="gantunganModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2>Tambah Pinjaman / Gantungan Baru</h2>
                <span class="close-modal" onclick="window.closeGantunganModal()">&times;</span>
            </div>
            <form id="gantunganModalForm" onsubmit="event.preventDefault(); window.saveGantungan();">
                <div class="form-group">
                    <label>Nama Peminjam</label>
                    <input type="text" id="mGantunganNama" class="form-control" placeholder="Contoh: Yayan" required>
                </div>
                <div class="form-group row">
                    <div class="col">
                    <label>Jenis Catatan</label>
                    <select id="mGantunganTipe" class="form-control">
                            <option value="PIUTANG">Keluar / Pinjaman</option>
                            <option value="UTANG">Masuk Lainnya / Kembalian</option>
                        </select>
                    </div>
                    <div class="col">
                        <label>Nominal (Rp)</label>
                        <input type="text" id="mGantunganNominal" class="form-control" placeholder="Contoh: 5.000" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Keterangan</label>
                    <textarea id="mGantunganKeterangan" class="form-control" rows="3" placeholder="Contoh: Pinjaman sementara Yayan" required></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block mt-4"><i class="fa-solid fa-save"></i> Simpan Pinjaman</button>
            </form>
        </div>
    </div>

    <!-- Gantungan Cicil Modal -->
    <div id="gantunganCicilModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 480px;">
            <div class="modal-header flex-between mb-4">
                <h2>Catat Cicilan / Pembayaran</h2>
                <span class="close-modal" onclick="window.closeGantunganCicilModal()">&times;</span>
            </div>
            <form id="gantunganCicilForm" onsubmit="event.preventDefault(); window.saveGantunganCicil();">
                <input type="hidden" id="mCicilId">
                <div class="form-group">
                    <label>Nama Nasabah / Staf</label>
                    <input type="text" id="mCicilNama" class="form-control" readonly style="opacity: 0.7;">
                </div>
                <div class="form-group row">
                    <div class="col">
                        <label>Utang Awal (Nominal)</label>
                        <input type="text" id="mCicilNominalAwal" class="form-control" readonly style="opacity: 0.7;">
                    </div>
                    <div class="col">
                        <label>Sisa Saldo Saat Ini</label>
                        <input type="text" id="mCicilSisaSaldo" class="form-control" readonly style="opacity: 0.7; font-weight: bold; color: #EF4444;">
                    </div>
                </div>
                <div class="form-group">
                    <label>Jumlah Pembayaran Cicilan (Rp)</label>
                    <input type="text" id="mCicilJumlah" class="form-control" placeholder="Masukkan jumlah yang dibayar" required>
                </div>
                <div class="form-group">
                    <label>Keterangan Pembayaran</label>
                    <input type="text" id="mCicilKeterangan" class="form-control" placeholder="Contoh: Pembayaran tahap 1 / Dicicil tunai" required>
                </div>
                <button type="submit" class="btn btn-success btn-block mt-4"><i class="fa-solid fa-receipt"></i> Simpan Pembayaran</button>
            </form>
        </div>
    </div>

    <!-- Old Money Topup Modal -->
    <div id="oldMoneyTopupModal" class="modal">
        <div class="modal-content panel">
            <div class="modal-header flex-between mb-4">
                <h2>Kelola Laci Kas Koin Rupiah</h2>
                <span class="close-modal" onclick="window.closeOldMoneyTopupModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Aksi / Tindakan</label>
                <select id="modalOldTopupType" class="form-control">
                    <option value="IN">TAMBAH Kas (Suntik Modal Koin)</option>
                    <option value="OUT">TARIK Kas (Pindahkan Kas Koin Keluar)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nominal Rupiah (Rp)</label>
                <input type="number" id="modalOldTopupAmount" class="form-control" placeholder="0">
            </div>
            <div class="form-group">
                <label>Tulis Catatan / Alasan</label>
                <input type="text" id="modalOldTopupDesc" class="form-control" placeholder="Contoh: Modal Awal Kotak Koin">
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="window.saveOldMoneyTopup()">Proses Mutasi Kas Koin</button>
        </div>
    </div>

      <div id="iso4217Modal" class="modal">
          <div class="modal-content panel" style="max-width: 920px;">
              <div class="modal-header flex-between mb-4">
                  <div>
                      <h2 style="margin: 0;">Sumber Mata Uang ISO 4217</h2>
                      <small class="text-muted">Referensi global untuk aplikasi utama, master data, dan modul koin.</small>
                  </div>
                  <span class="close-modal" onclick="window.closeIso4217Modal()">&times;</span>
              </div>
              <div class="form-group">
                  <input type="text" id="iso4217FilterModal" class="form-control" placeholder="Cari kode, negara, atau nama mata uang..." oninput="window.loadIso4217ModalTable()">
              </div>
              <div class="table-responsive" style="max-height: 460px; overflow-y: auto;">
                  <table class="table table-sm table-bordered">
                      <thead style="position: sticky; top: 0; background: #1e293b; z-index: 1;">
                          <tr>
                              <th>Kode</th>
                              <th>Negara / Entitas</th>
                              <th>Nama Mata Uang</th>
                              <th>Simbol</th>
                              <th style="text-align: center;">Aksi</th>
                          </tr>
                      </thead>
                      <tbody id="iso4217ModalTableBody">
                          <tr>
                              <td colspan="5" class="text-center text-muted">Memuat referensi ISO 4217...</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              <small class="text-muted mt-3 d-block">Acuan umum berdasarkan kode alfabetik ISO 4217. Tombol <strong>Pakai ke Form</strong> akan mengisi form yang sedang meminta referensi.</small>
          </div>
      </div>



    <!-- Closing History Modal -->
    <div id="closingHistoryModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 1000px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalClosingHistTitle">Riwayat Closing Harian Rupiah</h2>
                <span class="close-modal" onclick="closeClosingHistoryModal()">&times;</span>
            </div>
            
            <div class="mb-3" style="display: flex; gap: 10px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div style="font-size: 0.9em; color: #94A3B8;">Riwayat diurutkan dari yang terbaru hingga terlama.</div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <input type="file" id="historicalClosingInput" class="form-control" accept=".xlsx, .xls, .csv" style="max-width: 200px; padding: 2px 10px;" title="Gunakan file hasil Export Excel">
                    <button class="btn btn-success" style="padding: 2px 10px;" onclick="uploadHistoricalClosings()"><i class="fa-solid fa-upload"></i> Upload Histori</button>
                    <button class="btn btn-secondary" style="padding: 2px 10px;" onclick="printClosingHistory()"><i class="fa-solid fa-print"></i> Cetak Tampilan</button>
                    <button class="btn btn-danger" data-role-special="closingHistoryReset" style="padding: 2px 10px;" onclick="window.resetClosingHistory()"><i class="fa-solid fa-trash-can"></i> Reset Riwayat</button>
                </div>
            </div>
            
            <div class="table-responsive" style="max-height: 60vh; overflow-y: auto;">
                <table class="table" id="closingHistoryTable">
                    <thead>
                        <tr>
                            <th>Waktu Closing</th>
                            <th>ID Referensi</th>
                            <th>Jenis</th>
                            <th>Kas Sistem</th>
                            <th>Bank Sistem</th>
                            <th>Total Sistem</th>
                            <th>Kas Fisik</th>
                            <th>Gantungan</th>
                            <th>Selisih</th>
                            <th>Catatan</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="closingHistoryTableBody">
                        <!-- Injected by JS -->
                    </tbody>
                </table>
            </div>
            <button class="btn btn-primary btn-block mt-4" onclick="closeClosingHistoryModal()">Tutup</button>
        </div>
    </div>

    <!-- Edit Closing Modal -->
    <div id="editClosingModal" class="modal">
        <div class="modal-content panel" style="width: 95%; max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2>Edit Riwayat Closing</h2>
                <span class="close-modal" onclick="closeEditClosingModal()">&times;</span>
            </div>
            <input type="hidden" id="editClosingId">
            <input type="hidden" id="editClosingKasSistem">
            
            <div class="form-group mb-3">
                <label>Tanggal & Waktu</label>
                <input type="datetime-local" id="editClosingDate" class="form-control">
            </div>
            <div class="form-group mb-3">
                <label>Kas Fisik Real (Rp)</label>
                <input type="text" id="editClosingFisik" class="form-control" onkeyup="formatCurrency(this)">
            </div>
            <div class="form-group mb-3">
                <label>Jenis Closing</label>
                <select id="editClosingType" class="form-control">
                    <option value="temporary">Cek Sementara</option>
                    <option value="final">Closing Final</option>
                </select>
            </div>
            <div class="form-group mb-3">
                <label>Catatan</label>
                <textarea id="editClosingNote" class="form-control" rows="3"></textarea>
            </div>
            
            <button class="btn btn-warning btn-block mt-4" onclick="saveEditClosing()"><i class="fa-solid fa-save"></i> Ubah & Abaikan Saldo Hari Ini</button>
        </div>
    </div>

    <!-- HRIS Employee Modal -->
    <div id="hrisEmployeeModal" class="modal">
        <div class="modal-content panel" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalHrisEmpTitle">Tambah Akun Karyawan</h2>
                <span class="close-modal" onclick="closeHrisEmployeeModal()">&times;</span>
            </div>
            <input type="hidden" id="modalHrisEmpId">
            <div class="form-group row">
                <div class="col">
                    <label>User</label>
                    <input type="text" id="modalHrisEmpNik" class="form-control" placeholder="Contoh: yayan">
                </div>
                <div class="col">
                    <label>Nama Lengkap</label>
                    <input type="text" id="modalHrisEmpName" class="form-control" placeholder="Nama Karyawan..">
                </div>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>No. Tlp / WA</label>
                    <input type="text" id="modalHrisEmpPhone" class="form-control" placeholder="Contoh: 08123456789">
                </div>
                <div class="col">
                    <label>Link Maps (Opsional)</label>
                    <input type="url" id="modalHrisEmpMaps" class="form-control" placeholder="URL Google Maps tempat tinggal">
                </div>
            </div>
            <div class="form-group">
                <label>Alamat Lengkap</label>
                <textarea id="modalHrisEmpAddress" class="form-control" rows="2" placeholder="Nama Jalan, RT/RW, Kelurahan, Kec..."></textarea>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Jabatan</label>
                    <select id="modalHrisEmpRole" class="form-control">
                        <option value="Kasir">Kasir</option>
                        <option value="Teller">Teller</option>
                        <option value="Admin">Admin</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Kurir">Kurir</option>
                        <option value="Keamanan">Keamanan / Satpam</option>
                        <option value="Lainnya">Lainnya</option>
                    </select>
                </div>
                <div class="col">
                    <label>Status Kerja</label>
                    <select id="modalHrisEmpStatus" class="form-control">
                        <option value="Aktif">Aktif</option>
                        <option value="Non-Aktif (Resign)">Non-Aktif (Resign)</option>
                    </select>
                </div>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Gaji Pokok (Bulanan)</label>
                    <input type="number" id="modalHrisEmpSalary" class="form-control" placeholder="Rp ">
                </div>
                <div class="col">
                    <label>Uang Makan (Harian)</label>
                    <input type="number" id="modalHrisEmpFood" class="form-control" placeholder="Rp / Hari Masuk">
                </div>
            </div>
            <div class="form-group">
                <label>PIN Absensi Khusus (Hanya 4 Angka)</label>
                <input type="password" id="modalHrisEmpPin" class="form-control" maxlength="4" placeholder="Misal: 1234">
                <small class="text-muted">Username login memakai NIK, password awal memakai PIN ini. PIN tetap dipakai untuk Clock IN / OUT.</small>
            </div>
            <div class="form-group">
                <label>Catatan</label>
                <textarea id="modalHrisEmpNotes" class="form-control" rows="3" placeholder="Catatan tambahan tentang karyawan..."></textarea>
            </div>
            <hr class="divider mt-4 mb-4">
            <h3 style="color: #60A5FA;"><i class="fa-solid fa-folder-open"></i> Upload Dokumen Karyawan</h3>
            <div class="form-group row">
                <div class="col">
                    <label>Foto Close-Up</label>
                    <input type="file" id="modalHrisEmpPhoto" class="form-control" accept="image/*">
                    <div id="previewEmpPhoto" style="margin-top:5px; max-height:100px; overflow:hidden;"></div>
                </div>
                <div class="col">
                    <label>Foto Full Body</label>
                    <input type="file" id="modalHrisEmpPhotoFull" class="form-control" accept="image/*">
                    <div id="previewEmpPhotoFull" style="margin-top:5px; max-height:100px; overflow:hidden;"></div>
                </div>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Scan / Foto KTP</label>
                    <input type="file" id="modalHrisEmpKtp" class="form-control" accept="image/*,application/pdf">
                    <div id="previewEmpKtp" style="margin-top:5px; max-height:100px; overflow:hidden;"></div>
                </div>
                <div class="col">
                    <label>Scan / Foto SIM (Opsional)</label>
                    <input type="file" id="modalHrisEmpSim" class="form-control" accept="image/*,application/pdf">
                    <div id="previewEmpSim" style="margin-top:5px; max-height:100px; overflow:hidden;"></div>
                </div>
                <div class="col">
                    <label>Scan Ijazah (Opsional)</label>
                    <input type="file" id="modalHrisEmpIjazah" class="form-control" accept="image/*,application/pdf">
                    <div id="previewEmpIjazah" style="margin-top:5px; max-height:100px; overflow:hidden;"></div>
                </div>
            </div>

            <button class="btn btn-primary mt-4 btn-block" onclick="saveHrisEmployee()"><i class="fa-solid fa-save"></i> Simpan Data Karyawan</button>
        </div>
    </div>

    <!-- HRIS Leave Modal -->
    <div id="hrisLeaveModal" class="modal">
        <div class="modal-content panel" style="max-width: 620px;">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalHrisLeaveTitle">Tambah Schedule / Cuti</h2>
                <span class="close-modal" onclick="closeHrisLeaveModal()">&times;</span>
            </div>
            <input type="hidden" id="modalHrisLeaveId">
            <div class="form-group">
                <label>Nama Karyawan</label>
                <select id="modalHrisLeaveEmp" class="form-control"></select>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Jenis Tipe Pengajuan</label>
                    <select id="modalHrisLeaveType" class="form-control" onchange="toggleHrisLeaveScheduleFields()">
                        <option value="JADWAL_SHIFT">Schedule / Jadwal Kerja</option>
                        <option value="CUTI">Cuti Tahunan</option>
                        <option value="IZIN">Izin Keperluan</option>
                        <option value="SAKIT">Sakit</option>
                        <option value="LIBUR_SHIFT">Libur / Off Shift</option>
                    </select>
                </div>
            </div>
            <div id="modalHrisScheduleFields">
                <div class="form-group row">
                    <div class="col">
                        <label>Nama Shift</label>
                        <select id="modalHrisLeaveShiftName" class="form-control">
                            <option value="Shift Pagi">Shift Pagi</option>
                            <option value="Shift Siang">Shift Siang</option>
                            <option value="Shift Midle">Shift Midle</option>
                        </select>
                    </div>
                    <div class="col">
                        <label>Jam Masuk</label>
                        <input type="time" id="modalHrisLeaveStartTime" class="form-control">
                    </div>
                    <div class="col">
                        <label>Jam Pulang</label>
                        <input type="time" id="modalHrisLeaveEndTime" class="form-control">
                    </div>
                </div>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Tanggal Mulai</label>
                    <input type="date" id="modalHrisLeaveStartDate" class="form-control">
                </div>
                <div class="col">
                    <label>Tanggal Selesai</label>
                    <input type="date" id="modalHrisLeaveEndDate" class="form-control">
                </div>
            </div>
            <div class="form-group">
                <label>Keterangan / Alasan Tambahan</label>
                <textarea id="modalHrisLeaveRemarks" class="form-control" rows="2" placeholder="Contoh: Jadwal kasir pagi, Keperluan keluarga, Surat dokter terlampir..."></textarea>
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="saveHrisLeave()"><i class="fa-solid fa-save"></i> Simpan Schedule / Cuti</button>
        </div>
    </div>

    <!-- HRIS Kasbon Modal -->
    <div id="hrisKasbonModal" class="modal">
        <div class="modal-content panel" style="max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalHrisKasbonTitle">Input Mutasi Kasbon</h2>
                <span class="close-modal" onclick="closeHrisKasbonModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Nama Karyawan (Sisa Hutang)</label>
                <select id="modalHrisKasbonEmp" class="form-control" onchange="updateHrisKasbonSisa()"></select>
                <small class="text-muted" id="lblHrisKasbonSisa">Sisa Hutang: Rp 0</small>
            </div>
            <div class="form-group row">
                <div class="col">
                    <label>Tipe Mutasi</label>
                    <select id="modalHrisKasbonType" class="form-control" onchange="toggleHrisKasbonSource()">
                        <option value="PINJAM">Pemberian Kasbon (Uang Keluar)</option>
                        <option value="CICIL">Cicilan Bayar (Uang Masuk/Potong Gaji)</option>
                    </select>
                </div>
                <div class="col">
                    <label>Sumber Dana / Metode</label>
                    <select id="modalHrisKasbonSource" class="form-control">
                        <option value="TUNAI">Kas Laci (Tunai Rupiah)</option>
                        <option value="BCA">Rekening BCA</option>
                        <option value="MANDIRI">Rekening Mandiri</option>
                        <option value="POTONG_GAJI" id="optKasbonPotongGaji" style="display:none;">Potong Gaji (Tak Ubah Saldo)</option>
                    </select>
                </div>
                <div class="col">
                    <label>Tanggal</label>
                    <input type="date" id="modalHrisKasbonDate" class="form-control">
                </div>
            </div>
            <div class="form-group">
                <label>Nominal (Rp)</label>
                <input type="number" id="modalHrisKasbonAmount" class="form-control" placeholder="0">
            </div>
            <div class="form-group">
                <label>Keterangan</label>
                <input type="text" id="modalHrisKasbonDesc" class="form-control" placeholder="Contoh: Keperluan darurat / Potong gaji bln x">
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="submitHrisKasbon()">Rekam Transaksi & Update Saldo</button>
        </div>
    </div>

    <!-- HRIS BPJS Modal -->
    <div id="hrisBpjsModal" class="modal">
        <div class="modal-content panel" style="max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2 id="modalHrisBpjsTitle">Update Potongan BPJS</h2>
                <span class="close-modal" onclick="closeHrisBpjsModal()">&times;</span>
            </div>
            <div class="form-group">
                <label>Pilih Karyawan</label>
                <select id="modalHrisBpjsEmp" class="form-control" onchange="autoFillHrisBpjs()"></select>
            </div>
            <div class="form-group">
                <label>Potongan BPJS Kesehatan (bln)</label>
                <input type="number" id="modalHrisBpjsKes" class="form-control" placeholder="0">
                <small class="text-muted">Umumnya 1% ditanggung karyawan dari UMK / Gaji Pokok.</small>
            </div>
            <div class="form-group">
                <label>Potongan BPJS Ketenagakerjaan (bln)</label>
                <input type="number" id="modalHrisBpjsTk" class="form-control" placeholder="0">
                <small class="text-muted">Umumnya 2% untuk JHT ditanggung karyawan.</small>
            </div>
            <button class="btn btn-primary mt-4 btn-block" onclick="processHrisBpjs()">Simpan Data BPJS</button>
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
                        <input type="text" id="mSendKursWaName" class="form-control" placeholder="Masukkan nama (misal: Agen Budi)" style="flex: 1; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px;">
                        <button type="button" class="btn btn-outline" onclick="window.saveWaFavorite()" style="border-color: #38bdf8; color: #38bdf8; height: 38px; padding: 0 12px; font-size: 0.85rem; white-space: nowrap; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-star"></i> Simpan
                        </button>
                    </div>
                </div>

                <button type="submit" class="btn btn-success btn-block mt-4" style="background:#25D366; color:white; border:none; border-radius: 6px; padding: 10px; font-weight: bold;"><i class="fa-brands fa-whatsapp"></i> Kirim ke WhatsApp</button>
            </form>
        </div>
    </div>

    <!-- Document Add Folder Modal -->
    <div id="documentFolderModal" class="modal" style="display: none; z-index: 10050;">
        <div class="modal-content panel" style="width: 95%; max-width: 450px;">
            <div class="modal-header flex-between mb-4">
                <h2 id="documentFolderModalTitle">Tambah Folder Baru</h2>
                <span class="close-modal" onclick="window.closeDocumentFolderModal()">&times;</span>
            </div>
            <form id="documentFolderModalForm" onsubmit="event.preventDefault(); window.saveDocumentFolder();">
                <input type="hidden" id="mFolderEditId">
                <div class="form-group">
                    <label>Lokasi Folder</label>
                    <select id="mFolderParent" class="form-control">
                        <!-- Pilihan folder induk diisi via JS -->
                    </select>
                </div>
                <div class="form-group">
                    <label>Nama Folder</label>
                    <input type="text" id="mFolderNama" class="form-control" placeholder="Masukkan nama folder kustom..." required>
                </div>
                <button type="submit" id="documentFolderSubmitBtn" class="btn btn-primary btn-block mt-4"><i class="fa-solid fa-save"></i> Tambah Folder</button>
            </form>
        </div>
    </div>

    <!-- Document Upload Modal -->
    <div id="documentUploadModal" class="modal" style="display: none; z-index: 10050;">
        <div class="modal-content panel" style="width: 95%; max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2>Unggah Berkas Baru</h2>
                <span class="close-modal" onclick="window.closeDocumentUploadModal()">&times;</span>
            </div>
            <form id="documentUploadModalForm" onsubmit="event.preventDefault(); window.saveDocumentUpload();">
                <div class="form-group">
                    <label>Pilih File</label>
                    <input type="file" id="mDocFile" class="form-control" accept=".jpg,.jpeg,.png,.gif,.pdf,.rar,.zip,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx" required style="padding: 8px 12px; height: auto;">
                    <small class="text-muted" style="display: block; margin-top: 4px;">Format didukung: JPG, JPEG, PNG, GIF, PDF, RAR, ZIP, TXT, Word (DOC, DOCX), Excel (XLS, XLSX), PowerPoint (PPT, PPTX). Maksimal 10 MB.</small>
                </div>
                <div class="form-group">
                    <label>Nama Berkas</label>
                    <input type="text" id="mDocNama" class="form-control" placeholder="Biarkan kosong untuk menggunakan nama file asli...">
                </div>
                <div class="form-group">
                    <label>Pilih Folder Tujuan</label>
                    <select id="mDocFolder" class="form-control" required>
                        <!-- Pilihan folder diisi via JS -->
                    </select>
                </div>
                <div class="form-group">
                    <label>Keterangan / Catatan Berkas</label>
                    <textarea id="mDocKeterangan" class="form-control" rows="3" placeholder="Masukkan keterangan tambahan jika ada..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block mt-4"><i class="fa-solid fa-upload"></i> Unggah Berkas</button>
            </form>
        </div>
    </div>

    <!-- Document Edit Modal -->
    <div id="documentEditModal" class="modal" style="display: none; z-index: 10050;">
        <div class="modal-content panel" style="width: 95%; max-width: 500px;">
            <div class="modal-header flex-between mb-4">
                <h2>Ubah Informasi Berkas</h2>
                <span class="close-modal" onclick="window.closeDocumentEditModal()">&times;</span>
            </div>
            <form id="documentEditModalForm" onsubmit="event.preventDefault(); window.saveDocumentEdit();">
                <input type="hidden" id="mEditDocId">
                <div class="form-group">
                    <label>Nama Berkas</label>
                    <input type="text" id="mEditDocNama" class="form-control" placeholder="Nama berkas..." required>
                </div>
                <div class="form-group">
                    <label>Pindah Ke Folder</label>
                    <select id="mEditDocFolder" class="form-control" required>
                        <!-- Pilihan folder diisi via JS -->
                    </select>
                </div>
                <div class="form-group">
                    <label>Keterangan / Catatan Berkas</label>
                    <textarea id="mEditDocKeterangan" class="form-control" rows="3" placeholder="Masukkan keterangan tambahan jika ada..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block mt-4"><i class="fa-solid fa-save"></i> Simpan Perubahan</button>
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
            '13-pickup.js',
            '14-documents.js',
            '15-calculator.js',
            '16-aichat.js',
            '17-waiting-list.js',
            '18-translator.js',
            '19-userchat.js',
            '20-mobilemode.js',
            '21-demo-pos.js',
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
        flatpickr("#modalCustBirthDate", {
            dateFormat: "d M Y",
            allowInput: true
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

window.resetAuditFilter = function() {
    ['filterAuditInvoice', 'filterAuditNama', 'filterAuditHp', 'auditStartDate', 'auditEndDate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const valutaS = document.getElementById('filterAuditValuta');
    if(valutaS) valutaS.selectedIndex = 0;
    const tipeS = document.getElementById('filterAuditTipe');
    if(tipeS) tipeS.selectedIndex = 0;
    
    window.filterAuditTable();
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
</body>

</html>
