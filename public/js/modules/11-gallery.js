// Galeri Valas Module
// ==============================
// Isolate storage, rendering, and action hooks
// ==============================

// --- Storage Helpers ---
const getValasGallery = () => {
    let d = JSON.parse(localStorage.getItem('mc_valas_gallery'));
    return Array.isArray(d) ? d : [];
};

const saveValasGallery = (data) => {
    localStorage.setItem('mc_valas_gallery', JSON.stringify(data));
    if (typeof window.pushToUniversalDatastore === 'function') {
        // Persist locally first. Server sync happens in the background so a
        // slow connection can never leave the Save button spinning forever.
        Promise.resolve(window.pushToUniversalDatastore('mc_valas_gallery', data))
            .catch(error => console.warn('Sinkronisasi galeri valas tertunda:', error));
    }
};

const withTimeout = (promise, milliseconds, message) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds))
]);

// Expose storage helpers to window
window.getValasGallery = getValasGallery;
window.saveValasGallery = saveValasGallery;
window.currentValasGalleryPhotoBase64 = null;

// Hook on Navigation click
document.addEventListener('click', (e) => {
    let target = e.target.closest('.nav-item');
    if (target) {
        let viewId = target.getAttribute('data-target');
        if (viewId === 'valas-gallery-view') {
            window.initValasGalleryView();
        }
    }
});

// Initialize View
window.initValasGalleryView = function() {
    // Check role permissions
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const userRole = user ? String(user.role || '').toLowerCase() : 'kasir';
    const isAdmin = ['owner', 'admin', 'supervisor'].includes(userRole);

    const adminBtn = document.getElementById('valasGalleryAdminBtn');
    if (adminBtn) {
        adminBtn.style.display = isAdmin ? 'block' : 'none';
    }

    window.loadValasGalleryGrid();
};

