// ONE MEAL DESCRIBED TWICE IS ONE MEAL (2026-09-18).
//
// WHAT HAPPENED. Ruth described one dinner in a voice call and nine food rows
// went in across 53 seconds, each carrying more of the same sentence: "73g
// boiled new potatoes", then "...with oxtail stew", then "...and 250g oxtail
// stew (homemade)", then the same words four more times. Her log read 5,137
// kcal for the day. Her words: "Something weird happened on logging food today,
// tins of duplicates."
//
// WHY THE EXISTING GUARD DID NOT CATCH IT. The voice adapter already knows a
// half-answered turn can come back longer, and it handles that - but its defence
// against double-logging is a LINE IN THE PROMPT telling the model its first
// answer went unheard so it should not log the same thing twice. Its own comment
// names this as the remaining risk: "a model can still repeat a log". It did.
// The same class of failure is on the record from 2026-09-09 ("four duplicate
// food entries went in during a voice session") and was met with a better turn
// guard rather than a write guard, which is why it came back.
//
// SO THIS ONE IS NOT A REQUEST. It sits at the write, it is arithmetic on two
// strings, and the model cannot decline it.
//
// IT MATCHES ON CONTENT WORDS, NOT ON THE SENTENCE. The first version of this
// file compared whole strings and failed against the very evening it was written
// for: "73g boiled new potatoes WITH oxtail stew" and "73g boiled new potatoes
// AND oxtail stew" are the same plate, and one word of grammar was enough to
// make them two dinners again. Speech transcription varies in exactly those
// words and never in the food, so the function words are dropped and what is
// left - potatoes, oxtail, stew, 250g - is compared as a set. A sentence that
// grows keeps every content word it had, which is what makes this work.
//
// WHAT IT COSTS, STATED HONESTLY. Somebody who genuinely eats a second
// identical thing inside ten minutes gets one row instead of two. That is a real
// cost and it is the right trade: the failure it prevents put eight phantom
// dinners and 4,600 invented calories into one evening, and a person who ate two
// can say so in the next sentence. The reverse mistake is the one nobody sees.

/** How close in time two descriptions of the same meal must be. */
export const FOOD_DEDUPE_WINDOW_MIN = 10;

// A SHORT ENTRY IS A DIFFERENT KIND OF THING. "A cup of tea", "an apple", "a
// glass of water" are ordinary and repeat honestly - two cups of tea in ten
// minutes is two cups of tea, and merging them would quietly delete a real
// drink. Anything under three content words is therefore only ever matched on
// its exact words, and only inside this much tighter window, which catches a
// double-send without touching a second cup.
export const SHORT_ENTRY_WORDS = 3;
export const SHORT_REPEAT_WINDOW_MIN = 2;

// Grammar, not food. These are the words that change between two transcriptions
// of one sentence; none of them describe anything anybody ate.
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'and', 'with', 'of', 'in', 'on', 'to', 'for', 'plus', 'some',
  'my', 'i', 'it', 'was', 'then', 'also', 'had', 'have', 'ate', 'eaten', 'just',
  'about', 'there', 'that', 'this', 'we', 'me', 'at', 'as', 'is',
]);

// Words only, lowercased: punctuation, casing and spacing all vary between two
// transcriptions of the same sentence, and none of them change what was eaten.
export function normaliseFoodText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** What was actually eaten, as a set: no grammar, no order, no repeats. */
export function contentWords(text: string): Set<string> {
  return new Set(
    normaliseFoodText(text)
      .split(' ')
      .filter((w) => w.length > 0 && !FUNCTION_WORDS.has(w))
  );
}

const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((w) => b.has(w));

export type SameMeal = {
  /**
   * - 'same'    - the same food; nothing new to record.
   * - 'longer'  - the incoming words carry the existing ones and add to them;
   *               the existing row should be rewritten to this fuller account.
   * - 'shorter' - the incoming words are part of what is already recorded.
   */
  how: 'same' | 'longer' | 'shorter';
  /**
   * 'words' - judged on content words, and allowed the full window.
   * 'exact' - a short entry repeated character for character, which only counts
   *           inside the much tighter repeat window.
   */
  basis: 'words' | 'exact';
} | null;

export function sameMeal(existing: string, incoming: string): SameMeal {
  const a = contentWords(existing);
  const b = contentWords(incoming);
  if (a.size === 0 || b.size === 0) return null;

  if (a.size < SHORT_ENTRY_WORDS || b.size < SHORT_ENTRY_WORDS) {
    return normaliseFoodText(existing) === normaliseFoodText(incoming)
      ? { how: 'same', basis: 'exact' }
      : null;
  }

  const aInB = isSubset(a, b);
  const bInA = isSubset(b, a);
  if (aInB && bInA) return { how: 'same', basis: 'words' };
  if (aInB) return { how: 'longer', basis: 'words' };
  if (bInA) return { how: 'shorter', basis: 'words' };
  return null;
}

export type RecentLog = { id: string; raw_text: string | null; happened_at: string };

/**
 * The recent row this entry is another go at, if there is one.
 *
 * Newest first, so a sentence that grew three times lands on the version before
 * it rather than on the first fragment. `taken` holds rows already claimed
 * earlier in the same batch: a message describing two meals must never fold both
 * into one row.
 */
export function findSameMeal(
  incoming: string,
  happenedAt: string,
  recent: RecentLog[],
  taken: Set<string> = new Set()
): { log: RecentLog; how: NonNullable<SameMeal>['how'] } | null {
  const at = Date.parse(happenedAt);
  if (!Number.isFinite(at)) return null;

  const ordered = [...recent].sort((x, y) => Date.parse(y.happened_at) - Date.parse(x.happened_at));
  for (const log of ordered) {
    if (taken.has(log.id)) continue;
    const then = Date.parse(log.happened_at);
    if (!Number.isFinite(then)) continue;
    const match = sameMeal(log.raw_text ?? '', incoming);
    if (!match) continue;
    const windowMin = match.basis === 'exact' ? SHORT_REPEAT_WINDOW_MIN : FOOD_DEDUPE_WINDOW_MIN;
    // Both directions: a catch-up entry dated to last Monday must not merge with
    // anything logged this afternoon, however similar the words.
    if (Math.abs(at - then) > windowMin * 60_000) continue;
    return { log, how: match.how };
  }
  return null;
}
