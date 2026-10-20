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
// IT FLAGS, IT DOES NOT REMOVE (Ruth, 20 October 2026, from daily use):
//
//   "An app that decided what a user can and cannot do is not helpful, it's
//    inflexible. Those things on Rules should be delectable, plus they should
//    be guiding the chat, so they should flag that excersise would not pass
//    theur health Rules and is the user sure they want them added, not just
//    not allow it, thats very annoying"
//
// It used to take the movement out. She asked for a ballet plan, three
// movements were silently dropped for breaking a quad-dominant rule she had set
// herself months earlier, and the only way out was to delete the rule - which
// the Rules screen did not allow. The app had made a decision about her body
// that she could not overrule, in either direction.
//
// WHY THE OLD REASONING WAS WRONG, since it was written down confidently. It
// argued from the allergy gate: a contraindicated movement is an injury risk,
// and a prompt is a request. Both halves are still true. What it missed is that
// a food allergy is a fact about a body and a movement rule is a JUDGEMENT about
// one - made by her, or by a clinician months ago, about a knee that has since
// changed. She is the only person who knows whether it still holds today, and
// the gate was built so that her answer could not reach it.
//
// SO THE PLAN KEEPS EVERYTHING AND SAYS WHAT BREAKS WHAT. A warning she can act
// on beats a removal she cannot, and the informed version of the same caution
// is a sentence naming the rule and asking if she is sure. Nothing is hidden
// either way; the difference is who decides.

export type Rule = {
  id: string;
  // 'technique' is guidance on HOW to do a move - breathe out on the effort,
  // do not bear down. It excludes NOTHING. Added 1 October 2026 after Ruth
  // found "Heavy Valsalva or bearing down" listed as a thing being kept out
  // of her sessions, which is not what she meant by it.
  kind: 'never' | 'always' | 'technique';
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
  /**
   * EVERY exercise, untouched and in order.
   *
   * It is still called `kept` so that a caller which ignores `flagged` saves
   * the whole plan rather than an empty one - the safe direction to fail in,
   * now that the safety is a sentence rather than a deletion.
   */
  kept: PlanExercise[];
  /** What breaks a rule, and which rule it breaks. Nothing is taken out. */
  flagged: { exercise: string; rule: string }[];
};

/**
 * Read a person's rules.
 *
 * UNCONFIRMED RULES ARE INCLUDED. A rule the app has heard and not yet had
 * confirmed is still a rule for the purposes of not hurting somebody. The
 * screen shows it as awaiting confirmation; the generator treats it as live.
 * This is the cautious side of an ambiguous instruction, chosen on purpose.
 */
/**
 * WHICH KIND OF RULE IS THIS, AND IT IS ITS OWN FUNCTION FOR A REASON.
 *
 * This was written inline as `r.kind === 'always' ? 'always' : 'never'`, which
 * meant anything that was not 'always' became an EXCLUSION. When 'technique' was
 * added to the database on 1 October 2026 - so that "breathe through it, do not
 * bear down" could stop being listed as a movement Ruth avoids - that line would
 * have gone on stripping movements out of her sessions regardless, because a
 * technique note is not 'always' either.
 *
 * FAILING CLOSED IS STILL RIGHT. A kind this code has never heard of belongs on
 * the never list: a safety filter that ignores what it cannot read is worse than
 * one that is occasionally over-careful. The change is that the fall is now
 * deliberate and visible, rather than whatever the else-branch happened to be.
 *
 * Exported so it can be tested without a database, which is the other half of
 * why the bug survived: the only way to reach it was through loadRules.
 */
export function normaliseKind(kind: unknown): Rule['kind'] {
  if (kind === 'always') return 'always';
  if (kind === 'technique') return 'technique';
  return 'never';
}

