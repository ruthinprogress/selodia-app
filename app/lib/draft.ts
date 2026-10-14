import type Anthropic from '@anthropic-ai/sdk';

// SOMETHING SHE CAN SEND, WRITTEN FOR HER.
//
// From the audit of her Ruth's Health project, 12 October 2026. She says "my
// knee is sore", and the project drafts a 430-character message for her GP's
// online form with her insurance number, her consultant and the relevant history
// already in it. Her effort: copy, paste, submit.
//
// Selodía already held every one of those facts and handed them to the model on
// every turn. It could not do this for two reasons, both by design. The model
// that speaks to her has no tools. And its prompt says "a sentence or two ... no
// bullet points", which is right for conversation and rules out a letter.
//
// SO A DRAFT IS A SEPARATE CALL, NOT A CHANGE TO THE WRITER. The classifier
// decides a turn is asking for something to send; this call writes it with the
// same context the writer has; the writer is told it exists and stays short;
// the phone shows it under the reply with a Share button that offers Copy.
// The writer keeps no tools, keeps streaming in voice, keeps its length rule,
// and a draft can never be read aloud because it is never made on a voice turn.

/**
 * `to` and `subject` are for an email (Ruth, 13 October 2026: "Write the draft
 * email directly into an email client draft with header and email address
 * populated"). The phone opens her own email app with them filled in, and she
 * sends it herself. `to` is only ever an address found in her record or the
 * conversation - see addressIsKnown - and is absent otherwise.
 */
export type Draft = { title: string; body: string; to?: string; subject?: string };

export const DRAFT_SYSTEM = `You are writing something for a person to send, take or use themselves: a message to their GP or consultant, a letter to an insurer, an email, a list of questions to take to an appointment. You are Selodía, a body-literacy app, and you know them through the record below.

WRITE IT AS THEM, in the first person, ready to use. Plain British English, warm and direct. No exclamation marks and no em dashes. Only as long as it needs to be.

USE ONLY WHAT IS IN THE RECORD OR THE CONVERSATION. Never invent a symptom, a date, a dose, a name, a reference number or a result. Where the message needs something that is not known, leave a gap in square brackets saying what goes there, such as [when the pain started], so they can fill it in. A gap is honest. A guess in a medical message is not.

IF A LENGTH LIMIT IS KNOWN, KEEP TO IT. A practice's online form, a text box, a character count that they or the record mention: count, and stay under it.

DO NOT DIAGNOSE. Describe what they have noticed and what they are asking for. Never name a condition in their voice that a clinician has not named in the record.

INCLUDE WHAT THE READER WILL NEED. For a clinician: what is happening, since when, what they have already been told or tried, and what they are asking for. For an insurer or a reception desk: the names and reference numbers in the record.

ASK EACH PARTY ONLY WHAT THAT PARTY CONTROLS.
  ON THE NHS the referral IS the gate, and the GP holds it. A message about getting seen is addressed to the practice.
  PRIVATELY the gate is payment, and the INSURER holds it. The provider needs no referral; they need to be paid. So an email to a private clinic asks about appointments, availability and what things cost. It does NOT ask them whether a referral is needed, and it does not say that cover is still being checked - that reads as doubt about payment and weakens the sender.
  Whether the insurer wants a referral, what is authorised, what the excess is: those are questions for the insurer. They belong in the REPLY as something to do, never inside a letter to a provider.
A draft that asks the wrong party a question gets a wrong answer confidently, and the person acts on it.
AND KEEP THE REGISTER. A consultant appointment is transactional and clinical. So the email is the clinical matter and the booking, and nothing else. No narration of their financial circumstances, no explaining of what they are still sorting out, no apology for asking.

Give it a short title saying what it is and who it is for, such as "Message to your GP about your knee".

IF IT IS AN EMAIL, give it a subject line. Give the address it goes to ONLY when that exact address appears in the record or the conversation. Never guess an address, never build one from a name or a website, and leave it out when it is not known: they will add it themselves.`;

/** Long enough for a letter, short enough to catch a runaway. */
const MAX_TOKENS = 1500;
const MAX_TITLE = 120;
const MAX_BODY = 6000;

/**
 * Clean what came back, in code rather than by asking.
 *
 * A draft goes out in her name, and anything in her name carries no em dashes -
 * her standing rule, which the prompt asks for and this enforces. Empty or
 * absurd output is null rather than half a letter.
 */
