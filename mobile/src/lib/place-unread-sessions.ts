import { authedPost } from '@/lib/api';
import type { PlaceOutcome, Placed, Unplaced } from '@/lib/placement-sentence';

// THE WORDING LIVES NEXT DOOR, with no import of its own, so a check can load
// it. This file reaches the network through api.ts, which reaches react-native,
// which a node check cannot load - the same split flower-geometry.ts and
// coverage-columns.ts were given, for the same reason.
export { placementSentence } from '@/lib/placement-sentence';
export type { PlaceOutcome, Placed, Unplaced } from '@/lib/placement-sentence';

// THE WAY OUT OF "NOT COUNTED HERE YET".
//
// Ruth, 21 October 2026, on a screenshot of that line with nothing to tap:
//
//   "It needs a link for user to resolve this. Its not clear."
//
// The line was half a feature. It told her the drawing was under-reporting and
// gave her no way to make it stop, which is a worse place to be left than not
// knowing. This is the other half: one tap, the server runs the same
// classifier a chat turn would have run, and the sessions it can place are
// placed.
//
// IT IS NOT A SILENT FIX. The result names every session and says which of the
// six it fed, because "2 sessions placed" is the kind of sentence that leaves
// somebody wondering what the app decided about them. And a session it could
// not place is named too, still uncounted - that is the honest outcome and the
// one she can actually do something about.


/**
 * Ask the server to place every unclassified session in this window.
 *
 * The window is the one she is looking at, so the number that comes back can
 * be reconciled against the number she tapped.
 */
export async function placeUnreadSessions(range: {
  from: Date;
  to: Date;
}): Promise<PlaceOutcome> {
  try {
    const result = await authedPost<{ placed: Placed[]; unplaced: Unplaced[] }>(
      '/api/place-activity',
      { from: range.from.toISOString(), to: range.to.toISOString() }
    );
    return { ok: true, placed: result.placed ?? [], unplaced: result.unplaced ?? [] };
  } catch (error) {
    console.log('PLACE SESSIONS FAILED:', error instanceof Error ? error.message : error);
    return { ok: false };
  }
}

/**
 * Place ONE session from her own description of it.
 *
 * THE ONLY CASE WHERE A TAP EARNS ITS PLACE. Everything the classifier can do
 * alone now happens when the row is written - see plans.tsx. What is left is a
 * name with nothing in it: "gym session" describes a building, and no amount of
 * re-running anything will place it. Told what she did there, the same
 * classifier places it at once.
 *
 * Ruth, 22 October 2026, on the version that did not ask her anything: "I
 * thought the reason we put that there was because it needed more info to make
 * sense to the algorithm of the flower. What did it do? That was a bit odd and
 * pointless."
 */
export async function describeSession(id: string, describedAs: string): Promise<PlaceOutcome> {
  try {
    const result = await authedPost<{ placed: Placed[]; unplaced: Unplaced[] }>(
      '/api/place-activity',
      { id, describedAs }
    );
    return { ok: true, placed: result.placed ?? [], unplaced: result.unplaced ?? [] };
  } catch (error) {
    console.log('DESCRIBE SESSION FAILED:', error instanceof Error ? error.message : error);
    return { ok: false };
  }
}
