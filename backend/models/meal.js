/**
 * models/meal.js — Firestore document schema for a single meal entry
 *
 * Firestore path: users/{uid}/dailyLogs/{date}/meals/{mealId}
 *
 * Each meal document stores the nutritional breakdown returned either by the
 * AI vision service or entered manually by the user.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Valid data sources for a meal entry.
 * - ai_scan    : Nutritional data was extracted by Gemini Vision from a photo
 * - manual     : User typed the values themselves
 * - health_sync: Data was imported from HealthKit / Google Fit
 */
const MEAL_SOURCES = ['ai_scan', 'manual', 'health_sync'];

/**
 * Creates a new meal document.
 *
 * @param {string} uid              Firebase Auth UID of the owner
 * @param {string} date             ISO date string: YYYY-MM-DD
 * @param {object} nutritionData    Nutritional values
 * @param {string} nutritionData.description  Human-readable food name
 * @param {number} nutritionData.calories     Total calories (kcal)
 * @param {number} nutritionData.proteinG     Protein in grams
 * @param {number} nutritionData.carbsG       Carbohydrates in grams
 * @param {number} nutritionData.fatG         Fat in grams
 * @param {string} [nutritionData.imageUrl]   Firebase Storage URL of the photo (optional)
 * @param {string} [source]         One of MEAL_SOURCES (default: 'manual')
 * @returns {object} Firestore-ready meal document
 */
function createMeal(uid, date, nutritionData, source = 'manual') {
  if (!MEAL_SOURCES.includes(source)) {
    throw new Error(`Invalid source "${source}". Must be one of: ${MEAL_SOURCES.join(', ')}`);
  }

  // Ensure numeric fields are actually numbers, not strings from form data
  const calories = Math.round(Number(nutritionData.calories) || 0);
  const proteinG = Math.round(Number(nutritionData.proteinG) || 0);
  const carbsG = Math.round(Number(nutritionData.carbsG) || 0);
  const fatG = Math.round(Number(nutritionData.fatG) || 0);

  return {
    id: uuidv4(),
    uid,
    date,
    timestamp: new Date().toISOString(),
    description: nutritionData.description || 'Unknown food',
    imageUrl: nutritionData.imageUrl || null,
    calories,
    proteinG,
    carbsG,
    fatG,
    source,
  };
}

module.exports = { createMeal, MEAL_SOURCES };
