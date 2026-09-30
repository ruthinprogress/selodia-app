import type { AminoProfile } from '@/lib/protein-quality';

// PAIR - teaching nutrition by repetition, at the moment it is relevant.
//
// Ruth's brief, 30 September 2026: "Selodía should quietly help users build
// lifelong eating habits by surfacing simple pairing suggestions exactly when
// they're relevant... Six months later the user naturally eats more balanced
// meals without remembering where they learnt it. That is the success metric."
//
// No articles, no quizzes, no badges. A small italic word beside an ingredient,
// and a card behind it that can be read in seconds.
//
// ── THE RULE THAT MAKES IT WORTH HAVING ──────────────────────────────────────
//
// THE LABEL DISAPPEARS WHEN THE MEAL HAS ALREADY DONE IT. Chicken, rice and
// beans gets no label; peanut butter on wholegrain toast gets no label. A flag
// that fires on beans whatever else is on the plate is not teaching anything -
// it is a sticker, and she would learn to stop seeing it.
//
// That is also the hardest part, and protein-quality.ts has the scar from
// getting it wrong the other way round: "A per-item flag is scoped to ITS ITEM
// ... Lift the same flag into a sentence under the table and it silently
// becomes a claim about the WHOLE MEAL, which nothing checked." This is the
// mirror image - a per-item label that must READ the whole meal to know whether
// to appear - so the meal is passed in explicitly and never assumed.
//
// ── WHY AMINO PROFILE AND NOT PROTEIN SOURCE ─────────────────────────────────
//
// {animal, plant, collagen} cannot express complementarity, because
// complementarity is about WHICH amino acid is short. Legumes are methionine-
// limited and grains lysine-limited, so together they are complete - and two
// legumes are not. amino_profile already carries exactly that, per item, and
// has since 27 August.
//
// ── WHAT THE CARD MUST SAY, AND WHY THE SECOND SENTENCE MATTERS MORE ─────────
//
// "You don't need to eat them in the same meal." The idea that complementary
// proteins must be combined at a single sitting was abandoned decades ago, and
// it is still the version most people half-remember. A feature whose whole
// purpose is teaching by repetition would otherwise spend six months teaching
// the wrong thing, very effectively.

/** Enough protein in the item for the pairing to be worth mentioning at all. */
const MIN_ITEM_PROTEIN_G = 3;

/**
 * Enough protein from a complementing food for it to count as having covered
 * the gap. Mirrors `covers` in protein-quality.ts, deliberately: 5 g of rice
 * meaningfully complements 20 g of lentils, and a garnish does not.
 */
const COVERING_MIN_G = 5;
const COVERING_MIN_SHARE = 0.25;

export type PairItem = {
  name: string;
  proteinG: number | null;
  aminoProfile: AminoProfile | null;
};

/**
 * WHAT COMPLETES WHAT.
 *
 * Legumes and grains cover each other. Collagen is short of tryptophan and is
 * not fixed by a grain or a legume - only a complete protein covers it, which
 * is why its entry lists nothing but 'complete'.
 */
const COMPLETED_BY: Record<AminoProfile, AminoProfile[]> = {
  complete: [],
  limiting_lysine: ['complete', 'limiting_methionine'],
  limiting_methionine: ['complete', 'limiting_lysine'],
  limiting_tryptophan: ['complete'],
};

/**
 * WHAT TO SUGGEST, in everyday words.
 *
 * Deliberately short lists of things somebody would actually have in. A card
 * naming eleven foods is an article, which is the thing this feature exists
 * instead of.
 */
const SUGGESTIONS: Record<AminoProfile, string[]> = {
  complete: [],
  // Short of lysine - grains, nuts and seeds. Completed by legumes or by any
  // complete protein.
  limiting_lysine: ['Beans', 'Lentils', 'Chickpeas', 'Peas', 'Yoghurt', 'Eggs'],
  // Short of methionine - beans, lentils, peas. Completed by grains, nuts and
  // seeds, and by the grains that are complete in their own right.
  limiting_methionine: ['Rice', 'Quinoa', 'Corn', 'Wholegrain bread', 'Oats', 'Nuts or seeds'],
  // Collagen and gelatin, very low in tryptophan.
  limiting_tryptophan: ['Eggs', 'Dairy', 'Fish', 'Chicken', 'Soya'],
};

