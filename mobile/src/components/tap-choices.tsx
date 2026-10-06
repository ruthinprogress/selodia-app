import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { chipSpan } from '@/lib/chip-layout';

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
//
// THREE TO A ROW (Ruth, 5 October 2026): "just put the tap chips next to each
// other in rows of 3 so they don't take up so much space". One per line made the
// steer-around screen a column of twenty-five.
//
// WHICH CHIPS GET A THIRD AND WHICH GET THE WHOLE WIDTH is lib/chip-layout.ts, so
// the rule is a pure function a check can run over every real chip list in the
// app rather than a style that can only be judged on a phone. Short labels take a
// third; anything long, or anything carrying a hint, takes the row.
//
// NOTHING SHRINKS AND NOTHING CLIPS. A label too wide for a third takes the full
// width and wraps. That is the "Wee" tab rule: Android measured an autosizing
// label in the system face and drew it in Manrope, and every unselected tab lost
// its last letter for three attempts running.

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
            style={({ pressed }) => [
              styles.wrap,
              chipSpan(option) === 'third' ? styles.third : styles.full,
              pressed && styles.pressed,
            ]}>
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
  // WRAPPING ROWS. `gap` spaces both axes, so the rows and the chips within a row
  // are separated by the same amount without a margin on either.
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  wrap: { borderRadius: CardRadius },
  /**
   * A THIRD, ALLOWING FOR THE TWO GAPS. Three chips and two gaps fill the row, so
   * each chip is a third of what is left rather than a third of the whole: 31%
   * leaves 7% for the two gaps, which at phone width is the Spacing.two either
   * side. Written as a percentage rather than a measured width because the
   * container is whatever the screen gives it.
   */
  third: { flexBasis: '31%', flexGrow: 1 },
  /** Its own row. See chipSpan: a long label or anything carrying a hint. */
  full: { flexBasis: '100%' },
  option: {
    paddingVertical: Spacing.three,
    // NARROWER THAN IT WAS, because a third of a phone has no room for
    // Spacing.four either side and the padding was eating the label.
    paddingHorizontal: Spacing.three,
    borderRadius: CardRadius,
    borderWidth: 1,
    gap: Spacing.one,
    // EVERY CHIP IN A ROW THE SAME HEIGHT, AND NOT BY A PERCENTAGE.
    //
    // THIS WAS height: '100%' FOR ONE RELEASE AND IT BROKE EVERY CHIP SCREEN
    // (Ruth, 6 October 2026, screenshot of question 1). A percentage height in
    // React Native resolves against a parent with a DEFINITE height, and the
    // Pressable around this has none - so on Android it resolved to something
    // enormous. Three chips became three empty columns running off the bottom of
    // the screen, with the labels centred somewhere below the fold. The text was
    // never missing. It was off-screen.
    //
    // flex: 1 IS THE CORRECT VERSION. The Pressable is a flex item in a wrapping
    // row, so it is already stretched to its line's height by the default
    // alignItems: 'stretch'; this fills that height rather than inventing one.
    //
    // AND THE LABEL SITS AT THE TOP. Centring it was what hid it, and with a
    // two-line label beside one-line ones, top-aligned reads better anyway.
    flex: 1,
    justifyContent: 'flex-start',
  },
  pressed: { opacity: 0.7 },
});
