import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Pressable } from 'react-native';

// THE LOG (2026-09-20), rebuilt from Ruth's navigation brief: "Some users don't
// want to chat every time they drink water or weigh themselves. This screen is
// for rapid logging."
//
// It was a switch across three things - food, activity, measurements - which
// made those three the whole idea of logging and left water, sleep and symptoms
// with no home but the conversation. Now it lists what can be recorded, and
// each row goes straight to the quickest way to record it.
//
// WHAT IS NOT ON THE LIST. Medication and mood are in her mock-up and she took
// them out ("Leave out medication and mood. Add sleep."). Nothing else was
// invented to fill the space: a row that opened a screen with no table behind
// it would be the same broken promise as a switch that changes nothing.
//
// SYMPTOMS AND PHOTOS GO TO CHAT ON PURPOSE. A symptom is a sentence - where,
// when, how it feels - and a form would flatten it into fields; a photo needs
// the conversation to say what it is of. Both rows say where they are taking
// you rather than pretending to be a form.

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  go: () => void;
};

const ROWS: Row[] = [
  {
    icon: 'restaurant-outline',
    label: 'Food and drink',
    detail: "Today's meals, and the week behind them",
    go: () => router.push('/log/entries?view=food'),
  },
  {
    icon: 'water-outline',
    label: 'Water',
    detail: 'A glass, a mug, a bottle',
    go: () => router.push('/log/water-history'),
  },
  {
    icon: 'moon-outline',
    label: 'Sleep',
    detail: 'How long, and how it felt',
    go: () => router.push('/log/sleep'),
  },
  {
    icon: 'body-outline',
    label: 'Body measurements',
    detail: 'Weight, body fat, muscle, and the rest',
    go: () => router.push('/log/entries?view=measurements'),
  },
  {
    icon: 'walk-outline',
    label: 'Activity',
    detail: 'Sessions, classes, walks',
    go: () => router.push('/log/entries?view=activity'),
  },
  {
    icon: 'pulse-outline',
    label: 'A symptom',
    detail: 'Described in chat, where it can be asked about',
    go: () =>
      router.push({
        pathname: '/',
        params: { prefill: "I've noticed " },
      }),
  },
  {
    icon: 'camera-outline',
    label: 'A photo',
    detail: 'A meal, a label or a scale reading, read in chat',
    go: () => router.push('/'),
  },
];

export default function LogScreen() {
  const theme = useTheme();
  return (
    <BodyScreen>
      <ThemedText type="display">Log</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        Quickly record what&apos;s relevant to you. Anything here can be said in chat instead.
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        {ROWS.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={r.go}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}. ${r.detail}`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View
              style={[
                styles.row,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected },
              ]}
            >
              <Ionicons name={r.icon} size={20} color={theme.textSecondary} />
              <View style={styles.text}>
                <ThemedText type="smallBold">{r.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.detail}>
                  {r.detail}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </View>
          </Pressable>
        ))}
      </ThemedView>
    </BodyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { lineHeight: 20, maxWidth: 300 },
  card: { borderRadius: CardRadius, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  text: { flex: 1, gap: 2 },
  detail: { lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
