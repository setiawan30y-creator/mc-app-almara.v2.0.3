// Investor dan accounting engine

// Penanam Saham (investor) dan peraga pembagian laba dipindahkan ke 35-investors.js
// (data kini di MySQL: tabel erp_investors dan erp_investor_capital_movements).
// getInvestors() tetap tersedia secara global dari modul tersebut untuk perhitungan akuntansi di bawah.

// Add hook to view change
document.addEventListener('click', (e) => {
    let target = e.target.closest('.nav-item');
    if(target && target.getAttribute('data-target') === 'laporan-lku-view') {
        if(typeof loadLaporanLku === 'function') loadLaporanLku();
    }
});

// RESET FILTER FUNCTIONS
window.resetReportFilter = function() {
    ['filterInvoice', 'filterNama', 'filterHp', 'reportStartDate', 'reportEndDate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const valutaS = document.getElementById('filterValuta');
    if(valutaS) valutaS.selectedIndex = 0;
    const tipeS = document.getElementById('filterTipe');
    if(tipeS) tipeS.selectedIndex = 0;
    
    loadReportsTable();
};

window.deleteAllTransactions = async function() {
    const confirmDelete = async () => {
        if (typeof Swal === 'undefined') {
            return confirm('Anda akan menghapus semua riwayat transaksi secara permanen. Pastikan backup database sudah dibuat.')
                && prompt('Ketik HAPUS untuk melanjutkan:') === 'HAPUS';
        }
        const first = await Swal.fire({
            title: 'PERINGATAN KERAS!',
            text: 'Semua riwayat transaksi akan dihapus permanen. Pastikan backup database sudah dibuat.',
            icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#ef4444', cancelButtonColor: '#3b82f6',
            confirmButtonText: 'Ya, Hapus Semua', cancelButtonText: 'Batal', reverseButtons: true
        });
        if (!first.isConfirmed) return false;
        const final = await Swal.fire({
            title: 'Konfirmasi Terakhir', input: 'text', inputLabel: 'Ketik "HAPUS" untuk melanjutkan',
            inputPlaceholder: 'HAPUS', showCancelButton: true,
            inputValidator: value => value === 'HAPUS' ? undefined : 'Ketik "HAPUS" dengan huruf besar!'
        });
        return final.isConfirmed;
    };

    if (!await confirmDelete()) return;
    try {
        if (typeof Swal !== 'undefined') Swal.fire({ title: 'Menghapus riwayat...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const request = window.authFetch || fetch;
        const response = await request('api/transactions/clear-all', { method: 'DELETE', headers: { Accept: 'application/json' } });
        const raw = await response.text();
        let result = {};
        try { result = raw ? JSON.parse(raw) : {}; } catch (_) { result = { message: raw }; }
        if (!response.ok || result.status !== 'success') throw new Error(result.message || `Gagal menghapus riwayat (${response.status}).`);

        // Hapus cache hanya setelah server berhasil, agar data tidak muncul lagi saat refresh/realtime sync.
        if (typeof saveTransactions === 'function') saveTransactions([]);
        else localStorage.removeItem('mc_transactions');
        window.__almaraLocalTransactionSnapshot = '[]';
        if (typeof loadReportsTable === 'function') loadReportsTable();
        if (typeof refreshActiveRealtimeViews === 'function') refreshActiveRealtimeViews();
        if (typeof Swal !== 'undefined') Swal.fire('Terhapus!', result.message || 'Semua riwayat transaksi telah dihapus.', 'success');
        else alert(result.message || 'Semua riwayat transaksi telah dihapus.');
    } catch (error) {
        console.error('Gagal menghapus semua riwayat transaksi:', error);
        if (typeof Swal !== 'undefined') Swal.fire('Gagal menghapus', error.message || 'Terjadi kesalahan sistem.', 'error');
        else alert(error.message || 'Gagal menghapus riwayat transaksi.');
    }
};
