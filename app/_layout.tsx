import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { GameProvider } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: tokens.accentGold,
      background: tokens.bgPrimary,
      card: tokens.bgSurface,
      text: tokens.textPrimary,
      border: tokens.border,
      notification: tokens.accentRed,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <GameProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </GameProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
