# AI Health & Nutrition — Project Guide

A web-first (PWA) nutrition tracker built with React Native + Expo, deployed to Vercel. Users scan food photos (or type food name + weight) and Gemini 2.5 Flash returns calorie and macro estimates. All data is stored in the browser (localStorage) — no backend server required.

---

## 1. Quick Facts

| Item | Value |
|---|---|
| Framework | React Native 0.73 + Expo SDK 50 (web export) |
| Hosting | Vercel (production) |
| Production URL | https://ai-health-nutrition.vercel.app |
| Vercel project name | `ai-health-nutrition` (team `shaytoledos-projects`) |
| Vercel dashboard | https://vercel.com/shaytoledos-projects/ai-health-nutrition |
| AI vision | Google Gemini 2.5 Flash (with automatic fallback models) |
| Auth | Google OAuth (`@react-oauth/google`) + email/password (Firebase) |
| Data storage | Browser `localStorage` — no database, no backend |
| Language / layout | Hebrew, RTL (`I18nManager.forceRTL(true)`) |
| Platforms supported | Web (desktop + mobile browsers). iOS/Android source builds are possible via Expo but not published. |

---

## 2. Directory Layout

```
HealthNutritionApp/
├── backend/                    (unused — legacy; app is fully client-side)
├── firebase/                   (legacy Firebase functions — unused)
├── frontend/                   ← the actual app
│   ├── App.js                  App root: providers + tab navigator
│   ├── app.json                Expo config (name, icon, bundle ids)
│   ├── vercel.json             Vercel routing for the SPA
│   ├── package.json            Dependencies + scripts
│   ├── dist/                   Web export output (deployed by Vercel)
│   └── src/
│       ├── components/         Reusable presentational components
│       ├── config/             API keys + Firebase config
│       ├── context/            Global app state (React Context)
│       ├── screens/            Top-level route screens
│       ├── services/           External integrations + data layer
│       └── utils/              Pure helper functions
└── README.md                   (top-level; superseded by this file)
```

---

## 3. File-by-File Reference

### `App.js`
Application entry. Wraps the tree in `GoogleOAuthProvider` (web only, lazy-loaded) + `SafeAreaProvider` + `AppProvider`. If no `currentUser`, renders `AuthScreen`; otherwise renders the bottom-tab navigator with four tabs: Dashboard, Scan, Goals, Profile.

### `app.json`
Expo manifest — app name, slug, icon, splash, bundle identifiers (`ios.bundleIdentifier`, `android.package`), permissions (camera, media library), and web favicon.

### `vercel.json`
Single rewrite rule `/(.*) → /index.html` so client-side React Navigation routes work after a page refresh.

---

### `src/config/`

**`appConfig.js`** — exports the two user-supplied keys:
- `GEMINI_API_KEY` — created at https://aistudio.google.com/app/apikey (Free tier)
- `GOOGLE_CLIENT_ID` — Web OAuth client from Google Cloud Console → APIs & Services → Credentials

**`firebaseConfig.js`** — Firebase web config (used for email/password auth only; Firestore is **not** used).

---

### `src/context/AppContext.js`
Global state via `useReducer`. Exposes everything the screens need.

| Function | What it does |
|---|---|
| `AppProvider` | React component that wraps the app with context + restores saved session on mount |
| `useApp()` | Hook that returns the full context value (state + actions) |
| `signIn(session)` | Stores user session, loads profile + today's meals |
| `signOut()` | Calls `authService.signOut()`, resets state |
| `saveProfile(profile)` | Saves profile to localStorage + recalculates calorie goals from Harris-Benedict BMR × activity × weight-goal delta |
| `loadDailyData(uid)` | Loads today's meals + computed balance into state |
| `refreshBalance(uid)` | Recomputes today's balance (consumed vs. targets) |
| `logMeal(uid, meal)` | Adds meal via `localDataService`, updates state |
| `deleteMeal(uid, id)` | Removes meal, refreshes balance |
| `clearError()` | Dismisses error state |
| `calcTDEE(profile)` | (Internal) BMR → TDEE → applies goal delta (`lose_fast` −1000 … `gain` +250), enforces minimum kcal floor (1200 women / 1500 men) |

