// When a roundup fires, and on what basis (Part Nine).
//
// Deterministic code, not the model's judgement - the same split the safety
// state machine draws. Whether to speak to someone at the end of their day, and
// whether a week has enough in it to be summarised honestly, are decisions that
// must not drift between runs.

export type DayLogState = {
  // At least one FOOD entry exists for the day. Food specifically: a day is
  // "logged" on food alone, because body measurements and activity are not
  // naturally daily and holding them to that standard would mark ordinary days
  // as failures (Part Nine, "full" day).
  hasFood: boolean;
  // Anything at all - a measurement, an activity, a conversation.
  hasAnything: boolean;
};

export type EveningAction =
  // "Ready to look back on today?" - invitational, never an announcement.
  | 'offer_roundup'
  // "Anything to log for today?" - the ordinary reminder.
  | 'remind'
  // A day with no data at all gets nothing. Forcing a roundup over an empty day
  // would be hollow, and hollow is worse than quiet.
  | 'silent';

export function eveningAction(state: DayLogState): EveningAction {
  if (state.hasFood) return 'offer_roundup';
  if (state.hasAnything) return 'remind';
  return 'silent';
}

// A week needs 5 of 7 days carrying at least one food entry before a full
// weekly roundup is offered.
export const WEEKLY_MIN_FULL_DAYS = 5;

export type WeeklyGate =
  | { kind: 'full_roundup'; fullDays: number }
  // Below the threshold there is no attempt at a full roundup. Unflump asks how
  // logging has been going instead - and the BRANCH on that answer (ordinary
  // friction vs something more concerning) is the safety classifier's, not
  // this module's. This only decides that the question gets asked.
  | { kind: 'ask_how_its_going'; fullDays: number };

export function weeklyGate(dayStates: DayLogState[]): WeeklyGate {
  const fullDays = dayStates.filter((d) => d.hasFood).length;
  return fullDays >= WEEKLY_MIN_FULL_DAYS
    ? { kind: 'full_roundup', fullDays }
    : { kind: 'ask_how_its_going', fullDays };
}

// Confidence is attached LOCALLY to the number it affects, never as a blanket
// disclaimer at the top (Part Nine). Missing days are excluded from a
// calculation rather than counted as zero - counting them as zero would drag
// every average toward a number nobody ate - and this states honestly how many
// days the figure actually rests on.
//
// Returns null at a full week: a caveat on a complete number is noise, and a
// disclaimer that always appears stops being read.
export function confidenceNote(fullDays: number, totalDays = 7): string | null {
  if (fullDays >= totalDays) return null;
  return `based on ${fullDays} of ${totalDays} days logged, so take this as indicative`;
}

// Whether a trend is worth stating as a direction at all.
//
// Part Nine allows a trajectory ONLY when the data genuinely supports one, and
// requires saying so honestly rather than omitting the topic when it does not.
// Two readings a week apart is a difference, not a trajectory; the trend engine
// already draws that line at three, and this holds the same one rather than
// inventing a second, looser standard for the roundup.
export const MIN_READINGS_FOR_TRAJECTORY = 3;

export function canStateTrajectory(readingCount: number, fullDays: number): boolean {
  return readingCount >= MIN_READINGS_FOR_TRAJECTORY && fullDays >= WEEKLY_MIN_FULL_DAYS;
}
