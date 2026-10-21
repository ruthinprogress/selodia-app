import type { SupabaseClient } from '@supabase/supabase-js';

import type { MovementEntry } from './movement-search';

// THE LIBRARY ITSELF, READ ONCE AND KEPT.
//
// 950 filmed movements and 21 drawn ones, as join keys and body areas. About
// 28KB in memory, read on the first turn a server instance handles and then
// held - so the common case costs nothing, and a cold instance costs one small
// query that runs beside work the turn was doing anyway.
//
// WHY NOT JUST QUERY PER SEARCH. The matching is word-set based: "hip hinge"
// has to be compared against every name, because the library's name for it is
// "barbell romanian deadlift" and no SQL LIKE would ever find that. So the
// whole list is needed, and fetching it repeatedly would be the same bytes
// every time.
//
// AND THE CACHE IS WHY THIS GROWS PROPERLY. Ruth, 21 October 2026: "we grow the
// database of illustrations and videos over time." An upload is visible to the
// next cold instance within minutes and to every instance within the hour,
// with no regenerated constant, no commit and no deploy. That is the whole
// point of moving it out of the prompt.

// PAGED, BECAUSE THE LIBRARY IS 924 ROWS AND THE CEILING IS 1000.
//
// check-row-ceiling caught this the day it was written: a plain select on
// movement_assets returns at most 1000 rows and says nothing about the ones it
// left behind. At 924 it works perfectly, and at 1001 a movement simply stops
// being findable with no error anywhere.
//
// That is not a hypothetical here. Ruth, 21 October 2026, on why this became a
// tool at all: "we grow the database of illustrations and videos over time."
// The whole point of the change is that this number goes up.
const PAGE = 1000;

async function readAll(
  db: SupabaseClient,
  table: string,
  columns: string
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

let cached: { at: number; entries: MovementEntry[] } | null = null;

// An hour. Long enough that a busy instance reads it once a day's worth of
// turns, short enough that an upload appears without a deploy.
const TTL_MS = 60 * 60 * 1000;

/** Forget the cache. For checks, and for a script that has just uploaded. */
export function forgetMovementLibrary(): void {
  cached = null;
}

/**
 * Every movement the app can demonstrate, filmed or drawn.
 *
 * RETURNS AN EMPTY LIST RATHER THAN THROWING. A library that cannot be read is
 * a turn with no demonstrations in it, which is an ordinary outcome the prompt
 * already describes - "a plan with nothing from this list is a perfectly
 * ordinary plan". It is never a reason to fail somebody's message.
 */
export async function movementLibrary(db: SupabaseClient): Promise<MovementEntry[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.entries;

  try {
    const [films, drawings] = await Promise.all([
      readAll(db, 'movement_assets', 'join_key, muscle_group'),
      readAll(db, 'movement_illustrations', 'join_key'),
    ]);

    const drawn = new Set(drawings.map((r) => String(r.join_key)));
    const entries: MovementEntry[] = films.map((r) => ({
      joinKey: String(r.join_key),
      muscleGroup: String(r.muscle_group ?? 'Other'),
      drawn: drawn.has(String(r.join_key)),
    }));

    // A DRAWING THAT NOBODY FILMED IS STILL A DEMONSTRATION, and most of them
    // are exactly that - the library was drawn to fill the gaps the films left.
    // Without this the handstand ladder and the splits progressions would be
    // unfindable, which is the opposite of why they were drawn.
    for (const key of drawn) {
      if (!entries.some((e) => e.joinKey === key)) {
        entries.push({ joinKey: key, muscleGroup: 'Drawn', drawn: true });
      }
    }

    cached = { at: Date.now(), entries };
    return entries;
  } catch (error) {
    console.log('MOVEMENT LIBRARY READ FAILED:', error instanceof Error ? error.message : error);
    return cached?.entries ?? [];
  }
}
