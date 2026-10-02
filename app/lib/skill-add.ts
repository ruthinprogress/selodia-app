import type { SupabaseClient } from '@supabase/supabase-js';

import { LADDERS, placeRungs, type Ladder } from './skill-ladders';

// ADDING A SKILL FROM CHAT, WITH ONLY THE LADDERS SOMEBODY WROTE.
//
// WHAT WENT WRONG, and it is the reason Skills exists as a brief at all. Ruth
// told chat "I want to learn to pull up to muscle up". Chat answered that her
// Park / calisthenics slot already covered it, and after she said "Ok" it said
// "It's already sitting there in your week." Nothing was added. The Skills tab
// still said "No skills yet" and invited her to say what she wanted to learn,
// which led nowhere.
//
// TWO FAULTS IN ONE EXCHANGE. Chat had no way to add a skill - the server did
// not import the ladders, read user_skills or write to it, so the only honest
// answer available to it was a deflection. And it treated her WEEK (when she
// trains) and her SKILLS (what she wants to become able to do) as the same
// thing, which is the same conflation as the Me-tab-versus-Week mistake of that
// morning. A session in her week is a slot; a muscle up is a destination; one
// does not contain the other.
//
// THE LADDER IS NEVER INVENTED. Ruth, Skills brief item 7: "No invented ladders.
// For a skill with no curated ladder, save a plain skill and TELL HER SO. She can
// describe the steps herself." A model asked to produce a progression will
// produce a confident one every time, and a wrong progression for a bar skill is
// an injury rather than a bad paragraph. So this matches what she said against
// the curated library and nothing else; a miss is reported, not filled in.
//
// NOTHING HERE DECIDES WHETHER TO WRITE. It is called after she has said yes to
// an offer the app stored - see pending-save.ts. The model observes; the app
// decides; this writes.

export type SkillAddOutcome =
  | { kind: 'added'; name: string; ladder: true; rungs: number }
  /** Saved, but with no steps, because nobody has written that ladder yet. */
  | { kind: 'added'; name: string; ladder: false; rungs: 0 }
  | { kind: 'already'; name: string }
  | { kind: 'failed' };

/**
 * The words that mean a curated ladder.
 *
 * SPELLINGS, NOT SYNONYMS. Every entry here is a way of writing the same
 * movement - "muscle-up", "muscle up", "muscleup" - or the name of a rung that
 * only one ladder owns. Nothing is a judgement about what she probably meant:
 * "I want to get stronger" matches nothing, and must, because picking a ladder
 * for that would be the app deciding her goal for her.
 */
const ALIASES: { ladder: string; words: string[] }[] = [
  { ladder: 'muscle_up', words: ['muscle up', 'muscle-up', 'muscleup', 'muscle ups', 'bar muscle up'] },
  {
    ladder: 'strict_pull_up',
    words: ['pull up', 'pull-up', 'pullup', 'pull ups', 'strict pull up', 'chin up', 'chin-up'],
  },
  { ladder: 'handstand', words: ['handstand', 'hand stand', 'handstands', 'hand balance'] },
  { ladder: 'splits', words: ['splits', 'split', 'front split', 'middle split', 'box splits'] },
  { ladder: 'front_lever', words: ['front lever', 'frontlever', 'back lever'] },
  { ladder: 'hanging_core', words: ['hanging core', 'hollow hold', 'hanging leg raise', 'leg raises'] },
];

/**
 * Which curated ladder she means, or null.
 *
 * LONGEST ALIAS FIRST, because "muscle up" contains neither "pull up" nor the
 * reverse but "bar muscle up" contains "muscle up", and a shorter accidental
 * match would send her to the wrong ladder. Ruth's own sentence was "I want to
 * learn to pull up to muscle up", which contains BOTH - and means the muscle up.
 */
export function matchLadder(said: string): Ladder | null {
  const text = said.toLowerCase();
  const hits = ALIASES.flatMap((entry) =>
    entry.words
      .filter((w) => text.includes(w))
      .map((w) => ({ ladder: entry.ladder, length: w.length }))
  ).sort((a, b) => b.length - a.length);
  if (hits.length === 0) return null;
  const key = hits[0].ladder;
  return LADDERS.find((l) => l.key === key) ?? null;
}

