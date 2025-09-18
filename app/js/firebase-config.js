import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// LOAD FROM ENV FOR FINAL SUBMISSION!!!!!!
const firebaseConfig = {
  apiKey: "AIzaSyDcwBwQ3mepNsAWpu5r_mZRC4pYK4H82nE",
  authDomain: "academic-calendar-814e3.firebaseapp.com",
  projectId: "academic-calendar-814e3",
  storageBucket: "academic-calendar-814e3.firebasestorage.app",
  messagingSenderId: "447194977133",
  appId: "1:447194977133:web:5137928d7b1e53c778c064",
  measurementId: "G-57GSJSQCR6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
function redirectToDashboardIfAuthed() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.replace("/views/dashboard.html");
    }
  });
}

function protectPageOrRedirectToLogin() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("/views/login.html");
    }
  });
}

async function signOutAndGoHome() {
  await signOut(auth);
  window.location.replace("/");
}

export {
  app,
  auth,
  googleProvider,
  onAuthStateChanged,
  redirectToDashboardIfAuthed,
  protectPageOrRedirectToLogin,
  signOutAndGoHome,
  db,
};