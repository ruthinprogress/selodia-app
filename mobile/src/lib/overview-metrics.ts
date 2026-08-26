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

// How many days separate two readings. Fractional on purpose - the difference
// between 20 hours and 30 hours decides whether "yesterday" is true.
export function gapDays(laterISO: string, earlierISO: string): number | null {
  const later = new Date(laterISO).getTime();
  const earlier = new Date(earlierISO).getTime();
  if (isNaN(later) || isNaN(earlier)) return null;
  return (later - earlier) / 86_400_000;
}

// Says how far back the comparison actually reaches.
//
// This label used to be the constant string "vs last wk", which was simply
// untrue most of the time: findWeekAgoReading returns the nearest earlier
// reading at ANY distance, so with real, gappy logging the reference is
// routinely a few days old - or months. Ruth's live Overview showed
// "+0.2 vs last wk" against a reading 2.6 days earlier.
//
// The fix names the real distance rather than hiding the comparison. Hiding it
// would lose information she can use; mislabelling it tells her something false
// about her own body.
export function comparisonLabel(days: number | null): string {
  if (days == null) return 'vs your last reading';
  if (days < 0.5) return 'vs earlier today';
  if (days < 1.5) return 'vs yesterday';
  if (days < 6.5) return `vs ${Math.round(days)} days ago`;
  if (days < 10.5) return 'vs last wk';
  if (days < 45) return `vs ${Math.round(days / 7)} wks ago`;
  return `vs ${Math.round(days / 30)} mths ago`;
}

// Presentational: "↘ -0.4 vs yesterday" / "↗ +0.2 vs 3 days ago" / null.
// `days` is required rather than optional: an omitted gap is exactly how the
// old wording became a standing falsehood, so there is deliberately no default.
export function formatWeeklyDelta(delta: number | null, days: number | null): string | null {
  if (delta == null) return null;
  const arrow = delta > 0 ? '↗' : delta < 0 ? '↘' : '→';
  const sign = delta > 0 ? '+' : ''; // negatives already carry '-'
  return `${arrow} ${sign}${delta} ${comparisonLabel(days)}`;
}
