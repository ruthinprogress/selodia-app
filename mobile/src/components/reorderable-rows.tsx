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

// HOLD A CARD AND MOVE IT (Ruth, 21 September 2026): "can we make the cards on
// the logging page so they can be reorganised by holding down and just moving
// up or down?" - and, a few hours later, the same for the Cycle page's own
// cards.
//
// WRITTEN HERE RATHER THAN INSTALLED. The obvious answer is a drag-and-drop
// list library, and the obvious answer is wrong this time: the established ones
// are built against Reanimated 2 and 3, this app is on 4.5, and a library that
// half-works inside a gesture is the kind of fault that only shows up on a real
// phone in somebody's hand.
//
// IT MEASURES NOW, RATHER THAN ASSUMING (21 September, second version). The
// first one took a single row height and divided by it, which was true of the
// Log - seven identical rows - and false the moment the Cycle cards asked for
// the same behaviour, because a Notes card is four times the height of a Flow
// one. Dividing by an average there would put the card two places from where
// the finger is.
//
// So every row reports its own height as it lays out, and the drag walks its
// neighbours: move down when the finger has passed half of the card BELOW,
// move up when it has passed half of the one above. That is the same arithmetic
// at equal heights, so the Log is unchanged.
//
// NOTHING MOVES UNTIL SHE MEANS IT. A long press starts the drag - a list whose
// rows slide under an ordinary scroll would be unusable - and the row lifts so
// it is obvious which one is in hand.
//
// THE NEIGHBOUR HEIGHTS ARE NUMBERS, NOT A FUNCTION (21 September 2026, after
// "re-ordering cards did not work at all anywhere"). The first version asked a
// JavaScript callback for them from inside the drag - but a gesture's onUpdate
// runs on the UI thread, where it can read numbers captured in its closure and
// cannot call back into JavaScript. So the heights are measured into state and
// handed down as plain numbers, which a worklet may read freely.
//
// There were two faults behind that report and this is only one of them. The
// other was that the app had no GestureHandlerRootView at all, so no gesture
// anywhere could fire; see app/_layout.tsx.

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type Reorderable = { id: string };

export function ReorderableRows<T extends Reorderable>({
  items,
  renderRow,
  onReorder,
  disabled = false,
}: {
  items: T[];
  renderRow: (item: T, index: number, dragging: boolean) => React.ReactNode;
  onReorder: (items: T[]) => void;
  /** True while the list is not hers to rearrange - a save in flight, say. */
  disabled?: boolean;
}) {
  const [held, setHeld] = useState<string | null>(null);

  // MEASURED, AND IN STATE. A ref would avoid a render per row, but the numbers
  // have to reach the drag as props: the gesture runs on the UI thread and
  // cannot read a ref that JavaScript updates later. Settling costs one render
  // per row on first layout and nothing after, because a height that has not
  // changed is not written.
  const [heights, setHeights] = useState<Record<string, number>>({});

  const measure = useCallback((id: string, height: number) => {
    setHeights((current) =>
      Math.abs((current[id] ?? 0) - height) < 1 ? current : { ...current, [id]: height }
    );
  }, []);

  // How far the finger must travel to displace the neighbour in a direction.
  // Infinity at the ends of the list, which reads as "there is nothing there".
  const spaceFor = (index: number, direction: 1 | -1) => {
    const next = items[index + direction];
    // A sensible fallback for a row that has not laid out yet, so the first
    // drag after a mount still behaves.
    return next ? (heights[next.id] ?? 64) : Infinity;
  };

  const move = useCallback(
    (id: string, by: 1 | -1) => {
      const from = items.findIndex((i) => i.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= items.length) return;
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
          dragging={held === item.id}
          disabled={disabled}
          onMeasure={(h) => measure(item.id, h)}
          below={spaceFor(index, 1)}
          above={spaceFor(index, -1)}
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
  dragging,
  disabled,
  onMeasure,
  below,
  above,
  onHold,
  onRelease,
  onMove,
}: {
  children: React.ReactNode;
  dragging: boolean;
  disabled: boolean;
  onMeasure: (height: number) => void;
  /** The height of the row below and above, or Infinity at the ends. */
  below: number;
  above: number;
  onHold: () => void;
  onRelease: () => void;
  onMove: (by: 1 | -1) => void;
}) {
  const offset = useSharedValue(0);
  // Pixels already accounted for by moves made during THIS drag. Without it a
  // slow drag across two cards would fire the same single-step move repeatedly
  // and walk the card to the bottom of the list.
  const consumed = useSharedValue(0);

  const step = useCallback(
    (by: 1 | -1) => {
      onMove(by);
    },
    [onMove]
  );

  const drag = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(220)
    .onStart(() => {
      runOnJS(onHold)();
    })
    .onUpdate((e) => {
      const remaining = e.translationY - consumed.get();

      // Half of the neighbour is the moment the cards should swap: any less and
      // the list twitches, any more and it feels stuck.
      if (remaining > below / 2 && Number.isFinite(below)) {
        consumed.set(consumed.get() + below);
        runOnJS(step)(1);
      } else if (-remaining > above / 2 && Number.isFinite(above)) {
        consumed.set(consumed.get() - above);
        runOnJS(step)(-1);
      }

      offset.set(e.translationY - consumed.get());
    })
    .onFinalize(() => {
      consumed.set(0);
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
      <Animated.View
        onLayout={(e) => onMeasure(e.nativeEvent.layout.height)}
        style={[styles.row, style]}
      >
        {children}
      </Animated.View>
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
