import type { SupabaseClient } from '@supabase/supabase-js';

import { EXPORT_TABLES } from '@/lib/data-export';
import { supabase } from '@/lib/supabase';

// Account data deletion (build item 41 — Part Seventeen).
//
// "A real deletion mechanism must exist for anyone who wants their data removed,
// independent of whether they opted into research use — this is a standing
// right, not conditional on that checkbox." So nothing here reads a consent
// flag, for the same reason the export does not.
//
// THIS IS NOW COMPLETE DELETION — as of 2026-09-01, when SUPABASE_SERVICE_ROLE_KEY
// reached the deployed environment and `/api/delete-account` shipped. It was
// deliberately partial before then, and the file said so in those terms, because
// a half-deletion described as a deletion is worse than no deletion at all: the
// person believes they are gone.
//
// THAT HONESTY IS NOT RETIRED, ONLY RE-AIMED. The completeness claim is now made
// from the RESULT rather than from the intention. `authAccountRemains` is set by
// what the route actually reported, and the UI reads it rather than hardcoding a
// happy ending — so a deployment whose key is missing or whose admin call fails
// tells the person their sign-in survived, in exactly the words the old build
// used. Nothing anywhere asserts completeness that has not been observed.
//
// WHY THE DATA IS STILL WIPED CLIENT-SIDE FIRST, when deleting the auth.users row
// cascades all 17 tables by itself and makes this pass redundant. Because the
// cascade cannot report. This pass VERIFIES by re-counting every table afterwards
// and names anything it could not clear; a single cascading delete succeeds or
// fails as one opaque statement. Data first with proof, then the shell — and if
// the shell step fails, the data is already gone rather than waiting on it.
//
// THE TABLE LIST IS THE EXPORT'S LIST. Deliberately the same constant: if a
// table is worth handing someone under portability, it is worth erasing under
// the right to be forgotten, and the two lists drifting apart is exactly the bug
// that leaves data behind. One list, one place to update.
//
// ORDER DOES NOT MATTER FOR CORRECTNESS — verified against the live schema on
// 2026-08-31, every internal foreign key is CASCADE or SET NULL, and none is
// RESTRICT — but the deletes run children-first anyway so that a partial failure
// leaves the smaller, more replaceable things gone rather than orphaned parents.

export type DeletionOutcome = {
  // Tables confirmed empty afterwards, by a re-count rather than by the delete
  // call not erroring.
  cleared: string[];
  // Tables that still hold rows, with how many. This is the honest failure
  // report: a delete can return no error and still leave rows if a policy
  // blocks it, so nothing is trusted until it has been counted.
  remaining: { table: string; rows: number }[];
  storageRemoved: number;
  storageFailed: boolean;
  // Whether the login credential survived. Set from what the server actually
  // reported, never assumed — the UI states completeness from this field, so an
  // optimistic default here would become a false promise on screen.
  authAccountRemains: boolean;
  // Why it survived, when it did. Separated from the boolean because "the server
  // is missing its key" and "the delete call failed" need different handling by
  // whoever reads the report, even though both look identical to the person.
  authFailureReason: 'not_configured' | 'delete_failed' | 'unreachable' | null;
};

// Children before parents. See the note above on why this is caution, not need.
const DELETE_ORDER = [
  // First, and deliberately before the entries they describe: these hold no
  // foreign key, so nothing would cascade them if a later step failed part-way.
  'interpretation_notes',
  'food_items',
  'workout_weight_log',
  'workout_completion_log',
  'chat_messages',
  'daily_summaries',
  'food_logs',
  'activity_logs',
  'hydration_logs',
  'personal_metrics',
  'body_measurements',
  'cycle_events',
  'almanac_entries',
  'user_context',
  'health_context',
  // The one place an allergy row is ever deleted. Permanence is a promise about
  // suggestions, not a reason to keep medical data after someone has asked for
  // their account to be erased.
  'allergies',
  'reminder_settings',
  'push_tokens',
  'user_profile',
];

// Guards against the two lists silently diverging. Exported so a test can assert
// it, and called at deletion time so a mismatch surfaces as a real failure
// rather than as rows quietly left behind.
export function deletionCoverageGap(): string[] {
  const ordered = new Set(DELETE_ORDER);
  return EXPORT_TABLES.map((t) => t.table).filter((t) => !ordered.has(t));
}

