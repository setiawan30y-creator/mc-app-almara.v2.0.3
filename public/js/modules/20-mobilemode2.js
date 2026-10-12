// ==========================================
// MODULE 20: MOBILE VIEW MODE (FLUTTER-STYLE)
// ==========================================

(function() {
    let mobileModeEnabled = false;

    // Detect if device is mobile based on user agent or screen width
    function detectMobileDevice() {
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 768;
        return isMobileUA || isSmallScreen;
    }

    // Inject Mobile Toggle button into header
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

    // Inject Mobile Bottom Nav bar into app container
    function injectBottomNav() {
        const appContainer = document.getElementById('appContainer');
        if (!appContainer) return;

        if (document.querySelector('.mobile-bottom-nav')) return;

        const bottomNav = document.createElement('div');
        bottomNav.className = 'mobile-bottom-nav';
        bottomNav.innerHTML = `
            <a href="#" class="mobile-bottom-nav-item active" data-target="dashboard-view">
                <i class="fa-solid fa-chart-pie"></i>
                <span>Home</span>
            </a>
            <a href="#" class="mobile-bottom-nav-item" data-target="pos-view">
                <i class="fa-solid fa-cash-register"></i>
                <span>POS</span>
            </a>
            <a href="#" class="mobile-bottom-nav-item" data-target="user-chat-view">
                <i class="fa-solid fa-comments"></i>
                <span>Chat</span>
            </a>
            <a href="#" class="mobile-bottom-nav-item" data-target="translator-view">
                <i class="fa-solid fa-language"></i>
                <span>Translator</span>
            </a>
            <a href="#" class="mobile-bottom-nav-item" data-target="sidebar-menu">
                <i class="fa-solid fa-bars"></i>
                <span>Lainnya</span>
            </a>
        `;
        appContainer.appendChild(bottomNav);
    }

    // Initialize Mobile Mode
    function initMobileMode() {
        // Inject DOM elements
        injectHeaderToggle();
        injectBottomNav();

        // Retrieve setting from local storage, default to auto-detection
        const savedSetting = localStorage.getItem('mc_mobileModeEnabled');
        if (savedSetting !== null) {
            mobileModeEnabled = (savedSetting === 'true');
        } else {
            mobileModeEnabled = detectMobileDevice();
        }

        applyMobileModeState();
        bindBottomNavEvents();
        observeViewChanges();
    }

    // Apply active class to body and update toggle UI icon/text
    function applyMobileModeState() {
        const body = document.body;
        const toggleBtn = document.getElementById('headerMobileToggleBtn');
        
        if (mobileModeEnabled) {
            body.classList.add('mobile-mode');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="fa-solid fa-desktop"></i>';
                toggleBtn.setAttribute('title', 'Ubah ke Tampilan Desktop');
                toggleBtn.style.color = '#10B981'; // Green active color
            }
            
            // Adjust sidebar state for mobile mode overlay
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        } else {
            body.classList.remove('mobile-mode');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i>';
                toggleBtn.setAttribute('title', 'Ubah ke Tampilan Mobile');
                toggleBtn.style.color = '#94A3B8'; // Muted header color
            }
        }

        // Trigger resize event to force charts and grids to recalculate
        window.dispatchEvent(new Event('resize'));
    }

    // Expose toggle function globally
    window.toggleMobileMode = function() {
        mobileModeEnabled = !mobileModeEnabled;
        localStorage.setItem('mc_mobileModeEnabled', String(mobileModeEnabled));
        applyMobileModeState();

        if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                icon: 'success',
                title: mobileModeEnabled ? 'Tampilan Mobile Aktif (Flutter-Style)' : 'Tampilan Desktop Aktif',
                background: '#1e293b',
                color: '#f8fafc'
            });
        }
    };

    // Bind event handlers for mobile bottom navigation bar
    function bindBottomNavEvents() {
        const bottomNavItems = document.querySelectorAll('.mobile-bottom-nav-item');
        bottomNavItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const targetView = item.getAttribute('data-target');
                
                if (targetView === 'sidebar-menu') {
                    // Open sidebar as slide drawer on mobile
                    const sidebar = document.getElementById('sidebar');
                    if (sidebar) {
                        sidebar.classList.add('open');
                    }
                } else {
                    // Find matching sidebar nav item and trigger click
                    const sidebarLink = document.querySelector(`.nav-item[data-target="${targetView}"]`);
                    if (sidebarLink) {
                        sidebarLink.click();
                    }
                }
            });
        });
    }

    // Observe active views to keep bottom nav items highlighted correctly
    function observeViewChanges() {
        const observer = new MutationObserver(function() {
            // Find currently active view section
            const activeSection = document.querySelector('.view-section.active');
            if (!activeSection) return;
            const viewId = activeSection.getAttribute('id');

            // Remove active class from all bottom nav items
            const bottomNavItems = document.querySelectorAll('.mobile-bottom-nav-item');
            bottomNavItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-target') === viewId) {
                    item.classList.add('active');
                }
            });
        });

        // Watch class attributes on all view-sections
        const viewSections = document.querySelectorAll('.view-section');
        viewSections.forEach(section => {
            observer.observe(section, { attributes: true, attributeFilter: ['class'] });
        });
    }

    // Auto-init on load
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(initMobileMode, 700);
        });
    } else {
        setTimeout(initMobileMode, 700);
    }
})();
