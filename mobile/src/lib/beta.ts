import { supabase } from '@/lib/supabase';

// BETA MEMBERSHIP AND THE AGREEMENT (2026-09-28).
//
// Two separate facts, kept separate on purpose:
//
//   1. IS THIS A BETA ACCOUNT? Granted by Ruth, per account. It decides whether
//      the beta feedback section exists at all.
//   2. WHICH VERSION OF THE AGREEMENT HAVE THEY ACCEPTED? Append-only, versioned,
//      the same shape as consent.ts and for the same reason: clause 13 promises a
//      changed agreement is re-accepted, and only a new row can show which
//      version was agreed to on which date.
//
// A single boolean would have blurred them, and the blurred state is exactly the
// one the app has to handle - granted access, not yet accepted - because the
// agreement says pressing the button is what counts and carrying on using
// Selodía is not.

/**
 * The version in docs/beta-agreement.md and in the Legal folder on Drive.
 *
 * CHANGE THIS AND THE DOCUMENT TOGETHER. A stored acceptance names a version, and
 * a version nobody can produce the text of is not evidence of anything. Same rule
 * as PRIVACY_POLICY_VERSION in consent.ts.
 */
export const BETA_AGREEMENT_VERSION = '1.1';

export type BetaStatus =
  /** Not a beta account. The feedback section does not exist for them. */
  | { member: false }
  /** In the beta, and the current agreement is accepted. */
  | { member: true; accepted: true }
  /** In the beta and has NOT accepted this version - either never, or an older one. */
  | { member: true; accepted: false; previousVersion: string | null };

/**
 * Where this account stands.
 *
 * FAILS CLOSED ON AN ERROR, which is the opposite of how most of this app reads,
 * and deliberately. Everything else here prefers to show something rather than
 * nothing - but a read failure that reported "member" would show the beta
 * feedback section to somebody who is not in the beta, and a read failure that
 * reported "accepted" would skip an agreement. Not a member is the safe answer to
 * both.
 */
export async function betaStatus(): Promise<BetaStatus> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { member: false };

  const { data: membership, error: memberError } = await supabase
    .from('beta_members')
    .select('user_id, ended_at')
    .maybeSingle();

  if (memberError || !membership || membership.ended_at) return { member: false };

  const { data: accepted, error: acceptError } = await supabase
    .from('beta_agreement_acceptances')
    .select('agreement_version, accepted_at')
    .order('accepted_at', { ascending: false })
    .limit(1);

  if (acceptError) return { member: true, accepted: false, previousVersion: null };

  const latest = accepted?.[0];
  if (latest?.agreement_version === BETA_AGREEMENT_VERSION) {
    return { member: true, accepted: true };
  }
  return {
    member: true,
    accepted: false,
    previousVersion: latest?.agreement_version ?? null,
  };
}

/**
 * Record that they pressed the button.
 *
 * Returns whether it was written. A failure has to be SAID rather than assumed
 * away: somebody who accepts an agreement and is not recorded as having accepted
 * it will be asked again, and being asked twice without explanation reads as the
 * app not listening.
 */
export async function acceptBetaAgreement(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return false;

  const { error } = await supabase.from('beta_agreement_acceptances').insert({
    user_id: userId,
    agreement_version: BETA_AGREEMENT_VERSION,
    accepted_at: new Date().toISOString(),
  });

  if (error) {
    console.log('BETA AGREEMENT ACCEPTANCE FAILED:', error.message);
    return false;
  }
  return true;
}
