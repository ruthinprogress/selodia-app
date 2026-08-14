import { computeCycleDayAndPhase, isWaterRetentionPhase, type CyclePhase } from '@/lib/cycle';

// Body Measurement Interpretation Layer — cycle-phase slice (UNFLUMP_SPEC.md,
// Part Nine + Part Thirteen). Reads the latest reading through the cycle lens
// built in step 9, so a flat or raised weight during expected water retention is
// read as expected, not a plateau. Deliberately narrow for now: the other noise
// sources (sodium, pump/DOMS, time-of-day) and the cross-source trend engine are
// later slices of item 19. Honours the sparse-data rule (Part Nine): under three
// readings there's no reliable comparison, so it stays context-only and never
// makes a trend claim.

const round1 = (n: number): number => Math.round(n * 10) / 10;
// A drop smaller than this reads as effectively flat rather than a real decrease.
const FLAT_TOLERANCE_KG = 0.1;

export type ReadingInterpretation = {
  message: string;
  phase: CyclePhase;
  cycleDay: number;
};

export function interpretLatestReading(params: {
  latest: { weightKg: number | null; measuredAt: string };
  priorWeights: number[]; // most-recent-first, excluding the latest reading
  readingCount: number;
  lastPeriodStart: string | null;
}): ReadingInterpretation | null {
  const { latest, priorWeights, readingCount, lastPeriodStart } = params;
  if (!lastPeriodStart) return null; // cycle tracking not enabled → nothing to say

  const info = computeCycleDayAndPhase(lastPeriodStart, latest.measuredAt);
  if (!info) return null;
  const { cycleDay, phase } = info;
  // Only speak during the window where a flat/up reading is likely noise. Outside
  // it, there's no cycle caveat to offer, so no card (no dead UI).
  if (!isWaterRetentionPhase(cycleDay)) return null;

  const onPeriod = cycleDay <= 5;

  // Context-only (Part Nine): under three readings, no comparison is reliable, so
  // give phase context and make no claim about direction or trend.
  const prior = priorWeights.find((w) => w != null);
  if (readingCount < 3 || latest.weightKg == null || prior == null) {
    const message = onPeriod
      ? `You're on your period right now (cycle day ${cycleDay}), when bloating and water retention are common — a flat or higher reading around now is often unreliable rather than a real change.`
      : `You're in your late-luteal phase (cycle day ${cycleDay}) — the week or so before your period, when some water retention is expected. If the scale looks flat or up around now, that's usually water, not fat.`;
    return { message, phase, cycleDay };
  }

  // Three or more readings: a single-day reassurance, and only when the reading
  // is flat or up. A genuine drop needs no water caveat.
  const delta = round1(latest.weightKg - prior);
  if (delta < -FLAT_TOLERANCE_KG) return null;
  const change = delta > 0 ? `up ${delta} kg` : 'flat';
  const message = onPeriod
    ? `Weight's ${change} since your last reading — but you're on your period (cycle day ${cycleDay}), when water retention is common. That's very likely water, not a setback.`
    : `Weight's ${change} since your last reading — but you're in your late-luteal phase (cycle day ${cycleDay}), when some water retention is expected. That's within the normal water range around now, not a setback.`;
  return { message, phase, cycleDay };
}
