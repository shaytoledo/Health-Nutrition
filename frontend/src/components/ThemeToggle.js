/**
 * components/ThemeToggle.js — animated dark/light switch pill
 * Self-contained: reads theme from ThemeContext and toggles it.
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ style }) {
  const { colors: c, isDark, toggleTheme } = useTheme();
  const anim = useRef(new Animated.Value(isDark ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isDark ? 0 : 1,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  }, [isDark]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['#3A3F4B', '#00C9A7'] });

  return (
    <TouchableOpacity onPress={toggleTheme} activeOpacity={0.85} style={[styles.wrap, style]}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
      <Text style={[styles.label, { color: c.textMuted }]}>
        {isDark ? 'כהה' : 'בהיר'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap:  { alignItems: 'center', gap: 5 },
  track: { width: 46, height: 26, borderRadius: 13, justifyContent: 'center' },
  thumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
