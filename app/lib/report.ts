import type { SupabaseClient } from '@supabase/supabase-js';

// THE REPORT, BUILT FROM BLOCKS (2026-09-20, rebuilt the same evening).
//
// The first version offered whole sections - Symptoms, Food, Activity - and
// Ruth found the fault immediately: "I may want to send my allergy clinician
// only my allergy history, not my knee pain, even though both live under
// Symptoms." Sections are the wrong grain for a document somebody hands to a
// particular person.
//
// A BLOCK IS THREE CHOICES: where it comes from, which of it, and how much
// detail. "Symptoms: these three, in full." "Body: waist only." "Food: daily
// totals for the last month." Every example she gave is one of those, and a
// new data type joins by declaring its own grain rather than by changing this
// shape. Sleep took an afternoon to add to the app; adding it here was a line.
//
// AI SELECTS NOTHING. Her rule, and the right one: "AI should analyse the
// selected data. AI should not decide what data is selected." So every filter
// here is a column that exists - a metric's name, an activity's own words, an
// entry's id - and never a judgement about what a record is about. Where the
// data offers no honest facet (water, sleep) the only choices are the period
// and the detail, because inventing a grouping would be inventing evidence.

export type ReportSource =
  | 'profile'
  | 'goals'
  | 'body'
  | 'metrics'
  | 'symptoms'
  | 'food'
  | 'water'
  | 'sleep'
  | 'activity'
  | 'plans'
  | 'insights'
  | 'cards';

/**
 * One chosen piece of the report.
 *
 * `ids` picks individual records, for the sources whose records have titles
 * and are few: symptoms, insights, plans, summaries. `names` and `types` pick
 * by a value the data already carries - a metric's name, an activity's own
 * words. `detail` is how much of a repetitive source to show.
 */
export type ReportBlock = {
  source: ReportSource;
  ids?: string[];
  names?: string[];
  types?: string[];
  /**
   * How much of a repetitive source to show. 'totals' is the old name for
   * 'daily' and still arrives from a phone that has not updated.
   *
   * WEEKLY AND MONTHLY ARRIVED 21 SEPTEMBER, from her first real use of the
   * builder: "Food Logs needs to have option to have weekly and monthly
   * totals." Thirty rows of days is a log; four rows of weeks is something a
   * clinician reads.
   */
  detail?: 'entries' | 'daily' | 'weekly' | 'monthly' | 'totals';
};

export type ReportSelection = {
  /** ISO dates, inclusive. Null means everything; the blocks that describe now ignore it. */
  from: string | null;
  to: string | null;
  periodLabel: string;
  blocks: ReportBlock[];
  note?: string | null;
  recipient?: string | null;
};

/** A record that can be picked one at a time. */
export type PickableRecord = { id: string; title: string; when: string; detail?: string | null };
/** A value the data carries, offered as a filter. */
export type PickableValue = { value: string; count: number };

/**
 * WHAT SHE CAN CHOOSE FROM, read from her own rows. The builder draws itself
 * from this and nothing else, so a source with nothing in it is not offered,
 * and a filter never lists a value she has never logged.
 */
export type ReportCatalogue = {
  hasProfile: boolean;
  /** The profile facts this person actually has, each pickable on its own. */
  profileFields: PickableValue[];
  goals: number;
  bodyReadings: number;
  metrics: PickableValue[];
  symptoms: PickableRecord[];
  insights: PickableRecord[];
  plans: PickableRecord[];
  cards: PickableRecord[];
  foodDays: number;
  waterDays: number;
  sleepNights: number;
  activityTypes: PickableValue[];
};

const CARD_KINDS = ['me', 'routine', 'self-care routine', 'note', 'protocol'];

/**
 * THE PROFILE IS FIVE SEPARATE FACTS, NOT ONE (Ruth, 21 September 2026): "there
 * needs to be a further granular selection in the Builder with all items listed
 * so user choses: Name, dob, height, etc."
 *
 * It is the blocks argument again, one level further in. A report going to an
 * insurer needs the name and the date of birth; one going to a physiotherapist
 * needs the height and how active the days are, and has no business carrying
 * either. Offering them as a single tick makes that choice for her.
 *
 * The labels ARE the identifiers, so what the chooser lists and what the
 * document prints can never drift apart.
 */
