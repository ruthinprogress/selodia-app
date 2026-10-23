import { weightIsPossible } from './food-weight-sanity';
import { recordRouteError } from './turn-diagnostics';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordModelUsage } from './usage-record';
import {
  FOOD_DEDUPE_WINDOW_MIN,
  findSameMeal,
  restatesEntries,
  sameMeal,
  stripDayLabel,
  type RecentItems,
  type RecentLog,
} from './food-dedupe';
import {
  FOOD_PARSE_CLASSIFICATION_RULES,
  FOOD_PARSE_OMIT_RATHER_THAN_GUESS,
  FOOD_PARSE_STATED_WEIGHT_IS_BINDING,
  FOOD_PARSE_ENTRIES_SCHEMA,
  FOOD_PARSE_JSON_SCHEMA,
  aminoProfile, proteinSource,
  type ParsedEntry,
  type ParsedFoodEntries,
  type ParsedItem,
  type ParsedMacros,
} from './food-parse-prompt';
import { drinksNamedIn, mentionsDrink } from './caloric-drink';
import { correctDrinkEstimates } from './drink-composition';
import { loadRememberedFoods, rememberedFoodsBlock } from './food-memory';
import { checkStatedWeight, scaleMacros } from './stated-weight';
import { entriesNeedingSplit, SPLIT_AGAIN } from './itemisation';
import { logWaterWithFood } from './water-in-food';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type FoodEntry = {
  id: string;
  meal_label: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: string;
};

// The food_logs column values derived from a parsed-macros object, shared by
// both parse paths (build item 28). The caller adds raw_text, user_id, and
// happened_at, which vary by path (a photo log's raw_text, an update preserving
// the original happened_at, etc.).
/**
 * DOES HER CORRECTION ACTUALLY SAY WHICH MEAL THIS WAS?
 *
 * The one question that decides whether a correction may move an entry from
 * lunch to breakfast. Deliberately narrow: the label changes when she says so,
 * and not otherwise.
 *
 * "tea" IS NOT IN HERE, and that is on purpose. It is a meal in half the
 * country and a drink in the other half, and "I only had one cup of tea" would
 * otherwise read as her renaming the meal. Leaving it out costs nothing worth
 * having: the entry keeps the label it already had, which is the safe answer.
 */
const NAMES_A_MEAL = /\b(breakfast|brunch|lunch|dinner|supper|snack|pudding|dessert)\b/i;

/**
 * The label a corrected entry keeps.
 *
 * FOUND 14 OCTOBER 2026, in the comparison run, and it is the fault Ruth asked
 * me to find by name: "find why T4 set it to breakfast". She corrected a lunch,
 * the calories went in correctly, and the entry came back labelled Breakfast.
 *
 * The cause is upstream of the model and no prompt would have fixed it: on a
 * correction the parse is shown the corrected FOOD and nothing else - not the
 * entry's existing label, not the time it was eaten - and is asked to infer a
 * label "using time-of-day clues if mentioned, or the food type if not". There
 * are no time clues in "100g of porridge", so it infers from the food, and
 * porridge is breakfast. It was never deciding to move her meal; it was never
 * told there was a meal to move.
 *
 * So the guard sits at the write, per the standing rule - never ask the model
 * not to do a thing twice, make it impossible instead. A correction keeps the
 * label the entry already had unless her own words name a meal.
 */
export function keptMealLabel(
  existing: string | null | undefined,
  parsed: string | null | undefined,
  correction: string
): string | null {
  const had = existing?.trim();
  if (!had) return parsed?.trim() || null;
  return NAMES_A_MEAL.test(correction) ? parsed?.trim() || had : had;
}

export function buildFoodLogFields(macros: ParsedMacros) {
  return {
    meal_label: macros.meal_label,
    kcal: macros.kcal,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    sodium_mg: macros.sodium_mg ?? null,
    // Null, never zero: see FOOD_PARSE_OMIT_RATHER_THAN_GUESS.
    calcium_mg: macros.calcium_mg ?? null,
    iron_mg: macros.iron_mg ?? null,
    saturated_fat_g: macros.saturated_fat_g ?? null,
    sugar_g: macros.sugar_g ?? null,
    fibre_g: macros.fibre_g ?? null,
    protein_source: proteinSource(macros.protein_source),
    amino_profile: aminoProfile(macros.amino_profile),
    breakdown_type: macros.breakdown_type ?? null,
    confidence: macros.confidence || 'clear',
  };
}

