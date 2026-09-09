import type { SupabaseClient } from '@supabase/supabase-js';

// Resolving a plan's exercises to their demonstration clips (item 36).
//
// WHY THIS RUNS AT SAVE TIME AND NOT AT RENDER TIME. Two reasons, and the second
// is the real one. It saves a lookup per opened exercise, which is minor. And it
// tells the pipeline, at the moment a plan is written, which movements have no
// demonstration - which is what item 46 needs in order to talk about a gap
// instead of leaving a blank where a video should be.
//
// MATCHING IS EXACT, AND THAT IS A SAFETY DECISION, NOT LAZINESS.
//
// Measured against the six exercise names in real saved plans on 2026-09-09, the
// nearest library entries were:
//   "frog stretch"       -> nearest is "frog jumps", a plyometric
//   "romanian deadlift"  -> nearest are landmine and kettlebell single-leg
//   "wide-leg forward fold" -> nearest is "seated forward bend"
//   "butterfly stretch", "side lunge stretch", "wall-supported middle split
//   slide" -> nothing within reach at all
//
// Every one of those near-misses is a DIFFERENT MOVEMENT. Fuzzy matching would
// have shown somebody a jump when they asked for a stretch, or a single-leg
// kettlebell hinge when they asked for a barbell one. Part Ten already forbids
// repointing safety copy at a different implement or stance; showing a different
// animation is the same error with a bigger picture attached. A missing demo is
// a small disappointment. A confidently wrong demo is a form fault.
//
// So: an exercise gets a clip when the names agree exactly, and otherwise gets
// nothing, and the gap is handled in conversation (item 46).

// The manifest's join_key is lowercase, single-spaced. Model-authored names
// arrive title-cased and occasionally double-spaced, so both ends normalise the
// same way. Nothing else is stripped - removing punctuation or a trailing
// "stretch" is where exact matching quietly stops being exact.
export function toJoinKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Look up demo references for a set of exercise names.
 *
 * Returns a Map keyed by the ORIGINAL name as given, so callers can write the
 * result straight back onto the exercise they took it from. A name with no clip
 * is absent from the map rather than mapped to null - callers should treat
 * absence as "no demonstration", which is an ordinary outcome.
 */
export async function resolveDemoRefs(
  supabase: SupabaseClient,
  names: string[]
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (names.length === 0) return resolved;

  // Several exercises in one plan can normalise to the same key; ask once.
  const byKey = new Map<string, string[]>();
  for (const name of names) {
    const key = toJoinKey(name);
    if (!key) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(name);
    else byKey.set(key, [name]);
  }

  const { data, error } = await supabase
    .from('movement_assets')
    .select('join_key')
    .in('join_key', [...byKey.keys()]);

  if (error) {
    // A plan saving without demo references is a plan that still works - the
    // player falls back to looking the name up when it renders. Losing the whole
    // save because a nice-to-have lookup failed would be the worse trade.
    console.log('MOVEMENT DEMOS: resolve failed, saving without refs:', error.message);
    return resolved;
  }

  for (const row of data ?? []) {
    for (const original of byKey.get(row.join_key) ?? []) {
      resolved.set(original, row.join_key);
    }
  }
  return resolved;
}