export const PROFILE_FIELDS = [
  'Name',
  'Date of birth',
  'Biological sex',
  'Height',
  'Everyday activity',
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

/**
 * How two names of the same thing are compared. The chooser shows a measure
 * trimmed; the rows may carry whitespace or a different case. One function, so
 * what is offered and what is matched can never drift apart again.
 */
function sameName(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function countValues(rows: { value: string | null }[]): PickableValue[] {
  // GROUPED THE WAY THEY WILL BE MATCHED. "Waist" and "waist" are one measure
  // to the person reading the list, so they are one line in it, counted
  // together - and the spelling shown is the one her rows use most often.
  const groups = new Map<string, { spellings: Map<string, number>; count: number }>();
  for (const r of rows) {
    const shown = (r.value ?? '').trim();
    if (!shown) continue;
    const key = sameName(shown);
    const group = groups.get(key) ?? { spellings: new Map<string, number>(), count: 0 };
    group.spellings.set(shown, (group.spellings.get(shown) ?? 0) + 1);
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({
      value: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: g.count,
    }))
    .sort((a, b) => b.count - a.count);
}

type ProfileRow = {
  first_name: string | null;
  date_of_birth: string | null;
  biological_sex: string | null;
  height_cm: number | null;
  activity_level: string | null;
};

/** Which of the five she has filled in. Nothing empty is ever offered. */
function heldProfileFields(p: ProfileRow | null): ProfileField[] {
  if (!p) return [];
  const has: ProfileField[] = [];
  if (p.first_name?.trim()) has.push('Name');
  if (p.date_of_birth) has.push('Date of birth');
  if (p.biological_sex) has.push('Biological sex');
  if (p.height_cm) has.push('Height');
  if (p.activity_level) has.push('Everyday activity');
  return has;
}

export async function loadCatalogue(db: SupabaseClient, userId: string): Promise<ReportCatalogue> {
  const [profile, goals, body, metrics, entries, food, water, sleep, activity] = await Promise.all([
    db
      .from('user_profile')
      .select('first_name, date_of_birth, biological_sex, height_cm, activity_level', { count: 'exact' })
      .eq('user_id', userId)
      .maybeSingle(),
    db.from('user_context').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('category', 'goal'),
    db.from('body_measurements').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('personal_metrics').select('metric_name').eq('user_id', userId),
    db
      .from('almanac_entries')
      .select('id, kind, title, content, category, created_at, updated_at, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    db.from('food_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('hydration_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('sleep_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('activity_logs').select('activity_type').eq('user_id', userId),
  ]);

  type Entry = {
    id: string;
    kind: string;
    title: string | null;
    content: unknown;
    category: string | null;
    created_at: string;
    updated_at: string | null;
    status: string | null;
  };
  const live = ((entries.data ?? []) as Entry[]).filter((e) => (e.status ?? 'active') === 'active');

  // The first line of an entry, so a list of four symptoms can be told apart
  // without opening any of them.
  const pick = (e: Entry): PickableRecord => {
    const body = readableContent(e.content);
    const firstLine = body.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
    return {
      id: e.id,
      title: e.title?.trim() || 'Untitled',
      when: e.updated_at ?? e.created_at,
      detail: firstLine.length > 90 ? `${firstLine.slice(0, 89).trimEnd()}…` : firstLine || null,
    };
  };

  return {
    hasProfile: Boolean(profile.data),
    // Counted as 0 so the chooser prints the name alone: "Height", not
    // "Height - 1 entry", which would be counting a fact that is not countable.
    profileFields: heldProfileFields((profile.data ?? null) as ProfileRow | null).map((value) => ({ value, count: 0 })),
    goals: goals.count ?? 0,
    bodyReadings: body.count ?? 0,
    metrics: countValues(((metrics.data ?? []) as { metric_name: string | null }[]).map((m) => ({ value: m.metric_name }))),
    symptoms: live.filter((e) => e.kind === 'symptom').map(pick),
    insights: live.filter((e) => e.kind === 'insight').map(pick),
    plans: live.filter((e) => e.kind.includes('plan')).map(pick),
    cards: live.filter((e) => CARD_KINDS.includes(e.kind)).map(pick),
    foodDays: food.count ?? 0,
    waterDays: water.count ?? 0,
    sleepNights: sleep.count ?? 0,
    activityTypes: countValues(
      ((activity.data ?? []) as { activity_type: string | null }[]).map((a) => ({ value: a.activity_type }))
    ),
  };
}

export type ReportData = {
  name: string | null;
  /**
   * THE SUMMARY SHE APPROVED, or null. Written by the model from the selected
   * blocks only, checked for invented figures, and then shown to her to edit
   * or remove before any of this was built - so by the time it arrives here it
   * is her text, whoever first drafted it. See report-summary.ts.
   */
  summary?: string | null;
  /**
   * AT A GLANCE: the figures, counted by the app and printed above the summary
   * in the app's own words. They live here rather than inside the summary
   * because a figure and a sentence about a figure are two different kinds of
   * claim, and only one of them should ever come from a model.
   */
  glance?: string[] | null;
  /**
   * WHO IT IS FOR, in her words on the cover: "Prepared for / Dr Jane Smith".
   * Optional, because a report kept for herself has no recipient and a cover
   * that insists on one would make her invent a name.
   */
  recipient?: string | null;
  /**
   * The short id printed on every page. A document handed across a desk needs
   * something to refer to it by, and the link's own UUID is too long to read
   * aloud - so this is the first eight characters of it, which is the same
   * identifier and quotable.
   */
  reportId?: string | null;
  dateOfBirth: string | null;
  generated: string;
  periodLabel: string;
  note: string | null;
  profile: { label: string; value: string }[];
  goals: string[];
  weights: { at: string; weight: number | null; fat: number | null; muscle: number | null }[];
  metrics: { at: string; name: string; value: string }[];
  /** In full, as she wrote them: her instruction, because it is for a clinician. */
  symptoms: { at: string; title: string; content: string }[];
  /**
   * Food at the grain she chose. `label` is the row's name - a date, a week
   * beginning, a month - and `days` is how many days of the period actually
   * carried an entry, which is the number that says how much weight to put on
   * the rest of the row.
   */
  food: { label: string; kcal: number; protein: number; entries: number; days: number }[];
  /** Which grain `food` is at, so the table can head its first column truthfully. */
  foodGrain: 'daily' | 'weekly' | 'monthly';
  foodEntries: { at: string; what: string; kcal: number | null; protein: number | null }[];
  water: { day: string; ml: number; drinks: number }[];
  sleep: { night: string; minutes: number | null; quality: string | null; awakenings: number | null }[];
  activity: { at: string; what: string; minutes: number | null; intensity: string | null }[];
  /**
   * THE SHAPE OF THE MOVEMENT, rather than a list of it (Ruth, 21 September
   * 2026): "a long list is not helpful, needs to give a sense of the activity
   * profile at a glance."
   *
   * One row per week or month: how many sessions, how many separate days they
   * fell on, how many minutes, and what the minutes were made of. Days matters
   * for the same reason it does in food - four sessions on one day is not four
   * days of movement.
   */
  activityPeriods: {
    label: string;
    sessions: number;
    days: number;
    minutes: number;
    kinds: { what: string; minutes: number; sessions: number }[];
  }[];
  /** Every kind across the whole period, most minutes first. */
  activityKinds: { what: string; minutes: number; sessions: number }[];
  activityGrain: 'weekly' | 'monthly';
  /**
   * DOCUMENTS SHE ATTACHED WHEN SHE BUILT IT (Ruth, 21 September 2026). The app
   * stores no photographs and no files; these are read at build time, printed
   * into an appendix, and exist only inside this report. See
   * report-attachment.ts.
   */
  attachments?: {
    name: string;
    kind: string;
    dated: string | null;
    lines: string[];
    image: { dataUri: string } | null;
    unreadable: string[];
  }[];
  plans: { title: string; content: string }[];
  insights: { at: string; title: string; content: string }[];
  cards: { title: string; kind: string; content: string; updated: string }[];
};

// THE CURRENT GOAL, NOT ITS HISTORY (Ruth, 21 September 2026): "I don't think
// the (updated) from earlier section is needed. should just be current goal."
//
// Two things were wrong and she saw both in one line. A goal is written as a
// new row every time somebody states one, so the report printed a goal from
// August beside the one that replaced it - and the newer row narrated its own
// change: "Goal is to reach 25% body fat and 40kg muscle mass (updated from
// earlier...)". A report states what is true now. Anyone who wants the history
// is asking a different question, and the log answers it.
//
// THE COST, STATED: somebody with two genuine goals written weeks apart keeps
// only the later one. That is the same rule this app already applies to a
// stated weight or a height - the most recent statement is the true one - and
// the alternative is a report that cannot tell a replacement from an addition
// and prints both, which is the bug being fixed.
export function currentGoals(rows: string[]): string[] {
  const newest = rows.map(withoutChangeNote).find((g) => g.length > 0);
  return newest ? [newest] : [];
}

/**
 * Strips a trailing parenthetical that narrates a change rather than stating
 * the goal: "(updated from earlier...)", "(was 30%)".
 *
 * The word boundary in here was, for about a minute, a literal backspace
 * character - the third time on this project that a backslash-b written
 * through a script has landed in a regex as 0x08 rather than as an escape.
 * It is invisible in an editor and the pattern silently stops matching.
 */
export function withoutChangeNote(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/\s*\((?:updated|revised|changed|previously|was)\b[^)]*\)\s*$/i, '')
    .trim();
}

export async function loadReport(
  db: SupabaseClient,
  userId: string,
  sel: ReportSelection
): Promise<ReportData> {
  const block = (source: ReportSource) => sel.blocks.find((b) => b.source === source) ?? null;
  const from = sel.from ?? '1970-01-01';
  const to = sel.to ?? new Date().toISOString().slice(0, 10);
  const fromISO = `${from}T00:00:00.000Z`;
  const toISO = `${to}T23:59:59.999Z`;
  const none = Promise.resolve({ data: [] as unknown[] });

  const profileBlock = block('profile');
  const goalsBlock = block('goals');
  const bodyBlock = block('body');
  const metricsBlock = block('metrics');
  const foodBlock = block('food');
  const waterBlock = block('water');
  const sleepBlock = block('sleep');
  const activityBlock = block('activity');
  const symptomsBlock = block('symptoms');
  const plansBlock = block('plans');
  const insightsBlock = block('insights');
  const cardsBlock = block('cards');
  const wantsEntries = Boolean(symptomsBlock || plansBlock || insightsBlock || cardsBlock);
  // 'totals' is what a phone built before 21 September calls a day.
  const foodGrain: 'daily' | 'weekly' | 'monthly' =
    foodBlock?.detail === 'weekly' ? 'weekly' : foodBlock?.detail === 'monthly' ? 'monthly' : 'daily';
  // Movement has no daily grain: a day is what the session list already shows,
  // and the summary exists precisely to be coarser than that.
  const activityGrain: 'weekly' | 'monthly' = activityBlock?.detail === 'monthly' ? 'monthly' : 'weekly';
  const wantedMetrics = new Set((metricsBlock?.names ?? []).map(sameName));

  const [profileRow, goalRows, bodyRows, metricRows, entryRows, foodRows, waterRows, sleepRows, activityRows] =
    await Promise.all([
      profileBlock
        ? db
            .from('user_profile')
            .select('first_name, date_of_birth, biological_sex, height_cm, activity_level')
            .eq('user_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      goalsBlock
        ? db
            .from('user_context')
            .select('content, updated_at')
            .eq('user_id', userId)
            .eq('category', 'goal')
            .order('updated_at', { ascending: false })
        : none,
      bodyBlock
        ? db
            .from('body_measurements')
            .select('measured_at, weight_kg, body_fat_pct, muscle_kg')
            .eq('user_id', userId)
            .gte('measured_at', fromISO)
            .lte('measured_at', toISO)
            .order('measured_at', { ascending: true })
        : none,
      // ONLY THE MEASURES SHE PICKED. "Waist but not thighs" is a column, not a
      // judgement - personal_metrics has stored the name since it was built.
      metricsBlock
        ? db
            .from('personal_metrics')
            .select('measured_at, metric_name, value, unit')
            .eq('user_id', userId)
            // NOT `.in('metric_name', names)`. The chooser offers each name
            // TRIMMED, because " waist" and "waist" are one measure to a person
            // reading a list - so a row stored with stray whitespace was
            // tickable and then matched nothing, and the block she picked
            // printed empty. Every measure in the period is read and matched
            // here on the same trimmed, case-folded name the chooser showed.
            .gte('measured_at', fromISO)
            .lte('measured_at', toISO)
            .order('measured_at', { ascending: true })
        : none,
      wantsEntries
        ? db
            .from('almanac_entries')
            .select('id, kind, title, content, category, created_at, updated_at, status')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
        : none,
      foodBlock
        ? db
            .from('food_logs')
            .select('happened_at, raw_text, kcal, protein_g')
            .eq('user_id', userId)
            .gte('happened_at', fromISO)
            .lte('happened_at', toISO)
            .order('happened_at', { ascending: true })
        : none,
      waterBlock
        ? db
            .from('hydration_logs')
            .select('happened_at, ml')
            .eq('user_id', userId)
            .gte('happened_at', fromISO)
            .lte('happened_at', toISO)
        : none,
      sleepBlock
        ? db
            .from('sleep_logs')
            .select('night_of, duration_min, quality, awakenings')
            .eq('user_id', userId)
            .gte('night_of', from)
            .lte('night_of', to)
            .order('night_of', { ascending: true })
        : none,
      activityBlock
        ? db
            .from('activity_logs')
            .select('happened_at, activity_type, duration_min, intensity')
            .eq('user_id', userId)
            .gte('happened_at', fromISO)
            .lte('happened_at', toISO)
            .order('happened_at', { ascending: true })
        : none,
    ]);

  const p = (profileRow.data ?? null) as {
    first_name: string | null;
    date_of_birth: string | null;
    biological_sex: string | null;
    height_cm: number | null;
    activity_level: string | null;
  } | null;

  type Entry = {
    id: string;
    kind: string;
    title: string | null;
    content: unknown;
    category: string | null;
    created_at: string;
    updated_at: string | null;
    status: string | null;
  };
  const entries = ((entryRows.data ?? []) as Entry[]).filter((e) => (e.status ?? 'active') === 'active');
  // Picked one at a time, so nothing arrives that she did not tick.
  const chosen = (b: ReportBlock | null) =>
    b ? entries.filter((e) => (b.ids ?? []).includes(e.id)) : [];

  // FIELD BY FIELD, and an empty `names` means every field she has - which is
  // what a phone built before 21 September sends, and what "all of it" means
  // anyway.
  const wantedFields = new Set((profileBlock?.names ?? []).map(sameName));
  const wants = (f: ProfileField) => wantedFields.size === 0 || wantedFields.has(sameName(f));

  const profile: { label: string; value: string }[] = [];
  if (p) {
    if (p.biological_sex && wants('Biological sex')) {
      profile.push({ label: 'Biological sex', value: capital(p.biological_sex) });
    }
    if (p.height_cm && wants('Height')) profile.push({ label: 'Height', value: `${p.height_cm} cm` });
    if (p.activity_level && wants('Everyday activity')) {
      profile.push({ label: 'Everyday activity', value: p.activity_level.replace('_', ' ') });
    }
  }

  const foods = (foodRows.data ?? []) as {
    happened_at: string;
    raw_text: string | null;
    kcal: number | null;
    protein_g: number | null;
  }[];

  // The same folding the chooser groups by, so "Ballet" and "ballet" are one
  // kind here as well as in the list she ticked.
  const activityTypes = new Set((activityBlock?.types ?? []).map(sameName));
  const acts = ((activityRows.data ?? []) as {
    happened_at: string;
    activity_type: string | null;
    duration_min: number | null;
    intensity: string | null;
  }[]).filter((a) => activityTypes.size === 0 || activityTypes.has(sameName(a.activity_type)));

  // One shape for the summary and the table, so a session cannot be counted one
  // way in the chart and another in the list beneath it.
  const sessions = acts.map((a) => ({
    at: a.happened_at,
    what: (a.activity_type ?? 'a session').trim(),
    minutes: a.duration_min,
  }));

  return {
    // NAME AND DATE OF BIRTH LIVE ON THE COVER, and nowhere else - printing
    // them again under "Profile" was the repetition she spotted. They are still
    // hers to withhold: unticked, the cover simply says "Health Summary".
    name: p && wants('Name') ? p.first_name?.trim() || null : null,
    dateOfBirth: p && wants('Date of birth') ? (p.date_of_birth ?? null) : null,
    generated: new Date().toISOString(),
    periodLabel: sel.periodLabel,
    note: sel.note?.trim() || null,
    profile,
    goals: currentGoals(((goalRows.data ?? []) as { content: string }[]).map((g) => g.content)),
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
    }[])
      .filter((m) => wantedMetrics.has(sameName(m.metric_name)))
      .map((m) => ({
        at: m.measured_at,
        name: m.metric_name.trim(),
        value: `${m.value}${m.unit ? ' ' + m.unit : ''}`,
      })),
    // IN FULL, AS SHE WROTE THEM. Her instruction: a clinician reading a
    // symptom needs what was actually noticed, not a trimmed version of it.
    symptoms: chosen(symptomsBlock).map((e) => ({
      at: e.created_at,
      title: e.title?.trim() || 'Noted',
      content: readableContent(e.content),
    })),
    food: foodBlock ? groupFood(foods, foodGrain) : [],
    foodGrain,
    activityPeriods: activityBlock ? groupActivity(sessions, activityGrain) : [],
    activityKinds: activityBlock ? countKinds(sessions) : [],
    activityGrain,
    foodEntries:
      foodBlock?.detail === 'entries'
        ? foods.map((f) => ({
            at: f.happened_at,
            what: (f.raw_text ?? '').trim() || 'an entry',
            kcal: f.kcal,
            protein: f.protein_g,
          }))
        : [],
    water: waterBlock ? perDayWater(waterRows.data ?? []) : [],
    sleep: ((sleepRows.data ?? []) as {
      night_of: string;
      duration_min: number | null;
      quality: string | null;
      awakenings: number | null;
    }[]).map((n) => ({
      night: n.night_of,
      minutes: n.duration_min,
      quality: n.quality,
      awakenings: n.awakenings,
    })),
    activity: acts.map((a) => ({
      at: a.happened_at,
      what: (a.activity_type ?? 'a session').trim(),
      minutes: a.duration_min,
      intensity: a.intensity,
    })),
    plans: chosen(plansBlock).map((e) => ({
      title: e.title?.trim() || 'Plan',
      content: readableContent(e.content),
    })),
    insights: chosen(insightsBlock).map((e) => ({
      at: e.created_at,
      title: e.title?.trim() || 'Noticed',
      content: readableContent(e.content),
    })),
    cards: chosen(cardsBlock).map((e) => ({
      title: e.title?.trim() || 'Untitled',
      kind: e.category?.trim() || e.kind,
      content: readableContent(e.content),
      updated: e.updated_at ?? e.created_at,
    })),
  };
}

const SOURCES: ReportSource[] = [
  'profile',
  'goals',
  'body',
  'metrics',
  'symptoms',
  'food',
  'water',
  'sleep',
  'activity',
  'plans',
  'insights',
  'cards',
];

/** Sources whose blocks mean nothing without a list of chosen records. */
const NEEDS_IDS: ReportSource[] = ['symptoms', 'plans', 'insights', 'cards'];

/**
 * THE GUARD ON WHAT THE PHONE SENDS. The blocks arrive over the wire, so each
 * one is read field by field: an unknown source is dropped, a list of ids is a
 * list of strings or it is nothing, and a block that picks records but picked
 * none is dropped rather than printed as an empty heading. Nothing here trusts
 * the shape it is given.
 *
 * It lives beside the reader rather than in the route because it is the part
 * worth testing: pure, and the only thing standing between a POST body and a
 * query.
 */
export function readBlocks(raw: unknown): ReportBlock[] {
  if (!Array.isArray(raw)) return [];
  const strings = (v: unknown, cap: number): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const list = [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))];
    return list.slice(0, cap);
  };

  return raw
    .map((item) => {
      const b = (item ?? {}) as Record<string, unknown>;
      const source = SOURCES.find((s) => s === b.source);
      if (!source) return null;
      const block: ReportBlock = { source };
      // 500 IS A REAL REPORT, and truncating it silently is not (found in
      // review). The cap exists so one request cannot ask for unbounded work,
      // but it has to sit above any honest selection rather than in the middle
      // of one: a person with 400 symptoms who ticks them all should get 400.
      const ids = strings(b.ids, 1000);
      if (ids) block.ids = ids;
      const names = strings(b.names, 50);
      if (names) block.names = names;
      const types = strings(b.types, 50);
      if (types) block.types = types;
      if (
        b.detail === 'entries' ||
        b.detail === 'daily' ||
        b.detail === 'weekly' ||
        b.detail === 'monthly' ||
        b.detail === 'totals'
      ) {
        block.detail = b.detail;
      }
      return block;
    })
    .filter((b): b is ReportBlock => b !== null)
    .filter((b) => !NEEDS_IDS.includes(b.source) || (b.ids?.length ?? 0) > 0)
    .filter((b) => b.source !== 'metrics' || (b.names?.length ?? 0) > 0)
    .filter((b) => b.source !== 'activity' || (b.types?.length ?? 0) > 0)
    // One block per source: two Symptoms blocks would print the section twice.
    .filter((b, i, all) => all.findIndex((o) => o.source === b.source) === i);
}

