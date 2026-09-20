import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { DrinkIcon, type DrinkKind } from '@/components/drink-icons';
import { RowDelete } from '@/components/row-delete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WaterDroplet } from '@/components/water-droplet';
import { CardRadius, DisplayFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentUserId } from '@/lib/current-user';
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
// UNDO, NOT DELETE (Ruth's second brief, 2026-09-19): "Do not add a permanent
// delete button, minus button or edit icon ... treat deleting as error
// recovery." So there is no way to remove water from this card at all. A tap
// logs at once, and the floating note below it - HydrationToast, drawn by the
// screen so it can sit above the bottom navigation - offers Undo for five
// seconds, for the most recent drink only. Older drinks are managed from the
// log like any other entry.
//
// AND A DAY HAS TO BE CORRECTABLE AFTER ITS FIVE SECONDS (Ruth, on device the
// same evening: "Still cant remove water"). Undo covers the stray tap it was
// written for, but water lives nowhere else - it is not in the food log - so
// once the note faded a drink could not be removed at all. Tapping the amount
// now opens today's drinks, each with the same two-tap delete every other row
// in the app has. The card itself still carries no delete control, which is
// what her brief asked for: removal lives inside the detail, on the row.
//
// It replaces the "+ Add a drink" strip and its four grey pills (design list
// item 15). The four measures and their millilitres are unchanged, because a
// tap and the sentence "a mug of tea" must still agree about what a mug is.

/** How long a drink can be undone. After this it simply stands. */
const UNDO_WINDOW_MS = 5000;

/** A drink just added, which can still be undone. */
export type WaterAction = { id: string; ml: number; label: string };

