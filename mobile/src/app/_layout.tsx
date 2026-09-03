import {
  Comfortaa_400Regular,
  Comfortaa_500Medium,
  Comfortaa_600SemiBold,
  Comfortaa_700Bold,
  useFonts,
} from '@expo-google-fonts/comfortaa';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SpotlightOverlay } from '@/components/spotlight-overlay';
import { SpotlightProvider } from '@/components/spotlight-provider';
import { Colors } from '@/constants/theme';
import { useAuthGuard } from '@/hooks/use-auth-guard';

SplashScreen.preventAutoHideAsync();

// react-navigation's DefaultTheme paints its background rgb(242,242,242) and its
// cards white. Neither is in the palette, and both showed: every screen that did
// not paint its own ground sat on a flat grey, which is why the app read as grey
// rather than cream however warm the cards on top of it were. The Body stack had
// been setting contentStyle since it was built and was the one part that looked
// right, which is what made the rest look wrong rather than intentional.
//
// Built by spreading DefaultTheme rather than hand-writing a theme object, so a
// key react-navigation adds later still arrives with a sane default. Every
// colour comes from the palette; nothing here names one.
const BrandNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.backgroundSelected,
    primary: Colors.light.accentDeep,
    notification: Colors.light.danger,
  },
};

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

  // Light unconditionally: the app is light-only from 2026-09-03, and handing
  // react-navigation a dark theme while every screen paints cream would give
  // dark chrome around a light app. See use-theme.ts for the reasoning.
  return (
    <ThemeProvider value={BrandNavigationTheme}>
      {/* Above the spotlight provider and the Stack, because it has to be above
          every screen that has a text input in it - which is Chat, the sign-in
          form, and all nine onboarding steps.

          This is the fix for the keyboard covering the input, which the
          three-line automaticallyAdjustKeyboardInsets change on 2026-09-01 only
          half solved. That worked on account.tsx because ConversationLayout had
          already padded the view clear; it could not work anywhere the shell had
          not. This handles the insets itself rather than depending on what a
          screen's wrapper happens to do.

          Android translucency props are left at their defaults. Turning them on
          without an edge-to-edge layout to match shifts every screen up by the
          status bar height, and nothing here asks for that. */}
      <KeyboardProvider>
      {/* The spotlight provider wraps the whole Stack, not a single screen
          (build item 23). A request made in Chat has to survive the navigation
          to Settings so the destination can highlight on arrival - state living
          inside either screen would be destroyed by the very move it exists to
          follow. */}
      <SpotlightProvider>
      {/* Mounted only once the font is in memory - see above. Until then the
          native splash is still covering everything. */}
      {fontsLoaded ? <AnimatedSplashOverlay /> : null}
      {/* contentStyle as well as the theme: the theme covers what
          react-navigation itself draws, and this covers the screen area behind
          a route that has not painted its own ground yet. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.light.background },
        }}
      >
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
      </KeyboardProvider>
    </ThemeProvider>
  );
}
