/**
 * context/AppContext.js — Global state (auth + meals + history)
 *
 * All data operations are async and route through dataService,
 * which auto-switches between Firestore (cloud) and localStorage (local).
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { signOut as authSignOut, restoreSession } from '../services/authService';
import { recordUserLogin } from '../services/adminService';
import { setGeminiUser } from '../services/geminiService';
import { FIREBASE_CONFIG, FIREBASE_ENABLED } from '../config/firebaseConfig';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getMeals,
  addMeal,
  deleteMeal,
  computeBalance,
  saveGoals,
  getProfile,
  saveProfile,
  getPastDaysSummaries,
  isCloudEnabled,
} from '../services/dataService';

const initialState = {
  currentUser: null,
  userProfile: null,
  balance:     null,
  meals:       [],
  pastDays:    [],      // last 7 days summaries for history chart
  isLoading:   false,
  authReady:   false,
  error:       null,
  cloudSync:   false,   // whether Firestore is active
};

const A = {
  SET_USER:     'SET_USER',
  SET_PROFILE:  'SET_PROFILE',
  SET_BALANCE:  'SET_BALANCE',
  SET_MEALS:    'SET_MEALS',
  SET_PAST:     'SET_PAST',
  ADD_MEAL:     'ADD_MEAL',
  REMOVE_MEAL:  'REMOVE_MEAL',
  SET_LOADING:  'SET_LOADING',
  SET_ERROR:    'SET_ERROR',
  CLEAR_ERROR:  'CLEAR_ERROR',
  AUTH_READY:   'AUTH_READY',
  SIGN_OUT:     'SIGN_OUT',
  SET_CLOUD:    'SET_CLOUD',
};

function reducer(state, action) {
  switch (action.type) {
    case A.SET_USER:    return { ...state, currentUser: action.payload };
    case A.SET_PROFILE: return { ...state, userProfile: action.payload };
    case A.SET_BALANCE: return { ...state, balance:     action.payload };
    case A.SET_MEALS:   return { ...state, meals:       action.payload };
    case A.SET_PAST:    return { ...state, pastDays:    action.payload };
    case A.ADD_MEAL:    return { ...state, meals: [action.payload, ...state.meals] };
    case A.REMOVE_MEAL: return { ...state, meals: state.meals.filter((m) => m.id !== action.payload) };
    case A.SET_LOADING: return { ...state, isLoading: action.payload };
    case A.SET_ERROR:   return { ...state, error: action.payload, isLoading: false };
    case A.CLEAR_ERROR: return { ...state, error: null };
    case A.AUTH_READY:  return { ...state, authReady: true };
    case A.SET_CLOUD:   return { ...state, cloudSync: action.payload };
    case A.SIGN_OUT:    return { ...initialState, authReady: true };
    default:            return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubRef = useRef(null);

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    dispatch({ type: A.SET_CLOUD, payload: isCloudEnabled() });

    // Safety timeout — if Firebase hangs for any reason, unblock the app
    // and fall back to the cached localStorage session.
    let authReady = false;
    const fallbackTimer = setTimeout(() => {
      if (!authReady) {
        const cached = restoreSession();
        if (cached) dispatch({ type: A.SET_USER, payload: cached });
        dispatch({ type: A.AUTH_READY });
      }
    }, 4000);

    const markReady = () => {
      authReady = true;
      clearTimeout(fallbackTimer);
    };

    if (FIREBASE_ENABLED) {
      // Firebase mode: onAuthStateChanged fires immediately with current user
      // (handles page refresh, tab reopen, cross-device)
      (async () => {
        try {
          if (!getApps().length) initializeApp(FIREBASE_CONFIG);
          const auth = getAuth();

          unsubRef.current = onAuthStateChanged(auth, async (firebaseUser) => {
            markReady();
            if (firebaseUser) {
              const session = {
                uid:      firebaseUser.uid,
                name:     firebaseUser.displayName || firebaseUser.email,
                email:    firebaseUser.email,
                provider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
              };
              try { localStorage.setItem('auth_session', JSON.stringify(session)); } catch {}
              dispatch({ type: A.SET_USER, payload: session });
              setGeminiUser(session);
              recordUserLogin(session); // non-blocking admin tracking
              try {
                const profile = await getProfile(firebaseUser.uid);
                if (profile) dispatch({ type: A.SET_PROFILE, payload: profile });
              } catch {}
            } else {
              try { localStorage.removeItem('auth_session'); } catch {}
            }
            dispatch({ type: A.AUTH_READY });
          });
        } catch {
          // Firebase failed to load — fall back to localStorage immediately
          markReady();
          const cached = restoreSession();
          if (cached) dispatch({ type: A.SET_USER, payload: cached });
          dispatch({ type: A.SET_CLOUD, payload: false });
          dispatch({ type: A.AUTH_READY });
        }
      })();
      return () => { clearTimeout(fallbackTimer); if (unsubRef.current) unsubRef.current(); };
    } else {
      // localStorage demo mode
      (async () => {
        markReady();
        const session = restoreSession();
        if (session) {
          dispatch({ type: A.SET_USER, payload: session });
          try {
            const profile = await getProfile(session.uid);
            if (profile) dispatch({ type: A.SET_PROFILE, payload: profile });
          } catch {}
        }
        dispatch({ type: A.AUTH_READY });
      })();
    }
  }, []);

  // ── Daily data + history ───────────────────────────────────────────────────
  const loadDailyData = useCallback(async (uid) => {
    if (!uid) return;
    const date = new Date().toISOString().split('T')[0];
    try {
      const [meals, balance] = await Promise.all([
        getMeals(uid, date),
        computeBalance(uid, date),
      ]);
      dispatch({ type: A.SET_MEALS,   payload: meals });
      dispatch({ type: A.SET_BALANCE, payload: balance });
    } catch (e) {
      dispatch({ type: A.SET_ERROR, payload: e.message });
    }
  }, []);

  const loadHistory = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const summaries = await getPastDaysSummaries(uid, 7);
      dispatch({ type: A.SET_PAST, payload: summaries });
    } catch {}
  }, []);

  const refreshBalance = useCallback(async (uid) => {
    if (!uid) return;
    const date    = new Date().toISOString().split('T')[0];
    const balance = await computeBalance(uid, date);
    dispatch({ type: A.SET_BALANCE, payload: balance });
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (session) => {
    dispatch({ type: A.SET_USER, payload: session });
    setGeminiUser(session);
    recordUserLogin(session); // non-blocking admin tracking
    try {
      const profile = await getProfile(session.uid);
      if (profile) dispatch({ type: A.SET_PROFILE, payload: profile });
    } catch {}
    await loadDailyData(session.uid);
    loadHistory(session.uid); // non-blocking
  }, [loadDailyData, loadHistory]);

  const signOut = useCallback(async () => {
    await authSignOut();
    dispatch({ type: A.SIGN_OUT });
  }, []);

  // ── Meals ──────────────────────────────────────────────────────────────────
  const logMeal = useCallback(async (uid, mealData) => {
    const date = new Date().toISOString().split('T')[0];
    try {
      const meal    = await addMeal(uid, date, mealData);
      const balance = await computeBalance(uid, date);
      dispatch({ type: A.ADD_MEAL,    payload: meal });
      dispatch({ type: A.SET_BALANCE, payload: balance });
      return meal;
    } catch (e) {
      dispatch({ type: A.SET_ERROR, payload: e.message });
    }
  }, []);

  const deleteMealFn = useCallback(async (uid, mealId) => {
    const date = new Date().toISOString().split('T')[0];
    try {
      await deleteMeal(uid, date, mealId);
      const balance = await computeBalance(uid, date);
      dispatch({ type: A.REMOVE_MEAL, payload: mealId });
      dispatch({ type: A.SET_BALANCE, payload: balance });
    } catch (e) {
      dispatch({ type: A.SET_ERROR, payload: e.message });
    }
  }, []);

  // ── Profile + Goals ────────────────────────────────────────────────────────
  const saveProfileFn = useCallback(async (profile) => {
    dispatch({ type: A.SET_PROFILE, payload: profile });
    const uid = state.currentUser?.uid;
    if (!uid) return;
    try {
      await saveProfile(uid, profile);
      const tdee = calcTDEE(profile);
      if (tdee) {
        const goals = {
          targetCalories: Math.round(tdee),
          targetProteinG: Math.round((tdee * 0.25) / 4),
          targetCarbsG:   Math.round((tdee * 0.45) / 4),
          targetFatG:     Math.round((tdee * 0.30) / 9),
        };
        await saveGoals(uid, goals);
        await refreshBalance(uid);
      }
    } catch (e) {
      dispatch({ type: A.SET_ERROR, payload: e.message });
    }
  }, [state.currentUser, refreshBalance]);

  const clearError = useCallback(() => dispatch({ type: A.CLEAR_ERROR }), []);

  return (
    <AppContext.Provider value={{
      ...state,
      signIn,
      signOut,
      saveProfile:  saveProfileFn,
      loadDailyData,
      loadHistory,
      logMeal,
      deleteMeal:   deleteMealFn,
      clearError,
      refreshBalance,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

// ── Harris-Benedict BMR → TDEE → goal calories ────────────────────────────────
const MULTIPLIERS = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

const GOAL_DELTAS = {
  lose_fast: -1000,
  lose:       -500,
  lose_slow:  -250,
  maintain:      0,
  gain:        +250,
};

function calcTDEE({ weightKg, heightCm, age, gender, activityLevel, weightGoal }) {
  if (!weightKg || !heightCm || !age) return null;
  const bmr = gender === 'female'
    ? 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age)
    : 88.362  + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
  const tdee    = bmr * (MULTIPLIERS[activityLevel] || 1.55);
  const delta   = GOAL_DELTAS[weightGoal] ?? 0;
  const minKcal = gender === 'female' ? 1200 : 1500;
  return Math.max(tdee + delta, minKcal);
}
