// @2026-Alifiandra
/* =====================================================================
 * 24-regulatory-chat.js  —  Pelaporan BI & Regulasi > Chat Regulatory AI
 *
 * Tanya-jawab regulasi Bank Indonesia, PPATK, dan otoritas lain.
 * Jawaban disusun AI hanya dari sumber yang tersimpan di "Sumber Regulasi",
 * disertai kutipan [S1], [S2] yang bisa dibuka untuk melihat bunyi aslinya.
 *  - Cakupan: semua sumber, per penerbit, atau satu sumber tertentu.
 *  - Pertanyaan lanjutan memahami konteks percakapan.
 *  - Riwayat disimpan di peramban per pengguna; dapat diekspor.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcRegulatoryChat) return;
    window.__mcRegulatoryChat = true;

    var API = '/api/regulatory-chat';
    var ISSUERS = [['BI', 'Bank Indonesia'], ['PPATK', 'PPATK'], ['OJK', 'OJK'], ['KEMENKEU', 'Kemenkeu'], ['LAINNYA', 'Lainnya']];
    var VALID = { berlaku: 'Berlaku', diubah: 'Telah diubah', dicabut: 'Dicabut' };
    var PROMPTS = [
        ['fa-id-card', 'Kewajiban identifikasi nasabah', 'Apa saja kewajiban identifikasi dan verifikasi nasabah pada transaksi penukaran valuta asing?'],
        ['fa-file-shield', 'Kapan wajib lapor LTKT/LTKM', 'Kapan transaksi wajib dilaporkan sebagai LTKT atau LTKM, dan berapa batas waktu pelaporannya?'],
        ['fa-scale-unbalanced', 'Batas transaksi tanpa dokumen', 'Berapa batas nominal transaksi yang boleh dilakukan tanpa dokumen underlying?'],
        ['fa-building-columns', 'Syarat izin KUPVA bukan bank', 'Apa persyaratan perizinan dan kewajiban pelaporan bagi KUPVA bukan bank?'],
        ['fa-user-shield', 'Nasabah berisiko tinggi', 'Bagaimana penanganan nasabah berisiko tinggi atau PEP menurut ketentuan?'],
        ['fa-gavel', 'Sanksi pelanggaran', 'Apa sanksi administratif jika penyelenggara melanggar ketentuan pelaporan?']
    ];

    var S = { chats: [], active: null, scope: { issuer: '', ids: [], title: '' }, busy: false, ctrl: null, status: null, histOpen: false, hq: '', ready: false, openSrc: {} };

    function $(id) { return document.getElementById(id); }
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function csrf() { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; }
    function uid() { try { var u = JSON.parse(ls('mc_currentUser') || '{}'); return String(u.id || u.username || 'anon'); } catch (e) { return 'anon'; } }
    function KEY() { return 'mc_regulatory_chat_v2_' + uid(); }
    function aiHeaders() {
        return {
            'X-AI-Provider': ls('mc_ai_provider') || 'gemini', 'X-Gemini-Key': ls('mc_gemini_api_key'),
            'X-OpenAI-Key': ls('mc_openai_api_key'), 'X-OpenAI-Model': ls('mc_openai_model') || 'gpt-4o-mini'
        };
    }
    function newId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

    /* ---------- Penyimpanan riwayat ---------- */
    function loadChats() {
        try { var v = JSON.parse(ls(KEY()) || '[]'); S.chats = Array.isArray(v) ? v : []; } catch (e) { S.chats = []; }
    }
    function saveChats() {
        var data = S.chats.slice(0, 40).map(function (c) {
            return Object.assign({}, c, { messages: c.messages.slice(-40).map(function (m) {
                if (!m.sources) return m;
                return Object.assign({}, m, { sources: m.sources.map(function (s) { return Object.assign({}, s, { text: String(s.text || '').slice(0, 700) }); }) });
            }) });
        });
        try { localStorage.setItem(KEY(), JSON.stringify(data)); } catch (e) {
            try { localStorage.setItem(KEY(), JSON.stringify(data.slice(0, 10))); } catch (e2) { }
        }
    }
    function chat() { return S.chats.filter(function (c) { return c.id === S.active; })[0] || null; }

    /* ---------- Gaya ---------- */
    function injectStyle() {
        if ($('rc-style')) return;
        var st = document.createElement('style'); st.id = 'rc-style';
        st.textContent = [
            '.rc{--bd:var(--mc-border,rgba(148,163,184,.3));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#10b981);display:grid;gap:14px}.rc *{box-sizing:border-box}',
            '.rc-head{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.rc-head .ic{width:42px;height:42px;border-radius:12px;background:var(--pri);color:var(--mc-primary-contrast,#fff);display:grid;place-items:center;font-size:1.1rem;flex:none}',
            '.rc-head h2{margin:0;font-size:1.15rem}.rc-head p{margin:2px 0 0;color:var(--mut);font-size:.82rem}.rc-head .act{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}',
            '.rc-pills{display:flex;gap:8px;flex-wrap:wrap}.rc-pill{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--bd);border-radius:99px;font-size:.74rem;font-weight:700;padding:4px 11px;color:var(--mut)}',
            '.rc-pill.ok{color:#34d399;border-color:rgba(52,211,153,.4)}.rc-pill.warn{color:#fbbf24;border-color:rgba(251,191,36,.45)}.rc-pill.bad{color:#f87171;border-color:rgba(248,113,113,.45)}.rc-pill a{color:inherit;text-decoration:underline;cursor:pointer}',
            '.rc-main{display:grid;grid-template-columns:270px minmax(0,1fr);border:1px solid var(--bd);border-radius:16px;overflow:hidden;height:calc(100vh - 235px);min-height:540px}',
            '@media(max-width:860px){.rc-main{grid-template-columns:1fr;height:calc(100vh - 200px)}.rc-side{display:none}.rc-side.open{display:flex;position:absolute;z-index:5;inset:0 30% 0 0;background:var(--mc-card-bg,#0f172a);box-shadow:0 0 40px rgba(0,0,0,.5)}.rc-main{position:relative}.rc-histbtn{display:inline-flex!important}}',
            '.rc-histbtn{display:none}',
            '.rc-side{display:flex;flex-direction:column;border-right:1px solid var(--bd);min-height:0}.rc-side .top{padding:12px;display:grid;gap:8px;border-bottom:1px solid var(--bd)}',
            '.rc-list{flex:1;overflow-y:auto;padding:8px}.rc-item{display:flex;gap:6px;align-items:center;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:.82rem;border:1px solid transparent}',
            '.rc-item:hover{background:rgba(148,163,184,.1)}.rc-item.on{border-color:var(--pri);background:rgba(16,185,129,.1)}.rc-item .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rc-item .d{opacity:0;background:none;border:0;color:var(--mut);cursor:pointer;padding:2px 5px}.rc-item:hover .d,.rc-item.on .d{opacity:1}.rc-item .d:hover{color:#f87171}',
            '.rc-grp{font-size:.68rem;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;padding:10px 10px 4px}',
            '.rc-pane{display:flex;flex-direction:column;min-width:0;min-height:0}',
            '.rc-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--bd)}.rc-bar .l{font-size:.74rem;font-weight:700;color:var(--mut)}.rc-bar select{width:auto;max-width:100%}',
            '.rc-scope{display:inline-flex;gap:6px;align-items:center;background:rgba(16,185,129,.14);border:1px solid var(--pri);border-radius:99px;padding:3px 6px 3px 11px;font-size:.76rem;font-weight:700;max-width:100%}.rc-scope span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}.rc-scope button{border:0;background:none;color:inherit;cursor:pointer}',
            '.rc-msgs{flex:1;overflow-y:auto;padding:18px 18px 8px;min-height:0;scroll-behavior:smooth}',
            '.rc-row{display:flex;margin:0 auto 16px;max-width:860px}.rc-row.u{justify-content:flex-end}',
            '.rc-bub{max-width:92%;border-radius:15px;padding:12px 15px;font-size:.9rem;line-height:1.65;overflow-wrap:anywhere}.rc-row.u .rc-bub{background:var(--pri);color:var(--mc-primary-contrast,#fff);border-bottom-right-radius:4px;white-space:pre-wrap}',
            '.rc-row.a .rc-bub{border:1px solid var(--bd);border-bottom-left-radius:4px;width:100%;max-width:100%}.rc-bub.warn{border-color:rgba(251,191,36,.5)!important;background:rgba(251,191,36,.07)}.rc-bub.bad{border-color:rgba(248,113,113,.5)!important;background:rgba(248,113,113,.07)}',
            '.rc-bub p{margin:0 0 8px}.rc-bub p:last-child{margin-bottom:0}.rc-bub ul,.rc-bub ol{margin:4px 0 8px 20px;padding:0}.rc-bub li{margin:2px 0}',
            '.rc-cite{border:1px solid var(--pri);background:rgba(16,185,129,.14);color:inherit;border-radius:6px;font:inherit;font-size:.68rem;font-weight:800;padding:0 5px;margin:0 1px;cursor:pointer;vertical-align:baseline}.rc-cite:hover{background:var(--pri);color:var(--mc-primary-contrast,#fff)}',
            '.rc-tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.rc-mini{border:1px solid var(--bd);background:none;color:var(--mut);border-radius:8px;font:inherit;font-size:.72rem;font-weight:700;padding:3px 9px;cursor:pointer}.rc-mini:hover{color:inherit;border-color:var(--pri)}',
            '.rc-srcs{margin-top:12px;display:grid;gap:6px}.rc-srcs h6{margin:0;font-size:.72rem;color:var(--mut);font-weight:800;text-transform:uppercase;letter-spacing:.04em}',
            '.rc-src{border:1px solid var(--bd);border-radius:10px;overflow:hidden}.rc-src.hl{border-color:var(--pri);box-shadow:0 0 0 2px rgba(16,185,129,.25)}.rc-src>button{display:flex;gap:8px;align-items:center;width:100%;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:8px 11px;cursor:pointer}',
            '.rc-src .k{background:var(--pri);color:var(--mc-primary-contrast,#fff);border-radius:6px;font-size:.68rem;font-weight:800;padding:1px 6px;flex:none}.rc-src .n{flex:1;min-width:0;font-size:.8rem;font-weight:700;overflow-wrap:anywhere}.rc-src .n small{display:block;color:var(--mut);font-weight:500;font-size:.72rem}',
            '.rc-src .body{padding:0 11px 10px;font-size:.78rem;line-height:1.6;color:var(--mut);white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}',
            '.rc-vb{font-size:.64rem;font-weight:800;border-radius:99px;padding:1px 7px;background:rgba(16,185,129,.16);color:#34d399}.rc-vb.diubah{background:rgba(245,158,11,.16);color:#fbbf24}.rc-vb.dicabut{background:rgba(239,68,68,.16);color:#f87171}',
            '.rc-sug{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.rc-sug button{border:1px solid var(--bd);background:none;color:inherit;border-radius:99px;font:inherit;font-size:.76rem;padding:5px 12px;cursor:pointer;text-align:left}.rc-sug button:hover{border-color:var(--pri);background:rgba(16,185,129,.08)}',
            '.rc-welcome{max-width:860px;margin:18px auto;text-align:center}.rc-welcome .big{width:60px;height:60px;border-radius:18px;background:var(--pri);color:var(--mc-primary-contrast,#fff);display:grid;place-items:center;margin:0 auto 12px;font-size:1.5rem}',
            '.rc-welcome h3{margin:0 0 6px;font-size:1.25rem}.rc-welcome p{margin:0 auto;color:var(--mut);font-size:.88rem;line-height:1.6;max-width:560px}',
            '.rc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:20px;text-align:left}',
            '.rc-card{border:1px solid var(--bd);background:none;color:inherit;border-radius:13px;padding:12px 14px;cursor:pointer;font:inherit;display:grid;gap:4px;text-align:left}.rc-card:hover{border-color:var(--pri);background:rgba(16,185,129,.07)}.rc-card i{color:var(--pri)}.rc-card b{font-size:.84rem}.rc-card span{font-size:.76rem;color:var(--mut);line-height:1.45}',
            '.rc-note{max-width:860px;margin:14px auto 0;font-size:.76rem;color:var(--mut);text-align:center;line-height:1.5}',
            '.rc-comp{border-top:1px solid var(--bd);padding:10px 14px 12px}.rc-comp form{max-width:860px;margin:0 auto;display:flex;gap:10px;align-items:flex-end}',
            '.rc-comp textarea{flex:1;resize:none;min-height:46px;max-height:160px;line-height:1.5;width:100%}.rc-comp .hint{max-width:860px;margin:6px auto 0;font-size:.7rem;color:var(--mut)}',
            '.rc-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.82rem;padding:8px 13px;border-radius:10px;cursor:pointer;white-space:nowrap}.rc-btn:hover{border-color:var(--pri)}',
            '.rc-btn.pri{background:var(--pri);border-color:var(--pri);color:var(--mc-primary-contrast,#fff)}.rc-btn.stop{border-color:#f87171;color:#f87171}.rc-btn:disabled{opacity:.55;cursor:not-allowed}',
            '.rc-dots span{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--mut);margin-right:4px;animation:rcb 1s infinite}.rc-dots span:nth-child(2){animation-delay:.15s}.rc-dots span:nth-child(3){animation-delay:.3s}@keyframes rcb{0%,80%,100%{opacity:.25}40%{opacity:1}}',
            '.rc-toast{position:fixed;right:18px;bottom:18px;z-index:100001;background:#0f172a;color:#f8fafc;border-left:4px solid #10b981;padding:11px 16px;border-radius:10px;font-size:.84rem;box-shadow:0 10px 30px rgba(0,0,0,.35)}'
        ].join('\n');
        document.head.appendChild(st);
    }
    function toast(msg) {
        var t = document.createElement('div'); t.className = 'rc-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
        document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800);
    }

    /* ---------- Markdown ringan yang aman ---------- */
    function inline(s) {
        s = esc(s);
        s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
        s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        s = s.replace(/\[S(\d+)\]/g, '<button type="button" class="rc-cite" data-act="cite" data-n="$1">S$1</button>');
        return s;
    }
    function md(text) {
        var lines = String(text || '').replace(/\r/g, '').split('\n'), out = [], list = null, para = [];
        function endPara() { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
        function endList() { if (list) { out.push('</' + list + '>'); list = null; } }
        lines.forEach(function (ln) {
            var b = ln.match(/^\s*[-*•]\s+(.*)$/), n = ln.match(/^\s*\d+[.)]\s+(.*)$/), h = ln.match(/^\s*#{1,4}\s+(.*)$/);
            if (b || n) {
                endPara(); var t = b ? 'ul' : 'ol';
                if (list !== t) { endList(); out.push('<' + t + '>'); list = t; }
                out.push('<li>' + inline((b || n)[1]) + '</li>');
            } else if (!ln.trim()) { endPara(); endList(); }
            else if (h) { endPara(); endList(); out.push('<p><strong>' + inline(h[1]) + '</strong></p>'); }
            else { endList(); para.push(inline(ln)); }
        });
        endPara(); endList();
        return out.join('');
    }

    /* ---------- Tampilan ---------- */
    function shell() {
        var root = $('regChatRoot'); if (!root) return null;
        if (root.getAttribute('data-ready') === '1') return root;
        injectStyle(); root.className = 'rc'; root.setAttribute('data-ready', '1');
        root.addEventListener('click', onClick); root.addEventListener('submit', onSubmit); root.addEventListener('input', onInput);
        root.addEventListener('keydown', onKey); root.addEventListener('change', onChange);
        root.innerHTML = '<div id="rcHead"></div><div class="rc-main"><aside class="rc-side" id="rcSide"></aside><section class="rc-pane"><div class="rc-bar" id="rcBar"></div><div class="rc-msgs" id="rcMsgs" aria-live="polite"></div><div class="rc-comp" id="rcComp"></div></section></div>';
        return root;
    }

    function paintHead() {
        var st = S.status, pills = '';
        if (!st) pills = '<span class="rc-pill">Memeriksa kesiapan...</span>';
        else {
            pills += st.ai_ready ? '<span class="rc-pill ok"><i class="fa-solid fa-circle-check"></i> AI aktif: ' + esc(st.model) + '</span>'
                : '<span class="rc-pill warn"><i class="fa-solid fa-key"></i> Key AI belum diatur &middot; mode pencarian saja</span>';
            pills += st.sources_ready > 0 ? '<span class="rc-pill ok"><i class="fa-solid fa-book"></i> ' + st.sources_ready + ' sumber siap</span>'
                : '<span class="rc-pill bad"><i class="fa-solid fa-triangle-exclamation"></i> Belum ada sumber siap &middot; <a data-act="sources">tambah di Sumber Regulasi</a></span>';
            if (st.sources_total > st.sources_ready) pills += '<span class="rc-pill warn">' + (st.sources_total - st.sources_ready) + ' sumber belum terbaca</span>';
        }
        $('rcHead').innerHTML = '<div class="rc-head"><div class="ic"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div><h2>Chat Regulatory AI</h2><p>Tanyakan aturan Bank Indonesia, PPATK, dan otoritas lain. Jawaban hanya dari sumber yang Anda simpan.</p></div>' +
            '<div class="act"><button class="rc-btn rc-histbtn" data-act="hist"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat</button>' +
            '<button class="rc-btn" data-act="sources"><i class="fa-solid fa-book"></i> Sumber Regulasi</button></div></div><div class="rc-pills">' + pills + '</div>';
    }

    function groupLabel(ts) {
        var d = new Date(ts), n = new Date(), day = 86400000, diff = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / day);
        return diff <= 0 ? 'Hari ini' : diff === 1 ? 'Kemarin' : diff < 8 ? '7 hari terakhir' : 'Lebih lama';
    }
    function paintSide() {
        var q = S.hq.toLowerCase(), items = S.chats.filter(function (c) {
            return !q || (c.title || '').toLowerCase().indexOf(q) >= 0 || c.messages.some(function (m) { return String(m.text || '').toLowerCase().indexOf(q) >= 0; });
        }).sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
        var html = '', last = '';
        items.forEach(function (c) {
            var g = groupLabel(c.updatedAt || Date.now()); if (g !== last) { html += '<div class="rc-grp">' + g + '</div>'; last = g; }
            html += '<div class="rc-item ' + (c.id === S.active ? 'on' : '') + '" data-act="open" data-id="' + esc(c.id) + '"><i class="fa-regular fa-message"></i><span class="t">' + esc(c.title || 'Percakapan baru') + '</span><button class="d" data-act="del" data-id="' + esc(c.id) + '" aria-label="Hapus percakapan"><i class="fa-solid fa-trash"></i></button></div>';
        });
        if (!items.length) html = '<div style="padding:18px 12px;color:var(--mut);font-size:.8rem;text-align:center">' + (q ? 'Tidak ada percakapan yang cocok.' : 'Belum ada percakapan.') + '</div>';
        var side = $('rcSide'); side.className = 'rc-side' + (S.histOpen ? ' open' : '');
        var keep = $('rcHq') ? $('rcHq').value : S.hq, focus = document.activeElement && document.activeElement.id === 'rcHq';
        side.innerHTML = '<div class="top"><button class="rc-btn pri" data-act="new" style="justify-content:center"><i class="fa-solid fa-plus"></i> Chat Baru</button><input class="form-control" id="rcHq" type="search" placeholder="Cari riwayat..." value="' + esc(keep) + '"></div><div class="rc-list">' + html + '</div>';
        if (focus) { var el = $('rcHq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }

    function paintBar() {
        var sc = S.scope, opts = '<option value="">Semua sumber</option>' + ISSUERS.map(function (i) { return '<option value="' + i[0] + '"' + (sc.issuer === i[0] && !sc.ids.length ? ' selected' : '') + '>Hanya ' + esc(i[1]) + '</option>'; }).join('');
        var c = chat(), has = c && c.messages.length;
        $('rcBar').innerHTML = '<span class="l">Cakupan jawaban:</span>' + (sc.ids.length
            ? '<span class="rc-scope"><i class="fa-solid fa-file-lines"></i><span title="' + esc(sc.title) + '">' + esc(sc.title || 'Sumber terpilih') + '</span><button data-act="clear-scope" aria-label="Hapus pilihan sumber"><i class="fa-solid fa-xmark"></i></button></span>'
            : '<select class="form-control" id="rcScope" aria-label="Cakupan sumber">' + opts + '</select>') +
            '<span style="margin-left:auto;display:flex;gap:8px">' + (has ? '<button class="rc-mini" data-act="export"><i class="fa-solid fa-file-arrow-down"></i> Ekspor</button><button class="rc-mini" data-act="copyall"><i class="fa-regular fa-copy"></i> Salin semua</button>' : '') + '</span>';
    }

    function srcCard(s, mi) {
        var key = mi + '-' + s.label, open = S.openSrc[key];
        var v = s.validity || 'berlaku';
        return '<div class="rc-src' + (open === 2 ? ' hl' : '') + '" id="rcs-' + key + '"><button data-act="togsrc" data-key="' + key + '"><span class="k">' + esc(s.label) + '</span><span class="n">' + esc(s.title) + '<small>' +
            [s.regulation_number, s.ref, s.issuer].filter(Boolean).map(esc).join(' &middot; ') + '</small></span><span class="rc-vb ' + esc(v) + '">' + esc(VALID[v] || v) + '</span><i class="fa-solid fa-chevron-' + (open ? 'up' : 'down') + '" style="color:var(--mut)"></i></button>' +
            (open ? '<div class="body">' + esc(s.text || s.snippet) + '</div>' : '') + '</div>';
    }

    function msgHtml(m, i, last) {
        if (m.role === 'user') return '<div class="rc-row u"><div class="rc-bub">' + esc(m.text) + '</div></div>';
        var cls = m.notice === 'warn' ? ' warn' : m.notice === 'bad' ? ' bad' : '';
        var body = m.text ? md(m.text) : '';
        var srcs = m.sources && m.sources.length ? '<div class="rc-srcs"><h6>Sumber (' + m.sources.length + ')</h6>' + m.sources.map(function (s) { return srcCard(s, i); }).join('') + '</div>' : '';
        var tools = !m.notice || m.sources ? '<div class="rc-tools"><button class="rc-mini" data-act="copy" data-i="' + i + '"><i class="fa-regular fa-copy"></i> Salin</button>' + (last ? '<button class="rc-mini" data-act="regen"><i class="fa-solid fa-rotate"></i> Buat ulang</button>' : '') +
            (m.model ? '<span style="margin-left:auto;font-size:.68rem;color:var(--mut);align-self:center">' + esc(m.model) + '</span>' : '') + '</div>' : (last ? '<div class="rc-tools"><button class="rc-mini" data-act="regen"><i class="fa-solid fa-rotate"></i> Coba lagi</button></div>' : '');
        var sug = last && m.suggestions && m.suggestions.length ? '<div class="rc-sug">' + m.suggestions.map(function (q) { return '<button data-act="sug" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>' : '';
        return '<div class="rc-row a"><div class="rc-bub' + cls + '">' + body + srcs + tools + sug + '</div></div>';
    }

    function paintMsgs(stick) {
        var box = $('rcMsgs'), c = chat(), html = '';
        if (!c || !c.messages.length) {
            var st = S.status || {}, warn = '';
            if (st.sources_ready === 0) warn = '<div class="rc-note" style="color:#fbbf24"><i class="fa-solid fa-triangle-exclamation"></i> Belum ada sumber regulasi yang siap. Tambahkan dokumen di <a data-act="sources" style="cursor:pointer;text-decoration:underline">Sumber Regulasi</a> agar AI punya dasar jawaban.</div>';
            html = '<div class="rc-welcome"><div class="big"><i class="fa-solid fa-scale-balanced"></i></div><h3>Apa yang ingin Anda cari?</h3><p>Tanyakan kewajiban, ambang batas, prosedur pelaporan, atau sanksi. Setiap jawaban disertai kutipan sumber yang bisa Anda periksa.</p>' +
                '<div class="rc-cards">' + PROMPTS.map(function (p) { return '<button class="rc-card" data-act="sug" data-q="' + esc(p[2]) + '"><i class="fa-solid ' + p[0] + '"></i><b>' + esc(p[1]) + '</b><span>' + esc(p[2]) + '</span></button>'; }).join('') + '</div>' + warn +
                '<div class="rc-note">Bantuan kepatuhan, bukan nasihat hukum. Selalu cocokkan dengan naskah resmi sebelum mengambil keputusan.</div></div>';
        } else {
            html = c.messages.map(function (m, i) { return msgHtml(m, i, i === c.messages.length - 1 && !S.busy); }).join('');
            if (S.busy) html += '<div class="rc-row a"><div class="rc-bub"><span class="rc-dots"><span></span><span></span><span></span></span> <span style="color:var(--mut);font-size:.82rem">Mencari di sumber dan menyusun jawaban...</span></div></div>';
        }
        box.innerHTML = html;
        if (stick !== false) box.scrollTop = box.scrollHeight;
    }

    function paintComp() {
        var ta = $('rcPrompt'), val = ta ? ta.value : '';
        $('rcComp').innerHTML = '<form id="rcForm"><textarea class="form-control" id="rcPrompt" rows="1" maxlength="2000" placeholder="Tulis pertanyaan tentang regulasi... (Enter kirim, Shift+Enter baris baru)" aria-label="Pertanyaan"></textarea>' +
            (S.busy ? '<button type="button" class="rc-btn stop" data-act="stop"><i class="fa-solid fa-stop"></i> Hentikan</button>' : '<button type="submit" class="rc-btn pri"><i class="fa-solid fa-paper-plane"></i> Kirim</button>') + '</form><div class="hint">Jawaban AI dapat keliru. Periksa kutipan sumber dan naskah resmi sebelum dijadikan dasar keputusan.</div>';
        ta = $('rcPrompt'); ta.value = val; autosize(ta); if (!S.busy) ta.focus();
    }
    function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 160) + 'px'; }

    function paintAll() { paintHead(); paintSide(); paintBar(); paintMsgs(); paintComp(); }

    /* ---------- Aksi ---------- */
    function refreshStatus() {
        fetch(API + '/status', { credentials: 'same-origin', headers: Object.assign({ Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, aiHeaders()) })
            .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d) { S.status = d; paintHead(); if (!(chat() || { messages: [] }).messages.length) paintMsgs(false); } }).catch(function () { });
    }

    function startChat() {
        var c = { id: newId(), title: '', messages: [], updatedAt: new Date().toISOString() };
        S.chats.unshift(c); S.active = c.id; return c;
    }

    function send(question, opts) {
        question = String(question || '').trim();
        if (!question || S.busy) return;
        var c = chat() || startChat();
        if (!(opts && opts.regen)) c.messages.push({ role: 'user', text: question, ts: Date.now() });
        if (!c.title) c.title = question.slice(0, 60);
        c.updatedAt = new Date().toISOString();
        var history = c.messages.slice(0, -1).filter(function (m) { return !m.notice; }).slice(-6).map(function (m) { return { role: m.role, text: String(m.text || '').slice(0, 1500) }; });
        saveChats(); S.busy = true; S.ctrl = new AbortController();
        var ta = $('rcPrompt'); if (ta) ta.value = '';
        paintSide(); paintBar(); paintMsgs(); paintComp();
        var body = { question: question, history: history };
        if (S.scope.ids.length) body.document_ids = S.scope.ids; else if (S.scope.issuer) body.issuer = S.scope.issuer;
        fetch(API, {
            method: 'POST', credentials: 'same-origin', signal: S.ctrl.signal,
            headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf() }, aiHeaders()), body: JSON.stringify(body)
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (d) {
                if (!res.ok) {
                    var m = d.message || 'Permintaan gagal (HTTP ' + res.status + ')';
                    if (res.status === 401 || res.status === 419) m = 'Sesi login berakhir. Muat ulang halaman lalu login kembali.';
                    else if (res.status === 403) m = 'Akses ditolak untuk akun ini.';
                    else if (res.status === 429) m = 'Terlalu banyak pertanyaan dalam waktu singkat. Tunggu sebentar.';
                    else if (res.status === 422 && d.errors) m = Object.keys(d.errors).map(function (k) { return d.errors[k][0]; }).join(' ');
                    throw new Error(m);
                }
                return d;
            });
        }).then(function (d) {
            var m = { role: 'assistant', ts: Date.now() };
            if (d.status === 'ok') { m.text = d.reply; m.sources = d.sources; m.suggestions = d.suggestions; m.model = d.model; }
            else if (d.status === 'search_only') { m.text = d.message + '\n\nBerikut bagian sumber yang paling relevan dengan pertanyaan Anda:'; m.sources = d.sources; m.notice = 'warn'; }
            else if (d.status === 'ai_error') { m.text = d.message; m.sources = d.sources; m.notice = 'bad'; }
            else { m.text = d.message || 'Tidak ada hasil.'; m.notice = 'warn'; }
            c.messages.push(m);
        }).catch(function (e) {
            if (e.name === 'AbortError') c.messages.push({ role: 'assistant', text: 'Permintaan dihentikan.', notice: 'warn', ts: Date.now() });
            else c.messages.push({ role: 'assistant', text: e.message || 'Terjadi kesalahan.', notice: 'bad', ts: Date.now() });
        }).then(function () {
            S.busy = false; S.ctrl = null; c.updatedAt = new Date().toISOString(); saveChats(); paintSide(); paintBar(); paintMsgs(); paintComp();
        });
    }

    function plain(c) {
        return c.messages.map(function (m) {
            var t = (m.role === 'user' ? 'PERTANYAAN: ' : 'JAWABAN: ') + m.text;
            if (m.sources && m.sources.length) t += '\n\nSumber:\n' + m.sources.map(function (s) { return '[' + s.label + '] ' + s.title + (s.regulation_number ? ' (' + s.regulation_number + ')' : '') + (s.ref ? ' - ' + s.ref : ''); }).join('\n');
            return t;
        }).join('\n\n----------------------------------------\n\n');
    }
    function copy(text) {
        var done = function () { toast('Disalin ke papan klip.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
        function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Gagal menyalin.'); } t.remove(); }
    }

    function onClick(e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        var act = b.dataset.act, c = chat();
        if (act === 'new') { S.active = null; S.histOpen = false; paintAll(); }
        else if (act === 'open') { if (e.target.closest('[data-act="del"]')) return; S.active = b.dataset.id; S.histOpen = false; paintAll(); }
        else if (act === 'del') {
            e.stopPropagation();
            if (!window.confirm('Hapus percakapan ini?')) return;
            S.chats = S.chats.filter(function (x) { return x.id !== b.dataset.id; }); if (S.active === b.dataset.id) S.active = null; saveChats(); paintAll();
        }
        else if (act === 'hist') { S.histOpen = !S.histOpen; paintSide(); }
        else if (act === 'sources') { var nav = document.querySelector('[data-target="almara-regulatory-ai-view"]'); if (nav) nav.click(); }
        else if (act === 'clear-scope') { S.scope = { issuer: '', ids: [], title: '' }; paintBar(); }
        else if (act === 'sug') { send(b.dataset.q); }
        else if (act === 'stop') { if (S.ctrl) S.ctrl.abort(); }
        else if (act === 'regen') {
            if (!c) return; while (c.messages.length && c.messages[c.messages.length - 1].role === 'assistant') c.messages.pop();
            var lastU = c.messages[c.messages.length - 1]; if (lastU) send(lastU.text, { regen: true });
        }
        else if (act === 'copy') { var m = c && c.messages[Number(b.dataset.i)]; if (m) copy(m.text.replace(/\[S(\d+)\]/g, '[S$1]')); }
        else if (act === 'copyall') { if (c) copy(plain(c)); }
        else if (act === 'export') {
            if (!c) return;
            var blob = new Blob(['﻿' + (c.title || 'Chat Regulatory AI') + '\n' + new Date().toLocaleString('id-ID') + '\n\n' + plain(c)], { type: 'text/plain;charset=utf-8' });
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chat-regulasi-' + new Date().toISOString().slice(0, 10) + '.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        }
        else if (act === 'cite') {
            var row = b.closest('.rc-bub'), card = row && row.querySelector('[id$="-S' + b.dataset.n + '"]');
            if (card) { var key = card.id.replace('rcs-', ''); S.openSrc[key] = 2; paintMsgs(false); var again = $('rcs-' + key); if (again) again.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        }
        else if (act === 'togsrc') { var k = b.dataset.key; S.openSrc[k] = S.openSrc[k] ? 0 : 1; var sc = $('rcMsgs').scrollTop; paintMsgs(false); $('rcMsgs').scrollTop = sc; }
    }
    function onChange(e) { if (e.target.id === 'rcScope') { S.scope = { issuer: e.target.value, ids: [], title: '' }; } }
    function onInput(e) {
        if (e.target.id === 'rcPrompt') autosize(e.target);
        else if (e.target.id === 'rcHq') { S.hq = e.target.value; paintSide(); }
    }
    function onKey(e) { if (e.target.id === 'rcPrompt' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(e.target.value); } }
    function onSubmit(e) { if (e.target.id === 'rcForm') { e.preventDefault(); send($('rcPrompt').value); } }

    function takeScope() {
        try {
            var raw = sessionStorage.getItem('mc_regchat_scope'); if (!raw) return false;
            sessionStorage.removeItem('mc_regchat_scope');
            var s = JSON.parse(raw); if (s && s.ids && s.ids.length) { S.scope = { issuer: '', ids: s.ids, title: s.title || 'Sumber terpilih' }; S.active = null; return true; }
        } catch (e) { }
        return false;
    }

    function open() {
        if (!shell()) return;
        if (!S.ready) { loadChats(); S.ready = true; }
        takeScope(); paintAll(); refreshStatus();
    }
    window.loadRegulatoryChat = open;

    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-target="almara-regulatory-chat-view"]')) setTimeout(open, 0);
    });
})();