export function HydrationCard({
  ml,
  goal,
  onLogged,
  onAdded,
  onRemoved,
}: {
  ml: number;
  goal: HydrationGoal;
  onLogged: (deltaMl: number) => void;
  /** The drink just added, for the screen's floating Undo note. */
  onAdded: (action: WaterAction) => void;
  /** A drink removed from today's list, so a note still offering to undo it goes. */
  onRemoved?: (id: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState(false);

  async function add(amount: number, label: string) {
    if (busy || !(amount > 0)) return;
    setBusy(true);
    setFailed(false);
    try {
      const userId = await currentUserId();
      if (!userId) throw new Error('no session');
      const { data, error } = await supabase
        .from('hydration_logs')
        .insert({ user_id: userId, ml: amount, happened_at: new Date().toISOString() })
        .select('id')
        .maybeSingle();
      if (error || !data?.id) throw new Error(error?.message ?? 'no row');
      onLogged(amount);
      onAdded({ id: data.id as string, ml: amount, label });
      setOpen(false);
      setOther(null);
    } catch {
      // Said, not swallowed: a tap that looks logged and is not is the one
      // thing a one-tap control must never do.
      setFailed(true);
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

          <View style={styles.amounts}>
            <Pressable
              onPress={() => setDay(true)}
              accessibilityRole="button"
              accessibilityLabel={`${formatVolume(ml)} so far. See today's drinks.`}
              hitSlop={Spacing.one}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText style={styles.amount}>{formatVolume(ml)}</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setWhy((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={`Of ${formatVolume(goal.ml)} today. ${why ? 'Hide' : 'Show'} why the goal is ${formatVolume(goal.ml)}.`}
              hitSlop={Spacing.one}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="textSecondary">
                of {formatVolume(goal.ml)} today
              </ThemedText>
            </Pressable>
          </View>

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
                  onSubmitEditing={() => otherValid && void add(otherMl, '')}
                />
                <Pressable
                  onPress={() => void add(otherMl, '')}
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

        {/* A drink deleted here may be the one the floating note still offers
            to undo. Telling the screen closes that note: undoing an already
            deleted row found nothing to delete, reported success, and took the
            millilitres off a second time. */}
        <HydrationDay
          visible={day}
          onClose={() => setDay(false)}
          onRemoved={(id, removedMl) => {
            onLogged(-removedMl);
            onRemoved?.(id);
          }}
        />

        {failed && (
          <ThemedText type="small" themeColor="danger" style={styles.whyText}>
            That didn&apos;t save. Check your connection and try again.
          </ThemedText>
        )}
      </ThemedView>

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
  pressed: { opacity: 0.6 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  sheetWrap: { width: '100%', maxWidth: 420 },
  sheet: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two, maxHeight: '100%' },
  sheetList: { gap: Spacing.one },
  sheetFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  drinkTime: { width: 52 },
  drinkMl: { flex: 1 },
  // Across the foot of the screen, just above the bottom navigation.
  toastLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.three,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    // A gentle lift, not a Material snackbar.
    shadowColor: '#2D2B28',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});

// THE FLOATING UNDO NOTE, drawn by the screen above the bottom navigation.
//
//   "Added Bottle (500 ml)   Undo" - fades in over 200 ms, stays five seconds,
//   fades out over 250 ms. A newer drink replaces it, and Undo only ever
//   reverses the drink it names. Undoing puts the droplet and the total back
//   as though the tap never happened.
//
// If the app goes to the background the window closes at once and the drink
// stands - her rule, and the one that keeps this predictable: an undo that
// could still fire after she has left the app would be undoing something she
// can no longer see.
export function HydrationToast({
  action,
  onUndone,
  onDone,
}: {
  action: WaterAction | null;
  /** The drink was removed: put its millilitres back. */
  onUndone: (ml: number, id: string) => void;
  /** The note is finished, by time, by Undo, or by leaving the app. */
  onDone: () => void;
}) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  // Five seconds from THIS drink: a newer one restarts the clock.
  useEffect(() => {
    if (!action) return;
    const t = setTimeout(() => doneRef.current(), UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [action]);

  useEffect(() => {
    if (!action) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') doneRef.current();
    });
    return () => sub.remove();
  }, [action]);

  async function undo() {
    if (busy || !action) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('hydration_logs').delete().eq('id', action.id);
      if (!error) {
        onUndone(action.ml, action.id);
        doneRef.current();
      }
    } finally {
      setBusy(false);
    }
  }

  const what = !action
    ? ''
    : action.label
      ? `${action.label} (${formatVolume(action.ml)})`
      : formatVolume(action.ml);

  // The layer stays mounted and only the note comes and goes, so its fade-out
  // has somewhere to play: unmounting the whole layer would cut it off.
  return (
    <View pointerEvents="box-none" style={styles.toastLayer}>
      {action && (
      <Animated.View
        key={action.id}
        entering={reduce ? undefined : FadeIn.duration(200)}
        exiting={reduce ? undefined : FadeOut.duration(250)}
        style={[styles.toast, { backgroundColor: theme.background }]}
        accessibilityLiveRegion="polite"
      >
        <Ionicons name="checkmark" size={16} color={theme.textSecondary} />
        <ThemedText type="small">Added {what}</ThemedText>
        <Pressable
          onPress={() => void undo()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Undo adding ${what}`}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="smallBold" themeColor="accentDeep">
            Undo
          </ThemedText>
        </Pressable>
      </Animated.View>
      )}
    </View>
  );
}

// TODAY'S DRINKS, each removable. Reached by tapping the amount, so the card
// keeps its single tap and the removal lives where a record is being read.
// RowDelete is the same control the food and activity rows use: the first tap
// arms it, the second removes, and it disarms itself if left alone.
type Drink = { id: string; ml: number; happened_at: string };

function HydrationDay({
  visible,
  onClose,
  onRemoved,
}: {
  visible: boolean;
  onClose: () => void;
  onRemoved: (id: string, ml: number) => void;
}) {
  const theme = useTheme();
  const [drinks, setDrinks] = useState<Drink[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('hydration_logs')
        .select('id, ml, happened_at')
        .gte('happened_at', start.toISOString())
        .order('happened_at', { ascending: false });
      if (!cancelled) setDrinks((data ?? []) as Drink[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} accessibilityViewIsModal>
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="smallBold">Today&apos;s drinks</ThemedText>

            {drinks === null ? (
              <ThemedText type="small" themeColor="textSecondary">
                …
              </ThemedText>
            ) : drinks.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nothing yet today.
              </ThemedText>
            ) : (
              <ScrollView contentContainerStyle={styles.sheetList}>
                {drinks.map((d) => (
                  <View key={d.id} style={styles.drinkRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.drinkTime}>
                      {new Date(d.happened_at).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                    <ThemedText type="small" style={styles.drinkMl}>
                      {formatVolume(d.ml)}
                    </ThemedText>
                    <RowDelete
                      table="hydration_logs"
                      id={d.id}
                      what={`${formatVolume(d.ml)} of water`}
                      onDeleted={() => {
                        setDrinks((rows) => (rows ?? []).filter((r) => r.id !== d.id));
                        onRemoved(d.id, d.ml);
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.sheetFoot}>
              {/* Earlier days live on their own screen, with the same delete on
                  each row - see log/water-history.tsx. */}
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/log/water-history');
                }}
                accessibilityRole="button"
                accessibilityLabel="Earlier days"
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  Earlier days
                </ThemedText>
              </Pressable>
              <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="small" themeColor="link">
                  Done
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
