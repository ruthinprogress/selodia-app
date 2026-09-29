import { ScrollView, StyleSheet } from 'react-native';
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="sectionTitle">{question}</ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
          {children}
        </ScrollView>
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
