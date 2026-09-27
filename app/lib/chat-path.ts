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
// THE SWITCH IS OFF. Ruth reads the before-and-after replies first and turns it
// on herself. Off means every turn runs exactly the path that has been running
// all week, with not one line of it changed.
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
export const REPLY_WRITTEN_AFTER_THE_SAVES = false;

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
  const blocks = [
    replyPrompt({ voice: req.voice }),
    `THE RECORD:\n${turnFacts(req.data)}`,
    req.didLines.length > 0
      ? `WHAT THE APP HAS ALREADY DONE WITH HER DATA ON THIS TURN, and she has not been told any of it yet. Say what matters of it in your own words, once, inside your reply - never as a list bolted on the end, because you are the only person writing this message:\n${req.didLines
          .map((l) => `- ${l}`)
          .join('\n')}`
      : null,
    ...(req.extraBlocks ?? []),
    req.safetyBlock,
  ].filter((b): b is string => typeof b === 'string' && b.trim().length > 0);

  try {
    const res = await req.anthropic.messages.create({
      model: req.model,
      // A SENTENCE OR TWO IS THE TARGET, and this is not a budget. The old call
      // asked for enough room for a 500-exercise plan in a tool field; this one
      // only ever writes prose, so the ceiling exists to catch a runaway rather
      // than to shape the answer.
      max_tokens: 700,
      system: blocks.join('\n\n'),
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
