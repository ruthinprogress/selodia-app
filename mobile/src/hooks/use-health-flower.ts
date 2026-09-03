import { useCallback, useEffect, useState } from 'react';

import {
  coverageFromRows,
  EMPTY_COVERAGE,
  type CoverageRow,
  type FlowerCoverage,
} from '@/lib/health-flower';
import { supabase } from '@/lib/supabase';
import { currentWeekStart, toLocalDateKey } from '@/lib/week';

// This week's Health Flower coverage.
//
// THE WEEK IS MONDAY TO SUNDAY, IN LOCAL TIME, which is what weekStartFor
// already gives every other week-scoped view. Local rather than UTC on purpose:
// a session logged at 23:30 on Sunday belongs to the week the person actually
// experienced it in, and a UTC boundary would move it into the next one.
//
// IT READS STORED COLUMNS, NEVER THE WEIGHTING TABLE. Classification happens
// once, when the row is written (app/lib/activity-weights.ts). This hook only
// sums what is already there, so opening the Overview costs one query and no
// model call.
//
// LOADING IS NOT ZERO. `coverage` is null until the first read returns, so the
// flower can render nothing rather than briefly render six absent petals and
// then pop into shape. An empty week and an unloaded week look identical in a
// bare number and are completely different things to show someone.

export type HealthFlowerState = {
  coverage: FlowerCoverage | null;
  loading: boolean;
  // Set when the read failed. `coverage` still resolves to an empty flower in
  // that case, so a caller that ignores this renders something honest rather
  // than nothing; a caller that checks it can say so.
  error: string | null;
  // How many of this week's rows had no classification. Not shown to anyone yet,
  // but the flower under-reports by exactly this much, and a number that is
  // quietly wrong is worth being able to see from the calling side.
  unclassifiedCount: number;
  reload: () => void;
};

export function useHealthFlower(): HealthFlowerState {
  const [coverage, setCoverage] = useState<FlowerCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [unclassifiedCount, setUnclassified] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Pins the effect to the calendar day. The Monday boundary can move under a
  // session left open overnight - which is exactly what happened while this was
  // being written, at midnight - and this re-reads when it does. Extracted to a
  // variable rather than computed inline so the dependency is statically
  // checkable.
  const todayKey = toLocalDateKey(new Date());

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        const weekStart = currentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const { data, error: readError } = await supabase
          .from('activity_logs')
          .select(
            'cover_strength, cover_cardio, cover_flexibility, cover_balance, cover_bone, cover_recovery'
          )
          // Half-open interval: Monday 00:00 inclusive, next Monday 00:00
          // exclusive. gte/lt rather than gte/lte so a row stamped exactly at
          // midnight cannot land in two weeks at once.
          .gte('happened_at', weekStart.toISOString())
          .lt('happened_at', weekEnd.toISOString());

        if (cancelled) return;
        if (readError) {
          // Fails to an empty flower rather than an error state. A week with no
          // petals is a true-looking thing to show on a screen someone just
          // opened; an error panel over the Overview is not, and the next
          // reload will simply try again.
          console.log('HEALTH FLOWER READ FAILED:', readError.message);
          setError(readError.message);
          setCoverage(EMPTY_COVERAGE);
          setUnclassified(0);
          return;
        }

        const rows = (data ?? []) as CoverageRow[];
        setCoverage(coverageFromRows(rows));
        setUnclassified(rows.filter((r) => r.cover_strength == null).length);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.log('HEALTH FLOWER READ THREW:', message);
          setError(message);
          setCoverage(EMPTY_COVERAGE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, todayKey]);

  return { coverage, loading, error, unclassifiedCount, reload };
}
