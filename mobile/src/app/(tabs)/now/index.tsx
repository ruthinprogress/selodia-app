import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceFlowerSection } from '@/components/balance-flower-section';
import { FoldSection } from '@/components/fold-section';
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
  const [open, setOpen] = useState({ week: true, flower: true });
  const toggle = (k: 'week' | 'flower') => setOpen((o) => ({ ...o, [k]: !o[k] }));

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
                title="Last week"
                summary={roundup.range ?? 'the week just gone'}
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

            <FoldSection
              title="Balance"
              summary="across the six dimensions"
              open={open.flower}
              onToggle={() => toggle('flower')}
            >
              <BalanceFlowerSection />
            </FoldSection>

            {/* HER BUTTON, ON THIS SCREEN (7 October): "A button on Now opens
                the report builder, which is no longer under Data." It is its own
                row in More as well, which is two doors to one screen rather than
                two screens. */}
            <ReportLink start={['symptoms', 'insights']} label="Build a report" />
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
