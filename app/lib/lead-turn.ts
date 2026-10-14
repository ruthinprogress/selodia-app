import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// A CHAT THAT LEADS (signed off by Ruth, section by section, 13 October 2026).
//
// Her words that started it: "Without the supportive layer, Selodía is just
// heavy lifting admin, I wouldn't pay for it." The plan is in Drive, in the
// comparison notes folder, as "2026-10-13 A chat that leads - the plan".
//
// WHAT WAS WRONG. Every turn was sorted first - food, symptom, care record,
// question - by a model that saw her record and could act, and whose reply was
// then thrown away. A second model wrote the reply after the saves. It could not
// act, it was told "a sentence or two", and it never decided what mattered. On
// 13 October her own Claude Project turned an insurer call into notes, caught a
// mismatch with her GP letter, checked a date and set out what came next, while
// Selodía held the same details and filed them.
//
// WHAT THIS DOES. ONE model leads the whole turn. It reads her message and her
// record and decides what to do, through the same actions the app already has,
// so every guard on every write still runs where the row is written. The app
// carries the actions out. Then the SAME model, in the same conversation, is
// told exactly what happened and writes the reply itself - with her history in
// front of it, permission to give real structure, and the instruction to think
// one step ahead for her.
//
// WHAT IT DOES NOT TOUCH. Voice (typed proves the idea first, her decision).
// Any turn that is not ordinary - distress, crisis, a red flag, a food the
// allergy gate stopped - keeps exactly the path it has today. And everyone but
// the accounts switched on with user_profile.lead_chat keeps today's chat.

/** The strongest model, her decision: learn the best first, then measure what cheaper loses. */
export const LEAD_MODEL = 'claude-opus-5-5';

/**
 * How readily the model thinks before it answers.
 *
 * Ruth, 14 October 2026, on a led turn taking 20 to 30 seconds: "That is broken
 * by any normal users standards, including my own." She is right, and nothing
 * had told the model not to deliberate: Opus 5.5 thinks by default at medium.
 *
 * MEASURED, NOT ASSUMED (scripts/probe-lead-latency.mjs, three runs a level, on
 * a turn shaped like her insurer notes): medium 16.9s and 153 thinking tokens,
 * low 11.3s and 56. Every run at both levels still carried the authorisation
 * code and tied it to the knee she had logged, so the third off cost nothing
 * that could be measured.
 *
 * THE SAME LEVEL ON BOTH CALLS OF A TURN, deliberately. The resolved effort is
 * rendered into the prompt, so changing it between the two calls would throw
 * away the cache the second call is built to reuse - slower and dearer, for a
 * knob that was meant to be neither.
 */
export const LEAD_EFFORT = 'low' as const;

/**
 * For a step that must call one particular tool, such as writing a draft. The
 * lead model refuses a forced tool_choice (found 13 October 2026, before it
 * reached her), so those steps use the strongest model that accepts one.
 */
export const LEAD_TOOL_MODEL = 'claude-opus-5';

/**
 * Room for a real answer AND the thinking before it. The lead model thinks by
 * default and its thinking counts against this, so the ceiling is set for both:
 * call notes run to three hundred words, and the thinking can be as long again.
 */
export const LEAD_REPLY_MAX_TOKENS = 6000;

/** The first call's ceiling on a led turn: thinking plus every decision field. */
export const LEAD_FIRST_MAX_TOKENS = 8000;

/**
 * Is this account on the new chat? False on any error, including the column
 * not existing yet: a switch that cannot be read is off.
 */
export async function leadChatOn(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('lead_chat')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return false;
    return (data as { lead_chat?: unknown } | null)?.lead_chat === true;
  } catch {
    return false;
  }
}

/**
 * A plain yes to an offer that is waiting.
 *
 * A GUARD AT THE WRITE (13 October 2026). She said "Yes" to "Want me to keep
 * that in How I Access Care?" and it was not read as an answer, because the
 * reply above the question had already claimed the record was saved - so the
 * model took her yes as agreement with something done, set no answer, and the
 * offer was dropped as unanswered. Whatever a model makes of it, a bare yes to a
 * waiting question is a yes.
 */
const BARE_YES =
  /^\s*(?:yes|yeah|yep|yup|yes please|please|please do|go on|go ahead|ok|okay|sure|do it|keep it|save it|yes keep it|yes save it|yes do)\s*(?:please|thanks|thank you)?\s*[.!]*\s*$/i;

export function isBareYes(message: unknown): boolean {
  return typeof message === 'string' && BARE_YES.test(message);
}

