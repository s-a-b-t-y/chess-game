/**
 * The Final Check - Firebase Initialization and Firestore Helper
 */

const firebaseConfig = {
  apiKey: "AIzaSyDPqRySCjm1uSpAfD3QFfjWBxRaJxKFEx0",
  authDomain: "the-final-check.firebaseapp.com",
  projectId: "the-final-check",
  storageBucket: "the-final-check.firebasestorage.app",
  messagingSenderId: "1089896291744",
  appId: "1:1089896291744:web:4b9b18dcbe4fa32b4258c5",
  measurementId: "G-7MW2XSCEZ0"
};

let db = null;
let firebaseReady = false;

try {
  // Verify Firebase Compat SDK is loaded and credentials are not default placeholders
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_")) {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    firebaseReady = true;
    console.log("Firebase Firestore successfully initialized!");
  } else {
    console.warn("Firebase SDK was not loaded or is misconfigured. Falling back to local storage.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

// Expose state and db globally for the other scripts (index.js, signin.html, signup.html)
window.firebaseReady = firebaseReady;
window.db = db;
