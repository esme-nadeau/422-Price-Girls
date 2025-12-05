(function () {
  if (window.__sessionDebugLoaded) return;
  window.__sessionDebugLoaded = true;

  const SESSION_ENDPOINT = '/auth/session';
  const LOGOUT_ENDPOINT = '/auth/logout';

  const fetchSession = async () => {
    try {
      const res = await fetch(SESSION_ENDPOINT, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.session) {
        return null;
      }
      return data.session;
    } catch (err) {
      console.error('Unable to load session info', err);
      return null;
    }
  };

  window.showSession = async () => {
    const session = await fetchSession();
    if (!session) {
      console.warn('Session not found.');
      return;
    }
    console.log('Session info:', session);
  };

  const handleLogoutClick = async (event) => {
    event.preventDefault();
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (!confirmLogout) return;
    try {
      await fetch(LOGOUT_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Failed to log out', err);
    } finally {
      window.location.reload();
    }
  };

  const updateLoginButton = async () => {
    const loginBtn = document.getElementById('login');
    if (!loginBtn) return;

    const session = await fetchSession();
    if (session) {
      if (!loginBtn.dataset.originalHref) {
        loginBtn.dataset.originalHref = loginBtn.getAttribute('href') || '/login';
      }
      // Preserve the person icon by setting innerHTML instead of textContent
      loginBtn.innerHTML = `<i class="bi bi-person"></i> Logout: ${session.email}`;
      loginBtn.setAttribute('href', '#');
      if (loginBtn.classList.contains('btn-outline-danger')) {
        loginBtn.classList.remove('btn-outline-danger');
        loginBtn.classList.add('btn-outline-secondary');
      }
      if (!loginBtn.dataset.logoutBound) {
        loginBtn.addEventListener('click', handleLogoutClick);
        loginBtn.dataset.logoutBound = 'true';
      }
    } else {
      const originalHref = loginBtn.dataset.originalHref || '/login';
      // Preserve the person icon when switching back to Login
      loginBtn.innerHTML = `<i class="bi bi-person"></i> Login`;
      loginBtn.setAttribute('href', originalHref);
      if (loginBtn.classList.contains('btn-outline-secondary')) {
        loginBtn.classList.remove('btn-outline-secondary');
        loginBtn.classList.add('btn-outline-danger');
      }
      if (loginBtn.dataset.logoutBound) {
        loginBtn.removeEventListener('click', handleLogoutClick);
        delete loginBtn.dataset.logoutBound;
      }
    }
  };

  const ready = () => {
    updateLoginButton();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();