// ALMANAC CONTENT IS NOT A STRING (2026-09-20). Every entry's content is
// JSONB: {"summary": ...} for a symptom or insight, {"why": ..., ...} for a Me
// card, a whole programme for a plan. The renderer escapes strings, so handing
// it an object threw and the whole report failed - with her data already read
// and nothing said about why.
//
// So each shape is turned into something a person would want to read, and
// anything unrecognised is listed key by key rather than dropped: a report that
// silently omits part of somebody's record is worse than one that looks plain.
export function readableContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!content || typeof content !== 'object') return '';
  const c = content as Record<string, unknown>;

  const lines: string[] = [];
  const say = (v: unknown): string =>
    typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';

  for (const key of ['summary', 'why', 'goal', 'detail', 'note', 'notes']) {
    const said = say(c[key]);
    if (said) lines.push(said);
  }

  const exercises = Array.isArray(c.exercises) ? c.exercises : null;
  if (exercises) {
    const moves = exercises
      .map((e) => {
        const m = (e ?? {}) as Record<string, unknown>;
        const name = say(m.name);
        if (!name) return '';
        const bits = [
          say(m.sets) ? `${say(m.sets)} sets` : '',
          say(m.reps) ? `${say(m.reps)} reps` : '',
          say(m.note),
        ].filter(Boolean);
        return bits.length > 0 ? `${name} - ${bits.join(', ')}` : name;
      })
      .filter(Boolean);
    if (moves.length > 0) lines.push(moves.map((m) => `• ${m}`).join('\n'));
  }

  if (lines.length === 0) {
    for (const [key, value] of Object.entries(c)) {
      if (key.startsWith('__')) continue;
      const said = say(value);
      if (said) lines.push(`${key.replace(/_/g, ' ')}: ${said}`);
    }
  }

  return lines.join('\n\n').trim();
}

