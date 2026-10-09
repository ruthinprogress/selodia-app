import { after } from 'next/server';

import { getSupabaseServiceRole } from './supabase';

// THE LOGS WE NEED, KEPT OURSELVES RATHER THAN RENTED.
//
// Ruth, 28 September 2026: "can you keep the logs you need (errors, turn
// timings, fallbacks) in our own database or another free option, the same way
// model_usage works? If that's good enough, we skip Pro for now."
//
// WHAT THE PROBLEM ACTUALLY WAS. Vercel's free tier keeps nothing - there is a
// live stream and no history - so a question asked an hour after the event
// cannot be answered at all. Twice on 28 September that stopped an
// investigation: whether the usage rows were failing to insert, and whether the
// speculative reply was being discarded. Supabase Pro at $25/month buys seven
// days of retention. This buys unlimited retention of the three things that were
// wanted, for nothing, and it keeps them next to the data they are about.
//
// WHAT IS NOT HERE, deliberately. Every console.log the route makes. A log
// nobody queries is a cost with no reader, and the point of choosing what to
// keep is that it is a choice. Three things earn a row:
//
//   1. TURN TIMINGS - the phase marks, on every turn. Small, and the only way
//      to answer "was it slow, and where" after the fact.
//   2. ERRORS - the route's own catches, which currently print and vanish.
//   3. FALLBACKS - already have their own table, `reply_path_fallbacks`.
//
// RECORDING MUST NEVER COST A TURN, same rule as usage-record.ts: nothing here
// is awaited on the path to a reply, and `after` keeps the function alive long
// enough for the write to land - because a fire-and-forget promise in a
// serverless function is not forgotten, it is killed.

type Timing = {
  userId: string | null;
  turnId: string | null;
  voice: boolean;
  /** Elapsed-at-mark for each phase, plus `total`. */
  marks: Record<string, number>;
};

type RouteError = {
  userId: string | null;
  turnId: string | null;
  voice: boolean;
  /** Where it happened, in the route's own words. */
  label: string;
  detail: Record<string, unknown>;
};

function write(row: Record<string, unknown>): void {
  const work = async () => {
    try {
      const { error } = await getSupabaseServiceRole().from('turn_diagnostics').insert(row);
      // Said out loud, not swallowed. A diagnostics table that silently stops
      // recording is worse than none, because its emptiness reads as a quiet day.
      if (error) console.log(`TURN DIAGNOSTICS: insert failed - ${error.code} ${error.message}`);
    } catch (err) {
      console.log('TURN DIAGNOSTICS: threw', err instanceof Error ? err.message : err);
    }
  };
  // The function, not the promise - see usage-record.ts for why.
  try {
    after(work);
  } catch {
    void work();
  }
}

/** Every turn, spoken or typed. The phase marks and the total. */
export function recordTurnTiming(t: Timing): void {
  write({
    user_id: t.userId,
    turn_id: t.turnId,
    kind: 'timing',
    voice: t.voice,
    label: t.voice ? 'voice' : 'typed',
    total_ms: t.marks.total ?? null,
    detail: t.marks,
  });
}

/**
 * THE SAME NUMBERS, BUT FROM THE FRONT DOOR (9 October 2026).
 *
 * recordTurnTiming above measures the pipeline. The pipeline is not the turn.
 *
 * On 9 October a spoken turn reported total: 4097 and spokenAloudFrom: 2114,
 * while ElevenLabs measured first byte at 14,370ms. Twelve seconds were outside
 * everything this file could see, because the clock starts inside
 * ask-selodia's POST and the adapter does real work before it: two sequential
 * reads of chat_messages to decide whether this turn has been seen before, and
 * then, on the continuation path, a wait of up to SUPERSEDE_WAIT_MS - ten
 * seconds - for the earlier turn to finish. Ten plus four point one is
 * fourteen point one, which matched the gap to within three tenths of a second.
 *
 * So every diagnostic in the app agreed that voice was fast while she sat
 * there waiting. The instrument was measuring the fast part.
 *
 * This is the same row shape with label 'adapter', so the two can be read
 * side by side for one turn: what the door took, and what the pipeline took.
 * It is measurement only and changes no behaviour - deciding what to do about
 * the ten seconds is Ruth's, and it needs this to judge it by.
 */
export function recordAdapterTiming(t: Timing): void {
  write({
    user_id: t.userId,
    turn_id: t.turnId,
    kind: 'timing',
    voice: true,
    label: 'adapter',
    total_ms: t.marks.total ?? null,
    detail: t.marks,
  });
}

/**
 * Something the route caught.
 *
 * TAKES WHAT IS KNOWN RATHER THAN AN Error. Half the interesting failures on
 * this route are not exceptions - a 42P10 from Postgres, a model returning a
 * truncated tool block, a fallback reason - and forcing them into an Error to
 * record them would lose the fields that identify them.
 */
export function recordRouteError(e: RouteError): void {
  write({
    user_id: e.userId,
    turn_id: e.turnId,
    kind: 'error',
    voice: e.voice,
    label: e.label,
    detail: e.detail,
  });
}
