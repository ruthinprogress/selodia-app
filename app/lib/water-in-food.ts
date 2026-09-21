import type { SupabaseClient } from '@supabase/supabase-js';

import { parseVolumeMl } from './hydration-logging';

// A LITRE OF WATER TYPED IN THE MIDDLE OF A MEAL (Ruth, 21 September 2026).
//
//   "I logged 1lt of water in food log in typed entry and it didnt show up in
//   the chat text, the table or the hydration log"
//
// Her entry was "5 chocolate almonds, 1 chocolate caramel Malteser sized, 150g
// mango, black coffee, 1lt water" and the reply said "the litre of water's in
// too". It was not. The message was classified as food; the hydration path only
// ever ran for a message that was ONLY about a drink, so the litre went
// nowhere - and the sentence claiming otherwise was the model's, not the app's.
//
// TWO FAILURES, AND THE SECOND IS THE WORSE ONE. The water was lost, and the
// app told her it had not been. Everything in this project about save
// confirmations exists because of that second failure: the toast comes from the
// write, never from the reply.
//
// SO THE DIVISION IS THE USUAL ONE. The model names which phrases in a mixed
// sentence are a zero-calorie drink, because that is an open-ended reading - a
// coffee cake is not a coffee. This measures them, because how many millilitres
// are in a pint is a fixed fact with a right answer.
//
// AND "1lt" NOW PARSES. Without it that phrase fell past the explicit-volume
// branch to the no-quantity default and would have been recorded as a single
// glass. A litre stored as 250ml is worse than a litre stored as nothing,
// because nobody would ever notice.

export type WaterFound = { ml: number; from: string[] };

/**
 * What the named drinks come to, and which of them were measurable.
 *
 * A phrase with no volume in it is still a drink - "black coffee" is an
 * ordinary mug - and parseVolumeMl already holds that default. A phrase that
 * yields nothing at all is dropped rather than guessed at.
 */
export function waterFromDrinks(drinks: string[] | undefined): WaterFound {
  let ml = 0;
  const from: string[] = [];
  for (const phrase of drinks ?? []) {
    const text = String(phrase ?? '').trim();
    if (!text) continue;
    const found = parseVolumeMl(text);
    if (found == null || found <= 0) continue;
    // A CEILING, because a model that returns "10 litres" has misread
    // something, and a ten-litre day would quietly wreck every water figure
    // afterwards. Five litres is beyond any real day and still generous.
    if (found > 5000) continue;
    ml += found;
    from.push(text);
  }
  return { ml: Math.round(ml), from };
}

/**
 * Write the water that came in with a meal.
 *
 * STAMPED TO THE MEAL'S OWN MOMENT, so a catch-up for last Tuesday puts
 * Tuesday's water on Tuesday rather than on today. The day is what every water
 * figure buckets by.
 *
 * Returns the millilitres actually stored, or 0. Nothing written means nothing
 * claimed: the caller must not say water was logged when this returns 0.
 */
export async function logWaterWithFood(
  supabase: SupabaseClient,
  userId: string,
  drinks: string[] | undefined,
  happenedAt: string,
  rawText: string
): Promise<number> {
  const { ml, from } = waterFromDrinks(drinks);
  if (ml <= 0) return 0;
  const { error } = await supabase.from('hydration_logs').insert({
    user_id: userId,
    ml,
    // Their own words for the drink, not the whole meal - so the water history
    // reads as "1lt water" rather than as a list of chocolate.
    raw_input: from.join(', ') || rawText,
    happened_at: happenedAt,
  });
  if (error) {
    console.log('WATER WITH FOOD FAILED:', error.message);
    return 0;
  }
  return ml;
}