/**
 * The Monday of a day's week, so a weekly row starts where a week starts. ISO
 * dates sort as strings, which is why everything here stays a string.
 */
export function weekBeginning(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (isNaN(d.getTime())) return day;
  // getUTCDay is 0 on Sunday; a week here begins on Monday.
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

type Session = { at: string; what: string; minutes: number | null };

/** Every kind of movement in a set of sessions, most minutes first. */
export function countKinds(rows: Session[]): { what: string; minutes: number; sessions: number }[] {
  const map = new Map<string, { what: string; minutes: number; sessions: number }>();
  for (const r of rows) {
    const what = (r.what ?? '').trim() || 'a session';
    const key = what.toLowerCase();
    const k = map.get(key) ?? { what, minutes: 0, sessions: 0 };
    k.minutes += r.minutes ?? 0;
    k.sessions += 1;
    map.set(key, k);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions);
}

/**
 * Movement gathered into weeks or months, each carrying what it was made of.
 *
 * EVERY PERIOD BETWEEN THE FIRST AND THE LAST APPEARS, including the empty
 * ones. A chart that silently omits a fortnight of nothing draws a steady habit
 * out of a broken one, which is the single most misleading thing this document
 * could do - and the caption says an empty column means nothing was recorded
 * rather than nothing was done.
 */
export function groupActivity(
  rows: Session[],
  grain: 'weekly' | 'monthly'
): {
  label: string;
  sessions: number;
  days: number;
  minutes: number;
  kinds: { what: string; minutes: number; sessions: number }[];
}[] {
  if (rows.length === 0) return [];

  const keyOf = (day: string) => (grain === 'weekly' ? weekBeginning(day) : day.slice(0, 7));
  const buckets = new Map<string, { rows: Session[]; days: Set<string> }>();

  for (const r of rows) {
    const day = r.at.slice(0, 10);
    const key = keyOf(day);
    const b = buckets.get(key) ?? { rows: [], days: new Set<string>() };
    b.rows.push(r);
    b.days.add(day);
    buckets.set(key, b);
  }

  const keys = [...buckets.keys()].sort();
  const filled = everyPeriod(keys[0], keys[keys.length - 1], grain);

  return filled.map((label) => {
    const b = buckets.get(label);
    return {
      label,
      sessions: b?.rows.length ?? 0,
      days: b?.days.size ?? 0,
      minutes: (b?.rows ?? []).reduce((n, r) => n + (r.minutes ?? 0), 0),
      kinds: countKinds(b?.rows ?? []),
    };
  });
}

/** Every week or month from the first to the last, gaps included. */
function everyPeriod(first: string, last: string, grain: 'weekly' | 'monthly'): string[] {
  const out: string[] = [];
  if (grain === 'monthly') {
    let [y, m] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    // A guard on the loop as well as the condition: a malformed label must not
    // spin this forever inside a request.
    for (let n = 0; n < 240 && (y < ly || (y === ly && m <= lm)); n += 1) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }
  const d = new Date(`${first}T12:00:00Z`);
  const end = new Date(`${last}T12:00:00Z`);
  for (let n = 0; n < 520 && d.getTime() <= end.getTime(); n += 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/**
 * Food at a day, a week or a month.
 *
 * `days` IS NOT DECORATION. A week's energy total means one thing across seven
 * logged days and something else entirely across two, and the row that does not
 * say which invites a reader to assume the first. So every grouped row carries
 * how many days of it were logged, and the renderer puts that column next to
 * the figures rather than at the end.
 */
export function groupFood(
  rows: { happened_at: string; kcal: number | null; protein_g: number | null }[],
  grain: 'daily' | 'weekly' | 'monthly'
): { label: string; kcal: number; protein: number; entries: number; days: number }[] {
  const map = new Map<string, { kcal: number; protein: number; entries: number; days: Set<string> }>();
  for (const r of rows) {
    const day = r.happened_at.slice(0, 10);
    const key = grain === 'daily' ? day : grain === 'weekly' ? weekBeginning(day) : day.slice(0, 7);
    const d = map.get(key) ?? { kcal: 0, protein: 0, entries: 0, days: new Set<string>() };
    d.kcal += r.kcal ?? 0;
    d.protein += r.protein_g ?? 0;
    d.entries += 1;
    d.days.add(day);
    map.set(key, d);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([label, d]) => ({
      label,
      kcal: d.kcal,
      protein: d.protein,
      entries: d.entries,
      days: d.days.size,
    }));
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
