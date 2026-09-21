// WHAT HER OWN CYCLES SAY, once there are some.
//
// Ruth, correcting me when I scoped this to her test account's single recorded
// period: "we are designing for Selodia as a multiuser app with thousands of
// users and this is a test account - it needs to be properly scoped, not build
// for the test account's current test state."
//
// She was right, and it changes the shape of this file. The app has always
// computed phase from one date and a nominal 28-day model. That is the FLOOR,
// not the design: somebody who has logged eight periods has told us her actual
// average and how much it varies, and continuing to say "day 17, luteal" from a
// textbook when her own cycles run 31 days would be the app ignoring her in
// favour of an average of strangers.
//
// TWO TIERS, AND THE DIFFERENCE IS VISIBLE. With one date it is an estimate
// from a nominal cycle and says so. With three or more completed cycles it is
// her own average, and says that instead. Nothing in between pretends to be the
// other.
//
// AND A PREDICTION CARRIES ITS OWN SPREAD. Three cycles of 27, 28 and 29 days
// support a date; three of 24, 31 and 38 do not, and must not be drawn as
// though they do. `spread` is how wide her cycles actually are, so a screen can
// show a window rather than a line when a line would be a lie.

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export type CycleEvent = { event_date: string; event_type: string };

/** One completed cycle: a start, the next start, and the days between. */
export type CompletedCycle = { start: string; next: string; length: number };

export type CycleKnowledge = {
  /** Her own average cycle length, or null when there is not enough to average. */
  averageLength: number | null;
  /** Half the spread between her shortest and longest, in days. 0 with one cycle. */
  spread: number;
  /** How many completed cycles that rests on. */
  cycles: number;
  /** The most recent period start, which is what day-of-cycle counts from. */
  lastStart: string | null;
  /** 'nominal' until her own cycles can answer; 'hers' once they can. */
  basis: 'none' | 'nominal' | 'hers';
};

/** Below this, an average is an anecdote. */
const ENOUGH_CYCLES = 3;

/** What the app assumes when it has nothing better. Never presented as hers. */
export const NOMINAL_LENGTH = 28;

/**
 * A cycle that is far too short or far too long is a missed log, not a cycle.
 *
 * Nothing is deleted or corrected - the event stays exactly as she entered it -
 * but an interval of 90 days is a gap in the record, and letting it into an
 * average would quietly wreck every prediction afterwards. The boundaries are
 * wide on purpose: real cycles vary more than most charts admit, and the job
 * here is to exclude obvious gaps, not to decide what a normal cycle is.
 */
const SHORTEST_PLAUSIBLE = 15;
const LONGEST_PLAUSIBLE = 60;

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : NaN;
}

/** Period starts, oldest first, with duplicates on one day counted once. */
export function periodStarts(events: CycleEvent[]): string[] {
  const days = new Set<string>();
  for (const e of events) {
    if (e.event_type !== 'period_start') continue;
    const day = (e.event_date ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) days.add(day);
  }
  return [...days].sort();
}

export function completedCycles(events: CycleEvent[]): CompletedCycle[] {
  const starts = periodStarts(events);
  const out: CompletedCycle[] = [];
  for (let i = 0; i + 1 < starts.length; i += 1) {
    const length = daysBetween(starts[i], starts[i + 1]);
    if (!Number.isFinite(length)) continue;
    if (length < SHORTEST_PLAUSIBLE || length > LONGEST_PLAUSIBLE) continue;
    out.push({ start: starts[i], next: starts[i + 1], length });
  }
  return out;
}

export function knowledgeFrom(events: CycleEvent[]): CycleKnowledge {
  const starts = periodStarts(events);
  const cycles = completedCycles(events);
  const lastStart = starts.length > 0 ? starts[starts.length - 1] : null;

  if (starts.length === 0) {
    return { averageLength: null, spread: 0, cycles: 0, lastStart: null, basis: 'none' };
  }

  if (cycles.length < ENOUGH_CYCLES) {
    // She has told us where she is, not how long she runs.
    return { averageLength: null, spread: 0, cycles: cycles.length, lastStart, basis: 'nominal' };
  }

  const lengths = cycles.map((c) => c.length);
  const average = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const spread = Math.round((Math.max(...lengths) - Math.min(...lengths)) / 2);
  return { averageLength: average, spread, cycles: cycles.length, lastStart, basis: 'hers' };
}

export function phaseForCycleDay(cycleDay: number, length = NOMINAL_LENGTH): CyclePhase {
  if (cycleDay <= 5) return 'menstrual';
  // Ovulation sits about 14 days BEFORE the next period rather than at a fixed
  // day: on a 35-day cycle the follicular phase is what stretches, not the
  // luteal one. Counting back is what makes a longer cycle read correctly.
  const ovulation = Math.max(10, length - 14);
  if (cycleDay < ovulation - 1) return 'follicular';
  if (cycleDay <= ovulation + 1) return 'ovulatory';
  return 'luteal';
}

export function cycleDayOn(lastStart: string, on: string): number | null {
  const diff = daysBetween(lastStart, on);
  return Number.isFinite(diff) && diff >= 0 ? diff + 1 : null;
}

export type Expectation = {
  /** The day her next period would fall on, given what is known. */
  on: string;
  /** Days either side. 0 means a date; anything more means a window. */
  give: number;
  basis: 'nominal' | 'hers';
};

/**
 * When the next period would fall - or null, when saying would be a guess.
 *
 * WITH ONE DATE THIS RETURNS NOTHING, and that is the honest answer rather than
 * a cautious one. A single period start says where she is in a cycle; it says
 * nothing whatever about how long her cycles run, and a date drawn from a
 * textbook average would look exactly as confident as one drawn from her own
 * history. The screen can still show today's phase as an estimate; what it
 * cannot do is point at a day in November.
 */
export function expectedNextPeriod(k: CycleKnowledge): Expectation | null {
  if (!k.lastStart || k.basis !== 'hers' || !k.averageLength) return null;
  const on = new Date(`${k.lastStart}T12:00:00Z`);
  on.setUTCDate(on.getUTCDate() + k.averageLength);
  return { on: on.toISOString().slice(0, 10), give: k.spread, basis: 'hers' };
}

/**
 * What the app may say about today, in words that match what it knows.
 *
 * Every string here is a claim about certainty as much as about biology, which
 * is why they live together rather than being written wherever they are shown.
 */
export function describeToday(k: CycleKnowledge, today: string): string | null {
  if (!k.lastStart) return null;
  const day = cycleDayOn(k.lastStart, today);
  if (day === null) return null;

  const length = k.averageLength ?? NOMINAL_LENGTH;
  const phase = phaseForCycleDay(day, length);

  if (k.basis === 'hers') {
    return `Day ${day}, ${phase}. Based on your own average of ${length} days across ${k.cycles} cycles.`;
  }
  return `Day ${day}, ${phase}. Estimated from a ${NOMINAL_LENGTH}-day cycle, because there is only one period logged so far.`;
}
