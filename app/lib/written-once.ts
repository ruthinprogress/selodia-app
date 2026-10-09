// THE SAME THING, SAID ONCE, WRITTEN ONCE.
//
// Ruth, 9 October 2026: "run was logged fine, but yoga 60mins was logged 5
// times." She said "It was about an hour" once. A 14.4 second turn was re-sent
// by ElevenLabs five times, each re-send ran a complete turn, and each wrote
// the row.
//
// Activity got a guard that morning. This is that guard, made general, because
// the same slow turn re-sends everything and activity was simply the table she
// happened to be using. Measured afterwards:
//
//   cycle_events     SAFE. Upserts on (user_id, event_date, event_type).
//   sleep_logs       SAFE. Reads the night's existing row and merges into it.
//   food_logs        SAFE. voice-supersede settles a sentence to one set.
//   activity_logs    guarded 9 October, by the function below.
//   hydration_logs   BARE INSERT. Two litres said once became ten.
//   body_measurements  BARE INSERT. Five identical weights in a trend chart.
//   personal_metrics   BARE INSERT.
//
// The last three are why this file exists rather than a fourth copy of the same
// twenty lines. Four copies of a sentence is four chances for one to rot, and
// this repository has learned that specific lesson at least six times.
//
// IT DOES NOT ASK WHY. A retry, a double tap, a dropped connection and a
// genuinely repeated instruction all look the same from here, and the previous
// guards all failed by reasoning about the cause: voice-supersede wants the
// repeat to be LONGER, and the adapter's check asks whether she HEARD the last
// answer. Both are true statements about the usual case that were not true of
// this one. Identical content, minutes apart, is one event.

/**
 * How long two identical writes have to be apart to be two real events.
 *
 * NOT A DAY. Two genuine thirty-minute runs, or two glasses of water, happen in
 * one day and both belong in the table. The repeats this exists for arrived
 * inside thirty-seven seconds; ten minutes leaves room for something worse
 * without swallowing a real second helping.
 */
export const REPEAT_WINDOW_MS = 10 * 60_000;

/**
 * Split what is about to be written into what is new and what is already there.
 *
 * `keyOf` decides what makes two rows the same event, and belongs with the
 * table rather than here - what makes two weights identical is not what makes
 * two mouthfuls of water identical.
 *
 * ROW BY ROW, NOT ALL OR NOTHING. "An hour of yoga and then a 20 minute walk",
 * sent twice, where only the walk is new, must still log the walk.
 *
 * A MATCH IS CLAIMED AS IT IS USED, so one stored row cannot absorb two
 * candidates: if a single request genuinely contains the same thing twice, the
 * second is new. The repeats this guards against arrive as separate requests.
 */
export function splitAlreadyWritten<Candidate, Stored>(
  candidates: readonly Candidate[],
  recent: readonly Stored[],
  keyOf: (row: Candidate | Stored) => string
): { fresh: Candidate[]; alreadyThere: Stored[] } {
  const seen = new Map<string, Stored>();
  for (const row of recent) seen.set(keyOf(row), row);

  const fresh: Candidate[] = [];
  const alreadyThere: Stored[] = [];
  for (const row of candidates) {
    const key = keyOf(row);
    const match = seen.get(key);
    if (match === undefined) {
      fresh.push(row);
    } else {
      seen.delete(key);
      alreadyThere.push(match);
    }
  }
  return { fresh, alreadyThere };
}

/** The moment the window opens, as an ISO string for a `gte` filter. */
export function repeatWindowStart(now: Date = new Date()): string {
  return new Date(now.getTime() - REPEAT_WINDOW_MS).toISOString();
}

/**
 * Normalise a free-text field for comparison.
 *
 * Case and run-together spacing only. Nothing clever: two descriptions that
 * differ in a real word are two different things, and a guard that decided
 * otherwise would drop food somebody actually ate.
 */
export function sameWords(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normalise a number that may arrive as a string.
 *
 * THE ONE THAT WOULD HAVE MADE THE WHOLE GUARD DO NOTHING. Supabase returns a
 * numeric column as the string "60" while the parse produces the number 60, so
 * without this the keys never match, every repeat looks new, and the guard
 * reads correctly while protecting nothing. Caught by a check on 9 October
 * rather than by reading it.
 */
export function sameNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'none';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : 'none';
}
