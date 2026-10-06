// HOW SHE WANTS HER DAYS TO FEEL, PUT IN FRONT OF THE MODEL.
//
// Ruth, item 7, 2 October 2026: "Chat reads feel goals and the latest look-back
// as the guiding source for tone and priorities, and never promises to fix
// anything."
//
// "GUIDING SOURCE FOR TONE AND PRIORITIES" is the whole job. This is not another
// list of data to read back to her. Somebody whose answer was "Less overwhelm"
// should not be handed three options, a figure and a follow-up question; somebody
// who said "More energy" is worth telling that she slept badly and trained hard
// on the same day. The block below says what she wants and when she said it, and
// the prompt rule in reply-prompt.ts says what to do about it.
//
// NEVER A PROMISE. The screen that collects these says plainly that Selodía
// cannot promise to fix any of them. Chat repeating that promise back to her as
// "this will help with your brain fog" would undo the one honest thing the
// feature does. That constraint is in the prompt, because it is about what to say.
//
// FACTS, NOT INSTRUCTIONS. Same discipline as week-facts.ts and skill-facts.ts.
//
// AND NO ARITHMETIC EVER TOUCHES THIS. A feel goal is deliberately not in
// user_goals: it resolves to nothing calculable and must never become an input to
// a calorie or protein figure. See the migration for why that is a table boundary
// rather than a convention.

type FeelRow = {
  label?: string | null;
  source?: string | null;
  started_at?: string | null;
};

type Lookback = {
  answer?: string | null;
  note?: string | null;
  created_at?: string | null;
};

const ANSWER_WORDS: Record<string, string> = {
  further: 'further from how they wanted them',
  same: 'about the same',
  a_bit_closer: 'a bit closer',
  closer: 'closer',
};

const monthYear = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Her feel goals and last look-back as sentences, or '' when she has none.
 *
 * EMPTY MEANS SILENT, like every other facts block. A line saying she has not
 * answered invites the model to mention it, and listing what is empty is the
 * commonest way this app has annoyed her.
 */
export function feelFacts(rows: unknown, lookback: unknown): string {
  const list = Array.isArray(rows) ? (rows as FeelRow[]) : [];
  const chips = list
    .filter((r) => r.source === 'chip' && typeof r.label === 'string' && r.label.trim())
    .map((r) => String(r.label).trim());
  const hers = list
    .filter((r) => r.source === 'her words' && typeof r.label === 'string' && r.label.trim())
    .map((r) => String(r.label).trim());
  if (chips.length === 0 && hers.length === 0) return '';

  const started = monthYear(list.map((r) => r.started_at ?? '').filter(Boolean).sort()[0]);
  const lines: string[] = [];

  if (chips.length > 0) {
    lines.push(
      `What they want from their days: ${chips.join(', ')}${started ? `, said on ${started}` : ''}.`
    );
  }
  // HER OWN SENTENCE, UNCHANGED. It is the most useful thing in this block and
  // the easiest to paraphrase away.
  for (const words of hers) lines.push(`In their own words: "${words}"`);

  const last = lookback && typeof lookback === 'object' ? (lookback as Lookback) : null;
  if (last?.answer) {
    const word = ANSWER_WORDS[String(last.answer)] ?? String(last.answer);
    const when = monthYear(last.created_at);
    lines.push(
      `Last time they looked back${when ? `, on ${when}` : ''}, they said their days feel ${word}.`
    );
    if (last.note) lines.push(`Their note with it: "${String(last.note)}"`);
  }

  return `\n\nHOW THEY WANTS THEIR DAYS TO FEEL. This is the guiding source for tone and what to lead with. It is NOT something to read back to them, and nothing here is a promise.\n${lines
    .map((l) => `- ${l}`)
    .join('\n')}`;
}
