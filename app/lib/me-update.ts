import type { SupabaseClient } from '@supabase/supabase-js';

import { coerceStatus, type MeStatus } from './me-card';

// CHANGING A ME CARD BY SAYING SO (Me brief, "Updating items"; built 2026-09-19).
//
// "Items evolve. Status changes. Decisions get revised." The brief's example is
// the one that matters: "I've stopped taking magnesium, it wasn't helping" moves
// the card to Paused, and the date and the reason go into its history.
//
// NO OFFER FIRST, unlike adding. Telling Selodia you have stopped something IS
// the instruction - the same reasoning that saves a note on request - and asking
// "shall I mark that as paused?" about a thing she has just said she stopped
// would be a question with only one answer.
//
// NOTHING IS DELETED. A paused supplement keeps its place and its reason,
// because "a paused supplement with a reason is more informative than a blank
// space". The history is appended to, never rewritten, so the card can say it
// was taken from October, paused in March because it wasn't helping, and taken
// again in November.
//
// IT FINDS THE CARD OR IT SAYS SO. A change applied to the wrong card is worse
// than no change, so the match is conservative - see findMeCard - and when it
// fails the app tells her plainly rather than letting the model's reply imply it
// was done.

export type MeCardRow = { id: string; title: string; content: unknown };

export type MeHistoryEvent = { date: string; status: MeStatus | null; reason: string | null };

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Which card does she mean?
 *
 * Exact title first. Then a card whose title contains what was said, or is
 * contained by it - "magnesium" finds "Magnesium glycinate", and "my evening
 * skincare" finds "Evening skincare". More than one candidate is a question for
 * her, never a coin toss: stopping the wrong supplement in somebody's own record
 * is exactly the kind of quiet error this app exists not to make.
 */
export function findMeCard(said: string, cards: MeCardRow[]): MeCardRow | 'ambiguous' | null {
  const s = norm(said);
  if (!s) return null;

  const exact = cards.filter((c) => norm(c.title) === s);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return 'ambiguous';

  const near = cards.filter((c) => {
    const t = norm(c.title);
    return t.length > 0 && (t.includes(s) || s.includes(t));
  });
  if (near.length === 1) return near[0];
  if (near.length > 1) return 'ambiguous';
  return null;
}

/** The card's content with a status change applied and remembered. */
export function applyChange(
  content: unknown,
  change: { status: MeStatus | null; reason: string | null; date: string }
): Record<string, unknown> {
  const base =
    content != null && typeof content === 'object' && !Array.isArray(content)
      ? { ...(content as Record<string, unknown>) }
      : {};

  const history = Array.isArray(base.history) ? [...(base.history as MeHistoryEvent[])] : [];

  // The card's first state is written into the history the first time it
  // changes, so the story has a beginning rather than starting mid-way.
  if (history.length === 0 && base.status) {
    history.push({ date: '', status: coerceStatus(base.status), reason: null });
  }

  history.push({ date: change.date, status: change.status, reason: change.reason });

  return {
    ...base,
    ...(change.status ? { status: change.status } : {}),
    history,
  };
}

export type MeUpdateResult =
  | { kind: 'updated'; title: string; status: MeStatus | null }
  | { kind: 'unchanged'; title: string; status: MeStatus | null }
  | { kind: 'ambiguous'; said: string }
  | { kind: 'not_found'; said: string };

export async function updateMeCard(
  supabase: SupabaseClient,
  userId: string,
  input: { title: string; status: unknown; reason: unknown; today: string }
): Promise<MeUpdateResult> {
  const { data, error } = await supabase
    .from('almanac_entries')
    .select('id, title, content')
    .eq('user_id', userId)
    .eq('kind', 'me');
  if (error) {
    console.log('ME UPDATE: could not read cards -', error.message);
    return { kind: 'not_found', said: input.title };
  }

  const match = findMeCard(input.title, (data ?? []) as MeCardRow[]);
  if (match === 'ambiguous') return { kind: 'ambiguous', said: input.title };
  if (!match) return { kind: 'not_found', said: input.title };

  const status = coerceStatus(input.status);
  const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : null;

  // Saying the same thing twice - "I'm still taking the D3" - changes nothing,
  // and must not grow the history by one identical line every time it is said.
  const current =
    match.content && typeof match.content === 'object'
      ? coerceStatus((match.content as Record<string, unknown>).status)
      : null;
  if (status && status === current && !reason) {
    return { kind: 'unchanged', title: match.title, status };
  }

  const content = applyChange(match.content, { status, reason, date: input.today });
  const { error: upErr } = await supabase
    .from('almanac_entries')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', match.id)
    .eq('user_id', userId);
  if (upErr) {
    console.log('ME UPDATE: write failed -', upErr.message);
    return { kind: 'not_found', said: input.title };
  }
  return { kind: 'updated', title: match.title, status: status ?? current };
}

/** What she is told, written by the app because the reply was written first. */
export function meUpdateNote(result: MeUpdateResult): string {
  switch (result.kind) {
    case 'updated':
      return result.status
        ? `Updated in your Me tab: ${result.title} is now ${result.status}.`
        : `Updated in your Me tab: ${result.title}.`;
    case 'unchanged':
      return `${result.title} already says ${result.status} in your Me tab, so I've left it.`;
    case 'ambiguous':
      return `More than one card in your Me tab could be "${result.said}", so I haven't changed any of them. Which one did you mean?`;
    case 'not_found':
      return `I couldn't find "${result.said}" in your Me tab, so nothing has changed there.`;
  }
}
