import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';

// ─────────────────────────────────────────────────────────────
//  CREDENCIALES — pega los valores desde Firebase Console:
//  https://console.firebase.google.com/project/rentas01pa43/settings/general
//  Sección "Tu app" → SDK de configuración → Config
// ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        'rent-001pa43.firebaseapp.com',
  projectId:         'rent-001pa43',
  storageBucket:     'rent-001pa43.firebasestorage.app',
  messagingSenderId: '951577654645',
  appId:             '1:951577654645:web:af2354f1a9b8ba0327cf3c',
};

// Evita reinicializar en hot-reload
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export default app;
