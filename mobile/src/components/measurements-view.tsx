import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ReadingInterpretationNote } from '@/components/reading-interpretation';
import { MonthYearPicker } from '@/components/month-year-picker';
import { PersonalMetricsView } from '@/components/personal-metrics-view';
import { ExportLink } from '@/components/data-export-link';
import { SpotlightTarget } from '@/components/spotlight-target';
import { ThenAndNowTable } from '@/components/then-and-now';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
// Browsing): one week at a time, seven rows at most, with a back-to-present
// control that appears only once you have moved away. The far-jump month/year
// picker is deliberately NOT here - it is item 44, and a picker that opened
// onto nothing would be a dead control.
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
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MeasurementRow[]>([]);

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
        .select('measured_at, weight_kg, body_fat_pct, muscle_kg, bmr')
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
  }, [weekKey]);

  const dayRows = useMemo(() => buildWeekRows(daysOfWeek(weekStart), rows), [weekKey, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const anyReading = hasAnyReading(dayRows);

  return (
    <ThemedView style={styles.container}>
      {/* What the latest reading means. Anchored to the latest reading, not to
          the displayed week, so it stays put while you step back through
          history - it is a statement about now, not about the week on screen. */}
      <ReadingInterpretationNote />

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
            <DayLine key={r.dayKey} row={r} />
          ))}
        </ThemedView>
      )}

      {!loading && !anyReading ? (
        // Sparse and empty are the normal cases early on, so the empty state is
        // the primary path here, not an afterthought. It says what is missing
        // without implying anyone has fallen behind.
        <ThemedText type="small" themeColor="textSecondary">
          {isPresent
            ? 'No readings this week yet — tell me your weight any time and it lands here.'
            : 'Nothing was recorded this week.'}
        </ThemedText>
      ) : null}

      {!isPresent ? (
        <Pressable
          onPress={() => setWeekStart(currentWeekStart())}
          accessibilityRole="button"
          accessibilityLabel="Back to this week"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.backToPresent}>
            <ThemedText type="smallBold">Back to this week</ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}

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
      <SpotlightTarget id="measurements.export">
        <ExportLink />
      </SpotlightTarget>

    </ThemedView>
  );
}

function DayLine({ row }: { row: DayRow }) {
  return (
    <ThemedView style={styles.dayRow}>
      <ThemedText type="small" style={styles.dayCell}>
        {dayLabel(row.date)}
      </ThemedText>
      <MetricCell value={row.reading?.weight_kg ?? null} pct={row.weightPct} />
      <MetricCell value={row.reading?.body_fat_pct ?? null} pct={row.bodyFatPct} />
      <MetricCell value={row.reading?.muscle_kg ?? null} pct={row.musclePct} />
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
    borderRadius: Spacing.three,
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
  metricCell: {
    flex: 1,
    alignItems: 'flex-end',
  },
  delta: {
    marginTop: 1,
  },
  backToPresent: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
