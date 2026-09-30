// PAIR, BEYOND PROTEIN - absorption, and the foods that unlock each other.
//
// Ruth, 30 September 2026: "The calcium work needs doing as thats an important
// one for maintaining bone density at this age. Start on that build and
// reference it properly."
//
// pair.ts does amino acids. This is the general engine her brief describes -
// "the same subtle Pair mechanism can be reused across many nutrition
// concepts" - and it starts with the two that matter most to a woman over 40:
// calcium and the vitamin D that lets her absorb it, and plant iron and the
// vitamin C that lets her absorb that.
//
// ── EVERY ENTRY CARRIES ITS SOURCE, AND THE SOURCES WERE CHECKED ─────────────
//
// Not recalled. Each `source` below was fetched from the named page on
// 30 September 2026 and the figures in the comments are quoted from it. A
// feature whose whole method is quiet repetition teaches a mistake exactly as
// thoroughly as it teaches anything else - which is not hypothetical here, the
// brief's own calcium entry had the mechanism crossed and would have taught it
// for six months.
//
// ── THE LINE THIS FILE DOES NOT CROSS ────────────────────────────────────────
//
// It says which food helps which food be absorbed. It does NOT state intake
// targets, does not tell her she is short of anything, and does not mention
// supplements. Those are in app/lib/clinical-reference.ts behind the gate that
// waits for a clinician, along with anything connecting bone density to the
// menopause - because the reason calcium matters more at her age is oestrogen,
// and that is a clinical sentence however gently it is put.

export type NutrientSource = {
  name: string;
  document: string;
  url: string;
  /** When this was last read against the source. */
  checked: string;
};

export type NutrientPair = {
  id: string;
  /** Foods that trigger it, matched against the item's own name. */
  match: RegExp;
  /** Foods that close the gap. Any one of these in the meal silences it. */
  completedBy: RegExp;
  /** What to suggest, in everyday words. At most four are shown. */
  suggestions: string[];
  /** One sentence on why, in her register rather than a textbook's. */
  why: string;
  /** The second line: the caveat or the thing most people get wrong. */
  note: string;
  source: NutrientSource;
};

const NHS_CALCIUM: NutrientSource = {
  name: 'NHS',
  document: 'Vitamins and minerals: Calcium',
  url: 'https://www.nhs.uk/conditions/vitamins-and-minerals/calcium/',
  checked: '2026-09-30',
};

const NHS_VITAMIN_D: NutrientSource = {
  name: 'NHS',
  document: 'Vitamins and minerals: Vitamin D',
  url: 'https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/',
  checked: '2026-09-30',
};

const NHS_IRON: NutrientSource = {
  name: 'NHS',
  document: 'Vitamins and minerals: Iron',
  url: 'https://www.nhs.uk/conditions/vitamins-and-minerals/iron/',
  checked: '2026-09-30',
};

const NIH_CALCIUM: NutrientSource = {
  name: 'NIH Office of Dietary Supplements',
  document: 'Calcium: Fact Sheet for Health Professionals',
  url: 'https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/',
  checked: '2026-09-30',
};

const BDA_IRON: NutrientSource = {
  name: 'British Dietetic Association',
  document: 'Iron Food Fact Sheet',
  url: 'https://www.bda.uk.com/foodfacts/iron',
  checked: '2026-09-30',
};

export const NUTRIENT_PAIRS: NutrientPair[] = [
  // CALCIUM AND VITAMIN D.
  //
  // NHS, Vitamin D: "Vitamin D helps regulate the amount of calcium and
  // phosphate in the body." Those are what keep bone, teeth and muscle healthy.
  // So a calcium-rich meal with no vitamin D anywhere is the pairing worth
  // teaching, and it is the one that matters most for bone.
  //
  // The calcium foods are the NHS's own list, and so is the exclusion - see the
  // spinach entry below, which is the more surprising half.
  {
    id: 'calcium-vitamin-d',
    match: /\b(milk|cheese|yoghurt|yogurt|kale|okra|sardine|pilchard|tinned salmon|fortified (?:soya|oat|almond)|soya drink|tofu)\b/i,
    completedBy: /\b(salmon|sardine|pilchard|trout|herring|mackerel|egg|eggs|fortified cereal|fat spread|liver|oily fish)\b/i,
    suggestions: ['Oily fish', 'Eggs', 'Fortified cereal', 'Fortified fat spread'],
    why: 'Vitamin D is what lets the body use calcium, and these are the foods that carry it.',
    note: 'In the UK, sunlight is too weak to make vitamin D from about October to March, so food matters more over the winter.',
    source: NHS_VITAMIN_D,
  },

  // SPINACH IS NOT A CALCIUM FOOD, and almost everybody thinks it is.
  //
  // NHS, Calcium, listing good sources: "green leafy vegetables - such as curly
  // kale, okra but NOT spinach". Spinach's oxalates bind its own calcium, so
  // very little of it is available. This is the single most useful thing on
  // this page for somebody eating for their bones, because it is a belief
  // rather than a gap - she is not failing to do something, she is doing
  // something that does not work.
  {
    id: 'spinach-is-not-calcium',
    match: /\bspinach\b/i,
    completedBy: /\b(milk|cheese|yoghurt|yogurt|kale|okra|sardine|pilchard|fortified|soya drink|tofu)\b/i,
    suggestions: ['Curly kale', 'Okra', 'Yoghurt or cheese', 'Sardines'],
    why: 'About a twentieth of spinach’s calcium is absorbed, against a quarter of milk’s - the oxalic acid in it binds the calcium up.',
    note: 'Kale, broccoli and cabbage are different: their calcium is absorbed about as well as milk’s, there is just less of it.',
    source: NIH_CALCIUM,
  },

  // PLANT IRON AND VITAMIN C.
  //
  // NHS, Iron, on sources: "beans, such as red kidney beans, edamame beans and
  // chickpeas, nuts, dried fruit... fortified breakfast cereals". BDA, Iron
  // Food Fact Sheet: vitamin C alongside plant iron improves absorption, and
  // the tannins and polyphenols in tea and coffee bind non-haem iron.
  //
  // THIS IS THE ENTRY THE BRIEF GOT CROSSED. It listed tea and coffee against
  // CALCIUM; the interaction is with iron. Ruth: "Correct it, chatgpt got
  // confused."
  {
    id: 'plant-iron-vitamin-c',
    match: /\b(lentil|lentils|chickpea|chickpeas|kidney bean|edamame|beans|tofu|fortified cereal|dried apricot|spinach|soy)\b/i,
    completedBy: /\b(pepper|peppers|orange|oranges|kiwi|tomato|tomatoes|broccoli|strawberr|citrus|lemon|blackcurrant)\b/i,
    suggestions: ['Peppers', 'Oranges or citrus', 'Tomatoes', 'Kiwi'],
    why: 'Iron from plants is absorbed far better alongside vitamin C.',
    note: 'Tea and coffee work the other way - they bind this kind of iron, so they are better kept away from the meal rather than drunk with it.',
    source: BDA_IRON,
  },
];

