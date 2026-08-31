import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The Almanac's empty state (build item 15, UI slice 1 — UNFLUMP_SPEC.md, Part
// Ten). Until this existed the Almanac tab rendered a title and nothing else:
// one of three destinations was a dead end, and a live exception to principle 8.
//
// The copy is verbatim from the spec and does a specific job — it frames WHY
// the page is empty and WHEN it fills, so emptiness reads as "not yet" rather
// than "broken" or "you haven't done enough". "Worth remembering" is load-
// bearing: it ties to the Result / Observation / Insight distinction, where only
// a genuine insight, saved deliberately, ever lands here.

export const ALMANAC_EMPTY_HEADING = 'Nothing here yet';
export const ALMANAC_EMPTY_BODY =
  "We'll build this together — the first entries appear once a pattern's worth remembering, and you've said yes to saving it.";

// THE SAGE LINE-ILLUSTRATION (built 2026-08-31, unblocked by item 37).
//
// A single shoot: one stem, one open leaf, one still folded. It is the Seed Mark
// one step later — the brand's seed, having started. That is the whole idea, and
// it is why this is not generic empty-state decoration: the page is empty
// because nothing has grown here YET, and the drawing says exactly that.
//
// The upper leaf sits at reduced opacity. What exists is drawn solid; what is
// still coming is faint. That mirrors the copy beneath it rather than repeating
// it, and it is the reason there are two leaves and not one.
//
// DRAWN IN PLAIN VIEWS, deliberately. react-native-svg is not a dependency of
// this project and adding it would pull in another NATIVE module — meaning
// another native build, on top of the one already pending for
// expo-notifications. A shoot is simple enough to build from rounded rectangles,
// so the illustration ships over EAS Update like any other JS change. If this
// file ever needs a genuinely curved line, that is the moment to weigh the
// dependency, not now.
//
// Rejected on the way: concentric rings. They read as a target, and a target is
// scoring — the exact register an app built against gamification should not open
// its reference page with.
function Shoot() {
  const theme = useTheme();

  return (
    <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The second leaf, still to come. Smaller, mirrored, and quieter. */}
      <View style={[styles.leaf, styles.leafFolded, { borderColor: theme.sage }]} />
      {/* The leaf that has arrived. */}
      <View style={[styles.leaf, styles.leafOpen, { borderColor: theme.sage }]} />
      {/* Stem. Thin enough to read as a drawn line rather than a bar, and it
          stops just above the upper leaf — an overshooting stem reads as a pole
          with flags on it rather than as something growing. */}
      <View style={[styles.stem, { backgroundColor: theme.sage }]} />
    </View>
  );
}

export function AlmanacEmptyState() {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Shoot />

      <ThemedText type="smallBold" style={styles.heading}>
        {ALMANAC_EMPTY_HEADING}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {ALMANAC_EMPTY_BODY}
      </ThemedText>
    </View>
  );
}

// The stem stops just above the upper leaf's attachment (bottom 22 + 15 = 37).
const STEM_HEIGHT = 38;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },

  // A fixed box so the drawing never reflows the copy beneath it, and generous
  // enough that the shoot sits in space rather than filling a slot.
  art: {
    width: 72,
    height: STEM_HEIGHT + Spacing.four,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.three,
  },
  stem: {
    width: 1.6,
    height: STEM_HEIGHT,
    borderRadius: 1,
  },

  // Leaves are outlines, not fills — the spec asks for a LINE illustration, and
  // a filled leaf at this size reads as a solid blob.
  //
  // THE SHAPE MUST BE SQUARE. A leaf is a square with two opposite corners at
  // FULL radius and the other two left sharp: the sharp corners become the base
  // and the tip, and the two curves become the edges. On a non-square box the
  // radius is clamped to half the short side, the curves flatten out, and what
  // you get is a rounded flag — which is exactly what the first attempt drew.
  // If either width or height changes here, the radius must change with it.
  leaf: {
    position: 'absolute',
    borderWidth: 1.6,
  },
  // Sharp at bottom-left (where it meets the stem) and top-right (the tip), so
  // it grows up and to the right. No rotation needed — the shape already points.
  leafOpen: {
    width: 20,
    height: 20,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    left: 36,
    bottom: 8,
  },
  // Mirrored, higher up the stem, and dimmer: what exists is drawn solid, what
  // is still coming is faint. That is the empty state's own sentence, drawn.
  leafFolded: {
    width: 15,
    height: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 15,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
    right: 36,
    bottom: 22,
    opacity: 0.55,
  },

  heading: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
});
