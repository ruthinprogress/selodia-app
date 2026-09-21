// HOW A DAY FELT, AND THE WORDS FOR SAYING SO.
//
// Ruth, 21 September 2026, reversing her own earlier decision and saying why -
// which is the part worth keeping:
//
//   "I'm rethinking mood ... it was something I didnt want because before we
//   had a different approach but it's sort of evolved as i realised that just
//   voice logging meant that users had no idea what was available ... catching
//   things like low mood always 2 days after cocktails eg, could genuinely be
//   unknown to a user and needs something to check if Ai says it."
//
// Then, a minute later: "Not just mood, energy levels, etc."
//
// THE LAST CLAUSE OF THE FIRST QUOTE IS WHY THIS EXISTS. Selodía is allowed to
// notice patterns; a pattern about somebody's mood that cannot be checked
// against anything is an assertion about their inner life. This is the record
// it gets checked against.
//
// FIVE WORDS, NOT TEN NUMBERS. A 1-to-10 score invites a precision nobody
// possesses and reads as a grade on the day. Five ordered words are comparable
// enough to sit beside a fortnight of drinks in a table - which is the whole
// point - and stay the kind of thing a person would actually say out loud.
//
// THE NUMBER IS UNDERNEATH, and always runs low to high, so a chart never has
// to ask which way is up and two measures can share a column.

export type MeasureId = string;

export type Measure = {
  id: MeasureId;
  label: string;
  /** What the row asks, in the second person. */
  question: string;
  /** Five words, lowest first. The index is the stored value minus one. */
  words: [string, string, string, string, string];
};

export const MEASURES: Measure[] = [
  {
    id: 'mood',
    label: 'Mood',
    question: 'How has today felt?',
    words: ['Low', 'Flat', 'Steady', 'Good', 'Bright'],
  },
  {
    id: 'energy',
    label: 'Energy',
    question: 'And how much have you had in the tank?',
    words: ['Drained', 'Tired', 'Steady', 'Lively', 'Buzzing'],
  },
];

export function measure(id: MeasureId): Measure | null {
  return MEASURES.find((m) => m.id === id) ?? null;
}

/** The word for a stored value, or null when the value makes no sense. */
export function wordFor(id: MeasureId, value: number | null | undefined): string | null {
  const m = measure(id);
  if (!m || value == null) return null;
  const at = Math.round(value) - 1;
  return at >= 0 && at < m.words.length ? m.words[at] : null;
}

export type Rating = { measure: MeasureId; value: number; note: string | null };

/** A day's ratings, keyed by measure, from rows as the database returns them. */
export function ratingsByMeasure(rows: { measure: string; value: number; note: string | null }[]): Record<string, Rating> {
  const out: Record<string, Rating> = {};
  for (const r of rows) {
    if (!measure(r.measure)) continue;
    const value = Math.round(Number(r.value));
    if (!Number.isFinite(value) || value < 1 || value > 5) continue;
    out[r.measure] = { measure: r.measure, value, note: r.note ?? null };
  }
  return out;
}

/**
 * WHAT A DAY LOOKED LIKE BESIDE WHAT CAME BEFORE IT.
 *
 * Her question, and the reason any of this is being built: "could the user say,
 * run a report on all days i drank cocktails and my mood the following days?"
 *
 * This is the arithmetic half of that - given the days something happened, and
 * a set of ratings, line up the ratings on the days AFTER by the offsets asked
 * for. It states nothing and concludes nothing: it puts the rows side by side
 * so a person can see whether there is anything there.
 *
 * THAT RESTRAINT IS THE DESIGN, not caution. Three matching days is a
 * coincidence, not a finding, and an app that says "your mood dips two days
 * after drinking" on three nights has invented a cause out of noise. A table
 * showing all three, with the days that do not fit the story still in it, is
 * both more honest and more useful.
 */
export function alongside(
  days: string[],
  ratings: { day: string; measure: string; value: number }[],
  offsets: number[],
  measureId: MeasureId
): { day: string; after: (number | null)[] }[] {
  const found = new Map<string, number>();
  for (const r of ratings) {
    if (r.measure !== measureId) continue;
    found.set(r.day, Math.round(Number(r.value)));
  }
  return [...new Set(days)]
    .sort()
    .map((day) => ({
      day,
      after: offsets.map((o) => found.get(shiftDay(day, o)) ?? null),
    }));
}

export function shiftDay(day: string, by: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

/**
 * How many of the lined-up days actually carry a rating.
 *
 * A caller needs this before it draws anything, because "mood on the two days
 * after" across eight nights where six have no rating is a table of blanks
 * pretending to be evidence.
 */
export function coverage(rows: { after: (number | null)[] }[]): { have: number; of: number } {
  let have = 0;
  let of = 0;
  for (const r of rows) {
    for (const v of r.after) {
      of += 1;
      if (v != null) have += 1;
    }
  }
  return { have, of };
}
