import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Shown inline directly under any assistant reply whose food guidance drew on
// the person's stored health context (SELODIA_SPEC.md, Part Twelve). The text
// is verbatim and fixed; the backend decides when it applies (healthGuidanceApplied).
const DISCLAIMER =
  "This takes into account the health context you've shared. Dietary changes that affect medical markers should always be confirmed with your GP or dietitian.";

export function HealthDisclaimer() {
  return (
    <ThemedView type="backgroundElement" style={styles.note}>
      <ThemedText type="small" themeColor="textSecondary">
        {DISCLAIMER}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  note: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
});
