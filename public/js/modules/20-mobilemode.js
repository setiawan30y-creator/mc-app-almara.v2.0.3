// ==========================================
// MODULE 20: MOBILE VIEW MODE (FLUTTER-STYLE)
// ==========================================

(function() {
    let mobileModeEnabled = false;
    function detectMobileDevice() {
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 768;
        return isMobileUA || isSmallScreen;
    }
    function injectHeaderToggle() {
        const headerRight = document.querySelector('.top-header .header-right');
        if (!headerRight) return;
        if (document.getElementById('headerMobileToggleBtn')) return;
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'header-mobile-toggle';
        toggleDiv.id = 'headerMobileToggleBtn';
        toggleDiv.style.cssText = 'cursor: pointer; margin-left: 20px; font-size: 1.2rem; color: #94A3B8; display: flex; align-items: center; justify-content: center;';
        toggleDiv.setAttribute('onclick', 'toggleMobileMode()');
        toggleDiv.setAttribute('title', 'Ubah ke Tampilan Mobile');
        toggleDiv.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i>';
        headerRight.appendChild(toggleDiv);
    }
    function injectBottomNav() {
        const appContainer = document.getElementById('appContainer');
        if (!appContainer) return;
        if (document.querySelector('.mobile-bottom-nav')) return;
        const bottomNav = document.createElement('div');
        bottomNav.className = 'mobile-bottom-nav';
        bottomNav.innerHTML = `
            <a href="#" class="mobile-bottom-nav-item active" data-target="dashboard-view"><i class="fa-solid fa-chart-pie"></i><span>Home</span></a>
            <a href="#" class="mobile-bottom-nav-item" data-target="pos-view"><i class="fa-solid fa-cash-register"></i><span>POS</span></a>
            <a href="#" class="mobile-bottom-nav-item" data-target="user-chat-view"><i class="fa-solid fa-comments"></i><span>Chat</span></a>
            <a href="#" class="mobile-bottom-nav-item" data-target="translator-view"><i class="fa-solid fa-language"></i><span>Translator</span></a>
            <a href="#" class="mobile-bottom-nav-item" data-target="sidebar-menu"><i class="fa-solid fa-bars"></i><span>Lainnya</span></a>`;
        appContainer.appendChild(bottomNav);
    }
    function initMobileMode() {
        injectHeaderToggle();
        injectBottomNav();
        const savedSetting = localStorage.getItem('mc_mobileModeEnabled');
        mobileModeEnabled = savedSetting !== null ? (savedSetting === 'true') : detectMobileDevice();
        applyMobileModeState();
        bindBottomNavEvents();
        observeViewChanges();
    }
    function applyMobileModeState() {
        const body = document.body;
        const toggleBtn = document.getElementById('headerMobileToggleBtn');
        if (mobileModeEnabled) {
            body.classList.add('mobile-mode');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="fa-solid fa-desktop"></i>';
                toggleBtn.setAttribute('title', 'Ubah ke Tampilan Desktop');
                toggleBtn.style.color = document.body.classList.contains('apv-theme') ? '#1D6C5D' : (document.body.classList.contains('light-theme') ? '#2563EB' : '#10B981');
            }
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
        } else {
            body.classList.remove('mobile-mode');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i>';
                toggleBtn.setAttribute('title', 'Ubah ke Tampilan Mobile');
                toggleBtn.style.color = document.body.classList.contains('apv-theme') ? '#69736F' : (document.body.classList.contains('light-theme') ? '#64748B' : '#94A3B8');
            }
        }
        window.dispatchEvent(new Event('resize'));
    }
    window.toggleMobileMode = function() {
        mobileModeEnabled = !mobileModeEnabled;
        localStorage.setItem('mc_mobileModeEnabled', String(mobileModeEnabled));
        applyMobileModeState();
        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            const isApv = document.body.classList.contains('apv-theme');
            const isLight = document.body.classList.contains('light-theme');
            Swal.fire({ toast:true, position:'top-end', showConfirmButton:false, timer:2000, icon:'success', title:mobileModeEnabled ? 'Tampilan Mobile Aktif (Flutter-Style)' : 'Tampilan Desktop Aktif', background:isApv ? '#F7F5EF' : (isLight ? '#FFFFFF' : '#1E293B'), color:isApv ? '#18221F' : (isLight ? '#1E293B' : '#F8FAFC') });
        }
    };
    function bindBottomNavEvents() {
        document.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const targetView = item.getAttribute('data-target');
                if (targetView === 'sidebar-menu') {
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar) sidebar.classList.add('open');
                } else {
                    const sidebarLink = document.querySelector(`.nav-item[data-target="${targetView}"]`);
                    if (sidebarLink) sidebarLink.click();
                }
            });
        });
    }
    function observeViewChanges() {
        const observer = new MutationObserver(function() {
            const activeSection = document.querySelector('.view-section.active');
            if (!activeSection) return;
            const viewId = activeSection.getAttribute('id');
            document.querySelectorAll('.mobile-bottom-nav-item').forEach(item => {
                item.classList.toggle('active', item.getAttribute('data-target') === viewId);
            });
        });
        document.querySelectorAll('.view-section').forEach(section => observer.observe(section, { attributes:true, attributeFilter:['class'] }));
    }
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(initMobileMode, 700));
    else setTimeout(initMobileMode, 700);
})();

(function () {
    function loadGlobalThemeEngine() {
        if (window.MCTheme || document.getElementById('mcGlobalThemeEngine')) return;
        const script = document.createElement('script');
        script.id = 'mcGlobalThemeEngine';
        script.src = '/js/mc-theme-engine.js?v=20260924-3';
        script.onload = function () { if (window.MCTheme) window.MCTheme.apply(window.MCTheme.load(), false); };
        script.onerror = function () { console.warn('MC global theme engine gagal dimuat. Dashboard tetap menggunakan theme APV bawaan.'); };
        document.head.appendChild(script);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadGlobalThemeEngine, { once:true });
    else loadGlobalThemeEngine();
})();

/* Sidebar recovery is loaded from Module 20 because Module 20 is dynamically
 * injected by 01-core after DOM initialization. This makes the fix independent
 * from optional POS/UX modules. */
(function () {
    function loadSidebarRecovery() {
        if (document.getElementById('almara-sidebar-fix-loader')) return;
        const script = document.createElement('script');
        script.id = 'almara-sidebar-fix-loader';
        script.src = '/js/modules/99-sidebar-fix.js?v=20260929-2';
        script.onload = function () { console.log('[Sidebar] Recovery layer aktif.'); };
        script.onerror = function () { console.error('[Sidebar] Recovery layer gagal dimuat:', script.src); };
        document.head.appendChild(script);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadSidebarRecovery, { once:true });
    else loadSidebarRecovery();
})();
