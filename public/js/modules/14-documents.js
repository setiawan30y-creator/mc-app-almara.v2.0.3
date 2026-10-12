// Modul Penyimpanan Berkas (Document Store)

let activeFolderId = 'default-perizinan';

function getDocuments() {
    return window.safeArrayGet('mc_documents');
}

function saveDocuments(data) {
    localStorage.setItem('mc_documents', JSON.stringify(data));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_documents', data);
    }
}

function getCustomFolders() {
    return window.safeArrayGet('mc_document_folders');
}

function saveCustomFolders(data) {
    localStorage.setItem('mc_document_folders', JSON.stringify(data));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_document_folders', data);
    }
}

function getAllFolders() {
    const profile = (typeof getProfile === 'function') ? getProfile() : (typeof almaraStore !== 'undefined' && almaraStore.getProfile ? almaraStore.getProfile() : {});
    const companyName = profile.name || 'Perusahaan';
    
    const defaults = [
        { id: 'default-perizinan', name: 'Perizinan', isDefault: true },
        { id: 'default-sewa-gedung', name: 'Sewa Gedung', isDefault: true },
        { id: 'default-pt', name: companyName, isDefault: true },
        { id: 'default-pks', name: 'PKS', isDefault: true },
        { id: 'default-banner', name: 'Banner', isDefault: true },
        { id: 'default-kartu-nama', name: 'Kartu Nama', isDefault: true }
    ];
    
    const customs = getCustomFolders();
    return [...defaults, ...customs];
}

function getFolderById(folderId) {
    return getAllFolders().find(f => f.id === folderId) || null;
}

function getFolderDepth(folderId, folders = getAllFolders()) {
    let depth = 0;
    let current = folders.find(f => f.id === folderId);
    const seen = new Set();
    while (current && current.parentId && !seen.has(current.parentId)) {
        seen.add(current.parentId);
        current = folders.find(f => f.id === current.parentId);
        if (current) depth++;
    }
    return depth;
}

function getFolderDescendantIds(folderId, folders = getAllFolders()) {
    const ids = new Set([folderId]);
    let changed = true;
    while (changed) {
        changed = false;
        folders.forEach(folder => {
            if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
                ids.add(folder.id);
                changed = true;
            }
        });
    }
    return ids;
}

function sortFoldersByName(folders) {
    return [...folders].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id-ID'));
}

