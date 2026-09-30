// WHAT THE APP KNOWS ABOUT THE MENOPAUSE, AND WHERE IT GOT IT.
//
// Ruth, 30 September 2026: "We need to find reliable sources explaining
// everything about menopause perimenopause and HRT and all related hormones
// related to women in this life stage. This should be known within the app and
// referenced, but without slowing it down, especially the Claude interpretation
// layer."
//
// This is the machinery. It ships EMPTY of clinical claims and switched off.
//
// ── THE SHAPE, AND WHY IT IS THIS SHAPE ──────────────────────────────────────
//
// The precedent is drink-composition.ts, and its argument is the right one
// here too: "docs/chat-prompt-history.md records five of six incidents where a
// prompt rule was added and the real cause was a missing fact. The fact exists
// ... It gets passed rather than argued for."
//
// So this is not a wall of menopause text bolted to the system prompt. It is a
// set of short, sourced statements, matched against what she actually said, and
// injected only on the turns that are about it - a few hundred tokens, three or
// four entries, or nothing at all.
//
// ── WHY IT DOES NOT SLOW THE TURN DOWN, which was her condition ──────────────
//
// No database call: the set is small enough to live in the module and be
// matched in memory.
// No second model call, and no embeddings. Vector retrieval is where these
// systems get slow and it buys nothing over keyword matching on a curated set
// of a few hundred entries - the same reasoning as the DRINKS list.
// No extra round trip of any kind. The only cost is input tokens on a turn that
// is already sending thousands, and that cost is capped below.
//
// scripts/bench-clinical-reference.mjs measures it rather than claiming it.
//
// ── THE GATE, AND WHY IT IS NOT NEGOTIABLE ───────────────────────────────────
//
// Ruth's standing rule for the red-flag layer: it stays off until she has read
// the list and a clinician has reviewed it. This content has the same character
// and arguably more of it, so it inherits the same rule, twice over:
//
//   REFERENCE_LAYER_ON is false, so nothing reaches anybody today;
//   and every entry carries `reviewed`, so switching the layer on still does
//   not release an entry a clinician has not signed off.
//
// An entry with no source cannot be constructed - `source` is required - which
// is what stops this quietly becoming a place where the app knows things
// nobody can check.
//
// ── THE BOUNDARY IN THE CONTENT ITSELF ───────────────────────────────────────
//
// Explain what something is and what is generally known. Never advise on her
// own treatment. Nothing in here may suggest starting, stopping or changing
// HRT, a dose, or any medication: that is prescribing, and the app's answer
// there is her GP or a menopause specialist. assertSafeEntry below refuses an
// entry whose text reads as advice, so the rule is enforced on the data rather
// than remembered by whoever adds the next one.

/** A named, checkable source. No entry exists without one. */
export type ReferenceSource = {
  /** The body, as it would be cited: 'NICE', 'British Menopause Society'. */
  name: string;
  /** The specific document, with its identifier where it has one. */
  document: string;
  /** A link somebody can open. */
  url: string;
  /** When this was last checked against the source. */
  checked: string;
};

export type ReferenceEntry = {
  id: string;
  /** Broad subject, for grouping and for the audit report. */
  topic: 'menopause' | 'perimenopause' | 'hrt' | 'hormones' | 'bone' | 'symptoms';
  /** What the turn has to mention for this to be worth sending. */
  match: RegExp[];
  /**
   * The statement itself. Short - one or two sentences. It is read by a model
   * that will paraphrase it, so it must be true when compressed.
   */
  fact: string;
  source: ReferenceSource;
  /** A clinician has read this exact wording. Nothing else is ever sent. */
  reviewed: boolean;
};

/**
 * THE MASTER SWITCH. False until Ruth has read the set and a clinician has
 * reviewed it. Flipping this alone still releases nothing that is not
 * individually `reviewed`.
 */
export const REFERENCE_LAYER_ON = false;

