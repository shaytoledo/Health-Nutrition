/**
 * screens/AdminDashboardScreen.js — Admin-only dashboard (English).
 *
 * Three views:
 *   - Overview: KPIs and top charts
 *   - Users:    every registered user with login history and Gemini usage
 *   - Requests: detailed feed of every Gemini API call
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
function tsToDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}
function fmtAbs(ts) {
  const d = tsToDate(ts); if (!d) return '—';
  return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });
}
function fmtRel(ts) {
  const d = tsToDate(ts); if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
function isToday(ts) {
  const d = tsToDate(ts); if (!d) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function within7Days(ts) {
  const d = tsToDate(ts); if (!d) return false;
  return (Date.now() - d.getTime()) < 7 * 86400_000;
}
function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export default function AdminDashboardScreen() {
  const { currentUser } = useApp();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [users,      setUsers]      = useState([]);
  const [logs,       setLogs]       = useState([]);
  const [tab,        setTab]        = useState('overview');
  const [expanded,   setExpanded]   = useState({}); // logId → bool

  const load = useCallback(async () => {
    setError('');
    try {
      const [u, l] = await Promise.all([listUsers(), listGeminiLogs(500)]);
      setUsers(u);
      setLogs(l);
    } catch (e) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);
  const toggle = (id) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!isAdmin(currentUser)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.denied}>
          <Text style={styles.deniedEmoji}>🔒</Text>
          <Text style={styles.deniedTitle}>Access restricted</Text>
          <Text style={styles.deniedText}>This page is available only to the admin.</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.mint} />
          <Text style={{ color: c.textMuted, marginTop: 10 }}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived metrics ────────────────────────────────────────────────────────
  const usersTotal    = users.length;
  const usersToday    = users.filter((u) => isToday(u.lastLoginAt)).length;
  const usersActive7d = users.filter((u) => within7Days(u.lastLoginAt)).length;

  const callsTotal    = logs.length;
  const callsToday    = logs.filter((x) => isToday(x.ts)).length;
  const errorCalls    = logs.filter((x) => !!x.error).length;
  const successCalls  = callsTotal - errorCalls;
  const successRate   = callsTotal ? Math.round((successCalls / callsTotal) * 100) : 0;

  const durations     = logs.map((x) => x.durationMs).filter((x) => typeof x === 'number');
  const avgLatencyMs  = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const p50LatencyMs  = Math.round(percentile(durations, 0.5));
  const p95LatencyMs  = Math.round(percentile(durations, 0.95));

  const scanCount     = logs.filter((x) => x.type === 'scan').length;
  const byNameCount   = logs.filter((x) => x.type === 'byName').length;

  const totalTokensIn  = logs.reduce((s, x) => s + (x.tokensIn  || 0), 0);
  const totalTokensOut = logs.reduce((s, x) => s + (x.tokensOut || 0), 0);

  const callsByUid = {};
  for (const l of logs) {
    const k = l.uid || 'anon';
    callsByUid[k] = (callsByUid[k] || 0) + 1;
  }

  const modelTally = {};
  for (const l of logs) if (l.model) modelTally[l.model] = (modelTally[l.model] || 0) + 1;

  const errTally = {};
  for (const l of logs) if (l.error) errTally[l.error] = (errTally[l.error] || 0) + 1;
  const topErrors = Object.entries(errTally).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.mint} />}
      >
        <View style={styles.headRow}>
          <Text style={styles.header}>Admin Dashboard</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshTxt}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Signed in as {currentUser?.email}</Text>

        {!!error && (
          <View style={styles.errBox}>
            <Text style={styles.errTxt}>{error}</Text>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {[
            ['overview', 'Overview'],
            ['users',    `Users (${usersTotal})`],
            ['logs',     `Gemini Requests (${callsTotal})`],
          ].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab === k && styles.tabTxtActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <View>
            <Text style={styles.section}>Users</Text>
            <View style={styles.kpiRow}>
              <Kpi styles={styles} label="Total users"          hint="All registered accounts"           value={usersTotal}    emoji="👥" />
              <Kpi styles={styles} label="Active today"         hint="Signed in in the last 24h"         value={usersToday}    emoji="🟢" />
              <Kpi styles={styles} label="Active last 7 days"   hint="Signed in in the last week"        value={usersActive7d} emoji="📅" />
            </View>

            <Text style={styles.section}>Gemini API usage</Text>
            <View style={styles.kpiRow}>
              <Kpi styles={styles} label="Total requests" hint="All Gemini API calls"      value={callsTotal}        emoji="🤖" />
              <Kpi styles={styles} label="Today"          hint="Calls since midnight"      value={callsToday}        emoji="📊" />
              <Kpi styles={styles} label="Success rate"   hint="Calls that returned data"  value={`${successRate}%`} emoji="✅" />
            </View>
            <View style={styles.kpiRow}>
              <Kpi styles={styles} label="Errors"         hint="Failed or unrecognized"    value={errorCalls}   emoji="⚠️" />
              <Kpi styles={styles} label="Image scans"    hint="Photo → nutrition"         value={scanCount}    emoji="📷" />
              <Kpi styles={styles} label="By name"        hint="Text → nutrition"          value={byNameCount}  emoji="✏️" />
            </View>

            <Text style={styles.section}>Response latency</Text>
            <Text style={styles.sectionHint}>Time between sending a request to Gemini and receiving the final answer.</Text>
            <View style={styles.kpiRow}>
              <Kpi styles={styles} label="Average"  hint="Mean round-trip"         value={fmtMs(avgLatencyMs)}  emoji="⏱️" />
              <Kpi styles={styles} label="Median"   hint="p50 — typical request"   value={fmtMs(p50LatencyMs)}  emoji="📈" />
              <Kpi styles={styles} label="p95"      hint="95% finish within this"  value={fmtMs(p95LatencyMs)}  emoji="🐢" />
            </View>

            <Text style={styles.section}>Token usage (cumulative)</Text>
            <View style={styles.kpiRow}>
              <Kpi styles={styles} label="Prompt tokens"     hint="Sum across all requests" value={totalTokensIn.toLocaleString()}  emoji="📥" />
              <Kpi styles={styles} label="Completion tokens" hint="Sum across all requests" value={totalTokensOut.toLocaleString()} emoji="📤" />
            </View>

            {Object.keys(modelTally).length > 0 && (
              <>
                <Text style={styles.section}>Models used</Text>
                <View style={styles.card}>
                  {Object.entries(modelTally).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
                    <View key={m} style={styles.row}>
                      <Text style={styles.rowLeft} numberOfLines={1}>{m}</Text>
                      <Text style={styles.rowRight}>{n} calls</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {topErrors.length > 0 && (
              <>
                <Text style={styles.section}>Top errors</Text>
                <View style={styles.card}>
                  {topErrors.map(([msg, n]) => (
                    <View key={msg} style={styles.row}>
                      <Text style={styles.rowLeftErr} numberOfLines={2}>{msg}</Text>
                      <Text style={styles.rowRight}>{n}×</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.section}>Most active users</Text>
            <View style={styles.card}>
              {Object.entries(callsByUid).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, n]) => {
                const u = users.find((x) => x.uid === uid);
                return (
                  <View key={uid} style={styles.row}>
                    <Text style={styles.rowLeft} numberOfLines={1}>{u?.email || uid}</Text>
                    <Text style={styles.rowRight}>{n} requests</Text>
                  </View>
                );
              })}
              {Object.keys(callsByUid).length === 0 && <Text style={styles.empty}>No usage yet.</Text>}
            </View>
          </View>
        )}

        {/* ── USERS ────────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <View>
            {users.length === 0 && <Text style={styles.empty}>No users registered yet.</Text>}
            {users.map((u) => (
              <View key={u.uid} style={styles.userCard}>
                <View style={styles.userHead}>
                  <Text style={styles.userEmail} numberOfLines={1}>{u.email || '—'}</Text>
                  <Text style={styles.userProvider}>
                    {u.provider === 'google' ? '🟢 Google' : u.provider === 'email' ? '✉️ Email' : (u.provider || '—')}
                  </Text>
                </View>
                <Text style={styles.userName}>{u.name || '(no name)'}</Text>
                <View style={styles.userMeta}>
                  <MetaRow styles={styles} label="Registered"     value={fmtAbs(u.createdAt)} />
                  <MetaRow styles={styles} label="Last seen"      value={`${fmtRel(u.lastLoginAt)}  ·  ${fmtAbs(u.lastLoginAt)}`} />
                  <MetaRow styles={styles} label="Logins"         value={String(u.loginCount || 1)} />
                  <MetaRow styles={styles} label="Gemini requests" value={String(callsByUid[u.uid] || 0)} />
                  <MetaRow styles={styles} label="UID"            value={u.uid} mono />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── REQUESTS ─────────────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <View>
            {logs.length === 0 && <Text style={styles.empty}>No Gemini requests yet.</Text>}
            {logs.map((l) => {
              const isExp = !!expanded[l.id];
              return (
                <TouchableOpacity key={l.id} activeOpacity={0.8} onPress={() => toggle(l.id)}
                                  style={[styles.logCard, l.error && styles.logCardError]}>
                  <View style={styles.logHead}>
                    <Text style={styles.logType}>
                      {l.type === 'scan' ? '📷 Image scan' : l.type === 'byName' ? '✏️ By name' : l.type}
                    </Text>
                    <Text style={styles.logTime}>{fmtRel(l.ts)}</Text>
                  </View>

                  <Text style={styles.logEmail} numberOfLines={1}>{l.email || l.uid || 'anonymous'}</Text>

                  {/* Primary request info */}
                  <View style={styles.logGrid}>
                    <LogField styles={styles} k="Input"       v={l.input || '—'} />
                    <LogField styles={styles} k="Model"       v={l.model || '(none — failed)'} />
                    <LogField styles={styles} k="Duration"    v={fmtMs(l.durationMs)} />
                    <LogField styles={styles} k="Attempts"    v={l.attempts != null ? String(l.attempts) : '—'} />
                  </View>

                  {l.error ? (
                    <Text style={styles.logError} numberOfLines={isExp ? undefined : 2}>⚠ {l.error}</Text>
                  ) : (
                    <Text style={styles.logDesc} numberOfLines={isExp ? undefined : 2}>
                      Result: {l.description || '—'}
                    </Text>
                  )}

                  {!l.error && l.calories != null && (
                    <Text style={styles.logNutri}>
                      {l.calories} kcal · {l.proteinG}g protein · {l.carbsG}g carbs · {l.fatG}g fat
                      {l.confidence != null ? `  ·  confidence ${(l.confidence * 100).toFixed(0)}%` : ''}
                    </Text>
                  )}

                  {isExp && (
                    <View style={styles.logExpand}>
                      <LogField styles={styles} k="Time"             v={fmtAbs(l.ts)} />
                      <LogField styles={styles} k="UID"              v={l.uid || '—'} mono />
                      {l.imageSizeKB   != null && <LogField styles={styles} k="Image size"      v={`${l.imageSizeKB} KB`} />}
                      {l.promptChars   != null && <LogField styles={styles} k="Prompt length"   v={`${l.promptChars} chars`} />}
                      {l.responseChars != null && <LogField styles={styles} k="Response length" v={`${l.responseChars} chars`} />}
                      {l.tokensIn      != null && <LogField styles={styles} k="Prompt tokens"   v={String(l.tokensIn)} />}
                      {l.tokensOut     != null && <LogField styles={styles} k="Output tokens"   v={String(l.tokensOut)} />}
                      {!!l.responsePreview && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={styles.fieldK}>Raw response (first 300 chars)</Text>
                          <Text style={styles.rawBlock}>{l.responsePreview}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={styles.expandHint}>{isExp ? '▲ tap to collapse' : '▼ tap to expand'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ styles, label, hint, value, emoji }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiEmoji}>{emoji}</Text>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {!!hint && <Text style={styles.kpiHint} numberOfLines={2}>{hint}</Text>}
    </View>
  );
}

