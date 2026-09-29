// WHAT AN EXPANDED ENTRY SHOWS, AND SHOWS ONCE (Ruth, 29 September 2026).
//
// "On expand, the collapsed preview (truncated first line) stays visible, then
// the full body repeats it, then a grey summary line restates it again. Seen on
// Seasonal Allergy Plan, Nickel and Evening Skincare Routine."
//
// Three layers of the same sentence, and each one arrived for a good reason:
// the preview is her own words truncated, the body is her own words in full,
// and the grey line is the card's `detail`. Nobody decided to show all three -
// the preview simply was not told to stand down when the body appeared, and
// `detail` has no test for whether it is saying anything new.
//
// So two rules, both here rather than in the component, because they are
// judgements and a judgement in a render function cannot be tested:
//
//   THE PREVIEW IS A STAND-IN FOR THE BODY. When the body is on screen the
//   preview has no job. It is not "also shown", it is replaced.
//
//   A SECOND LINE MUST EARN ITS PLACE. `detail` is shown only when it says
//   something the body does not. On her four cards it usually does not -
//   Nickel's detail is its why with the words rearranged - but on the Seasonal
//   Allergy Plan it names Grazax and the GP's condition, which appear nowhere
//   else. A rule that hid both would lose that.

/** Words that carry no meaning for the comparison below. */
const NOISE = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'her', 'his', 'in', 'is', 'it', 'its', 'my', 'no', 'not',
  'of', 'on', 'or', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'up',
  'was', 'were', 'with', 'you', 'your',
]);

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !NOISE.has(w));

/**
 * A crude stem, so "prescribed" and "prescription" are not counted as two
 * different facts. Deliberately crude: a real stemmer is a dependency and a
 * behaviour to maintain, and the question being asked here is only "have I
 * already read this sentence".
 */
const stem = (w: string): string => w.replace(/(ing|ed|es|s|ion|ions)$/, '');

/**
 * Does `candidate` say anything `body` does not?
 *
 * Containment first, then shared vocabulary.
 *
 * THE THRESHOLD IS MEASURED, NOT PICKED, and the margins are worth writing
 * down because one of them is tight. Against her three real cards:
 *
 *   Nickel              0.63 - "rash on neck from leaving necklace on
 *                       overnight, suspected nickel reaction" is its own why
 *                       rearranged. HIDDEN.
 *   Seasonal Allergy    0.36 - it repeats the nasal steroids and the GP, and
 *                       adds that the prescription is picked up and not yet
 *                       used. KEPT.
 *   Evening Skincare    0.00 - the routine is not the reason. KEPT.
 *
 * So 0.6 separates them, with the nearest case 0.03 above the line and the
 * next 0.24 below it. The narrow side is the one to watch, and this comment is
 * the warning: the fixtures in check-entry-layout.mjs are her actual wording,
 * so a change that moves this line fails there rather than quietly hiding a
 * fact she wrote down.
 *
 * MEASURE AGAINST THE REAL TEXT. The first fixtures used a `why` truncated to
 * 160 characters by the query I happened to run, which made the Seasonal
 * Allergy card look far more distinct than it is - its full text already names
 * Grazax and the GP. A threshold tuned against truncated data is tuned against
 * nothing.
 *
 * My first attempt used 0.65 on an estimate made by eye, and it kept Nickel's
 * restatement on screen - the exact thing she reported.
 */
export function addsNothing(candidate: string | null | undefined, body: string | null | undefined): boolean {
  const c = (candidate ?? '').trim();
  const b = (body ?? '').trim();
  if (!c) return true;
  if (!b) return false;

  const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (flat(b).includes(flat(c))) return true;

  const inBody = new Set(words(b).map(stem));
  const mine = words(c).map(stem);
  if (mine.length === 0) return true;
  const shared = mine.filter((w) => inBody.has(w)).length;
  return shared / mine.length >= 0.6;
}

export type ExpandedLayout = {
  /** The full text, shown once. */
  body: string | null;
  /** The extra line, when it adds something. Labelled "Latest" in the UI. */
  latest: string | null;
};

/**
 * WHAT THE EXPANDED CARD DRAWS. The preview is not part of this by design:
 * there is no field for it, so a caller cannot show it alongside the body by
 * accident.
 */
export function expandedLayout(card: { why?: string | null; detail?: string | null }): ExpandedLayout {
  const why = (card.why ?? '').trim() || null;
  const detail = (card.detail ?? '').trim() || null;

  // A card with only a detail shows the detail AS the body. Otherwise the
  // "Latest" line would be the only thing on an expanded card, labelled as an
  // afterthought to a body that is not there.
  if (!why) return { body: detail, latest: null };
  return { body: why, latest: addsNothing(detail, why) ? null : detail };
}
