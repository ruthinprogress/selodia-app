import type { MeasurementRow } from '@/lib/overview-metrics';

// NOTHING IS IMPORTED HERE THAT NEEDS A BUNDLER. This file decides which
// numbers about somebody's own body appear on a screen, so it has a probe -
// and a probe is plain Node, which knows nothing about the `@/` alias or
// Supabase. Reading and writing the list lives in tracked-metrics-store.ts for
// exactly that reason. The type import above is erased at compile time.

// WHICH MEASUREMENTS SOMEBODY TRACKS, AND WHERE EACH ONE COMES FROM.
//
// Ruth, 25 September 2026, item 11: "Remove hardcoded metrics and the separate
// scale / tape measure sections. The user chooses which metrics they track
// (name, unit, icon, order) once in settings. Every section below renders
// exactly that list, for any number of metrics."
//
// TWO SHAPES UNDERNEATH, ONE LIST ON TOP. Weight, body fat and muscle are
// COLUMNS on body_measurements, because a scale writes all three at once.
// Waist, thighs and anything else are ROWS in personal_metrics, because a tape
// measure writes whatever somebody chose to measure. The old screen rendered
// those as two tables, which is the split she asked to remove - and it could
// only ever show the three metrics the schema happens to have columns for.
//
// Each entry carries its own source, so the screen asks the list rather than
// knowing anything: nothing in the UI names weight, and adding a metric is
// adding an entry rather than adding a column.
//
// THE RULES ARE THE SAME TWO THE LOG'S LAYOUT USES, for the same reasons: an
// entry naming something that no longer exists is ignored rather than drawn
// empty, and a metric she starts recording after she arranged her list appears
// rather than staying invisible. See log-layout-rules.ts.

export type MetricSource = 'scale' | 'personal';

/** The three the scale writes, and the only three that are columns. */
export type ScaleField = 'weight_kg' | 'body_fat_pct' | 'muscle_kg';

export type TrackedMetric = {
  /** Stable across renames, so reordering and hiding survive a relabel. */
  key: string;
  label: string;
  /** "kg", "%", "cm". Empty is allowed - not every count has a unit. */
  unit: string;
  /** Kept for entries saved before icons were derived; unused now. */
  icon?: string;
  source: MetricSource;
  /** Set when source is 'scale'. */
  field?: ScaleField;
  /** Set when source is 'personal': the metric_name rows are stored under. */
  name?: string;
  /** Hidden metrics keep their place in the list and draw nowhere. */
  hidden?: boolean;
};

// THE ICONS ARE THE APP'S OWN, AND THEY ALREADY EXISTED (2026-09-25).
//
// I wrote here, and said to Ruth, that the app had no drawn family for these
// and that Ionicons were a stand-in until somebody drew one. That was wrong.
// components/measurement-icon.tsx holds exactly that family - chest, waist,
// hips, thigh, arm, calf, neck and a plain tape - drawn to the UI brief's
// instruction, "body outline icons for thigh and waist - functional, not
// decorative", and carrying a careful note about saying nothing whatever about
// what a body should look like. It had been orphaned when the old Measurements
// screen was replaced, which is why a search for what was in use did not find
// it.
//
// So these are the marks, and a metric's icon is its NAME resolved through
// measurementIcon() rather than a string somebody picked. That also removes a
// whole class of fault: an icon name cannot be wrong, because it is derived.
//
// The three the scale writes - weight, body fat, muscle - are not tape
// measurements and have no mark in that family. They keep an Ionicon each, and
// that IS a stand-in: three more drawn to match is the outstanding piece of
// work, and it is flagged rather than pretended finished.
export const SCALE_ICONS: Record<ScaleField, string> = {
  weight_kg: 'speedometer-outline',
  body_fat_pct: 'pie-chart-outline',
  muscle_kg: 'barbell-outline',
};

/** The scale's three, as they are labelled when nobody has said otherwise. */
const SCALE_DEFAULTS: TrackedMetric[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', source: 'scale', field: 'weight_kg' },
  { key: 'body_fat', label: 'Body fat', unit: '%', source: 'scale', field: 'body_fat_pct' },
  { key: 'muscle', label: 'Muscle', unit: 'kg', source: 'scale', field: 'muscle_kg' },
];

