// WHAT HAPPENS TO A DURABLE FACT SHE JUST TOLD US.
//
// Ruth, 9 October 2026: "it also didn't add the high cholesterol comment to my
// Me section." She had said a letter from her doctor reported slightly high
// cholesterol, been asked whether she wanted it kept as a note on her Me tab,
// said yes, and been answered "I'll add the figure to the same note when you
// do" - about a note that did not exist and never had.
//
// The decision lives here, out of the route, for one reason: the code that lost
// her note read correctly. It said, in effect, "if this category is already in
// use, insert; otherwise record that we did not." Reading it, the gate looks
// like caution. Only running it on an empty category shows that the first fact
// of every kind was dropped. So the gate is a function now, and
// scripts/check-remembers.mjs runs it on the case that failed.

export type RememberDecision = 'write' | 'already-there';

/**
 * Should this fact be written?
 *
 * `existing` is whatever came back for this person, this category AND this
 * exact content - so an empty list means "nothing like this is stored", which
 * is the ordinary case for anything she has not said before, and was the case
 * that silently did nothing.
 *
 * NOTHING HERE DEPENDS ON THE CATEGORY EXISTING. That was the bug. A note about
 * cholesterol is not worth less because it is the first health note.
 */
export function rememberDecision(existing: { id: string }[] | null | undefined): RememberDecision {
  return existing && existing.length > 0 ? 'already-there' : 'write';
}

/**
 * Is this fact worth storing at all? Empty or whitespace-only content is not,
 * and neither is a category with no name - both would make a row that says
 * nothing and that she would see on her Me tab as a blank line.
 */
export function worthRemembering(category: unknown, content: unknown): boolean {
  return (
    typeof category === 'string' &&
    category.trim().length > 0 &&
    typeof content === 'string' &&
    content.trim().length > 0
  );
}
