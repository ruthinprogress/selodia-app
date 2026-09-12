import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSeeded } from '@/lib/almanac-list';
import {
  entryDateLabel,
  INSIGHT_PILL_LABEL,
  INSIGHT_TYPE_LABEL,
  insightTypeFor,
  pillsFor,
  previewLine,
  type AlmanacRow,
  type InsightType,
} from '@/lib/insights';

// Layer 2 of Insights: the log (build spec, Part Ten, the Insights brief).
//
// Every entry, newest first, as a card: its type, its date, its title and its
// first line. Tapping opens the full entry. Nothing here is ever framed as done,
// missed, good or bad: a card says what was noticed and when (the Witness
// Principle).
//
// THE PILLS FOLLOW THE BRIEF'S RULE: one appears only for a type that has
// entries, after "All". Tapping one filters the log; opening that type's
// analytics view is Insights slice 4 and not built yet.
//
// ONE DELIBERATE READING OF THE BRIEF. It says a new user "sees only All until
// entries accumulate". With no entries at all, an "All" pill filtering nothing
// would be a control with nothing behind it, which principle 8 rules out, so the
// screen shows no log until there is a first entry. The portrait above already
// says it is early.

export function InsightsLog({
  rows,
  onOpen,
}: {
  rows: AlmanacRow[];
  onOpen: (id: string) => void;
}) {
  const theme = useTheme();
  const [filter, setFilter] = useState<InsightType | 'all'>('all');
  const pills = pillsFor(rows);
  // A filter whose last entry has gone falls back to All, rather than leaving an
  // empty filtered list behind a pill that no longer exists.
  const active: InsightType | 'all' = filter !== 'all' && pills.includes(filter) ? filter : 'all';
  const shown = active === 'all' ? rows : rows.filter((r) => insightTypeFor(r) === active);

  return (
    <View style={styles.wrap}>
      {/* The soft divider between the portrait and the log. */}
      <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

      <View style={styles.pills}>
        <Pill label="All" selected={active === 'all'} onPress={() => setFilter('all')} />
        {pills.map((t) => (
          <Pill
            key={t}
            label={INSIGHT_PILL_LABEL[t]}
            selected={active === t}
            onPress={() => setFilter(t)}
          />
        ))}
      </View>

      <View style={styles.cards}>
        {shown.map((r) => (
          <EntryCard key={r.id} row={r} onPress={() => onOpen(r.id)} />
        ))}
      </View>
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Show ${label}`}
      hitSlop={6}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {/* Chosen: terracotta, deep enough for cream text to read at 6:1. Not
          chosen: an outline on the page. Charcoal is never a fill. */}
      <View
        style={[
          styles.pill,
          selected
            ? { backgroundColor: theme.accentDeep, borderColor: theme.accentDeep }
            : { borderColor: theme.backgroundSelected },
        ]}
      >
        <ThemedText
          type="small"
          style={[styles.pillText, { color: selected ? theme.background : theme.textSecondary }]}
        >
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function EntryCard({ row, onPress }: { row: AlmanacRow; onPress: () => void }) {
  const theme = useTheme();
  const type = insightTypeFor(row);
  const preview = previewLine(row.content);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${INSIGHT_TYPE_LABEL[type]}, ${row.title}, ${entryDateLabel(row)}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.cardTop}>
          <ThemedText type="small" style={[styles.tag, { color: theme.accentDeep }]}>
            {INSIGHT_TYPE_LABEL[type]}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.date}>
            {entryDateLabel(row)}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">{row.title}</ThemedText>
        {preview && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {preview}
          </ThemedText>
        )}
        {isSeeded(row.content) && (
          // Test data must never pass for something the person saved.
          <ThemedText type="small" style={[styles.seeded, { color: theme.danger }]}>
            seeded test data
          </ThemedText>
        )}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  divider: { height: 1, marginVertical: Spacing.one },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12 },
  cards: { gap: Spacing.two },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  date: { fontSize: 11 },
  seeded: { fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
