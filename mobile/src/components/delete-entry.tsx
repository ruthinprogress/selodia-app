import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// REMOVING ONE ENTRY (Ruth, 2026-09-18: the delete controls "were scoped but
// seem to have disappeared" - they were specified on 12 September and never
// built, so this is the first of them rather than a restoration).
//
// WHY IT IS ALLOWED AT ALL, given "permanent, never deleted". That rule is about
// the app not quietly discarding somebody's history, not about trapping a
// mistake in it. A meal logged twice, a weight typed wrong, a run that never
// happened: leaving those in is not honesty, it is a wrong record nobody can
// correct. Chat can already delete an entry by being asked; this is the same
// power where the entry itself is.
//
// IT ASKS FIRST, ONCE, IN PLAIN WORDS, and the confirm is the destructive one -
// never the first tap, and never a dialog that can be dismissed into deleting.
// RLS scopes the delete to the signed-in person's own row.

export function DeleteEntry({
  table,
  id,
  what,
  onDeleted,
}: {
  table: 'food_logs' | 'activity_logs' | 'body_measurements' | 'personal_metrics' | 'hydration_logs';
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
    const { error } = await supabase.from(table).delete().eq('id', id);
    setBusy(false);
    if (error) {
      console.log('DELETE ENTRY FAILED:', error.message);
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