State shape: `{ currentUser, userProfile, balance, meals, isLoading, authReady, error }`.

---

### `src/screens/`

**`AuthScreen.js`** — Sign-in / sign-up screen.
- Tab switcher: Sign-up / Sign-in
- Email + password form with show/hide password toggle (👁/🙈)
- "Continue with Google" button (uses `useGoogleLogin` on web, falls back on native)
- `handleSubmit()` — validates, calls `registerWithEmail` or `signInWithEmail` from authService
- Google OAuth flow: gets access token → fetches userinfo → creates session `{ uid: 'google_<sub>', name, email, provider: 'google' }`

**`DashboardScreen.js`** — Home tab. Shows:
- Calorie ring (consumed vs. target)
- Macro progress bars (protein / carbs / fat)
- Sync button (iOS HealthKit / Android Google Fit — mobile-only, does nothing on web)
- Today's meal list with delete
- `handleSyncHealth()` — calls `healthKitService.collectTodayData()`. **Web: useless (no HealthKit API in browsers). Mobile only.**
- `handleDeleteMeal(meal)` — confirms + deletes via context
- Pull-to-refresh reloads daily data

**`FoodScanScreen.js`** — The meal-logging center. Three input paths:
1. **Camera** — `openCamera()` opens `WebCamera` overlay on web (getUserMedia), native `CameraView` on mobile. Photo → `handleImageSelected()` → Gemini vision.
2. **Gallery** — `openGallery()` opens file picker (web) or ImagePicker (native).
3. **By name + weight** — `BY_NAME` state; user types food name and grams, `handleByNameAnalyze()` calls `analyzeFoodByName()` for text-only estimate.
4. **Manual** — free-text form for users who know the numbers.

Other functions:
- `triggerFileInput(withCapture)` — creates a hidden `<input type="file">` on web
- `handleImageSelected(uri, source, mime)` — state machine: ANALYZING → RESULT or error
- `takePicture()` — native-only `cameraRef.current.takePictureAsync()`
- `handleConfirmLog()` — writes the AI result to storage via `logMeal()`
- `handleManualLog()` — writes typed form to storage

State machine (`SCAN_STATE`): `IDLE → CAMERA/BY_NAME/MANUAL → ANALYZING → RESULT → IDLE`.

**`GoalsScreen.js`** — Manual goal override screen. Lets the user set custom calorie/protein/carbs/fat targets or re-trigger auto-calc from the profile.

**`ProfileScreen.js`** — User profile form (age, height, weight, gender, activity level, weight goal). On save:
- Recalculates TDEE + macro targets
- Persists to localStorage via `saveProfileToStorage`
- View mode shows a card with the weight-goal delta (e.g., "-500 kcal/day from TDEE")
- Platform-aware logout: `window.confirm` on web, `Alert.alert` on native

---

### `src/services/`

**`geminiService.js`** — Direct-from-browser calls to Google's Gemini API.
- `toBase64(source, mimeType)` — converts a File / blob-URL to base64 for inline API payload
- `analyzeFood(imageSource, mimeType)` — sends image to Gemini vision; tries fallback models on 503/429: `gemini-2.5-flash → gemini-flash-latest → gemini-2.0-flash → gemini-2.5-flash-lite → gemini-flash-lite-latest`. Returns `{ description, calories, proteinG, carbsG, fatG, confidence }`. Throws `FOOD_NOT_RECOGNIZED` if unrecognizable.
- `analyzeFoodByName(foodName, grams)` — text-only variant. Same fallback chain. Returns the same shape.

