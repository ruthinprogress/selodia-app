import { computeCycleDayAndPhase, isWaterRetentionPhase } from '@/lib/cycle';

// Body Measurement Interpretation Layer (SELODIA_SPEC.md, Part Nine). This is the
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
// Time-of-day comparability (Reliability Framework: consistent conditions). Need
// this many prior readings to know a "usual" time; flag when the latest is more
// than this many hours off it; and only trust a usual when prior times are
// concentrated enough (resultant length), so scattered loggers aren't nagged.
const TOD_MIN_HISTORY = 3;
const TOD_TOLERANCE_HOURS = 3;
const TOD_MIN_CONCENTRATION = 0.5;
// DOMS-related swelling peaks 24-48h after eccentric loading and clears by ~72h
// (Reliability Framework).
const DOMS_MIN_HOURS = 24;
const DOMS_MAX_HOURS = 72;
// Salty food holds water on a 12-24h lag (Reliability Framework) — a genuine
// physiological delay, not a convenience window, so the bounds are kept exact.
const SODIUM_LAG_MIN_HOURS = 12;
const SODIUM_LAG_MAX_HOURS = 24;
// Summed sodium (mg) over that window above which the day reads as notably salty
// (daily reference ~2300mg; a single takeaway can reach 2000-3000mg).
const SODIUM_HIGH_MG = 1500;
// Beyond this many days apart, two readings are not a comparable pair. They are
// not a day-to-day fluctuation and they are not a step in a trend - they are two
// separate snapshots with unknown territory in between.
//
// This was missing entirely, and it made the layer state falsehoods on real
// data: Ruth's readings sit 2.6 days apart and were described as "a single day",
// and had she skipped one the comparison would have reached back 37 days and
// said the same. The trend engine had the same blind spot - three readings
// spanning months counted as a trend exactly like three consecutive mornings.
const COMPARABLE_GAP_DAYS = 10;

export type NoiseSource = 'cycle' | 'pump' | 'time_of_day' | 'doms' | 'sodium';
// Each flag carries two forms of the same fact. `reason` is the full
// explanatory clause, used when it is the only thing to say. `short` is a bare
// noun phrase, used when several causes combine - because three physiological
// explanations stacked into one sentence stops sounding like reassurance and
// starts sounding like a defence (see composeCause below).
type NoiseFlag = { source: NoiseSource; reason: string; short: string };

// A logged activity's time and its log-time eccentric-load classification, the
// context both the pump and DOMS flaggers read (pump needs only the time; DOMS
// reads eccentric_load — the real semantic signal from parse-activity, build
// item 27 — replacing the old keyword stopgap).
export type ActivityContext = { happenedAt: string; eccentricLoad: string | null };

// A logged food's time and estimated sodium, for the salty-food flag. sodium_mg
// is null on older rows (captured only from the point sodium logging shipped) and
// on any parse that omitted it — those simply don't count toward the window total.
export type FoodContext = { happenedAt: string; sodiumMg: number | null };
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
// `stepGapsDays[i]` is the gap between weight i and weight i+1. Optional so the
// pure arithmetic stays callable without timestamps, but the composer always
// passes it: without gaps, "three readings in a row" cannot be told apart from
// "three readings across four months".
export function assessTrend(
  weightsNewestFirst: number[],
  stepGapsDays?: (number | null)[]
): TrendVerdict {
  const w = weightsNewestFirst.filter((x) => x != null);
  if (w.length < 3) return 'insufficient';

  // Both steps a trend rests on must span a comparable stretch. A gap that
  // wide is not evidence of a direction, whichever way the numbers point.
  if (stepGapsDays) {
    const spanned = stepGapsDays.slice(0, 2);
    if (spanned.some((g) => g == null || g > COMPARABLE_GAP_DAYS)) return 'insufficient';
  }

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
  const onPeriod = info.cycleDay <= 5;
  const reason = onPeriod
    ? `you're on your period (cycle day ${info.cycleDay}), when water retention is common`
    : `you're in your late-luteal phase (cycle day ${info.cycleDay}), when some water retention is expected`;
  // The short form drops the cycle-day number and the phase name: in a
  // condensed sentence they are precision nobody asked for.
  const short = onPeriod ? "you're on your period" : "you're in the days before your period";
  return { source: 'cycle', reason, short };
}

