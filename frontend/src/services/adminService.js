/**
 * services/adminService.js
 *
 * Tracks:
 *   userDirectory/{uid} → { email, name, provider, createdAt, lastLoginAt, loginCount }
 *   geminiLogs/{autoId} → { uid, email, type, input, description, calories, error, ts }
 *
 * Only used when FIREBASE_ENABLED === true.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, increment,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, FIREBASE_ENABLED } from '../config/firebaseConfig';

export const ADMIN_EMAIL = 'shay.toledo1@gmail.com';

export function isAdmin(user) {
  return !!user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

let _db = null;
function db() {
  if (_db) return _db;
  if (!getApps().length) initializeApp(FIREBASE_CONFIG);
  _db = getFirestore();
  return _db;
}

// ── Record a login in userDirectory ──────────────────────────────────────────
export async function recordUserLogin(session) {
  if (!FIREBASE_ENABLED || !session?.uid) return;
  try {
    const ref  = doc(db(), 'userDirectory', session.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        lastLoginAt: serverTimestamp(),
        loginCount:  increment(1),
        // refresh mutable fields
        name:        session.name || snap.data().name || '',
        email:       session.email,
        provider:    session.provider,
      });
    } else {
      await setDoc(ref, {
        uid:         session.uid,
        email:       session.email,
        name:        session.name || '',
        provider:    session.provider || 'email',
        createdAt:   serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        loginCount:  1,
      });
    }
  } catch (e) {
    // Non-fatal: app keeps working even if logging fails.
    console.warn('recordUserLogin failed:', e?.message);
  }
}

// ── Log a Gemini request ─────────────────────────────────────────────────────
export async function logGeminiRequest(entry) {
  if (!FIREBASE_ENABLED) return;
  try {
    await addDoc(collection(db(), 'geminiLogs'), {
      uid:         entry.uid || null,
      email:       entry.email || null,
      type:        entry.type || 'unknown',
      input:       entry.input || '',
      description: entry.description || '',
      calories:    entry.calories ?? null,
      proteinG:    entry.proteinG ?? null,
      carbsG:      entry.carbsG   ?? null,
      fatG:        entry.fatG     ?? null,
      error:       entry.error || null,
      durationMs:  entry.durationMs ?? null,
      ts:          serverTimestamp(),
    });
  } catch (e) {
    console.warn('logGeminiRequest failed:', e?.message);
  }
}

// ── Admin reads ──────────────────────────────────────────────────────────────
export async function listUsers() {
  const snap = await getDocs(query(collection(db(), 'userDirectory'), orderBy('lastLoginAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listGeminiLogs(max = 100) {
  const snap = await getDocs(query(collection(db(), 'geminiLogs'), orderBy('ts', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
