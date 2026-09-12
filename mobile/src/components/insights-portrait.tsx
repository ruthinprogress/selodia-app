import { useFocusEffect } from 'expo-router';
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

export function InsightsPortrait() {
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
          <HealthFlower coverage={flower.coverage} size={PORTRAIT_FLOWER_SIZE} />
        )}
      </View>
      <ThemedText themeColor="textSecondary" style={styles.statement}>
        {PORTRAIT_EMPTY}
      </ThemedText>
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
  statement: {
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
});
