import type { SupabaseClient } from '@supabase/supabase-js';

import { addSkill, skillAddNote, type SkillAddOutcome } from './skill-add';

import { saveAlmanacEntry } from './almanac';
import { coerceStatus, normaliseSection } from './me-card';
import { archiveProse, coerceItems, itemsOf, mergeItems, type MeItem } from './me-items';

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
// WEEK ARRIVED ON 1 OCTOBER 2026, and it closes a gap that had become a trap.
//
// Ruth asked chat, in plain words: "Add Gym to Plans weekly view on Wednesday."
// Chat offered to put it on her Me tab instead. She said "No, I want it in
// plans, week." Chat replied: "The weekly commitment and the Me tab are the
// same thing here."
//
// They are not. The Me tab is almanac_entries; her week is user_week, which is
// what the Week screen reads and what Sessions are planned against. The model
// said it because the Me tab was the only thing it had ever been told it could
// write to - the same shape as 30 September, when it could not write to Me and
// so denied the capability existed.
//
// AND THE ONLY INSERT INTO user_week IN THE WHOLE APP WAS ONBOARDING. After
// setup, nothing could add an activity to a week: not the UI, where the day's
// "+" only puts an EXISTING activity on another day and otherwise says
// "Something else - tell chat", and not chat, which had no route. Her week was
// fixed at setup for good. Adding a remove on 1 October without this made it a
// one-way door, which is how she lost Gym.
/**
 * 'care' IS NEW ON 6 OCTOBER 2026, and it is a kind rather than a new mechanism.
 *
 * Ruth: "In the data it must still be separate: its own kind, its own context
 * block and its own description to the model (the facts I need to get care)."
 *
 * WHAT WAS WRONG. A consultant letter saved as a Me card, and the prompt
 * describes Me as "their personal protocol - the standing decisions about how
 * they are trying to live: supplements, skincare, a dietary decision, a
 * routine". So a hospital number was filed next to her evening skincare on a
 * shelf the model had been told holds lifestyle choices - and "remind me how to
 * get seen" had nothing framed as a health record to answer from.
 *
 * IT CARRIES THE SAME SHAPE AS 'me' ON PURPOSE. Same offer, same yes, same
 * content, same merge-by-title. The one thing that differs is the kind written
 * on the row, which is what every reader downstream switches on - and
 * commitSave already writes `kind: proposal.type`, so the separation costs one
 * union member rather than a second machine.
 */
export type SaveType =
  | 'symptom'
  | 'insight'
  | 'note'
  | 'me'
  | 'care'
  | 'rule'
  | 'week'
  | 'skill'
  /**
   * A TEST RESULT SHE HAS BEEN GIVEN. New on 6 October 2026, and the gap it
   * closes is the one that started the whole healthcare conversation.
   *
   * She told chat: "my high cholesterol was flagged at my 40yr NHS check up."
   * Nothing stored it. There was no way for chat to store it: health_context is
   * written by exactly one onboarding screen, and that screen became unreachable
   * this morning when the first draft was removed.
   *
   * AND THERE IS A RULE WAITING FOR IT. health-context.ts has carried this for
   * weeks: "Elevated LDL: protect oats, lentils, beans and apples as priority
   * foods; gently flag saturated fat rather than treating it as expendable."
   * That rule has never fired for anybody, because the row it reads is empty for
   * everybody.
   *
   * So she asked about her saturated fat against a cholesterol flag, and the one
   * instruction written for exactly that situation could not reach the model.
   *
   * IT IS OFFERED, NOT WRITTEN SILENTLY. Same reasoning as the medication box:
   * a mis-heard marker or a mis-heard status is a wrong fact about her body that
   * then steers what she is advised to eat. She sees what was understood and
   * says yes.
   */
  | 'marker';

