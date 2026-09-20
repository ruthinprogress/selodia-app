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
        <ThemedText type="small" themeColor="textSecondary" textBreakStrategy="simple">
          {label}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', paddingTop: Spacing.four, paddingBottom: Spacing.two },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  pressed: { opacity: 0.6 },
});
