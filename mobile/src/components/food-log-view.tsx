import { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { FoodBreakdownCard } from '@/components/food-breakdown-card';
import { FoodCategoryIcon } from '@/components/food-category-icon';
import { QuickLogBar } from '@/components/quick-log-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { foodCategory } from '@/lib/food-category';
import { entryLabel } from '@/lib/food-today';
import { supabase } from '@/lib/supabase';
import { averageLine, macroLine, totalLine, type MacroKey } from '@/lib/tracked-macros';
import { loadTrackedMacros } from '@/lib/tracked-macros-store';
import {
  addWeeks,
  currentWeekStart,
  weekdayName,
  daysOfWeek,
  toLocalDateKey,
  weekLabel,
  weekRange,
  weekStartFor,
} from '@/lib/week';

// THE FOOD LOG, REDRAWN (Ruth's brief, 24 September 2026).
//
//   "This is a design refinement of the Food Log screen only. Do not add new
//   features. The goal is calm, editorial, effortless."
//
// ONE SCREEN WHERE THERE WERE TWO. Today's food lived in the Log tab's Food
// segment and the week-by-week history lived behind its own route, each with
// its own copy of a food row and its own totals. Her design has Today at the
// top of the week it belongs to, and every other day collapsed underneath it,
// which is what the data always was.
//
// A ROW IS THREE THINGS. An icon, what she ate, and the figures underneath in
// muted small. Nothing on the right - no eye, no delete, no menu. Her
// correction, replacing the first draft's overflow menu: "Tap a food row ->
// opens detail view for that entry ... All actions live inside the detail view.
// The list stays completely clean."
//
// WHICH FIGURES IS HERS TO CHOOSE. Calories and protein always; fat, saturated
// fat, carbohydrates, sugar, fibre and salt if she has asked for them. See
// tracked-macros.ts.
//
// WHAT IS DELIBERATELY NOT HERE, from her own list: a searchable food database,
// recent foods, a barcode scanner, meal categories, and any inline delete.

// Android needs telling, on the old architecture. Harmless on the new one and
// on iOS, and a soft expand is the one animation her brief asks for.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FoodRow = {
  id: string;
  happened_at: string;
  meal_label: string | null;
  raw_text: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  sugar_g: number | null;
  fibre_g: number | null;
  sodium_mg: number | null;
};

const SELECT =
  'id, happened_at, meal_label, raw_text, kcal, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, fibre_g, sodium_mg';

