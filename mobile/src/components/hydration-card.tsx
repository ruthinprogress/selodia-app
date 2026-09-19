import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { DrinkIcon, type DrinkKind } from '@/components/drink-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaterDroplet } from '@/components/water-droplet';
import { CardRadius, DisplayFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { QUICK_MEASURES } from '@/lib/hydration';
import { dropletFill, formatVolume, type HydrationGoal } from '@/lib/hydration-goal';
import { supabase } from '@/lib/supabase';

// WATER, ON TODAY (2026-09-19), rebuilt from Ruth's ChatGPT brief: "Simple.
// Personal. Effortless." Three states, as the brief drew them:
//
//   1. Collapsed - the droplet, today's amount, and "of 1.8 L today", with a +.
//   2. Quick add - the + opens four drinks and "Other amount..."; one tap logs.
//   3. After logging - the droplet eases up, and "Added 500 ml" appears with
//      an undo, then fades on its own.
//
// And two decisions of hers that the brief did not draw:
//   - THE GOAL IS PERSONAL AND SAYS WHY. Tapping "of 1.8 L today" opens the
//     reasons, from lib/hydration-goal.ts. No number without its evidence.
//   - NOTHING MARKS SUCCESS. No tick at the goal, no colour change, no "goal
//     reached". The droplet sits at about four-fifths at the goal and carries
//     on filling past it: "Here's where you are today", not a verdict.
//
// It replaces the "+ Add a drink" strip and its four grey pills (design list
// item 15). The four measures and their millilitres are unchanged, because a
// tap and the sentence "a mug of tea" must still agree about what a mug is.

const TOAST_MS = 4000;

type Last = { id: string; ml: number; label: string };

export function HydrationCard({
  ml,
  goal,
  onLogged,
}: {
  ml: number;
  goal: HydrationGoal;
  onLogged: (deltaMl: number) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Last | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  async function add(amount: number, label: string) {
    if (busy || !(amount > 0)) return;
    setBusy(true);
    setFailed(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('no session');
      const { data, error } = await supabase
        .from('hydration_logs')
        .insert({ user_id: user.id, ml: amount, happened_at: new Date().toISOString() })
        .select('id')
        .maybeSingle();
      if (error || !data?.id) throw new Error(error?.message ?? 'no row');
      onLogged(amount);
      setLast({ id: data.id as string, ml: amount, label });
      setOpen(false);
      setOther(null);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setLast(null), TOAST_MS);
    } catch {
      // Said, not swallowed: a tap that looks logged and is not is the one
      // thing a one-tap control must never do.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (busy || !last) return;
    setBusy(true);
    const undoing = last;
    try {
      const { error } = await supabase.from('hydration_logs').delete().eq('id', undoing.id);
      if (!error) {
        onLogged(-undoing.ml);
        setLast(null);
        if (toastTimer.current) clearTimeout(toastTimer.current);
      }
    } finally {
      setBusy(false);
    }
  }

  const otherMl = other != null ? Number(other.replace(/[^0-9]/g, '')) : 0;
  const otherValid = otherMl >= 10 && otherMl <= 3000;

  return (
    <View style={styles.outer}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.row}>
          <WaterDroplet fill={dropletFill(ml, goal.ml)} />

          <Pressable
            onPress={() => setWhy((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${formatVolume(ml)} of ${formatVolume(goal.ml)} today. ${why ? 'Hide' : 'Show'} why the goal is ${formatVolume(goal.ml)}.`}
            style={styles.amounts}
          >
            <ThemedText style={styles.amount}>{formatVolume(ml)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              of {formatVolume(goal.ml)} today
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              setOpen((v) => !v);
              setOther(null);
              setFailed(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Close the drinks' : 'Add a drink'}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.plus, pressed && styles.pressed]}
          >
            <Ionicons name={open ? 'close' : 'add'} size={26} color={theme.accent} />
          </Pressable>
        </View>

        {why && (
          <View style={styles.why}>
            {goal.reasons.map((r) => (
              <ThemedText key={r} type="small" themeColor="textSecondary" style={styles.whyText}>
                {r}
              </ThemedText>
            ))}
          </View>
        )}

        {open && (
          <View style={styles.panel}>
            <View style={styles.tiles}>
              {QUICK_MEASURES.map((m) => (
                <Pressable
                  key={m.label}
                  onPress={() => void add(m.ml, m.label)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a ${m.label.toLowerCase()}, ${m.ml} millilitres`}
                  style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}
                >
                  <ThemedView type="background" style={styles.tile}>
                    <DrinkIcon kind={m.label as DrinkKind} />
                    <ThemedText type="small" style={styles.tileLabel}>
                      {m.label}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.tileMl}>
                      {m.ml} ml
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </View>

            {other == null ? (
              <Pressable
                onPress={() => setOther('')}
                accessibilityRole="button"
                accessibilityLabel="Add another amount"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type="background" style={styles.otherRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Other amount…
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </ThemedView>
              </Pressable>
            ) : (
              <ThemedView type="background" style={styles.otherRow}>
                <TextInput
                  value={other}
                  onChangeText={setOther}
                  keyboardType="number-pad"
                  placeholder="How many ml?"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  maxLength={4}
                  style={[styles.otherInput, { color: theme.text }]}
                  accessibilityLabel="Amount in millilitres"
                  onSubmitEditing={() => otherValid && void add(otherMl, `${otherMl} ml`)}
                />
                <Pressable
                  onPress={() => void add(otherMl, `${otherMl} ml`)}
                  disabled={!otherValid || busy}
                  accessibilityRole="button"
                  accessibilityLabel="Add this amount"
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <ThemedText type="smallBold" themeColor={otherValid ? 'link' : 'textSecondary'}>
                    Add
                  </ThemedText>
                </Pressable>
              </ThemedView>
            )}
          </View>
        )}

        {failed && (
          <ThemedText type="small" themeColor="danger" style={styles.whyText}>
            That didn&apos;t save. Check your connection and try again.
          </ThemedText>
        )}
      </ThemedView>

      {last && (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(400)} style={styles.toastWrap}>
          <ThemedView type="background" style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color={theme.sage} />
            <ThemedText type="small">Added {formatVolume(last.ml)}</ThemedText>
            <Pressable
              onPress={() => void undo()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Undo the ${formatVolume(last.ml)} just added`}
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="link">
                Undo
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { gap: Spacing.two },
  card: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  amounts: { flex: 1, gap: 2 },
  amount: { fontFamily: DisplayFont.regular, fontSize: 28, lineHeight: 32 },
  plus: { padding: Spacing.one },
  why: { gap: Spacing.one, paddingTop: Spacing.one },
  whyText: { lineHeight: 20 },
  panel: { gap: Spacing.two, paddingTop: Spacing.one },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tileWrap: { flex: 1 },
  tile: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    gap: 2,
  },
  tileLabel: { marginTop: Spacing.one },
  tileMl: { fontSize: 11, lineHeight: 14 },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  otherInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  toastWrap: { alignSelf: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  pressed: { opacity: 0.6 },
});
