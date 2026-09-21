// THE RULES FOR ARRANGING THE LOG, with no database in sight.
//
// Separated from the loading and saving (log-layout.ts) because this is the
// part that can be wrong in a way nobody notices: a saved order and the app's
// list of rows can disagree in either direction, and both failures silently
// cost her a row. Tested by scripts/probe-log-layout.mjs.

export type LogLayout = { order: string[]; hidden: string[] };

export const EMPTY: LogLayout = { order: [], hidden: [] };

/** What a stored value is allowed to be. Anything else is no arrangement. */
export function readLayout(value: unknown): LogLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY;
  const v = value as { order?: unknown; hidden?: unknown };
  const strings = (x: unknown) =>
    Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === 'string' && s.length > 0))] : [];
  return { order: strings(v.order).slice(0, 50), hidden: strings(v.hidden).slice(0, 50) };
}

/**
 * The app's rows, in her order, with the hidden ones separated out.
 *
 * Everything she has arranged comes first in the order she put it; anything the
 * app has that she has never arranged follows, in the app's own order. That is
 * what makes a new row arrive at the end rather than vanish.
 */
export function arrange<T extends { id: string }>(
  rows: T[],
  layout: LogLayout
): { shown: T[]; hidden: T[] } {
  const known = new Map(rows.map((r) => [r.id, r]));
  const placed: T[] = [];

  for (const id of layout.order) {
    const row = known.get(id);
    if (row) {
      placed.push(row);
      known.delete(id);
    }
  }
  // Whatever is left is new to her, and keeps the app's own order.
  for (const row of rows) if (known.has(row.id)) placed.push(row);

  const hidden = new Set(layout.hidden);
  return {
    shown: placed.filter((r) => !hidden.has(r.id)),
    hidden: placed.filter((r) => hidden.has(r.id)),
  };
}

/** The layout implied by a visible order plus a set of hidden ids. */
export function layoutOf(shownIds: string[], hiddenIds: string[]): LogLayout {
  return { order: [...shownIds, ...hiddenIds], hidden: [...new Set(hiddenIds)] };
}
