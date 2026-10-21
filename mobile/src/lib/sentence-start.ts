// ANYTHING SHOWN TO SOMEBODY STARTS WITH A CAPITAL.
//
// Ruth, 21 October 2026, on a diary entry reading "contact GP if ear ringing
// persists": "the C is not capitalised, that's a standing rule for any
// starting text. this is a bug. it should be Contact."
//
// WHY IT IS DONE AT RENDER AND NOT AT THE WRITE. The stored string is what
// somebody said, and a diary title is matched against by the chat when it is
// asked to cancel one - this project has a rule about that, written down after
// the goal-display work: rename at render, never in the database, because a
// stored string is an identity. Capitalising on the way in would change the
// thing the match is made against, and leave old rows lowercase anyway.
//
// IT TOUCHES THE FIRST LETTER AND NOTHING ELSE. Not title case, not a tidy-up:
// "contact GP if ear ringing persists" becomes "Contact GP if ear ringing
// persists", and GP is left exactly as she said it. Anything cleverer would
// eventually lowercase somebody's NHS number or their consultant's name.
//
// ONE COPY, BECAUSE THERE WERE FIVE. The same four-line function was written by
// hand in activity-history-view, food-log-view, overview-panel, activities-copy
// and the cycle day screen. None of them was wrong, and that is the point: this
// project has lost afternoons to one behaviour expressed twice - two protein
// targets, eleven Body Manual rows, the weighting table. A fifth copy is a
// fifth chance for one of them to drift.

/**
 * The same string with its first letter capitalised.
 *
 * SAFE ON EVERYTHING. An empty string, a string starting with a digit or a
 * quote, a string already capitalised: all come back unchanged rather than
 * throwing or producing "". A display helper that can fail is a blank label.
 */
export function sentenceStart(text: string | null | undefined): string {
  const s = (text ?? '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
