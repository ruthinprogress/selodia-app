import type { SupabaseClient } from '@supabase/supabase-js';

// Resolving a plan's exercises to their demonstration clips (item 36).
//
// WHY THIS RUNS AT SAVE TIME AND NOT AT RENDER TIME. Two reasons, and the second
// is the real one. It saves a lookup per opened exercise, which is minor. And it
// tells the pipeline, at the moment a plan is written, which movements have no
// demonstration - which is what item 46 needs in order to talk about a gap
// instead of leaving a blank where a video should be.
//
// THE MATCHING ITSELF LIVES IN SQL, in public.resolve_movement_refs. Both this
// and /api/movement-demo need it, and a second implementation here would be two
// algorithms obliged to agree forever - the day they stopped, a plan would save a
// ref the route could not then find. See that function for what it will and will
// not match.
//
// WHAT IT WILL NOT MATCH, AND WHY THAT IS THE POINT.
//
// Two names match on an exact name or an exact word set, and on nothing weaker.
// Word-set matching is not fuzzy matching: the vendor writes "glute bridge
// bodyweight" and a model writes "bodyweight glute bridge", the same words in a
// different order, so no word is added, dropped or approximated. It was verified
// collision-free across all 770 clips before it was built.
//
// A SUBSET RULE WAS MEASURED AND REJECTED. Matching when the plan's words merely
// appear in a clip's name looks better on a coverage count and is wrong. On real
// plan names it matched "kettlebell romanian deadlifts" to the SINGLE-LEG variant
// and "dead bug" to a resistance-band one. Both were the only candidate, so a
// uniqueness guard would have accepted both - uniqueness is not correctness, it
// only means the library happens to hold one clip containing those words. A third
// of the matches that rule added were a different movement under a different load.
//
// Part Ten forbids repointing safety copy at a different implement or stance. The
// same rule governs the animation, and with a bigger picture attached: a missing
// demo is a small disappointment, a confidently wrong one is a form fault. So
// "glute bridge" with twenty-four candidates resolves to nothing, deliberately,
// and coverage improves by adding assets or curating aliases - never by loosening
// this until something plausible appears.

/**
 * Look up demo references for a set of exercise names.
 *
 * Returns a Map keyed by the ORIGINAL name as given, so callers can write the
 * result straight back onto the exercise they took it from. A name with no clip
 * is absent from the map rather than mapped to null - callers should treat
 * absence as "no demonstration", which is an ordinary outcome and will be the
 * common one for mobility work.
 */
export async function resolveDemoRefs(
  supabase: SupabaseClient,
  names: string[]
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const wanted = names.filter((n) => n && n.trim().length > 0);
  if (wanted.length === 0) return resolved;

  const { data, error } = await supabase.rpc('resolve_movement_refs', { names: wanted });

  if (error) {
    // A plan saving without demo references is a plan that still works - the
    // player falls back to resolving by name when it renders. Losing somebody's
    // whole programme because a nice-to-have lookup failed is the worse trade.
    console.log('MOVEMENT DEMOS: resolve failed, saving without refs:', error.message);
    return resolved;
  }

  for (const row of (data ?? []) as { input_name: string; join_key: string | null }[]) {
    if (row.join_key) resolved.set(row.input_name, row.join_key);
  }
  return resolved;
}

/**
 * The single-name case, for the serving route. Same rules, same SQL.
 */
export async function resolveDemoRef(
  supabase: SupabaseClient,
  name: string
): Promise<string | null> {
  const refs = await resolveDemoRefs(supabase, [name]);
  return refs.get(name) ?? null;
}
