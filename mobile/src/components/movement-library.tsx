import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityIcon } from '@/components/activity-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, DisplayFont, Spacing } from '@/constants/theme';
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
//
// AND SMALLER THAN THEY WERE (Ruth, 2026-09-18, looking at this screen: "it's
// not landed I don't think"). The density pass that afternoon reached the open
// routine and never reached the library in front of it, so two cards filled a
// phone: a 30pt serif title wrapping to two lines, 24 of padding around it, and
// the third card cut off at the fold. The title is now 21 - still the serif,
// still unmistakably a name rather than a row - and everything under it is the
// detail size. Three cards fit where two did, which is the point: a library you
// cannot see is a list you have to scroll to remember.

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
                <ActivityIcon kind={mark} size={18} />
              </View>
              <View style={styles.body}>
                <ThemedText style={styles.title}>{entry.title}</ThemedText>
                <ThemedText type="detail" themeColor="textSecondary">
                  {[s.kind, s.duration, s.movements].filter(Boolean).join('  ·  ')}
                </ThemedText>
                {s.lastDone && (
                  <ThemedText type="detail" themeColor="textSecondary">
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
  wrap: { gap: Spacing.two },
  standfirst: { paddingRight: Spacing.five, paddingBottom: Spacing.one },
  card: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: CardRadius,
    // Roomy enough to read as a card rather than a table row, and no roomier.
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    alignItems: 'flex-start',
  },
  mark: { paddingTop: 5 },
  body: { flex: 1, gap: 1 },
  // The serif, because a practice is a NAME and names are set in the serif here
  // - but at 21 rather than 30, which is the difference between a title in a
  // library and a headline about one.
  title: {
    fontFamily: DisplayFont.regular,
    fontSize: 21,
    lineHeight: 26,
    paddingBottom: 3,
  },
  pressed: { opacity: 0.75 },
});
