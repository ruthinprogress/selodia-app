import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

import { useTheme } from '@/hooks/use-theme';
import { deleteEntry, type DeletableTable } from '@/lib/delete-entry';
import { setOpenSwipe, subscribeOpenSwipe } from '@/lib/open-swipe';

// SWIPE LEFT TO DELETE (Ruth, 24 September 2026: "Inside detail view -> swipe
// left on the row to delete the whole entry"), rebuilt on 25 September against
// her list of everything wrong with the first version.
//
// IT REVEALS, IT DOES NOT DELETE. A swipe far enough to fire is a swipe that
// can be made by accident, and the thing behind it cannot be undone. So this is
// the iOS Mail shape: the gesture uncovers a delete, and the delete is a tap.
// That IS the confirmation her spec asks for - two deliberate actions, not one
// - and it is the version that survives a pocket.
//
// AND THE VISIBLE BUTTON STAYS. row-delete.tsx carries the opposite decision in
// as many words: "Not a swipe: a hidden gesture is a control that only some
// people ever find." Both hold - the gesture for whoever reaches for it, the
// button underneath for everybody else. Her reasoning, from her own week: "Ive
// been caught out by this on Google accounts just yesterday trying to delete an
// erroneous 2-factor auth. Good call keeping a visible one for my demographic."
//
// WHAT WAS WRONG WITH THE FIRST VERSION, all five of them hers, all five in one
// place, and all five caused by the wrapper trying to own the card's shape:
//
//   "the red block is taller than the card"   the front had 4 points of
//       vertical padding, so the wrapper was 8 taller than the card and the
//       panel filled the wrapper.
//   "square-cornered on its inner edge"       the panel had no radius of its
//       own; the wrapper's overflow:hidden rounded the outer corners only.
//   "sits beside the card"                    it was laid out as a neighbour
//       rather than sitting behind.
//   "card text is clipped mid-word"           overflow:hidden on the wrapper.
//       The card slides LEFT, so it is the card's own left edge that leaves the
//       wrapper and gets cut - which is why she saw "care Routine".
//   "loses its rounded corners as it slides"  the card had no radius; the
//       wrapper was drawing it, and a wrapper cannot round something that has
//       moved out from under it.
//
// SO THE WRAPPER NOW OWNS NOTHING. No radius, no clipping, no padding. The card
// underneath keeps its own shape and simply translates, whole. Whatever this
// wraps is drawn exactly as it would be without it.
//
// AND THE PANEL LOST ITS FILL (her preferred style): "no fill, just a bin icon
// in deep terracotta on the page background". With no fill there is no block to
// be the wrong height and no corner to be the wrong shape - the entire class of
// fault is gone rather than corrected.

/** How far it opens. Enough for the mark and its air, and no further. */
const OPEN = 64;

/** Past this, releasing opens rather than springs back. */
const CATCH = 28;

export function SwipeToDelete({
  table,
  id,
  what,
  onDeleted,
  children,
}: {
  table: DeletableTable;
  id: string;
  /** Named in the accessible label, so the control says what it removes. */
  what: string;
  onDeleted?: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const x = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Identity for the one-open-at-a-time store. useId rather than the row's own
  // id, because the same entry can legitimately be on screen twice - a plan in
  // a list and the same plan in a detail sheet - and those are two rows.
  const mine = useId();

  const settle = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) setOpenSwipe(mine);
      else setOpenSwipe(null);
    },
    [mine]
  );

  // Somebody else opened, or the page scrolled, or the page was tapped.
  useEffect(
    () =>
      subscribeOpenSwipe((openNow) => {
        if (openNow === mine) return;
        setOpen(false);
        x.set(withSpring(0, { damping: 18, stiffness: 180 }));
      }),
    [mine, x]
  );

  const pan = Gesture.Pan()
    // Only once it is clearly sideways: a vertical scroll must still scroll,
    // and a tap must still reach the row.
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const from = open ? -OPEN : 0;
      // .set/.get rather than .value: Reanimated 4's accessors, which is what
      // reorderable-rows uses and what the immutability lint expects.
      x.set(Math.min(0, Math.max(-OPEN, from + e.translationX)));
    })
    .onEnd(() => {
      const shouldOpen = x.get() < -CATCH;
      x.set(withSpring(shouldOpen ? -OPEN : 0, { damping: 18, stiffness: 180 }));
      runOnJS(settle)(shouldOpen);
    });

  const sliding = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  // Hidden until the row actually moves, so nothing shows through a card that
  // is not perfectly opaque. Tied to the same shared value as the slide, so it
  // appears exactly as far as the row has travelled and never a frame early.
  const revealed = useAnimatedStyle(() => ({ opacity: x.get() < -1 ? 1 : 0 }));

  async function remove() {
    if (busy) return;
    setBusy(true);
    setOpenSwipe(null);
    await deleteEntry(table, id);
    onDeleted?.();
  }

  return (
    <View style={styles.wrap}>
      {/* BEHIND THE CARD, at the card's own height - which it gets by being
          stretched to this wrapper, and the wrapper is exactly the card now
          that it adds no padding of its own. No fill, so there is no shape to
          match. */}
      <Animated.View style={[styles.behind, revealed]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable
          onPress={() => void remove()}
          disabled={!open || busy}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${what}`}
          style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
        >
          {/* A MARK, NOT THE WORD (Ruth, 25 September 2026: "I think the
              'Delete' word is unnecessary reading. Please replace with a quiet
              delete icon where it appears.")

              Deep terracotta rather than the danger red, at her instruction.
              accentDeep is 4.76:1 on the page's cream, where full-strength
              terracotta is 2.43:1 - so this is also the only terracotta that
              passes as a control at this size. */}
          {busy ? (
            <ThemedText type="smallBold" themeColor="accentDeep">
              …
            </ThemedText>
          ) : (
            <Ionicons name="trash-outline" size={22} color={theme.accentDeep} />
          )}
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={pan}>
        {/* Nothing but the transform. The card inside keeps its own fill, its
            own radius and its own margins, and moves as one piece. */}
        <Animated.View style={sliding}>
          {children}
          {/* A TAP ON THE CARD CLOSES IT, rather than opening whatever the card
              opens (Ruth: "Tapping elsewhere or scrolling closes an open
              swipe"). Without this the first tap after a swipe would open the
              plan she was about to delete, which is the worst possible
              misfire. Only mounted while open, so it can never sit in front of
              a row nobody has swiped. */}
          {open ? (
            <Pressable
              onPress={() => {
                setOpen(false);
                setOpenSwipe(null);
                x.set(withSpring(0, { damping: 18, stiffness: 180 }));
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  // Deliberately bare: no radius, no overflow, no padding. See the note above -
  // every one of the five faults came from this wrapper having an opinion about
  // the card's shape.
  wrap: {},
  behind: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: OPEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The whole panel is the target once it is open, which is 64 by the card's
  // height - comfortably past the 44 a control needs.
  hit: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
