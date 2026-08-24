import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ADD_OPTIONS, type AddSource } from '@/lib/composer-add';

// The composer's "+" action sheet (build item 10b, step 1).
//
// SOURCE-based, never type-based: Take a photo · Choose from library · Choose a
// file. It deliberately does not ask WHAT the person is photographing - a scale
// readout, a plate of food and a treadmill display all come in the same way,
// and the image is classified afterwards. Asking someone to categorise their
// own photo would be the closed menu the free-text philosophy exists to reject.
//
// NOT MOUNTED YET. Every option needs expo-image-picker, which is not installed
// until the next EAS build, so rendering the "+" today would put three dead
// options on screen - exactly what principle 8 rules out. This ships as a tested
// component and gets mounted in step 3, when the callbacks can actually do
// something.

export function ComposerAddSheet({
  visible,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  onSelect: (source: AddSource) => void;
  onCancel: () => void;
}) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close" />
      <View style={styles.bottom} pointerEvents="box-none">
        <ThemedView style={styles.sheet}>
          {ADD_OPTIONS.map((o) => (
            <Pressable
              key={o.source}
              onPress={() => onSelect(o.source)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedView type="backgroundElement" style={styles.option}>
                <ThemedText type="small">{o.label}</ThemedText>
              </ThemedView>
            </Pressable>
          ))}

          <Pressable onPress={onCancel} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.cancel}>
              Cancel
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  option: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  cancel: { textAlign: 'center', paddingVertical: Spacing.three },
  pressed: { opacity: 0.6 },
});
