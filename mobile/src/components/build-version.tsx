import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatLogDate } from '@/lib/week';

// WHICH BUNDLE IS ACTUALLY RUNNING.
//
// Asked for by Ruth on 2026-09-16 after it cost an afternoon twice in one day.
// First a publish reported success while having published nothing - the EAS step
// had failed four lines up in an output that ended in exit code 0. Then four
// updates went out, she tested after each, and reported "nothing changed, it
// still says Sen": every test was running the bundle from the launch before,
// because expo-updates serves what it already has and applies the download on
// the NEXT start. An hour went into inferring which bundle she was on, and the
// inference was wrong - I went looking for a rollback that never happened.
//
// This is the fact, not the inference. One line she can read out, and the
// question "did my change reach the phone" stops being a matter of deduction.
//
// IT IS NOT A SETTING, which is why it can sit on a screen whose own comment
// says the page "grows when the spec says it does". Nothing here is a
// preference, a toggle or a choice; it is the app stating its own version, the
// way every app does at the foot of its about screen. The rule that comment
// protects is against inventing product surface, and a version string invents
// none.
//
// AND SINCE 30 SEPTEMBER IT CAN FETCH ONE, which is the other half of the same
// afternoon. Ruth, today: the Report Builder wording she asked for went out at
// 13:32 and again at 13:55, and her phone was still showing the old words.
// Nothing had failed. expo-updates is configured with fallbackToCacheTimeout 0,
// so the app launches on the bundle it already has and applies the download on
// the NEXT start - which means every fix is one restart behind, every time, and
// a test run straight after a restart tests the previous version.
//
// Reading the line above tells her WHICH bundle she is on. This button gets her
// onto the current one in a single tap instead of two restarts and a guess.
// Nothing about it is a preference either; it is the same fact, made actionable.
export function BuildVersion() {
  const [state, setState] = useState<'idle' | 'checking' | 'none' | 'failed'>('idle');

  async function fetchLatest() {
    if (state === 'checking') return;
    setState('checking');
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setState('none');
        return;
      }
      await Updates.fetchUpdateAsync();
      // Restarts onto the bundle just downloaded. Nothing after this line runs.
      await Updates.reloadAsync();
    } catch {
      // A DEAD END IS SAID OUT LOUD. In Expo Go and on a development build
      // there is no update server to ask, and swallowing that leaves a button
      // that looks broken rather than one that is not available here.
      setState('failed');
    }
  }

  const { updateId, createdAt, channel, isEmbeddedLaunch, runtimeVersion } = Updates;

  // An update that has never been applied is the embedded bundle - the one baked
  // into the APK at build time. Saying so plainly is the point: "no update yet"
  // and "an update from Tuesday" look identical from the outside, and telling
  // them apart is the entire reason this exists.
  const applied =
    isEmbeddedLaunch || !updateId
      ? 'Built-in bundle, no update applied'
      : `Update ${updateId.slice(0, 8)}${
          createdAt ? ` · ${formatLogDate(createdAt)} ${hhmm(createdAt)}` : ''
        }`;

  return (
    <ThemedView style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" selectable>
        {applied}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" selectable>
        {`Channel ${channel || 'none'} · app ${runtimeVersion ?? '?'}`}
      </ThemedText>

      <Pressable
        onPress={() => void fetchLatest()}
        accessibilityRole="button"
        accessibilityLabel="Get the latest update and restart"
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="smallBold" themeColor="accentDeep">
          {state === 'checking' ? 'Checking…' : 'Get the latest update'}
        </ThemedText>
      </Pressable>

      {state === 'none' ? (
        <ThemedText type="small" themeColor="textSecondary">
          You are on the latest.
        </ThemedText>
      ) : null}
      {state === 'failed' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Updates are not available on this build.
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

// Local rather than Intl: Hermes on Android ships a variable ICU build, and the
// same reasoning that keeps week.ts off toLocaleDateString applies to a string
// whose only job is to be compared against a publish log.
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  // Quiet and last. A version line that draws the eye is a version line in the
  // wrong place.
  wrap: {
    paddingTop: Spacing.two,
    gap: Spacing.half,
    alignItems: 'center',
  },
  pressed: { opacity: 0.6 },
});
