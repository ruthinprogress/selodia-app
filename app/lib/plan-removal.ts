import type { SupabaseClient } from '@supabase/supabase-js';

import { prepareWorkoutPlan } from './almanac';

// REMOVING A SAVED PLAN BY NAME.
//
// WHY THIS EXISTS AT ALL (Ruth, 25 September 2026). She asked Selodía to delete
// a duplicate thigh workout. It said the job was done. Both copies are still in
// her Almanac, created ten days apart.
//
// The cause was not the model being careless. NOTHING IN THIS CODEBASE DELETED
// AN ALMANAC ENTRY - not a control, not the chat pipeline, not an admin path.
// The tool's correctionKind offered food, activity, measurement and
// personal_metric, so there was no field it could set that meant "remove this
// plan", and nothing between the instruction and the reply to notice. Asked to
// do an impossible thing, it said yes. Ninth instance of an absent thing
// presenting as a working one.
//
// WHY NOT JUST ADD 'plan' TO correctionKind. That machinery finds the most
// recent row of a kind inside a time window, because it exists for fixing
// something just logged - "no, that was 55.2". A plan is named and it is old:
// the one she wanted gone was ten days into her history. Recency is the wrong
// question entirely, so this asks by title instead.
//
// THE DUPLICATE CASE IS THE WHOLE DIFFICULTY, and it is the case she hit. Two
// plans, same title. "Delete the duplicate" means remove one and keep one, and
// getting that backwards loses a plan somebody wrote. So the decision is made
// here, in arithmetic, rather than asked of the model:
//
//   - exactly one match, remove it
//   - several matches whose content is IDENTICAL, remove all but the oldest.
//     The oldest is the original; the later ones are the accident.
//   - several matches whose content DIFFERS, remove nothing and say so. Two
//     plans sharing a name but not their movements are two plans, and picking
//     between them is not a guess worth making on somebody's behalf.

export type PlanRemoval =
  | { done: true; title: string; removed: number; kept: number }
  | { done: false; reason: 'not-found' | 'ambiguous' | 'failed'; title: string };

type Row = { id: string; title: string; content: unknown; created_at: string };

/** Case, spacing and punctuation are not what makes two names different. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The movements, in order, as one comparable string. Null when not a plan. */
function planFingerprint(content: unknown): string | null {
  const plan = prepareWorkoutPlan(content);
  if (!plan || plan.exercises.length === 0) return null;
  return plan.exercises
    .map((e) => `${normalise(String(e.name ?? ''))}|${e.sets ?? ''}|${e.reps ?? ''}`)
    .join('//');
}

export async function removePlanTitled(
  supabase: SupabaseClient,
  userId: string,
  rawTitle: string,
  /**
   * The day the one she means was saved, as yyyy-mm-dd, when two share a title.
   *
   * Ruth, 20 October 2026: "offered to dekete one, then it said it couldn't
   * tell them apart... Some illogical reasoning there putting the work onto the
   * user, not good."
   *
   * The refusal below is right in general - two plans sharing a name but not
   * their movements are two plans, and picking between them loses work. It was
   * useless to her because there was no way to ANSWER it. She knew which one;
   * the app had no field for her to say so. A date is the thing she can
   * actually name, and the plan list she is shown carries one for every plan.
   */
  savedOn?: string | null
): Promise<PlanRemoval> {
  const wanted = normalise(rawTitle);
  if (!wanted) return { done: false, reason: 'not-found', title: rawTitle };

  const { data, error } = await supabase
    .from('almanac_entries')
    .select('id, title, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('PLAN REMOVAL: read failed -', error.message);
    return { done: false, reason: 'failed', title: rawTitle };
  }

  // Only rows that are actually plans. An insight that happens to share a word
  // is not a candidate for deletion.
  const plans = ((data ?? []) as Row[]).filter((r) => planFingerprint(r.content) !== null);

  // An exact name first. Only if nothing matches exactly is a contained name
  // considered, and then only when it picks out one plan - "thigh" must not
  // quietly select whichever of three it reached first.
  let matches = plans.filter((r) => normalise(r.title) === wanted);
  if (matches.length === 0) {
    const loose = plans.filter(
      (r) => normalise(r.title).includes(wanted) || wanted.includes(normalise(r.title))
    );
    if (loose.length === 1) matches = loose;
    else if (loose.length > 1) return { done: false, reason: 'ambiguous', title: rawTitle };
  }

  if (matches.length === 0) return { done: false, reason: 'not-found', title: rawTitle };

  // SHE NAMED THE DAY, SO THE AMBIGUITY IS OVER. Narrowed before the identical-
  // content rule below, because a date is a direct answer and that rule is an
  // inference. If the date picks out exactly one, that is the one she means.
  if (matches.length > 1 && savedOn && /^\d{4}-\d{2}-\d{2}$/.test(savedOn)) {
    const onThatDay = matches.filter((r) => r.created_at.slice(0, 10) === savedOn);
    if (onThatDay.length === 1) matches = onThatDay;
  }

  let doomed: Row[];
  let kept: number;

  if (matches.length === 1) {
    doomed = matches;
    kept = 0;
  } else {
    const prints = matches.map((r) => planFingerprint(r.content));
    const allSame = prints.every((p) => p === prints[0]);
    if (!allSame) return { done: false, reason: 'ambiguous', title: rawTitle };
    // Oldest first from the query, so the original is matches[0].
    doomed = matches.slice(1);
    kept = 1;
  }

  const { error: delError } = await supabase
    .from('almanac_entries')
    .delete()
    .eq('user_id', userId)
    .in('id', doomed.map((r) => r.id));

  if (delError) {
    console.log('PLAN REMOVAL: delete failed -', delError.message);
    return { done: false, reason: 'failed', title: rawTitle };
  }

  return { done: true, title: matches[0].title, removed: doomed.length, kept };
}