export type NutrientCard = {
  about: string;
  suggestions: string[];
  why: string;
  note: string;
  sourceName: string;
  sourceUrl: string;
};

/**
 * The first pairing worth showing for this item, given the whole meal.
 *
 * SILENT WHEN THE MEAL HAS ALREADY DONE IT, the same rule as the protein
 * label: a spinach salad with peppers in it needs no lesson about vitamin C,
 * and a flag that fires anyway is a sticker.
 */
export function nutrientPairFor(
  itemName: string,
  mealNames: string[],
  avoid: string[] = []
): NutrientPair | null {
  const others = mealNames.filter((n) => n !== itemName).join(' | ');
  for (const pair of NUTRIENT_PAIRS) {
    if (!pair.match.test(itemName)) continue;
    // Already covered on the plate.
    if (pair.completedBy.test(others)) continue;
    if (suggestionsFor(pair, avoid).length === 0) continue;
    return pair;
  }
  return null;
}

/**
 * NOTHING SHE CANNOT EAT (Ruth, 30 September: "if nothing, then don't mention
 * it, don't force it if it's going to feel broken").
 */
export function suggestionsFor(pair: NutrientPair, avoid: string[]): string[] {
  const lowered = avoid.map((a) => a.trim().toLowerCase()).filter(Boolean);
  return pair.suggestions
    .filter((s) => {
      const name = s.toLowerCase();
      return !lowered.some((a) => name.includes(a) || a.includes(name) || inGroup(name, a));
    })
    .slice(0, 4);
}

const AVOID_GROUPS: Record<string, string[]> = {
  fish: ['oily fish', 'sardines'],
  shellfish: [],
  dairy: ['yoghurt or cheese'],
  milk: ['yoghurt or cheese'],
  lactose: ['yoghurt or cheese'],
  egg: ['eggs'],
  eggs: ['eggs'],
  gluten: ['fortified cereal'],
  wheat: ['fortified cereal'],
  vegan: ['oily fish', 'sardines', 'eggs', 'yoghurt or cheese'],
  vegetarian: ['oily fish', 'sardines'],
};

function inGroup(suggestion: string, avoided: string): boolean {
  const group = AVOID_GROUPS[avoided];
  return group ? group.includes(suggestion) : false;
}

export function nutrientCard(
  pair: NutrientPair,
  about: string,
  avoid: string[] = []
): NutrientCard | null {
  const suggestions = suggestionsFor(pair, avoid);
  if (suggestions.length === 0) return null;
  return {
    about,
    suggestions,
    why: pair.why,
    note: pair.note,
    sourceName: pair.source.name,
    sourceUrl: pair.source.url,
  };
}

/**
 * An entry that tells her what to do about her own health is refused here, the
 * same as in clinical-reference.ts and for the same reason: the drift happens
 * while summarising a guideline that itself says "should".
 */
const ADVICE_SHAPED = [
  /\byou should\b/i,
  /\bshe should\b/i,
  /\bwe recommend\b/i,
  /\byou need to\b/i,
  /\btake a supplement\b/i,
  /\byou are (?:low|short|deficient)\b/i,
];

export function assertSafePair(pair: NutrientPair): void {
  if (!pair.source?.url || !pair.source?.name || !pair.source?.checked) {
    throw new Error(`Nutrient pair "${pair.id}" has no checkable source.`);
  }
  for (const text of [pair.why, pair.note]) {
    for (const re of ADVICE_SHAPED) {
      if (re.test(text)) {
        throw new Error(
          `Nutrient pair "${pair.id}" is worded as advice (${re}). This teaches which food helps ` +
            'which; it never tells her what to do about her own health.'
        );
      }
    }
  }
}
