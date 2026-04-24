/**
 * services/dataService.js
 *
 * Unified data router — automatically uses Firestore when Firebase is
 * configured, or falls back to localStorage.
 *
 * No manual toggle needed: just fill in firebaseConfig.js and cloud sync
 * activates automatically on the next app load.
 */

import { FIREBASE_CONFIG } from '../config/firebaseConfig';
import * as local from './localDataService';
import * as cloud from './cloudDataService';

/** Returns true if a real Firebase config has been provided. */
export function isCloudEnabled() {
  try {
    return (
      !!FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey     !== 'YOUR_API_KEY' &&
      FIREBASE_CONFIG.projectId  !== 'YOUR_PROJECT_ID'
    );
  } catch {
    return false;
  }
}

/**
 * Wraps a cloud function and a local function into a single async call.
 * Cloud path is used when isCloudEnabled(); otherwise the local result
 * is wrapped in a resolved Promise so callers can always await it.
 */
function route(cloudFn, localFn) {
  return (...args) =>
    isCloudEnabled() ? cloudFn(...args) : Promise.resolve(localFn(...args));
}

// ── Meals ─────────────────────────────────────────────────────────────────────
export const getMeals   = route(cloud.getMeals,   local.getMealsLocal);
export const addMeal    = route(cloud.addMeal,     local.addMealLocal);
export const deleteMeal = route(cloud.deleteMeal,  local.deleteMealLocal);

// ── Goals ─────────────────────────────────────────────────────────────────────
export const getGoals   = route(cloud.getGoals,   local.getGoalsLocal);
export const saveGoals  = route(cloud.saveGoals,   local.saveGoalsLocal);

// ── Profile ───────────────────────────────────────────────────────────────────
export const getProfile  = route(cloud.getProfile,  local.getProfileLocal);
export const saveProfile = route(cloud.saveProfile, local.saveProfileLocal);

// ── Balance + History ─────────────────────────────────────────────────────────
export const computeBalance       = route(cloud.computeBalance,       local.computeBalanceLocal);
export const getPastDaysSummaries = route(cloud.getPastDaysSummaries, local.getPastDaysSummariesLocal);
