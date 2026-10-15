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
 * WHICH FIELDS THE DECIDING CALL ACTUALLY SET. Names only, never a value.
 *
 * Ruth, 15 October 2026, on whether to shrink the classifier's tool: "yes, add
 * the instrumentation now."
 *
 * WHY THIS EXISTS. The first call of a led turn produces between 327 and 1,401
 * output tokens, and output tokens are where the seconds of a 13.6s turn are.
 * The tool it fills has grown to around thirty optional fields, and the obvious
 * saving is to stop offering the ones nobody uses.
 *
 * Nobody can name those fields. They have never been counted, and guessing
 * which are dead is how a working feature gets removed - half of them exist
 * because something went wrong once, which is exactly the kind of field that
 * fires rarely and matters enormously when it does. So this counts them for a
 * while first, and the cut is made from the count.
 *
 * AND IT IS NOT A LICENCE TO CUT ON ITS OWN. Two costs sit on the other side,
 * written down here so they are weighed when the data arrives rather than
 * forgotten:
 *
 *   THE TOOL SCHEMA HAS ITS OWN CACHE BREAKPOINT. A tool whose shape varies
 *   per turn breaks that cache on every turn it varies, which can cost more
 *   than the fields save. Only a small number of STABLE variants are safe.
 *
 *   THIS IS THE CALL THAT CARRIES THE DISTRESS CLASSIFICATION. Any change to
 *   it gets the full safety comparison, the way the decider swap did on 15
 *   October before being declined.
 *
 * NAMES ONLY, AND THAT IS THE WHOLE PROMISE. Not what was logged, not what she
 * said, not the classification - a tier is a fact about a person on a day, and
 * it is already recorded where it belongs. This row answers one question: which
 * of the tool's fields are ever used. `reply` and `classification` are required
 * by the schema, so they appear on every row and mean nothing; everything else
 * is a real signal.
 */
export function recordDecisionFields(d: {
  userId: string | null;
  turnId: string | null;
  voice: boolean;
  led: boolean;
  fields: string[];
}): void {
  write({
    user_id: d.userId,
    turn_id: d.turnId,
    kind: 'fields',
    voice: d.voice,
    label: d.led ? 'led' : 'plain',
    detail: { set: d.fields, count: d.fields.length },
  });
}

/**
 * The names of the fields the model set, from the raw tool input.
 *
 * ONE DEFINITION, used by the recorded row AND by the x-selodia-decision
 * header, so an answer read off the header can never disagree with the table.
 *
 * "Set" means the model chose to say something. A field left out, or filled
 * with the empty string, with 'none', or with false, is the model declining -
 * so those are not set, and counting them would make every field look used.
 */
export function fieldsSet(result: Record<string, unknown>): string[] {
  return Object.entries(result)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'none' && v !== false)
    .map(([k]) => k)
    .sort();
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
