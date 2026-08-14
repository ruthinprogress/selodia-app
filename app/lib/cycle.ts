// Server-side mirror of the cycle-phase computation, for ask-unflump's context
// injection (UNFLUMP_SPEC.md, Part Thirteen: every conversation loads cycle
// phase). This deliberately duplicates the phase logic in mobile/src/lib/cycle.ts
// — the Next backend and the Expo client can't share a lib across the runtime
// boundary, the same accepted trade-off as body-metrics.ts mirroring protein.ts.

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

// Whole days from a to b, date-only (time-of-day and DST ignored via UTC midnight).
function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((db - da) / MS_PER_DAY);
}

// Nominal 28-day approximation; individual variation is real, so this is
// "expected" context, never a clinical claim.
export function phaseForCycleDay(cycleDay: number): CyclePhase {
  if (cycleDay <= 5) return 'menstrual';
  if (cycleDay <= 13) return 'follicular';
  if (cycleDay <= 16) return 'ovulatory';
  return 'luteal';
}

export function isWaterRetentionPhase(cycleDay: number): boolean {
  return cycleDay <= 5 || cycleDay >= 22;
}

export function computeCycleDayAndPhase(
  lastPeriodStart: string | Date,
  date: string | Date = new Date()
): { cycleDay: number; phase: CyclePhase } | null {
  const start = new Date(lastPeriodStart);
  const on = new Date(date);
  if (isNaN(start.getTime()) || isNaN(on.getTime())) return null;
  const diff = daysBetween(start, on);
  if (diff < 0) return null;
  return { cycleDay: diff + 1, phase: phaseForCycleDay(diff + 1) };
}

// The cycle-context block injected into ask-unflump's system prompt. Empty string
// when no period has been logged, so the block simply doesn't appear.
export function buildCycleContextPrompt(lastPeriodStart: string | null): string {
  if (!lastPeriodStart) return '';
  const info = computeCycleDayAndPhase(lastPeriodStart);
  if (!info) return '';
  const { cycleDay, phase } = info;
  let block = `Cycle context: today is cycle day ${cycleDay} (${phase} phase).`;
  if (isWaterRetentionPhase(cycleDay)) {
    block +=
      ' Around now, weight or measurement readings that are flat or up can reflect expected water retention rather than fat gain. If they bring up the scale or a measurement, factor this in warmly and without stating it as medical fact; never raise it unprompted.';
  }
  return block;
}
