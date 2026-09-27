import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
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
  // Enough for the first frame, replaced by the real figure on layout. Too
  // small would flash the content under the header; too large would drop it.
  const [headerHeight, setHeaderHeight] = useState(insets.top + TOP_ROW + ARROW_SIZE + 44);

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
            // MEASURED, NOT CALCULATED (Ruth, 27 September 2026, item 7: "the
            // page title scrolls under the status bar... give the input row its
            // own space below the header").
            //
            // This used to be a sum - status bar plus arrow plus margin - which
            // was right about everything except that the TITLE was inside the
            // scroller. So it scrolled, and on a screen whose first element is
            // a control (the Food log's + row) the control arrived under the
            // back arrow. The header is pinned now, and the padding is whatever
            // it actually measures, because a sum cannot know how tall a page
            // title is at her font size and she asked for this checked at a
            // large one.
            { paddingTop: headerHeight + PageInset.top },
          ]}
        >
          <SpotlightScroll scrollRef={scrollRef}>{children}</SpotlightScroll>
        </ScrollView>
      </SafeAreaView>

      {/* THE HEADER, OVER THE PAGE RATHER THAN IN IT. Opaque, so content
          passing beneath it disappears instead of showing through the status
          bar. It holds the arrow and the name; the seeds mark is pinned
          separately and draws last, which keeps it in the same place on every
          screen in the app. */}
      <View
        onLayout={(e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[styles.header, { paddingTop: insets.top + TOP_ROW, backgroundColor: theme.background }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow} pointerEvents="box-none">
          {canGoBack ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={Spacing.three}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              {/* THE ARROW ALONE (Ruth, 25 September 2026): "Remove the titles
                  on the back buttons on all screens for going back to log
                  screen home page, they dont make any sense. Arrow is
                  sufficient and could be more beautiful." */}
              <Ionicons name="chevron-back" size={ARROW_SIZE} color={theme.text} />
            </Pressable>
          ) : (
            <View style={{ height: ARROW_SIZE }} />
          )}
        </View>
        {title ? (
          <ThemedText type="pageTitle" style={styles.title}>
            {title}
          </ThemedText>
        ) : null}
      </View>

      {/* BOTH OUTSIDE THE SCROLLER, so they stay in the corner while the page
          moves under them. */}
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    paddingHorizontal: PageInset.horizontal,
    // The page's own column, so a title lines up with the content beneath it
    // on a wide screen exactly as it did when it was inside the scroller.
    alignItems: 'stretch',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: ARROW_SIZE },
  // THE DISC IS GONE WITH THE FLOAT. It existed because the arrow hung over
  // moving content and a measurement mark could pass behind it; the header is
  // opaque now, so there is nothing behind it to show through.
  back: { marginLeft: -4 },
  title: { paddingTop: Spacing.one },
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
