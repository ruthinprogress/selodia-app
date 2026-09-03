import { Stack } from 'expo-router';

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
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="food" options={{ title: 'Food' }} />
      <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
      <Stack.Screen name="activity" options={{ title: 'Activity' }} />
    </Stack>
  );
}
