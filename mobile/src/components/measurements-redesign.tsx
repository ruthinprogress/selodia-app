import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExportLink } from '@/components/data-export-link';
import { LogInChatHint } from '@/components/log-in-chat-hint';
import { MonthYearPicker } from '@/components/month-year-picker';
import { QuickLogBar } from '@/components/quick-log-bar';
import { ReadingInterpretationNote } from '@/components/reading-interpretation';
import { ReportLink } from '@/components/report-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThenAndNowTable } from '@/components/then-and-now';
import { CardRadius, Spacing } from '@/constants/theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';
import {
  buildMeasurementDays,
  loggedAtLabel,
  summaryLine,
  type MeasurementDay,
  type PersonalMetricRow,
} from '@/lib/measurement-days';
import type { MeasurementRow } from '@/lib/overview-metrics';
import { supabase } from '@/lib/supabase';
import { addWeeks, currentWeekStart, daysOfWeek, toLocalDateKey, weekLabel, weekRange } from '@/lib/week';

// MEASUREMENTS, REDESIGNED (Ruth, 25 September 2026, from her mockup and the
// brief beside it: "redesign the Measurements screen to align with the same
// structure, tone and visual language as the Food & Drink screen ... clean,
// calm and consistent with the Selodia brand").
//
// THREE ARRANGEMENTS, SO SHE CAN LOOK RATHER THAN IMAGINE. Everything in the
// brief is in all three - title and subtitle, week stepping, a prominent Today
// card, the days behind it, Then & now, and the two links. They differ on the
// three things the brief left genuinely open, which are the three worth
// choosing between:
//
//   1  AS DRAWN      a line icon beside every metric, filled Today card,
//                    history as day cards that expand.
//   2  TYPOGRAPHIC   no icons at all. Today as open rows on cream with one
//                    hairline, which is what the Today screen became this
//                    morning and what the app's own "no clutter" rule asks for.
//   3  THE WEEK      Today card as in 1, but the days below stay a WEEK you can
//                    scan down rather than cards you open one at a time.
//
// TWO CORRECTIONS TO THE BRIEF, both stated to her rather than quietly applied:
//
//   - it asks for "Comfortaa for UI text". The app's body face is MANROPE, and
//     has been since 18 September - her own words, that it "seems to fit so
//     much more in without feeling bloated". Comfortaa is not in the app.
//   - it asks for a "botanical watercolour accent", which the mockup draws
//     behind the header. Nothing in Selodia is watercolour: the droplet and the
//     flower are flat SVG. Adding one would mean generating an illustration,
//     which is a standing no.
//
// WHY THE SCALE AND THE TAPE MEASURE MERGE HERE - see lib/measurement-days.ts.
// The 27 August decision to split them was about a TABLE's permanent empty
// columns, and a card has no columns.
export type MeasurementsVariant = 1 | 2 | 3;

const LOOKBACK_DAYS = 12;

