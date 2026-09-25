import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExportLink } from '@/components/data-export-link';
import { MonthYearPicker } from '@/components/month-year-picker';
import { QuickLogBar } from '@/components/quick-log-bar';
import { ReadingInterpretationNote } from '@/components/reading-interpretation';
import { ReportLink } from '@/components/report-link';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
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
    () => resolveTrackedMetrics(stored, allPersonal.map((p) => p.metric_name)).filter((m) => !m.hidden),
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
      values: { metric: TrackedMetric; text: string }[];
      at: string | null;
    }[] = [];
    for (const date of daysOfWeek(weekStart)) {
      const key = toLocalDateKey(date);
      const values: { metric: TrackedMetric; text: string }[] = [];
      let newest: string | null = null;
      for (const m of metrics) {
        const onDay = readingsFor(m, weekScale, weekPersonal).filter(
          (r) => toLocalDateKey(new Date(r.at)) === key
        );
        if (onDay.length === 0) continue;
        values.push({ metric: m, text: onDay[0].text });
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
      <Ionicons name={metric.icon as never} size={18} color={theme.accentDeep} style={styles.icon} />
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

// ONE DAY. Collapsed it is the date and the day's figures on one line; tapping
// opens the same figures with their names, and the time they were logged.
function DayRow({
  date,
  values,
  at,
  rule,
  expanded,
  onToggle,
}: {
  date: Date;
  values: { metric: TrackedMetric; text: string }[];
  at: string | null;
  rule: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const summary = values.map((v) => v.text).join('   ');

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${shortDay(date)}. ${summary}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={[styles.row, rule && { borderTopWidth: 1, borderTopColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
          {shortDay(date)}
        </ThemedText>
        <View style={styles.figures}>
          {expanded ? (
            <>
              {values.map((v) => (
                <View key={v.metric.key} style={styles.expandedRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.expandedLabel}>
                    {v.metric.label}
                  </ThemedText>
                  <ThemedText type="smallBold">{v.text}</ThemedText>
                </View>
              ))}
              {loggedAt(at) ? (
                <ThemedText type="detail" themeColor="textSecondary">
                  {loggedAt(at)}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText type="small">{summary}</ThemedText>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={theme.textSecondary}
          style={styles.chevron}
        />
      </View>
    </Pressable>
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
            <Ionicons name={r.metric.icon as never} size={18} color={theme.accentDeep} style={styles.icon} />
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
  // Takes the slack, and may shrink - see the note in overview-panel about
  // what a flex child does without minWidth.
  figures: { flex: 1, minWidth: 0, gap: 2 },
  change: { minWidth: 56, textAlign: 'right' },
  chevron: { marginTop: 2 },
  expandedRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  expandedLabel: { flex: 1 },
  pressed: { opacity: 0.7 },
});
