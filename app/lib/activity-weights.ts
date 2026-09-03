// The Health Flower weighting table, and the lookup that applies it at log time.
//
// GENERATED FROM SELODIA_SPEC.md Part Eight, "Health Flower - Activity Weighting
// Table". Parsed out of the markdown rather than retyped, so the numbers here
// and the numbers in the spec cannot drift apart. If a weighting changes, change
// it in the spec and regenerate.
//
// The values are percentages: one typical session's contribution to each of the
// six dimensions. They are calibrated estimates awaiting expert review, not
// figures lifted from any single paper - the spec's methodology note is explicit
// about that, and nothing here should be quoted as though it were.
//
// WHY THIS RUNS AT LOG TIME. activity_type is free text, so most rows will not
// match this table by name and need the classifier. Doing that lookup on every
// Overview render would be an AI call per unmatched activity every time the
// screen opens; doing it once, when the row is written, costs nothing on read.

export type Coverage = {
  strength: number;
  cardio: number;
  flexibility: number;
  balance: number;
  bone: number;
  recovery: number;
};

export const ACTIVITY_WEIGHTS: Record<string, Coverage> = {
  'running':                 { strength: 30, cardio: 90, flexibility: 10, balance: 15, bone: 75, recovery:   0 },
  'ballet':                  { strength: 70, cardio: 50, flexibility: 50, balance: 80, bone: 60, recovery:   0 },
  'yoga':                    { strength: 25, cardio: 15, flexibility: 85, balance: 75, bone:  5, recovery:  60 },
  'weightlifting':           { strength: 95, cardio: 20, flexibility: 10, balance: 20, bone: 80, recovery:   0 },
  'swimming':                { strength: 45, cardio: 90, flexibility: 30, balance: 15, bone:  5, recovery:  20 },
  'walking':                 { strength: 10, cardio: 45, flexibility:  5, balance: 20, bone: 40, recovery:  30 },
  'cycling':                 { strength: 55, cardio: 85, flexibility: 10, balance: 10, bone:  5, recovery:   0 },
  'pilates':                 { strength: 45, cardio: 15, flexibility: 70, balance: 65, bone: 20, recovery:  30 },
  'rock climbing':           { strength: 85, cardio: 55, flexibility: 40, balance: 70, bone: 30, recovery:   0 },
  'hiit':                    { strength: 50, cardio: 90, flexibility: 10, balance: 20, bone: 60, recovery:   0 },
  'dance (general)':         { strength: 30, cardio: 70, flexibility: 50, balance: 65, bone: 40, recovery:   0 },
  'hiking':                  { strength: 35, cardio: 65, flexibility: 15, balance: 35, bone: 60, recovery:  20 },
  'rowing':                  { strength: 70, cardio: 80, flexibility: 20, balance: 15, bone: 20, recovery:   0 },
  'boxing/martial arts':     { strength: 60, cardio: 80, flexibility: 30, balance: 50, bone: 30, recovery:   0 },
  'tennis/racket sports':    { strength: 45, cardio: 75, flexibility: 25, balance: 55, bone: 45, recovery:   0 },
  'aerial/circus':           { strength: 80, cardio: 45, flexibility: 65, balance: 75, bone: 25, recovery:   0 },
  'barre':                   { strength: 55, cardio: 35, flexibility: 55, balance: 70, bone: 30, recovery:   0 },
  'tai chi':                 { strength: 20, cardio: 20, flexibility: 50, balance: 85, bone: 15, recovery:  50 },
  'golf':                    { strength: 20, cardio: 25, flexibility: 30, balance: 40, bone: 25, recovery:  20 },
  'horse riding':            { strength: 35, cardio: 30, flexibility: 25, balance: 60, bone: 20, recovery:  15 },
  'surfing/paddleboarding':  { strength: 45, cardio: 50, flexibility: 30, balance: 80, bone: 20, recovery:  15 },
  'skiing/snowboarding':     { strength: 65, cardio: 60, flexibility: 25, balance: 75, bone: 40, recovery:   0 },
  'football/team sports':    { strength: 55, cardio: 80, flexibility: 20, balance: 45, bone: 50, recovery:   0 },
  'gymnastics':              { strength: 70, cardio: 40, flexibility: 80, balance: 80, bone: 50, recovery:   0 },
  'stretching/mobility':     { strength:  5, cardio:  5, flexibility: 95, balance: 30, bone:  5, recovery:  40 },
  'rest day (intentional)':  { strength:  0, cardio:  0, flexibility:  0, balance:  0, bone:  0, recovery: 100 },
  'gardening':               { strength: 20, cardio: 30, flexibility: 20, balance: 25, bone: 30, recovery:  25 },
  'cycling (spin class)':    { strength: 50, cardio: 95, flexibility:  5, balance:  5, bone:  5, recovery:   0 },
  'crossfit':                { strength: 85, cardio: 75, flexibility: 15, balance: 30, bone: 65, recovery:   0 },
  'aqua aerobics':           { strength: 30, cardio: 60, flexibility: 35, balance: 45, bone: 10, recovery:  20 },
};

// Names people actually type, mapped onto the table's own labels. Kept small and
// literal on purpose: this is for genuine synonyms of a listed activity, never
// for approximating one activity onto a different one. "skipping" is not HIIT
// and "push-ups" is not weightlifting, so neither is here - they stay
// unclassified until the classifier can judge them, because a wrong weighting is
// far harder to notice later than a missing one.
const ALIASES: Record<string, string> = {
  skiing: 'skiing/snowboarding',
  snowboarding: 'skiing/snowboarding',
  'spin class': 'cycling (spin class)',
  'rest day': 'rest day (intentional)',
  stretching: 'stretching/mobility',
  mobility: 'stretching/mobility',
};

// Exact match only, after lowercasing and trimming. Returns null when the
// activity is not in the table, and null is meaningful all the way down to the
// column: it means unclassified, which is not the same as classified-as-zero. A
// rest day genuinely contributes 0 to strength; "Daily Summary" from a
// screenshot contributes an unknown amount, and the flower has to be able to
// tell those two apart rather than quietly counting one as the other.
export function coverageFor(activityType: string | null | undefined): Coverage | null {
  if (!activityType) return null;
  const key = activityType.trim().toLowerCase();
  return ACTIVITY_WEIGHTS[key] ?? ACTIVITY_WEIGHTS[ALIASES[key] ?? ''] ?? null;
}
