// WHEN A READING WAS ACTUALLY TAKEN (Ruth, 24 September 2026).
//
// She photographed her scale app, and the reading was filed on
// 24 September 2024. Two years out, from one wrong digit.
//
// One wrong year produced four visible faults in a single message:
//
//   "Tuesday 24 September · weigh-in logged"   24 Sept 2024 was a Tuesday.
//   "Weight's up 0.5 kg since yesterday"       It was down 0.5.
//   "you're on your period (cycle day 3)"      It was day 4.
//   ...and the reading vanished from this week entirely.
//
// The last three follow from the first. A row dated 2024 does not sort as the
// newest, so everything that asks the database for "the latest reading" found
// YESTERDAY's and described that instead, while the figures in the header came
// from the photograph. The app was reading two different days at once and said
// neither of them out loud.
//
// THE PROMPT ALREADY ASKED FOR THIS. In parse-body-measurement's own words:
// "If a day and month are visible but no year, assume the year 2026 (the
// current year) rather than guessing a different year." It is explicit, it
// names the failure, and the model did it anyway. A rule the model is asked to
// follow is not a guard, for the fourth time on this project.
//
// WHAT THIS DOES NOT DO. It does not refuse an old reading. Somebody catching
// up on a scale screenshot from three weeks ago is doing something ordinary and
// the date they photographed is the right one. Only a date that cannot be what
// it claims is touched.

/** A year either side is generous for a genuine catch-up and far short of the two this missed by. */
const OLDEST_PLAUSIBLE_DAYS = 400;

/** Clocks drift and time zones differ; beyond a day it is not drift. */
const FUTURE_TOLERANCE_MS = 36 * 60 * 60 * 1000;

export type MeasuredWhen = {
  /** The timestamp to store. */
  iso: string;
  /** What was changed, for the log. Null when the parsed value was kept. */
  corrected: string | null;
};

/**
 * The most recent moment with this day, month and time at or before `now`.
 *
 * A scale screenshot shows "24 Sept 07:24" and usually no year, so when the
 * year is impossible the day and month are still good evidence: the reading was
 * taken on the most recent 24 September, which is today. Keeping them and
 * fixing only the year recovers the real reading rather than discarding it.
 */
function mostRecentSuchDay(when: Date, now: Date): Date {
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      when.getUTCMonth(),
      when.getUTCDate(),
      when.getUTCHours(),
      when.getUTCMinutes(),
      when.getUTCSeconds()
    )
  );
  // 29 February in a non-leap year rolls into March; a day that does not exist
  // this year is not evidence, so fall back to the year it was given.
  if (candidate.getUTCMonth() !== when.getUTCMonth()) return when;
  if (candidate.getTime() - now.getTime() > FUTURE_TOLERANCE_MS) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() - 1);
  }
  return candidate;
}

/**
 * The timestamp to store for a reading, given whatever the parse produced.
 *
 * Pure, so the edges are testable: scripts/probe-measured-when.mjs.
 */
export function measuredWhen(parsedIso: unknown, now: Date = new Date()): MeasuredWhen {
  const raw = typeof parsedIso === 'string' ? parsedIso.trim() : '';
  if (!raw) return { iso: now.toISOString(), corrected: null };

  const when = new Date(raw);
  if (isNaN(when.getTime())) {
    return { iso: now.toISOString(), corrected: `"${raw}" is not a date; used now` };
  }

  const ageMs = now.getTime() - when.getTime();

  // Ahead of the clock. A scale cannot have weighed somebody tomorrow.
  if (ageMs < -FUTURE_TOLERANCE_MS) {
    const fixed = mostRecentSuchDay(when, now);
    return {
      iso: fixed.toISOString(),
      corrected: `${raw} is in the future; read as ${fixed.toISOString()}`,
    };
  }

  // Far enough back that the year is the only thing that can be wrong.
  if (ageMs > OLDEST_PLAUSIBLE_DAYS * 24 * 60 * 60 * 1000) {
    const fixed = mostRecentSuchDay(when, now);
    return {
      iso: fixed.toISOString(),
      corrected: `${raw} is more than ${OLDEST_PLAUSIBLE_DAYS} days old; read as ${fixed.toISOString()}`,
    };
  }

  return { iso: when.toISOString(), corrected: null };
}
