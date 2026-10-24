// @2026-Alifiandra
/* =====================================================================
 * 58-ai-settings.js  —  Pengaturan > Asisten AI
 *
 * Konfigurasi penyedia AI (Google Gemini / ChatGPT-OpenAI) yang dipakai
 * Chat Regulatory AI, pembacaan PDF regulasi, OCR identitas, dan Tanya AI.
 *  - Pilih penyedia lewat kartu, status key terlihat jelas.
 *  - Key bisa ditampilkan/disembunyikan, ditempel, dihapus, dan DITES.
 *  - Id elemen lama (settingsAiProvider, settingsGeminiKey, settingsOpenAiKey,
 *    settingsOpenAiModel) dan fungsi lama (saveAISettings, loadGeminiSettings)
 *    tetap tersedia agar modul lain tidak rusak.
 * Key disimpan di peramban perangkat ini (localStorage), tidak di server.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcAiSettings) return;
    window.__mcAiSettings = true;

    var K = { provider: 'mc_ai_provider', gemini: 'mc_gemini_api_key', openai: 'mc_openai_api_key', model: 'mc_openai_model' };
    var MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];
    var USES = [['fa-wand-magic-sparkles', 'Chat Regulatory AI', 'Menjawab pertanyaan regulasi dengan kutipan sumber'], ['fa-file-pdf', 'Baca PDF regulasi', 'Membaca isi PDF/gambar di Sumber Regulasi (khusus Gemini)'],
        ['fa-id-card', 'Baca KTP / identitas', 'Mengisi data nasabah dari foto identitas'], ['fa-comments', 'Tanya AI & deteksi valas', 'Tanya jawab dan pengenalan uang/koin dari gambar']];

    var S = { provider: 'gemini', dirty: false, test: {} };

    function $(id) { return document.getElementById(id); }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    // Buang spasi, karakter tak terlihat, dan tanda kutip yang ikut tersalin bersama key.
    function cleanKey(v) { return String(v || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/^["'\u201C\u2018`]+|["'\u201D\u2019`]+$/g, '').trim(); }
    [K.gemini, K.openai].forEach(function (k) { var o = get(k), c = cleanKey(o); if (o && o !== c) set(k, c); });
    function csrf() { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; }
    function mask(k) { return k ? '\u2022\u2022\u2022\u2022' + k.slice(-4) : ''; }
    function validKey(p, k) { return p === 'gemini' ? /^(AIza[\w-]{20,}|AQ\.[\w.-]{20,})$/.test(k) : /^sk-[\w-]{20,}$/.test(k); }

    function injectStyle() {
        if ($('aic-style')) return;
        var st = document.createElement('style'); st.id = 'aic-style';
        st.textContent = [
            '.aic{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#10b981);display:grid;gap:16px}.aic *{box-sizing:border-box}',
            '.aic-head h2{margin:0;font-size:1.15rem}.aic-head p{margin:4px 0 0;color:var(--mut);font-size:.84rem;line-height:1.5;max-width:720px}',
            '.aic-prov{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}',
            '.aic-card{border:2px solid var(--bd);border-radius:16px;padding:16px 18px;display:grid;gap:12px;align-content:start;transition:.15s}.aic-card.on{border-color:var(--pri);background:rgba(16,185,129,.06)}',
            '.aic-top{display:flex;gap:11px;align-items:center}.aic-ic{width:40px;height:40px;border-radius:11px;background:rgba(148,163,184,.16);display:grid;place-items:center;font-size:1.05rem;flex:none}.aic-card.on .aic-ic{background:var(--pri);color:var(--mc-primary-contrast,#fff)}',
            '.aic-top b{font-size:.98rem;display:block}.aic-top span.s{font-size:.76rem;color:var(--mut)}',
            '.aic-use{margin-left:auto;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.76rem;border-radius:99px;padding:5px 12px;cursor:pointer;white-space:nowrap}.aic-card.on .aic-use{background:var(--pri);border-color:var(--pri);color:var(--mc-primary-contrast,#fff);cursor:default}',
            '.aic label.l{display:block;font-size:.76rem;font-weight:700;margin:0 0 5px}.aic .form-control{width:100%}',
            '.aic-key{display:flex;gap:6px}.aic-key .form-control{flex:1;min-width:0;font-family:ui-monospace,Menlo,Consolas,monospace}',
            '.aic-ib{border:1px solid var(--bd);background:none;color:inherit;border-radius:9px;width:38px;cursor:pointer;flex:none}.aic-ib:hover{border-color:var(--pri)}',
            '.aic-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
            '.aic-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.8rem;padding:7px 12px;border-radius:10px;cursor:pointer;white-space:nowrap}.aic-btn:hover{border-color:var(--pri)}.aic-btn.pri{background:var(--pri);border-color:var(--pri);color:var(--mc-primary-contrast,#fff)}.aic-btn.dng{color:#f87171}.aic-btn:disabled{opacity:.55;cursor:not-allowed}',
            '.aic-b{display:inline-block;border-radius:99px;font-size:.68rem;font-weight:800;padding:2px 9px}.aic-b.g{background:rgba(16,185,129,.16);color:#34d399}.aic-b.n{background:rgba(148,163,184,.16);color:var(--mut)}.aic-b.a{background:rgba(245,158,11,.16);color:#fbbf24}',
            '.aic-msg{font-size:.8rem;line-height:1.5;border-radius:10px;padding:8px 11px;border:1px solid var(--bd)}.aic-msg.ok{border-color:rgba(52,211,153,.5);background:rgba(16,185,129,.08);color:#34d399}.aic-msg.bad{border-color:rgba(248,113,113,.5);background:rgba(239,68,68,.08);color:#f87171}.aic-msg.wait{color:var(--mut)}',
            '.aic small.h{display:block;color:var(--mut);font-size:.73rem;line-height:1.45;margin-top:4px}',
            '.aic-box{border:1px solid var(--bd);border-radius:14px;padding:14px 16px}.aic-box h3{margin:0 0 10px;font-size:.92rem}',
            '.aic-uses{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.aic-u{display:flex;gap:10px;align-items:flex-start;font-size:.8rem;line-height:1.4}.aic-u i{color:var(--pri);margin-top:2px;width:16px;text-align:center}.aic-u b{display:block}.aic-u span{color:var(--mut);font-size:.75rem}',
            '.aic details{border:1px solid var(--bd);border-radius:12px;padding:10px 14px}.aic summary{cursor:pointer;font-weight:700;font-size:.85rem}.aic ol{margin:10px 0 0 18px;padding:0;font-size:.82rem;line-height:1.7}.aic ol a{color:var(--pri)}',
            '.aic-foot{display:flex;gap:12px;align-items:center;flex-wrap:wrap;position:sticky;bottom:0;background:var(--mc-card-bg,transparent);padding:10px 0}.aic-foot .grow{flex:1;min-width:220px;font-size:.78rem;color:var(--mut)}.aic-foot .grow.dirty{color:#fbbf24;font-weight:700}',
            '.aic-toast{position:fixed;right:18px;bottom:18px;z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:11px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 10px 30px rgba(0,0,0,.35)}.aic-toast.err{border-left-color:#ef4444}'
        ].join('\n');
        document.head.appendChild(st);
    }
    function toast(msg, err) {
        var t = document.createElement('div'); t.className = 'aic-toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
        document.body.appendChild(t); setTimeout(function () { t.remove(); }, err ? 5000 : 2800);
    }

    function keyBox(p, saved) {
        var id = p === 'gemini' ? 'settingsGeminiKey' : 'settingsOpenAiKey';
        var ph = p === 'gemini' ? 'Tempel key Gemini (diawali AIza atau AQ.)' : 'Tempel key OpenAI (diawali sk-...)';
        return '<div><label class="l" for="' + id + '">API Key</label><div class="aic-key"><input type="password" class="form-control" id="' + id + '" autocomplete="off" spellcheck="false" placeholder="' + ph + '" value="' + esc(saved) + '">' +
            '<button type="button" class="aic-ib" data-act="eye" data-p="' + p + '" title="Tampilkan / sembunyikan" aria-label="Tampilkan atau sembunyikan key"><i class="fa-solid fa-eye"></i></button>' +
            '<button type="button" class="aic-ib" data-act="paste" data-p="' + p + '" title="Tempel dari papan klip" aria-label="Tempel key"><i class="fa-solid fa-paste"></i></button></div>' +
            '<div id="aicHint-' + p + '"></div></div>';
    }

    function card(p) {
        var gem = p === 'gemini', saved = get(gem ? K.gemini : K.openai), on = S.provider === p;
        var model = get(K.model) || MODELS[0], isCustom = MODELS.indexOf(model) < 0;
        return '<div class="aic-card ' + (on ? 'on' : '') + '" data-card="' + p + '"><div class="aic-top"><div class="aic-ic"><i class="fa-solid ' + (gem ? 'fa-gem' : 'fa-bolt') + '"></i></div><div><b>' + (gem ? 'Google Gemini' : 'ChatGPT / OpenAI') + '</b>' +
            '<span class="s">' + (gem ? 'Disarankan: ada kuota gratis, bisa membaca PDF & gambar' : 'Alternatif untuk tanya jawab teks') + '</span></div>' +
            '<button type="button" class="aic-use" data-act="use" data-p="' + p + '">' + (on ? '<i class="fa-solid fa-circle-check"></i> Aktif' : 'Jadikan aktif') + '</button></div>' +
            '<div class="aic-row"><span class="aic-b ' + (saved ? 'g' : 'n') + '" id="aicSt-' + p + '">' + (saved ? 'Key tersimpan ' + mask(saved) : 'Belum diisi') + '</span></div>' +
            keyBox(p, saved) +
            (gem ? '' : '<div><label class="l" for="aicModelSel">Model</label><div class="aic-row"><select class="form-control" id="aicModelSel" style="flex:1;min-width:150px">' + MODELS.map(function (m) { return '<option value="' + m + '"' + (m === model ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
                '<option value="__custom"' + (isCustom ? ' selected' : '') + '>Lainnya...</option></select><input type="text" class="form-control" id="settingsOpenAiModel" value="' + esc(model) + '" ' + (isCustom ? '' : 'style="display:none;flex:1" ') + 'placeholder="nama model" style="flex:1"></div></div>') +
            '<div class="aic-row"><button type="button" class="aic-btn" data-act="test" data-p="' + p + '"><i class="fa-solid fa-plug-circle-check"></i> Tes koneksi</button>' +
            '<button type="button" class="aic-btn dng" data-act="clear" data-p="' + p + '"><i class="fa-solid fa-trash"></i> Hapus key</button></div>' +
            '<div id="aicTest-' + p + '"></div></div>';
    }

    function render() {
        var root = $('aiCfgRoot'); if (!root) return;
        if (!root.getAttribute('data-ready')) {
            injectStyle(); root.className = 'aic'; root.setAttribute('data-ready', '1');
            root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
        }
        S.provider = get(K.provider) === 'openai' ? 'openai' : 'gemini'; S.dirty = false;
        root.innerHTML = '<div class="aic-head"><h2>Konfigurasi Asisten AI</h2><p>Atur sekali di sini, dipakai oleh seluruh fitur AI di aplikasi. Pilih penyedia, tempel API key, tekan <b>Tes koneksi</b>, lalu <b>Simpan</b>.</p></div>' +
            '<input type="hidden" id="settingsAiProvider" value="' + S.provider + '">' +
            '<div class="aic-prov">' + card('gemini') + card('openai') + '</div>' +
            '<div class="aic-box"><h3>Fitur yang memakai pengaturan ini</h3><div class="aic-uses">' + USES.map(function (u) { return '<div class="aic-u"><i class="fa-solid ' + u[0] + '"></i><div><b>' + u[1] + '</b><span>' + u[2] + '</span></div></div>'; }).join('') + '</div></div>' +
            '<details><summary>Cara mendapatkan API key Gemini (gratis)</summary><ol><li>Buka <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> dan login dengan akun Google.</li><li>Klik <b>Create API key</b>, lalu salin key yang muncul.</li><li>Tempel di kolom API Key Gemini di atas dan tekan <b>Tes koneksi</b>.</li><li>Tekan <b>Simpan Pengaturan AI</b>.</li></ol></details>' +
            '<div class="aic-foot"><button type="button" class="aic-btn pri" data-act="save"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan AI</button><div class="grow" id="aicNote">Key disimpan di peramban perangkat ini saja, tidak dikirim ke server kami. Isi ulang bila memakai perangkat atau peramban lain, dan jangan menyimpan key di komputer bersama.</div></div>';
        ['gemini', 'openai'].forEach(function (p) { hint(p); });
    }

    function val(id) { var e = $(id); return e ? e.value.trim() : ''; }
    function curKey(p) { return cleanKey(val(p === 'gemini' ? 'settingsGeminiKey' : 'settingsOpenAiKey')); }
    function curModel() { var s = $('aicModelSel'); if (s && s.value !== '__custom') return s.value; return val('settingsOpenAiModel') || MODELS[0]; }

    function hint(p) {
        var el = $('aicHint-' + p); if (!el) return; var k = curKey(p);
        if (!k) { el.innerHTML = '<small class="h">' + (p === 'gemini' ? 'Dapatkan gratis di Google AI Studio.' : 'Dapatkan di platform.openai.com (berbayar).') + '</small>'; return; }
        el.innerHTML = validKey(p, k) ? '<small class="h" style="color:#34d399"><i class="fa-solid fa-check"></i> Format key terlihat benar.</small>'
            : '<small class="h" style="color:#fbbf24"><i class="fa-solid fa-triangle-exclamation"></i> Format tidak biasa (' + (p === 'gemini' ? 'biasanya diawali AIza atau AQ.' : 'biasanya diawali sk-') + '). Pastikan tidak ada spasi atau karakter tambahan.</small>';
    }

    function markDirty() {
        S.dirty = true; var n = $('aicNote'); if (n) { n.classList.add('dirty'); n.textContent = 'Ada perubahan yang belum disimpan. Tekan Simpan Pengaturan AI.'; }
    }

    function save() {
        var gem = curKey('gemini'), oa = curKey('openai');
        var ok = set(K.provider, S.provider) && set(K.gemini, gem) && set(K.openai, oa) && set(K.model, curModel());
        if (!ok) { toast('Gagal menyimpan: penyimpanan peramban diblokir.', true); return; }
        var active = S.provider === 'gemini' ? gem : oa;
        toast(active ? 'Pengaturan AI tersimpan.' : 'Tersimpan, tetapi penyedia aktif belum punya key.', !active);
        render();
    }

    function test(p, btn) {
        var key = curKey(p), out = $('aicTest-' + p);
        if (!key) { out.innerHTML = '<div class="aic-msg bad">Isi API key terlebih dahulu.</div>'; return; }
        btn.disabled = true; out.innerHTML = '<div class="aic-msg wait"><i class="fa-solid fa-spinner fa-spin"></i> Menghubungi ' + (p === 'gemini' ? 'Gemini' : 'OpenAI') + '...</div>';
        var t0 = Date.now();
        fetch('/api/ai/chat', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf(), 'X-AI-Provider': p, 'X-Gemini-Key': p === 'gemini' ? key : '', 'X-OpenAI-Key': p === 'openai' ? key : '', 'X-OpenAI-Model': curModel() },
            body: JSON.stringify({ message: 'Balas hanya dengan satu kata: OK' })
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d, s: r.status }; }); })
            .then(function (x) {
                if (x.ok && x.d.status === 'success') out.innerHTML = '<div class="aic-msg ok"><i class="fa-solid fa-circle-check"></i> Terhubung (' + ((Date.now() - t0) / 1000).toFixed(1) + ' dtk). Key berfungsi. Jangan lupa tekan Simpan.</div>';
                else {
                    var m = x.d.message || ('Gagal (HTTP ' + x.s + ')');
                    if (x.s === 401 || x.s === 419) m = 'Sesi login berakhir. Muat ulang halaman lalu login kembali.';
                    out.innerHTML = '<div class="aic-msg bad"><i class="fa-solid fa-circle-xmark"></i> ' + esc(m) + '</div>';
                }
            }).catch(function () { out.innerHTML = '<div class="aic-msg bad">Tidak dapat menghubungi server aplikasi.</div>'; })
            .then(function () { btn.disabled = false; });
    }

    function onClick(e) {
        var b = e.target.closest('[data-act]'); if (!b) return; var a = b.dataset.act, p = b.dataset.p;
        if (a === 'use') { if (S.provider === p) return; S.provider = p; $('settingsAiProvider').value = p; document.querySelectorAll('.aic-card').forEach(function (c) { var on = c.dataset.card === p; c.classList.toggle('on', on); var u = c.querySelector('.aic-use'); u.innerHTML = on ? '<i class="fa-solid fa-circle-check"></i> Aktif' : 'Jadikan aktif'; }); markDirty(); }
        else if (a === 'eye') { var inp = $(p === 'gemini' ? 'settingsGeminiKey' : 'settingsOpenAiKey'); inp.type = inp.type === 'password' ? 'text' : 'password'; b.firstElementChild.className = 'fa-solid ' + (inp.type === 'password' ? 'fa-eye' : 'fa-eye-slash'); }
        else if (a === 'paste') {
            if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Peramban tidak mengizinkan tempel otomatis. Gunakan Ctrl+V.', true); return; }
            navigator.clipboard.readText().then(function (t) { var inp = $(p === 'gemini' ? 'settingsGeminiKey' : 'settingsOpenAiKey'); inp.value = String(t || '').trim(); hint(p); markDirty(); }, function () { toast('Akses papan klip ditolak. Gunakan Ctrl+V.', true); });
        }
        else if (a === 'test') test(p, b);
        else if (a === 'clear') { var i2 = $(p === 'gemini' ? 'settingsGeminiKey' : 'settingsOpenAiKey'); i2.value = ''; hint(p); $('aicTest-' + p).innerHTML = ''; markDirty(); }
        else if (a === 'save') save();
    }
    function onInput(e) {
        if (e.target.id === 'settingsGeminiKey') { hint('gemini'); markDirty(); }
        else if (e.target.id === 'settingsOpenAiKey') { hint('openai'); markDirty(); }
        else if (e.target.id === 'settingsOpenAiModel') markDirty();
    }
    function onChange(e) {
        if (e.target.id === 'aicModelSel') { var c = e.target.value === '__custom', t = $('settingsOpenAiModel'); t.style.display = c ? '' : 'none'; if (!c) t.value = e.target.value; markDirty(); }
    }

    window.saveAISettings = save;
    window.saveGeminiSettings = save;
    window.loadGeminiSettings = render;

    function init() { render(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