/** The kinds that are a card with a section, a why and items. */
export const CARD_TYPES: SaveType[] = ['me', 'care'];
export const SAVE_TYPES: readonly SaveType[] = [
  'symptom',
  'insight',
  'note',
  'me',
  'rule',
  'week',
  // A SKILL IS A DESTINATION, AND IT IS NOT HER WEEK. Added 2 October 2026.
  // Ruth asked chat to help her learn a muscle up and was told it was
  // "already sitting there in your week" - her Park slot. Nothing was saved,
  // and nothing could be: no save type existed for a thing she wants to
  // become able to do. See lib/skill-add.ts.
  'skill',
  // THE PAPERWORK OF BEING SEEN, and it had never once been accepted.
  //
  // FOUND 7 OCTOBER 2026 while building the screen that renders it. The whole
  // Care record existed: a parser, a card body written to be read aloud at a
  // reception desk, a section name she chose herself, and `type: 'care'` passed
  // to coerceProposal by app/api/parse-document/route.ts. This list did not have
  // it, so coerceSaveType returned null, coerceProposal returned null, and the
  // route returned its 500: "I read the document, but could not make a record of
  // it that would keep."
  //
  // The error was honest and nobody ever saw it, because sharing a letter is a
  // thing she has not done since the feature was built. Zero care rows exist in
  // the database. The section I was about to ship would have been empty forever
  // and looked like a design decision.
  //
  // IT IS NOT MODEL-OFFERABLE AND THAT IS DELIBERATE. A care record comes from a
  // document somebody uploaded, never from the model deciding a conversation
  // sounded administrative. check-model-can-offer.mjs carries that as a named
  // exception rather than a hole, the same way `note` is named.
  'care',
  // A RESULT SHE HAS BEEN GIVEN. Added 6 October 2026, and it was nearly added
  // to only half the places it needed to be: the classify tool was taught to
  // offer a marker, commitSave was taught to write one, and this list - which
  // decides whether an offer survives being read back - was not. The offer would
  // have been made and then dropped in silence, which is the shape of fault that
  // cost four sittings today. check-model-can-offer.mjs caught it before a push.
  'marker',
];

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
  // A WEEK ENTRY IS AN ACTIVITY AND WHEN SHE DOES IT. The days may be empty -
  // "Anytime this week" is a real answer and the Week screen has a place for it
  // - so the only thing required is a name, which the title already is.
  if (type === 'week') {
    const days = Array.isArray(content.days)
      ? (content.days as unknown[])
          .filter((d): d is string => typeof d === 'string')
          .map((d) => d.trim().toLowerCase().slice(0, 3))
          .filter((d) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(d))
      : [];
    // AND WHEN IN THE DAY, IF SHE SAID. "french class on thursday night at 7pm"
    // carries a time, and the time is the part that makes the evening
    // unavailable - which is the whole reason she wanted the class in her week.
    // Kept as text: `time` is what the model is asked for, `time_of_day` is the
    // column, and either spelling is accepted because a model that has seen the
    // column name will sometimes use it.
    const time = str(content.time) ?? str(content.time_of_day);
    // IT RETURNS HERE RATHER THAN FALLING THROUGH, and the first version did
    // not. Three hundred lines down there is a last gate - "a symptom or a note
    // carries what was actually said, or there is nothing to keep" - which
    // requires content.summary. A week entry is an activity and a day; it has no
    // summary and never will. So every week proposal was normalised correctly
    // and then thrown away by a rule written for a different kind of thing,
    // which is what a type union with one shared exit does to a new member.
    //
    // It was deployed for an hour before a test found it. Nobody could have
    // found it by using the app: the model proposed, the app refused, and the
    // reply said nothing was offered - which looks exactly like the model
    // choosing not to offer.
    return {
      type,
      title: title.slice(0, MAX_TITLE),
      content: {
        days,
        time_of_day: time ?? null,
        duration: str(content.duration),
        cadence: str(content.cadence),
        // NO PURPOSE FROM A SINGLE SENTENCE. onboarding leaves it null for the
        // same reason: the why is what a conversation fills in, and inventing
        // "cardio and bone density" for somebody who said "swimming" is the app
        // putting words in her mouth.
        purpose: str(content.purpose),
      },
    };
  }

  if (CARD_TYPES.includes(type)) {
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
    // A CARD MADE OF ITEMS CARRIES ITS REASON IN THEM (2026-10-01).
    //
    // The why stays required for a card that is one decision: "Vitamin D3" with
    // no reason is a checklist item, and Me is not a checklist. That rule is
    // right and it is unchanged below.
    //
    // IT IS WRONG FOR A LIST, AND THE MEDICATION PROBE CAUGHT IT. The model
    // proposed exactly what it was asked for -
    //
    //   {"title":"Medications","content":{"section":"Medication","items":[
    //     {"name":"Levothyroxine","when":"75mcg, each morning"}, ... ]}}
    //
    // - and this line threw it away, so her yes answered nothing and the app
    // told her "that did not save". Twice in a row, after passing 11/11 an hour
    // earlier, because whether the model volunteers a card-level `why` for a
    // list of prescriptions is a coin toss.
    //
    // And it should be. The reason a medication is on her card is that she takes
    // it; each item already carries its own `when` and `purpose`. Demanding one
    // sentence that explains all four is asking for a line nobody would write
    // and the model can only invent - which is the opposite of what the why rule
    // is for.
    const items = coerceItems(content.items);
    if (!why && items.length === 0) return null;
    // A PROTOCOL MADE OF PARTS (2026-09-30). A Me card may carry items - name,
    // when, a one-line purpose - so three skincare products are three things
    // with their own timings rather than one paragraph. Optional: a weekly call
    // with a friend has no parts.
    //
    // There is no field for an outcome or a result, which is deliberate and is
    // the answer to "chat must not write outcomes Ruth didn't state": a
    // sentence like "already seeing the redness reduce" has nowhere to go even
    // if a model offers it.
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

/** Today, as the history entries record it. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const TYPE_WORD: Record<SaveType, string> = {
  marker: 'a result they have been given',
  symptom: 'a symptom',
  insight: 'an insight',
  note: 'a note',
  me: 'part of their own protocol',
  // THE FACTS NEEDED TO GET CARE, which is her phrase for it. Not "a medical
  // record": this is the hospital number, the secretary's line and what was
  // agreed, kept so the letter is not needed at a reception desk.
  care: 'something they need in order to get care',
  rule: 'a movement rule',
  week: 'something in their week',
  skill: 'something they want to be able to do',
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
  const where =
    type === 'rule'
      ? 'to their rules'
      : type === 'week'
        ? 'to their week'
        : type === 'skill'
          ? 'to their Skills'
          : 'to their Almanac';
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

/**
 * A MARKER'S OFFER SAYS WHAT IT CHANGES, for the same reason a rule's does.
 *
 * Agreeing to "LDL elevated" quietly alters what she is offered to eat from then
 * on - oats and lentils get protected, saturated fat gets flagged gently rather
 * than treated as expendable. That is a real change to the app's behaviour, and
 * "want me to keep that?" is not enough consent for it.
 *
 * IT ALSO READS THE VALUE BACK. A mis-heard marker or a mis-heard status is a
 * wrong fact about her body that then steers her food, and the medication box
 * learned this first: read it back, then ask.
 */
/**
 * THE SIX COLUMNS AND THE FIVE STATUSES, NAMED HERE SO A WRITE CANNOT INVENT ONE.
 *
 * Taken from HealthContext in app/lib/health-context.ts, which is where the
 * rules that read them live. Two lists of the same thing would be the fault this
 * repository has had five times in a fortnight, so check-health-marker.mjs
 * compares them.
 */
export const MARKER_COLUMNS = [
  'ldl_status',
  'hdl_status',
  'cholesterol_status',
  'glucose_status',
  'ferritin_status',
  'thyroid_status',
];

export const MARKER_STATUSES = ['normal', 'elevated', 'low', 'borderline', 'unsure'];

export const MARKER_OFFER_QUESTION =
  'Want me to note that, so it is taken into account in what I suggest?';

// A RULE'S OFFER SAYS WHAT THE RULE WILL DO, because agreeing to it changes
// what the app builds for her from then on. "Want me to keep that?" is not
// enough consent for something that removes movements from her sessions.
export const RULE_OFFER_QUESTION =
  'Want me to add that to your rules, so it stays out of anything I build for you?';

// A WEEK OFFER NAMES THE WEEK. "Want me to keep that in your Almanac?" after
// "add gym on Wednesday" is the question answered wrongly: she asked for her
// week and the app would be asking permission to file it somewhere else.
export const WEEK_OFFER_QUESTION = 'Want me to put that in your week?';

// A SKILL OFFER NAMES SKILLS, for the reason the week one names the week: the
// mistake being corrected is the app filing a thing she wants to LEARN as a
// slot in her week, so the question has to make the destination unmistakable.
export const SKILL_OFFER_QUESTION = 'Want me to add that to your Skills?';

export function offerQuestionFor(type: SaveType): string {
  if (type === 'me' || type === 'care') return ME_OFFER_QUESTION;
  if (type === 'marker') return MARKER_OFFER_QUESTION;
  if (type === 'rule') return RULE_OFFER_QUESTION;
  if (type === 'week') return WEEK_OFFER_QUESTION;
  if (type === 'skill') return SKILL_OFFER_QUESTION;
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
    // "...in your week?" / "...to your week?" - the week's own phrasing,
    // which the broad keep|save|add test below misses when the verb is "put".
    /\b(in|to)\s+your\s+week[^.!?\n]*\?/i.test(reply) ||
    // "...to your Skills?" - the same gap the week line closed, for the
    // same reason: the broad keep|save|add test below misses "shall I add a
    // muscle up to your Skills?", because the object is the skill, not
    // "that".
    /\byour\s+skills[^.!?\n]*\?/i.test(reply) ||
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
  if (CARD_TYPES.includes(type)) {
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

// WHAT THE SKILL WRITE ACTUALLY DID, so the sentence can say it.
//
// A skill has three successful outcomes that read differently to her - saved
// with a ladder, saved with no ladder because nobody has written one, and
// already there - and `commitSave` returns only {kind, title}, which cannot
// carry that. Telling her "6 steps from where you are now" about a skill that
// got none would be the app claiming something it did not do, which is the
// failure this whole route is built to avoid.
//
// Module-scope and set on the way through, which is ugly and is the smallest
// change that keeps commitSave's signature. Read ONCE, immediately, by
// saveAppliedNote in the same turn; the route is one request per call.
let lastSkillOutcome: SkillAddOutcome | null = null;

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
  // HER WEEK IS NOT THE ALMANAC. user_week is what the Week screen reads and
  // what Sessions are planned against; filing this as an almanac entry would
  // make it a note ABOUT a commitment rather than the commitment.
  // A SKILL IS NOT AN ALMANAC ENTRY EITHER, and it is not her week. Skills is
  // what she wants to become able to do; user_week is when she trains. Filing
  // this to the Almanac would make it a note ABOUT a goal, which is exactly the
  // substitution chat made when it told her a muscle up was already in her week.
  //
  // THE LADDER COMES FROM THE CURATED LIBRARY OR NOWHERE. See lib/skill-add.ts:
  // a skill with no curated ladder is saved as a destination with no steps, and
  // she is told so. Nothing is invented.
  /**
   * A MARKER GOES TO health_context, NOT THE ALMANAC.
   *
   * Same reasoning as a rule going to user_rules: the Almanac is a record of
   * what happened and what was noticed, and this is a constraint the advice has
   * to obey. Filed as an almanac card it would be a note ABOUT her cholesterol
   * rather than the thing that makes the LDL rule fire.
   *
   * ONE COLUMN, ONE STATUS, AND NOTHING ELSE TOUCHED. An upsert of the single
   * named column, so telling the app about her thyroid cannot wipe what it knew
   * about her iron. The table has one row per person and six marker columns.
   *
   * REFUSED RATHER THAN GUESSED. An unrecognised marker or status writes
   * nothing: the columns drive what she is advised to eat, and a wrong one is
   * worse than a missing one.
   */
  if (proposal.type === 'marker') {
    const content = proposal.content as Record<string, unknown>;
    const marker = typeof content.marker === 'string' ? content.marker.trim() : '';
    const status = typeof content.status === 'string' ? content.status.trim() : '';

    if (!MARKER_COLUMNS.includes(marker) || !MARKER_STATUSES.includes(status)) {
      console.log('MARKER: refused an unrecognised marker or status -', marker, status);
      return null;
    }

    const { error } = await supabase
      .from('health_context')
      .upsert({ user_id: userId, [marker]: status }, { onConflict: 'user_id' });
    if (error) {
      console.log('MARKER: write failed -', error.message);
      return null;
    }
    return { kind: 'marker', title: proposal.title };
  }

  if (proposal.type === 'skill') {
    const content = proposal.content as Record<string, unknown>;
    // HER SENTENCE, for matching against the curated ladders. "I want to learn
    // to pull up to muscle up" names two ladders and means the muscle up, which
    // only the longest-alias rule in skill-add.ts can get right - so it needs the
    // sentence, not just the title. `summary` is where coerceProposal puts a
    // content given as a plain string, which is how the model usually sends it.
    const said =
      typeof content.said === 'string'
        ? content.said
        : typeof content.summary === 'string'
          ? content.summary
          : proposal.title;
    const outcome = await addSkill(supabase, userId, said, proposal.title);
    lastSkillOutcome = outcome;
    if (outcome.kind === 'failed') return null;
    return { kind: 'skill', title: outcome.name };
  }

  if (proposal.type === 'week') {
    const content = proposal.content as Record<string, unknown>;
    const days = Array.isArray(content.days)
      ? (content.days as unknown[]).filter((d): d is string => typeof d === 'string')
      : [];
    // LAST, so a new activity joins the end of her week rather than displacing
    // the order she set at setup.
    const { data: existing } = await supabase
      .from('user_week')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextOrder =
      Array.isArray(existing) && existing.length > 0 && typeof existing[0]?.sort_order === 'number'
        ? (existing[0].sort_order as number) + 1
        : 0;
    const { error } = await supabase.from('user_week').insert({
      user_id: userId,
      activity: proposal.title,
      days,
      // DAYS_CHOSEN_AT, OR THE ROW IS WRITTEN AND NEVER SEEN.
      //
      // Under "Let me lead" the Week screen shows a card on a day only when SHE
      // put it there - a row with days and no stamp is pushed into Anytime. So
      // "add gym on Wednesday", confirmed, would have inserted correctly and
      // shown up nowhere near Wednesday.
      //
      // She asked for this one by name, in words, which is as chosen as it gets.
      // The same guard is on the client write in mobile/src/lib/week-move.ts;
      // two runtimes means two writes, and the stamp belongs at both of them
      // rather than at the screen that reads them.
      days_chosen_at: days.length > 0 ? new Date().toISOString() : null,
      duration: typeof content.duration === 'string' ? content.duration : null,
      cadence: typeof content.cadence === 'string' ? content.cadence : null,
      time_of_day: typeof content.time_of_day === 'string' ? content.time_of_day : null,
      // NOT INVENTED. onboarding/activities.tsx leaves purpose null for the same
      // reason: the why is what a conversation fills in, and writing one from a
      // single sentence would put words in her mouth.
      purpose: typeof content.purpose === 'string' ? content.purpose : null,
      sort_order: nextOrder,
    });
    return error ? null : { kind: 'week', title: proposal.title };
  }

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
    CARD_TYPES.includes(proposal.type) && typeof proposal.content.section === 'string'
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
  if (CARD_TYPES.includes(proposal.type)) {
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

  // THE OLD PARAGRAPH GOES TO HISTORY ONCE THERE ARE ITEMS (2026-10-01).
  //
  // `...existing` carries `detail` forward, and before today nothing took it
  // away - so restating a routine in chat left the card saying BOTH things. A
  // live probe against production, on her exact scenario:
  //
  //   items   Niacinamide serum | PM, after cleansing | For redness
  //           Retinol | PM, three nights a week
  //   detail  "Cleanser, then vitamin C serum, then moisturiser. Retinol twice
  //            a week on alternate nights."
  //
  // One card, two answers, the stale one written underneath in prose. That is
  // precisely the failure me-items.ts was written to prevent and describes in
  // its own header; archiveProse was built for it, exported, and called by
  // nobody. Sixth instance this week of something built and never wired up.
  //
  // HER RULE DECIDES WHERE IT GOES: "Archive the old prose in history, delete
  // nothing." It is her wording about her own body and it is the only record of
  // what she used to do, so it moves rather than disappearing.
  //
  // ONLY WHEN ITEMS ACTUALLY ARRIVE. A card with no items is still a card whose
  // detail IS its content - archiving it there would empty the card.
  const base =
    items.length > 0 ? archiveProse(existing, todayISO()).content : existing;

  const next: Record<string, unknown> = {
    ...base,
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
    // IT IS NOT IN THE ALMANAC AND SAYING SO MATTERS. This changes what she is
    // offered to eat, quietly and from now on, which is a different kind of
    // thing from a card she can go and read.
    if (type === 'marker') return `Noted. It will be taken into account from now on.`;
    if (type === 'me') return `Kept in your Almanac, under Me.`;
    // UNDER HEALTH, which is where she asked for it: "a Care section under
    // Health in the Me tab... I don't want it prominent. I like that it sits
    // with the rest of my life, so the app doesn't say my life is about health
    // issues."
    if (type === 'care') return `Kept in your Almanac, under Me, in Health.`;
    // A rule earns a longer sentence than the others, because agreeing to it
    // changes what gets built from now on and she should be able to see where
    // it went.
    if (type === 'rule') return `Added to your rules, in Plans. It stays out of anything built for you from now on.`;
    // A WEEK ENTRY NEVER WENT TO THE ALMANAC, and this line is the only place
    // that still said it did. Falling through to the sentence below would have
    // produced "Kept in your Almanac, under Insights, as something in their
    // week" - wrong tab, wrong screen, and talking about her in the third
    // person in a sentence addressed to her.
    if (type === 'week') return `Added to your week, in Plans.`;
    // A SKILL SAYS WHICH OF THE THREE THINGS HAPPENED. skillAddNote owns the
    // wording, including the honest one for a skill with no ladder written yet.
    if (type === 'skill') {
      const outcome = lastSkillOutcome;
      lastSkillOutcome = null;
      return outcome
        ? skillAddNote(outcome)
        : `${saved.title} is in your Skills, in Plans.`;
    }
    return `Kept in your Almanac, under Insights, as ${TYPE_WORD[type]}.`;
  }
  if (attempted) return "That didn't save to your Almanac just now. Ask me again and I'll try once more.";
  return null;
}
