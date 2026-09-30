import type { SupabaseClient } from '@supabase/supabase-js';

import { saveAlmanacEntry } from './almanac';
import { coerceStatus, normaliseSection } from './me-card';
import { coerceItems, itemsOf, mergeItems, type MeItem } from './me-items';

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
//
// ME ARRIVED HERE ON 2026-09-19, which is what this file was built for: "Built
// once, here, so Me and Movement can reuse it rather than each growing their
// own." A Me card is the same shape of moment - Selodia notices something has
// been settled, offers, and keeps it on a yes - so it needed no new machinery,
// only a fourth type. Until then the Me tab had no way in at all, and a skincare
// routine offered to it landed in Insights twice.

// RULE ARRIVED ON 2026-09-28, for the same reason `me` did: it is the same
// shape of moment, so it needed a fifth type rather than its own machinery.
//
// AND IT IS THE TYPE THIS MECHANISM MATTERS MOST FOR. Ruth's brief: "Chat never
// advances a rung or saves clinical rules silently. It confirms first." A rule
// is a clinical constraint that then removes movements from her sessions in
// code, so a rule the app invented from a passing remark would quietly narrow
// her training with nothing to point at. The offer lives in the database and
// the model only reports whether the answer was yes - the same split as the
// allergy gate and Focus: the model observes, the app decides.
export type SaveType = 'symptom' | 'insight' | 'note' | 'me' | 'rule';
export const SAVE_TYPES: readonly SaveType[] = ['symptom', 'insight', 'note', 'me', 'rule'];

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
  // A ME CARD IS A DECISION WITH A REASON. The section says where it belongs and
  // is created by arriving; the why is what makes the card worth having at all,
  // because a name with no reason is a checklist item and Me is not a checklist.
  // The status is optional on purpose: a supplement has one, a weekly call does
  // not.
  if (type === 'me') {
    // A SECTION IS NOT REQUIRED, AND REQUIRING IT LOST HER SKINCARE CARD.
    //
    // On 30 September at 12:11 she pasted her routine, the app proposed it, she
    // said Yes, and nothing was written. No pending_save row was ever stored,
    // because this line rejected the proposal.
    //
    // WHY IT REJECTED IT. When the model returns `content` as prose rather than
    // an object - which is what it does for anything complicated - the block
    // above turns it into `{ summary: text }`. That has no `section`, so this
    // returned null. The magnesium card, being one line, came back as a
    // structured object with a section and saved perfectly. So it looked like
    // multi-item saves failing, and it was really prose-shaped content failing.
    //
    // AND THE RULE WAS STRICTER THAN THE DATA. `commitSave` passes the section
    // through as the category and null is allowed there; her own "Vitamin D,
    // 1000iu" card has had `section: null` since it was created. The Almanac
    // has never needed one.
    //
    // The WHY stays required. That is the card's whole point - a name with no
    // reason is a checklist item - and a proposal with no reason is a decision
    // moment nobody identified.
    const section = normaliseSection(content.section);
    const why = str(content.why) ?? str(content.summary);
    if (!why) return null;
    // A PROTOCOL MADE OF PARTS (2026-09-30). A Me card may carry items - name,
    // when, a one-line purpose - so three skincare products are three things
    // with their own timings rather than one paragraph. Optional: a weekly call
    // with a friend has no parts.
    //
    // There is no field for an outcome or a result, which is deliberate and is
    // the answer to "chat must not write outcomes Ruth didn't state": a
    // sentence like "already seeing the redness reduce" has nowhere to go even
    // if a model offers it.
    const items = coerceItems(content.items);
    return {
      type,
      title: title.slice(0, MAX_TITLE),
      content: {
        section,
        why,
        status: coerceStatus(content.status),
        // DETAIL IS DROPPED ONCE THERE ARE ITEMS (2026-09-30).
        //
        // Her card saved correctly on 30 September - three items, each with its
        // own timing and purpose - and carried this in `detail`:
        //
        //   "Three-month timeframe for meaningful change in texture and
        //    evenness. Redness already reducing."
        //
        // She never typed either sentence. Both came out of the text she
        // pasted, which she had been sent rather than written, and the card
        // showed them to her as LATEST.
        //
        // The prompt forbids an outcome, and only inside `items` - so `detail`
        // became the one place a stray sentence could still land, which is
        // exactly where it landed. A field with no defined job collects
        // whatever the model has left over.
        //
        // When the parts carry the content, there is nothing for a free-text
        // paragraph to add that is not either a repeat or a claim. So it goes.
        // A card with no items keeps its detail, because there it is the only
        // place her own words can be.
        ...(items.length > 0 ? {} : { detail: str(content.detail) }),
        ...(items.length > 0 ? { items } : {}),
      },
    };
  }

  // A RULE NEEDS TO KNOW WHICH LIST IT IS ON, and what words the gate should
  // match. Without the first it is not a rule; without the second it is a rule
  // that cannot stop anything, which is worse than no rule because it looks
  // like protection. A missing match list falls back to the phrase itself at
  // commit time - a poor matcher, and an honest one.
  if (type === 'rule') {
    const kind = typeof content.kind === 'string' ? content.kind.trim().toLowerCase() : null;
    if (kind !== 'never' && kind !== 'always') return null;
    const terms = Array.isArray(content.matchTerms)
      ? (content.matchTerms as unknown[])
          .map((t) => str(t))
          .filter((t): t is string => t !== null)
          .map((t) => t.toLowerCase())
      : [];
    return {
      type,
      title: title.slice(0, MAX_TITLE),
      content: { kind, matchTerms: terms, advisedBy: str(content.advisedBy) },
    };
  }

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
  me: 'part of their own protocol',
  rule: 'a movement rule',
};

