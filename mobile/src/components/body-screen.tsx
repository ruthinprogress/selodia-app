import { useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsLink } from '@/components/settings-link';
import { SpotlightScroll } from '@/components/spotlight-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';

// The shell every screen in the Body stack sits inside.
//
// It exists because none of the view components own a scroller. They were all
// written as children of the single ScrollView in the old dashboard.tsx, and
// when that one screen became four routes each one needed its own. Four copies
// of the same twenty lines would have been four places to forget the
// SpotlightScroll wrapper, which fails quietly: a target that cannot scroll
// itself into view is measured off-screen and simply never highlights.
export function BodyScreen({
  children,
  settingsInHeader = false,
  title,
}: {
  children: React.ReactNode;
  /** True when this screen's stack header carries the mark itself, so the
      in-content one would be a second copy sitting under the header. */
  settingsInHeader?: boolean;
  /** The screen's own name, in the display face (Ruth, 25 September 2026).
      Lives here rather than in seven screens, because it is one line in each
      and seven places to word it differently. The stack header no longer
      carries a title at all - see the Log's _layout - so this is the only
      name these screens have. */
  title?: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  // This shell does not pad for the status bar (edges below exclude 'top'), so
  // the Settings link is told how tall it is. See settings-link.tsx.
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          {/* Every Log screen, including the week-by-week ones, from one place
              (bug list item 13). */}
          {!settingsInHeader && <SettingsLink topInset={insets.top} />}
          {title ? <ThemedText type="pageTitle">{title}</ThemedText> : null}
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
    paddingHorizontal: PageInset.horizontal,
    paddingTop: PageInset.top,
    paddingBottom: PageInset.bottom,
    gap: Spacing.three,
  },
});