/** What the reply step is told, beyond the record and what happened. */
export const LEAD_REPLY_INSTRUCTIONS = `NOW WRITE YOUR REPLY TO THEM. You read their record and decided what to do; the app has done it, and what happened is set out above. This reply is yours alone, and these instructions REPLACE every earlier instruction about how long a reply is or how it is laid out - including "a sentence or two" and "no bullet points".

BE THE ONE WHO KNOWS THEIR HISTORY. Before you write, look across their record for anything that bears on what they have just said: an earlier symptom, a letter, a care record, a condition, a decision in their Me tab, something they told you last week. Connect it in plain words when it genuinely matters, and say why it matters for them in particular, not for people in general.

THINK ONE STEP AHEAD FOR THEM. If what they shared leads somewhere, set out what comes next and in what order: who to contact, what to have ready - with the actual numbers and references from their record - what to ask, what to watch for. Do the work rather than describing it.

CHECK WHAT YOU CAN. If a date, a day of the week, a figure or a name does not match their record or the calendar, say so gently and ask which is right. Today's date is in the record.

NAME THE TEST, NOT THE TOPIC. "Worth asking your doctor about your legs" is not help, it is the work handed back. Asking a clinician whether something could have more than one cause gets "yes" and changes nothing. If there is something to raise, say WHAT TO ASK FOR - a named scan, a referral, a reassessment, a specific question - and give the thing in their own record that justifies it, by date and by who wrote it. A request backed by a line from a discharge letter is hard to refuse; a worry is easy to soothe. You are not saying what the scan will show. You are making the appointment achieve something.

KNOW WHAT A QUESTION IS FOR, AND ANSWER THAT.
Getting care means passing checkpoints built for speed: a box on an insurer's screen, an eligibility form, a question read off a script by somebody paid to get through calls. Every question on one of those is a PROXY - it exists to sort people, and the thing it is measuring is not always the thing it literally says. Answer what it is measuring, truthfully, from their whole record.
  "Did your GP refer you to a specialist?" measures IS THERE A REFERRAL - not how they came to ask for one.
  "How long has it been going on?" measures CHRONICITY - not the length of the current flare.
  "Is it getting worse?" measures ESCALATION - not whether the pain score has risen.
Somebody careful and truthful loses out at every one of these, because they answer a harder or narrower question than the one being asked and talk a tickable box into an untickable one.
So when they are facing one of these: give the SHORT TRUE ANSWER first, in the words the question is asking for, and the fact from their record that backs it - "Yes. Your GP referral is dated 12 October, from Dr Diggines." Then warn them where going further will be scored against them: which detail the form cannot hold, and what it will be read as.

ANSWER FROM THE WHOLE RECORD, NOT THE LATEST EPISODE, AND THIS IS WHERE THE HONEST ANSWER IS ACTUALLY LOST.
A careful person scopes a question narrowly and UNDERSTATES their own case without noticing. Asked how long it has been going on, they time the current flare rather than the condition. Asked whether it is getting worse, they check whether it hurts more, when what is being measured is whether it has escalated - and a new loss of function, a joint giving way, a thing they can no longer do, is an escalation whatever the pain is doing. Both answers feel scrupulous and both are wrong against their own notes.
You hold the record, so you can see the whole arc when they can only see this week. Work out what the question is MEASURING, answer it against everything on file, and show them the dates: "Months, not weeks - your left knee has been going since the summer and there is a cyst finding on it. And yes, worse: it gave way on the stairs on 4 October, which is new."
This is accuracy, not advocacy. Where the full record genuinely gives the smaller answer, give the smaller answer.
THE LINE, AND IT IS ABSOLUTE: everything you hand them must be TRUE AND IN THEIR RECORD. Never invent a referral, a date, a diagnosis, a symptom or a number, and never suggest wording that implies one they do not have. You are not getting them past a gate they do not qualify for. You are stopping an honest answer being mistaken for a no, which is the commonest way people lose care they are entitled to. If the honest answer really is no, say so and set out what would make it yes.

SHAPE IT TO THE ANSWER. A simple message gets one or two warm sentences and nothing more. Anything with parts gets a shape they can glance at: a short label on its own line in double asterisks, such as **Have ready**, then lines starting "- ", or "1. " for steps in order. No tables. No label on a two-line answer. Keep to what they will use - under about 180 words, unless they asked for something full, such as call notes or a letter.

WHAT THE APP DID IS THE APP'S TO SAY. Never write that anything was saved, logged, kept, added or updated: the app prints its own line for everything that worked, straight after your reply. If something above did NOT work, say so plainly in one sentence. If an offer to keep something is waiting, the app asks its own question after your reply, so do not ask it, and do not say it is kept.

NOTHING NEW HAPPENS FROM THIS REPLY. Everything the app could do on this turn has been done. Do not promise to save, log or set anything here. If something else needs doing, ask them, and it will be done on their next message.

POINT TO THE APP WHEN IT WOULD HELP. If a feature in the guide would genuinely help with what they are doing - a report to take to an appointment, How I Access Care for numbers they will need again - name it once, with how to get there.

SAY EACH THING ONCE, AND SAY IT SHORT. This is the thing most worth getting right, and the one most often got wrong.

- NEVER REPEAT THEIR MESSAGE BACK TO THEM. They know what they said. Start from what it means for them.
- A fact that is in a heading or a line above is not said again in prose, and a fact in prose is not then listed.
- No preamble about what you are about to say, and no summary at the end of what you have just said.
- If something went wrong, that is ONE plain sentence. Never an account of what you got wrong, in what order, and what you said last time: that is about you, and they are reading for themselves.
- Prefer four short lines to eight long ones. Under 140 words unless they asked for something full, such as call notes or a letter. If it will not fit, cut the explaining, not the facts.

End with at most one question, and only when the answer would change what happens next. No exclamation marks, no praise for a number, and never moralise about food.`;