function covers(grams: number, mealTotal: number): boolean {
  return grams >= COVERING_MIN_G || (mealTotal > 0 && grams / mealTotal >= COVERING_MIN_SHARE);
}

/**
 * Should this item carry the Pair label, given everything else in the meal?
 *
 * `meal` is every item in the entry INCLUDING this one - callers pass the list
 * they already have rather than filtering it, because a caller that forgets to
 * exclude the item itself would silently make everything self-complementing.
 */
export function showsPair(item: PairItem, meal: PairItem[]): boolean {
  const profile = item.aminoProfile;
  if (!profile || profile === 'complete') return false;
  if ((item.proteinG ?? 0) < MIN_ITEM_PROTEIN_G) return false;

  const others = meal.filter((m) => m !== item);
  const total = meal.reduce((s, m) => s + (m.proteinG && m.proteinG > 0 ? m.proteinG : 0), 0);

  const covering = COMPLETED_BY[profile];
  const gramsCovering = others
    .filter((m) => m.aminoProfile != null && covering.includes(m.aminoProfile))
    .reduce((s, m) => s + (m.proteinG && m.proteinG > 0 ? m.proteinG : 0), 0);

  // Already paired, on the plate. Nothing to teach here.
  return !covers(gramsCovering, total);
}

export type PairCard = {
  /** The item the card is about, in her own words for it. */
  about: string;
  /** What to pair it with. Already filtered for anything she cannot eat. */
  suggestions: string[];
  /** The two lines under the list. The second one is the important one. */
  explanation: string;
  sameMealNote: string;
};

/**
 * ANYTHING SHE CANNOT EAT NEVER APPEARS (and the brief does not mention this,
 * which is why it is worth saying out loud).
 *
 * "Pair your lentils with wholegrain bread" to a coeliac is the app teaching
 * her to make herself ill, in a calm italic footnote, repeatedly, which is the
 * exact mechanism the feature is built on. The allergy list she has already
 * given is passed in and matched loosely - a suggestion dropped for being too
 * close to something she avoids costs nothing, and the reverse costs a great
 * deal.
 */
export function pairCard(item: PairItem, avoid: string[] = []): PairCard | null {
  const profile = item.aminoProfile;
  if (!profile || profile === 'complete') return null;

  const lowered = avoid.map((a) => a.trim().toLowerCase()).filter(Boolean);
  const suggestions = SUGGESTIONS[profile].filter((s) => {
    const name = s.toLowerCase();
    return !lowered.some((a) => name.includes(a) || a.includes(name) || SOUNDS_LIKE(name, a));
  });

  if (suggestions.length === 0) return null;

  return {
    about: item.name,
    suggestions: suggestions.slice(0, 4),
    explanation: `These foods complement the amino acid profile of ${item.name.toLowerCase()}.`,
    sameMealNote:
      'You don’t need to eat them in the same meal. Eating complete proteins elsewhere in your day works too.',
  };
}

/**
 * The near-misses worth catching, and only those.
 *
 * NOT A GENERAL SYNONYM ENGINE. "gluten" and "wheat" do not contain one
 * another, and neither does "dairy" and "yoghurt", and those are the ones that
 * would actually get through. A list somebody can read and check beats a
 * cleverness nobody can.
 */
const AVOID_GROUPS: Record<string, string[]> = {
  gluten: ['wholegrain bread', 'bread', 'oats', 'wheat'],
  wheat: ['wholegrain bread', 'bread'],
  dairy: ['yoghurt'],
  milk: ['yoghurt', 'dairy'],
  'tree nuts': ['nuts or seeds'],
  nuts: ['nuts or seeds'],
  peanuts: ['nuts or seeds'],
  soya: ['soya'],
  egg: ['eggs'],
  eggs: ['eggs'],
  fish: ['fish'],
  vegan: ['yoghurt', 'eggs', 'dairy', 'fish', 'chicken'],
  vegetarian: ['fish', 'chicken'],
};

function SOUNDS_LIKE(suggestion: string, avoided: string): boolean {
  const group = AVOID_GROUPS[avoided];
  return group ? group.includes(suggestion) : false;
}
