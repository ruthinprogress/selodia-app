import type { SupabaseClient } from '@supabase/supabase-js';

// THE REPORT (2026-09-20), from Ruth's brief: "The PDF export should not feel
// like downloading data. It should feel like building a story for a specific
// purpose ... People rarely want everything."
//
// So this is not the data export (lib/data-export.ts on the phone), which is
// the legal right of access and hands over everything in machine form. This is
// a document somebody chooses the contents of, to take to a consultant, a
// physio, a GP or a trainer - and the difference shows in what it contains:
// what Selodía understands, written out, rather than every row it holds.
//
// WHAT IT CAN CONTAIN IS WHAT SHE HAS, and nothing else. The builder on the
// phone asks this file what exists before drawing a single checkbox, so a
// person with no saved plans never sees a Plans section to leave unticked, and
// a section is never invented to make the page look full. Her rule: "If there
// are no medical summaries, hide Medical. No blood results, don't invent one."
//
// HER KNOWLEDGE CARDS ARE CHOSEN ONE BY ONE - "the user chooses individual
// knowledge cards rather than everything" - which is why cards are listed with
// their own ids rather than as a single tick for the whole Almanac.

export type ReportSection =
  | 'profile'
  | 'goals'
  | 'body'
  | 'measurements'
  | 'symptoms'
  | 'food'
  | 'water'
  | 'activity'
  | 'plans'
  | 'insights'
  | 'cards';

export type ReportSelection = {
  /** ISO date, inclusive. Null for the sections that describe now rather than a stretch of time. */
  from: string | null;
  to: string | null;
  /** The label the person chose, written on the cover: "Last 3 months". */
  periodLabel: string;
  sections: ReportSection[];
  /** Almanac card ids, when 'cards' is included. */
  cardIds: string[];
  /** Their own note to whoever reads it. */
  note?: string | null;
};

/** What a person actually has, so the builder can offer only that. */
export type ReportAvailability = {
  section: ReportSection;
  count: number;
};

/** A knowledge card, offered individually. */
export type ReportCard = {
  id: string;
  title: string;
  kind: string;
  category: string | null;
  updated: string;
};

const CARD_KINDS = ['me', 'routine', 'self-care routine', 'note', 'protocol'];

export async function loadAvailability(
  db: SupabaseClient,
  userId: string
): Promise<{ sections: ReportAvailability[]; cards: ReportCard[] }> {
  const count = async (table: string, dateColumn: string | null) => {
    let q = db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (dateColumn) q = q.not(dateColumn, 'is', null);
    const { count: n } = await q;
    return n ?? 0;
  };

  const [profile, goals, body, metrics, food, water, activity, entries] = await Promise.all([
    db.from('user_profile').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('user_context').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('category', 'goal'),
    count('body_measurements', null),
    count('personal_metrics', null),
    count('food_logs', null),
    count('hydration_logs', null),
    count('activity_logs', null),
    db
      .from('almanac_entries')
      .select('id, kind, title, category, updated_at, created_at, status')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ]);

  const rows = (entries.data ?? []) as {
    id: string;
    kind: string;
    title: string | null;
    category: string | null;
    updated_at: string | null;
    created_at: string;
    status: string | null;
  }[];
  const live = rows.filter((r) => (r.status ?? 'active') === 'active');

  const sections: ReportAvailability[] = [
    { section: 'profile', count: profile.count ?? 0 },
    { section: 'goals', count: goals.count ?? 0 },
    { section: 'body', count: body },
    { section: 'measurements', count: metrics },
    { section: 'symptoms', count: live.filter((r) => r.kind === 'symptom').length },
    { section: 'food', count: food },
    { section: 'water', count: water },
    { section: 'activity', count: activity },
    { section: 'plans', count: live.filter((r) => r.kind.includes('plan')).length },
    { section: 'insights', count: live.filter((r) => r.kind === 'insight').length },
    { section: 'cards', count: live.filter((r) => CARD_KINDS.includes(r.kind)).length },
  ];

  const cards: ReportCard[] = live
    .filter((r) => CARD_KINDS.includes(r.kind))
    .map((r) => ({
      id: r.id,
      title: r.title?.trim() || 'Untitled',
      kind: r.kind,
      category: r.category,
      updated: r.updated_at ?? r.created_at,
    }));

  return { sections: sections.filter((s) => s.count > 0), cards };
}