export type LeadReplyRequest = {
  anthropic: Anthropic;
  /** The first call, exactly as it was made: same system, messages and tools, so the cache holds. */
  first: {
    system: Anthropic.Messages.MessageCreateParams['system'];
    messages: Anthropic.Messages.MessageParam[];
    tools: Anthropic.Messages.ToolUnion[];
  };
  /** What the model returned from the first call, tool use and all. */
  firstContent: Anthropic.Messages.ContentBlock[];
  toolUseId: string;
  /** The record as the reply should see it: the same facts the old writer got. */
  record: string;
  /** What the app actually did this turn, one line each. */
  didLines: string[];
  /** Me, care, allergies, rules, health, history and the rest. Empty ones are dropped. */
  blocks: (string | null | undefined)[];
  /** The app guide. */
  guide: string;
  /** True when an offer to keep something was stored and the app will ask. */
  offerWaiting: boolean;
  signal?: AbortSignal;
};

export type LeadReply = { text: string; usage: Anthropic.Messages.Usage | null; stopReason: string | null };

/** The tool result the reply is written from. Pure, so it can be checked. */
export function leadOutcome(req: Pick<LeadReplyRequest, 'record' | 'didLines' | 'blocks' | 'guide' | 'offerWaiting'>): string {
  const did =
    req.didLines.length > 0
      ? `WHAT THE APP DID WITH THEIR DATA ON THIS TURN:\n${req.didLines.map((l) => `- ${l}`).join('\n')}`
      : 'WHAT THE APP DID WITH THEIR DATA ON THIS TURN: nothing was written.';
  return [
    did,
    req.offerWaiting
      ? 'AN OFFER IS WAITING. The app will ask them whether to keep it, straight after your reply. Do not ask, and do not say it is kept.'
      : null,
    `THE RECORD:\n${req.record}`,
    ...req.blocks,
    req.guide,
    LEAD_REPLY_INSTRUCTIONS,
  ]
    .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
    .join('\n\n');
}

/**
 * The reply, written by the model that led the turn.
 *
 * THE SAME CONVERSATION, CONTINUED. The first call's system, messages and tools
 * are sent again unchanged, so the cached prefix is reused and the model writes
 * with everything it read when it decided. The tool result is what the app did.
 * tool_choice is none: nothing can be done from this step, by construction.
 */
export async function writeLeadReply(req: LeadReplyRequest): Promise<LeadReply> {
  const response = await req.anthropic.messages.create(
    {
      model: LEAD_MODEL,
      max_tokens: LEAD_REPLY_MAX_TOKENS,
      system: req.first.system,
      tools: req.first.tools,
      tool_choice: { type: 'none' },
      output_config: { effort: LEAD_EFFORT },
      messages: [
        ...req.first.messages,
        { role: 'assistant', content: req.firstContent },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: req.toolUseId, content: leadOutcome(req) }],
        },
      ],
    },
    { signal: req.signal }
  );
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { text, usage: response.usage ?? null, stopReason: response.stop_reason ?? null };
}
