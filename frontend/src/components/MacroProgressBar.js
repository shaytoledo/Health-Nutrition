/**
 * components/MacroProgressBar.js — macro progress bar row
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../context/ThemeContext';

export default function MacroProgressBar({
  label, consumed = 0, target = 1, unit = 'גר׳', color = '#00F5C4', showBar = true, showValues = true,
}) {
  const c = useThemeColors();
  const safeTarget = target > 0 ? target : 1;
  const progress = Math.min(1, consumed / safeTarget);
  const percentage = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      {showValues && (
        <View style={styles.labelRow}>
          <Text style={styles.values}>
            <Text style={[styles.consumed, { color }]}>{consumed}</Text>
            <Text style={[styles.separator, { color: c.textMuted }]}> / </Text>
            <Text style={[styles.target, { color: c.textMuted }]}>{target} {unit}</Text>
          </Text>
          <Text style={[styles.label, { color: c.textSec }]}>{label}</Text>
        </View>
      )}
      {showBar && (
        <View style={[styles.track, { backgroundColor: c.track }]}>
          <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: color, opacity: progress > 1 ? 0.6 : 1 }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  values: { fontSize: 13 },
  consumed: { fontWeight: '800' },
  separator: {},
  target: { fontWeight: '400' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, minWidth: 4 },
});
