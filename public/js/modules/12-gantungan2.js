// Modul Manajemen Gantungan Rupiah (Piutang & Utang Kasir)

function getGantungans() {
    return window.safeArrayGet('mc_gantungans');
}

function saveGantungans(data) {
    localStorage.setItem('mc_gantungans', JSON.stringify(data));
    if (typeof pushToUniversalDatastore === 'function') {
        pushToUniversalDatastore('mc_gantungans', data);
    }
}

// Render Utama halaman gantungan
window.initGantunganView = function() {
    loadGantungansTable();
    renderGantunganSummary();
};

function renderGantunganSummary() {
    const data = getGantungans();
    let totalPiutang = 0;
    let totalUtang = 0;

    data.forEach(item => {
        if (item.status === 'BELUM_LUNAS') {
            const sisa = item.nominal - (item.terbayar || 0);
            if (item.tipe === 'PIUTANG') {
                totalPiutang += sisa;
            } else if (item.tipe === 'UTANG') {
                totalUtang += sisa;
            }
        }
    });

    const netSaldo = totalPiutang - totalUtang;

    const piutangEl = document.getElementById('gantunganTotalPiutang');
    const utangEl = document.getElementById('gantunganTotalUtang');
    const netEl = document.getElementById('gantunganNetSaldo');

    if (piutangEl) piutangEl.textContent = formatIdr(totalPiutang);
    if (utangEl) utangEl.textContent = formatIdr(totalUtang);
    if (netEl) {
        netEl.textContent = formatIdr(Math.abs(netSaldo));
        if (netSaldo === 0) {
            netEl.style.color = '#cbd5e1';
            netEl.textContent = 'Rp 0';
        } else if (netSaldo > 0) {
            netEl.style.color = '#F59E0B'; // Orange / Piutang Bersih
            netEl.textContent = '+' + netEl.textContent;
        } else {
            netEl.style.color = '#3B82F6'; // Blue / Utang Bersih
            netEl.textContent = '-' + netEl.textContent;
        }
    }
}

