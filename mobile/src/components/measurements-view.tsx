import { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { ReadingCard } from '@/components/reading-card';
import { ReadingInterpretationNote } from '@/components/reading-interpretation';
import { MonthYearPicker } from '@/components/month-year-picker';
import { PersonalMetricsView } from '@/components/personal-metrics-view';
import { LogInChatHint } from '@/components/log-in-chat-hint';
import { QuickLogBar } from '@/components/quick-log-bar';
import { ExportLink } from '@/components/data-export-link';
import { ReportLink } from '@/components/report-link';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThenAndNowTable } from '@/components/then-and-now';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WhatYouBurn } from '@/components/what-you-burn';
import { CardRadius, Spacing } from '@/constants/theme';
import { useBurnFigures } from '@/hooks/use-burn-figures';
import {
  buildWeekRows,
  formatMetric,
  formatPercentDelta,
  hasAnyReading,
  type DayRow,
} from '@/lib/measurements-week';
import type { MeasurementRow } from '@/lib/overview-metrics';
import { supabase } from '@/lib/supabase';
import {
  addWeeks,
  currentWeekStart,
  dayLabel,
  daysOfWeek,
  toLocalDateKey,
  weekLabel,
  weekRange,
} from '@/lib/week';

// The Measurements segment (build item 38, slice 1): the minimized weekly table
// of body data - Day / Weight / Body fat / Muscle, each carrying a trailing 7d
// percentage delta (SELODIA_SPEC.md, The Measurements Segment).
//
// This is the weekly table's HOME. food-week-view.tsx holds the same mechanic
// on the wrong screen; it stays there untouched until the Food segment's
// today's-log view replaces it, so nothing is broken in passing.
//
// Week-stepping is the calm default for browsing (Part Five, Historical
// Browsing): one week at a time, seven rows at most, with ONE back-to-present
// control - a quiet link beside the stepper it undoes - that appears only once
// you have moved away. There were two of them until 25 September, a link above
// the table and a filled button below it, doing exactly the same thing under
// two different names.
//
// No eye icon on the rows yet. It needs the discuss-card capture path (item 30
// slice 4) which rides the next native build; an icon that opened nothing would
// be worse than its absence (principle 8).

// How far back to read beyond the displayed week. The 7d comparison reaches
// outside the week by definition, and the reference-window tolerance accepts a
// gap of up to 11 days, so the query has to cover that or valid deltas would
// silently vanish at the week boundary.
const LOOKBACK_DAYS = 12;

