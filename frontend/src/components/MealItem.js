/**
 * components/MealItem.js — single meal row in the meals list
 */

import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../context/ThemeContext';

const SOURCE_COLORS = {
  ai_scan:     '#00F5C4',
  manual:      '#58A6FF',
  health_sync: '#FF9F6B',
};

const SOURCE_LABELS = {
  ai_scan:     'סריקת AI',
  manual:      'ידני',
  health_sync: 'HealthKit',
};

export default function MealItem({ meal, onDelete }) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const timeString = meal.timestamp
    ? new Date(meal.timestamp).toLocaleTimeString('he-IL', { hour: 'numeric', minute: '2-digit' })
    : '';

  const sourceColor = SOURCE_COLORS[meal.source] || c.textMuted;
  const sourceLabel = SOURCE_LABELS[meal.source] || meal.source;

  return (
    <View style={styles.container}>
      <View style={styles.thumbnail}>
        {meal.imageUrl
          ? <Image source={{ uri: meal.imageUrl }} style={styles.image} />
          : <Text style={styles.placeholderIcon}>🍽</Text>
        }
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.sourceBadge, { backgroundColor: sourceColor + '20', borderColor: sourceColor }]}>
            <Text style={[styles.sourceLabel, { color: sourceColor }]}>{sourceLabel}</Text>
          </View>
          <Text style={styles.description} numberOfLines={1} ellipsizeMode="tail">
            {meal.description}
          </Text>
        </View>

        <View style={styles.calRow}>
          <Text style={styles.time}>{timeString}</Text>
          <Text style={styles.calories}>{meal.calories} קק״ל</Text>
        </View>

        <View style={styles.macroRow}>
          <MacroPill label="ש" value={meal.fatG}     color="#00F5C4" c={c} />
          <MacroPill label="פ" value={meal.carbsG}   color="#FFD060" c={c} />
          <MacroPill label="ח" value={meal.proteinG} color="#FF6B8A" c={c} />
        </View>
      </View>

      <TouchableOpacity onPress={onDelete} style={styles.deleteButton} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Text style={styles.deleteIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function MacroPill({ label, value, color, c }) {
  return (
    <View style={[{ borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: color + '20' }]}>
      <Text style={[{ fontSize: 11, fontWeight: '600', color }]}>{label}: {value}גר׳</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.mealBg,
      borderRadius: 20, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: c.mealBorder,
    },
    thumbnail: {
      width: 56, height: 56, borderRadius: 14, backgroundColor: c.mealThumbBg,
      alignItems: 'center', justifyContent: 'center', marginLeft: 12, overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    placeholderIcon: { fontSize: 28 },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 2 },
    description: { fontSize: 14, fontWeight: '700', color: c.text, flex: 1, textAlign: 'right', marginLeft: 8 },
    sourceBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    sourceLabel: { fontSize: 10, fontWeight: '700' },
    calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    calories: { fontSize: 13, fontWeight: '700', color: c.orange },
    time: { fontSize: 11, color: c.mealTimeTxt },
    macroRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
    deleteButton: { marginRight: 8, padding: 4 },
    deleteIcon: { fontSize: 14, color: c.mealDeleteTxt },
  });
}
