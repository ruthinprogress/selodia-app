import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// ONE SWITCH, USED BY EVERY TAB THAT HAS VIEWS INSIDE IT (2026-09-17).
//
// The Almanac's three views and the Log's three views are the same control, and
// it had already been rebuilt five times on the Almanac alone. Two copies would
// be two places for the sixth attempt to miss, so there is one, and this is what
// every one of those attempts taught:
//
//   - THE LABELS USED TO DECIDE THE WIDTH, and that was right while the control
//     was only as wide as its words: tabs at flex:1 divide a fixed width into
//     equal parts, and a text node will not shrink below its own min-content, so
//     the parts overflowed. REVERSED 2026-09-18, because the premise changed.
//     Ruth: "the three tabs don't feel equally weighted - Insight and Me have
//     lots of spare room, Movement is right on the limit... I'd make that
//     segmented control about 340-360px wide with generous horizontal padding."
//     A control that spans the screen has room for its longest label in a third
//     of itself, so equal thirds are now safe AND are what makes it read as one
//     designed object rather than three words in a row.
//   - THE TRACK DOES NOT CLIP. overflow:'hidden' is what turned an overhang into
//     a chopped word: "Insights" drew as "Insigh", "Me" as "M".
//   - NO numberOfLines. Android replaces the WHOLE word with an ellipsis when it
//     measures text wider than its box, which is why the shortest label failed
//     hardest - there is nothing to trim, so everything goes.
//   - ONE FACE, MEASURED AND DRAWN. Android measures in the system face; asking
//     it to draw Comfortaa makes the drawn word wider than the box it was given.
//     So the label stays on the system face in both states, and selection is
//     said with the cream segment and the darker text, never with a font change.
//   - AND PADDING ON THE TEXT WAS THE WRONG FIX FOR IT. The guarantee above
//     broke on its own when the typography pass moved every body style to
//     Manrope, putting a custom face back into this control; the attempted fix
//     was six points of padding inside the text box, and it made the truncation
//     WORSE. Padding on a Text insets its CONTENT box, so the glyphs were given
//     less room, not more, and "Movement" still drew as "Movemen". Width is the
//     only real fix: give the segment more room than its word needs and there is
//     nothing to clip, whichever face does the measuring.
//
// THE RADII ARE NOW FULLY ROUND, AND THE OLD REASONING IS WHY (Ruth, 25
// September 2026, item 3: "the selected segment is a hard-cornered rectangle
// that overruns and clips the track's rounded ends").
//
// They used to be exact numbers, with this argument: a segment is 36 tall
// (8 + 20 + 8) so 18, the track adds 3 either side so 21, and a rounded
// segment inside a rounded track needs the two to agree because nothing clips
// them into place. All of that is correct - AT ONE TEXT SIZE. The moment the
// control is taller than 42, which the font scaling allowed for up to 1.3,
// 21 stops being half the track's height and 18 stops being half the
// segment's. The track keeps ends that are nearly round while the segment
// becomes a rounded RECTANGLE inside it, which is exactly what she described
// and exactly what would never appear on a machine set to the default size.
//
// 999 on both makes each one a pill at whatever height it happens to be, so
// they agree by construction rather than by arithmetic that was true once.
// The inset still does the rest: a pill inset evenly inside a pill is
// concentric at any size.
//
// The height is unchanged on purpose - "I actually quite like the height now.
// I wouldn't make it taller. Just wider." 

export type SegmentedTabItem<T extends string> = { id: T; label: string };

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

  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="tablist"
    >
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
            <View style={[styles.segment, selected && { backgroundColor: theme.background }]}>
              {/* SHRINK RATHER THAN CUT (2026-09-19). "Activit" and "Measurement
                  / s" came back on her phone: a third of the track is about 100
                  points, less the segment padding, and a phone set to a larger
                  font size needs more than that for "Measurements". So the
                  label may scale down to fit its segment - never below three
                  quarters - and system font scaling is capped here, as it is in
                  most apps' tab controls, because a label that wraps or loses
                  letters is less readable than a slightly smaller one. */}
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
            </View>
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
    padding: 3,
    gap: 2,
    // FULL WIDTH OF WHAT IT IS GIVEN, and its callers give it the screen less a
    // small margin rather than the text column - see where it is used. About
    // 88% of the screen, which is the width Ruth asked for.
    width: '100%',
  },
  // EQUAL THIRDS. Not because thirds are tidy, but because unequal segments make
  // the longest word look cramped while the shortest floats in space, which is
  // exactly what she saw.
  tab: { flex: 1 },
  segment: {
    borderRadius: 999,
    paddingVertical: 8,
    // Small on purpose. At 12 either side the claim below ("room to spare")
    // was false: about 100 points a third, 76 left for the word, and
    // "Measurements" needs about 88 at the default font size.
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    // A control's label, not body text - and a size the longest label in the app
    // ("Measurements") clears inside a third of the track with room to spare.
    fontSize: 13,
    // Never squeezed by the layout: the segment supplies the width, and the word
    // keeps whatever it needs of it.
    flexShrink: 0,
  },
  pressed: { opacity: 0.7 },
});
