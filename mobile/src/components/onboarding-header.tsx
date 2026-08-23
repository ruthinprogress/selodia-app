import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ONBOARDING_TITLE, progressForPath } from '@/lib/onboarding-progress';

// The persistent onboarding header (build item 48). Two jobs, both from live
// device feedback: say plainly that this is a bounded setup phase, and show how
// far through it is.
//
// The counter is SEGMENTED rather than a continuous fill bar, on purpose. A
// smooth bar implies the steps are equal in length and they are not — "what
// matters to you" is a multi-turn conversation while "how tracking works" is
// close to a single exchange. A continuous bar would appear to stall during the
// long steps, which makes the feeling of being lost worse rather than better.
// Discrete segments promise only what is true: nine steps, this is the fourth.
export function OnboardingHeader() {
  const theme = useTheme();
  const pathname = usePathname();
  const progress = progressForPath(pathname);

  // Not an onboarding screen (or an unrecognised one) — render nothing rather
  // than guess at a position.
  if (!progress) return null;

  return (
    <ThemedView style={styles.wrap}>
      <View style={styles.row}>
        <ThemedText type="smallBold">{ONBOARDING_TITLE}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {progress.index} of {progress.total}
        </ThemedText>
      </View>

      <View
        style={styles.segments}
        accessibilityRole="progressbar"
        accessibilityLabel={`${ONBOARDING_TITLE}: step ${progress.index} of ${progress.total}, ${progress.label}`}
      >
        {Array.from({ length: progress.total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < progress.index ? theme.text : theme.backgroundElement },
            ]}
          />
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
        {progress.label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: 11,
  },
});