**`authService.js`** — Authentication glue over Firebase Auth.
- `getFirebaseAuth()` — lazy Firebase init
- `registerWithEmail(name, email, password)` — creates Firebase user, returns session
- `signInWithEmail(email, password)` — Firebase email/password sign-in
- `signInWithGoogle()` — native Google sign-in (web path is handled directly in `AuthScreen` via `@react-oauth/google`)
- `signOut()` — Firebase signOut + clears localStorage session
- `restoreSession()` — reads saved session from localStorage on app start
- `saveProfileToStorage(uid, profile)` / `loadProfileFromStorage(uid)` — user-keyed profile persistence

**`localDataService.js`** — Pure localStorage CRUD (the "database").
- `getMealsLocal(uid, date)` — reads meals for a day
- `addMealLocal(uid, date, meal)` — appends meal with generated id + timestamp
- `deleteMealLocal(uid, date, mealId)` — removes by id
- `computeBalanceLocal(uid, date)` — totals meals and compares to goals → returns `{ consumed, targets, caloriesProgress, ... }`
- `getGoalsLocal(uid)` / `saveGoalsLocal(uid, goals)` — calorie + macro targets per user

Storage key pattern: `meals_<uid>_<YYYY-MM-DD>`, `goals_<uid>`, `profile_<uid>`, `session`.

**`apiService.js`** — **Legacy / unused.** Was the axios client for a separate Node backend. Kept in the repo for reference only. The app does not make HTTP calls to any server other than Gemini + Google OAuth.

**`healthKitService.js`** — iOS HealthKit / Android Google Fit wrapper (via `expo-health`). Mobile-only. On web it is inert. Functions: `requestPermissions`, `getTodayWorkouts`, `getTodaySteps`, `collectTodayData`.

---

### `src/components/`

**`CalorieRing.js`** — SVG circular progress indicator (consumed vs. target calories).

**`MacroProgressBar.js`** — Horizontal progress bar for a macro (label, consumed, target, unit, color, optional `showBar={false}` variant for result cards).

**`MealItem.js`** — One row in the meal list (thumbnail, name, calories + macros, source badge: `vision` / `manual` / `by_name` / `health_sync`, delete button).

**`WebCamera.js`** — Full-screen browser camera overlay using `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`. Renders `<video>` + capture button → writes to `<canvas>` → exports as blob → passes `{ uri, file, mimeType }` to `onCapture`. Cleans up the MediaStream tracks on unmount.

---

### `src/utils/calculations.js`
Pure helpers (macro totals, formatting). Context inlines most math, so this file is small.

---

## 4. How to Run Locally

```bash
cd frontend
npm install           # first time only
npm run web           # dev server with hot reload → http://localhost:8081
```

Press `w` to open in browser. Changes hot-reload automatically.

**Other targets** (not currently used):
```bash
npm run ios           # requires Mac + Xcode
npm run android       # requires Android Studio
```

---

## 5. How to Deploy a New Version

Deploy = export the web bundle, then push to Vercel production.

```bash
cd frontend
npx expo export --platform web            # writes dist/
npx vercel deploy --prod --yes            # uploads dist/ to Vercel
```

Vercel CLI prints the new URL. The stable URL `https://frontend-rho-eight-4g646ddhew.vercel.app` (and the latest deploy URL shown in the CLI output) both point to the current production build.

**First-time Vercel setup:** already done. The token is stored at `%APPDATA%\com.vercel.cli\Data\auth.json`.

---

## 6. Where to Monitor the App (Vercel Dashboard)

Dashboard: **https://vercel.com/shaytoledos-projects/ai-health-nutrition**