// Writes the itemised components for a food log. Best-effort: the aggregate log
// is what matters, so a missing breakdown never fails the log itself. Exported
// so parse-food's image path reuses the same mapping (build item 28).
export async function writeItems(
  supabase: SupabaseClient,
  foodLogId: string,
  userId: string,
  items: ParsedItem[]
) {
  if (items.length === 0) return;

  // A DRINK IS MEASURED, NOT ESTIMATED (2026-09-28). Her half of lager was
  // logged at 180 kcal and 6 g protein where CoFID makes it 68 and 0.9 - the
  // protein seven times out. See app/lib/drink-composition.ts for why drinks are
  // the one case where a reference table beats a model, and why this is a lookup
  // rather than another sentence in the prompt.
  //
  // HERE BECAUSE BOTH PATHS MEET HERE. The text logger and the image parser both
  // call writeItems, so a guard at this point covers every way food reaches the
  // database - which is the same reasoning as the plan-as-session guard and the
  // thigh measurement before it.
  const { items: checked, corrections } = await correctDrinkEstimates(supabase, items);
  for (const c of corrections) {
    console.log(
      `DRINK CORRECTED: "${c.name}" ${c.from.kcal ?? '?'}kcal/${c.from.protein_g ?? '?'}g -> ` +
        `${c.to.kcal}kcal/${c.to.protein_g}g from ${c.source} (${c.measure})`
    );
  }

  const { error } = await supabase.from('food_items').insert(
    checked.map((it) => ({
      food_log_id: foodLogId,
      user_id: userId,
      name: String(it.name ?? '').trim() || 'item',
      quantity: it.quantity ?? null,
      kcal: it.kcal ?? null,
      protein_g: it.protein_g ?? null,
      carbs_g: it.carbs_g ?? null,
      fat_g: it.fat_g ?? null,
      sodium_mg: it.sodium_mg ?? null,
      calcium_mg: it.calcium_mg ?? null,
      iron_mg: it.iron_mg ?? null,
      saturated_fat_g: it.saturated_fat_g ?? null,
      sugar_g: it.sugar_g ?? null,
      fibre_g: it.fibre_g ?? null,
      protein_source: proteinSource(it.protein_source),
      amino_profile: aminoProfile(it.amino_profile),
    }))
  );
  if (error) console.log('food_items insert failed (non-fatal):', error.message);

  // ONE SOURCE FOR THE MEAL AND ITS PARTS (Ruth, 30 September 2026: "meal total
  // and item figures must come from one source").
  //
  // WHAT WAS WRONG. The model is asked for the totals AND the items in the same
  // answer, and the only thing holding them together was a clause in the prompt:
  // "Item macros should roughly sum to the totals". Roughly is what it did. On
  // 30 September, 68 of her itemised meals were measured against their own
  // items and 16 disagreed by more than 5 kcal, the worst by 206 - and it was
  // not a rounding drift, it was two independent estimates of the same plate.
  //
  // So the items are now the record and the meal is their sum. Not because the
  // items are more accurate - sometimes they are worse - but because a number
  // she can open up and inspect is the only one she can correct. A total that
  // nothing adds up to cannot be argued with.
  //
  // THIS BLOCK USED TO RUN ONLY AFTER A DRINK CORRECTION, and its comment gave
  // the reason: "an entry carrying a total with no itemisation is a legitimate
  // shape, and recomputing every log from a sum over its items would zero
  // those." That was right and it is still handled - writeItems returns at the
  // top when there are no items, so nothing here can reach an un-itemised
  // entry. What has changed is that having items is now enough.
  //
  // ALL EIGHT FIGURES, not the two the drink path needed. Summing calories and
  // protein while leaving carbs, fat, sugar, fibre and sodium as the model
  // first wrote them would leave the meal half agreeing with itself, which is a
  // worse state to reason about than plain disagreement.
  if (!error) {
    // NOTHING KNOWN MEANS NOTHING KNOWN, NOT ZERO. ParsedItem's own comment
    // makes the rule: "a figure it did not work out must stay absent rather
    // than become a zero". A sum over items that all omit fibre is 0, and 0 g
    // of fibre is a measurement - it would show on her card as a figure
    // somebody took. So a macro no item states at all stays null, and the sum
    // runs only over the ones that do.
    const sum = (pick: (i: ParsedItem) => number | undefined, places: 0 | 1) => {
      const stated = checked.map(pick).filter((v): v is number => typeof v === 'number');
      if (stated.length === 0) return null;
      const total = stated.reduce((n, v) => n + v, 0);
      return places === 0 ? Math.round(total) : Math.round(total * 10) / 10;
    };
    const { error: totalsError } = await supabase
      .from('food_logs')
      .update({
        kcal: sum((i) => i.kcal, 0),
        protein_g: sum((i) => i.protein_g, 1),
        carbs_g: sum((i) => i.carbs_g, 1),
        fat_g: sum((i) => i.fat_g, 1),
        saturated_fat_g: sum((i) => i.saturated_fat_g, 1),
        sugar_g: sum((i) => i.sugar_g, 1),
        fibre_g: sum((i) => i.fibre_g, 1),
        sodium_mg: sum((i) => i.sodium_mg, 0),
        calcium_mg: sum((i) => i.calcium_mg, 0),
        iron_mg: sum((i) => i.iron_mg, 0),
      })
      .eq('id', foodLogId);
    if (totalsError) {
      console.log('food_logs totals not summed from its items:', totalsError.message);
    }
  }
}

