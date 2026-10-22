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
  | 'salt'
  // CALCIUM AND IRON (Ruth, 21 October 2026): "Lets offer calcium and iron.
  // Its important to my demographic."
  //
  // She is right, and they are the two that are specifically right. A woman
  // over forty is losing bone density whether or not she is watching it, and a
  // woman who is still menstruating is losing iron every month. The columns
  // have existed since the food parser was written and nothing ever offered
  // them - calcium was asked for and shown nowhere, iron was never even asked
  // for, so every one of her 161 entries holds null.
  | 'calcium'
  | 'iron';

export type MacroSpec = {
  key: MacroKey;
  /** As it reads in Settings, and in onboarding. */
  label: string;
  /** As it reads on a row: "34 g protein", "445 kcal". */
  unit: 'kcal' | 'g' | 'mg';
  /** The column on a food row that carries it. */
  column: string;
  /** Sentence case, one line, for the toggle's own explanation. */
  detail?: string;
  /**
   * The column heading in the detail card, where eight of them share a width.
   *
   * "Saturated fat" and "Carbohydrates" over a 40-pixel column wrap one letter
   * at a time - Ruth's screenshot of 4 October reads "Satura / ted / fat" down
   * the card. These are her own words for them from the same message: "kcal,
   * protein, sat fat, etc".
   */
  short: string;
};

/** Order is the order they appear, on a row and in Settings. */
export const MACROS: MacroSpec[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', column: 'kcal', short: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g', column: 'protein_g', short: 'Protein' },
  { key: 'fat', label: 'Fat', unit: 'g', column: 'fat_g', short: 'Fat' },
  { key: 'saturated', label: 'Saturated fat', unit: 'g', column: 'saturated_fat_g', short: 'Sat fat' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', column: 'carbs_g', short: 'Carbs' },
  { key: 'sugar', label: 'Sugar', unit: 'g', column: 'sugar_g', short: 'Sugar' },
  { key: 'fibre', label: 'Fibre', unit: 'g', column: 'fibre_g', short: 'Fibre' },
  { key: 'salt', label: 'Salt', unit: 'g', column: 'sodium_mg', short: 'Salt' },
  {
    key: 'calcium',
    label: 'Calcium',
    unit: 'mg',
    column: 'calcium_mg',
    detail: 'Bone density falls faster around and after menopause.',
    short: 'Calcium',
  },
  {
    key: 'iron',
    label: 'Iron',
    unit: 'mg',
    column: 'iron_mg',
    detail: 'Monthly bleeding is the commonest cause of low iron in women.',
    short: 'Iron',
  },
];

/**
 * Every macro column, for a select.
 *
 * DERIVED, BECAUSE THE HAND-WRITTEN VERSION WAS WRONG WITHIN A DAY. Ruth,
 * 22 October 2026, twice: "Iron and calcium not showing on food logs", and
 * then "Iron and Calcium. Not showing up still."
 *
 * Both times the pipeline was fine. The parser filled calcium and iron, the
 * columns held them, her setting listed them - and the screen's query named
 * its columns by hand, in a string written before either existed. So the rows
 * arrived without the fields, amount() read undefined, and both macros were
 * filtered off every line and every total as "not worked out".
 *
 * A list of columns kept in step with MACROS by memory is a list that goes out
 * of step the first time somebody adds one. This is that list, generated.
 */
export const MACRO_COLUMNS = MACROS.map((m) => m.column).join(', ');

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
  // MILLIGRAMS ARE WHOLE NUMBERS. "243.6 mg calcium" claims a precision no
  // estimate of a meal has, and reads as a laboratory result rather than as the
  // approximation it is. Grams keep their decimal under ten, where the
  // difference between 4 and 4.5 is a real share of the figure.
  if (spec.unit === 'mg') return `${Math.round(value)} mg ${spec.label.toLowerCase()}`;
  // A figure under ten grams reads better with one decimal; above it, none.
  const n = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  // A SPACE BEFORE THE UNIT, EVERYWHERE (Ruth, 27 September 2026, item 8:
  // "Spacing of units is inconsistent ('10 g protein' in rows, '62g' in the
  // footer). Use '62 g' everywhere.")
  //
  // It was "34g" here and "34 g" in the day summary, which is the kind of
  // difference nobody can name and everybody notices - it makes two numbers on
  // one screen look like they came from two places, which on a screen ABOUT
  // trusting your own record is worth more than the character it saves.
  return `${n} g ${spec.label.toLowerCase()}`;
}

/**
 * THE FIGURE ON ITS OWN, for a column that already carries the name as a heading.
 *
 * `say` repeats the macro's name, because on a row it is the only thing naming
 * it: "13 g saturated fat". Under a heading that already says Sat fat, that
 * reads "Saturated fat / 13 g saturated fat" - which is how Ruth's detail card
 * came to say everything twice in a space too narrow for it once.
 *
 * Null stays null: a macro with no figure is left out, never shown as zero. The
 * app cannot tell "this meal had no fibre" from "nobody worked out the fibre".
 */
export function macroFigure(key: MacroKey, row: Record<string, unknown>): string | null {
  const v = amount(key, row);
  if (v === null) return null;
  if (key === 'kcal') return Math.round(v).toLocaleString('en-GB');
  const spec = MACROS.find((m) => m.key === key);
  if (spec?.unit === 'mg') return `${Math.round(v)} mg`;
  const n = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${n} g`;
}

/**
 * The line under a food name: "445 kcal · 34 g protein".
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
 * The week line: "avg 1,213 kcal · 63 g protein".
 *
 * AVERAGED OVER DAYS THAT WERE LOGGED, never over a fixed seven. An unlogged
 * day is missing data, not a day somebody ate nothing, and dividing by seven
 * would quietly invent a downward trend for anyone who forgets a Tuesday. The
 * rule is older than this screen and is why the line says how many days it is
 * an average of.
 */
/**
 * A day's rows added up, as a row - so every reader that knows how to read one
 * meal can read a whole day without learning anything new.
 *
 * Ruth, 21 October 2026: "Theres no daily totals on each day, even when
 * expanded. And alot of the insights are hidden in little numbers, some of
 * which dont even show up."
 *
 * The last clause was the real fault and it was not a layout one. The day line
 * was built from kcal and protein by hand, in the screen, ignoring what she had
 * switched on entirely - so somebody who turned on fibre and salt saw them on
 * each meal and never once on a day. Totals are summed from the RAW columns
 * here, which is what lets salt stay sodium until the moment it is spoken.
 *
 * AND ABSENT STAYS ABSENT. A macro no row carried is left out of the total
 * rather than summed to zero, because a day of meals nobody worked the fibre
 * out for is not a day with no fibre in it.
 */
export function sumRows(rows: Record<string, unknown>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of MACROS) {
    let has = false;
    let total = 0;
    for (const row of rows) {
      const raw = row[m.column];
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isFinite(n)) continue;
      total += n;
      has = true;
    }
    if (has) out[m.column] = total;
  }
  return out;
}

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
