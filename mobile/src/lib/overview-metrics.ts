// Pure helpers for the Overview body-summary "vs last wk" deltas (build: the
// Body/Overview segment). Kept out of the panel component so they node-test
// cleanly (no React/RN imports).

export type MeasurementRow = {
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_kg: number | null;
  bmr: number | null;
};

// Given measurement rows (any order) and the latest reading's timestamp, find
// the reading whose time is nearest ~7 days *before* the latest — the reference
// for a "vs last week" delta. Ignores the latest itself and any future rows.
// Returns null when there's no earlier reading to compare against.
export function findWeekAgoReading(
  rows: MeasurementRow[],
  latestMeasuredAt: string
): MeasurementRow | null {
  const latest = new Date(latestMeasuredAt).getTime();
  if (isNaN(latest)) return null;
  const targetMs = latest - 7 * 86_400_000;
  let best: MeasurementRow | null = null;
  let bestDiff = Infinity;
  for (const r of rows) {
    const t = new Date(r.measured_at).getTime();
    if (isNaN(t) || t >= latest) continue; // must be strictly before the latest
    const diff = Math.abs(t - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best;
}

// The signed delta of one metric vs the week-ago reading, or null when either
// side is missing (so the caller shows no delta rather than a fake 0).
export function weeklyDelta(latest: number | null, weekAgo: number | null): number | null {
  if (latest == null || weekAgo == null) return null;
  return Math.round((latest - weekAgo) * 10) / 10;
}

// Presentational: "↘ -0.4 vs last wk" / "↗ +0.2 vs last wk" / null.
export function formatWeeklyDelta(delta: number | null): string | null {
  if (delta == null) return null;
  const arrow = delta > 0 ? '↗' : delta < 0 ? '↘' : '→';
  const sign = delta > 0 ? '+' : ''; // negatives already carry '-'
  return `${arrow} ${sign}${delta} vs last wk`;
}
