import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useOnboardingActionSlot } from '@/components/onboarding-action';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ButtonRadius, Spacing } from '@/constants/theme';
import {
  BODY_MANUAL_NOTE,
  ONBOARDING_TITLE,
  isBodyManual,
  progressForPath,
} from '@/lib/onboarding-progress';
import { isOneQuestion } from '@/lib/one-question';
import { setRedoing, useRedoing } from '@/lib/redo-setup';

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
  const pathname = usePathname();
  const progress = progressForPath(pathname);
  // Body Manual screens say what they are for. See onboarding-progress.ts.
  const manual = isBodyManual(pathname);
  // The forward action, registered by whichever screen is showing. Null until a
  // screen has one to offer - see onboarding-action.tsx for why it moved here
  // off the message box.
  const action = useOnboardingActionSlot();
  // Set when she came in through More > redo setup. Her account is still
  // finished for the whole of that visit, so leaving costs her nothing.
  const redoing = useRedoing();
  // A QUESTION OPENED FROM HER BODY MANUAL IS NOT A STEP (2 October 2026).
  //
  // Ruth tapped "Change this" on her week and the header said "Getting to know
  // you / 4 of 7". It is one question she chose to revisit, not the fourth of
  // seven things standing between her and a finished app, and saying otherwise
  // is what made it feel like being dragged through onboarding again.
  const oneQuestion = isOneQuestion(useGlobalSearchParams<{ redo?: string }>());

  // THE WAY OUT IS NOT PART OF THE DECORATION (2026-09-30).
  //
  // This said `if (!progress) return null` - render nothing on a screen the
  // progress list does not recognise, rather than guess at a position. Sound
  // reasoning about a COUNT, and catastrophic, because the Continue button
  // lives in this same header and went with it.
  //
  // WHAT IT DID TO RUTH. She tapped "redo setup" in More, which drops her on
  // Goals. Goals is in the list, so it had a button. Its Continue goes to
  // /onboarding/skill, which is NOT in the list - along with life-stage,
  // activities, steer-around, allergies, guidance and first-draft, the entire
  // second half of the flow. So the header vanished, and with it the only
  // control that moves forward. The stack has headerShown: false, so there was
  // no back either. Force-closing returned her to Goals, because the step was
  // written the moment she tapped redo, and Continue took her straight back to
  // the screen with no button. Locked in, twice over.
  //
  // So the action renders WHATEVER the path is, and only the count and the
  // segments wait to be sure of themselves. A screen this file has never heard
  // of now costs a progress number, which is cosmetic. It used to cost the way
  // out, which is not.
  if (!progress && !action && !redoing) return null;

  return (
    <ThemedView style={styles.wrap}>
      {/* Title and counter now stack on the left so the right edge is free for
          the action. Reads as "Getting to know you / 4 of 10 ... Continue",
          which pairs the button with the progress it advances rather than with
          the message box it kept being mistaken for. */}
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <ThemedText type="smallBold">{ONBOARDING_TITLE}</ThemedText>
          {progress?.index != null && !oneQuestion && (
            <ThemedText type="small" themeColor="textSecondary">
              {progress.index} of {progress.total}
            </ThemedText>
          )}
        </View>

        <View style={styles.actions}>
          {/* THE DOOR OUT, and it is visible on every screen rather than the
              first (Ruth, 30 September). It is drawn before the forward action
              and in the quiet style, so it reads as the way back rather than
              competing with the way on. */}
          {redoing && (
            <Pressable
              onPress={() => {
                setRedoing(false);
                router.replace('/');
              }}
              accessibilityRole="button"
              accessibilityLabel="Leave setup"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="textSecondary" style={styles.secondary}>
                Leave setup
              </ThemedText>
            </Pressable>
          )}

          {action && (
          <>
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
          </>
          )}
        </View>
      </View>

      {/* NO PROGRESS BAR (Ruth, 2 October 2026, item 6). The segmented counter
          that used to sit here is gone; the "2 of 7" line above it stays, because
          her own approved preview carries exactly that line.

          WHY THE DISTINCTION IS REAL AND NOT ME SPLITTING HAIRS. The bar's own
          defence, written when it was built, was that segments "promise only what
          is true: nine steps, this is the fourth". That was an argument against a
          CONTINUOUS bar, and it answered the wrong objection. A bar of any kind
          draws the eye to how much is left, every screen, in a flow whose whole
          promise is that it takes about a minute - and it makes seven taps look
          like a form to get through. Four words do the same job and ask for no
          attention.

          The step LABEL went with it. "How you move" under a heading that already
          says "What do you already do?" is the same fact twice. */}

      {/* THE HONESTY THE SPLIT EXISTS FOR (Ruth, 30 September 2026). A Body
          Manual question has no feature behind it today, which breaks her own
          rule that every answer must change something - unless she is told.
          One quiet line, on the screens it applies to, and nowhere else. */}
      {manual && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.stepLabel}>
          {BODY_MANUAL_NOTE}
        </ThemedText>
      )}
    </ThemedView>
  );
}

// THE SEGMENTED COUNTER WAS HERE, and was removed on 2 October 2026 with the
// rest of the progress bar. Its props and its accessibility label went with it;
// the counter line in the header keeps the only promise it was making.

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
    borderRadius: ButtonRadius,
  },
  secondary: {
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  stepLabel: {
    fontSize: 11,
  },
});
