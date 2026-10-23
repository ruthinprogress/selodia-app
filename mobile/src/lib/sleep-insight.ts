// ONE TRUE SENTENCE ABOUT HER OWN NIGHTS, OR SILENCE.
//
// Ruth's artwork, 23 October 2026, put a card under last night reading "Your
// sleep has been longer on days you go for a morning walk." Her instruction on
// the heading: "dont say 'selodia notices', just the insight I think."
//
// She is right, and it is not only tone. "Selodía noticed" makes the app the
// one doing the noticing, which turns an observation into a verdict delivered
// by somebody. The sentence on its own is just a thing that is true about her
// record, sitting there, for her to decide what it is worth.
//
// WHAT THIS IS ALLOWED TO SAY, and the rules are narrow on purpose:
//
//   1. ONLY WHAT THE RECORD SHOWS, in the past tense. "Your sleep has been
//      longer on days you walked in the morning" is a fact about logged nights.
//      "Walking will fix your sleep" is a promise, and SELODIA_LANGUAGE_RULES
//      and Part Twelve both forbid it. The difference is the whole file.
//   2. NEVER A VERDICT ON A NIGHT. No "you are not getting enough", no target,
//      no score. Sleep has no goal in this app, deliberately.
//   3. SILENCE IS THE DEFAULT AND IS NOT A FAILURE. With seven nights logged
//      there is usually nothing honest to say, and a card that reaches for
//      something is worse than a screen without one.
//
// THE MINIMUM IS ON BOTH SIDES, which is the part that is easy to get wrong. A
// comparison needs enough nights WITH the thing and enough WITHOUT it. Four
// nights of walking against one night of not walking is not a pattern, it is
// one night; and a rule that only counted the total would have shown exactly
// that sentence to somebody with a single counter-example.

/** A night as this file needs it. */
export type InsightNight = {
  nightOf: string;
  minutes: number | null;
};

/** A day's movement, for lining up against the night before or after. */
export type InsightDay = {
  date: string;
  /** Minutes of logged activity on that day. */
  activeMinutes: number;
  /** Whether any of it happened before noon. */
  morning: boolean;
};

/** Nights needed on EACH side before a comparison is allowed to speak. */
export const MIN_EACH_SIDE = 3;

/** How much longer one group must be, in minutes, to be worth a sentence. */
export const MIN_DIFFERENCE_MIN = 20;

function mean(xs: number[]): number {
  return xs.reduce((n, x) => n + x, 0) / xs.length;
}

function dayAfter(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

function hoursAndMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} minutes`;
  return m === 0 ? `${h} hours` : `${h}h ${m}m`;
}

/**
 * The observation, or null.
 *
 * A NIGHT BELONGS TO THE DAY THAT STARTED IT. The night of the 22nd is the
 * sleep after the 22nd's walking, so a morning walk on the 22nd is compared
 * against the night of the 22nd - not the morning after it. Getting this
 * backwards would have produced a sentence that was true of nothing.
 */
export function sleepObservation(
  nights: InsightNight[],
  days: InsightDay[]
): string | null {
  const withMinutes = nights.filter(
    (n): n is InsightNight & { minutes: number } => typeof n.minutes === 'number' && n.minutes > 0
  );
  if (withMinutes.length < MIN_EACH_SIDE * 2) return null;

  const byDate = new Map(days.map((d) => [d.date, d]));

  const walked: number[] = [];
  const didnt: number[] = [];
  for (const night of withMinutes) {
    const day = byDate.get(night.nightOf);
    if (!day) continue;
    (day.morning ? walked : didnt).push(night.minutes);
  }

  // BOTH SIDES, OR NOTHING. See the note at the top: the easy version of this
  // compares one group against a total and calls a single counter-example a
  // pattern.
  if (walked.length < MIN_EACH_SIDE || didnt.length < MIN_EACH_SIDE) return null;

  const difference = mean(walked) - mean(didnt);
  if (Math.abs(difference) < MIN_DIFFERENCE_MIN) return null;

  // ONLY THE DIRECTION THE RECORD ACTUALLY SHOWS. The artwork's sentence is the
  // happy one; the opposite is just as likely to be true, and an insight that
  // can only say the flattering half is an advert.
  const longer = difference > 0;
  const gap = hoursAndMinutes(Math.abs(difference));
  return longer
    ? `Your sleep has been about ${gap} longer on days you moved in the morning.`
    : `Your sleep has been about ${gap} shorter on days you moved in the morning.`;
}

/** The evening a day's sleep belongs to, for lining days up with nights. */
export { dayAfter };
