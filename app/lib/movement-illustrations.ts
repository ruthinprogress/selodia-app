import type { SupabaseClient } from '@supabase/supabase-js';

// FINDING THE PICTURE FOR A MOVEMENT.
//
// This is the twin of movement-demos.ts, and deliberately so. That one resolves a
// movement name to a vendor clip; this one resolves it to an illustration Selodia drew.
// Both defer the matching to SQL - resolve_movement_refs and resolve_illustration_refs -
// so a name can never mean one thing at save time and another at render time.
//
// THE SAME RULE, FOR THE SAME REASON. An exact name or an exact word set, and nothing
// weaker. A subset rule was measured when the clip matcher was built and rejected: it
// matched "kettlebell romanian deadlifts" to the single-leg variant, and a third of the
// extra matches were a different movement under a different load. A missing picture is a
// small disappointment; a confidently wrong one is a form fault, and a picture is a more
// confident claim than a line of text.
//
// WHAT THE CARD DOES WITH THIS, in order:
//   1. a clip, if the library has one - it moves, and moving beats still
//   2. an illustration, if we drew one
//   3. the recipe card alone - needs, steps, feel, avoid
// Each rung is a worse answer than the one above and a far better answer than nothing,
// which is what the movement card used to show.

export type IllustrationRef = {
  joinKey: string;
  title: string;
  /** Null until an animation has been made from this illustration's two frames. */
  hasAnimation: boolean;
  /** Null for a movement that belongs to no progression. */
  progression: string | null;
  stage: number | null;
};

/**
 * Resolve many names at once. Keyed by the ORIGINAL name as given, so a caller can write
 * the result straight back onto the exercise it came from. A name with no illustration is
 * ABSENT from the map rather than mapped to null - absence means "we have not drawn this
 * one", which is an ordinary outcome and will stay the common one until the library grows.
 */
export async function resolveIllustrationRefs(
  supabase: SupabaseClient,
  names: string[]
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const wanted = names.filter((n) => n && n.trim().length > 0);
  if (wanted.length === 0) return resolved;

  const { data, error } = await supabase.rpc('resolve_illustration_refs', { names: wanted });
  if (error) {
    // A card that shows the recipe instead of a picture is still a usable card, so this
    // is logged and swallowed rather than failing the screen.
    console.log('MOVEMENT-ILLUSTRATIONS: resolve failed —', error.message);
    return resolved;
  }

  for (const row of (data ?? []) as { input_name: string; join_key: string | null }[]) {
    if (row.join_key) resolved.set(row.input_name, row.join_key);
  }
  return resolved;
}

/** One name. Returns the join_key, or null when nothing has been drawn for it. */
export async function resolveIllustrationRef(
  supabase: SupabaseClient,
  name: string
): Promise<string | null> {
  const found = await resolveIllustrationRefs(supabase, [name]);
  return found.get(name) ?? null;
}

/**
 * Every stage of a progression, in order.
 *
 * This is the whole reason progression and stage are columns rather than a naming
 * convention. Ruth, 16 October 2026: "I want to be able to present a beautiful 'set
 * progression', especially since they lend well to stills." A set is the feature; a
 * single picture is the fallback.
 */
export async function progressionStages(
  supabase: SupabaseClient,
  progression: string
): Promise<IllustrationRef[]> {
  const { data, error } = await supabase
    .from('movement_illustrations')
    .select('join_key, title, progression, stage, animation_path')
    .eq('progression', progression)
    .order('stage', { ascending: true });

  if (error) {
    console.log('MOVEMENT-ILLUSTRATIONS: progression lookup failed —', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    joinKey: row.join_key as string,
    title: row.title as string,
    hasAnimation: Boolean(row.animation_path),
    progression: row.progression as string | null,
    stage: row.stage as number | null,
  }));
}
