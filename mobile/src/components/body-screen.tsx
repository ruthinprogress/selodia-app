import { useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpotlightScroll } from '@/components/spotlight-provider';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// The shell every screen in the Body stack sits inside.
//
// It exists because none of the view components own a scroller. They were all
// written as children of the single ScrollView in the old dashboard.tsx, and
// when that one screen became four routes each one needed its own. Four copies
// of the same twenty lines would have been four places to forget the
// SpotlightScroll wrapper, which fails quietly: a target that cannot scroll
// itself into view is measured off-screen and simply never highlights.
export function BodyScreen({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <SpotlightScroll scrollRef={scrollRef}>{children}</SpotlightScroll>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
});
