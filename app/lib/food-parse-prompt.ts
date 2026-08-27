// Single source of truth for the food-parse model contract (build item 28).
// Both parse paths compose their own path-specific framing around these shared
// pieces: the text logger (food-logging.ts, also used by ask-unflump) and the
// image path (parse-food/route.ts). Previously the JSON schema, the
// classification rules, the ParsedItem type, and the protein_source validator
// were duplicated across both, so adding a field (e.g. sodium_mg) meant editing
// two places by hand. Add a field here once and both paths inherit it (also
// update ParsedItem below and buildFoodLogFields in food-logging.ts).

// One component of an itemised breakdown (build item 11). All fields optional -
// the model may omit any, and name is coerced non-empty before insert.
export type ParsedItem = {
  name?: string;
  quantity?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sodium_mg?: number;
  protein_source?: string;
  amino_profile?: string;
};

// The parsed macros object the model returns for a whole log (shape of the JSON
// described by FOOD_PARSE_JSON_SCHEMA). All optional - the model may omit any,
// and each consumer coerces/defaults as needed.
export type ParsedMacros = {
  meal_label?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sodium_mg?: number;
  protein_source?: string;
  amino_profile?: string;
  breakdown_type?: string;
  confidence?: string;
  items?: ParsedItem[];
};

// Coerce the model's protein_source to a valid enum value or null, so a stray
// value can never violate the DB check constraint and fail the whole log.
export const proteinSource = (s: unknown): 'animal' | 'plant' | 'collagen' | null =>
  s === 'animal' || s === 'plant' || s === 'collagen' ? s : null;

// The limiting amino acid, for meal-level completeness reasoning. protein_source
// cannot answer that question: legumes are methionine-limited and grains
// lysine-limited, so lentils + rice is complete while lentils + chickpeas is
// not - and both are "plant, plant". Coerced valid-or-null on the same grounds:
// a stray value must degrade to "we don't know", never to a wrong claim.
export type AminoProfileValue =
  | 'complete'
  | 'limiting_lysine'
  | 'limiting_methionine'
  | 'limiting_tryptophan';

export const aminoProfile = (s: unknown): AminoProfileValue | null =>
  s === 'complete' ||
  s === 'limiting_lysine' ||
  s === 'limiting_methionine' ||
  s === 'limiting_tryptophan'
    ? s
    : null;

// The exact JSON shape every food-parse call must return. Add a field here once
// and both paths inherit it (also update ParsedItem and buildFoodLogFields).
export const FOOD_PARSE_JSON_SCHEMA =
  '{"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "protein_source": "animal" | "plant" | "collagen" | null, "amino_profile": "complete" | "limiting_lysine" | "limiting_methionine" | "limiting_tryptophan" | null, "breakdown_type": "simple" | "multi_component" | "consistent_ratio" | "high_variability", "items": [{"name": string, "quantity": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "protein_source": "animal" | "plant" | "collagen" | null, "amino_profile": "complete" | "limiting_lysine" | "limiting_methionine" | "limiting_tryptophan" | null}], "meal_label": string, "confidence": "clear" or "uncertain"}';

// The classification rules over that schema (protein_source + breakdown_type),
// identical for every path. meal_label and confidence guidance stay per-path
// (they differ: typed text is always "clear"; a photo may be "uncertain"), as do
// each path's framing sentences (image label-reading rules, text portion words).
export const FOOD_PARSE_CLASSIFICATION_RULES =
  'For protein_source (on the log and on each item), classify the dominant protein source as "animal" (meat, fish, eggs, dairy, whey), "plant" (legumes, tofu, grains, nuts, seeds), or "collagen" (collagen or gelatin supplements), or null when the food has negligible protein; on the log, use whichever source contributes most of the protein. Set breakdown_type and, when it warrants a breakdown, itemise into items: "simple" for a single or branded item like an apple or a branded yoghurt (items empty); "multi_component" for a meal of distinct parts like steak with a sauce (list each part); "consistent_ratio" for a composite whose make-up is usually consistent like lasagne (one item, items empty); "high_variability" for a composite that really varies like shakshuka or a full English (list each part with a quantity). Item macros should roughly sum to the totals; use the person\'s own portion words for quantity, or a typical portion if none given. Each item name must be SPECIFIC enough to be read on its own in a table - "white olive bread + butter" and "scrambled eggs x2", never a bare "bread" or "eggs", and never a category like "dairy" or "carbs". Keep the person\'s own words for what a thing was where they gave them. Include a zero-calorie item they mentioned (a black coffee, a tea) as its own row rather than dropping it: a breakdown that silently omits part of what they said reads as an error, not a tidy-up. For amino_profile (on the log and on each item), say which essential amino acid that food is LIMITING in, which is what decides whether two foods complete each other: "complete" for animal protein, and also for soy, quinoa, buckwheat and amaranth, which are complete in their own right; "limiting_methionine" for legumes (beans, lentils, peas); "limiting_lysine" for grains, nuts and seeds; "limiting_tryptophan" for collagen and gelatin, which are very low in it. Use null when the food carries negligible protein - a lettuce leaf or a black coffee has no amino profile worth stating. Judge the FOOD, not the meal: whether the meal as a whole is complete is worked out afterwards from these values, so never adjust one item\'s profile to account for another item.';
