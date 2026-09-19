import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { HealthFlower } from '@/components/health-flower';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHealthFlower } from '@/hooks/use-health-flower';

// Layer 1 of Insights: the living portrait (build spec, Part Ten, the Insights
// brief).
//
// THE FLOWER, LARGE AND GIVEN ROOM. The brief asks for more space than the Body
// tab gives it, because this is a reflective place rather than a dashboard. It
// is this week's flower, the same coverage the Body tab shows, from the same
// hook.
//
// BELOW IT, WITNESS STATEMENTS, OR A GENTLE PROMPT. The statements are written by
// the Sunday roundup, which is Insights slice 3 and not built yet. Until someone
// has roundups there is nothing honest to say about their last six weeks, so the
// portrait says that it is early, in Ruth's own words, and never shows a made-up
// picture (Ruth, 2026-09-12: "no fake data"). The "last 6 weeks" date range
// arrives with the statements it describes.
//
// STATIC, NOT ANIMATED (confirmed 2026-09-12): motion reads as reward, which is
// the register the Witness Principle rules out. The flower keeps its own gentle
// breathing at full bloom and nothing else moves.

export const PORTRAIT_EMPTY =
  "We're just getting started. Log a few weeks and we'll start to see your picture emerge.";

const PORTRAIT_FLOWER_SIZE = 230;

export type InsightsPortraitProps = {
  /** Written by the Sunday roundup, read from the newest roundup entry. */
  statements?: string[];
  /** The period they describe, as the roundup recorded it ("the last 6 weeks"). */
  range?: string | null;
};

export function InsightsPortrait({ statements = [], range = null }: InsightsPortraitProps) {
  const flower = useHealthFlower();
  const { reload } = flower;

  // The Almanac is a tab and stays mounted for the life of the app, so the week
  // is re-read whenever it comes back into view: a session logged in Chat has to
  // grow its petal here too. Not on the first focus, because the hook has only
  // just loaded it.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload])
  );

  return (
    <View style={styles.wrap}>
      {/* Height reserved whether or not the week has loaded, so the prompt
          beneath never jumps when the flower arrives. */}
      <View style={styles.flower}>
        {flower.coverage && (
          <HealthFlower
            coverage={flower.coverage}
            size={PORTRAIT_FLOWER_SIZE}
            // THE SAME PETALS AS TODAY'S, SO THEY DO THE SAME THING (Ruth's bug
            // list, item 5: "Tapping Strength or Cardio should show what fed that
            // petal; it does nothing"). This copy was drawn without the handler
            // the Today flower has always had. It opens the same detail screen,
            // which lives under Today - so the tap crosses to that tab, and back
            // returns there. One screen for what fed a petal, not two that drift.
            onSelectDimension={(d) =>
              router.push({ pathname: '/today/[dimension]', params: { dimension: d } })
            }
          />
        )}
      </View>
      {/* THE WIDTH LIMIT SITS ON A WRAPPER, NOT ON THE TEXT. Found on device
          2026-09-12: with maxWidth and centring on the Text itself, Android
          measured Comfortaa short by a line and dropped "picture emerge." off
          the end of Ruth's sentence. The wrapper holds the width, the text
          fills it, and the line height has a little room for Comfortaa's tall
          letters. */}
      <View style={styles.statementWrap}>
        {statements.length > 0 ? (
          <>
            {statements.map((line) => (
              <ThemedText key={line} style={styles.statement}>
                {line}
              </ThemedText>
            ))}
            {/* The period is stated, so the reflection is never mistaken for
                all of time or for this week alone (the brief asks for it). */}
            {range && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.range}>
                {range}
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.statement}>
            {PORTRAIT_EMPTY}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  flower: {
    height: PORTRAIT_FLOWER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statementWrap: {
    width: '100%',
    maxWidth: 320,
  },
  statement: {
    width: '100%',
    textAlign: 'center',
    lineHeight: 26,
  },
  // The period the statements describe, quieter than the statements themselves:
  // it is a label on the reflection, not part of it.
  range: {
    width: '100%',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
