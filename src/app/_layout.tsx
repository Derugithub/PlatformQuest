import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AdsProvider } from '@/lib/ads/ads-provider';
import { GameDataProvider, useGameData } from '@/lib/game-data';
import { COLORS } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(COLORS.sky).catch(() => undefined);
  }, []);
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GameDataProvider>
          <AdsProvider>
            <Shell>
              <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="map" />
                <Stack.Screen name="play" options={{ gestureEnabled: false, animation: 'fade' }} />
                <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
              </Stack>
            </Shell>
          </AdsProvider>
        </GameDataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Hides the splash once saved data is loaded. The game is always light and bright. */
function Shell({ children }: { children: ReactNode }) {
  const { loaded } = useGameData();
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: COLORS.sky } }}>
      <StatusBar style="dark" hidden />
      {children}
    </ThemeProvider>
  );
}
