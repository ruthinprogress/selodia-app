import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FOOD_DEDUPE_WINDOW_MIN,
  findSameMeal,
  type RecentLog,
} from './food-dedupe';
import {
  FOOD_PARSE_CLASSIFICATION_RULES,
  FOOD_PARSE_OMIT_RATHER_THAN_GUESS,
  FOOD_PARSE_ENTRIES_SCHEMA,
  FOOD_PARSE_JSON_SCHEMA,
  aminoProfile, proteinSource,
  type ParsedEntry,
  type ParsedFoodEntries,
  type ParsedItem,
  type ParsedMacros,
} from './food-parse-prompt';
import { drinksNamedIn, mentionsDrink } from './caloric-drink';
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
export function buildFoodLogFields(macros: ParsedMacros) {
  return {
    meal_label: macros.meal_label,
    kcal: macros.kcal,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    sodium_mg: macros.sodium_mg ?? null,
    // Null, never zero: see FOOD_PARSE_OMIT_RATHER_THAN_GUESS.
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
  const { error } = await supabase.from('food_items').insert(
    items.map((it) => ({
      food_log_id: foodLogId,
      user_id: userId,
      name: String(it.name ?? '').trim() || 'item',
      quantity: it.quantity ?? null,
      kcal: it.kcal ?? null,
      protein_g: it.protein_g ?? null,
      carbs_g: it.carbs_g ?? null,
      fat_g: it.fat_g ?? null,
      sodium_mg: it.sodium_mg ?? null,
      saturated_fat_g: it.saturated_fat_g ?? null,
      sugar_g: it.sugar_g ?? null,
      fibre_g: it.fibre_g ?? null,
      protein_source: proteinSource(it.protein_source),
      amino_profile: aminoProfile(it.amino_profile),
    }))
  );
  if (error) console.log('food_items insert failed (non-fatal):', error.message);
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
    const rawText = text || foodText;

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
        `FOOD: "${rawText}" stated ${check.statedGrams}g but its parts weighed ${Math.round(check.itemGrams)}g - scaled to what she said`
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
      ' For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries.' +
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
      ' For meal_label on each entry, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries.' +
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
    max_tokens: updateLogId ? 500 : 8000,
    messages: [{ role: 'user', content: instruction }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  if (updateLogId) {
    const macros = JSON.parse(cleaned) as ParsedMacros & { entry_text?: unknown };
    const items: ParsedItem[] = Array.isArray(macros.items) ? macros.items : [];
    const corrected =
      correctionOf && typeof macros.entry_text === 'string' && macros.entry_text.trim()
        ? macros.entry_text.trim()
        : null;
    const { data, error } = await supabase
      .from('food_logs')
      .update({ raw_text: corrected ?? foodText, ...buildFoodLogFields(macros) })
      .eq('id', updateLogId)
      .select();
    if (error) throw new Error('food_logs update failed: ' + error.message);
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
  const { data: recentData } = await supabase
    .from('food_logs')
    .select('id, raw_text, happened_at')
    .gte('happened_at', new Date(Date.now() - FOOD_DEDUPE_WINDOW_MIN * 60_000).toISOString())
    .order('happened_at', { ascending: false })
    .limit(25);
  const recent = (recentData ?? []) as RecentLog[];

  const claimed = new Set<string>();
  const fresh: typeof rows = [];
  // Rows that rewrite an existing log rather than adding one, and rows that add
  // nothing at all because the meal is already there in fuller words.
  const rewrites: { id: string; row: (typeof rows)[number] }[] = [];
  const untouched: string[] = [];

  for (const row of rows) {
    const match = findSameMeal(row.rawText, row.happenedAt, recent, claimed);
    if (!match) {
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
