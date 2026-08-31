import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { entrySummary } from '@/lib/almanac-category';
import { isSeeded, type AlmanacEntryRow } from '@/lib/almanac-list';

// The Almanac category page (build item 15, UI slice 4 — Part Ten). "Workouts"
// is the worked example, but nothing here knows that name: this renders
// whichever category it is handed, because the set of categories is whatever
// the entries happen to carry. Hardcoding "Workouts" would turn an emergent
// field into a pre-built section, which is precisely what Part Ten rules out.
//
// SHAPE-DRIVEN, like almanac-detail.tsx. The per-entry summary comes from the
// shape of the content, never from `kind` — `kind` is open text (principle 13),
// so switching on it would rebuild the closed list. An entry whose shape is
// unrecognised simply shows its title and no summary, which reads as an entry
// with nothing extra to say rather than as a broken row.
//
// STATUS FILTERING IS CURRENTLY A NO-OP. The screen fetches `status = 'active'`
// and every entry is active forever: the `status`, `instance_count` and
// `last_confirmed_at` columns exist and are typed, but no code anywhere writes
// a transition, so nothing is ever marked stale or pending-reconfirmation. That
// mechanism is parked for its own session. Until it lands, a category page shows
// every entry that carries the category — do not read the filter as working, and
// do not work around it here.

export function AlmanacCategoryView({
  category,
  entries,
  onOpen,
  onBack,
}: {
  category: string;
  entries: AlmanacEntryRow[];
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to all Almanac entries"
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="link" style={styles.back}>
          ← All entries
        </ThemedText>
      </Pressable>

      <ThemedText type="smallBold" style={styles.heading}>
        {category}
      </ThemedText>

      {entries.length === 0 ? (
        // Reachable only if the last entry in a category is recategorised while
        // the page is open. Phrased as a state, not an error — and the way out
        // is the back control already above.
        <ThemedText type="small" themeColor="textSecondary">
          Nothing in {category} any more.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {entries.map((e) => {
            const summary = entrySummary((e as unknown as { content?: unknown }).content);
            return (
              <Pressable
                key={e.id}
                onPress={() => onOpen(e.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${e.title}`}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView type="backgroundElement" style={styles.row}>
                  <ThemedText type="small" style={styles.title}>
                    {e.title}
                  </ThemedText>
                  <View style={styles.meta}>
                    {/* Open text, rendered as written — see principle 13. */}
                    <ThemedText type="small" themeColor="textSecondary" style={styles.kind}>
                      {e.kind}
                    </ThemedText>
                    {summary && (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.kind}>
                        · {summary}
                      </ThemedText>
                    )}
                    {isSeeded((e as unknown as { content?: unknown }).content) && (
                      <ThemedText type="small" style={[styles.seeded, { color: theme.danger }]}>
                        seeded test data
                      </ThemedText>
                    )}
                  </View>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  back: { marginBottom: Spacing.half },
  heading: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.half,
  },
  list: { gap: Spacing.one },
  row: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  title: { fontWeight: '500' },
  meta: { flexDirection: 'row', gap: Spacing.one, alignItems: 'center', flexWrap: 'wrap' },
  kind: { fontSize: 11 },
  seeded: { fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
