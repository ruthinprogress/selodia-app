import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// The Almanac's first-view introduction (build item 15, UI slice 5 — Part Ten).
// Shown once, the first time someone opens the Almanac after onboarding.
//
// NO ONBOARDING CHECK HERE, and none is needed: the auth guard already refuses
// to let anyone into `(tabs)` unless `user_profile.onboarding_step` is
// 'complete', so simply being on this screen means onboarding is finished.
// Re-querying for it would add a round trip to re-establish something the router
// has already guaranteed.
//
// COPY — adapted from Part Ten, and the adaptation is deliberate. The spec
// writes this as Unflump SPEAKING, post-onboarding: "This is where we'll keep
// all your goals, personal plans, and anything else you feel you need to keep
// within easy reach. Just click here any time you need to. Do you have any
// questions about this area?" Two parts of that do not survive the move from a
// chat turn to a card on the page:
//
//   - "Just click here any time you need to" — they are already here. Telling
//     someone to click their way to the page they are standing on is noise.
//   - "Do you have any questions about this area?" — a question with nothing
//     to answer it. A card cannot take a reply, and a dead question reads worse
//     than no question.
//
// What is kept is the substance: what this place is FOR. Orientation, not a
// tutorial — being shown a room rather than handed instructions. It deliberately
// does not explain how entries get here or when: the empty state beneath it
// already does that job, and saying it twice would turn a welcome into a lesson.

export const ALMANAC_INTRO_HEADING = 'This is your Almanac';
export const ALMANAC_INTRO_BODY =
  "Your goals, your plans, and anything else worth keeping within easy reach — this is where they live.";
export const ALMANAC_INTRO_DISMISS = 'Got it';

export function AlmanacIntro({ onDismiss }: { onDismiss: () => void }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card} accessibilityRole="summary">
      <ThemedText type="smallBold">{ALMANAC_INTRO_HEADING}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {ALMANAC_INTRO_BODY}
      </ThemedText>

      {/* One control, and it is the only way out — there is no secondary
          "remind me later". A card shown once does not need a maybe. */}
      <View style={styles.actions}>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss the Almanac introduction"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.action}>
            <ThemedText type="smallBold">{ALMANAC_INTRO_DISMISS}</ThemedText>
          </ThemedView>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  body: {
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.two,
  },
  action: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