export function FoodLogView({ initialWeekStart }: { initialWeekStart?: Date }) {
  const [weekStart, setWeekStart] = useState<Date>(() => initialWeekStart ?? currentWeekStart());
  const [rows, setRows] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tracked, setTracked] = useState<MacroKey[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // Re-read on arrival and again shortly after, for a meal still being parsed.
  useFocusReload(setReloadKey);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const keys = await loadTrackedMacros();
      if (!cancelled) setTracked(keys);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // IT OPENS ON THE LAST WEEK THAT HAS ANYTHING IN IT (2026-09-16, kept from
  // the view this replaces). Opening on an empty week is indistinguishable from
  // a screen that failed to load. Only when no week was asked for: a link into
  // a particular week is an instruction.
  useEffect(() => {
    if (initialWeekStart) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('food_logs')
        .select('happened_at')
        .order('happened_at', { ascending: false })
        .limit(1);
      const latest = data?.[0]?.happened_at;
      if (cancelled || typeof latest !== 'string') return;
      const week = weekStartFor(new Date(latest));
      if (toLocalDateKey(week) !== toLocalDateKey(currentWeekStart())) setWeekStart(week);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWeekStart]);

  const weekKey = toLocalDateKey(weekStart);
  const isCurrentWeek = weekKey === toLocalDateKey(currentWeekStart());
  const todayKey = toLocalDateKey(new Date());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { startISO, endISO } = weekRange(weekStart);
      const { data } = await supabase
        .from('food_logs')
        .select(SELECT)
        .gte('happened_at', startISO)
        .lt('happened_at', endISO)
        .order('happened_at', { ascending: true });
      if (cancelled) return;
      setRows((data ?? []) as FoodRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // weekKey is derived from weekStart, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, reloadKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, FoodRow[]>();
    for (const r of rows) {
      const key = toLocalDateKey(new Date(r.happened_at));
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  // Today first, then the rest of the week newest to oldest - her order.
  const days = daysOfWeek(weekStart);
  const todayInWeek = days.find((d) => toLocalDateKey(d) === todayKey) ?? null;
  const others = days
    .filter((d) => toLocalDateKey(d) !== todayKey)
    // Never show a day that has not happened yet: an empty Saturday on
    // Wednesday reads as a day she failed to log.
    .filter((d) => toLocalDateKey(d) <= todayKey || !isCurrentWeek)
    .sort((a, b) => b.getTime() - a.getTime());

  // AN AVERAGE, NOT A TOTAL (her brief: "This week: avg 1,213 kcal · 63g
  // protein · 5 of 7 days logged"), over days that were logged rather than over
  // a fixed seven.
  const week = averageLine(
    days.map((d) => byDay.get(toLocalDateKey(d)) ?? []),
    tracked
  );

  function toggle(key: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function step(by: -1 | 1) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWeekStart((w) => addWeeks(w, by));
    setExpanded(new Set());
  }

  const entryRows = (list: FoodRow[]) =>
    list.map((row) => (
      <Pressable
        key={row.id}
        onPress={() => setOpenId(row.id)}
        accessibilityRole="button"
        accessibilityLabel={`${entryLabel(row)}. Open to edit or delete.`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.entry}>
          <FoodCategoryIcon category={foodCategory(row)} size={20} />
          <View style={styles.entryText}>
            <ThemedText type="small">{entryLabel(row)}</ThemedText>
            {/* Whatever she has asked to see, and nothing she has not. A macro
                with no figure is left out rather than printed as 0g. */}
            {macroLine(row as unknown as Record<string, unknown>, tracked) ? (
              <ThemedText type="detail" themeColor="textSecondary">
                {macroLine(row as unknown as Record<string, unknown>, tracked)}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Pressable>
    ));

  return (
    <View style={styles.wrap}>
      {/* ARROWS ONLY. Her brief: no calendar picker, no month view. Next stops
          at this week, because there is nothing to show in a future one. */}
      <View style={styles.weekBar}>
        <Step label="‹" hint="Previous week" onPress={() => step(-1)} />
        <ThemedText type="smallBold" themeColor="textSecondary">
          {weekLabel(weekStart)}
        </ThemedText>
        <Step label="›" hint="Next week" onPress={() => step(1)} disabled={isCurrentWeek} />
      </View>

      {todayInWeek && (
        <ThemedView type="backgroundElement" style={styles.today}>
          <ThemedText type="smallBold">Today</ThemedText>

          <QuickLogBar
            kind="food"
            actionLabel="Add"
            surface="card"
            onLogged={() => setReloadKey((k) => k + 1)}
          />

          {(byDay.get(todayKey) ?? []).length > 0 ? (
            <>
              {entryRows(byDay.get(todayKey) ?? [])}
              <View style={styles.totalBlock}>
                <ThemedText type="detail" themeColor="textSecondary">
                  Today&rsquo;s total
                </ThemedText>
                <ThemedText type="small">{totalLine(byDay.get(todayKey) ?? [], tracked)}</ThemedText>
              </View>
            </>
          ) : (
            <ThemedText type="detail" themeColor="textSecondary">
              {loading ? ' ' : 'Nothing logged.'}
            </ThemedText>
          )}
        </ThemedView>
      )}

      {others.map((day) => {
        const key = toLocalDateKey(day);
        const list = byDay.get(key) ?? [];
        const open = expanded.has(key);
        const line = list.length > 0 ? totalLine(list, tracked) : 'Nothing logged';
        return (
          <ThemedView key={key} type="backgroundElement" style={styles.day}>
            <Pressable
              onPress={() => toggle(key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${weekdayName(day)}. ${line}.`}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={styles.dayHead}>
                <View style={styles.dayText}>
                  <ThemedText type="smallBold">{weekdayName(day)}</ThemedText>
                  <ThemedText type="detail" themeColor="textSecondary">
                    {line}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {open ? '⌄' : '›'}
                </ThemedText>
              </View>
            </Pressable>

            {open && list.length > 0 && <View style={styles.dayBody}>{entryRows(list)}</View>}
          </ThemedView>
        );
      })}

      {week.line ? (
        <ThemedText type="detail" themeColor="textSecondary" style={styles.weekSummary}>
          This week: avg {week.line} · {week.daysLogged} of 7 days logged
        </ThemedText>
      ) : null}

      {openId && (
        <FoodBreakdownCard
          foodLogId={openId}
          onClose={() => setOpenId(null)}
          onDeleted={() => {
            setOpenId(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
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
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={Spacing.three}
      style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled]}
    >
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  today: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.two },
  day: { borderRadius: CardRadius, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayText: { flex: 1, gap: 2 },
  dayBody: { gap: Spacing.two, paddingTop: Spacing.two },
  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  // The name is the hero; the figures sit under it, quieter.
  entryText: { flex: 1, gap: 2 },
  totalBlock: { paddingTop: Spacing.one, gap: 2 },
  weekSummary: { paddingHorizontal: Spacing.two, paddingTop: Spacing.one, lineHeight: 18 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.3 },
});
