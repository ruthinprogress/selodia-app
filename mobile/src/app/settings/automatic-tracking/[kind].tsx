import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsGroup, SettingsPage, SettingsRow } from '@/components/settings-page';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  NOT_YET_BODY,
  NOTHING_SHARING,
  PATIENCE_DAYS,
  primaryAction,
  READABLE,
  STATE_BODY,
  stateHeading,
  TRACKING_LABEL,
  type TrackingKind,
  type TrackingState,
} from '@/lib/automatic-tracking';
import { requestStepPermission } from '@/lib/step-permission';
import { formatSteps, syncTodaySteps } from '@/lib/steps';
import { supabase } from '@/lib/supabase';
import {
  connectSleep,
  hasSleepPermission,
  openHealthConnect,
  readNightsFromPhone,
  syncSleepFromPhone,
} from '@/lib/sleep-sync';

// ONE TYPE, THREE STATES, ONE ACTION (Ruth's artwork, screens 3, 5 and 6).
//
// Her words for each state are in automatic-tracking.ts so that this screen and
// the list behind it can never disagree. What this file owns is the SHAPE she
// drew, which is the same on every state:
//
//   a card saying where you are, and why
//   at most one button, and only where there is something to press
//   Manage permissions
//   How it works
//
// WHY "WAITING" HAS NO BUTTON, and it is the whole lesson of the version this
// replaces. Health Connect can take hours to pass the first night through, so
// permissions-on-but-nothing-yet is not a failure. The old card offered "Check
// for new nights" at that moment, which returned "Nothing new" - a button that
// could not help, answering with the app's own disappointment. Her copy says
// the true thing instead: it is coming.
//
// AND THE ONLY SCREEN THAT IS NOT OURS is the system permission sheet, which
// Android does not let any app draw. Everything either side of it is here.

