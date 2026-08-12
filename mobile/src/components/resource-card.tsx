import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ResourceCardProps = {
  title: string;
  description: string;
  url: string;
};

// Small, quiet, tappable - never inline text. Per UNFLUMP_LANGUAGE_RULES.md:
// title/description are AI-generated and responsive to the moment; the org
// and url are always passed in from the deterministic lookup, never chosen
// here or by the model.
export function ResourceCard({ title, description, url }: ResourceCardProps) {
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(url)} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundSelected" style={styles.card}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  pressed: {
    opacity: 0.7,
  },
});
