import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlmanacDetail, type DetailEntry } from '@/components/almanac-detail';
import { ReportLink } from '@/components/report-link';
import { AlmanacEmptyState } from '@/components/almanac-empty-state';
import { GoalsBlock } from '@/components/goals-block';
import { LogPlanSheet, minutesFromPlan, type PlanToLog } from '@/components/log-plan-sheet';
import { MoveSheet } from '@/components/move-sheet';
import { LogWeekSheet, type WeekLogItem } from '@/components/log-week-sheet';
import { RulesView } from '@/components/rules-view';
import { SegmentedTabs, type SegmentedTabItem } from '@/components/segmented-tabs';
import { SkillsView } from '@/components/skills-view';
import { WeekView } from '@/components/week-view';
import { MovementLibrary } from '@/components/movement-library';
import { SettingsLink } from '@/components/settings-link';
import { SpotlightScroll } from '@/components/spotlight-provider';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, PageInset, Spacing } from '@/constants/theme';
import { splitByTab, type AlmanacRow } from '@/lib/insights';
import { closeOpenSwipe } from '@/lib/open-swipe';
import { supabase } from '@/lib/supabase';
import { currentWeekStart, daysOfWeek, weekRange } from '@/lib/week';
import { dayKeyOf, isWalking, logMatchesPlan, placedOnDays } from '@/lib/week-plan';
import { moveToDays } from '@/lib/week-move';

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

// THE ORDER IS THE ORDER OF ZOOM, not of importance: the week, then the
// sessions inside it, then the skills those sessions build, then the rules that
// constrain all three. Rules is last and is not therefore least - it is the one
// segment whose contents are enforced in code, and its own view says so loudly.
type PlanView = 'week' | 'sessions' | 'skills' | 'rules';

const PLAN_VIEWS: readonly SegmentedTabItem<PlanView>[] = [
  { id: 'week', label: 'Week' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'skills', label: 'Skills' },
  { id: 'rules', label: 'Rules' },
];