function MetaRow({ styles, label, value, mono }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaK}>{label}</Text>
      <Text style={[styles.metaV, mono && styles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function LogField({ styles, k, v, mono }) {
  return (
    <View style={styles.logField}>
      <Text style={styles.fieldK}>{k}</Text>
      <Text style={[styles.fieldV, mono && styles.mono]} numberOfLines={1}>{v}</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    header: { fontSize: 26, fontWeight: '800', color: c.text },
    sub:    { fontSize: 13, color: c.textMuted, marginBottom: 16, marginTop: 2 },
    refreshBtn: { backgroundColor: c.toggleTrack, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    refreshTxt: { color: c.mint, fontSize: 13, fontWeight: '700' },

    tabs:       { flexDirection: 'row', backgroundColor: c.toggleTrack, borderRadius: 14, padding: 4, marginBottom: 16 },
    tab:        { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    tabActive:  { backgroundColor: c.toggleActive },
    tabTxt:     { fontSize: 13, fontWeight: '600', color: c.textMuted },
    tabTxtActive: { color: c.mint },

    section:     { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 18, marginBottom: 6 },
    sectionHint: { fontSize: 12, color: c.textMuted, marginBottom: 10 },

    kpiRow:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
    kpi:      { flex: 1, backgroundColor: c.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    kpiEmoji: { fontSize: 22, marginBottom: 4 },
    kpiValue: { fontSize: 20, fontWeight: '800', color: c.mint },
    kpiLabel: { fontSize: 12, color: c.text, marginTop: 4, fontWeight: '600', textAlign: 'center' },
    kpiHint:  { fontSize: 10, color: c.textMuted, marginTop: 2, textAlign: 'center' },

    card: { backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 6 },
    row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border, gap: 10 },
    rowLeft:    { flex: 1, fontSize: 13, color: c.text },
    rowLeftErr: { flex: 1, fontSize: 12, color: c.errorText || '#E53935' },
    rowRight:   { fontSize: 13, fontWeight: '700', color: c.mint },

    userCard: { backgroundColor: c.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
    userHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    userEmail:    { fontSize: 15, fontWeight: '700', color: c.text, flex: 1 },
    userProvider: { fontSize: 12, color: c.textMuted, marginLeft: 8 },
    userName:     { fontSize: 13, color: c.textSec, marginTop: 4 },
    userMeta:     { marginTop: 10, gap: 4 },
    metaRow:      { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    metaK:        { fontSize: 12, color: c.textMuted },
    metaV:        { fontSize: 12, color: c.text, flex: 1, textAlign: 'right' },
    mono:         { fontFamily: 'monospace', fontSize: 11 },

    logCard:      { backgroundColor: c.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.border, marginBottom: 8 },
    logCardError: { borderColor: c.errorBorder || '#E53935', borderWidth: 1.5 },
    logHead:      { flexDirection: 'row', justifyContent: 'space-between' },
    logType:      { fontSize: 13, fontWeight: '700', color: c.mint },
    logTime:      { fontSize: 12, color: c.textMuted },
    logEmail:     { fontSize: 12, color: c.textSec, marginTop: 2, fontWeight: '600' },
    logGrid:      { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
    logField:     { flexBasis: '48%', backgroundColor: c.bg, padding: 6, borderRadius: 8 },
    fieldK:       { fontSize: 10, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldV:       { fontSize: 12, color: c.text, marginTop: 2 },
    logDesc:      { fontSize: 13, color: c.text, marginTop: 8 },
    logNutri:     { fontSize: 12, color: c.textMuted, marginTop: 4 },
    logError:     { fontSize: 12, color: c.errorText || '#E53935', marginTop: 8, fontWeight: '600' },
    logExpand:    { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 6 },
    rawBlock:     { fontFamily: 'monospace', fontSize: 10, color: c.text, backgroundColor: c.bg, padding: 8, borderRadius: 6, marginTop: 4 },
    expandHint:   { fontSize: 10, color: c.textMuted, marginTop: 8, textAlign: 'center' },

    empty: { textAlign: 'center', color: c.textMuted, padding: 20 },

    errBox: { backgroundColor: c.errorBg || '#ffeaea', padding: 12, borderRadius: 12, marginBottom: 12 },
    errTxt: { color: c.errorText || '#E53935' },

    denied:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    deniedEmoji: { fontSize: 64, marginBottom: 12 },
    deniedTitle: { fontSize: 22, fontWeight: '800', color: c.text },
    deniedText:  { fontSize: 14, color: c.textMuted, marginTop: 6, textAlign: 'center' },
  });
}
