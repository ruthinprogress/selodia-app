// WHAT YOU ALREADY DO: HER FINAL TEXT (Ruth, 5 October 2026).
//
// THE FREQUENCY QUESTION IS GONE, and she is the one who worked out why. Asking
// how often she does something, when the week never places it on a day, meant the
// screen raised a question it did not answer:
//
//   "when the user says eg. ballet and selects 'weekly' does it go into the
//   weekly view on a random day? or do they all go into the Anytime category at
//   the bottom... if it's the second, why do we ask the frequency at all?"
//
// It was the second. Nothing was ever placed on a day, and the cadence had two
// consumers: a conflict check against days she had not set, and - worse - a
// second write of her activity level, derived from four chips, which overwrote
// the level she had stated on its own screen. That write is gone and the question
// goes with it. Her closing line says what happens instead.
//
// AND SHE CAN ADD HER OWN. The old list was ten fixed chips. Somebody who swims
// in a lake, does seated yoga or walks a dog had to find the nearest word. The
// ideas are examples; the box takes anything.
//
// THIS FILE IS THE RECORD, like starting-guide.ts and skills-copy.ts: copied into
// scripts/mode-matrix.json by the generator and compared both ways by
// check-setup-copy-records.mjs, so nothing paraphrases it.
//
// THAT SENTENCE WAS A PROMISE BEFORE IT WAS TRUE. It named
// check-activities-copy.mjs, and neither the record nor the check was ever
// written - so for a day this file described a guard that did not exist, which is
// worse than describing none, because the next reader stops looking. Both are
// there now.
//
// NO EM DASHES. Her standing rule.

export const ACTIVITIES_SCREEN = {
  question: 'What do you already do?',
  subtitle:
    "Add the activities that are already part of your life. They don't need a schedule yet.",
  ideasLabel: 'Ideas',
  /** Hers, in her order. Examples, not a fixed list. */
  ideas: [
    'Walking',
    'Running',
    'Gym or weights',
    'Yoga',
    'Pilates',
    'Cycling',
    'Swimming',
    'Dance',
    'Team sports',
  ],
  ownLabel: 'Or add your own...',
  ownPlaceholder: 'Add an activity...',
  /**
   * The closing line, and it is the one that replaces the frequency question.
   *
   * It says where these go, that arranging them comes later, and that none of it
   * is a measurement - which is the whole of what the cadence chips were failing
   * to say.
   */
  footer:
    "You'll be able to arrange these into a typical week afterwards. Think of this as a sketch of a normal week. It's here to help you see how everything fits together, not to keep score.",
  error: "That didn't save. Check your connection and try again.",
} as const;

/**
 * Her words, tidied only at the first letter.
 *
 * The same rule as a skill title: an activity typed in lower case looks like a
 * bug on a card, and anything more than the first character would be the app
 * rewriting what she said.
 */
export function activityTitle(raw: string): string {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
