import type { SupabaseClient } from '@supabase/supabase-js';

// The Almanac write path (build item 15). Mirrors the [REMEMBER] -> user_context
// pattern: the model emits a structured save via the classify tool, and the
// route persists it here. Confirm-first ("Should we save this to your Almanac?")
// is handled at the PROMPT level - the model only emits a save after the person
// has agreed - so this simply persists on emit. Re-confirmation / instance-count
// lifecycle is deferred (this does a clean insert). Everything is coerced so
// malformed model output can never crash a save.

export type AlmanacContent = Record<string, unknown>;

export type AlmanacEntry = {
  id: string;
  kind: string;
  title: string;
  category: string | null;
  content: AlmanacContent;
  status: string;
  instance_count: number;
  last_confirmed_at: string;
  created_at: string;
  updated_at: string;
};

// The raw fields the model emits; all loose so bad output is handled, not thrown.
export type AlmanacSaveInput = {
  kind?: unknown;
  title?: unknown;
  category?: unknown;
  content?: unknown;
};

const trimStr = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

// content must land as a plain JSON object. A model that emits a bare string is
// wrapped as { summary } so nothing is lost; arrays/null/other collapse to {}.
function coerceContent(v: unknown): AlmanacContent {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? { summary: t } : {};
  }
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    return v as AlmanacContent;
  }
  return {};
}

// Validate + coerce a proposed save into insert-ready fields, or null when it
// isn't a real save (kind or title missing). kind stays open text; title is
// required; content becomes a JSON object.
export function prepareAlmanacEntry(input: AlmanacSaveInput): {
  kind: string;
  title: string;
  category: string | null;
  content: AlmanacContent;
} | null {
  const kind = trimStr(input.kind);
  const title = trimStr(input.title);
  if (!kind || !title) return null;
  const content = coerceContent(input.content);
  const category = trimStr(input.category);

  // Plan-shaped content gets the stricter treatment. A plan whose exercises are
  // all unusable is refused outright rather than saved empty — the storage-
  // honesty rule: never confirm a save the person would open to find blank.
  if (looksLikeWorkoutPlan(content)) {
    const plan = prepareWorkoutPlan(content);
    if (!plan) return null;
    return { kind, title, category, content: plan as unknown as AlmanacContent };
  }

  return { kind, title, category, content };
}

// Persist a proposed Almanac save. Returns the stored row, or null when the
// input isn't a real save or the insert fails - so the caller only ever confirms
// a save that actually happened (the storage-honesty rule).
export async function saveAlmanacEntry(
  supabase: SupabaseClient,
  userId: string,
  input: AlmanacSaveInput
): Promise<AlmanacEntry | null> {
  const prepared = prepareAlmanacEntry(input);
  if (!prepared) return null;
  const { data, error } = await supabase
    .from('almanac_entries')
    .insert({ user_id: userId, ...prepared })
    .select()
    .single();
  if (error) {
    console.log('almanac_entries insert failed:', error.message);
    return null;
  }
  return data as AlmanacEntry;
}

// ---------------------------------------------------------------------------
// Workout plans (build item 35, slice A).
//
// A workout plan IS an Almanac entry — its exercises, sets/reps, grouping and
// per-exercise safety notes are the entry's `content`, authored through chat
// like any other Almanac document. Working weights and completions deliberately
// do NOT live here: they are append-only logs (slice B), because a "current
// weight" written into the plan would overwrite exactly the history progressive
// overload depends on.

export type EccentricLoad = 'none' | 'low' | 'moderate' | 'high';
export type PlanIntensity = 'light' | 'moderate' | 'intense';

const ECCENTRIC_LOADS: EccentricLoad[] = ['none', 'low', 'moderate', 'high'];
const PLAN_INTENSITIES: PlanIntensity[] = ['light', 'moderate', 'intense'];

export type PlanExercise = {
  name: string;
  // The grouping key. Its MEANING depends on programType — body area for
  // general strength, the skill for skill-practice, unused for rehab (a flat
  // list) — so the grouping shape follows from the program rather than being
  // hardcoded per layout.
  group: string | null;
  sets: number | null;
  // A string, not a number: real prescriptions are "8-10", "30s" for a plank,
  // "AMRAP", "12 per side". Forcing an integer here would silently discard the
  // part that matters. The cost is parsing later; losing "per side" is worse.
  reps: string | null;
  // Exercise-SPECIFIC failure modes, never generic boilerplate (Part Ten).
  safetyNote: string | null;
  // Classified at authoring, where the movement is already named — the same
  // log-time-classification principle as protein_source (Part Two, principle
  // 13). Stored so a completed exercise can copy it onto its activity_logs row
  // and feed the DOMS flag; without it that row lands null and never fires.
  eccentricLoad: EccentricLoad | null;
  intensity: PlanIntensity | null;
  // Item 36. Null until movement-demo assets exist.
  demoRef: string | null;
};

export type WorkoutPlanContent = {
  // Open text, not an enum (principle 13) — new program types emerge from
  // conversation. The three known values drive grouping; anything else falls
  // back to a plain itemised list, which is a DEFINED default, not undefined
  // behaviour.
  programType: string | null;
  goal: string | null;
  exercises: PlanExercise[];
};

// A plan longer than this is a malformed emit, not a real program.
const MAX_EXERCISES = 60;

function oneOf<T extends string>(v: unknown, allowed: T[]): T | null {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : null;
}

function posInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

// reps may legitimately arrive as a number (8) or a string ("8-10").
function repsStr(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return trimStr(v);
}

// COERCE AND DROP. An exercise survives only if it has a name — everything else
// degrades to null rather than failing the plan. Losing a whole ten-exercise
// program because one entry lacked `sets` would be the worse outcome.
function prepareExercise(v: unknown): PlanExercise | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const name = trimStr(o.name);
  if (!name) return null;
  return {
    name,
    group: trimStr(o.group),
    sets: posInt(o.sets),
    reps: repsStr(o.reps),
    safetyNote: trimStr(o.safetyNote),
    eccentricLoad: oneOf(o.eccentricLoad, ECCENTRIC_LOADS),
    intensity: oneOf(o.intensity, PLAN_INTENSITIES),
    demoRef: trimStr(o.demoRef),
  };
}

// Validate a proposed plan, or null when nothing usable survives — at which
// point the caller must refuse the save outright rather than store an empty
// plan the person would later open to find blank.
export function prepareWorkoutPlan(content: unknown): WorkoutPlanContent | null {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) return null;
  const o = content as Record<string, unknown>;
  if (!Array.isArray(o.exercises)) return null;

  const exercises = o.exercises
    .slice(0, MAX_EXERCISES)
    .map(prepareExercise)
    .filter((e): e is PlanExercise => e !== null);

  if (exercises.length === 0) return null;

  return {
    programType: trimStr(o.programType),
    goal: trimStr(o.goal),
    exercises,
  };
}

// Is this content a workout plan? Decided STRUCTURALLY, by the presence of an
// exercises array, never by matching `kind` against a list of words — kind is
// open text by design, so "routine", "movement plan" and "rehab programme"
// must all get the same treatment without anyone maintaining a keyword list
// (Part Two, principle 13).
export function looksLikeWorkoutPlan(content: AlmanacContent): boolean {
  return Array.isArray((content as Record<string, unknown>).exercises);
}
