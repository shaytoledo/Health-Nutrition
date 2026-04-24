/**
 * services/cloudDataService.js
 *
 * Firestore-backed persistence — same API surface as localDataService.
 *
 * Schema:
 *   users/{uid}/meals/{date}   → { items: Meal[] }
 *   users/{uid}/data/goals     → GoalsDoc
 *   users/{uid}/data/profile   → ProfileDoc
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../config/firebaseConfig';

let _db = null;

function db() {
  if (_db) return _db;
  if (!getApps().length) initializeApp(FIREBASE_CONFIG);
  _db = getFirestore();
  return _db;
}

// ── Meals ─────────────────────────────────────────────────────────────────────

const mealDocRef = (uid, date) => doc(db(), 'users', uid, 'meals', date);

export async function getMeals(uid, date) {
  const snap = await getDoc(mealDocRef(uid, date));
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function addMeal(uid, date, mealData) {
  const meal = { ...mealData, id: 'meal_' + Date.now(), createdAt: new Date().toISOString() };
  const ref  = mealDocRef(uid, date);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { items: [meal, ...(snap.data().items || [])] });
  } else {
    await setDoc(ref, { items: [meal] });
  }
  return meal;
}

export async function deleteMeal(uid, date, mealId) {
  const ref  = mealDocRef(uid, date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const items = (snap.data().items || []).filter((m) => m.id !== mealId);
  await updateDoc(ref, { items });
}

// ── Goals ─────────────────────────────────────────────────────────────────────

const DEFAULT_GOALS = { targetCalories: 2000, targetProteinG: 150, targetCarbsG: 250, targetFatG: 70 };
const goalsDocRef   = (uid) => doc(db(), 'users', uid, 'data', 'goals');

export async function getGoals(uid) {
  const snap = await getDoc(goalsDocRef(uid));
  return snap.exists() ? { ...DEFAULT_GOALS, ...snap.data() } : { ...DEFAULT_GOALS };
}

export async function saveGoals(uid, goals) {
  await setDoc(goalsDocRef(uid), goals, { merge: true });
}

// ── Profile ───────────────────────────────────────────────────────────────────

const profileDocRef = (uid) => doc(db(), 'users', uid, 'data', 'profile');

export async function getProfile(uid) {
  const snap = await getDoc(profileDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, profile) {
  await setDoc(profileDocRef(uid), profile, { merge: true });
}

// ── Balance ───────────────────────────────────────────────────────────────────

export async function computeBalance(uid, date) {
  const [meals, targets] = await Promise.all([getMeals(uid, date), getGoals(uid)]);
  const consumed = meals.reduce(
    (acc, m) => ({
      totalCalories: acc.totalCalories + (m.calories || 0),
      totalProteinG: acc.totalProteinG + (m.proteinG  || 0),
      totalCarbsG:   acc.totalCarbsG   + (m.carbsG    || 0),
      totalFatG:     acc.totalFatG     + (m.fatG       || 0),
    }),
    { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 }
  );
  return {
    consumed,
    targets,
    caloriesProgress: targets.targetCalories
      ? Math.min((consumed.totalCalories / targets.targetCalories) * 100, 100)
      : 0,
  };
}

// ── History: past N days summaries ────────────────────────────────────────────

export async function getPastDaysSummaries(uid, numDays = 7) {
  const today = new Date();
  const promises = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = d.toISOString().split('T')[0];
    return computeBalance(uid, date)
      .then((b) => ({ date, ...b }))
      .catch(() => ({
        date,
        consumed:         { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 },
        targets:          { targetCalories: 2000, targetProteinG: 150, targetCarbsG: 250, targetFatG: 70 },
        caloriesProgress: 0,
      }));
  });
  return Promise.all(promises);
}
