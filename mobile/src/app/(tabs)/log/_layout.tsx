import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { ThreeSeedsMark } from '@/components/seed-marks';

import { BodyFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The Log tab is a stack whose root holds the three views (Food, Activity,
// Measurements) behind a switch, with the two browsable week logs one level in.
//
// Same reasoning the Body stack was built on and worth keeping: pressing the Log
// tab while inside a week log pops back to the switch, which is what a thumb
// already expects. The root carries no header - the tab and the switch together
// already say where you are - and the two logs get one, because arriving
// somewhere deserves a name and a way back that is not a tab press.
export default function LogLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text, fontFamily: BodyFont.semibold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* NO HEADER TITLE ON ANY SCREEN ONE LEVEL IN (Ruth, 25 September
          2026): "Remove the titles on the back buttons ... they don't make
          any sense. Arrow is sufficient and could be more beautiful." Each
          screen now names itself in the display face instead, through
          BodyScreen's title prop, which is how the tabs have always done it.

          RENDERED AS () => null RATHER THAN AN EMPTY STRING. The note below
          records what happens when a title is simply missing - the route name
          leaks, and a screenshot once read "water-history". An empty string is
          falsy, so a component that draws nothing is the unambiguous way to
          say nothing. */}
      {/* THE MARK GOES IN THE HEADER ON THIS ONE (24 September 2026). Her
          redesign puts it top right, level with the title - and on a screen
          that HAS a stack header, the in-content link lands underneath it,
          floating in the gap above the week bar. The header is where a
          top-right control belongs when there is a header. */}
      <Stack.Screen
        name="food-history"
        options={{
          headerTitle: () => null,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="More"
              hitSlop={12}
            >
              <ThreeSeedsMark size={22} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="activity-history" options={{ headerTitle: () => null }} />
      <Stack.Screen name="water-history" options={{ headerTitle: () => null }} />
      <Stack.Screen name="entries" options={{ headerTitle: () => null }} />
      <Stack.Screen name="sleep" options={{ headerTitle: () => null }} />
      <Stack.Screen name="cycle" options={{ headerTitle: () => null }} />
      <Stack.Screen name="feeling" options={{ headerTitle: () => null }} />
    </Stack>
  );
}
