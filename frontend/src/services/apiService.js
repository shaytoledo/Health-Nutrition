/**
 * services/apiService.js — Centralised HTTP client for the backend API
 *
 * All network calls go through this module. Components and context actions
 * import named functions from here rather than calling axios directly, which:
 * 1. Makes it easy to swap the base URL for staging vs. production
 * 2. Provides a single place to attach auth headers
 * 3. Normalises error objects so callers always get an Error with a .message
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Change this to your local IP (not localhost) when testing on a physical device,
// or to your deployed server URL in production.
const BASE_URL = 'http://10.0.2.2:3000/api'; // Android emulator default
// const BASE_URL = 'http://localhost:3000/api'; // iOS simulator

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 s — Gemini Vision calls can be slow on large images
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Response / error interceptors
// ---------------------------------------------------------------------------

// Attach a Firebase ID token to every request if the user is signed in.
// This is a stub — replace with actual Firebase Auth token retrieval.
client.interceptors.request.use(async (config) => {
  try {
    // Example (requires firebase/auth):
    // const { currentUser } = getAuth();
    // if (currentUser) {
    //   const token = await currentUser.getIdToken();
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
  } catch {
    // Token fetch is non-blocking — proceed without auth header
  }
  return config;
});

// Convert HTTP error responses into JS Error objects with meaningful messages
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Network error — check your connection.';

    const enhancedError = new Error(message);
    enhancedError.statusCode = error.response?.status;
    enhancedError.code = error.response?.data?.code;
    return Promise.reject(enhancedError);
  }
);

// ---------------------------------------------------------------------------
// Food endpoints
// ---------------------------------------------------------------------------

/**
 * Sends a food image (as FormData) to the backend for AI analysis.
 * Returns the created meal document.
 *
 * @param {string} uid      Firebase Auth UID
 * @param {string} date     YYYY-MM-DD
 * @param {object} imageFile  { uri, mimeType } — from expo-image-picker or expo-camera
 */
async function scanFoodImage(uid, date, imageFile) {
  const formData = new FormData();
  formData.append('uid', uid);
  formData.append('date', date);
  formData.append('image', {
    uri: imageFile.uri,
    type: imageFile.mimeType || 'image/jpeg',
    name: 'meal.jpg',
  });

  const { data } = await client.post('/food/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Extend timeout for large images; Gemini can take up to 15 s
    timeout: 60000,
  });

  return data; // { meal }
}

/**
 * Logs a manually entered meal (user typed the values).
 *
 * @param {string} uid
 * @param {string} date
 * @param {object} nutritionData  { description, calories, proteinG, carbsG, fatG }
 */
async function logManualMeal(uid, date, nutritionData) {
  const { data } = await client.post('/food/manual', { uid, date, ...nutritionData });
  return data; // { meal }
}

/**
 * Fetches all meals logged for a user on a given date.
 *
 * @returns {{ meals: object[], count: number }}
 */
async function getMeals(uid, date) {
  const { data } = await client.get(`/food/log/${uid}/${date}`);
  return data;
}

/**
 * Deletes a single meal entry.
 */
async function deleteMeal(uid, date, mealId) {
  const { data } = await client.delete(`/food/meal/${uid}/${date}/${mealId}`);
  return data;
}

// ---------------------------------------------------------------------------
// Goals endpoints
// ---------------------------------------------------------------------------

/**
 * Fetches the daily macro targets for a user.
 */
async function getGoal(uid, date) {
  const { data } = await client.get(`/goals/${uid}`, { params: { date } });
  return data; // { goal }
}

/**
 * Creates or replaces the daily macro targets for a user.
 *
 * @param {object} goal  { targetCalories, targetProteinG, targetCarbsG, targetFatG, date? }
 */
async function setGoal(uid, goal) {
  const { data } = await client.post(`/goals/${uid}`, goal);
  return data; // { goal }
}

/**
 * Returns remaining vs. consumed macros for the day.
 */
async function getGoalBalance(uid, date) {
  const { data } = await client.get(`/goals/${uid}/balance`, { params: { date } });
  return data; // { date, balance }
}

/**
 * Auto-generates targets from the user's stored profile (BMR/TDEE).
 */
async function autoGenerateGoal(uid, date) {
  const { data } = await client.post(`/goals/${uid}/auto`, { date });
  return data; // { goal, bmr, tdee }
}

/**
 * Calculates BMR/TDEE from quiz answers and saves the resulting goal.
 * Sends user biometrics directly — no need for a saved profile.
 *
 * @param {string} uid
 * @param {object} params  { date, weightKg, heightCm, age, gender, activityLevel }
 */
async function setGoalFromQuiz(uid, params) {
  const { data } = await client.post(`/goals/${uid}/from-quiz`, params);
  return data; // { goal, bmr, tdee }
}

// ---------------------------------------------------------------------------
// Health sync endpoints
// ---------------------------------------------------------------------------

/**
 * Posts workout data collected from the device SDK to the backend.
 *
 * @param {string} uid
 * @param {string} date
 * @param {object[]} workouts   Array from healthKitService or googleFitService
 * @param {object}  steps       { steps, distanceKm, activeMinutes }
 * @param {string}  platform    'healthkit' | 'google_fit'
 */
async function syncHealthData(uid, date, workouts, steps, platform) {
  const { data } = await client.post('/health/sync', { uid, date, workouts, steps, platform });
  return data;
}

/**
 * Fetches the aggregated activity summary for a day.
 */
async function getHealthSummary(uid, date) {
  const { data } = await client.get(`/health/summary/${uid}/${date}`);
  return data;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const apiService = {
  scanFoodImage,
  logManualMeal,
  getMeals,
  deleteMeal,
  getGoal,
  setGoal,
  getGoalBalance,
  autoGenerateGoal,
  setGoalFromQuiz,
  syncHealthData,
  getHealthSummary,
};
