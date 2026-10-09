// A SYMPTOM LANDS ON A DAY, WHATEVER ROUTE IT CAME IN BY.
//
// Ruth, 9 October 2026, settling how symptoms work: "A symptom is just a
// symptom. So if a symptom is logged in chat it will not necessarily be
// interpreted as a cycle symptom. But it is attached to a day, so all days need
// to be reviewed for patterns when a symptom is reported. otherwise the user is
// magically having to figure out which symptoms to log as cycle symptoms and
// which are noncycle symptoms."
//
// WHAT WAS WRONG BEFORE. Chat could only offer a symptom as an ALMANAC entry,
// and almanac_entries has no date and no day. So "I've had cramps for two days"
// was stored somewhere that could never answer "has this happened at this point
// before" - which is the one question the cycle screens exist to answer. The
// Cycle screen's own tick-boxes wrote to a different table entirely. Two stores,
// neither aware of the other.
//
// Now every symptom reaches daily_observations, keyed on the day. The Almanac
// entry stays what it always was: the INDEX of things she is dealing with,
// offered when something is new or has clearly changed. Days are the evidence;
// the Almanac is the list of what is being evidenced. She chooses nothing.
//
// MERGED, NEVER OVERWRITTEN. She may have ticked two symptoms on the Cycle
// screen this morning and said a third out loud this afternoon. A write that
// replaced the array would silently delete the morning's, and she would have no
// way of knowing - the kind of loss that is only discovered weeks later when a
// pattern is wrong.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Local calendar day, which is what daily_observations is keyed on. */
export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Tidy one symptom for storage.
 *
 * Trimmed and collapsed, nothing else. NOT lowercased and NOT mapped to a
 * vocabulary: the picker's chips are a shortcut, never the vocabulary, and
 * "that dragging feeling low down" is exactly the kind of thing the app exists
 * to keep in her words rather than squeeze into "cramps".
 */
export function tidySymptom(raw: unknown): string | null {
  const v = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!v) return null;
  // A sentence is a note, not a symptom. 80 characters is generous for "lower
  // back ache, worse sitting" and short of a paragraph.
  return v.length > 80 ? v.slice(0, 80).trim() : v;
}

/** Case-insensitive, so "Cramps" from the picker and "cramps" said aloud are one. */
function alreadyThere(existing: readonly string[], one: string): boolean {
  const k = one.toLowerCase();
  return existing.some((e) => e.toLowerCase() === k);
}

export type SymptomWrite = {
  day: string;
  added: string[];
  /** Everything on the day afterwards, hers to be shown back. */
  all: string[];
};

/**
 * Add symptoms to a day, keeping whatever is already there.
 *
 * Returns what was actually added, which may be nothing when she repeats
 * herself - and repeating herself is the normal case, because a slow turn gets
 * re-sent and because people say the same thing twice. The caller turns `added`
 * into what she is told, so an empty one means "already down" rather than
 * "failed".
 */
export async function addSymptomsToDay(
  supabase: SupabaseClient,
  userId: string,
  symptoms: readonly unknown[],
  day: string = localDayKey()
): Promise<SymptomWrite | null> {
  const wanted = symptoms
    .map(tidySymptom)
    .filter((s): s is string => s !== null);
  if (wanted.length === 0) return null;

  const { data: existingRow, error: readError } = await supabase
    .from('daily_observations')
    .select('symptoms')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();

  if (readError) {
    // FAILS LOUD TO THE CALLER, not silently to an empty array. Reading
    // nothing and then writing would wipe the day, which is the one outcome
    // worse than not recording the symptom at all.
    console.log('DAY OBSERVATIONS read failed:', readError.message);
    return null;
  }

  const existing = ((existingRow?.symptoms as string[] | null) ?? []).filter(
    (s) => typeof s === 'string' && s.trim()
  );

  const added: string[] = [];
  const all = [...existing];
  for (const one of wanted) {
    if (alreadyThere(all, one)) continue;
    all.push(one);
    added.push(one);
  }

  if (added.length === 0) return { day, added: [], all };

  const { error: writeError } = await supabase
    .from('daily_observations')
    .upsert({ user_id: userId, day, symptoms: all }, { onConflict: 'user_id,day' });

  if (writeError) {
    console.log('DAY OBSERVATIONS write failed:', writeError.message);
    return null;
  }
  return { day, added, all };
}

/**
 * Every day she has recorded a symptom on, newest first.
 *
 * The raw material for the lookback. Deliberately returns ALL of them rather
 * than filtering by cycle: whether a day is interesting is a question about
 * cycle position, and that is decided in cycle-position.ts against her period
 * history, not here against a table name.
 */
export async function symptomDays(
  supabase: SupabaseClient,
  userId: string,
  limit = 400
): Promise<{ day: string; symptoms: string[] }[]> {
  const { data, error } = await supabase
    .from('daily_observations')
    .select('day, symptoms')
    .eq('user_id', userId)
    .order('day', { ascending: false })
    .limit(limit);

  if (error) {
    console.log('DAY OBSERVATIONS list failed:', error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => ({
      day: String((r as { day: unknown }).day),
      symptoms: (((r as { symptoms: unknown }).symptoms as string[] | null) ?? []).filter(
        (s) => typeof s === 'string' && s.trim()
      ),
    }))
    .filter((r) => r.symptoms.length > 0);
}