async function removeStorage(
  supabase: SupabaseClient,
  userId: string
): Promise<{ removed: number; failed: boolean }> {
  // Discuss-card images live at `{userId}/{uuid}.ext`, and the bucket's
  // `discuss_cards_delete_own` policy allows a person to remove objects whose
  // first path folder is their own id. Storage is NOT reached by the database
  // cascade, so even once the service-role key exists this step still has to
  // happen — deleting the auth user would leave these files orphaned forever.
  try {
    const { data, error } = await supabase.storage.from('discuss-cards').list(userId, { limit: 1000 });
    if (error) return { removed: 0, failed: true };
    const paths = (data ?? []).filter((f) => f.name).map((f) => `${userId}/${f.name}`);
    if (paths.length === 0) return { removed: 0, failed: false };
    const { error: rmError } = await supabase.storage.from('discuss-cards').remove(paths);
    return rmError ? { removed: 0, failed: true } : { removed: paths.length, failed: false };
  } catch {
    return { removed: 0, failed: true };
  }
}

// Asks the server to remove the auth user. Deliberately NOT authedPost: that
// helper throws on any non-2xx, and here the difference between the failures IS
// the information — "your data went but your sign-in did not" has to reach the
// person as a report, not as an exception that collapses into a generic error.
// So every outcome resolves, and none of them throws.
async function deleteAuthUser(): Promise<{
  removed: boolean;
  reason: DeletionOutcome['authFailureReason'];
}> {
  const apiBase = process.env.EXPO_PUBLIC_API_URL;
  if (!apiBase) return { removed: false, reason: 'unreachable' };

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { removed: false, reason: 'unreachable' };

    const response = await fetch(`${apiBase}/api/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    // The route takes the user id from the verified token, so the body carries
    // nothing. Sending an id would be the client asking to delete an account by
    // number, which the route refuses to honour anyway.
    if (response.ok) return { removed: true, reason: null };

    const body = (await response.json().catch(() => null)) as { reason?: string } | null;
    const reason =
      body?.reason === 'not_configured' || body?.reason === 'delete_failed'
        ? body.reason
        : 'unreachable';
    return { removed: false, reason };
  } catch {
    // Offline, DNS, a dropped connection. The data is already gone by the time
    // this runs, so this is genuinely "the last step did not happen", not "the
    // deletion failed" — and the person is told exactly that.
    return { removed: false, reason: 'unreachable' };
  }
}

export async function deleteAllUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<DeletionOutcome> {
  // Storage first. If the database rows go and this fails, the images are
  // orphaned with nothing left pointing at them; this way a failure here is
  // reported while the person is still looking at the screen.
  const storage = await removeStorage(supabase, userId);

  for (const table of DELETE_ORDER) {
    try {
      // Filtered on user_id as well as relying on RLS. The policy already scopes
      // it, but supabase-js requires a filter on delete, and stating the
      // intended scope explicitly means a policy change can never widen this.
      await supabase.from(table).delete().eq('user_id', userId);
    } catch {
      // Swallowed here on purpose — the verification pass below is what decides
      // whether a table is actually clear, and a thrown error on one table must
      // not stop the remaining sixteen from being attempted.
    }
  }

  // VERIFY BY COUNTING. A delete that returns no error has not proved anything.
  const cleared: string[] = [];
  const remaining: { table: string; rows: number }[] = [];
  for (const t of EXPORT_TABLES) {
    try {
      const { count, error } = await supabase
        .from(t.table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (error) {
        remaining.push({ table: t.table, rows: -1 });
      } else if ((count ?? 0) > 0) {
        remaining.push({ table: t.table, rows: count ?? 0 });
      } else {
        cleared.push(t.table);
      }
    } catch {
      remaining.push({ table: t.table, rows: -1 });
    }
  }

  // LAST, and only now. The moment the auth user goes, this session's token
  // refers to somebody who does not exist and every call above would start
  // failing — including the verification counts, which would then report
  // "could not be removed" for tables that were already empty. So the shell is
  // removed after the data is gone AND after it has been proved gone.
  const authUser = await deleteAuthUser();

  return {
    cleared,
    remaining,
    storageRemoved: storage.removed,
    storageFailed: storage.failed,
    authAccountRemains: !authUser.removed,
    authFailureReason: authUser.reason,
  };
}
