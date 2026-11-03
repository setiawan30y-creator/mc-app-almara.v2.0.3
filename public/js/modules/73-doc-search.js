// @2026-Alifiandra
/* =====================================================================
 * MODULE 73: PENCARIAN DOKUMEN (tanpa AI)
 *
 * Satu kotak pencarian untuk isi Sumber Regulasi, Penyimpanan Berkas, dan
 * arsip Nomor Surat. Server (api/doc-search) mencari per bagian dokumen dengan
 * kata dasar Indonesia, sinonim/singkatan, dan koreksi salah ketik, lalu
 * menyusun ringkasan dari kalimat asli yang paling relevan.
 * Tidak memakai Gemini/ChatGPT: gratis, tanpa kuota, data tetap di server.
 * Dirender ke #docSearchRoot.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.__mcDocSearch) return;
    window.__mcDocSearch = true;

    var VIEW_ID = 'doc-search-view', ROOT_ID = 'docSearchRoot', RECENT_KEY = 'mc_docsearch_recent';
    var SRC = {
        regulasi: { t: 'Sumber Regulasi', i: 'fa-book-bookmark', c: '#60a5fa' },
        berkas: { t: 'Penyimpanan Berkas', i: 'fa-folder-open', c: '#f59e0b' },
        surat: { t: 'Arsip Nomor Surat', i: 'fa-envelope-open-text', c: '#a78bfa' }
    };
    var EXAMPLES = ['Berapa batas transaksi tunai yang wajib dilaporkan?', 'Kewajiban CDD nasabah', 'Sampai kapan sewa gedung berlaku?', 'Sanksi keterlambatan laporan'];
    var S = { built: false, q: '', sources: { regulasi: true, berkas: true, surat: true }, year: '', onlyValid: false, data: null, busy: false, status: null, open: {} };

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var fmtDay = function (s) { if (!s) return ''; var a = String(s).slice(0, 10).split('-'); return a.length === 3 ? (+a[2]) + ' ' + M[+a[1] - 1] + ' ' + a[0] : s; };
    function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } }
    function csrf() { var m = document.querySelector('meta[name="csrf-token"]'); return m ? m.content : ''; }

    async function api(path, method, body) {
        var request = window.authFetch || fetch;
        var res = await request('api/' + path, {
            method: method || 'GET', credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf() },
            body: body ? JSON.stringify(body) : undefined
        });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var first = out.errors ? (Object.values(out.errors)[0] || [])[0] : '';
            throw new Error(first || out.message || 'Permintaan gagal (HTTP ' + res.status + ').');
        }
        return out;
    }

    /* ---------------------------------------------------------- gaya */
    function injectStyle() {
        if ($('ds-style')) return;
        var st = document.createElement('style'); st.id = 'ds-style';
        st.textContent = [
            '.ds{--bd:var(--mc-border,rgba(148,163,184,.28));--mut:var(--mc-text-muted,#94a3b8);--pri:var(--mc-primary,#3b82f6);--card:var(--mc-card-bg,rgba(148,163,184,.05));display:grid;gap:16px}.ds *{box-sizing:border-box}',
            '.ds-head{display:flex;gap:14px;align-items:center}.ds-head .ic{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;display:grid;place-items:center;font-size:1.2rem;flex:none}',
            '.ds-head h2{margin:0;font-size:1.2rem}.ds-head p{margin:3px 0 0;color:var(--mut);font-size:.84rem;line-height:1.5}',
            '.ds-box{border:1px solid var(--bd);border-radius:16px;padding:16px;background:var(--card)}',
            '.ds-bar{display:flex;gap:8px}.ds-bar .q{flex:1;min-width:0;font-size:1rem;padding:13px 16px;border-radius:12px;border:1px solid var(--bd);background:transparent;color:inherit}',
            '.ds-bar .q:focus{outline:none;border-color:var(--pri);box-shadow:0 0 0 3px rgba(59,130,246,.2)}',
            '.ds-go{border:0;border-radius:12px;padding:0 20px;background:var(--pri);color:var(--mc-primary-contrast,#fff);font-weight:800;font-size:.92rem;cursor:pointer;display:inline-flex;align-items:center;gap:8px}.ds-go:disabled{opacity:.6;cursor:wait}',
            '.ds-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;font-size:.8rem}',
            '.ds-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--bd);border-radius:99px;padding:6px 12px;cursor:pointer;background:none;color:inherit;font:inherit;font-weight:700}',
            '.ds-chip.on{border-color:var(--pri);background:rgba(59,130,246,.14)}.ds-chip i{font-size:.85rem}',
            '.ds-filters select{border:1px solid var(--bd);border-radius:99px;padding:6px 10px;background:transparent;color:inherit;font:inherit}.ds-filters select option{color:#0f172a}',
            '.ds-filters label.ck{display:inline-flex;gap:6px;align-items:center;cursor:pointer;color:var(--mut)}',
            '.ds-ex{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ds-ex button{border:1px dashed var(--bd);background:none;color:var(--mut);border-radius:10px;padding:6px 11px;font:inherit;font-size:.8rem;cursor:pointer}.ds-ex button:hover{color:inherit;border-color:var(--pri)}',
            '.ds-ex .lbl{font-size:.74rem;color:var(--mut);width:100%}',
            '.ds-ans{border:1px solid rgba(59,130,246,.45);background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(124,58,237,.06));border-radius:16px;padding:16px 18px}',
            '.ds-ans h3{margin:0 0 10px;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--pri);display:flex;gap:8px;align-items:center}',
            '.ds-ans ol{margin:0;padding:0;list-style:none;display:grid;gap:9px}.ds-ans li{line-height:1.6;font-size:.93rem}',
            '.ds-lab{display:inline-block;min-width:26px;text-align:center;font-size:.68rem;font-weight:800;border-radius:6px;padding:1px 6px;margin-right:6px;background:var(--pri);color:#fff;cursor:pointer;vertical-align:1px}',
            '.ds-ans small{display:block;color:var(--mut);font-size:.74rem;margin-top:10px}',
            '.ds-note{font-size:.84rem;color:var(--mut)}.ds-note b{color:inherit}',
            '.ds-res{display:grid;gap:12px}',
            '.ds-card{border:1px solid var(--bd);border-radius:14px;padding:14px 16px;background:var(--card);scroll-margin-top:90px}.ds-card.flash{box-shadow:0 0 0 2px var(--pri)}',
            '.ds-ch{display:flex;gap:10px;align-items:flex-start}.ds-src{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;font-size:.9rem}',
            '.ds-ch .t{flex:1;min-width:0}.ds-ch .t b{display:block;font-size:.95rem;overflow-wrap:anywhere}.ds-ch .t > span{display:block;color:var(--mut);font-size:.76rem;margin-top:2px;overflow-wrap:anywhere}',
            '.ds-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ds-b{font-size:.68rem;font-weight:800;border-radius:99px;padding:2px 9px;background:rgba(148,163,184,.16);color:var(--mut)}.ds-b.r{background:rgba(239,68,68,.15);color:#f87171}.ds-b.a{background:rgba(245,158,11,.15);color:#fbbf24}',
            '.ds-rel{width:70px;flex:none;text-align:right;font-size:.7rem;color:var(--mut)}.ds-rel div{height:5px;border-radius:9px;background:rgba(148,163,184,.2);margin-top:4px;overflow:hidden}.ds-rel div i{display:block;height:100%;background:var(--pri)}',
            '.ds-snip{margin:10px 0 0;line-height:1.65;font-size:.88rem;white-space:pre-wrap;overflow-wrap:anywhere}',
            '.ds-card mark,.ds-ans mark{background:rgba(250,204,21,.35);color:inherit;border-radius:3px;padding:0 1px}',
            '.ds-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ds-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--bd);background:none;color:inherit;font:inherit;font-weight:700;font-size:.78rem;padding:6px 11px;border-radius:9px;cursor:pointer;text-decoration:none}.ds-btn:hover{border-color:var(--pri)}',
            '.ds-empty{text-align:center;color:var(--mut);padding:26px 12px;font-size:.88rem;line-height:1.6}.ds-empty i{display:block;font-size:1.8rem;margin-bottom:8px;opacity:.6}',
            '.ds-st summary{cursor:pointer;font-weight:800;font-size:.86rem;display:flex;align-items:center;gap:8px}.ds-st summary::-webkit-details-marker{display:none}',
            '.ds-stg{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:12px}.ds-kpi{border:1px solid var(--bd);border-radius:12px;padding:10px 12px;font-size:.8rem}.ds-kpi b{display:block;font-size:1.25rem;margin:2px 0}.ds-kpi span{color:var(--mut)}',
            '.ds-tools{margin-top:12px;display:grid;gap:6px;font-size:.8rem}.ds-tools div{display:flex;gap:8px;align-items:flex-start;line-height:1.5}.ds-tools code{background:rgba(148,163,184,.15);border-radius:6px;padding:1px 6px;font-size:.76rem}',
            '.ds-prob{margin-top:10px;max-height:220px;overflow:auto;border:1px solid var(--bd);border-radius:10px}.ds-prob div{padding:7px 10px;border-bottom:1px solid var(--bd);font-size:.78rem;line-height:1.45}.ds-prob div:last-child{border-bottom:0}.ds-prob span{color:var(--mut)}',
            '@media(max-width:640px){.ds-bar{flex-direction:column}.ds-go{justify-content:center;padding:12px}.ds-rel{display:none}}'
        ].join('\n');
        document.head.appendChild(st);
    }

    /* ---------------------------------------------------------- tampilan */
    function build() {
        var root = $(ROOT_ID); if (!root) return;
        injectStyle();
        S.built = true;
        var y = new Date().getFullYear(), years = '<option value="">Semua tahun</option>';
        for (var i = 0; i < 12; i++) years += '<option value="' + (y - i) + '">' + (y - i) + '</option>';
        root.innerHTML = '<div class="ds">' +
            '<div class="ds-head"><div class="ic"><i class="fa-solid fa-magnifying-glass-chart"></i></div><div><h2>Pencarian Dokumen</h2>' +
            '<p>Cari isi Sumber Regulasi, Penyimpanan Berkas, dan arsip Nomor Surat sekaligus. Tanpa Gemini/ChatGPT: gratis, tanpa kuota, dan jawabannya selalu kutipan asli dokumen.</p></div></div>' +
            '<div class="ds-box"><form class="ds-bar" id="dsForm" autocomplete="off"><input class="q" id="dsQ" type="search" maxlength="300" placeholder="Tulis pertanyaan atau kata kunci, misalnya: batas transaksi tunai yang wajib dilaporkan" aria-label="Pertanyaan atau kata kunci">' +
            '<button class="ds-go" id="dsGo" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Cari</button></form>' +
            '<div class="ds-filters">' + Object.keys(SRC).map(function (k) { return '<button type="button" class="ds-chip on" data-src="' + k + '"><i class="fa-solid ' + SRC[k].i + '" style="color:' + SRC[k].c + '"></i> ' + SRC[k].t + '</button>'; }).join('') +
            '<select id="dsYear" aria-label="Tahun dokumen">' + years + '</select>' +
            '<label class="ck"><input type="checkbox" id="dsValid"> Abaikan regulasi yang dicabut</label></div>' +
            '<div class="ds-ex" id="dsEx"></div></div>' +
            '<div id="dsOut"></div>' +
            '<details class="ds-box ds-st" id="dsStatus"><summary><i class="fa-solid fa-database"></i> Status indeks dokumen <span id="dsStSum" class="ds-note" style="font-weight:600"></span></summary><div id="dsStBody"><div class="ds-note" style="margin-top:10px">Memuat...</div></div></details>' +
            '</div>';
        $('dsForm').addEventListener('submit', function (e) { e.preventDefault(); run($('dsQ').value); });
        root.addEventListener('click', onClick);
        $('dsYear').addEventListener('change', function () { S.year = this.value; if (S.q) run(S.q); });
        $('dsValid').addEventListener('change', function () { S.onlyValid = this.checked; if (S.q) run(S.q); });
        renderExamples();
        loadStatus();
        setTimeout(function () { var q = $('dsQ'); if (q) q.focus(); }, 50);
    }

    function renderExamples() {
        var box = $('dsEx'); if (!box) return;
        var recent = lsGet(RECENT_KEY, []);
        box.innerHTML = (recent.length ? '<span class="lbl">Pencarian terakhir</span>' + recent.slice(0, 6).map(function (q) { return '<button type="button" data-q="' + esc(q) + '"><i class="fa-solid fa-clock-rotate-left"></i> ' + esc(q) + '</button>'; }).join('') : '') +
            '<span class="lbl">Contoh</span>' + EXAMPLES.map(function (q) { return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('');
    }

    function hl(text, terms) {
        var safe = esc(text);
        var list = (terms || []).filter(function (t) { return t && t.length >= 3; }).sort(function (a, b) { return b.length - a.length; })
            .map(function (t) { return esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
        if (!list.length) return safe;
        try {
            var re = new RegExp('([\\p{L}\\p{N}]*(?:' + list.join('|') + ')[\\p{L}\\p{N}]*)', 'giu');
            return safe.replace(re, '<mark>$1</mark>');
        } catch (e) { return safe; }
    }

    async function run(q) {
        q = String(q || '').trim();
        if (q.length < 2 || S.busy) return;
        S.q = q; S.busy = true; S.open = {};
        var input = $('dsQ'); if (input && input.value !== q) input.value = q;
        var go = $('dsGo'); if (go) { go.disabled = true; go.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mencari'; }
        $('dsOut').innerHTML = '<div class="ds-box ds-empty"><i class="fa-solid fa-spinner fa-spin"></i>Mencari di dokumen...</div>';
        var params = ['q=' + encodeURIComponent(q)];
        Object.keys(S.sources).forEach(function (k) { if (S.sources[k]) params.push('sources[]=' + k); });
        if (S.year) params.push('year=' + S.year);
        if (S.onlyValid) params.push('only_valid=1');
        try {
            S.data = await api('doc-search?' + params.join('&'));
            var recent = lsGet(RECENT_KEY, []).filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
            recent.unshift(q); lsSet(RECENT_KEY, recent.slice(0, 8)); renderExamples();
            render();
        } catch (e) {
            $('dsOut').innerHTML = '<div class="ds-box ds-empty"><i class="fa-solid fa-triangle-exclamation"></i>' + esc(e.message) + '</div>';
        } finally {
            S.busy = false;
            if (go) { go.disabled = false; go.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Cari'; }
        }
    }

    function render() {
        var d = S.data || {}, out = $('dsOut'); if (!out) return;
        var terms = d.highlight || [], html = '';
        if (d.corrections && d.corrections.length) {
            html += '<div class="ds-note" style="margin-bottom:4px"><i class="fa-solid fa-spell-check"></i> Ejaan disesuaikan: ' + d.corrections.map(function (c) { return '<s>' + esc(c.from) + '</s> → <b>' + esc(c.to) + '</b>'; }).join(', ') + '</div>';
        }
        if (!d.results || !d.results.length) {
            out.innerHTML = html + '<div class="ds-box ds-empty"><i class="fa-regular fa-folder-open"></i>' + esc(d.message || 'Tidak ada hasil.') +
                '<br>Coba kata lain yang mungkin tertulis di dokumen, kurangi filter, atau pastikan dokumennya sudah terindeks (lihat Status indeks di bawah).</div>';
            return;
        }
        if (d.answer && d.answer.length) {
            html += '<div class="ds-ans"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> Ringkasan dari dokumen</h3><ol>' + d.answer.map(function (a) {
                return '<li><span class="ds-lab" data-go="' + esc(a.label) + '" title="' + esc(a.title + (a.ref ? ' · ' + a.ref : '')) + '">' + esc(a.label) + '</span>' + hl(a.text, terms) + '</li>';
            }).join('') + '</ol><small>Kalimat di atas dikutip langsung dari dokumen (bukan disusun AI). Klik label [S] untuk melihat sumbernya.</small></div>';
        }
        html += '<div class="ds-note" style="margin:4px 2px">' + d.results.length + ' bagian paling relevan dari ' + (d.total_candidates || d.results.length) + ' kecocokan · ' + (d.took_ms || 0) + ' ms</div>';
        html += '<div class="ds-res">' + d.results.map(function (r) {
            var s = SRC[r.source] || SRC.berkas, full = !!S.open[r.label];
            var badges = '<span class="ds-b">' + esc(s.t) + '</span>' + (r.ref ? '<span class="ds-b">' + esc(r.ref) + '</span>' : '') + (r.date ? '<span class="ds-b">' + esc(fmtDay(r.date)) + '</span>' : '') +
                (r.validity === 'dicabut' ? '<span class="ds-b r">Dicabut</span>' : r.validity === 'diubah' ? '<span class="ds-b a">Diubah</span>' : '') +
                (r.expires ? '<span class="ds-b a">Berlaku s.d. ' + esc(fmtDay(r.expires)) + '</span>' : '');
            return '<div class="ds-card" id="ds-' + esc(r.label) + '"><div class="ds-ch"><div class="ds-src" style="background:' + s.c + '22;color:' + s.c + '"><i class="fa-solid ' + s.i + '"></i></div>' +
                '<div class="t"><b><span class="ds-lab" style="cursor:default">' + esc(r.label) + '</span>' + esc(r.title) + '</b><span>' + esc(r.subtitle || '') + '</span></div>' +
                '<div class="ds-rel">Relevansi ' + (r.relevance || 0) + '%<div><i style="width:' + (r.relevance || 0) + '%"></i></div></div></div>' +
                '<div class="ds-meta">' + badges + '</div>' +
                '<p class="ds-snip">' + hl(full ? r.text : r.snippet, terms) + '</p>' +
                '<div class="ds-acts"><button type="button" class="ds-btn" data-full="' + esc(r.label) + '"><i class="fa-solid ' + (full ? 'fa-compress' : 'fa-expand') + '"></i> ' + (full ? 'Ringkas' : 'Lihat bagian lengkap') + '</button>' +
                (r.open_url ? '<a class="ds-btn" href="' + esc(r.open_url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka berkas</a>' : '') +
                '<button type="button" class="ds-btn" data-copy="' + esc(r.label) + '"><i class="fa-regular fa-copy"></i> Salin kutipan</button></div></div>';
        }).join('') + '</div>';
        out.innerHTML = html;
    }

    function find(label) { return ((S.data && S.data.results) || []).filter(function (r) { return r.label === label; })[0]; }

    function onClick(e) {
        var t = e.target.closest('[data-src],[data-q],[data-go],[data-full],[data-copy],[data-act]'); if (!t) return;
        if (t.dataset.src) {
            var k = t.dataset.src, on = !S.sources[k];
            if (!on && Object.keys(S.sources).filter(function (x) { return S.sources[x]; }).length === 1) return; // minimal satu sumber
            S.sources[k] = on; t.classList.toggle('on', on); if (S.q) run(S.q);
        } else if (t.dataset.q) { run(t.dataset.q); }
        else if (t.dataset.go) {
            var card = $('ds-' + t.dataset.go); if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); card.classList.add('flash'); setTimeout(function () { card.classList.remove('flash'); }, 1600); }
        } else if (t.dataset.full) { S.open[t.dataset.full] = !S.open[t.dataset.full]; render(); var c2 = $('ds-' + t.dataset.full); if (c2) c2.scrollIntoView({ block: 'nearest' }); }
        else if (t.dataset.copy) {
            var r = find(t.dataset.copy); if (!r) return;
            var txt = r.text + '\n\n— ' + r.title + (r.ref ? ', ' + r.ref : '') + (r.subtitle ? ' (' + r.subtitle + ')' : '');
            if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { t.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin'; }, function () { /* abaikan */ });
        } else if (t.dataset.act === 'reindex') reindex(t);
    }

    /* ---------------------------------------------------------- status indeks */
    var LBL = { ready: 'siap', pending: 'menunggu', needs_ocr: 'perlu OCR', empty: 'tanpa teks', unsupported: 'format belum didukung', missing: 'berkas hilang', error: 'gagal' };
    async function loadStatus() {
        try { S.status = await api('doc-search/status'); } catch (e) { S.status = { error: e.message }; }
        renderStatus();
    }
    function sum(obj) { return Object.keys(obj || {}).reduce(function (s, k) { return s + (obj[k] || 0); }, 0); }
    function renderStatus() {
        var st = S.status || {}, body = $('dsStBody'), head = $('dsStSum'); if (!body) return;
        if (st.error) { body.innerHTML = '<div class="ds-note" style="margin-top:10px">' + esc(st.error) + '</div>'; return; }
        if (!st.ready) { body.innerHTML = '<div class="ds-note" style="margin-top:10px">Tabel indeks belum dibuat. Jalankan <code>php artisan migrate --force</code> di server.</div>'; return; }
        var f = st.files || {}, reg = st.regulasi || {}, tools = st.tools || {};
        var ready = (reg.ready || 0) + ((f.berkas || {}).ready || 0) + ((f.surat || {}).ready || 0);
        var waiting = ((f.berkas || {}).pending || 0) + ((f.surat || {}).pending || 0) + ((f.berkas || {}).needs_ocr || 0) + ((f.surat || {}).needs_ocr || 0);
        if (head) head.textContent = '· ' + ready + ' dokumen siap dicari' + (waiting ? ', ' + waiting + ' menunggu' : '');
        var kpi = function (key, total, map) {
            var s = SRC[key];
            var rest = Object.keys(map || {}).filter(function (k) { return k !== 'ready' && map[k]; }).map(function (k) { return map[k] + ' ' + (LBL[k] || k); }).join(', ');
            return '<div class="ds-kpi"><span><i class="fa-solid ' + s.i + '" style="color:' + s.c + '"></i> ' + s.t + '</span><b>' + ((map || {}).ready || 0) + ' <small style="font-size:.7rem;font-weight:600;color:var(--mut)">dari ' + total + ' siap</small></b><span>' + esc(rest || 'semua terbaca') + '</span></div>';
        };
        var regMap = { ready: reg.ready || 0, needs_ocr: reg.needs_text || 0, pending: reg.pending || 0 };
        var html = '<div class="ds-stg">' + kpi('regulasi', sum(reg), regMap) + kpi('berkas', sum(f.berkas), f.berkas) + kpi('surat', sum(f.surat), f.surat) + '</div>';
        html += '<div class="ds-tools">' +
            '<div><i class="fa-solid ' + (tools.pdftotext ? 'fa-circle-check" style="color:#34d399' : 'fa-circle-xmark" style="color:#f87171') + '"></i><span><b>Pembaca PDF</b> ' + (tools.pdftotext ? 'aktif.' : 'belum terpasang. Di server Ubuntu jalankan <code>sudo apt install poppler-utils</code>.') + '</span></div>' +
            '<div><i class="fa-solid ' + (tools.tesseract ? 'fa-circle-check" style="color:#34d399' : 'fa-circle-info" style="color:#94a3b8') + '"></i><span><b>OCR dokumen hasil scan/foto</b> ' + (tools.tesseract
                ? 'aktif (' + esc(tools.ocr_langs || '') + '). Berjalan otomatis di latar belakang dengan prioritas rendah.'
                : 'tidak aktif (opsional). Untuk membaca scan/foto: <code>sudo apt install tesseract-ocr tesseract-ocr-ind poppler-utils</code>.') + '</span></div>' +
            '<div><i class="fa-regular fa-clock" style="color:#94a3b8"></i><span>Indeks diperbarui otomatis tiap 5 menit' + (st.last_run && st.last_run.at ? ' · terakhir ' + esc(new Date(st.last_run.at).toLocaleString('id-ID')) : '') + '.</span></div>' +
            '</div><div class="ds-acts"><button type="button" class="ds-btn" data-act="reindex"><i class="fa-solid fa-rotate"></i> Perbarui indeks sekarang</button></div>';
        var probs = st.problems || [];
        if (probs.length) {
            html += '<div class="ds-note" style="margin-top:12px"><b>Berkas yang belum bisa dicari (' + probs.length + ')</b></div><div class="ds-prob">' + probs.map(function (p) {
                return '<div><b>' + esc(p.title) + '</b> <span>· ' + esc((SRC[p.source] || {}).t || p.source) + ' · ' + esc(LBL[p.status] || p.status) + '</span><br><span>' + esc(p.error || '') + '</span></div>';
            }).join('') + '</div>';
        }
        body.innerHTML = html;
    }
    async function reindex(btn) {
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memperbarui indeks...';
        try {
            var r = await api('doc-search/reindex', 'POST', {});
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ' + esc(r.message || 'Selesai');
            await loadStatus();
        } catch (e) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Coba lagi'; alert(e.message); }
    }

    /* ---------------------------------------------------------- siklus hidup */
    function visible() { var v = $(VIEW_ID); return !!v && !v.classList.contains('hidden') && v.offsetParent !== null; }
    window.loadDocSearch = function () { if (!$(ROOT_ID)) return; if (!S.built || !$('dsForm')) build(); else loadStatus(); };
    var was = false;
    setInterval(function () { var now = visible(); if (now && !was) window.loadDocSearch(); was = now; }, 1000);
})();
