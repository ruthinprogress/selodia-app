import { ScrollView, StyleSheet } from 'react-native';

import { BodyManual } from '@/components/body-manual';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// THE BODY MANUAL, ON ITS OWN (Ruth, 4 October 2026: "Body Manual lives in More,
// not Profile").
//
// It was a section at the bottom of the profile screen, under her name and date
// of birth. Those are the few facts the app needs ABOUT her; the Manual is
// everything she has told it about her body, which is a different and much larger
// thing - and putting it under a heading about personal details is why the
// training switch read as "useless hidden away in profile settings".
//
// The component is unchanged and unmoved. This is a screen to put it on.

export default function BodyManualScreen() {
  return (
    <ThemedView style={styles.page}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <BodyManual />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  wrap: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
