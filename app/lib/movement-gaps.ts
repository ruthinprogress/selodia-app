import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveIllustrationRefs } from './movement-illustrations';

// WHAT THE LIBRARY DID NOT HAVE, RECORDED WHERE IT BECOMES KNOWN.
//
// Ruth, 18 October 2026, setting the shape of this: "create a system where the
// ai knows whats there and chooses from animation or illustrations that exsist
// to cover the user goal. If there is genuinely something thats missing to
// achieve the user goal, they can do the text-only route - but only then. When
// an excersise is genuinely required but wasnt there, it needs to be recorded
// as 'to be built/illustrated' and this creates the list of what's needed over
// time."
//
// The last sentence is the valuable one. A library built from guesses about
// what people might want is a library that covers what somebody imagined; a
// library built from what was actually asked for and missing covers what people
// came for. The to-do list writes itself, and sorts itself by how often each
// thing is wanted.
//
// WHY NOT THE SWEEP SCRIPT WE ALREADY HAVE. scope-illustration-gaps.mjs reads
// every saved plan and reports what is missing, which is the same answer - but
// only when somebody runs it, and it weighs a movement asked for once the same
// as one asked for weekly. This runs on every save and counts.
//
// A CLIP COUNTS, AND SO DOES A DRAWING. The caller has already resolved the
// clip; this checks the illustration library too, because a movement with a
// drawing is covered and must not be put on the list of things to draw.

/**
 * Record the movements in a saved plan that have neither a clip nor a drawing.
 *
 * BEST EFFORT, LIKE THE DEMO LOOKUP IT FOLLOWS. Everything here is a
 * nice-to-have for us and nothing here is the person's data, so a failure is
 * swallowed: nobody loses their programme because a to-do list could not be
 * written. That is also why it is awaited rather than fired and forgotten - the
 * request is about to end, and an un-awaited promise on a serverless function
 * is a write that sometimes happens.
 */
export async function recordMovementGaps(
  supabase: SupabaseClient,
  /** The names with no demoRef - already known to have no clip. */
  namesWithoutClips: string[],
  planTitle: string | null,
  /**
   * Who asked, so they can be thanked when it is made.
   *
   * movement_gaps itself deliberately has no user column - one row per
   * movement, counted across every account, so the ordering is real demand
   * rather than one person's habits. This goes to a separate table that records
   * one row per person per movement, which is what makes "your request is in
   * the app" possible without making the count personal.
   */
  userId?: string | null
): Promise<void> {
  const names = [...new Set(namesWithoutClips.map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return;

  try {
    // A movement we have DRAWN is covered. Only what has neither is a gap.
    const drawn = await resolveIllustrationRefs(supabase, names);
    const missing = names.filter((n) => !drawn.get(n));
    if (missing.length === 0) return;

    await Promise.all(
      missing.map((name) =>
        supabase.rpc('record_movement_gap', {
          movement_name: name,
          plan_title: planTitle,
          asked_by: userId ?? null,
        })
      )
    );
  } catch {
    // Deliberately silent. See above.
  }
}
