import Anthropic from '@anthropic-ai/sdk';

// READING A LETTER SHE WAS GIVEN (Ruth, 20 September 2026).
//
// Her own account is the brief: she had a consultant letter with MRI results,
// photographed it, and asked another assistant to explain it, "because I didn't
// understand the letter fully tbh. This is something selodia needs to be able
// to do to help ppl."
//
// WHAT IS KEPT, AND WHY IT IS MORE THAN A SUMMARY. Asked whether the document
// itself should be stored, she said the summary only - but with a condition
// that changes the whole shape of this file:
//
//   "it needs to keep the information that makes the letter not needed, so
//   insurance numbers and all of the details that can make the thread
//   verifiable on a phone call or visit to a clinic. Otherwise it's not
//   helpful. You should be able to ask selodia: I've been having weird
//   symptoms in x again, can you remind me how to get seen?"
//
// So this is not a reading-comprehension exercise. The record has to be good
// enough to STAND IN for the letter at a reception desk: who saw her, at which
// hospital, under which number, what they found, what was agreed, and the route
// back in. A summary that explains the findings beautifully and loses the
// hospital number has failed at the thing she asked for.
//
// THREE KINDS OF CONTENT, KEPT APART ON PURPOSE:
//
//   1. WHAT THE LETTER SAYS - in the letter's own words, quoted, not rephrased.
//   2. WHAT THAT MEANS - ordinary language for the clinical vocabulary, and
//      nothing else. Explaining that a disc bulge is a cushion between two
//      bones pressing outward is translation. Saying what it will do next, or
//      what she should do about it, is not, and is forbidden below.
//   3. WHAT TO QUOTE - numbers, names and contacts, transcribed exactly.
//
// The report's summary earned that separation the hard way: figures and prose
// are different kinds of claim and must not be produced by the same act. Here
// the stakes are higher, because a wrong digit in a hospital number is read
// aloud to a receptionist and wastes an appointment.
//
// WHICH IS WHY THE NUMBERS ARE READ TWICE. See confirmReferences().

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sonnet, not Haiku. This is dense typed prose, often a phone photograph at an
// angle, and the cost of a misread is somebody ringing a hospital with the
// wrong number. The food photo path made the same call for the same reason.
const MODEL = 'claude-sonnet-5';

export const DOCUMENT_KINDS = [
  'consultant letter',
  'imaging report',
  'test results',
  'discharge summary',
  'referral',
  'appointment letter',
  'prescription',
  'other',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * A number, name or address she may need to quote. `confirmed` is true only
 * when two independent readings of the page agreed on it character for
 * character - see confirmReferences().
 */
export type ClinicalReference = { label: string; value: string; confirmed: boolean };

export type ClinicalDocument = {
  kind: DocumentKind;
  /** A short name for the record, e.g. "Cervical spine MRI - Neurosurgery". */
  title: string;
  /** The date on the letter, ISO, or null when it cannot be read. */
  dated: string | null;
  /** One line on what the document concerns. */
  about: string | null;
  clinician: { name: string | null; role: string | null; department: string | null; organisation: string | null };
  contact: { phone: string | null; email: string | null; secretary: string | null; address: string | null };
  references: ClinicalReference[];
  /** What the letter states, in its own words. */
  says: string[];
  /** The clinical vocabulary above, in ordinary language. Never a prognosis. */
  plainWords: string | null;
  /** What was decided or arranged. */
  plan: string[];
  /** When she will be seen again, as the letter puts it. */
  review: string | null;
  /** The route back in if symptoms return - the thing she asked for by name. */
  routeBackIn: string | null;
  medications: string[];
  /** Anything the photograph could not resolve, said plainly rather than guessed. */
  unreadable: string[];
};

const EXTRACT = `You are reading a medical document that somebody has photographed or uploaded into their own health app. They are keeping a record of it so that they do not have to keep the paper.

WHO YOU ARE WRITING FOR
The person the letter is about. They may not have understood it. They are not a clinician and should not be addressed as one.

THE RECORD HAS TO REPLACE THE LETTER
They told us why: they want to be able to ring the clinic, or turn up at a desk, or say "these symptoms are back, how do I get seen again", using only what you extract. So the administrative detail matters as much as the findings. Hospital numbers, NHS numbers, insurance or policy numbers, appointment references, the consultant's name and department, the secretary's telephone number, the clinic address - all of it, exactly as printed.

TRANSCRIBE, DO NOT REMEMBER
Every number, name and address must be copied character for character from what you can see. Never complete a number that is partly obscured. Never normalise a format. Never supply a number that "looks like" an NHS number. If a digit is genuinely unreadable, leave that reference out and say so in "unreadable" instead. A plausible wrong number is the worst thing you can produce here, because it will be read aloud to a receptionist.

THREE KINDS OF CONTENT, KEPT APART
- "says": what the letter states, in ITS words. Quote or closely paraphrase; do not soften, do not sharpen, do not add.
- "plainWords": the clinical vocabulary of those statements, in ordinary English. This is translation only. "A disc bulge at C5/C6" becomes "one of the cushions between the bones in the neck is pressing outward". You may explain what a term means, what an abbreviation stands for, and where in the body something is.
- "plan", "review", "routeBackIn": what was arranged, as arranged.

WHAT YOU MUST NOT DO
- Do not diagnose, and do not add a diagnosis the letter does not state.
- Do not give a prognosis. Not "this usually improves", not "this is not serious", not "this can worsen". The letter says what it says.
- Do not advise, recommend, reassure or alarm. If the letter reassures, report that the letter reassures.
- Do not resolve a contradiction in the document. Report both parts.
- Do not fill a gap with what is usually true of documents like this one.

IF YOU CANNOT READ IT
Say so in "unreadable", in specific terms: "the second page is cut off at the left margin", "the date stamp is blurred". An honest gap is useful; a confident guess is not. If the image is not a medical document at all, return kind "other" with an empty record and say what it appears to be in "unreadable".

Return British English. Write dates as YYYY-MM-DD when you can read them.`;

const READ_NUMBERS = `You are transcribing ONLY the identifying details from a medical document: reference numbers, names, departments, telephone numbers, email addresses and postal addresses.

Copy each one exactly as printed, character for character, including spaces and punctuation. Do not reformat. Do not correct. Do not complete anything partly obscured - leave it out entirely.

Ignore the clinical content completely. You are a transcriber, not a reader.`;

type Source =
  | { type: 'image'; mediaType: string; base64: string }
  | { type: 'pdf'; base64: string };

function content(sources: Source[]): Anthropic.ContentBlockParam[] {
  return sources.map((s) =>
    s.type === 'pdf'
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: s.base64 },
        } as Anthropic.ContentBlockParam)
      : ({
          type: 'image',
          source: { type: 'base64', media_type: s.mediaType as 'image/png', data: s.base64 },
        } as Anthropic.ContentBlockParam)
  );
}

