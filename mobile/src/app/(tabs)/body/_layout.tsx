import { Stack } from 'expo-router';

import { BrandFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The Body tab is a stack, not a switcher (2026-09-03).
//
// It was one screen holding four views in local state, with a row of segment
// pills across the top to move between them. The row did not fit a phone at
// "Measurements" length and had to scroll sideways, which is how "Activity"
// spent a while clipped off the right edge and looking unbuilt.
//
// Real routes buy the thing local state could not: pressing the Body tab while
// already inside a detail screen pops back to Overview, which is what every
// other app on the phone does and therefore what a thumb already expects. There
// is nothing to implement for that - it is what a Stack inside a tab does.
//
// Overview carries no header. It is the landing, and a screen labelled
// "Overview" above a page that is self-evidently the overview is a label
// explaining itself. The three detail screens do get one, because arriving
// somewhere deserves a name and a way back that is not a tab press.
export default function BodyLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text, fontFamily: BrandFont.semibold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
        // Swipe from the left edge to go back to the summary, the same place
        // pressing the Body tab lands. iOS only: this is a UIKit gesture, and
        // the native stack has no Android equivalent. Android's own back
        // gesture is the counterpart there, and app.json currently sets
        // predictiveBackGestureEnabled false - see the report.
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="food" options={{ title: 'Food' }} />
      <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
      <Stack.Screen name="activity" options={{ title: 'Activity' }} />
      {/* One screen for all six dimensions. No title: the screen is a full
          bleed of that dimension's own colour with its name set large inside,
          so a header would say the same word twice in two type sizes. The back
          affordance is the swipe and the tab press, as everywhere else here. */}
      <Stack.Screen name="[dimension]" options={{ headerTitle: '', headerTransparent: true }} />
    </Stack>
  );
}
