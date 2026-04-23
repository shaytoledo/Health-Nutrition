/**
 * routes/goals.js — Daily macro goal management
 *
 * GET  /api/goals/:uid              Fetch the active goal for today
 * POST /api/goals/:uid              Create or overwrite the goal for a date
 * GET  /api/goals/:uid/balance      Remaining vs. consumed macros for today
 * POST /api/goals/:uid/auto         Auto-calculate targets from user profile (BMR/TDEE)
 */

const express = require('express');
const router = express.Router();

const { db } = require('../config/firebase');
const {
  calculateBMR,
  calculateTDEE,
  calculateMacroTargets,
  calculateDailyBalance,
} = require('../services/calorieCalculator');

// ---------------------------------------------------------------------------
// GET /api/goals/:uid
// ---------------------------------------------------------------------------
router.get('/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0]; // default to today

    const goalRef = db.collection('users').doc(uid).collection('goals').doc(date);
    const goalSnap = await goalRef.get();

    if (!goalSnap.exists) {
      return res.status(404).json({ error: `No goal found for ${date}.` });
    }

    res.json({ goal: goalSnap.data() });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/goals/:uid
// ---------------------------------------------------------------------------
router.post('/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { date, targetCalories, targetProteinG, targetCarbsG, targetFatG } = req.body;

    if (!targetCalories) {
      return res.status(400).json({ error: 'targetCalories is required.' });
    }

    const goalDate = date || new Date().toISOString().split('T')[0];

    const goal = {
      uid,
      date: goalDate,
      targetCalories: Math.round(Number(targetCalories)),
      targetProteinG: Math.round(Number(targetProteinG) || 0),
      targetCarbsG: Math.round(Number(targetCarbsG) || 0),
      targetFatG: Math.round(Number(targetFatG) || 0),
      updatedAt: new Date().toISOString(),
    };

    // set() with merge:false to fully overwrite (user may be correcting a mistake)
    await db.collection('users').doc(uid).collection('goals').doc(goalDate).set(goal);

    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/goals/:uid/balance
// Returns: how much of the daily target has been consumed and what remains
// ---------------------------------------------------------------------------
router.get('/:uid/balance', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Fetch goal and daily log in parallel to minimise latency
    const [goalSnap, logSnap] = await Promise.all([
      db.collection('users').doc(uid).collection('goals').doc(date).get(),
      db.collection('users').doc(uid).collection('dailyLogs').doc(date).get(),
    ]);

    if (!goalSnap.exists) {
      return res.status(404).json({ error: `No goal set for ${date}. Create one first.` });
    }

    const goal = goalSnap.data();
    // If no meals logged yet, default consumed totals to zero
    const log = logSnap.exists ? logSnap.data() : {
      totalCalories: 0,
      totalProteinG: 0,
      totalCarbsG: 0,
      totalFatG: 0,
    };

    const balance = calculateDailyBalance(
      {
        targetCalories: goal.targetCalories,
        targetProteinG: goal.targetProteinG,
        targetCarbsG:   goal.targetCarbsG,
        targetFatG:     goal.targetFatG,
      },
      {
        totalCalories: log.totalCalories,
        totalProteinG: log.totalProteinG,
        totalCarbsG:   log.totalCarbsG,
        totalFatG:     log.totalFatG,
      }
    );

    res.json({ date, balance });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/goals/:uid/auto
// Auto-generate targets from the user's stored profile using BMR/TDEE
// ---------------------------------------------------------------------------
router.post('/:uid/auto', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const date = req.body.date || new Date().toISOString().split('T')[0];

    // Load user profile from Firestore
    const profileSnap = await db.collection('users').doc(uid).collection('profile').doc('data').get();
    if (!profileSnap.exists) {
      return res.status(404).json({ error: 'User profile not found. Complete onboarding first.' });
    }

    const profile = profileSnap.data();
    const bmr = calculateBMR(profile.weightKg, profile.heightCm, profile.age, profile.gender);
    const tdee = calculateTDEE(bmr, profile.activityLevel);
    const targets = calculateMacroTargets(tdee);

    const goal = {
      uid,
      date,
      ...targets,
      generatedFrom: 'auto_bmr',
      bmr,
      tdee,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(uid).collection('goals').doc(date).set(goal);

    res.status(201).json({ goal, bmr, tdee });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/goals/:uid/from-quiz
// Calculate BMR/TDEE from biometrics sent directly in the request body.
// Used by the GoalsScreen questionnaire — no saved profile required.
// ---------------------------------------------------------------------------
router.post('/:uid/from-quiz', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { date, weightKg, heightCm, age, gender, activityLevel } = req.body;

    if (!weightKg || !heightCm || !age || !activityLevel) {
      return res.status(400).json({ error: 'weightKg, heightCm, age, and activityLevel are required.' });
    }

    const goalDate = date || new Date().toISOString().split('T')[0];

    const bmr = calculateBMR(
      Number(weightKg), Number(heightCm), Number(age), gender || 'other'
    );
    const tdee = calculateTDEE(bmr, activityLevel);
    const targets = calculateMacroTargets(tdee);

    const goal = {
      uid,
      date: goalDate,
      ...targets,
      generatedFrom: 'quiz_bmr',
      bmr,
      tdee,
      quizInputs: { weightKg, heightCm, age, gender, activityLevel },
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(uid).collection('goals').doc(goalDate).set(goal);

    res.status(201).json({ goal, bmr, tdee });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
