import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { requestStepPermission, type StepPermissionResult } from '@/lib/step-permission';
import { formatSteps, syncTodaySteps } from '@/lib/steps';
import { supabase } from '@/lib/supabase';

// Turning step tracking on, after onboarding is over.
//
// WHY THIS HAD TO EXIST BEFORE THE FEATURE COULD BE TESTED AT ALL (2026-09-16).
// The permission is asked for exactly once, in onboarding, and Ruth's profile
// has carried `steps_permission_declined = true` since - possibly a real no,
// possibly the false-decline defect fixed on 9 September, and there has never
// been a way to tell or to change it. So the reader built today would have
// returned null forever on her own phone, correctly, and looked like a broken
// feature rather than an unanswered question.
//
// IT REPORTS, IT DOES NOT NAG. One control, pressed on purpose, in the one place
// a person goes to change how the app behaves. Part Twelve's objection to a
// "pause check-ins" toggle was to the app administering itself at somebody; this
// is the opposite - the person reaching for something they were asked about once
// and want to answer differently now.
//
// 'UNKNOWN' IS NEVER WRITTEN AS A DECLINE, the same rule onboarding follows and
// for the same reason: Apple will not say whether read access was granted, and
// recording a guess would permanently silence a retry the person never refused.

type Status = 'loading' | 'on' | 'off' | StepPermissionResult;

export function StepTracking() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<number | null>(null);

  // What the app currently believes, before anybody presses anything. A stored
  // decline is shown as off; anything else is shown as on only if a real figure
  // comes back, because "on" with nothing behind it is the claim this whole day
  // was spent removing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_profile')
        .select('steps_permission_declined')
        .maybeSingle();
      const declined = (data as { steps_permission_declined: boolean | null } | null)
        ?.steps_permission_declined;
      const today = declined ? null : await syncTodaySteps();
      if (cancelled) return;
      setSteps(today);
      setStatus(declined ? 'off' : today != null ? 'on' : 'off');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requestStepPermission();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // The same rule as onboarding: only a real refusal, or a phone with no
        // health platform at all, counts as a decline. An 'unknown' leaves the
        // stored answer exactly as it was.
        if (result === 'granted') {
          await supabase
            .from('user_profile')
            .update({ steps_permission_declined: false })
            .eq('user_id', user.id);
        } else if (result === 'declined' || result === 'unsupported') {
          await supabase
            .from('user_profile')
            .update({ steps_permission_declined: true })
            .eq('user_id', user.id);
        }
      }

      // Read immediately on a yes, so the answer to "did that work" is a number
      // on this screen rather than an instruction to go and look somewhere else.
      const today = result === 'granted' || result === 'unknown' ? await syncTodaySteps() : null;
      setSteps(today);
      setStatus(result === 'granted' && today != null ? 'on' : result);
    } finally {
      setBusy(false);
    }
  }

  // Each line says only what is actually known. "Unknown" in particular promises
  // nothing: on iOS a granted permission and a refused one look identical from
  // here, so it describes what will happen rather than what has.
  const line: Record<Status, string> = {
    loading: '…',
    on: steps != null ? `On. ${formatSteps(steps)} steps so far today.` : 'On.',
    off: 'Off. Your steps are not being read, so movement only counts when you log it.',
    granted: steps != null ? `On. ${formatSteps(steps)} steps so far today.` : 'On, though there are no steps recorded yet today.',
    declined: 'Not allowed. You can change that in your phone’s health settings whenever you like.',
    unsupported: 'This phone has no health app to read steps from, so there is nothing to turn on.',
    unknown: 'Asked. If your phone shares your steps they will start appearing on their own.',
  };

  const canAsk = status === 'off' || status === 'declined' || status === 'unknown';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Step tracking</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {line[status]}
      </ThemedText>

      {canAsk && (
        <Pressable
          onPress={turnOn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Turn on step tracking"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.action}>
            <ThemedText type="smallBold">{busy ? 'Asking…' : 'Turn on step tracking'}</ThemedText>
          </ThemedView>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  body: { lineHeight: 20 },
  action: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
