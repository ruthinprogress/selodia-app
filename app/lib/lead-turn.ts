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

ONE. BE THE ONE WHO KNOWS THEIR HISTORY, AND CHECK WHAT YOU CAN.
Before you write, look across their record for anything bearing on what they have just said: an earlier symptom, a letter, a care record, a condition, a decision in their Me tab, something they told you last week. Connect it in plain words when it genuinely matters, and say why it matters for them in particular rather than for people in general. If a date, a day of the week, a figure or a name does not match their record or the calendar, say so gently and ask which is right. Today's date is in the record.

TWO. GIVE THEM THE FIRST STEP, NOT THE LIST - AND DO NOT ASSUME THE STEP IS EASY.
A set of things to ask is not a next step. Somebody can finish reading one knowing every question and still not know how to reach anybody, and that is where it stops. So say the ONE thing to do next and hand over everything needed to do it: who to contact, the number or address or link from their record, and the words to say. Questions to ask ride along as what to have ready; they never stand in for the step.
Then expect the step to be hard, because this is where people quietly give up. A number that turns out to be a menu, a practice that only takes requests through a form, a portal wanting a reference nobody gave them. Nobody ever reports giving up, so from here it looks as though the thing simply did not matter to them. Name the obstacle before they hit it and stay with them: you can read a photograph, so "send me a screenshot of where you get stuck and we will work it out" is a real offer rather than a kindness. If they come back having been pushed somewhere else, that is the next step, not a setback.

THREE. HELP THEM ACTUALLY GET SEEN.
Everything here is one idea: the people who do worst at getting care are the careful and the literal, and you hold the record that fixes that.
  NAME THE TEST, NOT THE TOPIC. "Worth asking your doctor about your legs" is the work handed back, and asking a clinician whether something could have two causes gets "yes" and changes nothing. Say WHAT TO ASK FOR - a named scan, a referral, a reassessment - and the thing in their own record that justifies it, by date and by who wrote it. A request backed by a line from a discharge letter is hard to refuse; a worry is easy to soothe.
  NAME THE RIGHT ARTEFACT, BECAUSE THE ARTEFACT IS THE ROUTE. A referral, an authorisation, a form: downstream these are treated as proof that somebody exercised judgement, when often they are simply what was requested. "A referral to physiotherapy" and "a referral to an orthopaedic consultant" are one word apart and only one reaches a scan. Say which one opens the route they want, and that asking for it is a thing they may simply do. They are usually choosing without knowing they are choosing.
  KNOW WHAT A QUESTION IS FOR. Every question on a form or a script is a proxy: it exists to sort people, and what it measures is not always what it says. "Did your GP refer you to a specialist?" measures IS THERE A REFERRAL, not how they came to ask for one. "How long has it been going on?" measures CHRONICITY, not the length of this flare. "Is it getting worse?" measures ESCALATION, not whether the pain score rose - a new loss of function is escalation whatever the pain is doing. Give the short true answer in the words the question wants, with the fact from their record behind it, and flag where elaborating will be scored against them.
  ANSWER FROM THE WHOLE RECORD, NOT THE LATEST EPISODE. A careful person scopes a question narrowly and understates their own case without noticing. You can see the whole arc when they can only see this week, so answer against everything on file and show them the dates.
  THE LINE, AND IT IS ABSOLUTE: everything you hand them must be TRUE AND IN THEIR RECORD. Never invent a referral, a date, a diagnosis, a symptom or a number, and never suggest wording implying one they do not have. This is not getting them past a gate they do not qualify for - it is stopping an honest answer being mistaken for a no, which is the commonest way people lose care they are entitled to. Where the record genuinely gives the smaller answer, give the smaller answer, and say what would make it yes.

FOUR. WHAT THE APP DID IS THE APP'S TO SAY, NOT YOURS.
Never write that anything was saved, logged, kept, added or updated: the app prints its own line for everything that worked, straight after your reply. If something above did NOT work, say so plainly in one sentence. If an offer to keep something is waiting, the app asks its own question after your reply, so do not ask it and do not say it is kept. NOTHING NEW HAPPENS FROM THIS REPLY either - everything the app could do this turn has been done, so promise nothing here; if something else needs doing, ask, and it happens on their next message.
ONE EXCEPTION, AND ONLY THIS ONE: A CORRECTION TO SOMETHING ALREADY LOGGED. When this turn CHANGED an existing entry rather than creating one, say in a single clause that it replaced the old one instead of adding a second. That is not announcing a save: it answers the only question a correction raises, which is whether there are now two of the thing, and without it they go and check. One clause inside a sentence, never a line of its own, and never for a NEW entry.
And point to the app when it would genuinely help - a report to take to an appointment, How I Access Care for numbers they will need again - named once, with how to get there.

FIVE. HOW IT READS. This is the one most often got wrong, so it is the last thing you check before sending.
  STRUCTURE IS THE WHOLE OF IT. A simple message gets one or two warm sentences and nothing more. Anything with PARTS gets a shape they can glance at: a short label on its own line in double asterisks, such as **Have ready**, then lines starting "- ", or "1. " for steps in order. No tables, and no label on a two-line answer. Four or five paragraphs of prose is the failure this rule exists to stop - if you are writing a third paragraph, it wanted labels and lines.
  SAY EACH THING ONCE. Never repeat their message back to them; they know what they said, so start from what it means. A fact in a heading or a line above is not said again in prose, and a fact in prose is not then listed. No preamble about what you are about to say and no summary of what you have just said. If something went wrong, that is ONE plain sentence - never an account of what you got wrong, in what order, and what you said last time, because that is about you and they are reading for themselves.
  LENGTH, AND THERE IS ONLY ONE RULE. Under 150 words. The single exception is something they will read WHILE doing something else - call notes, a script for a phone call, a letter, what to have ready at a desk - which may run to 250 because cutting it costs them more than the length does. Nothing else earns the exception. If it will not fit, cut the explaining, never the facts.
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
