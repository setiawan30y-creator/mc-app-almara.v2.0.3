(function () {
    'use strict';
    if (!window.MCTheme) return;

    const MC = window.MCTheme;
    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
    const $ = (id) => document.getElementById(id);

    const radii = [['', 'Bawaan'], ['0px', 'Tajam (0)'], ['4px', 'Kecil (4)'], ['6px', '6'], ['8px', '8'], ['10px', '10'], ['12px', '12'], ['16px', 'Besar (16)'], ['999px', 'Pil (bulat penuh)']];
    const weights = [['', 'Bawaan'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold']];
    const toggle = (label) => ({ type: 'toggle', label });

    const schema = [
        { id: 'colors', title: 'Warna', icon: 'fa-droplet', groups: [
            { title: 'Warna utama', fields: [
                { k: 'primary', label: 'Primary (aksen)', type: 'color' },
                { k: 'primaryHover', label: 'Primary saat disorot', type: 'color' },
                { k: 'buttonBg', label: 'Latar tombol', type: 'color' },
                { k: 'buttonText', label: 'Teks tombol', type: 'color' },
                { k: 'link', label: 'Warna tautan', type: 'color', optional: true }
            ]},
            { title: 'Permukaan', fields: [
                { k: 'pageBg', label: 'Latar halaman', type: 'color' },
                { k: 'cardBg', label: 'Latar kartu', type: 'color' },
                { k: 'headerBg', label: 'Latar header', type: 'color' },
                { k: 'border', label: 'Garis tepi', type: 'color' }
            ]},
            { title: 'Teks', fields: [
                { k: 'text', label: 'Teks utama', type: 'color' },
                { k: 'textMuted', label: 'Teks sekunder', type: 'color' },
                { k: 'secondary', label: 'Warna sekunder', type: 'color' }
            ]},
            { title: 'Formulir', fields: [
                { k: 'inputBg', label: 'Latar kolom isian', type: 'color' },
                { k: 'inputBorder', label: 'Garis kolom isian', type: 'color' }
            ]},
            { title: 'Sidebar', fields: [
                { k: 'sidebarBg', label: 'Latar sidebar', type: 'color' },
                { k: 'sidebarText', label: 'Teks sidebar', type: 'color' }
            ]},
            { title: 'Status & transaksi', fields: [
                { k: 'buy', label: 'BELI / naik', type: 'color' },
                { k: 'sell', label: 'JUAL / turun', type: 'color' },
                { k: 'draft', label: 'Draft', type: 'color' },
                { k: 'final', label: 'Final', type: 'color' },
                { k: 'info', label: 'Info', type: 'color', optional: true },
                { k: 'warning', label: 'Peringatan', type: 'color', optional: true },
                { k: 'danger', label: 'Bahaya / hapus', type: 'color', optional: true }
            ]}
        ]},
        { id: 'type', title: 'Huruf', icon: 'fa-font', groups: [
            { title: 'Tipografi', fields: [
                { k: 'fontFamily', label: 'Jenis huruf', type: 'select', options: () => [['', 'Bawaan aplikasi']].concat(Object.entries(MC.fonts).map(([k, f]) => [k, f.label])) },
                { k: 'fontSize', label: 'Ukuran huruf dasar', type: 'select', options: [['', 'Bawaan'], ['13', '13 px - rapat'], ['14', '14 px'], ['15', '15 px'], ['16', '16 px - normal'], ['17', '17 px'], ['18', '18 px - besar']] },
                { k: 'headingWeight', label: 'Ketebalan judul', type: 'select', options: weights },
                { k: 'tabularNums', label: 'Angka sejajar (tabular) untuk nominal & tabel', type: 'toggle' }
            ]}
        ]},
        { id: 'shape', title: 'Kartu & Bentuk', icon: 'fa-square', groups: [
            { title: 'Kartu', fields: [
                { k: 'radius', label: 'Lengkung sudut kartu', type: 'range', min: 0, max: 28, unit: 'px' },
                { k: 'shadow', label: 'Bayangan kartu', type: 'shadow' },
                { k: 'cardBorderWidth', label: 'Tebal garis tepi kartu', type: 'select', options: [['', 'Bawaan'], ['0', 'Tanpa garis'], ['1', '1 px'], ['2', '2 px']] },
                { k: 'density', label: 'Kerapatan isi kartu', type: 'select', options: [['', 'Bawaan'], ['compact', 'Rapat'], ['normal', 'Normal'], ['comfortable', 'Lega']] }
            ]},
            { title: 'Gerak', fields: [
                { k: 'smoothMotion', label: 'Animasi halus (hover, fokus)', type: 'toggle' }
            ]}
        ]},
        { id: 'controls', title: 'Tombol & Isian', icon: 'fa-hand-pointer', groups: [
            { title: 'Tombol', fields: [
                { k: 'btnRadius', label: 'Lengkung tombol', type: 'select', options: radii },
                { k: 'btnWeight', label: 'Ketebalan teks tombol', type: 'select', options: weights },
                { k: 'btnCase', label: 'Huruf tombol', type: 'select', options: [['', 'Bawaan'], ['none', 'Normal'], ['uppercase', 'HURUF BESAR']] },
                { k: 'btnShadow', label: 'Bayangan berwarna pada tombol utama', type: 'toggle' }
            ]},
            { title: 'Kolom isian', fields: [
                { k: 'inputRadius', label: 'Lengkung kolom isian', type: 'select', options: radii }
            ]}
        ]},
        { id: 'layout', title: 'Sidebar & Tabel', icon: 'fa-table-columns', groups: [
            { title: 'Sidebar', fields: [
                { k: 'sidebarFont', label: 'Jenis huruf sidebar', type: 'select', options: () => [['', 'Ikut huruf aplikasi']].concat(Object.entries(MC.sidebarFonts || {}).map(([k, f]) => [k, f.label])) },
                { k: 'sidebarGradient', label: 'Gradasi pada sidebar', type: 'toggle' },
                { k: 'navRadius', label: 'Lengkung menu sidebar', type: 'select', options: radii }
            ]},
            { title: 'Tabel', fields: [
                { k: 'tableHeadBg', label: 'Latar judul kolom', type: 'color', optional: true },
                { k: 'tableHover', label: 'Warna baris saat disorot', type: 'color', optional: true },
                { k: 'tableZebra', label: 'Baris selang-seling (zebra)', type: 'toggle' }
            ]}
        ]},
        { id: 'tools', title: 'Cadangan', icon: 'fa-file-export', groups: [] }
    ];

    let state = MC.normalize(MC.load());
    let saved = JSON.stringify(state);
    let activeTab = 'colors';
    let activePreset = null;

    // ---------- util ----------
    function toast(msg, ms) {
        const el = $('tsToast');
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), ms || 2600);
    }

    function dirty() {
        $('tsDirty').classList.toggle('on', JSON.stringify(state) !== saved);
    }

    function shadowKey(v) {
        const hit = Object.entries(MC.shadows).find(([, s]) => s === v);
        return hit ? hit[0] : 'custom';
    }

    function fallbackColor(k) {
        return /^#[0-9a-f]{6}$/i.test(state[k] || '') ? state[k] : (/^#[0-9a-f]{6}$/i.test(MC.defaults[k] || '') ? MC.defaults[k] : '#888888');
    }

    function previewVars() {
        const m = $('tsMock');
        const set = (k, v) => v === '' || v == null ? m.style.removeProperty(k) : m.style.setProperty(k, v);
        set('--mc-nav-radius', state.navRadius);
        set('--mc-heading-weight', state.headingWeight);
        set('--mc-card-border-w', state.cardBorderWidth !== '' ? state.cardBorderWidth + 'px' : '');
        set('--mc-pad', { compact: '10px', normal: '16px', comfortable: '24px' }[state.density] || '');
        set('--mc-num', state.tabularNums === '1' ? 'tabular-nums' : '');
        set('--mc-btn-weight', state.btnWeight);
        set('--mc-btn-case', state.btnCase === 'uppercase' ? 'uppercase' : '');
        set('--mc-btn-shadow', state.btnShadow === '1' ? '0 4px 14px color-mix(in srgb, var(--mc-button-bg) 35%, transparent)' : '');
        $('tsMockSide').classList.toggle('grad', state.sidebarGradient === '1');
        const sbf = (MC.sidebarFonts || {})[state.sidebarFont];
        $('tsMockSide').style.fontFamily = sbf ? sbf.stack : '';
        $('tsMockTable').classList.toggle('zebra', state.tableZebra === '1');
    }

    function refresh() {
        MC.apply(state, false);
        previewVars();
        dirty();
    }

    function setValue(k, v) {
        state[k] = v;
        activePreset = null;
        markPreset();
        refresh();
    }

    // ---------- presets ----------
    function presetValues(key) {
        return MC.normalize(Object.assign({}, MC.defaults, MC.presets[key].values));
    }

    function renderPresets() {
        $('tsPresets').innerHTML = Object.entries(MC.presets).map(([key, p]) => {
            const v = presetValues(key);
            return `<button type="button" class="ts-preset" data-preset="${key}">
                <div class="ts-swatch" style="background:${v.pageBg}">
                    <i style="background:${v.sidebarBg}"></i>
                    <div class="m"><b style="background:${v.text};opacity:.7"></b><span style="background:${v.buttonBg};border-radius:${v.btnRadius || '4px'}"></span></div>
                </div>
                <strong>${p.name}</strong><small>${p.note}</small>
            </button>`;
        }).join('');
        $('tsPresets').querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
            state = presetValues(b.dataset.preset);
            activePreset = b.dataset.preset;
            refresh();
            markPreset();
            renderPane();
        }));
        markPreset();
    }

    function markPreset() {
        document.querySelectorAll('#tsPresets .ts-preset').forEach(b => b.classList.toggle('on', b.dataset.preset === activePreset));
    }

    // ---------- fields ----------
    function fieldHtml(f) {
        const v = state[f.k] == null ? '' : state[f.k];
        if (f.type === 'color') {
            const hex = /^#[0-9a-f]{6}$/i.test(v) ? v : fallbackColor(f.k);
            return `<div class="ts-field"><label>${f.label}</label>
                <div class="ts-color">
                    <input type="color" data-k="${f.k}" data-kind="color" value="${hex}">
                    <input type="text" data-k="${f.k}" data-kind="colortext" value="${v}" maxlength="7" spellcheck="false" placeholder="${f.optional ? 'Bawaan' : '#RRGGBB'}">
                    ${f.optional ? `<button type="button" data-clear="${f.k}" title="Kembali ke bawaan"><i class="fa-solid fa-xmark"></i></button>` : ''}
                </div></div>`;
        }
        if (f.type === 'select') {
            const opts = typeof f.options === 'function' ? f.options() : f.options;
            return `<div class="ts-field"><label>${f.label}</label><select data-k="${f.k}" data-kind="select">
                ${opts.map(o => `<option value="${o[0]}" ${String(o[0]) === String(v) ? 'selected' : ''}>${o[1]}</option>`).join('')}
            </select></div>`;
        }
        if (f.type === 'range') {
            const n = parseInt(v, 10);
            return `<div class="ts-field"><label>${f.label}</label><div class="ts-range">
                <input type="range" data-k="${f.k}" data-kind="range" data-unit="${f.unit}" min="${f.min}" max="${f.max}" value="${isNaN(n) ? 12 : n}">
                <output>${isNaN(n) ? 12 : n}${f.unit}</output></div></div>`;
        }
        if (f.type === 'shadow') {
            const key = shadowKey(v);
            const labels = { none: 'Tanpa bayangan', soft: 'Lembut', medium: 'Sedang', strong: 'Tegas', glow: 'Bercahaya (indigo)', custom: 'Kustom' };
            const keys = Object.keys(MC.shadows).concat(key === 'custom' ? ['custom'] : []);
            return `<div class="ts-field"><label>${f.label}</label><select data-k="${f.k}" data-kind="shadow">
                ${keys.map(k => `<option value="${k}" ${k === key ? 'selected' : ''}>${labels[k]}</option>`).join('')}
            </select></div>`;
        }
        if (f.type === 'toggle') {
            return `<div class="ts-field" style="align-self:end"><label class="ts-switch"><input type="checkbox" data-k="${f.k}" data-kind="toggle" ${v === '1' ? 'checked' : ''}> ${f.label}</label></div>`;
        }
        return '';
    }

    function renderPane() {
        const tab = schema.find(t => t.id === activeTab);
        const panes = $('tsPanes');
        if (activeTab === 'tools') {
            panes.innerHTML = `<div class="ts-group"><h3>Cadangkan & bagikan tema</h3>
                <p style="font-size:.84rem;color:var(--mc-text-muted);margin:0 0 14px">Ekspor tema ke berkas JSON untuk disimpan atau dipakai di cabang lain, atau impor tema dari berkas.</p>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <button type="button" class="ts-btn" id="tsExport"><i class="fa-solid fa-download"></i> Ekspor Tema (JSON)</button>
                    <button type="button" class="ts-btn" id="tsImport"><i class="fa-solid fa-upload"></i> Impor Tema (JSON)</button>
                </div></div>`;
            $('tsExport').onclick = exportTheme;
            $('tsImport').onclick = () => $('tsImportFile').click();
            return;
        }
        panes.innerHTML = tab.groups.map(g => `<div class="ts-group"><h3>${g.title}</h3><div class="ts-fields">${g.fields.map(fieldHtml).join('')}</div></div>`).join('');
        panes.querySelectorAll('[data-k]').forEach(el => {
            const k = el.dataset.k, kind = el.dataset.kind;
            if (kind === 'color') el.addEventListener('input', () => { setValue(k, el.value.toUpperCase()); const t = panes.querySelector(`[data-kind="colortext"][data-k="${k}"]`); if (t) t.value = el.value.toUpperCase(); });
            if (kind === 'colortext') el.addEventListener('input', () => {
                const val = el.value.trim();
                if (/^#[0-9a-f]{6}$/i.test(val)) { setValue(k, val.toUpperCase()); const c = panes.querySelector(`[data-kind="color"][data-k="${k}"]`); if (c) c.value = val; }
            });
            if (kind === 'select') el.addEventListener('change', () => setValue(k, el.value));
            if (kind === 'toggle') el.addEventListener('change', () => setValue(k, el.checked ? '1' : '0'));
            if (kind === 'range') el.addEventListener('input', () => { el.nextElementSibling.textContent = el.value + el.dataset.unit; setValue(k, el.value + el.dataset.unit); });
            if (kind === 'shadow') el.addEventListener('change', () => { if (el.value !== 'custom') setValue(k, MC.shadows[el.value]); });
        });
        panes.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => { setValue(b.dataset.clear, ''); renderPane(); }));
    }

    function renderTabs() {
        $('tsTabs').innerHTML = schema.map(t => `<button type="button" class="ts-tab ${t.id === activeTab ? 'on' : ''}" data-tab="${t.id}"><i class="fa-solid ${t.icon}"></i> ${t.title}</button>`).join('');
        $('tsTabs').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; renderTabs(); renderPane(); }));
    }

    // ---------- save / reset / import / export ----------
    async function postTheme(theme) {
        const res = await fetch('/api/theme', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
            body: JSON.stringify({ theme })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const first = data.errors ? Object.values(data.errors).flat()[0] : null;
            throw new Error(first || data.message || ('Gagal (' + res.status + ')'));
        }
        return data;
    }

    async function save() {
        MC.apply(state, true);
        try {
            await postTheme(state);
            saved = JSON.stringify(state);
            dirty();
            toast('Tema disimpan untuk semua pengguna. Muat ulang halaman lain untuk melihatnya.');
        } catch (e) {
            saved = JSON.stringify(state);
            dirty();
            toast('Tersimpan di browser ini saja. Server: ' + e.message, 4200);
        }
    }

    async function reset() {
        if (!confirm('Pulihkan tampilan bawaan untuk semua pengguna?')) return;
        MC.reset();
        state = MC.normalize(MC.defaults);
        try { await postTheme(null); toast('Tampilan bawaan dipulihkan.'); }
        catch (e) { toast('Dipulihkan di browser ini. Server: ' + e.message, 4200); }
        MC.apply(state, false);
        saved = JSON.stringify(state);
        activePreset = 'default';
        refresh(); markPreset(); renderPane();
    }

    function exportTheme() {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'tema-mc-almara.json';
        document.body.appendChild(a); a.click(); a.remove();
    }

    $('tsImportFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const obj = JSON.parse(reader.result);
                if (!obj || typeof obj !== 'object') throw new Error('x');
                state = MC.normalize(obj);
                activePreset = null;
                refresh(); markPreset(); renderPane();
                toast('Tema diimpor. Klik Simpan Tema untuk menerapkan.');
            } catch (err) { toast('Berkas tema tidak valid.'); }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    $('tsSave').addEventListener('click', save);
    $('tsReset').addEventListener('click', reset);
    $('tsBack').addEventListener('click', () => {
        try {
            if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { history.back(); return; }
        } catch (e) {}
        location.href = '/';
    });
    window.addEventListener('beforeunload', (e) => { if (JSON.stringify(state) !== saved) { e.preventDefault(); e.returnValue = ''; } });

    // ---------- init ----------
    renderPresets();
    renderTabs();
    renderPane();
    refresh();
    saved = JSON.stringify(state);
    dirty();

    // Muat tema global dari server sebagai dasar tampilan.
    fetch('/api/theme', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
        .then(r => r.ok ? r.json() : null)
        .then(res => {
            if (res && res.data && typeof res.data === 'object') {
                state = MC.normalize(res.data);
                saved = JSON.stringify(state);
                refresh(); renderPane(); dirty();
            }
        })
        .catch(() => {});
})();
