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
export type CorrectionAction = 'update' | 'delete' | 'move';

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

// A NAMED DAY IS A WINDOW OF ITS OWN (2026-10-04).
//
// Ruth: "Chat says it can't delete Saturdays entries. It most definitely should
// be able to see and do that for the user."
//
// WHAT HAPPENED. She logged Saturday's food on Sunday lunchtime, so every row
// carries a happened_at around 13:00 Saturday. She asked for them on Sunday at
// 16:35 - twenty-six and a half hours later, just past the rolling day above -
// so the lookup genuinely found nothing and said so. She then answered the
// follow-up with "Saturday", and that changed nothing at all, because naming the
// day had nowhere to go.
//
// THE COMMENT ABOVE ALREADY PROMISED THIS: "last week's dinner needs the day
// named explicitly, which nothingToCorrectMessage below already asks for." The
// message asks. Nothing read the answer. An app that asks a question it cannot
// act on is worse than one that does not ask: she gave the right answer twice
// and got the same refusal.
//
// SAME SHAPE AS THE DUPLICATE GUARD FIXED THIS MORNING, which could not see a
// meal logged for a past day because its candidate query was anchored to NOW
// rather than to the entry. Any window measured from the clock excludes exactly
// the entries somebody is catching up on, and catching up is ordinary.
//
// BOUNDED, STILL. A named day is one day - local midnight to local midnight -
// not an unbounded reach backwards. The caller passes the day the person named;
// nothing here guesses one.
export function correctionDayRange(
  isoDate: string,
  timeZone = 'Europe/London'
): { from: string; to: string } | null {
  // yyyy-mm-dd only. Anything else is not a day somebody named, and a
  // half-parsed date pointed at a delete is the wrong thing to be lenient about.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d || m > 12 || d > 31) return null;

  // THE OFFSET IS READ, NOT ASSUMED. British clocks move, and a fixed Z would
  // put an hour of every summer evening on the wrong day. Midday on the named
  // day is used to find the offset because it is never ambiguous, even on the
  // two days a year when midnight could be.
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const asLocal = new Date(noon.toLocaleString('en-US', { timeZone }));
  const asUtc = new Date(noon.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = asLocal.getTime() - asUtc.getTime();

  const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs;
  return {
    from: new Date(startUtc).toISOString(),
    to: new Date(startUtc + 86_400_000).toISOString(),
  };
}


// MOVING AN ENTRY TO ANOTHER DAY (8 October 2026), which is one update and was
// being done as a delete and a re-log.
//
// THE EVIDENCE IS IN HER OWN DATA, TWICE. food_logs_removed holds two rows from
// 28 September whose stated reason is: "A date correction added a copy instead of
// moving the entry. Removed at Ruth's explicit instruction." It was cleaned up by
// hand and the cause was left alone.
//
// Ten days later, 8 October, 09:32: "Please change the Wednesdays sandwhich to
// tuesday." The reply offered to delete it from Wednesday and log it for Tuesday,
// she said yes, and the turn then said "Done - removed from Wednesday and logged
// for Tuesday instead." Nothing was removed, and what was logged went to Thursday.
//
// WHY THE TWO-STEP CANNOT WORK, and this is the part worth writing down. The
// prompt says to set correctionKind and correctionAction INSTEAD OF logIntent: a
// correction is not a new log. So one turn can delete or it can log, never both.
// The model was offering an operation the app has no way to carry out, and the
// only record of the promise was its own sentence.
//
// A MOVE IS THE HONEST SHAPE. The entry is right, its day is wrong, and nothing
// about it needs re-parsing: the same row keeps its id, its items, its macros and
// its own history. A delete and a re-log loses all of that and gives two chances
// to half-fail, which is exactly what happened both times.
//
// THE TIME OF DAY TRAVELS WITH IT. Moving Wednesday lunch to Tuesday should land
// at Tuesday lunchtime, not at the moment she asked. The app already groups by
// local day, so keeping the clock time keeps the meal in the right part of its
// new day and keeps the ordering inside that day sensible.
export function movedTimestamp(
  original: string,
  toIsoDate: string,
  timeZone = 'Europe/London'
): string | null {
  const range = correctionDayRange(toIsoDate, timeZone);
  if (!range) return null;
  const was = new Date(original);
  if (Number.isNaN(was.getTime())) return null;

  // Where in its own LOCAL day the entry sat, to the millisecond. Read against
  // the same zone the new day is built in, so an entry logged at 20:30 under BST
  // does not arrive at 19:30 after the clocks change.
  const localNoonOfWas = new Date(was.toLocaleString('en-US', { timeZone }));
  const utcNoonOfWas = new Date(was.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = localNoonOfWas.getTime() - utcNoonOfWas.getTime();
  const msIntoLocalDay = ((was.getTime() + offsetMs) % 86_400_000 + 86_400_000) % 86_400_000;

  const moved = new Date(new Date(range.from).getTime() + msIntoLocalDay);
  // Never outside the day it was asked to land in. A DST shift can push the last
  // or first hour over a boundary, and an entry that moves to the wrong day is
  // the whole fault this function exists to stop.
  if (moved < new Date(range.from) || moved >= new Date(range.to)) {
    return new Date(new Date(range.from).getTime() + 12 * 3_600_000).toISOString();
  }
  return moved.toISOString();
}

/** What the app says when it has moved something. The app states it, never the model. */
export function movedMessage(kind: CorrectionKind, toIsoDate: string): string {
  const day = new Date(toIsoDate + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const what = kind === 'food' ? 'that entry' : 'that one';
  return `Moved ${what} to ${day}. Nothing was re-entered, so it keeps everything it had.`;
}

const KINDS: CorrectionKind[] = ['food', 'activity', 'measurement', 'personal_metric'];
const ACTIONS: CorrectionAction[] = ['update', 'delete', 'move'];
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
