import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BodyFont, Spacing } from '@/constants/theme';

// HOW A SECTION INTRODUCES ITSELF (Ruth, 2026-09-18).
//
// Her diagnosis, and it was right: "at the moment it's just two body text lines
// sitting under the segmented control. It doesn't feel intentional... it's not
// the wording that's missing, it's the typography hierarchy."
//
// THE LADDER THIS COMPLETES. A page names itself in the serif at 50; a section
// names itself here; the cards carry the content. Between the page title and the
// cards there was nothing but body text doing a heading's job, which is why the
// Movement tab read as a label followed by a list rather than as a collection
// with an introduction.
//
// WHY THE HEADLINE IS SANS AND NOT THE SERIF. Because it is set semibold, and
// semibold is a weight the serif does not have here - Cormorant Infant ships in
// this app as Regular only, on purpose (see DisplayFont). A magazine does the
// same thing for the same reason: the masthead is the serif, the section deck is
// a heavier sans, and the contrast between them IS the hierarchy. If this should
// be the serif instead, it is one line in this file and every screen follows.
//
// ONE COMPONENT, EVERYWHERE. "Use this same component anywhere Selodia
// introduces a collection, timeline or section so the visual language stays
// consistent." Two screens writing their own version of this is how the app ends
// up with two of everything, which is the same reasoning that produced one tab
// strip after six rebuilds.
//
// THE SUPPORTING LINE IS NOT CLAMPED. The brief says at most two lines, and that
// is a rule for whoever writes the words - not a numberOfLines, which on Android
// replaces the whole line with an ellipsis rather than trimming it, and which
// this app has already been bitten by twice.

export function SectionIntro({
  title,
  children,
  style,
}: {
  title: string;
  /** The supporting line. Two lines at most - a rule for the writing, not a clamp. */
  children?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <ThemedText style={styles.headline}>{title}</ThemedText>
      {children ? (
        <ThemedText themeColor="textSecondary" style={styles.supporting}>
          {children}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The space above and below belongs to the block, not to the screens that use
  // it: an introduction that needs a margin adding at every call site is two
  // text labels again with extra steps.
  wrap: {
    gap: 7,
    marginTop: Spacing.four,
    marginBottom: 22,
  },
  headline: {
    fontFamily: BodyFont.semibold,
    fontSize: 23,
    // Tight, because a two-word heading that breaks should still read as one
    // object rather than as two stacked lines.
    lineHeight: 28,
  },
  supporting: {
    fontFamily: BodyFont.regular,
    fontSize: 15,
    lineHeight: 22,
  },
});
