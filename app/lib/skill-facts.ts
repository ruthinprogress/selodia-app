// WHAT SHE IS WORKING TOWARDS, PUT IN FRONT OF THE MODEL.
//
// Ruth's Skills brief item 13: "Chat can READ Skills, as it reads Me, so it can
// talk about them."
//
// FACTS, NOT INSTRUCTIONS. Same discipline as week-facts.ts and
// life-stage-facts.ts: this says what is there. What the model may DO about it is
// in reply-prompt.ts, because a column name in front of the writer comes out as
// JSON in her message.
//
// THE LADDER IS DESCRIBED, NOT HANDED OVER AS A SCRIPT. The rungs are listed so
// the model can answer "what's next on the muscle up" and "why am I doing dead
// hangs" truthfully. The prompt separately forbids reading the ladder out: it is
// shown on her Skills screen, and a paraphrase of a progression is how a wrong
// progression gets into a conversation.
//
// NO STAGE IS A COMPLETION. There is no "done", no count, no percentage and no
// position. A stage is NOW, NEXT or GOAL, which is where a thing sits, not how
// far along she is.

type SkillRung = {
  name?: string | null;
  stage?: string | null;
  target?: string | null;
  needs?: string | null;
  detail?: string | null;
  develops?: string | null;
  cue?: string | null;
};

type SkillRow = {
  name?: string | null;
  ladder_key?: string | null;
  ladder_note?: string | null;
  rungs?: unknown;
};

const STAGE_WORD: Record<string, string> = {
  now: 'now',
  next: 'next',
  goal: 'the goal',
};

/**
 * Her skills as sentences, or '' when she has none.
 *
 * EMPTY MEANS SILENT. A block saying "she has no skills" invites the model to
 * mention it, and `ONLY_WHAT_WAS_ASKED` exists because listing what is empty is
 * the commonest way this app has annoyed her. The Skills screen already shows an
 * empty state; chat does not need to announce one.
 */
export function skillFacts(rows: unknown): string {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const lines: string[] = [];
  for (const raw of rows as SkillRow[]) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;

    const rungs = Array.isArray(raw.rungs) ? (raw.rungs as SkillRung[]) : [];
    if (rungs.length === 0) {
      // SAID PLAINLY, because it is the honest outcome for a skill nobody has
      // written a ladder for, and the model must not fill the gap.
      lines.push(`${name} - no steps written for it yet.`);
      continue;
    }

    const parts: string[] = [];
    for (const rung of rungs) {
      const rungName = typeof rung?.name === 'string' ? rung.name.trim() : '';
      if (!rungName) continue;
      const stage = STAGE_WORD[String(rung.stage ?? '').toLowerCase()] ?? String(rung.stage ?? '');
      const bits: string[] = [`${rungName} (${stage})`];
      if (rung.target) bits.push(`target ${rung.target}`);
      if (rung.needs) bits.push(`needs ${rung.needs} first`);
      if (rung.detail) bits.push(String(rung.detail));
      if (rung.develops) bits.push(`develops ${String(rung.develops).replace(/\.$/, '')}`);
      if (rung.cue) bits.push(String(rung.cue));
      parts.push(bits.join('; '));
    }
    lines.push(`${name}: ${parts.join(' | ')}`);
    if (raw.ladder_note) lines.push(`${name}, for every step: ${raw.ladder_note}`);
  }

  if (lines.length === 0) return '';
  return `\n\nHER SKILLS, the things she wants to become able to do. These are NOT her week.\n${lines
    .map((l) => `- ${l}`)
    .join('\n')}`;
}
