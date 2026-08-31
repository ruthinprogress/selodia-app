import { readContent } from '@/lib/almanac-content';
import type { AlmanacEntryRow } from '@/lib/almanac-list';

// Category filtering for the Almanac (build item 15, UI slice 4 — Part Ten).
//
// A category page is a FILTERED VIEW over entries that happen to carry that
// category, never a pre-built section. That distinction is the whole design:
// "Workouts" exists because some entry carries the category "Workouts", and it
// stops existing the moment none does. Nothing here creates a category, offers
// one, or keeps an empty one alive — which is what no-dead-pages requires.
//
// So there is deliberately no list of known categories anywhere. The set is
// whatever the entries say it is, matched case-insensitively and trimmed so
// "Workouts" and "workouts " are one page rather than two (the same open-text
// hygiene the metric-name normalisation applies, principle 13).

export function normaliseCategory(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function entriesInCategory(
  rows: AlmanacEntryRow[],
  category: string
): AlmanacEntryRow[] {
  const want = normaliseCategory(category);
  if (want.length === 0) return [];
  return rows
    .filter((r) => normaliseCategory(r.category) === want)
    .slice()
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

// A one-line summary of what an entry holds, derived from the SHAPE of its
// content rather than its `kind` (principle 13, the same rule almanac-detail
// renders by). `kind` is open text, so switching on it would rebuild the closed
// list the principle rules out — and an entry whose shape is unrecognised still
// has to say something rather than nothing.
//
// Returns null when there is genuinely nothing worth saying. A row with no
// summary is the normal case, not a failure: better silence than a filler line.
export function entrySummary(content: unknown): string | null {
  const view = readContent(content);
  switch (view.shape) {
    case 'plan': {
      const n = view.plan.exercises.length;
      const movements = `${n} ${n === 1 ? 'movement' : 'movements'}`;
      // The program type is the useful qualifier when it exists — "general
      // strength · 6 movements" tells you more than either half alone.
      return view.plan.programType ? `${view.plan.programType} · ${movements}` : movements;
    }
    case 'insight':
      // Not the rule itself: a condition→expectation pair is two clauses and
      // does not fit a row. The detail view is where it gets read properly.
      return 'Insight';
    case 'summary':
      return view.text;
    case 'fields': {
      const n = view.fields.length;
      return `${n} ${n === 1 ? 'detail' : 'details'}`;
    }
    case 'empty':
    default:
      return null;
  }
}
