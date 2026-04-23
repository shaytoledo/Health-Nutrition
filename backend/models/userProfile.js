/**
 * models/userProfile.js — Firestore document schema for a user's profile
 *
 * This module provides factory functions (not Mongoose/ORM models — Firestore
 * is schema-less). Each function returns a plain object that is safe to write
 * directly to Firestore.
 *
 * Firestore path: users/{uid}/profile   (single document per user)
 */

/**
 * Creates a new user profile document.
 *
 * @param {string} uid           Firebase Auth UID
 * @param {object} data          Fields supplied during onboarding
 * @param {string} data.name     Display name
 * @param {number} data.age      Age in years
 * @param {number} data.weightKg Body weight in kilograms
 * @param {number} data.heightCm Height in centimetres
 * @param {string} data.activityLevel  One of: sedentary | light | moderate | active | very_active
 * @param {string} [data.gender] Optional: male | female | other
 * @returns {object} Firestore-ready profile document
 */
function createUserProfile(uid, data) {
  const validActivityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

  if (!validActivityLevels.includes(data.activityLevel)) {
    throw new Error(
      `Invalid activityLevel "${data.activityLevel}". Must be one of: ${validActivityLevels.join(', ')}`
    );
  }

  return {
    uid,
    name: data.name,
    age: Number(data.age),
    weightKg: Number(data.weightKg),
    heightCm: Number(data.heightCm),
    activityLevel: data.activityLevel,
    gender: data.gender || 'other',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns a partial update object with only modified fields plus an
 * updatedAt timestamp — safe for Firestore's update() (not set()).
 *
 * @param {object} changes   Any subset of profile fields
 * @returns {object}
 */
function updateUserProfile(changes) {
  const allowedFields = ['name', 'age', 'weightKg', 'heightCm', 'activityLevel', 'gender'];
  const update = { updatedAt: new Date().toISOString() };

  for (const field of allowedFields) {
    if (changes[field] !== undefined) {
      update[field] = changes[field];
    }
  }

  return update;
}

module.exports = { createUserProfile, updateUserProfile };
