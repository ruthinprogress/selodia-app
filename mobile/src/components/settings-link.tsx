import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThreeSeedsMark } from '@/components/seed-marks';
import { SpotlightTarget } from '@/components/spotlight-target';
import { PageInset, Spacing } from '@/constants/theme';

// THE "MORE" MARK - three seeds, top right, on every screen.
//
// SETTINGS FROM EVERY SCREEN (Ruth's bug list, item 13, 18 September: "Settings
// is only reachable from Chat. It needs to be reachable from every screen").
//
// IT IS A MARK, NOT A WORD (Ruth, 24 September 2026). Three attempts had gone
// into stopping "Settings" losing its s in the corner. She looked at them and
// said the problem was upstream: "I think the problem we were trying to solve
// was confused by calling the page 'Settings'. It's actually not, it holds more
// than that ... Really this page is 'more' which is exactly those lovely 3
// seeds." A mark also cannot wrap onto a hidden second line, which ends the
// clipping by removing its subject rather than patching it again.
//
// ONE POSITION, MEASURED FROM THE SCREEN (Ruth, 25 September 2026: "The
// three-seeds More icon is not appearing in the same position on all screens.
// This is breaking visual consistency and making the app feel incoherent" -
// and then, exactly: "must sit at the same fixed vertical position on every
// screen, flush top right, not relative to the page heading").
//
// WHAT IT WAS BEFORE. Four implementations at four offsets from the right edge
// of the screen, and three different heights:
//
//   Today, Plans, Almanac, Log list   64 across - an absolute link asking for
//                                     the page margin INSIDE a container that
//                                     already had it, so twice the margin
//                                     every heading on those screens uses
//   Chat                              48 across - its own private copy, laid
//                                     out in the page rather than positioned
//   Food & Drink                      about 16 across, in the stack header
//   six other Log screens             64 across AND below the header, floating
//                                     in the gap above the content
//
// Every one of those was reasonable where it was written. None of them could
// see the others, and the one written last - the header version - carried a
// comment describing exactly what the other six were doing wrong.
//
// HOW THIS ONE CANNOT DRIFT. No screen can tell it where to go. It takes one
// prop and that prop is not a position: `spotlight`, which only says whether
// the guided tour is allowed to point at this copy. Everything about WHERE it
// sits is decided here - it reads the safe-area inset itself and positions
// against the SCREEN - so the only thing a screen can get wrong is where it
// renders it: OUTSIDE the SafeAreaView and outside the scroller. Nothing here
// is relative to a heading, a header, a title or a scroll offset, which is what
// she asked for: the same two numbers on all of them.
//
// IT DOES NOT SCROLL AWAY. The earlier version sat inside the scroll content
// deliberately, so it travelled with the page. "Fixed vertical position" ends
// that argument: it stays in the corner while the page moves under it.

/** How far below the status bar the mark sits. The only vertical number. */
const TOP_GAP = Spacing.two;

/** One size everywhere. */
const MARK_SIZE = 22;

export function SettingsLink({ spotlight = false }: { spotlight?: boolean }) {
  const insets = useSafeAreaInsets();

  const button = (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="More"
      // Generous, because the mark is small and quiet on purpose and a quiet
      // control still has to be hittable with a thumb.
      hitSlop={Spacing.three}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThreeSeedsMark size={MARK_SIZE} />
    </Pressable>
  );

  // THE POSITION LIVES ON THE OUTER VIEW, NOT ON THE BUTTON. A SpotlightTarget
  // wraps its child in a View of its own, laid out in normal flow - so an
  // absolutely positioned button inside one would measure against THAT view
  // rather than the screen, and land wherever the flow put it. Chat is the one
  // screen that needs the target (see below), and a control whose position
  // depends on whether it happens to be highlightable is exactly the class of
  // bug this file was rewritten to end.
  return (
    <View style={[styles.mark, { top: insets.top + TOP_GAP }]}>
      {spotlight ? (
        // THE ONE POINTABLE CROSS-SCREEN STEP (build item 23): "where do I get
        // my data" pulses this, the tap opens Settings, and the export
        // highlights on arrival. Every other cross-screen route in the app runs
        // through a tab icon, which cannot be pointed at.
        <SpotlightTarget id="chat.settings" onActivate={() => router.push('/settings')}>
          {button}
        </SpotlightTarget>
      ) : (
        button
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    // The page margin, once, measured from the screen's right edge - which is
    // what lines it up with every heading and card edge on every screen.
    right: PageInset.horizontal,
    // Above the content it sits over, including a scroller.
    zIndex: 10,
    elevation: 10,
  },
  pressed: { opacity: 0.6 },
});
