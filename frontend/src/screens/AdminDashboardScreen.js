/**
 * screens/AdminDashboardScreen.js — Admin-only dashboard
 *
 * Shows:
 *  - Summary KPIs (users, Gemini calls, success rate, avg latency)
 *  - Users list (email, provider, logins, last seen)
 *  - Gemini request log (user, type, input, result/error, duration)
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useThemeColors } from '../context/ThemeContext';
import { listUsers, listGeminiLogs, isAdmin } from '../services/adminService';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtRel(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'עכשיו';
  if (m < 60)  return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `לפני ${h} שע׳`;
  const days = Math.floor(h / 24);
  return `לפני ${days} ימים`;
}
function isToday(ts) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function within7Days(ts) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return (Date.now() - d.getTime()) < 7 * 86400_000;
}
function providerIcon(p) {
  if (p === 'google') return '🟢 Google';
  if (p === 'email')  return '✉️ Email';
  return p || '—';
}

export default function AdminDashboardScreen() {
  const { currentUser } = useApp();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState('');
  const [users,     setUsers]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [tab,       setTab]       = useState('summary'); // summary | users | logs

  const load = useCallback(async () => {
    setError('');
    try {
      const [u, l] = await Promise.all([listUsers(), listGeminiLogs(200)]);
      setUsers(u);
      setLogs(l);
    } catch (e) {
      setError(e?.message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // ── Guard: admin only ──────────────────────────────────────────────────────
  if (!isAdmin(currentUser)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.denied}>
          <Text style={styles.deniedEmoji}>🔒</Text>
          <Text style={styles.deniedTitle}>גישה מוגבלת</Text>
          <Text style={styles.deniedText}>דף זה מוגבל לאדמין בלבד.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.mint} />
          <Text style={{ color: c.textMuted, marginTop: 10 }}>טוען נתונים...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived KPIs ───────────────────────────────────────────────────────────
  const usersTotal    = users.length;
  const usersActive7d = users.filter((u) => within7Days(u.lastLoginAt)).length;
  const usersToday    = users.filter((u) => isToday(u.lastLoginAt)).length;

  const callsTotal    = logs.length;
  const callsToday    = logs.filter((x) => isToday(x.ts)).length;
  const errorCalls    = logs.filter((x) => !!x.error).length;
  const successRate   = callsTotal ? Math.round(((callsTotal - errorCalls) / callsTotal) * 100) : 0;
  const avgLatencyMs  = callsTotal
    ? Math.round(logs.reduce((s, x) => s + (x.durationMs || 0), 0) / callsTotal)
    : 0;
  const scanCount     = logs.filter((x) => x.type === 'scan').length;
  const byNameCount   = logs.filter((x) => x.type === 'byName').length;

  // Per-user call counts
  const callsByUid = {};
  for (const l of logs) {
    const k = l.uid || 'anon';
    callsByUid[k] = (callsByUid[k] || 0) + 1;
  }

  // Top error messages
  const errTally = {};
  for (const l of logs) {
    if (l.error) errTally[l.error] = (errTally[l.error] || 0) + 1;
  }
  const topErrors = Object.entries(errTally).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.mint} />}
      >
        <Text style={styles.header}>🔑 דשבורד אדמין</Text>
        <Text style={styles.sub}>{currentUser?.email}</Text>

        {!!error && (
          <View style={styles.errBox}>
            <Text style={styles.errTxt}>{error}</Text>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {[['summary','סקירה'],['users',`משתמשים (${usersTotal})`],['logs',`בקשות Gemini (${callsTotal})`]].map(([k,l])=>(
            <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.tab, tab===k && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab===k && styles.tabTxtActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SUMMARY ─────────────────────────────────────────────────────── */}
        {tab === 'summary' && (
          <View>
            <Text style={styles.section}>משתמשים</Text>
            <View style={styles.kpiRow}>
              <Kpi c={c} styles={styles} label="סה״כ"          value={usersTotal}    emoji="👥" />
              <Kpi c={c} styles={styles} label="פעילים היום"   value={usersToday}    emoji="🟢" />
              <Kpi c={c} styles={styles} label="פעילים 7 ימים" value={usersActive7d} emoji="📅" />
            </View>

            <Text style={styles.section}>בקשות Gemini</Text>
            <View style={styles.kpiRow}>
              <Kpi c={c} styles={styles} label="סה״כ"      value={callsTotal}          emoji="🤖" />
              <Kpi c={c} styles={styles} label="היום"      value={callsToday}          emoji="📊" />
              <Kpi c={c} styles={styles} label="הצלחה"     value={`${successRate}%`}   emoji="✅" />
            </View>
            <View style={styles.kpiRow}>
              <Kpi c={c} styles={styles} label="שגיאות"     value={errorCalls}          emoji="⚠️" />
              <Kpi c={c} styles={styles} label="סריקות"     value={scanCount}           emoji="📷" />
              <Kpi c={c} styles={styles} label="לפי שם"     value={byNameCount}         emoji="✏️" />
            </View>
            <View style={styles.kpiRow}>
              <Kpi c={c} styles={styles} label="זמן ממוצע"  value={`${avgLatencyMs} ms`} emoji="⏱️" />
            </View>

            {topErrors.length > 0 && (
              <>
                <Text style={styles.section}>שגיאות נפוצות</Text>
                <View style={styles.card}>
                  {topErrors.map(([msg, n]) => (
                    <View key={msg} style={styles.errorRow}>
                      <Text style={styles.errorCount}>{n}×</Text>
                      <Text style={styles.errorMsg} numberOfLines={2}>{msg}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.section}>משתמשים פעילים ביותר</Text>
            <View style={styles.card}>
              {Object.entries(callsByUid)
                .sort((a,b) => b[1]-a[1])
                .slice(0, 5)
                .map(([uid, n]) => {
                  const u = users.find((x) => x.uid === uid);
                  return (
                    <View key={uid} style={styles.topUserRow}>
                      <Text style={styles.topUserEmail}>{u?.email || uid}</Text>
                      <Text style={styles.topUserCount}>{n} בקשות</Text>
                    </View>
                  );
                })}
              {Object.keys(callsByUid).length === 0 && <Text style={styles.empty}>אין נתונים עדיין.</Text>}
            </View>
          </View>
        )}

        {/* ── USERS ───────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <View>
            {users.length === 0 && <Text style={styles.empty}>אין משתמשים רשומים.</Text>}
            {users.map((u) => (
              <View key={u.uid} style={styles.userCard}>
                <View style={styles.userHead}>
                  <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                  <Text style={styles.userProvider}>{providerIcon(u.provider)}</Text>
                </View>
                {!!u.name && <Text style={styles.userName}>{u.name}</Text>}
                <View style={styles.userMeta}>
                  <Text style={styles.metaItem}>נרשם: {fmtTs(u.createdAt)}</Text>
                  <Text style={styles.metaItem}>כניסות: {u.loginCount || 1}</Text>
                  <Text style={styles.metaItem}>נראה לאחרונה: {fmtRel(u.lastLoginAt)}</Text>
                  <Text style={styles.metaItem}>בקשות Gemini: {callsByUid[u.uid] || 0}</Text>
                </View>
                <Text style={styles.userUid} numberOfLines={1}>UID: {u.uid}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── LOGS ────────────────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <View>
            {logs.length === 0 && <Text style={styles.empty}>אין בקשות עדיין.</Text>}
            {logs.map((l) => (
              <View key={l.id} style={[styles.logCard, l.error && styles.logCardError]}>
                <View style={styles.logHead}>
                  <Text style={styles.logType}>
                    {l.type === 'scan' ? '📷 סריקה' : l.type === 'byName' ? '✏️ לפי שם' : l.type}
                  </Text>
                  <Text style={styles.logTime}>{fmtRel(l.ts)}</Text>
                </View>
                <Text style={styles.logEmail} numberOfLines={1}>{l.email || l.uid || 'anonymous'}</Text>
                {!!l.input       && <Text style={styles.logInput} numberOfLines={1}>קלט: {l.input}</Text>}
                {!!l.description && <Text style={styles.logDesc}  numberOfLines={1}>תוצאה: {l.description}</Text>}
                {(l.calories != null && !l.error) && (
                  <Text style={styles.logNutri}>
                    {l.calories} קק״ל · {l.proteinG}ח · {l.carbsG}פ · {l.fatG}ש
                  </Text>
                )}
                {!!l.error && <Text style={styles.logError} numberOfLines={2}>⚠ {l.error}</Text>}
                {l.durationMs != null && <Text style={styles.logDur}>{l.durationMs} ms</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ c, styles, label, value, emoji }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiEmoji}>{emoji}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { fontSize: 26, fontWeight: '800', color: c.text, textAlign: 'right' },
    sub:    { fontSize: 13, color: c.textMuted, textAlign: 'right', marginBottom: 16 },

    tabs:       { flexDirection: 'row', backgroundColor: c.toggleTrack, borderRadius: 14, padding: 4, marginBottom: 16 },
    tab:        { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    tabActive:  { backgroundColor: c.toggleActive },
    tabTxt:     { fontSize: 13, fontWeight: '600', color: c.textMuted },
    tabTxtActive: { color: c.mint },

    section: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'right', marginTop: 18, marginBottom: 10 },

    kpiRow:   { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
    kpi:      { flex: 1, backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    kpiEmoji: { fontSize: 22, marginBottom: 4 },
    kpiValue: { fontSize: 22, fontWeight: '800', color: c.mint },
    kpiLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    card: { backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 6 },

    errorRow:    { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 6, gap: 10 },
    errorCount:  { fontSize: 14, fontWeight: '800', color: c.mint, minWidth: 36, textAlign: 'right' },
    errorMsg:    { flex: 1, fontSize: 13, color: c.text, textAlign: 'right' },

    topUserRow:   { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    topUserEmail: { fontSize: 13, color: c.text },
    topUserCount: { fontSize: 13, color: c.mint, fontWeight: '700' },

    userCard: { backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
    userHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    userEmail: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'right', flex: 1 },
    userProvider: { fontSize: 12, color: c.textMuted, marginRight: 8 },
    userName: { fontSize: 13, color: c.textSec, textAlign: 'right', marginTop: 4 },
    userMeta: { marginTop: 8, gap: 3 },
    metaItem: { fontSize: 12, color: c.textMuted, textAlign: 'right' },
    userUid: { fontSize: 10, color: c.textMuted, textAlign: 'right', marginTop: 6, fontFamily: 'monospace' },

    logCard: { backgroundColor: c.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
    logCardError: { borderColor: c.errorBorder || '#E53935' },
    logHead: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    logType: { fontSize: 13, fontWeight: '700', color: c.mint },
    logTime: { fontSize: 12, color: c.textMuted },
    logEmail: { fontSize: 12, color: c.textSec, textAlign: 'right', marginTop: 2 },
    logInput: { fontSize: 12, color: c.text, textAlign: 'right', marginTop: 4 },
    logDesc:  { fontSize: 13, color: c.text, textAlign: 'right', marginTop: 2 },
    logNutri: { fontSize: 12, color: c.textMuted, textAlign: 'right', marginTop: 2 },
    logError: { fontSize: 12, color: c.errorText || '#E53935', textAlign: 'right', marginTop: 4 },
    logDur:   { fontSize: 11, color: c.textMuted, textAlign: 'left', marginTop: 2 },

    empty: { textAlign: 'center', color: c.textMuted, padding: 20 },

    errBox: { backgroundColor: c.errorBg || '#ffeaea', padding: 12, borderRadius: 12, marginBottom: 12 },
    errTxt: { color: c.errorText || '#E53935', textAlign: 'right' },

    denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    deniedEmoji: { fontSize: 64, marginBottom: 12 },
    deniedTitle: { fontSize: 22, fontWeight: '800', color: c.text },
    deniedText:  { fontSize: 14, color: c.textMuted, marginTop: 6, textAlign: 'center' },
  });
}
