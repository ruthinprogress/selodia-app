import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ExportLink } from '@/components/data-export-link';
import { MetricMark } from '@/components/metric-mark';
import { MonthYearPicker } from '@/components/month-year-picker';
import { QuickLogBar } from '@/components/quick-log-bar';
import { ReadingInterpretationNote } from '@/components/reading-interpretation';
import { ReportLink } from '@/components/report-link';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WhatYouBurn } from '@/components/what-you-burn';
import { Spacing } from '@/constants/theme';
import { useBurnFigures } from '@/hooks/use-burn-figures';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { deleteReading, deleteReadingMessage } from '@/lib/delete-reading';
import { useTheme } from '@/hooks/use-theme';
import type { MeasurementRow } from '@/lib/overview-metrics';
import { supabase } from '@/lib/supabase';
import {
  changeLabel,
  readTrackedMetrics,
  readingsFor,
  resolveTrackedMetrics,
  type MetricReading,
  type PersonalRow,
  type TrackedMetric,
} from '@/lib/tracked-metrics';
import { addWeeks, currentWeekStart, daysOfWeek, toLocalDateKey, weekLabel, weekRange } from '@/lib/week';

// MEASUREMENTS (Ruth, 25 September 2026, items 11-14), rebuilt to her written
// spec and in the row style Today uses - her words on the mockups: "Your
// variant one was nice, perhaps use the Today rows approach to keep it less
// like lots of filled squares."
//
// WHAT THIS REPLACES. A weekly grid of Day / Weight / Body fat / Muscle with a
// "7d" percentage under every cell and an eye icon on every row, and beneath
// it a SECOND table for tape measurements. Four filled blocks stood between
// the top of the screen and the first number. Her note: it is "totally out of
// sync visually with the rest of the app".
//
// NOTHING HERE NAMES A METRIC. Item 11: "Remove hardcoded metrics and the
// separate scale / tape measure sections. The user chooses which metrics they
// track." Every section below walks the same list and asks it where its values
// come from - see lib/tracked-metrics.ts. Weight is not special in this file.
//
// THREE SECTIONS, IN HER ORDER: Latest, History, Then & now. Then the two
// links. The week stepper and the month picker stay, because "a list of
// previous days" on its own cannot reach last March.
//
// DATES ARE "4 Jul 2026" AND "Thu 24" (item 13), never ISO. Built by hand for
// the same reason week.ts is: Hermes on Android ships a variable ICU build, so
// toLocaleDateString can return a different string on a different phone.

/** How far the row slides to uncover its mark. */
const SWIPE_OPEN = 56;

