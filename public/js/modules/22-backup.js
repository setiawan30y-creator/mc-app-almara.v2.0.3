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
    const zones = {
        'Asia/Jakarta': 'WIB (Asia/Jakarta)',
        'Asia/Makassar': 'WITA (Asia/Makassar)',
        'Asia/Jayapura': 'WIT (Asia/Jayapura)'
    };
    const state = { defaultDir: '' };

    function esc(v) {
        return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    }

    function bytes(v) {
        v = Number(v || 0);
        if (!v) return '-';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
        return v.toFixed(i ? 1 : 0) + ' ' + units[i];
    }

    function when(value, tz) {
        if (!value) return '-';
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        try {
            return d.toLocaleString('id-ID', { timeZone: tz || 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return d.toLocaleString('id-ID');
        }
    }

    async function api(url, options) {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const doFetch = window.authFetch || window.fetch;
        const res = await doFetch(url, Object.assign({
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf }
        }, options || {}));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const firstError = data.errors ? Object.values(data.errors).flat()[0] : null;
            throw new Error(firstError || data.message || 'Permintaan gagal.');
        }
        return data;
    }

    function render() {
        const root = document.getElementById(rootId);
        if (!root) return;
        const schedulerCmd = [
            "$php = (Get-Command php).Source",
            "$cmd = \"Set-Location 'C:\\laragon\\www\\mc-app-almara.v2.0.3'; & '$php' artisan schedule:run\"",
            "$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument \"-NoProfile -WindowStyle Hidden -Command `\"$cmd`\"\"",
            "$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)",
            "$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew",
            "Register-ScheduledTask -TaskName 'MC Almara Scheduler' -Action $action -Trigger $trigger -Settings $settings"
        ].join('\n');

        root.innerHTML = `
        <style>
            #${rootId} .bk-card{border:1px solid rgba(148,163,184,.28);background:rgba(148,163,184,.07);border-radius:14px;padding:18px 20px;margin-bottom:16px}#${rootId} .table{width:100%}#${rootId} .table th{font-size:.74rem;text-transform:uppercase;letter-spacing:.5px;opacity:.7;white-space:nowrap}#${rootId} .table td{vertical-align:middle;font-size:.84rem}@media(max-width:640px){#${rootId} .bk-grid{grid-template-columns:1fr}}
            #${rootId} .bk-title{display:flex;align-items:center;gap:8px;margin:0 0 14px;font-size:.8rem;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#10b981}
            #${rootId} .bk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
            #${rootId} .bk-grid label{display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;opacity:.85}
            #${rootId} .bk-hint{font-size:.74rem;opacity:.65;margin-top:5px;line-height:1.4}
            #${rootId} .bk-health{border-radius:14px;padding:16px 18px;margin-bottom:16px;border:1px solid}
            #${rootId} .bk-health.ok{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.45)}
            #${rootId} .bk-health.warn{background:rgba(234,179,8,.1);border-color:rgba(234,179,8,.5)}
            #${rootId} .bk-health.danger{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.55)}
            #${rootId} .bk-health ul{margin:8px 0 0;padding-left:20px;font-size:.85rem}
            #${rootId} .bk-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:700}
            #${rootId} .bk-badge.success{background:rgba(34,197,94,.18);color:#22c55e}
            #${rootId} .bk-badge.failed{background:rgba(239,68,68,.18);color:#ef4444}
            #${rootId} .bk-badge.running{background:rgba(59,130,246,.18);color:#3b82f6}
            #${rootId} .bk-row{display:flex;gap:8px;align-items:center}
            #${rootId} .bk-row .form-control{flex:1;min-width:0}
            #${rootId} pre.bk-code{background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:10px;font-size:.74rem;overflow:auto;white-space:pre;margin:10px 0 0}
        </style>
        <div>
            <div style="display:flex;justify-content:flex-end;margin:4px 0 14px;">
                <button type="button" id="mcBackupNow" class="btn btn-primary" style="padding:11px 22px;font-weight:700;">
                    <i class="fa-solid fa-database"></i> Backup Sekarang
                </button>
            </div>
                <div id="mcBackupHealth"></div>

                <form id="mcBackupSettingsForm">
                    <div class="bk-card">
                        <div class="bk-title"><i class="fa-solid fa-clock"></i> Jadwal Backup Otomatis</div>
                        <div class="bk-grid">
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
                                    ${Object.entries(frequencies).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label>Waktu Backup</label>
                                <input id="mcBackupRunAt" type="time" class="form-control" value="02:00">
                                <div class="bk-hint">Untuk frekuensi per jam, ini menjadi jam acuan.</div>
                            </div>
                            <div>
                                <label>Zona Waktu</label>
                                <select id="mcBackupTimezone" class="form-control">
                                    ${Object.entries(zones).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="bk-card">
                        <div class="bk-title"><i class="fa-solid fa-folder-open"></i> Lokasi Penyimpanan</div>
                        <div class="bk-grid">
                            <div>
                                <label>Lokasi Utama</label>
                                <div class="bk-row">
                                    <input id="mcBackupPath" type="text" class="form-control" placeholder="Contoh: D:\\Backup\\MC-Almara" autocomplete="off">
                                    <button type="button" class="btn btn-outline-secondary btn-sm" data-testpath="mcBackupPath">Tes</button>
                                </div>
                                <div class="bk-hint" id="mcBackupPathHint">Kosongkan untuk memakai folder bawaan aplikasi.</div>
                            </div>
                            <div>
                                <label>Salinan Kedua (disarankan)</label>
                                <div class="bk-row">
                                    <input id="mcBackupPath2" type="text" class="form-control" placeholder="Contoh: E:\\Flashdisk\\MC-Almara atau \\\\NAS\\Backup" autocomplete="off">
                                    <button type="button" class="btn btn-outline-secondary btn-sm" data-testpath="mcBackupPath2">Tes</button>
                                </div>
                                <div class="bk-hint">Pakai disk/flashdisk/folder jaringan yang berbeda dari lokasi utama agar backup tetap aman bila disk utama rusak.</div>
                            </div>
                            <div>
                                <label>Isi Backup</label>
                                <select id="mcBackupIncludeUploads" class="form-control">
                                    <option value="1">Database + foto/dokumen nasabah</option>
                                    <option value="0">Database saja</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="bk-card">
                        <div class="bk-title"><i class="fa-solid fa-shield-halved"></i> Retensi &amp; Peringatan</div>
                        <div class="bk-grid">
                            <div>
                                <label>Simpan Selama</label>
                                <select id="mcBackupRetention" class="form-control">
                                    ${[7, 14, 30, 60, 90, 180, 365].map(d => `<option value="${d}">${d} Hari</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label>Minimal Backup Dipertahankan</label>
                                <input id="mcBackupKeepMin" type="number" min="1" max="365" class="form-control" value="7">
                                <div class="bk-hint">Backup sukses terbaru ini tidak akan dihapus walau sudah melewati masa simpan.</div>
                            </div>
                            <div>
                                <label>Peringatkan Jika Tidak Ada Backup Selama</label>
                                <select id="mcBackupAlertHours" class="form-control">
                                    ${[2, 6, 12, 26, 50, 74].map(h => `<option value="${h}">${h} jam</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div style="margin-top:16px;">
                            <button class="btn btn-success" type="submit"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan</button>
                        </div>
                    </div>
                </form>

                <div class="bk-card">
                    <div class="bk-title"><i class="fa-solid fa-gears"></i> Penjadwal Windows</div>
                    <div style="font-size:.85rem;line-height:1.5;">Backup otomatis hanya berjalan bila tugas penjadwal Windows aktif dan komputer menyala. Jika terlewat (misalnya komputer mati), backup susulan dibuat otomatis begitu penjadwal hidup lagi. Jalankan sekali di PowerShell (Run as administrator):</div>
                    <pre class="bk-code" id="mcBackupSchedulerCmd">${esc(schedulerCmd)}</pre>
                    <button type="button" class="btn btn-outline-secondary btn-sm" id="mcBackupCopyCmd" style="margin-top:10px;"><i class="fa-solid fa-copy"></i> Salin Perintah</button>
                </div>

                <div class="bk-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                        <div class="bk-title" style="margin:0;"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Backup</div>
                        <button type="button" class="btn btn-sm btn-outline-secondary" id="mcBackupRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
                    </div>
                    <div style="overflow:auto;margin-top:12px;">
                        <table class="table">
                            <thead><tr><th>Waktu</th><th>Jenis</th><th>File</th><th>Ukuran</th><th>Status</th><th>Salinan 2</th><th>Aksi</th></tr></thead>
                            <tbody id="mcBackupRows"><tr><td colspan="7">Memuat...</td></tr></tbody>
                        </table>
                    </div>
                </div>

                <div class="bk-card" id="mcRestoreCard" style="border-color:rgba(59,130,246,.5);">
                    <div class="bk-title" style="color:#3b82f6;"><i class="fa-solid fa-rotate-left"></i> Restore dari Backup MySQL</div>
                    <div style="font-size:.84rem;line-height:1.5;margin-bottom:14px;">Mengembalikan database ke kondisi saat backup dibuat. Kondisi sekarang otomatis di-backup lebih dulu sebagai pengaman. Semua pengguna perlu login ulang setelah restore.</div>
                    <div class="bk-grid">
                        <div>
                            <label>Pilih Backup dari Riwayat</label>
                            <select id="mcRestoreSource" class="form-control"><option value="">Memuat...</option></select>
                            <label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:500;"><input type="checkbox" id="mcRestoreFiles"> Pulihkan juga foto/dokumen nasabah</label>
                        </div>
                        <div>
                            <label>Atau Unggah File (.sql.gz)</label>
                            <input type="file" id="mcRestoreFile" class="form-control" accept=".gz">
                            <div class="bk-hint">Jika file dipilih, file ini dipakai menggantikan pilihan riwayat.</div>
                        </div>
                        <div>
                            <label>Password Anda</label>
                            <input type="password" id="mcRestorePassword" class="form-control" autocomplete="current-password">
                        </div>
                        <div>
                            <label>Ketik <b>RESTORE</b></label>
                            <input type="text" id="mcRestoreWord" class="form-control" autocomplete="off" placeholder="RESTORE">
                        </div>
                    </div>
                    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                        <button type="button" class="btn btn-primary" id="mcRestoreGo" style="background:#2563eb;border-color:#2563eb;"><i class="fa-solid fa-rotate-left"></i> Restore Database</button>
                        <a href="#" id="mcRestoreLegacy" style="font-size:.8rem;opacity:.75;">Restore dari file JSON lama (browser)</a>
                    </div>
                </div>
        </div>`;

        document.getElementById('mcBackupNow').addEventListener('click', runManual);
        document.getElementById('mcBackupRefresh').addEventListener('click', load);
        document.getElementById('mcBackupSettingsForm').addEventListener('submit', saveSettings);
        document.getElementById('mcBackupCopyCmd').addEventListener('click', copyCommand);
        root.querySelectorAll('[data-testpath]').forEach(btn => btn.addEventListener('click', () => testPath(btn.getAttribute('data-testpath'))));
        document.getElementById('mcBackupRows').addEventListener('click', onRowAction);
        document.getElementById('mcRestoreGo').addEventListener('click', runRestore);
        document.getElementById('mcRestoreLegacy').addEventListener('click', e => { e.preventDefault(); document.getElementById('restoreFileInput')?.click(); });
    }

    function setSelect(id, value, label) {
        const el = document.getElementById(id);
        if (!el) return;
        if (![...el.options].some(o => o.value === String(value))) {
            el.add(new Option(label || String(value), String(value)));
        }
        el.value = String(value);
    }

    async function loadSettings() {
        const r = await api('/api/backups/settings');
        const s = r.data;
        state.defaultDir = r.default_dir || '';
        document.getElementById('mcBackupEnabled').value = s.enabled ? '1' : '0';
        document.getElementById('mcBackupFrequency').value = s.frequency;
        document.getElementById('mcBackupRunAt').value = s.run_at;
        setSelect('mcBackupTimezone', s.timezone || 'Asia/Jakarta');
        setSelect('mcBackupRetention', s.retention_days, s.retention_days + ' Hari');
        setSelect('mcBackupAlertHours', s.alert_after_hours, s.alert_after_hours + ' jam');
        document.getElementById('mcBackupKeepMin').value = s.keep_min_backups;
        document.getElementById('mcBackupPath').value = s.storage_path || '';
        document.getElementById('mcBackupPath2').value = s.secondary_path || '';
        document.getElementById('mcBackupIncludeUploads').value = s.include_uploads ? '1' : '0';
        document.getElementById('mcBackupPathHint').textContent = 'Kosongkan untuk memakai folder bawaan: ' + state.defaultDir;
    }

    function renderHealth(h) {
        const box = document.getElementById('mcBackupHealth');
        if (!box || !h) return;
        const icons = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', danger: 'fa-circle-xmark' };
        const titles = { ok: 'Backup dalam kondisi baik', warn: 'Perlu perhatian', danger: 'Backup bermasalah' };
        const last = h.last_success;
        const lines = [];
        if (last) lines.push(`Backup berhasil terakhir: <strong>${esc(when(last.created_at, h.timezone))}</strong> (${esc(bytes(last.size_bytes))})`);
        if (h.next_run) lines.push(`Jadwal berikutnya: <strong>${esc(when(h.next_run, h.timezone))}</strong>`);
        lines.push('Penjadwal Windows: <strong>' + (h.scheduler_alive ? 'aktif' : 'belum terdeteksi') + '</strong>');
        box.innerHTML = `
            <div class="bk-health ${esc(h.level)}">
                <div style="font-weight:800;"><i class="fa-solid ${icons[h.level] || icons.warn}"></i> ${titles[h.level] || ''}</div>
                <div style="font-size:.85rem;margin-top:6px;line-height:1.6;">${lines.join('<br>')}</div>
                ${(h.messages || []).length ? `<ul>${h.messages.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
            </div>`;
    }

    async function load() {
        try {
            const r = await api('/api/backups');
            renderHealth(r.health);
            const sel = document.getElementById('mcRestoreSource');
            if (sel) {
                const keep = sel.value;
                const okLogs = (r.data || []).filter(l => l.status === 'success');
                sel.innerHTML = '<option value="">- pilih backup -</option>' + okLogs.map(l => {
                    const files = Array.isArray((l.metadata || {}).files) ? l.metadata.files : [];
                    const hasFiles = files.some(f => f.kind === 'files');
                    return `<option value="${l.id}" data-files="${hasFiles ? 1 : 0}">${esc(when(l.created_at, r.health && r.health.timezone))} - ${esc(l.filename)} (${esc(bytes(l.size_bytes))})</option>`;
                }).join('');
                if (keep) sel.value = keep;
            }
            const rows = document.getElementById('mcBackupRows');
            const tz = r.health && r.health.timezone;
            rows.innerHTML = (r.data || []).map(log => {
                const meta = log.metadata || {};
                const files = Array.isArray(meta.files) ? meta.files : [];
                const hasFiles = files.some(f => f.kind === 'files');
                const copies = (meta.secondary_dirs || []).length;
                const copyCell = log.status !== 'success' ? '-' : (copies ? '<span class="bk-badge success">Ada</span>' : '<span class="bk-badge failed" style="background:rgba(234,179,8,.18);color:#eab308">Tidak</span>');
                const actions = log.status === 'success'
                    ? `<a class="btn btn-sm btn-outline-primary" href="/api/backups/${log.id}/download"><i class="fa-solid fa-download"></i> DB</a>
                       ${hasFiles ? `<a class="btn btn-sm btn-outline-primary" href="/api/backups/${log.id}/download?kind=files"><i class="fa-solid fa-images"></i> Foto</a>` : ''}
                       <button type="button" class="btn btn-sm btn-outline-secondary" data-verify="${log.id}"><i class="fa-solid fa-shield-halved"></i> Verifikasi</button>`
                    : (log.error_message ? `<span title="${esc(log.error_message)}" style="cursor:help;text-decoration:underline dotted;">Lihat error</span>` : '-');
                return `<tr>
                    <td>${esc(when(log.created_at, tz))}</td>
                    <td>${log.type === 'automatic' ? 'Otomatis' : 'Manual'}</td>
                    <td style="max-width:260px;word-break:break-all;">${esc(log.filename)}</td>
                    <td>${bytes(log.size_bytes)}</td>
                    <td><span class="bk-badge ${esc(log.status)}">${esc(log.status)}</span></td>
                    <td>${copyCell}</td>
                    <td style="white-space:nowrap;">${actions}</td>
                </tr>`;
            }).join('') || '<tr><td colspan="7">Belum ada backup.</td></tr>';
        } catch (e) {
            document.getElementById('mcBackupRows').innerHTML = `<tr><td colspan="7">${esc(e.message)}</td></tr>`;
        }
    }

    async function onRowAction(ev) {
        const btn = ev.target.closest('[data-verify]');
        if (!btn) return;
        btn.disabled = true;
        try {
            const r = await api('/api/backups/' + btn.getAttribute('data-verify') + '/verify', { method: 'POST', body: '{}' });
            const bad = (r.results || []).filter(x => !x.valid);
            alert(r.valid
                ? 'Verifikasi berhasil: semua file backup utuh (checksum cocok).'
                : 'Verifikasi GAGAL:\n' + bad.map(x => `- ${x.file} (${x.location}): ${x.exists ? 'isi berubah/rusak' : 'file tidak ditemukan'}`).join('\n'));
            load();
        } catch (e) {
            alert('Verifikasi gagal: ' + e.message);
        } finally {
            btn.disabled = false;
        }
    }

    async function testPath(inputId) {
        const value = document.getElementById(inputId).value.trim();
        if (!value) {
            alert(inputId === 'mcBackupPath' ? 'Lokasi kosong: aplikasi memakai folder bawaan.' : 'Isi lokasi terlebih dahulu.');
            return;
        }
        try {
            const r = await api('/api/backups/test-path', { method: 'POST', body: JSON.stringify({ path: value }) });
            alert('Lokasi bisa dipakai.\n' + r.path + (r.free_bytes != null ? '\nRuang kosong: ' + bytes(r.free_bytes) : ''));
        } catch (e) {
            alert('Lokasi tidak bisa dipakai:\n' + e.message);
        }
    }

    async function copyCommand() {
        const text = document.getElementById('mcBackupSchedulerCmd').textContent;
        try {
            await navigator.clipboard.writeText(text);
            alert('Perintah disalin. Tempel di PowerShell (Run as administrator).');
        } catch (e) {
            alert('Tidak bisa menyalin otomatis. Blok dan salin teks perintah secara manual.');
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
                    timezone: document.getElementById('mcBackupTimezone').value,
                    retention_days: Number(document.getElementById('mcBackupRetention').value),
                    keep_min_backups: Number(document.getElementById('mcBackupKeepMin').value),
                    alert_after_hours: Number(document.getElementById('mcBackupAlertHours').value),
                    include_uploads: document.getElementById('mcBackupIncludeUploads').value === '1',
                    storage_path: document.getElementById('mcBackupPath').value.trim(),
                    secondary_path: document.getElementById('mcBackupPath2').value.trim()
                })
            });
            alert('Pengaturan backup berhasil disimpan.');
            load();
        } catch (err) {
            alert('Gagal menyimpan pengaturan: ' + err.message);
        }
    }

    async function runManual() {
        if (!confirm('Buat backup sekarang? Proses bisa memakan waktu beberapa menit.')) return;
        const btn = document.getElementById('mcBackupNow');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuat Backup...';
        try {
            const r = await api('/api/backups/run', { method: 'POST', body: '{}' });
            const warn = r.data && r.data.metadata && r.data.metadata.warnings || [];
            alert('Backup berhasil dibuat dan diverifikasi.' + (warn.length ? '\n\nCatatan:\n- ' + warn.join('\n- ') : ''));
        } catch (err) {
            alert('Backup gagal: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-database"></i> Backup Sekarang';
            load();
        }
    }

    function init() {
        render();
        loadSettings().catch(e => console.warn('[Backup]', e.message));
        load();
    }

    async function runRestore() {
        const sel = document.getElementById('mcRestoreSource');
        const file = document.getElementById('mcRestoreFile').files[0];
        const password = document.getElementById('mcRestorePassword').value;
        const word = document.getElementById('mcRestoreWord').value.trim();
        if (!file && !sel.value) { alert('Pilih backup dari riwayat atau unggah file .sql.gz.'); return; }
        if (!password) { alert('Isi password Anda untuk konfirmasi.'); return; }
        if (word !== 'RESTORE') { alert('Ketik RESTORE (huruf besar) untuk konfirmasi.'); return; }
        if (!confirm('Database akan DITIMPA dengan isi backup yang dipilih. Data yang dibuat setelah backup tersebut akan hilang (kondisi sekarang tetap disimpan sebagai backup pengaman).\n\nLanjutkan restore?')) return;

        const btn = document.getElementById('mcRestoreGo');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memulihkan... jangan tutup halaman';
        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const doFetch = window.authFetch || window.fetch;
            let res;
            if (file) {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('password', password);
                fd.append('confirm', word);
                res = await doFetch('/api/backups/restore-upload', { method: 'POST', credentials: 'same-origin', headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrf }, body: fd });
            } else {
                res = await doFetch('/api/backups/' + sel.value + '/restore', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
                    body: JSON.stringify({ password, confirm: word, with_files: document.getElementById('mcRestoreFiles').checked })
                });
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const firstError = data.errors ? Object.values(data.errors).flat()[0] : null;
                throw new Error(firstError || data.message || 'Restore gagal.');
            }
            try { Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
            alert('Restore berhasil.' + (data.safety_backup ? '\nBackup pengaman: ' + data.safety_backup : '') + (data.files_restored ? '\nFoto/dokumen dipulihkan: ' + data.files_restored : '') + '\n\nHalaman akan dimuat ulang; login kembali bila diminta.');
            window.location.reload();
        } catch (e) {
            alert('Restore gagal: ' + e.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Restore Database';
        }
    }

    // Tombol "Restore Database" di Danger Zone: arahkan ke kartu restore MySQL.
    window.triggerRestore = function () {
        const card = document.getElementById('mcRestoreCard');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.boxShadow = '0 0 0 3px rgba(59,130,246,.5)';
            setTimeout(() => { card.style.boxShadow = ''; }, 1800);
        } else {
            document.getElementById('restoreFileInput')?.click();
        }
    };

    function hookTab() {
        const orig = window.switchSettingsTab;
        if (typeof orig !== 'function' || window.__bkHooked) return;
        window.__bkHooked = true;
        const wrapped = function (tab) {
            const r = orig.apply(this, arguments);
            if (tab === 'danger') { loadSettings().catch(() => {}); load(); }
            return r;
        };
        window.switchSettingsTab = wrapped;
    }

    document.addEventListener('DOMContentLoaded', function () { init(); hookTab(); });
    window.addEventListener('load', hookTab);
    window.mcBackupInit = init;
})();
