// Correcting or removing a log by saying so (build item 10d, 2026-08-26).
//
// WHY THIS EXISTS. Nothing in the app could fix a wrong entry. Four routes -
// edit-food, delete-food, edit-activity, delete-activity - were built for the
// retired web frontend and no client has ever called them; none of them
// authenticates, and none covers body measurements at all.
//
// That matters more than it sounds. The plausibility guard added with text
// weight logging rejects a weight outside 20-400 kg, so it catches a
// catastrophic misparse. It does NOT catch 55.2 logged as 52.5 - plausible,
// wrong, and permanent. The interpretation layer then reasons over that number
// and tells someone something false about their own body, with no way to fix
// it. One of those teaches a person not to trust the app.
//
// Conversational, deliberately, rather than a delete button on every row. The
// app has no edit UI anywhere by design (Part Ten's hard constraint is about
// exercises, but the single-entry-point principle runs throughout), and "no,
// that was 55.2" is how a person actually corrects someone. It also needs no
// new control, so it cannot become a dead one.

export type CorrectionKind = 'food' | 'activity' | 'measurement' | 'personal_metric';
export type CorrectionAction = 'update' | 'delete';

// How far back a correction may reach.
//
// Longer than the food clarification's 15 minutes, because a clarification
// answers a question Unflump just asked - it is inside a live exchange -
// whereas a correction is someone noticing their own mistake, which happens a
// few minutes later when they glance at the screen. Short enough that "actually
// make that 300 calories" cannot silently rewrite yesterday's dinner.
export const CORRECTION_WINDOW_MIN = 30;

export const TABLE_FOR: Record<CorrectionKind, string> = {
  food: 'food_logs',
  activity: 'activity_logs',
  measurement: 'body_measurements',
  personal_metric: 'personal_metrics',
};

// Each table stamps its own event time under a different name.
export const TIME_COLUMN_FOR: Record<CorrectionKind, string> = {
  food: 'happened_at',
  activity: 'happened_at',
  measurement: 'measured_at',
  personal_metric: 'measured_at',
};

export function correctionCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - CORRECTION_WINDOW_MIN * 60 * 1000).toISOString();
}

const KINDS: CorrectionKind[] = ['food', 'activity', 'measurement', 'personal_metric'];
const ACTIONS: CorrectionAction[] = ['update', 'delete'];

// Valid-or-nothing, never valid-or-guess. An unrecognised value must not fall
// through to a default: every default here either edits or destroys a row of
// someone's real data.
export function coerceCorrectionKind(v: unknown): CorrectionKind | null {
  return typeof v === 'string' && (KINDS as string[]).includes(v) ? (v as CorrectionKind) : null;
}

export function coerceCorrectionAction(v: unknown): CorrectionAction | null {
  return typeof v === 'string' && (ACTIONS as string[]).includes(v)
    ? (v as CorrectionAction)
    : null;
}

// A correction only runs when BOTH halves are understood. A kind with no action,
// or an action with no kind, is an incomplete instruction - and the safe reading
// of an incomplete instruction about someone's data is to do nothing.
export function resolveCorrection(
  rawKind: unknown,
  rawAction: unknown
): { kind: CorrectionKind; action: CorrectionAction } | null {
  const kind = coerceCorrectionKind(rawKind);
  const action = coerceCorrectionAction(rawAction);
  if (!kind || !action) return null;
  return { kind, action };
}

// What Unflump says once the row is gone. Plain and final - a deletion should
// read as done, not as a negotiation, and never as a telling-off for the
// mistake that caused it.
export function deletionMessage(kind: CorrectionKind): string {
  switch (kind) {
    case 'measurement':
      return "Removed that reading — it's gone from your history.";
    case 'activity':
      return "Removed that one — it's out of today's activity.";
    case 'food':
    default:
      return "Removed that one — it's out of today's total.";
  }
}

// And when there was nothing recent enough to act on. Says why rather than
// failing silently, because a person who thinks they deleted something and did
// not is worse off than one who knows it did not work.
export function nothingToCorrectMessage(kind: CorrectionKind): string {
  const what =
    kind === 'measurement'
      ? 'a reading'
      : kind === 'personal_metric'
        ? 'a measurement'
        : kind === 'activity'
          ? 'an activity'
          : 'a food entry';
  return `I can't find ${what} recent enough to change — if it's an older one, tell me which day and what it should say.`;
}
