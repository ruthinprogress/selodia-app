// ITEMS INSIDE A ME CARD (Ruth, 29 September 2026).
//
// WHAT WENT WRONG, because the shape of the fix follows from it exactly.
//
// She asked chat to add three skincare products, each with when she uses it and
// what it is for. One entry came back with the text repeated three times, the
// status history mixed into the body, no per-item view, one line saying
// "retinol nightly" and another saying "alternating", and an outcome she had
// never stated.
//
// None of that is a skincare problem. `updateMeCard` took `{title, status,
// reason}` and nothing else, so a card could change its STATUS and could not
// change its CONTENT. The only writable slot for new information was `reason`,
// which is appended to the status history. Three products with timings and
// purposes had exactly one place to go, and they went there - as prose, into
// the history, beside a `detail` line from nine days earlier that still said
// something different.
//
// The same failure was waiting for supplements, medications, meal plans and
// routines. Anything a person describes as SEVERAL THINGS met a card that could
// only hold one paragraph.
//
// SO A CARD HOLDS ITEMS. Name, when, a one-line purpose, and optional detail.
// Any card can use them - skincare, supplements, a physio programme - because
// the thing being modelled is "a protocol made of parts", not a product type.
//
// AND A CHANGE REPLACES RATHER THAN ACCUMULATES. "Retinol nightly" followed by
// "retinol alternating" is one item whose timing changed, not two items and not
// two contradictory sentences. The old wording goes to history so the story
// survives; the card shows what is true now.

/** One part of a protocol. */
export type MeItem = {
  /** "Retinol 1%", "Magnesium glycinate". */
  name: string;
  /** When she uses it: "PM, alternating", "with breakfast". Null if unstated. */
  when: string | null;
  /** One line on what it is for. Null if she did not say. */
  purpose: string | null;
  /** Anything longer, shown only when the item is expanded. */
  detail?: string | null;
};

/** What changed when items were merged, so the card can say so and record it. */
export type ItemChange =
  | { kind: 'added'; name: string }
  | { kind: 'updated'; name: string; field: 'when' | 'purpose' | 'detail'; from: string | null; to: string | null };

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

/**
 * Valid-or-dropped, never valid-or-guessed. An item with no name is not an
 * item, and inventing one from the purpose would put a word in her record that
 * she never said.
 */
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
    // THE SAME THING TWICE IN ONE INSTRUCTION IS ONE THING. A model listing
    // "Retinol" and "Retinol 1%" separately is the repetition she reported,
    // and it is cheaper to collapse here than to explain it in a prompt.
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** The items already on a card. */
export function itemsOf(content: unknown): MeItem[] {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) return [];
  return coerceItems((content as Record<string, unknown>).items);
}

/**
 * MERGE, WITH THE NEWER WINNING.
 *
 * Her rule: "If new info contradicts old (nightly vs alternating), the newer
 * replaces it and the old goes to history. Ask only if it's genuinely unclear."
 *
 * So there is no ambiguity to resolve here and nothing to ask about: an item
 * with the same name is the same item, and the fields she has just stated
 * replace the ones on file. A field she did NOT state is left alone rather than
 * cleared - saying "retinol is alternating now" must not wipe what it is for.
 */
export function mergeItems(
  existing: MeItem[],
  incoming: MeItem[]
): { items: MeItem[]; changes: ItemChange[] } {
  const items = existing.map((i) => ({ ...i }));
  const changes: ItemChange[] = [];
  const indexOf = new Map(items.map((item, i) => [itemKey(item.name), i]));

  for (const next of incoming) {
    const key = itemKey(next.name);
    const at = indexOf.get(key);
    if (at === undefined) {
      items.push({ ...next });
      indexOf.set(key, items.length - 1);
      changes.push({ kind: 'added', name: next.name });
      continue;
    }
    const current = items[at];
    for (const field of ['when', 'purpose', 'detail'] as const) {
      const to = next[field] ?? null;
      const from = current[field] ?? null;
      // UNSTATED IS NOT EMPTY. Only a field she actually gave can overwrite.
      if (to === null) continue;
      if (to === from) continue;
      changes.push({ kind: 'updated', name: current.name, field, from, to });
      current[field] = to;
    }
    // Keep her latest spelling of the name - "retinol 1%" becoming
    // "Retinol 1%" is not a change worth recording, but it is worth showing.
    current.name = next.name;
  }

  return { items: items.slice(0, MAX_ITEMS), changes };
}

/** "Retinol 1%: PM, alternating (was nightly)" - what the card tells her changed. */
export function changeNote(changes: ItemChange[]): string | null {
  if (changes.length === 0) return null;
  const added = changes.filter((c) => c.kind === 'added').map((c) => c.name);
  const updated = changes.filter((c) => c.kind === 'updated') as Extract<
    ItemChange,
    { kind: 'updated' }
  >[];
  const parts: string[] = [];
  if (added.length) parts.push(`Added ${added.join(', ')}`);
  for (const u of updated) {
    parts.push(u.from ? `${u.name}: ${u.field} now "${u.to}" (was "${u.from}")` : `${u.name}: ${u.field} "${u.to}"`);
  }
  return parts.join('. ') + '.';
}

// ---------------------------------------------------------------- the history

export type HistoryEvent = {
  date: string;
  status?: string | null;
  reason?: string | null;
};

/**
 * SAME-DAY FLIPS COLLAPSE AWAY. Her instruction, and her card shows why: on 29
 * September it went Active, then Paused, then Active again, all within minutes
 * and all with no reason. That is not a history, it is a record of somebody
 * tapping. Only the last state of a day survives, UNLESS a flip carried a
 * reason - a reason is something she said, and nothing she said is thrown away.
 */
export function collapseSameDay(history: HistoryEvent[]): HistoryEvent[] {
  const out: HistoryEvent[] = [];
  for (const event of history) {
    const last = out[out.length - 1];
    const bothBare = !event.reason && last && !last.reason;
    if (last && bothBare && last.date === event.date && event.date !== '') {
      out[out.length - 1] = event;
      continue;
    }
    out.push(event);
  }
  return out;
}

/**
 * MOVING THE OLD PROSE OUT OF THE BODY.
 *
 * A card written before items existed carries its whole protocol in `detail`.
 * Once the same protocol is items, that paragraph is history rather than
 * content - but it is HER history and gets archived, never dropped. Her rule:
 * "Archive the old prose in history, delete nothing."
 */
export function archiveProse(
  content: Record<string, unknown>,
  today: string
): { content: Record<string, unknown>; archived: string | null } {
  const detail = clean(content.detail, MAX_DETAIL);
  if (!detail) return { content, archived: null };
  const history = Array.isArray(content.history) ? [...(content.history as HistoryEvent[])] : [];
  history.push({ date: today, status: null, reason: `Previously recorded as: ${detail}` });
  const next: Record<string, unknown> = { ...content, history };
  delete next.detail;
  return { content: next, archived: detail };
}
