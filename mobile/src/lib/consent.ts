import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// CONSENT, CARRIED AND RECORDED (build item 51, built 2026-09-19).
//
// The consent screen asks three things and, until this file, kept none of them:
// Continue only navigated to the account screen. Selodia could not show, for
// any account, that anybody had agreed to it holding their health data - which
// UK GDPR Article 7(1) requires it to be able to do.
//
// THE PROBLEM THIS FILE SOLVES is timing. The answers are given on the first
// screen, before there is an account, and the only thing that can write them is
// a signed-in session. So they travel in two ways at once:
//
//   1. In memory, for the ordinary case: the account screen creates a session a
//      moment later and writes them straight away.
//   2. In the sign-up metadata, for the email-confirmation case, where no
//      session exists until the person clicks a link - possibly tomorrow, on
//      another device. The first time a session appears, the answers are
//      written from there, with the time they were actually given.
//
// If neither survives - the app was closed between the consent screen and a
// Google sign-in, say - nothing is assumed. The person is asked again.

// The privacy policy's own "Last updated" date (app/privacy/page.tsx). Change
// the two together: a record says which version of the policy was agreed to.
// THE VERSION IS AN IDENTITY, NOT A DATE, AND THE TWO ARE NOW SEPARATE.
//
// This used to be the same prose string as `UPDATED` on the policy page, and the
// coupling cost three re-asks in one evening. On 1 October the policy was updated
// at 18:51, revised at 20:18 when ElevenLabs' retention was confirmed, and
// revised again at 21:15 when Ruth gave her own final wording - and she had
// already answered the re-ask for the middle one. There was no string left to
// move that would not also change what she READS on the page, and she had asked
// for "(revised)" to stay exactly as it was.
//
// So the two jobs are split, because they were always two jobs:
//
//   UPDATED in app/privacy/page.tsx  what a person reads. Prose. Her call.
//   PRIVACY_POLICY_VERSION           what the code compares. Opaque. Bumped
//                                    whenever the SUBSTANCE changes, whatever
//                                    the date on the page happens to say.
//
// BUMP THIS WHENEVER THE POLICY'S SUBSTANCE CHANGES. That is the whole rule.
// The date on the page is for her; this is for the comparison, and a comparison
// key that has to read nicely is a comparison key that eventually cannot move.
//
// r3 = 1 October 2026, Ruth's final wording of the Claude and ElevenLabs
// paragraph. r2 was the ElevenLabs retention revision she answered at 20:18.
export const PRIVACY_POLICY_VERSION = '2026-10-01-r3';

export type ConsentAnswers = {
  coreConsent: boolean;
  marketingOptIn: boolean;
  researchOptIn: boolean;
  /** When the boxes were ticked, ISO. */
  givenAt: string;
};

let pending: ConsentAnswers | null = null;

/** Held from the consent screen until an account exists to write them to. */
export function holdConsent(answers: ConsentAnswers): void {
  pending = answers;
}

export function heldConsent(): ConsentAnswers | null {
  return pending;
}

/** The shape stored in sign-up metadata, so it can be read back after email confirmation. */
export function consentMetadata(answers: ConsentAnswers | null): Record<string, unknown> {
  if (!answers) return {};
  return {
    consent_core: answers.coreConsent,
    consent_marketing: answers.marketingOptIn,
    consent_research: answers.researchOptIn,
    consent_given_at: answers.givenAt,
    consent_policy_version: PRIVACY_POLICY_VERSION,
  };
}

// WHERE THIS ACCOUNT STANDS (2026-09-19). 'outdated' means they agreed, but to
// an earlier privacy policy. The policy promises that a change to what is
// collected or who sees it is told in the app rather than by a quietly updated
// page, and this is how: they are asked again, once, with a line saying why.
export type ConsentStatus = 'current' | 'outdated' | 'none';

export async function consentStatus(): Promise<ConsentStatus> {
  const { data, error } = await supabase
    .from('consent_records')
    .select('core_consent, policy_version')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Unknown is treated as "ask", for the reason given in hasRecordedConsent.
    console.log('consent check failed -', error.message);
    return 'none';
  }
  if (data?.core_consent !== true) return 'none';
  return data.policy_version === PRIVACY_POLICY_VERSION ? 'current' : 'outdated';
}

/** True when this account has ever given core consent, to any version. */
export async function hasRecordedConsent(): Promise<boolean> {
  const { data, error } = await supabase
    .from('consent_records')
    .select('core_consent')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // FAIL CLOSED would lock somebody out of their own data on a network blip;
    // FAIL OPEN would let an unconsented account in. Neither is right, so the
    // caller treats an error as "unknown" and asks - which is always safe.
    console.log('consent check failed -', error.message);
    return false;
  }
  return data?.core_consent === true;
}

/** Write one record. Returns whether it was stored. */
export async function recordConsent(
  userId: string,
  answers: ConsentAnswers,
  source: 'onboarding' | 'reconfirm' | 'settings',
  policyVersion: string = PRIVACY_POLICY_VERSION
): Promise<boolean> {
  const { error } = await supabase.from('consent_records').insert({
    user_id: userId,
    core_consent: answers.coreConsent,
    marketing_opt_in: answers.marketingOptIn,
    research_opt_in: answers.researchOptIn,
    policy_version: policyVersion,
    source,
    given_at: answers.givenAt,
  });
  if (error) {
    console.log('consent record failed -', error.message);
    return false;
  }
  if (pending && source === 'onboarding') pending = null;
  return true;
}

/**
 * The first time a session exists, write whatever consent arrived with it and
 * was never stored: from memory if the app is still open since the consent
 * screen, otherwise from the sign-up metadata. Does nothing if a record
 * already exists, so it is safe to call on every sign-in.
 */
// ONE WRITE AT A TIME PER ACCOUNT. The auth guard runs on every navigation and
// every auth event, so two copies can ask "is there a record yet?" in the same
// moment, both hear no, and both write. The first call's promise is shared with
// any that arrive while it is still running.
const inFlight = new Map<string, Promise<void>>();

export function recordCarriedConsentIfMissing(user: User): Promise<void> {
  const running = inFlight.get(user.id);
  if (running) return running;
  const job = writeCarriedConsent(user).finally(() => inFlight.delete(user.id));
  inFlight.set(user.id, job);
  return job;
}

async function writeCarriedConsent(user: User): Promise<void> {
  if (await hasRecordedConsent()) return;

  if (pending?.coreConsent) {
    await recordConsent(user.id, pending, 'onboarding');
    return;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta.consent_core === true && typeof meta.consent_given_at === 'string') {
    await recordConsent(
      user.id,
      {
        coreConsent: true,
        marketingOptIn: meta.consent_marketing === true,
        researchOptIn: meta.consent_research === true,
        givenAt: meta.consent_given_at,
      },
      'onboarding',
      typeof meta.consent_policy_version === 'string' ? meta.consent_policy_version : PRIVACY_POLICY_VERSION
    );
  }
}

export type ConsentRecord = {
  coreConsent: boolean;
  marketingOptIn: boolean;
  researchOptIn: boolean;
  policyVersion: string;
  givenAt: string;
};

/** The latest record, for Settings to show. Null when there is none or it failed. */
export async function latestConsent(): Promise<ConsentRecord | null> {
  const { data, error } = await supabase
    .from('consent_records')
    .select('core_consent, marketing_opt_in, research_opt_in, policy_version, given_at')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    coreConsent: data.core_consent === true,
    marketingOptIn: data.marketing_opt_in === true,
    researchOptIn: data.research_opt_in === true,
    policyVersion: data.policy_version,
    givenAt: data.given_at,
  };
}
