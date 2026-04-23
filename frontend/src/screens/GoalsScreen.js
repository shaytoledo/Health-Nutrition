/**
 * screens/GoalsScreen.js — Daily Goals
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiService } from '../services/apiService';
import { useApp } from '../context/AppContext';
import { useThemeColors } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

const DEMO_UID = 'demo_user_001';

function calcBMR(weightKg, heightCm, age, gender) {
  if (gender === 'male')   return Math.round(88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age);
  if (gender === 'female') return Math.round(447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age);
  const m = 88.362  + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  const f = 447.593 + 9.247  * weightKg + 3.098 * heightCm - 4.330 * age;
  return Math.round((m + f) / 2);
}

const ACTIVITY_MULTIPLIERS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const ACTIVITY_LABELS = { sedentary: 'יושבני', light: 'קל', moderate: 'בינוני', active: 'פעיל', very_active: 'מאוד פעיל' };

export default function GoalsScreen() {
  const { userProfile, loadDailyData } = useApp();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [goal, setGoal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ targetCalories: '', targetProteinG: '', targetCarbsG: '', targetFatG: '' });
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { fetchCurrentGoal(); }, []);

  const fetchCurrentGoal = async () => {
    try {
      const { goal: g } = await apiService.getGoal(DEMO_UID, today);
      setGoal(g);
      setManualForm({ targetCalories: String(g.targetCalories), targetProteinG: String(g.targetProteinG), targetCarbsG: String(g.targetCarbsG), targetFatG: String(g.targetFatG) });
    } catch { setGoal(null); }
  };

  const handleAutoCalculate = async () => {
    if (!userProfile) { Alert.alert('פרופיל חסר', 'אנא מלא את פרטי הפרופיל שלך תחילה (מסך Profile).', [{ text: 'אישור' }]); return; }
    setIsLoading(true);
    try {
      const { goal: g, bmr, tdee } = await apiService.setGoalFromQuiz(DEMO_UID, { date: today, weightKg: userProfile.weightKg, heightCm: userProfile.heightCm, age: userProfile.age, gender: userProfile.gender, activityLevel: userProfile.activityLevel });
      setGoal(g);
      await loadDailyData(DEMO_UID);
      Alert.alert('✅ מטרה חושבה!', `BMR: ${bmr} קק״ל\nTDEE: ${tdee} קק״ל\nמטרה יומית: ${g.targetCalories} קק״ל`, [{ text: 'מצוין 🎯' }]);
    } catch (err) { Alert.alert('שגיאה', err.message); }
    finally { setIsLoading(false); }
  };

  const handleManualSave = async () => {
    if (!manualForm.targetCalories || Number(manualForm.targetCalories) < 500) { Alert.alert('שגיאה', 'יש להכניס מטרת קלוריות של לפחות 500 קק״ל.'); return; }
    setIsLoading(true);
    try {
      const { goal: g } = await apiService.setGoal(DEMO_UID, { date: today, targetCalories: Number(manualForm.targetCalories), targetProteinG: Number(manualForm.targetProteinG) || 0, targetCarbsG: Number(manualForm.targetCarbsG) || 0, targetFatG: Number(manualForm.targetFatG) || 0 });
      setGoal(g);
      await loadDailyData(DEMO_UID);
      Alert.alert('✅ נשמר!', 'המטרה היומית עודכנה.', [{ text: 'מעולה 👍' }]);
      setShowManual(false);
    } catch (err) { Alert.alert('שגיאה', err.message); }
    finally { setIsLoading(false); }
  };

  const preview = userProfile ? (() => {
    const bmr  = calcBMR(userProfile.weightKg, userProfile.heightCm, userProfile.age, userProfile.gender);
    const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[userProfile.activityLevel] || 1.55));
    return { bmr, tdee };
  })() : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeader}>
          <ThemeToggle />
          <Text style={styles.screenTitle}>Daily Goals</Text>
        </View>

        {goal && (
          <View style={styles.goalCard}>
            <Text style={styles.goalCardTitle}>מטרה פעילה — {goal.date}</Text>
            <View style={styles.badgeRow}>
              <GoalBadge label="קלוריות" value={goal.targetCalories} unit="קק״ל" color={c.orange}  styles={styles} />
              <GoalBadge label="חלבון"   value={goal.targetProteinG} unit="גר׳"  color={c.coral}   styles={styles} />
            </View>
            <View style={styles.badgeRow}>
              <GoalBadge label="פחמימות" value={goal.targetCarbsG}   unit="גר׳"  color={c.yellow}  styles={styles} />
              <GoalBadge label="שומן"    value={goal.targetFatG}     unit="גר׳"  color={c.mint}    styles={styles} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          {userProfile ? (
            <View style={styles.profileCard}>
              <Text style={styles.profileCardTitle}>📋 הפרופיל שלך</Text>
              <View style={styles.profileRow}>
                <Text style={styles.profileVal}>{userProfile.name}</Text>
                <Text style={styles.profileKey}>שם</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileVal}>{userProfile.weightKg} ק״ג · {userProfile.heightCm} ס״מ · גיל {userProfile.age}</Text>
                <Text style={styles.profileKey}>גוף</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileVal}>{ACTIVITY_LABELS[userProfile.activityLevel]}</Text>
                <Text style={styles.profileKey}>פעילות</Text>
              </View>
              {preview && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>
                    BMR: <Text style={styles.previewNum}>{preview.bmr}</Text> קק״ל  ·  TDEE: <Text style={styles.previewNum}>{preview.tdee}</Text> קק״ל
                  </Text>
                </View>
              )}
              <TouchableOpacity style={[styles.primaryButton, isLoading && styles.disabledButton]} onPress={handleAutoCalculate} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color={c.mintText} /> : <Text style={styles.primaryButtonText}>⚡ חשב מטרה לפי פרופיל</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>פרופיל לא מוגדר</Text>
              <Text style={styles.emptySubtitle}>מלא את הפרטים שלך במסך Profile כדי שנוכל לחשב עבורך מטרה אישית.</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.manualToggle} onPress={() => setShowManual((v) => !v)}>
          <Text style={styles.manualToggleText}>{showManual ? '▲ סגור הזנה ידנית' : '✏ הזנה ידנית של מטרה'}</Text>
        </TouchableOpacity>

        {showManual && (
          <View style={styles.section}>
            {[
              { key: 'targetCalories', label: 'קלוריות (קק״ל)', placeholder: '2000' },
              { key: 'targetProteinG', label: 'חלבון (גר׳)',     placeholder: '150' },
              { key: 'targetCarbsG',   label: 'פחמימות (גר׳)',   placeholder: '250' },
              { key: 'targetFatG',     label: 'שומן (גר׳)',      placeholder: '70' },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={c.placeholder}
                  keyboardType="numeric" textAlign="right" value={manualForm[key]}
                  onChangeText={(v) => setManualForm((f) => ({ ...f, [key]: v }))} />
              </View>
            ))}
            <TouchableOpacity style={[styles.primaryButton, isLoading && styles.disabledButton]} onPress={handleManualSave} disabled={isLoading}>
              <Text style={styles.primaryButtonText}>שמור מטרה ידנית</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalBadge({ label, value, unit, color, styles }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeValue, { color }]}>{value}</Text>
      <Text style={styles.badgeUnit}>{unit}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: c.bg },
    screenHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
    screenTitle:      { fontSize: 28, fontWeight: '800', color: c.text, textAlign: 'right', letterSpacing: -0.5 },
    section:          { marginHorizontal: 20, marginBottom: 8 },
    goalCard:         { backgroundColor: c.surface, marginHorizontal: 20, borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: c.border },
    goalCardTitle:    { fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 14, textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 },
    badgeRow:         { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
    badge:            { alignItems: 'center', borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, minWidth: 110, backgroundColor: c.surface2 },
    badgeValue:       { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    badgeUnit:        { fontSize: 11, color: c.textMuted },
    badgeLabel:       { fontSize: 11, fontWeight: '700', color: c.textSec, marginTop: 4 },
    profileCard:      { backgroundColor: c.surface, borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: c.border },
    profileCardTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 14, textAlign: 'right' },
    profileRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.separator },
    profileKey:       { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    profileVal:       { fontSize: 14, color: c.text, fontWeight: '500', textAlign: 'right', flex: 1, marginRight: 8 },
    previewBox:       { backgroundColor: c.previewBg, borderRadius: 14, padding: 12, marginVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: c.previewBorder },
    previewText:      { fontSize: 13, color: c.textSec },
    previewNum:       { fontWeight: '800', color: c.mint },
    emptyCard:        { backgroundColor: c.surface, borderRadius: 24, padding: 28, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    emptyIcon:        { fontSize: 40, marginBottom: 14 },
    emptyTitle:       { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
    emptySubtitle:    { fontSize: 13, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
    primaryButton:    { backgroundColor: c.mint, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
    disabledButton:   { backgroundColor: c.syncDisabled },
    primaryButtonText:{ color: c.mintText, fontSize: 15, fontWeight: '800' },
    manualToggle:     { marginHorizontal: 20, marginBottom: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.surface },
    manualToggleText: { fontSize: 14, color: c.textSec, fontWeight: '600' },
    field:            { marginBottom: 14 },
    label:            { fontSize: 13, fontWeight: '600', color: c.textMuted, marginBottom: 7, textAlign: 'right' },
    input:            { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: c.inputBorder, color: c.text },
  });
}
