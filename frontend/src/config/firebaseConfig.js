/**
 * config/firebaseConfig.js
 *
 * Firebase project: health-and-nutrition-ad98c
 *
 * Cloud sync activates automatically when these values are filled in.
 * FIREBASE_ENABLED is auto-detected — do not set it manually.
 *
 * Firestore security rules (Firebase Console → Firestore → Rules):
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 *
 * Required Firebase Console setup:
 *   - Authentication → Google → Enable
 *   - Authentication → Email/Password → Enable
 *   - Authentication → Settings → Authorized domains → add ai-health-nutrition.vercel.app
 *   - Firestore Database → Create (production mode)
 */

export const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCyGAcC7MCTWYJ7q8Ue0a6uTpeka6rupZ0',
  authDomain:        'health-and-nutrition-ad98c.firebaseapp.com',
  projectId:         'health-and-nutrition-ad98c',
  storageBucket:     'health-and-nutrition-ad98c.firebasestorage.app',
  messagingSenderId: '692185198341',
  appId:             '1:692185198341:web:1f9c690144413fde95d16c',
  measurementId:     'G-ND9YP0S32V',
};

/** Auto-detected: true when real Firebase credentials are present. */
export const FIREBASE_ENABLED =
  FIREBASE_CONFIG.apiKey    !== 'YOUR_API_KEY' &&
  FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID';
