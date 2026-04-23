/**
 * App.js — Root component, navigation, RTL setup
 */

import React from 'react';
import { I18nManager, View, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';

import { AppProvider, useApp } from './src/context/AppContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { GOOGLE_CLIENT_ID } from './src/config/appConfig';

import AuthScreen      from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import FoodScanScreen  from './src/screens/FoodScanScreen';
import GoalsScreen     from './src/screens/GoalsScreen';
import ProfileScreen   from './src/screens/ProfileScreen';

// Google OAuth provider — web only
let GoogleOAuthProvider = ({ children }) => children;
if (Platform.OS === 'web') {
  try {
    ({ GoogleOAuthProvider } = require('@react-oauth/google'));
  } catch {}
}

I18nManager.forceRTL(true);

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Dashboard', icon: '🏠' },
  { name: 'Scan',      icon: '📷' },
  { name: 'Goals',     icon: '🎯' },
  { name: 'Profile',   icon: '👤' },
];

const SCREENS = {
  Dashboard: DashboardScreen,
  Scan:      FoodScanScreen,
  Goals:     GoalsScreen,
  Profile:   ProfileScreen,
};

function MainApp() {
  const { currentUser, authReady, signIn } = useApp();
  const { colors, isDark } = useTheme();

  if (!authReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.mint} />
      </View>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={signIn} />;
  }

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => {
          const tab = TABS.find((t) => t.name === route.name);
          return {
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.35 }}>{tab?.icon}</Text>
            ),
            tabBarLabel: ({ focused }) => (
              <Text style={{
                fontSize: 11, fontWeight: focused ? '700' : '500',
                color: focused ? colors.mint : colors.textMuted,
                letterSpacing: 0.3,
              }}>
                {route.name}
              </Text>
            ),
            tabBarStyle: {
              backgroundColor: colors.tabBg,
              borderTopWidth: 1, borderTopColor: colors.tabBorder,
              height: 72, paddingTop: 8, paddingBottom: 10,
            },
            tabBarItemStyle: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 },
            headerShown: false,
          };
        }}
      >
        {TABS.map(({ name }) => (
          <Tab.Screen key={name} name={name} component={SCREENS[name]} />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            <MainApp />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GoogleOAuthProvider>
  );
}
