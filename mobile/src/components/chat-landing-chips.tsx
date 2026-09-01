import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CHAT_CHIPS } from '@/lib/chat-chips';

// The four openers above the message box, shown once (see lib/chat-chips.ts for
// what they are for and why these four).
//
// SAME CHIP SHAPE AS THE REST OF THE APP: Pressable wrapping a ThemedView with
// Spacing.one vertical, Spacing.three horizontal and a Spacing.three radius,
// wrapping in a row with Spacing.one gaps. Identical to the hydration quick-tap
// and the health-context condition chips, so this reads as the same kind of
// object rather than a new one to interpret.
//
// backgroundElement, NOT backgroundSelected, which is the one deliberate
// difference from the hydration chips. Those sit inside a card and need to lift
// off it; these sit on the bare Chat background, where the card colour already
// reads as a distinct tappable surface. More to the point, `selected` is a state
// none of these are in - nothing here has been chosen yet, and four pre-selected
// chips would look like settings someone had already agreed to.
//
// AN INVITATION, NOT A FORM. No heading, no "pick one", no border around the
// group, and nothing marks them required or exhaustive - they simply sit there.
// The absence of a prompt above them is the design: a label saying "Try one of
// these" would turn an offer into an instruction, which is exactly the
// difference Part Two, principle 4 keeps asking for.

export function ChatLandingChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={styles.wrap}>
      {CHAT_CHIPS.map((label) => (
        <Pressable
          key={label}
          onPress={() => onPick(label)}
          accessibilityRole="button"
          // The chip's own words are the message that gets sent, so the label is
          // already the whole story - no "tap to..." wrapper needed.
          accessibilityLabel={label}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.chip}>
            <ThemedText type="small">{label}</ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    // Matches the input row's horizontal padding and width cap so the chips line
    // up with the message box beneath them rather than floating free of it.
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: { opacity: 0.6 },
});
