/**
 * screens/DashboardScreen.js — Main dashboard
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp }   from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { healthKitService } from '../services/healthKitService';
import MacroProgressBar from '../components/MacroProgressBar';
import MealItem         from '../components/MealItem';
import CalorieRing      from '../components/CalorieRing';
import ThemeToggle      from '../components/ThemeToggle';

export default function DashboardScreen() {
  const {
    balance, meals, isLoading, loadDailyData, deleteMeal,
    clearError, error, currentUser, pastDays, loadHistory, cloudSync,
  } = useApp();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const uid = currentUser?.uid;
  const [refreshing, setRefreshing] = useState(false);
  const [syncingHealth, setSyncingHealth] = useState(false);

  useEffect(() => {
    if (uid) {
      loadDailyData(uid);
      loadHistory(uid);
    }
  }, [uid]);

  useEffect(() => {
    if (error) Alert.alert('שגיאה', error, [{ text: 'אישור', onPress: clearError }]);
  }, [error]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (uid) {
      await loadDailyData(uid);
      loadHistory(uid);
    }
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
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <ThemeToggle />
            {cloudSync && (
              <View style={styles.cloudBadge}>
                <Text style={styles.cloudBadgeText}>☁ Synced</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={styles.title}>ההתקדמות שלי</Text>
            <Text style={styles.dateText}>{todayLabel}</Text>
          </View>
        </View>

        {/* Calorie ring */}
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

        {/* Macros grid */}
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

        {/* 7-day history */}
        {pastDays.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>7 ימים אחרונים</Text>
            <View style={styles.historyCard}>
              <WeekBars days={pastDays} c={c} styles={styles} />
            </View>
          </View>
        )}

        {/* Sync button */}
        <TouchableOpacity
          style={[styles.syncButton, syncingHealth && styles.syncButtonDisabled]}
          onPress={handleSyncHealth}
          disabled={syncingHealth}
        >
          <Text style={styles.syncButtonText}>
            {syncingHealth ? '⌚  מסנכרן...' : '⌚  סנכרן נתוני בריאות'}
          </Text>
        </TouchableOpacity>

        {/* Today's meals */}
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

// ── 7-day bar chart ────────────────────────────────────────────────────────────
function WeekBars({ days, c, styles }) {
  const maxCal = Math.max(...days.map((d) => d.consumed?.totalCalories || 0), 1);
  return (
    <View style={styles.barsRow}>
      {[...days].reverse().map((day) => {
        const kcal      = day.consumed?.totalCalories || 0;
        const target    = day.targets?.targetCalories  || 2000;
        const barHeight = Math.max((kcal / maxCal) * 80, 3);
        const over      = kcal > target;
        const label     = new Date(day.date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'narrow' });
        const isToday   = day.date === new Date().toISOString().split('T')[0];
        return (
          <View key={day.date} style={styles.barCol}>
            <Text style={styles.barKcal}>{kcal > 0 ? kcal : ''}</Text>
            <View style={styles.barTrack}>
              <View style={[
                styles.barFill,
                { height: barHeight, backgroundColor: over ? c.coral : c.mint },
              ]} />
            </View>
            <Text style={[styles.barLabel, isToday && { color: c.mint, fontWeight: '800' }]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: c.bg },
    headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
    headerLeft:       { alignItems: 'flex-start', gap: 6 },
    title:            { fontSize: 28, fontWeight: '800', color: c.text, textAlign: 'right', letterSpacing: -0.5 },
    dateText:         { fontSize: 14, color: c.textMuted, marginTop: 4, textAlign: 'right' },
    cloudBadge:       { backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c.border },
    cloudBadgeText:   { fontSize: 10, color: c.mint, fontWeight: '700' },
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
    // History
    historySection:   { marginHorizontal: 20, marginTop: 16 },
    historyCard:      { backgroundColor: c.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border },
    barsRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
    barCol:           { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    barKcal:          { fontSize: 8, color: c.textMuted, marginBottom: 2, textAlign: 'center' },
    barTrack:         { width: 18, height: 80, justifyContent: 'flex-end', borderRadius: 6, backgroundColor: c.border, overflow: 'hidden' },
    barFill:          { width: '100%', borderRadius: 6 },
    barLabel:         { fontSize: 11, color: c.textMuted, marginTop: 6, fontWeight: '600' },
    // Sync
    syncButton:         { marginHorizontal: 20, marginTop: 16, backgroundColor: c.mint, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
    syncButtonDisabled: { backgroundColor: c.syncDisabled },
    syncButtonText:     { color: c.mintText, fontSize: 15, fontWeight: '800' },
    // Meals
    mealsSection:     { marginHorizontal: 20, marginTop: 24, marginBottom: 32 },
    emptyMealsText:   { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 16 },
  });
}
