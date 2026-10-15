// A WALL OF TEXT IS A BUG, AND IT IS CAUGHT AT THE WRITE.
//
// Ruth, 15 October 2026: "We really need to stop this awful block of text
// replies. I almost put the app away and give up to avoid reading such awful
// formatting."
//
// WHAT SHE WAS LOOKING AT. She asked for a dumbbell routine for her knee. The
// answer was right and it arrived as 1,020 characters with ZERO line breaks:
// five exercises, a frequency, a caveat about the fever, a note to take it to
// the consultant she is seeing on the 27th, and an offer - one paragraph. Half
// an hour earlier the same path on the same model had written replies with 4,
// 9 and 12 line breaks. The capability was there and the writer talked itself
// out of it.
//
// WHY MORE PROMPT WAS NOT THE ANSWER. The instruction already said it, in
// section five of six: "Anything with PARTS gets a shape they can glance at."
// It asks the model to JUDGE whether something has parts, and a five-exercise
// routine is as parted as a thing can be. A rule obeyed three times and
// ignored once is not a rule, and her standing note is to stop asking the
// model twice and put the guard where the row is written.
//
// THE MEASUREMENT THAT SET THE THRESHOLD. Over her last 340 assistant replies:
// 14 have a block over 400 characters, one over 600, one over 900. So 400
// catches about one turn in twenty-five and leaves the other twenty-four
// exactly as they are.
//
// ---------------------------------------------------------------------------
// AND IT IS DONE IN CODE, WHICH IS THE SECOND THING THAT WAS GOT WRONG HERE.
//
// The first version of this file sent the wall to a cheap model to be laid out
// again, under an instruction forbidding it to change a single word, with the
// answer compared back character by character. Measured on the real message
// (scripts/probe-shape-models.mjs), that is not a good trade:
//
//   Haiku 4.5    2.4s   laid it out well, and on one run dropped a trailing
//                       comma, on the next dropped the word "and" from an
//                       exercise. Both correctly refused, so both wasted.
//   Sonnet 5    19.3s   came back empty.
//   Opus 5.5     9.2s   kept every word. Nine seconds and Opus prices, added
//                       to a turn whose latency is already the complaint.
//
// A repair that is usually refused is not a repair, and the two things that
// actually needed doing - break a long paragraph, turn "a, b, c and d" after a
// colon into lines - do not need judgement. So they are done here: no call, no
// latency, no cost, and no way whatsoever to alter a dose, a date or a name.
// sameWords() stays, and now guards arithmetic rather than a model.

/** The longest run of text with no line break in it. */
export function longestBlock(text: string): number {
  return text
    .split('\n')
    .reduce((longest, line) => Math.max(longest, line.trim().length), 0);
}

/**
 * Characters in one unbroken block before it stops being readable on a phone.
 * About seventy words, which is eight or nine lines on her screen.
 */
export const WALL_CHARS = 400;

/** Words in a paragraph before it is broken. Matches the writer's own rule. */
const PARAGRAPH_WORDS = 55;

/** True when this reply would land as a block she has to climb. */
export function looksLikeWall(text: string): boolean {
  return longestBlock(text) > WALL_CHARS;
}

/**
 * The words of a message with every mark the layout step can add taken back
 * out. Two texts agreeing here differ ONLY by layout.
 *
 * A comma or semicolon followed by a space is ignored on both sides, because
 * turning "hamstring curls," into a list item drops the comma and a list item
 * does not end in one. A comma INSIDE a number is not: "1,000" keeps it and
 * cannot quietly become "1000". Nothing else is relaxed - a full stop is
 * compared, and so is case, because a name is a name.
 */
export function layoutOnly(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^[ \t]*(?:[-*•]|\d{1,2}[.)])[ \t]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,;](?=\s|$)/g, '');
}

/** True when `after` says exactly what `before` said, laid out differently. */
export function sameWords(before: string, after: string): boolean {
  return layoutOnly(before) === layoutOnly(after);
}

const WORDS = /\S+/g;
function wordCount(text: string): number {
  return (text.match(WORDS) ?? []).length;
}

/**
 * Sentences, keeping their punctuation.
 *
 * Abbreviations are the usual trap, and the ones that matter here are titles
 * in front of a name - Dr, Mr, Mrs, Ms, St - because her record is full of
 * them and splitting after "Mr" would put a consultant's surname on a line of
 * its own. A full stop only ends a sentence when a capital or a digit starts
 * the next word.
 */
function sentences(paragraph: string): string[] {
  const out: string[] = [];
  let current = '';
  const parts = paragraph.split(/(?<=[.!?])\s+/);
  for (const part of parts) {
    current = current ? `${current} ${part}` : part;
    if (/\b(?:Dr|Mr|Mrs|Ms|St|Prof|No|vs|approx|e\.g|i\.e)\.$/i.test(current)) continue;
    out.push(current);
    current = '';
  }
  if (current) out.push(current);
  return out;
}

/**
 * "Something like this: a, b, c and d." becomes a lead-in line and four lines.
 *
 * Only fires on THREE OR MORE items, which is the writer's own threshold, and
 * only when the run of items is the end of the sentence. Returns null when the
 * sentence is not that shape, which is most of them.
 */
function asList(sentence: string): string[] | null {
  const colon = sentence.indexOf(':');
  if (colon < 0) return null;

  const leadIn = sentence.slice(0, colon + 1).trim();
  const rest = sentence.slice(colon + 1).trim();
  if (!leadIn || !rest) return null;

  // Split on commas only. A comma inside a number is left alone by requiring a
  // space after it, the same rule layoutOnly uses.
  const items = rest
    .split(/,(?=\s)/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length < 3) return null;

  // THE FULL STOP STAYS ON THE LAST ITEM, and the first version of this
  // removed it - which made the laid-out version differ from the original by
  // one character, so sameWords refused the whole thing and the wall went out
  // anyway. The layout step tidying away a full stop is exactly what it is
  // forbidden to do, and the guard was right; it was this that was wrong.
  const last = items.length - 1;
  const ends = items[last].match(/[.!?]$/);
  if (!ends) return null;

  // A list item that is itself a sentence means this was prose with a colon in
  // it, not a list of things.
  if (items.some((item, i) => /[.!?]/.test(i === last ? item.slice(0, -1) : item))) return null;

  return [leadIn, ...items.map((item) => `- ${item}`)];
}

/**
 * Lay a reply out. Line breaks and list markers only.
 *
 * Returns the text unchanged whenever it cannot improve it, and - belt and
 * braces, because this is the function standing between her and a reply -
 * whenever the result would not say exactly what came in.
 */
export function layOut(text: string): string {
  if (!looksLikeWall(text)) return text;

  const laid: string[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    if (longestBlock(paragraph) <= WALL_CHARS) {
      laid.push(paragraph);
      continue;
    }

    let run: string[] = [];
    const flush = () => {
      if (run.length > 0) laid.push(run.join(' '));
      run = [];
    };

    for (const sentence of sentences(paragraph.replace(/\s+/g, ' ').trim())) {
      const list = asList(sentence);
      if (list) {
        flush();
        laid.push(list.join('\n'));
        continue;
      }
      run.push(sentence);
      if (wordCount(run.join(' ')) >= PARAGRAPH_WORDS) flush();
    }
    flush();
  }

  const out = laid.join('\n\n').trim();

  if (!sameWords(text, out)) return text;
  return longestBlock(out) < longestBlock(text) ? out : text;
}
