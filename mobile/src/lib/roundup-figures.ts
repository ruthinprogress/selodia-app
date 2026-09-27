// Client mirror of the row shape in `app/lib/roundup-figures.ts`, plus the reader
// that pulls it off a stored chat row.
//
// A TYPE ONLY, DELIBERATELY. The figures themselves are worked out on the server,
// once, from her own rows - the whole point of item 9 is that the card and the
// prose cannot disagree about a number, and a second implementation on the phone
// would be a second way for them to. This file knows the SHAPE and nothing about
// the arithmetic. If it ever grows a calculation, that is the mistake.
//
// Same convention as mobile/src/lib/body-metrics.ts and calorie-target.ts: mirror
// the shape, name the server file, keep it small enough to read side by side.

export type RoundupFigure = {
  label: string;
  value: string;
  note?: string | null;
};

/**
 * The figures on a stored chat row, or null.
 *
 * WHY IT IS THIS DEFENSIVE. The rows come out of `chat_messages.meta`, which is
 * jsonb: Postgres will hold whatever was put in it, and rows written before 27
 * September 2026 hold nothing at all. A card is a nice-to-have on top of a reply
 * that already says everything; it is never worth a crash in the middle of her
 * thread. Anything that is not the expected shape reads as no figures, which
 * renders as no card.
 */
export function figuresFrom(meta: unknown): RoundupFigure[] | null {
  if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const raw = (meta as Record<string, unknown>).figures;
  if (!Array.isArray(raw)) return null;

  const rows: RoundupFigure[] = [];
  for (const r of raw) {
    if (r == null || typeof r !== 'object' || Array.isArray(r)) continue;
    const o = r as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    const value = typeof o.value === 'string' ? o.value.trim() : '';
    // BOTH OR NEITHER. A label with no value draws an empty row, which looks like
    // a figure the app failed to fetch rather than one it never had.
    if (!label || !value) continue;
    rows.push({
      label,
      value,
      note: typeof o.note === 'string' && o.note.trim().length > 0 ? o.note.trim() : null,
    });
  }
  return rows.length > 0 ? rows : null;
}

/**
 * The week a stored roundup row covers, or null.
 *
 * Same defensiveness as figuresFrom, for the same reason: the heading falls back
 * to "Your week", which is true of every roundup ever written.
 */
export function weekEndingOf(meta: unknown): string | null {
  if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const week = (meta as Record<string, unknown>).weekEnding;
  return typeof week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : null;
}
