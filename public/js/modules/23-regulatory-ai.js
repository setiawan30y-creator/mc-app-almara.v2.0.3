// @2026-Alifiandra
/* =====================================================================
 * 23-regulatory-ai.js  —  Pelaporan BI & Regulasi > Sumber Regulasi
 *
 * Tempat memasukkan sumber regulasi (BI, PPATK, OJK, dll.) yang menjadi
 * dasar jawaban di halaman "Chat Regulatory AI".
 *  - Sumber: unggah file (PDF, Word, Excel, teks, gambar) atau tempel teks.
 *  - Server membaca teks, memecahnya per pasal, lalu mengindeksnya.
 *  - Setiap sumber punya penerbit, jenis, nomor, tanggal berlaku, dan status
 *    (berlaku / diubah / dicabut) supaya AI tahu mana yang terbaru.
 *  - Dari sini pengguna bisa langsung "Tanya AI" untuk satu sumber.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcRegulatorySources) return;
    window.__mcRegulatorySources = true;

    var API = '/api/regulatory-documents';
    var EDITORS = { owner: 1, superadmin: 1, admin: 1, supervisor: 1 };
    var ISSUERS = [['BI', 'Bank Indonesia'], ['PPATK', 'PPATK'], ['OJK', 'OJK'], ['KEMENKEU', 'Kemenkeu'], ['LAINNYA', 'Lainnya']];
    var TYPES = [['UU', 'Undang-Undang'], ['PP', 'Peraturan Pemerintah'], ['PERPRES', 'Perpres'], ['PBI', 'PBI'], ['PADG', 'PADG BI'], ['SEBI', 'SE BI'],
        ['POJK', 'POJK'], ['PERKA_PPATK', 'Peraturan Kepala PPATK'], ['SE', 'Surat Edaran'], ['PMK', 'PMK'], ['KUMPULAN', 'Kumpulan beberapa peraturan'], ['LAINNYA', 'Lainnya']];
    var VALIDITY = { berlaku: ['Berlaku', 'g'], diubah: ['Telah diubah', 'a'], dicabut: ['Dicabut', 'r'] };
    var STATUS = {
        ready: ['Siap ditanyakan', 'g'], needs_text: ['Perlu teks', 'a'], pending: ['Diproses', 'b'], error: ['Gagal', 'r']
    };

    var S = {
        docs: [], stats: null, page: 1, last: 1, total: 0, q: '', issuer: '', state: '', validity: '', loading: false, err: '',
        mode: 'file', file: null, busy: false, ready: false, timer: null
    };

    function $(id) { return document.getElementById(id); }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function role() { try { return String((JSON.parse(localStorage.getItem('mc_currentUser')) || {}).role || '').toLowerCase(); } catch (e) { return ''; } }
    function canEdit() { return !!EDITORS[role()]; }
    function csrf() { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; }
    function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function aiHeaders() {
        return {
            'X-AI-Provider': ls('mc_ai_provider') || 'gemini', 'X-Gemini-Key': ls('mc_gemini_api_key'),
            'X-OpenAI-Key': ls('mc_openai_api_key'), 'X-OpenAI-Model': ls('mc_openai_model') || 'gpt-4o-mini'
        };
    }
    function fmtSize(b) { b = Number(b || 0); return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB'; }
    function fmtDate(v) {
        if (!v) return '-';
        var d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v);
        return isNaN(d) ? esc(v) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function lab(list, key) { for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1]; return key || ''; }

    function company() {
        var n = 'Almara';
        try {
            var p = typeof window.getProfile === 'function' ? window.getProfile() : JSON.parse(ls('mc_profile') || '{}');
            var first = String((p && p.name) || '').trim().split(/\s+/)[0];
            if (first && !/^money$/i.test(first)) n = first;
        } catch (e) { }
        return n;
    }

    function api(path, opt) {
        opt = opt || {};
        var headers = Object.assign({ Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf() }, opt.headers || {});
        return fetch(path, Object.assign({}, opt, { credentials: 'same-origin', headers: headers })).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok) {
                    var m = data.message || ('Permintaan gagal (HTTP ' + res.status + ')');
                    if (res.status === 401 || res.status === 419) m = 'Sesi login berakhir. Muat ulang halaman lalu login kembali.';
                    else if (res.status === 403) m = 'Akses ditolak untuk akun ini.';
                    else if (res.status === 422 && data.errors) m = Object.keys(data.errors).map(function (k) { return data.errors[k][0]; }).join(' ');
                    var e = new Error(m); e.status = res.status; e.data = data; throw e;
                }
                return data;
            });
        });
    }

    /* ---------- Gaya ---------- */
    function injectStyle() {
        if ($('ra-style')) return;
        var st = document.createElement('style'); st.id = 'ra-style';
        st.textContent = [
            '.ra{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#10b981);display:grid;gap:16px}',
            '.ra *{box-sizing:border-box}',
            '.ra-hero{display:flex;gap:14px;align-items:center;flex-wrap:wrap;border:1px solid var(--bd);border-radius:16px;padding:18px 20px;background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(16,185,129,.02))}',
            '.ra-hero .ic{width:46px;height:46px;border-radius:13px;background:var(--pri);color:var(--mc-primary-contrast,#fff);display:grid;place-items:center;font-size:1.2rem;flex:none}',
            '.ra-hero h2{margin:0;font-size:1.2rem}.ra-hero p{margin:3px 0 0;color:var(--mut);font-size:.84rem;line-height:1.5;max-width:680px}',
            '.ra-hero .act{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}',
            '.ra-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}',
            '.ra-kpi{border:1px solid var(--bd);border-radius:14px;padding:12px 15px}.ra-kpi .t{font-size:.72rem;color:var(--mut);font-weight:600}.ra-kpi .v{font-size:1.45rem;font-weight:800;margin-top:2px}.ra-kpi.ok .v{color:var(--pri)}.ra-kpi.warn .v{color:#f59e0b}',
            '.ra-grid{display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);gap:16px;align-items:start}',
            '@media(max-width:1000px){.ra-grid{grid-template-columns:1fr}}',
            '.ra-card{border:1px solid var(--bd);border-radius:16px;padding:16px 18px;min-width:0}.ra-card>h3{margin:0 0 4px;font-size:.98rem}.ra-card>.sub{margin:0 0 12px;color:var(--mut);font-size:.8rem;line-height:1.45}',
            '.ra-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;border:1px solid var(--bd);border-radius:11px;padding:3px;margin-bottom:12px}',
            '.ra-seg button{border:0;background:none;color:var(--mut);font:inherit;font-weight:700;font-size:.82rem;padding:8px;border-radius:8px;cursor:pointer}.ra-seg button.on{background:var(--pri);color:var(--mc-primary-contrast,#fff)}',
            '.ra-drop{border:2px dashed var(--bd);border-radius:14px;padding:22px 14px;text-align:center;cursor:pointer;transition:.15s;margin-bottom:12px}',
            '.ra-drop:hover,.ra-drop.over{border-color:var(--pri);background:rgba(16,185,129,.07)}.ra-drop i{font-size:1.6rem;color:var(--pri)}.ra-drop b{display:block;margin-top:6px;font-size:.88rem}.ra-drop span{display:block;color:var(--mut);font-size:.76rem;margin-top:3px;overflow-wrap:anywhere}',
            '.ra-f{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ra-f .full{grid-column:1/-1}',
            '@media(max-width:520px){.ra-f{grid-template-columns:1fr}}',
            '.ra label.l{display:block;font-size:.74rem;font-weight:700;margin:0 0 4px}.ra .form-control,.ra-ov .form-control{width:100%;box-sizing:border-box}',
            '.ra small.h{display:block;color:var(--mut);font-size:.72rem;line-height:1.4;margin-top:3px}',
            '.ra-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.82rem;padding:8px 13px;border-radius:10px;cursor:pointer;white-space:nowrap}',
            '.ra-btn:hover{border-color:var(--pri)}.ra-btn.pri{background:var(--pri);border-color:var(--pri);color:var(--mc-primary-contrast,#fff)}.ra-btn.dng{color:#f87171}.ra-btn.sm{padding:5px 10px;font-size:.76rem}.ra-btn:disabled{opacity:.55;cursor:not-allowed}',
            '.ra-tool{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.ra-tool .grow{flex:1;min-width:200px}',
            '.ra-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}',
            '.ra-chip{border:1px solid var(--bd);background:none;color:inherit;border-radius:99px;font:inherit;font-size:.76rem;font-weight:700;padding:4px 11px;cursor:pointer}.ra-chip.on{background:var(--pri);border-color:var(--pri);color:var(--mc-primary-contrast,#fff)}.ra-chip i{font-style:normal;opacity:.75;margin-left:5px}',
            '.ra-doc{border:1px solid var(--bd);border-radius:13px;padding:12px 14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;align-items:center;margin-bottom:10px}',
            '.ra-doc:hover{border-color:var(--pri)}.ra-doc h4{margin:0;font-size:.92rem;line-height:1.35;overflow-wrap:anywhere}.ra-doc .m{color:var(--mut);font-size:.77rem;margin-top:3px;line-height:1.5}',
            '.ra-doc .b{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.ra-doc .a{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
            '@media(max-width:700px){.ra-doc{grid-template-columns:1fr}.ra-doc .a{justify-content:flex-start}}',
            '.ra-b{display:inline-block;border-radius:99px;font-size:.68rem;font-weight:800;padding:2px 9px;border:1px solid transparent}',
            '.ra-b.g{background:rgba(16,185,129,.16);color:#34d399}.ra-b.a{background:rgba(245,158,11,.16);color:#fbbf24}.ra-b.r{background:rgba(239,68,68,.16);color:#f87171}.ra-b.b{background:rgba(59,130,246,.16);color:#60a5fa}.ra-b.n{background:rgba(148,163,184,.16);color:var(--mut)}',
            '.ra-empty{text-align:center;color:var(--mut);padding:30px 12px;font-size:.88rem;line-height:1.6}.ra-empty i{font-size:1.8rem;display:block;margin-bottom:8px;opacity:.6}',
            '.ra-err{border:1px solid rgba(239,68,68,.5);background:rgba(239,68,68,.08);color:#f87171;border-radius:10px;padding:9px 12px;font-size:.82rem}',
            '.ra-ov{position:fixed;inset:0;background:rgba(2,6,23,.62);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow-y:auto}',
            '.ra-modal{background:var(--mc-card-bg,#1e293b);color:var(--mc-text,inherit);border:1px solid var(--bd);border-radius:16px;width:100%;max-width:820px;padding:20px 22px;box-shadow:0 24px 60px rgba(0,0,0,.4);--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#10b981)}',
            '.ra-modal.sm{max-width:480px}.ra-mh{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.ra-mh h3{margin:0;font-size:1.05rem;overflow-wrap:anywhere}.ra-mh .x{margin-left:auto}',
            '.ra-sec{border-top:1px solid var(--bd);padding-top:14px;margin-top:14px}.ra-sec h5{margin:0 0 8px;font-size:.85rem}',
            '.ra-sum{white-space:pre-wrap;font-size:.86rem;line-height:1.65;border:1px solid var(--bd);border-radius:11px;padding:12px 14px;overflow-wrap:anywhere}',
            '.ra-pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.78rem;line-height:1.55;max-height:260px;overflow:auto;border:1px solid var(--bd);border-radius:11px;padding:11px 13px;font-family:ui-monospace,Menlo,Consolas,monospace}',
            '.ra-dl{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;font-size:.84rem;margin:0}.ra-dl dt{color:var(--mut);font-weight:600}.ra-dl dd{margin:0;overflow-wrap:anywhere}',
            '@media(max-width:560px){.ra-dl{grid-template-columns:1fr}}',
            '.ra-mf{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px}',
            '.ra-toast{position:fixed;right:18px;bottom:18px;z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:11px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:min(420px,90vw)}.ra-toast.err{border-left-color:#ef4444}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function toast(msg, isErr) {
        var t = document.createElement('div'); t.className = 'ra-toast' + (isErr ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
        document.body.appendChild(t); setTimeout(function () { t.remove(); }, isErr ? 7000 : 3600);
    }

    /* ---------- Tebakan metadata dari nama file / isi teks ---------- */
    function guess(text) {
        var s = String(text || ''), out = {};
        var up = s.toUpperCase();
        if (/\bPPATK\b|PENCEGAHAN DAN PEMBERANTASAN TINDAK PIDANA PENCUCIAN/.test(up)) out.issuer = 'PPATK';
        else if (/\bPBI\b|\bPADG\b|\bSEBI\b|BANK INDONESIA/.test(up)) out.issuer = 'BI';
        else if (/\bPOJK\b|OTORITAS JASA KEUANGAN/.test(up)) out.issuer = 'OJK';
        else if (/\bPMK\b|MENTERI KEUANGAN/.test(up)) out.issuer = 'KEMENKEU';
        var map = [['PERKA_PPATK', /PERATURAN\s+KEPALA\s+PPATK|PERKA\s*PPATK/], ['PADG', /\bPADG\b|PERATURAN ANGGOTA DEWAN GUBERNUR/], ['PBI', /\bPBI\b|PERATURAN BANK INDONESIA/],
            ['SEBI', /\bSEBI\b|SURAT EDARAN BANK INDONESIA/], ['POJK', /\bPOJK\b|PERATURAN OTORITAS JASA KEUANGAN/], ['PMK', /\bPMK\b|PERATURAN MENTERI KEUANGAN/],
            ['PERPRES', /PERATURAN PRESIDEN|\bPERPRES\b/], ['PP', /PERATURAN PEMERINTAH|\bPP\s*(NO|NOMOR|\d)/], ['UU', /UNDANG-UNDANG|\bUU\s*(NO|NOMOR|\d)/], ['SE', /SURAT EDARAN/]];
        for (var i = 0; i < map.length; i++) if (map[i][1].test(up)) { out.doc_type = map[i][0]; break; }
        if (!out.issuer && out.doc_type) out.issuer = { PADG: 'BI', PBI: 'BI', SEBI: 'BI', POJK: 'OJK', PERKA_PPATK: 'PPATK', PMK: 'KEMENKEU' }[out.doc_type] || '';
        if (!out.issuer) delete out.issuer;
        var m = s.match(/(?:No\.?|Nomor)\s*([0-9]{1,3}(?:\/[A-Za-z0-9.\-]+)*)\s*(?:Tahun|Thn|\/)\s*(\d{4})/i);
        if (m) out.regulation_number = 'Nomor ' + m[1] + ' Tahun ' + m[2];
        return out;
    }

    /* ---------- Data ---------- */
    function load(page, append) {
        S.loading = true; S.err = '';
        var p = new URLSearchParams({ page: String(page || 1) });
        if (S.q) p.set('q', S.q); if (S.issuer) p.set('issuer', S.issuer); if (S.validity) p.set('validity', S.validity);
        if (S.state === 'ready') p.set('status', 'ready'); else if (S.state === 'needs_text') p.set('status', 'needs_text');
        paintList();
        return api(API + '?' + p.toString()).then(function (r) {
            var rows = Array.isArray(r.data) ? r.data : [];
            S.docs = append ? S.docs.concat(rows) : rows;
            S.page = Number(r.current_page || 1); S.last = Number(r.last_page || 1); S.total = Number(r.total || rows.length);
            S.stats = r.stats || S.stats;
        }).catch(function (e) { S.err = e.message; }).then(function () { S.loading = false; paintAll(); });
    }

    /* ---------- Tampilan ---------- */
    function shell() {
        var root = $('regAiRoot'); if (!root) return null;
        if (root.getAttribute('data-ready') === '1') return root;
        injectStyle(); root.className = 'ra'; root.setAttribute('data-ready', '1');
        root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
        root.addEventListener('submit', onSubmit);
        ['dragover', 'dragleave', 'drop'].forEach(function (ev) { root.addEventListener(ev, onDrag); });
        root.innerHTML = '<div id="raHero"></div><div id="raKpis"></div><div class="ra-grid"><div id="raForm"></div><div id="raList"></div></div>';
        return root;
    }

    function selectOpts(list, cur, blank) {
        return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    }

    function paintHero() {
        $('raHero').innerHTML = '<div class="ra-hero"><div class="ic"><i class="fa-solid fa-scale-balanced"></i></div><div><h2>' + esc(company()) + ' Regulatory AI</h2>' +
            '<p>Sumber regulasi Bank Indonesia, PPATK, dan otoritas lain. Dokumen yang Anda masukkan di sini dibaca, dipecah per pasal, lalu dipakai sebagai satu-satunya dasar jawaban di halaman Chat Regulatory AI.</p></div>' +
            '<div class="act"><button class="ra-btn" data-act="reload"><i class="fa-solid fa-rotate"></i> Muat Ulang</button>' +
            '<button class="ra-btn pri" data-act="chat"><i class="fa-solid fa-wand-magic-sparkles"></i> Buka Chat AI</button></div></div>';
    }

    function paintKpis() {
        var s = S.stats || { total: 0, ready: 0, attention: 0, chunks: 0 };
        $('raKpis').innerHTML = '<div class="ra-kpis">' +
            kpi('Total sumber', s.total, '', '') + kpi('Siap ditanyakan', s.ready, 'ok', 'teks terbaca & terindeks') +
            kpi('Perlu tindakan', s.attention, s.attention ? 'warn' : '', 'teks belum terbaca') + kpi('Bagian terindeks', s.chunks, '', 'per pasal / paragraf') + '</div>';
    }
    function kpi(t, v, cls, sub) { return '<div class="ra-kpi ' + cls + '"><div class="t">' + t + '</div><div class="v">' + Number(v || 0).toLocaleString('id-ID') + '</div>' + (sub ? '<div class="t" style="font-weight:500">' + sub + '</div>' : '') + '</div>'; }

    function paintForm() {
        var box = $('raForm');
        if (!canEdit()) {
            box.innerHTML = '<div class="ra-card"><h3>Tambah Sumber</h3><p class="sub">Akun Anda hanya dapat melihat sumber regulasi. Penambahan sumber dilakukan oleh owner, superadmin, admin, atau supervisor.</p></div>';
            return;
        }
        var keep = {}; ['raTitle', 'raIssuer', 'raType', 'raNumber', 'raDate', 'raValidity', 'raUrl', 'raNotes', 'raText'].forEach(function (id) { if ($(id)) keep[id] = $(id).value; });
        box.innerHTML = '<form class="ra-card" id="raUpload" novalidate><h3>Tambah Sumber Regulasi</h3><p class="sub">Isi dari file resmi atau tempel teksnya. Data penerbit dan nomor membantu AI memilih aturan yang paling tepat.</p>' +
            '<div class="ra-seg"><button type="button" data-mode="file" class="' + (S.mode === 'file' ? 'on' : '') + '"><i class="fa-solid fa-file-arrow-up"></i> Unggah File</button><button type="button" data-mode="text" class="' + (S.mode === 'text' ? 'on' : '') + '"><i class="fa-solid fa-paste"></i> Tempel Teks</button></div>' +
            (S.mode === 'file'
                ? '<div class="ra-drop" id="raDrop" data-act="pick" tabindex="0" role="button"><i class="fa-solid fa-cloud-arrow-up"></i><b>' + (S.file ? esc(S.file.name) : 'Tarik file ke sini atau klik untuk memilih') + '</b><span>' + (S.file ? fmtSize(S.file.size) : 'PDF, Word, Excel, PowerPoint, TXT, HTML, gambar. Maks. 20 MB') + '</span></div><input type="file" id="raFile" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.zip,.xml,.json,.html">'
                : '<div style="margin-bottom:12px"><label class="l" for="raText">Isi regulasi</label><textarea class="form-control" id="raText" rows="8" placeholder="Tempel teks peraturan di sini (pasal demi pasal)."></textarea><small class="h">Cocok bila PDF hasil pindai tidak terbaca otomatis.</small></div>') +
            '<div class="ra-f">' +
            '<div class="full"><label class="l" for="raTitle">Judul</label><input class="form-control" id="raTitle" maxlength="255" placeholder="Judul resmi peraturan"></div>' +
            '<div><label class="l" for="raIssuer">Penerbit</label><select class="form-control" id="raIssuer">' + selectOpts(ISSUERS, '', 'Pilih penerbit') + '</select></div>' +
            '<div><label class="l" for="raType">Jenis (kosongkan bila berisi banyak peraturan)</label><select class="form-control" id="raType">' + selectOpts(TYPES, '', 'Pilih jenis') + '</select></div>' +
            '<div class="full"><label class="l" for="raNumber">Nomor regulasi</label><input class="form-control" id="raNumber" maxlength="150" placeholder="Kosongkan bila berisi banyak peraturan"></div>' +
            '<div><label class="l" for="raDate">Tanggal berlaku</label><input class="form-control" type="date" id="raDate"></div>' +
            '<div><label class="l" for="raValidity">Status</label><select class="form-control" id="raValidity">' + selectOpts([['berlaku', 'Berlaku'], ['diubah', 'Telah diubah'], ['dicabut', 'Dicabut']], 'berlaku') + '</select></div>' +
            '<div class="full"><label class="l" for="raUrl">Tautan resmi (opsional)</label><input class="form-control" type="url" id="raUrl" maxlength="500" placeholder="https://"><small class="h">Bila hanya tautan yang diisi, sumber tersimpan sebagai referensi dan belum bisa dijadikan dasar jawaban AI.</small></div>' +
            '<div class="full"><label class="l" for="raNotes">Catatan (opsional)</label><input class="form-control" id="raNotes" maxlength="2000" placeholder="Misal: berlaku untuk KUPVA bukan bank"></div></div>' +
            '<div id="raFormErr"></div><div class="ra-mf" style="margin-top:14px"><button type="submit" class="ra-btn pri" id="raSubmit"' + (S.busy ? ' disabled' : '') + '><i class="fa-solid ' + (S.busy ? 'fa-spinner fa-spin' : 'fa-circle-plus') + '"></i> ' + (S.busy ? 'Membaca dokumen...' : 'Simpan & Indeks') + '</button></div></form>';
        Object.keys(keep).forEach(function (id) { if ($(id) && keep[id] !== '') $(id).value = keep[id]; });
    }

    function badge(txt, cls) { return '<span class="ra-b ' + cls + '">' + esc(txt) + '</span>'; }

    function docCard(d) {
        var st = STATUS[d.status] || [d.status, 'n'], va = VALIDITY[d.validity] || VALIDITY.berlaku;
        var meta = [d.regulation_number, d.effective_date ? 'Berlaku ' + fmtDate(d.effective_date) : null, d.original_name && d.extension !== 'url' ? d.original_name + ' (' + fmtSize(d.size_bytes) + ')' : 'Referensi tautan'].filter(Boolean).map(esc).join(' &middot; ');
        return '<div class="ra-doc"><div><h4>' + esc(d.title) + '</h4><div class="m">' + meta + '</div><div class="b">' +
            (d.issuer ? badge(lab(ISSUERS, d.issuer), 'b') : '') + (d.doc_type ? badge(lab(TYPES, d.doc_type), 'n') : '') + badge(va[0], va[1]) + badge(st[0] + (d.status === 'ready' ? ' · ' + d.chunk_count + ' bagian' : ''), st[1]) + '</div>' +
            (d.status === 'needs_text' && d.processing_error ? '<div class="m" style="color:#fbbf24;margin-top:6px"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(d.processing_error) + '</div>' : '') + '</div>' +
            '<div class="a">' + (d.status === 'ready' ? '<button class="ra-btn sm pri" data-act="ask" data-id="' + d.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Tanya AI</button>' : '') +
            '<button class="ra-btn sm" data-act="detail" data-id="' + d.id + '"><i class="fa-solid fa-circle-info"></i> Detail</button></div></div>';
    }

    function paintList() {
        var box = $('raList'); if (!box) return;
        var by = (S.stats && S.stats.by_issuer) || {}, tot = (S.stats && S.stats.total) || 0;
        var chips = '<button class="ra-chip ' + (!S.issuer ? 'on' : '') + '" data-issuer="">Semua<i>' + tot + '</i></button>' + ISSUERS.map(function (i) {
            return '<button class="ra-chip ' + (S.issuer === i[0] ? 'on' : '') + '" data-issuer="' + i[0] + '">' + esc(i[1]) + '<i>' + (by[i[0]] || 0) + '</i></button>';
        }).join('');
        var body;
        if (S.err) body = '<div class="ra-err">' + esc(S.err) + '</div>';
        else if (S.loading && !S.docs.length) body = '<div class="ra-empty"><i class="fa-solid fa-spinner fa-spin"></i>Memuat sumber...</div>';
        else if (!S.docs.length) body = '<div class="ra-empty"><i class="fa-regular fa-folder-open"></i>' + (S.q || S.issuer || S.state || S.validity ? 'Tidak ada sumber yang cocok dengan filter.' : 'Belum ada sumber regulasi.<br>Mulai dari peraturan inti: UU TPPU, PBI/PADG tentang KUPVA bukan bank, dan peraturan PPATK tentang pelaporan.') + '</div>';
        else body = S.docs.map(docCard).join('') + (S.page < S.last ? '<div style="text-align:center"><button class="ra-btn" data-act="more">Muat lebih banyak</button></div>' : '');
        var keepQ = $('raSearch') ? $('raSearch').value : S.q, focus = document.activeElement && document.activeElement.id === 'raSearch';
        box.innerHTML = '<div class="ra-card"><h3>Perpustakaan Regulasi</h3><p class="sub">' + S.total.toLocaleString('id-ID') + ' sumber ditampilkan.</p>' +
            '<div class="ra-tool"><input class="form-control grow" id="raSearch" type="search" placeholder="Cari judul, nomor, atau catatan..." value="' + esc(keepQ) + '">' +
            '<select class="form-control" id="raState" style="width:auto"><option value="">Semua status</option><option value="ready"' + (S.state === 'ready' ? ' selected' : '') + '>Siap ditanyakan</option><option value="needs_text"' + (S.state === 'needs_text' ? ' selected' : '') + '>Perlu teks</option></select>' +
            '<select class="form-control" id="raValidityF" style="width:auto"><option value="">Semua keberlakuan</option>' + selectOpts([['berlaku', 'Berlaku'], ['diubah', 'Telah diubah'], ['dicabut', 'Dicabut']], S.validity) + '</select></div>' +
            '<div class="ra-chips">' + chips + '</div>' + body + '</div>';
        if (focus) { var el = $('raSearch'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }

    function paintAll() { paintHero(); paintKpis(); paintList(); }

    /* ---------- Modal ---------- */
    function openModal(html, small) {
        closeModal();
        var ov = document.createElement('div'); ov.className = 'ra-ov'; ov.id = 'raOv';
        ov.innerHTML = '<div class="ra-modal ' + (small ? 'sm' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
        ov.addEventListener('mousedown', function (e) { if (e.target === ov) closeModal(); });
        ov.addEventListener('click', onClick); ov.addEventListener('submit', onSubmit);
        document.body.appendChild(ov);
    }
    function closeModal() { var o = $('raOv'); if (o) o.remove(); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    function showDetail(id) {
        openModal('<div class="ra-empty"><i class="fa-solid fa-spinner fa-spin"></i>Memuat detail...</div>');
        api(API + '/' + encodeURIComponent(id)).then(function (r) { renderDetail(r.document || {}); }).catch(function (e) {
            openModal('<div class="ra-err">' + esc(e.message) + '</div><div class="ra-mf"><button class="ra-btn" data-act="close">Tutup</button></div>', true);
        });
    }

    function renderDetail(d) {
        var ed = canEdit(), va = VALIDITY[d.validity] || VALIDITY.berlaku, st = STATUS[d.status] || [d.status, 'n'];
        var info = '<dl class="ra-dl"><dt>Penerbit</dt><dd>' + esc(lab(ISSUERS, d.issuer) || '-') + '</dd><dt>Jenis</dt><dd>' + esc(lab(TYPES, d.doc_type) || '-') + '</dd>' +
            '<dt>Nomor</dt><dd>' + esc(d.regulation_number || '-') + '</dd><dt>Tanggal berlaku</dt><dd>' + fmtDate(d.effective_date) + '</dd>' +
            '<dt>Keberlakuan</dt><dd>' + badge(va[0], va[1]) + '</dd><dt>Status teks</dt><dd>' + badge(st[0], st[1]) + (d.status === 'ready' ? ' ' + d.chunk_count + ' bagian terindeks' : '') + '</dd>' +
            '<dt>Berkas</dt><dd>' + esc(d.extension === 'url' ? 'Referensi tautan' : (d.original_name || '-') + ' (' + fmtSize(d.size_bytes) + ')') + '</dd>' +
            '<dt>Tautan resmi</dt><dd>' + (d.source_url ? '<a href="' + esc(d.source_url) + '" target="_blank" rel="noopener noreferrer">' + esc(d.source_url) + '</a>' : '-') + '</dd>' +
            '<dt>Catatan</dt><dd>' + esc(d.notes || '-') + '</dd><dt>Sidik SHA-256</dt><dd style="font-size:.74rem">' + esc(d.sha256 || '-') + '</dd><dt>Ditambahkan</dt><dd>' + fmtDate(d.created_at) + '</dd></dl>';
        var err = d.processing_error ? '<div class="ra-err" style="margin-top:12px">' + esc(d.processing_error) + '</div>' : '';
        var sum = '<div class="ra-sec"><h5><i class="fa-solid fa-list-check"></i> Ringkasan kewajiban (AI)</h5>' +
            (d.summary ? '<div class="ra-sum">' + esc(d.summary).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>') + '</div><small class="h" style="color:var(--mut);font-size:.72rem;margin-top:4px;display:block">Dibuat ' + fmtDate(d.summary_at) + '. Selalu cocokkan dengan naskah resmi.</small>' : '<div class="ra-empty" style="padding:12px">Belum ada ringkasan.</div>') +
            (ed && d.status === 'ready' ? '<div style="margin-top:8px"><button class="ra-btn sm" data-act="summarize" data-id="' + d.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i> ' + (d.summary ? 'Buat ulang' : 'Buat ringkasan') + '</button></div>' : '') + '</div>';
        var prev = '<div class="ra-sec"><h5><i class="fa-solid fa-file-lines"></i> Cuplikan teks terbaca' + (d.text_length ? ' (' + Number(d.text_length).toLocaleString('id-ID') + ' karakter)' : '') + '</h5>' +
            (d.text_preview ? '<div class="ra-pre">' + esc(d.text_preview) + '</div>' : '<div class="ra-empty" style="padding:12px">Belum ada teks terbaca.</div>') + '</div>';
        var edit = ed ? '<div class="ra-sec"><h5><i class="fa-solid fa-pen"></i> Ubah data / ganti teks</h5><form id="raEdit" data-id="' + d.id + '"><div class="ra-f">' +
            '<div class="full"><label class="l">Judul</label><input class="form-control" name="title" maxlength="255" value="' + esc(d.title) + '"></div>' +
            '<div><label class="l">Penerbit</label><select class="form-control" name="issuer">' + selectOpts(ISSUERS, d.issuer, '-') + '</select></div>' +
            '<div><label class="l">Jenis</label><select class="form-control" name="doc_type">' + selectOpts(TYPES, d.doc_type, '-') + '</select></div>' +
            '<div><label class="l">Nomor</label><input class="form-control" name="regulation_number" maxlength="150" value="' + esc(d.regulation_number) + '"></div>' +
            '<div><label class="l">Tanggal berlaku</label><input class="form-control" type="date" name="effective_date" value="' + esc(d.effective_date) + '"></div>' +
            '<div><label class="l">Keberlakuan</label><select class="form-control" name="validity">' + selectOpts([['berlaku', 'Berlaku'], ['diubah', 'Telah diubah'], ['dicabut', 'Dicabut']], d.validity || 'berlaku') + '</select></div>' +
            '<div><label class="l">Tautan resmi</label><input class="form-control" type="url" name="source_url" maxlength="500" value="' + esc(d.source_url) + '"></div>' +
            '<div class="full"><label class="l">Catatan</label><input class="form-control" name="notes" maxlength="2000" value="' + esc(d.notes) + '"></div>' +
            '<div class="full"><label class="l">Tempel teks baru (mengganti teks terbaca)</label><textarea class="form-control" name="content" rows="4" placeholder="Kosongkan bila tidak ingin mengganti teks."></textarea></div></div>' +
            '<div id="raEditErr"></div><div class="ra-mf"><button type="submit" class="ra-btn pri"><i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan</button></div></form></div>' : '';
        var foot = '<div class="ra-mf">' + (ed ? '<button class="ra-btn dng" data-act="delete-ask" data-id="' + d.id + '"><i class="fa-solid fa-trash"></i> Hapus</button>' : '') +
            (ed && d.has_file ? '<button class="ra-btn" data-act="reindex" data-id="' + d.id + '"><i class="fa-solid fa-arrows-rotate"></i> Baca ulang berkas</button>' : '') +
            (d.has_file ? '<button class="ra-btn" data-act="download" data-id="' + d.id + '"><i class="fa-solid fa-download"></i> Unduh asli</button>' : '') +
            (d.status === 'ready' ? '<button class="ra-btn pri" data-act="ask" data-id="' + d.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Tanya AI</button>' : '') +
            '<button class="ra-btn" data-act="close">Tutup</button></div>';
        openModal('<div class="ra-mh"><div><h3>' + esc(d.title) + '</h3></div></div>' + info + err + sum + prev + edit + foot);
        window.__raDocTitle = d.title;
    }

    /* ---------- Aksi ---------- */
    function goChat(id, title) {
        try { sessionStorage.setItem('mc_regchat_scope', JSON.stringify({ ids: [Number(id)], title: title || '' })); } catch (e) { }
        closeModal();
        var nav = document.querySelector('[data-target="almara-regulatory-chat-view"]');
        if (nav) nav.click();
    }

    function onClick(e) {
        var seg = e.target.closest('[data-mode]');
        if (seg) { S.mode = seg.dataset.mode; S.file = null; paintForm(); return; }
        var chip = e.target.closest('[data-issuer]');
        if (chip) { S.issuer = chip.dataset.issuer; load(1); return; }
        var b = e.target.closest('[data-act]'); if (!b) return;
        var act = b.dataset.act, id = b.dataset.id;
        if (act === 'close') closeModal();
        else if (act === 'reload') load(1);
        else if (act === 'more') load(S.page + 1, true);
        else if (act === 'pick') { var f = $('raFile'); if (f) f.click(); }
        else if (act === 'detail') showDetail(id);
        else if (act === 'chat') { var nav = document.querySelector('[data-target="almara-regulatory-chat-view"]'); if (nav) nav.click(); }
        else if (act === 'ask') { var doc = S.docs.filter(function (x) { return String(x.id) === String(id); })[0]; goChat(id, doc ? doc.title : window.__raDocTitle); }
        else if (act === 'download') window.open(API + '/' + encodeURIComponent(id) + '/download', '_blank');
        else if (act === 'summarize') doSummarize(id, b);
        else if (act === 'reindex') doReindex(id, b);
        else if (act === 'delete-ask') {
            openModal('<div class="ra-mh"><div><h3>Hapus sumber ini?</h3></div></div><p style="margin:0;font-size:.88rem;line-height:1.55">Berkas dan seluruh bagian terindeks akan dihapus permanen. Jawaban AI tidak lagi dapat merujuk sumber ini.</p>' +
                '<div class="ra-mf"><button class="ra-btn" data-act="close">Batal</button><button class="ra-btn dng" data-act="delete" data-id="' + esc(id) + '"><i class="fa-solid fa-trash"></i> Ya, hapus</button></div>', true);
        }
        else if (act === 'delete') {
            b.disabled = true;
            api(API + '/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (r) { closeModal(); toast(r.message || 'Sumber dihapus.'); load(1); })
                .catch(function (er) { b.disabled = false; toast(er.message, true); });
        }
    }

    function onInput(e) {
        if (e.target.id === 'raSearch') { clearTimeout(S.timer); S.q = e.target.value.trim(); S.timer = setTimeout(function () { load(1); }, 320); }
        else if (e.target.id === 'raText' && !$('raTitle').value.trim() && !$('raNumber').value.trim()) { /* tebak setelah selesai mengetik */ clearTimeout(S.gt); S.gt = setTimeout(function () { applyGuess(e.target.value.slice(0, 1500), true); }, 700); }
    }
    function onChange(e) {
        if (e.target.id === 'raState') { S.state = e.target.value; load(1); }
        else if (e.target.id === 'raValidityF') { S.validity = e.target.value; load(1); }
        else if (e.target.id === 'raFile') { setFile(e.target.files && e.target.files[0]); }
    }
    function onDrag(e) {
        var drop = e.target.closest && e.target.closest('#raDrop'); if (!drop) return;
        e.preventDefault();
        if (e.type === 'dragover') drop.classList.add('over');
        else if (e.type === 'dragleave') drop.classList.remove('over');
        else { drop.classList.remove('over'); setFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); }
    }

    function applyGuess(src, fromText) {
        var g = guess(src);
        if (g.issuer && $('raIssuer') && !$('raIssuer').value) $('raIssuer').value = g.issuer;
        if (g.doc_type && $('raType') && !$('raType').value) $('raType').value = g.doc_type;
        if (g.regulation_number && $('raNumber') && !$('raNumber').value) $('raNumber').value = g.regulation_number;
    }
    function setFile(f) {
        if (!f) return;
        if (f.size > 20 * 1024 * 1024) { toast('Ukuran file melebihi 20 MB.', true); return; }
        S.file = f;
        var name = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
        var keepTitle = $('raTitle') && $('raTitle').value.trim();
        paintForm();
        if (!keepTitle && $('raTitle')) $('raTitle').value = name;
        applyGuess(f.name);
    }

    function onSubmit(e) {
        if (e.target.id === 'raUpload') { e.preventDefault(); doUpload(); }
        else if (e.target.id === 'raEdit') { e.preventDefault(); doEdit(e.target); }
    }

    function doUpload() {
        if (S.busy) return;
        var err = $('raFormErr'); err.innerHTML = '';
        var text = S.mode === 'text' ? ($('raText').value || '').trim() : '';
        var url = ($('raUrl').value || '').trim();
        if (S.mode === 'file' && !S.file && !url) { err.innerHTML = '<div class="ra-err">Pilih file, atau isi tautan resmi sebagai referensi.</div>'; return; }
        if (S.mode === 'text' && !text && !url) { err.innerHTML = '<div class="ra-err">Tempel teks regulasi, atau isi tautan resmi sebagai referensi.</div>'; return; }
        if (!($('raTitle').value || '').trim() && !S.file) { err.innerHTML = '<div class="ra-err">Judul wajib diisi.</div>'; return; }
        var fd = new FormData();
        [['title', 'raTitle'], ['issuer', 'raIssuer'], ['doc_type', 'raType'], ['regulation_number', 'raNumber'], ['effective_date', 'raDate'], ['validity', 'raValidity'], ['source_url', 'raUrl'], ['notes', 'raNotes']]
            .forEach(function (p) { var v = ($(p[1]).value || '').trim(); if (v) fd.append(p[0], v); });
        if (S.mode === 'file' && S.file) fd.append('file', S.file);
        if (text) fd.append('content', text);
        S.busy = true; paintForm();
        api(API, { method: 'POST', body: fd, headers: aiHeaders() }).then(function (r) {
            toast(r.message || 'Sumber tersimpan.', r.document && r.document.status !== 'ready');
            S.file = null; S.busy = false;
            ['raTitle', 'raIssuer', 'raType', 'raNumber', 'raDate', 'raUrl', 'raNotes', 'raText'].forEach(function (id) { if ($(id)) $(id).value = ''; });
            paintForm(); load(1);
        }).catch(function (er) {
            S.busy = false; paintForm(); var el = $('raFormErr'); if (el) el.innerHTML = '<div class="ra-err">' + esc(er.message) + '</div>';
        });
    }

    function doEdit(form) {
        var id = form.dataset.id, body = {};
        Array.prototype.forEach.call(form.elements, function (el) { if (el.name) body[el.name] = el.value === '' ? null : el.value; });
        if (!body.content) delete body.content;
        if (!body.title) delete body.title;
        var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        api(API + '/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body), headers: Object.assign({ 'Content-Type': 'application/json' }, aiHeaders()) })
            .then(function (r) { toast(r.message || 'Tersimpan.'); showDetail(id); load(1); })
            .catch(function (er) { btn.disabled = false; $('raEditErr').innerHTML = '<div class="ra-err" style="margin-top:8px">' + esc(er.message) + '</div>'; });
    }

    function doSummarize(id, btn) {
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyusun ringkasan...';
        api(API + '/' + encodeURIComponent(id) + '/summarize', { method: 'POST', headers: aiHeaders() })
            .then(function () { showDetail(id); }).catch(function (er) { btn.disabled = false; btn.innerHTML = 'Buat ringkasan'; toast(er.message, true); });
    }
    function doReindex(id, btn) {
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membaca...';
        api(API + '/' + encodeURIComponent(id) + '/reindex', { method: 'POST', headers: aiHeaders() })
            .then(function (r) { toast(r.message, r.document && r.document.status !== 'ready'); showDetail(id); load(1); })
            .catch(function (er) { btn.disabled = false; btn.innerHTML = 'Baca ulang berkas'; toast(er.message, true); });
    }

    /* ---------- Masuk halaman ---------- */
    function open() { if (!shell()) return; paintHero(); paintKpis(); paintForm(); load(1); }
    window.loadRegulatorySources = open;

    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-target="almara-regulatory-ai-view"]')) setTimeout(open, 0);
    });
})();
