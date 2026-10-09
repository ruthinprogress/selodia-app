// THE CYCLE HISTORY, AS BARS RATHER THAN A LIST.
//
// Ruth, 9 October 2026: "the way period Alex logged vusually needs a rework,
// it's just a long list atm."
//
// It was a vertical list of dated events - "Period started, 28 September",
// "Period ended, 2 October" - accurate, and telling her nothing she could not
// already remember. A bar per cycle, length proportional to the cycle, shows
// that 24 days followed 35. That is the one thing a list cannot do, and at 40+
// it is the only thing on the screen that matters: an irregular cycle is
// information, not noise to be averaged into a tidy 28.
//
// THE SUMMARY ABOVE THEM came from ChatGPT's second direction and was the
// strongest element on that page - "You are on day 18 of this cycle. Your last
// three were 31, 26 and 35 days. A range of 24 to 35." It does more work than
// any chart, because it says out loud what the chart only shows. It never
// predicts a next date.
//
// A SKIPPED MONTH IS A ROW. See cycle-bars.ts for why, and for why "a month
// with no period start" turned out to be the wrong test for one.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cycleBars, cycleSummary, isGap, summaryLines, type CycleBar } from '@/lib/cycle-bars';
import type { CycleEvent } from '@/lib/cycle-history';

/** Widest a bar may be drawn, in points. The longest cycle fills it. */
const FULL_WIDTH = 170;
/** Nothing below this reads as a bar at all. */
const MIN_WIDTH = 28;

function human(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function CycleHistoryBars({
  events,
  today,
  onOpenDay,
}: {
  events: CycleEvent[];
  today: string;
  /** Tapping a bar goes to the day its period started. */
  onOpenDay: (day: string) => void;
}) {
  const theme = useTheme();
  const bars = cycleBars(events, today);
  const lines = summaryLines(cycleSummary(bars));

  if (bars.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Nothing recorded yet. Move to the day it started, then tap Started.
      </ThemedText>
    );
  }

  // Everything is drawn against the longest cycle on screen, so the bars are
  // comparable to each other rather than to an imagined 28-day one. A single
  // cycle has nothing to be long or short against, so it draws at full width.
  const longest = Math.max(
    ...bars.map((b) => b.length ?? b.soFar ?? 0),
    1
  );
  const widthFor = (days: number) =>
    Math.max(MIN_WIDTH, Math.round((days / longest) * FULL_WIDTH));

  return (
    <View style={styles.wrap}>
      {lines && (
        <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
          {lines.map((line, i) => (
            <ThemedText
              key={line}
              type="small"
              themeColor={i === 0 ? 'text' : 'textSecondary'}
              style={i === 0 ? styles.summaryLead : undefined}
            >
              {line}
            </ThemedText>
          ))}
        </View>
      )}

      {bars.map((bar) => (
        <Row
          key={`${bar.start}-${bar.label}`}
          bar={bar}
          width={widthFor(bar.length ?? bar.soFar ?? 0)}
          bleedWidth={bar.bleed ? widthFor(bar.bleed) : null}
          onPress={() => onOpenDay(bar.start)}
        />
      ))}
    </View>
  );
}

function Row({
  bar,
  width,
  bleedWidth,
  onPress,
}: {
  bar: CycleBar;
  width: number;
  bleedWidth: number | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const gap = isGap(bar);
  const open = bar.soFar !== null;

  // WHAT THE RIGHT-HAND FIGURE SAYS, and it is three different things.
  const figure = gap ? 'No period logged' : open ? 'Current' : `${bar.length} days`;
  const under = gap
    ? null
    : open
      ? `Day ${bar.soFar}`
      : bar.bleed
        ? `${bar.bleed} days bleed`
        : 'end not logged';

  return (
    <Pressable
      onPress={gap ? undefined : onPress}
      disabled={gap}
      accessibilityRole={gap ? undefined : 'button'}
      accessibilityLabel={
        gap
          ? `${bar.label}, no period logged`
          : `${bar.label}, ${figure}. Open ${human(bar.start)}`
      }
      style={({ pressed }) => [styles.row, pressed && !gap && styles.pressed]}
    >
      <View style={styles.rowTop}>
        <ThemedText type="small" themeColor={gap ? 'textSecondary' : 'text'}>
          {bar.label}
        </ThemedText>
        <View style={styles.figures}>
          <ThemedText type="small" themeColor={gap ? 'textSecondary' : 'text'}>
            {figure}
          </ThemedText>
          {under && (
            <ThemedText type="detail" themeColor="textSecondary">
              {under}
            </ThemedText>
          )}
        </View>
      </View>

      {gap ? (
        // Dashed and empty: the shape of a cycle that is not there. Drawn at a
        // fixed width because there is no length to be proportional to.
        <View style={[styles.bar, styles.gapBar, { borderColor: theme.backgroundSelected, width: 120 }]} />
      ) : (
        <View style={[styles.bar, { width }]}>
          {bleedWidth !== null && (
            <View
              style={[styles.bleed, { width: Math.min(bleedWidth, width), backgroundColor: theme.accent }]}
            />
          )}
          <View style={[styles.rest, { backgroundColor: theme.backgroundElement }]} />
          {open && (
            // The open end, dashed: the cycle has not finished and the bar
            // should not look as though it has.
            <View style={[styles.openEnd, { borderColor: theme.backgroundSelected }]} />
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  summary: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  summaryLead: { fontWeight: '600' },
  row: { gap: Spacing.one },
  pressed: { opacity: 0.6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  figures: { alignItems: 'flex-end' },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
  gapBar: { borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
  bleed: { height: '100%' },
  rest: { flex: 1, height: '100%' },
  openEnd: { width: 34, height: '100%', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 7 },
});
