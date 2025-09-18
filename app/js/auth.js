// Auth flows for login and register pages
import { auth, googleProvider, redirectToDashboardIfAuthed } from "/js/firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";

function setError(message) {
  const el = document.getElementById('error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.style.display = '';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

function navigateToDashboard() {
  window.location.replace('/views/dashboard.html');
}

function setupLoginPage() {
  // If already authed, go to dashboard
  redirectToDashboardIfAuthed();

  const form = document.getElementById('loginForm');
  const googleBtn = document.getElementById('googleBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    const email = /** @type {HTMLInputElement} */(document.getElementById('email'))?.value.trim();
    const password = /** @type {HTMLInputElement} */(document.getElementById('password'))?.value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigateToDashboard();
    } catch (err) {
      setError(err?.message || 'Failed to sign in.');
    }
  });

  googleBtn?.addEventListener('click', async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigateToDashboard();
    } catch (err) {
      setError(err?.message || 'Google sign-in failed.');
    }
  });
}

function setupRegisterPage() {
  // If already authed, go to dashboard
  redirectToDashboardIfAuthed();

  const form = document.getElementById('registerForm');
  const googleBtn = document.getElementById('googleBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    const email = /** @type {HTMLInputElement} */(document.getElementById('email'))?.value.trim();
    const password = /** @type {HTMLInputElement} */(document.getElementById('password'))?.value;
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigateToDashboard();
    } catch (err) {
      setError(err?.message || 'Failed to register.');
    }
  });

  googleBtn?.addEventListener('click', async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      navigateToDashboard();
    } catch (err) {
      setError(err?.message || 'Google sign-in failed.');
    }
  });
}

export { setupLoginPage, setupRegisterPage };