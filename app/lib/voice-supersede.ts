import type { SupabaseClient } from '@supabase/supabase-js';

// ONE SPOKEN SENTENCE, ONE SET OF FOOD ROWS (2026-09-19).
//
// ElevenLabs sends a turn when it thinks she has finished, then sends it again,
// longer, if she carries on - "For breakfast I had..." then "...and blackcurrant
// jam" then "...and then for lunch...". The adapter (app/v1/chat/completions)
// already spots this and tells the pipeline, and until today the only thing
// stopping a second log was a line in the prompt asking the model not to.
//
// It did not hold. On 19 September one day's food, spoken once, went in as five
// rows: breakfast twice (407 and 463 kcal), and the mango three times - on its
// own twice and inside lunch once. Each version of the sentence was parsed
// separately and worded differently, so the meal dedupe could not match them.
//
// So the guard moves to the write, from both ends:
//   - THE LATER TURN clears what the earlier versions of the sentence logged,
//     then logs the whole sentence once. It holds everything they held.
//   - AN EARLIER TURN whose parse finishes after she has already carried on
//     writes nothing, because the later turn will log all of it. Voice parses
//     run after the reply is sent, so this is the usual order, not an edge.

/** How far apart two versions of one sentence can arrive. Matches the adapter. */
export const SUPERSEDE_WINDOW_MS = 30_000;
/** How many opening words must match for a longer sentence to be the same one. */
const OPENING_WORDS = 8;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 0);
}

/**
 * Is `later` the same sentence as `earlier`, carried on? It must be longer and
 * open with the same words. Pure: scripts/probe-voice-supersede.mjs.
 *
 * The opening, not the whole: the transcriber revises the END of a sentence as
 * more audio arrives ("peanut butter and- You broke it." became "peanut butter
 * and, um, black currant jam"), but the start it has already settled.
 */
export function continues(earlier: string, later: string): boolean {
  const a = words(earlier);
  const b = words(later);
  if (a.length === 0 || b.length <= a.length) return false;
  const n = Math.min(OPENING_WORDS, a.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Has she carried on talking since this turn was said? True when a newer user
 * turn, inside the window, continues this one - in which case that turn logs
 * everything and this one must not.
 */
export async function carriedOnSince(
  supabase: SupabaseClient,
  userRowId: string | null,
  message: string
): Promise<boolean> {
  if (!userRowId) return false;
  const { data: own } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('id', userRowId)
    .maybeSingle();
  if (!own?.created_at) return false;
  const until = new Date(Date.parse(own.created_at) + SUPERSEDE_WINDOW_MS).toISOString();
  const { data: newer } = await supabase
    .from('chat_messages')
    .select('content')
    .eq('role', 'user')
    .gt('created_at', own.created_at)
    .lte('created_at', until)
    .order('created_at', { ascending: false })
    .limit(5);
  return (newer ?? []).some((m) => typeof m.content === 'string' && continues(message, m.content));
}

/** Remove the food the earlier versions of this sentence logged. Returns how many. */
export async function clearSupersededFood(
  supabase: SupabaseClient,
  userId: string,
  since: string
): Promise<number> {
  const { data: rows } = await supabase
    .from('food_logs')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', since);
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;
  // Items first, as every other delete of a food log in this codebase does,
  // though the foreign key would cascade them anyway.
  await supabase.from('food_items').delete().in('food_log_id', ids);
  const { error } = await supabase.from('food_logs').delete().in('id', ids);
  if (error) {
    console.log('VOICE SUPERSEDE: clearing earlier food failed -', error.message);
    return 0;
  }
  return ids.length;
}

// TWO COPIES OF ONE TURN, AT THE SAME MOMENT (2026-09-19). "The chocolate
// caramel was just one tiny caramel the size of a Malteser" arrived twice in
// the same second. The adapter's replay check reads the thread BEFORE the
// pipeline writes the turn, so two requests that land together each see an
// empty thread and both run: one corrected the entry, the other logged the
// whole snack again as new. Checked here instead, AFTER this turn is written:
// both copies are then in the table, whichever order they arrived, and exactly
// one of them is first.

/** How close together two identical turns must be to count as one. */
const TWIN_WINDOW_MS = 15_000;

/**
 * The earlier copy of this exact turn, when this one is the later copy.
 * Null when this turn is the first (or only) one.
 */
export async function earlierTwin(
  supabase: SupabaseClient,
  userRowId: string | null,
  message: string
): Promise<{ id: string; created_at: string } | null> {
  if (!userRowId) return null;
  const { data } = await supabase
    .from('chat_messages')
    .select('id, created_at')
    .eq('role', 'user')
    .eq('content', message)
    .gte('created_at', new Date(Date.now() - TWIN_WINDOW_MS).toISOString())
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(10);
  const rows = data ?? [];
  const first = rows[0];
  const own = rows.find((r) => r.id === userRowId);
  if (!first || !own || first.id === userRowId) return null;
  // The same words said again ON PURPOSE - "Yes." and, after hearing the
  // answer, "Yes." again - are two turns. Only a copy with no answer written
  // between the two is the same turn.
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'assistant')
    .gt('created_at', first.created_at)
    .lt('created_at', own.created_at);
  if ((count ?? 0) > 0) return null;
  return { id: first.id as string, created_at: String(first.created_at) };
}

/** The answer the first copy wrote, once it exists. */
export async function answerWrittenAfter(
  supabase: SupabaseClient,
  since: string,
  waitMs = 20_000
): Promise<string | null> {
  const deadline = Date.now() + waitMs;
  do {
    const { data } = await supabase
      .from('chat_messages')
      .select('content')
      .eq('role', 'assistant')
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1);
    const text = data?.[0]?.content;
    if (typeof text === 'string' && text.trim()) return text.trim();
    await new Promise((resolve) => setTimeout(resolve, 750));
  } while (Date.now() < deadline);
  return null;
}