export function MeasurementsRedesign({ variant }: { variant: MeasurementsVariant }) {
  const theme = useTheme();
  const [weekStart, setWeekStart] = useState<Date>(currentWeekStart());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [ackShowing, setAckShowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<MeasurementRow[]>([]);
  const [personal, setPersonal] = useState<PersonalMetricRow[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  useFocusReload(setReloadKey);

  const weekKey = toLocalDateKey(weekStart);
  const isPresent = weekKey === toLocalDateKey(currentWeekStart());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      const from = new Date(new Date(startISO).getTime() - LOOKBACK_DAYS * 86_400_000);
      // RLS scopes both reads to the signed-in person.
      const [{ data: rows }, { data: pm }] = await Promise.all([
        supabase
          .from('body_measurements')
          .select('id, measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
          .gte('measured_at', from.toISOString())
          .lt('measured_at', endISO)
          .order('measured_at', { ascending: false }),
        supabase
          .from('personal_metrics')
          .select('metric_name, value, unit, measured_at, created_at')
          .gte('created_at', from.toISOString())
          .lt('created_at', endISO),
      ]);
      if (cancelled) return;
      setReadings((rows ?? []) as MeasurementRow[]);
      setPersonal((pm ?? []) as PersonalMetricRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, reloadKey]);

  const days = useMemo(
    () => buildMeasurementDays(daysOfWeek(weekStart), readings, personal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekKey, readings, personal]
  );

  // Today is drawn on its own, so it is never also in the list below it.
  const todayKey = toLocalDateKey(new Date());
  const today = days.find((d) => d.dayKey === todayKey) ?? null;
  const history = days.filter((d) => d.dayKey !== todayKey);

  const icons = variant !== 2;

  return (
    <ThemedView style={styles.wrap}>
      {/* The brief's line, and it does a job the old screen had nobody doing:
          it says these are HER metrics, chosen, rather than a fixed set the app
          requires. */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        Track the measurements that matter to you.
      </ThemedText>

      {/* WEEK STEPPING STAYS. The brief's history is "a list of previous days",
          which on its own loses the ability to go back through months - and the
          month picker with it. Stepping is the calm default (Part Five) and the
          label is still the one far-jump entry point. */}
      <View style={styles.weekBar}>
        <Step label="‹" hint="Previous week" onPress={() => setWeekStart(addWeeks(weekStart, -1))} />
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Jump to another month"
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.weekLabel}>
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

      {/* TODAY, PROMINENT. Variant 2 draws it open on cream rather than as a
          filled block - the same move the Today screen made this morning, where
          two filled tiles became a line of figures under a hairline. */}
      {isPresent ? (
        <TodayBlock
          open={variant === 2}
          icons={icons}
          day={today}
          onLogged={() => setReloadKey((k) => k + 1)}
          onNoteChange={setAckShowing}
        />
      ) : null}

      <ReadingInterpretationNote hidden={ackShowing} />

      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          …
        </ThemedText>
      ) : history.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {isPresent
            ? 'Nothing else recorded this week yet. Tell me a measurement any time and it lands here.'
            : 'Nothing was recorded this week.'}
        </ThemedText>
      ) : (
        <View style={styles.section}>
          <ThemedText type="sectionTitle">History</ThemedText>
          {variant === 3 ? (
            // THE WEEK AS ONE OBJECT. A day per row inside a single card, each
            // row its date and its figures on one line - so a week reads down
            // in one go rather than being opened a card at a time. What it
            // gives up is the expanded detail, which is the trade.
            <ThemedView type="backgroundElement" style={styles.weekCard}>
              {history.map((d, i) => (
                <View
                  key={d.dayKey}
                  style={[
                    styles.weekRow,
                    i > 0 && { borderTopWidth: 1, borderTopColor: theme.background },
                  ]}
                >
                  <ThemedText type="smallBold">{dayHeading(d.date)}</ThemedText>
                  <ThemedText type="detail" themeColor="textSecondary">
                    {summaryLine(d)}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>
          ) : (
            history.map((d) => (
              <DayCard
                key={d.dayKey}
                day={d}
                icons={icons}
                expanded={openDay === d.dayKey}
                onToggle={() => setOpenDay((k) => (k === d.dayKey ? null : d.dayKey))}
              />
            ))
          )}
        </View>
      )}

      <MonthYearPicker
        visible={pickerOpen}
        initial={weekStart}
        onCancel={() => setPickerOpen(false)}
        onSelect={(ws) => {
          setWeekStart(ws);
          setPickerOpen(false);
        }}
      />

      <ThenAndNowTable />

      <ReportLink start={['body', 'metrics']} label="Build a report from this" />
      <ExportLink />

      <LogInChatHint tab="body" />
    </ThemedView>
  );
}

// TODAY. The quick-log bar, then whatever has been recorded so far, then the
// time it was recorded. Empty is a normal morning, not a failure, so the card
// still draws with its input and says nothing else.
function TodayBlock({
  day,
  open,
  icons,
  onLogged,
  onNoteChange,
}: {
  day: MeasurementDay | null;
  open: boolean;
  icons: boolean;
  onLogged: () => void;
  onNoteChange: (showing: boolean) => void;
}) {
  const theme = useTheme();
  const body = (
    <>
      <ThemedText type="sectionTitle">Today</ThemedText>
      {/* surface="card" when it sits on one. The field and the + are drawn in
          the app's element tone, which is the same sand a card is, so on a card
          they vanish into it - the prop exists because the Food log's Today
          card hit this exact thing, and I still managed not to pass it. */}
      <QuickLogBar
        kind="measurement"
        surface={open ? 'page' : 'card'}
        onLogged={onLogged}
        onNoteChange={onNoteChange}
      />
      {day ? (
        <View style={styles.metricList}>
          {day.metrics.map((m, i) => (
            <MetricRow
              key={m.key}
              label={m.label}
              text={m.text}
              icons={icons}
              // In the open form a hairline separates the rows, because there
              // is no card edge doing it.
              rule={open && i > 0 ? theme.backgroundSelected : null}
            />
          ))}
          {loggedAtLabel(day) ? (
            <ThemedText type="detail" themeColor="textSecondary" style={styles.loggedAt}>
              {loggedAtLabel(day)}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (open) return <View style={styles.todayOpen}>{body}</View>;
  return (
    <ThemedView type="backgroundElement" style={styles.todayCard}>
      {body}
    </ThemedView>
  );
}

// A past day. Collapsed it is its date and a summary line; open it is the same
// rows Today uses.
function DayCard({
  day,
  icons,
  expanded,
  onToggle,
}: {
  day: MeasurementDay;
  icons: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${dayHeading(day.date)}. ${summaryLine(day)}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <ThemedView type="backgroundElement" style={styles.dayCard}>
        <View style={styles.dayHead}>
          <View style={styles.dayHeadText}>
            <ThemedText type="smallBold">{dayHeading(day.date)}</ThemedText>
            {!expanded ? (
              <ThemedText type="detail" themeColor="textSecondary">
                {summaryLine(day)}
              </ThemedText>
            ) : null}
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={theme.textSecondary}
          />
        </View>
        {expanded ? (
          <View style={styles.metricList}>
            {day.metrics.map((m) => (
              <MetricRow key={m.key} label={m.label} text={m.text} icons={icons} rule={null} />
            ))}
            {loggedAtLabel(day) ? (
              <ThemedText type="detail" themeColor="textSecondary" style={styles.loggedAt}>
                {loggedAtLabel(day)}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </ThemedView>
    </Pressable>
  );
}

// ONE METRIC: its name on the left, its figure on the right.
//
// THE ICONS ARE THE VARIANT. The mockup draws a line icon beside each of the
// five - a scale, a dial, an arm, a tape, a leg - and they are lovely, but the
// app has no such set: its line art is the six activity marks and the log rows'
// objects. Five more would be a new family drawn to match, and drawing them is
// the work, not wiring them. Variant 1 stands them in from Ionicons to show the
// shape; variant 2 asks whether they earn their place at all.
function MetricRow({
  label,
  text,
  icons,
  rule,
}: {
  label: string;
  text: string;
  icons: boolean;
  rule: string | null;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.metricRow, rule ? { borderTopWidth: 1, borderTopColor: rule } : null]}>
      {icons ? (
        <Ionicons name={iconFor(label)} size={18} color={theme.accentDeep} style={styles.metricIcon} />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={styles.metricLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{text}</ThemedText>
    </View>
  );
}

/** Stand-ins only, so the icon variant can be looked at. See MetricRow. */
function iconFor(label: string): keyof typeof Ionicons.glyphMap {
  const l = label.toLowerCase();
  if (l.includes('weight')) return 'speedometer-outline';
  if (l.includes('fat')) return 'pie-chart-outline';
  if (l.includes('muscle')) return 'barbell-outline';
  if (l.includes('waist')) return 'ellipse-outline';
  return 'resize-outline';
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** "Thursday 25 Sept". Built by hand for the same reason week.ts is. */
function dayHeading(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
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
  // Straight under the title, tight to it, so the two read as one block.
  subtitle: { marginTop: -Spacing.two },
  weekBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLabel: { textAlign: 'center' },
  backToToday: { alignSelf: 'center' },
  section: { gap: Spacing.two },
  todayCard: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  todayOpen: { gap: Spacing.two },
  metricList: { gap: Spacing.half },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 5,
  },
  metricIcon: { width: 20 },
  // Takes the slack so every figure lines up down the right edge.
  metricLabel: { flex: 1 },
  loggedAt: { marginTop: Spacing.one },
  dayCard: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayHeadText: { flex: 1, gap: 2 },
  weekCard: {
    borderRadius: CardRadius,
    paddingHorizontal: Spacing.three,
  },
  weekRow: { paddingVertical: Spacing.two, gap: 2 },
  pressed: { opacity: 0.7 },
});
