<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="manifest" href="{{ asset('manifest.json?v=1.0.0') }}">
    <meta name="theme-color" content="#047857">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="MC Almara">
    <link rel="apple-touch-icon" href="{{ asset('favicon.png') }}">
    <title>Login — MC App Almara</title>
    <style>
        *{box-sizing:border-box}
        html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        body{
            min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
            background:radial-gradient(circle at 12% 18%,rgba(16,185,129,.16),transparent 32%),radial-gradient(circle at 88% 82%,rgba(234,179,8,.10),transparent 30%),#f5f7f6;
            color:#17211c
        }
        .shell{width:100%;max-width:1080px;min-height:650px;display:grid;grid-template-columns:1.05fr .95fr;background:rgba(255,255,255,.97);border:1px solid rgba(15,118,110,.12);border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(15,23,42,.12),0 8px 24px rgba(15,23,42,.06)}
        .brand{position:relative;overflow:hidden;padding:52px;color:#fff;background:linear-gradient(145deg,#064e3b,#047857 48%,#059669);display:flex;flex-direction:column;justify-content:space-between}
        .brand:before,.brand:after{content:"";position:absolute;border:1px solid rgba(255,255,255,.11);border-radius:50%}
        .brand:before{width:340px;height:340px;right:-120px;top:-120px}.brand:after{width:460px;height:460px;left:-240px;bottom:-260px}
        .content,.footer{position:relative;z-index:1}
        .logo{width:68px;height:68px;border-radius:20px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);font-size:28px;font-weight:800;color:#facc15}
        h1{margin:28px 0 12px;font-size:40px;line-height:1.05;font-weight:800;letter-spacing:-1.5px}
        .sub{max-width:440px;margin:0;color:rgba(255,255,255,.8);font-size:16px;line-height:1.7}
        .features{margin-top:42px;display:grid;gap:14px}.feature{display:flex;align-items:center;gap:12px;color:rgba(255,255,255,.9);font-size:14px}.ico{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);color:#fde68a;font-weight:700}
        .footer{color:rgba(255,255,255,.58);font-size:12px}
        .panel{padding:58px;display:flex;align-items:center}.form{width:100%;max-width:420px;margin:auto}
        .eyebrow{color:#047857;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}
        h2{margin:0;font-size:34px;line-height:1.15;letter-spacing:-1px;color:#111827}.desc{margin:12px 0 32px;color:#6b7280;font-size:14px;line-height:1.6}
        .field{margin-bottom:20px}.field label{display:block;margin-bottom:8px;color:#374151;font-size:13px;font-weight:700}
        .input{width:100%;height:50px;border:1px solid #d9e1dd;border-radius:12px;padding:0 15px;outline:none;background:#fbfdfc;color:#111827;font-size:14px;transition:border-color .2s,box-shadow .2s,background .2s}
        .input:focus{background:#fff;border-color:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.1)}
        .row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 24px}.remember{display:flex;align-items:center;gap:8px;color:#6b7280;font-size:13px}.remember input{width:16px;height:16px;accent-color:#059669}
        .button{width:100%;height:52px;border:0;border-radius:13px;background:linear-gradient(135deg,#047857,#059669);color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 12px 24px rgba(5,150,105,.2);transition:transform .15s,box-shadow .15s}
        .button:hover{transform:translateY(-1px);box-shadow:0 16px 30px rgba(5,150,105,.25)}
        .error{margin-bottom:20px;padding:12px 14px;border-radius:11px;background:#fff1f2;border:1px solid #fecdd3;color:#be123c;font-size:13px;line-height:1.5}.note{margin-top:24px;padding-top:20px;border-top:1px solid #edf1ee;text-align:center;color:#9ca3af;font-size:12px;line-height:1.6}.gold{color:#d4a72c}
        .tenant-badge{margin:0 0 20px;padding:11px 13px;border-radius:11px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:12px;font-weight:700}
        @media(max-width:820px){body{padding:14px}.shell{grid-template-columns:1fr;min-height:auto;border-radius:22px}.brand{padding:34px;min-height:330px}.panel{padding:38px 28px}h1{font-size:32px}}
        @media(max-width:480px){.brand{padding:28px}.panel{padding:32px 22px}h1{font-size:29px}h2{font-size:29px}}
    </style>
</head>
<body>
<div class="shell">
    <section class="brand">
        <div class="content">
            <div class="logo">MC</div>
            <h1>MC App<br><span class="gold">Almara</span></h1>
            <p class="sub">Money Changer Digital OS untuk mengelola operasional money changer secara terintegrasi, aman, dan profesional.</p>
            <div class="features">
                <div class="feature"><div class="ico">✓</div><span>Multi Tenant &amp; Multi Cabang</span></div>
                <div class="feature"><div class="ico">✓</div><span>Transaction &amp; Financial Control</span></div>
                <div class="feature"><div class="ico">✓</div><span>Cash, Bank, Stock &amp; Closing</span></div>
                <div class="feature"><div class="ico">✓</div><span>Audit Trail &amp; SaaS Security</span></div>
            </div>
        </div>
        <div class="footer">MC App Almara · Money Changer Digital OS</div>
    </section>
    <section class="panel">
        <form class="form" method="POST" action="{{ url('/login') }}">
            @csrf
            <div class="eyebrow">Secure Access</div>
            <h2>Selamat Datang</h2>
            <p class="desc">Masuk menggunakan akun Anda untuk mengakses workspace MC App Almara.</p>

            @if(request()->getHost() !== parse_url(config('app.url'), PHP_URL_HOST))
                <div class="tenant-badge">Workspace: {{ request()->getHost() }}</div>
            @endif

            @if ($errors->any())
                <div class="error">{{ $errors->first() }}</div>
            @endif

            <div class="field">
                <label for="username">Username</label>
                <input id="username" name="username" type="text" class="input" value="{{ old('username') }}" placeholder="Masukkan username" autocomplete="username" required autofocus>
                @error('username')<div class="error">{{ $message }}</div>@enderror
            </div>

            <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" class="input" placeholder="Masukkan password" autocomplete="current-password" required>
                @error('password')<div class="error">{{ $message }}</div>@enderror
            </div>

            <div class="row">
                <label class="remember"><input type="checkbox" name="remember" value="1"><span>Ingat saya</span></label>
            </div>

            <button type="submit" class="button">Masuk ke MC App</button>
            <div class="note">Akses sistem dilindungi oleh autentikasi, tenant isolation, branch scope, dan permission control.</div>
        </form>
    </section>
</div>
    <script src="{{ asset('js/pwa.js?v=1.0.0') }}"></script>
</body>
</html>