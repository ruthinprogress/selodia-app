import { coverageFor, type Coverage } from '@/lib/activity-weights';
import { DIMENSIONS, WEEKLY_TARGET, type Dimension, type FlowerCoverage } from '@/lib/health-flower';

// WHAT A PLANNED WEEK WOULD COVER.
//
// Ruth, 20 October 2026: "we have a Week Planner, and it doesnt connect to the
// Health Flower at all. Would it be useful to have a health flower in Week so
// the design could help you build a weekly plan that covers what you need?"
//
// THIS IS A DIFFERENT CLAIM FROM THE ONE ON NOW, and the difference is the
// whole reason it is allowed to name gaps. The drawing on Now is made from the
// Movement log: it describes a life already lived, so saying what is missing
// would be a verdict on somebody. This describes a PLAN, and what a plan does
// not cover is a fact about the plan. She drew that line herself:
//
//   "Your Week is where you can timetable/outline your regular activity, see
//    where there may be gaps to support protective movement and make sure
//    you're allowing for enough rest. It's the weekly plan for when all goes to
//    plan."
//
// NOTHING HERE KNOWS WHETHER SHE DID ANY OF IT. The Week has no completion
// column, deliberately, and this must not become one by the back door: it reads
// activity names and days, and nothing else. A card she has never once done
// counts exactly as much as one she never misses, because that is what a plan
// is.
//
// AN UNMATCHED NAME CONTRIBUTES NOTHING AND IS SAID OUT LOUD. The server
// classifies unknown activities with an AI call at log time; doing that here
// would mean a call per unrecognised card every time the tab opens, to answer a
// question about a plan. So an unknown name is reported rather than guessed,
// which is also more useful: "I do not know what Reformer covers" is something
// she can act on, and a silently-dropped card is not.

export type PlannedWeekRow = {
  activity: string;
  /** The days it sits on. Empty means Anytime. */
  days: string[] | null;
};

export type PlannedCoverage = {
  coverage: FlowerCoverage;
  /** Activity names nothing could put a weighting on. */
  unknown: string[];
  /** How many sessions the plan holds, counting a card once per day. */
  sessions: number;
  /** Cards sitting in Anytime, which have no weekly cadence to count. */
  anytime: number;
};

/**
 * Sum what the cards in a week would contribute.
 *
 * ONCE PER DAY IT IS ON, because a card on Tuesday and Thursday is two
 * sessions and the plan is two sessions heavier for it.
 *
 * AN ANYTIME CARD COUNTS FOR NOTHING, which is the opposite of what this did
 * when it was written. Ruth, 20 October 2026: "Anytime shouldn't be in flower
 * as as far as I remember, the recommendations and cumulative protective
 * qualities are weekly. Check thats right though externally."
 *
 * CHECKED, AND IT IS. Every guideline the six dimensions rest on is stated per
 * week: the WHO asks for muscle-strengthening on at least two days each week,
 * 150 to 300 minutes of moderate aerobic activity each week, and for people
 * over 65 balance work on three or more days a week. A card in Anytime has no
 * committed frequency at all - it is "the things you do when they fit" - so
 * counting it as a weekly contribution claims a cadence she never gave, and
 * fills a petal on the strength of an intention.
 *
 * IT IS NOT DROPPED SILENTLY. The caller says how many are sitting there, so
 * the drawing never looks thin for a reason nobody can see.
 */
export function plannedCoverage(
  rows: PlannedWeekRow[],
  /**
   * Coverage already worked out for activities she has logged before, keyed by
   * the lowercased name. See knownFromLogs.
   */
  known?: Record<string, Coverage>
): PlannedCoverage {
  const total: Record<Dimension, number> = {
    strength: 0,
    cardio: 0,
    flexibility: 0,
    balance: 0,
    bone: 0,
    recovery: 0,
  };
  const unknown: string[] = [];
  let sessions = 0;

  let anytime = 0;

  for (const row of rows) {
    const times = row.days?.length ?? 0;
    if (times === 0) {
      // No day, no weekly cadence, no contribution. Counted so it can be said.
      anytime += 1;
      continue;
    }
    // THE TABLE FIRST, THEN HER OWN HISTORY. See knownFrom for why the second
    // one exists and why it is not a guess.
    const weights = coverageFor(row.activity) ?? known?.[row.activity.trim().toLowerCase()] ?? null;
    if (!weights) {
      // Named once however many days it is on: she needs to know the card is
      // not understood, not how often it is not understood.
      if (!unknown.includes(row.activity)) unknown.push(row.activity);
      continue;
    }
    sessions += times;
    for (const d of DIMENSIONS) total[d] += weights[d] * times;
  }

  // THE SAME TARGET AS A LOGGED WEEK, which is what makes the two drawings
  // comparable at all. A plan measured against an easier bar would say a week
  // was covered that the Now flower would then call thin, and she would have no
  // way to tell which was lying.
  const coverage = {} as FlowerCoverage;
  for (const d of DIMENSIONS) {
    coverage[d] = Math.min(100, Math.round((total[d] / WEEKLY_TARGET) * 100));
  }

  return { coverage, unknown, sessions, anytime };
}

/** Below this a dimension counts as not really covered by the plan. */
export const THIN = 25;

/**
 * What the plan does not reach, in her words rather than a shape.
 *
 * WORDS RATHER THAN GHOST PETALS, which was the other way of doing this. A
 * faint outline says "something is missing here" and nothing more; a sentence
 * can say WHICH and can be read without decoding a drawing. It also leaves the
 * approved flower exactly as it is, rather than inventing a second rendering
 * mode that then has to be kept.
 *
 * NEVER A SHOULD. It names what the plan is light on and stops. The step from
 * there is hers, and chat is there if she wants help with it - this is a fact
 * about the timetable, not an instruction.
 */
export function planGapNote(
  c: FlowerCoverage,
  labelOf: (d: Dimension) => string
): string | null {
  const thin = DIMENSIONS.filter((d) => c[d] < THIN);
  if (thin.length === 0) return null;
  if (thin.length === DIMENSIONS.length) return null;

  const names = thin.map((d) => labelOf(d).toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `As it stands, this week is light on ${list}.`;
}

/**
 * The names on scheduled cards that the weighting table does not hold, so the
 * screen can go and ask her own logs about just those. Anytime cards are left
 * out because they contribute nothing either way.
 */
export function unmatchedNames(rows: PlannedWeekRow[]): string[] {
  return [
    ...new Set(
      rows
        .filter((r) => (r.days?.length ?? 0) > 0)
        .map((r) => r.activity)
        .filter((a) => !coverageFor(a))
    ),
  ];
}

/** What to say when the plan is empty, which is not the same as thin. */
export const PLAN_EMPTY =
  'Nothing in your week yet. What you add here is the plan, not a promise.';
