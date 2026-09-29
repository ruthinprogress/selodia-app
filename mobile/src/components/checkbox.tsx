import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type CheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  label: string;
};

export function Checkbox({ checked, onToggle, label }: CheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      // THE TICK WAS INVISIBLE TO A SCREEN READER UNTIL 2026-09-28, and this is
      // the one component where that mattered most. React Native gathers the
      // text inside a touchable, so TalkBack read the label out perfectly well
      // - and said nothing at all about whether the box was ticked, or that it
      // was a box. The checkmark is a ✓ character drawn inside a View; there is
      // no state in it that a screen reader can reach.
      //
      // Fourteen uses, and they are not incidental ones: all three consent
      // checkboxes in onboarding, and the eight that choose what goes into a
      // report for a GP. A blind woman was agreeing to terms she could not
      // confirm she had agreed to.
      //
      // One component, one fix, fourteen screens better - which is the argument
      // for having had a shared Checkbox in the first place.
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => pressed && styles.pressed}>
      {/* Transparent, so it sits on whatever surface holds it - the page on
          the consent screen, a card in Settings. */}
      <ThemedView style={[styles.row, styles.clear]}>
        <ThemedView type={checked ? 'backgroundSelected' : 'backgroundElement'} style={styles.box}>
          {checked && <ThemedText type="smallBold">✓</ThemedText>}
        </ThemedView>
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  clear: { backgroundColor: 'transparent' },
  pressed: {
    opacity: 0.7,
  },
});
