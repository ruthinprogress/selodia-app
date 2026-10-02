import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// THE SHELL EVERY TAP-BASED ONBOARDING SCREEN SITS IN.
//
// It exists for the reason consent.tsx's own comment gives: that screen had no
// ScrollView until 2026-09-01, so on a short phone the Continue button was
// simply clipped off the bottom and onboarding could not be started. It was the
// only screen missing one out of eleven, "which is exactly why it went
// unnoticed: the pattern looked established because it was, in ten files out of
// eleven."
//
// Five new screens arrived tonight. Writing the pattern out five more times is
// how a twelfth file quietly misses it.
//
// SCREENS ARE IMPERSONAL. Only chat says "I". Nothing this renders does.
//
// THE KEYBOARD USED TO COVER THE BOX SHE WAS TYPING IN.
//
// Ruth, finding B3 of 1 October and again in item 5 on 2 October: "The keyboard
// hides the setup text boxes. A focused input must scroll above it."
//
// WHY A PLAIN ScrollView WAS NEVER GOING TO DO IT. A ScrollView does not know
// where the caret is. Android's adjustResize shrinks the window, which moves the
// bottom of the scroller up but does not scroll to the focused field, so a box
// near the bottom of a long screen - "Something else on your plate?" under three
// groups of chips - ends up exactly behind the keyboard. On her Samsung that is
// what happened, and `keyboardShouldPersistTaps` does nothing about it: that
// setting is about taps surviving a dismiss, not about visibility.
//
// KeyboardAwareScrollView KNOWS. It tracks the focused input and the keyboard
// frame together and scrolls the field clear. react-native-keyboard-controller is
// already a dependency and KeyboardProvider is already mounted at the root in
// app/_layout.tsx, so this is a one-component swap rather than new machinery -
// account.tsx has had it queued as "the durable fix" in a comment since
// 1 October.
//
// bottomOffset LEAVES ROOM FOR THE NEXT THING. Scrolling the field to exactly
// the top of the keyboard puts it flush against it, with no sign that anything
// follows. A little over one line of space reads as "there is more here".
//
// FIXED HERE RATHER THAN PER SCREEN, which is the whole reason this file exists:
// "Writing the pattern out five more times is how a twelfth file quietly misses
// it." Every tap-based setup screen gets it from this one change.

export function OnboardingQuestion({
  question,
  subtitle,
  children,
}: {
  question: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Room for the next thing below the field, so it never sits
          // flush against the top of the keyboard.
          bottomOffset={24}>
          <ThemedText type="sectionTitle">{question}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
          {children}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  // On the CONTENT container, not the ScrollView: applied to the scroller these
  // constrain the viewport and clip again rather than laying out a scrollable
  // column. Same shape as account.tsx and every other onboarding screen.
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.four,
  },
});
