// HRIS and operations modules (Koin & Uang Lama dipindah ke 43-koin-uang-lama.js)

// Navigasi: muat data investor saat menu dibuka (Koin & Uang Lama ada di 43-koin-uang-lama.js)
document.addEventListener('click', (e) => {
    const target = e.target.closest('.nav-item');
    if (target && target.getAttribute('data-target') === 'investor-view' && typeof window.loadInvestorTable === 'function') {
        window.loadInvestorTable();
    }
});


// HRIS (Karyawan, Absensi, Shift & Cuti, Kasbon, BPJS, Penggajian) dipindah ke 59-hris.js


window.openGlobalImagePreview = function(src) {
    if(!src) return;
    document.getElementById('globalLightboxImg').src = src;
    document.getElementById('globalImageLightbox').classList.add('show');
};

window.toggleEntitas = function() {
    const radios = document.getElementsByName('modalCustTypeGroup');
    let selected = '';
    for(let r of radios) {
        if(r.checked) {
            selected = r.value;
            break;
        }
    }
    // Database memakai kode numerik KN: 1 Perorangan, 2 Perusahaan.
    selected = selected === '2' ? '2' : (selected === '1' ? '1' : '');
    document.getElementById('modalCustType').value = selected;
    if(typeof generateCif === 'function' && !window.isEditingCustomer) generateCif();
    
    // Fields to enable
    const formFields = ['modalCustName', 'modalCustBirthPlace', 'modalCustBirthDate', 
                        'modalCustAddress', 'modalCustGender', 'modalCustCitizen', 
                        'modalCustJob', 'modalCustPhone', 'modalCustBankAcc', 
                        'modalCustNpwp', 'modalCustPhoto'];
    
    const selIdType = document.getElementById('modalCustIdType');
    if(selected === '1' || selected === '2') {
        formFields.forEach(f => {
            const el = document.getElementById(f);
            if(el) el.disabled = false;
        });
        
        if(selected === '1') {
            selIdType.disabled = false;
            selIdType.innerHTML = `
                <option value="">Pilih Jenis Identitas</option>
                <option value="KTP">KTP</option>
                <option value="SIM">SIM</option>
                <option value="PASSPORT">PASSPORT</option>
                <option value="KITAS">KITAS</option>
            `;
        } else if(selected === '2') {
            selIdType.disabled = false;
            selIdType.innerHTML = `
                <option value="SERTIFIKAT">SERTIFIKAT</option>
            `;
        }
    } else {
        formFields.forEach(f => {
            const el = document.getElementById(f);
            if(el) el.disabled = true;
        });
        
        selIdType.disabled = true;
        selIdType.innerHTML = '<option value="">Sentuh Tipe Entitas Terlebih Dahulu!</option>';
    }
    
    window.toggleCustPassportPlaceholder();
};

window.toggleCustPassportPlaceholder = function() {
    const type = String(document.getElementById('modalCustIdType').value || 'KTP').toUpperCase();
    const nikInput = document.getElementById('modalCustNik');
    const otherIdInput = document.getElementById('modalCustIdNo');
    const nikGroup = document.getElementById('modalCustNikGroup');
    const otherIdGroup = document.getElementById('modalCustIdNoGroup');
    if (!nikInput || !otherIdInput) return;

    // Kedua nomor identitas selalu boleh diketik manual. Pemilihan jenis ID
    // hanya mengubah bantuan teks dan tidak lagi mengunci/mengosongkan input.
    nikInput.disabled = false;
    otherIdInput.disabled = false;
    nikInput.readOnly = false;
    otherIdInput.readOnly = false;
    const isKtp = type === 'KTP';
    if (nikGroup) nikGroup.style.display = isKtp ? '' : 'none';
    if (otherIdGroup) otherIdGroup.style.display = isKtp ? 'none' : '';
    nikInput.placeholder = isKtp
        ? '16 Digit NIK (bisa diketik manual)'
        : '16 Digit NIK (bisa diketik manual)';
    otherIdInput.placeholder = type
        ? `Nomor ${type} / ID lainnya`
        : 'Nomor ID lainnya';
};

