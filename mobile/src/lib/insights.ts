import { humanDate } from '@/lib/week';
import { readContent } from '@/lib/almanac-content';
import type { AlmanacEntryRow } from '@/lib/almanac-list';

// Sorting Almanac entries into the three tabs of the redesign, and Insights
// entries into their four types (build spec, Part Ten, the Almanac redesign and
// the Insights brief, confirmed 2026-09-12).
//
// TWO DIFFERENT RULES, ON PURPOSE.
//
// Movement is decided by SHAPE, as it always has been: content carrying an
// exercises array is a plan whatever the conversation called it (principle 13,
// and the same rule almanac-content.ts renders by).
//
// The Insights types are the one deliberately CLOSED set in the Almanac. Ruth's
// brief fixes four - Roundup, Symptom, Insight, Note - tagged by the AI on save,
// and the pills and analytics are built on exactly those. So `kind` is read
// against that set here. Anything that is neither a plan nor one of the named
// types falls to Insight and is never dropped: an entry saved before the types
// existed still has somewhere to live.

export type AlmanacTab = 'insights' | 'movement' | 'me';
export type InsightType = 'roundup' | 'symptom' | 'insight' | 'note' | 'goal' | 'bodyManual';

// Pill order, from the brief: All · Roundups · Symptoms · Insights · Notes.
// GOAL HISTORY ADDED 7 OCTOBER 2026, at the end, because it is the newest and
// the brief's four keep their order.
export const INSIGHT_TYPES: readonly InsightType[] = [
  'roundup',
  'symptom',
  'insight',
  'note',
  'goal',
  'bodyManual',
];

// The tag on a card, singular.
export const INSIGHT_TYPE_LABEL: Record<InsightType, string> = {
  roundup: 'Roundup',
  symptom: 'Symptom',
  insight: 'Insight',
  note: 'Note',
  // HER WORDS, 7 October 2026: "They're Goal History, not insights." Singular
  // and plural are the same phrase because a goal history is already a
  // collection, so "Goal histories" would be wrong in the pill.
  goal: 'Goal history',
  // The title already says "Your Body Manual when you started", so the tag only
  // has to name which record it is.
  bodyManual: 'Body Manual',
};

// The pill, plural, as the brief writes them.
export const INSIGHT_PILL_LABEL: Record<InsightType, string> = {
  roundup: 'Roundups',
  symptom: 'Symptoms',
  insight: 'Insights',
  note: 'Notes',
  goal: 'Goal history',
  bodyManual: 'Body Manual',
};

export type AlmanacRow = AlmanacEntryRow & { content: unknown; created_at: string };

const norm = (s: string | null | undefined): string =>
  typeof s === 'string' ? s.trim().toLowerCase() : '';

/**
 * The kinds that belong on the Me tab rather than in Insights.
 *
 * MIRRORS CARD_TYPES in app/lib/pending-save.ts, which is the server's list of
 * the kinds that are a card with a section. check-care-section.mjs compares the
 * two, because a kind the server files as a card and the client files as an
 * observation is a row she can never find.
 */
const ME_KINDS: readonly string[] = ['me', 'care', 'condition'];

// Me entries are written by the conversational save, carrying kind "me"
// (2026-09-19). Until that existed nothing could write one, which is why a
// skincare routine offered to Me landed in Insights twice: the pathway was
// missing, not misrouted.
export function tabFor(row: Pick<AlmanacRow, 'kind' | 'content'>): AlmanacTab {
  if (readContent(row.content).shape === 'plan') return 'movement';
  // A CARE RECORD IS A ME ROW AND WAS GOING TO LAND IN INSIGHTS (7 October 2026).
  //
  // Found the same morning the How I Access Care group shipped, by asking what
  // else falls through to Insights. A parsed letter is written with kind 'care',
  // and this read `=== 'me'`, so every care record would have appeared in the
  // Insights tab tagged "Insight" and the group built for it would have stayed
  // empty - for the second reason in two days, after SAVE_TYPES.
  //
  // CARD_TYPES in app/lib/pending-save.ts is the server's own list of the kinds
  // that are a card with a section, and it is exactly these two.
  if (ME_KINDS.includes(norm(row.kind))) return 'me';
  return 'insights';
}

