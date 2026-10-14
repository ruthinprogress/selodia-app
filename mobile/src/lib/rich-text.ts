// BOLD, IN A CHAT BUBBLE THAT HAD NO IDEA WHAT BOLD WAS.
//
// Ruth, 21 September 2026, on the first real medical document Selodía read:
// "Very hard to read, needs much better formatting in chat, with Bold headings
// and spacing - clear and readable for a human, especially since it's a lot of
// data."
//
// She is right, and the cause is that every message in this app has always been
// one <ThemedText> with a plain string in it. That is fine for a sentence and
// hopeless for a record with nine sections, which arrives as an unbroken wall
// exactly when the content matters most.
//
// WHY A PARSER AND NOT A MARKDOWN LIBRARY. A markdown renderer brings tables,
// links, code blocks and its own opinions about all of them into a surface whose
// whole design is one voice speaking. So this reads the handful of marks the
// app's own text actually uses, and leaves everything else literal.
//
// ---------------------------------------------------------------------------
// AND THEN THE MARKS WERE SHOWN TO HER AS MARKS (12 October 2026).
//
// The first version only ever ran on HER side of the chat. Selodía's replies
// and every Me tab record went out as plain text, so a care record arrived on
// her phone reading "**Seen by**" and "_Taken from a document you
// photographed._" - stars and underscores, in a health app. Her words: "the
// awful formatting instantly makes me feel like it's a junk app I can't trust."
//
// So this now reads BLOCKS as well as emphasis, and FormattedText draws them in
// every place that shows text the app or a model wrote:
//
//   **Heading**          a line that is nothing but bold    -> a quiet label
//   - item / • item      a bullet                           -> a hanging bullet
//   1. item              a numbered step                    -> a hanging number
//   _a whole line_       an aside, like "taken from..."     -> a quiet note
//   **word** / _word_    emphasis inside a line             -> weight / quiet
//
// A single asterisk or underscore that is not a pair stays exactly as typed,
// because people type them.

export type Run = { text: string; bold: boolean; italic?: boolean };

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'para'; runs: Run[] }
  | { kind: 'bullet'; marker: string; runs: Run[] }
  | { kind: 'note'; text: string };

const BOLD = /\*\*([^*\n]+)\*\*/g;

// An underscore pair only counts when it sits at a word boundary, so snake_case
// and a URL with underscores in it are left alone.
const ITALIC = /(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:!?)])/g;

/** Plain and italic runs of a stretch with no bold in it. */
function italicRuns(text: string): Run[] {
  const out: Run[] = [];
  let at = 0;
  ITALIC.lastIndex = 0;
  for (let m = ITALIC.exec(text); m !== null; m = ITALIC.exec(text)) {
    const start = m.index + m[1].length;
    if (start > at) out.push({ text: text.slice(at, start), bold: false });
    out.push({ text: m[2], bold: false, italic: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), bold: false });
  return out;
}

/**
 * Splits a message into runs of plain, bold and italic text. Always returns at
 * least one run for a non-empty string, so a caller can render the result
 * without checking whether anything matched.
 */
export function runs(text: string): Run[] {
  const out: Run[] = [];
  let at = 0;

  // lastIndex is reset because the pattern is a module-level global regex and
  // would otherwise carry a position from the previous message into this one.
  BOLD.lastIndex = 0;

  for (let m = BOLD.exec(text); m !== null; m = BOLD.exec(text)) {
    if (m.index > at) out.push(...italicRuns(text.slice(at, m.index)));
    out.push({ text: m[1], bold: true });
    at = m.index + m[0].length;
  }

  if (at < text.length) out.push(...italicRuns(text.slice(at)));
  return out.length > 0 ? out : [{ text, bold: false }];
}

/** True when a message uses any emphasis, so a caller can take the cheap path. */
export function hasBold(text: string): boolean {
  BOLD.lastIndex = 0;
  return BOLD.test(text);
}

