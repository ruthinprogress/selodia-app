import { confidenceNote, type DayLogState } from './roundup-rules';

// Weekly roundup aggregation (Part Nine, build item 20).
//
// PURE ARITHMETIC, deliberately separated from the route. Every rule the spec
// attaches to a weekly number is a rule about how it is COMPUTED, not about how
// it is worded — missing days excluded rather than zeroed, confidence attached
// to the specific figure it affects, a trajectory only when the readings support
// one. Those belong in code that can be reasoned about and tested, not inside a
// prompt where they would become suggestions.
//
// The model's job is the language. This module's job is making sure the numbers
// it is handed are already honest.

export const WEEK_DAYS = 7;

export type DayRow = { date: string; kcal: number | null; proteinG: number | null; hasFood: boolean };

export type WeeklyFigure = {
  value: number;
  // How many of the seven days this figure actually rests on. Carried WITH the
  // number rather than computed once for the whole roundup, because a weekly
  // kcal average and a weight delta can rest on different days.
  basedOnDays: number;
  // The spec's local confidence note, or null when the figure is complete.
  confidence: string | null;
};

// The seven ISO dates ending on `endDate` inclusive, oldest first. Dates rather
// than timestamps: a "day" is a calendar day in the person's life, and a week
// boundary that moves with the clock would make the same week produce different
// answers depending on when it was asked for.
export function weekDates(endDate: Date): string[] {
  const out: string[] = [];
  for (let i = WEEK_DAYS - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    out.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  return out;
}

export function toDayStates(days: DayRow[]): DayLogState[] {
  return days.map((d) => ({ hasFood: d.hasFood, hasAnything: d.hasFood }));
}

// MISSING DAYS ARE EXCLUDED, NEVER ZEROED. The spec is explicit, and the reason
// is arithmetic rather than tone: counting an unlogged day as 0 kcal drags the
// average toward a number nobody ate, and then the app tells someone they
// averaged 1,100 when they averaged 1,570 across the days they recorded. That is
// not a gentler number, it is a wrong one, and it points at a deficit that did
// not happen.
export function averageOverLoggedDays(
  days: DayRow[],
  pick: (d: DayRow) => number | null
): WeeklyFigure | null {
  const values = days.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    value: Math.round(sum / values.length),
    basedOnDays: values.length,
    confidence: confidenceNote(values.length, WEEK_DAYS),
  };
}

export function totalOverLoggedDays(
  days: DayRow[],
  pick: (d: DayRow) => number | null
): WeeklyFigure | null {
  const values = days.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) return null;
  return {
    value: Math.round(values.reduce((a, b) => a + b, 0)),
    basedOnDays: values.length,
    confidence: confidenceNote(values.length, WEEK_DAYS),
  };
}

export type Reading = { date: string; value: number };

export type WeekDelta = {
  first: Reading;
  last: Reading;
  change: number;
  readingCount: number;
};

// The week's movement in a measurement, first reading to last.
//
// Returns null on fewer than two readings: one reading is a position, not a
// change, and a "delta" computed from it would be zero — which reads as "no
// change this week" when the truth is "we only weighed once".
export function weekDelta(readings: Reading[]): WeekDelta | null {
  const sorted = readings
    .filter((r) => Number.isFinite(r.value))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    first,
    last,
    change: Math.round((last.value - first.value) * 10) / 10,
    readingCount: sorted.length,
  };
}

// What the model is allowed to say about direction, decided here rather than
// left to its judgement.
//
// Part Nine requires a trajectory ONLY where the data supports one, and requires
// saying so honestly rather than dropping the subject when it does not — so
// there are three outcomes, not two, and "not enough yet" is a real answer the
// roundup is expected to give out loud.
export type TrajectoryPermission =
  | { kind: 'may_state'; delta: WeekDelta }
  | { kind: 'say_not_enough_data'; reason: string };

export function trajectoryPermission(
  delta: WeekDelta | null,
  fullDays: number,
  minReadings: number,
  minFullDays: number
): TrajectoryPermission {
  if (!delta) {
    return {
      kind: 'say_not_enough_data',
      reason: 'fewer than two measurements this week, so there is no movement to describe',
    };
  }
  if (delta.readingCount < minReadings) {
    return {
      kind: 'say_not_enough_data',
      reason: `only ${delta.readingCount} measurements this week; a direction needs at least ${minReadings}`,
    };
  }
  if (fullDays < minFullDays) {
    return {
      kind: 'say_not_enough_data',
      reason: `only ${fullDays} of ${WEEK_DAYS} days were logged, so a trend would rest on too little`,
    };
  }
  return { kind: 'may_state', delta };
}
