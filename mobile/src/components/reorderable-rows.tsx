import { useCallback, useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, UIManager, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// HOLD A ROW AND MOVE IT (Ruth, 21 September 2026): "can we make the cards on
// the logging page so they can be reorganised by holding down and just moving
// up or down?"
//
// WRITTEN HERE RATHER THAN INSTALLED. The obvious answer is a drag-and-drop
// list library, and the obvious answer is wrong this time: the established ones
// are built against Reanimated 2 and 3, this app is on 4.5, and a library that
// half-works inside a gesture is the kind of fault that only shows up on a real
// phone in somebody's hand. For a fixed list of seven rows of equal height the
// arithmetic is small and completely knowable - which index is the finger over
// - so it is written out where it can be read.
//
// EQUAL HEIGHTS ARE THE WHOLE TRICK, and the reason this stays simple. Every
// row on the Log is the same shape, so "which row am I over" is one division
// rather than a table of measured offsets that has to be kept in step with the
// layout.
//
// NOTHING MOVES UNTIL SHE MEANS IT. A long press starts the drag - a list whose
// rows slide under an ordinary scroll would be unusable - and the row lifts so
// it is obvious which one is in hand.

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type Reorderable = { id: string };

export function ReorderableRows<T extends Reorderable>({
  items,
  rowHeight,
  renderRow,
  onReorder,
}: {
  items: T[];
  /** Every row is this tall. See the note above: it is what keeps this honest. */
  rowHeight: number;
  renderRow: (item: T, index: number, dragging: boolean) => React.ReactNode;
  onReorder: (items: T[]) => void;
}) {
  const [held, setHeld] = useState<string | null>(null);

  const move = useCallback(
    (id: string, by: number) => {
      const from = items.findIndex((i) => i.id === id);
      if (from < 0) return;
      const to = Math.max(0, Math.min(items.length - 1, from + by));
      if (to === from) return;
      const next = [...items];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      // The rows that did NOT move animate into their new places, so the list
      // reads as one thing rearranging rather than several things jumping.
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onReorder(next);
    },
    [items, onReorder]
  );

  return (
    <View>
      {items.map((item, index) => (
        <Row
          key={item.id}
          rowHeight={rowHeight}
          dragging={held === item.id}
          onHold={() => setHeld(item.id)}
          onRelease={() => setHeld(null)}
          onMove={(by) => move(item.id, by)}
        >
          {renderRow(item, index, held === item.id)}
        </Row>
      ))}
    </View>
  );
}

function Row({
  children,
  rowHeight,
  dragging,
  onHold,
  onRelease,
  onMove,
}: {
  children: React.ReactNode;
  rowHeight: number;
  dragging: boolean;
  onHold: () => void;
  onRelease: () => void;
  onMove: (by: number) => void;
}) {
  const offset = useSharedValue(0);
  // How many places this row has already been moved during THIS drag. Without
  // it a slow drag across two rows would fire the same single-step move twice
  // and then again, walking the row to the bottom of the list.
  const stepped = useSharedValue(0);

  const drag = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      runOnJS(onHold)();
    })
    .onUpdate((e) => {
      offset.set(e.translationY);
      const want = Math.round(e.translationY / rowHeight);
      if (want !== stepped.get()) {
        const by = want - stepped.get();
        stepped.set(want);
        // The list reorders under the finger, so the row being dragged is
        // already where it will land and the offset is measured from there.
        offset.set(e.translationY - want * rowHeight);
        runOnJS(onMove)(by);
      }
    })
    .onFinalize(() => {
      stepped.set(0);
      offset.set(withSpring(0, { damping: 20, stiffness: 220 }));
      runOnJS(onRelease)();
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }, { scale: withTiming(dragging ? 1.02 : 1, { duration: 120 }) }],
    // Lifted, so which row is in hand is never in doubt.
    zIndex: dragging ? 10 : 0,
    elevation: dragging ? 6 : 0,
    shadowOpacity: withTiming(dragging ? 0.16 : 0, { duration: 120 }),
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[styles.row, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    shadowColor: '#2D2B28',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
});
