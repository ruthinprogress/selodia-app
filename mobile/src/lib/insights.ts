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
export type InsightType = 'roundup' | 'symptom' | 'insight' | 'note';

// Pill order, from the brief: All · Roundups · Symptoms · Insights · Notes.
export const INSIGHT_TYPES: readonly InsightType[] = ['roundup', 'symptom', 'insight', 'note'];

// The tag on a card, singular.
export const INSIGHT_TYPE_LABEL: Record<InsightType, string> = {
  roundup: 'Roundup',
  symptom: 'Symptom',
  insight: 'Insight',
  note: 'Note',
};

// The pill, plural, as the brief writes them.
export const INSIGHT_PILL_LABEL: Record<InsightType, string> = {
  roundup: 'Roundups',
  symptom: 'Symptoms',
  insight: 'Insights',
  note: 'Notes',
};

export type AlmanacRow = AlmanacEntryRow & { content: unknown; created_at: string };

const norm = (s: string | null | undefined): string =>
  typeof s === 'string' ? s.trim().toLowerCase() : '';

// Me entries will be written by the conversational save built for Me, carrying
// kind "me". Nothing carries it yet, so today every Me list is empty.
export function tabFor(row: Pick<AlmanacRow, 'kind' | 'content'>): AlmanacTab {
  if (readContent(row.content).shape === 'plan') return 'movement';
  if (norm(row.kind) === 'me') return 'me';
  return 'insights';
}

export function insightTypeFor(row: Pick<AlmanacRow, 'kind'>): InsightType {
  const k = norm(row.kind);
  if (k === 'roundup' || k === 'weekly roundup') return 'roundup';
  if (k === 'symptom') return 'symptom';
  if (k === 'note') return 'note';
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

// "12 Sep", with the year only when it is not this one.
export function entryDateLabel(row: Pick<AlmanacRow, 'created_at'>, now: Date = new Date()): string {
  const d = new Date(row.created_at);
  if (!Number.isFinite(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('en-GB', opts);
}
