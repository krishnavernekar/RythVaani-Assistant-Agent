import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { useAppStore } from './src/store/useAppStore';
import { speak } from './src/utils/voice';

/**
 * RythuVaani (రైతువారి AI) — Root App Component
 *
 * Loads persisted Zustand state (language, farmer profile, etc.)
 * and renders the full navigation shell.
 */
export default function App() {
  const { language } = useAppStore();

  // Log language on mount for debugging
  useEffect(() => {
    console.log('[RythuVaani] App started, language:', language);
  }, [language]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
