// WHERE EVERY NUTRIENT FIGURE IN THIS APP CAME FROM.
//
// Ruth, 24 October 2026: "All nutrients should have the correct figure for
// women in the range of the age that is actually recorded for the user. If this
// needs a research task, then let's do it properly and save the research links
// into the citings doc."
//
// EVERY ENTRY WAS FETCHED AND READ ON THE DATE IT CARRIES. None is recalled.
// Where the page gave a sentence, the sentence is quoted rather than
// paraphrased, because a paraphrase is where a figure quietly drifts.
//
// ── WHAT THE RESEARCH ACTUALLY CHANGED ──────────────────────────────────────
//
// THE FAMILIAR GRAM FIGURES ARE PERCENTAGES WITH THE ARITHMETIC ALREADY DONE,
// for a woman who is not her. The UK label Reference Intakes - 70g fat, 20g
// saturates, 260g carbohydrate - are stated by the guidance itself as "based on
// an average sized woman doing an average amount of physical activity" eating
// 2,000 kcal. Four of the ten figures were being applied flat, so a woman
// eating 1,560 kcal and keeping under 20g of saturated fat sat at 11.5% of her
// energy - over the 10% ceiling, while the app told her she was in range.
//
// Fibre, salt and calcium were checked for the same fault and do NOT have it:
// all three are set as absolutes for adults, not as shares of energy. They are
// unchanged, and the check holds them that way so nobody "improves" them later.
//
// ── THE LINE THIS FILE DOES NOT CROSS ───────────────────────────────────────
//
// These are population reference values. They are shown as GUIDELINES, named
// with the body that set them, and never as her target - see referenceFor in
// nutrient-standing.ts. Nothing here is advice, and nothing here connects a
// figure to a condition; that belongs behind the clinical gate.

export type NutrientCitation = {
  /** The figure, as the app applies it. */
  figure: string;
  /** Who set it. */
  body: string;
  /** The page it was read from. */
  url: string;
  /** Quoted from that page, not paraphrased. */
  quote: string;
  /** When it was last read against the source. */
  checked: string;
  /** Whether the app scales this to her own energy, and why or why not. */
  scaling: 'share of her energy' | 'absolute' | 'age and sex';
};

export const NUTRIENT_CITATIONS: NutrientCitation[] = [
  {
    figure: 'Saturated fat: no more than 10% of food energy.',
    body: 'SACN / NHS',
    url: 'https://www.nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/eat-less-saturated-fat/',
    quote: 'the average woman should eat no more than 20g of saturated fat a day',
    checked: '2026-10-24',
    scaling: 'share of her energy',
  },
  {
    figure: 'Total fat: no more than 35% of food energy.',
    body: 'UK dietary reference value',
    url: 'https://www.nutrition.org.uk/creating-a-healthy-diet/food-labelling/',
    quote:
      'Reference intakes ... are based on an average sized woman doing an average amount of '
      + 'physical activity. Total fat: 70 g',
    checked: '2026-10-24',
    scaling: 'share of her energy',
  },
  {
    figure: 'Carbohydrate: around 50% of total dietary energy.',
    body: 'SACN, Carbohydrates and Health (2015)',
    url: 'https://assets.publishing.service.gov.uk/media/5a7f7cc3ed915d74e622ac2a/SACN_Carbohydrates_and_Health.pdf',
    quote:
      'the dietary reference value for carbohydrates be maintained at a population average of '
      + 'approximately 50% of total dietary energy intake',
    checked: '2026-10-24',
    scaling: 'share of her energy',
  },
  {
    figure: 'Free sugars: no more than 5% of energy.',
    body: 'SACN / NHS',
    url: 'https://www.nhs.uk/live-well/eat-well/food-types/how-does-sugar-in-our-diet-affect-our-health/',
    quote: 'Adults should have no more than 30g of free sugars a day',
    checked: '2026-10-24',
    scaling: 'share of her energy',
  },
  {
    figure: 'Fibre: 30g a day for adults. NOT scaled to energy.',
    body: 'SACN, Carbohydrates and Health (2015) / NHS',
    url: 'https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/',
    quote:
      'Government guidelines say our dietary fibre intake should increase to 30g a day ... for '
      + 'adults (aged 17 years and over)',
    checked: '2026-10-24',
    scaling: 'absolute',
  },
  {
    figure: 'Salt: no more than 6g a day. NOT scaled to energy.',
    body: 'NHS',
    url: 'https://www.nhs.uk/live-well/eat-well/food-types/salt-in-your-diet/',
    quote: 'Adults should have no more than 6g of salt a day (around 1 level teaspoon).',
    checked: '2026-10-24',
    scaling: 'absolute',
  },
  {
    figure: 'Calcium: 700mg a day for adults. No UK post-menopausal increase.',
    body: 'NHS',
    url: 'https://www.nhs.uk/conditions/vitamins-and-minerals/calcium/',
    quote: 'Adults aged 19 to 64 and over need 700mg of calcium a day.',
    checked: '2026-10-24',
    scaling: 'absolute',
  },
  {
    figure: 'Iron: 14.8mg for women 19-49, 8.7mg from 50 - unless still menstruating.',
    body: 'NHS',
    url: 'https://www.nhs.uk/conditions/vitamins-and-minerals/iron/',
    quote:
      '14.8mg a day for women aged 19 to 49 ... 8.7mg a day for women aged 50 and over. '
      + 'Women who continue menstruating after age 50 may require the higher amount.',
    checked: '2026-10-24',
    scaling: 'age and sex',
  },
];

/** The three the research confirmed must NOT be scaled to energy. */
export const ABSOLUTE_FIGURES = ['fibre', 'salt', 'calcium'] as const;