/**
 * What the model is told while an offer is outstanding. It states the offer as a
 * fact, because the app made it and it is in the database, and asks the model
 * only to read the answer.
 */
export function pendingSavePrompt(pending: PendingSave): string {
  if (!pending.askedAt || !pending.proposal) return '';
  const { title, type } = pending.proposal;
  // A rule does not go to the Almanac, so the prompt must not say it does -
  // the model reads this and writes the next reply from it.
  const where = type === 'rule' ? 'to their rules' : 'to their Almanac';
  return `

YOU OFFERED TO KEEP SOMETHING AND ARE WAITING ON AN ANSWER. In an earlier turn you offered to save "${title}" ${where} as ${TYPE_WORD[type]}, and they have not answered yet.

If THIS message answers it, set saveAnswer to 'yes' or 'no'. Treat a clear agreement as yes ("yes please", "go on", "keep it") and a clear decline as no ("no", "leave it", "not that one"). Anything else - a new topic, a log, a different question - is NOT an answer: leave saveAnswer unset and carry on with what they actually said.

Do not raise it again yourself, do not rephrase the offer, do not make a new offer while this one is waiting, and never treat them moving on as agreement. Never say you have saved anything: if they say yes, the app saves it and tells them itself.`;
}

// THE APP ASKS THE QUESTION, NOT THE MODEL (2026-09-12, Ruth approved the
// wording). On the first voice test the model stored an offer and never spoke
// the question, so an offer sat waiting for an answer to something she was
// never asked - and a later yes to anything could have been read as its
// answer. The question is now the app's own line, like the confirmation, and
// is only added when the offer was actually stored.
export const SAVE_OFFER_QUESTION = 'Want me to keep that in your Almanac?';

// A Me card goes to a different tab, and the offer should say which - the brief
// writes it as "Want me to add this to your Me tab?" and that is the wording
// somebody can answer without wondering where it is going. Telling her a
// skincare routine had gone to the Almanac generally is how the original
// complaint started.
export const ME_OFFER_QUESTION = 'Want me to keep that in your Me tab?';

// A RULE'S OFFER SAYS WHAT THE RULE WILL DO, because agreeing to it changes
// what the app builds for her from then on. "Want me to keep that?" is not
// enough consent for something that removes movements from her sessions.
export const RULE_OFFER_QUESTION =
  'Want me to add that to your rules, so it stays out of anything I build for you?';

export function offerQuestionFor(type: SaveType): string {
  if (type === 'me') return ME_OFFER_QUESTION;
  if (type === 'rule') return RULE_OFFER_QUESTION;
  return SAVE_OFFER_QUESTION;
}

/**
 * The offer line to add after the reply, or null when the reply already asks
 * about the Almanac. The model is told not to ask; if it does anyway, adding the
 * app's line would ask twice. Deliberately narrow - only a question that names
 * the Almanac counts - because a wrong match would leave a stored offer unasked,
 * which is the very thing this exists to prevent.
 */
export function offerQuestion(reply: string, type: SaveType = 'note'): string | null {
  // Suppressed when the reply already asks - about the Almanac, or about the Me
  // tab, or about keeping or saving the thing. Wider than it was, because a Me
  // offer is often phrased "shall I add that to your Me tab?" and adding the
  // app's line underneath would ask twice.
  const alreadyAsks =
    /almanac[^.!?\n]*\?/i.test(reply) ||
    /\bme tab[^.!?\n]*\?/i.test(reply) ||
    /\b(keep|save|add)\b[^.!?\n]*\b(that|this|it)\b[^.!?\n]*\?/i.test(reply);
  return alreadyAsks ? null : offerQuestionFor(type);
}