export function MeasurementsView({ initialWeekStart }: { initialWeekStart?: Date }) {
  const [weekStart, setWeekStart] = useState<Date>(initialWeekStart ?? currentWeekStart());
  // Never persistent: it opens only when someone reaches for it (Part Five).
  const [pickerOpen, setPickerOpen] = useState(false);
  // The reading whose card is open, or null. Held here rather than in the row so
  // only one card can ever be open, and closing returns focus to the same week.
  const [openRow, setOpenRow] = useState<DayRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  // Bumped when something lands, so a reading logged here appears here.
  const [reloadKey, setReloadKey] = useState(0);
  // See ReadingInterpretationNote: the quick-log acknowledgment already carries
  // the reading's interpretation, so the standalone note stands down while it is
  // on screen rather than repeating it.
  const [ackShowing, setAckShowing] = useState(false);
  // Re-read on arrival and shortly after - see hooks/use-focus-reload.ts.
  useFocusReload(setReloadKey);
  // Same key, so a weight logged from the bar above moves the burn figures too.
  const burn = useBurnFigures(reloadKey);

  // Stable primitive dep: a fresh Date each render would refire the effect.
  const weekKey = toLocalDateKey(weekStart);
  const presentKey = toLocalDateKey(currentWeekStart());
  const isPresent = weekKey === presentKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      const from = new Date(new Date(startISO).getTime() - LOOKBACK_DAYS * 86_400_000);
      // RLS scopes the read to the signed-in user - no explicit user_id filter.
      const { data } = await supabase
        .from('body_measurements')
        .select('id, measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
        .gte('measured_at', from.toISOString())
        .lt('measured_at', endISO)
        .order('measured_at', { ascending: false });
      if (!cancelled) {
        setRows((data ?? []) as MeasurementRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart; weekStart is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, reloadKey]);

  const dayRows = useMemo(() => buildWeekRows(daysOfWeek(weekStart), rows), [weekKey, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const anyReading = hasAnyReading(dayRows);

  return (
    <ThemedView style={styles.container}>
      {/* Logging from the screen you are already looking at, the same bar the
          Food and Activity tabs carry and behind it the same single pipeline:
          text goes to ask-selodia exactly as the Chat composer's does. There is
          no measurement parser here and no measurement route - the conversation
          does the work, and a reading logged from this bar is indistinguishable
          downstream from one typed in Chat.

          No duration sheet on this one. That gate is specific to activity,
          where a missing duration makes the calorie figure a fiction; a weight
          is complete the moment it is stated. */}
      <QuickLogBar
        kind="measurement"
        onLogged={() => setReloadKey((k) => k + 1)}
        onNoteChange={setAckShowing}
      />

      <LogInChatHint tab="body" />

      {/* What the latest reading means. Anchored to the latest reading, not to
          the displayed week, so it stays put while you step back through
          history - it is a statement about now, not about the week on screen. */}
      <ReadingInterpretationNote hidden={ackShowing} />

      {openRow ? (
        <ReadingCard
          reading={openRow.reading ?? null}
          dateLabel={dayLabel(openRow.date)}
          onClose={() => setOpenRow(null)}
          onDeleted={() => {
            setOpenRow(null);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : null}

      <SpotlightTarget id="measurements.week">
      <ThemedView style={styles.weekBar}>
        <StepButton label="‹" hint="Previous week" onPress={() => setWeekStart(addWeeks(weekStart, -1))} />
        {/* The single far-jump entry point. Ordinary browsing never needs it -
            week stepping is the calm default - so it is one quiet control on
            the label itself rather than a persistent picker. */}
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
        <StepButton
          label="›"
          hint="Next week"
          disabled={isPresent}
          onPress={() => setWeekStart(addWeeks(weekStart, 1))}
        />
      </ThemedView>
      </SpotlightTarget>

      {/* BACK TO TODAY (Ruth, 2026-09-16: "It needs every page to have a back to
          today button"). It matters most here, because the month picker above
          can land you in March in one tap and stepping home from there is
          twenty presses. Only when away from this week - on it, the control
          would do nothing. */}
      {!isPresent && (
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
      )}

      {loading ? (
        <ThemedText type="small" themeColor="textSecondary">
          …
        </ThemedText>
      ) : (
        <ThemedView type="backgroundElement" style={styles.table}>
          <ThemedView style={styles.headerRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dayCell}>
              {' '}
            </ThemedText>
            {['Weight', 'Body fat', 'Muscle'].map((h) => (
              <ThemedText key={h} type="small" themeColor="textSecondary" style={styles.metricCell}>
                {h}
              </ThemedText>
            ))}
          </ThemedView>

          {dayRows.map((r) => (
            <DayLine key={r.dayKey} row={r} onOpen={() => setOpenRow(r)} />
          ))}
        </ThemedView>
      )}

      {!loading && !anyReading ? (
        // Sparse and empty are the normal cases early on, so the empty state is
        // the primary path here, not an afterthought. It says what is missing
        // without implying anyone has fallen behind.
        <ThemedText type="small" themeColor="textSecondary">
          {isPresent
            ? 'No readings this week yet. Tell me your weight any time and it lands here.'
            : 'Nothing was recorded this week.'}
        </ThemedText>
      ) : null}

      {/* THERE WERE TWO OF THESE (Ruth, 25 September 2026: the Measurements
          screen wants "one more simplification pass").

          "Back to today" as a quiet link above the table and "Back to this
          week" as a filled button below it: two controls, two names, one
          behaviour - both called setWeekStart(currentWeekStart()). They
          arrived separately, weeks apart, and nothing ever looked at the
          screen with both on it at once. The link above stays, because it sits
          beside the week stepper it undoes; the button is gone. */}

      {/* The second table, stacked directly under the scale one on the same
          continuous screen - both visible together, no toggle (Ruth, 2026-08-27).
          Split by SOURCE: someone can stop using a scale and keep measuring
          everything else, or the reverse, and one combined table would leave
          permanent empty cells for whichever they stopped. */}
      <MonthYearPicker
        visible={pickerOpen}
        initial={weekStart}
        onCancel={() => setPickerOpen(false)}
        onSelect={(ws) => {
          setWeekStart(ws);
          setPickerOpen(false);
        }}
      />

      {/* WHAT YOU BURN LIVES HERE NOW (Ruth, 25 September 2026).
          It was at the foot of the Activity screen until 16 September, when she
          said it was "too hidden" and asked for it on Today. Today then ran out
          of room: the Health Flower was being cut off, and shown the choice
          between this panel and the daily line she kept the line.
          Back to Activity would be back to the complaint. This is the screen
          the figures are actually about - the scale's own BMR comes from these
          readings - and it is one tap from the Body square on Today, which is
          where somebody looking at a weight already is. Collapsed it is still
          one row; nothing about the panel itself changed. */}
      <WhatYouBurn figures={burn} />

      <PersonalMetricsView />

      {/* Slice 3 of this segment (build item 16). Below both tables: it is the
          longest view back, so it reads last, and Part Five keeps it in a
          segment someone chooses to open rather than on the landing. */}
      <ThenAndNowTable />

      {/* The SECOND of the two entry points Part Five requires, and it names
          this one specifically: "a quiet link from the history/week view
          itself, since that is where someone browsing old data would naturally
          think to look." Quiet is the operative word - a link, under the
          history, not a button competing with it. */}
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

function DayLine({ row, onOpen }: { row: DayRow; onOpen: () => void }) {
  const theme = useTheme();
  // A day with no reading has nothing to open. Rendering the affordance anyway
  // would be a control that does nothing on most rows of a sparse week, which is
  // the dead control principle 8 rules out - so the space is held and left empty.
  const openable = !!row.reading?.id;

  return (
    <ThemedView style={styles.dayRow}>
      <ThemedText type="small" style={styles.dayCell}>
        {dayLabel(row.date)}
      </ThemedText>
      <MetricCell value={row.reading?.weight_kg ?? null} pct={row.weightPct} />
      <MetricCell value={row.reading?.body_fat_pct ?? null} pct={row.bodyFatPct} />
      <MetricCell value={row.reading?.muscle_kg ?? null} pct={row.musclePct} />
      {openable ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`About ${dayLabel(row.date)}'s reading`}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
        >
          <Ionicons name="eye-outline" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : (
        <ThemedView style={styles.eye} />
      )}
    </ThemedView>
  );
}

// Value over its 7d delta. The delta sits underneath rather than beside so
// three metrics fit a phone width without the numbers wrapping mid-column.
function MetricCell({ value, pct }: { value: number | null; pct: number | null }) {
  const delta = formatPercentDelta(pct);
  return (
    <ThemedView style={styles.metricCell}>
      <ThemedText type="small">{formatMetric(value)}</ThemedText>
      {delta ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.delta}>
          {delta}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

function StepButton({
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
      <ThemedText type="smallBold" themeColor={disabled ? 'textSecondary' : 'text'} style={disabled && styles.disabled}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backToToday: {
    alignSelf: 'center',
  },
  container: {
    gap: Spacing.three,
  },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  table: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    // CardRadius, not Spacing.three (Ruth, 25 September 2026: this screen is
    // "totally out of sync visually with the rest of the app"). The UI brief of
    // 17 September asked for one corner radius throughout and CardRadius is it
    // - 20 rather than 16, because at 16 a full-width card still reads as a
    // panel. This table was at 16, sitting on a screen reached from cards at
    // 20. It is a small thing that is wrong on most of the app; see the note
    // to her rather than fixing forty files in passing.
    borderRadius: CardRadius,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dayCell: {
    flex: 1.2,
  },
  // A fixed-width column so rows with a reading and rows without still line up.
  eye: { width: 24, alignItems: 'center', justifyContent: 'center' },
  metricCell: {
    flex: 1,
    alignItems: 'flex-end',
  },
  delta: {
    marginTop: 1,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