export default function PlansScreen() {
  const router = useRouter();
  // WEEK FIRST ON ARRIVAL. "What am I following?" is answered by the rhythm, and
  // the individual sessions are what you go looking for afterwards.
  const [view, setView] = useState<PlanView>('week');
  // The single-activity log sheet, and the whole-week one.
  const [loggingPlan, setLoggingPlan] = useState<PlanToLog | null>(null);
  const [weekSheet, setWeekSheet] = useState<WeekLogItem[] | null>(null);
  // "MOVE TO…" OPENS FROM THE TAP SHEET, so it is owned here rather than
  // inside the week: the log sheet is this screen's, and a sheet cannot open
  // a sibling sheet that belongs to someone else.
  const [movingPlan, setMovingPlan] = useState<PlanToLog | null>(null);
  // Bumped after anything writes, so the week reloads its ticks and its days.
  const [weekKey, setWeekKey] = useState(0);
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

  // LOGGING GOES WHERE EVERY OTHER MOVEMENT LOG GOES - activity_logs, the same
  // table the chat parser and the Activity sheet write to - so a session logged
  // from Plans appears in Log > Movement, in the roundup and in the Health
  // Flower without anything else being taught about it.
  //
  // `source` says where it came from, which is the one thing a row from here
  // has that a typed one does not.
  async function writeLog(input: {
    activity: string;
    when: Date;
    minutes: number | null;
    note: string;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('not signed in');
    // NOON ON THE DAY, not midnight. A log stored at 00:00 lands on the
    // previous day for anyone behind UTC, and this is a date she picked
    // deliberately rather than a moment that happened.
    const at = new Date(input.when);
    at.setHours(12, 0, 0, 0);
    const { error } = await supabase.from('activity_logs').insert({
      user_id: user.id,
      activity_type: input.activity,
      duration_min: input.minutes,
      happened_at: at.toISOString(),
      source: 'plan',
      notes: input.note || null,
    });
    if (error) throw new Error(error.message);
    setWeekKey((k) => k + 1);
  }

  // WHAT THE WEEK SHEET OFFERS: every planned day of this week, with the ones
  // already logged marked so they are not offered twice.
  async function openWeekSheet() {
    const start = currentWeekStart();
    const { startISO, endISO } = weekRange(start);
    const [planRes, logRes, profileRes] = await Promise.all([
      supabase
        .from('user_week')
        .select('id, activity, duration, days, days_chosen_at')
        .order('sort_order'),
      supabase
        .from('activity_logs')
        .select('activity_type, happened_at')
        .gte('happened_at', startISO)
        .lt('happened_at', endISO),
      // THE SAME QUESTION THE WEEK ASKS. Under "Let me lead" a plan has no day
      // until she gives it one, so this sheet must not offer Thursday for
      // something the week itself is showing in Anytime.
      supabase.from('user_profile').select('guidance_mode').maybeSingle(),
    ]);
    const guidance =
      (profileRes.data as { guidance_mode: string | null } | null)?.guidance_mode ?? null;
    const logs = (logRes.data ?? []) as { activity_type: string | null; happened_at: string }[];
    const items: WeekLogItem[] = [];
    for (const row of (planRes.data ?? []) as {
      id: string;
      activity: string;
      duration: string | null;
      days: string[];
      days_chosen_at: string | null;
    }[]) {
      if (isWalking(row.activity)) continue; // counted by the phone, not logged here
      const sits = placedOnDays(guidance, row);
      for (const date of daysOfWeek(start)) {
        if (!sits.includes(dayKeyOf(date))) continue;
        const already = logs.some(
          (l) =>
            logMatchesPlan(l.activity_type ?? '', row.activity) &&
            new Date(l.happened_at).toDateString() === date.toDateString()
        );
        items.push({
          planId: row.id,
          activity: row.activity,
          duration: row.duration,
          date,
          alreadyLogged: already,
        });
      }
    }
    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    setWeekSheet(items);
  }
  const openEntry: DetailEntry | null = rows.find((r) => r.id === openId) ?? null;

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
            <ThemedText type="display">Plans</ThemedText>

            {/* ABOVE THE CONTROL, AND ON EVERY SEGMENT. A goal is the reason
                the rest of this screen exists, so it is not something to
                scroll to and not something that disappears when you look at
                your rules. */}
            <GoalsBlock />

            {/* FOUR SEGMENTS, the same control Log and Almanac use (Ruth's
                session brief). Week and Sessions are deliberately separate
                objects rather than two views of one - a cadence, and a thing
                to do - which is what keeps a single Tuesday from existing
                twice. */}
            <SegmentedTabs items={PLAN_VIEWS} value={view} onChange={setView} />

            {view === 'week' && (
              <WeekView
                reloadKey={weekKey}
                onLogPlan={setLoggingPlan}
                onLogWeek={() => void openWeekSheet()}
                onChanged={() => setWeekKey((k) => k + 1)}
              />
            )}

            {view === 'sessions' && loaded && (
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
            {view === 'sessions' && loaded && plans.length > 0 && (
              <ReportLink start={['plans']} label="Build a report from these" />
            )}

            {view === 'skills' && <SkillsView onOpenSession={setOpenId} />}

            {view === 'rules' && <RulesView />}
          </SpotlightScroll>
        </ScrollView>

        {loggingPlan && (
          <LogPlanSheet
            plan={loggingPlan}
            onClose={() => setLoggingPlan(null)}
            onLog={writeLog}
            onMove={() => {
              // ONE SHEET AT A TIME. Two Modals open together is a stack
              // nobody can get out of on Android's back button.
              setMovingPlan(loggingPlan);
              setLoggingPlan(null);
            }}
          />
        )}

        {movingPlan && (
          <MoveSheet
            activity={movingPlan.activity}
            days={movingPlan.days}
            weekDays={daysOfWeek(currentWeekStart())}
            onClose={() => setMovingPlan(null)}
            onPick={(picked) => {
              const plan = movingPlan;
              setMovingPlan(null);
              if (!plan) return;
              void (async () => {
                try {
                  await moveToDays(plan.id, picked);
                } finally {
                  // Reload either way: on success to show the move, on failure
                  // to show that it did not happen.
                  setWeekKey((k) => k + 1);
                }
              })();
            }}
          />
        )}

        {weekSheet !== null && (
          <LogWeekSheet
            items={weekSheet}
            onClose={() => setWeekSheet(null)}
            onLog={async (chosen) => {
              // ONE AT A TIME RATHER THAN ONE INSERT, so a single failure does
              // not silently drop the rest. The sheet reports the failure and
              // the ones that did land stay landed.
              for (const item of chosen) {
                await writeLog({
                  activity: item.activity,
                  when: item.date,
                  minutes: minutesFromPlan(item.duration),
                  note: '',
                });
              }
            }}
          />
        )}

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
