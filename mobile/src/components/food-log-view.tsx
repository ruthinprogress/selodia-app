import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DayLog, type DayEntry, type LogDay } from '@/components/day-log';
import { FoodBreakdownCard } from '@/components/food-breakdown-card';
import { QuickLogBar } from '@/components/quick-log-bar';
import { WeekAverageCard } from '@/components/week-average-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { FoodCategoryIcon } from '@/components/food-category-icon';
import { foodCategory } from '@/lib/food-category';
import { entryLabel } from '@/lib/food-today';
import { removeEntry } from '@/lib/remove-entry';
import { supabase } from '@/lib/supabase';
import { averageLine, MACRO_COLUMNS, macroLine, sumRows, type MacroKey } from '@/lib/tracked-macros';
import { loadTrackedMacros } from '@/lib/tracked-macros-store';
import {
  addWeeks,
  currentWeekStart,
  daysOfWeek,
  toLocalDateKey,
  weekRange,
  weekStartFor,
} from '@/lib/week';

// THE FOOD LOG, ON THE SHARED DAY LIST (Ruth, 27 September 2026, item 2).
//
// "Measurements is now the reference for how a log looks... Build it as one
// shared day-list pattern used by all three, not three copies."
//
// WHAT THIS FILE KEEPS is everything that is genuinely about food: the reads,
// which macros she has chosen to see, the week average, and how one entry
// reads. WHAT IT NO LONGER OWNS is the shape - the week bar, the rules between
// days, which day is open, the time logged, the chat link, the swipe and the
// undo toast all live in components/day-log.tsx now, and changing any of them
// changes all three screens at once. That is the point of the instruction.
//
// WHAT WENT, and it is worth listing because some of it was deliberate before:
//   - THE TAP-TO-OPEN BREAKDOWN CARD. An entry used to open a sheet with its
//     full macros. Her spec has one line per entry and one chat link per day,
//     and a sheet is a third way to interact with a row that the other two
//     screens do not have. The macros she tracks are still on the line.
//   - THE FILLED "TODAY" PANEL at the top. Today is simply the first row and
//     opens by default, which is what the shared list does everywhere.
//   - THE PER-ENTRY DELETE inside that card, replaced by the swipe every other
//     entry line in the app now uses.
//
// The category icon stayed. It is the one thing here the other screens do not
// have and it earns its place - a glance down the column says what KIND of day
// it was before any number is read.

type FoodRow = {
  id: string;
  happened_at: string;
  meal_label: string | null;
  raw_text: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  sugar_g: number | null;
  fibre_g: number | null;
  sodium_mg: number | null;
};

// THE MACRO COLUMNS ARE GENERATED, NOT TYPED (22 October 2026). This string
// named them by hand and was written before calcium and iron existed, so two
// macros she had switched on were read as "nobody worked them out" - on every
// line, in every total, twice reported as a bug.
const SELECT = `id, happened_at, meal_label, raw_text, ${MACRO_COLUMNS}`;

/** The day's totals, each value labelled. Her example: "1,840 kcal · 112 g protein". */
function summaryOf(rows: FoodRow[]): string {
  const kcal = rows.reduce((n, r) => n + (r.kcal ?? 0), 0);
  const protein = rows.reduce((n, r) => n + (r.protein_g ?? 0), 0);
  const parts: string[] = [];
  if (kcal > 0) parts.push(`${Math.round(kcal).toLocaleString('en-GB')} kcal`);
  if (protein > 0) parts.push(`${Math.round(protein)} g protein`);
  return parts.join('  ·  ');
}

/** "Pushups", not "pushups" - her rule, and it applies to food too. */
function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Meal labels that say nothing. "Meal" is the commonest thing the parser writes. */
const VAGUE_MEAL = /^(meal|food|entry|other|unknown)$/i;

/**
 * The heading a group of entries sits under.
 *
 * Ruth, item 7: "Replace the vague 'Meal' label with the actual meal name, or
 * the time if unknown." A heading that says "Meal" above a list of meals is
 * doing no work at all - the time at least tells her when she ate.
 */