/**
 * Record an offer and when it was made. Saves nothing. Returns whether it was
 * stored, because the question is only asked about an offer that exists.
 */
/**
 * How long after an offer the app stays quiet. One conversation, roughly.
 *
 * Ruth, 26 September 2026: "After I mentioned cold symptoms, voice asked
 * whether to save them to the Almanac... Only offer an Almanac save when the
 * user describes an ongoing practice or a decision, and at most once per
 * conversation."
 */
const OFFER_QUIET_HOURS = 3;

/**
 * Has an offer already been made recently enough that another would be nagging?
 *
 * THE GUARD IS HERE AND NOT IN THE PROMPT, which is her standing rule: never
 * ask the model not to do a thing twice, enforce it where the row is written.
 * The instruction already said not to offer a passing symptom - "Not every
 * passing 'I'm tired'" - and a cold was offered anyway. A second sentence
 * saying the same thing more firmly would be the third time of asking.
 *
 * It reads `last_save_offer_at`, which is deliberately NOT the same field as
 * `pending_save_asked_at`: that one is cleared the moment an offer is answered,
 * so it can only ever say "is one waiting", never "have I just asked".
 */
export async function offeredRecently(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('user_profile')
    .select('last_save_offer_at')
    .eq('user_id', userId)
    .maybeSingle();
  const at = data?.last_save_offer_at;
  if (typeof at !== 'string') return false;
  const since = Date.now() - Date.parse(at);
  return isFinite(since) && since < OFFER_QUIET_HOURS * 60 * 60 * 1000;
}

