import { getSupabaseServiceRole } from './supabase';
import { callCostMicroCents, type ModelCall, type TokenUsage } from './model-cost';

// KEEPING WHAT EACH CALL COST, PER USER.
//
// See app/lib/model-cost.ts for why the cost is stored alongside the tokens.
// This is the write half, and it has one rule that outranks everything else:
//
//   RECORDING A COST MUST NEVER COST A TURN.
//
// This table exists to improve a pricing document. If it ever throws, or blocks,
// or turns one slow database write into a failed conversation, it has done more
// harm than the entire measurement is worth. So nothing here is awaited on the
// path to a reply, and every failure is swallowed after being said out loud.

type Entry = {
  userId: string;
  /** The chat_messages row this belongs to. A roundup has none. */
  turnId?: string | null;
  call: ModelCall;
  model: string;
  usage: TokenUsage | null | undefined;
};

/**
 * Record one model call. Fire and forget.
 *
 * NOT ASYNC ON PURPOSE - it returns void rather than a promise, so a caller
 * cannot accidentally await it and put a database round trip in front of
 * somebody's reply. If you find yourself wanting to await this, what you want is
 * a test, and the test should call the pricing function directly.
 */
export function recordModelUsage(entry: Entry): void {
  // A call that returned no usage block is not a free call, it is an unknown
  // one, and a row of zeroes would read as free forever. Say so and write
  // nothing.
  if (!entry.usage) {
    console.log(`MODEL USAGE: ${entry.call} returned no usage block, nothing recorded`);
    return;
  }

  const usage = entry.usage;
  void (async () => {
    try {
      const { error } = await getSupabaseServiceRole().from('model_usage').insert({
        user_id: entry.userId,
        turn_id: entry.turnId ?? null,
        call: entry.call,
        model: entry.model,
        input_tokens: usage.input_tokens,
        cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_tokens: usage.cache_read_input_tokens ?? 0,
        output_tokens: usage.output_tokens,
        cost_micro_cents: callCostMicroCents(entry.model, usage),
      });
      // SAID OUT LOUD RATHER THAN SWALLOWED. The reply-path bug of 27 September
      // was a write that failed on every call while the route logged it and
      // carried on deliberately - which is right here, and was catastrophic
      // there. The difference is that losing this row loses a statistic, and
      // losing that one lost somebody's conversation. It still gets printed,
      // because a silent failure that runs for a fortnight is how that one
      // survived.
      if (error) console.log(`MODEL USAGE: insert failed - ${error.code} ${error.message}`);
    } catch (err) {
      console.log('MODEL USAGE: threw', err instanceof Error ? err.message : err);
    }
  })();
}
