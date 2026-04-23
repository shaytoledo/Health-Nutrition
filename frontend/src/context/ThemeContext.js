/**
 * ThemeContext.js — Dark / Light theme system
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const DARK = {
  isDark: true,
  bg:           '#0D1117',
  surface:      '#161B22',
  surface2:     '#1C2333',
  mint:         '#00F5C4',
  mintDim:      'rgba(0,245,196,0.1)',
  mintBorder:   'rgba(0,245,196,0.3)',
  mintText:     '#0D1117',
  coral:        '#FF6B8A',
  orange:       '#FF9F6B',
  yellow:       '#FFD060',
  blue:         '#58A6FF',
  text:         '#E6EDF3',
  textSec:      'rgba(255,255,255,0.5)',
  textMuted:    'rgba(255,255,255,0.35)',
  border:       'rgba(255,255,255,0.06)',
  border2:      'rgba(255,255,255,0.1)',
  track:        'rgba(255,255,255,0.08)',
  inputBg:      'rgba(255,255,255,0.05)',
  inputBorder:  'rgba(255,255,255,0.1)',
  placeholder:  'rgba(255,255,255,0.3)',
  separator:    'rgba(255,255,255,0.05)',
  tabBg:        '#161B22',
  tabBorder:    'rgba(255,255,255,0.06)',
  errorBg:      'rgba(255,50,50,0.1)',
  errorBorder:  'rgba(255,100,100,0.2)',
  errorText:    '#FF6B8A',
  previewBg:    'rgba(0,245,196,0.08)',
  previewBorder:'rgba(0,245,196,0.15)',
  syncDisabled: 'rgba(0,245,196,0.25)',
  actRowBg:     '#161B22',
  actRowSel:    'rgba(0,245,196,0.05)',
  actRowBorder: 'rgba(255,255,255,0.08)',
  chipBg:       'rgba(255,255,255,0.03)',
  chipBorder:   'rgba(255,255,255,0.15)',
  chipSelBg:    'rgba(0,245,196,0.08)',
  toggleTrack:  'rgba(255,255,255,0.05)',
  toggleActive: 'rgba(255,255,255,0.08)',
  logoutBorder: 'rgba(255,100,100,0.4)',
  logoutBg:     'rgba(255,100,100,0.06)',
  logoutText:   '#FF6B8A',
  ringTrack:    'rgba(255,255,255,0.08)',
  mealBg:       '#161B22',
  mealBorder:   'rgba(255,255,255,0.06)',
  mealThumbBg:  'rgba(255,255,255,0.05)',
  mealTimeTxt:  'rgba(255,255,255,0.3)',
  mealDeleteTxt:'rgba(255,255,255,0.2)',
};

const LIGHT = {
  isDark: false,
  bg:           '#F5F7FA',
  surface:      '#FFFFFF',
  surface2:     '#EEF1F5',
  mint:         '#00C9A7',
  mintDim:      'rgba(0,201,167,0.1)',
  mintBorder:   'rgba(0,201,167,0.35)',
  mintText:     '#FFFFFF',
  coral:        '#FF4D7A',
  orange:       '#FF7A2F',
  yellow:       '#D97706',
  blue:         '#3B82F6',
  text:         '#1A1A2E',
  textSec:      '#6B7280',
  textMuted:    '#9CA3AF',
  border:       'rgba(0,0,0,0.07)',
  border2:      'rgba(0,0,0,0.1)',
  track:        'rgba(0,0,0,0.08)',
  inputBg:      '#F9FAFB',
  inputBorder:  'rgba(0,0,0,0.12)',
  placeholder:  '#9CA3AF',
  separator:    'rgba(0,0,0,0.06)',
  tabBg:        '#FFFFFF',
  tabBorder:    'rgba(0,0,0,0.07)',
  errorBg:      'rgba(229,57,53,0.06)',
  errorBorder:  'rgba(229,57,53,0.2)',
  errorText:    '#E53935',
  previewBg:    'rgba(0,201,167,0.07)',
  previewBorder:'rgba(0,201,167,0.25)',
  syncDisabled: 'rgba(0,201,167,0.35)',
  actRowBg:     '#FFFFFF',
  actRowSel:    'rgba(0,201,167,0.05)',
  actRowBorder: 'rgba(0,0,0,0.08)',
  chipBg:       '#FFFFFF',
  chipBorder:   'rgba(0,0,0,0.15)',
  chipSelBg:    'rgba(0,201,167,0.08)',
  toggleTrack:  'rgba(0,0,0,0.06)',
  toggleActive: '#FFFFFF',
  logoutBorder: 'rgba(229,57,53,0.35)',
  logoutBg:     'rgba(229,57,53,0.05)',
  logoutText:   '#E53935',
  ringTrack:    'rgba(0,0,0,0.08)',
  mealBg:       '#FFFFFF',
  mealBorder:   'rgba(0,0,0,0.06)',
  mealThumbBg:  '#F5F7FA',
  mealTimeTxt:  '#9CA3AF',
  mealDeleteTxt:'#BDBDBD',
};

const ThemeContext = createContext({ colors: DARK, isDark: true, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const colors = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useThemeColors = () => useContext(ThemeContext).colors;
