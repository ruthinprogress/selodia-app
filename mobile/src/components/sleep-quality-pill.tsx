import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { QUALITY_LABEL, type SleepQuality } from '@/lib/sleep';

// HOW A NIGHT FELT, AS A PILL, COLOURED (Ruth's artwork, 23 October 2026).
//
// FOUR WORDS, AND SHE CHOSE THEM: Poor, Broken, OK, Good. Her two artworks
// disagreed - one offered Poor/OK/Good, the other showed Broken and Great in
// the history - and her answer kept Broken and dropped Great.
//
// KEEPING "BROKEN" IS THE INTERESTING PART. It is not a point on a scale
// between Poor and OK: it says the night was INTERRUPTED, which is a different
// complaint from short or unrefreshing, and it is the word she has used on six
// of her seven logged nights. A tidy four-step ladder - poor, ok, good, great -
// would have read better and lost the only thing her own record consistently
// says. The stored values already were poor|broken|ok|good, so nothing had to
// be migrated; only the label was wrong, showing "Rough" for poor.
//
// THE COLOUR IS THE APP'S, NOT A JUDGEMENT. Terracotta for the two that were
// hard, sand for OK, green for good. It marks a difference so a column of them
// can be read at a glance - it does not mark a pass or a fail, and nothing in
// the app ever tells her a night was wrong.

// THE THREE SURFACES ARE ALREADY IN THE PALETTE and no new colour is added:
// accentWash is the soft terracotta, sage the green, backgroundSelected the
// quiet sand. A screen that invents a colour for one pill is a screen that
// has stopped matching the rest of the app.
const TONE: Record<SleepQuality, 'accentWash' | 'backgroundSelected' | 'sage'> = {
  poor: 'accentWash',
  broken: 'accentWash',
  ok: 'backgroundSelected',
  good: 'sage',
};

export function QualityPill({ quality }: { quality: SleepQuality }) {
  return (
    <ThemedView type={TONE[quality]} style={styles.pill}>
      <ThemedText type="small">{QUALITY_LABEL[quality]}</ThemedText>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    alignSelf: 'flex-start',
  },
});
