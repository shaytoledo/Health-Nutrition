/**
 * routes/food.js — Food logging endpoints
 *
 * POST /api/food/scan       Upload a food photo → AI analysis → store meal
 * POST /api/food/manual     Log a meal with manually entered nutrition data
 * GET  /api/food/log/:uid/:date  Fetch all meals logged on a specific date
 * DELETE /api/food/meal/:uid/:date/:mealId  Remove a single meal entry
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();

const { db, storage } = require('../config/firebase');
const { analyzeFoodImage } = require('../services/geminiVisionService');
const { createMeal } = require('../models/meal');
const { recalculateDailyLog, createEmptyDailyLog } = require('../models/dailyLog');

// Store uploads in memory (not disk) — we forward the buffer directly to
// Gemini and optionally to Firebase Storage. Max file size: 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accept only image MIME types to prevent arbitrary file uploads
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are accepted.'), false);
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Helper: update the aggregate daily log after any meal change
// ---------------------------------------------------------------------------
async function refreshDailyLog(uid, date) {
  const mealsSnap = await db
    .collection('users').doc(uid)
    .collection('dailyLogs').doc(date)
    .collection('meals')
    .get();

  const meals = mealsSnap.docs.map((d) => d.data());
  const logData = meals.length
    ? recalculateDailyLog(uid, date, meals)
    : createEmptyDailyLog(uid, date);

  await db
    .collection('users').doc(uid)
    .collection('dailyLogs').doc(date)
    .set(logData, { merge: true });
}

// ---------------------------------------------------------------------------
// POST /api/food/scan
// ---------------------------------------------------------------------------
router.post('/scan', upload.single('image'), async (req, res, next) => {
  try {
    const { uid, date } = req.body;

    if (!uid || !date) {
      return res.status(400).json({ error: 'uid and date are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Step 1: Send the image to Gemini Vision for nutritional analysis
    let nutritionData;
    try {
      nutritionData = await analyzeFoodImage(req.file.buffer, req.file.mimetype);
    } catch (visionError) {
      // FOOD_NOT_RECOGNIZED is a user-facing 422, not a 500 server error
      if (visionError.code === 'FOOD_NOT_RECOGNIZED') {
        return res.status(422).json({
          error: visionError.message,
          code: 'FOOD_NOT_RECOGNIZED',
        });
      }
      throw visionError; // unexpected error — let global handler deal with it
    }

    // Step 2: (Optional) Upload the original photo to Firebase Storage
    // so the user can see it in their meal history.
    let imageUrl = null;
    try {
      const filename = `meals/${uid}/${date}/${Date.now()}.jpg`;
      const file = storage.file(filename);
      await file.save(req.file.buffer, { contentType: req.file.mimetype });
      // Generate a publicly readable signed URL valid for 7 days
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      imageUrl = url;
    } catch (storageError) {
      // Photo upload failure is non-fatal — we still save the meal without a photo
      console.warn('[food/scan] Storage upload failed:', storageError.message);
    }

    // Step 3: Create the meal document and write it to Firestore
    const meal = createMeal(uid, date, { ...nutritionData, imageUrl }, 'ai_scan');

    await db
      .collection('users').doc(uid)
      .collection('dailyLogs').doc(date)
      .collection('meals').doc(meal.id)
      .set(meal);

    // Step 4: Refresh the aggregate daily log totals
    await refreshDailyLog(uid, date);

    res.status(201).json({ meal });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/food/manual
// ---------------------------------------------------------------------------
router.post('/manual', async (req, res, next) => {
  try {
    const { uid, date, description, calories, proteinG, carbsG, fatG } = req.body;

    if (!uid || !date || !description) {
      return res.status(400).json({ error: 'uid, date, and description are required.' });
    }

    const meal = createMeal(uid, date, { description, calories, proteinG, carbsG, fatG }, 'manual');

    await db
      .collection('users').doc(uid)
      .collection('dailyLogs').doc(date)
      .collection('meals').doc(meal.id)
      .set(meal);

    await refreshDailyLog(uid, date);

    res.status(201).json({ meal });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/food/log/:uid/:date
// ---------------------------------------------------------------------------
router.get('/log/:uid/:date', async (req, res, next) => {
  try {
    const { uid, date } = req.params;

    const mealsSnap = await db
      .collection('users').doc(uid)
      .collection('dailyLogs').doc(date)
      .collection('meals')
      .orderBy('timestamp', 'asc')
      .get();

    const meals = mealsSnap.docs.map((d) => d.data());
    res.json({ meals, count: meals.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/food/meal/:uid/:date/:mealId
// ---------------------------------------------------------------------------
router.delete('/meal/:uid/:date/:mealId', async (req, res, next) => {
  try {
    const { uid, date, mealId } = req.params;

    const mealRef = db
      .collection('users').doc(uid)
      .collection('dailyLogs').doc(date)
      .collection('meals').doc(mealId);

    const mealSnap = await mealRef.get();
    if (!mealSnap.exists) {
      return res.status(404).json({ error: 'Meal not found.' });
    }

    await mealRef.delete();
    await refreshDailyLog(uid, date);

    res.json({ success: true, deletedId: mealId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
