document.addEventListener('DOMContentLoaded', function () {
    if (!window.MCTheme) return;

    const colorFields = ['primary','primaryHover','secondary','pageBg','cardBg','sidebarBg','sidebarText','headerBg','text','textMuted','border','inputBg','inputBorder','buttonBg','buttonText','buy','sell','draft','final'];
    const textFields = ['shadow','radius'];
    const allFields = [...colorFields, ...textFields];
    const theme = MCTheme.load();

    colorFields.forEach(k => {
        const color = document.getElementById('theme-' + k);
        const text = document.getElementById('theme-' + k + '-text');
        if (color) color.value = theme[k];
        if (text) text.value = theme[k];
    });
    textFields.forEach(k => {
        const el = document.getElementById('theme-' + k);
        if (el) el.value = theme[k];
    });
    refreshPreview();

    document.querySelectorAll('[data-theme-field]').forEach(el => {
        el.addEventListener('input', function () {
            const key = this.id.replace('theme-', '');
            const text = document.getElementById('theme-' + key + '-text');
            if (text && this.type === 'color') text.value = this.value;
            refreshPreview();
        });
        el.addEventListener('change', refreshPreview);
    });

    colorFields.forEach(k => {
        const text = document.getElementById('theme-' + k + '-text');
        const color = document.getElementById('theme-' + k);
        if (!text || !color) return;
        text.addEventListener('input', function () {
            if (/^#[0-9a-f]{6}$/i.test(this.value.trim())) color.value = this.value.trim();
            refreshPreview();
        });
    });

    document.getElementById('theme-save')?.addEventListener('click', function () {
        MCTheme.apply(readForm());
        toast('Tema Almara berhasil disimpan.');
    });

    document.getElementById('theme-reset')?.addEventListener('click', function () {
        MCTheme.reset();
        fillForm(MCTheme.defaults);
        refreshPreview();
        toast('Almara Default dipulihkan.');
    });

    const presets = {
        default: Object.assign({}, MCTheme.defaults),
        light: Object.assign({}, MCTheme.defaults, {
            pageBg:'#F7F5EF', cardBg:'#FCFBF7', headerBg:'#FFFFFF', border:'#D7D8CF',
            text:'#18221F', textMuted:'#69736F', inputBorder:'#D7D8CF'
        }),
        dark: Object.assign({}, MCTheme.defaults, {
            pageBg:'#101A18', cardBg:'#172522', sidebarBg:'#071E1A', sidebarText:'#C7D8D1',
            headerBg:'#12201D', text:'#F3F7F5', textMuted:'#9EB0A8', border:'#29423B',
            inputBg:'#10201C', inputBorder:'#36564D', buttonBg:'#2A8A76'
        }),
        forest: Object.assign({}, MCTheme.defaults, {
            primary:'#2E7D6B', primaryHover:'#1F5E50', buttonBg:'#2E7D6B', sidebarBg:'#0A332B'
        }),
        classic: Object.assign({}, MCTheme.defaults, {
            primary:'#366C91', primaryHover:'#285775', buttonBg:'#366C91', sidebarBg:'#18222F',
            pageBg:'#F4F6F8', cardBg:'#FFFFFF'
        })
    };

    document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', function () {
        const preset = presets[this.dataset.preset] || presets.default;
        fillForm(preset);
        refreshPreview();
    }));

    function readForm() {
        const out = {};
        allFields.forEach(k => {
            const el = document.getElementById('theme-' + k);
            if (el) out[k] = el.value;
        });
        return out;
    }

    function fillForm(t) {
        colorFields.forEach(k => {
            const color = document.getElementById('theme-' + k);
            const text = document.getElementById('theme-' + k + '-text');
            if (color) color.value = t[k];
            if (text) text.value = t[k];
        });
        textFields.forEach(k => {
            const el = document.getElementById('theme-' + k);
            if (el) el.value = t[k];
        });
    }

    function refreshPreview() {
        const t = readForm();
        const p = document.getElementById('theme-preview');
        if (!p) return;
        const map = {
            primary:'--p-primary', pageBg:'--p-page', cardBg:'--p-card', sidebarBg:'--p-sidebar',
            sidebarText:'--p-sidebar-text', text:'--p-text', textMuted:'--p-muted', border:'--p-border',
            buttonBg:'--p-button', buttonText:'--p-button-text', shadow:'--p-shadow', radius:'--p-radius',
            buy:'--p-buy', sell:'--p-sell'
        };
        Object.keys(map).forEach(k => p.style.setProperty(map[k], t[k]));
    }

    function toast(message) {
        const el = document.getElementById('theme-toast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1800);
    }
});
