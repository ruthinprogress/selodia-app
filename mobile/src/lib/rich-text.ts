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
// WHY A PARSER AND NOT A MARKDOWN LIBRARY. A markdown renderer brings headings,
// lists, tables, links, code blocks and its own opinions about all of them into
// a surface whose whole design is one voice speaking. The only thing missing
// was emphasis. So this reads `**like this**` and nothing else: two asterisks,
// a run of text, two asterisks. Everything else in the string stays literal,
// including a single asterisk, which people type.

export type Run = { text: string; bold: boolean };

const BOLD = /\*\*([^*]+)\*\*/g;

/**
 * Splits a message into runs of plain and bold text. Always returns at least
 * one run for a non-empty string, so a caller can render the result without
 * checking whether anything matched.
 */
export function runs(text: string): Run[] {
  const out: Run[] = [];
  let at = 0;

  // lastIndex is reset because the pattern is a module-level global regex and
  // would otherwise carry a position from the previous message into this one.
  BOLD.lastIndex = 0;

  for (let m = BOLD.exec(text); m !== null; m = BOLD.exec(text)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    at = m.index + m[0].length;
  }

  if (at < text.length) out.push({ text: text.slice(at), bold: false });
  return out.length > 0 ? out : [{ text, bold: false }];
}

/** True when a message uses any emphasis, so a caller can take the cheap path. */
export function hasBold(text: string): boolean {
  BOLD.lastIndex = 0;
  return BOLD.test(text);
}
