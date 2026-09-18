import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteEntry, type DeletableTable } from '@/lib/delete-entry';

// REMOVING ONE ENTRY, FROM INSIDE ITS OWN CARD (2026-09-18).
//
// This is the version you meet having opened an entry to look at it. The one on
// the row itself is row-delete.tsx, which is where the work actually gets done -
// Ruth, the same day: "The delete button should be easier to reach than clicking
// inside each one, this would be tedious to do for a user." Both call the same
// deleteEntry, so they cannot drift.
//
// IT ASKS FIRST, ONCE, IN PLAIN WORDS, and the confirm is the destructive one -
// never the first tap, and never a dialog that can be dismissed into deleting.
// The card has room for the whole sentence, so it says it; the row has room for
// one word, so it says "Delete?". See lib/delete-entry.ts for why deleting is
// allowed at all.

export function DeleteEntry({
  table,
  id,
  what,
  onDeleted,
}: {
  table: DeletableTable;
  id: string;
  /** What is being removed, for the question: "this meal", "this reading". */
  what: string;
  onDeleted: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

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
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="textSecondary" style={styles.quiet}>
          Delete
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.confirm}>
      <ThemedText type="small" themeColor="textSecondary">
        Delete {what}? This cannot be undone.
      </ThemedText>
      <View style={styles.confirmActions}>
        <Pressable
          onPress={() => void remove()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Yes, delete ${what}`}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="smallBold" themeColor="accentDeep">
            {busy ? 'Deleting…' : 'Yes, delete'}
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
            Keep it
          </ThemedText>
        </Pressable>
      </View>
      {failed && (
        <ThemedText type="small" themeColor="textSecondary">
          That didn&apos;t delete. Try again in a moment.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quiet: { paddingVertical: Spacing.two },
  confirm: { gap: Spacing.two, paddingTop: Spacing.two },
  confirmActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  pressed: { opacity: 0.6 },
});
