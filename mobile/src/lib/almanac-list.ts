// Grouping for the Almanac list (build item 15, UI slice 2).
//
// `category` is an emergent field on the entry, never a first-class table — a
// "category page" like Workouts is a filtered view over entries that happen to
// carry it (Part Ten). So most entries will have no category at all, and the
// grouping has to treat that as the normal case rather than the exception.
//
// Deliberately NO "Uncategorised" heading. An empty-ish bucket label is the
// same content-bloat the no-dead-pages principle rules out, and naming
// someone's entries "uncategorised" quietly implies they should have filed them
// better. Ungrouped entries simply appear as a plain list.

export type AlmanacEntryRow = {
  id: string;
  kind: string;
  title: string;
  category: string | null;
  updated_at: string;
};

export type AlmanacGroup = {
  // null = the ungrouped remainder, rendered without a heading.
  category: string | null;
  entries: AlmanacEntryRow[];
};

// Groups with a category come first, alphabetically so the order is stable
// between loads; the ungrouped remainder always sits last. Within a group,
// most-recently-updated first — an Almanac is a working reference, so the thing
// touched most recently is the thing most likely wanted again.
export function groupAlmanacEntries(rows: AlmanacEntryRow[]): AlmanacGroup[] {
  const byCategory = new Map<string, AlmanacEntryRow[]>();
  const ungrouped: AlmanacEntryRow[] = [];

  for (const r of rows) {
    const c = typeof r.category === 'string' ? r.category.trim() : '';
    if (c.length > 0) {
      const list = byCategory.get(c) ?? [];
      list.push(r);
      byCategory.set(c, list);
    } else {
      ungrouped.push(r);
    }
  }

  const recentFirst = (a: AlmanacEntryRow, b: AlmanacEntryRow) =>
    Date.parse(b.updated_at) - Date.parse(a.updated_at);

  const groups: AlmanacGroup[] = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, entries]) => ({ category, entries: entries.slice().sort(recentFirst) }));

  if (ungrouped.length > 0) {
    groups.push({ category: null, entries: ungrouped.slice().sort(recentFirst) });
  }
  return groups;
}

// A seeded row is test data inserted by hand, never something the person saved.
// It must be visibly distinguishable in the UI so it can never be mistaken for a
// real save — the title carries a marker too, but this reads the structural flag
// rather than pattern-matching the title.
export function isSeeded(content: unknown): boolean {
  return (
    content != null &&
    typeof content === 'object' &&
    (content as Record<string, unknown>).__seeded === true
  );
}
