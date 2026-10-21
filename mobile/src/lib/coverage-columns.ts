import { coverageFor } from '@/lib/activity-weights';
import { COVER_COLUMN, DIMENSIONS } from '@/lib/health-flower';

// WHAT A ROW WRITTEN BY THE PHONE CONTRIBUTES TO THE FLOWER.
//
// Found on 21 October 2026 while scoping the rest-day tap, and it is a bigger
// fault than the thing that found it. Counted in her own data:
//
//   source           rows   with coverage
//   manual text        37             27
//   chat                7              7
//   workout plan        4              0
//
// EVERY SESSION LOGGED FROM THE PLANS TAB COUNTS FOR NOTHING. The six cover_*
// columns are written by the SERVER, once, when a chat turn logs an activity -
// app/lib/activity-weights.ts says why it happens there: "doing that lookup on
// every Overview render would be an AI call per unmatched activity every time
// the screen opens". The phone inserts its rows directly and writes none of
// them, so a planned session she ticked off is invisible to "What's protecting
// you" - which is precisely the movement she most deliberately did.
//
// THE PHONE DOES NOT NEED AN AI CALL FOR THE ONES IN THE TABLE. The weighting
// table is generated onto the phone already, for the Week's own flower. Thirty
// one activity types and their aliases can be answered locally, instantly, for
// nothing. Anything the table does not hold stays null, exactly as it does
// today, and is still the server's job - null is "not classified yet", and
// health-flower.ts is careful that this is NOT the same as zero.
//
// SO THIS IS A LOOKUP, NEVER A GUESS. No nearest match, no inference from a
// similar name. The same rule week-coverage-lookup.ts states for the same
// reason.

/** The six cover_* columns for an insert, or {} when nothing is known. */
export function coverageColumns(activityType: string | null | undefined): Record<string, number> {
  const weights = coverageFor(activityType);
  if (!weights) return {};
  const out: Record<string, number> = {};
  for (const d of DIMENSIONS) out[COVER_COLUMN[d]] = weights[d];
  return out;
}
