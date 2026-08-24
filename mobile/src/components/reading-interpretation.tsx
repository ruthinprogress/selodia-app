import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  ACTIVITY_LOOKBACK_HOURS,
  FOOD_LOOKBACK_HOURS,
  READING_HISTORY_LIMIT,
  hoursBefore,
  splitReadings,
  toActivityContexts,
  toFoodContexts,
  type RawActivity,
  type RawFood,
  type RawReading,
} from '@/lib/measurement-context';
import {
  interpretLatestReading,
  type ReadingInterpretation,
} from '@/lib/measurement-interpretation';
import { supabase } from '@/lib/supabase';

// What the latest reading actually means (build item 38, slice 2) - the Body
// Measurement Interpretation Layer, Part Nine, finally reaching a screen.
//
// SCOPE. This is a live statement about the CURRENT reading, which is why it
// sits above the table rather than on a row, and why it is computed on read.
// The per-entry PERSISTED note described under Persisted Interpretation Notes
// is a different artefact: a point-in-time diary entry attached to one
// body_measurements row, shown by that row's discuss-card. That needs a column,
// a write at log time, and the discuss-card itself (item 30 slice 4) - none of
// which exist yet. Building the live glance first does not block it; the same
// pure function composes both.
//
// It renders nothing at all when there is nothing worth saying. interpretLatest-
// Reading returns null for a clean drop with no caveats and for a sparse history
// with no noise flags, and both of those are correct silences: a reassurance
// nobody needed would be noise, and a direction claimed from two readings would
// be a lie (Part Nine's sparse-data rule).

export function ReadingInterpretationNote() {
  const [note, setNote] = useState<ReadingInterpretation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes every read to the signed-in user.
      const [{ data: readings }, { data: lastPeriod }] = await Promise.all([
        supabase
          .from('body_measurements')
          .select('measured_at, weight_kg')
          .order('measured_at', { ascending: false })
          .limit(READING_HISTORY_LIMIT),
        supabase
          .from('cycle_events')
          .select('event_date')
          .eq('event_type', 'period_start')
          .order('event_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const split = splitReadings((readings ?? []) as RawReading[]);
      if (!split) return; // nothing logged yet - the table's empty state covers it

      // These two windows are anchored to the reading, so they can only be
      // queried once it is known.
      const [{ data: activities }, { data: foods }] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('happened_at, eccentric_load')
          .gte('happened_at', hoursBefore(split.latest.measured_at, ACTIVITY_LOOKBACK_HOURS))
          .lte('happened_at', split.latest.measured_at),
        supabase
          .from('food_logs')
          .select('happened_at, sodium_mg')
          .gte('happened_at', hoursBefore(split.latest.measured_at, FOOD_LOOKBACK_HOURS))
          .lte('happened_at', split.latest.measured_at),
      ]);

      const result = interpretLatestReading({
        latest: { weightKg: split.latest.weight_kg, measuredAt: split.latest.measured_at },
        priorWeights: split.priorWeights,
        lastPeriodStart: lastPeriod?.event_date ?? null,
        recentActivities: toActivityContexts((activities ?? []) as RawActivity[]),
        priorMeasuredAts: split.priorMeasuredAts,
        recentFoods: toFoodContexts((foods ?? []) as RawFood[]),
      });

      if (!cancelled) setNote(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!note) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small">{note.message}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
