import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// SCREEN 7 OF HER ARTWORK: "Today's log saved", and a way to look at it.
//
// What this replaced was one grey line under the form reading "Saved for Monday
// 24 August" - true, easy to miss, and leaving her on the form she had just
// finished with. Her drawing stops and says so, then offers the record.
//
// AND IT SAYS WHERE ELSE SHE CAN GO. "Or add more details in chat" is in her
// drawing and it is the better half of this screen: the form holds what the app
// knows how to ask for, and chat holds everything else about the day. A form
// that ends by pointing at the form is a dead end.
//
// NOTHING SAVED IS NOT A FAILURE. Emptying a day deletes its record, which is a
// real thing to want - so that outcome gets its own words rather than a tick
// over a sentence that would be a lie.

export function CycleDaySaved({
  heading,
  deleted,
  onView,
  onChat,
}: {
  /** "Today's log saved", or the day by name when it is not today. */
  heading: string;
  /** True when the save emptied the day rather than filling it. */
  deleted?: boolean;
  onView: () => void;
  onChat: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <ThemedView
        style={[styles.tick, { backgroundColor: deleted ? theme.backgroundElement : theme.accentWash }]}
      >
        <MaterialCommunityIcons
          name={deleted ? 'eraser' : 'check'}
          size={28}
          color={deleted ? theme.textSecondary : theme.accentDeep}
        />
      </ThemedView>

      <ThemedText type="subtitle" style={styles.heading}>
        {heading}
      </ThemedText>

      {!deleted && (
        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel="View this record"
          style={({ pressed }) => [styles.wide, pressed && styles.pressed]}
        >
          <ThemedView style={[styles.button, { backgroundColor: theme.accentDeep }]}>
            <ThemedText type="smallBold" themeColor="background">
              View the record
            </ThemedText>
          </ThemedView>
        </Pressable>
      )}

      <Pressable
        onPress={onChat}
        accessibilityRole="button"
        accessibilityLabel="Add more details in chat"
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="link">
          Or add more details in chat
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
  tick: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heading: { textAlign: 'center' },
  wide: { alignSelf: 'stretch' },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
