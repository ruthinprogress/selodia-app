// A draft as the phone receives it, from a live reply or a stored row.
//
// Validated rather than trusted: it arrives from the network or from a jsonb
// column, and a card drawn from half a draft would show her a broken letter
// under a reply that said "here it is". Anything not exactly a title and a body
// draws nothing. See app/lib/draft.ts for how one is written.

export type Draft = { title: string; body: string };

export function asDraft(v: unknown): Draft | null {
  if (!v || typeof v !== 'object') return null;
  const { title, body } = v as { title?: unknown; body?: unknown };
  if (typeof title !== 'string' || typeof body !== 'string') return null;
  if (!title.trim() || !body.trim()) return null;
  return { title, body };
}
