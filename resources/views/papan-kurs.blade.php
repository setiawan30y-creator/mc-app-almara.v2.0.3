<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>PAPAN KURS DIGITAL | ALMARA MONEY CHANGER</title>
    @php
        $faviconPath = public_path('favicon.png');
    @endphp
    <link rel="icon" href="{{ file_exists($faviconPath) ? asset('favicon.png') . '?v=' . filemtime($faviconPath) : asset('favicon.ico') }}" type="image/png">
    <script>
        (function() {
            var nativeFetch = window.fetch.bind(window);
            window.__papanSessionConflictHandled = false;

            function clearLocalAuthState() {
                try { localStorage.removeItem('mc_currentUser'); } catch (e) {}
                try { sessionStorage.removeItem('mc_currentUser_password'); } catch (e) {}
            }

            async function handleSessionConflict(message) {
                if (window.__papanSessionConflictHandled) return;
                window.__papanSessionConflictHandled = true;
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

            window.fetch = async function(resource, options) {
                options = options || {};
                var url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
                var isSameOrigin = !/^https?:\/\//i.test(url) || url.indexOf(window.location.origin) === 0;
                var response = await nativeFetch(resource, options);
                if (isSameOrigin && response.status === 423) {
                    var conflictMessage = 'Akun ini sudah dipakai di perangkat lain. Silakan login ulang.';
                    try {
                        var cloned = response.clone();
                        var result = await cloned.json().catch(function() { return {}; });
                        if (result && result.message) conflictMessage = result.message;
                    } catch (e) {}
                    handleSessionConflict(conflictMessage);
                }
                return response;
            };

            setInterval(function() {
                nativeFetch('/auth/me', {
                    cache: 'no-store',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }).then(async function(response) {
                    if (response && response.status === 423) {
                        var conflictMessage = 'Akun ini sudah dipakai di perangkat lain. Silakan login ulang.';
                        try {
                            var cloned = response.clone();
                            var result = await cloned.json().catch(function() { return {}; });
                            if (result && result.message) conflictMessage = result.message;
                        } catch (e) {}
                        handleSessionConflict(conflictMessage);
                    }
                }).catch(function() {});
            }, 30000);
        })();
    </script>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@500;600;700;800;900&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            --bg-color: #020617; /* Dark slate */
            --card-bg: rgba(15, 23, 42, 0.6);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --buy-color: #22c55e; /* Bright Green */
            --sell-color: #ef4444; /* Bright Red */
            --gold-accent: #f59e0b; /* Gold */
            --gold-light: #fbbf24;
            --flash-up: #15803d; 
            --flash-down: #b91c1c; 
            --zoom-level: 100%;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            user-select: none;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: radial-gradient(circle at top left, #070d19, #020408);
            color: var(--text-primary);
            overflow: hidden;
            height: 100vh;
            width: 100vw;
            display: flex;
            flex-direction: column;
            zoom: var(--zoom-level);
            position: relative;
        }

        /* High Contrast Override */
        body.high-contrast {
            background: #000000 !important;
            --bg-color: #000000;
            --card-bg: #000000;
            --border-color: #ffffff;
            --text-primary: #ffffff;
            --text-secondary: #ffffff;
            --buy-color: #22c55e;
            --sell-color: #ef4444;
            --gold-accent: #fbbf24;
            --gold-light: #ffffff;
        }

        /* THEMES CONFIGURATION */
        body.theme-slate {
            background: radial-gradient(circle at top left, #070d19, #020408);
            --bg-color: #020617;
            --card-bg: rgba(15, 23, 42, 0.6);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --gold-accent: #f59e0b;
            --gold-light: #fbbf24;
            --buy-color: #22c55e;
            --sell-color: #ef4444;
        }

        body.theme-sapphire {
            background: radial-gradient(circle at top left, #0a1128, #000411);
            --bg-color: #000411;
            --card-bg: rgba(10, 25, 47, 0.65);
            --border-color: rgba(100, 180, 255, 0.15);
            --text-primary: #e0f2fe;
            --text-secondary: #7dd3fc;
            --gold-accent: #00d2ff;
            --gold-light: #70e4ff;
            --buy-color: #10b981;
            --sell-color: #f43f5e;
        }

        body.theme-emerald {
            background: radial-gradient(circle at top left, #022c22, #010504);
            --bg-color: #022c22;
            --card-bg: rgba(6, 78, 59, 0.45);
            --border-color: rgba(52, 211, 153, 0.15);
            --text-primary: #f0fdf4;
            --text-secondary: #a7f3d0;
            --gold-accent: #10b981;
            --gold-light: #34d399;
            --buy-color: #4ade80;
            --sell-color: #f87171;
        }

        body.theme-luxury {
            background: radial-gradient(circle at top left, #1c1303, #000000);
            --bg-color: #000000;
            --card-bg: rgba(24, 18, 5, 0.75);
            --border-color: rgba(217, 119, 6, 0.25);
            --text-primary: #fffbeb;
            --text-secondary: #fbbf24;
            --gold-accent: #d97706;
            --gold-light: #fbbf24;
            --buy-color: #22c55e;
            --sell-color: #ef4444;
        }

        body.theme-highcontrast {
            background: #000000 !important;
            --bg-color: #000000;
            --card-bg: #000000;
            --border-color: #ffffff;
            --text-primary: #ffffff;
            --text-secondary: #ffffff;
            --buy-color: #22c55e;
            --sell-color: #ef4444;
            --gold-accent: #fbbf24;
            --gold-light: #ffffff;
        }

        /* Decorative top gradient line */
        .top-gradient-line {
            height: 4px;
            background: linear-gradient(to right, var(--gold-accent) 0%, #3b82f6 50%, var(--gold-accent) 100%);
            width: 100%;
        }

        /* HEADER AREA */
        header {
            height: 12vh;
            padding: 0 2vw;
            border-bottom: var(--border-color) 1px solid;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 10;
        }

        .header-logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .logo-crown-wrapper {
            position: relative;
            width: 52px;
            height: 52px;
            border: 2px solid var(--gold-accent);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(15, 23, 42, 0.8);
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.35);
        }

        .logo-crown-wrapper i.fa-crown {
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%) rotate(-5deg);
            color: var(--gold-accent);
            font-size: 1.15rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        .logo-crown-wrapper span.letter-a {
            font-family: 'Montserrat', sans-serif;
            font-size: 2.2rem;
            font-weight: 900;
            color: var(--gold-accent);
            line-height: 1;
            margin-top: 2px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        .logo-text {
            display: flex;
            flex-direction: column;
            line-height: 1.1;
        }

        .logo-text h1 {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.7rem;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #ffffff;
            text-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }

        .logo-text h1 span.gold {
            color: var(--gold-accent);
        }

        .logo-text p.subtitle {
            font-size: 0.68rem;
            color: var(--gold-accent);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2.5px;
            margin-top: 3px;
        }

        .header-center-title {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        .header-center-title h2 {
            font-family: 'Dancing Script', cursive;
            font-size: 2.4rem;
            font-weight: 700;
            color: var(--gold-accent);
            line-height: 1;
            text-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }

        .header-center-title p.partner-text {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.25rem;
            font-weight: 900;
            color: #ffffff;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-top: 2px;
        }

        .header-center-title .badge-pill-gold {
            background: linear-gradient(135deg, var(--gold-accent) 0%, #b45309 100%);
            color: #000;
            font-family: 'Montserrat', sans-serif;
            font-size: 0.72rem;
            font-weight: 900;
            padding: 3px 18px;
            border-radius: 20px;
            margin-top: 6px;
            letter-spacing: 1px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            text-transform: uppercase;
        }

        .header-right-widgets {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .widget-box {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(15, 23, 42, 0.6);
            border: var(--border-color) 1px solid;
            padding: 6px 16px;
            border-radius: 10px;
            height: 52px;
        }

        .widget-icon-wrapper {
            font-size: 1.4rem;
            color: var(--gold-accent);
        }

        .widget-info {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
        }

        .widget-info .val-large {
            font-family: 'JetBrains Mono', monospace;
            font-size: 1.45rem;
            font-weight: 800;
            color: #ffffff;
        }

        .widget-info .lbl-small {
            font-size: 0.68rem;
            font-weight: 700;
            color: var(--gold-accent);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* MAIN APP CONTAINER */
        main {
            flex: 1;
            display: flex;
            height: 81vh;
            position: relative;
        }

        /* LEFT SIDE: RATES TABLE */
        .rates-side {
            width: 48vw;
            padding: 2vh 1.5vw;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-right: var(--border-color) 1px solid;
        }

        .rates-table-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-radius: 16px;
            overflow: hidden;
            border: var(--border-color) 1px solid;
            background: rgba(15, 23, 42, 0.4);
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }

        .rates-table-header {
            display: grid;
            grid-template-columns: 2.2fr 0.8fr 1.4fr 1.4fr;
            font-family: 'Montserrat', sans-serif;
            font-weight: 800;
            font-size: 0.88rem;
            letter-spacing: 1px;
            text-transform: uppercase;
            text-align: center;
        }

        .rates-table-header div {
            padding: 14px 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        .rates-table-header .col-currency {
            background: linear-gradient(to bottom, #1e293b, #0f172a);
            border-right: 1px solid rgba(255,255,255,0.06);
            justify-content: flex-start;
            padding-left: 24px;
        }

        .rates-table-header .col-trend {
            background: linear-gradient(to bottom, #1e293b, #0f172a);
            border-right: 1px solid rgba(255,255,255,0.06);
        }

        .rates-table-header .col-buy {
            background: linear-gradient(to bottom, #166534, #052e16);
            border-right: 1px solid rgba(255,255,255,0.06);
        }

        .rates-table-header .col-sell {
            background: linear-gradient(to bottom, #991b1b, #450a0a);
        }

        .rates-list-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start; /* Stack items closely from the top */
            overflow: hidden;
        }

        .rate-row-item {
            display: grid;
            grid-template-columns: 2.2fr 0.8fr 1.4fr 1.4fr;
            border-bottom: rgba(255, 255, 255, 0.04) 1px solid;
            background: rgba(15, 23, 42, 0.2);
            transition: all 0.3s ease;
            height: 50px; /* Fixed compact row height */
            align-items: center;
        }

        body.high-contrast .rate-row-item {
            border-bottom: #ffffff 1px solid;
        }

        .rate-row-item:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        .col-cell {
            padding: 0 15px;
            height: 100%;
            display: flex;
            align-items: center;
        }

        .col-cell-currency {
            border-right: 1px solid rgba(255,255,255,0.05);
            gap: 15px;
            padding-left: 20px;
        }

        .col-cell-trend {
            border-right: 1px solid rgba(255,255,255,0.05);
            justify-content: center;
        }

        body.high-contrast .col-cell-currency {
            border-right: 1px solid #ffffff;
        }

        body.high-contrast .col-cell-trend {
            border-right: 1px solid #ffffff;
        }

        .flag-frame {
            width: 48px; 
            height: 32px;
            border-radius: 4px; 
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 3px 6px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0f172a;
        }

        .flag-img-file {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .currency-meta-info {
            display: flex;
            flex-direction: column;
            line-height: 1.15;
        }

        .currency-meta-code {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.4rem; 
            font-weight: 900;
            color: #ffffff;
        }

        .currency-meta-name {
            font-size: 0.68rem;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
        }

        .col-cell-rate {
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
            font-size: 1.95rem; 
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .col-cell-buy {
            border-right: 1px solid rgba(255,255,255,0.05);
            color: var(--buy-color);
            text-shadow: 0 0 12px rgba(34, 197, 94, 0.2);
        }

        body.high-contrast .col-cell-buy {
            border-right: 1px solid #ffffff;
        }

        .col-cell-sell {
            color: var(--sell-color);
            text-shadow: 0 0 12px rgba(239, 68, 68, 0.25);
        }

        /* FLASH ANIMATIONS FOR RATES CHANGES */
        @keyframes flashUp {
            0% { background-color: transparent; }
            50% { background-color: var(--flash-up); color: #fff; text-shadow: 0 0 10px #fff; }
            100% { background-color: transparent; }
        }

        @keyframes flashDown {
            0% { background-color: transparent; }
            50% { background-color: var(--flash-down); color: #fff; text-shadow: 0 0 10px #fff; }
            100% { background-color: transparent; }
        }

        .flash-up-active {
            animation: flashUp 1.8s ease-in-out;
            border-radius: 6px;
        }

        .flash-down-active {
            animation: flashDown 1.8s ease-in-out;
            border-radius: 6px;
        }

        /* RIGHT SIDE: CONTENT & INFO */
        .info-side {
            width: 52vw;
            padding: 2vh 1.5vw;
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow: hidden;
        }

        /* Top Video container - Expanded to 78% height */
        .promo-media-container {
            height: 78%;
            border-radius: 16px;
            overflow: hidden;
            border: var(--border-color) 1px solid;
            background: #000;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            position: relative;
        }

        .promo-media-container iframe, 
        .promo-media-container video {
            width: 100%;
            height: 100%;
            border: none;
            object-fit: cover;
        }

        /* Play overlay emulation for mockup style */
        .video-play-overlay-emulation {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 2;
        }

        .video-play-button-icon {
            width: 65px;
            height: 65px;
            background: rgba(255, 255, 255, 0.95);
            color: #0f172a;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.8rem;
            padding-left: 5px; /* Alignment fix for triangle play */
            box-shadow: 0 0 25px rgba(255, 255, 255, 0.4);
            border: 2px solid #ffffff;
        }

        /* Middle row: Blue Slogan Banner & Gold Logo Badge */
        .promo-slogan-row {
            height: 12%;
            display: flex;
            gap: 12px;
        }

        .slogan-blue-card {
            flex: 1;
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
            border: var(--border-color) 1px solid;
            border-left: 4px solid var(--gold-accent);
            border-radius: 12px;
            padding: 8px 18px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }

        .slogan-blue-card h3 {
            font-family: 'Montserrat', sans-serif;
            color: var(--gold-accent);
            font-size: 0.82rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .slogan-blue-card p {
            font-size: 0.68rem;
            color: #cbd5e1;
            font-weight: 600;
            margin-top: 1px;
            text-transform: uppercase;
        }

        .logo-gold-card {
            width: 110px;
            background: #0f172a;
            border: var(--border-color) 1px solid;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }

        .logo-gold-card i.fa-crown {
            color: var(--gold-accent);
            font-size: 1.3rem;
            line-height: 1;
        }

        .logo-gold-card span.logo-sub {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.48rem;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
            line-height: 1.1;
        }

        /* Lower Row: 3 compartments - Reduced spacing for larger video */
        .info-bottom-grid {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }

        .grid-compartment {
            background: var(--card-bg);
            border: var(--border-color) 1px solid;
            border-radius: 14px;
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 6px 15px rgba(0,0,0,0.25);
            position: relative;
        }

        .grid-compartment-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.72rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--gold-accent);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            border-bottom: rgba(255,255,255,0.06) 1px solid;
            padding-bottom: 4px;
        }

        /* Features List Box */
        .features-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex: 1;
            justify-content: center;
        }

        .feature-row-item {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .feature-icon-circle {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 1px solid var(--gold-accent);
            background: rgba(245, 158, 11, 0.05);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--gold-accent);
            font-size: 0.75rem;
            flex-shrink: 0;
        }

        .feature-desc-text {
            display: flex;
            flex-direction: column;
            line-height: 1.15;
        }

        .feature-desc-text h4 {
            font-size: 0.72rem;
            font-weight: 800;
            color: #ffffff;
            text-transform: uppercase;
        }

        .feature-desc-text p {
            font-size: 0.6rem;
            color: var(--text-secondary);
            font-weight: 500;
        }

        /* Catatan Compartment */
        .notes-list {
            display: flex;
            flex-direction: column;
            gap: 5px;
            font-size: 0.65rem;
            font-weight: 500;
            color: #cbd5e1;
            line-height: 1.3;
        }

        .notes-list li {
            list-style: none;
            position: relative;
            padding-left: 12px;
        }

        .notes-list li::before {
            content: '•';
            position: absolute;
            left: 0;
            color: var(--gold-accent);
            font-weight: bold;
        }

        /* Follow Us (Social Media) */
        .social-contacts-box {
            display: flex;
            flex-direction: column;
            gap: 6px;
            justify-content: center;
            flex: 1;
        }

        .social-row-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.72rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .social-row-item i {
            font-size: 0.9rem;
            width: 18px;
        }

        .social-row-item i.fa-instagram { color: #ec4899; }
        .social-row-item i.fa-facebook { color: #3b82f6; }
        .social-row-item i.fa-phone { color: #22c55e; }

        /* QR Location Box */
        .qr-location-wrapper {
            display: flex;
            align-items: center;
            gap: 14px;
            height: 100%;
        }

        .qr-img-frame {
            width: 70px;
            height: 70px;
            border-radius: 8px;
            background: #ffffff;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            flex-shrink: 0;
        }

        .qr-img-frame img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .qr-desc-info {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
        }

        .qr-desc-info h4 {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.7rem;
            font-weight: 800;
            color: #ffffff;
            text-transform: uppercase;
        }

        .qr-desc-info p {
            font-size: 0.58rem;
            color: var(--text-secondary);
            font-weight: 600;
            margin-top: 2px;
        }

        /* FOOTER AREA - With weather and location widgets */
        footer {
            height: 7vh;
            background: rgba(15, 23, 42, 0.95);
            border-top: var(--border-color) 1px solid;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 0 2vw;
            z-index: 10;
        }

        .footer-left-slogan {
            font-family: 'Dancing Script', cursive;
            font-size: 1.9rem;
            color: var(--gold-accent);
            text-shadow: 0 2px 4px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .footer-left-slogan span.thank {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.78rem;
            font-weight: 800;
            color: #ffffff;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-left: 8px;
            margin-top: 5px;
        }

        /* Center Running Text (Marquee) */
        .footer-center-marquee {
            flex: 1;
            margin: 0 1.5vw;
            overflow: hidden;
            white-space: nowrap;
            position: relative;
            background: rgba(0, 0, 0, 0.35);
            border-radius: 20px;
            padding: 5px 15px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            height: 32px;
        }

        .marquee-content {
            display: inline-block;
            padding-left: 100%;
            animation: marquee-scroll 30s linear infinite;
            font-size: 0.82rem;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: 0.8px;
            text-transform: uppercase;
        }

        @keyframes marquee-scroll {
            0% {
                transform: translate3d(0, 0, 0);
            }
            100% {
                transform: translate3d(-100%, 0, 0);
            }
        }

        /* GEAR SETTINGS BUTTON */
        .btn-settings-trigger {
            position: absolute;
            bottom: 8vh;
            right: 2vw;
            background: rgba(30, 41, 59, 0.4);
            border: rgba(255,255,255,0.05) 1px solid;
            color: var(--text-secondary);
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 100;
            opacity: 0.2;
            transition: all 0.3s;
        }

        .btn-settings-trigger:hover {
            opacity: 1;
            background: rgba(30, 41, 59, 0.9);
            color: var(--text-primary);
            box-shadow: 0 0 12px rgba(255,255,255,0.1);
        }

        /* SETTINGS MODAL */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            z-index: 200;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .modal-box {
            background: #1e293b;
            border: var(--border-color) 1px solid;
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            max-height: 85vh;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            color: var(--text-primary);
            animation: modalScale 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            overflow: hidden;
        }

        @keyframes modalScale {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }

        .modal-header {
            padding: 16px 24px;
            border-bottom: var(--border-color) 1px solid;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .modal-header h3 {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.15rem;
            color: var(--gold-accent);
        }

        .modal-close {
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 1.3rem;
            cursor: pointer;
        }

        .modal-close:hover {
            color: #ef4444;
        }

        .modal-body {
            padding: 24px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .form-group label {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-secondary);
        }

        .form-group input[type="text"], 
        .form-group select, 
        .form-group textarea {
            background: #0f172a;
            border: var(--border-color) 1px solid;
            padding: 8px 12px;
            border-radius: 8px;
            color: #fff;
            font-size: 0.85rem;
            outline: none;
            width: 100%;
        }

        .form-group input[type="text"]:focus, 
        .form-group select:focus, 
        .form-group textarea:focus {
            border-color: var(--gold-accent);
        }

        .form-row-checkbox {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .form-row-checkbox input[type="checkbox"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .currencies-checklist-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 10px;
            background: #0f172a;
            border: var(--border-color) 1px solid;
            padding: 12px;
            border-radius: 8px;
            max-height: 130px;
            overflow-y: auto;
        }

        .checklist-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
        }

        <!-- Customizations panel without weather/location inputs -->
        .modal-footer {
            padding: 16px 24px;
            border-top: var(--border-color) 1px solid;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: rgba(15, 23, 42, 0.4);
        }

        .btn {
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
        }

        .btn-secondary {
            background: #475569;
            color: #fff;
        }

        .btn-secondary:hover {
            background: #334155;
        }

        .btn-primary {
            background: var(--gold-accent);
            color: #000;
        }

        .btn-primary:hover {
            background: var(--gold-light);
        }

        /* SCROLLBAR STYLE */
        ::-webkit-scrollbar {
            width: 6px;
        }
        ::-webkit-scrollbar-track {
            background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #475569;
        }

        /* Custom Logo Image style */
        .logo-crown-wrapper img.custom-logo {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 50%;
        }

        /* Footer Widgets */
        .footer-right-widgets {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .footer-widget-box {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: rgba(255, 255, 255, 0.08) 1px solid;
            padding: 6px 14px;
            border-radius: 8px;
            height: 38px;
            font-family: 'Montserrat', sans-serif;
            font-size: 0.82rem;
            font-weight: 700;
            color: #ffffff;
            transition: all 0.3s ease;
        }

        body.high-contrast .footer-widget-box {
            border: 1px solid #ffffff;
            background: #000;
        }

        .footer-widget-box i {
            color: var(--gold-accent);
            font-size: 1rem;
        }

        .footer-widget-box .widget-text {
            letter-spacing: 0.5px;
        }

        /* Modal Tabs */
        .modal-tabs {
            display: flex;
            gap: 5px;
            border-bottom: 2px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 8px;
            margin-bottom: 15px;
        }

        .modal-tab-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            font-family: 'Montserrat', sans-serif;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
            text-transform: uppercase;
        }

        .modal-tab-btn.active {
            background: var(--gold-accent);
            color: #000;
        }

        .modal-tab-btn:hover:not(.active) {
            color: #fff;
            background: rgba(255, 255, 255, 0.04);
        }

        .modal-tab-content {
            display: none;
            flex-direction: column;
            gap: 12px;
        }

        .modal-tab-content.active {
            display: flex;
        }

        .text-custom-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .text-custom-full {
            grid-column: span 2;
        }

        /* Compact ledger style for TV display */
        .rates-table-wrapper {
            border-radius: 12px;
        }

        .rates-table-header,
        .rate-row-item {
            grid-template-columns: 2.35fr 0.62fr 1.32fr 1.32fr;
        }

        .rates-table-header {
            font-size: 0.78rem;
            letter-spacing: 0.5px;
        }

        .rates-table-header div {
            padding: 10px 8px;
        }

        .rates-table-header .col-currency {
            padding-left: 18px;
        }

        .rate-row-item {
            height: 46px;
            border-bottom-color: rgba(255, 255, 255, 0.055);
        }

        .col-cell {
            padding: 0 10px;
        }

        .col-cell-currency {
            gap: 11px;
            padding-left: 14px;
        }

        .flag-frame {
            width: 42px;
            height: 28px;
        }

        .currency-meta-code {
            font-size: 1.12rem;
            letter-spacing: 0;
        }

        .currency-meta-name {
            max-width: 15vw;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 0.56rem;
        }

        .col-cell-rate {
            justify-content: flex-end;
            font-size: clamp(1.16rem, 1.72vw, 1.48rem);
            letter-spacing: 0;
            line-height: 1;
            font-variant-numeric: tabular-nums;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        body.board-tv-mode header {
            height: 10.5vh;
            padding: 0 1.5vw;
        }

        body.board-tv-mode main {
            height: 83vh;
        }

        body.board-tv-mode footer {
            height: 6.5vh;
            padding: 0 1.5vw;
        }

        body.board-tv-mode .header-logo-section {
            gap: 10px;
            min-width: 26vw;
        }

        body.board-tv-mode .logo-crown-wrapper {
            width: 44px;
            height: 44px;
            flex-shrink: 0;
        }

        body.board-tv-mode .logo-crown-wrapper span.letter-a {
            font-size: 1.85rem;
        }

        body.board-tv-mode .logo-text h1 {
            max-width: 24vw;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: clamp(1.05rem, 1.55vw, 1.42rem);
            letter-spacing: 0;
        }

        body.board-tv-mode .logo-text p.subtitle {
            max-width: 24vw;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: clamp(0.5rem, 0.68vw, 0.62rem);
            letter-spacing: 1.5px;
        }

        body.board-tv-mode .header-center-title h2 {
            font-size: clamp(1.55rem, 2.25vw, 2.15rem);
        }

        body.board-tv-mode .header-center-title p.partner-text {
            font-size: clamp(0.86rem, 1.2vw, 1.08rem);
            letter-spacing: 1px;
        }

        body.board-tv-mode .header-center-title .badge-pill-gold {
            font-size: 0.62rem;
            padding: 2px 14px;
            margin-top: 4px;
        }

        body.board-tv-mode .widget-box {
            height: 44px;
            padding: 5px 12px;
            gap: 8px;
        }

        body.board-tv-mode .widget-info .val-large {
            font-size: clamp(1rem, 1.35vw, 1.25rem);
        }

        body.board-tv-mode .widget-info .lbl-small {
            font-size: 0.56rem;
        }

        body.board-tv-mode .rates-side,
        body.board-tv-mode .info-side {
            padding: 1.4vh 1.1vw;
        }

        body.board-tv-mode .rates-table-header {
            font-size: clamp(0.62rem, 0.78vw, 0.75rem);
        }

        body.board-tv-mode .rate-row-item {
            height: clamp(38px, 5.05vh, 48px);
        }

        body.board-tv-mode .currency-meta-code {
            font-size: clamp(0.9rem, 1.2vw, 1.08rem);
        }

        body.board-tv-mode .currency-meta-name {
            font-size: clamp(0.45rem, 0.6vw, 0.55rem);
        }

        body.board-tv-mode .col-cell-rate {
            font-size: clamp(1rem, 1.52vw, 1.34rem);
        }

        body.board-tv-mode .footer-left-slogan {
            font-size: clamp(1.2rem, 1.8vw, 1.55rem);
        }

        body.board-tv-mode .footer-left-slogan span.thank,
        body.board-tv-mode .marquee-content,
        body.board-tv-mode .footer-widget-box {
            font-size: clamp(0.6rem, 0.78vw, 0.76rem);
        }
    </style>
</head>

<body @if(strtolower((string) optional(auth()->user())->role) === 'papan') class="board-tv-mode" @endif>
    <script>
        const COMPANY_PROFILE = @json($profile);
        const SERVER_BOARD_SETTINGS = @json($papanSettings);
    </script>
    <!-- Top colored decorative bar -->
    <div class="top-gradient-line"></div>

    <!-- HEADER -->
    <header>
        <div class="header-logo-section">
            <div class="logo-crown-wrapper" id="logoWrapper">
                <i class="fa-solid fa-crown" id="logoCrownIcon"></i>
                <span class="letter-a" id="logoTextLetter">A</span>
            </div>
            <div class="logo-text">
                <h1 id="txtCompName">ALMARA <span class="gold">PUTRA VALASINDO</span></h1>
                <p class="subtitle" id="txtCompSubtitle">Authorized Money Changer</p>
            </div>
        </div>

        <div class="header-center-title">
            <h2 id="txtHeaderCenterTitle">Your Trusted</h2>
            <p class="partner-text" id="txtHeaderCenterPartner">Currency Partner</p>
            <div class="badge-pill-gold" id="txtHeaderCenterBadge">Aman • Cepat • Terpercaya</div>
        </div>

        <div class="header-right-widgets">
            <!-- Clock Widget -->
            <div class="widget-box">
                <div class="widget-icon-wrapper">
                    <i class="fa-regular fa-clock"></i>
                </div>
                <div class="widget-info">
                    <span class="val-large" id="liveTime">10:45:30</span>
                    <span class="lbl-small" id="liveDay">MINGGU</span>
                </div>
            </div>

            <!-- Date Widget -->
            <div class="widget-box">
                <div class="widget-icon-wrapper">
                    <i class="fa-regular fa-calendar"></i>
                </div>
                <div class="widget-info">
                    <span class="val-large" id="liveDateDay">22</span>
                    <span class="lbl-small" id="liveDateMonthYear">JUNI 2025</span>
                </div>
            </div>
        </div>
    </header>

    <!-- MAIN APP CONTAINER -->
    <main>
        <!-- LEFT: RATES LIST PANEL -->
        <div class="rates-side" id="ratesPanel">
            <div class="rates-table-wrapper">
                <div class="rates-table-header">
                    <div class="col-currency" id="txtTableHeadCur">Currency</div>
                    <div class="col-trend">Trend</div>
                    <div class="col-buy" id="txtTableHeadBuy">We Buy (Beli)</div>
                    <div class="col-sell" id="txtTableHeadSell">We Sell (Jual)</div>
                </div>

                <div class="rates-list-body" id="ratesListBody">
                    <!-- Javascript will render rate rows here -->
                </div>
            </div>
        </div>

        <!-- RIGHT: PROMOTION & FEATURES SIDE -->
        <div class="info-side" id="infoPanel">
            <!-- Promo Video frame - Maximized vertical space (62%) -->
            <div class="promo-media-container" id="videoFrameWrapper">
                <!-- YouTube or local video injected here dynamically -->
            </div>



            <!-- Bottom grid split: 3 compartments -->
            <div class="info-bottom-grid">
                <!-- Keunggulan Kami -->
                <div class="grid-compartment">
                    <div class="grid-compartment-title" id="txtCompTitle1">
                        <i class="fa-solid fa-star"></i> Keunggulan Kami
                    </div>
                    <div class="features-list">
                        <div class="feature-row-item">
                            <div class="feature-icon-circle"><i class="fa-solid fa-shield-halved"></i></div>
                            <div class="feature-desc-text">
                                <h4 id="txtFeatTitle1">Transaksi Aman</h4>
                                <p id="txtFeatDesc1">Aman dan terpercaya dengan rate terbaik</p>
                            </div>
                        </div>
                        <div class="feature-row-item">
                            <div class="feature-icon-circle"><i class="fa-regular fa-clock"></i></div>
                            <div class="feature-desc-text">
                                <h4 id="txtFeatTitle2">Proses Cepat</h4>
                                <p id="txtFeatDesc2">Transaksi cepat dan tidak berbelit</p>
                            </div>
                        </div>
                        <div class="feature-row-item">
                            <div class="feature-icon-circle"><i class="fa-solid fa-headset"></i></div>
                            <div class="feature-desc-text">
                                <h4 id="txtFeatTitle3">Layanan Prima</h4>
                                <p id="txtFeatDesc3">Kepuasan Anda Prioritas Kami</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Catatan Transaksi -->
                <div class="grid-compartment" style="display: none;">
                    <div class="grid-compartment-title" id="txtCompTitle2">
                        <i class="fa-solid fa-circle-info"></i> Catatan
                    </div>
                    <ul class="notes-list">
                        <li id="txtNote1">Kurs dapat berubah sewaktu-waktu tanpa pemberitahuan terlebih dahulu</li>
                        <li id="txtNote2">Pastikan uang yang Anda terima tidak palsu atau rusak</li>
                        <li id="txtNote3">Tidak menerima uang kertas dalam kondisi rusak berat</li>
                    </ul>
                </div>

                <!-- Follow Us (Social Media) -->
                <div class="grid-compartment">
                    <div class="grid-compartment-title" id="txtCompTitle3">
                        <i class="fa-solid fa-share-nodes"></i> Follow Us
                    </div>
                    <div class="social-contacts-box">
                        <div class="social-row-item">
                            <i class="fa-brands fa-instagram"></i>
                            <span id="txtInstagram">@almaravalasindo</span>
                        </div>
                        <div class="social-row-item">
                            <i class="fa-brands fa-facebook"></i>
                            <span id="txtFacebook">Almara Putra Valasindo</span>
                        </div>
                        <div class="social-row-item">
                            <i class="fa-solid fa-phone"></i>
                            <span id="txtWhatsapp">0812-3456-7890</span>
                        </div>
                    </div>
                </div>

                <!-- QR Location scan -->
                <div class="grid-compartment">
                    <div class="qr-location-wrapper">
                        <div class="qr-img-frame">
                            <img id="imgQrCode" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Almara" alt="QR Code Lokasi">
                        </div>
                        <div class="qr-desc-info">
                            <h4 id="txtQrText1">Scan Untuk</h4>
                            <h4 id="txtQrText2">Lokasi Kami</h4>
                            <p id="txtQrDesc">Buka peta rute gerai Almara</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- Hidden gear settings button -->
        <div class="btn-settings-trigger" id="boardSettingsTrigger" onclick="openSettingsModal()" title="Buka Pengaturan Monitor" @if(!in_array(strtolower((string) optional(auth()->user())->role), ['owner', 'superadmin'], true)) style="display:none;" @endif>
            <i class="fa-solid fa-gear"></i>
        </div>
    </main>

    <!-- FOOTER -->
    <footer>
        <div class="footer-left-slogan" id="txtFooterLeftSlogan">
            Terima Kasih <span class="thank" id="txtFooterLeftThank">Atas Kepercayaan Anda</span>
        </div>
        
        <!-- Running Text (Tengah) -->
        <div class="footer-center-marquee">
            <div class="marquee-content" id="txtRunningText">Membaca informasi berjalan...</div>
        </div>

        <!-- Weather and Location Widget (Automatic Only) -->
        <div class="footer-right-widgets">
            <div class="footer-widget-box" id="widgetLocation">
                <i class="fa-solid fa-location-dot"></i>
                <span class="widget-text" id="footerCityName">MENDETEKSI LOKASI...</span>
            </div>
            <div class="footer-widget-box" id="widgetWeather">
                <i class="fa-solid fa-cloud-sun" id="footerWeatherIcon"></i>
                <span class="widget-text" id="footerWeatherDesc">--°C --</span>
            </div>
        </div>
    </footer>

    <!-- SETTINGS MODAL DIALOG -->
    <div class="modal-overlay" id="settingsOverlay">
        <div class="modal-box">
            <div class="modal-header">
                <h3>Pengaturan Layar Monitor Papan Kurs</h3>
                <button class="modal-close" onclick="closeSettingsModal()">&times;</button>
            </div>
            <div class="modal-body">
                
                <!-- Tab Headers -->
                <div class="modal-tabs">
                    <button class="modal-tab-btn active" id="btn-m-general" onclick="switchModalTab('general')">Monitor & Video</button>
                    <button class="modal-tab-btn" id="btn-m-texts" onclick="switchModalTab('texts')">Kustomisasi Teks & Logo</button>
                    <button class="modal-tab-btn" id="btn-m-others" onclick="switchModalTab('others')">Kontak & Valuta</button>
                </div>

                <!-- TAB 1: GENERAL MONITOR SETTINGS -->
                <div class="modal-tab-content active" id="tab-m-general">
                    <!-- Theme Settings (Hidden) -->
                    <div class="form-row-checkbox" style="display: none;">
                        <input type="checkbox" id="setHighContrast">
                        <label for="setHighContrast" style="font-weight: 700; cursor: pointer; color: var(--gold-accent);">Aktifkan Mode Kontras Tinggi (Latar Belakang Hitam Pekat)</label>
                    </div>

                    <!-- Layout Video Toggle -->
                    <div class="form-row-checkbox">
                        <input type="checkbox" id="setEnableVideo" onchange="toggleVideoUrlInput(this.checked)">
                        <label for="setEnableVideo" style="font-weight: 600; cursor: pointer;">Aktifkan Bingkai Video Promosi (Split Screen)</label>
                    </div>

                    <!-- Video Link Input -->
                    <div class="form-group" id="videoUrlGroup">
                        <label for="setVideoUrl">Link Video (YouTube Embed atau file MP4)</label>
                        <input type="text" id="setVideoUrl" placeholder="Contoh: https://youtu.be/JAZirp8Y3l8">
                    </div>

                    <!-- Rotation Settings -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label for="setMaxRows">Valuta Maks per Halaman</label>
                            <select id="setMaxRows">
                                <option value="4">4 Baris</option>
                                <option value="5">5 Baris</option>
                                <option value="6">6 Baris</option>
                                <option value="7">7 Baris</option>
                                <option value="8">8 Baris</option>
                                <option value="9">9 Baris</option>
                                <option value="10">10 Baris</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="setSlideInterval">Interval Slide Rotasi (Detik)</label>
                            <input type="text" id="setSlideInterval" placeholder="Contoh: 10">
                        </div>
                    </div>

                    <!-- Font Zoom settings -->
                    <div class="form-group">
                        <label for="setFontZoom">Zoom Ukuran Tulisan (Skala %)</label>
                        <select id="setFontZoom">
                            <option value="80">80% (Kecil)</option>
                            <option value="90">90%</option>
                            <option value="100">100% (Normal)</option>
                            <option value="110">110%</option>
                            <option value="120">120% (Besar)</option>
                            <option value="130">130%</option>
                        </select>
                    </div>

                    <!-- Pilihan Tema Warna -->
                    <div class="form-group">
                        <label for="setTheme">Tema Warna Desain</label>
                        <select id="setTheme">
                            <option value="slate">Midnight Slate (Default)</option>
                            <option value="sapphire">Royal Sapphire (Biru)</option>
                            <option value="emerald">Emerald Forest (Hijau)</option>
                            <option value="luxury">Golden Luxury (Emas-Hitam)</option>
                            <option value="highcontrast">High Contrast (Kontras Tinggi)</option>
                        </select>
                    </div>

                    <!-- Konfigurasi Running Text -->
                    <div style="border-top: 1px solid var(--border-color); margin-top: 15px; padding-top: 15px;">
                        <label style="color: var(--gold-accent); font-weight: bold; margin-bottom: 8px; display: block;">Running Text (Informasi Berjalan)</label>
                        
                        <div class="form-group">
                            <label for="setRunningTextMode">Mode Running Text</label>
                            <select id="setRunningTextMode" onchange="toggleRunningTextInput(this.value)">
                                <option value="holiday">Hari Besar Nasional & Fallback (Otomatis)</option>
                                <option value="manual">Teks Kustom (Isi Manual)</option>
                            </select>
                        </div>
                        
                        <div class="form-group" id="runningTextManualGroup">
                            <label for="setRunningTextManual">Isi Teks Kustom</label>
                            <input type="text" id="setRunningTextManual" placeholder="Tulis pesan kustom di sini...">
                        </div>
                    </div>
                </div>

                <!-- TAB 2: TEXTS & LOGO CUSTOMIZATION -->
                <div class="modal-tab-content" id="tab-m-texts" style="max-height: 50vh; overflow-y: auto; padding-right: 5px;">
                    <!-- Logo Upload -->
                    <div class="form-group">
                        <label style="color: var(--gold-accent); font-weight: bold;">Logo Perusahaan</label>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="file" id="setLogoFile" accept="image/*" style="display: none;" onchange="previewLogo(this)">
                            <button class="btn btn-secondary" onclick="document.getElementById('setLogoFile').click()" style="padding: 6px 12px; font-size: 0.75rem;">Pilih Gambar Logo</button>
                            <button class="btn btn-secondary" onclick="resetLogoImage()" style="padding: 6px 12px; font-size: 0.75rem; background: #991b1b;">Reset Bawaan</button>
                        </div>
                        <div id="logoPreviewWrapper" style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                            <img id="logoPreviewImg" src="" style="width: 36px; height: 36px; border-radius: 50%; object-fit: contain; border: 1px solid var(--gold-accent); display: none;">
                            <span id="logoPreviewTxt" style="font-size: 0.72rem; color: var(--text-secondary);">Menggunakan Logo Crown</span>
                        </div>
                    </div>

                    <!-- Company Name Override -->
                    <div class="form-group">
                        <label for="setCompName">Nama Perusahaan (Biarkan kosong untuk mengikuti Profil PT)</label>
                        <input type="text" id="setCompName" placeholder="Contoh: ALMARA PUTRA VALASINDO">
                    </div>

                    <div class="form-group">
                        <label for="setCompSubtitle">Sub-judul Header Kiri</label>
                        <input type="text" id="setCompSubtitle" placeholder="Authorized Money Changer">
                    </div>

                    <!-- Header Center -->
                    <div class="text-custom-grid">
                        <div class="form-group">
                            <label for="setHeaderCenterTitle">Judul Header Tengah</label>
                            <input type="text" id="setHeaderCenterTitle">
                        </div>
                        <div class="form-group">
                            <label for="setHeaderCenterPartner">Subtitle Header Tengah</label>
                            <input type="text" id="setHeaderCenterPartner">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="setHeaderCenterBadge">Badge Header Tengah</label>
                        <input type="text" id="setHeaderCenterBadge">
                    </div>

                    <!-- Slogan & Banner -->
                    <div class="text-custom-grid">
                        <div class="form-group">
                            <label for="setPromoSloganTitle">Judul Slogan Biru</label>
                            <input type="text" id="setPromoSloganTitle">
                        </div>
                        <div class="form-group">
                            <label for="setPromoSloganDesc">Deskripsi Slogan Biru</label>
                            <input type="text" id="setPromoSloganDesc">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="setPromoGoldLogoText">Teks Kartu Emas Kecil (Gunakan \n untuk baris baru)</label>
                        <input type="text" id="setPromoGoldLogoText">
                    </div>

                    <!-- Footer Slogan -->
                    <div class="text-custom-grid">
                        <div class="form-group">
                            <label for="setFooterLeftSlogan">Footer Slogan Kiri</label>
                            <input type="text" id="setFooterLeftSlogan">
                        </div>
                        <div class="form-group">
                            <label for="setFooterLeftThank">Footer Slogan Kanan</label>
                            <input type="text" id="setFooterLeftThank">
                        </div>
                    </div>

                    <!-- Keunggulan Kami -->
                    <div class="form-group">
                        <label for="setCompTitle1" style="font-weight: 700; color: var(--gold-accent);">Judul Box Keunggulan</label>
                        <input type="text" id="setCompTitle1">
                    </div>
                    <div class="text-custom-grid">
                        <div class="form-group">
                            <label for="setFeatTitle1">Fitur 1 Judul</label>
                            <input type="text" id="setFeatTitle1">
                        </div>
                        <div class="form-group">
                            <label for="setFeatDesc1">Fitur 1 Deskripsi</label>
                            <input type="text" id="setFeatDesc1">
                        </div>
                        <div class="form-group">
                            <label for="setFeatTitle2">Fitur 2 Judul</label>
                            <input type="text" id="setFeatTitle2">
                        </div>
                        <div class="form-group">
                            <label for="setFeatDesc2">Fitur 2 Deskripsi</label>
                            <input type="text" id="setFeatDesc2">
                        </div>
                        <div class="form-group">
                            <label for="setFeatTitle3">Fitur 3 Judul</label>
                            <input type="text" id="setFeatTitle3">
                        </div>
                        <div class="form-group">
                            <label for="setFeatDesc3">Fitur 3 Deskripsi</label>
                            <input type="text" id="setFeatDesc3">
                        </div>
                    </div>

                    <!-- Catatan (Sembunyikan) -->
                    <div style="display: none;">
                        <div class="form-group">
                            <label for="setCompTitle2" style="font-weight: 700; color: var(--gold-accent);">Judul Box Catatan</label>
                            <input type="text" id="setCompTitle2">
                        </div>
                        <div class="form-group">
                            <label for="setNote1">Catatan 1</label>
                            <input type="text" id="setNote1">
                        </div>
                        <div class="form-group">
                            <label for="setNote2">Catatan 2</label>
                            <input type="text" id="setNote2">
                        </div>
                        <div class="form-group">
                            <label for="setNote3">Catatan 3</label>
                            <input type="text" id="setNote3">
                        </div>
                    </div>

                    <!-- QR Code Location Box -->
                    <div class="form-group">
                        <label for="setCompTitle4" style="font-weight: 700; color: var(--gold-accent);">Judul Box QR Peta</label>
                        <input type="text" id="setCompTitle4" placeholder="Scan Untuk Lokasi Kami">
                    </div>
                    <div class="text-custom-grid">
                        <div class="form-group">
                            <label for="setQrText1">QR Judul Baris 1</label>
                            <input type="text" id="setQrText1">
                        </div>
                        <div class="form-group">
                            <label for="setQrText2">QR Judul Baris 2</label>
                            <input type="text" id="setQrText2">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="setQrDesc">QR Deskripsi</label>
                        <input type="text" id="setQrDesc">
                    </div>

                    <!-- Table Headers -->
                    <div class="form-group">
                        <label style="font-weight: 700; color: var(--gold-accent);">Judul Kolom Tabel Kurs</label>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                        <div class="form-group">
                            <label for="setTableHeadCur">Kolom 1 (Valuta)</label>
                            <input type="text" id="setTableHeadCur">
                        </div>
                        <div class="form-group">
                            <label for="setTableHeadBuy">Kolom 2 (Beli)</label>
                            <input type="text" id="setTableHeadBuy">
                        </div>
                        <div class="form-group">
                            <label for="setTableHeadSell">Kolom 3 (Jual)</label>
                            <input type="text" id="setTableHeadSell">
                        </div>
                    </div>
                </div>

                <!-- TAB 3: CONTACTS & CURRENCY FILTER -->
                <div class="modal-tab-content" id="tab-m-others">
                    <!-- Currencies Filter Checklist -->
                    <div class="form-group">
                        <label>Saring Valuta yang Ditampilkan (Pilih)</label>
                        <div class="currencies-checklist-grid" id="currenciesChecklistGrid">
                            <!-- Checklist options loaded from all available currencies -->
                        </div>
                    </div>

                    <!-- QR Location Link -->
                    <div class="form-group">
                        <label for="setQrLink">Link QR Code (Lokasi Google Maps)</label>
                        <input type="text" id="setQrLink" placeholder="Tautan peta gerai...">
                    </div>

                    <!-- Social Contacts Info -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                        <div class="form-group">
                            <label for="setInstagram">Instagram</label>
                            <input type="text" id="setInstagram" placeholder="@almaravalasindo">
                        </div>
                        <div class="form-group">
                            <label for="setFacebook">Facebook</label>
                            <input type="text" id="setFacebook" placeholder="Almara Valasindo">
                        </div>
                        <div class="form-group">
                            <label for="setWhatsapp">WhatsApp</label>
                            <input type="text" id="setWhatsapp" placeholder="0812-3456-7890">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="setCompTitle3">Judul Box Sosial Media</label>
                        <input type="text" id="setCompTitle3">
                    </div>
                </div>

            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeSettingsModal()">Batal</button>
                <button class="btn btn-primary" onclick="saveSettings()">Simpan & Terapkan</button>
            </div>
        </div>
    </div>

    <!-- SCRIPTS -->
    <script>
        const CURRENT_BOARD_USER_ROLE = @json(strtolower((string) optional(auth()->user())->role));
        const IS_BOARD_ONLY_USER = CURRENT_BOARD_USER_ROLE === 'papan';
        const CAN_MANAGE_BOARD_SETTINGS = ['owner', 'superadmin'].includes(CURRENT_BOARD_USER_ROLE);
        const DEFAULT_BOARD_VIDEO_URL = 'https://youtu.be/JAZirp8Y3l8?si=AZ6ygNhvOZ3gGz8k';
        const LEGACY_BOARD_VIDEO_ID = 'dQw4w9WgXcQ';

        // Default Configs
        const DEFAULT_SETTINGS = {
            showVideo: true,
            videoUrl: DEFAULT_BOARD_VIDEO_URL,
            visibleCurrencies: [], // Empty means show all
            maxRowsPerPage: 10,
            rotationInterval: 12, // seconds
            fontZoom: 100,
            theme: 'slate',
            runningTextMode: 'holiday',
            runningTextManual: 'Selamat datang di Almara Money Changer. Kami memberikan pelayanan penukaran valuta asing terbaik, aman, cepat, dan terpercaya dengan rate bersaing.',
            instagram: '@almaravalasindo',
            facebook: 'Almara Putra Valasindo',
            whatsapp: '0812-3456-7890',
            qrLink: 'https://maps.google.com',
            highContrast: false,

            // Customizable texts
            logoBase64: '',
            compName: '', // Empty means follow COMPANY_PROFILE.name
            compSubtitle: 'Authorized Money Changer',
            headerCenterTitle: 'Your Trusted',
            headerCenterPartner: 'Currency Partner',
            headerCenterBadge: 'Aman • Cepat • Terpercaya',
            tableHeadCur: 'Currency',
            tableHeadBuy: 'We Buy (Beli)',
            tableHeadSell: 'We Sell (Jual)',
            promoSloganTitle: 'Transaksi Valas Anda',
            promoSloganDesc: 'Aman, Cepat, dan Terpercaya — Melayani Dengan Hati',
            promoGoldLogoText: 'ALMARA\nVALASINDO',
            compTitle1: 'Keunggulan Kami',
            compTitle2: 'Catatan',
            compTitle3: 'Follow Us',
            compTitle4: 'Scan Untuk Lokasi Kami',
            featTitle1: 'Transaksi Aman',
            featDesc1: 'Aman dan terpercaya dengan rate terbaik',
            featTitle2: 'Proses Cepat',
            featDesc2: 'Transaksi cepat dan tidak berbelit',
            featTitle3: 'Layanan Prima',
            featDesc3: 'Kepuasan Anda Prioritas Kami',
            note1: 'Kurs dapat berubah sewaktu-waktu tanpa pemberitahuan terlebih dahulu',
            note2: 'Pastikan uang yang Anda terima tidak palsu atau rusak',
            note3: 'Tidak menerima uang kertas dalam kondisi rusak berat',
            qrText1: 'Scan Untuk',
            qrText2: 'Lokasi Kami',
            qrDesc: 'Buka peta rute gerai Almara',
            footerLeftSlogan: 'Terima Kasih',
            footerLeftThank: 'Atas Kepercayaan Anda'
        };

        // Internal State variables
        let settings = { ...DEFAULT_SETTINGS };
        let allCurrencies = [];
        let previousRatesMap = {}; 
        let currentPageIndex = 0;
        let rotationTimer = null;
        let updateTimer = null;
        let weatherTimer = null;
        let logoBase64Temp = ''; // Temporary storage for logo upload

        // Init App
        document.addEventListener('DOMContentLoaded', () => {
            loadLocalSettings();
            applyThemeZoom();
            startClock();
            initWeatherAndLocation();
            
            // Initial data pull
            fetchRatesData().then(() => {
                renderChecklistOptions();
                startCarouselRotation();
            });

            // Start API data polling interval (every 10 seconds)
            updateTimer = setInterval(() => {
                fetchRatesData({ silent: true }).then(() => {
                    renderCurrentPage();
                });
            }, 10000);

            // Double click anywhere to open settings
            document.body.addEventListener('dblclick', (e) => {
                if (CAN_MANAGE_BOARD_SETTINGS && !e.target.closest('.modal-box')) {
                    openSettingsModal();
                }
            });

            // Set up weather polling (every 15 minutes)
            weatherTimer = setInterval(updateWeatherOnly, 900000);
        });

        // Modal Tab Switcher
        function switchModalTab(tabId) {
            // Remove active classes
            document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.modal-tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active classes
            document.getElementById(`btn-m-${tabId}`).classList.add('active');
            document.getElementById(`tab-m-${tabId}`).classList.add('active');
        }

        // Preview uploaded logo
        function previewLogo(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    logoBase64Temp = e.target.result;
                    const img = document.getElementById('logoPreviewImg');
                    img.src = logoBase64Temp;
                    img.style.display = 'block';
                    document.getElementById('logoPreviewTxt').textContent = 'Logo Terpilih (Belum disimpan)';
                };
                reader.readAsDataURL(input.files[0]);
            }
        }

        // Reset logo image
        function resetLogoImage() {
            logoBase64Temp = '';
            document.getElementById('logoPreviewImg').style.display = 'none';
            document.getElementById('logoPreviewImg').src = '';
            document.getElementById('logoPreviewTxt').textContent = 'Menggunakan Logo Crown';
            document.getElementById('setLogoFile').value = '';
        }

        // Weather and Geolocation auto detection
        let currentLat = 0.5070; // default Pekanbaru
        let currentLon = 101.4478;

        function initWeatherAndLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        currentLat = position.coords.latitude;
                        currentLon = position.coords.longitude;
                        fetchCityFromCoords(currentLat, currentLon);
                        fetchWeather(currentLat, currentLon);
                    },
                    (error) => {
                        console.log("GPS access denied/failed, using IP geolocator.");
                        fetchLocationByIP();
                    },
                    { timeout: 8000 }
                );
            } else {
                fetchLocationByIP();
            }
        }

        async function fetchLocationByIP() {
            try {
                const res = await fetch('https://ipapi.co/json/');
                if (res.ok) {
                    const data = await res.json();
                    const city = data.city || 'Pekanbaru';
                    currentLat = data.latitude || 0.5070;
                    currentLon = data.longitude || 101.4478;
                    document.getElementById('footerCityName').textContent = city.toUpperCase();
                    fetchWeather(currentLat, currentLon);
                } else {
                    useDefaultLocation();
                }
            } catch (e) {
                console.error("Gagal mendeteksi lokasi via IP:", e);
                useDefaultLocation();
            }
        }

        function useDefaultLocation() {
            document.getElementById('footerCityName').textContent = 'PEKANBARU';
            fetchWeather(0.5070, 101.4478);
        }

        async function fetchCityFromCoords(lat, lon) {
            try {
                // Nominatim reverse geo
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
                    headers: { 'User-Agent': 'Almara-Exchange/1.0' }
                });
                if (res.ok) {
                    const data = await res.json();
                    const city = data.address.city || data.address.town || data.address.village || data.address.county || 'LOKASI DETEKSI';
                    document.getElementById('footerCityName').textContent = city.toUpperCase();
                } else {
                    document.getElementById('footerCityName').textContent = 'LOKASI DETEKSI';
                }
            } catch (e) {
                document.getElementById('footerCityName').textContent = 'LOKASI DETEKSI';
            }
        }

        async function fetchWeather(lat, lon) {
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.current) {
                        const temp = Math.round(data.current.temperature_2m);
                        const code = data.current.weather_code;
                        const weather = getWeatherDetails(code);
                        
                        document.getElementById('footerWeatherDesc').textContent = `${temp}°C ${weather.text}`;
                        const iconEl = document.getElementById('footerWeatherIcon');
                        iconEl.className = `fa-solid ${weather.icon}`;
                    }
                }
            } catch (e) {
                console.error("Gagal mengambil data cuaca:", e);
            }
        }

        function updateWeatherOnly() {
            fetchWeather(currentLat, currentLon);
        }

        function getWeatherDetails(code) {
            const map = {
                0: { text: 'Cerah', icon: 'fa-sun' },
                1: { text: 'Cerah Berawan', icon: 'fa-cloud-sun' },
                2: { text: 'Berawan', icon: 'fa-cloud' },
                3: { text: 'Berawan Tebal', icon: 'fa-cloud' },
                45: { text: 'Kabut', icon: 'fa-smog' },
                48: { text: 'Kabut', icon: 'fa-smog' },
                51: { text: 'Gerimis', icon: 'fa-cloud-rain' },
                53: { text: 'Gerimis', icon: 'fa-cloud-rain' },
                55: { text: 'Gerimis Lebat', icon: 'fa-cloud-rain' },
                61: { text: 'Hujan Ringan', icon: 'fa-cloud-showers-heavy' },
                63: { text: 'Hujan', icon: 'fa-cloud-showers-heavy' },
                65: { text: 'Hujan Lebat', icon: 'fa-cloud-showers-heavy' },
                80: { text: 'Hujan Deras', icon: 'fa-cloud-showers-water' },
                81: { text: 'Hujan Deras', icon: 'fa-cloud-showers-water' },
                82: { text: 'Hujan Badai', icon: 'fa-cloud-showers-water' },
                95: { text: 'Badai Petir', icon: 'fa-cloud-bolt' },
                96: { text: 'Badai Petir', icon: 'fa-cloud-bolt' },
                99: { text: 'Badai Petir', icon: 'fa-cloud-bolt' }
            };
            return map[code] || { text: 'Cerah Berawan', icon: 'fa-cloud-sun' };
        }

        // Clock function
        function startClock() {
            const timeEl = document.getElementById('liveTime');
            const dayEl = document.getElementById('liveDay');
            const dateDayEl = document.getElementById('liveDateDay');
            const dateMonthYearEl = document.getElementById('liveDateMonthYear');
            
            const daysMap = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
            
            function updateTime() {
                const now = new Date();
                
                // Format Time: HH:MM:SS
                timeEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
                
                // Format Day
                dayEl.textContent = daysMap[now.getDay()];
                
                // Format Date Day: DD
                dateDayEl.textContent = String(now.getDate()).padStart(2, '0');
                
                // Format Date Month Year: MMMM YYYY
                const monthName = now.toLocaleString('id-ID', { month: 'long' }).toUpperCase();
                dateMonthYearEl.textContent = `${monthName} ${now.getFullYear()}`;
            }

            updateTime();
            setInterval(updateTime, 1000);
        }

        // Fetch rates data from public API
        async function fetchRatesData(options = {}) {
            try {
                const response = await fetch('/api/public/currencies?t=' + Date.now(), { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const currentRatesMap = {};
                        
                        allCurrencies = data.map(item => {
                            let parsedRaw = {};
                            if (item.raw_json) {
                                try {
                                    parsedRaw = JSON.parse(item.raw_json) || {};
                                } catch (e) {
                                    parsedRaw = {};
                                }
                            }
                            const code = item.code || parsedRaw.code;
                            const buy = parseFloat(item.buy) || 0;
                            const sell = parseFloat(item.sell) || 0;
                            const trend = parsedRaw.trend || 'flat';
                            
                            currentRatesMap[code] = { buy, sell };
                            return { ...item, ...parsedRaw, code, buy, sell, trend };
                        });

                        // Verify changes to trigger flash animations
                        if (Object.keys(previousRatesMap).length > 0) {
                            allCurrencies.forEach(item => {
                                const old = previousRatesMap[item.code];
                                if (old) {
                                    if (item.buy > old.buy) item.buyChange = 'up';
                                    else if (item.buy < old.buy) item.buyChange = 'down';

                                    if (item.sell > old.sell) item.sellChange = 'up';
                                    else if (item.sell < old.sell) item.sellChange = 'down';
                                }
                            });
                        }

                        previousRatesMap = currentRatesMap;
                    }
                }
            } catch (error) {
                if (!options.silent) {
                    console.error("Gagal menarik data kurs dari API:", error);
                }
            }
        }

        function parseJsonMaybe(value) {
            let parsed = value;
            for (let i = 0; i < 2; i++) {
                if (typeof parsed !== 'string') break;
                try {
                    parsed = JSON.parse(parsed);
                } catch (e) {
                    break;
                }
            }
            return parsed && typeof parsed === 'object' ? parsed : null;
        }

        function isLegacyDefaultVideo(url) {
            return typeof url === 'string' && url.includes(LEGACY_BOARD_VIDEO_ID);
        }

        function normalizeBoardSettings(nextSettings) {
            const normalized = { ...DEFAULT_SETTINGS, ...(nextSettings && typeof nextSettings === 'object' ? nextSettings : {}) };
            if (!normalized.videoUrl || isLegacyDefaultVideo(normalized.videoUrl)) {
                normalized.videoUrl = DEFAULT_BOARD_VIDEO_URL;
            }
            return normalized;
        }

        function readServerBoardSettings() {
            if (window.__serverBoardSettingsOverride) return window.__serverBoardSettingsOverride;
            if (!SERVER_BOARD_SETTINGS) return null;
            return parseJsonMaybe(SERVER_BOARD_SETTINGS);
        }

        function persistBoardSettingsToServer(nextSettings) {
            if (!CAN_MANAGE_BOARD_SETTINGS) return;
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            fetch('/api/datastore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': token
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    store_key: 'mc_papan_settings',
                    json_data: nextSettings
                })
            }).catch(error => console.warn('Gagal menyimpan setting papan kurs ke server:', error));
        }

        // Load settings from server first, then localStorage fallback
        function loadLocalSettings() {
            try {
                const serverSettings = readServerBoardSettings();
                if (serverSettings && typeof serverSettings === 'object') {
                    settings = normalizeBoardSettings(serverSettings);
                    localStorage.setItem('mc_papan_settings', JSON.stringify(settings));
                } else {
                    const local = localStorage.getItem('mc_papan_settings');
                    if (local) {
                        settings = normalizeBoardSettings(parseJsonMaybe(local));
                    } else {
                        settings = normalizeBoardSettings(null);
                    }
                }
            } catch (e) {
                settings = normalizeBoardSettings(null);
            }
            
            // Apply layout settings
            const videoPanel = document.getElementById('videoFrameWrapper');
            const ratesPanel = document.getElementById('ratesPanel');
            const infoPanel = document.getElementById('infoPanel');
            
            if (settings.showVideo) {
                if (videoPanel) videoPanel.style.display = 'block';
                if (ratesPanel) ratesPanel.style.width = '48vw';
                if (infoPanel) {
                    infoPanel.style.display = 'flex';
                    infoPanel.style.width = '52vw';
                }
                renderVideoPlayer();
            } else {
                if (videoPanel) videoPanel.style.display = 'none';
                if (ratesPanel) ratesPanel.style.width = '100vw';
                if (infoPanel) infoPanel.style.display = 'none';
            }

            // Helper to set text safely
            const safeSetText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            const safeSetHtml = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = val;
            };

            // Apply customizable content
            safeSetText('txtInstagram', settings.instagram || DEFAULT_SETTINGS.instagram);
            safeSetText('txtFacebook', settings.facebook || DEFAULT_SETTINGS.facebook);
            safeSetText('txtWhatsapp', settings.whatsapp || DEFAULT_SETTINGS.whatsapp);
            
            // Apply QR Code location link
            const qrLinkUrl = settings.qrLink || DEFAULT_SETTINGS.qrLink;
            const qrImg = document.getElementById('imgQrCode');
            if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrLinkUrl)}`;

            // Apply Theme Class
            const themeClass = settings.theme || 'slate';
            const allThemeClasses = ['theme-slate', 'theme-sapphire', 'theme-emerald', 'theme-luxury', 'theme-highcontrast'];
            allThemeClasses.forEach(tc => document.body.classList.remove(tc));
            document.body.classList.add(`theme-${themeClass}`);

            // Apply High Contrast Mode
            if (settings.highContrast || themeClass === 'highcontrast') {
                document.body.classList.add('high-contrast');
            } else {
                document.body.classList.remove('high-contrast');
            }

            // Apply customizable text values
            const compName = settings.compName || (COMPANY_PROFILE && COMPANY_PROFILE.name) || 'ALMARA PUTRA VALASINDO';
            const formattedCompName = compName.toUpperCase().replace(/(ALMARA)/i, '$1 <span class="gold">') + (compName.toLowerCase().includes('almara') ? '</span>' : '');
            safeSetHtml('txtCompName', formattedCompName);
            safeSetText('txtCompSubtitle', settings.compSubtitle || DEFAULT_SETTINGS.compSubtitle);
            
            safeSetText('txtHeaderCenterTitle', settings.headerCenterTitle || DEFAULT_SETTINGS.headerCenterTitle);
            safeSetText('txtHeaderCenterPartner', settings.headerCenterPartner || DEFAULT_SETTINGS.headerCenterPartner);
            safeSetText('txtHeaderCenterBadge', settings.headerCenterBadge || DEFAULT_SETTINGS.headerCenterBadge);
            
            safeSetText('txtTableHeadCur', settings.tableHeadCur || DEFAULT_SETTINGS.tableHeadCur);
            safeSetText('txtTableHeadBuy', settings.tableHeadBuy || DEFAULT_SETTINGS.tableHeadBuy);
            safeSetText('txtTableHeadSell', settings.tableHeadSell || DEFAULT_SETTINGS.tableHeadSell);
            
            safeSetText('txtPromoSloganTitle', settings.promoSloganTitle || DEFAULT_SETTINGS.promoSloganTitle);
            safeSetText('txtPromoSloganDesc', settings.promoSloganDesc || DEFAULT_SETTINGS.promoSloganDesc);
            
            const goldCardText = settings.promoGoldLogoText || DEFAULT_SETTINGS.promoGoldLogoText;
            safeSetHtml('txtPromoGoldLogoText', goldCardText.replace(/\n/g, '<br>'));
            
            safeSetHtml('txtCompTitle1', `<i class="fa-solid fa-star"></i> ${settings.compTitle1 || DEFAULT_SETTINGS.compTitle1}`);
            safeSetHtml('txtCompTitle2', `<i class="fa-solid fa-circle-info"></i> ${settings.compTitle2 || DEFAULT_SETTINGS.compTitle2}`);
            safeSetHtml('txtCompTitle3', `<i class="fa-solid fa-share-nodes"></i> ${settings.compTitle3 || DEFAULT_SETTINGS.compTitle3}`);
            
            safeSetText('txtFeatTitle1', settings.featTitle1 || DEFAULT_SETTINGS.featTitle1);
            safeSetText('txtFeatDesc1', settings.featDesc1 || DEFAULT_SETTINGS.featDesc1);
            safeSetText('txtFeatTitle2', settings.featTitle2 || DEFAULT_SETTINGS.featTitle2);
            safeSetText('txtFeatDesc2', settings.featDesc2 || DEFAULT_SETTINGS.featDesc2);
            safeSetText('txtFeatTitle3', settings.featTitle3 || DEFAULT_SETTINGS.featTitle3);
            safeSetText('txtFeatDesc3', settings.featDesc3 || DEFAULT_SETTINGS.featDesc3);
            
            safeSetText('txtNote1', settings.note1 || DEFAULT_SETTINGS.note1);
            safeSetText('txtNote2', settings.note2 || DEFAULT_SETTINGS.note2);
            safeSetText('txtNote3', settings.note3 || DEFAULT_SETTINGS.note3);
            
            safeSetText('txtQrText1', settings.qrText1 || DEFAULT_SETTINGS.qrText1);
            safeSetText('txtQrText2', settings.qrText2 || DEFAULT_SETTINGS.qrText2);
            safeSetText('txtQrDesc', settings.qrDesc || DEFAULT_SETTINGS.qrDesc);
            
            const footerLeftSloganText = `${settings.footerLeftSlogan || DEFAULT_SETTINGS.footerLeftSlogan} <span class="thank" id="txtFooterLeftThank">${settings.footerLeftThank || DEFAULT_SETTINGS.footerLeftThank}</span>`;
            safeSetHtml('txtFooterLeftSlogan', footerLeftSloganText);

            // Render Custom Logo
            const logoWrapper = document.getElementById('logoWrapper');
            if (logoWrapper) {
                if (settings.logoBase64) {
                    logoWrapper.innerHTML = `<img src="${settings.logoBase64}" class="custom-logo" alt="Logo">`;
                } else {
                    const initialLetter = compName.trim().charAt(0).toUpperCase();
                    logoWrapper.innerHTML = `<i class="fa-solid fa-crown" id="logoCrownIcon"></i><span class="letter-a" id="logoTextLetter">${initialLetter}</span>`;
                }
            }
            updateRunningText();
        }

        // Running Text logic (Hari Besar Nasional vs Manual)
        function updateRunningText() {
            const txtEl = document.getElementById('txtRunningText');
            if (!txtEl) return;

            const mode = settings.runningTextMode || 'holiday';
            if (mode === 'manual') {
                txtEl.textContent = settings.runningTextManual || '';
            } else {
                txtEl.textContent = getHolidayGreeting();
            }
        }

        function getHolidayGreeting() {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1; // 1-indexed
            const date = now.getDate();
            
            // Format string MM-DD
            const mm = String(month).padStart(2, '0');
            const dd = String(date).padStart(2, '0');
            const key = `${mm}-${dd}`;
            
            // Kalender Hari Besar Masehi & Dinamis Tahun 2026 Indonesia
            const holidays = {
                '01-01': `Selamat Tahun Baru ${year}! Semoga tahun ini membawa kedamaian, keberkahan, dan kemakmuran bagi kita semua.`,
                '02-17': "Keluarga Besar Almara Money Changer Mengucapkan Selamat Tahun Baru Imlek 2577 Kongzili! Gong Xi Fa Cai.",
                '03-19': "Selamat Hari Raya Nyepi Saka 1948 bagi umat Hindu yang merayakan. Semoga kesunyian membawa kedamaian jiwa.",
                '03-20': "Keluarga Besar Almara Money Changer Mengucapkan Selamat Hari Raya Idul Fitri 1447 H! Minal Aidin Wal Faizin, Mohon Maaf Lahir dan Batin.",
                '03-21': "Keluarga Besar Almara Money Changer Mengucapkan Selamat Hari Raya Idul Fitri 1447 H! Minal Aidin Wal Faizin, Mohon Maaf Lahir dan Batin.",
                '04-03': "Selamat memperingati Wafat Yesus Kristus bagi yang merayakan. Semoga berkah Paskah membawa cinta kasih.",
                '05-01': "Selamat Hari Buruh Internasional! Dedikasi dan kerja keras para pekerja adalah pilar kemajuan bangsa.",
                '05-14': "Selamat memperingati Kenaikan Yesus Kristus bagi umat Kristiani yang merayakan.",
                '05-27': "Keluarga Besar Almara Money Changer Mengucapkan Selamat Hari Raya Idul Adha 1447 H! Semoga semangat berkurban membawa keberkahan.",
                '05-31': "Selamat Hari Raya Waisak 2570 Buddha Era. Semoga semua makhluk hidup selamanya dalam kebahagiaan dan terbebas dari kebencian.",
                '06-01': "Selamat Hari Lahir Pancasila! Mari kokohkan nilai-nilai Pancasila dalam bermasyarakat, berbangsa, dan bernegara.",
                '06-16': "Selamat Tahun Baru Islam 1448 Hijriah! Semoga tahun baru ini membawa kedamaian dan hijrah menuju pribadi yang lebih baik.",
                '08-17': "Dirgahayu Republik Indonesia! Sekali Merdeka Tetap Merdeka. Mari bersatu membangun negeri tercinta.",
                '08-25': "Selamat memperingati Maulid Nabi Muhammad SAW bagi umat Muslim. Semoga keteladanan akhlak Rasulullah senantiasa membimbing kita.",
                '10-28': "Selamat Hari Sumpah Pemuda! Bersatu kita teguh, bercerai kita runtuh. Semangat pemuda untuk masa depan Indonesia.",
                '11-10': "Selamat Hari Pahlawan! Bangsa yang besar adalah bangsa yang menghargai jasa-jasa para pahlawannya.",
                '12-25': "Keluarga Besar Almara Money Changer Mengucapkan Selamat Hari Natal! Semoga damai dan sukacita Natal menyertai kita semua."
            };
            
            if (holidays[key]) {
                return holidays[key];
            }
            
            // Fallback: Default Running Text Harian
            const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
            switch(day) {
                case 1: // Senin
                    return "Selamat Hari Senin! Selamat memulai aktivitas penukaran valuta asing Anda di Almara Money Changer dengan rate terbaik, aman, dan terpercaya.";
                case 5: // Jumat
                    return "Selamat Hari Jumat! Pastikan keaslian dan kondisi uang Anda sebelum meninggalkan kasir. Selamat bersiap menyambut akhir pekan.";
                case 6: // Sabtu
                case 0: // Minggu
                    return "Selamat Akhir Pekan! Terima kasih atas kepercayaan Anda bertransaksi di Almara Money Changer. Kami siap melayani penukaran valuta dengan profesional.";
                default:
                    return "Selamat datang di Almara Money Changer. Melayani dengan sepenuh hati untuk transaksi penukaran valuta asing Anda yang aman, cepat, dan terpercaya.";
            }
        }

        function toggleRunningTextInput(mode) {
            const group = document.getElementById('runningTextManualGroup');
            if (group) {
                group.style.display = mode === 'manual' ? 'block' : 'none';
            }
        }

        // Apply zoom scale
        function applyThemeZoom() {
            const zoom = settings.fontZoom || 100;
            document.documentElement.style.setProperty('--zoom-level', `${zoom}%`);
        }

        // Helper to format currency numbers to IDR style (without Rp prefix)
        function formatValFormat(number) {
            if (number === 0) return '-';
            // Jika angka memiliki pecahan desimal bukan nol
            if (number % 1 !== 0) {
                // Untuk angka bernilai sangat kecil (< 1, misal VND 0.7), berikan presisi hingga 4 desimal
                if (number < 1) {
                    return number.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                }
                // Untuk angka di bawah 1000 (misal JPY 111.1 atau KRW 11.88), berikan 2 desimal
                return number.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            // Bilangan bulat murni tanpa desimal
            return number.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        }

        // Parse country code for FlagCDN
        function getFlagCode(currencyCode) {
            const baseCode = currencyCode.trim().slice(0, 3).toUpperCase();
            const map = {
                'USD': 'us', 'EUR': 'eu', 'SGD': 'sg', 'AUD': 'au', 'JPY': 'jp',
                'GBP': 'gb', 'CNY': 'cn', 'HKD': 'hk', 'MYR': 'my', 'THB': 'th',
                'SAR': 'sa', 'CAD': 'ca', 'CHF': 'ch', 'NZD': 'nz', 'KRW': 'kr',
                'INR': 'in', 'PHP': 'ph', 'TWD': 'tw', 'AED': 'ae', 'BND': 'bn',
                'KWD': 'kw', 'IDR': 'id', 'VND': 'vn', 'RUB': 'ru'
            };
            return map[baseCode] || baseCode.slice(0, 2).toLowerCase();
        }

        // Parse Full Name of currencies
        function getCurrencyName(currencyCode) {
            const baseCode = currencyCode.trim().slice(0, 3).toUpperCase();
            const names = {
                'USD': 'US DOLLAR',
                'EUR': 'EURO',
                'SGD': 'SINGAPORE DOLLAR',
                'AUD': 'AUSTRALIAN DOLLAR',
                'JPY': 'JAPANESE YEN (100)',
                'GBP': 'BRITISH POUND',
                'CNY': 'CHINESE YUAN',
                'HKD': 'HONGKONG DOLLAR',
                'MYR': 'MALAYSIAN RINGGIT',
                'THB': 'THAI BAHT',
                'SAR': 'SAUDI RIYAL',
                'CAD': 'CANADIAN DOLLAR',
                'CHF': 'SWISS FRANC',
                'NZD': 'NEW ZEALAND DOLLAR',
                'KRW': 'SOUTH KOREAN WON',
                'INR': 'INDIAN RUPEE',
                'PHP': 'PHILIPPINE PESO',
                'TWD': 'NEW TAIWAN DOLLAR',
                'AED': 'UAE DIRHAM',
                'BND': 'BRUNEI DOLLAR',
                'KWD': 'KUWAITI DINAR',
                'VND': 'VIETNAMESE DONG'
            };
            return names[baseCode] || currencyCode;
        }

        // Format sub denomination display (e.g. USD100 -> USD (100))
        function formatDisplayCode(code) {
            const match = code.match(/^([A-Z]{3})(\d+)$/);
            if (match) {
                return `${match[1]} (${match[2]})`;
            }
            return code;
        }

        // Render video component based on link type
        function renderVideoPlayer() {
            const wrapper = document.getElementById('videoFrameWrapper');
            const url = settings.videoUrl || '';
            
            if (!url) {
                wrapper.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);">Video belum dikonfigurasi</div>`;
                return;
            }

            const youtubeId = extractYoutubeVideoId(url);
            if (youtubeId) {
                const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&playsinline=1&rel=0`;

                wrapper.innerHTML = `<iframe src="${embedUrl}" allow="autoplay; encrypted-media" allowfullscreen style="position:relative; z-index:1;"></iframe>`;
            } else {
                wrapper.innerHTML = `
                    <video autoplay loop muted playsinline style="position:relative; z-index:1;">
                        <source src="${url}" type="video/mp4">
                        Browser TV Anda tidak mendukung tag video HTML5.
                    </video>
                `;
            }
        }

        function extractYoutubeVideoId(rawUrl) {
            if (!rawUrl || typeof rawUrl !== 'string') return '';
            const value = rawUrl.trim();
            try {
                const parsed = new URL(value);
                const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
                if (host === 'youtu.be') {
                    return parsed.pathname.split('/').filter(Boolean)[0] || '';
                }
                if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
                    if (parsed.pathname.startsWith('/embed/')) {
                        return parsed.pathname.split('/').filter(Boolean)[1] || '';
                    }
                    if (parsed.pathname.startsWith('/shorts/')) {
                        return parsed.pathname.split('/').filter(Boolean)[1] || '';
                    }
                    return parsed.searchParams.get('v') || '';
                }
            } catch (e) {
                const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
                return match ? match[1] : '';
            }
            return '';
        }

        // Filter and get target currencies to display based on settings checklist
        function getFilteredCurrencies() {
            if (!settings.visibleCurrencies || settings.visibleCurrencies.length === 0) {
                return allCurrencies;
            }
            return allCurrencies.filter(c => settings.visibleCurrencies.includes(c.code));
        }

        // Split data into pages and render current page
        function renderCurrentPage() {
            const listBody = document.getElementById('ratesListBody');
            const visibleData = getFilteredCurrencies();
            
            const maxRows = parseInt(settings.maxRowsPerPage) || 10;
            const totalItems = visibleData.length;
            const totalPages = Math.ceil(totalItems / maxRows);
            
            if (totalPages === 0) {
                listBody.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-secondary);font-size:1.2rem;">Tidak ada valuta yang dipilih / aktif.</div>`;
                return;
            }

            if (currentPageIndex >= totalPages) {
                currentPageIndex = 0;
            }

            const startIdx = currentPageIndex * maxRows;
            const pageData = visibleData.slice(startIdx, startIdx + maxRows);

            let html = '';
            pageData.forEach(item => {
                const flagCode = getFlagCode(item.code);
                const fullName = getCurrencyName(item.code);
                const dispCode = formatDisplayCode(item.code);
                
                const buyFlash = item.buyChange === 'up' ? 'flash-up-active' : (item.buyChange === 'down' ? 'flash-down-active' : '');
                const sellFlash = item.sellChange === 'up' ? 'flash-up-active' : (item.sellChange === 'down' ? 'flash-down-active' : '');

                const trendIndicator = item.trend === 'up' 
                    ? `<span style="color: var(--buy-color); font-size: 1.7rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;">▲</span>` 
                    : (item.trend === 'down' 
                        ? `<span style="color: var(--sell-color); font-size: 1.7rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;">▼</span>` 
                        : `<span style="color: var(--text-secondary); font-size: 1.4rem; opacity: 0.4; line-height: 1; display: inline-flex; align-items: center; justify-content: center;">─</span>`);

                const trendIndicatorClean = item.trend === 'up'
                    ? `<span style="color: var(--buy-color); font-size: 1.35rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;">▲</span>`
                    : (item.trend === 'down'
                        ? `<span style="color: var(--sell-color); font-size: 1.35rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;">▼</span>`
                        : `<span style="color: var(--text-secondary); font-size: 1.1rem; opacity: 0.4; line-height: 1; display: inline-flex; align-items: center; justify-content: center;">-</span>`);

                html += `
                    <div class="rate-row-item">
                        <div class="col-cell col-cell-currency">
                            <div class="flag-frame">
                                <img src="https://flagcdn.com/w80/${flagCode}.png" class="flag-img-file" onerror="this.src='https://flagcdn.com/w80/un.png'">
                            </div>
                            <div class="currency-meta-info">
                                <span class="currency-meta-code">${dispCode}</span>
                                <span class="currency-meta-name">${fullName}</span>
                            </div>
                        </div>
                        <div class="col-cell col-cell-trend" style="display: flex; align-items: center; justify-content: center;">
                            ${trendIndicatorClean}
                        </div>
                        <div class="col-cell col-cell-rate col-cell-buy ${buyFlash}">${formatValFormat(item.buy)}</div>
                        <div class="col-cell col-cell-rate col-cell-sell ${sellFlash}">${formatValFormat(item.sell)}</div>
                    </div>
                `;
            });

            listBody.style.opacity = '0';
            setTimeout(() => {
                listBody.innerHTML = html;
                listBody.style.opacity = '1';
                listBody.style.transition = 'opacity 0.25s ease-in-out';
                
                pageData.forEach(item => {
                    delete item.buyChange;
                    delete item.sellChange;
                });
            }, 250);
        }

        // Start carousel slide rotation
        function startCarouselRotation() {
            if (rotationTimer) clearInterval(rotationTimer);
            const interval = (parseInt(settings.rotationInterval) || 12) * 1000;
            renderCurrentPage();

            rotationTimer = setInterval(() => {
                const visibleData = getFilteredCurrencies();
                const maxRows = parseInt(settings.maxRowsPerPage) || 10;
                const totalPages = Math.ceil(visibleData.length / maxRows);
                
                if (totalPages > 1) {
                    currentPageIndex = (currentPageIndex + 1) % totalPages;
                    renderCurrentPage();
                } else {
                    currentPageIndex = 0;
                }
            }, interval);
        }

        // Render checklist options in settings modal
        function renderChecklistOptions() {
            const container = document.getElementById('currenciesChecklistGrid');
            if (!container) return;

            let html = '';
            allCurrencies.forEach(c => {
                const isChecked = !settings.visibleCurrencies || settings.visibleCurrencies.length === 0 || settings.visibleCurrencies.includes(c.code);
                html += `
                    <label class="checklist-item">
                        <input type="checkbox" class="cur-checkbox" value="${c.code}" ${isChecked ? 'checked' : ''}>
                        <span>${c.code}</span>
                    </label>
                `;
            });

            if (allCurrencies.length === 0) {
                html = `<span style="grid-column: span 3; font-size:0.8rem; color:var(--text-secondary);">Tidak ada mata uang aktif di database.</span>`;
            }

            container.innerHTML = html;
        }

        // Modal Controllers
        function openSettingsModal() {
            if (!CAN_MANAGE_BOARD_SETTINGS) return;
            switchModalTab('general'); // Reset to general tab on open
            
            document.getElementById('setEnableVideo').checked = settings.showVideo;
            document.getElementById('setVideoUrl').value = settings.videoUrl;
            document.getElementById('setMaxRows').value = settings.maxRowsPerPage;
            document.getElementById('setSlideInterval').value = settings.rotationInterval;
            document.getElementById('setFontZoom').value = settings.fontZoom;
            
            document.getElementById('setInstagram').value = settings.instagram || '';
            document.getElementById('setFacebook').value = settings.facebook || '';
            document.getElementById('setWhatsapp').value = settings.whatsapp || '';
            document.getElementById('setQrLink').value = settings.qrLink || '';
            document.getElementById('setHighContrast').checked = settings.highContrast || false;
            document.getElementById('setTheme').value = settings.theme || 'slate';
            document.getElementById('setRunningTextMode').value = settings.runningTextMode || 'holiday';
            document.getElementById('setRunningTextManual').value = settings.runningTextManual || '';
            toggleRunningTextInput(settings.runningTextMode || 'holiday');

            // Load text overrides
            document.getElementById('setCompName').value = settings.compName || '';
            document.getElementById('setCompSubtitle').value = settings.compSubtitle || '';
            document.getElementById('setHeaderCenterTitle').value = settings.headerCenterTitle || '';
            document.getElementById('setHeaderCenterPartner').value = settings.headerCenterPartner || '';
            document.getElementById('setHeaderCenterBadge').value = settings.headerCenterBadge || '';
            
            document.getElementById('setTableHeadCur').value = settings.tableHeadCur || '';
            document.getElementById('setTableHeadBuy').value = settings.tableHeadBuy || '';
            document.getElementById('setTableHeadSell').value = settings.tableHeadSell || '';
            
            document.getElementById('setPromoSloganTitle').value = settings.promoSloganTitle || '';
            document.getElementById('setPromoSloganDesc').value = settings.promoSloganDesc || '';
            document.getElementById('setPromoGoldLogoText').value = settings.promoGoldLogoText || '';
            
            document.getElementById('setCompTitle1').value = settings.compTitle1 || '';
            document.getElementById('setCompTitle2').value = settings.compTitle2 || '';
            document.getElementById('setCompTitle3').value = settings.compTitle3 || '';
            document.getElementById('setCompTitle4').value = settings.compTitle4 || '';
            
            document.getElementById('setFeatTitle1').value = settings.featTitle1 || '';
            document.getElementById('setFeatDesc1').value = settings.featDesc1 || '';
            document.getElementById('setFeatTitle2').value = settings.featTitle2 || '';
            document.getElementById('setFeatDesc2').value = settings.featDesc2 || '';
            document.getElementById('setFeatTitle3').value = settings.featTitle3 || '';
            document.getElementById('setFeatDesc3').value = settings.featDesc3 || '';
            
            document.getElementById('setNote1').value = settings.note1 || '';
            document.getElementById('setNote2').value = settings.note2 || '';
            document.getElementById('setNote3').value = settings.note3 || '';
            
            document.getElementById('setQrText1').value = settings.qrText1 || '';
            document.getElementById('setQrText2').value = settings.qrText2 || '';
            document.getElementById('setQrDesc').value = settings.qrDesc || '';
            
            document.getElementById('setFooterLeftSlogan').value = settings.footerLeftSlogan || '';
            document.getElementById('setFooterLeftThank').value = settings.footerLeftThank || '';

            // Logo preview
            logoBase64Temp = settings.logoBase64 || '';
            const previewImg = document.getElementById('logoPreviewImg');
            if (logoBase64Temp) {
                previewImg.src = logoBase64Temp;
                previewImg.style.display = 'block';
                document.getElementById('logoPreviewTxt').textContent = 'Logo Kustom Aktif';
            } else {
                previewImg.style.display = 'none';
                previewImg.src = '';
                document.getElementById('logoPreviewTxt').textContent = 'Menggunakan Logo Crown';
            }

            toggleVideoUrlInput(settings.showVideo);
            renderChecklistOptions();

            document.getElementById('settingsOverlay').style.display = 'flex';
        }

        function closeSettingsModal() {
            document.getElementById('settingsOverlay').style.display = 'none';
        }

        function toggleVideoUrlInput(enabled) {
            const group = document.getElementById('videoUrlGroup');
            if (enabled) {
                group.style.opacity = '1';
                group.style.pointerEvents = 'auto';
            } else {
                group.style.opacity = '0.4';
                group.style.pointerEvents = 'none';
            }
        }

        // Save settings to localStorage
        function saveSettings() {
            if (!CAN_MANAGE_BOARD_SETTINGS) return;
            const showVideo = document.getElementById('setEnableVideo').checked;
            const videoUrl = document.getElementById('setVideoUrl').value.trim() || DEFAULT_BOARD_VIDEO_URL;
            const maxRowsPerPage = parseInt(document.getElementById('setMaxRows').value) || 10;
            const rotationInterval = parseInt(document.getElementById('setSlideInterval').value) || 12;
            const fontZoom = parseInt(document.getElementById('setFontZoom').value) || 100;
            
            const instagram = document.getElementById('setInstagram').value.trim();
            const facebook = document.getElementById('setFacebook').value.trim();
            const whatsapp = document.getElementById('setWhatsapp').value.trim();
            const qrLink = document.getElementById('setQrLink').value.trim();
            const highContrast = document.getElementById('setHighContrast').checked;
            const theme = document.getElementById('setTheme').value;
            const runningTextMode = document.getElementById('setRunningTextMode').value;
            const runningTextManual = document.getElementById('setRunningTextManual').value.trim();

            // Gather text overrides
            const compName = document.getElementById('setCompName').value.trim();
            const compSubtitle = document.getElementById('setCompSubtitle').value.trim();
            const headerCenterTitle = document.getElementById('setHeaderCenterTitle').value.trim();
            const headerCenterPartner = document.getElementById('setHeaderCenterPartner').value.trim();
            const headerCenterBadge = document.getElementById('setHeaderCenterBadge').value.trim();
            
            const tableHeadCur = document.getElementById('setTableHeadCur').value.trim();
            const tableHeadBuy = document.getElementById('setTableHeadBuy').value.trim();
            const tableHeadSell = document.getElementById('setTableHeadSell').value.trim();
            
            const promoSloganTitle = document.getElementById('setPromoSloganTitle').value.trim();
            const promoSloganDesc = document.getElementById('setPromoSloganDesc').value.trim();
            const promoGoldLogoText = document.getElementById('setPromoGoldLogoText').value.trim();
            
            const compTitle1 = document.getElementById('setCompTitle1').value.trim();
            const compTitle2 = document.getElementById('setCompTitle2').value.trim();
            const compTitle3 = document.getElementById('setCompTitle3').value.trim();
            const compTitle4 = document.getElementById('setCompTitle4').value.trim();
            
            const featTitle1 = document.getElementById('setFeatTitle1').value.trim();
            const featDesc1 = document.getElementById('setFeatDesc1').value.trim();
            const featTitle2 = document.getElementById('setFeatTitle2').value.trim();
            const featDesc2 = document.getElementById('setFeatDesc2').value.trim();
            const featTitle3 = document.getElementById('setFeatTitle3').value.trim();
            const featDesc3 = document.getElementById('setFeatDesc3').value.trim();
            
            const note1 = document.getElementById('setNote1').value.trim();
            const note2 = document.getElementById('setNote2').value.trim();
            const note3 = document.getElementById('setNote3').value.trim();
            
            const qrText1 = document.getElementById('setQrText1').value.trim();
            const qrText2 = document.getElementById('setQrText2').value.trim();
            const qrDesc = document.getElementById('setQrDesc').value.trim();
            
            const footerLeftSlogan = document.getElementById('setFooterLeftSlogan').value.trim();
            const footerLeftThank = document.getElementById('setFooterLeftThank').value.trim();

            // Gather visible currencies checklist
            const checkedCurrencies = [];
            document.querySelectorAll('.cur-checkbox').forEach(cb => {
                if (cb.checked) {
                    checkedCurrencies.push(cb.value);
                }
            });

            const visibleCurrencies = checkedCurrencies.length === allCurrencies.length ? [] : checkedCurrencies;

            settings = {
                showVideo,
                videoUrl,
                visibleCurrencies,
                maxRowsPerPage,
                rotationInterval,
                fontZoom,
                theme,
                runningTextMode,
                runningTextManual,
                instagram,
                facebook,
                whatsapp,
                qrLink,
                highContrast: (theme === 'highcontrast'),
                
                // Save texts & logo
                logoBase64: logoBase64Temp,
                compName,
                compSubtitle,
                headerCenterTitle,
                headerCenterPartner,
                headerCenterBadge,
                tableHeadCur,
                tableHeadBuy,
                tableHeadSell,
                promoSloganTitle,
                promoSloganDesc,
                promoGoldLogoText,
                compTitle1,
                compTitle2,
                compTitle3,
                compTitle4,
                featTitle1,
                featDesc1,
                featTitle2,
                featDesc2,
                featTitle3,
                featDesc3,
                note1,
                note2,
                note3,
                qrText1,
                qrText2,
                qrDesc,
                footerLeftSlogan,
                footerLeftThank
            };

            // Save
            window.__serverBoardSettingsOverride = settings;
            localStorage.setItem('mc_papan_settings', JSON.stringify(settings));
            persistBoardSettingsToServer(settings);
            
            // Apply changes
            loadLocalSettings();
            applyThemeZoom();
            
            // Restart Carousel
            currentPageIndex = 0;
            startCarouselRotation();

            closeSettingsModal();
        }
    </script>
</body>

</html>
