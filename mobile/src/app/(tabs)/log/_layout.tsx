import { Stack } from 'expo-router';

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
      <Stack.Screen name="food-history" options={{ title: 'Food log' }} />
      <Stack.Screen name="activity-history" options={{ title: 'Activity log' }} />
    </Stack>
  );
}
