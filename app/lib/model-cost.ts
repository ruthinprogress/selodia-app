// WHAT A MODEL CALL COST, PRICED AT THE MOMENT IT HAPPENED.
//
// Ruth, 28 September 2026, on the costing document: "Instrument cost per user.
// Every Anthropic response already carries its usage; storing it per turn costs
// nothing and turns this document from a model into a measurement. This is the
// highest-value item on the page."
//
// Every figure in that document rests on an invented user mix - 5% heavy, 20%
// engaged, 45% typical, 30% lapsed - and on ONE person's conversations, who
// built the thing. That is the assumption the whole price hangs from, and the
// data to replace it arrives on every response already and is thrown away.
//
// TOKENS AND THE COST ARE BOTH STORED, and that is deliberate rather than
// redundant. The tokens are the fact; the cost is the fact priced at the rates
// of the day. Anthropic's rates will change, and a table that stores only tokens
// would silently re-price last quarter every time they do - so last quarter's
// bill would move after it had been paid. Same reasoning as the drinks: measure
// at the write, keep what was measured.

/** US dollars per million tokens. */
type Rate = { in: number; out: number; cacheWrite: number; cacheRead: number };

/**
 * The rate card, as published on 28 September 2026.
 *
 * CHANGING A NUMBER HERE DOES NOT REWRITE HISTORY, because every row stores the
 * cost it was charged at the time. It only prices calls made from then on, which
 * is the whole reason the cost is stored rather than computed on read.
 */
const RATES: Record<string, Rate> = {
  // Sonnet 5: $2/M in, $10/M out. Cache write is 1.25x input, cache read 0.1x.
  'claude-sonnet-5': { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  // Haiku 4.5: $1/M in, $5/M out.
  'claude-haiku-4-5-20251001': { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

/** Which call this was. The four that cost money on a turn. */
export type ModelCall = 'classify' | 'reply' | 'extraction' | 'roundup' | 'image';

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/**
 * The cost in MICRO-CENTS, as an integer.
 *
 * Not a float and not cents. A turn costs about 1.8 cents, so cents would round
 * most calls to 0 and floats accumulate error over a million rows - the two ways
 * a money column goes quietly wrong. Micro-cents keeps a cached read, the
 * cheapest thing here at roughly 0.016 cents, as 160 rather than 0.
 *
 * An UNKNOWN MODEL RETURNS null rather than 0. A zero would be indistinguishable
 * from a free call and would understate the bill by exactly the amount nobody
 * noticed, which is the worst shape a missing number can take.
 */
export function callCostMicroCents(model: string, usage: TokenUsage): number | null {
  const rate = RATES[model];
  if (!rate) return null;

  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  // input_tokens from the API EXCLUDES the cached halves - they are counted in
  // their own fields. Adding them again would double-count every cached turn,
  // which on this route is every turn.
  const dollars =
    (usage.input_tokens * rate.in +
      cacheWrite * rate.cacheWrite +
      cacheRead * rate.cacheRead +
      usage.output_tokens * rate.out) /
    1_000_000;

  return Math.round(dollars * 100 * 1_000_000);
}

/** Every model this route knows how to price. For the reading script. */
export const PRICED_MODELS = Object.keys(RATES);
