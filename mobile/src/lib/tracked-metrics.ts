import { currentUserId } from '@/lib/current-user';
import type { MeasurementRow } from '@/lib/overview-metrics';
import { supabase } from '@/lib/supabase';

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
  /** A name from the app's own set; see METRIC_ICONS. */
  icon: string;
  source: MetricSource;
  /** Set when source is 'scale'. */
  field?: ScaleField;
  /** Set when source is 'personal': the metric_name rows are stored under. */
  name?: string;
  /** Hidden metrics keep their place in the list and draw nowhere. */
  hidden?: boolean;
};

// THE ICONS ARE THE APP'S, NOT A FREE FIELD. Her brief asks for an icon per
// metric; letting somebody type an icon name is a control that fails silently
// when they get it wrong. This is the set a picker offers, and anything else
// falls back to the last one.
//
// Ionicons names rather than a drawn family, and that is a stand-in rather than
// a decision: the app's own line art is the six activity marks and the log
// rows' objects, and five more drawn to match is a real piece of work. Flagged
// to her rather than quietly shipped as finished.
export const METRIC_ICONS = [
  'speedometer-outline',
  'pie-chart-outline',
  'barbell-outline',
  'resize-outline',
  'body-outline',
  'fitness-outline',
  'heart-outline',
  'ellipse-outline',
] as const;

/** The scale's three, as they are labelled when nobody has said otherwise. */
const SCALE_DEFAULTS: TrackedMetric[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', icon: 'speedometer-outline', source: 'scale', field: 'weight_kg' },
  { key: 'body_fat', label: 'Body fat', unit: '%', icon: 'pie-chart-outline', source: 'scale', field: 'body_fat_pct' },
  { key: 'muscle', label: 'Muscle', unit: 'kg', icon: 'barbell-outline', source: 'scale', field: 'muscle_kg' },
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
export function resolveTrackedMetrics(
  stored: TrackedMetric[] | null,
  knownPersonalNames: string[]
): TrackedMetric[] {
  // ONE ENTRY PER NAME, WHATEVER THE CAPITALS. These names are written by the
  // conversation, so "waist" and "Waist" both occur in real data - and two
  // entries for one body part is two half-histories of the same measurement,
  // each missing the other's readings. Deduplicated on the same normalised key
  // that readingsFor matches on, keeping the first spelling seen so the label
  // is the person's own.
  const byKey = new Map<string, string>();
  for (const raw of knownPersonalNames) {
    const name = raw.trim();
    if (!name) continue;
    const key = metricKeyFor(name);
    if (!byKey.has(key)) byKey.set(key, name);
  }

  const personal: TrackedMetric[] = [...byKey.values()].map(
    (name) => ({
      key: metricKeyFor(name),
      label: labelFor(name),
      // The unit is read from the rows themselves at render time; this is only
      // the fallback for a metric with no unit recorded.
      unit: '',
      icon: 'resize-outline',
      source: 'personal' as const,
      name,
    })
  );

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
      icon: typeof m.icon === 'string' ? m.icon : 'resize-outline',
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

/** One reading of one metric, already formatted. */
export type MetricReading = { value: number; text: string; at: string };

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
export function changeLabel(readings: MetricReading[], unit: string): string | null {
  if (readings.length < 2) return null;
  const [latest, previous] = readings;
  const delta = latest.value - previous.value;
  if (delta === 0) return 'no change';
  const sign = delta > 0 ? '+' : '−';
  if (unit === 'cm' || unit === 'in') {
    return `${sign}${round1(Math.abs(delta))} ${unit}`;
  }
  if (previous.value === 0) return null;
  const pct = Math.abs((delta / previous.value) * 100);
  return `${sign}${round1(pct)}%`;
}

// ---- reading and writing her list -------------------------------------
//
// Kept here beside the rules, as log-layout.ts does, so a caller never has to
// know which column it lives in.

export async function loadTrackedMetrics(): Promise<TrackedMetric[] | null> {
  try {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data } = await supabase
      .from('user_profile')
      .select('tracked_metrics')
      .eq('user_id', userId)
      .maybeSingle();
    return readTrackedMetrics((data as { tracked_metrics?: unknown } | null)?.tracked_metrics);
  } catch {
    // Her own arrangement failing to load must never cost her the screen: the
    // derived list is a perfectly good one.
    return null;
  }
}

/** Returns false when nothing was written, so a caller can say so. */
export async function saveTrackedMetrics(list: TrackedMetric[]): Promise<boolean> {
  try {
    const userId = await currentUserId();
    if (!userId) return false;
    const { error } = await supabase
      .from('user_profile')
      .upsert({ user_id: userId, tracked_metrics: list }, { onConflict: 'user_id' });
    if (error) {
      console.log('TRACKED METRICS: could not save -', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
