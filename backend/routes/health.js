/**
 * routes/health.js — Health hardware sync (HealthKit / Google Fit)
 *
 * The mobile app posts workout data collected from the device SDK; this
 * service stores it in Firestore and adjusts the day's net calorie balance
 * by adding active calories burned to the remaining budget.
 *
 * POST /api/health/sync             Ingest workout / step data from device
 * GET  /api/health/summary/:uid/:date  Return aggregated activity stats
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// ---------------------------------------------------------------------------
// POST /api/health/sync
// ---------------------------------------------------------------------------
router.post('/sync', async (req, res, next) => {
  try {
    const {
      uid,
      date,
      // Workouts: array of { type, durationMinutes, caloriesBurned, source }
      workouts = [],
      // Step data: { steps, distanceKm, activeMinutes }
      steps = {},
      // Platform that supplied the data ('healthkit' | 'google_fit')
      platform,
    } = req.body;

    if (!uid || !date) {
      return res.status(400).json({ error: 'uid and date are required.' });
    }

    // Validate that workouts is actually an array before iterating
    if (!Array.isArray(workouts)) {
      return res.status(400).json({ error: 'workouts must be an array.' });
    }

    // Calculate totals from the workouts array
    const totalActiveCalories = workouts.reduce(
      (sum, w) => sum + (Number(w.caloriesBurned) || 0),
      0
    );
    const totalActiveMinutes = workouts.reduce(
      (sum, w) => sum + (Number(w.durationMinutes) || 0),
      0
    );

    // Build the health record document
    const healthRecord = {
      uid,
      date,
      platform: platform || 'unknown',
      workouts,
      steps: steps.steps || 0,
      distanceKm: steps.distanceKm || 0,
      activeMinutes: totalActiveMinutes,
      activeCaloriesBurned: Math.round(totalActiveCalories),
      syncedAt: new Date().toISOString(),
    };

    // Write to a dedicated health sub-collection (separate from meal logs)
    await db
      .collection('users').doc(uid)
      .collection('healthLogs').doc(date)
      .set(healthRecord, { merge: true }); // merge so repeated syncs don't clobber earlier data

    // Patch the daily log with active-calorie data so the Dashboard can
    // display net calories (consumed minus burned)
    await db
      .collection('users').doc(uid)
      .collection('dailyLogs').doc(date)
      .set({
        activeMinutes: totalActiveMinutes,
        activeCaloriesBurned: Math.round(totalActiveCalories),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

    res.json({
      success: true,
      summary: {
        totalActiveCalories: Math.round(totalActiveCalories),
        totalActiveMinutes,
        workoutCount: workouts.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/health/summary/:uid/:date
// ---------------------------------------------------------------------------
router.get('/summary/:uid/:date', async (req, res, next) => {
  try {
    const { uid, date } = req.params;

    const healthSnap = await db
      .collection('users').doc(uid)
      .collection('healthLogs').doc(date)
      .get();

    if (!healthSnap.exists) {
      // Return an empty summary rather than 404 — no workouts is a valid state
      return res.json({
        date,
        activeMinutes: 0,
        activeCaloriesBurned: 0,
        steps: 0,
        distanceKm: 0,
        workouts: [],
      });
    }

    res.json(healthSnap.data());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
