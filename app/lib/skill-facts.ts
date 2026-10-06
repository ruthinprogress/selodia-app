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
// THERE IS NO LADDER TO DESCRIBE ANY MORE (Ruth, 5 October 2026). This file used
// to list the rungs so the model could answer "what's next on the muscle up".
// Ladders are parked: "The user does not know about progression ladders and does
// not need to." A skill is her words, where she is with it, and the date - plus
// her own notes, which are the part worth having in a conversation.
//
// NOTHING IS COUNTED. No streak, no total, no position. Her notes are listed
// newest first and capped at five, because they are context for a reply rather
// than a record to be summarised.

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
  id?: string | null;
  name?: string | null;
  placement?: string | null;
  created_at?: string | null;
};

type NoteRow = {
  skill_id?: string | null;
  note?: string | null;
  created_at?: string | null;
};

/** Her three, said as she would say them. */
const PLACEMENT_WORD: Record<string, string> = {
  starting: 'just starting',
  some: 'part of the way there',
  nearly: 'nearly there',
};

/**
 * Her skills as sentences, or '' when she has none.
 *
 * EMPTY MEANS SILENT. A block saying "she has no skills" invites the model to
 * mention it, and `ONLY_WHAT_WAS_ASKED` exists because listing what is empty is
 * the commonest way this app has annoyed her. The Skills screen already shows an
 * empty state; chat does not need to announce one.
 */
export function skillFacts(rows: unknown, notes?: unknown): string {
  // A SKILL IS THREE THINGS NOW (Ruth, 5 October 2026): her own words, where she
  // is with it, and the date. The rungs are gone from here with the ladders -
  // see LADDERS_ENABLED in mobile/src/lib/skills-copy.ts. Nothing below describes
  // a progression, because the app no longer holds one for her.
  const list = Array.isArray(rows) ? (rows as SkillRow[]) : [];
  if (list.length === 0) return '';

  const byId = new Map<string, string[]>();
  for (const n of Array.isArray(notes) ? (notes as NoteRow[]) : []) {
    const id = String(n?.skill_id ?? '');
    if (!id || !n?.note) continue;
    const when = n.created_at ? new Date(n.created_at) : null;
    const date =
      when && !Number.isNaN(when.getTime())
        ? when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
        : '';
    byId.set(id, [...(byId.get(id) ?? []), date ? `${date}: ${n.note}` : String(n.note)]);
  }

  const lines = list.map((s) => {
    const where = s.placement ? PLACEMENT_WORD[String(s.placement)] ?? null : null;
    const started = s.created_at
      ? new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
      : null;
    const head = [
      `"${s.name ?? ''}"`,
      where ? `they say they are ${where}` : null,
      started ? `added ${started}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    // HER NOTES, NEWEST FIRST AND CAPPED. They are the useful part - what she
    // actually did and how it went, in her words - and a year of them would
    // crowd out everything else in the turn.
    const mine = (byId.get(String(s.id ?? '')) ?? []).slice(0, 5);
    return mine.length > 0 ? `${head}. Their notes, newest first: ${mine.join(' | ')}` : head;
  });

  return (
    'WHAT THEY ARE WORKING ON, in their own words, with their own notes:\n' +
    lines.map((l) => `- ${l}`).join('\n') +
    '\nThese are theirs. Do not invent steps, stages or a progression for any of them, ' +
    'do not say what comes next, and do not say how long anything takes. You may talk ' +
    'about practice in conversation like a knowledgeable friend would; you may not build ' +
    'or save a plan of steps.'
  );
}
