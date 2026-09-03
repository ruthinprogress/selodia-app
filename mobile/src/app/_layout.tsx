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
  // The brand face has to be in memory before anything the person SEES is
  // drawn, or the first paint is the system font and every heading reflows a
  // moment later.
  //
  // The way that is achieved matters. This returned null until the font landed,
  // which also meant the Stack below never mounted - and expo-router's linking
  // begins resolving the initial URL as soon as the root layout renders, then
  // sets state on a navigator that does not exist yet. That is the "state
  // update on a component that hasn't mounted" warning, pointing at
  // useLinking.native.js because that is where it surfaced, not where it came
  // from.
  //
  // So the navigator always mounts. What waits is the SPLASH: hideAsync lives
  // inside AnimatedSplashOverlay's onLayout, so not mounting the overlay until
  // the font is ready keeps the native splash up, covering the screens
  // rendering behind it. Same no-reflow guarantee, without unmounting the
  // router to get it.
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
      {/* Mounted only once the font is in memory - see above. Until then the
          native splash is still covering everything. */}
      {fontsLoaded ? <AnimatedSplashOverlay /> : null}
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
