import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteEntry, type DeletableTable } from '@/lib/delete-entry';

// DELETE, ON THE ROW (Ruth, 2026-09-18: "The delete button should be easier to
// reach than clicking inside each one, this would be tedious to do for a user").
//
// She was right, and the occasion proved it: a voice session had written eight
// phantom dinners into one evening, and removing them meant opening each entry,
// scrolling its card, tapping Delete, confirming, and closing - five taps a row,
// forty for the evening. Nobody does that. They live with a wrong log instead,
// which is how a person stops trusting what the app tells them.
//
// SO IT IS ON THE ROW, AND IT IS VISIBLE. Not a swipe: a hidden gesture is a
// control that only some people ever find, and this app is built for people who
// should not have to know that swiping left on a list does anything. Not a
// long-press either, for the same reason.
//
// IT STILL ASKS, AND THE FIRST TAP IS NEVER THE DESTRUCTIVE ONE. Tapping the
// mark arms it; the row says "Delete?" beside a Keep, and only the second tap
// removes anything. Left armed and untouched it disarms itself after a few
// seconds, so a stray tap in a pocket cannot leave a row one accident from gone.

const DISARM_MS = 6000;

export function RowDelete({
  table,
  id,
  what,
  onDeleted,
}: {
  table: DeletableTable;
  id: string;
  /** What is being removed, for the label a screen reader announces. */
  what: string;
  onDeleted: () => void;
}) {
  const theme = useTheme();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Disarms itself. Cleared on unmount and whenever the state changes, so a row
  // that scrolls away or is deleted leaves no timer behind.
  useEffect(() => {
    if (!asking || busy) return;
    const t = setTimeout(() => setAsking(false), DISARM_MS);
    return () => clearTimeout(t);
  }, [asking, busy]);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await deleteEntry(table, id);
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    onDeleted();
  }

  if (!asking) {
    return (
      <Pressable
        onPress={() => setAsking(true)}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${what}`}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.mark, pressed && styles.pressed]}
      >
        {/* Quiet enough to ignore, and the same size as the eye beside it, so a
            row still reads as a record rather than as a control panel. */}
        <Ionicons name="close-outline" size={18} color={theme.textSecondary} />
      </Pressable>
    );
  }

  return (
    <View style={styles.confirm}>
      <Pressable
        onPress={() => void remove()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Yes, delete ${what}`}
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="smallBold" style={{ color: theme.danger }}>
          {busy ? '…' : failed ? 'Again?' : 'Delete?'}
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => setAsking(false)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Keep it"
        hitSlop={Spacing.two}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="textSecondary">
          Keep
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 24, alignItems: 'center', justifyContent: 'center' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pressed: { opacity: 0.6 },
});