export async function storePendingSave(
  supabase: SupabaseClient,
  userId: string,
  proposal: ProposedSave
): Promise<boolean> {
  const { error } = await supabase.from('user_profile').upsert({
    user_id: userId,
    pending_save: proposal,
    pending_save_asked_at: new Date().toISOString(),
    // Never cleared. See offeredRecently above.
    last_save_offer_at: new Date().toISOString(),
  });
  if (error) console.log('PENDING SAVE: could not store the offer —', error.message);
  return !error;
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
/**
 * Apply what she said on the yes-turn to the offer already waiting.
 *
 * WHY THE REDIRECT EXISTS. The proposal's type is decided when the OFFER is made,
 * and the answer can carry information the offer did not have. "Yes, perhaps
 * under skincare and allergies" is a yes AND an instruction about where it goes,
 * and that instruction used to be thrown away: her nickel sensitivity was filed
 * as a one-off symptom in Insights because that is what had been proposed
 * fifteen minutes earlier.
 *
 * A symptom is a single observation on a date. An ongoing sensitivity is a
 * standing fact about a body. Me is where the standing things live.
 *
 * NARROW ON PURPOSE. It only ever edits a proposal that already exists, so it
 * can never create a save out of a redirect, and anything it does not recognise
 * leaves the proposal exactly as it was.
 */
export function applyRedirect(
  proposal: ProposedSave,
  redirect: { type?: unknown; section?: unknown } | null | undefined
): ProposedSave {
  if (!redirect) return proposal;

  const type = coerceSaveType(redirect.type) ?? proposal.type;
  const section =
    typeof redirect.section === 'string' && redirect.section.trim()
      ? redirect.section.trim().slice(0, MAX_TITLE)
      : null;

  if (type === proposal.type && !section) return proposal;

  // A Me card's content has a shape the tab reads - section, why, status,
  // detail. Moving a symptom there without one would file it into no section at
  // all, so the section she named becomes the section, and what she originally
  // said stays as the detail.
  const content: Record<string, unknown> = { ...proposal.content };
  if (type === 'me') {
    if (section) content.section = section;
    if (typeof content.section !== 'string' || !content.section) content.section = 'Sensitivities';
    if (content.detail === undefined && typeof content.summary === 'string') {
      content.detail = content.summary;
    }
  } else if (section) {
    content.section = section;
  }

  return { ...proposal, type, content };
}

export async function commitSave(
  supabase: SupabaseClient,
  userId: string,
  proposal: ProposedSave
): Promise<{ kind: string; title: string } | null> {
  // A RULE GOES TO ITS OWN TABLE, not to the Almanac. The Almanac is a record of
  // what happened and what was noticed; a rule is a constraint the generator has
  // to obey, and app/lib/rules-gate.ts reads it from user_rules before any plan
  // is written. Filing it as an almanac entry would make it a note about a
  // constraint rather than the constraint itself.
  if (proposal.type === 'rule') {
    const content = proposal.content as Record<string, unknown>;
    const kind = content.kind === 'always' ? 'always' : 'never';
    const terms = Array.isArray(content.matchTerms)
      ? (content.matchTerms as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      : [];
    const { error } = await supabase.from('user_rules').insert({
      user_id: userId,
      kind,
      phrase: proposal.title,
      // The words the gate matches. Falling back to the phrase itself is a poor
      // matcher and an honest one: better a rule that catches only the obvious
      // case than a rule that silently catches nothing.
      match_terms: terms.length > 0 ? terms : [proposal.title.toLowerCase()],
      source: 'chat',
      advised_by: typeof content.advisedBy === 'string' ? content.advisedBy : null,
      // SHE JUST SAID YES. This path only runs on a confirmed offer, which is
      // what the confirmation is for, so the timestamp is the truth and not an
      // assumption.
      confirmed_at: new Date().toISOString(),
    });
    return error ? null : { kind: 'rule', title: proposal.title };
  }

  // A Me card's SECTION is its category, which is how the Almanac groups it and
  // how a new section comes into existence: by the first card arriving in it.
  // Nobody ever creates one.
  const section =
    proposal.type === 'me' && typeof proposal.content.section === 'string'
      ? proposal.content.section
      : null;

  // ONE CARD PER THING, NOT ONE PER CONVERSATION (2026-09-30).
  //
  // Ruth's acceptance test: "One Skincare entry results, three items... Fail
  // means chat... creates a second entry." Saving always created a new row, so
  // telling Selodia about her skincare twice would have produced two Skincare
  // cards saying different things, and neither of them wrong.
  //
  // So a proposal whose title matches a card she already has UPDATES it: the
  // items merge, a restated field replaces, a field she did not mention is left
  // alone, and the old wording goes to history rather than being overwritten in
  // silence. See me-items.ts.
  if (proposal.type === 'me') {
    const merged = await mergeIntoExistingMeCard(supabase, userId, proposal);
    if (merged) return merged;
  }

  const entry = await saveAlmanacEntry(supabase, userId, {
    kind: proposal.type,
    title: proposal.title,
    category: section,
    content: proposal.content,
  });
  return entry ? { kind: entry.kind, title: entry.title } : null;
}

/**
 * Merge a proposal into the Me card of the same name, when there is one.
 *
 * Returns null when she has no such card, which is the ordinary first-time
 * case and means the caller should create one.
 *
 * MATCHED ON THE TITLE, EXACTLY AS me-update.ts does it, because two different
 * answers to "which card did she mean" is how an update lands on the wrong
 * record. Case and punctuation are ignored; anything less certain is left to
 * create a new card, which is recoverable, rather than edit the wrong one,
 * which is not.
 */
async function mergeIntoExistingMeCard(
  supabase: SupabaseClient,
  userId: string,
  proposal: ProposedSave
): Promise<{ kind: string; title: string } | null> {
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const { data } = await supabase
    .from('almanac_entries')
    .select('id, title, content')
    .eq('user_id', userId)
    .eq('kind', 'me')
    .eq('status', 'active')
    .limit(200);

  const match = (data ?? []).find((r) => key(String(r.title ?? '')) === key(proposal.title));
  if (!match) return null;

  const existing = (match.content ?? {}) as Record<string, unknown>;
  const incoming = proposal.content as Record<string, unknown>;
  const incomingItems = coerceItems(incoming.items) as MeItem[];
  const { items } = mergeItems(itemsOf(existing), incomingItems);

  const next: Record<string, unknown> = {
    ...existing,
    // A restated reason replaces; an unstated one leaves hers alone.
    ...(typeof incoming.why === 'string' && incoming.why.trim() ? { why: incoming.why } : {}),
    ...(incoming.status ? { status: incoming.status } : {}),
    ...(items.length > 0 ? { items } : {}),
  };

  const { error } = await supabase
    .from('almanac_entries')
    .update({ content: next, updated_at: new Date().toISOString() })
    .eq('id', match.id)
    .eq('user_id', userId);
  if (error) {
    console.log('ME MERGE: write failed -', error.message);
    return null;
  }
  return { kind: 'me', title: String(match.title) };
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
    // Me and Insights are different tabs, and telling somebody their skincare
    // routine went to Insights was the complaint that started this.
    if (type === 'me') return `Kept in your Almanac, under Me.`;
    // A rule earns a longer sentence than the others, because agreeing to it
    // changes what gets built from now on and she should be able to see where
    // it went.
    if (type === 'rule') return `Added to your rules, in Plans. It stays out of anything built for you from now on.`;
    return `Kept in your Almanac, under Insights, as ${TYPE_WORD[type]}.`;
  }
  if (attempted) return "That didn't save to your Almanac just now. Ask me again and I'll try once more.";
  return null;
}
