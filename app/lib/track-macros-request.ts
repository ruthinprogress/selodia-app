import { MACRO_COLUMN } from './tracked-macro-summary';

// "I WANT TO TRACK MY CALCIUM AND IRON INTAKE."
//
// She said that to the chat on 21 October 2026 and the chat could not do it. It
// read what she tracks - that was built in October after being wrong four times
// - and it had no way to CHANGE it. So it did the only thing left and sent her
// hunting:
//
//   1. Tap the three dots at the top right of any tab
//   2. Open What I track
//   3. Switch on calcium and iron
//
// She had asked for the thing. The app knew how to do the thing. It answered
// with directions to a menu.
//
// THE NEXT DAY SHE REPORTED IT AS A BUG - "Iron and calcium not showing on food
// logs" - because from where she stood, she had asked and nothing happened.
// Which is fair: a request the app understood and did not act on is
// indistinguishable from one it got wrong.
//
// SO THE CHAT CAN SET IT NOW. One field on the decision tool, applied at the
// write like every other action, with the outcome reported back so the reply
// describes what happened rather than what it hoped.
//
// WHAT IT CANNOT DO, and the limit is structural rather than a rule anybody has
// to obey: MACRO_COLUMN holds only the optional macros. Calories and protein
// are not in it, so there is no name the model could send that would switch
// them off - "Always shown. Protein is the one worth watching most as you get
// older" is a decision of hers from September, and the chat cannot undo it by
// accident or by being asked nicely.

/** Every macro the chat may switch, which is every optional one and no others. */
export const TRACKABLE = Object.keys(MACRO_COLUMN);

// Her words, not the column names. "Sat fat" and "saturated fat" are the same
// request, and a person asking for "salt" has never once said "sodium".
const ALIASES: Record<string, string> = {
  'saturated fat': 'saturated',
  'sat fat': 'saturated',
  saturates: 'saturated',
  carbohydrate: 'carbs',
  carbohydrates: 'carbs',
  carb: 'carbs',
  sodium: 'salt',
  fiber: 'fibre',
  sugars: 'sugar',
  fats: 'fat',
};

/**
 * Turn what she said into macro keys.
 *
 * A NAME NOBODY RECOGNISES COMES BACK AS ITSELF rather than being dropped or
 * guessed at. "Can you track my vitamin D" is a real thing to ask and the
 * honest answer is that it is not one of these - which the reply can only say
 * if it is told which word failed.
 */
export function readMacroNames(names: string[]): { keys: string[]; unknown: string[] } {
  const keys: string[] = [];
  const unknown: string[] = [];
  for (const raw of names) {
    const word = String(raw ?? '').trim().toLowerCase();
    if (!word) continue;
    const key = TRACKABLE.includes(word) ? word : ALIASES[word];
    if (!key) {
      if (!unknown.includes(raw)) unknown.push(raw);
      continue;
    }
    if (!keys.includes(key)) keys.push(key);
  }
  return { keys, unknown };
}

export type MacroChange = {
  /** What to store, or null when nothing would change. */
  next: string[] | null;
  /** Switched on by this turn. */
  added: string[];
  /** Switched off by this turn. */
  removed: string[];
  /** Words that are not macros this app keeps. */
  unknown: string[];
};

/**
 * What her list becomes.
 *
 * ALREADY-ON IS NOT AN ADDITION, and this is the part that decides whether the
 * reply tells the truth. Asking for calcium when calcium is already on is a
 * perfectly ordinary thing to do - she did exactly that, having been told the
 * day before that it was not available - and a reply that says "I've switched
 * it on" when it was already on teaches her that the app's confirmations mean
 * nothing.
 */
export function macroChange(
  stored: unknown,
  addNames: string[] = [],
  removeNames: string[] = []
): MacroChange {
  const current = Array.isArray(stored)
    ? stored.filter((k): k is string => typeof k === 'string' && TRACKABLE.includes(k))
    : [];

  const add = readMacroNames(addNames);
  const remove = readMacroNames(removeNames);

  const added = add.keys.filter((k) => !current.includes(k));
  // REMOVING WINS A TIE, because "track iron instead of sugar" names both and
  // the only way to get that wrong in a damaging direction is to leave a column
  // on that she has just asked to be rid of.
  const removed = remove.keys.filter((k) => current.includes(k) || added.includes(k));

  const next = [...new Set([...current, ...added])].filter((k) => !removed.includes(k));
  const changed = added.length > 0 || removed.length > 0;

  return {
    next: changed ? TRACKABLE.filter((k) => next.includes(k)) : null,
    added: added.filter((k) => !removed.includes(k)),
    removed,
    unknown: [...new Set([...add.unknown, ...remove.unknown])],
  };
}

const say = (keys: string[]) => keys.map((k) => MACRO_COLUMN[k]?.label ?? k).join(' and ');

/**
 * What the turn did, for the block the reply is written from.
 *
 * THE APP SAYS IT, NOT THE MODEL - the same rule the diary, the reminder and
 * the plan removal all follow. The model asked for a change; whether it
 * happened is a fact about a database write, and a reply that claims one it did
 * not make is the failure this whole arrangement exists to prevent.
 */
export function macroChangeNote(
  change: MacroChange,
  outcome: 'saved' | 'failed' | 'nothing'
): string | null {
  const parts: string[] = [];

  if (outcome === 'failed') {
    parts.push(
      `their choice of which nutrients to show FAILED to save. Nothing has changed. Do not say it is done.`
    );
  } else if (outcome === 'saved') {
    if (change.added.length > 0) {
      parts.push(
        `${say(change.added)} now shows on every food entry and in their daily total, from here on.`
      );
    }
    if (change.removed.length > 0) {
      parts.push(`${say(change.removed)} is no longer shown on their food.`);
    }
  } else if (change.added.length === 0 && change.removed.length === 0 && change.unknown.length === 0) {
    // Asked for something already on. Said plainly, because the honest answer
    // is "it is already there", not a confirmation of work nobody did.
    parts.push('what they asked for was ALREADY being shown, so nothing changed. Tell them it is already there.');
  }

  if (change.unknown.length > 0) {
    // NAMED, so the reply can say which one. The app keeps eight nutrients and
    // a person may reasonably ask for a ninth.
    parts.push(
      `the app does not keep a figure for ${change.unknown.join(' or ')}, so that part could not be switched on. It keeps calories, protein, fat, saturated fat, carbs, sugar, fibre, salt, calcium and iron.`
    );
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