window.loadGantungansTable = function() {
    const data = getGantungans();
    const tbody = document.getElementById('gantunganTableBody');
    if (!tbody) return;

    const searchText = (document.getElementById('gantunganSearch')?.value || '').toLowerCase().trim();
    const filterStatus = document.getElementById('gantunganFilterStatus')?.value || 'all';

    // Sort by timestamp desc
    let filtered = data.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply Filter Status
    if (filterStatus === 'BELUM_LUNAS') {
        filtered = filtered.filter(item => item.status === 'BELUM_LUNAS');
    } else if (filterStatus === 'LUNAS') {
        filtered = filtered.filter(item => item.status === 'LUNAS');
    }

    // Apply Filter Search
    if (searchText) {
        filtered = filtered.filter(item => 
            String(item.nama_nasabah || '').toLowerCase().includes(searchText) ||
            String(item.keterangan || '').toLowerCase().includes(searchText) ||
            String(item.id || '').toLowerCase().includes(searchText)
        );
    }

    let html = '';
    const currentUser = JSON.parse(localStorage.getItem('mc_currentUser')) || { role: 'kasir' };
    const canDelete = ['owner', 'admin'].includes(currentUser.role);

    filtered.forEach(item => {
        const dateStr = window.formatDateToDMY ? window.formatDateToDMY(item.timestamp) : item.timestamp.split('T')[0];
        
        // Deteksi usia gantungan (hari)
        const createdDate = new Date(item.timestamp);
        const diffTime = Math.abs(new Date() - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
        let usiaHtml = '';

        if (item.status === 'BELUM_LUNAS') {
            if (diffDays > 7) {
                usiaHtml = `<span style="color: #EF4444; font-weight: bold;" title="Sudah lewat dari 7 hari!"><i class="fa-solid fa-triangle-exclamation"></i> ${diffDays} hari</span>`;
            } else {
                usiaHtml = `<span style="color: #cbd5e1;">${diffDays} hari</span>`;
            }
        } else {
            usiaHtml = `<span style="color: #94a3b8; text-decoration: line-through;">Lunas</span>`;
        }

        let typeBadge = '';
        if (item.tipe === 'PIUTANG') {
            typeBadge = '<span class="badge" style="background:#F59E0B; position:static;">Keluar (Piutang)</span>';
        } else {
            typeBadge = '<span class="badge" style="background:#3B82F6; position:static;">Masuk (Utang)</span>';
        }

        let statusBadge = '';
        let actionButtons = '';
        const sisa = item.nominal - (item.terbayar || 0);

        if (item.status === 'BELUM_LUNAS') {
            statusBadge = '<span class="badge" style="background:#EF4444; position:static;">Belum Lunas</span>';
            actionButtons += `
                <button class="btn btn-sm btn-warning" onclick="openGantunganCicilModal('${item.id}')" title="Bayar Sebagian / Cicil">
                    <i class="fa-solid fa-coins"></i> Cicil
                </button>
                <button class="btn btn-sm btn-success" onclick="settleGantungan('${item.id}')" title="Tandai Lunas / Selesai">
                    <i class="fa-solid fa-check-double"></i> Lunasi
                </button>
            `;
        } else {
            const lunasDate = item.tanggal_lunas ? (window.formatDateToDMY ? window.formatDateToDMY(item.tanggal_lunas) : item.tanggal_lunas.split('T')[0]) : '-';
            statusBadge = `<span class="badge" style="background:#10B981; position:static;">Lunas (${lunasDate})</span>`;
        }

        if (canDelete) {
            actionButtons += `
                <button class="btn btn-sm btn-danger" onclick="deleteGantungan('${item.id}')" title="Hapus Permanen">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        }

        html += `
            <tr>
                <td>${dateStr}</td>
                <td>${usiaHtml}</td>
                <td><strong>${item.id}</strong></td>
                <td>${item.nama_nasabah}</td>
                <td>${typeBadge}</td>
                <td style="text-align: right; color: #94a3b8;">${formatIdr(item.nominal)}</td>
                <td style="text-align: right; font-weight: bold; color: ${sisa > 0 ? (item.tipe === 'PIUTANG' ? '#F59E0B' : '#3B82F6') : 'inherit'};">${formatIdr(sisa)}</td>
                <td>${item.keterangan || '-'}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center" style="white-space: nowrap;">${actionButtons || '-'}</td>
            </tr>
        `;
    });

    if (filtered.length === 0) {
        html = `<tr><td colspan="10" class="text-center text-muted" style="padding: 20px;">Tidak ada data gantungan.</td></tr>`;
    }

    tbody.innerHTML = html;
};

// Modal handlers
window.openGantunganModal = function() {
    document.getElementById('gantunganModalForm').reset();
    document.getElementById('gantunganModal').style.display = 'flex';
};

window.closeGantunganModal = function() {
    document.getElementById('gantunganModal').style.display = 'none';
};

window.saveGantungan = function() {
    const nama = document.getElementById('mGantunganNama').value.trim();
    const tipe = document.getElementById('mGantunganTipe').value;
    const nominalStr = document.getElementById('mGantunganNominal').value.replace(/[^\d]/g, '');
    const nominal = parseInt(nominalStr, 10) || 0;
    const keterangan = document.getElementById('mGantunganKeterangan').value.trim();

    if (!nama) {
        alert("Nama Nasabah / Staf wajib diisi!");
        return;
    }
    if (nominal <= 0) {
        alert("Nominal gantungan harus lebih besar dari Rp 0!");
        return;
    }

    const data = getGantungans();
    const newItem = {
        id: 'GNT-' + Date.now().toString().slice(-6),
        timestamp: new Date().toISOString(),
        tipe: tipe,
        nama_nasabah: nama,
        nominal: nominal,
        terbayar: 0,
        riwayat_cicilan: [],
        keterangan: keterangan,
        status: 'BELUM_LUNAS',
        tanggal_lunas: null
    };

    data.push(newItem);
    saveGantungans(data);

    closeGantunganModal();
    window.initGantunganView();
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Catatan Gantungan Berhasil Disimpan',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1500,
            showConfirmButton: false
        });
    } else {
        alert("Catatan Gantungan berhasil disimpan!");
    }
};

window.settleGantungan = function(id) {
    const confirmationText = "Tandai gantungan ini sebagai LUNAS? Uang fisik laci kasir harus disesuaikan.";
    
    const action = () => {
        const data = getGantungans();
        const item = data.find(x => x.id === id);
        if (!item) return;

        item.status = 'LUNAS';
        item.terbayar = item.nominal; // Set full terbayar
        item.tanggal_lunas = new Date().toISOString();
        saveGantungans(data);

        window.initGantunganView();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Gantungan berhasil dilunasi',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Konfirmasi Pelunasan',
            text: confirmationText,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Ya, Lunasi!',
            cancelButtonText: 'Batal',
            background: '#1e293b',
            color: '#f8fafc'
        }).then((result) => {
            if (result.isConfirmed) {
                action();
            }
        });
    } else {
        if (confirm(confirmationText)) {
            action();
        }
    }
};

window.deleteGantungan = function(id) {
    const action = () => {
        let data = getGantungans();
        data = data.filter(x => x.id !== id);
        saveGantungans(data);

        window.initGantunganView();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Catatan Gantungan dihapus',
                background: '#1e293b',
                color: '#f8fafc',
                timer: 1500,
                showConfirmButton: false
            });
        }
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Hapus Gantungan?',
            text: "Data akan dihapus permanen dari server. Tindakan ini tidak bisa dibatalkan.",
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
        if (confirm("Apakah Anda yakin ingin menghapus data gantungan ini secara permanen?")) {
            action();
        }
    }
};

// Modals cicilan handlers
window.openGantunganCicilModal = function(id) {
    const data = getGantungans();
    const item = data.find(x => x.id === id);
    if (!item) return;

    document.getElementById('mCicilId').value = item.id;
    document.getElementById('mCicilNama').value = item.nama_nasabah;
    document.getElementById('mCicilNominalAwal').value = formatIdr(item.nominal);
    
    const sisa = item.nominal - (item.terbayar || 0);
    document.getElementById('mCicilSisaSaldo').value = formatIdr(sisa);
    document.getElementById('mCicilJumlah').value = '';
    document.getElementById('mCicilKeterangan').value = '';

    document.getElementById('gantunganCicilModal').style.display = 'flex';
};

window.closeGantunganCicilModal = function() {
    document.getElementById('gantunganCicilModal').style.display = 'none';
};

window.saveGantunganCicil = function() {
    const id = document.getElementById('mCicilId').value;
    const jumlahStr = document.getElementById('mCicilJumlah').value.replace(/[^\d]/g, '');
    const jumlah = parseInt(jumlahStr, 10) || 0;
    const catatan = document.getElementById('mCicilKeterangan').value.trim();

    if (jumlah <= 0) {
        alert("Nominal pembayaran cicilan harus lebih besar dari Rp 0!");
        return;
    }

    const data = getGantungans();
    const item = data.find(x => x.id === id);
    if (!item) return;

    const sisaSaatIni = item.nominal - (item.terbayar || 0);
    if (jumlah > sisaSaatIni) {
        alert(`Nominal pembayaran melebihi sisa saldo gantungan (${formatIdr(sisaSaatIni)})!`);
        return;
    }

    item.terbayar = (item.terbayar || 0) + jumlah;
    
    // Catat riwayat
    item.riwayat_cicilan = item.riwayat_cicilan || [];
    item.riwayat_cicilan.push({
        tanggal: new Date().toISOString(),
        nominal: jumlah,
        catatan: catatan
    });

    // Gabungkan ke keterangan lama
    const formattedDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const cicilLog = `[Dicicil Rp ${jumlah.toLocaleString('id-ID')} tgl ${formattedDate}: ${catatan}]`;
    item.keterangan = item.keterangan ? `${item.keterangan} | ${cicilLog}` : cicilLog;

    // Jika lunas
    if (item.nominal - item.terbayar <= 0) {
        item.status = 'LUNAS';
        item.tanggal_lunas = new Date().toISOString();
    }

    saveGantungans(data);
    closeGantunganCicilModal();
    window.initGantunganView();

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Pembayaran Sebagian Berhasil Disimpan',
            background: '#1e293b',
            color: '#f8fafc',
            timer: 1500,
            showConfirmButton: false
        });
    } else {
        alert("Pembayaran sebagian berhasil disimpan!");
    }
};

// Auto-formatting nominal input modal dengan Rupiah
setTimeout(() => {
    const input = document.getElementById('mGantunganNominal');
    if (input) {
        input.addEventListener('input', function() {
            const val = parseInt(this.value.replace(/[^\d]/g, ''), 10) || 0;
            this.value = val > 0 ? formatIdr(val) : '';
        });
    }

    const inputCicil = document.getElementById('mCicilJumlah');
    if (inputCicil) {
        inputCicil.addEventListener('input', function() {
            const val = parseInt(this.value.replace(/[^\d]/g, ''), 10) || 0;
            this.value = val > 0 ? formatIdr(val) : '';
        });
    }
}, 1000);
