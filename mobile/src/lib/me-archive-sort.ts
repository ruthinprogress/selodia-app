// THE ME TAB'S ARCHIVE ARITHMETIC, IN A FILE A CHECK CAN LOAD.
//
// Split out for the third time in this project, for the same reason as
// week-reminder-time.ts and calendar-time.ts: the file next door imports
// supabase, supabase reaches react-native, and react-native cannot be parsed by
// plain node - so a check importing it dies on a Flow type annotation rather
// than on anything to do with sorting.
//
// A pattern this reliable deserves naming: anything worth testing goes in a
// file that touches no client.
//
//
// Ruth, 20 October 2026, scoping the Me tab:
//
//   "Some way to archive into a collapsible menu so it's not just a stressful
//    neverending list of ailments eventually"
//   "Add to Archive list - still accessible but under the collapsible bar to
//    keep this space calm... they can just be tidied into a collapsible bar at
//    the bottom and unarchived if they before active again."
//
// WHY THIS IS NOT TIDYING. Her reason is already written into this app, in her
// own words, in care-admin.ts: "I don't want it prominent. I like that it sits
// with the rest of my life, so the app doesn't say my life is about health
// issues." Archiving is that principle applied to time rather than to
// placement. A record of everything that has ever been wrong, never shortening,
// is the app saying exactly the thing she built it not to say.
//
// CLOSED RATHER THAN ARCHIVED, her word and her reasoning: "Closed. Which
// implies it can be open later."
//
// IT USES THE COLUMN THAT WAS BUILT FOR IT. almanac_entries has carried
// `status` since the table was created, alongside instance_count and
// last_confirmed_at, and nothing has ever written a transition - the spec says
// so itself, that the Almanac screen's `status = 'active'` filter is a no-op.
// Every one of the fifty-six rows says 'active'. So there was a lifecycle
// designed and never connected, and this is the wire.
//
// NOTHING EVER CLOSES ITSELF. A record going quiet is not the same as a knee
// being better, and an app that decided the difference would be making a
// judgement about somebody's health from silence. Closing is always her action.
// The Week settled the same argument: nothing there is ever marked done or
// missed.


export type MeLifecycle = 'active' | 'closed';

export function lifecycleOf(status: string | null | undefined): MeLifecycle {
  return (status ?? 'active') === 'closed' ? 'closed' : 'active';
}

/**
 * The order a section's records are shown in.
 *
 * Ruth: "Active get moved to the top of the list, paused next, inactive get
 * stored chronologically below."
 *
 * ANYTHING THAT IS NOT PAUSED COUNTS AS ACTIVE, including a record with no
 * status at all - which is most of the care records, because nothing has ever
 * written one for them. The alternative was a third pile of unlabelled rows
 * between the two she asked for, which is the list she is trying to get away
 * from.
 *
 * NEWEST FIRST WITHIN EACH GROUP, because a record that was updated today is
 * the one she is dealing with. Closed ones are not sorted here at all: they are
 * taken out before this runs and shown chronologically in their own bar.
 */
export function byStatusThenRecent<T extends { status: string | null; when: string }>(
  rows: T[]
): T[] {
  const rank = (r: T) => (r.status === 'Paused' ? 1 : 0);
  return [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return b.when.localeCompare(a.when);
  });
}
