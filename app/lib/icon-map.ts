// WHICH LABEL GETS WHICH DRAWING. Ruth's mapping, 8 October 2026.
//
// ITS OWN .ts FILE, and that is not tidiness. The checks' resolver cannot load
// a .tsx, so anything a check needs to read has to live in a .ts. `source-tag.ts`
// was split out for exactly this reason in October and carries the same note:
// a guard that cannot be run is not a guard. `check-diagram-icons.mjs` imports
// this, and it could not import `icons.tsx`.
//
// The drawings themselves stay in `icons.tsx`, because they are JSX.

export type IconName =
  | 'bowl'
  | 'footprints'
  | 'ring'
  | 'drop'
  | 'spark'
  | 'moon'
  | 'sun'
  | 'laptop'
  | 'circles'
  | 'page'
  | 'tape';

/**
 * Her mapping, verbatim, kept in one place so a label and its drawing cannot
 * drift apart. A label with no entry here simply gets no icon, which is how the
 * six stages in How it works stay text only.
 */
export const ICON_FOR: Record<string, IconName> = {
  Food: 'bowl',
  Meals: 'bowl',
  Lunch: 'bowl',
  Movement: 'footprints',
  Walk: 'footprints',
  Cycle: 'ring',
  Water: 'drop',
  Symptoms: 'spark',
  Sleep: 'moon',
  Mood: 'sun',
  Work: 'laptop',
  Family: 'circles',
  Notes: 'page',
  Measurements: 'tape',
};

/** Deep terracotta. `accentDeep` in the app, and what Part Fifteen's table resolves to. */
export const ICON_INK = '#874C3A';

/** In the 24-unit box. Matched by eye to the weight of the logo's outer ring. */
export const ICON_STROKE = 1.7;
