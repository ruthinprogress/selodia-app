import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AlmanacDetail, type DetailEntry } from '@/components/almanac-detail';
import { AlmanacEmptyState } from '@/components/almanac-empty-state';
import { AlmanacIntro } from '@/components/almanac-intro';
import { InsightsLog } from '@/components/insights-log';
import { InsightsPortrait } from '@/components/insights-portrait';
import { ReportLink } from '@/components/report-link';
import { SectionIntro } from '@/components/section-intro';
import { SettingsPage } from '@/components/settings-page';
import { hasSeenAlmanacIntro, markAlmanacIntroSeen } from '@/lib/almanac-intro';
import { splitByTab, type AlmanacRow } from '@/lib/insights';
import { portraitFrom } from '@/lib/roundup';
import { supabase } from '@/lib/supabase';

// THE ALMANAC, MOVED TO MORE (Ruth, 7 October 2026): "The Almanac stays, moved
// to More under Body Manual. It no longer holds the flower. It holds everything
// collected: symptoms, patterns and notes worth keeping."
//
// WHAT IT LOST, AND WHY EACH THING LEFT.
//
//   The Me half became its own tab, because Me is the reference every other
//   screen is built from and the Almanac is the record you look back at.
//
//   The flower went to Now, where a picture of a stretch of time belongs beside
//   the day it is part of. It had already lost its other copy on 7 October: the
//   portrait drew this week at 230 directly above a six-week flower, so the tab
//   opened on the harshest reading of her last seven days and showed the kinder
//   one a scroll later.
//
//   The switch went with the Me half. A screen that is one thing needs no
//   control to say which thing it is.
//
// WHAT IT KEPT is the whole of what she asked for: the witness statements from
// the newest roundup, the log of what she has noticed, and the way to turn that
// into a report somebody else can read.

export const ALMANAC_EMPTY_HEADING = 'Nothing noticed yet';
export const ALMANAC_EMPTY_BODY =
  "When something is worth keeping - a symptom, a pattern, a note - I'll offer to put it here, and it will be waiting for you.";

export default function AlmanacScreen() {
  const [rows, setRows] = useState<AlmanacRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Starts false so the card can never flash before the stored flag is read.
  const [showIntro, setShowIntro] = useState(false);
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
        const seen = await hasSeenAlmanacIntro();

        if (!cancelled) {
          setShowIntro(!seen);
          setRows((error ? [] : (data ?? [])) as unknown as AlmanacRow[]);
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey])
  );

  const byTab = splitByTab(rows);
  const portrait = portraitFrom(rows);
  const openEntry: DetailEntry | null = rows.find((r) => r.id === openId) ?? null;

  // Hidden immediately, persisted in the background: the card must never wait on
  // a write, and a failed write only means it appears once more.
  const dismissIntro = () => {
    setShowIntro(false);
    void markAlmanacIntroSeen();
  };

  return (
    <SettingsPage
      title="Almanac"
      subtitle="Everything collected: symptoms, patterns and notes worth keeping."
      footer="Your own record, in your own words."
    >
      {showIntro && <AlmanacIntro onDismiss={dismissIntro} />}

      {/* The witness statements are the newest roundup's, read from the entry
          itself, so they can never drift from the week that wrote them. No
          roundups yet means no statements, and the portrait says it is early
          rather than inventing a picture. */}
      <InsightsPortrait statements={portrait.statements} range={portrait.range} />

      {loaded && byTab.insights.length > 0 ? (
        <View>
          {/* The same block the Plans tab opens with, so the two places a person
              reads their own record introduce themselves the same way. */}
          <SectionIntro title={"What you've noticed"}>
            Symptoms, patterns and notes worth keeping.
          </SectionIntro>
          <InsightsLog
            rows={byTab.insights}
            onOpen={setOpenId}
            onDeleted={() => setReloadKey((k) => k + 1)}
          />
          {/* Her example, exactly: reading her symptoms and wanting to send them
              on. Both sources, because this one list holds symptoms and patterns
              together. */}
          <ReportLink start={['symptoms', 'insights']} label="Build a report from these" />
        </View>
      ) : loaded ? (
        <AlmanacEmptyState heading={ALMANAC_EMPTY_HEADING} body={ALMANAC_EMPTY_BODY} />
      ) : null}

      <AlmanacDetail
        entry={openEntry}
        onClose={() => setOpenId(null)}
        // Editing is conversational, always: this hands the entry to Chat with
        // the opening line already written, rather than opening any form.
        // Selodía stays the only writer.
        onEdit={(entry) => {
          setOpenId(null);
          router.push({
            pathname: '/',
            params: { prefill: `I'd like to update my Almanac entry "${entry.title}"... ` },
          });
        }}
      />
    </SettingsPage>
  );
}
