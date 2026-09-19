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

export type MeHistoryEvent = { date: string; status: MeStatus | null; reason: string | null };

export type MeCard = {
  why: string | null;
  status: MeStatus | null;
  detail: string | null;
  /**
   * How it has changed, oldest first, as told in conversation. The first entry
   * may carry no date: it is the state the card was saved in, recorded the
   * first time it changed so the story has a beginning.
   */
  history: MeHistoryEvent[];
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
    return { why: null, status: null, detail: null, history: [] };
  }
  const o = content as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? (o.history as unknown[])
        .filter((h): h is Record<string, unknown> => h != null && typeof h === 'object')
        .map((h) => ({
          date: typeof h.date === 'string' ? h.date : '',
          status: status(h.status),
          reason: str(h.reason),
        }))
    : [];
  return {
    // `summary` is read as a fallback because that is the shape every other
    // conversational save uses, and an early Me card may carry it.
    why: str(o.why) ?? str(o.summary),
    status: status(o.status),
    detail: str(o.detail),
    history,
  };
}

/** Section name for a card, or the honest fallback when it was saved without one. */
export function sectionOf(category: string | null | undefined): string {
  const t = str(category);
  return t ?? 'Everything else';
}