export default function AutomaticTrackingKindScreen() {
  const theme = useTheme();
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const key = (kind ?? '') as TrackingKind;
  const label = TRACKING_LABEL[key];

  const [state, setState] = useState<TrackingState>('not-enabled');
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const look = useCallback(async () => {
    // STEPS HAD A DEAD BUTTON HERE, shipped (Ruth, 24 October 2026): "It also
    // says Steps not connected and button dirsnt work". The screen was written
    // for sleep and every other readable type fell through its one branch -
    // which is exactly the fault the rest of this screen exists to avoid: a
    // control that names an action and then does nothing.
    if (key === 'steps') {
      const { data } = await supabase
        .from('user_profile')
        .select('steps_permission_declined')
        .maybeSingle();
      const declined = (data as { steps_permission_declined: boolean | null } | null)
        ?.steps_permission_declined;
      const today = declined ? null : await syncTodaySteps();
      if (declined) {
        setState('not-enabled');
        setDetail(null);
      } else if (today != null) {
        setState('receiving');
        setDetail(formatSteps(today));
      } else {
        setState('not-enabled');
        setDetail(null);
      }
      return;
    }

    if (key !== 'sleep') return;
    const allowed = await hasSleepPermission();
    if (!allowed) {
      setState('not-enabled');
      setDetail(null);
      return;
    }
    const nights = await readNightsFromPhone(PATIENCE_DAYS);
    const latest = nights[nights.length - 1];
    if (latest) {
      setState('receiving');
      setDetail(
        `${Math.floor(latest.minutes / 60)}h ${String(latest.minutes % 60).padStart(2, '0')}m`
      );
    } else {
      // ALLOWED TO READ AND NOTHING THERE, over a month. That is no longer
      // "any moment now" - see PATIENCE_DAYS. Waiting would be a reassuring
      // sentence over an undiagnosed problem.
      setState('error');
      setDetail(null);
    }
  }, [key]);

  // READ ON ARRIVAL, every time. Somebody comes back to this screen straight
  // from the permission sheet, and a status read once on mount would be the
  // status from before they changed it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        if (!cancelled) await look();
      })();
      return () => {
        cancelled = true;
      };
    }, [look])
  );

  if (!label) {
    return (
      <SettingsPage title="Not found">
        <ThemedText type="small" themeColor="textSecondary">
          That is not something Selodía can import.
        </ThemedText>
      </SettingsPage>
    );
  }

  // A TYPE THAT CANNOT BE READ YET SAYS SO, and offers nothing. A button that
  // does nothing is worse than a blank space, and five of the seven are here
  // because her artwork shows them rather than because they work.
  if (!READABLE[key]) {
    return (
      <SettingsPage title={label}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <Ionicons name="time-outline" size={22} color={theme.textSecondary} />
          <ThemedText type="smallBold">Not available yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            {NOT_YET_BODY}
          </ThemedText>
        </ThemedView>
        <HowItWorks />
      </SettingsPage>
    );
  }

  async function turnOn() {
    setBusy(true);
    if (key === 'steps') {
      const result = await requestStepPermission();
      // ONLY A REAL REFUSAL COUNTS AS ONE. iOS cannot tell an app whether read
      // access was granted, so 'unknown' leaves the stored answer alone - the
      // same rule as onboarding, and the reason three silent failures were
      // fixed in September.
      if (result === 'granted') {
        await supabase.from('user_profile').update({ steps_permission_declined: false }).not('id', 'is', null);
      } else if (result === 'declined' || result === 'unsupported') {
        await supabase.from('user_profile').update({ steps_permission_declined: true }).not('id', 'is', null);
      }
    } else {
      const outcome = await connectSleep();
      // THE SHEET IS THE ONLY WAY IN, and after it closes the honest thing is
      // to look again rather than to trust what the call returned - a grant can
      // land a moment after the dialog goes.
      if (outcome.state === 'granted') await syncSleepFromPhone(30);
    }
    await look();
    setBusy(false);
  }

  const action = primaryAction(state);

  return (
    <SettingsPage title={label}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <Ionicons
          name={key === 'steps' ? 'walk-outline' : 'moon-outline'}
          size={22}
          color={state === 'receiving' ? theme.accentDeep : theme.textSecondary}
        />
        <ThemedText type="smallBold">{stateHeading(state, label)}</ThemedText>

        {/* RECEIVING SHOWS THE THING ITSELF, not the word "on". Her artwork's
            example is the night, large, with its hours - because the proof
            that automatic tracking works is the data being there. */}
        {state === 'receiving' && detail ? (
          <ThemedText type="title" style={styles.figure}>
            {detail}
          </ThemedText>
        ) : null}

        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {state === 'error' ? NOTHING_SHARING : STATE_BODY[state]}
        </ThemedText>

        {action ? (
          <Pressable
            onPress={() => void (state === 'error' ? openHealthConnect() : turnOn())}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={action}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="background" style={[styles.button, { backgroundColor: theme.accentDeep }]}>
              <ThemedText type="small" style={{ color: theme.background }}>
                {busy ? 'One moment…' : action}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}
      </ThemedView>

      {/* NO SLEEP DATA YET, said as its own quiet row rather than as alarm.
          This is the state her old card got wrong. */}
      {state === 'waiting' ? (
        <ThemedView type="backgroundElement" style={styles.quiet}>
          <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
          <View style={styles.quietText}>
            <ThemedText type="small">No {label.toLowerCase()} data yet</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              As soon as we receive your first night, it will appear here.
            </ThemedText>
          </View>
        </ThemedView>
      ) : null}

      <SettingsGroup>
        {state === 'receiving' ? (
          <SettingsRow
            first
            icon="calendar-outline"
            label="See this week"
            detail={`Your ${label.toLowerCase()} in the Log`}
            onPress={() => router.push(key === 'steps' ? '/log/activity-history' : '/log/sleep')}
          />
        ) : null}
        <SettingsRow
          first={state !== 'receiving'}
          icon="options-outline"
          label="Manage permissions"
          detail="Change what Selodía can read"
          onPress={openHealthConnect}
        />
        <SettingsRow
          icon="help-circle-outline"
          label="How it works"
          detail={`A short guide to ${label.toLowerCase()} tracking`}
          onPress={() => router.push('/health-data')}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}

function HowItWorks() {
  return (
    <SettingsGroup>
      <SettingsRow
        first
        icon="help-circle-outline"
        label="How it works"
        detail="What Selodía reads, and what it never reads"
        onPress={() => router.push('/health-data')}
      />
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two },
  body: { lineHeight: 20 },
  figure: { marginTop: Spacing.one },
  button: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  quiet: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    marginTop: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  quietText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
});
