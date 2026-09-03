import {
  Comfortaa_400Regular,
  Comfortaa_500Medium,
  Comfortaa_600SemiBold,
  Comfortaa_700Bold,
  useFonts,
} from '@expo-google-fonts/comfortaa';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SpotlightOverlay } from '@/components/spotlight-overlay';
import { SpotlightProvider } from '@/components/spotlight-provider';
import { useAuthGuard } from '@/hooks/use-auth-guard';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // The brand face has to be in memory before anything draws, or the first
  // paint is the system font and every heading visibly reflows a moment later.
  // Nothing renders until it is: SplashScreen.preventAutoHideAsync above holds
  // the splash, and AnimatedSplashOverlay - which is what finally hides it -
  // does not mount until this returns real children.
  const [fontsLoaded] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
  });

  // Auth-state listener + route guard (step 6): gates (tabs) behind a session
  // and resumes an unfinished user at their onboarding step. Called before the
  // early return, because a hook cannot sit behind a condition.
  useAuthGuard();

  if (!fontsLoaded) return null;

  // DefaultTheme unconditionally: the app is light-only from 2026-09-03, and
  // handing react-navigation DarkTheme while every screen paints cream would
  // give dark chrome around a light app. See use-theme.ts for the reasoning.
  return (
    <ThemeProvider value={DefaultTheme}>
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
