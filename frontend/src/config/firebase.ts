// Firebase configuration for frontend
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration from environment variables or fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDTVjV7AIw_RxxHwl-3tLWFUwEc_FrSHLo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "raga-mitra.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "raga-mitra",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "raga-mitra.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "873534819669",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:873534819669:web:84126eeb20ffd89da9b3dc",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-G6ZK4YS08V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Connect to Firebase Auth emulator in development if needed
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR) {
  connectAuthEmulator(auth, "http://localhost:9099");
}

// Export the app instance
export default app;

// reCAPTCHA configuration
export const RECAPTCHA_SITE_KEY = "6LcaDdsrAAAAAArs8xKdSsnQ4n4mZq5WW26L1rV1";

console.log('🔥 Firebase initialized successfully');
console.log('📱 Firebase Auth ready for phone authentication');
console.log('🔐 reCAPTCHA Site Key:', RECAPTCHA_SITE_KEY);