export function insightTypeFor(row: Pick<AlmanacRow, 'kind'>): InsightType {
  const k = norm(row.kind);
  if (k === 'roundup' || k === 'weekly roundup') return 'roundup';
  if (k === 'symptom') return 'symptom';
  if (k === 'note') return 'note';
  // AN ARCHIVED GOAL IS NOT SOMETHING SHE NOTICED (Ruth, 7 October 2026:
  // "Archived goals are showing in the Almanac's Insights tab, tagged Insights.
  // They're Goal History, not insights.")
  //
  // Four rows were written with kind 'goal' between 2 and 5 October, and the
  // fall-through below put every one of them under "Insight". That is the
  // fall-through working as designed and being wrong anyway: it exists so an
  // entry saved before the types existed still has somewhere to live, which
  // makes it a safety net, not a classifier. A kind the app WRITES ITSELF
  // should never be arriving through it.
  if (k === 'goal') return 'goal';
  // THE SAME FALL-THROUGH, ONE TRIGGER ALONG. `onboarding_complete_snapshot`
  // writes a body_manual_snapshot row the moment somebody finishes setup, and it
  // would have been tagged "Insight" too. Nobody has one yet, because nobody has
  // completed onboarding since the trigger was added - the fresh account Ruth is
  // about to walk for sign-off would have been the first to see it.
  // BOTH BODY MANUAL RECORDS SHARE ONE LABEL. The snapshot is "when you
  // started", the change is "what you removed and when". They are the same kind
  // of thing - a look-back at her Body Manual, both filed under category "Body
  // Manual" by their triggers - and two near-identical pills would be a filing
  // system rather than a record. The card titles already tell them apart.
  //
  // `body_manual_change` was found by check-almanac-kinds.mjs rather than by me:
  // I had gone looking for what else fell through, found two, and the check
  // reading the migrations found the third.
  if (k === 'body_manual_snapshot' || k === 'body_manual_change') return 'bodyManual';
  return 'insight';
}

const newestCreated = (a: AlmanacRow, b: AlmanacRow) =>
  Date.parse(b.created_at) - Date.parse(a.created_at);
const newestTouched = (a: AlmanacRow, b: AlmanacRow) =>
  Date.parse(b.updated_at) - Date.parse(a.updated_at);

// Insights is a record of what was noticed, so it runs by when each entry was
// made, newest first, as the brief asks. Movement and Me are working references
// that get updated in place, so the one touched most recently comes first.
export function splitByTab(rows: AlmanacRow[]): Record<AlmanacTab, AlmanacRow[]> {
  const out: Record<AlmanacTab, AlmanacRow[]> = { insights: [], movement: [], me: [] };
  for (const r of rows) out[tabFor(r)].push(r);
  out.insights.sort(newestCreated);
  out.movement.sort(newestTouched);
  out.me.sort(newestTouched);
  return out;
}

// A pill appears only for a type that has at least one entry (the brief's rule),
// in the brief's order.
export function pillsFor(rows: Pick<AlmanacRow, 'kind'>[]): InsightType[] {
  const present = new Set(rows.map(insightTypeFor));
  return INSIGHT_TYPES.filter((t) => present.has(t));
}

// The card's first line, read from the content's SHAPE and never invented. An
// insight is a rule (when X, expect Y); its first line is the condition, and the
// detail view shows both halves. Null when there is nothing honest to show.
export function previewLine(content: unknown): string | null {
  const v = readContent(content);
  switch (v.shape) {
    case 'insight':
      return v.rule.condition;
    case 'summary':
      return v.text;
    case 'fields':
      return v.fields[0]?.value ?? null;
    default:
      return null;
  }
}

// "12 Sept", with the year only when it is not this one. Through the app's own
// formatter rather than Intl, so every date in the app reads the same way on
// every phone (UI brief, Part 3).
export function entryDateLabel(row: Pick<AlmanacRow, 'created_at'>, now: Date = new Date()): string {
  const d = new Date(row.created_at);
  if (!Number.isFinite(d.getTime())) return '';
  return humanDate(d, now);
}