export async function loadRules(supabase: SupabaseClient, userId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('user_rules')
    .select('id, kind, phrase, match_terms, confirmed_at')
    .eq('user_id', userId);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    kind: normaliseKind(r.kind),
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
 * Name anything a never-rule covers. TAKES NOTHING OUT.
 *
 * Checks the exercise name AND its group, because a plan can name a movement
 * innocuously and group it under exactly the thing that is out of bounds -
 * "leg extension" in the group "quads" is the case that matters.
 *
 * The matching is unchanged and deliberately so: it was never the matching that
 * was wrong, it was what happened next. See the header.
 */
export function applyRules(exercises: PlanExercise[], rules: Rule[]): RulesVerdict {
  const never = rules.filter((r) => r.kind === 'never' && r.matchTerms.length > 0);
  if (never.length === 0) return { kept: exercises, flagged: [] };

  const flagged: { exercise: string; rule: string }[] = [];

  for (const exercise of exercises) {
    const haystack = `${exercise.name ?? ''} ${exercise.group ?? ''}`;
    const broken = never.find((rule) => rule.matchTerms.some((term) => mentions(haystack, term)));
    if (broken) {
      flagged.push({ exercise: String(exercise.name ?? 'an exercise'), rule: broken.phrase });
    }
  }

  // Every exercise, including the flagged ones. The plan she asked for is the
  // plan she gets, and the note below tells her what to look at.
  return { kept: exercises, flagged };
}

/**
 * What to say when something in the plan breaks a rule.
 *
 * IT IS IN THE PLAN, AND SHE IS TOLD. The old version of this sentence said a
 * movement "is not in this" - a statement about something she could no longer
 * do anything about. This one names what to look at and leaves the decision
 * where it belongs.
 *
 * IT ENDS BY ASKING, because she asked it to: "is the user sure they want them
 * added". A warning with no way to answer it is the removal again in softer
 * words.
 *
 * NO APOLOGY AND NO ALARM. It is a fact about her plan, not a telling-off.
 */
export function flagNote(flagged: { exercise: string; rule: string }[]): string | null {
  if (flagged.length === 0) return null;
  const rules = [...new Set(flagged.map((r) => r.rule))];
  const names = flagged.map((r) => r.exercise);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const isAre = names.length === 1 ? 'is' : 'are';
  const itThem = names.length === 1 ? 'it' : 'them';
  return (
    `${list} ${isAre} in this plan, and ${isAre} covered by your rule about ` +
    `${rules.join(' and ')}. I have left ${itThem} in - say if you would rather ` +
    `${itThem === 'it' ? 'it came' : 'they came'} out, or change the rule on your Rules tab.`
  );
}

/** The prompt block: layer 1, which asks rather than enforces. */
export function rulesPrompt(rules: Rule[]): string {
  if (rules.length === 0) return '';
  const never = rules.filter((r) => r.kind === 'never');
  const always = rules.filter((r) => r.kind === 'always');
  const lines: string[] = [];
  if (never.length > 0) {
    lines.push(
      `MOVEMENTS THIS PERSON HAS RULED OUT FOR THEMSELVES: ${never
        .map((r) => r.phrase)
        .join('; ')}. Prefer something else wherever something else does the job, and reach for one of these only when it genuinely is the movement the goal needs. WHEN YOU DO INCLUDE ONE, SAY SO IN ONE SENTENCE - name it, name the rule it falls under, and ask whether they still want it. Do not quietly leave it out and do not refuse to build the plan: they set this rule, a knee changes, and they are the only one who knows whether it still holds today. The app says the same thing underneath your reply, so one plain sentence is enough and never a warning box or a lecture.`
    );
  }
  if (always.length > 0) {
    lines.push(
      `Movements that are always fine for them: ${always.map((r) => r.phrase).join('; ')}. This is permission, not an instruction to include them.`
    );
  }
  // HOW TO DO A MOVE, NOT WHETHER TO. Said to the model so a cue can be repeated
  // where it is useful, and worded so it can never be read as a constraint -
  // which is exactly the mistake the database made with Valsalva before there
  // was a kind for it.
  const technique = rules.filter((r) => r.kind === 'technique');
  if (technique.length > 0) {
    lines.push(
      `How they do things, which rules nothing out: ${technique.map((r) => r.phrase).join('; ')}. These are technique cues, not exclusions - never remove a movement because of one, and never list one as something they avoids.`
    );
  }
  return lines.join('\n');
}