// Load and Render Grid with Filters
window.loadValasGalleryGrid = function() {
    const galleryItems = getValasGallery();
    const grid = document.getElementById('valasGalleryGrid');
    if (!grid) return;

    const searchQuery = (document.getElementById('valasGallerySearch')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('valasGalleryStatusFilter')?.value || 'ALL';

    // Filter logic
    let filteredItems = galleryItems.filter(item => {
        // Status filter
        if (statusFilter !== 'ALL' && item.status !== statusFilter) {
            return false;
        }

        // Text search (matches code, desc, or notes)
        if (searchQuery) {
            const combined = `${item.code || ''} ${item.desc || ''} ${item.notes || ''}`.toLowerCase();
            return combined.includes(searchQuery);
        }

        return true;
    });

    // Check user role for editing permissions
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const userRole = user ? String(user.role || '').toLowerCase() : 'kasir';
    const isAdmin = ['owner', 'admin', 'supervisor'].includes(userRole);

    grid.innerHTML = '';
    if (filteredItems.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 40px 10px; background: rgba(30, 41, 59, 0.4); border-radius: 8px; border: 1px dashed rgba(148, 163, 184, 0.2);">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: #64748b; margin-bottom: 12px; display: block;"></i>
                Belum ada acuan gambar valas yang cocok.
            </div>
        `;
        return;
    }

    filteredItems.forEach(item => {
        const flagHtml = typeof window.getFlagHtml === 'function' ? window.getFlagHtml(item.code) : '';
        const isAccepted = item.status === 'DITERIMA';
        const badgeColor = isAccepted ? '#10b981' : '#ef4444';
        const badgeBg = isAccepted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
        const statusLabel = isAccepted ? 'DITERIMA (Accepted)' : 'TIDAK DITERIMA (Rejected)';

        grid.innerHTML += `
            <div class="panel" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(148, 163, 184, 0.15); padding: 16px; border-radius: 8px; background: rgba(30, 41, 59, 0.5);">
                <div>
                    <!-- Header: Flag & Status -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.5rem; line-height: 1;">${flagHtml}</span>
                            <strong style="font-size: 1.1rem; color: #f8fafc;">${String(item.code || '').toUpperCase()}</strong>
                        </div>
                        <span style="font-size: 0.75rem; font-weight: bold; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeColor}33; padding: 4px 10px; border-radius: 999px;">
                            ${statusLabel}
                        </span>
                    </div>

                    <!-- Title & Notes -->
                    <h4 style="margin: 0 0 8px; color: #f1f5f9; font-size: 1.05rem;">${item.desc || '-'}</h4>
                    <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin: 0 0 16px; white-space: pre-wrap;">${item.notes || 'Tidak ada catatan tambahan.'}</p>
                </div>

                <!-- Footer: Image Preview & Admin Actions -->
                <div>
                    ${item.photo ? `
                        <div style="position: relative; border-radius: 6px; overflow: hidden; height: 120px; border: 1px solid rgba(148, 163, 184, 0.15); background: rgba(15, 23, 42, 0.4); margin-bottom: 12px; cursor: zoom-in;" onclick="window.openGlobalImagePreview('${item.photo}')">
                            <img src="${item.photo}" style="width: 100%; height: 100%; object-fit: contain;" alt="Referensi Banknote">
                            <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px;"><i class="fa-solid fa-expand"></i> Perbesar</div>
                        </div>
                    ` : `
                        <div style="display: flex; align-items: center; justify-content: center; height: 120px; border: 1px dashed rgba(148, 163, 184, 0.2); background: rgba(15, 23, 42, 0.2); color: #64748b; font-size: 0.8rem; border-radius: 6px; margin-bottom: 12px;">
                            Tidak ada foto referensi
                        </div>
                    `}

                    ${isAdmin ? `
                        <div style="display: flex; gap: 8px; margin-top: auto;">
                            <button class="btn btn-sm btn-outline" style="flex: 1; padding: 6px 12px;" onclick="window.openValasGalleryModal('${item.id}')"><i class="fa-solid fa-edit"></i> Edit</button>
                            <button class="btn btn-sm btn-outline" style="padding: 6px 12px; color: #ef4444; border-color: #ef4444;" onclick="window.deleteValasGalleryItem('${item.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
};

// Reset Filters
window.resetValasGalleryFilter = function() {
    const search = document.getElementById('valasGallerySearch');
    const status = document.getElementById('valasGalleryStatusFilter');
    if (search) search.value = '';
    if (status) status.value = 'ALL';
    window.loadValasGalleryGrid();
};

// Preview Photo uploaded in modal form
window.previewValasGalleryPhoto = function(input) {
    const preview = document.getElementById('modalValasPhotoPreview');
    const placeholder = document.getElementById('modalValasPhotoPlaceholder');
    if (!preview || !placeholder) return;

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            window.currentValasGalleryPhotoBase64 = e.target.result;
            preview.src = e.target.result;
            preview.style.display = 'block';
            preview.style.cursor = 'zoom-in';
            preview.onclick = () => window.openGlobalImagePreview(e.target.result);
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// Open Add/Edit Modal
window.openValasGalleryModal = function(id = '') {
    document.getElementById('modalValasId').value = id;
    const photoInput = document.getElementById('modalValasPhoto');
    const photoPreview = document.getElementById('modalValasPhotoPreview');
    const photoPlaceholder = document.getElementById('modalValasPhotoPlaceholder');

    if (id) {
        const items = getValasGallery();
        const item = items.find(x => x.id === id);
        if (item) {
            document.getElementById('modalValasTitle').textContent = 'Edit Referensi Acuan Valas';
            document.getElementById('modalValasCode').value = item.code || '';
            document.getElementById('modalValasStatus').value = item.status || 'DITERIMA';
            document.getElementById('modalValasDesc').value = item.desc || '';
            document.getElementById('modalValasNotes').value = item.notes || '';
            window.currentValasGalleryPhotoBase64 = item.photo || null;

            if (photoPreview && item.photo) {
                photoPreview.src = item.photo;
                photoPreview.style.display = 'block';
                photoPreview.style.cursor = 'zoom-in';
                photoPreview.onclick = () => window.openGlobalImagePreview(item.photo);
                if (photoPlaceholder) photoPlaceholder.style.display = 'none';
            } else {
                if (photoPreview) {
                    photoPreview.src = '';
                    photoPreview.style.display = 'none';
                }
                if (photoPlaceholder) photoPlaceholder.style.display = 'flex';
            }
        }
    } else {
        document.getElementById('modalValasTitle').textContent = 'Tambah Referensi Acuan Valas';
        document.getElementById('modalValasCode').value = '';
        document.getElementById('modalValasStatus').value = 'DITERIMA';
        document.getElementById('modalValasDesc').value = '';
        document.getElementById('modalValasNotes').value = '';
        window.currentValasGalleryPhotoBase64 = null;

        if (photoPreview) {
            photoPreview.src = '';
            photoPreview.style.display = 'none';
        }
        if (photoPlaceholder) photoPlaceholder.style.display = 'flex';
    }

    if (photoInput) photoInput.value = '';
    document.getElementById('valasGalleryModal').style.display = 'block';
};

// Close Modal
window.closeValasGalleryModal = function() {
    const md = document.getElementById('valasGalleryModal');
    if (md) md.style.display = 'none';
};

// Save Item (handles base64 upload and list updating)
window.saveValasGalleryItem = async function() {
    const id = document.getElementById('modalValasId').value;
    const code = document.getElementById('modalValasCode').value.trim().toUpperCase();
    const status = document.getElementById('modalValasStatus').value;
    const desc = document.getElementById('modalValasDesc').value.trim();
    const notes = document.getElementById('modalValasNotes').value.trim();
    let photo = window.currentValasGalleryPhotoBase64 || null;

    if (!code) return alert('Kode valas wajib diisi!');
    if (!desc) return alert('Nama spesifik/judul acuan wajib diisi!');

    // Show indicator on save button
    const btn = document.getElementById('saveValasGalleryButton');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        if (photo && photo.startsWith('data:') && typeof window.uploadBase64FileToFolder === 'function') {
            // Upload to transactions/proofs folder
            photo = await withTimeout(
                window.uploadBase64FileToFolder(photo, 'transactions/proofs', `valas-${code}`),
                30000,
                'Upload foto terlalu lama. Periksa koneksi lalu coba lagi.'
            );
        }
    } catch (uploadError) {
        alert("Gagal upload foto referensi: " + (uploadError.message || uploadError));
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    let galleryItems = getValasGallery();
    if (id) {
        const idx = galleryItems.findIndex(x => x.id === id);
        if (idx !== -1) {
            galleryItems[idx] = { ...galleryItems[idx], code, status, desc, notes, photo };
        }
    } else {
        galleryItems.push({
            id: 'GAL' + Date.now(),
            code,
            status,
            desc,
            notes,
            photo
        });
    }

    try {
        saveValasGallery(galleryItems);
        alert('Data acuan valas berhasil disimpan. Sinkronisasi server berjalan di latar belakang.');
        window.closeValasGalleryModal();
        window.loadValasGalleryGrid();
    } catch (saveError) {
        alert('Data acuan valas gagal disimpan: ' + (saveError.message || saveError));
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Delete Item
window.deleteValasGalleryItem = async function(id) {
    if (!confirm('Hapus item acuan valas ini selamanya?')) return;
    let galleryItems = getValasGallery();
    galleryItems = galleryItems.filter(x => x.id !== id);
    saveValasGallery(galleryItems);
    window.loadValasGalleryGrid();
};

// Quick link from POS form next to currency selector
window.quickOpenValasGallery = function() {
    const currencySelect = document.getElementById('trxCurrency');
    let selectedCode = '';
    if (currencySelect) {
        const opt = currencySelect.options[currencySelect.selectedIndex];
        if (opt && opt.value) {
            // Usually the option text has the currency code (e.g. "USD - US Dollar")
            // Or just extract the currency code from the value or text
            selectedCode = String(opt.text || opt.value || '').split(' ')[0] || '';
            selectedCode = selectedCode.replace(/[^A-Z]/gi, '').toUpperCase();
        }
    }

    // Switch view to valas-gallery-view using the nav item click
    const navItem = document.querySelector('.nav-item[data-target="valas-gallery-view"]');
    if (navItem) {
        navItem.click();
    }

    // Pre-fill the search field and filter the grid
    const searchField = document.getElementById('valasGallerySearch');
    if (searchField) {
        searchField.value = selectedCode;
        window.loadValasGalleryGrid();
    }
};