function buildFolderTreeHtml(parentId = null, depth = 0, folders = getAllFolders()) {
    const children = sortFoldersByName(folders.filter(folder => (folder.parentId || null) === parentId));
    return children.map(folder => {
        const isActive = folder.id === activeFolderId;
        const hasChildren = folders.some(child => child.parentId === folder.id);
        const iconClass = isActive ? 'fa-solid fa-folder-open' : (hasChildren ? 'fa-solid fa-folder-tree' : (folder.isDefault ? 'fa-solid fa-folder-closed' : 'fa-solid fa-folder'));
        const folderColor = folder.isDefault ? '#FBBF24' : '#60a5fa';
        const indent = depth * 18;
        const customActions = folder.isDefault ? '' : `
            <button class="folder-action-btn rename" onclick="event.stopPropagation(); window.openDocumentFolderModal('${folder.parentId || ''}', '${folder.id}')" title="Rename Folder">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="folder-action-btn delete" onclick="event.stopPropagation(); window.deleteCustomFolder('${folder.id}')" title="Hapus Folder">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        return `
            <div class="folder-item ${isActive ? 'active' : ''}" onclick="window.setActiveFolder('${folder.id}')" style="margin-left: ${indent}px;">
                <div class="folder-name-container">
                    <i class="${iconClass}" style="color: ${isActive ? 'inherit' : folderColor};"></i>
                    <span>${escapeHtml(folder.name)}</span>
                </div>
                <div class="folder-actions">
                    <button class="folder-action-btn add" onclick="event.stopPropagation(); window.openDocumentFolderModal('${folder.id}')" title="Tambah Subfolder">
                        <i class="fa-solid fa-folder-plus"></i>
                    </button>
                    ${customActions}
                </div>
            </div>
            ${buildFolderTreeHtml(folder.id, depth + 1, folders)}
        `;
    }).join('');
}

function isDuplicateFolderName(name, parentId, excludeId = '') {
    const normalized = String(name || '').trim().toLowerCase();
    return getAllFolders().some(folder => {
        return folder.id !== excludeId
            && String(folder.name || '').trim().toLowerCase() === normalized
            && (folder.parentId || null) === (parentId || null);
    });
}

// Hook on Navigation click
document.addEventListener('click', (e) => {
    let target = e.target.closest('.nav-item');
    if (target) {
        let viewId = target.getAttribute('data-target');
        if (viewId === 'documents-view') {
            window.initDocumentsView();
        }
    }
});

// Initialize View
window.initDocumentsView = function() {
    window.renderFoldersList();
    window.renderDocumentsTable();
};

window.setActiveFolder = function(folderId) {
    activeFolderId = folderId;
    window.renderFoldersList();
    window.renderDocumentsTable();
};

// Render Sidebar Folders
window.renderFoldersList = function() {
    const listEl = document.getElementById('documentsFolderList');
    if (!listEl) return;
    
    const folders = getAllFolders();
    
    // Fallback if active folder was deleted
    if (!folders.some(f => f.id === activeFolderId)) {
        activeFolderId = 'default-perizinan';
    }
    
    let html = buildFolderTreeHtml(null, 0, folders);
    
    listEl.innerHTML = html;
    
    // Update active folder title
    const activeFolder = folders.find(f => f.id === activeFolderId);
    const headerEl = document.getElementById('currentFolderNameHeader');
    if (headerEl && activeFolder) {
        headerEl.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${escapeHtml(activeFolder.name)}`;
    }
    
    // Update folder specific action area
    const actionsArea = document.getElementById('currentFolderActionsArea');
    if (actionsArea) {
        const customActions = activeFolder && !activeFolder.isDefault ? `
            <button class="btn btn-sm btn-outline" onclick="window.openDocumentFolderModal('${activeFolder.parentId || ''}', '${activeFolder.id}')" style="padding: 4px 8px; font-size: 0.8rem;">
                <i class="fa-solid fa-pen"></i> Rename
            </button>
            <button class="btn btn-sm btn-danger" onclick="window.deleteCustomFolder('${activeFolder.id}')" style="padding: 4px 8px; font-size: 0.8rem; background: #ef4444; border: none; color: white;">
                <i class="fa-solid fa-trash"></i> Hapus Folder
            </button>
        ` : '';
        actionsArea.innerHTML = activeFolder ? `
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn btn-sm btn-outline" onclick="window.openDocumentFolderModal('${activeFolder.id}')" style="padding: 4px 8px; font-size: 0.8rem;">
                    <i class="fa-solid fa-folder-plus"></i> Subfolder
                </button>
                ${customActions}
            </div>
        ` : '';
    }
};

// Render Documents Table
window.renderDocumentsTable = function() {
    const tbody = document.getElementById('documentsTableBody');
    if (!tbody) return;
    
    const docs = getDocuments();
    const searchText = (document.getElementById('searchDocumentInput')?.value || '').toLowerCase().trim();
    
    let filtered = docs.filter(doc => doc.folderId === activeFolderId);
    
    if (searchText) {
        filtered = filtered.filter(doc => 
            String(doc.name || '').toLowerCase().includes(searchText) ||
            String(doc.notes || '').toLowerCase().includes(searchText)
        );
    }
    
    // Sort by uploaded_at desc
    filtered.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    
    let html = '';
    filtered.forEach(doc => {
        const ext = String(doc.name || '').split('.').pop().toLowerCase();
        let iconHtml = '';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
            iconHtml = '<i class="fa-solid fa-file-image" style="color: #10B981; font-size: 1.5rem;" title="Gambar"></i>';
        } else if (ext === 'pdf') {
            iconHtml = '<i class="fa-solid fa-file-pdf" style="color: #ef4444; font-size: 1.5rem;" title="PDF"></i>';
        } else if (ext === 'rar') {
            iconHtml = '<i class="fa-solid fa-file-zipper" style="color: #FBBF24; font-size: 1.5rem;" title="Compressed RAR"></i>';
        } else {
            iconHtml = '<i class="fa-solid fa-file" style="color: #94a3b8; font-size: 1.5rem;" title="Berkas"></i>';
        }
        
        const isPreviewable = ['jpg', 'jpeg', 'png', 'gif', 'pdf'].includes(ext);
        const viewBtn = isPreviewable 
            ? `<button class="btn btn-sm btn-outline" onclick="window.viewDocument('${doc.url}')" title="Lihat Berkas" style="padding: 4px 8px;"><i class="fa-solid fa-eye"></i></button>`
            : '';
            
        html += `
            <tr>
                <td style="text-align: center; vertical-align: middle;">${iconHtml}</td>
                <td style="vertical-align: middle;">
                    <a href="${doc.url}" target="_blank" style="color: #38bdf8; text-decoration: none; font-weight: 500;">
                        ${escapeHtml(doc.name)}
                    </a>
                </td>
                <td style="vertical-align: middle; color: #94a3b8;">${escapeHtml(doc.notes || '-')}</td>
                <td style="vertical-align: middle;">${formatBytes(doc.size)}</td>
                <td style="vertical-align: middle;">${formatDocDate(doc.uploaded_at)}</td>
                <td style="text-align: center; vertical-align: middle; white-space: nowrap;">
                    <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                        ${viewBtn}
                        <button class="btn btn-sm btn-success" onclick="window.downloadDocument('${doc.url}', '${escapeHtml(doc.name)}')" title="Unduh Berkas" style="padding: 4px 8px;"><i class="fa-solid fa-download"></i></button>
                        <button class="btn btn-sm btn-warning" onclick="window.openEditDocumentModal('${doc.id}')" title="Ubah Info" style="padding: 4px 8px;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="window.deleteDocument('${doc.id}')" title="Hapus Berkas" style="padding: 4px 8px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    if (filtered.length === 0) {
        html = `<tr><td colspan="6" class="text-center text-muted" style="padding: 20px;">Tidak ada berkas di folder ini.</td></tr>`;
    }
    
    tbody.innerHTML = html;
};

// Document View & Download
window.viewDocument = function(url) {
    window.open(url, '_blank');
};

window.downloadDocument = function(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// Add / Rename Folder Modal
window.openDocumentFolderModal = function(parentId = activeFolderId, editFolderId = '') {
    const form = document.getElementById('documentFolderModalForm');
    if (form) form.reset();

    const editFolder = editFolderId ? getFolderById(editFolderId) : null;
    const parentSelect = document.getElementById('mFolderParent');
    if (parentSelect) {
        populateFolderDropdown(parentSelect, {
            includeRoot: true,
            excludeIds: editFolder ? getFolderDescendantIds(editFolder.id) : new Set()
        });
        parentSelect.value = editFolder ? (editFolder.parentId || '') : (parentId || '');
    }

    const editIdInput = document.getElementById('mFolderEditId');
    if (editIdInput) editIdInput.value = editFolder ? editFolder.id : '';

    const nameInput = document.getElementById('mFolderNama');
    if (nameInput) nameInput.value = editFolder ? editFolder.name : '';

    const titleEl = document.getElementById('documentFolderModalTitle');
    if (titleEl) titleEl.textContent = editFolder ? 'Rename Folder' : 'Tambah Folder Baru';

    const submitBtn = document.getElementById('documentFolderSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = editFolder
            ? '<i class="fa-solid fa-save"></i> Simpan Rename'
            : '<i class="fa-solid fa-save"></i> Tambah Folder';
    }

    const modal = document.getElementById('documentFolderModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDocumentFolderModal = function() {
    const modal = document.getElementById('documentFolderModal');
    if (modal) modal.style.display = 'none';
};

window.saveDocumentFolder = function() {
    const nama = document.getElementById('mFolderNama').value.trim();
    const editId = document.getElementById('mFolderEditId')?.value || '';
    const parentId = document.getElementById('mFolderParent')?.value || null;
    if (!nama) {
        alert("Nama folder wajib diisi!");
        return;
    }

    const customs = getCustomFolders();

    if (editId) {
        const editIndex = customs.findIndex(f => f.id === editId);
        if (editIndex === -1) return;

        const blockedParentIds = getFolderDescendantIds(editId);
        if (parentId && blockedParentIds.has(parentId)) {
            alert("Folder tidak bisa dipindah ke dalam dirinya sendiri.");
            return;
        }

        if (isDuplicateFolderName(nama, parentId, editId)) {
            alert("Folder dengan nama tersebut sudah ada di lokasi yang sama!");
            return;
        }

        customs[editIndex].name = nama;
        customs[editIndex].parentId = parentId || null;
        customs[editIndex].isDefault = false;
        saveCustomFolders(customs);
        activeFolderId = editId;

        window.closeDocumentFolderModal();
        window.initDocumentsView();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Folder Berhasil Direname',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        }
        return;
    }

    if (isDuplicateFolderName(nama, parentId)) {
        alert("Folder dengan nama tersebut sudah ada di lokasi yang sama!");
        return;
    }

    const newFolder = {
        id: 'folder-' + Date.now(),
        name: nama,
        parentId: parentId || null,
        isDefault: false
    };
    
    customs.push(newFolder);
    saveCustomFolders(customs);
    
    activeFolderId = newFolder.id;
    
    window.closeDocumentFolderModal();
    window.initDocumentsView();
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Folder Baru Berhasil Dibuat',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1500,
            showConfirmButton: false
        });
    }
};

window.deleteCustomFolder = function(folderId) {
    const allFolders = getAllFolders();
    const folders = getCustomFolders();
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return;
    if (folder.isDefault) {
        alert("Folder bawaan tidak bisa dihapus.");
        return;
    }
    
    const action = () => {
        const folderIdsToDelete = getFolderDescendantIds(folderId, allFolders);
        const newFolders = folders.filter(f => !folderIdsToDelete.has(f.id));
        saveCustomFolders(newFolders);
        
        let docs = getDocuments();
        docs = docs.filter(d => !folderIdsToDelete.has(d.folderId));
        saveDocuments(docs);
        
        if (folderIdsToDelete.has(activeFolderId)) {
            activeFolderId = folder.parentId || 'default-perizinan';
        }
        
        window.initDocumentsView();
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Folder berhasil dihapus',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };
    
    const childCount = getFolderDescendantIds(folderId, allFolders).size - 1;
    const text = `Folder "${folder.name}"${childCount > 0 ? `, ${childCount} subfolder,` : ''} dan semua berkas di dalamnya akan dihapus secara permanen.`;
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Hapus Folder?',
            text: text,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
            background: '#1e293b',
            color: '#f8fafc'
        }).then((result) => {
            if (result.isConfirmed) {
                action();
            }
        });
    } else {
        if (confirm(text)) {
            action();
        }
    }
};

// Add Document/Upload Modal
window.openDocumentUploadModal = function() {
    const form = document.getElementById('documentUploadModalForm');
    if (form) form.reset();
    
    const select = document.getElementById('mDocFolder');
    if (select) {
        populateFolderDropdown(select);
        select.value = activeFolderId;
    }
    
    const modal = document.getElementById('documentUploadModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDocumentUploadModal = function() {
    const modal = document.getElementById('documentUploadModal');
    if (modal) modal.style.display = 'none';
};

window.saveDocumentUpload = async function() {
    const fileInput = document.getElementById('mDocFile');
    const nameInput = document.getElementById('mDocNama');
    const folderSelect = document.getElementById('mDocFolder');
    const notesInput = document.getElementById('mDocKeterangan');
    
    if (!fileInput || fileInput.files.length === 0) {
        alert("Pilih file terlebih dahulu!");
        return;
    }
    
    const file = fileInput.files[0];
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
        alert("Ukuran file terlalu besar! Maksimal 10 MB.");
        return;
    }
    
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'rar'];
    if (!allowed.includes(ext)) {
        alert("Format file tidak didukung! Didukung: JPG, JPEG, PNG, GIF, PDF, RAR.");
        return;
    }
    
    const form = document.getElementById('documentUploadModalForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah...';
        
        const dataUrl = await readFileAsDataUrl(file);
        
        const inputName = nameInput.value.trim();
        const baseName = inputName ? inputName : file.name;
        const finalName = baseName.toLowerCase().endsWith('.' + ext) ? baseName : (baseName + '.' + ext);
        
        const uploadedUrl = await window.uploadBase64FileToFolder(dataUrl, 'company/documents', finalName);
        
        const newDoc = {
            id: 'doc-' + Date.now(),
            folderId: folderSelect.value,
            name: finalName,
            url: uploadedUrl,
            size: file.size,
            notes: notesInput.value.trim(),
            uploaded_at: new Date().toISOString()
        };
        
        const docs = getDocuments();
        docs.push(newDoc);
        saveDocuments(docs);
        
        window.closeDocumentUploadModal();
        window.renderDocumentsTable();
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Berkas Berhasil Diunggah',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        }
    } catch(err) {
        console.error("Upload error:", err);
        alert("Gagal mengunggah berkas: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
    }
};

// Edit Document Modal
window.openEditDocumentModal = function(docId) {
    const docs = getDocuments();
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;
    
    document.getElementById('mEditDocId').value = doc.id;
    document.getElementById('mEditDocNama').value = doc.name;
    document.getElementById('mEditDocKeterangan').value = doc.notes || '';
    
    const foldersSelect = document.getElementById('mEditDocFolder');
    if (foldersSelect) {
        populateFolderDropdown(foldersSelect);
        foldersSelect.value = doc.folderId;
    }
    
    const modal = document.getElementById('documentEditModal');
    if (modal) modal.style.display = 'flex';
};

window.closeDocumentEditModal = function() {
    const modal = document.getElementById('documentEditModal');
    if (modal) modal.style.display = 'none';
};

window.saveDocumentEdit = function() {
    const id = document.getElementById('mEditDocId').value;
    const name = document.getElementById('mEditDocNama').value.trim();
    const folderId = document.getElementById('mEditDocFolder').value;
    const notes = document.getElementById('mEditDocKeterangan').value.trim();
    
    if (!name) {
        alert("Nama berkas tidak boleh kosong!");
        return;
    }
    
    const docs = getDocuments();
    const docIndex = docs.findIndex(d => d.id === id);
    if (docIndex === -1) return;
    
    const oldName = docs[docIndex].name;
    const ext = oldName.split('.').pop().toLowerCase();
    const finalName = name.toLowerCase().endsWith('.' + ext) ? name : (name + '.' + ext);
    
    docs[docIndex].name = finalName;
    docs[docIndex].folderId = folderId;
    docs[docIndex].notes = notes;
    
    saveDocuments(docs);
    
    window.closeDocumentEditModal();
    window.renderDocumentsTable();
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Informasi Berkas Diperbarui',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1500,
            showConfirmButton: false
        });
    }
};

window.deleteDocument = function(docId) {
    const action = () => {
        let docs = getDocuments();
        docs = docs.filter(d => d.id !== docId);
        saveDocuments(docs);
        
        window.renderDocumentsTable();
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Berkas berhasil dihapus',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Hapus Berkas?',
            text: "Metadata berkas akan dihapus secara permanen.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal',
            background: '#1e293b',
            color: '#f8fafc'
        }).then((result) => {
            if (result.isConfirmed) {
                action();
            }
        });
    } else {
        if (confirm("Apakah Anda yakin ingin menghapus berkas ini?")) {
            action();
        }
    }
};

// Helpers
function populateFolderDropdown(selectEl, options = {}) {
    if (!selectEl) return;
    const { includeRoot = false, excludeIds = new Set() } = options;
    const folders = getAllFolders();
    const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);
    let html = includeRoot ? '<option value="">/ Utama</option>' : '';

    const renderOptions = (parentId = null, depth = 0) => {
        return sortFoldersByName(folders.filter(f => (f.parentId || null) === parentId && !excluded.has(f.id))).map(f => {
            const prefix = depth > 0 ? `${'-- '.repeat(depth)}` : '';
            return `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>${renderOptions(f.id, depth + 1)}`;
        }).join('');
    };

    html += renderOptions(null, 0);
    selectEl.innerHTML = html;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDocDate(isoString) {
    if (!isoString) return '-';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch(e) {
        return isoString;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