/** The comparison reaches outside the week, so the query has to as well. */
const LOOKBACK_DAYS = 12;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** "Thu 24", for a history row. */
function shortDay(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

/** "4 Jul 2026", for anything that names a date in full. */
export function longDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Logged 8:13 am", or null when nothing is known about the time. */
function loggedAt(at: string | null): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (isNaN(d.getTime())) return null;
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? 'am' : 'pm';
  h = h % 12 === 0 ? 12 : h % 12;
  return `Logged ${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

// HOW ONE READING IS REMOVED (Ruth, 26 September 2026, having looked at four).
//
// She chose the third: a mark on every line once a day is open, and the day
// row itself swipes left to clear the lot. The visible marks stay whatever the
// gesture does, which is her standing rule - "Good call keeping a visible one
// for my demographic."
//
// WHAT A DELETE ACTUALLY REMOVES is the part worth knowing; see
// lib/delete-reading.ts. The old eye-icon control was blunter than it looked:
// it deleted a whole scale row, so removing "Thursday's weight" took the body
// fat and muscle measured in the same moment with it. A mark on a line clears
// one column and only removes the row when the last figure in it goes.
//
// "Eventually we will need to decide on one uniform system across the whole
// app, this stage is experimentation with best flows." So this is a candidate
// for the Food log, the Movement log and the drinks list, which currently do
// it three different ways.

export function MeasurementsView({ initialWeekStart }: { initialWeekStart?: Date }) {
  const [weekStart, setWeekStart] = useState<Date>(initialWeekStart ?? currentWeekStart());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [ackShowing, setAckShowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Everything, for the metric list and for Then & now; and the displayed
  // week, for History. Two reads rather than one because they answer different
  // questions: "what does she track" is about all of time, "what happened this
  // week" is about seven days.
  const [stored, setStored] = useState<TrackedMetric[] | null>(null);
  const [allScale, setAllScale] = useState<MeasurementRow[]>([]);
  const [allPersonal, setAllPersonal] = useState<PersonalRow[]>([]);
  const [weekScale, setWeekScale] = useState<MeasurementRow[]>([]);
  const [weekPersonal, setWeekPersonal] = useState<PersonalRow[]>([]);

  useFocusReload(setReloadKey);
  // Same key, so a weight logged from the bar above moves the burn figures too.
  const burn = useBurnFigures(reloadKey);

  const weekKey = toLocalDateKey(weekStart);
  const isPresent = weekKey === toLocalDateKey(currentWeekStart());

  // The list, and the whole history it is read against. RLS scopes every read.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { data: scale }, { data: personal }] = await Promise.all([
        supabase.from('user_profile').select('tracked_metrics').maybeSingle(),
        supabase
          .from('body_measurements')
          .select('id, measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
          .order('measured_at', { ascending: false })
          .limit(400),
        supabase
          .from('personal_metrics')
          .select('metric_name, value, unit, measured_at, created_at')
          .order('created_at', { ascending: false })
          .limit(400),
      ]);
      if (cancelled) return;
      setStored(readTrackedMetrics((profile as { tracked_metrics?: unknown } | null)?.tracked_metrics));
      setAllScale((scale ?? []) as MeasurementRow[]);
      setAllPersonal((personal ?? []) as PersonalRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // The displayed week.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      const from = new Date(new Date(startISO).getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
      const [{ data: scale }, { data: personal }] = await Promise.all([
        supabase
          .from('body_measurements')
          .select('id, measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
          .gte('measured_at', from)
          .lt('measured_at', endISO),
        supabase
          .from('personal_metrics')
          .select('metric_name, value, unit, measured_at, created_at')
          .gte('created_at', from)
          .lt('created_at', endISO),
      ]);
      if (cancelled) return;
      setWeekScale((scale ?? []) as MeasurementRow[]);
      setWeekPersonal((personal ?? []) as PersonalRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart; weekStart is deliberately not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, reloadKey]);

  const metrics = useMemo(
    () =>
      resolveTrackedMetrics(
        stored,
        allPersonal.map((p) => ({ name: p.metric_name, unit: p.unit }))
      ).filter((m) => !m.hidden),
    [stored, allPersonal]
  );

  // Latest, and the change since the one before it.
  const latest = useMemo(
    () =>
      metrics
        .map((m) => ({ metric: m, readings: readingsFor(m, allScale, allPersonal) }))
        .filter((x) => x.readings.length > 0),
    [metrics, allScale, allPersonal]
  );

  // History: one row per DAY THAT HAS ENTRIES. Her spec: "Days with no entries
  // are not shown." Seven rows of dashes was the old table's doing, because a
  // table has to draw every row; a list does not.
  const days = useMemo(() => {
    const out: {
      key: string;
      date: Date;
      // Each value carries the moment it was recorded, because that is how a
      // single reading is found again when somebody asks for it to go.
      values: { metric: TrackedMetric; text: string; at: string }[];
      at: string | null;
    }[] = [];
    for (const date of daysOfWeek(weekStart)) {
      const key = toLocalDateKey(date);
      const values: { metric: TrackedMetric; text: string; at: string }[] = [];
      let newest: string | null = null;
      for (const m of metrics) {
        const onDay = readingsFor(m, weekScale, weekPersonal).filter(
          (r) => toLocalDateKey(new Date(r.at)) === key
        );
        if (onDay.length === 0) continue;
        values.push({ metric: m, text: onDay[0].text, at: onDay[0].at });
        if (!newest || onDay[0].at > newest) newest = onDay[0].at;
      }
      if (values.length > 0) out.push({ key, date, values, at: newest });
    }
    return out.reverse();
  }, [metrics, weekScale, weekPersonal, weekStart]);

  return (
    <ThemedView style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        Track the measurements that matter to you.
      </ThemedText>

      {/* The log input, as now: text goes to ask-selodia exactly as the Chat
          composer's does. There is no measurement parser here and no
          measurement route - the conversation does the work, and a reading
          logged from this bar is indistinguishable downstream from one typed
          in Chat. */}
      <QuickLogBar
        kind="measurement"
        onLogged={() => setReloadKey((k) => k + 1)}
        onNoteChange={setAckShowing}
      />

      {/* What the latest reading means. Anchored to the latest reading rather
          than to the displayed week, so it stays put while somebody steps back
          through history: it is a statement about now, not about the week on
          screen. */}
      <ReadingInterpretationNote hidden={ackShowing} />

      {/* LATEST. One row per metric she tracks, in Today's row style: the mark,
          the name, the figure, and the change since the entry before it. No
          placeholder dashes - a metric with one reading says nothing about
          change rather than showing a nought. */}
      {latest.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="sectionTitle">Latest</ThemedText>
          <View>
            {latest.map(({ metric, readings }, i) => (
              <MetricRow key={metric.key} metric={metric} readings={readings} rule={i > 0} />
            ))}
          </View>
        </View>
      ) : null}

      {/* HISTORY. The week stepper, then a row per day that has entries. */}
      <View style={styles.section}>
        <View style={styles.historyHead}>
          <ThemedText type="sectionTitle">History</ThemedText>
          <View style={styles.weekBar}>
            <Step label="‹" hint="Previous week" onPress={() => setWeekStart(addWeeks(weekStart, -1))} />
            {/* The one far-jump entry point. Ordinary browsing never needs it -
                week stepping is the calm default - so it is one quiet control
                on the label rather than a persistent picker. */}
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Jump to another month"
              hitSlop={Spacing.two}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="small" themeColor="textSecondary">
                {weekLabel(weekStart)}
              </ThemedText>
            </Pressable>
            <Step
              label="›"
              hint="Next week"
              disabled={isPresent}
              onPress={() => setWeekStart(addWeeks(weekStart, 1))}
            />
          </View>
        </View>

        {!isPresent ? (
          <Pressable
            onPress={() => setWeekStart(currentWeekStart())}
            accessibilityRole="button"
            accessibilityLabel="Back to today"
            hitSlop={Spacing.two}
            style={({ pressed }) => [styles.backToToday, pressed && styles.pressed]}
          >
            <ThemedText type="small" themeColor="accentDeep">
              Back to today
            </ThemedText>
          </Pressable>
        ) : null}

        {loading ? (
          <ThemedText type="small" themeColor="textSecondary">
            …
          </ThemedText>
        ) : days.length === 0 ? (
          // Sparse and empty are the normal cases early on, so the empty state
          // is the primary path here. It says what is missing without implying
          // anybody has fallen behind.
          <ThemedText type="small" themeColor="textSecondary">
            {isPresent
              ? 'No readings this week yet. Tell me a measurement any time and it lands here.'
              : 'Nothing was recorded this week.'}
          </ThemedText>
        ) : (
          <View>
            {days.map((d, i) => (
              <DayRow
                key={d.key}
                date={d.date}
                values={d.values}
                at={d.at}
                rule={i > 0}
                expanded={openDay === d.key}
                onToggle={() => setOpenDay((k) => (k === d.key ? null : d.key))}
                onDeleted={() => setReloadKey((k) => k + 1)}
              />
            ))}
          </View>
        )}
      </View>

      <MonthYearPicker
        visible={pickerOpen}
        initial={weekStart}
        onCancel={() => setPickerOpen(false)}
        onSelect={(ws) => {
          setWeekStart(ws);
          setPickerOpen(false);
        }}
      />

      <ThenAndNow metrics={metrics} scale={allScale} personal={allPersonal} />

      {/* WHAT YOU BURN. Her item 12 lists the sections this screen has and
          this is not among them - but she never asked for it to go, and the
          last thing she said about it (16 September) was that it was too
          HIDDEN at the foot of the Activity screen.

          It very nearly vanished. It moved off Today this morning to make room
          for the Health Flower, onto this screen; this screen was then rebuilt
          from her written spec tonight, and a spec that does not mention
          something is not a spec that removes it. For a few hours it was in
          the app in no place at all, which is the exact fault this codebase
          keeps a list of: an absent thing presenting as a working one.

          Here rather than anywhere else because BMR comes off these readings -
          the scale's own, when it takes one. Collapsed it is a single row. */}
      <WhatYouBurn figures={burn} />

      {/* A report first, the takeout second. Somebody browsing their weeks is
          far more often preparing for an appointment than backing up, and the
          two links say plainly which is which. */}
      <ReportLink start={['body', 'metrics']} label="Build a report from this" />
      <SpotlightTarget id="measurements.export">
        <ExportLink />
      </SpotlightTarget>
    </ThemedView>
  );
}

// ONE METRIC'S LATEST. The mark, the name, the figure, and what it has done
// since the entry before it.
function MetricRow({
  metric,
  readings,
  rule,
}: {
  metric: TrackedMetric;
  readings: MetricReading[];
  rule: boolean;
}) {
  const theme = useTheme();
  const change = changeLabel(readings, metric.unit);
  const when = readings[0] ? new Date(readings[0].at) : null;
  const isToday = when ? toLocalDateKey(when) === toLocalDateKey(new Date()) : false;
  const trailing = [change, when && !isToday ? longDate(when) : null].filter(Boolean).join('   ');

  return (
    <View style={[styles.row, rule && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected }]}>
      <View style={styles.icon}>
        <MetricMark metric={metric} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {metric.label}
      </ThemedText>
      <View style={styles.figures}>
        <ThemedText type="smallBold">{readings[0]?.text}</ThemedText>
        {/* The change and the date, muted, under the figure. Nothing at all
            when there is no previous entry to compare with, and no date when
            the reading is today's - a date on today's own number is noise. */}
        {trailing ? (
          <ThemedText type="detail" themeColor="textSecondary">
            {trailing}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The quiet mark that removes something, at whichever level it is offered.
 *
 * MODULE LEVEL, not inside the row. A component defined during a render is a
 * different type every render, so React throws the old one away and mounts a
 * new one - losing its state and its focus. It was written inline first and
 * the lint rule caught it.
 *
 * `cross` draws the tiny x she recognised from elsewhere in the app rather than
 * a bin; see variant 4.
 */
function DeleteMark({
  label,
  onPress,
  working,
  cross = false,
  size = 17,
}: {
  label: string;
  onPress: () => void;
  working: boolean;
  cross?: boolean;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={working}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Spacing.two}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {working ? (
        <ThemedText type="detail" themeColor="accentDeep">
          {'\u2026'}
        </ThemedText>
      ) : (
        <Ionicons
          name={cross ? 'close-circle-outline' : 'trash-outline'}
          size={size}
          color={cross ? theme.textSecondary : theme.accentDeep}
        />
      )}
    </Pressable>
  );
}

// ONE DAY, in whichever of the three shapes is being looked at.
//
// WHAT A DELETE ACTUALLY REMOVES is the whole question here - see
// lib/delete-reading.ts. A day can hold five readings living in two different
// shapes underneath, so "delete this line" means one thing on a weight and
// another on a waist, and the old eye-icon control was blunter than it looked:
// it removed a scale row entire, taking the body fat and muscle measured in
// the same moment with it.
function DayRow({
  date,
  values,
  at,
  rule,
  expanded,
  onToggle,
  onDeleted,
}: {
  date: Date;
  values: { metric: TrackedMetric; text: string; at: string }[];
  at: string | null;
  rule: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const summary = values.map((v) => v.text).join('   ');

  const removeOne = async (v: { metric: TrackedMetric; at: string }) => {
    if (busy) return;
    setBusy(v.metric.key);
    setFailed(null);
    const outcome = await deleteReading(v.metric, v.at);
    setBusy(null);
    if (outcome.done) onDeleted();
    else setFailed(deleteReadingMessage(v.metric, outcome));
  };

  const removeDay = async () => {
    if (busy) return;
    setBusy('day');
    setFailed(null);
    // One at a time, because two of them can be columns of the same row and
    // the second has to see what the first left behind.
    for (const v of values) {
      const outcome = await deleteReading(v.metric, v.at);
      if (!outcome.done) {
        setBusy(null);
        setFailed(deleteReadingMessage(v.metric, outcome));
        return;
      }
    }
    setBusy(null);
    onDeleted();
  };

  const toChat = (prefill: string) => router.push({ pathname: '/', params: { prefill } });

  // NOT ONE BUTTON WRAPPING EVERYTHING. The row was a single Pressable with
  // marks inside it, which is a button inside a button: React refuses it on the
  // web - "<button> cannot contain a nested button" - and a screen reader
  // cannot offer the inner one at all. It took three goes to get right, because
  // the first fix left the expanded detail nested and the second reintroduced
  // the fault in the swipe wrapper. The shape below cannot have the problem:
  // the opener holds nothing interactive, and everything pressable is its
  // sibling.
  const row = (
    <View style={[styles.row, rule && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${shortDay(date)}. ${summary}`}
        style={({ pressed }) => [expanded ? styles.dayLabelOnly : styles.dayOpener, pressed && styles.pressed]}
      >
        <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
          {shortDay(date)}
        </ThemedText>
        {!expanded ? (
          <View style={styles.figures}>
            <ThemedText type="small">{summary}</ThemedText>
          </View>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.figures}>
          {values.map((v) => (
            <View key={v.metric.key} style={styles.expandedRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.expandedLabel}>
                {v.metric.label}
              </ThemedText>
              <ThemedText type="smallBold">{v.text}</ThemedText>
              {/* A MARK PER LINE, which is what she asked for: it removes THIS
                  reading and nothing measured beside it. */}
              <DeleteMark
                label={`Delete ${v.metric.label} from ${shortDay(date)}`}
                onPress={() => void removeOne(v)}
                working={busy === v.metric.key}
              />
            </View>
          ))}

          {loggedAt(at) ? (
            <ThemedText type="detail" themeColor="textSecondary">
              {loggedAt(at)}
            </ThemedText>
          ) : null}

          {failed ? (
            <ThemedText type="detail" themeColor="danger">
              {failed}
            </ThemedText>
          ) : null}

          {/* ONE CHAT MARK, NOT TWO NAMED LINKS (Ruth, 26 September 2026).
              She first said "edit shouldn't replace 'Ask about this' - how can
              we make sure to show the user they can ask questions about entries
              as well as just edit", and then, better: "How about just the chat
              icon".

              She is right twice over. BOTH things open the conversation -
              there is no form for a measurement, because the conversation is
              the only thing that writes one - so two links were two doors into
              one room, and calling either of them "Edit" promised a form that
              does not exist AND implied the only reason to open an entry is to
              fix it. A record you can only correct is a filing cabinet.

              ONE DOOR, BUT NAMED. Her next thought was "Or is that too vague
              for the user...?" and it was - a bare chat bubble says "talk",
              which is exactly the thing an unlabelled icon cannot make
              discoverable, and making asking discoverable was the whole point.
              So the chat mark keeps a short label and the bin does not, because
              a bin explains itself and a speech bubble does not say what you
              might say into it.

              "ASK ABOUT OR CHANGE THIS" IS HERS, and the verb is the whole
              reason it works. She tried "Ask about this, or edit" first, and
              EDIT is the word that cannot go here: it promises a form with
              fields, and there is no form anywhere in this app for a
              measurement. CHANGE promises only that the thing can be changed,
              which is true, and says nothing about how - which is right,
              because the how is a sentence you type.

              The prefill leans neither way: she finishes it with a question or
              a correction, whichever she came for. */}
          <View style={styles.rowActions}>
            <Pressable
              onPress={() => toChat(`About my measurements from ${shortDay(date)}: `)}
              accessibilityRole="button"
              accessibilityLabel={`Ask about or change the readings from ${shortDay(date)}`}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.editLink, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.accentDeep} />
              <ThemedText type="detail" themeColor="accentDeep">
                Ask about or change this
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => void removeDay()}
              disabled={busy != null}
              accessibilityRole="button"
              accessibilityLabel={`Delete everything from ${shortDay(date)}`}
              hitSlop={Spacing.three}
              style={({ pressed }) => pressed && styles.pressed}
            >
              {busy === 'day' ? (
                <ThemedText type="detail" themeColor="accentDeep">
                  {'…'}
                </ThemedText>
              ) : (
                <Ionicons name="trash-outline" size={17} color={theme.accentDeep} />
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* The chevron is its own control, and it is the way back out of an
          opened row - the opener above holds only the date once the row is
          open, so there has to be something obvious to press. */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Close ${shortDay(date)}` : `Open ${shortDay(date)}`}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
    </View>
  );

  return (
    <SwipeableDay onDelete={() => void removeDay()} label={`Delete everything from ${shortDay(date)}`}>
      {row}
    </SwipeableDay>
  );
}


// The day row's swipe, in the shape swipe-to-delete.tsx established: the row
// translates whole, the mark sits behind it, and the mark is a tap.
//
// A REAL GESTURE, NOT A LONG PRESS ON A PRESSABLE. The first version wrapped
// the row in a Pressable to catch a long press, which put a button around a
// row that already contains buttons - the same nesting fault as the row
// itself, reintroduced by the fix for it. A GestureDetector draws a plain View
// and has no such problem, and it is also what the rest of the app does.
function SwipeableDay({
  children,
  onDelete,
  label,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  label: string;
}) {
  const theme = useTheme();
  const x = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const settle = useCallback((next: boolean) => setOpen(next), []);

  const pan = Gesture.Pan()
    // Only once it is clearly sideways: a vertical scroll must still scroll and
    // a tap must still reach the row.
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const from = open ? -SWIPE_OPEN : 0;
      x.set(Math.min(0, Math.max(-SWIPE_OPEN, from + e.translationX)));
    })
    .onEnd(() => {
      const shouldOpen = x.get() < -SWIPE_OPEN / 2;
      x.set(withSpring(shouldOpen ? -SWIPE_OPEN : 0, { damping: 18, stiffness: 180 }));
      runOnJS(settle)(shouldOpen);
    });

  const sliding = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const revealed = useAnimatedStyle(() => ({ opacity: x.get() < -1 ? 1 : 0 }));

  return (
    <View>
      <Animated.View style={[styles.swipeBin, revealed]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable
          onPress={onDelete}
          disabled={!open}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.swipeHit, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={20} color={theme.accentDeep} />
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={sliding}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

// THEN & NOW. Her spec: "one line at the top with the two dates, then one row
// per configured metric: label, then -> now, change at the right."
//
// THE TWO DATES ARE THE FIRST AND LAST READINGS ANYBODY HAS, not a fixed
// window. "Then" is where their record starts, which is the comparison
// somebody actually wants when they open this - and it is honest about how
// long they have been keeping it.
function ThenAndNow({
  metrics,
  scale,
  personal,
}: {
  metrics: TrackedMetric[];
  scale: MeasurementRow[];
  personal: PersonalRow[];
}) {
  const theme = useTheme();

  const rows = metrics
    .map((m) => {
      const readings = readingsFor(m, scale, personal);
      // One reading is not a comparison. Nothing is shown rather than a row
      // comparing a number with itself.
      if (readings.length < 2) return null;
      const now = readings[0];
      const then = readings[readings.length - 1];
      return { metric: m, then, now, change: changeLabel([now, then], m.unit) };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (rows.length === 0) return null;

  const spanFrom = rows.reduce((a, r) => (r.then.at < a ? r.then.at : a), rows[0].then.at);
  const spanTo = rows.reduce((a, r) => (r.now.at > a ? r.now.at : a), rows[0].now.at);

  return (
    <View style={styles.section}>
      <ThemedText type="sectionTitle">Then &amp; now</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {longDate(new Date(spanFrom))} → {longDate(new Date(spanTo))}
      </ThemedText>
      <View>
        {rows.map((r, i) => (
          <View
            key={r.metric.key}
            style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected }]}
          >
            <View style={styles.icon}>
              <MetricMark metric={r.metric} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {r.metric.label}
            </ThemedText>
            <View style={styles.figures}>
              <ThemedText type="smallBold">
                {r.then.text} → {r.now.text}
              </ThemedText>
            </View>
            {r.change ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.change}>
                {r.change}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Step({
  label,
  hint,
  onPress,
  disabled,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={Spacing.two}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedText type="smallBold" themeColor={disabled ? 'textSecondary' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  // Straight under the page title, tight to it, so the two read as one block.
  subtitle: { marginTop: -Spacing.two },
  section: { gap: Spacing.two },
  historyHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  historyTitle: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.three },
  weekBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  backToToday: { alignSelf: 'flex-start' },
  // NO CARD FILL ANYWHERE ON THIS SCREEN ("less like lots of filled squares").
  // A hairline between rows is the whole structure, as it is on Today.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: 11,
  },
  icon: { width: 20, marginTop: 1 },
  label: { width: 84 },
  dayLabel: { width: 56 },
  // The part of the row that opens it: everything but the marks and the
  // chevron, which are its siblings rather than its children.
  dayOpener: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  // Takes the slack, and may shrink - see the note in overview-panel about
  // what a flex child does without minWidth.
  figures: { flex: 1, minWidth: 0, gap: 2 },
  change: { minWidth: 56, textAlign: 'right' },
  chevron: { marginTop: 2 },
  // The opener once the row is open: just the date, holding nothing pressable.
  dayLabelOnly: { flexDirection: 'row' },
  expandedRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  expandedLabel: { flex: 1 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowActions: { flexDirection: 'row', gap: Spacing.four, paddingTop: Spacing.one },
  marks: { flexDirection: 'row', gap: Spacing.four, paddingVertical: 2 },
  swipeBin: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_OPEN,
  },
  swipeHit: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
