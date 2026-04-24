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
import { getAuth } from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
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

  // Belt-and-suspenders: if the caller didn't set uid/email, pull them from
  // Firebase Auth directly. Prevents silent drops when setGeminiUser wasn't
  // called in time and also makes the rules check (uid == auth.uid) pass.
  let uid   = entry.uid   || null;
  let email = entry.email || null;
  if (!uid) {
    try {
      const u = getAuth().currentUser;
      if (u) { uid = u.uid; email = email || u.email; }
    } catch {}
  }

  if (!uid) {
    console.warn('logGeminiRequest skipped: no authenticated user');
    return;
  }

  try {
    await addDoc(collection(db(), 'geminiLogs'), {
      uid,
      email,
      type:            entry.type || 'unknown',
      input:           entry.input || '',
      model:           entry.model || null,
      attempts:        entry.attempts ?? null,
      imageSizeKB:     entry.imageSizeKB ?? null,
      promptChars:     entry.promptChars ?? null,
      responseChars:   entry.responseChars ?? null,
      responsePreview: entry.responsePreview || null,
      tokensIn:        entry.tokensIn ?? null,
      tokensOut:       entry.tokensOut ?? null,
      description:     entry.description || '',
      calories:        entry.calories ?? null,
      proteinG:        entry.proteinG ?? null,
      carbsG:          entry.carbsG   ?? null,
      fatG:            entry.fatG     ?? null,
      confidence:      entry.confidence ?? null,
      error:           entry.error || null,
      durationMs:      entry.durationMs ?? null,
      ts:              serverTimestamp(),
    });
  } catch (e) {
    // Surface the real reason so the admin dashboard's diagnostic can see it.
    console.error('logGeminiRequest failed:', e?.code || '', e?.message || e);
  }
}

/**
 * Diagnostic probe used by the admin dashboard:
 *   - Verifies Firestore is reachable
 *   - Tries a dummy write + read + delete against a scratch doc
 *   - Counts how many rows exist in geminiLogs / userDirectory
 * Returns a JSON-serializable report.
 */
export async function runDiagnostics() {
  const report = {
    firebaseEnabled: FIREBASE_ENABLED,
    auth: { uid: null, email: null, providerId: null },
    firestore: { readUserDirectory: null, readGeminiLogs: null, writeTest: null },
    counts: { userDirectory: null, geminiLogs: null },
    errors: [],
    ts: new Date().toISOString(),
  };
  if (!FIREBASE_ENABLED) return report;

  try {
    const u = getAuth().currentUser;
    if (u) {
      report.auth.uid        = u.uid;
      report.auth.email      = u.email;
      report.auth.providerId = u.providerData?.[0]?.providerId || null;
    }
  } catch (e) { report.errors.push('auth: ' + e.message); }

  // Read userDirectory
  try {
    const s = await getDocs(collection(db(), 'userDirectory'));
    report.firestore.readUserDirectory = 'ok';
    report.counts.userDirectory = s.size;
  } catch (e) {
    report.firestore.readUserDirectory = e.code || e.message;
    report.errors.push('readUserDirectory: ' + (e.code || e.message));
  }

  // Read geminiLogs
  try {
    const s = await getDocs(collection(db(), 'geminiLogs'));
    report.firestore.readGeminiLogs = 'ok';
    report.counts.geminiLogs = s.size;
  } catch (e) {
    report.firestore.readGeminiLogs = e.code || e.message;
    report.errors.push('readGeminiLogs: ' + (e.code || e.message));
  }

  // Try a write to verify rules allow logging from this account
  try {
    const uid = report.auth.uid;
    if (!uid) throw new Error('no authenticated user');
    const ref = await addDoc(collection(db(), 'geminiLogs'), {
      uid, email: report.auth.email, type: 'diagnostic',
      input: 'probe', error: 'diagnostic probe (ignore)',
      durationMs: 0, ts: serverTimestamp(),
    });
    report.firestore.writeTest = 'ok';
    // Clean up so the probe row doesn't pollute the log
    try { await deleteDoc(ref); } catch {}
  } catch (e) {
    report.firestore.writeTest = e.code || e.message;
    report.errors.push('writeTest: ' + (e.code || e.message));
  }

  return report;
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
