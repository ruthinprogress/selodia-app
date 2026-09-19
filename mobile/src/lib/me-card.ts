// Reading a Me card on the phone.
//
// Mirrors app/lib/me-card.ts, which validates one on the way in. The same
// Next/Expo boundary duplication already accepted for working weights, body
// metrics and cycle: the server decides what may be stored, and this decides
// what can be drawn from what was.
//
// IT IS FORGIVING WHERE THE SERVER IS STRICT, and that is the right way round. A
// card saved before a field existed still renders; a card the server would
// refuse to write today still appears rather than vanishing from somebody's own
// protocol.

export const ME_STATUSES = [
  'Taking',
  'Ordered',
  'Dietary source',
  'As needed',
  'Active',
  'Paused',
] as const;

export type MeStatus = (typeof ME_STATUSES)[number];

export type MeCard = {
  why: string | null;
  status: MeStatus | null;
  detail: string | null;
};

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

function status(v: unknown): MeStatus | null {
  const t = str(v)?.toLowerCase();
  if (!t) return null;
  return ME_STATUSES.find((s) => s.toLowerCase() === t) ?? null;
}

export function readMeCard(content: unknown): MeCard {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) {
    return { why: null, status: null, detail: null };
  }
  const o = content as Record<string, unknown>;
  return {
    // `summary` is read as a fallback because that is the shape every other
    // conversational save uses, and an early Me card may carry it.
    why: str(o.why) ?? str(o.summary),
    status: status(o.status),
    detail: str(o.detail),
  };
}

/** Section name for a card, or the honest fallback when it was saved without one. */
export function sectionOf(category: string | null | undefined): string {
  const t = str(category);
  return t ?? 'Everything else';
}
