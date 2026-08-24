// Reading an Almanac entry's content for display (build item 15, UI slice 3).
//
// `kind` is OPEN TEXT by design (Part Two, principle 13) — new entry kinds
// emerge from conversation, and no closed list could anticipate them. So the
// detail view must NOT switch on `kind`. It reads the SHAPE of the content
// instead: an object carrying condition and expectation is an insight rule
// whatever it happens to be called, and one carrying an exercises array is a
// plan whether the conversation named it "movement plan", "routine" or
// "rehab programme".
//
// Anything unrecognised still renders — honestly and readably — rather than
// showing nothing. A saved entry the person agreed to keep must never open to a
// blank page just because its shape was new.

export type InsightRule = { condition: string; expectation: string };

export type PlanExerciseView = {
  name: string;
  group: string | null;
  sets: number | null;
  reps: string | null;
  safetyNote: string | null;
};

export type PlanView = {
  programType: string | null;
  goal: string | null;
  exercises: PlanExerciseView[];
};

export type ContentView =
  | { shape: 'insight'; rule: InsightRule }
  | { shape: 'plan'; plan: PlanView }
  | { shape: 'summary'; text: string }
  // The honest fallback: readable key/value pairs, so an unfamiliar shape still
  // shows the person what was actually saved.
  | { shape: 'fields'; fields: { label: string; value: string }[] }
  | { shape: 'empty' };

const str = (v: unknown): string | null => {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
};

const posInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Turn a camelCase or snake_case key into something readable, so the fallback
// reads as English rather than as a database dump.
export function humanizeKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return key;

  // Sentence case, not title case: "Drink target", not "Drink Target". An
  // all-caps word is left alone so an acronym like TDEE is not mangled into
  // "Tdee".
  const rest = words.slice(1).map((w) => (w === w.toUpperCase() ? w : w[0].toLowerCase() + w.slice(1)));
  const first = words[0];
  const head = first === first.toUpperCase() ? first : first[0].toUpperCase() + first.slice(1);
  return [head, ...rest].join(' ');
}

// Keys that are plumbing rather than content, and should never be shown.
const HIDDEN_KEYS = new Set(['__seeded']);

export function readContent(content: unknown): ContentView {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) {
    return { shape: 'empty' };
  }
  const o = content as Record<string, unknown>;

  // An insight is stored as an active condition -> expectation rule, so it can
  // later inform how a reading is interpreted (Part Ten, Data layer).
  const condition = str(o.condition);
  const expectation = str(o.expectation);
  if (condition && expectation) {
    return { shape: 'insight', rule: { condition, expectation } };
  }

  if (Array.isArray(o.exercises)) {
    const exercises = o.exercises
      .map((raw): PlanExerciseView | null => {
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const x = raw as Record<string, unknown>;
        const name = str(x.name);
        if (!name) return null;
        return {
          name,
          group: str(x.group),
          sets: posInt(x.sets),
          reps: str(x.reps),
          safetyNote: str(x.safetyNote),
        };
      })
      .filter((x): x is PlanExerciseView => x !== null);

    if (exercises.length > 0) {
      return {
        shape: 'plan',
        plan: { programType: str(o.programType), goal: str(o.goal), exercises },
      };
    }
  }

  const summary = str(o.summary);
  if (summary && Object.keys(o).filter((k) => !HIDDEN_KEYS.has(k)).length === 1) {
    return { shape: 'summary', text: summary };
  }

  const fields = Object.entries(o)
    .filter(([k]) => !HIDDEN_KEYS.has(k))
    .map(([k, v]) => ({
      label: humanizeKey(k),
      value:
        str(v) ??
        (typeof v === 'boolean'
          ? v
            ? 'Yes'
            : 'No'
          : Array.isArray(v) || (v != null && typeof v === 'object')
            ? JSON.stringify(v)
            : ''),
    }))
    .filter((f) => f.value.length > 0);

  return fields.length > 0 ? { shape: 'fields', fields } : { shape: 'empty' };
}
