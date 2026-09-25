import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityIcon } from '@/components/activity-icon';
import { ReorderableRows } from '@/components/reorderable-rows';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, DisplayFont, Spacing } from '@/constants/theme';
import { activityIcon } from '@/lib/activity-icon';
import type { AlmanacRow } from '@/lib/insights';
import { arrange, layoutOf, loadLayout, saveLayout, type LogLayout } from '@/lib/log-layout';
import { loadLastDoneByPlan, summarise } from '@/lib/movement-library';

// MOVEMENT: a library of practices, not a list of workouts (Ruth's brief,
// 2026-09-18, with a mockup).
//
// "Saved practices, ready whenever they fit your day." The screen's own
// "Plans" heading is the title now; this line only says what these ARE. It was
// a SectionIntro under a second heading until 24 September 2026, when Ruth read
// the two stacked headings as clutter. Everything below
// it is one card per practice, and the card says four things: what it is called,
// what kind of practice it is, roughly how long it takes, and when it was last
// done. Nothing else, because nothing else is a fact about the practice - a
// score would be a judgement about the person.
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
  onDeleted,
}: {
  entries: AlmanacRow[];
  onOpen: (id: string) => void;
  /** Fired once a plan is gone, so the screen above can re-read itself.
      (Ruth, 25 September 2026: "each plan has no delete button. Please add
      the swipe left to delete, same as everywhere else.") */
  onDeleted?: () => void;
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

  // HELD IN HAND AND MOVED, LIKE THE LOG AND THE CYCLE CARDS (Ruth, 25
  // September 2026, item 6). This is the list where it does the most work:
  // the Log ships seven rows in an order somebody chose once, but a plans
  // shelf grows as she makes plans and is sorted newest-first, which puts the
  // routine she does every Monday at the bottom the moment she saves anything.
  //
  // DERIVED, NOT STORED. The order is recomputed from the plans plus her saved
  // arrangement on every render rather than kept in state beside them, so a
  // plan deleted or created elsewhere can never leave this list disagreeing
  // with the screen above it.
  const [layout, setLayout] = useState<LogLayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadLayout('plans_layout');
      if (!cancelled) setLayout(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Her order until it has loaded is the app's order, not an empty list: this
  // renders immediately and settles a moment later, and the plans are the same
  // plans either way.
  const ordered = useMemo(() => {
    if (!layout) return entries;
    // No plan is ever hidden - a plan she does not want is deleted, which is
    // what the swipe below is for - but a stale `hidden` from a hand-edited or
    // future layout must not silently swallow one, so both halves are shown.
    const { shown, hidden } = arrange(entries, layout);
    return [...shown, ...hidden];
  }, [entries, layout]);

  // SAVED WHEN IT CHANGES, not on a Done button. Same reasoning as the Log:
  // there is no moment where somebody has finished arranging a list, and a
  // Done they forget to press is an arrangement thrown away.
  const reorder = (next: AlmanacRow[]) => {
    const l = layoutOf(next.map((e) => e.id), []);
    setLayout(l);
    void saveLayout('plans_layout', l);
  };

  return (
    <View style={styles.wrap}>
      {/* THE HEADING WENT (Ruth, 24 September 2026: "Plans is the title. Remove
          'your movement plans' too cluttered"). The screen already says Plans
          in the display face; "Your movement collection" underneath it was the
          same thought in a second voice, and the two headings stacked read as
          clutter rather than as hierarchy.

          The line under it stays. It is not a heading, it says what these ARE -
          saved practices rather than a programme you are behind on - and that
          distinction is the whole point of the tab (see her brief above). */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        Saved practices, ready whenever they fit your day.
      </ThemedText>

      {/* TWO GESTURES ON ONE CARD, and they do not fight. The swipe only
          claims a touch once it is plainly horizontal and at least 12 points
          along; the drag only starts after the card has been held still for
          220ms. A quick sideways flick is a delete, a press-and-hold is a move,
          and a plain tap reaches the card and opens the plan. */}
      <ReorderableRows
        items={ordered}
        onReorder={reorder}
        renderRow={(entry, index, dragging) => {
          const s = summarise(entry.content, entry.category, lastDone.get(entry.id) ?? null);
          // The kind decides the mark, so a yoga flow and a barbell plan are
          // distinguishable before either is opened.
          const mark = activityIcon(`${s.kind} ${entry.title}`);
          return (
            // SAME GESTURE AS EVERY OTHER ROW IN THE APP, and the same reasoning:
            // it reveals a Delete rather than firing on the swipe, because a
            // swipe far enough to delete is a swipe that can happen in a pocket.
            // See swipe-to-delete.tsx.
            <SwipeToDelete
              table="almanac_entries"
              id={entry.id}
              what={entry.title}
              onDeleted={onDeleted}
            >
              <Pressable
                onPress={() => onOpen(entry.id)}
                // A card in hand is being moved, not tapped.
                disabled={dragging}
                accessibilityRole="button"
                accessibilityLabel={`Open ${entry.title}. Hold to move it.`}
                style={({ pressed }) => pressed && !dragging && styles.pressed}
              >
                <ThemedView
                  type="backgroundElement"
                  style={[styles.card, index < ordered.length - 1 && styles.spaced]}
                >
                  {/* BIGGER, AND ON ITS OWN GROUND (2026-09-20). At 18 points
                      beside a serif title the drawing read as a bullet; the plans
                      are the one place in the app where a picture does real work,
                      telling a barbell plan from a ballet one before either is
                      opened. Line art in the app's own hand - no photography,
                      here or anywhere. */}
                  <ThemedView type="background" style={styles.mark}>
                    <ActivityIcon kind={mark} size={26} />
                  </ThemedView>
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
            </SwipeToDelete>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  // A little air under the display heading above, which used to be the
  // SectionIntro's job.
  intro: { marginBottom: Spacing.one },
  card: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: CardRadius,
    // Roomy enough to read as a card rather than a table row, and no roomier.
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    alignItems: 'flex-start',
  },
  // The air between cards, which used to come from the wrap's gap. Inside the
  // reorderable list each card is its own row in a plain container, so the
  // spacing belongs to the card - and to every card but the last, or the list
  // ends with a gap under it.
  spaced: { marginBottom: Spacing.two },
  // A round, quiet ground for the drawing, the size of two lines of the title.
  mark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
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
