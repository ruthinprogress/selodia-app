import * as Updates from 'expo-updates';
import { StyleSheet } from 'react-native';

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
// SELECTABLE, because its whole job is to be copied into a message to me.
export function BuildVersion() {
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
});
