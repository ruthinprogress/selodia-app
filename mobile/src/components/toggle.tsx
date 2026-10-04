import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A TOGGLE, BECAUSE A TOGGLE IS WHAT IT IS (Ruth, 4 October 2026).
//
//   "erm, I'm not sure i want more pills, I think toggle is clearer and smaller
//   for the Today screen."
//
// WHY THIS APP HAD NONE UNTIL NOW, and why that reasoning does not apply here.
// macro-choices.tsx chose checkboxes over switches and said why: "A switch would
// also imply each row acts the moment it moves; these are a set being chosen
// together." That is exactly right for What I track, where six boxes are picked
// and saved as one answer.
//
// These act the moment they move. One tap changes today's calorie target. The
// implication a switch carries is the true one here, which is the same argument
// arriving at the opposite control - so this is not a break with that decision,
// it is that decision applied to a different kind of row.
//
// NOT React Native's Switch. That draws the platform's own control: iOS green on
// an app with no green in it, and a Material thumb on Android, so the one control
// on Today would be the one thing on screen wearing somebody else's brand. It is
// forty lines to draw it in the app's own colours and it reads the same on both.
//
// SMALL, AND THE LABEL IS THE TARGET. The whole row is pressable rather than the
// track alone - a 26-point switch is a poor target for a thumb, and reaching for
// the words is what people do anyway.

const TRACK_W = 44;
const TRACK_H = 26;
const KNOB = 20;

export function Toggle({
  checked,
  onToggle,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  /** One short line under the label, when the label alone is not enough. */
  hint?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      // ROLE 'switch' CARRIES THE STATE TO A SCREEN READER. The tick inside a
      // View was invisible to TalkBack for weeks (see checkbox.tsx); a drawn
      // knob is exactly as invisible, and for the same reason.
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={Spacing.two}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed]}>
      <View style={styles.labels}>
        <ThemedText type="small">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.track,
          {
            backgroundColor: checked ? theme.accentDeep : theme.background,
            borderColor: checked ? theme.accentDeep : theme.textSecondary,
            opacity: disabled ? 0.5 : 1,
          },
        ]}>
        <View
          style={[
            styles.knob,
            {
              backgroundColor: checked ? theme.backgroundElement : theme.textSecondary,
              alignSelf: checked ? 'flex-end' : 'flex-start',
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 2 },
  labels: { flexGrow: 1, flexShrink: 1, gap: 2 },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 1,
    padding: (TRACK_H - KNOB) / 2 - 1,
    justifyContent: 'center',
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
  pressed: { opacity: 0.6 },
});
