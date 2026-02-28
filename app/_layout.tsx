import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { GameProvider } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Italic: PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary:      tokens.ctaBlue,
      background:   tokens.bgPrimary,
      card:         tokens.bgSurface,
      text:         tokens.textPrimary,
      border:       tokens.borderDefault,
      notification: tokens.accentRed,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <GameProvider>
        <Stack>
          <Stack.Screen name="(tabs)"        options={{ headerShown: false }} />
          <Stack.Screen name="project/[id]"  options={{ title: 'Project Detail' }} />
          <Stack.Screen name="modal"         options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </GameProvider>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
