// SCREEN 3 OF 7, FINAL TEXT (Ruth, 5 October 2026), and what a skill is.
//
// Her principle, which is the reason every line below is shorter than the ones it
// replaces:
//
//   "Skills is just a place to keep the things someone is working on. The user
//   does not know about progression ladders and does not need to. Progression
//   ladders are parked until the app is working well and real users have shown
//   which skills they keep."
//
// WHAT THE OLD SCREEN GOT WRONG, and it was not the wording. It offered five
// calisthenics ladders - a strict pull-up, hanging core, a front lever, a
// handstand, the splits - because those were the movements the library could
// illustrate. Somebody whose answer is "run 5k" or "get up off the floor more
// easily" had nothing to tap and nowhere to type. A constraint of the asset
// library had become the question.
//
// SO THE IDEAS ARE EXAMPLES, NOT OPTIONS. Tapping one fills the box, where it can
// be changed or thrown away. The answer is always her words.
//
// THIS FILE IS THE RECORD. Like lib/starting-guide.ts, it is copied into
// scripts/mode-matrix.json by the generator and compared both ways by
// check-skills-copy.mjs, so nothing paraphrases it.
//
// NO EM DASHES. Her standing rule.

export const SKILL_SCREEN = {
  question: 'What would you love to be able to do?',
  subtitle:
    "It could be a fitness skill, a sport, or simply something you'd like your body to find easier. Big or small, it all belongs here. You can add more later in chat.",
  /** The label above the ideas. */
  ideasLabel: 'Ideas',
  /**
   * Examples, in her order. Tapping one puts it in the box, where it can be
   * changed - they are not options and nothing stores the fact that one was
   * tapped.
   */
  ideas: [
    'do a pull-up',
    'run 5 km',
    'touch my toes',
    'carry heavy shopping',
    'get up from the floor easily',
    'swim further',
    'hike all day',
    'play with my children',
  ],
  /** Shown as a label before the box, not inside it. */
  entryLabel: "I'd love to be able to",
  entryPlaceholder: 'climb Snowdon',
  /** Only after something is entered. */
  placementHeading: 'Where are you with it?',
  placementNote:
    'This tells Selodía where you are starting today. There are no dates and no deadlines. Leave this and it starts from the beginning.',
  footer: 'Nothing coming to mind is fine. Skills can be added any time in chat.',
  error: "That didn't save. Check your connection and try again.",
} as const;

export type PlacementKey = 'starting' | 'some' | 'nearly';

/** Her three, in her order and her words. */
export const PLACEMENTS: { key: PlacementKey; label: string }[] = [
  { key: 'starting', label: 'Just starting' },
  { key: 'some', label: "I've made a start" },
  { key: 'nearly', label: 'Nearly there' },
];

export const PLACEMENT_LABEL: Record<PlacementKey, string> = Object.fromEntries(
  PLACEMENTS.map((p) => [p.key, p.label])
) as Record<PlacementKey, string>;

/** What the Skills tab says when there is nothing in it. Her point 6. */
export const SKILLS_EMPTY =
  'Nothing here yet. Add something you are working on, in your own words.';

/**
 * HER WORDS, AS TYPED, WITH ONE CHANGE: the first letter is capitalised.
 *
 * Her point 2: "her own words (the card title, first letter capitalised, saved
 * exactly as typed)". Nothing else is touched - not the spacing, not the case of
 * anything after the first character, not a full stop added or removed. A card
 * that opens in lower case looks like a bug; a card whose words have been tidied
 * is no longer hers.
 */
export function skillTitle(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * LADDERS ARE OFF, NOT GONE (her point 4).
 *
 *   "no rungs, no Needs, no NOW / NEXT, no matching typed text to written
 *   ladders, no 'steps are not written yet' message. Switch the written ladders
 *   OFF with a flag; do not delete them."
 *
 * The ladders in lib/skill-ladders.ts stay where they are, and her approved
 * muscle-up wording stays in the Build Specs. This is the one switch that decides
 * whether anything reads them, so turning them back on later is a line rather
 * than an excavation.
 */
export const LADDERS_ENABLED = false;
