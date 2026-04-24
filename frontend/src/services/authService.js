/**
 * services/authService.js
 *
 * Provides sign-up, sign-in, Google sign-in, sign-out, and session restore.
 *
 * Strategy:
 *  - If FIREBASE_ENABLED = true  → uses Firebase Auth (real Google OAuth + cloud storage)
 *  - If FIREBASE_ENABLED = false → uses localStorage mock (works immediately, no setup)
 *
 * localStorage mock stores accounts as:
 *   auth_users   : { [email]: { uid, name, email, passwordHash } }
 *   auth_session : { uid, name, email, provider }
 *   profile_{uid}: serialized userProfile object
 */

import { Platform } from 'react-native';
import { FIREBASE_CONFIG, FIREBASE_ENABLED } from '../config/firebaseConfig';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut,
  GoogleAuthProvider,
} from 'firebase/auth';

// Map Firebase error codes → Hebrew user-friendly messages
function fbErr(e) {
  const code = e?.code || '';
  const map = {
    'auth/email-already-in-use':     'כתובת אימייל זו כבר רשומה. נסה להתחבר.',
    'auth/invalid-email':            'כתובת אימייל לא תקינה.',
    'auth/weak-password':            'הסיסמה חלשה מדי (לפחות 6 תווים).',
    'auth/user-not-found':           'לא נמצא חשבון עם אימייל זה.',
    'auth/wrong-password':           'סיסמה שגויה.',
    'auth/invalid-credential':       'אימייל או סיסמה שגויים.',
    'auth/too-many-requests':        'יותר מדי ניסיונות. נסה שוב מאוחר יותר.',
    'auth/network-request-failed':   'שגיאת רשת. בדוק את החיבור לאינטרנט.',
    'auth/popup-closed-by-user':     'חלון ההתחברות נסגר. נסה שוב.',
    'auth/popup-blocked':            'הדפדפן חסם את חלון ההתחברות. אפשר חלונות קופצים ונסה שוב.',
    'auth/cancelled-popup-request':  'בקשת ההתחברות בוטלה.',
    'auth/unauthorized-domain':      'הדומיין אינו מאושר ב-Firebase.',
  };
  return new Error(map[code] || e?.message || 'אירעה שגיאה. נסה שנית.');
}

// ── Firebase (initialized lazily on first use) ───────────────────────────────
let firebaseAuth = null;
let googleProvider = null;

function getFirebaseAuth() {
  if (firebaseAuth) return firebaseAuth;
  if (!getApps().length) initializeApp(FIREBASE_CONFIG);
  firebaseAuth = getAuth();
  googleProvider = new GoogleAuthProvider();
  return firebaseAuth;
}

// ── Simple hash (not cryptographic — for demo localStorage only) ─────────────
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return String(h);
}

// ── localStorage helpers (web only) ─────────────────────────────────────────
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function lsDel(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register with email + password.
 * Returns { uid, name, email } or throws an error with a Hebrew message.
 */
export async function registerWithEmail(name, email, password) {
  if (!name?.trim()) throw new Error('אנא הכנס שם מלא.');
  if (!email?.includes('@')) throw new Error('כתובת אימייל לא תקינה.');
  if (!password || password.length < 6) throw new Error('הסיסמה חייבת להכיל לפחות 6 תווים.');

  if (FIREBASE_ENABLED) {
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      return { uid: cred.user.uid, name: name.trim(), email, provider: 'email' };
    } catch (e) { throw fbErr(e); }
  }

  // localStorage mock
  const users = lsGet('auth_users') || {};
  if (users[email]) throw new Error('כתובת אימייל זו כבר רשומה. נסה להתחבר.');
  const uid = 'uid_' + Date.now();
  users[email] = { uid, name: name.trim(), email, passwordHash: simpleHash(password) };
  lsSet('auth_users', users);
  const session = { uid, name: name.trim(), email, provider: 'email' };
  lsSet('auth_session', session);
  return session;
}

/**
 * Sign in with email + password.
 */
export async function signInWithEmail(email, password) {
  if (!email || !password) throw new Error('אנא הכנס אימייל וסיסמה.');

  if (FIREBASE_ENABLED) {
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return {
        uid:      cred.user.uid,
        name:     cred.user.displayName || email,
        email,
        provider: 'email',
      };
    } catch (e) { throw fbErr(e); }
  }

  // localStorage mock
  const users = lsGet('auth_users') || {};
  const user = users[email];
  if (!user) throw new Error('לא נמצא חשבון עם אימייל זה.');
  if (user.passwordHash !== simpleHash(password)) throw new Error('סיסמה שגויה.');
  const session = { uid: user.uid, name: user.name, email, provider: 'email' };
  lsSet('auth_session', session);
  return session;
}

/**
 * Sign in with Google (Firebase popup on web, redirect on native).
 * Falls back to a mock Google account in demo mode.
 */
export async function signInWithGoogle() {
  if (FIREBASE_ENABLED) {
    try {
      const auth = getFirebaseAuth();
      // Popup flow: keeps the user on the same domain so session persists.
      // Redirect flow breaks on Vercel because session is stored on
      // firebaseapp.com and can't be read from vercel.app.
      const cred = await signInWithPopup(auth, googleProvider);
      const u = cred.user;
      return {
        uid:      u.uid,
        name:     u.displayName || u.email,
        email:    u.email,
        provider: 'google',
      };
    } catch (e) { throw fbErr(e); }
  }

  // Demo mock — simulates a Google account
  if (Platform.OS === 'web') {
    const name  = window.prompt('Demo Google Sign-In\nהכנס שם תצוגה:',  'Demo User');
    const email = window.prompt('הכנס אימייל (לדמו):',                   'demo@gmail.com');
    if (!name || !email) throw new Error('בוטל.');
    const uid = 'google_' + simpleHash(email);
    const session = { uid, name, email, provider: 'google' };
    lsSet('auth_session', session);
    return session;
  }

  throw new Error('Google Sign-In requires Firebase configuration.');
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (FIREBASE_ENABLED) {
    const auth = getFirebaseAuth();
    await fbSignOut(auth);
  }
  lsDel('auth_session');
}

/**
 * Restore the previous session from localStorage (called on app load).
 * Returns the session object or null.
 */
export function restoreSession() {
  if (FIREBASE_ENABLED) return null; // Firebase handles this via onAuthStateChanged
  return lsGet('auth_session') || null;
}

/**
 * Persist a user's profile keyed by uid.
 */
export function saveProfileToStorage(uid, profile) {
  lsSet(`profile_${uid}`, profile);
}

/**
 * Load a user's profile from storage.
 */
export function loadProfileFromStorage(uid) {
  return lsGet(`profile_${uid}`) || null;
}
