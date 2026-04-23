/**
 * models/dailyLog.js — Firestore document schema for a user's daily summary
 *
 * Firestore path: users/{uid}/dailyLogs/{date}
 *
 * The dailyLog document is an aggregate that is recalculated every time a
 * meal is added, edited, or deleted. It avoids expensive real-time summation
 * of the meals sub-collection when rendering the Dashboard.
 */

/**
 * Creates an empty daily log document for a specific date.
 * Called once per (uid, date) pair the first time a meal is logged.
 *
 * @param {string} uid   Firebase Auth UID
 * @param {string} date  ISO date: YYYY-MM-DD
 * @returns {object}
 */
function createEmptyDailyLog(uid, date) {
  return {
    uid,
    date,
    totalCalories: 0,
    totalProteinG: 0,
    totalCarbsG: 0,
    totalFatG: 0,
    mealCount: 0,
    // activeMinutes is populated by health sync; defaults to 0
    activeMinutes: 0,
    // activeCaloriesBurned is populated by health sync
    activeCaloriesBurned: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Rebuilds the aggregate totals from an array of meal documents.
 * Always call this after adding or removing a meal to keep the log in sync.
 *
 * @param {string}   uid    Firebase Auth UID
 * @param {string}   date   ISO date: YYYY-MM-DD
 * @param {object[]} meals  Array of meal documents from Firestore
 * @returns {object} Updated dailyLog document (ready for Firestore set/update)
 */
function recalculateDailyLog(uid, date, meals) {
  const totals = meals.reduce(
    (acc, meal) => {
      acc.totalCalories += meal.calories || 0;
      acc.totalProteinG += meal.proteinG || 0;
      acc.totalCarbsG += meal.carbsG || 0;
      acc.totalFatG += meal.fatG || 0;
      return acc;
    },
    { totalCalories: 0, totalProteinG: 0, totalCarbsG: 0, totalFatG: 0 }
  );

  return {
    uid,
    date,
    ...totals,
    mealCount: meals.length,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { createEmptyDailyLog, recalculateDailyLog };