/** Case, spacing and punctuation are not what makes two metric names different. */
export function metricKeyFor(name: string): string {
  return `personal:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function labelFor(name: string): string {
  const t = name.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * The list to render, from what is stored plus what actually exists.
 *
 * NOBODY IS ASKED TO CONFIGURE ANYTHING BEFORE THEY CAN SEE THEIR OWN NUMBERS.
 * With nothing stored this returns the scale's three followed by every personal
 * metric they have ever recorded, which is exactly what the old screen showed -
 * so the redesign is not a setup step.
 *
 * With a list stored, it is honoured IN ORDER, and anything recorded since is
 * appended rather than dropped. That is the rule that matters most here: a
 * metric she starts measuring tomorrow must appear without her going back to
 * settings, or the settings screen becomes a thing you have to remember.
 */
export type KnownPersonalMetric = { name: string; unit?: string | null };

export function resolveTrackedMetrics(
  stored: TrackedMetric[] | null,
  known: KnownPersonalMetric[]
): TrackedMetric[] {
  // ONE ENTRY PER NAME, WHATEVER THE CAPITALS. These names are written by the
  // conversation, so "waist" and "Waist" both occur in real data - and two
  // entries for one body part is two half-histories of the same measurement,
  // each missing the other's readings. Deduplicated on the same normalised key
  // that readingsFor matches on, keeping the first spelling seen so the label
  // is the person's own.
  const byKey = new Map<string, KnownPersonalMetric>();
  for (const raw of known) {
    const name = raw.name.trim();
    if (!name) continue;
    const key = metricKeyFor(name);
    const held = byKey.get(key);
    // First spelling wins, so the label is the person's own - but a unit from
    // a later row fills a gap left by an earlier one that had none.
    if (!held) byKey.set(key, { name, unit: raw.unit ?? null });
    else if (!held.unit && raw.unit) byKey.set(key, { ...held, unit: raw.unit });
  }

  const personal: TrackedMetric[] = [...byKey.values()].map((m) => ({
    key: metricKeyFor(m.name),
    label: labelFor(m.name),
    // THE UNIT THE ROWS WERE MEASURED IN. It used to be left empty here, with
    // a note that the screen reads it from each row - which is true of the
    // Measurements screen and false of everywhere else. The settings list read
    // the entry and printed "Waist - no unit" beside a Measurements screen
    // saying "79 cm".
    unit: m.unit ?? '',
    source: 'personal' as const,
    name: m.name,
  }));

  if (!stored || stored.length === 0) return [...SCALE_DEFAULTS, ...personal];

  const seen = new Set(stored.map((m) => m.key));
  const appended = [...SCALE_DEFAULTS, ...personal].filter((m) => !seen.has(m.key));
  return [...stored, ...appended];
}

/** What a stored value is allowed to be. Anything else is no list at all. */
export function readTrackedMetrics(value: unknown): TrackedMetric[] | null {
  if (!Array.isArray(value)) return null;
  const out: TrackedMetric[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const m = v as Partial<TrackedMetric>;
    if (typeof m.key !== 'string' || !m.key) continue;
    if (typeof m.label !== 'string' || !m.label) continue;
    if (m.source !== 'scale' && m.source !== 'personal') continue;
    if (m.source === 'scale' && !isScaleField(m.field)) continue;
    if (m.source === 'personal' && (typeof m.name !== 'string' || !m.name)) continue;
    out.push({
      key: m.key,
      label: m.label,
      unit: typeof m.unit === 'string' ? m.unit : '',
      source: m.source,
      field: m.source === 'scale' ? (m.field as ScaleField) : undefined,
      name: m.source === 'personal' ? m.name : undefined,
      hidden: m.hidden === true,
    });
    // A list long enough to be a mistake is a mistake.
    if (out.length >= 40) break;
  }
  return out.length > 0 ? out : null;
}

function isScaleField(v: unknown): v is ScaleField {
  return v === 'weight_kg' || v === 'body_fat_pct' || v === 'muscle_kg';
}

/** One reading of one metric, already formatted, with the unit it was in. */
export type MetricReading = { value: number; text: string; at: string; unit: string };

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** "55.6 kg", "27.4%", "79 cm". The percent sits on its number, as everywhere. */
export function formatMetricValue(value: number, unit: string): string {
  const n = round1(value);
  if (!unit) return String(n);
  return unit === '%' ? `${n}%` : `${n} ${unit}`;
}

export type PersonalRow = {
  metric_name: string;
  value: number | null;
  unit: string | null;
  measured_at: string | null;
  created_at: string;
};

/**
 * Every reading of one metric, newest first, whichever table it lives in.
 *
 * The unit comes from the ROW for a personal metric and from the list for a
 * scale one, because a tape measure's unit is whatever was said at the time
 * and a scale's is fixed by the column.
 */
export function readingsFor(
  metric: TrackedMetric,
  scaleRows: MeasurementRow[],
  personalRows: PersonalRow[]
): MetricReading[] {
  if (metric.source === 'scale') {
    const field = metric.field;
    if (!field) return [];
    return scaleRows
      .filter((r) => typeof r[field] === 'number' && r[field] != null)
      .map((r) => ({
        value: r[field] as number,
        text: formatMetricValue(r[field] as number, metric.unit),
        at: r.measured_at,
        unit: metric.unit,
      }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  const want = (metric.name ?? '').trim().toLowerCase();
  return personalRows
    .filter((p) => p.metric_name.trim().toLowerCase() === want && p.value != null)
    .map((p) => ({
      value: p.value as number,
      text: formatMetricValue(p.value as number, p.unit ?? metric.unit),
      at: p.measured_at ?? p.created_at,
      // THE ROW'S OWN UNIT, not the list's. A tape measurement's unit is
      // whatever was said at the time, and the derived entry for a personal
      // metric carries no unit at all - so asking the list gave "" and a
      // centimetre change came out as a percentage. See changeLabel.
      unit: p.unit ?? metric.unit,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * The change from the previous reading to the latest, as her spec asks:
 * "the change since the previous entry ... No placeholder dashes: if there's
 * no previous entry, show nothing."
 *
 * PERCENT FOR kg AND %, ABSOLUTE FOR cm, which is her rule and a good one. A
 * centimetre is a thing you can picture; 1.8% of a waist is not.
 */
export function changeLabel(readings: MetricReading[], fallbackUnit = ''): string | null {
  if (readings.length < 2) return null;
  const [latest, previous] = readings;
  // THE READING'S UNIT DECIDES, not the list's. A metric derived from what
  // somebody has recorded carries no unit of its own - the unit is on each row
  // - so taking it from the list printed "-0.9%" against a pair of thighs
  // measured in centimetres.
  const unit = latest.unit || fallbackUnit;
  const delta = latest.value - previous.value;
  if (delta === 0) return 'no change';
  const sign = delta > 0 ? '+' : '−';
  if (unit === 'cm' || unit === 'in' || unit === 'mm') {
    return `${sign}${round1(Math.abs(delta))} ${unit}`;
  }
  if (previous.value === 0) return null;
  const pct = Math.abs((delta / previous.value) * 100);
  return `${sign}${round1(pct)}%`;
}
