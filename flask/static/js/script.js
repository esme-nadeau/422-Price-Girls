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

    } catch (err) {
        console.error(`Failed to load content for ${targetId}:`, err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Load the default tab (Map) immediately after DOM ready
    loadTabContent('nav-map', '/map', window.initMap);

    // Set up event listeners for tab clicks
    const tabMap = {
        'nav-map-tab': { target: 'nav-map', url: '/map', init: window.initMap },
        'nav-calendar-tab': { target: 'nav-calendar', url: '/calendar', init: window.initCalendar },
        'nav-bookings-tab': { target: 'nav-bookings', url: '/mybookings', init: window.initBookings }
    };

    Object.keys(tabMap).forEach(tabId => {
        const tabButton = document.getElementById(tabId);
        if (tabButton) {
            tabButton.addEventListener('shown.bs.tab', () => {
                const { target, url, init } = tabMap[tabId];
                loadTabContent(target, url, init);
            });
        }
    });
});
