import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { AlmanacTab } from '@/lib/insights';

// The Almanac's three views: Insights, Movement and Me (build spec, Part Ten, the
// Almanac redesign of 2026-09-12).
//
// A switch across the top of the one Almanac screen, NOT three more bottom tabs.
// Part Five keeps the app to three destinations, and these are three views of
// one of them, not three new places to go.
//
// Light by design: a sand track with the chosen view lifted onto cream. The
// brand is light, and charcoal is only ever text (Part Fifteen).

const TABS: { id: AlmanacTab; label: string }[] = [
  { id: 'insights', label: 'Insights' },
  { id: 'movement', label: 'Movement' },
  { id: 'me', label: 'Me' },
];

export function AlmanacTabs({
  value,
  onChange,
}: {
  value: AlmanacTab;
  onChange: (tab: AlmanacTab) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="tablist"
    >
      {TABS.map((t) => {
        const selected = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t.label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.segment, selected && { backgroundColor: theme.background }]}>
              {/* ONE TYPE FOR BOTH STATES, only the colour changes. Found on
                  device 2026-09-12: switching the chosen label from the system
                  face to Comfortaa made Android keep the narrower measurement,
                  so "Insights" drew as "Insigh". Selection is shown by the
                  cream segment and the darker text, never by a font change. */}
              {/* NO TRUNCATION, AT ALL (2026-09-16). Ruth reported the Me tab
                  "just shows as three dots", twice. numberOfLines={1} was doing
                  that: when Android measures this text wider than the space it
                  is given - which it does here, measuring in the system face
                  while drawing in Comfortaa, the same mismatch that drew
                  "Insights" as "Insigh" on 12 September - it replaces the whole
                  label with an ellipsis. On a two-letter word that is absurd,
                  and it is why the shortest label failed hardest: there is
                  nothing to trim, so everything goes.

                  A label is never worth truncating here. There are three of
                  them, all short, and the longest is "Movement". Letting the
                  text keep its own width and refuse to shrink means a wrong
                  measurement costs a few pixels of padding rather than the
                  word itself. */}
              {/* AND THE TYPE STAYS (2026-09-16, second attempt). Dropping
                  `type` in the fix above sent the label to the default style -
                  Comfortaa regular at 16px rather than 14 - which is wider
                  still, so "Me" then clipped to "M". The type is what keeps it
                  at 14px, and the segment below now has room either side. */}
              {/* AND STILL "Insight", "Moveme", "M" (2026-09-16, third look, from
                  her debugging screenshots). Removing the truncation was not
                  enough because the truncation was never the only cutter: the
                  TRACK clips. It sets overflow:'hidden' to keep the chosen
                  segment's corners inside its own radius, and a label pinned at
                  flexShrink:0 in a segment with no side padding overflows into
                  exactly that clip. Android measuring in the system face and
                  drawing in Comfortaa is what makes it overflow; overflow:hidden
                  is what makes the overflow a chopped word.
                  So: room either side, and permission to shrink. Wrapping to a
                  second line would now be the worst case, and a wrapped word is
                  still a word. */}
              <ThemedText
                type="smallBold"
                style={[styles.label, { color: selected ? theme.text : theme.textSecondary }]}
              >
                {t.label}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// EXACT RADII, half of each height, rather than 999. Found on device 2026-09-12:
// the chosen segment drew with square corners that poked outside the rounded
// track. A segment is 36 tall (8 + 20 + 8), so 18; the track adds 3 each side, so
// 21. And the track clips, so nothing inside it can ever show past its edge.
const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 21,
    padding: 3,
    gap: 2,
    // SIZED BY ITS CONTENT, AND CENTRED (fifth attempt, 2026-09-16).
    //
    // The four before this all treated the cut-off words as a text problem -
    // drop numberOfLines, restore the type, add padding, remove the clip - and
    // all four failed, because the row was never the right width to begin with.
    // Her fifth screenshot shows it plainly: the chosen segment hangs off the
    // right-hand end of the track. Three tabs at flex:1 were being asked to
    // divide a fixed width into thirds, and Yoga will not shrink a text node
    // below its own min-content, so the thirds overflowed and the overhang got
    // cut wherever a rounded background ended.
    //
    // So the direction of the constraint is reversed. The labels decide how wide
    // their segments are, the segments decide how wide the track is, and the
    // track centres itself in whatever room the screen has. A label cannot be
    // wider than a segment that is defined as "this label plus its padding" -
    // not because the measurement is right, but because no measurement can make
    // it wrong.
    alignSelf: 'center',
    // NO CLIP (2026-09-16, fourth attempt - "on the M shows"). Padding and
    // flexShrink were not enough because this line is the thing doing the
    // cutting: Android measures the label in the system face and draws it in
    // Comfortaa, so the drawn word is wider than the box it was given, and
    // overflow:'hidden' turned that overhang into a chopped word. It was
    // belt-and-braces to begin with - the exact radii above are what stopped the
    // chosen segment poking out, and they still do. A word that overhangs its
    // segment by a pixel is invisible; a word cut to "M" is not.
  },
  // NO flex: 1. That was the whole fault - see the track above.
  tab: { flexShrink: 0 },
  label: {
    textAlign: 'center',
  },
  segment: {
    paddingVertical: 8,
    // Generous now that padding is what sets the segment's width rather than
    // what is left over inside a third of the screen. Three labels at this
    // padding come to well under the width of a phone, so the track still reads
    // as one pill rather than a strip that fills the screen edge to edge.
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
