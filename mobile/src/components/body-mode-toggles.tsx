import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MODE_LABEL,
  MODE_ORDER,
  toggleHint,
  withToggle,
  type BodyMode,
} from '@/lib/body-mode';

// THE FOUR CHOICES, ONCE (4 October 2026).
//
// Ruth asked for the same control in setup, on Today and in the Body Manual, and
// for it to write ONE record. The record was solved first - user_profile.body_mode
// - and the control was still two hand-written copies of four <Toggle> blocks,
// one on Today and one about to be written for setup.
//
// THAT IS THE SHAPE OF EVERY DRIFT THIS WEEK. Two protein targets came from one
// sum called from five places with a defaulted argument. Eleven Body Manual rows
// ignored a redo because the fix was written inside one of them. "Get stronger"
// kept setting a surplus on one screen after being removed from the model. None of
// those were hard problems; they were one behaviour expressed twice.
//
// So this knows nothing about where it is. It holds no state, reads nothing, saves
// nothing: it is handed a mode and gives back the next one. Today saves on the tap
// because Today has no Continue; setup saves on Continue because it does. That is
// the only difference between the two screens, and it is the one that belongs to
// them rather than to the switches.
//
// -- SWITCHES BECAME MARKS, 21 October 2026 ------------------------------------
//
// Ruth, on the Now artwork: "The toggles can be replaced by the dots along the
// left side, chatgpt was right, the toggles were feeling too techy."
//
// NOTHING ELSE CHANGED, AND THAT WAS THE INSTRUCTION. Ruth, after being told
// that the four are not all the same kind of choice: "keep the exact
// functionality of the toggles but with the visual picker just changing to
// dots, exactly the same, multiple selection and greyed out moments as before."
//
// SO IT IS FOUR DOTS, knowing what that costs. Lose fat, Maintain and Gain are
// one pick - withToggle turns the other two off. Build muscle stands alone and
// can be on WITH any of them, deliberately: body-mode.ts says "Build alone gets
// a small surplus, Maintain + Build does not". So two dots can be filled at
// once, which a radio-shaped mark does not usually mean. Her call, made with
// that in front of her.
//
// THE SEMANTICS STAY HONEST EVEN THOUGH THE MARK DOES NOT. The row still
// announces itself as a checkbox when it is one and a radio when it is one, so
// somebody using a screen reader is told which taps clear the others - which is
// the reading where guessing from a shape is not an option.

export function BodyModeToggles({
  mode,
  onChange,
  disabled,
}: {
  mode: BodyMode;
  /** The whole next mode, with the exclusivity rule already applied. */
  onChange: (next: BodyMode) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <>
      {MODE_ORDER.map((key, i) => {
        // THE RULE LIVES IN THE LIBRARY, not in the dimming. A disabled control
        // is a courtesy; withToggle enforces the same thing on the data, because
        // the data is what the figures are read from.
        const hint = toggleHint(mode, key);
        const off = disabled === true || hint != null;
        const on = mode[key];
        // Build muscle is the one that stands alone; everything before it is
        // the single pick. toggleHint returns null for it precisely because
        // nothing can ever block it.
        const standsAlone = key === 'buildMuscle';
        return (
          <Fragment key={key}>
            {/* A RULE BETWEEN EVERY CHOICE, as the artwork draws it - and the
                one above Build muscle is doing a second job, because that is
                where the single pick ends and the separate choice begins. */}
            {i > 0 ? (
              <View style={[styles.rule, { backgroundColor: theme.background }]} />
            ) : null}
            <Pressable
              onPress={() => onChange(withToggle(mode, key, !on))}
              disabled={off}
              accessibilityRole={standsAlone ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on, disabled: off }}
              accessibilityLabel={hint ? `${MODE_LABEL[key]}. ${hint}` : MODE_LABEL[key]}
              style={({ pressed }) => [styles.row, pressed && !off && styles.pressed]}
            >
              <View
                style={[
                  styles.mark,
                  { borderColor: on ? theme.accentDeep : theme.textSecondary },
                  off && styles.faded,
                ]}
              >
                {on ? <View style={[styles.dot, { backgroundColor: theme.accentDeep }]} /> : null}
              </View>
              <View style={styles.words}>
                <ThemedText type="small" style={off ? styles.faded : undefined}>
                  {MODE_LABEL[key]}
                </ThemedText>
                {/* THE LINE UNDER THE LABEL IS EITHER WHY IT IS OFF OR THAT IT
                    IS THE ONE IN USE. Both are facts about the state; neither
                    is advice about which to pick. */}
                {hint ? (
                  <ThemedText type="detail" themeColor="textSecondary">
                    {hint}
                  </ThemedText>
                ) : on && !standsAlone ? (
                  <ThemedText type="detail" themeColor="textSecondary">
                    You&apos;re currently using this approach
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          </Fragment>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, paddingVertical: Spacing.two },
  // THE MARK IS A TOUCH TARGET'S WORTH OF ROW, not a 22pt circle somebody has
  // to hit: the whole row is the control, and this only has to be seen.
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    // Nudged down so the ring sits on the label's x-height rather than its
    // ascender, which is where a circle beside text looks centred.
    marginTop: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  words: { flexShrink: 1, gap: 1 },
  rule: { height: 1, opacity: 0.6 },
  faded: { opacity: 0.45 },
  pressed: { opacity: 0.6 },
});
