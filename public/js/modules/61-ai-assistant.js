// @2026-Alifiandra
/* =====================================================================
 * 61-ai-assistant.js  —  Komunikasi & Tools > Tanya AI / Deteksi Valas
 *
 * Asisten AI (Gemini / OpenAI) untuk tanya-jawab seputar valas dan deteksi
 * foto uang kertas/koin. Dirender ke #aiChatRoot, mobile-first (kamera,
 * riwayat sebagai laci, kolom ketik menempel di bawah layar).
 *
 * Catatan keamanan data: kunci API dibaca dari pengaturan (localStorage) dan
 * dikirim lewat header ke /api/ai/chat. Tidak ada jawaban "simulasi": bila AI
 * belum terhubung, pengguna diarahkan ke Pengaturan > Asisten AI.
 * Riwayat obrolan tersimpan di perangkat ini saja (mc_ai_chat_sessions).
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcAiAssistant) return;
    window.__mcAiAssistant = true;

    var KEY = 'mc_ai_chat_sessions', MAX_SESS = 30, MAX_MSG = 80;
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var uid = function () { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
    var coarse = function () { try { return window.matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };

    var IMAGE_PROMPT = 'Analisis foto uang kertas/koin ini. Jawab dengan poin singkat: (1) Negara, (2) Mata uang dan kode ISO 4217, (3) Nominal, (4) Seri/tahun bila terlihat, (5) Ciri keamanan yang tampak di foto, (6) Indikasi keaslian beserta keterbatasan foto, (7) Saran tindak lanjut bagi kasir. Bila gambar bukan uang atau tidak jelas, katakan apa adanya.';
    var SYSTEM = 'Anda asisten untuk kasir/teller KUPVA (money changer) di Indonesia. Jawab dalam Bahasa Indonesia, ringkas dan praktis. Anda TIDAK punya data pasar atau harga langsung: bila ditanya kurs/harga terkini, sampaikan keterbatasan itu dan sarankan memeriksa menu Kurs Hari Ini. Untuk foto uang, berikan indikasi, bukan kepastian keaslian. Jangan mengarang fakta, angka, atau peraturan; bila ragu, katakan tidak yakin.';
    var CHIPS = [
        ['fa-money-bill-wave', 'Ciri uang dolar AS asli', 'Apa saja ciri keamanan uang kertas dolar AS pecahan 100 yang asli dan cara cepat mengeceknya di loket?'],
        ['fa-calculator', 'Hitung kurs silang', 'Jelaskan langkah menghitung kurs silang EUR ke SGD bila hanya tersedia kurs EUR/IDR dan SGD/IDR, lengkap dengan contoh angka.'],
        ['fa-id-card', 'Dokumen nasabah', 'Dokumen dan data apa yang umumnya perlu dicatat dari nasabah saat transaksi jual beli valuta asing?'],
        ['fa-coins', 'Ciri rupiah asli', 'Apa saja ciri keaslian uang rupiah kertas emisi terbaru yang bisa dicek dengan metode dilihat, diraba, dan diterawang?']
    ];

    var S = { sessions: [], active: '', pending: null, busy: false, ctrl: null, drawer: false, built: false, last: null };

    /* ---------- Penyimpanan ---------- */
    function load() {
        try { var v = JSON.parse(localStorage.getItem(KEY)); S.sessions = Array.isArray(v) ? v.filter(function (x) { return x && x.id && Array.isArray(x.messages); }) : []; } catch (e) { S.sessions = []; }
        if (!S.sessions.length) S.sessions = [newSession()];
        if (!S.sessions.some(function (x) { return x.id === S.active; })) S.active = S.sessions[0].id;
    }
    function newSession(title) { return { id: uid(), title: title || 'Obrolan baru', messages: [], updated: Date.now() }; }
    function persist() {
        S.sessions = S.sessions.slice(0, MAX_SESS); S.sessions.forEach(function (s) { if (s.messages.length > MAX_MSG) s.messages = s.messages.slice(-MAX_MSG); });
        try { localStorage.setItem(KEY, JSON.stringify(S.sessions)); }
        catch (e) { // kuota penuh: buang gambar lama lalu coba lagi
            S.sessions.forEach(function (s) { s.messages.forEach(function (m) { delete m.image; }); });
            try { localStorage.setItem(KEY, JSON.stringify(S.sessions)); } catch (e2) { /* abaikan */ }
        }
    }
    var cur = function () { return S.sessions.filter(function (x) { return x.id === S.active; })[0]; };

    /* ---------- Pengaturan AI ---------- */
    function clean(v) { return String(v || '').trim().replace(/^["'`\u201C\u2018]+|["'`\u201D\u2019]+$/g, '').trim(); }
    function cfg() {
        var p = localStorage.getItem('mc_ai_provider') || 'gemini', g = clean(localStorage.getItem('mc_gemini_api_key')), o = clean(localStorage.getItem('mc_openai_api_key'));
        return { provider: p, gemini: g, openai: o, model: localStorage.getItem('mc_openai_model') || 'gpt-4o-mini', ready: p === 'openai' ? !!o : !!g };
    }
    function goSettings() {
        var nav = document.querySelector('.nav-item[data-target="settings-view"]'); if (nav) nav.click();
        setTimeout(function () { if (typeof window.switchSettingsTab === 'function') window.switchSettingsTab('ai'); }, 60);
    }

    /* ---------- Gaya ---------- */
    function style() {
        if ($('aic-style')) return; var st = document.createElement('style'); st.id = 'aic-style';
        st.textContent = [
            '.aic{color:var(--mc-text,inherit);--bd:var(--mc-border,rgba(148,163,184,.28));--mut:var(--mc-text-muted,#94a3b8);--pri:#ec4899;--card:var(--mc-card-bg,rgba(15,23,42,.45));container-type:inline-size;display:flex;flex-direction:column;gap:12px;height:calc(100dvh - 230px);min-height:460px}',
            'body.mobile-mode .aic{height:calc(100dvh - 150px - env(safe-area-inset-bottom))}.aic *{box-sizing:border-box}',
            '.aic-head{display:flex;gap:12px;align-items:center;border:1px solid var(--bd);border-left:4px solid var(--pri);border-radius:14px;padding:10px 14px;background:var(--card);flex:0 0 auto}',
            '.aic-head .ic{width:38px;height:38px;border-radius:11px;background:var(--pri);color:#fff;display:grid;place-items:center;flex:none}.aic-head h2{margin:0;font-size:1.02rem;min-width:0}.aic-head>div:nth-child(2){min-width:0}.aic-head p{margin:2px 0 0;color:var(--mut);font-size:.76rem}.aic-head .act{margin-left:auto;display:flex;gap:6px;flex-wrap:nowrap;flex:none;justify-content:flex-end}',
            '.aic-body{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px;flex:1 1 auto;min-height:0}',
            '.aic-side{border:1px solid var(--bd);border-radius:14px;background:var(--card);display:flex;flex-direction:column;min-height:0;overflow:hidden}.aic-side h3{margin:0;font-size:.8rem;padding:12px 14px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center}',
            '.aic-list{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px;flex:1}',
            '.aic-s{display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;border:1px solid transparent;cursor:pointer;font-size:.82rem}.aic-s:hover{background:rgba(148,163,184,.1)}.aic-s.on{background:rgba(236,72,153,.13);border-color:rgba(236,72,153,.45)}',
            '.aic-s .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.aic-s .d{font-size:.66rem;color:var(--mut)}.aic-ib{background:none;border:0;color:var(--mut);cursor:pointer;padding:6px;border-radius:7px;min-width:32px;min-height:32px}.aic-ib:hover{color:inherit;background:rgba(148,163,184,.18)}.aic-ib.d:hover{color:#dc2626}',
            '.aic-main{border:1px solid var(--bd);border-radius:14px;background:var(--card);display:flex;flex-direction:column;min-height:0;min-width:0;position:relative}',
            '.aic-msgs{flex:1 1 auto;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth;overscroll-behavior:contain}',
            '.aic-m{display:flex;flex-direction:column;max-width:100%}.aic-m.u{align-items:flex-end}.aic-m.a{align-items:flex-start}',
            '.aic-b{max-width:min(78%,720px);padding:10px 14px;border-radius:14px;font-size:.9rem;line-height:1.55;overflow-wrap:anywhere;border:1px solid var(--bd)}.aic-m.a .aic-b{background:rgba(100,116,139,.1);border-top-left-radius:4px}.aic-m.u .aic-b{background:rgba(236,72,153,.13);border-color:rgba(236,72,153,.35);border-top-right-radius:4px}.aic-m.e .aic-b{border-color:rgba(248,113,113,.5);background:rgba(239,68,68,.08)}',
            '.aic-b p{margin:0 0 8px}.aic-b p:last-child{margin:0}.aic-b ul,.aic-b ol{margin:4px 0 8px;padding-left:20px}.aic-b li{margin:2px 0}.aic-b h4{margin:8px 0 4px;font-size:.92rem}.aic-b code{background:rgba(148,163,184,.2);border-radius:5px;padding:1px 5px;font-size:.84em}',
            '.aic-b img{display:block;max-width:240px;width:100%;border-radius:10px;margin-bottom:8px}',
            '.aic-meta{display:flex;gap:8px;align-items:center;font-size:.66rem;color:var(--mut);margin:3px 4px 0}.aic-meta button{background:none;border:0;color:var(--mut);cursor:pointer;font:inherit;padding:4px 2px}.aic-meta button:hover{color:inherit}',
            '.aic-hero{margin:auto;text-align:center;max-width:520px;padding:10px}.aic-hero .big{width:60px;height:60px;border-radius:18px;background:rgba(236,72,153,.15);color:var(--pri);display:grid;place-items:center;font-size:1.6rem;margin:0 auto 12px}.aic-hero h3{margin:0 0 6px}.aic-hero p{margin:0 0 14px;color:var(--mut);font-size:.84rem;line-height:1.55}',
            '.aic-chips{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left}.aic-chip{border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-size:.8rem;border-radius:12px;padding:10px 12px;cursor:pointer;display:flex;gap:9px;align-items:center;min-height:46px}.aic-chip:hover{border-color:var(--pri)}.aic-chip i{color:var(--pri)}',
            '.aic-warn{margin:0 16px;font-size:.72rem;color:var(--mut);text-align:center}',
            '.aic-comp{border-top:1px solid var(--bd);padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;flex:0 0 auto}',
            '.aic-prev{display:flex;gap:10px;align-items:center;border:1px solid var(--bd);border-radius:10px;padding:6px 8px;font-size:.78rem}.aic-prev img{width:44px;height:44px;border-radius:8px;object-fit:cover}.aic-prev span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.aic-row{display:flex;gap:8px;align-items:flex-end}.aic-ta{flex:1;min-width:0;resize:none;border:1px solid var(--bd);background:var(--mc-input-bg,#fff);color:inherit;border-radius:14px;padding:11px 14px;font:inherit;font-size:.92rem;line-height:1.4;max-height:150px;min-height:44px}.aic-ta:focus{outline:2px solid rgba(236,72,153,.5);outline-offset:0}',
            '.aic-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.8rem;border-radius:12px;cursor:pointer;min-height:44px;min-width:44px;padding:0 13px;white-space:nowrap}.aic-btn:hover{border-color:var(--pri)}.aic-btn.pri{background:var(--pri);border-color:var(--pri);color:#fff}.aic-btn.sm{min-height:34px;min-width:34px;padding:0 10px;font-size:.76rem;border-radius:10px}.aic-btn.dng{color:#dc2626}.aic-btn:disabled{opacity:.5;cursor:not-allowed}',
            '.aic-setup{margin:16px;border:1px solid rgba(251,191,36,.45);background:rgba(245,158,11,.08);border-radius:12px;padding:12px 14px;font-size:.82rem;line-height:1.5;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.aic-setup div{flex:1;min-width:200px}',
            '.aic-chip2{display:inline-flex;gap:6px;align-items:center;font-size:.68rem;font-weight:800;border-radius:99px;padding:3px 10px;border:1px solid var(--bd)}.aic-chip2.ok{color:#059669;border-color:rgba(52,211,153,.5)}.aic-chip2.no{color:#b45309;border-color:rgba(251,191,36,.5)}',
            '.aic-dots span{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--pri);margin-right:4px;animation:aicd 1s infinite}.aic-dots span:nth-child(2){animation-delay:.15s}.aic-dots span:nth-child(3){animation-delay:.3s}@keyframes aicd{0%,80%,100%{opacity:.2}40%{opacity:1}}',
            '.aic-ov{position:fixed;inset:0;background:rgba(2,6,23,.62);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px;--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:#ec4899}.aic-modal{background:var(--mc-card-bg,#fff);color:var(--mc-text,inherit);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:420px;padding:18px 20px;box-shadow:0 24px 60px rgba(0,0,0,.4)}.aic-modal h3{margin:0 0 10px;font-size:1rem}.aic-modal input{width:100%;border:1px solid var(--bd);background:var(--mc-input-bg,#fff);color:inherit;border-radius:10px;padding:10px 12px;font:inherit}.aic-mf{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}',
            '.aic-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:10px 16px;border-radius:10px;font-size:.82rem;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:90vw}',
            '.aic-scrim{display:none}',
            '@container (max-width:820px){.aic-body{grid-template-columns:1fr}.aic-side{position:absolute;z-index:20;top:0;bottom:0;left:0;width:min(86%,320px);transform:translateX(-105%);transition:transform .2s;border-radius:0 14px 14px 0;box-shadow:none;visibility:hidden;background:var(--mc-card-bg,#fff)}.aic.drawer .aic-side{transform:none;visibility:visible;box-shadow:0 0 40px rgba(0,0,0,.35)}.aic.drawer .aic-scrim{display:block;position:absolute;inset:0;z-index:19;background:rgba(2,6,23,.5);border-radius:14px}.aic-body{position:relative}.aic-b{max-width:90%}.aic-hist-btn{display:inline-flex!important}}',
            '@container (max-width:520px){.aic-chips{grid-template-columns:1fr}.aic-head p,.aic-head .lbl{display:none}.aic-msgs{padding:12px 10px}.aic-b{max-width:94%;font-size:.92rem}.aic-btn .t{display:none}}',
            '.aic-hist-btn{display:none}'
        ].join('\n'); document.head.appendChild(st);
    }

    /* ---------- Markdown aman ---------- */
    function inline(t) { return esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>'); }
    function md(src) {
        var lines = String(src || '').replace(/\r/g, '').split('\n'), out = [], list = null;
        var close = function () { if (list) { out.push('</' + list + '>'); list = null; } };
        lines.forEach(function (ln) {
            var m;
            if ((m = /^\s*[-*•]\s+(.+)$/.exec(ln))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); }
            else if ((m = /^\s*(\d+)[.)]\s+(.+)$/.exec(ln))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[2]) + '</li>'); }
            else if ((m = /^#{1,4}\s+(.+)$/.exec(ln))) { close(); out.push('<h4>' + inline(m[1]) + '</h4>'); }
            else if (!ln.trim()) close(); else { close(); out.push('<p>' + inline(ln) + '</p>'); }
        });
        close(); return out.join('');
    }

    /* ---------- Render ---------- */
    function build() {
        var root = $('aiChatRoot'); if (!root) return null; if (S.built) return root;
        style(); S.built = true; root.className = 'aic';
        root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange); root.addEventListener('keydown', onKey); root.addEventListener('paste', onPaste);
        root.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); });
        root.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); attach(f); } });
        return root;
    }
    function render() {
        var root = build(); if (!root) return; var c = cfg(), keep = $('aicTa') ? $('aicTa').value : '';
        root.classList.toggle('drawer', S.drawer);
        root.innerHTML = '<div class="aic-head"><div class="ic"><i class="fa-solid fa-robot"></i></div><div style="min-width:0"><h2>Tanya AI / Deteksi Valas</h2><p>Tanya seputar valas atau kirim foto uang untuk dikenali.</p></div>' +
            '<div class="act"><span class="aic-chip2 lbl ' + (c.ready ? 'ok' : 'no') + '">' + (c.provider === 'openai' ? 'OpenAI' : 'Gemini') + ' &middot; ' + (c.ready ? 'terhubung' : 'belum diatur') + '</span>' +
            '<button class="aic-btn sm aic-hist-btn" data-act="drawer" aria-label="Riwayat obrolan"><i class="fa-solid fa-clock-rotate-left"></i></button><button class="aic-btn sm" data-act="new" aria-label="Obrolan baru"><i class="fa-solid fa-plus"></i><span class="t">Baru</span></button><button class="aic-btn sm" data-act="settings" aria-label="Pengaturan AI"><i class="fa-solid fa-gear"></i></button></div></div>' +
            '<div class="aic-body"><div class="aic-scrim" data-act="drawer"></div><div class="aic-side"><h3>Riwayat obrolan <button class="aic-ib" data-act="new" aria-label="Obrolan baru"><i class="fa-solid fa-plus"></i></button></h3><div class="aic-list">' +
            S.sessions.map(function (s) { var d = new Date(s.updated || Date.now()); return '<div class="aic-s' + (s.id === S.active ? ' on' : '') + '" data-act="pick" data-id="' + esc(s.id) + '"><i class="fa-regular fa-comment" style="color:var(--mut)"></i><div class="t" title="' + esc(s.title) + '">' + esc(s.title) + '<div class="d">' + d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' &middot; ' + s.messages.length + ' pesan</div></div>' +
                '<button class="aic-ib" data-act="rename" data-id="' + esc(s.id) + '" aria-label="Ubah judul"><i class="fa-solid fa-pen"></i></button><button class="aic-ib d" data-act="del-ask" data-id="' + esc(s.id) + '" aria-label="Hapus obrolan"><i class="fa-solid fa-trash"></i></button></div>'; }).join('') + '</div></div>' +
            '<section class="aic-main"><div class="aic-msgs" id="aicMsgs" aria-live="polite"></div><div class="aic-warn">AI bisa keliru dan tidak memiliki data pasar langsung. Verifikasi kurs, harga, dan keaslian uang sebelum dipakai.</div>' +
            '<div class="aic-comp"><div id="aicPrev"></div><div class="aic-row"><input type="file" id="aicCam" accept="image/*" capture="environment" hidden><input type="file" id="aicGal" accept="image/*" hidden>' +
            '<button class="aic-btn" data-act="cam" aria-label="Ambil foto"><i class="fa-solid fa-camera"></i></button><button class="aic-btn" data-act="gal" aria-label="Pilih gambar"><i class="fa-solid fa-image"></i></button>' +
            '<textarea class="aic-ta" id="aicTa" rows="1" placeholder="Tanyakan sesuatu atau kirim foto uang..." aria-label="Pesan"></textarea><button class="aic-btn pri" id="aicSend" data-act="send" aria-label="Kirim"><i class="fa-solid fa-paper-plane"></i></button></div></div></section></div>';
        var ta = $('aicTa'); ta.value = keep; grow(ta); paintMsgs(); paintPrev();
    }
    function paintMsgs() {
        var box = $('aicMsgs'); if (!box) return; var s = cur(), c = cfg(), h = '';
        if (!c.ready) h += '<div class="aic-setup"><i class="fa-solid fa-key" style="color:#b45309;font-size:1.2rem"></i><div><b>AI belum terhubung.</b><br>Masukkan kunci API Gemini atau OpenAI di Pengaturan agar asisten bisa menjawab dan mengenali foto uang.</div><button class="aic-btn sm pri" data-act="settings">Buka Pengaturan AI</button></div>';
        if (!s.messages.length) {
            h += '<div class="aic-hero"><div class="big"><i class="fa-solid fa-robot"></i></div><h3>Ada yang bisa dibantu?</h3><p>Ketik pertanyaan seputar valas, atau tekan ikon kamera untuk memotret uang kertas/koin yang ingin dikenali.</p><div class="aic-chips">' +
                '<button class="aic-chip" data-act="scan"><i class="fa-solid fa-camera"></i> Deteksi uang dari foto</button>' + CHIPS.map(function (x, i) { return '<button class="aic-chip" data-act="chip" data-i="' + i + '"><i class="fa-solid ' + x[0] + '"></i>' + esc(x[1]) + '</button>'; }).join('') + '</div></div>';
        } else {
            h += s.messages.map(function (m, i) {
                var u = m.sender === 'user', err = m.error, t = m.ts ? new Date(m.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
                return '<div class="aic-m ' + (u ? 'u' : (err ? 'e a' : 'a')) + '"><div class="aic-b">' + (m.image ? '<img src="' + esc(m.image) + '" alt="Foto yang dikirim">' : '') + md(m.text) + '</div><div class="aic-meta"><span>' + (u ? 'Anda' : 'Asisten AI') + (t ? ' &middot; ' + t : '') + '</span>' +
                    (!u && !err ? '<button data-act="copy" data-i="' + i + '"><i class="fa-regular fa-copy"></i> Salin</button>' : '') + (err ? '<button data-act="retry"><i class="fa-solid fa-rotate-right"></i> Coba lagi</button>' : '') + '</div></div>';
            }).join('');
        }
        if (S.busy) h += '<div class="aic-m a" id="aicTyping"><div class="aic-b"><span class="aic-dots"><span></span><span></span><span></span></span> AI sedang menjawab... <button class="aic-btn sm" data-act="stop" style="margin-left:8px">Batalkan</button></div></div>';
        box.innerHTML = h; box.scrollTop = box.scrollHeight;
        var send = $('aicSend'); if (send) send.disabled = S.busy;
    }
    function paintPrev() { var el = $('aicPrev'); if (!el) return; el.innerHTML = S.pending ? '<div class="aic-prev"><img src="' + esc(S.pending.thumb) + '" alt=""><span>' + esc(S.pending.name) + ' &middot; siap dikirim</span><button class="aic-ib" data-act="unattach" aria-label="Hapus gambar"><i class="fa-solid fa-xmark"></i></button></div>' : ''; }
    function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(150, ta.scrollHeight) + 'px'; }
    function toast(m) { document.querySelectorAll('.aic-toast').forEach(function (o) { o.remove(); }); var t = document.createElement('div'); t.className = 'aic-toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2400); }
    function dialog(html) { closeDialog(); var ov = document.createElement('div'); ov.className = 'aic-ov'; ov.id = 'aicOv'; ov.innerHTML = '<div class="aic-modal" role="dialog" aria-modal="true">' + html + '</div>'; ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeDialog(); }); ov.addEventListener('click', onClick); ov.addEventListener('submit', function (e) { e.preventDefault(); var f = e.target; if (f.id === 'aicRen') { var s = S.sessions.filter(function (x) { return x.id === f.dataset.id; })[0]; var v = $('aicRenIn').value.trim(); if (s && v) { s.title = v.slice(0, 60); persist(); closeDialog(); render(); } } }); document.body.appendChild(ov); var i = ov.querySelector('input'); if (i) { i.focus(); i.select(); } }
    function closeDialog() { var o = $('aicOv'); if (o) o.remove(); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDialog(); });

    /* ---------- Gambar ---------- */
    function shrink(file, max, q) {
        return new Promise(function (res, rej) {
            var r = new FileReader(); r.onerror = function () { rej(new Error('Gagal membaca gambar.')); };
            r.onload = function () { var img = new Image(); img.onerror = function () { rej(new Error('Berkas bukan gambar yang valid.')); }; img.onload = function () {
                var w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
                var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', q)); }; img.src = r.result; };
            r.readAsDataURL(file);
        });
    }
    async function attach(file) {
        if (!file) return; if (!/^image\//.test(file.type)) { toast('Pilih berkas gambar (JPG/PNG).'); return; } if (file.size > 25 * 1024 * 1024) { toast('Gambar terlalu besar (maks. 25 MB).'); return; }
        try { var full = await shrink(file, 1280, 0.82), thumb = await shrink(file, 240, 0.6); S.pending = { data: full, thumb: thumb, name: file.name || 'foto.jpg' }; paintPrev(); var ta = $('aicTa'); if (ta) ta.focus(); } catch (e) { toast(e.message); }
    }

    /* ---------- Kirim ---------- */
    function buildPrompt(session, text, hasImage) {
        var hist = session.messages.filter(function (m) { return !m.error; }).slice(-8).map(function (m) { return (m.sender === 'user' ? 'Pengguna: ' : 'Asisten: ') + String(m.text).slice(0, 700); }).join('\n');
        var ask = text || (hasImage ? IMAGE_PROMPT : '');
        if (hasImage && text) ask = text + '\n\n(Gambar uang terlampir. ' + IMAGE_PROMPT.replace(/^Analisis foto uang kertas\/koin ini\. /, '') + ')';
        return SYSTEM + (hist ? '\n\nRiwayat singkat:\n' + hist : '') + '\n\nPertanyaan sekarang:\n' + ask;
    }
    async function send(textOverride) {
        if (S.busy) return; var ta = $('aicTa'), text = (textOverride != null ? textOverride : (ta ? ta.value : '')).trim(), img = S.pending;
        if (!text && !img) return; var s = cur(); if (!s) return; var c = cfg();
        if (!c.ready) { paintMsgs(); toast('Hubungkan AI di Pengaturan terlebih dahulu.'); return; }
        s.messages.push({ sender: 'user', text: text || 'Tolong kenali uang pada foto ini.', image: img ? img.thumb : undefined, ts: Date.now() });
        if (s.title === 'Obrolan baru' || /^Asisten AI Baru$|^Analisis Valas Baru$/.test(s.title)) s.title = (text || 'Deteksi uang dari foto').slice(0, 40);
        s.updated = Date.now(); S.last = { text: text, img: img }; S.pending = null; if (ta) { ta.value = ''; grow(ta); }
        persist(); S.busy = true; paintPrev(); paintMsgs(); await request(s, text, img);
    }
    async function request(s, text, img) {
        var c = cfg(), ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 70000); S.ctrl = ctrl;
        try {
            var csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
            var res = await fetch('api/ai/chat', { method: 'POST', signal: ctrl.signal, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf, 'X-AI-Provider': c.provider, 'X-Gemini-Key': c.gemini, 'X-OpenAI-Key': c.openai, 'X-OpenAI-Model': c.model },
                body: JSON.stringify({ message: buildPrompt({ messages: s.messages.slice(0, -1) }, text, !!img), image: img ? img.data : null }) });
            var d = await res.json().catch(function () { return {}; });
            if (!res.ok || !d.reply) throw new Error(d.message || ('Server menjawab dengan kode ' + res.status + '.'));
            s.messages.push({ sender: 'ai', text: d.reply, ts: Date.now() });
        } catch (e) {
            var msg = e.name === 'AbortError' ? (S.cancelled ? 'Permintaan dibatalkan.' : 'AI terlalu lama menjawab. Coba lagi sebentar lagi.') : (/Failed to fetch|NetworkError/i.test(e.message) ? 'Koneksi terputus. Periksa internet Anda lalu coba lagi.' : (/API key|key not valid|unauthorized/i.test(e.message) ? 'Kunci AI yang tersimpan ditolak. Buka Pengaturan > Pengaturan AI, tempel kunci yang benar, lalu tekan Simpan.' : e.message));
            if (!S.cancelled) s.messages.push({ sender: 'ai', text: '**Tidak dapat menjawab.** ' + msg, error: true, ts: Date.now() });
        } finally { clearTimeout(timer); S.cancelled = false; S.busy = false; S.ctrl = null; s.updated = Date.now(); persist(); if (s.id === S.active) paintMsgs(); render(); }
    }

    /* ---------- Event ---------- */
    function onClick(e) {
        var t = e.target.closest('[data-act]'); if (!t) return; var a = t.dataset.act, id = t.dataset.id;
        switch (a) {
            case 'drawer': S.drawer = !S.drawer; $('aiChatRoot').classList.toggle('drawer', S.drawer); break;
            case 'new': var s = newSession(); S.sessions.unshift(s); S.active = s.id; S.drawer = false; persist(); render(); break;
            case 'pick': S.active = id; S.drawer = false; render(); break;
            case 'rename': e.stopPropagation(); var r = S.sessions.filter(function (x) { return x.id === id; })[0]; if (r) dialog('<h3>Ubah judul obrolan</h3><form id="aicRen" data-id="' + esc(id) + '"><input id="aicRenIn" value="' + esc(r.title) + '" maxlength="60" aria-label="Judul"><div class="aic-mf"><button type="button" class="aic-btn sm" data-act="close">Batal</button><button type="submit" class="aic-btn sm pri">Simpan</button></div></form>'); break;
            case 'del-ask': e.stopPropagation(); dialog('<h3>Hapus obrolan?</h3><p style="margin:0;font-size:.86rem;color:var(--mut)">Riwayat obrolan ini akan dihapus dari perangkat ini.</p><div class="aic-mf"><button class="aic-btn sm" data-act="close">Batal</button><button class="aic-btn sm dng" data-act="del" data-id="' + esc(id) + '">Hapus</button></div>'); break;
            case 'del': S.sessions = S.sessions.filter(function (x) { return x.id !== id; }); if (!S.sessions.length) S.sessions = [newSession()]; S.active = S.sessions[0].id; persist(); closeDialog(); render(); break;
            case 'close': closeDialog(); break;
            case 'settings': goSettings(); break;
            case 'cam': $('aicCam').click(); break; case 'gal': $('aicGal').click(); break; case 'scan': $('aicCam').click(); break;
            case 'unattach': S.pending = null; paintPrev(); break;
            case 'chip': send(CHIPS[+t.dataset.i][2]); break;
            case 'send': send(); break;
            case 'stop': S.cancelled = true; if (S.ctrl) S.ctrl.abort(); break;
            case 'retry': var ss = cur(); if (ss && !S.busy) { while (ss.messages.length && ss.messages[ss.messages.length - 1].error) ss.messages.pop(); var lu = ss.messages[ss.messages.length - 1]; if (lu && lu.sender === 'user') { S.busy = true; paintMsgs(); request(ss, S.last ? S.last.text : lu.text, S.last ? S.last.img : null); } } break;
            case 'copy': var m = cur().messages[+t.dataset.i]; if (m) { var done = function () { toast('Jawaban disalin.'); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(m.text).then(done, function () { toast('Gagal menyalin.'); }); else toast('Penyalinan tidak didukung browser ini.'); } break;
        }
    }
    function onInput(e) { if (e.target.id === 'aicTa') grow(e.target); }
    function onChange(e) { if (e.target.id === 'aicCam' || e.target.id === 'aicGal') { attach(e.target.files[0]); e.target.value = ''; } }
    function onKey(e) { if (e.target.id === 'aicTa' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && !coarse()) { e.preventDefault(); send(); } }
    function onPaste(e) { var items = (e.clipboardData || {}).items || []; for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { e.preventDefault(); attach(items[i].getAsFile()); return; } }

    function init() { if (!$('aiChatRoot')) { setTimeout(init, 300); return; } load(); render(); }
    window.addEventListener('storage', function (e) { if (e.key && /^mc_(ai_provider|gemini_api_key|openai_api_key)$/.test(e.key) && S.built) render(); });
    document.addEventListener('click', function (e) { var n = e.target.closest && e.target.closest('.nav-item'); if (n && n.getAttribute('data-target') === 'ai-chat-view' && S.built) setTimeout(function () { if (!S.busy) render(); }, 0); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
