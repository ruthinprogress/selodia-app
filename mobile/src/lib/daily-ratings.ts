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

// THE CORRELATION ARITHMETIC MOVED OUT (21 September 2026). `alongside`,
// `coverage` and `shiftDay` lived here for an afternoon, then the question they
// answer - "run a report on all days i drank cocktails and my mood the
// following days" - turned out to be answered on the server, where the rows
// are. They now live in app/lib/pattern-check.ts, once, because two
// implementations of one correlation is the drift that nothing would catch.
