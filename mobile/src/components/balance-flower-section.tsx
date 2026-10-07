import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HealthFlower } from '@/components/health-flower';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHealthFlower } from '@/hooks/use-health-flower';
import { useTheme } from '@/hooks/use-theme';
import { weekObservation } from '@/lib/health-flower';
import { canGoBack, canGoForward, flowerRange, type FlowerMode } from '@/lib/flower-range';

// THE BALANCE FLOWER, ON THE ALMANAC (Ruth, 25 September 2026, item 8: "Remove
// the 'This week' heading and the balance flower chart from Today entirely.
// Today shows today only. Move the balance flower to Almanac > Insights as a
// 6-week rolling view").
//
// WHY THIS IS THE RIGHT HOME, and it is worth writing down because a morning
// went into keeping it on Today. The flower draws a PATTERN - which dimensions
// a body has been given, over time - and the Almanac is the tab for patterns:
// "Plans = the future = intentions ... Almanac = the past = observations."
// Today is a screen about today. The size fight that dominated this morning,
// the flower coming down from 200 to 158 to make room for a sentence, was the
// screen saying the section did not belong on it; I read it as a layout problem
// for several hours before she said so plainly.
//
// SIX WEEKS, NOT ONE, AND THE MATHS MOVED WITH IT. Coverage is a sum over a
// target, so six weeks of sessions against one week's target would fill every
// petal and the drawing would say nothing at all. The window scales the target
// too - see coverageFromRows.
//
// A SIX-WEEK FLOWER IS ALSO A KINDER ONE. A week is short enough that an
// ordinary busy week looks like a bare drawing; six weeks is long enough for a
// picture to be about somebody's life rather than about their last seven days.

// WEEK AND MONTH, EACH WITH A BACK AND A FORWARD (Ruth, 7 October 2026).
//
// Was a fixed six-week rolling view. Her revision, after I said a free custom
// range was the one genuinely new piece of work: "just do Week and Month ranges,
// each one has a back and forward button... the daily use flower is more
// bounded." The report builder keeps the custom range, where a date picker
// already exists.
//
// SIX WEEKS WAS CHOSEN FOR A REASON AND THE REASON SURVIVES. A week is short
// enough that an ordinary busy week looks like a bare drawing. That is now
// something she can see rather than something the app decided for her: the week
// view will look sparse on a quiet week, and the month view beside it will not.

export function BalanceFlowerSection() {
  const theme = useTheme();
  const [mode, setMode] = useState<FlowerMode>('week');
  const [back, setBack] = useState(0);
  // Rebuilt only when the choice changes, because the hook keys its read on the
  // two timestamps and a fresh Date every render would re-query forever.
  const range = useMemo(() => flowerRange(mode, back), [mode, back]);
  const { coverage, loading } = useHealthFlower(range);
  const note = coverage ? weekObservation(coverage, range.label) : null;

  const pick = (next: FlowerMode) => {
    setMode(next);
    // BACK TO NOW ON A SWITCH. Three weeks back and then tapping Month would
    // otherwise land on three months back, which is not what the tap asked for.
    setBack(0);
  };

  return (
    <View style={styles.wrap}>
      <ThemedText type="sectionTitle">Balance</ThemedText>

      <View style={styles.modes}>
        {(['week', 'month'] as FlowerMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => pick(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m }}
            accessibilityLabel={m === 'week' ? 'Show a week at a time' : 'Show a month at a time'}
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.mode, pressed && styles.pressed]}
          >
            <ThemedText type="small" themeColor={mode === m ? 'accentDeep' : 'textSecondary'}>
              {m === 'week' ? 'Week' : 'Month'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* THE WINDOW NAMES ITSELF BETWEEN ITS OWN ARROWS. Without the label a
          person paging back has no way to know where they are, and the drawing
          looks like it is changing for no reason. */}
      <View style={styles.pager}>
        <Pressable
          onPress={() => setBack((b) => b + 1)}
          disabled={!canGoBack(back)}
          accessibilityRole="button"
          accessibilityLabel={mode === 'week' ? 'The week before' : 'The month before'}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={canGoBack(back) ? theme.accentDeep : theme.backgroundSelected}
          />
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.rangeLabel}>
          {range.label}
        </ThemedText>

        <Pressable
          onPress={() => setBack((b) => Math.max(0, b - 1))}
          disabled={!canGoForward(back)}
          accessibilityRole="button"
          accessibilityLabel={mode === 'week' ? 'The week after' : 'The month after'}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canGoForward(back) ? theme.accentDeep : theme.backgroundSelected}
          />
        </Pressable>
      </View>

      {/* Nothing until the read returns. An unloaded window and an empty one
          are different things, and six absent petals popping into shape is the
          second telling a lie about the first. */}
      <View style={styles.flower}>
        {coverage ? (
          <HealthFlower
            coverage={coverage}
            size={SIZE}
            // Typed-routes form: the pathname is the file, the segment is a
            // param. Building the string by hand would not typecheck.
            onSelectDimension={(d) =>
              router.push({ pathname: '/now/[dimension]', params: { dimension: d } })
            }
          />
        ) : null}
      </View>

      {/* It names what led and stops - see weekObservation for why there is no
          second sentence recommending anything. */}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : !loading && coverage ? (
        /* A WINDOW WITH NOTHING IN IT SAYS SO. She can page back twelve of
           these, and most of them will be before she had the app. Silence here
           would read as the drawing being broken. */
        <ThemedText type="small" themeColor="textSecondary">
          Nothing logged in {range.label}.
        </ThemedText>
      ) : null}
    </View>
  );
}

// Bigger than it ever was on Today, which was the other half of the problem:
// there it was competing with a day's figures for a screen that does not
// scroll, and it lost twice in one morning. Here it has the room the approved
// drawing was designed at.
const SIZE = 220;

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  // Week and Month sit together as a pair of words rather than a control: the
  // tab's own switch is the only segmented thing on this screen and a second
  // one would read as a second level of navigation.
  modes: { flexDirection: 'row', gap: Spacing.three },
  mode: { paddingVertical: 2 },
  // The arrows hug the label rather than the screen edges, so the three read as
  // one object: back, where you are, forward.
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  rangeLabel: { minWidth: 120, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  flower: {
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
});