// IS THERE ANY FOOD IN THIS ENTRY AT ALL?
//
// Found on device 2026-09-16: "It's not gone into the log" - a complaint that
// the logging had failed - was itself written into food_logs at 0 kcal, because
// the model set logIntent 'food' on it and nothing downstream asked whether the
// text described any food. The same guard activity has had all along (no
// duration, no row), for the same reason: a row nobody ate is worse than a
// missing one, and it lands in the week's averages either way.
export function hasFood(entry: ParsedEntry): boolean {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  if ((entry.items ?? []).length > 0) return true;
  return n(entry.kcal) > 0 || n(entry.protein_g) > 0 || n(entry.carbs_g) > 0 || n(entry.fat_g) > 0;
}

export type FoodRow = {
  happenedAt: string;
  rawText: string;
  items: ParsedItem[];
  fields: ReturnType<typeof buildFoodLogFields>;
  // The zero-calorie drinks named in this entry, verbatim. Measured and written
  // to hydration after the row lands - see waterFromDrinks below.
  drinks: string[];
};

/**
 * The rows a parse turns into: one per entry, each on its own day.
 *
 * A DAY, NOT A MOMENT. The day comes from the model's detected_date, and the
 * time of day is carried over from `now` - the same approach activity takes.
 * The day is what every weekly figure buckets by, and a person catching up on
 * Wednesday cannot tell us what time on Monday they ate.
 *
 * Pure, so the edges are testable: scripts/probe-food-backfill.mjs.
 */
export function buildFoodRows(
  parsed: ParsedFoodEntries,
  foodText: string,
  now: Date = new Date()
): FoodRow[] {
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const timeOfDay = now.toISOString().slice(11, 23);
  return entries.filter(hasFood).map((raw) => {
    const date =
      typeof raw.detected_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.detected_date)
        ? raw.detected_date
        : null;
    const text = typeof raw.entry_text === 'string' ? raw.entry_text.trim() : '';
    // WITHOUT "Sunday 11 Oct:" IN FRONT (12 October 2026). A catch-up hands the
    // parser its days as labels, and the label became the start of the food's
    // name on her log page - and three words the duplicate guard had to see past.
    const rawText = stripDayLabel(text || foodText);

    // THE WEIGHT SHE GAVE BEATS THE ONE THE MODEL ASSEMBLED (21 September
    // 2026). "50g cheese omelette" came back as two large eggs plus fifty
    // grams of cheese - an omelette made WITH 50g of cheese, about 150g of
    // food, against the fifty grams she said. The prompt now says which noun a
    // leading weight belongs to, and this is here because a rule the model is
    // asked to follow is not a guard. See stated-weight.ts.
    const check = checkStatedWeight(rawText, raw);
    const entry = check.rescaled ? scaleMacros(raw, check.factor) : raw;
    if (check.rescaled) {
      console.log(
        `FOOD: "${rawText}" stated ${check.statedGrams}g but its parts weighed ${Math.round(check.itemGrams)}g - scaled to what they said`
      );
    }

    return {
      happenedAt: date ? `${date}T${timeOfDay}Z` : now.toISOString(),
      // The entry's own words when the model separated them out, so a row in a
      // seven-day catch-up reads as that day's meal rather than as the whole
      // message repeated seven times.
      rawText,
      items: Array.isArray(entry.items) ? entry.items : [],
      fields: buildFoodLogFields(entry),
      drinks: reconcileDrinks(
        Array.isArray(entry.drinks) ? entry.drinks.filter((d): d is string => typeof d === 'string') : [],
        rawText
      ),
    };
  });
}

/**
 * The drinks the model returned, plus any it named in the entry text and then
 * left out.
 *
 * WHY THIS IS HERE AND NOT IN THE PROMPT (23 September 2026). The prompt already
 * says, at length and in capitals, that every drink goes in `drinks`, that none
 * may be left out for any reason, and that a litre of water somebody typed and
 * never saw recorded is the failure the field exists to stop. It is about as
 * emphatic as a prompt gets, and on "Chicken salad with avocado and a flat white
 * for lunch" the model wrote the flat white into the entry text, said out loud
 * that it had been added, and returned an empty `drinks`.
 *
 * So the hydration row no longer depends on the model having remembered. It
 * depends on the words the person typed, which are right there.
 *
 * ADDITIVE ONLY. Nothing the model returned is removed or rewritten - it has the
 * conversation and knows whether "a cuppa" had milk in it. This only puts back
 * what fell out.
 */
export function reconcileDrinks(fromModel: string[], entryText: string): string[] {
  const named = drinksNamedIn(entryText);
  const missing = named.filter((drink) => !fromModel.some((d) => mentionsDrink(d, drink.noun)));
  if (missing.length === 0) return fromModel;
  console.log(
    `DRINK: "${entryText}" named ${missing.map((m) => `"${m.phrase}"`).join(', ')} and the parse left ${missing.length === 1 ? 'it' : 'them'} out - recovered from the text`
  );
  return [...fromModel, ...missing.map((m) => m.phrase)];
}

