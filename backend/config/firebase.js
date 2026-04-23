/**
 * config/firebase.js — Firebase Admin SDK initialization
 *
 * Exports a singleton admin app. Called once at startup so every
 * module that requires() this file shares the same initialized instance.
 *
 * Credentials are loaded from environment variables so they are never
 * committed to source control.
 */

const admin = require('firebase-admin');

// Guard against re-initializing if this module is hot-reloaded in development
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      // The private key is stored as a single-line string with escaped \n characters
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  console.log('[Firebase] Admin SDK initialized for project:', process.env.FIREBASE_PROJECT_ID);
}

// Convenience references used throughout the app
const db = admin.firestore();
const storage = admin.storage().bucket();
const auth = admin.auth();

module.exports = { admin, db, storage, auth };
