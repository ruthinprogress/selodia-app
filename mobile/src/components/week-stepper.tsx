import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addWeeks, currentWeekStart, weekLabel } from '@/lib/week';

// ‹ 19-25 OCT ›, IN ONE PLACE RATHER THAN TWO (Ruth, 24 October 2026).
//
// Her artwork puts the week stepper inside the Daily average card. The app had
// it below, inside day-log.tsx, where all three logs - food, movement,
// measurements - share one copy.
//
// SO IT MOVED RATHER THAN BEING COPIED, and her instruction says exactly why:
// "they stay connected though so when the week gets scrolled back the logs
// underneath go with it, like it does already." A second stepper drawn in the
// card would have its own idea of which week it was, and the card and the days
// beneath it would disagree - which is the bug, not the layout.
//
// The state never moved: weekStart and onWeekStart still live on the screen,
// and both the card and the list are handed the same pair. This file is only
// the control.

export function WeekStepper({
  weekStart,
  onWeekStart,
  /** True when `weekStart` is the week we are living in: forward is then spent. */
  isPresent,
  /** Opens the month picker, where a screen has one. */
  onJump,
}: {
  weekStart: Date;
  onWeekStart: (d: Date) => void;
  isPresent: boolean;
  onJump?: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Step label="‹" hint="Previous week" onPress={() => onWeekStart(addWeeks(weekStart, -1))} />

      {onJump ? (
        <Pressable
          onPress={onJump}
          accessibilityRole="button"
          accessibilityLabel="Jump to another month"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="small" themeColor="textSecondary">
            {weekLabel(weekStart)}
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {weekLabel(weekStart)}
        </ThemedText>
      )}

      {/* HOLD IT DOWN TO COME BACK TO TODAY (Ruth, 24 October 2026): "long
          press on the forward arrow makes the arrow enlarge and takes you to
          todays page."

          It is the right control for it. Somebody four weeks back taps forward
          four times to get home, and the arrow they are already pressing is
          the one that means "later". Holding it means "all the way".

          IT CANNOT CLASH WITH THE TAP, because the arrow is spent in the
          present week - the only time a jump to today does nothing is the only
          time the control is disabled. */}
      <Step
        label="›"
        hint="Next week"
        disabled={isPresent}
        onPress={() => onWeekStart(addWeeks(weekStart, 1))}
        onLongPress={() => onWeekStart(currentWeekStart())}
        longPressHint="Back to this week"
      />
    </View>
  );
}

function Step({
  label,
  hint,
  onPress,
  onLongPress,
  longPressHint,
  disabled,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  onLongPress?: () => void;
  longPressHint?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  // THE ARROW GROWS WHILE IT IS HELD, which is the whole of the feedback she
  // asked for. A long press with no sign that it registered reads as a tap
  // that failed, and the next thing somebody does is tap again.
  const scale = useRef(new Animated.Value(1)).current;
  const [held, setHeld] = useState(false);

  const grow = useCallback(
    (to: number) => {
      Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    },
    [scale]
  );

  return (
    <Pressable
      onPress={onPress}
      onLongPress={
        onLongPress
          ? () => {
              setHeld(false);
              grow(1);
              onLongPress();
            }
          : undefined
      }
      onPressIn={onLongPress ? () => { setHeld(true); grow(1.6); } : undefined}
      onPressOut={onLongPress ? () => { setHeld(false); grow(1); } : undefined}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityHint={longPressHint}
      hitSlop={Spacing.three}
      style={({ pressed }) => pressed && !held && styles.pressed}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <ThemedText
          type="small"
          style={{ color: disabled ? theme.backgroundSelected : theme.accentDeep }}
        >
          {label}
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.three },
  pressed: { opacity: 0.6 },
});