// Shared text-only food logging: extract macros via Haiku, insert into
// food_logs, return the stored rows. Used by the chat handler (ask-selodia) for
// silent in-conversation logging. Throws on extraction/parse/insert failure so
// the caller decides how to surface it - ask-selodia appends no confirmation
// (the storage-failure rule: never claim it saved when it did not). Image-based
// food logging stays in parse-food; it is deliberately out of the chat path.
//
// RETURNS AN ARRAY, and can return an empty one. Empty means nothing in the text
// was food, which is a real answer rather than a failure - the caller must not
// say anything was logged.
//
// updateLogId, when given, re-parses foodText and UPDATES that existing log in
// place (replacing its items) instead of inserting - used to resolve a
// consistent-ratio clarification with an enriched description (build item 11,
// slice 2a). An update preserves the original happened_at and is always one row.
/**
 * A short name built from the foods themselves: "Bowl of ice cream with banana
 * and raisins (2)". Null when there is nothing to name it from.
 */
export function namedFromItems(items: ParsedItem[]): string | null {
  const counts = new Map<string, number>();
  for (const i of items) {
    const name = typeof i.name === 'string' ? i.name.trim() : '';
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts]
    .map(([name, n]) => (n > 1 ? `${name} (${n})` : name))
    .join(', ');
}

