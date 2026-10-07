import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlmanacEmptyState } from '@/components/almanac-empty-state';
import { MeProtocol } from '@/components/me-protocol';
import { SettingsLink } from '@/components/settings-link';
import { SpotlightScroll } from '@/components/spotlight-provider';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';
import { splitByTab, type AlmanacRow } from '@/lib/insights';
import { closeOpenSwipe } from '@/lib/open-swipe';
import { supabase } from '@/lib/supabase';

// ME, WHICH IS A TAB NOW (Ruth, 7 October 2026). Her nav revision: "Me replaces
// Almanac in the 5-tab nav. The Almanac stays, moved to More under Body Manual."
//
// WHY THAT IS THE RIGHT WAY ROUND, and it is her reasoning rather than mine. The
// Almanac is a record of what happened: symptoms, patterns, notes worth keeping.
// It is read when something prompts you to look back. Me is the reference you
// return to when you have drifted and need to re-anchor, and it is the thing
// every other screen is built from. One of those earns a tab. The other earns a
// place you can find.
//
// THE SWITCH IS GONE WITH IT. This screen used to be two views of one
// destination chosen by a control at the top, and the deck under the masthead
// could only ever be true of one of them - which was written down at the time as
// a compromise rather than a decision. A tab that is one thing needs no switch
// and its deck is simply true.
//
// Only ACTIVE entries are fetched, as before: a stale entry is not current
// reference material.

export const ME_EMPTY_HEADING = 'Nothing here yet';
export const ME_EMPTY_BODY =
  "When you settle on something in chat, like a supplement, a skincare routine or a weekly call, I'll offer to keep it here with the reason why.";

export default function MeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [rows, setRows] = useState<AlmanacRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Bumped when a card is deleted or edited below, so the screen re-reads
  // itself. useFocusEffect alone does not cover it: the change happens while
  // this screen is already focused, so focus never changes.
  const [reloadKey, setReloadKey] = useState(0);

  // REFETCHES ON FOCUS, not only on mount. This is a TAB: it mounts once and
  // stays mounted, so a card saved from Chat afterwards never appeared until the
  // app was reloaded. Found on device 2026-09-10, with the row in the database
  // the whole time.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        // RLS scopes this to the signed-in user, so no explicit user_id filter.
        const { data, error } = await supabase
          .from('almanac_entries')
          .select('id, kind, title, category, content, created_at, updated_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (!cancelled) {
          // On error, fall through to the empty view rather than an error
          // screen: a warm "nothing here yet" is a far better wrong answer than
          // a failure message on a tab somebody just tapped.
          setRows((error ? [] : (data ?? [])) as unknown as AlmanacRow[]);
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
      // reloadKey is not read inside this callback, and that is the point: it
      // changing is what makes the effect run again after a delete.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey])
  );

  const byTab = splitByTab(rows);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Scrolling closes an open swipe (Ruth, item 2). */}
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={closeOpenSwipe}
          contentContainerStyle={styles.content}
        >
          <SpotlightScroll scrollRef={scrollRef}>
            <ThemedText type="display">Me</ThemedText>

            {/* THE DECK IS NOW SIMPLY TRUE. It used to be shown only on the Me
                half of a two-view screen, because these words would have been
                untrue over Insights. There is no Insights here to be untrue
                over. */}
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: -Spacing.two }}>
              Your own record. How you have decided to look after yourself, and why.
            </ThemedText>

            {loaded && (
              <SpotlightTarget id="almanac.me">
                {byTab.me.length > 0 ? (
                  // A protocol, not a list: sections that came into being by
                  // their first card arriving, and a why behind each one. See
                  // me-protocol.tsx.
                  <MeProtocol
                    entries={byTab.me}
                    onDeleted={() => setReloadKey((k) => k + 1)}
                    onChanged={() => setReloadKey((k) => k + 1)}
                  />
                ) : (
                  <AlmanacEmptyState heading={ME_EMPTY_HEADING} body={ME_EMPTY_BODY} />
                )}
              </SpotlightTarget>
            )}
          </SpotlightScroll>
        </ScrollView>

        <SettingsLink />
      </SafeAreaView>
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
