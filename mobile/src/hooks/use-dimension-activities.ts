import { useEffect, useState } from 'react';

import { COVER_COLUMN, type Dimension } from '@/lib/health-flower';
import { supabase } from '@/lib/supabase';
import { currentWeekStart, toLocalDateKey } from '@/lib/week';

// The activities that fed one dimension this week.
//
// FILTERED ON THE DIMENSION'S OWN COLUMN, greater than zero. Two rows are
// excluded and they are excluded for different reasons: a null means the
// activity was never classified, and a zero means it was classified and
// genuinely contributes nothing here. Neither belongs in a list headed "what
// built this petal", but only the first is a gap in the app rather than a fact
// about the activity.
//
// UNCLASSIFIED ACTIVITIES ARE INVISIBLE HERE, and that is a known hole rather
// than a decision. 7 of 22 existing rows have no classification, so a week
// containing "Rocket Yoga Strength + Meditation" shows a flower that does not
// count it and a list that does not mention it. Accepted for now; it closes
// when the classifier is built.

export type DimensionActivity = {
  id: string;
  activity_type: string | null;
  duration_min: number | null;
  happened_at: string;
  contribution: number;
};

export type DimensionActivitiesState = {
  activities: DimensionActivity[] | null;
  loading: boolean;
  error: string | null;
};

export function useDimensionActivities(dimension: Dimension | null): DimensionActivitiesState {
  const [activities, setActivities] = useState<DimensionActivity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const todayKey = toLocalDateKey(new Date());

  useEffect(() => {
    // No dimension means nothing to fetch. Returning early rather than
    // setting state: whether there is a dimension is known during render, so
    // resolving it in an effect would be a cascading render for a value that
    // never needed one - see the empty-case handling in the return below.
    if (dimension == null) return;
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        const column = COVER_COLUMN[dimension];
        const weekStart = currentWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // Static select rather than a template. Supabase types the select
        // string at compile time, so an interpolated column name is not a
        // column it can parse - all six come back and the one in play is
        // picked out below. The filter still uses the dynamic name, which is
        // fine because gt() takes a plain string.
        const { data, error: readError } = await supabase
          .from('activity_logs')
          .select(
            'id, activity_type, duration_min, happened_at, cover_strength, cover_cardio, cover_flexibility, cover_balance, cover_bone, cover_recovery'
          )
          .gte('happened_at', weekStart.toISOString())
          .lt('happened_at', weekEnd.toISOString())
          .gt(column, 0)
          .order('happened_at', { ascending: false });

        if (cancelled) return;
        if (readError) {
          console.log('DIMENSION ACTIVITIES READ FAILED:', readError.message);
          setError(readError.message);
          setActivities([]);
          return;
        }

        const rows = (data ?? []) as unknown as Record<string, unknown>[];
        setActivities(
          rows.map((r) => ({
            id: String(r.id),
            activity_type: (r.activity_type as string | null) ?? null,
            duration_min:
              typeof r.duration_min === 'number' && Number.isFinite(r.duration_min)
                ? r.duration_min
                : null,
            happened_at: String(r.happened_at),
            contribution: Number(r[column]) || 0,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.log('DIMENSION ACTIVITIES THREW:', message);
          setError(message);
          setActivities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dimension, todayKey]);

  // The null-dimension case is resolved here rather than in state, so the
  // hook still answers honestly for a caller that has not got a dimension yet.
  if (dimension == null) return { activities: [], loading: false, error: null };
  return { activities, loading, error };
}
