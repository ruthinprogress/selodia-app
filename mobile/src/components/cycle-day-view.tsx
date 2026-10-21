import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/cycle-cards';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sentenceStart } from '@/lib/sentence-start';
import type { CycleDay } from '@/lib/cycle-day';

// A DAY, READ RATHER THAN FILLED IN - SCREEN 4 OF HER ARTWORK (21 October 2026).
//
// The day screen was a form and only a form. Opening a day from her history
// put her in front of twenty-five chips and six pickers, with what she had
// actually written that day scattered among them as selected states. Reading
// back "what did I log on the 24th?" meant decoding the form.
//
// Her drawing separates the two: the day as a RECORD, with one line per thing
// she said, and an "Edit this day" button that opens the form she already has.
//
// ONLY WHAT IS THERE. A section she left empty is not drawn at all - no "none",
// no "not recorded", no greyed-out placeholder. An empty day is a day she did
// not have anything to say about, and a column of "none" turns that into a
// column of failures to log.

export type FeelingSaid = { label: string; word: string };

export function CycleDayView({
  entry,
  said,
  onEdit,
}: {
  entry: CycleDay;
  /** Mood and energy, already turned into her words by daily-ratings. */
  said: FeelingSaid[];
  onEdit: () => void;
}) {
  const theme = useTheme();

  const flow = entry.flow;
  const symptoms = entry.symptoms ?? [];
  const ovulation = entry.ovulation ?? [];
  const notes = entry.notes?.trim();
  const nothing =
    !flow && symptoms.length === 0 && ovulation.length === 0 && !entry.mucus && !notes && said.length === 0;

  return (
    <View style={styles.wrap}>
      {flow && (
        <Card icon="water" title="Flow">
          <View style={styles.line}>
            <MaterialCommunityIcons
              name="water"
              size={18}
              color={flow === 'heavy' ? theme.accentDeep : flow === 'medium' ? theme.accent : theme.accentWash}
            />
            <ThemedText type="small">{sentenceStart(flow)}</ThemedText>
          </View>
        </Card>
      )}

      {symptoms.length > 0 && (
        <Card icon="star-four-points-outline" title="Symptoms">
          {/* ONE PER LINE, as her drawing has them. A row of chips is for
              choosing between things; a list is for reading what was chosen. */}
          {symptoms.map((s) => (
            <View key={s} style={styles.bullet}>
              <ThemedText type="small" themeColor="textSecondary">
                •
              </ThemedText>
              <ThemedText type="small" style={styles.bulletText}>
                {sentenceStart(String(s))}
              </ThemedText>
            </View>
          ))}
        </Card>
      )}

      {said.length > 0 && (
        <Card icon="weather-partly-cloudy" title="Mood and energy">
          {said.map((f) => (
            <ThemedText key={f.label} type="small">
              {sentenceStart(f.word)}
            </ThemedText>
          ))}
        </Card>
      )}

      {ovulation.length > 0 && (
        <Card icon="target" title="Ovulation">
          {ovulation.map((o) => (
            <ThemedText key={String(o)} type="small">
              {sentenceStart(String(o))}
            </ThemedText>
          ))}
        </Card>
      )}

      {entry.mucus && (
        <Card icon="sine-wave" title="Cervical mucus">
          <ThemedText type="small">{sentenceStart(entry.mucus)}</ThemedText>
        </Card>
      )}

      {entry.temperatureC != null && (
        <Card icon="thermometer" title="Temperature">
          <ThemedText type="small">{entry.temperatureC}°C</ThemedText>
        </Card>
      )}

      {notes && (
        <Card icon="note-text-outline" title="Notes">
          <ThemedText type="small" style={styles.notes}>
            {notes}
          </ThemedText>
        </Card>
      )}

      {nothing && (
        // SAID ONCE, PLAINLY, rather than six empty cards. This is reachable:
        // a day can be opened from the month list after everything on it was
        // removed, and silence here would read as the screen having failed.
        <ThemedText type="small" themeColor="textSecondary" style={styles.nothing}>
          Nothing was recorded on this day.
        </ThemedText>
      )}

      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={nothing ? 'Record this day' : 'Edit this day'}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView style={[styles.edit, { backgroundColor: theme.accentDeep }]}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.background} />
          <ThemedText type="smallBold" themeColor="background">
            {nothing ? 'Record this day' : 'Edit this day'}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bullet: { flexDirection: 'row', gap: Spacing.two },
  // FILLS THE ROW rather than hugging its own measured width, so a long symptom
  // wraps instead of clipping.
  bulletText: { flex: 1 },
  notes: { lineHeight: 20 },
  nothing: { lineHeight: 20 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    minHeight: 44,
    marginTop: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