function mealHeading(label: string | null, at: string): string {
  const name = (label ?? '').trim();
  if (name && !VAGUE_MEAL.test(name)) return capitalised(name);
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

/**
 * The entry without the heading it already sits under.
 *
 * "Breakfast: half cheese sandwich" under a Breakfast heading is the word
 * twice, and it is the longer word - so it is the one that pushes the name
 * into a second line and then into an ellipsis.
 */
function withoutMealPrefix(text: string, heading: string): string {
  const colon = text.indexOf(':');
  if (colon < 1 || colon > 24) return text;
  const prefix = text.slice(0, colon).trim().toLowerCase();
  if (prefix !== heading.trim().toLowerCase()) return text;
  return text.slice(colon + 1).trim() || text;
}

export function FoodLogView({ initialWeekStart }: { initialWeekStart?: Date }) {
  const [weekStart, setWeekStart] = useState<Date>(() => initialWeekStart ?? currentWeekStart());
  const [rows, setRows] = useState<FoodRow[]>([]);
  const [tracked, setTracked] = useState<MacroKey[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  /** The entry whose itemised breakdown is open. */
  const [openId, setOpenId] = useState<string | null>(null);
  useFocusReload(setReloadKey);

  useEffect(() => {
    let cancelled = false;
    void loadTrackedMacros().then((m) => {
      if (!cancelled) setTracked(m);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Open on the week her last entry is in, so a log she has not touched for a
  // fortnight does not open on an empty week that reads as a screen that failed
  // to load. Only when no week was asked for: a link into a particular week is
  // an instruction.
  useEffect(() => {
    if (initialWeekStart) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('food_logs')
        .select('happened_at')
        .order('happened_at', { ascending: false })
        .limit(1);
      const latest = data?.[0]?.happened_at;
      if (cancelled || typeof latest !== 'string') return;
      const week = weekStartFor(new Date(latest));
      if (toLocalDateKey(week) !== toLocalDateKey(currentWeekStart())) setWeekStart(week);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWeekStart]);

  const weekKey = toLocalDateKey(weekStart);
  const isCurrentWeek = weekKey === toLocalDateKey(currentWeekStart());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { startISO, endISO } = weekRange(weekStart);
      const { data } = await supabase
        .from('food_logs')
        .select(SELECT)
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: true });
      if (cancelled) return;
      // Through unknown, because SELECT is now built rather than a literal and
      // the client can no longer infer the row shape from it. The shape is
      // asserted by a check instead - see check-every-macro-is-fetched.
      setRows((data ?? []) as unknown as FoodRow[]);
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, reloadKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, FoodRow[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  const days: LogDay[] = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    return daysOfWeek(weekStart)
      .map((date) => ({ date, key: toLocalDateKey(date) }))
      // NOTHING LOGGED, NOTHING SHOWN - EXCEPT TODAY, which is always a row
      // (item 7). A week of seven rows where four say nothing teaches the
      // reader to skim; today with nothing on it is a different thing, because
      // it is the row she came to the screen to add to.
      .filter(({ key }) => key === todayKey || (byDay.get(key) ?? []).length > 0)
      .map(({ date, key }) => {
        const list = byDay.get(key) ?? [];
        // IN THE ORDER SHE ATE THEM (item 7). Breakfast, then lunch, then
        // dinner - which is the order the rows already come back in, and was
        // being undone by nothing more than the grouping running over an
        // unsorted list. Sorted explicitly here so it cannot come undone again.
        const inOrder = [...list].sort((a, b) => a.happened_at.localeCompare(b.happened_at));
        const entries: DayEntry[] = inOrder.map((row) => {
          const heading = mealHeading(row.meal_label, row.happened_at);
          const label = capitalised(withoutMealPrefix(entryLabel(row), heading));
          return {
            id: row.id,
            label,
            detail: macroLine(row as unknown as Record<string, unknown>, tracked) || null,
            // THE CATEGORY MARK IS BACK (her artwork, 22 October 2026). It was
            // dropped on 27 September for being the one icon this screen had
            // and no other - and her drawing puts a round mark at the head of
            // every entry. Asked which should fill it now the food photos are
            // out, she chose this one.
            //
            // The drawing it leads is not the food, which is the point: a
            // glance down the column says what KIND of day it was before any
            // number is read.
            mark: <FoodCategoryIcon category={foodCategory(row as never)} size={18} />,
            // GROUPED BY MEAL WHERE SHE RECORDED ONE, by time otherwise. Most
            // entries arrive through the conversation, which rarely names a
            // meal, so the fallback is the common case rather than the edge.
            group: heading,
            // NO ICON HERE ANY MORE (item 7: "Drop the meal icons unless
            // they're the same ones used elsewhere in the app and clearly mean
            // something"). FoodCategoryIcon was used on this screen and nowhere
            // else, which is the test failed. The measurement marks stay,
            // because they appear in Settings too and name a real thing.
            // TAPPING OPENS THE ITEMS AGAIN (restored 29 September 2026).
            // "I tapped on each food row but it didn't open up to the itemised
            // list as it's meant to so that I can check it's all there and
            // delete any item if incorrect." She was right, and it had been
            // gone since 27 September - see day-log.tsx's onOpen.
            onOpen: () => setOpenId(row.id),
            remove: () => removeEntry('food_logs', row.id, label),
          };
        });
        return {
          key,
          date,
          summary: <ThemedText type="small">{summaryOf(list)}</ThemedText>,
          // OPEN, THE DAY SHOWS WHAT SHE ACTUALLY TRACKS (Ruth, 21 October
          // 2026). Collapsed stays calories and protein, because a week of
          // rows is for scanning and both her artworks show it that way. Open
          // is where the day is being read rather than skimmed, and where a
          // macro she switched on has somewhere to appear - it had none
          // before, on any screen, at any level above a single meal.
          openSummary: (
            <ThemedText type="small">
              {macroLine(sumRows(list as unknown as Record<string, unknown>[]), tracked) ||
                summaryOf(list)}
            </ThemedText>
          ),
          at: list[0]?.happened_at ?? null,
          entries,
        };
      });
  }, [byDay, weekStart, tracked]);

  // AN AVERAGE, NOT A TOTAL (her brief: "This week: avg 1,213 kcal · 63g
  // protein · 5 of 7 days logged"), over days that were logged rather than over
  // a fixed seven.
  const week = averageLine(
    daysOfWeek(weekStart).map((d) => byDay.get(toLocalDateKey(d)) ?? []),
    tracked
  );

  return (
    <View style={styles.wrap}>
      <QuickLogBar kind="food" onLogged={() => setReloadKey((k) => k + 1)} />

      {/* THE WEEK, READ BEFORE IT IS SCROLLED (Ruth, 21 October 2026): "What
          we need is a clearer Weekly summary on the week logging page -
          currently a tiny text line at the bottom of the table."
          
          It was `type="detail"` grey text rendered after the whole list and
          after the breakdown card, which is to say: after everything, in the
          smallest type on the screen. The figures were right and nobody was
          ever going to read them.

          "DAILY AVERAGE", NOT "THIS WEEK" (her item 8, 27 September). It reads
          as a weekly total otherwise, and 1,326 kcal for a week would be a
          frightening thing to show somebody about their own eating. The figure
          never changed; the label was doing the lying. */}
      {/* THE WEEK AS FIGURES, NOT A SENTENCE (her artwork, 22 October 2026).
          Eight numbers in one running line is every number she asked for, in
          the order she asked for them, and unreadable. See week-average-card. */}
      <WeekAverageCard averages={week.averages} tracked={tracked} daysLogged={week.daysLogged} />

      <DayLog
        days={days}
        weekStart={weekStart}
        onWeekStart={setWeekStart}
        isPresent={isCurrentWeek}
        onChanged={() => setReloadKey((k) => k + 1)}
        subject={(date) =>
          `About my food from ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}: `
        }
        empty="Nothing logged this week."
      />

      {/* THE "WHAT'S IN HERE" CARD. It takes a food_logs id and nothing else,
          which is why it survived being orphaned for two days and could be put
          back without changing it. */}
      {openId ? (
        <FoodBreakdownCard
          foodLogId={openId}
          onClose={() => setOpenId(null)}
          onDeleted={() => {
            setOpenId(null);
            setReloadKey((k) => k + 1);
          }}
          // The meal survived but its figures moved - one item removed
          // (2026-09-30). The card stays open; the week behind it is re-read,
          // because the day's line and the average both come from food_logs.
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
});

export { addWeeks };
