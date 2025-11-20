// Esme's auth tester
// Minimal Firebase auth UI: Initialize from window.FIREBASE_CONFIG or from pasted config.

console.log('esme_auth.js loaded');

const allowedDomain = 'uoregon.edu';

function showStatus(text, ok = false) {
  const status = document.getElementById('esmeAuthStatus');
  if (status) {
    status.textContent = text;
    status.style.color = ok ? 'green' : '';
  }
}

async function initFirebaseFromConfig(cfg) {
  try {
    if (!window.firebase) {
      showStatus('Firebase SDK not loaded', false);
      return false;
    }
    window.firebase.initializeApp(cfg);
    window.auth = window.firebase.auth();
    // Listen for auth state
    auth.onAuthStateChanged(user => {
      if (user) {
        const email = user.email || '';
        if (!email.endsWith('@' + allowedDomain)) {
          showStatus('Unauthorized domain: ' + email, false);
          // sign out immediately
          auth.signOut();
          return;
        }
        showStatus('Signed in as ' + email, true);
        // toggle buttons
        const signOutBtn = document.getElementById('esmeSignOutBtn');
        const signInBtn = document.getElementById('esmeSignInBtn');
        const signUpBtn = document.getElementById('esmeSignUpBtn');
        if (signOutBtn) signOutBtn.style.display = 'inline-block';
        if (signInBtn) signInBtn.style.display = 'none';
        if (signUpBtn) signUpBtn.style.display = 'none';
      } else {
        showStatus('Not signed in');
        const signOutBtn = document.getElementById('esmeSignOutBtn');
        const signInBtn = document.getElementById('esmeSignInBtn');
        const signUpBtn = document.getElementById('esmeSignUpBtn');
        if (signOutBtn) signOutBtn.style.display = 'none';
        if (signInBtn) signInBtn.style.display = 'inline-block';
        if (signUpBtn) signUpBtn.style.display = 'inline-block';
      }
    });

    return true;
  } catch (err) {
    console.error('initFirebase error', err);
    showStatus('Firebase init error');
    return false;
  }
}

async function tryInitAuto() {
  // If page sets FIREBASE_CONFIG globally, use it
  if (window.FIREBASE_CONFIG) {
    await initFirebaseFromConfig(window.FIREBASE_CONFIG);
    return;
  }
  // Otherwise, show the config area to allow paste
  const cfgArea = document.getElementById('firebase-config-area');
  if (cfgArea) cfgArea.style.display = 'block';
}

function loadConfigFromTextarea() {
  const txt = document.getElementById('firebaseConfigInput').value;
  try {
    const cfg = JSON.parse(txt);
    // Save to window for reuse
    window.FIREBASE_CONFIG = cfg;
    initFirebaseFromConfig(cfg).then(ok => {
      if (ok) showStatus('Firebase initialized from pasted config', true);
    });
  } catch (err) {
    showStatus('Invalid JSON');
  }
}

function clearSavedConfig() {
  delete window.FIREBASE_CONFIG;
  showStatus('Cleared saved config');
}

function attachUI() {
  document.getElementById('loadFirebaseConfigBtn')?.addEventListener('click', loadConfigFromTextarea);
  document.getElementById('clearSavedConfigBtn')?.addEventListener('click', clearSavedConfig);

  document.getElementById('esmeSignInBtn')?.addEventListener('click', async () => {
    const emailEl = document.getElementById('esmeEmail');
    const passEl = document.getElementById('esmePassword');
    const email = emailEl?.value?.trim();
    const password = passEl?.value || '';
    if (!window.auth) {
      showStatus('Firebase not initialized. Paste config or set FIREBASE_CONFIG on the page.');
      return;
    }
    if (!email || !email.endsWith('@' + allowedDomain)) {
      showStatus('Please use a @uoregon.edu email');
      return;
    }
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      console.error('signin error', err);
      showStatus('Sign-in error: ' + (err.message || ''));
    }
  });

  document.getElementById('esmeSignUpBtn')?.addEventListener('click', async () => {
    const emailEl = document.getElementById('esmeEmail');
    const passEl = document.getElementById('esmePassword');
    const email = emailEl?.value?.trim();
    const password = passEl?.value || '';
    if (!window.auth) {
      showStatus('Firebase not initialized. Paste config or set FIREBASE_CONFIG on the page.');
      return;
    }
    if (!email || !email.endsWith('@' + allowedDomain)) {
      showStatus('Please use a @uoregon.edu email to sign up');
      return;
    }
    try {
      await auth.createUserWithEmailAndPassword(email, password);
      showStatus('Account created — you are signed in', true);
    } catch (err) {
      console.error('signup error', err);
      showStatus('Sign-up error: ' + (err.message || ''));
    }
  });

  document.getElementById('esmeSignOutBtn')?.addEventListener('click', async () => {
    if (!window.auth) return;
    await auth.signOut();
    showStatus('Signed out');
  });
}

// Load firebase scripts dynamically (compat SDK for quick prototyping)
function loadFirebaseSdkIfMissing() {
  if (window.firebase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s1 = document.createElement('script');
    s1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
    s1.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js';
      s2.onload = resolve;
      s2.onerror = reject;
      document.head.appendChild(s2);
    };
    s1.onerror = reject;
    document.head.appendChild(s1);
  });
}

async function boot() {
  await loadFirebaseSdkIfMissing();
  attachUI();
  tryInitAuto();
}

document.addEventListener('DOMContentLoaded', () => {
  // Only boot when modal exists
  if (document.getElementById('esmeAuthModal')) {
    boot();
  }
});
