import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HealthFlower } from '@/components/health-flower';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHealthFlower } from '@/hooks/use-health-flower';
import { weekObservation } from '@/lib/health-flower';

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

/** The window. One number, named, because it appears in the drawing and the words. */
const WEEKS = 6;

export function BalanceFlowerSection() {
  const { coverage } = useHealthFlower(WEEKS);
  const note = coverage ? weekObservation(coverage, 'six weeks') : null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="sectionTitle">Balance</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The last six weeks, across the six dimensions.
      </ThemedText>

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
              router.push({ pathname: '/today/[dimension]', params: { dimension: d } })
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
  flower: {
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
});
