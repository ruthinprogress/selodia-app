// ANYTHING TO STEER AROUND: HER FINAL TEXT (Ruth, 5 October 2026).
//
// Pasted as a screen deck, headed "5 of 7" before the reorder and rendering as
// 6 of 7 now - the number comes from the chain, not from this file. Her
// instruction when the numbering changed under it: "the copy was for that
// screen, whatever the new number it is, apply it."
//
// WHAT CAME OFF THE SCREEN, SAID OUT LOUD so it is a decision rather than a
// slip. Her deck carries one note, under Food, and the screen had three:
//
//   Food        "This is the only group that changes what Selodia offers you to
//               eat."  ->  replaced by hers, "Only choose things you avoid or
//               react to."
//   Medicines   "Kept so Selodia knows. Nothing here is advice, and it never
//               comments on what you take."  ->  gone. The same sentence is on
//               the Body Manual row and on the medication box in step 7, so it
//               is said where the data is kept rather than three times.
//   Movement    "Anything your body will not thank you for, or that a clinician
//               has told you to avoid."  ->  gone, replaced by her shorter
//               question. The guarantee it described is in the rules gate, not
//               in the sentence.
//
// THE CHIPS ARE NOT IN HER DECK AND ARE NOT CHANGED BY IT. Her Food line names
// six and the screen offers those plus peanuts, tree nuts, fish, sesame and the
// seven dietary needs; her Skin & air line names the four that are there. She
// has already corrected me once for reading a deck as a chip inventory - the
// four movement chips, which she pointed out her approved preview had - so a
// deck that does not mention a chip is read as saying nothing about it.
//
// The labels she did name are hers: "Dairy", "Gluten", "Soy" where the screen
// said "Milk or dairy", "Gluten or wheat", "Soya". The stored allergen name is
// untouched, because that is what the food gate matches on.
//
// THIS FILE IS THE RECORD, like starting-guide.ts and skills-copy.ts: copied
// into scripts/mode-matrix.json by the generator and compared both ways by
// check-steer-copy.mjs, so nothing paraphrases it.
//
// NO EM DASHES. Her standing rule.

export const STEER_SCREEN = {
  question: 'Anything to steer around?',
  subtitle:
    "Tell Selodía about anything you'd rather avoid. You can always change this later.",
  /**
   * Her closing line, and it does the work three separate reassurances were
   * doing badly: everything here is her words, and none of it is final.
   */
  closing: 'Everything stays in your own words and can be changed at any time.',
} as const;

/**
 * HER HEADINGS AND BOXES, IN HER ORDER.
 *
 * `key` is the group the screen already keys its boxes and its saved state on,
 * so this is a change of wording and nothing else. The `kind` each group writes
 * stays in allergies.tsx beside the chips, where assertGroupsMatchKinds can see
 * it: a heading she reads and the kind the food gate switches on are one
 * decision, and splitting them across two files is how nickel came to sit under
 * a food heading.
 */
export const STEER_GROUPS = [
  {
    key: 'plate',
    heading: 'Food',
    note: 'Only choose things you avoid or react to.',
    boxLabel: 'Anything else?',
    boxPlaceholder: 'e.g. Celery, chilli, kiwi...',
  },
  {
    key: 'skin_air',
    heading: 'Skin & air',
    note: null,
    boxLabel: 'Anything else?',
    boxPlaceholder: 'e.g. Nickel jewellery, perfume, cats...',
  },
  {
    key: 'medicines',
    heading: 'Medicines',
    note: null,
    boxLabel: 'Anything to note?',
    boxPlaceholder: 'e.g. Penicillin causes a rash.',
  },
] as const;

/** Movements, which are rules in user_rules and never allergies. */
export const STEER_MOVEMENT = {
  heading: 'Movement',
  boxLabel: "Anything you'd rather avoid in sessions?",
  boxPlaceholder: 'e.g. Overhead pressing, deep lunges, jumping...',
  /** What is already excluded, shown underneath so she can see it is held. */
  alreadyLabel: 'Already staying out:',
} as const;

/**
 * HER FIFTH GROUP, which lands on Me under Avoid.
 *
 * NOT AN ALLERGY, because nothing says it is edible and it must not arm the food
 * filter; not a rule, because it names no movement.
 *
 * THE PLACEHOLDER IS THE ONE LINE OF THIS SCREEN THAT IS NOT HERS. Her deck
 * gives this group a heading and a label and no example, and the box had
 * "Loud gyms. Early mornings." from before. It is written in the pattern of her
 * other four placeholders, using the example that was already there, and it is
 * flagged here so it can be replaced with a word.
 */
export const STEER_OTHER = {
  heading: 'Anything else?',
  boxLabel: 'Anything that helps Selodía understand you.',
  boxPlaceholder: 'e.g. Loud gyms, early mornings...',
  alreadyLabel: 'Already there:',
} as const;