/** The ladder names, for telling her what Selodía does have steps for. */
export function curatedNames(): string[] {
  return LADDERS.map((l) => l.name);
}

/**
 * Save a skill she has agreed to, with its ladder when one exists.
 *
 * ALWAYS AT THE BOTTOM OF THE LADDER. Her Skills brief item 4: after saving,
 * chat asks where she is now and moves the rung only once she confirms. So this
 * never guesses a placement - 'starting' shows the whole path, and claims
 * nothing about what she can already do.
 */
export async function addSkill(
  supabase: SupabaseClient,
  userId: string,
  said: string,
  /** The name to show, in her words where the model gave one. */
  name: string
): Promise<SkillAddOutcome> {
  const ladder = matchLadder(said) ?? matchLadder(name);
  const displayName = ladder ? ladder.name : name.trim().slice(0, 80);
  if (!displayName) return { kind: 'failed' };

  // ONE SKILL, NOT ONE PER CONVERSATION. Telling Selodía twice that she wants a
  // muscle up must not produce two destinations, for the same reason a Me card
  // merges rather than duplicates.
  const { data: existing, error: readError } = await supabase
    .from('user_skills')
    .select('id, name, ladder_key')
    .eq('user_id', userId);
  if (readError) return { kind: 'failed' };
  const already = (existing ?? []).find(
    (s) =>
      (ladder && s.ladder_key === ladder.key) ||
      String(s.name).trim().toLowerCase() === displayName.trim().toLowerCase()
  );
  if (already) return { kind: 'already', name: String(already.name) };

  const nextOrder = (existing ?? []).length;
  const { data: skill, error } = await supabase
    .from('user_skills')
    .insert({
      user_id: userId,
      ladder_key: ladder?.key ?? null,
      name: displayName,
      dimension: ladder?.dimension ?? null,
      ladder_note: ladder?.note ?? null,
      sort_order: nextOrder,
    })
    .select('id')
    .single();
  if (error || !skill) return { kind: 'failed' };

  // NO LADDER IS A REAL OUTCOME, not a failure. The skill is hers and is saved;
  // the steps are missing because nobody has written them, and she is told that
  // rather than handed six invented rungs.
  if (!ladder) return { kind: 'added', name: displayName, ladder: false, rungs: 0 };

  const rungs = placeRungs(ladder, 'starting').map((rung, i) => ({
    skill_id: (skill as { id: string }).id,
    user_id: userId,
    name: rung.name,
    stage: rung.stage,
    target: rung.target ?? null,
    needs: rung.needs ?? null,
    detail: rung.detail ?? null,
    develops: rung.develops ?? null,
    // GUIDANCE, AND IT MUST NOT REACH user_rules. See the migration comment:
    // the rules gate removes movements, and "breathe out as you pull" would
    // have removed every exercise whose name it matched.
    cue: rung.cue ?? null,
    clip_match_key: rung.clip,
    sort_order: i,
  }));
  const { error: rungError } = await supabase.from('user_skill_rungs').insert(rungs);
  // THE SKILL STANDS EVEN IF THE RUNGS DID NOT. Reporting a total failure here
  // would be a lie about a row that exists, and the honesty guard would then
  // contradict a correct claim. She is told what actually happened.
  if (rungError) return { kind: 'added', name: displayName, ladder: false, rungs: 0 };
  return { kind: 'added', name: displayName, ladder: true, rungs: rungs.length };
}

/**
 * What the app says about it. Never the model: the reply was composed before any
 * of this ran, so the model cannot honestly report a row it has not seen.
 */
export function skillAddNote(outcome: SkillAddOutcome): string {
  if (outcome.kind === 'already') {
    return `${outcome.name} is already in your Skills.`;
  }
  if (outcome.kind === 'failed') {
    return "That didn't save to your Skills just now. Ask me again and I'll try once more.";
  }
  if (!outcome.ladder) {
    // SAYING SO IS THE REQUIREMENT, not an apology for it. Her brief: save a
    // plain skill "and tell her so. She can describe the steps herself."
    return (
      `${outcome.name} is in your Skills, in Plans. There are no steps written for it yet, ` +
      `so it is there as the thing you are heading for. Tell me the steps you have in mind and ` +
      `I will keep them with it.`
    );
  }
  return `${outcome.name} is in your Skills, in Plans, with ${outcome.rungs} steps from where you are now.`;
}
