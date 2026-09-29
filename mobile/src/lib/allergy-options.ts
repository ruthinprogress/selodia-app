// WHAT ONBOARDING OFFERS AS A TAP, AND NOTHING MORE.
//
// THE LIST IS A SHORTCUT, NEVER A VOCABULARY. `app/lib/allergies.ts` is
// emphatic that an allergen name must not be a fixed list, because "an allergen
// list is precisely the list nobody can finish writing". That rule is not
// broken here: these are the common ones offered as taps to save typing, and
// "Something else" opens chat, where anything at all can be said in her own
// words. A woman with an allergy that is not below must never feel the app has
// no room for it.
//
// THE KIND IS A ROUTING DECISION, not her word for her own body. It decides
// whether the food gate may act, and the four values are the ones code switches
// on. Getting it wrong in the permissive direction is what blocked two plain
// questions about nickel in September.
//
// DIETARY NEEDS LIVE HERE TOO, and that is the table's own design - its header
// reads "Allergies and dietary restrictions", and the prompt block it builds is
// titled the same. A vegetarian is not allergic to chicken, but the app must
// not offer her chicken, and this is the one place that instruction is read.
//
// AND ONE HONEST LIMITATION, worth knowing before anybody relies on it. The
// allergy gate's deterministic layer matches the stored NAME against the words
// of a reply, so "peanuts" catches a reply containing peanuts. "Vegetarian"
// never appears in "have some chicken", so a dietary need is caught by the
// prompt and by the gate's model layer, and NOT by the string layer. That is
// two of the four layers rather than three, and it is a real difference in
// strength between an allergen and a diet.

export type AllergyKind = 'food' | 'contact' | 'environmental' | 'other';

export type AllergyOption = {
  /** Stored as the allergen name, lowercased by the recorder. */
  name: string;
  /** What she taps. */
  label: string;
  kind: AllergyKind;
};

/** The ones that most often matter, and the ones a food gate can string-match. */
export const FOOD_ALLERGIES: AllergyOption[] = [
  { name: 'peanuts', label: 'Peanuts', kind: 'food' },
  { name: 'tree nuts', label: 'Tree nuts', kind: 'food' },
  { name: 'milk', label: 'Milk or dairy', kind: 'food' },
  { name: 'eggs', label: 'Eggs', kind: 'food' },
  { name: 'fish', label: 'Fish', kind: 'food' },
  { name: 'shellfish', label: 'Shellfish', kind: 'food' },
  { name: 'soya', label: 'Soya', kind: 'food' },
  { name: 'gluten', label: 'Gluten or wheat', kind: 'food' },
  { name: 'sesame', label: 'Sesame', kind: 'food' },
];

/**
 * How she eats. Stored with kind 'food' because they restrict what may be
 * offered, which is the only question the kind answers.
 *
 * NAMED SO THE BLOCKED-SUGGESTION SENTENCE READS. That line says "what I had in
 * mind doesn't work with your ___", so the stored name has to be a noun phrase
 * that finishes it. "Vegetarian" alone gives "doesn't work with your
 * vegetarian"; "vegetarian diet" reads.
 */
export const DIETARY_NEEDS: AllergyOption[] = [
  { name: 'vegetarian diet', label: 'Vegetarian', kind: 'food' },
  { name: 'vegan diet', label: 'Vegan', kind: 'food' },
  { name: 'pescatarian diet', label: 'Pescatarian', kind: 'food' },
  { name: 'dairy-free diet', label: 'Dairy-free', kind: 'food' },
  { name: 'gluten-free diet', label: 'Gluten-free', kind: 'food' },
  { name: 'halal diet', label: 'Halal', kind: 'food' },
  { name: 'kosher diet', label: 'Kosher', kind: 'food' },
];

/**
 * Reactions that are not about food.
 *
 * THESE EXIST HERE BECAUSE LEAVING THEM OUT IS WHAT WENT WRONG. Nickel was
 * recorded with no kind, defaulted to a food restriction, and blocked two
 * honest questions about nickel within a minute. Offering them as taps with the
 * right kind attached is the cheapest way to stop that happening again, and
 * they are genuinely useful: the app suggests things to put on skin.
 */
export const OTHER_REACTIONS: AllergyOption[] = [
  { name: 'nickel', label: 'Nickel', kind: 'contact' },
  { name: 'latex', label: 'Latex', kind: 'contact' },
  { name: 'fragrance', label: 'Fragrance or perfume', kind: 'contact' },
  { name: 'pollen', label: 'Pollen or hay fever', kind: 'environmental' },
  { name: 'dust', label: 'Dust', kind: 'environmental' },
];

export const ALL_ALLERGY_OPTIONS: AllergyOption[] = [
  ...FOOD_ALLERGIES,
  ...DIETARY_NEEDS,
  ...OTHER_REACTIONS,
];

export const ALLERGY_BY_NAME: Record<string, AllergyOption> = Object.fromEntries(
  ALL_ALLERGY_OPTIONS.map((o) => [o.name, o])
);
