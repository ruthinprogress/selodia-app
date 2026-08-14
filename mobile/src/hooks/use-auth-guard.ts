import type { Session, User } from '@supabase/supabase-js';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { RESUME_ROUTE, type OnboardingStep } from '@/lib/onboarding-step';
import { supabase } from '@/lib/supabase';

// The onboarding conversation screens (Part Seven's linear push-chain). The
// guard stays passive on these so it never fights forward progress — it only
// acts at the boundary: the (tabs) app and the auth-entry screens.
const CONVERSATION_SCREENS = new Set([
  'intro',
  'equipment',
  'goals',
  'health-context',
  'technical',
  'nutrition',
  'activity',
]);

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
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Wait until both the session check and the root navigator are ready;
    // redirecting before navigation mounts throws.
    if (!ready || !navState?.key) return;

    const group = segments[0];
    const screen = segments[1];
    const inTabs = group === '(tabs)' || group === undefined;
    const inOnboarding = group === 'onboarding';
    const onConversation = inOnboarding && CONVERSATION_SCREENS.has(screen);
    const onAuthEntry = inOnboarding && (screen === 'consent' || screen === 'account');

    if (!session) {
      if (inTabs) router.replace('/onboarding/consent');
      return;
    }
    // Signed in: never police the linear conversation chain.
    if (onConversation) return;
    if (confirmedComplete.current) {
      if (inOnboarding) router.replace('/');
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('user_profile').select('onboarding_step').maybeSingle();
      if (cancelled) return;
      const step = (data?.onboarding_step ?? 'not_started') as OnboardingStep;
      if (step === 'complete') {
        confirmedComplete.current = true;
        if (inOnboarding) router.replace('/');
        return;
      }
      // Unfinished, and sitting at an entry point → resume where they left off.
      if (inTabs || onAuthEntry) router.replace(RESUME_ROUTE[step]);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, ready, segments, navState?.key, router]);

  return { ready };
}
