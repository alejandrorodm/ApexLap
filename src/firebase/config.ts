// ─────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN DE FIREBASE
//  Rellena estos valores con los de TU proyecto Firebase (gratis).
//  Pasos en el README (sección "Configurar Firebase").  Resumen rápido:
//    1. console.firebase.google.com  ->  Add project
//    2. Build > Firestore Database  ->  Create database (modo test para empezar)
//    3. Build > Authentication > Sign-in method  ->  habilita "Anonymous"
//    4. Project settings (engranaje) > tus apps > Web (</>)  ->  copia el config
//    5. Pega los valores aquí debajo.
// ─────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
} from 'firebase/firestore';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import * as fbAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyD262ll4I_E9lfN7DU82c7AjFpV_S6B-cI',
  authDomain: 'laptimersaver.firebaseapp.com',
  projectId: 'laptimersaver',
  storageBucket: 'laptimersaver.firebasestorage.app',
  messagingSenderId: '1058766757504',
  appId: '1:1058766757504:web:647b63148da63690479065',
  measurementId: 'G-FVMY9T9VWP',
};

/** true cuando el usuario ya ha sustituido los placeholders por valores reales. */
export const isFirebaseConfigured = !Object.values(firebaseConfig).some(
  (v) => typeof v === 'string' && v.startsWith('PEGA_AQUI')
);

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

function ensureApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getDb(): Firestore {
  if (_db) return _db;
  const app = ensureApp();
  try {
    // En React Native conviene forzar long-polling para evitar problemas de red.
    // ignoreUndefinedProperties: descarta campos undefined (p.ej. notes/challengeId
    // opcionales) en vez de petar el guardado — Firestore no admite undefined.
    _db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true,
    });
  } catch {
    _db = getFirestore(app);
  }
  return _db;
}

export function getAppAuth(): Auth {
  if (_auth) return _auth;
  const app = ensureApp();
  try {
    // Persistencia con AsyncStorage para mantener la sesión entre reinicios.
    const persistence = (fbAuth as any).getReactNativePersistence?.(AsyncStorage);
    _auth = persistence
      ? initializeAuth(app, { persistence })
      : getAuth(app);
  } catch {
    _auth = getAuth(app);
  }
  return _auth;
}
