async function loadTabContent(targetId, url, initFunction = null) {
    const target = document.getElementById(targetId);
    if (!target) {
        console.warn(`Tab target "${targetId}" not found.`);
        return;
    }

    // Prevent reloading content if already loaded
    if (target.dataset.loaded === "true") {
        return;
    }

    try {
        const response = await fetch(url);
        const html = await response.text();
        target.innerHTML = html;
        target.dataset.loaded = "true"; // Mark as loaded

        // Run an optional initializer (e.g., initMap, initCalendar)
        if (typeof initFunction === "function") {
            initFunction();
        }
        
        // Initialize booking button if it exists (for map and calendar tabs)
        if ((targetId === 'nav-map' || targetId === 'nav-calendar') && typeof window.initBookingButton === "function") {
            setTimeout(() => {
                window.initBookingButton(targetId);
            }, 100);
        }
        
        // Initialize time filter to disable past times (for map and calendar tabs)
        if ((targetId === 'nav-map' || targetId === 'nav-calendar') && typeof window.initTimeFilter === "function") {
            setTimeout(async () => {
                const container = document.getElementById(targetId);
                if (container) {
                    await window.initTimeFilter(container);
                }
            }, 150);
        }

    } catch (err) {
        console.error(`Failed to load content for ${targetId}:`, err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Check user role and hide admin tab if not admin
    const userRole = (window.currentUserRole || 'student').trim().toLowerCase();
    const isAdmin = userRole === 'admin';
    
    const adminTabButton = document.getElementById('nav-admin-tab');
    const adminTabPane = document.getElementById('nav-admin');
    
    if (!isAdmin) {
        // Hide admin tab button if it exists
        if (adminTabButton) {
            adminTabButton.style.display = 'none';
        }
        // Hide admin tab pane if it exists
        if (adminTabPane) {
            adminTabPane.style.display = 'none';
        }
    }

    // Load the default tab (Map) immediately after DOM ready
    loadTabContent('nav-allbookings', '/allbookings', window.initAllBookings);

    // Set up event listeners for tab clicks
    const tabMap = {
        'nav-map-tab': { target: 'nav-map', url: '/map', init: window.initMap },
        'nav-calendar-tab': { target: 'nav-calendar', url: '/calendar', init: window.initCalendar },
        'nav-bookings-tab': { target: 'nav-bookings', url: '/mybookings', init: window.initBookings },
        'nav-allbookings-tab': { target: 'nav-allbookings', url: '/allbookings', init: window.initAllBookings },
        'nav-admin-tab': { target: 'nav-admin', url: '/admin', init: window.initAdminTools }

    };

    Object.keys(tabMap).forEach(tabId => {
        const tabButton = document.getElementById(tabId);
        if (tabButton) {
            // Skip admin tab if user is not admin
            if (tabId === 'nav-admin-tab' && !isAdmin) {
                return;
            }
            
            tabButton.addEventListener('shown.bs.tab', () => {
                const { target, url, init } = tabMap[tabId];
                // Double-check admin access before loading admin content
                if (tabId === 'nav-admin-tab' && !isAdmin) {
                    console.warn('Access denied: Admin role required');
                    return;
                }
                loadTabContent(target, url, init);

                // When switching tabs, ensure any floating instruction cards
                // from Map/Calendar are closed so they don't linger on
                // unrelated pages.
                if (target !== 'nav-map') {
                    const mapInstr = document.getElementById('mapInstructionsPanel');
                    if (mapInstr) mapInstr.classList.add('d-none');
                }
                if (target !== 'nav-calendar') {
                    const calInstr = document.getElementById('calendarInstructionsPanel');
                    if (calInstr) calInstr.classList.add('d-none');
                }
            });
        }
    });
});