| Tab | What you see |
|---|---|
| **Overview** | Current production URL, latest deploys, basic uptime |
| **Deployments** | Every build ever made — click any to preview, rollback, or inspect logs |
| **Analytics** | Pageviews, visitors, top pages (free tier: limited) |
| **Logs** (Runtime / Build) | Build output + any server-side errors (SPA, so mostly just build logs) |
| **Speed Insights** | Core Web Vitals (TTFB, LCP, CLS) |
| **Settings → Domains** | Attach a custom domain |
| **Settings → Deployment Protection** | Public access toggle (currently **disabled** → site is public) |
| **Settings → Environment Variables** | Not used — keys live in `src/config/appConfig.js` |

**Google-side dashboards:**
- Gemini usage + quotas: https://aistudio.google.com/app/apikey
- OAuth + API usage: https://console.cloud.google.com/apis/dashboard
- OAuth consent screen / publish: https://console.cloud.google.com/apis/credentials/consent

**Firebase console (email/password auth only):**
- https://console.firebase.google.com/ → project → Authentication → Users

---

## 7. Configuration Checklist

For the app to work end-to-end, these must be true:

1. **`src/config/appConfig.js`** has real values for `GEMINI_API_KEY` and `GOOGLE_CLIENT_ID`.
2. **Google OAuth origins** include the current Vercel URL: Cloud Console → Credentials → OAuth 2.0 Client → Authorized JavaScript origins → add `https://<deploy>.vercel.app` and `http://localhost:8081`.
3. **OAuth consent screen** is "In production" (published) so non-test users can sign in with Google.
4. **Vercel Deployment Protection** is disabled (already done via API).
5. **Firebase email/password** provider is enabled in the Firebase console (Authentication → Sign-in method).

---

## 8. Data & Privacy

- All meals, goals, and profiles live in **the user's browser `localStorage`**. Nothing is sent to a database.
- Food photos go from the browser **directly to Google's Gemini API**. They are not stored anywhere by this app.
- Sign-out clears the session but keeps stored meals/profile (so re-signing in restores history).
- Clearing browser storage or switching browsers = fresh state.

---

## 9. Known Limitations

- **Apple Watch:** not supported. Would require a native watchOS target in Swift (out of scope).
- **iOS / Android native publishing:** technically possible via `eas build` ($99/yr Apple, $25 once Android), not done.
- **HealthKit sync button on the dashboard:** visible on web but does nothing there — mobile-only.
- **Cross-device sync:** none. A user logged in on two browsers will see separate data.
- **Gemini Free Tier limits:** occasional 429 quota / 503 overload. The fallback model chain mitigates but does not eliminate this.

---

## 10. Common Tasks

| Task | Command / Steps |
|---|---|
| Run locally | `npm run web` in `frontend/` |
| Deploy | `npx expo export --platform web && npx vercel deploy --prod --yes` |
| Add a new Vercel URL to Google OAuth | Cloud Console → Credentials → OAuth Client → Authorized origins |
| See all deploys | https://vercel.com/shaytoledos-projects/ai-health-nutrition/deployments |
| Rollback | Vercel dashboard → Deployments → pick older → "Promote to Production" |
| Change Gemini model | `src/services/geminiService.js` → `FALLBACK_MODELS` array |
| Change calorie formula | `src/context/AppContext.js` → `calcTDEE`, `MULTIPLIERS`, `GOAL_DELTAS` |
| Reset a user's local data | DevTools → Application → Local Storage → delete keys starting with `meals_` / `goals_` / `profile_` / `session` |

---

## 11. Tech Stack Summary

- **UI:** React Native Web (RN 0.73 on web via `react-native-web`)
- **Navigation:** `@react-navigation/bottom-tabs`
- **State:** React Context + `useReducer`
- **Auth:** Firebase Auth (email/password) + `@react-oauth/google` (web Google flow)
- **AI:** `@google/generative-ai` (Gemini 2.5 Flash + fallbacks)
- **Camera:** `expo-camera` (native) + browser `getUserMedia` (web)
- **Storage:** `window.localStorage` (web) / `expo-secure-store` available but unused
- **Charts/Icons:** `react-native-svg`
- **Build:** `expo export` → static site → Vercel
