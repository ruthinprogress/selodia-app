import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A REPORT, FROM WHERE THE DATA IS (Ruth, 20 September 2026): "I'd also like
// Export to be discoverable throughout the app, not just buried in Settings. I
// may be looking at my symptoms and want to export them."
//
// WHAT IT IS NOT. It is not a second export. There is one builder, in Settings,
// and this opens it with the screen she is on already chosen - so the way out
// is the same door wherever she found it, and what she learns once about
// building a report is true everywhere. A screen-specific exporter would be a
// second answer to the same question, and the two would drift.
//
// IT PRE-FILLS AND NOTHING MORE. Landing with this screen's records ticked and
// the picker open is a starting point she can change, not a decision made for
// her: every tick is hers to clear, and the builder is the same builder. Her
// rule stands - the app selects nothing on its own judgement, it only starts
// where she already was.
//
// NOT CALLED "EXPORT", because this app already has one of those: "Get a copy
// of your data" is the whole takeout, every row, no choices - see
// data-export-link.tsx. This builds a document for somebody to read. Two
// different errands deserve two different words, and on the measurements
// screen they sit one above the other, so the words have to do the telling.
//
// IT IS QUIET, like the Settings link beside it. A person reading their own
// symptoms is reading, not exporting. One word, muted, at the end of the
// section rather than at the top of it - because the moment somebody wants to
// send this to a clinician is the moment after they have looked at it.

export function ReportLink({
  start,
  label = 'Build a report from this',
}: {
  /** Sources to tick on arrival, in the builder's own names. */
  start: string[];
  label?: string;
}) {
  const theme = useTheme();
  if (start.length === 0) return null;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() =>
          router.push({ pathname: '/settings/report', params: { start: start.join(',') } })
        }
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Ionicons name="document-text-outline" size={15} color={theme.textSecondary} />
        {/* IT CANNOT TRUNCATE, BECAUSE TRUNCATION IS THE BUG (Ruth, reported
            through the in-app button on 20 October 2026: "The word report in
            'build a report' is missing").

            THIS IS THE FOURTH TIME this family of fault has been fixed, and
            the first three were fixed by adjusting how it measures - remove
            alignItems, add flexShrink, set textBreakStrategy. Each held until
            it did not. "Wee" on the Plans tab is the same fault with a
            different word.

            There is no shortage of room: the row is the full width of the
            screen and the label is three short words. Android's measurement
            comes back short anyway, and `numberOfLines={1}` turns that bad
            measurement into a visible lie - "Build a rep...". So the ellipsis
            is gone. With nothing to truncate to, a bad measurement can only
            wrap, which shows every word and is a safe failure rather than a
            wrong one. */}
        <ThemedText
          type="small"
          themeColor="textSecondary"
          textBreakStrategy="simple"
          style={styles.label}
        >
          {label}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // NO alignItems: 'flex-start'. That sized this row to Android's measurement
  // of the label, which came back short, and "Build a report" was clipped to
  // "Build a" with no ellipsis to show for it (Ruth's screenshot, 7 October).
  // segmented-tabs.tsx has the same fault written up: "that is what Wee was".
  row: { paddingTop: Spacing.four, paddingBottom: Spacing.two },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'stretch' },
  // IT FILLS THE ROW RATHER THAN HUGGING ITS OWN MEASUREMENT (21 October
  // 2026, and this is the fifth report in this family).
  //
  // flexShrink: 1 was the fix on 20 October and it is not enough on its own:
  // it lets the box be narrower than the text, and the clip boundary is then
  // the measurement itself - which Android makes in the system face and draws
  // in Manrope, so it comes back short. segmented-tabs.tsx has the whole
  // write-up; the cure that held there was to stop the label being sized by
  // its own content.
  //
  // flex: 1 gives it everything left after the icon, so the boundary is the
  // page width. A short measurement can then only wrap, which shows every
  // word, and with no line cap there is nothing to truncate to.
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
