import type { Session, User } from '@supabase/supabase-js';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { consentStatus, recordCarriedConsentIfMissing } from '@/lib/consent';
import { FLOW_SCREENS } from '@/lib/onboarding-progress';
import { RESUME_ROUTE, type OnboardingStep } from '@/lib/onboarding-step';
import { clearDocumentHandoff } from '@/lib/document-handoff';
import { clearSnapshots } from '@/lib/snapshot';
import { supabase } from '@/lib/supabase';

// The onboarding conversation screens (Part Seven's linear push-chain). The
// guard stays passive on these so it never fights forward progress — it only
// acts at the boundary: the (tabs) app and the auth-entry screens.
// WAS A LITERAL LIST OF EIGHT AND WENT STALE (30 September 2026). Seven
// screens joined the flow and none of them was added here, so this guard did
// not recognise the second half of its own onboarding. See FLOW_SCREENS in
// lib/onboarding-progress.ts, which is now the one place a screen is declared.
const CONVERSATION_SCREENS = FLOW_SCREENS;

// Fill-if-missing metadata sync (step 6): on reauth, carry date of birth and
// biological sex from auth metadata into user_profile when they aren't there
// yet — the case where signup had no immediate session (email confirmation
// pending) so the profile was never written. Never overwrites existing values.
async function syncMetadataIfMissing(user: User) {
  const { data: profile } = await supabase
    .from('user_profile')
    .select('date_of_birth, biological_sex')
    .maybeSingle();
  if (profile?.date_of_birth && profile?.biological_sex) return;
  const meta = (user.user_metadata ?? {}) as { date_of_birth?: string; biological_sex?: string };
  const patch: Record<string, unknown> = { user_id: user.id };
  if (!profile?.date_of_birth && meta.date_of_birth) patch.date_of_birth = meta.date_of_birth;
  if (!profile?.biological_sex && meta.biological_sex) patch.biological_sex = meta.biological_sex;
  if (Object.keys(patch).length > 1) await supabase.from('user_profile').upsert(patch);
}

// Auth-state listener + route guard (Part Sixteen, Phase 1 step 6). Redirects a
// signed-out user out of (tabs), and a signed-in but unfinished user from an
// entry screen to their resume step — while leaving the onboarding conversation
// chain untouched so it never bounce-loops against the screens' own navigation.
export function useAuthGuard(): { ready: boolean } {
  const router = useRouter();
  const segments = useSegments() as string[];
  const navState = useRootNavigationState();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  // A finished user is confirmed once, then left alone (no per-navigation query).
  const confirmedComplete = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      confirmedComplete.current = false; // re-evaluate on any auth change
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && next) {
        void syncMetadataIfMissing(next.user);
      }
      // What the screens remembered goes with the session (2026-09-20). The
      // snapshots exist to paint a screen instantly for the person who just
      // closed the app; they must not outlive that person being signed in.
      if (event === 'SIGNED_OUT') {
        void clearSnapshots();
        // A medical letter waiting to be handed from Today to Chat belongs to
        // whoever signed in, and to nobody who signs in after them.
        clearDocumentHandoff();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Wait until both the session check and the root navigator are ready;
    // redirecting before navigation mounts throws.
    console.log('[BOOT] guard: ready =', ready, ' navKey =', navState?.key ?? 'NONE',
      ' session =', session ? 'yes' : 'no');
    if (!ready || !navState?.key) return;

    const group = segments[0];
    const screen = segments[1];
    const inTabs = group === '(tabs)' || group === undefined;
    const inOnboarding = group === 'onboarding';
    // Settings sits on the root stack rather than inside (tabs), so it would
    // otherwise fall through BOTH redirects below: a signed-out person deep
    // linking here would sit on a settings screen with no session, and someone
    // mid-onboarding would escape the resume chain. Anything that is part of the
    // signed-in app, wherever it lives in the router, is gated the same way.
    const inApp = inTabs || group === 'settings';
    const onConversation = inOnboarding && CONVERSATION_SCREENS.has(screen);
    // A RECOVERY SESSION IS A REAL SESSION, and that is the trap here. The link
    // in a password-reset email authenticates the person BEFORE they choose a
    // new password, so without this line the guard would see a valid session,
    // decide they are signed in, and send them into the app with the password
    // they could not remember still on the account. They would be in once and
    // locked out again next time - which is a worse failure than having no
    // reset at all, because it looks like it worked.
    const onPasswordReset = inOnboarding && screen === 'reset-password';
    const onAuthEntry = inOnboarding && (screen === 'consent' || screen === 'account');

    if (!session) {
      // The reset screen opens from a cold start with no session at all: it is
      // reading the tokens out of the link as this runs, and the session
      // appears a beat later. Redirecting on that beat would close the screen
      // the email just opened.
      if (onPasswordReset) return;
      console.log('[BOOT] no session; inApp =', inApp, ' -> redirecting =', inApp);
      if (inApp) router.replace('/onboarding/consent');
      return;
    }
    // Signed in: never police the linear conversation chain, and never move
    // somebody off the screen where they are setting a new password.
    if (onConversation || onPasswordReset) return;
    if (confirmedComplete.current) {
      if (inOnboarding) router.replace('/');
      return;
    }

    let cancelled = false;
    (async () => {
      // CONSENT BEFORE ANYTHING ELSE (build item 51, 2026-09-19). First write
      // whatever consent arrived with this session and was never stored - from
      // the consent screen a moment ago, or from the sign-up metadata after an
      // email confirmation - and only then ask whether a record exists. In that
      // order, never at the same time: checking first would send somebody who
      // consented thirty seconds ago back to the consent screen.
      await recordCarriedConsentIfMissing(session.user);
      const consent = await consentStatus();
      if (cancelled) return;
      if (consent !== 'current') {
        // Asked, never assumed - including the accounts that existed before
        // consent was recorded at all. Left alone once they are on the screen.
        const onConsent = inOnboarding && screen === 'consent';
        if (!onConsent) {
          // `changed` when they agreed to an earlier privacy policy, so the
          // screen can say why it is asking again.
          router.replace({
            pathname: '/onboarding/consent',
            params: { reconfirm: '1', ...(consent === 'outdated' ? { changed: '1' } : {}) },
          });
        }
        return;
      }

      const { data } = await supabase.from('user_profile').select('onboarding_step').maybeSingle();
      if (cancelled) return;
      const step = (data?.onboarding_step ?? 'not_started') as OnboardingStep;
      if (step === 'complete') {
        confirmedComplete.current = true;
        if (inOnboarding) router.replace('/');
        return;
      }
      // Unfinished, and sitting at an entry point → resume where they left off.
      if (inApp || onAuthEntry) router.replace(RESUME_ROUTE[step]);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, ready, segments, navState?.key, router]);

  return { ready };
}