/**
 * At most this many entries on any turn.
 *
 * FOUR IS A BUDGET, NOT A LIMIT DISCOVERED BY TRYING. Each entry is one or two
 * sentences plus its citation - call it 60 tokens - so four is about 250, which
 * is noise beside a prompt that was 11,666 tokens until last week. The cap
 * exists so that a turn mentioning the menopause can never quietly become a
 * turn carrying a textbook.
 */
export const MAX_ENTRIES_PER_TURN = 4;

/**
 * THE ENTRIES. Empty, deliberately.
 *
 * Drafting these is the next piece of work and it is not code: each one needs
 * its wording taken from a named document, its url, the date it was checked,
 * and then a clinician's read. The sources to build from, UK-first because that
 * is Selodía Ltd's clinical and regulatory context:
 *
 *   NICE NG23, Menopause: identification and management
 *   British Menopause Society - consensus statements and tools
 *   RCOG - patient information and scientific impact papers
 *   NHS.uk - for register as much as for content
 *   International Menopause Society - where UK guidance is silent
 *   NOGG - for bone density and fracture risk
 *
 * Every one of those needs its CURRENT version checked before an entry is
 * written from it. Guidance in this area moved materially in 2024 and an entry
 * written from memory is exactly the thing this file exists to prevent.
 */
export const ENTRIES: ReferenceEntry[] = [];

/**
 * An entry that reads as advice is refused at construction.
 *
 * ON THE DATA, NOT IN A COMMENT. The boundary above is easy to agree with and
 * easy to drift across at four in the afternoon while summarising a guideline
 * that itself says "offer". This makes the drift fail loudly.
 */
const ADVICE_SHAPED = [
  /\byou should\b/i,
  /\bshe should\b/i,
  /\bwe recommend\b/i,
  /\bit is recommended\b/i,
  /\b(?:start|stop|switch|increase|reduce|change)\s+(?:your|her|the)\s+(?:hrt|dose|medication|patch|gel)\b/i,
  /\btry\s+(?:taking|a|an)\b/i,
  /\bask your (?:gp|doctor) (?:to|for) (?:prescribe|increase|change)\b/i,
];

export function assertSafeEntry(entry: ReferenceEntry): void {
  if (!entry.source?.url || !entry.source?.name || !entry.source?.document) {
    throw new Error(`Reference entry "${entry.id}" has no checkable source.`);
  }
  for (const re of ADVICE_SHAPED) {
    if (re.test(entry.fact)) {
      throw new Error(
        `Reference entry "${entry.id}" is worded as advice (${re}). This layer states what is ` +
          'known; it never tells her what to do about her own treatment.'
      );
    }
  }
}

/**
 * The entries worth sending for this turn, in declaration order, capped.
 *
 * `text` is what SHE said. Deliberately not the model's draft reply and not the
 * whole history: a reference is pulled because she raised something, not
 * because the app drifted onto it.
 */
export function referenceFor(text: string, limit: number = MAX_ENTRIES_PER_TURN): ReferenceEntry[] {
  if (!REFERENCE_LAYER_ON) return [];
  if (!text) return [];
  const found: ReferenceEntry[] = [];
  for (const entry of ENTRIES) {
    if (!entry.reviewed) continue;
    if (entry.match.some((re) => re.test(text))) {
      found.push(entry);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/**
 * The block, with every statement carrying where it came from.
 *
 * THE CITATION TRAVELS WITH THE FACT rather than sitting in a footer, because
 * the model may use one entry and not another, and a reply that carries a claim
 * without its source is the failure this whole design exists to avoid.
 */
export function referenceBlock(entries: ReferenceEntry[]): string {
  if (entries.length === 0) return '';
  return [
    '',
    'REFERENCE, for accuracy only. These are published statements, not things she told you:',
    ...entries.map((e) => `- ${e.fact} [${e.source.name}, ${e.source.document}]`),
    'Use these to avoid saying something untrue. Name the source if you state one of them. Never turn one into advice about her own treatment, and never suggest starting, stopping or changing any medication.',
    '',
  ].join('\n');
}
