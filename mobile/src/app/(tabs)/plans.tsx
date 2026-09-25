import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlmanacDetail, type DetailEntry } from '@/components/almanac-detail';
import { ReportLink } from '@/components/report-link';
import { AlmanacEmptyState } from '@/components/almanac-empty-state';
import { MovementLibrary } from '@/components/movement-library';
import { SettingsLink } from '@/components/settings-link';
import { SpotlightScroll } from '@/components/spotlight-provider';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';
import { splitByTab, type AlmanacRow } from '@/lib/insights';
import { supabase } from '@/lib/supabase';

// PLANS (2026-09-20), a destination of its own, from Ruth's navigation brief:
// "every tab should answer a different user question, with no overlap ...
// Plans: what am I intentionally following?"
//
// Nothing about a plan changes here - the library, the detail sheet, the
// sessions - only where it lives. It was the Almanac's Movement view, which
// made the Almanac answer two questions at once: what have we learned, and
// what am I following. Her distinction is the one worth keeping: "Plans = the
// future = intentions ... Almanac = the past = observations ... Completing a
// workout records an event in the Almanac, but the workout itself continues to
// live in Plans."

export const PLANS_EMPTY_HEADING = 'No plans yet';
export const PLANS_EMPTY_BODY =
  "Tell me in chat what you'd like to work towards, and we'll build a plan for it. It lives here once you've said yes to keeping it.";

export default function PlansScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [rows, setRows] = useState<AlmanacRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Bumped when a plan is deleted from the list, so the screen re-reads
  // itself. useFocusEffect alone does not cover it: the delete happens
  // while this screen is already focused, so focus never changes.
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data, error } = await supabase
          .from('almanac_entries')
          .select('id, kind, title, category, content, created_at, updated_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (!cancelled) {
          setRows((error ? [] : (data ?? [])) as unknown as AlmanacRow[]);
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    // reloadKey is not read inside this callback, and that is the point: it
    // changing is what makes the effect run again after a delete. The rule
    // cannot see a dependency used for its identity rather than its value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey])
  );

  // The same split the Almanac uses, so an entry is never in both places: what
  // lands in `movement` is a plan, and it is here.
  const plans = splitByTab(rows).movement;
  const openEntry: DetailEntry | null = rows.find((r) => r.id === openId) ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <SpotlightScroll scrollRef={scrollRef}>
            <ThemedText type="display">Plans</ThemedText>

            {loaded && (
              <SpotlightTarget id="almanac.movement">
                {plans.length > 0 ? (
                  // The library introduces itself (movement-library.tsx), so
                  // this screen does not say it a second time.
                  <MovementLibrary
                    entries={plans}
                    onOpen={setOpenId}
                    onDeleted={() => setReloadKey((k) => k + 1)}
                  />
                ) : (
                  <AlmanacEmptyState heading={PLANS_EMPTY_HEADING} body={PLANS_EMPTY_BODY} />
                )}
              </SpotlightTarget>
            )}
            {loaded && plans.length > 0 && (
              <ReportLink start={['plans']} label="Build a report from these" />
            )}
          </SpotlightScroll>
        </ScrollView>

        <AlmanacDetail
          entry={openEntry}
          onClose={() => setOpenId(null)}
          onEdit={(entry) => {
            setOpenId(null);
            // IT SENDS, AND THE PLAN GOES WITH IT (2026-09-20). Ruth: "Tap
            // through takes no card to chat." It filled the box with a half
            // sentence and nothing else, so the conversation had no idea which
            // plan she meant, and the thread later read as though she had
            // started talking about nothing. Now the turn carries the plan's
            // id: the line above the composer names it, and the reply is
            // written with the plan's own movements in front of it.
            router.push({
              pathname: '/',
              params: {
                prefill: `I'd like to update my "${entry.title}" plan.`,
                discussId: entry.id,
                discussType: 'plan',
                askNow: '1',
                seedTitle: entry.title,
              },
            });
          }}
        />
      </SafeAreaView>

      {/* OUTSIDE THE SCROLLER AND OUTSIDE THE SAFE AREA (Ruth, 25 September
          2026): the mark "must sit at the same fixed vertical position on every
          screen, flush top right, not relative to the page heading". It
          positions itself against the screen, so this is the one thing a screen
          has to get right - see settings-link.tsx. */}
      <SettingsLink />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: PageInset.horizontal,
    paddingTop: PageInset.top,
    paddingBottom: PageInset.bottom,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
});
