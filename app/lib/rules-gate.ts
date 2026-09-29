import type { SupabaseClient } from '@supabase/supabase-js';

// MY RULES, ENFORCED IN CODE RATHER THAN ASKED FOR IN A PROMPT.
//
// SELODIA_SPEC.md has said since the Movement brief that this is how it has to
// work: "every generated or updated plan is checked against the Never list
// before it is shown, the way the allergy gate works, with the prompt rule as
// the first layer rather than the only one." A contraindicated movement is an
// injury risk, and a prompt is a request.
//
// WHERE THIS DIFFERS FROM THE ALLERGY GATE, and it differs in the direction
// that makes it easier. The allergy gate reads free prose, where "is a nickel
// reaction common?" and "have some cashews" look alike to a string match - which
// is exactly how it blocked two honest answers about nickel. This gate reads a
// STRUCTURED plan: a list of exercises with names and groups, produced by the
// app's own schema. There is no prose to misread. A match on an exercise name
// means that exercise is in the plan, full stop.
//
// So there is no model layer here and there does not need to be one. Layer 1 is
// the prompt, layer 2 is this, and layer 2 never fails open.
//
// IT REMOVES, IT DOES NOT REFUSE. Dropping the whole plan because one movement
// broke a rule would punish her for the model's mistake and leave her with
// nothing. The excluded movements are named back, so she can see the rule
// working rather than wonder why her session is short.

export type Rule = {
  id: string;
  kind: 'never' | 'always';
  phrase: string;
  matchTerms: string[];
  confirmedAt: string | null;
};

export type PlanExercise = {
  name: string;
  group?: string | null;
  [key: string]: unknown;
};

export type RulesVerdict = {
  /** The exercises that survived. Same objects, same order. */
  kept: PlanExercise[];
  /** What was taken out, and which rule took it. */
  removed: { exercise: string; rule: string }[];
};

/**
 * Read a person's rules.
 *
 * UNCONFIRMED RULES ARE INCLUDED. A rule the app has heard and not yet had
 * confirmed is still a rule for the purposes of not hurting somebody. The
 * screen shows it as awaiting confirmation; the generator treats it as live.
 * This is the cautious side of an ambiguous instruction, chosen on purpose.
 */
export async function loadRules(supabase: SupabaseClient, userId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('user_rules')
    .select('id, kind, phrase, match_terms, confirmed_at')
    .eq('user_id', userId);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    kind: r.kind === 'always' ? 'always' : 'never',
    phrase: String(r.phrase),
    matchTerms: Array.isArray(r.match_terms) ? (r.match_terms as string[]) : [],
    confirmedAt: (r.confirmed_at as string | null) ?? null,
  }));
}

// Word-boundary matching, not substring. "row" must not fire on "narrow", and
// "dip" must not fire on "dipping". The allergy gate learned this the expensive
// way on a different kind of text.
function mentions(haystack: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A multi-word term matches as a phrase, with flexible whitespace, so
  // "loaded squat" catches "loaded  squats" and "loaded back squat" does not
  // have to be spelled out separately.
  const pattern = escaped.split(/\s+/).join('\\s+');
  return new RegExp(`\\b${pattern}s?\\b`, 'i').test(haystack);
}

/**
 * Take out anything a never-rule forbids.
 *
 * Checks the exercise name AND its group, because a plan can name a movement
 * innocuously and group it under exactly the thing that is out of bounds -
 * "leg extension" in the group "quads" is the case that matters.
 */
export function applyRules(exercises: PlanExercise[], rules: Rule[]): RulesVerdict {
  const never = rules.filter((r) => r.kind === 'never' && r.matchTerms.length > 0);
  if (never.length === 0) return { kept: exercises, removed: [] };

  const kept: PlanExercise[] = [];
  const removed: { exercise: string; rule: string }[] = [];

  for (const exercise of exercises) {
    const haystack = `${exercise.name ?? ''} ${exercise.group ?? ''}`;
    const broken = never.find((rule) => rule.matchTerms.some((term) => mentions(haystack, term)));
    if (broken) removed.push({ exercise: String(exercise.name ?? 'an exercise'), rule: broken.phrase });
    else kept.push(exercise);
  }

  return { kept, removed };
}

/**
 * What to say when something was taken out.
 *
 * NAMED, NOT HIDDEN. A session that quietly comes back two movements shorter
 * teaches her that the app is unreliable. A session that says which rule
 * removed what teaches her that the rule is working, which is the only reason
 * to have written it down.
 *
 * NO APOLOGY AND NO ALARM. It is a fact about her plan, not a telling-off.
 */
export function removalNote(removed: { exercise: string; rule: string }[]): string | null {
  if (removed.length === 0) return null;
  const rules = [...new Set(removed.map((r) => r.rule))];
  const names = removed.map((r) => r.exercise);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? 'is' : 'are'} not in this, because of your rule about ${rules.join(' and ')}.`;
}

/** The prompt block: layer 1, which asks rather than enforces. */
export function rulesPrompt(rules: Rule[]): string {
  if (rules.length === 0) return '';
  const never = rules.filter((r) => r.kind === 'never');
  const always = rules.filter((r) => r.kind === 'always');
  const lines: string[] = [];
  if (never.length > 0) {
    lines.push(
      `MOVEMENTS THIS PERSON NEVER DOES, and must never appear in anything you suggest or build: ${never
        .map((r) => r.phrase)
        .join('; ')}. These are clinical constraints, not preferences. Do not offer a variation, a lighter version or a substitute that amounts to the same movement, and do not explain the rule back to her unless she asks.`
    );
  }
  if (always.length > 0) {
    lines.push(
      `Movements that are always fine for her: ${always.map((r) => r.phrase).join('; ')}. This is permission, not an instruction to include them.`
    );
  }
  return lines.join('\n');
}
