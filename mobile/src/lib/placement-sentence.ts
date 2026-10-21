// WHAT THE APP SAYS AFTER PLACING A SESSION THE FLOWER COULD NOT READ.
//
// Kept apart from the call that produces it, and importing nothing, so a check
// can load it in node. place-unread-sessions.ts reaches api.ts, which reaches
// react-native. The wording is the part most likely to drift away from what the
// server actually did, so it is the part that needs testing.

export type Placed = { id: string; activityType: string; dimensions: string[] };
export type Unplaced = { id: string; activityType: string };

export type PlaceOutcome =
  | { ok: true; placed: Placed[]; unplaced: Unplaced[] }
  // A FAILURE SAYS SO RATHER THAN READING AS "NOTHING TO PLACE". The two look
  // identical from here and mean opposite things.
  | { ok: false };

/**
 * What to say once it has run. One sentence, because it appears under a line of
 * the same size on a screen whose point is a drawing.
 *
 * SAID IN FULL WHEN THERE IS ONE OF EACH. "1 placed, 1 not" is the true shape
 * of her own data today and the shape a summary would round away.
 */
export function placementSentence(outcome: PlaceOutcome): string {
  if (!outcome.ok) {
    return 'That did not work. Nothing has changed, so it is worth another tap in a moment.';
  }
  const { placed, unplaced } = outcome;
  if (placed.length === 0 && unplaced.length === 0) {
    return 'Nothing was waiting. The drawing already counts everything in this window.';
  }
  const parts: string[] = [];
  if (placed.length > 0) {
    // NAMED, NOT COUNTED, up to a point where naming stops being readable.
    const names = placed.map((p) => p.activityType);
    const unique = [...new Set(names)];
    parts.push(
      unique.length <= 3
        ? `Counted now: ${unique.join(', ')}.`
        : `${placed.length} sessions are counted now.`
    );
  }
  if (unplaced.length > 0) {
    const unique = [...new Set(unplaced.map((u) => u.activityType))];
    parts.push(
      unique.length <= 3
        ? `Still not placed: ${unique.join(', ')}. Tell Selodía what that involved and it will count.`
        : `${unplaced.length} could not be placed. Telling Selodía what they involved will count them.`
    );
  }
  return parts.join(' ');
}
