import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// THE ONE TAP CONTROL ONBOARDING USES, written once rather than six times.
//
// Ruth's session brief: onboarding is tap-based and takes about a minute. Six
// of its seven screens are a question and a set of answers, and the first two
// were on their way to having two slightly different chip implementations
// before this existed. The onboarding openers going three ways is already a
// story in this repository.
//
// SINGLE AND MULTI ARE THE SAME CONTROL WITH DIFFERENT ANNOUNCEMENTS, which is
// the part a screen reader cares about: `radio` for one-of, `checkbox` for
// any-of, and the checked state said out loud in both. The checkbox component
// was silent about its own state until this morning; this one is not allowed to
// repeat that.
//
// A HINT SITS UNDER ITS LABEL, not beside it. "Surgical menopause / Caused by
// surgery, with the ovaries removed" is two lines on a phone and reads as one
// thought; the same words on one line wrap in the middle of the distinction.

export type Choice<T extends string> = {
  key: T;
  label: string;
  hint?: string;
};

export function TapChoices<T extends string>({
  options,
  selected,
  onSelect,
  multi = false,
}: {
  options: readonly Choice<T>[];
  /** The chosen keys. One entry for single-select, any number for multi. */
  selected: readonly T[];
  onSelect: (key: T) => void;
  multi?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {options.map((option) => {
        const on = selected.includes(option.key);
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            accessibilityLabel={option.hint ? `${option.label}. ${option.hint}` : option.label}
            style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
            <ThemedView
              type={on ? 'backgroundSelected' : 'backgroundElement'}
              style={[styles.option, { borderColor: on ? theme.accentDeep : 'transparent' }]}>
              <ThemedText type="small" themeColor={on ? 'accentDeep' : 'text'}>
                {option.label}
              </ThemedText>
              {option.hint ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {option.hint}
                </ThemedText>
              ) : null}
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  wrap: { borderRadius: CardRadius },
  option: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: CardRadius,
    borderWidth: 1,
    gap: Spacing.one,
  },
  pressed: { opacity: 0.7 },
});
