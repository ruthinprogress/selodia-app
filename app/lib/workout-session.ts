import type { SupabaseClient } from '@supabase/supabase-js';

import { prepareWorkoutPlan, type PlanExercise } from './almanac';
import { logCompletion } from './workout-logs';

// RECORDING A SAVED ROUTINE BY SAYING SO (Ruth, 2026-09-18).
//
// Her words: "there needs to be a way to just use live voice like 'I did the
// gym workout today but added some box jumps like 3 x 10 and some ballet hip
// strength pulses with leg in second pushing up a medicine ball 2 x 40 each
// side'."
//
// WHY THE ORDINARY ACTIVITY LOG WAS NOT ENOUGH. That sentence already produced
// a row - "gym workout, 45 minutes" - and it was a poor record of what happened.
// It knew nothing about the plan, so the plan's own "last done" stayed stale;
// and it carried no coverage, so the Health Flower learned nothing from an hour
// of training. That gap is on the record already: a quick-tapped workout only
// feeds the flower if its coverage comes from the plan's own exercises, never
// from its title. Going through logCompletion gets all of that for free,
// because it is the same path the Movement screen's Save uses.
//
// THE EXTRAS ARE PART OF THE SESSION, NOT A SECOND SESSION. Box jumps and hip
// pulses belong to the hour she trained; writing them as their own ACTIVITY row
// would double-count the same hour and put an invented duration on movements she
// never timed.
//
// But they are movement, and they are recorded as movement - one completion row
// each, named in her words, inside the same session. Ruth's framing: "there are
// three kinds of information - planned movement completed, planned movement
// adapted, and additional movement not originally in the routine... these should
// become part of today's movement record rather than simply disappearing into
// notes." The review sheet does exactly the same thing with the same table, so
// speaking it and tapping it produce one record, not two shapes of one.

export type ResolvedPlan = {
  id: string;
  title: string;
  exercises: PlanExercise[];
};

// Words that carry meaning in a plan's name, so "the gym workout" can find
// "Full-Body Barbell Strength Plan" only if it genuinely shares something with
// it. Deliberately not a synonym list: this matches what the person said
// against what they named their own plan, and nothing else.
const NAME_NOISE = new Set([
  'the', 'a', 'an', 'my', 'this', 'that', 'plan', 'routine', 'workout', 'session',
  'today', 'day', 'and', 'of', 'for', 'with', 'full', 'body',
]);

export function nameWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2 && !NAME_NOISE.has(w))
  );
}

/**
 * Which saved plan did they mean?
 *
 * Exact title first, then the plan sharing the most distinctive words with what
 * was said. A tie, or nothing in common, resolves to nothing at all: recording
 * the wrong routine is worse than recording none, because the person is then
 * told a session happened that did not.
 */
export function choosePlan<T extends { id: string; title: string }>(
  spoken: string,
  plans: T[]
): T | null {
  if (plans.length === 0) return null;
  const said = spoken.trim().toLowerCase();

  const exact = plans.find((p) => p.title.trim().toLowerCase() === said);
  if (exact) return exact;

  // ONE PLAN AND NO CONTRADICTION. Somebody with a single saved routine who says
  // "I did my workout today" means that one, and asking which would be obtuse.
  const words = nameWords(spoken);
  if (plans.length === 1 && words.size === 0) return plans[0];

  const scored = plans
    .map((p) => {
      const theirs = nameWords(p.title);
      let hits = 0;
      for (const w of words) if (theirs.has(w)) hits++;
      return { plan: p, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].hits === scored[1].hits) return null;
  return scored[0].plan;
}

/** The person's plan-shaped Almanac entries, newest first. */
export async function loadPlans(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedPlan[]> {
  const { data, error } = await supabase
    .from('almanac_entries')
    .select('id, title, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.log('workout-session: plan read failed -', error.message);
    return [];
  }
  return resolvePlans(data);
}

/**
 * The parsing half of loadPlans, for a caller that already has the rows.
 *
 * SPLIT FROM THE READ (2026-09-24), so the rows can arrive with the rest of a
 * turn's context in a single round trip instead of a query of their own. Same
 * rule as loadDayStateRows: the fetching moves, the logic does not.
 */
export function resolvePlans(rows: unknown): ResolvedPlan[] {
  const out: ResolvedPlan[] = [];
  for (const row of (rows ?? []) as { id: string; title: string; content: unknown }[]) {
    const plan = prepareWorkoutPlan(row.content);
    if (plan && plan.exercises.length > 0) {
      out.push({ id: row.id, title: row.title, exercises: plan.exercises });
    }
  }
  return out;
}

/**
 * Has this routine already been written down today?
 *
 * THE SAME LESSON AS THE FOOD DUPLICATES, LEARNED THE SAME DAY. A voice call
 * asks the model the same question every time she pauses, and a model asked not
 * to repeat itself sometimes does. So the second attempt is refused here, in
 * arithmetic, rather than requested in a prompt.
 */
export async function loggedToday(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  today: string
): Promise<boolean> {
  const { data } = await supabase
    .from('workout_completion_log')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('session_date', today)
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * Write the session: one completion per movement done, all carrying the same
 * note. Returns how many movements were recorded, or null when the routine was
 * already recorded today.
 */
export async function recordPlanSession(
  supabase: SupabaseClient,
  userId: string,
  plan: ResolvedPlan,
  opts: { skipped?: string[]; additional?: string[]; note?: string | null; today: string }
): Promise<number | null> {
  if (await loggedToday(supabase, userId, plan.id, opts.today)) {
    console.log('WORKOUT SESSION: already recorded today, leaving it alone -', plan.title);
    return null;
  }

  const skipped = new Set((opts.skipped ?? []).map((s) => s.trim().toLowerCase()));
  const done = plan.exercises.filter((x) => !skipped.has(x.name.trim().toLowerCase()));

  let logged = 0;
  for (const x of done) {
    const ok = await logCompletion(supabase, userId, {
      planId: plan.id,
      planTitle: plan.title,
      exerciseName: x.name,
      eccentricLoad: x.eccentricLoad ?? null,
      intensity: x.intensity ?? null,
      note: opts.note ?? null,
    });
    if (ok) logged++;
  }

  // Unrated on purpose: the plan's movements were classified when it was
  // written, and nothing has classified these. Guessing an eccentric load from
  // the words "box jumps" would put an invention into the signal that decides
  // whether somebody is warned about soreness.
  for (const name of (opts.additional ?? []).slice(0, 8)) {
    const clean = name.trim();
    if (clean.length < 3) continue;
    const ok = await logCompletion(supabase, userId, {
      planId: plan.id,
      planTitle: plan.title,
      exerciseName: clean,
      eccentricLoad: null,
      intensity: null,
      note: opts.note ?? null,
    });
    if (ok) logged++;
  }
  return logged;
}

/**
 * What the reply may truthfully say, given what actually happened.
 *
 * HOW MUCH MOVEMENT, NEVER HOW MUCH OF THE PLAN. The plan's own length is left
 * out deliberately (Ruth, 2026-09-18): "please don't use wording like '4 of 6
 * completed' or '67% complete' or anything that compares the user against the
 * original routine. The routine is simply a guide."
 */
export function sessionSummary(plan: ResolvedPlan, logged: number, skipped: string[]): string {
  const movements = `${logged} movement${logged === 1 ? '' : 's'} recorded`;
  const tail = skipped.length > 0 ? `, ${skipped.length} skipped` : '';
  return `${plan.title}: ${movements}${tail}`;
}
