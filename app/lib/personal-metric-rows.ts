// BUILDING A personal_metrics ROW.
//
// ITS OWN FILE SO IT CAN BE TESTED WITHOUT SPENDING MONEY. It used to sit
// inside measurement-logging.ts, which reaches next/server through
// usage-record.ts, so importing it into a check pulled in the whole Next
// runtime and failed. A pure function that decides how somebody's measurement
// is named should not need a web framework to be checked.
//
// The type lives here too, imported where it is needed.

import type { ParsedPersonalMetric } from './measurement-logging';

/** A row as it goes into personal_metrics. */
export type PersonalMetricRow = {
  user_id: string;
  measured_at: string;
  metric_name: string;
  value: number | null;
  value_secondary: number | null;
  unit: string | null;
  raw_input: string;
};

/**
 * BUILDING THE ROWS, AND THE ONE GUARD THAT WAS ONLY EVER A PROMPT.
 *
 * The instruction above hands the model the names she already tracks and asks
 * it to reuse them, "without this, 'my waist', 'waist' and 'Waist' become three
 * separate metrics and the table grows a row per phrasing". That comment has
 * been right since the day it was written and nothing enforced it: the row
 * builder trimmed the name and stored whatever came back.
 *
 * It has held so far - her table has waist, thighs and calf, all lower case -
 * which is exactly what makes it the dangerous kind of bug. It is one capital
 * letter away from splitting her waist history in two, on a screen whose whole
 * job is to show a measurement moving over time, and nothing would look wrong:
 * there would simply be two metrics, each with a shorter history.
 *
 * So the reconciliation happens here, where the row is made. A name that
 * matches one she already tracks, ignoring case and punctuation, is stored
 * with HER existing spelling. A genuinely new name - a head, a finger - is
 * kept exactly as she said it.
 *
 * Exported and pure so it can be tested without spending a model call.
 */
export function personalRowsFrom(
  personal: ParsedPersonalMetric[],
  ctx: { known: string[]; userId: string; measuredAt: string; rawInput: string }
): PersonalMetricRow[] {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const byKey = new Map(ctx.known.map((n) => [key(n), n]));

  return personal
    .map((m) => {
      const said = String(m?.name ?? '').trim().slice(0, 60);
      return {
        user_id: ctx.userId,
        measured_at: ctx.measuredAt,
        // Her spelling wins when she already has one; a new name stands as said.
        metric_name: byKey.get(key(said)) ?? said,
        value: typeof m?.value === 'number' && isFinite(m.value) ? m.value : null,
        value_secondary:
          typeof m?.value_secondary === 'number' && isFinite(m.value_secondary)
            ? m.value_secondary
            : null,
        unit: typeof m?.unit === 'string' && m.unit.trim() ? m.unit.trim().slice(0, 16) : null,
        raw_input: ctx.rawInput,
      };
    })
    // A metric with no name or no number is not a measurement, it is a
    // misparse. Dropped rather than stored, on the same grounds as the
    // empty-scale-row guard: a nameless row would sit in her table forever.
    .filter((r) => r.metric_name.length > 0 && r.value != null);
}

