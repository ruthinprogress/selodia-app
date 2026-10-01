import * as Updates from 'expo-updates';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// WHICH BUILD IS THIS, IN ONE LINE SHE CAN READ OUT.
//
// Ruth, 1 October 2026: "Add a visible line at the bottom of Settings showing
// app version and update ID (for example 'Version 1.0.0, update 8895eb97')."
//
// WHY IT IS NOT ENOUGH THAT `BuildVersion` EXISTS. It does, with more detail and
// a fetch button, and it lives on Settings → About - one tap further in than the
// screen she opens. Tonight the cost of that tap was concrete: she opened the
// voice sheet at 21:15 and read a sentence I had reported as fixed at 21:00.
// Neither of us could say whether her phone had the fix, so the question went
// unanswered and the report that said "fixed" was unverifiable at the only place
// it mattered. One line on the screen she already opens closes that.
//
// IT IS A FACT, NOT A SETTING. The rule the settings page protects is against
// inventing product surface; an app stating its own version at the foot of a
// screen invents none, and every app does it.
//
// SELECTABLE, because the use is reading it to somebody or pasting it into a
// message. A version string nobody can copy is a version string nobody quotes
// accurately.
export function BuildStamp() {
  const { updateId, isEmbeddedLaunch, runtimeVersion } = Updates;

  // "No update applied" and "an update from Tuesday" look identical from the
  // outside, and telling them apart is the whole point. The embedded bundle is
  // the one baked into the APK at build time.
  const update =
    isEmbeddedLaunch || !updateId ? 'built-in bundle' : `update ${updateId.slice(0, 8)}`;

  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.stamp} selectable>
      {`Version ${runtimeVersion ?? '?'}, ${update}`}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  stamp: { alignSelf: 'center', marginTop: Spacing.three },
});
