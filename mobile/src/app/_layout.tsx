import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SpotlightOverlay } from '@/components/spotlight-overlay';
import { SpotlightProvider } from '@/components/spotlight-provider';
import { useAuthGuard } from '@/hooks/use-auth-guard';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Auth-state listener + route guard (step 6): gates (tabs) behind a session
  // and resumes an unfinished user at their onboarding step.
  useAuthGuard();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* The spotlight provider wraps the whole Stack, not a single screen
          (build item 23). A request made in Chat has to survive the navigation
          to Settings so the destination can highlight on arrival - state living
          inside either screen would be destroyed by the very move it exists to
          follow. */}
      <SpotlightProvider>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        {/* Settings is pushed OVER the tabs rather than being a fourth one:
            Part Five keeps the app to three top-level destinations, and an
            account surface is not a destination someone visits to use the app. */}
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Last, so its Modal sits above every screen the Stack renders. */}
      <SpotlightOverlay />
      </SpotlightProvider>
    </ThemeProvider>
  );
}
