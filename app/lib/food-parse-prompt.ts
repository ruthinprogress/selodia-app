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
  breakdown_type?: string;
  confidence?: string;
  items?: ParsedItem[];
};

// Coerce the model's protein_source to a valid enum value or null, so a stray
// value can never violate the DB check constraint and fail the whole log.
export const proteinSource = (s: unknown): 'animal' | 'plant' | 'collagen' | null =>
  s === 'animal' || s === 'plant' || s === 'collagen' ? s : null;

// The exact JSON shape every food-parse call must return. Add a field here once
// and both paths inherit it (also update ParsedItem and buildFoodLogFields).
export const FOOD_PARSE_JSON_SCHEMA =
  '{"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "protein_source": "animal" | "plant" | "collagen" | null, "breakdown_type": "simple" | "multi_component" | "consistent_ratio" | "high_variability", "items": [{"name": string, "quantity": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "protein_source": "animal" | "plant" | "collagen" | null}], "meal_label": string, "confidence": "clear" or "uncertain"}';

// The classification rules over that schema (protein_source + breakdown_type),
// identical for every path. meal_label and confidence guidance stay per-path
// (they differ: typed text is always "clear"; a photo may be "uncertain"), as do
// each path's framing sentences (image label-reading rules, text portion words).
export const FOOD_PARSE_CLASSIFICATION_RULES =
  'For protein_source (on the log and on each item), classify the dominant protein source as "animal" (meat, fish, eggs, dairy, whey), "plant" (legumes, tofu, grains, nuts, seeds), or "collagen" (collagen or gelatin supplements), or null when the food has negligible protein; on the log, use whichever source contributes most of the protein. Set breakdown_type and, when it warrants a breakdown, itemise into items: "simple" for a single or branded item like an apple or a branded yoghurt (items empty); "multi_component" for a meal of distinct parts like steak with a sauce (list each part); "consistent_ratio" for a composite whose make-up is usually consistent like lasagne (one item, items empty); "high_variability" for a composite that really varies like shakshuka or a full English (list each part with a quantity). Item macros should roughly sum to the totals; use the person\'s own portion words for quantity, or a typical portion if none given.';
