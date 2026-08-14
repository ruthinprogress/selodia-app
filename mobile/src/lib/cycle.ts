// Cycle-tracking foundation (UNFLUMP_SPEC.md, Part Thirteen). Pure, testable
// utilities: the discovery-prompt trigger and the compute-on-read cycle
// day/phase. `cycle_events` (a period_start per logged period) is the single
// source of truth — cycle day is always derived from it, never stored, so a
// retroactively-logged or corrected period start recalculates cleanly rather
// than leaving a stale stamped value behind. Downstream interpretation of
// readings in cycle context is the Body Measurement Interpretation Layer
// (Part Sixteen, Phase 1 step 19) and consumes computeCycleDayAndPhase.

// Trigger: no period logged in roughly 35+ days, or never logged at all.
export const CYCLE_TRIGGER_DAYS = 35;
// Declined invitations go quiet for this long before one gentle re-offer.
export const CYCLE_DISMISS_COOLDOWN_DAYS = 60;

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

// Whole days from a to b, date-only (time-of-day and DST ignored via UTC midnight).
function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((db - da) / MS_PER_DAY);
}

// Phase from cycle day on a nominal 28-day approximation. Individual variation
// is real, so this is "expected" context, never a clinical claim (Part Two).
export function phaseForCycleDay(cycleDay: number): CyclePhase {
  if (cycleDay <= 5) return 'menstrual';
  if (cycleDay <= 13) return 'follicular';
  if (cycleDay <= 16) return 'ovulatory';
  return 'luteal';
}

// Cycle day (day 1 = the period start day) and phase for `date`, derived from
// the most recent period start on or before it. The caller supplies that start
// (e.g. the latest cycle_events.event_date <= date). Null when inputs are
// invalid or the date precedes the start.
export function computeCycleDayAndPhase(
  lastPeriodStart: string | Date,
  date: string | Date = new Date()
): { cycleDay: number; phase: CyclePhase } | null {
  const start = new Date(lastPeriodStart);
  const on = new Date(date);
  if (isNaN(start.getTime()) || isNaN(on.getTime())) return null;
  const diff = daysBetween(start, on);
  if (diff < 0) return null;
  const cycleDay = diff + 1;
  return { cycleDay, phase: phaseForCycleDay(cycleDay) };
}

// Should the discovery/re-offer prompt surface right now? Invitation, never a
// nag: a recent dismissal stays quiet for the cooldown; otherwise it shows when
// nothing has ever been logged or the last period start is 35+ days old.
export function shouldShowDiscoveryPrompt(params: {
  lastPeriodStart: string | Date | null;
  dismissedAt: string | Date | null;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();

  if (params.dismissedAt) {
    const dismissed = new Date(params.dismissedAt);
    if (!isNaN(dismissed.getTime()) && daysBetween(dismissed, now) < CYCLE_DISMISS_COOLDOWN_DAYS) {
      return false;
    }
  }

  if (!params.lastPeriodStart) return true; // never logged → discovery

  const start = new Date(params.lastPeriodStart);
  if (isNaN(start.getTime())) return true;
  return daysBetween(start, now) >= CYCLE_TRIGGER_DAYS; // lapsed → gentle re-offer
}
