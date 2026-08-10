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
    <Pressable onPress={onToggle} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView style={styles.row}>
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
  pressed: {
    opacity: 0.7,
  },
});
