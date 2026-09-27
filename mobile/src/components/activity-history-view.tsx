import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DayLog, type DayEntry, type LogDay } from '@/components/day-log';
import { ActivityIcon } from '@/components/activity-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';
import { activityIcon } from '@/lib/activity-icon';
import { withoutDailySummaries } from '@/lib/daily-summary-rows';
import { removeEntry } from '@/lib/remove-entry';
import { supabase } from '@/lib/supabase';
import { currentWeekStart, daysOfWeek, toLocalDateKey, weekRange } from '@/lib/week';

// THE MOVEMENT LOG, ON THE SHARED DAY LIST (Ruth, 27 September 2026, item 2).
//
// Her summary line, exactly: "Thu 24 · 7,414 · Pushups 2 min" - steps first
// behind the foot, then the sessions. The foot IS the label for the number, the
// same decision Today's movement row made on the 25th, and it is what buys the
// room for the names of what she actually did.
//
// STEPS AND SESSIONS ARE DIFFERENT KINDS OF THING and the screen has to keep
// saying so. A step count is a whole day of ordinary moving about, recorded by
// a phone; a session is something she set out to do. They share a row because
// they share a day, never because they are comparable - which is why the steps
// figure is not an entry, has no swipe, and cannot be deleted here: it is not
// hers to delete, it is what the phone counted.
//
// WHAT WENT: the tap-to-open detail card and the visible delete control on each
// row, both replaced by the shared line and the shared swipe. Nothing else
// here was doing anything the other two logs do not now do identically.

type ActivityRow = {
  id: string;
  happened_at: string;
  activity_type: string | null;
  duration_min: number | null;
  kcal_burned: number | null;
  intensity: string | null;
  source: string | null;
  notes: string | null;
};

type StepRow = { date: string; steps: number | null };

/** "Pushups", not "pushups" - her rule. */
function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function name(row: ActivityRow): string {
  return capitalised((row.activity_type ?? 'Movement').trim() || 'Movement');
}

/** Name, duration, intensity, kcal - her order, and anything missing is left out. */
function detailOf(row: ActivityRow): string | null {
  const parts: string[] = [];
  if (row.duration_min != null) parts.push(`${Math.round(row.duration_min)} min`);
  if (row.intensity) parts.push(String(row.intensity));
  if (row.kcal_burned != null) parts.push(`${Math.round(row.kcal_burned)} kcal`);
  return parts.length > 0 ? parts.join('  ·  ') : null;
}

export function ActivityHistoryView({ initialWeekStart }: { initialWeekStart?: Date }) {
  const theme = useTheme();
  const [weekStart, setWeekStart] = useState<Date>(() => initialWeekStart ?? currentWeekStart());
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  useFocusReload(setReloadKey);

  const weekKey = toLocalDateKey(weekStart);
  const isCurrentWeek = weekKey === toLocalDateKey(currentWeekStart());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { startISO, endISO } = weekRange(weekStart);
      const [sessions, daily] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('id, activity_type, duration_min, kcal_burned, intensity, source, happened_at, notes')
          .gte('happened_at', startISO)
          .lt('happened_at', endISO)
          .order('happened_at', { ascending: true }),
        // THE EXACT DAYS, NOT A SLICED ISO RANGE (Ruth, item 7: "Thu 24 shows
        // pushups but not its steps"). `date` here is a plain calendar day and
        // startISO is a local midnight, so slicing ten characters off it gives
        // the day BEFORE in British Summer Time - the window was a day out all
        // summer. Asking for the seven keys the rows are grouped by cannot
        // drift, because it is the same function that builds them.
        supabase
          .from('daily_activity_summaries')
          .select('date, steps')
          .in('date', daysOfWeek(weekStart).map((d) => toLocalDateKey(d))),
      ]);
      if (cancelled) return;
      // A PHONE'S WHOLE-DAY SUMMARY IS NOT A SESSION. It arrives in the same
      // table from a photographed Samsung screen, and showing it beside real
      // sessions would count an entire day of walking about as something she
      // set out to do.
      setRows(withoutDailySummaries((sessions.data ?? []) as ActivityRow[]));
      setSteps((daily.data ?? []) as StepRow[]);
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, reloadKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  const stepsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of steps) if (typeof s.steps === 'number') map.set(s.date, s.steps);
    return map;
  }, [steps]);

  const days: LogDay[] = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    return daysOfWeek(weekStart)
      .map((date) => ({ date, key: toLocalDateKey(date) }))
      // A day with steps and no session still HAPPENED, so it is shown. A day
      // with neither is not - except today, which is always a row (item 7:
      // "Movement has no row for today at all"). Today is the row she came to
      // the screen to add to, and an absent one reads as a broken screen.
      .filter(({ key }) => key === todayKey || (byDay.get(key) ?? []).length > 0 || stepsByDay.has(key))
      .map(({ date, key }) => {
        const list = byDay.get(key) ?? [];
        const stepCount = stepsByDay.get(key) ?? null;
        const entries: DayEntry[] = list.map((row) => ({
          id: row.id,
          label: name(row),
          detail: detailOf(row),
          mark: <ActivityIcon kind={activityIcon(row.activity_type)} size={18} />,
          remove: () => removeEntry('activity_logs', row.id, name(row)),
        }));
        return {
          key,
          date,
          summary: (
            <View style={styles.summary}>
              {/* EVERY DAY STARTS WITH STEPS (item 7). A dash rather than a
                  missing figure when the phone recorded none: the column then
                  reads down the page as one thing, and a gap says "not
                  recorded" rather than looking like a layout that failed. */}
              <View style={styles.stepPair}>
                <Ionicons name="footsteps-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="small" themeColor={stepCount == null ? 'textSecondary' : 'text'}>
                  {stepCount == null ? '—' : stepCount.toLocaleString('en-GB')}
                </ThemedText>
              </View>
              {/* NAMES ONLY (item 8). It used to carry every session's
                  duration, intensity and calories, which made the collapsed
                  line longer than the expanded one it was summarising - and
                  then repeated all of it below when the day was opened. A
                  summary that contains everything is not a summary. */}
              {list.length > 0 ? (
                <ThemedText type="small">{list.map((r) => name(r)).join('  ·  ')}</ThemedText>
              ) : null}
            </View>
          ),
          // OPEN, IT IS THE STEPS AND NOTHING ELSE. The entries below carry
          // the sessions; the step count is the only thing on this line they
          // do not already say.
          openSummary: (
            <View style={styles.stepPair}>
              <Ionicons name="footsteps-outline" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor={stepCount == null ? 'textSecondary' : 'text'}>
                {stepCount == null ? '—' : stepCount.toLocaleString('en-GB')}
              </ThemedText>
            </View>
          ),
          at: list[0]?.happened_at ?? null,
          entries,
        };
      });
  }, [byDay, stepsByDay, weekStart, theme.textSecondary]);

  return (
    <View style={styles.wrap}>
      <DayLog
        days={days}
        weekStart={weekStart}
        onWeekStart={setWeekStart}
        isPresent={isCurrentWeek}
        onChanged={() => setReloadKey((k) => k + 1)}
        subject={(date) =>
          `About my movement from ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}: `
        }
        empty="Nothing logged this week."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  summary: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: 2 },
  stepPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
