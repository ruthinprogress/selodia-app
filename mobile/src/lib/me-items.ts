// READING THE ITEMS ON A ME CARD. The app half.
//
// THE OWNER IS app/lib/me-items.ts, which also merges, replaces and archives.
// This file only reads, because the app only displays: every write goes through
// the conversation, and the conversation runs on the server.
//
// WHY IT IS DUPLICATED AT ALL. The mobile bundle has no path to app/lib - its
// tsconfig maps `@/*` to mobile/src only, and nothing in mobile/src imports
// across. So a shared file would need a build step to carry it, and a build
// step exists to be forgotten.
//
// The duplication is therefore deliberate and NARROW: the type and the reader,
// nothing else. scripts/check-me-items.mjs compares the two field lists and
// fails if they drift, so the copy cannot quietly fall behind the original -
// which is the only real cost of a copy.

/** One part of a protocol. Mirrors MeItem in app/lib/me-items.ts. */
export type MeItem = {
  name: string;
  when: string | null;
  purpose: string | null;
  detail?: string | null;
};

const MAX_NAME = 80;
const MAX_WHEN = 80;
const MAX_PURPOSE = 200;
const MAX_DETAIL = 1000;
const MAX_ITEMS = 40;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/** "Retinol 1%" and "retinol 1 %" are the same item. */
export function itemKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function coerceItem(v: unknown): MeItem | null {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const raw = v as Record<string, unknown>;
  const name = clean(raw.name, MAX_NAME);
  if (!name) return null;
  const detail = clean(raw.detail, MAX_DETAIL);
  return {
    name,
    when: clean(raw.when, MAX_WHEN),
    purpose: clean(raw.purpose, MAX_PURPOSE),
    ...(detail ? { detail } : {}),
  };
}

export function coerceItems(v: unknown): MeItem[] {
  if (!Array.isArray(v)) return [];
  const out: MeItem[] = [];
  const seen = new Set<string>();
  for (const entry of v) {
    const item = coerceItem(entry);
    if (!item) continue;
    const key = itemKey(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** The items on a card, or none. Never throws on a card that predates items. */
export function itemsOf(content: unknown): MeItem[] {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) return [];
  return coerceItems((content as Record<string, unknown>).items);
}
