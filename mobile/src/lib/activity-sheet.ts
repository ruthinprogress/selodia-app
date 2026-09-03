// The Activity quick-log sheet's logic, kept out of the component so it can be
// reasoned about (and tested) without a device.
//
// WHY A SHEET AT ALL. Typing "running" into the Activity tab used to produce a
// row with an invented 30 minutes behind it. The server-side gate now refuses
// that, which is correct but leaves the person having a conversation with a
// text box: they type a word, get asked how long, type a number. The sheet asks
// for the two things the log actually needs, once, with taps.
//
// IT DOES NOT LOG. Everything here ends as a sentence posted to ask-unflump,
// exactly like the Chat composer. One pipeline, reached from a second place -
// the same rule the QuickLogBar was built under. Nothing on the Activity tab
// writes to activity_logs directly, so a session logged here is indistinguishable
// downstream from one logged in conversation.

export type Effort = 'easy' | 'moderate' | 'intense';

// The labels are the person's words; the values are the parser's. The mapping is
// deliberate and confirmed: Easy means `light` intensity, not "no intensity
// given" - somebody who tapped Easy has told us something, and dropping it would
// be treating a stated answer as silence.
export const EFFORTS: { label: string; value: Effort }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'moderate' },
  { label: 'Intense', value: 'intense' },
];

export const DURATION_CHOICES = [15, 30, 45, 60] as const;
export const DISTANCE_CHOICES = [1, 3, 5, 10] as const;

// Plausibility bounds, in the same spirit as the weight guard: they catch a
// fat-fingered entry rather than police anyone's training. 16 hours is longer
// than any single session and shorter than a typo; 500 km likewise.
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 960;
export const MIN_KM = 0.1;
export const MAX_KM = 500;

// Does the text ALREADY say how long? If so the sheet does not open, because
// asking somebody to re-enter what they just typed is the failure the sheet
// exists to prevent, not a feature of it.
//
// Deliberately conservative. A bare "m" is not accepted as minutes: "5 m" is
// more likely metres, and the cost of the two mistakes is asymmetric. Missing a
// duration that was there means one extra sheet the person taps through.
// Inventing one that was not means skipping the sheet and handing the server a
// description it will refuse, which puts them back in the text-box conversation
// this was built to end.
const DURATION_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*(?:min|mins|minute|minutes)\b/i,
  /\b\d+(?:\.\d+)?\s*(?:hr|hrs|hour|hours)\b/i,
  /\b(?:half\s+an?|an?|one|two|three)\s+hours?\b/i,
  /\b(?:quarter|half)\s+of\s+an\s+hour\b/i,
];

export function hasDuration(text: string): boolean {
  return DURATION_PATTERNS.some((re) => re.test(text));
}

// Distance only makes sense for some activities, and an optional row that is
// irrelevant on most sessions is clutter on all of them. Keyword-matched against
// what the person typed, which will miss unusual phrasings - that is the
// accepted cost of not showing a distance field on a yoga session.
const DISTANCE_WORDS =
  /\b(run|runs|running|ran|jog|jogs|jogging|cycle|cycles|cycling|bike|bikes|biking|ride|rides|riding|swim|swims|swimming|swam|walk|walks|walking|walked|hike|hikes|hiking|hiked)\b/i;

export function takesDistance(text: string): boolean {
  return DISTANCE_WORDS.test(text);
}

export function isValidMinutes(n: number): boolean {
  return Number.isFinite(n) && n >= MIN_MINUTES && n <= MAX_MINUTES;
}

export function isValidKm(n: number): boolean {
  return Number.isFinite(n) && n >= MIN_KM && n <= MAX_KM;
}

// Turns the taps back into a sentence for ask-unflump to parse.
//
// A sentence rather than a payload BECAUSE the pipeline is the point: the same
// route, the same parser, the same thread. It does mean the numbers the person
// tapped are re-extracted by a model, which is a real cost - so the wording is
// built to be unambiguous rather than pretty. "30 minutes of running" cannot be
// read as anything else, and the intensity word is one the parser's own enum
// already names.
//
// Trailing full stop included: the description is quoted into a prompt, and a
// sentence that ends is easier to parse than one that trails off.
export function buildActivityMessage(opts: {
  text: string;
  effort: Effort;
  minutes: number;
  km?: number | null;
}): string {
  const activity = opts.text.trim().replace(/[.,;\s]+$/, '');
  const parts = [`I did ${opts.minutes} minutes of ${activity}`, `${opts.effort} intensity`];
  if (opts.km != null && isValidKm(opts.km)) {
    // "km" spelled out rather than "5k", which a parser can read as a distance
    // or as shorthand for a race name.
    parts.push(`${opts.km} km`);
  }
  return `${parts.join(', ')}.`;
}
