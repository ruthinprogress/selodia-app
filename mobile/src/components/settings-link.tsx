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
      <ThemedText type="small" themeColor="textSecondary">
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
  pressed: { opacity: 0.6 },
});
