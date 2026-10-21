import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceFlowerSection } from '@/components/balance-flower-section';
import { DiarySection } from '@/components/diary-section';
import { loadUpcoming } from '@/lib/calendar';
import { flowerRange, type FlowerMode } from '@/lib/flower-range';
import { FoldSection } from '@/components/fold-section';
import { PageLink } from '@/components/page-link';
import { useTheme } from '@/hooks/use-theme';
import { HydrationToast, type WaterAction } from '@/components/hydration-card';
import { OverviewPanel } from '@/components/overview-panel';
import { ReportLink } from '@/components/report-link';
import { SettingsLink } from '@/components/settings-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';
import type { AlmanacRow } from '@/lib/insights';
import { portraitFrom } from '@/lib/roundup';
import { supabase } from '@/lib/supabase';

// THE NO-SCROLL RULE IS RETIRED, 2026-09-16, and it is worth saying why rather
// than quietly deleting it.
//
// It read: "this screen is specified not to scroll... anything that will not fit
// here belongs in a detail screen", and it was a good rule that held for six
// weeks. What retired it was Ruth asking for "What you burn" to sit on this
// screen because it was too hidden on Activity - a seventh child on a fixed
// flex view, which does not overflow gracefully: it simply sits below the fold
// with no way to reach it, which is precisely what she reported ("Overview there
// but no burn at the bottom").
//
// The choice was between refusing her the panel, shrinking something else on a
// screen already cut twice to fit, or letting the screen scroll. The rule
// existed to keep this a glance rather than a page; a glance that CAN scroll is
// still a glance, and everything that was above the fold is still above it.
// NOW, WHICH WAS TODAY (Ruth, 7 October 2026). Her nav revision: "'Today'
// becomes 'Now', with three collapsible sections: Today's Insights, Last Week's
// Insights (the weekly roundup), and the Health Flower (moved from the
// Almanac)... A button on Now opens the report builder."
//
// WHAT THE RENAME IS FOR. Today was a screen about today, and the no-scroll rule
// below was written to keep it one. It is now the screen you open to see where
// you are, which includes the stretch of time today is part of. "Now" is a
// moment with a recent past behind it; "Today" is a date.
//
// THE FLOWER ARRIVED FROM THE ALMANAC and came with a change of its own: week
// and month, each with a back and a forward, instead of a fixed six weeks. See
// lib/flower-range.ts.
//
// TODAY'S INSIGHTS IS NOT BUILT YET and this screen does not pretend otherwise.
// Its honest state is here, in her words, and the section is absent rather than
// empty until there is something true to put in it. A screen that promises
// patterns and shows nothing reads as broken.
export default function BodyOverviewScreen() {
  const theme = useTheme();
  // The water card's Undo note, drawn here - outside the scroll view - so it
  // floats above the bottom navigation wherever the page is scrolled to.
  const [water, setWater] = useState<WaterAction | null>(null);
  const [undone, setUndone] = useState<{ ml: number; id: string } | null>(null);
  const clearWater = useCallback(() => setWater(null), []);
  // A drink deleted from today's list cannot still be offered for undo.
  const waterRemoved = useCallback(
    (id: string) => setWater((w) => (w && w.id === id ? null : w)),
    []
  );

  // The newest roundup's witness statements, which until today were only ever
  // read on the Almanac. Same row, same reader, a screen closer to the day.
  const [roundup, setRoundup] = useState<{ statements: string[]; range: string | null }>({
    statements: [],
    range: null,
  });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('almanac_entries')
        .select('id, kind, title, category, content, created_at, updated_at')
        .eq('status', 'active')
        .eq('kind', 'roundup')
        .order('created_at', { ascending: false })
        .limit(4);
      if (!cancelled) setRoundup(portraitFrom((data ?? []) as unknown as AlmanacRow[]));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // OPEN BY DEFAULT, because this screen has always shown everything it has and
  // folding it shut on the deploy would hide the day from somebody who never
  // asked for it to be hidden. The folds are here to be used, not imposed.
  const [open, setOpen] = useState({ week: true, flower: true, diary: true });
  const toggle = (k: 'week' | 'flower' | 'diary') => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // WHAT A SHUT DIARY SAYS, which FoldSection requires and is right to: a count
  // is the one thing worth knowing without opening it. Loaded here rather than
  // inside the section so the summary is true before it is unfolded.
  const [upcoming, setUpcoming] = useState<number | null>(null);
  useEffect(() => {
    void loadUpcoming().then((rows) => setUpcoming(rows.length));
  }, []);

  // THE FOLD NAMES THE WINDOW, so the state lives here rather than inside the
  // flower. A shut section saying "across the six dimensions" told her nothing
  // she could not already guess, and she struck it out; "September" is what a
  // folded section should say about what is behind it.
  const [flowerMode, setFlowerMode] = useState<FlowerMode>('days7');
  const [flowerBack, setFlowerBack] = useState(0);
  const flowerLabel = flowerRange(flowerMode, flowerBack).label;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* flexGrow, not flex, on the content container: it lets the screen fill
            the viewport when there is room and grow past it when there is not,
            which is what keeps the layout identical to the old fixed one until
            the content genuinely outgrows the screen. */}
        <ScrollView contentContainerStyle={styles.content}>
          <OverviewPanel onWaterAdded={setWater} onWaterRemoved={waterRemoved} waterUndone={undone} />

          <View style={styles.sections}>
            {/* LAST WEEK, IN WORDS. Absent rather than empty when the roundup
                has never run: "no statements yet" is the app describing its own
                plumbing, and the Sunday job will fill this in on its own. */}
            {roundup.statements.length > 0 ? (
              <FoldSection
                hideSummary
                title="Last week"
                // NOT THE STATEMENTS' OWN RANGE. That read "Last week  the last
                // 6 weeks", which is two different stretches of time in one row.
                // The roundup runs on a Sunday; what it looks back over is its
                // business and is said inside it.
                summary="from Sunday's roundup"
                open={open.week}
                onToggle={() => toggle('week')}
              >
                {roundup.statements.map((line) => (
                  <ThemedText key={line} type="small">
                    {line}
                  </ThemedText>
                ))}
              </FoldSection>
            ) : null}

            {/* COMING UP, which her Week cannot hold - it stores day names and
                recurs forever, and an appointment happens once on a date.
                Ruth, 18 October 2026: "we need to build calendar also then."

                ABOVE BALANCE, BELOW LAST WEEK. A hospital appointment on
                Thursday is more use at a glance than a six-dimension flower,
                and less use than nothing at all is what it was yesterday. */}
            <FoldSection
              ruled
              hideSummary
              title="Coming up"
              summary={
                upcoming == null ? 'loading' : upcoming === 0 ? 'nothing yet' : String(upcoming)
              }
              open={open.diary}
              onToggle={() => toggle('diary')}
            >
              <DiarySection />
            </FoldSection>

            {/* NOT "BALANCE" (Ruth, 20 October 2026): "We have Health competing
                with How I Access Care, which is confusing" was the Me tab, and
                this is the same fault here - the section was called Balance
                and one of the six petals inside it is also called Balance.
                Picking the section name rather than the petal: Balance the
                petal is a defined physiological concept carrying two citations
                in the spec, and the container is the cheaper thing to move.

                SHE CHOSE THE WORDS. The brief went out for other opinions and
                came back to this one. It fits the voice the other headings
                already use - "What you're working towards", "What you've
                noticed" - and it names the SUBJECT rather than the drawing,
                which was the fault in everything I suggested first. */}
            <FoldSection
              ruled
              hideSummary
              title="What's protecting you"
              summary={flowerLabel}
              open={open.flower}
              onToggle={() => toggle('flower')}
            >
              <BalanceFlowerSection
                mode={flowerMode}
                back={flowerBack}
                onMode={setFlowerMode}
                onBack={setFlowerBack}
              />
            </FoldSection>

            {/* TWO WAYS ON, AT THE FOOT OF THE PAGE. The Now artwork (20
                October 2026) draws them as a pair under the folds, and only
                one of them existed - "Open your Week" was in the drawing and
                not in the app.

                IT IS WORTH ADDING RATHER THAN DELETING FROM THE DRAWING. The
                flower on this screen is made from the Movement log and the one
                on the Week is made from the plan; somebody who has just read
                "most of what you did built balance and strength" and wants to
                change next week has nowhere to go from here. The explainer
                already links there for the same reason.

                HER BUTTON, ON THIS SCREEN (7 October): "A button on Now opens
                the report builder, which is no longer under Data." It is its
                own row in More as well, which is two doors to one screen
                rather than two screens. */}
            {/* A RULE ABOVE THE WAYS OUT, as the artwork draws it: the folds
                are a ruled list and these close it. Without it the two links
                float after the last section rather than ending the page. */}
            <View style={[styles.waysRule, { backgroundColor: theme.backgroundElement }]} />
            <View style={styles.ways}>
              <PageLink to="/(tabs)/plans" label="Open your Week" icon="calendar-outline" />
              <ReportLink start={['symptoms', 'insights']} label="Build a report" />
            </View>
          </View>
        </ScrollView>
        <HydrationToast
          action={water}
          onUndone={(ml, id) => setUndone({ ml, id })}
          onDone={clearWater}
        />
      </SafeAreaView>

      {/* OUTSIDE THE SCROLLER AND OUTSIDE THE SAFE AREA. It positions itself
          against the screen; this is the one thing a screen has to get right.
          See settings-link.tsx. */}
      <SettingsLink />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sections: { gap: Spacing.four, marginTop: Spacing.four },
  // THE TWO WAYS OUT SIT TOGETHER, so they read as a pair at the foot rather
  // than as one more section. ReportLink brings its own top padding, which is
  // why this adds none.
  ways: { gap: 0 },
  // The same hairline the folds and the Week's days use. Drawn here rather
  // than as a `ruled` FoldSection, because this is not a section.
  waysRule: { height: 1, opacity: 0.7, marginTop: Spacing.four },
  safeArea: { flex: 1 },
  content: {
    // flexGrow rather than flex: fills the viewport when the content is short,
    // and grows past it when it is not. flex:1 on a scroll content container
    // pins the height to the viewport, which is what made the new panel
    // unreachable rather than simply below the fold.
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: PageInset.horizontal,
    paddingTop: PageInset.top,
    paddingBottom: PageInset.bottom,
  },
});
