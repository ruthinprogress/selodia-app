import { computeCycleDayAndPhase, isWaterRetentionPhase } from '@/lib/cycle';

// Body Measurement Interpretation Layer (UNFLUMP_SPEC.md, Part Nine). This is the
// composition backbone: a set of noise flaggers — each spotting a reason a single
// reading might be inflated — plus a trend engine that separates a single-day
// fluctuation from a genuine multi-reading trend (the Reliability Framework's
// "actual change: weeks-long trend, not single readings"). Cycle phase is the
// first flagger; pump (activity recency) and time-of-day are later slices that
// plug into the same pipeline. Sodium/water retention is deferred until sodium is
// actually captured. Honours the sparse-data rule: under three readings there is
// no reliable comparison, so no direction or trend is ever claimed.

const round1 = (n: number): number => Math.round(n * 10) / 10;
// Moves smaller than this read as flat rather than a real step — both for the
// single-day delta and for counting a direction toward a trend.
const FLAT_TOLERANCE_KG = 0.1;
// A reading taken within this long after training carries a post-workout pump
// (Reliability Framework: "clears within hours").
const PUMP_WINDOW_HOURS = 4;

export type NoiseSource = 'cycle' | 'pump';
type NoiseFlag = { source: NoiseSource; reason: string };
export type TrendVerdict = 'insufficient' | 'single_day' | 'trend_up' | 'trend_down';

export type ReadingInterpretation = {
  message: string;
  trend: TrendVerdict;
  sources: NoiseSource[];
};

// --- Trend engine ------------------------------------------------------------
// A genuine trend is 3+ weight readings moving consistently one way: the two most
// recent consecutive steps agree in direction, beyond the flat tolerance.
// Anything else with 3+ readings is a single-day fluctuation; under three there is
// no reliable comparison (Part Nine).
export function assessTrend(weightsNewestFirst: number[]): TrendVerdict {
  const w = weightsNewestFirst.filter((x) => x != null);
  if (w.length < 3) return 'insufficient';
  const step = (a: number, b: number): 'up' | 'down' | 'flat' => {
    const d = a - b;
    return d > FLAT_TOLERANCE_KG ? 'up' : d < -FLAT_TOLERANCE_KG ? 'down' : 'flat';
  };
  const latestStep = step(w[0], w[1]);
  if (latestStep === 'flat') return 'single_day';
  const priorStep = step(w[1], w[2]);
  if (priorStep === latestStep) return latestStep === 'up' ? 'trend_up' : 'trend_down';
  return 'single_day';
}

// --- Noise flaggers ----------------------------------------------------------
// Each returns a reason clause (lower-case, sentence-embeddable) or null.
function cycleFlag(lastPeriodStart: string | null, measuredAt: string): NoiseFlag | null {
  if (!lastPeriodStart) return null;
  const info = computeCycleDayAndPhase(lastPeriodStart, measuredAt);
  if (!info || !isWaterRetentionPhase(info.cycleDay)) return null;
  const reason =
    info.cycleDay <= 5
      ? `you're on your period (cycle day ${info.cycleDay}), when water retention is common`
      : `you're in your late-luteal phase (cycle day ${info.cycleDay}), when some water retention is expected`;
  return { source: 'cycle', reason };
}

// Post-workout pump: a reading taken within ~4h after any logged activity carries
// transient water/glycogen inflation (Reliability Framework). `activityTimes` are
// happened_at ISO strings near the reading; only training up to 4h *before* it
// counts (a workout after the reading can't have inflated it).
function pumpFlag(activityTimes: string[], measuredAt: string): NoiseFlag | null {
  const measured = new Date(measuredAt).getTime();
  if (isNaN(measured)) return null;
  const windowMs = PUMP_WINDOW_HOURS * 60 * 60 * 1000;
  const trainedRecently = activityTimes.some((t) => {
    const at = new Date(t).getTime();
    if (isNaN(at)) return false;
    const gap = measured - at; // positive when the activity came before the reading
    return gap >= 0 && gap <= windowMs;
  });
  if (!trainedRecently) return null;
  return {
    source: 'pump',
    reason: 'you trained within about four hours before this reading, so a post-workout pump could be nudging it up',
  };
}

function joinReasons(flags: NoiseFlag[]): string {
  const reasons = flags.map((f) => f.reason);
  if (reasons.length <= 1) return reasons[0] ?? '';
  return reasons.slice(0, -1).join('; ') + '; and ' + reasons[reasons.length - 1];
}

const capitalizeFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// --- Composer ----------------------------------------------------------------
export function interpretLatestReading(params: {
  latest: { weightKg: number | null; measuredAt: string };
  priorWeights: number[]; // most-recent-first, excluding the latest reading
  lastPeriodStart: string | null;
  recentActivityTimes?: string[]; // happened_at ISO strings near the reading
}): ReadingInterpretation | null {
  const { latest, priorWeights, lastPeriodStart, recentActivityTimes = [] } = params;

  const flags = [
    cycleFlag(lastPeriodStart, latest.measuredAt),
    pumpFlag(recentActivityTimes, latest.measuredAt),
  ].filter((f): f is NoiseFlag => f != null);
  const sources = flags.map((f) => f.source);
  const weights = [latest.weightKg, ...priorWeights].filter((w): w is number => w != null);
  const trend = assessTrend(weights);

  // A real trend is the actionable signal, and it outranks the noise flags: a run
  // of readings in one direction is more than any single-day inflator.
  if (trend === 'trend_down') {
    return {
      message:
        "Weight's trending down across your last few readings — that's real change settling in, not just a blip.",
      trend,
      sources,
    };
  }
  if (trend === 'trend_up') {
    let message =
      "Weight's edged up across your last few readings — that's more than a single-day blip, so it's worth a calm look rather than a shrug or a spiral.";
    if (flags.length > 0) {
      message += ` (${capitalizeFirst(joinReasons(flags))}, which can hold a little water — but a run of readings like this usually runs deeper than that.)`;
    }
    return { message, trend, sources };
  }

  // Not a real trend. Under three readings there's no reliable comparison, so we
  // only offer phase context when a noise flag is present, never a direction claim.
  const prior = priorWeights.find((w) => w != null);
  if (trend === 'insufficient' || latest.weightKg == null || prior == null) {
    if (flags.length === 0) return null;
    return {
      message: `${capitalizeFirst(joinReasons(flags))}. If the scale looks flat or up around now, that's usually temporary rather than a real change.`,
      trend,
      sources,
    };
  }

  // Single-day fluctuation with a usable weight delta. A genuine drop needs no
  // caveat; a flat or up reading gets reassurance (with the noise reasons if any).
  const delta = round1(latest.weightKg - prior);
  if (delta < -FLAT_TOLERANCE_KG) return null;
  const change = delta > 0 ? `up ${delta} kg` : 'flat';
  const message =
    flags.length > 0
      ? `Weight's ${change} since your last reading — but ${joinReasons(flags)}. A single reading like this is very likely noise, not a setback.`
      : `Weight's ${change} since your last reading, but that's a single day, not a trend — nothing to act on.`;
  return { message, trend, sources };
}
