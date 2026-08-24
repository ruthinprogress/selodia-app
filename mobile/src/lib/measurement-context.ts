import type { ActivityContext, FoodContext } from '@/lib/measurement-interpretation';

// Assembling the interpretation layer's inputs (build item 38, slice 2).
//
// interpretLatestReading() is pure and already built - it has been sitting
// unreachable since 14 August because nothing ever gathered its five inputs.
// This is that gathering step, kept separate from the component so the window
// arithmetic is node-testable without a React renderer or a live database.
//
// Each window is set by the flagger that reads it, not by convenience:
//   - pump  : activity up to 4h before the reading
//   - DOMS  : eccentric loading 24-72h before
//   - sodium: food 12-24h before
// So activities need 72h of history and foods 24h. Querying less would silently
// disable a flagger; querying more just costs rows.
export const ACTIVITY_LOOKBACK_HOURS = 72;
export const FOOD_LOOKBACK_HOURS = 24;

// Enough readings for both consumers: the trend engine needs 3 weights, and the
// time-of-day flagger needs 3 PRIOR timestamps on top of the latest. A few more
// than the minimum so a row with a null weight doesn't starve the trend.
export const READING_HISTORY_LIMIT = 12;

export type RawReading = { measured_at: string; weight_kg: number | null };
export type RawActivity = { happened_at: string; eccentric_load: string | null };
export type RawFood = { happened_at: string; sodium_mg: number | null };

export function hoursBefore(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() - hours * 3_600_000).toISOString();
}

// Split a newest-first reading list into the latest and everything behind it.
// Returns null when there is nothing to interpret at all.
export function splitReadings(rows: RawReading[]): {
  latest: RawReading;
  priorWeights: number[];
  priorMeasuredAts: string[];
} | null {
  const sorted = [...rows]
    .filter((r) => !isNaN(new Date(r.measured_at).getTime()))
    .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());
  const latest = sorted[0];
  if (!latest) return null;
  const prior = sorted.slice(1);
  return {
    latest,
    // Nulls dropped here rather than passed through: the trend engine counts
    // steps between consecutive weights, and a gap would make two readings
    // weeks apart look consecutive.
    priorWeights: prior.map((r) => r.weight_kg).filter((w): w is number => w != null),
    priorMeasuredAts: prior.map((r) => r.measured_at),
  };
}

export function toActivityContexts(rows: RawActivity[]): ActivityContext[] {
  return rows.map((r) => ({ happenedAt: r.happened_at, eccentricLoad: r.eccentric_load }));
}

export function toFoodContexts(rows: RawFood[]): FoodContext[] {
  return rows.map((r) => ({ happenedAt: r.happened_at, sodiumMg: r.sodium_mg }));
}