/**
 * What the app says afterwards - never the model.
 *
 * Same rule as every other correction: the reply acknowledges, the app states
 * what happened to the data. That separation is the entire reason this bug was
 * possible to have, and it is worth keeping on the side that knows.
 */
export function planRemovalMessage(r: PlanRemoval): string {
  if (r.done) {
    if (r.kept > 0) {
      return `Removed ${r.removed === 1 ? 'the duplicate' : `${r.removed} duplicates`} of "${r.title}". The original is still in your plans.`;
    }
    return `Removed "${r.title}" from your plans.`;
  }
  switch (r.reason) {
    case 'not-found':
      return `I could not find a saved plan called "${r.title}", so nothing has been removed.`;
    case 'ambiguous':
      return `There is more than one plan that could be "${r.title}", and they are not the same, so I have not removed anything. Which one did you mean?`;
    default:
      return `Something went wrong removing "${r.title}", so nothing has changed.`;
  }
}

/**
 * Find the plan a title names, so a save can REPLACE it instead of adding a
 * second copy.
 *
 * Ruth, 20 October 2026, after asking to add three movements to yesterday's
 * ballet plan: "it duplicated instead of added, offered to delete one, then it
 * said it couldn't tell them apart. It was logical to remove them one before
 * the additions... But thete should never have been a duplicate in the first
 * place."
 *
 * WHY THE EXISTING GUARD DID NOT CATCH IT. almanac.ts already refuses to write
 * the same plan twice - same kind, same title, within ten minutes, and the
 * newer content replaces the older. That window is deliberate and its reasoning
 * holds: ten minutes catches a conversation repeating itself, and keeps
 * deliberately saving a fresh version next week as a new entry.
 *
 * It cannot catch an EDIT, because an edit happens whenever she thinks of it.
 * Hers was a day later. There was a route for this - a conversation anchored to
 * a plan saves as an edit of it - but only if she had tapped into that plan
 * first. Naming it in words reached nothing, so the save fell through to the
 * insert and she got two.
 *
 * SO THE MODEL SAYS WHICH PLAN IT IS EDITING, rather than the app inferring it
 * from timing. Timing was the wrong question, exactly as it was for removal:
 * see the note at the top of this file about why recency does not identify a
 * plan. A title does.
 *
 * AMBIGUITY IS REFUSED, NOT GUESSED. Two plans sharing a name is the state this
 * function exists to stop happening again, but it can still be the state it
 * finds - as it is in her account today. Editing one of them at random would
 * overwrite work she wrote. The caller reports it and asks, with the dates.
 */
export async function findPlanToEdit(
  supabase: SupabaseClient,
  userId: string,
  rawTitle: string
): Promise<
  | { found: true; id: string; title: string }
  | { found: false; reason: 'not-found' | 'ambiguous'; candidates: { date: string; movements: number }[] }
> {
  const wanted = normalise(rawTitle);
  if (!wanted) return { found: false, reason: 'not-found', candidates: [] };

  const { data, error } = await supabase
    .from('almanac_entries')
    .select('id, title, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    console.log('PLAN EDIT: read failed -', error.message);
    return { found: false, reason: 'not-found', candidates: [] };
  }

  const plans = ((data ?? []) as Row[]).filter((r) => planFingerprint(r.content) !== null);
  let matches = plans.filter((r) => normalise(r.title) === wanted);
  if (matches.length === 0) {
    const loose = plans.filter(
      (r) => normalise(r.title).includes(wanted) || wanted.includes(normalise(r.title))
    );
    if (loose.length === 1) matches = loose;
    else if (loose.length > 1) matches = loose;
  }

  if (matches.length === 0) return { found: false, reason: 'not-found', candidates: [] };
  if (matches.length === 1) return { found: true, id: matches[0].id, title: matches[0].title };

  return {
    found: false,
    reason: 'ambiguous',
    candidates: matches.map((r) => ({
      date: r.created_at.slice(0, 10),
      movements: prepareWorkoutPlan(r.content)?.exercises.length ?? 0,
    })),
  };
}
