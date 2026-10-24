// Pengaturan -> Pengguna & Akses
// Daftar pengguna, form pengguna, dan editor hak akses role.
// Semua warna memakai variabel tema (--mc-*), jadi ikut Tema & Tampilan.
// Bergantung pada 08-auth.js: getCurrentUser, getUsers, saveUsers, getRolePermissions,
// getUserRoleMeta, getAccessRoleForUserRole, populateUserRoleSelect, populateRoleAccessEditorSelect,
// ROLE_ACCESS_* dan window.refreshServerUsers / window.authFetch.
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const state = { users: [], q: '', role: 'all', saving: false, accessDirty: false };

    const GROUPS = {
        manage: { label: 'Pengelola', icon: 'fa-user-shield', roles: ['owner', 'superadmin', 'admin', 'supervisor'] },
        ops: { label: 'Operasional', icon: 'fa-cash-register', roles: ['kasir', 'teller'] },
        other: { label: 'Lainnya', icon: 'fa-user-group', roles: ['kurir', 'keamanan', 'papan', 'lainnya'] }
    };

    const ROLE_HINT = {
        owner: 'Akses penuh ke seluruh menu, termasuk pengguna dan Danger Zone.',
        superadmin: 'Mengelola pengguna dan hak akses, tanpa melihat akun Owner.',
        admin: 'Mengelola operasional dan laporan. Tidak bisa mengelola pengguna.',
        supervisor: 'Mengikuti hak akses Admin untuk pengawasan harian.',
        kasir: 'Transaksi harian, nasabah, dan closing sesuai hak akses Kasir.',
        teller: 'Transaksi dan layanan nasabah dengan menu terbatas.',
        kurir: 'Akun pendukung operasional, menu mengikuti hak akses Teller.',
        keamanan: 'Akun pendukung keamanan, menu mengikuti hak akses Teller.',
        papan: 'Akun khusus tampilan papan kurs.',
        lainnya: 'Akun umum dengan menu terbatas (hak akses Teller).'
    };

    // ---------- util ----------
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    function cssVar(name, fallback) {
        try {
            const v = getComputedStyle(document.body).getPropertyValue(name).trim();
            return v || fallback;
        } catch (e) { return fallback; }
    }

    function swalOpts(extra) {
        return Object.assign({
            background: cssVar('--mc-card-bg', '#1e293b'),
            color: cssVar('--mc-text', '#f8fafc'),
            confirmButtonColor: cssVar('--mc-primary', '#22c55e'),
            cancelButtonColor: cssVar('--mc-secondary', '#64748b')
        }, extra || {});
    }

    window.uaToast = function (icon, title) {
        if (window.Swal) {
            window.Swal.fire(swalOpts({ icon, title, toast: true, position: 'top-end', timer: 2200, showConfirmButton: false }));
        } else {
            alert(title);
        }
    };

    function uaConfirm(opts) {
        if (!window.Swal) return Promise.resolve(window.confirm(opts.text || opts.title));
        return window.Swal.fire(swalOpts({
            icon: opts.icon || 'warning',
            title: opts.title,
            text: opts.text,
            showCancelButton: true,
            confirmButtonText: opts.confirmText || 'Ya',
            cancelButtonText: 'Batal',
            confirmButtonColor: opts.danger ? cssVar('--mc-danger', '#ef4444') : cssVar('--mc-primary', '#22c55e')
        })).then((r) => !!r.isConfirmed);
    }

    function me() {
        const u = (typeof getCurrentUser === 'function' && getCurrentUser()) || {};
        return { id: String(u.id == null ? '' : u.id), role: String(u.role || '').toLowerCase() };
    }

    function canManageUsers() {
        const r = me().role;
        return r === 'owner' || r === 'superadmin';
    }

    function initials(user) {
        const src = String(user.fullName || user.username || '?').trim();
        const parts = src.split(/\s+/).filter(Boolean);
        const letters = (parts[0] ? parts[0][0] : '?') + (parts[1] ? parts[1][0] : '');
        return letters.toUpperCase();
    }

    function avatarHtml(user, size) {
        const meta = getUserRoleMeta(user.role);
        const style = `--ua-c:${meta.color};${size ? `width:${size}px;height:${size}px;` : ''}`;
        if (user.photo) {
            return `<span class="ua-av" style="${style}"><img src="${esc(user.photo)}" alt=""></span>`;
        }
        return `<span class="ua-av" style="${style}">${esc(initials(user))}</span>`;
    }

    // ---------- daftar pengguna ----------
    function visibleUsers() {
        const viewer = me();
        return state.users.filter((u) => !(viewer.role === 'superadmin' && String(u.role || '').toLowerCase() === 'owner'));
    }

    function renderStats(list) {
        const box = $('uaStats');
        if (!box) return;
        const count = (roles) => list.filter((u) => roles.includes(String(u.role || '').toLowerCase())).length;
        const cards = [
            { icon: 'fa-users', label: 'Total Pengguna', value: list.length, tone: 'primary' },
            ...Object.values(GROUPS).map((g, i) => ({ icon: g.icon, label: g.label, value: count(g.roles), tone: ['info', 'buy', 'warning'][i] }))
        ];
        box.innerHTML = cards.map((c) => `
            <div class="ua-stat tone-${c.tone}">
                <span class="ua-stat-ico"><i class="fa-solid ${c.icon}"></i></span>
                <div><strong>${c.value}</strong><small>${esc(c.label)}</small></div>
            </div>`).join('');
    }

    function renderRoleFilter(list) {
        const sel = $('uaRoleFilter');
        if (!sel) return;
        const roles = Array.from(new Set(list.map((u) => String(u.role || '').toLowerCase()).filter(Boolean)));
        const prev = state.role;
        sel.innerHTML = '<option value="all">Semua role</option>' + roles.map((r) =>
            `<option value="${esc(r)}">${esc(getUserRoleMeta(r).label)}</option>`).join('');
        sel.value = roles.includes(prev) ? prev : 'all';
        state.role = sel.value;
    }

    function matches(user) {
        const role = String(user.role || '').toLowerCase();
        if (state.role !== 'all' && role !== state.role) return false;
        const q = state.q.trim().toLowerCase();
        if (!q) return true;
        return [user.username, user.fullName, getUserRoleMeta(role).label].some((v) => String(v || '').toLowerCase().includes(q));
    }

    function renderTable() {
        const body = $('userTableBody');
        if (!body) return;
        const all = visibleUsers();
        const rows = all.filter(matches);
        const viewer = me();
        const canEdit = canManageUsers();

        const countEl = $('uaCount');
        if (countEl) countEl.textContent = rows.length === all.length ? `${all.length} pengguna` : `${rows.length} dari ${all.length} pengguna`;

        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="4" class="ua-empty"><i class="fa-solid fa-user-slash"></i><div>${all.length ? 'Tidak ada pengguna yang cocok dengan pencarian.' : 'Belum ada pengguna.'}</div></td></tr>`;
            return;
        }

        body.innerHTML = rows.map((u) => {
            const role = String(u.role || '').toLowerCase();
            const meta = getUserRoleMeta(role);
            const accessRole = getAccessRoleForUserRole(role);
            const isSelf = String(u.id) === viewer.id;
            const hasCustom = !!userOverrides()[String(u.id)];
            const canGrant = canEdit && !isSelf && role !== 'owner';
            const actions = canEdit ? `
                ${canGrant ? `<button type="button" class="ua-icon-btn" data-ua-act="access" data-id="${esc(u.id)}" title="Atur akses menu pengguna ini"><i class="fa-solid fa-user-lock"></i></button>` : ''}
                <button type="button" class="ua-icon-btn" data-ua-act="edit" data-id="${esc(u.id)}" title="Edit pengguna"><i class="fa-solid fa-pen"></i></button>
                ${isSelf ? '' : `<button type="button" class="ua-icon-btn danger" data-ua-act="delete" data-id="${esc(u.id)}" title="Hapus pengguna"><i class="fa-solid fa-trash"></i></button>`}` : '<span class="ua-muted">-</span>';
            return `
                <tr>
                    <td>
                        <div class="ua-user">
                            ${avatarHtml(u)}
                            <div class="ua-user-txt">
                                <b>${esc(u.fullName || u.username)}${isSelf ? ' <span class="ua-you">Anda</span>' : ''}</b>
                                <small>@${esc(u.username)}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="ua-badge" style="--ua-c:${meta.color}">${esc(meta.label)}</span></td>
                    <td><span class="ua-muted">Hak akses ${esc(getUserRoleMeta(accessRole).label)}</span>${hasCustom ? ' <span class="ua-custom-tag" title="Punya pengecualian akses khusus"><i class="fa-solid fa-star"></i> Khusus</span>' : ''}</td>
                    <td class="ua-actions-cell">${actions}</td>
                </tr>`;
        }).join('');
    }

    function renderAll() {
        const list = visibleUsers();
        renderStats(list);
        renderRoleFilter(list);
        renderTable();
        renderRolePills();
        renderUserAccess();
    }

    window.loadUsersTable = async function loadUsersTable() {
        try {
            state.users = await window.refreshServerUsers();
        } catch (e) {
            state.users = (typeof getUsers === 'function' ? getUsers() : []) || [];
        }
        renderAll();
    };

    // ---------- modal pengguna ----------
    function setPreview(src, user) {
        const box = $('previewUserPhoto');
        if (!box) return;
        const u = user || { fullName: $('mUserFullName')?.value, username: $('mUserUsername')?.value, role: $('mUserRole')?.value, photo: src };
        u.photo = src;
        box.innerHTML = avatarHtml(u, 76);
        const clear = $('uaPhotoClear');
        if (clear) clear.style.display = src ? '' : 'none';
    }

    function updateRoleHint() {
        const sel = $('mUserRole');
        const hint = $('uaRoleHint');
        if (!sel || !hint) return;
        hint.textContent = ROLE_HINT[sel.value] || '';
    }

    function updatePwMeter() {
        const pw = $('mUserPassword')?.value || '';
        const bar = $('uaPwBar');
        const txt = $('uaPwText');
        if (!bar || !txt) return;
        if (!pw) {
            bar.style.width = '0';
            txt.textContent = $('editUserId')?.value ? 'Kosongkan jika password tidak diubah.' : 'Minimal 6 karakter.';
            bar.className = '';
            return;
        }
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 10) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
        const levels = [['Terlalu pendek', 'weak'], ['Lemah', 'weak'], ['Cukup', 'mid'], ['Baik', 'good'], ['Kuat', 'good']];
        const lvl = pw.length < 6 ? 0 : score;
        bar.style.width = `${Math.max(12, lvl * 25)}%`;
        bar.className = levels[lvl][1];
        txt.textContent = levels[lvl][0];
    }

    function openModal(title) {
        $('userModalTitle').textContent = title;
        $('userModal').style.display = 'flex';
        updateRoleHint();
        updatePwMeter();
        setTimeout(() => $('mUserUsername')?.focus(), 30);
    }

    window.openUserModal = function () {
        populateUserRoleSelect();
        $('editUserId').value = '';
        $('mUserUsername').value = '';
        $('mUserFullName').value = '';
        $('mUserPassword').value = '';
        $('mUserPassword').type = 'password';
        $('mUserRole').value = 'kasir';
        $('mUserPhoto').value = '';
        window._tempUserPhoto = '';
        setPreview('');
        openModal('Tambah Pengguna Baru');
    };

    window.closeUserModal = function () {
        const modal = $('userModal');
        if (modal) modal.style.display = 'none';
    };

    window.editUser = function (id) {
        const u = (typeof getUsers === 'function' ? getUsers() : state.users).find((x) => String(x.id) === String(id));
        if (!u) return;
        populateUserRoleSelect();
        $('editUserId').value = u.id;
        $('mUserUsername').value = u.username || '';
        $('mUserFullName').value = u.fullName || '';
        $('mUserPassword').value = '';
        $('mUserPassword').type = 'password';
        $('mUserPhoto').value = '';
        const sel = $('mUserRole');
        const roleValue = String(u.role || 'kasir').toLowerCase();
        sel.value = sel.querySelector(`option[value="${roleValue}"]`) ? roleValue : getAccessRoleForUserRole(roleValue);
        window._tempUserPhoto = u.photo || '';
        setPreview(u.photo || '', Object.assign({}, u));
        openModal('Edit Pengguna');
    };

    window._tempUserPhoto = '';
    window.handleUserPhoto = function (input) {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            window.uaToast('error', 'Ukuran foto maksimal 3 MB.');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            window._tempUserPhoto = e.target.result;
            setPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    };

    window.clearUserPhoto = function () {
        window._tempUserPhoto = '';
        const input = $('mUserPhoto');
        if (input) input.value = '';
        setPreview('');
    };

    window.toggleUserPassword = function () {
        const input = $('mUserPassword');
        const icon = $('uaPwEye');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        if (icon) icon.className = `fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`;
    };

    window.saveUser = async function saveUser() {
        if (state.saving) return;
        const id = $('editUserId').value;
        const username = $('mUserUsername').value.trim();
        const fullName = $('mUserFullName').value.trim();
        const password = $('mUserPassword').value;
        const role = $('mUserRole').value;

        if (!username || !fullName) return window.uaToast('warning', 'Username dan Nama Lengkap wajib diisi.');
        if (/\s/.test(username)) return window.uaToast('warning', 'Username tidak boleh mengandung spasi.');
        if (!id && !password) return window.uaToast('warning', 'Password wajib diisi untuk pengguna baru.');
        if (password && password.length < 6) return window.uaToast('warning', 'Password minimal 6 karakter.');
        const dup = state.users.find((u) => String(u.username || '').toLowerCase() === username.toLowerCase() && String(u.id) !== String(id));
        if (dup) return window.uaToast('warning', 'Username sudah dipakai pengguna lain.');

        const saveBtn = $('uaSaveBtn');
        state.saving = true;
        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...'; }
        try {
            let photo = window._tempUserPhoto || '';
            if (photo && photo.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
                photo = await window.uploadBase64FileToFolder(photo, 'users/photos', `${username}-foto-user`);
            }
            const response = await window.authFetch('api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, username, fullName, password: password || undefined, role, photo })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'Data pengguna gagal disimpan.');
            await window.loadUsersTable();
            window.closeUserModal();
            window.uaToast('success', 'Data pengguna berhasil disimpan.');
        } catch (error) {
            window.uaToast('error', error.message || String(error));
        } finally {
            state.saving = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Pengguna'; }
        }
    };

    window.deleteUser = async function deleteUser(id) {
        const u = state.users.find((x) => String(x.id) === String(id));
        const ok = await uaConfirm({
            title: 'Hapus pengguna?',
            text: `${u ? (u.fullName || u.username) : 'Pengguna ini'} tidak akan bisa masuk lagi.`,
            confirmText: 'Ya, hapus',
            danger: true
        });
        if (!ok) return;
        try {
            const response = await window.authFetch(`api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'Pengguna gagal dihapus.');
            await window.loadUsersTable();
            window.uaToast('success', 'Pengguna berhasil dihapus.');
        } catch (error) {
            window.uaToast('error', error.message || 'Pengguna gagal dihapus.');
        }
    };

    // ---------- editor hak akses ----------
    function setAccessDirty(flag) {
        state.accessDirty = !!flag;
        const el = $('raDirty');
        if (el) el.hidden = !state.accessDirty;
    }

    function renderRolePills() {
        const box = $('raRolePills');
        const sel = $('roleAccessEditor');
        if (!box || !sel) return;
        box.innerHTML = Array.from(sel.options).map((o) => {
            const n = visibleUsers().filter((u) => getAccessRoleForUserRole(String(u.role || '').toLowerCase()) === o.value).length;
            const meta = getUserRoleMeta(o.value);
            return `<button type="button" class="ua-pill${o.value === sel.value ? ' active' : ''}" data-ra-role="${esc(o.value)}" style="--ua-c:${meta.color}">
                <span class="ua-dot"></span>${esc(o.textContent)}${n ? `<em>${n}</em>` : ''}</button>`;
        }).join('');
    }

    function updateAccessSummary() {
        const el = $('raSummary');
        if (!el) return;
        const count = (cls) => {
            const all = document.querySelectorAll('#roleAccessSettingsPanel ' + cls);
            return [Array.from(all).filter((c) => c.checked).length, all.length];
        };
        const [m, mt] = count('.role-access-menu');
        const [s, st] = count('.role-access-special');
        const [a, at] = count('.role-access-action');
        el.innerHTML = `<span><b>${m}</b>/${mt} menu</span><span><b>${s}</b>/${st} area khusus</span><span><b>${a}</b>/${at} hak aksi</span>`;
        updateGroupCounts('#roleAccessSettingsPanel');
    }

    function updateGroupCounts(rootSel) {
        document.querySelectorAll(rootSel + ' .ua-group').forEach((g) => {
            const boxes = g.querySelectorAll('input[type="checkbox"]');
            const on = Array.from(boxes).filter((c) => c.checked).length;
            const c = g.querySelector('.ua-group-count');
            if (c) c.textContent = `${on}/${boxes.length}`;
        });
    }

    function optionHtml(cls, item, checked) {
        return `<label class="ua-opt" data-search="${esc(String(item.label).toLowerCase())}">
            <input type="checkbox" class="${cls}" value="${esc(item.key)}"${checked ? ' checked' : ''}>
            <span class="ua-sw"></span><span class="ua-opt-txt">${esc(item.label)}</span></label>`;
    }

    function groupHtml(title, bodyHtml, extraClass) {
        return `<div class="ua-group ${extraClass || ''}">
            <div class="ua-group-head">
                <b>${esc(title)}</b><span class="ua-group-count"></span>
                <span class="ua-group-btns">
                    <button type="button" class="ua-link" data-ra-all="1">Pilih semua</button>
                    <button type="button" class="ua-link" data-ra-all="0">Kosongkan</button>
                </span>
            </div>
            <div class="ua-opts">${bodyHtml}</div>
        </div>`;
    }

    window.loadRoleAccessEditor = function () {
        populateRoleAccessEditorSelect();
        const roleSelect = $('roleAccessEditor');
        const menuBox = $('roleAccessMenuList');
        const specialBox = $('roleAccessSpecialList');
        const actionBox = $('roleAccessActionList');
        if (!roleSelect || !menuBox || !specialBox || !actionBox || typeof getRolePermissions !== 'function') return;

        const role = roleSelect.value;
        const permissions = getRolePermissions();
        const config = permissions[role] || { menus: [], special: {}, actions: {} };
        const viewer = me();
        const viewerAccess = getAccessRoleForUserRole(viewer.role);
        const viewerConfig = permissions[viewerAccess] || { menus: [], special: {}, actions: {} };
        const isOwner = viewerAccess === 'owner';

        const menuGroups = ROLE_ACCESS_MENU_GROUPS.map((g) => ({
            title: g.title,
            items: g.items.filter((i) => isOwner || (viewerConfig.menus || []).includes(i.key))
        })).filter((g) => g.items.length);
        const specials = ROLE_ACCESS_SPECIAL_OPTIONS.filter((i) => isOwner || !!viewerConfig.special?.[i.key]);
        const actions = ROLE_ACCESS_ACTION_OPTIONS.filter((i) => isOwner || !!viewerConfig.actions?.[i.key]);

        menuBox.innerHTML = menuGroups.map((g) =>
            groupHtml(g.title, g.items.map((i) => optionHtml('role-access-menu', i, (config.menus || []).includes(i.key))).join(''))).join('');
        specialBox.innerHTML = specials.length
            ? groupHtml('Area Khusus', specials.map((i) => optionHtml('role-access-special', i, !!config.special?.[i.key])).join(''), 'compact') : '';
        actionBox.innerHTML = actions.length
            ? groupHtml('Hak Tombol Aksi', actions.map((i) => optionHtml('role-access-action', i, !!config.actions?.[i.key])).join(''), 'compact') : '';

        const note = $('raNote');
        if (note) {
            const notes = [];
            if (!isOwner) notes.push('Anda hanya melihat opsi yang Anda miliki sendiri.');
            if (role === viewerAccess) notes.push('Anda sedang mengubah hak akses role Anda sendiri.');
            note.innerHTML = notes.map((n) => `<i class="fa-solid fa-circle-info"></i> ${esc(n)}`).join(' &nbsp; ');
            note.style.display = notes.length ? '' : 'none';
        }

        const search = $('raSearch');
        if (search) search.value = '';
        setAccessDirty(false);
        renderRolePills();
        updateAccessSummary();
    };

    function filterAccess(rootSel, inputId) {
        const q = ($(inputId)?.value || '').trim().toLowerCase();
        document.querySelectorAll(rootSel + ' .ua-group').forEach((g) => {
            let visible = 0;
            g.querySelectorAll('.ua-opt').forEach((o) => {
                const show = !q || o.dataset.search.includes(q);
                o.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            g.style.display = visible ? '' : 'none';
        });
    }

    // ---------- akses per pengguna (pengecualian dari role) ----------
    const US = { userId: '', dirty: false };

    function userOverrides() {
        return typeof getUserPermissionOverrides === 'function' ? getUserPermissionOverrides() : {};
    }

    function editableUsers() {
        const viewer = me();
        return visibleUsers().filter((u) => String(u.role || '').toLowerCase() !== 'owner' && String(u.id) !== viewer.id);
    }

    function setUserDirty(flag) {
        US.dirty = !!flag;
        const el = $('uaUDirty');
        if (el) el.hidden = !US.dirty;
    }

    function updateUserSummary() {
        const el = $('uaUSummary');
        if (!el) return;
        const count = (cls) => {
            const all = document.querySelectorAll('#userAccessPanel ' + cls);
            return [Array.from(all).filter((c) => c.checked).length, all.length];
        };
        const [m, mt] = count('.user-access-menu');
        const [s, st] = count('.user-access-special');
        const [a, at] = count('.user-access-action');
        el.innerHTML = `<span><b>${m}</b>/${mt} menu</span><span><b>${s}</b>/${st} area khusus</span><span><b>${a}</b>/${at} hak aksi</span>`;
        updateGroupCounts('#userAccessPanel');
    }

    function renderUserSelect() {
        const sel = $('uaUserSel');
        if (!sel) return;
        const list = editableUsers();
        const ov = userOverrides();
        sel.innerHTML = list.length
            ? list.map((u) => `<option value="${esc(u.id)}">${esc(u.fullName || u.username)} (@${esc(u.username)}) - ${esc(getUserRoleMeta(u.role).label)}${ov[String(u.id)] ? ' *' : ''}</option>`).join('')
            : '<option value="">Belum ada pengguna lain</option>';
        US.userId = list.some((u) => String(u.id) === US.userId) ? US.userId : (list[0] ? String(list[0].id) : '');
        sel.value = US.userId;
    }

    function renderCustomList() {
        const box = $('uaCustomList');
        if (!box) return;
        const ov = userOverrides();
        const rows = editableUsers().filter((u) => ov[String(u.id)]);
        if (!rows.length) {
            box.innerHTML = '<div class="ua-muted" style="padding:6px 2px;">Belum ada pengguna dengan akses khusus. Semua mengikuti role masing-masing.</div>';
            return;
        }
        box.innerHTML = rows.map((u) => {
            const o = ov[String(u.id)];
            const meta = getUserRoleMeta(u.role);
            return `<div class="ua-crow">
                ${avatarHtml(u)}
                <div class="ua-user-txt"><b>${esc(u.fullName || u.username)}</b><small>@${esc(u.username)}</small></div>
                <span class="ua-badge" style="--ua-c:${meta.color}">${esc(meta.label)}</span>
                <span class="ua-muted">${(o.menus || []).length} menu</span>
                <span class="ua-crow-btns">
                    <button type="button" class="ua-icon-btn" data-uc-edit="${esc(u.id)}" title="Atur"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="ua-icon-btn danger" data-uc-remove="${esc(u.id)}" title="Kembalikan ke role"><i class="fa-solid fa-rotate-left"></i></button>
                </span>
            </div>`;
        }).join('');
    }

    function renderUserAccess() {
        if (!$('userAccessPanel')) return;
        renderUserSelect();
        renderCustomList();
        if (!US.dirty) loadUserAccessEditor();
    }

    function loadUserAccessEditor(opts) {
        opts = opts || {};
        const menuBox = $('uaUserMenuList');
        const specialBox = $('uaUserSpecialList');
        const actionBox = $('uaUserActionList');
        const cols = $('uaUCols');
        const info = $('uaUInfo');
        const toggle = $('uaCustomOn');
        if (!menuBox || !specialBox || !actionBox || typeof getRolePermissions !== 'function') return;

        const user = state.users.find((u) => String(u.id) === US.userId);
        if (!user) {
            menuBox.innerHTML = specialBox.innerHTML = actionBox.innerHTML = '';
            if (toggle) { toggle.checked = false; toggle.disabled = true; }
            if (info) info.textContent = 'Pilih pengguna terlebih dahulu.';
            updateUserSummary();
            return;
        }

        const perms = getRolePermissions();
        const accessRole = getAccessRoleForUserRole(String(user.role || '').toLowerCase());
        const base = perms[accessRole] || { menus: [], special: {}, actions: {} };
        const ov = userOverrides()[String(user.id)];
        const useCustom = opts.keepCustom ? !!(toggle && toggle.checked) : !!ov;
        const cfg = (ov && !opts.forceBase) ? {
            menus: Array.isArray(ov.menus) ? ov.menus : base.menus,
            special: Object.assign({}, base.special, ov.special || {}),
            actions: Object.assign({}, base.actions, ov.actions || {})
        } : base;

        const viewerAccess = getAccessRoleForUserRole(me().role);
        const viewerConfig = perms[viewerAccess] || { menus: [], special: {}, actions: {} };
        const isOwner = viewerAccess === 'owner';
        const groups = ROLE_ACCESS_MENU_GROUPS.map((g) => ({
            title: g.title,
            items: g.items.filter((i) => isOwner || (viewerConfig.menus || []).includes(i.key))
        })).filter((g) => g.items.length);
        const specials = ROLE_ACCESS_SPECIAL_OPTIONS.filter((i) => isOwner || !!viewerConfig.special?.[i.key]);
        const actions = ROLE_ACCESS_ACTION_OPTIONS.filter((i) => isOwner || !!viewerConfig.actions?.[i.key]);

        menuBox.innerHTML = groups.map((g) =>
            groupHtml(g.title, g.items.map((i) => optionHtml('user-access-menu', i, (cfg.menus || []).includes(i.key))).join(''))).join('');
        specialBox.innerHTML = specials.length
            ? groupHtml('Area Khusus', specials.map((i) => optionHtml('user-access-special', i, !!cfg.special?.[i.key])).join(''), 'compact') : '';
        actionBox.innerHTML = actions.length
            ? groupHtml('Hak Tombol Aksi', actions.map((i) => optionHtml('user-access-action', i, !!cfg.actions?.[i.key])).join(''), 'compact') : '';

        if (toggle) { toggle.disabled = false; toggle.checked = useCustom; }
        if (cols) cols.classList.toggle('is-locked', !useCustom);
        if (info) {
            const roleLabel = getUserRoleMeta(accessRole).label;
            info.innerHTML = useCustom
                ? `<i class="fa-solid fa-star"></i> Akses khusus untuk <b>${esc(user.fullName || user.username)}</b>. Pengaturan ini menggantikan hak akses role ${esc(roleLabel)} untuk akun ini saja.`
                : `<i class="fa-solid fa-circle-info"></i> <b>${esc(user.fullName || user.username)}</b> mengikuti hak akses role ${esc(roleLabel)}. Aktifkan akses khusus untuk membuat pengecualian.`;
        }
        const search = $('uaUserSearch');
        if (search) search.value = '';
        setUserDirty(!!opts.forceBase);
        updateUserSummary();
    }

    function onCustomToggle(on) {
        const cols = $('uaUCols');
        if (cols) cols.classList.toggle('is-locked', !on);
        if (!on) loadUserAccessEditor({ forceBase: true, keepCustom: true });
        setUserDirty(true);
    }

    function focusUserAccess(id) {
        const sel = $('uaUserSel');
        if (!sel) return;
        if (US.dirty && !window.confirm('Perubahan akses pengguna belum disimpan. Pindah pengguna dan buang perubahan?')) return;
        US.dirty = false;
        US.userId = String(id);
        sel.value = US.userId;
        loadUserAccessEditor();
        const panel = $('userAccessPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function saveUserAccess() {
        const user = state.users.find((u) => String(u.id) === US.userId);
        if (!user || typeof saveUserPermissionOverrides !== 'function') return;
        const all = Object.assign({}, userOverrides());
        const key = String(user.id);
        const name = user.fullName || user.username;

        if (!$('uaCustomOn').checked) {
            delete all[key];
            saveUserPermissionOverrides(all);
            setUserDirty(false);
            renderAll();
            return window.uaToast('success', `${name} kembali mengikuti hak akses role.`);
        }

        const perms = getRolePermissions();
        const base = perms[getAccessRoleForUserRole(String(user.role || '').toLowerCase())] || { menus: [], special: {}, actions: {} };
        const existing = all[key] || {};
        const rendered = (cls) => Array.from(document.querySelectorAll('#userAccessPanel ' + cls));
        const menuBoxes = rendered('.user-access-menu');
        const renderedMenus = new Set(menuBoxes.map((c) => c.value));
        const prevMenus = Array.isArray(existing.menus) ? existing.menus : base.menus;
        const menus = prevMenus.filter((m) => !renderedMenus.has(m)).concat(menuBoxes.filter((c) => c.checked).map((c) => c.value));
        const special = Object.assign({}, base.special, existing.special || {});
        rendered('.user-access-special').forEach((c) => { special[c.value] = c.checked; });
        const actions = Object.assign({}, base.actions, existing.actions || {});
        rendered('.user-access-action').forEach((c) => { actions[c.value] = c.checked; });

        if (!menus.length) return window.uaToast('warning', 'Pilih minimal satu menu agar pengguna bisa masuk.');

        all[key] = { menus: Array.from(new Set(menus)), special, actions, updatedAt: new Date().toISOString(), updatedBy: me().id };
        saveUserPermissionOverrides(all);
        setUserDirty(false);
        renderAll();
        window.uaToast('success', `Akses khusus ${name} berhasil disimpan.`);
    }

    async function clearUserAccess(id) {
        if (!id || typeof saveUserPermissionOverrides !== 'function') return;
        const user = state.users.find((u) => String(u.id) === String(id));
        const ok = await uaConfirm({
            title: 'Kembalikan ke hak akses role?',
            text: `Akses khusus ${user ? (user.fullName || user.username) : 'pengguna ini'} akan dihapus.`,
            confirmText: 'Ya, kembalikan'
        });
        if (!ok) return;
        const all = Object.assign({}, userOverrides());
        delete all[String(id)];
        saveUserPermissionOverrides(all);
        if (String(id) === US.userId) setUserDirty(false);
        renderAll();
        window.uaToast('success', 'Akses pengguna dikembalikan ke role.');
    }

    // Bungkus aksi simpan/reset dari 08-auth.js: konfirmasi reset, penanda perubahan, dan notifikasi bertema.
    function wrapAccessActions() {
        if (window.__uaAccessWrapped) return;
        window.__uaAccessWrapped = true;
        const origSave = window.saveRoleAccessSettings;
        const origReset = window.resetRoleAccessToDefault;
        if (typeof origSave === 'function') {
            window.saveRoleAccessSettings = function () {
                origSave.apply(this, arguments);
                setAccessDirty(false);
            };
        }
        if (typeof origReset === 'function') {
            window.resetRoleAccessToDefault = async function () {
                const role = $('roleAccessEditor')?.value || '';
                const ok = await uaConfirm({
                    title: 'Pulihkan hak akses default?',
                    text: `Perubahan hak akses role ${role.toUpperCase()} akan dikembalikan ke bawaan.`,
                    confirmText: 'Ya, pulihkan'
                });
                if (ok) origReset.apply(this, arguments);
            };
        }
    }

    // ---------- event ----------
    function bind() {
        if (window.__uaBound) return;
        window.__uaBound = true;

        document.addEventListener('click', (e) => {
            const act = e.target.closest('[data-ua-act]');
            if (act && act.closest('#userTableBody')) {
                if (act.dataset.uaAct === 'edit') window.editUser(act.dataset.id);
                else if (act.dataset.uaAct === 'delete') window.deleteUser(act.dataset.id);
                else if (act.dataset.uaAct === 'access') focusUserAccess(act.dataset.id);
                return;
            }
            const pill = e.target.closest('[data-ra-role]');
            if (pill && pill.closest('#raRolePills')) {
                const sel = $('roleAccessEditor');
                if (sel && sel.value !== pill.dataset.raRole) {
                    if (state.accessDirty && !window.confirm('Perubahan hak akses belum disimpan. Pindah role dan buang perubahan?')) return;
                    sel.value = pill.dataset.raRole;
                    window.loadRoleAccessEditor();
                }
                return;
            }
            const all = e.target.closest('[data-ra-all]');
            if (all) {
                const group = all.closest('.ua-group');
                const on = all.dataset.raAll === '1';
                group.querySelectorAll('.ua-opt').forEach((o) => {
                    if (o.style.display === 'none') return;
                    const c = o.querySelector('input');
                    if (c) c.checked = on;
                });
                if (group.closest('#userAccessPanel')) { setUserDirty(true); updateUserSummary(); }
                else { setAccessDirty(true); updateAccessSummary(); }
                return;
            }
            const modal = $('userModal');
            if (modal && e.target === modal) window.closeUserModal();
            if (e.target.closest('#uaUSave')) saveUserAccess();
            else if (e.target.closest('#uaUCopy')) loadUserAccessEditor({ forceBase: true, keepCustom: true });
            else if (e.target.closest('#uaUClear')) clearUserAccess(US.userId);
            const rm = e.target.closest('[data-uc-remove]');
            if (rm) clearUserAccess(rm.dataset.ucRemove);
            const ed = e.target.closest('[data-uc-edit]');
            if (ed) focusUserAccess(ed.dataset.ucEdit);
        });

        document.addEventListener('change', (e) => {
            if (e.target.matches('#roleAccessSettingsPanel input[type="checkbox"]')) {
                setAccessDirty(true);
                updateAccessSummary();
            } else if (e.target.id === 'uaCustomOn') {
                onCustomToggle(e.target.checked);
            } else if (e.target.id === 'uaUserSel') {
                if (US.dirty && !window.confirm('Perubahan akses pengguna belum disimpan. Pindah pengguna dan buang perubahan?')) { e.target.value = US.userId; return; }
                US.userId = e.target.value;
                loadUserAccessEditor();
            } else if (e.target.matches('#userAccessPanel input[type="checkbox"]')) {
                setUserDirty(true);
                updateUserSummary();
            } else if (e.target.id === 'mUserRole') {
                updateRoleHint();
            } else if (e.target.id === 'uaRoleFilter') {
                state.role = e.target.value;
                renderTable();
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.id === 'uaSearch') { state.q = e.target.value; renderTable(); }
            else if (e.target.id === 'raSearch') filterAccess('#roleAccessSettingsPanel', 'raSearch');
            else if (e.target.id === 'uaUserSearch') filterAccess('#userAccessPanel', 'uaUserSearch');
            else if (e.target.id === 'mUserPassword') updatePwMeter();
            else if (e.target.id === 'mUserFullName' || e.target.id === 'mUserUsername') {
                if (!window._tempUserPhoto) setPreview('');
            }
        });

        document.addEventListener('keydown', (e) => {
            const modal = $('userModal');
            if (!modal || modal.style.display !== 'flex') return;
            if (e.key === 'Escape') window.closeUserModal();
            else if (e.key === 'Enter' && e.target.matches('#userModal input:not([type="file"])')) window.saveUser();
        });
    }

    function init() {
        bind();
        wrapAccessActions();
        if ($('userTableBody') && typeof getCurrentUser === 'function' && getCurrentUser()) {
            window.loadUsersTable();
            window.loadRoleAccessEditor();
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
