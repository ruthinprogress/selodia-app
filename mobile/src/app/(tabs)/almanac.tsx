import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlmanacDetail, type DetailEntry } from '@/components/almanac-detail';
import { AlmanacEmptyState } from '@/components/almanac-empty-state';
import { AlmanacIntro } from '@/components/almanac-intro';
import { AlmanacTabs } from '@/components/almanac-tabs';
import { ReportLink } from '@/components/report-link';
import { InsightsLog } from '@/components/insights-log';
import { InsightsPortrait } from '@/components/insights-portrait';
import { SpotlightScroll } from '@/components/spotlight-provider';
import { MeProtocol } from '@/components/me-protocol';
import { SectionIntro } from '@/components/section-intro';
import { SettingsLink } from '@/components/settings-link';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';
import { hasSeenAlmanacIntro, markAlmanacIntroSeen } from '@/lib/almanac-intro';
import { splitByTab, type AlmanacRow, type AlmanacTab } from '@/lib/insights';
import { portraitFrom } from '@/lib/roundup';
import { closeOpenSwipe } from '@/lib/open-swipe';
import { supabase } from '@/lib/supabase';

// The Almanac (build spec, Part Ten): what has been learned. Two views of one
// destination now - Insights and Me - chosen by a switch at the top.
//
// MOVEMENT LEFT ON 2026-09-20 for the Plans tab, and the screen is better for
// it: "Plans = the future = intentions ... Almanac = the past = observations."
// Insights shows the living portrait and the log; Me is her own reference,
// which stays here deliberately - it is accumulated knowledge, not
// configuration, and it is not going into Settings.
//
// The old single list grouped by category is gone, and the category page with
// it: categories were the previous design's way to organise, and the three
// views replace them.
//
// Only ACTIVE entries are fetched. A stale or pending-reconfirmation entry is
// not current reference material (the previous design's lifecycle rule, still
// held by the table).

// App copy approved by Ruth, 2026-09-12. Shown on the two views that can be
// empty, beneath the Almanac's shoot illustration.
// The plans that used to live here moved to their own tab on 2026-09-20 (see
// plans.tsx): the Almanac answers what we have learned, and a plan is what she
// intends to do. Their empty state moved with them.
export const ME_EMPTY_HEADING = 'Nothing here yet';
export const ME_EMPTY_BODY =
  "When you settle on something in chat, like a supplement, a skincare routine or a weekly call, I'll offer to keep it here with the reason why.";

export default function AlmanacScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<AlmanacTab>('insights');
  const [rows, setRows] = useState<AlmanacRow[]>([]);
  // Guards the first paint only. Not reset on a refocus: flipping it on every
  // return would blink the views away to reload something that has usually not
  // changed.
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Starts false so the card can never flash before the stored flag is read.
  const [showIntro, setShowIntro] = useState(false);
  // Bumped when an entry is deleted from one of the lists below, so the screen
  // re-reads itself. useFocusEffect alone does not cover it: the delete happens
  // while this screen is already focused, so focus never changes. Same shape as
  // plans.tsx, for the same reason.
  const [reloadKey, setReloadKey] = useState(0);

  // REFETCHES ON FOCUS, not only on mount. The Almanac is a TAB: it mounts once
  // and stays mounted, so an entry saved from Chat afterwards never appeared
  // until the app was reloaded. Found on device 2026-09-10, when the entry was
  // in the database the whole time.
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
        const seen = await hasSeenAlmanacIntro();

        if (!cancelled) {
          setShowIntro(!seen);
          // On error, fall through to the empty views rather than an error
          // screen: a warm "nothing here yet" is a far better wrong answer than
          // a failure message on a tab someone just tapped.
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
  const portrait = portraitFrom(rows);
  const openEntry: DetailEntry | null = rows.find((r) => r.id === openId) ?? null;

  // Hidden immediately, persisted in the background: the card must never wait
  // on a write, and a failed write only means it appears once more.
  const dismissIntro = () => {
    setShowIntro(false);
    void markAlmanacIntroSeen();
  };

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
            <ThemedText type="display">Almanac</ThemedText>

            {/* Two labels since the plans left (2026-09-20), and still allowed
                past the page margin: a switch is a control, not a sentence, and
                the margin exists so prose has room to breathe. */}
            <SpotlightTarget id="almanac.tabs" style={styles.tabs}>
              <AlmanacTabs value={tab} onChange={setTab} />
            </SpotlightTarget>

            {showIntro && <AlmanacIntro onDismiss={dismissIntro} />}

            {tab === 'insights' && (
              <>
                {/* The witness statements are the newest roundup's, read from the
                    entry itself, so they can never drift from the week that
                    wrote them. No roundups yet means no statements, and the
                    portrait says it is early rather than inventing a picture. */}
                <InsightsPortrait statements={portrait.statements} range={portrait.range} />
                {loaded && byTab.insights.length > 0 && (
                  <SpotlightTarget id="almanac.insights">
                    {/* The same block the Plans tab opens with, so the two
                        places a person reads their own record introduce
                        themselves the same way. */}
                    <SectionIntro title={"What you've noticed"}>
                      Symptoms, patterns and notes worth keeping.
                    </SectionIntro>
                    <InsightsLog
                      rows={byTab.insights}
                      onOpen={setOpenId}
                      onDeleted={() => setReloadKey((k) => k + 1)}
                    />
                  </SpotlightTarget>
                )}
                {/* Her example, exactly: reading her symptoms and wanting to
                    send them on. Both sources, because this one list holds
                    symptoms and patterns together. */}
                {loaded && byTab.insights.length > 0 && (
                  <ReportLink start={['symptoms', 'insights']} label="Build a report from these" />
                )}
              </>
            )}

            {tab === 'me' && loaded && (
              <SpotlightTarget id="almanac.me">
                {byTab.me.length > 0 ? (
                  // A protocol, not a list: sections that came into being by
                  // their first card arriving, and a why behind each one. See
                  // me-protocol.tsx.
                  <MeProtocol entries={byTab.me} onDeleted={() => setReloadKey((k) => k + 1)} />
                ) : (
                  <AlmanacEmptyState heading={ME_EMPTY_HEADING} body={ME_EMPTY_BODY} />
                )}
              </SpotlightTarget>
            )}
          </SpotlightScroll>
        </ScrollView>

        <AlmanacDetail
          entry={openEntry}
          onClose={() => setOpenId(null)}
          // Editing is conversational, always: this hands the entry to Chat with
          // the opening line already written, rather than opening any form.
          // Selodia stays the only writer.
          onEdit={(entry) => {
            setOpenId(null);
            // Fills the box rather than sending: an insight or a Me card has no
            // card to post in the thread, so there would be nothing to show.
            // Plans do send, and carry the plan - see plans.tsx.
            router.push({
              pathname: '/',
              params: { prefill: `I'd like to update my Almanac entry "${entry.title}"... ` },
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
  // The switch is allowed past the page margin; see where it is used.
  // The switch spans about 88% of the screen rather than the text column
  // (2026-09-18). A page margin is for prose; a control this central to the
  // screen looks like a standard mobile component when it is only as wide as
  // its own words.
  // Inside the page margin again (2026-09-20). The negative margin was bought
  // for three labels; with two, it pushed the switch off both edges of the
  // screen.
  tabs: { marginHorizontal: 0 },
  content: {
    // Horizontal padding matches the Body screens at 24; vertical stays at 16.
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
