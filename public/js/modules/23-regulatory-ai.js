(function () {
    'use strict';

    const API = '/api/regulatory-documents';
    const $ = (id) => document.getElementById(id);
    let currentPage = 1;
    let lastPage = 1;
    let searchTimer = null;

    function csrf() {
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    function companyLabel() {
        let name = 'Almara';
        try {
            const profile = typeof getProfile === 'function'
                ? getProfile()
                : JSON.parse(localStorage.getItem('mc_profile') || '{}');
            const first = String(profile?.name || 'Almara').trim().split(/\s+/)[0];
            if (first) name = first;
        } catch (_) {}
        return name + ' Regulatory AI';
    }

    function setCompanyLabel() {
        const label = companyLabel();
        document.querySelectorAll('[data-regulatory-ai-menu-label], [data-regulatory-ai-title]')
            .forEach((el) => { el.textContent = label; });
    }

    async function api(url, options = {}) {
        const headers = Object.assign({
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': csrf()
        }, options.headers || {});
        const response = await fetch(url, Object.assign({
            credentials: 'same-origin',
            headers
        }, options));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401 || response.status === 419) {
                throw new Error('Sesi login berakhir atau token keamanan tidak berlaku. Muat ulang halaman dan login kembali.');
            }
            if (response.status === 403) throw new Error('Akses ditolak. Periksa hak akses akun Anda.');
            throw new Error(data.message || ('Permintaan gagal (HTTP ' + response.status + ')'));
        }
        return data;
    }

    function showMessage(message, isError = false) {
        const el = $('regAiMessage');
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? '#dc2626' : 'var(--text-color, #166534)';
    }

    function formatSize(bytes) {
        const size = Number(bytes || 0);
        if (size < 1024) return size + ' B';
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
        return (size / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString('id-ID');
    }

    function renderRows(documents) {
        const tbody = $('regAiDocumentRows');
        if (!tbody) return;
        if (!documents.length) {
            tbody.innerHTML = '<tr><td colspan="6">Belum ada dokumen yang cocok.</td></tr>';
            return;
        }
        tbody.innerHTML = documents.map((doc) => {
            const id = Number(doc.id);
            return '<tr>' +
                '<td><strong>' + escapeHtml(doc.title || doc.original_name) + '</strong><br><small>' + escapeHtml(doc.original_name) + '</small></td>' +
                '<td>' + escapeHtml(doc.regulation_number || '-') + '</td>' +
                '<td>' + formatDate(doc.effective_date) + '</td>' +
                '<td>' + escapeHtml(doc.status || 'pending') + '</td>' +
                '<td>' + formatSize(doc.size_bytes) + '</td>' +
                '<td style="white-space:nowrap;">' +
                '<button type="button" class="btn btn-secondary" data-regai-detail="' + id + '">Detail</button> ' +
                '<button type="button" class="btn btn-danger" data-regai-delete="' + id + '">Hapus</button>' +
                '</td></tr>';
        }).join('');
    }

    async function loadDocuments(page = 1) {
        currentPage = page;
        const tbody = $('regAiDocumentRows');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6">Memuat dokumen...</td></tr>';
        try {
            const params = new URLSearchParams({
                page: String(page),
                q: ($('regAiSearch')?.value || '').trim()
            });
            const result = await api(API + '?' + params.toString());
            renderRows(Array.isArray(result.data) ? result.data : []);
            lastPage = Math.max(1, Number(result.last_page || 1));
            const pagination = $('regAiPagination');
            if (pagination) {
                pagination.innerHTML = '';
                const info = document.createElement('span');
                info.textContent = 'Halaman ' + currentPage + ' dari ' + lastPage;
                pagination.appendChild(info);
                if (currentPage > 1) {
                    const prev = document.createElement('button');
                    prev.type = 'button';
                    prev.className = 'btn btn-secondary';
                    prev.textContent = 'Sebelumnya';
                    prev.addEventListener('click', () => loadDocuments(currentPage - 1));
                    pagination.appendChild(prev);
                }
                if (currentPage < lastPage) {
                    const next = document.createElement('button');
                    next.type = 'button';
                    next.className = 'btn btn-secondary';
                    next.textContent = 'Berikutnya';
                    next.addEventListener('click', () => loadDocuments(currentPage + 1));
                    pagination.appendChild(next);
                }
            }
        } catch (error) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6">' + escapeHtml(error.message) + '</td></tr>';
        }
    }

    async function uploadDocument(event) {
        event.preventDefault();
        const form = $('regulatoryAiUploadForm');
        const fileInput = $('regAiFile');
        if (!form || !fileInput?.files?.length) {
            showMessage('Pilih file terlebih dahulu.', true);
            return;
        }

        const button = $('regAiUploadButton');
        const payload = new FormData(form);
        button.disabled = true;
        showMessage('Mengunggah dokumen...');
        try {
            const result = await api(API, {
                method: 'POST',
                body: payload
            });
            showMessage(result.message || 'Dokumen berhasil diunggah.');
            form.reset();
            await loadDocuments(1);
        } catch (error) {
            showMessage(error.message, true);
        } finally {
            button.disabled = false;
        }
    }

    async function showDetail(id) {
        const target = $('regAiDocumentDetail');
        if (target) target.textContent = 'Memuat detail...';
        try {
            const result = await api(API + '/' + encodeURIComponent(id));
            const doc = result.document || {};
            if (!target) return;
            target.innerHTML = '<dl>' +
                '<dt>Judul</dt><dd>' + escapeHtml(doc.title || '-') + '</dd>' +
                '<dt>Nama file</dt><dd>' + escapeHtml(doc.original_name || '-') + '</dd>' +
                '<dt>Nomor regulasi</dt><dd>' + escapeHtml(doc.regulation_number || '-') + '</dd>' +
                '<dt>Tanggal berlaku</dt><dd>' + formatDate(doc.effective_date) + '</dd>' +
                '<dt>Jenis file</dt><dd>' + escapeHtml(doc.mime_type || doc.extension || '-') + '</dd>' +
                '<dt>Ukuran</dt><dd>' + formatSize(doc.size_bytes) + '</dd>' +
                '<dt>Status</dt><dd>' + escapeHtml(doc.status || '-') + '</dd>' +
                '<dt>SHA-256</dt><dd style="overflow-wrap:anywhere;">' + escapeHtml(doc.sha256 || '-') + '</dd>' +
                '<dt>Diunggah</dt><dd>' + formatDate(doc.created_at) + '</dd>' +
                '</dl><p class="text-muted">Isi file belum diekstrak. Jawaban AI belum tersedia.</p>';
        } catch (error) {
            if (target) target.textContent = error.message;
        }
    }

    async function deleteDocument(id) {
        if (!window.confirm('Hapus dokumen ini secara permanen?')) return;
        try {
            const result = await api(API + '/' + encodeURIComponent(id), { method: 'DELETE' });
            showMessage(result.message || 'Dokumen dihapus.');
            const detail = $('regAiDocumentDetail');
            if (detail) detail.textContent = 'Pilih Detail pada salah satu dokumen untuk melihat metadata.';
            await loadDocuments(currentPage);
        } catch (error) {
            showMessage(error.message, true);
        }
    }

    function init() {
        if (!$('almara-regulatory-ai-view')) return;
        setCompanyLabel();
        $('regulatoryAiUploadForm')?.addEventListener('submit', uploadDocument);
        $('regAiRefreshButton')?.addEventListener('click', () => loadDocuments(currentPage));
        $('regAiSearch')?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadDocuments(1), 300);
        });
        $('regAiDocumentRows')?.addEventListener('click', (event) => {
            const detail = event.target.closest('[data-regai-detail]');
            const remove = event.target.closest('[data-regai-delete]');
            if (detail) showDetail(detail.dataset.regaiDetail);
            if (remove) deleteDocument(remove.dataset.regaiDelete);
        });
        document.addEventListener('click', (event) => {
            if (event.target.closest('[data-target="almara-regulatory-ai-view"]')) {
                setCompanyLabel();
                loadDocuments(1);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();