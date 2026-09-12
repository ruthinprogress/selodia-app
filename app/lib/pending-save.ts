import type { SupabaseClient } from '@supabase/supabase-js';

import { saveAlmanacEntry } from './almanac';

// The conversational save (build spec, Part Ten: Insights slice 2, 2026-09-12).
//
// Selodía notices something worth keeping, OFFERS to keep it, and keeps it only
// when the person says yes. Ruth's answer to the Insights review: "The AI
// recognises the moment and offers to save. The user confirms. Not automatic,
// not a manual tap on a raw entry." Built once, here, so Me and Movement can
// reuse it rather than each growing their own.
//
// THE OFFER IS STORED, NOT REMEMBERED. Until this existed, an Almanac save relied
// on the model asking, remembering what it had asked, and emitting the save only
// after a yes. Nothing checked that what it saved was what it had offered. It is
// the weakness focus-states.ts closed for Fat and Muscle Focus: the database
// holds the offer, the model only reports whether the answer was yes, and the
// app saves exactly what was offered. The model observes; the app decides.
//
// PLANS DO NOT COME THROUGH HERE YET. A workout plan is still saved the older
// way, emitted after agreement, because that flow works and the Movement build
// replaces it. This covers the Insights types a person confirms. Roundups are
// written by the Sunday job (slice 3) and never offered.

export type SaveType = 'symptom' | 'insight' | 'note';
export const SAVE_TYPES: readonly SaveType[] = ['symptom', 'insight', 'note'];

export function coerceSaveType(v: unknown): SaveType | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  return (SAVE_TYPES as readonly string[]).includes(t) ? (t as SaveType) : null;
}

export type ProposedSave = { type: SaveType; title: string; content: Record<string, unknown> };

const MAX_TITLE = 80;

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
};

/**
 * Validate what the model proposed, or null when it is not a real, saveable offer.
 * Coerced rather than thrown, like every model field in the chat route.
 */
export function coerceProposal(v: unknown): ProposedSave | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const type = coerceSaveType(o.type);
  const title = str(o.title);
  if (!type || !title) return null;

  let content: Record<string, unknown>;
  if (typeof o.content === 'string') {
    const t = o.content.trim();
    if (!t) return null;
    content = { summary: t };
  } else if (o.content != null && typeof o.content === 'object' && !Array.isArray(o.content)) {
    content = o.content as Record<string, unknown>;
  } else {
    return null;
  }

  // An insight is a rule or it is not an insight: a condition AND an expectation,
  // so it can later change how a reading is read (Part Five, Result vs
  // Observation vs Insight). Without both it is an observation, which is not
  // saved.
  if (type === 'insight' && !(str(content.condition) && str(content.expectation))) return null;
  // A symptom or a note carries what was actually said, or there is nothing to keep.
  if (type !== 'insight' && !str(content.summary)) return null;

  return { type, title: title.slice(0, MAX_TITLE), content };
}

/**
 * A note the person ASKED for ("log a note: I feel really good today") is saved on
 * the spot, because the request is the confirmation (Ruth, Insights answer 5).
 * Her words are kept exactly; the title is the first sentence, cut short if it
 * runs long, so a card can show it on one line.
 */
export function prepareNote(text: unknown): ProposedSave | null {
  const t = str(text);
  if (!t) return null;
  const first = t.split(/(?<=[.!?])\s/)[0] ?? t;
  const title = first.length > 60 ? `${first.slice(0, 59).trimEnd()}…` : first;
  return { type: 'note', title, content: { summary: t } };
}

// An offer to keep something belongs to the conversation it came from. Two days,
// shorter than Focus's week: a yes on Thursday to something offered on Monday is
// almost certainly a yes to something else.
const PENDING_TTL_HOURS = 48;

export type PendingSave = { proposal: ProposedSave | null; askedAt: string | null };
export type PendingSaveProfile = { pending_save?: unknown; pending_save_asked_at?: string | null };

export function readPendingSave(profile: PendingSaveProfile | null): PendingSave {
  const askedAt = profile?.pending_save_asked_at ?? null;
  if (!askedAt) return { proposal: null, askedAt: null };
  const age = Date.now() - new Date(askedAt).getTime();
  if (!Number.isFinite(age) || age > PENDING_TTL_HOURS * 3_600_000) {
    return { proposal: null, askedAt: null };
  }
  const proposal = coerceProposal(profile?.pending_save);
  return proposal ? { proposal, askedAt } : { proposal: null, askedAt: null };
}

const TYPE_WORD: Record<SaveType, string> = {
  symptom: 'a symptom',
  insight: 'an insight',
  note: 'a note',
};

/**
 * What the model is told while an offer is outstanding. It states the offer as a
 * fact, because the app made it and it is in the database, and asks the model
 * only to read the answer.
 */
export function pendingSavePrompt(pending: PendingSave): string {
  if (!pending.askedAt || !pending.proposal) return '';
  const { title, type } = pending.proposal;
  return `

YOU OFFERED TO KEEP SOMETHING AND ARE WAITING ON AN ANSWER. In an earlier turn you offered to save "${title}" to their Almanac as ${TYPE_WORD[type]}, and they have not answered yet.

If THIS message answers it, set saveAnswer to 'yes' or 'no'. Treat a clear agreement as yes ("yes please", "go on", "keep it") and a clear decline as no ("no", "leave it", "not that one"). Anything else - a new topic, a log, a different question - is NOT an answer: leave saveAnswer unset and carry on with what they actually said.

Do not raise it again yourself, do not rephrase the offer, do not make a new offer while this one is waiting, and never treat them moving on as agreement. Never say you have saved anything: if they say yes, the app saves it and tells them itself.`;
}

/** Record an offer and when it was made. Saves nothing. */
export async function storePendingSave(
  supabase: SupabaseClient,
  userId: string,
  proposal: ProposedSave
): Promise<void> {
  const { error } = await supabase.from('user_profile').upsert({
    user_id: userId,
    pending_save: proposal,
    pending_save_asked_at: new Date().toISOString(),
  });
  if (error) console.log('PENDING SAVE: could not store the offer —', error.message);
}

export async function clearPendingSave(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from('user_profile').upsert({
    user_id: userId,
    pending_save: null,
    pending_save_asked_at: null,
  });
  if (error) console.log('PENDING SAVE: could not clear the offer —', error.message);
}

/**
 * Save exactly what was offered. Returns what was saved, or null when the insert
 * failed, so the app never confirms a save that did not happen (the
 * storage-honesty rule).
 */
export async function commitSave(
  supabase: SupabaseClient,
  userId: string,
  proposal: ProposedSave
): Promise<{ kind: string; title: string } | null> {
  const entry = await saveAlmanacEntry(supabase, userId, {
    kind: proposal.type,
    title: proposal.title,
    content: proposal.content,
  });
  return entry ? { kind: entry.kind, title: entry.title } : null;
}

/**
 * What the person is told once the save has actually been attempted. Written by
 * the app, not the model: the model composed its reply before any of this ran,
 * so it cannot honestly claim it (the same rule as the Focus note).
 */
export function saveAppliedNote(
  saved: { kind: string; title: string } | null,
  attempted: boolean
): string | null {
  if (saved) {
    const type = coerceSaveType(saved.kind) ?? 'note';
    return `Kept in your Almanac, under Insights, as ${TYPE_WORD[type]}.`;
  }
  if (attempted) return "That didn't save to your Almanac just now. Ask me again and I'll try once more.";
  return null;
}
