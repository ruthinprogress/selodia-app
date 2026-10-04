// WHAT A SETUP SCREEN'S SAVE ACTUALLY DID (4 October 2026).
//
// Ruth: "From Profile, filled in 'What you already do' but nothing was populated
// anywhere in week." And, the same evening: "How your days feel in the Body
// Manual is broken btw, nothing selected goes anywhere or is saved."
//
// Both are the same line, in two files:
//
//     if (!mayWrite(loadState)) return true;
//
// The refusal is correct. A screen that has not read her existing answers must
// not write, because an empty chip row would then be indistinguishable from "she
// deselected everything" - which is what deleted her entire week on 1 October.
//
// RETURNING `true` IS THE BUG. `true` means "carry on" to the caller, so she is
// moved to the next screen, or back to her profile, and told nothing at all. A
// refusal reported as a success is indistinguishable from a save that worked,
// which is exactly why it could happen repeatedly without either of us knowing
// where the answers went. Her feel_goals table has no rows: not one, not even an
// archived one.
//
// A BOOLEAN CANNOT CARRY THIS. There are four outcomes and they need four
// different things said to her, so the type says which rather than collapsing
// them into "fine" and "not fine".
//
// Found in four screens on 4 October: activities, days, allergies, skill. Fixing
// one and leaving three is the mistake that made "Ask about this" dead
// everywhere, so this is a shared type with a check that no screen may reinstate
// the boolean.

export type SaveOutcome =
  /** Rows were written, or there was genuinely nothing to change. */
  | 'saved'
  /** She chose nothing. Her answers are untouched, and she should be told. */
  | 'nothing-chosen'
  /** The screen never read her existing answers, so it refused to write. */
  | 'not-ready'
  /** A read or write failed. */
  | 'failed';

/**
 * The line shown when a save deliberately did not happen. Null for 'saved', and
 * for 'failed', which has its own wording about the connection.
 *
 * NEITHER OF THESE IS AN ERROR, so neither is written in the danger colour. One
 * is the app refusing to guess at her answers; the other is her having answered
 * nothing. Both are outcomes she is entitled to know about.
 */
export function saveOutcomeMessage(outcome: SaveOutcome, what: string): string | null {
  if (outcome === 'not-ready') {
    return `Your ${what} could not be loaded just now, so nothing was saved and nothing was changed. Try again, or close this and come back.`;
  }
  if (outcome === 'nothing-chosen') {
    return `Nothing was selected, so your ${what} is unchanged. Tap what applies, then Continue.`;
  }
  return null;
}
