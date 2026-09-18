import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityIcon } from '@/components/activity-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { activityIcon } from '@/lib/activity-icon';
import type { AlmanacRow } from '@/lib/insights';
import { loadLastDoneByPlan, summarise } from '@/lib/movement-library';

// MOVEMENT: a library of practices, not a list of workouts (Ruth's brief,
// 2026-09-18, with a mockup).
//
// "Your saved movement practices. Consistency compounds." Everything below that
// line is one card per practice, and the card says four things: what it is
// called, what kind of practice it is, roughly how long it takes, and when it
// was last done. Nothing else, because nothing else is a fact about the
// practice - a score would be a judgement about the person.
//
// NO PRAISE, ANYWHERE. The brief is explicit: no "well done", no "great job", no
// "keep it up". "Last done 3 days ago" is an observation; "3 days since you last
// trained" is a reproach wearing the same numbers.
//
// THE CARDS ARE LIGHTER THAN A FITNESS APP'S, deliberately: sand on cream, one
// radius, no borders, no shadows, no progress bars. Apple Journal rather than
// gym software.

export function MovementLibrary({
  entries,
  onOpen,
}: {
  entries: AlmanacRow[];
  onOpen: (id: string) => void;
}) {
  const [lastDone, setLastDone] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = await loadLastDoneByPlan();
      if (!cancelled) setLastDone(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [entries.length]);

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.standfirst}>
        Your saved movement practices. Consistency compounds.
      </ThemedText>

      {entries.map((entry) => {
        const s = summarise(entry.content, entry.category, lastDone.get(entry.id) ?? null);
        // The kind decides the mark, so a yoga flow and a barbell plan are
        // distinguishable before either is opened.
        const mark = activityIcon(`${s.kind} ${entry.title}`);
        return (
          <Pressable
            key={entry.id}
            onPress={() => onOpen(entry.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${entry.title}`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.mark}>
                <ActivityIcon kind={mark} size={22} />
              </View>
              <View style={styles.body}>
                <ThemedText type="sectionTitle" style={styles.title}>
                  {entry.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[s.kind, s.duration, s.movements].filter(Boolean).join('  ·  ')}
                </ThemedText>
                {s.lastDone && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.lastDone}
                  </ThemedText>
                )}
              </View>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  standfirst: { paddingRight: Spacing.five },
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: CardRadius,
    // Generous, because the brief asks for a notebook rather than a table.
    padding: Spacing.four,
    alignItems: 'flex-start',
  },
  mark: { paddingTop: 6 },
  body: { flex: 1, gap: Spacing.half },
  // The serif at section size, which is what makes a practice read as a title
  // in a library rather than a row in a list.
  title: { paddingBottom: Spacing.half },
  pressed: { opacity: 0.75 },
});
