// HAS THIS HAPPENED AT THIS POINT BEFORE?
//
// The line the cycle redesign exists to produce, in Ruth's own example of 9
// October 2026: somebody says they have had cramps and a change in discharge
// for two days, and Selodia can say "that's around this point for you - you
// logged something close to it in August and July too".
//
// IT ASKS ONLY A QUESTION ABOUT HER OWN DATA. It does not know what ovulation
// is and never says so. What it returns is "this symptom, at a comparable
// place, in these months" - whether that is worth naming is a judgement the
// reply makes in context, with the wording rule from the spec: "that timing
// often points to ovulation" is an observation, "you are ovulating" is a
// diagnosis and the Sources page says plainly the app does not make one.
//
// COMPARABLE IS DOING THE WORK, and it lives in cycle-position.ts. Her cycles
// ran 24 to 35 days, so "day 14" means a different phase in each; the rule is
// early days count forward, late days count backward from the next period, and
// middle days only compare between cycles of similar length.
//
// TWO IS NOT A PATTERN. One previous occurrence is a coincidence worth nothing
// and saying it out loud would make the app sound like it is reaching. The
// floor is two previous months, three occasions including this one.

import { placeInCycle, samePlace, type Cycle, type Placement } from './cycle-position';

export type SymptomDay = { day: string; symptoms: string[] };

export type Recurrence = {
  /** The symptom, as she first said it. */
  symptom: string;
  /** The matching days, newest first, excluding the one asked about. */
  days: string[];
  /** Where in the cycle the day asked about sits. */
  place: Placement;
};

/** Below this, it is a coincidence rather than something to mention. */
export const MIN_PREVIOUS_OCCASIONS = 2;

/**
 * Do two written symptoms describe the same thing?
 *
 * Case-insensitive equality, and nothing cleverer. "Cramps" and "cramping"
 * probably are the same and "cramps" and "stomach ache" might be, but a
 * fuzzy match here would make the app claim a pattern she never described -
 * and the whole value of the line is that it is quoting her back to herself.
 * If this needs loosening it should loosen with evidence, not with a stemmer.
 */
function sameSymptom(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * For each symptom on `day`, the previous days at a comparable point in a
 * cycle where she logged the same thing.
 *
 * Returns only the ones that clear MIN_PREVIOUS_OCCASIONS, so an empty array
 * means "nothing worth saying" rather than "no data" - which is the right
 * thing for the caller either way: it has nothing to add.
 */
export function recurrences(
  cycles: readonly Cycle[],
  history: readonly SymptomDay[],
  day: string
): Recurrence[] {
  const place = placeInCycle(cycles, day);
  if (!place) return [];

  const today = history.find((h) => h.day === day);
  if (!today || today.symptoms.length === 0) return [];

  // Everything else she has ever logged, placed in its own cycle once rather
  // than once per symptom.
  const placed = history
    .filter((h) => h.day !== day)
    .map((h) => ({ ...h, place: placeInCycle(cycles, h.day) }))
    .filter((h): h is SymptomDay & { place: Placement } => h.place !== null)
    .filter((h) => samePlace(place, h.place));

  const out: Recurrence[] = [];
  for (const symptom of today.symptoms) {
    const days = placed
      .filter((h) => h.symptoms.some((s) => sameSymptom(s, symptom)))
      .map((h) => h.day)
      .sort()
      .reverse();
    if (days.length >= MIN_PREVIOUS_OCCASIONS) {
      out.push({ symptom, days, place });
    }
  }
  // Strongest first: the one with the most previous occasions is the one worth
  // leading with if the caller only mentions one.
  return out.sort((a, b) => b.days.length - a.days.length);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "August and July", "August, July and June". Her months, newest first. */
export function monthsOf(days: readonly string[]): string {
  const names: string[] = [];
  for (const d of days) {
    const name = MONTHS[new Date(d).getMonth()];
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The block handed to the model, or an empty string.
 *
 * STATED, NEVER CONCLUDED. It gives the model the fact and the words to be
 * careful with, and leaves the naming to the reply - because what a
 * recurrence means depends on everything else in the conversation, and a
 * library that decided "this is ovulation" would be making a clinical claim
 * from a date and a word.
 */
export function lookbackPrompt(found: readonly Recurrence[]): string {
  if (found.length === 0) return '';
  const lines = found
    .slice(0, 3)
    .map((r) => `- "${r.symptom}", also logged ${monthsOf(r.days)} at a comparable point.`);
  // WRITTEN IN THE HOUSE REGISTER, which is "they" and never the third person
  // feminine - see check-second-person. A block about a third party once had
  // the model saying "her log" to the person's face, and failing to work out
  // that the "she" in its context and the "I" in the message were one person.
  return (
    'WHAT THEY HAVE LOGGED AT THIS POINT BEFORE. Today sits ' +
    `${describeFor(found[0].place)} in their cycle, and these recur there:\n` +
    lines.join('\n') +
    '\nSay what you can see and ask what else they have noticed. You may say a ' +
    'timing OFTEN POINTS TO something; never state what is happening in their ' +
    'body as fact. "That timing often points to ovulation" is an observation ' +
    'about their own log and is allowed. "You are ovulating" is a diagnosis and ' +
    'is not. Mention it once, and never raise it if they are asking about ' +
    'something else.'
  );
}

function describeFor(place: Placement): string {
  if (place.anchor === 'early') return `around day ${place.dayFromStart}`;
  if (place.anchor === 'late' && place.daysBeforeNext !== null) {
    return `about ${place.daysBeforeNext} days before their period`;
  }
  return `around day ${place.dayFromStart}`;
}
