// THE WEEK'S FIGURES AS ROWS, WORKED OUT IN CODE.
//
// Ruth, 27 September 2026, item 9: "Weekly roundup: needs a UI pass, and its
// content must agree with itself." Her shape for it: its own card, rows rather
// than prose.
//
// WHY THE ROWS ARE NOT PARSED OUT OF THE REPLY, which was the obvious first idea
// and is wrong. The roundup she was shown said "a week of higher intake, sitting
// under 1,400 kcal on average" over 1,222 kcal, "almost no movement to speak of"
// over a run and a yoga session, and "your 10 readings" over three. Splitting
// that prose into rows would have produced three tidy rows of the same wrong
// figures. A layout cannot rescue a number.
//
// So the card draws its rows from THESE, computed from her own stored rows by the
// same code that already worked them out for the prompt, and the model's words sit
// underneath as the observations they are. The figures and the prose can then be
// wrong in only one way each rather than in two ways that disagree.
//
// THE CONFIDENCE NOTE TRAVELS WITH ITS FIGURE and is never a banner at the top.
// That rule already exists in the roundup's prompt, for the same reason it matters
// here: "averaging 1,222 kcal" and "on the 5 days you logged" are one fact, and a
// disclaimer at the top of a card is read once and then forgotten while the
// numbers are read again and again.

/** One row of the card. `note` is the row's own confidence, never a general one. */
export type RoundupFigure = {
  /** Short, and the same word the app uses elsewhere for that thing. */
  label: string;
  /** The figure, formatted for reading. Empty means nothing was logged. */
  value: string;
  /** What qualifies this row, if anything does. */
  note?: string | null;
};

const WEEK_DAYS = 7;

/** UK thousands separators, because the screen shows 1,222 and not 1222. */
function group(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}

export type FiguresInput = {
  /** Days with a full food log, out of seven. */
  fullDays: number;
  avgKcal: { value: number; confidence: string | null } | null;
  avgProtein: { value: number; confidence: string | null } | null;
  /** The week's weight movement, if there is enough of it to state one. */
  delta: { first: { value: number; date: string }; last: { value: number; date: string }; change: number; readingCount: number } | null;
  /** How many readings there were, whether or not a change can be stated. */
  readingCount: number;
  activity: { activity_type: string | null; duration_min: number | null; intensity: string | null }[];
  /** One total per day that had a drink logged. */
  drinkDayTotals: number[];
  /** Steps per day, for the days the phone recorded any. */
  stepDays: number[];
};

/**
 * The rows, in a fixed order, with every absence stated rather than omitted.
 *
 * NOTHING IS LEFT OUT WHEN IT IS EMPTY. A card with no sleep row reads as a card
 * that does not track sleep; a sleep row saying nothing logged reads as the truth.
 * That is the same rule as app/lib/turn-facts.ts, and it is there because a list
 * somebody has to NOTICE is short is what produced a reply about a workout that
 * never happened.
 */
export function roundupFigures(input: FiguresInput): RoundupFigure[] {
  const rows: RoundupFigure[] = [];

  // FOOD. Calories and protein on one row, because they are read together and two
  // rows of averages over the same five days invites the reader to think one of
  // them covers a different week.
  if (input.avgKcal || input.avgProtein) {
    const parts = [
      input.avgKcal ? `${group(input.avgKcal.value)} kcal` : null,
      input.avgProtein ? `${group(input.avgProtein.value)} g protein` : null,
    ].filter(Boolean);
    rows.push({
      label: 'Food',
      value: `${input.fullDays} of ${WEEK_DAYS} days, averaging ${parts.join(' and ')}`,
      note:
        input.fullDays < WEEK_DAYS
          ? `average of the ${input.fullDays} logged day${input.fullDays === 1 ? '' : 's'}`
          : null,
    });
  } else {
    rows.push({ label: 'Food', value: 'nothing logged this week' });
  }

  // MOVEMENT. Named, because "2 sessions" is a count and she asked what she did.
  if (input.activity.length > 0) {
    const named = input.activity
      .map((a) => {
        const kind = (a.activity_type ?? 'movement').trim();
        return a.duration_min ? `${kind}, ${a.duration_min} min` : kind;
      })
      .join('; ');
    rows.push({ label: 'Movement', value: named });
  } else {
    rows.push({ label: 'Movement', value: 'no sessions logged' });
  }

  // STEPS, separate from movement, because a day with 9,820 steps and no session
  // is not a day without movement and the two were being conflated.
  if (input.stepDays.length > 0) {
    const total = input.stepDays.reduce((a, b) => a + b, 0);
    rows.push({
      label: 'Steps',
      value: `averaging ${group(total / input.stepDays.length)} a day`,
      note:
        input.stepDays.length < WEEK_DAYS
          ? `recorded on ${input.stepDays.length} of ${WEEK_DAYS} days`
          : null,
    });
  } else {
    rows.push({ label: 'Steps', value: 'nothing recorded' });
  }

  // DRINKS. The average is per day with a drink logged, with the count beside it,
  // because 1.6 L across two days is not a week of 1.6 L a day.
  if (input.drinkDayTotals.length > 0) {
    const avg = input.drinkDayTotals.reduce((a, b) => a + b, 0) / input.drinkDayTotals.length;
    rows.push({
      label: 'Drinks',
      value: `${input.drinkDayTotals.length} of ${WEEK_DAYS} days, averaging ${group(avg)} ml`,
      note:
        // SAID LIKE THE FOOD ROW (Ruth, 12 October 2026: "'A day nobody
        // recorded' is weird"). The point was never philosophy, only that the
        // average leaves out the blank days.
        input.drinkDayTotals.length < WEEK_DAYS
          ? `average of the ${input.drinkDayTotals.length} logged day${input.drinkDayTotals.length === 1 ? '' : 's'}`
          : null,
    });
  } else {
    rows.push({ label: 'Drinks', value: 'nothing logged this week' });
  }

  // WEIGH-INS. THE COUNT ALWAYS, and the change only when there is enough to
  // state one. "Your 10 readings show a real trend downward" was written over
  // three readings; a row that leads with the count cannot be read that way.
  if (input.delta) {
    // THE CHANGE FROM THE TWO VALUES SHOWN, to the hundredth, so the row adds
    // up: 56.4 to 56.05 is -0.35, and a rounded "-0.3" beside them reads as a
    // sum that does not work.
    const change = Math.round((input.delta.last.value - input.delta.first.value) * 100) / 100;
    const sign = change > 0 ? '+' : '';
    rows.push({
      label: 'Weigh-ins',
      value: `${input.delta.readingCount} readings, ${input.delta.first.value} to ${input.delta.last.value} kg (${sign}${change} kg)`,
      // A KILO EITHER WAY IS A NORMAL DAY (Ruth, 12 October 2026, on a week
      // from 56.4 to 56.05 kg: "the weight is not statistically significant.
      // And the account is set to maintain"). Water and food alone move a
      // scale by more than that between mornings, so a smaller change is said
      // to be within it, whatever the goal - and a count too small to read
      // is said second.
      note:
        Math.abs(change) < 1
          ? 'within normal day-to-day change'
          : input.delta.readingCount < 4
            ? 'too few to show a trend'
            : null,
    });
  } else if (input.readingCount === 1) {
    rows.push({
      label: 'Weigh-ins',
      value: '1 reading, so no change to show',
    });
  } else {
    rows.push({ label: 'Weigh-ins', value: 'none logged this week' });
  }

  return rows;
}