const TOOL: Anthropic.Tool = {
  name: 'record_document',
  description: 'Record what this medical document says and the details needed to act on it.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: [...DOCUMENT_KINDS] },
      title: { type: 'string', description: 'A short name for this record.' },
      dated: { type: ['string', 'null'], description: 'The date on the document, YYYY-MM-DD.' },
      about: { type: ['string', 'null'], description: 'One line on what it concerns.' },
      clinician: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] },
          role: { type: ['string', 'null'] },
          department: { type: ['string', 'null'] },
          organisation: { type: ['string', 'null'] },
        },
      },
      contact: {
        type: 'object',
        properties: {
          phone: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          secretary: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
        },
      },
      references: {
        type: 'array',
        description: 'Every identifying number, transcribed exactly.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'What it is, as the document labels it.' },
            value: { type: 'string', description: 'Exactly as printed.' },
          },
          required: ['label', 'value'],
        },
      },
      says: { type: 'array', items: { type: 'string' }, description: "What the letter states, in its words." },
      plainWords: { type: ['string', 'null'], description: 'The clinical vocabulary in ordinary English. Translation only.' },
      plan: { type: 'array', items: { type: 'string' } },
      review: { type: ['string', 'null'] },
      routeBackIn: { type: ['string', 'null'], description: 'How to be seen again, as the document puts it.' },
      medications: { type: 'array', items: { type: 'string' } },
      unreadable: { type: 'array', items: { type: 'string' } },
    },
    required: ['kind', 'title', 'says', 'references', 'unreadable'],
  },
};

const NUMBERS_TOOL: Anthropic.Tool = {
  name: 'transcribe_details',
  description: 'Transcribe the identifying details exactly as printed.',
  input_schema: {
    type: 'object',
    properties: {
      references: {
        type: 'array',
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, value: { type: 'string' } },
          required: ['label', 'value'],
        },
      },
    },
    required: ['references'],
  },
};

function str(v: unknown, max = 400): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

// A MODEL WRITING JSON SOMETIMES WRITES THE ESCAPE RATHER THAN THE BREAK, and
// her MRI report came back with a literal backslash-n between every paragraph,
// printed as characters in the middle of the explanation. Nothing downstream
// can tell the difference, so it is fixed here, once.
const NL = String.fromCharCode(10);
const ESCAPED_BREAK = new RegExp(String.raw`\\r\\n|\\n|\\r`, 'g');
const MANY_BREAKS = new RegExp(`${NL}{3,}`, 'g');

