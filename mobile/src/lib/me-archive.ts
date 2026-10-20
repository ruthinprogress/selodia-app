import { supabase } from '@/lib/supabase';

// One place to import the archive from; the arithmetic lives next door so a
// check can load it without dragging react-native in. See me-archive-sort.ts.
export { lifecycleOf, byStatusThenRecent, type MeLifecycle } from '@/lib/me-archive-sort';

// CLOSED, AND STILL HERE.
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

/**
 * Close a record, or open it again.
 *
 * THE WORD SHE SEES IS THE WORD STORED, which is unusual in this file's
 * neighbourhood - the section headings next door are renamed at render
 * precisely because their stored values are identities. This one is different:
 * 'closed' is the lifecycle, not a name, and the report builder already reads
 * this exact column to decide what to offer.
 */
export async function setClosed(id: string, closed: boolean): Promise<void> {
  const { error } = await supabase
    .from('almanac_entries')
    .update({ status: closed ? 'closed' : 'active' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