export async function logFoodFromText(
  supabase: SupabaseClient,
  userId: string,
  foodText: string,
  happenedAt?: string,
  updateLogId?: string,
  // The entry as it stood, when foodText is a CORRECTION to it rather than a
  // full description. See the update instruction below.
  correctionOf?: string,
  // The spoken turn that wrote these rows, stamped on each so the voice guard
  // can tell one sentence's rows from everything else (lib/voice-supersede.ts).
  sourceTurnId?: string
): Promise<FoodEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  // THE CLOCK, BECAUSE GUESSING THE MEAL FROM THE FOOD GETS IT WRONG
  // (Ruth, 23 October 2026). Her 19:25 yoghurt and smoked salmon sandwich was
  // labelled "Breakfast", so her day read Lunch, Snack, Snack, Breakfast,
  // Snack - correct in time order, with one label that made it look shuffled.
  //
  // The instruction below said to use time-of-day clues "if mentioned, or the
  // food type if not", and the time was never passed in. So it was ALWAYS
  // guessing from the food, and yoghurt reads as breakfast at any hour. The
  // app knows what time it is; guessing where a fact is available is a bug.
  const nowLocal = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Her own last value for any food in this text she has logged before, so a
  // staple is counted the same way every time. See lib/food-memory.ts.
  const memory = rememberedFoodsBlock(await loadRememberedFoods(supabase, userId, foodText));

  // A CORRECTION IS APPLIED, NOT SUBSTITUTED (2026-09-19). "The chocolate
  // caramel was just one tiny caramel the size of a Malteser" used to be parsed
  // on its own and written over the entry, so the candied orange logged with it
  // vanished. The model now sees the entry as it stood and the correction, and
  // returns the corrected whole - in her words, as entry_text - so everything
  // she did not change survives.
  const correctionLead =
    updateLogId && correctionOf
      ? 'This food entry was logged as: "' +
        correctionOf.replace(/"/g, "'") +
        '". The person has now corrected it; their correction is given below as the food entry. Apply their correction to that entry, keep every item they did not change, and estimate the corrected whole. Include "entry_text": the corrected entry described in their own words, as short as the original. '
      : '';

  const instruction = updateLogId
    ? correctionLead +
      'Estimate the macros for this food entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: ' +
      FOOD_PARSE_JSON_SCHEMA +
      ' ' +
      FOOD_PARSE_CLASSIFICATION_RULES +
      FOOD_PARSE_OMIT_RATHER_THAN_GUESS +
      FOOD_PARSE_STATED_WEIGHT_IS_BINDING +
      ' For meal_label, infer a short label (e.g. "Breakfast", "Lunch", "Dinner", "Snack"). IT IS NOW ' + nowLocal + ' AND THAT IS THE FIRST THING TO USE. A meal logged in the evening is not breakfast however breakfasty the food is: yoghurt at 19:25 is a snack or part of dinner. Prefer a time-of-day word the person actually said - "this was my breakfast", "this morning" - because they may be catching up on an earlier meal. Fall back on the food type only when you have neither. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries.' +
      ' EVERY DRINK ALSO GOES IN "drinks", verbatim and with its quantity, one string each - "1lt water", "black coffee", "two mugs of tea with milk", "a pint of cider", "a glass of orange juice". ALL of them, whatever they contain: water, tea, coffee, squash, juice, milk, a smoothie, a fizzy drink, alcohol. A caloric drink still belongs in "items" as well, with its macros, because it is food too - being in "drinks" is about the volume, not the calories. The one thing that is not a drink is a food that merely borrows the name of one: a coffee cake is not a coffee. Return an empty array when there were none. The app decides what each drink counts toward and converts the volumes itself, so do not estimate a volume and do not leave a drink out for any reason: a litre of water somebody typed and never saw recorded is the failure this field exists to stop.' +
      memory +
      ' Food entry: "' +
      foodText +
      '"'
    : 'The person described food they ate, which may be one meal or several, and may cover more than one day. ' +
      `Today's date is ${today}. ` +
      'Return one object in "entries" per MEAL: split a message that describes several meals or several days into separate entries, and never merge two days into one. ' +
      'If an entry names a day - "Monday", "Mon 7th", "yesterday", "last Tuesday" - work out the actual date and return it as detected_date in ISO format (e.g. "2026-09-07"). A named day without a year means the most recent one that has already happened, never a future date. Return null for detected_date when no day is given, and the entry will be logged as today. ' +
      'Put the person\'s own words for that entry in entry_text. ' +
      'ITEMISE EVERY ENTRY, however many there are: fill items with the real components of each meal. Keep it to what was actually described - around six items at most - rather than splitting a dish into ingredients nobody mentioned. ' +
      'IF THE TEXT DESCRIBES NO FOOD AT ALL - a question, a complaint that something did not save, a comment about logging - return {"entries": []}. Never invent a meal to fill the gap, and never treat a remark about the log as a meal. ' +
      'Estimate the macros for each entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: ' +
      FOOD_PARSE_ENTRIES_SCHEMA +
      ' ' +
      FOOD_PARSE_CLASSIFICATION_RULES +
      FOOD_PARSE_OMIT_RATHER_THAN_GUESS +
      FOOD_PARSE_STATED_WEIGHT_IS_BINDING +
      ' For meal_label on each entry, infer a short label (e.g. "Breakfast", "Lunch", "Dinner", "Snack"). IT IS NOW ' + nowLocal + ' AND THAT IS THE FIRST THING TO USE. A meal logged in the evening is not breakfast however breakfasty the food is: yoghurt at 19:25 is a snack or part of dinner. Prefer a time-of-day word the person actually said - "this was my breakfast", "this morning" - because they may be catching up on an earlier meal. Fall back on the food type only when you have neither. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries.' +
      ' EVERY DRINK ALSO GOES IN "drinks", verbatim and with its quantity, one string each - "1lt water", "black coffee", "two mugs of tea with milk", "a pint of cider", "a glass of orange juice". ALL of them, whatever they contain: water, tea, coffee, squash, juice, milk, a smoothie, a fizzy drink, alcohol. A caloric drink still belongs in "items" as well, with its macros, because it is food too - being in "drinks" is about the volume, not the calories. The one thing that is not a drink is a food that merely borrows the name of one: a coffee cake is not a coffee. Return an empty array when there were none. The app decides what each drink counts toward and converts the volumes itself, so do not estimate a volume and do not leave a drink out for any reason: a litre of water somebody typed and never saw recorded is the failure this field exists to stop.' +
      memory +
      ' What they said: "' +
      foodText +
      '"';

  // ROOM TO FINISH THE SENTENCE. Measured on 2026-09-16: a seven-day catch-up
  // ran to exactly 2000 output tokens, stopped on max_tokens mid-JSON, and the
  // parse threw - which the route honestly reported as "that didn't save", with
  // no way for anyone to see why. The model had understood every day; it simply
  // could not close the brackets.
  //
  // THE FIRST FIX WAS THE WRONG HALF. Suppressing per-entry items brought a
  // week back to about 700 tokens and it did stop the truncation - but the cost
  // landed the same day: seven rows went in with no food_items, so every one of
  // them showed as "Dinner" with nothing beneath it, and Ruth's verdict was
  // that there was nothing there to discuss. The ceiling is what buys the room,
  // not the missing breakdown. Re-measured with items back on and the same
  // seven-day message (scripts/repro-food-parse.mjs 8000): 2,316 output tokens,
  // stop_reason end_turn, seven entries itemised. That is under a third of the
  // cap, so a fortnight of catch-up still finishes its sentence.
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    // 500 ON THE CORRECTION PATH UNTIL 14 OCTOBER 2026, AND IT CUT THE ANSWER
    // IN HALF. Ruth corrected a meal she had just logged and nothing happened,
    // twice in one comparison run and on both chats. Called directly, four
    // times, two came back as "Unterminated string in JSON at position 1097":
    // the answer is a whole corrected entry with its items, it did not fit, and
    // JSON.parse threw on the truncation. The same mistake is written up eight
    // lines above for the other branch, which was raised from 500 on 9
    // September for exactly this reason. One corrected entry is not smaller
    // than one parsed entry.
    max_tokens: updateLogId ? 2000 : 8000,
    messages: [{ role: 'user', content: instruction }],
  });

  // COUNTED. The Haiku parse is about an eighth of a logging turn, and a cost
  // table that leaves it out is wrong in the same direction every time.
  recordModelUsage({
    userId,
    turnId: sourceTurnId,
    call: 'extraction',
    model: 'claude-haiku-4-5-20251001',
    usage: message.usage,
  });

  // A CUT-OFF ANSWER IS A FAILED CALL, SAID SO. Without this the only sign is
  // whatever JSON.parse happens to complain about, which is how a correction
  // came to fail with "Expected double-quoted property name at position 1093"
  // in a log nobody can read.
  if (message.stop_reason === 'max_tokens') {
    throw new Error(
      `the ${updateLogId ? 'correction' : 'food'} parse ran out of room and came back half-written`
    );
  }

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  if (updateLogId) {
    const macros = JSON.parse(cleaned) as ParsedMacros & { entry_text?: unknown };
    const items: ParsedItem[] = Array.isArray(macros.items) ? macros.items : [];
    const corrected =
      correctionOf && typeof macros.entry_text === 'string' && macros.entry_text.trim()
        ? macros.entry_text.trim()
        : null;
    // NEVER HER WHOLE SENTENCE AS THE NAME (12 October 2026). When the model
    // left entry_text out, the fallback was foodText - which on a correction is
    // everything she said: "Yeah, instead of the other ice cream. It was just two
    // bowls of ice cream with banana and raisins." That became the name of the
    // food on her log page. The foods themselves name it better, and the old
    // name is better than a sentence.
    const named = correctionOf ? corrected ?? namedFromItems(items) ?? correctionOf : corrected ?? foodText;
    // THE LABEL IT ALREADY HAD, unless her correction names a meal. See
    // keptMealLabel: the parse never sees the old label, so left to itself a
    // corrected lunch comes back as breakfast because porridge is breakfast.
    const { data: before } = await supabase
      .from('food_logs')
      .select('meal_label')
      .eq('id', updateLogId)
      .maybeSingle();
    const { data, error } = await supabase
      .from('food_logs')
      .update({
        raw_text: stripDayLabel(named),
        ...buildFoodLogFields(macros),
        meal_label: keptMealLabel(
          (before as { meal_label?: string | null } | null)?.meal_label,
          macros.meal_label,
          foodText
        ),
      })
      .eq('id', updateLogId)
      .select();
    if (error) throw new Error('food_logs update failed: ' + error.message);

    // A CORRECTION THAT MAKES A COPY REMOVES ITS OWN ENTRY (12 October 2026).
    // Catching up her Sunday, "two bowls of ice cream" was logged as a new entry,
    // and then "instead of the other ice cream" corrected the OLD single bowl
    // into two bowls as well - two identical desserts where she had asked for
    // one to replace the other. "Instead of" means the old one goes. So when a
    // corrected entry now says the same as another logged near it, the
    // corrected one is removed and the other stands.
    const updatedRow = (data ?? [])[0] as { happened_at?: string } | undefined;
    const at = updatedRow?.happened_at ? Date.parse(updatedRow.happened_at) : NaN;
    if (Number.isFinite(at)) {
      const span = FOOD_DEDUPE_WINDOW_MIN * 60_000;
      const { data: near } = await supabase
        .from('food_logs')
        .select('*')
        .neq('id', updateLogId)
        .gte('happened_at', new Date(at - span).toISOString())
        .lte('happened_at', new Date(at + span).toISOString());
      const twin = ((near ?? []) as (FoodEntry & { raw_text: string | null })[]).find(
        (r) => sameMeal(r.raw_text ?? '', stripDayLabel(named))?.how === 'same'
      );
      if (twin) {
        await supabase.from('food_items').delete().eq('food_log_id', updateLogId);
        await supabase.from('food_logs').delete().eq('id', updateLogId);
        console.log('FOOD CORRECTION: the corrected entry matched', twin.id, '- removed the corrected copy');
        return [twin];
      }
    }

    await supabase.from('food_items').delete().eq('food_log_id', updateLogId);
    await writeItems(supabase, updateLogId, userId, items);
    return data as FoodEntry[];
  }

  let parsed = JSON.parse(cleaned) as ParsedFoodEntries;

  // SEVERAL THINGS ARE SEVERAL ROWS (Bug 18, 21 September 2026). "Mug of tea
  // and a cookie" was stored as one combined entry, so asking for the split
  // afterwards found nothing to split - "it was lost at storage time".
  //
  // The prompt no longer licenses merging a list. This is the part that does
  // not depend on the prompt: an entry that plainly names two or more things
  // and came back with fewer than two rows contradicts itself, and that is
  // visible in code without knowing anything about food.
  //
  // IT ASKS AGAIN RATHER THAN SPLITTING THE FIGURES ITSELF. Dividing 65 kcal
  // between a herbal tea, a milky tea and a biscuit is a division nobody
  // stated, and inventing it would be worse than the bug. One retry, and a
  // second refusal is stored as it came: a missing breakdown is a gap, a made
  // up one is a false record.
  if (!updateLogId && entriesNeedingSplit(parsed.entries, foodText) > 0) {
    console.log('FOOD: entry named several things but came back merged - asking again');
    try {
      const again = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [{ role: 'user', content: instruction + SPLIT_AGAIN }],
      });
      // ITS OWN ROW, not added to the first. How often the split retry fires
      // and what it costs is a real question, and a summed row cannot answer it.
      recordModelUsage({
        userId,
        turnId: sourceTurnId,
        call: 'extraction',
        model: 'claude-haiku-4-5-20251001',
        usage: again.usage,
      });

      const retryText = again.content[0].type === 'text' ? again.content[0].text : '';
      const retry = JSON.parse(
        retryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      ) as ParsedFoodEntries;
      // Only taken when it is actually better, so a worse second answer cannot
      // replace a usable first one.
      if (
        Array.isArray(retry.entries) &&
        retry.entries.length > 0 &&
        entriesNeedingSplit(retry.entries, foodText) < entriesNeedingSplit(parsed.entries, foodText)
      ) {
        parsed = retry;
      } else {
        console.log('FOOD: second attempt was no better, keeping the first');
      }
    } catch (err) {
      // A failed retry must never cost the log that already parsed.
      console.log('FOOD: re-ask failed, keeping the first answer -', err instanceof Error ? err.message : err);
    }
  }

  const rows = buildFoodRows(parsed, foodText, happenedAt ? new Date(happenedAt) : new Date());
  if (rows.length === 0) return [];

  // IS ANY OF THIS A MEAL ALREADY RECORDED? See lib/food-dedupe.ts for the
  // evening that made this necessary. One read covers the whole batch; RLS
  // scopes it to this person.
  //
  // AROUND THE ENTRY'S OWN TIME, NOT AROUND NOW (2026-10-04).
  //
  // This used to ask for rows whose happened_at was within ten minutes of NOW,
  // which silently meant the duplicate guard could only ever see meals being
  // logged as they were eaten. A catch-up - "I forgot to log yesterday" - is
  // stamped with YESTERDAY's happened_at, so it was never in the candidate list,
  // findSameMeal had nothing to compare against, and a re-log always wrote a
  // second full set of rows. Backdated logging had no duplicate protection at
  // all, and it is one of the things people use this for most.
  //
  // WHAT IT COST. Ruth, 4 October 2026, voice-logging her Saturday: "in the log
  // page itself everything came through twice." Her four meals went in twice,
  // sixteen seconds apart, from two different turns - "Hi, I forgot to log the
  // food yesterday. So I had..." and then "Yeah, that's right. Could you log it,
  // please?". The second was a fair instruction; nothing in the app knew it had
  // already done it. The two sets were not even identical - lunch 264 then 320
  // kcal, dinner 650 then 680 - because each parse estimated separately, so no
  // exact-match guard would have caught them either.
  //
  // findSameMeal ALREADY compares |incoming.happened_at - existing.happened_at|
  // against the window, in both directions, so a catch-up for last Monday still
  // cannot merge with this afternoon. The window logic was right; it was never
  // being given the rows. This only widens what it is allowed to look at.
  const times = rows
    .map((r) => Date.parse(r.happenedAt))
    .filter((t) => Number.isFinite(t));
  const span = FOOD_DEDUPE_WINDOW_MIN * 60_000;
  // The batch can describe several meals at different times; the candidates have
  // to cover all of them, so the range runs from the earliest to the latest.
  const from = times.length > 0 ? Math.min(...times) - span : Date.now() - span;
  const to = times.length > 0 ? Math.max(...times) + span : Date.now() + span;
  const { data: recentData } = await supabase
    .from('food_logs')
    .select('id, raw_text, happened_at')
    .gte('happened_at', new Date(from).toISOString())
    .lte('happened_at', new Date(to).toISOString())
    .order('happened_at', { ascending: false })
    .limit(25);
  const recent = (recentData ?? []) as RecentLog[];

  // THE FOODS INSIDE THOSE ENTRIES, for an entry that restates several of them
  // at once. See restatesEntries in food-dedupe.ts.
  const recentItems: (RecentItems & { happenedAt: string })[] = [];
  if (recent.length > 0 && rows.some((r) => r.items.length >= 2)) {
    const { data: itemData } = await supabase
      .from('food_items')
      .select('food_log_id, name')
      .in(
        'food_log_id',
        recent.map((r) => r.id)
      );
    for (const log of recent) {
      const names = ((itemData ?? []) as { food_log_id: string; name: string | null }[])
        .filter((i) => i.food_log_id === log.id && typeof i.name === 'string')
        .map((i) => i.name as string);
      recentItems.push({ logId: log.id, names: [...names, log.raw_text ?? ''], happenedAt: log.happened_at });
    }
  }

  const claimed = new Set<string>();
  const fresh: typeof rows = [];
  // Rows that rewrite an existing log rather than adding one, and rows that add
  // nothing at all because the meal is already there in fuller words.
  const rewrites: { id: string; row: (typeof rows)[number] }[] = [];
  const untouched: string[] = [];

  for (const row of rows) {
    const match = findSameMeal(row.rawText, row.happenedAt, recent, claimed);
    if (!match) {
      const at = Date.parse(row.happenedAt);
      const near = recentItems.filter(
        (r) => Math.abs(Date.parse(r.happenedAt) - at) <= FOOD_DEDUPE_WINDOW_MIN * 60_000
      );
      const restated = restatesEntries(
        row.items.map((i) => (typeof i.name === 'string' ? i.name : '')),
        near
      );
      if (restated) {
        untouched.push(...restated);
        console.log('FOOD DEDUPE: dropped an entry restating', restated.length, 'meals already recorded');
        continue;
      }
      fresh.push(row);
      continue;
    }
    claimed.add(match.log.id);
    if (match.how === 'longer') {
      rewrites.push({ id: match.log.id, row });
      console.log('FOOD DEDUPE: rewriting', match.log.id, 'with a fuller description of the same meal');
    } else {
      untouched.push(match.log.id);
      console.log('FOOD DEDUPE: dropped a repeat of', match.log.id);
    }
  }

  // The fuller description replaces the earlier one, macros and all, and its
  // breakdown is rebuilt to match. happened_at is left alone: the meal was
  // eaten when it was first described, not when the sentence finished.
  for (const { id, row } of rewrites) {
    const { error: upErr } = await supabase
      .from('food_logs')
      .update({ raw_text: row.rawText, ...row.fields })
      .eq('id', id);
    if (upErr) throw new Error('food_logs update failed: ' + upErr.message);
    await supabase.from('food_items').delete().eq('food_log_id', id);
    await writeItems(supabase, id, userId, row.items);
  }

  // THE MACROS CANNOT WEIGH MORE THAN THE FOOD (23 October 2026).
  //
  // Her "20g bakery sausage roll" came back with 31g of protein, carbs and
  // fat in it. The estimate is internally consistent - the macros match its
  // 180 kcal exactly - so every check comparing calories to macros passed it.
  // It is a correct estimate of the wrong amount of food, and the only thing
  // that gives it away is the arithmetic below.
  //
  // RECORDED, NOT CORRECTED. See food-weight-sanity.ts: replacing a bad
  // figure with a second guess is how an app becomes confidently wrong
  // instead of loudly unsure. The prompt is told the rule as well; this is
  // how we find out whether being told was enough, instead of assuming it.
  for (const row of fresh) {
    const verdict = weightIsPossible(row.rawText, row.fields);
    if (!verdict.ok) {
      recordRouteError({
        userId,
        turnId: sourceTurnId ?? null,
        voice: false,
        label: 'macros outweigh the food',
        detail: {
          text: row.rawText.slice(0, 120),
          statedG: verdict.statedG,
          macroG: verdict.macroG,
          kcal: row.fields.kcal ?? null,
        },
      });
    }
  }
  let inserted: FoodEntry[] = [];
  if (fresh.length > 0) {
    const { data, error } = await supabase
      .from('food_logs')
      .insert(
        fresh.map((row) => ({
          user_id: userId,
          happened_at: row.happenedAt,
          raw_text: row.rawText,
          ...row.fields,
          ...(sourceTurnId ? { source_turn_id: sourceTurnId } : {}),
        }))
      )
      .select();
    if (error) throw new Error('food_logs insert failed: ' + error.message);
    inserted = data as FoodEntry[];
    // Items are written per row, matched by position: the insert preserves the
    // order it was given.
    await Promise.all(
      inserted.map((entry, i) => writeItems(supabase, entry.id, userId, fresh[i].items))
    );

    // THE WATER THAT CAME WITH THE MEAL (2026-09-21). "I logged 1lt of water in
    // food log in typed entry and it didnt show up in the chat text, the table
    // or the hydration log" - because a mixed message is classified as food,
    // and the hydration path only ever ran for a message that was ONLY a drink.
    //
    // Only on FRESH rows. A correction re-parses the same words, and adding the
    // litre again every time she fixed a figure would inflate the day silently,
    // which is the same class of error one layer along.
    await Promise.all(
      inserted.map((_entry, i) =>
        logWaterWithFood(supabase, userId, fresh[i].drinks, fresh[i].happenedAt, fresh[i].rawText)
      )
    );
  }

  // The caller needs the rows this turn is ABOUT, not only the ones it created -
  // a rewritten meal is still the meal that was just described, and the reply
  // and the summary card both hang off what comes back.
  const touched = [...rewrites.map((r) => r.id), ...untouched];
  if (touched.length === 0) return inserted;
  const { data: back } = await supabase.from('food_logs').select('*').in('id', touched);
  return [...inserted, ...((back ?? []) as FoodEntry[])];
}