export function tidy(v: string | null): string | null {
  if (!v) return null;
  return v.replace(ESCAPED_BREAK, NL).replace(MANY_BREAKS, NL + NL).trim() || null;
}

// "NOT STATED IN THIS DOCUMENT" IS NOT A VALUE, it is the absence of one - and
// printed into a card it becomes a heading with a shrug under it. The letter
// either says when she will be reviewed or it does not, and if it does not the
// line has no business on the page.
const ABSENT = /^(not (stated|specified|mentioned|given|recorded|available|documented)|none( stated| specified)?|n\/?a|unknown|unspecified)/i;

export function stated(v: string | null): string | null {
  if (!v) return null;
  return ABSENT.test(v.trim()) ? null : v;
}

function strings(v: unknown, max = 30): string[] {
  return Array.isArray(v)
    ? v.map((x) => str(x, 1000)).filter((x): x is string => x !== null).slice(0, max)
    : [];
}

/**
 * HOW TWO READINGS OF THE SAME NUMBER ARE COMPARED. Spaces, punctuation and
 * case are noise on a page - "NHS 123 456 7890" and "NHS1234567890" are one
 * number - but a digit is never noise.
 */
export function sameValue(a: string, b: string): boolean {
  const clean = (v: string) => v.replace(/[\s.,\-/()]/g, '').toLowerCase();
  return clean(a) === clean(b);
}

/** Just the digits, which is the part of a reference that can be wrong. */
export function digitsOf(value: string): string {
  return (value.match(/\d/g) ?? []).join('');
}

/**
 * THE GUARD: SILENT UNLESS THE TWO READINGS CONTRADICT EACH OTHER.
 *
 * The page is still transcribed twice by two calls that cannot see each other,
 * because there is no stored truth to check a letter against and another
 * reading is the only check available. What changed on 21 September is WHEN
 * that produces a mark.
 *
 * It first marked anything the second reading had not independently confirmed.
 * On her real MRI report that flagged TEN of FOURTEEN details - her own name,
 * her sex, the hospital's telephone number - because the two prompts naturally
 * label things differently, not because anything disagreed. Her verdict was
 * exactly right:
 *
 *   "lots of comments that it needs to be checked - this is terrible UI, it
 *   needs to just get it right ... or it's actually just useless and will not
 *   be trusted."
 *
 * She is describing the failure mode of a smoke alarm that goes off when you
 * make toast. A warning on ten of fourteen lines is not caution, it is noise,
 * and it teaches the reader to skip every warning including a real one.
 *
 * So a mark now means ONE thing: both readings found this field and they do not
 * agree about its digits. Silence means no contradiction was found - which is
 * what it honestly means, and is all a second reading can ever tell you.
 * Anything with no digits in it is never marked at all, because two readings
 * wording an address differently is not a disagreement about the address.
 */
export function confirmReferences(
  first: { label: string; value: string }[],
  second: { label: string; value: string }[]
): ClinicalReference[] {
  const out: ClinicalReference[] = [];
  const claimed = new Set<string>();

  for (const ref of first) {
    // ONE ENTRY PER FIELD, decided on the first reading. Without this, a model
    // that read the hospital number off the letterhead and again off the
    // footer, transcribing them a digit apart, put BOTH on the card - one
    // marked confirmed and one not. Two "Hospital number:" lines is the record
    // becoming a puzzle to solve at a reception desk, which is the one thing
    // this file is written to prevent.
    const label = sameLabel(ref.label);
    if (claimed.has(label)) continue;
    claimed.add(label);

    out.push({
      label: ref.label,
      value: ref.value,
      // THE LABEL IS PART OF THE CLAIM, and leaving it out made this guard
      // confirm the wrong thing entirely. It used to ask "did this string
      // appear anywhere in the second reading?", which is not the question.
      // An NHS number and a hospital number sit side by side on an NHS letter
      // and look alike; a reading that SWAPPED them contains both strings, so
      // both came back confirmed, printed under the wrong headings with no
      // warning - and the offer line then told her the two readings agreed.
      // Two readings that disagree about what a number IS were being reported
      // as agreement, which is worse than having no second reading at all.
      confirmed: !contradicted(ref, second),
    });
  }

  // THE SECOND READING CONTRIBUTES NOTHING OF ITS OWN. It exists to disagree,
  // not to add. The two prompts name things differently, so anything it found
  // and the extraction did not arrived as a near-duplicate row - "Name" beside
  // "Patient name" - with the newcomer marked to check. Two lines for one fact,
  // one of them wearing a warning, is exactly the noise that made her say the
  // feature would not be trusted.

  // A ceiling on one letter, set well above any letter. It used to be 20, which
  // a busy letterhead can reach on its own - and because the second reading's
  // finds are appended last, the cap cut exactly the details only one reading
  // saw, silently. Forty is beyond anything a real document carries.
  return out.slice(0, 40);
}