export function tidyDraft(raw: unknown): Draft | null {
  const r = (raw ?? {}) as { title?: unknown; body?: unknown; to?: unknown; subject?: unknown };
  if (typeof r.title !== 'string' || typeof r.body !== 'string') return null;
  const title = r.title.replace(/\s*—\s*/g, ' - ').trim().slice(0, MAX_TITLE);
  const body = r.body.replace(/\s*—\s*/g, ' - ').trim();
  if (!title || !body || body.length > MAX_BODY) return null;
  const subject =
    typeof r.subject === 'string' ? r.subject.replace(/\s*—\s*/g, ' - ').trim().slice(0, MAX_SUBJECT) : '';
  const to = typeof r.to === 'string' ? r.to.trim() : '';
  return {
    title,
    body,
    ...(subject ? { subject } : {}),
    ...(EMAIL.test(to) ? { to } : {}),
  };
}

const MAX_SUBJECT = 150;
/** One plain address. Anything else is not an address she can send to. */
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;

/**
 * Is this address actually in what she has given the app?
 *
 * A GUARD AT THE WRITE. The prompt says never guess an address, and a rule the
 * model is asked to follow is not a rule: an email to the wrong address carries
 * her health details to a stranger. So an address survives only when it appears,
 * whole, in her record or the conversation the draft was written from.
 */
export function addressIsKnown(to: string, sources: string[]): boolean {
  const want = to.trim().toLowerCase();
  if (!want) return false;
  return sources.some((s) => typeof s === 'string' && s.toLowerCase().includes(want));
}

/** Whether the draft has gaps left in square brackets for her to fill. */
export function hasGaps(draft: Draft): boolean {
  return /\[[^\]\n]{2,80}\]/.test(draft.body);
}

/**
 * Write the draft. NEVER THROWS: null means it could not be made, and the
 * writer is told so and offers to try again.
 */
export async function writeDraft(req: {
  anthropic: Anthropic;
  model: string;
  /** What she asked for, in the classifier's few words. */
  request: string;
  /** The same conversation the writer gets, ending with her message. */
  messages: Anthropic.MessageParam[];
  /** The same context blocks the writer gets. Empty and absent ones are dropped. */
  contextBlocks: (string | null | undefined)[];
}): Promise<Draft | null> {
  const context = req.contextBlocks
    .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
    .join('\n\n');
  try {
    const res = await req.anthropic.messages.create({
      model: req.model,
      max_tokens: MAX_TOKENS,
      system: [
        DRAFT_SYSTEM,
        `WHAT THEY ASKED FOR: ${req.request}`,
        context ? `THEIR RECORD:\n${context}` : 'THEIR RECORD: nothing relevant is stored yet.',
      ].join('\n\n'),
      messages: req.messages.slice(-8),
      tools: [
        {
          name: 'draft',
          description: 'The finished draft, ready for them to send or use.',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'What it is and who it is for, in a few words.' },
              body: { type: 'string', description: 'The text itself, exactly as they would send it.' },
              subject: { type: 'string', description: 'For an email only: the subject line.' },
              to: {
                type: 'string',
                description:
                  'For an email only: the address it goes to, copied exactly from the record or the conversation. Leave it out when no address is given there. Never guess one.',
              },
            },
            required: ['title', 'body'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'draft' },
    });
    if (res.stop_reason === 'max_tokens') {
      console.log('DRAFT TRUNCATED: hit the token ceiling, discarded rather than shown half-written');
      return null;
    }
    const block = res.content.find((b) => b.type === 'tool_use');
    const draft = tidyDraft(block && block.type === 'tool_use' ? block.input : null);
    if (draft?.to) {
      const said = req.messages.map((m) =>
        typeof m.content === 'string'
          ? m.content
          : m.content.map((c) => (c.type === 'text' ? c.text : '')).join(' ')
      );
      if (!addressIsKnown(draft.to, [context, ...said])) {
        console.log('DRAFT: an address was given that is not in the record or the conversation - removed');
        delete draft.to;
      }
    }
    return draft;
  } catch (err) {
    console.log('DRAFT FAILED:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * What the writer is told, in plain words.
 *
 * NO FIELD NAMES, because the writer has no tools: the last time a block naming
 * a field reached it, it typed the JSON into her message, twice.
 */
export function draftWriterBlock(draft: Draft | null, request: string): string {
  if (!draft) {
    return `They asked for something to be written for them (${request}) and it could not be produced just now. Say so plainly in one sentence and offer to try again. Do not write it out yourself.`;
  }
  const gaps = hasGaps(draft)
    ? ' Mention that the parts in square brackets need filling in before it goes, because nothing was guessed.'
    : '';
  const how =
    draft.subject || draft.to
      ? `"Open in email" opens it in their own email app with ${draft.to ? 'the address and subject' : 'the subject'} filled in, ready for them to read and send${draft.to ? '' : ' - they add the address there, because none was given'}`
      : 'the button under it lets them send it or copy it';
  return `A DRAFT HAS BEEN WRITTEN FOR THEM and is shown directly under your reply, titled "${draft.title}". Do not write it out again and do not go through it line by line. In a sentence or two, say it is there and that ${how}.${gaps}`;
}
