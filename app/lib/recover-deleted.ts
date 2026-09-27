import type { SupabaseClient } from '@supabase/supabase-js';

// BRINGING BACK SOMETHING SHE DELETED, FROM THE CONVERSATION (Ruth, item 8:
// "so the chat can restore it with original values if the user asks ('bring
// back Thursday's weight')").
//
// The app archives what it removes into `deleted_records` for seven days - see
// mobile/src/lib/recoverable.ts for why it archives OUT of the live table
// rather than flagging rows in place. This is the other half: the conversation
// can see what is recoverable and put one back.
//
// BUILDING BOTH HALVES IN ONE GO IS DELIBERATE. This codebase has just been
// bitten twice by the opposite - save-honesty.ts carried a branch for a failure
// it was never wired to, and the measurement writer handled thighs that the
// router never sent it. A store with no way to read from it would be the third.
//
// THE MODEL NEVER COMPUTES WHAT TO RESTORE. It picks an id out of a list the
// app gave it, and the app does the writing. Same split as everywhere else
// here: the model writes the reply, the app states what actually happened to
// the data.

/** Must match RECOVERY_DAYS in mobile/src/lib/recoverable.ts. */
const RECOVERY_DAYS = 7;

type ScaleColumn = 'weight_kg' | 'body_fat_pct' | 'muscle_kg';

type ReadingRestore =
  | { kind: 'scale-value'; id: string; column: ScaleColumn; value: number }
  | { kind: 'scale-row'; row: Record<string, unknown> }
  | { kind: 'personal-row'; row: Record<string, unknown> }
  | { kind: 'several'; items: ReadingRestore[] };

export type RecoverableRow = { id: string; label: string; deleted_at: string };

/** What she could still ask for back. Empty is the normal case. */
export async function listRecoverable(
  supabase: SupabaseClient,
  userId: string
): Promise<RecoverableRow[]> {
  const since = new Date(Date.now() - RECOVERY_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('deleted_records')
    .select('id, label, deleted_at')
    .eq('user_id', userId)
    .gte('deleted_at', since)
    .order('deleted_at', { ascending: false })
    .limit(20);
  if (error) {
    console.log('RECOVER: could not list -', error.message);
    return [];
  }
  return (data ?? []) as RecoverableRow[];
}

/** The block the model reads. Null when there is nothing to say. */
export function recoverablePrompt(rows: RecoverableRow[]): string | null {
  if (rows.length === 0) return null;
  const lines = rows.map((r) => {
    const when = new Date(r.deleted_at).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `  ${r.id}  ${r.label}  (deleted ${when})`;
  });
  return [
    `THINGS SHE DELETED AND CAN STILL GET BACK. Kept for ${RECOVERY_DAYS} days from deletion, then gone for good. If she asks for any of these back - "bring back Thursday's weight", "undo what I deleted", "I didn't mean to remove that" - set restoreId to the id on the matching line and say nothing about whether it worked: the app does the restoring and tells her itself, as it does with every other write.`,
    'Match on what she means, not on exact words, and if two lines could be what she means ASK which rather than guessing - restoring the wrong one puts a number back on a day she did not ask about. If nothing here matches, say plainly that you cannot see it rather than offering to try.',
    'These are ALREADY DELETED. Never mention this list unprompted, never suggest she restore something, and never read it back to her as a summary of what she has removed - it is here so you can answer if she asks, not so the app can remind her of deletions she meant.',
    ...lines,
  ].join('\n');
}

async function put(supabase: SupabaseClient, restore: ReadingRestore): Promise<boolean> {
  if (restore.kind === 'several') {
    // Sequential: two of them can be columns of one row, and the second has to
    // see what the first put back.
    let all = true;
    for (const item of restore.items) if (!(await put(supabase, item))) all = false;
    return all;
  }
  if (restore.kind === 'scale-value') {
    const { error } = await supabase
      .from('body_measurements')
      .update({ [restore.column]: restore.value })
      .eq('id', restore.id);
    if (error) console.log('RECOVER: could not put the value back -', error.message);
    return !error;
  }
  const table = restore.kind === 'scale-row' ? 'body_measurements' : 'personal_metrics';
  const { error } = await supabase.from(table).upsert(restore.row);
  if (error) console.log('RECOVER: could not put the row back -', error.message);
  return !error;
}

export type RecoverOutcome =
  | { done: true; label: string }
  | { done: false; reason: 'not-found' | 'failed' };

/** Put one back, by the id the model chose from the list above. */
export async function recoverDeleted(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<RecoverOutcome> {
  const since = new Date(Date.now() - RECOVERY_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from('deleted_records')
    .select('label, payload')
    .eq('id', id)
    .eq('user_id', userId)
    .gte('deleted_at', since)
    .maybeSingle();

  const row = data as { label?: string; payload?: ReadingRestore } | null;
  if (!row?.payload) return { done: false, reason: 'not-found' };

  const ok = await put(supabase, row.payload);
  if (!ok) return { done: false, reason: 'failed' };

  // Only once it is genuinely back. A restore that failed and then forgot what
  // it was restoring would lose the record twice.
  await supabase.from('deleted_records').delete().eq('id', id).eq('user_id', userId);
  return { done: true, label: row.label ?? 'that' };
}

/** What the APP says about it, never the model. */
export function recoverNote(outcome: RecoverOutcome): string {
  if (outcome.done) return `I've put ${outcome.label} back, with the figures it had.`;
  if (outcome.reason === 'not-found') {
    return "I couldn't find that one to put back — it may have been more than a week ago, in which case it is gone for good.";
  }
  return 'Something went wrong putting that back, so nothing has changed.';
}
