import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FOOD_DEDUPE_WINDOW_MIN,
  findSameMeal,
  type RecentLog,
} from './food-dedupe';
import {
  FOOD_PARSE_CLASSIFICATION_RULES,
  FOOD_PARSE_ENTRIES_SCHEMA,
  FOOD_PARSE_JSON_SCHEMA,
  aminoProfile, proteinSource,
  type ParsedEntry,
  type ParsedFoodEntries,
  type ParsedItem,
  type ParsedMacros,
} from './food-parse-prompt';

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
  return entries.filter(hasFood).map((entry) => {
    const date =
      typeof entry.detected_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.detected_date)
        ? entry.detected_date
        : null;
    const text = typeof entry.entry_text === 'string' ? entry.entry_text.trim() : '';
    return {
      happenedAt: date ? `${date}T${timeOfDay}Z` : now.toISOString(),
      // The entry's own words when the model separated them out, so a row in a
      // seven-day catch-up reads as that day's meal rather than as the whole
      // message repeated seven times.
      rawText: text || foodText,
      items: Array.isArray(entry.items) ? entry.items : [],
      fields: buildFoodLogFields(entry),
    };
  });
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
  updateLogId?: string
): Promise<FoodEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  const instruction = updateLogId
    ? 'Estimate the macros for this food entry, plus its sodium in milligrams (sodium_mg). Respond ONLY with valid JSON, no other text, in this exact format: ' +
      FOOD_PARSE_JSON_SCHEMA +
      ' ' +
      FOOD_PARSE_CLASSIFICATION_RULES +
      ' For meal_label, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. Food entry: "' +
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
      ' For meal_label on each entry, infer a short label based on context (e.g. "Breakfast", "Lunch", "Dinner", "Snack") using time-of-day clues if mentioned, or the food type if not. Keep it short - 1-3 words, not a repeat of the food entry itself. Set confidence to "clear" for typed text entries. What they said: "' +
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
    const macros = JSON.parse(cleaned) as ParsedMacros;
    const items: ParsedItem[] = Array.isArray(macros.items) ? macros.items : [];
    const { data, error } = await supabase
      .from('food_logs')
      .update({ raw_text: foodText, ...buildFoodLogFields(macros) })
      .eq('id', updateLogId)
      .select();
    if (error) throw new Error('food_logs update failed: ' + error.message);
    await supabase.from('food_items').delete().eq('food_log_id', updateLogId);
    await writeItems(supabase, updateLogId, userId, items);
    return data as FoodEntry[];
  }

  const parsed = JSON.parse(cleaned) as ParsedFoodEntries;
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
  }

  // The caller needs the rows this turn is ABOUT, not only the ones it created -
  // a rewritten meal is still the meal that was just described, and the reply
  // and the summary card both hang off what comes back.
  const touched = [...rewrites.map((r) => r.id), ...untouched];
  if (touched.length === 0) return inserted;
  const { data: back } = await supabase.from('food_logs').select('*').in('id', touched);
  return [...inserted, ...((back ?? []) as FoodEntry[])];
}
