/**
 * AuthScreen.js — Login / Register (Hebrew RTL)
 *
 * Google sign-in strategy:
 *  - Firebase enabled → signInWithPopup via authService (Firebase UID, works with Firestore)
 *  - Firebase disabled → @react-oauth/google (localStorage demo mode)
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { registerWithEmail, signInWithEmail, signInWithGoogle } from '../services/authService';
import { FIREBASE_ENABLED } from '../config/firebaseConfig';
import { useThemeColors } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

// Load @react-oauth/google only in demo mode (no Firebase)
let useGoogleLogin = null;
if (Platform.OS === 'web' && !FIREBASE_ENABLED) {
  try { ({ useGoogleLogin } = require('@react-oauth/google')); } catch {}
}

export default function AuthScreen({ onAuthSuccess }) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [mode, setMode]         = useState('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isRegister = mode === 'register';

  // Demo-mode Google login (@react-oauth/google)
  const demoGoogleLogin = useGoogleLogin
    ? useGoogleLogin({
        onSuccess: async (tokenResponse) => {
          setLoading(true);
          setError('');
          try {
            const info = await fetch(
              'https://www.googleapis.com/oauth2/v3/userinfo',
              { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
            ).then((r) => r.json());
            const session = { uid: 'google_' + info.sub, name: info.name || info.email, email: info.email, provider: 'google' };
            try { localStorage.setItem('auth_session', JSON.stringify(session)); } catch {}
            onAuthSuccess(session);
          } catch {
            setError('שגיאה בהתחברות עם גוגל. נסה שנית.');
          } finally {
            setLoading(false);
          }
        },
        onError: () => { setError('שגיאה בהתחברות עם גוגל.'); setLoading(false); },
      })
    : null;

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const session = isRegister
        ? await registerWithEmail(name, email, password)
        : await signInWithEmail(email, password);
      onAuthSuccess(session);
    } catch (e) {
      setError(e.message || 'אירעה שגיאה. נסה שנית.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleClick() {
    setError('');
    setLoading(true);

    // Firebase mode: use signInWithPopup → real Firebase UID → Firestore works
    if (FIREBASE_ENABLED) {
      try {
        const session = await signInWithGoogle();
        onAuthSuccess(session);
      } catch (e) {
        // Show real Firebase error code to help diagnose
        setError('Google error: ' + (e?.code || e?.message || String(e)));
        setLoading(false);
      }
      return;
    }

    // Demo mode: use @react-oauth/google
    if (demoGoogleLogin) {
      demoGoogleLogin();
    } else {
      setError('Google Sign-In requires GOOGLE_CLIENT_ID in src/config/appConfig.js');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={{ alignSelf: 'flex-end', marginTop: 10, marginRight: 20 }}>
          <ThemeToggle />
        </View>

        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🥗</Text>
          <Text style={styles.appName}>NutriTrack</Text>
          <Text style={styles.tagline}>מעקב תזונה חכם</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.toggle}>
            {['login', 'register'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.toggleBtn, mode === m && styles.toggleActive]}
                onPress={() => { setMode(m); setError(''); }}
              >
                <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                  {m === 'login' ? 'התחברות' : 'הרשמה'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleClick} disabled={loading}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleText}>המשך עם Google</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>או</Text>
            <View style={styles.dividerLine} />
          </View>

          {isRegister && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>שם מלא</Text>
              <TextInput style={styles.input} placeholder="הכנס שם מלא" placeholderTextColor={c.placeholder}
                value={name} onChangeText={setName} textAlign="right" autoCapitalize="words" />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>אימייל</Text>
            <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor={c.placeholder}
              value={email} onChangeText={setEmail} textAlign="right" keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>סיסמה</Text>
            <View style={styles.passwordRow}>
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
              <TextInput style={[styles.input, styles.passwordInput]} placeholder="לפחות 6 תווים"
                placeholderTextColor={c.placeholder} value={password} onChangeText={setPassword}
                textAlign="right" secureTextEntry={!showPassword} />
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color={c.mintText} />
              : <Text style={styles.submitText}>{isRegister ? 'צור חשבון' : 'התחבר'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchRow} onPress={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}>
            <Text style={styles.switchText}>
              {isRegister ? 'כבר יש לך חשבון? ' : 'אין לך חשבון? '}
              <Text style={styles.switchLink}>{isRegister ? 'התחבר' : 'הירשם'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root:   { flex: 1, backgroundColor: c.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logoBox:   { alignItems: 'center', marginBottom: 40 },
    logoEmoji: { fontSize: 64, marginBottom: 12 },
    appName:   { fontSize: 34, fontWeight: '800', color: c.mint },
    tagline:   { fontSize: 15, color: c.textMuted, marginTop: 6 },
    card: { backgroundColor: c.surface, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: c.border },
    toggle: { flexDirection: 'row', backgroundColor: c.toggleTrack, borderRadius: 14, padding: 4, marginBottom: 24 },
    toggleBtn:        { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    toggleActive:     { backgroundColor: c.toggleActive },
    toggleText:       { fontSize: 15, fontWeight: '600', color: c.textMuted },
    toggleTextActive: { color: c.mint },
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border2, borderRadius: 14, paddingVertical: 14, marginBottom: 20, gap: 10, backgroundColor: c.inputBg },
    googleIcon: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
    googleText: { fontSize: 15, fontWeight: '600', color: c.text },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dividerLine:{ flex: 1, height: 1, backgroundColor: c.border },
    dividerText:{ marginHorizontal: 12, color: c.textMuted, fontSize: 13 },
    fieldGroup: { marginBottom: 16 },
    label:      { fontSize: 13, fontWeight: '600', color: c.textSec, marginBottom: 8, textAlign: 'right' },
    input: { borderWidth: 1, borderColor: c.inputBorder, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: c.text, backgroundColor: c.inputBg, textAlign: 'right' },
    passwordRow:  { flexDirection: 'row', alignItems: 'center' },
    passwordInput:{ flex: 1 },
    eyeBtn:       { paddingHorizontal: 12, paddingVertical: 14 },
    eyeIcon:      { fontSize: 18 },
    errorBox:  { backgroundColor: c.errorBg, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: c.errorBorder },
    errorText: { color: c.errorText, fontSize: 14, textAlign: 'right' },
    submitBtn:         { backgroundColor: c.mint, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
    submitBtnDisabled: { opacity: 0.5 },
    submitText:        { color: c.mintText, fontSize: 16, fontWeight: '800' },
    switchRow: { alignItems: 'center' },
    switchText:{ fontSize: 14, color: c.textMuted },
    switchLink:{ color: c.mint, fontWeight: '700' },
  });
}
