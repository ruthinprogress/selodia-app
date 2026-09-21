// Single source of truth for the food-parse model contract (build item 28).
// Both parse paths compose their own path-specific framing around these shared
// pieces: the text logger (food-logging.ts, also used by ask-selodia) and the
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
  // ZERO-CALORIE DRINKS IN THE SAME ENTRY (2026-09-21). Ruth typed "5 chocolate
  // almonds, 1 chocolate caramel Malteser sized, 150g mango, black coffee, 1lt
  // water" and the reply said "the litre of water's in too". It was not: the
  // message was classified as food, and the hydration path only ever ran for a
  // message that was ONLY about a drink, so the litre went nowhere.
  //
  // THE MODEL NAMES THE DRINKS, THE CODE MEASURES THEM - the same division as
  // everywhere else. Which words in a mixed sentence are a drink is an
  // open-ended reading ("coffee cake" is not a coffee); how many millilitres are
  // in a pint is a fixed fact with a right answer.
  drinks?: string[];
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
  '{"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "protein_source": "animal" | "plant" | "collagen" | null, "amino_profile": "complete" | "limiting_lysine" | "limiting_methionine" | "limiting_tryptophan" | null, "breakdown_type": "simple" | "multi_component" | "consistent_ratio" | "high_variability", "items": [{"name": string, "quantity": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "sodium_mg": number, "protein_source": "animal" | "plant" | "collagen" | null, "amino_profile": "complete" | "limiting_lysine" | "limiting_methionine" | "limiting_tryptophan" | null}], "meal_label": string, "confidence": "clear" or "uncertain", "drinks": [string]}';

// ONE MESSAGE CAN BE SEVERAL DAYS OF FOOD (2026-09-16).
//
// "Catch up my food log: Mon 7th pizza and chips, Tuesday 8th burger..." wrote
// nothing at all, and the reply said it had logged all seven days. The text path
// could only ever produce ONE row, stamped now, because nothing in this contract
// let the model say which day a meal belonged to or that there was more than
// one. Part Nine has always counted retrospective catch-up entries toward a day
// being logged, so the gap was in the parse, not the rule.
//
// Activity solved this long ago by resolving relative dates and splitting
// multiple activities, so food now takes the same shape: an envelope of entries,
// each carrying its own day and its own words.
export type ParsedEntry = ParsedMacros & {
  // The day this entry belongs to, ISO, or null for today.
  detected_date?: string | null;
  // The person's own words for THIS entry, so a row's raw_text is the meal
  // rather than the whole seven-day message.
  entry_text?: string;
};

export type ParsedFoodEntries = { entries?: ParsedEntry[] };

// The per-entry shape: the single-log schema plus the two fields that make a
// catch-up possible. Composed from the schema above rather than restated, so a
// field added there is inherited here (the closing brace is replaced).
export const FOOD_PARSE_ENTRY_SCHEMA =
  FOOD_PARSE_JSON_SCHEMA.slice(0, -1) +
  ', "detected_date": iso8601_date_string_or_null, "entry_text": string}';

export const FOOD_PARSE_ENTRIES_SCHEMA = `{"entries": [${FOOD_PARSE_ENTRY_SCHEMA}]}`;

// The classification rules over that schema (protein_source + breakdown_type),
// identical for every path. meal_label and confidence guidance stay per-path
// (they differ: typed text is always "clear"; a photo may be "uncertain"), as do
// each path's framing sentences (image label-reading rules, text portion words).
export const FOOD_PARSE_CLASSIFICATION_RULES =
  // A WEIGHT BELONGS TO THE DISH IT SITS IN FRONT OF (21 September 2026). Her
  // "50g cheese omelette" came back as an omelette MADE WITH 50g of cheese -
  // two large eggs plus fifty grams of cheese, 385 kcal against the 88 that
  // fifty grams of her own morning omelette implies. Nothing in these rules
  // said which noun the weight attached to, and both readings are available in
  // English; only one of them is what anybody means.
  'A WEIGHT WRITTEN BEFORE A FOOD IS THE WEIGHT OF THAT FOOD, always. "50g cheese omelette" is fifty grams of cheese omelette - a small portion of a finished dish - and NOT an omelette containing fifty grams of cheese. "200g chicken curry" is two hundred grams of curry, not a curry made with 200g of chicken. To mean the other thing a person writes "omelette with 50g cheese", where the weight follows the food it belongs to. So when a weight opens the description of a single dish, every item you list must add up to about that weight: if the parts you are itemising would weigh far more than the person said the dish weighs, you have attached the weight to an ingredient instead of to the dish, and the macros are wrong by a multiple. ' +
  'For protein_source (on the log and on each item), classify the dominant protein source as "animal" (meat, fish, eggs, dairy, whey), "plant" (legumes, tofu, grains, nuts, seeds), or "collagen" (collagen or gelatin supplements), or null when the food has negligible protein; on the log, use whichever source contributes most of the protein. Set breakdown_type and, when it warrants a breakdown, itemise into items: "simple" for a single or branded item like an apple or a branded yoghurt (items empty); "multi_component" for a meal of distinct parts like steak with a sauce (list each part); "consistent_ratio" for a composite whose make-up is usually consistent like lasagne (one item, items empty); "high_variability" for a composite that really varies like shakshuka or a full English (list each part with a quantity). Item macros should roughly sum to the totals; use the person\'s own portion words for quantity, or a typical portion if none given. Each item name must be SPECIFIC enough to be read on its own in a table - "white olive bread + butter" and "scrambled eggs x2", never a bare "bread" or "eggs", and never a category like "dairy" or "carbs". Keep the person\'s own words for what a thing was where they gave them. Include a zero-calorie item they mentioned (a black coffee, a tea) as its own row rather than dropping it: a breakdown that silently omits part of what they said reads as an error, not a tidy-up. For amino_profile (on the log and on each item), say which essential amino acid that food is LIMITING in, which is what decides whether two foods complete each other: "complete" for animal protein, and also for soy, quinoa, buckwheat and amaranth, which are complete in their own right; "limiting_methionine" for legumes (beans, lentils, peas); "limiting_lysine" for grains, nuts and seeds; "limiting_tryptophan" for collagen and gelatin, which are very low in it. Use null when the food carries negligible protein - a lettuce leaf or a black coffee has no amino profile worth stating. Judge the FOOD, not the meal: whether the meal as a whole is complete is worked out afterwards from these values, so never adjust one item\'s profile to account for another item.';
