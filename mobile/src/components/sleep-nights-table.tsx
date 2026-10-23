import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { QualityPill } from '@/components/sleep-quality-pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { durationForDisplay, type SleepNight } from '@/lib/sleep';

// RECENT NIGHTS, AS A TABLE (Ruth's artwork, 23 October 2026).
//
// It was a stack of separate sand cards with a delete cross on each. Her
// drawing makes it one card with hairline-separated rows: date, how long, how
// it felt, and a chevron.
//
// THE CROSS BECAME A CHEVRON, and that is a change of meaning rather than of
// icon. A cross says the only thing you can do to a night is destroy it. A
// chevron says there is something behind it - which there is, and removing a
// night belongs in there with everything else about it, not on the surface
// where a thumb finds it first. It also matches every other list in the app.
//
// HOW LONG IS SHOWN AS IT WAS KNOWN. A night a watch measured reads "7h 46m".
// A night she estimated reads "7-8h", because that is what she told it - see
// durationForDisplay. Printing "7h 30m" for a tapped band would be the app
// adding a precision to her own report.

export function SleepNightsTable({
  nights,
  onOpen,
}: {
  nights: SleepNight[];
  onOpen: (night: SleepNight) => void;
}) {
  const theme = useTheme();
  if (nights.length === 0) return null;

  return (
    <ThemedView type="background" style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      {nights.map((night, i) => (
        <Pressable
          key={night.id}
          onPress={() => onOpen(night)}
          accessibilityRole="button"
          accessibilityLabel={`${dateLabel(night.night_of)}, open this night`}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="small" style={styles.date}>
            {dateLabel(night.night_of)}
          </ThemedText>

          <ThemedText type="small" style={styles.duration}>
            {durationForDisplay(night.duration_min, night.source) ?? ''}
          </ThemedText>

          <View style={styles.pill}>
            {night.quality ? <QualityPill quality={night.quality} /> : null}
          </View>

          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </Pressable>
      ))}
    </ThemedView>
  );
}

/** "22 Oct", "27 Sept" - as her artwork writes them. */
function dateLabel(nightOf: string): string {
  const [y, m, d] = nightOf.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (Number.isNaN(date.getTime())) return nightOf;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  date: { width: 72, flexShrink: 0 },
  duration: { flex: 1, minWidth: 0 },
  // A FIXED COLUMN so the pills line up down the table rather than floating at
  // whatever width each word happens to be. "Broken" and "OK" are very
  // different lengths and a ragged edge is what makes a list look unmade.
  pill: { width: 86, alignItems: 'flex-start' },
  pressed: { opacity: 0.6 },
});
