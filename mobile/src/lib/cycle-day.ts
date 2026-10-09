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
// GROUPED BY WHAT THEY ARE, NOT BY WHO GETS THEM (9 October 2026).
//
// The first version of the redesigned picker had a group headed "the forty-plus
// ones". Ruth: "'the forty+ ones' is not quite the right language....it feels
// off."
//
// She is right, and it is not a wording problem. Grouping symptoms by the age
// of the person who gets them makes them a consequence of her age - it quietly
// says THIS IS WHAT YOU ARE NOW, against a brand line that says her body is not
// a problem to solve. It strands a 39-year-old having hot flushes, and tells a
// 50-year-old something she does not need telling.
//
// So the groups say what the symptom IS. Hot flushes, night sweats and brain
// fog are simply present and unremarkable, which is a stronger statement than a
// section announcing who they are for: she will notice the app has "Brain fog"
// when she goes looking for it, and most trackers do not.
//
// WHAT WAS MISSING UNTIL TODAY, and this is the substance rather than the
// labelling. The list was twelve symptoms written for a standard tracker:
// cramps, acne, cravings, mood. No hot flushes, no night sweats, no brain fog,
// no broken sleep, no heavier flow, no joint aches. Those are the ones that tell
// a 44-year-old what is actually happening to her, and the app for women over
// 40 did not have a single one of them.
export const SYMPTOM_GROUPS: { name: string; items: string[] }[] = [
  {
    name: 'Body',
    items: [
      'Cramps',
      'Bloating',
      'Breast tenderness',
      'Headache',
      'Back pain',
      'Nausea',
      'Joint aches',
      'Fatigue',
      'Acne',
      'Food cravings',
    ],
  },
  {
    name: 'Bleeding',
    items: [
      'Heavier than usual',
      'Lighter than usual',
      'Discharge change',
      'Spotting',
      'Clots',
    ],
  },
  {
    name: 'Sleep and temperature',
    items: ['Hot flush', 'Night sweats', 'Broken sleep', 'Insomnia', 'Chills'],
  },
  {
    // Mood chips and a mood RATING are different records of different things -
    // see the note kept below. A person can have a perfectly good day and be
    // irritable in it, and "Low" on the Feeling screen would not record that.
    name: 'Head and mood',
    items: ['Brain fog', 'Low mood', 'Anxiety', 'Irritability', 'Teary', 'Wired'],
  },
];

// KEPT, AND NOW DERIVED. Everything that reads a flat list still works, and
// there is one place to add a symptom rather than two that can disagree.
//
// THE MOOD THREE CAME OFF THIS LIST AND WENT BACK ON THE SAME EVENING, and the
// reason is worth keeping because my first reasoning was wrong.
//
// They were removed when mood and energy got their own screen, on the principle
// of one fact in one table. But Ruth: "i think bring them back everywhere. they
// are quite specific and not covered otherwise. they are the things i suffer
// most from and they are also linked to menopause symptoms, anxiety and
// irritability especially."
//
// SHE IS RIGHT, AND THEY ARE NOT THE SAME FACT. A mood rating is where a day sat
// between Low and Bright; irritability is a symptom somebody had. Leaving them
// out was not tidiness, it was losing the specific thing in favour of the
// general one - and for a perimenopausal user these three are among the most
// diagnostic symptoms there are.
export const COMMON_SYMPTOMS: string[] = SYMPTOM_GROUPS.flatMap((g) => g.items);

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
