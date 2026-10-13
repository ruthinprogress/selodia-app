// A draft as the phone receives it, from a live reply or a stored row.
//
// Validated rather than trusted: it arrives from the network or from a jsonb
// column, and a card drawn from half a draft would show her a broken letter
// under a reply that said "here it is". Anything not exactly a title and a body
// draws nothing. See app/lib/draft.ts for how one is written.

/** `to` and `subject` arrive on an email. See app/lib/draft.ts. */
export type Draft = { title: string; body: string; to?: string; subject?: string };

export function asDraft(v: unknown): Draft | null {
  if (!v || typeof v !== 'object') return null;
  const { title, body, to, subject } = v as { title?: unknown; body?: unknown; to?: unknown; subject?: unknown };
  if (typeof title !== 'string' || typeof body !== 'string') return null;
  if (!title.trim() || !body.trim()) return null;
  return {
    title,
    body,
    ...(typeof to === 'string' && to.trim() ? { to: to.trim() } : {}),
    ...(typeof subject === 'string' && subject.trim() ? { subject: subject.trim() } : {}),
  };
}

/**
 * The link that opens her own email app with the draft filled in. Nothing is
 * sent: the app opens a draft, and the send button is hers.
 */
export function mailtoFor(d: Draft): string {
  const params = [
    d.subject ? `subject=${encodeURIComponent(d.subject)}` : null,
    `body=${encodeURIComponent(d.body)}`,
  ].filter(Boolean);
  return `mailto:${d.to ? encodeURIComponent(d.to).replace('%40', '@') : ''}?${params.join('&')}`;
}

/** An email is a draft with a subject or an address; anything else is a message. */
export function isEmail(d: Draft): boolean {
  return Boolean(d.subject || d.to);
}
