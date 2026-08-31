import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlmanacCategoryView } from '@/components/almanac-category-view';
import { AlmanacEmptyState } from '@/components/almanac-empty-state';
import { AlmanacIntro } from '@/components/almanac-intro';
import { AlmanacDetail, type DetailEntry } from '@/components/almanac-detail';
import { AlmanacList } from '@/components/almanac-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { entriesInCategory } from '@/lib/almanac-category';
import { hasSeenAlmanacIntro, markAlmanacIntroSeen } from '@/lib/almanac-intro';
import { groupAlmanacEntries, type AlmanacEntryRow, type AlmanacGroup } from '@/lib/almanac-list';
import { supabase } from '@/lib/supabase';

// The Almanac destination (build item 15, UI slices 1-2): the empty state and
// the entry list. The detail view is slice 3.
//
// Only ACTIVE entries are fetched. A stale or pending-reconfirmation entry is
// not current reference material, and showing one as though it were would
// undercut the re-confirmation rule the lifecycle exists for (Part Ten).
export default function AlmanacScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<AlmanacGroup[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [entries, setEntries] = useState<DetailEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // The category page is a filtered view of what is already loaded, not a
  // second fetch - the rows are in memory, and refetching would make an
  // emergent field look like a route (Part Ten).
  const [rows, setRows] = useState<AlmanacEntryRow[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  // Starts false so the card can never flash before the stored flag is read.
  // The wrong default here would show the orientation for one frame to someone
  // who dismissed it months ago.
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes this to the signed-in user, so no explicit user_id filter.
      // Only active entries: a stale or pending-reconfirmation entry is not
      // something to browse as current reference (Part Ten, staleness).
      const { data, error } = await supabase
        .from('almanac_entries')
        .select('id, kind, title, category, content, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false });
      // Orientation is per-person, so it is keyed on the user rather than the
      // device — a shared device gives the next person their own introduction.
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? '';
      const seen = await hasSeenAlmanacIntro(userId);

      if (!cancelled) {
        setShowIntro(!seen);
        // On error, fall through to the empty state rather than an error
        // screen: a warm "nothing here yet" is a far better wrong answer than
        // a failure message on a tab someone just tapped.
        const rows = (error ? [] : (data ?? [])) as unknown as AlmanacEntryRow[];
        setEntryCount(rows.length);
        setRows(rows);
        setGroups(groupAlmanacEntries(rows));
        setEntries(rows as unknown as DetailEntry[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hidden immediately, persisted in the background. The card must never sit
  // there waiting on a write to finish - and if the write fails the only cost
  // is that the orientation appears once more, which almanac-intro.ts accepts
  // deliberately.
  const dismissIntro = () => {
    setShowIntro(false);
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user?.id) await markAlmanacIntroSeen(auth.user.id);
    })();
  };

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
            // The introduction sits ABOVE the empty state rather than replacing
            // it: one says what this place is, the other says why it is empty
            // and when it fills. Neither does the other's job.
            <>
              {showIntro && <AlmanacIntro onDismiss={dismissIntro} />}
              <AlmanacEmptyState />
            </>
          ) : category ? (
            <AlmanacCategoryView
              category={category}
              entries={entriesInCategory(rows, category)}
              onOpen={setOpenId}
              onBack={() => setCategory(null)}
            />
          ) : (
            <>
              {showIntro && <AlmanacIntro onDismiss={dismissIntro} />}
              <AlmanacList groups={groups} onOpen={setOpenId} onOpenCategory={setCategory} />
            </>
          )}
        </ScrollView>

        <AlmanacDetail
          entry={entries.find((e) => e.id === openId) ?? null}
          onClose={() => setOpenId(null)}
          // Editing is conversational, always (Part Ten): this hands the entry
          // to Chat with the opening line already written, rather than opening
          // any form. Unflump stays the only writer.
          onEdit={(entry) => {
            setOpenId(null);
            router.push({
              pathname: '/',
              params: { prefill: `I'd like to update my Almanac entry "${entry.title}" — ` },
            });
          }}
        />
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