const HEADING_BOLD = /^\*\*([^*\n]+?)\*\*:?$/;
const HEADING_HASH = /^#{1,6}\s+(.+)$/;
const BULLET = /^[-*•]\s+(.+)$/;
const NUMBERED = /^(\d{1,2})[.)]\s+(.+)$/;
const NOTE = /^_([^_\n]+)_$/;

/**
 * The blocks of a message or a record, in order.
 *
 * Lines that are not a heading, a bullet or a note are kept together as a
 * paragraph WITH THEIR LINE BREAKS, because a record's lines are separate facts
 * ("Phone: ...", "Address: ...") and joining them into one sentence would undo
 * the layout the record was written with. A blank line ends a paragraph.
 */
export function blocks(text: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length > 0) out.push({ kind: 'para', runs: runs(para.join('\n')) });
    para = [];
  };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      flush();
      continue;
    }

    const heading = line.match(HEADING_BOLD) ?? line.match(HEADING_HASH);
    if (heading) {
      flush();
      out.push({ kind: 'heading', text: heading[1].replace(/\*\*/g, '').trim() });
      continue;
    }

    const note = line.match(NOTE);
    if (note) {
      flush();
      out.push({ kind: 'note', text: note[1].trim() });
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      flush();
      out.push({ kind: 'bullet', marker: '•', runs: runs(bullet[1]) });
      continue;
    }

    const numbered = line.match(NUMBERED);
    if (numbered) {
      flush();
      out.push({ kind: 'bullet', marker: `${numbered[1]}.`, runs: runs(numbered[2]) });
      continue;
    }

    para.push(line);
  }

  flush();
  return out;
}

/**
 * True when the text is ONLY plain paragraphs with no marks: the cheap path,
 * drawn as one string in one Text.
 *
 * SEVERAL PARAGRAPHS COUNT AS PLAIN, AND THAT IS A FIX, NOT A LOOSENING (Ruth,
 * 14 October 2026): "I can't copy and paste the whole axa notes message from the
 * chat on the samsung phone, it only let's me copy one paragraph."
 *
 * She had pasted what her insurer told her - six paragraphs, no headings, no
 * bullets, nothing marked. This said only ONE paragraph was plain, so the
 * message was drawn as six separate Texts, and a selection cannot cross two
 * Texts. Before 12 October the whole message was one Text and it all selected.
 * So the rule is about MARKS, not about length: a message with nothing to draw
 * is drawn whole, exactly as it was, and selects whole again.
 */
/**
 * A record cut in two at one of its headings: what is wanted now, and the rest.
 *
 * Ruth, 14 October 2026: "If users start adding these details to the Me tab it's
 * going to be an unreadable mess very quickly, leading to overwhelm." A care
 * record runs to 32 lines and seven headings on a phone, and most of that is the
 * letter copied out - wanted rarely, and in the way every other time.
 *
 * Its useful half already comes first (what was agreed, what to quote, who to
 * ring), so ONE cut puts the archive behind a tap without hiding anything from
 * her. `rest` is empty when the heading is not there, and the caller then draws
 * the record whole - which is what happens to every record written before the
 * order was settled.
 */
export function splitAtHeading(text: string, heading: string): { front: string; rest: string } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const wanted = heading.trim().toLowerCase();
  const at = lines.findIndex((l) => {
    const m = l.trim().match(HEADING_BOLD) ?? l.trim().match(HEADING_HASH);
    return m ? m[1].replace(/\*\*/g, '').trim().toLowerCase() === wanted : false;
  });
  if (at < 0) return { front: text.trim(), rest: '' };
  return {
    front: lines.slice(0, at).join('\n').trim(),
    rest: lines.slice(at).join('\n').trim(),
  };
}

export function isPlain(text: string): boolean {
  return blocks(text).every(
    (b) => b.kind === 'para' && b.runs.every((r) => !r.bold && !r.italic)
  );
}
