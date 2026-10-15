import Anthropic from '@anthropic-ai/sdk';

import { recordModelUsage } from './usage-record';

// A MOVEMENT WITH NO CLIP STILL HAS TO BE PERFORMABLE.
//
// Ruth, 15 October 2026, on the plan she built in chat to support her knee and
// took to her specialist: "one one exercise had a video and I have no idea how
// to do the rest. Needs a solution before shipping or it's no use at all."
//
// MEASURED BEFORE BUILDING ANYTHING: across her eleven saved plans, 13 of 45
// movements resolve to a demonstration. Twenty-nine per cent. Her one-in-five
// was the normal rate, not bad luck.
//
// AND IT IS NOT AN ALIAS PROBLEM. The library holds 770 clips and the
// categories are all there, but not her variants: it has cable, nordic and
// alternating hamstring curls and no lying dumbbell one; "glute bridge
// bodyweight" but no single-leg bodyweight version; kettlebell, leg-press and
// hack-squat calf raises but no standing one with a dumbbell.
//
// THE MATCHER IS NOT THE THING TO FIX. movement-demos.ts matches on an exact
// name or an exact word set and nothing weaker, because a subset rule was
// measured and rejected: it matched "kettlebell romanian deadlifts" to the
// SINGLE-LEG variant. A missing demonstration is a small disappointment; a
// confidently wrong one is a form fault. That stands.
//
// SO THE GAP IS CLOSED FROM THE OTHER SIDE. Every movement already carries a
// safetyNote - what can go wrong - and not one carries how to DO it. That is
// the whole of her complaint: she knows the exercise is called a side-lying leg
// lift and cannot perform it from the name.
//
// WHY THIS, AND NOT "ONLY PRESCRIBE MOVEMENTS THAT HAVE VIDEOS". That was the
// other option and she chose this one first, for the right reason: choosing an
// exercise because it was filmed is the tail wagging the dog, and for a knee
// being signed off by a consultant it is the wrong tail. Preferring the
// library's own names is worth doing as a PREFERENCE afterwards, so coverage
// rises without the programme ever being bent to the asset list.
//
// OFF THE CRITICAL PATH. This runs after the turn's response has gone out, so
// a plan saves at exactly the speed it did and the how-tos land a few seconds
// later. See where it is called in almanac.ts.

const HOWTO_MODEL = 'claude-opus-5';

/** How many movements one call will describe. A plan is capped at 60. */
const MAX_PER_CALL = 12;

const INSTRUCTION = `You are writing the "how to do it" for movements in a strength or rehabilitation plan, for somebody exercising at home with no coach present and no video of this movement available.

For EACH movement name given, write three short lines:
  SET UP - where the body starts. Position, what is under it, where the weight is held.
  DO - the movement itself, and the tempo if it matters.
  FEEL IT - which muscle should be working, in plain words. This is how somebody checks they have it right, and it is the line that matters most without a video.

RULES, and they are what makes this safe to send:
  - Describe the movement AS NAMED and nothing else. If the name says single-leg, describe single-leg. If it says side-lying, the person is on their side. If it names a dumbbell, there is a dumbbell. Never substitute a variation you know better, and never quietly make it two-legged or standing because that is more common.
  - If a name is ambiguous enough that you would be guessing which movement is meant, return an empty string for it rather than describing the one you assume. A wrong description is worse than none, for the same reason a wrong video would be.
  - Plain words. "Lie on your back with your knees bent and your feet flat", not "assume a supine position".
  - No weights, no rep counts, no sets, no frequency - those are already in the plan and may differ from whatever you would suggest.
  - No encouragement, no preamble, no restating the name.
  - Nothing about who the person is, what condition they have, or what they are recovering from. You have not been told and must not imply it.

Write each line as one sentence. Keep each movement under 70 words in total.`;

type Described = { name: string; setUp: string; doIt: string; feelIt: string };

const TOOL: Anthropic.Messages.Tool = {
  name: 'describe_movements',
  description: 'Return the three lines for every movement you were given, in the order given.',
  input_schema: {
    type: 'object',
    properties: {
      movements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The movement name exactly as given to you.' },
            setUp: { type: 'string', description: 'Where the body starts. Empty string if the name is too ambiguous to describe safely.' },
            doIt: { type: 'string', description: 'The movement itself. Empty string if ambiguous.' },
            feelIt: { type: 'string', description: 'Which muscle should be working. Empty string if ambiguous.' },
          },
          required: ['name', 'setUp', 'doIt', 'feelIt'],
        },
      },
    },
    required: ['movements'],
  },
};

/** The three lines as one short block, or null when the model declined. */
export function howToText(d: Described): string | null {
  const setUp = d.setUp?.trim() ?? '';
  const doIt = d.doIt?.trim() ?? '';
  const feelIt = d.feelIt?.trim() ?? '';
  // ALL THREE OR NONE. Two thirds of a description is how somebody sets up
  // correctly and then does the wrong thing with it.
  if (!setUp || !doIt || !feelIt) return null;
  return `Set up: ${setUp}\nDo: ${doIt}\nFeel it: ${feelIt}`;
}

/**
 * Write how-to text for movements that have no demonstration clip.
 *
 * Returns a Map keyed by the name as given. A name the model declined to
 * describe is absent rather than mapped to an empty string, so a caller can
 * treat absence as "still no description" - which is an ordinary outcome and
 * far better than a confident description of the wrong movement.
 *
 * NEVER THROWS. A plan whose how-tos failed is still a plan.
 */
export async function writeHowTos(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(names.map((n) => n?.trim()).filter((n): n is string => Boolean(n)))];
  if (wanted.length === 0) return out;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  for (let i = 0; i < wanted.length; i += MAX_PER_CALL) {
    const batch = wanted.slice(i, i + MAX_PER_CALL);
    try {
      const message = await anthropic.messages.create({
        model: HOWTO_MODEL,
        max_tokens: 4000,
        system: INSTRUCTION,
        messages: [{ role: 'user', content: batch.map((n) => `- ${n}`).join('\n') }],
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
      });

      recordModelUsage({
        userId: 'plan-howto',
        turnId: null,
        call: 'extraction',
        model: HOWTO_MODEL,
        usage: message.usage,
      });

      if (message.stop_reason === 'max_tokens') {
        console.log('MOVEMENT HOWTO: ran out of room, skipping this batch');
        continue;
      }

      const use = message.content.find((b) => b.type === 'tool_use');
      if (!use || use.type !== 'tool_use') continue;
      const described = (use.input as { movements?: Described[] }).movements ?? [];

      for (const d of described) {
        // ONLY A NAME WE ASKED ABOUT. The model is told to echo the name back,
        // and a name it invented would attach a description to a movement that
        // is not in the plan.
        const asked = batch.find((n) => n.toLowerCase() === (d.name ?? '').trim().toLowerCase());
        if (!asked) continue;
        const text = howToText(d);
        if (text) out.set(asked, text);
      }
    } catch (err) {
      console.log('MOVEMENT HOWTO: failed —', err instanceof Error ? err.message : err);
    }
  }

  return out;
}
