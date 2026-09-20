import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addOptions, type AddSource } from '@/lib/composer-add';
import { canPickFiles } from '@/lib/document-pages';

// The composer's "+" action sheet (build item 10b, step 1).
//
// SOURCE-based, never type-based: Take a photo · Gallery · Choose a
// file. It deliberately does not ask WHAT the person is photographing - a scale
// readout, a plate of food and a treadmill display all come in the same way,
// and the image is classified afterwards. Asking someone to categorise their
// own photo would be the closed menu the free-text philosophy exists to reject.
//
// "Choose a file" appears only on a build that can open one - see
// composer-add.ts and canPickFiles(). A PDF is how a hospital letter usually
// arrives, and it was added the day Ruth tried to give Selodia one.

export function ComposerAddSheet({
  visible,
  onSelect,
  onCancel,
  // Off on the Today quick-log bar: a file is always a document, documents are
  // read in Chat, and a control that hands its result to another screen does
  // not belong on a bar whose whole promise is logging without leaving Today.
  allowFiles = true,
}: {
  visible: boolean;
  onSelect: (source: AddSource) => void;
  onCancel: () => void;
  allowFiles?: boolean;
}) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onCancel}
        accessibilityLabel="Close"
      />
      <View style={styles.bottom} pointerEvents="box-none">
        <ThemedView style={styles.sheet}>
          {addOptions(allowFiles && canPickFiles()).map((o) => (
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
    // Colour comes from theme.scrim at render; only the geometry lives here.
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
