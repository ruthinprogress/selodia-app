import type Anthropic from '@anthropic-ai/sdk';
import type { Allergy } from './allergies';
import { normaliseAllergen } from './allergies';

// THE FILTER GATE. Build item 42, part (c) — the half that is a safety mechanism
// rather than awareness of one.
//
// `allergies.ts` is emphatic that its prompt block is NOT this: it makes the
// model aware inside a session, which a long conversation can truncate away and
// a determined conversation can talk around. This runs after the model has
// spoken and checks what it actually said.
//
// WHY THIS SHIPS BEFORE ITEM 22, against what the spec said until 2026-09-09.
// Both item 42 and allergies.ts claimed the gate was blocked on the Meal Advisor,
// "where the first real food-suggestion path will exist", and that the app has no
// food-suggestion path today. That is not true in practice. There is no
// food-suggestion FEATURE, but Selodía is a companion in a food app that will
// answer "what should I have for dinner?", and the allergy prompt block itself
// says "never suggest, recommend or include any of them in ANYTHING YOU PROPOSE"
// - an instruction that only exists because proposing happens. The risk is live
// now, so the gate is live now, and item 22 inherits it already working.
//
// THE FOUR LAYERS, per item 42's own scoping. Layer 1 is prevention and lives in
// allergies.ts. Layers 2 to 4 are here:
//
//   2. STRUCTURED SELF-REPORT - the model marks its own reply as suggesting food,
//      on the classify tool it already calls. Stronger than a prompt instruction
//      because it is structured output rather than prose it can drift out of, and
//      it costs no extra round trip.
//   3. DETERMINISTIC BACKSTOP - the stored allergen names, matched against the
//      reply. Exact and dumb on purpose: it cannot be reasoned with.
//   4. GATED MODEL CHECK - the only layer that catches an allergen hidden inside
//      a composite dish, which is the failure the other three cannot see. "Pad
//      thai" defeats layers 2 and 3 completely: nothing named peanut, so nothing
//      to match.
//
// EVERYTHING SHORT-CIRCUITS WHEN THERE ARE NO ALLERGIES, which is most people
// most of the time, so the default cost of all of this is zero.

// Fast and cheap: this is a yes/no about text already written, not reasoning
// about a person. It runs on a small slice of turns and must not add a beat the
// person can feel.
const CHECK_MODEL = 'claude-haiku-4-5-20251001';

export type GateVerdict =
  | { safe: true }
  | { safe: false; allergen: string; layer: 'deterministic' | 'model' };

// What Selodía says instead of the suggestion that did not pass.
//
// Calm, and honest about what happened without dramatising it. It does not
// apologise, does not explain the machinery, and hands the conversation back
// rather than trying again blind - because a second guess from the same model
// that just got it wrong is not obviously safer than asking.
export function blockedSuggestionMessage(allergen: string): string {
  return `Let me think again - what I had in mind doesn't work with your ${allergen}. Tell me what you're in the mood for and I'll go from there.`;
}

// LAYER 3. Word-boundary matching on the stored names, so "nut" does not fire on
// "nutrition" and "egg" does not fire on "eggplant" - a gate that cries wolf on
// ordinary sentences would be turned off within a week, and then it protects
// nobody. Deliberately NOT a synonym list: principle 13 rules out a closed
// vocabulary for open-ended human input, and an allergen list is precisely the
// list nobody can finish writing. Layer 4 is what covers the words we do not know.
export function deterministicHit(replyText: string, allergies: Allergy[]): string | null {
  const haystack = ` ${replyText.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  for (const a of allergies) {
    const needle = normaliseAllergen(a.name).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!needle) continue;
    if (haystack.includes(` ${needle} `)) return a.name;
    // A declared "peanuts" should still catch a reply that says "peanut".
    if (needle.endsWith('s') && haystack.includes(` ${needle.slice(0, -1)} `)) return a.name;
    if (!needle.endsWith('s') && haystack.includes(` ${needle}s `)) return a.name;
  }
  return null;
}

// LAYER 4. The composite-dish check, and the only one that can see a peanut in a
// pad thai. Gated hard by the caller: it runs only when the person has exclusions
// AND the model said this reply suggests food, so it never fires for logging, a
// body question, or ordinary conversation.
async function modelCheck(
  anthropic: Anthropic,
  replyText: string,
  allergens: string[]
): Promise<string | null> {
  const response = await anthropic.messages.create({
    model: CHECK_MODEL,
    max_tokens: 200,
    system:
      'You check whether a message suggests food that is unsafe for someone with specific ' +
      'allergies or dietary restrictions. Consider what a dish CONVENTIONALLY contains, not ' +
      'only what is named: pad thai conventionally contains peanuts, carbonara contains egg ' +
      'and pork, pesto contains pine nuts and hard cheese. Judge only food the message ' +
      'PROPOSES, RECOMMENDS OR OFFERS. Food the person is described as having already eaten ' +
      'is not a suggestion and must never be flagged.',
    tools: [
      {
        name: 'verdict',
        description: 'Report whether the message suggests anything unsafe.',
        input_schema: {
          type: 'object',
          properties: {
            unsafe: {
              type: 'boolean',
              description: 'True only if the message proposes food that conflicts with a listed restriction.',
            },
            allergen: {
              type: 'string',
              description: 'Which listed restriction it conflicts with. Empty when unsafe is false.',
            },
          },
          required: ['unsafe'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'verdict' },
    messages: [
      {
        role: 'user',
        content: `RESTRICTIONS: ${allergens.join(', ')}\n\nMESSAGE:\n${replyText}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return null;
  const input = block.input as { unsafe?: boolean; allergen?: string };
  if (!input.unsafe) return null;
  // Falls back to the first declared restriction rather than an empty string: the
  // message shown to the person has to name something real.
  return (input.allergen || '').trim() || allergens[0];
}

/**
 * Run the gate over a reply about to be sent.
 *
 * FAILS OPEN, DELIBERATELY, AND ONLY ON THE MODEL LAYER. If the layer-4 call
 * throws or times out, the reply goes out and the failure is logged loudly.
 * Blocking every food suggestion whenever Anthropic has a wobble would make the
 * app useless in a way the person cannot diagnose, and layers 1 to 3 have already
 * run. Layer 3 never fails open, because a string comparison cannot fail.
 */
export async function runAllergyGate(
  anthropic: Anthropic,
  replyText: string,
  allergies: Allergy[],
  suggestsFood: boolean
): Promise<GateVerdict> {
  // The short circuit that makes this free for almost everybody.
  if (allergies.length === 0) return { safe: true };

  // Layer 3 runs whatever the model said about itself, because the self-report is
  // the model's own claim and a determined jailbreak would set it false.
  const literal = deterministicHit(replyText, allergies);
  if (literal) {
    console.log(`ALLERGY GATE: blocked on a literal match for "${literal}"`);
    return { safe: false, allergen: literal, layer: 'deterministic' };
  }

  // Layer 4 is the one with a cost, so it is the one that is gated.
  if (!suggestsFood) return { safe: true };

  try {
    const hidden = await modelCheck(anthropic, replyText, allergies.map((a) => a.name));
    if (hidden) {
      console.log(`ALLERGY GATE: blocked on a composite-dish match for "${hidden}"`);
      return { safe: false, allergen: hidden, layer: 'model' };
    }
  } catch (err) {
    console.log(
      'ALLERGY GATE: layer 4 check failed, letting the reply through —',
      err instanceof Error ? err.message : err
    );
  }

  return { safe: true };
}
