/**
 * services/healthKitService.js — HealthKit (iOS) and Google Fit (Android) sync
 *
 * Uses the expo-health package which provides a unified API over both platforms.
 * On iOS it reads from Apple HealthKit; on Android from Google Health Connect.
 *
 * Calling flow:
 * 1. requestPermissions()   — must be called once (e.g., on first launch)
 * 2. getTodayWorkouts()     — returns completed workouts for today
 * 3. getTodaySteps()        — returns step count, distance, and active minutes
 *
 * The results are passed to apiService.syncHealthData() to be stored server-side
 * and reflected in the calorie balance.
 */

import { Platform } from 'react-native';

// expo-health is an optional dependency — gracefully degrade on web
let Health;
try {
  Health = require('expo-health');
} catch {
  Health = null;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Requests read permissions for workout and activity data.
 * Must be called before any data queries.
 *
 * @returns {Promise<boolean>} true if all permissions were granted
 */
async function requestPermissions() {
  // Health APIs are only available on iOS and Android, not web
  if (!Health || Platform.OS === 'web') {
    console.warn('[HealthKit] expo-health is not available on this platform.');
    return false;
  }

  try {
    const permissions = {
      read: [
        Health.HealthDataType.WORKOUT,
        Health.HealthDataType.STEPS,
        Health.HealthDataType.DISTANCE_WALKING_RUNNING,
        Health.HealthDataType.ACTIVE_ENERGY_BURNED,
      ],
      // We don't write nutrition data back to HealthKit in this MVP
      write: [],
    };

    const result = await Health.requestPermissionsAsync(permissions);
    return result.status === 'granted';
  } catch (err) {
    console.error('[HealthKit] Permission request failed:', err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Data queries
// ---------------------------------------------------------------------------

/**
 * Fetches workouts completed today from the device Health SDK.
 *
 * @returns {Promise<object[]>} Array of workout objects, or [] on failure
 * Each item: { type, durationMinutes, caloriesBurned, source }
 */
async function getTodayWorkouts() {
  if (!Health || Platform.OS === 'web') return [];

  // Build start/end bounds for "today" in local time
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();

  try {
    const workouts = await Health.getWorkoutsAsync({
      startDate: startOfDay.toISOString(),
      endDate: now.toISOString(),
    });

    return workouts.map((w) => ({
      type: w.workoutActivityType || 'unknown',
      // Convert milliseconds to minutes, rounded to the nearest minute
      durationMinutes: Math.round((w.duration || 0) / 60),
      caloriesBurned: Math.round(w.totalEnergyBurned?.quantity || 0),
      source: w.sourceName || Platform.OS === 'ios' ? 'healthkit' : 'google_fit',
    }));
  } catch (err) {
    // Non-fatal: return empty array so the app still works without health data
    console.warn('[HealthKit] getTodayWorkouts failed:', err.message);
    return [];
  }
}

/**
 * Fetches step count, walking distance, and active minutes for today.
 *
 * @returns {Promise<{ steps, distanceKm, activeMinutes }>}
 */
async function getTodaySteps() {
  if (!Health || Platform.OS === 'web') {
    return { steps: 0, distanceKm: 0, activeMinutes: 0 };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();

  try {
    const [stepsData, distanceData] = await Promise.all([
      Health.getHealthDataAsync({
        type: Health.HealthDataType.STEPS,
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        unit: Health.HealthUnit.COUNT,
      }),
      Health.getHealthDataAsync({
        type: Health.HealthDataType.DISTANCE_WALKING_RUNNING,
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        unit: Health.HealthUnit.METER,
      }),
    ]);

    // Sum all samples returned for the day window
    const totalSteps = stepsData.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalMeters = distanceData.reduce((sum, s) => sum + (s.quantity || 0), 0);

    // Rough estimate: 1 active minute per 100 steps (very conservative)
    const activeMinutes = Math.round(totalSteps / 100);

    return {
      steps: Math.round(totalSteps),
      distanceKm: parseFloat((totalMeters / 1000).toFixed(2)),
      activeMinutes,
    };
  } catch (err) {
    console.warn('[HealthKit] getTodaySteps failed:', err.message);
    return { steps: 0, distanceKm: 0, activeMinutes: 0 };
  }
}

/**
 * Convenience function: requests permissions, collects all data for today,
 * and returns it in the shape expected by apiService.syncHealthData().
 *
 * @returns {Promise<{ workouts, steps, platform } | null>}
 *          null if permissions were denied or the platform is unsupported
 */
async function collectTodayData() {
  const granted = await requestPermissions();
  if (!granted) return null;

  // Fetch workouts and steps in parallel
  const [workouts, steps] = await Promise.all([
    getTodayWorkouts(),
    getTodaySteps(),
  ]);

  return {
    workouts,
    steps,
    platform: Platform.OS === 'ios' ? 'healthkit' : 'google_fit',
  };
}

export const healthKitService = {
  requestPermissions,
  getTodayWorkouts,
  getTodaySteps,
  collectTodayData,
};
