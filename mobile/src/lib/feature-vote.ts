import { supabase } from '@/lib/supabase';

// ONE TAP FOR SOMETHING THAT IS NOT BUILT YET (Ruth, 30 September 2026).
//
// Photo attachment in Report Builder is parked until after wave zero. The
// screen says so plainly, and offers a way to ask for it: "Tap here to vote for
// adding photos to reports."
//
// HER REASONING, which is the useful part: a failed photo becomes a demand
// signal, and it costs almost nothing. At wave zero she can simply ask her two
// testers; at wave one, with 8 to 12 strangers, the count of distinct people
// who asked is real evidence rather than a hunch.
//
// IT HAS TO STAY HONEST. Her condition, and it shapes every string here: the
// button must never suggest photos are coming soon, and must never read as
// though anything was uploaded. Nothing about a photo is sent, stored or named
// - a row says that a person asked for this, and when.
//
// IT REUSES THE FEEDBACK SHE ALREADY HAS rather than adding a second system,
// so there is one table to read and one place votes can go missing from.
//
// THE FEATURE IS A PARAMETER so the same button can mark another gap later.
// Only one is in use today, and adding a second is a line of UI rather than a
// new mechanism.

/** The gaps a person can vote for. One today, by design. */
export type VotableFeature = 'report_photos';

export type VoteResult =
  | { kind: 'counted' }
  /** She has voted for this before. Not an error, and not counted twice. */
  | { kind: 'already' }
  | { kind: 'failed' };

/**
 * Record one vote.
 *
 * ONCE PER PERSON, and the uniqueness is a database index rather than a check
 * here - a double tap, a retry after a dropped connection, or a second device
 * would each add a row otherwise, and the count would quietly overstate demand.
 * That is the one thing this number exists to measure honestly.
 *
 * A duplicate comes back as Postgres error 23505, which is a successful outcome
 * from her point of view: her vote is already in.
 */
export async function voteForFeature(feature: VotableFeature): Promise<VoteResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: 'failed' };

  const { error } = await supabase.from('beta_feedback').insert({
    user_id: user.id,
    feature,
    // NOTHING ELSE. No message, no screenshot, no device fingerprint. This row
    // is a count, not a report, and everything it does not carry is a thing
    // that cannot leak from it.
  });

  if (!error) return { kind: 'counted' };
  if (error.code === '23505') return { kind: 'already' };
  console.log('FEATURE VOTE FAILED:', error.message);
  return { kind: 'failed' };
}

/** Has she already asked for this? Used to word the button before she taps. */
export async function hasVotedFor(feature: VotableFeature): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('beta_feedback')
    .select('id')
    .eq('user_id', user.id)
    .eq('feature', feature)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * What the screen says after a tap.
 *
 * IMPERSONAL, her standing rule: screens never say "I" and never say "we".
 * Sentence case, no em dashes, and nothing that hints at a date.
 */
export function voteMessage(result: VoteResult): string {
  switch (result.kind) {
    case 'counted':
      return 'Thanks, your vote is counted.';
    case 'already':
      return "You've already voted.";
    case 'failed':
      return 'That vote could not be recorded. Try again.';
  }
}
