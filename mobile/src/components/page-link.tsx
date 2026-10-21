import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A QUIET WAY OUT OF A SCREEN, to somewhere else in the app.
//
// Ruth, 20 October 2026, with the Now artwork: the foot of the screen carries
// two of these - "Open your Week" and "Build a report" - and only the second
// one existed. The first was in the drawing and not in the app, which is the
// same gap as the missing "+" in Anytime: a route somebody is shown and cannot
// take.
//
// SEPARATE FROM report-link.tsx ON PURPOSE. That one carries a real argument
// about what a report IS and which records arrive ticked, and it has four
// rounds of clipping history written into it. This is the plain case: an icon,
// a few words, a route. Folding them together would mean either this one
// inherits an explanation it does not need, or that one loses one it does.
//
// IT CANNOT TRUNCATE, which is the one thing it does inherit, and for the
// reason report-link.tsx spells out: a single-line cap turns Android's short
// measurement into a visible lie - "Build a rep...", "Wee", "Open your". With
// nothing to truncate to, a bad measurement can only wrap, which shows every
// word. check-no-clipped-words.mjs holds it.

export function PageLink({
  to,
  label,
  icon,
}: {
  /** An expo-router path, exactly as the route is declared. */
  to: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push(to as never)}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Ionicons name={icon} size={15} color={theme.textSecondary} />
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
  row: { paddingVertical: Spacing.one },
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
