import Anthropic from '@anthropic-ai/sdk';

import type { HowTo } from './almanac';
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

const INSTRUCTION = `You are writing the card somebody reads on their phone when they have opened a movement in their workout plan and are about to do it. There is no video of this movement, so these words are all they have.

WHO IS READING IT, because it decides everything else. Somebody fitting this in between work, the school run and dinner, standing in the front room with a dumbbell. They tapped the movement to get ON with it. They have a small amount of motivation and reading uses it up. If they have to study, the moment passes and they do not train.

So this is a recipe card, not an instruction manual. Around forty-five words in total, and it has to fit on one screen.

For EACH movement name given, return:
  NEEDS - what they have to have to hand, two or three words each, no sentences. "One dumbbell". "A wall or chair". Leave it empty for bodyweight with nothing else.
  STEPS - the movement as three to five numbered actions, each ONE short sentence in the imperative, the way somebody standing beside them would say it. "Stand tall." "Rise onto your toes." "Pause." "Lower for three seconds." Not a paragraph broken up: each step is one thing to do.
  FEEL - where it should be felt, as a place on the body and nothing else. "The back of your lower leg." "The side of your hip." Under ten words.
  AVOID - the one or two things that actually go wrong, each starting with "Don't" and under ten words. "Don't bounce at the bottom." "Don't let the knee roll inwards." This is the short version; the longer safety note is kept elsewhere and can be opened from the card.

RULES, and they are what makes this safe to send:
  - Describe the movement AS NAMED and nothing else. If the name says single-leg, it is single-leg. If it says side-lying, they are on their side. If it names a dumbbell, there is a dumbbell. Never substitute a variation you know better.
  - If the name is ambiguous enough that you would be guessing which movement is meant, return empty arrays and an empty feel rather than describing the one you assume. A wrong description is worse than none.
  - No weights, no rep counts, no sets, no tempo numbers beyond what a step needs - those are on the card already and may differ from anything you would pick.
  - Plain words. "Lie on your back with your knees bent", never "assume a supine position".
  - No encouragement, no preamble, no restating the name, and nothing about who they are or what they are recovering from.`;

type Described = {
  name: string;
  needs: string[];
  steps: string[];
  feel: string;
  avoid: string[];
};

const TOOL: Anthropic.Messages.Tool = {
  name: 'describe_movements',
  description: 'Return the card for every movement you were given, in the order given.',
  input_schema: {
    type: 'object',
    properties: {
      movements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The movement name exactly as given to you.' },
            needs: {
              type: 'array',
              items: { type: 'string' },
              description: 'What they need to hand, two or three words each. Empty for bodyweight with nothing else.',
            },
            steps: {
              type: 'array',
              items: { type: 'string' },
              description: 'Three to five numbered actions, one short imperative sentence each. Empty if the name is too ambiguous to describe safely.',
            },
            feel: { type: 'string', description: 'Where it should be felt. A place on the body, under ten words.' },
            avoid: {
              type: 'array',
              items: { type: 'string' },
              description:
                'One or two things that go wrong, each beginning with the word Don’t and under ten words.',
            },
          },
          required: ['name', 'needs', 'steps', 'feel', 'avoid'],
        },
      },
    },
    required: ['movements'],
  },
};

/** The card, or null when the writer declined to describe the movement. */
export function howToCard(d: Described): HowTo | null {
  const line = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const list = (v: unknown) =>
    Array.isArray(v) ? v.map(line).filter(Boolean).slice(0, 5) : [];

  const steps = list(d.steps);
  const feel = line(d.feel);
  // THE TWO THAT MUST BOTH BE THERE. Steps without a feel is a sequence she
  // cannot check herself against, and a feel without steps is a destination
  // with no route. Needs and avoid can legitimately be empty - a bodyweight
  // movement needs nothing, and some movements have no common failure worth
  // a line.
  if (steps.length === 0 || !feel) return null;

  return { needs: list(d.needs), steps, feel, avoid: list(d.avoid) };
}

export async function writeHowTos(names: string[]): Promise<Map<string, HowTo>> {
  const out = new Map<string, HowTo>();
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
        const card = howToCard(d);
        if (card) out.set(asked, card);
      }
    } catch (err) {
      console.log('MOVEMENT HOWTO: failed —', err instanceof Error ? err.message : err);
    }
  }

  return out;
}
