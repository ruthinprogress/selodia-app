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

/**
 * Everything needed to put a reading back exactly as it was.
 *
 * WHY THE VALUES TRAVEL WITH THE DELETE (Ruth, 26 September 2026, item 8): "I
 * deleted Thu 24 Sept's readings by mistake and had no way to get them back.
 * Re-entering them through chat isn't a real fallback: users don't remember
 * exact values (I re-entered from memory and rounded, so that day's record is
 * now less accurate than the original)."
 *
 * That last clause is the whole argument. An undo that asks somebody to retype
 * a number is not an undo, it is a second chance to be wrong - and a body
 * record that has been rounded from memory is worse than one with a gap in it,
 * because the gap is honest and the rounding is not.
 *
 * So the figures are carried out of the delete itself, before anything is
 * written, and the restore puts back what was actually there rather than what
 * anyone remembers.
 */
export type ReadingRestore =
  | { kind: 'scale-value'; id: string; column: ScaleColumn; value: number }
  | { kind: 'scale-row'; row: Record<string, unknown> }
  | { kind: 'personal-row'; row: Record<string, unknown> }
  /** A whole day: every reading that was removed, restored together. */
  | { kind: 'several'; items: ReadingRestore[] };

export type DeleteOutcome =
  | { done: true; what: 'value' | 'row'; restore: ReadingRestore }
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
    // EVERYTHING, not the four columns this function reasons about: a row that
    // gets deleted has to be restorable whole, and a column left out here is a
    // column silently lost on undo.
    .select('*')
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
    return { done: true, what: 'row', restore: { kind: 'scale-row', row } };
  }

  const previous = row[column];

  const { error: updError } = await supabase
    .from('body_measurements')
    .update({ [column]: null })
    .eq('id', row.id);
  if (updError) {
    console.log('DELETE READING: could not clear the value -', updError.message);
    return { done: false, reason: 'failed' };
  }
  return {
    done: true,
    what: 'value',
    restore: { kind: 'scale-value', id: String(row.id), column, value: Number(previous) },
  };
}

async function deletePersonalValue(name: string, at: string): Promise<DeleteOutcome> {
  const wanted = name.trim().toLowerCase();

  // Matched on the moment AND the name, because several metrics can be written
  // seconds apart and the timestamp alone would not pick one out. Read first so
  // a name that differs only by capitals still matches, which is how these
  // arrive - the conversation writes them.
  const { data, error } = await supabase
    .from('personal_metrics')
    // The whole row, for the same reason as the scale read above.
    .select('*')
    .or(`measured_at.eq.${at},created_at.eq.${at}`);

  if (error) {
    console.log('DELETE READING: could not read the rows -', error.message);
    return { done: false, reason: 'failed' };
  }

  const match = ((data ?? []) as Record<string, unknown>[]).find(
    (r) => String(r.metric_name ?? '').trim().toLowerCase() === wanted
  );
  if (!match) return { done: false, reason: 'not-found' };

  const { error: delError } = await supabase.from('personal_metrics').delete().eq('id', match.id);
  if (delError) {
    console.log('DELETE READING: could not remove the row -', delError.message);
    return { done: false, reason: 'failed' };
  }
  return { done: true, what: 'row', restore: { kind: 'personal-row', row: match } };
}

/**
 * Put back exactly what was removed.
 *
 * Idempotent by shape rather than by check: a restored row carries its original
 * id, so pressing undo twice writes the same row twice and the second is a
 * no-op conflict rather than a duplicate reading.
 */
export async function restoreReading(restore: ReadingRestore): Promise<boolean> {
  if (restore.kind === 'several') {
    // Sequential, because two of them can be columns of the same row and the
    // second has to see what the first put back. All or nothing is reported:
    // a partial restore is exactly the silent half-success this app keeps
    // finding, so it is said plainly instead.
    let all = true;
    for (const item of restore.items) if (!(await restoreReading(item))) all = false;
    return all;
  }

  if (restore.kind === 'scale-value') {
    const { error } = await supabase
      .from('body_measurements')
      .update({ [restore.column]: restore.value })
      .eq('id', restore.id);
    if (error) console.log('RESTORE READING: could not put the value back -', error.message);
    return !error;
  }

  const table = restore.kind === 'scale-row' ? 'body_measurements' : 'personal_metrics';
  const { error } = await supabase.from(table).upsert(restore.row);
  if (error) console.log('RESTORE READING: could not put the row back -', error.message);
  return !error;
}

/** What the screen says afterwards. Never the model, and never a guess. */
export function deleteReadingMessage(metric: TrackedMetric, outcome: DeleteOutcome): string {
  if (outcome.done) return `${metric.label} removed.`;
  if (outcome.reason === 'not-found') {
    return `I could not find that ${metric.label.toLowerCase()} reading, so nothing has been removed.`;
  }
  return `Something went wrong removing that ${metric.label.toLowerCase()}, so nothing has changed.`;
}
