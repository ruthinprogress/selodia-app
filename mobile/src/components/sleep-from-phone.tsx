import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import {
  connectSleep,
  hasSleepPermission,
  HEALTH_CONNECT_PACKAGE,
  openHealthConnect,
  openHealthConnectSources,
  syncSleepFromPhone,
  type SleepConnectOutcome,
} from '@/lib/sleep-sync';

// LET THE PHONE FILL IN THE NIGHT (Ruth, 23 October 2026).
//
//   "we need any data that comes from the phone as it will be build into the
//    app since the whole idea is to reduce friction, so a run logged on samsung
//    health flows in automatically from the phone or the wearable. if it
//    doesn't do that people with wearables will think selodia is junk, simple
//    as that."
//
// AND WHEN IT DOES NOT WORK, THE APP TAKES HER THERE. Her second instruction,
// after the first version answered a failure with "Not connected": "users
// shouldn't be coming up against this, the app needs to facilitate the settings
// required."
//
// That is the same principle one level down. An app whose answer to a blocked
// setting is to name the block has handed the problem back to the person -
// which is the thing this whole product exists not to do. Every outcome below
// either fixed itself or offers the button that fixes it.
//
// THE ONE IT CANNOT FIX IS WORTH KNOWING ABOUT. If the installed build predates
// the permission being declared, Health Connect refuses and there is nothing
// any screen can do: Android compiles permissions into the APK and an
// over-the-air update carries only JavaScript. That was exactly the state on 23
// October - build from the 9th, permissions declared on the 15th - and it is
// why "Connect" could not have worked however it was written.

type Step = {
  /** What is true, in a sentence. */
  body: string;
  /** The way out, where there is one. */
  action?: { label: string; run: () => void };
};

function stepFor(outcome: SleepConnectOutcome): Step {
  switch (outcome.state) {
    case 'granted':
      return {
        body: `Brought in ${outcome.nights} night${outcome.nights === 1 ? '' : 's'} from your phone.`,
      };

    // ALLOWED, BUT NOTHING IS PUTTING SLEEP IN. The likeliest place to be stuck
    // on a Samsung, and the one Selodía genuinely cannot change: Samsung Health
    // has to be switched on to share sleep with Health Connect, from inside
    // Samsung Health. So this says where to go and opens the screen that lists
    // what each app is sharing, which is where the gap is visible.
    case 'granted-no-data':
      return {
        body:
          'Selodía can read your sleep now, but nothing has put any in yet. If you track '
          + 'sleep with Samsung Health or another app, it needs to be set to share sleep '
          + 'with Health Connect - that switch lives in that app, not here.',
        action: { label: 'See what is sharing', run: openHealthConnectSources },
      };

    // ANDROID IS HOLDING A NO. Tapping Connect again does nothing at all after
    // a refusal - the system stops showing the dialog - so offering it again
    // would be a button that cannot work.
    case 'refused':
      return {
        body:
          'Android is holding that as a no, and it will not ask again from here. You can '
          + 'change it in Health Connect, under Selodía.',
        action: { label: 'Open Health Connect', run: openHealthConnect },
      };

    case 'needs-update':
      return {
        body: 'Health Connect is on this phone but needs updating before it can share sleep.',
        action: {
          label: 'Update Health Connect',
          run: () => void Linking.openURL(`market://details?id=${HEALTH_CONNECT_PACKAGE}`),
        },
      };

    // NO HEALTH CONNECT. On most phones it is already there; where it is not,
    // this is a one-tap install rather than a name to go and search for.
    case 'no-health-connect':
    default:
      return {
        body:
          'This phone does not have Health Connect, which is what Android uses to pass '
          + 'sleep between apps. It is free, from Google.',
        action: {
          label: 'Get Health Connect',
          run: () => void Linking.openURL(`market://details?id=${HEALTH_CONNECT_PACKAGE}`),
        },
      };
  }
}

export function SleepFromPhone({ onSynced }: { onSynced: () => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step | null>(null);

  const refresh = useCallback(async () => {
    setConnected(await hasSleepPermission());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ANDROID ONLY, FOR NOW, AND SAID RATHER THAN HIDDEN. The iOS read is not
  // written yet; drawing nothing on an iPhone leaves somebody hunting for a
  // control that is not coming.
  if (Platform.OS !== 'android') return null;
  if (connected === null) return null;

  async function connect() {
    setBusy(true);
    setStep(null);
    const outcome = await connectSleep();
    setStep(stepFor(outcome));
    setConnected(outcome.state === 'granted' || outcome.state === 'granted-no-data');
    if (outcome.state === 'granted') onSynced();
    setBusy(false);
  }

  async function again() {
    setBusy(true);
    setStep(null);
    const written = await syncSleepFromPhone();
    setStep({
      body: written > 0 ? `Updated ${written} night${written === 1 ? '' : 's'}.` : 'Nothing new.',
    });
    onSynced();
    setBusy(false);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">
        {connected ? 'Your phone is filling these in' : 'Let your phone fill these in'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {connected
          ? 'Nights tracked by your phone or watch appear here on their own. How a night felt is still yours to say.'
          : 'If your phone or watch tracks your sleep, Selodía can read when you slept and how often the night broke, so you do not have to type it. It never reads how the night felt - that is yours to say.'}
      </ThemedText>

      {step ? (
        <ThemedText type="small" themeColor="textSecondary">
          {step.body}
        </ThemedText>
      ) : null}

      <View style={styles.buttons}>
        <Button
          label={busy ? 'One moment…' : connected ? 'Check for new nights' : 'Connect'}
          disabled={busy}
          onPress={() => void (connected ? again() : connect())}
        />
        {/* THE WAY OUT, BESIDE THE THING THAT FAILED. Not in a help page, not a
            sentence naming a settings screen she then has to find. */}
        {step?.action ? (
          <Button label={step.action.label} onPress={step.action.run} disabled={busy} />
        ) : null}
      </View>
    </ThemedView>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView type="background" style={styles.button}>
        <ThemedText type="small" themeColor="accentDeep">
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.6 },
});
