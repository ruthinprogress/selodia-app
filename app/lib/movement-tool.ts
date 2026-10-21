import type Anthropic from '@anthropic-ai/sdk';

// THE TOOL THE MODEL CALLS INSTEAD OF BEING TOLD 950 NAMES IN ADVANCE.
//
// Ruth, 21 October 2026: "do option 1, make it a tool - i'm assuming this means
// it's like a database it can go to when needed. we grow the database of
// illustrations and videos over time."
//
// WHAT THIS REPLACES, and why the replacement has to be this specific. The
// prompt carried every filmed movement, grouped by body area, under three
// instructions: build plans from these, copy the name exactly, and never use a
// name that is not on the list. Those three rules are the whole value of the
// list, and all three survive here - the model now finds out what is real
// instead of being handed it and trusted to remember.
//
// IT ASKS IN ITS OWN WORDS, NOT IN THE LIBRARY'S. The model knows it wants a
// hip hinge; the library calls that "barbell romanian deadlift". So the field
// takes the movement it has in mind, in plain language, and the search does the
// translating. Asking it to guess the library's vocabulary in order to search
// the library would be the same memory problem in a smaller box.
//
// SEVERAL AT ONCE, BECAUSE A PLAN IS SEVERAL. One call carrying the whole
// session's worth of movements costs one round trip; six calls cost six, and
// latency on this route is already something she has measured and minded.

export const FIND_MOVEMENTS_TOOL_NAME = 'find_movements';

/** The most phrases one call may carry. A session is six to ten movements. */
export const MAX_LOOKING_FOR = 14;

export const findMovementsTool: Anthropic.Messages.Tool = {
  name: FIND_MOVEMENTS_TOOL_NAME,
  description: [
    'Look up which movements the app can actually demonstrate, and what the library calls them.',
    '',
    'CALL THIS BEFORE WRITING ANY PLAN OR WORKOUT, and before naming a specific movement you intend them to do. The app plays a filmed clip or shows a drawing on each movement\'s own card, and it finds that clip BY THE NAME. A name you invented, or remembered from somewhere else, shows nothing at all.',
    '',
    'Ask in your own words, one phrase per movement you are considering - "hip hinge", "glute bridge", "calf raise", "chest opener". You do not need to know what the library calls it; that is what this answers.',
    '',
    'WHAT COMES BACK, per phrase: the closest real names, with [drawn] marking the ones Selodía has illustrated. A phrase answered with NOTHING FILMED means exactly that and nothing worse - use the movement anyway if it is the right one for them, it simply arrives without a demonstration. Never drop the movement somebody needs because there is no picture of it.',
    '',
    'THEN COPY A NAME EXACTLY AS IT COMES BACK. "plank shoulder taps" when the library holds "dumbbell elbow side plank" shows no demonstration at all. And never use a name that did NOT come back just because it looks similar to one that did: a bulgarian split squat is not a split squat, a sissy squat is not a bodyweight squat. A confidently wrong demonstration is worse than none, because somebody will copy what they see.',
    '',
    'WHERE TWO RESULTS ARE THE SAME MOVEMENT, pick the one somebody would want on their card. Some names carry a machine, a version number or a long equipment description because of where the films came from; if a cleaner equivalent came back, use that. Never put a name like "band two legs calf raise - (band under both legs) version 2" in front of somebody when a plain calf raise also came back.',
    '',
    'IF A PHRASE COMES BACK WITH NOTHING and you believe the library ought to have that movement, try its plainer or more standard name once - "deadbug" and "dead bug" are one movement, and the library may file yours under a different word. One retry, not a hunt.',

    'Call it once, with everything you are considering. Then call the classification tool as usual - this one only answers a question, it never decides the turn or acts on anything.',
  ].join('\n'),
  input_schema: {
    type: 'object',
    properties: {
      lookingFor: {
        type: 'array',
        items: { type: 'string' },
        description:
          'The movements you are considering, in your own plain words, one per entry. Up to 14. Example: ["hip hinge", "single leg balance", "calf raise", "thoracic rotation"].',
      },
      bodyArea: {
        type: 'string',
        description:
          'Optional, and only for browsing when you do not have specific movements in mind yet. One of: Legs, Back, Chest, Shoulders, Biceps, Triceps, Forearms, Abdominals, Yoga, Powerlifting, Stretching - Mobility, Calisthenics-Cardio-Plyo-Functional.',
      },
    },
    required: ['lookingFor'],
  },
};

/**
 * What the prompt says now that it no longer carries the list.
 *
 * SHORT ON PURPOSE. The tool's own description does the teaching, and it caches
 * on the tools breakpoint which sits before the system prompt - so saying it
 * twice would pay twice for the same sentence.
 */
export const MOVEMENT_LIBRARY_PROMPT = `MOVEMENTS THE APP CAN DEMONSTRATE. There is a library of around 950 filmed movements, grouped by body area, and a smaller set Selodía has drawn. Each one plays or shows on that movement's own card, found BY ITS NAME.

You are not given the list. Call the ${FIND_MOVEMENTS_TOOL_NAME} tool to search it whenever you are about to write a plan or name a specific movement for somebody to do - it tells you what is really there and what it is called. The library grows, so what it says today is the truth today.`;
