# AI Health & Nutrition

A web-first nutrition tracker with AI food recognition. Snap a photo (or type food + grams) and Gemini estimates calories and macros. Built with React Native + Expo, deployed to Vercel. Fully client-side — no backend, all data lives in the user's browser.

**🌐 Live app:** https://ai-health-nutrition.vercel.app

---

## Features

- 📷 **Photo scanning** — take or upload a food photo, Gemini 2.5 Flash estimates nutrition
- ⚖️ **Add by name + weight** — e.g. *"hamburger 200g"* → AI calculates macros
- ✏️ **Manual entry** — type your own values
- 🔐 **Sign in with Google** (OAuth) or email/password (Firebase Auth)
- 🎯 **Daily goals** — calorie ring + protein/carbs/fat progress bars
- 📊 **Harris-Benedict BMR → TDEE** with weight-goal adjustment (lose fast / lose / maintain / gain)
- 🌓 **Dark / light theme** toggle on every screen
- 🇮🇱 **Hebrew RTL** interface

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React Native 0.73 + Expo SDK 50 (web via `react-native-web`) |
| Navigation | `@react-navigation/bottom-tabs` |
| State | React Context + `useReducer` |
| Auth | `@react-oauth/google` (Google) + Firebase Auth (email/password) |
| AI | `@google/generative-ai` (Gemini 2.5 Flash + fallback chain) |
| Camera | `expo-camera` (native) + browser `getUserMedia` (web) |
| Storage | `window.localStorage` — no server, no database |
| Hosting | Vercel |

---

## Project Structure

```
HealthNutritionApp/
├── frontend/                   ← the app
│   ├── App.js                  Root: providers + tab navigator
│   ├── app.json                Expo config
│   ├── vercel.json             SPA rewrite rule
│   ├── PROJECT_GUIDE.md        Full developer reference (file-by-file)
│   └── src/
│       ├── components/         Reusable UI (CalorieRing, MealItem, ThemeToggle, …)
│       ├── config/             API keys + Firebase config
│       ├── context/            AppContext, ThemeContext
│       ├── screens/            Auth, Dashboard, FoodScan, Goals, Profile
│       ├── services/           geminiService, authService, localDataService, …
│       └── utils/              Pure helpers
├── backend/                    (legacy, unused — app is fully client-side)
└── firebase/                   (legacy Cloud Functions, unused)
```

For an exhaustive file-by-file reference (every function, every service), see [frontend/PROJECT_GUIDE.md](frontend/PROJECT_GUIDE.md).

---

## Getting Started

### ⚠️ Missing configuration file

The file **`frontend/src/config/appConfig.js`** is **not committed to this repository** because it holds private API keys (Gemini API key + Google OAuth Client ID). You must create it yourself before the app will run.

Copy the template and fill in your own keys:

```bash
cp frontend/src/config/appConfig.example.js frontend/src/config/appConfig.js
```

Then edit `appConfig.js`:

```js
export const GEMINI_API_KEY   = 'your-gemini-key-here';
export const GOOGLE_CLIENT_ID = 'your-google-oauth-client-id-here';
```

**Where to get the keys:**

| Key | Source |
|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey — create a key under "Free tier" |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application). Add `http://localhost:8081` and your production URL to **Authorized JavaScript origins**. |

### Install and run locally

```bash
cd frontend
npm install
npm run web        # → http://localhost:8081
```

### Deploy to Vercel

```bash
cd frontend
npx expo export --platform web
npx vercel deploy --prod
```

---

## How it Works (at a glance)

1. User signs in (Google OAuth or email/password).
2. Session saved in `localStorage`. Identity = `google_<sub>` or `email_<uid>`.
3. User captures food via camera / gallery / name+weight / manual form.
4. For image/name paths, the browser calls **Gemini directly** with the image or text prompt. Gemini returns `{ description, calories, proteinG, carbsG, fatG }`.
5. Meal is written to `localStorage` keyed by `uid + date`.
6. Dashboard reads today's meals and computes consumed vs. target (calorie ring + macro bars).

No backend is involved. Everything runs in the browser.

---

## Documentation

- [frontend/PROJECT_GUIDE.md](frontend/PROJECT_GUIDE.md) — exhaustive dev guide: directory layout, every file's purpose, every function, setup checklist, Vercel dashboard tour, common tasks.

---

## Known Limitations

- **No Apple Watch support** (would require native watchOS Swift target).
- **No App Store / Play Store publishing** (possible via `eas build`, not done).
- **HealthKit / Google Fit sync button** is mobile-only — does nothing on web.
- **No cross-device sync** — data lives per-browser; signing in on another browser shows empty state.

---

## License

Personal / educational project. Not licensed for redistribution.
