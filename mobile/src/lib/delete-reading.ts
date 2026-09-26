import { supabase } from '@/lib/supabase';
import type { TrackedMetric } from '@/lib/tracked-metrics';

// REMOVING ONE MEASUREMENT (Ruth, 26 September 2026: "This is needed. Please
// suggest solution to bring back the functionality per line to delete, without
// the eye.")
//
// THE HARD PART IS NOT THE DELETE, IT IS WHAT "ONE" MEANS. A day on the
// Measurements screen can show five readings, and they do not live in the same
// shape underneath:
//
//   weight, body fat, muscle   THREE COLUMNS OF ONE ROW. A scale writes all
//                              three at once, so they share a row and a
//                              timestamp.
//   waist, thighs, anything    A ROW EACH in personal_metrics, written
//                              separately, because a tape measure records
//                              whatever somebody chose to measure.
//
// So deleting "the weight from Thursday" cannot delete a row: the body fat and
// muscle measured in the same moment would go with it, and she would lose two
// readings she never asked to lose. It has to null one column.
//
// AND A ROW OF THREE NULLS IS NOT A READING. Once the last figure on a scale
// row is cleared the row says nothing at all, so it goes rather than sitting in
// the table as an empty timestamp - which would show up in exports and reports
// as a reading that happened and measured nothing.
//
// THE OLD CONTROL DELETED THE WHOLE ROW. The eye icon opened a card whose
// delete removed the scale row entire, all three figures together. That was
// never per-reading; it only looked like it on a day when the scale had
// recorded one thing. Worth knowing when reading her "bring back the
// functionality": what comes back is finer than what went.

/** Which scale column a metric reads, or null when it is not a scale metric. */
const scaleColumns = ['weight_kg', 'body_fat_pct', 'muscle_kg'] as const;
type ScaleColumn = (typeof scaleColumns)[number];

export type DeleteOutcome =
  | { done: true; what: 'value' | 'row' }
  | { done: false; reason: 'not-found' | 'failed' };

/**
 * Remove ONE metric's reading, taken at one moment.
 *
 * `at` is the reading's own timestamp as the screen has it, which is how the
 * right row is found without the screen having to carry ids for two different
 * tables.
 */
export async function deleteReading(metric: TrackedMetric, at: string): Promise<DeleteOutcome> {
  return metric.source === 'scale'
    ? deleteScaleValue(metric.field as ScaleColumn | undefined, at)
    : deletePersonalValue(metric.name ?? metric.label, at);
}

async function deleteScaleValue(column: ScaleColumn | undefined, at: string): Promise<DeleteOutcome> {
  if (!column || !scaleColumns.includes(column)) return { done: false, reason: 'not-found' };

  // RLS scopes this to the signed-in person's own rows.
  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, weight_kg, body_fat_pct, muscle_kg, bmr')
    .eq('measured_at', at)
    .maybeSingle();

  if (error) {
    console.log('DELETE READING: could not read the row -', error.message);
    return { done: false, reason: 'failed' };
  }
  if (!data) return { done: false, reason: 'not-found' };

  const row = data as Record<string, number | string | null>;
  // What is left once this figure goes. bmr counts: a scale that reported a
  // basal rate recorded something, even with every other column cleared.
  const remaining = [...scaleColumns, 'bmr'].filter((c) => c !== column && row[c] != null);

  if (remaining.length === 0) {
    const { error: delError } = await supabase.from('body_measurements').delete().eq('id', row.id);
    if (delError) {
      console.log('DELETE READING: could not remove the empty row -', delError.message);
      return { done: false, reason: 'failed' };
    }
    return { done: true, what: 'row' };
  }

  const { error: updError } = await supabase
    .from('body_measurements')
    .update({ [column]: null })
    .eq('id', row.id);
  if (updError) {
    console.log('DELETE READING: could not clear the value -', updError.message);
    return { done: false, reason: 'failed' };
  }
  return { done: true, what: 'value' };
}

async function deletePersonalValue(name: string, at: string): Promise<DeleteOutcome> {
  const wanted = name.trim().toLowerCase();

  // Matched on the moment AND the name, because several metrics can be written
  // seconds apart and the timestamp alone would not pick one out. Read first so
  // a name that differs only by capitals still matches, which is how these
  // arrive - the conversation writes them.
  const { data, error } = await supabase
    .from('personal_metrics')
    .select('id, metric_name, measured_at, created_at')
    .or(`measured_at.eq.${at},created_at.eq.${at}`);

  if (error) {
    console.log('DELETE READING: could not read the rows -', error.message);
    return { done: false, reason: 'failed' };
  }

  const match = ((data ?? []) as { id: string; metric_name: string }[]).find(
    (r) => r.metric_name.trim().toLowerCase() === wanted
  );
  if (!match) return { done: false, reason: 'not-found' };

  const { error: delError } = await supabase.from('personal_metrics').delete().eq('id', match.id);
  if (delError) {
    console.log('DELETE READING: could not remove the row -', delError.message);
    return { done: false, reason: 'failed' };
  }
  return { done: true, what: 'row' };
}

/** What the screen says afterwards. Never the model, and never a guess. */
export function deleteReadingMessage(metric: TrackedMetric, outcome: DeleteOutcome): string {
  if (outcome.done) return `${metric.label} removed.`;
  if (outcome.reason === 'not-found') {
    return `I could not find that ${metric.label.toLowerCase()} reading, so nothing has been removed.`;
  }
  return `Something went wrong removing that ${metric.label.toLowerCase()}, so nothing has changed.`;
}
