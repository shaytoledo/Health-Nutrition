/**
 * config/firebaseConfig.js
 *
 * Replace the values below with your Firebase project's web config.
 * Found at: Firebase Console → Project Settings → Your apps → Web app → Config
 *
 * If you haven't created a Firebase project yet:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project
 * 3. Add a Web app (+)
 * 4. Enable Authentication → Sign-in methods → Email/Password AND Google
 * 5. Copy the config object here
 */

export const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// Set to true once you've filled in the config above
export const FIREBASE_ENABLED = false;
