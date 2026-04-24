/**
 * config/firebaseConfig.js
 *
 * Replace the placeholder values with your Firebase project's web config.
 * Found at: Firebase Console → Project Settings → Your apps → Web app → Config
 *
 * Once you fill in real values, Firestore cloud sync activates automatically
 * on the next app load — no other changes required.
 *
 * Steps to get the config:
 *   1. https://console.firebase.google.com → New Project
 *   2. Add a Web app (+)
 *   3. Build → Firestore Database → Create (start in production mode)
 *   4. Authentication → Sign-in methods → enable Email/Password + Google
 *   5. Copy the firebaseConfig object here
 *
 * Firestore security rules (paste in Firebase Console → Firestore → Rules):
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 */

export const FIREBASE_CONFIG = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

/**
 * Auto-detected: true when real Firebase credentials are present.
 * Do NOT set this manually — just fill in the config object above.
 */
export const FIREBASE_ENABLED =
  FIREBASE_CONFIG.apiKey    !== 'YOUR_API_KEY' &&
  FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID';