export type ReportData = {
  name: string | null;
  dateOfBirth: string | null;
  generated: string;
  periodLabel: string;
  note: string | null;
  profile: { label: string; value: string }[];
  goals: string[];
  weights: { at: string; weight: number | null; fat: number | null; muscle: number | null }[];
  metrics: { at: string; name: string; value: string }[];
  symptoms: { at: string; title: string; content: string }[];
  food: { day: string; kcal: number; protein: number; entries: number }[];
  water: { day: string; ml: number; drinks: number }[];
  activity: { at: string; what: string; minutes: number | null; intensity: string | null }[];
  plans: { title: string; content: string }[];
  insights: { at: string; title: string; content: string }[];
  cards: { title: string; kind: string; content: string; updated: string }[];
};

export async function loadReport(
  db: SupabaseClient,
  userId: string,
  sel: ReportSelection
): Promise<ReportData> {
  const has = (s: ReportSection) => sel.sections.includes(s);
  const from = sel.from ?? '1970-01-01';
  const to = sel.to ?? new Date().toISOString().slice(0, 10);
  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;

  const [profileRow, goalRows, bodyRows, metricRows, entryRows, foodRows, waterRows, activityRows] =
    await Promise.all([
      has('profile')
        ? db
            .from('user_profile')
            .select('first_name, date_of_birth, biological_sex, height_cm, activity_level')
            .eq('user_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      has('goals')
        ? db.from('user_context').select('content').eq('user_id', userId).eq('category', 'goal')
        : Promise.resolve({ data: [] }),
      has('body')
        ? db
            .from('body_measurements')
            .select('measured_at, weight_kg, body_fat_pct, muscle_kg')
            .eq('user_id', userId)
            .gte('measured_at', fromISO)
            .lte('measured_at', toISO)
            .order('measured_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      has('measurements')
        ? db
            .from('personal_metrics')
            .select('measured_at, metric_name, value, unit')
            .eq('user_id', userId)
            .gte('measured_at', fromISO)
            .lte('measured_at', toISO)
            .order('measured_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      has('symptoms') || has('plans') || has('insights') || has('cards')
        ? db
            .from('almanac_entries')
            .select('id, kind, title, content, category, created_at, updated_at, status')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      has('food')
        ? db
            .from('food_logs')
            .select('happened_at, kcal, protein_g')
            .eq('user_id', userId)
            .gte('happened_at', fromISO)
            .lte('happened_at', toISO)
        : Promise.resolve({ data: [] }),
      has('water')
        ? db
            .from('hydration_logs')
            .select('happened_at, ml')
            .eq('user_id', userId)
            .gte('happened_at', fromISO)
            .lte('happened_at', toISO)
        : Promise.resolve({ data: [] }),
      has('activity')
        ? db
            .from('activity_logs')
            .select('happened_at, activity_type, duration_min, intensity')
            .eq('user_id', userId)
            .gte('happened_at', fromISO)
            .lte('happened_at', toISO)
            .order('happened_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  const p = (profileRow.data ?? null) as {
    first_name: string | null;
    date_of_birth: string | null;
    biological_sex: string | null;
    height_cm: number | null;
    activity_level: string | null;
  } | null;

  const entries = ((entryRows.data ?? []) as {
    id: string;
    kind: string;
    title: string | null;
    content: string | null;
    category: string | null;
    created_at: string;
    updated_at: string | null;
    status: string | null;
  }[]).filter((e) => (e.status ?? 'active') === 'active');

  const profile: { label: string; value: string }[] = [];
  if (p) {
    if (p.date_of_birth) profile.push({ label: 'Date of birth', value: longDate(p.date_of_birth) });
    if (p.biological_sex) profile.push({ label: 'Biological sex', value: capital(p.biological_sex) });
    if (p.height_cm) profile.push({ label: 'Height', value: `${p.height_cm} cm` });
    if (p.activity_level) profile.push({ label: 'Everyday activity', value: p.activity_level.replace('_', ' ') });
  }

  return {
    name: p?.first_name?.trim() || null,
    dateOfBirth: p?.date_of_birth ?? null,
    generated: new Date().toISOString(),
    periodLabel: sel.periodLabel,
    note: sel.note?.trim() || null,
    profile,
    goals: ((goalRows.data ?? []) as { content: string }[]).map((g) => g.content),
    weights: ((bodyRows.data ?? []) as {
      measured_at: string;
      weight_kg: number | null;
      body_fat_pct: number | null;
      muscle_kg: number | null;
    }[]).map((b) => ({ at: b.measured_at, weight: b.weight_kg, fat: b.body_fat_pct, muscle: b.muscle_kg })),
    metrics: ((metricRows.data ?? []) as {
      measured_at: string;
      metric_name: string;
      value: number;
      unit: string | null;
    }[]).map((m) => ({
      at: m.measured_at,
      name: m.metric_name,
      value: `${m.value}${m.unit ? ' ' + m.unit : ''}`,
    })),
    symptoms: has('symptoms')
      ? entries
          .filter((e) => e.kind === 'symptom' && withinDay(e.created_at, from, to))
          .map((e) => ({ at: e.created_at, title: e.title ?? 'Noted', content: e.content ?? '' }))
      : [],
    food: has('food') ? perDayFood(foodRows.data ?? []) : [],
    water: has('water') ? perDayWater(waterRows.data ?? []) : [],
    activity: has('activity')
      ? ((activityRows.data ?? []) as {
          happened_at: string;
          activity_type: string;
          duration_min: number | null;
          intensity: string | null;
        }[]).map((a) => ({
          at: a.happened_at,
          what: a.activity_type,
          minutes: a.duration_min,
          intensity: a.intensity,
        }))
      : [],
    plans: has('plans')
      ? entries
          .filter((e) => e.kind.includes('plan'))
          .map((e) => ({ title: e.title ?? 'Plan', content: e.content ?? '' }))
      : [],
    insights: has('insights')
      ? entries
          .filter((e) => e.kind === 'insight' && withinDay(e.created_at, from, to))
          .map((e) => ({ at: e.created_at, title: e.title ?? 'Noticed', content: e.content ?? '' }))
      : [],
    // CHOSEN ONE BY ONE. Unticked cards are absent, not greyed: the report is
    // what she decided to share, and nothing else.
    cards: has('cards')
      ? entries
          .filter((e) => sel.cardIds.includes(e.id))
          .map((e) => ({
            title: e.title ?? 'Untitled',
            kind: e.category?.trim() || e.kind,
            content: e.content ?? '',
            updated: e.updated_at ?? e.created_at,
          }))
      : [],
  };
}

function withinDay(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

function perDayFood(rows: unknown[]): { day: string; kcal: number; protein: number; entries: number }[] {
  const map = new Map<string, { kcal: number; protein: number; entries: number }>();
  for (const r of rows as { happened_at: string; kcal: number | null; protein_g: number | null }[]) {
    const day = r.happened_at.slice(0, 10);
    const d = map.get(day) ?? { kcal: 0, protein: 0, entries: 0 };
    d.kcal += r.kcal ?? 0;
    d.protein += r.protein_g ?? 0;
    d.entries += 1;
    map.set(day, d);
  }
  return [...map.entries()].sort().map(([day, d]) => ({ day, ...d }));
}

function perDayWater(rows: unknown[]): { day: string; ml: number; drinks: number }[] {
  const map = new Map<string, { ml: number; drinks: number }>();
  for (const r of rows as { happened_at: string; ml: number }[]) {
    const day = r.happened_at.slice(0, 10);
    const d = map.get(day) ?? { ml: 0, drinks: 0 };
    d.ml += r.ml ?? 0;
    d.drinks += 1;
    map.set(day, d);
  }
  return [...map.entries()].sort().map(([day, d]) => ({ day, ...d }));
}

function longDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { longDate, capital };
