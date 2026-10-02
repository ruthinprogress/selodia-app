// HOW SHE WANTS HER DAYS TO FEEL.
//
// Ruth's purpose for the whole app, restated in item 7 on 2 October 2026: take
// mental load off, reduce friction and stress, support long-term health. Those
// are not body outcomes and none of them is a number, which is why they needed a
// goal kind of their own.
//
// EVERY STRING BELOW IS FROM HER APPROVED PREVIEW, read from the design canvas
// rather than written from my notes. The chips, their order, the question, the
// four look-back answers and the sentence about not promising anything are hers.
//
// THE HONEST LINE IS NOT A DISCLAIMER. "Selodía cannot promise to fix any of
// this. It holds where you are starting from, so later you can look back and see
// which way things are moving." That is the whole design in two sentences: the app
// does not claim to deliver more energy, it records where she began so a look-back
// has something to compare against. Her brief says chat must read these and
// NEVER PROMISE TO FIX ANYTHING, and this screen sets that expectation first.
//
// NOTHING HERE CAN BE SCORED. No weights on the chips, no numeric answers, no
// ordering that could be read as progress. The four answers are words, and they
// are stored as words.

export const FEEL_QUESTION = 'How do you want your days to feel?';
export const FEEL_SUBTITLE =
  'Compared with how they feel now. Pick whatever fits, and say it in your own words if you like.';

/** Her six, in her order. */
export const FEEL_CHIPS = [
  'More energy',
  'Less overwhelm',
  'Less brain fog',
  'Feel stronger',
  'Sleep better',
  'Calmer',
] as const;

export const FEEL_OWN_WORDS_LABEL = 'In your own words';
export const FEEL_OWN_WORDS_PLACEHOLDER =
  'How do your days feel now? How would you like them to feel?';

export const FEEL_HONEST_NOTE =
  'Selodía cannot promise to fix any of this. It holds where you are starting from, so later you can look back and see which way things are moving.';

// ------------------------------------------------------------- looking back

export type LookbackAnswer = 'further' | 'same' | 'a_bit_closer' | 'closer';

/**
 * Her four, in her order, with her wording.
 *
 * ORDERED WORST TO BEST ON SCREEN AND MEANING NOTHING BY IT. There is no scale
 * behind this: the order is so the list reads naturally, and no code anywhere
 * turns the position into a number. "Further from how I wanted" is first because
 * a list that opens on the good answer reads as a nudge towards it.
 */
export const LOOKBACK_ANSWERS: { key: LookbackAnswer; label: string }[] = [
  { key: 'further', label: 'Further from how I wanted' },
  { key: 'same', label: 'About the same' },
  { key: 'a_bit_closer', label: 'A bit closer' },
  { key: 'closer', label: 'Closer' },
];

export const LOOKBACK_QUESTION = 'How are your days feeling?';
export const LOOKBACK_SUBTITLE =
  'Compared with when you started. There is no right answer, and nothing here is a score.';
export const LOOKBACK_TODAY_HEADING = 'Today, your days feel';
export const LOOKBACK_NOTE_LABEL = 'Anything you want to remember about why? Optional.';
export const LOOKBACK_NOTE_PLACEHOLDER = 'Just for you';

/** "When you started, 2 October 2026" - the snapshot heading. */
export function startedHeading(startedAt: string | null | undefined): string {
  if (!startedAt) return 'When you started';
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return 'When you started';
  return `When you started, ${d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;
}

export function lookbackLabel(answer: string | null | undefined): string | null {
  return LOOKBACK_ANSWERS.find((a) => a.key === answer)?.label ?? null;
}
