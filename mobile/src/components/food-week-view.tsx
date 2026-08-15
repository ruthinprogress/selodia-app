import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { dayLabel, daysOfWeek, toLocalDateKey, weekLabel, weekRange } from '@/lib/week';

// One week of logged data, as a day-by-day table, addressed entirely by
// `weekStart` — it never reads "today" itself — so a default mount, a future
// week-step, and a chat deep-link all drive it the same way. Entries render as
// quiet rows under each day; the per-entry "What's In Here" eye icon (item 13)
// will attach to these rows in a later slice.
//
// REPOINTED (2026-08-15, per the confirmed mockup): this weekly-table mechanic
// is structurally the MEASUREMENTS segment's weekly table (body data: Wt /
// Muscle / ±), not the Food segment. When Measurements is built, this ports
// there; the Food segment instead gets a lighter, genuinely new today's-log
// view (today's entries + total + a one-line weekly average). `week.ts` stays
// shared. See UNFLUMP_SPEC.md — The Measurements Segment / The Food Segment.
type FoodLogRow = {
  id: string;
  happened_at: string;
  meal_label: string | null;
  kcal: number | null;
  protein_g: number | null;
};

export function FoodWeekView({ weekStart }: { weekStart: Date }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FoodLogRow[]>([]);
  // Stable primitive dep: a fresh Date each render would refire the effect.
  const weekKey = toLocalDateKey(weekStart);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      // RLS scopes the read to the signed-in user — no explicit user_id filter.
      const { data } = await supabase
        .from('food_logs')
        .select('id, happened_at, meal_label, kcal, protein_g')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: true });
      if (!cancelled) {
        setRows((data ?? []) as FoodLogRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart; weekStart is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  // Group logs by their LOCAL calendar day (see week.ts on why not UTC).
  const byDay = useMemo(() => {
    const map = new Map<string, FoodLogRow[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  const days = daysOfWeek(weekStart);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {weekLabel(weekStart)}
      </ThemedText>

      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          …
        </ThemedText>
      ) : (
        days.map((day) => {
          const entries = byDay.get(toLocalDateKey(day)) ?? [];
          return (
            <ThemedView key={toLocalDateKey(day)} type="backgroundElement" style={styles.dayCard}>
              <ThemedText type="smallBold">{dayLabel(day)}</ThemedText>
              {entries.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Nothing logged.
                </ThemedText>
              ) : (
                entries.map((e) => (
                  <ThemedView key={e.id} style={styles.entryRow}>
                    <ThemedText type="small" style={styles.entryLabel}>
                      {e.meal_label ?? 'Food'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {macroLine(e)}
                    </ThemedText>
                  </ThemedView>
                ))
              )}
            </ThemedView>
          );
        })
      )}
    </ThemedView>
  );
}

// A quiet one-line macro summary — understated, never a spreadsheet row.
function macroLine(e: FoodLogRow): string {
  const parts: string[] = [];
  if (e.kcal != null) parts.push(`${Math.round(e.kcal)} kcal`);
  if (e.protein_g != null) parts.push(`${Math.round(e.protein_g)}g protein`);
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  dayCard: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  entryLabel: {
    flexShrink: 1,
  },
});
