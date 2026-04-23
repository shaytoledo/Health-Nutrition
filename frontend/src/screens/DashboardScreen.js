/**
 * screens/DashboardScreen.js — דשבורד ראשי
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { healthKitService } from '../services/healthKitService';
import MacroProgressBar from '../components/MacroProgressBar';
import MealItem from '../components/MealItem';
import CalorieRing from '../components/CalorieRing';
import ThemeToggle from '../components/ThemeToggle';

export default function DashboardScreen() {
  const { balance, meals, isLoading, loadDailyData, deleteMeal, clearError, error, currentUser } = useApp();
  const { colors: c, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const uid = currentUser?.uid;
  const [refreshing, setRefreshing] = useState(false);
  const [syncingHealth, setSyncingHealth] = useState(false);

  useEffect(() => {
    if (uid) loadDailyData(uid);
  }, [uid]);

  useEffect(() => {
    if (error) {
      Alert.alert('שגיאה', error, [{ text: 'אישור', onPress: clearError }]);
    }
  }, [error]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (uid) loadDailyData(uid);
    setRefreshing(false);
  };

  const handleSyncHealth = async () => {
    setSyncingHealth(true);
    try {
      const healthData = await healthKitService.collectTodayData();
      if (!healthData) {
        Alert.alert('גישה נדחתה', 'אנא אפשר גישה לנתוני בריאות בהגדרות המכשיר.');
        return;
      }
      Alert.alert('✅ סנכרון הושלם', `${healthData.workouts.length} אימונים`);
    } catch (err) {
      Alert.alert('כישלון בסנכרון', err.message);
    } finally {
      setSyncingHealth(false);
    }
  };

  const handleDeleteMeal = (meal) => {
    Alert.alert(
      'מחיקת ארוחה',
      `למחוק את "${meal.description}" מהיומן?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחיקה', style: 'destructive', onPress: () => deleteMeal(uid, meal.id) },
      ]
    );
  };

  const todayLabel = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.mint} />
        }
      >
        {/* כותרת + כפתור מצב */}
        <View style={styles.headerRow}>
          {/* toggle — left side (RTL) */}
          <ThemeToggle />
          {/* title — right side */}
          <View>
            <Text style={styles.title}>ההתקדמות שלי</Text>
            <Text style={styles.dateText}>{todayLabel}</Text>
          </View>
        </View>

        {/* טבעת קלוריות */}
        {balance ? (
          <View style={styles.ringCard}>
            <CalorieRing
              consumed={balance.consumed?.totalCalories || 0}
              target={balance.targets?.targetCalories || 2000}
              progress={balance.caloriesProgress || 0}
            />
          </View>
        ) : (
          <View style={styles.emptyRing}>
            <Text style={styles.emptyText}>הגדר מטרה כדי לראות התקדמות</Text>
          </View>
        )}

        {/* מקרו — Bento Grid */}
        <View style={styles.macroSection}>
          <Text style={styles.sectionTitle}>מאקרו-נוטריינטים</Text>
          <View style={styles.macroGrid}>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>חלבון</Text>
              <Text style={[styles.macroCardValue, { color: c.coral }]}>
                {balance?.consumed?.totalProteinG || 0}
                <Text style={styles.macroCardUnit}>גר׳</Text>
              </Text>
              <MacroProgressBar
                consumed={balance?.consumed?.totalProteinG || 0}
                target={balance?.targets?.targetProteinG || 150}
                unit="גר׳" color={c.coral} showBar showValues={false}
              />
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>פחמימות</Text>
              <Text style={[styles.macroCardValue, { color: c.yellow }]}>
                {balance?.consumed?.totalCarbsG || 0}
                <Text style={styles.macroCardUnit}>גר׳</Text>
              </Text>
              <MacroProgressBar
                consumed={balance?.consumed?.totalCarbsG || 0}
                target={balance?.targets?.targetCarbsG || 250}
                unit="גר׳" color={c.yellow} showBar showValues={false}
              />
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroCardLabel}>שומן</Text>
              <Text style={[styles.macroCardValue, { color: c.mint }]}>
                {balance?.consumed?.totalFatG || 0}
                <Text style={styles.macroCardUnit}>גר׳</Text>
              </Text>
              <MacroProgressBar
                consumed={balance?.consumed?.totalFatG || 0}
                target={balance?.targets?.targetFatG || 70}
                unit="גר׳" color={c.mint} showBar showValues={false}
              />
            </View>
          </View>
        </View>

        {/* כפתור סנכרון */}
        <TouchableOpacity
          style={[styles.syncButton, syncingHealth && styles.syncButtonDisabled]}
          onPress={handleSyncHealth}
          disabled={syncingHealth}
        >
          <Text style={styles.syncButtonText}>
            {syncingHealth ? '⌚  מסנכרן...' : '⌚  סנכרן נתוני בריאות'}
          </Text>
        </TouchableOpacity>

        {/* ארוחות היום */}
        <View style={styles.mealsSection}>
          <Text style={styles.sectionTitle}>
            ארוחות היום ({meals.length})
          </Text>

          {meals.length === 0 ? (
            <Text style={styles.emptyMealsText}>
              עדיין לא נרשמו ארוחות. לחץ על "סריקה" להוספת הארוחה הראשונה.
            </Text>
          ) : (
            meals.map((meal) => (
              <MealItem
                key={meal.id}
                meal={meal}
                onDelete={() => handleDeleteMeal(meal)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


function makeStyles(c) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: c.bg },
    headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
    title:            { fontSize: 28, fontWeight: '800', color: c.text, textAlign: 'right', letterSpacing: -0.5 },
    dateText:         { fontSize: 14, color: c.textMuted, marginTop: 4, textAlign: 'right' },
    toggleWrapper:    { alignItems: 'center', gap: 5 },
    toggleTrackPill:  { width: 46, height: 26, borderRadius: 13, justifyContent: 'center' },
    toggleThumb:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
    toggleLabel:      { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
    emptyRing:        { alignItems: 'center', paddingVertical: 40 },
    emptyText:        { color: c.textMuted, fontSize: 14 },
    ringCard:         { marginHorizontal: 20, marginTop: 8, backgroundColor: c.surface, borderRadius: 28, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    macroSection:     { marginHorizontal: 20, marginTop: 16 },
    sectionTitle:     { fontSize: 13, fontWeight: '700', color: c.textMuted, marginBottom: 12, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 },
    macroGrid:        { flexDirection: 'row', gap: 10 },
    macroCard:        { flex: 1, backgroundColor: c.surface, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: c.border },
    macroCardLabel:   { fontSize: 11, fontWeight: '600', color: c.textMuted, textAlign: 'right', marginBottom: 4 },
    macroCardValue:   { fontSize: 20, fontWeight: '800', textAlign: 'right', marginBottom: 10, letterSpacing: -0.5 },
    macroCardUnit:    { fontSize: 11, fontWeight: '400' },
    syncButton:       { marginHorizontal: 20, marginTop: 16, backgroundColor: c.mint, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    syncButtonDisabled: { backgroundColor: c.syncDisabled },
    syncButtonText:   { color: c.mintText, fontSize: 15, fontWeight: '800' },
    mealsSection:     { marginHorizontal: 20, marginTop: 24, marginBottom: 32 },
    emptyMealsText:   { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 16 },
  });
}
