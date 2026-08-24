import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlmanacEmptyState } from '@/components/almanac-empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// The Almanac destination (build item 15, UI slice 1). Slice 1 is the empty
// state only — the entry list and detail view follow.
//
// The count query is here rather than in slice 2 because the screen has to know
// which state to render, and asking for a count is cheaper than fetching rows it
// would then discard. It also means slice 2 adds the list without restructuring
// this.
export default function AlmanacScreen() {
  const [loading, setLoading] = useState(true);
  const [entryCount, setEntryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes this to the signed-in user, so no explicit user_id filter.
      const { count, error } = await supabase
        .from('almanac_entries')
        .select('id', { count: 'exact', head: true });
      if (!cancelled) {
        // On error, fall through to the empty state rather than an error
        // screen: a warm "nothing here yet" is a far better wrong answer than
        // a failure message on a tab someone just tapped.
        setEntryCount(error ? 0 : (count ?? 0));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.content, entryCount === 0 && styles.centred]}>
          <ThemedText type="title">Almanac</ThemedText>

          {loading ? (
            // Deliberately not a spinner: the count returns in milliseconds, and
            // a spinner would flash. Blank reads as calm; a flash reads as jank.
            <ThemedView style={styles.spacer} />
          ) : entryCount === 0 ? (
            <AlmanacEmptyState />
          ) : (
            // Slice 2 replaces this with the real list.
            <ThemedText type="small" themeColor="textSecondary">
              {entryCount} saved
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  centred: {
    justifyContent: 'center',
  },
  spacer: { height: Spacing.four },
});
