/**
 * screens/ProfileScreen.js — User Profile
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useThemeColors } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

const ACTIVITY_LEVELS = [
  { key: 'sedentary',   label: 'יושבני',    sessions: '0 אימונים',               description: 'ללא פעילות גופנית כלל',   multiplier: '×1.2',   icon: '🛋️' },
  { key: 'light',       label: 'קל',         sessions: '1–2 אימונים בשבוע',       description: 'הליכה, פעילות קלה',        multiplier: '×1.375', icon: '🚶' },
  { key: 'moderate',    label: 'בינוני',     sessions: '3–4 אימונים בשבוע',       description: 'כושר סדיר',                multiplier: '×1.55',  icon: '🏃' },
  { key: 'active',      label: 'פעיל',       sessions: '5–6 אימונים בשבוע',       description: 'אימונים עצימים',           multiplier: '×1.725', icon: '🏋️' },
  { key: 'very_active', label: 'מאוד פעיל', sessions: '7+ אימונים / עבודה פיזית', description: 'ספורטאי / עבודה גופנית',  multiplier: '×1.9',   icon: '⚡' },
];

const GENDERS = [
  { key: 'male',   label: 'זכר',  icon: '♂' },
  { key: 'female', label: 'נקבה', icon: '♀' },
  { key: 'other',  label: 'אחר',  icon: '○' },
];

const GENDER_DISPLAY = { male: '♂ זכר', female: '♀ נקבה', other: '○ אחר' };

const WEIGHT_GOALS = [
  { key: 'lose_fast', label: 'ירידה מהירה',    detail: '−1 ק״ג / שבוע',   delta: -1000, icon: '🔥', color: '#E53935' },
  { key: 'lose',      label: 'ירידה במשקל',    detail: '−0.5 ק״ג / שבוע', delta: -500,  icon: '📉', color: '#FF7043' },
  { key: 'lose_slow', label: 'ירידה עדינה',    detail: '−0.25 ק״ג / שבוע',delta: -250,  icon: '🚶', color: '#FFA726' },
  { key: 'maintain',  label: 'שמירת משקל',     detail: 'ללא שינוי',        delta: 0,     icon: '⚖️', color: '#00C9A7' },
  { key: 'gain',      label: 'עלייה במסת שריר', detail: '+0.25 ק״ג / שבוע',delta: +250,  icon: '💪', color: '#3B82F6' },
];

const WEIGHT_GOAL_DISPLAY = Object.fromEntries(WEIGHT_GOALS.map((g) => [g.key, g]));

function bmi(w, h) {
  if (!w || !h) return '—';
  return (w / Math.pow(h / 100, 2)).toFixed(1);
}

function StatBox({ label, value, unit, color, styles }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>
        {value}<Text style={styles.statUnit}> {unit}</Text>
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { saveProfile, userProfile, signOut, currentUser } = useApp();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [isEditing, setIsEditing] = useState(!userProfile);
  const [isSaving,  setIsSaving]  = useState(false);

  const [form, setForm] = useState({
    name:          userProfile?.name          ?? '',
    age:           userProfile?.age           ? String(userProfile.age)      : '',
    weightKg:      userProfile?.weightKg      ? String(userProfile.weightKg) : '',
    heightCm:      userProfile?.heightCm      ? String(userProfile.heightCm) : '',
    gender:        userProfile?.gender        ?? 'other',
    activityLevel: userProfile?.activityLevel ?? 'moderate',
    weightGoal:    userProfile?.weightGoal    ?? 'maintain',
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim())                                    return Alert.alert('שגיאה', 'אנא הכנס שם.');
    if (!form.age || Number(form.age) < 10 || Number(form.age) > 120) return Alert.alert('שגיאה', 'אנא הכנס גיל תקין (10–120).');
    if (!form.weightKg || Number(form.weightKg) < 20)        return Alert.alert('שגיאה', 'אנא הכנס משקל תקין.');
    if (!form.heightCm || Number(form.heightCm) < 50)        return Alert.alert('שגיאה', 'אנא הכנס גובה תקין.');
    setIsSaving(true);
    try {
      saveProfile({ name: form.name.trim(), age: Number(form.age), weightKg: Number(form.weightKg), heightCm: Number(form.heightCm), gender: form.gender, activityLevel: form.activityLevel, weightGoal: form.weightGoal });
      setIsEditing(false);
      Alert.alert('✅ פרופיל נשמר!', `שלום ${form.name.trim()}! עבור למסך Goals לחישוב המטרה שלך.`, [{ text: 'מצוין 👍' }]);
    } finally { setIsSaving(false); }
  };

  const handleCancel = () => {
    if (userProfile) {
      setForm({ name: userProfile.name, age: String(userProfile.age), weightKg: String(userProfile.weightKg), heightCm: String(userProfile.heightCm), gender: userProfile.gender, activityLevel: userProfile.activityLevel, weightGoal: userProfile.weightGoal ?? 'maintain' });
      setIsEditing(false);
    }
  };

  // ── VIEW MODE ──────────────────────────────────────────────────────────────
  if (!isEditing && userProfile) {
    const act    = ACTIVITY_LEVELS.find((a) => a.key === userProfile.activityLevel);
    const actIdx = ACTIVITY_LEVELS.findIndex((a) => a.key === userProfile.activityLevel);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ThemeToggle />
              <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
                <Text style={styles.editBtnTxt}>✏ עריכה</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.screenTitle}>הפרופיל שלי</Text>
          </View>

          <View style={styles.avatarCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{userProfile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.avatarName}>{userProfile.name}</Text>
            <Text style={styles.avatarSub}>{GENDER_DISPLAY[userProfile.gender]}  ·  גיל {userProfile.age}</Text>
          </View>

          <View style={styles.statsRow}>
            <StatBox label="משקל" value={userProfile.weightKg} unit="ק״ג" color={c.blue}   styles={styles} />
            <View style={styles.statsDivider} />
            <StatBox label="גובה"  value={userProfile.heightCm} unit="ס״מ" color={c.mint}   styles={styles} />
            <View style={styles.statsDivider} />
            <StatBox label="BMI"   value={bmi(userProfile.weightKg, userProfile.heightCm)} unit="" color={c.orange} styles={styles} />
          </View>

          <View style={styles.actViewCard}>
            <View style={styles.rowBetweenInner}>
              <Text style={styles.actViewIcon}>{act?.icon}</Text>
              <Text style={styles.actViewMuted}>רמת פעילות</Text>
            </View>
            <Text style={styles.actViewName}>{act?.label}</Text>
            <Text style={styles.actViewSessions}>{act?.sessions}</Text>
            <View style={styles.segBar}>
              {ACTIVITY_LEVELS.map((a, i) => (
                <View key={a.key} style={[styles.seg, { backgroundColor: i <= actIdx ? c.mint : c.track }, i === 0 && styles.segFirst, i === ACTIVITY_LEVELS.length - 1 && styles.segLast]} />
              ))}
            </View>
            <Text style={styles.actViewMult}>מכפיל TDEE: {act?.multiplier}</Text>
          </View>

          {(() => {
            const wg = WEIGHT_GOAL_DISPLAY[userProfile.weightGoal || 'maintain'];
            return (
              <View style={[styles.actViewCard, { marginTop: 0 }]}>
                <View style={styles.rowBetweenInner}>
                  <Text style={{ fontSize: 28 }}>{wg.icon}</Text>
                  <Text style={styles.actViewMuted}>מטרת משקל</Text>
                </View>
                <Text style={[styles.actViewName, { color: wg.color }]}>{wg.label}</Text>
                <Text style={styles.actViewSessions}>{wg.detail}</Text>
                {wg.delta !== 0 && <Text style={styles.actViewMult}>{wg.delta > 0 ? '+' : ''}{wg.delta} קק״ל / יום מ-TDEE</Text>}
              </View>
            );
          })()}

          <View style={styles.accountCard}>
            <Text style={styles.accountEmail}>{currentUser?.email}</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => {
              if (Platform.OS === 'web') { if (window.confirm('האם אתה בטוח שברצונך להתנתק?')) signOut(); }
              else Alert.alert('התנתקות', 'האם אתה בטוח?', [{ text: 'ביטול', style: 'cancel' }, { text: 'התנתק', style: 'destructive', onPress: signOut }]);
            }}>
              <Text style={styles.logoutTxt}>🚪 התנתק</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            {userProfile
              ? <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}><Text style={styles.cancelBtnTxt}>ביטול</Text></TouchableOpacity>
              : null}
          </View>
          <Text style={styles.screenTitle}>{userProfile ? 'עריכת פרופיל' : 'הגדרת פרופיל'}</Text>
        </View>

        <Text style={styles.subtitle}>הפרטים ישמשו לחישוב מדויק של יעד הקלוריות שלך.</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>שם מלא</Text>
          <TextInput style={styles.input} placeholder="למשל: ישראל ישראלי" placeholderTextColor={c.placeholder} textAlign="right" value={form.name} onChangeText={(v) => update('name', v)} />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>גיל</Text>
          <TextInput style={styles.input} placeholder="25" placeholderTextColor={c.placeholder} keyboardType="numeric" textAlign="right" value={form.age} onChangeText={(v) => update('age', v)} />
        </View>

        <View style={styles.rowPair}>
          <View style={[styles.field, { flex: 1, marginLeft: 6 }]}>
            <Text style={styles.fieldLabel}>משקל (ק״ג)</Text>
            <TextInput style={styles.input} placeholder="70" placeholderTextColor={c.placeholder} keyboardType="numeric" textAlign="right" value={form.weightKg} onChangeText={(v) => update('weightKg', v)} />
          </View>
          <View style={[styles.field, { flex: 1, marginRight: 6 }]}>
            <Text style={styles.fieldLabel}>גובה (ס״מ)</Text>
            <TextInput style={styles.input} placeholder="175" placeholderTextColor={c.placeholder} keyboardType="numeric" textAlign="right" value={form.heightCm} onChangeText={(v) => update('heightCm', v)} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>מין</Text>
          <View style={styles.genderRow}>
            {GENDERS.map(({ key, label, icon }) => (
              <TouchableOpacity key={key} style={[styles.genderChip, form.gender === key && styles.genderChipSel]} onPress={() => update('gender', key)}>
                <Text style={[styles.genderIcon, form.gender === key && { color: c.mint }]}>{icon}</Text>
                <Text style={[styles.genderLabel, form.gender === key && { color: c.mint }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>רמת פעילות שבועית</Text>
          {ACTIVITY_LEVELS.map(({ key, label, sessions, description, multiplier, icon }) => {
            const sel = form.activityLevel === key;
            return (
              <TouchableOpacity key={key} style={[styles.actRow, sel && styles.actRowSel]} onPress={() => update('activityLevel', key)} activeOpacity={0.75}>
                <View style={styles.actRight}>
                  <View style={[styles.radio, sel && styles.radioSel]}>
                    {sel && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.actTexts}>
                    <Text style={[styles.actLabel, sel && styles.actLabelSel]}>{label}</Text>
                    <Text style={styles.actSessions}>{sessions}</Text>
                    <Text style={styles.actDesc}>{description}</Text>
                  </View>
                </View>
                <View style={styles.actLeft}>
                  <Text style={styles.actEmoji}>{icon}</Text>
                  <Text style={[styles.actMult, sel && { color: c.mint }]}>{multiplier}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>מטרת משקל</Text>
          {WEIGHT_GOALS.map(({ key, label, detail, icon, color }) => {
            const sel = form.weightGoal === key;
            return (
              <TouchableOpacity key={key} style={[styles.goalRow, sel && { borderColor: color, backgroundColor: color + '12' }]} onPress={() => update('weightGoal', key)} activeOpacity={0.75}>
                <View style={styles.goalRight}>
                  <View style={[styles.radio, sel && { borderColor: color }]}>
                    {sel && <View style={[styles.radioInner, { backgroundColor: color }]} />}
                  </View>
                  <View>
                    <Text style={[styles.actLabel, sel && { color }]}>{label}</Text>
                    <Text style={styles.actSessions}>{detail}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 24 }}>{icon}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.saveBtn, isSaving && styles.saveBtnDis]} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveBtnTxt}>{isSaving ? 'שומר...' : '✓ שמור פרופיל'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 20, marginBottom: 4 },
    rowBetweenInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    screenTitle:  { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
    subtitle:     { fontSize: 13, color: c.textMuted, marginHorizontal: 20, marginBottom: 20, lineHeight: 20, textAlign: 'right' },
    editBtn:      { backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: c.border },
    editBtnTxt:   { color: c.text, fontSize: 13, fontWeight: '700' },
    cancelBtn:    { borderWidth: 1, borderColor: c.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
    cancelBtnTxt: { color: c.textSec, fontSize: 13, fontWeight: '600' },
    avatarCard:   { alignItems: 'center', marginHorizontal: 20, marginBottom: 14, backgroundColor: c.surface, borderRadius: 24, paddingVertical: 28, borderWidth: 1, borderColor: c.border },
    avatarCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarInitial:{ fontSize: 34, fontWeight: '800', color: c.mintText },
    avatarName:   { fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 4 },
    avatarSub:    { fontSize: 14, color: c.textMuted },
    statsRow:     { flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, backgroundColor: c.surface, borderRadius: 20, paddingVertical: 18, borderWidth: 1, borderColor: c.border },
    statBox:      { flex: 1, alignItems: 'center' },
    statsDivider: { width: 1, backgroundColor: c.separator },
    statValue:    { fontSize: 22, fontWeight: '800' },
    statUnit:     { fontSize: 11, color: c.textMuted, fontWeight: '400' },
    statLabel:    { fontSize: 11, color: c.textMuted, marginTop: 4, fontWeight: '500' },
    actViewCard:  { marginHorizontal: 20, marginBottom: 14, backgroundColor: c.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: c.border },
    actViewIcon:  { fontSize: 24 },
    actViewMuted: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    actViewName:  { fontSize: 22, fontWeight: '800', color: c.text, textAlign: 'right', marginBottom: 2 },
    actViewSessions: { fontSize: 13, color: c.blue, fontWeight: '600', textAlign: 'right', marginBottom: 14 },
    segBar:       { flexDirection: 'row', gap: 4, marginBottom: 8 },
    seg:          { flex: 1, height: 6 },
    segFirst:     { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
    segLast:      { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
    actViewMult:  { fontSize: 11, color: c.textMuted, textAlign: 'right' },
    goalRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14, marginBottom: 8, backgroundColor: c.surface },
    goalRight:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
    accountCard:  { marginHorizontal: 20, marginTop: 8, marginBottom: 8, backgroundColor: c.surface, borderRadius: 20, padding: 18, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.border },
    accountEmail: { fontSize: 13, color: c.textMuted },
    logoutBtn:    { borderWidth: 1, borderColor: c.logoutBorder, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: c.logoutBg },
    logoutTxt:    { fontSize: 15, fontWeight: '700', color: c.logoutText },
    field:        { marginHorizontal: 20, marginBottom: 16 },
    rowPair:      { flexDirection: 'row', marginHorizontal: 20 },
    fieldLabel:   { fontSize: 13, fontWeight: '700', color: c.textSec, marginBottom: 8, textAlign: 'right' },
    input:        { backgroundColor: c.inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: c.inputBorder, color: c.text, textAlign: 'right' },
    genderRow:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    genderChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, borderColor: c.chipBorder, backgroundColor: c.chipBg },
    genderChipSel:{ borderColor: c.mint, backgroundColor: c.chipSelBg },
    genderIcon:   { fontSize: 14, color: c.textSec },
    genderLabel:  { fontSize: 13, fontWeight: '600', color: c.textSec },
    actRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.actRowBg, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: c.actRowBorder },
    actRowSel:    { borderColor: c.mint, backgroundColor: c.actRowSel },
    actRight:     { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
    radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.textMuted, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
    radioSel:     { borderColor: c.mint },
    radioInner:   { width: 10, height: 10, borderRadius: 5, backgroundColor: c.mint },
    actTexts:     { alignItems: 'flex-end' },
    actLabel:     { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'right' },
    actLabelSel:  { color: c.mint },
    actSessions:  { fontSize: 12, color: c.blue, fontWeight: '600', textAlign: 'right', marginTop: 2 },
    actDesc:      { fontSize: 11, color: c.textMuted, textAlign: 'right', marginTop: 1 },
    actLeft:      { alignItems: 'center', minWidth: 44 },
    actEmoji:     { fontSize: 24, marginBottom: 2 },
    actMult:      { fontSize: 10, color: c.textMuted, fontWeight: '600' },
    saveBtn:      { backgroundColor: c.mint, borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginHorizontal: 20, marginTop: 10 },
    saveBtnDis:   { backgroundColor: c.syncDisabled },
    saveBtnTxt:   { color: c.mintText, fontSize: 16, fontWeight: '800' },
  });
}
