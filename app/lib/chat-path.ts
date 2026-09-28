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
// THE SWITCH IS ON FOR TEXT AND OFF FOR VOICE, since 28 September 2026.
//
// She read the before-and-after replies overnight - "the new version is clearly
// better" - and it went on for everything. Then the latency was measured on her
// real turns: a median of 3.3s on the 26th and the 27th, and 7.0s on the day the
// second call went live. Her instruction the same afternoon: "switch voice to the
// old path until latency is back to about 3.3s; keep text on the new path."
//
// WHY THAT IS THE RIGHT SPLIT and not simply turning it off. The cost is a second
// sequential model call, and it is felt completely differently on the two
// surfaces. Seven seconds of typed reply is a pause with a typing indicator in
// it. Seven seconds of spoken reply is silence on a phone call - the failure this
// project spent the whole of 24 September measuring, and the reason the
// platform's own filler line is set to eight seconds: because the turn used to
// finish before it.
//
// THE OLD PATH IS STILL HERE AND STILL WORKS. That is the point of the switch.
//
// WHY A CONSTANT AND NOT AN ENVIRONMENT VARIABLE. An environment variable is a
// Vercel production setting, and those are hers to change, not mine. A constant
// in a file is a commit, a deploy and a rollback she can see in the history.

/**
 * Which surfaces write the reply after the saving, rather than inside the tool.
 *
 * OFF for a surface. The reply comes from the classification tool and the app
 * appends its notes, exactly as it did before 28 September.
 *
 * ON for a surface. The classification tool still runs and still drives every
 * save; its reply field becomes a fallback. The reply is written afterwards, in
 * its own call, from the rebuilt prompt, with computed facts and with what the
 * app actually did.
 *
 * Either way a failure in the new path falls back to the old reply rather than
 * failing the turn, so this can never cost somebody a message.
 *
 * VOICE IS BACK ON, 28 September 2026, and by a different route rather than
 * because the second call got faster. A spoken turn now starts the reply writer
 * AT THE SAME TIME as the classification instead of after it - see the note in
 * ask-selodia/route.ts where it begins. Text stays sequential, because the
 * seconds it saves there are a pause with a typing indicator in them and the
 * trade is a wasted call on the turns that report something.
 */
export const REPLY_WRITTEN_AFTER_THE_SAVES = { typed: true, voice: true };

/** Does the rebuilt path write this turn's reply, before anything else is asked? */
export function newPathWrites(voice: boolean): boolean {
  return voice ? REPLY_WRITTEN_AFTER_THE_SAVES.voice : REPLY_WRITTEN_AFTER_THE_SAVES.typed;
}

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
   *
   * Trimmed to the last RUN_UP_TURNS before it is sent - see that constant.
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
 * Why a turn fell back to the old path. Three genuinely different failures that
 * used to be one bare null, so nobody could tell a model outage from a reply
 * that came back empty from one truncated half-written.
 */
export type FallbackReason = 'error' | 'empty' | 'max_tokens';

export type WrittenReply =
  | { text: string; fellBack: null }
  | { text: null; fellBack: FallbackReason; detail: string };

/**
 * HOW MUCH OF THE CONVERSATION THE WRITER SEES, and why it is not all of it.
 *
 * Measured 28 September 2026, when her turns had gone from a 3.3s median to 7.0s.
 * The input barely matters - the three configurations tried sent 5,138, 4,220 and
 * 4,058 tokens, and the static 3,351 of that is cached either way. What varied by
 * a factor of seven was the OUTPUT: 276 tokens with forty turns of run-up against
 * 39 with six, which at roughly sixty tokens a second is four and a half seconds
 * against under one.
 *
 * The writer does not need the history the way the classifier does. The record
 * reaches it as computed, labelled facts - that is what turn-facts.ts is for -
 * and what the run-up buys is knowing what is being discussed RIGHT NOW: a
 * correction, a question about something a turn or two back, a thing she is still
 * answering. That lives in the last few exchanges.
 *
 * THE CLASSIFY CALL STILL GETS ALL OF IT, because it is the one deciding whether
 * this message corrects an earlier one, and it is not the call that was slow.
 */
const RUN_UP_TURNS = 8;

/**
 * Write the whole reply, once, after the saving is done.
 *
 * NEVER THROWS, and never leaves the caller without a reply: any failure comes
 * back as a reason and the old path's reply is used. That is deliberate - the
 * switch is a change of author, not a new way for a turn to fail - but a silent
 * fallback is its own problem, so the reason is returned rather than swallowed
 * and the caller records it.
 */
export async function writeReplyAfterSaves(req: ReplyRequest): Promise<WrittenReply> {
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
      ? `WHAT THE APP HAS ALREADY DONE WITH HER DATA ON THIS TURN. You are the only person writing this message, so anything she needs to know has to come from you - but MOST OF THIS NEEDS NO MENTION AT ALL.

A save that WORKED is not news: the app prints its own confirmation and she has already seen it, so saying it again is the receipt this reply exists to avoid. Say nothing about it.

ANYTHING THAT DID NOT WORK IS ALWAYS SAID. A save that failed, an entry removed, a value changed - she has no other way of finding out, and a reply that leaves it out is the app quietly letting her believe something false. One plain sentence, woven in rather than listed, and never more than one.

If every line below is something that simply worked, say nothing about any of it and just answer her.

Whatever you do say, the whole reply stays what it always is: a sentence or two.

${req.didLines.map((l) => `- ${l}`).join('\n')}`
      : null,
    ...(req.extraBlocks ?? []),
  ]
    .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
    .join('\n\n');

  try {
    const res = await req.anthropic.messages.create({
      model: req.model,
      // A CEILING TO CATCH A RUNAWAY, and NOT a way to make replies shorter.
      //
      // Lowered to 400 on 28 September to claw back latency, and put straight back
      // when the probe showed what that actually does: it truncates a reply that
      // was going to be long, and a truncated reply is discarded in favour of the
      // old path's. So the change turned a slow turn into a FALLBACK - the same
      // wait, and then the reply the new path exists to replace. Two of three
      // probe cases hit it.
      //
      // The lever for latency is output LENGTH, which is asked for in the prompt,
      // not cut off here. A ceiling only ever decides what happens after
      // everything has already gone wrong.
      max_tokens: 700,
      system: [
        { type: 'text' as const, text: staticHalf, cache_control: { type: 'ephemeral' as const } },
        { type: 'text' as const, text: turnHalf },
      ],
      // THE LAST FEW EXCHANGES, not the last forty. See RUN_UP_TURNS.
      //
      // Taken from the END of the array, which is where her current message is -
      // turn_context returns the history with her turn already in it, so slicing
      // from the front would cut off the thing she just said.
      messages: req.messages.slice(-RUN_UP_TURNS),
    });
    if (res.stop_reason === 'max_tokens') {
      // Truncated mid-sentence. Unusable as a reply and worse than the old
      // path's, which at least finished.
      return { text: null, fellBack: 'max_tokens', detail: `output_tokens=${res.usage?.output_tokens ?? '?'}` };
    }
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (text.length === 0) {
      return {
        text: null,
        fellBack: 'empty',
        detail: `stop_reason=${res.stop_reason ?? '?'} blocks=${res.content.length}`,
      };
    }
    return { text, fellBack: null };
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.log('REPLY WRITER ERROR, falling back to the old path:', detail);
    return { text: null, fellBack: 'error', detail: detail.slice(0, 500) };
  }
}
