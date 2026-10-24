import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useFocusReload } from '@/hooks/use-focus-reload';
import { StyleSheet, View } from 'react-native';

import { BodyScreen } from '@/components/body-screen';
import { NutrientIcon } from '@/components/nutrient-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { explainerFor } from '@/lib/macro-explainers';
import { loadNutrientProfile } from '@/lib/nutrient-profile';
import {
  referenceFor,
  standingFor,
  STANDING_COLOUR,
  STANDING_LABEL,
  STANDING_NOTE,
  NO_NUTRIENT_PROFILE,
  type NutrientProfile,
} from '@/lib/nutrient-standing';
import { supabase } from '@/lib/supabase';
import { MACROS, macroAmount, macroFigure, type MacroKey } from '@/lib/tracked-macros';
import { averageLine } from '@/lib/tracked-macros';
import { loadTrackedMacros } from '@/lib/tracked-macros-store';
import { currentWeekStart, daysOfWeek, toLocalDateKey, weekLabel, weekRange } from '@/lib/week';

// ONE NUTRIENT'S OWN SCREEN (Ruth's artwork, screens two and three).
//
// Her verdict on the first attempt, 24 October 2026: "the follow through
// screens weren't make, just pointed to the generic list of nutrients we
// already had." She was right - every cell opened the same page listing all ten
// nutrients, and I had written a comment in the file explaining why that was
// acceptable. It was not: a figure that opens a glossary has not been followed
// through, it has been deflected.
//
// WHAT HER ARTWORK PUTS HERE, in its order:
//   the figure, large, with the range beside it
//   a bar showing where the figure sits against that range
//   the state, in her words, with its line
//   "Why it matters", which is the explainer this app already had
//
// AND WHAT IS NOT HERE YET, said plainly rather than faked: "Where yours came
// from" - the breakdown by food, with grams and percentages - and the per-food
// screen under it. Those need a query over food_items that does not exist yet.
// The screen says nothing about them rather than showing an empty frame.