/** Two names for the same field. Case and spacing are how a page is printed. */
function sameLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * True only when the second reading found THIS field and read different digits
 * in it. Everything else - a field the second reading did not report, a field
 * with no digits, a difference in punctuation or wording - is not a
 * contradiction and says nothing.
 */
function contradicted(
  ref: { label: string; value: string },
  second: { label: string; value: string }[]
): boolean {
  const mine = digitsOf(ref.value);
  if (!mine) return false;
  const label = sameLabel(ref.label);
  const rival = second.find((o) => sameLabel(o.label) === label && digitsOf(o.value));
  return Boolean(rival && digitsOf(rival.value) !== mine);
}

function toolInput(reply: Anthropic.Message, name: string): Record<string, unknown> | null {
  for (const part of reply.content) {
    if (part.type === 'tool_use' && part.name === name) {
      return part.input as Record<string, unknown>;
    }
  }
  return null;
}

export type ReadResult =
  | { ok: true; document: ClinicalDocument }
  | { ok: false; reason: 'unreadable' | 'failed' };

/**
 * Reads one document, which may be several photographed pages or a PDF.
 * The two readings run together: the second is cheap and the wait is one wait.
 */
export async function readClinicalDocument(sources: Source[]): Promise<ReadResult> {
  if (sources.length === 0) return { ok: false, reason: 'failed' };

  let main: Anthropic.Message;
  let numbers: Anthropic.Message;
  try {
    [main, numbers] = await Promise.all([
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: EXTRACT,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'record_document' },
        messages: [{ role: 'user', content: content(sources) }],
      }),
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 1200,
        system: READ_NUMBERS,
        tools: [NUMBERS_TOOL],
        tool_choice: { type: 'tool', name: 'transcribe_details' },
        messages: [{ role: 'user', content: content(sources) }],
      }),
    ]);
  } catch (err) {
    console.log('DOCUMENT: could not be read -', err instanceof Error ? err.message : err);
    return { ok: false, reason: 'failed' };
  }

  const got = toolInput(main, 'record_document');
  if (!got) return { ok: false, reason: 'failed' };

  const rawRefs = Array.isArray(got.references)
    ? (got.references as Record<string, unknown>[])
        .map((r) => ({ label: str(r.label, 80), value: str(r.value, 80) }))
        .filter((r): r is { label: string; value: string } => Boolean(r.label && r.value))
    : [];

  const secondRefs = (() => {
    const input = toolInput(numbers, 'transcribe_details');
    return Array.isArray(input?.references)
      ? (input.references as Record<string, unknown>[])
          .map((r) => ({ label: str(r.label, 80), value: str(r.value, 80) }))
          .filter((r): r is { label: string; value: string } => Boolean(r.label && r.value))
      : [];
  })();

  const clinician = (got.clinician ?? {}) as Record<string, unknown>;
  const contact = (got.contact ?? {}) as Record<string, unknown>;

  const document: ClinicalDocument = {
    kind: (DOCUMENT_KINDS as readonly string[]).includes(got.kind as string)
      ? (got.kind as DocumentKind)
      : 'other',
    title: str(got.title, 120) ?? 'A medical document',
    dated: /^\d{4}-\d{2}-\d{2}$/.test(String(got.dated)) ? (got.dated as string) : null,
    about: stated(str(got.about, 300)),
    clinician: {
      name: str(clinician.name, 120),
      role: str(clinician.role, 120),
      department: str(clinician.department, 120),
      organisation: str(clinician.organisation, 160),
    },
    contact: {
      phone: str(contact.phone, 60),
      email: str(contact.email, 120),
      secretary: str(contact.secretary, 160),
      address: str(contact.address, 300),
    },
    references: confirmReferences(rawRefs, secondRefs),
    says: strings(got.says),
    plainWords: tidy(str(got.plainWords, 12000)),
    plan: strings(got.plan),
    review: stated(str(got.review, 300)),
    routeBackIn: stated(str(got.routeBackIn, 400)),
    medications: strings(got.medications, 20),
    unreadable: strings(got.unreadable, 10),
  };

  // NOTHING WORTH KEEPING is a real answer, and a different one from a failure:
  // a photograph of a fridge, or a page too dark to read, should not become an
  // empty card in her record.
  const hasSubstance =
    document.says.length > 0 ||
    document.references.length > 0 ||
    document.plan.length > 0 ||
    Boolean(document.clinician.name || document.clinician.organisation);
  if (!hasSubstance) return { ok: false, reason: 'unreadable' };

  return { ok: true, document };
}
