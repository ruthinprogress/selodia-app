// REST IS SOMETHING THE BODY DOES, NOT SOMETHING THAT HAPPENS WHEN YOU STOP
// (Ruth, 22 September 2026).
//
//   "the Health flower in Today is empty, but I'm pretty sure I've been resting
//   since i've not been doing workouts, so we need to discuss how the rest gets
//   activated"
//
// She was right that the flower was wrong, and the obvious fix would have been
// wrong too. Recovery was only ever earned by DOING something with a recovery
// score - yoga 60, walking 30, pilates 30 - so a genuinely rested week read as
// empty. But counting "did not train" as recovery would mean a week of doing
// nothing at all scoring full marks on that petal, and for an app about body
// literacy that is not a kindness, it is a lie: sustained inactivity is
// deconditioning, not rest.
//
// SO RECOVERY IS EARNED THREE WAYS, and the first one uses something she has
// been logging all along that fed absolutely nothing:
//
//   1. SLEEP. The largest recovery input there is, and it was sitting unused.
//      A good night counts, a broken one counts less, a bad one barely counts.
//   2. A REST DAY THAT FOLLOWS LOAD. A day off after a hard session is real
//      recovery. A day off after a fortnight of nothing is not, and the
//      difference is exactly what the app already records as intensity and
//      eccentric load.
//   3. SAYING SO. "Rest day today" logs as a rest day, which already carries a
//      recovery score of 100 in the activity weights.
//
// The point of all three: it stops a week of sleeping badly and a week of
// sleeping brilliantly producing an identical flower.

/** One night, as sleep_logs stores it. */
export type SleepNight = {
  night_of: string;
  duration_min: number | null;
  quality: string | null;
  awakenings: number | null;
};

/** One session, only the parts that say whether it was hard. */
export type LoadedSession = {
  happened_at: string;
  intensity: string | null;
  eccentric_load: string | null;
};

// A full week of good sleep is worth a full petal on its own, because it
// genuinely is. Seven nights at 28 is 196 against a weekly target of 200, so
// sleeping well all week very nearly fills recovery and one walk finishes it.
export const NIGHT_MAX = 28;

// A rest day taken after real load. Deliberately less than a night's sleep:
// resting is good, sleeping is better, and three rest days in a row should not
// out-score a week of proper nights.
export const REST_DAY_POINTS = 15;

/**
 * How much of a night was actually restorative, 0 to 1.
 *
 * SEVEN TO NINE HOURS IS THE BAND, and more is not better - a ten hour night is
 * usually a body catching up or a body struggling, and scoring it above a
 * settled eight would be rewarding the wrong thing.
 */
export function nightQuality(night: SleepNight): number {
  const hours = night.duration_min != null ? night.duration_min / 60 : null;

  // NOTHING SAID ABOUT LENGTH IS NOT NOTHING. "Slept badly" with no hours is a
  // real entry, and it should count for something rather than be discarded -
  // just less than a night somebody actually measured.
  const byLength =
    hours == null
      ? 0.6
      : hours > 9.5
        ? // A LONG NIGHT IS STILL A GOOD NIGHT, just not a better one. Ten
          // hours is usually a body catching up or a body struggling, and
          // scoring it above a settled eight would reward the wrong thing.
          // Stated here rather than reached by falling through the bands
          // below, which is what it used to do by accident.
          0.9
        : hours >= 7
          ? 1
          : hours >= 6
            ? 0.75
            : hours >= 5
              ? 0.5
              : hours > 0
                ? 0.3
                : 0;

  const byFeel =
    night.quality === 'good'
      ? 1
      : night.quality === 'ok'
        ? 0.8
        : night.quality === 'broken'
          ? 0.5
          : night.quality === 'poor'
            ? 0.3
            : // UNSAID IS NOT BAD. Somebody who logged hours and no word gets
              // most of the credit, not a penalty for being brief.
              0.85;

  // Waking repeatedly takes something off even a long night, because it is the
  // continuity that does the repairing.
  const broken = (night.awakenings ?? 0) >= 3 ? 0.85 : 1;

  return Math.max(0, Math.min(1, byLength * byFeel * broken));
}

/** What a week of nights is worth towards the recovery petal. */
export function recoveryFromSleep(nights: SleepNight[]): number {
  // ONE ROW PER NIGHT, whatever arrives. sleep_logs has a unique constraint on
  // the night, but a caller could still hand over duplicates from two reads.
  const seen = new Set<string>();
  let points = 0;
  for (const n of nights) {
    if (!n?.night_of || seen.has(n.night_of)) continue;
    seen.add(n.night_of);
    points += NIGHT_MAX * nightQuality(n);
  }
  return Math.round(points);
}

/** The day a moment belongs to, as the app counts days. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Whether a session was hard enough that the day after it is real recovery. */
function wasHard(s: LoadedSession): boolean {
  return s.intensity === 'intense' || s.eccentric_load === 'high' || s.eccentric_load === 'moderate';
}

/**
 * Rest days that follow load, within the days given.
 *
 * A DAY OFF ONLY COUNTS IF THERE WAS SOMETHING TO RECOVER FROM. That is the
 * whole distinction between rest and inactivity, and it is the reason this
 * cannot simply reward an empty calendar.
 */
export function recoveryFromRestDays(sessions: LoadedSession[], days: string[]): number {
  const hardDays = new Set<string>();
  const anyDays = new Set<string>();
  for (const s of sessions) {
    const day = dayOf(s.happened_at);
    if (!day) continue;
    anyDays.add(day);
    if (wasHard(s)) hardDays.add(day);
  }

  let rested = 0;
  for (const day of days) {
    if (anyDays.has(day)) continue; // trained that day, so not a rest day
    const before = new Date(`${day}T12:00:00Z`);
    before.setUTCDate(before.getUTCDate() - 1);
    if (hardDays.has(before.toISOString().slice(0, 10))) rested += 1;
  }
  return rested * REST_DAY_POINTS;
}

/** Every day of the week beginning on this date, as YYYY-MM-DD. */
export function daysOfWeek(weekStart: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  return out;
}
