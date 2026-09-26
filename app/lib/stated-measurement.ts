import type { SupabaseClient } from '@supabase/supabase-js';

// A SECOND OPINION ON "THAT WASN'T A MEASUREMENT" (Ruth, 26 September 2026:
// "i added a thigh measurement which recorded in chat but did not actually get
// logged").
//
// THE FAULT. The chat classifier picks one `logIntent` from a closed list, and
// that list has no value for a waist or a thigh. Its instruction defines
// 'measurement' in as many words as "a weight, body fat percentage, or muscle
// mass", with three examples, all of them scale readings. A thigh is outside
// that definition, so 'none' is the OBEDIENT answer - and 'none' means no
// writer runs at all.
//
// The writer underneath was never the problem. Its own instruction says to put
// ANY body measurement that is not weight, body fat or muscle into a personal
// metric, and it handles waists, thighs, hips and blood pressures correctly.
// It simply never got called, because the only thing that calls it is
// logIntent === 'measurement'.
//
// That is why this failed intermittently rather than always: a thigh genuinely
// IS a body measurement, so the model sometimes routed it as one in spite of
// the instruction. A rule that is followed most of the time is worse than one
// that is never followed - it hides.
//
// SO THE GUARD IS HERE, NOT IN THE PROMPT. Ruth's rule, and she has had to give
// it more than once: never ask the model not to do a thing twice, enforce it in
// code where the row is created. The instruction was widened too, but that is
// the second line of defence. This is the first.
//
// PERMISSIVE HERE, STRICT AT THE WRITE. This only decides whether to ASK the
// measurement writer, and the writer stays as fussy as it ever was - it drops
// anything with no name or no number, so a false positive costs one small model
// call and writes nothing at all. That asymmetry is deliberate: the cost of
// trying and finding nothing is a fraction of a penny, and the cost of not
// trying is a measurement someone took and believes is kept.

/** Body measurements common enough to name, for someone with nothing tracked yet. */
const COMMON = [
  'waist',
  'thigh',
  'thighs',
  'hip',
  'hips',
  'chest',
  'bust',
  'underbust',
  'arm',
  'arms',
  'bicep',
  'biceps',
  'forearm',
  'calf',
  'calves',
  'ankle',
  'wrist',
  'neck',
  'shoulders',
  'blood pressure',
  'resting heart rate',
  'resting pulse',
];

/** Any digit at all. A measurement without a number is not a measurement. */
const HAS_NUMBER = /\d/;

/**
 * Does this message name something measurable and put a number beside it?
 *
 * `known` are the names this person already tracks, which matter more than the
 * list above: someone tracking "left thigh" or "bra band" gets the same
 * protection as someone tracking a waist, and the list nobody can finish
 * writing does not have to be finished.
 */
export function namesATrackedMetric(text: string, known: string[]): boolean {
  if (!HAS_NUMBER.test(text)) return false;
  const haystack = ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const names = [...known.map((k) => k.toLowerCase()), ...COMMON];
  for (const name of names) {
    const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    // Whole words only, so "hip" does not match "hippo" and "arm" does not
    // match "warm" - the kind of near-miss that would route a bowl of porridge
    // to the measurement writer.
    if (cleaned && haystack.includes(' ' + cleaned + ' ')) return true;
  }
  return false;
}

/**
 * The same question, against what this person actually tracks.
 *
 * Called only when the classifier said 'none', so a message already read as
 * food keeps its own route - which is what stops "chicken thighs, 200g" being
 * treated as a tape measurement.
 */
export async function statesATrackedMetric(
  supabase: SupabaseClient,
  userId: string,
  text: string
): Promise<boolean> {
  if (!HAS_NUMBER.test(text)) return false;
  const { data } = await supabase
    .from('personal_metrics')
    .select('metric_name')
    .eq('user_id', userId);
  const known = Array.from(new Set((data ?? []).map((r) => r.metric_name as string)));
  return namesATrackedMetric(text, known);
}
