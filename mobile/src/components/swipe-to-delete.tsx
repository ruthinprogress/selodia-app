import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteEntry, type DeletableTable } from '@/lib/delete-entry';

// SWIPE LEFT TO DELETE, INSIDE THE DETAIL VIEW (Ruth, 24 September 2026):
// "Inside detail view -> swipe left on the row to delete the whole entry."
//
// IT REVEALS, IT DOES NOT DELETE. A swipe far enough to fire is a swipe that
// can be made by accident, and the thing behind it cannot be undone. So this is
// the iOS Mail shape: the gesture uncovers a Delete, and Delete is a tap. That
// is what most people mean by swipe-to-delete, and it is the version that
// survives a pocket.
//
// AND THE VISIBLE BUTTON STAYS. row-delete.tsx already carried the opposite
// decision, in as many words: "Not a swipe: a hidden gesture is a control that
// only some people ever find." Rather than overruling either her or the file,
// both hold - the gesture for whoever reaches for it, the button underneath for
// everybody else. She confirmed the reasoning from her own week: "Ive been
// caught out by this on Google accounts just yesterday trying to delete an
// erroneous 2-factor auth. Good call keeping a visible one for my demographic."
//
// The row is still a button. Swiping does not consume the tap, because
// activeOffsetX means the pan only claims the gesture once it is plainly
// horizontal - a vertical scroll or a straight press reaches the child intact.

/** How far it opens: enough for the word, not so far the row disappears. */
const OPEN = 96;

/** Past this, releasing opens rather than springs back. */
const CATCH = 40;

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

  const settle = useCallback((next: boolean) => setOpen(next), []);

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

  // HIDDEN UNTIL THE ROW ACTUALLY MOVES. Sitting behind a closed row it showed
  // as a red arc in the rounded corner, because the row in front is a rectangle
  // and the clip is not. Tied to the same shared value as the slide, so it
  // appears exactly as far as the row has travelled and never a frame early.
  const revealed = useAnimatedStyle(() => ({ opacity: x.get() < -1 ? 1 : 0 }));

  async function remove() {
    if (busy) return;
    setBusy(true);
    await deleteEntry(table, id);
    onDeleted?.();
  }

  return (
    <View style={styles.wrap}>
      {/* Behind the row, uncovered as it slides. */}
      <Animated.View style={[styles.behind, revealed]}>
        <Pressable
          onPress={() => void remove()}
          disabled={!open || busy}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${what}`}
          style={({ pressed }) => [styles.deleteHit, pressed && styles.pressed]}
        >
          {/* A MARK, NOT THE WORD (Ruth, 25 September 2026: "I think the
              'Delete' word is unnecessary reading. Please replace with a quiet
              delete icon where it appears.")

              It reads without being read. The panel is already the danger
              colour and the person deliberately pulled the row back to uncover
              it, so the word was restating what the red had said. The
              accessible label still says "Delete <the thing>", which is what a
              screen reader announces - quieter is not the same as silent. */}
          <ThemedView style={[styles.deleteBox, { backgroundColor: theme.danger }]}>
            {busy ? (
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                …
              </ThemedText>
            ) : (
              <Ionicons name="trash-outline" size={22} color={theme.background} />
            )}
          </ThemedView>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={sliding}>
          <ThemedView type="background" style={styles.front}>
            {children}
          </ThemedView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: CardRadius, overflow: 'hidden' },
  behind: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteHit: { height: '100%', justifyContent: 'center' },
  deleteBox: {
    width: OPEN,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  // Opaque, or the Delete behind it shows through the row it is meant to be under.
  front: { paddingVertical: Spacing.one },
  pressed: { opacity: 0.8 },
});
