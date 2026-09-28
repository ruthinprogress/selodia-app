import Anthropic from '@anthropic-ai/sdk';

import { replyPrompt } from './reply-prompt';
import { turnFacts, type TurnData } from './turn-facts';

// THE NEW CHAT PATH, AND THE ONE SWITCH THAT TURNS IT ON.
//
// Ruth, 27 September 2026: "wire it in (points 1 and 4), with the old path kept
// behind a switch so we can roll back in one step if something breaks on the
// phone. Run the full test set again after wiring, then tell me when it's live
// and I'll use it for a day before we remove the old path."
//
// WHAT THE TWO POINTS ARE.
//
//   1. Take the reply out of the tool. The reply was a `reply` field in a
//      49-field classification tool, written in the same breath as deciding
//      whether the message was a food log. It now comes from its own call, as
//      plain assistant text, after the app has done the saving.
//
//   4. Nothing appended to a finished reply. Eight different notes could be
//      bolted onto the end of a reply the model had already written - a save
//      confirmation, a correction, a deletion, an honesty note about a failed
//      save, an Almanac offer. That is two authors in one message, and it is
//      the mechanism behind the reply that said an entry both saved and did
//      not. The facts now go IN, before the model writes, and it writes once.
//
// THE SWITCH IS ON, since 28 September 2026. Ruth read the before-and-after
// replies overnight: "I've read the before-and-after doc and the new version is
// clearly better."
//
// THE OLD PATH IS STILL HERE AND STILL WORKS, which is the whole point of the
// switch. Setting this back to false is one line, one commit and one web deploy,
// and every turn goes back to the path that ran all of last week. It comes out
// for good once she has used this one for a while, and not before.
//
// WHY A CONSTANT AND NOT AN ENVIRONMENT VARIABLE. An environment variable is a
// Vercel production setting, and those are hers to change, not mine. A constant
// in a file is a commit, a deploy and a rollback she can see in the history.

/**
 * OFF. The reply comes from the classification tool and the app appends its
 * notes, exactly as it has all week.
 *
 * ON. The classification tool still runs and still drives every save; its reply
 * field is discarded. The reply is written afterwards, in its own call, from the
 * rebuilt prompt, with computed facts and with what the app actually did.
 *
 * Either way a failure in the new path falls back to the old reply rather than
 * failing the turn, so turning this on cannot cost her a message.
 */
export const REPLY_WRITTEN_AFTER_THE_SAVES = true;

/**
 * Is this a turn the rebuilt path may write, at all?
 *
 * A WHITELIST OF ORDINARY-NESS, not a blacklist of harms. The app deliberately
 * takes the words out of the model's hands in several places, and only one of
 * them is about allergens:
 *
 *   - The C-SSRS screen replaces the reply with a FIXED question, specifically so
 *     that a probing question can never co-occur with a resource card. Rewriting
 *     it removes a screening question from a screening turn.
 *   - Any distress tier carries an escalation step, a revisit count and possibly
 *     a card, and its reply is written with all of that in front of it. The
 *     rebuilt prompt has the safety block and one sentence about not being a
 *     clinician. Right for an ordinary turn; not this architecture.
 *   - The allergy gate and the unsafe-goal rewrite both replace the reply with
 *     deliberate text.
 *
 * Written as a whitelist so that a tier added later is excluded by default. On
 * this one question, silently doing nothing is the safe failure and silently
 * proceeding is not.
 */
export function turnIsOrdinary(turn: {
  /** False when the allergy gate replaced the reply. */
  allergyGateSafe: boolean;
  /** Non-null when a distress resource card is going out with this turn. */
  resourceCard: unknown | null;
  /** Non-null when the unsafe-goal resource card is going out. */
  goalResourceCard: unknown | null;
  /** Non-null while the escalation ladder is mid-climb. */
  escalationStep: string | null;
  /** What the turn resolved to AFTER the state machine, not what the model said. */
  classification: string;
  /** The classifications this route treats as not distress. */
  nonDistress: readonly string[];
}): boolean {
  return (
    turn.allergyGateSafe &&
    turn.resourceCard === null &&
    turn.goalResourceCard === null &&
    turn.escalationStep === null &&
    turn.nonDistress.includes(turn.classification)
  );
}

export type ReplyRequest = {
  anthropic: Anthropic;
  model: string;
  /**
   * The conversation, exactly the array the classify call was given, INCLUDING
   * her current message as its last entry. turn_context deliberately reads the
   * history after her turn has been inserted, so it is already in there; adding
   * it again would ask her question twice.
   */
  messages: Anthropic.MessageParam[];
  /** Everything the app knows about her week, computed and rounded in code. */
  data: TurnData;
  /** Spoken turns get the voice rules. */
  voice: boolean;
  /**
   * WHAT THE APP DID THIS TURN, one entry each, in the app's own plain words -
   * the same sentences that used to be appended to the end of the reply. They
   * go in front of the model instead, so one voice says all of it.
   */
  didLines: string[];
  /** The safety block, unchanged, and it still sits last. */
  safetyBlock: string;
  /** Context blocks the old path built that the new prompt still needs. */
  extraBlocks?: (string | null | undefined)[];
};

/**
 * Write the whole reply, once, after the saving is done.
 *
 * Returns null on any failure - a model error, an empty reply, a timeout. The
 * caller then uses the old path's reply. That is deliberate: the switch is a
 * change of author, not a new way for a turn to fail.
 */
export async function writeReplyAfterSaves(req: ReplyRequest): Promise<string | null> {
  // THE STATIC HALF FIRST, SO IT CAN BE CACHED. The rebuilt prompt and the safety
  // block are identical on every turn of the same kind - 3,093 tokens of the
  // roughly 4,000 this call sends - and a cache entry is keyed on everything
  // BEFORE its breakpoint, so anything that varies has to sit after it. That is
  // the same lesson the classify call learned on 25 September, where the first
  // attempt cached a prompt that only looked static and would have missed on
  // every single turn.
  //
  // The safety block moving above the record is a change of ORDER, not of
  // content: it is still the last instruction before her own words, and nothing
  // in it refers to the record by position.
  const staticHalf = [replyPrompt({ voice: req.voice }), req.safetyBlock].join('\n\n');

  const turnHalf = [
    `THE RECORD:\n${turnFacts(req.data)}`,
    req.didLines.length > 0
      ? `WHAT THE APP HAS ALREADY DONE WITH HER DATA ON THIS TURN, and she has not been told any of it yet. Say what matters of it in your own words, once, inside your reply - never as a list bolted on the end, because you are the only person writing this message:\n${req.didLines
          .map((l) => `- ${l}`)
          .join('\n')}`
      : null,
    ...(req.extraBlocks ?? []),
  ]
    .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
    .join('\n\n');

  try {
    const res = await req.anthropic.messages.create({
      model: req.model,
      // A SENTENCE OR TWO IS THE TARGET, and this is not a budget. The old call
      // asked for enough room for a 500-exercise plan in a tool field; this one
      // only ever writes prose, so the ceiling exists to catch a runaway rather
      // than to shape the answer.
      max_tokens: 700,
      system: [
        { type: 'text' as const, text: staticHalf, cache_control: { type: 'ephemeral' as const } },
        { type: 'text' as const, text: turnHalf },
      ],
      messages: req.messages,
    });
    if (res.stop_reason === 'max_tokens') return null;
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    console.log('REPLY WRITER ERROR, falling back to the old path:', err instanceof Error ? err.message : err);
    return null;
  }
}
