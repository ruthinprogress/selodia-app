// Correcting or removing a log by saying so (build item 10d, 2026-08-26).
//
// WHY THIS EXISTS. Nothing in the app could fix a wrong entry. Four routes -
// edit-food, delete-food, edit-activity, delete-activity - were built for the
// retired web frontend and no client ever called them. They were DELETED on
// 2026-09-09, and not merely for lacking authentication: edit-food wrote macros
// onto food_logs while food_items holds its own per-item macros, so any edit
// silently desynced a meal's total from its own breakdown; edit-activity ignored
// eccentric_load, intensity and the six cover_* columns the DOMS flag reads; and
// both returned null with a 200 when the update matched nothing, which is exactly
// the shape that hides an RLS denial as success. This file is the whole story now.
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

import type { MeasurementField } from './measurement-logging';

export type CorrectionKind = 'food' | 'activity' | 'measurement' | 'personal_metric';
export type CorrectionAction = 'update' | 'delete';

// One entry, or every duplicate of it (added 2026-09-09).
//
// "I logged that twice" and "remove all of those" are ordinary things to say and
// used to take one turn each to undo, deleting the newest match every time. Four
// duplicates meant four instructions, and getting one wrong meant deleting the
// real entry along with its copies. The scope is the model's reading of what the
// person meant, not a phrase match - there is no list of trigger words to keep.
export type CorrectionScope = 'one' | 'duplicates';

// How far back a correction may reach.
//
// Longer than the food clarification's 15 minutes, because a clarification
// answers a question Selodia just asked - it is inside a live exchange -
// whereas a correction is someone noticing their own mistake, which happens a
// few minutes later when they glance at the screen.
//
// WAS 30 MINUTES UNTIL 2026-09-09, AND THIRTY MINUTES MADE DATA PERMANENT.
//
// The original reasoning - short enough that "make that 300 calories" cannot
// silently rewrite yesterday's dinner - protected against the wrong thing. The
// real failure showed up in use: four duplicate food entries went in during a
// voice session, were noticed later, and by then NOTHING in the app could remove
// them. They came out with hand-written SQL, which is not a feature. A window
// this short does not prevent bad edits, it prevents fixes - and an entry nobody
// can correct is exactly what this file was written to stop existing.
//
// A day is the honest span, because a day is the unit the app already thinks in:
// totals, roundups and targets all reset at midnight, so "the lunch I logged
// this morning" is a live thing to a person and should be to Selodia too. It is
// still bounded - last week's dinner needs the day named explicitly, which
// nothingToCorrectMessage below already asks for.
export const CORRECTION_WINDOW_MIN = 1440;

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
const SCOPES: CorrectionScope[] = ['one', 'duplicates'];

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

// Defaults to 'one'. Every other coercion here refuses to guess, because its
// defaults would edit or destroy data - this one is safe to default because the
// default is the NARROWER action. An unset or unrecognised scope removes a single
// entry, which is what the field did before it existed.
export function coerceCorrectionScope(v: unknown): CorrectionScope {
  return typeof v === 'string' && (SCOPES as string[]).includes(v)
    ? (v as CorrectionScope)
    : 'one';
}

// WHAT MAKES TWO ENTRIES THE SAME ENTRY.
//
// Only food and activity have a defensible answer, so only they support bulk
// removal. Two food rows with the same raw text and meal label on the same day
// really are a double-log; two identical activity rows likewise. A repeated
// weight or waist reading is NOT - somebody may genuinely weigh twice in a day,
// and those numbers feed the interpretation layer, so deleting the pair on a
// guess would erase real history. Those kinds fall back to a single delete.
export const DUPLICATE_MATCH_COLUMNS: Partial<Record<CorrectionKind, string[]>> = {
  food: ['raw_text', 'meal_label'],
  activity: ['activity_type', 'duration_min'],
};

export function supportsDuplicateRemoval(kind: CorrectionKind): boolean {
  return DUPLICATE_MATCH_COLUMNS[kind] !== undefined;
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

// What Selodia says once the row is gone. Plain and final - a deletion should
// read as done, not as a negotiation, and never as a telling-off for the
// mistake that caused it.
export function deletionMessage(kind: CorrectionKind): string {
  switch (kind) {
    case 'measurement':
      return "Removed that reading. It's gone from your history.";
    case 'activity':
      return "Removed that one. It's out of today's activity.";
    case 'food':
    default:
      return "Removed that one. It's out of today's total.";
  }
}

// When several copies of the same entry went, rather than one. Says the number,
// because "removed those" leaves somebody wondering whether it caught all four -
// and checking would mean going to look, which is the thing this saves them.
export function duplicatesRemovedMessage(kind: CorrectionKind, count: number): string {
  if (count === 1) return deletionMessage(kind);
  const where = kind === 'activity' ? "today's activity" : "today's total";
  return `Removed all ${count} of those. They're out of ${where}.`;
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
  return `I can't find ${what} from the last day or so to change. If it's an older one, tell me which day and what it should say.`;
}

// ASK, DON'T ASSUME (2026-08-28). A bare number in a correction can fit more
// than one reading on the row it is aimed at, and there is no honest way to
// pick: 26.4 is a credible body fat percentage and a credible weight in kg.
// Guessing rewrites a reading the person never mentioned, and does it silently.
//
// So the app asks — the same discipline the safety classification and the food
// extraction already follow, and for the same reason: the question costs one
// turn, the wrong write costs a number they may never notice is wrong.
//
// Names the candidates rather than asking a bare "which one?", because the
// person cannot see the row and should not have to remember what was on it. No
// apology and no explanation of the mechanism: they made a normal request, and
// being told the app is confused is not their problem to hold.
export function whichReadingMessage(value: number, candidates: MeasurementField[]): string {
  const label: Record<MeasurementField, string> = {
    weight: 'your weight',
    body_fat: 'body fat',
    muscle: 'muscle',
  };
  const names = candidates.map((c) => label[c]);
  const list =
    names.length <= 2
      ? names.join(' or ')
      : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  const shown = Math.round(value * 10) / 10;
  return `Just so I change the right one. Is ${shown} ${list}?`;
}
