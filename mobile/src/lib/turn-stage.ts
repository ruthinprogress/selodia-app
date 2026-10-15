import { supabase } from '@/lib/supabase';

// THE FIRST HALF OF A TURN, READ WHILE THE SECOND HALF IS STILL BEING WRITTEN.
//
// Ruth, 15 October 2026: "two-stage reply" - chosen over the two cheaper ways
// of shortening a turn, because skipping the second model call "is not an
// option as the majority of app usage will need it to demonstrate premium
// price and also because it's literally what's building what I want."
//
// A led turn is two model calls, 13.6s on average and 28.5s at worst. The
// first one decides and the app acts on it about seven seconds in; the second
// spends the remaining six or seven writing prose about what already happened.
// So for the back half of every turn the phone is sitting on a spinner while
// the server already knows what was logged.
//
// The server now publishes that the moment it is true (app/lib/turn-stage.ts),
// keyed by an id this file invents before the request goes out. This reads it
// back. What it buys is the confirmation she asked for on 14 October: "it's
// quite disconcerting if it says nothing for a log, it's history. i like it
// best when it does a little table confirming what i told it."
//
// READ THROUGH THE ORDINARY CLIENT, so there is no new endpoint to go wrong.
// Row-level security already limits this table to her own rows.
//
// NOTHING HERE IS LOAD-BEARING. Every field arrives again in the response a
// few seconds later, and that response is what the thread is built from. If
// this never resolves - no row, no network, policy change, anything - the turn
// behaves exactly as it did before any of this existed.

export type ActedStage = {
  /** The save confirmation, e.g. "Breakfast · 420 kcal". */
  summary?: string | null;
  /** An Almanac entry kept this turn, by title. */
  almanacTitle?: string | null;
  /** A food entry worth drawing a breakdown card for. */
  foodLogId?: string | null;
  /** 'created' or 'cancelled', when this turn touched a reminder. */
  reminder?: string | null;
};

/**
 * A name for this turn, made before it is sent.
 *
 * Not a uuid, and deliberately so: nothing parses it, nothing sorts by it, and
 * it is only ever compared to itself. Time first so two turns in one
 * millisecond would still differ in the random half, and the alphabet matches
 * what the server will accept - see usableTurnId.
 */
export function newTurnId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** True when there is something here worth putting on screen. */
export function hasSomethingToSay(acted: ActedStage | null): acted is ActedStage {
  return Boolean(acted && (acted.summary || acted.almanacTitle || acted.foodLogId || acted.reminder));
}

/**
 * Watch for the first half of a turn, and hand it over once.
 *
 * Returns a function that STOPS the watch, which the caller must call when the
 * reply arrives - otherwise a turn that published nothing would leave a timer
 * running behind every message she sends.
 *
 * POLLED, NOT SUBSCRIBED. A realtime subscription would be the tidier answer
 * and it is a second connection to keep alive, authorise and tear down for a
 * single row that is interesting for about six seconds. Five reads of an
 * indexed table, for one person's own row, is the smaller thing.
 */
export function watchForStage(
  clientTurnId: string,
  onStage: (acted: ActedStage) => void,
  { everyMs = 1200, forMs = 25000 }: { everyMs?: number; forMs?: number } = {}
): () => void {
  let stopped = false;
  const started = Date.now();

  const timer = setInterval(async () => {
    if (stopped) return;
    // A turn that has run long past the point of publishing has nothing to
    // wait for, and the response will arrive on its own.
    if (Date.now() - started > forMs) {
      clearInterval(timer);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('turn_stage')
        .select('acted')
        .eq('client_turn_id', clientTurnId)
        .maybeSingle();
      if (stopped || error || !data) return;
      const acted = (data.acted ?? {}) as ActedStage;
      if (!hasSomethingToSay(acted)) return;
      stopped = true;
      clearInterval(timer);
      onStage(acted);
    } catch {
      // Swallowed on purpose. This is an optimisation on top of a turn that
      // works without it; a failed read must never surface as an error about
      // a message that is still perfectly on its way.
    }
  }, everyMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
