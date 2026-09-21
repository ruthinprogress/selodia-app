// WHAT A DAY FELT LIKE, and the vocabulary for saying so.
//
// From her ChatGPT mock of the Cycle page (21 September 2026), with two
// instructions that shaped the data rather than the layout:
//
//   "'Symptoms' Add Another which is nice and i think we should keep that as a
//   user generated option that's tracked if they create it."
//
//   "the cycle 'started' and 'ended' needs to be selectable in hindsight. I
//   rarely remember to add it to my calendar on the day it started or ended."
//
// SYMPTOMS ARE FREE TEXT, NOT AN ENUM. The twelve below are a starting point,
// not a vocabulary: anything she types is stored as she typed it and offered
// back to her from then on. A closed list would mean the one symptom that
// actually explains her month is the one thing she cannot record - which is
// the whole reason this app writes free text everywhere it can.

export type Flow = 'light' | 'medium' | 'heavy';

export type CycleDay = {
  day: string;
  flow: Flow | null;
  symptoms: string[];
  ovulation: string[];
  mucus: string | null;
  notes: string | null;
  temperatureC: number | null;
};

export const FLOWS: Flow[] = ['light', 'medium', 'heavy'];

/** The starting point. Not a vocabulary - see the note above. */
export const COMMON_SYMPTOMS = [
  'Cramps',
  'Breast tenderness',
  'Bloating',
  'Headache',
  'Acne',
  'Fatigue',
  'Nausea',
  'Food cravings',
  'Insomnia',
];

// LOW MOOD, ANXIETY AND IRRITABILITY WERE HERE FOR ABOUT FOUR HOURS on 21
// September and have moved to their own screen. They are real cycle symptoms
// and she was right to want them; what they cannot be is a second copy. Mood
// recorded here would have been invisible to a report that reads daily_ratings,
// and a person looking at one screen would have seen half their own record.
//
// One fact, one table. The Cycle page reads the day's mood from there instead.

export const OVULATION_SIGNS = ['Positive LH test', 'Ovulation pain', 'Temperature rise'];

export const MUCUS = ['Dry', 'Sticky', 'Creamy', 'Egg white', 'Watery'];

export function emptyDay(day: string): CycleDay {
  return { day, flow: null, symptoms: [], ovulation: [], mucus: null, notes: null, temperatureC: null };
}

/** True when there is nothing to save - so an empty form writes no row. */
export function isEmptyDay(d: CycleDay): boolean {
  return (
    !d.flow &&
    d.symptoms.length === 0 &&
    d.ovulation.length === 0 &&
    !d.mucus &&
    !d.notes?.trim() &&
    d.temperatureC == null
  );
}

/**
 * The chips to offer: the common ones, plus everything she has ever used,
 * with what she has used most recently first among her own.
 *
 * ONE LIST, NOT TWO. A separate "your symptoms" section would make her own
 * words look like an afterthought beside the app's, when they are the more
 * useful half.
 */
export function symptomChoices(used: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string) => {
    const label = s.trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };
  // Hers first: a symptom she has recorded before is more likely than one the
  // app guessed at.
  for (const s of used) add(s);
  for (const s of COMMON_SYMPTOMS) add(s);
  return out;
}

/** Toggling a chip, with her spelling kept if she has one. */
export function toggleChoice(current: string[], choice: string): string[] {
  const key = choice.trim().toLowerCase();
  const has = current.some((c) => c.toLowerCase() === key);
  return has ? current.filter((c) => c.toLowerCase() !== key) : [...current, choice.trim()];
}

/**
 * A temperature somebody actually typed.
 *
 * Basal temperature is the one cycle signal where a wrong number is worse than
 * no number: the whole point is a shift of two or three tenths of a degree, so
 * a mistyped 37 where 36.7 was meant erases the very thing it was recorded for.
 * Anything outside the range a living person reads is refused rather than
 * stored, and Fahrenheit is converted rather than rejected, because somebody
 * typing 97.8 has not made a mistake.
 */
export function readTemperature(input: string): number | null {
  const n = Number(String(input).replace(',', '.').trim());
  if (!Number.isFinite(n)) return null;
  // Plainly Fahrenheit: nobody's basal temperature is 95 degrees Celsius.
  const c = n > 45 ? ((n - 32) * 5) / 9 : n;
  if (c < 33 || c > 42) return null;
  return Math.round(c * 100) / 100;
}

/** The days of a month that have something recorded, for a calendar to mark. */
export function daysWithAnything(days: CycleDay[]): string[] {
  return days.filter((d) => !isEmptyDay(d)).map((d) => d.day);
}
