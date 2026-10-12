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
  // TALK ABOUT THE LOG, NOT FOOD (12 October 2026). "Two bowls of ice cream
  // (replacing the single bowl previously logged)" is the same ice cream.
  'replacing', 'replace', 'replaced', 'instead', 'previously', 'logged', 'log',
  'already', 'again', 'other',
]);

// DAYS ARE NOT FOOD EITHER (12 October 2026). Catching up her Sunday, one entry
// arrived as "Sunday 11 Oct: two bowls of ice cream" and the same ice cream as
// "two bowls of ice cream". Three extra words made them two desserts, and her
// Sunday read 3,921 kcal.
export const DAY_WORDS = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mon', 'tue', 'tues', 'wed', 'weds', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun',
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september',
  'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'yesterday', 'today', 'tonight', 'last', 'night',
]);

const isDayToken = (w: string) => DAY_WORDS.has(w) || /^\d{1,4}(st|nd|rd|th)?$/.test(w);

/**
 * An entry's text without a leading day label: "Sunday 11 Oct: two bowls of ice
 * cream" is "two bowls of ice cream". Only a label made ENTIRELY of day words and
 * numbers is removed, so "Breakfast: porridge" and "Note: no sugar" are kept.
 */
export function stripDayLabel(text: string): string {
  const m = text.match(/^([^:\n]{1,40}):\s*([\s\S]+)$/);
  if (!m) return text;
  const label = normaliseFoodText(m[1]).split(' ').filter(Boolean);
  if (label.length === 0 || !label.some((w) => DAY_WORDS.has(w)) || !label.every(isDayToken)) return text;
  return m[2].trim();
}

// Words only, lowercased: punctuation, casing and spacing all vary between two
// transcriptions of the same sentence, and none of them change what was eaten.
export function normaliseFoodText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** What was actually eaten, as a set: no grammar, no order, no repeats. */
// "Two bowls" and "2 bowl" are the same dessert. A transcriber writes either,
// and a model naming the foods writes "Bowl of ice cream (2)".
const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};

/** A crude singular, so "buns" and "bun", "bowls" and "bowl" are one word. */
const singular = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

export function contentWords(text: string): Set<string> {
  return new Set(
    normaliseFoodText(text)
      .split(' ')
      .filter((w) => w.length > 0 && !FUNCTION_WORDS.has(w) && !DAY_WORDS.has(w))
      .map((w) => singular(NUMBER_WORDS[w] ?? w))
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

// ---------------------------------------------------------------------------
// A RE-LOG OF SEVERAL MEALS AT ONCE (12 October 2026).
//
// Catching up her Sunday by voice, she logged two bowls of ice cream, then
// cinnamon buns, each on its own. Then she said "Yes, that's right now", and the
// model put BOTH into one more entry: "Two bowls of ice cream with banana and
// raisins (replacing the single bowl previously logged), and 4-5 fresh cinnamon
// buns". Compared as a sentence it matches neither meal - it is longer than each
// and contains the other - so sameMeal let it through and her buns and ice cream
// were counted twice.
//
// So a several-item entry is also compared FOOD BY FOOD. When every food in it
// is already recorded in the window, spread across TWO OR MORE entries, it is a
// summary of what is there and adds nothing.
//
// TWO OR MORE, ON PURPOSE. One matching entry is the ordinary sentence-level
// case and sameMeal decides it, keeping "another bowl of ice cream" possible: a
// second identical thing said on its own is still logged. Only an entry that
// re-states several already-logged meals at once is dropped here.

function itemWords(name: string): Set<string> {
  return new Set([...contentWords(name)].filter((w) => !/^\d/.test(w)));
}

export type RecentItems = { logId: string; names: string[] };

/**
 * The recent entries a several-item entry merely restates, or null when it adds
 * anything. Pure: scripts/check-voice-catch-up.mjs.
 */
export function restatesEntries(incomingNames: string[], recent: RecentItems[]): string[] | null {
  const incoming = incomingNames.map(itemWords).filter((s) => s.size > 0);
  if (incoming.length < 2) return null;
  const matched = new Set<string>();
  for (const words of incoming) {
    const hit = recent.find((r) =>
      r.names.some((n) => {
        const e = itemWords(n);
        // A ONE-WORD FOOD MATCHES ONLY ITSELF. "Banana" sits inside "banana
        // bread", and that is a different thing to have eaten.
        const [small, big] = e.size <= words.size ? [e, words] : [words, e];
        if (small.size === 0) return false;
        if (small.size === 1) return big.size === 1 && isSubset(small, big);
        return isSubset(small, big);
      })
    );
    if (!hit) return null;
    matched.add(hit.logId);
  }
  return matched.size >= 2 ? [...matched] : null;
}
