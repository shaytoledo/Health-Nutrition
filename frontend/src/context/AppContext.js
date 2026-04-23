/**
 * context/AppContext.js — Global state (auth + meals, fully client-side)
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  signOut as authSignOut,
  restoreSession,
  saveProfileToStorage,
  loadProfileFromStorage,
} from '../services/authService';
import {
  getMealsLocal,
  addMealLocal,
  deleteMealLocal,
  computeBalanceLocal,
  saveGoalsLocal,
  getGoalsLocal,
} from '../services/localDataService';

const initialState = {
  currentUser: null,
  userProfile: null,
  balance:     null,
  meals:       [],
  isLoading:   false,
  authReady:   false,
  error:       null,
};

const A = {
  SET_USER:     'SET_USER',
  SET_PROFILE:  'SET_PROFILE',
  SET_BALANCE:  'SET_BALANCE',
  SET_MEALS:    'SET_MEALS',
  ADD_MEAL:     'ADD_MEAL',
  REMOVE_MEAL:  'REMOVE_MEAL',
  SET_LOADING:  'SET_LOADING',
  SET_ERROR:    'SET_ERROR',
  CLEAR_ERROR:  'CLEAR_ERROR',
  AUTH_READY:   'AUTH_READY',
  SIGN_OUT:     'SIGN_OUT',
};

function reducer(state, action) {
  switch (action.type) {
    case A.SET_USER:    return { ...state, currentUser: action.payload };
    case A.SET_PROFILE: return { ...state, userProfile: action.payload };
    case A.SET_BALANCE: return { ...state, balance: action.payload };
    case A.SET_MEALS:   return { ...state, meals: action.payload };
    case A.ADD_MEAL:    return { ...state, meals: [action.payload, ...state.meals] };
    case A.REMOVE_MEAL: return { ...state, meals: state.meals.filter((m) => m.id !== action.payload) };
    case A.SET_LOADING: return { ...state, isLoading: action.payload };
    case A.SET_ERROR:   return { ...state, error: action.payload, isLoading: false };
    case A.CLEAR_ERROR: return { ...state, error: null };
    case A.AUTH_READY:  return { ...state, authReady: true };
    case A.SIGN_OUT:    return { ...initialState, authReady: true };
    default:            return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restore session on mount
  useEffect(() => {
    const session = restoreSession();
    if (session) {
      dispatch({ type: A.SET_USER, payload: session });
      const profile = loadProfileFromStorage(session.uid);
      if (profile) dispatch({ type: A.SET_PROFILE, payload: profile });
    }
    dispatch({ type: A.AUTH_READY });
  }, []);

  const loadDailyData = useCallback((uid) => {
    if (!uid) return;
    const date    = new Date().toISOString().split('T')[0];
    const meals   = getMealsLocal(uid, date);
    const balance = computeBalanceLocal(uid, date);
    dispatch({ type: A.SET_MEALS,   payload: meals });
    dispatch({ type: A.SET_BALANCE, payload: balance });
  }, []);

  // Re-load after profile or goals change so balance reflects new targets
  const refreshBalance = useCallback((uid) => {
    if (!uid) return;
    const date    = new Date().toISOString().split('T')[0];
    const balance = computeBalanceLocal(uid, date);
    dispatch({ type: A.SET_BALANCE, payload: balance });
  }, []);

  const signIn = useCallback((session) => {
    dispatch({ type: A.SET_USER, payload: session });
    const profile = loadProfileFromStorage(session.uid);
    if (profile) dispatch({ type: A.SET_PROFILE, payload: profile });
    loadDailyData(session.uid);
  }, [loadDailyData]);

  const signOut = useCallback(async () => {
    await authSignOut();
    dispatch({ type: A.SIGN_OUT });
  }, []);

  const logMeal = useCallback((uid, mealData) => {
    const date = new Date().toISOString().split('T')[0];
    const meal = addMealLocal(uid, date, mealData);
    dispatch({ type: A.ADD_MEAL, payload: meal });
    const balance = computeBalanceLocal(uid, date);
    dispatch({ type: A.SET_BALANCE, payload: balance });
    return meal;
  }, []);

  const deleteMeal = useCallback((uid, mealId) => {
    const date = new Date().toISOString().split('T')[0];
    deleteMealLocal(uid, date, mealId);
    dispatch({ type: A.REMOVE_MEAL, payload: mealId });
    const balance = computeBalanceLocal(uid, date);
    dispatch({ type: A.SET_BALANCE, payload: balance });
  }, []);

  const saveProfile = useCallback((profile) => {
    dispatch({ type: A.SET_PROFILE, payload: profile });
    if (state.currentUser?.uid) {
      saveProfileToStorage(state.currentUser.uid, profile);
      // Recalculate goals from new profile
      const tdee = calcTDEE(profile);
      if (tdee) {
        const goals = {
          targetCalories: Math.round(tdee),
          targetProteinG: Math.round((tdee * 0.25) / 4),
          targetCarbsG:   Math.round((tdee * 0.45) / 4),
          targetFatG:     Math.round((tdee * 0.30) / 9),
        };
        saveGoalsLocal(state.currentUser.uid, goals);
        refreshBalance(state.currentUser.uid);
      }
    }
  }, [state.currentUser, refreshBalance]);

  const clearError = useCallback(() => dispatch({ type: A.CLEAR_ERROR }), []);

  return (
    <AppContext.Provider value={{
      ...state,
      signIn,
      signOut,
      saveProfile,
      loadDailyData,
      logMeal,
      deleteMeal,
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

// ── Harris-Benedict BMR → TDEE → goal calories ───────────────────────────────
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
  const tdee  = bmr * (MULTIPLIERS[activityLevel] || 1.55);
  const delta = GOAL_DELTAS[weightGoal] ?? 0;
  const minKcal = gender === 'female' ? 1200 : 1500;
  return Math.max(tdee + delta, minKcal);
}
