// WHAT I TRACK (Ruth, 24 September 2026).
//
//   "New section in Settings called 'What I track.' Toggles for: fat,
//   saturated fat, carbohydrates, sugar, fibre, salt/sodium. Calories and
//   protein always on, cannot be toggled. Same toggles appear in onboarding.
//   Whatever is switched on shows on every food row and in daily totals."
//
// CALORIES AND PROTEIN ARE NOT TOGGLES, and that is a product decision rather
// than a technical one. Protein is the thing this app exists to help a woman
// over forty hold on to, and a person who switches it off has not customised
// the app, they have turned it into a calorie counter. So it is stated here as
// a fact about the list, not enforced by hiding a switch somewhere in the UI:
// ALWAYS_ON cannot be expressed as off, in any stored value, by any route.
//
// EVERYTHING ELSE IS OFF UNTIL SOMEBODY ASKS FOR IT. A row reading
// "445 kcal · 34g protein" is a fact she wanted. The same row carrying eight
// figures is a nutrition label, and a nutrition label is the thing she has
// spent six months building an app to stop reading.

export type MacroKey =
  | 'kcal'
  | 'protein'
  | 'fat'
  | 'saturated'
  | 'carbs'
  | 'sugar'
  | 'fibre'
  | 'salt';

export type MacroSpec = {
  key: MacroKey;
  /** As it reads in Settings, and in onboarding. */
  label: string;
  /** As it reads on a row: "34g protein", "445 kcal". */
  unit: 'kcal' | 'g';
  /** The column on a food row that carries it. */
  column: string;
  /** Sentence case, one line, for the toggle's own explanation. */
  detail?: string;
};

/** Order is the order they appear, on a row and in Settings. */
export const MACROS: MacroSpec[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', column: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g', column: 'protein_g' },
  { key: 'fat', label: 'Fat', unit: 'g', column: 'fat_g' },
  { key: 'saturated', label: 'Saturated fat', unit: 'g', column: 'saturated_fat_g' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', column: 'carbs_g' },
  { key: 'sugar', label: 'Sugar', unit: 'g', column: 'sugar_g' },
  { key: 'fibre', label: 'Fibre', unit: 'g', column: 'fibre_g' },
  { key: 'salt', label: 'Salt', unit: 'g', column: 'sodium_mg' },
];

/** The two that are not hers to switch off. */
export const ALWAYS_ON: MacroKey[] = ['kcal', 'protein'];

/** The six she can choose, in order. */
export const OPTIONAL: MacroSpec[] = MACROS.filter((m) => !ALWAYS_ON.includes(m.key));

export function isAlwaysOn(key: MacroKey): boolean {
  return ALWAYS_ON.includes(key);
}

/**
 * The macros to show, from whatever was stored.
 *
 * DEFENSIVE ON PURPOSE. This reads a value that came out of a database, was
 * written by an older version of the app, or has never been written at all.
 * Anything unrecognised is dropped, the two that are always on are always
 * added, and the result comes back in MACROS order so a row never reorders
 * itself between screens.
 */
export function trackedMacros(stored: unknown): MacroKey[] {
  const asked = Array.isArray(stored)
    ? stored.filter((k): k is MacroKey => typeof k === 'string' && MACROS.some((m) => m.key === k))
    : [];
  const on = new Set<MacroKey>([...ALWAYS_ON, ...asked]);
  return MACROS.filter((m) => on.has(m.key)).map((m) => m.key);
}

/** What to store when she changes a switch. Never records the two that cannot move. */
export function toStored(keys: MacroKey[]): MacroKey[] {
  return OPTIONAL.filter((m) => keys.includes(m.key)).map((m) => m.key);
}

/** Salt is stored as sodium in milligrams and read by people as salt in grams. */
const SODIUM_MG_PER_G_SALT = 400;

function amount(key: MacroKey, row: Record<string, unknown>): number | null {
  const spec = MACROS.find((m) => m.key === key);
  if (!spec) return null;
  const raw = row[spec.column];
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  return key === 'salt' ? n / SODIUM_MG_PER_G_SALT : n;
}

function say(key: MacroKey, value: number): string {
  const spec = MACROS.find((m) => m.key === key);
  if (!spec) return '';
  if (key === 'kcal') return `${Math.round(value).toLocaleString('en-GB')} kcal`;
  // A figure under ten grams reads better with one decimal; above it, none.
  const n = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${n}g ${spec.label.toLowerCase()}`;
}

/**
 * The line under a food name: "445 kcal · 34g protein".
 *
 * A macro with no figure is LEFT OUT rather than shown as zero. The app cannot
 * tell "this meal had no fibre" from "nobody worked out the fibre", and a zero
 * asserts the first while usually meaning the second.
 */
export function macroLine(row: Record<string, unknown>, tracked: MacroKey[]): string {
  return MACROS.filter((m) => tracked.includes(m.key))
    .map((m) => {
      const v = amount(m.key, row);
      return v === null ? null : say(m.key, v);
    })
    .filter((s): s is string => Boolean(s))
    .join(' · ');
}

/**
 * The week line: "avg 1,213 kcal · 63g protein".
 *
 * AVERAGED OVER DAYS THAT WERE LOGGED, never over a fixed seven. An unlogged
 * day is missing data, not a day somebody ate nothing, and dividing by seven
 * would quietly invent a downward trend for anyone who forgets a Tuesday. The
 * rule is older than this screen and is why the line says how many days it is
 * an average of.
 */
export function averageLine(
  days: Record<string, unknown>[][],
  tracked: MacroKey[]
): { line: string; daysLogged: number } {
  const logged = days.filter((rows) => rows.length > 0);
  if (logged.length === 0) return { line: '', daysLogged: 0 };

  const sums: Record<string, number> = {};
  const seen: Record<string, number> = {};
  for (const rows of logged) {
    for (const key of tracked) {
      let dayHas = false;
      let dayTotal = 0;
      for (const row of rows) {
        const v = amount(key, row);
        if (v === null) continue;
        dayTotal += v;
        dayHas = true;
      }
      if (!dayHas) continue;
      sums[key] = (sums[key] ?? 0) + dayTotal;
      // Counted per macro, not per day: a week where fibre was worked out on
      // two days of five is an average of those two, not two fifths of one.
      seen[key] = (seen[key] ?? 0) + 1;
    }
  }

  const line = MACROS.filter((m) => tracked.includes(m.key) && seen[m.key])
    .map((m) => say(m.key, sums[m.key] / seen[m.key]))
    .join(' · ');
  return { line, daysLogged: logged.length };
}

/** The same line for a day or a week, from rows that have already been summed. */
export function totalLine(rows: Record<string, unknown>[], tracked: MacroKey[]): string {
  const sums: Record<string, number> = {};
  let any = false;
  for (const row of rows) {
    for (const key of tracked) {
      const v = amount(key, row);
      if (v === null) continue;
      sums[key] = (sums[key] ?? 0) + v;
      any = true;
    }
  }
  if (!any) return '';
  return MACROS.filter((m) => tracked.includes(m.key) && sums[m.key] !== undefined)
    .map((m) => say(m.key, sums[m.key]))
    .join(' · ');
}
