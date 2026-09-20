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
// Item 36. Resolving a plan's exercises to their clips is a save-time step
// rather than a render-time one, so the pipeline knows at authoring which
// movements have no demonstration - which is what item 46 needs.
import { resolveDemoRefs } from './movement-demos';

export async function saveAlmanacEntry(
  supabase: SupabaseClient,
  userId: string,
  input: AlmanacSaveInput,
  // The plan this conversation is anchored to, when it is anchored to one.
  // See editsAnchoredPlan: a plan save during a talk ABOUT a plan is an edit
  // of it, not a second copy of it.
  anchoredPlanId?: string | null
): Promise<AlmanacEntry | null> {
  const prepared = prepareAlmanacEntry(input);
  if (!prepared) return null;

  // A plan's exercises get their demo references filled in here, in place,
  // before the row is written. Best-effort by design: if the lookup fails the
  // plan still saves and the player falls back to resolving by name when it
  // renders, so a nice-to-have never costs somebody their programme.
  const plan = looksLikeWorkoutPlan(prepared.content)
    ? (prepared.content as unknown as WorkoutPlanContent)
    : null;
  if (plan) {
    const refs = await resolveDemoRefs(supabase, plan.exercises.map((e) => e.name));
    for (const exercise of plan.exercises) {
      exercise.demoRef = refs.get(exercise.name) ?? null;
    }
  }

  // AN EDIT OF THE PLAN IN FRONT OF HER (2026-09-20). She opened "Inner Thigh
  // Toning Routine", tapped Update this, asked for a change - and got a second
  // "Inner Thigh Toning Routine" in her library, because the only rule here was
  // the ten-minute one below and the plan was ten days old.
  //
  // The conversation already knows which plan it is about: the turn carries its
  // id. So a plan save while anchored to a plan updates THAT ROW, keeping its
  // id and everything recorded against it - the sessions, the working weights.
  if (anchoredPlanId) {
    const { data: anchored } = await supabase
      .from('almanac_entries')
      .select('id, kind, title, content')
      .eq('id', anchoredPlanId)
      .eq('user_id', userId)
      .maybeSingle();
    if (anchored && editsAnchoredPlan(anchored as AnchoredPlan, prepared)) {
      const { data, error } = await supabase
        .from('almanac_entries')
        .update({
          title: prepared.title,
          content: prepared.content,
          category: prepared.category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', anchored.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) {
        console.log('almanac_entries anchored-plan update failed:', error.message);
        return null;
      }
      console.log('ALMANAC: updated the plan the conversation is about -', prepared.title);
      return data as AlmanacEntry;
    }
  }

  // THE SAME ENTRY SAVED AGAIN IS THE SAME ENTRY (2026-09-19). See
  // sameEntryWindow below for the evidence and the rule.
  const since = new Date(Date.now() - SAME_ENTRY_WINDOW_MIN * 60_000).toISOString();
  const { data: recent } = await supabase
    .from('almanac_entries')
    .select('id, kind, title')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  const earlier = findSameEntry(prepared, (recent ?? []) as { id: string; kind: string; title: string }[]);

  if (earlier) {
    // The newer version wins: a plan saved twice in half a minute where the
    // second renames a movement is a correction, and the correction is what she
    // meant. The row keeps its id, so anything already recorded against it -
    // a completion, a working weight - stays attached.
    const { data, error } = await supabase
      .from('almanac_entries')
      .update({
        content: prepared.content,
        category: prepared.category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', earlier.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) {
      console.log('almanac_entries same-entry update failed:', error.message);
      return null;
    }
    console.log('ALMANAC: same entry saved again, updated rather than duplicated -', prepared.title);
    return data as AlmanacEntry;
  }

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

// ONE PLAN SAVED THREE TIMES IS ONE PLAN (2026-09-19).
//
// Ruth's Movement library held "Barbell Bent Over Row - Strength" three times,
// saved within 13 seconds of each other; "Side Splits Stretch Program" twice,
// under a second apart; and "Full-Body Barbell Strength Plan" twice, 32 seconds
// apart, the second renaming one movement. The same failure as the nine
// dinners of 18 September, in a different table: a conversation repeating
// itself, and every repeat written as new.
//
// SO THIS IS AT THE WRITE, like the food guard, because a rule the model is
// asked to follow is not a guard. Same kind, same title (ignoring case and
// punctuation), saved within ten minutes: it is the same entry, and the newer
// content replaces the older rather than sitting beside it.
//
// WHY UPDATE RATHER THAN DROP. The Full-Body pair shows it: the second save was
// a correction, and dropping it would keep the version she had just changed her
// mind about. Keeping the older row's id matters as much, because workouts she
// has done are recorded against it.
//
// Ten minutes is the window the food guard uses, for the same reason: long
// enough to catch a conversation repeating itself, short enough that
// deliberately saving a fresh version next week makes a new entry.
export const SAME_ENTRY_WINDOW_MIN = 10;

const normTitle = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function findSameEntry<T extends { id: string; kind: string; title: string }>(
  incoming: { kind: string; title: string },
  recent: T[]
): T | null {
  const kind = incoming.kind.trim().toLowerCase();
  const title = normTitle(incoming.title);
  if (!title) return null;
  return (
    recent.find((r) => r.kind.trim().toLowerCase() === kind && normTitle(r.title) === title) ?? null
  );
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
  // Item 36. The `join_key` of this movement's demonstration clip, resolved at
  // save time by exact name match, or null when the library has none - which
  // is ordinary rather than a failure. Never guessed: see movement-demos.ts for
  // why a near match is worse than no match.
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

export type AnchoredPlan = { id: string; kind: string; title: string; content: unknown };

/**
 * Is this save a new version of the plan the conversation is anchored to, or a
 * genuinely different plan that happens to be saved during the same talk?
 *
 * TWO WAYS TO BE THE SAME PLAN, because both happen:
 *   - the title matches, which is the ordinary edit;
 *   - the title changed but the movements did not, which is a rename - and a
 *     rename must not leave the old plan behind under its old name.
 *
 * Anything else is a new plan. Somebody who says "and make me a shoulder one
 * too" while looking at their leg plan gets a second plan, which is what they
 * asked for. Pure: scripts/probe-plan-edit.mjs.
 */
export function editsAnchoredPlan(
  anchored: AnchoredPlan,
  incoming: { kind: string; title: string; content: unknown }
): boolean {
  // Only plans. A note or an insight saved mid-conversation is its own thing.
  const planKind = (k: string) => k.trim().toLowerCase().includes('plan');
  if (!planKind(anchored.kind) || !planKind(incoming.kind)) return false;

  if (normTitle(anchored.title) === normTitle(incoming.title)) return true;

  const was = movementNames(anchored.content);
  const now = movementNames(incoming.content);
  if (was.length === 0 || now.length === 0) return false;
  const shared = now.filter((n) => was.includes(n)).length;
  // Half of the new plan's movements, and at least two: one shared squat
  // between two leg plans is not a rename.
  return shared >= 2 && shared / now.length >= 0.5;
}

function movementNames(content: unknown): string[] {
  const exercises = (content as { exercises?: unknown })?.exercises;
  if (!Array.isArray(exercises)) return [];
  return exercises
    .map((e) => normTitle(String((e as { name?: unknown })?.name ?? '')))
    .filter((n) => n.length > 0);
}
