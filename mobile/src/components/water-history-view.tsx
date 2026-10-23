import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DayLog, type LogDay } from '@/components/day-log';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatVolume } from '@/lib/hydration-goal';
import { removeEntry } from '@/lib/remove-entry';
import { supabase } from '@/lib/supabase';
import {
  addWeeks,
  currentWeekStart,
  daysOfWeek,
  toLocalDateKey,
  weekRange,
} from '@/lib/week';

// WATER, WEEK BY WEEK (2026-09-19), REBUILT ON THE SHARED LIST (23 October
// 2026).
//
// Ruth: "This screen needs bringing up to the rest of the app standard, its
// fallen behind. It needs the weekly table like food and movement with the
// scroll back function and drop down to see detailed entries."
//
// She is right and the reason is worth writing down. This screen was BUILT as
// "the food log's sibling" - the same week stepper, the same two-tap delete -
// by COPYING them. Food and Movement then moved to one shared list on 27
// September, with collapsing days, an undo toast and a seven-day soft delete.
// Hydration kept its copy, which is how a sibling becomes an orphan: nothing
// was wrong with it on the day it was written, and nothing told it when the
// family moved. A document nothing imports rots; so does a component nobody
// shares.
//
// WHAT IT GAINS BY NOT BEING ITS OWN IMPLEMENTATION ANY MORE: days collapse, so
// a week is readable rather than a wall; a removed drink can be put back from
// the toast; and deleting keeps the row for seven days instead of destroying
// it. None of those were decisions about water. They are what every other log
// already had.
//
// WHAT IT STILL DELIBERATELY DOES NOT HAVE, carried over from the original and
// still right: no target, no score, no run of days compared against each other.
// Part Twelve rules that out for hydration, and a week laid out in a column is
// exactly where a streak would want to appear. The day totals are here to be
// read, not judged - which is also why a day with nothing says "nothing
// logged", and not zero.

type Drink = { id: string; ml: number; happened_at: string; raw_input: string | null };

/** "2 black coffees" as a label, or plain water when nothing was said. */
function drinkLabel(raw: string | null): string {
  const said = raw?.trim();
  if (!said) return 'Water';
  return said.charAt(0).toUpperCase() + said.slice(1);
}

export function WaterHistoryView() {
  const [weekStart, setWeekStart] = useState<Date>(() => currentWeekStart());
  const [rows, setRows] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const weekKey = toLocalDateKey(weekStart);
  const isCurrentWeek = weekKey === toLocalDateKey(currentWeekStart());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      const { data } = await supabase
        .from('hydration_logs')
        .select('id, ml, happened_at, raw_input')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: false });
      if (cancelled) return;
      setRows((data ?? []) as Drink[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekKey, weekStart, reloadKey]);

  const changed = useCallback(() => setReloadKey((k) => k + 1), []);

  const days: LogDay[] = useMemo(() => {
    const byDay = new Map<string, Drink[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = byDay.get(key);
      if (list) list.push(r);
      else byDay.set(key, [r]);
    }

    return daysOfWeek(weekStart)
      .filter((d) => d <= new Date())
      .map((date) => {
        const key = toLocalDateKey(date);
        const drinks = byDay.get(key) ?? [];
        const total = drinks.reduce((n, r) => n + r.ml, 0);
        return {
          key,
          date,
          summary: (
            <ThemedText type="small">
              {drinks.length === 0 ? 'Nothing logged' : formatVolume(total)}
            </ThemedText>
          ),
          at: drinks.length > 0 ? drinks[drinks.length - 1].happened_at : null,
          entries: drinks.map((r) => {
            const label = drinkLabel(r.raw_input);
            return {
              id: r.id,
              // THE VOLUME LEADS, because that is what the row is about and a
              // column of them is what makes a day scannable.
              label: formatVolume(r.ml),
              // WHAT IT CAME FROM (Ruth, 21 September 2026): "I think the
              // hydration log needs to show the source of the hydration or
              // it's going to confuse people and it's really hard to check if
              // it's correct too." Since a milky tea counts toward water as
              // well as food, a column of bare volumes is unreadable: 300ml of
              // WHAT. Her own words are also the only way to see a wrong one.
              detail: [
                new Date(r.happened_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                r.raw_input?.trim() ? label : null,
              ]
                .filter(Boolean)
                .join(' · '),
              remove: () =>
                removeEntry(
                  'hydration_logs',
                  r.id,
                  r.raw_input?.trim()
                    ? `${formatVolume(r.ml)} of ${r.raw_input.trim()}`
                    : `${formatVolume(r.ml)} of water`
                ),
            };
          }),
        };
      });
  }, [rows, weekStart]);

  if (loading) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        …
      </ThemedText>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* WHERE THE WATER COMES FROM, SAID ONCE (Ruth, 23 October 2026, her
          exact wording). A drink mentioned in chat or inside a meal is logged
          here too, and until this sentence existed the only way to find that
          out was to notice a volume you had not typed on this screen - which
          reads as the app inventing things rather than joining them up. */}
      <ThemedText type="small" themeColor="textSecondary">
        You can see all your hydration history here and any drinks logged in Chat or in Food Log
        will automatically be logged here too
      </ThemedText>

      <DayLog
        days={days}
        weekStart={weekStart}
        onWeekStart={setWeekStart}
        isPresent={isCurrentWeek}
        onChanged={changed}
        subject={(date) =>
          `About my drinks from ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}: `
        }
        empty="Nothing logged this week."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
});

export { addWeeks };
