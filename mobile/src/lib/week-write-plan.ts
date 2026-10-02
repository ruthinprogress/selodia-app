// WHAT A SETUP REDO DOES TO HER WEEK, AS A DECISION THAT CAN BE RUN.
//
// Ruth, 2 October 2026: "WEEK: REPAIR, DO NOT REBUILD. It worked before, find
// what changed and fix only that. The setup redo must never delete a row."
//
// WHY THIS IS A FUNCTION AND NOT LINES INSIDE THE SCREEN. The delete that wiped
// her week lived in a component's async handler, reachable only by driving a
// phone. So it was guarded by a source check that read the file as text - and
// that check passed on the bug for a full day, because its assertion carried an
// exception for the exact shape the file had. Nothing could fail.
//
// The decision is pure: given her existing rows and the chips showing, say what
// to remove, what to update and what to add. Pure means a test can put the
// screen in the state that cost her Gym, Pilates and Dance and assert the plan
// is empty. That is behaviour, not a grep.
//
// IT CAN REFUSE. `null` means "do not write anything", and it is returned when
// the screen has not read her week yet. That one case is the whole bug: an empty
// `chosen` is either "she deselected everything" or "nothing has loaded", the
// old code could not tell the two apart, and it guessed the destructive one.

export type ExistingWeekRow = {
  id: string;
  activity: string;
  cadence: string | null;
  sort_order: number | null;
};

export type ChosenActivity = {
  activity: string;
  /** Null when she picked the activity but not a frequency. The row still exists. */
  cadence: string | null;
};

export type WeekWritePlan = {
  /** Row ids to delete. Only ever rows this screen could have created. */
  remove: string[];
  /** Rows she kept: the frequency is updated in place so her day and time survive. */
  updateCadence: { id: string; cadence: string }[];
  /**
   * Rows to create. No `days` key: `user_week.days` defaults to '{}', and the
   * day is not something setup asks for. Ruth: "activity plus cadence, no day
   * needed."
   */
  insert: { activity: string; cadence: string | null; sort_order: number }[];
};

export function planWeekWrite(args: {
  /** Has her week been read? Nothing may be written until it has. */
  loaded: boolean;
  existing: ExistingWeekRow[];
  /** The only activities this screen can create, and so the only ones it may remove. */
  ownLabels: string[];
  chosen: ChosenActivity[];
}): WeekWritePlan | null {
  const { loaded, existing, ownLabels, chosen } = args;
  if (!loaded) return null;

  const own = new Set(ownLabels);
  const keep = new Map(chosen.map((c) => [c.activity, c.cadence]));
  const present = new Set(existing.map((r) => r.activity));

  // ONLY THIS SCREEN'S OWN, AND ONLY WHAT SHE TOOK OFF. A French class added in
  // chat is not in `own`, so no combination of taps here can reach it.
  const remove = existing
    .filter((r) => own.has(r.activity) && !keep.has(r.activity))
    .map((r) => r.id);

  // UPDATED, NOT REMADE. A delete-and-reinsert loses days_chosen_at and
  // time_of_day - her Wednesday and her 10am - which is the same loss, quieter.
  // Only when she actually gave a frequency: an unanswered chip must not blank
  // a cadence chat already knows.
  const updateCadence = existing
    .filter((r) => keep.has(r.activity))
    .map((r) => ({ id: r.id, cadence: keep.get(r.activity) ?? null }))
    .filter((u): u is { id: string; cadence: string } => u.cadence !== null)
    // Nothing to say when it already says that.
    .filter((u) => existing.find((r) => r.id === u.id)?.cadence !== u.cadence);

  const nextOrder = existing.reduce(
    (max, r) => (typeof r.sort_order === 'number' && r.sort_order >= max ? r.sort_order + 1 : max),
    0
  );
  const insert = chosen
    .filter((c) => !present.has(c.activity))
    .map((c, i) => ({ activity: c.activity, cadence: c.cadence, sort_order: nextOrder + i }));

  return { remove, updateCadence, insert };
}

/** Whether a plan would change anything at all. A redo she walks through is one of these. */
export function planIsEmpty(plan: WeekWritePlan): boolean {
  return plan.remove.length === 0 && plan.updateCadence.length === 0 && plan.insert.length === 0;
}
