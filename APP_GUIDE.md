# 📱 Complete Guide to the HealthTracker App

> An AI-powered nutrition and fitness management app — a guide for users and developers

---

## Table of Contents

1. [What the app does](#1-what-the-app-does)
2. [Installation requirements](#2-installation-requirements)
3. [Running the app](#3-running-the-app)
4. [App screens](#4-app-screens)
5. [System architecture](#5-system-architecture)
6. [Database structure](#6-database-structure)
7. [Server API](#7-server-api)
8. [Data flow](#8-data-flow)
9. [Required API keys](#9-required-api-keys)
10. [FAQ](#10-faq)

---

## 1. What the app does

HealthTracker is a nutrition and fitness management app that uses artificial intelligence for food recognition. It lets you:

- **📷 Automatic food recognition** — snap a photo of your plate and the AI will identify the food and calculate calories and nutritional values
- **🎯 Goal setting** — enter your physical details (height, weight, age, gender) and get a personalized daily intake recommendation
- **⌚ Hardware sync** — connects to Apple HealthKit (iOS) and Google Fit (Android) to import workout data
- **📊 Live dashboard** — track in real time how many calories, protein, carbs, and fat you've consumed toward your target

---

## 2. Installation requirements

### Software requirements

| Component | Minimum version |
|------|---------------|
| Node.js | 18+ |
| npm | 9+ |
| Expo CLI | 50+ |
| iOS (for testing) | 15+ |
| Android (for testing) | 10+ |

### Required external keys

1. **Google Gemini API Key** — for food recognition from images
2. **Firebase Project** — for data storage and user authentication
3. **Firebase Storage** — for storing meal images

---

## 3. Running the app

### Step 1 — Start the server (Backend)

```bash
# 1. Go to the server directory
cd backend

# 2. Install packages
npm install

# 3. Create a .env file (copy from the example)
copy .env.example .env

# 4. Edit .env and insert your keys
# GEMINI_API_KEY=...
# FIREBASE_PROJECT_ID=...
# FIREBASE_PRIVATE_KEY=...
# FIREBASE_CLIENT_EMAIL=...

# 5. Start the server
node server.js
# The server runs on: http://localhost:3000
```

### Step 2 — Start the app (Frontend)

```bash
# 1. Go to the frontend directory
cd frontend

# 2. Install packages
npm install

# 3. Run it
npx expo start

# For web (browser):
npx expo start --web

# For Android:
npx expo start --android

# For iPhone:
npx expo start --ios
```

### Configuring the server address

In `frontend/src/services/apiService.js`, change `BASE_URL`:

```javascript
// For the Android simulator:
const BASE_URL = 'http://10.0.2.2:3000/api';

// For the iOS simulator:
const BASE_URL = 'http://localhost:3000/api';

// For a physical device (replace with your computer's IP):
const BASE_URL = 'http://192.168.1.XXX:3000/api';
```

---

## 4. App screens

### 🏠 Dashboard (first tab)

The main screen, showing all the relevant information for today:

**What you'll see:**
- **Large calorie ring** — shows how many calories you've eaten out of the daily target. The color changes:
  - 🟢 Green (0–70%) — great, there's still room
  - 🟡 Yellow (70–90%) — close to the target
  - 🔴 Red (90%+) — you've reached or exceeded the target

- **Three progress bars** — show progress for protein / carbs / fat

- **"Sync health data" button** — pulls workouts and steps from HealthKit/Google Fit and calculates calories burned

- **Today's meals list** — every logged meal is displayed with a thumbnail, name, calories, and macros. You can delete a meal by tapping ✕

**Available actions:**
- Pull down (Pull to Refresh) — refreshes the data from the server
- Tap ✕ next to a meal — asks for confirmation before deleting

---

### 📷 Scan (second tab)

Screen for adding a new meal. There are three ways to add one:

#### Option 1: Take a photo (recommended)
1. Tap **"📷 Take photo now"**
2. The app will request camera permission (first time only)
3. The device camera opens with a green aiming frame
4. Press the large white shutter button
5. The AI will analyze the image (5–15 seconds)
6. A nutritional estimate will be shown: food name, calories, protein, carbs, fat
7. Tap **"✓ Add to log"** to confirm — a success message appears

#### Option 2: Pick from the gallery
1. Tap **"🖼 Pick from gallery"**
2. Choose an existing image from the device
3. Continue as in option 1 from step 5

#### Option 3: Manual entry
1. Tap **"✏ Manual entry"**
2. Fill out the form:
   - **Food name** (required) — for example: "Grilled chicken breast"
   - **Calories** — in kilocalories (kcal)
   - **Protein** — in grams
   - **Carbs** — in grams
   - **Fat** — in grams
3. Tap **"Add to log"** — a success message appears

**Tips for a successful photo:**
- Shoot from directly above, not at an angle
- Make sure the lighting is good
- The whole plate should be in frame
- Try to avoid a busy background

---

### 🎯 Goals (third tab)

Screen for setting daily calorie and macro targets. There are two methods:

#### Method 1: Automatic calculation (recommended)
Answer 4 questions and get a personalized target:

| Question | Explanation |
|------|-------|
| **Weight** | Your current weight in kg |
| **Height** | Your height in cm |
| **Age** | Your age in years |
| **Gender** | Male / female / other |
| **Activity level** | Choose from 5 options (see table below) |

**Activity levels:**

| Level | Explanation | Multiplier |
|-----|-------|--------|
| Sedentary | Office work, no physical activity | ×1.2 |
| Light | 1–3 light workouts per week | ×1.375 |
| Moderate | 3–5 workouts per week | ×1.55 |
| Active | 6–7 intense workouts per week | ×1.725 |
| Very active | Physical labor + twice-daily training | ×1.9 |

After tapping **"⚡ Calculate my goal"** the following is shown:
- BMR (basal metabolic rate) — calories your body burns at rest
- TDEE (total daily energy expenditure) — BMR × activity multiplier
- Daily calorie target
- Macro split: 25% protein / 45% carbs / 30% fat

**Formula used:**
- Men: `88.362 + (13.397 × weight) + (4.799 × height) − (5.677 × age)`
- Women: `447.593 + (9.247 × weight) + (3.098 × height) − (4.330 × age)`

#### Method 2: Manual entry
Tap the **"✏ Manual entry"** tab and enter directly:
- Calorie target (required, minimum 500 kcal)
- Protein target in grams
- Carb target in grams
- Fat target in grams

---

### 👤 Profile (fourth tab)

Save personal details that will be used for future nutrition calculations.

**Form fields:**
- Full name
- Age
- Weight (kg)
- Height (cm)
- Gender
- Activity level

Tapping **"Save profile"** saves the details and shows a confirmation message.

---

## 5. System architecture

```
┌─────────────────────────────────────┐
│          Mobile device              │
│  ┌─────────────────────────────┐   │
│  │   React Native (Expo)       │   │
│  │   ┌────────────────────┐   │   │
│  │   │  AppContext        │   │   │
│  │   │  (Global State)    │   │   │
│  │   └────────┬───────────┘   │   │
│  │            │                │   │
│  │   ┌────────▼───────────┐   │   │
│  │   │  apiService.js     │   │   │
│  │   │  (HTTP Client)     │   │   │
│  │   └────────┬───────────┘   │   │
│  └────────────│───────────────┘   │
└───────────────│─────────────────────┘
                │ REST API
                ▼
┌─────────────────────────────────────┐
│         Node.js/Express server      │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ /food    │  │ Gemini Vision AI │ │
│  │ /goals   │  │ (food recognition)│ │
│  │ /health  │  └──────────────────┘ │
│  └────┬─────┘                       │
└───────│─────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│         Firebase Firestore          │
│  users/{uid}/                       │
│  ├── profile/                       │
│  ├── goals/{date}                   │
│  ├── dailyLogs/{date}/meals/        │
│  └── healthLogs/{date}              │
└─────────────────────────────────────┘
```

### Main modules

| File | Role |
|------|--------|
| `backend/server.js` | Entry point, middleware |
| `backend/services/geminiVisionService.js` | Sends to Gemini Vision, parses JSON |
| `backend/services/calorieCalculator.js` | BMR/TDEE/macro calculations |
| `backend/routes/food.js` | Endpoints for managing meals |
| `backend/routes/goals.js` | Endpoints for managing goals |
| `frontend/src/context/AppContext.js` | Global state (React Context) |
| `frontend/src/services/apiService.js` | Central HTTP client |
| `frontend/src/services/healthKitService.js` | HealthKit/Google Fit interface |

---

## 6. Database structure

### User profile
**Path:** `users/{uid}/profile/data`

```json
{
  "uid": "abc123",
  "name": "ישראל ישראלי",
  "age": 30,
  "weightKg": 75,
  "heightCm": 178,
  "gender": "male",
  "activityLevel": "moderate",
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

### Daily goal
**Path:** `users/{uid}/goals/{YYYY-MM-DD}`

```json
{
  "uid": "abc123",
  "date": "2024-01-15",
  "targetCalories": 2200,
  "targetProteinG": 138,
  "targetCarbsG": 248,
  "targetFatG": 73,
  "bmr": 1812,
  "tdee": 2810,
  "generatedFrom": "quiz_bmr"
}
```

### Single meal
**Path:** `users/{uid}/dailyLogs/{date}/meals/{mealId}`

```json
{
  "id": "uuid-v4",
  "uid": "abc123",
  "date": "2024-01-15",
  "timestamp": "2024-01-15T13:30:00.000Z",
  "description": "חזה עוף בגריל עם אורז",
  "imageUrl": "https://storage.googleapis.com/...",
  "calories": 420,
  "proteinG": 45,
  "carbsG": 38,
  "fatG": 8,
  "source": "ai_scan"
}
```

**The `source` field can be:**
- `ai_scan` — identified by Gemini Vision from an image
- `manual` — entered manually by the user
- `health_sync` — imported from HealthKit/Google Fit

### Daily summary
**Path:** `users/{uid}/dailyLogs/{date}`

```json
{
  "totalCalories": 1650,
  "totalProteinG": 120,
  "totalCarbsG": 190,
  "totalFatG": 55,
  "mealCount": 4,
  "activeCaloriesBurned": 350,
  "activeMinutes": 45
}
```

---

## 7. Server API

**Base URL:** `http://localhost:3000/api`

### Meal management

| Method | Path | Description |
|--------|------|--------|
| POST | `/food/scan` | Scan a food image with AI |
| POST | `/food/manual` | Add a meal manually |
| GET | `/food/log/:uid/:date` | Fetch meals for a date |
| DELETE | `/food/meal/:uid/:date/:mealId` | Delete a meal |

### Goal management

| Method | Path | Description |
|--------|------|--------|
| GET | `/goals/:uid` | Fetch the daily goal |
| POST | `/goals/:uid` | Set a manual goal |
| GET | `/goals/:uid/balance` | Calorie and macro balance |
| POST | `/goals/:uid/from-quiz` | Calculate goal from body details |
| POST | `/goals/:uid/auto` | Calculate goal from saved profile |

### Health sync

| Method | Path | Description |
|--------|------|--------|
| POST | `/health/sync` | Receive workout data |
| GET | `/health/summary/:uid/:date` | Daily activity summary |

---

## 8. Data flow

### Food scan flow

```
User taps "Take photo"
        ↓
expo-camera opens the camera
        ↓
User takes a photo
        ↓
base64 is sent to the server (POST /food/scan)
        ↓
The server sends it to the Gemini Vision API
        ↓
Gemini returns JSON with nutritional values
        ↓
The server saves to Firestore + uploads the image to Storage
        ↓
AppContext updates the global state
        ↓
DashboardScreen renders the new meal + success message
```

### Goal calculation flow from the quiz

```
User fills in: height + weight + age + gender + activity
        ↓
POST /api/goals/:uid/from-quiz
        ↓
calorieCalculator.calculateBMR()
        ↓
calorieCalculator.calculateTDEE()  (BMR × activity multiplier)
        ↓
calorieCalculator.calculateMacroTargets()
  (25% protein, 45% carbs, 30% fat)
        ↓
Save the goal to Firestore
        ↓
AppContext.loadDailyData() — refreshes the dashboard
```

### HealthKit sync flow

```
User taps "Sync health data"
        ↓
healthKitService.requestPermissions()
        ↓
healthKitService.getTodayWorkouts() + getTodaySteps()
        ↓
apiService.syncHealthData() → POST /health/sync
        ↓
The server calculates total calories burned
        ↓
Updates dailyLogs/{date}.activeCaloriesBurned
        ↓
The dashboard shows "net calories" (consumed − burned)
```

---

## 9. Required API keys

### Google Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click "Get API Key"
3. Create a new project
4. Copy the key into the `GEMINI_API_KEY` field in `.env`

**Model used:** `gemini-1.5-flash` (fast and inexpensive)
**Estimated cost:** ~$0.0001 per image

### Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Firestore Database** (Production mode)
4. Enable **Storage**
5. Go to Project Settings → Service Accounts
6. Click "Generate new private key"
7. Copy the details into the matching fields in `.env`

---

## 10. FAQ

**Q: The AI identified the food incorrectly, what do I do?**
A: Tap "Cancel" and choose "Manual entry" to enter the correct values. For a better photo — make sure the lighting is good and shoot from directly above.

**Q: Sync with Apple Watch isn't working?**
A: Make sure you granted the app health permission at: Settings → Privacy & Security → Health → HealthTracker.

**Q: Calories don't update after I add a meal?**
A: Pull down on the dashboard (Pull to Refresh) to refresh the data from the server.

**Q: How do I reset all the data?**
A: Delete the user's Firestore documents via the Firebase Console.

**Q: The app is running in a browser (Web) — why doesn't the camera work?**
A: Direct access to the device camera requires running on an actual device or simulator. Browser support is limited.

---

*Version 1.0 | Created with Claude AI*
