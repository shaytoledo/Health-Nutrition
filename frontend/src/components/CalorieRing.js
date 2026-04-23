/**
 * components/CalorieRing.js — טבעת קלוריות SVG עגולה
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useThemeColors } from '../context/ThemeContext';

const SIZE = 200;
const STROKE_WIDTH = 16;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CalorieRing({ consumed = 0, target = 2000, progress = 0 }) {
  const c = useThemeColors();
  const clamped = Math.min(100, Math.max(0, progress));
  const strokeDashoffset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  const ringColor =
    clamped < 70 ? c.mint :
    clamped < 90 ? c.yellow :
                   c.coral;

  const remaining = Math.max(0, target - consumed);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          stroke={c.ringTrack} strokeWidth={STROKE_WIDTH} fill="none" />
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`} />
      </Svg>
      <View style={styles.textOverlay}>
        <Text style={[styles.consumedText, { color: ringColor }]}>
          {consumed.toLocaleString()}
        </Text>
        <Text style={[styles.unitText, { color: c.textMuted }]}>קק״ל</Text>
        <Text style={[styles.remainingText, { color: c.textSec }]}>
          {remaining > 0 ? `נותרו ${remaining.toLocaleString()}` : 'המטרה הושגה! 🎉'}
        </Text>
        <Text style={[styles.targetText, { color: c.textMuted }]}>מתוך {target.toLocaleString()}</Text>
      </View>
      <Text style={[styles.percentText, { color: c.textMuted }]}>{clamped}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 20 },
  textOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', paddingTop: 20,
  },
  consumedText: { fontSize: 36, fontWeight: '800', lineHeight: 40, letterSpacing: -1 },
  unitText: { fontSize: 13, marginTop: 2 },
  remainingText: { fontSize: 12, marginTop: 6, fontWeight: '500' },
  targetText: { fontSize: 11, marginTop: 1 },
  percentText: { fontSize: 13, fontWeight: '600', marginTop: -8 },
});