// Post-workout pump: a reading taken within ~4h after any logged activity carries
// transient water/glycogen inflation (Reliability Framework). `activityTimes` are
// happened_at ISO strings near the reading; only training up to 4h *before* it
// counts (a workout after the reading can't have inflated it).
function pumpFlag(activities: ActivityContext[], measuredAt: string): NoiseFlag | null {
  const measured = new Date(measuredAt).getTime();
  if (isNaN(measured)) return null;
  const windowMs = PUMP_WINDOW_HOURS * 60 * 60 * 1000;
  const trainedRecently = activities.some((a) => {
    const at = new Date(a.happenedAt).getTime();
    if (isNaN(at)) return false;
    const gap = measured - at; // positive when the activity came before the reading
    return gap >= 0 && gap <= windowMs;
  });
  if (!trainedRecently) return null;
  return {
    source: 'pump',
    reason: 'you trained within about four hours before this reading, so a post-workout pump could be nudging it up',
    short: 'you trained not long before weighing in',
  };
}

// The log-time eccentric_load values that carry enough eccentric muscle stress
// to flag (moderate/high). This reads the real semantic classification captured
// by parse-activity at log time (build item 27, per Part Two principle 13) —
// replacing the earlier keyword-list stopgap. Older rows and any session the
// parser couldn't classify are null and simply don't flag (benign: a miss is no
// worse than no flag, and the trend engine outranks this reassurance-only flag).
const ECCENTRIC_LOADS_THAT_FLAG = new Set(['moderate', 'high']);

// An eccentric-loading session 24-72h before the reading carries delayed-onset
// soreness swelling that can inflate it (Reliability Framework).
function domsFlag(activities: ActivityContext[], measuredAt: string): NoiseFlag | null {
  const measured = new Date(measuredAt).getTime();
  if (isNaN(measured)) return null;
  const minMs = DOMS_MIN_HOURS * 60 * 60 * 1000;
  const maxMs = DOMS_MAX_HOURS * 60 * 60 * 1000;
  const trainedHardRecently = activities.some((a) => {
    if (a.eccentricLoad == null || !ECCENTRIC_LOADS_THAT_FLAG.has(a.eccentricLoad)) return false;
    const at = new Date(a.happenedAt).getTime();
    if (isNaN(at)) return false;
    const gap = measured - at; // positive when the activity came before the reading
    return gap >= minMs && gap <= maxMs;
  });
  if (!trainedHardRecently) return null;
  return {
    source: 'doms',
    reason: 'you did a hard session a day or two ago, and delayed muscle soreness can hold a little water in the muscle',
    short: 'you had a hard session a day or two ago',
  };
}

// Salty food holds water on a 12-24h lag: if food logged in that window sums to a
// notably salty total, a flat/up reading here is likely water (Reliability
// Framework). Sodium is an LLM estimate at log time (the principled log-time
// capture, per Part Two principle 13 — not a keyword stopgap), rough like any
// macro estimate but fine for a reassurance-only flag.
function sodiumFlag(recentFoods: FoodContext[], measuredAt: string): NoiseFlag | null {
  const measured = new Date(measuredAt).getTime();
  if (isNaN(measured)) return null;
  const minMs = SODIUM_LAG_MIN_HOURS * 60 * 60 * 1000;
  const maxMs = SODIUM_LAG_MAX_HOURS * 60 * 60 * 1000;
  const windowSodium = recentFoods.reduce((sum, f) => {
    if (f.sodiumMg == null) return sum;
    const at = new Date(f.happenedAt).getTime();
    if (isNaN(at)) return sum;
    const gap = measured - at; // positive when the food came before the reading
    return gap >= minMs && gap <= maxMs ? sum + f.sodiumMg : sum;
  }, 0);
  if (windowSodium < SODIUM_HIGH_MG) return null;
  return {
    source: 'sodium',
    reason: 'you had a fairly salty day yesterday, and sodium can hold on to water for a day or so',
    short: 'yesterday was on the salty side',
  };
}

// Hours-of-day are circular (23:00 and 01:00 are 2h apart), so the "usual" time
// and the distance from it are computed on the unit circle. UTC hours are used
// for both sides: a user's offset is constant, so it cancels out of the
// difference, and it keeps the maths deterministic.
const hourToRad = (h: number): number => (h / 24) * 2 * Math.PI;

function circularHourStats(hours: number[]): { mean: number; concentration: number } {
  const n = hours.length;
  const s = hours.reduce((a, h) => a + Math.sin(hourToRad(h)), 0) / n;
  const c = hours.reduce((a, h) => a + Math.cos(hourToRad(h)), 0) / n;
  let angle = Math.atan2(s, c);
  if (angle < 0) angle += 2 * Math.PI;
  return { mean: (angle / (2 * Math.PI)) * 24, concentration: Math.sqrt(s * s + c * c) };
}

function circularHourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

const hourOfDay = (iso: string): number | null => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.getUTCHours() + d.getUTCMinutes() / 60;
};

// Time-of-day variation: a reading taken well off the user's usual time is less
// comparable, since weight drifts across the day (Reliability Framework). Needs a
// concentrated history to establish a usual; otherwise there's nothing to be
// "off" from.
function timeOfDayFlag(latestMeasuredAt: string, priorMeasuredAts: string[]): NoiseFlag | null {
  const latestHour = hourOfDay(latestMeasuredAt);
  if (latestHour == null) return null;
  const priorHours = priorMeasuredAts
    .map(hourOfDay)
    .filter((h): h is number => h != null);
  if (priorHours.length < TOD_MIN_HISTORY) return null;

  const { mean, concentration } = circularHourStats(priorHours);
  if (concentration < TOD_MIN_CONCENTRATION) return null; // no clear usual time
  if (circularHourDistance(latestHour, mean) <= TOD_TOLERANCE_HOURS) return null;

  return {
    source: 'time_of_day',
    reason: 'this reading was taken a good bit off your usual time of day, and weight naturally drifts through the day',
    short: 'you weighed in off your usual time',
  };
}

// Which cause to lead with when several are present. Ordered by how much of a
// bump each can actually account for: the cycle is systematic and runs for
// days; sodium and DOMS are real but acute; a pump is transient; and time-of-day
// is not an inflator at all, only a reason the reading is less comparable - so
// it goes last and is the first thing dropped.
const FLAG_PRIORITY: NoiseSource[] = ['cycle', 'sodium', 'doms', 'pump', 'time_of_day'];

// At most this many causes are named. Beyond two, a reply stops reading as
// "here's what's going on" and starts reading as a pile-up of excuses - which
// is the opposite of calm, however true each item is. The dropped flags still
// count as flags; they simply are not recited.
const MAX_NAMED_CAUSES = 2;

// One cause, fully explained; or two, condensed to bare phrases. Never a list.
//
// `brief` forces the short form even for a single cause. It is used where the
// flag is a supporting aside rather than the point of the sentence: there, the
// full clause's physiology lecture competes with the actual message instead of
// serving it.
function composeCause(flags: NoiseFlag[], opts?: { brief?: boolean }): string {
  const ranked = [...flags].sort(
    (a, b) => FLAG_PRIORITY.indexOf(a.source) - FLAG_PRIORITY.indexOf(b.source)
  );
  if (ranked.length === 1 && !opts?.brief) return ranked[0].reason;
  const named = ranked.slice(0, MAX_NAMED_CAUSES);
  return named.map((f) => f.short).join(' and ');
}

const capitalizeFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// "since yesterday" / "since your reading 3 days ago". Says the real distance
// rather than implying the readings are consecutive mornings.
function sincePhrase(days: number | null): string {
  if (days == null) return 'since your last reading';
  if (days < 1.5) return 'since yesterday';
  if (days < 6.5) return `since your reading ${Math.round(days)} days ago`;
  if (days < 10.5) return 'since your reading last week';
  return `since your last reading ${Math.round(days)} days ago`;
}

// What the single reading actually is. "A single day" is only true when a day
// is what it spans.
function singleReadingClause(days: number | null): string {
  return days != null && days < 1.5
    ? "that's a single day, not a trend"
    : "that's one reading, not a trend";
}

