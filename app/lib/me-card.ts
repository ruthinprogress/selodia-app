// A card in the Me tab (Part Ten, Me brief confirmed 2026-09-12).
//
// WHAT ME IS, in Ruth's words: "the user's personal protocol - the stable
// reference for how she is supposed to be living. Not a log of what happened,
// not live data." Supplements, skincare, nutrition decisions, a weekly call with
// a friend. She returns to it when she has drifted and needs to re-anchor.
//
// WHY IT HAS NEVER WORKED. A skincare routine saved into Insights twice, which
// she reported as a routing bug on 18 September. It is not a routing bug: there
// has never been a pathway. insights.ts sorts an entry into Me when its kind is
// "me", and its own comment said "Nothing carries it yet, so every Me list is
// empty". Nothing in the chat route could write one.
//
// TWO LAYERS, and the second is the point. The surface is the name, the status
// and the section. Tapping shows WHY it was added, drafted from the conversation
// that settled it. The brief says why: "these are the boring-but-important
// things. Easy to deprioritise without the why. The card holds the reasoning so
// the user doesn't have to remember it."

// STATUS IS A CLOSED LIST, and one of the few in this app (Ruth's answer 5,
// 2026-09-12): "No ticks. Status in words only: Taking, Ordered, Dietary
// source, As needed, Paused" - with Active kept as well for a recurring
// commitment such as a weekly call. Closed because these six are the whole
// vocabulary of a protocol, and an invented seventh would be the model deciding
// how she relates to her own decision.
export const ME_STATUSES = [
  'Taking',
  'Ordered',
  'Dietary source',
  'As needed',
  'Active',
  'Paused',
] as const;

export type MeStatus = (typeof ME_STATUSES)[number];

export function coerceStatus(v: unknown): MeStatus | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  return ME_STATUSES.find((s) => s.toLowerCase() === t) ?? null;
}

// SECTIONS ARE OPEN, and deliberately (principle 13). The brief names five -
// Nutrition, Supplements, Skincare, Wellbeing, Relationships - and then says
// "any other section that emerges from conversation", created automatically when
// its first card arrives. A closed list here would mean somebody's
// physiotherapy exercises had nowhere to live.
export const ME_SECTION_EXAMPLES = [
  'Nutrition',
  'Supplements',
  'Skincare',
  'Wellbeing',
  'Relationships',
] as const;

const MAX_SECTION = 40;
const MAX_WHY = 600;

/** Title Case for a section name, so "supplements" and "Supplements" are one. */
export function normaliseSection(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length === 0 || t.length > MAX_SECTION) return null;
  // Matched case-insensitively against the known five, so the model writing
  // "skincare" lands in the same section as "Skincare" rather than beside it.
  const known = ME_SECTION_EXAMPLES.find((s) => s.toLowerCase() === t.toLowerCase());
  if (known) return known;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export type MeCardContent = {
  /** Why it was added, from the conversation that settled it. */
  why: string;
  /** Where relevant. A weekly call has no status; a supplement does. */
  status: MeStatus | null;
  /** Anything else worth holding: her own words, a value she quoted. */
  detail: string | null;
};

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

/**
 * Read a stored Me card, or null when the content is not one.
 *
 * WHY IS REQUIRED. A card with a name and no reason is a checklist item, and the
 * brief is explicit that Me is not a checklist. If the conversation did not
 * settle a reason, there was no decision moment and nothing should be saved.
 */
export function readMeCard(content: unknown): MeCardContent | null {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) return null;
  const o = content as Record<string, unknown>;
  const why = str(o.why) ?? str(o.summary);
  if (!why) return null;
  return {
    why: why.slice(0, MAX_WHY),
    status: coerceStatus(o.status),
    detail: str(o.detail),
  };
}
