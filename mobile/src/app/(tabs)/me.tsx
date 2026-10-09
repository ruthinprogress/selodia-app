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

            {/* THE DECK WAS SAID TWICE (Ruth, 9 October 2026: "remove the first
                line in Me, it's a duplicate").

                Two subtitles sat here one under the other, both small, both
                secondary, saying the same thing in different words: this one,
                and me-protocol.tsx's "A living record of your health and the
                ways you choose to look after yourself." Each arrived
                separately - this one when Me stopped being half of a two-view
                screen and its deck could finally be simply true, that one two
                days earlier when the page was judged to have no deck of its
                own. Neither author could see the other's.

                Hers is the one that stays, in the module, because it belongs to
                the document that leaves the app rather than to the screen
                around it. KNOWN CONSEQUENCE: MeProtocol only renders when there
                is at least one card, so an empty Me tab now goes straight from
                the masthead to "Nothing here yet", which reads better than a
                subtitle promising a record that is not there. */}

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