// --- Composer ----------------------------------------------------------------
export function interpretLatestReading(params: {
  latest: { weightKg: number | null; measuredAt: string };
  priorWeights: number[]; // most-recent-first, excluding the latest reading
  // measured_at for each entry of priorWeights, index-aligned. Aligned rather
  // than reusing priorMeasuredAts because that list keeps readings with no
  // weight, so the two drift apart exactly when someone logs a partial reading.
  priorWeightMeasuredAts?: string[];
  lastPeriodStart: string | null;
  recentActivities?: ActivityContext[]; // activities near the reading (pump + DOMS)
  priorMeasuredAts?: string[]; // measured_at of prior readings, for usual-time
  recentFoods?: FoodContext[]; // foods near the reading, for the sodium flag
}): ReadingInterpretation | null {
  const {
    latest,
    priorWeights,
    priorWeightMeasuredAts = [],
    lastPeriodStart,
    recentActivities = [],
    priorMeasuredAts = [],
    recentFoods = [],
  } = params;

  const flags = [
    cycleFlag(lastPeriodStart, latest.measuredAt),
    pumpFlag(recentActivities, latest.measuredAt),
    timeOfDayFlag(latest.measuredAt, priorMeasuredAts),
    domsFlag(recentActivities, latest.measuredAt),
    sodiumFlag(recentFoods, latest.measuredAt),
  ].filter((f): f is NoiseFlag => f != null);
  const sources = flags.map((f) => f.source);
  const weights = [latest.weightKg, ...priorWeights].filter((w): w is number => w != null);

  // Gaps between consecutive weights, latest first, for both the trend engine
  // and the wording below.
  const stamps = [latest.measuredAt, ...priorWeightMeasuredAts];
  const stepGaps = stamps.slice(0, -1).map((a, i) => {
    const later = new Date(a).getTime();
    const earlier = new Date(stamps[i + 1]).getTime();
    if (isNaN(later) || isNaN(earlier)) return null;
    return (later - earlier) / 86_400_000;
  });
  const gapToPrev = priorWeightMeasuredAts.length ? stepGaps[0] : null;
  const trend = priorWeightMeasuredAts.length ? assessTrend(weights, stepGaps) : assessTrend(weights);

  // A real trend is the actionable signal, and it outranks the noise flags: a run
  // of readings in one direction is more than any single-day inflator.
  if (trend === 'trend_down') {
    return {
      message:
        "Weight's trending down across your last few readings. That's real change settling in, not just a blip.",
      trend,
      sources,
    };
  }
  if (trend === 'trend_up') {
    // The decision that a trend outranks the noise flags has already been made
    // above. The message states it and moves on: walking through an alternative
    // explanation only to overrule it mid-sentence reads as an argument with
    // itself, and leaves the reader unsure which half to believe. So the flags
    // are added as a plain forward-looking fact, never as a rebutted excuse.
    let message =
      "Weight's edged up across your last few readings. That's more than a single-day blip, so it's worth a calm look rather than a shrug or a spiral.";
    if (flags.length > 0) {
      message += ` ${capitalizeFirst(composeCause(flags, { brief: true }))}, so some of this may settle on its own.`;
    }
    return { message, trend, sources };
  }

  // Not a real trend. What is still worth saying depends on WHY, and the three
  // reasons below are genuinely different — collapsing them into one guard is
  // what made this fall silent on Ruth's real data once gaps were respected.
  const prior = priorWeights.find((w) => w != null);
  const phaseOnly = () => ({
    message: `${capitalizeFirst(composeCause(flags))}. If the scale looks flat or up around now, that's usually temporary rather than a real change.`,
    trend,
    sources,
  });

  // (a) Nothing to compare at all — no weight now, or none before it.
  if (latest.weightKg == null || prior == null) {
    if (flags.length === 0) return null;
    return phaseOnly();
  }

  // (b) There IS a previous reading, but it sits too far back to read this one
  // against. Said plainly rather than left as an empty screen: explaining why
  // there is nothing to report is useful in itself, and it is the honest
  // version of the delta this used to state as if the two were consecutive days.
  if (gapToPrev != null && gapToPrev > COMPARABLE_GAP_DAYS) {
    return {
      message: `Your last reading before this was ${Math.round(gapToPrev)} days ago, so there's too much in between to read one against the other. A few more readings and I'll have something real to tell you.`,
      trend,
      sources,
    };
  }

  // (c) Genuinely too little history, with nothing close enough to compare.
  if (trend === 'insufficient' && gapToPrev == null) {
    if (flags.length === 0) return null;
    return phaseOnly();
  }

  // Otherwise there is a usable comparison: either a fluctuation inside a run of
  // readings, or two readings close enough together to speak about even though
  // three would be needed before claiming a direction. Saying "up 0.2 kg since
  // Sunday, which is one reading rather than a trend" is not a direction claim —
  // it explicitly declines to make one — so the sparse-data rule permits it.
  // A genuine drop still needs no caveat; flat or up gets the reassurance.
  const delta = round1(latest.weightKg - prior);
  if (delta < -FLAT_TOLERANCE_KG) return null;
  const change = delta > 0 ? `up ${delta} kg` : 'flat';
  const since = sincePhrase(gapToPrev);
  const message =
    flags.length > 0
      ? `Weight's ${change} ${since}, but ${composeCause(flags)}. A single reading like this is very likely noise, not a setback.`
      : `Weight's ${change} ${since}, but ${singleReadingClause(gapToPrev)}. Nothing to act on.`;
  return { message, trend, sources };
}
