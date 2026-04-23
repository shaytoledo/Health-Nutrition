/**
 * services/calorieCalculator.js — Daily macro target & balance calculations
 *
 * Implements:
 * 1. Harris-Benedict BMR formula (revised 1984) — estimates resting metabolism
 * 2. Activity multiplier table — scales BMR to TDEE (Total Daily Energy Expenditure)
 * 3. Macro split — distributes TDEE across protein, carbs, and fat
 * 4. Balance calculator — subtracts consumed macros from daily targets
 */

// ---------------------------------------------------------------------------
// Activity level multipliers (PAL — Physical Activity Level)
// ---------------------------------------------------------------------------
const ACTIVITY_MULTIPLIERS = {
  sedentary:   1.2,   // desk job, no structured exercise
  light:       1.375, // 1–3 light workouts per week
  moderate:    1.55,  // 3–5 moderate workouts per week
  active:      1.725, // 6–7 intense workouts per week
  very_active: 1.9,   // physical job + twice-daily training
};

// ---------------------------------------------------------------------------
// Macro distribution ratios (% of total calories)
// These reflect a moderate-protein diet suitable for fat loss or maintenance.
// Adjust for specific goals (e.g., increase protein ratio for muscle gain).
// ---------------------------------------------------------------------------
const MACRO_RATIOS = {
  protein: 0.25, // 25% of calories from protein (4 kcal/g)
  carbs:   0.45, // 45% of calories from carbohydrates (4 kcal/g)
  fat:     0.30, // 30% of calories from fat (9 kcal/g)
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculates Basal Metabolic Rate using the Harris-Benedict (1984) equation.
 * BMR is the number of calories the body burns at complete rest.
 *
 * @param {number} weightKg
 * @param {number} heightCm
 * @param {number} age         Years
 * @param {string} gender      'male' | 'female' | 'other' (other uses average)
 * @returns {number} BMR in kcal/day (rounded to nearest integer)
 */
function calculateBMR(weightKg, heightCm, age, gender = 'other') {
  let bmr;

  if (gender === 'male') {
    // Male: 88.362 + (13.397 × weight) + (4.799 × height) − (5.677 × age)
    bmr = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
  } else if (gender === 'female') {
    // Female: 447.593 + (9.247 × weight) + (3.098 × height) − (4.330 × age)
    bmr = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
  } else {
    // Average of male and female formulas when gender is unspecified
    const maleBMR   = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
    const femaleBMR = 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
    bmr = (maleBMR + femaleBMR) / 2;
  }

  return Math.round(bmr);
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE) by scaling BMR by the
 * user's physical activity level.
 *
 * @param {number} bmr
 * @param {string} activityLevel  Key of ACTIVITY_MULTIPLIERS
 * @returns {number} TDEE in kcal/day
 */
function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];

  if (!multiplier) {
    throw new Error(
      `Unknown activity level "${activityLevel}". Valid options: ${Object.keys(ACTIVITY_MULTIPLIERS).join(', ')}`
    );
  }

  return Math.round(bmr * multiplier);
}

/**
 * Breaks TDEE down into gram targets for each macronutrient.
 *
 * @param {number} targetCalories  Daily calorie target (typically TDEE)
 * @returns {{ targetCalories, targetProteinG, targetCarbsG, targetFatG }}
 */
function calculateMacroTargets(targetCalories) {
  // Calories allocated to each macro group
  const proteinCalories = targetCalories * MACRO_RATIOS.protein;
  const carbsCalories   = targetCalories * MACRO_RATIOS.carbs;
  const fatCalories     = targetCalories * MACRO_RATIOS.fat;

  return {
    targetCalories,
    targetProteinG: Math.round(proteinCalories / 4), // protein: 4 kcal per gram
    targetCarbsG:   Math.round(carbsCalories / 4),   // carbs:   4 kcal per gram
    targetFatG:     Math.round(fatCalories / 9),      // fat:     9 kcal per gram
  };
}

/**
 * Computes the remaining macros for the day by subtracting consumed amounts
 * from the daily targets. Negative values indicate the target has been exceeded.
 *
 * @param {object} targets   { targetCalories, targetProteinG, targetCarbsG, targetFatG }
 * @param {object} consumed  { totalCalories, totalProteinG, totalCarbsG, totalFatG }
 * @returns {object}  Remaining values plus percentage progress (0–100)
 */
function calculateDailyBalance(targets, consumed) {
  const remainingCalories = targets.targetCalories - (consumed.totalCalories || 0);
  const remainingProteinG = targets.targetProteinG - (consumed.totalProteinG || 0);
  const remainingCarbsG   = targets.targetCarbsG   - (consumed.totalCarbsG   || 0);
  const remainingFatG     = targets.targetFatG     - (consumed.totalFatG     || 0);

  // Progress percentage capped at 100 so the progress bar never overflows
  const caloriesProgress = Math.min(
    100,
    Math.round(((consumed.totalCalories || 0) / targets.targetCalories) * 100)
  );
  const proteinProgress = Math.min(
    100,
    Math.round(((consumed.totalProteinG || 0) / targets.targetProteinG) * 100)
  );

  return {
    remainingCalories,
    remainingProteinG,
    remainingCarbsG,
    remainingFatG,
    caloriesProgress,
    proteinProgress,
    // Expose raw consumed totals so the client doesn't need a separate query
    consumed,
    targets,
  };
}

/**
 * All-in-one convenience function: given a user profile, returns both the
 * recommended macro targets and the current day's balance.
 *
 * @param {object} userProfile   { weightKg, heightCm, age, gender, activityLevel }
 * @param {object} consumed      { totalCalories, totalProteinG, totalCarbsG, totalFatG }
 * @returns {object}
 */
function getFullDayBalance(userProfile, consumed) {
  const bmr = calculateBMR(
    userProfile.weightKg,
    userProfile.heightCm,
    userProfile.age,
    userProfile.gender
  );

  const tdee = calculateTDEE(bmr, userProfile.activityLevel);
  const targets = calculateMacroTargets(tdee);
  const balance = calculateDailyBalance(targets, consumed);

  return { bmr, tdee, ...balance };
}

module.exports = {
  calculateBMR,
  calculateTDEE,
  calculateMacroTargets,
  calculateDailyBalance,
  getFullDayBalance,
  ACTIVITY_MULTIPLIERS,
  MACRO_RATIOS,
};
