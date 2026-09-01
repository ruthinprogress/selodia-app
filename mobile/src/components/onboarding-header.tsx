import { usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useOnboardingActionSlot } from '@/components/onboarding-action';
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
  // The forward action, registered by whichever screen is showing. Null until a
  // screen has one to offer - see onboarding-action.tsx for why it moved here
  // off the message box.
  const action = useOnboardingActionSlot();

  // Not an onboarding screen (or an unrecognised one) — render nothing rather
  // than guess at a position.
  if (!progress) return null;

  return (
    <ThemedView style={styles.wrap}>
      {/* Title and counter now stack on the left so the right edge is free for
          the action. Reads as "Getting to know you / 4 of 10 ... Continue",
          which pairs the button with the progress it advances rather than with
          the message box it kept being mistaken for. */}
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <ThemedText type="smallBold">{ONBOARDING_TITLE}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {progress.index} of {progress.total}
          </ThemedText>
        </View>

        {action && (
          <View style={styles.actions}>
            {action.secondary && (
              <Pressable
                onPress={action.secondary.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.secondary.label}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="small" themeColor="textSecondary" style={styles.secondary}>
                  {action.secondary.label}
                </ThemedText>
              </Pressable>
            )}

            {/* Disabled, never hidden. A button that appears only once you have
                answered draws the eye at the exact moment attention belongs on
                the reply; one that waits, dimmed, says "not yet" instead of
                "there is no way forward". */}
            <Pressable
              onPress={action.onPress}
              disabled={!action.enabled}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled: !action.enabled }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView
                type={action.enabled ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.actionButton}
              >
                <ThemedText
                  type="smallBold"
                  themeColor={action.enabled ? 'text' : 'textSecondary'}
                >
                  {action.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        )}
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
    alignItems: 'center',
  },
  titleBlock: {
    // Shrinkable, so a long title never squeezes the action off the edge.
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // Never shrinks: the button keeps its size and the title wraps instead.
    flexShrink: 0,
  },
  actionButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  secondary: {
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
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
