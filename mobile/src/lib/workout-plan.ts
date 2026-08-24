import type { PlanExerciseView, PlanView } from '@/lib/almanac-content';

// Grouping a workout plan for display (build item 35, slice D).
//
// The spec is explicit that grouping is DERIVED FROM THE PROGRAM TYPE, never a
// hardcoded layout, so a new program takes the right shape automatically:
// general strength groups by body area, skill-practice groups by the skill
// being learned, rehab is a flat list, and anything with no applicable type is
// a plain itemised list (Part Ten, Workouts).
//
// Note that "group by body area" and "group by skill" read the SAME field. The
// exercise carries one `group` string whose MEANING follows programType — which
// is why one field serves all of them, and why adding a fourth grouped type
// costs nothing structurally.
//
// ON MATCHING OPEN TEXT. programType is open text by design (principle 13), so
// this deliberately does NOT try to interpret arbitrary values. It matches the
// three the spec names, after normalising case and spacing, and everything else
// falls to the plain list — which is the spec's own stated default, not a
// failure mode. If a new type starts recurring, it gets added here deliberately
// rather than guessed at by keyword, which is the trap the DOMS flagger was
// rebuilt to escape.

const GROUPED_TYPES = new Set(['general strength', 'skill practice', 'skill-practice']);
const FLAT_TYPES = new Set(['rehab', 'rehabilitation']);

export function normalizeProgramType(programType: string | null): string {
  return (programType ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Should this program's exercises be grouped at all?
export function shouldGroup(programType: string | null): boolean {
  const t = normalizeProgramType(programType);
  if (t.length === 0) return false;
  if (FLAT_TYPES.has(t)) return false;
  return GROUPED_TYPES.has(t);
}

export type PlanGroup = {
  // null = ungrouped, rendered without a heading.
  heading: string | null;
  exercises: PlanExerciseView[];
};

export function groupPlanExercises(plan: PlanView): PlanGroup[] {
  if (!shouldGroup(plan.programType)) {
    return plan.exercises.length > 0 ? [{ heading: null, exercises: plan.exercises }] : [];
  }

  const byGroup = new Map<string, PlanExerciseView[]>();
  const ungrouped: PlanExerciseView[] = [];

  for (const x of plan.exercises) {
    const g = (x.group ?? '').trim();
    if (g.length > 0) {
      const list = byGroup.get(g) ?? [];
      list.push(x);
      byGroup.set(g, list);
    } else {
      ungrouped.push(x);
    }
  }

  // Insertion order, not alphabetical: a program has a deliberate sequence, and
  // reordering it alphabetically would quietly rewrite how it is meant to be
  // performed. Same reason exercises keep their order within a group.
  const groups: PlanGroup[] = [...byGroup.entries()].map(([heading, exercises]) => ({
    heading,
    exercises,
  }));
  if (ungrouped.length > 0) groups.push({ heading: null, exercises: ungrouped });
  return groups;
}

// "4×8", or just the part that is known. Sets and reps are stored on the plan
// at creation, decided per person and per goal in conversation, so a missing
// one means the conversation did not settle it — show what exists rather than
// inventing a default.
export function formatSetsReps(sets: number | null, reps: string | null): string | null {
  if (sets != null && reps) return `${sets}×${reps}`;
  if (reps) return reps;
  if (sets != null) return `${sets} sets`;
  return null;
}

// The meta line under an exercise name: grouping, prescription, working weight.
export function exerciseMetaLine(
  x: PlanExerciseView,
  workingWeightKg: number | null,
  showGroup: boolean
): string {
  return [
    showGroup ? x.group : null,
    formatSetsReps(x.sets, x.reps),
    workingWeightKg != null ? `working weight ${workingWeightKg}kg` : null,
  ]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join(' · ');
}
