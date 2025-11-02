// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";  // ✅ NEW
import { Timestamp } from 'firebase/firestore'; //NEW

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4pzsOgHxZyNQ0oVMAtNAgCEqR5LdVfos",
  authDomain: "deschutes-room-reservation.firebaseapp.com",
  projectId: "deschutes-room-reservation",
  storageBucket: "deschutes-room-reservation.firebasestorage.app",
  messagingSenderId: "813605344323",
  appId: "1:813605344323:web:ecad3610e5ee99b2eff0f6",
  measurementId: "G-5PGERSRX34"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ✅ Initialize Firestore and export it
const db = getFirestore(app);
// import db anywhere to access firestore
export { app, analytics, db, Timestamp };
