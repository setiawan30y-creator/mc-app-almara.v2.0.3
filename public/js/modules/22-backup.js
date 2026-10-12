(function () {
    'use strict';

    const rootId = 'backup-module-root';
    const frequencies = {
        hourly: 'Setiap Jam',
        '2hours': 'Setiap 2 Jam',
        '4hours': 'Setiap 4 Jam',
        '6hours': 'Setiap 6 Jam',
        '12hours': 'Setiap 12 Jam',
        daily: 'Setiap Hari',
        weekly: 'Setiap Minggu (Senin)'
    };

    function esc(v) {
        return String(v ?? '').replace(/[&<>"']/g, function (m) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m];
        });
    }

    function bytes(v) {
        v = Number(v || 0);
        if (!v) return '-';
        const units = ['B','KB','MB','GB','TB'];
        let i = 0;
        while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
        return v.toFixed(i ? 1 : 0) + ' ' + units[i];
    }

    async function api(url, options) {
        const res = await fetch(url, Object.assign({
            headers: {'Accept':'application/json','Content-Type':'application/json'}
        }, options || {}));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Permintaan gagal.');
        return data;
    }

    function render() {
        const root = document.getElementById(rootId);
        if (!root) return;
        root.innerHTML = `
            <div class="view-container" style="padding:20px;">
                <div class="panel" style="padding:20px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;">
                        <div>
                            <h2 style="margin:0;">Backup & Restore</h2>
                            <div style="opacity:.7;margin-top:5px;">Backup database otomatis dan manual MC-App-Almara.</div>
                        </div>
                        <button type="button" id="mcBackupNow" class="btn btn-primary">
                            <i class="fa-solid fa-database"></i> Backup Sekarang
                        </button>
                    </div>

                    <hr style="margin:20px 0;opacity:.15;">

                    <div id="mcBackupStatus" style="margin-bottom:18px;"></div>

                    <form id="mcBackupSettingsForm">
                        <h3>Pengaturan Backup Otomatis</h3>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;">
                            <div>
                                <label>Backup Otomatis</label>
                                <select id="mcBackupEnabled" class="form-control">
                                    <option value="1">Aktif</option>
                                    <option value="0">Nonaktif</option>
                                </select>
                            </div>
                            <div>
                                <label>Frekuensi</label>
                                <select id="mcBackupFrequency" class="form-control">
                                    ${Object.entries(frequencies).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label>Waktu Backup</label>
                                <input id="mcBackupRunAt" type="time" class="form-control" value="02:00">
                            </div>
                            <div>
                                <label>Retensi</label>
                                <select id="mcBackupRetention" class="form-control">
                                    <option value="7">7 Hari</option>
                                    <option value="14">14 Hari</option>
                                    <option value="30">30 Hari</option>
                                    <option value="60">60 Hari</option>
                                    <option value="90">90 Hari</option>
                                    <option value="180">180 Hari</option>
                                    <option value="365">365 Hari</option>
                                </select>
                            </div>
                            <div>
                                <label>Scope</label>
                                <input class="form-control" value="Database" readonly>
                            </div>
                            <div>
                                <label>Timezone</label>
                                <input id="mcBackupTimezone" class="form-control" value="Asia/Jakarta">
                            </div>
                        </div>
                        <div style="margin-top:15px;">
                            <button class="btn btn-success" type="submit">
                                <i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan
                            </button>
                        </div>
                    </form>

                    <hr style="margin:25px 0;opacity:.15;">

                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <h3 style="margin:0;">Riwayat Backup</h3>
                        <button type="button" class="btn btn-sm btn-outline-secondary" id="mcBackupRefresh">
                            <i class="fa-solid fa-rotate"></i> Refresh
                        </button>
                    </div>
                    <div style="overflow:auto;margin-top:12px;">
                        <table class="table">
                            <thead><tr><th>Waktu</th><th>Jenis</th><th>File</th><th>Ukuran</th><th>Status</th><th>Aksi</th></tr></thead>
                            <tbody id="mcBackupRows"><tr><td colspan="6">Memuat...</td></tr></tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        document.getElementById('mcBackupNow').addEventListener('click', runManual);
        document.getElementById('mcBackupRefresh').addEventListener('click', load);
        document.getElementById('mcBackupSettingsForm').addEventListener('submit', saveSettings);
    }

    async function loadSettings() {
        const r = await api('/api/backups/settings');
        const s = r.data;
        document.getElementById('mcBackupEnabled').value = s.enabled ? '1' : '0';
        document.getElementById('mcBackupFrequency').value = s.frequency;
        document.getElementById('mcBackupRunAt').value = s.run_at;
        document.getElementById('mcBackupRetention').value = String(s.retention_days);
        document.getElementById('mcBackupTimezone').value = s.timezone || 'Asia/Jakarta';
    }

    async function load() {
        try {
            const r = await api('/api/backups');
            const rows = document.getElementById('mcBackupRows');
            rows.innerHTML = (r.data || []).map(log => `
                <tr>
                    <td>${esc(log.created_at || '-')}</td>
                    <td>${log.type === 'automatic' ? 'Otomatis' : 'Manual'}</td>
                    <td>${esc(log.filename)}</td>
                    <td>${bytes(log.size_bytes)}</td>
                    <td><strong>${esc(log.status)}</strong></td>
                    <td>${log.status === 'success' ? `<a class="btn btn-sm btn-outline-primary" href="/api/backups/${log.id}/download"><i class="fa-solid fa-download"></i> Download</a>` : (log.error_message ? `<span title="${esc(log.error_message)}">Lihat Error</span>` : '-')}</td>
                </tr>`).join('') || '<tr><td colspan="6">Belum ada backup.</td></tr>';

            const last = r.last_success;
            document.getElementById('mcBackupStatus').innerHTML = last
                ? `<div style="padding:12px;border-radius:8px;background:rgba(34,197,94,.08);">✓ Backup terakhir: <strong>${esc(last.filename)}</strong> — ${bytes(last.size_bytes)}</div>`
                : '<div style="padding:12px;border-radius:8px;background:rgba(234,179,8,.08);">Belum ada backup yang berhasil.</div>';
        } catch (e) {
            document.getElementById('mcBackupRows').innerHTML = `<tr><td colspan="6">${esc(e.message)}</td></tr>`;
        }
    }

    async function saveSettings(e) {
        e.preventDefault();
        try {
            await api('/api/backups/settings', {
                method: 'POST',
                body: JSON.stringify({
                    enabled: document.getElementById('mcBackupEnabled').value === '1',
                    frequency: document.getElementById('mcBackupFrequency').value,
                    run_at: document.getElementById('mcBackupRunAt').value,
                    retention_days: Number(document.getElementById('mcBackupRetention').value),
                    scope: 'database',
                    timezone: document.getElementById('mcBackupTimezone').value
                })
            });
            alert('Pengaturan backup berhasil disimpan.');
            load();
        } catch (e) {
            alert('Gagal menyimpan pengaturan: ' + e.message);
        }
    }

    async function runManual() {
        if (!confirm('Buat backup database sekarang?')) return;
        const btn = document.getElementById('mcBackupNow');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuat Backup...';
        try {
            await api('/api/backups/run', {method:'POST', body:'{}'});
            alert('Backup berhasil dibuat.');
            await load();
        } catch (e) {
            alert('Backup gagal: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-database"></i> Backup Sekarang';
        }
    }

    function init() {
        render();
        loadSettings().catch(e => console.warn('[Backup]', e.message));
        load();
    }

    document.addEventListener('DOMContentLoaded', init);
    window.mcBackupInit = init;
})();
