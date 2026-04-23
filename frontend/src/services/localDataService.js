/**
 * services/localDataService.js
 *
 * Full client-side meal + balance storage using localStorage.
 * Replaces the backend API for demo / offline mode.
 */

function mealsKey(uid, date) { return `meals_${uid}_${date}`; }

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export function getMealsLocal(uid, date) {
  return lsGet(mealsKey(uid, date)) || [];
}

export function addMealLocal(uid, date, mealData) {
  const meals = getMealsLocal(uid, date);
  const meal = {
    ...mealData,
    id:         'meal_' + Date.now(),
    createdAt:  new Date().toISOString(),
  };
  meals.unshift(meal);
  lsSet(mealsKey(uid, date), meals);
  return meal;
}

export function deleteMealLocal(uid, date, mealId) {
  const meals = getMealsLocal(uid, date).filter((m) => m.id !== mealId);
  lsSet(mealsKey(uid, date), meals);
}

// ── Goals ────────────────────────────────────────────────────────────────────

function goalsKey(uid) { return `goals_${uid}`; }

export function getGoalsLocal(uid) {
  return lsGet(goalsKey(uid)) || {
    targetCalories: 2000,
    targetProteinG: 150,
    targetCarbsG:   250,
    targetFatG:     70,
  };
}

export function saveGoalsLocal(uid, goals) {
  lsSet(goalsKey(uid), goals);
}

// ── Balance computation ──────────────────────────────────────────────────────

export function computeBalanceLocal(uid, date) {
  const meals   = getMealsLocal(uid, date);
  const targets = getGoalsLocal(uid);

  const consumed = meals.reduce(
    (acc, m) => ({
      totalCalories: acc.totalCalories + (m.calories || 0),
      totalProteinG: acc.totalProteinG + (m.proteinG || 0),
      totalCarbsG:   acc.totalCarbsG   + (m.carbsG   || 0),
      totalFatG:     acc.totalFatG     + (m.fatG      || 0),
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
