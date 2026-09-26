import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsLink } from '@/components/settings-link';
import { SpotlightScroll } from '@/components/spotlight-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';
import { closeOpenSwipe } from '@/lib/open-swipe';
import { useTheme } from '@/hooks/use-theme';

// The shell every screen in the Log stack sits inside.
//
// It exists because none of the view components own a scroller. They were all
// written as children of the single ScrollView in the old dashboard.tsx, and
// when that one screen became several routes each one needed its own. A copy of
// the same twenty lines per screen would have been that many places to forget
// the SpotlightScroll wrapper, which fails quietly: a target that cannot scroll
// itself into view is measured off-screen and simply never highlights.
//
// IT NOW DRAWS THE TOP OF THE SCREEN TOO (Ruth, 25 September 2026). The stack
// used to have a native header carrying a back arrow, and the More mark sat in
// that header on one screen and underneath it on six others. Her instruction
// was that the mark "must sit at the same fixed vertical position on every
// screen, flush top right, not relative to the page heading" - which a header's
// right-hand control cannot do, because it sits at whatever height the header
// is and the tab screens have no header at all.
//
// So the header is gone (see the Log's _layout) and both controls are drawn
// here, pinned to the screen: the arrow top left, the mark top right, on the
// same line, at the same offset from the status bar, on every screen in the
// app. One place decides it, and a screen added tomorrow gets it by using this
// shell rather than by remembering a prop.
const TOP_ROW = Spacing.two;
const ARROW_SIZE = 26;

export function BodyScreen({
  children,
  title,
}: {
  children: React.ReactNode;
  /** The screen's own name, in the display face (Ruth, 25 September 2026).
      Lives here rather than in eight screens, because it is one line in each
      and eight places to word it differently. There is no header any more, so
      this is the only name these screens have. */
  title?: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The Log's own root cannot go back, and an arrow that does nothing is the
  // dead control principle 8 rules out. Asked of the router rather than passed
  // in as a prop: the router already knows, and a prop is a thing to get wrong.
  const canGoBack = router.canGoBack();

  return (
    <ThemedView style={styles.container}>
      {/* Excludes 'top' on purpose: the content runs up behind the status bar
          and its own padding, computed below, is what clears it. That keeps the
          scroll content's top edge in the same place whether or not the phone
          has a notch. */}
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          ref={scrollRef}
          // Scrolling closes an open swipe (Ruth, item 2).
          onScrollBeginDrag={closeOpenSwipe}
          contentContainerStyle={[
            styles.content,
            // Below the status bar, then below the arrow-and-mark row, then the
            // page's own top margin. Written as a sum rather than a number so
            // that changing the mark's size cannot silently push a title under
            // it.
            { paddingTop: insets.top + TOP_ROW + ARROW_SIZE + PageInset.top },
          ]}
        >
          {title ? <ThemedText type="pageTitle">{title}</ThemedText> : null}
          <SpotlightScroll scrollRef={scrollRef}>{children}</SpotlightScroll>
        </ScrollView>
      </SafeAreaView>

      {/* BOTH OUTSIDE THE SCROLLER, so they stay in the corner while the page
          moves under them. */}
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={Spacing.three}
          style={({ pressed }) => [
            styles.back,
            { top: insets.top + TOP_ROW, backgroundColor: theme.background },
            pressed && styles.pressed,
          ]}
        >
          {/* THE ARROW ALONE (Ruth, 25 September 2026): "Remove the titles on
              the back buttons on all screens for going back to log screen home
              page, they dont make any sense. Arrow is sufficient and could be
              more beautiful." And on the title beside it: "the title is for
              that page, a smaller section of Measurements, the arrow is to go
              back, not to go back to Measurements as we're still there." */}
          <Ionicons name="chevron-back" size={ARROW_SIZE} color={theme.text} />
        </Pressable>
      ) : null}

      <SettingsLink />
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
  back: {
    position: 'absolute',
    // The page margin, the same one the mark uses on the other side and every
    // heading below uses on this one.
    left: PageInset.horizontal,
    zIndex: 10,
    elevation: 10,
    // A PAGE-COLOURED DISC BEHIND IT (Ruth, 26 September 2026, item 10: "the
    // back arrow sits on top of the calf icon when scrolled. Keep the back
    // arrow clear of content").
    //
    // The arrow is pinned and the page scrolls beneath it, which is correct -
    // it must stay reachable. But a bare glyph over moving content reads as two
    // drawings on top of each other, and a measurement mark passing behind a
    // chevron is exactly the collision she saw. zIndex was already winning;
    // winning was never the problem, having nothing behind it was.
    //
    // The seeds mark on the other side of the same row has solved this since
    // the 25th, with a disc a little larger than the glyph so the ground reads
    // as deliberate rather than as a square of background gone wrong. Same
    // treatment, same reasoning, same row - see settings-link.tsx.
    width: ARROW_SIZE + 12,
    height: ARROW_SIZE + 12,
    borderRadius: (ARROW_SIZE + 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Centred on where the bare arrow used to sit, so nothing moved.
    marginLeft: -6,
    marginTop: -6,
  },
  pressed: { opacity: 0.6 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: PageInset.horizontal,
    paddingBottom: PageInset.bottom,
    gap: Spacing.three,
  },
});
