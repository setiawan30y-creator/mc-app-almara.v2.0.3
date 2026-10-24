/* =====================================================================
 * 40-pickup.js  —  Serah Terima / Pickup valas oleh kurir (gaya ojol)
 *
 *  Alur : Ditugaskan -> Dalam Perjalanan (valas ditahan kurir) -> Diserahkan (PIN) -> Selesai
 *  Staf : buat penugasan, pantau kurir di peta realtime, selesaikan (catat penjualan + kas/bank), batalkan.
 *  Kurir: mulai perjalanan, lokasi GPS dikirim otomatis, serahkan ke penerima dengan PIN + foto.
 *  Data : MySQL lewat /api/pickups (stok, transaksi, ledger diproses di server).
 *  Peta : Leaflet + OpenStreetMap (tanpa API key). Tombol "Google Maps" membuka navigasi / posisi kurir.
 * ===================================================================== */
(function () {
    'use strict';

    var POLL_MS = 5000;
    var GPS_MIN_MS = 5000;
    var STATUS = {
        REQUESTED: { label: 'Ditugaskan', tone: 'warn', icon: 'fa-hourglass-half' },
        ON_THE_WAY: { label: 'Dalam Perjalanan', tone: 'info', icon: 'fa-motorcycle' },
        DELIVERED: { label: 'Diserahkan', tone: 'pri', icon: 'fa-hand-holding-dollar' },
        COMPLETED: { label: 'Selesai', tone: 'ok', icon: 'fa-circle-check' },
        CANCELLED: { label: 'Dibatalkan', tone: 'bad', icon: 'fa-ban' },
        RETURNED: { label: 'Dikembalikan', tone: 'bad', icon: 'fa-rotate-left' }
    };
    var STEPS = ['REQUESTED', 'ON_THE_WAY', 'DELIVERED', 'COMPLETED'];

    var S = {
        data: [], history: [], custody: [], couriers: [], tab: 'active', selected: null, detail: null,
        loaded: false, loading: false, error: '', timer: null, statuses: {}, firstPoll: true,
        map: null, mapEl: null, layers: {}, leafletP: null, fitFor: null,
        watchId: null, lastSent: 0, geoError: '', wake: null
    };

    var $ = function (id) { return document.getElementById(id); };
    var nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
    var nfi = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var rp = function (n) { return 'Rp ' + nfi.format(Math.round(Number(n) || 0)); };
    var num = function (v) { var n = parseFloat(String(v == null ? '' : v).trim().replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };

    function me() { try { return JSON.parse(localStorage.getItem('mc_currentUser')) || {}; } catch (e) { return {}; } }
    function isCourier() { return String(me().role || '').toLowerCase() === 'kurir'; }

    function cssVar(name, fb) { try { return getComputedStyle(document.body).getPropertyValue(name).trim() || fb; } catch (e) { return fb; } }
    function swalOpts(extra) {
        return Object.assign({
            background: cssVar('--mc-card-bg', '#1e293b'), color: cssVar('--mc-text', '#f8fafc'),
            confirmButtonColor: cssVar('--mc-primary', '#22c55e'), cancelButtonColor: cssVar('--mc-secondary', '#64748b')
        }, extra || {});
    }
    function toast(icon, title) {
        if (window.Swal) window.Swal.fire(swalOpts({ icon: icon, title: title, toast: true, position: 'top-end', timer: 3200, showConfirmButton: false }));
        else alert(title);
    }
    function confirmBox(o) {
        if (!window.Swal) return Promise.resolve(window.confirm(o.text || o.title));
        return window.Swal.fire(swalOpts({ icon: o.icon || 'question', title: o.title, text: o.text, showCancelButton: true, confirmButtonText: o.confirmText || 'Ya', cancelButtonText: 'Batal' }))
            .then(function (r) { return !!r.isConfirmed; });
    }

    function ago(iso) {
        if (!iso) return '-';
        var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
        if (s < 15) return 'baru saja';
        if (s < 60) return s + ' detik lalu';
        if (s < 3600) return Math.round(s / 60) + ' menit lalu';
        if (s < 86400) return Math.round(s / 3600) + ' jam lalu';
        return Math.round(s / 86400) + ' hari lalu';
    }
    function dt(iso) { return iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; }
    function isToday(iso) { return iso && new Date(iso).toDateString() === new Date().toDateString(); }

    async function api(path, opts) {
        var o = Object.assign({}, opts || {});
        if (o.body && typeof o.body !== 'string') {
            o.body = JSON.stringify(o.body);
            o.headers = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, o.headers || {});
        }
        var res = await window.authFetch(path, o);
        var json = await res.json().catch(function () { return {}; });
        if (!res.ok || json.status === 'error') {
            var first = json.errors ? Object.values(json.errors).flat()[0] : null;
            throw new Error(first || json.message || ('Permintaan gagal (HTTP ' + res.status + ').'));
        }
        return json;
    }

    // ------------------------------------------------------------ gaya
    function injectStyle() {
        if ($('pk-style')) return;
        var st = document.createElement('style');
        st.id = 'pk-style';
        st.textContent = [
            '.pk-root,.pk-overlay{--pk-bd:var(--mc-border,rgba(148,163,184,.28));--pk-card:var(--mc-card-bg,#18181b);--pk-tx:var(--mc-text,#fafafa);--pk-mut:var(--mc-text-muted,#a1a1aa);',
            '--pk-pri:var(--mc-primary,#22c55e);--pk-ok:var(--mc-buy,#22c55e);--pk-bad:var(--mc-danger,#ef4444);--pk-warn:var(--mc-warning,#f59e0b);--pk-info:var(--mc-info,#38bdf8);',
            '--pk-inp:var(--mc-input-bg,rgba(148,163,184,.08));--pk-r:var(--mc-radius,14px);color:var(--pk-tx);}',
            '.pk-root *,.pk-overlay *{box-sizing:border-box}',
            '.pk-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px}',
            '.pk-head h2{margin:0;font-size:1.25rem}.pk-head p{margin:4px 0 0;color:var(--pk-mut);font-size:.85rem}',
            '.pk-btn{border:1px solid var(--pk-bd);background:transparent;color:var(--pk-tx);padding:8px 14px;border-radius:var(--mc-btn-radius,10px);cursor:pointer;font-weight:600;font-size:.85rem;display:inline-flex;align-items:center;gap:8px;text-decoration:none}',
            '.pk-btn:hover{background:var(--pk-inp)}.pk-btn[disabled]{opacity:.55;cursor:not-allowed}',
            '.pk-btn.pri{background:var(--pk-pri);border-color:var(--pk-pri);color:#fff}.pk-btn.pri:hover{filter:brightness(1.08)}',
            '.pk-btn.bad{color:var(--pk-bad);border-color:color-mix(in srgb,var(--pk-bad) 45%,transparent)}',
            '.pk-btn.sm{padding:5px 10px;font-size:.78rem}.pk-btn.block{width:100%;justify-content:center;padding:11px 14px}',
            '.pk-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px}',
            '.pk-stat{background:var(--pk-card);border:1px solid var(--pk-bd);border-radius:var(--pk-r);padding:14px 16px}',
            '.pk-stat small{color:var(--pk-mut);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}',
            '.pk-stat b{display:block;font-size:1.5rem;margin-top:4px}.pk-stat .chips{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}',
            '.pk-chip{background:var(--pk-inp);border:1px solid var(--pk-bd);border-radius:999px;padding:2px 9px;font-size:.75rem}',
            '.pk-tabs{display:flex;gap:6px;margin-bottom:12px}',
            '.pk-tab{padding:7px 14px;border-radius:999px;border:1px solid var(--pk-bd);background:transparent;color:var(--pk-mut);cursor:pointer;font-weight:600;font-size:.82rem}',
            '.pk-tab.on{background:var(--pk-pri);border-color:var(--pk-pri);color:#fff}',
            '.pk-main{display:grid;grid-template-columns:minmax(300px,400px) 1fr;gap:16px;align-items:start}',
            '@media(max-width:980px){.pk-main{grid-template-columns:1fr}}',
            '.pk-list{display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 330px);min-height:120px;overflow:auto;padding-right:2px}',
            '.pk-card{background:var(--pk-card);border:1px solid var(--pk-bd);border-radius:var(--pk-r);padding:12px 14px;cursor:pointer;transition:border-color .15s}',
            '.pk-card:hover{border-color:var(--pk-pri)}.pk-card.sel{border-color:var(--pk-pri);box-shadow:0 0 0 1px var(--pk-pri)}',
            '.pk-card .top{display:flex;justify-content:space-between;gap:8px;align-items:center}.pk-card .no{font-weight:700;font-size:.85rem}',
            '.pk-card .row{color:var(--pk-mut);font-size:.8rem;margin-top:6px;display:flex;gap:6px;align-items:flex-start}.pk-card .row i{margin-top:2px;width:14px;text-align:center}',
            '.pk-card .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
            '.pk-badge{font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;display:inline-flex;gap:5px;align-items:center;white-space:nowrap}',
            '.pk-badge.warn{background:color-mix(in srgb,var(--pk-warn) 18%,transparent);color:var(--pk-warn)}',
            '.pk-badge.info{background:color-mix(in srgb,var(--pk-info) 18%,transparent);color:var(--pk-info)}',
            '.pk-badge.pri,.pk-badge.ok{background:color-mix(in srgb,var(--pk-ok) 18%,transparent);color:var(--pk-ok)}',
            '.pk-badge.bad{background:color-mix(in srgb,var(--pk-bad) 18%,transparent);color:var(--pk-bad)}',
            '.pk-panel{background:var(--pk-card);border:1px solid var(--pk-bd);border-radius:var(--pk-r);overflow:hidden}',
            '#pkMap{height:380px;width:100%;background:var(--pk-inp);z-index:0}',
            '.pk-mapbar{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--pk-bd);font-size:.82rem;color:var(--pk-mut)}',
            '.pk-detail{padding:16px}.pk-detail h3{margin:0;font-size:1.05rem}',
            '.pk-steps{display:flex;margin:14px 0;gap:4px}.pk-step{flex:1;text-align:center;font-size:.7rem;color:var(--pk-mut)}',
            '.pk-step i{display:flex;margin:0 auto 4px;width:30px;height:30px;border-radius:50%;border:2px solid var(--pk-bd);align-items:center;justify-content:center;font-size:.8rem}',
            '.pk-step.done i{background:var(--pk-pri);border-color:var(--pk-pri);color:#fff}.pk-step.cur i{border-color:var(--pk-pri);color:var(--pk-pri)}.pk-step.done,.pk-step.cur{color:var(--pk-tx)}',
            '.pk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:12px 0}',
            '.pk-kv small{display:block;color:var(--pk-mut);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}.pk-kv span{font-size:.88rem;word-break:break-word}',
            '.pk-tbl{width:100%;border-collapse:collapse;font-size:.83rem}.pk-tbl th,.pk-tbl td{padding:8px 10px;border-bottom:1px solid var(--pk-bd);text-align:left}',
            '.pk-tbl th{color:var(--pk-mut);font-size:.72rem;text-transform:uppercase}.pk-tbl .r{text-align:right}',
            '.pk-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
            '.pk-time{list-style:none;margin:12px 0 0;padding:0;border-left:2px solid var(--pk-bd)}',
            '.pk-time li{position:relative;padding:0 0 10px 14px;font-size:.8rem}.pk-time li:before{content:"";position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--pk-pri)}',
            '.pk-time small{color:var(--pk-mut)}',
            '.pk-empty{padding:34px 16px;text-align:center;color:var(--pk-mut);background:var(--pk-card);border:1px dashed var(--pk-bd);border-radius:var(--pk-r)}',
            '.pk-alert{padding:10px 14px;border-radius:10px;font-size:.82rem;margin-bottom:12px;border:1px solid var(--pk-bd)}',
            '.pk-alert.warn{background:color-mix(in srgb,var(--pk-warn) 12%,transparent);border-color:color-mix(in srgb,var(--pk-warn) 40%,transparent)}',
            '.pk-alert.bad{background:color-mix(in srgb,var(--pk-bad) 12%,transparent);border-color:color-mix(in srgb,var(--pk-bad) 40%,transparent)}',
            '.pk-pin{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.95rem;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)}',
            '.pk-pin.courier{background:#2563eb}.pk-pin.stale{background:#64748b}.pk-pin.dest{background:#ef4444}',
            '.pk-pulse{animation:pkPulse 1.8s infinite}@keyframes pkPulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,.55)}70%{box-shadow:0 0 0 14px rgba(37,99,235,0)}100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}}',
            '.pk-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10050;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}',
            '.pk-modal{background:var(--pk-card);border:1px solid var(--pk-bd);border-radius:var(--pk-r);width:100%;max-width:640px;box-shadow:0 20px 50px rgba(0,0,0,.45)}',
            '.pk-modal header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--pk-bd)}',
            '.pk-modal header h3{margin:0;font-size:1.05rem}.pk-modal .body{padding:16px 18px;display:grid;gap:12px}.pk-modal footer{padding:12px 18px;border-top:1px solid var(--pk-bd);display:flex;gap:8px;justify-content:flex-end}',
            '.pk-f label{display:block;font-size:.75rem;color:var(--pk-mut);margin-bottom:4px;font-weight:600}',
            '.pk-f input,.pk-f select,.pk-f textarea{width:100%;background:var(--pk-inp);border:1px solid var(--mc-input-border,var(--pk-bd));color:var(--pk-tx);border-radius:var(--mc-input-radius,10px);padding:9px 11px;font:inherit}',
            '.pk-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.pk-2{grid-template-columns:1fr}}',
            '.pk-item{display:grid;grid-template-columns:1.1fr 1.2fr 1.3fr auto;gap:8px;align-items:end}',
            '#pkPickMap{height:230px;border-radius:10px;border:1px solid var(--pk-bd);margin-top:6px}',
            '.pk-pinbox{text-align:center;padding:18px 0}.pk-pinbox b{font-size:2.6rem;letter-spacing:.4em;padding-left:.4em}',
            '.pk-photo img{max-width:100%;max-height:170px;border-radius:10px;border:1px solid var(--pk-bd);margin-top:8px;display:block}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ------------------------------------------------------------ peta
    function ensureLeaflet() {
        if (window.L && window.L.map) return Promise.resolve(window.L);
        if (S.leafletP) return S.leafletP;
        S.leafletP = new Promise(function (resolve, reject) {
            var css = document.createElement('link');
            css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(css);
            var js = document.createElement('script');
            js.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
            js.onload = function () { resolve(window.L); };
            js.onerror = function () { S.leafletP = null; reject(new Error('Peta gagal dimuat (cek koneksi internet).')); };
            document.head.appendChild(js);
        });
        return S.leafletP;
    }
    function newMap(el, center, zoom) {
        var map = window.L.map(el, { zoomControl: true }).setView(center || [-6.2, 106.816], zoom || 12);
        window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
        return map;
    }
    function icon(cls, fa) {
        return window.L.divIcon({ className: '', html: '<div class="pk-pin ' + cls + '"><i class="fa-solid ' + fa + '"></i></div>', iconSize: [34, 34], iconAnchor: [17, 17] });
    }
    function fresh(p) { return p.last && p.last.at && (Date.now() - new Date(p.last.at).getTime()) < 90000; }

    function mapsLinkDest(p) {
        if (p.dest_lat != null) return 'https://www.google.com/maps/dir/?api=1&destination=' + p.dest_lat + ',' + p.dest_lng;
        return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.destination || '');
    }
    function mapsLinkCourier(p) { return p.last ? 'https://www.google.com/maps?q=' + p.last.lat + ',' + p.last.lng : '#'; }

    async function renderMap() {
        var el = $('pkMap');
        if (!el) return;
        try { await ensureLeaflet(); } catch (e) { el.innerHTML = '<div class="pk-empty" style="margin:14px">' + esc(e.message) + '</div>'; return; }
        if (S.map && S.mapEl !== el) { try { S.map.remove(); } catch (e) {} S.map = null; S.layers = {}; }
        if (!S.map) { S.map = newMap(el); S.mapEl = el; S.layers = {}; setTimeout(function () { S.map && S.map.invalidateSize(); }, 80); }
        var L = window.L, map = S.map, keep = {};
        map.invalidateSize();
        var pool = S.data.filter(function (p) { return p.status === 'ON_THE_WAY' || (S.selected === p.id && p.status !== 'COMPLETED'); });
        var bounds = [];
        pool.forEach(function (p) {
            if (p.last) {
                var k = 'c' + p.id, ll = [p.last.lat, p.last.lng], stale = !fresh(p);
                keep[k] = true; bounds.push(ll);
                var tip = esc(p.courier_name) + ' · ' + esc(p.pickup_no) + '<br><small>' + (stale ? 'Sinyal terakhir ' : 'Diperbarui ') + ago(p.last.at) + '</small>';
                if (S.layers[k]) { S.layers[k].setLatLng(ll).setIcon(icon('courier' + (stale ? ' stale' : ' pk-pulse'), 'fa-motorcycle')).setTooltipContent(tip); }
                else { S.layers[k] = L.marker(ll, { icon: icon('courier' + (stale ? ' stale' : ' pk-pulse'), 'fa-motorcycle') }).addTo(map).bindTooltip(tip).on('click', function () { select(p.id); }); }
            }
            if (p.dest_lat != null) {
                var kd = 'd' + p.id; keep[kd] = true; bounds.push([p.dest_lat, p.dest_lng]);
                if (!S.layers[kd]) S.layers[kd] = L.marker([p.dest_lat, p.dest_lng], { icon: icon('dest', 'fa-location-dot') }).addTo(map).bindTooltip('Tujuan: ' + esc(p.destination));
            }
        });
        var track = S.detail && S.detail.id === S.selected ? (S.detail.track || []) : [];
        if (track.length > 1) {
            keep.trk = true;
            var pts = track.map(function (t) { return [t[0], t[1]]; });
            if (S.layers.trk) S.layers.trk.setLatLngs(pts); else S.layers.trk = L.polyline(pts, { color: '#2563eb', weight: 4, opacity: .75 }).addTo(map);
        }
        Object.keys(S.layers).forEach(function (k) { if (!keep[k]) { map.removeLayer(S.layers[k]); delete S.layers[k]; } });
        if (S.fitFor !== (S.selected || 'all') && bounds.length) {
            S.fitFor = S.selected || 'all';
            if (bounds.length === 1) map.setView(bounds[0], 15); else map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }
        var bar = $('pkMapInfo');
        if (bar) {
            var on = S.data.filter(function (p) { return p.status === 'ON_THE_WAY'; });
            bar.textContent = on.length ? on.length + ' kurir sedang di jalan' : 'Belum ada kurir di jalan';
        }
    }

    // --------------------------------------------------------- tampilan
    function shell() {
        var root = $('pickupRoot');
        if (!root) return false;
        if (root.dataset.ready === '1') return true;
        var courier = isCourier();
        root.className = 'pk-root';
        root.innerHTML =
            '<div class="pk-head"><div><h2><i class="fa-solid fa-motorcycle"></i> Serah Terima / Pickup Valas</h2>' +
            '<p>' + (courier ? 'Tugas pengantaran valas Anda. Lokasi dikirim otomatis selama perjalanan.' : 'Valas yang dibawa kurir ditahan di stok kurir sampai serah terima selesai. Pantau posisi kurir secara realtime.') + '</p></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pk-btn" data-pk="help" title="Cara pakai" aria-label="Cara pakai"><i class="fa-solid fa-circle-question"></i> Cara pakai</button>' +
            (courier ? '' : '<button class="pk-btn" data-pk="trackers"><i class="fa-solid fa-satellite-dish"></i> Pelacak GPS</button><button class="pk-btn pri" data-pk="new"><i class="fa-solid fa-plus"></i> Pickup Baru</button>') + '</div></div>' +
            '<div id="pkAlerts"></div><div class="pk-stats" id="pkStats"></div>' +
            '<div class="pk-tabs"><button class="pk-tab on" data-pk="tab" data-t="active">Aktif</button><button class="pk-tab" data-pk="tab" data-t="history">Riwayat</button></div>' +
            '<div id="pkBody"></div>';
        root.dataset.ready = '1';
        return true;
    }

    function chips(items) {
        return (items || []).map(function (i) { return '<span class="pk-chip">' + esc(i.currency_code) + ' ' + nf.format(i.amount) + '</span>'; }).join('');
    }
    function badge(st) {
        var m = STATUS[st] || { label: st, tone: 'warn', icon: 'fa-circle' };
        return '<span class="pk-badge ' + m.tone + '"><i class="fa-solid ' + m.icon + '"></i> ' + esc(m.label) + '</span>';
    }

    function renderAlerts() {
        var el = $('pkAlerts'); if (!el) return;
        var html = '';
        if (S.error) html += '<div class="pk-alert bad">' + esc(S.error) + '</div>';
        if (isCourier()) {
            if (!window.isSecureContext) html += '<div class="pk-alert warn"><b>GPS butuh HTTPS.</b> Buka aplikasi lewat alamat https:// (atau localhost) agar lokasi kurir dapat dikirim.</div>';
            else if (S.geoError) html += '<div class="pk-alert warn">' + esc(S.geoError) + '</div>';
        }
        el.innerHTML = html;
    }

    function renderStats() {
        var el = $('pkStats'); if (!el) return;
        var active = S.data.length;
        var onWay = S.data.filter(function (p) { return p.status === 'ON_THE_WAY'; }).length;
        var wait = S.data.filter(function (p) { return p.status === 'DELIVERED'; }).length;
        var done = S.history.filter(function (p) { return p.status === 'COMPLETED' && isToday(p.completed_at); }).length;
        var h = '<div class="pk-stat"><small>Penugasan aktif</small><b>' + active + '</b></div>' +
            '<div class="pk-stat"><small>Di jalan</small><b>' + onWay + '</b></div>';
        if (!isCourier()) {
            h += '<div class="pk-stat"><small>Valas dibawa kurir</small>' +
                (S.custody.length ? '<div class="chips">' + S.custody.map(function (c) { return '<span class="pk-chip">' + esc(c.code) + ' ' + nf.format(c.amount) + '</span>'; }).join('') + '</div>' : '<b>-</b>') + '</div>';
        }
        h += '<div class="pk-stat"><small>Menunggu penyelesaian</small><b>' + wait + '</b></div><div class="pk-stat"><small>Selesai hari ini</small><b>' + done + '</b></div>';
        el.innerHTML = h;
    }

    function cardHtml(p) {
        return '<div class="pk-card' + (S.selected === p.id ? ' sel' : '') + '" data-pk="sel" data-id="' + p.id + '">' +
            '<div class="top"><span class="no">' + esc(p.pickup_no) + '</span>' + badge(p.status) + '</div>' +
            '<div class="row"><i class="fa-solid fa-user"></i><span>' + esc(p.courier_name) + (p.vehicle_plate ? ' · ' + esc(p.vehicle_plate) : '') + '</span></div>' +
            '<div class="row"><i class="fa-solid fa-location-dot"></i><span>' + esc(p.destination) + '</span></div>' +
            '<div class="chips">' + chips(p.items) + '</div>' +
            '<div class="row"><i class="fa-solid fa-clock"></i><span>' + rp(p.realized_total_idr || p.estimated_total_idr) + ' · ' + ago(p.created_at) + '</span></div></div>';
    }

    function renderBody() {
        var el = $('pkBody'); if (!el) return;
        if (S.tab === 'history') {
            var rows = S.history.map(function (p) {
                return '<tr><td>' + esc(p.pickup_no) + '</td><td>' + dt(p.completed_at || p.cancelled_at || p.created_at) + '</td><td>' + esc(p.courier_name) + '</td><td>' + esc(p.destination) + '</td>' +
                    '<td>' + chips(p.items) + '</td><td class="r">' + rp(p.realized_total_idr || p.estimated_total_idr) + '</td><td>' + (p.invoice_no ? esc(p.invoice_no) : '-') + '</td><td>' + badge(p.status) + '</td>' +
                    '<td><button class="pk-btn sm" data-pk="hist" data-id="' + p.id + '">Detail</button></td></tr>';
            }).join('');
            el.innerHTML = '<div class="pk-panel" style="overflow:auto">' + (rows ?
                '<table class="pk-tbl"><thead><tr><th>No. Pickup</th><th>Waktu</th><th>Kurir</th><th>Tujuan</th><th>Valas</th><th class="r">Total</th><th>Invoice</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
                : '<div class="pk-empty" style="border:0">Belum ada riwayat pickup.</div>') + '</div>';
            return;
        }
        if (!$('pkMap')) {
            el.innerHTML = '<div class="pk-main"><div class="pk-list" id="pkList"></div><div><div class="pk-panel"><div class="pk-mapbar"><span id="pkMapInfo"></span>' +
                '<span>Peta: OpenStreetMap</span></div><div id="pkMap"></div></div><div class="pk-panel" style="margin-top:14px" id="pkDetail"></div></div></div>';
        }
        var list = $('pkList');
        list.innerHTML = S.data.length ? S.data.map(cardHtml).join('') :
            '<div class="pk-empty"><i class="fa-solid fa-motorcycle" style="font-size:1.8rem;display:block;margin-bottom:8px"></i>' + (isCourier() ? 'Belum ada tugas untuk Anda.' : 'Belum ada pickup aktif. Klik <b>Pickup Baru</b> untuk menugaskan kurir.') + '</div>';
        renderDetail();
        renderMap();
    }

    function actionsFor(p) {
        var b = [], c = isCourier();
        if (c) {
            if (p.status === 'REQUESTED') b.push('<button class="pk-btn pri" data-pk="start" data-id="' + p.id + '"><i class="fa-solid fa-play"></i> Mulai Perjalanan</button>');
            if (p.status === 'ON_THE_WAY') {
                b.push('<button class="pk-btn pri" data-pk="deliver" data-id="' + p.id + '"><i class="fa-solid fa-hand-holding-dollar"></i> Serahkan ke Penerima</button>');
                b.push('<a class="pk-btn" target="_blank" rel="noopener" href="' + esc(mapsLinkDest(p)) + '"><i class="fa-brands fa-google"></i> Navigasi Google Maps</a>');
            }
        } else {
            if (p.status === 'DELIVERED') b.push('<button class="pk-btn pri" data-pk="complete" data-id="' + p.id + '"><i class="fa-solid fa-square-check"></i> Selesaikan & Catat Penjualan</button>');
            if (p.status === 'REQUESTED' || p.status === 'ON_THE_WAY') {
                b.push('<button class="pk-btn" data-pk="pin" data-id="' + p.id + '"><i class="fa-solid fa-key"></i> Reset PIN</button>');
                b.push('<button class="pk-btn bad" data-pk="cancel" data-id="' + p.id + '"><i class="fa-solid fa-ban"></i> ' + (p.status === 'ON_THE_WAY' ? 'Tarik Kembali' : 'Batalkan') + '</button>');
            }
            if (p.last) b.push('<a class="pk-btn" target="_blank" rel="noopener" href="' + esc(mapsLinkCourier(p)) + '"><i class="fa-brands fa-google"></i> Posisi di Google Maps</a>');
        }
        return b.join('');
    }

    function renderDetail() {
        var el = $('pkDetail'); if (!el) return;
        var p = S.selected ? (S.detail && S.detail.id === S.selected ? S.detail : S.data.find(function (x) { return x.id === S.selected; })) : null;
        if (!p) { el.innerHTML = '<div class="pk-empty" style="border:0">Pilih pickup di daftar untuk melihat detail dan posisi kurir.</div>'; return; }
        var idx = STEPS.indexOf(p.status);
        var steps = STEPS.map(function (s, i) {
            var cls = idx > i || p.status === 'COMPLETED' ? 'done' : idx === i ? 'cur' : '';
            return '<div class="pk-step ' + cls + '"><i class="fa-solid ' + STATUS[s].icon + '"></i>' + STATUS[s].label + '</div>';
        }).join('');
        var itemsRows = (p.items || []).map(function (i) {
            var rate = i.realized_rate || i.estimated_rate, tot = i.realized_total || i.estimated_total;
            return '<tr><td>' + esc(i.currency_code) + '</td><td class="r">' + nf.format(i.amount) + '</td><td class="r">' + nf.format(rate) + '</td><td class="r">' + rp(tot) + '</td></tr>';
        }).join('');
        var sig = p.last ? (fresh(p) ? '<span style="color:var(--pk-ok)">● Online</span> · ' : '<span style="color:var(--pk-warn)">● Sinyal lemah</span> · ') + ago(p.last.at) + (p.last.speed ? ' · ' + Math.round(p.last.speed * 3.6) + ' km/jam' : '') : '-';
        var ev = (p.events || []).slice().reverse().map(function (e) {
            return '<li><b>' + esc((STATUS[e.status] || {}).label || e.status) + '</b> · ' + esc(e.actor || '') + '<br><small>' + dt(e.at) + (e.note ? ' · ' + esc(e.note) : '') + '</small></li>';
        }).join('');
        el.innerHTML = '<div class="pk-detail"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><h3>' + esc(p.pickup_no) + '</h3>' + badge(p.status) + '</div>' +
            '<div class="pk-steps">' + steps + '</div>' +
            '<div class="pk-grid">' +
            '<div class="pk-kv"><small>Kurir</small><span>' + esc(p.courier_name) + (p.vehicle_type ? ' · ' + esc(p.vehicle_type) : '') + (p.vehicle_plate ? ' ' + esc(p.vehicle_plate) : '') + '</span></div>' +
            '<div class="pk-kv"><small>Sinyal GPS</small><span>' + sig + '</span></div>' +
            '<div class="pk-kv"><small>Tujuan</small><span>' + esc(p.destination) + ' <a href="' + esc(mapsLinkDest(p)) + '" target="_blank" rel="noopener">buka peta</a></span></div>' +
            '<div class="pk-kv"><small>Pelanggan</small><span>' + esc(p.customer_name || '-') + (p.customer_phone ? ' · <a href="tel:' + esc(p.customer_phone) + '">' + esc(p.customer_phone) + '</a>' : '') + '</span></div>' +
            (p.recipient_name ? '<div class="pk-kv"><small>Diterima oleh</small><span>' + esc(p.recipient_name) + '</span></div>' : '') +
            (p.invoice_no ? '<div class="pk-kv"><small>Invoice</small><span>' + esc(p.invoice_no) + ' · ' + esc(p.settle_to === 'CASH' ? 'Tunai' : 'Bank ' + p.settle_to) + '</span></div>' : '') +
            (p.cancel_reason ? '<div class="pk-kv"><small>Alasan</small><span>' + esc(p.cancel_reason) + '</span></div>' : '') +
            (p.pin_locked ? '<div class="pk-kv"><small>PIN</small><span style="color:var(--pk-bad)">Terkunci — reset oleh staf</span></div>' : '') +
            '</div>' + (p.notes ? '<div class="pk-kv"><small>Catatan</small><span>' + esc(p.notes) + '</span></div>' : '') +
            '<table class="pk-tbl" style="margin-top:10px"><thead><tr><th>Valas</th><th class="r">Jumlah</th><th class="r">Kurs</th><th class="r">Total</th></tr></thead><tbody>' + itemsRows +
            '<tr><td colspan="3"><b>Total</b></td><td class="r"><b>' + rp(p.realized_total_idr || p.estimated_total_idr) + '</b></td></tr></tbody></table>' +
            ((p.photo_pickup || p.photo_proof) ? '<div class="pk-actions">' + (p.photo_pickup ? '<a class="pk-btn sm" target="_blank" rel="noopener" href="' + esc(p.photo_pickup) + '">Foto pengambilan</a>' : '') + (p.photo_proof ? '<a class="pk-btn sm" target="_blank" rel="noopener" href="' + esc(p.photo_proof) + '">Foto bukti serah</a>' : '') + '</div>' : '') +
            '<div class="pk-actions">' + actionsFor(p) + '</div>' +
            (ev ? '<ul class="pk-time">' + ev + '</ul>' : '') + '</div>';
    }

    function renderAll() { if (!shell()) return; renderAlerts(); renderStats(); renderBody(); }

    // ------------------------------------------------------------ data
    async function loadHistory() {
        try { S.history = (await api('api/pickups?scope=history&limit=100')).data.pickups; } catch (e) { /* abaikan */ }
    }
    async function loadDetail() {
        if (!S.selected) { S.detail = null; return; }
        try { S.detail = (await api('api/pickups/' + S.selected)).data; } catch (e) { S.detail = null; }
    }

    function notifyChanges() {
        var next = {};
        S.data.forEach(function (p) {
            next[p.id] = p.status;
            var prev = S.statuses[p.id];
            if (S.firstPoll) return;
            if (isCourier() && prev === undefined) toast('info', 'Tugas pickup baru: ' + p.pickup_no);
            else if (!isCourier() && prev && prev !== p.status) toast(p.status === 'DELIVERED' ? 'success' : 'info', p.pickup_no + ' → ' + (STATUS[p.status] || {}).label + ' (' + p.courier_name + ')');
        });
        S.statuses = next; S.firstPoll = false;
    }

    async function refresh(opts) {
        if (S.loading) return;
        S.loading = true;
        try {
            var res = await api('api/pickups?scope=active');
            S.data = res.data.pickups; S.custody = res.data.custody || []; S.error = '';
            if (S.selected && !S.data.find(function (p) { return p.id === S.selected; }) && !(S.detail && S.detail.id === S.selected)) S.selected = null;
            if (!S.selected && S.data.length && !(opts && opts.keepEmpty)) {
                S.selected = (S.data.find(function (p) { return p.status === 'ON_THE_WAY'; }) || S.data[0]).id;
            }
            await loadDetail();
            if (!S.loaded) { await loadHistory(); S.loaded = true; }
            notifyChanges();
        } catch (e) { S.error = e.message; }
        S.loading = false;
        renderAll();
        syncTracking();
    }

    function viewVisible() { var v = $('pickup-view'); return !!v && !v.classList.contains('hidden') && v.offsetParent !== null; }
    function startPolling() {
        if (S.timer) return;
        S.timer = setInterval(function () { if (!document.hidden && (viewVisible() || isCourier())) refresh(); }, POLL_MS);
    }

    async function select(id) {
        S.selected = id; S.fitFor = null; S.detail = null;
        renderBody(); await loadDetail(); renderDetail(); renderMap();
    }

    // ----------------------------------------------------- GPS kurir
    function syncTracking() {
        if (!isCourier()) return;
        var active = S.data.filter(function (p) { return p.status === 'ON_THE_WAY'; });
        if (active.length && S.watchId == null) {
            if (!navigator.geolocation) { S.geoError = 'Perangkat ini tidak mendukung GPS.'; renderAlerts(); return; }
            S.watchId = navigator.geolocation.watchPosition(onPos, function (err) {
                S.geoError = err.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi di browser agar posisi Anda terpantau.' : 'Lokasi belum tersedia: ' + err.message;
                renderAlerts();
            }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
            if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(function (w) { S.wake = w; }).catch(function () {});
        } else if (!active.length && S.watchId != null) {
            navigator.geolocation.clearWatch(S.watchId); S.watchId = null; S.geoError = '';
            if (S.wake) { try { S.wake.release(); } catch (e) {} S.wake = null; }
            renderAlerts();
        }
    }
    function onPos(pos) {
        S.geoError = '';
        var now = Date.now();
        if (now - S.lastSent < GPS_MIN_MS) return;
        S.lastSent = now;
        var c = pos.coords;
        S.data.filter(function (p) { return p.status === 'ON_THE_WAY'; }).forEach(function (p) {
            api('api/pickups/' + p.id + '/location', { method: 'POST', body: { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, speed: c.speed, heading: c.heading } }).catch(function () {});
        });
    }
    function currentPosition() {
        return new Promise(function (resolve) {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(function (p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); }, function () { resolve(null); }, { enableHighAccuracy: true, timeout: 8000 });
        });
    }

    // ------------------------------------------------------------ modal
    function modal(title, body, footer, onOpen) {
        closeModal();
        var ov = document.createElement('div');
        ov.id = 'pkOverlay'; ov.className = 'pk-overlay';
        ov.innerHTML = '<div class="pk-modal" role="dialog"><header><h3>' + title + '</h3><button class="pk-btn sm" data-pk="close" aria-label="Tutup">&times;</button></header><div class="body">' + body + '</div><footer>' + footer + '</footer></div>';
        document.body.appendChild(ov);
        if (onOpen) onOpen(ov);
        return ov;
    }
    function closeModal() {
        var ov = $('pkOverlay'); if (ov) ov.remove();
        if (S.pickMap) { try { S.pickMap.remove(); } catch (e) {} S.pickMap = null; }
    }
    function busy(btn, on, text) {
        if (!btn) return;
        if (on) { btn.dataset.t = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (text || 'Memproses...'); }
        else { btn.disabled = false; btn.innerHTML = btn.dataset.t || btn.innerHTML; }
    }
    function pinDialog(title, pin) {
        modal(title, '<div class="pk-pinbox"><small style="color:var(--pk-mut)">PIN serah terima (hanya tampil sekali)</small><br><b>' + esc(pin) + '</b></div>' +
            '<div class="pk-alert warn">Berikan PIN ini kepada penerima/pelanggan. Kurir harus memasukkan PIN saat menyerahkan valas. PIN tidak dapat dilihat lagi, hanya bisa direset.</div>',
            '<button class="pk-btn pri" data-pk="close">Mengerti</button>');
    }

    // photo
    function pickPhoto() {
        return new Promise(function (resolve) {
            var input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment');
            input.onchange = function () {
                var f = input.files && input.files[0]; if (!f) return resolve(null);
                var rd = new FileReader();
                rd.onload = function () {
                    var img = new Image();
                    img.onload = function () {
                        var max = 1280, sc = Math.min(1, max / Math.max(img.width, img.height));
                        var cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
                        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                        resolve(cv.toDataURL('image/jpeg', 0.78));
                    };
                    img.onerror = function () { resolve(null); };
                    img.src = rd.result;
                };
                rd.readAsDataURL(f);
            };
            input.click();
        });
    }
    async function uploadPhoto(dataUrl, name) {
        var res = await api('api/uploads', { method: 'POST', body: { category: 'pickups/proofs', data_url: dataUrl, filename: name } });
        return res.url || (res.data && res.data.url) || null;
    }
    function photoField(id, label) {
        return '<div class="pk-f pk-photo"><label>' + label + '</label><button type="button" class="pk-btn block" data-pk="photo" data-for="' + id + '"><i class="fa-solid fa-camera"></i> Ambil / pilih foto</button>' +
            '<input type="hidden" id="' + id + '"><img id="' + id + 'Img" alt="" style="display:none"></div>';
    }

    // ---- buat pickup
    function currencyList() {
        try { return (JSON.parse(localStorage.getItem('mc_currencies')) || []).filter(function (c) { return c && c.code && String(c.code).toUpperCase() !== 'IDR'; }); } catch (e) { return []; }
    }
    function itemRowHtml() {
        var opts = currencyList().map(function (c) { return '<option value="' + esc(c.code) + '" data-sell="' + esc(c.sell || 0) + '" data-stock="' + esc(c.stock || 0) + '">' + esc(c.code) + '</option>'; }).join('');
        return '<div class="pk-item"><div class="pk-f"><label>Valas</label><select data-pkf="cur">' + opts + '</select></div>' +
            '<div class="pk-f"><label>Jumlah</label><input type="text" inputmode="decimal" data-pkf="amt" placeholder="0"></div>' +
            '<div class="pk-f"><label>Kurs jual (Rp)</label><input type="text" inputmode="decimal" data-pkf="rate" placeholder="0"></div>' +
            '<button type="button" class="pk-btn sm bad" data-pk="rmitem" aria-label="Hapus baris">&times;</button></div>' +
            '<small data-pkf="hint" style="color:var(--pk-mut);margin-top:-6px"></small>';
    }
    function syncItemRow(row) {
        var sel = row.querySelector('[data-pkf=cur]'), opt = sel.options[sel.selectedIndex];
        var rate = row.querySelector('[data-pkf=rate]');
        if (opt && !rate.dataset.touched) rate.value = opt.dataset.sell && +opt.dataset.sell ? opt.dataset.sell : '';
        var hint = row.nextElementSibling;
        if (hint && opt) hint.textContent = 'Stok tersedia: ' + nf.format(+opt.dataset.stock || 0) + ' ' + opt.value;
    }
    function calcCreateTotal() {
        var t = 0;
        document.querySelectorAll('#pkItems .pk-item').forEach(function (r) {
            t += num(r.querySelector('[data-pkf=amt]').value) * num(r.querySelector('[data-pkf=rate]').value);
        });
        var el = $('pkTotal'); if (el) el.textContent = rp(t);
    }
    function addItemRow() {
        var wrap = $('pkItems');
        var tmp = document.createElement('div'); tmp.innerHTML = itemRowHtml();
        while (tmp.firstChild) wrap.appendChild(tmp.firstChild);
        var rows = wrap.querySelectorAll('.pk-item'); syncItemRow(rows[rows.length - 1]);
    }

    async function openCreate() {
        var couriers = [];
        try { couriers = (await api('api/pickups/couriers')).data; } catch (e) { return toast('error', e.message); }
        if (!couriers.length) return toast('warning', 'Belum ada pengguna dengan role Kurir. Tambahkan di menu Pengguna terlebih dahulu.');
        if (!currencyList().length) return toast('warning', 'Belum ada data valas. Isi master mata uang terlebih dahulu.');
        var copts = couriers.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
        modal('Pickup Baru',
            '<div class="pk-2"><div class="pk-f"><label>Kurir</label><select id="pkCourier">' + copts + '</select></div>' +
            '<div class="pk-f"><label>Kendaraan</label><div class="pk-2"><select id="pkVType"><option>Motor</option><option>Mobil</option><option>Lainnya</option></select><input id="pkPlate" placeholder="Plat nomor" style="text-transform:uppercase"></div></div></div>' +
            '<div class="pk-2"><div class="pk-f"><label>Nama pelanggan / penerima</label><input id="pkCust" placeholder="Nama lengkap"></div><div class="pk-f"><label>No. telepon</label><input id="pkPhone" inputmode="tel" placeholder="Nomor telepon"></div></div>' +
            '<div class="pk-f"><label>Alamat tujuan</label><div style="display:flex;gap:8px"><input id="pkDest" placeholder="Alamat lengkap tujuan"><button type="button" class="pk-btn" data-pk="geocode"><i class="fa-solid fa-magnifying-glass-location"></i> Cari</button></div>' +
            '<small style="color:var(--pk-mut)">Klik peta untuk menandai titik tujuan (opsional, dipakai untuk peta & navigasi).</small><div id="pkPickMap"></div>' +
            '<input type="hidden" id="pkLat"><input type="hidden" id="pkLng"><small id="pkCoord" style="color:var(--pk-mut)">Titik belum dipilih</small></div>' +
            '<div class="pk-f"><label>Valas yang dibawa</label><div id="pkItems" style="display:grid;gap:8px"></div><button type="button" class="pk-btn sm" data-pk="additem" style="margin-top:8px"><i class="fa-solid fa-plus"></i> Tambah valas</button>' +
            '<div style="text-align:right;margin-top:8px;color:var(--pk-mut)">Estimasi total: <b id="pkTotal" style="color:var(--pk-tx)">Rp 0</b></div></div>' +
            '<div class="pk-f"><label>Catatan</label><textarea id="pkNotes" rows="2" placeholder="Catatan untuk kurir (opsional)"></textarea></div>',
            '<button class="pk-btn" data-pk="close">Batal</button><button class="pk-btn pri" data-pk="create"><i class="fa-solid fa-paper-plane"></i> Tugaskan Kurir</button>',
            function () {
                addItemRow();
                ensureLeaflet().then(function () {
                    var el = $('pkPickMap'); if (!el) return;
                    S.pickMap = newMap(el, S.map ? [S.map.getCenter().lat, S.map.getCenter().lng] : null, 12);
                    var mk = null;
                    S.pickMap.on('click', function (e) { setPick(e.latlng.lat, e.latlng.lng); });
                    S.setPick = setPick;
                    function setPick(lat, lng, zoom) {
                        $('pkLat').value = lat.toFixed(7); $('pkLng').value = lng.toFixed(7);
                        $('pkCoord').textContent = 'Titik tujuan: ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
                        if (mk) mk.setLatLng([lat, lng]); else mk = window.L.marker([lat, lng], { icon: icon('dest', 'fa-location-dot') }).addTo(S.pickMap);
                        if (zoom) S.pickMap.setView([lat, lng], zoom);
                    }
                    setTimeout(function () { S.pickMap && S.pickMap.invalidateSize(); }, 100);
                }).catch(function () { var el = $('pkPickMap'); if (el) el.outerHTML = '<div class="pk-alert warn">Peta tidak dapat dimuat; alamat tetap bisa diisi manual.</div>'; });
            });
    }

    async function geocode(btn) {
        var q = ($('pkDest').value || '').trim(); if (!q) return toast('warning', 'Isi alamat dulu.');
        busy(btn, true, 'Mencari');
        try {
            var r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
            var j = await r.json();
            if (!j.length) toast('info', 'Alamat tidak ditemukan. Tandai titik langsung di peta.');
            else if (S.setPick) S.setPick(+j[0].lat, +j[0].lon, 16);
        } catch (e) { toast('error', 'Pencarian alamat gagal. Tandai titik langsung di peta.'); }
        busy(btn, false);
    }

    async function submitCreate(btn) {
        var items = [];
        document.querySelectorAll('#pkItems .pk-item').forEach(function (r) {
            var amt = num(r.querySelector('[data-pkf=amt]').value), rate = num(r.querySelector('[data-pkf=rate]').value);
            if (amt > 0) items.push({ currency_code: r.querySelector('[data-pkf=cur]').value, amount: amt, rate: rate > 0 ? rate : null });
        });
        if (!items.length) return toast('warning', 'Isi jumlah valas yang dibawa.');
        if (!($('pkDest').value || '').trim()) return toast('warning', 'Alamat tujuan wajib diisi.');
        busy(btn, true, 'Menugaskan');
        try {
            var res = await api('api/pickups', { method: 'POST', body: {
                courier_user_id: $('pkCourier').value, vehicle_type: $('pkVType').value, vehicle_plate: $('pkPlate').value.trim() || null,
                customer_name: $('pkCust').value.trim() || null, customer_phone: $('pkPhone').value.trim() || null,
                destination: $('pkDest').value.trim(), dest_lat: $('pkLat').value || null, dest_lng: $('pkLng').value || null,
                notes: $('pkNotes').value.trim() || null, items: items
            } });
            var pin = res.data.pin; S.selected = res.data.id;
            closeModal(); await refresh(); pinDialog('Pickup ' + esc(res.data.pickup_no) + ' dibuat', pin);
        } catch (e) { busy(btn, false); toast('error', e.message); }
    }

    // ---- aksi kurir
    function findP(id) { return S.data.find(function (p) { return p.id === +id; }) || (S.detail && S.detail.id === +id ? S.detail : null); }

    function openStart(id) {
        var p = findP(id); if (!p) return;
        modal('Mulai Perjalanan', '<div class="pk-alert warn">Valas <b>' + p.items.map(function (i) { return esc(i.currency_code) + ' ' + nf.format(i.amount); }).join(', ') + '</b> akan keluar dari brankas dan tercatat dibawa oleh <b>' + esc(p.courier_name) + '</b>.</div>' +
            '<div class="pk-kv"><small>Tujuan</small><span>' + esc(p.destination) + '</span></div>' + photoField('pkStartPhoto', 'Foto valas yang dibawa (opsional)'),
            '<button class="pk-btn" data-pk="close">Batal</button><button class="pk-btn pri" data-pk="dostart" data-id="' + p.id + '"><i class="fa-solid fa-motorcycle"></i> Berangkat</button>');
    }
    async function doStart(btn, id) {
        busy(btn, true, 'Memproses');
        try {
            var photo = $('pkStartPhoto').value, url = null;
            if (photo) { try { url = await uploadPhoto(photo, 'pickup-start-' + id + '-' + Date.now()); } catch (e) { /* lanjut tanpa foto */ } }
            var pos = await currentPosition();
            await api('api/pickups/' + id + '/start', { method: 'POST', body: { photo_pickup: url, lat: pos && pos.lat, lng: pos && pos.lng } });
            closeModal(); S.selected = +id; S.fitFor = null; toast('success', 'Perjalanan dimulai. Lokasi Anda dikirim otomatis.'); await refresh();
        } catch (e) { busy(btn, false); toast('error', e.message); }
    }

    function openDeliver(id) {
        var p = findP(id); if (!p) return;
        modal('Serahkan ke Penerima', '<div class="pk-alert warn">Minta <b>PIN</b> dari penerima, lalu masukkan di bawah. Pastikan jumlah valas sesuai sebelum menyerahkan.</div>' +
            '<table class="pk-tbl"><thead><tr><th>Valas</th><th class="r">Jumlah</th></tr></thead><tbody>' + p.items.map(function (i) { return '<tr><td>' + esc(i.currency_code) + '</td><td class="r">' + nf.format(i.amount) + '</td></tr>'; }).join('') + '</tbody></table>' +
            '<div class="pk-2"><div class="pk-f"><label>PIN dari penerima</label><input id="pkPin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="••••"></div>' +
            '<div class="pk-f"><label>Nama penerima</label><input id="pkRecipient" placeholder="Nama lengkap" value="' + esc(p.customer_name || '') + '"></div></div>' + photoField('pkProofPhoto', 'Foto bukti serah terima'),
            '<button class="pk-btn" data-pk="close">Batal</button><button class="pk-btn pri" data-pk="dodeliver" data-id="' + p.id + '"><i class="fa-solid fa-check"></i> Konfirmasi Serah Terima</button>');
    }
    async function doDeliver(btn, id) {
        var pin = ($('pkPin').value || '').trim(), rec = ($('pkRecipient').value || '').trim();
        if (!pin) return toast('warning', 'Masukkan PIN dari penerima.');
        if (!rec) return toast('warning', 'Nama penerima wajib diisi.');
        busy(btn, true, 'Memverifikasi');
        try {
            var photo = $('pkProofPhoto').value, url = null;
            if (photo) { try { url = await uploadPhoto(photo, 'pickup-proof-' + id + '-' + Date.now()); } catch (e) { /* lanjut */ } }
            var pos = await currentPosition();
            await api('api/pickups/' + id + '/deliver', { method: 'POST', body: { pin: pin, recipient_name: rec, photo_proof: url, lat: pos && pos.lat, lng: pos && pos.lng } });
            closeModal(); toast('success', 'Serah terima tercatat. Menunggu penyelesaian oleh staf.'); await refresh();
        } catch (e) { busy(btn, false); toast('error', e.message); }
    }

    // ---- aksi staf
    function openComplete(id) {
        var p = findP(id); if (!p) return;
        var rows = p.items.map(function (i) {
            return '<tr><td>' + esc(i.currency_code) + '</td><td class="r">' + nf.format(i.amount) + '</td><td class="r"><input class="pk-rate" data-id="' + i.id + '" data-amt="' + i.amount + '" value="' + (i.realized_rate || i.estimated_rate) + '" inputmode="decimal" style="width:120px;text-align:right;background:var(--pk-inp);border:1px solid var(--pk-bd);color:var(--pk-tx);border-radius:8px;padding:5px 8px"></td></tr>';
        }).join('');
        modal('Selesaikan Pickup ' + esc(p.pickup_no),
            '<div class="pk-alert warn">Penyelesaian membuat <b>transaksi penjualan (JUAL)</b> dengan nomor invoice baru, mencatat uang masuk ke kas/bank, dan mengurangi stok. Tidak dapat dibatalkan.</div>' +
            '<div class="pk-kv"><small>Diterima oleh</small><span>' + esc(p.recipient_name || '-') + ' · ' + dt(p.delivered_at) + '</span></div>' +
            '<table class="pk-tbl"><thead><tr><th>Valas</th><th class="r">Jumlah</th><th class="r">Kurs realisasi (Rp)</th></tr></thead><tbody>' + rows + '</tbody></table>' +
            '<div style="text-align:right">Total diterima: <b id="pkRealTotal">' + rp(p.realized_total_idr || p.estimated_total_idr) + '</b></div>' +
            '<div class="pk-f"><label>Uang diterima ke</label><select id="pkSettle"><option value="CASH">Kas Tunai</option><option value="BCA">Bank BCA</option><option value="MANDIRI">Bank Mandiri</option></select></div>',
            '<button class="pk-btn" data-pk="close">Batal</button><button class="pk-btn pri" data-pk="docomplete" data-id="' + p.id + '"><i class="fa-solid fa-square-check"></i> Selesaikan & Catat</button>');
    }
    function calcReal() {
        var t = 0; document.querySelectorAll('.pk-rate').forEach(function (i) { t += num(i.dataset.amt) * num(i.value); });
        var el = $('pkRealTotal'); if (el) el.textContent = rp(t);
    }
    async function doComplete(btn, id) {
        var rates = {}; document.querySelectorAll('.pk-rate').forEach(function (i) { var r = num(i.value); if (r > 0) rates[i.dataset.id] = r; });
        busy(btn, true, 'Mencatat');
        try {
            var res = await api('api/pickups/' + id + '/complete', { method: 'POST', body: { settle_to: $('pkSettle').value, rates: rates } });
            closeModal(); S.history = []; await loadHistory();
            toast('success', 'Selesai. Invoice ' + res.data.invoice_no + ' tercatat.'); await refresh({ keepEmpty: true });
            if (typeof window.syncFromMySQL === 'function') { try { window.syncFromMySQL(); } catch (e) { /* polling akan menyusul */ } }
        } catch (e) { busy(btn, false); toast('error', e.message); }
    }

    function openCancel(id) {
        var p = findP(id); if (!p) return;
        var way = p.status === 'ON_THE_WAY';
        modal(way ? 'Tarik Kembali Valas' : 'Batalkan Pickup',
            (way ? '<div class="pk-alert warn">Kurir sedang di jalan. Valas akan dikembalikan ke stok brankas — pastikan fisik valas sudah kembali.</div>' : '') +
            '<div class="pk-f"><label>Alasan (wajib)</label><input id="pkReason" placeholder="Contoh: pelanggan membatalkan"></div>',
            '<button class="pk-btn" data-pk="close">Kembali</button><button class="pk-btn bad" data-pk="docancel" data-id="' + p.id + '">' + (way ? 'Tarik Kembali' : 'Batalkan Pickup') + '</button>');
    }
    async function doCancel(btn, id) {
        var reason = ($('pkReason').value || '').trim(); if (!reason) return toast('warning', 'Alasan wajib diisi.');
        busy(btn, true);
        try {
            await api('api/pickups/' + id + '/cancel', { method: 'POST', body: { reason: reason } });
            closeModal(); await loadHistory(); toast('success', 'Pickup dibatalkan.'); await refresh({ keepEmpty: true });
        } catch (e) { busy(btn, false); toast('error', e.message); }
    }
    async function resetPin(id) {
        if (!(await confirmBox({ title: 'Reset PIN?', text: 'PIN lama tidak berlaku lagi.', confirmText: 'Reset' }))) return;
        try { var res = await api('api/pickups/' + id + '/reset-pin', { method: 'POST' }); pinDialog('PIN baru', res.data.pin); await refresh(); }
        catch (e) { toast('error', e.message); }
    }



    // ---- panduan cara pakai
    function openHelp() {
        var staff = !isCourier();
        var sec = function (t, items) { return '<div><b style="display:block;margin-bottom:6px">' + t + '</b><ol style="margin:0 0 0 18px;padding:0;font-size:.85rem;line-height:1.65">' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ol></div>'; };
        var staffHtml =
            sec('Staf: menugaskan & menyelesaikan', [
                'Klik <b>Pickup Baru</b>, pilih kurir, isi valas, kurs, dan alamat tujuan (tandai titik di peta).',
                'Catat <b>PIN</b> yang muncul (hanya tampil sekali) dan berikan ke penerima/pelanggan.',
                'Setelah kurir berangkat, pantau posisinya di peta. Valas tercatat <i>dibawa kurir</i> dan stok brankas berkurang.',
                'Setelah kurir menyerahkan, klik <b>Selesaikan &amp; Catat Penjualan</b>, cek kurs realisasi, pilih Kas/BCA/Mandiri.',
                '<b>Batalkan</b> sebelum berangkat, atau <b>Tarik Kembali</b> bila kurir batal di jalan (stok dikembalikan).',
                'PIN lupa/terkunci: klik <b>Reset PIN</b>.'
            ]) +
            sec('Pelacak GPS (OwnTracks / Traccar Client)', [
                'Klik <b>Pelacak GPS</b> → <b>Buat token</b> untuk kurir, lalu salin URL.',
                'OwnTracks: Preferences → Connection → Mode <b>HTTP</b> → tempel URL. Traccar Client: tempel di Server URL, frekuensi 10 detik.',
                'Izinkan lokasi “Always” dan matikan penghemat baterai untuk aplikasinya.'
            ]);
        var courierHtml =
            sec('Kurir: mengantar valas', [
                'Buka tugas Anda, klik <b>Mulai Perjalanan</b> (foto valas opsional). Izinkan akses lokasi.',
                'Selama perjalanan, biarkan aplikasi/pelacak aktif. Gunakan <b>Navigasi Google Maps</b> untuk rute.',
                'Di tujuan klik <b>Serahkan ke Penerima</b>: masukkan <b>PIN dari penerima</b>, nama penerima, dan foto bukti.',
                'PIN salah 5 kali akan terkunci; minta staf mereset.',
                'Setelah diserahkan, staf menyelesaikan pencatatan penjualan.'
            ]);
        var status = '<div style="font-size:.8rem;color:var(--pk-mut);line-height:1.6"><b>Status:</b> Ditugaskan → Dalam Perjalanan (valas ditahan kurir) → Diserahkan → Selesai. Cabang: Dibatalkan / Dikembalikan.<br><b>Catatan GPS:</b> aplikasi harus dibuka lewat HTTPS agar GPS browser bekerja. Pelacak OwnTracks/Traccar tetap mengirim saat layar mati.</div>';
        modal('Cara Pakai Serah Terima / Pickup', (staff ? staffHtml + courierHtml : courierHtml) + status, '<button class="pk-btn pri" data-pk="close">Mengerti</button>');
    }

    // ---- pelacak GPS eksternal (OwnTracks / Traccar Client)
    async function openTrackers() {
        var couriers = [], st = {};
        try { couriers = (await api('api/pickups/couriers')).data; st = (await api('api/pickups/trackers')).data || {}; } catch (e) { return toast('error', e.message); }
        if (!couriers.length) return toast('warning', 'Belum ada pengguna dengan role Kurir.');
        var rows = couriers.map(function (c) {
            var t = st[c.id];
            var info = t && t.last_ping_at ? ago(t.last_ping_at) + (t.battery != null ? ' · baterai ' + t.battery + '%' : '') : 'Belum pernah terhubung';
            return '<tr><td>' + esc(c.name) + '</td><td>' + info + '</td><td class="r"><button class="pk-btn sm" data-pk="gentoken" data-id="' + esc(c.id) + '">' + (t ? 'Reset token' : 'Buat token') + '</button></td></tr>';
        }).join('');
        modal('Pelacak GPS Kurir',
            '<div class="pk-alert warn">Pasang aplikasi <b>OwnTracks</b> atau <b>Traccar Client</b> di HP kurir. Lokasi tetap terkirim saat layar mati. Posisi hanya direkam selama pickup berstatus <b>Dalam Perjalanan</b>.</div>' +
            '<table class="pk-tbl"><thead><tr><th>Kurir</th><th>Sinyal terakhir</th><th></th></tr></thead><tbody>' + rows + '</tbody></table><div id="pkTokenOut"></div>',
            '<button class="pk-btn pri" data-pk="close">Tutup</button>');
    }
    async function genToken(btn, id) {
        if (btn.dataset.t !== 'sure' && /Reset/.test(btn.textContent)) {
            if (!(await confirmBox({ title: 'Reset token?', text: 'Token lama berhenti berlaku; HP kurir harus diset ulang.', confirmText: 'Reset' }))) return;
        }
        busy(btn, true, 'Membuat');
        try {
            var d = (await api('api/pickups/couriers/' + encodeURIComponent(id) + '/tracker', { method: 'POST' })).data;
            $('pkTokenOut').innerHTML =
                '<div class="pk-alert" style="margin-top:12px"><b>Token untuk ' + esc(d.name) + '</b> (hanya tampil sekali)' +
                '<div class="pk-f" style="margin-top:8px"><label>URL pelacak</label><div style="display:flex;gap:8px"><input id="pkTrkUrl" readonly value="' + esc(d.owntracks_url) + '"><button class="pk-btn" data-pk="copyurl">Salin</button></div></div>' +
                '<ol style="margin:10px 0 0 18px;padding:0;font-size:.82rem;line-height:1.6">' +
                '<li><b>OwnTracks</b> → Preferences → Connection → Mode: <b>HTTP</b> → URL: tempel URL di atas. Monitoring mode: <b>Significant/Move</b>, izinkan lokasi “Always”.</li>' +
                '<li><b>Traccar Client</b> → Server URL: tempel URL di atas, Frequency: 10 detik, izinkan lokasi “Always”, lalu aktifkan Service status.</li>' +
                '<li>Matikan penghemat baterai untuk aplikasi tersebut agar tidak dihentikan Android.</li></ol></div>';
            btn.textContent = 'Reset token';
        } catch (e) { toast('error', e.message); }
        busy(btn, false); btn.textContent = 'Reset token';
    }

    // --------------------------------------------------------- event
    var bound = false;
    function bindOnce() {
        if (bound) return; bound = true;
        document.addEventListener('click', async function (ev) {
            var t = ev.target.closest ? ev.target.closest('[data-pk]') : null; if (!t) return;
            var a = t.dataset.pk, id = t.dataset.id;
            if (!t.closest('#pickupRoot') && !t.closest('#pkOverlay')) return;
            if (a === 'sel') select(+id);
            else if (a === 'tab') {
                S.tab = t.dataset.t; document.querySelectorAll('.pk-tab').forEach(function (b) { b.classList.toggle('on', b === t); });
                if (S.tab === 'history') { await loadHistory(); }
                else { S.map = null; S.mapEl = null; S.layers = {}; var b = $('pkBody'); if (b) b.innerHTML = ''; }
                renderBody(); renderStats();
            }
            else if (a === 'hist') { S.tab = 'active'; document.querySelectorAll('.pk-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.t === 'active'); }); var h = S.history.find(function (p) { return p.id === +id; }); if (h) { S.detail = h; S.selected = h.id; } var bb = $('pkBody'); if (bb) bb.innerHTML = ''; S.map = null; S.mapEl = null; S.layers = {}; renderBody(); await loadDetail(); renderDetail(); }
            else if (a === 'new') openCreate();
            else if (a === 'help') openHelp();
            else if (a === 'trackers') openTrackers();
            else if (a === 'gentoken') genToken(t, id);
            else if (a === 'copyurl') { var u = $('pkTrkUrl'); u.select(); try { await navigator.clipboard.writeText(u.value); } catch (e) { document.execCommand('copy'); } toast('success', 'URL disalin'); }
            else if (a === 'close') closeModal();
            else if (a === 'additem') addItemRow();
            else if (a === 'rmitem') { var row = t.closest('.pk-item'); if (document.querySelectorAll('#pkItems .pk-item').length > 1) { if (row.nextElementSibling && row.nextElementSibling.tagName === 'SMALL') row.nextElementSibling.remove(); row.remove(); calcCreateTotal(); } }
            else if (a === 'geocode') geocode(t);
            else if (a === 'create') submitCreate(t);
            else if (a === 'start') openStart(id);
            else if (a === 'dostart') doStart(t, id);
            else if (a === 'deliver') openDeliver(id);
            else if (a === 'dodeliver') doDeliver(t, id);
            else if (a === 'complete') openComplete(id);
            else if (a === 'docomplete') doComplete(t, id);
            else if (a === 'cancel') openCancel(id);
            else if (a === 'docancel') doCancel(t, id);
            else if (a === 'pin') resetPin(id);
            else if (a === 'photo') {
                var data = await pickPhoto(); if (!data) return;
                var f = $(t.dataset.for), img = $(t.dataset.for + 'Img'); f.value = data; img.src = data; img.style.display = 'block';
            }
        });
        document.addEventListener('input', function (ev) {
            var t = ev.target; if (!t.closest || !t.closest('#pkOverlay')) return;
            if (t.dataset && t.dataset.pkf === 'rate') t.dataset.touched = '1';
            if (t.dataset && (t.dataset.pkf === 'amt' || t.dataset.pkf === 'rate')) calcCreateTotal();
            if (t.classList.contains('pk-rate')) calcReal();
            if (t.id === 'pkPin') t.value = t.value.replace(/\D/g, '');
        });
        document.addEventListener('change', function (ev) {
            var t = ev.target; if (t.dataset && t.dataset.pkf === 'cur') { var r = t.closest('.pk-item'); r.querySelector('[data-pkf=rate]').dataset.touched = ''; syncItemRow(r); calcCreateTotal(); }
        });
        document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeModal(); });
        document.addEventListener('visibilitychange', function () { if (!document.hidden && viewVisible()) refresh(); });
    }

    // ---------------------------------------------------- API publik
    window.initPickupView = function () {
        injectStyle(); bindOnce(); shell(); startPolling();
        S.firstPoll = S.firstPoll && !S.loaded;
        refresh();
    };
    // Kurir: tetap kirim lokasi walau menu lain dibuka (selama tab aplikasi terbuka).
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            if (typeof window.authFetch === 'function' && isCourier()) { injectStyle(); bindOnce(); startPolling(); refresh({ keepEmpty: true }); }
        }, 1500);
    });
})();