export default function NutrientScreen() {
  const theme = useTheme();
  const { key } = useLocalSearchParams<{ key: string }>();
  const macroKey = (MACROS.find((m) => m.key === key)?.key ?? null) as MacroKey | null;

  const [profile, setProfile] = useState<NutrientProfile>(NO_NUTRIENT_PROFILE);
  const [averages, setAverages] = useState<Record<string, number> | null>(null);
  const [daysLogged, setDaysLogged] = useState(0);
  // THIS SCREEN LIVES UNDER A TAB, so it stays mounted and a read on mount runs
  // exactly once. A meal logged by voice while this screen is behind the Log
  // tab would never reach it. check-tabs-refetch caught this before it shipped.
  const [reloadKey, setReloadKey] = useState(0);
  useFocusReload(setReloadKey);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const weekStart = currentWeekStart();
      const { startISO, endISO } = weekRange(weekStart);
      const [{ data }, tracked, p] = await Promise.all([
        supabase
          .from('food_logs')
          .select('happened_at, kcal, protein_g, carbs_g, fat_g, saturated_fat_g, sugar_g, free_sugar_g, fibre_g, sodium_mg, calcium_mg, iron_mg')
          .gte('happened_at', startISO)
          .lt('happened_at', endISO),
        loadTrackedMacros(),
        loadNutrientProfile(),
      ]);
      if (cancelled) return;

      const byDay = new Map<string, Record<string, unknown>[]>();
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const k = toLocalDateKey(new Date(String(row.happened_at)));
        byDay.set(k, [...(byDay.get(k) ?? []), row]);
      }
      const week = averageLine(
        daysOfWeek(weekStart).map((d) => byDay.get(toLocalDateKey(d)) ?? []),
        tracked
      );
      setAverages(week.averages);
      setDaysLogged(week.daysLogged);
      setProfile(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const spec = macroKey ? MACROS.find((m) => m.key === macroKey) : null;
  if (!spec || !macroKey) {
    return (
      <BodyScreen title="Not found">
        <ThemedText type="small" themeColor="textSecondary">
          That nutrient is not one Selodía tracks.
        </ThemedText>
      </BodyScreen>
    );
  }

  const explainer = explainerFor(macroKey);
  const reference = referenceFor(macroKey, profile);
  const figure = averages ? macroFigure(macroKey, averages) : null;
  const amount = averages ? macroAmount(macroKey, averages) : null;
  const standing = standingFor(amount, reference);
  const colour = standing ? STANDING_COLOUR[standing] : theme.textSecondary;

  return (
    <BodyScreen title={spec.label}>
      <ThemedText type="detail" themeColor="textSecondary">
        Daily average · {weekLabel(currentWeekStart())} · {daysLogged} of 7 days logged
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.figureCard}>
        <View style={styles.figureRow}>
          <View style={styles.figureBlock}>
            <ThemedText type="title">{figure ?? '—'}</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              per day on average
            </ThemedText>
          </View>
          {reference ? (
            <View style={styles.targetBlock}>
              <ThemedText type="detail" themeColor="textSecondary">
                {reference.kind === 'target' ? 'Target' : 'Guideline'}
              </ThemedText>
              <ThemedText type="small">{reference.stated}</ThemedText>
            </View>
          ) : null}
        </View>

        {/* THE BAR, WHICH IS THE ARTWORK'S AND IS WORTH THE SPACE. A figure
            beside a range still needs reading; a bar is understood before it is
            read. It is drawn only when there is a real range to draw against. */}
        {reference && amount != null ? (
          <Bar amount={amount} reference={reference} colour={colour} track={theme.background} />
        ) : null}
      </ThemedView>

      {standing ? (
        <ThemedView type="background" style={styles.stateCard}>
          <NutrientIcon macroKey={macroKey} size={20} color={colour} />
          <View style={styles.stateText}>
            <ThemedText type="smallBold">{STANDING_LABEL[standing]}</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              {STANDING_NOTE[standing]}
            </ThemedText>
          </View>
        </ThemedView>
      ) : (
        // NO COLOUR AND NO VERDICT, and the screen says which. Carbohydrate has
        // no published daily gram figure; total sugar cannot be measured
        // against a free-sugar limit. Silence here would read as a figure that
        // failed to load.
        <ThemedView type="background" style={styles.stateCard}>
          <NutrientIcon macroKey={macroKey} size={20} color={theme.textSecondary} />
          <View style={styles.stateText}>
            <ThemedText type="smallBold">No guideline to compare against</ThemedText>
            <ThemedText type="detail" themeColor="textSecondary">
              {macroKey === 'carbs'
                ? 'Carbohydrate guidance is a share of your energy rather than a number of grams, so Selodía shows the figure without scoring it.'
                : macroKey === 'sugar'
                  ? 'The published limit is for free sugars - what is added, plus honey, syrups and juice. This figure is all sugar, including the sugar in whole fruit and milk, so the two are not comparable.'
                  : 'Selodía has nothing published to measure this against, so it shows the figure and no verdict.'}
            </ThemedText>
          </View>
        </ThemedView>
      )}

      {explainer ? (
        <>
          <ThemedText type="subtitle" style={styles.head}>
            Why it matters
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.para}>
            {explainer.what}
          </ThemedText>

          <ThemedText type="subtitle" style={styles.head}>
            Where it comes from
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.para}>
            {explainer.where}
          </ThemedText>
        </>
      ) : null}

      {reference ? (
        <ThemedText type="detail" themeColor="textSecondary" style={styles.source}>
          {reference.kind === 'target'
            ? `${reference.stated} is your own target, worked out from your body and your goals.`
            : `${reference.stated}, from ${reference.source}.`}
        </ThemedText>
      ) : null}
    </BodyScreen>
  );
}

/**
 * Where a figure sits against its range.
 *
 * A FLOOR AND A CEILING ARE DRAWN DIFFERENTLY ON PURPOSE. For fibre the mark is
 * the figure you are climbing towards; for salt it is the line you are staying
 * under. Drawing both as "progress" would make a salty day look like an
 * achievement.
 */
function Bar({
  amount,
  reference,
  colour,
  track,
}: {
  amount: number;
  reference: { shape: { kind: 'floor' | 'ceiling' | 'band'; value?: number; low?: number; high?: number } };
  colour: string;
  track: string;
}) {
  const s = reference.shape;
  const top =
    s.kind === 'band' ? (s.high ?? 0) * 1.25 : (s.value ?? 0) * 1.25;
  const pct = (n: number): `${number}%` =>
    `${Math.max(0, Math.min(100, (n / top) * 100))}%`;
  const markAt = s.kind === 'band' ? (s.low ?? 0) : (s.value ?? 0);

  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <View style={[styles.fill, { width: pct(amount), backgroundColor: colour }]} />
      {/* The line to reach, or the line to stay under. */}
      <View style={[styles.mark, { left: pct(markAt) }]} />
      {s.kind === 'band' ? <View style={[styles.mark, { left: pct(s.high ?? 0) }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  figureCard: { borderRadius: CardRadius, padding: Spacing.three, gap: Spacing.three, marginTop: Spacing.two },
  figureRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.three },
  figureBlock: { flexShrink: 1 },
  targetBlock: { alignItems: 'flex-end', flexShrink: 1 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#2D2B28', opacity: 0.45 },
  stateCard: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  stateText: { flex: 1, gap: 2 },
  head: { marginTop: Spacing.four },
  para: { lineHeight: 20, marginTop: Spacing.two },
  source: { marginTop: Spacing.four, lineHeight: 16 },
});
