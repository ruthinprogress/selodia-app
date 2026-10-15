import type { SupabaseClient } from '@supabase/supabase-js';

// THE FIRST HALF OF A TURN, PUBLISHED THE MOMENT IT IS TRUE.
//
// Ruth, 15 October 2026, choosing how to spend the latency work: "two-stage
// reply". And ruling out the cheap option in the same sentence - skipping the
// second model call "is not an option as the majority of app usage will need it
// to demonstrate premium price and also because it's literally what's building
// what I want."
//
// So the turn does not get shorter. It gets a first half.
//
// A led turn is two model calls: 13.6s on average, 28.5s at worst. Everything
// the app DOES - what was logged, what was kept, what reminder was set - is
// decided and written about seven seconds in, by the first call. The remaining
// six or seven seconds are the second call writing prose ABOUT it. She was
// watching a spinner through both halves and receiving everything at once.
//
// This publishes the first half as soon as it exists. What the phone does with
// it is show the confirmation, which is the thing she asked for on 14 October:
// "it's quite disconcerting if it says nothing for a log, it's history. i like
// it best when it does a little table confirming what i told it."
//
// NOTHING HERE IS A SOURCE OF TRUTH. Every field appears again in the ordinary
// response a few seconds later, and the phone treats that response as final. A
// stage that never publishes costs the early confirmation and nothing else,
// which is why every failure below is swallowed after being said out loud.

/** What the app did, in the same shape the final response uses. */
export type ActedStage = {
  /** The save confirmation the phone already shows as a pill. */
  summary?: string | null;
  /** An Almanac entry kept this turn, by title. */
  almanacTitle?: string | null;
  /** A food entry worth drawing a breakdown card for. */
  foodLogId?: string | null;
  /** 'created' or 'cancelled', when this turn touched a reminder. */
  reminder?: string | null;
};

/**
 * An id invented by a client, so it is checked before it reaches a query.
 *
 * Length and alphabet only - this is never parsed, compared to anything but
 * itself, or shown to anybody. The point is that a malformed one MISSES rather
 * than becoming a strange row or a strange lookup.
 */
export function usableTurnId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

/** True when there is anything worth telling her early. */
export function worthPublishing(acted: ActedStage): boolean {
  return Boolean(acted.summary || acted.almanacTitle || acted.foodLogId || acted.reminder);
}

export type PublishStage = {
  supabase: SupabaseClient;
  userId: string;
  clientTurnId: unknown;
  acted: ActedStage;
};

/**
 * Write the first half. Returns whether anything was published.
 *
 * AWAITED, UNLIKE THE OTHER FIRE-AND-FORGET WRITES ON THIS PATH, because the
 * whole value of the row is that it exists BEFORE the reply call starts. A
 * write begun and not waited for would land somewhere in the middle of the
 * thing it is supposed to run ahead of.
 *
 * It is one small insert against an indexed table, and it NEVER throws: a turn
 * must not fail because its progress note did.
 */
export async function publishStage({ supabase, userId, clientTurnId, acted }: PublishStage): Promise<boolean> {
  if (!usableTurnId(clientTurnId)) return false;
  if (!worthPublishing(acted)) return false;

  try {
    const { error } = await supabase.from('turn_stage').upsert(
      {
        user_id: userId,
        client_turn_id: clientTurnId,
        // Only the members that have something in them, so the phone can treat
        // a present key as a fact rather than checking each one for null.
        acted: Object.fromEntries(Object.entries(acted).filter(([, v]) => v !== null && v !== undefined)),
      },
      { onConflict: 'user_id,client_turn_id' }
    );
    if (error) {
      console.log('TURN STAGE NOT PUBLISHED:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.log('TURN STAGE NOT PUBLISHED:', err instanceof Error ? err.message : err);
    return false;
  }
}
