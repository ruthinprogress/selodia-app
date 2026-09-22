import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentUserId } from '@/lib/current-user';
import { QUICK_MEASURES } from '@/lib/hydration';
import { supabase } from '@/lib/supabase';

// A BAR FOR LOGGING A DRINK, ON THE SCREEN ABOUT DRINKS (Ruth, 22 September
// 2026):
//
//   "it doesn't make sense that hydration doesn't have a quick log function. It
//   should have a quick log bar too, just like food ... otherwise why is it in
//   the log list"
//
// Exactly right, and the second sentence is the argument. Every other row on
// the Log page leads somewhere you can RECORD something. Hydration led to a
// week of history and no way to add to it, so the row was a link to a read-only
// page pretending to be a logging screen. Quick-adding lived only on Today,
// which is where you look at your day rather than where you go to log one.
//
// FOUR TAPS TOTAL, and the measures are the ones already used on Today - the
// same glass, mug, bottle and pint - so a drink is the same size wherever it is
// logged from. Two places offering different defaults for "a mug" would make
// the water figure depend on which screen somebody happened to be on.

export function HydrationQuickLog({ onLogged }: { onLogged?: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function add(ml: number, label: string) {
    if (busy || !(ml > 0)) return;
    setBusy(true);
    setNote(null);
    try {
      const userId = await currentUserId();
      if (!userId) throw new Error('no session');
      const { error } = await supabase.from('hydration_logs').insert({
        user_id: userId,
        ml,
        // ITS OWN WORDS, so the history reads as "Mug" rather than a bare
        // volume - the same reason a drink logged in chat keeps what was said.
        raw_input: label.toLowerCase(),
        happened_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      setNote(`${label} added.`);
      onLogged?.();
    } catch {
      // NEVER CLAIM A SAVE THAT DID NOT HAPPEN. The whole app turns on this.
      setNote('That did not save. Worth trying again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Add a drink</ThemedText>
      <View style={styles.row}>
        {QUICK_MEASURES.map((m) => (
          <Pressable
            key={m.label}
            onPress={() => void add(m.ml, m.label)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Add a ${m.label.toLowerCase()}, ${m.ml} millilitres`}
            style={({ pressed }) => [styles.chipWrap, pressed && styles.pressed]}
          >
            <ThemedView type="background" style={[styles.chip, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor="accentDeep">
                {m.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {m.ml} ml
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        {note ?? 'Or say it in chat, with anything else you drank.'}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two, marginBottom: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipWrap: { flexGrow: 1, minWidth: 74 },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  hint: { lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
