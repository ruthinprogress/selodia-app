import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// ONE SWITCH, USED BY EVERY TAB THAT HAS VIEWS INSIDE IT (2026-09-17).
//
// THE SELECTED SHAPE IS DRAWN ONCE AND ONLY EVER MOVES (Ruth, 26 September
// 2026, after three failed attempts at the corner radius).
//
// WHAT WAS ACTUALLY WRONG, and it was never the radius. The selected segment
// used to be one of N views, each taking a background colour only while it was
// the chosen one. On Android that means the view has NO background until it is
// picked, and the background drawable is therefore built at the moment of
// selection - without the corner radius sitting in the stylesheet. Her words
// found it: "Pill is fine until I select it and it reverts back to square."
//
// That is why 18 was square, 999 was square, and everything between would have
// been square: the number was never reaching the drawable. I changed it twice
// and told her it was fixed twice, having checked only the web preview, which
// renders these styles as CSS and rounds them perfectly. A third attempt set
// the unselected colour to 'transparent', which Android treats as no background
// at all, so the drawable was still built fresh on selection. Right diagnosis,
// undone by the implementation.
//
// THE PROOF THAT IT IS THE DRAWABLE: the bottom navigation bar has a flawless
// pill behind the selected tab on her phone. It is drawn by ANDROID, not by us -
// NativeTabs with an indicatorColor, a real Material navigation bar - so it
// never goes through this code path. There was no working React Native pill in
// the app to copy.
//
// SO THERE IS NOW EXACTLY ONE selected shape rather than one per tab. It is
// created with a real colour and a real radius the first time the track is
// measured, and after that it only ever TRANSLATES. Its colour never changes,
// so the drawable is never rebuilt, so the corners cannot be lost. ChatGPT
// suggested a sliding capsule for aesthetic reasons on the same day and was
// right for the wrong reason; this is the structural fix, and the slide is a
// bonus.
//
// The rule to carry: on Android, a background that arrives with a state change
// and a border radius do not reliably arrive together. Draw the shape once.
//
// -- Everything below is the earlier history of this control, which is still
// -- true and still worth keeping. Five rebuilds of the LABELS live here.
//
//   - THE LABELS USED TO DECIDE THE WIDTH, and that was right while the control
//     was only as wide as its words. REVERSED 2026-09-18: "the three tabs don't
//     feel equally weighted - Insight and Me have lots of spare room, Movement
//     is right on the limit... I'd make that segmented control about 340-360px
//     wide with generous horizontal padding." A control that spans the screen
//     has room for its longest label in a third of itself, so equal parts are
//     safe AND are what makes it read as one designed object.
//   - THE TRACK DOES NOT CLIP. overflow:'hidden' is what turned an overhang into
//     a chopped word: "Insights" drew as "Insigh", "Me" as "M".
//   - NO numberOfLines ALONE. Android replaces the WHOLE word with an ellipsis
//     when it measures text wider than its box, which is why the shortest label
//     failed hardest - there is nothing to trim, so everything goes.
//   - PADDING ON THE TEXT WAS THE WRONG FIX. Padding on a Text insets its
//     CONTENT box, so the glyphs were given less room, not more, and "Movement"
//     still drew as "Movemen". Width is the only real fix.
//
// The height is unchanged on purpose - "I actually quite like the height now.
// I wouldn't make it taller. Just wider."

export type SegmentedTabItem<T extends string> = { id: T; label: string };

/** The inset between the track's edge and the selected shape, on all four sides. */
const INSET = 3;

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly SegmentedTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  // The track's own width, measured rather than assumed, because the caller
  // decides how wide this is and it changes with the screen.
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useSharedValue(0);

  const count = Math.max(items.length, 1);
  const segmentWidth = trackWidth > 0 ? (trackWidth - INSET * 2) / count : 0;
  const index = Math.max(
    items.findIndex((i) => i.id === value),
    0
  );

  const onTrackLayout = useCallback(
    (w: number) => {
      setTrackWidth(w);
      // Placed, not animated, on the first measurement: a capsule that slides in
      // from the left on every mount would be an entrance animation nobody asked
      // for. It only animates once it already has a position.
      const seg = (w - INSET * 2) / count;
      if (trackWidth === 0) x.set(index * seg);
    },
    [count, index, trackWidth, x]
  );

  // Moves on selection, in an effect rather than during render: writing a
  // shared value while rendering is a side effect, and Reanimated says so.
  useEffect(() => {
    if (segmentWidth > 0) x.set(withTiming(index * segmentWidth, { duration: 180 }));
  }, [index, segmentWidth, x]);

  const sliding = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}
      onLayout={(e) => onTrackLayout(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {/* ONE SHAPE. Rendered only once the track has been measured, so it is
          born with a real width, a real colour and a real radius, and never
          has any of them applied to it later. */}
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.selected,
            { width: segmentWidth, backgroundColor: theme.background },
            sliding,
          ]}
        />
      ) : null}

      {items.map((item) => {
        const selected = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            {/* SHRINK RATHER THAN CUT (2026-09-19). "Activit" and "Measurement
                / s" came back on her phone: a third of the track is about 100
                points, less the padding, and a phone set to a larger font size
                needs more than that for "Measurements". So the label may scale
                down to fit - never below three quarters - and system font
                scaling is capped here, as it is in most apps' tab controls,
                because a label that wraps or loses letters is less readable
                than a slightly smaller one.

                SELECTION IS SAID IN TEXT COLOUR, which is safe: a colour on
                glyphs is not a background drawable and has none of the trouble
                above. One face in both states, since asking Android to draw a
                custom face it measured in the system one is what produced
                "Movemen". */}
            <ThemedText
              type="small"
              themeColor={selected ? 'text' : 'textSecondary'}
              style={styles.label}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              maxFontSizeMultiplier={1.3}
              textBreakStrategy="simple"
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: INSET,
    // FULL WIDTH OF WHAT IT IS GIVEN, and its callers give it the screen less a
    // small margin rather than the text column - about 88% of the screen, which
    // is the width Ruth asked for.
    width: '100%',
  },
  // The one selected shape, behind the labels. Absolute so that moving it moves
  // nothing else, and inset evenly on all four sides so it reads as sitting
  // INSIDE the track rather than floating on it.
  selected: {
    position: 'absolute',
    left: INSET,
    top: INSET,
    bottom: INSET,
    borderRadius: 999,
  },
  // EQUAL PARTS. Not because it is tidy, but because unequal segments make the
  // longest word look cramped while the shortest floats in space.
  tab: {
    flex: 1,
    paddingVertical: 8,
    // Small on purpose. At 12 either side there was about 100 points a third,
    // 76 left for the word, and "Measurements" needs about 88.
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    // A control's label, not body text.
    fontSize: 13,
    // Never squeezed by the layout: the tab supplies the width, and the word
    // keeps whatever it needs of it.
    flexShrink: 0,
  },
  pressed: { opacity: 0.7 },
});
