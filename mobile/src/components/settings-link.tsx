import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PageInset, Spacing } from '@/constants/theme';

// SETTINGS FROM EVERY SCREEN (Ruth's bug list, item 13, 18 September: "Settings
// is only reachable from Chat. It needs to be reachable from every screen").
//
// The same quiet word Chat has always had, and deliberately nothing louder: a
// gear icon on every page would be a control advertising itself above content
// that matters more. It is a way out, not a feature.
//
// IT SITS IN THE PAGE'S TOP MARGIN, NOT ABOVE THE HEADING. Placed in the normal
// flow it would push every screen's name down by a line - including the Today
// greeting, which was moved 10px UP at her request two days earlier. So it is
// drawn absolutely, inside the 32pt of top padding every page already has, and
// aligned to the right edge of the text column. The heading does not move by a
// single point.
//
// It must be a child of a screen's scroll CONTENT container: that is what it is
// positioned against, and why it scrolls away with the page rather than
// floating over the content as it is read.
//
// EXCEPT ON TODAY, which is why there is an inline form. The Today greeting is
// two lines at 50pt, and "Good afternoon," is long enough to run under a
// top-right corner on a phone. So there the link sits at the end of the date
// line beneath it - a short line with room to spare - and it is the same word
// in the same colour, so it still reads as the same thing it is everywhere else.

// UNDER THE STATUS BAR, ON SOME SCREENS. The Log screens let their content run
// up behind the phone's status bar - only their top padding keeps the heading
// clear of it - so a corner link at the top of that padding would sit among the
// battery and signal icons. Those screens pass the status bar's height and the
// link drops by exactly that much.
export function SettingsLink({
  placement = 'corner',
  topInset = 0,
}: {
  placement?: 'corner' | 'inline';
  topInset?: number;
}) {
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="Account settings"
      hitSlop={Spacing.two}
      style={({ pressed }) => [
        placement === 'corner' && [styles.link, { top: styles.link.top + topInset }],
        pressed && styles.pressed,
      ]}
    >
      {/* "Setting" on her phone (2026-09-19), and not clipped: the s was WRAPPED
          onto a hidden second line, the same way "Measurement / s" wrapped in
          the Log tabs. Android gave the word a box sized to a narrower
          measurement than it drew. Two points of padding did not fix it. A box
          comfortably wider than the word ever needs, right-aligned so it still
          sits in the corner, leaves Android nothing to wrap - including at a
          larger phone font size. The Chat screen's own link has the same fix. */}
      {/* THE INLINE ONE IS A LINK, THE CORNER ONE IS A CORNER (Ruth, 21
          September 2026: "Today has no Settings menu"). It was there all along,
          at the end of the date line - in the same muted grey as the date, so
          it read as more date rather than as a way out, and she looked for it
          and did not find it.
          In the corner, a single lone word is obviously a control because
          nothing else is up there. Sitting at the end of a sentence it needs
          the colour the rest of the app gives a text link, or it is camouflage. */}
      {/* THE THIRD TIME THIS WORD HAS LOST ITS S (Ruth, 23 September 2026,
          screenshot of Today reading "Setting"). The 19 September fix above is
          real and works - and it is on `cornerLabel`, which is applied only to
          the CORNER placement. Today uses the inline one, which had no width
          protection at all, so the fix never reached the screen that kept
          reporting the fault.

          numberOfLines={1} is the part that cannot be got wrong by placement:
          with no second line to wrap onto, Android has nowhere to put the s. */}
      <ThemedText
        type="small"
        themeColor={placement === 'corner' ? 'textSecondary' : 'link'}
        style={placement === 'corner' ? styles.cornerLabel : styles.inlineLabel}
        textBreakStrategy="simple"
        numberOfLines={1}
      >
        Settings
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    position: 'absolute',
    // Inside the page's top padding (PageInset.top is 32), clear of the heading
    // that starts where that padding ends.
    top: Spacing.one,
    right: PageInset.horizontal,
    zIndex: 1,
  },
  // Corner only: inline, on Today's date line, a wide box would squeeze the date.
  cornerLabel: { minWidth: 96, textAlign: 'right' },
  // Inline sits at the end of a sentence, so it cannot have a generous minimum
  // width without pushing the date around. It gets the other half instead:
  // never shrink, and never wrap. The date can reflow; the control cannot.
  inlineLabel: { flexShrink: 0 },
  pressed: { opacity: 0.6 },
});
