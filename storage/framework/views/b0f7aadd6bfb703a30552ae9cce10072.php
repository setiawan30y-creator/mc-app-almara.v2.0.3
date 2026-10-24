<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="author" content="&#64;2026-Alifiandra">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="<?php echo e($login['theme_color']); ?>">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="<?php echo e($login['name']); ?>">
    <link rel="apple-touch-icon" href="<?php echo e(asset('favicon.png')); ?>">
    <title>Masuk | <?php echo e($login['name']); ?></title>
    <?php if (! ($preview)): ?>
    <script>try{localStorage.removeItem('mc_currentUser');sessionStorage.clear();}catch(e){}</script>
    <?php endif; ?>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        *{box-sizing:border-box}
        html,body{margin:0;min-height:100%}
        body{
            font-family:Manrope,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
            color:#16231e;-webkit-font-smoothing:antialiased;
            min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
            background:radial-gradient(circle at 12% 18%,color-mix(in srgb,var(--p) 18%,transparent),transparent 34%),radial-gradient(circle at 88% 82%,color-mix(in srgb,var(--a) 14%,transparent),transparent 32%),#f5f7f6;
        }
        .stage{width:100%;max-width:1080px;min-height:650px;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);background:#fff;
            border:1px solid var(--p-line);border-radius:28px;overflow:hidden;
            box-shadow:0 30px 80px rgba(15,23,42,.12),0 8px 24px rgba(15,23,42,.06)}

        /* ---------- sisi merek: motif guilloche + pita kode mata uang ---------- */
        .art{position:relative;overflow:hidden;color:#fff;display:flex;flex-direction:column;justify-content:space-between;
            padding:48px 52px 0;
            background:linear-gradient(155deg,var(--p-deep) 0%,var(--p-dark) 48%,var(--p) 100%)}
        .art-photo{position:absolute;inset:0;background-size:cover;background-position:center}
        .art-shade{position:absolute;inset:0;background:linear-gradient(155deg,color-mix(in srgb,var(--p-deep) 92%,transparent),color-mix(in srgb,var(--p-dark) 78%,transparent) 55%,color-mix(in srgb,var(--p) 62%,transparent))}
        .rosette{position:absolute;right:-30%;bottom:-24%;width:125%;aspect-ratio:1;color:#fff;opacity:.7;pointer-events:none}
        .rosette svg{width:100%;height:100%;display:block;animation:turn 160s linear infinite}
        .sym{position:absolute;font-weight:800;line-height:1;color:#fff;opacity:.07;pointer-events:none;user-select:none}
        .sym.a{font-size:170px;left:-3%;top:34%}.sym.b{font-size:120px;right:26%;top:4%}.sym.c{font-size:96px;right:5%;top:40%}
        .sym.d{font-size:80px;left:38%;bottom:26%}
        .art>.brand,.art>.pitch,.art>.foot{position:relative;z-index:1}

        .brand{display:flex;align-items:center;gap:14px;min-width:0}
        .mark{flex:none;width:52px;height:52px;border-radius:14px;display:grid;place-items:center;overflow:hidden;
            background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);font-weight:800;font-size:19px;letter-spacing:.02em;color:var(--a)}
        .mark img{width:100%;height:100%;object-fit:contain;background:#fff;padding:5px}
        .brand-name{font-weight:700;font-size:1.05rem;line-height:1.25;overflow-wrap:anywhere}

        .pitch{max-width:520px;padding:34px 0}
        .pitch h1{margin:0;font-size:2.5rem;line-height:1.08;font-weight:800;letter-spacing:-.025em;text-wrap:balance}
        .pitch p{margin:16px 0 0;max-width:46ch;font-size:1rem;line-height:1.65;color:rgba(255,255,255,.84)}
        .points{margin:26px 0 0;padding:0;list-style:none;display:grid;gap:12px}
        .points li{display:flex;gap:12px;align-items:flex-start;font-size:.95rem;line-height:1.5;color:rgba(255,255,255,.92)}
        .points svg{flex:none;width:20px;height:20px;margin-top:1px;color:var(--a)}

        .tape{margin:0 -52px;border-top:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.16);overflow:hidden;white-space:nowrap}
        .tape-run{display:inline-flex;animation:tape 60s linear infinite;will-change:transform}
        .tape-run span{display:inline-flex;align-items:baseline;gap:8px;padding:13px 26px;font-size:.86rem;color:rgba(255,255,255,.78);border-right:1px solid rgba(255,255,255,.1)}
        .legal .dev{color:rgba(255,255,255,.72);letter-spacing:.02em}
        .tape-run b{font-weight:800;letter-spacing:.04em;color:#fff}.tape-run i{font-style:normal;color:var(--a);font-weight:700}
        .legal{display:flex;justify-content:center;text-align:center;gap:12px;flex-wrap:wrap;margin:0 -52px;padding:12px 52px 16px;font-size:.78rem;color:rgba(255,255,255,.6);background:rgba(0,0,0,.16)}
        @keyframes turn{to{transform:rotate(360deg)}}
        @keyframes tape{to{transform:translateX(-50%)}}

        /* ---------- sisi form ---------- */
        .side{display:flex;align-items:center;justify-content:center;padding:52px 56px;background:#fff}
        .form{width:100%;max-width:400px}
        .form h2{margin:0;font-size:2rem;line-height:1.15;letter-spacing:-.02em;font-weight:800;color:#0f1f1a}
        .lead{margin:10px 0 30px;color:#5b6b64;font-size:.95rem;line-height:1.6}
        .tenant{margin:0 0 18px;padding:10px 13px;border-radius:10px;background:var(--p-soft);border:1px solid var(--p-line);color:var(--p-dark);font-size:.82rem;font-weight:700}
        .alert{margin:0 0 18px;padding:12px 14px;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:.88rem;line-height:1.5}
        .field{margin-bottom:18px}
        .field label{display:block;margin-bottom:7px;font-size:.84rem;font-weight:700;color:#2b3a34}
        .input{width:100%;height:52px;padding:0 15px;border:1.5px solid #d5ded9;border-radius:12px;background:#f9fbfa;color:#0f1f1a;font:inherit;font-size:.95rem;outline:none;transition:border-color .15s,box-shadow .15s,background .15s}
        .input::placeholder{color:#8a9a93}
        .input:hover{border-color:#b9c7c0}
        .input:focus{background:#fff;border-color:var(--p);box-shadow:0 0 0 4px color-mix(in srgb,var(--p) 16%,transparent)}
        .input[aria-invalid="true"]{border-color:#e11d48}
        .pw{position:relative}.pw .input{padding-right:50px}
        .eye{position:absolute;top:0;right:0;width:50px;height:52px;border:0;background:none;color:#6b7c75;cursor:pointer;display:grid;place-items:center;border-radius:0 12px 12px 0}
        .eye:hover{color:var(--p)}
        .caps{margin-top:7px;font-size:.8rem;color:#b45309;display:none}.caps.show{display:block}
        .remember{display:flex;align-items:center;gap:9px;margin:4px 0 24px;font-size:.88rem;color:#5b6b64;cursor:pointer;width:fit-content}
        .remember input{width:17px;height:17px;accent-color:var(--p)}
        .go{width:100%;height:54px;border:0;border-radius:12px;background:var(--p);color:var(--on-p);font:inherit;font-size:1rem;font-weight:700;cursor:pointer;
            box-shadow:0 10px 22px -8px color-mix(in srgb,var(--p) 70%,transparent);transition:background .15s,transform .15s,box-shadow .15s}
        .go:hover{background:var(--p-hover);transform:translateY(-1px)}
        .go:active{transform:none}
        .go[disabled]{opacity:.75;cursor:progress;transform:none}
        .note{margin:26px 0 0;padding-top:18px;border-top:1px solid #e8eeeb;text-align:center;font-size:.8rem;line-height:1.6;color:#7a8a83}
        a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid color-mix(in srgb,var(--p) 55%,#fff);outline-offset:2px}

        @media(max-width:820px){
            body{padding:14px}
            .stage{grid-template-columns:1fr;min-height:auto;border-radius:22px}
            .art{padding:32px 30px 0}
            .tape,.legal{margin-left:-30px;margin-right:-30px}.legal{padding-left:30px;padding-right:30px}
            .pitch{padding:24px 0 28px;max-width:none}
            .pitch h1{font-size:2.1rem}
            .rosette{right:-45%;bottom:-40%;width:130%}
            .sym.a{font-size:120px}.sym.b,.sym.c,.sym.d{display:none}
            .side{padding:36px 28px 40px}
        }
        @media(max-width:480px){
            .points{display:none}
            .pitch h1{font-size:1.85rem}
            .pitch p{font-size:.95rem}
            .art{padding:28px 22px 0}
            .tape,.legal{margin-left:-22px;margin-right:-22px}.legal{padding-left:22px;padding-right:22px}
            .side{padding:30px 22px 34px}
            .form h2{font-size:1.7rem}
        }
        @media(prefers-reduced-motion:reduce){
            .rosette svg,.tape-run{animation:none}
            .go,.input{transition:none}
        }
    </style>
</head>
<body style="<?php echo e($login['css']); ?>">
<?php
    $codes = [['USD','$'],['EUR','€'],['GBP','£'],['JPY','¥'],['SGD','S$'],['AUD','A$'],['MYR','RM'],['CNY','¥'],['KRW','₩'],['THB','฿'],['CHF','Fr'],['HKD','HK$'],['SAR','SR'],['NZD','NZ$']];
?>
<main class="stage">
    <section class="art" aria-label="<?php echo e($login['name']); ?>">
        <?php if($login['bg_url']): ?>
            <div class="art-photo" style="background-image:url('<?php echo e($login['bg_url']); ?>')"></div>
            <div class="art-shade"></div>
        <?php endif; ?>
        <?php if($login['show_art']): ?>
            <div class="rosette" aria-hidden="true">
                <svg viewBox="-300 -300 600 600" fill="none" stroke="#fff" stroke-width="1">
                    <?php for($i = 0; $i < 48; $i++): ?>
                        <ellipse rx="285" ry="<?php echo e(70 + ($i % 4) * 22); ?>" transform="rotate(<?php echo e($i * 7.5); ?>)" stroke-opacity="<?php echo e($i % 2 ? '.07' : '.11'); ?>"/>
                    <?php endfor; ?>
                    <circle r="292" stroke-opacity=".18"/><circle r="236" stroke-opacity=".12"/><circle r="150" stroke-opacity=".12"/><circle r="62" stroke-opacity=".2"/>
                </svg>
            </div>
            <span class="sym a" aria-hidden="true">$</span>
            <span class="sym b" aria-hidden="true">€</span>
            <span class="sym c" aria-hidden="true">¥</span>
            <span class="sym d" aria-hidden="true">£</span>
        <?php endif; ?>

        <div class="brand">
            <div class="mark"><?php if($login['logo_url']): ?><img src="<?php echo e($login['logo_url']); ?>" alt="Logo <?php echo e($login['name']); ?>"><?php else: ?><?php echo e($login['initials']); ?><?php endif; ?></div>
            <div class="brand-name"><?php echo e($login['name']); ?></div>
        </div>

        <div class="pitch">
            <h1><?php echo e($login['headline']); ?></h1>
            <?php if($login['description'] !== ''): ?><p><?php echo e($login['description']); ?></p><?php endif; ?>
            <?php if(count($login['features'])): ?>
            <ul class="points">
                <?php $__currentLoopData = $login['features']; $__env->addLoop($__currentLoopData); foreach($__currentLoopData as $f): $__env->incrementLoopIndices(); $loop = $__env->getLastLoop(); ?>
                    <li><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8.2"/><path d="M6.3 10.3l2.6 2.6 4.8-5.2"/></svg><span><?php echo e($f); ?></span></li>
                <?php endforeach; $__env->popLoop(); $loop = $__env->getLastLoop(); ?>
            </ul>
            <?php endif; ?>
        </div>

        <div class="foot">
            <?php if($login['show_art']): ?>
            <div class="tape" aria-hidden="true">
                <div class="tape-run">
                    <?php for($r = 0; $r < 2; $r++): ?>
                        <?php $__currentLoopData = $codes; $__env->addLoop($__currentLoopData); foreach($__currentLoopData as $c): $__env->incrementLoopIndices(); $loop = $__env->getLastLoop(); ?><span><b><?php echo e($c[0]); ?></b><i><?php echo e($c[1]); ?></i></span><?php endforeach; $__env->popLoop(); $loop = $__env->getLastLoop(); ?>
                    <?php endfor; ?>
                </div>
            </div>
            <?php endif; ?>
            <div class="legal"><span class="dev">&#64;2026-Alifiandra</span></div>
        </div>
    </section>

    <section class="side">
        <form class="form" method="POST" action="<?php echo e(url('/login')); ?>" id="loginForm">
            <?php echo csrf_field(); ?>
            <h2><?php echo e($login['welcome_title']); ?></h2>
            <p class="lead"><?php echo e($login['welcome_desc']); ?></p>

            <?php if(request()->getHost() !== parse_url(config('app.url'), PHP_URL_HOST)): ?>
                <div class="tenant">Workspace: <?php echo e(request()->getHost()); ?></div>
            <?php endif; ?>

            <?php if($errors->any()): ?>
                <div class="alert" role="alert"><?php echo e($errors->first()); ?></div>
            <?php endif; ?>

            <div class="field">
                <label for="username">Username</label>
                <input id="username" name="username" type="text" class="input" value="<?php echo e(old('username')); ?>" placeholder="Masukkan username" autocomplete="username" autocapitalize="none" spellcheck="false" required <?php if (! ($preview)): ?> autofocus <?php endif; ?> <?php if($errors->has('username')): ?> aria-invalid="true" <?php endif; ?>>
            </div>

            <div class="field">
                <label for="password">Password</label>
                <div class="pw">
                    <input id="password" name="password" type="password" class="input" placeholder="Masukkan password" autocomplete="current-password" required <?php if($errors->has('password')): ?> aria-invalid="true" <?php endif; ?>>
                    <button type="button" id="togglePassword" class="eye" aria-label="Tampilkan password" aria-pressed="false" title="Tampilkan password">
                        <svg class="eye-open" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                        <svg class="eye-off" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                </div>
                <div class="caps" id="capsHint" role="status">Caps Lock sedang aktif.</div>
            </div>

            <label class="remember"><input type="checkbox" name="remember" value="1"><span>Ingat saya di perangkat ini</span></label>

            <button type="submit" class="go" id="loginBtn"><?php echo e($login['button_label']); ?></button>
            <?php if($login['security_note'] !== ''): ?><p class="note"><?php echo e($login['security_note']); ?></p><?php endif; ?>
        </form>
    </section>
</main>
<script>
(function(){
    var preview = <?php echo e($preview ? 'true' : 'false'); ?>;
    var form = document.getElementById('loginForm'), btn = document.getElementById('loginBtn');
    var input = document.getElementById('password'), eye = document.getElementById('togglePassword'), caps = document.getElementById('capsHint');
    if (eye && input) {
        var open = eye.querySelector('.eye-open'), off = eye.querySelector('.eye-off');
        eye.addEventListener('click', function(){
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            open.style.display = show ? 'none' : ''; off.style.display = show ? '' : 'none';
            eye.setAttribute('aria-pressed', show ? 'true' : 'false');
            eye.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
            eye.title = show ? 'Sembunyikan password' : 'Tampilkan password';
            input.focus();
        });
        ['keydown','keyup'].forEach(function(ev){
            input.addEventListener(ev, function(e){
                if (e.getModifierState) caps.classList.toggle('show', e.getModifierState('CapsLock'));
            });
        });
        input.addEventListener('blur', function(){ caps.classList.remove('show'); });
    }
    if (form && btn) {
        var label = btn.textContent;
        form.addEventListener('submit', function(e){
            if (preview) { e.preventDefault(); return; }
            btn.disabled = true; btn.textContent = 'Memproses...';
        });
        window.addEventListener('pageshow', function(){ btn.disabled = false; btn.textContent = label; });
    }
})();
</script>
<?php if (! ($preview)): ?>
<script src="<?php echo e(asset('js/pwa.js?v=1.0.0')); ?>"></script>
<?php endif; ?>
</body>
</html>
<?php /**PATH C:\laragon\www\mc-app-almara.v2.0.3\resources\views/auth/login.blade.php ENDPATH**/ ?>