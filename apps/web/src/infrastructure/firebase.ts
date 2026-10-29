import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Public Firebase Web configuration (Identifiers, not admin secrets)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSy_PLACEHOLDER_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'trellis-dev-placeholder.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'trellis-dev-placeholder',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'trellis-dev-placeholder.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:000000000000',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to local emulator if enabled
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
if (useEmulator && typeof window !== 'undefined') {
  try {
    // Only connect once
    if (!(auth as any)._emulatorConfig) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8085);
      console.info('[Trellis] Connected to Firebase Emulator Suite (Auth: 9099, Firestore: 8085)');
    }
  } catch (_err) {
    // Ignore already connected warnings in hot reload
  }
}

export { app, auth, db };
