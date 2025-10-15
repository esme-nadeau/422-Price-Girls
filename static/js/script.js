
function loadTabContent(tabId, url) {
    fetch(url)
        .then(response => response.text())
        .then(html => {
            document.getElementById(tabId).innerHTML = html;
        });
}

// Load initial tab
loadTabContent('nav-home', '/map');

// Add event listeners for tab clicks
document.getElementById('nav-home-tab').addEventListener('click', () => loadTabContent('nav-home', '/map'));
document.getElementById('nav-profile-tab').addEventListener('click', () => loadTabContent('nav-profile', '/calendar'));
document.getElementById('nav-contact-tab').addEventListener('click', () => loadTabContent('nav-contact', '/mybookings'));
