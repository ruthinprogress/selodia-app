import type { SupabaseClient } from '@supabase/supabase-js';

// ONE SPOKEN SENTENCE, ONE SET OF FOOD ROWS (2026-09-19).
//
// ElevenLabs sends a turn when it thinks she has finished, then sends it again,
// longer, if she carries on - "For breakfast I had..." then "...and blackcurrant
// jam" then "...and then for lunch...". Each version runs the pipeline, and
// until 19 September the only thing stopping each one logging was a line in the
// prompt. That day one day's food, spoken once, went in as five rows: breakfast
// twice (407 and 463 kcal) and the mango three times. Each version was parsed
// and WORDED differently by the model, so the meal dedupe had nothing stable to
// match - which is why this guard works from the turns, not from the text.
//
// THE FIRST VERSION OF THIS GUARD COULD DELETE FOOD SHE ATE, and was replaced
// the same day after review. It cleared every food row created since the
// earlier turn, from any source, and it cleared BEFORE the new parse had
// saved. A typed or photographed meal in the same half minute would have gone
// with it, a short separate turn ("oh, and jam") would have wiped the toast it
// followed, and a failed parse would have left nothing at all.
//
// WHAT IT DOES NOW. Every food row a voice turn writes carries that turn
// (food_logs.source_turn_id). After a turn has saved its own rows:
//   - rows from EARLIER turns that this sentence continues are removed - and
//     only rows carrying one of those turns, never anything else;
//   - if a LATER turn that continues this one has already saved, this turn's
//     own new rows are removed instead.
// Whichever of the two finishes second does the removing, so the pair ends
// with one set of rows whatever order the parses land in, and if the later
// turn fails outright, the earlier turn's rows are still there.

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

type Turn = { id: string; content: string | null; created_at: string };

/**
 * After a voice turn has saved its food, leave the sentence with one set of
 * rows. `ownIds` are the rows this turn's parse returned - which can include
 * rows it rewrote or matched rather than created, so nothing is deleted on the
 * strength of being in that list alone: every delete also requires the row to
 * carry the turn it is being removed for.
 */
export async function settleVoiceSentence(
  supabase: SupabaseClient,
  turnId: string,
  message: string,
  ownIds: string[]
): Promise<void> {
  const { data: own } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('id', turnId)
    .maybeSingle();
  if (!own?.created_at) return;
  const at = Date.parse(own.created_at);
  const { data: around } = await supabase
    .from('chat_messages')
    .select('id, content, created_at')
    .eq('role', 'user')
    .neq('id', turnId)
    .gte('created_at', new Date(at - SUPERSEDE_WINDOW_MS).toISOString())
    .lte('created_at', new Date(at + SUPERSEDE_WINDOW_MS).toISOString());
  const turns = (around ?? []) as Turn[];

  const earlier = turns
    .filter((t) => Date.parse(t.created_at) < at && typeof t.content === 'string' && continues(t.content, message))
    .map((t) => t.id);
  const later = turns
    .filter((t) => Date.parse(t.created_at) > at && typeof t.content === 'string' && continues(message, t.content))
    .map((t) => t.id);

  // A later, fuller version has already saved: this turn's rows are the
  // partial copy, and they go.
  if (later.length > 0) {
    const { count } = await supabase
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .in('source_turn_id', later);
    if ((count ?? 0) > 0) {
      if (ownIds.length > 0) await removeRows(supabase, ownIds, [turnId]);
      console.log("VOICE SUPERSEDE: a fuller version already saved; removed this turn's rows");
      return;
    }
  }

  // Rows from earlier, shorter versions of this sentence go - never one this
  // turn has just returned, which may be a row it rewrote in place.
  if (earlier.length > 0) {
    const { data: stale } = await supabase
      .from('food_logs')
      .select('id')
      .in('source_turn_id', earlier);
    const ids = (stale ?? []).map((r) => r.id as string).filter((id) => !ownIds.includes(id));
    if (ids.length > 0) {
      await removeRows(supabase, ids, earlier);
      console.log('VOICE SUPERSEDE: removed', ids.length, 'rows from earlier versions of the sentence');
    }
  }
}

async function removeRows(supabase: SupabaseClient, ids: string[], fromTurns: string[]) {
  // The turn condition is checked again here, so a row is only ever removed
  // if it genuinely came from one of those turns.
  const { data: doomed } = await supabase
    .from('food_logs')
    .select('id')
    .in('id', ids)
    .in('source_turn_id', fromTurns);
  const confirmed = (doomed ?? []).map((r) => r.id as string);
  if (confirmed.length === 0) return;
  await supabase.from('food_items').delete().in('food_log_id', confirmed);
  const { error } = await supabase.from('food_logs').delete().in('id', confirmed);
  if (error) console.log('VOICE SUPERSEDE: removal failed -', error.message);
}

// TWO COPIES OF ONE TURN, AT THE SAME MOMENT (2026-09-19). "The chocolate
// caramel was just one tiny caramel the size of a Malteser" arrived twice in
// the same second. The adapter's replay check reads the thread BEFORE the
// pipeline writes the turn, so two requests that land together each see an
// empty thread and both run: one corrected the entry, the other logged the
// whole snack again as new. Checked in the pipeline instead, AFTER this turn is
// written, for voice only - a typed retry of a message that failed is a real
// second attempt and must run.

/** How close together two identical turns must be to count as one. */
const TWIN_WINDOW_MS = 15_000;
/** How long after the first copy was said its answer is still worth waiting for. */
const TWIN_ANSWER_WITHIN_MS = 25_000;

/**
 * The earlier copy of this exact turn, when this one is the later copy and no
 * answer was written between them. Null when this turn is the first, or only.
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
  // answer, "Yes." again - are two turns.
  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'assistant')
    .gt('created_at', first.created_at)
    .lt('created_at', own.created_at);
  if ((count ?? 0) > 0) return null;
  return { id: first.id as string, created_at: String(first.created_at) };
}

/**
 * The answer written after the first copy, if it arrives while still worth
 * waiting for. Null when the first copy evidently failed - the caller then runs
 * this turn itself rather than speaking an error.
 */
export async function answerWrittenAfter(
  supabase: SupabaseClient,
  since: string
): Promise<string | null> {
  const deadline = Date.parse(since) + TWIN_ANSWER_WITHIN_MS;
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
